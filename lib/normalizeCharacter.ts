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
    experience?: {
        current: number;
        max: number;
    };
    displayRank?: string;

    // Resources (health, mana, stamina, etc.)
    resources: NormalizedResource[];

    // Currency (Gold, Credits, etc.)
    currency?: {
        name: string;
        amount: number;
        icon?: string;
    };

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

    const internalLevel = rawCharacter.level || 1;
    // XP Logic V2.0 - Inline Implementation to avoid dependency issues on client
    // Formula: Base * Tier_Multiplier, where Base = (tier_level + 1) * 500
    const tier = Math.ceil(Math.max(1, internalLevel) / 10);
    const tierLevel = ((Math.max(1, internalLevel) - 1) % 10) + 1;
    const base = (tierLevel + 1) * 500;
    const xpMax = base * tier;

    // Rank Display Logic
    let displayRank = `Level ${internalLevel}`;
    const normalizedWorld = worldType.toLowerCase();

    if (normalizedWorld === 'outworlder') {
        const ranks = ['Iron', 'Bronze', 'Silver', 'Gold', 'Diamond', 'Transcendent'];
        displayRank = `${ranks[tier - 1] || 'Unknown'} ${tierLevel}`;
    } else if (normalizedWorld === 'praxis' || normalizedWorld === 'tactical') {
        const ranks = ['GREEN', 'YELLOW', 'ORANGE', 'RED', 'BLACK', 'OMEGA'];
        displayRank = `${ranks[tier - 1] || 'UNKNOWN'}-${tierLevel}`;
    } else if (normalizedWorld === 'classic' || normalizedWorld === 'valdoria') {
        if (internalLevel <= 20) {
            displayRank = `Level ${internalLevel}`;
        } else if (internalLevel <= 40) {
            displayRank = `Epic ${internalLevel - 20}`;
        } else {
            displayRank = `Legendary ${internalLevel - 40}`;
        }
    }

    return {
        name,
        level: internalLevel,
        rank: displayRank.split(' ')[0], // Base rank name for simple displays
        displayRank, // Full display string
        class: characterClass,
        race,
        resources,
        currency: normalizeCurrency(rawCharacter, worldType),
        stats,
        abilities,
        inventory,
        quests: Array.isArray(questLog) ? questLog : [],
        suggestedQuests: Array.isArray(suggestedQuests) ? suggestedQuests : [],
        experience: typeof rawCharacter.experience === 'object' && rawCharacter.experience !== null
            ? rawCharacter.experience
            : { current: Number(rawCharacter.experience) || 0, max: xpMax },
        extras,
    };
}

// ==================== RESOURCE NORMALIZATION ====================

function normalizeResources(char: any, worldType: string): NormalizedResource[] {
    const resources: NormalizedResource[] = [];

    // 1. Priority: Check for resources object (generic engine format) - updated by AI
    if (char.resources && typeof char.resources === 'object') {
        for (const [key, value] of Object.entries(char.resources)) {
            // Skip invalid entries
            if (!value || typeof value !== 'object') continue;

            const res = value as any;
            if (typeof res.current === 'number') {
                const name = capitalizeFirst(key);
                // Map common names to standard UI colors/icons if not specified
                let color = res.color;
                let icon = res.icon;

                if (!icon && typeof name === 'string') {
                    if (name.match(/Health|Hp/i)) icon = '❤️';
                    else if (name.match(/Mana|Mp|Energy/i)) icon = '💧';
                    else if (name.match(/Stamina|Spirit/i)) icon = '⚡';
                    else if (name.match(/Nanite/i)) icon = '🤖';
                }

                if (!color && typeof name === 'string') {
                    if (name.match(/Health|Hp/i)) color = '#ef4444';
                    else if (name.match(/Mana|Mp|Energy|Nanite/i)) color = '#3b82f6';
                    else if (name.match(/Stamina|Spirit/i)) color = '#22c55e';
                }

                if (!color) color = '#8b5cf6';

                resources.push({
                    current: res.current,
                    max: res.max || res.current, // Fallback max to current if missing
                    name: name,
                    color: color,
                    icon: icon
                });
            }
        }
    }

    // 2. Fallback: Check root properties (Health, Mana, etc.)
    // Only add if NOT already present in resources

    // Health (various possible field names)
    if (!resources.some(r => r.name === 'Health')) {
        const health = extractResource(char, ['hp', 'health', 'hitPoints']);
        if (health) {
            resources.push({
                ...health,
                name: 'Health',
                color: '#ef4444', // Red
                icon: '❤️',
            });
        }
    }

    // Mana/Nanites (world-specific naming)
    const worldLower = worldType.toLowerCase();
    const isSciFi = worldLower === 'tactical' || worldLower === 'praxis';
    const manaName = isSciFi ? 'Nanites' : (char.nanites ? 'Nanites' : 'Mana');

    // Check if we already have this resource (by name)
    if (!resources.some(r => r.name === manaName)) {
        const mana = extractResource(char, ['mana', 'mp', 'nanites', 'energy', 'nc']);
        if (mana) {
            resources.push({
                ...mana,
                name: manaName,
                color: '#3b82f6', // Blue
                icon: isSciFi ? '🤖' : '💧',
            });
        }
    }

    // Stamina
    if (!resources.some(r => r.name === 'Stamina')) {
        const stamina = extractResource(char, ['stamina', 'spirit', 'focus', 'fatigue']);
        if (stamina) {
            resources.push({
                ...stamina,
                name: 'Stamina',
                color: '#22c55e', // Green
                icon: '⚡',
            });
        }
    }

    return resources;
}

