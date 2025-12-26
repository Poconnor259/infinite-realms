/**
 * Character Import/Export Utilities
 * 
 * Handles parsing, validation, and export of character data for all world types.
 */

import type {
    OutworlderCharacter,
    ClassicCharacter,
    TacticalCharacter,
    Campaign,
    Message,
    ModuleState
} from './types';

// ==================== TYPES ====================

export interface CharacterImportResult {
    success: boolean;
    character?: any;
    errors?: string[];
}

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

export interface CampaignSaveData {
    version: number;
    worldType: string;
    createdAt: string;
    saveName: string;
    character: any;
    moduleState: ModuleState;
    messageCount: number;
    lastMessages: Message[];
}

export interface CharacterTemplate {
    worldType: string;
    description: string;
    example: object;
}

// ==================== TEMPLATES ====================

export function getTemplateForWorld(worldType: string): CharacterTemplate {
    switch (worldType.toLowerCase()) {
        case 'outworlder':
            return {
                worldType: 'outworlder',
                description: 'Outworlder (HWFWM) character template',
                example: {
                    name: 'Hero Name',
                    rank: 'Iron',
                    essences: ['Might', 'Swift'],
                    confluence: '',
                    stats: {
                        power: 12,
                        speed: 11,
                        spirit: 10,
                        recovery: 10
                    },
                    abilities: [
                        {
                            name: 'Power Strike',
                            essence: 'Might',
                            rank: 'Iron',
                            type: 'attack',
                            cooldown: 0,
                            cost: 'mana',
                            costAmount: 10,
                            description: 'A powerful strike'
                        }
                    ]
                }
            };

        case 'classic':
            return {
                worldType: 'classic',
                description: 'D&D 5E Classic character template',
                example: {
                    name: 'Hero Name',
                    class: 'Wizard',
                    race: 'Human',
                    background: 'Sage',
                    stats: {
                        strength: 10,
                        dexterity: 14,
                        constitution: 12,
                        intelligence: 16,
                        wisdom: 13,
                        charisma: 8
                    },
                    spells: ['Magic Missile', 'Shield', 'Detect Magic'],
                    equipment: ['Spellbook', 'Component Pouch', 'Quarterstaff']
                }
            };

        case 'tactical':
        case 'praxis':
            return {
                worldType: 'tactical',
                description: 'PRAXIS: Operation Dark Tide character template',
                example: {
                    name: 'Operative Name',
                    job: 'PRAXIS Operative',
                    title: 'Shadow',
                    stats: {
                        strength: 12,
                        agility: 14,
                        vitality: 11,
                        intelligence: 13,
                        perception: 15
                    },
                    skills: [
                        {
                            name: 'Shadow Step',
                            rank: 'C',
                            type: 'active',
                            description: 'Teleport short distance'
                        }
                    ],
                    equipment: ['Mk. IV Pulse Carbine', 'Tactical Armor']
                }
            };

        default:
            throw new Error(`Unknown world type: ${worldType}`);
    }
}

export function generateTemplate(worldType: string): string {
    const template = getTemplateForWorld(worldType);
    return JSON.stringify(template.example, null, 2);
}

// ==================== IMPORT/PARSE ====================

export function parseCharacterJSON(jsonString: string, worldType: string): CharacterImportResult {
    try {
        // Clean JSON: remove trailing commas (common error)
        const cleanedJSON = jsonString
            .replace(/,\s*}/g, '}')  // Remove trailing commas before }
            .replace(/,\s*\]/g, ']'); // Remove trailing commas before ]

        const data = JSON.parse(cleanedJSON);
        const validation = validateImport(data, worldType);

        if (!validation.valid) {
            return {
                success: false,
                errors: validation.errors
            };
        }

        return {
            success: true,
            character: data
        };
    } catch (error) {
        return {
            success: false,
            errors: ['Invalid JSON format: ' + (error as Error).message]
        };
    }
}

// ==================== VALIDATION ====================

export function validateImport(data: any, worldType: string): ValidationResult {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
        errors.push('Character data must be an object');
        return { valid: false, errors };
    }

    // Common validations
    if (!data.name || typeof data.name !== 'string') {
        errors.push('Character name is required');
    }

    switch (worldType.toLowerCase()) {
        case 'outworlder':
            validateOutworlder(data, errors);
            break;
        case 'classic':
            validateClassic(data, errors);
            break;
        case 'tactical':
        case 'praxis':
            validateTactical(data, errors);
            break;
        default:
            errors.push(`Unknown world type: ${worldType}`);
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

function validateOutworlder(data: any, errors: string[]): void {
    const validRanks = ['Iron', 'Bronze', 'Silver', 'Gold', 'Diamond'];
    if (data.rank && !validRanks.includes(data.rank)) {
        errors.push(`Invalid rank. Must be one of: ${validRanks.join(', ')}`);
    }

    if (data.essences) {
        if (!Array.isArray(data.essences)) {
            errors.push('Essences must be an array');
        } else if (data.essences.length > 4) {
            errors.push('Maximum 4 essences allowed');
        }
    }

    if (data.stats) {
        const requiredStats = ['power', 'speed', 'spirit', 'recovery'];
        for (const stat of requiredStats) {
            if (typeof data.stats[stat] !== 'number') {
                errors.push(`Missing or invalid stat: ${stat}`);
            }
        }
    }

    if (data.abilities && Array.isArray(data.abilities)) {
        const validTypes = ['attack', 'defense', 'utility', 'movement', 'special'];
        data.abilities.forEach((ability: any, index: number) => {
            if (!ability.name) {
                errors.push(`Ability ${index + 1}: name is required`);
            }
            if (ability.type && !validTypes.includes(ability.type)) {
                errors.push(`Ability ${index + 1}: invalid type. Must be one of: ${validTypes.join(', ')}`);
            }
        });
    }
}

function validateClassic(data: any, errors: string[]): void {
    if (data.stats) {
        const requiredStats = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
        for (const stat of requiredStats) {
            if (typeof data.stats[stat] !== 'number') {
                errors.push(`Missing or invalid stat: ${stat}`);
            }
        }
    }
}

function validateTactical(data: any, errors: string[]): void {
    const validJobs = ['None', 'Specialist', 'PRAXIS Operative'];
    if (data.job && !validJobs.includes(data.job)) {
        errors.push(`Invalid job. Must be one of: ${validJobs.join(', ')}`);
    }

    if (data.stats) {
        const requiredStats = ['strength', 'agility', 'vitality', 'intelligence', 'perception'];
        for (const stat of requiredStats) {
            if (typeof data.stats[stat] !== 'number') {
                errors.push(`Missing or invalid stat: ${stat}`);
            }
        }
    }
}

// ==================== EXPORT ====================

export function exportCampaignSave(
    campaign: Campaign,
    messages: Message[],
    saveName: string
): CampaignSaveData {
    // Get last 50 messages for context
    const lastMessages = messages.slice(-50);

    return {
        version: 1,
        worldType: campaign.worldModule,
        createdAt: new Date().toISOString(),
        saveName,
        character: (campaign.moduleState as any).character || {},
        moduleState: campaign.moduleState,
        messageCount: messages.length,
        lastMessages
    };
}

export function downloadAsFile(data: object, filename: string): void {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
