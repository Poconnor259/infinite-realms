import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, borderRadius } from '../../lib/theme';
import { GlassCard } from '../ui/GlassCard';
import { useThemeColors } from '../../lib/hooks/useTheme';

interface StatCardProps {
    label: string;
    value: number | string;
    icon?: string;
    color?: string;
}

export function StatCard({ label, value, icon, color }: StatCardProps) {
    const { colors, typography } = useThemeColors();
    const styles = useMemo(() => createStyles(colors, typography), [colors, typography]);

    return (
        <GlassCard variant="light" style={styles.statCard}>
            {icon && <Text style={styles.statIcon}>{icon}</Text>}
            <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </GlassCard>
    );
}

interface CompactStatProps {
    label: string;
    value: number | string;
    modifier?: number;
}

export function CompactStat({ label, value, modifier }: CompactStatProps) {
    const { colors, typography } = useThemeColors();
    const styles = useMemo(() => createStyles(colors, typography), [colors, typography]);
    const modifierText = modifier !== undefined ?
        (modifier >= 0 ? `+${modifier}` : `${modifier}`) : null;

    return (
        <GlassCard variant="light" style={styles.compactStat}>
            <Text style={styles.compactLabel}>{label}</Text>
            <Text style={styles.compactValue}>{value}</Text>
            {modifierText && (
                <Text style={styles.compactModifier}>{modifierText}</Text>
            )}
        </GlassCard>
    );
}

interface StatRowProps {
    stats: Record<string, number>;
}

export function StatRow({ stats }: StatRowProps) {
    const getModifier = (value: number) => Math.floor((value - 10) / 2);

    return (
        <View style={styles.statRow}>
            {Object.entries(stats).map(([key, value]) => (
                <CompactStat
                    key={key}
                    label={key}
                    value={value}
                    modifier={getModifier(value)}
                />
            ))}
        </View>
    );
}

interface ResourceBarProps {
    label: string;
    current: number;
    max: number;
    color?: string;
    icon?: string;
}

export function ResourceBar({ label, current, max, color, icon }: ResourceBarProps) {
    const { colors, typography } = useThemeColors();
    const styles = useMemo(() => createStyles(colors, typography), [colors, typography]);
    const percentage = Math.max(0, Math.min(100, (current / max) * 100));
    const fillColor = color || colors.primary[400];

    return (
        <View style={styles.resourceContainer}>
            <View style={styles.resourceHeader}>
                {icon && <Text style={styles.resourceIcon}>{icon}</Text>}
                <Text style={styles.resourceLabel}>{label}</Text>
                <Text style={styles.resourceValue}>{current}/{max}</Text>
            </View>
            <View style={styles.resourceTrack}>
                <View
                    style={[
                        styles.resourceFill,
                        { width: `${percentage}%`, backgroundColor: fillColor },
                    ]}
                />
            </View>
        </View>
    );
}

const createStyles = (colors: any, typography: any) => StyleSheet.create({
    statCard: {
        backgroundColor: colors.background.tertiary,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        minWidth: 70,
    },
    statIcon: {
        fontSize: 20,
        marginBottom: spacing.xs,
    },
    statValue: {
        color: colors.text.primary,
        fontSize: typography.fontSize.xl,
        fontFamily: typography.fontFamily.bold,
    },
    statLabel: {
        color: colors.text.muted,
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.medium,
        marginTop: spacing.xs,
        textTransform: 'uppercase',
    },
    compactStat: {
        backgroundColor: colors.background.tertiary,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.sm,
        alignItems: 'center',
        minWidth: 44,
    },
    compactLabel: {
        color: colors.text.muted,
        fontSize: 10,
        fontFamily: typography.fontFamily.bold,
        textTransform: 'uppercase',
    },
    compactValue: {
        color: colors.text.primary,
        fontSize: typography.fontSize.md,
        fontFamily: typography.fontFamily.bold,
    },
    compactModifier: {
        color: colors.text.secondary,
        fontSize: 10,
        fontFamily: typography.fontFamily.regular,
    },
    statRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
    },
    resourceContainer: {
        width: '100%',
    },
    resourceHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
    },
    resourceIcon: {
        fontSize: 14,
        marginRight: spacing.xs,
    },
    resourceLabel: {
        color: colors.text.muted,
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.bold,
        flex: 1,
        textTransform: 'uppercase',
    },
    resourceValue: {
        color: colors.text.secondary,
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.regular,
    },
    resourceTrack: {
        height: 6,
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.full,
        overflow: 'hidden',
    },
    resourceFill: {
        height: '100%',
        borderRadius: borderRadius.full,
    },
});

const styles = StyleSheet.create({
    statRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
    },
});
