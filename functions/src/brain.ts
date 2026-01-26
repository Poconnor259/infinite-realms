import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { z } from 'zod';
import { getPrompt } from './promptHelper';
import { getActiveQuest, type GameState } from './utils/stateHelpers';
import { buildCampaignLedger } from './utils/campaignLedger';

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
    pendingRoll?: {
        type: string;
        purpose: string;
        modifier?: number;
        stat?: string;
        difficulty?: number;
    };
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

// ==================== JSON REPAIR HELPER ====================

/**
 * Attempt to repair malformed JSON by extracting valid objects
 * Tries multiple patterns to find usable Brain response data
 */
function repairJsonResponse(raw: string): object | null {
    console.log('[Brain] Attempting JSON repair with multiple strategies...');

    // Strategy 1: Try to find complete JSON object with stateUpdates
    const patterns = [
        /\{[\s\S]*"stateUpdates"[\s\S]*"narrativeCues"[\s\S]*\}/,
        /\{[\s\S]*"narrativeCues"[\s\S]*"diceRolls"[\s\S]*\}/,
        /\{[\s\S]*"narrativeCue"[\s\S]*\}/,
    ];

    for (const pattern of patterns) {
        const match = raw.match(pattern);
        if (match) {
            try {
                const parsed = JSON.parse(match[0]);
                console.log('[Brain] Repair successful with pattern match');
                return parsed;
            } catch {
                // Continue to next pattern
            }
        }
    }

    // Strategy 2: Try to extract just the first complete object
    const firstBrace = raw.indexOf('{');
    if (firstBrace !== -1) {
        let braceCount = 0;
        let inString = false;
        let escapeNext = false;

        for (let i = firstBrace; i < raw.length; i++) {
            const char = raw[i];

            if (escapeNext) {
                escapeNext = false;
                continue;
            }

            if (char === '\\') {
                escapeNext = true;
                continue;
            }

            if (char === '"') {
                inString = !inString;
                continue;
            }

            if (!inString) {
                if (char === '{') braceCount++;
                if (char === '}') braceCount--;

                if (braceCount === 0) {
                    const extracted = raw.substring(firstBrace, i + 1);
                    try {
                        const parsed = JSON.parse(extracted);
                        console.log('[Brain] Repair successful with brace matching');
                        return parsed;
                    } catch {
                        break;
                    }
                }
            }
        }
    }

    console.log('[Brain] All repair strategies failed');
    return null;
}

// ==================== MAIN BRAIN FUNCTION ====================

