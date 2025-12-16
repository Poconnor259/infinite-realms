import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../lib/theme';
import { signInWithEmail, signInAnonymouslyIfNeeded, resetPassword } from '../../lib/firebase';
import { AnimatedPressable, FadeInView } from '../../components/ui/Animated';

export default function SignInScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSignIn = async () => {
        if (!email.trim() || !password.trim()) {
            Alert.alert('Required', 'Please enter your email and password');
            return;
        }

        setIsLoading(true);
        const { user, error } = await signInWithEmail(email.trim(), password);
        setIsLoading(false);

        if (error) {
            Alert.alert('Sign In Failed', error);
        } else if (user) {
            // Navigate to home - the auth listener will handle the rest
            router.replace('/');
        }
    };

    const handleForgotPassword = async () => {
        if (!email.trim()) {
            Alert.alert('Email Required', 'Please enter your email address to reset your password');
            return;
        }

        const { success, error } = await resetPassword(email.trim());
        if (success) {
            Alert.alert('Email Sent', 'Check your email for password reset instructions');
        } else {
            Alert.alert('Error', error || 'Failed to send password reset email');
        }
    };

    const handleContinueAsGuest = async () => {
        setIsLoading(true);
        await signInAnonymouslyIfNeeded();
        setIsLoading(false);
        router.replace('/');
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Header */}
                    <FadeInView style={styles.header} delay={0}>
                        <Text style={styles.logo}>⚔️</Text>
                        <Text style={styles.title}>Infinite Realms</Text>
                        <Text style={styles.subtitle}>Sign in to continue your adventure</Text>
                    </FadeInView>

                    {/* Sign In Form */}
                    <FadeInView style={styles.form} delay={100}>
                        {/* Email */}
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

                        {/* Password */}
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
                                    placeholder="••••••••"
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

                        {/* Forgot Password */}
                        <AnimatedPressable onPress={handleForgotPassword} disabled={isLoading}>
                            <Text style={styles.forgotPassword}>Forgot password?</Text>
                        </AnimatedPressable>

                        {/* Sign In Button */}
                        <AnimatedPressable
                            style={[styles.signInButton, isLoading && styles.buttonDisabled]}
                            onPress={handleSignIn}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color={colors.text.inverse} />
                            ) : (
                                <Text style={styles.signInButtonText}>Sign In</Text>
                            )}
                        </AnimatedPressable>
                    </FadeInView>

                    {/* Divider */}
                    <FadeInView style={styles.divider} delay={200}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>or</Text>
                        <View style={styles.dividerLine} />
                    </FadeInView>

                    {/* Guest Sign In */}
                    <FadeInView delay={300}>
                        <AnimatedPressable
                            style={styles.guestButton}
                            onPress={handleContinueAsGuest}
                            disabled={isLoading}
                        >
                            <Ionicons name="person-outline" size={20} color={colors.text.secondary} />
                            <Text style={styles.guestButtonText}>Continue as Guest</Text>
                        </AnimatedPressable>
                    </FadeInView>

                    {/* Sign Up Link */}
                    <FadeInView style={styles.footer} delay={400}>
                        <Text style={styles.footerText}>Don't have an account? </Text>
                        <AnimatedPressable
                            onPress={() => router.push('/auth/signup')}
                            disabled={isLoading}
                        >
                            <Text style={styles.footerLink}>Sign Up</Text>
                        </AnimatedPressable>
                    </FadeInView>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    scrollContent: {
        flexGrow: 1,
        padding: spacing.lg,
        justifyContent: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing.xxl,
    },
    logo: {
        fontSize: 64,
        marginBottom: spacing.md,
    },
    title: {
        fontSize: typography.fontSize.xxxl,
        fontWeight: 'bold',
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    subtitle: {
        fontSize: typography.fontSize.md,
        color: colors.text.muted,
        textAlign: 'center',
    },
    form: {
        marginBottom: spacing.xl,
    },
    inputContainer: {
        marginBottom: spacing.lg,
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
        backgroundColor: colors.background.tertiary,
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
    forgotPassword: {
        fontSize: typography.fontSize.sm,
        color: colors.primary[400],
        textAlign: 'right',
        marginBottom: spacing.lg,
    },
    signInButton: {
        backgroundColor: colors.primary[600],
        borderRadius: borderRadius.md,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.md,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    signInButtonText: {
        fontSize: typography.fontSize.lg,
        fontWeight: 'bold',
        color: colors.text.primary,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: spacing.xl,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.border.default,
    },
    dividerText: {
        marginHorizontal: spacing.md,
        fontSize: typography.fontSize.sm,
        color: colors.text.muted,
    },
    guestButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        height: 50,
        gap: spacing.sm,
    },
    guestButtonText: {
        fontSize: typography.fontSize.md,
        fontWeight: '600',
        color: colors.text.secondary,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: spacing.xl,
    },
    footerText: {
        fontSize: typography.fontSize.md,
        color: colors.text.muted,
    },
    footerLink: {
        fontSize: typography.fontSize.md,
        fontWeight: 'bold',
        color: colors.primary[400],
    },
});
