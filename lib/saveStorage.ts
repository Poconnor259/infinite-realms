/**
 * Tiered Save Storage Management
 * 
 * Manages campaign saves across Firestore (latest) and Firebase Storage (older, compressed)
 * - Latest save: Firestore (quick access)
 * - Saves 2-10: Firebase Storage (gzip compressed)
 */

import { getStorage, ref, uploadBytes, getBytes, deleteObject, listAll, getMetadata } from 'firebase/storage';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { CampaignSaveData } from './characterIO';

// ==================== TYPES ====================

export interface SaveMetadata {
    saveName: string;
    savedAt: number;
    isCompressed: boolean;
    location: 'firestore' | 'storage';
}

export interface SaveListResult {
    success: boolean;
    saves?: SaveMetadata[];
    error?: string;
}

export interface SaveResult {
    success: boolean;
    error?: string;
}

export interface LoadResult {
    success: boolean;
    data?: CampaignSaveData;
    error?: string;
}

// ==================== CONSTANTS ====================

const MAX_SAVES = 10;
const STORAGE_PATH_PREFIX = 'saves';

// ==================== COMPRESSION ====================

/**
 * Compress data with gzip
 */
async function compressData(data: CampaignSaveData): Promise<Blob> {
    const jsonString = JSON.stringify(data);
    const blob = new Blob([jsonString], { type: 'application/json' });

    // Use CompressionStream if available (modern browsers)
    if (typeof CompressionStream !== 'undefined') {
        const stream = blob.stream().pipeThrough(new CompressionStream('gzip'));
        return new Response(stream).blob();
    }

    // Fallback: return uncompressed
    return blob;
}

/**
 * Decompress gzipped data
 */
async function decompressData(blob: Blob): Promise<CampaignSaveData> {
    // Check if data is compressed
    const isGzipped = blob.type === 'application/gzip' || blob.type === 'application/x-gzip';

    if (isGzipped && typeof DecompressionStream !== 'undefined') {
        const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
        const decompressed = await new Response(stream).text();
        return JSON.parse(decompressed);
    }

    // Fallback: assume uncompressed JSON
    const text = await blob.text();
    return JSON.parse(text);
}

// ==================== SAVE MANAGEMENT ====================

/**
 * Save campaign data with tiered storage
 */
export async function saveCampaign(
    campaignId: string,
    saveData: CampaignSaveData
): Promise<SaveResult> {
    try {
        const storage = getStorage();
        const currentSaveRef = doc(db, 'campaigns', campaignId, 'saves', 'current');

        // 1. Check if current save exists
        const currentSaveSnap = await getDoc(currentSaveRef);

        if (currentSaveSnap.exists()) {
            // 2. Move current save to Storage (compressed)
            const oldSave = currentSaveSnap.data() as CampaignSaveData;
            const timestamp = oldSave.createdAt || Date.now();

            // Compress and upload to Storage
            const compressed = await compressData(oldSave);
            const storageRef = ref(storage, `${STORAGE_PATH_PREFIX}/${campaignId}/save_${timestamp}.json.gz`);
            await uploadBytes(storageRef, compressed, {
                contentType: 'application/gzip',
                customMetadata: {
                    saveName: oldSave.saveName,
                    savedAt: String(timestamp)
                }
            });

            // 3. Check save count and delete oldest if > MAX_SAVES
            await cleanupOldSaves(campaignId);
        }

        // 4. Write new save as current in Firestore
        await setDoc(currentSaveRef, {
            ...saveData,
            savedAt: Date.now()
        });

        return { success: true };

    } catch (error: any) {
        console.error('[SaveStorage] Save failed:', error);
        return {
            success: false,
            error: error.message || 'Failed to save campaign'
        };
    }
}

/**
 * Load a specific save
 */
