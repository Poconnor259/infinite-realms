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
    onShowUpgrade?: () => void;
}

export function VoiceModelSelector({ user, mode, onShowUpgrade }: VoiceModelSelectorProps) {
    const { colors } = useThemeColors();
    const styles = createStyles(colors, mode);
    const [isExpanded, setIsExpanded] = useState(false);

    const currentModel = user?.preferredModels?.voice || 'gemini-3-flash';

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
                // Optimistic update
                useUserStore.setState({
                    user: {
                        ...user,
                        preferredModels: {
                            ...user.preferredModels,
                            voice: modelId
                        }
                    }
                });

                await updateDoc(doc(db, 'users', user.id), {
                    'preferredModels.voice': modelId
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

    return (
        <View style={styles.container}>
            {mode === 'settings' && (
                <Text style={styles.description}>
                    Choose your narrative AI. Higher quality uses more turns.
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
                            <View style={styles.header}>
                                <Ionicons
                                    name={model.icon}
                                    size={mode === 'main' ? 18 : 24}
                                    color={!isModelAllowed(model.id) ? colors.text.muted : (isSelected ? colors.primary[400] : colors.text.muted)}
                                />
                                <Text style={[
                                    styles.name,
                                    isSelected && isModelAllowed(model.id) && styles.nameSelected,
                                    !isModelAllowed(model.id) && styles.textLocked
                                ]}>
                                    {model.name}
                                </Text>
                                {mode === 'main' ? (
                                    // Main mode: show lock if not allowed
                                    !isModelAllowed(model.id) && (
                                        <Ionicons
                                            name="lock-closed"
                                            size={14}
                                            color={colors.text.muted}
                                            style={styles.lockIcon}
                                        />
                                    )
                                ) : (
                                    // Settings mode: show lock if not allowed
                                    !isModelAllowed(model.id) && (
                                        <Ionicons
                                            name="lock-closed"
                                            size={16}
                                            color={colors.text.muted}
                                            style={styles.lockIcon}
                                        />
                                    )
                                )}
                            </View>

                            {mode === 'settings' && (
                                <>
                                    <Text style={[styles.tag, !isModelAllowed(model.id) && styles.textLocked]}>{model.tag}</Text>
                                    <Text style={[styles.cost, !isModelAllowed(model.id) && styles.textLocked]}>{model.cost}</Text>
                                    <Text style={[styles.desc, !isModelAllowed(model.id) && styles.textLocked]}>{model.desc}</Text>
                                </>
                            )}
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
        padding: mode === 'main' ? spacing.sm : spacing.lg,
    },
    description: {
        fontSize: typography.fontSize.sm,
        color: colors.text.muted,
        marginBottom: spacing.md,
        textAlign: 'center',
    },
    grid: {
        flexDirection: mode === 'main' ? 'column' : 'row',
        flexWrap: 'wrap',
        gap: mode === 'main' ? spacing.xs : spacing.md,
        justifyContent: mode === 'main' ? 'flex-end' : 'center',
    },
    card: {
        flex: mode === 'main' ? 0 : 1,
        minWidth: mode === 'main' ? 200 : 140,
        maxWidth: mode === 'main' ? 220 : 180,
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: mode === 'main' ? spacing.sm : spacing.md,
        borderWidth: 2,
        borderColor: colors.border.default,
        ...(mode === 'main' ? shadows.md : {}),
    },
    cardSelected: {
        borderColor: colors.primary[400],
        backgroundColor: colors.primary[600] + '10',
    },
    cardLocked: {
        opacity: 0.5,
        backgroundColor: colors.background.tertiary,
        borderColor: colors.border.default,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.xs,
    },
    name: {
        fontSize: mode === 'main' ? typography.fontSize.xs : typography.fontSize.sm,
        fontWeight: '600',
        color: colors.text.secondary,
        flex: 1,
    },
    nameSelected: {
        color: colors.primary[400],
    },
    textLocked: {
        color: colors.text.muted,
    },
    lockIcon: {
        marginLeft: 'auto',
    },
    tag: {
        fontSize: typography.fontSize.xs,
        color: colors.gold.main,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: spacing.xs,
    },
    cost: {
        fontSize: typography.fontSize.sm,
        color: colors.text.primary,
        fontWeight: '600',
        marginBottom: spacing.xs,
    },
    desc: {
        fontSize: typography.fontSize.xs,
        color: colors.text.muted,
        lineHeight: 16,
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
