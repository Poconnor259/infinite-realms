import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { ModuleState, WorldModuleType } from '../../lib/types';
import { normalizeCharacter } from '../../lib/normalizeCharacter';
import { UnifiedCharacterPanel } from './UnifiedCharacterPanel';

interface PendingRoll {
    type: string;
    purpose: string;
    modifier?: number;
    stat?: string;
    difficulty?: number;
}

interface CharacterPanelProps {
    moduleState: ModuleState;
    worldModule: WorldModuleType | string;
    onAcceptQuest?: (questId: string) => void;
    onDeclineQuest?: (questId: string) => void;
    pendingRoll?: PendingRoll | null;
    onRollComplete?: (result: { roll: number; total: number; success?: boolean }) => void;
}

export function CharacterPanel({ moduleState, worldModule, onAcceptQuest, onDeclineQuest, pendingRoll, onRollComplete }: CharacterPanelProps) {
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
                pendingRoll={pendingRoll}
                onRollComplete={onRollComplete}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
