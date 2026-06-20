const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const session = await prisma.reportSession.findFirst({
    where: { gudangId: null },
    orderBy: { createdAt: 'desc' }
  });
  if (!session) return console.log("No global session found.");
  
  console.log("Session ID:", session.reportSessionId);
  const rawMovements = JSON.parse(session.rawMovements || "[]");
  console.log(`Found ${rawMovements.length} raw movements.`);
  
  if (rawMovements.length > 0) {
    console.log("Sample of first raw movement:");
    console.log(JSON.stringify(rawMovements[0], null, 2));
    
    // Check group distribution
    const groups = {};
    rawMovements.forEach(m => {
      groups[m.group] = (groups[m.group] || 0) + 1;
    });
    console.log("Group distribution:", groups);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
