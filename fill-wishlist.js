async function runAutoPilot() {
  const targetRuns = 50; // 50 runs * up to 15 products = ~750 products max per execution
  let totalAdded = 0;
  
  console.log('🚀 Starting DealFlow AI Wishlist Auto-Filler...');
  console.log('Hunting for high-commission student & hostel essentials...\n');

  for (let i = 1; i <= targetRuns; i++) {
    console.log(`\n⏳ [Run ${i}/${targetRuns}] Triggering Amazon Crawler...`);
    try {
      // Limit=15 per run to prevent timeout and avoid heavy bot-detection triggers
      const response = await fetch('http://127.0.0.1:3000/api/wishlist/research?limit=15', {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        if (data.added > 0) {
          console.log(`✅ Success! Added ${data.added} new products.`);
          console.log(`📌 Category target updated: [${data.category} > ${data.keyword}]`);
        } else {
          console.log(`⚠️ Scraper found 0 products. Message: ${data.message || 'Unknown'}`);
        }
        totalAdded += (data.added || 0);
        console.log(`📊 Total products added so far: ${totalAdded}`);
      } else {
        console.log(`❌ Crawler returned an error or found 0 products: ${data.message || data.error || 'Unknown'}`);
      }
      
    } catch (error) {
      console.log(`❌ Failed to connect to local server: ${error.message}`);
      console.log(`Ensure 'npm run dev' is running in another terminal!`);
    }

    // Wait between 6 to 12 seconds to mimic human browsing and prevent Amazon blocks
    const delay = Math.floor(Math.random() * 6000) + 6000;
    console.log(`💤 Resting for ${Math.round(delay/1000)} seconds before next search...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  console.log(`\n🎉 Auto-Filler Complete! Total new products added: ${totalAdded}`);
}

runAutoPilot();
