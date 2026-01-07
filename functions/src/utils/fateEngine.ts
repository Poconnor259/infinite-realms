/**
 * Fate Engine v1.3
 * Core logic for D&D 5E dice mechanics with Karmic Weighting
 */

import type {
    FateEngineState,
    DifficultyTier,
    AdvantageState,
    ModifierBreakdown,
    FateEngineDiceRoll,
    ModuleCharacter,
    ClassicCharacter,
    OutworlderCharacter,
    TacticalCharacter
} from '../../../lib/types';

// ==================== HELPER FUNCTIONS ====================

/**
 * Calculate D&D 5E stat modifier: (Stat - 10) / 2 (rounded down)
 */
export function getStatModifier(statValue: number): number {
    return Math.floor((statValue - 10) / 2);
}

/**
 * Map world-specific stats to D&D 5E equivalents for universal roll processing
 */
export function mapStatToD20Equivalent(
    character: ModuleCharacter,
    stat: string
): number {
    // Classic already uses D&D 5E stats
    if ('stats' in character && 'STR' in character.stats) {
        const classicChar = character as ClassicCharacter;
        const statUpper = stat.toUpperCase();
        if (statUpper in classicChar.stats) {
            return classicChar.stats[statUpper as keyof typeof classicChar.stats];
        }
    }

    // Outworlder: Map custom stats to D&D equivalents
    if ('stats' in character && 'power' in character.stats) {
        const outworlderChar = character as OutworlderCharacter;
        const statMap: Record<string, keyof typeof outworlderChar.stats> = {
            'STR': 'power',
            'DEX': 'speed',
            'CON': 'stamina',
            'INT': 'power',
            'WIS': 'recovery',
            'CHA': 'power'
        };
        const mappedStat = statMap[stat.toUpperCase()];
        if (mappedStat) {
            return outworlderChar.stats[mappedStat];
        }
    }

    // Tactical: Map custom stats to D&D equivalents
    if ('stats' in character && 'strength' in character.stats) {
        const tacticalChar = character as TacticalCharacter;
        const statMap: Record<string, keyof typeof tacticalChar.stats> = {
            'STR': 'strength',
            'DEX': 'agility',
            'CON': 'vitality',
            'INT': 'intelligence',
            'WIS': 'perception',
            'CHA': 'intelligence'
        };
        const mappedStat = statMap[stat.toUpperCase()];
        if (mappedStat) {
            return tacticalChar.stats[mappedStat];
        }
    }

    // Fallback: assume stat value of 10 (modifier +0)
    return 10;
}

// ==================== 2.1 STREAK BREAKER (BAD LUCK PROTECTION) ====================

export interface MomentumResult {
    adjustedRoll: number;
    newMomentum: number;
    streakBreakerActive: boolean;
}

/**
 * Apply Karmic Weighting to prevent frustrating miss streaks
 * - On Miss (roll < 8): momentum_counter += 2
 * - On Hit (roll > 12): momentum_counter = 0
 * - Adjustment: Raw_Roll + momentum_counter = Adjusted_Roll
 * - Constraint: Cannot exceed 20 (no forced Crits)
 */
export function calculateMomentumAdjustment(
    rawRoll: number,
    currentMomentum: number
): MomentumResult {
    let adjustedRoll = Math.min(20, rawRoll + currentMomentum);
    let newMomentum = currentMomentum;
    const streakBreakerActive = currentMomentum > 0;

    // Update momentum based on result
    if (rawRoll < 8) {
        newMomentum = Math.min(10, currentMomentum + 2); // Cap at +10
    } else if (rawRoll > 12) {
        newMomentum = 0; // Reset on good roll
    }

    return {
        adjustedRoll,
        newMomentum,
        streakBreakerActive
    };
}

// ==================== 2.2 CRITICAL HIT LOGIC ====================

export interface CriticalResult {
    isCrit: boolean;
    isFumble: boolean;
    rerolled: boolean;
    finalRoll: number;
}

/**
 * Process critical hit and fumble logic with Pity Crit and Fumble Protection
 * - Standard Crit: Natural 20
 * - Pity Crit: If last_crit_turn_count > 40, Natural 19 = Natural 20
 * - Fumble Protection: If momentum > 4, reroll Natural 1 once
 */
