import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput, Alert, Platform, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius, shadows } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { TouchableOpacity } from 'react-native';

// ==================== TYPES ====================

interface AIPrompts {
    brainPrompt: string;
    voicePrompt: string;
    stateReviewerPrompt: string;
    stateReviewerEnabled: boolean;
    stateReviewerModel: string;
    stateReviewerFrequency: number;
}

interface WorldPromptOverride {
    worldId: string;
    brainPrompt: string | null;
    voicePrompt: string | null;
    stateReviewerPrompt: string | null;
}

type Scope = 'global' | 'classic' | 'outworlder' | 'tactical';

const SCOPES: { value: Scope; label: string; icon: string }[] = [
    { value: 'global', label: 'Global (Default)', icon: 'globe' },
    { value: 'classic', label: 'Classic D&D', icon: 'book' },
    { value: 'outworlder', label: 'Outworlder (HWFWM)', icon: 'sparkles' },
    { value: 'tactical', label: 'PRAXIS: Operation Dark Tide', icon: 'skull' },
];

const REVIEWER_MODELS = [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Recommended)' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gemini-2.5-flash-preview-04-17', label: 'Gemini 2.5 Flash' },
    { value: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku' },
];

// ==================== COMPONENT ====================

export default function AdminPromptsScreen() {
    const router = useRouter();
    const { colors } = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [seeding, setSeeding] = useState(false);
    const [selectedScope, setSelectedScope] = useState<Scope>('global');

    // Global prompts
    const [globalPrompts, setGlobalPrompts] = useState<AIPrompts>({
        brainPrompt: '',
        voicePrompt: '',
        stateReviewerPrompt: '',
        stateReviewerEnabled: true,
        stateReviewerModel: 'gpt-4o-mini',
        stateReviewerFrequency: 1,
    });

    // World overrides (null means use global)
    const [worldOverrides, setWorldOverrides] = useState<Record<string, WorldPromptOverride>>({});

    // Track which fields are being overridden
    const [overrideEnabled, setOverrideEnabled] = useState<Record<string, boolean>>({
        brainPrompt: false,
        voicePrompt: false,
        stateReviewerPrompt: false,
    });

    // Model dropdown open state
    const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

    useEffect(() => {
        loadPrompts();
    }, []);

    useEffect(() => {
        // When switching scopes, update which fields are being overridden
        if (selectedScope !== 'global') {
            const override = worldOverrides[selectedScope];
            setOverrideEnabled({
                brainPrompt: override?.brainPrompt !== null && override?.brainPrompt !== undefined,
                voicePrompt: override?.voicePrompt !== null && override?.voicePrompt !== undefined,
                stateReviewerPrompt: override?.stateReviewerPrompt !== null && override?.stateReviewerPrompt !== undefined,
            });
        }
    }, [selectedScope, worldOverrides]);

    const loadPrompts = async () => {
        setLoading(true);
        try {
            // Load global prompts
            const globalDoc = await getDoc(doc(db, 'aiPrompts', 'global'));
            if (globalDoc.exists()) {
                const data = globalDoc.data() as AIPrompts;
                setGlobalPrompts({
                    brainPrompt: data.brainPrompt || '',
                    voicePrompt: data.voicePrompt || '',
                    stateReviewerPrompt: data.stateReviewerPrompt || '',
                    stateReviewerEnabled: data.stateReviewerEnabled ?? true,
                    stateReviewerModel: data.stateReviewerModel || 'gpt-4o-mini',
                    stateReviewerFrequency: data.stateReviewerFrequency ?? 1,
                });
            }

            // Load world overrides
            const overrides: Record<string, WorldPromptOverride> = {};
            for (const scope of ['classic', 'outworlder', 'tactical']) {
                const worldDoc = await getDoc(doc(db, 'aiPrompts', scope));
                if (worldDoc.exists()) {
                    overrides[scope] = worldDoc.data() as WorldPromptOverride;
                }
            }
            setWorldOverrides(overrides);

        } catch (error) {
            console.error('Error loading prompts:', error);
            Alert.alert('Error', 'Failed to load prompts');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (selectedScope === 'global') {
                // Save global prompts
                await setDoc(doc(db, 'aiPrompts', 'global'), {
                    ...globalPrompts,
                    updatedAt: serverTimestamp()
                });
            } else {
                // Save world override
                const override: any = {
                    worldId: selectedScope,
                    brainPrompt: overrideEnabled.brainPrompt ? getCurrentValue('brainPrompt') : null,
                    voicePrompt: overrideEnabled.voicePrompt ? getCurrentValue('voicePrompt') : null,
                    stateReviewerPrompt: overrideEnabled.stateReviewerPrompt ? getCurrentValue('stateReviewerPrompt') : null,
                    updatedAt: serverTimestamp()
                };
                await setDoc(doc(db, 'aiPrompts', selectedScope), override);
                setWorldOverrides(prev => ({ ...prev, [selectedScope]: override }));
            }
            Alert.alert('Success', 'Prompts saved successfully');
        } catch (error) {
            console.error('Error saving prompts:', error);
            Alert.alert('Error', 'Failed to save prompts');
        } finally {
            setSaving(false);
        }
    };

    const handleSeedPrompts = async () => {
        setSeeding(true);
        try {
            const functions = getFunctions();
            const seedPrompts = httpsCallable(functions, 'seedPrompts');
            await seedPrompts();
            Alert.alert('Success', 'AI prompts seeded with defaults');
            loadPrompts();
        } catch (error: any) {
            console.error('Error seeding prompts:', error);
            Alert.alert('Error', error.message || 'Failed to seed prompts');
        } finally {
            setSeeding(false);
        }
    };

    const getCurrentValue = (field: 'brainPrompt' | 'voicePrompt' | 'stateReviewerPrompt'): string => {
        if (selectedScope === 'global') {
            return globalPrompts[field];
        }
        const override = worldOverrides[selectedScope];
        if (override && override[field] !== null && override[field] !== undefined) {
            return override[field] as string;
        }
        return globalPrompts[field];
    };

    const setCurrentValue = (field: 'brainPrompt' | 'voicePrompt' | 'stateReviewerPrompt', value: string) => {
        if (selectedScope === 'global') {
            setGlobalPrompts(prev => ({ ...prev, [field]: value }));
        } else {
            setWorldOverrides(prev => ({
                ...prev,
                [selectedScope]: {
                    ...prev[selectedScope],
                    worldId: selectedScope,
                    [field]: value,
                }
            }));
        }
    };

    const toggleOverride = (field: 'brainPrompt' | 'voicePrompt' | 'stateReviewerPrompt') => {
        if (selectedScope === 'global') return; // Can't toggle global

        const newEnabled = !overrideEnabled[field];
        setOverrideEnabled(prev => ({ ...prev, [field]: newEnabled }));

        if (newEnabled) {
            // Copy global value to override
            setCurrentValue(field, globalPrompts[field]);
        }
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>AI Prompts</Text>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading prompts...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>AI Prompts</Text>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={[styles.actionButton, seeding && styles.actionButtonDisabled]}
                        onPress={handleSeedPrompts}
                        disabled={seeding}
                    >
                        {seeding ? (
                            <ActivityIndicator size="small" color={colors.text} />
                        ) : (
                            <Ionicons name="refresh" size={20} color={colors.text} />
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                        onPress={handleSave}
                        disabled={saving}
                    >
                        {saving ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="checkmark" size={20} color="#fff" />
                                <Text style={styles.saveButtonText}>Save</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Scope Selector */}
            <View style={styles.scopeContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {SCOPES.map(scope => (
                        <TouchableOpacity
                            key={scope.value}
                            style={[
                                styles.scopeButton,
                                selectedScope === scope.value && styles.scopeButtonActive
                            ]}
                            onPress={() => setSelectedScope(scope.value)}
                        >
                            <Ionicons
                                name={scope.icon as any}
                                size={16}
                                color={selectedScope === scope.value ? '#fff' : colors.textSecondary}
                            />
                            <Text style={[
                                styles.scopeButtonText,
                                selectedScope === scope.value && styles.scopeButtonTextActive
                            ]}>
                                {scope.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Brain Prompt Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionTitleRow}>
                            <Ionicons name="hardware-chip" size={20} color={colors.primary} />
                            <Text style={styles.sectionTitle}>Brain (Logic Engine)</Text>
                        </View>
                        {selectedScope !== 'global' && (
                            <View style={styles.overrideToggle}>
                                <Text style={styles.overrideLabel}>Override</Text>
                                <Switch
                                    value={overrideEnabled.brainPrompt}
                                    onValueChange={() => toggleOverride('brainPrompt')}
                                    trackColor={{ false: colors.border, true: colors.primary }}
                                />
                            </View>
                        )}
                    </View>
                    <Text style={styles.sectionDescription}>
                        Processes game mechanics, dice rolls, and state changes. Returns JSON.
                    </Text>
                    <TextInput
                        style={[
                            styles.promptInput,
                            selectedScope !== 'global' && !overrideEnabled.brainPrompt && styles.promptInputDisabled
                        ]}
                        value={getCurrentValue('brainPrompt')}
                        onChangeText={(text) => setCurrentValue('brainPrompt', text)}
                        multiline
                        textAlignVertical="top"
                        placeholder="Enter brain prompt..."
                        placeholderTextColor={colors.textSecondary}
                        editable={selectedScope === 'global' || overrideEnabled.brainPrompt}
                    />
                </View>

                {/* Voice Prompt Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionTitleRow}>
                            <Ionicons name="chatbubble-ellipses" size={20} color="#10b981" />
                            <Text style={styles.sectionTitle}>Voice (Narrator)</Text>
                        </View>
                        {selectedScope !== 'global' && (
                            <View style={styles.overrideToggle}>
                                <Text style={styles.overrideLabel}>Override</Text>
                                <Switch
                                    value={overrideEnabled.voicePrompt}
                                    onValueChange={() => toggleOverride('voicePrompt')}
                                    trackColor={{ false: colors.border, true: colors.primary }}
                                />
                            </View>
                        )}
                    </View>
                    <Text style={styles.sectionDescription}>
                        Transforms logic cues into narrative prose. Returns storytelling text.
                    </Text>
                    <TextInput
                        style={[
                            styles.promptInput,
                            selectedScope !== 'global' && !overrideEnabled.voicePrompt && styles.promptInputDisabled
                        ]}
                        value={getCurrentValue('voicePrompt')}
                        onChangeText={(text) => setCurrentValue('voicePrompt', text)}
                        multiline
                        textAlignVertical="top"
                        placeholder="Enter voice prompt..."
                        placeholderTextColor={colors.textSecondary}
                        editable={selectedScope === 'global' || overrideEnabled.voicePrompt}
                    />
                </View>

                {/* State Reviewer Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionTitleRow}>
                            <Ionicons name="sync" size={20} color="#f59e0b" />
                            <Text style={styles.sectionTitle}>State Reviewer</Text>
                        </View>
                        {selectedScope === 'global' && (
                            <View style={styles.overrideToggle}>
                                <Text style={styles.overrideLabel}>Enabled</Text>
                                <Switch
                                    value={globalPrompts.stateReviewerEnabled}
                                    onValueChange={(val) => setGlobalPrompts(prev => ({ ...prev, stateReviewerEnabled: val }))}
                                    trackColor={{ false: colors.border, true: colors.primary }}
                                />
                            </View>
                        )}
                        {selectedScope !== 'global' && (
                            <View style={styles.overrideToggle}>
                                <Text style={styles.overrideLabel}>Override</Text>
                                <Switch
                                    value={overrideEnabled.stateReviewerPrompt}
                                    onValueChange={() => toggleOverride('stateReviewerPrompt')}
                                    trackColor={{ false: colors.border, true: colors.primary }}
                                />
                            </View>
                        )}
                    </View>
                    <Text style={styles.sectionDescription}>
                        Reviews narrative to maintain state consistency (inventory, HP, etc.)
                    </Text>

                    {selectedScope === 'global' && (
                        <View style={styles.reviewerSettings}>
                            {/* Model Selector */}
                            <View style={styles.settingRow}>
                                <Text style={styles.settingLabel}>Model:</Text>
                                <TouchableOpacity
                                    style={styles.dropdown}
                                    onPress={() => setModelDropdownOpen(!modelDropdownOpen)}
                                >
                                    <Text style={styles.dropdownText}>
                                        {REVIEWER_MODELS.find(m => m.value === globalPrompts.stateReviewerModel)?.label || globalPrompts.stateReviewerModel}
                                    </Text>
                                    <Ionicons
                                        name={modelDropdownOpen ? "chevron-up" : "chevron-down"}
                                        size={16}
                                        color={colors.textSecondary}
                                    />
                                </TouchableOpacity>
                            </View>
                            {modelDropdownOpen && (
                                <View style={styles.dropdownMenu}>
                                    {REVIEWER_MODELS.map(model => (
                                        <TouchableOpacity
                                            key={model.value}
                                            style={[
                                                styles.dropdownItem,
                                                globalPrompts.stateReviewerModel === model.value && styles.dropdownItemActive
                                            ]}
                                            onPress={() => {
                                                setGlobalPrompts(prev => ({ ...prev, stateReviewerModel: model.value }));
                                                setModelDropdownOpen(false);
                                            }}
                                        >
                                            <Text style={[
                                                styles.dropdownItemText,
                                                globalPrompts.stateReviewerModel === model.value && styles.dropdownItemTextActive
                                            ]}>
                                                {model.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            {/* Frequency */}
                            <View style={styles.settingRow}>
                                <Text style={styles.settingLabel}>Run every:</Text>
                                <View style={styles.frequencyInput}>
                                    <TextInput
                                        style={styles.frequencyTextInput}
                                        value={String(globalPrompts.stateReviewerFrequency)}
                                        onChangeText={(text) => {
                                            const num = parseInt(text) || 1;
                                            setGlobalPrompts(prev => ({ ...prev, stateReviewerFrequency: Math.max(1, num) }));
                                        }}
                                        keyboardType="numeric"
                                    />
                                    <Text style={styles.frequencyLabel}>turn(s)</Text>
                                </View>
                            </View>
                        </View>
                    )}

                    <TextInput
                        style={[
                            styles.promptInput,
                            selectedScope !== 'global' && !overrideEnabled.stateReviewerPrompt && styles.promptInputDisabled
                        ]}
                        value={getCurrentValue('stateReviewerPrompt')}
                        onChangeText={(text) => setCurrentValue('stateReviewerPrompt', text)}
                        multiline
                        textAlignVertical="top"
                        placeholder="Enter state reviewer prompt..."
                        placeholderTextColor={colors.textSecondary}
                        editable={selectedScope === 'global' || overrideEnabled.stateReviewerPrompt}
                    />
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

// ==================== STYLES ====================

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        paddingTop: Platform.OS === 'web' ? spacing.md : 60,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
    },
    backButton: {
        padding: spacing.xs,
        marginRight: spacing.sm,
    },
    title: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold as any,
        color: colors.text,
        flex: 1,
    },
    headerActions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    actionButton: {
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    actionButtonDisabled: {
        opacity: 0.5,
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        backgroundColor: colors.primary,
    },
    saveButtonDisabled: {
        opacity: 0.5,
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: typography.weights.semibold as any,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: spacing.md,
        color: colors.textSecondary,
    },
    scopeContainer: {
        padding: spacing.sm,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    scopeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        backgroundColor: colors.background,
        marginRight: spacing.sm,
    },
    scopeButtonActive: {
        backgroundColor: colors.primary,
    },
    scopeButtonText: {
        fontSize: typography.sizes.sm,
        color: colors.textSecondary,
    },
    scopeButtonTextActive: {
        color: '#fff',
        fontWeight: typography.weights.semibold as any,
    },
    content: {
        flex: 1,
        padding: spacing.md,
    },
    section: {
        marginBottom: spacing.lg,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        ...shadows.sm,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    sectionTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.semibold as any,
        color: colors.text,
    },
    sectionDescription: {
        fontSize: typography.sizes.sm,
        color: colors.textSecondary,
        marginBottom: spacing.md,
    },
    overrideToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    overrideLabel: {
        fontSize: typography.sizes.sm,
        color: colors.textSecondary,
    },
    promptInput: {
        backgroundColor: colors.background,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        minHeight: 200,
        fontSize: typography.sizes.sm,
        color: colors.text,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        borderWidth: 1,
        borderColor: colors.border,
    },
    promptInputDisabled: {
        opacity: 0.5,
        backgroundColor: colors.border,
    },
    reviewerSettings: {
        marginBottom: spacing.md,
        padding: spacing.sm,
        backgroundColor: colors.background,
        borderRadius: borderRadius.md,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    settingLabel: {
        fontSize: typography.sizes.sm,
        color: colors.text,
        fontWeight: typography.weights.medium as any,
    },
    dropdown: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        minWidth: 200,
    },
    dropdownText: {
        flex: 1,
        fontSize: typography.sizes.sm,
        color: colors.text,
    },
    dropdownMenu: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.sm,
        ...shadows.md,
    },
    dropdownItem: {
        padding: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    dropdownItemActive: {
        backgroundColor: colors.primary + '20',
    },
    dropdownItemText: {
        fontSize: typography.sizes.sm,
        color: colors.text,
    },
    dropdownItemTextActive: {
        color: colors.primary,
        fontWeight: typography.weights.semibold as any,
    },
    frequencyInput: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    frequencyTextInput: {
        width: 50,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        fontSize: typography.sizes.sm,
        color: colors.text,
        textAlign: 'center',
    },
    frequencyLabel: {
        fontSize: typography.sizes.sm,
        color: colors.textSecondary,
    },
});
