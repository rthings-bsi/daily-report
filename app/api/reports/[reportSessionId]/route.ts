import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertOwnsSession, requireUserContext, respondError } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// GET /api/reports/:reportSessionId — load a specific session
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reportSessionId: string }> }
) {
  const ctx = await requireUserContext();
  if (ctx instanceof NextResponse) return ctx;

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

  // ── New session: has pre-calculated stats + rawMovements JSON ──
  if (report.stats && report.rawMovements) {
    const stats = JSON.parse(report.stats);
    const rawMovements = JSON.parse(report.rawMovements);
    const stocks = report.rawStocks ? JSON.parse(report.rawStocks) : [];
    const stockCards = report.stockCards ? JSON.parse(report.stockCards) : [];

    const parsedMovements = rawMovements.map((m: any, idx: number) => ({
      movementId: `move-${idx}`,
      postingDate: new Date(m.dateStr).toISOString(),
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
    }));

    return NextResponse.json({
      ...report,
      movements: parsedMovements,
      movementSummaries: report.movementSummaries,
      stockSummaries: report.stockSummaries,
      stocks,
      stockCards,
      stats,
    });
  }

  // ── Legacy session: hydrate from Movement rows ──
  const movements = report.movements.map((m) => ({
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
  }));

  const stocks = report.stocks.map((s) => ({
    status: s.material,
    sloc: s.sloc,
    quantity: s.unitQty,
    tonnage: s.weight,
  }));

  const stockCards = report.stockCards ? JSON.parse(report.stockCards) : [];

  return NextResponse.json({
    ...report,
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
