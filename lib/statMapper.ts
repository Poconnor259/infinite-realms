// Stat mapping utility for world-specific stat systems
// Maps D&D-style stats to world-appropriate equivalents

export type WorldModuleType = 'classic' | 'outworlder' | 'tactical';

interface StatMapping {
    stat: string;      // Actual stat field name in character object
    display: string;   // Display name for UI
}

const STAT_MAPPINGS: Record<WorldModuleType, Record<string, StatMapping>> = {
    classic: {
        // D&D 5E - Direct mappings
        STR: { stat: 'STR', display: 'Strength' },
        DEX: { stat: 'DEX', display: 'Dexterity' },
        CON: { stat: 'CON', display: 'Constitution' },
        INT: { stat: 'INT', display: 'Intelligence' },
        WIS: { stat: 'WIS', display: 'Wisdom' },
        CHA: { stat: 'CHA', display: 'Charisma' },
        // Also accept full names
        Strength: { stat: 'STR', display: 'Strength' },
        Dexterity: { stat: 'DEX', display: 'Dexterity' },
        Constitution: { stat: 'CON', display: 'Constitution' },
        Intelligence: { stat: 'INT', display: 'Intelligence' },
        Wisdom: { stat: 'WIS', display: 'Wisdom' },
        Charisma: { stat: 'CHA', display: 'Charisma' },
    },
    outworlder: {
        // D&D stat mappings to Outworlder equivalents
        STR: { stat: 'power', display: 'Power' },
        DEX: { stat: 'speed', display: 'Speed' },
        CON: { stat: 'spirit', display: 'Spirit' },
        WIS: { stat: 'recovery', display: 'Recovery' },
        // Fallback mappings (no direct equivalent)
        INT: { stat: 'spirit', display: 'Spirit' },      // Mental → Spirit
        CHA: { stat: 'recovery', display: 'Recovery' },  // Social → Recovery
        // Native stat names (Brain should use these)
        power: { stat: 'power', display: 'Power' },
        speed: { stat: 'speed', display: 'Speed' },
        spirit: { stat: 'spirit', display: 'Spirit' },
        recovery: { stat: 'recovery', display: 'Recovery' },
        Power: { stat: 'power', display: 'Power' },
        Speed: { stat: 'speed', display: 'Speed' },
        Spirit: { stat: 'spirit', display: 'Spirit' },
        Recovery: { stat: 'recovery', display: 'Recovery' },
    },
    tactical: {
        // D&D stat mappings to Tactical equivalents
        STR: { stat: 'strength', display: 'Strength' },
        DEX: { stat: 'agility', display: 'Agility' },
        CON: { stat: 'vitality', display: 'Vitality' },
        INT: { stat: 'intelligence', display: 'Intelligence' },
        WIS: { stat: 'perception', display: 'Perception' },
        // Fallback (no CHA equivalent)
        CHA: { stat: 'perception', display: 'Perception' },  // Social awareness
        // Native stat names
        strength: { stat: 'strength', display: 'Strength' },
        agility: { stat: 'agility', display: 'Agility' },
        vitality: { stat: 'vitality', display: 'Vitality' },
        intelligence: { stat: 'intelligence', display: 'Intelligence' },
        perception: { stat: 'perception', display: 'Perception' },
        Strength: { stat: 'strength', display: 'Strength' },
        Agility: { stat: 'agility', display: 'Agility' },
        Vitality: { stat: 'vitality', display: 'Vitality' },
        Intelligence: { stat: 'intelligence', display: 'Intelligence' },
        Perception: { stat: 'perception', display: 'Perception' },
    }
};

/**
 * Map a stat name to the world-appropriate equivalent
 * @param worldModule - The world module type
 * @param requestedStat - The stat name from Brain (could be D&D or native)
 * @returns Mapped stat field name and display name
 */
export function mapStat(worldModule: WorldModuleType, requestedStat: string): StatMapping {
    const mapping = STAT_MAPPINGS[worldModule];

    // Try exact match first
    if (mapping[requestedStat]) {
        return mapping[requestedStat];
    }

    // Try case-insensitive match
    const upperKey = requestedStat.toUpperCase();
    if (mapping[upperKey]) {
        return mapping[upperKey];
    }

    // Fallback: return as-is (shouldn't happen if Brain follows instructions)
    console.warn(`[StatMapper] Unknown stat "${requestedStat}" for world "${worldModule}"`);
    return { stat: requestedStat, display: requestedStat };
}

/**
 * Get stat value from character stats object
 * @param worldModule - The world module type
 * @param requestedStat - The stat name from Brain
 * @param characterStats - The character's stats object
 * @returns The stat value, or 10 (neutral) if not found
 */
export function getStatValue(
    worldModule: WorldModuleType,
    requestedStat: string,
    characterStats: Record<string, number>
): number {
    const mapped = mapStat(worldModule, requestedStat);
    const value = characterStats[mapped.stat];

    if (value === undefined) {
        console.warn(`[StatMapper] Stat "${mapped.stat}" not found in character stats`);
        return 10; // Neutral modifier (0)
    }

    return value;
}

/**
 * Calculate D&D-style modifier from stat value
 * @param statValue - The raw stat value
 * @returns The modifier: (stat - 10) / 2, rounded down
 */
export function calculateModifier(statValue: number): number {
    return Math.floor((statValue - 10) / 2);
}

/**
 * Get world-specific stat context for Brain AI
 * @param worldModule - The world module type
 * @returns Instruction text for Brain prompt
 */
export function getWorldStatContext(worldModule: WorldModuleType): string {
    switch (worldModule) {
        case 'classic':
            return 'Use D&D 5E stats: STR (Strength), DEX (Dexterity), CON (Constitution), INT (Intelligence), WIS (Wisdom), CHA (Charisma).';
        case 'outworlder':
            return 'Use Outworlder stats ONLY: power, speed, spirit, recovery. NEVER use D&D stat names (STR/DEX/etc).';
        case 'tactical':
            return 'Use Tactical stats ONLY: strength, agility, vitality, intelligence, perception. NEVER use D&D stat names (STR/DEX/etc).';
        default:
            return '';
    }
}
