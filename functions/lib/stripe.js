"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStripeWebhook = exports.createCheckoutSession = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
const stripeSecretKey = (0, params_1.defineSecret)('STRIPE_SECRET_KEY');
const stripeWebhookSecret = (0, params_1.defineSecret)('STRIPE_WEBHOOK_SECRET');
// Helper to get Firestore instance (deferred to avoid initialization issues)
const getDb = () => admin.firestore();
// Known Prices Map for Validation
const KNOWN_PRICES = {
    'price_1Sj2flKYDhEuBvZw2mxvmxzZ': { type: 'subscription', tier: 'adventurer' },
    'price_1Sj2o7KYDhEuBvZwAACQIHSv': { type: 'subscription', tier: 'hero' },
    'price_1Sj3AFKYDhEuBvZwvhdEZRjA': { type: 'payment', tier: 'legendary' }, // One-time lifetime
    'price_1Sj374KYDhEuBvZwdo8htCVx': { type: 'payment', turns: 750 },
    'price_1Sj388KYDhEuBvZwsryc5wTj': { type: 'payment', turns: 1500 },
};
const getStripe = (apiKey) => {
    return new stripe_1.default(apiKey, {
        apiVersion: '2024-12-18.acacia',
    });
};
exports.createCheckoutSession = (0, https_1.onCall)({ secrets: [stripeSecretKey] }, async (request) => {
    const apiKey = stripeSecretKey.value();
    if (!apiKey) {
        throw new https_1.HttpsError('internal', 'Stripe API key not configured');
    }
    const stripe = getStripe(apiKey);
    const { priceId, successUrl, cancelUrl } = request.data;
    const auth = request.auth;
    if (!auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be logged in');
    }
    if (!priceId || !KNOWN_PRICES[priceId]) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid or unknown Price ID');
    }
    const priceConfig = KNOWN_PRICES[priceId];
    const userId = auth.uid;
    // Get user for email
    const userDoc = await getDb().collection('users').doc(userId).get();
    const userData = userDoc.data();
    const customerEmail = userData?.email;
    let stripeCustomerId = userData?.stripeCustomerId;
    // If user doesn't have a Stripe Customer ID, create one (or let Checkout create it)
    // If we let Checkout create it, we need to capture it in webhook.
    // Better to check if we have one.
    const sessionConfig = {
        payment_method_types: ['card'],
        line_items: [
            {
                price: priceId,
                quantity: 1,
            },
        ],
        mode: priceConfig.type === 'subscription' ? 'subscription' : 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
            userId: userId,
            type: priceConfig.type,
            tier: 'tier' in priceConfig ? priceConfig.tier : null, // 'adventurer', 'hero', 'legendary'
            turns: 'turns' in priceConfig ? String(priceConfig.turns) : null,
        },
        client_reference_id: userId,
    };
    if (stripeCustomerId) {
        sessionConfig.customer = stripeCustomerId;
    }
    else if (customerEmail) {
        sessionConfig.customer_email = customerEmail;
    }
    // For Legendary (Lifetime), it's a one-time payment but we treat it as a tier upgrade.
    // Mode is 'payment'.
    try {
        const session = await stripe.checkout.sessions.create(sessionConfig);
        return { url: session.url };
    }
    catch (error) {
        console.error('Stripe Checkout Error:', error);
        throw new https_1.HttpsError('internal', error.message || 'Failed to create checkout session');
    }
});
exports.handleStripeWebhook = (0, https_1.onRequest)({ secrets: [stripeSecretKey, stripeWebhookSecret] }, async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = stripeWebhookSecret.value();
    const apiKey = stripeSecretKey.value();
    if (!endpointSecret || !apiKey) {
        console.error('Missing Stripe secrets');
        res.status(500).send('Configuration error');
        return;
    }
    const stripe = getStripe(apiKey);
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    }
    catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }
    // Handle the event
    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                await handleCheckoutCompleted(session);
                break;
            }
            case 'customer.subscription.updated': {
                const subscription = event.data.object;
                await handleSubscriptionUpdated(subscription);
                break;
            }
            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                await handleSubscriptionDeleted(subscription);
                break;
            }
            case 'invoice.payment_succeeded': {
                // Could track payment history here
                break;
            }
            default:
                console.log(`Unhandled event type ${event.type}`);
        }
        res.status(200).json({ received: true });
    }
    catch (error) {
        console.error('Webhook Handler Error:', error);
        res.status(500).send('Internal Server Error');
    }
});
async function handleCheckoutCompleted(session) {
    const userId = session.metadata?.userId;
    const type = session.metadata?.type;
    const tier = session.metadata?.tier;
    const turns = session.metadata?.turns;
    const customerId = session.customer;
    if (!userId) {
        console.error('No userId in session metadata');
        return;
    }
    // Save Stripe Customer ID if not exists
    await getDb().collection('users').doc(userId).set({ stripeCustomerId: customerId }, { merge: true });
    if (type === 'payment') {
        if (tier === 'legendary') {
            // Lifetime upgrade
            await getDb().collection('users').doc(userId).update({
                tier: 'legendary',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`User ${userId} upgraded to Legendary (Lifetime)`);
        }
        else if (turns) {
            // Top-up
            const turnsToAdd = parseInt(turns, 10);
            if (!isNaN(turnsToAdd)) {
                await getDb().collection('users').doc(userId).update({
                    turns: admin.firestore.FieldValue.increment(turnsToAdd),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                console.log(`User ${userId} topped up ${turnsToAdd} turns`);
            }
        }
    }
    else if (type === 'subscription') {
        // Subscription starts. We can update tier here immediately for better UX
        // But actual reliable source is `customer.subscription.updated` / `created`
        if (tier) {
            await getDb().collection('users').doc(userId).update({
                tier: tier,
                stripeSubscriptionId: session.subscription,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`User ${userId} subscribed to ${tier}`);
        }
    }
}
async function handleSubscriptionUpdated(subscription) {
    // Determine tier from items
    // This is complex because we need to map Price ID back to Tier.
    // Ideally we store the tier in subscription metadata during creation, 
    // BUT subscription metadata isn't always propagated from checkout session easily without extra config.
    // Easier: Map Price ID from subscription.items.data[0].price.id
    const priceId = subscription.items.data[0]?.price.id;
    // const userId = subscription.metadata?.userId; // Metadata might not be preserved on subscription object
    // Check if we can find user by stripeSubscriptionId or stripeCustomerId
    const customerId = subscription.customer;
    // We need to find the user.
    const usersRef = getDb().collection('users');
    const snapshot = await usersRef.where('stripeCustomerId', '==', customerId).limit(1).get();
    if (snapshot.empty) {
        console.error(`No user found for Stripe Customer ${customerId}`);
        return;
    }
    const userDoc = snapshot.docs[0];
    const userRef = userDoc.ref;
    const priceConfig = KNOWN_PRICES[priceId];
    if (subscription.status === 'active' || subscription.status === 'trialing') {
        if (priceConfig && 'tier' in priceConfig) {
            await userRef.update({
                tier: priceConfig.tier,
                stripeSubscriptionId: subscription.id,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`User ${userDoc.id} subscription updated to ${priceConfig.tier}`);
        }
    }
    else if (subscription.status === 'past_due' || subscription.status === 'canceled' || subscription.status === 'unpaid') {
        // Downgrade to Scout if subscription fails
        // But WAIT, if they have 'legendary' (lifetime) they shouldn't have a subscription?
        // True. But check if they were legendary before? 
        // Logic: specific subscription ID failed.
        // If the user's CURRENT tier matches this subscription's tier, then downgrade.
        // Actually, safer to just check status.
        if (subscription.status === 'canceled') {
            await userRef.update({
                tier: 'scout',
                stripeSubscriptionId: admin.firestore.FieldValue.delete(), // Remove sub ID
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`User ${userDoc.id} subscription canceled, downgraded to Scout`);
        }
    }
}
async function handleSubscriptionDeleted(subscription) {
    const customerId = subscription.customer;
    const snapshot = await getDb().collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
    if (!snapshot.empty) {
        const userDoc = snapshot.docs[0];
        await userDoc.ref.update({
            tier: 'scout',
            stripeSubscriptionId: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`User ${userDoc.id} subscription deleted, downgraded to Scout`);
    }
}
//# sourceMappingURL=stripe.js.map