/**
 * Sound Effect Storage Service
 * 
 * Handles uploading and managing sound effect files in Firebase Storage
 */

import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { storage, db } from './firebase';

export interface SoundEffectConfig {
    id: string;
    name: string;
    url: string;
    volume: number;
    enabled: boolean;
    category: 'ui' | 'game' | 'achievement';
    uploadedAt?: string;
    filename?: string;
}

export const DEFAULT_SOUND_EFFECTS: Record<string, Omit<SoundEffectConfig, 'url'>> = {
    buttonClick: {
        id: 'buttonClick',
        name: 'Button Click',
        volume: 0.5,
        enabled: true,
        category: 'ui',
    },
    diceRoll: {
        id: 'diceRoll',
        name: 'Dice Roll',
        volume: 0.6,
        enabled: true,
        category: 'game',
    },
    success: {
        id: 'success',
        name: 'Success',
        volume: 0.5,
        enabled: true,
        category: 'game',
    },
    error: {
        id: 'error',
        name: 'Error',
        volume: 0.5,
        enabled: true,
        category: 'game',
    },
    messageReceived: {
        id: 'messageReceived',
        name: 'Message Received',
        volume: 0.4,
        enabled: true,
        category: 'ui',
    },
    turnSpent: {
        id: 'turnSpent',
        name: 'Turn Spent',
        volume: 0.5,
        enabled: true,
        category: 'game',
    },
    levelUp: {
        id: 'levelUp',
        name: 'Level Up',
        volume: 0.7,
        enabled: true,
        category: 'achievement',
    },
};

/**
 * Upload a sound effect file to Firebase Storage
 */
export async function uploadSoundEffect(
    effectId: string,
    file: File | Blob,
    filename: string
): Promise<string> {
    const storageRef = ref(storage, `soundEffects/${effectId}.mp3`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    console.log(`[SoundEffectStorage] Uploaded ${effectId}: ${url}`);
    return url;
}

/**
 * Delete a sound effect file from Firebase Storage
 */
export async function deleteSoundEffect(effectId: string): Promise<void> {
    const storageRef = ref(storage, `soundEffects/${effectId}.mp3`);
    await deleteObject(storageRef);
    console.log(`[SoundEffectStorage] Deleted ${effectId}`);
}

/**
 * Load all sound effect configurations from Firestore
 */
export async function loadSoundEffectConfigs(): Promise<Record<string, SoundEffectConfig>> {
    try {
        const docRef = doc(db, 'config', 'soundEffects');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data().effects || {};
        }

        // Return defaults if no config exists
        return {};
    } catch (error) {
        console.error('[SoundEffectStorage] Failed to load configs:', error);
        return {};
    }
}

/**
 * Save sound effect configuration to Firestore
 */
export async function saveSoundEffectConfig(
    effectId: string,
    config: SoundEffectConfig
): Promise<void> {
    const docRef = doc(db, 'config', 'soundEffects');

    try {
        const docSnap = await getDoc(docRef);
        const currentData = docSnap.exists() ? docSnap.data().effects || {} : {};

        await setDoc(docRef, {
            effects: {
                ...currentData,
                [effectId]: config,
            },
            updatedAt: new Date().toISOString(),
        });

        console.log(`[SoundEffectStorage] Saved config for ${effectId}`);
    } catch (error) {
        console.error('[SoundEffectStorage] Failed to save config:', error);
        throw error;
    }
}

/**
 * Update sound effect settings (volume, enabled, etc.)
 */
export async function updateSoundEffectSettings(
    effectId: string,
    updates: Partial<SoundEffectConfig>
): Promise<void> {
    const docRef = doc(db, 'config', 'soundEffects');

    try {
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
            throw new Error('Sound effects config not found');
        }

        const currentData = docSnap.data().effects || {};
        const currentEffect = currentData[effectId];

        if (!currentEffect) {
            throw new Error(`Sound effect ${effectId} not found`);
        }

        await setDoc(docRef, {
            effects: {
                ...currentData,
                [effectId]: {
                    ...currentEffect,
                    ...updates,
                },
            },
            updatedAt: new Date().toISOString(),
        });

        console.log(`[SoundEffectStorage] Updated ${effectId}:`, updates);
    } catch (error) {
        console.error('[SoundEffectStorage] Failed to update settings:', error);
        throw error;
    }
}

/**
 * Initialize default sound effects in Firestore if they don't exist
 */
export async function initializeDefaultSoundEffects(): Promise<void> {
    const docRef = doc(db, 'config', 'soundEffects');
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        const defaultEffects: Record<string, SoundEffectConfig> = {};

        // Create default configs with empty URLs (admin will upload)
        Object.entries(DEFAULT_SOUND_EFFECTS).forEach(([id, config]) => {
            defaultEffects[id] = {
                ...config,
                url: '', // Admin needs to upload
            };
        });

        await setDoc(docRef, {
            effects: defaultEffects,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });

        console.log('[SoundEffectStorage] Initialized default sound effects');
    }
}
