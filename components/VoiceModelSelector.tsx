import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useUserStore, useConfigStore } from '../lib/store';
import { useThemeColors } from '../lib/hooks/useTheme';
import { spacing, borderRadius, typography, shadows } from '../lib/theme';
import { AVAILABLE_MODELS, GlobalConfig } from '../lib/types';

interface VoiceModelSelectorProps {
    user: any;
    mode: 'settings' | 'main';
    modelType?: 'brain' | 'voice'; // Which model to select - defaults to 'voice'
    onShowUpgrade?: () => void;
    modelCosts?: Record<string, number>;
    tierMapping?: GlobalConfig['tierMapping'];
    subscriptionPermissions?: GlobalConfig['subscriptionPermissions'];
    showFavoritesOnly?: boolean;
}

export function VoiceModelSelector({ user, mode, modelType = 'voice', onShowUpgrade, modelCosts, tierMapping, subscriptionPermissions, showFavoritesOnly }: VoiceModelSelectorProps) {
    const { colors } = useThemeColors();
    const styles = createStyles(colors, mode);
    const [isExpanded, setIsExpanded] = useState(false);
    const config = useConfigStore((state) => state.config);

    // Read the current model based on modelType
    const currentModel = modelType === 'brain'
        ? (user?.preferredModels?.brain || 'gemini-1.5-flash-002')
        : (user?.preferredModels?.voice || 'gemini-1.5-flash-002');

    const basicPermissions = subscriptionPermissions || config?.subscriptionPermissions;
    const basicCosts = modelCosts || config?.modelCosts || {};
    const basicMapping = tierMapping || config?.tierMapping || {
        premium: undefined,
        balanced: undefined,
        economical: undefined
    };

    const getCostText = (id: string) => {
        let cost = basicCosts[id];
        if (cost === undefined) {
            const modelDef = AVAILABLE_MODELS.find(m => m.id === id);
            cost = modelDef?.defaultTurnCost;
        }

        if (cost !== undefined) return `~${cost} turns/action`;
        return 'Unknown cost';
    };

    const getCostValue = (id: string): number => {
        let cost = basicCosts[id];
        if (cost === undefined) {
            const modelDef = AVAILABLE_MODELS.find(m => m.id === id);
            cost = modelDef?.defaultTurnCost;
        }
        return cost !== undefined ? cost : 1;
    };

    // Analyze User Permissions
    const userTier = (user?.tier || 'scout').toLowerCase();
    const userPermissions = basicPermissions?.[userTier as keyof typeof basicPermissions];

    // Define the 3 main tiers dynamically
    const tiers = [
        { key: 'premium' as const, tag: 'Premium', icon: 'sparkles', defaultDesc: 'High quality storytelling' },
        { key: 'balanced' as const, tag: 'Balanced', icon: 'flash', defaultDesc: 'Balanced speed & quality' },
        { key: 'economical' as const, tag: 'Economical', icon: 'rocket', defaultDesc: 'Fast & efficient' }
    ];

    const models = tiers.map(tier => {
        // 1. Get the Model ID mapped to this tier in Global Config
        const mappedModelId = basicMapping[tier.key];

        // 2. Look up static details (Name, Provider) from code constants
        const staticDetails = AVAILABLE_MODELS.find(m => m.id === mappedModelId);

        // 3. Fallback Name if static lookup fails
        const displayId = mappedModelId || 'Unknown Model';
        const displayName = staticDetails?.name || displayId;

        // 4. Resolve Description
        const description = staticDetails?.description || tier.defaultDesc;

        // 5. Resolve Cost dynamically
        const costText = getCostText(mappedModelId);

        // 6. Check Permissions
        let isLocked = false;

        if (user?.tier === 'legendary' || user?.tier === 'legend') {
            isLocked = false;
        } else if (userPermissions?.allowedTiers) {
            isLocked = !userPermissions.allowedTiers.includes(tier.key);
        } else if (userPermissions?.allowedModels) {
            isLocked = !userPermissions.allowedModels.includes(mappedModelId);
        } else {
            if (userTier === 'scout' && tier.key !== 'economical') isLocked = true;
        }

        return {
            id: mappedModelId,
            name: `${tier.tag} - ${displayName} - ${costText}`,
            rawName: displayName,
            icon: tier.icon,
            tag: tier.tag,
            desc: description,
            isLocked,
            tierKey: tier.key
        };
    }).filter(model => {
        if (!showFavoritesOnly || !config?.favoriteModels) return true;
        return config.favoriteModels.includes(model.id);
    });

    // Filter logic for Main Mode (collapsed)
    const visibleModels = mode === 'settings' || isExpanded
        ? models
        : models.filter(m => m.id === currentModel);

    // Filter out if models are not loaded yet or ID mismatch
    const finalVisibleModels = visibleModels.length > 0 ? visibleModels : [models.find(m => m.id === currentModel) || models[2]];

    const updateModel = async (modelId: string) => {
        if (user?.id) {
            try {
                // Optimistic update
                useUserStore.setState({
                    user: {
                        ...user,
                        preferredModels: {
                            ...user.preferredModels,
                            [modelType]: modelId
                        }
                    }
                });

                await updateDoc(doc(db, 'users', user.id), {
                    [`preferredModels.${modelType}`]: modelId
                });
            } catch (error) {
                console.error('Failed to update model preference:', error);
            }
        }
    };

    const handleModelPress = (model: typeof models[0]) => {
        if (model.isLocked) {
            onShowUpgrade?.();
            return;
        }

        if (mode === 'main') {
            if (!isExpanded) {
                setIsExpanded(true);
            } else if (model.id === currentModel) {
                setIsExpanded(false);
            } else {
                updateModel(model.id);
                setIsExpanded(false);
            }
        } else {
            updateModel(model.id);
        }
    };

    const getDescription = () => {
        if (modelType === 'brain') return "Controls game logic speed and cost. Admin only.";
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
                {finalVisibleModels.map((model) => {
                    const isSelected = currentModel === model.id;

                    return (
                        <TouchableOpacity
                            key={model.tierKey}
                            style={[
                                styles.card,
                                isSelected && !model.isLocked && styles.cardSelected,
                                model.isLocked && styles.cardLocked,
                            ]}
                            onPress={() => handleModelPress(model)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.cardContent}>
                                <View style={[styles.iconContainer, isSelected && !model.isLocked && styles.iconContainerSelected]}>
                                    <Ionicons
                                        name={model.icon as any}
                                        size={20}
                                        color={model.isLocked ? colors.text.muted : (isSelected ? colors.primary[400] : colors.text.secondary)}
                                    />
                                </View>

                                <View style={styles.textContainer}>
                                    <View style={styles.headerRow}>
                                        <Text style={[
                                            styles.name,
                                            isSelected && !model.isLocked && styles.nameSelected,
                                            model.isLocked && styles.textLocked
                                        ]}>
                                            {model.name}
                                        </Text>
                                        {model.isLocked && (
                                            <Ionicons name="lock-closed" size={14} color={colors.text.muted} />
                                        )}
                                    </View>

                                    {mode === 'settings' && (
                                        <Text style={[styles.desc, model.isLocked && styles.textLocked]} numberOfLines={1}>
                                            {model.desc}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {mode === 'settings' && user?.turns !== undefined && !models.find(m => m.id === currentModel)?.isLocked && (
                <View style={styles.estimate}>
                    <Ionicons name="information-circle-outline" size={16} color={colors.text.muted} />
                    <Text style={styles.estimateText}>
                        {user.turns} turns remaining ≈ {Math.floor(user.turns / getCostValue(currentModel))} actions
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
