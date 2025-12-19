import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { ModuleState, WorldModuleType } from '../../lib/types';
import { ClassicCharacterPanel } from './ClassicCharacterPanel';
import { OutworlderCharacterPanel } from './OutworlderCharacterPanel';
import { ShadowMonarchCharacterPanel } from './ShadowMonarchCharacterPanel';

interface CharacterPanelProps {
    moduleState: ModuleState;
    worldModule: WorldModuleType;
}

export function CharacterPanel({ moduleState, worldModule }: CharacterPanelProps) {
    return (
        <View style={styles.container}>
            {worldModule === 'classic' && <ClassicCharacterPanel moduleState={moduleState as any} />}
            {worldModule === 'outworlder' && <OutworlderCharacterPanel moduleState={moduleState as any} />}
            {worldModule === 'shadowMonarch' && <ShadowMonarchCharacterPanel moduleState={moduleState as any} />}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
