/**
 * Sound Effects Tab Component
 * 
 * Admin UI for managing game sound effects
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, typography } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';
import {
    loadSoundEffectConfigs,
    saveSoundEffectConfig,
    uploadSoundEffect,
    updateSoundEffectSettings,
    initializeDefaultSoundEffects,
    DEFAULT_SOUND_EFFECTS,
    type SoundEffectConfig
} from '../../lib/soundEffectStorage';
import { playSound } from '../../lib/sounds';

const SOUND_EFFECT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
    buttonClick: 'finger-print-outline',
    diceRoll: 'dice-outline',
    success: 'checkmark-circle-outline',
    error: 'close-circle-outline',
    messageReceived: 'chatbubble-outline',
    turnSpent: 'hourglass-outline',
    levelUp: 'trophy-outline',
};

export function SoundEffectsTab() {
    const { colors } = useThemeColors();
    const [configs, setConfigs] = useState<Record<string, SoundEffectConfig>>({});
    const [loading, setLoading] = useState(true);
    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const [testingId, setTestingId] = useState<string | null>(null);

    useEffect(() => {
        loadConfigs();
    }, []);

    const loadConfigs = async () => {
        try {
            await initializeDefaultSoundEffects();
            const loaded = await loadSoundEffectConfigs();
            setConfigs(loaded);
        } catch (error) {
            console.error('[SoundEffectsTab] Failed to load configs:', error);
            Alert.alert('Error', 'Failed to load sound effect configurations');
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (effectId: string) => {
        if (uploadingId) return;

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        input.onchange = async (e: any) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                setUploadingId(effectId);
                console.log(`[SoundEffectsTab] Uploading ${effectId}: ${file.name}`);

                const url = await uploadSoundEffect(effectId, file, file.name);

                const config = configs[effectId] || DEFAULT_SOUND_EFFECTS[effectId];
                const newConfig: SoundEffectConfig = {
                    ...config,
                    id: effectId,
                    url,
                    filename: file.name,
                    uploadedAt: new Date().toISOString(),
                };

                await saveSoundEffectConfig(effectId, newConfig);
                setConfigs({ ...configs, [effectId]: newConfig });

                Alert.alert('Success', `✅ ${file.name} uploaded successfully!`);
            } catch (error: any) {
                console.error('[SoundEffectsTab] Upload failed:', error);
                Alert.alert('Error', `Failed to upload: ${error.message}`);
            } finally {
                setUploadingId(null);
            }
        };
        input.click();
    };

    const handleTest = async (effectId: string) => {
        const config = configs[effectId];
        if (!config || !config.url) {
            Alert.alert('Error', 'No audio file uploaded for this sound effect');
            return;
        }

        try {
            setTestingId(effectId);
            await playSound(effectId as any);
            setTimeout(() => setTestingId(null), 1000);
        } catch (error) {
            console.error('[SoundEffectsTab] Test playback failed:', error);
            Alert.alert('Error', 'Failed to play sound effect');
            setTestingId(null);
        }
    };

    const handleToggle = async (effectId: string, enabled: boolean) => {
        try {
            await updateSoundEffectSettings(effectId, { enabled });
            setConfigs({
                ...configs,
                [effectId]: { ...configs[effectId], enabled }
            });
        } catch (error) {
            console.error('[SoundEffectsTab] Failed to toggle:', error);
            Alert.alert('Error', 'Failed to update setting');
        }
    };

    const handleVolumeChange = async (effectId: string, volume: number) => {
        try {
            await updateSoundEffectSettings(effectId, { volume });
            setConfigs({
                ...configs,
                [effectId]: { ...configs[effectId], volume }
            });
        } catch (error) {
            console.error('[SoundEffectsTab] Failed to update volume:', error);
        }
    };

    const handleUrlChange = async (effectId: string, url: string) => {
        try {
            const config = configs[effectId] || DEFAULT_SOUND_EFFECTS[effectId];
            const newConfig: SoundEffectConfig = {
                ...config,
                id: effectId,
                url,
            };
            await saveSoundEffectConfig(effectId, newConfig);
            setConfigs({ ...configs, [effectId]: newConfig });
        } catch (error) {
            console.error('[SoundEffectsTab] Failed to update URL:', error);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
                <Text style={[styles.loadingText, { color: colors.text.muted }]}>
                    Loading sound effects...
                </Text>
            </View>
        );
    }

    const effectIds = Object.keys(DEFAULT_SOUND_EFFECTS);

    return (
        <View style={styles.container}>
            <Text style={[styles.description, { color: colors.text.muted }]}>
                Manage short audio clips for game events (button clicks, dice rolls, success/error, etc.)
            </Text>

            {effectIds.map((effectId) => {
                const config = configs[effectId] || { ...DEFAULT_SOUND_EFFECTS[effectId], id: effectId, url: '' };
                const isUploading = uploadingId === effectId;
                const isTesting = testingId === effectId;

                return (
                    <View
                        key={effectId}
                        style={[styles.effectCard, { backgroundColor: colors.background.secondary, borderColor: colors.border.default }]}
                    >
                        {/* Header */}
                        <View style={styles.effectHeader}>
                            <View style={styles.effectHeaderLeft}>
                                <Ionicons
                                    name={SOUND_EFFECT_ICONS[effectId] || 'musical-note-outline'}
                                    size={24}
                                    color={colors.primary[400]}
                                />
                                <View style={styles.effectInfo}>
                                    <Text style={[styles.effectName, { color: colors.text.primary }]}>
                                        {config.name}
                                    </Text>
                                    <Text style={[styles.effectCategory, { color: colors.text.muted }]}>
                                        {config.category}
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={config.enabled}
                                onValueChange={(value) => handleToggle(effectId, value)}
                            />
                        </View>

                        {/* Audio Player */}
                        {config.url && (
                            <View style={[styles.audioPlayer, { backgroundColor: colors.background.tertiary, borderColor: colors.border.default }]}>
                                <audio
                                    controls
                                    style={{ width: '100%', height: 32 }}
                                    src={config.url}
                                >
                                    Your browser does not support the audio element.
                                </audio>
                            </View>
                        )}

                        {/* URL Input */}
                        <View style={styles.urlSection}>
                            <Text style={[styles.label, { color: colors.text.secondary }]}>
                                Audio URL or CDN Link
                            </Text>
                            <TextInput
                                style={[styles.urlInput, { color: colors.text.primary, borderColor: colors.border.default, backgroundColor: colors.background.tertiary }]}
                                value={config.url}
                                onChangeText={(text) => handleUrlChange(effectId, text)}
                                placeholder="https://example.com/sound.mp3"
                                placeholderTextColor={colors.text.muted}
                            />
                        </View>

                        {/* Upload & Test Buttons */}
                        <View style={styles.buttonRow}>
                            <TouchableOpacity
                                style={[styles.uploadButton, { backgroundColor: isUploading ? colors.text.muted : colors.primary[500] }]}
                                onPress={() => handleUpload(effectId)}
                                disabled={isUploading}
                            >
                                <Ionicons
                                    name={isUploading ? 'hourglass-outline' : 'cloud-upload-outline'}
                                    size={16}
                                    color="#fff"
                                />
                                <Text style={[styles.buttonText, { color: '#fff' }]}>
                                    {isUploading ? 'Uploading...' : 'Upload File'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.testButton, { backgroundColor: isTesting ? colors.status.success : colors.background.tertiary, borderColor: colors.border.default }]}
                                onPress={() => handleTest(effectId)}
                                disabled={!config.url || isTesting}
                            >
                                <Ionicons
                                    name={isTesting ? 'volume-high' : 'play'}
                                    size={16}
                                    color={isTesting ? '#fff' : colors.text.primary}
                                />
                                <Text style={[styles.buttonText, { color: isTesting ? '#fff' : colors.text.primary }]}>
                                    {isTesting ? 'Playing...' : 'Test'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Volume Control */}
                        <View style={styles.volumeSection}>
                            <Text style={[styles.label, { color: colors.text.secondary }]}>
                                Volume
                            </Text>
                            <View style={styles.volumeControl}>
                                <TextInput
                                    style={[styles.volumeInput, { color: colors.text.primary, borderColor: colors.border.default }]}
                                    value={Math.round(config.volume * 100).toString()}
                                    onChangeText={(text) => {
                                        const volume = parseInt(text) / 100;
                                        if (!isNaN(volume) && volume >= 0 && volume <= 1) {
                                            handleVolumeChange(effectId, volume);
                                        }
                                    }}
                                    keyboardType="numeric"
                                />
                                <Text style={[styles.volumeLabel, { color: colors.text.muted }]}>%</Text>
                            </View>
                        </View>

                        {/* File Info */}
                        {config.filename && (
                            <Text style={[styles.fileInfo, { color: colors.text.muted }]}>
                                📁 {config.filename}
                            </Text>
                        )}
                    </View>
                );
            })}

            <View style={[styles.infoBox, { backgroundColor: colors.primary[900] + '20', borderColor: colors.primary[500] + '40' }]}>
                <Ionicons name="information-circle" size={20} color={colors.status.info} />
                <Text style={[styles.infoText, { color: colors.text.secondary }]}>
                    Sound effects play for game events like button clicks, dice rolls, and achievements. Upload MP3 files or use CDN URLs.
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: spacing.lg,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    loadingText: {
        marginTop: spacing.md,
        fontSize: typography.fontSize.md,
    },
    description: {
        fontSize: typography.fontSize.sm,
        marginBottom: spacing.lg,
        lineHeight: 20,
    },
    effectCard: {
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        marginBottom: spacing.md,
    },
    effectHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    effectHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    effectInfo: {
        marginLeft: spacing.md,
        flex: 1,
    },
    effectName: {
        fontSize: typography.fontSize.md,
        fontWeight: '600',
    },
    effectCategory: {
        fontSize: typography.fontSize.xs,
        marginTop: 2,
        textTransform: 'uppercase',
    },
    audioPlayer: {
        marginBottom: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        padding: spacing.xs,
        overflow: 'hidden',
    },
    urlSection: {
        marginBottom: spacing.sm,
    },
    label: {
        fontSize: typography.fontSize.sm,
        marginBottom: 4,
        fontWeight: '500',
    },
    urlInput: {
        borderWidth: 1,
        borderRadius: borderRadius.md,
        padding: spacing.sm,
        fontSize: typography.fontSize.sm,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    uploadButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        gap: spacing.xs,
    },
    testButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        gap: spacing.xs,
        borderWidth: 1,
        minWidth: 80,
    },
    buttonText: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    volumeSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.xs,
    },
    volumeControl: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    volumeInput: {
        borderWidth: 1,
        borderRadius: borderRadius.md,
        padding: spacing.sm,
        width: 60,
        textAlign: 'center',
        fontSize: typography.fontSize.sm,
    },
    volumeLabel: {
        fontSize: typography.fontSize.sm,
    },
    fileInfo: {
        fontSize: typography.fontSize.xs,
        marginTop: spacing.xs,
    },
    infoBox: {
        flexDirection: 'row',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    infoText: {
        flex: 1,
        fontSize: typography.fontSize.sm,
        lineHeight: 20,
    },
});
