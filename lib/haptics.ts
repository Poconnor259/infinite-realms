import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from './store';

// Check if we're running on a platform that supports haptics
const isHapticSupported = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Check if haptic feedback is enabled in settings
 */
function isHapticEnabled(): boolean {
    return useSettingsStore.getState().hapticFeedback;
}

/**
 * Light haptic feedback for taps and selections
 */
export function lightHaptic() {
    if (isHapticSupported && isHapticEnabled()) {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (e) {
            // Silently fail on web or unsupported devices
        }
    }
}

/**
 * Medium haptic feedback for confirmations
 */
export function mediumHaptic() {
    if (isHapticSupported && isHapticEnabled()) {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch (e) {
            // Silently fail
        }
    }
}

/**
 * Heavy haptic feedback for important actions
 */
export function heavyHaptic() {
    if (isHapticSupported && isHapticEnabled()) {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        } catch (e) {
            // Silently fail
        }
    }
}

/**
 * Success haptic feedback
 */
export function successHaptic() {
    if (isHapticSupported && isHapticEnabled()) {
        try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {
            // Silently fail
        }
    }
}

/**
 * Warning haptic feedback
 */
export function warningHaptic() {
    if (isHapticSupported && isHapticEnabled()) {
        try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } catch (e) {
            // Silently fail
        }
    }
}

/**
 * Error haptic feedback
 */
export function errorHaptic() {
    if (isHapticSupported && isHapticEnabled()) {
        try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } catch (e) {
            // Silently fail
        }
    }
}

/**
 * Selection changed haptic feedback
 */
export function selectionHaptic() {
    if (isHapticSupported && isHapticEnabled()) {
        try {
            Haptics.selectionAsync();
        } catch (e) {
            // Silently fail
        }
    }
}
