import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { z } from 'zod';
import { getPrompt } from './promptHelper';
import { getActiveQuest, type GameState } from './utils/stateHelpers';

// ==================== TYPES ====================

interface BrainInput {
    userInput: string;
    worldModule: string;
    currentState: Record<string, unknown>;
    chatHistory: Array<{ role: string; content: string }>;
    apiKey: string;
    provider: 'openai' | 'anthropic' | 'google';
    model: string;
    knowledgeDocuments?: string[]; // Reference documents for context
    customRules?: string; // Optional custom rules for the AI logic
    showSuggestedChoices?: boolean; // Whether to include options in pendingChoice (default: true)
    interactiveDiceRolls?: boolean; // Whether user wants to roll dice manually (default: false = auto-roll)
    rollResult?: number; // Result from user's dice roll when continuing after pendingRoll
}

interface BrainOutput {
    success: boolean;
    data?: {
        stateUpdates: Record<string, unknown>;
        narrativeCues: NarrativeCue[];
        narrativeCue?: string; // Simple fallback narrative
        diceRolls: DiceRoll[];
        systemMessages: string[];
        requiresUserInput?: boolean; // True = pause for player clarification
        pendingChoice?: {
            prompt: string; // What to ask the player
            options?: string[]; // Suggested choices (only if user preference allows)
            choiceType: 'action' | 'target' | 'dialogue' | 'direction' | 'item' | 'decision';
        };
        pendingRoll?: {
            type: string;           // "d20", "2d6", etc.
            purpose: string;        // "Attack Roll", "Saving Throw", etc.
            modifier?: number;      // +5, -2, etc.
            stat?: string;          // "Strength", "Dexterity" (for display)
            difficulty?: number;    // DC/Target number (optional)
        };
    };
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    error?: string;
}

interface NarrativeCue {
    type: 'action' | 'dialogue' | 'description' | 'combat' | 'discovery';
    content: string;
    emotion?: 'neutral' | 'tense' | 'triumphant' | 'mysterious' | 'danger';
}

interface DiceRoll {
    type: string;
    result: number;
    modifier?: number;
    total: number;
    purpose?: string;
}

// ==================== JSON SCHEMA FOR RESPONSE ====================

const BrainResponseSchema = z.object({
    stateUpdates: z.record(z.unknown()).optional().default({}).describe('Updated game state fields'),
    narrativeCues: z.array(z.object({
        type: z.enum(['action', 'dialogue', 'description', 'combat', 'discovery']),
        content: z.string(),
        emotion: z.enum(['neutral', 'tense', 'triumphant', 'mysterious', 'danger']).optional(),
    })).optional().default([]).describe('Cues for the narrator to expand into prose'),
    diceRolls: z.array(z.object({
        type: z.string().describe('Dice type, e.g., "d20" or "2d6"'),
        result: z.number().describe('Raw dice result'),
        modifier: z.number().optional().describe('Modifier added to roll'),
        total: z.number().describe('Final total after modifiers'),
        purpose: z.string().optional().describe('What the roll was for'),
    })).optional().default([]).describe('Any dice rolls made'),
    systemMessages: z.array(z.string()).optional().default([]).describe('Game system notifications for the player'),
    narrativeCue: z.string().optional().describe('Simple narrative fallback if Claude is unavailable'),
    requiresUserInput: z.boolean().optional().describe('True if player clarification is needed before proceeding'),
    pendingChoice: z.object({
        prompt: z.string().describe('Question to ask the player'),
        options: z.array(z.string()).optional().describe('Suggested choices (only if user preference allows)'),
        choiceType: z.enum(['action', 'target', 'dialogue', 'direction', 'item', 'decision']).describe('Category of choice'),
    }).optional().describe('Player choice data when requiresUserInput is true'),
    pendingRoll: z.object({
        type: z.string().describe('Dice type, e.g., "d20" or "2d6"'),
        purpose: z.string().describe('What the roll is for, e.g., "Attack Roll" or "Perception Check"'),
        modifier: z.number().optional().describe('Modifier to add to roll'),
        stat: z.string().optional().describe('Related stat, e.g., "Strength" or "Dexterity"'),
        difficulty: z.number().optional().describe('DC/Target number for success'),
    }).optional().describe('Pending dice roll when user needs to roll interactively'),
});

