import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, typography } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';
import { AnimatedPressable } from '../ui/Animated';
import type { GameEngine, ModuleCharacter } from '../../lib/types';

interface DynamicCharacterCreationProps {
    characterName: string;
    engine: GameEngine;
    onComplete: (character: ModuleCharacter) => void;
    onBack: () => void;
}

export function DynamicCharacterCreation({ characterName, engine, onComplete, onBack }: DynamicCharacterCreationProps) {
    const { colors } = useThemeColors();

    // Initialize character data
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [stats, setStats] = useState<Record<string, number>>({});

    // Initialize stats with default values
    useEffect(() => {
        if (engine.stats) {
            const initialStats: Record<string, number> = {};
            engine.stats.forEach(stat => {
                initialStats[stat.id] = stat.default;
            });
            setStats(initialStats);
        }
    }, [engine]);

    const handleStatChange = (statId: string, delta: number) => {
        const stat = engine.stats?.find(s => s.id === statId);
        if (!stat) return;

        setStats(prev => {
            const newValue = (prev[statId] || stat.default) + delta;
            return {
                ...prev,
                [statId]: Math.max(stat.min, Math.min(stat.max, newValue))
            };
        });
    };

    const handleCreate = () => {
        // Build character object based on engine configuration
        const character: any = {
            id: Date.now().toString(),
            name: characterName,
            level: 1,
            hp: {
                current: 100,
                max: 100,
            },
        };

        // Add stats
        if (engine.stats) {
            const statsObj: Record<string, number> = {};
            engine.stats.forEach(stat => {
                statsObj[stat.id] = stats[stat.id] || stat.default;
            });
            character.stats = statsObj;
        }

        // Add resources
        if (engine.resources) {
            engine.resources.forEach(resource => {
                if (resource.id !== 'hp') { // HP already added
                    character[resource.id] = {
                        current: 100,
                        max: 100,
                    };
                }
            });
        }

        // Add form field data
        Object.keys(formData).forEach(key => {
            character[key] = formData[key];
        });

        onComplete(character);
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: colors.text.primary }]}>
                        Create {characterName}
                    </Text>
                </View>

                <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
                    {engine.name} Character
                </Text>

                {/* Dynamic Form Fields */}
                {engine.creationFields && engine.creationFields.length > 0 && (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Character Details</Text>
                        {engine.creationFields.map((field, index) => (
                            <View key={field.id} style={styles.fieldContainer}>
                                <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>
                                    {field.label}{field.required && ' *'}
                                </Text>
                                {field.type === 'text' || field.type === 'number' ? (
                                    <TextInput
                                        style={[styles.input, {
                                            backgroundColor: colors.background.secondary,
                                            color: colors.text.primary,
                                            borderColor: colors.border.default
                                        }]}
                                        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                                        placeholderTextColor={colors.text.muted}
                                        value={formData[field.id] || ''}
                                        onChangeText={(text) => setFormData(prev => ({ ...prev, [field.id]: text }))}
                                        keyboardType={field.type === 'number' ? 'number-pad' : 'default'}
                                    />
                                ) : field.type === 'select' && field.options ? (
                                    <View style={styles.optionsContainer}>
                                        {field.options.map((option) => (
                                            <TouchableOpacity
                                                key={option.value}
                                                style={[
                                                    styles.optionChip,
                                                    {
                                                        backgroundColor: formData[field.id] === option.value
                                                            ? colors.primary[500]
                                                            : colors.background.tertiary,
                                                        borderColor: colors.border.default,
                                                    }
                                                ]}
                                                onPress={() => setFormData(prev => ({ ...prev, [field.id]: option.value }))}
                                            >
                                                <Text style={{
                                                    color: formData[field.id] === option.value ? '#fff' : colors.text.secondary,
                                                    fontSize: typography.fontSize.sm,
                                                }}>
                                                    {option.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                ) : null}
                            </View>
                        ))}
                    </View>
                )}

                {/* Stats Section */}
                {engine.stats && engine.stats.length > 0 && (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Attributes</Text>
                        {engine.stats.map((stat) => (
                            <View key={stat.id} style={[styles.statRow, { borderColor: colors.border.default }]}>
                                <View style={styles.statInfo}>
                                    <Text style={[styles.statName, { color: colors.text.primary }]}>
                                        {stat.abbreviation}
                                    </Text>
                                    <Text style={[styles.statFullName, { color: colors.text.muted }]}>
                                        {stat.name}
                                    </Text>
                                </View>
                                <View style={styles.statControls}>
                                    <TouchableOpacity
                                        style={[styles.statButton, { backgroundColor: colors.background.tertiary }]}
                                        onPress={() => handleStatChange(stat.id, -1)}
                                    >
                                        <Ionicons name="remove" size={20} color={colors.text.primary} />
                                    </TouchableOpacity>
                                    <Text style={[styles.statValue, { color: colors.text.primary }]}>
                                        {stats[stat.id] || stat.default}
                                    </Text>
                                    <TouchableOpacity
                                        style={[styles.statButton, { backgroundColor: colors.background.tertiary }]}
                                        onPress={() => handleStatChange(stat.id, 1)}
                                    >
                                        <Ionicons name="add" size={20} color={colors.text.primary} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Action Buttons */}
                <View style={styles.actions}>
                    <AnimatedPressable
                        style={[styles.button, styles.backBtn, { borderColor: colors.border.default }]}
                        onPress={onBack}
                    >
                        <Text style={[styles.buttonText, { color: colors.text.secondary }]}>Back</Text>
                    </AnimatedPressable>
                    <AnimatedPressable
                        style={[styles.button, styles.confirmBtn, { backgroundColor: colors.primary[500] }]}
                        onPress={handleCreate}
                    >
                        <Text style={[styles.buttonText, { color: '#fff' }]}>Confirm</Text>
                    </AnimatedPressable>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: spacing.lg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    backButton: {
        marginRight: spacing.md,
    },
    title: {
        fontSize: typography.fontSize.xxl,
        fontWeight: 'bold',
    },
    subtitle: {
        fontSize: typography.fontSize.md,
        marginBottom: spacing.xl,
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: '600',
        marginBottom: spacing.md,
    },
    fieldContainer: {
        marginBottom: spacing.md,
    },
    fieldLabel: {
        fontSize: typography.fontSize.sm,
        marginBottom: spacing.xs,
        fontWeight: '500',
    },
    input: {
        padding: spacing.md,
        borderRadius: borderRadius.md,
        fontSize: typography.fontSize.md,
        borderWidth: 1,
    },
    optionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    optionChip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        borderWidth: 1,
    },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        marginBottom: spacing.sm,
    },
    statInfo: {
        flex: 1,
    },
    statName: {
        fontSize: typography.fontSize.lg,
        fontWeight: 'bold',
    },
    statFullName: {
        fontSize: typography.fontSize.sm,
    },
    statControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    statButton: {
        width: 36,
        height: 36,
        borderRadius: borderRadius.full,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statValue: {
        fontSize: typography.fontSize.xl,
        fontWeight: 'bold',
        minWidth: 40,
        textAlign: 'center',
    },
    actions: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.xl,
    },
    button: {
        flex: 1,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: 'center',
    },
    backBtn: {
        borderWidth: 1,
    },
    confirmBtn: {},
    buttonText: {
        fontSize: typography.fontSize.md,
        fontWeight: '600',
    },
});
