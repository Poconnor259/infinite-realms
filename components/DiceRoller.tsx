/**
 * DiceRoller Component
 * 
 * Interactive dice rolling UI that supports:
 * - Digital mode: Animated dice roll with tap to roll
 * - Physical mode: Number input for real dice results
 */

import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    Animated,
    Easing,
    Platform,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../lib/hooks/useTheme';
import { useSettingsStore } from '../lib/store';
import { AnimatedPressable } from './ui/Animated';
import { playDiceRoll, playSuccess, playError } from '../lib/sounds';
import { mediumHaptic, successHaptic, errorHaptic } from '../lib/haptics';
import { spacing, borderRadius, typography } from '../lib/theme';

interface PendingRoll {
    type: string;           // "d20", "2d6", etc.
    purpose: string;        // "Attack Roll", "Saving Throw", etc.
    modifier?: number;      // +5, -2, etc.
    stat?: string;          // "Strength", "Dexterity" (for display)
    difficulty?: number;    // DC/Target number (optional)
}

interface RollHistoryEntry {
    type: string;
    purpose: string;
    roll: number;
    total: number;
    modifier?: number;
    difficulty?: number;
    success?: boolean;
    mode: 'auto' | 'digital' | 'physical';
    timestamp: number;
}

interface DiceRollerProps {
    pendingRoll?: PendingRoll | null;
    rollHistory?: RollHistoryEntry[];
    onRollComplete: (result: { roll: number; total: number; success?: boolean }) => void;
}

