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
import type { WorldModule, GameEngine } from './types';
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
    limit
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCuCsTTt0DMv9dDhzxgveviyV6LJIjr7IY",
    authDomain: "infinite-realms-5dcba.firebaseapp.com",
    projectId: "infinite-realms-5dcba",
    storageBucket: "infinite-realms-5dcba.firebasestorage.app",
    messagingSenderId: "714188392386",
    appId: "1:714188392386:web:c877b12b8068343571b85b",
    measurementId: "G-GNFMNEW2TZ"
};

// Initialize Firebase (only once)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

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

// ====================CLOUD FUNCTIONS ====================

// Matches GameRequest in functions/src/index.ts
export interface ProcessInputRequest {
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

export interface ProcessInputResponse {
    success: boolean;
    narrativeText?: string;
    stateUpdates?: Record<string, unknown>;
    diceRolls?: Array<any>;
    systemMessages?: string[];
    error?: string;
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

export const deleteCampaignFn = httpsCallable<{ campaignId: string }, { success: boolean }>(
    functions,
    'deleteCampaign'
);

// ==================== FIRESTORE HELPERS ====================

// Campaigns collection
export const campaignsRef = collection(db, 'campaigns');

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
        };
    });

    return { ...campaignData, messages };
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

export async function updateUserTier(userId: string, tier: 'scout' | 'hero' | 'legend') {
    const adminUpdate = httpsCallable(functions, 'adminUpdateUser');
    await adminUpdate({
        targetUserId: userId,
        updates: { tier }
    });
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

export const worldsRef = collection(db, 'worlds');

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

export const gameEnginesRef = collection(db, 'gameEngines');

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
        // Return default engines if none exist
        return [
            {
                id: 'classic',
                name: 'Classic D&D',
                description: 'D&D 5e style gameplay with six core attributes',
                order: 1,
                stats: [
                    { id: 'strength', name: 'Strength', abbreviation: 'STR', min: 1, max: 20, default: 10 },
                    { id: 'dexterity', name: 'Dexterity', abbreviation: 'DEX', min: 1, max: 20, default: 10 },
                    { id: 'constitution', name: 'Constitution', abbreviation: 'CON', min: 1, max: 20, default: 10 },
                    { id: 'intelligence', name: 'Intelligence', abbreviation: 'INT', min: 1, max: 20, default: 10 },
                    { id: 'wisdom', name: 'Wisdom', abbreviation: 'WIS', min: 1, max: 20, default: 10 },
                    { id: 'charisma', name: 'Charisma', abbreviation: 'CHA', min: 1, max: 20, default: 10 },
                ],
                resources: [
                    { id: 'hp', name: 'Health', color: '#10b981', showInHUD: true },
                ],
                progression: { type: 'level', maxLevel: 20 },
                creationFields: [
                    {
                        id: 'class', type: 'select', label: 'Class', required: true, options: [
                            { value: 'fighter', label: 'Fighter' },
                            { value: 'wizard', label: 'Wizard' },
                            { value: 'rogue', label: 'Rogue' },
                            { value: 'cleric', label: 'Cleric' },
                        ]
                    },
                    {
                        id: 'race', type: 'select', label: 'Race', required: true, options: [
                            { value: 'human', label: 'Human' },
                            { value: 'elf', label: 'Elf' },
                            { value: 'dwarf', label: 'Dwarf' },
                            { value: 'halfling', label: 'Halfling' },
                        ]
                    },
                    { id: 'background', type: 'text', label: 'Background', required: false },
                ],
                aiContext: 'D&D 5e fantasy RPG. Characters have six core attributes (STR, DEX, CON, INT, WIS, CHA) ranging from 1-20. Use d20 rolls for ability checks, adding relevant attribute modifiers. Combat uses turn-based initiative.',
            },
            {
                id: 'outworlder',
                name: 'Outworlder',
                description: 'HWFWM Essence System with rank-based progression',
                order: 2,
                stats: [
                    { id: 'power', name: 'Power', abbreviation: 'PWR', min: 1, max: 100, default: 10 },
                    { id: 'speed', name: 'Speed', abbreviation: 'SPD', min: 1, max: 100, default: 10 },
                    { id: 'spirit', name: 'Spirit', abbreviation: 'SPI', min: 1, max: 100, default: 10 },
                    { id: 'recovery', name: 'Recovery', abbreviation: 'REC', min: 1, max: 100, default: 10 },
                ],
                resources: [
                    { id: 'hp', name: 'Health', color: '#10b981', showInHUD: true },
                    { id: 'mana', name: 'Mana', color: '#3b82f6', showInHUD: true },
                    { id: 'stamina', name: 'Stamina', color: '#f59e0b', showInHUD: true },
                ],
                progression: {
                    type: 'rank',
                    ranks: [
                        { id: 'iron', name: 'Iron', order: 1 },
                        { id: 'bronze', name: 'Bronze', order: 2 },
                        { id: 'silver', name: 'Silver', order: 3 },
                        { id: 'gold', name: 'Gold', order: 4 },
                        { id: 'diamond', name: 'Diamond', order: 5 },
                    ]
                },
                creationFields: [
                    { id: 'essence1', type: 'text', label: 'First Essence', required: true },
                    { id: 'essence2', type: 'text', label: 'Second Essence', required: false },
                    { id: 'essence3', type: 'text', label: 'Third Essence', required: false },
                    { id: 'background', type: 'text', label: 'Origin Story', required: false },
                ],
                aiContext: 'HWFWM-style essence magic system. Characters progress through ranks (Iron → Bronze → Silver → Gold → Diamond). Powers come from absorbed essences. Stats are Power, Speed, Spirit, and Recovery (1-100 scale). Combat emphasizes essence ability combinations.',
            },
            {
                id: 'tactical',
                name: 'Shadow Monarch',
                description: 'Solo Leveling style tactical combat system',
                order: 3,
                stats: [
                    { id: 'strength', name: 'Strength', abbreviation: 'STR', min: 1, max: 999, default: 10 },
                    { id: 'agility', name: 'Agility', abbreviation: 'AGI', min: 1, max: 999, default: 10 },
                    { id: 'vitality', name: 'Vitality', abbreviation: 'VIT', min: 1, max: 999, default: 10 },
                    { id: 'intelligence', name: 'Intelligence', abbreviation: 'INT', min: 1, max: 999, default: 10 },
                    { id: 'sense', name: 'Sense', abbreviation: 'SEN', min: 1, max: 999, default: 10 },
                ],
                resources: [
                    { id: 'hp', name: 'Health', color: '#ef4444', showInHUD: true },
                    { id: 'mp', name: 'Mana', color: '#3b82f6', showInHUD: true },
                ],
                progression: { type: 'level', maxLevel: 100 },
                creationFields: [
                    {
                        id: 'class', type: 'select', label: 'Hunter Class', required: true, options: [
                            { value: 'fighter', label: 'Fighter' },
                            { value: 'mage', label: 'Mage' },
                            { value: 'assassin', label: 'Assassin' },
                            { value: 'tank', label: 'Tank' },
                            { value: 'healer', label: 'Healer' },
                        ]
                    },
                    { id: 'title', type: 'text', label: 'Hunter Title', required: false },
                ],
                aiContext: 'Solo Leveling inspired system. Characters are "Hunters" with game-like stats (STR, AGI, VIT, INT, SEN) that can reach 999. Level-based progression up to level 100. Combat is tactical with skills, dungeons, and monster encounters. Stats grow significantly with each level.',
            },
        ];
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
