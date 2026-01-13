import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { useThemeColors } from '../../lib/hooks/useTheme';
import { useSettingsStore } from '../../lib/store';
import { spacing, borderRadius } from '../../lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

interface ReadingSettingsPanelProps {
    visible: boolean;
    onClose: () => void;
    anchorPosition?: { x: number; y: number };
}

export function ReadingSettingsPanel({ visible, onClose, anchorPosition }: ReadingSettingsPanelProps) {
    const { colors, typography, isDark } = useThemeColors();
    const { themeMode, fontSize, fontFamily, setPreference } = useSettingsStore();

    const fontSizes: Array<{ key: 'small' | 'medium' | 'large' | 'xlarge'; label: string }> = [
        { key: 'small', label: 'Aa' },
        { key: 'medium', label: 'Aa' },
        { key: 'large', label: 'Aa' },
        { key: 'xlarge', label: 'Aa' },
    ];

    const fonts: Array<{ key: 'inter' | 'roboto' | 'outfit' | 'system'; label: string }> = [
        { key: 'inter', label: 'Inter' },
        { key: 'roboto', label: 'Roboto' },
        { key: 'outfit', label: 'Outfit' },
        { key: 'system', label: 'System' },
    ];

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable
                    style={[
                        styles.panel,
                        {
                            backgroundColor: colors.background.secondary,
                            borderColor: colors.border.default,
                            top: anchorPosition?.y ?? 60,
                            right: spacing.md,
                        }
                    ]}
                    onPress={(e) => e.stopPropagation()}
                >
                    {/* Theme Toggle */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionLabel, { color: colors.text.muted, fontFamily: typography.fontFamily.medium }]}>
                            Theme
                        </Text>
                        <View style={styles.themeRow}>
                            <TouchableOpacity
                                style={[
                                    styles.themeButton,
                                    {
                                        backgroundColor: themeMode === 'light' ? colors.primary[500] : colors.background.tertiary,
                                        borderColor: themeMode === 'light' ? colors.primary[400] : colors.border.default,
                                    }
                                ]}
                                onPress={() => setPreference('themeMode', 'light')}
                            >
                                <Ionicons
                                    name="sunny"
                                    size={20}
                                    color={themeMode === 'light' ? colors.text.inverse : colors.text.secondary}
                                />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.themeButton,
                                    {
                                        backgroundColor: themeMode === 'dark' ? colors.primary[500] : colors.background.tertiary,
                                        borderColor: themeMode === 'dark' ? colors.primary[400] : colors.border.default,
                                    }
                                ]}
                                onPress={() => setPreference('themeMode', 'dark')}
                            >
                                <Ionicons
                                    name="moon"
                                    size={20}
                                    color={themeMode === 'dark' ? colors.text.inverse : colors.text.secondary}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Font Size */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionLabel, { color: colors.text.muted, fontFamily: typography.fontFamily.medium }]}>
                            Text Size
                        </Text>
                        <View style={styles.fontSizeRow}>
                            {fontSizes.map((size, index) => (
                                <TouchableOpacity
                                    key={size.key}
                                    style={[
                                        styles.fontSizeButton,
                                        {
                                            backgroundColor: fontSize === size.key ? colors.primary[500] : colors.background.tertiary,
                                            borderColor: fontSize === size.key ? colors.primary[400] : colors.border.default,
                                        }
                                    ]}
                                    onPress={() => setPreference('fontSize', size.key)}
                                >
                                    <Text
                                        style={{
                                            color: fontSize === size.key ? colors.text.inverse : colors.text.primary,
                                            fontSize: 12 + (index * 3),
                                            fontFamily: typography.fontFamily.medium,
                                        }}
                                    >
                                        {size.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Font Family */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionLabel, { color: colors.text.muted, fontFamily: typography.fontFamily.medium }]}>
                            Typography
                        </Text>
                        <View style={styles.fontGrid}>
                            {fonts.map((font) => (
                                <TouchableOpacity
                                    key={font.key}
                                    style={[
                                        styles.fontPill,
                                        {
                                            backgroundColor: fontFamily === font.key ? colors.primary[500] : colors.background.tertiary,
                                            borderColor: fontFamily === font.key ? colors.primary[400] : colors.border.default,
                                        }
                                    ]}
                                    onPress={() => setPreference('fontFamily', font.key)}
                                >
                                    <Text
                                        style={{
                                            color: fontFamily === font.key ? colors.text.inverse : colors.text.primary,
                                            fontSize: 13,
                                            fontFamily: fontFamily === font.key ? typography.fontFamily.bold : typography.fontFamily.medium,
                                        }}
                                    >
                                        {font.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    panel: {
        position: 'absolute',
        width: 280,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        padding: spacing.lg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    section: {
        marginBottom: spacing.md,
    },
    sectionLabel: {
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: spacing.sm,
    },
    themeRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    themeButton: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    fontSizeRow: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    fontSizeButton: {
        flex: 1,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    fontGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    fontPill: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        minWidth: '47%',
        alignItems: 'center',
    },
});
