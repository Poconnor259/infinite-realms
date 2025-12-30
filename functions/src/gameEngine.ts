/**
 * Game Engine Module
 * Handles core game action processing, model resolution, and turn management
 * Extracted from index.ts to improve maintainability
 */

import * as admin from 'firebase-admin';
import { processWithBrain } from './brain';
import { generateNarrative } from './voice';
import { reviewStateConsistency, applyCorrections } from './stateReviewer';
import { getStateReviewerSettings } from './promptHelper';

// ==================== TYPES ====================

export interface GameRequest {
    campaignId: string;
    userInput: string;
    worldModule: 'classic' | 'outworlder' | 'tactical';
    currentState: Record<string, unknown>;
    chatHistory: Array<{ role: string; content: string }>;
    userTier: 'scout' | 'hero' | 'legend';
    byokKeys?: {
        openai?: string;
        anthropic?: string;
        google?: string;
    };
}

export interface GameResponse {
    success: boolean;
    narrativeText?: string;
    stateUpdates?: Record<string, unknown>;
    diceRolls?: Array<{
        type: string;
        result: number;
        modifier?: number;
        total: number;
        purpose?: string;
    }>;
    systemMessages?: string[];
    reviewerApplied?: boolean;
    requiresUserInput?: boolean;
    pendingChoice?: {
        prompt: string;
        options?: string[];
        choiceType: string;
    };
    remainingTurns?: number;
    turnCost?: number;
    voiceModelId?: string;
    error?: string;
    debug?: {
        brainResponse: any;
        stateReport: any;
        reviewerResult: any;
        models?: {
            brain: string;
            voice: string;
        };
    };
}

// ==================== HELPER FUNCTIONS ====================

function getProviderFromModel(model: string): 'openai' | 'anthropic' | 'google' {
    if (model.startsWith('claude')) return 'anthropic';
    if (model.startsWith('gemini')) return 'google';
    return 'openai';
}

const MODEL_ID_MAP: Record<string, { provider: 'openai' | 'anthropic' | 'google'; model: string }> = {
    // UI IDs to actual Provider IDs
    'claude-opus-4.5': { provider: 'anthropic', model: 'claude-opus-4-5-20251101' },
    'claude-sonnet-3.5': { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
    'gemini-3-flash': { provider: 'google', model: 'gemini-1.5-flash' },

    // Legacy mapping or direct pass-through fallbacks
    'claude-3-opus': { provider: 'anthropic', model: 'claude-opus-4-5-20251101' },
    'claude-3-5-sonnet': { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
    'gemini-1.5-flash': { provider: 'google', model: 'gemini-1.5-flash' },
    'gpt-4o-mini': { provider: 'openai', model: 'gpt-4o-mini' },
};

export function resolveModelConfig(
    selectedModel: string,
    byokKeys: GameRequest['byokKeys'],
    secrets: { openai: string; anthropic: string; google: string }
) {
    // Normalize model ID if it exists in our map
    const mapped = MODEL_ID_MAP[selectedModel];
    const provider = mapped ? mapped.provider : getProviderFromModel(selectedModel);
    const actualModel = mapped ? mapped.model : selectedModel;

    let key: string | undefined;

    // 1. Try BYOK
    if (byokKeys && byokKeys[provider]) {
        key = byokKeys[provider];
    }

    // 2. Try Secret
    if (!key) {
        key = secrets[provider];
    }

    // 3. Fallback if no key for selected provider
    if (!key) {
        console.warn(`[Config] No key found for selected provider ${provider}. Falling back to OpenAI.`);
        // Fallback to OpenAI (assuming we always have a system key for it)
        return {
            provider: 'openai' as const,
            model: 'gpt-4o-mini',
            key: secrets.openai || ''
        };
    }

    return { provider, model: actualModel, key };
}

// Helper to map provider/model to stats key
// Use actual model ID but sanitize dots for Firestore FieldPaths
function getTokenStatsKey(provider: string, model: string) {
    return model.replace(/\./g, '_');
}

// Helper for knowledge base fetching
async function getKnowledgeForModule(
    db: admin.firestore.Firestore,
    worldModule: string,
    modelFilter: 'brain' | 'voice',
    maxDocs: number = 3
): Promise<string[]> {
    try {
        const snapshot = await db.collection('knowledgeBase')
            .where('worldModule', 'in', [worldModule, 'global'])
            .where('enabled', '==', true)
            .limit(maxDocs)
            .get();

        const docs: string[] = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            // Filter by target model
            if (data.targetModel === modelFilter || data.targetModel === 'both') {
                docs.push(data.content);
            }
        });

        return docs;
    } catch (error) {
        console.error('[KnowledgeBase] Error fetching documents:', error);
        return [];
    }
}

