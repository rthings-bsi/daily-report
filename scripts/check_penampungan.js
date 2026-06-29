const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const summaries = await prisma.stockSummary.findMany({ take: 50 });
  console.log('Total StockSummary records:', summaries.length);
  
  const byStatus = {};
  for (const s of summaries) {
    byStatus[s.status] = (byStatus[s.status] || 0) + 1;
  }
  console.log('By status:', JSON.stringify(byStatus, null, 2));
  
  // Check if any StockSummary exists for each status
  const fast = summaries.filter(s => s.status === 'Fast Moving');
  console.log('\nFast Moving records:', fast.length);
  
  const slow = summaries.filter(s => s.status === 'Slow Moving');
  console.log('Slow Moving records:', slow.length);
  
  const penampungan = summaries.filter(s => s.status === 'Sloc Penampungan');
  console.log('Sloc Penampungan records:', penampungan.length);
  
  if (penampungan.length > 0) {
    console.log('Sample penampungan:', JSON.stringify(penampungan[0], null, 2));
  }
  
  // Also check rawStocks in ReportSession
  const sessions = await prisma.reportSession.findMany({ 
    take: 3, 
    orderBy: { createdAt: 'desc' },
    select: { reportSessionId: true, dateStr: true, gudangId: true }
  });
  console.log('\nRecent sessions:', JSON.stringify(sessions, null, 2));
  
  await prisma.$disconnect();
}
main();
