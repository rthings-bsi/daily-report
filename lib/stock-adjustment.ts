import { StockReportSummary } from '@/components/StockReport';
import { ProcessedMovement, ProcessedStock } from '@/lib/excel-parser';
import { isPenampunganSloc } from './gudang';

export function adjustStockSummaryWithMovements(
  baseSummary: StockReportSummary | undefined,
  baseStocks: ProcessedStock[],
  movements: ProcessedMovement[]
): StockReportSummary | undefined {
  // Jika baseSummary kosong dan baseStocks juga kosong, tidak ada baseline yang bisa di-adjust.
  if (!baseSummary && baseStocks.length === 0) return undefined;

  // Build baseline dari summaryProp (kalo mode aggregate) ATAU dari raw stocks
  const result: StockReportSummary = baseSummary ? JSON.parse(JSON.stringify(baseSummary)) : {
    fast: { count: 0, totalTon: 0 },
    slow: { count: 0, totalTon: 0 },
    penampungan: { count: 0, totalTon: 0 }
  };

  // Kalo baseSummary GAK ada tapi ada raw stocks, kita build manual
  if (!baseSummary && baseStocks.length > 0) {
    for (const s of baseStocks) {
      const isPenampungan = isPenampunganSloc(s.sloc) || s.status === 'Sloc Penampungan';
      const ton = (s.tonnage || 0) / 1000;
      if (isPenampungan) {
        result.penampungan.count += 1;
        result.penampungan.totalTon += ton;
      } else if (s.status === 'Fast Moving') {
        result.fast.count += 1;
        result.fast.totalTon += ton;
      } else if (s.status === 'Slow Moving') {
        result.slow.count += 1;
        result.slow.totalTon += ton;
      }
    }
  }

  // Adjustment logic berdasar data Movement In / Out
  for (const mov of movements) {
    const isPenampungan = isPenampunganSloc(mov.storageLocation);
    // Tentukan kategori dari pergerakan ini (fast/slow DB parser atau penampungan)
    let category: 'fast' | 'slow' | 'penampungan' | null = null;

    if (isPenampungan) {
      category = 'penampungan';
    } else if (mov.movementStatus === 'Fast') {
      category = 'fast';
    } else if (mov.movementStatus === 'Slow') {
      category = 'slow';
    }

    if (category) {
      const isOut = mov.group === 'Keluar'; // Kurangi stok
      const isIn = mov.group === 'Masuk';   // Nambah stok

      const ton = (mov.quantity || 0) / 1000;
      const count = mov.unitQuantity || 0; // batang/item

      if (isIn) {
        result[category].count += count;
        result[category].totalTon += ton;
      } else if (isOut) {
        result[category].count -= count;
        result[category].totalTon -= ton;

        // Jaga agar nilai tidak negatif kalo datanya minus dari sistem luar
        if (result[category].count < 0) result[category].count = 0;
        if (result[category].totalTon < 0) result[category].totalTon = 0;
      }
    }
  }

  return result;
}