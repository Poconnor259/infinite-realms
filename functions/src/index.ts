import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { processWithBrain } from './brain';
import { generateNarrative } from './voice';

// Initialize Firebase Admin
admin.initializeApp();

// Get Firestore instance
const db = admin.firestore();

// Define secrets
const openaiApiKey = defineSecret('OPENAI_API_KEY');
const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');

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

export const processGameAction = onCall(
    { secrets: [openaiApiKey, anthropicApiKey], cors: true, invoker: 'public' },
    async (request): Promise<GameResponse> => {
        const data = request.data as GameRequest;
        const auth = request.auth;

        const {
            campaignId,
            userInput,
            worldModule,
            currentState,
            chatHistory,
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
            const openaiKey = byokKeys?.openai || openaiApiKey.value();
            const anthropicKey = byokKeys?.anthropic || anthropicApiKey.value();

            // DEBUG LOGGING
            console.log(`[Auth Debug] hasByok: ${!!byokKeys?.openai}, hasSecret: ${!!openaiApiKey.value()}`);
            if (openaiKey) {
                console.log(`[Auth Debug] Key used starts with: ${openaiKey.substring(0, 8)}... ends with: ...${openaiKey.slice(-4)} (Length: ${openaiKey.length})`);
            } else {
                console.log('[Auth Debug] No OpenAI key found');
            }

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
                chatHistory: chatHistory.slice(-10),
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
            let narrativeText: string;

            if (!anthropicKey) {
                // Fallback if no Anthropic key available
                narrativeText = brainResult.data?.narrativeCue ||
                    `*${userInput}*\n\nThe action has been processed.`;
            } else {
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
                    narrativeText = brainResult.data?.narrativeCue ||
                        'The narrator seems momentarily distracted...';
                } else {
                    narrativeText = voiceResult.narrative || '';
                }
            }

            // Step 3: Save state to Firestore (if authenticated)
            if (auth) {
                try {
                    await db.collection('users')
                        .doc(auth.uid)
                        .collection('campaigns')
                        .doc(campaignId)
                        .update({
                            moduleState: brainResult.data?.stateUpdates || currentState,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        });

                    // Increment user's turn/token usage
                    await db.collection('users').doc(auth.uid).update({
                        turnsUsed: admin.firestore.FieldValue.increment(1),
                        lastActive: admin.firestore.FieldValue.serverTimestamp(),
                    });

                } catch (dbError) {
                    console.error('Failed to save state to Firestore:', dbError);
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

export const createCampaign = onCall({ cors: true, invoker: 'public' }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be signed in');
    }

    const { name, worldModule, characterName } = request.data;

    const campaignRef = db.collection('users')
        .doc(request.auth.uid)
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
});

export const deleteCampaign = onCall({ cors: true, invoker: 'public' }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be signed in');
    }

    const { campaignId } = request.data;

    const messagesRef = db.collection('users')
        .doc(request.auth.uid)
        .collection('campaigns')
        .doc(campaignId)
        .collection('messages');

    const messages = await messagesRef.get();
    const batch = db.batch();
    messages.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    await db.collection('users')
        .doc(request.auth.uid)
        .collection('campaigns')
        .doc(campaignId)
        .delete();

    return { success: true };
});

// ==================== EXPORT DATA (GDPR) ====================

export const exportUserData = onCall({ cors: true, invoker: 'public' }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be signed in');
    }

    const userId = request.auth.uid;

    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    const campaignsSnapshot = await db.collection('users')
        .doc(userId)
        .collection('campaigns')
        .get();

    const campaigns = await Promise.all(
        campaignsSnapshot.docs.map(async (doc) => {
            const campaignData = doc.data();

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
});

// ==================== ADMIN DASHBOARD ====================

// Helper for timestamp formatting
function formatTimestamp(val: any): string | number | null {
    if (!val) return null;
    if (typeof val?.toDate === 'function') return val.toDate().toISOString();
    if (typeof val === 'number') return new Date(val).toISOString();
    return val; // String or other
}

export const getAdminDashboardData = onCall({ cors: true }, async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be signed in');
        }

        // Verify admin role 
        const callerDoc = await db.collection('users').doc(request.auth.uid).get();
        const callerData = callerDoc.data();

        if (callerData?.role !== 'admin') {
            throw new HttpsError('permission-denied', 'Admin access required');
        }

        // Fetch all users
        const usersSnapshot = await db.collection('users')
            .limit(100)
            .get();

        const users = usersSnapshot.docs.map(doc => {
            const d = doc.data();
            return {
                id: doc.id,
                email: d.email || '',
                displayName: d.displayName || 'Unknown',
                photoURL: d.photoURL || null,
                role: d.role || 'user',
                tier: d.tier || 'scout',
                turnsUsed: d.turnsUsed || 0,
                isAnonymous: !!d.isAnonymous,
                createdAt: formatTimestamp(d.createdAt),
                lastActive: formatTimestamp(d.lastActive),
            };
        });

        return { users };
    } catch (error: any) {
        console.error('getAdminDashboardData Error:', error);
        if (error.code) {
            throw error;
        }
        throw new HttpsError('internal', error.message || 'Unknown error');
    }
});

export const adminUpdateUser = onCall({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be signed in');
    }

    const callerDoc = await db.collection('users').doc(request.auth.uid).get();
    if (callerDoc.data()?.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const { targetUserId, updates } = request.data;

    await db.collection('users').doc(targetUserId).update(updates);

    return { success: true };
});
