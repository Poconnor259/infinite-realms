import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../../lib/theme';
import { useTurnsStore } from '../../lib/store';

interface TurnsMeterProps {
    compact?: boolean;
}

export function TurnsMeter({ compact = false }: TurnsMeterProps) {
    const router = useRouter();
    const { used, tier, getLimit, getRemaining, getUsagePercent } = useTurnsStore();

    const limit = getLimit();
    const remaining = getRemaining();
    const percent = getUsagePercent();

    // Color based on usage
    const getBarColor = () => {
        if (tier === 'legend') return colors.gold.main;
        if (percent < 50) return colors.status.success;
        if (percent < 80) return colors.status.warning;
        return colors.status.error;
    };

    const getTierIcon = () => {
        switch (tier) {
            case 'scout': return '🔭';
            case 'hero': return '⚔️';
            case 'legend': return '👑';
        }
    };

    const getTierName = () => {
        switch (tier) {
            case 'scout': return 'Scout';
            case 'hero': return 'Hero';
            case 'legend': return 'Legend';
        }
    };

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
                                width: tier === 'legend' ? '100%' : `${100 - percent}%`,
                                backgroundColor: getBarColor(),
                            }
                        ]}
                    />
                </View>
                <Text style={styles.compactText}>
                    {tier === 'legend' ? '∞' : remaining}
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
                                width: tier === 'legend' ? '100%' : `${100 - percent}%`,
                                backgroundColor: getBarColor(),
                            }
                        ]}
                    />
                </View>
            </View>

            <View style={styles.stats}>
                <Text style={styles.remaining}>
                    {tier === 'legend' ? '∞ Unlimited' : `${remaining} turns left`}
                </Text>
                {tier !== 'legend' && (
                    <Text style={styles.used}>
                        {used}/{limit + useTurnsStore.getState().bonusTurns} this month
                    </Text>
                )}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
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
