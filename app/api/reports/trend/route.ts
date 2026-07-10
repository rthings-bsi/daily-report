import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getGudangPrefix } from "@/lib/gudang";
import { requireUserContext, respondError } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const ctx = await requireUserContext();
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { searchParams } = new URL(request.url);

    // For non-admin: ignore the `?gudang=` query — always scope to own gudang.
    // Admin: honor the param (or fall back to no filter for the global view).
    const requestedGudang = searchParams.get('gudang');
    const effectiveGudang = ctx.isAdmin
      ? (requestedGudang ? Number(requestedGudang) : null)
      : ctx.gudangId;

    const prefix = effectiveGudang ? getGudangPrefix(effectiveGudang) : null;

    const map = new Map<string, { date: string, masuk: number, keluar: number }>();

    const merge = (dateStr: string, group: string, quantity: number) => {
      if (!map.has(dateStr)) map.set(dateStr, { date: dateStr, masuk: 0, keluar: 0 });
      const entry = map.get(dateStr)!;
      if (group === 'Masuk') entry.masuk += quantity;
      if (group === 'Keluar') entry.keluar += Math.abs(quantity);
    };

    // Build session-scope filter for the JSON path so we never pull data
    // outside the caller's tenant.
    const sessionWhere = ctx.isAdmin
      ? {}
      : ctx.gudangId === null
        ? { gudangId: null }
        : { OR: [{ gudangId: ctx.gudangId }, { gudangId: null }] };

    if (prefix) {
      // ── Filter by gudang: parse rawMovements (new sessions) + Movement rows (legacy) ──
      const newSessions = await prisma.reportSession.findMany({
        where: { ...sessionWhere, rawMovements: { not: null } },
        select: { rawMovements: true },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });

      for (const s of newSessions) {
        if (!s.rawMovements) continue;
        const raw: { dateStr: string; group: string; quantity: number; storageLocation?: string | null }[] = JSON.parse(s.rawMovements);
        for (const m of raw) {
          if (m.storageLocation && !m.storageLocation.startsWith(prefix)) continue;
          merge(m.dateStr, m.group, m.quantity);
        }
      }

      const legacyRows = await prisma.movement.findMany({
        where: { storageLocation: { startsWith: prefix } },
        select: { dateStr: true, group: true, quantity: true },
        orderBy: { dateStr: 'desc' },
        take: 500,
      });

      for (const m of legacyRows) {
        merge(m.dateStr, m.group, m.quantity);
      }
    } else {
      // ── No gudang filter (admin global view): use aggregated MovementSummary ──
        // KOREKSI: Hindari ambil data double dari legacy (Movement) dan summary (MovementSummary) secara bersamaan
        // kalo raw data (ReportSession) atau Summary udah nangkep semuanya. Kita cuma query ReportSession & Movement legacy.
      
        const newSessions = await prisma.reportSession.findMany({
          where: { ...sessionWhere, rawMovements: { not: null } },
          select: { rawMovements: true, id: true }, // tambah id buat safety log
          orderBy: { createdAt: 'desc' },
          take: 30,
        });

        // Bikin Set buat nge-track ID/Date biar ngga muter double
        for (const s of newSessions) {
          if (!s.rawMovements) continue;
          const raw: { dateStr: string; group: string; quantity: number; storageLocation?: string | null }[] = JSON.parse(s.rawMovements);
          for (const m of raw) {
            merge(m.dateStr, m.group, m.quantity);
          }
        }

        // Kalo data session rawMovements kosong (belum ada import sama sekali), 
        // baru deh fallback ambil dari database Movement Legacy.
        if (newSessions.length === 0) {
          const legacyData = await prisma.movement.groupBy({
            by: ['dateStr', 'group'],
            _sum: { quantity: true },
            orderBy: { dateStr: 'desc' },
            take: 50,
          });

          for (const d of legacyData) {
            merge(d.dateStr, d.group, d._sum.quantity || 0);
          }
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
