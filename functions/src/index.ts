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
    worldModule: 'classic' | 'outworlder' | 'tactical';
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
            // Resolve world configuration from Firestore
            let worldData: any = null;
            try {
                const worldDoc = await db.collection('worlds').doc(worldModule).get();
                if (worldDoc.exists) {
                    worldData = worldDoc.data();
                }
            } catch (error) {
                console.error('[ProcessGameAction] Failed to fetch world:', error);
            }

            let engineType = worldData?.type || worldModule; // Fallback to worldModule for legacy
            if (engineType === 'shadowMonarch') engineType = 'tactical';

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

            // Fetch knowledge base documents for Voice only (Brain just needs game rules)
            // This optimization saves ~3-5k tokens per turn
            console.log(`[Knowledge] Fetching documents for ${engineType} (Voice only)...`);
            const voiceKnowledgeDocs = await getKnowledgeForModule(engineType, 'voice');
            console.log(`[Knowledge] Found ${voiceKnowledgeDocs.length} voice docs`);

            // Step 1: Process with Brain (Logic Engine)
            console.log(`[Brain] Processing action for campaign ${campaignId}: "${userInput}"`);

            // Brain only needs last 3 messages for context (saves ~2k tokens)
            const brainResult = await processWithBrain({
                userInput,
                worldModule: engineType,
                currentState,
                chatHistory: chatHistory.slice(-3),
                apiKey: openaiKey,
                customRules: worldData?.customRules, // Pass custom rules directly
                // No knowledge docs for Brain - it just needs game rules which are in the system prompt
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
            let voiceResult: any = null; // Declare outside conditional for token tracking
            let totalPromptTokens = brainResult.usage?.promptTokens || 0;
            let totalCompletionTokens = brainResult.usage?.completionTokens || 0;

            if (!anthropicKey) {
                // Fallback if no Anthropic key available
                narrativeText = brainResult.data?.narrativeCue ||
                    `*${userInput}*\n\nThe action has been processed.`;
            } else {
                console.log('[Voice] Generating narrative with Claude');

                // Voice gets knowledge docs for lore, but only last 4 messages for narrative flow
                voiceResult = await generateNarrative({
                    narrativeCues: brainResult.data?.narrativeCues || [],
                    worldModule: engineType,
                    chatHistory: chatHistory.slice(-4),
                    stateChanges: brainResult.data?.stateUpdates || {},
                    diceRolls: brainResult.data?.diceRolls || [],
                    apiKey: anthropicKey,
                    knowledgeDocuments: voiceKnowledgeDocs,
                    customRules: worldData?.customRules, // Pass custom rules directly
                });

                if (voiceResult.usage) {
                    totalPromptTokens += voiceResult.usage.promptTokens;
                    totalCompletionTokens += voiceResult.usage.completionTokens;
                }

                if (!voiceResult.success) {
                    narrativeText = brainResult.data?.narrativeCue ||
                        'The narrator seems momentarily distracted...';
                } else {
                    narrativeText = voiceResult.narrative || '';
                }
            }

            const totalTokens = totalPromptTokens + totalCompletionTokens;

            // Step 3: Save messages to Firestore
            if (auth) {
                const messagesRef = db.collection('users')
                    .doc(auth.uid)
                    .collection('campaigns')
                    .doc(campaignId)
                    .collection('messages');

                // Save user message
                await messagesRef.add({
                    role: 'user',
                    content: userInput,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                });

                // Save narrator response
                await messagesRef.add({
                    role: 'narrator',
                    content: narrativeText,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    tokenUsage: { prompt: totalPromptTokens, completion: totalCompletionTokens, total: totalTokens },
                });
            }

            // Step 4: Save state to Firestore (if authenticated)
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

                    // Separate token counts by model
                    const brainPromptTokens = brainResult.usage?.promptTokens || 0;
                    const brainCompletionTokens = brainResult.usage?.completionTokens || 0;
                    const voicePromptTokens = voiceResult?.usage?.promptTokens || 0;
                    const voiceCompletionTokens = voiceResult?.usage?.completionTokens || 0;

                    // Increment user's turn/token usage with per-model tracking
                    await db.collection('users').doc(auth.uid).update({
                        turnsUsed: admin.firestore.FieldValue.increment(1),

                        // Per-model tracking (new)
                        'tokens.gpt4oMini.prompt': admin.firestore.FieldValue.increment(brainPromptTokens),
                        'tokens.gpt4oMini.completion': admin.firestore.FieldValue.increment(brainCompletionTokens),
                        'tokens.gpt4oMini.total': admin.firestore.FieldValue.increment(brainPromptTokens + brainCompletionTokens),
                        'tokens.claude.prompt': admin.firestore.FieldValue.increment(voicePromptTokens),
                        'tokens.claude.completion': admin.firestore.FieldValue.increment(voiceCompletionTokens),
                        'tokens.claude.total': admin.firestore.FieldValue.increment(voicePromptTokens + voiceCompletionTokens),

                        // Legacy fields (kept for backward compatibility)
                        tokensPrompt: admin.firestore.FieldValue.increment(totalPromptTokens),
                        tokensCompletion: admin.firestore.FieldValue.increment(totalCompletionTokens),
                        tokensTotal: admin.firestore.FieldValue.increment(totalTokens),

                        lastActive: admin.firestore.FieldValue.serverTimestamp(),
                    });

                    // Track global daily usage
                    const today = new Date().toISOString().split('T')[0];
                    await db.collection('systemStats').doc('tokens').collection('daily').doc(today).set({
                        date: today,
                        tokensPrompt: admin.firestore.FieldValue.increment(totalPromptTokens),
                        tokensCompletion: admin.firestore.FieldValue.increment(totalCompletionTokens),
                        tokensTotal: admin.firestore.FieldValue.increment(totalTokens),
                        turns: admin.firestore.FieldValue.increment(1),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    }, { merge: true });

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

// ==================== TEXT GENERATION ENDPOINT ====================

interface GenerateTextRequest {
    prompt: string;
    maxLength?: number;
}

interface GenerateTextResponse {
    success: boolean;
    text?: string;
    error?: string;
}

export const generateText = onCall(
    { secrets: [openaiApiKey], cors: true, invoker: 'public' },
    async (request): Promise<GenerateTextResponse> => {
        try {
            const { prompt, maxLength = 150 } = request.data as GenerateTextRequest;
            const auth = request.auth;

            if (!auth) {
                throw new HttpsError('unauthenticated', 'User must be authenticated');
            }

            if (!prompt || typeof prompt !== 'string') {
                throw new HttpsError('invalid-argument', 'Prompt is required');
            }

            // Get API key
            const openaiKey = openaiApiKey.value();
            console.log(`[GenerateText] API key exists: ${!!openaiKey}, length: ${openaiKey?.length || 0}`);

            if (!openaiKey) {
                console.error('[GenerateText] OpenAI API key not configured');
                throw new HttpsError('failed-precondition', 'OpenAI API key not configured');
            }

            console.log(`[GenerateText] Generating text for user ${auth.uid}`);

            // Simple OpenAI call for text generation
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${openaiKey}`,
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a creative writing assistant. Generate concise, engaging text based on the user\'s prompt. Keep responses to 2-3 sentences unless otherwise specified.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: maxLength,
                    temperature: 0.8,
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                console.error('[GenerateText] OpenAI error:', error);
                throw new HttpsError('internal', `Failed to generate text: ${error.substring(0, 100)}`);
            }

            const data = await response.json();
            const generatedText = data.choices[0]?.message?.content?.trim();

            if (!generatedText) {
                throw new HttpsError('internal', 'No text generated');
            }

            // Track usage under GPT-4o-mini (text generation uses GPT-4o-mini)
            const promptTokens = data.usage?.prompt_tokens || 0;
            const completionTokens = data.usage?.completion_tokens || 0;
            const tokensUsed = data.usage?.total_tokens || 0;

            await db.collection('users').doc(auth.uid).update({
                // Per-model tracking (new)
                'tokens.gpt4oMini.prompt': admin.firestore.FieldValue.increment(promptTokens),
                'tokens.gpt4oMini.completion': admin.firestore.FieldValue.increment(completionTokens),
                'tokens.gpt4oMini.total': admin.firestore.FieldValue.increment(tokensUsed),

                // Legacy field (kept for backward compatibility)
                tokensTotal: admin.firestore.FieldValue.increment(tokensUsed),

                lastActive: admin.firestore.FieldValue.serverTimestamp(),
            });

            console.log(`[GenerateText] Generated ${generatedText.length} characters, ${tokensUsed} tokens`);

            return {
                success: true,
                text: generatedText,
            };

        } catch (error) {
            console.error('[GenerateText] Error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'An unexpected error occurred',
            };
        }
    }
);

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
            const { gpt4oMini, claude } = request.data as { gpt4oMini?: ModelPricing; claude?: ModelPricing };
            const auth = request.auth;

            if (!auth) {
                throw new HttpsError('unauthenticated', 'User must be authenticated');
            }

            // Check if user is admin
            const userDoc = await db.collection('users').doc(auth.uid).get();
            const isAdmin = userDoc.data()?.role === 'admin';

            if (!isAdmin) {
                throw new HttpsError('permission-denied', 'Admin access required');
            }

            // Validate pricing values
            if (gpt4oMini) {
                if (gpt4oMini.prompt < 0 || gpt4oMini.completion < 0) {
                    throw new HttpsError('invalid-argument', 'Pricing must be positive');
                }
            }
            if (claude) {
                if (claude.prompt < 0 || claude.completion < 0) {
                    throw new HttpsError('invalid-argument', 'Pricing must be positive');
                }
            }

            console.log(`[UpdatePricing] Updating pricing for admin ${auth.uid}`);

            // Get current pricing
            const currentDoc = await db.collection('config').doc('modelPricing').get();
            const current = currentDoc.data() as ModelPricingData || {
                gpt4oMini: { prompt: 0.15, completion: 0.60 },
                claude: { prompt: 3.00, completion: 15.00 },
            };

            // Update with new values
            const updated: ModelPricingData = {
                gpt4oMini: gpt4oMini || current.gpt4oMini,
                claude: claude || current.claude,
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
            const doc = await db.collection('config').doc('modelPricing').get();

            if (!doc.exists) {
                // Return default pricing if not set
                return {
                    gpt4oMini: { prompt: 0.15, completion: 0.60 },
                    claude: { prompt: 3.00, completion: 15.00 },
                };
            }

            return doc.data();

        } catch (error) {
            console.error('[GetPricing] Error:', error);
            throw new HttpsError('internal', 'Failed to get pricing');
        }
    }
);

// ==================== CAMPAIGN MANAGEMENT ====================

export const createCampaign = onCall(
    { secrets: [openaiApiKey, anthropicApiKey], cors: true, invoker: 'public' },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be signed in');
        }

        const { name, worldModule: worldId, characterName, initialCharacter } = request.data;

        // Resolve world configuration from Firestore
        let worldData: any = null;
        try {
            const worldDoc = await db.collection('worlds').doc(worldId).get();
            if (worldDoc.exists) {
                worldData = worldDoc.data();
            }
        } catch (error) {
            console.error('[CreateCampaign] Failed to fetch world:', error);
        }

        let engineType = worldData?.type || worldId; // Fallback to worldId for legacy or if doc missing
        if (engineType === 'shadowMonarch') engineType = 'tactical';

        const campaignRef = db.collection('users')
            .doc(request.auth.uid)
            .collection('campaigns')
            .doc();

        const now = admin.firestore.FieldValue.serverTimestamp();

        // Get API keys
        const anthropicKey = anthropicApiKey.value();

        // Get knowledge for generating intro (limit to 2 most relevant docs to save tokens)
        const voiceKnowledgeDocs = await getKnowledgeForModule(engineType, 'voice', 2);

        // Generate initial narrative with Claude
        let initialNarrative = worldData?.initialNarrative || '';

        // Only use AI generation if explicitly enabled for this world
        if (anthropicKey && worldData?.generateIntro) {
            try {
                const voiceResult = await generateNarrative({
                    narrativeCues: [{
                        type: 'description' as const,
                        content: `A new adventure in the world of ${worldData?.name || engineType} begins. The setting is: ${worldData?.description || 'unknown'}. The character ${characterName || 'our hero'} is about to start their journey.`,
                        emotion: 'mysterious' as const,
                    }],
                    worldModule: engineType,
                    chatHistory: [],
                    stateChanges: {},
                    diceRolls: [],
                    apiKey: anthropicKey,
                    knowledgeDocuments: voiceKnowledgeDocs,
                    customRules: worldData?.customRules, // Pass custom rules directly
                });
                if (voiceResult.success && voiceResult.narrative) {
                    initialNarrative = voiceResult.narrative;
                }
            } catch (narrativeError) {
                console.error('[CreateCampaign] Narrative generation failed:', narrativeError);
            }
        }

        // Fallback to hardcoded intro if AI generation failed
        if (!initialNarrative) {
            switch (engineType) {
                case 'classic':
                    initialNarrative = `*The tavern is warm and loud. You sit in the corner, polishing your gear. A shadow falls across your table.*`;
                    break;
                case 'outworlder':
                    initialNarrative = `*Darkness... then light. Blinding, violet light. You gasp for air as you wake up in a strange forest.*`;
                    break;
                case 'tactical':
                    initialNarrative = `*[SYSTEM NOTIFICATION]*\n\n*Validation complete. Player registered. Welcome, Operative.*`;
                    break;
                default:
                    initialNarrative = `*Your adventure begins...*`;
            }
        }

        // Use initialCharacter if provided, otherwise create a basic character
        const character = initialCharacter || {
            id: `char_${Date.now()}`,
            name: characterName || 'Unnamed Hero',
            hp: { current: 100, max: 100 },
            level: 1,
        };

        // Ensure character has an ID
        if (!character.id) {
            character.id = `char_${Date.now()}`;
        }

        // Save campaign
        await campaignRef.set({
            id: campaignRef.id,
            name,
            worldModule: worldId,
            character,
            moduleState: {
                type: engineType,
                character,
            },
            createdAt: now,
            updatedAt: now,
        });

        // Save initial message
        await campaignRef.collection('messages').add({
            role: 'narrator',
            content: initialNarrative,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { campaignId: campaignRef.id, initialNarrative };
    }
);

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

export const getAdminDashboardData = onCall({ cors: true, invoker: 'public' }, async (request) => {
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
                tokensPrompt: d.tokensPrompt || 0,
                tokensCompletion: d.tokensCompletion || 0,
                tokensTotal: d.tokensTotal || 0,
                tokens: d.tokens || {}, // Include per-model breakdown
                isAnonymous: !!d.isAnonymous,
                createdAt: formatTimestamp(d.createdAt),
                lastActive: formatTimestamp(d.lastActive),
            };
        });

        // Fetch last 30 days of daily stats
        const dailyStatsSnapshot = await db.collection('systemStats')
            .doc('tokens')
            .collection('daily')
            .orderBy('date', 'desc')
            .limit(30)
            .get();

        const dailyStats = dailyStatsSnapshot.docs.map(doc => doc.data());

        return { users, dailyStats };
    } catch (error: any) {
        console.error('getAdminDashboardData Error:', error);
        if (error.code) {
            throw error;
        }
        throw new HttpsError('internal', error.message || 'Unknown error');
    }
});

export const adminUpdateUser = onCall({ cors: true, invoker: 'public' }, async (request) => {
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

// ==================== KNOWLEDGE BASE ====================

interface KnowledgeDocument {
    id?: string;
    name: string;
    worldModule: 'global' | 'classic' | 'outworlder' | 'tactical';
    content: string;
    category: 'lore' | 'rules' | 'characters' | 'locations' | 'other';
    targetModel: 'brain' | 'voice' | 'both'; // brain=OpenAI, voice=Claude
    uploadedBy?: string;
    createdAt?: FirebaseFirestore.Timestamp;
    updatedAt?: FirebaseFirestore.Timestamp;
    enabled: boolean;
}

export const addKnowledgeDocument = onCall({
    cors: ['https://infinite-realms-5dcba.web.app', 'https://infinite-realms-5dcba.firebaseapp.com'],
    invoker: 'public'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be signed in');
    }

    // Verify admin role
    const callerDoc = await db.collection('users').doc(request.auth.uid).get();
    if (callerDoc.data()?.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const { name, worldModule, content, category, targetModel } = request.data as Partial<KnowledgeDocument>;

    if (!name || !worldModule || !content || !category || !targetModel) {
        throw new HttpsError('invalid-argument', 'Missing required fields: name, worldModule, content, category, targetModel');
    }

    const docRef = db.collection('knowledgeBase').doc();
    const now = admin.firestore.FieldValue.serverTimestamp();

    await docRef.set({
        id: docRef.id,
        name,
        worldModule,
        content,
        category,
        targetModel,
        uploadedBy: request.auth.uid,
        createdAt: now,
        updatedAt: now,
        enabled: true,
    });

    return { id: docRef.id, success: true };
});

export const getKnowledgeDocuments = onCall({
    cors: ['https://infinite-realms-5dcba.web.app', 'https://infinite-realms-5dcba.firebaseapp.com'],
    invoker: 'public'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be signed in');
    }

    // Verify admin role
    const callerDoc = await db.collection('users').doc(request.auth.uid).get();
    if (callerDoc.data()?.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const snapshot = await db.collection('knowledgeBase')
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();

    const documents = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: data.name,
            worldModule: data.worldModule,
            content: data.content,
            category: data.category,
            targetModel: data.targetModel || 'both',
            uploadedBy: data.uploadedBy,
            createdAt: formatTimestamp(data.createdAt),
            updatedAt: formatTimestamp(data.updatedAt),
            enabled: data.enabled ?? true,
        };
    });

    return { documents };
});

export const updateKnowledgeDocument = onCall({
    cors: ['https://infinite-realms-5dcba.web.app', 'https://infinite-realms-5dcba.firebaseapp.com'],
    invoker: 'public'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be signed in');
    }

    // Verify admin role
    const callerDoc = await db.collection('users').doc(request.auth.uid).get();
    if (callerDoc.data()?.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const { documentId, updates } = request.data;

    if (!documentId) {
        throw new HttpsError('invalid-argument', 'Document ID required');
    }

    const docRef = db.collection('knowledgeBase').doc(documentId);
    const doc = await docRef.get();

    if (!doc.exists) {
        throw new HttpsError('not-found', 'Document not found');
    }

    await docRef.update({
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
});

export const deleteKnowledgeDocument = onCall({
    cors: ['https://infinite-realms-5dcba.web.app', 'https://infinite-realms-5dcba.firebaseapp.com'],
    invoker: 'public'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be signed in');
    }

    // Verify admin role
    const callerDoc = await db.collection('users').doc(request.auth.uid).get();
    if (callerDoc.data()?.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const { documentId } = request.data;

    if (!documentId) {
        throw new HttpsError('invalid-argument', 'Document ID required');
    }

    await db.collection('knowledgeBase').doc(documentId).delete();

    return { success: true };
});

// Helper for game logic to fetch knowledge documents
// modelFilter: 'brain' for OpenAI, 'voice' for Claude
// maxDocs: limit number of documents to reduce token usage
export const getKnowledgeForModule = async (
    worldModule: string,
    modelFilter: 'brain' | 'voice',
    maxDocs: number = 3
): Promise<string[]> => {
    const snapshot = await db.collection('knowledgeBase')
        .where('enabled', '==', true)
        .get();

    const docs = snapshot.docs
        .filter(doc => {
            const data = doc.data();
            const moduleMatch = data.worldModule === 'global' || data.worldModule === worldModule;
            const modelMatch = data.targetModel === 'both' || data.targetModel === modelFilter || !data.targetModel;
            return moduleMatch && modelMatch;
        })
        .map(doc => {
            const data = doc.data();
            return {
                text: `[${data.category.toUpperCase()}: ${data.name}]\n${data.content}`,
                category: data.category,
                length: data.content.length,
            };
        })
        // Prioritize shorter docs to minimize token usage
        .sort((a, b) => a.length - b.length)
        .slice(0, maxDocs);

    return docs.map(d => d.text);
};
