/**
 * Sound Effects Service
 * 
 * Provides short sound effect playback for game events.
 * Uses HTML5 Audio on web, expo-av on mobile.
 * Respects the user's soundEffects preference.
 */

import { Platform } from 'react-native';
import { useSettingsStore } from './store';

export type SoundEffect =
    | 'buttonClick'    // Light UI click
    | 'diceRoll'       // Dice rolling sound
    | 'success'        // Positive outcome
    | 'error'          // Negative outcome
    | 'messageReceived' // New narrator message
    | 'turnSpent'      // Turn deducted
    | 'levelUp';       // Achievement/level up

// CDN URLs for royalty-free sound effects
// Sources: Pixabay (Pixabay License - free for commercial use)
const SOUND_URLS: Record<SoundEffect, string> = {
    // Button click - soft UI tap
    buttonClick: 'https://cdn.pixabay.com/download/audio/2022/03/24/audio_2eccfcc3ac.mp3?filename=click-21156.mp3',
    // Dice roll - rolling sound
    diceRoll: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_12b0c7443e.mp3?filename=dice-142528.mp3',
    // Success - positive chime
    success: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3?filename=success-1-6297.mp3',
    // Error - negative beep
    error: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_942694faf3.mp3?filename=error-126627.mp3',
    // Message received - notification pop
    messageReceived: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=pop-39222.mp3',
    // Turn spent - coin/point sound
    turnSpent: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_1db1c54fb7.mp3?filename=coin-collect-retro-8-bit-sound-effect-145251.mp3',
    // Level up - achievement fanfare
    levelUp: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_c6ccf3232f.mp3?filename=level-up-191997.mp3',
};

// Pre-loaded audio cache for faster playback
const audioCache: Map<SoundEffect, HTMLAudioElement> = new Map();

// Default volume for sound effects
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

    try {
        const audio = new Audio(SOUND_URLS[sound]);
        audio.preload = 'auto';
        audio.volume = DEFAULT_VOLUME;

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
            audio = new Audio(SOUND_URLS[sound]);
        }

        audio.volume = DEFAULT_VOLUME;

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
