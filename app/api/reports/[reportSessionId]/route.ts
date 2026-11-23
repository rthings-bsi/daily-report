import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertOwnsSession, requireUserContext, respondError } from "@/lib/api-helpers";
import { getShiftFromTime, getOperationalDateStr } from "@/lib/excel-parser";
import { invalidateRepairPackingCache } from "../repair-packing/route";
import { classifyBatch } from "@/lib/gudang";

export const dynamic = "force-dynamic";

// GET /api/reports/:reportSessionId?detail=true — load a specific session
// Default (no ?detail=true): returns summaries + stockCards only (lightweight).
// With ?detail=true: also returns the full parsed rawMovements/rawStocks rows.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reportSessionId: string }> }
) {
  const ctx = await requireUserContext();
  if (ctx instanceof NextResponse) return ctx;

  const detail = new URL(req.url).searchParams.get("detail") === "true";

  const { reportSessionId: id } = await params;

  try {
    await assertOwnsSession(ctx, id);
  } catch (err) {
    return respondError(err);
  }

  const report = await prisma.reportSession.findUnique({
    where: { reportSessionId: id },
    include: {
      movementSummaries: true,
      stockSummaries: true,
      stocks: true,       // Legacy — read for unmigrated sessions
      movements: true,    // Legacy
    },
  });

  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Remove the giant raw JSON string columns from the spread — they'd otherwise
  // be shipped to the client untouched (duplicating the parsed payload).
  const {
    rawMovements: _rawMovements,
    rawStocks: _rawStocks,
    stockCards: _stockCards,
    movements: _movements,
    stocks: _stocks,
    ...rest
  } = report;

  const stockCards = report.stockCards ? JSON.parse(report.stockCards) : [];
  // Enrich movementSummaries with Fast/Slow metrics from raw movements
  let enrichedSummaries = report.movementSummaries;
  const rawList = report.rawMovements
    ? (typeof report.rawMovements === 'string' ? JSON.parse(report.rawMovements) : report.rawMovements)
    : (report.movements || []);
  if (Array.isArray(rawList) && rawList.length > 0 && report.movementSummaries && report.movementSummaries.length > 0) {
    try {
      const breakdownMap = new Map<string, { fastCount: number; slowCount: number; fastWeight: number; slowWeight: number }>();
      for (const m of rawList) {
        const dStr = m.dateStr || (m.postingDate ? (typeof m.postingDate === 'string' ? m.postingDate.slice(0, 10) : m.postingDate.toISOString().slice(0, 10)) : '');
        const key = `${dStr}|${m.moveType}|${m.workCenter || ""}|${m.group}|${m.color}`;
        const status = (m.movementStatus && m.movementStatus !== 'Unknown')
          ? m.movementStatus
          : classifyBatch(m.batch || '');
        const entry = breakdownMap.get(key) || { fastCount: 0, slowCount: 0, fastWeight: 0, slowWeight: 0 };
        const w = Math.abs(m.quantity || 0);
        if (status === 'Fast') {
          entry.fastCount += 1;
          entry.fastWeight += w;
        } else if (status === 'Slow') {
          entry.slowCount += 1;
          entry.slowWeight += w;
        }
        breakdownMap.set(key, entry);
      }
      enrichedSummaries = report.movementSummaries.map((s: any) => {
        const key = `${s.dateStr}|${s.moveType}|${s.workCenter || ""}|${s.group}|${s.color}`;
        const b = breakdownMap.get(key);
        return {
          ...s,
          fastCount: b?.fastCount ?? 0,
          slowCount: b?.slowCount ?? 0,
          fastWeight: b?.fastWeight ?? 0,
          slowWeight: b?.slowWeight ?? 0,
        };
      });
    } catch (e) {
      console.error("Failed enriching movementSummaries with Fast/Slow breakdown:", e);
    }
  }


  // ── New session: has pre-calculated stats + rawMovements JSON ──
  if (report.stats && report.rawMovements) {
    const stats = JSON.parse(report.stats);
    const movements = detail
      ? JSON.parse(report.rawMovements).map((m: any, idx: number) => {
          const opDate = m.entryTime ? getOperationalDateStr(m.entryDate || m.dateStr, m.entryTime) : m.dateStr;
          const mShift = m.shift || (m.entryTime ? getShiftFromTime(m.entryTime) : undefined);
          return {
            movementId: `move-${idx}`,
            postingDate: opDate,
            dateStr: opDate,
            moveType: m.moveType,
            description: m.description,
            material: m.material || undefined,
            workCenter: m.workCenter || "",
            batch: m.batch || "",
            quantity: m.quantity,
            unitQuantity: m.unitQuantity || 0,
            userName: m.userName || "",
            storageLocation: m.storageLocation || "",
            group: m.group,
            color: m.color,
            movementStatus: (m.movementStatus && m.movementStatus !== 'Unknown')
              ? m.movementStatus
              : classifyBatch(m.batch || ''),
            entryTime: m.entryTime || undefined,
            entryDate: m.entryDate || undefined,
            shift: mShift,
          };
        })
      : [];
    const stocks = detail ? (report.rawStocks ? JSON.parse(report.rawStocks) : []) : [];

    return NextResponse.json({
      ...rest,
      movements,
      movementSummaries: enrichedSummaries,
      stockSummaries: report.stockSummaries,
      stocks,
      stockCards,
      stats,
    });
  }

  // ── Legacy session: hydrate from Movement rows ──
  const movements = detail
    ? report.movements.map((m) => ({
        movementId: m.movementId,
        postingDate: m.postingDate.toISOString(),
        dateStr: m.dateStr,
        moveType: m.moveType,
        description: m.description,
        workCenter: m.workCenter,
        batch: m.batch,
        storageLocation: m.storageLocation,
        quantity: m.quantity,
        unitQuantity: m.unitQuantity,
        group: m.group,
        color: m.color,
        userName: m.userName,
        movementStatus: classifyBatch(m.batch || ''),
      }))
    : [];

  const stocks = detail
    ? report.stocks.map((s) => ({
        status: s.material,
        sloc: s.sloc,
        quantity: s.unitQty,
        tonnage: s.weight,
      }))
    : [];

  return NextResponse.json({
    ...rest,
    movements,
    movementSummaries: enrichedSummaries,
    stockSummaries: report.stockSummaries,
    stocks,
    stockCards,
  });
}

// DELETE /api/reports/:reportSessionId — delete a session
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ reportSessionId: string }> }
) {
  const ctx = await requireUserContext();
  if (ctx instanceof NextResponse) return ctx;

  const { reportSessionId: id } = await params;

  try {
    await assertOwnsSession(ctx, id);
    await prisma.reportSession.delete({ where: { reportSessionId: id } });
    invalidateRepairPackingCache();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return respondError(err);
  }
}
