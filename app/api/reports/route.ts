import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { aggregateSessionData } from "@/lib/aggregation";
import { filterByGudang, getGudangPrefix } from "@/lib/gudang";
import { buildGudangWhere, requireUserContext, respondError } from "@/lib/api-helpers";

// GET /api/reports — list sessions visible to the caller
// Admin sees all; non-admin sees own gudang (and null = legacy/unscoped).
export async function GET() {
  const ctx = await requireUserContext();
  if (ctx instanceof NextResponse) return ctx;

  const where = buildGudangWhere(ctx, undefined, { includeNull: true });

  const sessions = await prisma.reportSession.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      reportSessionId: true,
      label: true,
      dateStr: true,
      fileName: true,
      createdAt: true,
      gudangId: true,
      stats: true,
      _count: { select: { movements: true } },
    },
  });

  const result = sessions.map(({ stats, _count, gudangId, ...s }) => ({
    ...s,
    gudangId,
    totalCount: stats ? JSON.parse(stats).totalCount : _count.movements,
  }));

  return NextResponse.json(result);
}

// POST /api/reports — create a new session, stamped with the caller's gudang
export async function POST(req: NextRequest) {
  const ctx = await requireUserContext();
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();
  const { label, dateStr, fileName, movements, stocks, stockCards } = body;

  
  try {
    let filteredMovements = movements;
    let filteredStocks = stocks;
    let filteredStockCards = stockCards;

    // Securely filter incoming data so users only save their own gudang's data
    if (!ctx.isAdmin && ctx.gudangId) {
      filteredMovements = filterByGudang(movements, ctx.gudangId);
      const prefix = getGudangPrefix(ctx.gudangId);
      filteredStocks = stocks.filter((s: any) => (s.sloc || '').toUpperCase().startsWith(prefix));
      if (filteredStockCards) {
        filteredStockCards = filteredStockCards.filter((sc: any) => (sc.sloc || '').toUpperCase().startsWith(prefix));
      }
    }

    const {
      movementSummaries,
      stockSummaries,
      rawMovements,
      rawStocks,
      stats,
      stockCardsJson,
    } = aggregateSessionData({ 
      movements: filteredMovements, 
      stocks: filteredStocks, 
      stockCards: filteredStockCards 
    });

    // Stamp gudang: non-admin must have a gudang; admin without one → null
    // (so the session becomes "unscoped" and only admin can see it).
    const gudangId = ctx.gudangId;

    const reportSession = await prisma.reportSession.create({
      data: {
        label,
        dateStr,
        fileName: fileName ?? null,
        gudangId,
        stockCards: stockCardsJson,
        stats: JSON.stringify(stats),
        rawMovements: JSON.stringify(rawMovements),
        rawStocks: JSON.stringify(rawStocks),
        movementSummaries: { create: movementSummaries },
        stockSummaries: { create: stockSummaries },
      },
    });

    return NextResponse.json({ reportSessionId: reportSession.reportSessionId });
  } catch (err) {
    return respondError(err);
  }
}
