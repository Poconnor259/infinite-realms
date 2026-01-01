/**
 * Character Data Normalization Layer
 * 
 * Standardizes character data across different world types into a consistent format.
 * This ensures the unified character panel can display data regardless of the source format.
 */

// ==================== TYPES ====================

export interface NormalizedResource {
    current: number;
    max: number;
    name: string;
    color?: string;
    icon?: string;
}

export interface NormalizedStat {
    id: string;
    name: string;
    value: number;
    abbreviation?: string;
    icon?: string;
}

export interface NormalizedAbility {
    name: string;
    type?: string;
    cooldown?: number;
    currentCooldown?: number;
    description?: string;
    rank?: string;
    essence?: string;
    cost?: string;
    costAmount?: number;
}

export interface NormalizedItem {
    id?: string;
    name: string;
    quantity?: number;
    type?: string;
    equipped?: boolean;
    rank?: string;
}

export interface NormalizedCharacter {
    // Core identity
    name: string;
    level: number;
    rank?: string;
    class?: string;
    race?: string;

    // Resources (health, mana, stamina, etc.)
    resources: NormalizedResource[];

    // Stats (STR, DEX, etc.)
    stats: NormalizedStat[];

    // Abilities/Skills
    abilities: NormalizedAbility[];

    // Inventory
    inventory: NormalizedItem[];

    // Quests
    quests: any[];
    suggestedQuests: any[];

    // World-specific extras (essences, confluence, etc.)
    extras: Record<string, any>;
}

// ==================== NORMALIZATION FUNCTION ====================

export function normalizeCharacter(rawCharacter: any, worldType: string, questLog: any[] = [], suggestedQuests: any[] = []): NormalizedCharacter {
    if (!rawCharacter) {
        return getEmptyCharacter();
    }

    // Extract basic info
    const name = rawCharacter.name || 'Unknown';
    const level = rawCharacter.level || 1;
    const rank = rawCharacter.rank || undefined;
    const characterClass = rawCharacter.class || rawCharacter.job || undefined;
    const race = rawCharacter.race || undefined;

    // Normalize resources based on world type
    const resources = normalizeResources(rawCharacter, worldType);

    // Normalize stats based on world type
    const stats = normalizeStats(rawCharacter, worldType);

    // Normalize abilities
    const abilities = normalizeAbilities(rawCharacter);

    // Normalize inventory
    const inventory = normalizeInventory(rawCharacter);

    // Extract world-specific extras
    const extras = extractExtras(rawCharacter, worldType);

    return {
        name,
        level,
        rank,
        class: characterClass,
        race,
        resources,
        stats,
        abilities,
        inventory,
        quests: Array.isArray(questLog) ? questLog : [],
        suggestedQuests: Array.isArray(suggestedQuests) ? suggestedQuests : [],
        extras,
    };
}

// ==================== RESOURCE NORMALIZATION ====================

function normalizeResources(char: any, worldType: string): NormalizedResource[] {
    const resources: NormalizedResource[] = [];

    // Health (various possible field names)
    const health = extractResource(char, ['hp', 'health', 'hitPoints']);
    if (health) {
        resources.push({
            ...health,
            name: 'Health',
            color: '#ef4444', // Red
            icon: '❤️',
        });
    }

    // Mana/Nanites (world-specific naming)
    const mana = extractResource(char, ['mana', 'mp', 'nanites', 'energy', 'nc']);
    if (mana) {
        const worldLower = worldType.toLowerCase();
        const manaName = worldLower === 'tactical' || worldLower === 'praxis' ? 'Nanites' : 'Mana';
        resources.push({
            ...mana,
            name: manaName,
            color: '#3b82f6', // Blue
            icon: '💧',
        });
    }

    // Stamina/Spirit/Focus
    const stamina = extractResource(char, ['stamina', 'spirit', 'focus', 'fatigue']);
    if (stamina) {
        const worldLower = worldType.toLowerCase();
        const staminaName = worldLower === 'outworlder' ? 'Stamina' :
            worldLower === 'tactical' || worldLower === 'praxis' ? 'Focus' : 'Stamina';
        resources.push({
            ...stamina,
            name: staminaName,
            color: '#22c55e', // Green
            icon: '⚡',
        });
    }

    // Check for resources object (generic engine format)
    if (char.resources && typeof char.resources === 'object') {
        for (const [key, value] of Object.entries(char.resources)) {
            // Skip if we already have this resource
            if (resources.some(r => r.name.toLowerCase() === key.toLowerCase())) continue;

            const res = value as any;
            if (res && typeof res.current === 'number' && typeof res.max === 'number') {
                resources.push({
                    current: res.current,
                    max: res.max,
                    name: capitalizeFirst(key),
                    color: res.color || '#8b5cf6',
                });
            }
        }
    }

    return resources;
}

