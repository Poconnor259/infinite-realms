import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, typography } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';
import { AnimatedPressable } from '../ui/Animated';
import { CharacterImport } from './CharacterImport';
import type { ClassicCharacter } from '../../lib/types';

interface ClassicCharacterCreationProps {
    characterName: string;
    onComplete: (character: ClassicCharacter) => void;
    onBack: () => void;
}

const RACES = ['Human', 'Elf', 'Dwarf', 'Halfling', 'Dragonborn', 'Tiefling'];
const CLASSES = ['Fighter', 'Wizard', 'Rogue', 'Cleric', 'Ranger', 'Paladin'];

const CLASS_EQUIPMENT: Record<string, { type: string; name: string; equipped?: boolean; quantity?: number }[]> = {
    Fighter: [
        { type: 'weapon', name: 'Longsword', equipped: true },
        { type: 'armor', name: 'Chain Mail', equipped: true },
        { type: 'weapon', name: 'Shield', equipped: true },
        { type: 'consumable', name: 'Health Potion', quantity: 2 },
    ],
    Wizard: [
        { type: 'weapon', name: 'Quarterstaff', equipped: true },
        { type: 'armor', name: 'Robes', equipped: true },
        { type: 'tool', name: 'Spellbook', equipped: true },
        { type: 'consumable', name: 'Mana Potion', quantity: 3 },
    ],
    Rogue: [
        { type: 'weapon', name: 'Shortsword', equipped: true },
        { type: 'weapon', name: 'Dagger', quantity: 2 },
        { type: 'armor', name: 'Leather Armor', equipped: true },
        { type: 'tool', name: "Thieves' Tools", equipped: true },
    ],
    Cleric: [
        { type: 'weapon', name: 'Mace', equipped: true },
        { type: 'weapon', name: 'Shield', equipped: true },
        { type: 'armor', name: 'Scale Mail', equipped: true },
        { type: 'tool', name: 'Holy Symbol', equipped: true },
    ],
    Ranger: [
        { type: 'weapon', name: 'Longbow', equipped: true },
        { type: 'weapon', name: 'Shortsword', equipped: true },
        { type: 'armor', name: 'Leather Armor', equipped: true },
        { type: 'consumable', name: 'Arrows', quantity: 20 },
    ],
    Paladin: [
        { type: 'weapon', name: 'Longsword', equipped: true },
        { type: 'weapon', name: 'Shield', equipped: true },
        { type: 'armor', name: 'Chain Mail', equipped: true },
        { type: 'tool', name: 'Holy Symbol', equipped: true },
    ],
};

