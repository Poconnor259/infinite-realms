import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius, shadows } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';
import { useMemo } from 'react';
import { AnimatedPressable, FadeInView, StaggeredList } from '../../components/ui/Animated';
import { getAdminData, getModelPricing, refreshModelPricing, updateModelPricing, getAvailableModels, db } from '../../lib/firebase';
import { User, ModelTokenUsage, AVAILABLE_MODELS, ModelDefinition } from '../../lib/types';
import { useSettingsStore } from '../../lib/store';
import { doc, getDoc } from 'firebase/firestore';

export default function AdminCostsScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<User[]>([]);
    const [dailyStats, setDailyStats] = useState<any[]>([]);
    const { colors } = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    // Model Pricing (fetched from Firestore)
    const [modelPricing, setModelPricing] = useState<Record<string, { prompt: number, completion: number }>>({});

    // Dynamic Model List
    const [availableModels, setAvailableModels] = useState<ModelDefinition[]>(AVAILABLE_MODELS);

    // AI Settings (to know what is active)
    const [aiSettings, setAiSettings] = useState({
        brainModel: 'gpt-4o-mini',
        voiceModel: 'claude-3-5-sonnet',
    });

    // Pricing edit state
    const [selectedModelId, setSelectedModelId] = useState<string>(AVAILABLE_MODELS[0].id);
    const [editingPricing, setEditingPricing] = useState({ prompt: '0', completion: '0' });

    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [refreshingModels, setRefreshingModels] = useState(false); // For model list refresh

    const [modelDropdownOpen, setModelDropdownOpen] = useState(false);


    // Calculator States
    const [firebaseCostPerUser, setFirebaseCostPerUser] = useState('0.005'); // Est daily cost per active user

    // Pricing handlers
    const handleRefreshPricing = async () => {
        setRefreshing(true);
        try {
            // 1. Refresh Model List
            const modelsResult = await getAvailableModels();
            if (modelsResult.data?.models) {
                setAvailableModels(modelsResult.data.models);
            }

            // 2. Refresh Pricing
            const result = await refreshModelPricing();
            if (result.data && result.data.pricing) {
                setModelPricing(result.data.pricing);
                Alert.alert('Success', 'Pricing & Models refreshed');
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to refresh data');
        } finally {
            setRefreshing(false);
        }
    };

    // Update editing inputs when selection changes or pricing loads
    useEffect(() => {
        const price = modelPricing[selectedModelId] || availableModels.find(m => m.id === selectedModelId)?.defaultPricing || { prompt: 0, completion: 0 };
        setEditingPricing({
            prompt: price.prompt.toString(),
            completion: price.completion.toString()
        });
    }, [selectedModelId, modelPricing, availableModels]);

    const handleSavePricing = async () => {
        setSaving(true);
        try {
            const updatedPricing = {
                ...modelPricing,
                [selectedModelId]: {
                    prompt: parseFloat(editingPricing.prompt) || 0,
                    completion: parseFloat(editingPricing.completion) || 0
                }
            };

            await updateModelPricing(updatedPricing);
            setModelPricing(updatedPricing);
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

            // Load AI Settings
            try {
                const docRef = doc(db, 'config', 'aiSettings');
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    setAiSettings(snap.data() as any);
                }
            } catch (e) {
                console.error('Failed to load AI settings', e);
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to load usage data');
        } finally {
            setLoading(false);
        }
    };

    // Aggregate tokens dynamically
    const aggregateModelTokens = () => {
        const tokens: Record<string, ModelTokenUsage> = {};

        // Initialize for known models
        availableModels.forEach(m => {
            tokens[m.id] = { prompt: 0, completion: 0, total: 0 };
        });

        users.forEach(user => {
            if (user.tokens) {
                Object.entries(user.tokens).forEach(([key, usage]) => {
                    // Map legacy keys if needed, or assume key matches model ID (normalized)
                    // In index.ts we map: google -> gemini, anthropic -> claude, etc. 
                    // We need to match these to our AVAILABLE_MODELS ids.
                    // 'gpt4oMini' -> 'gpt-4o-mini'
                    // 'claude' -> 'claude-3-5-sonnet' (approx)
                    // 'gemini' -> 'gemini-1.5-flash' (approx)
                    // ideally backend should store precise IDs, but for now we map:
                    let modelId = key;
                    if (key === 'gpt4oMini') modelId = 'gpt-4o-mini';
                    if (key === 'gpt4o') modelId = 'gpt-4o';
                    if (key === 'claude') modelId = 'claude-3-5-sonnet';
                    if (key === 'gemini') modelId = 'gemini-1.5-flash';

                    // Match sanitized keys (e.g. 'gemini-1_5-flash' -> 'gemini-1.5-flash')
                    // Iterate available models to see if key matches ID with dot replacement
                    if (!tokens[modelId]) {
                        const foundModel = availableModels.find(m => m.id.replace(/\./g, '_') === key);
                        if (foundModel) modelId = foundModel.id;
                    }

                    if (!tokens[modelId]) tokens[modelId] = { prompt: 0, completion: 0, total: 0 };

                    tokens[modelId].prompt += usage.prompt || 0;
                    tokens[modelId].completion += usage.completion || 0;
                    tokens[modelId].total += usage.total || 0;
                });
            }
        });

        return tokens;
    };

    const modelTokens = aggregateModelTokens();

    const calculateCost = (modelId: string, usage: ModelTokenUsage) => {
        const price = modelPricing[modelId] || availableModels.find(m => m.id === modelId)?.defaultPricing || { prompt: 0, completion: 0 };
        return (
            (usage.prompt / 1_000_000) * price.prompt +
            (usage.completion / 1_000_000) * price.completion
        );
    };

    const totalAiCost = Object.entries(modelTokens).reduce((sum, [id, usage]) => sum + calculateCost(id, usage), 0);

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

    // Identify models
    const activeBrain = availableModels.find(m => m.id === aiSettings.brainModel) || {
        id: aiSettings.brainModel,
        name: aiSettings.brainModel,
        provider: 'openai',
        defaultPricing: { prompt: 0, completion: 0 }
    };
    const activeVoice = availableModels.find(m => m.id === aiSettings.voiceModel) || {
        id: aiSettings.voiceModel,
        name: aiSettings.voiceModel,
        provider: 'anthropic',
        defaultPricing: { prompt: 0, completion: 0 }
    };

    // Filter others (exclude active ones, show only if usage > 0)
    const otherModels = availableModels.filter(m =>
        m.id !== activeBrain.id &&
        m.id !== activeVoice.id &&
        (modelTokens[m.id]?.total || 0) > 0
    );

    const renderModelRow = (model: any) => {
        const usage = modelTokens[model.id] || { prompt: 0, completion: 0, total: 0 };
        const cost = calculateCost(model.id, usage);
        // Ensure name exists
        const name = model.name || model.id;

        return (
            <View key={model.id} style={styles.modelSection}>
                <View style={styles.modelHeader}>
                    <Ionicons name="hardware-chip" size={18} color={colors.primary[400]} />
                    <Text style={styles.modelName}>{name}</Text>
                </View>
                <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Prompt</Text>
                    <Text style={styles.breakdownValue}>{usage.prompt.toLocaleString()}</Text>
                </View>
                <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Completion</Text>
                    <Text style={styles.breakdownValue}>{usage.completion.toLocaleString()}</Text>
                </View>
                <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabelBold}>Cost</Text>
                    <Text style={styles.breakdownValueBold}>${cost.toFixed(4)}</Text>
                </View>
                <View style={styles.divider} />
            </View>
        );
    };

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

                <View style={{ marginBottom: spacing.lg }}>
                    <Text style={[styles.sectionTitle, { fontSize: typography.fontSize.sm, color: colors.status.success }]}>ACTIVE BRAIN MODEL</Text>
                    {renderModelRow(activeBrain)}
                </View>

                <View style={{ marginBottom: spacing.lg }}>
                    <Text style={[styles.sectionTitle, { fontSize: typography.fontSize.sm, color: colors.gold.main }]}>ACTIVE VOICE MODEL</Text>
                    {renderModelRow(activeVoice)}
                </View>

                {otherModels.length > 0 && (
                    <View>
                        <Text style={[styles.sectionTitle, { fontSize: typography.fontSize.sm }]}>OTHER MODELS</Text>
                        {otherModels.map(m => renderModelRow(m))}
                    </View>
                )}

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

                    {/* Model Selector */}
                    <View style={{ zIndex: 50, marginBottom: spacing.lg }}>
                        <Text style={styles.pricingInputLabel}>Select Model to Edit</Text>
                        <TouchableOpacity
                            style={styles.dropdownButton}
                            onPress={() => setModelDropdownOpen(!modelDropdownOpen)}
                        >
                            <Text style={styles.dropdownButtonText}>
                                {availableModels.find(m => m.id === selectedModelId)?.name || selectedModelId}
                            </Text>
                            <Ionicons name={modelDropdownOpen ? "chevron-up" : "chevron-down"} size={20} color={colors.text.muted} />
                        </TouchableOpacity>

                        {modelDropdownOpen && (
                            <View style={styles.dropdownList}>
                                {availableModels.map(model => (
                                    <TouchableOpacity
                                        key={model.id}
                                        style={[
                                            styles.dropdownItem,
                                            selectedModelId === model.id && styles.dropdownItemSelected
                                        ]}
                                        onPress={() => {
                                            setSelectedModelId(model.id);
                                            setModelDropdownOpen(false);
                                        }}
                                    >
                                        <Text style={[
                                            styles.dropdownItemText,
                                            selectedModelId === model.id && { color: colors.primary[400], fontWeight: 'bold' }
                                        ]}>{model.name}</Text>
                                        {selectedModelId === model.id && (
                                            <Ionicons name="checkmark" size={16} color={colors.primary[400]} />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* Pricing Inputs for Selected Model */}
                    <View style={styles.pricingModelSection}>
                        <View style={styles.pricingModelHeader}>
                            <Ionicons name="pricetag" size={20} color={colors.primary[400]} />
                            <Text style={styles.pricingModelName}>
                                {availableModels.find(m => m.id === selectedModelId)?.name}
                            </Text>
                        </View>
                        <View style={styles.pricingInputRow}>
                            <View style={styles.pricingInputGroup}>
                                <Text style={styles.pricingInputLabel}>Prompt Cost / 1M</Text>
                                <View style={styles.pricingInputWrapper}>
                                    <Text style={styles.pricingInputPrefix}>$</Text>
                                    <TextInput
                                        style={[styles.pricingInput, { color: colors.text.primary }]}
                                        value={editingPricing.prompt}
                                        onChangeText={(v) => setEditingPricing(p => ({ ...p, prompt: v }))}
                                        keyboardType="decimal-pad"
                                        placeholder="0.00"
                                        placeholderTextColor={colors.text.muted}
                                    />
                                </View>
                            </View>
                            <View style={styles.pricingInputGroup}>
                                <Text style={styles.pricingInputLabel}>Completion Cost / 1M</Text>
                                <View style={styles.pricingInputWrapper}>
                                    <Text style={styles.pricingInputPrefix}>$</Text>
                                    <TextInput
                                        style={[styles.pricingInput, { color: colors.text.primary }]}
                                        value={editingPricing.completion}
                                        onChangeText={(v) => setEditingPricing(p => ({ ...p, completion: v }))}
                                        keyboardType="decimal-pad"
                                        placeholder="0.00"
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
                    Costs are estimates based on configured pricing per 1M tokens.
                    Actual provider billing may vary slightly.
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
        justifyContent: 'flex-end',
        marginTop: spacing.md,
    },
    pricingButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.md,
        gap: spacing.xs,
        borderWidth: 1,
    },
    pricingButtonPrimary: {
        borderColor: 'transparent',
    },
    pricingButtonSecondary: {
        backgroundColor: 'transparent',
    },
    pricingButtonText: {
        fontSize: typography.fontSize.sm,
        fontWeight: 'bold',
    },
    dropdownButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.background.tertiary,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    dropdownButtonText: {
        fontSize: typography.fontSize.md,
        color: colors.text.primary,
    },
    dropdownList: {
        marginTop: spacing.sm,
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        overflow: 'hidden',
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
    },
    dropdownItemSelected: {
        backgroundColor: colors.primary[900] + '20',
    },
    dropdownItemText: {
        fontSize: typography.fontSize.sm,
        color: colors.text.primary,
    },

});
