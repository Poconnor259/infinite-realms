import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../lib/theme';
import { useTurnsStore, useSettingsStore } from '../../lib/store';
import { TOP_UP_PACKAGES } from '../../lib/types';

interface PaywallProps {
    visible: boolean;
    onClose: () => void;
}

export function Paywall({ visible, onClose }: PaywallProps) {
    const router = useRouter();
    const { tier } = useTurnsStore();
    const { openaiKey, anthropicKey, googleKey } = useSettingsStore();

    const hasByokKeys = !!(openaiKey || anthropicKey || googleKey);

    const handleUpgrade = () => {
        onClose();
        router.push('/subscription');
    };

    const handleBuyTopUp = (packageId: string) => {
        // TODO: Integrate with RevenueCat
        console.log('Buy top-up:', packageId);
    };

    const handleUseBYOK = () => {
        onClose();
        router.push('/settings');
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={styles.container} onPress={e => e.stopPropagation()}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.iconContainer}>
                            <Text style={styles.icon}>⚡</Text>
                        </View>
                        <Text style={styles.title}>Out of Turns!</Text>
                        <Text style={styles.subtitle}>
                            You've used all your turns for this month.
                            Keep playing by upgrading or buying more turns.
                        </Text>
                    </View>

                    {/* Options */}
                    <View style={styles.options}>
                        {/* Upgrade Option */}
                        {tier === 'scout' && (
                            <TouchableOpacity
                                style={styles.upgradeButton}
                                onPress={handleUpgrade}
                                activeOpacity={0.8}
                            >
                                <View style={styles.upgradeContent}>
                                    <Text style={styles.upgradeIcon}>⚔️</Text>
                                    <View style={styles.upgradeText}>
                                        <Text style={styles.upgradeTitle}>Upgrade to Hero</Text>
                                        <Text style={styles.upgradeSubtitle}>500 turns/month • $9.99</Text>
                                    </View>
                                </View>
                                <Ionicons name="arrow-forward" size={20} color={colors.text.primary} />
                            </TouchableOpacity>
                        )}

                        {/* Top-up Options */}
                        <View style={styles.topUpSection}>
                            <Text style={styles.sectionTitle}>Or buy more turns</Text>
                            <View style={styles.topUpOptions}>
                                {TOP_UP_PACKAGES.map(pkg => (
                                    <TouchableOpacity
                                        key={pkg.id}
                                        style={styles.topUpButton}
                                        onPress={() => handleBuyTopUp(pkg.id)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.topUpTurns}>{pkg.turns}</Text>
                                        <Text style={styles.topUpLabel}>turns</Text>
                                        <Text style={styles.topUpPrice}>{pkg.displayPrice}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* BYOK Option */}
                        <TouchableOpacity
                            style={styles.byokButton}
                            onPress={handleUseBYOK}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="key-outline" size={20} color={colors.gold.main} />
                            <Text style={styles.byokText}>
                                {hasByokKeys ? 'Use Your API Keys (Unlimited)' : 'Set Up BYOK for Unlimited'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Close */}
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Text style={styles.closeText}>Maybe Later</Text>
                    </TouchableOpacity>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    container: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.xl,
        width: '100%',
        maxWidth: 400,
        ...shadows.lg,
    },
    header: {
        alignItems: 'center',
        padding: spacing.xl,
        paddingBottom: spacing.lg,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.status.warning + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    icon: {
        fontSize: 32,
    },
    title: {
        color: colors.text.primary,
        fontSize: typography.fontSize.xl,
        fontWeight: 'bold',
        marginBottom: spacing.xs,
    },
    subtitle: {
        color: colors.text.muted,
        fontSize: typography.fontSize.sm,
        textAlign: 'center',
        lineHeight: typography.fontSize.sm * typography.lineHeight.relaxed,
    },
    options: {
        padding: spacing.lg,
        paddingTop: 0,
        gap: spacing.md,
    },
    upgradeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.primary[600],
        padding: spacing.md,
        borderRadius: borderRadius.lg,
    },
    upgradeContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    upgradeIcon: {
        fontSize: 24,
    },
    upgradeText: {
        gap: 2,
    },
    upgradeTitle: {
        color: colors.text.primary,
        fontSize: typography.fontSize.md,
        fontWeight: '600',
    },
    upgradeSubtitle: {
        color: colors.text.secondary,
        fontSize: typography.fontSize.xs,
    },
    topUpSection: {
        gap: spacing.sm,
    },
    sectionTitle: {
        color: colors.text.muted,
        fontSize: typography.fontSize.xs,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    topUpOptions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    topUpButton: {
        flex: 1,
        backgroundColor: colors.background.tertiary,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    topUpTurns: {
        color: colors.text.primary,
        fontSize: typography.fontSize.xl,
        fontWeight: 'bold',
    },
    topUpLabel: {
        color: colors.text.muted,
        fontSize: typography.fontSize.xs,
        marginBottom: spacing.xs,
    },
    topUpPrice: {
        color: colors.status.success,
        fontSize: typography.fontSize.md,
        fontWeight: '600',
    },
    byokButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: colors.gold.main + '10',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.gold.main + '30',
    },
    byokText: {
        color: colors.gold.main,
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    closeButton: {
        padding: spacing.lg,
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: colors.border.default,
    },
    closeText: {
        color: colors.text.muted,
        fontSize: typography.fontSize.md,
    },
});
