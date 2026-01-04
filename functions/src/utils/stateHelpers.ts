/**
 * State Management Utilities
 * Provides deep merge, cooldown management, and quest tracking helpers
 */

// ==================== TYPES ====================

export interface Quest {
    id: string;
    title: string;
    description: string;
    status: 'active' | 'completed' | 'failed';
    objectives?: {
        id: string;
        text: string;
        isCompleted: boolean;
    }[];
    startedAt: number;
    completedAt?: number;
    failedAt?: number;
}

export interface GameState {
    [key: string]: unknown;
    questLog?: Quest[];
    activeQuestId?: string;
    suggestedQuests?: Quest[]; // Quests awaiting user approval
    cooldowns?: { [abilityName: string]: number };
    abilities?: string[];
    spells?: string[];
    essences?: string[];
    keyNpcs?: Record<string, any>;
    character?: {
        name?: string;
        rank?: string;
        essences?: string[];
        abilities?: string[];
        [key: string]: unknown;
    };
    questMaster?: {
        lastGenerationTurn: number;
        totalQuestsGenerated: number;
    };
}

// ==================== DEEP MERGE UTILITY ====================

/**
 * Deep merge state updates while protecting immutable fields
 * 
 * IMMUTABLE FIELDS (add-only, never remove):
 * - abilities, spells, essences
 * 
 * PROTECTED FIELDS (can update nested, but not delete):
 * - keyNpcs (can add NPCs, update their stats, but not delete or change identity)
 * 
 * MUTABLE FIELDS:
 * - inventory, scrolls, hp, mana, stamina, gold, experience
 */
export function deepMergeState(
    currentState: GameState,
    updates: Partial<GameState>
): GameState {
    const result: GameState = { ...currentState };

    for (const [key, value] of Object.entries(updates)) {
        if (value === undefined) continue;

        // Handle immutable array fields (abilities, spells, essences)
        if (['abilities', 'spells', 'essences'].includes(key)) {
            if (typeof value === 'object' && value !== null && 'added' in value) {
                // Handle { added: [...], removed: [...] } format
                const current = (result[key] as string[]) || [];
                const { added = [] } = value as { added?: string[]; removed?: string[] };

                // For immutable fields, IGNORE removed operations
                const newSet = new Set([...current, ...added]);
                result[key] = Array.from(newSet);
            } else if (Array.isArray(value)) {
                // Treat as additive (union)
                const current = (result[key] as string[]) || [];
                const newSet = new Set([...current, ...value]);
                result[key] = Array.from(newSet);
            }
            continue;
        }

        // Handle protected array fields (inventory, partyMembers) - require explicit add/remove
        if (['inventory', 'partyMembers'].includes(key)) {
            if (typeof value === 'object' && value !== null && 'added' in value) {
                // Handle { added: [...], removed: [...] } format
                const current = (result[key] as string[]) || [];
                const { added = [], removed = [] } = value as { added?: string[]; removed?: string[] };

                // Apply add/remove operations
                const newSet = new Set([...current, ...added]);
                removed.forEach(item => newSet.delete(item));
                result[key] = Array.from(newSet);
            } else if (Array.isArray(value)) {
                // PROTECTION: If AI sends plain array, treat as ADD-ONLY (don't replace)
                console.warn(`[deepMergeState] Received plain array for protected field '${key}'. Treating as add-only to prevent data loss.`);
                const current = (result[key] as string[]) || [];
                const newSet = new Set([...current, ...value]);
                result[key] = Array.from(newSet);
            }
            continue;
        }

        // Handle keyNpcs (protected - can add/update but not delete)
        if (key === 'keyNpcs' && typeof value === 'object' && value !== null) {
            const currentNpcs = (result.keyNpcs as Record<string, any>) || {};
            const updatedNpcs = value as Record<string, any>;

            for (const [npcKey, npcData] of Object.entries(updatedNpcs)) {
                if (currentNpcs[npcKey]) {
                    // NPC exists - merge updates but protect identity fields
                    const existing = currentNpcs[npcKey];
                    currentNpcs[npcKey] = {
                        ...existing,
                        ...npcData,
                        // Protect identity
                        name: existing.name || npcData.name,
                        role: existing.role || npcData.role,
                    };
                } else {
                    // New NPC - add it
                    currentNpcs[npcKey] = npcData;
                }
            }
            result.keyNpcs = currentNpcs;
            continue;
        }

        // Handle character object (deep merge with protection)
        if (key === 'character' && typeof value === 'object' && value !== null) {
            const currentChar = (result.character as Record<string, any>) || {};
            const updates = value as Record<string, any>;

            result.character = {
                ...currentChar,
                ...updates,
                // Protect immutable character fields
                essences: currentChar.essences || updates.essences,
                rank: currentChar.rank || updates.rank,
                name: currentChar.name || updates.name,
            };

            // Handle character abilities specially (add-only)
            if (updates.abilities) {
                const currentAbilities = currentChar.abilities || [];
                if (typeof updates.abilities === 'object' && 'added' in updates.abilities) {
                    const { added = [] } = updates.abilities as { added?: string[] };
                    result.character.abilities = Array.from(new Set([...currentAbilities, ...added]));
                } else if (Array.isArray(updates.abilities)) {
                    result.character.abilities = Array.from(new Set([...currentAbilities, ...updates.abilities]));
                }
            }

            // Handle character inventory specially (protected - explicit add/remove only)
            if (updates.inventory) {
                const currentInventory = currentChar.inventory || [];
                if (typeof updates.inventory === 'object' && 'added' in updates.inventory) {
                    const { added = [], removed = [] } = updates.inventory as { added?: string[]; removed?: string[] };
                    const newSet = new Set([...currentInventory, ...added]);
                    removed.forEach(item => newSet.delete(item));
                    result.character.inventory = Array.from(newSet);
                } else if (Array.isArray(updates.inventory)) {
                    // PROTECTION: Treat plain array as add-only
                    console.warn('[deepMergeState] Received plain array for character.inventory. Treating as add-only.');
                    result.character.inventory = Array.from(new Set([...currentInventory, ...updates.inventory]));
                }
            }
            continue;
        }

        // Handle arrays with add/remove operations
        if (typeof value === 'object' && value !== null && 'added' in value) {
            const current = (result[key] as string[]) || [];
            const { added = [], removed = [] } = value as { added?: string[]; removed?: string[] };

            // Apply add/remove
            const newSet = new Set([...current, ...added]);
            removed.forEach(item => newSet.delete(item));
            result[key] = Array.from(newSet);
            continue;
        }

        // Handle nested objects (recursive merge)
        if (
            typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value) &&
            typeof result[key] === 'object' &&
            result[key] !== null &&
            !Array.isArray(result[key])
        ) {
            result[key] = {
                ...(result[key] as Record<string, unknown>),
                ...(value as Record<string, unknown>),
            };
            continue;
        }

        // Default: direct assignment
        result[key] = value;
    }

    return result;
}

