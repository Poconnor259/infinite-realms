"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processWithBrain = processWithBrain;
exports.rollDice = rollDice;
const openai_1 = __importDefault(require("openai"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const generative_ai_1 = require("@google/generative-ai");
const zod_1 = require("zod");
const promptHelper_1 = require("./promptHelper");
// ==================== JSON SCHEMA FOR RESPONSE ====================
const BrainResponseSchema = zod_1.z.object({
    stateUpdates: zod_1.z.record(zod_1.z.unknown()).optional().default({}).describe('Updated game state fields'),
    narrativeCues: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.enum(['action', 'dialogue', 'description', 'combat', 'discovery']),
        content: zod_1.z.string(),
        emotion: zod_1.z.enum(['neutral', 'tense', 'triumphant', 'mysterious', 'danger']).optional(),
    })).optional().default([]).describe('Cues for the narrator to expand into prose'),
    diceRolls: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.string().describe('Dice type, e.g., "d20" or "2d6"'),
        result: zod_1.z.number().describe('Raw dice result'),
        modifier: zod_1.z.number().optional().describe('Modifier added to roll'),
        total: zod_1.z.number().describe('Final total after modifiers'),
        purpose: zod_1.z.string().optional().describe('What the roll was for'),
    })).optional().default([]).describe('Any dice rolls made'),
    systemMessages: zod_1.z.array(zod_1.z.string()).optional().default([]).describe('Game system notifications for the player'),
    narrativeCue: zod_1.z.string().optional().describe('Simple narrative fallback if Claude is unavailable'),
    requiresUserInput: zod_1.z.boolean().optional().describe('True if player clarification is needed before proceeding'),
    pendingChoice: zod_1.z.object({
        prompt: zod_1.z.string().describe('Question to ask the player'),
        options: zod_1.z.array(zod_1.z.string()).optional().describe('Suggested choices (only if user preference allows)'),
        choiceType: zod_1.z.enum(['action', 'target', 'dialogue', 'direction', 'item', 'decision']).describe('Category of choice'),
    }).optional().describe('Player choice data when requiresUserInput is true'),
});
// ==================== MAIN BRAIN FUNCTION ====================
async function processWithBrain(input) {
    const { userInput, worldModule, currentState, chatHistory, apiKey, provider, model, knowledgeDocuments, customRules, showSuggestedChoices = true } = input;
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
        const brainPrompt = await (0, promptHelper_1.getPrompt)('brain', worldModule);
        // Check if character already has essences (for Outworlder)
        // Character data can be in multiple places depending on how state is structured
        let essenceOverrideSection = '';
        const directCharacter = currentState?.character;
        const moduleCharacter = currentState?.moduleState?.character;
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
                essenceOverrideSection = `

🚨 CRITICAL OVERRIDE - ESSENCE ALREADY SELECTED 🚨
The character has already selected their foundational essence during character creation.
- Selected Essences: ${character.essences.join(', ')}
- Rank: ${character.rank || 'Iron'}

DO NOT present essence selection options (A, B, C, D).
DO NOT run the "COMPENSATION PACKAGE — ESSENCE SELECTION" sequence.
DO NOT ask the player to choose an essence - they already have one.
The character is ALREADY awakened with the ${character.essences[0]} essence.
Skip directly to their adventure beginning with their essence already active.
Acknowledge their essence in narrative but do not offer selection.
`;
                console.log('[Brain] Essence override section added');
            }
        }
        const systemPrompt = `${brainPrompt}
${knowledgeSection}
${customRulesSection}
${essenceOverrideSection}
CRITICAL INSTRUCTIONS:
1. You are ONLY the logic engine. You process game mechanics, not story.
2. You MUST respond with valid JSON. Include a "stateUpdates" object with any changed game state fields.
3. Calculate all dice rolls using proper randomization simulation.
4. Update only the state fields that changed in the stateUpdates object.
5. Provide narrative cues for the storyteller, not full prose.
6. Include any system messages (level ups, achievements, warnings).
7. If reference materials or custom rules are provided, use them for world-consistent responses.
8. USER PREFERENCE: showSuggestedChoices = ${showSuggestedChoices}. ${showSuggestedChoices ? 'Include 2-4 options in pendingChoice.options when pausing.' : 'Do NOT include options in pendingChoice.options. Set it to null/undefined.'}

CURRENT GAME STATE:
${JSON.stringify(currentState, null, 2)}

Respond with JSON only. No markdown, no explanation.`;
        let content = null;
        let usage;
        console.log(`[Brain] Using provider: ${provider} (Model: ${model}, Key length: ${apiKey.length})`);
        const outputSchema = {
            description: "Game logic engine output",
            type: generative_ai_1.SchemaType.OBJECT,
            properties: {
                narrativeCues: {
                    type: generative_ai_1.SchemaType.ARRAY,
                    description: "List of narrative cues for the storyteller",
                    items: {
                        type: generative_ai_1.SchemaType.OBJECT,
                        properties: {
                            type: {
                                type: generative_ai_1.SchemaType.STRING,
                                enum: ['action', 'dialogue', 'description', 'combat', 'discovery']
                            },
                            content: { type: generative_ai_1.SchemaType.STRING },
                            emotion: {
                                type: generative_ai_1.SchemaType.STRING,
                                enum: ['neutral', 'tense', 'triumphant', 'mysterious', 'danger'],
                                nullable: true
                            }
                        },
                        required: ['type', 'content']
                    }
                },
                diceRolls: {
                    type: generative_ai_1.SchemaType.ARRAY,
                    description: "Dice rolls performed",
                    items: {
                        type: generative_ai_1.SchemaType.OBJECT,
                        properties: {
                            type: { type: generative_ai_1.SchemaType.STRING },
                            result: { type: generative_ai_1.SchemaType.NUMBER },
                            modifier: { type: generative_ai_1.SchemaType.NUMBER, nullable: true },
                            total: { type: generative_ai_1.SchemaType.NUMBER },
                            purpose: { type: generative_ai_1.SchemaType.STRING, nullable: true }
                        },
                        required: ['type', 'result', 'total']
                    }
                },
                systemMessages: {
                    type: generative_ai_1.SchemaType.ARRAY,
                    description: "System messages for the player",
                    items: { type: generative_ai_1.SchemaType.STRING }
                },
                narrativeCue: { type: generative_ai_1.SchemaType.STRING, description: "Fallback narrative summary", nullable: true }
            },
            required: ['narrativeCues', 'diceRolls', 'systemMessages']
        };
        if (provider === 'google') {
            // ==================== GOOGLE GEMINI ====================
            const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
            const geminiModel = genAI.getGenerativeModel({
                model: model,
                systemInstruction: systemPrompt,
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: outputSchema, // Cast to any to avoid strict SchemaType mismatch
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
        }
        else if (provider === 'anthropic') {
            // ==================== ANTHROPIC CLAUDE ====================
            const anthropic = new sdk_1.default({ apiKey });
            const response = await anthropic.messages.create({
                model: model, // e.g. claude-3-5-sonnet-20240620
                max_tokens: 3000,
                temperature: 0.5,
                system: systemPrompt,
                messages: [
                    ...chatHistory.map(msg => ({
                        role: (msg.role === 'user' ? 'user' : 'assistant'),
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
        }
        else {
            // ==================== OPENAI GPT ====================
            const openai = new openai_1.default({ apiKey });
            const messages = [
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
        let parsed;
        try {
            parsed = JSON.parse(jsonText);
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