import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { spacing, borderRadius, typography } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';
import type { NormalizedCharacter, NormalizedResource, NormalizedStat, NormalizedAbility, NormalizedItem } from '../../lib/normalizeCharacter';

interface UnifiedCharacterPanelProps {
    character: NormalizedCharacter;
    worldType?: string;
    onAcceptQuest?: (questId: string) => void;
    onDeclineQuest?: (questId: string) => void;
}

export function UnifiedCharacterPanel({ character, worldType, onAcceptQuest, onDeclineQuest }: UnifiedCharacterPanelProps) {
    const { colors } = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    // Debug logging
    console.log('[UnifiedCharacterPanel] Rendering character:', character);

    // Early return if no character
    if (!character || !character.name) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>Character stats will appear here</Text>
                <Text style={styles.emptySubtitle}>Send your first message to begin</Text>
            </View>
        );
    }

    // Defensive coercion to prevent React error #418
    const safeName = String(character.name || 'Unknown');
    const safeRank = character.rank ? String(character.rank) : null;
    const safeLevel = typeof character.level === 'number' ? character.level : 0;
    const safeClass = character.class ? String(character.class) : null;

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Character Header */}
            <View style={styles.header}>
                <Text style={styles.characterName}>{safeName}</Text>
                <View style={styles.headerMeta}>
                    {safeRank && (
                        <View style={[styles.rankBadge, { backgroundColor: getRankColor(safeRank) + '20' }]}>
                            <Text style={[styles.rankText, { color: getRankColor(safeRank) }]}>
                                {safeRank}
                            </Text>
                        </View>
                    )}
                    {safeLevel > 0 && (
                        <Text style={styles.levelText}>Level {safeLevel}</Text>
                    )}
                    {safeClass && (
                        <Text style={styles.classText}>{safeClass}</Text>
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

            {/* Quests Section */}
            {(character.quests.length > 0 || character.suggestedQuests.length > 0) && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Adventures</Text>

                    {/* Suggested Quests (New Opportunities) */}
                    {character.suggestedQuests.map((quest, index) => (
                        <View key={`suggested-${quest.id || index}`} style={[styles.questCard, { borderColor: colors.primary[400], borderLeftWidth: 4 }]}>
                            <View style={styles.questHeader}>
                                <Text style={styles.questTitle}>{quest.title}</Text>
                                <View style={styles.newBadge}>
                                    <Text style={styles.newBadgeText}>NEW</Text>
                                </View>
                            </View>
                            <Text style={styles.questDescription} numberOfLines={2}>{quest.description}</Text>
                            <View style={styles.questActions}>
                                <TouchableOpacity
                                    style={[styles.questActionButton, { backgroundColor: colors.background.tertiary }]}
                                    onPress={() => onDeclineQuest?.(quest.id)}
                                >
                                    <Text style={[styles.questActionText, { color: colors.text.muted }]}>Decline</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.questActionButton, { backgroundColor: colors.primary[400] }]}
                                    onPress={() => onAcceptQuest?.(quest.id)}
                                >
                                    <Text style={[styles.questActionText, { color: '#000' }]}>Accept</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}

                    {/* Active Quests */}
                    {character.quests.map((quest, index) => (
                        <View key={`active-${quest.id || index}`} style={styles.questCard}>
                            <Text style={styles.questTitle}>{quest.title}</Text>
                            <Text style={styles.questDescription}>{quest.description}</Text>
                            {quest.reward && (
                                <Text style={styles.questRewardText}>
                                    🎁 Reward: {quest.reward.amount} {quest.reward.type}
                                </Text>
                            )}
                        </View>
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

    // Defensive coercion
    const safeName = String(resource.name || 'Resource');
    const safeCurrent = typeof resource.current === 'number' ? resource.current : 0;
    const safeMax = typeof resource.max === 'number' ? resource.max : 100;
    const safeIcon = resource.icon ? String(resource.icon) : '';

    return (
        <View style={subStyles.resourceContainer}>
            <View style={subStyles.resourceHeader}>
                <Text style={[subStyles.resourceName, { color: colors.text.secondary }]}>
                    {safeIcon && `${safeIcon} `}{safeName}
                </Text>
                <Text style={[subStyles.resourceValue, { color: colors.text.muted }]}>
                    {safeCurrent} / {safeMax}
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
    // Defensive coercion
    const safeName = String(stat.name || 'Stat');
    const safeAbbr = stat.abbreviation ? String(stat.abbreviation) : safeName.slice(0, 3).toUpperCase();
    const safeValue = typeof stat.value === 'number' ? stat.value : 0;
    const safeIcon = stat.icon ? String(stat.icon) : null;

    return (
        <View style={[subStyles.statBox, { backgroundColor: colors.background.tertiary }]}>
            <Text style={[subStyles.statLabel, { color: colors.text.muted }]}>
                {safeAbbr}
            </Text>
            <Text style={[subStyles.statValue, { color: colors.text.primary }]}>
                {safeValue}
            </Text>
            {safeIcon && (
                <Text style={subStyles.statIcon}>{safeIcon}</Text>
            )}
        </View>
    );
}

function InventoryItem({ item, colors }: { item: NormalizedItem; colors: any }) {
    // Defensive coercion
    const safeName = String(item.name || 'Item');
    const safeQuantity = typeof item.quantity === 'number' ? item.quantity : 1;

    return (
        <View style={[subStyles.inventoryItem, { backgroundColor: colors.background.tertiary }]}>
            <View style={subStyles.inventoryLeft}>
                {item.equipped && <Text style={subStyles.equippedIcon}>⚡</Text>}
                <Text style={[subStyles.itemName, { color: colors.text.primary }]}>
                    {safeName}
                </Text>
            </View>
            {safeQuantity > 1 && (
                <Text style={[subStyles.itemQuantity, { color: colors.text.muted }]}>
                    ×{safeQuantity}
                </Text>
            )}
        </View>
    );
}

function AbilityItem({ ability, colors }: { ability: NormalizedAbility; colors: any }) {
    // Defensive coercion
    const safeName = String(ability.name || 'Ability');
    const safeRank = ability.rank ? String(ability.rank) : null;
    const safeType = ability.type ? String(ability.type) : null;
    const safeCooldown = typeof ability.currentCooldown === 'number' ? ability.currentCooldown : 0;
    const isOnCooldown = safeCooldown > 0;

    return (
        <View style={[subStyles.abilityItem, { backgroundColor: colors.background.tertiary }]}>
            <View style={subStyles.abilityHeader}>
                <Text style={[subStyles.abilityName, { color: colors.text.primary }]}>
                    {safeName}
                </Text>
                {safeRank && (
                    <Text style={[subStyles.abilityRank, { color: getRankColor(safeRank) }]}>
                        {safeRank}
                    </Text>
                )}
            </View>
            {safeType && (
                <Text style={[subStyles.abilityType, { color: colors.text.muted }]}>
                    {safeType}
                </Text>
            )}
            {isOnCooldown && (
                <Text style={[subStyles.abilityCooldown, { color: colors.status.warning }]}>
                    Cooldown: {safeCooldown}
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
    // New Quest Styles
    questCard: {
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    questHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    questTitle: {
        fontSize: typography.fontSize.md,
        fontWeight: 'bold',
        color: colors.text.primary,
        flex: 1,
    },
    newBadge: {
        backgroundColor: colors.primary[400],
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
        borderRadius: borderRadius.xs,
    },
    newBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#000',
    },
    questDescription: {
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
        lineHeight: 18,
    },
    questRewardText: {
        fontSize: 12,
        color: colors.gold.main,
        fontWeight: '600',
        marginTop: spacing.xs,
    },
    questActions: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.sm,
    },
    questActionButton: {
        flex: 1,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    questActionText: {
        fontSize: 12,
        fontWeight: 'bold',
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
