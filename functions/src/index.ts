import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';


import { createCheckoutSession, handleStripeWebhook } from './stripe';
// @ts-ignore - Used in processGameAction wrapper below
import { processGameAction as processGameActionCore, GameRequest, GameResponse, resolveModelConfig } from './gameEngine';
import { deepMergeState, decrementCooldowns } from './utils/stateHelpers';
import { generateQuests } from './questMaster';
import { shouldTriggerQuestMaster, addGeneratedQuests, acceptQuest, declineQuest, extractRecentEvents } from './utils/questMasterHelpers';
import { processWithBrain } from './brain';
import { generateNarrative } from './voice';
import { initPromptHelper, seedAIPrompts, getStateReviewerSettings, getQuestMasterPrompt } from './promptHelper';
import { reviewStateConsistency, applyCorrections } from './stateReviewer';


export { createCheckoutSession, handleStripeWebhook };


// Initialize Firebase Admin
admin.initializeApp();

// Get Firestore instance
const db = admin.firestore();

// Initialize prompt helper with Firestore
initPromptHelper(db);

// ==================== API KEY HELPER ====================
// Get API keys from Firestore (single source of truth)
async function getApiKeys(): Promise<{ openai: string; anthropic: string; google: string }> {
    const providers = ['openai', 'anthropic', 'google'] as const;
    const keys: any = {};

    for (const provider of providers) {
        try {
            const keyDoc = await db.collection('apiKeys').doc(provider).get();
            if (keyDoc.exists && keyDoc.data()?.key) {
                keys[provider] = keyDoc.data()!.key;
            } else {
                keys[provider] = '';
            }
        } catch (error) {
            console.warn(`[API Keys] Error reading ${provider} from Firestore:`, error);
            keys[provider] = '';
        }
    }

    return keys;
}

// ==================== TYPES ====================

// Types are now exported from gameEngine.ts
// Re-export for backwards compatibility
export type { GameRequest, GameResponse } from './gameEngine';

// ==================== HELPER ====================

// Model resolution helpers moved to gameEngine.ts


// ==================== CONFIG ENDPOINTS ====================

// ==================== DYNAMIC MODEL FETCHING ====================

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

