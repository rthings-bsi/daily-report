import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUserContext, requirePermission, respondError } from '@/lib/api-helpers';
import {
  RepairPackingItem,
  DailyTrendItem,
  parseRawMovementToRepairPackingItem,
  calculateRepairPackingMetrics,
} from '@/lib/repair-packing';
import { gudangFromSloc } from '@/lib/gudang';

export const dynamic = 'force-dynamic';

// ── Two-tier In-Memory Cache ──
const repairPackingResponseCache = new Map<string, { data: unknown; expiresAt: number }>();
const sessionParsedCache = new Map<string, RepairPackingItem[]>();
const CACHE_TTL_MS = 60_000;

export function invalidateRepairPackingCache() {
  repairPackingResponseCache.clear();
  sessionParsedCache.clear();
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
}

export async function GET(req: NextRequest) {
  const ctx = await requireUserContext();
  if (ctx instanceof NextResponse) return ctx;

  const permCheck = requirePermission(ctx, 'repair-packing');
  if (permCheck) return permCheck;

  try {
    const { searchParams } = new URL(req.url);
    const gudangParam = searchParams.get('gudangId');
    const start = searchParams.get('start')?.trim() || '';
    const end = searchParams.get('end')?.trim() || '';
    const shift = searchParams.get('shift')?.trim() || '';
    const shiftNum = shift ? parseInt(shift, 10) : null;
    const categoryParam = searchParams.get('category')?.trim().toUpperCase() || 'ALL';
    const workCenterParam = searchParams.get('workCenter')?.trim() || '';
    const moveTypeParam = searchParams.get('moveType')?.trim() || '';
    const includeItems = searchParams.get('includeItems') === 'true' || searchParams.get('exportAll') === 'true';

    const effectiveGudang = ctx.isAdmin
      ? (gudangParam ? parseInt(gudangParam, 10) : null)
      : ctx.gudangId;

    // Cache hit check
    const cacheKey = `${ctx.userId}|${effectiveGudang ?? 'all'}|${start}|${end}|${shift}|${categoryParam}|${workCenterParam}|${moveTypeParam}|${includeItems}`;
    const cached = repairPackingResponseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.data);
    }

    const andConditions: Record<string, unknown>[] = [
      { rawMovements: { not: null } },
    ];

    if (effectiveGudang) {
      andConditions.push({
        OR: [
          { gudangId: effectiveGudang },
          { gudangId: null },
        ],
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const trendEnd = end || todayStr;
    const trendStart = addDays(trendEnd, -6);

    const hasDateRange = !!(start || end);
    if (hasDateRange) {
      const queryStart = start && start < trendStart ? start : trendStart;
      const queryEnd = end && end > trendEnd ? end : trendEnd;

      andConditions.push({
        dateStr: {
          gte: addDays(queryStart, -1),
          lte: addDays(queryEnd, 1),
        },
      });
    }

    const sessions = await prisma.reportSession.findMany({
      where: {
        AND: andConditions,
      },
      orderBy: { dateStr: 'desc' },
      take: hasDateRange ? undefined : 30,
      select: {
        reportSessionId: true,
        dateStr: true,
        gudangId: true,
        rawMovements: true,
      },
    });

    const effectiveTrendEnd = end || (
      sessions.length > 0
        ? (sessions[0].dateStr > todayStr || sessions[0].dateStr < addDays(todayStr, -7) ? sessions[0].dateStr : todayStr)
        : todayStr
    );
    const effectiveTrendStart = addDays(effectiveTrendEnd, -6);

    const allItems: RepairPackingItem[] = [];
    const availableWcSet = new Set<string>();

    for (const session of sessions) {
      let sessionItems = sessionParsedCache.get(session.reportSessionId);
      if (!sessionItems) {
        if (!session.rawMovements) continue;
        let rawList: Record<string, unknown>[] = [];
        try {
          rawList = JSON.parse(session.rawMovements);
        } catch {
          continue;
        }

        sessionItems = [];
        for (let i = 0; i < rawList.length; i++) {
          const parsed = parseRawMovementToRepairPackingItem(
            rawList[i],
            session.reportSessionId,
            session.gudangId,
            session.dateStr,
            i
          );
          if (parsed) {
            sessionItems.push(parsed);
          }
        }
        sessionParsedCache.set(session.reportSessionId, sessionItems);
      }

      for (const item of sessionItems) {
        if (effectiveGudang) {
          const itemGudang = gudangFromSloc(item.storageLocation) || session.gudangId;
          if (itemGudang && itemGudang !== effectiveGudang) {
            continue;
          }
        }

        availableWcSet.add(item.workCenter);
        allItems.push(item);
      }
    }

    // Granular filters for user's selected date range (metrics, breakdown, table)
    const filteredItems = allItems.filter(item => {
      if (start && item.operationalDate < start) return false;
      if (end && item.operationalDate > end) return false;
      if (shiftNum !== null && item.shift !== shiftNum) return false;
      if (categoryParam !== 'ALL' && item.category !== categoryParam) return false;
      if (workCenterParam && item.workCenter.toLowerCase() !== workCenterParam.toLowerCase()) return false;
      if (moveTypeParam && item.moveType !== moveTypeParam) return false;
      return true;
    });

    // 7-day rolling trend items ending at effectiveTrendEnd
    const trendItems = allItems.filter(item => {
      if (item.operationalDate < effectiveTrendStart || item.operationalDate > effectiveTrendEnd) return false;
      if (shiftNum !== null && item.shift !== shiftNum) return false;
      if (categoryParam !== 'ALL' && item.category !== categoryParam) return false;
      if (workCenterParam && item.workCenter.toLowerCase() !== workCenterParam.toLowerCase()) return false;
      if (moveTypeParam && item.moveType !== moveTypeParam) return false;
      return true;
    });

    // Sort descending by operational date, then entry time
    filteredItems.sort((a, b) => {
      const cmpDate = b.operationalDate.localeCompare(a.operationalDate);
      if (cmpDate !== 0) return cmpDate;
      const timeA = a.entryTime || '';
      const timeB = b.entryTime || '';
      return timeB.localeCompare(timeA);
    });

    const { metrics, byWorkCenter, byMoveType } = calculateRepairPackingMetrics(filteredItems);
    const { dailyTrend: rawTrend } = calculateRepairPackingMetrics(trendItems);

    const trendMap = new Map(rawTrend.map(d => [d.date, d]));
    const full7DayTrend: DailyTrendItem[] = [];
    for (let i = 0; i < 7; i++) {
      const dStr = addDays(effectiveTrendStart, i);
      full7DayTrend.push(trendMap.get(dStr) || { date: dStr, masuk: 0, keluar: 0, net: 0 });
    }

    const payload = {
      items: includeItems ? filteredItems : [],
      trendItems: includeItems ? trendItems : [],
      metrics,
      byWorkCenter,
      byMoveType,
      dailyTrend: full7DayTrend,
      availableWorkCenters: Array.from(availableWcSet).sort(),
    };

    repairPackingResponseCache.set(cacheKey, {
      data: payload,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return NextResponse.json(payload);
  } catch (error) {
    return respondError(error);
  }
}
