import * as React from 'react';
import { View, Text } from 'react-native';
import { CollapsibleSection } from './CollapsibleSection';

export function ExtrasSection({ extras, worldType, colors, styles, updates, onClearUpdate }: {

    extras: Record<string, any>;
    worldType?: string;
    colors: any;
    styles: any;
    updates?: Record<string, boolean>;
    onClearUpdate?: () => void;
}) {
    // Outworlder Essences
    if (extras.essences && Array.isArray(extras.essences) && extras.essences.length > 0) {
        const count = extras.essences.length;

        return (
            <CollapsibleSection
                title={`Essences (${count})`}
                colors={colors}
                styles={styles}
                hasUpdate={updates?.['extras']}
                onExpand={onClearUpdate}
            >
                {extras.essences.map((essence: string, idx: number) => (
                    <View key={idx} style={[styles.essenceItem, { backgroundColor: colors.background.tertiary }]}>
                        <Text style={[styles.essenceName, { color: colors.text.primary }]}>{essence}</Text>
                    </View>
                ))}
            </CollapsibleSection>
        );
    }

    return null;
}
