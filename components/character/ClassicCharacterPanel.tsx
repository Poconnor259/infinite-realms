import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { spacing, borderRadius, typography } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';
import type { ClassicModuleState, InventoryItem } from '../../lib/types';

interface ClassicCharacterPanelProps {
    moduleState: ClassicModuleState;
}

export function ClassicCharacterPanel({ moduleState }: ClassicCharacterPanelProps) {
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

    const getModifier = (stat: number): string => {
        const mod = Math.floor((stat - 10) / 2);
        return mod >= 0 ? `+${mod}` : `${mod}`;
    };

    const groupedInventory = (character.inventory || []).reduce((acc, item) => {
        if (!acc[item.type]) acc[item.type] = [];
        acc[item.type].push(item);
        return acc;
    }, {} as Record<string, InventoryItem[]>);

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Character Header */}
            <View style={styles.header}>
                <Text style={styles.characterName}>{character.name}</Text>
                <Text style={styles.characterSubtitle}>
                    Level {character.level} {character.race} {character.class}
                </Text>
            </View>

            {/* HP Bar */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Hit Points</Text>
                <View style={styles.hpContainer}>
                    <View style={styles.hpBar}>
                        <View
                            style={[
                                styles.hpFill,
                                {
                                    width: `${(character.hp.current / character.hp.max) * 100}%`,
                                    backgroundColor: character.hp.current / character.hp.max > 0.5
                                        ? colors.status.success
                                        : character.hp.current / character.hp.max > 0.25
                                            ? colors.status.warning
                                            : colors.status.error
                                }
                            ]}
                        />
                    </View>
                    <Text style={styles.hpText}>
                        {character.hp.current} / {character.hp.max}
                    </Text>
                </View>
            </View>

            {/* Ability Scores */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Ability Scores</Text>
                <View style={styles.statsGrid}>
                    {Object.entries(character.stats).map(([stat, value]) => (
                        <View key={stat} style={styles.statBox}>
                            <Text style={styles.statLabel}>{stat}</Text>
                            <Text style={styles.statValue}>{value}</Text>
                            <Text style={styles.statModifier}>{getModifier(value)}</Text>
                        </View>
                    ))}
                </View>
            </View>

            {/* Combat Stats */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Combat</Text>
                <View style={styles.combatStats}>
                    <View style={styles.combatStat}>
                        <Text style={styles.combatLabel}>AC</Text>
                        <Text style={styles.combatValue}>{character.ac}</Text>
                    </View>
                    <View style={styles.combatStat}>
                        <Text style={styles.combatLabel}>Prof</Text>
                        <Text style={styles.combatValue}>+{character.proficiencyBonus}</Text>
                    </View>
                    <View style={styles.combatStat}>
                        <Text style={styles.combatLabel}>Gold</Text>
                        <Text style={styles.combatValue}>{character.gold}</Text>
                    </View>
                </View>
            </View>

            {/* Inventory */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Inventory</Text>
                {Object.entries(groupedInventory).map(([type, items]) => (
                    <View key={type} style={styles.inventoryGroup}>
                        <Text style={styles.inventoryGroupTitle}>
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                        </Text>
                        {items.map((item) => (
                            <View key={item.id} style={styles.inventoryItem}>
                                <Text style={styles.itemName}>
                                    {item.equipped && '⚡ '}
                                    {item.name}
                                </Text>
                                {item.quantity > 1 && (
                                    <Text style={styles.itemQuantity}>×{item.quantity}</Text>
                                )}
                            </View>
                        ))}
                    </View>
                ))}
                {(!character.inventory || character.inventory.length === 0) && (
                    <Text style={styles.emptyText}>No items</Text>
                )}
            </View>

            {/* Abilities */}
            {character.abilities && character.abilities.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Abilities</Text>
                    {character.abilities.map((ability, idx) => (
                        <View key={idx} style={styles.abilityItem}>
                            <Text style={styles.abilityName}>{ability.name}</Text>
                            <Text style={styles.abilityType}>{ability.type}</Text>
                        </View>
                    ))}
                </View>
            )}
        </ScrollView>
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
    },
    characterName: {
        fontSize: typography.fontSize.xl,
        fontWeight: 'bold',
        color: colors.text.primary,
        marginBottom: spacing.xs,
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
    hpContainer: {
        gap: spacing.xs,
    },
    hpBar: {
        height: 24,
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.md,
        overflow: 'hidden',
    },
    hpFill: {
        height: '100%',
        borderRadius: borderRadius.md,
    },
    hpText: {
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
        textAlign: 'center',
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    statBox: {
        width: '30%',
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.md,
        padding: spacing.sm,
        alignItems: 'center',
    },
    statLabel: {
        fontSize: typography.fontSize.xs,
        color: colors.text.muted,
        fontWeight: '600',
    },
    statValue: {
        fontSize: typography.fontSize.xl,
        color: colors.text.primary,
        fontWeight: 'bold',
    },
    statModifier: {
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
    },
    combatStats: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    combatStat: {
        flex: 1,
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.md,
        padding: spacing.sm,
        alignItems: 'center',
    },
    combatLabel: {
        fontSize: typography.fontSize.xs,
        color: colors.text.muted,
        marginBottom: spacing.xs,
    },
    combatValue: {
        fontSize: typography.fontSize.lg,
        color: colors.text.primary,
        fontWeight: 'bold',
    },
    inventoryGroup: {
        marginBottom: spacing.md,
    },
    inventoryGroupTitle: {
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
        fontWeight: '600',
        marginBottom: spacing.xs,
    },
    inventoryItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.sm,
        marginBottom: spacing.xs,
    },
    itemName: {
        fontSize: typography.fontSize.sm,
        color: colors.text.primary,
    },
    itemQuantity: {
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
    abilityItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.sm,
        marginBottom: spacing.xs,
    },
    abilityName: {
        fontSize: typography.fontSize.sm,
        color: colors.text.primary,
        flex: 1,
    },
    abilityType: {
        fontSize: typography.fontSize.xs,
        color: colors.text.muted,
        textTransform: 'capitalize',
    },
});
