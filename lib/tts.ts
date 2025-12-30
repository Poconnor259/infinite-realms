/**
 * Text-to-Speech Service
 * 
 * Provides TTS functionality for narrator voice.
 * Uses Web Speech API on web and expo-speech on mobile.
 */

import { Platform } from 'react-native';

interface SpeakOptions {
    rate?: number;
    pitch?: number;
    voice?: string;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (error: string) => void;
}

let isSpeaking = false;
let currentUtterance: SpeechSynthesisUtterance | null = null;

/**
 * Clean text for TTS by removing markdown formatting
 */
function cleanTextForTTS(text: string): string {
    return text
        // Remove code blocks
        .replace(/```[\s\S]*?```/g, '')
        // Remove bold markdown
        .replace(/\*\*(.*?)\*\*/g, '$1')
        // Remove italic markdown
        .replace(/\*(.*?)\*/g, '$1')
        // Remove inline code
        .replace(/`([^`]+)`/g, '$1')
        // Remove special brackets from blue box
        .replace(/[『』]/g, '')
        // Clean up extra whitespace
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Get available voices for the current platform
 */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return [];
    return window.speechSynthesis?.getVoices() || [];
}

/**
 * Check if TTS is currently speaking
 */
export function isTTSSpeaking(): boolean {
    return isSpeaking;
}

/**
 * Speak text using TTS
 */
export async function speakText(text: string, options: SpeakOptions = {}): Promise<void> {
    const cleanText = cleanTextForTTS(text);

    if (!cleanText) return;

    // Stop any current speech
    stopSpeaking();

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
        return new Promise((resolve, reject) => {
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.rate = options.rate ?? 1.0;
            utterance.pitch = options.pitch ?? 1.0;

            // Try to find a good voice
            const voices = getAvailableVoices();
            if (voices.length > 0) {
                // Prefer English voices
                const englishVoice = voices.find(v =>
                    v.lang.startsWith('en') && v.name.includes('Google')
                ) || voices.find(v => v.lang.startsWith('en'));

                if (englishVoice) {
                    utterance.voice = englishVoice;
                }
            }

            utterance.onstart = () => {
                isSpeaking = true;
                options.onStart?.();
            };

            utterance.onend = () => {
                isSpeaking = false;
                currentUtterance = null;
                options.onEnd?.();
                resolve();
            };

            utterance.onerror = (event) => {
                isSpeaking = false;
                currentUtterance = null;
                const error = event.error || 'Unknown TTS error';
                options.onError?.(error);
                reject(new Error(error));
            };

            currentUtterance = utterance;
            window.speechSynthesis.speak(utterance);
        });
    } else {
        // For mobile, we would use expo-speech
        // For now, just log that mobile TTS is not implemented
        console.log('[TTS] Mobile TTS not yet implemented');
        return Promise.resolve();
    }
}

/**
 * Stop any current TTS playback
 */
export function stopSpeaking(): void {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    isSpeaking = false;
    currentUtterance = null;
}

/**
 * Pause current TTS playback
 */
export function pauseSpeaking(): void {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.pause();
    }
}

/**
 * Resume paused TTS playback
 */
export function resumeSpeaking(): void {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.resume();
    }
}
