
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const sessions = await prisma.reportSession.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        reportSessionId: true,
        gudangId: true,
        dateStr: true,
        label: true,
        createdAt: true,
        stats: true,
        stockCards: true,
        movementSummaries: true,
        stockSummaries: true
      },
    });
    console.log("Sessions count:", sessions.length);
    if(sessions.length > 0) {
        console.log("Stats sample:", sessions[0].stats);
        console.log("MovementSummaries count:", sessions[0].movementSummaries.length);
    }
}
main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
