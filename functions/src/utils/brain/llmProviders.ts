import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { BrainInput } from './types';

// Define the schema for Gemini structured output
export const geminiOutputSchema = {
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
                    purpose: { type: SchemaType.STRING, nullable: true },
                    difficulty: { type: SchemaType.NUMBER, nullable: true },
                    success: { type: SchemaType.BOOLEAN, nullable: true },
                    label: { type: SchemaType.STRING, nullable: true }
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

export async function executeGoogleGemini(
    systemPrompt: string,
    input: BrainInput
): Promise<{ content: string | null; usage: any }> {
    const { apiKey, model, chatHistory, userInput } = input;
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({
        model: model,
        systemInstruction: systemPrompt,
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: geminiOutputSchema as any,
        },
    });

    // Convert history to Gemini format
    let history = chatHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
    }));

    // CRITICAL FIX: Google AI requires first message to be from 'user'
    while (history.length > 0 && history[0].role === 'model') {
        history = history.slice(1);
    }

    const userPrompt = `PLAYER ACTION: ${userInput}
    
    Process this action according to the game mechanics instructions.
    Refer to the CURRENT GAME STATE provided in the system instruction.`;

    const chat = geminiModel.startChat({
        history: history,
    });

    const result = await chat.sendMessage(userPrompt);
    const response = result.response;
    const content = response.text();

    const usage = {
        promptTokens: response.usageMetadata?.promptTokenCount || 0,
        completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata?.totalTokenCount || 0,
    };

    return { content, usage };
}

export async function executeAnthropicClaude(
    systemPrompt: string,
    input: BrainInput
): Promise<{ content: string | null; usage: any }> {
    const { apiKey, model, chatHistory, userInput } = input;
    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
        model: model,
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
    let content: string | null = null;
    if (block.type === 'text') {
        content = block.text;
    }

    const usage = {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens
    };

    return { content, usage };
}

export async function executeOpenAIGPT(
    systemPrompt: string,
    input: BrainInput
): Promise<{ content: string | null; usage: any }> {
    const { apiKey, model, chatHistory, userInput } = input;
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
        model: model,
        messages,
        temperature: 0.5,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || null;
    const usage = {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0
    };

    return { content, usage };
}
