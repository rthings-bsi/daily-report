import {
  ProcessedMovement,
  ProcessedStock,
  StockCardItem,
  MovementStats,
} from "./excel-parser";

/**
 * Row shape for the MovementSummary table.
 * Mirrors the Prisma model — all writes use this exact field set.
 */
export interface MovementSummaryRow {
  dateStr: string;
  moveType: string;
  description: string;
  workCenter: string | null;
  group: string;
  color: string;
  totalQuantity: number;
  totalUnitQuantity: number;
  totalCount: number;
}

/**
 * Row shape for the StockSummary table.
 * Sums the ProcessedStock array by (sloc, status) so the dashboard cards
 * can read pre-aggregated Fast/Slow/Penampungan counts without re-iterating.
 * totalWeight is in KG — the display layer divides by 1000 for "ton".
 */
export interface StockSummaryRow {
  sloc: string;
  status: string;
  totalUnitQty: number;
  totalWeight: number;
  itemCount: number;
}

/**
 * Shape stored in the rawMovements JSON column.
 * Matches the projection that has been in POST since the aggregation refactor.
 */
export interface RawMovementRow {
  dateStr: string;
  moveType: string;
  description: string;
  material: string | null;
  workCenter: string | null;
  batch: string | null;
  storageLocation: string | null;
  quantity: number;
  unitQuantity: number;
  group: string;
  color: string;
  userName: string | null;
}

/**
 * Composite dedup key for material movements.
 * Fields that together uniquely identify a SAP material movement
 * (material document) within the same day:
 *   dateStr + moveType + material + batch + quantity + userName + workCenter + storageLocation
 */
export function movementDedupKey(m: RawMovementRow): string {
  return [
    m.dateStr,
    m.moveType,
    m.material ?? '',
    m.batch ?? '',
    m.quantity,
    m.userName ?? '',
    m.workCenter ?? '',
    m.storageLocation ?? '',
  ].join('|');
}

/**
 * Deduplicate an array of RawMovementRow by composite key.
 * First occurrence wins (keeps the earliest-seen copy).
 */
export function deduplicateMovements(rows: RawMovementRow[]): RawMovementRow[] {
  const seen = new Set<string>();
  const result: RawMovementRow[] = [];
  for (const r of rows) {
    const key = movementDedupKey(r);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(r);
  }
  return result;
}

/**
 * Dedup stocks by sloc + status + quantity + tonnage.
 */
export function deduplicateStocks(stocks: any[]): any[] {
  const seen = new Set<string>();
  const result: any[] = [];
  for (const s of stocks) {
    const key = [s.sloc ?? '', s.status ?? '', s.quantity ?? 0, s.tonnage ?? 0].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(s);
  }
  return result;
}

export interface AggregatedSession {
  movementSummaries: MovementSummaryRow[];
  stockSummaries: StockSummaryRow[];
  rawMovements: RawMovementRow[];
  rawStocks: ProcessedStock[];
  stats: MovementStats;
  stockCardsJson: string | null;
}

interface AggregateArgs {
  movements: ProcessedMovement[];
  stocks: ProcessedStock[];
  stockCards?: StockCardItem[];
}

/**
 * Pure aggregation — no DB I/O, no side effects.
 *
 * Used by all 4 save routes (manual POST + 3 SAP) AND the backfill script.
 * Centralising this means a fresh upload and a backfilled legacy session
 * produce byte-identical summary rows and JSON.
 */
export function aggregateSessionData(args: AggregateArgs): AggregatedSession {
  const { movements, stocks, stockCards } = args;

  // ── 1) MovementSummary — key = dateStr|moveType|workCenter|group|color ──
  const summaryMap = new Map<string, MovementSummaryRow>();
  for (const m of movements) {
    const key = `${m.dateStr}|${m.moveType}|${m.workCenter || ""}|${m.group}|${m.color}`;
    const ex = summaryMap.get(key);
    if (ex) {
      ex.totalQuantity += m.quantity;
      ex.totalUnitQuantity += m.unitQuantity || 0;
      ex.totalCount += 1;
    } else {
      summaryMap.set(key, {
        dateStr: m.dateStr,
        moveType: m.moveType,
        description: m.description,
        workCenter: m.workCenter || null,
        group: m.group,
        color: m.color,
        totalQuantity: m.quantity,
        totalUnitQuantity: m.unitQuantity || 0,
        totalCount: 1,
      });
    }
  }

  // ── 2) Pre-calculated KPI stats (matches calculateStats() in excel-parser) ──
  let totalIncoming = 0;
  let totalOutgoing = 0;
  let incomingCount = 0;
  let outgoingCount = 0;
  for (const m of movements) {
    if (m.group === "Masuk") {
      totalIncoming += m.quantity;
      incomingCount += 1;
    } else if (m.group === "Keluar") {
      totalOutgoing += Math.abs(m.quantity); // keep abs to match the existing StatsCard semantics
      outgoingCount += 1;
    }
  }
  const stats: MovementStats = {
    totalIncoming,
    totalOutgoing,
    netMovement: totalIncoming - totalOutgoing,
    incomingCount,
    outgoingCount,
    totalCount: movements.length,
  };

  // ── 3) rawMovements projection (exact shape stored in JSON column) ──
  const rawMovements: RawMovementRow[] = movements.map((m) => ({
    dateStr: m.dateStr,
    moveType: m.moveType,
    description: m.description,
    material: m.material ?? null,
    workCenter: m.workCenter || null,
    batch: m.batch || null,
    storageLocation: m.storageLocation || null,
    quantity: m.quantity,
    unitQuantity: m.unitQuantity ?? 0,
    group: m.group,
    color: m.color,
    userName: m.userName || null,
  }));

  // ── 4) StockSummary — key = sloc|status ──
  // status is set to "Sloc Penampungan" by the parser when SLOC is in the
  // user's penampungan list, so this naturally buckets penampungan rows.
  const stockSummaryMap = new Map<string, StockSummaryRow>();
  for (const s of stocks) {
    const sloc = s.sloc || "";
    const status = s.status || "Unknown";
    const key = `${sloc}|${status}`;
    const ex = stockSummaryMap.get(key);
    if (ex) {
      ex.totalUnitQty += s.quantity || 0;
      ex.totalWeight += s.tonnage || 0;
      ex.itemCount += 1;
    } else {
      stockSummaryMap.set(key, {
        sloc,
        status,
        totalUnitQty: s.quantity || 0,
        totalWeight: s.tonnage || 0,
        itemCount: 1,
      });
    }
  }

  // ── 5) stockCards — pass through as JSON, or null when absent ──
  const stockCardsJson =
    stockCards && stockCards.length > 0 ? JSON.stringify(stockCards) : null;

  return {
    movementSummaries: Array.from(summaryMap.values()),
    stockSummaries: Array.from(stockSummaryMap.values()),
    rawMovements,
    rawStocks: stocks,
    stats,
    stockCardsJson,
  };
}
