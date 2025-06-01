const mongoose = require('mongoose');
const Product = require('../models/product.model');
const PriceChange = require('../models/price-change.model');

// Initialize cache fields for existing products
async function initializeProductCache() {
  try {
    console.log('Initializing product cache fields...');

    // Get all products
    const products = await Product.find({});
    console.log(`Found ${products.length} products to process`);

    let updated = 0;

    for (const product of products) {
      try {
        // Check if product already has cache fields initialized
        if (product.currentEffectivePrice !== undefined && product.hasActivePriceChanges !== undefined) {
          console.log(`  ⚠ Product ${product.name} already has cache fields initialized`);
          continue;
        }

        // Find active price changes for this product
        const now = new Date();
        const activePriceChanges = await PriceChange.find({
          productId: product._id,
          active: true,
          startDate: { $lte: now },
          endDate: { $gte: now }
        }).sort({ startDate: -1 });

        let updateData = {
          currentEffectivePrice: product.price,
          hasActivePriceChanges: false,
          activePriceChangeId: null
        };

        if (activePriceChanges.length > 0) {
          // Get the most recent active price change
          const currentPriceChange = activePriceChanges[0];
          updateData.currentEffectivePrice = currentPriceChange.tempPrice || currentPriceChange.value;
          updateData.hasActivePriceChanges = true;
          updateData.activePriceChangeId = currentPriceChange.id;
        }

        await Product.updateOne(
          { _id: product._id },
          { $set: updateData }
        );

        updated++;
        console.log(`  ✓ Updated cache for product: ${product.name} (effective price: ${updateData.currentEffectivePrice})`);

      } catch (productError) {
        console.error(`  ✗ Error processing product ${product.name}:`, productError.message);
      }
    }

    console.log('\n=== Cache Initialization Summary ===');
    console.log(`Total products processed: ${products.length}`);
    console.log(`Cache fields updated: ${updated}`);
    console.log('✓ Cache initialization completed!');

  } catch (error) {
    console.error('Cache initialization failed:', error);
    throw error;
  }
}

// Helper function to run initialization
async function runInitialization() {
  try {
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/restaurant');
      console.log('Connected to MongoDB for cache initialization');
    }

    await initializeProductCache();

    console.log('\nCache initialization completed successfully!');
  } catch (error) {
    console.error('Error running cache initialization:', error);
    process.exit(1);
  }
}

// Export functions for use in other scripts
module.exports = {
  initializeProductCache,
  runInitialization
};

// Run initialization if this file is executed directly
if (require.main === module) {
  runInitialization();
} 