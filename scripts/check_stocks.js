const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Cek rawStocks dari session terbaru
  const session = await prisma.reportSession.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { reportSessionId: true, dateStr: true, gudangId: true, rawStocks: true }
  });
  
  if (!session) { console.log('No session found'); return; }
  console.log('Session:', session.reportSessionId, session.dateStr, 'gudangId:', session.gudangId);
  
  if (session.rawStocks) {
    const stocks = JSON.parse(session.rawStocks);
    console.log('Total raw stocks:', stocks.length);
    
    // Cek status distribution
    const byStatus = {};
    const bySloc = {};
    for (const s of stocks) {
      byStatus[s.status || 'NO_STATUS'] = (byStatus[s.status || 'NO_STATUS'] || 0) + 1;
      const sloc = s.sloc || s.storageLocation || 'NO_SLOC';
      bySloc[sloc] = (bySloc[sloc] || 0) + 1;
    }
    console.log('By status:', JSON.stringify(byStatus, null, 2));
    
    // Cari yg sloc nya ada prefix penampungan
    const slocKeys = Object.keys(bySloc).sort();
    console.log('All SLOCs:', JSON.stringify(slocKeys));
    
    // Cari apapun yg status atau sloc mengandung "penampungan" / "tampung"
    const penampunganRelated = stocks.filter(s => {
      const sloc = (s.sloc || s.storageLocation || '').toLowerCase();
      const status = (s.status || '').toLowerCase();
      return sloc.includes('tampung') || status.includes('tampung');
    });
    console.log(`\nPenampungan-related stocks: ${penampunganRelated.length}`);
    if (penampunganRelated.length > 0) {
      console.log('Sample:', JSON.stringify(penampunganRelated.slice(0, 3), null, 2));
    }
  }
  
  await prisma.$disconnect();
}
main();
