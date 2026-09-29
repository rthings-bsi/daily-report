import * as XLSX from 'xlsx';

export interface AuditSlocParsedRow {
  plant: string;
  sloc: string;
  material: string;
  materialDesc?: string;
  batch: string;
  sapQty: number;
  eomKg: number;
  qtyAudit: number;
  kgAudit: number;
  diffKgAudit: number;
  diffQty: number;
  sapRef?: number;
  actual?: number;
  diffAudit?: number;
  status: 'MATCH' | 'DEFICIT' | 'SURPLUS';
}

export interface AuditSlocParseResult {
  rows: AuditSlocParsedRow[];
  totalItems: number;
  totalQtySap: number;
  totalKgSap: number;
  totalQtyAudit: number;
  totalKgAudit: number;
  totalDiffQty: number;
  totalDiffKg: number;
  matchCount: number;
  diffCount: number;
  slocList: string[];
  plantList: string[];
}

// Convert SAP text and raw Excel cell numbers into clean floats.
// Handles Indonesian/European comma decimals, dots as thousands, and trailing minus signs.
export function parseSapNumber(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : val;
  }

  let str = String(val).trim();
  if (!str || str === '-') return 0;

  let isNegative = false;
  if (str.endsWith('-')) {
    isNegative = true;
    str = str.slice(0, -1).trim();
  } else if (str.startsWith('-')) {
    isNegative = true;
    str = str.slice(1).trim();
  } else if (str.startsWith('(') && str.endsWith(')')) {
    isNegative = true;
    str = str.slice(1, -1).trim();
  }

  if (str.includes(',') && str.includes('.')) {
    if (str.indexOf('.') < str.indexOf(',')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  } else if (str.includes('.')) {
    const parts = str.split('.');
    if (parts.length === 2 && parts[1].length === 3) {
      str = parts[0] + parts[1];
    }
  }

  const num = parseFloat(str);
  if (isNaN(num)) return 0;
  return isNegative ? -num : num;
}

