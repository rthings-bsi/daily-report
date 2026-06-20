const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sessions = await prisma.reportSession.findMany({
    select: { gudangId: true, label: true, reportSessionId: true }
  });
  console.log(JSON.stringify(sessions, null, 2));
}

main().finally(() => prisma.$disconnect());
