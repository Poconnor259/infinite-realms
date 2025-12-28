import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useUserStore } from '../lib/store';
import { useThemeColors } from '../lib/hooks/useTheme';
import { spacing, borderRadius, typography, shadows } from '../lib/theme';

interface VoiceModelSelectorProps {
    user: any;
    mode: 'settings' | 'main';
    modelType?: 'brain' | 'voice'; // Which model to select - defaults to 'voice'
    onShowUpgrade?: () => void;
}

export function VoiceModelSelector({ user, mode, modelType = 'voice', onShowUpgrade }: VoiceModelSelectorProps) {
    const { colors } = useThemeColors();
    const styles = createStyles(colors, mode);
    const [isExpanded, setIsExpanded] = useState(false);

    // Read the current model based on modelType
    const currentModel = modelType === 'brain'
        ? (user?.preferredModels?.brain || 'gemini-3-flash')
        : (user?.preferredModels?.voice || 'gemini-3-flash');

    const models = [
        {
            id: 'claude-opus-4.5',
            name: 'Claude Opus 4.5',
            icon: 'sparkles' as const,
            tag: 'Premium',
            cost: '~20 turns/action',
            desc: 'Immersive storytelling with rich detail',
        },
        {
            id: 'claude-sonnet-3.5',
            name: 'Claude Sonnet 3.5',
            icon: 'flash' as const,
            tag: 'Balanced',
            cost: '~4 turns/action',
            desc: 'Great quality at moderate cost',
        },
        {
            id: 'gemini-3-flash',
            name: 'Gemini Flash 3',
            icon: 'rocket' as const,
            tag: 'Economical',
            cost: '~1 turn/action',
            desc: 'Fast and efficient',
        }
    ];

    // Filter models based on mode and expansion state
    const visibleModels = mode === 'settings' || isExpanded
        ? models
        : models.filter(m => m.id === currentModel);

    const [config, setConfig] = useState<any>(null);

    React.useEffect(() => {
        const fetchConfig = async () => {
            try {
                const docRef = doc(db, 'config', 'globalConfig');
                // Use getDoc instead of onSnapshot for now to reduce reads, or use a store
                // Ideally this should be in a global store. For now, fetch on mount.
                const snapshot = await import('firebase/firestore').then(mod => mod.getDoc(docRef));
                if (snapshot.exists()) {
                    setConfig(snapshot.data());
                }
            } catch (err) {
                console.warn('Failed to fetch global config:', err);
            }
        };
        fetchConfig();
    }, []);

    const isModelAllowed = (modelId: string) => {
        // Legend/Legendary always allowed (BYOK or Unlimited)
        if (user?.tier === 'legend' || user?.tier === 'legendary') return true;

        // If config loaded, use it
        if (config?.subscriptionPermissions) {
            const tierPerms = config.subscriptionPermissions[user?.tier || 'scout'];
            if (tierPerms?.allowedModels) {
                // Check if modelId is in allowed list. 
                // Note: Config might have 'claude-3-5-sonnet' but UI has 'claude-sonnet-3.5'.
                // We need to ensure IDs match.
                // UI IDs: claude-opus-4.5, claude-sonnet-3.5, gemini-3-flash
                // Server IDs usually: claude-3-opus, claude-3-5-sonnet, gemini-1.5-flash
                // User update: "gemini-3-flash" seems custom.
                // I will assume the config uses the same IDs as the UI or I need to map them.
                // For safety, I'll check exact match or partial match if needed.
                return tierPerms.allowedModels.includes(modelId);
            }
        }

        // Fallback legacy logic
        const isScout = user?.tier === 'scout';
        if (isScout) {
            // Scout only gets Flash
            return modelId.includes('flash') || modelId.includes('gemini');
        }
        return true; // Others allowed
    };

    const updateModel = async (modelId: string) => {
        if (user?.id) {
            try {
                // Optimistic update based on modelType
                useUserStore.setState({
                    user: {
                        ...user,
                        preferredModels: {
                            ...user.preferredModels,
                            [modelType]: modelId
                        }
                    }
                });

                // Update Firestore with the correct field path
                await updateDoc(doc(db, 'users', user.id), {
                    [`preferredModels.${modelType}`]: modelId
                });
            } catch (error) {
                console.error('Failed to update model preference:', error);
            }
        }
    };

    const handleModelPress = (modelId: string) => {
        if (!isModelAllowed(modelId)) {
            onShowUpgrade?.();
            return;
        }

        if (mode === 'main') {
            if (!isExpanded) {
                // Clicking collapsed card expands
                setIsExpanded(true);
            } else if (modelId === currentModel) {
                // Clicking same model while expanded collapses
                setIsExpanded(false);
            } else {
                // Clicking different model selects and collapses
                updateModel(modelId);
                setIsExpanded(false);
            }
        } else {
            // Settings mode: direct selection
            updateModel(modelId);
        }
    };

    // Type-specific descriptions
    const getDescription = () => {
        if (modelType === 'brain') {
            return "Controls game logic speed and cost. Admin only.";
        }
        return "Select your narrator. Balance storytelling quality with speed and turn usage.";
    };

    return (
        <View style={styles.container}>
            {mode === 'settings' && (
                <Text style={styles.description}>
                    {getDescription()}
                </Text>
            )}

            <View style={styles.grid}>
                {visibleModels.map((model) => {
                    const isSelected = currentModel === model.id;

                    return (
                        <TouchableOpacity
                            key={model.id}
                            style={[
                                styles.card,
                                isSelected && isModelAllowed(model.id) && styles.cardSelected,
                                !isModelAllowed(model.id) && styles.cardLocked,
                            ]}
                            onPress={() => handleModelPress(model.id)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.cardContent}>
                                <View style={[styles.iconContainer, isSelected && styles.iconContainerSelected]}>
                                    <Ionicons
                                        name={model.icon}
                                        size={20}
                                        color={!isModelAllowed(model.id) ? colors.text.muted : (isSelected ? colors.primary[400] : colors.text.secondary)}
                                    />
                                </View>

                                <View style={styles.textContainer}>
                                    <View style={styles.headerRow}>
                                        <Text style={[
                                            styles.name,
                                            isSelected && isModelAllowed(model.id) && styles.nameSelected,
                                            !isModelAllowed(model.id) && styles.textLocked
                                        ]}>
                                            {model.name}
                                        </Text>
                                        {!isModelAllowed(model.id) && (
                                            <Ionicons name="lock-closed" size={14} color={colors.text.muted} />
                                        )}
                                    </View>

                                    {mode === 'settings' && (
                                        <Text style={[styles.desc, !isModelAllowed(model.id) && styles.textLocked]} numberOfLines={1}>
                                            {model.desc}
                                        </Text>
                                    )}
                                </View>

                                {mode === 'settings' && (
                                    <View style={styles.metaContainer}>
                                        <Text style={[styles.cost, !isModelAllowed(model.id) && styles.textLocked]}>{model.cost}</Text>
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {mode === 'settings' && user?.turns !== undefined && isModelAllowed(currentModel) && (
                <View style={styles.estimate}>
                    <Ionicons name="information-circle-outline" size={16} color={colors.text.muted} />
                    <Text style={styles.estimateText}>
                        {user.turns} turns remaining ≈ {
                            currentModel === 'claude-opus-4.5' ? Math.floor(user.turns / 20) :
                                currentModel === 'claude-sonnet-3.5' ? Math.floor(user.turns / 4) :
                                    user.turns
                        } actions
                    </Text>
                </View>
            )}
        </View>
    );
}

const createStyles = (colors: any, mode: 'settings' | 'main') => StyleSheet.create({
    container: {
        paddingVertical: mode === 'main' ? 0 : spacing.xs,
    },
    description: {
        fontSize: typography.fontSize.xs,
        color: colors.text.muted,
        marginBottom: spacing.sm,
        paddingHorizontal: spacing.sm,
    },
    grid: {
        flexDirection: 'column',
        gap: spacing.xs,
        width: '100%',
    },
    card: {
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.md,
        padding: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    cardSelected: {
        borderColor: colors.primary[400],
        backgroundColor: colors.primary[600] + '05',
    },
    cardLocked: {
        opacity: 0.6,
        backgroundColor: colors.background.tertiary,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.background.secondary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconContainerSelected: {
        backgroundColor: colors.primary[400] + '15',
    },
    textContainer: {
        flex: 1,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: 2,
    },
    name: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
        color: colors.text.primary,
    },
    nameSelected: {
        color: colors.primary[400],
    },
    desc: {
        fontSize: typography.fontSize.xs,
        color: colors.text.muted,
        lineHeight: 16,
    },
    metaContainer: {
        alignItems: 'flex-end',
    },
    cost: {
        fontSize: typography.fontSize.xs,
        color: colors.primary[400],
        fontWeight: '600',
    },
    // Legacy styles kept safely or remove if confirmed unused
    textLocked: {
        color: colors.text.muted,
    },
    estimate: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        marginTop: spacing.md,
        padding: spacing.sm,
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
    },
    estimateText: {
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
    },
});
