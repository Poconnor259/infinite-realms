import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../../lib/theme';

interface ChatInputProps {
    onSend: (text: string) => void;
    disabled?: boolean;
    placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder = 'Type a message...' }: ChatInputProps) {
    const [text, setText] = useState('');

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
                        color={text.trim() && !disabled ? colors.text.primary : colors.text.muted}
                    />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
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
        backgroundColor: colors.background.tertiary,
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
        backgroundColor: colors.primary[600],
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: colors.background.tertiary,
    },
});
