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
exports.updateApiKey = exports.getApiKeyStatus = exports.getKnowledgeForModule = exports.deleteKnowledgeDocument = exports.updateKnowledgeDocument = exports.getKnowledgeDocuments = exports.addKnowledgeDocument = exports.adminUpdateUser = exports.getAdminDashboardData = exports.exportUserData = exports.deleteCampaign = exports.createCampaign = exports.updateGlobalConfig = exports.getGlobalConfig = exports.getModelPricing = exports.updateModelPricing = exports.refreshModelPricing = exports.verifyModelConfig = exports.generateText = exports.processGameAction = exports.getAvailableModels = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const openai_1 = __importDefault(require("openai"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const generative_ai_1 = require("@google/generative-ai");
const brain_1 = require("./brain");
const voice_1 = require("./voice");
// Initialize Firebase Admin
admin.initializeApp();
// Get Firestore instance
const db = admin.firestore();
// ==================== API KEY HELPER ====================
// Get API keys from Firestore (single source of truth)
async function getApiKeys() {
    const providers = ['openai', 'anthropic', 'google'];
    const keys = {};
    for (const provider of providers) {
        try {
            const keyDoc = await db.collection('apiKeys').doc(provider).get();
            if (keyDoc.exists && keyDoc.data()?.key) {
                keys[provider] = keyDoc.data().key;
            }
            else {
                keys[provider] = '';
            }
        }
        catch (error) {
            console.warn(`[API Keys] Error reading ${provider} from Firestore:`, error);
            keys[provider] = '';
        }
    }
    return keys;
}
// ==================== HELPER ====================
function getProviderFromModel(model) {
    if (model.startsWith('claude'))
        return 'anthropic';
    if (model.startsWith('gemini'))
        return 'google';
    return 'openai';
}
function resolveModelConfig(selectedModel, byokKeys, secrets) {
    const provider = getProviderFromModel(selectedModel);
    let key;
    // 1. Try BYOK
    if (byokKeys && byokKeys[provider]) {
        key = byokKeys[provider];
    }
    // 2. Try Secret
    if (!key) {
        key = secrets[provider];
    }
    // 3. Fallback if no key for selected provider
    if (!key) {
        console.warn(`[Config] No key found for selected provider ${provider}. Falling back to OpenAI.`);
        // Fallback to OpenAI (assuming we always have a system key for it)
        return {
            provider: 'openai',
            model: 'gpt-4o-mini',
            key: secrets.openai || ''
        };
    }
    return { provider, model: selectedModel, key };
}
// ==================== CONFIG ENDPOINTS ====================
// ==================== DYNAMIC MODEL FETCHING ====================
async function fetchOpenAIModels(apiKey) {
    if (!apiKey)
        return [];
    try {
        const response = await fetch('https://api.openai.com/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!response.ok)
            return [];
        const data = await response.json();
        return data.data || [];
    }
    catch (e) {
        console.error('Failed to fetch OpenAI models', e);
        return [];
    }
}
async function fetchAnthropicModels(apiKey) {
    if (!apiKey)
        return [];
    try {
        const response = await fetch('https://api.anthropic.com/v1/models', {
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            }
        });
        if (!response.ok)
            return [];
        const data = await response.json();
        return data.data || [];
    }
    catch (e) {
        console.error('Failed to fetch Anthropic models', e);
        return [];
    }
}
async function fetchGoogleModels(apiKey) {
    if (!apiKey)
        return [];
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!response.ok)
            return [];
        const data = await response.json();
        return data.models || [];
    }
    catch (e) {
        console.error('Failed to fetch Google models', e);
        return [];
    }
}
function resolvePricing(modelId) {
    // Default/Fallback
    let pricing = { prompt: 0, completion: 0 };
    // OpenAI
    if (modelId.includes('gpt-4o'))
        pricing = { prompt: 2.50, completion: 10.00 };
    if (modelId.includes('gpt-4o-mini'))
        pricing = { prompt: 0.15, completion: 0.60 };
    if (modelId.includes('o1-preview'))
        pricing = { prompt: 15.00, completion: 60.00 };
    if (modelId.includes('o1-mini'))
        pricing = { prompt: 3.00, completion: 12.00 };
    // Anthropic
    if (modelId.includes('claude-3-5-sonnet'))
        pricing = { prompt: 3.00, completion: 15.00 };
    if (modelId.includes('claude-3-5-haiku'))
        pricing = { prompt: 1.00, completion: 5.00 };
    if (modelId.includes('claude-3-opus'))
        pricing = { prompt: 15.00, completion: 75.00 };
    // Google
    if (modelId.includes('gemini-1.5-pro'))
        pricing = { prompt: 1.25, completion: 5.00 };
    if (modelId.includes('gemini-1.5-flash'))
        pricing = { prompt: 0.075, completion: 0.30 };
    if (modelId.includes('gemini-1.5-flash-8b'))
        pricing = { prompt: 0.0375, completion: 0.15 };
    if (modelId.includes('gemini-2.0'))
        pricing = { prompt: 0.00, completion: 0.00 }; // Free during experimental
    return pricing;
}
exports.getAvailableModels = (0, https_1.onCall)({ cors: true, invoker: 'public' }, async (request) => {
    const secrets = await getApiKeys();
    const [openaiModels, anthropicModels, googleModels] = await Promise.all([
        fetchOpenAIModels(secrets.openai),
        fetchAnthropicModels(secrets.anthropic),
        fetchGoogleModels(secrets.google)
    ]);
    const models = [];
    // Process OpenAI
    openaiModels.forEach((m) => {
        if (m.id.includes('gpt') || m.id.includes('o1')) {
            // Filter out audio, tts, dall-e, etc by checking for 'gpt' or 'o1' at minimum
            // This is a loose filter; we might want to skip 'gpt-3.5-turbo' if deprecating, but let's keep it broad.
            // Exclude 'realtime', 'audio' explicitly if needed.
            if (!m.id.includes('realtime') && !m.id.includes('audio')) {
                models.push({
                    id: m.id,
                    name: m.id, // OpenAI names are IDs
                    provider: 'openai',
                    defaultPricing: resolvePricing(m.id)
                });
            }
        }
    });
    // Process Anthropic
    anthropicModels.forEach((m) => {
        models.push({
            id: m.id,
            name: m.display_name || m.id,
            provider: 'anthropic',
            defaultPricing: resolvePricing(m.id)
        });
    });
    // Process Google
    googleModels.forEach((m) => {
        // Google IDs look like "models/gemini-1.5-flash"
        const id = m.name.replace('models/', '');
        if (id.includes('gemini')) {
            models.push({
                id: id,
                name: m.displayName || id,
                provider: 'google',
                defaultPricing: resolvePricing(id)
            });
        }
    });
    return {
        success: true,
        models
    };
});
// ==================== MAIN GAME ENDPOINT ====================
exports.processGameAction = (0, https_1.onCall)({ cors: true, invoker: 'public' }, async (request) => {
    const data = request.data;
    const auth = request.auth;
    const { campaignId, userInput, worldModule, currentState, chatHistory, byokKeys, } = data;
    // Validate required fields
    if (!campaignId || !userInput || !worldModule) {
        return {
            success: false,
            error: 'Missing required fields: campaignId, userInput, or worldModule',
        };
    }
    try {
        // 1. Resolve world configuration
        let worldData = null;
        try {
            const worldDoc = await db.collection('worlds').doc(worldModule).get();
            if (worldDoc.exists) {
                worldData = worldDoc.data();
            }
        }
        catch (error) {
            console.error('[ProcessGameAction] Failed to fetch world:', error);
        }
        let engineType = worldData?.type || worldModule;
        // Map legacy types if needed
        if (engineType === 'shadowMonarch')
            engineType = 'tactical';
        // 2. Resolve AI Settings
        let aiSettings = { brainModel: 'gpt-4o-mini', voiceModel: 'claude-3-5-sonnet' };
        try {
            const settingsDoc = await db.collection('config').doc('aiSettings').get();
            if (settingsDoc.exists) {
                aiSettings = settingsDoc.data();
            }
        }
        catch (error) {
            console.error('[ProcessGameAction] Failed to fetch AI settings:', error);
        }
        // 2.5 Verify User Tier & BYOK Access
        // Security: Fetch actual user tier from Firestore, don't trust client
        let effectiveByokKeys = undefined;
        let userTier = 'scout';
        let preferredModels = {};
        if (auth?.uid) {
            const userDoc = await db.collection('users').doc(auth.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                userTier = userData?.tier || 'scout';
                // Only Legend users can override models
                if (userTier === 'legend') {
                    preferredModels = userData?.preferredModels || {};
                }
            }
        }
        if (userTier === 'legend') {
            // Legend users MUST use BYOK. 
            // We pass the keys provided by client. If they are missing/invalid, resolveModelConfig will fail if we enforce it there,
            // or we enforce it here:
            effectiveByokKeys = byokKeys;
        }
        else {
            // Scout/Hero users CANNOT use BYOK.
            // We explicitly ignore any keys sent by the client.
            effectiveByokKeys = undefined;
        }
        // 3. Resolve Keys and Models
        const secrets = await getApiKeys();
        // If Legend, we must NOT use system secrets as fallback?
        // User requested: "when they upgrade to legend they lost access to the global API keys"
        let effectiveSecrets = secrets;
        if (userTier === 'legend') {
            effectiveSecrets = { openai: '', anthropic: '', google: '' };
        }
        const brainModelId = preferredModels.brain || aiSettings.brainModel;
        const voiceModelId = preferredModels.voice || aiSettings.voiceModel;
        const brainConfig = resolveModelConfig(brainModelId, effectiveByokKeys, effectiveSecrets);
        const voiceConfig = resolveModelConfig(voiceModelId, effectiveByokKeys, effectiveSecrets);
        if (!brainConfig.key) {
            return { success: false, error: 'Configuration Error: No valid API key available for Brain.' };
        }
        if (!voiceConfig.key) {
            return { success: false, error: 'Configuration Error: No valid API key available for Voice.' };
        }
        console.log(`[Process] Brain: ${brainConfig.provider}/${brainConfig.model}, Voice: ${voiceConfig.provider}/${voiceConfig.model}`);
        // Fetch knowledge base (Voice only optimization still applies?)
        // If Brain now supports custom rules, we pass them.
        // KnowledgeBase documents are generally for Voice (Lore) but Brain might need mechanics?
        // Existing code said "Voice only" for docs. I'll stick to that or pass only relevant ones.
        // But brain.ts DOES handle knowledgeDocuments. I'll pass appropriately.
        console.log(`[Knowledge] Fetching documents for ${engineType}...`);
        let knowledgeDocs = [];
        try {
            // Check if imported function works
            knowledgeDocs = await (0, exports.getKnowledgeForModule)(engineType, 'voice');
        }
        catch (kError) {
            console.warn('Failed to fetch knowledge docs:', kError);
        }
        // 4. Run Brain (Logic)
        const brainResult = await (0, brain_1.processWithBrain)({
            userInput,
            worldModule: engineType,
            currentState,
            chatHistory,
            apiKey: brainConfig.key,
            provider: brainConfig.provider,
            model: brainConfig.model,
            knowledgeDocuments: [], // Converting optimization: Brain doesn't get heavy lore docs
            customRules: worldData?.customRules,
        });
        if (!brainResult.success || !brainResult.data) {
            return {
                success: false,
                error: brainResult.error || 'Brain processing failed',
            };
        }
        // 5. Run Voice (Narrative)
        const voiceResult = await (0, voice_1.generateNarrative)({
            narrativeCues: brainResult.data.narrativeCues,
            worldModule: engineType,
            chatHistory,
            stateChanges: brainResult.data.stateUpdates,
            diceRolls: brainResult.data.diceRolls,
            apiKey: voiceConfig.key,
            provider: voiceConfig.provider,
            model: voiceConfig.model,
            knowledgeDocuments: knowledgeDocs,
            customRules: worldData?.customRules,
        });
        // Log Voice result for debugging
        console.log('[Voice] Result:', {
            success: voiceResult.success,
            hasNarrative: !!voiceResult.narrative,
            hasUsage: !!voiceResult.usage,
            error: voiceResult.error
        });
        if (!voiceResult.success) {
            console.error('[Voice] Generation failed:', voiceResult.error);
        }
        // 6. Record Token Usage
        if (auth?.uid) {
            const updates = {};
            // Helper to map provider/model to stats key
            // Use actual model ID but sanitize dots for Firestore FieldPaths
            const getTokenStatsKey = (provider, model) => {
                return model.replace(/\./g, '_');
            };
            const brainStatsKey = getTokenStatsKey(brainConfig.provider, brainConfig.model);
            const voiceStatsKey = getTokenStatsKey(voiceConfig.provider, voiceConfig.model);
            if (brainResult.usage) {
                updates[`tokens.${brainStatsKey}.prompt`] = admin.firestore.FieldValue.increment(brainResult.usage.promptTokens);
                updates[`tokens.${brainStatsKey}.completion`] = admin.firestore.FieldValue.increment(brainResult.usage.completionTokens);
                updates[`tokens.${brainStatsKey}.total`] = admin.firestore.FieldValue.increment(brainResult.usage.totalTokens);
            }
            if (voiceResult.usage) {
                updates[`tokens.${voiceStatsKey}.prompt`] = admin.firestore.FieldValue.increment(voiceResult.usage.promptTokens);
                updates[`tokens.${voiceStatsKey}.completion`] = admin.firestore.FieldValue.increment(voiceResult.usage.completionTokens);
                updates[`tokens.${voiceStatsKey}.total`] = admin.firestore.FieldValue.increment(voiceResult.usage.totalTokens);
            }
            // Track total turns & legacy totals
            const totalPrompt = (brainResult.usage?.promptTokens || 0) + (voiceResult.usage?.promptTokens || 0);
            const totalCompletion = (brainResult.usage?.completionTokens || 0) + (voiceResult.usage?.completionTokens || 0);
            const totalTokens = totalPrompt + totalCompletion;
            updates['turnsUsed'] = admin.firestore.FieldValue.increment(1);
            updates['tokensPrompt'] = admin.firestore.FieldValue.increment(totalPrompt);
            updates['tokensCompletion'] = admin.firestore.FieldValue.increment(totalCompletion);
            updates['tokensTotal'] = admin.firestore.FieldValue.increment(totalTokens);
            updates['lastActive'] = admin.firestore.FieldValue.serverTimestamp();
            await db.collection('users').doc(auth.uid).update(updates).catch(e => console.error('Failed to update stats:', e));
            // Global Stats
            const today = new Date().toISOString().split('T')[0];
            await db.collection('systemStats').doc('tokens').collection('daily').doc(today).set({
                date: today,
                tokensPrompt: admin.firestore.FieldValue.increment(totalPrompt),
                tokensCompletion: admin.firestore.FieldValue.increment(totalCompletion),
                tokensTotal: admin.firestore.FieldValue.increment(totalTokens),
                turns: admin.firestore.FieldValue.increment(1),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        // Save session data (Messages & State)
        if (auth?.uid) {
            const messagesRef = db.collection('users')
                .doc(auth.uid)
                .collection('campaigns')
                .doc(campaignId)
                .collection('messages');
            await messagesRef.add({
                role: 'user',
                content: userInput,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            await messagesRef.add({
                role: 'narrator',
                content: voiceResult.narrative || brainResult.data.narrativeCue,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                // Simplified usage tracking on message for now
            });
            await db.collection('users')
                .doc(auth.uid)
                .collection('campaigns')
                .doc(campaignId)
                .update({
                moduleState: brainResult.data?.stateUpdates || currentState,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        return {
            success: true,
            narrativeText: voiceResult.narrative || brainResult.data.narrativeCue,
            stateUpdates: brainResult.data.stateUpdates,
            diceRolls: brainResult.data.diceRolls,
            systemMessages: brainResult.data.systemMessages,
        };
    }
    catch (error) {
        console.error('Game processing error:', error);
        // Don't expose internal errors to client
        return {
            success: false,
            error: 'An internal error occurred',
        };
    }
});
exports.generateText = (0, https_1.onCall)({ cors: true, invoker: 'public' }, async (request) => {
    try {
        const { prompt, maxLength = 150 } = request.data;
        const auth = request.auth;
        if (!auth) {
            throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
        }
        if (!prompt || typeof prompt !== 'string') {
            throw new https_1.HttpsError('invalid-argument', 'Prompt is required');
        }
        // Get API key
        const keys = await getApiKeys();
        const openaiKey = keys.openai;
        console.log(`[GenerateText] API key exists: ${!!openaiKey}, length: ${openaiKey?.length || 0}`);
        if (!openaiKey) {
            console.error('[GenerateText] OpenAI API key not configured');
            throw new https_1.HttpsError('failed-precondition', 'OpenAI API key not configured');
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
            throw new https_1.HttpsError('internal', `Failed to generate text: ${error.substring(0, 100)}`);
        }
        const data = await response.json();
        const generatedText = data.choices[0]?.message?.content?.trim();
        if (!generatedText) {
            throw new https_1.HttpsError('internal', 'No text generated');
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
    }
    catch (error) {
        console.error('[GenerateText] Error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'An unexpected error occurred',
        };
    }
});
exports.verifyModelConfig = (0, https_1.onCall)({ cors: true, invoker: 'public' }, async (request) => {
    try {
        const { provider, model } = request.data;
        const auth = request.auth;
        if (!auth) {
            throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
        }
        console.log(`[Verify] Testing ${provider}/${model} for user ${auth.uid}`);
        // 1. Get Keys (System Keys only for now)
        const secrets = await getApiKeys();
        let apiKey = '';
        if (provider === 'openai')
            apiKey = secrets.openai;
        else if (provider === 'anthropic')
            apiKey = secrets.anthropic;
        else if (provider === 'google')
            apiKey = secrets.google;
        if (!apiKey) {
            return { success: false, error: `No system API key configured for ${provider}` };
        }
        // 2. Simple Ping
        console.log(`[Verify] Pinging ${provider} with model ${model}...`);
        const startTime = Date.now();
        let success = false;
        let message = '';
        if (provider === 'openai') {
            const openai = new openai_1.default({ apiKey });
            await openai.chat.completions.create({
                model: model,
                messages: [{ role: 'user', content: 'Ping' }],
                max_tokens: 5,
            });
            success = true;
            message = 'OpenAI Connection Verified';
        }
        else if (provider === 'anthropic') {
            const anthropic = new sdk_1.default({ apiKey });
            await anthropic.messages.create({
                model: model,
                max_tokens: 5,
                messages: [{ role: 'user', content: 'Ping' }],
            });
            success = true;
            message = 'Anthropic Connection Verified';
        }
        else if (provider === 'google') {
            const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
            const gModel = genAI.getGenerativeModel({ model: model });
            await gModel.generateContent('Ping');
            success = true;
            message = 'Google Connection Verified';
        }
        const latency = Date.now() - startTime;
        console.log(`[Verify] ${provider} success in ${latency}ms`);
        return { success, message, latency };
    }
    catch (error) {
        console.error('Verification failed:', error);
        // Return the raw error message to help debugging
        return {
            success: false,
            error: error.message || 'Verification Failed',
            details: JSON.stringify(error),
        };
    }
});
// Refresh model pricing from latest sources
exports.refreshModelPricing = (0, https_1.onCall)(async (request) => {
    try {
        const auth = request.auth;
        if (!auth) {
            throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
        }
        // Check if user is admin
        const userDoc = await db.collection('users').doc(auth.uid).get();
        const isAdmin = userDoc.data()?.role === 'admin';
        if (!isAdmin) {
            throw new https_1.HttpsError('permission-denied', 'Admin access required');
        }
        console.log(`[RefreshPricing] Fetching latest pricing for admin ${auth.uid}`);
        // Fetch latest pricing (fallback to known values since APIs don't exist)
        const pricing = {
            gpt4oMini: {
                prompt: 0.15, // $0.15 per 1M tokens (as of Dec 2024)
                completion: 0.60, // $0.60 per 1M tokens
            },
            claude: {
                prompt: 3.00, // $3.00 per 1M tokens (Claude Sonnet 3.5)
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
    }
    catch (error) {
        console.error('[RefreshPricing] Error:', error);
        throw error instanceof https_1.HttpsError ? error : new https_1.HttpsError('internal', 'Failed to refresh pricing');
    }
});
// Update model pricing manually
exports.updateModelPricing = (0, https_1.onCall)(async (request) => {
    try {
        const { gpt4oMini, claude } = request.data;
        const auth = request.auth;
        if (!auth) {
            throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
        }
        // Check if user is admin
        const userDoc = await db.collection('users').doc(auth.uid).get();
        const isAdmin = userDoc.data()?.role === 'admin';
        if (!isAdmin) {
            throw new https_1.HttpsError('permission-denied', 'Admin access required');
        }
        // Validate pricing values
        if (gpt4oMini) {
            if (gpt4oMini.prompt < 0 || gpt4oMini.completion < 0) {
                throw new https_1.HttpsError('invalid-argument', 'Pricing must be positive');
            }
        }
        if (claude) {
            if (claude.prompt < 0 || claude.completion < 0) {
                throw new https_1.HttpsError('invalid-argument', 'Pricing must be positive');
            }
        }
        console.log(`[UpdatePricing] Updating pricing for admin ${auth.uid}`);
        // Get current pricing
        const currentDoc = await db.collection('config').doc('modelPricing').get();
        const current = currentDoc.data() || {
            gpt4oMini: { prompt: 0.15, completion: 0.60 },
            claude: { prompt: 3.00, completion: 15.00 },
        };
        // Update with new values
        const updated = {
            gpt4oMini: gpt4oMini || current.gpt4oMini,
            claude: claude || current.claude,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: auth.uid,
        };
        await db.collection('config').doc('modelPricing').set(updated);
        console.log('[UpdatePricing] Pricing updated successfully');
        return { success: true };
    }
    catch (error) {
        console.error('[UpdatePricing] Error:', error);
        throw error instanceof https_1.HttpsError ? error : new https_1.HttpsError('internal', 'Failed to update pricing');
    }
});
// Get current model pricing
exports.getModelPricing = (0, https_1.onCall)(async (request) => {
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
    }
    catch (error) {
        console.error('[GetPricing] Error:', error);
        throw new https_1.HttpsError('internal', 'Failed to get pricing');
    }
});
// ==================== GLOBAL APP CONFIG ====================
exports.getGlobalConfig = (0, https_1.onCall)({ cors: true, invoker: 'public' }, async (request) => {
    try {
        const doc = await db.collection('config').doc('global').get();
        // Default config matching existing constants
        const defaultConfig = {
            subscriptionLimits: { scout: 15, hero: 300, legend: 999999 },
            subscriptionPricing: {
                scout: { price: 0, displayPrice: 'Free' },
                hero: { price: 999, displayPrice: '$9.99/month' },
                legend: { price: 4999, displayPrice: '$49.99 one-time' }
            },
            topUpPackages: [
                { id: 'topup_150', turns: 150, price: 500, displayPrice: '$5' },
                { id: 'topup_300', turns: 300, price: 1000, displayPrice: '$10' }
            ],
            worldModules: {
                classic: { enabled: true },
                outworlder: { enabled: true },
                tactical: { enabled: true }
            },
            systemSettings: {
                maintenanceMode: false,
                newRegistrationsOpen: true,
                debugLogging: false
            }
        };
        if (!doc.exists) {
            return defaultConfig;
        }
        // Merge with defaults to ensure all fields exist
        return { ...defaultConfig, ...doc.data() };
    }
    catch (error) {
        console.error('[GetGlobalConfig] Error:', error);
        throw new https_1.HttpsError('internal', 'Failed to get global config');
    }
});
exports.updateGlobalConfig = (0, https_1.onCall)({ cors: true, invoker: 'public' }, async (request) => {
    try {
        // Admin check
        const auth = request.auth;
        if (!auth)
            throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
        const userDoc = await db.collection('users').doc(auth.uid).get();
        const isAdmin = userDoc.data()?.role === 'admin';
        if (!isAdmin)
            throw new https_1.HttpsError('permission-denied', 'Admin access required');
        const updates = request.data;
        await db.collection('config').doc('global').set(updates, { merge: true });
        console.log(`[UpdateGlobalConfig] Config updated by ${auth.uid}`);
        return { success: true };
    }
    catch (error) {
        console.error('[UpdateGlobalConfig] Error:', error);
        throw error instanceof https_1.HttpsError ? error : new https_1.HttpsError('internal', 'Failed to update global config');
    }
});
// ==================== CAMPAIGN MANAGEMENT ====================
exports.createCampaign = (0, https_1.onCall)({ cors: true, invoker: 'public' }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be signed in');
    }
    const { name, worldModule: worldId, characterName, initialCharacter } = request.data;
    // Resolve world configuration from Firestore
    let worldData = null;
    try {
        const worldDoc = await db.collection('worlds').doc(worldId).get();
        if (worldDoc.exists) {
            worldData = worldDoc.data();
        }
    }
    catch (error) {
        console.error('[CreateCampaign] Failed to fetch world:', error);
    }
    let engineType = worldData?.type || worldId; // Fallback to worldId for legacy or if doc missing
    if (engineType === 'shadowMonarch')
        engineType = 'tactical';
    const campaignRef = db.collection('users')
        .doc(request.auth.uid)
        .collection('campaigns')
        .doc();
    const now = admin.firestore.FieldValue.serverTimestamp();
    // Resolve keys
    const secrets = await getApiKeys();
    // Fetch AI Settings to know which model to use for Voice
    let aiSettings = { brainModel: 'gpt-4o-mini', voiceModel: 'claude-3-5-sonnet' };
    try {
        const settingsDoc = await db.collection('config').doc('aiSettings').get();
        if (settingsDoc.exists) {
            aiSettings = settingsDoc.data();
        }
    }
    catch (error) {
        console.error('[CreateCampaign] Failed to fetch AI settings:', error);
    }
    const voiceConfig = resolveModelConfig(aiSettings.voiceModel, undefined, secrets); // No BYOK for intro yet
    // Get knowledge for generating intro (limit to 2 most relevant docs to save tokens)
    const voiceKnowledgeDocs = await (0, exports.getKnowledgeForModule)(engineType, 'voice', 2);
    // Generate initial narrative
    let initialNarrative = worldData?.initialNarrative || '';
    // Only use AI generation if explicitly enabled for this world and we have a key
    if (voiceConfig.key && worldData?.generateIntro) {
        try {
            const voiceResult = await (0, voice_1.generateNarrative)({
                narrativeCues: [{
                        type: 'description',
                        content: `A new adventure in the world of ${worldData?.name || engineType} begins. The setting is: ${worldData?.description || 'unknown'}. The character ${characterName || 'our hero'} is about to start their journey.`,
                        emotion: 'mysterious',
                    }],
                worldModule: engineType,
                chatHistory: [],
                stateChanges: {},
                diceRolls: [],
                apiKey: voiceConfig.key,
                provider: voiceConfig.provider,
                model: voiceConfig.model,
                knowledgeDocuments: voiceKnowledgeDocs,
                customRules: worldData?.customRules,
            });
            if (voiceResult.success && voiceResult.narrative) {
                initialNarrative = voiceResult.narrative;
            }
        }
        catch (narrativeError) {
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
});
exports.deleteCampaign = (0, https_1.onCall)({ cors: true, invoker: 'public' }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be signed in');
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
exports.exportUserData = (0, https_1.onCall)({ cors: true, invoker: 'public' }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be signed in');
    }
    const userId = request.auth.uid;
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const campaignsSnapshot = await db.collection('users')
        .doc(userId)
        .collection('campaigns')
        .get();
    const campaigns = await Promise.all(campaignsSnapshot.docs.map(async (doc) => {
        const campaignData = doc.data();
        const messagesSnapshot = await doc.ref.collection('messages').get();
        const messages = messagesSnapshot.docs.map(msgDoc => msgDoc.data());
        return {
            ...campaignData,
            messages,
        };
    }));
    return {
        user: userData,
        campaigns,
        exportedAt: new Date().toISOString(),
    };
});
// ==================== ADMIN DASHBOARD ====================
// Helper for timestamp formatting
function formatTimestamp(val) {
    if (!val)
        return null;
    if (typeof val?.toDate === 'function')
        return val.toDate().toISOString();
    if (typeof val === 'number')
        return new Date(val).toISOString();
    return val; // String or other
}
exports.getAdminDashboardData = (0, https_1.onCall)({ cors: true, invoker: 'public' }, async (request) => {
    try {
        if (!request.auth) {
            throw new https_1.HttpsError('unauthenticated', 'User must be signed in');
        }
        // Verify admin role 
        const callerDoc = await db.collection('users').doc(request.auth.uid).get();
        const callerData = callerDoc.data();
        if (callerData?.role !== 'admin') {
            throw new https_1.HttpsError('permission-denied', 'Admin access required');
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
    }
    catch (error) {
        console.error('getAdminDashboardData Error:', error);
        if (error.code) {
            throw error;
        }
        throw new https_1.HttpsError('internal', error.message || 'Unknown error');
    }
});
exports.adminUpdateUser = (0, https_1.onCall)({ cors: true, invoker: 'public' }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be signed in');
    }
    const callerDoc = await db.collection('users').doc(request.auth.uid).get();
    if (callerDoc.data()?.role !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Admin access required');
    }
    const { targetUserId, updates } = request.data;
    await db.collection('users').doc(targetUserId).update(updates);
    return { success: true };
});
exports.addKnowledgeDocument = (0, https_1.onCall)({
    cors: ['https://infinite-realms-5dcba.web.app', 'https://infinite-realms-5dcba.firebaseapp.com'],
    invoker: 'public'
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be signed in');
    }
    // Verify admin role
    const callerDoc = await db.collection('users').doc(request.auth.uid).get();
    if (callerDoc.data()?.role !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Admin access required');
    }
    const { name, worldModule, content, category, targetModel } = request.data;
    if (!name || !worldModule || !content || !category || !targetModel) {
        throw new https_1.HttpsError('invalid-argument', 'Missing required fields: name, worldModule, content, category, targetModel');
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
exports.getKnowledgeDocuments = (0, https_1.onCall)({
    cors: ['https://infinite-realms-5dcba.web.app', 'https://infinite-realms-5dcba.firebaseapp.com'],
    invoker: 'public'
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be signed in');
    }
    // Verify admin role
    const callerDoc = await db.collection('users').doc(request.auth.uid).get();
    if (callerDoc.data()?.role !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Admin access required');
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
exports.updateKnowledgeDocument = (0, https_1.onCall)({
    cors: ['https://infinite-realms-5dcba.web.app', 'https://infinite-realms-5dcba.firebaseapp.com'],
    invoker: 'public'
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be signed in');
    }
    // Verify admin role
    const callerDoc = await db.collection('users').doc(request.auth.uid).get();
    if (callerDoc.data()?.role !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Admin access required');
    }
    const { documentId, updates } = request.data;
    if (!documentId) {
        throw new https_1.HttpsError('invalid-argument', 'Document ID required');
    }
    const docRef = db.collection('knowledgeBase').doc(documentId);
    const doc = await docRef.get();
    if (!doc.exists) {
        throw new https_1.HttpsError('not-found', 'Document not found');
    }
    await docRef.update({
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
});
exports.deleteKnowledgeDocument = (0, https_1.onCall)({
    cors: ['https://infinite-realms-5dcba.web.app', 'https://infinite-realms-5dcba.firebaseapp.com'],
    invoker: 'public'
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be signed in');
    }
    // Verify admin role
    const callerDoc = await db.collection('users').doc(request.auth.uid).get();
    if (callerDoc.data()?.role !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Admin access required');
    }
    const { documentId } = request.data;
    if (!documentId) {
        throw new https_1.HttpsError('invalid-argument', 'Document ID required');
    }
    await db.collection('knowledgeBase').doc(documentId).delete();
    return { success: true };
});
// Helper for game logic to fetch knowledge documents
// modelFilter: 'brain' for OpenAI, 'voice' for Claude
// maxDocs: limit number of documents to reduce token usage
const getKnowledgeForModule = async (worldModule, modelFilter, maxDocs = 3) => {
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
exports.getKnowledgeForModule = getKnowledgeForModule;
// ==================== API KEY MANAGEMENT ====================
const SECRET_NAMES = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    google: 'GOOGLE_API_KEY',
};
// Get the status of configured API keys (masked hints only - never full keys)
exports.getApiKeyStatus = (0, https_1.onCall)({ cors: true, invoker: 'public' }, async (request) => {
    // Admin check
    const auth = request.auth;
    if (!auth)
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const isAdmin = userDoc.data()?.role === 'admin';
    if (!isAdmin)
        throw new https_1.HttpsError('permission-denied', 'Admin access required');
    const getHint = (key) => {
        if (!key || key.length < 8) {
            return { set: false, hint: '' };
        }
        // Show first 4 and last 4 characters
        const first = key.substring(0, 4);
        const last = key.substring(key.length - 4);
        return { set: true, hint: `${first}...${last}` };
    };
    // Get keys from Firestore first, fallback to Secret Manager
    const keys = await getApiKeys();
    return {
        openai: getHint(keys.openai),
        anthropic: getHint(keys.anthropic),
        google: getHint(keys.google),
    };
});
// Update an API key in Secret Manager
exports.updateApiKey = (0, https_1.onCall)({ cors: true, invoker: 'public' }, async (request) => {
    // Admin check
    const auth = request.auth;
    if (!auth)
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const isAdmin = userDoc.data()?.role === 'admin';
    if (!isAdmin)
        throw new https_1.HttpsError('permission-denied', 'Admin access required');
    const { provider, key } = request.data;
    // Validate input
    if (!provider || !['openai', 'anthropic', 'google'].includes(provider)) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid provider. Must be openai, anthropic, or google.');
    }
    if (!key || typeof key !== 'string' || key.length < 10) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid API key. Key must be at least 10 characters.');
    }
    // Basic format validation
    if (provider === 'openai' && !key.startsWith('sk-')) {
        throw new https_1.HttpsError('invalid-argument', 'OpenAI keys should start with "sk-"');
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
    }
    catch (error) {
        console.error('[UpdateApiKey] Error:', error);
        throw new https_1.HttpsError('internal', `Failed to update API key: ${error.message}`);
    }
});
//# sourceMappingURL=index.js.map