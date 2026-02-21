import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getApiKeys } from './apiKeys';

interface GenerateTextRequest {
    prompt: string;
    maxLength?: number;
    modelId?: string; // "gpt-4o-mini", "claude-3-5-sonnet", etc.
}

interface GenerateTextResponse {
    success: boolean;
    text?: string;
    error?: string;
}

export const generateText = onCall(
    {
        cors: true,
        invoker: 'public',
        memory: '512MiB',
        timeoutSeconds: 120
    },
    async (request): Promise<GenerateTextResponse> => {
        try {
            const { prompt, maxLength = 150, modelId } = request.data as GenerateTextRequest;
            const auth = request.auth;

            if (!auth) {
                throw new HttpsError('unauthenticated', 'User must be authenticated');
            }

            if (!prompt || typeof prompt !== 'string') {
                throw new HttpsError('invalid-argument', 'Prompt is required');
            }

            const db = admin.firestore();

            // Get API keys
            const keys = await getApiKeys(db);

            // Resolve model and provider from model ID prefix
            const resolvedModelId = modelId || 'gpt-4o-mini';
            const getProvider = (id: string): 'openai' | 'anthropic' | 'google' => {
                if (id.startsWith('gpt') || id.includes('openai') || id.startsWith('o1') || id.startsWith('o3')) return 'openai';
                if (id.startsWith('claude')) return 'anthropic';
                if (id.startsWith('gemini') || id.includes('google')) return 'google';
                return 'openai'; // Default to OpenAI
            };
            const provider = getProvider(resolvedModelId);

            console.log(`[GenerateText] Using ${provider}/${resolvedModelId} for user ${auth.uid}`);

            let generatedText = '';
            let tokensUsed = 0;
            let promptTokens = 0;
            let completionTokens = 0;

            if (provider === 'openai') {
                const apiKey = keys.openai;
                if (!apiKey) {
                    throw new HttpsError('failed-precondition', 'OpenAI API key not configured');
                }

                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        model: resolvedModelId,
                        messages: [
                            { role: 'system', content: 'You are a helpful assistant. Be concise.' },
                            { role: 'user', content: prompt }
                        ],
                        max_tokens: maxLength,
                        temperature: 0.8,
                    }),
                });

                if (!response.ok) {
                    const error = await response.text();
                    throw new HttpsError('internal', `OpenAI error: ${error.substring(0, 100)}`);
                }

                const data = await response.json();
                generatedText = data.choices[0]?.message?.content?.trim() || '';
                promptTokens = data.usage?.prompt_tokens || 0;
                completionTokens = data.usage?.completion_tokens || 0;
                tokensUsed = data.usage?.total_tokens || 0;

            } else if (provider === 'anthropic') {
                const apiKey = keys.anthropic;
                if (!apiKey) {
                    throw new HttpsError('failed-precondition', 'Anthropic API key not configured');
                }

                const anthropic = new Anthropic({ apiKey });
                const response = await anthropic.messages.create({
                    model: resolvedModelId,
                    max_tokens: maxLength,
                    messages: [
                        { role: 'user', content: prompt }
                    ],
                });

                const textContent = response.content.find(block => block.type === 'text');
                if (textContent && textContent.type === 'text') {
                    generatedText = textContent.text;
                }
                promptTokens = response.usage.input_tokens;
                completionTokens = response.usage.output_tokens;
                tokensUsed = promptTokens + completionTokens;

            } else if (provider === 'google') {
                const apiKey = keys.google;
                if (!apiKey) {
                    throw new HttpsError('failed-precondition', 'Google API key not configured');
                }

                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ model: resolvedModelId });
                const result = await model.generateContent(prompt);
                generatedText = result.response.text();
                promptTokens = result.response.usageMetadata?.promptTokenCount || 0;
                completionTokens = result.response.usageMetadata?.candidatesTokenCount || 0;
                tokensUsed = result.response.usageMetadata?.totalTokenCount || 0;
            }

            if (!generatedText) {
                throw new HttpsError('internal', 'No text generated');
            }

            // Track usage
            const statsKey = resolvedModelId.replace(/\./g, '_');


            await db.collection('users').doc(auth.uid).update({
                // Per-model tracking
                [`tokens.${statsKey}.prompt`]: admin.firestore.FieldValue.increment(promptTokens),
                [`tokens.${statsKey}.completion`]: admin.firestore.FieldValue.increment(completionTokens),
                [`tokens.${statsKey}.total`]: admin.firestore.FieldValue.increment(tokensUsed),

                // Legacy field
                tokensTotal: admin.firestore.FieldValue.increment(tokensUsed),

                lastActive: admin.firestore.FieldValue.serverTimestamp(),
            });

            console.log(`[GenerateText] Generated ${generatedText.length} chars using ${provider}/${resolvedModelId}`);

            return {
                success: true,
                text: generatedText,
            };

        } catch (error) {
            console.error('[GenerateText] Error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'An unexpected error occurred',
            };
        }
    }
);
