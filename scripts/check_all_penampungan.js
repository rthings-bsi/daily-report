const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Cek semua stockSummary records
  const allSummaries = await prisma.stockSummary.findMany();
  console.log('TOTAL stockSummary records:', allSummaries.length);
  
  const byStatus = {};
  for (const s of allSummaries) {
    byStatus[s.status] = (byStatus[s.status] || 0) + 1;
  }
  console.log('All by status:', JSON.stringify(byStatus, null, 2));
  
  // Cek rawStocks dari session yang mungkin punya data penampungan
  const sessions = await prisma.reportSession.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: { reportSessionId: true, dateStr: true, rawStocks: true }
  });
  
  for (const s of sessions) {
    if (s.rawStocks) {
      const stocks = JSON.parse(s.rawStocks);
      const penampungan = stocks.filter(function(st) {
        return (st.status || '').toLowerCase().includes('penampungan');
      });
      if (penampungan.length > 0) {
        console.log('\nSession ' + s.reportSessionId + ' (' + s.dateStr + '): ' + penampungan.length + ' penampungan stocks');
        console.log('Sample:', JSON.stringify(penampungan.slice(0, 2), null, 2));
      }
    }
  }
  
  // Also check settings for penampungan SLOCs
  const settings = await prisma.gudangSetting.findMany({
    where: { key: 'penampungan' }
  });
  console.log('\nPenampungan settings:');
  for (const s of settings) {
    console.log('  gudangId=' + s.gudangId + ':', s.value);
  }
  
  await prisma.$disconnect();
}
main().catch(console.error);
