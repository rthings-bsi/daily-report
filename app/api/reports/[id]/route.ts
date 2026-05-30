import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/reports/:id — load a specific session
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const report = await prisma.reportSession.findUnique({
    where: { id },
    include: {
      movementSummaries: true,
      stocks: true,
      movements: true, // Legacy
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
      ...m,
      id: `move-${idx}`,
      postingDate: new Date(m.dateStr).toISOString(),
      movementStatus: 'Unknown',
    }));

    return NextResponse.json({
      ...report,
      movements: parsedMovements,
      movementSummaries: report.movementSummaries,
      stocks,
      stockCards,
      stats,
    });
  }

  // ── Legacy session: hydrate from Movement rows ──
  const movements = report.movements.map((m) => ({
    ...m,
    postingDate: m.postingDate.toISOString(),
  }));

  const stocks = report.stocks.map((s) => ({
    status: s.material,
    sloc: s.sloc,
    quantity: s.unitQty,
    tonnage: s.weight,
  }));

  const stockCards = report.stockCards ? JSON.parse(report.stockCards) : [];

  return NextResponse.json({ ...report, movements, stocks, stockCards });
}

// DELETE /api/reports/:id — delete a session
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  await prisma.reportSession.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
