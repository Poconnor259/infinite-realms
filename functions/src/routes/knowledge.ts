import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

export interface KnowledgeDocument {
    id?: string;
    name: string;
    worldModule: 'global' | 'classic' | 'outworlder' | 'tactical';
    content: string;
    category: 'lore' | 'rules' | 'characters' | 'locations' | 'other';
    targetModel: 'brain' | 'voice' | 'both';
    uploadedBy?: string;
    createdAt?: FirebaseFirestore.Timestamp;
    updatedAt?: FirebaseFirestore.Timestamp;
    enabled: boolean;
}

export const addKnowledgeDocument = onCall({
    cors: true,
    invoker: 'public'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be signed in');
    }

    const db = admin.firestore();

    // Verify admin role
    const callerDoc = await db.collection('users').doc(request.auth.uid).get();
    if (callerDoc.data()?.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Only admins can add knowledge base documents');
    }

    const data = request.data as Partial<KnowledgeDocument>;

    if (!data.name || !data.worldModule || !data.content || !data.category || !data.targetModel) {
        throw new HttpsError('invalid-argument', 'Missing required fields');
    }

    const now = admin.firestore.Timestamp.now();

    const docRef = await db.collection('knowledgeBase').add({
        name: data.name,
        worldModule: data.worldModule,
        content: data.content,
        category: data.category,
        targetModel: data.targetModel,
        uploadedBy: request.auth.uid,
        createdAt: now,
        updatedAt: now,
        enabled: true,
    });

    return { id: docRef.id, success: true };
});

export const getKnowledgeDocuments = onCall({
    cors: true,
    invoker: 'public'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be signed in');
    }

    const db = admin.firestore();

    // Verify admin role
    const callerDoc = await db.collection('users').doc(request.auth.uid).get();
    if (callerDoc.data()?.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Only admins can view knowledge base documents');
    }

    const snapshot = await db.collection('knowledgeBase').orderBy('createdAt', 'desc').get();
    const documents = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: data.name,
            worldModule: data.worldModule,
            category: data.category,
            targetModel: data.targetModel,
            content: data.content, // For admin UI, we might want the full content
            createdAt: data.createdAt?.toMillis(),
            updatedAt: data.updatedAt?.toMillis(),
            enabled: data.enabled ?? true,
        };
    });

    return { documents };
});

export const updateKnowledgeDocument = onCall({
    cors: ['https://atlas-cortex.web.app', 'https://atlas-cortex.firebaseapp.com'],
    invoker: 'public'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be signed in');
    }

    const db = admin.firestore();

    // Verify admin role
    const callerDoc = await db.collection('users').doc(request.auth.uid).get();
    if (callerDoc.data()?.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Only admins can update knowledge base documents');
    }

    const { id, ...updateData } = request.data;
    if (!id) {
        throw new HttpsError('invalid-argument', 'Document ID required');
    }

    // Filter out fields that shouldn't be updated
    const safeUpdateData = { ...updateData };
    delete safeUpdateData.createdAt;
    delete safeUpdateData.uploadedBy;
    safeUpdateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await db.collection('knowledgeBase').doc(id).update(safeUpdateData);

    return { success: true };
});

export const deleteKnowledgeDocument = onCall({
    cors: ['https://atlas-cortex.web.app', 'https://atlas-cortex.firebaseapp.com'],
    invoker: 'public'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be signed in');
    }

    const db = admin.firestore();

    // Verify admin role
    const callerDoc = await db.collection('users').doc(request.auth.uid).get();
    if (callerDoc.data()?.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Only admins can delete knowledge base documents');
    }

    const { documentId } = request.data;

    if (!documentId) {
        throw new HttpsError('invalid-argument', 'Document ID required');
    }

    await db.collection('knowledgeBase').doc(documentId).delete();

    return { success: true };
});
