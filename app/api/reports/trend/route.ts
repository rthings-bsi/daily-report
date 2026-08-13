import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getGudangPrefix, filterByGudang, removeInternalTfSloc, reclassify311 } from "@/lib/gudang";
import { requireUserContext, respondError } from "@/lib/api-helpers";
import { deduplicateMovements, RawMovementRow } from "@/lib/aggregation";

// GET /api/reports/trend?gudang=13 — return the trend of Masuk/Keluar.
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
        rawMovements: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200, // Process recent sessions just like aggregate API
    });

    let allRawMovements: any[] = [];

    // Gabungkan semua movements dari semua session yang valid
    for (const s of sessions) {
      if (!s.rawMovements) continue;
      const raw = JSON.parse(s.rawMovements);
      allRawMovements.push(...raw);
    }

    // Identik dengan langkah di aggregate/route.ts
    if (effectiveGudang !== null) {
      allRawMovements = filterByGudang(allRawMovements, effectiveGudang);
    }

    allRawMovements = deduplicateMovements(allRawMovements as any);
    allRawMovements = removeInternalTfSloc(allRawMovements);

    // Lakukan klasifikasi MVT 311 karena raw belum mengkategorikan group "Masuk/Keluar" untuk 311 sesuai tujuan
    if (effectiveGudang !== null) {
      allRawMovements = reclassify311(allRawMovements, effectiveGudang);
    }

    // Kelompokkan hasil akhir ke per tanggal untuk grafik Trend
    const map = new Map<string, { date: string; masuk: number; keluar: number }>();

    for (const m of allRawMovements) {
      const date = m.dateStr;
      if (!date) continue;
      const e = map.get(date) || { date, masuk: 0, keluar: 0 };

      if (m.group === 'Masuk') {
        e.masuk += m.quantity;
      } else if (m.group === 'Keluar') {
        e.keluar += Math.abs(m.quantity);
      }
      map.set(date, e);
    }

    const result = Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json(result);
  } catch (error) {
    return respondError(error);
  }
}
