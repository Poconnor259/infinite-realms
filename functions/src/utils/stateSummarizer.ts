/**
 * State Summarization Utility
 * Reduces the size of state payloads sent to AI by summarizing or omitting non-essential data
 */

import { GameState } from './stateHelpers';

/**
 * Summarize game state for AI context
 * Reduces payload size by ~60-70% while preserving critical information
 */
export function summarizeStateForAI(fullState: GameState): Partial<GameState> {
    const summarized: Partial<GameState> = {};

    // Always include character (but summarize inventory)
    if (fullState.character) {
        summarized.character = {
            ...fullState.character,
            // Summarize inventory - only include equipped items and count
            inventory: fullState.character.inventory ? {
                equipped: (fullState.character.inventory as any).equipped || {},
                itemCount: Object.keys((fullState.character.inventory as any).items || {}).length,
                // Include only key items, not full inventory
                keyItems: Object.entries((fullState.character.inventory as any).items || {})
                    .filter(([_, item]: [string, any]) => item.isKeyItem || item.isQuestItem)
                    .reduce((acc, [id, item]) => ({ ...acc, [id]: item }), {})
            } : undefined
        };
    }

    // Include current location and recent locations (not full history)
    if (fullState.location) {
        summarized.location = fullState.location;
    }
    if (fullState.locationHistory && Array.isArray(fullState.locationHistory)) {
        summarized.locationHistory = fullState.locationHistory.slice(-5); // Last 5 locations only
    }

    // Include active quests (but not completed quest details)
    if (fullState.quests) {
        const quests = fullState.quests as any;
        summarized.quests = {
            active: quests.active || [],
            available: quests.available || [],
            completedCount: (quests.completed || []).length,
            // Don't send full completed quest data
        };
    }

    // Include combat state if active
    if (fullState.combat) {
        summarized.combat = fullState.combat;
    }

    // Include Fate Engine state
    if (fullState.fateEngine) {
        summarized.fateEngine = fullState.fateEngine;
    }

    // Include world-specific state (but summarize large nested objects)
    if (fullState.worldState) {
        summarized.worldState = fullState.worldState;
    }

    // Include flags and counters (usually small)
    if (fullState.flags) {
        summarized.flags = fullState.flags;
    }

    // Include pending actions/rolls
    if (fullState.pendingRoll) {
        summarized.pendingRoll = fullState.pendingRoll;
    }
    if (fullState.pendingChoice) {
        summarized.pendingChoice = fullState.pendingChoice;
    }

    return summarized;
}

/**
 * Calculate state delta between old and new state
 * Returns only the fields that changed
 */
export function calculateStateDelta(
    oldState: Record<string, unknown>,
    newState: Record<string, unknown>
): Record<string, unknown> {
    const delta: Record<string, unknown> = {};

    for (const key in newState) {
        if (JSON.stringify(oldState[key]) !== JSON.stringify(newState[key])) {
            delta[key] = newState[key];
        }
    }

    return delta;
}

/**
 * Estimate payload size in bytes
 */
export function estimatePayloadSize(obj: unknown): number {
    return JSON.stringify(obj).length;
}

/**
 * Log state size comparison for debugging
 */
export function logStateSizeComparison(fullState: GameState, summarized: Partial<GameState>) {
    const fullSize = estimatePayloadSize(fullState);
    const summarizedSize = estimatePayloadSize(summarized);
    const reduction = ((1 - summarizedSize / fullSize) * 100).toFixed(1);

    console.log(`[State] Full size: ${fullSize} bytes, Summarized: ${summarizedSize} bytes (${reduction}% reduction)`);
}