export function DiceRoller({ pendingRoll, rollHistory = [], onRollComplete }: DiceRollerProps) {
    const { colors } = useThemeColors();
    const diceRollMode = useSettingsStore((state) => state.diceRollMode);

    const [isRolling, setIsRolling] = useState(false);
    const [result, setResult] = useState<number | null>(null);
    const [physicalInput, setPhysicalInput] = useState('');
    const [showResult, setShowResult] = useState(false);

    const rollAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const displayNumber = useRef(new Animated.Value(1)).current;

    // If no pending roll, show history
    if (!pendingRoll) {
        return <RollHistory history={rollHistory} colors={colors} />;
    }

    // Parse dice type (e.g., "d20" -> 20, "2d6" -> 6)
    const parseDiceType = (type: string): { count: number; sides: number } => {
        const match = type.match(/(\d*)d(\d+)/i);
        if (!match) return { count: 1, sides: 20 };
        return {
            count: parseInt(match[1]) || 1,
            sides: parseInt(match[2])
        };
    };

    const { count, sides } = parseDiceType(pendingRoll.type);
    const modifier = pendingRoll.modifier || 0;

    // Roll the dice (digital mode)
    const rollDice = () => {
        if (isRolling || showResult) return;

        setIsRolling(true);
        playDiceRoll();
        mediumHaptic();

        // Animate dice rolling
        Animated.sequence([
            Animated.timing(scaleAnim, {
                toValue: 1.2,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
            }),
        ]).start();

        // Simulate rolling animation with changing numbers
        let rollCount = 0;
        const maxRolls = 15;
        const rollInterval = setInterval(() => {
            let tempRoll = 0;
            for (let i = 0; i < count; i++) {
                tempRoll += Math.floor(Math.random() * sides) + 1;
            }
            setResult(tempRoll);
            rollCount++;

            if (rollCount >= maxRolls) {
                clearInterval(rollInterval);

                // Final result
                let finalRoll = 0;
                for (let i = 0; i < count; i++) {
                    finalRoll += Math.floor(Math.random() * sides) + 1;
                }
                setResult(finalRoll);
                setIsRolling(false);
                setShowResult(true);

                const total = finalRoll + modifier;
                const success = pendingRoll.difficulty ? total >= pendingRoll.difficulty : undefined;

                // Play success/fail sound
                if (success === true) {
                    playSuccess();
                    successHaptic();
                } else if (success === false) {
                    playError();
                    errorHaptic();
                } else {
                    successHaptic();
                }

                // Auto-continue after showing result
                setTimeout(() => {
                    const finalTotal = finalRoll + modifier;
                    const isSuccess = pendingRoll.difficulty ? finalTotal >= pendingRoll.difficulty : undefined;
                    if (onRollComplete) {
                        onRollComplete({
                            roll: finalRoll,
                            total: finalTotal,
                            success: isSuccess
                        });
                    }
                }, 1500);
            }
        }, 80);
    };



    // Submit physical dice result
    const submitPhysicalResult = () => {
        const rollValue = parseInt(physicalInput);
        if (isNaN(rollValue) || rollValue < count || rollValue > count * sides) {
            playError();
            errorHaptic();
            return;
        }

        setResult(rollValue);
        setShowResult(true);
        playDiceRoll();
        mediumHaptic();

        const total = rollValue + modifier;
        const success = pendingRoll.difficulty ? total >= pendingRoll.difficulty : undefined;

        if (success === true) {
            playSuccess();
            successHaptic();
        } else if (success === false) {
            playError();
            errorHaptic();
        }

        setTimeout(() => {
            onRollComplete({ roll: rollValue, total, success });
        }, 1500);
    };

    const total = result !== null ? result + modifier : null;
    const success = total !== null && pendingRoll.difficulty ? total >= pendingRoll.difficulty : undefined;

    const styles = StyleSheet.create({
        container: {
            backgroundColor: colors.background.secondary,
            borderRadius: borderRadius.lg,
            padding: spacing.lg,
            marginVertical: spacing.md,
            borderWidth: 1,
            borderColor: colors.primary[600] + '40',
            alignItems: 'center',
        },
        purpose: {
            fontSize: typography.fontSize.lg,
            fontWeight: '700',
            color: colors.primary[400],
            marginBottom: spacing.sm,
            textAlign: 'center',
        },
        diceType: {
            fontSize: typography.fontSize.xxxl,
            fontWeight: '800',
            color: colors.text.primary,
            marginBottom: spacing.xs,
        },
        modifierText: {
            fontSize: typography.fontSize.md,
            color: colors.text.secondary,
            marginBottom: spacing.md,
        },
        rollButton: {
            backgroundColor: colors.primary[600],
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.md,
            borderRadius: borderRadius.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
        },
        rollButtonText: {
            color: '#fff',
            fontSize: typography.fontSize.lg,
            fontWeight: '700',
        },
        resultContainer: {
            alignItems: 'center',
        },
        resultNumber: {
            fontSize: 64,
            fontWeight: '800',
            color: colors.text.primary,
        },
        resultTotal: {
            fontSize: typography.fontSize.xl,
            color: colors.text.secondary,
            marginTop: spacing.xs,
        },
        successText: {
            fontSize: typography.fontSize.lg,
            fontWeight: '700',
            marginTop: spacing.sm,
            color: '#22c55e',
        },
        failText: {
            fontSize: typography.fontSize.lg,
            fontWeight: '700',
            marginTop: spacing.sm,
            color: '#ef4444',
        },
        physicalContainer: {
            alignItems: 'center',
            width: '100%',
        },
        physicalLabel: {
            fontSize: typography.fontSize.md,
            color: colors.text.secondary,
            marginBottom: spacing.sm,
        },
        physicalInputRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
        },
        physicalInput: {
            backgroundColor: colors.background.tertiary,
            borderRadius: borderRadius.md,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            fontSize: typography.fontSize.xxl,
            fontWeight: '700',
            color: colors.text.primary,
            textAlign: 'center',
            minWidth: 80,
            borderWidth: 2,
            borderColor: colors.primary[600],
        },
        confirmButton: {
            backgroundColor: colors.primary[600],
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderRadius: borderRadius.md,
        },
        confirmButtonText: {
            color: '#fff',
            fontSize: typography.fontSize.md,
            fontWeight: '700',
        },
        difficultyText: {
            fontSize: typography.fontSize.sm,
            color: colors.text.muted,
            marginTop: spacing.xs,
        },

    });

    return (
        <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
            {/* Purpose */}
            <Text style={styles.purpose}>
                {pendingRoll.purpose}
            </Text>

            {/* Dice Type */}
            <Text style={styles.diceType}>
                🎲 {pendingRoll.type.toUpperCase()}
            </Text>

            {/* Modifier */}
            {modifier !== 0 && (
                <Text style={styles.modifierText}>
                    Modifier: {modifier >= 0 ? '+' : ''}{modifier}
                    {pendingRoll.stat ? ` (${pendingRoll.stat})` : ''}
                </Text>
            )}

            {/* Difficulty */}
            {pendingRoll.difficulty && !showResult && (
                <Text style={styles.difficultyText}>
                    Target: DC {pendingRoll.difficulty}
                </Text>
            )}

            {/* Digital Mode - Roll Button */}
            {diceRollMode === 'digital' && !showResult && (
                <AnimatedPressable
                    onPress={rollDice}
                    style={styles.rollButton}
                    disabled={isRolling}
                    sound
                >
                    <Ionicons name="dice" size={24} color="#fff" />
                    <Text style={styles.rollButtonText}>
                        {isRolling ? 'Rolling...' : 'Roll Dice'}
                    </Text>
                </AnimatedPressable>
            )}

            {/* Content based on mode */}
            {diceRollMode === 'physical' && !showResult && (
                <View style={styles.physicalContainer}>
                    <Text style={styles.physicalLabel}>
                        Roll your {pendingRoll.type} and enter the result:
                    </Text>
                    <View style={styles.physicalInputRow}>
                        <TextInput
                            style={styles.physicalInput}
                            value={physicalInput}
                            onChangeText={setPhysicalInput}
                            keyboardType="number-pad"
                            placeholder={`1-${count * sides}`}
                            placeholderTextColor={colors.text.muted}
                            maxLength={3}
                        />
                        {modifier !== 0 && (
                            <Text style={{ color: colors.text.secondary, fontSize: typography.fontSize.xl }}>
                                {modifier >= 0 ? '+' : ''}{modifier}
                            </Text>
                        )}
                        <AnimatedPressable
                            onPress={submitPhysicalResult}
                            style={styles.confirmButton}
                            sound
                        >
                            <Text style={styles.confirmButtonText}>Confirm</Text>
                        </AnimatedPressable>
                    </View>
                </View>
            )}

            {/* Rolling Animation Display */}
            {isRolling && result !== null && (
                <View style={styles.resultContainer}>
                    <Text style={[styles.resultNumber, { opacity: 0.6 }]}>
                        {result}
                    </Text>
                </View>
            )}

            {/* Final Result */}
            {showResult && result !== null && (
                <View style={styles.resultContainer}>
                    <Text style={styles.resultNumber}>
                        {result}
                    </Text>
                    {modifier !== 0 && (
                        <Text style={styles.resultTotal}>
                            {result} {modifier >= 0 ? '+' : ''} {modifier} = {total}
                        </Text>
                    )}
                    {success === true && (
                        <Text style={styles.successText}>
                            ✅ SUCCESS!{pendingRoll.difficulty ? ` (vs DC ${pendingRoll.difficulty})` : ''}
                        </Text>
                    )}
                    {success === false && (
                        <Text style={styles.failText}>
                            ❌ FAILED{pendingRoll.difficulty ? ` (vs DC ${pendingRoll.difficulty})` : ''}
                        </Text>
                    )}
                </View>
            )}
        </Animated.View>
    );
}

