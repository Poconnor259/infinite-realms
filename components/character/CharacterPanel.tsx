import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { ModuleState, WorldModuleType } from '../../lib/types';
import { GenericCharacterPanel } from './GenericCharacterPanel';
import { ClassicCharacterPanel } from './ClassicCharacterPanel';
import { OutworlderCharacterPanel } from './OutworlderCharacterPanel';
import { TacticalCharacterPanel } from './TacticalCharacterPanel';

interface CharacterPanelProps {
    moduleState: ModuleState;
    worldModule: WorldModuleType;
}

export function CharacterPanel({ moduleState, worldModule }: CharacterPanelProps) {
    // Extract character data from moduleState
    const character = (moduleState as any).character;

    // Try to use generic panel first
    // For now, we'll use it for all types and fallback to legacy if needed
    const useGenericPanel = true; // Set to true to enable generic panel for all types

    if (useGenericPanel) {
        return (
            <View style={styles.container}>
                <GenericCharacterPanel
                    character={character}
                    worldType={worldModule}
                />
            </View>
        );
    }

    // Legacy fallback panels
    return (
        <View style={styles.container}>
            {worldModule === 'classic' && <ClassicCharacterPanel moduleState={moduleState as any} />}
            {worldModule === 'outworlder' && <OutworlderCharacterPanel moduleState={moduleState as any} />}
            {worldModule === 'tactical' && <TacticalCharacterPanel moduleState={moduleState as any} />}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
