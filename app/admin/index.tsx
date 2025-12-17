
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../lib/theme';
import { AnimatedPressable } from '../../components/ui/Animated';
import { FadeInView, StaggeredList } from '../../components/ui/Animated';

interface AdminCardProps {
    title: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
}

function AdminCard({ title, description, icon, onPress }: AdminCardProps) {
    return (
        <AnimatedPressable style={styles.card} onPress={onPress}>
            <View style={styles.cardIcon}>
                <Ionicons name={icon} size={24} color={colors.primary[400]} />
            </View>
            <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{title}</Text>
                <Text style={styles.cardDescription}>{description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
        </AnimatedPressable>
    );
}

export default function AdminDashboard() {
    const router = useRouter();

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <FadeInView>
                <Text style={styles.header}>Overview</Text>
            </FadeInView>

            <StaggeredList style={{ gap: spacing.md }}>
                <AdminCard
                    title="User Accounts"
                    description="Manage users, roles, and subscriptions"
                    icon="people"
                    onPress={() => router.push('/admin/users')}
                />
                <AdminCard
                    title="AI Training"
                    description="Fine-tune models and manage datasets"
                    icon="bulb"
                    onPress={() => router.push('/admin/training')}
                />
                <AdminCard
                    title="System Metrics"
                    description="View usage stats and system health"
                    icon="stats-chart"
                    onPress={() => router.push('/admin/metrics')}
                />
                <AdminCard
                    title="Global Config"
                    description="Update game settings and constants"
                    icon="settings"
                    onPress={() => router.push('/admin/config')}
                />
            </StaggeredList>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    content: {
        padding: spacing.lg,
    },
    header: {
        fontSize: typography.fontSize.xl,
        fontWeight: 'bold',
        color: colors.text.primary,
        marginBottom: spacing.lg,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.secondary,
        padding: spacing.lg,
        borderRadius: borderRadius.md,
        ...shadows.sm,
        borderWidth: 1,
        borderColor: colors.border.default,
        marginBottom: spacing.md,
    },
    cardIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.background.tertiary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    cardContent: {
        flex: 1,
    },
    cardTitle: {
        fontSize: typography.fontSize.lg,
        fontWeight: 'bold',
        color: colors.text.primary,
        marginBottom: 2,
    },
    cardDescription: {
        fontSize: typography.fontSize.sm,
        color: colors.text.muted,
    },
});
