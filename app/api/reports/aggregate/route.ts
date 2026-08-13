import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserContext, respondError } from "@/lib/api-helpers";
import { RawMovementRow, aggregateSessionData, deduplicateMovements } from "@/lib/aggregation";
import { MovementGroup } from "@/lib/sap-mapping";
import { classifyBatch, filterByGudang, getGudangPrefix, gudangFromSloc } from "@/lib/gudang";

export const dynamic = "force-dynamic";

// GET /api/reports/aggregate?gudangId=5&start=2026-01-01&end=2026-06-30&detail=true
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
  const detail = searchParams.get("detail") === "true";

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

  // ⚠ BUG FIX: Buffer dateStr filter.
  // Session.dateStr hanya satu tanggal representatif. Jika user memfilter 07-10 s/d 07-15,
  // bisa jadi data tsb ada di dalam session yang di-upload dengan dateStr 07-08 atau 07-17.
  // Oleh karena itu, kita filter session di DB dengan buffer +/- 7 hari agar session tsb
  // tetap terbawa. Nanti data aslinya (rawMovements) akan di-filter secara presisi di client-side.
  if (start || end) {
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
    where.dateStr = dateFilter;
  }

  const hasDateFilter = !!(start || end);

  try {
    // OPTIMIZATION: Pull the full payload ONLY for the latest session.
    // Stock and stock cards are point-in-time snapshots — aggregating them
    // across multiple days wastes DB bandwidth and causes pool exhaustion.
    const latestSession = await prisma.reportSession.findFirst({
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
        movementSummaries: true,
        stockSummaries: true
      },
    });

    if (!latestSession) {
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

    let otherSessions: any[] = [];
    if (hasDateFilter) {
      // Pull only movements and summaries for historical sessions
      otherSessions = await prisma.reportSession.findMany({
        where: {
          ...where,
          reportSessionId: { not: latestSession.reportSessionId }
        },
        orderBy: { createdAt: "desc" },
        select: {
          reportSessionId: true,
          gudangId: true,
          dateStr: true,
          label: true,
          createdAt: true,
          rawMovements: true,
          stats: true,
          movementSummaries: true,
          stockSummaries: true
        },
      });
    } else {
      // FIX: Default dashboard (no date filter).
      // If we only take 'latestSession', admin only sees ONE gudang's Excel file,
      // and all other uploaded gudangs on the same day disappear.
      // We must fetch ALL sessions sharing the same date as the latest one.
      otherSessions = await prisma.reportSession.findMany({
        where: {
          ...where,
          dateStr: latestSession.dateStr,
          reportSessionId: { not: latestSession.reportSessionId }
        },
        orderBy: { createdAt: "desc" },
        select: {
          reportSessionId: true,
          gudangId: true,
          dateStr: true,
          label: true,
          createdAt: true,
          rawMovements: true,
          stats: true,
          movementSummaries: true,
          stockSummaries: true
        },
      });
    }

    const sessions = [latestSession, ...otherSessions];

    // ── Buat peta tanggal -> gudang mana saja yang mengunggah sesi lokal ──
    const localUploadsByDate = new Map<string, Set<number>>();
    for (const s of sessions) {
      if (s.gudangId !== null && s.gudangId !== undefined) {
        const d = s.dateStr;
        if (!localUploadsByDate.has(d)) {
          localUploadsByDate.set(d, new Set<number>());
        }
        localUploadsByDate.get(d)!.add(s.gudangId);
      }
    }

    // ── Aggregate raw data across ALL matched sessions ──
    let allRawMovements: RawMovementRow[] = [];
    let allStocks: any[] = [];
    const allStockCards: any[] = [];

    for (const s of sessions) {
      const isGlobal = s.gudangId === null || s.gudangId === undefined;

      if (s.rawMovements) {
        const raw: RawMovementRow[] = JSON.parse(s.rawMovements);

        if (isGlobal) {
          // Dari sesi global, buang pergerakan milik gudang yang sudah upload sesi lokal sendiri
          // pada tanggal transaksi tersebut.
          const filteredRaw = raw.filter((m) => {
            const uploadSet = localUploadsByDate.get(m.dateStr);
            if (uploadSet) {
              const slocGudang = gudangFromSloc(m.storageLocation);
              if (slocGudang !== null && uploadSet.has(slocGudang)) {
                return false; // Skip, karena gudang ini sudah upload data lokal sendiri pada tanggal tersebut
              }
            }
            return true;
          });
          allRawMovements.push(...filteredRaw);
        } else {
          allRawMovements.push(...raw);
        }
      }

      if (s.rawStocks) {
        const rawStocks: any[] = JSON.parse(s.rawStocks);
        if (isGlobal) {
          const filteredStocks = rawStocks.filter((st) => {
            const uploadSet = localUploadsByDate.get(s.dateStr); // Cek tanggal sesi
            if (uploadSet) {
              const slocGudang = gudangFromSloc(st.sloc);
              if (slocGudang !== null && uploadSet.has(slocGudang)) {
                return false;
              }
            }
            return true;
          });
          allStocks.push(...filteredStocks);
        } else {
          allStocks.push(...rawStocks);
        }
      }

      if (s.stockCards) {
        const rawCards: any[] = JSON.parse(s.stockCards);
        if (isGlobal) {
          const filteredCards = rawCards.filter((sc) => {
            const uploadSet = localUploadsByDate.get(s.dateStr);
            if (uploadSet) {
              const slocGudang = gudangFromSloc(sc.sloc);
              if (slocGudang !== null && uploadSet.has(slocGudang)) {
                return false;
              }
            }
            return true;
          });
          allStockCards.push(...filteredCards);
        } else {
          allStockCards.push(...rawCards);
        }
      }
    }

    // ── Filter by Gudang if requested ──
    const effectiveGudangId = ctx.isAdmin ? (gudangIdParam ? parseInt(gudangIdParam, 10) : null) : ctx.gudangId;

    // ── Deduplicate stock cards by batch|materialNumber|sloc ──
    const seenStockCards = new Set<string>();
    let uniqueStockCards = allStockCards.filter(sc => {
      const key = `${sc.batch}|${sc.materialNumber}|${sc.sloc}`;
      if (seenStockCards.has(key)) return false;
      seenStockCards.add(key);
      return true;
    });

    if (effectiveGudangId !== null) {
      const prefix = getGudangPrefix(effectiveGudangId);
      if (prefix) {
        allRawMovements = filterByGudang(allRawMovements, effectiveGudangId);
        allStocks = allStocks.filter(s => {
          const sloc = (s.sloc || '').toUpperCase();
          return sloc.startsWith(prefix) || s.status === 'Sloc Penampungan';
        });
        uniqueStockCards = uniqueStockCards.filter(sc => {
          const sloc = (sc.sloc || '').toUpperCase();
          return sloc.startsWith(prefix) || sc.status === 'Sloc Penampungan';
        });
      }
    }

    // ── Presisi filter tanggal DI SERVER ──
    // Session di-pilih dengan buffer +/- 7 hari (lihat where di atas) karena
    // dateStr session cuma satu tanggal representatif. Tapi raw movement di
    // dalamnya bisa mencakup banyak tanggal. Tanpa filter presisi di sini,
    // stats/movementSummaries/movements akan menyertakan data di luar rentang
    // yang diminta → angka card Inbound/Outbound tidak sesuai data yang di-upload.
    if (start || end) {
      allRawMovements = allRawMovements.filter((m) => {
        const d = m.dateStr || "";
        if (!d) return true;
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });
    }

    // ── Deduplicate raw movements across overlapping sessions ──
    allRawMovements = deduplicateMovements(allRawMovements);

    // ── Build hydrated movements (matching loadSession format) ──
    const movements = allRawMovements.map((m: RawMovementRow, idx: number) => ({
      movementId: `agg-${idx}`,
      postingDate: new Date(m.dateStr + 'T12:00:00Z'),
      dateStr: m.dateStr,
      moveType: m.moveType,
      description: m.description,
      material: m.material || undefined,
      workCenter: m.workCenter || "",
      batch: m.batch || "",
      quantity: m.quantity,
      unitQuantity: m.unitQuantity || 0,
      userName: m.userName || "",
      storageLocation: m.storageLocation || "",
      group: m.group as MovementGroup,
      color: m.color,
      movementStatus: classifyBatch(m.batch || ""),
    }));

    // Server-side (where localStorage is unavailable) fallback: we do not reclassify 311 
    // inside the aggregate API here. The client side \`filterAndReclassify()\` logic
    // in \`app/page.tsx\` uses \`localStorage\` to pull the sloc_exit map and correctly
    // reclassifies \`TF Sloc In\` & \`TF Sloc Out\` before charting. 
    // So \`movements\` sent to the client is pure raw combined.

    // ── Re-aggregate summaries and stats from deduplicated, filtered data ──
    // Do not use the pre-calculated ones because they might overlap or include other gudangs
    const aggregated = aggregateSessionData({
      movements,
      stocks: allStocks,
      stockCards: uniqueStockCards,
    });

    return NextResponse.json({
      movements,
      movementSummaries: aggregated.movementSummaries,
      stockSummaries: aggregated.stockSummaries,
      stocks: allStocks,
      stockCards: uniqueStockCards,
      stats: aggregated.stats,
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
