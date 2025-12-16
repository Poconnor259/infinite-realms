import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../lib/theme';

interface StatCardProps {
    label: string;
    value: number | string;
    icon?: string;
    color?: string;
}

export function StatCard({ label, value, icon, color }: StatCardProps) {
    return (
        <View style={styles.statCard}>
            {icon && <Text style={styles.statIcon}>{icon}</Text>}
            <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

interface CompactStatProps {
    label: string;
    value: number | string;
    modifier?: number;
}

export function CompactStat({ label, value, modifier }: CompactStatProps) {
    const modifierText = modifier !== undefined ?
        (modifier >= 0 ? `+${modifier}` : `${modifier}`) : null;

    return (
        <View style={styles.compactStat}>
            <Text style={styles.compactLabel}>{label}</Text>
            <Text style={styles.compactValue}>{value}</Text>
            {modifierText && (
                <Text style={styles.compactModifier}>{modifierText}</Text>
            )}
        </View>
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

export function ResourceBar({ label, current, max, color = colors.primary[400], icon }: ResourceBarProps) {
    const percentage = Math.max(0, Math.min(100, (current / max) * 100));

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
                        { width: `${percentage}%`, backgroundColor: color },
                    ]}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
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
        fontWeight: 'bold',
    },
    statLabel: {
        color: colors.text.muted,
        fontSize: typography.fontSize.xs,
        marginTop: spacing.xs,
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
        fontWeight: '600',
    },
    compactValue: {
        color: colors.text.primary,
        fontSize: typography.fontSize.md,
        fontWeight: 'bold',
    },
    compactModifier: {
        color: colors.text.secondary,
        fontSize: 10,
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
        marginBottom: spacing.xs,
    },
    resourceIcon: {
        fontSize: 14,
        marginRight: spacing.xs,
    },
    resourceLabel: {
        color: colors.text.muted,
        fontSize: typography.fontSize.xs,
        flex: 1,
    },
    resourceValue: {
        color: colors.text.secondary,
        fontSize: typography.fontSize.xs,
    },
    resourceTrack: {
        height: 8,
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.full,
        overflow: 'hidden',
    },
    resourceFill: {
        height: '100%',
        borderRadius: borderRadius.full,
    },
});
