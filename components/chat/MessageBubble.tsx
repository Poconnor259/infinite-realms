import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, typography } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';
import { useSettingsStore, useUserStore, useGameStore } from '../../lib/store';
import type { Message } from '../../lib/types';
import { AVAILABLE_MODELS } from '../../lib/types';
import { GlassCard } from '../ui/GlassCard';
import { speakText, stopSpeaking, isTTSSpeaking } from '../../lib/tts';

interface MessageBubbleProps {
    message: Message;
    index: number;
    isLastUserMessage?: boolean;
}

export function MessageBubble({ message, index, isLastUserMessage = false }: MessageBubbleProps) {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';
    const [debugExpanded, setDebugExpanded] = useState(false);
    const user = useUserStore((state) => state.user);

    // Ensure content is always a string to prevent React error #31
    const content = typeof message.content === 'string' ? message.content : String(message.content ?? '');

    const isBlueBox = content.includes('『') || content.includes('[DAILY QUEST]');
    const alternatingColors = useSettingsStore((state) => state.alternatingColors);

    const { colors, isDark } = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    // Game store for edit/retry
    const { deleteLastUserMessageAndResponse, retryLastRequest, lastFailedRequest } = useGameStore();

    // Check if this is an error message that can be retried
    const isError = isSystem && content.startsWith('*Error:');
    const canRetry = isError && lastFailedRequest !== null;

    const handleEdit = () => {
        const deletedText = deleteLastUserMessageAndResponse();
        // The store will set editingMessage which ChatInput listens to
    };

    const handleRetry = () => {
        retryLastRequest();
    };

    // TTS state
    const [isSpeaking, setIsSpeaking] = useState(false);
    const narratorVoice = useSettingsStore((state) => state.narratorVoice);
    const isNarrator = message.role === 'narrator';

    const handleSpeak = async () => {
        if (isSpeaking) {
            stopSpeaking();
            setIsSpeaking(false);
        } else {
            setIsSpeaking(true);
            try {
                await speakText(content, {
                    onEnd: () => setIsSpeaking(false),
                    onError: () => setIsSpeaking(false),
                });
            } catch {
                setIsSpeaking(false);
            }
        }
    };

    // Auto-speak new narrator messages if setting is enabled
    useEffect(() => {
        if (isNarrator && narratorVoice && index === 0) {
            // Only auto-speak the most recent narrator message (when first rendered)
            // This is a simplified check - we'd need more logic for truly "new" messages
        }
    }, [isNarrator, narratorVoice, index]);

    const getBubbleStyle = () => {
        if (isUser) return styles.userBubble;
        if (isSystem) return styles.systemBubble;
        if (isBlueBox) return styles.blueBoxBubble;
        return styles.narratorBubble;
    };

    const getTextStyle = () => {
        if (isUser) return styles.userText;
        if (isSystem) return styles.systemText;
        if (isBlueBox) return styles.blueBoxText;
        return styles.narratorText;
    };

    // Parse markdown-like formatting
    const formatContent = (content: string) => {
        // Handle code blocks first
        const codeBlockRegex = /```([\s\S]*?)```/g;
        const parts = content.split(codeBlockRegex);

        return parts.map((part, i) => {
            if (i % 2 === 1) {
                // This is a code block
                return (
                    <View key={i} style={styles.codeBlock}>
                        <Text style={styles.codeText}>{part.trim()}</Text>
                    </View>
                );
            }

            // Handle inline formatting
            return formatInlineContent(part, i);
        });
    };

    const formatInlineContent = (content: string, key: number) => {
        // Simple parsing for bold and italic
        const lines = content.split('\n');
        return (
            <Text key={key} style={getTextStyle()}>
                {lines.map((line, i) => (
                    <Text key={i}>
                        {line.replace(/\*\*(.*?)\*\*/g, '«$1»').replace(/\*(.*?)\*/g, '‹$1›')}
                        {i < lines.length - 1 ? '\n' : ''}
                    </Text>
                ))}
            </Text>
        );
    };

    return (
        <View style={[
            styles.container,
            isUser && styles.userContainer,
        ]}>
            {!isUser && !isSystem && (
                <View style={styles.roleIndicator}>
                    <Text style={styles.roleText}>
                        {message.role === 'narrator'
                            ? `📜 Narrator${message.metadata?.voiceModel ? ` - ${AVAILABLE_MODELS.find(m => m.id === message.metadata.voiceModel)?.name || message.metadata.voiceModel}` : ''}`
                            : '🎭 Character'}
                    </Text>
                    {message.role === 'narrator' && message.metadata?.turnCost !== undefined && (
                        <View style={styles.usageFlag}>
                            <Ionicons name="flash-outline" size={10} color={colors.text.muted} />
                            <Text style={styles.usageFlagText}>
                                {message.metadata.turnCost} turns
                            </Text>
                        </View>
                    )}
                </View>
            )}
            <GlassCard
                variant={isBlueBox ? 'strong' : isUser ? 'medium' : 'light'}
                style={[styles.bubble, getBubbleStyle()]}
            >
                {formatContent(content)}

                {/* Edit button for last user message */}
                {isUser && isLastUserMessage && (
                    <TouchableOpacity
                        style={styles.editButton}
                        onPress={handleEdit}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="pencil" size={14} color={colors.text.inverse} />
                        <Text style={styles.editButtonText}>Edit</Text>
                    </TouchableOpacity>
                )}

                {/* Retry button for error messages */}
                {canRetry && (
                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={handleRetry}
                    >
                        <Ionicons name="refresh" size={16} color={colors.status.error} />
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                )}

                {/* Speaker button for narrator TTS */}
                {isNarrator && (
                    <TouchableOpacity
                        style={styles.speakerButton}
                        onPress={handleSpeak}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons
                            name={isSpeaking ? 'stop-circle' : 'volume-high'}
                            size={18}
                            color={isSpeaking ? colors.status.error : colors.text.muted}
                        />
                    </TouchableOpacity>
                )}
            </GlassCard>

            {/* Debug Panel for Admin Users */}
            {!isUser && !isSystem && message.metadata?.debug && user?.role === 'admin' && (
                <View style={[styles.debugPanel, { backgroundColor: colors.background.tertiary, borderColor: colors.border.default }]}>
                    <TouchableOpacity
                        style={styles.debugHeader}
                        onPress={() => setDebugExpanded(!debugExpanded)}
                    >
                        <Ionicons
                            name={debugExpanded ? 'chevron-down' : 'chevron-forward'}
                            size={16}
                            color={colors.text.muted}
                        />
                        <Text style={[styles.debugTitle, { color: colors.text.muted }]}>
                            🔍 AI Debug Data
                        </Text>
                    </TouchableOpacity>

                    {debugExpanded && (
                        <View style={styles.debugContent}>
                            {message.metadata.debug.brainResponse && (
                                <View style={styles.debugSection}>
                                    <Text style={[styles.debugSectionTitle, { color: colors.text.secondary }]}>
                                        Brain AI Response:
                                    </Text>
                                    <Text style={[styles.debugJson, { color: colors.text.muted, backgroundColor: colors.background.primary }]}>
                                        {JSON.stringify(message.metadata.debug.brainResponse, null, 2)}
                                    </Text>
                                </View>
                            )}

                            {message.metadata.debug.stateReport && (
                                <View style={styles.debugSection}>
                                    <Text style={[styles.debugSectionTitle, { color: colors.text.secondary }]}>
                                        Voice AI State Report:
                                    </Text>
                                    <Text style={[styles.debugJson, { color: colors.text.muted, backgroundColor: colors.background.primary }]}>
                                        {JSON.stringify(message.metadata.debug.stateReport, null, 2)}
                                    </Text>
                                </View>
                            )}

                            {message.metadata.debug.reviewerResult && (
                                <View style={styles.debugSection}>
                                    <Text style={[styles.debugSectionTitle, { color: colors.text.secondary }]}>
                                        State Reviewer Result:
                                    </Text>
                                    <Text style={[styles.debugJson, { color: colors.text.muted, backgroundColor: colors.background.primary }]}>
                                        {JSON.stringify(message.metadata.debug.reviewerResult, null, 2)}
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}
                </View>
            )}
        </View>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        paddingHorizontal: spacing.md,
        marginBottom: spacing.md,
    },
    userContainer: {
        alignItems: 'flex-end',
    },
    roleIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    roleText: {
        color: colors.text.muted,
        fontSize: typography.fontSize.xs,
    },
    usageFlag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
        backgroundColor: colors.background.tertiary,
        borderRadius: 4,
        marginLeft: spacing.sm,
    },
    usageFlagText: {
        color: colors.text.muted,
        fontSize: 10,
        fontWeight: '500',
    },
    bubble: {
        maxWidth: '85%',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
    },
    userBubble: {
        backgroundColor: colors.chat.user,
        borderBottomRightRadius: borderRadius.sm,
    },
    narratorBubble: {
        backgroundColor: colors.chat.narrator,
        borderBottomLeftRadius: borderRadius.sm,
    },
    systemBubble: {
        backgroundColor: colors.chat.system + '20', // Add transparency if hex
        borderWidth: 1,
        borderColor: colors.chat.system + '40',
    },
    blueBoxBubble: {
        backgroundColor: colors.chat.blueBox + '20',
        borderWidth: 1,
        borderColor: colors.chat.blueBox + '50',
    },
    userText: {
        color: colors.text.inverse, // User bubble is usually dark/colored, so inverse text
        fontSize: typography.fontSize.md,
        lineHeight: typography.fontSize.md * typography.lineHeight.relaxed,
    },
    narratorText: {
        color: colors.text.secondary,
        fontSize: typography.fontSize.md,
        lineHeight: typography.fontSize.md * typography.lineHeight.relaxed,
    },
    narratorBubbleAlt: {
        backgroundColor: colors.background.tertiary, // Use tertiary for alternation
        borderBottomLeftRadius: borderRadius.sm,
    },
    narratorTextAlt: {
        color: colors.text.primary,
        fontSize: typography.fontSize.md,
        lineHeight: typography.fontSize.md * typography.lineHeight.relaxed,
    },
    systemText: {
        color: colors.status.info,
        fontSize: typography.fontSize.sm,
        fontStyle: 'italic',
    },
    blueBoxText: {
        color: colors.status.info,
        fontSize: typography.fontSize.md,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    codeBlock: {
        backgroundColor: colors.background.primary,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginVertical: spacing.sm,
    },
    codeText: {
        color: colors.status.info,
        fontSize: typography.fontSize.sm,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    debugPanel: {
        marginTop: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        overflow: 'hidden',
    },
    debugHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.sm,
        gap: spacing.xs,
    },
    debugTitle: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    debugContent: {
        padding: spacing.sm,
        gap: spacing.md,
    },
    debugSection: {
        gap: spacing.xs,
    },
    debugSectionTitle: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    debugJson: {
        fontSize: typography.fontSize.xs,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        padding: spacing.sm,
        borderRadius: borderRadius.sm,
    },
    editButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: spacing.sm,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: borderRadius.sm,
        alignSelf: 'flex-end',
    },
    editButtonText: {
        color: colors.text.inverse,
        fontSize: typography.fontSize.xs,
        fontWeight: '500',
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginTop: spacing.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.status.error + '20',
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.status.error + '40',
        alignSelf: 'flex-start',
    },
    retryButtonText: {
        color: colors.status.error,
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    speakerButton: {
        position: 'absolute',
        top: spacing.sm,
        right: spacing.sm,
        padding: spacing.xs,
        borderRadius: borderRadius.full,
        backgroundColor: colors.background.primary + '60',
    },
});
