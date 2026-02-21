import { z } from 'zod';

export interface BrainInput {
    userInput: string;
    worldModule: string;
    currentState: Record<string, unknown>;
    chatHistory: Array<{ role: string; content: string }>;
    apiKey: string;
    provider: 'openai' | 'anthropic' | 'google';
    model: string;
    knowledgeDocuments?: string[]; // Reference documents for context
    customRules?: string; // Optional custom rules for the AI logic
    showSuggestedChoices?: boolean; // Whether to include options in pendingChoice (default: true)
    interactiveDiceRolls?: boolean; // Whether user wants to roll dice manually (default: false = auto-roll)
    rollResult?: number; // Result from user's dice roll when continuing after pendingRoll
    pendingRoll?: {
        type: string;
        purpose: string;
        modifier?: number;
        stat?: string;
        difficulty?: number;
    };
}

export interface BrainOutput {
    success: boolean;
    data?: {
        stateUpdates: Record<string, unknown>;
        narrativeCues: NarrativeCue[];
        narrativeCue?: string; // Simple fallback narrative
        diceRolls: DiceRoll[];
        systemMessages: string[];
        requiresUserInput?: boolean; // True = pause for player clarification
        pendingChoice?: {
            prompt: string; // What to ask the player
            options?: string[]; // Suggested choices (only if user preference allows)
            choiceType: 'action' | 'target' | 'dialogue' | 'direction' | 'item' | 'decision';
        };
        pendingRoll?: {
            type: string;           // "d20", "2d6", etc.
            purpose: string;        // "Attack Roll", "Saving Throw", etc.
            modifier?: number;      // +5, -2, etc.
            stat?: string;          // "Strength", "Dexterity" (for display)
            difficulty?: number;    // DC/Target number (optional)
        };
    };
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    error?: string;
}

export interface NarrativeCue {
    type: 'action' | 'dialogue' | 'description' | 'combat' | 'discovery';
    content: string;
    emotion?: 'neutral' | 'tense' | 'triumphant' | 'mysterious' | 'danger';
}

export interface DiceRoll {
    type: string;
    result: number;
    modifier?: number;
    total: number;
    purpose?: string;
    difficulty?: number;
    success?: boolean;
    label?: string;
}

// ==================== JSON SCHEMA FOR RESPONSE ====================

export const BrainResponseSchema = z.object({
    stateUpdates: z.record(z.unknown()).optional().default({}).describe('Updated game state fields'),
    narrativeCues: z.array(z.object({
        type: z.enum(['action', 'dialogue', 'description', 'combat', 'discovery']),
        content: z.string(),
        emotion: z.enum(['neutral', 'tense', 'triumphant', 'mysterious', 'danger']).optional(),
    })).optional().default([]).describe('Cues for the narrator to expand into prose'),
    diceRolls: z.array(z.object({
        type: z.string().describe('Dice type, e.g., "d20" or "2d6"'),
        result: z.number().describe('Raw dice result'),
        modifier: z.number().optional().describe('Modifier added to roll'),
        total: z.number().describe('Final total after modifiers'),
        purpose: z.string().optional().describe('What the roll was for, e.g. "Attack roll vs Orc"'),
        difficulty: z.number().optional().describe('DC/Target number if applicable'),
        success: z.boolean().optional().describe('True if total >= difficulty'),
        label: z.string().optional().describe('Short display label for UI'),
    })).optional().default([]).describe('Any dice rolls made'),
    systemMessages: z.array(z.string()).optional().default([]).describe('Game system notifications for the player'),
    narrativeCue: z.string().optional().describe('Simple narrative fallback if Claude is unavailable'),
    requiresUserInput: z.boolean().optional().describe('True if player clarification is needed before proceeding'),
    pendingChoice: z.object({
        prompt: z.string().describe('Question to ask the player'),
        options: z.array(z.string()).optional().describe('Suggested choices (only if user preference allows)'),
        choiceType: z.enum(['action', 'target', 'dialogue', 'direction', 'item', 'decision']).describe('Category of choice'),
    }).optional().describe('Player choice data when requiresUserInput is true'),
    pendingRoll: z.object({
        type: z.string().describe('Dice type, e.g., "d20" or "2d6"'),
        purpose: z.string().describe('What the roll is for, e.g., "Attack Roll" or "Perception Check"'),
        modifier: z.number().optional().describe('Modifier to add to roll'),
        stat: z.string().optional().describe('Related stat, e.g., "Strength" or "Dexterity"'),
        difficulty: z.number().optional().describe('DC/Target number for success'),
    }).optional().describe('Pending dice roll when user needs to roll interactively'),
});
