
import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput, Alert, Platform, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius, shadows } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';
import { AnimatedPressable, FadeInView, StaggeredList } from '../../components/ui/Animated';
import { db, auth, KnowledgeDocument } from '../../lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import * as DocumentPicker from 'expo-document-picker';

type WorldModule = 'global' | 'classic' | 'outworlder' | 'shadowMonarch';
type Category = 'lore' | 'rules' | 'characters' | 'locations' | 'other';
type TargetModel = 'brain' | 'voice' | 'both';

const WORLD_MODULES: { value: WorldModule; label: string }[] = [
    { value: 'global', label: 'Global (All Modules)' },
    { value: 'classic', label: 'Classic D&D' },
    { value: 'outworlder', label: 'Outworlder (HWFWM)' },
    { value: 'shadowMonarch', label: 'PRAXIS: Operation Dark Tide' },
];

const CATEGORIES: { value: Category; label: string }[] = [
    { value: 'lore', label: 'Lore' },
    { value: 'rules', label: 'Rules' },
    { value: 'characters', label: 'Characters' },
    { value: 'locations', label: 'Locations' },
    { value: 'other', label: 'Other' },
];

const TARGET_MODELS: { value: TargetModel; label: string; icon: 'hardware-chip' | 'chatbubble-ellipses' | 'git-merge'; description: string }[] = [
    { value: 'brain', label: 'Brain (OpenAI)', icon: 'hardware-chip', description: 'Rules & game logic' },
    { value: 'voice', label: 'Voice (Claude)', icon: 'chatbubble-ellipses', description: 'Narrative & storytelling' },
    { value: 'both', label: 'Both Models', icon: 'git-merge', description: 'All AI systems' },
];

