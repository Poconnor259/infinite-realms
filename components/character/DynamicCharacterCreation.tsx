import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Switch, Image, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, typography } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';
import { AnimatedPressable } from '../ui/Animated';
import { CharacterImport } from './CharacterImport';
import { ESSENCES, getRarityColor, type Essence } from '../../lib/essences';
import { generateText } from '../../lib/firebase';
import type { GameEngine, ModuleCharacter, FormFieldDefinition } from '../../lib/types';

interface DynamicCharacterCreationProps {
    characterName: string;
    engine: GameEngine;
    defaultLoadout?: {
        abilities: Array<string | {
            name: string;
            essence?: string;
            rank?: string;
            type?: string;
            cooldown?: number;
            cost?: string;
            costAmount?: number;
            description?: string;
        }>;
        items: string[];
        essences?: string[];
    };
    onComplete: (character: ModuleCharacter) => void;
    onBack: () => void;
}

export function DynamicCharacterCreation({ characterName, engine, defaultLoadout, onComplete, onBack }: DynamicCharacterCreationProps) {
    const { colors } = useThemeColors();

    // Initialize character data
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [stats, setStats] = useState<Record<string, number>>({});
    const [generatingField, setGeneratingField] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showImport, setShowImport] = useState(false);

    // Essence selection state (for Outworlder)
    const [essenceMode, setEssenceMode] = useState<'random' | 'choose'>('random');
    const [selectedEssence, setSelectedEssence] = useState<Essence | null>(null);
    const [importedEssences, setImportedEssences] = useState<string[]>([]); // Store all imported essences
    const [importedAbilities, setImportedAbilities] = useState<any[]>([]); // Store abilities from import
    const [importedRank, setImportedRank] = useState<string>(''); // Store rank from import
    const [showEssenceDropdown, setShowEssenceDropdown] = useState(false);

    // Custom Essence State
    const [isCustomEssence, setIsCustomEssence] = useState(false);
    const [customEssenceName, setCustomEssenceName] = useState('');
    const [customAbilityName, setCustomAbilityName] = useState('');
    const [customIntrinsicAbility, setCustomIntrinsicAbility] = useState('');


    // Check if this is an Outworlder-type world
    const isOutworlder = engine.id === 'outworlder' || engine.name?.toLowerCase().includes('outworlder');

    // Initialize stats with default values
    useEffect(() => {
        if (engine.stats) {
            const initialStats: Record<string, number> = {};
            engine.stats.forEach(stat => {
                initialStats[stat.id] = stat.default;
            });
            setStats(initialStats);
        }

        // Initialize form data with defaults
        if (engine.creationFields) {
            const initialData: Record<string, any> = {};
            engine.creationFields.forEach(field => {
                if (field.defaultValue !== undefined) {
                    initialData[field.id] = field.defaultValue;
                } else if (field.type === 'checkbox') {
                    initialData[field.id] = false;
                } else if (field.type === 'multiselect') {
                    initialData[field.id] = [];
                } else if (field.type === 'slider') {
                    initialData[field.id] = field.validation?.min ?? 0;
                }
            });
            setFormData(initialData);
        }
    }, [engine.id]); // Only re-run if engine ID changes, not the whole object

    const handleStatChange = (statId: string, delta: number) => {
        const stat = engine.stats?.find(s => s.id === statId);
        if (!stat) return;

        setStats(prev => {
            const newValue = (prev[statId] || stat.default) + delta;
            const clampedValue = Math.max(stat.min, Math.min(stat.max, newValue));

            // Check stat point budget if defined
            if (engine.statPointBudget !== undefined) {
                // Calculate points spent (difference from defaults)
                const pointsSpent = Object.keys(prev).reduce((total, key) => {
                    const s = engine.stats?.find(st => st.id === key);
                    if (!s) return total;
                    const spent = (key === statId ? clampedValue : prev[key]) - s.default;
                    return total + Math.max(0, spent); // Only count points above default
                }, 0);

                // Don't allow change if it exceeds budget
                if (pointsSpent > engine.statPointBudget) {
                    return prev;
                }
            }

            return {
                ...prev,
                [statId]: clampedValue
            };
        });
    };

    // Calculate remaining stat points
    const getRemainingPoints = () => {
        if (engine.statPointBudget === undefined) return null;

        const pointsSpent = Object.keys(stats).reduce((total, key) => {
            const stat = engine.stats?.find(s => s.id === key);
            if (!stat) return total;
            const spent = stats[key] - stat.default;
            return total + Math.max(0, spent);
        }, 0);

        return engine.statPointBudget - pointsSpent;
    };

    const handleCreate = () => {
        const engineId = (engine.id || (engine as any).type || '').toLowerCase();

        // Build character object based on engine configuration
        const character: any = {
            id: Date.now().toString(),
            name: characterName,
            level: 1,
            hp: {
                current: 100,
                max: 100,
            },
            inventory: defaultLoadout?.items?.map(item => ({
                id: Math.random().toString(36).substr(2, 9),
                name: item,
                quantity: 1,
                type: 'misc'
            })) || [],
            abilities: defaultLoadout?.abilities?.map(a => {
                if (typeof a === 'string') return a;
                const isClassic = engineId === 'classic' || engineId.includes('classic');
                const isTactical = engineId === 'tactical' || engineId === 'praxis' || engineId.includes('tactical') || engineId.includes('praxis');

                return {
                    ...a,
                    currentCooldown: 0,
                    rank: a.rank || (isOutworlder ? 'Iron' : (isTactical ? 'C' : '1')),
                    type: a.type || 'attack',
                    cost: a.cost || 'none',
                    costAmount: a.costAmount ?? 0,
                    cooldown: a.cooldown ?? 0,
                    description: a.description || `Starting ability: ${a.name}`,
                    essence: a.essence || (isOutworlder ? (selectedEssence?.name || 'Unknown') : 'None'),
                    // Classic specific
                    maxUses: (a as any).maxUses || 0,
                    usesRemaining: (a as any).maxUses || 0,
                    rechargeOn: (a as any).rechargeOn || 'longRest'
                };
            }) || [],
        };

        // Add stats
        if (engine.stats) {
            const statsObj: Record<string, number> = {};
            engine.stats.forEach(stat => {
                statsObj[stat.id] = stats[stat.id] || stat.default;
            });
            character.stats = statsObj;
        }

        // Add default resources based on engine type FIRST (Option C)
        // This ensures resources are always present, then engine.resources can override
        console.log('[DynamicCharacterCreation] Engine ID:', engineId, 'Engine:', engine.id, (engine as any).type);

        if (engineId === 'classic' || engineId.includes('classic')) {
            character.mana = { current: 100, max: 100 };
            character.stamina = { current: 100, max: 100 };
        } else if (engineId === 'tactical' || engineId === 'praxis' || engineId.includes('tactical') || engineId.includes('praxis')) {
            character.nanites = { current: 10, max: 100 };
            character.stamina = { current: 100, max: 100 };
        } else if (engineId === 'outworlder' || engineId.includes('outworlder')) {
            // Outworlder adds resources in the essence section below
        } else {
            // Unknown engine - add generic resources
            character.mana = { current: 100, max: 100 };
            character.stamina = { current: 100, max: 100 };
        }

        // Override with engine.resources if defined
        if (engine.resources && engine.resources.length > 0) {
            engine.resources.forEach((resource: any) => {
                if (resource.id !== 'hp') { // HP already added
                    character[resource.id] = {
                        current: resource.defaultValue ?? 100,
                        max: resource.maxValue ?? 100,
                    };
                }
            });
        }

        // Add form field data
        Object.keys(formData).forEach(key => {
            character[key] = formData[key];
        });

        // For Outworlder: Merge default essences if present
        if (isOutworlder && defaultLoadout?.essences && defaultLoadout.essences.length > 0) {
            if (!character.essences) character.essences = [];
            if (!character.abilities) character.abilities = [];

            // Merge unique essences
            const existingNames = new Set(character.essences.map((e: any) =>
                (typeof e === 'string' ? e : e.name).toLowerCase()
            ));

            defaultLoadout.essences.forEach((e: any) => {
                const name = typeof e === 'string' ? e : e.name;
                if (!existingNames.has(name.toLowerCase())) {
                    character.essences.push(name);

                    // Also add intrinsic ability if defined in default loadout
                    if (typeof e !== 'string' && e.intrinsicAbility) {
                        character.abilities.push({
                            name: e.intrinsicAbility,
                            type: 'special',
                            rank: 'Iron',
                            essence: name,
                            cooldown: 0,
                            currentCooldown: 0,
                            cost: 'mana',
                            costAmount: 10,
                            description: `Intrinsic ability from ${name} essence`
                        });
                    }
                }
            });
        }


        // Add essence data for Outworlder
        if (isOutworlder) {
            if (essenceMode === 'choose' && (importedEssences.length > 0 || selectedEssence || isCustomEssence)) {
                // Check if we have imported essences (full array)
                if (importedEssences.length > 0) {
                    // Use all imported essences
                    character.essences = importedEssences;
                    character.essenceSelection = 'imported';
                    // Handle imported abilities
                    if (importedAbilities.length > 0) {
                        character.abilities = importedAbilities;
                    }
                } else if (selectedEssence || isCustomEssence) {
                    // Player chose a specific essence via UI - skip AI prompt
                    const finalEssenceName = isCustomEssence ? (customEssenceName || 'Unknown') : (selectedEssence?.name || 'Unknown');

                    character.essences = [finalEssenceName];
                    character.essenceSelection = 'chosen';

                    // Add intrinsic abilities based on essence choice
                    if (!character.abilities) character.abilities = [];

                    if (isCustomEssence) {
                        character.abilities.push({
                            name: customIntrinsicAbility.trim() || customAbilityName || `Manifest ${finalEssenceName}`,
                            type: 'special', // Default type for custom
                            rank: 'Iron',
                            essence: finalEssenceName,
                            cooldown: 0,
                            currentCooldown: 0,
                            cost: 'mana',
                            costAmount: 10,
                            description: customIntrinsicAbility.trim() ? `Intrinsic ability from ${finalEssenceName} essence` : `Starting ability from ${finalEssenceName} essence`
                        });

                    } else if (selectedEssence) {
                        if (selectedEssence.name === 'Dimension') {
                            character.abilities.push('Spatial Awareness (Dimension - Intrinsic)');
                        } else if (selectedEssence.name === 'Technology') {
                            character.abilities.push('Schematic Vision (Technology - Intrinsic)');
                        }
                    }
                }

                // Use imported rank if available, otherwise default to Iron
                character.rank = importedRank || 'Iron';
                // Add mana/stamina for Outworlder
                character.mana = { current: 100, max: 100 };
                character.stamina = { current: 100, max: 100 };
            } else {
                // Random mode - let AI present options during gameplay
                character.essenceSelection = 'random';
                character.essences = [];
                character.rank = 'Iron';
                character.mana = { current: 100, max: 100 };
                character.stamina = { current: 100, max: 100 };
            }
        }

        onComplete(character);
    };

    // AI Generation for text fields
    const handleAIGenerate = async (fieldId: string, fieldLabel: string) => {
        const prompt = formData[fieldId] || '';

        setGeneratingField(fieldId);
        try {
            const aiPrompt = `Generate a ${fieldLabel.toLowerCase()} for a character named ${characterName} in a ${engine.name} game. ${prompt ? `User guidance: ${prompt}` : ''}. Respond with ONLY the generated text, no extra commentary. Keep it to 2-3 sentences.`;

            console.log('[AI Generate] Calling generateText with prompt:', aiPrompt);

            const response = await generateText({
                prompt: aiPrompt,
                maxLength: 150
            });

            console.log('[AI Generate] Response:', response);

            if (response.data.success && response.data.text) {
                setFormData(prev => ({ ...prev, [fieldId]: response.data.text }));
            } else {
                console.error('[AI Generate] Failed:', response.data);
                alert(`Failed to generate text: ${response.data.error || 'Unknown error'}`);
            }

        } catch (error: any) {
            console.error('[AI Generate] Error:', error);
            console.error('[AI Generate] Error details:', {
                message: error?.message,
                code: error?.code,
                details: error?.details
            });
            alert(`Failed to generate text: ${error?.message || 'Unknown error'}`);
        } finally {
            setGeneratingField(null);
        }
    };

    const handleImport = (data: any) => {
        // Apply imported stats
        if (data.stats && engine.stats) {
            const importedStats: Record<string, number> = {};
            engine.stats.forEach(stat => {
                // Try to match stat by ID or name
                const value = data.stats[stat.id] || data.stats[stat.name.toLowerCase()] || stat.default;
                importedStats[stat.id] = value;
            });
            setStats(importedStats);
        }

        // Apply imported form data
        if (engine.creationFields) {
            const importedFormData: Record<string, any> = { ...formData };
            engine.creationFields.forEach(field => {
                if (data[field.id] !== undefined) {
                    importedFormData[field.id] = data[field.id];
                }
            });
            setFormData(importedFormData);
        }

        // Handle imported essences for Outworlder
        if (isOutworlder && data.essences && Array.isArray(data.essences) && data.essences.length > 0) {
            // Store ALL imported essences
            setImportedEssences(data.essences);

            // Find matching essence from our list for UI display (first essence)
            const firstEssenceName = data.essences[0];
            const matchedEssence = ESSENCES.find(e =>
                e.name.toLowerCase() === firstEssenceName.toLowerCase()
            );

            if (matchedEssence) {
                setSelectedEssence(matchedEssence);
            } else {
                // Create a custom essence entry for imported essences not in our list
                setSelectedEssence({
                    name: firstEssenceName,
                    rarity: 'Uncommon',
                    category: 'Concept'
                });
            }
            // Switch to choose mode since we have specific essences
            setEssenceMode('choose');
        }

        // Handle imported abilities (Outworlder specific)
        if (isOutworlder && data.abilities && Array.isArray(data.abilities)) {
            setImportedAbilities(data.abilities);
        }

        // Handle imported rank
        if (isOutworlder && data.rank) {
            setImportedRank(data.rank);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <TouchableOpacity onPress={onBack} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
                        </TouchableOpacity>
                        <Text style={[styles.title, { color: colors.text.primary }]}>
                            Create {characterName}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => setShowImport(true)}
                        style={[styles.importButton, { backgroundColor: colors.primary[900] + '40', borderColor: colors.primary[400] }]}
                    >
                        <Ionicons name="cloud-upload" size={18} color={colors.primary[400]} />
                        <Text style={[styles.importButtonText, { color: colors.primary[400] }]}>Import</Text>
                    </TouchableOpacity>
                </View>

                <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
                    {engine.name} Character
                </Text>

                {/* Essence Selection (Outworlder only) */}
                {isOutworlder && (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Starting Essence</Text>

                        {/* Mode Toggle */}
                        <View style={styles.essenceModeRow}>
                            <TouchableOpacity
                                style={[
                                    styles.essenceModeButton,
                                    essenceMode === 'random' && { backgroundColor: colors.primary[500] },
                                    essenceMode !== 'random' && { backgroundColor: colors.background.secondary, borderColor: colors.border.default, borderWidth: 1 }
                                ]}
                                onPress={() => { setEssenceMode('random'); setSelectedEssence(null); }}
                            >
                                <Ionicons
                                    name="shuffle"
                                    size={18}
                                    color={essenceMode === 'random' ? '#fff' : colors.text.secondary}
                                />
                                <Text style={[
                                    styles.essenceModeText,
                                    { color: essenceMode === 'random' ? '#fff' : colors.text.primary }
                                ]}>
                                    Discover In-Game
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.essenceModeButton,
                                    essenceMode === 'choose' && { backgroundColor: colors.primary[500] },
                                    essenceMode !== 'choose' && { backgroundColor: colors.background.secondary, borderColor: colors.border.default, borderWidth: 1 }
                                ]}
                                onPress={() => setEssenceMode('choose')}
                            >
                                <Ionicons
                                    name="list"
                                    size={18}
                                    color={essenceMode === 'choose' ? '#fff' : colors.text.secondary}
                                />
                                <Text style={[
                                    styles.essenceModeText,
                                    { color: essenceMode === 'choose' ? '#fff' : colors.text.primary }
                                ]}>
                                    Choose Essence
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.essenceHint, { color: colors.text.muted }]}>
                            {essenceMode === 'random'
                                ? 'You will choose from options presented during gameplay'
                                : 'Select your starting essence from the full list'}
                        </Text>

                        {/* Essence Dropdown (when Choose mode) */}
                        {essenceMode === 'choose' && (
                            <TouchableOpacity
                                style={[
                                    styles.essenceDropdown,
                                    {
                                        backgroundColor: colors.background.secondary,
                                        borderColor: selectedEssence ? getRarityColor(selectedEssence.rarity) : colors.border.default
                                    }
                                ]}
                                onPress={() => setShowEssenceDropdown(true)}
                            >
                                {selectedEssence ? (
                                    <View style={styles.selectedEssence}>
                                        <Text style={[styles.essenceName, { color: colors.text.primary }]}>
                                            {selectedEssence.name}
                                        </Text>
                                        <Text style={[styles.essenceRarity, { color: getRarityColor(selectedEssence.rarity) }]}>
                                            {selectedEssence.rarity}
                                        </Text>
                                    </View>
                                ) : isCustomEssence ? (
                                    <View style={styles.selectedEssence}>
                                        <Text style={[styles.essenceName, { color: colors.text.primary }]}>
                                            {customEssenceName || 'Custom Essence'}
                                        </Text>
                                        <Text style={[styles.essenceRarity, { color: colors.primary[400] }]}>
                                            Custom
                                        </Text>
                                    </View>
                                ) : (
                                    <Text style={{ color: colors.text.muted }}>Tap to select essence...</Text>
                                )}
                                <Ionicons name="chevron-down" size={20} color={colors.text.secondary} />
                            </TouchableOpacity>
                        )}

                        {/* Custom Essence Input */}
                        {essenceMode === 'choose' && isCustomEssence && (
                            <View style={{ marginTop: spacing.sm }}>
                                <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>
                                    Essence Name *
                                </Text>
                                <TextInput
                                    style={[styles.input, {
                                        backgroundColor: colors.background.secondary,
                                        color: colors.text.primary,
                                        borderColor: colors.border.default,
                                        padding: spacing.sm,
                                        borderRadius: spacing.sm,
                                        borderWidth: 1,
                                    }]}
                                    placeholder="Enter custom essence name..."
                                    placeholderTextColor={colors.text.muted}
                                    value={customEssenceName}
                                    onChangeText={setCustomEssenceName}
                                />

                                <Text style={[styles.fieldLabel, { color: colors.text.secondary, marginTop: spacing.sm }]}>
                                    Intrinsic Ability (Optional)
                                </Text>
                                <TextInput
                                    style={[styles.input, {
                                        backgroundColor: colors.background.secondary,
                                        color: colors.text.primary,
                                        borderColor: colors.border.default,
                                        padding: spacing.sm,
                                        borderRadius: spacing.sm,
                                        borderWidth: 1,
                                    }]}
                                    placeholder="e.g., Dimensional Tear, Flame Breath..."
                                    placeholderTextColor={colors.text.muted}
                                    value={customIntrinsicAbility}
                                    onChangeText={setCustomIntrinsicAbility}
                                />

                            </View>
                        )}
                    </View>
                )}

                {/* Dynamic Form Fields */}
                {engine.creationFields && engine.creationFields.length > 0 && (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Character Details</Text>
                        {engine.creationFields.filter(f => f.id !== 'difficulty').map((field, index) => (
                            <View key={field.id} style={styles.fieldContainer}>
                                <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>
                                    {field.label}{field.required && ' *'}
                                </Text>
                                {field.type === 'text' || field.type === 'number' ? (
                                    <View>
                                        <TextInput
                                            style={[styles.input, {
                                                backgroundColor: colors.background.secondary,
                                                color: colors.text.primary,
                                                borderColor: colors.border.default
                                            }]}
                                            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                                            placeholderTextColor={colors.text.muted}
                                            value={formData[field.id] || ''}
                                            onChangeText={(text) => setFormData(prev => ({ ...prev, [field.id]: text }))}
                                            keyboardType={field.type === 'number' ? 'number-pad' : 'default'}
                                            multiline={field.type === 'text'}
                                            numberOfLines={field.type === 'text' ? 3 : 1}
                                        />
                                        {field.type === 'text' && (
                                            <TouchableOpacity
                                                style={[
                                                    styles.aiButton,
                                                    {
                                                        backgroundColor: colors.primary[500],
                                                        opacity: generatingField === field.id ? 0.7 : 1
                                                    }
                                                ]}
                                                onPress={() => handleAIGenerate(field.id, field.label)}
                                                disabled={generatingField === field.id}
                                            >
                                                {generatingField === field.id ? (
                                                    <ActivityIndicator size="small" color="#fff" />
                                                ) : (
                                                    <Ionicons name="sparkles" size={16} color="#fff" />
                                                )}
                                                <Text style={styles.aiButtonText}>
                                                    {generatingField === field.id ? 'Generating...' : 'Generate with AI'}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                        {field.type === 'text' && (
                                            <Text style={{ color: colors.text.muted, fontSize: typography.fontSize.xs, marginTop: spacing.xs }}>
                                                💡 Tip: Add details in the box above to guide the AI (e.g., "noble background" or "grew up in the mountains")
                                            </Text>
                                        )}
                                    </View>
                                ) : field.type === 'select' && field.options ? (
                                    <View style={styles.optionsContainer}>
                                        {field.options.map((option) => (
                                            <TouchableOpacity
                                                key={option.value}
                                                style={[
                                                    styles.optionChip,
                                                    {
                                                        backgroundColor: formData[field.id] === option.value
                                                            ? colors.primary[500]
                                                            : colors.background.tertiary,
                                                        borderColor: colors.border.default,
                                                    }
                                                ]}
                                                onPress={() => setFormData(prev => ({ ...prev, [field.id]: option.value }))}
                                            >
                                                <Text style={{
                                                    color: formData[field.id] === option.value ? '#fff' : colors.text.secondary,
                                                    fontSize: typography.fontSize.sm,
                                                }}>
                                                    {option.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                ) : field.type === 'textarea' ? (
                                    <View>
                                        <TextInput
                                            style={[styles.textareaInput, {
                                                backgroundColor: colors.background.secondary,
                                                color: colors.text.primary,
                                                borderColor: colors.border.default
                                            }]}
                                            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                                            placeholderTextColor={colors.text.muted}
                                            value={formData[field.id] || ''}
                                            onChangeText={(text) => setFormData(prev => ({ ...prev, [field.id]: text }))}
                                            multiline
                                            numberOfLines={5}
                                            textAlignVertical="top"
                                        />
                                        {(field.aiGeneratable !== false) && (
                                            <TouchableOpacity
                                                style={[
                                                    styles.aiButton,
                                                    {
                                                        backgroundColor: colors.primary[500],
                                                        opacity: generatingField === field.id ? 0.7 : 1
                                                    }
                                                ]}
                                                onPress={() => handleAIGenerate(field.id, field.label)}
                                                disabled={generatingField === field.id}
                                            >
                                                {generatingField === field.id ? (
                                                    <ActivityIndicator size="small" color="#fff" />
                                                ) : (
                                                    <Ionicons name="sparkles" size={16} color="#fff" />
                                                )}
                                                <Text style={styles.aiButtonText}>
                                                    {generatingField === field.id ? 'Generating...' : 'Generate with AI'}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ) : field.type === 'slider' ? (
                                    <View style={styles.sliderContainer}>
                                        <TouchableOpacity
                                            style={[styles.sliderButton, { backgroundColor: colors.background.tertiary }]}
                                            onPress={() => {
                                                const min = field.validation?.min ?? 0;
                                                const current = formData[field.id] ?? min;
                                                if (current > min) {
                                                    setFormData(prev => ({ ...prev, [field.id]: current - 1 }));
                                                }
                                            }}
                                        >
                                            <Ionicons name="remove" size={20} color={colors.text.primary} />
                                        </TouchableOpacity>
                                        <View style={styles.sliderValueContainer}>
                                            <Text style={[styles.sliderValue, { color: colors.text.primary }]}>
                                                {formData[field.id] ?? field.validation?.min ?? 0}
                                            </Text>
                                            <Text style={[styles.sliderRange, { color: colors.text.muted }]}>
                                                ({field.validation?.min ?? 0} - {field.validation?.max ?? 100})
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            style={[styles.sliderButton, { backgroundColor: colors.background.tertiary }]}
                                            onPress={() => {
                                                const min = field.validation?.min ?? 0;
                                                const max = field.validation?.max ?? 100;
                                                const current = formData[field.id] ?? min;
                                                if (current < max) {
                                                    setFormData(prev => ({ ...prev, [field.id]: current + 1 }));
                                                }
                                            }}
                                        >
                                            <Ionicons name="add" size={20} color={colors.text.primary} />
                                        </TouchableOpacity>
                                    </View>
                                ) : field.type === 'checkbox' ? (
                                    <View style={styles.checkboxContainer}>
                                        <Switch
                                            value={!!formData[field.id]}
                                            onValueChange={(value) => setFormData(prev => ({ ...prev, [field.id]: value }))}
                                            trackColor={{ false: colors.background.tertiary, true: colors.primary[500] }}
                                            thumbColor={formData[field.id] ? colors.primary[300] : colors.text.muted}
                                        />
                                        <Text style={[styles.checkboxLabel, { color: colors.text.secondary }]}>
                                            {formData[field.id] ? 'Yes' : 'No'}
                                        </Text>
                                    </View>
                                ) : field.type === 'multiselect' && field.options ? (
                                    <View style={styles.optionsContainer}>
                                        {field.options.map((option) => {
                                            const selected = (formData[field.id] || []).includes(option.value);
                                            return (
                                                <TouchableOpacity
                                                    key={option.value}
                                                    style={[
                                                        styles.optionChip,
                                                        {
                                                            backgroundColor: selected
                                                                ? colors.primary[500]
                                                                : colors.background.tertiary,
                                                            borderColor: colors.border.default,
                                                        }
                                                    ]}
                                                    onPress={() => {
                                                        setFormData(prev => {
                                                            const current = prev[field.id] || [];
                                                            if (selected) {
                                                                return { ...prev, [field.id]: current.filter((v: string) => v !== option.value) };
                                                            } else {
                                                                return { ...prev, [field.id]: [...current, option.value] };
                                                            }
                                                        });
                                                    }}
                                                >
                                                    <Text style={{
                                                        color: selected ? '#fff' : colors.text.secondary,
                                                        fontSize: typography.fontSize.sm,
                                                    }}>
                                                        {option.label}
                                                    </Text>
                                                    {selected && (
                                                        <Ionicons name="checkmark" size={14} color="#fff" style={{ marginLeft: 4 }} />
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                ) : field.type === 'image' ? (
                                    <View style={styles.imageFieldContainer}>
                                        {formData[field.id] ? (
                                            <Image
                                                source={{ uri: formData[field.id] }}
                                                style={styles.characterImage}
                                                resizeMode="cover"
                                            />
                                        ) : (
                                            <View style={[styles.imagePlaceholder, { backgroundColor: colors.background.tertiary, borderColor: colors.border.default }]}>
                                                <Ionicons name="person" size={48} color={colors.text.muted} />
                                                <Text style={{ color: colors.text.muted, marginTop: spacing.sm }}>No portrait</Text>
                                            </View>
                                        )}
                                        <TouchableOpacity
                                            style={[
                                                styles.aiButton,
                                                {
                                                    backgroundColor: colors.primary[500],
                                                    opacity: generatingField === field.id ? 0.7 : 1
                                                }
                                            ]}
                                            onPress={() => {
                                                // TODO: Implement AI image generation
                                                alert('AI portrait generation coming soon!');
                                            }}
                                            disabled={generatingField === field.id}
                                        >
                                            <Ionicons name="sparkles" size={16} color="#fff" />
                                            <Text style={styles.aiButtonText}>Generate Portrait</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : null}

                                {/* Help Text */}
                                {field.helpText && (
                                    <Text style={[styles.helpText, { color: colors.text.muted }]}>
                                        {field.helpText}
                                    </Text>
                                )}

                                {/* Validation Error */}
                                {errors[field.id] && (
                                    <Text style={[styles.errorText, { color: colors.status.error }]}>
                                        {errors[field.id]}
                                    </Text>
                                )}
                            </View>
                        ))}
                    </View>
                )}

                {/* Stats Section */}
                {engine.stats && engine.stats.length > 0 && (
                    <View style={styles.section}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
                            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Attributes</Text>
                            {engine.statPointBudget !== undefined && (
                                <View style={{ backgroundColor: colors.background.tertiary, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.md }}>
                                    <Text style={{ color: colors.text.primary, fontSize: typography.fontSize.sm, fontWeight: '600' }}>
                                        Points: {getRemainingPoints()} / {engine.statPointBudget}
                                    </Text>
                                </View>
                            )}
                        </View>
                        {engine.stats.map((stat) => (
                            <View key={stat.id} style={[styles.statRow, { borderColor: colors.border.default }]}>
                                <View style={styles.statInfo}>
                                    <Text style={[styles.statName, { color: colors.text.primary }]}>
                                        {stat.abbreviation}
                                    </Text>
                                    <Text style={[styles.statFullName, { color: colors.text.muted }]}>
                                        {stat.name}
                                    </Text>
                                </View>
                                <View style={styles.statControls}>
                                    <TouchableOpacity
                                        style={[styles.statButton, { backgroundColor: colors.background.tertiary }]}
                                        onPress={() => handleStatChange(stat.id, -1)}
                                    >
                                        <Ionicons name="remove" size={20} color={colors.text.primary} />
                                    </TouchableOpacity>
                                    <Text style={[styles.statValue, { color: colors.text.primary }]}>
                                        {stats[stat.id] || stat.default}
                                    </Text>
                                    <TouchableOpacity
                                        style={[styles.statButton, { backgroundColor: colors.background.tertiary }]}
                                        onPress={() => handleStatChange(stat.id, 1)}
                                    >
                                        <Ionicons name="add" size={20} color={colors.text.primary} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Action Buttons */}
                <View style={styles.actions}>
                    <AnimatedPressable
                        style={[styles.button, styles.backBtn, { borderColor: colors.border.default }]}
                        onPress={onBack}
                        disabled={isCreating}
                    >
                        <Text style={[styles.buttonText, { color: colors.text.secondary }]}>Back</Text>
                    </AnimatedPressable>
                    <AnimatedPressable
                        style={[
                            styles.button,
                            styles.confirmBtn,
                            { backgroundColor: colors.primary[500] },
                            isCreating && { opacity: 0.6 }
                        ]}
                        onPress={() => {
                            setIsCreating(true);
                            handleCreate();
                        }}
                        disabled={isCreating}
                    >
                        {isCreating ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <Text style={[styles.buttonText, { color: '#fff' }]}>Confirm</Text>
                        )}
                    </AnimatedPressable>
                </View>
            </ScrollView>

            {/* Import Modal */}
            <Modal
                visible={showImport}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowImport(false)}
            >
                <CharacterImport
                    worldType={engine.id || 'outworlder'}
                    onImport={handleImport}
                    onClose={() => setShowImport(false)}
                />
            </Modal>

            {/* Essence Picker Modal */}
            <Modal
                visible={showEssenceDropdown}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowEssenceDropdown(false)}
            >
                <View style={[styles.essenceModalContainer, { backgroundColor: colors.background.primary }]}>
                    <View style={styles.essenceModalHeader}>
                        <Text style={[styles.essenceModalTitle, { color: colors.text.primary }]}>
                            Select Essence
                        </Text>
                        <TouchableOpacity onPress={() => setShowEssenceDropdown(false)}>
                            <Ionicons name="close" size={24} color={colors.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    <TextInput
                        style={[styles.essenceSearch, {
                            backgroundColor: colors.background.secondary,
                            color: colors.text.primary,
                            borderColor: colors.border.default
                        }]}
                        placeholder="Search essences..."
                        placeholderTextColor={colors.text.muted}
                        value={formData._essenceSearch || ''}
                        onChangeText={(text) => setFormData(prev => ({ ...prev, _essenceSearch: text }))}
                    />

                    <ScrollView>
                        {['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'].map(rarity => {
                            const rarityEssences = ESSENCES.filter(e =>
                                e.rarity === rarity &&
                                (!formData._essenceSearch || e.name.toLowerCase().includes((formData._essenceSearch || '').toLowerCase()))
                            );
                            if (rarityEssences.length === 0) return null;

                            return (
                                <View key={rarity}>
                                    <Text style={[styles.essenceGroupTitle, { color: getRarityColor(rarity as any) }]}>
                                        {rarity}
                                    </Text>
                                    {rarityEssences.map(essence => (
                                        <TouchableOpacity
                                            key={essence.name}
                                            style={[
                                                styles.essenceItem,
                                                { backgroundColor: colors.background.secondary },
                                                selectedEssence?.name === essence.name && {
                                                    borderWidth: 2,
                                                    borderColor: getRarityColor(essence.rarity)
                                                }
                                            ]}
                                            onPress={() => {
                                                setSelectedEssence(essence);
                                                setIsCustomEssence(false);
                                                setShowEssenceDropdown(false);
                                                setFormData(prev => ({ ...prev, _essenceSearch: '' }));
                                            }}
                                        >
                                            <Text style={[styles.essenceItemName, { color: colors.text.primary }]}>
                                                {essence.name}
                                            </Text>
                                            <Text style={[styles.essenceItemRarity, { color: getRarityColor(essence.rarity) }]}>
                                                {essence.category}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            );
                        })}

                        {/* Custom Option */}
                        <View>
                            <Text style={[styles.essenceGroupTitle, { color: colors.primary[400], marginTop: spacing.md }]}>
                                Custom
                            </Text>
                            <TouchableOpacity
                                style={[
                                    styles.essenceItem,
                                    { backgroundColor: colors.background.secondary },
                                    isCustomEssence && {
                                        borderWidth: 2,
                                        borderColor: colors.primary[500]
                                    }
                                ]}
                                onPress={() => {
                                    setIsCustomEssence(true);
                                    setSelectedEssence(null);
                                    setShowEssenceDropdown(false);
                                    setFormData(prev => ({ ...prev, _essenceSearch: '' }));
                                }}
                            >
                                <Text style={[styles.essenceItemName, { color: colors.text.primary }]}>
                                    Custom Essence
                                </Text>
                                <Text style={[styles.essenceItemRarity, { color: colors.primary[400] }]}>
                                    Create Your Own
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: spacing.lg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    backButton: {
        marginRight: spacing.md,
    },
    title: {
        fontSize: typography.fontSize.xxl,
        fontWeight: 'bold',
    },
    subtitle: {
        fontSize: typography.fontSize.md,
        marginBottom: spacing.xl,
    },
    importButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: 1,
    },
    importButtonText: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: '600',
        marginBottom: spacing.md,
    },
    fieldContainer: {
        marginBottom: spacing.md,
    },
    fieldLabel: {
        fontSize: typography.fontSize.sm,
        marginBottom: spacing.xs,
        fontWeight: '500',
    },
    input: {
        padding: spacing.md,
        borderRadius: borderRadius.md,
        fontSize: typography.fontSize.md,
        borderWidth: 1,
    },
    optionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    optionChip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        borderWidth: 1,
    },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        marginBottom: spacing.sm,
    },
    statInfo: {
        flex: 1,
    },
    statName: {
        fontSize: typography.fontSize.lg,
        fontWeight: 'bold',
    },
    statFullName: {
        fontSize: typography.fontSize.sm,
    },
    statControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    statButton: {
        width: 36,
        height: 36,
        borderRadius: borderRadius.full,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statValue: {
        fontSize: typography.fontSize.xl,
        fontWeight: 'bold',
        minWidth: 40,
        textAlign: 'center',
    },
    actions: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.xl,
    },
    button: {
        flex: 1,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: 'center',
    },
    backBtn: {
        borderWidth: 1,
    },
    confirmBtn: {},
    buttonText: {
        fontSize: typography.fontSize.md,
        fontWeight: '600',
    },
    aiButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.md,
        marginTop: spacing.sm,
    },
    aiButtonText: {
        color: '#fff',
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    // New field type styles
    textareaInput: {
        padding: spacing.md,
        borderRadius: borderRadius.md,
        fontSize: typography.fontSize.md,
        borderWidth: 1,
        minHeight: 120,
        textAlignVertical: 'top',
    },
    sliderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    sliderButton: {
        width: 40,
        height: 40,
        borderRadius: borderRadius.full,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sliderValueContainer: {
        flex: 1,
        alignItems: 'center',
    },
    sliderValue: {
        fontSize: typography.fontSize.xl,
        fontWeight: 'bold',
    },
    sliderRange: {
        fontSize: typography.fontSize.xs,
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    checkboxLabel: {
        fontSize: typography.fontSize.md,
    },
    imageFieldContainer: {
        alignItems: 'center',
        gap: spacing.md,
    },
    characterImage: {
        width: 150,
        height: 150,
        borderRadius: borderRadius.lg,
    },
    imagePlaceholder: {
        width: 150,
        height: 150,
        borderRadius: borderRadius.lg,
        borderWidth: 2,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
    },
    helpText: {
        fontSize: typography.fontSize.xs,
        marginTop: spacing.xs,
    },
    errorText: {
        fontSize: typography.fontSize.xs,
        marginTop: spacing.xs,
    },
    // Essence selection styles
    essenceModeRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    essenceModeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
    },
    essenceModeText: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    essenceHint: {
        fontSize: typography.fontSize.sm,
        marginBottom: spacing.md,
        textAlign: 'center',
    },
    essenceDropdown: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
    },
    selectedEssence: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    essenceName: {
        fontSize: typography.fontSize.md,
        fontWeight: '600',
    },
    essenceRarity: {
        fontSize: typography.fontSize.sm,
        fontWeight: '500',
    },
    essenceModalContainer: {
        flex: 1,
        padding: spacing.lg,
    },
    essenceModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    essenceModalTitle: {
        fontSize: typography.fontSize.xl,
        fontWeight: 'bold',
    },
    essenceSearch: {
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        marginBottom: spacing.md,
        fontSize: typography.fontSize.md,
    },
    essenceGroupTitle: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
        marginTop: spacing.md,
        marginBottom: spacing.sm,
        paddingHorizontal: spacing.sm,
    },
    essenceItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.xs,
    },
    essenceItemName: {
        fontSize: typography.fontSize.md,
    },
    essenceItemRarity: {
        fontSize: typography.fontSize.xs,
        fontWeight: '500',
    },
});
