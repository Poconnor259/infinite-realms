import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Switch, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, typography } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';
import { AnimatedPressable } from '../ui/Animated';
import { generateText } from '../../lib/firebase';
import type { GameEngine, ModuleCharacter, FormFieldDefinition } from '../../lib/types';

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
    const [generatingField, setGeneratingField] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Initialize stats with default values
    useEffect(() => {
        if (engine.stats) {
            const initialStats: Record<string, number> = {};
            engine.stats.forEach(stat => {
                initialStats[stat.id] = stat.default;
            });
            setStats(initialStats);
        }

        // Initialize form data with defaults
        if (engine.creationFields) {
            const initialData: Record<string, any> = {};
            engine.creationFields.forEach(field => {
                if (field.defaultValue !== undefined) {
                    initialData[field.id] = field.defaultValue;
                } else if (field.type === 'checkbox') {
                    initialData[field.id] = false;
                } else if (field.type === 'multiselect') {
                    initialData[field.id] = [];
                } else if (field.type === 'slider') {
                    initialData[field.id] = field.validation?.min ?? 0;
                }
            });
            setFormData(initialData);
        }
    }, [engine]);

    const handleStatChange = (statId: string, delta: number) => {
        const stat = engine.stats?.find(s => s.id === statId);
        if (!stat) return;

        setStats(prev => {
            const newValue = (prev[statId] || stat.default) + delta;
            const clampedValue = Math.max(stat.min, Math.min(stat.max, newValue));

            // Check stat point budget if defined
            if (engine.statPointBudget !== undefined) {
                // Calculate points spent (difference from defaults)
                const pointsSpent = Object.keys(prev).reduce((total, key) => {
                    const s = engine.stats?.find(st => st.id === key);
                    if (!s) return total;
                    const spent = (key === statId ? clampedValue : prev[key]) - s.default;
                    return total + Math.max(0, spent); // Only count points above default
                }, 0);

                // Don't allow change if it exceeds budget
                if (pointsSpent > engine.statPointBudget) {
                    return prev;
                }
            }

            return {
                ...prev,
                [statId]: clampedValue
            };
        });
    };

    // Calculate remaining stat points
    const getRemainingPoints = () => {
        if (engine.statPointBudget === undefined) return null;

        const pointsSpent = Object.keys(stats).reduce((total, key) => {
            const stat = engine.stats?.find(s => s.id === key);
            if (!stat) return total;
            const spent = stats[key] - stat.default;
            return total + Math.max(0, spent);
        }, 0);

        return engine.statPointBudget - pointsSpent;
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
    }

    // AI Generation for text fields
    const handleAIGenerate = async (fieldId: string, fieldLabel: string) => {
        const prompt = formData[fieldId] || '';

        setGeneratingField(fieldId);
        try {
            const aiPrompt = `Generate a ${fieldLabel.toLowerCase()} for a character named ${characterName} in a ${engine.name} game. ${prompt ? `User guidance: ${prompt}` : ''}. Respond with ONLY the generated text, no extra commentary. Keep it to 2-3 sentences.`;

            console.log('[AI Generate] Calling generateText with prompt:', aiPrompt);

            const response = await generateText({
                prompt: aiPrompt,
                maxLength: 150
            });

            console.log('[AI Generate] Response:', response);

            if (response.data.success && response.data.text) {
                setFormData(prev => ({ ...prev, [fieldId]: response.data.text }));
            } else {
                console.error('[AI Generate] Failed:', response.data);
                alert(`Failed to generate text: ${response.data.error || 'Unknown error'}`);
            }

        } catch (error: any) {
            console.error('[AI Generate] Error:', error);
            console.error('[AI Generate] Error details:', {
                message: error?.message,
                code: error?.code,
                details: error?.details
            });
            alert(`Failed to generate text: ${error?.message || 'Unknown error'}`);
        } finally {
            setGeneratingField(null);
        }
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
                                    <View>
                                        <TextInput
                                            style={[styles.input, {
                                                backgroundColor: colors.background.secondary,
                                                color: colors.text.primary,
                                                borderColor: colors.border.default
                                            }]}
                                            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                                            placeholderTextColor={colors.text.muted}
                                            value={formData[field.id] || ''}
                                            onChangeText={(text) => setFormData(prev => ({ ...prev, [field.id]: text }))}
                                            keyboardType={field.type === 'number' ? 'number-pad' : 'default'}
                                            multiline={field.type === 'text'}
                                            numberOfLines={field.type === 'text' ? 3 : 1}
                                        />
                                        {field.type === 'text' && (
                                            <TouchableOpacity
                                                style={[
                                                    styles.aiButton,
                                                    {
                                                        backgroundColor: colors.primary[500],
                                                        opacity: generatingField === field.id ? 0.7 : 1
                                                    }
                                                ]}
                                                onPress={() => handleAIGenerate(field.id, field.label)}
                                                disabled={generatingField === field.id}
                                            >
                                                {generatingField === field.id ? (
                                                    <ActivityIndicator size="small" color="#fff" />
                                                ) : (
                                                    <Ionicons name="sparkles" size={16} color="#fff" />
                                                )}
                                                <Text style={styles.aiButtonText}>
                                                    {generatingField === field.id ? 'Generating...' : 'Generate with AI'}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                        {field.type === 'text' && (
                                            <Text style={{ color: colors.text.muted, fontSize: typography.fontSize.xs, marginTop: spacing.xs }}>
                                                💡 Tip: Add details in the box above to guide the AI (e.g., "noble background" or "grew up in the mountains")
                                            </Text>
                                        )}
                                    </View>
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
                                ) : field.type === 'textarea' ? (
                                    <View>
                                        <TextInput
                                            style={[styles.textareaInput, {
                                                backgroundColor: colors.background.secondary,
                                                color: colors.text.primary,
                                                borderColor: colors.border.default
                                            }]}
                                            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                                            placeholderTextColor={colors.text.muted}
                                            value={formData[field.id] || ''}
                                            onChangeText={(text) => setFormData(prev => ({ ...prev, [field.id]: text }))}
                                            multiline
                                            numberOfLines={5}
                                            textAlignVertical="top"
                                        />
                                        {(field.aiGeneratable !== false) && (
                                            <TouchableOpacity
                                                style={[
                                                    styles.aiButton,
                                                    {
                                                        backgroundColor: colors.primary[500],
                                                        opacity: generatingField === field.id ? 0.7 : 1
                                                    }
                                                ]}
                                                onPress={() => handleAIGenerate(field.id, field.label)}
                                                disabled={generatingField === field.id}
                                            >
                                                {generatingField === field.id ? (
                                                    <ActivityIndicator size="small" color="#fff" />
                                                ) : (
                                                    <Ionicons name="sparkles" size={16} color="#fff" />
                                                )}
                                                <Text style={styles.aiButtonText}>
                                                    {generatingField === field.id ? 'Generating...' : 'Generate with AI'}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ) : field.type === 'slider' ? (
                                    <View style={styles.sliderContainer}>
                                        <TouchableOpacity
                                            style={[styles.sliderButton, { backgroundColor: colors.background.tertiary }]}
                                            onPress={() => {
                                                const min = field.validation?.min ?? 0;
                                                const current = formData[field.id] ?? min;
                                                if (current > min) {
                                                    setFormData(prev => ({ ...prev, [field.id]: current - 1 }));
                                                }
                                            }}
                                        >
                                            <Ionicons name="remove" size={20} color={colors.text.primary} />
                                        </TouchableOpacity>
                                        <View style={styles.sliderValueContainer}>
                                            <Text style={[styles.sliderValue, { color: colors.text.primary }]}>
                                                {formData[field.id] ?? field.validation?.min ?? 0}
                                            </Text>
                                            <Text style={[styles.sliderRange, { color: colors.text.muted }]}>
                                                ({field.validation?.min ?? 0} - {field.validation?.max ?? 100})
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            style={[styles.sliderButton, { backgroundColor: colors.background.tertiary }]}
                                            onPress={() => {
                                                const min = field.validation?.min ?? 0;
                                                const max = field.validation?.max ?? 100;
                                                const current = formData[field.id] ?? min;
                                                if (current < max) {
                                                    setFormData(prev => ({ ...prev, [field.id]: current + 1 }));
                                                }
                                            }}
                                        >
                                            <Ionicons name="add" size={20} color={colors.text.primary} />
                                        </TouchableOpacity>
                                    </View>
                                ) : field.type === 'checkbox' ? (
                                    <View style={styles.checkboxContainer}>
                                        <Switch
                                            value={!!formData[field.id]}
                                            onValueChange={(value) => setFormData(prev => ({ ...prev, [field.id]: value }))}
                                            trackColor={{ false: colors.background.tertiary, true: colors.primary[500] }}
                                            thumbColor={formData[field.id] ? colors.primary[300] : colors.text.muted}
                                        />
                                        <Text style={[styles.checkboxLabel, { color: colors.text.secondary }]}>
                                            {formData[field.id] ? 'Yes' : 'No'}
                                        </Text>
                                    </View>
                                ) : field.type === 'multiselect' && field.options ? (
                                    <View style={styles.optionsContainer}>
                                        {field.options.map((option) => {
                                            const selected = (formData[field.id] || []).includes(option.value);
                                            return (
                                                <TouchableOpacity
                                                    key={option.value}
                                                    style={[
                                                        styles.optionChip,
                                                        {
                                                            backgroundColor: selected
                                                                ? colors.primary[500]
                                                                : colors.background.tertiary,
                                                            borderColor: colors.border.default,
                                                        }
                                                    ]}
                                                    onPress={() => {
                                                        setFormData(prev => {
                                                            const current = prev[field.id] || [];
                                                            if (selected) {
                                                                return { ...prev, [field.id]: current.filter((v: string) => v !== option.value) };
                                                            } else {
                                                                return { ...prev, [field.id]: [...current, option.value] };
                                                            }
                                                        });
                                                    }}
                                                >
                                                    <Text style={{
                                                        color: selected ? '#fff' : colors.text.secondary,
                                                        fontSize: typography.fontSize.sm,
                                                    }}>
                                                        {option.label}
                                                    </Text>
                                                    {selected && (
                                                        <Ionicons name="checkmark" size={14} color="#fff" style={{ marginLeft: 4 }} />
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                ) : field.type === 'image' ? (
                                    <View style={styles.imageFieldContainer}>
                                        {formData[field.id] ? (
                                            <Image
                                                source={{ uri: formData[field.id] }}
                                                style={styles.characterImage}
                                                resizeMode="cover"
                                            />
                                        ) : (
                                            <View style={[styles.imagePlaceholder, { backgroundColor: colors.background.tertiary, borderColor: colors.border.default }]}>
                                                <Ionicons name="person" size={48} color={colors.text.muted} />
                                                <Text style={{ color: colors.text.muted, marginTop: spacing.sm }}>No portrait</Text>
                                            </View>
                                        )}
                                        <TouchableOpacity
                                            style={[
                                                styles.aiButton,
                                                {
                                                    backgroundColor: colors.primary[500],
                                                    opacity: generatingField === field.id ? 0.7 : 1
                                                }
                                            ]}
                                            onPress={() => {
                                                // TODO: Implement AI image generation
                                                alert('AI portrait generation coming soon!');
                                            }}
                                            disabled={generatingField === field.id}
                                        >
                                            <Ionicons name="sparkles" size={16} color="#fff" />
                                            <Text style={styles.aiButtonText}>Generate Portrait</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : null}

                                {/* Help Text */}
                                {field.helpText && (
                                    <Text style={[styles.helpText, { color: colors.text.muted }]}>
                                        {field.helpText}
                                    </Text>
                                )}

                                {/* Validation Error */}
                                {errors[field.id] && (
                                    <Text style={[styles.errorText, { color: colors.status.error }]}>
                                        {errors[field.id]}
                                    </Text>
                                )}
                            </View>
                        ))}
                    </View>
                )}

                {/* Stats Section */}
                {engine.stats && engine.stats.length > 0 && (
                    <View style={styles.section}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
                            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Attributes</Text>
                            {engine.statPointBudget !== undefined && (
                                <View style={{ backgroundColor: colors.background.tertiary, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.md }}>
                                    <Text style={{ color: colors.text.primary, fontSize: typography.fontSize.sm, fontWeight: '600' }}>
                                        Points: {getRemainingPoints()} / {engine.statPointBudget}
                                    </Text>
                                </View>
                            )}
                        </View>
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
                        disabled={isCreating}
                    >
                        <Text style={[styles.buttonText, { color: colors.text.secondary }]}>Back</Text>
                    </AnimatedPressable>
                    <AnimatedPressable
                        style={[
                            styles.button,
                            styles.confirmBtn,
                            { backgroundColor: colors.primary[500] },
                            isCreating && { opacity: 0.6 }
                        ]}
                        onPress={() => {
                            setIsCreating(true);
                            handleCreate();
                        }}
                        disabled={isCreating}
                    >
                        {isCreating ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <Text style={[styles.buttonText, { color: '#fff' }]}>Confirm</Text>
                        )}
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
    aiButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.md,
        marginTop: spacing.sm,
    },
    aiButtonText: {
        color: '#fff',
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    // New field type styles
    textareaInput: {
        padding: spacing.md,
        borderRadius: borderRadius.md,
        fontSize: typography.fontSize.md,
        borderWidth: 1,
        minHeight: 120,
        textAlignVertical: 'top',
    },
    sliderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    sliderButton: {
        width: 40,
        height: 40,
        borderRadius: borderRadius.full,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sliderValueContainer: {
        flex: 1,
        alignItems: 'center',
    },
    sliderValue: {
        fontSize: typography.fontSize.xl,
        fontWeight: 'bold',
    },
    sliderRange: {
        fontSize: typography.fontSize.xs,
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    checkboxLabel: {
        fontSize: typography.fontSize.md,
    },
    imageFieldContainer: {
        alignItems: 'center',
        gap: spacing.md,
    },
    characterImage: {
        width: 150,
        height: 150,
        borderRadius: borderRadius.lg,
    },
    imagePlaceholder: {
        width: 150,
        height: 150,
        borderRadius: borderRadius.lg,
        borderWidth: 2,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
    },
    helpText: {
        fontSize: typography.fontSize.xs,
        marginTop: spacing.xs,
    },
    errorText: {
        fontSize: typography.fontSize.xs,
        marginTop: spacing.xs,
    },
});
