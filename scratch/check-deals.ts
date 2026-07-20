import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const allDeals = await prisma.deal.count();
  const recentDeals = await prisma.deal.count({ where: { createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) } } });
  const publishedMain = await prisma.deal.count({ where: { isPublished: true, createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) } } });
  const publishedHostel = await prisma.deal.count({ where: { isPublishedHostel: true, createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) } } });
  console.log(`Total deals: ${allDeals}`);
  console.log(`Last 48h deals: ${recentDeals}`);
  console.log(`Last 48h published (main): ${publishedMain}`);
  console.log(`Last 48h published (hostel): ${publishedHostel}`);
}
main().finally(() => prisma.$disconnect());
