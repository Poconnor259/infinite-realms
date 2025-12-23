import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { spacing, borderRadius, typography } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';
import type { NormalizedCharacter, NormalizedResource, NormalizedStat, NormalizedAbility, NormalizedItem } from '../../lib/normalizeCharacter';

interface UnifiedCharacterPanelProps {
    character: NormalizedCharacter;
    worldType?: string;
}

export function UnifiedCharacterPanel({ character, worldType }: UnifiedCharacterPanelProps) {
    const { colors } = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    // Early return if no character
    if (!character || !character.name) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>Character stats will appear here</Text>
                <Text style={styles.emptySubtitle}>Send your first message to begin</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Character Header */}
            <View style={styles.header}>
                <Text style={styles.characterName}>{character.name}</Text>
                <View style={styles.headerMeta}>
                    {character.rank && (
                        <View style={[styles.rankBadge, { backgroundColor: getRankColor(character.rank) + '20' }]}>
                            <Text style={[styles.rankText, { color: getRankColor(character.rank) }]}>
                                {character.rank}
                            </Text>
                        </View>
                    )}
                    {character.level > 0 && (
                        <Text style={styles.levelText}>Level {character.level}</Text>
                    )}
                    {character.class && (
                        <Text style={styles.classText}>{character.class}</Text>
                    )}
                </View>
            </View>

            {/* Resources Section */}
            {character.resources.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Resources</Text>
                    {character.resources.map((resource, index) => (
                        <ResourceBar key={`${resource.name}-${index}`} resource={resource} colors={colors} />
                    ))}
                </View>
            )}

            {/* Stats Section */}
            {character.stats.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Stats</Text>
                    <View style={styles.statsGrid}>
                        {character.stats.map((stat, index) => (
                            <StatBox key={`${stat.id}-${index}`} stat={stat} colors={colors} />
                        ))}
                    </View>
                </View>
            )}

            {/* Inventory Section */}
            {character.inventory.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Inventory</Text>
                    {character.inventory.map((item, index) => (
                        <InventoryItem key={`${item.name}-${index}`} item={item} colors={colors} />
                    ))}
                </View>
            )}

            {/* Abilities Section */}
            {character.abilities.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Abilities</Text>
                    {character.abilities.map((ability, index) => (
                        <AbilityItem key={`${ability.name}-${index}`} ability={ability} colors={colors} />
                    ))}
                </View>
            )}

            {/* World-Specific Extras */}
            {Object.keys(character.extras).length > 0 && (
                <ExtrasSection extras={character.extras} worldType={worldType} colors={colors} />
            )}
        </ScrollView>
    );
}

// ==================== SUB-COMPONENTS ====================

function ResourceBar({ resource, colors }: { resource: NormalizedResource; colors: any }) {
    const percentage = resource.max > 0 ? (resource.current / resource.max) * 100 : 0;
    const barColor = resource.color || colors.primary[400];

    return (
        <View style={subStyles.resourceContainer}>
            <View style={subStyles.resourceHeader}>
                <Text style={[subStyles.resourceName, { color: colors.text.secondary }]}>
                    {resource.icon && `${resource.icon} `}{resource.name}
                </Text>
                <Text style={[subStyles.resourceValue, { color: colors.text.muted }]}>
                    {resource.current} / {resource.max}
                </Text>
            </View>
            <View style={[subStyles.resourceBarBg, { backgroundColor: colors.background.tertiary }]}>
                <View
                    style={[
                        subStyles.resourceBarFill,
                        { width: `${percentage}%`, backgroundColor: barColor }
                    ]}
                />
            </View>
        </View>
    );
}

function StatBox({ stat, colors }: { stat: NormalizedStat; colors: any }) {
    return (
        <View style={[subStyles.statBox, { backgroundColor: colors.background.tertiary }]}>
            <Text style={[subStyles.statLabel, { color: colors.text.muted }]}>
                {stat.abbreviation || stat.name.slice(0, 3).toUpperCase()}
            </Text>
            <Text style={[subStyles.statValue, { color: colors.text.primary }]}>
                {stat.value}
            </Text>
            {stat.icon && (
                <Text style={subStyles.statIcon}>{stat.icon}</Text>
            )}
        </View>
    );
}

function InventoryItem({ item, colors }: { item: NormalizedItem; colors: any }) {
    return (
        <View style={[subStyles.inventoryItem, { backgroundColor: colors.background.tertiary }]}>
            <View style={subStyles.inventoryLeft}>
                {item.equipped && <Text style={subStyles.equippedIcon}>⚡</Text>}
                <Text style={[subStyles.itemName, { color: colors.text.primary }]}>
                    {item.name}
                </Text>
            </View>
            {(item.quantity && item.quantity > 1) && (
                <Text style={[subStyles.itemQuantity, { color: colors.text.muted }]}>
                    ×{item.quantity}
                </Text>
            )}
        </View>
    );
}

