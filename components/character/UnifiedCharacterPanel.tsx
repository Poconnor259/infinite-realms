import * as React from 'react';
import { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, LayoutAnimation, Platform, UIManager, Animated, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, typography } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';
import type { NormalizedCharacter, NormalizedResource, NormalizedStat, NormalizedAbility, NormalizedItem } from '../../lib/normalizeCharacter';
import { DiceRoller } from '../DiceRoller';
import { useGameStore } from '../../lib/store';

interface PendingRoll {
    type: string;
    purpose: string;
    modifier?: number;
    stat?: string;
    difficulty?: number;
}

interface UnifiedCharacterPanelProps {
    character: NormalizedCharacter;
    worldType?: string;
    onAcceptQuest?: (questId: string) => void;
    onDeclineQuest?: (questId: string) => void;
    onRequestQuests?: () => void;
    isRequestingQuests?: boolean;
    pendingRoll?: PendingRoll | null;
    onRollComplete?: (result: { roll: number; total: number; success?: boolean }) => void;
    onDismiss?: () => void;
}

export function UnifiedCharacterPanel({ character, worldType, onAcceptQuest, onDeclineQuest, onRequestQuests, isRequestingQuests, pendingRoll, onRollComplete, onDismiss }: UnifiedCharacterPanelProps) {
    const { colors } = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    // Enable LayoutAnimation for Android
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }

    // Animated height for dice roller section
    const diceHeightAnim = useRef(new Animated.Value(0)).current;
    const [showDice, setShowDice] = useState(false);

    // ScrollView reference for auto-scrolling
    const scrollViewRef = useRef<ScrollView>(null);
    const [diceSectionY, setDiceSectionY] = useState(0);

    // Get roll history from store
    const rollHistory = useGameStore((state) => state.rollHistory);

    // Animate dice section in/out when pendingRoll changes or history exists
    useEffect(() => {
        // Always show dice section
        setShowDice(true);
        Animated.spring(diceHeightAnim, {
            toValue: 1,
            useNativeDriver: false,
            tension: 50,
            friction: 8,
        }).start();

        // Auto-scroll to dice section when a roll is pending
        if (pendingRoll && scrollViewRef.current) {
            // Short delay to ensure LayoutAnimation and section expanding are underway
            setTimeout(() => {
                scrollViewRef.current?.scrollTo({ y: diceSectionY, animated: true });
            }, 300);
        }
    }, [pendingRoll, rollHistory, diceHeightAnim, diceSectionY]);

    // Previous Character Ref for simple change detection
    const prevCharacter = useRef(character);
    const [updates, setUpdates] = useState<Record<string, boolean>>({});

    // Simple heuristic to detect changes in sections
    useEffect(() => {
        const newUpdates: Record<string, boolean> = { ...updates };
        let hasChanges = false;

        // Health/Resources change
        const prevHp = prevCharacter.current.resources.find(r => r.name === 'HP')?.current;
        const currHp = character.resources.find(r => r.name === 'HP')?.current;
        if (prevHp !== currHp) {
            newUpdates['resources'] = true;
            hasChanges = true;
        }

        // Inventory change
        if (prevCharacter.current.inventory.length !== character.inventory.length) {
            newUpdates['inventory'] = true;
            hasChanges = true;
        }

        // Stats change (e.g. level up or buff)
        if (JSON.stringify(prevCharacter.current.stats) !== JSON.stringify(character.stats)) {
            newUpdates['stats'] = true;
            hasChanges = true;
        }

        // Adventures change (handled directly via suggestedQuests check usually, but stick to pattern)
        if (character.suggestedQuests.length > prevCharacter.current.suggestedQuests.length) {
            newUpdates['quests'] = true;
            hasChanges = true;
        }

        // Abilities change
        if (character.abilities.length !== prevCharacter.current.abilities.length) {
            newUpdates['abilities'] = true;
            hasChanges = true;
        }

        if (hasChanges) {
            setUpdates(newUpdates);
        }

        prevCharacter.current = character;
    }, [character]);

    const clearUpdate = (key: string) => {
        if (updates[key]) {
            setUpdates(u => ({ ...u, [key]: false }));
        }
    };

    // Debug logging
    console.log('[UnifiedCharacterPanel] Rendering character:', character);

    // Early return if no character
    if (!character || !character.name) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>Character stats will appear here</Text>
                <Text style={styles.emptySubtitle}>Send your first message to begin</Text>
            </View>
        );
    }

    // Defensive coercion to prevent React error #418
    const safeName = String(character.name || 'Unknown');
    const safeRank = character.rank ? String(character.rank) : null;
    const safeLevel = typeof character.level === 'number' ? character.level : 0;
    const safeClass = character.class ? String(character.class) : null;

    return (
        <ScrollView
            ref={scrollViewRef}
            style={styles.container}
            showsVerticalScrollIndicator={false}
        >
            {/* Character Header */}
            <View style={styles.header}>
                <Text style={styles.characterName}>{safeName}</Text>
                <View style={styles.headerMeta}>
                    {safeRank && (
                        <View style={[styles.rankBadge, { backgroundColor: getRankColor(safeRank) + '20' }]}>
                            <Text style={[styles.rankText, { color: getRankColor(safeRank) }]}>
                                {safeRank}
                            </Text>
                        </View>
                    )}
                    {safeLevel > 0 && (
                        <Text style={styles.levelText}>Level {safeLevel}</Text>
                    )}
                    {safeClass && (
                        <Text style={styles.classText}>{safeClass}</Text>
                    )}
                </View>

                {/* Level/Rank Progression Bar */}
                {character.experience && (
                    <View style={styles.progressionContainer}>
                        <View style={styles.progressionHeader}>
                            <Text style={styles.progressionLabel}>
                                {character.displayRank || (character.rank ? `${character.rank} Progress` : 'Level Progress')}
                            </Text>
                            <Text style={styles.progressionValue}>
                                {character.experience.current} / {character.experience.max} XP
                            </Text>
                        </View>
                        <View style={[styles.progressBarBg, { backgroundColor: colors.background.tertiary }]}>
                            <View
                                style={[
                                    styles.progressBarFill,
                                    {
                                        width: `${Math.min(100, Math.max(0, (character.experience.current / character.experience.max) * 100))}%`,
                                        backgroundColor: colors.primary[500]
                                    }
                                ]}
                            />
                        </View>
                    </View>
                )}
            </View>

            {/* Dice Roller Section - Collapsible */}
            <View onLayout={(e) => setDiceSectionY(e.nativeEvent.layout.y)}>
                {showDice && (
                    <CollapsibleSection
                        title="🎲 Dice Rolls"
                        colors={colors}
                        styles={styles}
                        defaultExpanded={!!pendingRoll}
                    >
                        <DiceRoller
                            pendingRoll={pendingRoll}
                            rollHistory={rollHistory}
                            onRollComplete={(result: any) => {
                                if (onRollComplete) {
                                    onRollComplete(result);
                                }
                            }}
                            onDismiss={onDismiss}
                        />
                    </CollapsibleSection>
                )}
            </View>

            {/* Fate Engine Indicator - Show momentum and luck mechanics */}
            {character.extras.fateEngine && (
                <CollapsibleSection
                    title="⚡ Fate Engine"
                    colors={colors}
                    styles={styles}
                    defaultExpanded={false}
                >
                    <FateEngineIndicator fateEngine={character.extras.fateEngine} colors={colors} styles={styles} />
                </CollapsibleSection>
            )}

            {/* Quests Section - Always visible */}
            <CollapsibleSection
                title="Adventures"
                colors={colors}
                styles={styles}
                defaultExpanded={true}
                hasUpdate={updates['quests'] || character.suggestedQuests.length > 0}
                onExpand={() => clearUpdate('quests')}
                rightElement={
                    <TouchableOpacity
                        onPress={onRequestQuests}
                        disabled={isRequestingQuests}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            paddingHorizontal: spacing.xs,
                            paddingVertical: 4,
                            backgroundColor: colors.primary[400],
                            borderRadius: borderRadius.sm,
                        }}
                    >
                        {isRequestingQuests ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="add" size={16} color="#fff" />
                                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Request Quest</Text>
                            </>
                        )}
                    </TouchableOpacity>
                }
            >
                {/* Suggested Quests (New Opportunities) */}
                {character.suggestedQuests.map((quest, index) => (
                    <View key={`suggested-${quest.id || index}`} style={[styles.questCard, { borderColor: colors.primary[400], borderLeftWidth: 4 }]}>
                        <View style={styles.questHeader}>
                            <Text style={styles.questTitle}>{quest.title}</Text>
                            <View style={styles.newBadge}>
                                <Text style={styles.newBadgeText}>NEW</Text>
                            </View>
                        </View>
                        <Text style={styles.questDescription}>{quest.description}</Text>

                        {/* Objectives */}
                        {quest.objectives && quest.objectives.length > 0 && (
                            <View style={styles.questSection}>
                                <Text style={styles.questSectionLabel}>Objectives:</Text>
                                {quest.objectives.map((obj: any, i: number) => (
                                    <Text key={obj.id || i} style={[styles.questObjective, obj.isCompleted && styles.questObjectiveCompleted]}>
                                        {obj.isCompleted ? '✓ ' : '• '}{obj.text}
                                    </Text>
                                ))}
                            </View>
                        )}

                        {/* Detailed Rewards */}
                        {quest.rewards && (
                            <View style={styles.questSection}>
                                <Text style={styles.questSectionLabel}>Rewards:</Text>
                                <View style={styles.rewardsList}>
                                    {quest.rewards.experience > 0 && (
                                        <Text style={styles.rewardTag}>✨ {quest.rewards.experience} XP</Text>
                                    )}
                                    {quest.rewards.gold > 0 && (
                                        <Text style={styles.rewardTag}>💰 {quest.rewards.gold} Gold</Text>
                                    )}
                                    {quest.rewards.items && quest.rewards.items.map((item: string, i: number) => (
                                        <Text key={i} style={styles.rewardTag}>📦 {item}</Text>
                                    ))}
                                </View>
                            </View>
                        )}

                        <View style={styles.questActions}>
                            <TouchableOpacity
                                style={[styles.questActionButton, { backgroundColor: colors.background.tertiary }]}
                                onPress={() => onDeclineQuest?.(quest.id)}
                            >
                                <Text style={[styles.questActionText, { color: colors.text.muted }]}>Decline</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.questActionButton, { backgroundColor: colors.primary[400] }]}
                                onPress={() => onAcceptQuest?.(quest.id)}
                            >
                                <Text style={[styles.questActionText, { color: '#000' }]}>Accept</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ))}

                {/* Active Quests */}
                {character.quests.map((quest, index) => (
                    <View key={`active-${quest.id || index}`} style={styles.questCard}>
                        <Text style={styles.questTitle}>{quest.title}</Text>
                        <Text style={styles.questDescription}>{quest.description}</Text>

                        {/* Objectives */}
                        {quest.objectives && quest.objectives.length > 0 && (
                            <View style={styles.questSection}>
                                <Text style={styles.questSectionLabel}>Objectives:</Text>
                                {quest.objectives.map((obj: any, i: number) => (
                                    <Text key={obj.id || i} style={[styles.questObjective, obj.isCompleted && styles.questObjectiveCompleted]}>
                                        {obj.isCompleted ? '✓ ' : '• '}{obj.text}
                                    </Text>
                                ))}
                            </View>
                        )}

                        {/* Detailed Rewards (New Format) */}
                        {quest.rewards && (
                            <View style={styles.questSection}>
                                <Text style={styles.questSectionLabel}>Rewards:</Text>
                                <View style={styles.rewardsList}>
                                    {quest.rewards.experience > 0 && (
                                        <Text style={styles.rewardTag}>✨ {quest.rewards.experience} XP</Text>
                                    )}
                                    {quest.rewards.gold > 0 && (
                                        <Text style={styles.rewardTag}>💰 {quest.rewards.gold} Gold</Text>
                                    )}
                                    {quest.rewards.items && quest.rewards.items.map((item: string, i: number) => (
                                        <Text key={i} style={styles.rewardTag}>📦 {item}</Text>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Legacy Reward Fallback */}
                        {!quest.rewards && quest.reward && (
                            <Text style={styles.questRewardText}>
                                🎁 Reward: {quest.reward.amount} {quest.reward.type}
                            </Text>
                        )}
                    </View>
                ))}
            </CollapsibleSection>

            {/* Resources Section */}
            {character.resources.length > 0 && (
                <CollapsibleSection
                    title="Resources"
                    colors={colors}
                    styles={styles}
                    defaultExpanded={true}
                    hasUpdate={updates['resources']}
                    onExpand={() => clearUpdate('resources')}
                >
                    {character.resources.map((resource, index) => (
                        <ResourceBar key={`${resource.name}-${index}`} resource={resource} colors={colors} styles={styles} />
                    ))}
                </CollapsibleSection>
            )}

            {/* Stats Section */}
            {character.stats.length > 0 && (
                <CollapsibleSection
                    title="Stats"
                    colors={colors}
                    styles={styles}
                    hasUpdate={updates['stats']}
                    onExpand={() => clearUpdate('stats')}
                >
                    <View style={styles.statsGrid}>
                        {character.stats.map((stat, index) => (
                            <StatBox key={`${stat.id}-${index}`} stat={stat} colors={colors} styles={styles} />
                        ))}
                    </View>
                </CollapsibleSection>
            )}

            {/* Inventory Section */}
            {character.inventory.length > 0 && (
                <CollapsibleSection
                    title="Inventory"
                    colors={colors}
                    styles={styles}
                    hasUpdate={updates['inventory']}
                    onExpand={() => clearUpdate('inventory')}
                >
                    {character.inventory.map((item, index) => (
                        <InventoryItem key={`${item.name}-${index}`} item={item} colors={colors} styles={styles} />
                    ))}
                </CollapsibleSection>
            )}

            {/* Abilities Section */}
            {character.abilities.length > 0 && (
                <CollapsibleSection
                    title="Abilities"
                    colors={colors}
                    styles={styles}
                    hasUpdate={updates['abilities']}
                    onExpand={() => clearUpdate('abilities')}
                >
                    {character.abilities.map((ability, index) => (
                        <AbilityItem key={`${ability.name}-${index}`} ability={ability} colors={colors} styles={styles} />
                    ))}
                </CollapsibleSection>
            )}

            {/* World-Specific Extras */}
            {Object.keys(character.extras).length > 0 && (
                <ExtrasSection
                    extras={character.extras}
                    worldType={worldType}
                    colors={colors}
                    styles={styles}
                    updates={updates}
                    onClearUpdate={() => clearUpdate('extras')}
                />
            )}
        </ScrollView>
    );
}

// ==================== SUB-COMPONENTS ====================

interface CollapsibleSectionProps {
    title: string;
    children: React.ReactNode;
    colors: any;
    styles: any;
    hasUpdate?: boolean;
    defaultExpanded?: boolean;
    onExpand?: () => void;
    rightElement?: React.ReactNode;
}

function CollapsibleSection({ title, children, colors, styles, hasUpdate, defaultExpanded = false, onExpand, rightElement }: CollapsibleSectionProps) {
    const [expanded, setExpanded] = useState(defaultExpanded);

    useEffect(() => {
        if (defaultExpanded) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setExpanded(true);
        }
    }, [defaultExpanded]);

    const toggle = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        const nextState = !expanded;
        setExpanded(nextState);
        if (nextState && onExpand) {
            onExpand();
        }
    };

    return (
        <View style={styles.sectionContainer}>
            <TouchableOpacity onPress={toggle} style={styles.sectionHeader} activeOpacity={0.7}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{title}</Text>
                    {hasUpdate && !expanded && (
                        <View style={styles.updateDot} />
                    )}
                </View>
                {rightElement}
                <Ionicons
                    name={expanded ? "chevron-down" : "chevron-forward"}
                    size={20}
                    color={colors.text.muted}
                />
            </TouchableOpacity>

            {expanded && (
                <View style={styles.sectionContent}>
                    {children}
                </View>
            )}
        </View>
    );
}