function extractResource(char: any, possibleKeys: string[]): { current: number; max: number } | null {
    for (const key of possibleKeys) {
        const value = char[key];
        if (value && typeof value === 'object' && 'current' in value && 'max' in value) {
            return {
                current: value.current ?? 0,
                max: value.max ?? 100,
            };
        }
    }
    return null;
}

// ==================== STAT NORMALIZATION ====================

function normalizeStats(char: any, worldType: string): NormalizedStat[] {
    const stats: NormalizedStat[] = [];

    // Check for stats object
    if (char.stats && typeof char.stats === 'object') {
        for (const [key, value] of Object.entries(char.stats)) {
            if (typeof value === 'number') {
                const statInfo = getStatInfo(key, worldType);
                stats.push({
                    id: key,
                    name: statInfo.name,
                    value: value,
                    abbreviation: statInfo.abbreviation,
                    icon: statInfo.icon,
                });
            }
        }
    }

    // Check for individual stat fields (Classic D&D style)
    const classicStats = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
    for (const statKey of classicStats) {
        if (typeof char[statKey] === 'number' && !stats.some(s => s.id === statKey)) {
            const statInfo = getStatInfo(statKey, worldType);
            stats.push({
                id: statKey,
                name: statInfo.name,
                value: char[statKey],
                abbreviation: statInfo.abbreviation,
                icon: statInfo.icon,
            });
        }
    }

    // Check for Outworlder-style stats (PWR, SPD, STA, REC)
    const outworlderStats = ['power', 'speed', 'stamina', 'recovery'];
    for (const statKey of outworlderStats) {
        if (typeof char[statKey] === 'number' && !stats.some(s => s.id === statKey)) {
            const statInfo = getStatInfo(statKey, worldType);
            stats.push({
                id: statKey,
                name: statInfo.name,
                value: char[statKey],
                abbreviation: statInfo.abbreviation,
            });
        }
    }

    return stats;
}

function getStatInfo(key: string, worldType: string): { name: string; abbreviation: string; icon?: string } {
    const statMap: Record<string, { name: string; abbreviation: string; icon?: string }> = {
        // D&D style
        strength: { name: 'Strength', abbreviation: 'STR', icon: '💪' },
        dexterity: { name: 'Dexterity', abbreviation: 'DEX', icon: '🏃' },
        constitution: { name: 'Constitution', abbreviation: 'CON', icon: '🛡️' },
        intelligence: { name: 'Intelligence', abbreviation: 'INT', icon: '🧠' },
        wisdom: { name: 'Wisdom', abbreviation: 'WIS', icon: '👁️' },
        charisma: { name: 'Charisma', abbreviation: 'CHA', icon: '✨' },

        // Outworlder style
        power: { name: 'Power', abbreviation: 'PWR' },
        speed: { name: 'Speed', abbreviation: 'SPD' },
        stamina: { name: 'Stamina', abbreviation: 'STA' },
        spirit: { name: 'Stamina', abbreviation: 'STA' }, // Backward compatibility mapping
        recovery: { name: 'Recovery', abbreviation: 'REC' },

        // Tactical/Praxis style
        combat: { name: 'Combat', abbreviation: 'COM', icon: '🎯' },
        tactics: { name: 'Tactics', abbreviation: 'TAC', icon: '🧠' },
        stealth: { name: 'Stealth', abbreviation: 'STL', icon: '👤' },
        leadership: { name: 'Leadership', abbreviation: 'LDR', icon: '⭐' },
    };

    const lowerKey = key.toLowerCase();
    return statMap[lowerKey] || { name: capitalizeFirst(key), abbreviation: key.slice(0, 3).toUpperCase() };
}

// ==================== ABILITY NORMALIZATION ====================

