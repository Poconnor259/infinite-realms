import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius, shadows } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';
import { useMemo } from 'react';
import { AnimatedPressable, FadeInView, StaggeredList } from '../../components/ui/Animated';
import { getAdminData, getModelPricing, refreshModelPricing, updateModelPricing } from '../../lib/firebase';
import { User, ModelTokenUsage } from '../../lib/types';
import { useSettingsStore } from '../../lib/store';

export default function AdminCostsScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<User[]>([]);
    const [dailyStats, setDailyStats] = useState<any[]>([]);
    const { colors } = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    // Model Pricing (fetched from Firestore)
    const [modelPricing, setModelPricing] = useState({
        gpt4oMini: { prompt: 0.15, completion: 0.60 },
        claude: { prompt: 3.00, completion: 15.00 },
    });

    // Pricing edit state
    const [pricing, setPricing] = useState({
        gpt4oMini: { prompt: 0.15, completion: 0.60 },
        claude: { prompt: 3.00, completion: 15.00 },
    });
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);

    // Calculator States
    const [firebaseCostPerUser, setFirebaseCostPerUser] = useState('0.005'); // Est daily cost per active user

    // Pricing handlers
    const handleRefreshPricing = async () => {
        setRefreshing(true);
        try {
            const result = await refreshModelPricing();
            if (result.data && result.data.pricing) {
                setPricing(result.data.pricing);
                setModelPricing(result.data.pricing);
                Alert.alert('Success', 'Pricing refreshed from latest values');
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to refresh pricing');
        } finally {
            setRefreshing(false);
        }
    };

    const handleSavePricing = async () => {
        setSaving(true);
        try {
            await updateModelPricing(pricing);
            setModelPricing(pricing);
            Alert.alert('Success', 'Pricing saved successfully');
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to save pricing');
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [adminData, pricing] = await Promise.all([
                getAdminData(),
                getModelPricing()
            ]);

            setUsers(adminData.users);
            setDailyStats(adminData.dailyStats);

            if (pricing.data) {
                setModelPricing(pricing.data);
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to load usage data');
        } finally {
            setLoading(false);
        }
    };

    // Aggregate per-model tokens across all users
    const aggregateModelTokens = () => {
        const gpt4oMini: ModelTokenUsage = { prompt: 0, completion: 0, total: 0 };
        const claude: ModelTokenUsage = { prompt: 0, completion: 0, total: 0 };

        users.forEach(user => {
            if (user.tokens?.gpt4oMini) {
                gpt4oMini.prompt += user.tokens.gpt4oMini.prompt || 0;
                gpt4oMini.completion += user.tokens.gpt4oMini.completion || 0;
                gpt4oMini.total += user.tokens.gpt4oMini.total || 0;
            }
            if (user.tokens?.claude) {
                claude.prompt += user.tokens.claude.prompt || 0;
                claude.completion += user.tokens.claude.completion || 0;
                claude.total += user.tokens.claude.total || 0;
            }
        });

        return { gpt4oMini, claude };
    };

    const modelTokens = aggregateModelTokens();

    // Calculate costs per model
    const gpt4oMiniCost = (
        (modelTokens.gpt4oMini.prompt / 1_000_000) * modelPricing.gpt4oMini.prompt +
        (modelTokens.gpt4oMini.completion / 1_000_000) * modelPricing.gpt4oMini.completion
    );

    const claudeCost = (
        (modelTokens.claude.prompt / 1_000_000) * modelPricing.claude.prompt +
        (modelTokens.claude.completion / 1_000_000) * modelPricing.claude.completion
    );

    const totalAiCost = gpt4oMiniCost + claudeCost;

    // Legacy calculations for backward compatibility
    const totalTurns = users.reduce((sum, u) => sum + (u.turnsUsed || 0), 0);
    const totalPromptTokens = users.reduce((sum, u) => sum + (u.tokensPrompt || 0), 0);
    const totalCompletionTokens = users.reduce((sum, u) => sum + (u.tokensCompletion || 0), 0);
    const totalTokensTracked = users.reduce((sum, u) => sum + (u.tokensTotal || 0), 0);
    const totalUsers = users.length;

    // Temporal Token Aggregation
    const todayStr = new Date().toISOString().split('T')[0];
    const todayStats = dailyStats.find(s => s.date === todayStr);

    const tokensToday = todayStats?.tokensTotal || 0;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const lastWeekStats = dailyStats.filter(s => new Date(s.date) >= oneWeekAgo);
    const tokensWeek = lastWeekStats.reduce((sum, s) => sum + (s.tokensTotal || 0), 0);

    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    const lastMonthStats = dailyStats.filter(s => new Date(s.date) >= oneMonthAgo);
    const tokensMonth = lastMonthStats.reduce((sum, s) => sum + (s.tokensTotal || 0), 0);

    const estimatedDbCost = totalUsers * parseFloat(firebaseCostPerUser || '0') * 30; // Monthly
    const totalEstimatedCost = totalAiCost + estimatedDbCost;

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

                <View style={styles.card}>
                    <View style={[styles.iconBox, { backgroundColor: colors.status.info + '20' }]}>
                        <Ionicons name="stats-chart" size={24} color={colors.status.info} />
                    </View>
                    <Text style={styles.cardLabel}>Total Tokens</Text>
                    <Text style={styles.cardValue}>{(totalTokensTracked / 1000).toFixed(1)}k</Text>
                </View>
            </StaggeredList>

            {/* Temporal Tokens */}
            <View style={styles.temporalSection}>
                <View style={styles.temporalCard}>
                    <Text style={styles.temporalLabel}>Today</Text>
                    <Text style={styles.temporalValue}>{(tokensToday / 1000).toFixed(1)}k</Text>
                </View>
                <View style={styles.temporalCard}>
                    <Text style={styles.temporalLabel}>Past 7d</Text>
                    <Text style={styles.temporalValue}>{(tokensWeek / 1000).toFixed(1)}k</Text>
                </View>
                <View style={styles.temporalCard}>
                    <Text style={styles.temporalLabel}>Past 30d</Text>
                    <Text style={styles.temporalValue}>{(tokensMonth / 1000).toFixed(1)}k</Text>
                </View>
            </View>

            {/* Per-Model Token Breakdown */}
            <FadeInView style={styles.breakdownCard}>
                <Text style={styles.breakdownTitle}>Token Usage by Model</Text>

                {/* GPT-4o-mini */}
                <View style={styles.modelSection}>
                    <View style={styles.modelHeader}>
                        <Ionicons name="flash" size={18} color={colors.status.success} />
                        <Text style={styles.modelName}>GPT-4o-mini (Brain + Text Gen)</Text>
                    </View>
                    <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Prompt</Text>
                        <Text style={styles.breakdownValue}>{modelTokens.gpt4oMini.prompt.toLocaleString()}</Text>
                    </View>
                    <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Completion</Text>
                        <Text style={styles.breakdownValue}>{modelTokens.gpt4oMini.completion.toLocaleString()}</Text>
                    </View>
                    <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabelBold}>Cost</Text>
                        <Text style={styles.breakdownValueBold}>${gpt4oMiniCost.toFixed(4)}</Text>
                    </View>
                </View>

                <View style={styles.divider} />

                {/* Claude */}
                <View style={styles.modelSection}>
                    <View style={styles.modelHeader}>
                        <Ionicons name="sparkles" size={18} color={colors.primary[400]} />
                        <Text style={styles.modelName}>Claude Sonnet 3.5 (Voice)</Text>
                    </View>
                    <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Prompt</Text>
                        <Text style={styles.breakdownValue}>{modelTokens.claude.prompt.toLocaleString()}</Text>
                    </View>
                    <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Completion</Text>
                        <Text style={styles.breakdownValue}>{modelTokens.claude.completion.toLocaleString()}</Text>
                    </View>
                    <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabelBold}>Cost</Text>
                        <Text style={styles.breakdownValueBold}>${claudeCost.toFixed(4)}</Text>
                    </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabelBold}>Total AI Cost</Text>
                    <Text style={[styles.breakdownValueBold, { color: colors.primary[400], fontSize: typography.fontSize.lg }]}>${totalAiCost.toFixed(4)}</Text>
                </View>
            </FadeInView>

            {/* Calculator Settings */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Pricing Assumptions</Text>

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

            {/* AI Model Pricing Configuration */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>AI Model Pricing</Text>
                <View style={styles.card}>
                    <Text style={[styles.settingLabel, { marginBottom: spacing.md }]}>
                        Configure pricing per 1M tokens (used for cost calculations)
                    </Text>

                    {/* GPT-4o-mini */}
                    <View style={styles.pricingModelSection}>
                        <View style={styles.pricingModelHeader}>
                            <Ionicons name="flash" size={20} color={colors.status.success} />
                            <Text style={styles.pricingModelName}>GPT-4o-mini</Text>
                            <Text style={styles.pricingModelSubtext}>(Brain + Text Generation)</Text>
                        </View>
                        <View style={styles.pricingInputRow}>
                            <View style={styles.pricingInputGroup}>
                                <Text style={styles.pricingInputLabel}>Prompt</Text>
                                <View style={styles.pricingInputWrapper}>
                                    <Text style={styles.pricingInputPrefix}>$</Text>
                                    <TextInput
                                        style={[styles.pricingInput, { color: colors.text.primary }]}
                                        value={pricing.gpt4oMini.prompt.toString()}
                                        onChangeText={(v) => setPricing({
                                            ...pricing,
                                            gpt4oMini: { ...pricing.gpt4oMini, prompt: parseFloat(v) || 0 }
                                        })}
                                        keyboardType="decimal-pad"
                                        placeholder="0.15"
                                        placeholderTextColor={colors.text.muted}
                                    />
                                </View>
                            </View>
                            <View style={styles.pricingInputGroup}>
                                <Text style={styles.pricingInputLabel}>Completion</Text>
                                <View style={styles.pricingInputWrapper}>
                                    <Text style={styles.pricingInputPrefix}>$</Text>
                                    <TextInput
                                        style={[styles.pricingInput, { color: colors.text.primary }]}
                                        value={pricing.gpt4oMini.completion.toString()}
                                        onChangeText={(v) => setPricing({
                                            ...pricing,
                                            gpt4oMini: { ...pricing.gpt4oMini, completion: parseFloat(v) || 0 }
                                        })}
                                        keyboardType="decimal-pad"
                                        placeholder="0.60"
                                        placeholderTextColor={colors.text.muted}
                                    />
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Claude */}
                    <View style={[styles.pricingModelSection, { borderBottomWidth: 0 }]}>
                        <View style={styles.pricingModelHeader}>
                            <Ionicons name="sparkles" size={20} color={colors.primary[400]} />
                            <Text style={styles.pricingModelName}>Claude Sonnet 3.5</Text>
                            <Text style={styles.pricingModelSubtext}>(Voice/Narrator)</Text>
                        </View>
                        <View style={styles.pricingInputRow}>
                            <View style={styles.pricingInputGroup}>
                                <Text style={styles.pricingInputLabel}>Prompt</Text>
                                <View style={styles.pricingInputWrapper}>
                                    <Text style={styles.pricingInputPrefix}>$</Text>
                                    <TextInput
                                        style={[styles.pricingInput, { color: colors.text.primary }]}
                                        value={pricing.claude.prompt.toString()}
                                        onChangeText={(v) => setPricing({
                                            ...pricing,
                                            claude: { ...pricing.claude, prompt: parseFloat(v) || 0 }
                                        })}
                                        keyboardType="decimal-pad"
                                        placeholder="3.00"
                                        placeholderTextColor={colors.text.muted}
                                    />
                                </View>
                            </View>
                            <View style={styles.pricingInputGroup}>
                                <Text style={styles.pricingInputLabel}>Completion</Text>
                                <View style={styles.pricingInputWrapper}>
                                    <Text style={styles.pricingInputPrefix}>$</Text>
                                    <TextInput
                                        style={[styles.pricingInput, { color: colors.text.primary }]}
                                        value={pricing.claude.completion.toString()}
                                        onChangeText={(v) => setPricing({
                                            ...pricing,
                                            claude: { ...pricing.claude, completion: parseFloat(v) || 0 }
                                        })}
                                        keyboardType="decimal-pad"
                                        placeholder="15.00"
                                        placeholderTextColor={colors.text.muted}
                                    />
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.pricingActions}>
                        <TouchableOpacity
                            style={[styles.pricingButton, styles.pricingButtonSecondary, { borderColor: colors.border.default }]}
                            onPress={handleRefreshPricing}
                            disabled={refreshing}
                        >
                            {refreshing ? (
                                <ActivityIndicator size="small" color={colors.text.secondary} />
                            ) : (
                                <Ionicons name="refresh" size={18} color={colors.text.secondary} />
                            )}
                            <Text style={[styles.pricingButtonText, { color: colors.text.secondary }]}>
                                {refreshing ? 'Refreshing...' : 'Refresh from Latest'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.pricingButton, styles.pricingButtonPrimary, { backgroundColor: colors.primary[500] }]}
                            onPress={handleSavePricing}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Ionicons name="save" size={18} color="#fff" />
                            )}
                            <Text style={[styles.pricingButtonText, { color: '#fff' }]}>
                                {saving ? 'Saving...' : 'Save Pricing'}
                            </Text>
                        </TouchableOpacity>
                    </View>
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
    breakdownCard: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
        padding: spacing.lg,
        marginBottom: spacing.xl,
        borderWidth: 1,
        borderColor: colors.primary[900] + '40',
    },
    breakdownTitle: {
        fontSize: typography.fontSize.md,
        fontWeight: 'bold',
        color: colors.text.primary,
        marginBottom: spacing.md,
    },
    breakdownRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.xs,
    },
    breakdownLabel: {
        fontSize: typography.fontSize.sm,
        color: colors.text.muted,
    },
    breakdownValue: {
        fontSize: typography.fontSize.sm,
        color: colors.text.primary,
        fontFamily: 'monospace',
    },
    divider: {
        height: 1,
        backgroundColor: colors.border.default,
        marginVertical: spacing.sm,
    },
    breakdownLabelBold: {
        fontSize: typography.fontSize.sm,
        fontWeight: 'bold',
        color: colors.text.primary,
    },
    breakdownValueBold: {
        fontSize: typography.fontSize.md,
        fontWeight: 'bold',
        color: colors.primary[400],
    },
    temporalSection: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    temporalCard: {
        flex: 1,
        backgroundColor: colors.background.secondary,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        alignItems: 'center',
    },
    temporalLabel: {
        fontSize: typography.fontSize.xs,
        color: colors.text.muted,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    temporalValue: {
        fontSize: typography.fontSize.md,
        fontWeight: 'bold',
        color: colors.text.primary,
    },
    modelSection: {
        marginBottom: spacing.md,
    },
    modelHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.sm,
    },
    modelName: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
        color: colors.text.primary,
    },
    // Pricing Configuration Styles
    pricingModelSection: {
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
    },
    pricingModelHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    pricingModelName: {
        fontSize: typography.fontSize.md,
        fontWeight: 'bold',
        color: colors.text.primary,
    },
    pricingModelSubtext: {
        fontSize: typography.fontSize.sm,
        color: colors.text.muted,
    },
    pricingInputRow: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    pricingInputGroup: {
        flex: 1,
    },
    pricingInputLabel: {
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
        marginBottom: spacing.xs,
    },
    pricingInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.primary,
        borderWidth: 1,
        borderColor: colors.border.default,
        borderRadius: borderRadius.sm,
        paddingHorizontal: spacing.sm,
    },
    pricingInputPrefix: {
        fontSize: typography.fontSize.md,
        color: colors.text.muted,
        marginRight: spacing.xs,
    },
    pricingInput: {
        flex: 1,
        fontSize: typography.fontSize.md,
        paddingVertical: spacing.sm,
    },
    pricingActions: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    pricingButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
    },
    pricingButtonSecondary: {
        backgroundColor: 'transparent',
        borderWidth: 1,
    },
    pricingButtonPrimary: {
        // backgroundColor set inline
    },
    pricingButtonText: {
        fontSize: typography.fontSize.md,
        fontWeight: '600',
    },
});
