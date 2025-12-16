"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processWithBrain = processWithBrain;
exports.rollDice = rollDice;
const openai_1 = __importDefault(require("openai"));
const zod_1 = require("zod");
// ==================== WORLD MODULE PROMPTS ====================
const WORLD_PROMPTS = {
    classic: `You are the LOGIC ENGINE for a D&D 5th Edition RPG.
Rules:
- Use standard 5e rules for combat, skill checks, and saves
- Roll d20 for attacks and checks, add appropriate modifiers
- AC determines if attacks hit
- Track HP changes from damage and healing
- Manage spell slots for spellcasters
- Track inventory changes

Stats to track: HP, AC, STR, DEX, CON, INT, WIS, CHA, proficiency bonus, gold, inventory items, spell slots.`,
    outworlder: `You are the LOGIC ENGINE for a HWFWM (He Who Fights With Monsters) style RPG.
Rules:
- Characters have essence abilities tied to their essences
- Rank progression: Iron → Bronze → Silver → Gold → Diamond
- Abilities have cooldowns and mana/spirit costs
- Health scales with rank
- Generate "Blue Box" style system notifications

Stats to track: HP, Mana, Spirit, Rank, Essences (max 4), Confluence, Abilities with cooldowns.`,
    shadowMonarch: `You are the LOGIC ENGINE for a Solo Leveling style RPG.
Rules:
- Daily quests must be tracked (run, pushups, situps, squats)
- Failure to complete daily quest triggers penalty zone
- Shadow extraction can turn defeated enemies into shadow soldiers
- Stats can be allocated from stat points
- Gates have ranks from E to S

Stats to track: HP, Mana, Fatigue, STR/AGI/VIT/INT/PER, Stat Points, Shadow Army roster, Job/Title, Skills.`,
};
// ==================== JSON SCHEMA FOR RESPONSE ====================
const BrainResponseSchema = zod_1.z.object({
    stateUpdates: zod_1.z.record(zod_1.z.unknown()).describe('Updated game state fields'),
    narrativeCues: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.enum(['action', 'dialogue', 'description', 'combat', 'discovery']),
        content: zod_1.z.string(),
        emotion: zod_1.z.enum(['neutral', 'tense', 'triumphant', 'mysterious', 'danger']).optional(),
    })).describe('Cues for the narrator to expand into prose'),
    diceRolls: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.string().describe('Dice type, e.g., "d20" or "2d6"'),
        result: zod_1.z.number().describe('Raw dice result'),
        modifier: zod_1.z.number().optional().describe('Modifier added to roll'),
        total: zod_1.z.number().describe('Final total after modifiers'),
        purpose: zod_1.z.string().optional().describe('What the roll was for'),
    })).describe('Any dice rolls made'),
    systemMessages: zod_1.z.array(zod_1.z.string()).describe('Game system notifications for the player'),
    narrativeCue: zod_1.z.string().optional().describe('Simple narrative fallback if Claude is unavailable'),
});
// ==================== MAIN BRAIN FUNCTION ====================
async function processWithBrain(input) {
    const { userInput, worldModule, currentState, chatHistory, apiKey } = input;
    try {
        const openai = new openai_1.default({ apiKey });
        const systemPrompt = `${WORLD_PROMPTS[worldModule]}

CRITICAL INSTRUCTIONS:
1. You are ONLY the logic engine. You process game mechanics, not story.
2. You MUST respond with valid JSON matching the schema.
3. Calculate all dice rolls using proper randomization simulation.
4. Update only the state fields that changed.
5. Provide narrative cues for the storyteller, not full prose.
6. Include any system messages (level ups, achievements, warnings).

CURRENT GAME STATE:
${JSON.stringify(currentState, null, 2)}

Respond with JSON only. No markdown, no explanation.`;
        // Build messages array
        const messages = [
            { role: 'system', content: systemPrompt },
        ];
        // Add recent chat history for context
        for (const msg of chatHistory) {
            messages.push({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content,
            });
        }
        // Add current user input
        messages.push({
            role: 'user',
            content: `PLAYER ACTION: ${userInput}

Process this action according to the game rules. Calculate any required dice rolls, update the game state, and provide narrative cues for the storyteller.

Respond with JSON matching this structure:
{
  "stateUpdates": { /* only changed fields */ },
  "narrativeCues": [{ "type": "...", "content": "...", "emotion": "..." }],
  "diceRolls": [{ "type": "d20", "result": N, "modifier": M, "total": T, "purpose": "..." }],
  "systemMessages": ["..."],
  "narrativeCue": "Brief narrative if Claude is unavailable"
}`,
        });
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages,
            temperature: 0.7,
            max_tokens: 2000,
            response_format: { type: 'json_object' },
        });
        const content = response.choices[0]?.message?.content;
        if (!content) {
            return {
                success: false,
                error: 'No response from Brain model',
            };
        }
        // Parse and validate response
        let parsed;
        try {
            parsed = JSON.parse(content);
        }
        catch (parseError) {
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
            // Return partial data if possible
            return {
                success: true,
                data: {
                    stateUpdates: parsed.stateUpdates || {},
                    narrativeCues: [],
                    narrativeCue: parsed.narrativeCue || 'The action was processed.',
                    diceRolls: [],
                    systemMessages: [],
                },
            };
        }
        return {
            success: true,
            data: validated.data,
        };
    }
    catch (error) {
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
function rollDice(diceNotation) {
    const match = diceNotation.match(/(\d*)d(\d+)([+-]\d+)?/);
    if (!match) {
        return { rolls: [], total: 0 };
    }
    const count = parseInt(match[1]) || 1;
    const sides = parseInt(match[2]);
    const modifier = parseInt(match[3]) || 0;
    const rolls = [];
    for (let i = 0; i < count; i++) {
        rolls.push(Math.floor(Math.random() * sides) + 1);
    }
    const total = rolls.reduce((sum, roll) => sum + roll, 0) + modifier;
    return { rolls, total };
}
//# sourceMappingURL=brain.js.map