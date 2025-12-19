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
import { getWorlds, saveWorld, deleteWorld } from '../../lib/firebase';
import type { WorldModule, WorldModuleType } from '../../lib/types';

const MODULE_TYPES: WorldModuleType[] = ['classic', 'outworlder', 'tactical'];

export default function AdminWorldsScreen() {
    const { colors } = useThemeColors();
    const [worlds, setWorlds] = useState<WorldModule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

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
        loadWorlds();
    }, []);

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
                {MODULE_TYPES.map(type => (
                    <TouchableOpacity
                        key={type}
                        style={[
                            styles.typeChip,
                            newWorld.type === type ? { backgroundColor: colors.primary[500] } : { backgroundColor: colors.background.tertiary }
                        ]}
                        onPress={() => setNewWorld(prev => ({ ...prev, type }))}
                    >
                        <Text style={[styles.typeText, { color: newWorld.type === type ? '#fff' : colors.text.secondary }]}>
                            {type}
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
                )}
            </ScrollView>
        </SafeAreaView>
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
});
