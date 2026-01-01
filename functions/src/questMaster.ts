import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { z } from 'zod';
import type { GameState } from './utils/stateHelpers';

// ==================== TYPES ====================

export interface QuestMasterInput {
    worldModule: 'classic' | 'outworlder' | 'tactical';
    currentState: GameState;
    triggerReason: 'level_up' | 'location_change' | 'quest_complete' | 'queue_empty' | 'manual';
    recentEvents: string[]; // Last 5 narrative summaries
    apiKey: string;
    provider: 'openai' | 'anthropic' | 'google';
    model: string;
    maxQuests?: number; // Default: 2
    customPrompt?: string; // Override default prompt
}

export interface QuestMasterOutput {
    success: boolean;
    data?: {
        quests: GeneratedQuest[];
        reasoning: string;
    };
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    error?: string;
}

export interface GeneratedQuest {
    id: string;
    title: string;
    description: string;
    type: QuestType;
    difficulty: 'trivial' | 'easy' | 'medium' | 'hard' | 'legendary';
    scope: QuestScope;
    estimatedTurns?: number;
    objectives: {
        id: string;
        text: string;
        isCompleted: boolean;
        optional?: boolean;
    }[];
    rewards: {
        experience?: number;
        gold?: number;
        items?: string[];
        abilities?: string[];
    };
    prerequisites?: string[];
    expiresAfterTurns?: number;
    chainId?: string;
    chainPart?: number;
}

export type QuestScope = 'errand' | 'task' | 'adventure' | 'saga' | 'epic';

export type QuestType =
    // Classic Fantasy
    | 'fetch' | 'escort' | 'kill' | 'explore' | 'puzzle' | 'diplomacy'
    // Outworlder Sci-Fi
    | 'salvage' | 'infiltration' | 'research' | 'defense' | 'trade'
    // Tactical Military
    | 'assault' | 'reconnaissance' | 'extraction' | 'sabotage' | 'holdout';

// ==================== CONFIGURATION ====================

const QUEST_TYPES_BY_WORLD: Record<string, QuestType[]> = {
    classic: ['fetch', 'escort', 'kill', 'explore', 'puzzle', 'diplomacy'],
    outworlder: ['salvage', 'infiltration', 'research', 'defense', 'trade'],
    tactical: ['assault', 'reconnaissance', 'extraction', 'sabotage', 'holdout']
};

const TRIGGER_GUIDANCE: Record<string, string> = {
    'level_up': 'Create a quest that challenges the character\'s new abilities. Should feel like a milestone achievement.',
    'location_change': 'Create location-specific quests with local flavor, NPCs, or dangers unique to this area.',
    'quest_complete': 'Create a follow-up quest or new opportunity that builds on recent achievements.',
    'queue_empty': 'Create 1-2 general adventure hooks. Can be side quests or story-advancing.',
    'manual': 'User requested new quests. Provide varied options across different quest types and scopes.'
};

const REWARD_SCALING: Record<number, { experience: number; gold: number; itemRarity: string }> = {
    1: { experience: 50, gold: 10, itemRarity: 'common' },
    2: { experience: 100, gold: 25, itemRarity: 'common' },
    3: { experience: 200, gold: 50, itemRarity: 'uncommon' },
    4: { experience: 350, gold: 100, itemRarity: 'uncommon' },
    5: { experience: 500, gold: 200, itemRarity: 'rare' },
    6: { experience: 700, gold: 350, itemRarity: 'rare' },
    7: { experience: 1000, gold: 500, itemRarity: 'very rare' },
    8: { experience: 1500, gold: 750, itemRarity: 'very rare' },
    9: { experience: 2000, gold: 1000, itemRarity: 'legendary' },
    10: { experience: 3000, gold: 1500, itemRarity: 'legendary' }
};

// ==================== JSON SCHEMA ====================

const QuestResponseSchema = z.object({
    quests: z.array(z.object({
        id: z.coerce.string().describe('Unique quest ID'),
        title: z.string().describe('Quest title'),
        description: z.string().describe('Quest description'),
        type: z.enum(['fetch', 'escort', 'kill', 'explore', 'puzzle', 'diplomacy', 'salvage', 'infiltration', 'research', 'defense', 'trade', 'assault', 'reconnaissance', 'extraction', 'sabotage', 'holdout']).describe('Quest type'),
        difficulty: z.enum(['trivial', 'easy', 'medium', 'hard', 'legendary']).describe('Difficulty level'),
        scope: z.enum(['errand', 'task', 'adventure', 'saga', 'epic']).describe('Quest length/scope'),
        estimatedTurns: z.number().optional().describe('Estimated turns to complete'),
        objectives: z.array(z.object({
            id: z.coerce.string(),
            text: z.string(),
            isCompleted: z.boolean().default(false),
            optional: z.boolean().optional()
        })).describe('Quest objectives'),
        rewards: z.object({
            experience: z.number().optional(),
            gold: z.number().optional(),
            items: z.array(z.string()).optional(),
            abilities: z.array(z.string()).optional()
        }).describe('Quest rewards'),
        prerequisites: z.array(z.coerce.string()).optional().describe('Required quest IDs'),
        expiresAfterTurns: z.number().optional().describe('Time limit in turns'),
        chainId: z.coerce.string().optional().describe('Quest chain ID'),
        chainPart: z.number().optional().describe('Part number in chain')
    })),
    reasoning: z.string().describe('Why these quests fit the current moment')
});