function ResourceBar({ resource, colors, styles }: { resource: NormalizedResource; colors: any; styles: any }) {
    const percentage = resource.max > 0 ? (resource.current / resource.max) * 100 : 0;
    const barColor = resource.color || colors.primary[400];

    // Defensive coercion
    const safeName = String(resource.name || 'Resource');
    const safeCurrent = typeof resource.current === 'number' ? resource.current : 0;
    const safeMax = typeof resource.max === 'number' ? resource.max : 100;
    const safeIcon = resource.icon ? String(resource.icon) : '';

    return (
        <View style={styles.resourceContainer}>
            <View style={styles.resourceHeader}>
                <Text style={[styles.resourceName, { color: colors.text.secondary }]}>
                    {safeIcon && `${safeIcon} `}{safeName}
                </Text>
                <Text style={[styles.resourceValue, { color: colors.text.muted }]}>
                    {safeCurrent} / {safeMax}
                </Text>
            </View>
            <View style={[styles.resourceBarBg, { backgroundColor: colors.background.tertiary }]}>
                <View
                    style={[
                        styles.resourceBarFill,
                        { width: `${percentage}%`, backgroundColor: barColor }
                    ]}
                />
            </View>
        </View>
    );
}

function StatBox({ stat, colors, styles }: { stat: NormalizedStat; colors: any; styles: any }) {
    // Defensive coercion
    const safeName = String(stat.name || 'Stat');
    const safeAbbr = stat.abbreviation ? String(stat.abbreviation) : safeName.slice(0, 3).toUpperCase();
    const safeValue = typeof stat.value === 'number' ? stat.value : 0;
    const safeIcon = stat.icon ? String(stat.icon) : null;

    return (
        <View style={[styles.statBox, { backgroundColor: colors.background.tertiary }]}>
            <Text style={[styles.statLabel, { color: colors.text.muted }]}>
                {safeAbbr}
            </Text>
            <Text style={[styles.statValue, { color: colors.text.primary }]}>
                {safeValue}
            </Text>
            {safeIcon && (
                <Text style={styles.statIcon}>{safeIcon}</Text>
            )}
        </View>
    );
}

