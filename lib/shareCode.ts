/**
 * Share Code Generation and Parsing
 * 
 * Creates short, URL-safe codes for sharing characters and saves
 * Format: "AC-{base64url}" where data is LZ-compressed JSON
 */

import { compressToBase64, decompressFromBase64 } from 'lz-string';

// ==================== TYPES ====================

export interface ShareableData {
    type: 'character' | 'save';
    version: number;
    data: any;
}

export interface ShareCodeResult {
    success: boolean;
    code?: string;
    error?: string;
}

export interface ParseCodeResult {
    success: boolean;
    data?: ShareableData;
    error?: string;
}

// ==================== CONSTANTS ====================

const CODE_PREFIX = 'AC-';  // Atlas Cortex prefix
const CURRENT_VERSION = 2;

// ==================== GENERATION ====================

/**
 * Generate a share code from character or save data
 */
export function generateShareCode(
    data: any,
    type: 'character' | 'save'
): ShareCodeResult {
    try {
        const shareable: ShareableData = {
            type,
            version: CURRENT_VERSION,
            data
        };

        // Convert to JSON
        const jsonString = JSON.stringify(shareable);

        // Compress with LZ-string
        const compressed = compressToBase64(jsonString);

        // Make URL-safe (replace +/ with -_)
        const urlSafe = compressed
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, ''); // Remove trailing =

        const code = CODE_PREFIX + urlSafe;

        return {
            success: true,
            code
        };
    } catch (error: any) {
        console.error('[ShareCode] Generation failed:', error);
        return {
            success: false,
            error: error.message || 'Failed to generate share code'
        };
    }
}

/**
 * Parse a share code back into data
 */
export function parseShareCode(code: string): ParseCodeResult {
    try {
        // Validate prefix
        if (!code.startsWith(CODE_PREFIX)) {
            return {
                success: false,
                error: 'Invalid share code format'
            };
        }

        // Remove prefix
        const encoded = code.substring(CODE_PREFIX.length);

        // Convert from URL-safe back to base64
        const base64 = encoded
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        // Decompress
        const jsonString = decompressFromBase64(base64);

        if (!jsonString) {
            return {
                success: false,
                error: 'Failed to decompress share code'
            };
        }

        // Parse JSON
        const data: ShareableData = JSON.parse(jsonString);

        // Validate structure
        if (!data.type || !data.version || !data.data) {
            return {
                success: false,
                error: 'Invalid share code structure'
            };
        }

        // Version check
        if (data.version > CURRENT_VERSION) {
            return {
                success: false,
                error: 'Share code is from a newer version. Please update the app.'
            };
        }

        return {
            success: true,
            data
        };
    } catch (error: any) {
        console.error('[ShareCode] Parsing failed:', error);
        return {
            success: false,
            error: error.message || 'Failed to parse share code'
        };
    }
}

/**
 * Estimate the size of a share code before generating
 */
export function estimateCodeSize(data: any): number {
    try {
        const jsonString = JSON.stringify(data);
        const compressed = compressToBase64(jsonString);
        return CODE_PREFIX.length + compressed.length;
    } catch {
        return 0;
    }
}

/**
 * Check if a string looks like a valid share code
 */
export function isValidShareCodeFormat(code: string): boolean {
    return code.startsWith(CODE_PREFIX) && code.length > CODE_PREFIX.length + 10;
}

/**
 * Copy share code to clipboard
 */
export async function copyShareCodeToClipboard(code: string): Promise<boolean> {
    try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            await navigator.clipboard.writeText(code);
            return true;
        }
        return false;
    } catch (error) {
        console.error('[ShareCode] Failed to copy to clipboard:', error);
        return false;
    }
}