function normalizeAbilities(char: any): NormalizedAbility[] {
    const abilities: NormalizedAbility[] = [];

    // Standard abilities array
    if (Array.isArray(char.abilities)) {
        for (const ability of char.abilities) {
            if (ability && typeof ability === 'object') {
                abilities.push({
                    name: ability.name || 'Unknown Ability',
                    type: ability.type,
                    cooldown: ability.cooldown,
                    currentCooldown: ability.currentCooldown,
                    description: ability.description,
                    rank: ability.rank,
                    essence: ability.essence,
                    cost: ability.cost,
                    costAmount: ability.costAmount,
                });
            } else if (typeof ability === 'string') {
                abilities.push({
                    name: ability,
                });
            }
        }
    }

    // Skills array (Tactical/Praxis)
    if (Array.isArray(char.skills)) {
        for (const skill of char.skills) {
            if (skill && typeof skill === 'object' && !abilities.some(a => a.name === skill.name)) {
                abilities.push({
                    name: skill.name || 'Unknown Skill',
                    type: skill.type,
                    cooldown: skill.cooldown,
                    description: skill.description,
                    rank: skill.rank,
                });
            }
        }
    }

    return abilities;
}

// ==================== INVENTORY NORMALIZATION ====================

function normalizeInventory(char: any): NormalizedItem[] {
    const inventory: NormalizedItem[] = [];

    if (Array.isArray(char.inventory)) {
        for (const item of char.inventory) {
            if (item && typeof item === 'object') {
                inventory.push({
                    id: item.id,
                    name: item.name || 'Unknown Item',
                    quantity: item.quantity || 1,
                    type: item.type,
                    equipped: item.equipped || false,
                    rank: item.rank,
                });
            } else if (typeof item === 'string') {
                // Handle simple string items
                inventory.push({
                    name: item,
                    quantity: 1,
                });
            }
        }
    }

    // Weapons array (PRAXIS style)
    if (Array.isArray(char.weapons)) {
        for (const weapon of char.weapons) {
            if (weapon && typeof weapon === 'object') {
                inventory.push({
                    id: weapon.id,
                    name: weapon.name || 'Unknown Weapon',
                    quantity: 1,
                    type: 'weapon',
                    equipped: weapon.equipped ?? true,
                    rank: weapon.rank,
                });
            } else if (typeof weapon === 'string') {
                inventory.push({
                    name: weapon,
                    quantity: 1,
                    type: 'weapon',
                    equipped: true,
                });
            }
        }
    }

    // Loadout object (PRAXIS style - may have primary, secondary, etc.)
    if (char.loadout && typeof char.loadout === 'object') {
        for (const [slot, item] of Object.entries(char.loadout)) {
            if (item && typeof item === 'object') {
                const itemData = item as any;
                inventory.push({
                    id: itemData.id,
                    name: itemData.name || capitalizeFirst(slot),
                    quantity: 1,
                    type: slot,
                    equipped: true,
                    rank: itemData.rank,
                });
            } else if (typeof item === 'string') {
                inventory.push({
                    name: item,
                    quantity: 1,
                    type: slot,
                    equipped: true,
                });
            }
        }
    }

    // Equipment object (some worlds store equipped items separately)
    if (char.equipment && typeof char.equipment === 'object') {
        for (const [slot, item] of Object.entries(char.equipment)) {
            if (item && typeof item === 'object') {
                const itemData = item as any;
                inventory.push({
                    id: itemData.id,
                    name: itemData.name || `${capitalizeFirst(slot)}`,
                    quantity: 1,
                    type: slot,
                    equipped: true,
                    rank: itemData.rank,
                });
            } else if (typeof item === 'string') {
                inventory.push({
                    name: item,
                    quantity: 1,
                    type: slot,
                    equipped: true,
                });
            }
        }
    }

    return inventory;
}

// ==================== EXTRAS EXTRACTION ====================

function extractExtras(char: any, worldType: string): Record<string, any> {
    const extras: Record<string, any> = {};

    // Outworlder-specific
    if (worldType === 'outworlder') {
        if (char.essences) extras.essences = char.essences;
        if (char.confluence) extras.confluence = char.confluence;
    }

    // Tactical/Praxis-specific
    if (worldType === 'tactical' || worldType === 'praxis') {
        if (char.tacticalSquad) extras.tacticalSquad = char.tacticalSquad;
        if (char.missionPoints) extras.missionPoints = char.missionPoints;
        if (char.specialization) extras.specialization = char.specialization;
    }

    // Classic-specific
    if (worldType === 'classic') {
        if (char.spellSlots) extras.spellSlots = char.spellSlots;
        if (char.alignment) extras.alignment = char.alignment;
        if (char.background) extras.background = char.background;
    }

    return extras;
}

// ==================== HELPERS ====================

function capitalizeFirst(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function getEmptyCharacter(): NormalizedCharacter {
    return {
        name: 'Unknown',
        level: 1,
        resources: [],
        stats: [],
        abilities: [],
        inventory: [],
        quests: [],
        suggestedQuests: [],
        extras: {},
    };
}
