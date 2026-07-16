import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const channels = await prisma.telegramChannel.findMany();
  console.log('Channels:', JSON.stringify(channels, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
