import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const sessions = await prisma.reportSession.findMany({ select: { dateStr: true }, take: 5 })
  console.log(sessions)
}
main().finally(() => prisma.$disconnect())
