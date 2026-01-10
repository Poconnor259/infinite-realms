import { initializeApp, getApps } from 'firebase/app';
import {
    getAuth,
    signInAnonymously,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    sendPasswordResetEmail,
    updateProfile,
    linkWithCredential,
    EmailAuthProvider,
    GoogleAuthProvider,
    signInWithPopup,
    sendEmailVerification,
    onAuthStateChanged,
    type User
} from 'firebase/auth';
import type { WorldModule, GameEngine, GlobalConfig, SubscriptionTier } from './types';
import {
    getFirestore,
    collection,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    getDocs,
    deleteDoc,
    serverTimestamp,
    query,
    orderBy,
    limit,
    onSnapshot
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Firebase configuration - with fallback for static export
const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCuCsTTt0DMv9dDhzxgveviyV6LJIjr7IY',
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'infinite-realms-5dcba.firebaseapp.com',
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'infinite-realms-5dcba',
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'infinite-realms-5dcba.firebasestorage.app',
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '714188392386',
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:714188392386:web:c877b12b8068343571b85b',
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-GNFMNEW2TZ'
};

// Initialize Firebase (only once)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Firebase services
let _auth: any;
let _db: any;
let _functions: any;

try {
    _auth = getAuth(app);
} catch (error: any) {
    console.warn('[Firebase] Auth initialization warning:', error.message);
}

try {
    _db = getFirestore(app);
} catch (error: any) {
    console.warn('[Firebase] Firestore initialization warning:', error.message);
}

try {
    _functions = getFunctions(app);
} catch (error: any) {
    console.warn('[Firebase] Functions initialization warning:', error.message);
}

let _storage: any;
try {
    _storage = getStorage(app);
} catch (error: any) {
    console.warn('[Firebase] Storage initialization warning:', error.message);
}

export const auth = _auth;
export const db = _db;
export const functions = _functions;
export const storage = _storage;

// ==================== AUTH HELPERS ====================

export async function signInAnonymouslyIfNeeded(): Promise<User | null> {
    if (auth.currentUser) {
        return auth.currentUser;
    }

    try {
        const result = await signInAnonymously(auth);
        console.log('Signed in anonymously:', result.user.uid);
        return result.user;
    } catch (error) {
        console.error('Anonymous sign-in failed:', error);
        return null;
    }
}

export function onAuthChange(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback);
}

// ==================== EMAIL/PASSWORD AUTH ====================

export async function signUpWithEmail(
    email: string,
    password: string,
    displayName?: string
): Promise<{ user: User | null; error: string | null }> {
    try {
        const result = await createUserWithEmailAndPassword(auth, email, password);

        // Update display name if provided
        if (displayName && result.user) {
            await updateProfile(result.user, { displayName });
        }

        // Send verification email
        if (result.user) {
            await sendEmailVerification(result.user);
            console.log('Verification email sent to:', email);
        }

        console.log('User signed up:', result.user.uid);
        return { user: result.user, error: null };
    } catch (error: any) {
        console.error('Sign up failed:', error);
        let errorMessage = 'Failed to create account';

        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'Email already in use';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Password should be at least 6 characters';
        }

        return { user: null, error: errorMessage };
    }
}

export async function signInWithEmail(
    email: string,
    password: string
): Promise<{ user: User | null; error: string | null }> {
    try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        console.log('User signed in:', result.user.uid);
        return { user: result.user, error: null };
    } catch (error: any) {
        console.error('Sign in failed:', error);
        let errorMessage = 'Failed to sign in';

        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            errorMessage = 'Invalid email or password';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Too many attempts. Try again later';
        }

        return { user: null, error: errorMessage };
    }
}

export async function signOut(): Promise<void> {
    try {
        await firebaseSignOut(auth);
        console.log('User signed out');
    } catch (error) {
        console.error('Sign out failed:', error);
        throw error;
    }
}

