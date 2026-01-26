/**
 * Unified XP System (v2.0)
 * Shared logic for all three worlds: Classic, Outworlder, Praxis.
 * 
 * CORE PHILOSOPHY:
 * - Internal Level 1-60 is the source of truth.
 * - Display Level is mapped based on World Type.
 * - XP Formula: Base * Tier
 */

// ==================== TYPES ====================

export type WorldType = 'classic' | 'outworlder' | 'tactical' | 'praxis';

export interface LevelInfo {
    internalLevel: number;
    tier: number;           // 1-6
    tierLevel: number;      // 1-10
    displayRank: string;    // "Silver 3", "RED-5", "Level 14"
    xpRequired: number;     // For NEXT level
    xpMinForLevel: number;  // Cumulative XP required to reach this level
}

export interface EnemyXPResult {
    xp: number;
    isTierBonus: boolean;
    modifier: number;
}

// ==================== CONSTANTS ====================

const TIER_NAMES = {
    outworlder: ['Iron', 'Bronze', 'Silver', 'Gold', 'Diamond', 'Transcendent'],
    praxis: ['GREEN', 'YELLOW', 'ORANGE', 'RED', 'BLACK', 'OMEGA'],
    // Valdoria uses logic: Level 1-20, then Epic, then Legendary
    classic: {
        tiers: ['Level', 'Level', 'Epic', 'Epic', 'Legendary', 'Legendary'],
        flatMax: 20 // Levels 1-20 display as "Level X"
    }
};

const MONSTER_XP_BASE = {
    1: { minion: 50, standard: 100, elite: 200, champion: 400, boss: 1000 },
    2: { minion: 100, standard: 200, elite: 400, champion: 800, boss: 2000 },
    3: { minion: 150, standard: 300, elite: 600, champion: 1200, boss: 3000 },
    4: { minion: 200, standard: 400, elite: 800, champion: 1600, boss: 4000 },
    5: { minion: 300, standard: 600, elite: 1200, champion: 2400, boss: 6000 },
    6: { minion: 500, standard: 1000, elite: 2000, champion: 4000, boss: 10000 }
};

// ==================== CORE FUNCTIONS ====================

/**
 * Get Tier (1-6) from Internal Level (1-60)
 */
export function getTier(internalLevel: number): number {
    return Math.ceil(Math.max(1, internalLevel) / 10);
}

/**
 * Get Level within Level (1-10)
 */
export function getTierLevel(internalLevel: number): number {
    return ((Math.max(1, internalLevel) - 1) % 10) + 1;
}

/**
 * Calculate XP Required for NEXT Level
 * Formula: Base * Tier_Multiplier
 * Base = (tier_level + 1) * 500
 */
export function getXPRequiredForNextLevel(internalLevel: number): number {
    if (internalLevel >= 60) return 0; // Max level

    const tier = getTier(internalLevel);
    const tierLevel = getTierLevel(internalLevel);

    // Base formula from doc: (tier_level + 1) * 500
    const base = (tierLevel + 1) * 500;

    // Multiplier = Tier Number
    return base * tier;
}

/**
 * Get Cumulative XP required to reach a specific level
 * Useful for recalculating level from total XP
 */
export function getCumulativeXPForLevel(targetLevel: number): number {
    let total = 0;
    for (let i = 1; i < targetLevel; i++) {
        total += getXPRequiredForNextLevel(i);
    }
    return total;
}

/**
 * Calculate Level from Total XP
 * Returns the highest level reachable with the given XP
 */
export function getLevelFromXP(totalXP: number): number {
    let level = 1;
    let xp = totalXP;

    while (level < 60) {
        const required = getXPRequiredForNextLevel(level);
        if (xp >= required) {
            xp -= required;
            level++;
        } else {
            break;
        }
    }
    return level;
}

/**
 * Get Display Rank String
 * e.g., "Silver 3", "RED-5", "Level 14"
 */
export function getDisplayRank(internalLevel: number, worldType: string): string {
    const tier = getTier(internalLevel);
    const tierLevel = getTierLevel(internalLevel);
    const normalizedWorld = worldType.toLowerCase();

    if (normalizedWorld === 'praxis' || normalizedWorld === 'tactical') {
        const name = TIER_NAMES.praxis[tier - 1] || 'UNKNOWN';
        return `${name}-${tierLevel}`;
    }

    if (normalizedWorld === 'outworlder') {
        const name = TIER_NAMES.outworlder[tier - 1] || 'Unknown';
        return `${name} ${tierLevel}`;
    }

    if (normalizedWorld === 'classic' || normalizedWorld === 'valdoria') {
        if (internalLevel <= 20) {
            return `Level ${internalLevel}`;
        }
        // Epic (21-40) and Legendary (41-60) logic
        // Doc says: 21-30 is Epic 1-10, 31-40 is Epic 11-20
        // Wait, doc says: 
        // Tier 3 (21-30): Epic 1-10
        // Tier 4 (31-40): Epic 11-20
        // Tier 5 (41-50): Legendary 1-10
        // Tier 6 (51-60): Legendary 11-20

        let rankName = 'Epic';
        let subLevel = internalLevel - 20;

        if (internalLevel > 40) {
            rankName = 'Legendary';
            subLevel = internalLevel - 40;
        }

        return `${rankName} ${subLevel}`;
    }

    return `Level ${internalLevel}`;
}

/**
 * Calculate XP Award for Enemy Kill
 */
export function getEnemyXP(
    playerInternalLevel: number,
    enemyTier: number, // 1-6
    enemyType: 'minion' | 'standard' | 'elite' | 'champion' | 'boss'
): EnemyXPResult {
    const playerTier = getTier(playerInternalLevel);

    // 1. Get Base XP
    const tierTable = MONSTER_XP_BASE[enemyTier as keyof typeof MONSTER_XP_BASE];
    if (!tierTable) return { xp: 0, isTierBonus: false, modifier: 0 };

    const baseXP = tierTable[enemyType] || 0;

    // 2. Calculate Modifier
    const diff = enemyTier - playerTier;
    let modifier = 1.0;

    if (diff <= -2) modifier = 0.1;      // Trivial
    else if (diff === -1) modifier = 0.5; // Easy
    else if (diff === 0) modifier = 1.0;  // Fair
    else if (diff === 1) modifier = 1.25; // Hard
    else if (diff >= 2) modifier = 1.5;   // Heroic

    return {
        xp: Math.floor(baseXP * modifier),
        isTierBonus: diff > 0,
        modifier
    };
}
