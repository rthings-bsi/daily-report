// A simple script to reproduce the filtering logic locally to find the bug
const movements = [
  { movementId: '1', dateStr: '2023-01-01', moveType: '101', userName: 'gudang1' },
  { movementId: '2', dateStr: '2023-01-02', moveType: '101', userName: 'gudang1' },
  { movementId: '3', dateStr: '2023-01-03', moveType: '101', userName: 'gudang2' }
];

const movementSummaries = [
  { movementSummaryId: '1', dateStr: '2023-01-01', moveType: '101', totalQuantity: 10 },
  { movementSummaryId: '2', dateStr: '2023-01-02', moveType: '101', totalQuantity: 20 },
  { movementSummaryId: '3', dateStr: '2023-01-03', moveType: '101', totalQuantity: 30 }
];

const selectedGudang = null;
const startDate = '2023-01-01';
const endDate = '2023-01-02';

// The logic from app/page.tsx:
const chartMovements = (() => {
  if (!selectedGudang && !startDate && !endDate && movementSummaries && movementSummaries.length > 0) {
    return movementSummaries.map(s => ({
      dateStr: s.dateStr,
      quantity: s.totalQuantity,
      // ... mapping other fields
    }));
  }
  // Fallback to filteredMovements
  let result = movements;
  if (startDate) result = result.filter(m => m.dateStr >= startDate);
  if (endDate) result = result.filter(m => m.dateStr <= endDate);
  return result;
})();

console.log('chartMovements length:', chartMovements.length);
console.log('chartMovements dates:', chartMovements.map(m => m.dateStr));
