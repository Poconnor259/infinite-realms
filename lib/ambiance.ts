/**
 * Background Ambiance Service
 * 
 * Provides ambient sound playback based on game location/situation.
 * Uses HTML5 Audio on web, expo-av on mobile.
 */

import { Platform } from 'react-native';

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

// Placeholder URLs - these would be replaced with actual royalty-free audio files
const AMBIANCE_URLS: Record<AmbianceType, string | null> = {
    none: null,
    tavern: null,    // TODO: Add royalty-free tavern ambiance
    forest: null,    // TODO: Add royalty-free forest ambiance
    dungeon: null,   // TODO: Add royalty-free dungeon ambiance
    city: null,      // TODO: Add royalty-free city ambiance
    combat: null,    // TODO: Add royalty-free combat ambiance
    castle: null,    // TODO: Add royalty-free castle ambiance
    cave: null,      // TODO: Add royalty-free cave ambiance
    ocean: null,     // TODO: Add royalty-free ocean ambiance
    night: null,     // TODO: Add royalty-free night ambiance
    rain: null,      // TODO: Add royalty-free rain ambiance
};

let currentAmbiance: AmbianceType = 'none';
let currentAudio: HTMLAudioElement | null = null;
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

    const url = AMBIANCE_URLS[type];
    if (!url) {
        console.log(`[Ambiance] No audio file for type: ${type}`);
        return;
    }

    try {
        currentAudio = new Audio(url);
        currentAudio.loop = true;
        currentAudio.volume = 0; // Start at 0 for fade in
        await currentAudio.play();

        // Fade in
        await fadeIn(currentVolume);

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
        currentAudio.play().catch(e => console.warn('[Ambiance] Resume failed:', e));
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
