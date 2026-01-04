/**
 * Background Ambiance Service
 * 
 * Provides ambient sound playback based on game location/situation.
 * Uses HTML5 Audio on web, expo-av on mobile.
 */

import { Platform } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export type AmbianceType =
    | 'none'
    | 'tavern'      // Cozy tavern with chatter, fire crackling
    | 'forest'      // Birds, wind in leaves, nature sounds
    | 'dungeon'     // Dripping water, distant echoes, eerie ambiance
    | 'city'        // Crowd murmur, carts, marketplace sounds
    | 'combat'      // Tense, battle-ready atmosphere
    | 'castle'      // Grand halls, echoing footsteps
    | 'cave'        // Underground, echoing, mysterious
    | 'ocean'       // Waves, seagulls, seaside atmosphere
    | 'night'       // Night crickets, owl hoots, quiet
    | 'rain';       // Rain falling, storm ambiance

// Default fallback URLs (used if Firestore fails to load)
const DEFAULT_AMBIANCE_URLS: Record<AmbianceType, string | null> = {
    none: null,
    tavern: 'https://cdn.pixabay.com/audio/2024/02/08/audio_ac56737be4.mp3',
    forest: 'https://cdn.pixabay.com/audio/2022/03/09/audio_c7acb35bca.mp3',
    dungeon: 'https://cdn.pixabay.com/audio/2022/11/17/audio_fe4aaeecb0.mp3',
    city: 'https://cdn.pixabay.com/audio/2021/09/02/audio_95e4dc3d6f.mp3',
    combat: 'https://cdn.pixabay.com/audio/2023/10/24/audio_7fd0df0e06.mp3',
    castle: 'https://cdn.pixabay.com/audio/2022/05/27/audio_f5462cdede.mp3',
    cave: 'https://cdn.pixabay.com/audio/2022/06/01/audio_c067fb28ea.mp3',
    ocean: 'https://cdn.pixabay.com/audio/2022/02/22/audio_ea1a0c0a91.mp3',
    night: 'https://cdn.pixabay.com/audio/2022/05/31/audio_32e41c0bc6.mp3',
    rain: 'https://cdn.pixabay.com/audio/2022/03/24/audio_bae35a2adf.mp3',
};

// Cached settings from Firestore
let cachedSettings: any = null;
let settingsLoaded = false;

/**
 * Load ambiance settings from Firestore
 */
async function loadAmbianceSettings() {
    if (settingsLoaded) return cachedSettings;

    try {
        const docRef = doc(db, 'settings', 'ambiance');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            cachedSettings = docSnap.data();
            settingsLoaded = true;
            console.log('[Ambiance] Settings loaded from Firestore');
        } else {
            console.log('[Ambiance] No settings found, using defaults');
        }
    } catch (error) {
        console.error('[Ambiance] Failed to load settings:', error);
    }

    return cachedSettings;
}

/**
 * Get URL for ambiance type (from Firestore or fallback)
 */
function getAmbianceUrl(type: AmbianceType): string | null {
    if (type === 'none') return null;

    // Try cached settings first
    if (cachedSettings?.types?.[type]?.enabled && cachedSettings?.types?.[type]?.url) {
        return cachedSettings.types[type].url;
    }

    // Fallback to defaults
    return DEFAULT_AMBIANCE_URLS[type];
}

/**
 * Get volume for ambiance type (from Firestore or fallback)
 */
function getAmbianceVolume(type: AmbianceType): number {
    if (cachedSettings?.types?.[type]?.volume !== undefined) {
        return cachedSettings.types[type].volume;
    }
    return cachedSettings?.global?.defaultVolume || 0.3;
}

let currentAmbiance: AmbianceType = 'none';
// Use 'any' to avoid referencing HTMLAudioElement during SSR
let currentAudio: any = null;
let currentVolume = 0.3; // Default volume
let isFading = false;

/**
 * Get the current ambiance type
 */
export function getCurrentAmbiance(): AmbianceType {
    return currentAmbiance;
}

/**
 * Check if ambiance is currently playing
 */
export function isAmbiancePlaying(): boolean {
    return currentAmbiance !== 'none' && currentAudio !== null && !currentAudio.paused;
}

/**
 * Set the ambiance volume (0.0 to 1.0)
 */
export function setAmbianceVolume(volume: number): void {
    currentVolume = Math.max(0, Math.min(1, volume));
    if (currentAudio) {
        currentAudio.volume = currentVolume;
    }
}

