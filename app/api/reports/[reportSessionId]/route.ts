import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertOwnsSession, requireUserContext, respondError } from "@/lib/api-helpers";

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

  // ── New session: has pre-calculated stats + rawMovements JSON ──
  if (report.stats && report.rawMovements) {
    const stats = JSON.parse(report.stats);
    const movements = detail
      ? JSON.parse(report.rawMovements).map((m: any, idx: number) => ({
          movementId: `move-${idx}`,
          postingDate: m.dateStr,
          dateStr: m.dateStr,
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
          movementStatus: 'Unknown',
        }))
      : [];
    const stocks = detail ? (report.rawStocks ? JSON.parse(report.rawStocks) : []) : [];

    return NextResponse.json({
      ...rest,
      movements,
      movementSummaries: report.movementSummaries,
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
    movementSummaries: report.movementSummaries,
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
    return NextResponse.json({ ok: true });
  } catch (err) {
    return respondError(err);
  }
}
