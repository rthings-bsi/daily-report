import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getGudangPrefix } from "@/lib/gudang";
import { requireUserContext, respondError } from "@/lib/api-helpers";

// GET /api/reports/trend?gudang=13 — return the last 7 days of Masuk/Keluar.
// Since sessions are now strictly deduplicated at upload time and backfilled,
// their movementSummaries accurately reflect deduplicated data.
// We pull the newest session for each unique (dateStr, gudangId).
export async function GET(request: NextRequest) {
  const ctx = await requireUserContext();
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { searchParams } = new URL(request.url);

    const requestedGudang = searchParams.get('gudang');
    const effectiveGudang = ctx.isAdmin
      ? (requestedGudang ? Number(requestedGudang) : null)
      : ctx.gudangId;

    const where = ctx.isAdmin
      ? (effectiveGudang ? { OR: [{ gudangId: effectiveGudang }, { gudangId: null }] } : {})
      : ctx.gudangId === null
        ? { gudangId: null }
        : { OR: [{ gudangId: ctx.gudangId }, { gudangId: null }] };

    const sessions = await prisma.reportSession.findMany({
      where: { ...where, rawMovements: { not: null } },
      select: {
        dateStr: true,
        gudangId: true,
        createdAt: true,
        movementSummaries: { select: { dateStr: true, group: true, totalQuantity: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const map = new Map<string, { date: string; masuk: number; keluar: number }>();
    const seen = new Set<string>();

    for (const s of sessions) {
      const key = `${s.dateStr}|${s.gudangId ?? 'null'}`;
      if (seen.has(key)) continue;
      seen.add(key);
      for (const sum of s.movementSummaries) {
        const e = map.get(sum.dateStr) || { date: sum.dateStr, masuk: 0, keluar: 0 };
        if (sum.group === 'Masuk') e.masuk += sum.totalQuantity;
        else if (sum.group === 'Keluar') e.keluar += Math.abs(sum.totalQuantity);
        map.set(sum.dateStr, e);
      }
    }

    const result = Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-5);

    return NextResponse.json(result);
  } catch (error) {
    return respondError(error);
  }
}