/**
 * Play ambient audio for a location type
 */
export async function setAmbiance(type: AmbianceType): Promise<void> {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
        console.log('[Ambiance] Mobile audio not yet implemented');
        return;
    }

    // Same ambiance, no change needed
    if (type === currentAmbiance) return;

    // Stop current ambiance
    stopAmbiance();

    currentAmbiance = type;

    if (type === 'none') return;

    // Load settings if not already loaded
    await loadAmbianceSettings();

    const url = getAmbianceUrl(type);
    if (!url) {
        console.log(`[Ambiance] No audio file for type: ${type}`);
        return;
    }

    // Get volume for this type
    const typeVolume = getAmbianceVolume(type);

    try {
        currentAudio = new Audio(url);
        currentAudio.loop = true;
        currentAudio.volume = 0; // Start at 0 for fade in
        await currentAudio.play();

        // Fade in with type-specific volume
        await fadeIn(typeVolume);

        console.log(`[Ambiance] Playing: ${type}`);
    } catch (error) {
        console.error('[Ambiance] Failed to play audio:', error);
        currentAudio = null;
    }
}

/**
 * Fade to a new ambiance type smoothly
 */
export async function fadeToAmbiance(type: AmbianceType, durationMs: number = 2000): Promise<void> {
    if (isFading) return;

    isFading = true;

    // Fade out current
    if (currentAudio && !currentAudio.paused) {
        await fadeOut(durationMs / 2);
    }

    // Set new ambiance (will fade in)
    await setAmbiance(type);

    isFading = false;
}

/**
 * Stop all ambiance playback
 */
export function stopAmbiance(): void {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }
    currentAmbiance = 'none';
}

/**
 * Pause ambiance (can be resumed)
 */
export function pauseAmbiance(): void {
    if (currentAudio) {
        currentAudio.pause();
    }
}

/**
 * Resume paused ambiance
 */
export function resumeAmbiance(): void {
    if (currentAudio && currentAudio.paused) {
        currentAudio.play().catch((e: Error) => console.warn('[Ambiance] Resume failed:', e));
    }
}

/**
 * Fade in audio to target volume
 */
async function fadeIn(targetVolume: number, durationMs: number = 1000): Promise<void> {
    if (!currentAudio) return;

    const steps = 20;
    const stepDuration = durationMs / steps;
    const volumeStep = targetVolume / steps;

    for (let i = 0; i <= steps; i++) {
        if (!currentAudio) break;
        currentAudio.volume = Math.min(targetVolume, volumeStep * i);
        await sleep(stepDuration);
    }
}

/**
 * Fade out audio to zero
 */
async function fadeOut(durationMs: number = 1000): Promise<void> {
    if (!currentAudio) return;

    const startVolume = currentAudio.volume;
    const steps = 20;
    const stepDuration = durationMs / steps;
    const volumeStep = startVolume / steps;

    for (let i = steps; i >= 0; i--) {
        if (!currentAudio) break;
        currentAudio.volume = Math.max(0, volumeStep * i);
        await sleep(stepDuration);
    }

    stopAmbiance();
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Detect ambiance type from narrative text
 * This is a simple keyword-based detection - could be enhanced with AI
 */
export function detectAmbianceFromText(text: string): AmbianceType {
    const lowerText = text.toLowerCase();

    // Check for specific locations/situations
    if (/\b(tavern|inn|bar|pub|drink|ale|mead)\b/.test(lowerText)) return 'tavern';
    if (/\b(forest|woods|trees|grove|wilderness)\b/.test(lowerText)) return 'forest';
    if (/\b(dungeon|prison|dark corridor|underground|crypt)\b/.test(lowerText)) return 'dungeon';
    if (/\b(city|town|market|street|crowd|shop)\b/.test(lowerText)) return 'city';
    if (/\b(attack|combat|battle|fight|enemy|sword drawn)\b/.test(lowerText)) return 'combat';
    if (/\b(castle|palace|throne|king|queen|royal)\b/.test(lowerText)) return 'castle';
    if (/\b(cave|cavern|underground|mining)\b/.test(lowerText)) return 'cave';
    if (/\b(ocean|sea|beach|waves|ship|sail)\b/.test(lowerText)) return 'ocean';
    if (/\b(night|moon|stars|evening|dark sky)\b/.test(lowerText)) return 'night';
    if (/\b(rain|storm|thunder|lightning|wet)\b/.test(lowerText)) return 'rain';

    // No clear match, keep current
    return currentAmbiance;
}