export async function processWithBrain(input: BrainInput): Promise<BrainOutput> {

    const { userInput, worldModule, currentState, chatHistory, apiKey, provider, model, knowledgeDocuments, customRules, showSuggestedChoices = true, interactiveDiceRolls = false, rollResult, pendingRoll } = input;

    console.log(`[Brain] ========== NEW REQUEST ==========`);
    console.log(`[Brain] interactiveDiceRolls=${interactiveDiceRolls}, rollResult=${rollResult}`);
    console.log(`[Brain] provider=${provider}, model=${model}`);
    console.log(`[Brain] userInput="${userInput.substring(0, 100)}..."`);
    console.log(`[Brain] =====================================`);

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

        // DEBUG: Check if prompt has the interactive dice placeholder
        const hasInteractiveDicePlaceholder = brainPrompt.includes('{{INTERACTIVE_DICE_RULES}}');
        console.log(`[Brain] 🔍 Prompt analysis:`);
        console.log(`[Brain]   - interactiveDiceRolls setting: ${interactiveDiceRolls}`);
        console.log(`[Brain]   - Prompt has {{INTERACTIVE_DICE_RULES}}: ${hasInteractiveDicePlaceholder}`);
        console.log(`[Brain]   - Prompt length: ${brainPrompt.length} chars`);

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

                // Helper to format abilities for display (handles both string[] and object[])
                const formatAbilityList = (abilities: any[]): string => {
                    if (!abilities || abilities.length === 0) return 'None yet';
                    return abilities.map(a => typeof a === 'string' ? a : a.name || 'Unknown').join(', ');
                };

                // Helper to format essences (handles both string[] and object[])
                const formatEssenceList = (essences: any[]): string => {
                    if (!essences || essences.length === 0) return 'None yet';
                    return essences.map(e => typeof e === 'string' ? e : e.name || 'Unknown').join(', ');
                };

                // Build the base override section
                essenceOverrideSection = `

🚨 CRITICAL OVERRIDE - ALL ESSENCES AND ABILITIES ARE ACTIVE 🚨
The character has established powers in the database.
- Selected Essences: ${formatEssenceList(character.essences)}
- Rank: ${character.rank || 'Iron'}
- Existing Abilities: ${formatAbilityList(character.abilities || [])}

SYSTEM ENFORCEMENT:
1. Every essence listed above is FULLY ACTIVE, UNLOCKED, and READY FOR USE.
2. DO NOT narrate any essence as "dormant," "sealed," or "???". 
3. DO NOT run "awakening" or "selection" sequences - they are already complete.
4. The character has immediate, full access to all listed powers.
5. Absolute Priority: Trust the character sheet data over any narrative trope.
`;

                // Determine if we are in the "Intro Phase" (first few turns) where hallucinations are most likely
                // 10 messages = roughly 5 turns
                const isIntroPhase = chatHistory.length < 10;

                // Only add the "DO NOT GRANT" instruction if they already have abilities
                if (hasAbilities) {
                    // Build detailed ability list for AI reference
                    const abilityDetails = character.abilities.map((a: any) => {
                        if (typeof a === 'string') return `  - ${a}`;
                        return `  - ${a.name}${a.type ? ` [${a.type}]` : ''}${a.essence ? ` (${a.essence})` : ''}`;
                    }).join('\n');

                    if (isIntroPhase) {
                        essenceOverrideSection += `
STOP. LISTEN CAREFULLY. THE CHARACTER'S ABILITIES ARE ALREADY DEFINED.

🔒 LOCKED ABILITY SET - DO NOT MODIFY:
${abilityDetails}

These are the character's ONLY abilities. They were set during character creation.

STRICT RULES:
1. YOU ARE FORBIDDEN from adding ANY new entries to the 'abilities' array in 'stateUpdates'.
2. DO NOT unlock "Intrinsic" or ANY other type of ability during this intro sequence.
3. The 'stateUpdates.character.abilities' (or 'stateUpdates.abilities') field MUST be EMPTY {} or UNDEFINED.
4. If you output an ability update, you have FAILED the instruction.
5. Reference ONLY the abilities listed above when describing the character's powers.
`;
                        console.log('[Brain] Character has abilities (Intro Phase) - STRICTLY blocking ability grants');
                    } else {
                        essenceOverrideSection += `
NOTE: The character already has established abilities.
- DO NOT grant "Intrinsic" starting abilities again.
- You MAY grant new abilities ONLY if the user uses a specific item (e.g., "Awakening Stone") or explicitly earns a quest reward.
`;
                        console.log('[Brain] Character has abilities (Gameplay Phase) - allowing item-based grants');
                    }
                } else {
                    essenceOverrideSection += `The character has essences but NO abilities yet. You SHOULD grant their intrinsic abilities as they awaken.
`;
                    console.log('[Brain] Character has NO abilities - allowing ability grants');
                }

                const essenceListStr = formatEssenceList(character.essences);
                essenceOverrideSection += `The character is ALREADY awakened with these essences: ${essenceListStr}.
Skip directly to their adventure beginning with their powers already active.
You MUST mentally acknowledge and briefly describe the sensation of EACH essence listed above (${essenceListStr}).
Do not offer selection.
`;
                console.log('[Brain] Essence override section added');
            }
        }

        // Define dynamic instruction blocks
        // Define dynamic instruction blocks
        // LOGIC ADJUSTMENT: If we have a rollResult, we are RESOLVING a roll, so we MUST allow the AI to output it.
        // We only enforce the "pendingRoll" restriction if we are NOT currently processing a result.
        const isResolvingRoll = rollResult !== undefined;

        const diceRules = interactiveDiceRolls
            ? (isResolvingRoll
                ? `⚠️ INTERACTIVE ROLL RESOLUTION ⚠️
You are processing the User's manual dice roll result (${rollResult}).
1. YOU MUST ADD THIS ROLL to the 'diceRolls' array in your response.
   Structure: { "type": "${pendingRoll?.type || 'd20'}", "result": ${rollResult}, "modifier": ${pendingRoll?.modifier || 0}, "total": ${(rollResult || 0) + (pendingRoll?.modifier || 0)}, "purpose": "${pendingRoll?.purpose || 'Action'}" }
2. DO NOT set "requiresUserInput": true (unless a *different* follow-up action needs a roll).
3. DO NOT set "pendingRoll" for this same action again.
4. Continue the narrative based on this result.`
                : `⚠️ CRITICAL - INTERACTIVE DICE MODE IS ACTIVE ⚠️
This is a MANDATORY requirement. When ANY situation requires a dice roll, you MUST:

1. Set "requiresUserInput": true
2. Set "pendingRoll" with the exact structure shown below
3. Leave "diceRolls" as an EMPTY array []
4. In "narrativeCues", describe ONLY the setup, NOT the outcome

REQUIRED pendingRoll JSON structure:
{
  "type": "d20",           // Required: "d20", "2d6", "d100", etc.
  "purpose": "Attack Roll vs Goblin",  // Required: Clear description
  "modifier": 5,           // Optional: Number bonus/penalty
  "stat": "Strength",      // Optional: Related stat
  "difficulty": 15         // REQUIRED for DC checks - ALWAYS include the target DC number
}

TRIGGERS for pendingRoll (ANY of these = MUST use pendingRoll):
- Combat attacks (melee, ranged, spell)
- Skill checks (stealth, perception, persuasion, etc.)
- Saving throws (reflex, will, fortitude)
- Ability checks (strength, dexterity, etc.)
- Damage rolls (only AFTER hit confirmed by previous roll)

SAFE USAGE vs COMBAT RULES:
1. COMBAT & OFFENSE (ALWAYS ROLL):
   - ANY attack, offensive spell, or hostile action MUST require a roll.
   - NEVER assume success for an attack, even if the ability is innate.
   - Triggers: "Attack", "Cast [Damage Spell]", "Strike", "Shoot".
   - Set "diceRolls": [] and "requiresUserInput": true for these actions.

2. CHALLENGE & RISK (ALWAYS ROLL):
   - Actions with a chance of failure (climbing, persuading, sneaking).

3. UTILITY & FLAVOR (AUTO-SUCCESS):
   - Routine usage of known abilities in safe environments DOES NOT require a roll.
   - Examples: summoning a mount, opening a personal portal, lighting a magic torch.

DO NOT resolve outcomes. Wait for user's roll result.
DO NOT auto-roll. Leave diceRolls as [].`)
            : 'Calculate all dice rolls using proper randomization simulation and include them in diceRolls array.';

        const choicesRule = `USER PREFERENCE: showSuggestedChoices = ${showSuggestedChoices}. 
${showSuggestedChoices
                ? 'ALWAYS include a "pendingChoice" object with 2-4 "options" representing suggested next actions (e.g., "Attack", "Search", "Ask about..."). Set "requiresUserInput": true to ensure these are displayed.'
                : 'Do NOT include options in pendingChoice.options. Set it to null/undefined.'}`;

        const rollResultRule = rollResult !== undefined
            ? `🎲 DICE ROLL RESULT RECEIVED: ${rollResult}
CONTEXT: The user rolled for "${pendingRoll?.purpose || 'unknown purpose'}".
${pendingRoll ? `Target DC: ${pendingRoll.difficulty || 'None'}, Modifier: ${pendingRoll.modifier || 0}, Stat: ${pendingRoll.stat || 'None'}` : ''}

⚠️ CRITICAL ROLL INTEGRITY RULES - STRICTLY ENFORCE ⚠️

The user has rolled ${rollResult}. This is the EXACT, FINAL dice result.

MANDATORY REQUIREMENTS:
1. **RESPECT THE TRAINING DOCUMENT**: Follow the "Dice Role specifics" training document EXACTLY
2. **NO MODIFIER INVENTION**: DO NOT add modifiers that weren't in the original pendingRoll.modifier (${pendingRoll?.modifier || 0})
3. **NO FAKE BONUSES**: DO NOT invent Spirit, Luck, Divine Favor, or ANY other modifiers to change the outcome
4. **HONEST CALCULATION**: Success/Failure = (${rollResult} + ${pendingRoll?.modifier || 0}) vs DC ${pendingRoll?.difficulty || 'N/A'}
5. **ALLOW FAILURES**: If the roll fails, IT FAILS - implement negative consequences (damage, failed checks, setbacks, complications)
6. **RESPECT RANDOMNESS**: The dice represent fate and chance - honor that uncertainty
7. **PROCESS HONESTLY**: Continue the narrative based on the actual result, not a desired outcome
8. **NO RE-ROLLS**: Do NOT request another roll for the same action

The training document contains the complete dice mechanics. Follow it precisely. Do NOT deviate to force success.`
            : '';

        let systemPrompt = brainPrompt;

        // Apply template replacements
        systemPrompt = systemPrompt.replace('{{KNOWLEDGE_SECTION}}', knowledgeSection || '');
        systemPrompt = systemPrompt.replace('{{CUSTOM_RULES_SECTION}}', customRulesSection || '');
        systemPrompt = systemPrompt.replace('{{ESSENCE_OVERRIDE_SECTION}}', essenceOverrideSection || '');
        systemPrompt = systemPrompt.replace('{{INTERACTIVE_DICE_RULES}}', diceRules);
        systemPrompt = systemPrompt.replace('{{SUGGESTED_CHOICES_RULES}}', choicesRule);
        systemPrompt = systemPrompt.replace('{{ROLL_RESULT_RULE}}', rollResultRule);

        // CRITICAL: Add dice rules at ABSOLUTE TOP of prompt for visibility
        // but ONLY if we are NOT resolving a roll (otherwise it conflicts with the resolution instruction)
        if (interactiveDiceRolls && !isResolvingRoll) {
            const CRITICAL_DICE_HEADER = `
🚨🚨🚨 CRITICAL MANDATORY RULE - READ THIS FIRST 🚨🚨🚨

INTERACTIVE DICE MODE IS ACTIVE

When ANY action requires a dice roll, you MUST:
1. SET "pendingRoll" object with: type, purpose, modifier, stat, difficulty
2. SET "requiresUserInput": true
3. LEAVE "diceRolls": [] (empty array)
4. DO NOT describe the roll outcome - STOP before resolution

VIOLATING THIS RULE IS A SYSTEM ERROR.

🚨🚨🚨 END CRITICAL RULE 🚨🚨🚨

`;
            systemPrompt = CRITICAL_DICE_HEADER + systemPrompt;
        }

        // Add world-specific stat context
        const WORLD_STAT_CONTEXT: Record<string, string> = {
            classic: '\n📊 STATS: Use D&D 5E stats: STR, DEX, CON, INT, WIS, CHA\n',
            outworlder: '\n📊 STATS: Use Outworlder stats ONLY: power, speed, spirit, recovery. NEVER use D&D stat names (STR/DEX/WIS/etc).\n',
            tactical: '\n📊 STATS: Use Tactical stats ONLY: strength, agility, vitality, intelligence, perception. NEVER use D&D stat names (STR/DEX/WIS/etc).\n',
        };
        systemPrompt = (WORLD_STAT_CONTEXT[worldModule] || '') + systemPrompt;

        // Log if dice rules were injected
        if (interactiveDiceRolls) {
            console.log(`[Brain] 🎲 INTERACTIVE DICE MODE ACTIVE:`);
            console.log(`[Brain]   - diceRules length: ${diceRules.length} chars`);
            console.log(`[Brain]   - diceRules starts with: "${diceRules.substring(0, 100)}..."`);
            // Verify the rules made it into the prompt
            const hasInteractiveRulesInPrompt = systemPrompt.includes('INTERACTIVE DICE MODE');
            const hasPendingRollInPrompt = systemPrompt.includes('pendingRoll');
            console.log(`[Brain]   - Final prompt has INTERACTIVE DICE MODE: ${hasInteractiveRulesInPrompt}`);
            console.log(`[Brain]   - Final prompt mentions pendingRoll: ${hasPendingRollInPrompt}`);
        } else {
            console.log(`[Brain] 🎲 AUTO DICE MODE (not interactive)`);
        }

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

