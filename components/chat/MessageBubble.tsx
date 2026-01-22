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
    const isNarrator = message.role === 'narrator';
    const [debugExpanded, setDebugExpanded] = useState(false);
    const user = useUserStore((state) => state.user);

    // Ensure content is always a string to prevent React error #31
    const content = typeof message.content === 'string' ? message.content : String(message.content ?? '');

    // Use metadata for Blue Box detection (preferred), fallback to string matching for backward compatibility
    const isBlueBox = message.metadata?.alertType === 'blueBox' ||
        ((content.includes('[') && content.includes(']')) &&
            (content.includes('[DAILY QUEST]') ||
                content.includes('[ABILITY') ||
                content.includes('[WARNING') ||
                content.includes('[SYSTEM') ||
                content.includes('[RANK UP') ||
                content.includes('[LOOT') ||
                content.includes('[PROGRESS')));


    const { colors, typography, isDark } = useThemeColors();
    const styles = useMemo(() => createStyles(colors, typography), [colors, typography]);

    // Game store for edit/retry
    const { deleteLastUserMessageAndResponse, retryLastRequest, lastFailedRequest } = useGameStore();

    // Check if this is an error message that can be retried
    const isError = isSystem && content.startsWith('*Error:');
    const canRetry = isError && lastFailedRequest !== null;

    const handleEdit = () => {
        deleteLastUserMessageAndResponse();
        // The store will set editingMessage which ChatInput listens to
    };

    const handleRetry = () => {
        retryLastRequest();
    };

    // TTS state
    const [isSpeaking, setIsSpeaking] = useState(false);
    const narratorVoice = useSettingsStore((state) => state.narratorVoice);

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
        // Narrator messages now have no bubble background
        return styles.narratorBubble;
    };

    const getTextStyle = () => {
        if (isUser) return styles.userText;
        if (isSystem) return styles.systemText;
        if (isBlueBox) return styles.blueBoxText;
        return styles.narratorText;
    };
    // Parse markdown-like formatting
    const formatContent = (text: string) => {
        // Handle code blocks first
        const codeBlockRegex = /```([\s\S]*?)```/g;
        const parts = text.split(codeBlockRegex);

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

    const formatInlineContent = (text: string, key: number) => {
        // Parse inline formatting for bold and italic
        const parseInlineStyles = (line: string, lineKey: number) => {
            const parts: React.ReactNode[] = [];
            let currentIndex = 0;

            // Regex to match **bold** or *italic* patterns
            const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
            let match;

            while ((match = regex.exec(line)) !== null) {
                // Add text before this match
                if (match.index > currentIndex) {
                    parts.push(line.substring(currentIndex, match.index));
                }

                if (match[2]) {
                    // Bold text (**text**)
                    parts.push(
                        <Text key={`${lineKey}-bold-${match.index}`} style={{ fontWeight: 'bold' }}>
                            {match[2]}
                        </Text>
                    );
                } else if (match[3]) {
                    // Italic text (*text*)
                    parts.push(
                        <Text key={`${lineKey}-italic-${match.index}`} style={{ fontStyle: 'italic' }}>
                            {match[3]}
                        </Text>
                    );
                }

                currentIndex = regex.lastIndex;
            }

            // Add remaining text after last match
            if (currentIndex < line.length) {
                parts.push(line.substring(currentIndex));
            }

            return parts.length > 0 ? parts : [line];
        };

        const lines = text.split('\n');
        return (
            <Text key={key} style={getTextStyle()}>
                {lines.map((line, i) => (
                    <Text key={i}>
                        {parseInlineStyles(line, i)}
                        {i < lines.length - 1 ? '\n' : ''}
                    </Text>
                ))}
            </Text>
        );
    }; return (
        <View style={[
            styles.container,
            isUser && styles.userContainer,
            !isUser && styles.narratorContainer,
        ]}>
            {/* Minimal Role Indicator for Narrator (integrated with text or sidebar) */}
            {!isUser && !isSystem && (
                <View style={styles.narratorHeader}>
                    {/* <Text style={styles.narratorName}>
                        {message.metadata?.voiceModel ? 
                            (AVAILABLE_MODELS.find(m => m.id === message.metadata?.voiceModel)?.name || message.metadata?.voiceModel) 
                            : 'Narrator'}
                    </Text> */}
                    {/* Optional: Add timestamp or turn cost here if needed, but keeping it clean for now */}
                </View>
            )}

            {isUser || isSystem || isBlueBox ? (
                /* Bubble style for User & System */
                <View style={[styles.bubble, getBubbleStyle()]}>
                    {formatContent(content)}

                    {/* usage flag for User messages if we want to show cost there? usually narrator costs */}
                </View>
            ) : (
                /* Document style for Narrator (No Bubble) */
                <View style={styles.narratorContent}>
                    {formatContent(content)}

                    {/* Pending Roll Prompt for Narrator Messages */}
                    {isNarrator && index === 0 && useGameStore.getState().pendingRoll && (
                        <View style={styles.rollPromptContainer}>
                            <TouchableOpacity
                                style={styles.rollPromptButton}
                                onPress={() => {
                                    // Logic to open/focus dice area
                                    // For now, we'll assume the user sees the sidebar if they click this
                                    // or we can trigger a focus event
                                    const store = useGameStore.getState();
                                    if (store.pendingRoll) {
                                        // Just a visual cue for now, the UI should already show it
                                        // but we reinforce visibility
                                        console.log('[MessageBubble] User clicked Roll Dice prompt');
                                    }
                                }}
                            >
                                <Ionicons name="dice" size={20} color="#000" />
                                <Text style={styles.rollPromptText}>
                                    A {useGameStore.getState().pendingRoll?.type} roll is required to continue.
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            )}

            {/* Edit/Retry/Speaker Buttons Logic */}
            <View style={styles.messageActions}>
                {isUser && isLastUserMessage && (
                    <TouchableOpacity onPress={handleEdit} style={styles.iconAction}>
                        <Ionicons name="pencil" size={14} color={colors.text.muted} />
                    </TouchableOpacity>
                )}

                {canRetry && (
                    <TouchableOpacity onPress={handleRetry} style={styles.iconAction}>
                        <Ionicons name="refresh" size={14} color={colors.status.error} />
                    </TouchableOpacity>
                )}

                {isNarrator && (
                    <TouchableOpacity onPress={handleSpeak} style={styles.iconAction}>
                        <Ionicons
                            name={isSpeaking ? 'stop' : 'volume-high'}
                            size={14}
                            color={isSpeaking ? colors.primary[400] : colors.text.muted}
                        />
                    </TouchableOpacity>
                )}
            </View>

            {/* Debug Panel ... */}
            {/* ... (Debug panel code remains same, just ensuring it renders) */}
            {!isUser && !isSystem && message.metadata?.debug && user?.role === 'admin' && (
                <View style={[styles.debugPanel, { backgroundColor: colors.background.tertiary, borderColor: colors.border.default }]}>
                    {/* ... (omitted for brevity, keep existing logic) ... */}
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
                            Debug
                        </Text>
                    </TouchableOpacity>
                    {debugExpanded && (
                        <View style={styles.debugContent}>
                            <Text style={[styles.debugJson, { color: colors.text.muted }]}>
                                {JSON.stringify(message.metadata.debug, null, 2)}
                            </Text>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
}

const createStyles = (colors: any, typography: any) => StyleSheet.create({
    container: {
        marginBottom: spacing.lg, // increased spacing between messages
        paddingHorizontal: 0,
    },
    userContainer: {
        alignItems: 'flex-end',
        paddingHorizontal: spacing.md,
    },
    narratorContainer: {
        alignItems: 'flex-start',
        paddingHorizontal: spacing.md,
        borderLeftWidth: 2,
        borderLeftColor: colors.primary[400] + '40', // Subtle accent line
        marginLeft: spacing.sm,
    },
    narratorHeader: {
        marginBottom: spacing.xs,
        flexDirection: 'row',
        alignItems: 'center',
    },
    narratorName: {
        fontSize: 12,
        fontFamily: typography.fontFamily.bold,
        color: colors.primary[400],
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    narratorContent: {
        width: '100%',
    },
    bubble: {
        maxWidth: '85%',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
    },
    userBubble: {
        backgroundColor: colors.background.tertiary, // Softer than primary color
        borderBottomRightRadius: borderRadius.xs,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    narratorBubble: {
        // No background for narrator
        backgroundColor: 'transparent',
        padding: 0,
    },
    systemBubble: {
        backgroundColor: colors.status.info + '10',
        borderWidth: 1,
        borderColor: colors.status.info + '20',
        width: '100%',
        maxWidth: '100%',
        alignItems: 'center',
    },
    blueBoxBubble: {
        backgroundColor: colors.chat.blueBox + '10',
        borderWidth: 1,
        borderColor: colors.chat.blueBox + '30',
        width: '100%',
        maxWidth: '100%',
    },
    userText: {
        color: colors.text.primary,
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.fontSize.md,
        lineHeight: typography.fontSize.md * 1.5,
    },
    narratorText: {
        color: colors.text.secondary, // Slightly softer than pure white
        fontSize: typography.fontSize.lg, // Slightly larger for reading (18 base, scales with setting)
        lineHeight: typography.fontSize.lg * 1.6, // Relaxed line height for storytelling
        fontFamily: typography.fontFamily.regular,
    },
    systemText: {
        color: colors.status.info,
        fontFamily: typography.fontFamily.medium,
        fontSize: 13,
        textAlign: 'center',
    },
    blueBoxText: {
        color: colors.text.primary,
        fontFamily: typography.fontFamily.regular, // Use selected font, not monospace
        fontSize: typography.fontSize.sm, // Scale with reading settings
    },
    codeBlock: {
        backgroundColor: colors.background.tertiary,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginVertical: spacing.sm,
    },
    codeText: {
        color: colors.text.secondary,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: typography.fontSize.xs, // Scale with reading settings
    },
    messageActions: {
        flexDirection: 'row',
        marginTop: 4,
        gap: 12,
        opacity: 0.7,
    },
    iconAction: {
        padding: 4,
    },
    // Debug styles simplified
    debugPanel: { marginTop: 8, padding: 8, borderRadius: 4, borderWidth: 1, opacity: 0.8 },
    debugHeader: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    debugTitle: { fontSize: 10, fontFamily: typography.fontFamily.bold, textTransform: 'uppercase' },
    debugContent: { marginTop: 4 },
    debugJson: { fontSize: 9, fontFamily: 'monospace' },
    rollPromptContainer: {
        marginTop: spacing.md,
        alignItems: 'flex-start',
    },
    rollPromptButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary[400],
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        gap: spacing.sm,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    rollPromptText: {
        color: '#000',
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.bold,
    },
});