export default function AdminTrainingScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [seeding, setSeeding] = useState(false);
    const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const { colors } = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formName, setFormName] = useState('');
    const [formModule, setFormModule] = useState<WorldModule>('global');
    const [formCategory, setFormCategory] = useState<Category>('lore');
    const [formTargetModel, setFormTargetModel] = useState<TargetModel>('both');
    const [formContent, setFormContent] = useState('');
    const [formError, setFormError] = useState<string | null>(null);

    // Filter state
    const [filterModule, setFilterModule] = useState<WorldModule | 'all'>('all');
    const [filterCategory, setFilterCategory] = useState<Category | 'all'>('all');

    useEffect(() => {
        loadDocuments();
    }, []);

    const loadDocuments = async () => {
        try {
            setLoading(true);
            // Direct Firestore read (bypass Cloud Function CORS issues)
            const docsRef = collection(db, 'knowledgeDocuments');
            const q = query(docsRef, orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KnowledgeDocument));
            setDocuments(docs);
        } catch (error) {
            console.error('Failed to load documents:', error);
            Alert.alert('Error', 'Failed to load knowledge base: ' + (error as any).message);
        } finally {
            setLoading(false);
        }
    };

    // Default knowledge documents for seeding
    const DEFAULT_KNOWLEDGE_DOCS = [
        // GLOBAL
        { name: 'Core RPG Mechanics', worldModule: 'global' as WorldModule, category: 'rules' as Category, targetModel: 'brain' as TargetModel, content: `# Core RPG Mechanics\n\n## Dice Rolling\n- d20: Primary resolution die for skill checks and attacks\n- Modifiers: Stats, proficiency, and situational bonuses\n\n## Combat Flow\n1. Initiative: Determines turn order\n2. Action Phase: Move, Attack, Cast Spell, or Use Item\n3. Resolution: Roll to hit, calculate damage, apply effects\n\n## Skill Checks\n- Base DC 10 (Easy), 15 (Medium), 20 (Hard), 25 (Very Hard)\n- Natural 1 = Critical Failure, Natural 20 = Critical Success` },
        { name: 'Narrative Guidelines', worldModule: 'global' as WorldModule, category: 'other' as Category, targetModel: 'voice' as TargetModel, content: `# Narrative Voice Guidelines\n\n## Perspective\n- Always use second person ("You walk...")\n- NPCs speak in first person with distinct voices\n\n## Scene Structure\n- Opening: Set the scene\n- Action: React to player input\n- Resolution: Provide clear outcomes\n\n## Word Count\n- Standard: 150-250 words\n- Combat: Shorter, punchier` },
        { name: 'Player Interaction Patterns', worldModule: 'global' as WorldModule, category: 'rules' as Category, targetModel: 'both' as TargetModel, content: `# Player Interaction Patterns\n\n## When to Present Choices\n- Ambiguous situations\n- Moral dilemmas\n- Combat tactical decisions\n- Resource allocation\n\n## Choice Formatting\n- Use bullet points (•)\n- Limit to 2-4 choices\n- Make choices meaningfully different` },
        // CLASSIC
        { name: 'D&D 5e Core Rules', worldModule: 'classic' as WorldModule, category: 'rules' as Category, targetModel: 'brain' as TargetModel, content: `# D&D 5e Core Rules\n\n## Ability Scores (1-20)\n- STR, DEX, CON, INT, WIS, CHA\n\n## Modifier: (Score - 10) / 2\n\n## Combat\n- Attack: d20 + mod + proficiency vs AC\n- Critical Hit (Nat 20): Double damage dice\n- Death Saves: 3 successes = stable, 3 failures = death\n\n## Spell Slots\n- Cantrips: Unlimited\n- Long Rest: Recover all HP and spell slots` },
        { name: 'Forgotten Realms Lore', worldModule: 'classic' as WorldModule, category: 'lore' as Category, targetModel: 'voice' as TargetModel, content: `# The Forgotten Realms\n\n## Major Locations\n- Waterdeep: City of Splendors\n- Baldur's Gate: City of intrigue\n- Neverwinter: Jewel of the North\n\n## Common Gods\n- Tymora (luck), Tempus (war), Mystra (magic)\n\n## Tone: Epic fantasy, heroes rise from humble beginnings` },
        { name: 'Classic Character Classes', worldModule: 'classic' as WorldModule, category: 'characters' as Category, targetModel: 'both' as TargetModel, content: `# D&D 5e Classes\n\n## Martial: Fighter, Barbarian, Rogue, Monk\n## Spellcasters: Wizard, Sorcerer, Warlock, Cleric, Druid\n## Hybrid: Paladin, Ranger, Bard\n\n## Notes\n- Fighters: Multiple attacks\n- Rogues: Sneak Attack needs advantage\n- Barbarians: Damage resistance while raging` },
        // OUTWORLDER
        { name: 'Essence System Rules', worldModule: 'outworlder' as WorldModule, category: 'rules' as Category, targetModel: 'brain' as TargetModel, content: `# Outworlder Essence System\n\n## Stats (1-100)\n- Power, Speed, Spirit, Recovery\n\n## Ranks: Iron → Bronze → Silver → Gold → Diamond\n\n## Resources: HP, Mana, Stamina\n\n## Abilities: 4 slots per essence (16 total)\n- Rarity: Common to Legendary` },
        { name: 'Outworlder World Lore', worldModule: 'outworlder' as WorldModule, category: 'lore' as Category, targetModel: 'voice' as TargetModel, content: `# Pallimustus\n\n## Factions\n- Adventure Society: Quests and regulation\n- Magic Society: Awakening stones\n- Hegemony: Corrupt organization\n\n## Style\n- Modern protagonist in fantasy world\n- System notifications in [brackets]\n- Snarky inner monologue\n- Pop culture references OK` },
        { name: 'Blue Box System', worldModule: 'outworlder' as WorldModule, category: 'rules' as Category, targetModel: 'both' as TargetModel, content: `# Blue Box Notifications\n\n## Format\n[ABILITY ACTIVATED: NAME]\n[WARNING: THREAT DETECTED]\n[RANK UP AVAILABLE]\n\n## Types\n- ABILITY: Blue, skill use\n- WARNING: Red, danger\n- PROGRESS: Gold, advancement\n- LOOT: Green, items` },
        // PRAXIS
        { name: 'PRAXIS Combat System', worldModule: 'shadowMonarch' as WorldModule, category: 'rules' as Category, targetModel: 'brain' as TargetModel, content: `# PRAXIS Combat\n\n## Stats (max 999)\n- STR, AGI, VIT, INT, SEN\n\n## Resources: HP, MP\n\n## Levels: Max 100\n\n## Combat\n- Cover: +25% (partial), +50% (full)\n- Critical: 2x damage\n\n## Skills: Active, Passive, Ultimate` },
        { name: 'PRAXIS World Setting', worldModule: 'shadowMonarch' as WorldModule, category: 'lore' as Category, targetModel: 'voice' as TargetModel, content: `# PRAXIS: Operation Dark Tide\n\n## Gates: Dimensional rifts with monsters\n- Ranks: E (weak) through S (catastrophic)\n- Uncleared = Gate Break\n\n## PRAXIS Organization\n- Government supernatural response\n- Classes: Fighter, Mage, Assassin, Tank, Healer\n\n## Style: Military tone, [SYSTEM] notifications` },
        { name: 'PRAXIS Mission Structure', worldModule: 'shadowMonarch' as WorldModule, category: 'rules' as Category, targetModel: 'both' as TargetModel, content: `# PRAXIS Missions\n\n## Types\n- Gate Assault, Rescue, Elimination, Recon, Defense\n\n## Ranks: E → D → C → B → A → S Class\n\n## Rewards\n- XP, Credits, Equipment, Reputation\n\n## Notifications\n[MISSION START]\n[OBJECTIVE UPDATED]\n[MISSION COMPLETE: Grade]` },
    ];

    const handleSeedDefaults = async () => {
        const confirm = Platform.OS === 'web'
            ? window.confirm('Seed 12 default knowledge documents? This will not overwrite existing documents with the same name.')
            : await new Promise<boolean>(resolve => {
                Alert.alert('Seed Defaults', 'Add 12 default knowledge documents? Existing documents will not be overwritten.',
                    [{ text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
                    { text: 'Seed', onPress: () => resolve(true) }]);
            });
        if (!confirm) return;

        setSeeding(true);
        let added = 0;
        let skipped = 0;

        try {
            const docsRef = collection(db, 'knowledgeDocuments');
            for (const docData of DEFAULT_KNOWLEDGE_DOCS) {
                // Check if already exists
                const exists = documents.some(d => d.name === docData.name && d.worldModule === docData.worldModule);
                if (exists) {
                    skipped++;
                    continue;
                }
                // Direct Firestore write (bypass Cloud Function CORS issues)
                await addDoc(docsRef, {
                    ...docData,
                    enabled: true,
                    uploadedBy: auth.currentUser?.uid || 'system',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
                added++;
            }
            await loadDocuments();
            Alert.alert('Success', `Added ${added} documents, skipped ${skipped} (already exist)`);
        } catch (error: any) {
            console.error('Seed error:', error);
            Alert.alert('Error', 'Failed to seed: ' + error.message);
        } finally {
            setSeeding(false);
        }
    };

    const handlePickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['text/*', 'application/json', 'text/markdown'],
                copyToCacheDirectory: true,
            });

            if (result.canceled) return;

            const file = result.assets[0];

            // On web, we can fetch the blob URI to get text content
            const response = await fetch(file.uri);
            const text = await response.text();

            setFormContent(text);

            // Auto-fill name if empty
            if (!formName && file.name) {
                setFormName(file.name.split('.')[0]);
            }

            Alert.alert('Success', 'File imported successfully');
        } catch (error) {
            console.error('File pick error:', error);
            Alert.alert('Error', 'Failed to read file');
        }
    };

    const handleAdd = async () => {
        if (!formName.trim() || !formContent.trim()) {
            setFormError('Name and content are required');
            return;
        }

        try {
            setSaving(true);
            setFormError(null); // Clear previous errors
            // Direct Firestore write (bypass Cloud Function CORS issues)
            const docsRef = collection(db, 'knowledgeDocuments');
            const docRef = await addDoc(docsRef, {
                name: formName.trim(),
                worldModule: formModule,
                category: formCategory,
                targetModel: formTargetModel,
                content: formContent.trim(),
                enabled: true,
                uploadedBy: auth.currentUser?.uid || 'system',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            // Add to local state
            setDocuments([{
                id: docRef.id,
                name: formName.trim(),
                worldModule: formModule as any,
                category: formCategory as any,
                targetModel: formTargetModel as any,
                content: formContent.trim(),
                enabled: true,
            }, ...documents]);

            // Reset form
            setFormName('');
            setFormContent('');
            setFormModule('global');
            setFormCategory('lore');
            setFormTargetModel('both');
            setFormError(null);
            setShowForm(false);

            Alert.alert('Success', 'Document added successfully');
        } catch (error: any) {
            console.error('Failed to add document:', error);
            const errorMsg = error?.message || 'Unknown error occurred';
            setFormError(errorMsg);
            Alert.alert('Error', 'Failed to add document: ' + errorMsg);
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (doc: KnowledgeDocument) => {
        setEditingId(doc.id);
        setFormName(doc.name);
        setFormModule(doc.worldModule);
        setFormCategory(doc.category);
        setFormTargetModel(doc.targetModel || 'both');
        setFormContent(doc.content);
        setFormError(null);
        setShowForm(true);
        setExpandedId(null);
    };

    const handleUpdate = async () => {
        if (!editingId || !formName.trim() || !formContent.trim()) {
            setFormError('Name and content are required');
            return;
        }

        try {
            setSaving(true);
            setFormError(null);
            // Direct Firestore update (bypass Cloud Function CORS issues)
            const docRef = doc(db, 'knowledgeDocuments', editingId);
            await updateDoc(docRef, {
                name: formName.trim(),
                worldModule: formModule,
                category: formCategory,
                targetModel: formTargetModel,
                content: formContent.trim(),
                updatedAt: serverTimestamp()
            });

            // Update local state
            setDocuments(documents.map(d =>
                d.id === editingId ? {
                    ...d,
                    name: formName.trim(),
                    worldModule: formModule,
                    category: formCategory,
                    targetModel: formTargetModel,
                    content: formContent.trim(),
                } : d
            ));

            // Reset form
            setFormName('');
            setFormContent('');
            setFormModule('global');
            setFormCategory('lore');
            setFormTargetModel('both');
            setFormError(null);
            setShowForm(false);
            setEditingId(null);

            Alert.alert('Success', 'Document updated successfully');
        } catch (error: any) {
            console.error('Failed to update document:', error);
            const errorMsg = error?.message || 'Unknown error occurred';
            setFormError(errorMsg);
            Alert.alert('Error', 'Failed to update document: ' + errorMsg);
        } finally {
            setSaving(false);
        }
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setFormName('');
        setFormContent('');
        setFormModule('global');
        setFormCategory('lore');
        setFormTargetModel('both');
        setFormError(null);
        setShowForm(false);
    };

    const handleToggle = async (knowledgeDoc: KnowledgeDocument) => {
        try {
            // Direct Firestore update (bypass Cloud Function CORS issues)
            const docRef = doc(db, 'knowledgeDocuments', knowledgeDoc.id);
            await updateDoc(docRef, { enabled: !knowledgeDoc.enabled, updatedAt: serverTimestamp() });
            setDocuments(documents.map(d =>
                d.id === knowledgeDoc.id ? { ...d, enabled: !d.enabled } : d
            ));
        } catch (error) {
            Alert.alert('Error', 'Failed to update document');
        }
    };

    const handleDelete = async (knowledgeDoc: KnowledgeDocument) => {
        const confirm = Platform.OS === 'web'
            ? window.confirm(`Delete "${knowledgeDoc.name}"? This cannot be undone.`)
            : await new Promise<boolean>(resolve => {
                Alert.alert(
                    'Delete Document',
                    `Delete "${knowledgeDoc.name}"? This cannot be undone.`,
                    [
                        { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
                        { text: 'Delete', onPress: () => resolve(true), style: 'destructive' }
                    ]
                );
            });

        if (!confirm) return;

        try {
            // Direct Firestore delete (bypass Cloud Function CORS issues)
            const docRef = doc(db, 'knowledgeDocuments', knowledgeDoc.id);
            await deleteDoc(docRef);
            setDocuments(documents.filter(d => d.id !== knowledgeDoc.id));
        } catch (error) {
            Alert.alert('Error', 'Failed to delete document');
        }
    };

    const getModuleColor = (module: WorldModule) => {
        switch (module) {
            case 'global': return colors.primary[400];
            case 'classic': return colors.status.success;
            case 'outworlder': return colors.status.info;
            case 'shadowMonarch': return colors.gold.main;
        }
    };

    const getModelColor = (model: TargetModel) => {
        switch (model) {
            case 'brain': return colors.status.warning;
            case 'voice': return colors.primary[400];
            case 'both': return colors.status.success;
        }
    };

    const getModelLabel = (model: TargetModel) => {
        switch (model) {
            case 'brain': return 'BRAIN';
            case 'voice': return 'VOICE';
            case 'both': return 'BOTH';
        }
    };

    // Filter documents based on selected filters
    const filteredDocuments = useMemo(() => {
        return documents.filter(doc => {
            const matchesModule = filterModule === 'all' || doc.worldModule === filterModule;
            const matchesCategory = filterCategory === 'all' || doc.category === filterCategory;
            return matchesModule && matchesCategory;
        });
    }, [documents, filterModule, filterCategory]);

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
                <Text style={styles.title}>Knowledge Base</Text>
            </View>

            {/* Stats Row */}
            <FadeInView>
                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{documents.length}</Text>
                        <Text style={styles.statLabel}>Total</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={[styles.statValue, { color: colors.status.warning }]}>
                            {documents.filter(d => d.targetModel === 'brain' || d.targetModel === 'both').length}
                        </Text>
                        <Text style={styles.statLabel}>Brain</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={[styles.statValue, { color: colors.primary[400] }]}>
                            {documents.filter(d => d.targetModel === 'voice' || d.targetModel === 'both').length}
                        </Text>
                        <Text style={styles.statLabel}>Voice</Text>
                    </View>
                </View>
            </FadeInView>

            {/* Filter Controls */}
            <FadeInView>
                <View style={styles.filterContainer}>
                    <View style={styles.filterGroup}>
                        <Text style={styles.filterLabel}>World Module</Text>
                        <View style={styles.filterRow}>
                            <AnimatedPressable
                                style={[
                                    styles.filterChip,
                                    filterModule === 'all' && styles.filterChipActive
                                ]}
                                onPress={() => setFilterModule('all')}
                            >
                                <Text style={[
                                    styles.filterChipText,
                                    filterModule === 'all' && styles.filterChipTextActive
                                ]}>All</Text>
                            </AnimatedPressable>
                            {WORLD_MODULES.map(m => (
                                <AnimatedPressable
                                    key={m.value}
                                    style={[
                                        styles.filterChip,
                                        filterModule === m.value && styles.filterChipActive
                                    ]}
                                    onPress={() => setFilterModule(m.value)}
                                >
                                    <Text style={[
                                        styles.filterChipText,
                                        filterModule === m.value && styles.filterChipTextActive
                                    ]}>{m.label}</Text>
                                </AnimatedPressable>
                            ))}
                        </View>
                    </View>

                    <View style={styles.filterGroup}>
                        <Text style={styles.filterLabel}>Category</Text>
                        <View style={styles.filterRow}>
                            <AnimatedPressable
                                style={[
                                    styles.filterChip,
                                    filterCategory === 'all' && styles.filterChipActive
                                ]}
                                onPress={() => setFilterCategory('all')}
                            >
                                <Text style={[
                                    styles.filterChipText,
                                    filterCategory === 'all' && styles.filterChipTextActive
                                ]}>All</Text>
                            </AnimatedPressable>
                            {CATEGORIES.map(c => (
                                <AnimatedPressable
                                    key={c.value}
                                    style={[
                                        styles.filterChip,
                                        filterCategory === c.value && styles.filterChipActive
                                    ]}
                                    onPress={() => setFilterCategory(c.value)}
                                >
                                    <Text style={[
                                        styles.filterChipText,
                                        filterCategory === c.value && styles.filterChipTextActive
                                    ]}>{c.label}</Text>
                                </AnimatedPressable>
                            ))}
                        </View>
                    </View>
                </View>
            </FadeInView>

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
                <AnimatedPressable
                    style={[styles.addButton, { flex: 1, marginBottom: 0 }]}
                    onPress={() => {
                        if (showForm && editingId) {
                            handleCancelEdit();
                        } else {
                            setShowForm(!showForm);
                        }
                    }}
                >
                    <Ionicons name={showForm ? "close" : "add"} size={20} color={colors.text.primary} />
                    <Text style={styles.addButtonText}>
                        {showForm ? (editingId ? 'Cancel Edit' : 'Cancel') : 'Add Document'}
                    </Text>
                </AnimatedPressable>

                {documents.length === 0 && (
                    <AnimatedPressable
                        style={[styles.addButton, { flex: 1, marginBottom: 0, backgroundColor: colors.status.success + '20', borderWidth: 1, borderColor: colors.status.success }]}
                        onPress={handleSeedDefaults}
                        disabled={seeding}
                    >
                        {seeding ? (
                            <ActivityIndicator size="small" color={colors.status.success} />
                        ) : (
                            <>
                                <Ionicons name="leaf" size={20} color={colors.status.success} />
                                <Text style={[styles.addButtonText, { color: colors.status.success }]}>Seed Defaults</Text>
                            </>
                        )}
                    </AnimatedPressable>
                )}
            </View>

            {/* Add Form */}
            {showForm && (
                <FadeInView>
                    <View style={styles.form}>
                        <Text style={styles.formLabel}>Document Name</Text>
                        <TextInput
                            style={styles.input}
                            value={formName}
                            onChangeText={setFormName}
                            placeholder="e.g., Forgotten Realms Lore"
                            placeholderTextColor={colors.text.muted}
                        />

                        <Text style={styles.formLabel}>World Module</Text>
                        <View style={styles.selectRow}>
                            {WORLD_MODULES.map(m => (
                                <AnimatedPressable
                                    key={m.value}
                                    style={[
                                        styles.selectOption,
                                        formModule === m.value && styles.selectOptionActive
                                    ]}
                                    onPress={() => setFormModule(m.value)}
                                >
                                    <Text style={[
                                        styles.selectOptionText,
                                        formModule === m.value && styles.selectOptionTextActive
                                    ]}>{m.label}</Text>
                                </AnimatedPressable>
                            ))}
                        </View>

                        <Text style={styles.formLabel}>Category</Text>
                        <View style={styles.selectRow}>
                            {CATEGORIES.map(c => (
                                <AnimatedPressable
                                    key={c.value}
                                    style={[
                                        styles.selectOption,
                                        formCategory === c.value && styles.selectOptionActive
                                    ]}
                                    onPress={() => setFormCategory(c.value)}
                                >
                                    <Text style={[
                                        styles.selectOptionText,
                                        formCategory === c.value && styles.selectOptionTextActive
                                    ]}>{c.label}</Text>
                                </AnimatedPressable>
                            ))}
                        </View>

                        <Text style={styles.formLabel}>Target AI Model</Text>
                        <View style={styles.modelSelectRow}>
                            {TARGET_MODELS.map(m => (
                                <AnimatedPressable
                                    key={m.value}
                                    style={[
                                        styles.modelOption,
                                        formTargetModel === m.value && styles.modelOptionActive
                                    ]}
                                    onPress={() => setFormTargetModel(m.value)}
                                >
                                    <Ionicons
                                        name={m.icon}
                                        size={20}
                                        color={formTargetModel === m.value ? colors.text.primary : colors.text.muted}
                                    />
                                    <Text style={[
                                        styles.modelOptionLabel,
                                        formTargetModel === m.value && styles.modelOptionLabelActive
                                    ]}>{m.label}</Text>
                                    <Text style={styles.modelOptionDesc}>{m.description}</Text>
                                </AnimatedPressable>
                            ))}
                        </View>

                        <Text style={styles.formLabel}>Content</Text>

                        <AnimatedPressable
                            style={styles.importButton}
                            onPress={handlePickDocument}
                        >
                            <Ionicons name="document-text-outline" size={18} color={colors.primary[400]} />
                            <Text style={styles.importButtonText}>Import from File (.txt, .md, .json)</Text>
                        </AnimatedPressable>

                        {formError && (
                            <View style={styles.errorBox}>
                                <Ionicons name="alert-circle" size={16} color={colors.status.error} />
                                <Text style={styles.errorText}>{formError}</Text>
                            </View>
                        )}

                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={formContent}
                            onChangeText={setFormContent}
                            placeholder="Paste your lore, rules, or reference material here..."
                            placeholderTextColor={colors.text.muted}
                            multiline
                            numberOfLines={8}
                            textAlignVertical="top"
                        />

                        <AnimatedPressable
                            style={[styles.submitButton, saving && styles.submitButtonDisabled]}
                            onPress={editingId ? handleUpdate : handleAdd}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color={colors.text.primary} size="small" />
                            ) : (
                                <>
                                    <Ionicons name="cloud-upload" size={20} color={colors.text.primary} />
                                    <Text style={styles.submitButtonText}>
                                        {editingId ? 'Update Document' : 'Upload Document'}
                                    </Text>
                                </>
                            )}
                        </AnimatedPressable>
                    </View>
                </FadeInView>
            )}

            {/* Document List */}
            <Text style={styles.sectionTitle}>Documents ({filteredDocuments.length}{filteredDocuments.length !== documents.length ? ` of ${documents.length}` : ''})</Text>

            {filteredDocuments.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="documents-outline" size={48} color={colors.text.muted} />
                    <Text style={styles.emptyText}>{documents.length === 0 ? 'No documents yet' : 'No matching documents'}</Text>
                    <Text style={styles.emptySubtext}>{documents.length === 0 ? 'Add reference materials for the AI to use' : 'Try adjusting your filters'}</Text>
                </View>
            ) : (
                <StaggeredList style={{ gap: spacing.sm }}>
                    {filteredDocuments.map((doc) => (
                        <View key={doc.id} style={styles.docCard}>
                            <View style={styles.docHeader}>
                                <View style={styles.docInfo}>
                                    <View style={styles.docTitleRow}>
                                        <Text style={styles.docName}>{doc.name}</Text>
                                        <View style={[styles.moduleBadge, { backgroundColor: getModuleColor(doc.worldModule) + '30' }]}>
                                            <Text style={[styles.moduleBadgeText, { color: getModuleColor(doc.worldModule) }]}>
                                                {doc.worldModule.toUpperCase()}
                                            </Text>
                                        </View>
                                        <View style={[styles.moduleBadge, { backgroundColor: getModelColor(doc.targetModel || 'both') + '30' }]}>
                                            <Text style={[styles.moduleBadgeText, { color: getModelColor(doc.targetModel || 'both') }]}>
                                                {getModelLabel(doc.targetModel || 'both')}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={styles.docMeta}>
                                        {doc.category} • {doc.content.length.toLocaleString()} chars
                                    </Text>
                                </View>

                                <View style={styles.docActions}>
                                    <Switch
                                        value={doc.enabled}
                                        onValueChange={() => handleToggle(doc)}
                                        trackColor={{ false: colors.background.tertiary, true: colors.primary[600] }}
                                        thumbColor={doc.enabled ? colors.primary[400] : colors.text.muted}
                                    />
                                </View>
                            </View>

                            <View style={styles.docFooter}>
                                <AnimatedPressable
                                    style={styles.docButton}
                                    onPress={() => setExpandedId(expandedId === doc.id ? null : doc.id)}
                                >
                                    <Ionicons
                                        name={expandedId === doc.id ? "chevron-up" : "chevron-down"}
                                        size={16}
                                        color={colors.text.muted}
                                    />
                                    <Text style={styles.docButtonText}>
                                        {expandedId === doc.id ? 'Hide' : 'Preview'}
                                    </Text>
                                </AnimatedPressable>

                                <AnimatedPressable
                                    style={styles.docButton}
                                    onPress={() => handleEdit(doc)}
                                >
                                    <Ionicons name="create-outline" size={16} color={colors.primary[400]} />
                                    <Text style={[styles.docButtonText, { color: colors.primary[400] }]}>Edit</Text>
                                </AnimatedPressable>

                                <AnimatedPressable
                                    style={[styles.docButton, styles.deleteButton]}
                                    onPress={() => handleDelete(doc)}
                                >
                                    <Ionicons name="trash-outline" size={16} color={colors.status.error} />
                                    <Text style={[styles.docButtonText, { color: colors.status.error }]}>Delete</Text>
                                </AnimatedPressable>
                            </View>

                            {expandedId === doc.id && (
                                <View style={styles.preview}>
                                    <Text style={styles.previewText} numberOfLines={10}>
                                        {doc.content}
                                    </Text>
                                </View>
                            )}
                        </View>
                    ))}
                </StaggeredList>
            )}

            {/* Info Box */}
            <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={20} color={colors.status.info} />
                <Text style={styles.infoText}>
                    <Text style={{ fontWeight: 'bold' }}>Brain (OpenAI)</Text>: Rules, mechanics, game logic{"\n"}
                    <Text style={{ fontWeight: 'bold' }}>Voice (Claude)</Text>: Narrative style, tone, descriptions{"\n"}
                    <Text style={{ fontWeight: 'bold' }}>Both</Text>: Lore and world info for all AI systems
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
        paddingBottom: spacing.xxl,
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
    statsRow: {
        flexDirection: 'row',
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    statCard: {
        flex: 1,
        backgroundColor: colors.background.secondary,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    statValue: {
        fontSize: typography.fontSize.xxl,
        fontWeight: 'bold',
        color: colors.primary[400],
    },
    statLabel: {
        fontSize: typography.fontSize.xs,
        color: colors.text.muted,
        textTransform: 'uppercase',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: colors.primary[700],
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.lg,
    },
    addButtonText: {
        color: colors.text.primary,
        fontWeight: 'bold',
    },
    form: {
        backgroundColor: colors.background.secondary,
        padding: spacing.lg,
        borderRadius: borderRadius.md,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    formLabel: {
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
        marginBottom: spacing.xs,
        fontWeight: '500',
    },
    input: {
        backgroundColor: colors.background.primary,
        color: colors.text.primary,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        fontSize: typography.fontSize.md,
    },
    textArea: {
        minHeight: 150,
        textAlignVertical: 'top',
    },
    selectRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
        marginBottom: spacing.md,
    },
    selectOption: {
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    selectOptionActive: {
        backgroundColor: colors.primary[700],
        borderColor: colors.primary[500],
    },
    selectOptionText: {
        color: colors.text.muted,
        fontSize: typography.fontSize.sm,
    },
    selectOptionTextActive: {
        color: colors.text.primary,
        fontWeight: '500',
    },
    modelSelectRow: {
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    modelOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.md,
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    modelOptionActive: {
        backgroundColor: colors.primary[700],
        borderColor: colors.primary[500],
    },
    modelOptionLabel: {
        fontSize: typography.fontSize.md,
        color: colors.text.muted,
        fontWeight: '500',
    },
    modelOptionLabelActive: {
        color: colors.text.primary,
    },
    modelOptionDesc: {
        fontSize: typography.fontSize.xs,
        color: colors.text.muted,
        marginLeft: 'auto',
    },
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: colors.primary[600],
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginTop: spacing.sm,
    },
    submitButtonDisabled: {
        opacity: 0.6,
    },
    submitButtonText: {
        color: colors.text.primary,
        fontWeight: 'bold',
    },
    sectionTitle: {
        fontSize: typography.fontSize.md,
        fontWeight: 'bold',
        color: colors.text.primary,
        marginBottom: spacing.md,
    },
    emptyState: {
        alignItems: 'center',
        padding: spacing.xl,
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
        marginBottom: spacing.lg,
    },
    emptyText: {
        fontSize: typography.fontSize.lg,
        color: colors.text.secondary,
        marginTop: spacing.md,
    },
    emptySubtext: {
        fontSize: typography.fontSize.sm,
        color: colors.text.muted,
        marginTop: spacing.xs,
    },
    docCard: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    docHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    docInfo: {
        flex: 1,
    },
    docTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flexWrap: 'wrap',
    },
    docName: {
        fontSize: typography.fontSize.md,
        fontWeight: 'bold',
        color: colors.text.primary,
    },
    moduleBadge: {
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
        borderRadius: borderRadius.sm,
    },
    moduleBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    docMeta: {
        fontSize: typography.fontSize.sm,
        color: colors.text.muted,
        marginTop: 4,
    },
    docActions: {
        marginLeft: spacing.md,
    },
    docFooter: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border.default,
        paddingTop: spacing.sm,
    },
    docButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    deleteButton: {
        marginLeft: 'auto',
    },
    docButtonText: {
        fontSize: typography.fontSize.sm,
        color: colors.text.muted,
    },
    preview: {
        marginTop: spacing.md,
        padding: spacing.md,
        backgroundColor: colors.background.primary,
        borderRadius: borderRadius.sm,
    },
    previewText: {
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
        lineHeight: 20,
    },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: colors.primary[900] + '20',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        gap: spacing.md,
        alignItems: 'flex-start',
        marginTop: spacing.lg,
    },
    infoText: {
        flex: 1,
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
        lineHeight: 20,
    },
    importButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        marginBottom: spacing.xs,
    },
    importButtonText: {
        color: colors.primary[400],
        fontSize: typography.fontSize.sm,
        fontWeight: '500',
    },
    errorBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: colors.status.error + '20',
        padding: spacing.sm,
        borderRadius: borderRadius.sm,
        marginBottom: spacing.sm,
    },
    errorText: {
        flex: 1,
        color: colors.status.error,
        fontSize: typography.fontSize.sm,
    },
    filterContainer: {
        backgroundColor: colors.background.secondary,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border.default,
        gap: spacing.md,
    },
    filterGroup: {
        gap: spacing.xs,
    },
    filterLabel: {
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
        fontWeight: '500',
        marginBottom: spacing.xs,
    },
    filterRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
    },
    filterChip: {
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    filterChipActive: {
        backgroundColor: colors.primary[700],
        borderColor: colors.primary[500],
    },
    filterChipText: {
        color: colors.text.muted,
        fontSize: typography.fontSize.sm,
    },
    filterChipTextActive: {
        color: colors.text.primary,
        fontWeight: '500',
    },
});
