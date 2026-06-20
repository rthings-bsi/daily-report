import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserContext, respondError } from "@/lib/api-helpers";
import { aggregateSessionData, RawMovementRow, deduplicateMovements, deduplicateStocks } from "@/lib/aggregation";
import { classifyBatch } from "@/lib/gudang";

// GET /api/reports/aggregate?gudangId=5&start=2026-01-01&end=2026-06-30
// Aggregates ALL matching sessions into one combined dataset.
// Admin: can filter by gudangId (optional) + date range (optional)
// Non-admin: always scoped to their own gudangId
export async function GET(req: NextRequest) {
  const ctx = await requireUserContext();
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const gudangIdParam = searchParams.get("gudangId");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  // ── Build Prisma where clause ──
  const where: Record<string, unknown> = {};

  if (ctx.isAdmin) {
    if (gudangIdParam) {
      // Saat admin memfilter Gudang 1, ambil session Gudang 1 ATAU session global (null)
      // Karena session global berisi data gabungan semua gudang
      where.OR = [
        { gudangId: parseInt(gudangIdParam, 10) },
        { gudangId: null }
      ];
    }
    // Jika admin tanpa filter, tidak ada filter di mana-mana -> ambil SEMUA
  } else {
    // non-admin: strictly gudang mereka sendiri
    where.gudangId = ctx.gudangId;
  }

  if (start || end) {
    const dateFilter: Record<string, string> = {};
    if (start) dateFilter.gte = start;
    if (end) dateFilter.lte = end;
    where.dateStr = dateFilter;
  }

  try {
    const sessions = await prisma.reportSession.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        reportSessionId: true,
        gudangId: true,
        dateStr: true,
        label: true,
        createdAt: true,
        rawMovements: true,
        rawStocks: true,
        stats: true,
        stockCards: true,
      },
    });

    if (sessions.length === 0) {
      return NextResponse.json({
        movements: [],
        stocks: [],
        stockCards: [],
        stats: null,
        movementSummaries: [],
        stockSummaries: [],
        sessionCount: 0,
        sessions: [],
      });
    }

    // ── Aggregate raw data across ALL matched sessions ──
    let allRawMovements: RawMovementRow[] = [];
    let allStocks: any[] = [];
    let allStockCards: any[] = [];

    for (const s of sessions) {
      if (s.rawMovements) {
        allRawMovements.push(...JSON.parse(s.rawMovements));
      }
      if (s.rawStocks) {
        allStocks.push(...JSON.parse(s.rawStocks));
      }
      if (s.stockCards) {
        allStockCards.push(...JSON.parse(s.stockCards));
      }
    }

    // ── Deduplicate across sessions ──
    // Shift 1 & Shift 2 upload same-day data, causing duplicates.
    // Using composite key: dateStr|moveType|material|batch|quantity|userName|workCenter|storageLocation
    allRawMovements = deduplicateMovements(allRawMovements);
    allStocks = deduplicateStocks(allStocks);

    // ── Build hydrated movements (matching loadSession format) ──
    const movements = allRawMovements.map((m: RawMovementRow, idx: number) => ({
      movementId: `agg-${idx}`,
      postingDate: new Date(m.dateStr).toISOString(),
      dateStr: m.dateStr,
      moveType: m.moveType,
      description: m.description,
      workCenter: m.workCenter || "",
      batch: m.batch || "",
      quantity: m.quantity,
      unitQuantity: m.unitQuantity || 0,
      userName: m.userName || "",
      storageLocation: m.storageLocation || "",
      group: m.group,
      color: m.color,
      movementStatus: classifyBatch(m.batch || ""),
    }));

    // ── Re-aggregate summaries from combined data ──
    const aggregated = aggregateSessionData({
      movements: allRawMovements.map((m: RawMovementRow, idx: number) => ({
        movementId: `agg-${idx}`,
        postingDate: new Date(m.dateStr),
        dateStr: m.dateStr,
        moveType: m.moveType,
        description: m.description,
        group: m.group as any,
        workCenter: m.workCenter || "",
        batch: m.batch || "",
        quantity: m.quantity,
        unitQuantity: m.unitQuantity || 0,
        userName: m.userName || "",
        storageLocation: m.storageLocation || "",
        color: m.color,
        movementStatus: classifyBatch(m.batch || ""),
      })),
      stocks: allStocks,
      stockCards: allStockCards.length > 0 ? allStockCards : undefined,
    });

    // ── Calculate combined stats ──
    const totalIncoming = aggregated.stats.totalIncoming;
    const totalOutgoing = aggregated.stats.totalOutgoing;
    const stats = {
      totalIncoming,
      totalOutgoing,
      netMovement: totalIncoming - totalOutgoing,
      incomingCount: aggregated.stats.incomingCount,
      outgoingCount: aggregated.stats.outgoingCount,
      totalCount: aggregated.stats.totalCount,
    };

    return NextResponse.json({
      movements,
      movementSummaries: aggregated.movementSummaries,
      stockSummaries: aggregated.stockSummaries,
      stocks: allStocks,
      stockCards: allStockCards,
      stats,
      sessionCount: sessions.length,
      sessions: sessions.map((s) => ({
        reportSessionId: s.reportSessionId,
        gudangId: s.gudangId,
        dateStr: s.dateStr,
        label: s.label,
        createdAt: s.createdAt,
      })),
    });
  } catch (err) {
    return respondError(err);
  }
}
