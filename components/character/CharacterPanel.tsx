import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { ModuleState, WorldModuleType } from '../../lib/types';
import { ClassicCharacterPanel } from './ClassicCharacterPanel';
import { OutworlderCharacterPanel } from './OutworlderCharacterPanel';
import { TacticalCharacterPanel } from './TacticalCharacterPanel';

interface CharacterPanelProps {
    moduleState: ModuleState;
    worldModule: WorldModuleType;
}

export function CharacterPanel({ moduleState, worldModule }: CharacterPanelProps) {
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
