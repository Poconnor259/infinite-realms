import React, { useState, useMemo, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity, // Added TouchableOpacity import
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Logo } from '../components/ui/Logo';
import { spacing, borderRadius, typography, shadows } from '../lib/theme';
import { useThemeColors } from '../lib/hooks/useTheme';
import { ActivityIndicator } from 'react-native';

import { AnimatedPressable, FadeInView } from '../components/ui/Animated';
import { getWorlds } from '../lib/firebase';
import type { WorldModule, WorldModuleType } from '../lib/types';

export default function WorldSelectScreen() {
    const router = useRouter();
    const { colors } = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [worlds, setWorlds] = useState<WorldModule[]>([]);
    const [selectedWorld, setSelectedWorld] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchWorlds = async () => {
            try {
                const data = await getWorlds();
                setWorlds(data);
                if (data.length > 0) {
                    // Optionally pre-select first world
                }
            } catch (error) {
                console.error('Error fetching worlds:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchWorlds();
    }, []);

    const handleWorldSelect = (worldId: string) => {
        setSelectedWorld(worldId);
    };

    const handleContinue = () => {
        if (!selectedWorld) return;
        router.push(`/campaign/create?world=${selectedWorld}`);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <Logo size={32} />
            </View>
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

                {isLoading ? (
                    <ActivityIndicator size="large" color={colors.primary[500]} style={{ marginTop: spacing.xxl }} />
                ) : worlds.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={[styles.emptyText, { color: colors.text.muted }]}>No worlds available.</Text>
                    </View>
                ) : (
                    worlds.map((world, index) => {
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
                                        {world.features.map((feature: string, i: number) => (
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
                    })
                )}
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

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    header: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
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
    emptyState: {
        alignItems: 'center',
        marginTop: spacing.xxl,
    },
    emptyText: {
        fontSize: typography.fontSize.md,
        fontWeight: '600',
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
