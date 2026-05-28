import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { parseSapBuffer } from '@/lib/excel-parser';
import { prisma } from '@/lib/db';
import * as fs from 'fs';
import * as path from 'path';

const importResults = new Map<string, {
  sessionId?: string;
  status: string;
  message: string;
  movements?: number;
  stocks?: number;
  stockCards?: number;
  timestamp: number;
}>();

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { runId, status, message, filePath } = body;

    if (!runId) {
      return NextResponse.json({ error: 'runId required' }, { status: 400 });
    }

    const result: typeof importResults extends Map<string, infer V> ? V : never = {
      status,
      message: message || '',
      timestamp: Date.now(),
    };

    if (status === 'success' && filePath) {
      if (fs.existsSync(filePath)) {
        try {
          const fileBuffer = fs.readFileSync(filePath);
          const arrayBuffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);
          const parsedData = parseSapBuffer(arrayBuffer);

          if (parsedData.movements.length === 0 && (!parsedData.stockCards || parsedData.stockCards.length === 0)) {
            result.status = 'error';
            result.message = 'File dari SAP tidak mengandung data yang dikenali. Format mungkin berbeda.';
          } else {
            const dateCounts: Record<string, number> = {};
            parsedData.movements.forEach((m: any) => {
              dateCounts[m.dateStr] = (dateCounts[m.dateStr] || 0) + 1;
            });
            const sortedDates = Object.entries(dateCounts).sort((a, b) => b[1] - a[1]);
            const dateStr = sortedDates.length > 0 ? sortedDates[0][0] : new Date().toISOString().split('T')[0];
            const parts = dateStr.split('-');
            const monthsNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
            const label = `${parts[2]} ${monthsNames[parseInt(parts[1]) - 1]} ${parts[0]}`;
            const stockCardsJson = parsedData.stockCards?.length ? JSON.stringify(parsedData.stockCards) : null;

            const reportSession = await prisma.reportSession.create({
              data: {
                label,
                dateStr,
                fileName: `SAP GUI: ${path.basename(filePath)}`,
                stockCards: stockCardsJson,
                movements: {
                  create: parsedData.movements.map((m: any) => ({
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
                  create: parsedData.stocks.map((s: any) => ({
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

            result.sessionId = reportSession.id;
            result.status = 'success';
            result.movements = parsedData.movements.length;
            result.stocks = parsedData.stocks.length;
            result.stockCards = parsedData.stockCards?.length || 0;
            result.message = `Data berhasil di-import: ${parsedData.movements.length} movements, ${parsedData.stocks.length} stocks`;
          }
        } catch (parseErr: any) {
          result.status = 'error';
          result.message = `Gagal memproses file: ${parseErr.message}`;
        }
      } else {
        result.status = 'pending';
        result.message = `File belum ditemukan: ${filePath}. Silakan cek folder SAP_Export.`;
      }
    }

    importResults.set(runId, result);

    return NextResponse.json({ received: true, status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const runId = req.nextUrl.searchParams.get('runId');
  if (!runId) {
    return NextResponse.json({ error: 'runId required' }, { status: 400 });
  }

  const result = importResults.get(runId);
  if (!result) {
    return NextResponse.json({ status: 'waiting', message: 'Menunggu script SAP GUI...' });
  }

  return NextResponse.json(result);
}
