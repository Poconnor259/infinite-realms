import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useThemeColors } from '../../lib/hooks/useTheme';
import { useSettingsStore } from '../../lib/store';
import { spacing, borderRadius, palettes } from '../../lib/theme';
import { Ionicons } from '@expo/vector-icons';

interface ThemeSelectorProps {
    // Optional props can go here
}

export function ThemeSelector({ }: ThemeSelectorProps) {
    const { colors, typography, variant: currentVariant, fontFamily: currentFont } = useThemeColors();
    const { setPreference } = useSettingsStore();

    const themes = [
        { id: 'midnight', name: 'Midnight', color: palettes.midnight.primary[500] },
        { id: 'forest', name: 'Forest', color: palettes.forest.primary[500] },
        { id: 'ocean', name: 'Ocean', color: palettes.ocean.primary[500] },
    ];

    const fonts = [
        { id: 'inter', name: 'Inter' },
        { id: 'roboto', name: 'Roboto' },
        { id: 'outfit', name: 'Outfit' },
        { id: 'system', name: 'System' },
    ];

    return (
        <View style={styles.container}>
            {/* Theme Variant Selection */}
            <Text style={[styles.label, { color: colors.text.muted, fontFamily: typography.fontFamily.medium }]}>
                Background Theme
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themeList}>
                {themes.map((t) => (
                    <TouchableOpacity
                        key={t.id}
                        onPress={() => setPreference('themeVariant', t.id)}
                        style={[
                            styles.themeItem,
                            { borderColor: currentVariant === t.id ? colors.primary[400] : 'transparent' }
                        ]}
                    >
                        <View style={[styles.colorCircle, { backgroundColor: t.color }]} />
                        <Text style={[
                            styles.themeName,
                            {
                                color: currentVariant === t.id ? colors.text.primary : colors.text.muted,
                                fontFamily: currentVariant === t.id ? typography.fontFamily.bold : typography.fontFamily.regular
                            }
                        ]}>
                            {t.name}
                        </Text>
                        {currentVariant === t.id && (
                            <Ionicons name="checkmark-circle" size={16} color={colors.primary[400]} style={styles.checkIcon} />
                        )}
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <View style={{ height: spacing.lg }} />

            {/* Font Selection */}
            <Text style={[styles.label, { color: colors.text.muted, fontFamily: typography.fontFamily.medium }]}>
                Typography
            </Text>
            <View style={styles.fontGrid}>
                {fonts.map((f) => (
                    <TouchableOpacity
                        key={f.id}
                        onPress={() => setPreference('fontFamily', f.id)}
                        style={[
                            styles.fontItem,
                            {
                                backgroundColor: currentFont === f.id ? colors.primary[500] : colors.background.tertiary,
                                borderColor: currentFont === f.id ? colors.primary[400] : colors.border.default
                            }
                        ]}
                    >
                        <Text style={[
                            styles.fontName,
                            {
                                color: currentFont === f.id ? colors.text.inverse : colors.text.primary,
                                fontFamily: currentFont === f.id ? typography.fontFamily.bold : typography.fontFamily.medium
                            }
                        ]}>
                            {f.name}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: spacing.md,
    },
    label: {
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: spacing.md,
        paddingHorizontal: spacing.lg,
    },
    themeList: {
        paddingHorizontal: spacing.lg,
        gap: spacing.md,
    },
    themeItem: {
        alignItems: 'center',
        padding: spacing.sm,
        borderRadius: borderRadius.lg,
        borderWidth: 2,
        minWidth: 80,
    },
    colorCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginBottom: spacing.xs,
    },
    themeName: {
        fontSize: 12,
    },
    checkIcon: {
        position: 'absolute',
        top: 4,
        right: 4,
    },
    fontGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
    },
    fontItem: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        minWidth: '47%',
        alignItems: 'center',
    },
    fontName: {
        fontSize: 14,
    },
});
