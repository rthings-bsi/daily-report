import { getMovementInfo } from './sap-mapping';
import { getShiftFromTime, getOperationalDateStr } from './excel-parser';

export type RepairPackingCategory = 'REPAIR' | 'PACKING';

export interface RepairPackingItem {
  id: string;
  sessionId: string;
  dateStr: string;
  operationalDate: string;
  entryDate?: string;
  entryTime?: string;
  shift?: number;
  gudangId?: number | null;
  workCenter: string;
  category: RepairPackingCategory;
  moveType: string;
  description: string;
  material: string;
  batch: string;
  storageLocation: string;
  quantity: number;
  unitQuantity: number;
  group: 'Masuk' | 'Keluar' | 'Transfer';
  color: string;
  userName: string;
}

export interface RepairPackingMetrics {
  totalRecords: number;
  totalPcsIn: number;
  totalKgIn: number;
  totalTonIn: number;
  totalPcsOut: number;
  totalKgOut: number;
  totalTonOut: number;
  netPcs: number;
  netTon: number;
  ratioPct: number;
}

export interface WorkCenterBreakdownItem {
  workCenter: string;
  category: RepairPackingCategory;
  records: number;
  pcsIn: number;
  kgIn: number;
  tonIn: number;
  pcsOut: number;
  kgOut: number;
  tonOut: number;
  netTon: number;
}

export interface MoveTypeBreakdownItem {
  moveType: string;
  description: string;
  group: string;
  color: string;
  records: number;
  pcs: number;
  kg: number;
  ton: number;
}

export interface DailyTrendItem {
  date: string;
  masuk: number;
  keluar: number;
  net: number;
}

export function isRepairPackingWorkCenter(wc: string | null | undefined): boolean {
  if (!wc) return false;
  const u = wc.trim().toUpperCase();
  return u.startsWith('MP') || u.startsWith('M&P') || u.startsWith('REP');
}

export function getWorkCenterCategory(wc: string | null | undefined): RepairPackingCategory {
  if (!wc) return 'PACKING';
  const u = wc.trim().toUpperCase();
  return u.startsWith('REP') ? 'REPAIR' : 'PACKING';
}

export function parseRawMovementToRepairPackingItem(
  raw: Record<string, unknown>,
  sessionId: string,
  sessionGudangId: number | null,
  sessionDateStr: string,
  idx: number
): RepairPackingItem | null {
  const wc = typeof raw.workCenter === 'string' ? raw.workCenter.trim() : '';
  if (!isRepairPackingWorkCenter(wc)) return null;

  const dateStr = typeof raw.dateStr === 'string' ? raw.dateStr : sessionDateStr;
  const entryDate = typeof raw.entryDate === 'string' ? raw.entryDate : dateStr;
  const entryTime = typeof raw.entryTime === 'string' ? raw.entryTime : undefined;
  const operationalDate = entryTime ? getOperationalDateStr(entryDate, entryTime) : dateStr;
  const shift = typeof raw.shift === 'number' ? raw.shift : (entryTime ? getShiftFromTime(entryTime) : undefined);
  const moveType = typeof raw.moveType === 'string' ? raw.moveType : '';
  const info = getMovementInfo(moveType);
  const category = getWorkCenterCategory(wc);

  const rawQty = typeof raw.quantity === 'number' ? raw.quantity : (typeof raw.quantity === 'string' ? parseFloat(raw.quantity) || 0 : 0);
  const rawUnitQty = typeof raw.unitQuantity === 'number' ? raw.unitQuantity : (typeof raw.unitQuantity === 'string' ? parseFloat(raw.unitQuantity) || 0 : 0);

  return {
    id: typeof raw.movementId === 'string' ? raw.movementId : `${sessionId}-${idx}`,
    sessionId,
    dateStr,
    operationalDate,
    entryDate,
    entryTime,
    shift,
    gudangId: sessionGudangId,
    workCenter: wc,
    category,
    moveType,
    description: typeof raw.description === 'string' && raw.description ? raw.description : info.description,
    material: typeof raw.material === 'string' ? raw.material : '',
    batch: typeof raw.batch === 'string' ? raw.batch : '',
    storageLocation: typeof raw.storageLocation === 'string' ? raw.storageLocation : '',
    quantity: rawQty,
    unitQuantity: rawUnitQty,
    group: ((typeof raw.group === 'string' ? raw.group : info.group) || 'Transfer') as 'Masuk' | 'Keluar' | 'Transfer',
    color: typeof raw.color === 'string' ? raw.color : info.color,
    userName: typeof raw.userName === 'string' ? raw.userName : '',
  };
}

