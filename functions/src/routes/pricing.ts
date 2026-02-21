import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

// ==================== MODEL PRICING MANAGEMENT ====================

interface ModelPricing {
    prompt: number;
    completion: number;
}

interface ModelPricingData {
    gpt4oMini: ModelPricing;
    claude: ModelPricing;
    lastUpdated?: any;
    updatedBy?: string;
}

// Refresh model pricing from latest sources
export const refreshModelPricing = onCall(
    async (request) => {
        try {
            const auth = request.auth;
            if (!auth) {
                throw new HttpsError('unauthenticated', 'User must be authenticated');
            }

            const db = admin.firestore();

            // Check if user is admin
            const userDoc = await db.collection('users').doc(auth.uid).get();
            const isAdmin = userDoc.data()?.role === 'admin';

            if (!isAdmin) {
                throw new HttpsError('permission-denied', 'Admin access required');
            }

            console.log(`[RefreshPricing] Fetching latest pricing for admin ${auth.uid}`);

            // Fetch latest pricing (fallback to known values since APIs don't exist)
            const pricing: ModelPricingData = {
                gpt4oMini: {
                    prompt: 0.15,      // $0.15 per 1M tokens (as of Dec 2024)
                    completion: 0.60,  // $0.60 per 1M tokens
                },
                claude: {
                    prompt: 3.00,      // $3.00 per 1M tokens (Claude Sonnet 3.5)
                    completion: 15.00, // $15.00 per 1M tokens
                },
                lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                updatedBy: auth.uid,
            };

            // Save to Firestore
            await db.collection('config').doc('modelPricing').set(pricing);

            console.log('[RefreshPricing] Pricing updated successfully');

            return {
                success: true,
                pricing: {
                    gpt4oMini: pricing.gpt4oMini,
                    claude: pricing.claude,
                }
            };

        } catch (error) {
            console.error('[RefreshPricing] Error:', error);
            throw error instanceof HttpsError ? error : new HttpsError('internal', 'Failed to refresh pricing');
        }
    }
);

// Update model pricing manually
export const updateModelPricing = onCall(
    async (request) => {
        try {
            const pricingData = request.data as Record<string, { prompt: number; completion: number }>;
            const auth = request.auth;

            if (!auth) {
                throw new HttpsError('unauthenticated', 'User must be authenticated');
            }

            const db = admin.firestore();

            // Check if user is admin
            const userDoc = await db.collection('users').doc(auth.uid).get();
            const isAdmin = userDoc.data()?.role === 'admin';

            if (!isAdmin) {
                throw new HttpsError('permission-denied', 'Admin access required');
            }

            // Validate pricing values for all models
            for (const [modelId, pricing] of Object.entries(pricingData)) {
                // Skip metadata fields
                if (modelId === 'lastUpdated' || modelId === 'updatedBy') continue;

                if (pricing && typeof pricing === 'object') {
                    if (pricing.prompt < 0 || pricing.completion < 0) {
                        throw new HttpsError('invalid-argument', `Pricing for ${modelId} must be positive`);
                    }
                }
            }

            console.log(`[UpdatePricing] Updating pricing for admin ${auth.uid}`, Object.keys(pricingData));

            // Get current pricing
            const currentDoc = await db.collection('config').doc('modelPricing').get();
            const current = currentDoc.data() || {};

            // Merge new pricing with current (preserves existing entries)
            const updated = {
                ...current,
                ...pricingData,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                updatedBy: auth.uid,
            };

            await db.collection('config').doc('modelPricing').set(updated);

            console.log('[UpdatePricing] Pricing updated successfully');

            return { success: true };

        } catch (error) {
            console.error('[UpdatePricing] Error:', error);
            throw error instanceof HttpsError ? error : new HttpsError('internal', 'Failed to update pricing');
        }
    }
);

// Get current model pricing
export const getModelPricing = onCall(
    async (request) => {
        try {
            const db = admin.firestore();
            const doc = await db.collection('config').doc('modelPricing').get();
            return {
                success: true,
                pricing: doc.exists ? doc.data() : {
                    gpt4oMini: { prompt: 0.15, completion: 0.60 },
                    claude: { prompt: 3.00, completion: 15.00 }
                }
            };
        } catch (error) {
            console.error('[GetPricing] Error:', error);
            throw new HttpsError('internal', 'Failed to fetch model pricing');
        }
    }
);
