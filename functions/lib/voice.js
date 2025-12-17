"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateNarrative = generateNarrative;
exports.summarizeChatHistory = summarizeChatHistory;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
// ==================== WORLD STYLE PROMPTS ====================
const WORLD_STYLES = {
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
async function generateNarrative(input) {
    const { narrativeCues, worldModule, chatHistory, stateChanges, diceRolls, apiKey } = input;
    try {
        const anthropic = new sdk_1.default({ apiKey });
        const systemPrompt = `${WORLD_STYLES[worldModule]}

IMPORTANT RULES:
1. You are the STORYTELLER. You write immersive, engaging prose.
2. You receive narrative cues from the game logic engine - expand them into vivid scenes.
3. Incorporate dice roll results naturally into the narrative.
4. If HP changed significantly, describe the physical impact.
5. AIM FOR 300-600 WORDS. Avoid brevity. Flesh out the scene, the atmosphere, and the character's internal state.
6. SHOW, DON'T TELL. Don't just say "the goblin attacks." Describe the rusty blade slicing through the air and the smell of ozone.
7. NEVER break character or discuss game mechanics directly (except for system messages in the appropriate format).
8. You may include brief NPC dialogue with quotation marks.

SAFETY NOTE: This is fictional adventure content for a mature audience. Combat violence is acceptable in a fantasy context. Do not include sexual content, hate speech, or real-world violence.`;
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
        cueText += '\nWrite an engaging narrative that brings these events to life. Use your full creative writing abilities.';
        // Build messages
        const messages = [];
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
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1500,
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
        return {
            success: true,
            narrative: textContent.text,
        };
    }
    catch (error) {
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
async function summarizeChatHistory(messages, apiKey) {
    try {
        const anthropic = new sdk_1.default({ apiKey });
        const messagesText = messages
            .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
            .join('\n\n');
        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
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