const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  // Test 1: Cari sessions yang mungkin dimuat oleh API aggregate saat admin tanpa filter
  const sessions = await prisma.reportSession.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      reportSessionId: true,
      gudangId: true,
      dateStr: true,
      label: true,
      createdAt: true,
    }
  });
  console.log("All sessions:", sessions.length);
  for (const s of sessions) {
    console.log(`  ${s.reportSessionId} | gudangId=${s.gudangId} | date=${s.dateStr} | label=${s.label}`);
  }
  
  // Test 2: Fetch rawMovements dari session global (gudangId=null) 
  const globalSessions = sessions.filter(s => s.gudangId === null);
  console.log("\nGlobal sessions (gudangId=null):", globalSessions.length);
  
  // Test 3: Fetch rawMovements JSON
  if (globalSessions.length > 0) {
    const session = await prisma.reportSession.findUnique({
      where: { reportSessionId: globalSessions[0].reportSessionId },
      select: { rawMovements: true, stats: true, stockCards: true }
    });
    if (session && session.rawMovements) {
      const rawMvts = JSON.parse(session.rawMovements);
      console.log("\nrawMovements count:", rawMvts.length);
      console.log("Sample keys:", Object.keys(rawMvts[0]));
      
      // Group distribution
      const groups = {};
      for (const m of rawMvts) {
        groups[m.group] = (groups[m.group] || 0) + 1;
      }
      console.log("Group distribution:", groups);
      
      // Check if 'group' is truly 'Masuk' (not "masuk" or something else)
      const masukSample = rawMvts.find(m => m.group === 'Masuk');
      if (masukSample) {
        console.log("\nSample Masuk movement:");
        console.log(JSON.stringify(masukSample, null, 2));
      }
      
      // Check stats
      if (session.stats) {
        console.log("\nStats:", session.stats);
      }
    }
  }
}

test().catch(console.error).finally(()=>prisma.$disconnect());
