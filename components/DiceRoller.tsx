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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../lib/hooks/useTheme';
import { useSettingsStore } from '../lib/store';
import { AnimatedPressable } from './ui/Animated';
import { playDiceRoll, playSuccess, playError } from '../lib/sounds';
import { mediumHaptic, successHaptic, errorHaptic } from '../lib/haptics';
import { spacing, borderRadius, typography } from '../lib/theme';
import { DiceBox3D } from './DiceBox3D';

interface PendingRoll {
    type: string;           // "d20", "2d6", etc.
    purpose: string;        // "Attack Roll", "Saving Throw", etc.
    modifier?: number;      // +5, -2, etc.
    stat?: string;          // "Strength", "Dexterity" (for display)
    difficulty?: number;    // DC/Target number (optional)
}

interface DiceRollerProps {
    pendingRoll: PendingRoll;
    onRollComplete: (result: { roll: number; total: number; success?: boolean }) => void;
}

export function DiceRoller({ pendingRoll, onRollComplete }: DiceRollerProps) {
    const { colors } = useThemeColors();
    const diceRollMode = useSettingsStore((state) => state.diceRollMode);

    const [isRolling, setIsRolling] = useState(false);
    const [result, setResult] = useState<number | null>(null);
    const [physicalInput, setPhysicalInput] = useState('');
    const [showResult, setShowResult] = useState(false);
    const [rolling3D, setRolling3D] = useState(false);

    const rollAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const displayNumber = useRef(new Animated.Value(1)).current;

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

    // Handle 3D roll complete
    const handle3DRollComplete = (rollResult: { roll: number; total: number }) => {
        setResult(rollResult.roll);
        setIsRolling(false);
        setRolling3D(false);
        setShowResult(true);

        const isSuccess = pendingRoll.difficulty ? rollResult.total >= pendingRoll.difficulty : undefined;
        if (isSuccess) {
            playSuccess();
            successHaptic();
        } else if (pendingRoll.difficulty) {
            playError();
            errorHaptic();
        }

        if (onRollComplete) {
            onRollComplete({
                roll: rollResult.roll,
                total: rollResult.total,
                success: isSuccess
            });
        }
    };

    const start3DRoll = () => {
        if (isRolling || showResult) return;
        setIsRolling(true);
        setRolling3D(true);
        playDiceRoll();
        mediumHaptic();
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
        // New styles for 3D mode
        digitalContainer: {
            width: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 150, // Ensure enough space for 3D dice
        },
        rollContainer: {
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            flex: 1,
        },
        rollCircle: {
            width: 120,
            height: 120,
            borderRadius: 60,
            borderWidth: 2,
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.xs,
        },
        tapToRoll: {
            fontSize: typography.fontSize.sm,
            fontWeight: '600',
        },
        resultText: {
            fontSize: 64,
            fontWeight: '800',
        },
        totalContainer: {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
            borderRadius: borderRadius.sm,
            marginTop: spacing.sm,
        },
        totalText: {
            fontSize: typography.fontSize.xl,
            fontWeight: '700',
        },
        successBadge: {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
            borderRadius: borderRadius.sm,
            marginTop: spacing.sm,
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
            {diceRollMode === '3d' && Platform.OS === 'web' ? (
                <View style={styles.digitalContainer}>
                    {showResult ? (
                        <View style={styles.resultContainer}>
                            <Text style={[styles.resultText, { color: colors.text.primary }]}>
                                {result}
                            </Text>
                            {modifier !== 0 && (
                                <Text style={[styles.modifierText, { color: colors.text.muted }]}>
                                    {modifier > 0 ? '+' : ''}{modifier}
                                </Text>
                            )}
                            <View style={[styles.totalContainer, { backgroundColor: colors.background.tertiary }]}>
                                <Text style={[styles.totalText, { color: colors.primary[400] }]}>
                                    Total: {result! + modifier}
                                </Text>
                            </View>
                            {pendingRoll.difficulty !== undefined && (
                                <View style={[
                                    styles.successBadge,
                                    { backgroundColor: (result! + modifier >= pendingRoll.difficulty) ? colors.status.success + '20' : colors.status.error + '20' }
                                ]}>
                                    <Text style={[
                                        styles.successText,
                                        { color: (result! + modifier >= pendingRoll.difficulty) ? colors.status.success : colors.status.error }
                                    ]}>
                                        {(result! + modifier >= pendingRoll.difficulty) ? 'SUCCESS' : 'FAILURE'}
                                    </Text>
                                </View>
                            )}
                        </View>
                    ) : (
                        <View style={styles.rollContainer}>
                            {rolling3D ? (
                                <DiceBox3D
                                    notation={pendingRoll.type}
                                    modifier={modifier}
                                    onRollComplete={handle3DRollComplete}
                                />
                            ) : (
                                <AnimatedPressable
                                    onPress={start3DRoll}
                                    style={[styles.rollCircle, { borderColor: colors.primary[400] }]}
                                >
                                    <Ionicons name="cube-outline" size={40} color={colors.primary[400]} />
                                    <Text style={[styles.tapToRoll, { color: colors.text.muted }]}>Tap to Roll</Text>
                                </AnimatedPressable>
                            )}
                        </View>
                    )}
                </View>
            ) : diceRollMode === 'physical' && !showResult && (
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
