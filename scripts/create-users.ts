import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('123456', 10)
  
  console.log('Membuat akun gudang1 hingga gudang14...')
  
  for (let i = 1; i <= 14; i++) {
    const username = `gudang${i}`
    
    // Upsert will create or update the user
    await prisma.user.upsert({
      where: { username },
      update: {
        password: passwordHash,
        role: 'user',
        gudangId: i
      },
      create: {
        username,
        password: passwordHash,
        role: 'user',
        gudangId: i
      }
    })
    
    console.log(`✅ Berhasil membuat/mengupdate: ${username} (Gudang ${i})`)
  }
  
  console.log('Selesai!')
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