// ==================== MAIN BRAIN FUNCTION ====================

export async function processWithBrain(input: BrainInput): Promise<BrainOutput> {
    const { userInput, worldModule, currentState, chatHistory, apiKey, provider, model, knowledgeDocuments, customRules, showSuggestedChoices = true, interactiveDiceRolls = false, rollResult } = input;

    console.log(`[Brain] interactiveDiceRolls=${interactiveDiceRolls}, rollResult=${rollResult}`);

    try {
        // Build knowledge base section if documents exist
        let knowledgeSection = '';
        if (knowledgeDocuments && knowledgeDocuments.length > 0) {
            knowledgeSection = `

REFERENCE MATERIALS (Use for world context and lore):
---
${knowledgeDocuments.join('\n\n---\n\n')}
---
`;
        }

        let customRulesSection = '';
        if (customRules) {
            customRulesSection = `

WORLD-SPECIFIC RULES (PRIORITIZE THESE):
---
${customRules}
---
`;
        }

        // Get brain prompt from Firestore
        const brainPrompt = await getPrompt('brain', worldModule);

        // Check if character already has essences (for Outworlder)
        // Character data can be in multiple places depending on how state is structured
        let essenceOverrideSection = '';
        const directCharacter = currentState?.character as any;
        const moduleCharacter = (currentState as any)?.moduleState?.character as any;
        const character = directCharacter || moduleCharacter;

        console.log('[Brain] Essence check - worldModule:', worldModule);
        console.log('[Brain] Essence check - character found:', !!character);
        console.log('[Brain] Essence check - essences:', character?.essences);
        console.log('[Brain] Essence check - essenceSelection:', character?.essenceSelection);

        if (character?.essences && Array.isArray(character.essences) && character.essences.length > 0) {
            const essenceSelection = character?.essenceSelection;
            console.log('[Brain] Character has essences, selection mode:', essenceSelection);

            // Skip essence prompt if essences were pre-selected (chosen or imported)
            // OR if essences exist but no selection mode (legacy/imported data)
            if (essenceSelection === 'chosen' || essenceSelection === 'imported' || !essenceSelection) {
                // Check if character already has abilities
                const hasAbilities = character.abilities && Array.isArray(character.abilities) && character.abilities.length > 0;

                // Build the base override section
                essenceOverrideSection = `

🚨 CRITICAL OVERRIDE - ESSENCE ALREADY SELECTED 🚨
The character has already selected their foundational essence during character creation.
- Selected Essences: ${character.essences.join(', ')}
- Rank: ${character.rank || 'Iron'}
- Existing Abilities: ${(character.abilities || []).join(', ') || 'None yet'}

DO NOT present essence selection options (A, B, C, D).
DO NOT run the "COMPENSATION PACKAGE — ESSENCE SELECTION" sequence.
DO NOT ask the player to choose an essence - they already have one.
`;

                // Only add the "DO NOT GRANT" instruction if they already have abilities
                if (hasAbilities) {
                    essenceOverrideSection += `DO NOT grant any "Intrinsic" abilities or "Confluence" abilities - the character ALREADY possesses their full ability set.
`;
                    console.log('[Brain] Character has abilities - blocking ability grants');
                } else {
                    essenceOverrideSection += `The character has essences but NO abilities yet. You SHOULD grant their intrinsic abilities as they awaken.
`;
                    console.log('[Brain] Character has NO abilities - allowing ability grants');
                }

                essenceOverrideSection += `The character is ALREADY awakened with the ${character.essences[0]} essence.
Skip directly to their adventure beginning with their essence already active.
Acknowledge their essence in narrative but do not offer selection.
`;
                console.log('[Brain] Essence override section added');
            }
        }

        // Define dynamic instruction blocks
        const diceRules = interactiveDiceRolls
            ? `INTERACTIVE DICE MODE ENABLED - MANDATORY RULES:
   - When ANY dice roll is needed (attack rolls, damage rolls, skill checks, saving throws, ability checks), you MUST:
     a) Set "requiresUserInput": true
     b) Set "pendingRoll" with: type (e.g., "d20", "2d6"), purpose (e.g., "Attack Roll vs Goblin", "Stealth Check"), modifier (number), stat (optional), difficulty (DC if known)
     c) Leave "diceRolls" as an EMPTY array - do NOT auto-roll
     d) In "narrativeCues", describe the setup but NOT the outcome (e.g., "You swing your sword..." not "You hit/miss")
   - EXAMPLES when to pause for dice:
     * Combat attacks: pendingRoll: { type: "d20", purpose: "Attack Roll", modifier: 3, stat: "Strength" }
     * Skill checks: pendingRoll: { type: "d20", purpose: "Perception Check", modifier: 2, stat: "Wisdom", difficulty: 15 }
     * Damage: pendingRoll: { type: "2d6", purpose: "Damage Roll (Longsword)", modifier: 3 }
   - Do NOT resolve the outcome until the user provides the roll result.`
            : 'Calculate all dice rolls using proper randomization simulation and include them in diceRolls array.';

        const choicesRule = `USER PREFERENCE: showSuggestedChoices = ${showSuggestedChoices}. ${showSuggestedChoices ? 'Include 2-4 options in pendingChoice.options when pausing.' : 'Do NOT include options in pendingChoice.options. Set it to null/undefined.'}`;

        const rollResultRule = rollResult !== undefined
            ? `CONTINUING FROM USER ROLL: The user rolled ${rollResult}. Process the outcome of this roll and continue the narrative accordingly. Do NOT request another roll.`
            : '';

        let systemPrompt = brainPrompt;

        // Apply template replacements
        systemPrompt = systemPrompt.replace('{{KNOWLEDGE_SECTION}}', knowledgeSection || '');
        systemPrompt = systemPrompt.replace('{{CUSTOM_RULES_SECTION}}', customRulesSection || '');
        systemPrompt = systemPrompt.replace('{{ESSENCE_OVERRIDE_SECTION}}', essenceOverrideSection || '');
        systemPrompt = systemPrompt.replace('{{INTERACTIVE_DICE_RULES}}', diceRules);
        systemPrompt = systemPrompt.replace('{{SUGGESTED_CHOICES_RULES}}', choicesRule);
        systemPrompt = systemPrompt.replace('{{ROLL_RESULT_RULE}}', rollResultRule);

        // BACKWARD COMPATIBILITY: If placeholders are missing (old prompt version), append the logic
        if (!systemPrompt.includes(diceRules) && !brainPrompt.includes('{{INTERACTIVE_DICE_RULES}}')) {
            systemPrompt += `
${knowledgeSection}
${customRulesSection}
${essenceOverrideSection}

CRITICAL INSTRUCTIONS:
1. You are ONLY the logic engine. You process game mechanics, not story.
2. You MUST respond with valid JSON. Include a "stateUpdates" object with any changed game state fields.
3. ${diceRules}
4. Update only the state fields that changed in the stateUpdates object.
5. Provide narrative cues for the storyteller, not full prose.
6. Include any system messages (level ups, achievements, warnings).
7. If reference materials or custom rules are provided, use them for world-consistent responses.
8. ${choicesRule}
${rollResultRule}`;
        }

        // Inject active quest context if exists
        const activeQuest = getActiveQuest(currentState as GameState);
        let questContext = '';
        if (activeQuest) {
            const objectives = activeQuest.objectives?.map(obj =>
                `  ${obj.isCompleted ? '[\u2713]' : '[ ]'} ${obj.text}`
            ).join('\n') || '';

            questContext = `

ACTIVE QUEST:
Title: ${activeQuest.title}
Description: ${activeQuest.description}
Objectives:
${objectives}

IMPORTANT: Keep this quest objective in mind. The player is working towards completing these objectives.`;
        }

        systemPrompt += `${questContext}

CURRENT GAME STATE:
${JSON.stringify(currentState, null, 2)}

Respond with JSON only. No markdown, no explanation.`;

        let content: string | null = null;
        let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;

        console.log(`[Brain] Using provider: ${provider} (Model: ${model}, Key length: ${apiKey.length})`);

        const outputSchema = {
            description: "Game logic engine output",
            type: SchemaType.OBJECT,
            properties: {
                narrativeCues: {
                    type: SchemaType.ARRAY,
                    description: "List of narrative cues for the storyteller",
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            type: {
                                type: SchemaType.STRING,
                                enum: ['action', 'dialogue', 'description', 'combat', 'discovery']
                            },
                            content: { type: SchemaType.STRING },
                            emotion: {
                                type: SchemaType.STRING,
                                enum: ['neutral', 'tense', 'triumphant', 'mysterious', 'danger'],
                                nullable: true
                            }
                        },
                        required: ['type', 'content']
                    }
                },
                diceRolls: {
                    type: SchemaType.ARRAY,
                    description: "Dice rolls performed",
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            type: { type: SchemaType.STRING },
                            result: { type: SchemaType.NUMBER },
                            modifier: { type: SchemaType.NUMBER, nullable: true },
                            total: { type: SchemaType.NUMBER },
                            purpose: { type: SchemaType.STRING, nullable: true }
                        },
                        required: ['type', 'result', 'total']
                    }
                },
                systemMessages: {
                    type: SchemaType.ARRAY,
                    description: "System messages for the player",
                    items: { type: SchemaType.STRING }
                },
                narrativeCue: { type: SchemaType.STRING, description: "Fallback narrative summary", nullable: true }
            },
            required: ['narrativeCues', 'diceRolls', 'systemMessages']
        };

        if (provider === 'google') {
            // ==================== GOOGLE GEMINI ====================
            const genAI = new GoogleGenerativeAI(apiKey);
            const geminiModel = genAI.getGenerativeModel({
                model: model,
                systemInstruction: systemPrompt,
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: outputSchema as any, // Cast to any to avoid strict SchemaType mismatch
                },
            });

            // Convert history to Gemini format
            let history = chatHistory.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }],
            }));

            // CRITICAL FIX: Google AI requires first message to be from 'user'
            // Remove any leading 'model' messages
            while (history.length > 0 && history[0].role === 'model') {
                history = history.slice(1);
            }

            // Construct the final user prompt
            const userPrompt = `PLAYER ACTION: ${userInput}
            
            Process this action according to the game mechanics instructions.
            Refer to the CURRENT GAME STATE provided in the system instruction.`;

            // Start chat matching history
            const chat = geminiModel.startChat({
                history: history,
            });

            const result = await chat.sendMessage(userPrompt);
            const response = result.response;
            content = response.text();

            usage = {
                promptTokens: response.usageMetadata?.promptTokenCount || 0,
                completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
                totalTokens: response.usageMetadata?.totalTokenCount || 0,
            };

        } else if (provider === 'anthropic') {
            // ==================== ANTHROPIC CLAUDE ====================
            const anthropic = new Anthropic({ apiKey });

            const response = await anthropic.messages.create({
                model: model, // e.g. claude-3-5-sonnet-20240620
                max_tokens: 3000,
                temperature: 0.5,
                system: systemPrompt,
                messages: [
                    ...chatHistory.map(msg => ({
                        role: (msg.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
                        content: msg.content
                    })),
                    {
                        role: 'user',
                        content: `PLAYER ACTION: ${userInput}
            
            Process this action according to the game mechanics instructions.
            
            Respond with JSON matching this structure:
            {
              "stateUpdates": { /* only changed fields */ },
              "narrativeCues": [{ "type": "...", "content": "...", "emotion": "..." }],
              "diceRolls": [{ "type": "d20", "result": N, "modifier": M, "total": T, "purpose": "..." }],
              "systemMessages": ["..."],
              "narrativeCue": "Brief narrative if Claude is unavailable"
            }`
                    }
                ]
            });

            const block = response.content[0];
            if (block.type === 'text') {
                content = block.text;
            }

            usage = {
                promptTokens: response.usage.input_tokens,
                completionTokens: response.usage.output_tokens,
                totalTokens: response.usage.input_tokens + response.usage.output_tokens
            };

        } else {
            // ==================== OPENAI GPT ====================
            const openai = new OpenAI({ apiKey });

            const messages: OpenAI.ChatCompletionMessageParam[] = [
                { role: 'system', content: systemPrompt },
            ];

            for (const msg of chatHistory) {
                messages.push({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content,
                });
            }

            messages.push({
                role: 'user',
                content: `PLAYER ACTION: ${userInput}
    
    Process this action according to the game rules. Calculate any required dice rolls, update the game state, and provide narrative cues for the storyteller.
    
    Respond with VALID JSON matching the required schema.`,
            });

            const response = await openai.chat.completions.create({
                model: model, // e.g. gpt-4o-mini
                messages,
                temperature: 0.5,
                max_tokens: 2000,
                response_format: { type: 'json_object' },
            });

            content = response.choices[0]?.message?.content || null;
            usage = {
                promptTokens: response.usage?.prompt_tokens || 0,
                completionTokens: response.usage?.completion_tokens || 0,
                totalTokens: response.usage?.total_tokens || 0
            };
        }

        if (!content) {
            return {
                success: false,
                error: 'No response from Brain model',
            };
        }

        // Extract JSON from markdown code blocks if present (for non-JSON mode models)
        let jsonText = content.trim();
        const codeBlockMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (codeBlockMatch) {
            jsonText = codeBlockMatch[1].trim();
        }
        jsonText = jsonText.trim();

        // Parse and validate response
        let parsed: any;
        try {
            parsed = JSON.parse(jsonText);
        } catch (parseError) {
            console.error('Failed to parse Brain response:', content);
            return {
                success: false,
                error: 'Invalid JSON response from Brain',
            };
        }

        // Validate with Zod
        const validated = BrainResponseSchema.safeParse(parsed);

        if (!validated.success) {
            console.error('Brain response validation failed:', validated.error);
            // Attempt partial recovery
            return {
                success: true,
                data: {
                    stateUpdates: parsed.stateUpdates || {},
                    narrativeCues: [],
                    narrativeCue: parsed.narrativeCue || 'The action was processed.',
                    diceRolls: [],
                    systemMessages: [],
                },
                usage
            };
        }

        return {
            success: true,
            data: validated.data,
            usage
        };

    } catch (error) {
        console.error('Brain processing error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Brain processing failed',
        };
    }
}

// ==================== DICE ROLLING HELPER ====================

/**
 * Roll dice and return result
 * @param diceNotation e.g., "d20", "2d6+3"
 */
export function rollDice(diceNotation: string): { rolls: number[]; total: number } {
    const match = diceNotation.match(/(\d*)d(\d+)([+-]\d+)?/);

    if (!match) {
        return { rolls: [], total: 0 };
    }

    const count = parseInt(match[1]) || 1;
    const sides = parseInt(match[2]);
    const modifier = parseInt(match[3]) || 0;

    const rolls: number[] = [];
    for (let i = 0; i < count; i++) {
        rolls.push(Math.floor(Math.random() * sides) + 1);
    }

    const total = rolls.reduce((sum, roll) => sum + roll, 0) + modifier;

    return { rolls, total };
}