function InventoryItem({ item, colors, styles }: { item: NormalizedItem; colors: any; styles: any }) {
    // Defensive coercion
    const safeName = String(item.name || 'Item');
    const safeQuantity = typeof item.quantity === 'number' ? item.quantity : 1;

    return (
        <View style={[styles.inventoryItem, { backgroundColor: colors.background.tertiary }]}>
            <View style={styles.inventoryLeft}>
                {item.equipped && <Text style={styles.equippedIcon}>⚡</Text>}
                <Text style={[styles.itemName, { color: colors.text.primary }]}>
                    {safeName}
                </Text>
            </View>
            {safeQuantity > 1 && (
                <Text style={[styles.itemQuantity, { color: colors.text.muted }]}>
                    ×{safeQuantity}
                </Text>
            )}
        </View>
    );
}

function AbilityItem({ ability, colors, styles }: { ability: NormalizedAbility; colors: any; styles: any }) {
    // Defensive coercion
    const safeName = String(ability.name || 'Ability');
    const safeRank = ability.rank ? String(ability.rank) : null;
    const safeType = ability.type ? String(ability.type) : null;
    const safeCooldown = typeof ability.currentCooldown === 'number' ? ability.currentCooldown : 0;
    const isOnCooldown = safeCooldown > 0;

    return (
        <View style={[styles.abilityItem, { backgroundColor: colors.background.tertiary }]}>
            <View style={styles.abilityHeader}>
                <Text style={[styles.abilityName, { color: colors.text.primary }]}>
                    {safeName}
                </Text>
                {safeRank && (
                    <Text style={[styles.abilityRank, { color: getRankColor(safeRank) }]}>
                        {safeRank}
                    </Text>
                )}
            </View>
            {safeType && (
                <Text style={[styles.abilityType, { color: colors.text.muted }]}>
                    {safeType}
                </Text>
            )}
            {isOnCooldown && (
                <Text style={[styles.abilityCooldown, { color: colors.status.warning }]}>
                    Cooldown: {safeCooldown}
                </Text>
            )}
        </View>
    );
}

