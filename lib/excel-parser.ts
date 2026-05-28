import * as XLSX from 'xlsx';
import { getMovementInfo, MovementGroup } from './sap-mapping';
import { isPenampunganSloc, classifyBatch } from './gudang';

export interface MovementStats {
  totalIncoming: number;
  totalOutgoing: number;
  netMovement: number;
  incomingCount: number;
  outgoingCount: number;
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
    outgoingCount
  };
};

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
}

export interface ProcessedMovement {
  id: string;
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
  const movements: ProcessedMovement[] = movementJson.map((row: any, index: number) => {
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

    const [yyyy, mm2, dd2] = dateStr.split('-').map(Number);
    const dateObj = new Date(Date.UTC(yyyy, mm2 - 1, dd2));

    return {
      id: `move-${index}-${Date.now()}`,
      postingDate: dateObj,
      dateStr: formatDateToYMD(dateObj),
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
    };
  }).filter((item): item is ProcessedMovement => item !== null);

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