export async function signInWithGoogle() {
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        return result.user;
    } catch (error: any) {
        console.error('Google sign-in failed:', error);
        throw error;
    }
}

export async function resendVerificationEmail(user: User): Promise<void> {
    try {
        await sendEmailVerification(user);
        console.log('Verification email resent to:', user.email);
    } catch (error: any) {
        console.error('Failed to resend verification email:', error);
        throw error;
    }
}

export async function resetPassword(email: string): Promise<{ success: boolean; error: string | null }> {
    try {
        await sendPasswordResetEmail(auth, email);
        console.log('Password reset email sent to:', email);
        return { success: true, error: null };
    } catch (error: any) {
        console.error('Password reset failed:', error);
        let errorMessage = 'Failed to send password reset email';

        if (error.code === 'auth/user-not-found') {
            errorMessage = 'No account found with this email';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address';
        }

        return { success: false, error: errorMessage };
    }
}

// Link anonymous account to email/password
export async function linkAnonymousToEmail(
    email: string,
    password: string
): Promise<{ user: User | null; error: string | null }> {
    try {
        if (!auth.currentUser || !auth.currentUser.isAnonymous) {
            return { user: null, error: 'No anonymous user to link' };
        }

        const credential = EmailAuthProvider.credential(email, password);
        const result = await linkWithCredential(auth.currentUser, credential);

        console.log('Anonymous account linked to email:', result.user.uid);
        return { user: result.user, error: null };
    } catch (error: any) {
        console.error('Account linking failed:', error);
        let errorMessage = 'Failed to link account';

        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'Email already in use';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Password should be at least 6 characters';
        }

        return { user: null, error: errorMessage };
    }
}

// Check if user has password provider
export function hasPasswordProvider(user: User | null): boolean {
    if (!user || !user.providerData) return false;
    return user.providerData.some(provider => provider.providerId === 'password');
}

// Add password to existing SSO account
export async function addPasswordToAccount(
    email: string,
    password: string
): Promise<{ success: boolean; error: string | null }> {
    try {
        if (!auth.currentUser) {
            return { success: false, error: 'No user signed in' };
        }

        // Check if user already has password provider
        if (hasPasswordProvider(auth.currentUser)) {
            return { success: false, error: 'Account already has a password' };
        }

        const credential = EmailAuthProvider.credential(email, password);
        await linkWithCredential(auth.currentUser, credential);

        console.log('Password added to account:', auth.currentUser.uid);
        return { success: true, error: null };
    } catch (error: any) {
        console.error('Failed to add password:', error);
        let errorMessage = 'Failed to add password';

        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'Email already in use by another account';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Password should be at least 6 characters';
        } else if (error.code === 'auth/requires-recent-login') {
            errorMessage = 'Please sign out and sign in again before adding a password';
        }

        return { success: false, error: errorMessage };
    }
}


// ====================CLOUD FUNCTIONS ====================

// Matches GameRequest in functions/src/index.ts
export interface ProcessInputRequest {
    campaignId: string;
    userInput: string;
    worldModule: 'classic' | 'outworlder' | 'tactical';
    currentState: Record<string, unknown>;
    chatHistory: Array<{ role: string; content: string }>;
    userTier: SubscriptionTier;
    byokKeys?: {
        openai?: string;
        anthropic?: string;
    };
    interactiveDiceRolls?: boolean;
    rollResult?: number;
    pendingRoll?: any; // Enhanced roll data for Fate Engine
}

export interface ProcessInputResponse {
    success: boolean;
    narrativeText?: string;
    stateUpdates?: Record<string, unknown>;
    diceRolls?: Array<any>;
    systemMessages?: string[];
    requiresUserInput?: boolean;
    pendingChoice?: {
        prompt: string;
        options?: string[];
        choiceType: string;
    };
    pendingRoll?: {
        type: string;
        purpose: string;
        modifier?: number;
        stat?: string;
        difficulty?: number;
    };
    remainingTurns?: number;
    voiceModelId?: string;
    turnCost?: number;
    error?: string;
    debug?: {
        brainResponse?: any;
        stateReport?: any;
        reviewerResult?: any;
        models?: {
            brain: string;
            voice: string;
        };
    };
}

