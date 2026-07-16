import prisma from './lib/prisma';
import { fetchFullAmazonProductDetails, calculateScores } from './lib/scrapers/amazon-research';

async function main() {
  // Test ASIN for a high-quality product: iPhone case or similar
  const testAsin = 'B0D5NFR15K'; // Spigen clear case
  console.log(`🚀 Testing fetchFullAmazonProductDetails for ASIN: ${testAsin}...`);
  
  const details = await fetchFullAmazonProductDetails(testAsin);
  if (!details) {
    console.error('❌ Failed to fetch product details.');
    return;
  }
  
  console.log('✅ Successfully fetched details:', {
    title: details.title,
    price: details.price,
    mrp: details.mrp,
    discount: details.discount,
    image: details.image,
    rating: details.rating,
    reviewCount: details.reviewCount
  });

  console.log('📊 Calculating scores for category "Mobile Accessories"...');
  const scores = calculateScores(details, 'Mobile Accessories', 'Phone Covers');
  console.log('✅ Calculated scores:', scores);
}

main().catch(console.error).finally(() => prisma.$disconnect());
