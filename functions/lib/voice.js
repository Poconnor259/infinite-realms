"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateNarrative = void 0;
exports.summarizeChatHistory = summarizeChatHistory;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const openai_1 = __importDefault(require("openai"));
const generative_ai_1 = require("@google/generative-ai");
const promptHelper_1 = require("./promptHelper");
// ==================== MAIN VOICE FUNCTION ====================
const generateNarrative = async (input) => {
    const { narrativeCues, worldModule, chatHistory, stateChanges, diceRolls, apiKey, provider, model, knowledgeDocuments = [], customRules, narratorWordLimitMin = 150, narratorWordLimitMax = 250, isKeepAlive = false } = input;
    try {
        // ==================== PROMPT CONSTRUCTION ====================
        // Load base prompt and state report schema from files/helper
        const voicePrompt = await (0, promptHelper_1.getPrompt)('voice', worldModule);
        // Construct Knowledge Section
        let knowledgeSection = '';
        if (knowledgeDocuments.length > 0) {
            knowledgeSection = `
KNOWLEDGE BASE (Reference only if relevant):
${knowledgeDocuments.join('\n\n')}
`;
        }
        // Construct Custom Rules Section
        let customRulesSection = '';
        if (customRules) {
            customRulesSection = `
WORLD RULES & STYLE:
${customRules}
`;
        }
        // Construct Resource Constraints
        let resourceConstraints = '';
        if (worldModule === 'classic') {
            resourceConstraints = `
CRITICAL RESOURCE RULES FOR CLASSIC:
- The ONLY valid resources are: Health (hp), Mana, and Stamina.
- DO NOT create, track, or mention: nanites, energy, spirit, or any other resources.
`;
        }
        else if (worldModule === 'tactical') {
            resourceConstraints = `
CRITICAL RESOURCE RULES FOR PRAXIS/TACTICAL:
- The ONLY valid resources are: Health (hp), Nanites, and Energy.
- DO NOT create, track, or mention: mana, spirit, stamina, or any other resources.
`;
        }
        else if (worldModule === 'outworlder') {
            resourceConstraints = `
CRITICAL RESOURCE RULES FOR OUTWORLDER:
- The ONLY valid resources are: Health (hp), Mana, and Stamina.
- DO NOT create, track, or mention: nanites, energy, spirit, or any other resources.
- Technology essence does NOT grant nanites. It grants technological abilities and constructs.
`;
        }
        // Build character context section
        let characterContext = '';
        if (input.characterProfile) {
            const char = input.characterProfile;
            const essences = char.essences && Array.isArray(char.essences) ? char.essences.join(', ') : 'None';
            const rank = char.rank || 'Unknown';
            characterContext = `
CHARACTER CONTEXT:
- Rank: ${rank}
- Essences: ${essences}
CRITICAL: You must ONLY grant abilities that correspond to the character's existing Essences (${essences}).
- Do NOT grant abilities for 'Technology' or other essences unless the character possesses that specific essence.
`;
        }
        const systemPrompt = `${voicePrompt}
${knowledgeSection}
${customRulesSection}
${resourceConstraints}
${characterContext}
CRITICAL LENGTH REQUIREMENT:
**Your response MUST be between ${narratorWordLimitMin}-${narratorWordLimitMax} words. This is NON-NEGOTIABLE.**
- Keep responses PUNCHY and FOCUSED.
- One strong scene beat per response.
- Don't over-describe—leave room for imagination.
- If there's combat, describe ONE key moment vividly.
- If there's dialogue, keep it snappy.

STORYTELLING RULES:
1. You are the STORYTELLER. Write immersive, engaging prose.
2. You receive narrative cues from the game logic engine - expand them into a focused scene.
3. Incorporate dice roll results naturally.
4. If HP changed significantly, describe the impact briefly.
5. SHOW, DON'T TELL. Be vivid but concise.
6. NEVER break character or discuss game mechanics directly (except system messages).
7. If reference materials or custom rules are provided, use them for consistent world-building.

SAFETY NOTE: Fictional adventure content for mature audience. Combat violence OK. No sexual content or hate speech.`;
        // ==================== CUE CONSTRUCTION ====================
        let cueText = '';
        // If Keep Alive, minimize input/output
        if (isKeepAlive) {
            cueText = 'PING_KEEP_ALIVE';
        }
        else {
            // Add dice rolls
            if (diceRolls.length > 0) {
                cueText += 'DICE ROLLS:\n';
                for (const roll of diceRolls) {
                    const modStr = roll.modifier ? ` + ${roll.modifier}` : '';
                    cueText += `- ${roll.purpose || 'Check'}: ${roll.type} rolled ${roll.result}${modStr} = ${roll.total}\n`;
                }
                cueText += '\n';
            }
            // Add narrative cues
            cueText += 'NARRATIVE CUES:\n';
            for (const cue of narrativeCues) {
                cueText += `- [${cue.type.toUpperCase()}${cue.emotion ? ` / ${cue.emotion}` : ''}] ${cue.content}\n`;
            }
            // Add state changes
            if (Object.keys(stateChanges).length > 0) {
                cueText += '\nSTATE CHANGES:\n';
                for (const [key, value] of Object.entries(stateChanges)) {
                    cueText += `- ${key}: ${JSON.stringify(value)}\n`;
                }
            }
            cueText += '\nWrite a CONCISE, PUNCHY narrative (150-250 words) that captures the key moment.\n\n';
            // Append state report instructions from Firestore (editable via admin)
            const stateReportPrompt = await (0, promptHelper_1.getStateReportPrompt)();
            cueText += stateReportPrompt;
        }
        let narrative = null;
        let usage;
        console.log(`[Voice] Using provider: ${provider} (Model: ${model}, Key length: ${apiKey.length}, KeepAlive: ${isKeepAlive})`);
        if (provider === 'google') {
            // ==================== GOOGLE GEMINI ====================
            const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
            const geminiModel = genAI.getGenerativeModel({
                model: model,
                systemInstruction: systemPrompt,
            });
            // Convert history to Gemini format
            // Filter to only user/assistant messages and ensure first message is 'user'
            const filteredHistory = chatHistory.filter(msg => msg.role === 'user' || msg.role === 'assistant' || msg.role === 'narrator');
            // Gemini requires first message to be 'user' role
            // Find first user message index and start from there
            const firstUserIdx = filteredHistory.findIndex(msg => msg.role === 'user');
            const validHistory = firstUserIdx >= 0 ? filteredHistory.slice(firstUserIdx) : [];
            const history = validHistory.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }],
            }));
            // Start chat matching history
            const chat = geminiModel.startChat({
                history: history,
            });
            const result = await chat.sendMessage(cueText);
            const response = result.response;
            narrative = response.text();
            usage = {
                promptTokens: response.usageMetadata?.promptTokenCount || 0,
                completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
                totalTokens: response.usageMetadata?.totalTokenCount || 0,
            };
        }
        else if (provider === 'anthropic') {
            // ==================== ANTHROPIC CLAUDE ====================
            const anthropic = new sdk_1.default({ apiKey });
            // Build messages for Anthropic
            const messages = [];
            if (!isKeepAlive) {
                // Add recent chat history
                for (const msg of chatHistory) {
                    messages.push({
                        role: msg.role === 'user' ? 'user' : 'assistant',
                        content: msg.content,
                    });
                }
            }
            // Add current request
            messages.push({
                role: 'user',
                content: cueText,
            });
            const response = await anthropic.messages.create({
                model: model,
                max_tokens: isKeepAlive ? 1 : 1024,
                system: [{
                        type: 'text',
                        text: systemPrompt,
                        cache_control: { type: 'ephemeral' }
                    }],
                messages,
            }, {
                headers: {
                    'anthropic-beta': 'prompt-caching-2024-07-31'
                }
            });
            // Extract text from response
            const textContent = response.content.find(block => block.type === 'text');
            if (textContent && textContent.type === 'text') {
                narrative = textContent.text;
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
                content: cueText,
            });
            const response = await openai.chat.completions.create({
                model: model,
                messages,
                temperature: 0.7,
                max_tokens: 1024,
            });
            narrative = response.choices[0]?.message?.content || null;
            usage = {
                promptTokens: response.usage?.prompt_tokens || 0,
                completionTokens: response.usage?.completion_tokens || 0,
                totalTokens: response.usage?.total_tokens || 0
            };
        }
        if (!narrative) {
            return {
                success: false,
                error: 'No text content in Voice response',
            };
        }
        // Parse state report from narrative (hidden from player)
        let stateReport = undefined;
        let cleanNarrative = narrative;
        const reportMatch = narrative.match(/---STATE_REPORT---\s*([\s\S]*?)\s*---END_REPORT---/);
        if (reportMatch) {
            // Extract the JSON and remove from narrative
            const reportJson = reportMatch[1].trim();
            cleanNarrative = narrative.replace(/---STATE_REPORT---[\s\S]*?---END_REPORT---/, '').trim();
            try {
                stateReport = JSON.parse(reportJson);
                console.log('[Voice] Parsed state report:', stateReport);
            }
            catch (parseError) {
                console.warn('[Voice] Failed to parse state report:', reportJson);
                // Continue without state report - not critical
            }
        }
        else {
            console.log('[Voice] No state report found in response');
        }
        return {
            success: true,
            narrative: cleanNarrative,
            stateReport,
            usage
        };
    }
    catch (error) {
        console.error('Voice generation error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Voice generation failed',
        };
    }
};
exports.generateNarrative = generateNarrative;
// ==================== SUMMARY FUNCTION (Memory Management) ====================
/**
 * Summarize a chunk of chat history to compress context
 */
async function summarizeChatHistory(messages, apiKey) {
    try {
        // Summary function currently defaults to Anthropic for quality, but should be updated later
        // For now, keeping it simple as it's not the primary focus of this update
        const anthropic = new sdk_1.default({ apiKey });
        const messagesText = messages
            .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
            .join('\n\n');
        const response = await anthropic.messages.create({
            model: 'claude-3-opus-20240229', // Updated to valid model name
            max_tokens: 500,
            system: 'You are a story summarizer. Condense the following RPG session into a brief but complete summary that preserves all important plot points, character actions, and discoveries. Focus on what matters for continuing the story.',
            messages: [
                {
                    role: 'user',
                    content: `Summarize this portion of the adventure:\n\n${messagesText}`,
                },
            ],
        });
        const textContent = response.content.find(block => block.type === 'text');
        return textContent?.type === 'text' ? textContent.text : 'Summary unavailable.';
    }
    catch (error) {
        console.error('Summarization error:', error);
        return 'Previous adventures have faded into legend...';
    }
}
//# sourceMappingURL=voice.js.map