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
import { signUpWithEmail, linkAnonymousToEmail } from '../../lib/firebase';
import { AnimatedPressable, FadeInView } from '../../components/ui/Animated';
import { auth } from '../../lib/firebase';

export default function SignUpScreen() {
    const router = useRouter();
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const isAnonymous = auth.currentUser?.isAnonymous;

    const handleSignUp = async () => {
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

        let result;
        if (isAnonymous) {
            // Link anonymous account to email
            result = await linkAnonymousToEmail(email.trim(), password);
        } else {
            // Create new account
            result = await signUpWithEmail(email.trim(), password, displayName.trim());
        }

        setIsLoading(false);

        if (result.error) {
            Alert.alert('Sign Up Failed', result.error);
        } else if (result.user) {
            Alert.alert(
                'Success!',
                isAnonymous
                    ? 'Your account has been created and your progress is saved!'
                    : 'Welcome to Infinite Realms!',
                [{ text: 'OK', onPress: () => router.replace('/') }]
            );
        }
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
                        <AnimatedPressable
                            onPress={() => router.back()}
                            style={styles.backButton}
                        >
                            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
                        </AnimatedPressable>
                        <Text style={styles.title}>
                            {isAnonymous ? 'Create Your Account' : 'Sign Up'}
                        </Text>
                        <Text style={styles.subtitle}>
                            {isAnonymous
                                ? 'Save your progress across devices'
                                : 'Join the adventure'}
                        </Text>
                    </FadeInView>

                    {/* Sign Up Form */}
                    <FadeInView style={styles.form} delay={100}>
                        {/* Display Name */}
                        {!isAnonymous && (
                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Display Name</Text>
                                <View style={styles.inputWrapper}>
                                    <Ionicons
                                        name="person-outline"
                                        size={20}
                                        color={colors.text.muted}
                                        style={styles.inputIcon}
                                    />
                                    <TextInput
                                        style={styles.input}
                                        value={displayName}
                                        onChangeText={setDisplayName}
                                        placeholder="Your name"
                                        placeholderTextColor={colors.text.muted}
                                        autoCapitalize="words"
                                        editable={!isLoading}
                                    />
                                </View>
                            </View>
                        )}

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

                        {/* Confirm Password */}
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

                        {/* Sign Up Button */}
                        <AnimatedPressable
                            style={[styles.signUpButton, isLoading && styles.buttonDisabled]}
                            onPress={handleSignUp}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color={colors.text.inverse} />
                            ) : (
                                <Text style={styles.signUpButtonText}>
                                    {isAnonymous ? 'Create Account' : 'Sign Up'}
                                </Text>
                            )}
                        </AnimatedPressable>
                    </FadeInView>

                    {/* Sign In Link */}
                    {!isAnonymous && (
                        <FadeInView style={styles.footer} delay={200}>
                            <Text style={styles.footerText}>Already have an account? </Text>
                            <AnimatedPressable
                                onPress={() => router.replace('/auth/signin')}
                                disabled={isLoading}
                            >
                                <Text style={styles.footerLink}>Sign In</Text>
                            </AnimatedPressable>
                        </FadeInView>
                    )}
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
    },
    header: {
        marginBottom: spacing.xxl,
        marginTop: spacing.md,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.background.tertiary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
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
    signUpButton: {
        backgroundColor: colors.primary[600],
        borderRadius: borderRadius.md,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: spacing.md,
        ...shadows.md,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    signUpButtonText: {
        fontSize: typography.fontSize.lg,
        fontWeight: 'bold',
        color: colors.text.primary,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: spacing.lg,
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
