
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius, shadows } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';
import { useMemo } from 'react';
import { AnimatedPressable, FadeInView, StaggeredList } from '../../components/ui/Animated';
import { SUBSCRIPTION_LIMITS, TOP_UP_PACKAGES, SUBSCRIPTION_PRICING } from '../../lib/types';

export default function AdminConfigScreen() {
    const router = useRouter();
    const { colors } = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const WORLD_MODULES = useMemo(() => [
        {
            id: 'classic',
            name: 'Classic D&D',
            description: 'Standard 5th Edition rules with traditional fantasy setting',
            icon: 'book' as const,
            color: colors.status.success,
            enabled: true,
        },
        {
            id: 'outworlder',
            name: 'Outworlder (HWFWM)',
            description: 'He Who Fights With Monsters style essence-based system',
            icon: 'sparkles' as const,
            color: colors.status.info,
            enabled: true,
        },
        {
            id: 'shadowMonarch',
            name: 'PRAXIS: Operation Dark Tide',
            description: 'Solo Leveling inspired system with shadow army mechanics',
            icon: 'skull' as const,
            color: colors.gold.main,
            enabled: true,
        },
    ], [colors]);

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.header}>
                <AnimatedPressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
                </AnimatedPressable>
                <Text style={styles.title}>Global Config</Text>
            </View>

            {/* Subscription Tiers */}
            <FadeInView>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Subscription Tiers</Text>
                    <View style={styles.card}>
                        <View style={styles.tierRow}>
                            <View style={styles.tierInfo}>
                                <Ionicons name="shield-outline" size={20} color={colors.text.muted} />
                                <View>
                                    <Text style={styles.tierName}>Scout</Text>
                                    <Text style={styles.tierPrice}>{SUBSCRIPTION_PRICING.scout.displayPrice}</Text>
                                </View>
                            </View>
                            <View style={styles.tierLimit}>
                                <Text style={styles.tierLimitValue}>{SUBSCRIPTION_LIMITS.scout}</Text>
                                <Text style={styles.tierLimitLabel}>turns/mo</Text>
                            </View>
                        </View>

                        <View style={styles.tierRow}>
                            <View style={styles.tierInfo}>
                                <Ionicons name="star" size={20} color={colors.status.warning} />
                                <View>
                                    <Text style={styles.tierName}>Hero</Text>
                                    <Text style={styles.tierPrice}>{SUBSCRIPTION_PRICING.hero.displayPrice}</Text>
                                </View>
                            </View>
                            <View style={styles.tierLimit}>
                                <Text style={styles.tierLimitValue}>{SUBSCRIPTION_LIMITS.hero}</Text>
                                <Text style={styles.tierLimitLabel}>turns/mo</Text>
                            </View>
                        </View>

                        <View style={[styles.tierRow, { borderBottomWidth: 0 }]}>
                            <View style={styles.tierInfo}>
                                <Ionicons name="diamond" size={20} color={colors.primary[400]} />
                                <View>
                                    <Text style={styles.tierName}>Legend</Text>
                                    <Text style={styles.tierPrice}>{SUBSCRIPTION_PRICING.legend.displayPrice}</Text>
                                </View>
                            </View>
                            <View style={styles.tierLimit}>
                                <Text style={styles.tierLimitValue}>∞</Text>
                                <Text style={styles.tierLimitLabel}>unlimited</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </FadeInView>

            {/* Top-Up Packages */}
            <FadeInView>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Top-Up Packages</Text>
                    <View style={styles.card}>
                        {TOP_UP_PACKAGES.map((pkg, index) => (
                            <View
                                key={pkg.id}
                                style={[
                                    styles.packageRow,
                                    index === TOP_UP_PACKAGES.length - 1 && { borderBottomWidth: 0 }
                                ]}
                            >
                                <View style={styles.packageInfo}>
                                    <Ionicons name="flash" size={20} color={colors.gold.main} />
                                    <Text style={styles.packageName}>{pkg.turns} Turns</Text>
                                </View>
                                <Text style={styles.packagePrice}>{pkg.displayPrice}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            </FadeInView>

            {/* World Modules */}
            <FadeInView>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>World Modules</Text>
                    <StaggeredList style={{ gap: spacing.sm }}>
                        {WORLD_MODULES.map((module) => (
                            <View key={module.id} style={styles.moduleCard}>
                                <View style={[styles.moduleIcon, { backgroundColor: module.color + '20' }]}>
                                    <Ionicons name={module.icon} size={24} color={module.color} />
                                </View>
                                <View style={styles.moduleInfo}>
                                    <View style={styles.moduleHeader}>
                                        <Text style={styles.moduleName}>{module.name}</Text>
                                        <View style={[
                                            styles.statusBadge,
                                            { backgroundColor: module.enabled ? colors.status.success + '20' : colors.status.error + '20' }
                                        ]}>
                                            <Text style={[
                                                styles.statusBadgeText,
                                                { color: module.enabled ? colors.status.success : colors.status.error }
                                            ]}>
                                                {module.enabled ? 'ENABLED' : 'DISABLED'}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={styles.moduleDescription}>{module.description}</Text>
                                </View>
                            </View>
                        ))}
                    </StaggeredList>
                </View>
            </FadeInView>

            {/* System Config */}
            <FadeInView>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>System Settings</Text>
                    <View style={styles.card}>
                        <View style={styles.configRow}>
                            <Text style={styles.configLabel}>Maintenance Mode</Text>
                            <View style={[styles.statusBadge, { backgroundColor: colors.status.success + '20' }]}>
                                <Text style={[styles.statusBadgeText, { color: colors.status.success }]}>OFF</Text>
                            </View>
                        </View>
                        <View style={styles.configRow}>
                            <Text style={styles.configLabel}>New Registrations</Text>
                            <View style={[styles.statusBadge, { backgroundColor: colors.status.success + '20' }]}>
                                <Text style={[styles.statusBadgeText, { color: colors.status.success }]}>OPEN</Text>
                            </View>
                        </View>
                        <View style={[styles.configRow, { borderBottomWidth: 0 }]}>
                            <Text style={styles.configLabel}>Debug Logging</Text>
                            <View style={[styles.statusBadge, { backgroundColor: colors.status.warning + '20' }]}>
                                <Text style={[styles.statusBadgeText, { color: colors.status.warning }]}>DEV ONLY</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </FadeInView>

            {/* Info Box */}
            <View style={styles.infoBox}>
                <Ionicons name="code-slash" size={20} color={colors.status.info} />
                <Text style={styles.infoText}>
                    To modify tier limits, pricing, or enable/disable modules, update the configuration in:
                    {'\n'}• <Text style={styles.codePath}>lib/types.ts</Text> (limits & packages)
                    {'\n'}• <Text style={styles.codePath}>functions/src/index.ts</Text> (backend logic)
                    {'\n'}• <Text style={styles.codePath}>app/admin/costs.tsx</Text> (AI model pricing)
                </Text>
            </View>
        </ScrollView>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    content: {
        padding: spacing.lg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    backButton: {
        padding: spacing.sm,
        marginRight: spacing.md,
    },
    title: {
        fontSize: typography.fontSize.xl,
        fontWeight: 'bold',
        color: colors.text.primary,
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        fontSize: typography.fontSize.md,
        fontWeight: 'bold',
        color: colors.text.primary,
        marginBottom: spacing.md,
    },
    card: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    tierRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
    },
    tierInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    tierName: {
        fontSize: typography.fontSize.md,
        fontWeight: '600',
        color: colors.text.primary,
    },
    tierPrice: {
        fontSize: typography.fontSize.sm,
        color: colors.text.muted,
    },
    tierLimit: {
        alignItems: 'flex-end',
    },
    tierLimitValue: {
        fontSize: typography.fontSize.lg,
        fontWeight: 'bold',
        color: colors.primary[400],
    },
    tierLimitLabel: {
        fontSize: typography.fontSize.xs,
        color: colors.text.muted,
    },
    packageRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
    },
    packageInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    packageName: {
        fontSize: typography.fontSize.md,
        color: colors.text.primary,
    },
    packagePrice: {
        fontSize: typography.fontSize.md,
        fontWeight: '600',
        color: colors.gold.main,
    },
    moduleCard: {
        flexDirection: 'row',
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        gap: spacing.md,
    },
    moduleIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    moduleInfo: {
        flex: 1,
    },
    moduleHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: 4,
    },
    moduleName: {
        fontSize: typography.fontSize.md,
        fontWeight: 'bold',
        color: colors.text.primary,
    },
    moduleDescription: {
        fontSize: typography.fontSize.sm,
        color: colors.text.muted,
        lineHeight: 18,
    },
    statusBadge: {
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
        borderRadius: borderRadius.sm,
    },
    statusBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    configRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
    },
    configLabel: {
        fontSize: typography.fontSize.md,
        color: colors.text.secondary,
    },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: colors.primary[900] + '20',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        gap: spacing.md,
        alignItems: 'flex-start',
    },
    infoText: {
        flex: 1,
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
        lineHeight: 20,
    },
    codePath: {
        fontFamily: 'monospace',
        color: colors.primary[400],
    },
});