export async function loadSave(
    campaignId: string,
    timestamp?: number
): Promise<LoadResult> {
    try {
        // If no timestamp, load current save from Firestore
        if (!timestamp) {
            const currentSaveRef = doc(db, 'campaigns', campaignId, 'saves', 'current');
            const snap = await getDoc(currentSaveRef);

            if (!snap.exists()) {
                return {
                    success: false,
                    error: 'No current save found'
                };
            }

            return {
                success: true,
                data: snap.data() as CampaignSaveData
            };
        }

        // Load older save from Storage
        const storage = getStorage();
        const storageRef = ref(storage, `${STORAGE_PATH_PREFIX}/${campaignId}/save_${timestamp}.json.gz`);

        const bytes = await getBytes(storageRef);
        const blob = new Blob([bytes], { type: 'application/gzip' });
        const data = await decompressData(blob);

        return {
            success: true,
            data
        };

    } catch (error: any) {
        console.error('[SaveStorage] Load failed:', error);
        return {
            success: false,
            error: error.message || 'Failed to load save'
        };
    }
}

/**
 * List all saves for a campaign
 */
export async function listSaves(campaignId: string): Promise<SaveListResult> {
    try {
        const saves: SaveMetadata[] = [];

        // 1. Get current save from Firestore
        const currentSaveRef = doc(db, 'campaigns', campaignId, 'saves', 'current');
        const currentSnap = await getDoc(currentSaveRef);

        if (currentSnap.exists()) {
            const data = currentSnap.data() as CampaignSaveData;
            saves.push({
                saveName: data.saveName,
                savedAt: (data as any).savedAt || Date.now(),
                isCompressed: false,
                location: 'firestore'
            });
        }

        // 2. List saves from Storage
        const storage = getStorage();
        const listRef = ref(storage, `${STORAGE_PATH_PREFIX}/${campaignId}`);
        const listResult = await listAll(listRef);

        for (const itemRef of listResult.items) {
            const metadata = await getMetadata(itemRef);
            saves.push({
                saveName: metadata.customMetadata?.saveName || 'Unnamed Save',
                savedAt: parseInt(metadata.customMetadata?.savedAt || '0'),
                isCompressed: true,
                location: 'storage'
            });
        }

        // Sort by savedAt (newest first)
        saves.sort((a, b) => b.savedAt - a.savedAt);

        return {
            success: true,
            saves
        };

    } catch (error: any) {
        console.error('[SaveStorage] List failed:', error);
        return {
            success: false,
            error: error.message || 'Failed to list saves'
        };
    }
}

/**
 * Delete oldest saves if count exceeds MAX_SAVES
 */
async function cleanupOldSaves(campaignId: string): Promise<void> {
    try {
        const storage = getStorage();
        const listRef = ref(storage, `${STORAGE_PATH_PREFIX}/${campaignId}`);
        const listResult = await listAll(listRef);

        if (listResult.items.length >= MAX_SAVES - 1) {
            // Get timestamps from filenames
            const saves = await Promise.all(
                listResult.items.map(async (item) => {
                    const metadata = await getMetadata(item);
                    return {
                        ref: item,
                        timestamp: parseInt(metadata.customMetadata?.savedAt || '0')
                    };
                })
            );

            // Sort by timestamp (oldest first)
            saves.sort((a, b) => a.timestamp - b.timestamp);

            // Delete oldest
            const toDelete = saves.slice(0, saves.length - (MAX_SAVES - 2));
            await Promise.all(toDelete.map(save => deleteObject(save.ref)));
        }
    } catch (error) {
        console.error('[SaveStorage] Cleanup failed:', error);
        // Don't throw - cleanup failure shouldn't block save
    }
}

/**
 * Delete a specific save
 */
export async function deleteSave(
    campaignId: string,
    timestamp: number
): Promise<SaveResult> {
    try {
        const storage = getStorage();
        const storageRef = ref(storage, `${STORAGE_PATH_PREFIX}/${campaignId}/save_${timestamp}.json.gz`);
        await deleteObject(storageRef);

        return { success: true };
    } catch (error: any) {
        console.error('[SaveStorage] Delete failed:', error);
        return {
            success: false,
            error: error.message || 'Failed to delete save'
        };
    }
}
