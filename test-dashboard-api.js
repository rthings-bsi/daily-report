const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const sessions = await prisma.reportSession.findMany({
    take: 2
  });
  console.log('Sessions found:', sessions.length);
}
test().catch(console.error);