function extractResource(char: any, possibleKeys: string[]): { current: number; max: number } | null {
    for (const key of possibleKeys) {
        const value = char[key];

        // precise object match { current, max }
        if (value && typeof value === 'object' && 'current' in value) {
            return {
                current: value.current ?? 0,
                max: value.max ?? 100,
            };
        }

        // numeric match (e.g. mana: 50) -> assumes max 100 or implicitly handled elsewhere
        if (typeof value === 'number') {
            return {
                current: value,
                max: 100, // Default max if simple number provided
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
        // D&D / Classic style
        strength: { name: 'Strength', abbreviation: 'STR', icon: '💪' },
        dexterity: { name: 'Dexterity', abbreviation: 'DEX', icon: '🏃' },
        constitution: { name: 'Constitution', abbreviation: 'CON', icon: '🛡️' },
        intelligence: { name: 'Intelligence', abbreviation: 'INT', icon: '🧠' },
        wisdom: { name: 'Wisdom', abbreviation: 'WIS', icon: '👁️' },
        charisma: { name: 'Charisma', abbreviation: 'CHA', icon: '✨' },

        // Outworlder style
        power: { name: 'Power', abbreviation: 'PWR', icon: '💪' },
        speed: { name: 'Speed', abbreviation: 'SPD', icon: '🏃' },
        stamina: { name: 'Stamina', abbreviation: 'STA', icon: '🔋' },
        spirit: { name: 'Spirit', abbreviation: 'SPI', icon: '✨' },
        recovery: { name: 'Recovery', abbreviation: 'REC', icon: '❤️' },

        // Tactical/Praxis style (Solo Leveling inspired)
        agility: { name: 'Agility', abbreviation: 'AGI', icon: '🏃' },
        vitality: { name: 'Vitality', abbreviation: 'VIT', icon: '❤️' },
        sense: { name: 'Sense', abbreviation: 'SEN', icon: '👁️' },
        perception: { name: 'Perception', abbreviation: 'PER', icon: '👁️' },

        // Legacy Tactical stats
        combat: { name: 'Combat', abbreviation: 'COM', icon: '🎯' },
        tactics: { name: 'Tactics', abbreviation: 'TAC', icon: '🧠' },
        stealth: { name: 'Stealth', abbreviation: 'STL', icon: '👤' },
        leadership: { name: 'Leadership', abbreviation: 'LDR', icon: '⭐' },
    };

    const lowerKey = key.toLowerCase();
    return statMap[lowerKey] || { name: capitalizeFirst(key), abbreviation: key.slice(0, 3).toUpperCase() };
}

// ==================== ABILITY NORMALIZATION ====================

// Map AI-generated ability types to UI filter categories
const ABILITY_TYPE_MAP: Record<string, string> = {
    'offensive': 'Attack',
    'combat': 'Attack',
    'damage': 'Attack',
    'defensive': 'Defense',
    'protection': 'Defense',
    'shield': 'Defense',
    'utility': 'Utility',
    'support': 'Utility',
    'passive': 'Passive',
    'aura': 'Passive',
    'special': 'Special',
    'unique': 'Special',
    'ultimate': 'Special',
};

function normalizeAbilities(char: any): NormalizedAbility[] {
    const abilities: NormalizedAbility[] = [];

    // Standard abilities array
    if (Array.isArray(char.abilities)) {
        for (const ability of char.abilities) {
            let normalized: NormalizedAbility | null = null;

            if (ability && typeof ability === 'object') {
                normalized = {
                    name: ability.name || 'Unknown Ability',
                    type: ABILITY_TYPE_MAP[(ability.type || '').toLowerCase()] || ability.type,
                    cooldown: ability.cooldown,
                    currentCooldown: ability.currentCooldown,
                    description: ability.description,
                    rank: ability.rank,
                    essence: ability.essence,
                    cost: ability.cost,
                    costAmount: ability.costAmount,
                };
            } else if (typeof ability === 'string') {
                // Try to parse "Name [Type] - Description" format
                // Example: "AUTO-LOOT [utility] - Magically harvest..."
                const complexMatch = ability.match(/^(.+?)\s*\[(.+?)\]\s*-\s*(.+)$/);

                if (complexMatch) {
                    normalized = {
                        name: complexMatch[1].trim(),
                        type: ABILITY_TYPE_MAP[complexMatch[2].trim().toLowerCase()] || complexMatch[2].trim(),
                        description: complexMatch[3].trim(),
                    };
                } else {
                    normalized = {
                        name: ability,
                    };
                }
            }

            if (normalized) {
                const newNameLower = normalized.name.toLowerCase().trim();
                // Deduplicate: Don't add if we already have this ability (fuzzy match)
                const exists = abilities.some(a => {
                    const existingLower = a.name.toLowerCase().trim();
                    return existingLower === newNameLower || existingLower.includes(newNameLower) || newNameLower.includes(existingLower);
                });

                if (!exists) {
                    abilities.push(normalized);
                }
            }
        }
    }

    // Skills array (Tactical/Praxis)
    if (Array.isArray(char.skills)) {
        for (const skill of char.skills) {
            if (skill && typeof skill === 'object') {
                const name = skill.name || 'Unknown Skill';
                // Check against existing abilities
                const newNameLower = name.toLowerCase().trim();
                const exists = abilities.some(a => {
                    const existingLower = a.name.toLowerCase().trim();
                    return existingLower === newNameLower || existingLower.includes(newNameLower) || newNameLower.includes(existingLower);
                });

                if (!exists) {
                    abilities.push({
                        name: name,
                        type: skill.type,
                        cooldown: skill.cooldown,
                        description: skill.description,
                        rank: skill.rank,
                    });
                }
            }
        }
    }

    return abilities;
}

// ==================== INVENTORY NORMALIZATION ====================

// Keywords for inferring item types from names
const ITEM_TYPE_KEYWORDS: Record<string, string[]> = {
    'weapon': ['sword', 'blade', 'bow', 'axe', 'dagger', 'spear', 'staff', 'wand', 'mace', 'hammer', 'crossbow', 'gun'],
    'armor': ['armor', 'helmet', 'chest', 'boots', 'gloves', 'shield', 'plate', 'mail', 'robe', 'cloak'],
    'consumable': ['potion', 'herb', 'elixir', 'scroll', 'food', 'drink', 'tonic', 'remedy'],
};

function inferItemType(name: string): string | undefined {
    const lowerName = name.toLowerCase();
    for (const [type, keywords] of Object.entries(ITEM_TYPE_KEYWORDS)) {
        if (keywords.some(kw => lowerName.includes(kw))) return type;
    }
    return undefined;
}

function normalizeInventory(char: any): NormalizedItem[] {
    const inventory: NormalizedItem[] = [];

    if (Array.isArray(char.inventory)) {
        for (const item of char.inventory) {
            if (item && typeof item === 'object') {
                inventory.push({
                    id: item.id,
                    name: item.name || 'Unknown Item',
                    quantity: item.quantity || 1,
                    type: item.type || inferItemType(item.name || ''),
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
        currency: { name: 'Credits', amount: 0, icon: '💰' },
        stats: [],
        abilities: [],
        inventory: [],
        quests: [],
        suggestedQuests: [],
        extras: {},
    };
}

// ==================== CURRENCY NORMALIZATION ====================

function normalizeCurrency(char: any, worldType: string): { name: string; amount: number; icon?: string } | undefined {
    const worldLower = worldType.toLowerCase();

    // Classic/D&D style
    if (worldLower === 'classic' || char.gold !== undefined) {
        return {
            name: 'Gold',
            amount: typeof char.gold === 'number' ? char.gold : 0,
            icon: '🪙'
        };
    }

    // Tactical/Praxis style
    if (worldLower === 'tactical' || worldLower === 'praxis' || char.credits !== undefined) {
        return {
            name: 'Credits',
            amount: typeof char.credits === 'number' ? char.credits : 0,
            icon: '💰'
        };
    }

    // Generic fallback or root property check
    const possibleMoneyKeys = ['money', 'coins', 'currency', 'cash', 'balance'];
    for (const key of possibleMoneyKeys) {
        if (typeof char[key] === 'number') {
            return {
                name: capitalizeFirst(key),
                amount: char[key],
                icon: '💰'
            };
        }
    }

    return undefined;
}

