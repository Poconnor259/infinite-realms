import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { ModuleState, WorldModuleType } from '../../lib/types';
import { normalizeCharacter } from '../../lib/normalizeCharacter';
import { UnifiedCharacterPanel } from './UnifiedCharacterPanel';

interface CharacterPanelProps {
    moduleState: ModuleState;
    worldModule: WorldModuleType | string;
}

export function CharacterPanel({ moduleState, worldModule }: CharacterPanelProps) {
    // Extract character data from moduleState
    const rawCharacter = (moduleState as any).character;

    // Normalize character data for consistent display
    const normalizedCharacter = normalizeCharacter(rawCharacter, worldModule);

    return (
        <View style={styles.container}>
            <UnifiedCharacterPanel
                character={normalizedCharacter}
                worldType={worldModule}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
