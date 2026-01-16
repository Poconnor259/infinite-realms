"use strict";
// Type definitions for game state and world modules
Object.defineProperty(exports, "__esModule", { value: true });
exports.AVAILABLE_MODELS = exports.DEFAULT_SUBSCRIPTION_PERMISSIONS = exports.DEFAULT_TOP_UP_PACKAGES = exports.DEFAULT_SUBSCRIPTION_PRICING = exports.DEFAULT_SUBSCRIPTION_LIMITS = void 0;
exports.DEFAULT_SUBSCRIPTION_LIMITS = {
    scout: 50,
    adventurer: 1500,
    hero: 4500,
    legendary: Infinity, // BYOK = unlimited
};
exports.DEFAULT_SUBSCRIPTION_PRICING = {
    scout: { price: 0, displayPrice: 'Free' },
    adventurer: { price: 999, displayPrice: '$9.99/month', priceId: 'price_1Sj2flKYDhEuBvZw2mxvmxzZ' }, // sub_adventurer
    hero: { price: 2999, displayPrice: '$29.99/month', priceId: 'price_1Sj2o7KYDhEuBvZwAACQIHSv' }, // sub_hero
    legendary: { price: 3999, displayPrice: '$39.99 one-time', priceId: 'price_1Sj3AFKYDhEuBvZwvhdEZRjA' }, // ot_legendary
};
exports.DEFAULT_TOP_UP_PACKAGES = [
    { id: 'topup_750', turns: 750, price: 499, displayPrice: '$4.99', priceId: 'price_1Sj374KYDhEuBvZwdo8htCVx' },
    { id: 'topup_1500', turns: 1500, price: 999, displayPrice: '$9.99', priceId: 'price_1Sj388KYDhEuBvZwsryc5wTj' },
];
// Default model permissions per tier
// Scout: Gemini Flash only (1 turn/action)
// Adventurer & Hero: All models (Gemini Flash 1 turn, Sonnet 4 turns, Opus 20 turns)
// Legendary: All models (unlimited with BYOK)
exports.DEFAULT_SUBSCRIPTION_PERMISSIONS = {
    scout: { allowedModels: ['gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-2.0-flash-exp'] },
    adventurer: { allowedModels: ['gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-2.0-flash-exp', 'claude-3-5-sonnet-20241022', 'claude-opus-4-20250514'] },
    hero: { allowedModels: ['gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-2.0-flash-exp', 'claude-3-5-sonnet-20241022', 'claude-opus-4-20250514'] },
    legendary: { allowedModels: ['gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-2.0-flash-exp', 'claude-3-5-sonnet-20241022', 'claude-opus-4-20250514', 'gpt-4o', 'gpt-4o-mini'] },
};
exports.AVAILABLE_MODELS = [
    // OpenAI Models
    {
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        defaultPricing: { prompt: 2.50, completion: 10.00 },
        defaultTurnCost: 10,
        description: 'Most capable OpenAI model'
    },
    {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'openai',
        defaultPricing: { prompt: 0.15, completion: 0.60 },
        defaultTurnCost: 1,
        description: 'Fast and cost-effective'
    },
    {
        id: 'o1-preview',
        name: 'o1 Preview',
        provider: 'openai',
        defaultPricing: { prompt: 15.00, completion: 60.00 },
        defaultTurnCost: 15,
        description: 'Advanced reasoning'
    },
    {
        id: 'o1-mini',
        name: 'o1 Mini',
        provider: 'openai',
        defaultPricing: { prompt: 3.00, completion: 12.00 },
        defaultTurnCost: 3,
        description: 'Efficient reasoning'
    },
    // Anthropic Models
    {
        id: 'claude-3-5-sonnet-latest',
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        defaultPricing: { prompt: 3.00, completion: 15.00 },
        defaultTurnCost: 10,
        description: 'Intelligent and versatile'
    },
    {
        id: 'claude-3-5-haiku-latest',
        name: 'Claude 3.5 Haiku',
        provider: 'anthropic',
        defaultPricing: { prompt: 0.80, completion: 4.00 },
        defaultTurnCost: 1,
        description: 'Extremely fast'
    },
    {
        id: 'claude-3-opus-latest',
        name: 'Claude 3 Opus',
        provider: 'anthropic',
        defaultPricing: { prompt: 15.00, completion: 75.00 },
        defaultTurnCost: 15,
        description: 'Previous flagship'
    },
    {
        id: 'claude-opus-4-0-20250514',
        name: 'Claude Opus 4',
        provider: 'anthropic',
        defaultPricing: { prompt: 15.00, completion: 75.00 },
        defaultTurnCost: 15,
        description: 'Latest flagship model'
    },
    // Google Gemini Models
    {
        id: 'gemini-3-pro-preview',
        name: 'Gemini 3 Pro Preview',
        provider: 'google',
        contextWindow: 2000000,
        defaultPricing: { prompt: 1.25, completion: 5.00 },
        defaultTurnCost: 10,
        description: 'Next-gen flagship'
    },
    {
        id: 'gemini-3-flash-preview',
        name: 'Gemini 3 Flash Preview',
        provider: 'google',
        contextWindow: 2000000,
        defaultPricing: { prompt: 0.20, completion: 0.80 },
        defaultTurnCost: 1,
        description: 'Next-gen speed'
    },
    {
        id: 'gemini-2.0-flash-exp',
        name: 'Gemini 2.0 Flash (Exp)',
        provider: 'google',
        defaultPricing: { prompt: 0.00, completion: 0.00 }, // Free during preview often
        defaultTurnCost: 1,
        description: 'Experimental low latency'
    },
    {
        id: 'gemini-1.5-pro-002',
        name: 'Gemini 1.5 Pro (002)',
        provider: 'google',
        defaultPricing: { prompt: 1.25, completion: 5.00 }, // Lowered recently?
        defaultTurnCost: 10,
        description: 'High context window'
    },
    {
        id: 'gemini-1.5-flash-002',
        name: 'Gemini 1.5 Flash (002)',
        provider: 'google',
        defaultPricing: { prompt: 0.075, completion: 0.30 },
        defaultTurnCost: 1,
        description: 'Efficient and capable'
    },
    {
        id: 'gemini-1.5-flash-8b',
        name: 'Gemini 1.5 Flash-8B',
        provider: 'google',
        defaultPricing: { prompt: 0.0375, completion: 0.15 },
        defaultTurnCost: 1,
        description: 'Ultra-lightweight'
    }
];
//# sourceMappingURL=types.js.map