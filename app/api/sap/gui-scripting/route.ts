import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { parseSapBuffer } from '@/lib/excel-parser';
import { prisma } from '@/lib/db';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function getAllOutput(error: any): { stdout: string; stderr: string } {
  if (error && error.stdout !== undefined) {
    return { stdout: error.stdout as string, stderr: error.stderr as string };
  }
  return { stdout: '', stderr: '' };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let tempDir: string | null = null;

  try {
    const body = await req.json();
    const { transactionCode, dateFrom, dateTo, plant } = body;

    if (!transactionCode) {
      return NextResponse.json(
        { error: 'Transaction Code wajib diisi' },
        { status: 400 }
      );
    }

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sap-gui-export-'));

    // Use 32-bit cscript.exe for SAP GUI COM (SAP GUI is 32-bit)
    const systemRoot = process.env.SystemRoot || 'C:\\Windows';
    const cscript32 = path.join(systemRoot, 'SysWOW64', 'cscript.exe');
    const cscriptExe = fs.existsSync(cscript32) ? cscript32 : 'cscript';
    const vbsPath = path.join(process.cwd(), 'scripts', 'sap-gui-export.vbs');

    if (!fs.existsSync(vbsPath)) {
      return NextResponse.json(
        { error: 'Script sap-gui-export.vbs tidak ditemukan' },
        { status: 500 }
      );
    }

    // Build cscript command (use '.' placeholder for empty args - empty strings are dropped by cmd)
    const vbsArgs = [
      `"${vbsPath}"`,
      `"${transactionCode}"`,
      `"${dateFrom || '.'}"`,
      `"${dateTo || '.'}"`,
      `"${plant || '.'}"`,
      `"${tempDir}"`,
    ].join(' ');

    const cmd = `"${cscriptExe}" //Nologo ${vbsArgs}`;

    // Execute
    let stdout = '';
    let stderr = '';
    try {
      const result = await execAsync(cmd, {
        timeout: 240000,
        maxBuffer: 10 * 1024 * 1024,
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (execError: any) {
      const out = getAllOutput(execError);
      stdout = out.stdout;
      stderr = out.stderr;
    }

    const logLines = stdout.split('\n').filter((l: string) => l.trim());
    const errorLines = stderr.split('\n').filter((l: string) => l.trim());

    // Read script log file
    let scriptLogs: string[] = [];
    const logFilePath = path.join(tempDir, 'script.log');
    if (fs.existsSync(logFilePath)) {
      scriptLogs = fs.readFileSync(logFilePath, 'utf-8').split('\n').filter((l: string) => l.trim());
    }

    // Check for script error marker
    const scriptErrorMatch = stdout.match(/SCRIPT_ERROR=(.+)/);
    if (scriptErrorMatch) {
      return NextResponse.json({
        success: false,
        message: scriptErrorMatch[1].trim(),
        debugLogs: [...scriptLogs, ...logLines, ...errorLines],
      }, { status: 500 });
    }

    // Find result file
    const resultFileMatch = stdout.match(/RESULTFILE=(.+)/);
    const pendingManualMatch = stdout.match(/PENDINGMANUAL=(.+)/);

    if (resultFileMatch) {
      const exportFile = resultFileMatch[1].trim();

      if (!fs.existsSync(exportFile)) {
        return NextResponse.json({
          success: false,
          message: 'File export tidak ditemukan di lokasi yang dilaporkan script.',
          debugLogs: [...scriptLogs, ...logLines, ...errorLines],
        }, { status: 500 });
      }

      const fileBuffer = fs.readFileSync(exportFile);
      const arrayBuffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);
      const parsedData = parseSapBuffer(arrayBuffer);

      if (parsedData.movements.length === 0 && (!parsedData.stockCards || parsedData.stockCards.length === 0)) {
        return NextResponse.json({
          success: false,
          message: 'File dari SAP tidak mengandung data yang dikenali. Format mungkin berbeda.',
          debugLogs: [...scriptLogs, ...logLines, ...errorLines],
        }, { status: 422 });
      }

      const dateCounts: Record<string, number> = {};
      parsedData.movements.forEach(m => {
        dateCounts[m.dateStr] = (dateCounts[m.dateStr] || 0) + 1;
      });
      const sortedDates = Object.entries(dateCounts).sort((a, b) => b[1] - a[1]);
      const dateStr = sortedDates.length > 0 ? sortedDates[0][0] : new Date().toISOString().split('T')[0];

      const parts = dateStr.split('-');
      const monthsNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      const label = `${parts[2]} ${monthsNames[parseInt(parts[1]) - 1]} ${parts[0]}`;

      const stockCardsJson = parsedData.stockCards?.length
        ? JSON.stringify(parsedData.stockCards)
        : null;

      const reportSession = await prisma.reportSession.create({
        data: {
          label,
          dateStr,
          fileName: `SAP GUI: ${transactionCode} (${new Date().toLocaleDateString('id-ID')})`,
          stockCards: stockCardsJson,
          rawStocks: JSON.stringify(parsedData.stocks),
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
        },
      });

      try {
        const files = fs.readdirSync(tempDir);
        for (const f of files) {
          try { fs.unlinkSync(path.join(tempDir, f)); } catch {}
        }
        try { fs.rmdirSync(tempDir); } catch {}
      } catch {}

      return NextResponse.json({
        success: true,
        sessionId: reportSession.id,
        message: `Data berhasil di-import: ${parsedData.movements.length} movements, ${parsedData.stocks.length} stocks`,
        movementsCount: parsedData.movements.length,
        stocksCount: parsedData.stocks.length,
        stockCardsCount: parsedData.stockCards?.length || 0,
        debugLogs: [...scriptLogs, ...logLines, ...errorLines],
      });

    } else if (pendingManualMatch) {
      const pendingDir = pendingManualMatch[1].trim();
      return NextResponse.json({
        success: true,
        pendingManual: true,
        message: 'Export otomatis tidak selesai. Silakan cek SAP GUI dan simpan file Excel secara manual.',
        downloadDir: pendingDir,
        debugLogs: [...scriptLogs, ...logLines, ...errorLines],
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Script SAP GUI gagal. Lihat detail log di bawah.',
        debugLogs: [...scriptLogs, ...logLines, ...errorLines],
        rawOutput: stdout.substring(0, 2000),
        rawError: stderr.substring(0, 2000),
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[SAP GUI Scripting] Error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Terjadi kesalahan server',
      error: error.message,
    }, { status: 500 });
  }
}
