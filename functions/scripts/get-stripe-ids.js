const Stripe = require('stripe');
// Get Stripe API key from environment variable - DO NOT hardcode!
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function listProductsAndPrices() {
    console.log('Fetching products...');
    const products = await stripe.products.list({ limit: 100 });
    for (const product of products.data) {
        console.log(`Product: ${product.name} (ID: ${product.id})`);
        const prices = await stripe.prices.list({ product: product.id });
        prices.data.forEach(price => {
            console.log(`  - Price: ${price.unit_amount / 100} ${price.currency} (ID: ${price.id}) [${price.recurring ? 'Recurring' : 'One-time'}]`);
        });
    }
}

listProductsAndPrices();
