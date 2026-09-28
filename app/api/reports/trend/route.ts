import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getGudangPrefix, filterByGudang, removeInternalTfSloc, reclassify311 } from "@/lib/gudang";
import { requireUserContext, respondError } from "@/lib/api-helpers";
import { deduplicateMovements, RawMovementRow } from "@/lib/aggregation";

// GET /api/reports/trend?gudang=13&start=2026-08-01&end=2026-08-14 — return the trend of Masuk/Keluar.

// Cache hasil trend per (gudang, start, end). Data laporan hanya berubah saat
// upload baru, jadi TTL 60 detik aman dan membuat filter tanggal terasa instan
// (request pertama tetap lambat karena transfer rawMovements, tapi yang berikutnya
// langsung dari memory).
const trendCache = new Map<string, { data: unknown; expiresAt: number }>();
const TREND_CACHE_TTL_MS = 60_000;

// Dipanggil dari route upload supaya data trend yang baru di-upload langsung terlihat
// (cache lama dibuang, request berikutnya dihitung ulang).
export function invalidateTrendCache() {
  trendCache.clear();
}

export async function GET(request: NextRequest) {
  const ctx = await requireUserContext();
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { searchParams } = new URL(request.url);

    const requestedGudang = searchParams.get('gudang');
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const effectiveGudang = ctx.isAdmin
      ? (requestedGudang ? Number(requestedGudang) : null)
      : ctx.gudangId;

    // ── Cache check (hanya setelah auth, supaya tidak ada cache lintas user) ──
    const cacheKey = `${ctx.userId ?? 'anon'}|${effectiveGudang ?? 'all'}|${start ?? ''}|${end ?? ''}`;
    const cached = trendCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.data);
    }

    const gudangWhere: Record<string, unknown> = ctx.isAdmin
      ? (effectiveGudang ? { OR: [{ gudangId: effectiveGudang }, { gudangId: null }] } : {})
      : ctx.gudangId === null
        ? { gudangId: null }
        : { OR: [{ gudangId: ctx.gudangId }, { gudangId: null }] };

    let sessions: {
      dateStr: string;
      gudangId: number | null;
      createdAt: Date;
      rawMovements: string | null;
    }[];

    if (start || end) {
      // OPTIMIZATION: pilih session lewat movementSummaries (indexed by dateStr, query < 1s)
      // alih-alih menarik rawMovements SEMUA session dalam buffer +/- 7 hari (ratusan MB JSON).
      // movementSummaries.dateStr = tanggal transaksi asli (bukan tanggal representatif session),
      // jadi ini presisi — session yang tidak punya data di rentang tidak akan di-parse sama sekali.
      // Pipeline raw (dedup/removeInternalTfSloc/reclassify311) tetap dijalankan penuh di bawah
      // supaya angkanya identik dengan KPI cards.
      const t0 = Date.now();
      const inRange = await prisma.movementSummary.findMany({
        where: {
          dateStr: {
            ...(start ? { gte: start } : {}),
            ...(end ? { lte: end } : {}),
          },
        },
        distinct: ["reportSessionId"],
        select: { reportSessionId: true },
      });
      console.log(`[trend] summary preselect took ${((Date.now() - t0) / 1000).toFixed(1)}s, ${inRange.length} sessions in range`);

      const idSet = new Set(inRange.map((r) => r.reportSessionId));

      // Fallback: session legacy yang punya rawMovements tapi TIDAK punya
      // movementSummaries sama sekali (mis. upload lama / gagal summary).
      // Tanpa ini, datanya bakal hilang dari trend padahal masih ada di raw.
      const dateFilter: Record<string, string> = {};
      if (start) {
        const d = new Date(start);
        d.setDate(d.getDate() - 7);
        dateFilter.gte = d.toISOString().split("T")[0];
      }
      if (end) {
        const d = new Date(end);
        d.setDate(d.getDate() + 7);
        dateFilter.lte = d.toISOString().split("T")[0];
      }
      const noSummarySessions = await prisma.reportSession.findMany({
        where: {
          ...gudangWhere,
          rawMovements: { not: null },
          movementSummaries: { none: {} },
          dateStr: dateFilter,
        },
        select: { reportSessionId: true },
      });
      for (const s of noSummarySessions) idSet.add(s.reportSessionId);

      const ids = Array.from(idSet);

      if (ids.length === 0) {
        return NextResponse.json([]);
      }

      sessions = await prisma.reportSession.findMany({
        where: { ...gudangWhere, reportSessionId: { in: ids }, rawMovements: { not: null } },
        select: {
          dateStr: true,
          gudangId: true,
          createdAt: true,
          rawMovements: true,
        },
      });
    } else {
      sessions = await prisma.reportSession.findMany({
        where: { ...gudangWhere, rawMovements: { not: null } },
        select: {
          dateStr: true,
          gudangId: true,
          createdAt: true,
          rawMovements: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 200, // Process recent sessions just like aggregate API
      });
    }

    let allRawMovements: any[] = [];

    // Gabungkan semua movements dari semua session yang valid.
    // Movements di luar rentang tanggal langsung dibuang SAAT parsing (sebelum
    // dedup / removeInternalTfSloc / reclassify) supaya array yang diproses
    // jauh lebih kecil → query tidak menahan koneksi DB berlama-lama.
    // Aman: semua pass berikutnya (dedup, removeInternalTfSloc, reclassify311)
    // bekerja per-row, dan pasangan internal TF selalu berada di tanggal yang sama.
    for (const s of sessions) {
      if (!s.rawMovements) continue;
      const raw = JSON.parse(s.rawMovements) as RawMovementRow[];
      for (const m of raw) {
        const d = m.dateStr || "";
        if (start && d && d < start) continue;
        if (end && d && d > end) continue;
        allRawMovements.push(m);
      }
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

    // Simpan hasil untuk 60 detik ke depan (cache per user+gudang+rentang).
    trendCache.set(cacheKey, { data: result, expiresAt: Date.now() + TREND_CACHE_TTL_MS });

    return NextResponse.json(result);
  } catch (error) {
    return respondError(error);
  }
}
