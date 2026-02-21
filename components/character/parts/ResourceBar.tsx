import * as React from 'react';
import { View, Text } from 'react-native';
import type { NormalizedResource } from '../../../lib/normalizeCharacter';

export function ResourceBar({ resource, colors, styles }: { resource: NormalizedResource; colors: any; styles: any }) {
    const percentage = resource.max > 0 ? (resource.current / resource.max) * 100 : 0;
    const barColor = resource.color || colors.primary[400];

    // Defensive coercion
    const safeName = String(resource.name || 'Resource');
    const safeCurrent = typeof resource.current === 'number' ? resource.current : 0;
    const safeMax = typeof resource.max === 'number' ? resource.max : 100;
    const safeIcon = resource.icon ? String(resource.icon) : '';

    return (
        <View style={styles.resourceContainer}>
            <View style={styles.resourceHeader}>
                <Text style={[styles.resourceName, { color: colors.text.secondary }]}>
                    {safeIcon && `${safeIcon} `}{safeName}
                </Text>
                <Text style={[styles.resourceValue, { color: colors.text.muted }]}>
                    {safeCurrent} / {safeMax}
                </Text>
            </View>
            <View style={[styles.resourceBarBg, { backgroundColor: colors.background.tertiary }]}>
                <View
                    style={[
                        styles.resourceBarFill,
                        { width: `${percentage}%`, backgroundColor: barColor }
                    ]}
                />
            </View>
        </View>
    );
}
