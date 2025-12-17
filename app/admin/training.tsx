
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput, Alert, Platform, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../lib/theme';
import { AnimatedPressable, FadeInView, StaggeredList } from '../../components/ui/Animated';
import { getKnowledgeDocs, addKnowledgeDoc, updateKnowledgeDoc, deleteKnowledgeDoc, KnowledgeDocument } from '../../lib/firebase';

type WorldModule = 'global' | 'classic' | 'outworlder' | 'shadowMonarch';
type Category = 'lore' | 'rules' | 'characters' | 'locations' | 'other';

const WORLD_MODULES: { value: WorldModule; label: string }[] = [
    { value: 'global', label: 'Global (All Modules)' },
    { value: 'classic', label: 'Classic D&D' },
    { value: 'outworlder', label: 'Outworlder (HWFWM)' },
    { value: 'shadowMonarch', label: 'Shadow Monarch' },
];

const CATEGORIES: { value: Category; label: string }[] = [
    { value: 'lore', label: 'Lore' },
    { value: 'rules', label: 'Rules' },
    { value: 'characters', label: 'Characters' },
    { value: 'locations', label: 'Locations' },
    { value: 'other', label: 'Other' },
];

export default function AdminTrainingScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [formName, setFormName] = useState('');
    const [formModule, setFormModule] = useState<WorldModule>('global');
    const [formCategory, setFormCategory] = useState<Category>('lore');
    const [formContent, setFormContent] = useState('');

    useEffect(() => {
        loadDocuments();
    }, []);

    const loadDocuments = async () => {
        try {
            setLoading(true);
            const docs = await getKnowledgeDocs();
            setDocuments(docs);
        } catch (error) {
            console.error('Failed to load documents:', error);
            Alert.alert('Error', 'Failed to load knowledge base');
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!formName.trim() || !formContent.trim()) {
            Alert.alert('Error', 'Name and content are required');
            return;
        }

        try {
            setSaving(true);
            const id = await addKnowledgeDoc({
                name: formName.trim(),
                worldModule: formModule,
                category: formCategory,
                content: formContent.trim(),
                enabled: true,
            });

            // Add to local state
            setDocuments([{
                id,
                name: formName.trim(),
                worldModule: formModule,
                category: formCategory,
                content: formContent.trim(),
                enabled: true,
            }, ...documents]);

            // Reset form
            setFormName('');
            setFormContent('');
            setFormModule('global');
            setFormCategory('lore');
            setShowForm(false);

            Alert.alert('Success', 'Document added successfully');
        } catch (error) {
            console.error('Failed to add document:', error);
            Alert.alert('Error', 'Failed to add document');
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (doc: KnowledgeDocument) => {
        try {
            await updateKnowledgeDoc(doc.id, { enabled: !doc.enabled });
            setDocuments(documents.map(d =>
                d.id === doc.id ? { ...d, enabled: !d.enabled } : d
            ));
        } catch (error) {
            Alert.alert('Error', 'Failed to update document');
        }
    };

    const handleDelete = async (doc: KnowledgeDocument) => {
        const confirm = Platform.OS === 'web'
            ? window.confirm(`Delete "${doc.name}"? This cannot be undone.`)
            : await new Promise<boolean>(resolve => {
                Alert.alert(
                    'Delete Document',
                    `Delete "${doc.name}"? This cannot be undone.`,
                    [
                        { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
                        { text: 'Delete', onPress: () => resolve(true), style: 'destructive' }
                    ]
                );
            });

        if (!confirm) return;

        try {
            await deleteKnowledgeDoc(doc.id);
            setDocuments(documents.filter(d => d.id !== doc.id));
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
                        <Text style={styles.statLabel}>Total Docs</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{documents.filter(d => d.enabled).length}</Text>
                        <Text style={styles.statLabel}>Active</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{documents.filter(d => d.worldModule === 'global').length}</Text>
                        <Text style={styles.statLabel}>Global</Text>
                    </View>
                </View>
            </FadeInView>

            {/* Add Button */}
            <AnimatedPressable
                style={styles.addButton}
                onPress={() => setShowForm(!showForm)}
            >
                <Ionicons name={showForm ? "close" : "add"} size={20} color={colors.text.primary} />
                <Text style={styles.addButtonText}>{showForm ? 'Cancel' : 'Add Document'}</Text>
            </AnimatedPressable>

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

                        <Text style={styles.formLabel}>Content</Text>
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
                            onPress={handleAdd}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color={colors.text.primary} size="small" />
                            ) : (
                                <>
                                    <Ionicons name="cloud-upload" size={20} color={colors.text.primary} />
                                    <Text style={styles.submitButtonText}>Upload Document</Text>
                                </>
                            )}
                        </AnimatedPressable>
                    </View>
                </FadeInView>
            )}

            {/* Document List */}
            <Text style={styles.sectionTitle}>Documents ({documents.length})</Text>

            {documents.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="documents-outline" size={48} color={colors.text.muted} />
                    <Text style={styles.emptyText}>No documents yet</Text>
                    <Text style={styles.emptySubtext}>Add reference materials for the AI to use</Text>
                </View>
            ) : (
                <StaggeredList style={{ gap: spacing.sm }}>
                    {documents.map((doc) => (
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
                    Documents are injected into the AI's context during gameplay. Use for world lore, custom rules, character backstories, or location descriptions.
                </Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
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
});