export function calculateRepairPackingMetrics(items: RepairPackingItem[]): {
  metrics: RepairPackingMetrics;
  byWorkCenter: WorkCenterBreakdownItem[];
  byMoveType: MoveTypeBreakdownItem[];
  dailyTrend: DailyTrendItem[];
} {
  let totalPcsIn = 0;
  let totalKgIn = 0;
  let totalPcsOut = 0;
  let totalKgOut = 0;

  const wcMap = new Map<string, {
    category: RepairPackingCategory;
    records: number;
    pcsIn: number;
    kgIn: number;
    pcsOut: number;
    kgOut: number;
  }>();

  const mvtMap = new Map<string, {
    description: string;
    group: string;
    color: string;
    records: number;
    pcs: number;
    kg: number;
  }>();

  const dateMap = new Map<string, { masuk: number; keluar: number }>();

  for (const item of items) {
    const isMasuk = item.group === 'Masuk' || item.moveType === '101' || item.moveType === '262';
    const absPcs = Math.abs(item.unitQuantity);
    const absKg = Math.abs(item.quantity);

    if (isMasuk) {
      totalPcsIn += absPcs;
      totalKgIn += absKg;
    } else {
      totalPcsOut += absPcs;
      totalKgOut += absKg;
    }

    // Work center accumulation
    if (!wcMap.has(item.workCenter)) {
      wcMap.set(item.workCenter, {
        category: item.category,
        records: 0,
        pcsIn: 0,
        kgIn: 0,
        pcsOut: 0,
        kgOut: 0,
      });
    }
    const wcEntry = wcMap.get(item.workCenter)!;
    wcEntry.records += 1;
    if (isMasuk) {
      wcEntry.pcsIn += absPcs;
      wcEntry.kgIn += absKg;
    } else {
      wcEntry.pcsOut += absPcs;
      wcEntry.kgOut += absKg;
    }

    // Movement type accumulation
    const mvtKey = item.moveType || 'OTHER';
    if (!mvtMap.has(mvtKey)) {
      mvtMap.set(mvtKey, {
        description: item.description,
        group: item.group,
        color: item.color,
        records: 0,
        pcs: 0,
        kg: 0,
      });
    }
    const mvtEntry = mvtMap.get(mvtKey)!;
    mvtEntry.records += 1;
    mvtEntry.pcs += absPcs;
    mvtEntry.kg += absKg;

    // Daily trend accumulation
    const dKey = item.operationalDate;
    if (!dateMap.has(dKey)) {
      dateMap.set(dKey, { masuk: 0, keluar: 0 });
    }
    const dEntry = dateMap.get(dKey)!;
    if (isMasuk) dEntry.masuk += absKg;
    else dEntry.keluar += absKg;
  }

  const totalTonIn = totalKgIn / 1000;
  const totalTonOut = totalKgOut / 1000;
  const netPcs = totalPcsIn - totalPcsOut;
  const netTon = totalTonIn - totalTonOut;
  const ratioPct = totalKgOut > 0 ? (totalKgIn / totalKgOut) * 100 : 0;

  const byWorkCenter: WorkCenterBreakdownItem[] = Array.from(wcMap.entries())
    .map(([wc, v]) => ({
      workCenter: wc,
      category: v.category,
      records: v.records,
      pcsIn: v.pcsIn,
      kgIn: v.kgIn,
      tonIn: v.kgIn / 1000,
      pcsOut: v.pcsOut,
      kgOut: v.kgOut,
      tonOut: v.kgOut / 1000,
      netTon: (v.kgIn - v.kgOut) / 1000,
    }))
    .sort((a, b) => (b.kgIn + b.kgOut) - (a.kgIn + a.kgOut));

  const byMoveType: MoveTypeBreakdownItem[] = Array.from(mvtMap.entries())
    .map(([mvt, v]) => ({
      moveType: mvt,
      description: v.description,
      group: v.group,
      color: v.color,
      records: v.records,
      pcs: v.pcs,
      kg: v.kg,
      ton: v.kg / 1000,
    }))
    .sort((a, b) => b.kg - a.kg);

  const dailyTrend: DailyTrendItem[] = Array.from(dateMap.entries())
    .map(([date, v]) => ({
      date,
      masuk: v.masuk / 1000,
      keluar: v.keluar / 1000,
      net: (v.masuk - v.keluar) / 1000,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    metrics: {
      totalRecords: items.length,
      totalPcsIn,
      totalKgIn,
      totalTonIn,
      totalPcsOut,
      totalKgOut,
      totalTonOut,
      netPcs,
      netTon,
      ratioPct,
    },
    byWorkCenter,
    byMoveType,
    dailyTrend,
  };
}
