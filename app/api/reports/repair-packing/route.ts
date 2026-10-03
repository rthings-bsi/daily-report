import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUserContext, requirePermission, respondError } from '@/lib/api-helpers';
import {
  RepairPackingItem,
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

    const hasDateRange = !!(start || end);
    if (hasDateRange) {
      const dateFilter: Record<string, string> = {};
      if (start) {
        const d = new Date(start);
        d.setDate(d.getDate() - 1);
        dateFilter.gte = d.toISOString().split('T')[0];
      }
      if (end) {
        const d = new Date(end);
        d.setDate(d.getDate() + 1);
        dateFilter.lte = d.toISOString().split('T')[0];
      }
      andConditions.push({ dateStr: dateFilter });
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

    // Granular filters
    const filteredItems = allItems.filter(item => {
      if (start && item.operationalDate < start) return false;
      if (end && item.operationalDate > end) return false;
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

    const { metrics, byWorkCenter, byMoveType, dailyTrend } = calculateRepairPackingMetrics(filteredItems);

    const payload = {
      items: includeItems ? filteredItems : [],
      metrics,
      byWorkCenter,
      byMoveType,
      dailyTrend,
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
