
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../lib/theme';
import { AnimatedPressable, FadeInView, StaggeredList } from '../../components/ui/Animated';
import { getAllUsers } from '../../lib/firebase';
import { User } from '../../lib/types';
import { useSettingsStore } from '../../lib/store';

// Actual Pricing (as of Dec 2024)
// Brain: GPT-4o-mini - $0.15/1M in, $0.60/1M out
// Voice: Claude Sonnet 4 - $3/1M in, $15/1M out
// Per turn: ~$0.0005 (Brain) + ~$0.021 (Voice) = ~$0.0215 total
const DEFAULT_COST_PER_1K_TURNS = 21.50; // $0.0215 per turn × 1000
const AVG_TOKENS_PER_TURN = 3400; // ~2500 in + ~900 out (total for both models)

export default function AdminCostsScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<User[]>([]);

    // Calculator States
    const [costPer1kTurns, setCostPer1kTurns] = useState('21.50'); // Based on actual model costs
    const [firebaseCostPerUser, setFirebaseCostPerUser] = useState('0.005'); // Est daily cost per active user

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const userList = await getAllUsers();
            setUsers(userList);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to load usage data');
        } finally {
            setLoading(false);
        }
    };

    // Computations
    const totalTurns = users.reduce((sum, u) => sum + (u.turnsUsed || 0), 0);
    const totalUsers = users.length;

    // 30-day Active Users (approximation based on lastActive if we had it, for now all users)
    // Real app would filter by lastActive date
    const oneMonthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const activeUsers = users; // users.filter(u => u.lastActive > oneMonthAgo); 

    const estimatedAiCost = (totalTurns / 1000) * parseFloat(costPer1kTurns || '0');
    const estimatedDbCost = activeUsers.length * parseFloat(firebaseCostPerUser || '0') * 30; // Monthly
    const totalEstimatedCost = estimatedAiCost + estimatedDbCost;

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
                <Text style={styles.title}>Usage & Cost Estimator</Text>
            </View>

            {/* Total Estimated Bill */}
            <FadeInView>
                <View style={styles.grandTotalCard}>
                    <Text style={styles.grandTotalLabel}>Estimated Monthly Burn</Text>
                    <Text style={styles.grandTotalValue}>
                        ${totalEstimatedCost.toFixed(2)}
                    </Text>
                    <Text style={styles.grandTotalSub}>
                        Based on {totalTurns.toLocaleString()} turns & {users.length} users
                    </Text>
                </View>
            </FadeInView>

            {/* Detailed Metrics */}
            <StaggeredList style={styles.grid}>
                <View style={styles.card}>
                    <View style={[styles.iconBox, { backgroundColor: colors.primary[900] + '40' }]}>
                        <Ionicons name="chatbubbles" size={24} color={colors.primary[400]} />
                    </View>
                    <Text style={styles.cardLabel}>Total Turns</Text>
                    <Text style={styles.cardValue}>{totalTurns.toLocaleString()}</Text>
                </View>

                <View style={styles.card}>
                    <View style={[styles.iconBox, { backgroundColor: colors.gold.main + '20' }]}>
                        <Ionicons name="people" size={24} color={colors.gold.main} />
                    </View>
                    <Text style={styles.cardLabel}>Total Users</Text>
                    <Text style={styles.cardValue}>{totalUsers.toLocaleString()}</Text>
                </View>
            </StaggeredList>

            {/* Calculator Settings */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Pricing Assumptions</Text>

                <View style={styles.settingRow}>
                    <View>
                        <Text style={styles.settingLabel}>AI Cost per 1,000 Turns ($)</Text>
                        <Text style={styles.settingSub}>Avg blended inference cost</Text>
                    </View>
                    <TextInput
                        style={styles.input}
                        value={costPer1kTurns}
                        onChangeText={setCostPer1kTurns}
                        keyboardType="numeric"
                    />
                </View>

                <View style={styles.settingRow}>
                    <View>
                        <Text style={styles.settingLabel}>DB Cost per User per Day ($)</Text>
                        <Text style={styles.settingSub}>Firebase reads/writes/storage</Text>
                    </View>
                    <TextInput
                        style={styles.input}
                        value={firebaseCostPerUser}
                        onChangeText={setFirebaseCostPerUser}
                        keyboardType="numeric"
                    />
                </View>
            </View>

            <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={20} color={colors.status.info} />
                <Text style={styles.infoText}>
                    Using GPT-4o-mini (Brain) + Claude Sonnet 4 (Voice). Cost per turn: ~$0.0215.
                    {'\n'}Scout (15 turns): ~$0.32 | Hero (300 turns): ~$6.45
                </Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
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
    grandTotalCard: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: spacing.xl,
        alignItems: 'center',
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: colors.primary[900],
        ...shadows.lg,
    },
    grandTotalLabel: {
        fontSize: typography.fontSize.sm,
        color: colors.text.muted,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: spacing.xs,
    },
    grandTotalValue: {
        fontSize: 48,
        fontWeight: 'bold',
        color: colors.primary[400],
        marginBottom: spacing.xs,
    },
    grandTotalSub: {
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
    },
    grid: {
        flexDirection: 'row',
        gap: spacing.md,
        marginBottom: spacing.xl,
    },
    card: {
        flex: 1,
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border.default,
        alignItems: 'center',
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    cardLabel: {
        fontSize: typography.fontSize.sm,
        color: colors.text.muted,
        marginBottom: 4,
    },
    cardValue: {
        fontSize: typography.fontSize.xl,
        fontWeight: 'bold',
        color: colors.text.primary,
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
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.background.secondary,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    settingLabel: {
        fontSize: typography.fontSize.md,
        color: colors.text.primary,
        fontWeight: '500',
    },
    settingSub: {
        fontSize: typography.fontSize.xs,
        color: colors.text.muted,
    },
    input: {
        backgroundColor: colors.background.primary,
        color: colors.text.primary,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.sm,
        width: 80,
        textAlign: 'right',
        borderWidth: 1,
        borderColor: colors.border.default,
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
