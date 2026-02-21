import { GameSlice, MessageSlice } from './types';
import { getErrorMessage, withRetry } from '../utils';
import { processGameAction } from '../../firebase';
import { useSettingsStore, useUserStore, useTurnsStore } from '../../store';
import { Message } from '../../types';

export const createMessageSlice: GameSlice<MessageSlice> = (set, get) => ({
    messages: [],
    editingMessage: null,
    lastFailedRequest: null,

    addMessage: (message) => {
        set((state) => ({
            messages: [...state.messages, message],
        }));
    },

    setMessages: (messages) => {
        set({ messages });

        const campaignId = get().currentCampaign?.id;
        if (campaignId) {
            // Need to import extractRollsFromMessages and saveRollHistory
            // Since they are in rollSlice, we import them dynamically or assume they've run
            import('./rollSlice').then(({ extractRollsFromMessages, saveRollHistory }) => {
                const extractedRolls = extractRollsFromMessages(messages);
                if (extractedRolls.length > 0) {
                    console.log('[Store] Extracted', extractedRolls.length, 'dice rolls from messages');
                    set({ rollHistory: extractedRolls });
                    saveRollHistory(campaignId, extractedRolls);
                }
            });
        }
    },

    clearMessages: () => set({ messages: [] }),
    setEditingMessage: (text) => set({ editingMessage: text }),
    clearFailedRequest: () => set({ lastFailedRequest: null }),

    deleteLastUserMessageAndResponse: () => {
        const state = get();
        const messages = [...state.messages];

        let lastUserIndex = -1;
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'user') {
                lastUserIndex = i;
                break;
            }
        }

        if (lastUserIndex === -1) return null;

        const userMessageText = messages[lastUserIndex].content;
        const newMessages = messages.slice(0, lastUserIndex);

        set({
            messages: newMessages,
            editingMessage: userMessageText,
            pendingRoll: null,
            pendingChoice: null
        });

        return userMessageText;
    },

    retryLastRequest: async () => {
        const { lastFailedRequest, processUserInput, clearFailedRequest, isLoading } = get();

        if (isLoading) {
            console.warn('[Game] Request already in progress, skipping retry');
            return;
        }

        if (!lastFailedRequest) {
            console.warn('[Game] No failed request to retry');
            return;
        }

        const messages = get().messages.filter(m => !m.id.startsWith('err_'));
        set({ messages });

        clearFailedRequest();
        await processUserInput(lastFailedRequest.input);
    },

    processUserInput: async (input: string) => {
        const state = get();
        if (!state.currentCampaign) {
            set({ error: 'No active campaign' });
            return;
        }

        set({ isLoading: true, error: null });

        const userMessage: Message = {
            id: `msg_${Date.now()}`,
            role: 'user',
            content: input,
            timestamp: Date.now(),
        };

        const newMessages = [...state.messages, userMessage];

        set({ messages: newMessages });

        try {
            const user = useUserStore.getState().user;
            const settings = useSettingsStore.getState();
            const turnsStore = useTurnsStore.getState();

            if (!user) {
                throw new Error("User not authenticated");
            }

            if (!turnsStore.canUseTurn()) {
                throw new Error("You have run out of turns for this month. Please upgrade your plan or wait for the monthly reset.");
            }

            console.log('[Game] Processing with Cloud Function...');

            const result = await withRetry(
                () => processGameAction({
                    campaignId: state.currentCampaign!.id,
                    userInput: input,
                    worldModule: state.currentCampaign!.worldModule,
                    currentState: state.currentCampaign!.moduleState as any,
                    chatHistory: newMessages.slice(-10).map(m => ({
                        role: m.role,
                        content: m.content
                    })),
                    userTier: user.tier || 'scout',
                    byokKeys: {
                        openai: settings.openaiKey || undefined,
                        anthropic: settings.anthropicKey || undefined,
                    },
                    interactiveDiceRolls: settings.diceRollMode !== 'auto',
                    showSuggestedChoices: settings.showSuggestedChoices,
                }),
                (attempt, delay, maxRetries) => {
                    get().addToast({
                        type: 'warning',
                        message: `Connection issue, retrying... (${attempt}/${maxRetries})`,
                        duration: delay,
                    });
                }
            );

            console.log('[Game] Result:', result.data);

            if (!result.data.success) {
                throw new Error(result.data.error || 'Unknown error from Game Brain');
            }

            if (result.data.pendingRoll) {
                console.log('[Game] Pending dice roll detected:', result.data.pendingRoll);
                set({
                    isLoading: false,
                    pendingRoll: result.data.pendingRoll,
                    pendingChoice: null,
                });
                return;
            }

            const narrative = result.data.narrativeText || '...';

            const narratorMessage: Message = {
                id: `msg_${Date.now() + 1}`,
                role: 'narrator',
                content: narrative,
                timestamp: Date.now(),
                metadata: {
                    voiceModel: result.data.voiceModelId,
                    turnCost: result.data.turnCost,
                    debug: result.data.debug,
                },
            };

            set((s) => {
                const updatedCampaign = s.currentCampaign!;

                if (result.data.stateUpdates) {
                    updatedCampaign.moduleState = {
                        ...updatedCampaign.moduleState,
                        ...result.data.stateUpdates
                    } as any;
                    updatedCampaign.updatedAt = Date.now();
                }

                return {
                    messages: [...newMessages, narratorMessage],
                    currentCampaign: updatedCampaign,
                    isLoading: false,
                    pendingChoice: result.data.pendingChoice && result.data.pendingChoice.options && result.data.pendingChoice.options.length > 0
                        ? result.data.pendingChoice
                        : (result.data.requiresUserInput && result.data.pendingChoice ? result.data.pendingChoice : null),
                    pendingRoll: null,
                };
            });

            if (result.data.remainingTurns !== undefined) {
                useTurnsStore.setState({ balance: result.data.remainingTurns });

                import('../utils').then(({ storage }) => {
                    const turnsData = storage.getString('turnsData');
                    if (turnsData) {
                        const parsed = JSON.parse(turnsData);
                        storage.set('turnsData', JSON.stringify({
                            ...parsed,
                            balance: result.data.remainingTurns
                        }));
                    }
                });
            }

            const backgroundAmbianceEnabled = useSettingsStore.getState().backgroundAmbiance;
            if (backgroundAmbianceEnabled && narrative) {
                import('../../ambiance').then(({ detectAmbianceFromText, fadeToAmbiance }) => {
                    const detectedAmbiance = detectAmbianceFromText(narrative);
                    if (detectedAmbiance !== 'none') {
                        fadeToAmbiance(detectedAmbiance).catch(console.warn);
                    }
                });
            }

            const soundEffectsEnabled = useSettingsStore.getState().soundEffects;
            if (soundEffectsEnabled && narrative) {
                import('../../sounds').then(({ playMessageReceived }) => {
                    playMessageReceived();
                });
            }

            set({ syncBlockedUntil: Date.now() + 2000 });

        } catch (error) {
            console.error('[Game] Error:', error);

            const { message: errorMessage, isRetryable } = getErrorMessage(error);

            get().addToast({
                type: 'error',
                message: errorMessage,
                duration: isRetryable ? 10000 : 7000,
                action: isRetryable ? {
                    label: 'Retry',
                    onPress: () => get().retryLastRequest()
                } : undefined,
            });

            set({
                isLoading: false,
                error: errorMessage,
                lastFailedRequest: { input, timestamp: Date.now() },
            });

            const systemErrorMessage: Message = {
                id: `err_${Date.now()}`,
                role: 'system',
                content: `*${errorMessage}*`,
                timestamp: Date.now(),
            };

            set((state) => ({
                messages: [...state.messages, systemErrorMessage],
                syncBlockedUntil: Date.now() + 2000,
            }));
        }
    },
});
