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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getKnowledgeForModule = exports.deleteKnowledgeDocument = exports.updateKnowledgeDocument = exports.getKnowledgeDocuments = exports.addKnowledgeDocument = exports.adminUpdateUser = exports.getAdminDashboardData = exports.exportUserData = exports.deleteCampaign = exports.createCampaign = exports.processGameAction = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const admin = __importStar(require("firebase-admin"));
const brain_1 = require("./brain");
const voice_1 = require("./voice");
// Initialize Firebase Admin
admin.initializeApp();
// Get Firestore instance
const db = admin.firestore();
// Define secrets
const openaiApiKey = (0, params_1.defineSecret)('OPENAI_API_KEY');
const anthropicApiKey = (0, params_1.defineSecret)('ANTHROPIC_API_KEY');
// ==================== MAIN GAME ENDPOINT ====================
exports.processGameAction = (0, https_1.onCall)({ secrets: [openaiApiKey, anthropicApiKey], cors: true, invoker: 'public' }, async (request) => {
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
        // Determine which API keys to use
        const openaiKey = byokKeys?.openai || openaiApiKey.value();
        const anthropicKey = byokKeys?.anthropic || anthropicApiKey.value();
        // DEBUG LOGGING
        console.log(`[Auth Debug] hasByok: ${!!byokKeys?.openai}, hasSecret: ${!!openaiApiKey.value()}`);
        if (openaiKey) {
            console.log(`[Auth Debug] Key used starts with: ${openaiKey.substring(0, 8)}... ends with: ...${openaiKey.slice(-4)} (Length: ${openaiKey.length})`);
        }
        else {
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
        console.log(`[Knowledge] Fetching documents for ${worldModule} (Voice only)...`);
        const voiceKnowledgeDocs = await (0, exports.getKnowledgeForModule)(worldModule, 'voice');
        console.log(`[Knowledge] Found ${voiceKnowledgeDocs.length} voice docs`);
        // Step 1: Process with Brain (Logic Engine)
        console.log(`[Brain] Processing action for campaign ${campaignId}: "${userInput}"`);
        // Brain only needs last 3 messages for context (saves ~2k tokens)
        const brainResult = await (0, brain_1.processWithBrain)({
            userInput,
            worldModule,
            currentState,
            chatHistory: chatHistory.slice(-3),
            apiKey: openaiKey,
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
        let narrativeText;
        let totalPromptTokens = brainResult.usage?.promptTokens || 0;
        let totalCompletionTokens = brainResult.usage?.completionTokens || 0;
        if (!anthropicKey) {
            // Fallback if no Anthropic key available
            narrativeText = brainResult.data?.narrativeCue ||
                `*${userInput}*\n\nThe action has been processed.`;
        }
        else {
            console.log('[Voice] Generating narrative with Claude');
            // Voice gets knowledge docs for lore, but only last 4 messages for narrative flow
            const voiceResult = await (0, voice_1.generateNarrative)({
                narrativeCues: brainResult.data?.narrativeCues || [],
                worldModule,
                chatHistory: chatHistory.slice(-4),
                stateChanges: brainResult.data?.stateUpdates || {},
                diceRolls: brainResult.data?.diceRolls || [],
                apiKey: anthropicKey,
                knowledgeDocuments: voiceKnowledgeDocs,
            });
            if (voiceResult.usage) {
                totalPromptTokens += voiceResult.usage.promptTokens;
                totalCompletionTokens += voiceResult.usage.completionTokens;
            }
            if (!voiceResult.success) {
                narrativeText = brainResult.data?.narrativeCue ||
                    'The narrator seems momentarily distracted...';
            }
            else {
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
                // Increment user's turn/token usage
                await db.collection('users').doc(auth.uid).update({
                    turnsUsed: admin.firestore.FieldValue.increment(1),
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
            }
            catch (dbError) {
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
    }
    catch (error) {
        console.error('Game processing error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'An unexpected error occurred',
        };
    }
});
// ==================== CAMPAIGN MANAGEMENT ====================
exports.createCampaign = (0, https_1.onCall)({ secrets: [openaiApiKey, anthropicApiKey], cors: true, invoker: 'public' }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be signed in');
    }
    const { name, worldModule, characterName, initialCharacter } = request.data;
    const campaignRef = db.collection('users')
        .doc(request.auth.uid)
        .collection('campaigns')
        .doc();
    const now = admin.firestore.FieldValue.serverTimestamp();
    // Get API keys
    const anthropicKey = anthropicApiKey.value();
    // Get knowledge for generating intro (limit to 2 most relevant docs to save tokens)
    const voiceKnowledgeDocs = await (0, exports.getKnowledgeForModule)(worldModule, 'voice', 2);
    // Generate initial narrative with Claude
    let initialNarrative = '';
    if (anthropicKey) {
        try {
            const voiceResult = await (0, voice_1.generateNarrative)({
                narrativeCues: [{
                        type: 'description',
                        content: `A new ${worldModule} adventure begins. The character ${characterName || 'our hero'} is about to start their journey.`,
                        emotion: 'mysterious',
                    }],
                worldModule,
                chatHistory: [],
                stateChanges: {},
                diceRolls: [],
                apiKey: anthropicKey,
                knowledgeDocuments: voiceKnowledgeDocs,
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
        switch (worldModule) {
            case 'classic':
                initialNarrative = `*The tavern is warm and loud. You sit in the corner, polishing your gear. A shadow falls across your table.*`;
                break;
            case 'outworlder':
                initialNarrative = `*Darkness... then light. Blinding, violet light. You gasp for air as you wake up in a strange forest.*`;
                break;
            case 'shadowMonarch':
                initialNarrative = `*[SYSTEM NOTIFICATION]*\n\n*Validation complete. Player registered. Welcome, Hunter.*`;
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
        worldModule,
        character,
        moduleState: {
            type: worldModule,
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
//# sourceMappingURL=index.js.map