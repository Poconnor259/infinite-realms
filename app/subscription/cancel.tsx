import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../../lib/theme';

export default function SubscriptionCancelScreen() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Ionicons name="close-circle" size={80} color={colors.status.error} />
                <Text style={styles.title}>Payment Cancelled</Text>
                <Text style={styles.message}>
                    The transaction was cancelled. No charges were made to your account.
                </Text>

                <TouchableOpacity
                    style={styles.button}
                    onPress={() => router.replace('/subscription')}
                >
                    <Text style={styles.buttonText}>Return onto Subscription</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
        justifyContent: 'center',
        padding: spacing.xl,
    },
    content: {
        alignItems: 'center',
        backgroundColor: colors.background.tertiary,
        padding: spacing.xl,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    title: {
        fontSize: typography.fontSize.xxl,
        fontWeight: 'bold',
        color: colors.text.primary,
        marginTop: spacing.lg,
        marginBottom: spacing.md,
    },
    message: {
        fontSize: typography.fontSize.md,
        color: colors.text.secondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
        lineHeight: 24,
    },
    button: {
        backgroundColor: colors.background.elevated,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        width: '100%',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    buttonText: {
        color: colors.text.primary,
        fontSize: typography.fontSize.md,
        fontWeight: '600',
    },
});
