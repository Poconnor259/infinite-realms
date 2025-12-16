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
exports.exportUserData = exports.deleteCampaign = exports.createCampaign = exports.processGameAction = void 0;
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
        // Step 1: Process with Brain (Logic Engine)
        console.log(`[Brain] Processing action for campaign ${campaignId}: "${userInput}"`);
        const brainResult = await (0, brain_1.processWithBrain)({
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
        let narrativeText;
        if (!anthropicKey) {
            // Fallback if no Anthropic key available
            narrativeText = brainResult.data?.narrativeCue ||
                `*${userInput}*\n\nThe action has been processed.`;
        }
        else {
            console.log('[Voice] Generating narrative with Claude');
            const voiceResult = await (0, voice_1.generateNarrative)({
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
            }
            else {
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
exports.createCampaign = (0, https_1.onCall)({ cors: true, invoker: 'public' }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be signed in');
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
//# sourceMappingURL=index.js.map