function FateEngineIndicator({ fateEngine, colors, styles }: { fateEngine: any; colors: any; styles: any }) {
    const momentum = fateEngine.momentum_counter || 0;
    const pityCritProgress = fateEngine.pity_crit_counter || 0;
    const fumbleProtection = fateEngine.fumble_protection_active || false;
    const directorMode = fateEngine.director_mode_cooldown || false;

    // Calculate pity crit percentage (triggers at 5)
    const pityCritPercentage = Math.min((pityCritProgress / 5) * 100, 100);

    return (
        <View style={{ gap: spacing.md }}>
            {/* Momentum Counter */}
            <View style={styles.fateEngineItem}>
                <View style={styles.fateEngineHeader}>
                    <Text style={[styles.fateEngineName, { color: colors.text.secondary }]}>
                        🌟 Momentum
                    </Text>
                    <Text style={[styles.fateEngineValue, { color: colors.primary[400] }]}>
                        {momentum}
                    </Text>
                </View>
                <Text style={[styles.fateEngineDesc, { color: colors.text.muted }]}>
                    Builds on successes, increases crit chance
                </Text>
            </View>

            {/* Pity Crit Progress */}
            <View style={styles.fateEngineItem}>
                <View style={styles.fateEngineHeader}>
                    <Text style={[styles.fateEngineName, { color: colors.text.secondary }]}>
                        🎯 Pity Crit Progress
                    </Text>
                    <Text style={[styles.fateEngineValue, { color: colors.status.warning }]}>
                        {pityCritProgress}/5
                    </Text>
                </View>
                <View style={[styles.progressBarBg, { backgroundColor: colors.background.tertiary }]}>
                    <View
                        style={[
                            styles.progressBarFill,
                            { width: `${pityCritPercentage}%`, backgroundColor: colors.status.warning }
                        ]}
                    />
                </View>
                <Text style={[styles.fateEngineDesc, { color: colors.text.muted }]}>
                    Guaranteed crit after 5 non-crits
                </Text>
            </View>

            {/* Fumble Protection */}
            {fumbleProtection && (
                <View style={[styles.fateEngineItem, { backgroundColor: colors.status.success + '20' }]}>
                    <View style={styles.fateEngineHeader}>
                        <Text style={[styles.fateEngineName, { color: colors.status.success }]}>
                            🛡️ Fumble Protection Active
                        </Text>
                    </View>
                    <Text style={[styles.fateEngineDesc, { color: colors.text.muted }]}>
                        Next natural 1 will be rerolled
                    </Text>
                </View>
            )}

            {/* Director Mode */}
            {directorMode && (
                <View style={[styles.fateEngineItem, { backgroundColor: colors.status.info + '20' }]}>
                    <View style={styles.fateEngineHeader}>
                        <Text style={[styles.fateEngineName, { color: colors.status.info }]}>
                            🎬 Director Mode Active
                        </Text>
                    </View>
                    <Text style={[styles.fateEngineDesc, { color: colors.text.muted }]}>
                        Difficulty adjusted in your favor
                    </Text>
                </View>
            )}
        </View>
    );
}

