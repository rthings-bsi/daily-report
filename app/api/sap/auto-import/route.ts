import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { autoImportFromSap } from '@/lib/sap-automation';
import { parseSapBuffer } from '@/lib/excel-parser';
import { prisma } from '@/lib/db';
import * as fs from 'fs';
import * as path from 'path';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { url, username, password, transactionCode, dateFrom, dateTo, plant } = body;

    if (!url || !username || !password) {
      return NextResponse.json(
        { error: 'URL, Username, dan Password wajib diisi' },
        { status: 400 }
      );
    }

    const sapResult = await autoImportFromSap(
      { url, username, password, transactionCode, dateFrom, dateTo, plant },
      (progress) => {
        // Could use SSE for real-time progress, but for now just log
        console.log(`[SAP Auto-Import] ${progress.stage}: ${progress.message}`);
      }
    );

    if (!sapResult.success || !sapResult.filePath) {
      return NextResponse.json(
        {
          success: false,
          message: sapResult.message,
          debugLogs: sapResult.debugLogs,
        },
        { status: 500 }
      );
    }

    // ─── Parse the downloaded file ───
    const fileBuffer = fs.readFileSync(sapResult.filePath);
    const arrayBuffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);
    const parsedData = parseSapBuffer(arrayBuffer);

    if (parsedData.movements.length === 0 && (!parsedData.stockCards || parsedData.stockCards.length === 0)) {
      // Clean up temp file
      try { fs.unlinkSync(sapResult.filePath); } catch {}

      return NextResponse.json(
        {
          success: false,
          message: 'File dari SAP tidak mengandung data yang dikenali. Format mungkin berbeda dari yang diharapkan.',
          debugLogs: sapResult.debugLogs,
        },
        { status: 422 }
      );
    }

    // ─── Save to database ───
    const dateCounts: Record<string, number> = {};
    parsedData.movements.forEach(m => {
      dateCounts[m.dateStr] = (dateCounts[m.dateStr] || 0) + 1;
    });
    const sortedDates = Object.entries(dateCounts).sort((a, b) => b[1] - a[1]);

    let dateStr = '';
    if (sortedDates.length > 0) {
      dateStr = sortedDates[0][0];
    } else {
      const now = new Date();
      dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    const sampleMov = parsedData.movements.find(m => m.dateStr === dateStr) || parsedData.movements[0];
    let label = dateStr;
    if (sampleMov?.dateStr) {
      const parts = sampleMov.dateStr.split('-');
      if (parts.length === 3) {
        const y = parts[0];
        const m = parseInt(parts[1]);
        const d = parts[2];
        const monthsNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        label = `${d.padStart(2, '0')} ${monthsNames[m - 1]} ${y}`;
      }
    }

    const stockCardsJson = parsedData.stockCards && parsedData.stockCards.length > 0
      ? JSON.stringify(parsedData.stockCards)
      : null;

    const reportSession = await prisma.reportSession.create({
      data: {
        label,
        dateStr,
        fileName: `SAP Auto-Import: ${transactionCode || 'N/A'} (${new Date().toLocaleDateString('id-ID')})`,
        stockCards: stockCardsJson,
        movements: {
          create: parsedData.movements.map(m => ({
            postingDate: new Date(m.dateStr),
            dateStr: m.dateStr,
            moveType: m.moveType,
            description: m.description,
            workCenter: m.workCenter ?? null,
            batch: m.batch ?? null,
            storageLocation: m.storageLocation ?? null,
            quantity: m.quantity,
            unitQuantity: m.unitQuantity,
            group: m.group,
            color: m.color,
            userName: m.userName ?? null,
          })),
        },
        stocks: {
          create: parsedData.stocks.map(s => ({
            material: s.status || 'Unknown',
            description: s.status || 'Unknown',
            batch: null,
            sloc: s.sloc ?? null,
            category: null,
            unitQty: s.quantity ?? 0,
            weight: s.tonnage ?? 0,
          })),
        },
      },
    });

    // Clean up temp file
    try {
      // Also clean up the temp directory
      const tempDir = path.dirname(sapResult.filePath);
      const files = fs.readdirSync(tempDir);
      for (const f of files) {
        try { fs.unlinkSync(path.join(tempDir, f)); } catch {}
      }
      try { fs.rmdirSync(tempDir); } catch {}
    } catch {}

    return NextResponse.json({
      success: true,
      sessionId: reportSession.id,
      message: `Data berhasil di-import: ${parsedData.movements.length} movements, ${parsedData.stocks.length} stocks, ${parsedData.stockCards?.length || 0} stock cards`,
      movementsCount: parsedData.movements.length,
      stocksCount: parsedData.stocks.length,
      stockCardsCount: parsedData.stockCards?.length || 0,
      debugLogs: sapResult.debugLogs,
    });

  } catch (error: any) {
    console.error('[SAP Auto-Import] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Terjadi kesalahan saat meng-import data dari SAP',
        error: error.message,
      },
      { status: 500 }
    );
  }
}
