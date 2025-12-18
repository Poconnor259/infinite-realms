import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../lib/theme';
import { useSettingsStore } from '../../lib/store';
import type { Message } from '../../lib/types';

interface MessageBubbleProps {
    message: Message;
    index: number;
}

export function MessageBubble({ message, index }: MessageBubbleProps) {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';
    const isBlueBox = message.content.includes('『') || message.content.includes('[DAILY QUEST]');
    const alternatingColors = useSettingsStore((state) => state.alternatingColors);

    const getBubbleStyle = () => {
        if (isUser) return styles.userBubble;
        if (isSystem) return styles.systemBubble;
        if (isBlueBox) return styles.blueBoxBubble;
        // Alternate narrator bubble colors only if setting is enabled
        if (alternatingColors) {
            return index % 2 === 0 ? styles.narratorBubble : styles.narratorBubbleAlt;
        }
        return styles.narratorBubble;
    };

    const getTextStyle = () => {
        if (isUser) return styles.userText;
        if (isSystem) return styles.systemText;
        if (isBlueBox) return styles.blueBoxText;
        // Use slightly different text color for alternating bubbles only if setting is enabled
        if (alternatingColors) {
            return index % 2 === 0 ? styles.narratorText : styles.narratorTextAlt;
        }
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
                        {message.role === 'narrator' ? '📜 Narrator' : '🎭 Character'}
                    </Text>
                </View>
            )}
            <View style={[styles.bubble, getBubbleStyle()]}>
                {formatContent(message.content)}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: spacing.md,
        marginBottom: spacing.md,
    },
    userContainer: {
        alignItems: 'flex-end',
    },
    roleIndicator: {
        marginBottom: spacing.xs,
    },
    roleText: {
        color: colors.text.muted,
        fontSize: typography.fontSize.xs,
    },
    bubble: {
        maxWidth: '85%',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
    },
    userBubble: {
        backgroundColor: colors.primary[600],
        borderBottomRightRadius: borderRadius.sm,
    },
    narratorBubble: {
        backgroundColor: colors.background.tertiary,
        borderBottomLeftRadius: borderRadius.sm,
    },
    systemBubble: {
        backgroundColor: colors.status.info + '20',
        borderWidth: 1,
        borderColor: colors.status.info + '40',
    },
    blueBoxBubble: {
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.3)',
    },
    userText: {
        color: colors.text.primary,
        fontSize: typography.fontSize.md,
        lineHeight: typography.fontSize.md * typography.lineHeight.relaxed,
    },
    narratorText: {
        color: colors.text.secondary,
        fontSize: typography.fontSize.md,
        lineHeight: typography.fontSize.md * typography.lineHeight.relaxed,
    },
    narratorBubbleAlt: {
        backgroundColor: colors.background.secondary,
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
        color: '#3b82f6',
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
        color: '#3b82f6',
        fontSize: typography.fontSize.sm,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
});