// ==================== PROMPT BUILDER ====================

/**
 * Builds the contextual data strings for template replacement
 */
function getTemplateData(input: QuestMasterInput): Record<string, string> {
    const { worldModule, currentState, triggerReason, recentEvents } = input;

    const character = (currentState as any).character || {};
    const rank = character.rank || 1;
    const questTypes = QUEST_TYPES_BY_WORLD[worldModule] || QUEST_TYPES_BY_WORLD.classic;
    const scaling = REWARD_SCALING[rank] || REWARD_SCALING[1];

    // Get active and completed quests
    const activeQuests = (currentState.questLog || []).filter(q => q.status === 'active');
    const completedQuests = (currentState.questLog || []).filter(q => q.status === 'completed');

    const activeQuestList = activeQuests.length > 0
        ? activeQuests.map(q => `- ${q.title}`).join('\n')
        : '- None';

    const completedQuestList = completedQuests.length > 0
        ? completedQuests.slice(-5).map(q => `- ${q.title}`).join('\n')
        : '- None';

    const recentEventsList = recentEvents.length > 0
        ? recentEvents.join('\n')
        : '- No recent events';

    return {
        '{{CHARACTER_CONTEXT}}': `
- Name: ${character.name || 'Unknown'}
- Rank/Level: ${rank}
- Class/Role: ${character.role || 'Adventurer'}
- Key Abilities: ${character.abilities?.slice(0, 5).join(', ') || 'None'}
- Current Location: ${(currentState as any).location || 'Unknown'}`,

        '{{QUEST_HISTORY}}': `
Active Quests (DO NOT DUPLICATE):
${activeQuestList}

Recently Completed:
${completedQuestList}`,

        '{{RECENT_EVENTS}}': recentEventsList,

        '{{TRIGGER_CONTEXT}}': `
Trigger: "${triggerReason}"
Guidance: ${TRIGGER_GUIDANCE[triggerReason]}`,

        '{{WORLD_CONTEXT}}': `
World: ${worldModule.toUpperCase()}
Available Quest Types: ${questTypes.join(', ')}`,

        '{{REWARD_SCALING}}': `
Current Scale (Rank ${rank}):
- Experience: ${scaling.experience} XP
- Gold: ${scaling.gold} gold
- Item Rarity: ${scaling.itemRarity}`
    };
}

function buildPrompt(input: QuestMasterInput): string {
    const { worldModule, maxQuests = 2 } = input;
    const data = getTemplateData(input);

    let prompt = `You are the Quest Master for a ${worldModule} RPG campaign.

## CHARACTER CONTEXT
{{CHARACTER_CONTEXT}}

## QUEST HISTORY
{{QUEST_HISTORY}}

## RECENT EVENTS (Last 5 turns)
{{RECENT_EVENTS}}

## TRIGGER REASON
{{TRIGGER_CONTEXT}}

## QUEST TYPE OPTIONS
{{WORLD_CONTEXT}}

## QUEST SCOPE OPTIONS
- errand: 1-3 turns, 1 objective (quick favor, single task)
- task: 3-8 turns, 2-3 objectives (clear area, escort NPC)
- adventure: 8-20 turns, 3-5 objectives (explore ruin, solve mystery)
- saga: 20-50 turns, 5-8 objectives (major story arc, faction conflict)
- epic: 50+ turns, 8+ objectives (world-changing legendary campaign)

SCOPE GUIDANCE:
- Level Up triggers should generate 'adventure' or 'saga' scope quests
- Location Change can generate 'errand' to 'task' scope local quests
- Queue Empty should mix scopes for variety
- At least one 'saga' or 'epic' quest should exist at any time for long-term goals

## REWARD SCALING
{{REWARD_SCALING}}

## OUTPUT REQUIREMENTS
Generate ${maxQuests} quest(s) in JSON format.
Each quest MUST include: id, title, description, type, difficulty, scope, estimatedTurns, objectives, rewards.
Optional: prerequisites, expiresAfterTurns, chainId, chainPart.

Respond with JSON only. No markdown.`;

    // Apply replacements to the default prompt
    for (const [placeholder, value] of Object.entries(data)) {
        prompt = prompt.split(placeholder).join(value);
    }

    return prompt;
}

