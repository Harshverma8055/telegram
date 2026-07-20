import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const platforms = await prisma.platform.findMany();
  for (const pl of platforms) {
    const count = await prisma.deal.count({ where: { platformId: pl.id } });
    console.log(`${pl.slug}: ${count} deals total`);
  }
  console.log('CUELINKS_API_KEY set:', !!process.env.CUELINKS_API_KEY);
  await prisma.$disconnect();
}
check();