export function ClassicCharacterCreation({ characterName, onComplete, onBack }: ClassicCharacterCreationProps) {
    const { colors } = useThemeColors();
    const [selectedRace, setSelectedRace] = useState<string>('Human');
    const [selectedClass, setSelectedClass] = useState<string>('Fighter');
    const [stats, setStats] = useState({
        STR: 10,
        DEX: 10,
        CON: 10,
        INT: 10,
        WIS: 10,
        CHA: 10,
    });
    const [remainingPoints, setRemainingPoints] = useState(15);
    const [showImport, setShowImport] = useState(false);

    const handleAdjustStat = (stat: keyof typeof stats, delta: number) => {
        if (delta > 0 && remainingPoints <= 0) return;
        if (delta < 0 && stats[stat] <= 8) return; // D&D base usually 8-10, let's allow down to 8

        setStats(prev => ({
            ...prev,
            [stat]: prev[stat] + delta
        }));
        setRemainingPoints(prev => prev - delta);
    };

    const handleCreate = () => {
        const inventory = CLASS_EQUIPMENT[selectedClass].map((item, idx) => {
            // Map consumable and tool to misc since InventoryItem only supports weapon/armor/potion/scroll/misc
            let itemType: 'weapon' | 'armor' | 'potion' | 'scroll' | 'misc' = 'misc';
            if (item.type === 'weapon' || item.type === 'armor' || item.type === 'potion' || item.type === 'scroll') {
                itemType = item.type as 'weapon' | 'armor' | 'potion' | 'scroll';
            }

            return {
                id: `item-${idx}`,
                type: itemType,
                name: item.name,
                equipped: item.equipped || false,
                quantity: item.quantity || 1,
            };
        });

        // 5E HP: CON modifier + 10 (base)
        const conMod = Math.floor((stats.CON - 10) / 2);
        const maxHp = 10 + conMod;

        const character: ClassicCharacter = {
            id: 'temp-id', // Will be replaced by backend
            name: characterName,
            level: 1,
            hp: { current: maxHp, max: maxHp },
            race: selectedRace,
            class: selectedClass,
            stats: { ...stats },
            ac: 10 + Math.floor((stats.DEX - 10) / 2),
            proficiencyBonus: 2,
            inventory,
            gold: 15,
            abilities: [],
        };

        onComplete(character);
    };

    const handleImport = (data: any) => {
        // Apply imported data
        if (data.stats) {
            const importedStats = {
                STR: data.stats.strength || data.stats.STR || 10,
                DEX: data.stats.dexterity || data.stats.DEX || 10,
                CON: data.stats.constitution || data.stats.CON || 10,
                INT: data.stats.intelligence || data.stats.INT || 10,
                WIS: data.stats.wisdom || data.stats.WIS || 10,
                CHA: data.stats.charisma || data.stats.CHA || 10,
            };
            setStats(importedStats);

            // Calculate remaining points
            const totalUsed = Object.values(importedStats).reduce((sum, val) => sum + val, 0) - 60;
            setRemainingPoints(15 - totalUsed);
        }

        if (data.race && RACES.includes(data.race)) {
            setSelectedRace(data.race);
        }

        if (data.class && CLASSES.includes(data.class)) {
            setSelectedClass(data.class);
        }
    };

    const statList = [
        { key: 'STR' as const, name: 'Strength' },
        { key: 'DEX' as const, name: 'Dexterity' },
        { key: 'CON' as const, name: 'Constitution' },
        { key: 'INT' as const, name: 'Intelligence' },
        { key: 'WIS' as const, name: 'Wisdom' },
        { key: 'CHA' as const, name: 'Charisma' },
    ];

    return (
        <>
            <ScrollView style={[styles.container, { backgroundColor: colors.background.primary }]}>
                <View style={styles.content}>
                    <View style={styles.headerRow}>
                        <View>
                            <Text style={[styles.title, { color: colors.text.primary }]}>Create Your Character</Text>
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

                    {/* Race Selection */}
                    <View style={styles.section}>
                        <Text style={[styles.label, { color: colors.text.primary }]}>Race</Text>
                        <View style={styles.optionsGrid}>
                            {RACES.map((race) => (
                                <AnimatedPressable
                                    key={race}
                                    style={[
                                        styles.option,
                                        {
                                            backgroundColor: selectedRace === race
                                                ? colors.primary[500]
                                                : colors.background.secondary,
                                            borderColor: colors.border.default,
                                        }
                                    ]}
                                    onPress={() => setSelectedRace(race)}
                                >
                                    <Text style={[
                                        styles.optionText,
                                        { color: selectedRace === race ? '#fff' : colors.text.primary }
                                    ]}>
                                        {race}
                                    </Text>
                                </AnimatedPressable>
                            ))}
                        </View>
                    </View>

                    {/* Class Selection */}
                    <View style={styles.section}>
                        <Text style={[styles.label, { color: colors.text.primary }]}>Class</Text>
                        <View style={styles.optionsGrid}>
                            {CLASSES.map((cls) => (
                                <AnimatedPressable
                                    key={cls}
                                    style={[
                                        styles.option,
                                        {
                                            backgroundColor: selectedClass === cls
                                                ? colors.primary[500]
                                                : colors.background.secondary,
                                            borderColor: colors.border.default,
                                        }
                                    ]}
                                    onPress={() => setSelectedClass(cls)}
                                >
                                    <Text style={[
                                        styles.optionText,
                                        { color: selectedClass === cls ? '#fff' : colors.text.primary }
                                    ]}>
                                        {cls}
                                    </Text>
                                </AnimatedPressable>
                            ))}
                        </View>
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
                                                stats[stat.key] <= 8 && styles.controlButtonDisabled,
                                                { backgroundColor: colors.background.tertiary }
                                            ]}
                                            onPress={() => handleAdjustStat(stat.key, -1)}
                                            disabled={stats[stat.key] <= 8}
                                        >
                                            <Text style={[styles.controlText, { color: colors.text.primary }]}>-</Text>
                                        </AnimatedPressable>

                                        <View style={styles.statValueContainer}>
                                            <Text style={[styles.statValue, { color: colors.text.primary }]}>
                                                {stats[stat.key]}
                                            </Text>
                                            <Text style={[styles.statModifier, { color: colors.text.muted }]}>
                                                ({Math.floor((stats[stat.key] - 10) / 2) >= 0 ? '+' : ''}{Math.floor((stats[stat.key] - 10) / 2)})
                                            </Text>
                                        </View>

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

                    {/* Starting Equipment Preview */}
                    <View style={styles.section}>
                        <Text style={[styles.label, { color: colors.text.primary }]}>Starting Equipment</Text>
                        <View style={[styles.equipmentPreview, { backgroundColor: colors.background.secondary }]}>
                            {CLASS_EQUIPMENT[selectedClass].map((item, idx) => (
                                <Text key={idx} style={[styles.equipmentItem, { color: colors.text.secondary }]}>
                                    • {item.name} {item.quantity && item.quantity > 1 ? `(×${item.quantity})` : ''}
                                </Text>
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
                    worldType="classic"
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
        marginBottom: spacing.xl,
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
    optionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    option: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        minWidth: 100,
        alignItems: 'center',
    },
    optionText: {
        fontSize: typography.fontSize.md,
        fontWeight: '500',
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
    statValueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        minWidth: 60,
        justifyContent: 'center',
    },
    statValue: {
        fontSize: typography.fontSize.lg,
        fontWeight: 'bold',
        fontFamily: 'monospace',
    },
    statModifier: {
        fontSize: typography.fontSize.sm,
        fontFamily: 'monospace',
    },
    equipmentPreview: {
        padding: spacing.md,
        borderRadius: borderRadius.md,
    },
    equipmentItem: {
        fontSize: typography.fontSize.sm,
        marginBottom: spacing.xs,
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
