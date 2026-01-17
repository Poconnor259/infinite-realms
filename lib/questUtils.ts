import type { Quest } from './types';

/**
 * Check if a quest's prerequisites are met
 */
export function canAcceptQuest(quest: Quest, completedQuestIds: string[]): boolean {
    // If no prerequisites, quest is available
    if (!quest.prerequisiteQuestId) {
        return true;
    }

    // Check if prerequisite quest is completed
    return completedQuestIds.includes(quest.prerequisiteQuestId);
}

/**
 * Filter quests to only show available ones (prerequisites met)
 */
export function getAvailableQuests(quests: Quest[], completedQuestIds: string[]): Quest[] {
    return quests.filter(quest => canAcceptQuest(quest, completedQuestIds));
}

/**
 * Get quests that are locked due to unmet prerequisites
 */
export function getLockedQuests(quests: Quest[], completedQuestIds: string[]): Quest[] {
    return quests.filter(quest => !canAcceptQuest(quest, completedQuestIds));
}

/**
 * Get all quests in a chain, sorted by chainOrder
 */
export function getQuestChain(chainId: string, allQuests: Quest[]): Quest[] {
    return allQuests
        .filter(quest => quest.chainId === chainId)
        .sort((a, b) => (a.chainOrder || 0) - (b.chainOrder || 0));
}

/**
 * Get the progress of a quest chain (completed / total)
 */
export function getChainProgress(chainId: string, allQuests: Quest[]): { completed: number; total: number } {
    const chainQuests = getQuestChain(chainId, allQuests);
    const completed = chainQuests.filter(q => q.completed).length;
    return {
        completed,
        total: chainQuests.length
    };
}

/**
 * Check if a quest has expired
 */
export function isQuestExpired(quest: Quest, currentTimestamp: number): boolean {
    if (!quest.expiresAt) {
        return false;
    }
    return currentTimestamp > quest.expiresAt;
}

/**
 * Get remaining time for a timed quest in milliseconds
 */
export function getQuestTimeRemaining(quest: Quest, currentTimestamp: number): number | null {
    if (!quest.expiresAt) {
        return null;
    }
    const remaining = quest.expiresAt - currentTimestamp;
    return remaining > 0 ? remaining : 0;
}

/**
 * Format time remaining as a human-readable string
 */
export function formatTimeRemaining(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

/**
 * Get the next quest in a chain
 */
export function getNextQuestInChain(currentQuest: Quest, allQuests: Quest[]): Quest | null {
    if (!currentQuest.chainId || !currentQuest.chainOrder) {
        return null;
    }

    return allQuests.find(
        q => q.chainId === currentQuest.chainId && q.chainOrder === (currentQuest.chainOrder || 0) + 1
    ) || null;
}

/**
 * Check if this is the first quest in a chain
 */
export function isFirstInChain(quest: Quest): boolean {
    return !!quest.chainId && quest.chainOrder === 1;
}

/**
 * Check if this is the last quest in a chain
 */
export function isLastInChain(quest: Quest, allQuests: Quest[]): boolean {
    if (!quest.chainId || !quest.chainOrder) {
        return false;
    }

    const chainQuests = getQuestChain(quest.chainId, allQuests);
    const maxOrder = Math.max(...chainQuests.map(q => q.chainOrder || 0));
    return quest.chainOrder === maxOrder;
}
