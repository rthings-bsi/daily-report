const history = [
  { reportSessionId: '2', dateStr: '2026-06-16' },
  { reportSessionId: '1', dateStr: '2026-06-15' }
];

const startDate = '2026-06-15';
const endDate = '';

const targetDate = startDate || endDate;
const matchingSession = history.find(s => s.dateStr === targetDate)
                     || history.find(s => s.dateStr >= startDate && (!endDate || s.dateStr <= endDate));

console.log('Matching session ID:', matchingSession?.reportSessionId);
