import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { aggregateSessionData, deduplicateMovements } from "@/lib/aggregation";
import { filterByGudang, filterByGudangList, getGudangPrefix } from "@/lib/gudang";
import { buildGudangWhere, requireUserContext, requirePermission, respondError } from "@/lib/api-helpers";
import { invalidateTrendCache } from "./trend/route";
import { invalidateAggregateCache } from "./aggregate/route";
import { invalidateRepairPackingCache } from "./repair-packing/route";

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

  const permCheck = requirePermission(ctx, 'upload');
  if (permCheck) return permCheck;

  // Data baru = hasil lama basi. Buang cache aggregate & trend supaya tidak menampilkan angka lama.
  invalidateTrendCache();
  invalidateAggregateCache();
  invalidateRepairPackingCache();

  const body = await req.json();
  const { label, dateStr, fileName, movements, stocks, stockCards } = body;

  
  try {
    let filteredMovements = movements;
    let filteredStocks = stocks;
    let filteredStockCards = stockCards;

    const isMerger = ctx.roleScope === 'merger' && !!ctx.mergerGudangIds && ctx.mergerGudangIds.length > 0;

    // Securely filter incoming data so users only save their authorized gudangs
    if (!ctx.isAdmin && ctx.roleScope !== 'global') {
      if (isMerger) {
        const assignedIds = ctx.mergerGudangIds!;
        filteredMovements = filterByGudangList(movements, assignedIds);
        const prefixes = assignedIds.map(getGudangPrefix).filter(Boolean);
        filteredStocks = stocks.filter((s: any) => {
          const sloc = (s.sloc || '').toUpperCase();
          return prefixes.some((p) => sloc.startsWith(p)) || s.status === 'Sloc Penampungan';
        });
        if (filteredStockCards) {
          filteredStockCards = filteredStockCards.filter((sc: any) => {
            const sloc = (sc.sloc || '').toUpperCase();
            return prefixes.some((p) => sloc.startsWith(p)) || sc.status === 'Sloc Penampungan';
          });
        }
      } else if (ctx.gudangId) {
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

    const gudangId = isMerger
      ? (ctx.gudangId ?? ctx.mergerGudangIds![0] ?? null)
      : ctx.gudangId;
    const gudangIds = isMerger
      ? JSON.stringify(ctx.mergerGudangIds)
      : (ctx.gudangId ? JSON.stringify([ctx.gudangId]) : "[]");

    const reportSession = await prisma.reportSession.create({
      data: {
        label,
        dateStr,
        fileName: fileName ?? null,
        gudangId,
        gudangIds,
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

    if (!ctx.isAdmin && ctx.roleScope !== 'global') {
      if (ctx.roleScope === 'merger' && ctx.mergerGudangIds && ctx.mergerGudangIds.length > 0) {
        whereClause.OR = [
          { gudangId: { in: ctx.mergerGudangIds } },
          ...ctx.mergerGudangIds.map((id) => ({ gudangIds: { contains: String(id) } })),
        ];
      } else {
        whereClause.gudangId = ctx.gudangId;
      }
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
