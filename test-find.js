const history = [
  { reportSessionId: 'B', dateStr: '2026-06-16', gudangId: 2 },
  { reportSessionId: 'A', dateStr: '2026-06-16', gudangId: 13 }
];

const selectedGudang = 13;
const targetDate = '2026-06-16';

let matchingSession = history.find(s => s.dateStr === targetDate && s.gudangId === selectedGudang)
                   || history.find(s => s.dateStr === targetDate && s.gudangId === null)
                   || history.find(s => s.dateStr === targetDate);

console.log(matchingSession.reportSessionId); // Should be A
