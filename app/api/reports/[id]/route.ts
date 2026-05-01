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
      movements: true,
      stocks: true,
    },
  });

  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Re-hydrate dates to match ProcessedMovement shape
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

  return NextResponse.json({ ...report, movements, stocks });
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
