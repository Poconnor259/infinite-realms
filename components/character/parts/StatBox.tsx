import * as React from 'react';
import { View, Text } from 'react-native';
import type { NormalizedStat } from '../../../lib/normalizeCharacter';

export function StatBox({ stat, colors, styles }: { stat: NormalizedStat; colors: any; styles: any }) {
    // Defensive coercion
    const safeName = String(stat.name || 'Stat');
    const safeAbbr = stat.abbreviation ? String(stat.abbreviation) : safeName.slice(0, 3).toUpperCase();
    const safeValue = typeof stat.value === 'number' ? stat.value : 0;
    const safeIcon = stat.icon ? String(stat.icon) : null;

    return (
        <View style={[styles.statBox, { backgroundColor: colors.background.tertiary }]}>
            <Text style={[styles.statLabel, { color: colors.text.muted }]}>
                {safeAbbr}
            </Text>
            <Text style={[styles.statValue, { color: colors.text.primary }]}>
                {safeValue}
            </Text>
            {safeIcon && (
                <Text style={styles.statIcon}>{safeIcon}</Text>
            )}
        </View>
    );
}
