import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserContext, respondError } from "@/lib/api-helpers";
import { aggregateSessionData } from "@/lib/aggregation";
import { parseSapBuffer, ProcessedMovement, ProcessedStock, StockCardItem } from "@/lib/excel-parser";
import * as fs from "fs";
import * as path from "path";

// ─── GET: Test endpoint ───
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "MB51 Auto Import API ready. POST an Excel file to import.",
  });
}

// ─── POST: Terima file dari MB51 export & auto-save ───
export async function POST(req: NextRequest) {
  const ctx = await requireUserContext();
  if (ctx instanceof NextResponse) return ctx;

  try {
    let buffer: Buffer;
    let fileName = "MB51_Export.xlsx";
    let customLabel: string | null = null;

    // Cek: apakah ini multipart form upload atau JSON body
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      // ── Mode Upload File ──
      const formData = await req.formData();
      const fileField = formData.get("file");
      customLabel = formData.get("label") as string | null;

      if (fileField instanceof File) {
        const fileBytes = await fileField.arrayBuffer();
        buffer = Buffer.from(fileBytes);
        fileName = fileField.name || fileName;
      } else {
        // Mungkin string path — baca dari disk
        const filePath = formData.get("filePath") as string | null;
        if (filePath) {
          if (!fs.existsSync(filePath)) {
            return NextResponse.json(
              { error: `File not found at path: ${filePath}` },
              { status: 404 }
            );
          }
          buffer = fs.readFileSync(filePath);
          fileName = path.basename(filePath);
        } else {
          return NextResponse.json(
            { error: "No file or filePath provided" },
            { status: 400 }
          );
        }
      }
    } else {
      // ── Mode JSON: filePath di body ──
      const body = await req.json();
      const filePath = body.filePath as string;
      customLabel = body.label || null;

      if (!filePath) {
        return NextResponse.json(
          { error: "filePath is required in JSON body" },
          { status: 400 }
        );
      }

      if (!fs.existsSync(filePath)) {
        return NextResponse.json(
          { error: `File not found at path: ${filePath}` },
          { status: 404 }
        );
      }

      buffer = fs.readFileSync(filePath);
      fileName = path.basename(filePath);
    }

    // ── Parse file ──
    let parsed;
    try {
      parsed = parseSapBuffer(buffer.buffer);
    } catch (parseErr) {
      console.error("[mb51-auto-import] Parse error:", parseErr);
      return NextResponse.json(
        { error: `Failed to parse SAP Excel file: ${parseErr instanceof Error ? parseErr.message : "Unknown error"}` },
        { status: 400 }
      );
    }

    const { movements, stocks, stockCards } = parsed;

    if (movements.length === 0) {
      return NextResponse.json(
        { error: "No movements found in the file. Pastikan format file MB51 benar." },
        { status: 400 }
      );
    }

    // ── Generate label ──
    const dateCounts: Record<string, number> = {};
    movements.forEach((m: ProcessedMovement) => {
      dateCounts[m.dateStr] = (dateCounts[m.dateStr] || 0) + 1;
    });
    const sortedDates = Object.entries(dateCounts).sort((a, b) => b[1] - a[1]);
    let dateStr = sortedDates.length > 0 ? sortedDates[0][0] : new Date().toISOString().split("T")[0];

    let label = customLabel || `MB51 Auto - ${dateStr}`;
    if (!customLabel) {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const monthsNames = [
          "Januari", "Februari", "Maret", "April", "Mei", "Juni",
          "Juli", "Agustus", "September", "Oktober", "November", "Desember",
        ];
        label = `${parts[2]} ${monthsNames[parseInt(parts[1]) - 1]} ${parts[0]} (MB51 Auto)`;
      }
    }

    // ── Aggregate & Save ──
    const {
      movementSummaries,
      stockSummaries,
      rawMovements,
      rawStocks,
      stats,
      stockCardsJson,
    } = aggregateSessionData({ movements, stocks, stockCards });

    const reportSession = await prisma.reportSession.create({
      data: {
        label,
        dateStr,
        fileName: fileName ?? null,
        gudangId: ctx.gudangId,
        stockCards: stockCardsJson,
        stats: JSON.stringify(stats),
        rawMovements: JSON.stringify(rawMovements),
        rawStocks: JSON.stringify(rawStocks),
        movementSummaries: { create: movementSummaries },
        stockSummaries: { create: stockSummaries },
      },
    });

    return NextResponse.json({
      ok: true,
      reportSessionId: reportSession.reportSessionId,
      movementCount: movements.length,
      stockCount: stocks.length,
      label,
      dateStr,
      stats,
    });
  } catch (err) {
    console.error("[mb51-auto-import] Error:", err);
    return respondError(err);
  }
}
