import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { spacing, borderRadius, typography } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';
import type { TacticalModuleState } from '../../lib/types';

interface TacticalCharacterPanelProps {
    moduleState: TacticalModuleState;
}

export function TacticalCharacterPanel({ moduleState }: TacticalCharacterPanelProps) {
    const { colors } = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { character } = moduleState;

    // Early return if character data is not available
    if (!character) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
                <Text style={{ color: colors.text.secondary, textAlign: 'center', marginBottom: spacing.sm }}>
                    Awaiting tactical data...
                </Text>
                <Text style={{ color: colors.text.muted, textAlign: 'center', fontSize: typography.fontSize.sm }}>
                    Initialize comms to sync profile.
                </Text>
            </View>
        );
    }

    const getRankColor = (rank: string) => {
        switch (rank) {
            case 'S': return '#FF6B6B';
            case 'A': return '#FFA500';
            case 'B': return '#FFD700';
            case 'C': return '#90EE90';
            case 'D': return '#87CEEB';
            case 'E': return '#D3D3D3';
            default: return colors.text.secondary;
        }
    };

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Character Header */}
            <View style={styles.header}>
                <Text style={styles.characterName}>{character.name}</Text>
                <Text style={styles.characterJob}>{character.job}</Text>
                {character.title && (
                    <Text style={styles.characterTitle}>"{character.title}"</Text>
                )}
                <Text style={styles.characterLevel}>Level {character.level}</Text>
            </View>

            {/* Vitality (HP) Bar */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Vitality (HP)</Text>
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

            {/* Tactical Energy (Mana) Bar */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Tactical Energy</Text>
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

            {/* Fatigue Bar */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Fatigue Status</Text>
                <View style={styles.resourceContainer}>
                    <View style={styles.resourceBar}>
                        <View
                            style={[
                                styles.resourceFill,
                                {
                                    width: `${(character.fatigue.current / character.fatigue.max) * 100}%`,
                                    backgroundColor: colors.status.warning
                                }
                            ]}
                        />
                    </View>
                    <Text style={styles.resourceText}>
                        {character.fatigue.current} / {character.fatigue.max}
                    </Text>
                </View>
            </View>

            {/* Stats */}
            <View style={styles.section}>
                <View style={styles.statsHeader}>
                    <Text style={styles.sectionTitle}>Aptitude Levels</Text>
                    {character.statPoints > 0 && (
                        <Text style={styles.statPoints}>
                            {character.statPoints} points available
                        </Text>
                    )}
                </View>
                <View style={styles.statsGrid}>
                    {Object.entries(character.stats).map(([stat, value]) => (
                        <View key={stat} style={styles.statBox}>
                            <Text style={styles.statLabel}>
                                {stat.charAt(0).toUpperCase() + stat.slice(1)}
                            </Text>
                            <Text style={styles.statValue}>{value}</Text>
                        </View>
                    ))}
                </View>
            </View>

            {/* Skills */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Tactical Skills</Text>
                {character.skills.map((skill, idx) => (
                    <View key={idx} style={styles.skillItem}>
                        <View style={styles.skillHeader}>
                            <Text style={styles.skillName}>{skill.name}</Text>
                            <Text style={[styles.skillRank, { color: getRankColor(skill.rank) }]}>
                                Rank {skill.rank}
                            </Text>
                        </View>
                        <View style={styles.skillMeta}>
                            <Text style={styles.skillType}>{skill.type}</Text>
                            {skill.manaCost && (
                                <Text style={styles.skillCost}>Energy: {skill.manaCost}</Text>
                            )}
                        </View>
                    </View>
                ))}
                {character.skills.length === 0 && (
                    <Text style={styles.emptyText}>No specialized skills registered</Text>
                )}
            </View>

            {/* Nanite Count */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Nanite Count</Text>
                <View style={styles.resourceContainer}>
                    <View style={styles.resourceBar}>
                        <View
                            style={[
                                styles.resourceFill,
                                {
                                    width: `${((character.nanites?.current || 0) / (character.nanites?.max || 1000)) * 100}%`,
                                    backgroundColor: '#8B5CF6' // Purple/violet for nanites
                                }
                            ]}
                        />
                    </View>
                    <Text style={styles.resourceText}>
                        {character.nanites?.current || 0} / {character.nanites?.max || 1000}
                    </Text>
                </View>
            </View>

            {/* Daily Objectives */}
            {moduleState.dailyQuest && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Daily Objectives</Text>
                    <View style={styles.questItem}>
                        <Text style={styles.questTask}>
                            Tactical Run: {moduleState.dailyQuest.runKm.current}/{moduleState.dailyQuest.runKm.target} km
                        </Text>
                    </View>
                    <View style={styles.questItem}>
                        <Text style={styles.questTask}>
                            Strength Drill: {moduleState.dailyQuest.pushups.current}/{moduleState.dailyQuest.pushups.target}
                        </Text>
                    </View>
                    <View style={styles.questItem}>
                        <Text style={styles.questTask}>
                            Core Stability: {moduleState.dailyQuest.situps.current}/{moduleState.dailyQuest.situps.target}
                        </Text>
                    </View>
                    <View style={styles.questItem}>
                        <Text style={styles.questTask}>
                            Power Training: {moduleState.dailyQuest.squats.current}/{moduleState.dailyQuest.squats.target}
                        </Text>
                    </View>
                    {moduleState.dailyQuest.completed && (
                        <Text style={styles.questCompleted}>✓ Mission Complete</Text>
                    )}
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
        alignItems: 'center',
    },
    characterName: {
        fontSize: typography.fontSize.xl,
        fontWeight: 'bold',
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    characterJob: {
        fontSize: typography.fontSize.md,
        color: colors.text.secondary,
        marginBottom: spacing.xs,
    },
    characterTitle: {
        fontSize: typography.fontSize.sm,
        color: colors.text.muted,
        fontStyle: 'italic',
        marginBottom: spacing.xs,
    },
    characterLevel: {
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
    statsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    statPoints: {
        fontSize: typography.fontSize.sm,
        color: colors.status.success,
        fontWeight: '600',
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    statBox: {
        width: '48%',
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.md,
        padding: spacing.sm,
        alignItems: 'center',
    },
    statLabel: {
        fontSize: typography.fontSize.xs,
        color: colors.text.muted,
        marginBottom: spacing.xs,
    },
    statValue: {
        fontSize: typography.fontSize.xl,
        color: colors.text.primary,
        fontWeight: 'bold',
    },
    skillItem: {
        padding: spacing.sm,
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.md,
        marginBottom: spacing.sm,
    },
    skillHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    skillName: {
        fontSize: typography.fontSize.md,
        color: colors.text.primary,
        fontWeight: '600',
        flex: 1,
    },
    skillRank: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    skillMeta: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    skillType: {
        fontSize: typography.fontSize.xs,
        color: colors.text.secondary,
        textTransform: 'capitalize',
    },
    skillCost: {
        fontSize: typography.fontSize.xs,
        color: '#3B82F6',
    },
    unitItem: {
        padding: spacing.sm,
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.md,
        marginBottom: spacing.xs,
        borderLeftWidth: 3,
        borderLeftColor: '#8B5CF6',
    },
    unitHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    unitName: {
        fontSize: typography.fontSize.sm,
        color: colors.text.primary,
        fontWeight: '600',
    },
    unitRank: {
        fontSize: typography.fontSize.xs,
        color: colors.text.muted,
    },
    unitType: {
        fontSize: typography.fontSize.xs,
        color: colors.text.secondary,
    },
    questItem: {
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.sm,
        marginBottom: spacing.xs,
    },
    questTask: {
        fontSize: typography.fontSize.sm,
        color: colors.text.primary,
    },
    questCompleted: {
        fontSize: typography.fontSize.sm,
        color: colors.status.success,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: spacing.sm,
    },
    emptyText: {
        fontSize: typography.fontSize.sm,
        color: colors.text.muted,
        fontStyle: 'italic',
        textAlign: 'center',
        paddingVertical: spacing.md,
    },
});
