import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    Alert,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { type User } from 'firebase/auth';
import { spacing, borderRadius, typography } from '../lib/theme';
import { useThemeColors } from '../lib/hooks/useTheme';
import { useUserStore } from '../lib/store';
import { hasPasswordProvider, addPasswordToAccount, resetPassword } from '../lib/firebase';
import { AnimatedPressable, FadeInView } from '../components/ui/Animated';

export default function AccountScreen() {
    const router = useRouter();
    const { colors } = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const user = useUserStore((state) => state.user);

    const [email, setEmail] = useState(user?.email || '');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const hasPassword = useMemo(() => hasPasswordProvider(user as User | null), [user]);

    // Get provider names for display
    const providers = useMemo(() => {
        if (!user) return [];
        const firebaseUser = user as unknown as User;
        if (!firebaseUser.providerData) return [];
        return firebaseUser.providerData.map((provider: any, index: number) => {
            switch (provider.providerId) {
                case 'google.com':
                    return 'Google';
                case 'password':
                    return 'Email/Password';
                default:
                    return provider.providerId;
            }
        });
    }, [user]);

    const handleAddPassword = async () => {
        if (!email.trim() || !password.trim()) {
            Alert.alert('Required', 'Please enter your email and password');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Password Mismatch', 'Passwords do not match');
            return;
        }

        if (password.length < 6) {
            Alert.alert('Weak Password', 'Password should be at least 6 characters');
            return;
        }

        setIsLoading(true);
        const result = await addPasswordToAccount(email.trim(), password);
        setIsLoading(false);

        if (result.error) {
            Alert.alert('Failed to Add Password', result.error);
        } else {
            Alert.alert(
                'Success',
                'Password added successfully! You can now sign in with either Google or email/password.',
                [{ text: 'OK', onPress: () => router.back() }]
            );
        }
    };

    const handleResetPassword = async () => {
        if (!email.trim()) {
            Alert.alert('Email Required', 'Please enter your email address');
            return;
        }

        const result = await resetPassword(email.trim());
        if (result.success) {
            Alert.alert('Email Sent', 'Check your email for password reset instructions');
        } else {
            Alert.alert('Error', result.error || 'Failed to send password reset email');
        }
    };

    if (!user) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.emptyState}>
                    <Ionicons name="person-circle-outline" size={64} color={colors.text.muted} />
                    <Text style={styles.emptyText}>Please sign in to view your account</Text>
                    <AnimatedPressable
                        style={styles.button}
                        onPress={() => router.push('/auth/signin')}
                    >
                        <Text style={styles.buttonText}>Sign In</Text>
                    </AnimatedPressable>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <FadeInView style={styles.header} delay={0}>
                    <View style={styles.profileIcon}>
                        <Ionicons name="person" size={40} color={colors.primary[400]} />
                    </View>
                    <Text style={styles.displayName}>{user.displayName || 'User'}</Text>
                    <Text style={styles.email}>{user.email}</Text>
                </FadeInView>

                {/* Account Information */}
                <FadeInView delay={100}>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Account Information</Text>
                        <View style={styles.card}>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Email</Text>
                                <Text style={styles.infoValue}>{user.email || 'Not set'}</Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Authentication Methods</Text>
                                <View style={styles.providersContainer}>
                                    {providers.map((provider, index) => (
                                        <View key={index} style={styles.providerBadge}>
                                            <Text style={styles.providerText}>{provider}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                            {(user as unknown as User).metadata?.creationTime && (
                                <>
                                    <View style={styles.divider} />
                                    <View style={styles.infoRow}>
                                        <Text style={styles.infoLabel}>Member Since</Text>
                                        <Text style={styles.infoValue}>
                                            {new Date((user as unknown as User).metadata!.creationTime!).toLocaleDateString()}
                                        </Text>
                                    </View>
                                </>
                            )}
                        </View>
                    </View>
                </FadeInView>

                {/* Password Management */}
                <FadeInView delay={200}>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Password Management</Text>
                        <View style={styles.card}>
                            {!hasPassword ? (
                                <>
                                    <Text style={styles.cardDescription}>
                                        Add a password to your account to enable email/password sign-in
                                        in addition to Google.
                                    </Text>

                                    {/* Email Input */}
                                    <View style={styles.inputContainer}>
                                        <Text style={styles.label}>Email</Text>
                                        <View style={styles.inputWrapper}>
                                            <Ionicons
                                                name="mail-outline"
                                                size={20}
                                                color={colors.text.muted}
                                                style={styles.inputIcon}
                                            />
                                            <TextInput
                                                style={styles.input}
                                                value={email}
                                                onChangeText={setEmail}
                                                placeholder="your@email.com"
                                                placeholderTextColor={colors.text.muted}
                                                keyboardType="email-address"
                                                autoCapitalize="none"
                                                autoCorrect={false}
                                                editable={!isLoading}
                                            />
                                        </View>
                                    </View>

                                    {/* Password Input */}
                                    <View style={styles.inputContainer}>
                                        <Text style={styles.label}>Password</Text>
                                        <View style={styles.inputWrapper}>
                                            <Ionicons
                                                name="lock-closed-outline"
                                                size={20}
                                                color={colors.text.muted}
                                                style={styles.inputIcon}
                                            />
                                            <TextInput
                                                style={styles.input}
                                                value={password}
                                                onChangeText={setPassword}
                                                placeholder="At least 6 characters"
                                                placeholderTextColor={colors.text.muted}
                                                secureTextEntry={!showPassword}
                                                autoCapitalize="none"
                                                editable={!isLoading}
                                            />
                                            <AnimatedPressable
                                                onPress={() => setShowPassword(!showPassword)}
                                                style={styles.togglePassword}
                                            >
                                                <Ionicons
                                                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                                    size={20}
                                                    color={colors.text.muted}
                                                />
                                            </AnimatedPressable>
                                        </View>
                                    </View>

                                    {/* Confirm Password Input */}
                                    <View style={styles.inputContainer}>
                                        <Text style={styles.label}>Confirm Password</Text>
                                        <View style={styles.inputWrapper}>
                                            <Ionicons
                                                name="lock-closed-outline"
                                                size={20}
                                                color={colors.text.muted}
                                                style={styles.inputIcon}
                                            />
                                            <TextInput
                                                style={styles.input}
                                                value={confirmPassword}
                                                onChangeText={setConfirmPassword}
                                                placeholder="Re-enter password"
                                                placeholderTextColor={colors.text.muted}
                                                secureTextEntry={!showPassword}
                                                autoCapitalize="none"
                                                editable={!isLoading}
                                            />
                                        </View>
                                    </View>

                                    {/* Add Password Button */}
                                    <AnimatedPressable
                                        style={[styles.button, isLoading && styles.buttonDisabled]}
                                        onPress={handleAddPassword}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <ActivityIndicator color={colors.text.primary} />
                                        ) : (
                                            <Text style={styles.buttonText}>Add Password</Text>
                                        )}
                                    </AnimatedPressable>
                                </>
                            ) : (
                                <>
                                    <View style={styles.passwordStatus}>
                                        <Ionicons
                                            name="checkmark-circle"
                                            size={24}
                                            color={colors.status.success}
                                        />
                                        <Text style={styles.passwordStatusText}>
                                            Your account has password authentication enabled
                                        </Text>
                                    </View>

                                    <AnimatedPressable
                                        style={styles.secondaryButton}
                                        onPress={handleResetPassword}
                                    >
                                        <Text style={styles.secondaryButtonText}>Reset Password</Text>
                                    </AnimatedPressable>
                                </>
                            )}
                        </View>
                    </View>
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
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.lg,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    emptyText: {
        fontSize: typography.fontSize.lg,
        color: colors.text.muted,
        marginTop: spacing.md,
        marginBottom: spacing.xl,
        textAlign: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    profileIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.primary[400] + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    displayName: {
        fontSize: typography.fontSize.xxl,
        fontWeight: 'bold',
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    email: {
        fontSize: typography.fontSize.md,
        color: colors.text.muted,
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
        color: colors.text.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: spacing.sm,
    },
    card: {
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    cardDescription: {
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
        marginBottom: spacing.lg,
        lineHeight: 20,
    },
    infoRow: {
        paddingVertical: spacing.sm,
    },
    infoLabel: {
        fontSize: typography.fontSize.sm,
        color: colors.text.muted,
        marginBottom: spacing.xs,
    },
    infoValue: {
        fontSize: typography.fontSize.md,
        color: colors.text.primary,
        fontWeight: '500',
    },
    divider: {
        height: 1,
        backgroundColor: colors.border.default,
        marginVertical: spacing.sm,
    },
    providersContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
    },
    providerBadge: {
        backgroundColor: colors.primary[600] + '30',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.sm,
    },
    providerText: {
        fontSize: typography.fontSize.sm,
        color: colors.primary[400],
        fontWeight: '600',
    },
    inputContainer: {
        marginBottom: spacing.md,
    },
    label: {
        fontSize: typography.fontSize.sm,
        fontWeight: '600',
        color: colors.text.secondary,
        marginBottom: spacing.xs,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        paddingHorizontal: spacing.md,
    },
    inputIcon: {
        marginRight: spacing.sm,
    },
    input: {
        flex: 1,
        height: 50,
        color: colors.text.primary,
        fontSize: typography.fontSize.md,
    },
    togglePassword: {
        padding: spacing.xs,
    },
    button: {
        backgroundColor: colors.primary[600],
        borderRadius: borderRadius.md,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: spacing.md,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        fontSize: typography.fontSize.lg,
        fontWeight: 'bold',
        color: colors.text.primary,
    },
    secondaryButton: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: spacing.md,
    },
    secondaryButtonText: {
        fontSize: typography.fontSize.md,
        fontWeight: '600',
        color: colors.text.secondary,
    },
    passwordStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.md,
        backgroundColor: colors.status.success + '20',
        borderRadius: borderRadius.md,
        marginBottom: spacing.md,
    },
    passwordStatusText: {
        flex: 1,
        fontSize: typography.fontSize.sm,
        color: colors.text.primary,
        lineHeight: 20,
    },
});
