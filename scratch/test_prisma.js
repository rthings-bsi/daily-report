const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const recentMovements = await prisma.movement.groupBy({
      by: ['dateStr', 'group'],
      _sum: {
        quantity: true,
      },
      orderBy: {
        dateStr: 'desc',
      },
      take: 20,
    });
    console.log(recentMovements);
  } catch(e) {
    console.error("Prisma error:", e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