export interface CreateCampaignRequest {
    name: string;
    worldModule: string;
    characterName: string;
    initialCharacter?: any; // ModuleCharacter type - will be validated by backend
}

export interface CreateCampaignResponse {
    campaignId: string;
}

export const createCampaign = httpsCallable<CreateCampaignRequest, CreateCampaignResponse>(
    functions,
    'createCampaign'
);

export const processGameAction = httpsCallable<ProcessInputRequest, ProcessInputResponse>(
    functions,
    'processGameAction'
);

// Generate text with AI (for character creation, testing, etc.)
export const generateText = httpsCallable<
    { prompt: string; maxLength?: number; modelId?: string },
    { success: boolean; text?: string; error?: string }
>(functions, 'generateText');

// Model pricing management
export const getAvailableModels = httpsCallable<
    void,
    { success: boolean; models: any[] }
>(functions, 'getAvailableModels');

export const refreshModelPricing = httpsCallable<
    void,
    { success: boolean; pricing: { gpt4oMini: { prompt: number; completion: number }; claude: { prompt: number; completion: number } } }
>(functions, 'refreshModelPricing');

export const updateModelPricing = httpsCallable<
    { gpt4oMini?: { prompt: number; completion: number }; claude?: { prompt: number; completion: number } },
    { success: boolean }
>(functions, 'updateModelPricing');

export const getModelPricing = httpsCallable<
    void,
    { gpt4oMini: { prompt: number; completion: number }; claude: { prompt: number; completion: number } }
>(functions, 'getModelPricing');

export const getGlobalConfig = httpsCallable<void, GlobalConfig>(
    functions,
    'getGlobalConfig'
);

export const updateGlobalConfig = httpsCallable<Partial<GlobalConfig>, { success: boolean }>(
    functions,
    'updateGlobalConfig'
);

export const deleteCampaignFn = httpsCallable<{ campaignId: string }, { success: boolean }>(
    functions,
    'deleteCampaign'
);

// API Key Management
export type ApiProvider = 'openai' | 'anthropic' | 'google';

export interface ApiKeyStatus {
    openai: { set: boolean; hint: string };
    anthropic: { set: boolean; hint: string };
    google: { set: boolean; hint: string };
}


// Get API key status from Cloud Function (reads from Firestore with Secret Manager fallback)
// Cloud Functions References
export const getApiKeyStatus = _functions ? httpsCallable<void, ApiKeyStatus>(_functions, 'getApiKeyStatus') : null as any;
export const updateApiKey = _functions ? httpsCallable<{ provider: ApiProvider; key: string }, { success: boolean }>(_functions, 'updateApiKey') : null as any;
export const verifyModelConfig = _functions ? httpsCallable<
    { provider: ApiProvider; model: string },
    { success: boolean; message?: string; latency?: number; error?: string; details?: string }
>(_functions, 'verifyModelConfig') : null as any;


// ==================== FIRESTORE HELPERS ====================

// Campaigns collection
export const campaignsRef = _db ? collection(_db, 'campaigns') : null as any;

export async function saveCampaign(userId: string, campaignId: string, data: any) {
    const ref = doc(db, 'users', userId, 'campaigns', campaignId);
    await setDoc(ref, {
        ...data,
        updatedAt: serverTimestamp(),
    }, { merge: true });
}

