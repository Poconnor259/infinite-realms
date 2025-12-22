import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getPrompt } from './promptHelper';

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
}

interface VoiceOutput {
    success: boolean;
    narrative?: string;
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

// ==================== MAIN VOICE FUNCTION ====================

export async function generateNarrative(input: VoiceInput): Promise<VoiceOutput> {
    const { narrativeCues, worldModule, chatHistory, stateChanges, diceRolls, apiKey, provider, model, knowledgeDocuments, customRules } = input;

    try {
        // Build knowledge base section if documents exist
        let knowledgeSection = '';
        if (knowledgeDocuments && knowledgeDocuments.length > 0) {
            knowledgeSection = `

REFERENCE MATERIALS (Use for world context, tone, and lore):
---
${knowledgeDocuments.join('\n\n---\n\n')}
---
`;
        }

        let customRulesSection = '';
        if (customRules) {
            customRulesSection = `

WORLD-SPECIFIC STYLE RULES (PRIORITIZE THESE):
---
${customRules}
---
`;
        }

        // Get voice prompt from Firestore
        const voicePrompt = await getPrompt('voice', worldModule);

        const systemPrompt = `${voicePrompt}
${knowledgeSection}
${customRulesSection}
CRITICAL LENGTH REQUIREMENT:
**Your response MUST be between 150-250 words. This is NON-NEGOTIABLE.**
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

        // Build the prompt from narrative cues
        let cueText = 'The game engine has processed the following:\n\n';

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

        cueText += '\nWrite a CONCISE, PUNCHY narrative (150-250 words) that captures the key moment.';

        let narrative: string | null = null;
        let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;

        console.log(`[Voice] Using provider: ${provider} (Model: ${model}, Key length: ${apiKey.length})`);

        if (provider === 'google') {
            // ==================== GOOGLE GEMINI ====================
            const genAI = new GoogleGenerativeAI(apiKey);
            const geminiModel = genAI.getGenerativeModel({
                model: model,
                systemInstruction: systemPrompt,
            });

            // Convert history to Gemini format
            const history = chatHistory.map(msg => ({
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

        } else if (provider === 'anthropic') {
            // ==================== ANTHROPIC CLAUDE ====================
            const anthropic = new Anthropic({ apiKey });

            // Build messages for Anthropic
            const messages: Anthropic.MessageParam[] = [];

            // Add recent chat history
            for (const msg of chatHistory) {
                messages.push({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content,
                });
            }

            // Add current request
            messages.push({
                role: 'user',
                content: cueText,
            });

            const response = await anthropic.messages.create({
                model: model,
                max_tokens: 1024,
                system: systemPrompt,
                messages,
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

        return {
            success: true,
            narrative,
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
