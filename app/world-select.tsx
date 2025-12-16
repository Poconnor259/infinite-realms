import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../lib/theme';

import { AnimatedPressable, FadeInView } from '../components/ui/Animated';
import type { WorldModuleType } from '../lib/types';

interface WorldModule {
    id: WorldModuleType;
    name: string;
    subtitle: string;
    icon: string;
    color: string;
    description: string;
    features: string[];
    locked?: boolean;
    lockReason?: string;
}

const WORLD_MODULES: WorldModule[] = [
    {
        id: 'classic',
        name: 'The Classic',
        subtitle: 'Dungeons & Dragons 5th Edition',
        icon: '⚔️',
        color: colors.gold.main,
        description: 'Experience the timeless fantasy of D&D with full 5e rules integration. Roll for initiative, manage spell slots, and explore dungeons with your party.',
        features: [
            'Full D&D 5e stat system (STR, DEX, CON, INT, WIS, CHA)',
            'Spell slot management',
            'Equipment and inventory tracking',
            'Classic fantasy setting',
        ],
    },
    {
        id: 'outworlder',
        name: 'The Outworlder',
        subtitle: 'He Who Fights With Monsters',
        icon: '🌌',
        color: '#10b981',
        description: 'Enter a world where essence abilities define your power. Climb the ranks from Iron to Diamond as you absorb monster essences and unlock your confluence.',
        features: [
            'Essence-based power system',
            'Rank progression (Iron → Diamond)',
            'Unique ability combinations',
            'Blue Box system notifications',
        ],
    },
    {
        id: 'shadowMonarch',
        name: 'Shadow Monarch',
        subtitle: 'Solo Leveling',
        icon: '👤',
        color: '#8b5cf6',
        description: 'Start as the weakest hunter and rise to become the Shadow Monarch. Complete daily quests, clear dungeons, and build your shadow army.',
        features: [
            'Daily quest system with penalties',
            'Shadow extraction and army management',
            'Stat point allocation',
            'Gate and dungeon rankings',
        ],
    },
];

export default function WorldSelectScreen() {
    const router = useRouter();
    const [selectedWorld, setSelectedWorld] = useState<WorldModuleType | null>(null);

    const handleWorldSelect = (worldId: WorldModuleType) => {
        setSelectedWorld(worldId);
    };

    const handleContinue = () => {
        if (!selectedWorld) return;
        router.push(`/campaign/create?world=${selectedWorld}`);
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.title}>
                    Choose Your World
                </Text>
                <Text style={styles.subtitle}>
                    Each world has unique rules, mechanics, and storytelling styles
                </Text>

                {WORLD_MODULES.map((world, index) => {
                    const isSelected = selectedWorld === world.id;

                    return (
                        <FadeInView key={world.id} delay={index * 100}>
                            <AnimatedPressable
                                style={[
                                    styles.worldCard,
                                    isSelected && styles.worldCardSelected,
                                    { borderColor: isSelected ? world.color : colors.border.default },
                                ]}
                                onPress={() => handleWorldSelect(world.id)}
                                disabled={world.locked}
                            >
                                {/* Header */}
                                <View style={styles.worldHeader}>
                                    <View style={[styles.worldIcon, { backgroundColor: world.color + '20' }]}>
                                        <Text style={styles.worldIconText}>{world.icon}</Text>
                                    </View>
                                    <View style={styles.worldTitleContainer}>
                                        <Text style={styles.worldName}>{world.name}</Text>
                                        <Text style={styles.worldSubtitle}>{world.subtitle}</Text>
                                    </View>
                                    {isSelected && (
                                        <View style={[styles.checkmark, { backgroundColor: world.color }]}>
                                            <Ionicons name="checkmark" size={16} color="#fff" />
                                        </View>
                                    )}
                                </View>

                                {/* Description */}
                                <Text style={styles.worldDescription}>{world.description}</Text>

                                {/* Features */}
                                <View style={styles.featuresContainer}>
                                    {world.features.map((feature, i) => (
                                        <View key={i} style={styles.featureItem}>
                                            <Text style={[styles.featureBullet, { color: world.color }]}>•</Text>
                                            <Text style={styles.featureText}>{feature}</Text>
                                        </View>
                                    ))}
                                </View>

                                {/* Locked overlay */}
                                {world.locked && (
                                    <View style={styles.lockedOverlay}>
                                        <Ionicons name="lock-closed" size={24} color={colors.text.muted} />
                                        <Text style={styles.lockedText}>{world.lockReason}</Text>
                                    </View>
                                )}
                            </AnimatedPressable>
                        </FadeInView>
                    );
                })}
            </ScrollView>

            {/* Continue Button */}
            <View style={styles.footer}>
                <AnimatedPressable
                    style={[
                        styles.continueButton,
                        !selectedWorld && styles.continueButtonDisabled,
                    ]}
                    onPress={handleContinue}
                    disabled={!selectedWorld}
                >
                    <Text style={styles.continueButtonText}>
                        Begin Adventure
                    </Text>
                    <Ionicons name="arrow-forward" size={20} color={colors.text.primary} />
                </AnimatedPressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.lg,
        paddingBottom: spacing.xxl,
    },
    title: {
        color: colors.text.primary,
        fontSize: typography.fontSize.xxl,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: spacing.xs,
    },
    subtitle: {
        color: colors.text.muted,
        fontSize: typography.fontSize.md,
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    worldCard: {
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderWidth: 2,
        borderColor: colors.border.default,
        ...shadows.md,
    },
    worldCardSelected: {
        backgroundColor: colors.background.elevated,
    },
    worldHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    worldIcon: {
        width: 56,
        height: 56,
        borderRadius: borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    worldIconText: {
        fontSize: 28,
    },
    worldTitleContainer: {
        flex: 1,
    },
    worldName: {
        color: colors.text.primary,
        fontSize: typography.fontSize.lg,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    worldSubtitle: {
        color: colors.text.muted,
        fontSize: typography.fontSize.sm,
    },
    checkmark: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    worldDescription: {
        color: colors.text.secondary,
        fontSize: typography.fontSize.sm,
        lineHeight: typography.fontSize.sm * typography.lineHeight.relaxed,
        marginBottom: spacing.md,
    },
    featuresContainer: {
        gap: spacing.xs,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    featureBullet: {
        fontSize: typography.fontSize.md,
        marginRight: spacing.sm,
        marginTop: -2,
    },
    featureText: {
        color: colors.text.muted,
        fontSize: typography.fontSize.sm,
        flex: 1,
    },
    lockedOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderRadius: borderRadius.xl,
        justifyContent: 'center',
        alignItems: 'center',
    },
    lockedText: {
        color: colors.text.muted,
        fontSize: typography.fontSize.sm,
        marginTop: spacing.sm,
    },
    footer: {
        padding: spacing.lg,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border.default,
        backgroundColor: colors.background.primary,
    },
    continueButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: colors.primary[600],
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
    },
    continueButtonDisabled: {
        backgroundColor: colors.background.tertiary,
        opacity: 0.5,
    },
    continueButtonText: {
        color: colors.text.primary,
        fontSize: typography.fontSize.lg,
        fontWeight: '600',
    },
});