export function processCriticalLogic(
    rawRoll: number,
    lastCritTurnCount: number,
    momentum: number
): CriticalResult {
    let finalRoll = rawRoll;
    let isCrit = false;
    let isFumble = false;
    let rerolled = false;

    // Check for Natural 20 (always a crit)
    if (rawRoll === 20) {
        isCrit = true;
    }
    // Pity Crit: Natural 19 becomes Natural 20 after 40 turns
    else if (rawRoll === 19 && lastCritTurnCount > 40) {
        isCrit = true;
    }
    // Fumble Protection: Reroll Natural 1 if momentum > 4
    else if (rawRoll === 1 && momentum > 4) {
        // Reroll once
        const rerollResult = Math.floor(Math.random() * 20) + 1;
        finalRoll = rerollResult;
        rerolled = true;

        // Check if second roll is also a 1
        if (rerollResult === 1) {
            isFumble = true;
        } else if (rerollResult === 20) {
            isCrit = true;
        }
    }
    // Standard Fumble: Natural 1 without protection
    else if (rawRoll === 1) {
        isFumble = true;
    }

    return {
        isCrit,
        isFumble,
        rerolled,
        finalRoll
    };
}

// ==================== 3.1 ADVANTAGE & DISADVANTAGE ====================

/**
 * Resolve Advantage/Disadvantage state
 * - If both exist, they cancel (Straight roll)
 * - Otherwise, return the applicable state
 */
export function resolveAdvantageState(
    advantageSources: string[],
    disadvantageSources: string[]
): AdvantageState {
    const hasAdvantage = advantageSources.length > 0;
    const hasDisadvantage = disadvantageSources.length > 0;

    if (hasAdvantage && hasDisadvantage) {
        return 'straight'; // They cancel
    } else if (hasAdvantage) {
        return 'advantage';
    } else if (hasDisadvantage) {
        return 'disadvantage';
    }

    return 'straight';
}

/**
 * Roll with Advantage/Disadvantage
 * - Advantage: max(roll1, roll2)
 * - Disadvantage: min(roll1, roll2)
 * - Straight: single roll
 */
export function rollWithAdvantage(advantageState: AdvantageState): {
    rawRolls: number[];
    selectedBase: number;
} {
    if (advantageState === 'straight') {
        const roll = Math.floor(Math.random() * 20) + 1;
        return { rawRolls: [roll], selectedBase: roll };
    }

    const roll1 = Math.floor(Math.random() * 20) + 1;
    const roll2 = Math.floor(Math.random() * 20) + 1;

    const selectedBase = advantageState === 'advantage'
        ? Math.max(roll1, roll2)
        : Math.min(roll1, roll2);

    return { rawRolls: [roll1, roll2], selectedBase };
}

// ==================== 3.2 MODIFIER STACK ====================

/**
 * Calculate the full modifier breakdown for a roll
 */
export function calculateModifierStack(
    character: ModuleCharacter,
    stat: string,
    proficiencyApplies: boolean,
    itemBonus: number = 0,
    situationalMod: number = 0,
    momentumMod: number = 0
): ModifierBreakdown {
    // Get stat value and calculate modifier
    const statValue = mapStatToD20Equivalent(character, stat);
    const stat_mod = getStatModifier(statValue);

    // Get proficiency bonus (Classic has it, others default to level-based)
    let proficiency = 0;
    if (proficiencyApplies) {
        if ('proficiencyBonus' in character) {
            proficiency = (character as ClassicCharacter).proficiencyBonus;
        } else {
            // Level-based proficiency for other worlds
            const level = character.level || 1;
            proficiency = Math.floor((level - 1) / 4) + 2; // 1-4: +2, 5-8: +3, etc.
        }
    }

    const total = stat_mod + proficiency + itemBonus + situationalMod + momentumMod;

    return {
        stat_mod,
        proficiency,
        item_bonus: itemBonus,
        situational_mod: situationalMod,
        momentum_mod: momentumMod,
        total
    };
}

// ==================== 3.4 DC TIER CLASSIFICATION ====================

