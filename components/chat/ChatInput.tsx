import React, { useState, useMemo, useEffect } from 'react';
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
import { useGameStore } from '../../lib/store';

interface ChatInputProps {
    onSend: (text: string) => void;
    disabled?: boolean;
    placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder = 'Type a message...' }: ChatInputProps) {
    const [text, setText] = useState('');
    const { colors, typography } = useThemeColors();
    const styles = useMemo(() => createStyles(colors, typography), [colors, typography]);

    // Listen for editing state from store
    const { editingMessage, setEditingMessage } = useGameStore();
    const [isEditing, setIsEditing] = useState(false);

    // Pre-populate text when editingMessage is set
    useEffect(() => {
        if (editingMessage) {
            setText(editingMessage);
            setIsEditing(true);
            setEditingMessage(null); // Clear the editing state after consuming
        }
    }, [editingMessage, setEditingMessage]);

    const handleSend = () => {
        if (text.trim() && !disabled) {
            onSend(text.trim());
            setText('');
            setIsEditing(false); // Clear editing mode after sending
        }
    };

    const quickActions = [
        { label: 'Look around', icon: '👀' },
        { label: 'Talk to...', icon: '💬' },
        { label: 'Attack', icon: '⚔️' },
    ];

    return (
        <View style={styles.container}>
            {/* Quick Actions - Floating Chips */}
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

            {/* Editing Indicator */}
            {isEditing && (
                <View style={styles.editingIndicator}>
                    <Ionicons name="pencil" size={14} color={colors.primary[400]} />
                    <Text style={styles.editingText}>Editing message...</Text>
                    <TouchableOpacity onPress={() => { setText(''); setIsEditing(false); }}>
                        <Text style={styles.cancelEditText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Floating Input Pill */}
            <View style={styles.inputWrapper}>
                <View style={[styles.inputContainer, styles.shadow]}>
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

                    <TouchableOpacity
                        style={[
                            styles.sendButton,
                            (!text.trim() || disabled) && styles.sendButtonDisabled
                        ]}
                        onPress={handleSend}
                        disabled={!text.trim() || disabled}
                    >
                        <Ionicons
                            name="arrow-up"
                            size={20}
                            color={(!text.trim() || disabled) ? colors.text.muted : '#fff'}
                        />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const createStyles = (colors: any, typography: any) => StyleSheet.create({
    container: {
        backgroundColor: colors.background.primary, // Seamless background
        paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.md,
        paddingHorizontal: spacing.md,
    },
    quickActions: {
        flexDirection: 'row',
        marginBottom: spacing.sm,
        gap: spacing.sm,
        justifyContent: 'center', // Center chips
    },
    quickAction: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.tertiary,
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: borderRadius.full,
        gap: 6,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    quickActionIcon: {
        fontSize: 12,
    },
    quickActionLabel: {
        color: colors.text.secondary,
        fontSize: 12,
        fontFamily: typography.fontFamily.medium,
    },
    inputWrapper: {
        width: '100%',
        maxWidth: 800, // Limit width on desktop
        alignSelf: 'center',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        backgroundColor: colors.background.secondary,
        borderRadius: 26, // Pill shape
        borderWidth: 1,
        borderColor: colors.border.default,
        paddingLeft: spacing.md,
        paddingRight: 6, // Tight to send button
        paddingVertical: 6,
        minHeight: 52,
    },
    input: {
        flex: 1,
        color: colors.text.primary,
        fontSize: 16,
        fontFamily: typography.fontFamily.regular,
        lineHeight: 24,
        paddingVertical: 8, // Center vertically
        paddingRight: spacing.sm,
        maxHeight: 120,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primary[500],
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 0, // Aligned with input
    },
    sendButtonDisabled: {
        backgroundColor: 'transparent',
    },
    shadow: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    editingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        marginBottom: spacing.sm,
        backgroundColor: colors.primary[500] + '10',
        borderRadius: borderRadius.md,
        alignSelf: 'center',
    },
    editingText: {
        color: colors.primary[400],
        fontSize: 12,
    },
    cancelEditText: {
        color: colors.text.muted,
        fontSize: 12,
        fontWeight: '600',
    },
});