// ==================== MAIN GAME ENGINE FUNCTION ====================

export async function processGameAction(
    data: GameRequest,
    db: admin.firestore.Firestore,
    auth: { uid: string } | null,
    secrets: { openai: string; anthropic: string; google: string }
): Promise<GameResponse> {
    const {
        campaignId,
        userInput,
        worldModule,
        currentState,
        chatHistory,
        byokKeys,
    } = data;

    // Validate required fields
    if (!campaignId || !userInput || !worldModule) {
        return {
            success: false,
            error: 'Missing required fields: campaignId, userInput, or worldModule',
        };
    }

    try {
        // 1. Resolve world configuration
        let worldData: any = null;
        try {
            const worldDoc = await db.collection('worlds').doc(worldModule).get();
            if (worldDoc.exists) {
                worldData = worldDoc.data();
            }
        } catch (error) {
            console.error('[ProcessGameAction] Failed to fetch world:', error);
        }

        let engineType = worldData?.type || worldModule;
        // Map legacy types if needed
        if (engineType === 'shadowMonarch') engineType = 'tactical';

        // 2. Resolve AI Settings
        let aiSettings = { brainModel: 'gpt-4o-mini', voiceModel: 'claude-3-5-sonnet' };
        let narratorLimits = { min: 150, max: 250 }; // Default narrator word limits
        try {
            const settingsDoc = await db.collection('config').doc('aiSettings').get();
            if (settingsDoc.exists) {
                aiSettings = settingsDoc.data() as any;
            }
            // Fetch narrator limits from global config doc
            const globalConfigDoc = await db.collection('config').doc('global').get();
            if (globalConfigDoc.exists) {
                const gc = globalConfigDoc.data();
                if (gc?.systemSettings) {
                    if (gc.systemSettings.narratorWordLimitMin) {
                        narratorLimits.min = gc.systemSettings.narratorWordLimitMin;
                    }
                    if (gc.systemSettings.narratorWordLimitMax) {
                        narratorLimits.max = gc.systemSettings.narratorWordLimitMax;
                    }
                    // Add enforce flag (default true if missing)
                    (narratorLimits as any).enforce = gc.systemSettings.enforceNarratorWordLimits !== false;
                }
            }
        } catch (error) {
            console.error('[ProcessGameAction] Failed to fetch AI settings:', error);
        }

        // 3. Determine user tier
        let userTier: 'scout' | 'hero' | 'legend' | 'legendary' = data.userTier || 'scout';
        if (auth?.uid) {
            try {
                const userDoc = await db.collection('users').doc(auth.uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    userTier = (userData?.tier || 'scout') as any;
                }
            } catch (error) {
                console.error('[ProcessGameAction] Failed to fetch user tier:', error);
            }
        }

        // 4. Resolve preferred models (BYOK users can override)
        let brainModelId = aiSettings.brainModel || 'gpt-4o-mini';
        let voiceModelId = aiSettings.voiceModel || 'claude-3-5-sonnet';

        if (auth?.uid) {
            try {
                const userDoc = await db.collection('users').doc(auth.uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    if (userData?.preferredModels) {
                        brainModelId = userData.preferredModels.brain || brainModelId;
                        voiceModelId = userData.preferredModels.voice || voiceModelId;
                    }
                }
            } catch (error) {
                console.error('[ProcessGameAction] Failed to fetch user preferences:', error);
            }
        }

        // 5. Resolve API Keys and Model Configs
        const effectiveByokKeys = byokKeys || {};
        const effectiveSecrets = secrets;

        const brainConfig = resolveModelConfig(brainModelId, effectiveByokKeys, effectiveSecrets);
        const voiceConfig = resolveModelConfig(voiceModelId, effectiveByokKeys, effectiveSecrets);

        if (!brainConfig.key) {
            return { success: false, error: 'Configuration Error: No valid API key available for Brain.' };
        }
        if (!voiceConfig.key) {
            return { success: false, error: 'Configuration Error: No valid API key available for Voice.' };
        }

        console.log(`[Process] Brain: ${brainConfig.provider}/${brainConfig.model}, Voice: ${voiceConfig.provider}/${voiceConfig.model}`);

        // 6. Calculate Turn Cost (for non-Legendary users)
        let turnCost = 0; // Will be set from database config
        let finalTurnsBalance: number | undefined = undefined;

        if (userTier !== 'legendary') {
            // We need to check both the UI model ID and the resolved model ID
            const uiModelId = voiceModelId; // What user selected in UI
            const resolvedModelId = voiceConfig.model; // What we send to API

            // Resolve turn cost from Global Config
            try {
                const globalDoc = await db.collection('config').doc('global').get();
                if (globalDoc.exists) {
                    const gc = globalDoc.data();
                    const modelCosts = gc?.modelCosts || {};
                    const defaultCost = gc?.systemSettings?.defaultTurnCost || 10; // Use configured default, NOT hardcoded 1

                    // Check for cost using UI ID first (most common), then resolved ID, then default
                    const uiCost = modelCosts[uiModelId];
                    const resolvedCost = modelCosts[resolvedModelId];

                    if (uiCost !== undefined) {
                        turnCost = uiCost;
                        console.log(`[TurnCost] Found cost by UI ID '${uiModelId}': ${turnCost}`);
                    } else if (resolvedCost !== undefined) {
                        turnCost = resolvedCost;
                        console.log(`[TurnCost] Found cost by resolved ID '${resolvedModelId}': ${turnCost}`);
                    } else {
                        turnCost = defaultCost;
                        console.warn(`[TurnCost] No cost found for '${uiModelId}' or '${resolvedModelId}', using default: ${turnCost}`);
                    }
                }
            } catch (configError) {
                console.error('[TurnCost] Failed to fetch global config for cost:', configError);
                // Fallback to safe default if config fails (not hardcoded 1)
                turnCost = 10;
            }

            // Validate user has enough turns (preliminary check - final check in transaction)
            if (auth?.uid) {
                const userDoc = await db.collection('users').doc(auth.uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    const currentTurns = userData?.turns || 0;

                    // Preliminary check (not atomic - final check happens in transaction)
                    if (currentTurns < turnCost) {
                        return {
                            success: false,
                            error: `Insufficient turns. This action costs ${turnCost} turns, but you only have ${currentTurns} turns remaining. Please upgrade your subscription or switch to a more economical model.`
                        };
                    }

                    // Store current balance for optimistic UI update
                    finalTurnsBalance = currentTurns - turnCost;
                }
            }
        }

        // 7. Fetch knowledge base
        console.log(`[Knowledge] Fetching documents for ${engineType}...`);
        const brainKnowledgeDocs = await getKnowledgeForModule(db, engineType, 'brain', 2);
        const voiceKnowledgeDocs = await getKnowledgeForModule(db, engineType, 'voice', 3);

        // 8. Process with Brain (game logic)
        console.log('[Brain] Processing game logic...');
        const brainResult = await processWithBrain({
            userInput,
            currentState,
            chatHistory,
            worldModule: engineType,
            provider: brainConfig.provider,
            model: brainConfig.model,
            apiKey: brainConfig.key,
            knowledgeDocuments: brainKnowledgeDocs,
        });

        if (!brainResult.success) {
            return { success: false, error: brainResult.error || 'Brain processing failed' };
        }

        const finalState = { ...currentState, ...(brainResult.data?.stateUpdates || {}) };

        console.log('[Voice] Generating narrative...');
        const voiceResult = await generateNarrative({
            narrativeCues: brainResult.data?.narrativeCues || [{ type: 'description', content: brainResult.data?.narrativeCue || '' }],
            stateChanges: brainResult.data?.stateUpdates || {},
            diceRolls: brainResult.data?.diceRolls || [],
            systemMessages: brainResult.data?.systemMessages || [], // CRITICAL: Pass ability activations to Voice
            chatHistory,
            worldModule: engineType,
            provider: voiceConfig.provider,
            model: voiceConfig.model,
            apiKey: voiceConfig.key,
            knowledgeDocuments: voiceKnowledgeDocs,
            narratorWordLimitMin: narratorLimits.min,
            narratorWordLimitMax: narratorLimits.max,
            enforceWordLimits: (narratorLimits as any).enforce,
            characterProfile: (currentState as any).character,
        });

        if (!voiceResult.success) {
            return { success: false, error: voiceResult.error || 'Narrative generation failed' };
        }

        // 10. State Reviewer (if enabled)
        let reviewerResult: any = null;
        try {
            const reviewerSettings = await getStateReviewerSettings();
            if (reviewerSettings.enabled) {
                console.log('[StateReviewer] Running consistency check...');
                const reviewResult = await reviewStateConsistency({
                    currentState: finalState,
                    narrative: voiceResult.narrative || '',
                    worldModule: engineType,
                    provider: voiceConfig.provider,
                    model: voiceConfig.model,
                    apiKey: voiceConfig.key,
                    turnNumber: Math.floor(chatHistory.length / 2) + 1,
                });

                if (reviewResult.success && reviewResult.corrections && Array.isArray(reviewResult.corrections) && reviewResult.corrections.length > 0) {
                    console.log('[StateReviewer] Applying corrections...');
                    const correctedState = applyCorrections(finalState, reviewResult.corrections);
                    Object.assign(finalState, correctedState);
                    reviewerResult = reviewResult;
                }
            }
        } catch (reviewerError: any) {
            console.error('[StateReviewer] Exception:', reviewerError.message);
            // Don't fail the whole request if reviewer fails
        }

        // 11. Save session data (Messages & State) FIRST - before turn deduction
        // This ensures we don't charge turns if message save fails
        if (auth?.uid) {
            try {
                const messagesRef = db.collection('users')
                    .doc(auth.uid)
                    .collection('campaigns')
                    .doc(campaignId)
                    .collection('messages');

                await messagesRef.add({
                    role: 'user',
                    content: userInput,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                });

                await messagesRef.add({
                    role: 'narrator',
                    content: voiceResult.narrative || brainResult.data?.narrativeCue || '',
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    metadata: {
                        voiceModel: voiceConfig.model,
                        turnCost: userTier !== 'legendary' ? turnCost : 0,
                    }
                });

                await db.collection('users')
                    .doc(auth.uid)
                    .collection('campaigns')
                    .doc(campaignId)
                    .update({
                        moduleState: finalState,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
            } catch (saveError) {
                console.error('[ProcessGameAction] Failed to save messages:', saveError);
                // Return error WITHOUT deducting turns - data wasn't saved
                return {
                    success: false,
                    error: 'Failed to save game progress. Your turn was NOT charged. Please try again.',
                };
            }
        }

        // 12. Record Token Usage and Deduct Turns (ONLY after successful save)
        if (auth?.uid) {
            const brainStatsKey = getTokenStatsKey(brainConfig.provider, brainConfig.model);
            const voiceStatsKey = getTokenStatsKey(voiceConfig.provider, voiceConfig.model);

            // Prepare token updates
            const tokenUpdates: Record<string, admin.firestore.FieldValue> = {};

            if (brainResult.usage) {
                tokenUpdates[`tokens.${brainStatsKey}.prompt`] = admin.firestore.FieldValue.increment(brainResult.usage.promptTokens);
                tokenUpdates[`tokens.${brainStatsKey}.completion`] = admin.firestore.FieldValue.increment(brainResult.usage.completionTokens);
                tokenUpdates[`tokens.${brainStatsKey}.total`] = admin.firestore.FieldValue.increment(brainResult.usage.totalTokens);
            }

            if (voiceResult.usage) {
                tokenUpdates[`tokens.${voiceStatsKey}.prompt`] = admin.firestore.FieldValue.increment(voiceResult.usage.promptTokens);
                tokenUpdates[`tokens.${voiceStatsKey}.completion`] = admin.firestore.FieldValue.increment(voiceResult.usage.completionTokens);
                tokenUpdates[`tokens.${voiceStatsKey}.total`] = admin.firestore.FieldValue.increment(voiceResult.usage.totalTokens);
            }

            // Track total turns & legacy totals
            const totalPrompt = (brainResult.usage?.promptTokens || 0) + (voiceResult.usage?.promptTokens || 0) + (reviewerResult?.usage?.promptTokens || 0);
            const totalCompletion = (brainResult.usage?.completionTokens || 0) + (voiceResult.usage?.completionTokens || 0) + (reviewerResult?.usage?.completionTokens || 0);
            const totalTokens = totalPrompt + totalCompletion;

            // Use transaction to atomically check and deduct turns
            try {
                const transactionResult = await db.runTransaction(async (transaction) => {
                    const userRef = db.collection('users').doc(auth.uid);
                    const userDoc = await transaction.get(userRef);

                    if (!userDoc.exists) {
                        throw new Error('User document not found');
                    }

                    const userData = userDoc.data();
                    const currentTurns = userData?.turns || 0;

                    // Atomic turn validation for non-Legendary users
                    if (userTier !== 'legendary' && turnCost > 0) {
                        if (currentTurns < turnCost) {
                            return {
                                success: false,
                                error: `Insufficient turns. Costs ${turnCost}, have ${currentTurns}.`,
                                remainingTurns: currentTurns
                            };
                        }
                    }

                    // Build updates object
                    const updates: Record<string, any> = {
                        ...tokenUpdates,
                        turnsUsed: admin.firestore.FieldValue.increment(1),
                        tokensPrompt: admin.firestore.FieldValue.increment(totalPrompt),
                        tokensCompletion: admin.firestore.FieldValue.increment(totalCompletion),
                        tokensTotal: admin.firestore.FieldValue.increment(totalTokens),
                        lastActive: admin.firestore.FieldValue.serverTimestamp(),
                    };

                    // Deduct turns for non-Legendary users
                    if (userTier !== 'legendary' && turnCost > 0) {
                        updates['turns'] = admin.firestore.FieldValue.increment(-turnCost);
                        console.log(`[ProcessGameAction] Atomically deducting ${turnCost} turns from user ${auth.uid}`);
                    }

                    // Apply updates atomically
                    transaction.update(userRef, updates);

                    return {
                        success: true,
                        remainingTurns: userTier !== 'legendary' ? currentTurns - turnCost : undefined
                    };
                });

                // Check if transaction failed due to insufficient turns
                if (!transactionResult.success) {
                    return {
                        success: false,
                        error: transactionResult.error,
                        remainingTurns: transactionResult.remainingTurns
                    };
                }

                // Update finalTurnsBalance with actual result from transaction
                if (transactionResult.remainingTurns !== undefined) {
                    finalTurnsBalance = transactionResult.remainingTurns;
                }

            } catch (error) {
                console.error('[ProcessGameAction] Turn deduction transaction failed:', error);
                // Message was already saved, but turn tracking failed
                // Still return success since the game action completed
                // Turn will be slightly off but user got their content
                console.warn('[ProcessGameAction] Game succeeded but turn tracking may be inaccurate');
            }

            // Global Stats (outside transaction for performance)
            try {
                const today = new Date().toISOString().split('T')[0];
                await db.collection('systemStats').doc('tokens').collection('daily').doc(today).set({
                    date: today,
                    tokensPrompt: admin.firestore.FieldValue.increment(totalPrompt),
                    tokensCompletion: admin.firestore.FieldValue.increment(totalCompletion),
                    tokensTotal: admin.firestore.FieldValue.increment(totalTokens),
                    turns: admin.firestore.FieldValue.increment(1),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            } catch (statsError) {
                console.error('[ProcessGameAction] Stats update failed:', statsError);
                // Non-critical, don't fail the request
            }
        }

        // 13. Return success response
        return {
            success: true,
            narrativeText: voiceResult.narrative || brainResult.data?.narrativeCue || '',
            stateUpdates: finalState,
            diceRolls: brainResult.data?.diceRolls,
            systemMessages: brainResult.data?.systemMessages,
            remainingTurns: finalTurnsBalance,
            turnCost: userTier !== 'legendary' ? turnCost : 0,
            voiceModelId: voiceModelId,
            reviewerApplied: reviewerResult?.success && !reviewerResult?.skipped && !!reviewerResult?.corrections,
            requiresUserInput: brainResult.data?.requiresUserInput,
            pendingChoice: brainResult.data?.pendingChoice,
            // Admin debug data
            debug: {
                brainResponse: brainResult.data || {},
                stateReport: voiceResult.stateReport || null,
                reviewerResult: reviewerResult || null,
                models: {
                    brain: brainConfig.model,
                    voice: voiceConfig.model,
                },
            },
        };

    } catch (error) {
        console.error('Game processing error:', error);
        // Don't expose internal errors to client
        return {
            success: false,
            error: 'An internal error occurred',
        };
    }
}
