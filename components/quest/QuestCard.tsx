import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../../lib/theme';
import type { Quest } from '../../lib/types';
import {
    canAcceptQuest,
    getChainProgress,
    isQuestExpired,
    getQuestTimeRemaining,
    formatTimeRemaining,
    isFirstInChain,
    isLastInChain
} from '../../lib/questUtils';

interface QuestCardProps {
    quest: Quest;
    allQuests: Quest[];
    completedQuestIds: string[];
    onAccept?: () => void;
    onDecline?: () => void;
}

export function QuestCard({ quest, allQuests, completedQuestIds, onAccept, onDecline }: QuestCardProps) {
    const isAvailable = canAcceptQuest(quest, completedQuestIds);
    const isExpired = isQuestExpired(quest, Date.now());
    const timeRemaining = getQuestTimeRemaining(quest, Date.now());
    const isChainQuest = !!quest.chainId;
    const chainProgress = isChainQuest ? getChainProgress(quest.chainId!, allQuests) : null;

    // Determine card state
    const isLocked = !isAvailable;
    const canInteract = isAvailable && !isExpired;

    return (
        <View style={[styles.card, isLocked && styles.cardLocked, isExpired && styles.cardExpired]}>
            {/* Header with title and chain indicator */}
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    {isLocked && (
                        <Ionicons name="lock-closed" size={16} color={colors.text.muted} style={styles.lockIcon} />
                    )}
                    <Text style={[styles.title, isLocked && styles.titleLocked]}>
                        {quest.name || quest.title}
                    </Text>
                </View>

                {/* Chain indicator */}
                {isChainQuest && chainProgress && (
                    <View style={styles.chainBadge}>
                        <Ionicons name="link" size={12} color={colors.primary[400]} />
                        <Text style={styles.chainText}>
                            {chainProgress.completed}/{chainProgress.total}
                        </Text>
                    </View>
                )}
            </View>

            {/* Description */}
            <Text style={[styles.description, isLocked && styles.descriptionLocked]} numberOfLines={3}>
                {quest.description}
            </Text>

            {/* Quest metadata */}
            <View style={styles.metadata}>
                {/* Difficulty badge */}
                <View style={[styles.badge, styles.difficultyBadge]}>
                    <Text style={styles.badgeText}>{quest.type}</Text>
                </View>

                {/* Rewards */}
                {quest.rewards && (
                    <View style={styles.rewards}>
                        {quest.rewards.experience && (
                            <View style={styles.rewardItem}>
                                <Ionicons name="star" size={12} color={colors.warning[400]} />
                                <Text style={styles.rewardText}>{quest.rewards.experience} XP</Text>
                            </View>
                        )}
                        {quest.rewards.gold && (
                            <View style={styles.rewardItem}>
                                <Ionicons name="cash" size={12} color={colors.warning[500]} />
                                <Text style={styles.rewardText}>{quest.rewards.gold}g</Text>
                            </View>
                        )}
                    </View>
                )}
            </View>

            {/* Time remaining for timed quests */}
            {timeRemaining !== null && !isExpired && (
                <View style={styles.timerRow}>
                    <Ionicons name="time-outline" size={14} color={colors.error[400]} />
                    <Text style={styles.timerText}>
                        Expires in {formatTimeRemaining(timeRemaining)}
                    </Text>
                </View>
            )}

            {/* Expired indicator */}
            {isExpired && (
                <View style={styles.expiredRow}>
                    <Ionicons name="close-circle" size={14} color={colors.error[500]} />
                    <Text style={styles.expiredText}>Quest Expired</Text>
                </View>
            )}

            {/* Locked message */}
            {isLocked && !isExpired && (
                <View style={styles.lockedRow}>
                    <Ionicons name="information-circle" size={14} color={colors.text.muted} />
                    <Text style={styles.lockedText}>
                        Complete prerequisite quest to unlock
                    </Text>
                </View>
            )}

            {/* Chain position indicators */}
            {isChainQuest && (
                <View style={styles.chainInfo}>
                    {isFirstInChain(quest) && (
                        <Text style={styles.chainInfoText}>⭐ Start of chain</Text>
                    )}
                    {isLastInChain(quest, allQuests) && (
                        <Text style={styles.chainInfoText}>🏁 Final quest</Text>
                    )}
                </View>
            )}

            {/* Action buttons */}
            {canInteract && (
                <View style={styles.actions}>
                    {onAccept && (
                        <Pressable
                            style={({ pressed }) => [
                                styles.button,
                                styles.acceptButton,
                                pressed && styles.buttonPressed
                            ]}
                            onPress={onAccept}
                        >
                            <Text style={styles.acceptButtonText}>Accept Quest</Text>
                        </Pressable>
                    )}
                    {onDecline && (
                        <Pressable
                            style={({ pressed }) => [
                                styles.button,
                                styles.declineButton,
                                pressed && styles.buttonPressed
                            ]}
                            onPress={onDecline}
                        >
                            <Text style={styles.declineButtonText}>Decline</Text>
                        </Pressable>
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    cardLocked: {
        opacity: 0.6,
        borderColor: colors.border.muted,
    },
    cardExpired: {
        opacity: 0.5,
        borderColor: colors.error[700],
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.sm,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    lockIcon: {
        marginRight: spacing.xs,
    },
    title: {
        fontSize: typography.fontSize.lg,
        fontWeight: 'bold',
        color: colors.text.primary,
        flex: 1,
    },
    titleLocked: {
        color: colors.text.muted,
    },
    chainBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary[900],
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.sm,
        gap: spacing.xs,
    },
    chainText: {
        fontSize: typography.fontSize.xs,
        color: colors.primary[400],
        fontWeight: '600',
    },
    description: {
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
        marginBottom: spacing.md,
        lineHeight: 20,
    },
    descriptionLocked: {
        color: colors.text.muted,
    },
    metadata: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    badge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.sm,
    },
    difficultyBadge: {
        backgroundColor: colors.primary[800],
    },
    badgeText: {
        fontSize: typography.fontSize.xs,
        color: colors.primary[300],
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    rewards: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    rewardItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    rewardText: {
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
        fontWeight: '500',
    },
    timerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border.muted,
    },
    timerText: {
        fontSize: typography.fontSize.sm,
        color: colors.error[400],
        fontWeight: '500',
    },
    expiredRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border.muted,
    },
    expiredText: {
        fontSize: typography.fontSize.sm,
        color: colors.error[500],
        fontWeight: '600',
    },
    lockedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border.muted,
    },
    lockedText: {
        fontSize: typography.fontSize.sm,
        color: colors.text.muted,
        fontStyle: 'italic',
    },
    chainInfo: {
        marginTop: spacing.xs,
        marginBottom: spacing.sm,
    },
    chainInfoText: {
        fontSize: typography.fontSize.xs,
        color: colors.text.muted,
        fontStyle: 'italic',
    },
    actions: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    button: {
        flex: 1,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    acceptButton: {
        backgroundColor: colors.primary[600],
    },
    declineButton: {
        backgroundColor: colors.background.tertiary,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    buttonPressed: {
        opacity: 0.7,
    },
    acceptButtonText: {
        fontSize: typography.fontSize.md,
        fontWeight: '600',
        color: colors.text.primary,
    },
    declineButtonText: {
        fontSize: typography.fontSize.md,
        fontWeight: '600',
        color: colors.text.secondary,
    },
});
