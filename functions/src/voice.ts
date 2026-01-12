import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getPrompt, getStateReportPrompt } from './promptHelper';
import { buildCampaignLedger } from './utils/campaignLedger';

// ==================== TYPES ====================

interface VoiceInput {
    narrativeCues: NarrativeCue[];
    worldModule: string;
    chatHistory: Array<{ role: string; content: string }>;
    stateChanges: Record<string, unknown>;
    diceRolls: DiceRoll[];
    apiKey: string;
    provider: 'openai' | 'anthropic' | 'google';
    model: string;
    knowledgeDocuments?: string[]; // Reference documents for context
    customRules?: string; // Optional custom rules for the narration style
    narratorWordLimitMin?: number; // Minimum word count (default: 150)
    narratorWordLimitMax?: number; // Maximum word count (default: 250)
    enforceWordLimits?: boolean; // Whether to instruct AI to follow limits
    characterProfile?: any; // Current character state for context (DEPRECATED - use currentState)
    currentState?: any; // Full game state for Campaign Ledger
    isKeepAlive?: boolean; // If true, only refresh cache (1 token output)
    maxTokens?: number; // Optional dynamic token limit
    systemMessages?: string[]; // Game logic messages from Brain (ability activations, mana costs, etc.)
}

interface VoiceOutput {
    success: boolean;
    narrative?: string;
    stateReport?: {
        resources?: {
            health?: { current?: number; max?: number };
            nanites?: { current?: number; max?: number };
            mana?: { current?: number; max?: number };
            stamina?: { current?: number; max?: number };
            focus?: { current?: number; max?: number };
            spirit?: { current?: number; max?: number };
        };
        inventory?: {
            added?: string[];
            removed?: string[];
        };
        abilities?: {
            added?: string[];
            removed?: string[];
        };
        party?: {
            joined?: string[];
            left?: string[];
        };
        key_npcs?: {
            met?: string[];
            info?: Record<string, string>;
        };
        quests?: {
            started?: string[];
            completed?: string[];
            failed?: string[];
        };
        gold?: number;
        experience?: number;
        location_updates?: {
            current_location?: string;
            discovered?: string[];
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
    label?: string; // Added for new dice roll format
    sides?: number; // Added for new dice roll format
    outcome?: {
        success: boolean;
        target_dc?: number;
        margin?: number;
        narrative_tag?: string;
    };
}

// ==================== MAIN VOICE FUNCTION ====================

export const generateNarrative = async (input: VoiceInput): Promise<VoiceOutput> => {
    const {
        narrativeCues,
        worldModule,
        chatHistory,
        stateChanges,
        diceRolls,
        apiKey,
        provider,
        model,
        knowledgeDocuments = [],
        customRules,
        narratorWordLimitMin = 150,
        narratorWordLimitMax = 250,
        enforceWordLimits = true,
        isKeepAlive = false,
        maxTokens
    } = input;

    try {
        // ==================== PROMPT CONSTRUCTION ====================

        // Load base prompt and state report schema from files/helper
        const voicePrompt = await getPrompt('voice', worldModule);

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
        } else if (worldModule === 'tactical') {
            resourceConstraints = `
CRITICAL RESOURCE RULES FOR PRAXIS/TACTICAL:
- The ONLY valid resources are: Health (hp), Nanites, and Energy.
- DO NOT create, track, or mention: mana, spirit, stamina, or any other resources.
`;
        } else if (worldModule === 'outworlder') {
            resourceConstraints = `
CRITICAL RESOURCE RULES FOR OUTWORLDER:
- The ONLY valid resources are: Health (hp), Mana, and Stamina.
- DO NOT create, track, or mention: nanites, energy, spirit, or any other resources.
- Technology essence does NOT grant nanites. It grants technological abilities and constructs.
`;
        }

        // Build character context section using Campaign Ledger
        let characterContext = '';
        if (input.currentState || input.characterProfile) {
            const state = input.currentState || { character: input.characterProfile };
            characterContext = buildCampaignLedger(state, worldModule);

            // Add narrator-specific instructions
            characterContext += `

CRITICAL: You are the NARRATOR, not the game logic engine.
- Do NOT modify game state or grant abilities - that is handled by the Brain AI.
- When describing combat or actions, you may reference the character's known abilities to make the narrative more immersive.
- If the character uses an ability, describe it vividly, but do NOT add new abilities to their sheet.
- Use the character's name, class, race, background, and other identity details to personalize the narrative.
`;
        }

        // Build length requirement section
        let lengthRequirement = '';
        if (enforceWordLimits) {
            lengthRequirement = `
CRITICAL LENGTH REQUIREMENT:
**Your response MUST be between ${narratorWordLimitMin}-${narratorWordLimitMax} words. This is NON-NEGOTIABLE.**
- Keep responses PUNCHY and FOCUSED.
- One strong scene beat per response.
- Don't over-describe—leave room for imagination.
- If there's combat, describe ONE key moment vividly.
- If there's dialogue, keep it snappy.
`;
        }

        let systemPrompt = voicePrompt;

        // Apply template replacements
        systemPrompt = systemPrompt.replace('{{KNOWLEDGE_SECTION}}', knowledgeSection || '');
        systemPrompt = systemPrompt.replace('{{CUSTOM_RULES_SECTION}}', customRulesSection || '');
        systemPrompt = systemPrompt.replace('{{RESOURCE_CONSTRAINTS}}', resourceConstraints || '');
        systemPrompt = systemPrompt.replace('{{CHARACTER_CONTEXT}}', characterContext || '');
        systemPrompt = systemPrompt.replace('{{LENGTH_REQUIREMENT}}', lengthRequirement || '');

        // BACKWARD COMPATIBILITY: If placeholders are missing, append the content
        if (!voicePrompt.includes('{{STORYTELLING_RULES}}') && !systemPrompt.includes('STORYTELLING RULES:')) {
            systemPrompt += `
${knowledgeSection}
${customRulesSection}
${resourceConstraints}
${characterContext}
${lengthRequirement}
STORYTELLING RULES:
1. You are the STORYTELLER. Write immersive, engaging prose.
2. You receive narrative cues from the game logic engine - expand them into a focused scene.
3. Incorporate dice roll results naturally.
4. If HP changed significantly, describe the impact briefly.
5. SHOW, DON'T TELL. Be vivid but concise.
6. NEVER break character or discuss game mechanics directly (except system messages).
7. If reference materials or custom rules are provided, use them for consistent world-building.
8. CRITICAL: ALWAYS end your response with a complete thought. NEVER end mid-sentence. If you're running long, wrap up the current scene gracefully with something like "...as you consider your next move" rather than cutting off abruptly.

SAFETY NOTE: Fictional adventure content for mature audience. Combat violence OK. No sexual content or hate speech.`;
        }

        // ==================== CUE CONSTRUCTION ====================

        let cueText = '';

        // If Keep Alive, minimize input/output
        if (isKeepAlive) {
            cueText = 'PING_KEEP_ALIVE';
        } else {
            // Add dice rolls with explicit outcome status
            if (diceRolls.length > 0) {
                cueText += 'DICE ROLLS (YOU MUST RESPECT THESE OUTCOMES):\n';
                for (const roll of diceRolls) {
                    const modStr = roll.modifier ? ` + ${roll.modifier}` : '';
                    if (roll.outcome) {
                        const status = roll.outcome.success ? '✓ SUCCESS' : '✗ FAILURE';
                        const dcStr = roll.outcome.target_dc ? ` vs DC ${roll.outcome.target_dc}` : '';
                        const marginStr = roll.outcome.margin !== undefined ? ` (by ${Math.abs(roll.outcome.margin)})` : '';
                        cueText += `- ${roll.purpose || 'Check'}: ${roll.type} rolled ${roll.result}${modStr} = ${roll.total}${dcStr} → ${status}${marginStr}\n`;
                    } else {
                        cueText += `- ${roll.purpose || 'Check'}: ${roll.type} rolled ${roll.result}${modStr} = ${roll.total}\n`;
                    }
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

            // Add system messages from Brain AI (CRITICAL for ability activation consistency)
            if (input.systemMessages && input.systemMessages.length > 0) {
                cueText += '\nGAME LOGIC EVENTS (YOU MUST INCORPORATE THESE):\n';
                for (const msg of input.systemMessages) {
                    cueText += `- ${msg}\n`;
                }
            }

            cueText += `\nWrite a CONCISE, PUNCHY narrative${enforceWordLimits ? ` (${narratorWordLimitMin}-${narratorWordLimitMax} words)` : ''} that captures the key moment.\n\n`;

            // Append state report instructions from Firestore (editable via admin)
            const stateReportPrompt = await getStateReportPrompt();
            cueText += stateReportPrompt;
        }

        let narrative: string | null = null;
        let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;

        console.log(`[Voice] Using provider: ${provider} (Model: ${model}, Key length: ${apiKey.length}, KeepAlive: ${isKeepAlive})`);

        if (provider === 'google') {
            // ==================== GOOGLE GEMINI ====================
            const genAI = new GoogleGenerativeAI(apiKey);
            const geminiModel = genAI.getGenerativeModel({
                model: model,
                systemInstruction: systemPrompt,
            });

            // Convert history to Gemini format
            // Filter to only user/assistant messages and ensure first message is 'user'
            const filteredHistory = chatHistory.filter(msg =>
                msg.role === 'user' || msg.role === 'assistant' || msg.role === 'narrator'
            );

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
                generationConfig: {
                    // Only set maxOutputTokens if explicitly provided (enforced), otherwise let model use default
                    ...(isKeepAlive ? { maxOutputTokens: 1 } : maxTokens ? { maxOutputTokens: maxTokens } : {}),
                }
            });

            const result = await chat.sendMessage(cueText);
            const response = result.response;
            narrative = response.text();

            usage = {
                promptTokens: response.usageMetadata?.promptTokenCount || 0,
                completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
                totalTokens: response.usageMetadata?.totalTokenCount || 0,
            };

        } else if (provider === 'anthropic') {
            // ==================== ANTHROPIC CLAUDE ====================
            const anthropic = new Anthropic({ apiKey });

            // Build messages for Anthropic
            const messages: Anthropic.MessageParam[] = [];

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
                // Only set max_tokens if explicitly provided (enforced), otherwise use model default
                max_tokens: isKeepAlive ? 1 : (maxTokens || 8192),
                system: [{
                    type: 'text',
                    text: systemPrompt,
                    cache_control: { type: 'ephemeral' }
                } as any],
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
                content: cueText,
            });

            const response = await openai.chat.completions.create({
                model: model,
                messages,
                temperature: 0.7,
                // Only set max_tokens if explicitly provided (enforced), otherwise let model use default
                ...(maxTokens ? { max_tokens: maxTokens } : {}),
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
        let stateReport: VoiceOutput['stateReport'] = undefined;
        let cleanNarrative = narrative;

        const reportMatch = narrative.match(/---STATE_REPORT---\s*([\s\S]*?)\s*---END_REPORT---/);
        if (reportMatch) {
            // Extract the JSON and remove from narrative
            const reportJson = reportMatch[1].trim();
            cleanNarrative = narrative.replace(/---STATE_REPORT---[\s\S]*?---END_REPORT---/, '').trim();

            try {
                stateReport = JSON.parse(reportJson);
                console.log('[Voice] Parsed state report:', stateReport);
            } catch (parseError) {
                console.warn('[Voice] Failed to parse state report:', reportJson);
                // Continue without state report - not critical
            }
        } else {
            console.log('[Voice] No state report found in response');
        }

        return {
            success: true,
            narrative: cleanNarrative,
            stateReport,
            usage
        };

    } catch (error) {
        console.error('Voice generation error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Voice generation failed',
        };
    }
}

// ==================== SUMMARY FUNCTION (Memory Management) ====================

/**
 * Summarize a chunk of chat history to compress context
 */
export async function summarizeChatHistory(
    messages: Array<{ role: string; content: string }>,
    apiKey: string
): Promise<string> {
    try {
        // Summary function currently defaults to Anthropic for quality, but should be updated later
        // For now, keeping it simple as it's not the primary focus of this update
        const anthropic = new Anthropic({ apiKey });

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

    } catch (error) {
        console.error('Summarization error:', error);
        return 'Previous adventures have faded into legend...';
    }
}
