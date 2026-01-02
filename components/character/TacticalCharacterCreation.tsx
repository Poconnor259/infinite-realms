import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { spacing, borderRadius, typography } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';
import { AnimatedPressable } from '../ui/Animated';
import type { TacticalCharacter } from '../../lib/types';

interface TacticalCharacterCreationProps {
    characterName: string;
    onComplete: (character: TacticalCharacter) => void;
    onBack: () => void;
}

export function TacticalCharacterCreation({ characterName, onComplete, onBack }: TacticalCharacterCreationProps) {
    const { colors } = useThemeColors();

    const [stats, setStats] = React.useState({
        strength: 10,
        agility: 10,
        vitality: 10,
        intelligence: 10,
        perception: 10,
    });
    const [remainingPoints, setRemainingPoints] = React.useState(10);

    const handleAdjustStat = (stat: keyof typeof stats, delta: number) => {
        if (delta > 0 && remainingPoints <= 0) return;
        if (delta < 0 && stats[stat] <= 10) return;

        setStats(prev => ({
            ...prev,
            [stat]: prev[stat] + delta
        }));
        setRemainingPoints(prev => prev - delta);
    };

    const handleCreate = () => {
        const character: TacticalCharacter = {
            id: 'temp-id', // Will be replaced by backend
            name: characterName,
            level: 1,
            hp: { current: 100 + (stats.vitality - 10) * 10, max: 100 + (stats.vitality - 10) * 10 },
            job: 'None',
            title: undefined,
            stats: { ...stats },
            statPoints: 0,
            nanites: { current: 10, max: 100 },
            stamina: { current: 100, max: 100 },
            skills: [],
            tacticalSquad: [],
        };

        onComplete(character);
    };

    const statList = [
        { key: 'strength' as const, name: 'Strength' },
        { key: 'agility' as const, name: 'Agility' },
        { key: 'vitality' as const, name: 'Vitality' },
        { key: 'intelligence' as const, name: 'Intelligence' },
        { key: 'perception' as const, name: 'Perception' },
    ];

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.background.primary }]}>
            <View style={styles.content}>
                <Text style={[styles.title, { color: colors.text.primary }]}>System Initialization</Text>
                <Text style={[styles.subtitle, { color: colors.text.secondary }]}>{characterName}</Text>

                <View style={[styles.systemMessage, { backgroundColor: colors.background.secondary }]}>
                    <Text style={[styles.systemTitle, { color: colors.primary[500] }]}>
                        [PRAXIS COMMAND]
                    </Text>
                    <Text style={[styles.systemText, { color: colors.text.secondary }]}>
                        Welcome, Operative.
                    </Text>
                    <Text style={[styles.systemText, { color: colors.text.secondary }]}>
                        Initialize your tactical profile.
                    </Text>
                    <Text style={[styles.systemText, { color: colors.text.secondary }]}>
                        Allocate your aptitude points below.
                    </Text>
                </View>

                {/* Starting Stats */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.label, { color: colors.text.primary }]}>Starting Stats</Text>
                        <Text style={[styles.pointsIndicator, { color: remainingPoints > 0 ? colors.primary[500] : colors.text.muted }]}>
                            Points: {remainingPoints}
                        </Text>
                    </View>

                    <View style={[styles.statsGrid, { backgroundColor: colors.background.secondary }]}>
                        {statList.map((stat) => (
                            <View key={stat.key} style={styles.statItem}>
                                <Text style={[styles.statName, { color: colors.text.secondary }]}>
                                    {stat.name}
                                </Text>
                                <View style={styles.statControls}>
                                    <AnimatedPressable
                                        style={[
                                            styles.controlButton,
                                            stats[stat.key] <= 10 && styles.controlButtonDisabled,
                                            { backgroundColor: colors.background.tertiary }
                                        ]}
                                        onPress={() => handleAdjustStat(stat.key, -1)}
                                        disabled={stats[stat.key] <= 10}
                                    >
                                        <Text style={[styles.controlText, { color: colors.text.primary }]}>-</Text>
                                    </AnimatedPressable>

                                    <Text style={[styles.statValue, { color: colors.text.primary }]}>
                                        {stats[stat.key]}
                                    </Text>

                                    <AnimatedPressable
                                        style={[
                                            styles.controlButton,
                                            remainingPoints <= 0 && styles.controlButtonDisabled,
                                            { backgroundColor: colors.background.tertiary }
                                        ]}
                                        onPress={() => handleAdjustStat(stat.key, 1)}
                                        disabled={remainingPoints <= 0}
                                    >
                                        <Text style={[styles.controlText, { color: colors.text.primary }]}>+</Text>
                                    </AnimatedPressable>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>

                <Text style={[styles.note, { color: colors.text.muted }]}>
                    Your initial aptitude will determine your field effectiveness. Choose wisely.
                </Text>

                {/* Buttons */}
                <View style={styles.buttons}>
                    <AnimatedPressable
                        style={[styles.button, styles.backButton, { backgroundColor: colors.background.secondary }]}
                        onPress={onBack}
                    >
                        <Text style={[styles.buttonText, { color: colors.text.primary }]}>Back</Text>
                    </AnimatedPressable>
                    <AnimatedPressable
                        style={[
                            styles.button,
                            styles.createButton,
                            { backgroundColor: remainingPoints === 0 ? colors.primary[500] : colors.background.tertiary },
                            remainingPoints > 0 && { opacity: 0.7 }
                        ]}
                        onPress={handleCreate}
                    >
                        <Text style={[styles.buttonText, { color: remainingPoints === 0 ? '#fff' : colors.text.muted }]}>
                            Confirm
                        </Text>
                    </AnimatedPressable>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: spacing.lg,
    },
    title: {
        fontSize: typography.fontSize.xxl,
        fontWeight: 'bold',
        marginBottom: spacing.xs,
    },
    subtitle: {
        fontSize: typography.fontSize.lg,
        marginBottom: spacing.xl,
    },
    systemMessage: {
        padding: spacing.lg,
        borderRadius: borderRadius.md,
        marginBottom: spacing.xl,
    },
    systemTitle: {
        fontSize: typography.fontSize.md,
        fontWeight: '600',
        marginBottom: spacing.md,
        fontFamily: 'monospace',
    },
    systemText: {
        fontSize: typography.fontSize.md,
        marginBottom: spacing.xs,
        fontFamily: 'monospace',
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    label: {
        fontSize: typography.fontSize.md,
        fontWeight: '600',
    },
    pointsIndicator: {
        fontSize: typography.fontSize.md,
        fontWeight: 'bold',
        fontFamily: 'monospace',
    },
    statsGrid: {
        padding: spacing.md,
        borderRadius: borderRadius.md,
        gap: spacing.sm,
    },
    statItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.xs,
    },
    statName: {
        fontSize: typography.fontSize.md,
    },
    statControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    controlButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    controlButtonDisabled: {
        opacity: 0.3,
    },
    controlText: {
        fontSize: typography.fontSize.lg,
        fontWeight: 'bold',
    },
    statValue: {
        fontSize: typography.fontSize.lg,
        fontWeight: 'bold',
        minWidth: 24,
        textAlign: 'center',
        fontFamily: 'monospace',
    },
    note: {
        fontSize: typography.fontSize.sm,
        fontStyle: 'italic',
        marginBottom: spacing.xl,
    },
    buttons: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.xl,
    },
    button: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: 'center',
    },
    backButton: {},
    createButton: {},
    buttonText: {
        fontSize: typography.fontSize.md,
        fontWeight: '600',
    },
});
