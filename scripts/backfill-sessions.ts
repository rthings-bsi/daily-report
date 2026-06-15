/**
 * Backfill script for legacy sessions.
 *
 * Finds every ReportSession that predates the optimization refactor
 * (no `stats` / `rawMovements` JSON columns) and migrates it to the
 * new aggregate path:
 *   Movement[] rows      → MovementSummary[] + rawMovements JSON
 *   Stock[] rows         → StockSummary[]   + rawStocks JSON
 *   computed             → stats JSON
 *
 * Same `aggregateSessionData()` helper the 4 save routes use, so a
 * backfilled session is byte-identical to a fresh upload.
 *
 * Run:
 *   npx tsx scripts/backfill-sessions.ts --dry-run          # inspect counts only
 *   npx tsx scripts/backfill-sessions.ts                    # migrate (legacy rows kept)
 *   npx tsx scripts/backfill-sessions.ts --purge-legacy     # ALSO delete Movement[]/Stock[]
 *
 * Prereqs:
 *   - npm i -D tsx
 *   - Rename migration (prisma/migrations/20260604000001_rename_ids/migration.sql)
 *     must already be applied to the target DB.
 *   - New schema (StockSummary model + indexes) must be pushed.
 */
import { PrismaClient } from '@prisma/client';
import { aggregateSessionData } from '../lib/aggregation';
import type { ProcessedMovement, ProcessedStock } from '../lib/excel-parser';

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');
const PURGE_LEGACY = process.argv.includes('--purge-legacy');
const BATCH = 50;

async function main() {
  const sessions = await prisma.reportSession.findMany({
    where: { OR: [{ stats: null }, { rawMovements: null }] },
    orderBy: { createdAt: 'asc' },
    select: { reportSessionId: true, label: true, createdAt: true },
  });

  const mode = `${DRY_RUN ? 'DRY RUN' : 'WRITE'}${PURGE_LEGACY ? ' + PURGE LEGACY' : ''}`;
  console.log(`[backfill] Found ${sessions.length} session(s) needing migration (${mode})`);

  if (sessions.length === 0) {
    console.log('[backfill] Nothing to do.');
    return;
  }

  if (PURGE_LEGACY && !DRY_RUN) {
    console.log('');
    console.log('  ╭──────────────────────────────────────────────────────────╮');
    console.log('  │  WARNING: --purge-legacy will DELETE the original       │');
    console.log('  │  Movement[] and Stock[] rows for every migrated session. │');
    console.log('  │  This is irreversible without a database backup.         │');
    console.log('  ╰──────────────────────────────────────────────────────────╯');
    console.log('');
  }

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < sessions.length; i += BATCH) {
    const slice = sessions.slice(i, i + BATCH);
    await Promise.all(
      slice.map(async (s) => {
        try {
          await migrateOne(s.reportSessionId, s.label);
          ok += 1;
        } catch (e) {
          fail += 1;
          console.error(`[backfill] FAIL ${s.reportSessionId} "${s.label}":`, e);
        }
      }),
    );
    const done = Math.min(i + BATCH, sessions.length);
    console.log(`[backfill] progress: ${done}/${sessions.length} ok=${ok} fail=${fail}`);
  }

  console.log(`[backfill] DONE ok=${ok} fail=${fail}${DRY_RUN ? ' (no writes performed)' : ''}`);
}

/**
 * Migrate a single session. Wrapped in a transaction so partial writes
 * never leave the session in a half-migrated state.
 */
async function migrateOne(reportSessionId: string, label: string): Promise<void> {
  // 1) Read legacy rows
  const [movementRows, stockRows] = await Promise.all([
    prisma.movement.findMany({ where: { reportSessionId } }),
    prisma.stock.findMany({ where: { reportSessionId } }),
  ]);

  // 2) Project legacy Movement rows → ProcessedMovement shape
  //    (matches what the new-session GET branch synthesizes for rawMovements)
  const movements: ProcessedMovement[] = movementRows.map((m) => ({
    movementId: m.movementId,
    postingDate: m.postingDate,
    dateStr: m.dateStr,
    moveType: m.moveType,
    description: m.description,
    group: m.group as ProcessedMovement['group'],
    workCenter: m.workCenter ?? '',
    batch: m.batch ?? '',
    quantity: m.quantity,
    unitQuantity: m.unitQuantity,
    userName: m.userName ?? '',
    storageLocation: m.storageLocation ?? '',
    color: m.color,
    movementStatus: 'Unknown',
    material: undefined,
  }));

  // 3) Project legacy Stock rows → ProcessedStock shape
  //    (must match the legacy GET branch in [reportSessionId]/route.ts:67-72)
  const stocks: ProcessedStock[] = stockRows.map((s) => ({
    status: s.material,
    sloc: s.sloc ?? '',
    quantity: s.unitQty,
    tonnage: s.weight,
  }));

  // 4) Run the SAME helper the 4 save routes use
  const { movementSummaries, stockSummaries, rawMovements, rawStocks, stats, stockCardsJson } =
    aggregateSessionData({ movements, stocks, stockCards: [] });

  if (DRY_RUN) {
    console.log(
      `[dry-run] ${reportSessionId} "${label}" ` +
        `→ MS=${movementSummaries.length} SS=${stockSummaries.length} ` +
        `rawMoves=${rawMovements.length} rawStocks=${rawStocks.length}`,
    );
    return;
  }

  // 5) Atomic write — defensive delete + createMany + update + optional purge
  await prisma.$transaction(async (tx) => {
    // Defensive: a previous crashed run may have left partial rows
    await tx.movementSummary.deleteMany({ where: { reportSessionId } });
    await tx.stockSummary.deleteMany({ where: { reportSessionId } });

    // createMany needs the FK on each row (the helper keeps it session-agnostic
    // so it can be shared with the nested-create route path).
    if (movementSummaries.length > 0) {
      await tx.movementSummary.createMany({
        data: movementSummaries.map((row) => ({ ...row, reportSessionId })),
      });
    }
    if (stockSummaries.length > 0) {
      await tx.stockSummary.createMany({
        data: stockSummaries.map((row) => ({ ...row, reportSessionId })),
      });
    }

    await tx.reportSession.update({
      where: { reportSessionId },
      data: {
        stats: JSON.stringify(stats),
        rawMovements: JSON.stringify(rawMovements),
        rawStocks: JSON.stringify(rawStocks),
        stockCards: stockCardsJson,
      },
    });

    if (PURGE_LEGACY) {
      await tx.movement.deleteMany({ where: { reportSessionId } });
      await tx.stock.deleteMany({ where: { reportSessionId } });
    }
  });
}

main()
  .catch((e) => {
    console.error('[backfill] FATAL:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
