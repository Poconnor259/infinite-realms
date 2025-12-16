import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, type User } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
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

// ==================== CLOUD FUNCTIONS ====================

// Matches GameRequest in functions/src/index.ts
export interface ProcessInputRequest {
    campaignId: string;
    userInput: string;
    worldModule: 'classic' | 'outworlder' | 'shadowMonarch';
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
    return snap.exists() ? snap.data() : null;
}

// User profile
export async function createOrUpdateUser(userId: string, data: Partial<{
    email: string;
    displayName: string;
    tier: string;
    turnsUsed: number;
    lastActive: any;
}>) {
    const ref = doc(db, 'users', userId);
    await setDoc(ref, {
        ...data,
        lastActive: serverTimestamp(),
    }, { merge: true });
}
