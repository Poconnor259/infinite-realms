/**
 * Auto-Backup Settings Component
 * 
 * Add this to your settings screen to configure auto-backup
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { spacing, borderRadius, typography } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';
import { loadSettings, saveSettings, selectBackupFolder, type AutoBackupSettings } from '../../lib/autoBackup';

export function AutoBackupSettings() {
    const { colors } = useThemeColors();
    const [settings, setSettings] = useState<AutoBackupSettings>({
        enabled: false,
        folderPath: null,
        compress: true,
        frequencyTurns: 10,
        maxBackups: 3
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSettingsFromStorage();
    }, []);

    const loadSettingsFromStorage = async () => {
        const stored = await loadSettings();
        setSettings(stored);
        setLoading(false);
    };

    const updateSetting = async (key: keyof AutoBackupSettings, value: any) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        await saveSettings(newSettings);
    };

    const handleSelectFolder = async () => {
        const folder = await selectBackupFolder();
        if (folder) {
            updateSetting('folderPath', folder);
            Alert.alert('Success', `Backup folder set to: ${folder}`);
        }
    };

    if (loading) {
        return null;
    }

    return (
        <View style={styles.container}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
                Auto-Backup
            </Text>

            {/* Enable Toggle */}
            <View style={[styles.row, { backgroundColor: colors.background.secondary }]}>
                <View style={styles.rowLeft}>
                    <Ionicons name="save-outline" size={20} color={colors.text.primary} />
                    <Text style={[styles.rowText, { color: colors.text.primary }]}>
                        Enable Auto-Backup
                    </Text>
                </View>
                <Switch
                    value={settings.enabled}
                    onValueChange={(value) => updateSetting('enabled', value)}
                    trackColor={{ false: colors.background.tertiary, true: colors.primary[300] }}
                    thumbColor={settings.enabled ? colors.primary[500] : colors.text.muted}
                />
            </View>

            {/* Folder Selection */}
            <TouchableOpacity
                style={[styles.row, { backgroundColor: colors.background.secondary }]}
                onPress={handleSelectFolder}
                disabled={!settings.enabled}
            >
                <View style={styles.rowLeft}>
                    <Ionicons name="folder-outline" size={20} color={colors.text.primary} />
                    <View style={styles.rowTextContainer}>
                        <Text style={[styles.rowText, { color: colors.text.primary }]}>
                            Backup Folder
                        </Text>
                        <Text style={[styles.rowSubtext, { color: colors.text.muted }]}>
                            {settings.folderPath || 'Not selected'}
                        </Text>
                    </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
            </TouchableOpacity>

            {/* Compress Toggle */}
            <View style={[styles.row, { backgroundColor: colors.background.secondary }]}>
                <View style={styles.rowLeft}>
                    <Ionicons name="archive-outline" size={20} color={colors.text.primary} />
                    <View style={styles.rowTextContainer}>
                        <Text style={[styles.rowText, { color: colors.text.primary }]}>
                            Compress Backups
                        </Text>
                        <Text style={[styles.rowSubtext, { color: colors.text.muted }]}>
                            ~75% smaller file size
                        </Text>
                    </View>
                </View>
                <Switch
                    value={settings.compress}
                    onValueChange={(value) => updateSetting('compress', value)}
                    disabled={!settings.enabled}
                    trackColor={{ false: colors.background.tertiary, true: colors.primary[300] }}
                    thumbColor={settings.compress ? colors.primary[500] : colors.text.muted}
                />
            </View>

            {/* Frequency Slider */}
            <View style={[styles.sliderContainer, { backgroundColor: colors.background.secondary }]}>
                <View style={styles.sliderHeader}>
                    <Text style={[styles.rowText, { color: colors.text.primary }]}>
                        Backup Frequency
                    </Text>
                    <Text style={[styles.sliderValue, { color: colors.primary[500] }]}>
                        Every {settings.frequencyTurns} turns
                    </Text>
                </View>
                <Slider
                    style={styles.slider}
                    minimumValue={5}
                    maximumValue={50}
                    step={5}
                    value={settings.frequencyTurns}
                    onValueChange={(value) => updateSetting('frequencyTurns', value)}
                    disabled={!settings.enabled}
                    minimumTrackTintColor={colors.primary[500]}
                    maximumTrackTintColor={colors.background.tertiary}
                    thumbTintColor={colors.primary[500]}
                />
            </View>

            {/* Max Backups Slider */}
            <View style={[styles.sliderContainer, { backgroundColor: colors.background.secondary }]}>
                <View style={styles.sliderHeader}>
                    <Text style={[styles.rowText, { color: colors.text.primary }]}>
                        Maximum Backups
                    </Text>
                    <Text style={[styles.sliderValue, { color: colors.primary[500] }]}>
                        {settings.maxBackups} saves
                    </Text>
                </View>
                <Slider
                    style={styles.slider}
                    minimumValue={1}
                    maximumValue={10}
                    step={1}
                    value={settings.maxBackups}
                    onValueChange={(value) => updateSetting('maxBackups', value)}
                    disabled={!settings.enabled}
                    minimumTrackTintColor={colors.primary[500]}
                    maximumTrackTintColor={colors.background.tertiary}
                    thumbTintColor={colors.primary[500]}
                />
            </View>

            <Text style={[styles.hint, { color: colors.text.muted }]}>
                Backups are saved automatically based on your settings
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: spacing.sm,
    },
    sectionTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: 'bold',
        marginBottom: spacing.sm,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
        borderRadius: borderRadius.md,
    },
    rowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        flex: 1,
    },
    rowTextContainer: {
        flex: 1,
    },
    rowText: {
        fontSize: typography.fontSize.md,
        fontWeight: '600',
    },
    rowSubtext: {
        fontSize: typography.fontSize.sm,
        marginTop: 2,
    },
    sliderContainer: {
        padding: spacing.md,
        borderRadius: borderRadius.md,
    },
    sliderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    sliderValue: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    slider: {
        width: '100%',
        height: 40,
    },
    hint: {
        fontSize: typography.fontSize.sm,
        textAlign: 'center',
        marginTop: spacing.sm,
    },
});
