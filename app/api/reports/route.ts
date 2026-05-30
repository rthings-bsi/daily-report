import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/reports — list all sessions
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessions = await prisma.reportSession.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      label: true,
      dateStr: true,
      fileName: true,
      createdAt: true,
      stats: true,
      _count: { select: { movements: true } },
    },
  });

  const result = sessions.map(({ stats, _count, ...s }) => ({
    ...s,
    totalCount: stats ? JSON.parse(stats).totalCount : _count.movements,
  }));

  return NextResponse.json(result);
}

// POST /api/reports — create new session with aggregated movement + stock data
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { label, dateStr, fileName, movements, stocks, stockCards } = body;

  try {
    // ── Aggregate movements into summary rows ──
    const summaryMap = new Map<string, {
      dateStr: string; moveType: string; description: string;
      workCenter: string | null; group: string; color: string;
      totalQuantity: number; totalUnitQuantity: number; totalCount: number;
    }>();

    for (const m of movements) {
      const key = `${m.dateStr}|${m.moveType}|${m.workCenter || ''}|${m.group}|${m.color}`;
      const existing = summaryMap.get(key);
      if (existing) {
        existing.totalQuantity += m.quantity;
        existing.totalUnitQuantity += (m.unitQuantity || 0);
        existing.totalCount += 1;
      } else {
        summaryMap.set(key, {
          dateStr: m.dateStr,
          moveType: m.moveType,
          description: m.description,
          workCenter: m.workCenter ?? null,
          group: m.group,
          color: m.color,
          totalQuantity: m.quantity,
          totalUnitQuantity: m.unitQuantity || 0,
          totalCount: 1,
        });
      }
    }

    // ── Pre-calculate KPI stats ──
    let totalIncoming = 0;
    let totalOutgoing = 0;
    let incomingCount = 0;
    let outgoingCount = 0;
    for (const m of movements) {
      if (m.group === 'Masuk') {
        totalIncoming += m.quantity;
        incomingCount++;
      } else if (m.group === 'Keluar') {
        totalOutgoing += Math.abs(m.quantity);
        outgoingCount++;
      }
    }
    const stats = {
      totalIncoming,
      totalOutgoing,
      netMovement: totalIncoming - totalOutgoing,
      incomingCount,
      outgoingCount,
      totalCount: movements.length,
    };

    // ── Store raw movements as JSON for detail table & gudang filtering ──
    const rawForStorage = movements.map((m: any) => ({
      dateStr: m.dateStr,
      moveType: m.moveType,
      description: m.description,
      workCenter: m.workCenter ?? null,
      batch: m.batch ?? null,
      storageLocation: m.storageLocation ?? null,
      quantity: m.quantity,
      unitQuantity: m.unitQuantity ?? 0,
      group: m.group,
      color: m.color,
      userName: m.userName ?? null,
    }));

    const stockCardsJson = stockCards && stockCards.length > 0 ? JSON.stringify(stockCards) : null;

    const reportSession = await prisma.reportSession.create({
      data: {
        label,
        dateStr,
        fileName: fileName ?? null,
        stockCards: stockCardsJson,
        stats: JSON.stringify(stats),
        rawMovements: JSON.stringify(rawForStorage),
        rawStocks: JSON.stringify(stocks),
        movementSummaries: {
          create: Array.from(summaryMap.values()),
        },
      },
    });

    return NextResponse.json({ id: reportSession.id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