function ExtrasSection({ extras, worldType, colors, styles, updates, onClearUpdate }: {

    extras: Record<string, any>;
    worldType?: string;
    colors: any;
    styles: any;
    updates?: Record<string, boolean>;
    onClearUpdate?: () => void;
}) {
    // Outworlder Essences
    if (extras.essences && Array.isArray(extras.essences) && extras.essences.length > 0) {
        const count = extras.essences.length;

        return (
            <CollapsibleSection
                title={`Essences (${count}/4)`}
                colors={colors}
                styles={styles}
                hasUpdate={updates?.['extras']}
                onExpand={onClearUpdate}
            >
                {extras.essences.map((essence: string, idx: number) => (
                    <View key={idx} style={[styles.essenceItem, { backgroundColor: colors.background.tertiary }]}>
                        <Text style={[styles.essenceName, { color: colors.text.primary }]}>{essence}</Text>
                    </View>
                ))}
            </CollapsibleSection>
        );
    }

    return null;
}

// ==================== HELPERS ====================

function getRankColor(rank: string): string {
    const colors: Record<string, string> = {
        'Iron': '#6B7280',
        'Bronze': '#CD7F32',
        'Silver': '#C0C0C0',
        'Gold': '#FFD700',
        'Diamond': '#B9F2FF',
        'Normal': '#9CA3AF',
        'Common': '#9CA3AF',
        'Uncommon': '#22C55E',
        'Rare': '#3B82F6',
        'Epic': '#8B5CF6',
        'Legendary': '#F59E0B',
    };
    return colors[rank] || '#9CA3AF';
}

