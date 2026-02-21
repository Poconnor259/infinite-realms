import * as React from 'react';
import { View, Text } from 'react-native';
import type { NormalizedItem } from '../../../lib/normalizeCharacter';

export function InventoryItem({ item, colors, styles }: { item: NormalizedItem; colors: any; styles: any }) {
    // Defensive coercion
    const safeName = String(item.name || 'Item');
    const safeQuantity = typeof item.quantity === 'number' ? item.quantity : 1;

    return (
        <View style={[styles.inventoryItem, { backgroundColor: colors.background.tertiary }]}>
            <View style={styles.inventoryLeft}>
                {item.equipped && <Text style={styles.equippedIcon}>⚡</Text>}
                <Text style={[styles.itemName, { color: colors.text.primary }]}>
                    {safeName}
                </Text>
            </View>
            {safeQuantity > 1 && (
                <Text style={[styles.itemQuantity, { color: colors.text.muted }]}>
                    ×{safeQuantity}
                </Text>
            )}
        </View>
    );
}
