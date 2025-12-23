import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { spacing, borderRadius, typography } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';
import { getGameEngines } from '../../lib/firebase';
import type { GameEngine } from '../../lib/types';

interface GenericCharacterPanelProps {
    character: any;
    worldType: string;
}

export function GenericCharacterPanel({ character, worldType }: GenericCharacterPanelProps) {
    const { colors } = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [gameEngine, setGameEngine] = useState<GameEngine | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadGameEngine();
    }, [worldType]);

    const loadGameEngine = async () => {
        try {
            const engines = await getGameEngines();

            // Legacy mapping for old campaign IDs
            let searchType = worldType;
            if (worldType === 'shadow-monarch' || worldType === 'shadowMonarch') {
                searchType = 'tactical';
            }

            // Match by engine ID or name
            const engine = engines.find(e =>
                e.id === searchType ||
                e.name.toLowerCase().replace(/\s+/g, '-') === searchType ||
                e.name.toLowerCase() === searchType.toLowerCase()
            );
            setGameEngine(engine || null);
        } catch (error) {
            console.error('Failed to load game engine:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Early return if character data is not available
    if (!character) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
                <Text style={{ color: colors.text.secondary, textAlign: 'center', marginBottom: spacing.sm }}>
                    Character stats will appear here
                </Text>
                <Text style={{ color: colors.text.muted, textAlign: 'center', fontSize: typography.fontSize.sm }}>
                    Send your first message to begin your adventure
                </Text>
            </View>
        );
    }

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator color={colors.primary[400]} />
                <Text style={{ color: colors.text.muted, marginTop: spacing.sm }}>Loading character...</Text>
            </View>
        );
    }

    if (!gameEngine) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
                <Text style={{ color: colors.text.secondary, textAlign: 'center' }}>
                    Game engine not found for "{worldType}"
                </Text>
            </View>
        );
    }

    // Helper to get stat modifier (for D&D-style stats)
    const getModifier = (stat: number, engine: GameEngine): string => {
        // Only calculate modifiers for stats with max <= 30 (D&D style)
        if (!engine.stats || engine.stats.length === 0) return '';

        const statDef = engine.stats.find(s => s.max <= 30);
        if (!statDef) return '';

        const mod = Math.floor((stat - 10) / 2);
        return mod >= 0 ? `+${mod}` : `${mod}`;
    };

    // Get resource color with fallback
    const getResourceColor = (resourceId: string): string => {
        const resource = gameEngine.resources?.find(r => r.id === resourceId);
        return resource?.color || colors.primary[400];
    };

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Character Header */}
            <View style={styles.header}>
                <Text style={styles.characterName}>{character.name}</Text>
                <Text style={styles.characterSubtitle}>
                    {gameEngine.progression?.type === 'level' && `Level ${character.level || 1}`}
                    {gameEngine.progression?.type === 'rank' && (character.rank || 'Iron')}
                    {character.class && ` ${character.class}`}
                    {character.race && ` ${character.race}`}
                </Text>
            </View>

            {/* Resources (HP, Mana, etc.) */}
            {gameEngine.resources && gameEngine.resources.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Resources</Text>
                    {gameEngine.resources.map((resourceDef) => {
                        // Map resource IDs to legacy character property names
                        const legacyMapping: Record<string, string> = {
                            'health': 'hp',
                            'stamina': 'spirit',
                        };
                        const legacyKey = legacyMapping[resourceDef.id] || resourceDef.id;

                        // Try multiple paths to find resource data
                        const resourceData =
                            character.resources?.[resourceDef.id] ||
                            character[resourceDef.id] ||
                            character[legacyKey];

                        if (!resourceData) return null;

                        const current = resourceData.current ?? resourceData ?? 0;
                        const max = resourceData.max ?? 100;
                        const percentage = max > 0 ? (current / max) * 100 : 0;

                        return (
                            <View key={resourceDef.id} style={styles.resourceContainer}>
                                <Text style={styles.resourceLabel}>{resourceDef.name}</Text>
                                <View style={styles.resourceBar}>
                                    <View
                                        style={[
                                            styles.resourceFill,
                                            {
                                                width: `${percentage}%`,
                                                backgroundColor: resourceDef.color || colors.primary[400]
                                            }
                                        ]}
                                    />
                                </View>
                                <Text style={styles.resourceText}>
                                    {typeof current === 'object' ? current.current : current} / {max}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            )}

            {/* Stats */}
            {gameEngine.stats && gameEngine.stats.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Stats</Text>
                    <View style={styles.statsGrid}>
                        {gameEngine.stats.map((statDef) => {
                            const statValue = character.stats?.[statDef.id] || statDef.default;
                            const showModifier = statDef.max <= 30; // Show modifiers for D&D-style stats

                            return (
                                <View key={statDef.id} style={styles.statBox}>
                                    <Text style={styles.statLabel}>{statDef.abbreviation}</Text>
                                    <Text style={styles.statValue}>{statValue}</Text>
                                    {showModifier && (
                                        <Text style={styles.statModifier}>
                                            {getModifier(statValue, gameEngine)}
                                        </Text>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                </View>
            )}

            {/* Inventory */}
            {character.inventory && character.inventory.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Inventory</Text>
                    {character.inventory.map((item: any, idx: number) => (
                        <View key={idx} style={styles.inventoryItem}>
                            <Text style={styles.itemName}>
                                {item.equipped && '⚡ '}
                                {item.name}
                            </Text>
                            {item.quantity > 1 && (
                                <Text style={styles.itemQuantity}>×{item.quantity}</Text>
                            )}
                        </View>
                    ))}
                </View>
            )}

            {/* Abilities */}
            {character.abilities && character.abilities.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Abilities</Text>
                    {character.abilities.map((ability: any, idx: number) => (
                        <View key={idx} style={styles.abilityItem}>
                            <Text style={styles.abilityName}>{ability.name}</Text>
                            {ability.type && (
                                <Text style={styles.abilityType}>{ability.type}</Text>
                            )}
                        </View>
                    ))}
                </View>
            )}
        </ScrollView>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.secondary,
    },
    header: {
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
    },
    characterName: {
        fontSize: typography.fontSize.xl,
        fontWeight: 'bold',
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    characterSubtitle: {
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
    },
    section: {
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
    },
    sectionTitle: {
        fontSize: typography.fontSize.md,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: spacing.sm,
    },
    resourceContainer: {
        marginBottom: spacing.md,
    },
    resourceLabel: {
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
        marginBottom: spacing.xs,
        fontWeight: '600',
    },
    resourceBar: {
        height: 24,
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.md,
        overflow: 'hidden',
        marginBottom: spacing.xs,
    },
    resourceFill: {
        height: '100%',
        borderRadius: borderRadius.md,
    },
    resourceText: {
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
        textAlign: 'center',
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    statBox: {
        width: '30%',
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.md,
        padding: spacing.sm,
        alignItems: 'center',
    },
    statLabel: {
        fontSize: typography.fontSize.xs,
        color: colors.text.muted,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    statValue: {
        fontSize: typography.fontSize.xl,
        color: colors.text.primary,
        fontWeight: 'bold',
    },
    statModifier: {
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
    },
    inventoryItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.sm,
        marginBottom: spacing.xs,
    },
    itemName: {
        fontSize: typography.fontSize.sm,
        color: colors.text.primary,
    },
    itemQuantity: {
        fontSize: typography.fontSize.xs,
        color: colors.text.muted,
    },
    abilityItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.sm,
        marginBottom: spacing.xs,
    },
    abilityName: {
        fontSize: typography.fontSize.sm,
        color: colors.text.primary,
        flex: 1,
    },
    abilityType: {
        fontSize: typography.fontSize.xs,
        color: colors.text.muted,
        textTransform: 'capitalize',
    },
});
