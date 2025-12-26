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
    const [brainDropdownOpen, setBrainDropdownOpen] = useState(false);
    const [voiceDropdownOpen, setVoiceDropdownOpen] = useState(false);

    // Model testing state
    const [brainTestInput, setBrainTestInput] = useState('Hello, world!');
    const [voiceTestInput, setVoiceTestInput] = useState('Hello, world!');
    const [brainTestResponse, setBrainTestResponse] = useState('');
    const [voiceTestResponse, setVoiceTestResponse] = useState('');
    const [testingBrain, setTestingBrain] = useState(false);
    const [testingVoice, setTestingVoice] = useState(false);

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
            setConfig(configResult.data);

            const aiDoc = await getDoc(doc(db, 'config', 'aiSettings'));
            if (aiDoc.exists()) {
                setAiSettings(aiDoc.data() as any);
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

    const testVoiceModel = async () => {
        if (!voiceTestInput.trim()) {
            Alert.alert('Error', 'Please enter a test message');
            return;
        }
        setTestingVoice(true);
        setVoiceTestResponse('');
        try {
            const result = await generateText({ prompt: voiceTestInput });
            if (result.data.success) {
                setVoiceTestResponse(result.data.text || 'No response');
            } else {
                setVoiceTestResponse(`Error: ${result.data.error}`);
            }
        } catch (error: any) {
            setVoiceTestResponse(`Error: ${error.message}`);
        } finally {
            setTestingVoice(false);
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

            {/* AI Settings Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>AI Model Defaults</Text>
                <View style={styles.card}>

                    {/* Refresh Button */}
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.sm }}>
                        <TouchableOpacity
                            onPress={refreshModels}
                            disabled={refreshingModels}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                        >
                            <Ionicons name="refresh" size={16} color={colors.primary[400]} />
                            <Text style={{ color: colors.primary[400], fontSize: 12 }}>
                                {refreshingModels ? 'Refreshing...' : 'Refresh Models'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Brain Model */}
                    <View style={styles.settingHeader}>
                        <Ionicons name="hardware-chip" size={24} color={colors.primary[400]} />
                        <Text style={styles.settingTitle}>Brain Model</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.dropdownButton}
                        onPress={() => { setBrainDropdownOpen(!brainDropdownOpen); setVoiceDropdownOpen(false); }}
                    >
                        <Text style={styles.dropdownButtonText}>
                            {availableModels.find(m => m.id === aiSettings.brainModel)?.name || aiSettings.brainModel}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color={colors.text.muted} />
                    </TouchableOpacity>
                    {brainDropdownOpen && (
                        <View style={styles.dropdownList}>
                            {brainModels.map(model => (
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
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                            <View style={[styles.providerBadge, { backgroundColor: model.provider === 'openai' ? '#10a37f20' : model.provider === 'anthropic' ? '#d9775720' : '#4285f420' }]}>
                                                <Text style={[styles.providerBadgeText, { color: model.provider === 'openai' ? '#10a37f' : model.provider === 'anthropic' ? '#d97757' : '#4285f4' }]}>
                                                    {model.provider === 'openai' ? 'OpenAI' : model.provider === 'anthropic' ? 'Anthropic' : 'Google'}
                                                </Text>
                                            </View>
                                            {model.contextWindow && (
                                                <Text style={styles.modelMetaText}>{(model.contextWindow / 1000).toFixed(0)}K context</Text>
                                            )}
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Brain Model Test */}
                    <View style={styles.testSection}>
                        <Text style={styles.testLabel}>Test Brain Model</Text>
                        <View style={styles.testInputRow}>
                            <TextInput
                                style={styles.testInput}
                                value={brainTestInput}
                                onChangeText={setBrainTestInput}
                                placeholder="Enter test message..."
                                placeholderTextColor={colors.text.muted}
                            />
                            <TouchableOpacity
                                style={[styles.testButton, testingBrain && { opacity: 0.6 }]}
                                onPress={testBrainModel}
                                disabled={testingBrain}
                            >
                                {testingBrain ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.testButtonText}>Test</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                        {brainTestResponse !== '' && (
                            <View style={styles.testResponse}>
                                <Text style={styles.testResponseText}>{brainTestResponse}</Text>
                            </View>
                        )}
                    </View>

                    {/* Voice Model */}
                    <View style={[styles.settingHeader, { marginTop: spacing.lg }]}>
                        <Ionicons name="chatbubbles" size={24} color={colors.gold.main} />
                        <Text style={styles.settingTitle}>Voice Model</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.dropdownButton}
                        onPress={() => { setVoiceDropdownOpen(!voiceDropdownOpen); setBrainDropdownOpen(false); }}
                    >
                        <Text style={styles.dropdownButtonText}>
                            {availableModels.find(m => m.id === aiSettings.voiceModel)?.name || aiSettings.voiceModel}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color={colors.text.muted} />
                    </TouchableOpacity>
                    {voiceDropdownOpen && (
                        <View style={styles.dropdownList}>
                            {voiceModels.map(model => (
                                <TouchableOpacity
                                    key={model.id}
                                    style={[styles.dropdownItem, aiSettings.voiceModel === model.id && styles.dropdownItemSelected]}
                                    onPress={() => {
                                        setAiSettings(prev => ({ ...prev, voiceModel: model.id }));
                                        setVoiceDropdownOpen(false);
                                    }}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.dropdownItemText}>{model.name}</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                            <View style={[styles.providerBadge, { backgroundColor: model.provider === 'openai' ? '#10a37f20' : model.provider === 'anthropic' ? '#d9775720' : '#4285f420' }]}>
                                                <Text style={[styles.providerBadgeText, { color: model.provider === 'openai' ? '#10a37f' : model.provider === 'anthropic' ? '#d97757' : '#4285f4' }]}>
                                                    {model.provider === 'openai' ? 'OpenAI' : model.provider === 'anthropic' ? 'Anthropic' : 'Google'}
                                                </Text>
                                            </View>
                                            {model.contextWindow && (
                                                <Text style={styles.modelMetaText}>{(model.contextWindow / 1000).toFixed(0)}K context</Text>
                                            )}
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Voice Model Test */}
                    <View style={styles.testSection}>
                        <Text style={styles.testLabel}>Test Voice Model</Text>
                        <View style={styles.testInputRow}>
                            <TextInput
                                style={styles.testInput}
                                value={voiceTestInput}
                                onChangeText={setVoiceTestInput}
                                placeholder="Enter test message..."
                                placeholderTextColor={colors.text.muted}
                            />
                            <TouchableOpacity
                                style={[styles.testButton, testingVoice && { opacity: 0.6 }]}
                                onPress={testVoiceModel}
                                disabled={testingVoice}
                            >
                                {testingVoice ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.testButtonText}>Test</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                        {voiceTestResponse !== '' && (
                            <View style={styles.testResponse}>
                                <Text style={styles.testResponseText}>{voiceTestResponse}</Text>
                            </View>
                        )}
                    </View>

                    <TouchableOpacity
                        style={[styles.saveButton, { marginTop: spacing.md }]}
                        onPress={saveAiSettings}
                        disabled={savingAi}
                    >
                        {savingAi ? <ActivityIndicator color="#000" /> : <Text style={styles.saveButtonText}>Save AI Defaults</Text>}
                    </TouchableOpacity>
                </View>
            </View>

            {/* API Keys Section */}
            <View style={styles.section}>
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
            </View>

            {/* Subscriptions */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Subscriptions & Limits</Text>
                <View style={styles.card}>
                    {(['scout', 'hero', 'legend'] as SubscriptionTier[]).map(tier => (
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
                        </View>
                    ))}
                </View>
            </View>

            {/* World Modules */}
            <View style={styles.section}>
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
            </View>

            {/* System Settings */}
            <View style={styles.section}>
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
                </View>
            </View>

            {/* SAVE ALL BUTTON */}
            <View style={{ marginBottom: spacing.xxl }}>
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
});
