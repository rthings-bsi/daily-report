import * as XLSX from 'xlsx';
import { getMovementInfo, MovementGroup } from './sap-mapping';

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
  'QTY PC'?: number;
  'Tonase'?: number;
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
}

export interface ExcelParseResult {
  movements: ProcessedMovement[];
  stocks: ProcessedStock[];
}

export const parseSapExcel = async (file: File): Promise<ExcelParseResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const view = new Uint8Array(arrayBuffer);

        let workbook: XLSX.WorkBook;
        let isTextBased = false;
        let decodedText = '';

        const isZip = view[0] === 0x50 && view[1] === 0x4B;
        const isOLE = view[0] === 0xD0 && view[1] === 0xCF && view[2] === 0x11 && view[3] === 0xE0;

        if (isZip || isOLE) {
          workbook = XLSX.read(view, { type: 'array', cellDates: false });
        } else {
          isTextBased = true;
          if (view[0] === 0xFF && view[1] === 0xFE) {
            decodedText = new TextDecoder('utf-16le').decode(arrayBuffer);
          } else if (view[0] === 0xFE && view[1] === 0xFF) {
            decodedText = new TextDecoder('utf-16be').decode(arrayBuffer);
          } else {
            decodedText = new TextDecoder('utf-8').decode(arrayBuffer);
            if (decodedText.indexOf('\x00') !== -1 && decodedText.length > 2) {
              decodedText = new TextDecoder('utf-16le').decode(arrayBuffer);
            }
          }

          try {
            workbook = XLSX.read(decodedText, { type: 'string', cellDates: false });
          } catch (e) {
            console.error("XLSX read string failed:", e);
            workbook = { SheetNames: [], Sheets: {} };
          }
        }

        // 1. Process Movements (usually Sheet 1)
        let movementSheetName = workbook.SheetNames[0];
        let stockSheetName = workbook.SheetNames[1];

        // Heuristic: If sheet 1 has very few rows, and sheet 2 has many, sheet 2 might be the movement data.
        // But user explicitly said sheet 2 is stock data.
        
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
            cleanPossible.some(pk => pk.length >= 3 && ck.clean.includes(pk))
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

        // Process movement data
        const movementJson = parseSheet(workbook.Sheets[movementSheetName] || workbook.Sheets[workbook.SheetNames[0]]);
        const movements: ProcessedMovement[] = movementJson.map((row: any, index: number) => {
          const moveCode = String(getValFromRow(row, ['Movement Type', 'Mvt Type', 'MvT', 'Move ment Type', 'Mvtype']) || '').trim();
          // Prioritize Posting Date / Pstng Date strictly. Avoid greedy match with "Date" which might hit "Entry Date".
          // EXTRA STRICT: Prioritize 'Posting Date', 'Pstng Date', or 'Pst Date' ONLY.
          // This avoids accidentally picking up "Document Date" or "Entry Date".
          let rawDate = getValFromRow(row, ['Posting Date', 'Pstng Date', 'Pst Date']);
          if (!rawDate) {
            // Only fallback to "Date" if there is no explicit Posting column.
            rawDate = getValFromRow(row, ['Date']);
          }
          const qtyVal = getValFromRow(row, ['Quantity', 'Qty', 'Tonase', 'QTY PC']);

          if (!moveCode && !rawDate && !qtyVal) return null;

          const baseMoveInfo = getMovementInfo(moveCode || 'Unknown');
          let moveDescription = baseMoveInfo.description;
          let moveGroup = baseMoveInfo.group;
          const storageLocation = String(getValFromRow(row, ['Storage Location', 'SLoc', 'Store Loc', 'S.Loc', 'Storage Loc']) || '');
          const slocLower = storageLocation.trim().toLowerCase();

          if (moveCode === '311') {
            if (slocLower === '5ed4' || slocLower === '5n19') {
              moveDescription = 'TF Sloc Out';
              moveGroup = 'Keluar';
            } else if (slocLower === '5m16') {
              moveDescription = 'TF Sloc In';
              moveGroup = 'Masuk';
            }
          }

          // ─── Robust Timezone-Safe Date Parsing ───
          let dateStr: string = '';

          if (typeof rawDate === 'number') {
            // Excel numeric serial date (e.g. 46559)
            // Formula: Excel serial 0 = Jan 0, 1900 → base = Dec 31, 1899 = timestamp -2209161600000
            // Safer: use known anchor 25569 = Jan 1, 1970
            const msSinceEpoch = Math.round((rawDate - 25569) * 86400 * 1000);
            const d = new Date(msSinceEpoch);
            const y = d.getUTCFullYear();
            const m = String(d.getUTCMonth() + 1).padStart(2, '0');
            const dd = String(d.getUTCDate()).padStart(2, '0');
            dateStr = `${y}-${m}-${dd}`;
          } else if (rawDate instanceof Date) {
            // cellDates:true produced a Date object — ALWAYS use UTC components
            const y = rawDate.getUTCFullYear();
            const m = String(rawDate.getUTCMonth() + 1).padStart(2, '0');
            const dd = String(rawDate.getUTCDate()).padStart(2, '0');
            dateStr = `${y}-${m}-${dd}`;
          } else if (typeof rawDate === 'string' && rawDate.trim()) {
            const s = rawDate.replace(/[\r\n\s]+/g, ' ').trim();
            // Handle DD/MM/YYYY, DD.MM.YYYY, DD-MM-YYYY
            const dmyMatch = s.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})$/);
            // Handle YYYY-MM-DD or YYYY/MM/DD
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
              // Fallback: let JS parse but use UTC components
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

          // Build a canonical Date from the safe dateStr (UTC midnight)
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
            quantity: (() => {
              let q = parseNum(getValFromRow(row, ['Tonase', 'Total Quantity', 'Quantity', 'Total Weight', 'Berat']));
              if (moveGroup === 'Keluar' && q > 0) return -q;
              return q;
            })(),
            unitQuantity: parseNum(getValFromRow(row, ['QTY PC', 'Qty in Un. of Entry', 'Unit Qty', 'Qty Entry', 'Pcs'])),
            userName: String(getValFromRow(row, ['User name', 'User', 'Name', 'UName']) || ''),
            storageLocation: storageLocation,
            color: baseMoveInfo.color,
            movementStatus: (() => {
              const batch = String(getValFromRow(row, ['Batch', 'Batch Number']) || '');
              if (!batch) return 'Unknown';
              const firstThree = parseInt(batch.substring(0, 3));
              return !isNaN(firstThree) && firstThree >= 525 ? 'Fast' : 'Slow';
            })() as 'Fast' | 'Slow' | 'Unknown',
          };
        }).filter((item): item is ProcessedMovement => item !== null);

        // Process stock data (Sheet 2)
        let stocks: ProcessedStock[] = [];
        const stockJson = stockSheetName ? parseSheet(workbook.Sheets[stockSheetName]) : [];
        if (stockJson.length > 0) {
          stocks = stockJson.map((row: any) => {
            const rawSloc = String(getValFromRow(row, ['Sloc', 'Storage Location', 'Store Loc']) || '').trim();
            const originalStatus = String(getValFromRow(row, ['Status']) || 'Unknown').trim();
            
            // If Sloc is 5M17, treat it as a separate status "Sloc Penampungan"
            const isPenampungan = rawSloc.toLowerCase() === '5m17';
            const status = isPenampungan ? 'Sloc Penampungan' : originalStatus;
            
            return {
              status: status,
              sloc: isPenampungan ? 'Sloc Penampungan' : rawSloc,
              quantity: parseNum(getValFromRow(row, ['QTY', 'Quantity', 'Total QTY'])),
              tonnage: parseNum(getValFromRow(row, ['Tonase', 'Weight', 'Total Weight']))
            };
          }).filter(s => s.status !== 'Unknown' || s.quantity > 0 || s.tonnage > 0);
        }

        resolve({ movements, stocks });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