export async function loadCampaign(userId: string, campaignId: string) {
    const ref = doc(db, 'users', userId, 'campaigns', campaignId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;

    const campaignData = snap.data();

    // Fetch messages
    const messagesCol = collection(db, 'users', userId, 'campaigns', campaignId, 'messages');
    const messagesQuery = query(messagesCol, orderBy('timestamp', 'asc'), limit(50));
    const messagesSnapshot = await getDocs(messagesQuery);

    const messages = messagesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            role: data.role,
            content: data.content,
            timestamp: data.timestamp?.toMillis?.() || Date.now(),
            metadata: data.metadata, // Preserve metadata (voiceModel, turnCost, debug)
        };
    });

    return { ...campaignData, messages };
}

/**
 * Subscribe to real-time updates for campaign messages.
 * This syncs any messages saved by the backend even if frontend errors.
 * @returns Unsubscribe function to stop listening
 */
export function subscribeToCampaignMessages(
    userId: string,
    campaignId: string,
    onMessagesUpdate: (messages: any[]) => void
): () => void {
    if (!db) {
        console.warn('[Firebase] Firestore not initialized, skipping message subscription');
        return () => { };
    }

    const messagesCol = collection(db, 'users', userId, 'campaigns', campaignId, 'messages');
    const messagesQuery = query(messagesCol, orderBy('timestamp', 'asc'), limit(100));

    console.log('[Firebase] Starting real-time message subscription for campaign:', campaignId);

    const unsubscribe = onSnapshot(messagesQuery,
        (snapshot) => {
            const messages = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    role: data.role,
                    content: data.content,
                    timestamp: data.timestamp?.toMillis?.() || Date.now(),
                    metadata: data.metadata,
                };
            });
            console.log('[Firebase] Real-time update: received', messages.length, 'messages');
            onMessagesUpdate(messages);
        },
        (error) => {
            console.error('[Firebase] Message subscription error:', error);
        }
    );

    return unsubscribe;
}

export async function getUserCampaigns(userId: string) {
    const campaignsCol = collection(db, 'users', userId, 'campaigns');
    const q = query(campaignsCol, orderBy('updatedAt', 'desc'), limit(20));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            // Convert Firestore Timestamps to milliseconds for frontend
            createdAt: data.createdAt?.toMillis?.() || data.createdAt || Date.now(),
            updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt || Date.now(),
        };
    });
}

// User profile
// User profile
export async function createOrUpdateUser(userId: string, data: Partial<{
    email: string;
    displayName: string;
    tier: string;
    turnsUsed: number;
    lastActive: any;
    role: 'user' | 'admin';
}>) {
    const ref = doc(db, 'users', userId);
    await setDoc(ref, {
        ...data,
        lastActive: serverTimestamp(),
    }, { merge: true });
}

export async function getUser(userId: string): Promise<any> {
    const ref = doc(db, 'users', userId);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
}

// ==================== ADMIN HELPERS ====================

// ==================== ADMIN HELPERS ====================

export async function getAdminData() {
    try {
        const getAdminDataFn = httpsCallable(functions, 'getAdminDashboardData');
        const result = await getAdminDataFn();
        const data = result.data as any;
        return {
            users: data.users || [],
            dailyStats: data.dailyStats || []
        };
    } catch (error: any) {
        console.error('Error fetching admin data:', error);
        alert(`Admin Fetch Error: ${error.message || JSON.stringify(error)}`);
        return { users: [], dailyStats: [] };
    }
}

export async function updateUserRole(userId: string, role: 'user' | 'admin') {
    const adminUpdate = httpsCallable(functions, 'adminUpdateUser');
    await adminUpdate({
        targetUserId: userId,
        updates: { role }
    });
}

export async function updateUserTier(userId: string, tier: SubscriptionTier) {
    const adminUpdate = httpsCallable(functions, 'adminUpdateUser');
    await adminUpdate({
        targetUserId: userId,
        updates: { tier }
    });
}

export async function adminAdjustTurns(
    targetUserId: string,
    amount: number,
    operation: 'add' | 'set' = 'add'
): Promise<void> {
    const adjustTurns = httpsCallable(functions, 'adminAdjustTurns');
    await adjustTurns({ targetUserId, amount, operation });
}