function cleanString(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function normalizeHeader(val: unknown): string {
  return cleanString(val).toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Detect header column indices from raw header row.
// Explicitly handles duplicate SAP column names from SAP ALV export.
function detectColumnIndices(headers: unknown[]): Record<string, number> {
  const map: Record<string, number> = {};
  let sapOccurrence = 0;

  headers.forEach((h, idx) => {
    const raw = cleanString(h);
    const norm = normalizeHeader(raw);
    if (!norm) return;

    if (norm === 'plant' || norm === 'plnt' || norm === 'werks') {
      map['plant'] = idx;
    } else if (norm === 'sloc' || norm === 'storagelocation' || norm === 'lgort') {
      map['sloc'] = idx;
    } else if (norm === 'material' || norm === 'matnr' || norm === 'materialnumber') {
      map['material'] = idx;
    } else if (norm === 'batch' || norm === 'charg' || norm === 'lot') {
      map['batch'] = idx;
    } else if (norm === 'eom' || norm === 'eomkg' || norm === 'sapkg') {
      map['eomKg'] = idx;
    } else if (norm === 'qtyaudit' || norm === 'auditqty' || norm === 'fisikqty') {
      map['qtyAudit'] = idx;
    } else if (norm === 'kgaudit' || norm === 'auditkg' || norm === 'fisikkg') {
      map['kgAudit'] = idx;
    } else if (norm === 'diffkgaudit' || norm === 'diffkg' || norm === 'selisihkg') {
      map['diffKgAudit'] = idx;
    } else if (norm === 'diff' || norm === 'diffqty' || norm === 'selisihqty') {
      map['diffQty'] = idx;
    } else if (norm === 'actual' || norm === 'aktual' || norm === 'actualfisik') {
      map['actual'] = idx;
    } else if (norm === 'diffaudit' || norm === 'selisihaudit') {
      map['diffAudit'] = idx;
    } else if (norm === 'sap') {
      sapOccurrence += 1;
      if (sapOccurrence === 1) {
        map['sapQty'] = idx;
      } else {
        map['sapRef'] = idx;
      }
    }
  });

  return map;
}

// Parse tabular matrix into structured AuditSlocParsedRow array.
// Forward-fills empty plant and sloc cells for grouped rows.
export function parseAuditSlocMatrix(matrix: unknown[][]): AuditSlocParseResult {
  if (!matrix || matrix.length < 2) {
    return {
      rows: [],
      totalItems: 0,
      totalQtySap: 0,
      totalKgSap: 0,
      totalQtyAudit: 0,
      totalKgAudit: 0,
      totalDiffQty: 0,
      totalDiffKg: 0,
      matchCount: 0,
      diffCount: 0,
      slocList: [],
      plantList: [],
    };
  }

  // Find header row (first row with plant/material/sloc/sap)
  let headerIndex = -1;
  let colMap: Record<string, number> = {};

  for (let r = 0; r < Math.min(10, matrix.length); r++) {
    const row = matrix[r];
    if (!Array.isArray(row)) continue;
    const testMap = detectColumnIndices(row);
    if (
      (testMap['material'] !== undefined || testMap['batch'] !== undefined) &&
      (testMap['sloc'] !== undefined || testMap['plant'] !== undefined || testMap['sapQty'] !== undefined)
    ) {
      headerIndex = r;
      colMap = testMap;
      break;
    }
  }

  // Fallback to exact order from standard SAP layout if headers are unnamed
  if (headerIndex === -1) {
    headerIndex = 0;
    colMap = {
      plant: 1,
      sloc: 2,
      material: 3,
      batch: 4,
      sapQty: 5,
      eomKg: 6,
      qtyAudit: 7,
      kgAudit: 8,
      diffKgAudit: 9,
      diffQty: 10,
      sapRef: 11,
      actual: 12,
      diffAudit: 13,
    };
  }

  const rows: AuditSlocParsedRow[] = [];
  let currentPlant = '';
  let currentSloc = '';

  for (let r = headerIndex + 1; r < matrix.length; r++) {
    const row = matrix[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    const rawPlant = colMap['plant'] !== undefined ? cleanString(row[colMap['plant']]) : '';
    const rawSloc = colMap['sloc'] !== undefined ? cleanString(row[colMap['sloc']]) : '';
    const material = colMap['material'] !== undefined ? cleanString(row[colMap['material']]) : '';
    const batch = colMap['batch'] !== undefined ? cleanString(row[colMap['batch']]) : '';

    // Skip summary or blank lines without material and batch
    if (!material && !batch) continue;
    if (material.toLowerCase().includes('total') || material.toLowerCase().includes('result')) continue;

    if (rawPlant) currentPlant = rawPlant;
    if (rawSloc) currentSloc = rawSloc;

    const sapQty = colMap['sapQty'] !== undefined ? parseSapNumber(row[colMap['sapQty']]) : 0;
    const eomKg = colMap['eomKg'] !== undefined ? parseSapNumber(row[colMap['eomKg']]) : 0;
    const qtyAudit = colMap['qtyAudit'] !== undefined ? parseSapNumber(row[colMap['qtyAudit']]) : 0;
    const kgAudit = colMap['kgAudit'] !== undefined ? parseSapNumber(row[colMap['kgAudit']]) : 0;

    // Use reported diff if present, else compute difference
    let diffKgAudit =
      colMap['diffKgAudit'] !== undefined ? parseSapNumber(row[colMap['diffKgAudit']]) : eomKg - kgAudit;
    let diffQty =
      colMap['diffQty'] !== undefined ? parseSapNumber(row[colMap['diffQty']]) : sapQty - qtyAudit;

    const sapRef = colMap['sapRef'] !== undefined ? parseSapNumber(row[colMap['sapRef']]) : undefined;
    const actual = colMap['actual'] !== undefined ? parseSapNumber(row[colMap['actual']]) : undefined;
    const diffAudit = colMap['diffAudit'] !== undefined ? parseSapNumber(row[colMap['diffAudit']]) : undefined;

    // Determine status
    let status: 'MATCH' | 'DEFICIT' | 'SURPLUS' = 'MATCH';
    if (Math.abs(diffQty) > 0.001 || Math.abs(diffKgAudit) > 0.001) {
      if (diffQty < -0.001 || diffKgAudit < -0.001) {
        status = 'DEFICIT';
      } else {
        status = 'SURPLUS';
      }
    }

    rows.push({
      plant: currentPlant || '1105',
      sloc: currentSloc || 'UNKNOWN',
      material,
      batch,
      sapQty,
      eomKg,
      qtyAudit,
      kgAudit,
      diffKgAudit,
      diffQty,
      sapRef,
      actual,
      diffAudit,
      status,
    });
  }

  let totalQtySap = 0;
  let totalKgSap = 0;
  let totalQtyAudit = 0;
  let totalKgAudit = 0;
  let totalDiffQty = 0;
  let totalDiffKg = 0;
  let matchCount = 0;
  let diffCount = 0;

  const slocSet = new Set<string>();
  const plantSet = new Set<string>();

  for (const row of rows) {
    totalQtySap += row.sapQty;
    totalKgSap += row.eomKg;
    totalQtyAudit += row.qtyAudit;
    totalKgAudit += row.kgAudit;
    totalDiffQty += row.diffQty;
    totalDiffKg += row.diffKgAudit;

    if (row.status === 'MATCH') {
      matchCount += 1;
    } else {
      diffCount += 1;
    }

    if (row.sloc) slocSet.add(row.sloc);
    if (row.plant) plantSet.add(row.plant);
  }

  return {
    rows,
    totalItems: rows.length,
    totalQtySap,
    totalKgSap,
    totalQtyAudit,
    totalKgAudit,
    totalDiffQty,
    totalDiffKg,
    matchCount,
    diffCount,
    slocList: Array.from(slocSet).sort(),
    plantList: Array.from(plantSet).sort(),
  };
}

// Parse Excel file buffer into AuditSlocParseResult
export function parseAuditSlocExcel(buffer: ArrayBuffer | Buffer): AuditSlocParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' }) as unknown[][];
  return parseAuditSlocMatrix(matrix);
}

// Parse text/CSV/clipboard lines into AuditSlocParseResult
export function parseAuditSlocText(text: string): AuditSlocParseResult {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  const matrix: string[][] = lines.map(line => {
    if (line.includes('\t')) {
      return line.split('\t').map(c => c.trim());
    }
    // Simple CSV splitter handling quoted cells
    const cells: string[] = [];
    let curr = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cells.push(curr.trim());
        curr = '';
      } else {
        curr += char;
      }
    }
    cells.push(curr.trim());
    return cells;
  });

  return parseAuditSlocMatrix(matrix);
}