// ==================== MAIN FUNCTION ====================

export async function generateQuests(input: QuestMasterInput): Promise<QuestMasterOutput> {
    const { provider, model, apiKey, customPrompt } = input;

    try {
        let systemPrompt = customPrompt || buildPrompt(input);

        // If using a custom prompt (from Admin UI), we MUST apply common replacements
        if (customPrompt) {
            const data = getTemplateData(input);
            for (const [placeholder, value] of Object.entries(data)) {
                systemPrompt = systemPrompt.split(placeholder).join(value);
            }

            // Also handle world name and max quests if they use placeholders
            systemPrompt = systemPrompt.split('${worldModule}').join(input.worldModule);
            systemPrompt = systemPrompt.split('${maxQuests}').join(String(input.maxQuests || 2));
        }

        console.log(`[QuestMaster] Using provider: ${provider} (Model: ${model})`);

        let content: string | null = null;
        let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;

        // OpenAI
        if (provider === 'openai') {
            const openai = new OpenAI({ apiKey });
            const response = await openai.chat.completions.create({
                model,
                messages: [{ role: 'system', content: systemPrompt }],
                response_format: { type: 'json_object' },
                temperature: 0.8 // Higher creativity for quest generation
            });

            content = response.choices[0]?.message?.content || null;
            usage = {
                promptTokens: response.usage?.prompt_tokens || 0,
                completionTokens: response.usage?.completion_tokens || 0,
                totalTokens: response.usage?.total_tokens || 0
            };
        }

        // Anthropic
        else if (provider === 'anthropic') {
            const anthropic = new Anthropic({ apiKey });
            const response = await anthropic.messages.create({
                model,
                max_tokens: 2000,
                messages: [{ role: 'user', content: systemPrompt }],
                temperature: 0.8
            });

            const block = response.content[0];
            content = block.type === 'text' ? block.text : null;
            usage = {
                promptTokens: response.usage.input_tokens,
                completionTokens: response.usage.output_tokens,
                totalTokens: response.usage.input_tokens + response.usage.output_tokens
            };
        }

        // Google
        else if (provider === 'google') {
            const genAI = new GoogleGenerativeAI(apiKey);
            const geminiModel = genAI.getGenerativeModel({
                model,
                generationConfig: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: SchemaType.OBJECT,
                        properties: {
                            quests: {
                                type: SchemaType.ARRAY,
                                items: {
                                    type: SchemaType.OBJECT,
                                    properties: {
                                        id: { type: SchemaType.STRING },
                                        title: { type: SchemaType.STRING },
                                        description: { type: SchemaType.STRING },
                                        type: { type: SchemaType.STRING },
                                        difficulty: { type: SchemaType.STRING },
                                        scope: { type: SchemaType.STRING },
                                        estimatedTurns: { type: SchemaType.NUMBER },
                                        objectives: {
                                            type: SchemaType.ARRAY,
                                            items: {
                                                type: SchemaType.OBJECT,
                                                properties: {
                                                    id: { type: SchemaType.STRING },
                                                    text: { type: SchemaType.STRING },
                                                    isCompleted: { type: SchemaType.BOOLEAN },
                                                    optional: { type: SchemaType.BOOLEAN }
                                                }
                                            }
                                        },
                                        rewards: {
                                            type: SchemaType.OBJECT,
                                            properties: {
                                                experience: { type: SchemaType.NUMBER },
                                                gold: { type: SchemaType.NUMBER },
                                                items: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                                                abilities: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
                                            }
                                        }
                                    }
                                }
                            },
                            reasoning: { type: SchemaType.STRING }
                        }
                    }
                }
            });

            const result = await geminiModel.generateContent(systemPrompt);
            content = result.response.text();

            // Google doesn't provide token counts in the same way
            usage = {
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0
            };
        }

        if (!content) {
            return {
                success: false,
                error: 'No content returned from AI'
            };
        }

        // Parse and validate response
        const parsed = JSON.parse(content);
        const validated = QuestResponseSchema.parse(parsed);

        return {
            success: true,
            data: {
                quests: validated.quests as GeneratedQuest[],
                reasoning: validated.reasoning
            },
            usage
        };

    } catch (error: any) {
        console.error('[QuestMaster] Generation failed:', error);
        return {
            success: false,
            error: error.message || 'Unknown error'
        };
    }
}
