import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../lib/theme';
import { useTurnsStore } from '../lib/store';
import { DEFAULT_TOP_UP_PACKAGES, type SubscriptionTier, DEFAULT_SUBSCRIPTION_PRICING } from '../lib/types';

interface TierCardProps {
    tier: SubscriptionTier;
    name: string;
    icon: string;
    price: string;
    turns: string;
    features: string[];
    isCurrentTier: boolean;
    recommended?: boolean;
    onSelect: () => void;
}

function TierCard({ tier, name, icon, price, turns, features, isCurrentTier, recommended, onSelect }: TierCardProps) {
    return (
        <View style={[
            styles.tierCard,
            isCurrentTier && styles.tierCardCurrent,
            recommended && styles.tierCardRecommended,
        ]}>
            {recommended && (
                <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedText}>BEST VALUE</Text>
                </View>
            )}

            <View style={styles.tierHeader}>
                <Text style={styles.tierIcon}>{icon}</Text>
                <Text style={styles.tierName}>{name}</Text>
            </View>

            <View style={styles.tierPricing}>
                <Text style={styles.tierPrice}>{price}</Text>
                <Text style={styles.tierTurns}>{turns}</Text>
            </View>

            <View style={styles.tierFeatures}>
                {features.map((feature, i) => (
                    <View key={i} style={styles.featureRow}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.status.success} />
                        <Text style={styles.featureText}>{feature}</Text>
                    </View>
                ))}
            </View>

            <TouchableOpacity
                style={[
                    styles.tierButton,
                    isCurrentTier && styles.tierButtonCurrent,
                ]}
                onPress={onSelect}
                disabled={isCurrentTier}
                activeOpacity={0.8}
            >
                <Text style={[
                    styles.tierButtonText,
                    isCurrentTier && styles.tierButtonTextCurrent,
                ]}>
                    {isCurrentTier ? 'Current Plan' : 'Select'}
                </Text>
            </TouchableOpacity>
        </View>
    );
}

