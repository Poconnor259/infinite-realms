import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { spacing, borderRadius, typography } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';
import { parseCharacterJSON, generateTemplate, downloadAsFile } from '../../lib/characterIO';

interface CharacterImportProps {
    worldType: string;
    onImport: (character: any) => void;
    onClose: () => void;
}

export function CharacterImport({ worldType, onImport, onClose }: CharacterImportProps) {
    const { colors } = useThemeColors();
    const [importedData, setImportedData] = useState<any>(null);
    const [errors, setErrors] = useState<string[]>([]);
    const [preview, setPreview] = useState<string>('');

    const handlePickFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true
            });

            if (result.canceled) return;

            // Read file content
            const file = result.assets[0];
            const response = await fetch(file.uri);
            const text = await response.text();

            // Parse and validate
            const parseResult = parseCharacterJSON(text, worldType);

            if (parseResult.success && parseResult.character) {
                setImportedData(parseResult.character);
                setPreview(JSON.stringify(parseResult.character, null, 2));
                setErrors([]);
            } else {
                setErrors(parseResult.errors || ['Unknown error']);
                setImportedData(null);
                setPreview('');
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to read file: ' + (error as Error).message);
        }
    };

    const handleDownloadTemplate = () => {
        try {
            const template = generateTemplate(worldType);
            const filename = `${worldType}-character-template.json`;

            if (Platform.OS === 'web') {
                downloadAsFile(JSON.parse(template), filename);
            } else {
                // For mobile, show the template in an alert or share
                Alert.alert(
                    'Template',
                    'Copy this template and save it as a .json file:\n\n' + template,
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to generate template');
        }
    };

    const handleApply = () => {
        if (!importedData) {
            Alert.alert('Error', 'No valid character data to import');
            return;
        }

        onImport(importedData);
        onClose();
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
            <View style={[styles.header, { borderBottomColor: colors.border.default }]}>
                <Text style={[styles.title, { color: colors.text.primary }]}>
                    Import Character
                </Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Ionicons name="close" size={24} color={colors.text.secondary} />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                {/* Instructions */}
                <View style={[styles.infoBox, { backgroundColor: colors.primary[900] + '20', borderColor: colors.primary[400] }]}>
                    <Ionicons name="information-circle" size={20} color={colors.primary[400]} />
                    <Text style={[styles.infoText, { color: colors.text.secondary }]}>
                        Upload a JSON file with your character data, or download a template to get started.
                    </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.buttonRow}>
                    <TouchableOpacity
                        style={[styles.button, styles.buttonSecondary, { backgroundColor: colors.background.secondary, borderColor: colors.border.default }]}
                        onPress={handleDownloadTemplate}
                    >
                        <Ionicons name="download" size={20} color={colors.text.primary} />
                        <Text style={[styles.buttonText, { color: colors.text.primary }]}>
                            Download Template
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.button, styles.buttonPrimary, { backgroundColor: colors.primary[500] }]}
                        onPress={handlePickFile}
                    >
                        <Ionicons name="cloud-upload" size={20} color="#fff" />
                        <Text style={[styles.buttonText, { color: '#fff' }]}>
                            Upload JSON
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Errors */}
                {errors.length > 0 && (
                    <View style={[styles.errorBox, { backgroundColor: colors.hp.low + '20', borderColor: colors.hp.low }]}>
                        <Ionicons name="warning" size={20} color={colors.hp.low} />
                        <View style={styles.errorList}>
                            {errors.map((error, index) => (
                                <Text key={index} style={[styles.errorText, { color: colors.hp.low }]}>
                                    • {error}
                                </Text>
                            ))}
                        </View>
                    </View>
                )}

                {/* Preview */}
                {preview && (
                    <View style={styles.previewSection}>
                        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
                            Preview
                        </Text>
                        <View style={[styles.previewBox, { backgroundColor: colors.background.secondary, borderColor: colors.border.default }]}>
                            <ScrollView style={styles.previewScroll} nestedScrollEnabled>
                                <Text style={[styles.previewText, { color: colors.text.secondary }]}>
                                    {preview}
                                </Text>
                            </ScrollView>
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* Apply Button */}
            {importedData && (
                <View style={[styles.footer, { borderTopColor: colors.border.default }]}>
                    <TouchableOpacity
                        style={[styles.applyButton, { backgroundColor: colors.status.success }]}
                        onPress={handleApply}
                    >
                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        <Text style={styles.applyButtonText}>Apply Character Data</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
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
        flex: 1,
        padding: spacing.lg,
    },
    infoBox: {
        flexDirection: 'row',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    infoText: {
        flex: 1,
        fontSize: typography.fontSize.sm,
        lineHeight: 20,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    button: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        gap: spacing.sm,
    },
    buttonSecondary: {
        borderWidth: 1,
    },
    buttonPrimary: {},
    buttonText: {
        fontSize: typography.fontSize.md,
        fontWeight: '600',
    },
    errorBox: {
        flexDirection: 'row',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    errorList: {
        flex: 1,
    },
    errorText: {
        fontSize: typography.fontSize.sm,
        marginBottom: spacing.xs,
    },
    previewSection: {
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        fontSize: typography.fontSize.md,
        fontWeight: 'bold',
        marginBottom: spacing.sm,
    },
    previewBox: {
        borderWidth: 1,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        maxHeight: 300,
    },
    previewScroll: {
        maxHeight: 280,
    },
    previewText: {
        fontSize: typography.fontSize.xs,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    footer: {
        padding: spacing.lg,
        borderTopWidth: 1,
    },
    applyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        gap: spacing.sm,
    },
    applyButtonText: {
        color: '#fff',
        fontSize: typography.fontSize.md,
        fontWeight: 'bold',
    },
});