// ==================== ROLL HISTORY COMPONENT ====================

interface RollHistoryProps {
    history: RollHistoryEntry[];
    colors: any;
}

function RollHistory({ history, colors }: RollHistoryProps) {
    const getModeIcon = (mode: string) => {
        switch (mode) {
            case 'auto': return '⚡';
            case 'digital': return '🎲';
            case 'physical': return '🎯';
            default: return '🎲';
        }
    };

    const getModeLabel = (mode: string) => {
        switch (mode) {
            case 'auto': return 'Auto';
            case 'digital': return 'Digital';
            case 'physical': return 'Physical';
            default: return mode;
        }
    };

    if (history.length === 0) {
        return (
            <View style={historyStyles.emptyContainer}>
                <Text style={[historyStyles.emptyText, { color: colors.text.muted }]}>
                    No rolls yet. Make your first roll!
                </Text>
            </View>
        );
    }

    return (
        <View style={historyStyles.container}>
            <Text style={[historyStyles.title, { color: colors.text.primary }]}>
                🎲 Roll History
            </Text>
            <ScrollView style={historyStyles.scrollView} showsVerticalScrollIndicator={false}>
                {history.map((entry, index) => (
                    <View
                        key={`${entry.timestamp}-${index}`}
                        style={[
                            historyStyles.historyItem,
                            { backgroundColor: colors.background.tertiary, borderColor: colors.border.default }
                        ]}
                    >
                        <View style={historyStyles.itemHeader}>
                            <Text style={[historyStyles.purpose, { color: colors.text.secondary }]}>
                                {entry.purpose}
                            </Text>
                            <View style={historyStyles.modeTag}>
                                <Text style={[historyStyles.modeIcon, { color: colors.text.muted }]}>
                                    {getModeIcon(entry.mode)}
                                </Text>
                                <Text style={[historyStyles.modeText, { color: colors.text.muted }]}>
                                    {getModeLabel(entry.mode)}
                                </Text>
                            </View>
                        </View>
                        <View style={historyStyles.itemBody}>
                            <Text style={[historyStyles.diceType, { color: colors.text.primary }]}>
                                {entry.type.toUpperCase()}
                            </Text>
                            <View style={{ flex: 1 }}>
                                <Text style={[historyStyles.result, { color: colors.primary[400] }]}>
                                    {entry.roll}{entry.modifier !== undefined && entry.modifier !== 0 ? ` ${entry.modifier >= 0 ? '+' : ''}${entry.modifier}` : ''} = {entry.total}
                                </Text>
                                {entry.difficulty !== undefined && (
                                    <Text style={[historyStyles.difficultyText, { color: colors.text.muted }]}>
                                        vs DC {entry.difficulty}
                                    </Text>
                                )}
                            </View>
                            {entry.success !== undefined && (
                                <View style={[
                                    historyStyles.successBadge,
                                    { backgroundColor: entry.success ? colors.status.success + '20' : colors.status.error + '20' }
                                ]}>
                                    <Text style={[
                                        historyStyles.successText,
                                        { color: entry.success ? colors.status.success : colors.status.error }
                                    ]}>
                                        {entry.success ? '✓' : '✗'}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

const historyStyles = StyleSheet.create({
    container: {
        padding: spacing.md,
    },
    title: {
        fontSize: typography.fontSize.lg,
        fontWeight: '700',
        marginBottom: spacing.sm,
        textAlign: 'center',
    },
    scrollView: {
        maxHeight: 300,
    },
    historyItem: {
        borderRadius: borderRadius.md,
        padding: spacing.sm,
        marginBottom: spacing.xs,
        borderWidth: 1,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    purpose: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
        flex: 1,
    },
    modeTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
        borderRadius: borderRadius.xs,
    },
    modeIcon: {
        fontSize: 12,
    },
    modeText: {
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    itemBody: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    diceType: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    result: {
        fontSize: typography.fontSize.md,
        fontWeight: '700',
    },
    difficultyText: {
        fontSize: typography.fontSize.xs,
        marginTop: 2,
    },
    successBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    successText: {
        fontSize: typography.fontSize.sm,
        fontWeight: '700',
    },
    emptyContainer: {
        padding: spacing.lg,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: typography.fontSize.sm,
        fontStyle: 'italic',
    },
});
