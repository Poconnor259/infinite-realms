import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Switch, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius, shadows } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';
// REMOVED ANIMATIONS: import { AnimatedPressable, FadeInView } from '../../components/ui/Animated';
import { AVAILABLE_MODELS, ModelDefinition, GlobalConfig, SubscriptionTier } from '../../lib/types';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, getAvailableModels, getGlobalConfig, updateGlobalConfig, getApiKeyStatus, updateApiKey, ApiKeyStatus, ApiProvider, generateText } from '../../lib/firebase';
import { storage } from '../../lib/store';

// Static metadata for modules (display info only)
const MODULE_METADATA = [
    {
        id: 'classic',
        name: 'Classic D&D',
        description: 'Standard 5th Edition rules with traditional fantasy setting',
        icon: 'book',
        color: '#10b981', // success
    },
    {
        id: 'outworlder',
        name: 'Outworlder (HWFWM)',
        description: 'He Who Fights With Monsters style essence-based system',
        icon: 'sparkles',
        color: '#3b82f6', // info
    },
    {
        id: 'tactical', // was shadowMonarch
        name: 'PRAXIS: Operation Dark Tide',
        description: 'Solo Leveling inspired system with shadow army mechanics',
        icon: 'skull',
        color: '#f59e0b', // gold
    },
];

