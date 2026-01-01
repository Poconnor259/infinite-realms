import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { ModuleState, WorldModuleType } from '../../lib/types';
import { normalizeCharacter } from '../../lib/normalizeCharacter';
import { UnifiedCharacterPanel } from './UnifiedCharacterPanel';

interface CharacterPanelProps {
    moduleState: ModuleState;
    worldModule: WorldModuleType | string;
    onAcceptQuest?: (questId: string) => void;
    onDeclineQuest?: (questId: string) => void;
}

export function CharacterPanel({ moduleState, worldModule, onAcceptQuest, onDeclineQuest }: CharacterPanelProps) {
    // Extract character data from moduleState
    const rawCharacter = (moduleState as any).character;

    // Normalize character data for consistent display
    const normalizedCharacter = normalizeCharacter(
        rawCharacter,
        worldModule,
        (moduleState as any).questLog,
        (moduleState as any).suggestedQuests
    );

    return (
        <View style={styles.container}>
            <UnifiedCharacterPanel
                character={normalizedCharacter}
                worldType={worldModule}
                onAcceptQuest={onAcceptQuest}
                onDeclineQuest={onDeclineQuest}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
