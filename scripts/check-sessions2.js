const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sessions = await prisma.reportSession.findMany();
  console.log('Total sessions:', sessions.length);
  if (sessions.length > 0) {
    console.log('First session ID:', sessions[0].reportSessionId);
    console.log('Stats exists:', !!sessions[0].stats);
    console.log('RawMovements exists:', !!sessions[0].rawMovements);
    if (sessions[0].rawMovements) {
        console.log('RawMovements length:', JSON.parse(sessions[0].rawMovements).length);
    }
  }
}

main().finally(() => prisma.$disconnect());
