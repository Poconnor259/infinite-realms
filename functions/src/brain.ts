import { BrainInput, BrainOutput } from './utils/brain/types';
import { buildBrainSystemPrompt } from './utils/brain/promptBuilder';
import { executeGoogleGemini, executeAnthropicClaude, executeOpenAIGPT } from './utils/brain/llmProviders';
import { parseBrainResponse } from './utils/brain/responseParser';

export * from './utils/brain/types';

// ==================== MAIN BRAIN FUNCTION ====================

export async function processWithBrain(input: BrainInput): Promise<BrainOutput> {
    const { userInput, provider, model, interactiveDiceRolls = false, rollResult } = input;

    console.log(`[Brain] ========== NEW REQUEST ==========`);
    console.log(`[Brain] interactiveDiceRolls=${interactiveDiceRolls}, rollResult=${rollResult}`);
    console.log(`[Brain] provider=${provider}, model=${model}`);
    console.log(`[Brain] userInput="${userInput.substring(0, 100)}..."`);
    console.log(`[Brain] =====================================`);

    try {
        // 1. Build System Prompt
        const systemPrompt = await buildBrainSystemPrompt(input);

        // 2. Execute LLM Request
        let content: string | null = null;
        let usage: any;

        console.log(`[Brain] Using provider: ${provider} (Model: ${model})`);

        if (provider === 'google') {
            const result = await executeGoogleGemini(systemPrompt, input);
            content = result.content;
            usage = result.usage;
        } else if (provider === 'anthropic') {
            const result = await executeAnthropicClaude(systemPrompt, input);
            content = result.content;
            usage = result.usage;
        } else {
            const result = await executeOpenAIGPT(systemPrompt, input);
            content = result.content;
            usage = result.usage;
        }

        if (!content) {
            return {
                success: false,
                error: 'No response from Brain model',
            };
        }

        // 3. Parse and Validate Response
        const parseResult = parseBrainResponse(content);

        if (!parseResult.success || !parseResult.data) {
            return {
                success: false,
                error: parseResult.error || 'Invalid JSON response from Brain',
            };
        }

        return {
            success: true,
            data: parseResult.data,
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
