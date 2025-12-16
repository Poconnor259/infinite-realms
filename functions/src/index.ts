import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { processWithBrain } from './brain';
import { generateNarrative } from './voice';

// Initialize Firebase Admin
admin.initializeApp();

// Get Firestore instance
const db = admin.firestore();

// ==================== TYPES ====================

interface GameRequest {
    campaignId: string;
    userInput: string;
    worldModule: 'classic' | 'outworlder' | 'shadowMonarch';
    currentState: Record<string, unknown>;
    chatHistory: Array<{ role: string; content: string }>;
    userTier: 'scout' | 'hero' | 'legend';
    byokKeys?: {
        openai?: string;
        anthropic?: string;
    };
}

interface GameResponse {
    success: boolean;
    narrativeText?: string;
    stateUpdates?: Record<string, unknown>;
    diceRolls?: Array<{
        type: string;
        result: number;
        modifier?: number;
        total: number;
        purpose?: string;
    }>;
    systemMessages?: string[];
    error?: string;
}

// ==================== MAIN GAME ENDPOINT ====================

/**
 * Main game processing endpoint.
 * Implements the Brain -> Voice pipeline.
 * 
 * 1. Receives user input + current game state
 * 2. Sends to Brain (GPT-4o-mini) for logic processing
 * 3. Sends Brain output to Voice (Claude) for narrative generation
 * 4. Returns narrative + state updates to client
 */
export const processGameAction = functions.https.onCall(
    async (data: GameRequest, context): Promise<GameResponse> => {
        // Validate authentication (optional for demo, required in production)
        // if (!context.auth) {
        //   throw new functions.https.HttpsError('unauthenticated', 'User must be signed in');
        // }

        const {
            campaignId,
            userInput,
            worldModule,
            currentState,
            chatHistory,
            userTier,
            byokKeys,
        } = data;

        // Validate required fields
        if (!campaignId || !userInput || !worldModule) {
            return {
                success: false,
                error: 'Missing required fields: campaignId, userInput, or worldModule',
            };
        }

        try {
            // Determine which API keys to use
            const openaiKey = byokKeys?.openai || process.env.OPENAI_API_KEY || functions.config().openai?.key;
            const anthropicKey = byokKeys?.anthropic || process.env.ANTHROPIC_API_KEY || functions.config().anthropic?.key;

            if (!openaiKey) {
                return {
                    success: false,
                    error: 'OpenAI API key not configured. Please set up BYOK or contact support.',
                };
            }

            // Step 1: Process with Brain (Logic Engine)
            console.log(`[Brain] Processing action for campaign ${campaignId}: "${userInput}"`);

            const brainResult = await processWithBrain({
                userInput,
                worldModule,
                currentState,
                chatHistory: chatHistory.slice(-10), // Last 10 messages for context
                apiKey: openaiKey,
            });

            if (!brainResult.success) {
                return {
                    success: false,
                    error: brainResult.error || 'Brain processing failed',
                };
            }

            console.log('[Brain] Result:', JSON.stringify(brainResult.data));

            // Step 2: Generate narrative with Voice (Narrator)
            // Use Claude for Hero+ tiers, GPT-4o-mini for free tier
            let narrativeText: string;

            if (userTier === 'scout' || !anthropicKey) {
                // Free tier: Use Brain to also generate simple narrative
                narrativeText = brainResult.data?.narrativeCue ||
                    `*${userInput}*\n\nThe action has been processed.`;
            } else {
                // Premium tier: Use Claude for rich narrative
                console.log('[Voice] Generating narrative with Claude');

                const voiceResult = await generateNarrative({
                    narrativeCues: brainResult.data?.narrativeCues || [],
                    worldModule,
                    chatHistory: chatHistory.slice(-6),
                    stateChanges: brainResult.data?.stateUpdates || {},
                    diceRolls: brainResult.data?.diceRolls || [],
                    apiKey: anthropicKey,
                });

                if (!voiceResult.success) {
                    // Fallback to Brain narrative if Voice fails
                    narrativeText = brainResult.data?.narrativeCue ||
                        'The narrator seems momentarily distracted...';
                } else {
                    narrativeText = voiceResult.narrative || '';
                }
            }

            // Step 3: Save state to Firestore (if authenticated)
            if (context.auth) {
                try {
                    await db.collection('users')
                        .doc(context.auth.uid)
                        .collection('campaigns')
                        .doc(campaignId)
                        .update({
                            moduleState: brainResult.data?.stateUpdates || currentState,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        });
                } catch (dbError) {
                    console.error('Failed to save state to Firestore:', dbError);
                    // Continue anyway - state will be saved client-side
                }
            }

            return {
                success: true,
                narrativeText,
                stateUpdates: brainResult.data?.stateUpdates,
                diceRolls: brainResult.data?.diceRolls,
                systemMessages: brainResult.data?.systemMessages,
            };

        } catch (error) {
            console.error('Game processing error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'An unexpected error occurred',
            };
        }
    }
);

// ==================== CAMPAIGN MANAGEMENT ====================

/**
 * Create a new campaign
 */
export const createCampaign = functions.https.onCall(
    async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be signed in');
        }

        const { name, worldModule, characterName } = data;

        const campaignRef = db.collection('users')
            .doc(context.auth.uid)
            .collection('campaigns')
            .doc();

        const now = admin.firestore.FieldValue.serverTimestamp();

        await campaignRef.set({
            id: campaignRef.id,
            name,
            worldModule,
            character: {
                id: `char_${Date.now()}`,
                name: characterName || 'Unnamed Hero',
                hp: { current: 100, max: 100 },
                level: 1,
            },
            createdAt: now,
            updatedAt: now,
        });

        return { campaignId: campaignRef.id };
    }
);

/**
 * Delete a campaign
 */
export const deleteCampaign = functions.https.onCall(
    async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be signed in');
        }

        const { campaignId } = data;

        // Delete all messages in the campaign
        const messagesRef = db.collection('users')
            .doc(context.auth.uid)
            .collection('campaigns')
            .doc(campaignId)
            .collection('messages');

        const messages = await messagesRef.get();
        const batch = db.batch();
        messages.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        // Delete the campaign
        await db.collection('users')
            .doc(context.auth.uid)
            .collection('campaigns')
            .doc(campaignId)
            .delete();

        return { success: true };
    }
);

// ==================== EXPORT DATA (GDPR) ====================

/**
 * Export all user data as JSON
 */
export const exportUserData = functions.https.onCall(
    async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be signed in');
        }

        const userId = context.auth.uid;

        // Get user document
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();

        // Get all campaigns
        const campaignsSnapshot = await db.collection('users')
            .doc(userId)
            .collection('campaigns')
            .get();

        const campaigns = await Promise.all(
            campaignsSnapshot.docs.map(async (doc) => {
                const campaignData = doc.data();

                // Get messages for this campaign
                const messagesSnapshot = await doc.ref.collection('messages').get();
                const messages = messagesSnapshot.docs.map(msgDoc => msgDoc.data());

                return {
                    ...campaignData,
                    messages,
                };
            })
        );

        return {
            user: userData,
            campaigns,
            exportedAt: new Date().toISOString(),
        };
    }
);
