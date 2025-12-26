import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

// Get Firestore instance (admin is initialized in index.ts)
const db = admin.firestore();

// ==================== CAMPAIGN SAVES ====================

// Save current campaign state
export const saveCampaignState = onCall(
    async (request) => {
        try {
            const { campaignId, saveName } = request.data as { campaignId: string; saveName: string };
            const auth = request.auth;

            if (!auth) {
                throw new HttpsError('unauthenticated', 'User must be authenticated');
            }

            if (!campaignId || !saveName) {
                throw new HttpsError('invalid-argument', 'Campaign ID and save name are required');
            }

            // Get campaign data
            const campaignRef = db.collection('users').doc(auth.uid).collection('campaigns').doc(campaignId);
            const campaignDoc = await campaignRef.get();

            if (!campaignDoc.exists) {
                throw new HttpsError('not-found', 'Campaign not found');
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
                throw new HttpsError('resource-exhausted', 'Maximum 10 saves per campaign. Please delete an old save first.');
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

        } catch (error) {
            console.error('[SaveCampaign] Error:', error);
            throw error instanceof HttpsError ? error : new HttpsError('internal', 'Failed to save campaign');
        }
    }
);

// Get all saves for a campaign
export const getCampaignSaves = onCall(
    async (request) => {
        try {
            const { campaignId } = request.data as { campaignId: string };
            const auth = request.auth;

            if (!auth) {
                throw new HttpsError('unauthenticated', 'User must be authenticated');
            }

            if (!campaignId) {
                throw new HttpsError('invalid-argument', 'Campaign ID is required');
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

        } catch (error) {
            console.error('[GetCampaignSaves] Error:', error);
            throw error instanceof HttpsError ? error : new HttpsError('internal', 'Failed to get saves');
        }
    }
);

// Load a specific save
export const loadCampaignSave = onCall(
    async (request) => {
        try {
            const { campaignId, saveId } = request.data as { campaignId: string; saveId: string };
            const auth = request.auth;

            if (!auth) {
                throw new HttpsError('unauthenticated', 'User must be authenticated');
            }

            if (!campaignId || !saveId) {
                throw new HttpsError('invalid-argument', 'Campaign ID and save ID are required');
            }

            const saveDoc = await db.collection('users')
                .doc(auth.uid)
                .collection('campaigns')
                .doc(campaignId)
                .collection('saves')
                .doc(saveId)
                .get();

            if (!saveDoc.exists) {
                throw new HttpsError('not-found', 'Save not found');
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

        } catch (error) {
            console.error('[LoadCampaignSave] Error:', error);
            throw error instanceof HttpsError ? error : new HttpsError('internal', 'Failed to load save');
        }
    }
);

// Delete a save
export const deleteCampaignSave = onCall(
    async (request) => {
        try {
            const { campaignId, saveId } = request.data as { campaignId: string; saveId: string };
            const auth = request.auth;

            if (!auth) {
                throw new HttpsError('unauthenticated', 'User must be authenticated');
            }

            if (!campaignId || !saveId) {
                throw new HttpsError('invalid-argument', 'Campaign ID and save ID are required');
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

        } catch (error) {
            console.error('[DeleteCampaignSave] Error:', error);
            throw error instanceof HttpsError ? error : new HttpsError('internal', 'Failed to delete save');
        }
    }
);
