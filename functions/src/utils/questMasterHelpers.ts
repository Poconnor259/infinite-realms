/**
 * Quest Master Integration Helpers
 * Functions for triggering and managing Quest Master AI
 */

import type { GameState, Quest } from './stateHelpers';

// ==================== TRIGGER LOGIC ====================

export interface QuestMasterTriggerResult {
    shouldTrigger: boolean;
    reason: 'level_up' | 'location_change' | 'quest_complete' | 'queue_empty' | 'manual' | '';
}

export interface GlobalConfig {
    questMaster?: {
        enabled: boolean;
        autoTrigger: boolean;
        modelProvider: 'openai' | 'anthropic' | 'google';
        modelId: string;
        maxQuestsPerTrigger: number;
        cooldownTurns: number;
        triggerConditions: {
            onLevelUp: boolean;
            onLocationChange: boolean;
            onQuestComplete: boolean;
            onQuestQueueEmpty: boolean;
        };
        autoAcceptQuests: boolean;
        enableQuestChains: boolean;
        enableTimedQuests: boolean;
    };
}

export function shouldTriggerQuestMaster(
    oldState: GameState,
    newState: GameState,
    config: GlobalConfig
): QuestMasterTriggerResult {
    if (!config.questMaster?.enabled || !config.questMaster?.autoTrigger) {
        return { shouldTrigger: false, reason: '' };
    }

    // THROTTLE: Don't generate more than once per N turns
    const lastGenTurn = newState.questMaster?.lastGenerationTurn || 0;
    const currentTurn = (newState as any).turnCount || 0;
    const cooldownTurns = config.questMaster.cooldownTurns || 5;

    if (currentTurn - lastGenTurn < cooldownTurns) {
        return { shouldTrigger: false, reason: '' };
    }

    const conditions = config.questMaster.triggerConditions;

    // Level Up (highest priority)
    if (conditions.onLevelUp) {
        const oldRank = (oldState.character?.rank as any) || 1;
        const newRank = (newState.character?.rank as any) || 1;
        if (newRank > oldRank) {
            return { shouldTrigger: true, reason: 'level_up' };
        }
    }

    // Location Change
    if (conditions.onLocationChange) {
        const oldLocation = (oldState as any).location;
        const newLocation = (newState as any).location;
        if (oldLocation !== newLocation && newLocation) {
            return { shouldTrigger: true, reason: 'location_change' };
        }
    }

    // Quest Complete
    if (conditions.onQuestComplete) {
        const oldCompleted = (oldState.questLog || []).filter(q => q.status === 'completed').length;
        const newCompleted = (newState.questLog || []).filter(q => q.status === 'completed').length;
        if (newCompleted > oldCompleted) {
            return { shouldTrigger: true, reason: 'quest_complete' };
        }
    }

    // Queue Empty (lowest priority)
    if (conditions.onQuestQueueEmpty) {
        const activeQuests = (newState.questLog || []).filter(q => q.status === 'active');
        if (activeQuests.length === 0) {
            return { shouldTrigger: true, reason: 'queue_empty' };
        }
    }

    return { shouldTrigger: false, reason: '' };
}

// ==================== QUEST HELPERS ====================

/**
 * Add quests to questLog or suggestedQuests based on auto-accept setting
 */
export function addGeneratedQuests(
    state: GameState,
    quests: Quest[],
    autoAccept: boolean,
    currentTurn: number
): GameState {
    const newState = { ...state };

    if (autoAccept) {
        // Add directly to questLog
        const questLog = newState.questLog || [];
        newState.questLog = [...questLog, ...quests];
    } else {
        // Add to suggestedQuests for user approval
        const suggestedQuests = newState.suggestedQuests || [];
        newState.suggestedQuests = [...suggestedQuests, ...quests];
    }

    // Update Quest Master tracking
    newState.questMaster = {
        lastGenerationTurn: currentTurn,
        totalQuestsGenerated: (state.questMaster?.totalQuestsGenerated || 0) + quests.length
    };

    return newState;
}

/**
 * Accept a suggested quest (move from suggestedQuests to questLog)
 */
export function acceptQuest(state: GameState, questId: string): GameState {
    const suggestedQuests = state.suggestedQuests || [];
    const quest = suggestedQuests.find(q => q.id === questId);

    if (!quest) {
        console.warn(`Quest ${questId} not found in suggested quests`);
        return state;
    }

    return {
        ...state,
        questLog: [...(state.questLog || []), { ...quest, status: 'active' as const, startedAt: Date.now() }],
        suggestedQuests: suggestedQuests.filter(q => q.id !== questId)
    };
}

/**
 * Decline a suggested quest (remove from suggestedQuests)
 */
export function declineQuest(state: GameState, questId: string): GameState {
    return {
        ...state,
        suggestedQuests: (state.suggestedQuests || []).filter(q => q.id !== questId)
    };
}

/**
 * Extract recent narrative events from chat history
 */
export function extractRecentEvents(chatHistory: Array<{ role: string; content: string }>, count: number = 5): string[] {
    return chatHistory
        .filter(msg => msg.role === 'assistant')
        .slice(-count)
        .map(msg => {
            // Extract first 200 chars as summary
            const content = msg.content.substring(0, 200);
            return content.endsWith('...') ? content : content + '...';
        });
}
