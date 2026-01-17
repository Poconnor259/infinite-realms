import { Platform } from 'react-native';
import { useSettingsStore } from './store';
import { loadSoundEffectConfigs, type SoundEffectConfig } from './soundEffectStorage';

export type SoundEffect =
    | 'buttonClick'    // Light UI click
    | 'diceRoll'       // Dice rolling sound
    | 'success'        // Positive outcome
    | 'error'          // Negative outcome
    | 'messageReceived' // New narrator message
    | 'turnSpent'      // Turn deducted
    | 'levelUp';       // Achievement/level up

// Sound effect configurations loaded from Firestore
let soundConfigs: Record<string, SoundEffectConfig> = {};
let configsLoaded = false;

/**
 * Load sound effect configurations from Firestore
 */
export async function loadSoundEffects(): Promise<void> {
    try {
        soundConfigs = await loadSoundEffectConfigs();
        configsLoaded = true;
        console.log('[Sounds] Loaded configurations from Firestore:', Object.keys(soundConfigs));
    } catch (error) {
        console.error('[Sounds] Failed to load configurations:', error);
    }
}

// Pre-loaded audio cache for faster playback
const audioCache: Map<SoundEffect, HTMLAudioElement> = new Map();

// Default volume for sound effects (can be overridden by config)
const DEFAULT_VOLUME = 0.5;

// Track failed loads to avoid repeated console noise/crashes
const failedLoads: Set<SoundEffect> = new Set();

/**
 * Check if sound effects are enabled in settings
 */
function isSoundEnabled(): boolean {
    return useSettingsStore.getState().soundEffects;
}

/**
 * Preload a sound effect for faster playback
 */
export function preloadSound(sound: SoundEffect): void {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (audioCache.has(sound) || failedLoads.has(sound)) return;
    if (!configsLoaded || !soundConfigs[sound]?.url) return;

    try {
        const config = soundConfigs[sound];
        const audio = new Audio(config.url);
        audio.preload = 'auto';
        audio.volume = config.volume || DEFAULT_VOLUME;

        audio.onerror = () => {
            console.warn(`[Sounds] Failed to preload: ${sound} (Blocked or invalid)`);
            failedLoads.add(sound);
        };

        audioCache.set(sound, audio);
    } catch (e) {
        console.warn(`[Sounds] Preload error: ${sound}`, e);
        failedLoads.add(sound);
    }
}

/**
 * Preload common sound effects
 */
export function preloadCommonSounds(): void {
    preloadSound('buttonClick');
    preloadSound('messageReceived');
    preloadSound('success');
}

/**
 * Play a sound effect
 */
export async function playSound(sound: SoundEffect): Promise<void> {
    // Check if sounds are enabled
    if (!isSoundEnabled()) return;

    // Check if configs are loaded
    if (!configsLoaded) {
        console.warn('[Sounds] Configs not loaded yet, call loadSoundEffects() first');
        return;
    }

    // Check if this sound effect is configured and enabled
    const config = soundConfigs[sound];
    if (!config || !config.enabled || !config.url) {
        return;
    }

    // Check if this sound has already failed to prevent repeated errors
    if (failedLoads.has(sound)) return;

    if (Platform.OS !== 'web' || typeof window === 'undefined') {
        // Mobile audio not yet implemented
        console.log(`[Sounds] Mobile playback not implemented: ${sound}`);
        return;
    }

    try {
        // Try to use cached audio, clone it for overlapping sounds
        let audio = audioCache.get(sound);

        if (audio) {
            // Clone the audio for overlapping playback
            audio = audio.cloneNode() as HTMLAudioElement;
        } else {
            // Create new audio if not cached
            audio = new Audio(config.url);
        }

        audio.volume = config.volume || DEFAULT_VOLUME;

        // Catch load errors
        audio.onerror = () => {
            console.warn(`[Sounds] Source blocked or invalid: ${sound}`);
            failedLoads.add(sound);
        };

        await audio.play();
    } catch (error) {
        console.warn(`[Sounds] Failed to play: ${sound}`, error);
        failedLoads.add(sound);
    }
}

/**
 * Play button click sound
 */
export function playClick(): void {
    playSound('buttonClick');
}

/**
 * Play message received sound
 */
export function playMessageReceived(): void {
    playSound('messageReceived');
}

/**
 * Play success sound
 */
export function playSuccess(): void {
    playSound('success');
}

/**
 * Play error sound
 */
export function playError(): void {
    playSound('error');
}

/**
 * Play dice roll sound
 */
export function playDiceRoll(): void {
    playSound('diceRoll');
}

/**
 * Play turn spent sound  
 */
export function playTurnSpent(): void {
    playSound('turnSpent');
}

/**
 * Play level up sound
 */
export function playLevelUp(): void {
    playSound('levelUp');
}