${buildCampaignLedger(currentState, worldModule)}

CURRENT GAME STATE (RAW):
${JSON.stringify(currentState, null, 2)}

Respond with JSON only. No markdown, no explanation.`;

        let content: string | null = null;
        let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;

        console.log(`[Brain] Using provider: ${provider} (Model: ${model}, Key length: ${apiKey.length})`);

        const outputSchema = {
            description: "Game logic engine output",
            type: SchemaType.OBJECT,
            properties: {
                stateUpdates: {
                    type: SchemaType.OBJECT,
                    description: "Updated game state fields",
                    nullable: true
                },
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
                narrativeCue: { type: SchemaType.STRING, description: "Fallback narrative summary", nullable: true },
                requiresUserInput: {
                    type: SchemaType.BOOLEAN,
                    description: "True if player needs to roll dice or make a choice",
                    nullable: true
                },
                pendingRoll: {
                    type: SchemaType.OBJECT,
                    description: "Dice roll request for interactive mode",
                    properties: {
                        type: { type: SchemaType.STRING, description: "Dice type, e.g., 'd20' or '2d6'" },
                        purpose: { type: SchemaType.STRING, description: "What the roll is for" },
                        modifier: { type: SchemaType.NUMBER, nullable: true, description: "Modifier to add" },
                        stat: { type: SchemaType.STRING, nullable: true, description: "Related stat name" },
                        difficulty: { type: SchemaType.NUMBER, nullable: true, description: "DC/Target number" }
                    },
                    required: ['type', 'purpose'],
                    nullable: true
                },
                pendingChoice: {
                    type: SchemaType.OBJECT,
                    description: "Choice prompt for player",
                    properties: {
                        prompt: { type: SchemaType.STRING, description: "Question to ask" },
                        options: {
                            type: SchemaType.ARRAY,
                            items: { type: SchemaType.STRING },
                            nullable: true,
                            description: "Suggested choices"
                        },
                        choiceType: {
                            type: SchemaType.STRING,
                            enum: ['action', 'target', 'dialogue', 'direction', 'item', 'decision'],
                            description: "Category of choice"
                        }
                    },
                    required: ['prompt', 'choiceType'],
                    nullable: true
                }
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
            console.error('[Brain] Failed to parse JSON, attempting repair...', parseError);

            // Try to repair JSON by extracting valid objects
            const repaired = repairJsonResponse(jsonText);
            if (repaired) {
                console.log('[Brain] Successfully repaired JSON response');
                parsed = repaired;
            } else {
                console.error('[Brain] JSON repair failed. Original content:', content.substring(0, 500));
                return {
                    success: false,
                    error: 'Invalid JSON response from Brain (repair failed)',
                };
            }
        }


        // Log the raw parsed response
        console.log(`[Brain] 📦 RAW RESPONSE:`);
        console.log(`[Brain] - requiresUserInput: ${parsed.requiresUserInput}`);
        console.log(`[Brain] - pendingRoll exists: ${!!parsed.pendingRoll}`);
        console.log(`[Brain] - pendingChoice exists: ${!!parsed.pendingChoice}`);
        if (parsed.pendingRoll) {
            console.log(`[Brain] - pendingRoll data:`, JSON.stringify(parsed.pendingRoll));
        }

        // Normalize common AI response quirks before validation
        if (parsed.narrativeCues && typeof parsed.narrativeCues === 'string') {
            console.log('[Brain] Normalizing narrativeCues from string to array');
            parsed.narrativeCues = [{ type: 'description', content: parsed.narrativeCues }];
        }
        if (parsed.systemMessages && typeof parsed.systemMessages === 'string') {
            parsed.systemMessages = [parsed.systemMessages];
        }

        // Validate with Zod
        const validated = BrainResponseSchema.safeParse(parsed);

        if (!validated.success) {
            console.warn('Brain response validation failed, attempting robust recovery:', validated.error.message);

            // ROBUST RECOVERY: Preserve as much as possible even if validation fails
            return {
                success: true,
                data: {
                    stateUpdates: parsed.stateUpdates || {},
                    narrativeCues: Array.isArray(parsed.narrativeCues) ? parsed.narrativeCues : [],
                    narrativeCue: (Array.isArray(parsed.narrativeCues) && parsed.narrativeCues.length > 0 ? parsed.narrativeCues.map((c: any) => c.content).join(' ') : (parsed.narrativeCue || 'The action was processed.')),
                    diceRolls: Array.isArray(parsed.diceRolls) ? parsed.diceRolls : [],
                    systemMessages: Array.isArray(parsed.systemMessages) ? parsed.systemMessages : [],
                    requiresUserInput: !!parsed.requiresUserInput,
                    pendingChoice: parsed.pendingChoice || undefined,
                    pendingRoll: parsed.pendingRoll || undefined,
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
