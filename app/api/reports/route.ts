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
      _count: { select: { movements: true } },
    },
  });

  return NextResponse.json(sessions);
}

// POST /api/reports — create new session with movement + stock data
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { label, dateStr, fileName, movements, stocks } = body;

  try {
    const reportSession = await prisma.reportSession.create({
      data: {
        label,
        dateStr,
        fileName: fileName ?? null,
        movements: {
          create: movements.map((m: any) => ({
            postingDate: new Date(m.postingDate),
            dateStr: m.dateStr,
            moveType: m.moveType,
            description: m.description,
            workCenter: m.workCenter ?? null,
            batch: m.batch ?? null,
            quantity: m.quantity,
            unitQuantity: m.unitQuantity,
            group: m.group,
            color: m.color,
          })),
        },
        stocks: {
          create: stocks.map((s: any) => ({
            material: s.status || "Unknown",
            description: s.status || "Unknown",
            batch: null,
            sloc: s.sloc ?? null,
            category: null,
            unitQty: s.quantity ?? 0,
            weight: s.tonnage ?? 0,
          })),
        },
      },
    });

    return NextResponse.json({ id: reportSession.id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
