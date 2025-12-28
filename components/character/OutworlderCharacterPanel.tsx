import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { spacing, borderRadius, typography } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';
import type { OutworlderModuleState } from '../../lib/types';

interface OutworlderCharacterPanelProps {
    moduleState: OutworlderModuleState;
}

export function OutworlderCharacterPanel({ moduleState }: OutworlderCharacterPanelProps) {
    const { colors } = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { character } = moduleState;

    // Early return if character data is not available
    if (!character) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
                <Text style={{ color: colors.text.secondary, textAlign: 'center', marginBottom: spacing.sm }}>
                    Character stats will appear here
                </Text>
                <Text style={{ color: colors.text.muted, textAlign: 'center', fontSize: typography.fontSize.sm }}>
                    Send your first message to begin your adventure
                </Text>
            </View>
        );
    }

    const getRankColor = (rank: string) => {
        switch (rank) {
            case 'Iron': return '#6B7280';
            case 'Bronze': return '#CD7F32';
            case 'Silver': return '#C0C0C0';
            case 'Gold': return colors.gold.main;
            case 'Diamond': return '#B9F2FF';
            default: return colors.text.secondary;
        }
    };

    // Helper function to safely render any value (prevents React error #418)
    const safeRenderValue = (value: any): string => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }
        if (Array.isArray(value)) {
            return value.map(v => safeRenderValue(v)).join(', ');
        }
        if (typeof value === 'object') {
            if (value.current !== undefined && value.max !== undefined) {
                return `${value.current}/${value.max}`;
            }
            if (value.name) return String(value.name);
            return JSON.stringify(value);
        }
        return String(value);
    };

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Character Header */}
            <View style={styles.header}>
                <Text style={styles.characterName}>{safeRenderValue(character.name)}</Text>
                <View style={[styles.rankBadge, { backgroundColor: getRankColor(character.rank) + '20' }]}>
                    <Text style={[styles.rankText, { color: getRankColor(character.rank) }]}>
                        {safeRenderValue(character.rank)} Rank
                    </Text>
                </View>
                <Text style={styles.characterSubtitle}>Level {character.level}</Text>
            </View>

            {/* HP Bar */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Hit Points</Text>
                <View style={styles.resourceContainer}>
                    <View style={styles.resourceBar}>
                        <View
                            style={[
                                styles.resourceFill,
                                {
                                    width: `${(character.hp.current / character.hp.max) * 100}%`,
                                    backgroundColor: colors.status.error
                                }
                            ]}
                        />
                    </View>
                    <Text style={styles.resourceText}>
                        {character.hp.current} / {character.hp.max}
                    </Text>
                </View>
            </View>

            {/* Stamina Bar */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Stamina</Text>
                <View style={styles.resourceContainer}>
                    <View style={styles.resourceBar}>
                        <View
                            style={[
                                styles.resourceFill,
                                {
                                    width: `${(character.stamina.current / character.stamina.max) * 100}%`,
                                    backgroundColor: '#8B5CF6'
                                }
                            ]}
                        />
                    </View>
                    <Text style={styles.resourceText}>
                        {character.stamina.current} / {character.stamina.max}
                    </Text>
                </View>
            </View>

            {/* Mana Bar */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Mana</Text>
                <View style={styles.resourceContainer}>
                    <View style={styles.resourceBar}>
                        <View
                            style={[
                                styles.resourceFill,
                                {
                                    width: `${(character.mana.current / character.mana.max) * 100}%`,
                                    backgroundColor: '#3B82F6'
                                }
                            ]}
                        />
                    </View>
                    <Text style={styles.resourceText}>
                        {character.mana.current} / {character.mana.max}
                    </Text>
                </View>
            </View>

            {/* Dynamic Resources (AI Generated) */}
            {Object.entries(character).map(([key, value]: [string, any]) => {
                // Check if this looks like a resource (has current/max) and isn't a standard one
                if (
                    key !== 'hp' && key !== 'mana' && key !== 'spirit' &&
                    value && typeof value === 'object' &&
                    'current' in value && 'max' in value &&
                    typeof value.current === 'number' && typeof value.max === 'number'
                ) {
                    return (
                        <View key={key} style={styles.section}>
                            <Text style={styles.sectionTitle}>
                                {key.charAt(0).toUpperCase() + key.slice(1)}
                            </Text>
                            <View style={styles.resourceContainer}>
                                <View style={styles.resourceBar}>
                                    <View
                                        style={[
                                            styles.resourceFill,
                                            {
                                                width: `${Math.min(100, Math.max(0, (value.current / value.max) * 100))}%`,
                                                backgroundColor: '#14B8A6' // Teal for special resources
                                            }
                                        ]}
                                    />
                                </View>
                                <Text style={styles.resourceText}>
                                    {value.current} / {value.max}
                                </Text>
                            </View>
                        </View>
                    );
                }
                return null;
            })
            }

            {/* Essences */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Essences ({(character.essences || []).length + (character.confluence ? 1 : 0)}/4)</Text>
                {(character.essences || []).map((essence, idx) => (
                    <View key={idx} style={styles.essenceItem}>
                        <Text style={styles.essenceName}>{essence}</Text>
                    </View>
                ))}
                {character.confluence && (
                    <View style={[styles.essenceItem, styles.confluenceItem]}>
                        <Text style={styles.confluenceLabel}>Confluence:</Text>
                        <Text style={styles.confluenceName}>{character.confluence}</Text>
                    </View>
                )}
                {(!character.essences || character.essences.length === 0) && (
                    <Text style={styles.emptyText}>No essences absorbed yet</Text>
                )}
            </View>

            {/* Abilities */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Abilities</Text>
                {(character.abilities || []).map((ability, idx) => (
                    <View key={idx} style={styles.abilityItem}>
                        <View style={styles.abilityHeader}>
                            <Text style={styles.abilityName}>{safeRenderValue(ability.name || ability)}</Text>
                            <Text style={[styles.abilityRank, { color: getRankColor(ability.rank) }]}>
                                {safeRenderValue(ability.rank)}
                            </Text>
                        </View>
                        <Text style={styles.abilityEssence}>From: {safeRenderValue(ability.essence)}</Text>
                        <Text style={styles.abilityType}>{safeRenderValue(ability.type)}</Text>
                        {ability.currentCooldown > 0 && (
                            <Text style={styles.abilityCooldown}>
                                Cooldown: {ability.currentCooldown}
                            </Text>
                        )}
                    </View>
                ))}
                {(!character.abilities || character.abilities.length === 0) && (
                    <Text style={styles.emptyText}>No abilities unlocked</Text>
                )}
            </View>

            {/* Loot */}
            {
                moduleState.lootAwarded && moduleState.lootAwarded.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Recent Loot</Text>
                        {moduleState.lootAwarded.map((item, idx) => (
                            <View key={idx} style={styles.lootItem}>
                                <Text style={styles.lootName}>{item.name}</Text>
                                {item.quantity > 1 && (
                                    <Text style={styles.lootQuantity}>×{item.quantity}</Text>
                                )}
                            </View>
                        ))}
                    </View>
                )
            }
        </ScrollView >
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.secondary,
    },
    header: {
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
        alignItems: 'center',
    },
    characterName: {
        fontSize: typography.fontSize.xl,
        fontWeight: 'bold',
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    rankBadge: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        marginBottom: spacing.xs,
    },
    rankText: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    characterSubtitle: {
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
    },
    section: {
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
    },
    sectionTitle: {
        fontSize: typography.fontSize.md,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: spacing.sm,
    },
    resourceContainer: {
        gap: spacing.xs,
    },
    resourceBar: {
        height: 20,
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.md,
        overflow: 'hidden',
    },
    resourceFill: {
        height: '100%',
        borderRadius: borderRadius.md,
    },
    resourceText: {
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
        textAlign: 'center',
    },
    essenceItem: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.md,
        marginBottom: spacing.xs,
    },
    essenceName: {
        fontSize: typography.fontSize.sm,
        color: colors.text.primary,
        fontWeight: '500',
    },
    confluenceItem: {
        backgroundColor: colors.gold.main + '20',
        borderWidth: 1,
        borderColor: colors.gold.main,
    },
    confluenceLabel: {
        fontSize: typography.fontSize.xs,
        color: colors.text.muted,
        marginBottom: spacing.xs,
    },
    confluenceName: {
        fontSize: typography.fontSize.sm,
        color: colors.gold.main,
        fontWeight: '600',
    },
    abilityItem: {
        padding: spacing.sm,
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.md,
        marginBottom: spacing.sm,
    },
    abilityHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    abilityName: {
        fontSize: typography.fontSize.md,
        color: colors.text.primary,
        fontWeight: '600',
        flex: 1,
    },
    abilityRank: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    abilityEssence: {
        fontSize: typography.fontSize.xs,
        color: colors.text.muted,
        marginBottom: spacing.xs,
    },
    abilityType: {
        fontSize: typography.fontSize.xs,
        color: colors.text.secondary,
        textTransform: 'capitalize',
    },
    abilityCooldown: {
        fontSize: typography.fontSize.xs,
        color: colors.status.warning,
        marginTop: spacing.xs,
    },
    lootItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.sm,
        marginBottom: spacing.xs,
    },
    lootName: {
        fontSize: typography.fontSize.sm,
        color: colors.text.primary,
    },
    lootQuantity: {
        fontSize: typography.fontSize.xs,
        color: colors.text.muted,
    },
    emptyText: {
        fontSize: typography.fontSize.sm,
        color: colors.text.muted,
        fontStyle: 'italic',
        textAlign: 'center',
        paddingVertical: spacing.md,
    },
});
