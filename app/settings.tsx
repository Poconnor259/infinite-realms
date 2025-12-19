import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Switch,
    Alert,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Logo } from '../components/ui/Logo';
import { spacing, borderRadius, typography } from '../lib/theme';
import { useThemeColors } from '../lib/hooks/useTheme';
import { useSettingsStore, useUserStore } from '../lib/store';
import { signOut } from '../lib/firebase';
import { AnimatedPressable, FadeInView } from '../components/ui/Animated';

// Helper types
interface SettingsSectionProps {
    title: string;
    children: React.ReactNode;
}

interface SettingsRowProps {
    label: string;
    sublabel?: string;
    icon?: keyof typeof Ionicons.glyphMap;
    iconColor?: string;
    rightElement?: React.ReactNode;
    onPress?: () => void;
}

export default function SettingsScreen() {
    const router = useRouter();
    const { colors, theme: activeTheme, isDark } = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const {
        hapticFeedback,
        soundEffects,
        narratorVoice,
        alternatingColors,
        themeMode,
        openaiKey,
        anthropicKey,
        googleKey,
        setPreference,
        setApiKey,
    } = useSettingsStore();

    const user = useUserStore((state) => state.user);

    const [showByokSection, setShowByokSection] = useState(false);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [keyInput, setKeyInput] = useState('');

    // Helper components defined inside to access dynamic styles
    const Section = ({ title, children }: SettingsSectionProps) => (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={styles.sectionContent}>
                {children}
            </View>
        </View>
    );

    const Row = ({ label, sublabel, icon, iconColor, rightElement, onPress }: SettingsRowProps) => {
        const content = (
            <>
                {icon && (
                    <View style={[styles.rowIcon, { backgroundColor: (iconColor || colors.primary[400]) + '20' }]}>
                        <Ionicons name={icon} size={20} color={iconColor || colors.primary[400]} />
                    </View>
                )}
                <View style={styles.rowContent}>
                    <Text style={styles.rowLabel}>{label}</Text>
                    {sublabel && <Text style={styles.rowSublabel}>{sublabel}</Text>}
                </View>
                {rightElement}
                {onPress && !rightElement && (
                    <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
                )}
            </>
        );

        if (onPress) {
            return (
                <AnimatedPressable style={styles.row} onPress={onPress}>
                    {content}
                </AnimatedPressable>
            );
        }

        return <View style={styles.row}>{content}</View>;
    };

    const handleThemeToggle = () => {
        const modes: ('system' | 'light' | 'dark')[] = ['system', 'light', 'dark'];
        const currentIndex = modes.indexOf(themeMode);
        const nextMode = modes[(currentIndex + 1) % modes.length];
        setPreference('themeMode', nextMode);
    };

    const getThemeLabel = (mode: 'system' | 'light' | 'dark') => {
        switch (mode) {
            case 'system': return 'System Default';
            case 'light': return 'Light Mode';
            case 'dark': return 'Dark Mode';
        }
    };

    const handleSaveKey = (provider: 'openai' | 'anthropic' | 'google') => {
        if (keyInput.trim()) {
            setApiKey(provider, keyInput.trim());
        }
        setEditingKey(null);
        setKeyInput('');
    };

    const handleRemoveKey = (provider: 'openai' | 'anthropic' | 'google') => {
        if (Platform.OS === 'web') {
            // @ts-ignore
            if (window.confirm(`Are you sure you want to remove your ${provider.toUpperCase()} API key?`)) {
                setApiKey(provider, null);
            }
        } else {
            Alert.alert(
                'Remove API Key',
                `Are you sure you want to remove your ${provider.toUpperCase()} API key?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () => setApiKey(provider, null),
                    },
                ]
            );
        }
    };

    const getKeyStatus = (key: string | null) => {
        if (!key) return null;
        return `••••••${key.slice(-4)}`;
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <Logo size={32} />
            </View>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Account Section */}
                <FadeInView delay={0}>
                    <Section title="Account">
                        {user?.role === 'admin' && (
                            <Row
                                label="Admin Dashboard"
                                sublabel="Manage users and system settings"
                                icon="shield-checkmark-outline"
                                iconColor={colors.status.info}
                                onPress={() => router.push('/admin')}
                            />
                        )}
                        {user?.isAnonymous ? (
                            <Row
                                label="Sign In / Create Account"
                                sublabel="Sync your campaigns across devices"
                                icon="person-circle-outline"
                                iconColor={colors.primary[400]}
                                onPress={() => router.push('/auth/signin')}
                            />
                        ) : (
                            <>
                                <Row
                                    label="Account"
                                    sublabel={user?.email || 'Signed In'}
                                    icon="person-outline"
                                    iconColor={colors.primary[400]}
                                    onPress={() => { }}
                                />
                                <Row
                                    label="Sign Out"
                                    sublabel="Log out of your account"
                                    icon="log-out-outline"
                                    iconColor={colors.status.error}
                                    onPress={async () => {
                                        if (Platform.OS === 'web') {
                                            // @ts-ignore
                                            if (window.confirm('Are you sure you want to sign out?')) {
                                                await signOut();
                                                router.replace('/');
                                            }
                                        } else {
                                            Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                                                { text: 'Cancel', style: 'cancel' },
                                                {
                                                    text: 'Sign Out',
                                                    style: 'destructive',
                                                    onPress: async () => {
                                                        await signOut();
                                                        router.replace('/');
                                                    }
                                                }
                                            ]);
                                        }
                                    }}
                                />
                            </>
                        )}
                        <Row
                            label="Subscription"
                            sublabel="Scout (Free)"
                            icon="star-outline"
                            iconColor={colors.gold.main}
                            onPress={() => {
                                Alert.alert('Coming Soon', 'Subscriptions will be added with RevenueCat integration.');
                            }}
                        />
                    </Section>
                </FadeInView>

                {/* Preferences Section */}
                <FadeInView delay={100}>
                    <Section title="Preferences">
                        <Row
                            label="Appearance"
                            sublabel={getThemeLabel(themeMode)}
                            icon={themeMode === 'light' ? 'sunny-outline' : themeMode === 'dark' ? 'moon-outline' : 'contrast-outline'}
                            iconColor={colors.primary[400]}
                            onPress={handleThemeToggle}
                        />

                        <Row
                            label="Haptic Feedback"
                            sublabel="Vibrate on actions"
                            icon="phone-portrait-outline"
                            iconColor="#10b981"
                            rightElement={
                                <Switch
                                    value={hapticFeedback}
                                    onValueChange={(value) => setPreference('hapticFeedback', value)}
                                    trackColor={{ false: colors.background.tertiary, true: colors.primary[600] }}
                                    thumbColor={hapticFeedback ? colors.primary[300] : colors.text.muted}
                                />
                            }
                        />
                        <Row
                            label="Sound Effects"
                            sublabel="Play audio for game events"
                            icon="volume-medium-outline"
                            iconColor="#3b82f6"
                            rightElement={
                                <Switch
                                    value={soundEffects}
                                    onValueChange={(value) => setPreference('soundEffects', value)}
                                    trackColor={{ false: colors.background.tertiary, true: colors.primary[600] }}
                                    thumbColor={soundEffects ? colors.primary[300] : colors.text.muted}
                                />
                            }
                        />
                        <Row
                            label="Narrator Voice"
                            sublabel="Text-to-speech for story (Beta)"
                            icon="mic-outline"
                            iconColor="#8b5cf6"
                            rightElement={
                                <Switch
                                    value={narratorVoice}
                                    onValueChange={(value) => setPreference('narratorVoice', value)}
                                    trackColor={{ false: colors.background.tertiary, true: colors.primary[600] }}
                                    thumbColor={narratorVoice ? colors.primary[300] : colors.text.muted}
                                />
                            }
                        />
                        <Row
                            label="Alternating Message Colors"
                            sublabel="Use different colors for narrator messages"
                            icon="color-palette-outline"
                            iconColor="#f59e0b"
                            rightElement={
                                <Switch
                                    value={alternatingColors}
                                    onValueChange={(value) => setPreference('alternatingColors', value)}
                                    trackColor={{ false: colors.background.tertiary, true: colors.primary[600] }}
                                    thumbColor={alternatingColors ? colors.primary[300] : colors.text.muted}
                                />
                            }
                        />
                    </Section>
                </FadeInView>

                {/* BYOK Section */}
                <FadeInView delay={200}>
                    <Section title="Bring Your Own Key (BYOK)">
                        <TouchableOpacity
                            style={styles.byokHeader}
                            onPress={() => setShowByokSection(!showByokSection)}
                        >
                            <View style={styles.byokHeaderContent}>
                                <Ionicons
                                    name="key-outline"
                                    size={20}
                                    color={colors.gold.main}
                                />
                                <View style={styles.byokHeaderText}>
                                    <Text style={styles.byokTitle}>Use Your Own API Keys</Text>
                                    <Text style={styles.byokSubtitle}>
                                        For unlimited access with your own billing
                                    </Text>
                                </View>
                            </View>
                            <Ionicons
                                name={showByokSection ? 'chevron-up' : 'chevron-down'}
                                size={20}
                                color={colors.text.muted}
                            />
                        </TouchableOpacity>

                        {showByokSection && (
                            <View style={styles.byokContent}>
                                {/* OpenAI Key */}
                                <View style={styles.keyRow}>
                                    <View style={styles.keyInfo}>
                                        <Text style={styles.keyLabel}>OpenAI</Text>
                                        <Text style={styles.keyStatus}>
                                            {getKeyStatus(openaiKey) || 'Not configured'}
                                        </Text>
                                    </View>
                                    {openaiKey ? (
                                        <TouchableOpacity
                                            style={styles.keyButton}
                                            onPress={() => handleRemoveKey('openai')}
                                        >
                                            <Ionicons name="trash-outline" size={18} color={colors.status.error} />
                                        </TouchableOpacity>
                                    ) : (
                                        <TouchableOpacity
                                            style={styles.keyButton}
                                            onPress={() => {
                                                setEditingKey('openai');
                                                setKeyInput('');
                                            }}
                                        >
                                            <Ionicons name="add" size={18} color={colors.primary[400]} />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* Anthropic Key */}
                                <View style={styles.keyRow}>
                                    <View style={styles.keyInfo}>
                                        <Text style={styles.keyLabel}>Anthropic (Claude)</Text>
                                        <Text style={styles.keyStatus}>
                                            {getKeyStatus(anthropicKey) || 'Not configured'}
                                        </Text>
                                    </View>
                                    {anthropicKey ? (
                                        <TouchableOpacity
                                            style={styles.keyButton}
                                            onPress={() => handleRemoveKey('anthropic')}
                                        >
                                            <Ionicons name="trash-outline" size={18} color={colors.status.error} />
                                        </TouchableOpacity>
                                    ) : (
                                        <TouchableOpacity
                                            style={styles.keyButton}
                                            onPress={() => {
                                                setEditingKey('anthropic');
                                                setKeyInput('');
                                            }}
                                        >
                                            <Ionicons name="add" size={18} color={colors.primary[400]} />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* Google Key */}
                                <View style={styles.keyRow}>
                                    <View style={styles.keyInfo}>
                                        <Text style={styles.keyLabel}>Google (Gemini)</Text>
                                        <Text style={styles.keyStatus}>
                                            {getKeyStatus(googleKey) || 'Not configured'}
                                        </Text>
                                    </View>
                                    {googleKey ? (
                                        <TouchableOpacity
                                            style={styles.keyButton}
                                            onPress={() => handleRemoveKey('google')}
                                        >
                                            <Ionicons name="trash-outline" size={18} color={colors.status.error} />
                                        </TouchableOpacity>
                                    ) : (
                                        <TouchableOpacity
                                            style={styles.keyButton}
                                            onPress={() => {
                                                setEditingKey('google');
                                                setKeyInput('');
                                            }}
                                        >
                                            <Ionicons name="add" size={18} color={colors.primary[400]} />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* Key input modal */}
                                {editingKey && (
                                    <View style={styles.keyInputContainer}>
                                        <Text style={styles.keyInputLabel}>
                                            Enter your {editingKey.toUpperCase()} API Key:
                                        </Text>
                                        <TextInput
                                            style={styles.keyInput}
                                            value={keyInput}
                                            onChangeText={setKeyInput}
                                            placeholder="sk-..."
                                            placeholderTextColor={colors.text.muted}
                                            secureTextEntry
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                        />
                                        <View style={styles.keyInputActions}>
                                            <TouchableOpacity
                                                style={styles.keyInputCancel}
                                                onPress={() => {
                                                    setEditingKey(null);
                                                    setKeyInput('');
                                                }}
                                            >
                                                <Text style={styles.keyInputCancelText}>Cancel</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.keyInputSave}
                                                onPress={() => handleSaveKey(editingKey as any)}
                                            >
                                                <Text style={styles.keyInputSaveText}>Save</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                            </View>
                        )}
                    </Section>
                </FadeInView>

                {/* Data Section */}
                <FadeInView delay={300}>
                    <Section title="Data">
                        <Row
                            label="Export My Data"
                            sublabel="Download all campaigns as JSON"
                            icon="download-outline"
                            iconColor="#10b981"
                            onPress={() => {
                                Alert.alert('Export', 'Your campaign data will be exported as JSON.');
                            }}
                        />
                        <Row
                            label="Clear Cache"
                            sublabel="Free up device storage"
                            icon="trash-outline"
                            iconColor={colors.status.warning}
                            onPress={() => {
                                Alert.alert(
                                    'Clear Cache',
                                    'This will clear cached data. Your saved campaigns will not be affected.',
                                    [
                                        { text: 'Cancel', style: 'cancel' },
                                        { text: 'Clear', style: 'destructive' },
                                    ]
                                );
                            }}
                        />
                    </Section>
                </FadeInView>

                {/* About Section */}
                <FadeInView delay={400}>
                    <Section title="About">
                        <Row
                            label="Version"
                            sublabel="1.0.0 (Build 1)"
                            icon="information-circle-outline"
                            iconColor={colors.text.muted}
                        />
                        <Row
                            label="Terms of Service"
                            icon="document-text-outline"
                            iconColor={colors.text.muted}
                            onPress={() => { }}
                        />
                        <Row
                            label="Privacy Policy"
                            icon="shield-checkmark-outline"
                            iconColor={colors.text.muted}
                            onPress={() => { }}
                        />
                    </Section>
                </FadeInView>
            </ScrollView>
        </SafeAreaView>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    header: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingVertical: spacing.md,
    },
    section: {
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        color: colors.text.muted,
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.sm,
    },
    sectionContent: {
        backgroundColor: colors.background.tertiary,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: colors.border.default,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
    },
    rowIcon: {
        width: 36,
        height: 36,
        borderRadius: borderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    rowContent: {
        flex: 1,
    },
    rowLabel: {
        color: colors.text.primary,
        fontSize: typography.fontSize.md,
        marginBottom: 2,
    },
    rowSublabel: {
        color: colors.text.muted,
        fontSize: typography.fontSize.sm,
    },
    byokHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
    },
    byokHeaderContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    byokHeaderText: {
        marginLeft: spacing.md,
    },
    byokTitle: {
        color: colors.text.primary,
        fontSize: typography.fontSize.md,
        fontWeight: '600',
    },
    byokSubtitle: {
        color: colors.text.muted,
        fontSize: typography.fontSize.sm,
    },
    byokContent: {
        padding: spacing.lg,
        gap: spacing.md,
    },
    keyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.background.secondary,
        padding: spacing.md,
        borderRadius: borderRadius.md,
    },
    keyInfo: {
        flex: 1,
    },
    keyLabel: {
        color: colors.text.primary,
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
    },
    keyStatus: {
        color: colors.text.muted,
        fontSize: typography.fontSize.xs,
        marginTop: 2,
    },
    keyButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.background.tertiary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    keyInputContainer: {
        backgroundColor: colors.background.secondary,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginTop: spacing.md,
    },
    keyInputLabel: {
        color: colors.text.secondary,
        fontSize: typography.fontSize.sm,
        marginBottom: spacing.sm,
    },
    keyInput: {
        backgroundColor: colors.background.primary,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        color: colors.text.primary,
        fontSize: typography.fontSize.md,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    keyInputActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    keyInputCancel: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
    },
    keyInputCancelText: {
        color: colors.text.muted,
        fontSize: typography.fontSize.md,
    },
    keyInputSave: {
        backgroundColor: colors.primary[600],
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
    },
    keyInputSaveText: {
        color: colors.text.primary,
        fontSize: typography.fontSize.md,
        fontWeight: '600',
    },
});
