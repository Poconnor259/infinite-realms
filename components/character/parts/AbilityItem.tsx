import * as React from 'react';
import { View, Text } from 'react-native';
import type { NormalizedAbility } from '../../../lib/normalizeCharacter';

export function getRankColor(rank: string): string {
    const colors: Record<string, string> = {
        'Iron': '#6B7280',
        'Bronze': '#CD7F32',
        'Silver': '#C0C0C0',
        'Gold': '#FFD700',
        'Diamond': '#B9F2FF',
        'Normal': '#9CA3AF',
        'Common': '#9CA3AF',
        'Uncommon': '#22C55E',
        'Rare': '#3B82F6',
        'Epic': '#8B5CF6',
        'Legendary': '#F59E0B',
    };
    return colors[rank] || '#9CA3AF';
}

export function AbilityItem({ ability, colors, styles }: { ability: NormalizedAbility; colors: any; styles: any }) {
    // Defensive coercion
    const safeName = String(ability.name || 'Ability');
    const safeRank = ability.rank ? String(ability.rank) : null;
    const safeType = ability.type ? String(ability.type) : null;
    const safeCooldown = typeof ability.currentCooldown === 'number' ? ability.currentCooldown : 0;
    const isOnCooldown = safeCooldown > 0;

    return (
        <View style={[styles.abilityItem, { backgroundColor: colors.background.tertiary }]}>
            <View style={styles.abilityHeader}>
                <Text style={[styles.abilityName, { color: colors.text.primary }]}>
                    {safeName}
                </Text>
                {safeRank && (
                    <Text style={[styles.abilityRank, { color: getRankColor(safeRank) }]}>
                        {safeRank}
                    </Text>
                )}
            </View>
            {safeType && (
                <Text style={[styles.abilityType, { color: colors.text.muted }]}>
                    {safeType}
                </Text>
            )}
            {isOnCooldown && (
                <Text style={[styles.abilityCooldown, { color: colors.status.warning }]}>
                    Cooldown: {safeCooldown}
                </Text>
            )}
        </View>
    );
}
