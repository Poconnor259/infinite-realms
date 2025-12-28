
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius, shadows } from '../../lib/theme';
import { useThemeColors } from '../../lib/hooks/useTheme';
import { AnimatedPressable } from '../../components/ui/Animated';
import { FadeInView, StaggeredList } from '../../components/ui/Animated';

interface AdminCardProps {
    title: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    colors: any;
    styles: any;
}

function AdminCard({ title, description, icon, onPress, colors, styles }: AdminCardProps) {
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
    const { colors } = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const cards = [
        {
            title: "User Accounts",
            description: "Manage users, roles, and subscriptions",
            icon: "people" as const,
            onPress: () => router.push('/admin/users')
        },
        {
            title: "World Management",
            description: "Add, delete, and configure game worlds",
            icon: "planet-outline" as const,
            onPress: () => router.push('/admin/worlds')
        },
        {
            title: "AI Training",
            description: "Fine-tune models and manage datasets",
            icon: "bulb" as const,
            onPress: () => router.push('/admin/training')
        },
        {
            title: "AI Prompts",
            description: "Customize Brain, Voice, and State Reviewer prompts",
            icon: "code-slash" as const,
            onPress: () => router.push('/admin/prompts')
        },
        {
            title: "System Metrics",
            description: "View usage stats and system health",
            icon: "stats-chart" as const,
            onPress: () => router.push('/admin/metrics')
        },
        {
            title: "Cost Estimator",
            description: "Track usage and estimated billing",
            icon: "cash-outline" as const,
            onPress: () => router.push('/admin/costs')
        },
        {
            title: "Global Config",
            description: "Update game settings and constants",
            icon: "settings" as const,
            onPress: () => router.push('/admin/config')
        }
    ];

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.header}>Admin Dashboard</Text>
            </View>

            <StaggeredList style={{ gap: spacing.md }}>
                {cards.map((card, index) => (
                    <AdminCard
                        key={index}
                        {...card}
                        colors={colors}
                        styles={styles}
                    />
                ))}
            </StaggeredList>
        </ScrollView>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
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
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xl,
        gap: spacing.md,
    },
    backButton: {
        padding: spacing.sm,
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
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
