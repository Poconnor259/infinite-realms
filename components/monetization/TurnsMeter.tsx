import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, typography } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';
import { useTurnsStore } from '../../lib/store';

interface TurnsMeterProps {
    compact?: boolean;
}

export function TurnsMeter({ compact = false }: TurnsMeterProps) {
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        setIsHydrated(true);
    }, []);

    const router = useRouter();
    const { colors } = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { tier, getLimit, getRemaining, getUsagePercent } = useTurnsStore();

    const limit = getLimit();
    const remaining = getRemaining();
    const percent = getUsagePercent();

    // Color based on usage
    const getBarColor = () => {
        if (tier === 'legendary') return colors.gold.main;
        if (tier === 'hero') return colors.primary[400]; // Purple for Hero
        if (tier === 'adventurer') return colors.status.info; // Blue for Adventurer
        if (percent < 50) return colors.status.success;
        if (percent < 80) return colors.status.warning;
        return colors.status.error;
    };

    const getTierIcon = () => {
        switch (tier) {
            case 'scout': return '🔭';
            case 'adventurer': return '🧭';
            case 'hero': return '⚔️';
            case 'legendary': return '👑';
            default: return '❓';
        }
    };

    const getTierName = () => {
        switch (tier) {
            case 'scout': return 'Scout';
            case 'adventurer': return 'Adventurer';
            case 'hero': return 'Hero';
            case 'legendary': return 'Legendary';
            default: return tier;
        }
    };

    // Show placeholder during SSR and initial client render to prevent hydration mismatch
    if (!isHydrated) {
        if (compact) {
            return (
                <View style={styles.compactContainer}>
                    <View style={[styles.compactBar, { backgroundColor: colors.background.tertiary }]} />
                    <Text style={styles.compactText}>...</Text>
                </View>
            );
        }

        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <View style={styles.tierBadge}>
                        <Text style={styles.tierIcon}>🔭</Text>
                        <Text style={styles.tierName}>Loading...</Text>
                    </View>
                </View>
                <View style={styles.meterContainer}>
                    <View style={styles.meterTrack} />
                </View>
            </View>
        );
    }

    if (compact) {
        return (
            <TouchableOpacity
                style={styles.compactContainer}
                onPress={() => router.push('/subscription')}
            >
                <View style={[styles.compactBar, { backgroundColor: colors.background.tertiary }]}>
                    <View
                        style={[
                            styles.compactFill,
                            {
                                width: tier === 'legendary' ? '100%' : `${100 - percent}%`,
                                backgroundColor: getBarColor(),
                            }
                        ]}
                    />
                </View>
                <Text style={styles.compactText}>
                    {tier === 'legendary' ? '∞' : remaining}
                </Text>
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity
            style={styles.container}
            onPress={() => router.push('/subscription')}
            activeOpacity={0.8}
        >
            <View style={styles.header}>
                <View style={styles.tierBadge}>
                    <Text style={styles.tierIcon}>{getTierIcon()}</Text>
                    <Text style={styles.tierName}>{getTierName()}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
            </View>

            <View style={styles.meterContainer}>
                <View style={styles.meterTrack}>
                    <View
                        style={[
                            styles.meterFill,
                            {
                                width: tier === 'legendary' ? '100%' : `${100 - percent}%`,
                                backgroundColor: getBarColor(),
                            }
                        ]}
                    />
                </View>
            </View>

            <View style={styles.stats}>
                <Text style={styles.remaining}>
                    {tier === 'legendary' ? '∞ Unlimited' : `${remaining} turns left`}
                </Text>
                {tier !== 'legendary' && (
                    <Text style={styles.used}>
                        {getLimit()} monthly
                    </Text>
                )}
            </View>
        </TouchableOpacity>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    tierBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    tierIcon: {
        fontSize: 16,
    },
    tierName: {
        color: colors.text.primary,
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    meterContainer: {
        marginBottom: spacing.sm,
    },
    meterTrack: {
        height: 8,
        backgroundColor: colors.background.primary,
        borderRadius: borderRadius.full,
        overflow: 'hidden',
    },
    meterFill: {
        height: '100%',
        borderRadius: borderRadius.full,
    },
    stats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    remaining: {
        color: colors.text.secondary,
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
        minWidth: 90, // Prevent jitter
    },
    used: {
        color: colors.text.muted,
        fontSize: typography.fontSize.xs,
    },
    // Compact styles
    compactContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    compactBar: {
        width: 40,
        height: 6,
        borderRadius: borderRadius.full,
        overflow: 'hidden',
    },
    compactFill: {
        height: '100%',
        borderRadius: borderRadius.full,
    },
    compactText: {
        color: colors.text.muted,
        fontSize: typography.fontSize.xs,
        fontWeight: '600',
        minWidth: 20,
    },
});
