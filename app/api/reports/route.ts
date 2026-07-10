import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { aggregateSessionData } from "@/lib/aggregation";
import { filterByGudang, getGudangPrefix } from "@/lib/gudang";
import { buildGudangWhere, requireUserContext, respondError } from "@/lib/api-helpers";

// GET /api/reports — list sessions visible to the caller
// Admin sees all; non-admin sees own gudang strictly.
export async function GET() {
  const ctx = await requireUserContext();
  if (ctx instanceof NextResponse) return ctx;

  const where = buildGudangWhere(ctx);

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

  const result = sessions.map(({ stats, _count, gudangId, ...s }) => {
    let totalCount = _count.movements;
    if (stats) {
      try {
        const st = typeof stats === 'string' ? JSON.parse(stats) : stats;
        if (st && st.totalCount !== undefined) totalCount = st.totalCount;
      } catch {
        // Ignore parse error
      }
    }
    return {
      ...s,
      gudangId,
      totalCount,
    };
  });

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
      filteredStocks = stocks.filter((s: any) => {
        const sloc = (s.sloc || '').toUpperCase();
        return sloc.startsWith(prefix) || s.status === 'Sloc Penampungan';
      });
      if (filteredStockCards) {
        filteredStockCards = filteredStockCards.filter((sc: any) => {
          const sloc = (sc.sloc || '').toUpperCase();
          return sloc.startsWith(prefix) || sc.status === 'Sloc Penampungan';
        });
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

// DELETE /api/reports — bulk delete sessions (Both Admin and User)
// User can only delete their own gudang's sessions.
export async function DELETE(req: NextRequest) {
  const ctx = await requireUserContext();
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const { ids } = body as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Invalid IDs array" }, { status: 400 });
    }

    // Build safety constraints: non-admins can only delete sessions tied to their gudang
    const whereClause: any = {
      reportSessionId: { in: ids },
    };
    
    if (!ctx.isAdmin) {
      whereClause.gudangId = ctx.gudangId;
    }

    // Execute bulk deletion directly in database
    const result = await prisma.reportSession.deleteMany({
      where: whereClause,
    });

    return NextResponse.json({ ok: true, deletedCount: result.count });
  } catch (err) {
    return respondError(err);
  }
}
