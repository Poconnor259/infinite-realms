import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { spacing, borderRadius, typography } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';
import { useSettingsStore } from '../../lib/store';
import type { Message } from '../../lib/types';

interface MessageBubbleProps {
    message: Message;
    index: number;
}

export function MessageBubble({ message, index }: MessageBubbleProps) {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';

    // Ensure content is always a string to prevent React error #31
    const content = typeof message.content === 'string' ? message.content : String(message.content ?? '');

    const isBlueBox = content.includes('『') || content.includes('[DAILY QUEST]');
    const alternatingColors = useSettingsStore((state) => state.alternatingColors);

    const { colors, isDark } = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

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
                {formatContent(content)}
            </View>
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
});
