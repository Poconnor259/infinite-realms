import { GameSlice, RollSlice, RollHistoryEntry } from './types';
import { storage } from '../utils';
import { processGameAction } from '../../firebase';
import { useSettingsStore, useUserStore, useTurnsStore } from '../../store';
import { Message } from '../../types';

export const loadRollHistory = (campaignId?: string): RollHistoryEntry[] => {
    if (!campaignId) return [];
    try {
        const stored = storage.getString(`rollHistory_${campaignId}`);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.warn('Failed to load roll history from storage');
    }
    return [];
};

export const saveRollHistory = (campaignId: string | undefined, history: RollHistoryEntry[]) => {
    if (!campaignId) return;
    try {
        storage.set(`rollHistory_${campaignId}`, JSON.stringify(history));
    } catch (e) {
        console.warn('Failed to save roll history to storage');
    }
};

export function extractRollsFromMessages(messages: Message[]): RollHistoryEntry[] {
    const rolls: RollHistoryEntry[] = [];

    for (const message of messages) {
        if (message.metadata?.diceRolls) {
            for (const diceRoll of message.metadata.diceRolls) {
                rolls.push({
                    type: diceRoll.type,
                    purpose: diceRoll.purpose || 'Unknown',
                    roll: diceRoll.result,
                    total: diceRoll.total,
                    modifier: diceRoll.modifier,
                    difficulty: diceRoll.difficulty,
                    success: diceRoll.success,
                    mode: 'auto',
                    timestamp: message.timestamp,
                });
            }
        }
    }

    return rolls.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
}

export const createRollSlice: GameSlice<RollSlice> = (set, get) => ({
    pendingChoice: null,
    pendingRoll: null,
    rollHistory: [],

    setPendingChoice: (choice) => set({ pendingChoice: choice }),

    setPendingRoll: (roll) => set({ pendingRoll: roll }),

    addRollToHistory: (entry) => {
        set((state) => {
            const newHistory = [entry, ...state.rollHistory].slice(0, 10);
            const campaignId = state.currentCampaign?.id;
            saveRollHistory(campaignId, newHistory);
            return { rollHistory: newHistory };
        });
    },

    clearRollHistory: () => {
        const campaignId = get().currentCampaign?.id;
        set({ rollHistory: [] });
        saveRollHistory(campaignId, []);
    },

    triggerManualRoll: (type = 'd20', purpose = 'Manual Roll') => {
        set({
            pendingRoll: {
                type,
                purpose,
                modifier: 0,
            },
            isLoading: false,
        });
    },

    submitRollResult: async (rollResult: number) => {
        const state = get();
        if (!state.currentCampaign || !state.pendingRoll) return;

        const capturedRoll = { ...state.pendingRoll };
        const settings = useSettingsStore.getState();
        const diceMode = settings.diceRollMode || 'digital';

        const total = rollResult + (capturedRoll.modifier || 0);
        const success = capturedRoll.difficulty ? total >= capturedRoll.difficulty : undefined;

        get().addRollToHistory({
            type: capturedRoll.type,
            purpose: capturedRoll.purpose,
            roll: rollResult,
            total,
            modifier: capturedRoll.modifier,
            difficulty: capturedRoll.difficulty,
            success,
            mode: diceMode as 'auto' | 'digital' | 'physical',
            timestamp: Date.now(),
        });

        set({ pendingRoll: null, isLoading: true, error: null });

        try {
            const user = useUserStore.getState().user;

            if (!user) {
                throw new Error("User not authenticated");
            }

            const result = await processGameAction({
                campaignId: state.currentCampaign.id,
                userInput: `[DICE ROLL RESULT: ${rollResult}]`,
                worldModule: state.currentCampaign.worldModule,
                currentState: state.currentCampaign.moduleState as any,
                chatHistory: state.messages.slice(-10).map(m => ({
                    role: m.role,
                    content: m.content
                })),
                userTier: user.tier || 'scout',
                byokKeys: {
                    openai: settings.openaiKey || undefined,
                    anthropic: settings.anthropicKey || undefined,
                },
                interactiveDiceRolls: false,
                rollResult: rollResult,
                pendingRoll: capturedRoll,
            });

            if (!result.data.success) {
                throw new Error(result.data.error || 'Failed to process roll result');
            }

            const narrative = result.data.narrativeText || '...';

            const narratorMessage: Message = {
                id: `msg_${Date.now()}`,
                role: 'narrator',
                content: narrative,
                timestamp: Date.now(),
                metadata: {
                    voiceModel: result.data.voiceModelId,
                    turnCost: result.data.turnCost,
                    diceRolls: [{
                        type: capturedRoll.type || 'd20',
                        result: rollResult,
                        total: rollResult + (capturedRoll.modifier || 0),
                        purpose: capturedRoll.purpose,
                        modifier: capturedRoll.modifier,
                        difficulty: capturedRoll.difficulty,
                        success: capturedRoll.difficulty ? (rollResult + (capturedRoll.modifier || 0) >= capturedRoll.difficulty) : undefined
                    }],
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
                    messages: [...s.messages, narratorMessage],
                    currentCampaign: updatedCampaign,
                    isLoading: false,
                    pendingChoice: result.data.pendingChoice && result.data.pendingChoice.options && result.data.pendingChoice.options.length > 0
                        ? result.data.pendingChoice
                        : (result.data.requiresUserInput && result.data.pendingChoice ? result.data.pendingChoice : null),
                    pendingRoll: result.data.pendingRoll || null,
                };
            });

            if (result.data.remainingTurns !== undefined) {
                useTurnsStore.setState({ balance: result.data.remainingTurns });
            }

            set({ syncBlockedUntil: Date.now() + 2000 });
        } catch (error) {
            console.error('[Game] Roll result submission error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Roll submission failed';

            get().addToast({
                type: 'error',
                message: errorMessage,
                duration: 7000,
            });

            set({
                isLoading: false,
                error: errorMessage,
                syncBlockedUntil: Date.now() + 2000,
            });
        }
    },
});