function AbilityItem({ ability, colors }: { ability: NormalizedAbility; colors: any }) {
    const isOnCooldown = (ability.currentCooldown || 0) > 0;

    return (
        <View style={[subStyles.abilityItem, { backgroundColor: colors.background.tertiary }]}>
            <View style={subStyles.abilityHeader}>
                <Text style={[subStyles.abilityName, { color: colors.text.primary }]}>
                    {ability.name}
                </Text>
                {ability.rank && (
                    <Text style={[subStyles.abilityRank, { color: getRankColor(ability.rank) }]}>
                        {ability.rank}
                    </Text>
                )}
            </View>
            {ability.type && (
                <Text style={[subStyles.abilityType, { color: colors.text.muted }]}>
                    {ability.type}
                </Text>
            )}
            {isOnCooldown && (
                <Text style={[subStyles.abilityCooldown, { color: colors.status.warning }]}>
                    Cooldown: {ability.currentCooldown}
                </Text>
            )}
        </View>
    );
}

function ExtrasSection({ extras, worldType, colors }: { extras: Record<string, any>; worldType?: string; colors: any }) {
    // Outworlder Essences
    if (extras.essences && Array.isArray(extras.essences) && extras.essences.length > 0) {
        return (
            <View style={[subStyles.section, { borderBottomColor: colors.border.default }]}>
                <Text style={[subStyles.sectionTitle, { color: colors.text.primary }]}>
                    Essences ({extras.essences.length}/4)
                </Text>
                {extras.essences.map((essence: string, idx: number) => (
                    <View key={idx} style={[subStyles.essenceItem, { backgroundColor: colors.background.tertiary }]}>
                        <Text style={[subStyles.essenceName, { color: colors.text.primary }]}>{essence}</Text>
                    </View>
                ))}
                {extras.confluence && (
                    <View style={[subStyles.confluenceItem, { backgroundColor: colors.gold.main + '20', borderColor: colors.gold.main }]}>
                        <Text style={[subStyles.confluenceLabel, { color: colors.text.muted }]}>Confluence</Text>
                        <Text style={[subStyles.confluenceName, { color: colors.gold.main }]}>{extras.confluence}</Text>
                    </View>
                )}
            </View>
        );
    }

    return null;
}

// ==================== HELPERS ====================

function getRankColor(rank: string): string {
    const colors: Record<string, string> = {
        'Iron': '#6B7280',
        'Bronze': '#CD7F32',
        'Silver': '#C0C0C0',
        'Gold': '#FFD700',
        'Diamond': '#B9F2FF',
        'Normal': '#9CA3AF',
        'Common': '#9CA3AF',
        'Uncommon': '#22C55E',
        'Rare': '#3B82F6',
        'Epic': '#8B5CF6',
        'Legendary': '#F59E0B',
    };
    return colors[rank] || '#9CA3AF';
}

// ==================== STYLES ====================

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.secondary,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    emptyTitle: {
        color: colors.text.secondary,
        fontSize: typography.fontSize.md,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    emptySubtitle: {
        color: colors.text.muted,
        fontSize: typography.fontSize.sm,
        textAlign: 'center',
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
    headerMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    rankBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
    },
    rankText: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    levelText: {
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
    },
    classText: {
        fontSize: typography.fontSize.sm,
        color: colors.text.muted,
        fontStyle: 'italic',
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
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
});

const subStyles = StyleSheet.create({
    // Resource Bar
    resourceContainer: {
        marginBottom: spacing.md,
    },
    resourceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.xs,
    },
    resourceName: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    resourceValue: {
        fontSize: typography.fontSize.sm,
    },
    resourceBarBg: {
        height: 20,
        borderRadius: borderRadius.md,
        overflow: 'hidden',
    },
    resourceBarFill: {
        height: '100%',
        borderRadius: borderRadius.md,
    },

    // Stat Box
    statBox: {
        width: '30%',
        minWidth: 70,
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        alignItems: 'center',
    },
    statLabel: {
        fontSize: typography.fontSize.xs,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    statValue: {
        fontSize: typography.fontSize.xl,
        fontWeight: 'bold',
        marginTop: spacing.xs,
    },
    statIcon: {
        fontSize: typography.fontSize.sm,
        marginTop: spacing.xs,
    },

    // Inventory Item
    inventoryItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.sm,
        borderRadius: borderRadius.sm,
        marginBottom: spacing.xs,
    },
    inventoryLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    equippedIcon: {
        marginRight: spacing.xs,
    },
    itemName: {
        fontSize: typography.fontSize.sm,
    },
    itemQuantity: {
        fontSize: typography.fontSize.xs,
    },

    // Ability Item
    abilityItem: {
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        marginBottom: spacing.sm,
    },
    abilityHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    abilityName: {
        fontSize: typography.fontSize.md,
        fontWeight: '600',
        flex: 1,
    },
    abilityRank: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    abilityType: {
        fontSize: typography.fontSize.xs,
        marginTop: spacing.xs,
        textTransform: 'capitalize',
    },
    abilityCooldown: {
        fontSize: typography.fontSize.xs,
        marginTop: spacing.xs,
    },

    // Extras Section
    section: {
        padding: spacing.md,
        borderBottomWidth: 1,
    },
    sectionTitle: {
        fontSize: typography.fontSize.md,
        fontWeight: '600',
        marginBottom: spacing.sm,
    },
    essenceItem: {
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        marginBottom: spacing.xs,
    },
    essenceName: {
        fontSize: typography.fontSize.sm,
        fontWeight: '500',
    },
    confluenceItem: {
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        marginTop: spacing.sm,
    },
    confluenceLabel: {
        fontSize: typography.fontSize.xs,
        marginBottom: spacing.xs,
    },
    confluenceName: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
});
