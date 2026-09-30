import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUserContext, respondError, buildGudangWhere } from '@/lib/api-helpers';
import {
  parseAuditSlocExcel,
  parseAuditSlocText,
  AuditSlocParsedRow,
} from '@/lib/audit-sloc-parser';
import { getGudangPrefix } from '@/lib/gudang';

export async function GET(req: NextRequest) {
  const ctx = await requireUserContext();
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    const getLatest = searchParams.get('latest') === 'true';
    const gudangParam = searchParams.get('gudangId');
    const search = searchParams.get('search')?.trim().toLowerCase() || '';
    const slocFilter = searchParams.get('sloc')?.trim().toUpperCase() || '';
    const statusFilter = searchParams.get('status')?.trim().toUpperCase() || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(500, Math.max(10, parseInt(searchParams.get('limit') || '50', 10)));

    const effectiveGudang = ctx.isAdmin
      ? (gudangParam ? parseInt(gudangParam, 10) : null)
      : ctx.gudangId;

    const gudangWhere = ctx.isAdmin
      ? (effectiveGudang ? { OR: [{ gudangId: effectiveGudang }, { gudangId: null }] } : {})
      : ctx.gudangId === null
        ? { gudangId: null }
        : { OR: [{ gudangId: ctx.gudangId }, { gudangId: null }] };

    // Return list of available sessions if neither sessionId nor latest is requested
    if (!sessionId && !getLatest) {
      const sessions = await prisma.auditSlocSession.findMany({
        where: gudangWhere,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          dateStr: true,
          plant: true,
          gudangId: true,
          fileName: true,
          totalItems: true,
          totalQtySap: true,
          totalKgSap: true,
          totalQtyAudit: true,
          totalKgAudit: true,
          totalDiffQty: true,
          totalDiffKg: true,
          matchCount: true,
          diffCount: true,
          createdAt: true,
        },
      });
      return NextResponse.json({ sessions });
    }

    // Resolve target session
    let targetSessionId = sessionId;
    if (getLatest && !targetSessionId) {
      const latest = await prisma.auditSlocSession.findFirst({
        where: gudangWhere,
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (!latest) {
        return NextResponse.json({ session: null, items: [], total: 0 });
      }
      targetSessionId = latest.id;
    }

    const session = await prisma.auditSlocSession.findUnique({
      where: { id: targetSessionId! },
      include: {
        gudang: { select: { name: true, prefix: true } },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Sesi audit tidak ditemukan' }, { status: 404 });
    }

    // Filter items
    const itemWhere: Record<string, unknown> = { sessionId: session.id };

    if (slocFilter) {
      itemWhere.sloc = slocFilter;
    }

    if (statusFilter) {
      if (statusFilter === 'DIFF') {
        itemWhere.status = { not: 'MATCH' };
      } else if (['MATCH', 'DEFICIT', 'SURPLUS'].includes(statusFilter)) {
        itemWhere.status = statusFilter;
      }
    }

    if (search) {
      itemWhere.OR = [
        { material: { contains: search, mode: 'insensitive' } },
        { batch: { contains: search, mode: 'insensitive' } },
        { sloc: { contains: search, mode: 'insensitive' } },
        { plant: { contains: search, mode: 'insensitive' } },
      ];
    }

    const total = await prisma.auditSlocItem.count({ where: itemWhere });

    const items = await prisma.auditSlocItem.findMany({
      where: itemWhere,
      orderBy: [{ sloc: 'asc' }, { material: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    });

    // Get distinct SLoc list for filtering dropdown
    const distinctSlocs = await prisma.auditSlocItem.findMany({
      where: { sessionId: session.id },
      distinct: ['sloc'],
      select: { sloc: true },
      orderBy: { sloc: 'asc' },
    });

    // Aggregate by sloc and status for accuracy charts & statistics
    const slocGrouped = await prisma.auditSlocItem.groupBy({
      by: ['sloc', 'status'],
      where: { sessionId: session.id },
      _count: { _all: true },
      _sum: {
        sapQty: true,
        eomKg: true,
        qtyAudit: true,
        kgAudit: true,
        diffQty: true,
        diffKgAudit: true,
      },
    });

    const slocMap = new Map<string, {
      sloc: string;
      totalItems: number;
      matchCount: number;
      deficitCount: number;
      surplusCount: number;
      sapQty: number;
      qtyAudit: number;
      diffQty: number;
      sapKg: number;
      kgAudit: number;
      diffKg: number;
    }>();

    let totalMatch = 0;
    let totalDeficit = 0;
    let totalSurplus = 0;
    let totalItemsCount = 0;

    for (const row of slocGrouped) {
      const s = row.sloc;
      if (!slocMap.has(s)) {
        slocMap.set(s, {
          sloc: s,
          totalItems: 0,
          matchCount: 0,
          deficitCount: 0,
          surplusCount: 0,
          sapQty: 0,
          qtyAudit: 0,
          diffQty: 0,
          sapKg: 0,
          kgAudit: 0,
          diffKg: 0,
        });
      }
      const stat = slocMap.get(s)!;
      const count = row._count._all;
      stat.totalItems += count;
      totalItemsCount += count;

      if (row.status === 'MATCH') {
        stat.matchCount += count;
        totalMatch += count;
      } else if (row.status === 'DEFICIT') {
        stat.deficitCount += count;
        totalDeficit += count;
      } else if (row.status === 'SURPLUS') {
        stat.surplusCount += count;
        totalSurplus += count;
      }

      stat.sapQty += row._sum.sapQty || 0;
      stat.qtyAudit += row._sum.qtyAudit || 0;
      stat.diffQty += row._sum.diffQty || 0;
      stat.sapKg += row._sum.eomKg || 0;
      stat.kgAudit += row._sum.kgAudit || 0;
      stat.diffKg += row._sum.diffKgAudit || 0;
    }

    const slocStats = Array.from(slocMap.values())
      .map(s => ({
        ...s,
        accuracyPct: s.totalItems > 0 ? (s.matchCount / s.totalItems) * 100 : 0,
        tonAudit: (s.kgAudit || 0) / 1000,
        tonSap: (s.sapKg || 0) / 1000,
        tonDiff: (s.diffKg || 0) / 1000,
      }))
      .sort((a, b) => {
        // Sort lowest accuracy first (critical first), then by SLoc name
        if (a.accuracyPct !== b.accuracyPct) {
          return a.accuracyPct - b.accuracyPct;
        }
        return a.sloc.localeCompare(b.sloc);
      });

    const overallBreakdown = {
      totalItems: totalItemsCount,
      matchCount: totalMatch,
      deficitCount: totalDeficit,
      surplusCount: totalSurplus,
      accuracyPct: totalItemsCount > 0 ? (totalMatch / totalItemsCount) * 100 : 0,
    };

    return NextResponse.json({
      session,
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      availableSlocs: distinctSlocs.map(s => s.sloc),
      slocStats,
      overallBreakdown,
    });
  } catch (error) {
    return respondError(error);
  }
}

export async function POST(req: NextRequest) {
  const ctx = await requireUserContext();
  if (ctx instanceof NextResponse) return ctx;

  try {
    const contentType = req.headers.get('content-type') || '';
    let parsedResult;
    let fileName = '';
    let customTitle = '';
    let dateStr = new Date().toISOString().split('T')[0];
    let customGudangId: number | null = ctx.gudangId;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      customTitle = (formData.get('title') as string) || '';
      dateStr = (formData.get('dateStr') as string) || dateStr;
      const gId = formData.get('gudangId') as string;
      if (ctx.isAdmin && gId) {
        customGudangId = parseInt(gId, 10);
      }

      if (!file) {
        return NextResponse.json({ error: 'File Excel atau CSV diperlukan' }, { status: 400 });
      }

      fileName = file.name;
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
        const text = buffer.toString('utf-8');
        parsedResult = parseAuditSlocText(text);
      } else {
        parsedResult = parseAuditSlocExcel(buffer);
      }
    } else {
      const body = await req.json();
      fileName = body.fileName || 'Pasted Data';
      customTitle = body.title || '';
      dateStr = body.dateStr || dateStr;
      if (ctx.isAdmin && body.gudangId) {
        customGudangId = parseInt(body.gudangId, 10);
      }

      if (body.rawText) {
        parsedResult = parseAuditSlocText(body.rawText);
      } else if (body.fileBase64) {
        const buffer = Buffer.from(body.fileBase64, 'base64');
        parsedResult = parseAuditSlocExcel(buffer);
      } else {
        return NextResponse.json({ error: 'Data atau file tidak diberikan' }, { status: 400 });
      }
    }

    if (!parsedResult || parsedResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada baris data audit yang berhasil diurai dari file.' },
        { status: 422 }
      );
    }

    // Filter by warehouse prefix for non-admin callers
    let validRows = parsedResult.rows;
    if (!ctx.isAdmin && ctx.gudangId) {
      const prefix = getGudangPrefix(ctx.gudangId).toUpperCase();
      validRows = validRows.filter(r => r.sloc.toUpperCase().startsWith(prefix));
    }

    if (validRows.length === 0) {
      return NextResponse.json(
        { error: 'Semua baris di luar gudang Anda dan telah disaring.' },
        { status: 422 }
      );
    }

    // Recompute totals for filtered rows
    let totalQtySap = 0;
    let totalKgSap = 0;
    let totalQtyAudit = 0;
    let totalKgAudit = 0;
    let totalDiffQty = 0;
    let totalDiffKg = 0;
    let matchCount = 0;
    let diffCount = 0;

    for (const row of validRows) {
      totalQtySap += row.sapQty;
      totalKgSap += row.eomKg;
      totalQtyAudit += row.qtyAudit;
      totalKgAudit += row.kgAudit;
      totalDiffQty += row.diffQty;
      totalDiffKg += row.diffKgAudit;
      if (row.status === 'MATCH') matchCount += 1;
      else diffCount += 1;
    }

    const title =
      customTitle ||
      `Audit SLoc - ${validRows[0]?.sloc?.slice(0, 2) || ''} (${dateStr})`;

    // Save session and items in transaction
    const session = await prisma.$transaction(async tx => {
      const newSession = await tx.auditSlocSession.create({
        data: {
          title,
          dateStr,
          plant: validRows[0]?.plant || '1105',
          gudangId: customGudangId,
          fileName,
          totalItems: validRows.length,
          totalQtySap,
          totalKgSap,
          totalQtyAudit,
          totalKgAudit,
          totalDiffQty,
          totalDiffKg,
          matchCount,
          diffCount,
        },
      });

      // Insert in chunks of 500 to keep queries fast and within parameter limits
      const chunkSize = 500;
      for (let i = 0; i < validRows.length; i += chunkSize) {
        const chunk = validRows.slice(i, i + chunkSize);
        await tx.auditSlocItem.createMany({
          data: chunk.map(r => ({
            sessionId: newSession.id,
            plant: r.plant,
            sloc: r.sloc,
            material: r.material,
            materialDesc: r.materialDesc,
            batch: r.batch,
            sapQty: r.sapQty,
            eomKg: r.eomKg,
            qtyAudit: r.qtyAudit,
            kgAudit: r.kgAudit,
            diffKgAudit: r.diffKgAudit,
            diffQty: r.diffQty,
            sapRef: r.sapRef,
            actual: r.actual,
            diffAudit: r.diffAudit,
            status: r.status,
          })),
        });
      }

      return newSession;
    });

    return NextResponse.json({
      success: true,
      session,
      metrics: {
        totalItems: validRows.length,
        matchCount,
        diffCount,
        totalQtyAudit,
        totalKgAudit,
        totalDiffQty,
        totalDiffKg,
      },
    });
  } catch (error) {
    return respondError(error);
  }
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireUserContext();
  if (ctx instanceof NextResponse) return ctx;

  if (!ctx.isAdmin) {
    return NextResponse.json(
      { error: 'Akses ditolak: hanya admin yang dapat menghapus sesi audit' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Parameter sessionId diperlukan' }, { status: 400 });
    }

    const session = await prisma.auditSlocSession.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });

    if (!session) {
      return NextResponse.json({ error: 'Sesi audit tidak ditemukan' }, { status: 404 });
    }

    await prisma.auditSlocSession.delete({
      where: { id: sessionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return respondError(error);
  }
}
