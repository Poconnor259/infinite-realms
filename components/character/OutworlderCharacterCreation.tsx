import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, typography } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';
import { AnimatedPressable } from '../ui/Animated';
import { CharacterImport } from './CharacterImport';
import type { OutworlderCharacter } from '../../lib/types';

interface OutworlderCharacterCreationProps {
    characterName: string;
    onComplete: (character: OutworlderCharacter) => void;
    onBack: () => void;
}

const STARTING_ESSENCES = [
    { name: 'Might', ability: 'Power Strike', type: 'Special Attack' },
    { name: 'Swift', ability: 'Quick Step', type: 'Movement' },
    { name: 'Resolve', ability: 'Iron Will', type: 'Recovery' },
    { name: 'Mystic', ability: 'Mana Bolt', type: 'Spell' },
];

export function OutworlderCharacterCreation({ characterName, onComplete, onBack }: OutworlderCharacterCreationProps) {
    const { colors } = useThemeColors();
    const [selectedEssence, setSelectedEssence] = useState(STARTING_ESSENCES[0]);
    const [stats, setStats] = useState({
        power: 10,
        speed: 10,
        spirit: 10,
        recovery: 10,
    });
    const [remainingPoints, setRemainingPoints] = useState(10);
    const [showImport, setShowImport] = useState(false);
    const [importedAbilities, setImportedAbilities] = useState<any[]>([]);

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
        // HWFWM scaling: stats increase base pools
        const baseHp = 100;
        const hp = baseHp + (stats.power - 10) * 10;
        const spirit = baseHp + (stats.spirit - 10) * 10;
        const mana = baseHp + (stats.spirit - 10) * 10;

        const character: OutworlderCharacter = {
            id: 'temp-id', // Will be replaced by backend
            name: characterName,
            level: 1,
            hp: { current: hp, max: hp },
            spirit: { current: spirit, max: spirit },
            mana: { current: mana, max: mana },
            rank: 'Iron',
            essences: [selectedEssence.name],
            confluence: undefined,
            stats: { ...stats },
            abilities: [{
                name: selectedEssence.ability,
                type: selectedEssence.type as 'attack' | 'defense' | 'utility' | 'movement' | 'special',
                rank: 'Iron',
                essence: selectedEssence.name,
                cooldown: 0,
                currentCooldown: 0,
                cost: 'mana' as const,
                costAmount: 10,
                description: `Starting ability from ${selectedEssence.name} essence`,
            }],
        };

        onComplete(character);
    };

    const handleImport = (data: any) => {
        // Apply imported data
        if (data.stats) {
            const importedStats = {
                power: data.stats.power || 10,
                speed: data.stats.speed || 10,
                spirit: data.stats.spirit || 10,
                recovery: data.stats.recovery || 10,
            };
            setStats(importedStats);

            // Calculate remaining points
            const totalUsed = Object.values(importedStats).reduce((sum, val) => sum + val, 0) - 40;
            setRemainingPoints(10 - totalUsed);
        }

        if (data.essences && data.essences.length > 0) {
            // Try to match imported essence to starting essences
            const matchedEssence = STARTING_ESSENCES.find(e => e.name === data.essences[0]);
            if (matchedEssence) {
                setSelectedEssence(matchedEssence);
            }
        }

        if (data.abilities) {
            setImportedAbilities(data.abilities);
        }
    };

    const statList = [
        { key: 'power' as const, name: 'Power' },
        { key: 'speed' as const, name: 'Speed' },
        { key: 'spirit' as const, name: 'Spirit' },
        { key: 'recovery' as const, name: 'Recovery' },
    ];

    return (
        <>
            <ScrollView style={[styles.container, { backgroundColor: colors.background.primary }]}>
                <View style={styles.content}>
                    <View style={styles.headerRow}>
                        <View>
                            <Text style={[styles.title, { color: colors.text.primary }]}>Choose Your First Essence</Text>
                            <Text style={[styles.subtitle, { color: colors.text.secondary }]}>{characterName}</Text>
                        </View>
                        <AnimatedPressable
                            style={[styles.importButton, { backgroundColor: colors.primary[900] + '40', borderColor: colors.primary[400] }]}
                            onPress={() => setShowImport(true)}
                        >
                            <Ionicons name="cloud-upload" size={18} color={colors.primary[400]} />
                            <Text style={[styles.importButtonText, { color: colors.primary[400] }]}>Import</Text>
                        </AnimatedPressable>
                    </View>

                    <Text style={[styles.description, { color: colors.text.secondary }]}>
                        You've awakened in a new world. Choose your first essence to begin your journey as an Outworlder.
                    </Text>

                    {/* Essence Selection */}
                    <View style={styles.section}>
                        {STARTING_ESSENCES.map((essence) => (
                            <AnimatedPressable
                                key={essence.name}
                                style={[
                                    styles.essenceCard,
                                    {
                                        backgroundColor: selectedEssence.name === essence.name
                                            ? colors.primary[500] + '20'
                                            : colors.background.secondary,
                                        borderColor: selectedEssence.name === essence.name
                                            ? colors.primary[500]
                                            : colors.border.default,
                                        borderWidth: 2,
                                    }
                                ]}
                                onPress={() => setSelectedEssence(essence)}
                            >
                                <Text style={[styles.essenceName, {
                                    color: selectedEssence.name === essence.name
                                        ? colors.primary[500]
                                        : colors.text.primary
                                }]}>
                                    {essence.name} Essence
                                </Text>
                                <Text style={[styles.abilityName, { color: colors.text.secondary }]}>
                                    Grants: {essence.ability}
                                </Text>
                                <Text style={[styles.abilityType, { color: colors.text.muted }]}>
                                    {essence.type}
                                </Text>
                            </AnimatedPressable>
                        ))}
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
                                {remainingPoints === 0 ? 'Begin Adventure' : `Allocate ${remainingPoints} More`}
                            </Text>
                        </AnimatedPressable>
                    </View>
                </View>
            </ScrollView>

            {/* Import Modal */}
            <Modal
                visible={showImport}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowImport(false)}
            >
                <CharacterImport
                    worldType="outworlder"
                    onImport={handleImport}
                    onClose={() => setShowImport(false)}
                />
            </Modal>
        </>
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
        marginBottom: spacing.md,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.md,
    },
    importButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: 1,
    },
    importButtonText: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    description: {
        fontSize: typography.fontSize.md,
        marginBottom: spacing.xl,
        lineHeight: 24,
    },
    section: {
        marginBottom: spacing.xl,
    },
    essenceCard: {
        padding: spacing.lg,
        borderRadius: borderRadius.md,
    },
    essenceName: {
        fontSize: typography.fontSize.lg,
        fontWeight: '600',
        marginBottom: spacing.xs,
    },
    abilityName: {
        fontSize: typography.fontSize.md,
        marginBottom: spacing.xs,
    },
    abilityType: {
        fontSize: typography.fontSize.sm,
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
