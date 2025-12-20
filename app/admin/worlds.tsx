import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../lib/hooks/useTheme';
import { spacing, borderRadius, typography, shadows } from '../../lib/theme';
import { AnimatedPressable } from '../../components/ui/Animated';
import { getWorlds, saveWorld, deleteWorld, getGameEngines, saveGameEngine, deleteGameEngine } from '../../lib/firebase';
import type { WorldModule, WorldModuleType, GameEngine, StatDefinition, ResourceDefinition, FormFieldDefinition } from '../../lib/types';

export default function AdminWorldsScreen() {
    const { colors } = useThemeColors();
    const [worlds, setWorlds] = useState<WorldModule[]>([]);
    const [gameEngines, setGameEngines] = useState<GameEngine[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Game engine section
    const [showEngineSection, setShowEngineSection] = useState(false);
    const [isAddingEngine, setIsAddingEngine] = useState(false);
    const [editingEngineId, setEditingEngineId] = useState<string | null>(null);
    const [newEngine, setNewEngine] = useState<Partial<GameEngine>>({
        name: '',
        description: '',
        stats: [
            { id: 'strength', name: 'Strength', abbreviation: 'STR', min: 1, max: 20, default: 10 },
            { id: 'dexterity', name: 'Dexterity', abbreviation: 'DEX', min: 1, max: 20, default: 10 },
            { id: 'constitution', name: 'Constitution', abbreviation: 'CON', min: 1, max: 20, default: 10 },
            { id: 'intelligence', name: 'Intelligence', abbreviation: 'INT', min: 1, max: 20, default: 10 },
            { id: 'wisdom', name: 'Wisdom', abbreviation: 'WIS', min: 1, max: 20, default: 10 },
            { id: 'charisma', name: 'Charisma', abbreviation: 'CHA', min: 1, max: 20, default: 10 },
        ],
        resources: [
            { id: 'hp', name: 'Health', color: '#10b981', showInHUD: true },
            { id: 'mana', name: 'Mana', color: '#3b82f6', showInHUD: true },
        ],
        progression: { type: 'level', maxLevel: 20 },
        creationFields: [
            {
                id: 'class', type: 'select', label: 'Class', required: true, options: [
                    { value: 'fighter', label: 'Fighter' },
                    { value: 'wizard', label: 'Wizard' },
                    { value: 'rogue', label: 'Rogue' },
                ]
            },
            { id: 'background', type: 'text', label: 'Background', required: false },
        ],
        hudLayout: {
            showStats: true,
            showResources: true,
            showAbilities: true,
            showInventory: false,
            layout: 'expanded',
        },
        aiContext: 'A fantasy RPG system with six core attributes. Characters progress through levels, gaining power and abilities.',
        order: 0,
    });

    // Form state
    const [isAdding, setIsAdding] = useState(false);
    const [editingWorldId, setEditingWorldId] = useState<string | null>(null);
    const [newWorld, setNewWorld] = useState<Partial<WorldModule>>({
        name: '',
        subtitle: '',
        description: '',
        icon: '⚔️',
        color: '#ffd700',
        type: 'classic',
        features: [],
        customRules: '',
        initialNarrative: '',
        generateIntro: false,
        order: 0,
    });
    const [newFeature, setNewFeature] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [worldsData, enginesData] = await Promise.all([
                getWorlds(),
                getGameEngines(),
            ]);
            setWorlds(worldsData);
            setGameEngines(enginesData);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to load data');
        } finally {
            setIsLoading(false);
        }
    };


    const loadWorlds = async () => {
        setIsLoading(true);
        try {
            const data = await getWorlds();
            setWorlds(data);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to load worlds');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddWorld = async () => {
        if (!newWorld.name || !newWorld.description || !newWorld.type) {
            Alert.alert('Error', 'Please fill in all required fields');
            return;
        }

        setIsSaving(true);
        try {
            const id = editingWorldId || newWorld.name.toLowerCase().replace(/\s+/g, '-');
            const worldToSave: WorldModule = {
                ...newWorld as WorldModule,
                id,
                order: newWorld.order ?? worlds.length,
            };
            await saveWorld(worldToSave);
            Alert.alert('Success', `World ${editingWorldId ? 'updated' : 'added'} successfully`);
            setIsAdding(false);
            setEditingWorldId(null);
            setNewWorld({
                name: '',
                subtitle: '',
                description: '',
                icon: '⚔️',
                color: '#ffd700',
                type: 'classic',
                features: [],
                customRules: '',
                order: 0,
            });
            loadWorlds();
        } catch (error) {
            console.error(error);
            Alert.alert('Error', `Failed to ${editingWorldId ? 'update' : 'add'} world`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditWorld = (world: WorldModule) => {
        setNewWorld(world);
        setEditingWorldId(world.id);
        setIsAdding(true);
    };

    const handleDeleteWorld = (id: string) => {
        const performDelete = async () => {
            try {
                await deleteWorld(id);
                loadWorlds();
            } catch (error) {
                console.error(error);
                Alert.alert('Error', 'Failed to delete world');
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm('Are you sure you want to delete this world? This will not affect existing campaigns.')) {
                performDelete();
            }
        } else {
            Alert.alert(
                'Delete World',
                'Are you sure you want to delete this world? This will not affect existing campaigns.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: performDelete }
                ]
            );
        }
    };

    const seedDefaults = async () => {
        const defaults: WorldModule[] = [
            {
                id: 'classic',
                type: 'classic',
                name: 'The Classic',
                subtitle: 'Dungeons & Dragons 5th Edition',
                icon: '⚔️',
                color: '#ffd700',
                description: 'Experience the timeless fantasy of D&D with full 5e rules integration. Roll for initiative, manage spell slots, and explore dungeons with your party.',
                features: [
                    'Full D&D 5e stat system (STR, DEX, CON, INT, WIS, CHA)',
                    'Spell slot management',
                    'Equipment and inventory tracking',
                    'Classic fantasy setting',
                ],
                order: 0,
                customRules: '',
                initialNarrative: '*The tavern is warm and loud. You sit in the corner, polishing your gear. A shadow falls across your table.*',
                generateIntro: false,
            },
            {
                id: 'outworlder',
                type: 'outworlder',
                name: 'The Outworlder',
                subtitle: 'He Who Fights With Monsters',
                icon: '🌌',
                color: '#10b981',
                description: 'Enter a world where essence abilities define your power. Climb the ranks from Iron to Diamond as you absorb monster essences and unlock your confluence.',
                features: [
                    'Essence-based power system',
                    'Rank progression (Iron → Diamond)',
                    'Unique ability combinations',
                    'Blue Box system notifications',
                ],
                order: 1,
                customRules: '',
                initialNarrative: '*Darkness... then light. Blinding, violet light. You gasp for air as you wake up in a strange forest.*',
                generateIntro: false,
            },
            {
                id: 'praxis',
                type: 'tactical',
                name: 'PRAXIS: Operation Dark Tide',
                subtitle: 'Elite Tactical Operations',
                icon: '👤',
                color: '#8b5cf6',
                description: 'Join PRAXIS, an elite tactical unit operating in a world of supernatural threats. Complete missions, upgrade your gear, and lead covert operations against dark forces.',
                features: [
                    'Daily mission system with ranking',
                    'Tactical squad and unit management',
                    'Strategic stat point allocation',
                    'Gate and mission ranking system',
                ],
                order: 2,
                customRules: '',
                initialNarrative: '*[SYSTEM NOTIFICATION]*\n\n*Validation complete. Player registered. Welcome, Operative.*',
                generateIntro: false,
            },
        ];

        setIsSaving(true);
        try {
            for (const world of defaults) {
                await saveWorld(world);
            }
            Alert.alert('Success', 'Default worlds imported');
            loadWorlds();
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to seed defaults');
        } finally {
            setIsSaving(false);
        }
    };

    const seedDefaultEngines = async () => {
        const defaultEngines: GameEngine[] = [
            {
                id: 'classic',
                name: 'Classic D&D',
                description: 'D&D 5e style gameplay with six core attributes',
                order: 1,
                stats: [
                    { id: 'strength', name: 'Strength', abbreviation: 'STR', min: 1, max: 20, default: 10 },
                    { id: 'dexterity', name: 'Dexterity', abbreviation: 'DEX', min: 1, max: 20, default: 10 },
                    { id: 'constitution', name: 'Constitution', abbreviation: 'CON', min: 1, max: 20, default: 10 },
                    { id: 'intelligence', name: 'Intelligence', abbreviation: 'INT', min: 1, max: 20, default: 10 },
                    { id: 'wisdom', name: 'Wisdom', abbreviation: 'WIS', min: 1, max: 20, default: 10 },
                    { id: 'charisma', name: 'Charisma', abbreviation: 'CHA', min: 1, max: 20, default: 10 },
                ],
                resources: [
                    { id: 'hp', name: 'Health', color: '#10b981', showInHUD: true },
                ],
                progression: { type: 'level', maxLevel: 20 },
                creationFields: [
                    {
                        id: 'class', type: 'select', label: 'Class', required: true, options: [
                            { value: 'fighter', label: 'Fighter' },
                            { value: 'wizard', label: 'Wizard' },
                            { value: 'rogue', label: 'Rogue' },
                            { value: 'cleric', label: 'Cleric' },
                        ]
                    },
                    {
                        id: 'race', type: 'select', label: 'Race', required: true, options: [
                            { value: 'human', label: 'Human' },
                            { value: 'elf', label: 'Elf' },
                            { value: 'dwarf', label: 'Dwarf' },
                            { value: 'halfling', label: 'Halfling' },
                        ]
                    },
                    { id: 'background', type: 'text', label: 'Background', required: false },
                ],
                aiContext: 'D&D 5e fantasy RPG. Characters have six core attributes (STR, DEX, CON, INT, WIS, CHA) ranging from 1-20. Use d20 rolls for ability checks, adding relevant attribute modifiers. Combat uses turn-based initiative.',
            },
            {
                id: 'outworlder',
                name: 'Outworlder',
                description: 'HWFWM Essence System with rank-based progression',
                order: 2,
                stats: [
                    { id: 'power', name: 'Power', abbreviation: 'PWR', min: 1, max: 100, default: 10 },
                    { id: 'speed', name: 'Speed', abbreviation: 'SPD', min: 1, max: 100, default: 10 },
                    { id: 'spirit', name: 'Spirit', abbreviation: 'SPI', min: 1, max: 100, default: 10 },
                    { id: 'recovery', name: 'Recovery', abbreviation: 'REC', min: 1, max: 100, default: 10 },
                ],
                resources: [
                    { id: 'hp', name: 'Health', color: '#10b981', showInHUD: true },
                    { id: 'mana', name: 'Mana', color: '#3b82f6', showInHUD: true },
                    { id: 'stamina', name: 'Stamina', color: '#f59e0b', showInHUD: true },
                ],
                progression: {
                    type: 'rank',
                    ranks: [
                        { id: 'iron', name: 'Iron', order: 1 },
                        { id: 'bronze', name: 'Bronze', order: 2 },
                        { id: 'silver', name: 'Silver', order: 3 },
                        { id: 'gold', name: 'Gold', order: 4 },
                        { id: 'diamond', name: 'Diamond', order: 5 },
                    ]
                },
                creationFields: [
                    { id: 'essence1', type: 'text', label: 'First Essence', required: true },
                    { id: 'essence2', type: 'text', label: 'Second Essence', required: false },
                    { id: 'essence3', type: 'text', label: 'Third Essence', required: false },
                    { id: 'background', type: 'text', label: 'Origin Story', required: false },
                ],
                aiContext: 'HWFWM-style essence magic system. Characters progress through ranks (Iron → Bronze → Silver → Gold → Diamond). Powers come from absorbed essences. Stats are Power, Speed, Spirit, and Recovery (1-100 scale). Combat emphasizes essence ability combinations.',
            },
            {
                id: 'tactical',
                name: 'Praxis',
                description: 'Elite tactical operations system with mission-based progression',
                order: 3,
                stats: [
                    { id: 'strength', name: 'Strength', abbreviation: 'STR', min: 1, max: 999, default: 10 },
                    { id: 'agility', name: 'Agility', abbreviation: 'AGI', min: 1, max: 999, default: 10 },
                    { id: 'vitality', name: 'Vitality', abbreviation: 'VIT', min: 1, max: 999, default: 10 },
                    { id: 'intelligence', name: 'Intelligence', abbreviation: 'INT', min: 1, max: 999, default: 10 },
                    { id: 'sense', name: 'Sense', abbreviation: 'SEN', min: 1, max: 999, default: 10 },
                ],
                resources: [
                    { id: 'hp', name: 'Health', color: '#ef4444', showInHUD: true },
                    { id: 'mp', name: 'Mana', color: '#3b82f6', showInHUD: true },
                ],
                progression: { type: 'level', maxLevel: 100 },
                creationFields: [
                    {
                        id: 'class', type: 'select', label: 'Operative Class', required: true, options: [
                            { value: 'fighter', label: 'Fighter' },
                            { value: 'mage', label: 'Mage' },
                            { value: 'assassin', label: 'Assassin' },
                            { value: 'tank', label: 'Tank' },
                            { value: 'healer', label: 'Healer' },
                        ]
                    },
                    { id: 'title', type: 'text', label: 'Operative Title', required: false },
                ],
                aiContext: 'PRAXIS tactical operations system. Operatives have game-like stats (STR, AGI, VIT, INT, SEN) that can reach 999. Level-based progression up to level 100. Combat is tactical with skills, missions, and supernatural threat encounters. Stats grow significantly with each level.',
            },
        ];

        setIsSaving(true);
        try {
            for (const engine of defaultEngines) {
                await saveGameEngine(engine);
            }
            Alert.alert('Success', 'Default game engines seeded successfully');
            loadData();
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to seed default engines');
        } finally {
            setIsSaving(false);
        }
    };


    const addFeature = () => {
        if (!newFeature.trim()) return;
        setNewWorld(prev => ({
            ...prev,
            features: [...(prev.features || []), newFeature.trim()]
        }));
        setNewFeature('');
    };

    const removeFeature = (index: number) => {
        setNewWorld(prev => ({
            ...prev,
            features: (prev.features || []).filter((_, i) => i !== index)
        }));
    };

    const renderForm = () => (
        <View style={[styles.form, { backgroundColor: colors.background.secondary }]}>
            <Text style={[styles.formTitle, { color: colors.text.primary }]}>
                {editingWorldId ? 'Edit World' : 'Add New World'}
            </Text>

            <Text style={[styles.inputLabel, { color: colors.text.secondary }]}>Name *</Text>
            <TextInput
                style={[styles.input, { backgroundColor: colors.background.tertiary, color: colors.text.primary }]}
                value={newWorld.name}
                onChangeText={(text) => setNewWorld(prev => ({ ...prev, name: text }))}
                placeholder="e.g. Cyberpunk 2077"
                placeholderTextColor={colors.text.muted}
            />

            <Text style={[styles.inputLabel, { color: colors.text.secondary }]}>Subtitle</Text>
            <TextInput
                style={[styles.input, { backgroundColor: colors.background.tertiary, color: colors.text.primary }]}
                value={newWorld.subtitle}
                onChangeText={(text) => setNewWorld(prev => ({ ...prev, subtitle: text }))}
                placeholder="e.g. Night City Stories"
                placeholderTextColor={colors.text.muted}
            />

            <View style={styles.row}>
                <View style={{ flex: 1, marginRight: spacing.md }}>
                    <Text style={[styles.inputLabel, { color: colors.text.secondary }]}>Icon</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: colors.background.tertiary, color: colors.text.primary }]}
                        value={newWorld.icon}
                        onChangeText={(text) => setNewWorld(prev => ({ ...prev, icon: text }))}
                        placeholder="Emoji"
                        placeholderTextColor={colors.text.muted}
                    />
                </View>
                <View style={{ flex: 2 }}>
                    <Text style={[styles.inputLabel, { color: colors.text.secondary }]}>Color (Hex)</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: colors.background.tertiary, color: colors.text.primary }]}
                        value={newWorld.color}
                        onChangeText={(text) => setNewWorld(prev => ({ ...prev, color: text }))}
                        placeholder="#ff0000"
                        placeholderTextColor={colors.text.muted}
                    />
                </View>
            </View>

            <Text style={[styles.inputLabel, { color: colors.text.secondary }]}>Game Engine / Type *</Text>
            <View style={styles.typeSelector}>
                {gameEngines.map(engine => (
                    <TouchableOpacity
                        key={engine.id}
                        style={[
                            styles.typeChip,
                            newWorld.type === engine.name ? { backgroundColor: colors.primary[500] } : { backgroundColor: colors.background.tertiary }
                        ]}
                        onPress={() => setNewWorld(prev => ({ ...prev, type: engine.name as WorldModuleType }))}
                    >
                        <Text style={[styles.typeText, { color: newWorld.type === engine.name ? '#fff' : colors.text.secondary }]}>
                            {engine.name}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={[styles.inputLabel, { color: colors.text.secondary }]}>Description *</Text>
            <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.background.tertiary, color: colors.text.primary }]}
                value={newWorld.description}
                onChangeText={(text) => setNewWorld(prev => ({ ...prev, description: text }))}
                multiline
                numberOfLines={3}
                placeholder="Describe the world..."
                placeholderTextColor={colors.text.muted}
            />

            <Text style={[styles.inputLabel, { color: colors.text.secondary }]}>Custom AI Rules (Optional)</Text>
            <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.background.tertiary, color: colors.text.primary }]}
                value={newWorld.customRules}
                onChangeText={(text) => setNewWorld(prev => ({ ...prev, customRules: text }))}
                multiline
                numberOfLines={4}
                placeholder="Specific rules for AI behavior (e.g. 'In this world, magic is powered by sunlight'...)"
                placeholderTextColor={colors.text.muted}
            />

            <Text style={[styles.inputLabel, { color: colors.text.secondary }]}>Initial Narrative / First Words</Text>
            <View style={{ marginBottom: spacing.md }}>
                <TouchableOpacity
                    style={[styles.row, { alignItems: 'center', marginBottom: spacing.sm }]}
                    onPress={() => setNewWorld(prev => ({ ...prev, generateIntro: !prev.generateIntro }))}
                >
                    <Ionicons
                        name={newWorld.generateIntro ? "checkbox" : "square-outline"}
                        size={24}
                        color={newWorld.generateIntro ? colors.primary[500] : colors.text.muted}
                    />
                    <Text style={{ marginLeft: spacing.sm, color: colors.text.primary, fontSize: typography.fontSize.md }}>
                        AI Generated (Overrides static text)
                    </Text>
                </TouchableOpacity>

                <TextInput
                    style={[
                        styles.input,
                        styles.textArea,
                        { backgroundColor: colors.background.tertiary, color: colors.text.primary },
                        newWorld.generateIntro && { opacity: 0.5 }
                    ]}
                    value={newWorld.initialNarrative}
                    onChangeText={(text) => setNewWorld(prev => ({ ...prev, initialNarrative: text }))}
                    multiline
                    numberOfLines={3}
                    placeholder="The opening text for a new campaign..."
                    placeholderTextColor={colors.text.muted}
                    editable={!newWorld.generateIntro}
                />
            </View>

            <Text style={[styles.inputLabel, { color: colors.text.secondary }]}>Features</Text>
            <View style={styles.featureInputRow}>
                <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0, backgroundColor: colors.background.tertiary, color: colors.text.primary }]}
                    value={newFeature}
                    onChangeText={setNewFeature}
                    placeholder="Add feature..."
                    placeholderTextColor={colors.text.muted}
                    onSubmitEditing={addFeature}
                />
                <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary[500] }]} onPress={addFeature}>
                    <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
            </View>
            <View style={styles.featuresList}>
                {newWorld.features?.map((f, i) => (
                    <View key={i} style={[styles.featureTag, { backgroundColor: colors.background.tertiary }]}>
                        <Text style={[styles.featureTagText, { color: colors.text.secondary }]}>{f}</Text>
                        <TouchableOpacity onPress={() => removeFeature(i)}>
                            <Ionicons name="close-circle" size={16} color={colors.status.error} />
                        </TouchableOpacity>
                    </View>
                ))}
            </View>

            <View style={styles.formButtons}>
                <TouchableOpacity
                    style={[styles.cancelButton, { borderColor: colors.border.default }]}
                    onPress={() => {
                        setIsAdding(false);
                        setEditingWorldId(null);
                    }}
                >
                    <Text style={{ color: colors.text.secondary }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: colors.primary[500] }]}
                    onPress={handleAddWorld}
                    disabled={isSaving}
                >
                    {isSaving ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Text style={styles.saveButtonText}>{editingWorldId ? 'Update World' : 'Create World'}</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]} edges={['top']}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text.primary }]}>World Management</Text>
                <View style={styles.headerActions}>
                    {!worlds.length && !isLoading && (
                        <TouchableOpacity style={[styles.seedButton, { backgroundColor: colors.background.secondary }]} onPress={seedDefaults}>
                            <Ionicons name="download-outline" size={20} color={colors.primary[500]} />
                            <Text style={[styles.seedText, { color: colors.primary[500] }]}>Import Defaults</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={[styles.addFab, { backgroundColor: colors.primary[500] }]}
                        onPress={() => {
                            setEditingWorldId(null);
                            setNewWorld({
                                name: '',
                                subtitle: '',
                                description: '',
                                icon: '⚔️',
                                color: '#ffd700',
                                type: 'classic',
                                features: [],
                                customRules: '',
                                order: worlds.length,
                            });
                            setIsAdding(true);
                        }}
                    >
                        <Ionicons name="add" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {isAdding && renderForm()}

                {/* Game Engines Section */}
                <TouchableOpacity
                    style={[styles.sectionHeader, { backgroundColor: colors.background.secondary }]}
                    onPress={() => setShowEngineSection(!showEngineSection)}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <Ionicons name="cog-outline" size={20} color={colors.primary[500]} />
                        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Game Engines ({gameEngines.length})</Text>
                    </View>
                    <Ionicons name={showEngineSection ? 'chevron-up' : 'chevron-down'} size={20} color={colors.text.muted} />
                </TouchableOpacity>

                {showEngineSection && (
                    <View style={[styles.engineSection, { backgroundColor: colors.background.tertiary }]}>
                        {/* Seed Button */}
                        {!gameEngines.length && !isLoading && (
                            <TouchableOpacity
                                style={[styles.seedButton, { backgroundColor: colors.background.secondary, marginBottom: spacing.md }]}
                                onPress={seedDefaultEngines}
                            >
                                <Ionicons name="download-outline" size={20} color={colors.primary[500]} />
                                <Text style={[styles.seedText, { color: colors.primary[500] }]}>Seed Default Engines</Text>
                            </TouchableOpacity>
                        )}

                        {/* Engine List */}
                        {gameEngines.map(engine => (
                            <View key={engine.id} style={[styles.engineRow, { borderBottomColor: colors.border.default }]}>
                                <View>
                                    <Text style={[styles.engineName, { color: colors.text.primary }]}>{engine.name}</Text>
                                    <Text style={[styles.engineDesc, { color: colors.text.muted }]}>{engine.description}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                                    <TouchableOpacity
                                        onPress={() => {
                                            setEditingEngineId(engine.id);
                                            setNewEngine(engine);  // Load complete engine data
                                            setIsAddingEngine(true);
                                        }}
                                    >
                                        <Ionicons name="pencil-outline" size={18} color={colors.primary[500]} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={async () => {
                                            if (Platform.OS === 'web' && !window.confirm(`Delete engine "${engine.name}"?`)) return;
                                            await deleteGameEngine(engine.id);
                                            loadData();
                                        }}
                                    >
                                        <Ionicons name="trash-outline" size={18} color={colors.status.error} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}

                        {/* Add/Edit Engine Form */}
                        {isAddingEngine ? (
                            <ScrollView style={styles.engineForm}>
                                {/* Basic Info */}
                                <Text style={[styles.sectionSubtitle, { color: colors.text.primary }]}>Basic Information</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.background.primary, color: colors.text.primary }]}
                                    placeholder="Engine name (e.g. classic)"
                                    placeholderTextColor={colors.text.muted}
                                    value={newEngine.name}
                                    onChangeText={(text) => setNewEngine(prev => ({ ...prev, name: text }))}
                                />
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.background.primary, color: colors.text.primary }]}
                                    placeholder="Description"
                                    placeholderTextColor={colors.text.muted}
                                    value={newEngine.description}
                                    onChangeText={(text) => setNewEngine(prev => ({ ...prev, description: text }))}
                                />

                                {/* Stats Section */}
                                <Text style={[styles.sectionSubtitle, { color: colors.text.primary, marginTop: spacing.lg }]}>Stats</Text>

                                {/* Stat Point Budget */}
                                <View style={{ marginBottom: spacing.md }}>
                                    <Text style={[styles.miniLabel, { color: colors.text.muted, marginBottom: spacing.xs }]}>Stat Point Budget (optional)</Text>
                                    <TextInput
                                        style={[styles.smallInput, { backgroundColor: colors.background.primary, color: colors.text.primary }]}
                                        placeholder="Total points for character creation (e.g., 27)"
                                        placeholderTextColor={colors.text.muted}
                                        keyboardType="number-pad"
                                        value={newEngine.statPointBudget?.toString() || ''}
                                        onChangeText={(text) => {
                                            const value = text ? parseInt(text) : undefined;
                                            setNewEngine(prev => ({ ...prev, statPointBudget: value }));
                                        }}
                                    />
                                    <Text style={{ color: colors.text.muted, fontSize: typography.fontSize.xs, marginTop: spacing.xs }}>
                                        Leave empty for unlimited points. Players can only spend this many points above the default values.
                                    </Text>
                                </View>
                                {newEngine.stats?.map((stat, index) => (
                                    <View key={index} style={[styles.statEditRow, { backgroundColor: colors.background.primary, borderColor: colors.border.default }]}>
                                        <View style={{ flex: 1, gap: spacing.xs }}>
                                            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                                                <TextInput
                                                    style={[styles.smallInput, { backgroundColor: colors.background.secondary, color: colors.text.primary, flex: 1 }]}
                                                    placeholder="Name"
                                                    placeholderTextColor={colors.text.muted}
                                                    value={stat.name}
                                                    onChangeText={(text) => {
                                                        const newStats = [...(newEngine.stats || [])];
                                                        newStats[index] = { ...newStats[index], name: text };
                                                        setNewEngine(prev => ({ ...prev, stats: newStats }));
                                                    }}
                                                />
                                                <TextInput
                                                    style={[styles.smallInput, { backgroundColor: colors.background.secondary, color: colors.text.primary, width: 80 }]}
                                                    placeholder="Abbr"
                                                    placeholderTextColor={colors.text.muted}
                                                    value={stat.abbreviation}
                                                    onChangeText={(text) => {
                                                        const newStats = [...(newEngine.stats || [])];
                                                        newStats[index] = { ...newStats[index], abbreviation: text.toUpperCase() };
                                                        setNewEngine(prev => ({ ...prev, stats: newStats }));
                                                    }}
                                                />
                                            </View>
                                            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[styles.miniLabel, { color: colors.text.muted }]}>Min</Text>
                                                    <TextInput
                                                        style={[styles.smallInput, { backgroundColor: colors.background.secondary, color: colors.text.primary }]}
                                                        placeholder="Min"
                                                        placeholderTextColor={colors.text.muted}
                                                        keyboardType="number-pad"
                                                        value={stat.min.toString()}
                                                        onChangeText={(text) => {
                                                            const newStats = [...(newEngine.stats || [])];
                                                            newStats[index] = { ...newStats[index], min: parseInt(text) || 0 };
                                                            setNewEngine(prev => ({ ...prev, stats: newStats }));
                                                        }}
                                                    />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[styles.miniLabel, { color: colors.text.muted }]}>Max</Text>
                                                    <TextInput
                                                        style={[styles.smallInput, { backgroundColor: colors.background.secondary, color: colors.text.primary }]}
                                                        placeholder="Max"
                                                        placeholderTextColor={colors.text.muted}
                                                        keyboardType="number-pad"
                                                        value={stat.max.toString()}
                                                        onChangeText={(text) => {
                                                            const newStats = [...(newEngine.stats || [])];
                                                            newStats[index] = { ...newStats[index], max: parseInt(text) || 30 };
                                                            setNewEngine(prev => ({ ...prev, stats: newStats }));
                                                        }}
                                                    />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[styles.miniLabel, { color: colors.text.muted }]}>Default</Text>
                                                    <TextInput
                                                        style={[styles.smallInput, { backgroundColor: colors.background.secondary, color: colors.text.primary }]}
                                                        placeholder="Default"
                                                        placeholderTextColor={colors.text.muted}
                                                        keyboardType="number-pad"
                                                        value={stat.default.toString()}
                                                        onChangeText={(text) => {
                                                            const newStats = [...(newEngine.stats || [])];
                                                            newStats[index] = { ...newStats[index], default: parseInt(text) || 10 };
                                                            setNewEngine(prev => ({ ...prev, stats: newStats }));
                                                        }}
                                                    />
                                                </View>
                                            </View>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => {
                                                const newStats = [...(newEngine.stats || [])];
                                                newStats.splice(index, 1);
                                                setNewEngine(prev => ({ ...prev, stats: newStats }));
                                            }}
                                            style={{ paddingLeft: spacing.sm }}
                                        >
                                            <Ionicons name="trash-outline" size={20} color={colors.status.error} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                <TouchableOpacity
                                    style={[styles.addItemBtn, { borderColor: colors.primary[500] }]}
                                    onPress={() => {
                                        const newStat: StatDefinition = {
                                            id: `stat${(newEngine.stats?.length || 0) + 1}`,
                                            name: 'New Stat',
                                            abbreviation: 'NEW',
                                            min: 1,
                                            max: 30,
                                            default: 10,
                                        };
                                        setNewEngine(prev => ({ ...prev, stats: [...(prev.stats || []), newStat] }));
                                    }}
                                >
                                    <Ionicons name="add" size={16} color={colors.primary[500]} />
                                    <Text style={[styles.addItemText, { color: colors.primary[500] }]}>Add Stat</Text>
                                </TouchableOpacity>

                                {/* Resources Section */}
                                <Text style={[styles.sectionSubtitle, { color: colors.text.primary, marginTop: spacing.lg }]}>Resources</Text>
                                {newEngine.resources?.map((resource, index) => (
                                    <View key={index} style={[styles.statEditRow, { backgroundColor: colors.background.primary, borderColor: colors.border.default }]}>
                                        <View style={{ flex: 1, gap: spacing.xs }}>
                                            <TextInput
                                                style={[styles.smallInput, { backgroundColor: colors.background.secondary, color: colors.text.primary }]}
                                                placeholder="Resource Name (e.g., Health, Mana)"
                                                placeholderTextColor={colors.text.muted}
                                                value={resource.name}
                                                onChangeText={(text) => {
                                                    const newResources = [...(newEngine.resources || [])];
                                                    newResources[index] = { ...newResources[index], name: text };
                                                    setNewEngine(prev => ({ ...prev, resources: newResources }));
                                                }}
                                            />
                                            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[styles.miniLabel, { color: colors.text.muted }]}>Color (hex)</Text>
                                                    <TextInput
                                                        style={[styles.smallInput, { backgroundColor: colors.background.secondary, color: colors.text.primary }]}
                                                        placeholder="#10b981"
                                                        placeholderTextColor={colors.text.muted}
                                                        value={resource.color}
                                                        onChangeText={(text) => {
                                                            const newResources = [...(newEngine.resources || [])];
                                                            newResources[index] = { ...newResources[index], color: text };
                                                            setNewEngine(prev => ({ ...prev, resources: newResources }));
                                                        }}
                                                    />
                                                </View>
                                                <View style={{ alignItems: 'center' }}>
                                                    <Text style={[styles.miniLabel, { color: colors.text.muted }]}>Show in HUD</Text>
                                                    <TouchableOpacity
                                                        onPress={() => {
                                                            const newResources = [...(newEngine.resources || [])];
                                                            newResources[index] = { ...newResources[index], showInHUD: !newResources[index].showInHUD };
                                                            setNewEngine(prev => ({ ...prev, resources: newResources }));
                                                        }}
                                                        style={[styles.toggleBtn, {
                                                            backgroundColor: resource.showInHUD ? colors.primary[500] : colors.background.tertiary
                                                        }]}
                                                    >
                                                        <Text style={{ color: resource.showInHUD ? '#fff' : colors.text.muted, fontSize: typography.fontSize.sm }}>
                                                            {resource.showInHUD ? 'Yes' : 'No'}
                                                        </Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => {
                                                const newResources = [...(newEngine.resources || [])];
                                                newResources.splice(index, 1);
                                                setNewEngine(prev => ({ ...prev, resources: newResources }));
                                            }}
                                            style={{ paddingLeft: spacing.sm }}
                                        >
                                            <Ionicons name="trash-outline" size={20} color={colors.status.error} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                <TouchableOpacity
                                    style={[styles.addItemBtn, { borderColor: colors.primary[500] }]}
                                    onPress={() => {
                                        const newResource: ResourceDefinition = {
                                            id: `resource${(newEngine.resources?.length || 0) + 1}`,
                                            name: 'New Resource',
                                            color: '#10b981',
                                            showInHUD: true,
                                        };
                                        setNewEngine(prev => ({ ...prev, resources: [...(prev.resources || []), newResource] }));
                                    }}
                                >
                                    <Ionicons name="add" size={16} color={colors.primary[500]} />
                                    <Text style={[styles.addItemText, { color: colors.primary[500] }]}>Add Resource</Text>
                                </TouchableOpacity>

                                {/* Progression Section */}
                                <Text style={[styles.sectionSubtitle, { color: colors.text.primary, marginTop: spacing.lg }]}>Progression</Text>
                                <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
                                    <TouchableOpacity
                                        style={[
                                            styles.typeChip,
                                            newEngine.progression?.type === 'level'
                                                ? { backgroundColor: colors.primary[500] }
                                                : { backgroundColor: colors.background.tertiary }
                                        ]}
                                        onPress={() => setNewEngine(prev => ({
                                            ...prev,
                                            progression: { type: 'level', maxLevel: 20 }
                                        }))}
                                    >
                                        <Text style={[styles.typeText, {
                                            color: newEngine.progression?.type === 'level' ? '#fff' : colors.text.secondary
                                        }]}>Level-Based</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.typeChip,
                                            newEngine.progression?.type === 'rank'
                                                ? { backgroundColor: colors.primary[500] }
                                                : { backgroundColor: colors.background.tertiary }
                                        ]}
                                        onPress={() => setNewEngine(prev => ({
                                            ...prev,
                                            progression: {
                                                type: 'rank',
                                                ranks: [
                                                    { id: 'iron', name: 'Iron', order: 1 },
                                                    { id: 'bronze', name: 'Bronze', order: 2 },
                                                    { id: 'silver', name: 'Silver', order: 3 },
                                                ]
                                            }
                                        }))}
                                    >
                                        <Text style={[styles.typeText, {
                                            color: newEngine.progression?.type === 'rank' ? '#fff' : colors.text.secondary
                                        }]}>Rank-Based</Text>
                                    </TouchableOpacity>
                                </View>
                                {newEngine.progression?.type === 'level' && (
                                    <TextInput
                                        style={[styles.input, { backgroundColor: colors.background.primary, color: colors.text.primary }]}
                                        placeholder="Max Level"
                                        placeholderTextColor={colors.text.muted}
                                        keyboardType="number-pad"
                                        value={newEngine.progression.maxLevel?.toString() || ''}
                                        onChangeText={(text) => setNewEngine(prev => ({
                                            ...prev,
                                            progression: { ...prev.progression!, maxLevel: parseInt(text) || 20 }
                                        }))}
                                    />
                                )}

                                {/* Creation Fields Section */}
                                <Text style={[styles.sectionSubtitle, { color: colors.text.primary, marginTop: spacing.lg }]}>Character Creation Fields</Text>
                                {newEngine.creationFields?.map((field, index) => (
                                    <View key={index} style={[styles.statEditRow, { backgroundColor: colors.background.primary, borderColor: colors.border.default }]}>
                                        <View style={{ flex: 1, gap: spacing.xs }}>
                                            <TextInput
                                                style={[styles.smallInput, { backgroundColor: colors.background.secondary, color: colors.text.primary }]}
                                                placeholder="Field Label (e.g., Class, Race)"
                                                placeholderTextColor={colors.text.muted}
                                                value={field.label}
                                                onChangeText={(text) => {
                                                    const newFields = [...(newEngine.creationFields || [])];
                                                    newFields[index] = { ...newFields[index], label: text };
                                                    setNewEngine(prev => ({ ...prev, creationFields: newFields }));
                                                }}
                                            />
                                            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[styles.miniLabel, { color: colors.text.muted }]}>Field Type</Text>
                                                    <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
                                                        {['text', 'select', 'number', 'statPicker'].map((type) => (
                                                            <TouchableOpacity
                                                                key={type}
                                                                onPress={() => {
                                                                    const newFields = [...(newEngine.creationFields || [])];
                                                                    newFields[index] = { ...newFields[index], type: type as any };
                                                                    setNewEngine(prev => ({ ...prev, creationFields: newFields }));
                                                                }}
                                                                style={[
                                                                    styles.toggleBtn,
                                                                    {
                                                                        backgroundColor: field.type === type ? colors.primary[500] : colors.background.tertiary,
                                                                        paddingHorizontal: spacing.sm,
                                                                        paddingVertical: spacing.xs / 2,
                                                                    }
                                                                ]}
                                                            >
                                                                <Text style={{
                                                                    color: field.type === type ? '#fff' : colors.text.muted,
                                                                    fontSize: typography.fontSize.xs
                                                                }}>
                                                                    {type}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </View>
                                                </View>
                                                <View style={{ alignItems: 'center' }}>
                                                    <Text style={[styles.miniLabel, { color: colors.text.muted }]}>Required</Text>
                                                    <TouchableOpacity
                                                        onPress={() => {
                                                            const newFields = [...(newEngine.creationFields || [])];
                                                            newFields[index] = { ...newFields[index], required: !newFields[index].required };
                                                            setNewEngine(prev => ({ ...prev, creationFields: newFields }));
                                                        }}
                                                        style={[styles.toggleBtn, {
                                                            backgroundColor: field.required ? colors.primary[500] : colors.background.tertiary
                                                        }]}
                                                    >
                                                        <Text style={{ color: field.required ? '#fff' : colors.text.muted, fontSize: typography.fontSize.sm }}>
                                                            {field.required ? 'Yes' : 'No'}
                                                        </Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>

                                            {/* Options Editor for Select Fields */}
                                            {field.type === 'select' && (
                                                <View style={{ marginTop: spacing.sm }}>
                                                    <Text style={[styles.miniLabel, { color: colors.text.muted, marginBottom: spacing.xs }]}>Dropdown Options</Text>
                                                    {field.options?.map((option, optIndex) => (
                                                        <View key={optIndex} style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs, alignItems: 'center' }}>
                                                            <TextInput
                                                                style={[styles.smallInput, { backgroundColor: colors.background.secondary, color: colors.text.primary, flex: 1 }]}
                                                                placeholder="Option name (e.g., Fighter)"
                                                                placeholderTextColor={colors.text.muted}
                                                                value={option.label}
                                                                onChangeText={(text) => {
                                                                    const newFields = [...(newEngine.creationFields || [])];
                                                                    const newOptions = [...(newFields[index].options || [])];
                                                                    // Auto-generate value from label
                                                                    const value = text.toLowerCase().replace(/\s+/g, '-');
                                                                    newOptions[optIndex] = { value, label: text };
                                                                    newFields[index] = { ...newFields[index], options: newOptions };
                                                                    setNewEngine(prev => ({ ...prev, creationFields: newFields }));
                                                                }}
                                                            />
                                                            <TouchableOpacity
                                                                onPress={() => {
                                                                    const newFields = [...(newEngine.creationFields || [])];
                                                                    const newOptions = [...(newFields[index].options || [])];
                                                                    newOptions.splice(optIndex, 1);
                                                                    newFields[index] = { ...newFields[index], options: newOptions };
                                                                    setNewEngine(prev => ({ ...prev, creationFields: newFields }));
                                                                }}
                                                                style={{ padding: spacing.xs }}
                                                            >
                                                                <Ionicons name="close-circle" size={20} color={colors.status.error} />
                                                            </TouchableOpacity>
                                                        </View>
                                                    ))}
                                                    <TouchableOpacity
                                                        style={[styles.addItemBtn, { borderColor: colors.primary[400], marginTop: spacing.xs }]}
                                                        onPress={() => {
                                                            const newFields = [...(newEngine.creationFields || [])];
                                                            const newOptions = [...(newFields[index].options || [])];
                                                            newOptions.push({ value: '', label: '' });
                                                            newFields[index] = { ...newFields[index], options: newOptions };
                                                            setNewEngine(prev => ({ ...prev, creationFields: newFields }));
                                                        }}
                                                    >
                                                        <Ionicons name="add" size={14} color={colors.primary[400]} />
                                                        <Text style={[styles.addItemText, { color: colors.primary[400], fontSize: typography.fontSize.xs }]}>Add Option</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => {
                                                const newFields = [...(newEngine.creationFields || [])];
                                                newFields.splice(index, 1);
                                                setNewEngine(prev => ({ ...prev, creationFields: newFields }));
                                            }}
                                            style={{ paddingLeft: spacing.sm }}
                                        >
                                            <Ionicons name="trash-outline" size={20} color={colors.status.error} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                <TouchableOpacity
                                    style={[styles.addItemBtn, { borderColor: colors.primary[500] }]}
                                    onPress={() => {
                                        const newField: FormFieldDefinition = {
                                            id: `field${(newEngine.creationFields?.length || 0) + 1}`,
                                            type: 'text',
                                            label: 'New Field',
                                            required: false,
                                        };
                                        setNewEngine(prev => ({ ...prev, creationFields: [...(prev.creationFields || []), newField] }));
                                    }}
                                >
                                    <Ionicons name="add" size={16} color={colors.primary[500]} />
                                    <Text style={[styles.addItemText, { color: colors.primary[500] }]}>Add Field</Text>
                                </TouchableOpacity>

                                {/* AI Context */}
                                <Text style={[styles.sectionSubtitle, { color: colors.text.primary, marginTop: spacing.lg }]}>AI Context</Text>
                                <TextInput
                                    style={[styles.input, styles.textArea, { backgroundColor: colors.background.primary, color: colors.text.primary }]}
                                    placeholder="Describe this game system to the AI (e.g., 'D&D 5e with six core stats...')"
                                    placeholderTextColor={colors.text.muted}
                                    multiline
                                    numberOfLines={4}
                                    value={newEngine.aiContext}
                                    onChangeText={(text) => setNewEngine(prev => ({ ...prev, aiContext: text }))}
                                />

                                {/* Action Buttons */}
                                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
                                    <TouchableOpacity
                                        style={[styles.saveBtn, { backgroundColor: colors.primary[500], flex: 1 }]}
                                        onPress={async () => {
                                            if (!newEngine.name) return;
                                            const engineToSave: GameEngine = {
                                                id: editingEngineId || newEngine.name.toLowerCase().replace(/\s+/g, '-'),
                                                name: newEngine.name,
                                                description: newEngine.description || '',
                                                stats: newEngine.stats || [],
                                                statPointBudget: newEngine.statPointBudget,
                                                resources: newEngine.resources || [],
                                                progression: newEngine.progression || { type: 'level', maxLevel: 20 },
                                                creationFields: newEngine.creationFields || [],
                                                hudLayout: newEngine.hudLayout || {
                                                    showStats: true,
                                                    showResources: true,
                                                    showAbilities: true,
                                                    showInventory: false,
                                                    layout: 'expanded',
                                                },
                                                aiContext: newEngine.aiContext || '',
                                                order: newEngine.order ?? gameEngines.length,
                                            };
                                            await saveGameEngine(engineToSave);
                                            setIsAddingEngine(false);
                                            setEditingEngineId(null);
                                            setNewEngine({
                                                name: '',
                                                description: '',
                                                stats: [],
                                                resources: [],
                                                progression: { type: 'level', maxLevel: 20 },
                                                creationFields: [],
                                                hudLayout: {
                                                    showStats: true,
                                                    showResources: true,
                                                    showAbilities: true,
                                                    showInventory: false,
                                                    layout: 'expanded',
                                                },
                                                aiContext: '',
                                                order: 0,
                                            });
                                            loadData();
                                        }}
                                    >
                                        <Text style={styles.saveBtnText}>{editingEngineId ? 'Update' : 'Add'}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.cancelBtn, { borderColor: colors.border.default, flex: 1 }]}
                                        onPress={() => {
                                            setIsAddingEngine(false);
                                            setEditingEngineId(null);
                                            setNewEngine({
                                                name: '',
                                                description: '',
                                                stats: [],
                                                resources: [],
                                                progression: { type: 'level', maxLevel: 20 },
                                                creationFields: [],
                                                hudLayout: {
                                                    showStats: true,
                                                    showResources: true,
                                                    showAbilities: true,
                                                    showInventory: false,
                                                    layout: 'expanded',
                                                },
                                                aiContext: '',
                                                order: 0,
                                            });
                                        }}
                                    >
                                        <Text style={[styles.cancelBtnText, { color: colors.text.secondary }]}>Cancel</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        ) : (
                            <TouchableOpacity
                                style={[styles.addEngineBtn, { borderColor: colors.primary[500] }]}
                                onPress={() => setIsAddingEngine(true)}
                            >
                                <Ionicons name="add" size={18} color={colors.primary[500]} />
                                <Text style={[styles.addEngineBtnText, { color: colors.primary[500] }]}>Add Game Engine</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}


                {isLoading ? (
                    <ActivityIndicator size="large" color={colors.primary[500]} style={{ marginTop: spacing.xxl }} />
                ) : worlds.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="planet-outline" size={64} color={colors.text.muted} />
                        <Text style={[styles.emptyText, { color: colors.text.muted }]}>No worlds found.</Text>
                        <Text style={[styles.emptySubtitle, { color: colors.text.muted }]}>Use the "Import Defaults" or add your first world.</Text>
                    </View>
                ) : (
                    worlds.map(world => (
                        <View key={world.id} style={[styles.worldCard, { backgroundColor: colors.background.secondary }]}>
                            <View style={styles.worldInfo}>
                                <View style={[styles.iconContainer, { backgroundColor: world.color + '20' }]}>
                                    <Text style={styles.iconText}>{world.icon}</Text>
                                </View>
                                <View style={styles.textContainer}>
                                    <View style={styles.worldTitleRow}>
                                        <Text style={[styles.worldName, { color: colors.text.primary }]}>{world.name}</Text>
                                        <Text style={[styles.typeBadge, { color: colors.primary[500] }]}>
                                            {(world.type as any) === 'shadowMonarch' ? 'tactical' : world.type}
                                        </Text>
                                    </View>
                                    <Text style={[styles.worldSubtitle, { color: colors.text.muted }]}>{world.subtitle}</Text>
                                </View>
                                <View style={styles.worldActions}>
                                    <TouchableOpacity
                                        style={styles.actionButton}
                                        onPress={() => handleEditWorld(world)}
                                    >
                                        <Ionicons name="pencil-outline" size={20} color={colors.primary[500]} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.actionButton}
                                        onPress={() => handleDeleteWorld(world.id)}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <Ionicons name="trash-outline" size={20} color={colors.status.error} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    ))
                )
                }
            </ScrollView >
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        padding: spacing.lg,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        fontSize: typography.fontSize.xl,
        fontWeight: 'bold',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    addFab: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.md,
    },
    seedButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        gap: spacing.xs,
    },
    seedText: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    content: {
        padding: spacing.lg,
        paddingBottom: spacing.xxl,
    },
    worldCard: {
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.md,
        ...shadows.sm,
    },
    worldInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 50,
        height: 50,
        borderRadius: borderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    iconText: {
        fontSize: 24,
    },
    textContainer: {
        flex: 1,
    },
    worldTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    worldName: {
        fontSize: typography.fontSize.lg,
        fontWeight: 'bold',
    },
    worldSubtitle: {
        fontSize: typography.fontSize.xs,
        marginBottom: 2,
    },
    typeBadge: {
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        backgroundColor: 'rgba(0,0,0,0.05)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    worldActions: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    actionButton: {
        padding: spacing.sm,
    },
    deleteButton: {
        padding: spacing.sm,
    },
    emptyState: {
        alignItems: 'center',
        marginTop: 100,
        gap: spacing.md,
    },
    emptyText: {
        fontSize: typography.fontSize.lg,
        fontWeight: '600',
    },
    emptySubtitle: {
        textAlign: 'center',
        paddingHorizontal: spacing.xl,
    },
    form: {
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.xl,
        ...shadows.md,
    },
    formTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: 'bold',
        marginBottom: spacing.lg,
    },
    inputLabel: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
        marginBottom: spacing.xs,
    },
    input: {
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginBottom: spacing.md,
        fontSize: typography.fontSize.md,
    },
    row: {
        flexDirection: 'row',
        marginBottom: spacing.md,
    },
    typeSelector: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    typeChip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
    },
    typeText: {
        fontSize: typography.fontSize.xs,
        fontWeight: 'bold',
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    featureInputRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    addButton: {
        width: 48,
        height: 48,
        borderRadius: borderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
    },
    featuresList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
        marginBottom: spacing.lg,
    },
    featureTag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.sm,
        gap: spacing.xs,
    },
    featureTagText: {
        fontSize: typography.fontSize.xs,
    },
    formButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: spacing.md,
    },
    cancelButton: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
    },
    saveButton: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 120,
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    // Game Engine styles
    sectionHeader: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.sm,
    },
    sectionTitle: {
        fontSize: typography.fontSize.md,
        fontWeight: '600' as const,
    },
    engineSection: {
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.lg,
    },
    engineRow: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
    },
    engineName: {
        fontSize: typography.fontSize.md,
        fontWeight: '600' as const,
    },
    engineDesc: {
        fontSize: typography.fontSize.sm,
    },
    engineForm: {
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    saveBtn: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.sm,
    },
    saveBtnText: {
        color: '#fff',
        fontWeight: '600' as const,
    },
    cancelBtn: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
    },
    cancelBtnText: {
        fontWeight: '600' as const,
    },
    addEngineBtn: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: spacing.xs,
        padding: spacing.sm,
        borderWidth: 1,
        borderStyle: 'dashed' as const,
        borderRadius: borderRadius.sm,
        justifyContent: 'center' as const,
        marginTop: spacing.sm,
    },
    addEngineBtnText: {
        fontWeight: '600' as const,
    },
    // Engine editor styles
    sectionSubtitle: {
        fontSize: typography.fontSize.md,
        fontWeight: '600' as const,
        marginBottom: spacing.sm,
    },
    statRow: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
        padding: spacing.sm,
        borderRadius: borderRadius.sm,
        marginBottom: spacing.xs,
    },
    statName: {
        fontSize: typography.fontSize.md,
        fontWeight: '600' as const,
    },
    statDetails: {
        fontSize: typography.fontSize.sm,
        marginTop: spacing.xs / 2,
    },
    addItemBtn: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: spacing.xs,
        padding: spacing.sm,
        borderWidth: 1,
        borderStyle: 'dashed' as const,
        borderRadius: borderRadius.sm,
        justifyContent: 'center' as const,
        marginTop: spacing.xs,
    },
    addItemText: {
        fontWeight: '600' as const,
    },
    // Editable field styles
    statEditRow: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'flex-start' as const,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
    },
    smallInput: {
        padding: spacing.sm,
        borderRadius: borderRadius.sm,
        fontSize: typography.fontSize.sm,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    miniLabel: {
        fontSize: typography.fontSize.xs,
        marginBottom: spacing.xs / 2,
        fontWeight: '500' as const,
    },
    toggleBtn: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.sm,
        minWidth: 50,
        alignItems: 'center' as const,
        marginTop: spacing.xs / 2,
    },
});
