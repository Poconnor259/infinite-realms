import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../lib/theme';

interface HPBarProps {
    current: number;
    max: number;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
}

export function HPBar({ current, max, size = 'md', showLabel = true }: HPBarProps) {
    const percentage = Math.max(0, Math.min(100, (current / max) * 100));

    const getColor = () => {
        if (percentage > 50) return colors.hp.full;
        if (percentage > 25) return colors.hp.medium;
        return colors.hp.low;
    };

    const getHeight = () => {
        switch (size) {
            case 'sm': return 8;
            case 'lg': return 20;
            default: return 14;
        }
    };

    return (
        <View style={styles.container}>
            {showLabel && (
                <View style={styles.labelRow}>
                    <Text style={styles.label}>HP</Text>
                    <Text style={styles.value}>{current}/{max}</Text>
                </View>
            )}
            <View style={[styles.track, { height: getHeight() }]}>
                <View
                    style={[
                        styles.fill,
                        {
                            width: `${percentage}%`,
                            backgroundColor: getColor(),
                        },
                    ]}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.xs,
    },
    label: {
        color: colors.text.muted,
        fontSize: typography.fontSize.xs,
        fontWeight: '600',
    },
    value: {
        color: colors.text.secondary,
        fontSize: typography.fontSize.xs,
    },
    track: {
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.full,
        overflow: 'hidden',
    },
    fill: {
        height: '100%',
        borderRadius: borderRadius.full,
    },
});
