
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../lib/theme';
import { AnimatedPressable, FadeInView } from '../../components/ui/Animated';
import { useUserStore } from '../../lib/store';

export default function VerifyEmailScreen() {
    const router = useRouter();
    const user = useUserStore((state) => state.user);

    return (
        <View style={styles.container}>
            <FadeInView style={styles.content}>
                <View style={styles.iconContainer}>
                    <Ionicons name="mail-open-outline" size={64} color={colors.primary[400]} />
                </View>

                <Text style={styles.title}>Check your email!</Text>

                <Text style={styles.description}>
                    We've sent a verification link to:
                </Text>
                <Text style={styles.email}>{user?.email}</Text>

                <Text style={styles.description}>
                    Please click the link in the email to verify your account and unlock all features.
                </Text>

                <View style={styles.divider} />

                <Text style={styles.secondaryText}>
                    Can't find it? Check your spam folder.
                </Text>

                <AnimatedPressable
                    style={styles.button}
                    onPress={() => router.replace('/')}
                >
                    <Text style={styles.buttonText}>Continue to App</Text>
                </AnimatedPressable>
            </FadeInView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
        justifyContent: 'center',
        padding: spacing.lg,
    },
    content: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: spacing.xl,
        alignItems: 'center',
        ...shadows.lg,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.background.tertiary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.xl,
        borderWidth: 1,
        borderColor: colors.primary[500] + '30', // Low opacity border
    },
    title: {
        fontSize: typography.fontSize.xxl,
        fontWeight: 'bold',
        color: colors.text.primary,
        marginBottom: spacing.md,
        textAlign: 'center',
    },
    description: {
        fontSize: typography.fontSize.md,
        color: colors.text.secondary,
        textAlign: 'center',
        marginBottom: spacing.sm,
        lineHeight: 24,
    },
    email: {
        fontSize: typography.fontSize.lg,
        color: colors.primary[400],
        fontWeight: 'bold',
        marginBottom: spacing.lg,
        textAlign: 'center',
    },
    divider: {
        width: '100%',
        height: 1,
        backgroundColor: colors.border.default,
        marginVertical: spacing.lg,
    },
    secondaryText: {
        fontSize: typography.fontSize.sm,
        color: colors.text.muted,
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    button: {
        backgroundColor: colors.primary[600],
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        borderRadius: borderRadius.md,
        width: '100%',
        alignItems: 'center',
        ...shadows.md,
    },
    buttonText: {
        fontSize: typography.fontSize.lg,
        fontWeight: 'bold',
        color: colors.text.primary,
    },
});
