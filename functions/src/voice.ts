import Anthropic from '@anthropic-ai/sdk';

// ==================== TYPES ====================

interface VoiceInput {
    narrativeCues: NarrativeCue[];
    worldModule: 'classic' | 'outworlder' | 'shadowMonarch';
    chatHistory: Array<{ role: string; content: string }>;
    stateChanges: Record<string, unknown>;
    diceRolls: DiceRoll[];
    apiKey: string;
    knowledgeDocuments?: string[]; // Reference documents for context
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

// ==================== WORLD STYLE PROMPTS ====================

const WORLD_STYLES: Record<string, string> = {
    classic: `You are the NARRATOR for a classic high fantasy RPG in the style of D&D.
  
STYLE GUIDELINES:
- Write in second person ("You swing your sword...")
- Use vivid, descriptive prose suitable for epic fantasy
- Describe combat with weight and impact
- Give NPCs distinct voices and personalities
- Balance drama with moments of levity
- Reference classic fantasy tropes while keeping things fresh

TONE: Epic, heroic, occasionally humorous, always engaging.`,

    outworlder: `You are the NARRATOR for a LitRPG adventure in the style of "He Who Fights With Monsters."

STYLE GUIDELINES:
- Write in second person with snarky, modern sensibilities
- Include occasional pop culture references where fitting
- Format system messages as "Blue Box" alerts using code blocks:
  \`\`\`
  『SYSTEM MESSAGE』
  Content here
  \`\`\`
- Make abilities feel impactful and visually distinct
- Balance serious moments with witty banter
- The world should feel dangerous but also full of wonder

TONE: Witty, irreverent, action-packed, with genuine emotional moments.`,

    shadowMonarch: `You are the NARRATOR for a Solo Leveling style power fantasy.

STYLE GUIDELINES:
- Write in second person with emphasis on growing power
- Format system notifications with brackets: [SYSTEM MESSAGE]
- Combat should feel fast, brutal, and stylish
- Emphasize the contrast between the weak past and powerful present
- Shadow soldiers should feel menacing and loyal
- Build tension during dungeon raids

TONE: Intense, dramatic, power-fantasy fulfilling, occasionally ominous.`,
};

// ==================== MAIN VOICE FUNCTION ====================

export async function generateNarrative(input: VoiceInput): Promise<VoiceOutput> {
    const { narrativeCues, worldModule, chatHistory, stateChanges, diceRolls, apiKey, knowledgeDocuments } = input;

    try {
        const anthropic = new Anthropic({ apiKey });

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

        const systemPrompt = `${WORLD_STYLES[worldModule]}
${knowledgeSection}
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
7. If reference materials are provided, use them for consistent world-building.

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

        // Build messages
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
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: systemPrompt,
            messages,
        });

        // Extract text from response
        const textContent = response.content.find(block => block.type === 'text');

        if (!textContent || textContent.type !== 'text') {
            return {
                success: false,
                error: 'No text content in Voice response',
            };
        }

        const usage = {
            promptTokens: response.usage.input_tokens,
            completionTokens: response.usage.output_tokens,
            totalTokens: response.usage.input_tokens + response.usage.output_tokens
        };

        return {
            success: true,
            narrative: textContent.text,
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
        const anthropic = new Anthropic({ apiKey });

        const messagesText = messages
            .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
            .join('\n\n');

        const response = await anthropic.messages.create({
            model: 'claude-opus-4-5-20250514',
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
