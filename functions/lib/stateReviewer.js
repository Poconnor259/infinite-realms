"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewStateConsistency = reviewStateConsistency;
exports.applyCorrections = applyCorrections;
const openai_1 = __importDefault(require("openai"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const generative_ai_1 = require("@google/generative-ai");
const promptHelper_1 = require("./promptHelper");
// ==================== JSON SCHEMA FOR RESPONSE ====================
const outputJsonSchema = {
    type: "object",
    properties: {
        corrections: {
            type: "object",
            description: "State changes extracted from the narrative",
            properties: {
                inventory: {
                    type: "object",
                    properties: {
                        added: { type: "array", items: { type: "string" } },
                        removed: { type: "array", items: { type: "string" } },
                        updated: { type: "object" }
                    }
                },
                hp: {
                    type: "object",
                    properties: {
                        current: { type: "number" },
                        max: { type: "number" }
                    }
                },
                mana: {
                    type: "object",
                    properties: {
                        current: { type: "number" },
                        max: { type: "number" }
                    }
                },
                nanites: {
                    type: "object",
                    properties: {
                        current: { type: "number" },
                        max: { type: "number" }
                    }
                },
                fatigue: { type: "number" },
                powers: {
                    type: "object",
                    properties: {
                        added: { type: "array", items: { type: "string" } },
                        removed: { type: "array", items: { type: "string" } }
                    }
                },
                partyMembers: {
                    type: "object",
                    properties: {
                        joined: { type: "array", items: { type: "string" } },
                        left: { type: "array", items: { type: "string" } }
                    }
                },
                gold: { type: "number" },
                experience: { type: "number" },
                questProgress: { type: "object" }
            }
        },
        reasoning: {
            type: "string",
            description: "Brief explanation of what changes were detected"
        }
    },
    required: ["corrections"]
};
// ==================== MAIN REVIEWER FUNCTION ====================
async function reviewStateConsistency(input) {
    const { narrative, currentState, worldModule, apiKey, provider, model, turnNumber } = input;
    // Check if we should run based on frequency settings
    const settings = await (0, promptHelper_1.getStateReviewerSettings)();
    if (!settings.enabled) {
        return {
            success: true,
            skipped: true,
            skipReason: 'State reviewer is disabled'
        };
    }
    // Check frequency
    if (turnNumber % settings.frequency !== 0) {
        return {
            success: true,
            skipped: true,
            skipReason: `Skipping - only runs every ${settings.frequency} turn(s)`
        };
    }
    try {
        // Get reviewer prompt from Firestore
        const reviewerPrompt = await (0, promptHelper_1.getPrompt)('reviewer', worldModule);
        // Build the system prompt
        const systemPrompt = reviewerPrompt
            .replace('{currentState}', JSON.stringify(currentState, null, 2))
            .replace('{narrative}', narrative);
        let content = null;
        let usage;
        console.log(`[StateReviewer] Using provider: ${provider} (Model: ${model})`);
        if (provider === 'openai') {
            const openai = new openai_1.default({ apiKey });
            const response = await openai.chat.completions.create({
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Review this narrative and extract any state changes:\n\n${narrative}` }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.3, // Low temperature for consistency
                max_tokens: 1000,
            });
            content = response.choices[0]?.message?.content;
            if (response.usage) {
                usage = {
                    promptTokens: response.usage.prompt_tokens,
                    completionTokens: response.usage.completion_tokens,
                    totalTokens: response.usage.total_tokens,
                };
            }
        }
        else if (provider === 'anthropic') {
            const anthropic = new sdk_1.default({ apiKey });
            const response = await anthropic.messages.create({
                model,
                system: systemPrompt,
                messages: [
                    { role: 'user', content: `Review this narrative and extract any state changes. Respond with JSON only:\n\n${narrative}` }
                ],
                max_tokens: 1000,
            });
            content = response.content[0]?.type === 'text' ? response.content[0].text : null;
            usage = {
                promptTokens: response.usage.input_tokens,
                completionTokens: response.usage.output_tokens,
                totalTokens: response.usage.input_tokens + response.usage.output_tokens,
            };
        }
        else if (provider === 'google') {
            const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
            const genModel = genAI.getGenerativeModel({
                model,
                generationConfig: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: generative_ai_1.SchemaType.OBJECT,
                        properties: {
                            corrections: {
                                type: generative_ai_1.SchemaType.OBJECT,
                                description: "State changes extracted from narrative"
                            },
                            reasoning: {
                                type: generative_ai_1.SchemaType.STRING,
                                description: "Explanation of detected changes"
                            }
                        }
                    },
                    temperature: 0.3,
                    maxOutputTokens: 1000,
                },
            });
            const result = await genModel.generateContent([
                { text: systemPrompt },
                { text: `Review this narrative and extract any state changes:\n\n${narrative}` }
            ]);
            content = result.response.text();
            const usageMetadata = result.response.usageMetadata;
            if (usageMetadata) {
                usage = {
                    promptTokens: usageMetadata.promptTokenCount || 0,
                    completionTokens: usageMetadata.candidatesTokenCount || 0,
                    totalTokens: usageMetadata.totalTokenCount || 0,
                };
            }
        }
        if (!content) {
            return {
                success: false,
                error: 'No response from AI provider'
            };
        }
        // Parse the response
        let parsed;
        try {
            // Clean up the response if needed
            let cleanedContent = content.trim();
            if (cleanedContent.startsWith('```json')) {
                cleanedContent = cleanedContent.slice(7);
            }
            if (cleanedContent.startsWith('```')) {
                cleanedContent = cleanedContent.slice(3);
            }
            if (cleanedContent.endsWith('```')) {
                cleanedContent = cleanedContent.slice(0, -3);
            }
            parsed = JSON.parse(cleanedContent);
        }
        catch (parseError) {
            console.error('[StateReviewer] Failed to parse response:', content);
            return {
                success: false,
                error: 'Failed to parse AI response as JSON'
            };
        }
        console.log(`[StateReviewer] Detected changes:`, parsed.corrections);
        console.log(`[StateReviewer] Reasoning:`, parsed.reasoning);
        return {
            success: true,
            corrections: parsed.corrections || {},
            reasoning: parsed.reasoning,
            usage
        };
    }
    catch (error) {
        console.error('[StateReviewer] Error:', error);
        return {
            success: false,
            error: error.message || 'Unknown error during state review'
        };
    }
}
// ==================== MERGE CORRECTIONS INTO STATE ====================
function applyCorrections(currentState, corrections) {
    const newState = { ...currentState };
    // Apply HP changes
    if (corrections.hp) {
        const currentHp = newState.hp || { current: 0, max: 0 };
        newState.hp = {
            current: corrections.hp.current ?? currentHp.current,
            max: corrections.hp.max ?? currentHp.max
        };
    }
    // Apply Mana changes
    if (corrections.mana) {
        const currentMana = newState.mana || { current: 0, max: 0 };
        newState.mana = {
            current: corrections.mana.current ?? currentMana.current,
            max: corrections.mana.max ?? currentMana.max
        };
    }
    // Apply Nanites changes
    if (corrections.nanites) {
        const currentNanites = newState.nanites || { current: 0, max: 0 };
        newState.nanites = {
            current: corrections.nanites.current ?? currentNanites.current,
            max: corrections.nanites.max ?? currentNanites.max
        };
    }
    // Apply Fatigue changes
    if (corrections.fatigue !== undefined) {
        newState.fatigue = corrections.fatigue;
    }
    // Apply Gold changes
    if (corrections.gold !== undefined) {
        newState.gold = corrections.gold;
    }
    // Apply Experience changes
    if (corrections.experience !== undefined) {
        newState.experience = corrections.experience;
    }
    // Apply Inventory changes
    if (corrections.inventory) {
        const currentInventory = newState.inventory || [];
        let updatedInventory = [...currentInventory];
        if (corrections.inventory.added) {
            updatedInventory.push(...corrections.inventory.added);
        }
        if (corrections.inventory.removed) {
            updatedInventory = updatedInventory.filter(item => !corrections.inventory.removed.includes(item));
        }
        newState.inventory = updatedInventory;
    }
    // Apply Powers changes
    if (corrections.powers) {
        const currentPowers = newState.powers || [];
        let updatedPowers = [...currentPowers];
        if (corrections.powers.added) {
            updatedPowers.push(...corrections.powers.added);
        }
        if (corrections.powers.removed) {
            updatedPowers = updatedPowers.filter(power => !corrections.powers.removed.includes(power));
        }
        newState.powers = updatedPowers;
    }
    // Apply Party Member changes
    if (corrections.partyMembers) {
        const currentParty = newState.partyMembers || [];
        let updatedParty = [...currentParty];
        if (corrections.partyMembers.joined) {
            updatedParty.push(...corrections.partyMembers.joined);
        }
        if (corrections.partyMembers.left) {
            updatedParty = updatedParty.filter(member => !corrections.partyMembers.left.includes(member));
        }
        newState.partyMembers = updatedParty;
    }
    // Apply Quest Progress changes
    if (corrections.questProgress) {
        const currentProgress = newState.questProgress || {};
        newState.questProgress = { ...currentProgress, ...corrections.questProgress };
    }
    return newState;
}
//# sourceMappingURL=stateReviewer.js.map