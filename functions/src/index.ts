import { onCall, HttpsError, onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';


import { createCheckoutSession, handleStripeWebhook } from './stripe';
// @ts-ignore - Used in processGameAction wrapper below
import { processGameAction as processGameActionCore, GameRequest, GameResponse, resolveModelConfig } from './gameEngine';
import { generateNarrative } from './voice';
import { initPromptHelper, seedAIPrompts } from './promptHelper';
import { performCleanup } from './scripts/cleanupAbilities';


export { createCheckoutSession, handleStripeWebhook };
// export { addDifficultyToWorlds } from './addDifficultyField';
// export { seedAmbianceSettings } from './seedAmbiance';
export { seedAllData } from './seedAllData';
export { seedKnowledgeDocuments } from './seedKnowledge';


// Initialize Firebase Admin
admin.initializeApp();

// Get Firestore instance
const db = admin.firestore();

// Initialize prompt helper with Firestore
initPromptHelper(db);

import { getAvailableModels } from './routes/models';
import { getApiKeys } from './routes/apiKeys';

// ==================== API KEY HELPER ====================
// Get API keys from Firestore (single source of truth) moved to routes/apiKeys.ts

// ==================== TYPES ====================

// Types are now exported from gameEngine.ts
// Re-export for backwards compatibility
export type { GameRequest, GameResponse } from './gameEngine';

// ==================== HELPER ====================

// Model resolution helpers moved to gameEngine.ts


// ==================== CONFIG ENDPOINTS ====================

// ==================== DYNAMIC MODEL FETCHING ====================
// Model fetching moved to routes/models.ts

export { getAvailableModels };

// ==================== MAIN GAME ENDPOINT ====================


// ==================== CAMPAIGN MANAGEMENT ====================

export const createCampaign = onCall(
    {
        cors: true,
        invoker: 'public',
        timeoutSeconds: 300
    },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be signed in');
        }

        const { name, worldModule: worldId, characterName, initialCharacter, difficulty } = request.data;

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

        // Resolve keys
        const secrets = await getApiKeys(db);

        // Fetch AI Settings to know which model to use for Voice
        let aiSettings = { brainModel: 'gpt-4o-mini', voiceModel: 'claude-3-5-sonnet' };
        try {
            const settingsDoc = await db.collection('config').doc('aiSettings').get();
            if (settingsDoc.exists) {
                aiSettings = settingsDoc.data() as any;
            }
        } catch (error) {
            console.error('[CreateCampaign] Failed to fetch AI settings:', error);
        }

        // Fetch Global Config for Narrator Limits from global doc
        let narratorLimits = { min: 150, max: 250, enforce: true };
        try {
            const globalConfigDoc = await db.collection('config').doc('global').get();
            if (globalConfigDoc.exists) {
                const gc = globalConfigDoc.data();
                if (gc?.systemSettings) {
                    if (gc.systemSettings.narratorWordLimitMin) {
                        narratorLimits.min = gc.systemSettings.narratorWordLimitMin;
                    }
                    if (gc.systemSettings.narratorWordLimitMax) {
                        narratorLimits.max = gc.systemSettings.narratorWordLimitMax;
                    }
                    narratorLimits.enforce = gc.systemSettings.enforceNarratorWordLimits !== false;
                }
            }
        } catch (error) {
            console.error('[CreateCampaign] Failed to fetch global config:', error);
        }

        const voiceConfig = resolveModelConfig(aiSettings.voiceModel, undefined, secrets); // No BYOK for intro yet

        // Get knowledge for generating intro (limit to 2 most relevant docs to save tokens)
        const voiceKnowledgeDocs = await getKnowledgeForModule(engineType, 'voice', 2);

        // Generate initial narrative
        // Initialize narrative - if AI generated, start empty so we don't show prompt instructions as fallback
        let initialNarrative = worldData?.generateIntro ? '' : (worldData?.initialNarrative || '');

        // Check if character already has essences (for skipping essence selection prompt)
        const hasPreselectedEssence = initialCharacter?.essenceSelection === 'chosen' ||
            initialCharacter?.essenceSelection === 'imported' ||
            (initialCharacter?.essences && Array.isArray(initialCharacter.essences) && initialCharacter.essences.length > 0);

        console.log('[CreateCampaign] Essence check:', {
            hasPreselectedEssence,
            essenceSelection: initialCharacter?.essenceSelection,
            essences: initialCharacter?.essences,
        });

        // Only use AI generation if explicitly enabled for this world and we have a key
        // [FIX] Force enable for 'outworlder' to override incorrect seed data
        const shouldGenerateIntro = worldData?.generateIntro || engineType === 'outworlder';

        if (voiceConfig.key && shouldGenerateIntro) {
            try {
                // Build narrative cue
                let narrativeContent = `A new adventure in the world of ${worldData?.name || engineType} begins. The setting is: ${worldData?.description || 'unknown'}. The character ${characterName || 'our hero'} is about to start their journey.`;

                // Add essence override instruction if essences are pre-selected
                if (hasPreselectedEssence && engineType === 'outworlder') {
                    const essenceList = initialCharacter?.essences?.join(', ') || 'unknown';
                    const rankInfo = initialCharacter?.rank || 'Iron';
                    const hasAbilities = initialCharacter?.abilities && Array.isArray(initialCharacter.abilities) && initialCharacter.abilities.length > 0;
                    narrativeContent = `A new Outworlder awakens in a strange world. The character ${characterName || 'our hero'} has already bonded with the following essences during their dimensional transit: ${essenceList}.
                    
CRITICAL: Do NOT present essence selection options (A, B, C, D). The character ALREADY has their essences. Skip the COMPENSATION PACKAGE — ESSENCE SELECTION sequence entirely. 

IMPORTANT: The character's rank is ${rankInfo}. Ensure your narrative reflects that they are ${rankInfo} rank. Do not state they are Iron 0 unless they are actually Iron.

${hasAbilities
                            ? `The character ALREADY has their ability set defined. DO NOT grant any new abilities. Their powers are already established and active.`
                            : `The character has essences but NO abilities yet. Grant them the intrinsic abilities associated with their essences as they awaken.`}

Start their adventure with them already awakened and their essences active. Describe their awakening and first moments in this new world, acknowledging their powers are already part of them.`;
                }

                // [NEW] Append Custom User Instructions if provided in World Management
                if (worldData?.initialNarrative && worldData?.generateIntro) {
                    narrativeContent += `\n\nADDITIONAL USER INSTRUCTIONS FOR THIS OPENING SCENE:\n${worldData.initialNarrative}`;
                }

                // If essences are pre-selected, modify customRules to exclude essence selection
                let effectiveCustomRules = worldData?.customRules;
                if (hasPreselectedEssence && effectiveCustomRules) {
                    effectiveCustomRules = effectiveCustomRules + `

🚨 CRITICAL OVERRIDE: Character already has essences selected (${initialCharacter?.essences?.join(', ')}). 
Rank is ${initialCharacter?.rank || 'Iron'}.
DO NOT RUN ESSENCE SELECTION. 
DO NOT OFFER COMPENSATION PACKAGE.
Skip directly to the adventure start.`;
                }

                const voiceResult = await generateNarrative({
                    narrativeCues: [{
                        type: 'description' as const,
                        content: narrativeContent,
                        emotion: 'mysterious' as const,
                    }],
                    worldModule: engineType,
                    chatHistory: [],
                    stateChanges: {},
                    diceRolls: [],
                    apiKey: voiceConfig.key,
                    provider: voiceConfig.provider,
                    model: voiceConfig.model,
                    knowledgeDocuments: voiceKnowledgeDocs,
                    customRules: effectiveCustomRules,
                    narratorWordLimitMin: narratorLimits.min,
                    narratorWordLimitMax: narratorLimits.max,
                    enforceWordLimits: narratorLimits.enforce,
                    characterProfile: initialCharacter
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
                    // Check if character already has essences selected
                    if (initialCharacter?.essenceSelection === 'chosen' || initialCharacter?.essenceSelection === 'imported') {
                        const essenceName = initialCharacter?.essences?.[0] || 'unknown';
                        initialNarrative = `*Darkness... then light. Blinding, violet light. You gasp for air as you wake up in a strange forest.*\n\n*The ${essenceName} essence thrums within you—a gift from your awakening. Its power is still raw, unfamiliar, but undeniably yours.*\n\n*A strange voice echoes in your mind: "Welcome, Outworlder. Your journey begins now."*`;
                    } else {
                        // Random mode - will present essence options during gameplay
                        initialNarrative = `*Darkness... then light. Blinding, violet light. You gasp for air as you wake up in a strange forest.*`;
                    }
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

        const charWithDifficulty = {
            ...character,
            difficulty: difficulty || 'adventurer'
        };

        // Save campaign
        await campaignRef.set({
            id: campaignRef.id,
            name,
            worldModule: worldId,
            character: charWithDifficulty,
            difficulty: difficulty || 'adventurer',
            moduleState: {
                type: engineType,
                character: charWithDifficulty,
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
                turns: d.turns || 0,
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

export const adminAdjustTurns = onCall({ cors: true, invoker: 'public' }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be signed in');
    }

    // Verify admin role
    const callerDoc = await db.collection('users').doc(request.auth.uid).get();
    if (callerDoc.data()?.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const { targetUserId, amount, operation } = request.data;

    if (!targetUserId || amount === undefined) {
        throw new HttpsError('invalid-argument', 'Missing targetUserId or amount');
    }

    const userRef = db.collection('users').doc(targetUserId);
    console.log(`[Admin] Adjusting turns for user: ${targetUserId}, amount: ${amount}, operation: ${operation}`);

    const userDoc = await userRef.get();
    if (!userDoc.exists) {
        throw new HttpsError('not-found', `User ${targetUserId} not found in Firestore`);
    }

    if (operation === 'set') {
        await userRef.update({ turns: amount });
    } else {
        await userRef.update({
            turns: admin.firestore.FieldValue.increment(amount)
        });
    }

    const updatedDoc = await userRef.get();
    console.log(`[Admin] Turns updated successfully. New balance: ${updatedDoc.data()?.turns}`);

    return { success: true, newBalance: updatedDoc.data()?.turns };
});

// ==================== KNOWLEDGE BASE ====================
export {
    addKnowledgeDocument,
    getKnowledgeDocuments,
    updateKnowledgeDocument,
    deleteKnowledgeDocument
} from './routes/knowledge';

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
        .where('worldModule', 'in', ['global', worldModule])
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

// ==================== API KEY MANAGEMENT ====================

const SECRET_NAMES = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    google: 'GOOGLE_API_KEY',
} as const;

type ApiProvider = keyof typeof SECRET_NAMES;

// Get the status of configured API keys (masked hints only - never full keys)
export const getApiKeyStatus = onCall(
    { cors: true, invoker: 'public' },
    async (request) => {
        // Admin check
        const auth = request.auth;
        if (!auth) throw new HttpsError('unauthenticated', 'User must be authenticated');

        const userDoc = await db.collection('users').doc(auth.uid).get();
        const isAdmin = userDoc.data()?.role === 'admin';
        if (!isAdmin) throw new HttpsError('permission-denied', 'Admin access required');

        const getHint = (key: string | undefined): { set: boolean; hint: string } => {
            if (!key || key.length < 8) {
                return { set: false, hint: '' };
            }
            // Show first 4 and last 4 characters
            const first = key.substring(0, 4);
            const last = key.substring(key.length - 4);
            return { set: true, hint: `${first}...${last}` };
        };

        // Get keys from Firestore first, fallback to Secret Manager
        const keys = await getApiKeys(db);

        return {
            openai: getHint(keys.openai),
            anthropic: getHint(keys.anthropic),
            google: getHint(keys.google),
        };
    }
);

// Update an API key in Secret Manager
export const updateApiKey = onCall(
    { cors: true, invoker: 'public' },
    async (request) => {
        // Admin check
        const auth = request.auth;
        if (!auth) throw new HttpsError('unauthenticated', 'User must be authenticated');

        const userDoc = await db.collection('users').doc(auth.uid).get();
        const isAdmin = userDoc.data()?.role === 'admin';
        if (!isAdmin) throw new HttpsError('permission-denied', 'Admin access required');

        const { provider, key } = request.data as { provider: ApiProvider; key: string };

        // Validate input
        if (!provider || !['openai', 'anthropic', 'google'].includes(provider)) {
            throw new HttpsError('invalid-argument', 'Invalid provider. Must be openai, anthropic, or google.');
        }

        if (!key || typeof key !== 'string' || key.length < 10) {
            throw new HttpsError('invalid-argument', 'Invalid API key. Key must be at least 10 characters.');
        }

        // Basic format validation
        if (provider === 'openai' && !key.startsWith('sk-')) {
            throw new HttpsError('invalid-argument', 'OpenAI keys should start with "sk-"');
        }

        try {
            // Store API key in Firestore (encrypted in production, you should add encryption)
            // WARNING: In production, you should encrypt these keys before storing
            await db.collection('apiKeys').doc(provider).set({
                key: key,
                provider: provider,
                set: true,
                hint: `${key.substring(0, 4)}...${key.substring(key.length - 3)}`,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedBy: auth.uid,
            });

            console.log(`[UpdateApiKey] ${provider} key updated by ${auth.uid}`);

            // Log the update for audit purposes
            await db.collection('auditLog').add({
                action: 'API_KEY_UPDATE',
                provider,
                updatedBy: auth.uid,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });

            return { success: true };

        } catch (error: any) {
            console.error('[UpdateApiKey] Error:', error);
            throw new HttpsError('internal', `Failed to update API key: ${error.message}`);
        }
    }
);

// ==================== AI PROMPTS MANAGEMENT ====================

// Seed AI prompts collection with default values
export const seedPrompts = onCall(
    { cors: true, invoker: 'public' },
    async (request) => {
        // Admin check
        const auth = request.auth;
        if (!auth) throw new HttpsError('unauthenticated', 'User must be authenticated');

        const userDoc = await db.collection('users').doc(auth.uid).get();
        const isAdmin = userDoc.data()?.role === 'admin';
        if (!isAdmin) throw new HttpsError('permission-denied', 'Admin access required');

        try {
            await seedAIPrompts(db);
            return { success: true, message: 'AI prompts seeded successfully' };
        } catch (error: any) {
            console.error('[SeedPrompts] Error:', error);
            throw new HttpsError('internal', `Failed to seed prompts: ${error.message}`);
        }
    }
);

// Export campaign save/load functions
export { saveCampaignState, getCampaignSaves, loadCampaignSave, deleteCampaignSave } from './campaignSaves';

// ==================== CACHE KEEP-ALIVE SYSTEM ====================
export const keepVoiceCacheAlive = onCall(async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'User must be logged in.');
    const userId = request.auth.uid;
    const { campaignId } = request.data;
    if (!campaignId) throw new HttpsError('invalid-argument', 'Campaign ID is required.');

    try {
        const db = admin.firestore();
        const campaignRef = db.collection('users').doc(userId).collection('campaigns').doc(campaignId);
        const campaignDoc = await campaignRef.get();
        if (!campaignDoc.exists) throw new HttpsError('not-found', 'Campaign not found.');

        const campaignData = campaignDoc.data();
        // Campaign path (users/{userId}/campaigns/{campaignId}) already ensures ownership

        const currentState = campaignData?.state || {};
        const worldId = campaignData?.worldId;
        const engineType = campaignData?.engine || 'classic';

        // Get AI Settings & Keys
        const userSettings = (await db.collection('users').doc(userId).collection('settings').doc('ai').get()).data() || {};
        const provider = userSettings.voiceProvider || 'openai';
        const model = userSettings.voiceModel || 'gpt-4o-mini';

        const allKeys = await getApiKeys(db);
        const apiKey = allKeys[provider as keyof typeof allKeys];

        if (!apiKey) return { success: false, message: 'No API Key found.' };
        if (provider !== 'anthropic') return { success: false, message: 'Keep-alive only needed for Anthropic.' };

        // Construct Context
        let worldData: any = {};
        let effectiveCustomRules = '';
        if (worldId) {
            const worldDoc = await db.collection('worlds').doc(worldId).get();
            if (worldDoc.exists) {
                worldData = worldDoc.data();
                effectiveCustomRules = worldData.customRules || '';
            }
        }

        const voiceKnowledgeDocs = await getKnowledgeForModule(engineType, 'voice', 2);

        const voiceResult = await generateNarrative({
            narrativeCues: [],
            worldModule: engineType,
            chatHistory: [],
            stateChanges: {},
            diceRolls: [],
            apiKey, provider, model,
            knowledgeDocuments: voiceKnowledgeDocs,
            customRules: effectiveCustomRules,
            characterProfile: (currentState as any).character,
            isKeepAlive: true
        });

        return { success: voiceResult.success, cached: true, usage: voiceResult.usage };
    } catch (error: any) {
        console.error('[KeepAlive] Error:', error);
        throw new HttpsError('internal', 'Keep-alive failed: ' + error.message);
    }
});

export const manualAbilityCleanup = onRequest({ cors: true }, async (req, res) => {
    // Basic security
    if (req.query.secret !== 'temp-cleanup-secret-123') {
        res.status(403).send('Unauthorized');
        return;
    }

    try {
        const result = await performCleanup(db);
        res.json(result);
    } catch (e: any) {
        console.error(e);
        res.status(500).send(e.toString());
    }
});