// Helper function to format model ID into a display name
const formatModelName = (id: string): string => {
    // Convert claude-opus-4-5-20251101 -> "Claude Opus 4.5"
    return id
        .replace(/-\d{8}$/, '') // Remove date suffix
        .replace(/-/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
        .replace(/(\d) (\d)/g, '$1.$2'); // "4 5" -> "4.5"
};

// Helper function to detect provider from model ID
const detectProvider = (id: string): 'openai' | 'anthropic' | 'google' => {
    if (id.startsWith('gpt') || id.startsWith('o1') || id.startsWith('o3') || id.includes('openai')) return 'openai';
    if (id.startsWith('claude')) return 'anthropic';
    if (id.startsWith('gemini') || id.includes('google')) return 'google';
    return 'openai'; // Default
};

export default function AdminConfigScreen() {
    const router = useRouter();
    const { colors } = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    // Global Config State
    const [config, setConfig] = useState<GlobalConfig | null>(null);
    const [loadingConfig, setLoadingConfig] = useState(true);
    const [savingConfig, setSavingConfig] = useState(false);

    // AI Settings State
    const [aiSettings, setAiSettings] = useState({
        brainModel: 'gpt-4o-mini',
        voiceModel: 'claude-3-5-sonnet',
    });
    const [loadingAi, setLoadingAi] = useState(true);
    const [savingAi, setSavingAi] = useState(false);

    const [availableModels, setAvailableModels] = useState<ModelDefinition[]>(AVAILABLE_MODELS);
    const [refreshingModels, setRefreshingModels] = useState(false);
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(() => {
        const saved = storage.getString('pref_admin_showFavoritesOnly');
        return saved ? JSON.parse(saved) : false;
    });

    const handleToggleFavorites = (value: boolean) => {
        setShowFavoritesOnly(value);
        storage.set('pref_admin_showFavoritesOnly', JSON.stringify(value));
    };
    const [brainDropdownOpen, setBrainDropdownOpen] = useState(false);
    const [voiceDropdownOpen, setVoiceDropdownOpen] = useState(false);

    // Model testing state
    const [brainTestInput, setBrainTestInput] = useState('What is your technical model name?');
    const [voiceTestInput, setVoiceTestInput] = useState('What is your technical model name?');
    const [brainTestResponse, setBrainTestResponse] = useState('');
    const [voiceTestResponses, setVoiceTestResponses] = useState<{ economical?: string; balanced?: string; premium?: string }>({});
    const [testingBrain, setTestingBrain] = useState(false);
    const [testingVoiceTier, setTestingVoiceTier] = useState<string | null>(null);

    // API Keys State
    const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus | null>(null);
    const [loadingApiKeys, setLoadingApiKeys] = useState(true);
    const [editingProvider, setEditingProvider] = useState<ApiProvider | null>(null);
    const [newKeyValue, setNewKeyValue] = useState('');
    const [savingKey, setSavingKey] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoadingConfig(true);
        setLoadingAi(true);
        try {
            console.log('[Config] Loading global config...');
            const configResult = await getGlobalConfig();
            console.log('[Config] Result:', configResult.data);

            // Initialize modelCosts with defaults if it doesn't exist
            const loadedConfig = configResult.data;
            if (!loadedConfig.modelCosts) {
                console.log('[Config] Initializing modelCosts with defaults');
                const defaultModelCosts: Record<string, number> = {};
                AVAILABLE_MODELS.forEach(model => {
                    defaultModelCosts[model.id] = model.defaultTurnCost;
                });
                loadedConfig.modelCosts = defaultModelCosts;
            }

            setConfig(loadedConfig);

            const aiDoc = await getDoc(doc(db, 'config', 'aiSettings'));
            if (aiDoc.exists()) {
                setAiSettings(aiDoc.data() as any);
            }

            // Merge favorited models into the available list
            // This ensures any model that was favorited (even if from API refresh) always appears
            if (loadedConfig.favoriteModels && loadedConfig.favoriteModels.length > 0) {
                const staticModelIds = new Set(AVAILABLE_MODELS.map(m => m.id));
                const missingFavorites = loadedConfig.favoriteModels.filter((id: string) => !staticModelIds.has(id));

                if (missingFavorites.length > 0) {
                    console.log(`[Config] Adding ${missingFavorites.length} favorited models not in static list`);
                    const syntheticModels: ModelDefinition[] = missingFavorites.map((id: string) => ({
                        id,
                        name: formatModelName(id), // Generate nice name from ID
                        provider: detectProvider(id),
                        defaultPricing: { prompt: 1.0, completion: 5.0 },
                        defaultTurnCost: 5,
                        description: 'Favorited model'
                    }));
                    setAvailableModels([...AVAILABLE_MODELS, ...syntheticModels]);
                }
            }
        } catch (error) {
            console.error('[Config] Failed to load:', error);
            Alert.alert('Error', 'Failed to load configuration');
        } finally {
            setLoadingConfig(false);
            setLoadingAi(false);
        }

        // Load API key status separately (doesn't block main load)
        try {
            const keyResult = await getApiKeyStatus();
            setApiKeyStatus(keyResult.data);
        } catch (error) {
            console.error('[Config] Failed to load API key status:', error);
        } finally {
            setLoadingApiKeys(false);
        }
    };

    const refreshModels = async () => {
        setRefreshingModels(true);
        try {
            const result = await getAvailableModels();
            const data = result.data as any;
            if (data.models) {
                setAvailableModels(data.models);
            }
            Alert.alert('Success', 'Model list updated from server');
        } catch (error) {
            console.error('Failed to refresh models:', error);
            Alert.alert('Error', 'Failed to refresh model list');
        } finally {
            setRefreshingModels(false);
        }
    };

    const testBrainModel = async () => {
        if (!brainTestInput.trim()) {
            Alert.alert('Error', 'Please enter a test message');
            return;
        }
        setTestingBrain(true);
        setBrainTestResponse('');
        try {
            const result = await generateText({ prompt: brainTestInput });
            if (result.data.success) {
                setBrainTestResponse(result.data.text || 'No response');
            } else {
                setBrainTestResponse(`Error: ${result.data.error}`);
            }
        } catch (error: any) {
            setBrainTestResponse(`Error: ${error.message}`);
        } finally {
            setTestingBrain(false);
        }
    };

    const testVoiceModel = async (tier: 'economical' | 'balanced' | 'premium') => {
        if (!voiceTestInput.trim()) {
            Alert.alert('Error', 'Please enter a test message');
            return;
        }
        // Get the model ID from tierMapping
        const modelId = config?.tierMapping?.[tier];
        if (!modelId) {
            Alert.alert('Error', `No model configured for ${tier} tier. Set it in Tier Mapping section below.`);
            return;
        }
        setTestingVoiceTier(tier);
        setVoiceTestResponses(prev => ({ ...prev, [tier]: '' }));
        try {
            const result = await generateText({ prompt: voiceTestInput, modelId });
            if (result.data.success) {
                setVoiceTestResponses(prev => ({ ...prev, [tier]: result.data.text || 'No response' }));
            } else {
                setVoiceTestResponses(prev => ({ ...prev, [tier]: `Error: ${result.data.error}` }));
            }
        } catch (error: any) {
            setVoiceTestResponses(prev => ({ ...prev, [tier]: `Error: ${error.message}` }));
        } finally {
            setTestingVoiceTier(null);
        }
    };

    const saveAiSettings = async () => {
        setSavingAi(true);
        try {
            const docRef = doc(db, 'config', 'aiSettings');
            await setDoc(docRef, aiSettings, { merge: true });
            Alert.alert('Success', 'AI Model settings updated');
        } catch (error) {
            console.error('Failed to save AI settings:', error);
            Alert.alert('Error', 'Failed to save settings');
        } finally {
            setSavingAi(false);
        }
    };

    const saveGlobalConfig = async () => {
        if (!config) return;
        setSavingConfig(true);
        try {
            console.log('[Config] Saving...', config);
            console.log('[Config] modelCosts specifically:', config.modelCosts);
            console.log('[Config] modelCosts keys:', config.modelCosts ? Object.keys(config.modelCosts) : 'undefined');
            const result = await updateGlobalConfig(config);
            console.log('[Config] Save result:', result.data);
            if (result.data.success) {
                Alert.alert('Success', 'Global configuration saved');
            } else {
                Alert.alert('Error', 'Save returned success=false');
            }
        } catch (error: any) {
            console.error('[Config] Failed to save:', error);
            Alert.alert('Error', `Failed to save configuration: ${error.message}`);
        } finally {
            setSavingConfig(false);
        }
    };

    const updateSubscription = (tier: SubscriptionTier, field: 'limit' | 'price', value: string) => {
        if (!config) return;

        // Allow empty string for clearing input, otherwise parse
        const numValue = value === '' ? 0 : parseInt(value);
        if (isNaN(numValue)) return; // prevent NaN

        console.log(`[Config] Update Subscription ${tier} ${field}: ${value}`);

        setConfig(prev => {
            if (!prev) return null;
            if (field === 'limit') {
                return {
                    ...prev,
                    subscriptionLimits: { ...prev.subscriptionLimits, [tier]: numValue }
                };
            } else {
                return {
                    ...prev,
                    subscriptionPricing: {
                        ...prev.subscriptionPricing,
                        [tier]: {
                            ...prev.subscriptionPricing[tier],
                            // price stored in cents, input is dollars? assuming raw numbers for now to match old code
                            // Wait, existing code said price * 100. Let's keep that logic but verify input.
                            price: numValue * 100,
                            displayPrice: `$${numValue}${tier === 'hero' ? '/mo' : ''}`
                        }
                    }
                };
            }
        });
    };

    const updateDisplayPrice = (tier: SubscriptionTier, text: string) => {
        if (!config) return;
        setConfig(prev => {
            if (!prev) return null;
            return {
                ...prev,
                subscriptionPricing: {
                    ...prev.subscriptionPricing,
                    [tier]: { ...prev.subscriptionPricing[tier], displayPrice: text }
                }
            };
        });
    };

    const toggleTierPermission = (subTier: SubscriptionTier, modelTier: 'economical' | 'balanced' | 'premium') => {
        if (!config) return;

        const currentPermissions = config.subscriptionPermissions?.[subTier]?.allowedTiers || [];
        const isAllowed = currentPermissions.includes(modelTier);

        setConfig(prev => {
            if (!prev) return null;
            return {
                ...prev,
                subscriptionPermissions: {
                    ...prev.subscriptionPermissions,
                    [subTier]: {
                        ...prev.subscriptionPermissions?.[subTier],
                        allowedTiers: isAllowed
                            ? currentPermissions.filter(t => t !== modelTier)
                            : [...currentPermissions, modelTier]
                    }
                }
            };
        });
    };

    const toggleModule = (moduleId: string) => {
        if (!config) return;

        // Safely access current state. If undefined, default to true (enabled by default) or false?
        // In types.ts, worldModules is a Record. If missing, it's effectively disabled or enabled depending on logic.
        // Let's assume missing = enabled for now to show the switch as ON if we don't have override.
        // Wait, if backend returns defaults, it should comprise all known modules.
        const current = config.worldModules?.[moduleId]?.enabled ?? true;
        console.log(`[Config] Toggle Module ${moduleId}: ${current} -> ${!current}`);

        setConfig(prev => {
            if (!prev) return null;
            return {
                ...prev,
                worldModules: {
                    ...prev.worldModules,
                    [moduleId]: {
                        ...(prev.worldModules?.[moduleId] || {}),
                        enabled: !current
                    }
                }
            };
        });
    };

    const toggleSystemSetting = (key: keyof GlobalConfig['systemSettings']) => {
        if (!config) return;
        console.log(`[Config] Toggle System ${key}`);
        setConfig(prev => {
            if (!prev) return null;
            return {
                ...prev,
                systemSettings: {
                    ...prev.systemSettings,
                    [key]: !prev.systemSettings[key]
                }
            };
        });
    };

    const updateNarratorLimit = (key: 'narratorWordLimitMin' | 'narratorWordLimitMax', value: string) => {
        if (!config) return;
        const numValue = value === '' ? 0 : parseInt(value);
        if (isNaN(numValue)) return;
        console.log(`[Config] Update narrator limit ${key}: ${numValue}`);
        setConfig(prev => {
            if (!prev) return null;
            return {
                ...prev,
                systemSettings: {
                    ...prev.systemSettings,
                    [key]: numValue
                }
            };
        });
    };

    const updateSystemSettingNumber = (key: string, value: string) => {
        if (!config) return;
        const numValue = value === '' ? 0 : parseInt(value);
        if (isNaN(numValue)) return;
        console.log(`[Config] Update system setting ${key}: ${numValue}`);
        setConfig(prev => {
            if (!prev) return null;
            return {
                ...prev,
                systemSettings: {
                    ...prev.systemSettings,
                    [key]: numValue
                }
            };
        });
    };
    const updateModelCost = (modelId: string, value: string) => {
        if (!config) return;
        const numValue = value === '' ? 0 : parseInt(value);
        if (isNaN(numValue)) return;

        console.log(`[Config] Update Model Cost ${modelId}: ${numValue}`);
        setConfig(prev => {
            if (!prev) return null;
            return {
                ...prev,
                modelCosts: {
                    ...(prev.modelCosts || {}),
                    [modelId]: numValue
                }
            };
        });
    };

    const toggleFavoriteModel = (modelId: string) => {
        if (!config) return;
        const currentFavorites = config.favoriteModels || [];
        const isFavorite = currentFavorites.includes(modelId);

        setConfig(prev => {
            if (!prev) return null;
            return {
                ...prev,
                favoriteModels: isFavorite
                    ? currentFavorites.filter(id => id !== modelId)
                    : [...currentFavorites, modelId]
            };
        });
    };

    const updateTierMapping = (tier: 'economical' | 'balanced' | 'premium', modelId: string) => {
        if (!config) return;
        setConfig(prev => {
            if (!prev) return null;
            return {
                ...prev,
                tierMapping: {
                    ...(prev.tierMapping || {
                        economical: 'gemini-3-flash-preview',
                        balanced: 'claude-3-5-sonnet-20241022',
                        premium: 'claude-3-opus-20240229'
                    }),
                    [tier]: modelId
                }
            };
        });
    };

    const resetToDefaults = () => {
        if (!config) return;
        const defaults: Record<string, number> = {};

        // Use visible available models to populate defaults from constant
        availableModels.forEach(m => {
            const def = AVAILABLE_MODELS.find(am => am.id === m.id);
            if (def?.defaultTurnCost) {
                defaults[m.id] = def.defaultTurnCost;
            } else {
                // Fallback if not in constant
                if (m.id.includes('flash')) defaults[m.id] = 1;
                else if (m.id.includes('sonnet')) defaults[m.id] = 10;
                else if (m.id.includes('opus')) defaults[m.id] = 15;
                else defaults[m.id] = 5;
            }
        });

        setConfig(prev => {
            if (!prev) return null;
            return {
                ...prev,
                modelCosts: defaults
            };
        });
        Alert.alert('Reset', 'Turn costs reset to defaults. Click Save to persist.');
    };

    const brainModels = useMemo(() => availableModels.filter(m => m.provider === 'openai' || m.provider === 'anthropic' || m.provider === 'google'), [availableModels]);
    const voiceModels = useMemo(() => availableModels.filter(m => m.provider === 'openai' || m.provider === 'anthropic' || m.provider === 'google'), [availableModels]);

    const API_PROVIDERS: { id: ApiProvider; name: string; icon: string; color: string }[] = [
        { id: 'openai', name: 'OpenAI', icon: 'hardware-chip', color: '#10a37f' },
        { id: 'anthropic', name: 'Anthropic', icon: 'sparkles', color: '#d97757' },
        { id: 'google', name: 'Google (Gemini)', icon: 'logo-google', color: '#4285f4' },
    ];

    const handleSaveApiKey = async (provider: ApiProvider) => {
        if (!newKeyValue.trim()) {
            Alert.alert('Error', 'Please enter an API key');
            return;
        }

        setSavingKey(true);
        try {
            await updateApiKey({ provider, key: newKeyValue.trim() });
            Alert.alert('Success', `${provider.charAt(0).toUpperCase() + provider.slice(1)} API key updated. Note: Functions may need to be redeployed to use the new key.`);

            // Refresh status
            const keyResult = await getApiKeyStatus();
            setApiKeyStatus(keyResult.data);

            setEditingProvider(null);
            setNewKeyValue('');
        } catch (error: any) {
            console.error('[Config] Failed to update API key:', error);
            Alert.alert('Error', `Failed to update API key: ${error.message}`);
        } finally {
            setSavingKey(false);
        }
    };

    if (loadingConfig || loadingAi) {
        return (
            <View style={[styles.container, { justifyContent: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary[400]} />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.title}>Global Config</Text>
            </View>

            {/* Global AI Model Selection */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Global Brain Model (Game Logic)</Text>
                <View style={styles.card}>
                    <Text style={[styles.helpText, { marginBottom: spacing.md }]}>
                        The Brain model handles game logic and state updates. Voice models are tier-based (see Tier Mapping below).
                    </Text>

                    {/* Brain Model Dropdown */}
                    <View style={{ marginBottom: spacing.lg }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <Ionicons name="hardware-chip" size={18} color={colors.primary[400]} />
                            <Text style={styles.fieldLabel}>Brain Model</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.dropdown}
                            onPress={() => setBrainDropdownOpen(!brainDropdownOpen)}
                        >
                            <Text style={styles.dropdownText}>
                                {brainModels.find(m => m.id === aiSettings.brainModel)?.name || aiSettings.brainModel}
                            </Text>
                            <Ionicons name={brainDropdownOpen ? "chevron-up" : "chevron-down"} size={20} color={colors.text.secondary} />
                        </TouchableOpacity>
                        {brainDropdownOpen && (
                            <View style={styles.dropdownList}>
                                {brainModels.filter(m => !showFavoritesOnly || config?.favoriteModels?.includes(m.id)).map(model => (
                                    <TouchableOpacity
                                        key={model.id}
                                        style={[styles.dropdownItem, aiSettings.brainModel === model.id && styles.dropdownItemSelected]}
                                        onPress={() => {
                                            setAiSettings(prev => ({ ...prev, brainModel: model.id }));
                                            setBrainDropdownOpen(false);
                                        }}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.dropdownItemText}>{model.name}</Text>
                                            <Text style={styles.modelId}>{model.id}</Text>
                                        </View>
                                        {aiSettings.brainModel === model.id && (
                                            <Ionicons name="checkmark" size={20} color={colors.primary[400]} />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>

                    <TouchableOpacity
                        style={styles.saveButton}
                        onPress={saveAiSettings}
                        disabled={savingAi}
                    >
                        {savingAi ? <ActivityIndicator color="#000" /> : <Text style={styles.saveButtonText}>Save Brain Model</Text>}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Model Testing Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Test AI Models</Text>
                <View style={styles.card}>
                    <Text style={[styles.helpText, { marginBottom: spacing.md }]}>
                        Send a test message to verify the AI models are working correctly.
                    </Text>

                    {/* Brain Test */}
                    <View style={{ marginBottom: spacing.lg }}>
                        <Text style={styles.fieldLabel}>Test Brain Model</Text>
                        <TextInput
                            style={[styles.input, { marginBottom: spacing.sm }]}
                            value={brainTestInput}
                            onChangeText={setBrainTestInput}
                            placeholder="Enter test prompt..."
                            placeholderTextColor={colors.text.muted}
                        />
                        <TouchableOpacity
                            style={[styles.saveButton, { backgroundColor: colors.primary[400] }]}
                            onPress={testBrainModel}
                            disabled={testingBrain}
                        >
                            {testingBrain ? <ActivityIndicator color="#fff" /> : <Text style={[styles.saveButtonText, { color: '#fff' }]}>Test Brain</Text>}
                        </TouchableOpacity>
                        {brainTestResponse ? (
                            <View style={{ marginTop: spacing.sm, padding: spacing.sm, backgroundColor: colors.background.tertiary, borderRadius: borderRadius.sm }}>
                                <Text style={{ color: colors.text.secondary, fontSize: 12 }}>{brainTestResponse}</Text>
                            </View>
                        ) : null}
                    </View>

                    {/* Voice Test - Tier Based */}
                    <View>
                        <Text style={styles.fieldLabel}>Test Voice Models (by Tier)</Text>
                        <Text style={[styles.helpText, { marginBottom: spacing.sm }]}>
                            Test each tier's configured Voice model
                        </Text>
                        <TextInput
                            style={[styles.input, { marginBottom: spacing.sm }]}
                            value={voiceTestInput}
                            onChangeText={setVoiceTestInput}
                            placeholder="Enter test prompt..."
                            placeholderTextColor={colors.text.muted}
                        />

                        {/* Tier Test Buttons */}
                        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
                            <TouchableOpacity
                                style={[styles.saveButton, { flex: 1, backgroundColor: '#10b981' }]}
                                onPress={() => testVoiceModel('economical')}
                                disabled={testingVoiceTier !== null}
                            >
                                {testingVoiceTier === 'economical' ? <ActivityIndicator color="#fff" /> : (
                                    <View style={{ alignItems: 'center' }}>
                                        <Text style={[styles.saveButtonText, { color: '#fff' }]}>Economical</Text>
                                        <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>{config?.tierMapping?.economical || 'Not set'}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.saveButton, { flex: 1, backgroundColor: '#3b82f6' }]}
                                onPress={() => testVoiceModel('balanced')}
                                disabled={testingVoiceTier !== null}
                            >
                                {testingVoiceTier === 'balanced' ? <ActivityIndicator color="#fff" /> : (
                                    <View style={{ alignItems: 'center' }}>
                                        <Text style={[styles.saveButtonText, { color: '#fff' }]}>Balanced</Text>
                                        <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>{config?.tierMapping?.balanced || 'Not set'}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.saveButton, { flex: 1, backgroundColor: '#a855f7' }]}
                                onPress={() => testVoiceModel('premium')}
                                disabled={testingVoiceTier !== null}
                            >
                                {testingVoiceTier === 'premium' ? <ActivityIndicator color="#fff" /> : (
                                    <View style={{ alignItems: 'center' }}>
                                        <Text style={[styles.saveButtonText, { color: '#fff' }]}>Premium</Text>
                                        <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>{config?.tierMapping?.premium || 'Not set'}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Response Display for Each Tier */}
                        {voiceTestResponses.economical ? (
                            <View style={{ marginBottom: spacing.sm, padding: spacing.sm, backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: borderRadius.sm, borderLeftWidth: 3, borderLeftColor: '#10b981' }}>
                                <Text style={{ color: '#10b981', fontSize: 11, fontWeight: 'bold', marginBottom: 4 }}>Economical:</Text>
                                <Text style={{ color: colors.text.secondary, fontSize: 12 }}>{voiceTestResponses.economical}</Text>
                            </View>
                        ) : null}
                        {voiceTestResponses.balanced ? (
                            <View style={{ marginBottom: spacing.sm, padding: spacing.sm, backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: borderRadius.sm, borderLeftWidth: 3, borderLeftColor: '#3b82f6' }}>
                                <Text style={{ color: '#3b82f6', fontSize: 11, fontWeight: 'bold', marginBottom: 4 }}>Balanced:</Text>
                                <Text style={{ color: colors.text.secondary, fontSize: 12 }}>{voiceTestResponses.balanced}</Text>
                            </View>
                        ) : null}
                        {voiceTestResponses.premium ? (
                            <View style={{ marginBottom: spacing.sm, padding: spacing.sm, backgroundColor: 'rgba(168,85,247,0.1)', borderRadius: borderRadius.sm, borderLeftWidth: 3, borderLeftColor: '#a855f7' }}>
                                <Text style={{ color: '#a855f7', fontSize: 11, fontWeight: 'bold', marginBottom: 4 }}>Premium:</Text>
                                <Text style={{ color: colors.text.secondary, fontSize: 12 }}>{voiceTestResponses.premium}</Text>
                            </View>
                        ) : null}
                    </View>
                </View>
            </View>

            {/* AI Model Costs Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>AI Model Turn Costs</Text>
                <View style={styles.card}>
                    {/* Refresh Button */}
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.sm, gap: spacing.md }}>
                        <TouchableOpacity
                            onPress={resetToDefaults}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                        >
                            <Ionicons name="refresh-circle-outline" size={16} color={colors.text.secondary} />
                            <Text style={{ color: colors.text.secondary, fontSize: 12 }}>
                                Reset Defaults
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={refreshModels}
                            disabled={refreshingModels}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                        >
                            <Ionicons name="cloud-download-outline" size={16} color={colors.primary[400]} />
                            <Text style={{ color: colors.primary[400], fontSize: 12 }}>
                                {refreshingModels ? 'Refreshing...' : 'Refresh Models'}
                            </Text>
                        </TouchableOpacity>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ color: colors.text.secondary, fontSize: 12 }}>Filter Favorites</Text>
                            <Switch
                                value={showFavoritesOnly}
                                onValueChange={handleToggleFavorites}
                                trackColor={{ false: colors.background.tertiary, true: colors.primary[400] }}
                                thumbColor="#fff"
                                style={{ transform: [{ scale: 0.7 }] }}
                            />
                        </View>
                    </View>

                    {availableModels
                        .filter(m => !showFavoritesOnly || config?.favoriteModels?.includes(m.id))
                        .map(model => (
                            <View key={model.id} style={styles.configItem}>
                                <View style={{ gap: 4, flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Text style={styles.modelName}>{model.name}</Text>
                                        {config?.favoriteModels?.includes(model.id) && (
                                            <Ionicons name="star" size={14} color={colors.gold.main} />
                                        )}
                                    </View>
                                    <Text style={styles.modelId}>{model.id}</Text>
                                </View>

                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                                    <View style={{ alignItems: 'center', gap: 2 }}>
                                        <Text style={[styles.inputLabel, { fontSize: 10 }]}>Favorite</Text>
                                        <Switch
                                            value={config?.favoriteModels?.includes(model.id) ?? false}
                                            onValueChange={() => toggleFavoriteModel(model.id)}
                                            trackColor={{ false: colors.background.tertiary, true: colors.primary[400] }}
                                            thumbColor="#fff"
                                            style={{ transform: [{ scale: 0.8 }] }}
                                        />
                                    </View>

                                    <View style={{ alignItems: 'center', gap: 2 }}>
                                        <Text style={[styles.inputLabel, { fontSize: 10 }]}>Turns</Text>
                                        <TextInput
                                            style={[styles.input, { width: 60, textAlign: 'center', height: 32 }]}
                                            value={String(config?.modelCosts?.[model.id] ?? (
                                                // Defaults from constant matching
                                                AVAILABLE_MODELS.find(am => am.id === model.id)?.defaultTurnCost ??
                                                (model.id.includes('flash') ? 1 :
                                                    model.id.includes('sonnet') ? 10 :
                                                        model.id.includes('opus') ? 15 : 5)
                                            ))}
                                            onChangeText={(v) => updateModelCost(model.id, v)}
                                            keyboardType="numeric"
                                            placeholder="0"
                                            placeholderTextColor={colors.text.muted}
                                        />
                                    </View>
                                </View>
                            </View>
                        ))}

                    <TouchableOpacity
                        style={[styles.saveButton, { marginTop: spacing.md }]}
                        onPress={saveGlobalConfig}
                        disabled={savingConfig}
                    >
                        {savingConfig ? <ActivityIndicator color="#000" /> : <Text style={styles.saveButtonText}>Save AI Configuration</Text>}
                    </TouchableOpacity>
                </View>
            </View>

            {/* AI Tier Mapping */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Tier Model Mapping</Text>
                <View style={styles.card}>
                    <Text style={[styles.helpText, { marginBottom: spacing.md }]}>
                        Select which models are used for the Economical, Balanced, and Premium tiers.
                    </Text>

                    {[
                        { key: 'premium' as const, label: 'Premium (High Cost)', icon: 'sparkles', color: colors.gold.main },
                        { key: 'balanced' as const, label: 'Balanced (Mid Cost)', icon: 'flash', color: colors.status.info },
                        { key: 'economical' as const, label: 'Economical (Low Cost)', icon: 'rocket', color: colors.status.success }
                    ].map(tier => (
                        <View key={tier.key} style={{ marginBottom: spacing.lg }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <Ionicons name={tier.icon as any} size={18} color={tier.color} />
                                <Text style={styles.fieldLabel}>{tier.label}</Text>
                            </View>

                            <View style={styles.dropdownList}>
                                {availableModels
                                    .filter(m => config?.favoriteModels?.includes(m.id))
                                    .map(model => (
                                        <TouchableOpacity
                                            key={model.id}
                                            style={[
                                                styles.dropdownItem,
                                                config?.tierMapping?.[tier.key] === model.id && styles.dropdownItemSelected
                                            ]}
                                            onPress={() => updateTierMapping(tier.key, model.id)}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.dropdownItemText}>{model.name}</Text>
                                                <Text style={styles.modelId}>{model.id}</Text>
                                            </View>
                                            {config?.tierMapping?.[tier.key] === model.id && (
                                                <Ionicons name="checkmark" size={20} color={colors.primary[400]} />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                            </View>
                        </View>
                    ))}

                    <TouchableOpacity
                        style={[styles.saveButton, { marginTop: spacing.sm }]}
                        onPress={saveGlobalConfig}
                        disabled={savingConfig}
                    >
                        {savingConfig ? <ActivityIndicator color="#000" /> : <Text style={styles.saveButtonText}>Save Mapping</Text>}
                    </TouchableOpacity>
                </View>
            </View>


            {/* Narrator Settings Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Narrator Settings</Text>
                <View style={styles.card}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
                        <Text style={styles.fieldLabel}>Word Limit for AI Responses</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ color: colors.text.secondary, fontSize: 12 }}>{config?.systemSettings?.enforceNarratorWordLimits ? 'Enabled' : 'Disabled'}</Text>
                            <Switch
                                value={config?.systemSettings?.enforceNarratorWordLimits ?? true}
                                onValueChange={() => toggleSystemSetting('enforceNarratorWordLimits')}
                                trackColor={{ false: colors.background.tertiary, true: colors.primary[400] }}
                                thumbColor="#fff"
                            />
                        </View>
                    </View>
                    <Text style={[styles.helpText, { marginBottom: spacing.md }]}>
                        Controls how long the narrator's responses should be. Current: {config?.systemSettings?.narratorWordLimitMin || 150}-{config?.systemSettings?.narratorWordLimitMax || 250} words.
                    </Text>
                    <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.inputLabel}>Min Words</Text>
                            <TextInput
                                style={styles.numberInput}
                                value={String(config?.systemSettings?.narratorWordLimitMin || 150)}
                                onChangeText={(text) => updateNarratorLimit('narratorWordLimitMin', text)}
                                keyboardType="number-pad"
                                placeholder="150"
                                placeholderTextColor={colors.text.muted}
                            />
                        </View>
                        <Text style={{ color: colors.text.secondary, fontSize: 20, marginTop: spacing.lg }}>—</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.inputLabel}>Max Words</Text>
                            <TextInput
                                style={styles.numberInput}
                                value={String(config?.systemSettings?.narratorWordLimitMax || 250)}
                                onChangeText={(text) => updateNarratorLimit('narratorWordLimitMax', text)}
                                keyboardType="number-pad"
                                placeholder="250"
                                placeholderTextColor={colors.text.muted}
                            />
                        </View>
                    </View>
                    <TouchableOpacity
                        style={[styles.saveButton, { marginTop: spacing.lg }]}
                        onPress={saveGlobalConfig}
                        disabled={savingConfig}
                    >
                        {savingConfig ? <ActivityIndicator color="#000" /> : <Text style={styles.saveButtonText}>Save Narrator Settings</Text>}
                    </TouchableOpacity>
                </View>
            </View >

            {/* API Keys Section */}
            < View style={styles.section} >
                <Text style={styles.sectionTitle}>API Keys</Text>
                <View style={styles.card}>
                    {loadingApiKeys ? (
                        <ActivityIndicator size="small" color={colors.primary[400]} />
                    ) : (
                        API_PROVIDERS.map((provider) => {
                            const status = apiKeyStatus?.[provider.id];
                            const isEditing = editingProvider === provider.id;

                            return (
                                <View key={provider.id} style={styles.apiKeyRow}>
                                    <View style={styles.apiKeyHeader}>
                                        <View style={[styles.apiKeyIcon, { backgroundColor: provider.color + '20' }]}>
                                            <Ionicons name={provider.icon as any} size={20} color={provider.color} />
                                        </View>
                                        <View style={styles.apiKeyInfo}>
                                            <Text style={styles.apiKeyName}>{provider.name}</Text>
                                            {status?.set ? (
                                                <Text style={styles.apiKeyHint}>{status.hint}</Text>
                                            ) : (
                                                <Text style={[styles.apiKeyHint, { color: colors.status.warning }]}>Not configured</Text>
                                            )}
                                        </View>
                                        {!isEditing && (
                                            <TouchableOpacity
                                                style={styles.apiKeyEditButton}
                                                onPress={() => {
                                                    setEditingProvider(provider.id);
                                                    setNewKeyValue('');
                                                }}
                                            >
                                                <Text style={styles.apiKeyEditButtonText}>
                                                    {status?.set ? 'Update' : 'Add'}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    {isEditing && (
                                        <View style={styles.apiKeyEditForm}>
                                            <TextInput
                                                style={styles.apiKeyInput}
                                                value={newKeyValue}
                                                onChangeText={setNewKeyValue}
                                                placeholder={`Enter ${provider.name} API key`}
                                                placeholderTextColor={colors.text.muted}
                                                secureTextEntry
                                                autoCapitalize="none"
                                                autoCorrect={false}
                                            />
                                            <View style={styles.apiKeyButtonRow}>
                                                <TouchableOpacity
                                                    style={[styles.apiKeyButton, styles.apiKeyCancelButton]}
                                                    onPress={() => {
                                                        setEditingProvider(null);
                                                        setNewKeyValue('');
                                                    }}
                                                >
                                                    <Text style={styles.apiKeyCancelButtonText}>Cancel</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.apiKeyButton, styles.apiKeySaveButton]}
                                                    onPress={() => handleSaveApiKey(provider.id)}
                                                    disabled={savingKey}
                                                >
                                                    {savingKey ? (
                                                        <ActivityIndicator size="small" color="#000" />
                                                    ) : (
                                                        <Text style={styles.apiKeySaveButtonText}>Save</Text>
                                                    )}
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            );
                        })
                    )}
                </View>
            </View >

            {/* Subscriptions */}
            < View style={styles.section} >
                <Text style={styles.sectionTitle}>Subscriptions & Limits</Text>
                <View style={styles.card}>
                    {(['scout', 'adventurer', 'hero', 'legendary'] as SubscriptionTier[]).map(tier => (
                        <View key={tier} style={styles.configItem}>
                            <Text style={styles.configLabelCapital}>{tier}</Text>
                            <View style={styles.inputRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Turns</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={String(config?.subscriptionLimits?.[tier] ?? '')}
                                        keyboardType="numeric"
                                        onChangeText={(v) => updateSubscription(tier, 'limit', v)}
                                        placeholder="0"
                                        placeholderTextColor={colors.text.muted}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Display Price</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={config?.subscriptionPricing?.[tier]?.displayPrice ?? ''}
                                        onChangeText={(v) => updateDisplayPrice(tier, v)}
                                        placeholder="Free"
                                        placeholderTextColor={colors.text.muted}
                                    />
                                </View>
                            </View>

                            {/* Allowed Tiers */}
                            <View style={{ marginTop: spacing.md }}>
                                <Text style={styles.inputLabel}>Allowed Tiers</Text>
                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                                    {[
                                        { id: 'economical', label: 'Economical', icon: 'rocket', color: colors.status.success },
                                        { id: 'balanced', label: 'Balanced', icon: 'flash', color: colors.status.info },
                                        { id: 'premium', label: 'Premium', icon: 'sparkles', color: colors.gold.main }
                                    ].map(t => {
                                        const isAllowed = config?.subscriptionPermissions?.[tier]?.allowedTiers?.includes(t.id as any) ?? false;
                                        return (
                                            <TouchableOpacity
                                                key={t.id}
                                                onPress={() => toggleTierPermission(tier, t.id as any)}
                                                style={[
                                                    styles.modelChip,
                                                    isAllowed && { backgroundColor: t.color + '20', borderColor: t.color },
                                                    !isAllowed && { backgroundColor: colors.background.tertiary, borderColor: 'transparent' }
                                                ]}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Ionicons name={t.icon as any} size={14} color={isAllowed ? t.color : colors.text.muted} />
                                                    <Text style={[
                                                        styles.modelChipText,
                                                        { color: isAllowed ? t.color : colors.text.muted }
                                                    ]}>
                                                        {t.label}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        </View>
                    ))}
                </View>
            </View >

            {/* World Modules */}
            < View style={styles.section} >
                <Text style={styles.sectionTitle}>World Modules</Text>
                <View style={{ gap: spacing.sm }}>
                    {MODULE_METADATA.map((module) => {
                        const isEnabled = config?.worldModules?.[module.id]?.enabled ?? true;
                        return (
                            <View key={module.id} style={styles.moduleCard}>
                                <View style={[styles.moduleIcon, { backgroundColor: module.color + '20' }]}>
                                    <Ionicons name={module.icon as any} size={24} color={module.color} />
                                </View>
                                <View style={styles.moduleInfo}>
                                    <Text style={styles.moduleName}>{module.name}</Text>
                                    <Text style={styles.moduleDescription}>{module.description}</Text>
                                </View>
                                <Switch
                                    value={isEnabled}
                                    onValueChange={() => toggleModule(module.id)}
                                    trackColor={{ false: colors.background.tertiary, true: colors.status.success + '50' }}
                                    thumbColor={isEnabled ? colors.status.success : colors.text.muted}
                                    // Web compatible styles
                                    style={Platform.OS === 'web' ? { transform: [{ scale: 0.8 }] } : undefined}
                                />
                            </View>
                        );
                    })}
                </View>
            </View >

            {/* System Settings */}
            < View style={styles.section} >
                <Text style={styles.sectionTitle}>System Settings</Text>
                <View style={styles.card}>
                    <View style={styles.switchRow}>
                        <Text style={styles.configLabel}>Maintenance Mode</Text>
                        <Switch
                            value={config?.systemSettings?.maintenanceMode ?? false}
                            onValueChange={() => toggleSystemSetting('maintenanceMode')}
                            style={Platform.OS === 'web' ? { transform: [{ scale: 0.8 }] } : undefined}
                        />
                    </View>
                    <View style={styles.switchRow}>
                        <Text style={styles.configLabel}>New Registrations</Text>
                        <Switch
                            value={config?.systemSettings?.newRegistrationsOpen ?? true}
                            onValueChange={() => toggleSystemSetting('newRegistrationsOpen')}
                            style={Platform.OS === 'web' ? { transform: [{ scale: 0.8 }] } : undefined}
                        />
                    </View>
                    <View style={[styles.switchRow, { borderBottomWidth: 0 }]}>
                        <Text style={styles.configLabel}>Debug Logging</Text>
                        <Switch
                            value={config?.systemSettings?.debugLogging ?? false}
                            onValueChange={() => toggleSystemSetting('debugLogging')}
                            style={Platform.OS === 'web' ? { transform: [{ scale: 0.8 }] } : undefined}
                        />
                    </View>
                    <View style={[styles.switchRow, { borderBottomWidth: 0 }]}>
                        <Text style={styles.configLabel}>Show AI Debug (Admin)</Text>
                        <Switch
                            value={config?.systemSettings?.showAdminDebug ?? false}
                            onValueChange={() => toggleSystemSetting('showAdminDebug')}
                            style={Platform.OS === 'web' ? { transform: [{ scale: 0.8 }] } : undefined}
                        />
                    </View>

                    {/* Cache & Heartbeat Controls */}
                    <View style={[styles.switchRow, { borderBottomWidth: 1, borderBottomColor: colors.border.default, paddingTop: spacing.md, marginTop: spacing.md }]}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.configLabel}>Enable Context Caching</Text>
                            <Text style={[styles.configLabel, { fontSize: 11, color: colors.text.muted, fontWeight: 'normal' }]}>
                                Use Anthropic cache_control headers (90% cost savings)
                            </Text>
                        </View>
                        <Switch
                            value={config?.systemSettings?.enableContextCaching ?? true}
                            onValueChange={() => toggleSystemSetting('enableContextCaching')}
                            style={Platform.OS === 'web' ? { transform: [{ scale: 0.8 }] } : undefined}
                        />
                    </View>
                    <View style={[styles.switchRow, { borderBottomWidth: 1, borderBottomColor: colors.border.default }]}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.configLabel}>Enable Heartbeat System</Text>
                            <Text style={[styles.configLabel, { fontSize: 11, color: colors.text.muted, fontWeight: 'normal' }]}>
                                Keep cache alive with periodic pings (~$0.02/session)
                            </Text>
                        </View>
                        <Switch
                            value={config?.systemSettings?.enableHeartbeatSystem ?? true}
                            onValueChange={() => toggleSystemSetting('enableHeartbeatSystem')}
                            style={Platform.OS === 'web' ? { transform: [{ scale: 0.8 }] } : undefined}
                        />
                    </View>
                    <View style={[styles.switchRow, { borderBottomWidth: 0 }]}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.configLabel}>Heartbeat Idle Timeout (Minutes)</Text>
                            <Text style={[styles.configLabel, { fontSize: 11, color: colors.text.muted, fontWeight: 'normal' }]}>
                                Stop heartbeat after this many minutes of inactivity
                            </Text>
                        </View>
                        <TextInput
                            style={[styles.input, { width: 80, textAlign: 'center' }]}
                            value={String(config?.systemSettings?.heartbeatIdleTimeout ?? 15)}
                            keyboardType="numeric"
                            onChangeText={(v) => updateSystemSettingNumber('heartbeatIdleTimeout', v)}
                            placeholder="15"
                            placeholderTextColor={colors.text.muted}
                        />
                    </View>
                    <View style={[styles.switchRow, { borderBottomWidth: 0 }]}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.configLabel}>Default Turn Cost</Text>
                            <Text style={[styles.configLabel, { fontSize: 11, color: colors.text.muted, fontWeight: 'normal' }]}>
                                Global fallback cost for models with no specific cost set
                            </Text>
                        </View>
                        <TextInput
                            style={[styles.input, { width: 80, textAlign: 'center' }]}
                            value={String(config?.systemSettings?.defaultTurnCost ?? 1)}
                            keyboardType="numeric"
                            onChangeText={(v) => updateSystemSettingNumber('defaultTurnCost', v)}
                            placeholder="1"
                            placeholderTextColor={colors.text.muted}
                        />
                    </View>
                    <View style={[styles.switchRow, { borderBottomWidth: 0 }]}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.configLabel}>Max Output Tokens</Text>
                            <Text style={[styles.configLabel, { fontSize: 11, color: colors.text.muted, fontWeight: 'normal' }]}>
                                Maximum tokens for AI responses (prevents truncation). Default: 4096
                            </Text>
                        </View>
                        <TextInput
                            style={[styles.input, { width: 80, textAlign: 'center' }]}
                            value={String(config?.systemSettings?.maxOutputTokens ?? 4096)}
                            keyboardType="numeric"
                            onChangeText={(v) => updateSystemSettingNumber('maxOutputTokens', v)}
                            placeholder="4096"
                            placeholderTextColor={colors.text.muted}
                        />
                    </View>
                    <View style={[styles.switchRow, { borderBottomWidth: 0 }]}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.configLabel}>Enforce Max Tokens</Text>
                            <Text style={[styles.configLabel, { fontSize: 11, color: colors.text.muted, fontWeight: 'normal' }]}>
                                When OFF, AI uses its model default (no limit)
                            </Text>
                        </View>
                        <Switch
                            value={config?.systemSettings?.enforceMaxOutputTokens ?? true}
                            onValueChange={() => toggleSystemSetting('enforceMaxOutputTokens')}
                            style={Platform.OS === 'web' ? { transform: [{ scale: 0.8 }] } : undefined}
                        />
                    </View>
                </View>
            </View >

            {/* SAVE ALL BUTTON */}
            < View style={{ marginBottom: spacing.xxl }
            }>
                <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: colors.status.success }]}
                    onPress={saveGlobalConfig}
                    disabled={savingConfig}
                >
                    {savingConfig ? (
                        <ActivityIndicator color="#000" />
                    ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name="save" size={20} color="#000" />
                            <Text style={styles.saveButtonText}>Save Global Config</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View >

        </ScrollView >
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
    settingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xs,
        gap: spacing.sm,
    },
    settingTitle: {
        fontSize: typography.fontSize.md,
        fontWeight: 'bold',
        color: colors.text.primary,
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
    saveButton: {
        backgroundColor: colors.primary[400], // Default blue
        padding: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveButtonText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: typography.fontSize.md,
    },
    configItem: {
        marginBottom: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
        paddingBottom: spacing.md,
    },
    configLabelCapital: {
        fontSize: typography.fontSize.md,
        fontWeight: 'bold',
        color: colors.text.primary,
        textTransform: 'capitalize',
        marginBottom: spacing.sm,
    },
    configLabel: {
        fontSize: typography.fontSize.md,
        color: colors.text.primary,
    },
    inputRow: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    inputLabel: {
        fontSize: typography.fontSize.xs,
        color: colors.text.muted,
        marginBottom: 4,
    },
    input: {
        backgroundColor: colors.background.tertiary,
        color: colors.text.primary,
        padding: spacing.sm,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    moduleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        gap: spacing.md,
    },
    moduleIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    moduleInfo: {
        flex: 1,
    },
    moduleName: {
        fontSize: typography.fontSize.md,
        fontWeight: 'bold',
        color: colors.text.primary,
    },
    moduleDescription: {
        fontSize: typography.fontSize.sm,
        color: colors.text.muted,
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
    },
    // API Key Styles
    apiKeyRow: {
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
    },
    apiKeyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    apiKeyIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    apiKeyInfo: {
        flex: 1,
    },
    apiKeyName: {
        fontSize: typography.fontSize.md,
        fontWeight: 'bold',
        color: colors.text.primary,
    },
    apiKeyHint: {
        fontSize: typography.fontSize.sm,
        color: colors.text.muted,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    apiKeyEditButton: {
        backgroundColor: colors.primary[400] + '30',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.sm,
    },
    apiKeyEditButtonText: {
        color: colors.primary[400],
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    apiKeyEditForm: {
        marginTop: spacing.md,
        gap: spacing.sm,
    },
    apiKeyInput: {
        backgroundColor: colors.background.tertiary,
        color: colors.text.primary,
        padding: spacing.md,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border.default,
        fontSize: typography.fontSize.md,
    },
    apiKeyButtonRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: spacing.sm,
    },
    apiKeyButton: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.sm,
        minWidth: 80,
        alignItems: 'center',
    },
    apiKeyCancelButton: {
        backgroundColor: colors.background.tertiary,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    apiKeyCancelButtonText: {
        color: colors.text.secondary,
        fontSize: typography.fontSize.sm,
    },
    apiKeySaveButton: {
        backgroundColor: colors.status.success,
    },
    apiKeySaveButtonText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: typography.fontSize.sm,
    },
    providerBadge: {
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
        borderRadius: borderRadius.sm,
    },
    providerBadgeText: {
        fontSize: typography.fontSize.xs,
        fontWeight: '600',
    },
    modelMetaText: {
        fontSize: typography.fontSize.xs,
        color: colors.text.muted,
    },
    testSection: {
        marginTop: spacing.md,
        padding: spacing.md,
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    testLabel: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
        color: colors.text.secondary,
        marginBottom: spacing.sm,
    },
    testInputRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    testInput: {
        flex: 1,
        backgroundColor: colors.background.tertiary,
        color: colors.text.primary,
        padding: spacing.sm,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border.default,
        fontSize: typography.fontSize.sm,
    },
    testButton: {
        backgroundColor: colors.primary[500],
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.sm,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 80,
    },
    testButtonText: {
        color: '#fff',
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    testResponse: {
        marginTop: spacing.sm,
        padding: spacing.md,
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.sm,
        borderLeftWidth: 3,
        borderLeftColor: colors.primary[400],
    },
    testResponseText: {
        fontSize: typography.fontSize.sm,
        color: colors.text.primary,
        lineHeight: 20,
    },
    fieldLabel: {
        fontSize: typography.fontSize.md,
        fontWeight: '600',
        color: colors.text.primary,
    },
    helpText: {
        fontSize: typography.fontSize.sm,
        color: colors.text.muted,
    },
    numberInput: {
        backgroundColor: colors.background.tertiary,
        color: colors.text.primary,
        padding: spacing.md,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border.default,
        fontSize: typography.fontSize.md,
        textAlign: 'center',
    },
    modelChip: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: borderRadius.full,
        backgroundColor: colors.background.primary,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    modelChipSelected: {
        backgroundColor: colors.primary[400],
        borderColor: colors.primary[400],
    },
    modelChipText: {
        fontSize: typography.fontSize.xs,
        color: colors.text.muted,
    },
    modelChipTextSelected: {
        color: '#fff',
        fontWeight: 'bold',
    },
    // Dropdown styles for AI Model Selection
    dropdown: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.background.tertiary,
        padding: spacing.md,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    dropdownText: {
        color: colors.text.primary,
        fontSize: typography.fontSize.md,
    },
    modelId: {
        fontSize: typography.fontSize.xs,
        color: colors.text.muted,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    modelName: {
        fontSize: typography.fontSize.md,
        fontWeight: '600',
        color: colors.text.primary,
    },
});
