/**
 * User Analytics Component
 * 
 * Shows personal statistics for the current user
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';
import { useAuth } from '../../lib/hooks/useAuth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface UserStats {
    totalTurns: number;
    turnsUsed: number;
    turnsRemaining: number;
    tokensTotal: number;
    tokensPrompt: number;
    tokensCompletion: number;
    campaignsCreated: number;
    questsCompleted: number;
    diceRolls: {
        total: number;
        criticalSuccesses: number;
        criticalFailures: number;
        averageRoll: number;
    };
    sessionTime: number; // in minutes
    tier: string;
}

export function UserAnalytics() {
    const { colors } = useThemeColors();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<UserStats | null>(null);

    useEffect(() => {
        loadStats();
    }, [user]);

    const loadStats = async () => {
        if (!user) return;

        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            const userData = userDoc.data();

            if (userData) {
                setStats({
                    totalTurns: userData.turns || 0,
                    turnsUsed: userData.turnsUsed || 0,
                    turnsRemaining: (userData.turns || 0) - (userData.turnsUsed || 0),
                    tokensTotal: userData.tokensTotal || 0,
                    tokensPrompt: userData.tokensPrompt || 0,
                    tokensCompletion: userData.tokensCompletion || 0,
                    campaignsCreated: userData.campaignsCreated || 0,
                    questsCompleted: userData.questsCompleted || 0,
                    diceRolls: userData.diceRolls || {
                        total: 0,
                        criticalSuccesses: 0,
                        criticalFailures: 0,
                        averageRoll: 0,
                    },
                    sessionTime: userData.sessionTime || 0,
                    tier: userData.tier || 'scout',
                });
            }
        } catch (error) {
            console.error('[UserAnalytics] Failed to load stats:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
            </View>
        );
    }

    if (!stats) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
                <Text style={[styles.errorText, { color: colors.text.muted }]}>
                    No statistics available
                </Text>
            </View>
        );
    }

    const questCompletionRate = stats.campaignsCreated > 0
        ? Math.round((stats.questsCompleted / stats.campaignsCreated) * 100)
        : 0;

    const critSuccessRate = stats.diceRolls.total > 0
        ? Math.round((stats.diceRolls.criticalSuccesses / stats.diceRolls.total) * 100)
        : 0;

    const critFailureRate = stats.diceRolls.total > 0
        ? Math.round((stats.diceRolls.criticalFailures / stats.diceRolls.total) * 100)
        : 0;

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.background.primary }]}>
            <View style={styles.content}>
                <Text style={[styles.title, { color: colors.text.primary }]}>
                    Your Statistics
                </Text>

                {/* Turn Usage */}
                <View style={[styles.section, { backgroundColor: colors.background.secondary }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
                        Turn Usage
                    </Text>
                    <View style={styles.statsGrid}>
                        <StatCard
                            icon="chatbubbles"
                            label="Turns Used"
                            value={stats.turnsUsed.toLocaleString()}
                            color={colors.primary[500]}
                        />
                        <StatCard
                            icon="hourglass"
                            label="Remaining"
                            value={stats.turnsRemaining.toLocaleString()}
                            color={colors.status.success}
                        />
                    </View>
                    <View style={styles.progressBar}>
                        <View
                            style={[
                                styles.progressFill,
                                {
                                    backgroundColor: colors.primary[500],
                                    width: `${(stats.turnsUsed / stats.totalTurns) * 100}%`,
                                },
                            ]}
                        />
                    </View>
                    <Text style={[styles.progressText, { color: colors.text.muted }]}>
                        {stats.turnsUsed} / {stats.totalTurns} turns ({Math.round((stats.turnsUsed / stats.totalTurns) * 100)}%)
                    </Text>
                </View>

                {/* Session Stats */}
                <View style={[styles.section, { backgroundColor: colors.background.secondary }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
                        Session Stats
                    </Text>
                    <View style={styles.statsGrid}>
                        <StatCard
                            icon="time"
                            label="Play Time"
                            value={`${Math.round(stats.sessionTime / 60)}h`}
                            color={colors.gold.main}
                        />
                        <StatCard
                            icon="game-controller"
                            label="Campaigns"
                            value={stats.campaignsCreated.toString()}
                            color={colors.status.info}
                        />
                    </View>
                </View>

                {/* Quest Stats */}
                <View style={[styles.section, { backgroundColor: colors.background.secondary }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
                        Quest Performance
                    </Text>
                    <View style={styles.statsGrid}>
                        <StatCard
                            icon="checkmark-circle"
                            label="Completed"
                            value={stats.questsCompleted.toString()}
                            color={colors.status.success}
                        />
                        <StatCard
                            icon="trending-up"
                            label="Completion Rate"
                            value={`${questCompletionRate}%`}
                            color={colors.primary[500]}
                        />
                    </View>
                </View>

                {/* Dice Roll Stats */}
                <View style={[styles.section, { backgroundColor: colors.background.secondary }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
                        Dice Roll Statistics
                    </Text>
                    <View style={styles.statsGrid}>
                        <StatCard
                            icon="dice"
                            label="Total Rolls"
                            value={stats.diceRolls.total.toLocaleString()}
                            color={colors.text.primary}
                        />
                        <StatCard
                            icon="analytics"
                            label="Average Roll"
                            value={stats.diceRolls.averageRoll.toFixed(1)}
                            color={colors.status.info}
                        />
                    </View>
                    <View style={styles.statsGrid}>
                        <StatCard
                            icon="star"
                            label="Critical Success"
                            value={`${critSuccessRate}%`}
                            color={colors.status.success}
                            subtitle={`${stats.diceRolls.criticalSuccesses} rolls`}
                        />
                        <StatCard
                            icon="close-circle"
                            label="Critical Failure"
                            value={`${critFailureRate}%`}
                            color={colors.status.error}
                            subtitle={`${stats.diceRolls.criticalFailures} rolls`}
                        />
                    </View>
                </View>

                {/* Token Usage */}
                <View style={[styles.section, { backgroundColor: colors.background.secondary }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
                        AI Token Usage
                    </Text>
                    <View style={styles.statsGrid}>
                        <StatCard
                            icon="hardware-chip"
                            label="Total Tokens"
                            value={`${(stats.tokensTotal / 1000).toFixed(1)}k`}
                            color={colors.primary[500]}
                        />
                        <StatCard
                            icon="arrow-up-circle"
                            label="Prompt"
                            value={`${(stats.tokensPrompt / 1000).toFixed(1)}k`}
                            color={colors.text.muted}
                        />
                    </View>
                </View>
            </View>
        </ScrollView>
    );
}

interface StatCardProps {
    icon: string;
    label: string;
    value: string;
    color: string;
    subtitle?: string;
}

function StatCard({ icon, label, value, color, subtitle }: StatCardProps) {
    const { colors } = useThemeColors();

    return (
        <View style={[styles.statCard, { backgroundColor: colors.background.tertiary }]}>
            <Ionicons name={icon as any} size={24} color={color} />
            <Text style={[styles.statValue, { color: colors.text.primary }]}>
                {value}
            </Text>
            <Text style={[styles.statLabel, { color: colors.text.muted }]}>
                {label}
            </Text>
            {subtitle && (
                <Text style={[styles.statSubtitle, { color: colors.text.muted }]}>
                    {subtitle}
                </Text>
            )}
        </View>
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
        marginBottom: spacing.lg,
    },
    section: {
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: 'bold',
        marginBottom: spacing.md,
    },
    statsGrid: {
        flexDirection: 'row',
        gap: spacing.md,
        marginBottom: spacing.sm,
    },
    statCard: {
        flex: 1,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        alignItems: 'center',
    },
    statValue: {
        fontSize: typography.fontSize.xl,
        fontWeight: 'bold',
        marginTop: spacing.xs,
    },
    statLabel: {
        fontSize: typography.fontSize.sm,
        marginTop: 2,
        textAlign: 'center',
    },
    statSubtitle: {
        fontSize: typography.fontSize.xs,
        marginTop: 2,
    },
    progressBar: {
        height: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 4,
        overflow: 'hidden',
        marginTop: spacing.sm,
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
    },
    progressText: {
        fontSize: typography.fontSize.sm,
        marginTop: spacing.xs,
        textAlign: 'center',
    },
    errorText: {
        fontSize: typography.fontSize.md,
        textAlign: 'center',
    },
});
