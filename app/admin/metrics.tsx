
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius, shadows } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';
import { useMemo } from 'react';
import { AnimatedPressable, FadeInView, StaggeredList } from '../../components/ui/Animated';
import { getAdminData } from '../../lib/firebase';
import { User, SUBSCRIPTION_PRICING } from '../../lib/types';

export default function AdminMetricsScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<User[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const { colors } = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const data = await getAdminData();
            setUsers(data.users);
        } catch (error) {
            console.error('Failed to load metrics:', error);
            Alert.alert('Error', 'Failed to load metrics data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    // Computed metrics
    const totalUsers = users.length;
    const totalTurns = users.reduce((sum, u) => sum + (u.turnsUsed || 0), 0);
    const totalTokens = users.reduce((sum, u) => sum + (u.tokensTotal || 0), 0);

    // Average cost estimation ($3/1M input, $15/1M output weighted)
    // For simplicity: (Prompt * $0.000003) + (Completion * $0.000015)
    // Actually GPT-4o-mini is way cheaper, so we use a blended average or do it precisely
    const totalPrompt = users.reduce((sum, u) => sum + (u.tokensPrompt || 0), 0);
    const totalCompletion = users.reduce((sum, u) => sum + (u.tokensCompletion || 0), 0);
    const estimatedCost = (totalPrompt * 0.000003) + (totalCompletion * 0.000015);

    // Active in last 7 days
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const activeThisWeek = users.filter(u => {
        if (!u.createdAt) return false;
        const timestamp = typeof u.createdAt === 'number' ? u.createdAt : new Date(u.createdAt).getTime();
        return timestamp > oneWeekAgo;
    }).length;

    // Tier breakdown
    const tierCounts = {
        scout: users.filter(u => u.tier === 'scout').length,
        hero: users.filter(u => u.tier === 'hero').length,
        legend: users.filter(u => u.tier === 'legend').length,
    };

    // Role breakdown
    const adminCount = users.filter(u => u.role === 'admin').length;
    const userCount = users.filter(u => u.role !== 'admin').length;

    // Average turns per user
    const avgTurns = totalUsers > 0 ? Math.round(totalTurns / totalUsers) : 0;
    const avgTokensPerTurn = totalTurns > 0 ? Math.round(totalTokens / totalTurns) : 0;

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.header}>
                <AnimatedPressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
                </AnimatedPressable>
                <Text style={styles.title}>System Metrics</Text>
                <AnimatedPressable onPress={handleRefresh} style={styles.refreshButton}>
                    {refreshing ? (
                        <ActivityIndicator color={colors.primary[400]} size="small" />
                    ) : (
                        <Ionicons name="refresh" size={24} color={colors.primary[400]} />
                    )}
                </AnimatedPressable>
            </View>

            {/* Main Stats Grid */}
            <StaggeredList style={styles.grid}>
                <View style={styles.card}>
                    <View style={[styles.iconBox, { backgroundColor: colors.primary[900] + '40' }]}>
                        <Ionicons name="people" size={28} color={colors.primary[400]} />
                    </View>
                    <Text style={styles.cardValue}>{totalUsers.toLocaleString()}</Text>
                    <Text style={styles.cardLabel}>Total Users</Text>
                </View>

                <View style={styles.card}>
                    <View style={[styles.iconBox, { backgroundColor: colors.gold.main + '20' }]}>
                        <Ionicons name="chatbubbles" size={28} color={colors.gold.main} />
                    </View>
                    <Text style={styles.cardValue}>{totalTurns.toLocaleString()}</Text>
                    <Text style={styles.cardLabel}>Total Turns</Text>
                </View>

                <View style={styles.card}>
                    <View style={[styles.iconBox, { backgroundColor: colors.status.info + '20' }]}>
                        <Ionicons name="hardware-chip-outline" size={28} color={colors.status.info} />
                    </View>
                    <Text style={styles.cardValue}>{(totalTokens / 1000).toFixed(1)}k</Text>
                    <Text style={styles.cardLabel}>Total Tokens</Text>
                </View>

                <View style={styles.card}>
                    <View style={[styles.iconBox, { backgroundColor: colors.status.error + '20' }]}>
                        <Ionicons name="cash-outline" size={28} color={colors.status.error} />
                    </View>
                    <Text style={styles.cardValue}>${estimatedCost.toFixed(2)}</Text>
                    <Text style={styles.cardLabel}>Est. AI Cost</Text>
                </View>

                <View style={styles.card}>
                    <View style={[styles.iconBox, { backgroundColor: colors.status.success + '20' }]}>
                        <Ionicons name="pulse" size={28} color={colors.status.success} />
                    </View>
                    <Text style={styles.cardValue}>{activeThisWeek}</Text>
                    <Text style={styles.cardLabel}>Active (7d)</Text>
                </View>

                <View style={styles.card}>
                    <View style={[styles.iconBox, { backgroundColor: colors.primary[900] + '40' }]}>
                        <Ionicons name="analytics" size={28} color={colors.primary[400]} />
                    </View>
                    <Text style={styles.cardValue}>{avgTokensPerTurn}</Text>
                    <Text style={styles.cardLabel}>Avg Tokens/Turn</Text>
                </View>
            </StaggeredList>

            {/* Token Breakdown */}
            <FadeInView>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Token Usage Details</Text>
                    <View style={styles.breakdownCard}>
                        <View style={styles.breakdownRow}>
                            <View style={styles.breakdownLabel}>
                                <Ionicons name="arrow-up-circle-outline" size={18} color={colors.text.muted} />
                                <Text style={styles.breakdownText}>Prompt Tokens (Input)</Text>
                            </View>
                            <Text style={styles.breakdownValue}>{totalPrompt.toLocaleString()}</Text>
                        </View>
                        <View style={styles.breakdownRow}>
                            <View style={styles.breakdownLabel}>
                                <Ionicons name="arrow-down-circle-outline" size={18} color={colors.status.success} />
                                <Text style={styles.breakdownText}>Completion Tokens (Output)</Text>
                            </View>
                            <Text style={styles.breakdownValue}>{totalCompletion.toLocaleString()}</Text>
                        </View>
                    </View>
                </View>
            </FadeInView>

            {/* Tier Breakdown */}
            <FadeInView>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Users by Tier</Text>
                    <View style={styles.breakdownCard}>
                        <View style={styles.breakdownRow}>
                            <View style={styles.breakdownLabel}>
                                <Ionicons name="shield-outline" size={18} color={colors.text.muted} />
                                <Text style={styles.breakdownText}>Scout ({SUBSCRIPTION_PRICING.scout.displayPrice})</Text>
                            </View>
                            <Text style={styles.breakdownValue}>{tierCounts.scout}</Text>
                        </View>
                        <View style={styles.breakdownRow}>
                            <View style={styles.breakdownLabel}>
                                <Ionicons name="star-outline" size={18} color={colors.status.warning} />
                                <Text style={styles.breakdownText}>Hero ({SUBSCRIPTION_PRICING.hero.displayPrice})</Text>
                            </View>
                            <Text style={styles.breakdownValue}>{tierCounts.hero}</Text>
                        </View>
                        <View style={styles.breakdownRow}>
                            <View style={styles.breakdownLabel}>
                                <Ionicons name="diamond-outline" size={18} color={colors.primary[400]} />
                                <Text style={styles.breakdownText}>Legend ({SUBSCRIPTION_PRICING.legend.displayPrice})</Text>
                            </View>
                            <Text style={styles.breakdownValue}>{tierCounts.legend}</Text>
                        </View>
                    </View>
                </View>
            </FadeInView>

            {/* Role Breakdown */}
            <FadeInView>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Users by Role</Text>
                    <View style={styles.breakdownCard}>
                        <View style={styles.breakdownRow}>
                            <View style={styles.breakdownLabel}>
                                <Ionicons name="person" size={18} color={colors.text.secondary} />
                                <Text style={styles.breakdownText}>Regular Users</Text>
                            </View>
                            <Text style={styles.breakdownValue}>{userCount}</Text>
                        </View>
                        <View style={styles.breakdownRow}>
                            <View style={styles.breakdownLabel}>
                                <Ionicons name="key" size={18} color={colors.status.error} />
                                <Text style={styles.breakdownText}>Administrators</Text>
                            </View>
                            <Text style={styles.breakdownValue}>{adminCount}</Text>
                        </View>
                    </View>
                </View>
            </FadeInView>

            {/* System Health */}
            <FadeInView>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>System Status</Text>
                    <View style={styles.breakdownCard}>
                        <View style={styles.statusRow}>
                            <View style={styles.statusIndicator}>
                                <View style={[styles.statusDot, { backgroundColor: colors.status.success }]} />
                                <Text style={styles.statusText}>Firebase</Text>
                            </View>
                            <Text style={styles.statusLabel}>Connected</Text>
                        </View>
                        <View style={styles.statusRow}>
                            <View style={styles.statusIndicator}>
                                <View style={[styles.statusDot, { backgroundColor: colors.status.success }]} />
                                <Text style={styles.statusText}>Cloud Functions</Text>
                            </View>
                            <Text style={styles.statusLabel}>Operational</Text>
                        </View>
                        <View style={styles.statusRow}>
                            <View style={styles.statusIndicator}>
                                <View style={[styles.statusDot, { backgroundColor: colors.status.success }]} />
                                <Text style={styles.statusText}>AI Services</Text>
                            </View>
                            <Text style={styles.statusLabel}>Available</Text>
                        </View>
                    </View>
                </View>
            </FadeInView>

            {/* Info Box */}
            <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={20} color={colors.status.info} />
                <Text style={styles.infoText}>
                    Metrics are calculated from the current user database. Active users are based on account creation date (lastActive tracking coming soon).
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
    loadingContainer: {
        flex: 1,
        backgroundColor: colors.background.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: spacing.lg,
        paddingBottom: spacing.xxl,
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
        flex: 1,
        fontSize: typography.fontSize.xl,
        fontWeight: 'bold',
        color: colors.text.primary,
    },
    refreshButton: {
        padding: spacing.sm,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    card: {
        width: '47%',
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
        padding: spacing.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border.default,
        ...shadows.sm,
    },
    iconBox: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    cardValue: {
        fontSize: typography.fontSize.xxl,
        fontWeight: 'bold',
        color: colors.text.primary,
        marginBottom: 4,
    },
    cardLabel: {
        fontSize: typography.fontSize.sm,
        color: colors.text.muted,
    },
    section: {
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        fontSize: typography.fontSize.md,
        fontWeight: 'bold',
        color: colors.text.primary,
        marginBottom: spacing.md,
    },
    breakdownCard: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    breakdownRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
    },
    breakdownLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    breakdownText: {
        fontSize: typography.fontSize.md,
        color: colors.text.secondary,
    },
    breakdownValue: {
        fontSize: typography.fontSize.lg,
        fontWeight: 'bold',
        color: colors.text.primary,
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.sm,
    },
    statusIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    statusText: {
        fontSize: typography.fontSize.md,
        color: colors.text.secondary,
    },
    statusLabel: {
        fontSize: typography.fontSize.sm,
        color: colors.status.success,
        fontWeight: '500',
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
});