// ==================== COOLDOWN MANAGER ====================

/**
 * Decrement all active cooldowns by 1 turn
 * Removes cooldowns that reach 0
 */
export function decrementCooldowns(state: GameState): GameState {
    if (!state.cooldowns) return state;

    const newCooldowns: { [key: string]: number } = {};

    for (const [ability, turns] of Object.entries(state.cooldowns)) {
        const remaining = turns - 1;
        if (remaining > 0) {
            newCooldowns[ability] = remaining;
        }
    }

    return {
        ...state,
        cooldowns: newCooldowns,
    };
}

/**
 * Set a cooldown for an ability
 */
export function setCooldown(
    state: GameState,
    ability: string,
    turns: number
): GameState {
    return {
        ...state,
        cooldowns: {
            ...(state.cooldowns || {}),
            [ability]: turns,
        },
    };
}

/**
 * Check if an ability is on cooldown
 */
export function isOnCooldown(state: GameState, ability: string): boolean {
    return (state.cooldowns?.[ability] || 0) > 0;
}

// ==================== QUEST HELPERS ====================

/**
 * Add a new quest to the quest log
 */
export function addQuest(state: GameState, quest: Quest): GameState {
    const questLog = state.questLog || [];

    // Check if quest already exists
    if (questLog.some(q => q.id === quest.id)) {
        console.warn(`Quest ${quest.id} already exists in quest log`);
        return state;
    }

    return {
        ...state,
        questLog: [...questLog, quest],
        activeQuestId: state.activeQuestId || quest.id, // Set as active if no active quest
    };
}

/**
 * Update a quest objective's completion status
 */
export function updateQuestObjective(
    state: GameState,
    questId: string,
    objectiveId: string,
    completed: boolean
): GameState {
    const questLog = state.questLog || [];

    const updatedLog = questLog.map(quest => {
        if (quest.id !== questId) return quest;

        const objectives = quest.objectives?.map(obj =>
            obj.id === objectiveId ? { ...obj, isCompleted: completed } : obj
        );

        return { ...quest, objectives };
    });

    return {
        ...state,
        questLog: updatedLog,
    };
}

/**
 * Set a quest's status (active, completed, failed)
 */
export function setQuestStatus(
    state: GameState,
    questId: string,
    status: 'active' | 'completed' | 'failed'
): GameState {
    const questLog = state.questLog || [];
    const now = Date.now();

    const updatedLog = questLog.map(quest => {
        if (quest.id !== questId) return quest;

        const updates: Partial<Quest> = { status };
        if (status === 'completed') updates.completedAt = now;
        if (status === 'failed') updates.failedAt = now;

        return { ...quest, ...updates };
    });

    // If completing/failing the active quest, clear activeQuestId
    const shouldClearActive = state.activeQuestId === questId && status !== 'active';

    return {
        ...state,
        questLog: updatedLog,
        activeQuestId: shouldClearActive ? undefined : state.activeQuestId,
    };
}

/**
 * Get the currently active quest
 */
export function getActiveQuest(state: GameState): Quest | undefined {
    if (!state.activeQuestId || !state.questLog) return undefined;
    return state.questLog.find(q => q.id === state.activeQuestId);
}

/**
 * Set the active quest
 */
export function setActiveQuest(state: GameState, questId: string): GameState {
    const quest = state.questLog?.find(q => q.id === questId);
    if (!quest) {
        console.warn(`Quest ${questId} not found in quest log`);
        return state;
    }

    return {
        ...state,
        activeQuestId: questId,
    };
}
