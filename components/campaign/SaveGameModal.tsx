import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, typography } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';
import { saveCampaignStateFn } from '../../lib/firebase';
import { generateShareCode, copyShareCodeToClipboard } from '../../lib/shareCode';
import { exportCampaignSave, downloadAsFile } from '../../lib/characterIO';
import type { Campaign, Message } from '../../lib/types';

interface SaveGameModalProps {
    visible: boolean;
    campaign: Campaign;
    messages: Message[];
    campaignLedger?: string;
    onClose: () => void;
    onSaved?: () => void;
}

type SaveMode = 'quick' | 'new' | 'export' | 'share';

export function SaveGameModal({ visible, campaign, messages, campaignLedger, onClose, onSaved }: SaveGameModalProps) {
    const { colors } = useThemeColors();
    const [mode, setMode] = useState<SaveMode | null>(null);
    const [saveName, setSaveName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [shareCode, setShareCode] = useState<string | null>(null);

    const handleQuickSave = async () => {
        setIsSaving(true);
        try {
            await saveCampaignStateFn(campaign.id, 'Quick Save');
            Alert.alert('Success', 'Game saved successfully!');
            onSaved?.();
            onClose();
        } catch (error: any) {
            console.error('[SaveGameModal] Quick save error:', error);
            Alert.alert('Error', error.message || 'Failed to save game');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveAsNew = async () => {
        if (!saveName.trim()) {
            Alert.alert('Error', 'Please enter a name for this save');
            return;
        }

        setIsSaving(true);
        try {
            await saveCampaignStateFn(campaign.id, saveName.trim());
            Alert.alert('Success', 'Game saved successfully!');
            setSaveName('');
            setMode(null);
            onSaved?.();
            onClose();
        } catch (error: any) {
            console.error('[SaveGameModal] Save error:', error);
            Alert.alert('Error', error.message || 'Failed to save game');
        } finally {
            setIsSaving(false);
        }
    };

    const handleExportToFile = () => {
        try {
            const saveData = exportCampaignSave(
                campaign,
                messages,
                `${campaign.name} - ${new Date().toLocaleDateString()}`,
                campaignLedger
            );

            const filename = `${campaign.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`;
            downloadAsFile(saveData, filename);

            Alert.alert('Success', 'Campaign exported successfully!');
            onClose();
        } catch (error: any) {
            console.error('[SaveGameModal] Export error:', error);
            Alert.alert('Error', error.message || 'Failed to export campaign');
        }
    };

    const handleGenerateShareCode = async () => {
        setIsSaving(true);
        try {
            const saveData = exportCampaignSave(
                campaign,
                messages,
                campaign.name,
                campaignLedger
            );

            const result = generateShareCode(saveData, 'save');

            if (result.success && result.code) {
                setShareCode(result.code);
                await copyShareCodeToClipboard(result.code);
                Alert.alert('Success', 'Share code copied to clipboard!');
            } else {
                Alert.alert('Error', result.error || 'Failed to generate share code');
            }
        } catch (error: any) {
            console.error('[SaveGameModal] Share code error:', error);
            Alert.alert('Error', error.message || 'Failed to generate share code');
        } finally {
            setIsSaving(false);
        }
    };

    const renderMainMenu = () => (
        <View style={styles.content}>
            <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>
                Save & Export Options
            </Text>

            {/* Quick Save */}
            <TouchableOpacity
                style={[styles.optionButton, { backgroundColor: colors.background.secondary }]}
                onPress={handleQuickSave}
                disabled={isSaving}
            >
                <Ionicons name="flash" size={24} color={colors.primary[500]} />
                <View style={styles.optionText}>
                    <Text style={[styles.optionTitle, { color: colors.text.primary }]}>
                        Quick Save
                    </Text>
                    <Text style={[styles.optionDescription, { color: colors.text.muted }]}>
                        Overwrites current save
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
            </TouchableOpacity>

            {/* Save As New */}
            <TouchableOpacity
                style={[styles.optionButton, { backgroundColor: colors.background.secondary }]}
                onPress={() => setMode('new')}
                disabled={isSaving}
            >
                <Ionicons name="create" size={24} color={colors.primary[500]} />
                <View style={styles.optionText}>
                    <Text style={[styles.optionTitle, { color: colors.text.primary }]}>
                        Save As New
                    </Text>
                    <Text style={[styles.optionDescription, { color: colors.text.muted }]}>
                        Create a new save slot
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
            </TouchableOpacity>

            {/* Export to File */}
            <TouchableOpacity
                style={[styles.optionButton, { backgroundColor: colors.background.secondary }]}
                onPress={handleExportToFile}
                disabled={isSaving}
            >
                <Ionicons name="download" size={24} color={colors.primary[500]} />
                <View style={styles.optionText}>
                    <Text style={[styles.optionTitle, { color: colors.text.primary }]}>
                        Export to File
                    </Text>
                    <Text style={[styles.optionDescription, { color: colors.text.muted }]}>
                        Download JSON to device
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
            </TouchableOpacity>

            {/* Copy Share Code */}
            <TouchableOpacity
                style={[styles.optionButton, { backgroundColor: colors.background.secondary }]}
                onPress={handleGenerateShareCode}
                disabled={isSaving}
            >
                <Ionicons name="link" size={24} color={colors.primary[500]} />
                <View style={styles.optionText}>
                    <Text style={[styles.optionTitle, { color: colors.text.primary }]}>
                        Copy Share Code
                    </Text>
                    <Text style={[styles.optionDescription, { color: colors.text.muted }]}>
                        Generate shareable code
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
            </TouchableOpacity>

            {shareCode && (
                <View style={[styles.shareCodeBox, { backgroundColor: colors.background.tertiary, borderColor: colors.border.default }]}>
                    <Text style={[styles.shareCodeLabel, { color: colors.text.muted }]}>
                        Share Code:
                    </Text>
                    <Text style={[styles.shareCodeText, { color: colors.text.primary }]} selectable>
                        {shareCode}
                    </Text>
                </View>
            )}

            <Text style={[styles.hint, { color: colors.text.muted }]}>
                You can have up to 10 saves per campaign
            </Text>
        </View>
    );

    const renderSaveAsNew = () => (
        <View style={styles.content}>
            <TouchableOpacity
                style={styles.backButton}
                onPress={() => setMode(null)}
            >
                <Ionicons name="arrow-back" size={20} color={colors.primary[500]} />
                <Text style={[styles.backText, { color: colors.primary[500] }]}>
                    Back
                </Text>
            </TouchableOpacity>

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

            <View style={styles.buttons}>
                <TouchableOpacity
                    style={[styles.button, { backgroundColor: colors.background.secondary }]}
                    onPress={() => setMode(null)}
                    disabled={isSaving}
                >
                    <Text style={[styles.buttonText, { color: colors.text.primary }]}>
                        Cancel
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, { backgroundColor: colors.primary[500] }]}
                    onPress={handleSaveAsNew}
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
    );

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
                            💾 Save & Export
                        </Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={colors.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView>
                        {mode === 'new' ? renderSaveAsNew() : renderMainMenu()}
                    </ScrollView>
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
        maxWidth: 450,
        maxHeight: '80%',
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
    sectionTitle: {
        fontSize: typography.fontSize.md,
        fontWeight: '600',
        marginBottom: spacing.md,
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.sm,
    },
    optionText: {
        flex: 1,
        marginLeft: spacing.md,
    },
    optionTitle: {
        fontSize: typography.fontSize.md,
        fontWeight: '600',
        marginBottom: 2,
    },
    optionDescription: {
        fontSize: typography.fontSize.sm,
    },
    shareCodeBox: {
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        marginTop: spacing.md,
    },
    shareCodeLabel: {
        fontSize: typography.fontSize.sm,
        marginBottom: spacing.xs,
    },
    shareCodeText: {
        fontSize: typography.fontSize.sm,
        fontFamily: 'monospace',
    },
    hint: {
        fontSize: typography.fontSize.sm,
        marginTop: spacing.md,
        textAlign: 'center',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    backText: {
        fontSize: typography.fontSize.md,
        marginLeft: spacing.xs,
        fontWeight: '600',
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
        marginBottom: spacing.md,
    },
    buttons: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.md,
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
    buttonText: {
        fontSize: typography.fontSize.md,
        fontWeight: '600',
    },
});