function resolvePricing(modelId: string): { prompt: number; completion: number } {
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
        const secrets = await getApiKeys();

        const [openaiModels, anthropicModels, googleModels] = await Promise.all([
            fetchOpenAIModels(secrets.openai),
            fetchAnthropicModels(secrets.anthropic),
            fetchGoogleModels(secrets.google)
        ]);

        const models: any[] = [];

        // Process OpenAI
        openaiModels.forEach((m: any) => {
            if (m.id.includes('gpt') || m.id.includes('o1')) {
                // Filter out audio, tts, dall-e, etc by checking for 'gpt' or 'o1' at minimum
                // This is a loose filter; we might want to skip 'gpt-3.5-turbo' if deprecating, but let's keep it broad.
                // Exclude 'realtime', 'audio' explicitly if needed.
                if (!m.id.includes('realtime') && !m.id.includes('audio')) {
                    models.push({
                        id: m.id,
                        name: m.id, // OpenAI names are IDs
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
            // Google IDs look like "models/gemini-1.5-flash"
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

// ==================== MAIN GAME ENDPOINT ====================

export const processGameAction = onCall(
    { cors: true, invoker: 'public' },
    async (request): Promise<GameResponse> => {
        const data = request.data as GameRequest;
        const auth = request.auth;

        const {
            campaignId,
            userInput,
            worldModule,
            currentState,
            chatHistory,
            byokKeys,
            interactiveDiceRolls,
            rollResult,
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

            // 2.5 Verify User Tier & BYOK Access
            // Security: Fetch actual user tier from Firestore, don't trust client
            let effectiveByokKeys = undefined;
            let userTier = 'scout';
            let preferredModels: { brain?: string; voice?: string } = {};
            let showSuggestedChoices = true; // Default to true

            if (auth?.uid) {
                const userDoc = await db.collection('users').doc(auth.uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    userTier = userData?.tier || 'scout';
                    showSuggestedChoices = userData?.showSuggestedChoices !== false; // Default to true

                    // Respect user model preferences for ALL tiers
                    // (They just pay more turns if they select heavy models)
                    preferredModels = userData?.preferredModels || {};
                }
            }

            if (userTier === 'legendary') {
                // Legend users MUST use BYOK. 
                // We pass the keys provided by client. If they are missing/invalid, resolveModelConfig will fail if we enforce it there,
                // or we enforce it here:
                effectiveByokKeys = byokKeys;
            } else {
                // Scout/Hero users CANNOT use BYOK.
                // We explicitly ignore any keys sent by the client.
                effectiveByokKeys = undefined;
            }

            // 3. Resolve Keys and Models
            const secrets = await getApiKeys();

            // If Legend, we must NOT use system secrets as fallback?
            // User requested: "when they upgrade to legend they lost access to the global API keys"
            let effectiveSecrets = secrets;
            if (userTier === 'legendary') {
                effectiveSecrets = { openai: '', anthropic: '', google: '' };
            }

            const brainModelId = preferredModels.brain || aiSettings.brainModel;
            const voiceModelId = preferredModels.voice || aiSettings.voiceModel;

            const brainConfig = resolveModelConfig(brainModelId, effectiveByokKeys, effectiveSecrets);
            const voiceConfig = resolveModelConfig(voiceModelId, effectiveByokKeys, effectiveSecrets);

            if (!brainConfig.key) {
                return { success: false, error: 'Configuration Error: No valid API key available for Brain.' };
            }
            if (!voiceConfig.key) {
                return { success: false, error: 'Configuration Error: No valid API key available for Voice.' };
            }

            console.log(`[Process] Brain: ${brainConfig.provider}/${brainConfig.model}, Voice: ${voiceConfig.provider}/${voiceConfig.model}`);

            // 2.6 Calculate Turn Cost (for non-Legendary users)
            // Legendary users bypass turn system (they use BYOK)
            let turnCost = 1; // Explicit safe fallback
            let finalTurnsBalance: number | undefined = undefined;

            if (userTier !== 'legendary') {
                // Use the resolved model ID for lookup
                const selectedVoiceModelID = voiceConfig.model;

                // Resolve turn cost from Global Config
                try {
                    const globalDoc = await db.collection('config').doc('global').get();
                    if (globalDoc.exists) {
                        const gc = globalDoc.data();
                        const modelCosts = gc?.modelCosts || {};
                        const defaultCost = gc?.systemSettings?.defaultTurnCost ?? 1;

                        // Check for specific model override, otherwise use default
                        turnCost = modelCosts[selectedVoiceModelID] ?? defaultCost;
                        console.log(`[TurnCost] Model: ${selectedVoiceModelID}, Resolved Cost: ${turnCost}`);
                        console.log(`[TurnCost] Available modelCosts keys:`, Object.keys(modelCosts));
                        console.log(`[TurnCost] Full modelCosts:`, modelCosts);
                        console.log(`[TurnCost] Default cost: ${defaultCost}`);
                    }
                } catch (configError) {
                    console.error('[TurnCost] Failed to fetch global config for cost:', configError);
                    // Fallback to minimal 1 turn if config fails
                    turnCost = 1;
                }

                // Validate user has enough turns (will be enforced atomically in transaction later)
                // For now, just do a preliminary check to fail fast if obviously insufficient
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

            // Fetch knowledge base (Voice only optimization still applies?)
            // If Brain now supports custom rules, we pass them.

            // KnowledgeBase documents are generally for Voice (Lore) but Brain might need mechanics?
            // Existing code said "Voice only" for docs. I'll stick to that or pass only relevant ones.
            // But brain.ts DOES handle knowledgeDocuments. I'll pass appropriately.

            console.log(`[Knowledge] Fetching documents for ${engineType}...`);
            let knowledgeDocs: string[] = [];
            try {
                // Check if imported function works
                knowledgeDocs = await getKnowledgeForModule(engineType, 'voice');
            } catch (kError) {
                console.warn('Failed to fetch knowledge docs:', kError);
            }

            // 3.5 Dynamic Custom Rules Override
            // Prevent "Initializing" prompt if character is already established
            let effectiveCustomRules = worldData?.customRules || '';
            if (engineType === 'outworlder') {
                const char = (currentState as any)?.character;
                if (char?.essences && Array.isArray(char.essences) && char.essences.length > 0) {
                    effectiveCustomRules += `\n\n🚨 CRITICAL STATE FAILSAFE: Character has already awakened and bonded with essences (${char.essences.join(', ')}). 
                     DO NOT output "INITIALIZING WORLD SYSTEM". 
                     DO NOT ask to select essences. 
                     Assume the system initialization is COMPLETE.`;
                }
            }

            // 4. Run Brain (Logic)
            const brainResult = await processWithBrain({
                userInput,
                worldModule: engineType,
                currentState,
                chatHistory,
                apiKey: brainConfig.key,
                provider: brainConfig.provider,
                model: brainConfig.model,
                knowledgeDocuments: [], // Converting optimization: Brain doesn't get heavy lore docs
                customRules: effectiveCustomRules,
                showSuggestedChoices, // Pass user preference
                interactiveDiceRolls,
                rollResult,
            });

            if (!brainResult.success || !brainResult.data) {
                return {
                    success: false,
                    error: brainResult.error || 'Brain processing failed',
                };
            }

            // If there's a pending roll, return early (no Voice AI call, no turn charge)
            // User will roll dice and continue with rollResult
            if (brainResult.data.pendingRoll && brainResult.data.requiresUserInput) {
                console.log('[Brain] Pending dice roll required, pausing for user input');
                return {
                    success: true,
                    stateUpdates: brainResult.data.stateUpdates || {},
                    diceRolls: [],
                    systemMessages: brainResult.data.systemMessages || [],
                    requiresUserInput: true,
                    pendingRoll: brainResult.data.pendingRoll,
                    // Note: No turn charge for pending roll - will charge when user continues
                };
            }

            // 5. Run Voice (Narrative)
            const voiceResult = await generateNarrative({
                narrativeCues: brainResult.data.narrativeCues,
                worldModule: engineType,
                chatHistory,
                stateChanges: brainResult.data.stateUpdates,
                diceRolls: brainResult.data.diceRolls,
                apiKey: voiceConfig.key,
                provider: voiceConfig.provider,
                model: voiceConfig.model,
                knowledgeDocuments: knowledgeDocs,
                customRules: effectiveCustomRules,
                narratorWordLimitMin: narratorLimits.min,
                narratorWordLimitMax: narratorLimits.max,
                enforceWordLimits: (narratorLimits as any).enforce,
                characterProfile: (currentState as any).character
            });

            // Log Voice result for debugging
            console.log('[Voice] Result:', {
                success: voiceResult.success,
                hasNarrative: !!voiceResult.narrative,
                hasUsage: !!voiceResult.usage,
                error: voiceResult.error
            });

            if (!voiceResult.success) {
                console.error('[Voice] Generation failed:', voiceResult.error);
            }

            // 6. Pre-process: Decrement cooldowns for new turn
            let stateAfterCooldowns = decrementCooldowns(currentState);

            // 7. DEEP MERGE stateUpdates to preserve character data (abilities, essences, etc.)
            let finalState = deepMergeState(
                stateAfterCooldowns,
                brainResult.data.stateUpdates || {}
            );

            // 8. State Consistency Review (optional - runs based on frequency setting)
            let reviewerResult: any = null;

            // Deep merge character object to preserve existing character data
            if ((currentState as any).character && (brainResult.data.stateUpdates as any)?.character) {
                finalState.character = {
                    ...(currentState as any).character,
                    ...(brainResult.data.stateUpdates as any).character
                };
            }

            // 6a. Apply Voice stateReport if available (more reliable than third AI parsing)
            if (voiceResult.stateReport) {
                console.log('[Voice StateReport] Applying:', voiceResult.stateReport);

                // Apply resource changes
                if (voiceResult.stateReport.resources) {
                    // Ensure character object exists (preserve existing data)
                    if (!(finalState as any).character) {
                        (finalState as any).character = {};
                    }

                    for (const [key, value] of Object.entries(voiceResult.stateReport.resources)) {
                        if (value && typeof value === 'object') {
                            const currentResource = ((finalState as any).character[key] as any) || { current: 100, max: 100 };
                            // IMPORTANT: Voice AI cannot change max values - only current
                            // Max values should only change on level up (handled separately)
                            (finalState as any).character[key] = {
                                current: Math.min(value.current ?? currentResource.current, currentResource.max),
                                max: currentResource.max // Preserve original max
                            };
                        }
                    }
                }

                // Apply inventory changes
                if (voiceResult.stateReport.inventory) {
                    // Ensure character object exists
                    if (!(finalState as any).character) {
                        (finalState as any).character = {};
                    }

                    const currentInventory = ((finalState as any).character.inventory as string[]) || [];
                    let updatedInventory = [...currentInventory];

                    if (voiceResult.stateReport.inventory.added) {
                        // Check for duplicates before adding
                        const existingItems = new Set(updatedInventory);
                        for (const item of voiceResult.stateReport.inventory.added) {
                            if (!existingItems.has(item)) {
                                updatedInventory.push(item);
                                existingItems.add(item);
                            }
                        }
                    }
                    if (voiceResult.stateReport.inventory.removed) {
                        updatedInventory = updatedInventory.filter(
                            item => !voiceResult.stateReport!.inventory!.removed!.includes(item)
                        );
                    }
                    (finalState as any).character.inventory = updatedInventory;
                }

                // Apply ability changes
                if (voiceResult.stateReport.abilities) {
                    // Ensure character object exists
                    if (!(finalState as any).character) {
                        (finalState as any).character = {};
                    }

                    const currentAbilities = ((finalState as any).character.abilities as string[]) || [];
                    let updatedAbilities = [...currentAbilities];

                    if (voiceResult.stateReport.abilities.added) {
                        // Check for duplicates before adding
                        const existingAbilities = new Set(updatedAbilities);
                        for (const ability of voiceResult.stateReport.abilities.added) {
                            if (!existingAbilities.has(ability)) {
                                updatedAbilities.push(ability);
                                existingAbilities.add(ability);
                            }
                        }
                    }
                    if (voiceResult.stateReport.abilities.removed) {
                        updatedAbilities = updatedAbilities.filter(
                            ability => !voiceResult.stateReport!.abilities!.removed!.includes(ability)
                        );
                    }
                    (finalState as any).character.abilities = updatedAbilities;
                }

                // Apply party changes
                if (voiceResult.stateReport.party) {
                    const currentParty = ((finalState as any).partyMembers as string[]) || [];
                    let updatedParty = [...currentParty];

                    if (voiceResult.stateReport.party.joined) {
                        updatedParty.push(...voiceResult.stateReport.party.joined);
                    }
                    if (voiceResult.stateReport.party.left) {
                        updatedParty = updatedParty.filter(
                            member => !voiceResult.stateReport!.party!.left!.includes(member)
                        );
                    }
                    finalState.partyMembers = updatedParty;
                }

                // Apply key NPCs changes
                if (voiceResult.stateReport.key_npcs) {
                    const currentNpcs = (finalState.keyNpcs as Record<string, any>) || {};

                    // Add newly met NPCs
                    if (voiceResult.stateReport.key_npcs.met) {
                        for (const npc of voiceResult.stateReport.key_npcs.met) {
                            if (!currentNpcs[npc]) {
                                currentNpcs[npc] = { met: true };
                            }
                        }
                    }
                    // Update NPC info
                    if (voiceResult.stateReport.key_npcs.info) {
                        for (const [npc, info] of Object.entries(voiceResult.stateReport.key_npcs.info)) {
                            currentNpcs[npc] = {
                                ...(currentNpcs[npc] || {}),
                                info,
                                lastUpdated: new Date().toISOString()
                            };
                        }
                    }
                    finalState.keyNpcs = currentNpcs;
                }

                // Apply quest changes
                if (voiceResult.stateReport.quests) {
                    const currentQuests = (finalState.quests as Record<string, any>) || {};

                    if (voiceResult.stateReport.quests.started) {
                        for (const quest of voiceResult.stateReport.quests.started) {
                            currentQuests[quest] = { status: 'active', startedAt: new Date().toISOString() };
                        }
                    }
                    if (voiceResult.stateReport.quests.completed) {
                        for (const quest of voiceResult.stateReport.quests.completed) {
                            if (currentQuests[quest]) {
                                currentQuests[quest].status = 'completed';
                                currentQuests[quest].completedAt = new Date().toISOString();
                            } else {
                                currentQuests[quest] = { status: 'completed', completedAt: new Date().toISOString() };
                            }
                        }
                    }
                    if (voiceResult.stateReport.quests.failed) {
                        for (const quest of voiceResult.stateReport.quests.failed) {
                            if (currentQuests[quest]) {
                                currentQuests[quest].status = 'failed';
                                currentQuests[quest].failedAt = new Date().toISOString();
                            } else {
                                currentQuests[quest] = { status: 'failed', failedAt: new Date().toISOString() };
                            }
                        }
                    }
                    finalState.quests = currentQuests;
                }

                // Apply gold/experience
                if (voiceResult.stateReport.gold !== undefined) {
                    finalState.gold = voiceResult.stateReport.gold;
                }
                if (voiceResult.stateReport.experience !== undefined) {
                    finalState.experience = voiceResult.stateReport.experience;
                }
            }

            try {
                // Get turn number from chat history (each user+assistant pair = 1 turn)
                const turnNumber = Math.floor(chatHistory.length / 2) + 1;

                // Get reviewer settings to determine which model to use
                const reviewerSettings = await getStateReviewerSettings();

                if (reviewerSettings.enabled && voiceResult.narrative) {
                    // Resolve API key for reviewer model
                    const reviewerModelId = reviewerSettings.model;
                    const reviewerConfig = resolveModelConfig(reviewerModelId, effectiveByokKeys, secrets);

                    if (reviewerConfig.key) {
                        console.log(`[StateReviewer] Turn ${turnNumber}, using ${reviewerConfig.provider}/${reviewerConfig.model}`);

                        reviewerResult = await reviewStateConsistency({
                            narrative: voiceResult.narrative,
                            currentState: finalState,
                            worldModule: engineType,
                            apiKey: reviewerConfig.key,
                            provider: reviewerConfig.provider,
                            model: reviewerConfig.model,
                            turnNumber,
                        });

                        if (reviewerResult.success && !reviewerResult.skipped && reviewerResult.corrections) {
                            console.log('[StateReviewer] Applying corrections:', reviewerResult.corrections);
                            console.log('[StateReviewer] Reasoning:', reviewerResult.reasoning);
                            finalState = applyCorrections(finalState, reviewerResult.corrections);
                        } else if (reviewerResult.skipped) {
                            console.log(`[StateReviewer] Skipped: ${reviewerResult.skipReason}`);
                        } else if (!reviewerResult.success) {
                            console.error('[StateReviewer] Error:', reviewerResult.error);
                        }
                    } else {
                        console.warn('[StateReviewer] No API key available for model:', reviewerModelId);
                    }
                }
            } catch (reviewerError: any) {
                console.error('[StateReviewer] Exception:', reviewerError.message);
                // Don't fail the whole request if reviewer fails
            }

            // 7. Quest Master - Generate quests based on triggers
            let questMasterSystemMessages: string[] = [];
            let questMasterDebug: any = null;
            try {
                const globalConfigDoc = await db.collection('config').doc('global').get();
                const configData = globalConfigDoc.data() || {};

                const triggerResult = shouldTriggerQuestMaster(currentState, finalState, configData as any);

                if (triggerResult.shouldTrigger) {
                    console.log(`[QuestMaster] Triggered: ${triggerResult.reason}`);

                    // Resolve Quest Master API key
                    const questMasterModel = configData.questMaster?.modelId || 'gpt-4o-mini';
                    const questMasterConfig = resolveModelConfig(questMasterModel, effectiveByokKeys, secrets);

                    if (questMasterConfig.key) {
                        const qmPrompt = await getQuestMasterPrompt(engineType);

                        const questMasterResult = await generateQuests({
                            worldModule: engineType as any,
                            currentState: finalState,
                            triggerReason: triggerResult.reason as any,
                            recentEvents: extractRecentEvents(chatHistory, 5),
                            apiKey: questMasterConfig.key,
                            provider: questMasterConfig.provider as any,
                            model: questMasterConfig.model,
                            maxQuests: configData.questMaster?.maxQuestsPerTrigger || 2,
                            customPrompt: qmPrompt
                        });

                        if (questMasterResult.success && questMasterResult.data) {
                            console.log(`[QuestMaster] Generated ${questMasterResult.data.quests.length} quests`);

                            const currentTurn = Math.floor(chatHistory.length / 2) + 1;
                            finalState = addGeneratedQuests(
                                finalState,
                                questMasterResult.data.quests as any,
                                configData.questMaster?.autoAcceptQuests || false,
                                currentTurn
                            );

                            questMasterSystemMessages.push(`Quest Master: ${questMasterResult.data.reasoning}`);
                            questMasterDebug = questMasterResult;
                        } else if (questMasterResult.error) {
                            questMasterDebug = { success: false, error: questMasterResult.error };
                            console.error('[QuestMaster] Generation failed:', questMasterResult.error);
                        }
                    } else {
                        console.warn('[QuestMaster] No API key configured for Quest Master');
                    }
                }
            } catch (qmError) {
                console.error('[QuestMaster] Error:', qmError);
            }

            // 8. Record Token Usage
            if (auth?.uid) {
                const updates: any = {};

                // Helper to map provider/model to stats key
                // Use actual model ID but sanitize dots for Firestore FieldPaths
                const getTokenStatsKey = (provider: string, model: string) => {
                    return model.replace(/\./g, '_');
                };

                const brainStatsKey = getTokenStatsKey(brainConfig.provider, brainConfig.model);
                const voiceStatsKey = getTokenStatsKey(voiceConfig.provider, voiceConfig.model);

                if (brainResult.usage) {
                    updates[`tokens.${brainStatsKey}.prompt`] = admin.firestore.FieldValue.increment(brainResult.usage.promptTokens);
                    updates[`tokens.${brainStatsKey}.completion`] = admin.firestore.FieldValue.increment(brainResult.usage.completionTokens);
                    updates[`tokens.${brainStatsKey}.total`] = admin.firestore.FieldValue.increment(brainResult.usage.totalTokens);
                }

                if (voiceResult.usage) {
                    updates[`tokens.${voiceStatsKey}.prompt`] = admin.firestore.FieldValue.increment(voiceResult.usage.promptTokens);
                    updates[`tokens.${voiceStatsKey}.completion`] = admin.firestore.FieldValue.increment(voiceResult.usage.completionTokens);
                    updates[`tokens.${voiceStatsKey}.total`] = admin.firestore.FieldValue.increment(voiceResult.usage.totalTokens);
                }

                // Track total turns & legacy totals
                const totalPrompt = (brainResult.usage?.promptTokens || 0) + (voiceResult.usage?.promptTokens || 0) + (reviewerResult?.usage?.promptTokens || 0);
                const totalCompletion = (brainResult.usage?.completionTokens || 0) + (voiceResult.usage?.completionTokens || 0) + (reviewerResult?.usage?.completionTokens || 0);
                const totalTokens = totalPrompt + totalCompletion;

                updates['turnsUsed'] = admin.firestore.FieldValue.increment(1);
                updates['tokensPrompt'] = admin.firestore.FieldValue.increment(totalPrompt);
                updates['tokensCompletion'] = admin.firestore.FieldValue.increment(totalCompletion);
                updates['tokensTotal'] = admin.firestore.FieldValue.increment(totalTokens);
                updates['lastActive'] = admin.firestore.FieldValue.serverTimestamp();

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
                    console.error('[ProcessGameAction] Transaction failed:', error);
                    return {
                        success: false,
                        error: 'Failed to process turn deduction. Please try again.'
                    };
                }

                // Global Stats
                const today = new Date().toISOString().split('T')[0];
                await db.collection('systemStats').doc('tokens').collection('daily').doc(today).set({
                    date: today,
                    tokensPrompt: admin.firestore.FieldValue.increment(totalPrompt),
                    tokensCompletion: admin.firestore.FieldValue.increment(totalCompletion),
                    tokensTotal: admin.firestore.FieldValue.increment(totalTokens),
                    turns: admin.firestore.FieldValue.increment(1),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            }

            // Save session data (Messages & State)
            if (auth?.uid) {
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
                    content: voiceResult.narrative || brainResult.data.narrativeCue,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    metadata: {
                        voiceModel: voiceConfig.model, // Store resolved model ID for permanent display
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
            }

            return {
                success: true,
                narrativeText: voiceResult.narrative || brainResult.data.narrativeCue,
                stateUpdates: finalState,
                diceRolls: brainResult.data.diceRolls,
                systemMessages: [...(brainResult.data.systemMessages || []), ...questMasterSystemMessages],
                remainingTurns: finalTurnsBalance,
                turnCost: userTier !== 'legendary' ? turnCost : 0,
                voiceModelId: voiceModelId,
                reviewerApplied: reviewerResult?.success && !reviewerResult?.skipped && !!reviewerResult?.corrections,
                requiresUserInput: brainResult.data.requiresUserInput,
                pendingChoice: brainResult.data.pendingChoice,
                // Admin debug data
                debug: {
                    brainResponse: brainResult.data,
                    stateReport: voiceResult.stateReport || null,
                    reviewerResult: reviewerResult || null,
                    questResult: questMasterDebug,
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
);

// ==================== TEXT GENERATION ENDPOINT ====================

interface GenerateTextRequest {
    prompt: string;
    maxLength?: number;
    modelId?: string; // Optional: Model ID to use (defaults to Brain model if not specified)
}

interface GenerateTextResponse {
    success: boolean;
    text?: string;
    error?: string;
}

export const generateText = onCall(
    { cors: true, invoker: 'public' },
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

            // Get API keys
            const keys = await getApiKeys();

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

// ==================== CONFIG VERIFICATION ====================

interface VerifyConfigOneRequest {
    provider: 'openai' | 'anthropic' | 'google';
    model: string;
}

export const verifyModelConfig = onCall(
    { cors: true, invoker: 'public' },
    async (request) => {
        try {
            const { provider, model } = request.data as VerifyConfigOneRequest;
            const auth = request.auth;

            if (!auth) {
                throw new HttpsError('unauthenticated', 'User must be authenticated');
            }

            console.log(`[Verify] Testing ${provider}/${model} for user ${auth.uid}`);

            // 1. Get Keys (System Keys only for now)
            const secrets = await getApiKeys();

            let apiKey = '';
            if (provider === 'openai') apiKey = secrets.openai;
            else if (provider === 'anthropic') apiKey = secrets.anthropic;
            else if (provider === 'google') apiKey = secrets.google;

            if (!apiKey) {
                return { success: false, error: `No system API key configured for ${provider}` };
            }

            // 2. Simple Ping
            console.log(`[Verify] Pinging ${provider} with model ${model}...`);
            const startTime = Date.now();
            let success = false;
            let message = '';

            if (provider === 'openai') {
                const openai = new OpenAI({ apiKey });
                await openai.chat.completions.create({
                    model: model,
                    messages: [{ role: 'user', content: 'Ping' }],
                    max_tokens: 5,
                });
                success = true;
                message = 'OpenAI Connection Verified';
            } else if (provider === 'anthropic') {
                const anthropic = new Anthropic({ apiKey });
                await anthropic.messages.create({
                    model: model,
                    max_tokens: 5,
                    messages: [{ role: 'user', content: 'Ping' }],
                });
                success = true;
                message = 'Anthropic Connection Verified';
            } else if (provider === 'google') {
                const genAI = new GoogleGenerativeAI(apiKey);
                const gModel = genAI.getGenerativeModel({ model: model });
                await gModel.generateContent('Ping');
                success = true;
                message = 'Google Connection Verified';
            }

            const latency = Date.now() - startTime;
            console.log(`[Verify] ${provider} success in ${latency}ms`);

            return { success, message, latency };

        } catch (error: any) {
            console.error('Verification failed:', error);
            // Return the raw error message to help debugging
            return {
                success: false,
                error: error.message || 'Verification Failed',
                details: JSON.stringify(error),
            };
        }
    }
);

// ==================== MODEL PRICING MANAGEMENT ====================

interface ModelPricing {
    prompt: number;
    completion: number;
}

interface ModelPricingData {
    gpt4oMini: ModelPricing;
    claude: ModelPricing;
    lastUpdated?: any;
    updatedBy?: string;
}

// Refresh model pricing from latest sources
export const refreshModelPricing = onCall(
    async (request) => {
        try {
            const auth = request.auth;
            if (!auth) {
                throw new HttpsError('unauthenticated', 'User must be authenticated');
            }

            // Check if user is admin
            const userDoc = await db.collection('users').doc(auth.uid).get();
            const isAdmin = userDoc.data()?.role === 'admin';

            if (!isAdmin) {
                throw new HttpsError('permission-denied', 'Admin access required');
            }

            console.log(`[RefreshPricing] Fetching latest pricing for admin ${auth.uid}`);

            // Fetch latest pricing (fallback to known values since APIs don't exist)
            const pricing: ModelPricingData = {
                gpt4oMini: {
                    prompt: 0.15,      // $0.15 per 1M tokens (as of Dec 2024)
                    completion: 0.60,  // $0.60 per 1M tokens
                },
                claude: {
                    prompt: 3.00,      // $3.00 per 1M tokens (Claude Sonnet 3.5)
                    completion: 15.00, // $15.00 per 1M tokens
                },
                lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                updatedBy: auth.uid,
            };

            // Save to Firestore
            await db.collection('config').doc('modelPricing').set(pricing);

            console.log('[RefreshPricing] Pricing updated successfully');

            return {
                success: true,
                pricing: {
                    gpt4oMini: pricing.gpt4oMini,
                    claude: pricing.claude,
                }
            };

        } catch (error) {
            console.error('[RefreshPricing] Error:', error);
            throw error instanceof HttpsError ? error : new HttpsError('internal', 'Failed to refresh pricing');
        }
    }
);

// Update model pricing manually
export const updateModelPricing = onCall(
    async (request) => {
        try {
            const pricingData = request.data as Record<string, { prompt: number; completion: number }>;
            const auth = request.auth;

            if (!auth) {
                throw new HttpsError('unauthenticated', 'User must be authenticated');
            }

            // Check if user is admin
            const userDoc = await db.collection('users').doc(auth.uid).get();
            const isAdmin = userDoc.data()?.role === 'admin';

            if (!isAdmin) {
                throw new HttpsError('permission-denied', 'Admin access required');
            }

            // Validate pricing values for all models
            for (const [modelId, pricing] of Object.entries(pricingData)) {
                // Skip metadata fields
                if (modelId === 'lastUpdated' || modelId === 'updatedBy') continue;

                if (pricing && typeof pricing === 'object') {
                    if (pricing.prompt < 0 || pricing.completion < 0) {
                        throw new HttpsError('invalid-argument', `Pricing for ${modelId} must be positive`);
                    }
                }
            }

            console.log(`[UpdatePricing] Updating pricing for admin ${auth.uid}`, Object.keys(pricingData));

            // Get current pricing
            const currentDoc = await db.collection('config').doc('modelPricing').get();
            const current = currentDoc.data() || {};

            // Merge new pricing with current (preserves existing entries)
            const updated = {
                ...current,
                ...pricingData,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                updatedBy: auth.uid,
            };

            await db.collection('config').doc('modelPricing').set(updated);

            console.log('[UpdatePricing] Pricing updated successfully');

            return { success: true };

        } catch (error) {
            console.error('[UpdatePricing] Error:', error);
            throw error instanceof HttpsError ? error : new HttpsError('internal', 'Failed to update pricing');
        }
    }
);

// Get current model pricing
export const getModelPricing = onCall(
    async (request) => {
        try {
            const doc = await db.collection('config').doc('modelPricing').get();

            if (!doc.exists) {
                // Return default pricing if not set
                return {
                    gpt4oMini: { prompt: 0.15, completion: 0.60 },
                    claude: { prompt: 3.00, completion: 15.00 },
                };
            }

            return doc.data();

        } catch (error) {
            console.error('[GetPricing] Error:', error);
            throw new HttpsError('internal', 'Failed to get pricing');
        }
    }
);

// ==================== GLOBAL APP CONFIG ====================

export const getGlobalConfig = onCall(
    { cors: true, invoker: 'public' },
    async (request) => {
        try {
            const doc = await db.collection('config').doc('global').get();

            // Default config matching existing constants
            const defaultConfig = {
                subscriptionLimits: { scout: 15, hero: 300, legend: 999999 },
                subscriptionPricing: {
                    scout: { price: 0, displayPrice: 'Free' },
                    hero: { price: 999, displayPrice: '$9.99/month' },
                    legend: { price: 4999, displayPrice: '$49.99 one-time' }
                },
                topUpPackages: [
                    { id: 'topup_150', turns: 150, price: 500, displayPrice: '$5' },
                    { id: 'topup_300', turns: 300, price: 1000, displayPrice: '$10' }
                ],
                worldModules: {
                    classic: { enabled: true },
                    outworlder: { enabled: true },
                    tactical: { enabled: true }
                },
                systemSettings: {
                    maintenanceMode: false,
                    newRegistrationsOpen: true,
                    debugLogging: false
                }
            };

            if (!doc.exists) {
                return defaultConfig;
            }

            // Merge with defaults to ensure all fields exist
            return { ...defaultConfig, ...doc.data() };

        } catch (error) {
            console.error('[GetGlobalConfig] Error:', error);
            throw new HttpsError('internal', 'Failed to get global config');
        }
    }
);

export const updateGlobalConfig = onCall(
    { cors: true, invoker: 'public' },
    async (request) => {
        try {
            // Admin check
            const auth = request.auth;
            if (!auth) throw new HttpsError('unauthenticated', 'User must be authenticated');

            const userDoc = await db.collection('users').doc(auth.uid).get();
            const isAdmin = userDoc.data()?.role === 'admin';
            if (!isAdmin) throw new HttpsError('permission-denied', 'Admin access required');

            const updates = request.data;
            await db.collection('config').doc('global').set(updates, { merge: true });

            console.log(`[UpdateGlobalConfig] Config updated by ${auth.uid}`);
            return { success: true };

        } catch (error) {
            console.error('[UpdateGlobalConfig] Error:', error);
            throw error instanceof HttpsError ? error : new HttpsError('internal', 'Failed to update global config');
        }
    }
);

export const acceptQuestTrigger = onCall(
    { cors: true, invoker: 'public' },
    async (request) => {
        const { campaignId, questId } = request.data;
        const auth = request.auth;
        if (!auth) throw new HttpsError('unauthenticated', 'User must be signed in');

        const campaignRef = db.collection('users')
            .doc(auth.uid)
            .collection('campaigns')
            .doc(campaignId);

        const campaign = await campaignRef.get();
        if (!campaign.exists) throw new HttpsError('not-found', 'Campaign not found');

        const gameState = campaign.data()?.moduleState;
        if (!gameState) throw new HttpsError('failed-precondition', 'Game state not found');

        const updatedState = acceptQuest(gameState, questId);
        await campaignRef.update({ moduleState: updatedState });

        return { success: true };
    }
);

export const declineQuestTrigger = onCall(
    { cors: true, invoker: 'public' },
    async (request) => {
        const { campaignId, questId } = request.data;
        const auth = request.auth;
        if (!auth) throw new HttpsError('unauthenticated', 'User must be signed in');

        const campaignRef = db.collection('users')
            .doc(auth.uid)
            .collection('campaigns')
            .doc(campaignId);

        const campaign = await campaignRef.get();
        if (!campaign.exists) throw new HttpsError('not-found', 'Campaign not found');

        const gameState = campaign.data()?.moduleState;
        if (!gameState) throw new HttpsError('failed-precondition', 'Game state not found');

        const updatedState = declineQuest(gameState, questId);
        await campaignRef.update({ moduleState: updatedState });

        return { success: true };
    }
);

export const requestQuestsTrigger = onCall(
    { cors: true, invoker: 'public' },
    async (request) => {
        const { campaignId } = request.data;
        const auth = request.auth;
        if (!auth) throw new HttpsError('unauthenticated', 'User must be signed in');

        const campaignRef = db.collection('users')
            .doc(auth.uid)
            .collection('campaigns')
            .doc(campaignId);

        const campaign = await campaignRef.get();
        if (!campaign.exists) throw new HttpsError('not-found', 'Campaign not found');

        const campaignData = campaign.data();
        const gameState = campaignData?.moduleState;
        if (!gameState) throw new HttpsError('failed-precondition', 'Game state not found');

        const engineType = campaignData?.worldModule || 'classic';

        // Get config
        const globalConfigDoc = await db.collection('config').doc('global').get();
        const configData = globalConfigDoc.data() || {};

        // Resolve API key for Quest Master
        const questMasterModel = configData.questMaster?.modelId || 'gpt-4o-mini';

        // Fetch secrets (system API keys)
        const secrets = await getApiKeys();

        // Use system keys for manual requests
        const questMasterConfig = resolveModelConfig(questMasterModel, undefined, secrets);

        if (!questMasterConfig.key) {
            throw new HttpsError('failed-precondition', 'Quest Master API key not configured. Please add an API Key for the selected model provider in Admin > Config.');
        }

        const qmPrompt = await getQuestMasterPrompt(engineType);

        // Get chat history for context (last 5 messages)
        const messagesSnapshot = await campaignRef.collection('messages')
            .orderBy('timestamp', 'desc')
            .limit(10)
            .get();
        const chatHistory = messagesSnapshot.docs
            .map(doc => doc.data() as { role: string; content: string })
            .reverse();

        const questMasterResult = await generateQuests({
            worldModule: engineType as any,
            currentState: gameState,
            triggerReason: 'manual',
            recentEvents: extractRecentEvents(chatHistory, 5),
            apiKey: questMasterConfig.key,
            provider: questMasterConfig.provider as any,
            model: questMasterConfig.model,
            maxQuests: configData.questMaster?.maxQuestsPerTrigger || 2,
            customPrompt: qmPrompt
        });

        if (!questMasterResult.success || !questMasterResult.data) {
            throw new HttpsError('internal', questMasterResult.error || 'Failed to generate quests');
        }

        const currentTurn = (gameState as any).turnCount || 0;
        const updatedState = addGeneratedQuests(
            gameState,
            questMasterResult.data.quests as any,
            configData.questMaster?.autoAcceptQuests || false,
            currentTurn
        );

        await campaignRef.update({ moduleState: updatedState });

        return {
            success: true,
            questsGenerated: questMasterResult.data.quests.length,
            reasoning: questMasterResult.data.reasoning
        };
    }
);

// ==================== CAMPAIGN MANAGEMENT ====================

export const createCampaign = onCall(
    { cors: true, invoker: 'public' },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be signed in');
        }

        const { name, worldModule: worldId, characterName, initialCharacter } = request.data;

        // Resolve world configuration from Firestore
        let worldData: any = null;
        try {
            const worldDoc = await db.collection('worlds').doc(worldId).get();
            if (worldDoc.exists) {
                worldData = worldDoc.data();
            }
        } catch (error) {
            console.error('[CreateCampaign] Failed to fetch world:', error);
        }

        let engineType = worldData?.type || worldId; // Fallback to worldId for legacy or if doc missing
        if (engineType === 'shadowMonarch') engineType = 'tactical';

        const campaignRef = db.collection('users')
            .doc(request.auth.uid)
            .collection('campaigns')
            .doc();

        const now = admin.firestore.FieldValue.serverTimestamp();

        // Resolve keys
        const secrets = await getApiKeys();

        // Fetch AI Settings to know which model to use for Voice
        let aiSettings = { brainModel: 'gpt-4o-mini', voiceModel: 'claude-3-5-sonnet' };
        try {
            const settingsDoc = await db.collection('config').doc('aiSettings').get();
            if (settingsDoc.exists) {
                aiSettings = settingsDoc.data() as any;
            }
        } catch (error) {
            console.error('[CreateCampaign] Failed to fetch AI settings:', error);
        }

        // Fetch Global Config for Narrator Limits from global doc
        let narratorLimits = { min: 150, max: 250, enforce: true };
        try {
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
                    narratorLimits.enforce = gc.systemSettings.enforceNarratorWordLimits !== false;
                }
            }
        } catch (error) {
            console.error('[CreateCampaign] Failed to fetch global config:', error);
        }

        const voiceConfig = resolveModelConfig(aiSettings.voiceModel, undefined, secrets); // No BYOK for intro yet

        // Get knowledge for generating intro (limit to 2 most relevant docs to save tokens)
        const voiceKnowledgeDocs = await getKnowledgeForModule(engineType, 'voice', 2);

        // Generate initial narrative
        let initialNarrative = worldData?.initialNarrative || '';

        // Check if character already has essences (for skipping essence selection prompt)
        const hasPreselectedEssence = initialCharacter?.essenceSelection === 'chosen' ||
            initialCharacter?.essenceSelection === 'imported' ||
            (initialCharacter?.essences && Array.isArray(initialCharacter.essences) && initialCharacter.essences.length > 0);

        console.log('[CreateCampaign] Essence check:', {
            hasPreselectedEssence,
            essenceSelection: initialCharacter?.essenceSelection,
            essences: initialCharacter?.essences,
            confluence: initialCharacter?.confluence
        });

        // Only use AI generation if explicitly enabled for this world and we have a key
        if (voiceConfig.key && worldData?.generateIntro) {
            try {
                // Build narrative cue - add essence override if essences are pre-selected
                let narrativeContent = `A new adventure in the world of ${worldData?.name || engineType} begins. The setting is: ${worldData?.description || 'unknown'}. The character ${characterName || 'our hero'} is about to start their journey.`;

                // Add essence override instruction if essences are pre-selected
                // Add essence override instruction if essences are pre-selected
                if (hasPreselectedEssence && engineType === 'outworlder') {
                    const essenceList = initialCharacter?.essences?.join(', ') || 'unknown';
                    const confluenceInfo = initialCharacter?.confluence ? ` and the ${initialCharacter.confluence} Confluence` : '';
                    const rankInfo = initialCharacter?.rank || 'Iron';
                    narrativeContent = `A new Outworlder awakens in a strange world. The character ${characterName || 'our hero'} has already bonded with the following essences during their dimensional transit: ${essenceList}${confluenceInfo}.
                    
CRITICAL: Do NOT present essence selection options (A, B, C, D). The character ALREADY has their essences. Skip the COMPENSATION PACKAGE — ESSENCE SELECTION sequence entirely. 

IMPORTANT: The character's rank is ${rankInfo}. Ensure your narrative reflects that they are ${rankInfo} rank. Do not state they are Iron 0 unless they are actually Iron.

Start their adventure with them already awakened and their essences active. Grant them the intrinsic abilities associated with their essences immediately. Describe their awakening and first moments in this new world, acknowledging their powers are already part of them.`;
                }

                // If essences are pre-selected, modify customRules to exclude essence selection
                let effectiveCustomRules = worldData?.customRules;
                if (hasPreselectedEssence && effectiveCustomRules) {
                    effectiveCustomRules = effectiveCustomRules + `

🚨 CRITICAL OVERRIDE: Character already has essences selected (${initialCharacter?.essences?.join(', ')}). 
Rank is ${initialCharacter?.rank || 'Iron'}.
DO NOT RUN ESSENCE SELECTION. 
DO NOT OFFER COMPENSATION PACKAGE.
Skip directly to the adventure start.`;
                }

                const voiceResult = await generateNarrative({
                    narrativeCues: [{
                        type: 'description' as const,
                        content: narrativeContent,
                        emotion: 'mysterious' as const,
                    }],
                    worldModule: engineType,
                    chatHistory: [],
                    stateChanges: {},
                    diceRolls: [],
                    apiKey: voiceConfig.key,
                    provider: voiceConfig.provider,
                    model: voiceConfig.model,
                    knowledgeDocuments: voiceKnowledgeDocs,
                    customRules: effectiveCustomRules,
                    narratorWordLimitMin: narratorLimits.min,
                    narratorWordLimitMax: narratorLimits.max,
                    enforceWordLimits: narratorLimits.enforce,
                    characterProfile: initialCharacter
                });
                if (voiceResult.success && voiceResult.narrative) {
                    initialNarrative = voiceResult.narrative;
                }
            } catch (narrativeError) {
                console.error('[CreateCampaign] Narrative generation failed:', narrativeError);
            }
        }

        // Fallback to hardcoded intro if AI generation failed
        if (!initialNarrative) {
            switch (engineType) {
                case 'classic':
                    initialNarrative = `*The tavern is warm and loud. You sit in the corner, polishing your gear. A shadow falls across your table.*`;
                    break;
                case 'outworlder':
                    // Check if character already has essences selected
                    if (initialCharacter?.essenceSelection === 'chosen' || initialCharacter?.essenceSelection === 'imported') {
                        const essenceName = initialCharacter?.essences?.[0] || 'unknown';
                        initialNarrative = `*Darkness... then light. Blinding, violet light. You gasp for air as you wake up in a strange forest.*\n\n*The ${essenceName} essence thrums within you—a gift from your awakening. Its power is still raw, unfamiliar, but undeniably yours.*\n\n*A strange voice echoes in your mind: "Welcome, Outworlder. Your journey begins now."*`;
                    } else {
                        // Random mode - will present essence options during gameplay
                        initialNarrative = `*Darkness... then light. Blinding, violet light. You gasp for air as you wake up in a strange forest.*`;
                    }
                    break;
                case 'tactical':
                    initialNarrative = `*[SYSTEM NOTIFICATION]*\n\n*Validation complete. Player registered. Welcome, Operative.*`;
                    break;
                default:
                    initialNarrative = `*Your adventure begins...*`;
            }
        }

        // Use initialCharacter if provided, otherwise create a basic character
        const character = initialCharacter || {
            id: `char_${Date.now()}`,
            name: characterName || 'Unnamed Hero',
            hp: { current: 100, max: 100 },
            level: 1,
        };

        // Ensure character has an ID
        if (!character.id) {
            character.id = `char_${Date.now()}`;
        }

        // Save campaign
        await campaignRef.set({
            id: campaignRef.id,
            name,
            worldModule: worldId,
            character,
            moduleState: {
                type: engineType,
                character,
            },
            createdAt: now,
            updatedAt: now,
        });

        // Save initial message
        await campaignRef.collection('messages').add({
            role: 'narrator',
            content: initialNarrative,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { campaignId: campaignRef.id, initialNarrative };
    }
);

export const deleteCampaign = onCall({ cors: true, invoker: 'public' }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be signed in');
    }

    const { campaignId } = request.data;

    const messagesRef = db.collection('users')
        .doc(request.auth.uid)
        .collection('campaigns')
        .doc(campaignId)
        .collection('messages');

    const messages = await messagesRef.get();
    const batch = db.batch();
    messages.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    await db.collection('users')
        .doc(request.auth.uid)
        .collection('campaigns')
        .doc(campaignId)
        .delete();

    return { success: true };
});

// ==================== EXPORT DATA (GDPR) ====================

export const exportUserData = onCall({ cors: true, invoker: 'public' }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be signed in');
    }

    const userId = request.auth.uid;

    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    const campaignsSnapshot = await db.collection('users')
        .doc(userId)
        .collection('campaigns')
        .get();

    const campaigns = await Promise.all(
        campaignsSnapshot.docs.map(async (doc) => {
            const campaignData = doc.data();

            const messagesSnapshot = await doc.ref.collection('messages').get();
            const messages = messagesSnapshot.docs.map(msgDoc => msgDoc.data());

            return {
                ...campaignData,
                messages,
            };
        })
    );

    return {
        user: userData,
        campaigns,
        exportedAt: new Date().toISOString(),
    };
});

// ==================== ADMIN DASHBOARD ====================

// Helper for timestamp formatting
function formatTimestamp(val: any): string | number | null {
    if (!val) return null;
    if (typeof val?.toDate === 'function') return val.toDate().toISOString();
    if (typeof val === 'number') return new Date(val).toISOString();
    return val; // String or other
}

export const getAdminDashboardData = onCall({ cors: true, invoker: 'public' }, async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be signed in');
        }

        // Verify admin role 
        const callerDoc = await db.collection('users').doc(request.auth.uid).get();
        const callerData = callerDoc.data();

        if (callerData?.role !== 'admin') {
            throw new HttpsError('permission-denied', 'Admin access required');
        }

        // Fetch all users
        const usersSnapshot = await db.collection('users')
            .limit(100)
            .get();

        const users = usersSnapshot.docs.map(doc => {
            const d = doc.data();
            return {
                id: doc.id,
                email: d.email || '',
                displayName: d.displayName || 'Unknown',
                photoURL: d.photoURL || null,
                role: d.role || 'user',
                tier: d.tier || 'scout',
                turns: d.turns || 0,
                turnsUsed: d.turnsUsed || 0,
                tokensPrompt: d.tokensPrompt || 0,
                tokensCompletion: d.tokensCompletion || 0,
                tokensTotal: d.tokensTotal || 0,
                tokens: d.tokens || {}, // Include per-model breakdown
                isAnonymous: !!d.isAnonymous,
                createdAt: formatTimestamp(d.createdAt),
                lastActive: formatTimestamp(d.lastActive),
            };
        });

        // Fetch last 30 days of daily stats
        const dailyStatsSnapshot = await db.collection('systemStats')
            .doc('tokens')
            .collection('daily')
            .orderBy('date', 'desc')
            .limit(30)
            .get();

        const dailyStats = dailyStatsSnapshot.docs.map(doc => doc.data());

        return { users, dailyStats };
    } catch (error: any) {
        console.error('getAdminDashboardData Error:', error);
        if (error.code) {
            throw error;
        }
        throw new HttpsError('internal', error.message || 'Unknown error');
    }
});

export const adminUpdateUser = onCall({ cors: true, invoker: 'public' }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be signed in');
    }

    const callerDoc = await db.collection('users').doc(request.auth.uid).get();
    if (callerDoc.data()?.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const { targetUserId, updates } = request.data;

    await db.collection('users').doc(targetUserId).update(updates);

    return { success: true };
});

export const adminAdjustTurns = onCall({ cors: true, invoker: 'public' }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be signed in');
    }

    // Verify admin role
    const callerDoc = await db.collection('users').doc(request.auth.uid).get();
    if (callerDoc.data()?.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const { targetUserId, amount, operation } = request.data;

    if (!targetUserId || amount === undefined) {
        throw new HttpsError('invalid-argument', 'Missing targetUserId or amount');
    }

    const userRef = db.collection('users').doc(targetUserId);
    console.log(`[Admin] Adjusting turns for user: ${targetUserId}, amount: ${amount}, operation: ${operation}`);

    const userDoc = await userRef.get();
    if (!userDoc.exists) {
        throw new HttpsError('not-found', `User ${targetUserId} not found in Firestore`);
    }

    if (operation === 'set') {
        await userRef.update({ turns: amount });
    } else {
        await userRef.update({
            turns: admin.firestore.FieldValue.increment(amount)
        });
    }

    const updatedDoc = await userRef.get();
    console.log(`[Admin] Turns updated successfully. New balance: ${updatedDoc.data()?.turns}`);

    return { success: true, newBalance: updatedDoc.data()?.turns };
});

// ==================== KNOWLEDGE BASE ====================

interface KnowledgeDocument {
    id?: string;
    name: string;
    worldModule: 'global' | 'classic' | 'outworlder' | 'tactical';
    content: string;
    category: 'lore' | 'rules' | 'characters' | 'locations' | 'other';
    targetModel: 'brain' | 'voice' | 'both'; // brain=OpenAI, voice=Claude
    uploadedBy?: string;
    createdAt?: FirebaseFirestore.Timestamp;
    updatedAt?: FirebaseFirestore.Timestamp;
    enabled: boolean;
}

export const addKnowledgeDocument = onCall({
    cors: ['https://infinite-realms-5dcba.web.app', 'https://infinite-realms-5dcba.firebaseapp.com'],
    invoker: 'public'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be signed in');
    }

    // Verify admin role
    const callerDoc = await db.collection('users').doc(request.auth.uid).get();
    if (callerDoc.data()?.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const { name, worldModule, content, category, targetModel } = request.data as Partial<KnowledgeDocument>;

    if (!name || !worldModule || !content || !category || !targetModel) {
        throw new HttpsError('invalid-argument', 'Missing required fields: name, worldModule, content, category, targetModel');
    }

    const docRef = db.collection('knowledgeBase').doc();
    const now = admin.firestore.FieldValue.serverTimestamp();

    await docRef.set({
        id: docRef.id,
        name,
        worldModule,
        content,
        category,
        targetModel,
        uploadedBy: request.auth.uid,
        createdAt: now,
        updatedAt: now,
        enabled: true,
    });

    return { id: docRef.id, success: true };
});

export const getKnowledgeDocuments = onCall({
    cors: ['https://infinite-realms-5dcba.web.app', 'https://infinite-realms-5dcba.firebaseapp.com'],
    invoker: 'public'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be signed in');
    }

    // Verify admin role
    const callerDoc = await db.collection('users').doc(request.auth.uid).get();
    if (callerDoc.data()?.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const snapshot = await db.collection('knowledgeBase')
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();

    const documents = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: data.name,
            worldModule: data.worldModule,
            content: data.content,
            category: data.category,
            targetModel: data.targetModel || 'both',
            uploadedBy: data.uploadedBy,
            createdAt: formatTimestamp(data.createdAt),
            updatedAt: formatTimestamp(data.updatedAt),
            enabled: data.enabled ?? true,
        };
    });

    return { documents };
});

export const updateKnowledgeDocument = onCall({
    cors: ['https://infinite-realms-5dcba.web.app', 'https://infinite-realms-5dcba.firebaseapp.com'],
    invoker: 'public'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be signed in');
    }

    // Verify admin role
    const callerDoc = await db.collection('users').doc(request.auth.uid).get();
    if (callerDoc.data()?.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const { documentId, updates } = request.data;

    if (!documentId) {
        throw new HttpsError('invalid-argument', 'Document ID required');
    }

    const docRef = db.collection('knowledgeBase').doc(documentId);
    const doc = await docRef.get();

    if (!doc.exists) {
        throw new HttpsError('not-found', 'Document not found');
    }

    await docRef.update({
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
});

export const deleteKnowledgeDocument = onCall({
    cors: ['https://infinite-realms-5dcba.web.app', 'https://infinite-realms-5dcba.firebaseapp.com'],
    invoker: 'public'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be signed in');
    }

    // Verify admin role
    const callerDoc = await db.collection('users').doc(request.auth.uid).get();
    if (callerDoc.data()?.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const { documentId } = request.data;

    if (!documentId) {
        throw new HttpsError('invalid-argument', 'Document ID required');
    }

    await db.collection('knowledgeBase').doc(documentId).delete();

    return { success: true };
});

// Helper for game logic to fetch knowledge documents
// modelFilter: 'brain' for OpenAI, 'voice' for Claude
// maxDocs: limit number of documents to reduce token usage
export const getKnowledgeForModule = async (
    worldModule: string,
    modelFilter: 'brain' | 'voice',
    maxDocs: number = 3
): Promise<string[]> => {
    const snapshot = await db.collection('knowledgeBase')
        .where('enabled', '==', true)
        .get();

    const docs = snapshot.docs
        .filter(doc => {
            const data = doc.data();
            const moduleMatch = data.worldModule === 'global' || data.worldModule === worldModule;
            const modelMatch = data.targetModel === 'both' || data.targetModel === modelFilter || !data.targetModel;
            return moduleMatch && modelMatch;
        })
        .map(doc => {
            const data = doc.data();
            return {
                text: `[${data.category.toUpperCase()}: ${data.name}]\n${data.content}`,
                category: data.category,
                length: data.content.length,
            };
        })
        // Prioritize shorter docs to minimize token usage
        .sort((a, b) => a.length - b.length)
        .slice(0, maxDocs);

    return docs.map(d => d.text);
};

// ==================== API KEY MANAGEMENT ====================

const SECRET_NAMES = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    google: 'GOOGLE_API_KEY',
} as const;

type ApiProvider = keyof typeof SECRET_NAMES;

// Get the status of configured API keys (masked hints only - never full keys)
export const getApiKeyStatus = onCall(
    { cors: true, invoker: 'public' },
    async (request) => {
        // Admin check
        const auth = request.auth;
        if (!auth) throw new HttpsError('unauthenticated', 'User must be authenticated');

        const userDoc = await db.collection('users').doc(auth.uid).get();
        const isAdmin = userDoc.data()?.role === 'admin';
        if (!isAdmin) throw new HttpsError('permission-denied', 'Admin access required');

        const getHint = (key: string | undefined): { set: boolean; hint: string } => {
            if (!key || key.length < 8) {
                return { set: false, hint: '' };
            }
            // Show first 4 and last 4 characters
            const first = key.substring(0, 4);
            const last = key.substring(key.length - 4);
            return { set: true, hint: `${first}...${last}` };
        };

        // Get keys from Firestore first, fallback to Secret Manager
        const keys = await getApiKeys();

        return {
            openai: getHint(keys.openai),
            anthropic: getHint(keys.anthropic),
            google: getHint(keys.google),
        };
    }
);

// Update an API key in Secret Manager
export const updateApiKey = onCall(
    { cors: true, invoker: 'public' },
    async (request) => {
        // Admin check
        const auth = request.auth;
        if (!auth) throw new HttpsError('unauthenticated', 'User must be authenticated');

        const userDoc = await db.collection('users').doc(auth.uid).get();
        const isAdmin = userDoc.data()?.role === 'admin';
        if (!isAdmin) throw new HttpsError('permission-denied', 'Admin access required');

        const { provider, key } = request.data as { provider: ApiProvider; key: string };

        // Validate input
        if (!provider || !['openai', 'anthropic', 'google'].includes(provider)) {
            throw new HttpsError('invalid-argument', 'Invalid provider. Must be openai, anthropic, or google.');
        }

        if (!key || typeof key !== 'string' || key.length < 10) {
            throw new HttpsError('invalid-argument', 'Invalid API key. Key must be at least 10 characters.');
        }

        // Basic format validation
        if (provider === 'openai' && !key.startsWith('sk-')) {
            throw new HttpsError('invalid-argument', 'OpenAI keys should start with "sk-"');
        }

        try {
            // Store API key in Firestore (encrypted in production, you should add encryption)
            // WARNING: In production, you should encrypt these keys before storing
            await db.collection('apiKeys').doc(provider).set({
                key: key,
                provider: provider,
                set: true,
                hint: `${key.substring(0, 4)}...${key.substring(key.length - 3)}`,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedBy: auth.uid,
            });

            console.log(`[UpdateApiKey] ${provider} key updated by ${auth.uid}`);

            // Log the update for audit purposes
            await db.collection('auditLog').add({
                action: 'API_KEY_UPDATE',
                provider,
                updatedBy: auth.uid,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });

            return { success: true };

        } catch (error: any) {
            console.error('[UpdateApiKey] Error:', error);
            throw new HttpsError('internal', `Failed to update API key: ${error.message}`);
        }
    }
);

// ==================== AI PROMPTS MANAGEMENT ====================

// Seed AI prompts collection with default values
export const seedPrompts = onCall(
    { cors: true, invoker: 'public' },
    async (request) => {
        // Admin check
        const auth = request.auth;
        if (!auth) throw new HttpsError('unauthenticated', 'User must be authenticated');

        const userDoc = await db.collection('users').doc(auth.uid).get();
        const isAdmin = userDoc.data()?.role === 'admin';
        if (!isAdmin) throw new HttpsError('permission-denied', 'Admin access required');

        try {
            await seedAIPrompts(db);
            return { success: true, message: 'AI prompts seeded successfully' };
        } catch (error: any) {
            console.error('[SeedPrompts] Error:', error);
            throw new HttpsError('internal', `Failed to seed prompts: ${error.message}`);
        }
    }
);

// Export campaign save/load functions
export { saveCampaignState, getCampaignSaves, loadCampaignSave, deleteCampaignSave } from './campaignSaves';

// ==================== CACHE KEEP-ALIVE SYSTEM ====================
export const keepVoiceCacheAlive = onCall(async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'User must be logged in.');
    const userId = request.auth.uid;
    const { campaignId } = request.data;
    if (!campaignId) throw new HttpsError('invalid-argument', 'Campaign ID is required.');

    try {
        const db = admin.firestore();
        const campaignRef = db.collection('campaigns').doc(campaignId);
        const campaignDoc = await campaignRef.get();
        if (!campaignDoc.exists) throw new HttpsError('not-found', 'Campaign not found.');

        const campaignData = campaignDoc.data();
        if (campaignData?.userId !== userId) throw new HttpsError('permission-denied', 'Not your campaign.');

        const currentState = campaignData?.state || {};
        const worldId = campaignData?.worldId;
        const engineType = campaignData?.engine || 'classic';

        // Get AI Settings & Keys
        const userSettings = (await db.collection('users').doc(userId).collection('settings').doc('ai').get()).data() || {};
        const provider = userSettings.voiceProvider || 'openai';
        const model = userSettings.voiceModel || 'gpt-4o-mini';

        const allKeys = await getApiKeys();
        const apiKey = allKeys[provider as keyof typeof allKeys];

        if (!apiKey) return { success: false, message: 'No API Key found.' };
        if (provider !== 'anthropic') return { success: false, message: 'Keep-alive only needed for Anthropic.' };

        // Construct Context
        let worldData: any = {};
        let effectiveCustomRules = '';
        if (worldId) {
            const worldDoc = await db.collection('worlds').doc(worldId).get();
            if (worldDoc.exists) {
                worldData = worldDoc.data();
                effectiveCustomRules = worldData.customRules || '';
            }
        }

        const voiceKnowledgeDocs = await getKnowledgeForModule(engineType, 'voice', 2);

        const voiceResult = await generateNarrative({
            narrativeCues: [],
            worldModule: engineType,
            chatHistory: [],
            stateChanges: {},
            diceRolls: [],
            apiKey, provider, model,
            knowledgeDocuments: voiceKnowledgeDocs,
            customRules: effectiveCustomRules,
            characterProfile: (currentState as any).character,
            isKeepAlive: true
        });

        return { success: voiceResult.success, cached: true, usage: voiceResult.usage };
    } catch (error: any) {
        console.error('[KeepAlive] Error:', error);
        throw new HttpsError('internal', 'Keep-alive failed: ' + error.message);
    }
});
