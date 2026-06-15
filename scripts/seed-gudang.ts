import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding 14 Gudangs...');
  for (let i = 1; i <= 14; i++) {
    const prefix = '5' + String.fromCharCode(64 + i);
    await prisma.gudang.upsert({
      where: { gudangId: i },
      update: {},
      create: {
        gudangId: i,
        name: `Gudang ${i}`,
        prefix,
      },
    });
  }
  console.log('Done seeding gudangs.');

  console.log('Backfilling ReportSessions...');
  const result = await prisma.reportSession.updateMany({
    where: { gudangId: null },
    data: { gudangId: 1 },
  });
  console.log(`Backfilled ${result.count} sessions to Gudang 1.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
