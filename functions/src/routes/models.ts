import { onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { getApiKeys } from './apiKeys';

async function fetchOpenAIModels(apiKey: string): Promise<any[]> {
    if (!apiKey) return [];
    try {
        const response = await fetch('https://api.openai.com/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!response.ok) return [];
        const data = await response.json();
        return data.data || [];
    } catch (e) {
        console.error('Failed to fetch OpenAI models', e);
        return [];
    }
}

async function fetchAnthropicModels(apiKey: string): Promise<any[]> {
    if (!apiKey) return [];
    try {
        const response = await fetch('https://api.anthropic.com/v1/models', {
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            }
        });
        if (!response.ok) return [];
        const data = await response.json();
        return data.data || [];
    } catch (e) {
        console.error('Failed to fetch Anthropic models', e);
        return [];
    }
}

async function fetchGoogleModels(apiKey: string): Promise<any[]> {
    if (!apiKey) return [];
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!response.ok) return [];
        const data = await response.json();
        return data.models || [];
    } catch (e) {
        console.error('Failed to fetch Google models', e);
        return [];
    }
}

export function resolvePricing(modelId: string): { prompt: number; completion: number } {
    // Default/Fallback
    let pricing = { prompt: 0, completion: 0 };

    // OpenAI
    if (modelId.includes('gpt-4o')) pricing = { prompt: 2.50, completion: 10.00 };
    if (modelId.includes('gpt-4o-mini')) pricing = { prompt: 0.15, completion: 0.60 };
    if (modelId.includes('o1-preview')) pricing = { prompt: 15.00, completion: 60.00 };
    if (modelId.includes('o1-mini')) pricing = { prompt: 3.00, completion: 12.00 };

    // Anthropic
    if (modelId.includes('claude-3-5-sonnet')) pricing = { prompt: 3.00, completion: 15.00 };
    if (modelId.includes('claude-3-5-haiku')) pricing = { prompt: 1.00, completion: 5.00 };
    if (modelId.includes('claude-3-opus')) pricing = { prompt: 15.00, completion: 75.00 };

    // Google
    if (modelId.includes('gemini-1.5-pro')) pricing = { prompt: 1.25, completion: 5.00 };
    if (modelId.includes('gemini-1.5-flash')) pricing = { prompt: 0.075, completion: 0.30 };
    if (modelId.includes('gemini-1.5-flash-8b')) pricing = { prompt: 0.0375, completion: 0.15 };
    if (modelId.includes('gemini-2.0')) pricing = { prompt: 0.00, completion: 0.00 }; // Free during experimental

    return pricing;
}

export const getAvailableModels = onCall(
    { cors: true, invoker: 'public' },
    async (request) => {
        const db = admin.firestore();
        const secrets = await getApiKeys(db);

        const [openaiModels, anthropicModels, googleModels] = await Promise.all([
            fetchOpenAIModels(secrets.openai),
            fetchAnthropicModels(secrets.anthropic),
            fetchGoogleModels(secrets.google)
        ]);

        const models: any[] = [];

        // Process OpenAI
        openaiModels.forEach((m: any) => {
            if (m.id.includes('gpt') || m.id.includes('o1')) {
                if (!m.id.includes('realtime') && !m.id.includes('audio')) {
                    models.push({
                        id: m.id,
                        name: m.id,
                        provider: 'openai',
                        defaultPricing: resolvePricing(m.id)
                    });
                }
            }
        });

        // Process Anthropic
        anthropicModels.forEach((m: any) => {
            models.push({
                id: m.id,
                name: m.display_name || m.id,
                provider: 'anthropic',
                defaultPricing: resolvePricing(m.id)
            });
        });

        // Process Google
        googleModels.forEach((m: any) => {
            const id = m.name.replace('models/', '');
            if (id.includes('gemini')) {
                models.push({
                    id: id,
                    name: m.displayName || id,
                    provider: 'google',
                    defaultPricing: resolvePricing(id)
                });
            }
        });

        return {
            success: true,
            models
        };
    }
);
