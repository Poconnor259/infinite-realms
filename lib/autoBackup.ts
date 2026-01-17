/**
 * Auto-Backup System
 * 
 * Automatically backs up campaign saves to user-selected folder
 * with configurable frequency and compression
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import type { CampaignSaveData } from './characterIO';

// ==================== TYPES ====================

export interface AutoBackupSettings {
    enabled: boolean;
    folderPath: string | null;
    compress: boolean;
    frequencyTurns: number;
    maxBackups: number;
}

export interface BackupResult {
    success: boolean;
    filePath?: string;
    error?: string;
}

// ==================== CONSTANTS ====================

const SETTINGS_KEY = 'atlas_autobackup_settings';
const LAST_BACKUP_KEY = 'atlas_last_backup_turn';
const DEFAULT_SETTINGS: AutoBackupSettings = {
    enabled: false,
    folderPath: null,
    compress: true,
    frequencyTurns: 10,
    maxBackups: 3
};

// ==================== SETTINGS MANAGEMENT ====================

/**
 * Load auto-backup settings
 */
export async function loadSettings(): Promise<AutoBackupSettings> {
    try {
        const stored = await AsyncStorage.getItem(SETTINGS_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
        return DEFAULT_SETTINGS;
    } catch (error) {
        console.error('[AutoBackup] Failed to load settings:', error);
        return DEFAULT_SETTINGS;
    }
}

/**
 * Save auto-backup settings
 */
export async function saveSettings(settings: AutoBackupSettings): Promise<boolean> {
    try {
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        return true;
    } catch (error) {
        console.error('[AutoBackup] Failed to save settings:', error);
        return false;
    }
}

/**
 * Select folder for auto-backups (web only)
 */
export async function selectBackupFolder(): Promise<string | null> {
    if (Platform.OS === 'web') {
        // Web: Use directory picker if available
        if ('showDirectoryPicker' in window) {
            try {
                const dirHandle = await (window as any).showDirectoryPicker();
                return dirHandle.name; // Store directory name
            } catch (error) {
                console.error('[AutoBackup] Folder selection cancelled:', error);
                return null;
            }
        } else {
            // Fallback: Use downloads folder
            return 'Downloads';
        }
    } else {
        // Mobile: Use document picker to select directory
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: false
            });

            if (result.canceled) {
                return null;
            }

            // Extract directory path
            const uri = result.assets[0].uri;
            const lastSlash = uri.lastIndexOf('/');
            return uri.substring(0, lastSlash);
        } catch (error) {
            console.error('[AutoBackup] Folder selection failed:', error);
            return null;
        }
    }
}

// ==================== BACKUP EXECUTION ====================

/**
 * Check if backup is needed based on turn count
 */
export async function shouldBackup(currentTurn: number): Promise<boolean> {
    try {
        const settings = await loadSettings();

        if (!settings.enabled || !settings.folderPath) {
            return false;
        }

        const lastBackupTurn = await AsyncStorage.getItem(LAST_BACKUP_KEY);
        const lastTurn = lastBackupTurn ? parseInt(lastBackupTurn) : 0;

        return (currentTurn - lastTurn) >= settings.frequencyTurns;
    } catch (error) {
        console.error('[AutoBackup] Failed to check backup status:', error);
        return false;
    }
}

/**
 * Perform auto-backup
 */
export async function performBackup(
    campaignId: string,
    saveData: CampaignSaveData,
    currentTurn: number
): Promise<BackupResult> {
    try {
        const settings = await loadSettings();

        if (!settings.enabled || !settings.folderPath) {
            return {
                success: false,
                error: 'Auto-backup not configured'
            };
        }

        const timestamp = Date.now();
        const filename = `atlas_backup_${campaignId}_${timestamp}.json${settings.compress ? '.gz' : ''}`;

        let data: string | Blob;

        if (settings.compress && Platform.OS === 'web') {
            // Compress on web
            const jsonString = JSON.stringify(saveData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });

            if (typeof CompressionStream !== 'undefined') {
                const stream = blob.stream().pipeThrough(new CompressionStream('gzip'));
                data = await new Response(stream).blob();
            } else {
                data = jsonString; // Fallback: uncompressed
            }
        } else {
            // Uncompressed
            data = JSON.stringify(saveData, null, 2);
        }

        // Save file
        let filePath: string;

        if (Platform.OS === 'web') {
            // Web: Download file
            const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            filePath = filename;
        } else {
            // Mobile: Save to selected folder
            const fullPath = `${settings.folderPath}/${filename}`;
            await FileSystem.writeAsStringAsync(fullPath, data as string);
            filePath = fullPath;
        }

        // Update last backup turn
        await AsyncStorage.setItem(LAST_BACKUP_KEY, String(currentTurn));

        // Cleanup old backups
        await cleanupOldBackups(campaignId, settings);

        return {
            success: true,
            filePath
        };

    } catch (error: any) {
        console.error('[AutoBackup] Backup failed:', error);
        return {
            success: false,
            error: error.message || 'Backup failed'
        };
    }
}

/**
 * Delete old backups exceeding maxBackups limit
 */
async function cleanupOldBackups(
    campaignId: string,
    settings: AutoBackupSettings
): Promise<void> {
    try {
        if (Platform.OS === 'web') {
            // Web: Can't delete files automatically
            return;
        }

        if (!settings.folderPath) {
            return;
        }

        // List backup files
        const files = await FileSystem.readDirectoryAsync(settings.folderPath);
        const backupFiles = files
            .filter(f => f.startsWith(`atlas_backup_${campaignId}_`))
            .map(f => ({
                name: f,
                timestamp: parseInt(f.split('_')[3].split('.')[0])
            }))
            .sort((a, b) => b.timestamp - a.timestamp);

        // Delete oldest files
        if (backupFiles.length > settings.maxBackups) {
            const toDelete = backupFiles.slice(settings.maxBackups);
            await Promise.all(
                toDelete.map(f =>
                    FileSystem.deleteAsync(`${settings.folderPath}/${f.name}`, { idempotent: true })
                )
            );
        }
    } catch (error) {
        console.error('[AutoBackup] Cleanup failed:', error);
        // Don't throw - cleanup failure shouldn't block backup
    }
}

/**
 * Manually trigger backup (for testing or user request)
 */
export async function manualBackup(
    campaignId: string,
    saveData: CampaignSaveData
): Promise<BackupResult> {
    const settings = await loadSettings();

    if (!settings.folderPath) {
        return {
            success: false,
            error: 'Please select a backup folder first'
        };
    }

    return performBackup(campaignId, saveData, 0);
}