// ==================== KNOWLEDGE BASE HELPERS ====================

export interface KnowledgeDocument {
    id: string;
    name: string;
    worldModule: 'global' | 'classic' | 'outworlder' | 'tactical';
    content: string;
    category: 'lore' | 'rules' | 'characters' | 'locations' | 'other';
    targetModel: 'brain' | 'voice' | 'both';
    uploadedBy?: string;
    createdAt?: string;
    updatedAt?: string;
    enabled: boolean;
}

export async function getKnowledgeDocs(): Promise<KnowledgeDocument[]> {
    try {
        const getDocsFn = httpsCallable(functions, 'getKnowledgeDocuments');
        const result = await getDocsFn();
        const data = result.data as any;
        return data.documents || [];
    } catch (error: any) {
        console.error('Error fetching knowledge docs:', error);
        throw error;
    }
}

export async function addKnowledgeDoc(doc: Omit<KnowledgeDocument, 'id' | 'uploadedBy' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const addFn = httpsCallable(functions, 'addKnowledgeDocument');
    const result = await addFn(doc);
    const data = result.data as any;
    return data.id;
}

export async function updateKnowledgeDoc(documentId: string, updates: Partial<KnowledgeDocument>): Promise<void> {
    const updateFn = httpsCallable(functions, 'updateKnowledgeDocument');
    await updateFn({ documentId, updates });
}

export async function deleteKnowledgeDoc(documentId: string): Promise<void> {
    const deleteFn = httpsCallable(functions, 'deleteKnowledgeDocument');
    await deleteFn({ documentId });
}
// ==================== WORLD HELPERS ====================

export const worldsRef = _db ? collection(_db, 'worlds') : null as any;

export async function getWorlds(): Promise<WorldModule[]> {
    try {
        const q = query(worldsRef, orderBy('order', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as WorldModule));
    } catch (error) {
        console.error('Error fetching worlds:', error);
        return [];
    }
}

export async function saveWorld(world: WorldModule): Promise<void> {
    const ref = doc(db, 'worlds', world.id);
    await setDoc(ref, {
        ...world,
        updatedAt: serverTimestamp(),
    }, { merge: true });
}

export async function deleteWorld(worldId: string): Promise<void> {
    const ref = doc(db, 'worlds', worldId);
    await deleteDoc(ref);
}

// ==================== GAME ENGINE HELPERS ====================

export const gameEnginesRef = _db ? collection(_db, 'gameEngines') : null as any;

export async function getGameEngines(): Promise<GameEngine[]> {
    try {
        const q = query(gameEnginesRef, orderBy('order', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as GameEngine));
    } catch (error) {
        console.error('Error fetching game engines:', error);
        return [];  // Return empty array - use seed button to populate defaults
    }
}

export async function saveGameEngine(engine: GameEngine): Promise<void> {
    const ref = doc(db, 'gameEngines', engine.id);
    await setDoc(ref, {
        ...engine,
        updatedAt: serverTimestamp(),
    }, { merge: true });
}

export async function deleteGameEngine(engineId: string): Promise<void> {
    const ref = doc(db, 'gameEngines', engineId);
    await deleteDoc(ref);
}

// ==================== CAMPAIGN SAVES ====================

export const saveCampaignStateFn = httpsCallable<{ campaignId: string; saveName: string }, { success: boolean; saveId: string }>(functions, 'saveCampaignState');
export const getCampaignSavesFn = httpsCallable<{ campaignId: string }, { success: boolean; saves: any[]; count: number }>(functions, 'getCampaignSaves');
export const loadCampaignSaveFn = httpsCallable<{ campaignId: string; saveId: string }, { success: boolean; moduleState: any }>(functions, 'loadCampaignSave');
export const deleteCampaignSaveFn = httpsCallable<{ campaignId: string; saveId: string }, { success: boolean }>(functions, 'deleteCampaignSave');