/**
 * Classify DC into difficulty tiers for UI color coding
 */
export function getDifficultyTier(dc: number): DifficultyTier {
    if (dc <= 4) return 'trivial';
    if (dc <= 9) return 'very_easy';
    if (dc <= 14) return 'easy';
    if (dc <= 17) return 'moderate';
    if (dc <= 19) return 'hard';
    return 'heroic';
}

// ==================== MAIN FATE ENGINE FUNCTION ====================

export interface FateEngineRollParams {
    character: ModuleCharacter;
    fateEngine: FateEngineState;
    rollType: 'attack' | 'save' | 'skill' | 'ability' | 'damage';
    stat: string;
    dc?: number;
    proficiencyApplies: boolean;
    itemBonus?: number;
    situationalMod?: number;
    advantageSources?: string[];
    disadvantageSources?: string[];
}

export interface FateEngineRollResult {
    roll: FateEngineDiceRoll;
    updatedFateEngine: FateEngineState;
}

/**
 * Main Fate Engine roll processor
 * Combines all D&D 5E mechanics with Karmic Weighting
 */
export function processFateEngineRoll(params: FateEngineRollParams): FateEngineRollResult {
    const {
        character,
        fateEngine,
        rollType,
        stat,
        dc,
        proficiencyApplies,
        itemBonus = 0,
        situationalMod = 0,
        advantageSources = [],
        disadvantageSources = []
    } = params;

    // 1. Resolve Advantage/Disadvantage
    const advantageState = resolveAdvantageState(advantageSources, disadvantageSources);

    // 2. Roll dice
    const { rawRolls, selectedBase } = rollWithAdvantage(advantageState);

    // 3. Apply Momentum Adjustment
    const momentumResult = calculateMomentumAdjustment(
        selectedBase,
        fateEngine.momentum_counter
    );

    // 4. Process Critical Logic
    const critResult = processCriticalLogic(
        momentumResult.adjustedRoll,
        fateEngine.last_crit_turn_count,
        fateEngine.momentum_counter
    );

    // 5. Calculate Modifier Stack
    const modifiers = calculateModifierStack(
        character,
        stat,
        proficiencyApplies,
        itemBonus,
        situationalMod,
        momentumResult.streakBreakerActive ? momentumResult.newMomentum - fateEngine.momentum_counter : 0
    );

    // 6. Calculate Final Total
    const finalTotal = critResult.finalRoll + modifiers.total;

    // 7. Determine Success/Failure
    const success = dc !== undefined ? finalTotal >= dc : true;
    const margin = dc !== undefined ? finalTotal - dc : undefined;

    // 8. Update Fate Engine State
    const updatedFateEngine: FateEngineState = {
        momentum_counter: momentumResult.newMomentum,
        last_crit_turn_count: critResult.isCrit ? 0 : fateEngine.last_crit_turn_count + 1,
        director_mode_cooldown: fateEngine.director_mode_cooldown
    };

    // 9. Build Fate Engine Dice Roll
    const roll: FateEngineDiceRoll = {
        type: 'd20',
        result: selectedBase,
        modifier: modifiers.total,
        total: finalTotal,
        purpose: `${rollType} roll`,
        rollType,
        raw_rolls: rawRolls,
        selected_base: selectedBase,
        state_flags: {
            advantage: advantageState === 'advantage',
            disadvantage: advantageState === 'disadvantage',
            is_crit: critResult.isCrit,
            is_fumble: critResult.isFumble,
            streak_breaker_active: momentumResult.streakBreakerActive,
            fumble_rerolled: critResult.rerolled
        },
        math: modifiers,
        outcome: dc !== undefined ? {
            target_dc: dc,
            difficulty_tier: getDifficultyTier(dc),
            success,
            margin,
            narrative_tag: success ? 'Hit' : 'Miss'
        } : undefined
    };

    return {
        roll,
        updatedFateEngine
    };
}

// ==================== INITIALIZATION ====================

/**
 * Initialize Fate Engine state for new campaigns
 */
export function initializeFateEngine(): FateEngineState {
    return {
        momentum_counter: 0,
        last_crit_turn_count: 0,
        director_mode_cooldown: false
    };
}