export default function SubscriptionScreen() {
    const router = useRouter();
    const { tier, used, getLimit, getRemaining, bonusTurns, resetDate } = useTurnsStore();

    const limit = getLimit();
    const remaining = getRemaining();

    const formatResetDate = () => {
        const date = new Date(resetDate);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const handleSelectTier = (selectedTier: SubscriptionTier) => {
        if (selectedTier === tier) return;
        // TODO: Integrate with RevenueCat
        console.log('Select tier:', selectedTier);
    };

    const handleBuyTopUp = (packageId: string) => {
        // TODO: Integrate with RevenueCat
        console.log('Buy top-up:', packageId);
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Current Usage */}
                <View style={styles.usageCard}>
                    <Text style={styles.usageTitle}>Your Usage This Month</Text>
                    <View style={styles.usageStats}>
                        <View style={styles.usageStat}>
                            <Text style={styles.usageValue}>
                                {tier === 'legend' ? '∞' : remaining}
                            </Text>
                            <Text style={styles.usageLabel}>Turns Left</Text>
                        </View>
                        <View style={styles.usageDivider} />
                        <View style={styles.usageStat}>
                            <Text style={styles.usageValue}>{used}</Text>
                            <Text style={styles.usageLabel}>Used</Text>
                        </View>
                        <View style={styles.usageDivider} />
                        <View style={styles.usageStat}>
                            <Text style={styles.usageValue}>{formatResetDate()}</Text>
                            <Text style={styles.usageLabel}>Resets</Text>
                        </View>
                    </View>
                    {bonusTurns > 0 && (
                        <Text style={styles.bonusText}>+{bonusTurns} bonus turns from top-ups</Text>
                    )}
                </View>

                {/* Subscription Tiers */}
                <Text style={styles.sectionTitle}>Subscription Plans</Text>

                <TierCard
                    tier="scout"
                    name="Scout"
                    icon="🔭"
                    price={DEFAULT_SUBSCRIPTION_PRICING.scout.displayPrice}
                    turns="15 turns/month"
                    features={[
                        'Access all 3 world modules',
                        'Basic character progression',
                        'Cloud save (coming soon)',
                    ]}
                    isCurrentTier={tier === 'scout'}
                    onSelect={() => handleSelectTier('scout')}
                />

                <TierCard
                    tier="hero"
                    name="Hero"
                    icon="⚔️"
                    price={DEFAULT_SUBSCRIPTION_PRICING.hero.displayPrice}
                    turns="300 turns/month"
                    features={[
                        'Everything in Scout',
                        '20x more turns',
                        'Priority support',
                        'Early access to new features',
                    ]}
                    isCurrentTier={tier === 'hero'}
                    recommended={tier === 'scout'}
                    onSelect={() => handleSelectTier('hero')}
                />

                <TierCard
                    tier="legend"
                    name="Legend"
                    icon="👑"
                    price={DEFAULT_SUBSCRIPTION_PRICING.legend.displayPrice}
                    turns="Unlimited turns"
                    features={[
                        'Bring your own API keys',
                        'No monthly limits',
                        'You control AI costs',
                        'Full API customization',
                    ]}
                    isCurrentTier={tier === 'legend'}
                    onSelect={() => router.push('/settings')}
                />

                {/* Top-up Section */}
                {tier !== 'legend' && (
                    <>
                        <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>
                            Need More Turns Now?
                        </Text>
                        <View style={styles.topUpContainer}>
                            {DEFAULT_TOP_UP_PACKAGES.map(pkg => (
                                <TouchableOpacity
                                    key={pkg.id}
                                    style={styles.topUpCard}
                                    onPress={() => handleBuyTopUp(pkg.id)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.topUpTurns}>+{pkg.turns}</Text>
                                    <Text style={styles.topUpLabel}>turns</Text>
                                    <Text style={styles.topUpPrice}>{pkg.displayPrice}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Text style={styles.topUpNote}>
                            Top-up turns are added to your balance and expire at month end.
                        </Text>
                    </>
                )}
            </ScrollView>
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
    usageCard: {
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        marginBottom: spacing.xl,
        ...shadows.md,
    },
    usageTitle: {
        color: colors.text.muted,
        fontSize: typography.fontSize.sm,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    usageStats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    usageStat: {
        alignItems: 'center',
    },
    usageValue: {
        color: colors.text.primary,
        fontSize: typography.fontSize.xxl,
        fontWeight: 'bold',
    },
    usageLabel: {
        color: colors.text.muted,
        fontSize: typography.fontSize.xs,
        marginTop: 2,
    },
    usageDivider: {
        width: 1,
        height: 40,
        backgroundColor: colors.border.default,
    },
    bonusText: {
        color: colors.status.success,
        fontSize: typography.fontSize.xs,
        textAlign: 'center',
        marginTop: spacing.sm,
    },
    sectionTitle: {
        color: colors.text.secondary,
        fontSize: typography.fontSize.lg,
        fontWeight: '600',
        marginBottom: spacing.md,
    },
    tierCard: {
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderWidth: 2,
        borderColor: colors.border.default,
    },
    tierCardCurrent: {
        borderColor: colors.primary[500],
    },
    tierCardRecommended: {
        borderColor: colors.gold.main,
    },
    recommendedBadge: {
        position: 'absolute',
        top: -12,
        left: spacing.lg,
        backgroundColor: colors.gold.main,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs / 2,
        borderRadius: borderRadius.sm,
    },
    recommendedText: {
        color: colors.background.primary,
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    tierHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    tierIcon: {
        fontSize: 24,
    },
    tierName: {
        color: colors.text.primary,
        fontSize: typography.fontSize.lg,
        fontWeight: 'bold',
    },
    tierPricing: {
        marginBottom: spacing.md,
    },
    tierPrice: {
        color: colors.text.primary,
        fontSize: typography.fontSize.xl,
        fontWeight: 'bold',
    },
    tierTurns: {
        color: colors.text.muted,
        fontSize: typography.fontSize.sm,
    },
    tierFeatures: {
        gap: spacing.xs,
        marginBottom: spacing.md,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    featureText: {
        color: colors.text.secondary,
        fontSize: typography.fontSize.sm,
    },
    tierButton: {
        backgroundColor: colors.primary[600],
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
    },
    tierButtonCurrent: {
        backgroundColor: colors.background.elevated,
    },
    tierButtonText: {
        color: colors.text.primary,
        fontSize: typography.fontSize.md,
        fontWeight: '600',
    },
    tierButtonTextCurrent: {
        color: colors.text.muted,
    },
    topUpContainer: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    topUpCard: {
        flex: 1,
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    topUpTurns: {
        color: colors.text.primary,
        fontSize: typography.fontSize.xxl,
        fontWeight: 'bold',
    },
    topUpLabel: {
        color: colors.text.muted,
        fontSize: typography.fontSize.xs,
        marginBottom: spacing.xs,
    },
    topUpPrice: {
        color: colors.status.success,
        fontSize: typography.fontSize.lg,
        fontWeight: '600',
    },
    topUpNote: {
        color: colors.text.muted,
        fontSize: typography.fontSize.xs,
        textAlign: 'center',
        marginTop: spacing.sm,
    },
});