// ==================== STYLES ====================

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.secondary,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    emptyTitle: {
        color: colors.text.secondary,
        fontSize: typography.fontSize.md,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    emptySubtitle: {
        color: colors.text.muted,
        fontSize: typography.fontSize.sm,
        textAlign: 'center',
    },
    header: {
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
        alignItems: 'center',
    },
    characterName: {
        fontSize: typography.fontSize.xl,
        fontWeight: 'bold',
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    headerMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    rankBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
    },
    rankText: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    levelText: {
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
    },
    classText: {
        fontSize: typography.fontSize.sm,
        color: colors.text.muted,
        fontStyle: 'italic',
    },
    diceSection: {
        backgroundColor: colors.background.secondary,
    },
    sectionContainer: {
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
    },
    sectionContent: {
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.md,
    },
    updateDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.primary[400],
    },
    sectionTitle: {
        fontSize: typography.fontSize.md,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: 0,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    // New Quest Styles
    questCard: {
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    questHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    questTitle: {
        fontSize: typography.fontSize.md,
        fontWeight: 'bold',
        color: colors.text.primary,
        flex: 1,
    },
    newBadge: {
        backgroundColor: colors.primary[400],
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
        borderRadius: borderRadius.xs,
    },
    newBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#000',
    },
    questDescription: {
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
        lineHeight: 18,
    },
    questRewardText: {
        fontSize: 12,
        color: colors.gold.main,
        fontWeight: '600',
        marginTop: spacing.xs,
    },
    questActions: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.sm,
    },
    questActionButton: {
        flex: 1,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    questActionText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    // New Quest Detailed Styles
    questSection: {
        marginTop: spacing.sm,
        marginBottom: spacing.xs,
    },
    questSectionLabel: {
        fontSize: 11,
        color: colors.text.muted,
        fontWeight: '600',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    questObjective: {
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
        marginBottom: 2,
        marginLeft: spacing.xs,
    },
    questObjectiveCompleted: {
        color: colors.text.muted,
        textDecorationLine: 'line-through',
    },
    rewardsList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
    },
    rewardTag: {
        fontSize: 11,
        color: colors.text.primary,
        backgroundColor: colors.background.tertiary,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    // Resource Bar
    resourceContainer: {
        marginBottom: spacing.md,
    },
    resourceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.xs,
    },
    resourceName: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    resourceValue: {
        fontSize: typography.fontSize.sm,
    },
    resourceBarBg: {
        height: 20,
        borderRadius: borderRadius.md,
        overflow: 'hidden',
    },
    resourceBarFill: {
        height: '100%',
        borderRadius: borderRadius.md,
    },

    // Stat Box
    statBox: {
        width: '30%',
        minWidth: 70,
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        alignItems: 'center',
    },
    statLabel: {
        fontSize: typography.fontSize.xs,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    statValue: {
        fontSize: typography.fontSize.xl,
        fontWeight: 'bold',
        marginTop: spacing.xs,
    },
    statIcon: {
        fontSize: typography.fontSize.sm,
        marginTop: spacing.xs,
    },

    // Inventory Item
    inventoryItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.sm,
        borderRadius: borderRadius.sm,
        marginBottom: spacing.xs,
    },
    inventoryLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    equippedIcon: {
        marginRight: spacing.xs,
    },
    itemName: {
        fontSize: typography.fontSize.sm,
    },
    itemQuantity: {
        fontSize: typography.fontSize.xs,
    },

    // Ability Item
    abilityItem: {
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        marginBottom: spacing.sm,
    },
    abilityHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    abilityName: {
        fontSize: typography.fontSize.md,
        fontWeight: '600',
        flex: 1,
    },
    abilityRank: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    abilityType: {
        fontSize: typography.fontSize.xs,
        marginTop: spacing.xs,
        textTransform: 'capitalize',
    },
    abilityCooldown: {
        fontSize: typography.fontSize.xs,
        marginTop: spacing.xs,
    },

    // Extras Section
    section: {
        padding: spacing.md,
        borderBottomWidth: 1,
    },
    essenceItem: {
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        marginBottom: spacing.xs,
    },
    essenceName: {
        fontSize: typography.fontSize.sm,
        fontWeight: '500',
    },
    confluenceItem: {
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        marginTop: spacing.sm,
    },
    confluenceLabel: {
        fontSize: typography.fontSize.xs,
        marginBottom: spacing.xs,
    },
    confluenceName: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },

    // Fate Engine Indicator
    fateEngineItem: {
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        backgroundColor: 'transparent',
        marginBottom: spacing.xs,
    },
    fateEngineHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    fateEngineName: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    fateEngineValue: {
        fontSize: typography.fontSize.md,
        fontWeight: 'bold',
    },
    fateEngineDesc: {
        fontSize: typography.fontSize.xs,
        marginTop: spacing.xs,
    },
    progressionContainer: {
        marginTop: spacing.sm,
        width: '100%',
    },
    progressionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    progressionLabel: {
        fontSize: 10,
        fontWeight: 'bold',
        color: colors.text.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    progressionValue: {
        fontSize: 10,
        fontWeight: '600',
        color: colors.text.secondary,
    },
    progressBarBg: {
        height: 6,
        borderRadius: borderRadius.full,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: borderRadius.full,
    },
});
