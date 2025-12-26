import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, typography } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';
import { saveCampaignStateFn } from '../../lib/firebase';

interface SaveGameModalProps {
    visible: boolean;
    campaignId: string;
    onClose: () => void;
    onSaved?: () => void;
}

export function SaveGameModal({ visible, campaignId, onClose, onSaved }: SaveGameModalProps) {
    const { colors } = useThemeColors();
    const [saveName, setSaveName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!saveName.trim()) {
            Alert.alert('Error', 'Please enter a name for this save');
            return;
        }

        setIsSaving(true);
        try {
            await saveCampaignStateFn(campaignId, saveName.trim());
            Alert.alert('Success', 'Game saved successfully!');
            setSaveName('');
            onSaved?.();
            onClose();
        } catch (error: any) {
            console.error('[SaveGameModal] Error:', error);
            Alert.alert('Error', error.message || 'Failed to save game');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={[styles.modal, { backgroundColor: colors.background.primary }]}>
                    <View style={[styles.header, { borderBottomColor: colors.border.default }]}>
                        <Text style={[styles.title, { color: colors.text.primary }]}>
                            Save Game
                        </Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={colors.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.content}>
                        <Text style={[styles.label, { color: colors.text.secondary }]}>
                            Save Name
                        </Text>
                        <TextInput
                            style={[styles.input, {
                                backgroundColor: colors.background.secondary,
                                borderColor: colors.border.default,
                                color: colors.text.primary
                            }]}
                            value={saveName}
                            onChangeText={setSaveName}
                            placeholder="Enter save name..."
                            placeholderTextColor={colors.text.muted}
                            autoFocus
                            editable={!isSaving}
                        />

                        <Text style={[styles.hint, { color: colors.text.muted }]}>
                            You can have up to 10 saves per campaign
                        </Text>
                    </View>

                    <View style={styles.buttons}>
                        <TouchableOpacity
                            style={[styles.button, styles.cancelButton, { backgroundColor: colors.background.secondary }]}
                            onPress={onClose}
                            disabled={isSaving}
                        >
                            <Text style={[styles.buttonText, { color: colors.text.primary }]}>
                                Cancel
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.button, styles.saveButton, { backgroundColor: colors.primary[500] }]}
                            onPress={handleSave}
                            disabled={isSaving || !saveName.trim()}
                        >
                            {isSaving ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <>
                                    <Ionicons name="save" size={18} color="#fff" />
                                    <Text style={[styles.buttonText, { color: '#fff' }]}>
                                        Save
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    modal: {
        width: '100%',
        maxWidth: 400,
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
        borderBottomWidth: 1,
    },
    title: {
        fontSize: typography.fontSize.xl,
        fontWeight: 'bold',
    },
    closeButton: {
        padding: spacing.xs,
    },
    content: {
        padding: spacing.lg,
    },
    label: {
        fontSize: typography.fontSize.md,
        fontWeight: '600',
        marginBottom: spacing.sm,
    },
    input: {
        borderWidth: 1,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        fontSize: typography.fontSize.md,
        marginBottom: spacing.sm,
    },
    hint: {
        fontSize: typography.fontSize.sm,
    },
    buttons: {
        flexDirection: 'row',
        gap: spacing.md,
        padding: spacing.lg,
    },
    button: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        gap: spacing.xs,
    },
    cancelButton: {},
    saveButton: {},
    buttonText: {
        fontSize: typography.fontSize.md,
        fontWeight: '600',
    },
});
