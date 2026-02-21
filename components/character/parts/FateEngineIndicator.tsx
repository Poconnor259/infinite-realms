import * as React from 'react';
import { View, Text } from 'react-native';
import { spacing } from '../../../lib/theme';

export function FateEngineIndicator({ fateEngine, colors, styles }: { fateEngine: any; colors: any; styles: any }) {
    const momentum = fateEngine.momentum_counter || 0;
    const pityCritProgress = fateEngine.pity_crit_counter || 0;
    const fumbleProtection = fateEngine.fumble_protection_active || false;
    const directorMode = fateEngine.director_mode_cooldown || false;

    // Calculate pity crit percentage (triggers at 5)
    const pityCritPercentage = Math.min((pityCritProgress / 5) * 100, 100);

    return (
        <View style={{ gap: spacing.md }}>
            {/* Momentum Counter */}
            <View style={styles.fateEngineItem}>
                <View style={styles.fateEngineHeader}>
                    <Text style={[styles.fateEngineName, { color: colors.text.secondary }]}>
                        🌟 Momentum
                    </Text>
                    <Text style={[styles.fateEngineValue, { color: colors.primary[400] }]}>
                        {momentum}
                    </Text>
                </View>
                <Text style={[styles.fateEngineDesc, { color: colors.text.muted }]}>
                    Builds on successes, increases crit chance
                </Text>
            </View>

            {/* Pity Crit Progress */}
            <View style={styles.fateEngineItem}>
                <View style={styles.fateEngineHeader}>
                    <Text style={[styles.fateEngineName, { color: colors.text.secondary }]}>
                        🎯 Pity Crit Progress
                    </Text>
                    <Text style={[styles.fateEngineValue, { color: colors.status.warning }]}>
                        {pityCritProgress}/5
                    </Text>
                </View>
                <View style={[styles.progressBarBg, { backgroundColor: colors.background.tertiary }]}>
                    <View
                        style={[
                            styles.progressBarFill,
                            { width: `${pityCritPercentage}%`, backgroundColor: colors.status.warning }
                        ]}
                    />
                </View>
                <Text style={[styles.fateEngineDesc, { color: colors.text.muted }]}>
                    Guaranteed crit after 5 non-crits
                </Text>
            </View>

            {/* Fumble Protection */}
            {fumbleProtection && (
                <View style={[styles.fateEngineItem, { backgroundColor: colors.status.success + '20' }]}>
                    <View style={styles.fateEngineHeader}>
                        <Text style={[styles.fateEngineName, { color: colors.status.success }]}>
                            🛡️ Fumble Protection Active
                        </Text>
                    </View>
                    <Text style={[styles.fateEngineDesc, { color: colors.text.muted }]}>
                        Next natural 1 will be rerolled
                    </Text>
                </View>
            )}

            {/* Director Mode */}
            {directorMode && (
                <View style={[styles.fateEngineItem, { backgroundColor: colors.status.info + '20' }]}>
                    <View style={styles.fateEngineHeader}>
                        <Text style={[styles.fateEngineName, { color: colors.status.info }]}>
                            🎬 Director Mode Active
                        </Text>
                    </View>
                    <Text style={[styles.fateEngineDesc, { color: colors.text.muted }]}>
                        Difficulty adjusted in your favor
                    </Text>
                </View>
            )}
        </View>
    );
}
