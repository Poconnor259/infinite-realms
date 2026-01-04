import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { uploadAmbianceAudio } from '../../lib/audioStorage';
import { spacing, borderRadius, typography } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';

interface AmbianceType {
    url: string;
    filename: string;
    enabled: boolean;
    keywords: string[];
    volume: number;
    priority: number;
}

interface AmbianceSettings {
    global: {
        autoDetection: boolean;
        defaultVolume: number;
        fadeInMs: number;
        fadeOutMs: number;
    };
    types: Record<string, AmbianceType>;
}

const AMBIANCE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
    tavern: 'beer-outline',
    forest: 'leaf-outline',
    dungeon: 'skull-outline',
    city: 'business-outline',
    combat: 'flash-outline',
    castle: 'home-outline',
    cave: 'moon-outline',
    ocean: 'water-outline',
    night: 'moon-outline',
    rain: 'rainy-outline',
};

export default function AudioManagement() {
    const { colors } = useThemeColors();
    const [settings, setSettings] = useState<AmbianceSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testNarrative, setTestNarrative] = useState('');
    const [detectedType, setDetectedType] = useState<string | null>(null);
    const [uploadingType, setUploadingType] = useState<string | null>(null);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const docRef = doc(db, 'settings', 'ambiance');
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                setSettings(docSnap.data() as AmbianceSettings);
            } else {
                // Initialize with defaults
                const defaults = getDefaultSettings();
                setSettings(defaults);
            }
        } catch (error) {
            console.error('Error loading ambiance settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = async () => {
        if (!settings) return;

        setSaving(true);
        try {
            await setDoc(doc(db, 'settings', 'ambiance'), settings);
            alert('Settings saved successfully!');
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const testDetection = () => {
        if (!settings || !testNarrative) return;

        const lowerText = testNarrative.toLowerCase();
        let bestMatch: { type: string; priority: number } | null = null;

        for (const [type, config] of Object.entries(settings.types)) {
            if (!config.enabled) continue;

            const regex = new RegExp(`\\b(${config.keywords.join('|')})\\b`, 'i');
            if (regex.test(lowerText)) {
                if (!bestMatch || config.priority > bestMatch.priority) {
                    bestMatch = { type, priority: config.priority };
                }
            }
        }

        setDetectedType(bestMatch?.type || null);
    };

    const getDefaultSettings = (): AmbianceSettings => ({
        global: {
            autoDetection: true,
            defaultVolume: 0.3,
            fadeInMs: 1000,
            fadeOutMs: 1000,
        },
        types: {
            tavern: {
                url: 'https://cdn.pixabay.com/audio/2024/02/08/audio_ac56737be4.mp3',
                filename: 'tavern-ambience.mp3',
                enabled: true,
                keywords: ['tavern', 'inn', 'bar', 'pub'],
                volume: 0.5,
                priority: 5,
            },
            forest: {
                url: 'https://cdn.pixabay.com/audio/2022/03/09/audio_c7acb35bca.mp3',
                filename: 'forest-ambience.mp3',
                enabled: true,
                keywords: ['forest', 'woods', 'trees'],
                volume: 0.5,
                priority: 5,
            },
            dungeon: {
                url: 'https://cdn.pixabay.com/audio/2022/11/17/audio_fe4aaeecb0.mp3',
                filename: 'dungeon-ambience.mp3',
                enabled: true,
                keywords: ['dungeon', 'prison', 'crypt'],
                volume: 0.5,
                priority: 5,
            },
            city: {
                url: 'https://cdn.pixabay.com/audio/2021/09/02/audio_95e4dc3d6f.mp3',
                filename: 'city-ambience.mp3',
                enabled: true,
                keywords: ['city', 'town', 'market'],
                volume: 0.5,
                priority: 5,
            },
            combat: {
                url: 'https://cdn.pixabay.com/audio/2023/10/24/audio_7fd0df0e06.mp3',
                filename: 'combat-ambience.mp3',
                enabled: true,
                keywords: ['combat', 'battle', 'fight'],
                volume: 0.5,
                priority: 8,
            },
            castle: {
                url: 'https://cdn.pixabay.com/audio/2022/05/27/audio_f5462cdede.mp3',
                filename: 'castle-ambience.mp3',
                enabled: true,
                keywords: ['castle', 'palace', 'throne'],
                volume: 0.5,
                priority: 5,
            },
            cave: {
                url: 'https://cdn.pixabay.com/audio/2022/06/01/audio_c067fb28ea.mp3',
                filename: 'cave-ambience.mp3',
                enabled: true,
                keywords: ['cave', 'cavern'],
                volume: 0.5,
                priority: 5,
            },
            ocean: {
                url: 'https://cdn.pixabay.com/audio/2022/02/22/audio_ea1a0c0a91.mp3',
                filename: 'ocean-ambience.mp3',
                enabled: true,
                keywords: ['ocean', 'sea', 'beach'],
                volume: 0.5,
                priority: 5,
            },
            night: {
                url: 'https://cdn.pixabay.com/audio/2022/05/31/audio_32e41c0bc6.mp3',
                filename: 'night-ambience.mp3',
                enabled: true,
                keywords: ['night', 'moon', 'stars'],
                volume: 0.5,
                priority: 5,
            },
            rain: {
                url: 'https://cdn.pixabay.com/audio/2022/03/24/audio_bae35a2adf.mp3',
                filename: 'rain-ambience.mp3',
                enabled: true,
                keywords: ['rain', 'storm', 'thunder'],
                volume: 0.5,
                priority: 5,
            },
        },
    });

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
                <Text style={{ color: colors.text.primary }}>Loading...</Text>
            </SafeAreaView>
        );
    }

    if (!settings) return null;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]} edges={['top']}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={[styles.title, { color: colors.text.primary }]}>Audio Management</Text>
                </View>

                {/* Global Settings */}
                <View style={[styles.section, { backgroundColor: colors.background.secondary, borderColor: colors.border.default }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>⚙️ Global Settings</Text>

                    <View style={styles.row}>
                        <Text style={[styles.label, { color: colors.text.primary }]}>Auto-Detection</Text>
                        <Switch
                            value={settings.global.autoDetection}
                            onValueChange={(value) => setSettings({
                                ...settings,
                                global: { ...settings.global, autoDetection: value }
                            })}
                        />
                    </View>

                    <View style={styles.row}>
                        <Text style={[styles.label, { color: colors.text.primary }]}>Default Volume</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text.primary, borderColor: colors.border.default }]}
                            value={(settings.global.defaultVolume * 100).toString()}
                            onChangeText={(text) => setSettings({
                                ...settings,
                                global: { ...settings.global, defaultVolume: parseInt(text) / 100 || 0 }
                            })}
                            keyboardType="numeric"
                            placeholder="30"
                        />
                        <Text style={[styles.label, { color: colors.text.muted }]}>%</Text>
                    </View>

                    <View style={styles.row}>
                        <Text style={[styles.label, { color: colors.text.primary }]}>Fade In (ms)</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text.primary, borderColor: colors.border.default }]}
                            value={settings.global.fadeInMs.toString()}
                            onChangeText={(text) => setSettings({
                                ...settings,
                                global: { ...settings.global, fadeInMs: parseInt(text) || 1000 }
                            })}
                            keyboardType="numeric"
                        />
                    </View>

                    <View style={styles.row}>
                        <Text style={[styles.label, { color: colors.text.primary }]}>Fade Out (ms)</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text.primary, borderColor: colors.border.default }]}
                            value={settings.global.fadeOutMs.toString()}
                            onChangeText={(text) => setSettings({
                                ...settings,
                                global: { ...settings.global, fadeOutMs: parseInt(text) || 1000 }
                            })}
                            keyboardType="numeric"
                        />
                    </View>
                </View>

                {/* Ambiance Types */}
                {Object.entries(settings.types).map(([type, config]) => (
                    <View key={type} style={[styles.section, { backgroundColor: colors.background.secondary, borderColor: colors.border.default }]}>
                        <View style={styles.typeHeader}>
                            <View style={styles.typeHeaderLeft}>
                                <Ionicons name={AMBIANCE_ICONS[type] || 'musical-note-outline'} size={24} color={colors.primary[400]} />
                                <Text style={[styles.sectionTitle, { color: colors.text.primary, marginLeft: spacing.sm }]}>
                                    {type.charAt(0).toUpperCase() + type.slice(1)}
                                </Text>
                            </View>
                            <Switch
                                value={config.enabled}
                                onValueChange={(value) => setSettings({
                                    ...settings,
                                    types: {
                                        ...settings.types,
                                        [type]: { ...config, enabled: value }
                                    }
                                })}
                            />
                        </View>

                        {/* Audio Player */}
                        {config.url && (
                            <View style={[styles.audioPlayer, { backgroundColor: colors.background.tertiary, borderColor: colors.border.default }]}>
                                <audio
                                    controls
                                    style={{ width: '100%', height: 40 }}
                                    src={config.url}
                                >
                                    Your browser does not support the audio element.
                                </audio>
                            </View>
                        )}

                        {/* URL Editor */}
                        <View style={styles.urlSection}>
                            <Text style={[styles.label, { color: colors.text.primary, marginBottom: 4 }]}>Audio URL</Text>
                            <TextInput
                                style={[styles.urlInput, { color: colors.text.primary, borderColor: colors.border.default, backgroundColor: colors.background.tertiary }]}
                                value={config.url}
                                onChangeText={(text) => setSettings({
                                    ...settings,
                                    types: {
                                        ...settings.types,
                                        [type]: { ...config, url: text }
                                    }
                                })}
                                placeholder="https://example.com/audio.mp3"
                                placeholderTextColor={colors.text.muted}
                                multiline
                            />
                        </View>

                        {/* Upload Button */}
                        <TouchableOpacity
                            style={[styles.uploadButton, { backgroundColor: uploadingType === type ? colors.text.muted : colors.primary[500] }]}
                            onPress={async () => {
                                if (uploadingType) return; // Prevent multiple uploads

                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'audio/*';
                                input.onchange = async (e: any) => {
                                    const file = e.target.files[0];
                                    if (!file) return;

                                    try {
                                        setUploadingType(type);
                                        console.log(`[Upload] Starting upload for ${type}: ${file.name}`);

                                        // Upload to Firebase Storage
                                        const downloadURL = await uploadAmbianceAudio(file, type);

                                        // Update settings with new URL
                                        setSettings({
                                            ...settings,
                                            types: {
                                                ...settings.types,
                                                [type]: {
                                                    ...config,
                                                    url: downloadURL,
                                                    filename: file.name
                                                }
                                            }
                                        });

                                        alert(`✅ Upload successful!\n\nFile: ${file.name}\nClick "Save All Changes" to persist.`);
                                    } catch (error: any) {
                                        console.error('[Upload] Failed:', error);
                                        alert(`❌ Upload failed: ${error.message}`);
                                    } finally {
                                        setUploadingType(null);
                                    }
                                };
                                input.click();
                            }}
                            disabled={uploadingType !== null}
                        >
                            <Ionicons name={uploadingType === type ? "hourglass-outline" : "cloud-upload-outline"} size={16} color="#fff" />
                            <Text style={[styles.uploadButtonText, { color: '#fff' }]}>
                                {uploadingType === type ? 'Uploading...' : 'Upload Audio File'}
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.row}>
                            <Text style={[styles.label, { color: colors.text.primary }]}>Keywords</Text>
                        </View>
                        <Text style={[styles.keywords, { color: colors.text.secondary }]}>
                            {config.keywords.join(', ')}
                        </Text>

                        <View style={styles.row}>
                            <Text style={[styles.label, { color: colors.text.primary }]}>Volume</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text.primary, borderColor: colors.border.default }]}
                                value={(config.volume * 100).toString()}
                                onChangeText={(text) => setSettings({
                                    ...settings,
                                    types: {
                                        ...settings.types,
                                        [type]: { ...config, volume: parseInt(text) / 100 || 0.5 }
                                    }
                                })}
                                keyboardType="numeric"
                            />
                            <Text style={[styles.label, { color: colors.text.muted }]}>%</Text>
                        </View>

                        <View style={styles.row}>
                            <Text style={[styles.label, { color: colors.text.primary }]}>Priority</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text.primary, borderColor: colors.border.default }]}
                                value={config.priority.toString()}
                                onChangeText={(text) => setSettings({
                                    ...settings,
                                    types: {
                                        ...settings.types,
                                        [type]: { ...config, priority: parseInt(text) || 5 }
                                    }
                                })}
                                keyboardType="numeric"
                            />
                        </View>
                    </View>
                ))}

                {/* Testing */}
                <View style={[styles.section, { backgroundColor: colors.background.secondary, borderColor: colors.border.default }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>🧪 Testing</Text>

                    <TextInput
                        style={[styles.textArea, { color: colors.text.primary, borderColor: colors.border.default, backgroundColor: colors.background.tertiary }]}
                        value={testNarrative}
                        onChangeText={setTestNarrative}
                        placeholder="Enter sample narrative text..."
                        placeholderTextColor={colors.text.muted}
                        multiline
                        numberOfLines={4}
                    />

                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: colors.primary[500] }]}
                        onPress={testDetection}
                    >
                        <Text style={[styles.buttonText, { color: '#fff' }]}>Test Detection</Text>
                    </TouchableOpacity>

                    {detectedType && (
                        <Text style={[styles.detectionResult, { color: colors.status.success }]}>
                            Detected: {detectedType.charAt(0).toUpperCase() + detectedType.slice(1)} (Priority: {settings.types[detectedType].priority})
                        </Text>
                    )}
                </View>

                {/* Save Button */}
                <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: colors.status.success }]}
                    onPress={saveSettings}
                    disabled={saving}
                >
                    <Ionicons name="save-outline" size={20} color="#fff" />
                    <Text style={[styles.saveButtonText, { color: '#fff' }]}>
                        {saving ? 'Saving...' : 'Save All Changes'}
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.lg,
    },
    header: {
        marginBottom: spacing.lg,
    },
    title: {
        fontSize: typography.fontSize.xl,
        fontWeight: '700',
    },
    section: {
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: '600',
        marginBottom: spacing.sm,
    },
    typeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    typeHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    label: {
        flex: 1,
        fontSize: typography.fontSize.md,
    },
    sublabel: {
        fontSize: typography.fontSize.sm,
        marginBottom: spacing.sm,
    },
    keywords: {
        fontSize: typography.fontSize.sm,
        marginBottom: spacing.sm,
        fontStyle: 'italic',
    },
    input: {
        borderWidth: 1,
        borderRadius: borderRadius.md,
        padding: spacing.sm,
        width: 80,
        textAlign: 'center',
    },
    textArea: {
        borderWidth: 1,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginBottom: spacing.sm,
        minHeight: 100,
    },
    button: {
        padding: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    buttonText: {
        fontSize: typography.fontSize.md,
        fontWeight: '600',
    },
    detectionResult: {
        fontSize: typography.fontSize.md,
        fontWeight: '600',
        textAlign: 'center',
    },
    audioPlayer: {
        marginBottom: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        padding: spacing.sm,
        overflow: 'hidden',
    },
    urlSection: {
        marginBottom: spacing.md,
    },
    urlInput: {
        borderWidth: 1,
        borderRadius: borderRadius.md,
        padding: spacing.sm,
        minHeight: 60,
        textAlignVertical: 'top',
    },
    uploadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        marginBottom: spacing.md,
        gap: spacing.xs,
    },
    uploadButtonText: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        marginTop: spacing.md,
        gap: spacing.sm,
    },
    saveButtonText: {
        fontSize: typography.fontSize.lg,
        fontWeight: '700',
    },
});
