import * as XLSX from 'xlsx';
import { getMovementInfo, MovementGroup } from './sap-mapping';
import { isPenampunganSloc, classifyBatch } from './gudang';

export interface MovementStats {
  totalIncoming: number;
  totalOutgoing: number;
  netMovement: number;
  incomingCount: number;
  outgoingCount: number;
  totalCount?: number;
}

export const formatDateToYMD = (date: Date): string => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const calculateStats = (movements: ProcessedMovement[]): MovementStats => {
  let totalIncoming = 0;
  let totalOutgoing = 0;
  let incomingCount = 0;
  let outgoingCount = 0;

  movements.forEach(m => {
    if (m.group === 'Masuk') {
      totalIncoming += m.quantity;
      incomingCount++;
    } else if (m.group === 'Keluar') {
      totalOutgoing += Math.abs(m.quantity); // Keep totalOutgoing absolute for StatsCard
      outgoingCount++;
    }
  });

  return {
    totalIncoming,
    totalOutgoing,
    netMovement: totalIncoming - totalOutgoing,
    incomingCount,
    outgoingCount,
    totalCount: movements.length,
  };
};

/**
 * Format raw date string / number / Date to standard YYYY-MM-DD.
 */
export function parseDateString(rawDate: any): string | undefined {
  if (rawDate === null || rawDate === undefined || rawDate === '') return undefined;

  if (typeof rawDate === 'number') {
    if (isNaN(rawDate)) return undefined;
    const msSinceEpoch = Math.round((rawDate - 25569) * 86400 * 1000);
    const d = new Date(msSinceEpoch);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  if (rawDate instanceof Date) {
    const y = rawDate.getUTCFullYear();
    const m = String(rawDate.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(rawDate.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  if (typeof rawDate === 'string' && rawDate.trim()) {
    const s = rawDate.replace(/[\r\n\s]+/g, ' ').trim();
    const dmyMatch = s.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})$/);
    const ymdMatch = s.match(/^(\d{4})[\/\.\-](\d{1,2})[\/\.\-](\d{1,2})$/);
    if (dmyMatch) {
      const dd = dmyMatch[1].padStart(2, '0');
      const mm = dmyMatch[2].padStart(2, '0');
      const yy = dmyMatch[3];
      return `${yy}-${mm}-${dd}`;
    }
    if (ymdMatch) {
      const yy = ymdMatch[1];
      const mm = ymdMatch[2].padStart(2, '0');
      const dd = ymdMatch[3].padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    }
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getUTCFullYear();
      const m = String(parsed.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(parsed.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    }
  }

  return undefined;
}

/**
 * Parse SAP "Entered at" (CPUTM / time) into "HH:mm:ss" string.
 * Supports:
 * - Excel fraction of day (< 1): e.g. 0.3125 -> 07:30:00
 * - SAP integer time: e.g. 71530 -> 07:15:30
 * - Excel datetime serial (> 1): fractional day part converted
 * - Date object
 * - String: "07:15:30", "07.15.30", "7:15", "071530", etc.
 */
export function parseEntryTime(rawTime: any): string | undefined {
  if (rawTime === null || rawTime === undefined || rawTime === '') return undefined;

  if (typeof rawTime === 'number') {
    if (isNaN(rawTime)) return undefined;

    // Excel fraction of a day (e.g. 0.291666 -> 07:00:00)
    if (rawTime >= 0 && rawTime < 1) {
      const totalSeconds = Math.round(rawTime * 86400);
      const h = Math.floor(totalSeconds / 3600) % 24;
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    // SAP integer representation (e.g. 71530 for 07:15:30 or 235959)
    if (rawTime >= 100 && rawTime <= 240000) {
      const intVal = Math.floor(rawTime);
      const s = intVal % 100;
      const m = Math.floor(intVal / 100) % 100;
      const h = Math.floor(intVal / 10000);
      if (h < 24 && m < 60 && s < 60) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      }
    }

    // Excel datetime serial (> 1): take fractional day part
    const fraction = rawTime - Math.floor(rawTime);
    if (fraction > 0) {
      const totalSeconds = Math.round(fraction * 86400);
      const h = Math.floor(totalSeconds / 3600) % 24;
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
  }

  if (rawTime instanceof Date) {
    const h = rawTime.getUTCHours();
    const m = rawTime.getUTCMinutes();
    const s = rawTime.getUTCSeconds();
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  if (typeof rawTime === 'string') {
    const clean = rawTime.trim();
    if (!clean) return undefined;

    // Pattern: HH:mm:ss or HH.mm.ss with optional AM/PM
    const ampmMatch = clean.match(/^(\d{1,2})[:.](\d{1,2})(?:[:.](\d{1,2}))?\s*(AM|PM)?$/i);
    if (ampmMatch) {
      let h = parseInt(ampmMatch[1], 10);
      const m = parseInt(ampmMatch[2], 10);
      const s = ampmMatch[3] ? parseInt(ampmMatch[3], 10) : 0;
      const meridiem = ampmMatch[4]?.toUpperCase();
      if (meridiem === 'PM' && h < 12) h += 12;
      if (meridiem === 'AM' && h === 12) h = 0;
      if (h < 24 && m < 60 && s < 60) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      }
    }

    // Pattern: 5 or 6 digit number string like "071530" or "71530"
    if (/^\d{5,6}$/.test(clean)) {
      const padded = clean.padStart(6, '0');
      const h = parseInt(padded.slice(0, 2), 10);
      const m = parseInt(padded.slice(2, 4), 10);
      const s = parseInt(padded.slice(4, 6), 10);
      if (h < 24 && m < 60 && s < 60) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      }
    }
  }

  return undefined;
}

/**
 * Determine work shift from time value:
 * - Shift 1: 07:00 - 15:00 (07:00:00 - 14:59:59)
 * - Shift 2: 15:00 - 23:00 (15:00:00 - 22:59:59)
 * - Shift 3: 23:00 - 07:00 (23:00:00 - 06:59:59)
 */
export function getShiftFromTime(timeVal: any): 1 | 2 | 3 | undefined {
  const timeStr = typeof timeVal === 'string' && /^\d{2}:\d{2}/.test(timeVal)
    ? timeVal
    : parseEntryTime(timeVal);

  if (!timeStr) return undefined;

  const parts = timeStr.split(':').map(Number);
  const hour = parts[0];
  if (isNaN(hour)) return undefined;

  // Shift 1: 07:00 - 15:00
  if (hour >= 7 && hour < 15) {
    return 1;
  }
  // Shift 2: 15:00 - 23:00
  if (hour >= 15 && hour < 23) {
    return 2;
  }
  // Shift 3: 23:00 - 07:00
  return 3;
}

/**
 * Adjust calendar date to operational work date based on 07:00 AM cut-off.
 * Work hours cut-off runs from 07:00 to 07:00 the following morning:
 * - 07:00 - 14:59 (Shift 1): same day
 * - 15:00 - 22:59 (Shift 2): same day
 * - 23:00 - 23:59 (Shift 3): same day
 * - 00:00 - 06:59 (Shift 3): previous day (date - 1)
 */
export function getOperationalDateStr(calendarDateStr: string, timeVal: any): string {
  if (!calendarDateStr) return calendarDateStr;
  const timeStr = typeof timeVal === 'string' && /^\d{2}:\d{2}/.test(timeVal)
    ? timeVal
    : parseEntryTime(timeVal);

  if (!timeStr) return calendarDateStr;

  const parts = timeStr.split(':').map(Number);
  const hour = parts[0];
  if (isNaN(hour)) return calendarDateStr;

  if (hour < 7) {
    const [y, m, d] = calendarDateStr.split('-').map(Number);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      const prev = new Date(Date.UTC(y, m - 1, d - 1));
      const py = prev.getUTCFullYear();
      const pm = String(prev.getUTCMonth() + 1).padStart(2, '0');
      const pd = String(prev.getUTCDate()).padStart(2, '0');
      return `${py}-${pm}-${pd}`;
    }
  }

  return calendarDateStr;
}

export interface RawSapData {
  'Posting Date'?: string | number;
  'Movement Type'?: string | number;
  'Work center'?: string;
  'Batch'?: string;
  'Quantity'?: number;
  'Qty in Un. of Entry'?: number;
  'KG GI'?: number;
  'KG GR'?: number;
  'Storage Location'?: string;
  'User name'?: string;
  'Plant'?: string;
  'Material'?: string;
  'Material Description'?: string;
  'Entered at'?: string | number;
  'Entered on'?: string | number;
  'Entry Time'?: string | number;
  'Entry Date'?: string | number;
  'CPUTM'?: string | number;
  'CPUDT'?: string | number;
}

export interface ProcessedMovement {
  movementId: string;
  postingDate: Date;
  dateStr: string;
  moveType: string;
  description: string;
  group: MovementGroup;
  workCenter: string;
  batch: string;
  quantity: number;
  unitQuantity: number;
  userName: string;
  storageLocation: string;
  color: string;
  movementStatus: 'Fast' | 'Slow' | 'Unknown';
  material?: string;
  entryTime?: string;
  entryDate?: string;
  shift?: 1 | 2 | 3;
}

export interface ProcessedStock {
  status: string;
  sloc: string;
  quantity: number;
  tonnage: number;
  itemCount?: number;
  isPenampungan?: boolean;
  pasm?: string;
}

export interface StockCardItem {
  sloc: string;
  customer: string;
  materialNumber: string;
  diam: string;
  lengthSide: string;
  widthSide: string;
  diamMm: string;
  tebal: string;
  panjang: string;
  ttlStokBom: number;
  ttlStokEom: number;
  batch: string;
  nomorSo: string;
  itemSo: string;
  class: string;
  description: string;
  custRemark: string;
  jenisMaterial: string;
  kelompok: string;
  pasm: string;
}

export interface ExcelParseResult {
  movements: ProcessedMovement[];
  stocks: ProcessedStock[];
  stockCards?: StockCardItem[];
}

export function parseSapBuffer(buffer: ArrayBufferLike): ExcelParseResult {
  const view = new Uint8Array(buffer);

  let workbook: XLSX.WorkBook;

  const isZip = view[0] === 0x50 && view[1] === 0x4B;
  const isOLE = view[0] === 0xD0 && view[1] === 0xCF && view[2] === 0x11 && view[3] === 0xE0;

  if (isZip || isOLE) {
    workbook = XLSX.read(view, { type: 'array', cellDates: false });
  } else {
    let decodedText = '';
    if (view[0] === 0xFF && view[1] === 0xFE) {
      decodedText = new TextDecoder('utf-16le').decode(buffer);
    } else if (view[0] === 0xFE && view[1] === 0xFF) {
      decodedText = new TextDecoder('utf-16be').decode(buffer);
    } else {
      decodedText = new TextDecoder('utf-8').decode(buffer);
      if (decodedText.indexOf('\x00') !== -1 && decodedText.length > 2) {
        decodedText = new TextDecoder('utf-16le').decode(buffer);
      }
    }

    try {
      workbook = XLSX.read(decodedText, { type: 'string', cellDates: false });
    } catch (e) {
      console.error("XLSX read string failed:", e);
      workbook = { SheetNames: [], Sheets: {} };
    }
  }

  const movementSheetName = workbook.SheetNames[0];
  const stockSheetName = workbook.SheetNames[1];

  const parseSheet = (ws: XLSX.WorkSheet) => {
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    if (rows.length < 2) return [];

    let headerRowIndex = rows.findIndex(row =>
      Array.isArray(row) && row.some(cell => {
        const str = String(cell || '').toLowerCase().trim();
        return (
          str.includes('movement') || str.includes('mvt') ||
          str.includes('posting') || str.includes('date') ||
          str.includes('tonase') || str.includes('qty pc') ||
          str.includes('status') || str.includes('sloc')
        );
      })
    );

    if (headerRowIndex === -1) headerRowIndex = 0;

    return XLSX.utils.sheet_to_json<any>(ws, {
      range: headerRowIndex,
      defval: ''
    });
  };

  const getValFromRow = (row: any, possibleKeys: string[]) => {
    const cleanKeys = Object.keys(row).map(k => ({
      original: k,
      clean: String(k || '').replace(/[\r\n\s]+/g, ' ').trim().toLowerCase()
    }));
    const cleanPossible = possibleKeys.map(pk => pk.toLowerCase());
    const exactMatch = cleanKeys.find(ck => cleanPossible.includes(ck.clean));
    if (exactMatch) return row[exactMatch.original];
    const partialMatch = cleanKeys.find(ck =>
      cleanPossible.some(pk => {
        if (pk.length < 4) return false;
        const escaped = pk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(ck.clean);
      })
    );
    return partialMatch ? row[partialMatch.original] : undefined;
  };

  const parseNum = (val: any) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const normalized = val.replace(/\s/g, '').replace(/,/g, '.');
      const num = parseFloat(normalized);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  };

  const movementJson = parseSheet(workbook.Sheets[movementSheetName] || workbook.Sheets[workbook.SheetNames[0]]);
  const movements = movementJson.map((row: any, index: number) => {
    const moveCode = String(getValFromRow(row, ['Movement Type', 'Mvt Type', 'MvT', 'Move ment Type', 'Mvtype']) || '').trim();
    let rawDate = getValFromRow(row, ['Posting Date', 'Pstng Date', 'Pst Date']);
    if (!rawDate) {
      rawDate = getValFromRow(row, ['Date']);
    }
    const rawQuantity = parseNum(getValFromRow(row, ['Quantity', 'Tonase', 'Total Quantity', 'KG GR', 'KG GI']));
    const rawUnitQty = parseNum(getValFromRow(row, ['Qty in Un. of Entry', 'QTY PC', 'Unit Qty', 'Qty Entry', 'Pcs']));

    if (!moveCode && !rawDate && !rawQuantity && !rawUnitQty) return null;

    const baseMoveInfo = getMovementInfo(moveCode || 'Unknown');
    let moveDescription = baseMoveInfo.description;
    let moveGroup = baseMoveInfo.group;
    const storageLocation = String(getValFromRow(row, ['Storage Location', 'SLoc', 'Store Loc', 'S.Loc', 'Storage Loc']) || '');

    if (moveCode === '311') {
      if (rawQuantity < 0) {
        moveDescription = 'TF Sloc Out';
        moveGroup = 'Keluar';
      } else {
        moveDescription = 'TF Sloc In';
        moveGroup = 'Masuk';
      }
    }

    let dateStr: string = '';

    if (typeof rawDate === 'number') {
      const msSinceEpoch = Math.round((rawDate - 25569) * 86400 * 1000);
      const d = new Date(msSinceEpoch);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      dateStr = `${y}-${m}-${dd}`;
    } else if (rawDate instanceof Date) {
      const y = rawDate.getUTCFullYear();
      const m = String(rawDate.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(rawDate.getUTCDate()).padStart(2, '0');
      dateStr = `${y}-${m}-${dd}`;
    } else if (typeof rawDate === 'string' && rawDate.trim()) {
      const s = rawDate.replace(/[\r\n\s]+/g, ' ').trim();
      const dmyMatch = s.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})$/);
      const ymdMatch = s.match(/^(\d{4})[\/\.\-](\d{1,2})[\/\.\-](\d{1,2})$/);
      if (dmyMatch) {
        const dd = dmyMatch[1].padStart(2, '0');
        const mm = dmyMatch[2].padStart(2, '0');
        const yy = dmyMatch[3];
        dateStr = `${yy}-${mm}-${dd}`;
      } else if (ymdMatch) {
        const yy = ymdMatch[1];
        const mm = ymdMatch[2].padStart(2, '0');
        const dd = ymdMatch[3].padStart(2, '0');
        dateStr = `${yy}-${mm}-${dd}`;
      } else {
        const parsed = new Date(s);
        if (!isNaN(parsed.getTime())) {
          const y = parsed.getUTCFullYear();
          const m = String(parsed.getUTCMonth() + 1).padStart(2, '0');
          const dd = String(parsed.getUTCDate()).padStart(2, '0');
          dateStr = `${y}-${m}-${dd}`;
        } else {
          const now = new Date();
          dateStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}-${String(now.getUTCDate()).padStart(2,'0')}`;
        }
      }
    } else {
      const now = new Date();
      dateStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}-${String(now.getUTCDate()).padStart(2,'0')}`;
    }

    const rawTime = getValFromRow(row, [
      'Entered at',
      'Entered At',
      'Entry Time',
      'Entry time',
      'Time of Entry',
      'Time',
      'CPUTM',
      'Uzeit',
      'Jam',
      'Waktu',
    ]);
    const rawEntryDate = getValFromRow(row, [
      'Entered on',
      'Entered On',
      'Entry Date',
      'Entry date',
      'CPUDT',
      'Erfdate',
    ]);

    const entryTime = parseEntryTime(rawTime);
    const entryDate = parseDateString(rawEntryDate) || dateStr;
    const shift = entryTime ? getShiftFromTime(entryTime) : undefined;
    const operationalDateStr = entryTime ? getOperationalDateStr(entryDate || dateStr, entryTime) : dateStr;

    const [yyyy, mm2, dd2] = operationalDateStr.split('-').map(Number);
    const dateObj = new Date(Date.UTC(yyyy, mm2 - 1, dd2));

    return {
      movementId: `move-${index}-${Date.now()}`,
      postingDate: dateObj,
      dateStr: operationalDateStr,
      moveType: moveCode,
      description: moveDescription,
      group: moveGroup,
      workCenter: String(getValFromRow(row, ['Work center', 'WCenter', 'WC', 'Workcenter']) || ''),
      batch: String(getValFromRow(row, ['Batch', 'Batch Number']) || ''),
      quantity: rawQuantity,
      unitQuantity: rawUnitQty,
      userName: String(getValFromRow(row, ['User name', 'User', 'Name', 'UName']) || ''),
      storageLocation: storageLocation,
      color: baseMoveInfo.color,
      movementStatus: classifyBatch(String(getValFromRow(row, ['Batch', 'Batch Number']) || '')),
      material: String(getValFromRow(row, ['Material', 'Material Number', 'Material No']) || '').trim() || undefined,
      entryTime,
      entryDate,
      shift,
    };
  }).filter(Boolean) as ProcessedMovement[];

  let stocks: ProcessedStock[] = [];
  let stockCards: StockCardItem[] = [];
  const stockJson: any[] = stockSheetName ? parseSheet(workbook.Sheets[stockSheetName]) : [];
  if (stockJson.length > 0) {
    const headers = Object.keys(stockJson[0]);
    const headerStr = headers.join(' ').toLowerCase();

    const isStockCardSheet = headerStr.includes('material number') || headerStr.includes('ttl stok') || headerStr.includes('stok eom');

    if (isStockCardSheet) {
      stockCards = stockJson.map((row: any) => {
        const getStr = (keys: string[]): string => String(getValFromRow(row, keys) || '').trim();
        const getNum = (keys: string[]): number => parseNum(getValFromRow(row, keys));
        return {
          sloc: getStr(['SLOC', 'Sloc', 'Storage Location', 'Store Loc']),
          customer: getStr(['Customer', 'Cust']),
          materialNumber: getStr(['Material Number', 'MATERIAL NUMBER', 'Material No', 'Material']),
          diam: getStr(['DIAM', 'Diam', 'Diameter', 'DIAM "']),
          lengthSide: getStr(['LENGTH SIDE', 'Length Side']),
          widthSide: getStr(['WIDTH SIDE', 'Width Side']),
          diamMm: getStr(['DIAM MM', 'Diam MM']),
          tebal: getStr(['TEBAL', 'Tebal']),
          panjang: getStr(['PANJANG', 'Panjang', 'Length']),
          ttlStokBom: getNum(['TTL STOK BOm', 'TTL STOK BOM', 'Stok BOM']),
          ttlStokEom: getNum(['TTL STOCK EOm', 'TTL STOCK EOM', 'TTL STOK EOM', 'Ttl Stok Eom', 'Stock EOM']),
          batch: getStr(['BATCH', 'Batch', 'Batch Number']),
          nomorSo: getStr(['NOMOR SO', 'Nomor SO', 'SO Number', 'Sales Order']),
          itemSo: getStr(['ITEM SO', 'Item SO', 'SO Item']),
          class: getStr(['CLASS', 'Class']),
          description: getStr(['DESCRIPTION', 'Description', 'Material Description']),
          custRemark: getStr(['CUST.REMARK', 'Cust Remark', 'Customer Remark', 'Remark']),
          jenisMaterial: getStr(['Jenis Material', 'Jenis', 'Material Type']),
          kelompok: getStr(['Kelompok', 'Group']),
          pasm: getStr(['PASM', 'Pasm']),
        };
      }).filter(s => s.sloc || s.materialNumber);
    } else if (headers.some(h => { const hc = h.toLowerCase(); return hc.includes('sloc') || hc.includes('status') || hc.includes('material'); })) {
      stocks = stockJson.map((row: any) => {
        const rawSloc = String(getValFromRow(row, ['Sloc', 'Storage Location', 'Store Loc']) || '').trim();
        const originalStatus = String(getValFromRow(row, ['Status']) || 'Unknown').trim();
        const isPenampungan = isPenampunganSloc(rawSloc);
        const status = isPenampungan ? 'Sloc Penampungan' : originalStatus;
        const qtyVal = getValFromRow(row, ['QTY', 'Quantity', 'Total QTY', 'Qty PC', 'Qty in Un. of Entry', 'Jumlah']);
        const tonVal = getValFromRow(row, ['Tonase', 'Berat', 'Total Berat', 'Bobot', 'Weight', 'Total Weight']);
        const parsedTon = parseNum(tonVal);
        const parsedQty = parseNum(qtyVal);
        return {
          status: status,
          sloc: rawSloc,
          quantity: parsedQty,
          tonnage: parsedTon,
        };
      }).filter(s => s.status !== 'Unknown' || s.quantity > 0 || s.tonnage > 0);
    }

    if (stocks.length === 0 && stockCards.length > 0) {
      stocks = stockCards.map(sc => ({
        status: (sc.pasm || '').toUpperCase() === 'FAST' ? 'Fast Moving'
              : (sc.pasm || '').toUpperCase() === 'SLOW' ? 'Slow Moving'
              : 'Unknown',
        sloc: sc.sloc,
        quantity: sc.ttlStokEom,
        tonnage: sc.ttlStokEom,
        pasm: sc.pasm,
      }));
    }
  }

  return { movements, stocks, stockCards };
}

export const parseSapExcel = async (file: File): Promise<ExcelParseResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        resolve(parseSapBuffer(arrayBuffer));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

