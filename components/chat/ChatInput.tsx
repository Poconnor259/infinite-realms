import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, typography } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';

interface ChatInputProps {
    onSend: (text: string) => void;
    disabled?: boolean;
    placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder = 'Type a message...' }: ChatInputProps) {
    const [text, setText] = useState('');
    const { colors } = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const handleSend = () => {
        if (text.trim() && !disabled) {
            onSend(text.trim());
            setText('');
        }
    };

    const quickActions = [
        { label: 'Look around', icon: '👀' },
        { label: 'Talk to...', icon: '💬' },
        { label: 'Attack', icon: '⚔️' },
    ];

    return (
        <View style={styles.container}>
            {/* Quick Actions */}
            <View style={styles.quickActions}>
                {quickActions.map((action, index) => (
                    <TouchableOpacity
                        key={index}
                        style={styles.quickAction}
                        onPress={() => setText(action.label)}
                        disabled={disabled}
                    >
                        <Text style={styles.quickActionIcon}>{action.icon}</Text>
                        <Text style={styles.quickActionLabel}>{action.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Input Row */}
            <View style={styles.inputRow}>
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={text}
                        onChangeText={setText}
                        placeholder={placeholder}
                        placeholderTextColor={colors.text.muted}
                        multiline
                        maxLength={500}
                        editable={!disabled}
                        onSubmitEditing={handleSend}
                        onKeyPress={(e) => {
                            // Web-only: Handle Enter vs Shift+Enter
                            if (Platform.OS === 'web' && (e as any).nativeEvent.key === 'Enter') {
                                if (!(e as any).nativeEvent.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                                // If shiftKey is pressed, allow default behavior (newline)
                            }
                        }}
                    />
                </View>
                <TouchableOpacity
                    style={[
                        styles.sendButton,
                        (!text.trim() || disabled) && styles.sendButtonDisabled,
                    ]}
                    onPress={handleSend}
                    disabled={!text.trim() || disabled}
                >
                    <Ionicons
                        name="send"
                        size={20}
                        color={text.trim() && !disabled ? '#fff' : colors.text.muted}
                    />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        borderTopWidth: 1,
        borderTopColor: colors.border.default,
        backgroundColor: colors.background.secondary,
        paddingBottom: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    },
    quickActions: {
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
        gap: spacing.sm,
    },
    quickAction: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.tertiary,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        gap: spacing.xs,
    },
    quickActionIcon: {
        fontSize: 14,
    },
    quickActionLabel: {
        color: colors.text.muted,
        fontSize: typography.fontSize.xs,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
        gap: spacing.sm,
    },
    inputContainer: {
        flex: 1,
        backgroundColor: colors.background.primary,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    input: {
        color: colors.text.primary,
        fontSize: typography.fontSize.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        maxHeight: 100,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.primary[500],
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: colors.background.tertiary,
    },
});
