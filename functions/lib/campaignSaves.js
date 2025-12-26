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
exports.deleteCampaignSave = exports.loadCampaignSave = exports.getCampaignSaves = exports.saveCampaignState = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
// Get Firestore instance (admin is initialized in index.ts)
const db = admin.firestore();
// ==================== CAMPAIGN SAVES ====================
// Save current campaign state
exports.saveCampaignState = (0, https_1.onCall)(async (request) => {
    try {
        const { campaignId, saveName } = request.data;
        const auth = request.auth;
        if (!auth) {
            throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
        }
        if (!campaignId || !saveName) {
            throw new https_1.HttpsError('invalid-argument', 'Campaign ID and save name are required');
        }
        // Get campaign data
        const campaignRef = db.collection('users').doc(auth.uid).collection('campaigns').doc(campaignId);
        const campaignDoc = await campaignRef.get();
        if (!campaignDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Campaign not found');
        }
        const campaign = campaignDoc.data();
        // Get last 50 messages for context
        const messagesSnapshot = await campaignRef.collection('messages')
            .orderBy('timestamp', 'desc')
            .limit(50)
            .get();
        const messages = messagesSnapshot.docs.map(doc => doc.data()).reverse();
        // Check save count limit (max 10)
        const savesSnapshot = await campaignRef.collection('saves').get();
        if (savesSnapshot.size >= 10) {
            throw new https_1.HttpsError('resource-exhausted', 'Maximum 10 saves per campaign. Please delete an old save first.');
        }
        // Create save document
        const saveData = {
            name: saveName,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            version: 1,
            worldType: campaign?.worldModule || 'unknown',
            moduleState: campaign?.moduleState || {},
            messageCount: messages.length,
            lastMessages: messages,
        };
        const saveRef = await campaignRef.collection('saves').add(saveData);
        console.log(`[SaveCampaign] Created save ${saveRef.id} for campaign ${campaignId}`);
        return {
            success: true,
            saveId: saveRef.id,
            message: 'Campaign saved successfully'
        };
    }
    catch (error) {
        console.error('[SaveCampaign] Error:', error);
        throw error instanceof https_1.HttpsError ? error : new https_1.HttpsError('internal', 'Failed to save campaign');
    }
});
// Get all saves for a campaign
exports.getCampaignSaves = (0, https_1.onCall)(async (request) => {
    try {
        const { campaignId } = request.data;
        const auth = request.auth;
        if (!auth) {
            throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
        }
        if (!campaignId) {
            throw new https_1.HttpsError('invalid-argument', 'Campaign ID is required');
        }
        const savesSnapshot = await db.collection('users')
            .doc(auth.uid)
            .collection('campaigns')
            .doc(campaignId)
            .collection('saves')
            .orderBy('createdAt', 'desc')
            .get();
        const saves = savesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            // Don't send full message history in list view
            lastMessages: undefined
        }));
        return {
            success: true,
            saves,
            count: saves.length
        };
    }
    catch (error) {
        console.error('[GetCampaignSaves] Error:', error);
        throw error instanceof https_1.HttpsError ? error : new https_1.HttpsError('internal', 'Failed to get saves');
    }
});
// Load a specific save
exports.loadCampaignSave = (0, https_1.onCall)(async (request) => {
    try {
        const { campaignId, saveId } = request.data;
        const auth = request.auth;
        if (!auth) {
            throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
        }
        if (!campaignId || !saveId) {
            throw new https_1.HttpsError('invalid-argument', 'Campaign ID and save ID are required');
        }
        const saveDoc = await db.collection('users')
            .doc(auth.uid)
            .collection('campaigns')
            .doc(campaignId)
            .collection('saves')
            .doc(saveId)
            .get();
        if (!saveDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Save not found');
        }
        const saveData = saveDoc.data();
        // Restore campaign state
        await db.collection('users')
            .doc(auth.uid)
            .collection('campaigns')
            .doc(campaignId)
            .update({
            moduleState: saveData?.moduleState || {},
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`[LoadCampaignSave] Loaded save ${saveId} for campaign ${campaignId}`);
        return {
            success: true,
            message: 'Save loaded successfully',
            moduleState: saveData?.moduleState
        };
    }
    catch (error) {
        console.error('[LoadCampaignSave] Error:', error);
        throw error instanceof https_1.HttpsError ? error : new https_1.HttpsError('internal', 'Failed to load save');
    }
});
// Delete a save
exports.deleteCampaignSave = (0, https_1.onCall)(async (request) => {
    try {
        const { campaignId, saveId } = request.data;
        const auth = request.auth;
        if (!auth) {
            throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
        }
        if (!campaignId || !saveId) {
            throw new https_1.HttpsError('invalid-argument', 'Campaign ID and save ID are required');
        }
        await db.collection('users')
            .doc(auth.uid)
            .collection('campaigns')
            .doc(campaignId)
            .collection('saves')
            .doc(saveId)
            .delete();
        console.log(`[DeleteCampaignSave] Deleted save ${saveId} for campaign ${campaignId}`);
        return {
            success: true,
            message: 'Save deleted successfully'
        };
    }
    catch (error) {
        console.error('[DeleteCampaignSave] Error:', error);
        throw error instanceof https_1.HttpsError ? error : new https_1.HttpsError('internal', 'Failed to delete save');
    }
});
//# sourceMappingURL=campaignSaves.js.map