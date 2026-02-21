import { GameSlice, CampaignSlice } from './types';
import { storage } from '../utils';
import { loadCampaign as fetchCampaign } from '../../firebase';
import { useUserStore } from '../../store';
import { loadRollHistory, extractRollsFromMessages, saveRollHistory } from './rollSlice';

export const createCampaignSlice: GameSlice<CampaignSlice> = (set, get) => ({
    currentCampaign: null,
    syncBlockedUntil: 0,

    setCurrentCampaign: (campaign) => {
        set({ currentCampaign: campaign });
        if (campaign) {
            storage.set('lastCampaignId', campaign.id);
        }
    },

    updateCurrentCampaign: (updates) => {
        set((state) => {
            if (!state.currentCampaign) return state;

            // GUARD: If sync is blocked, ignore remote updates
            if (state.syncBlockedUntil && Date.now() < state.syncBlockedUntil) {
                console.log('[Store] updateCurrentCampaign blocked by sync lock');
                return state;
            }

            const updatedCampaign = {
                ...state.currentCampaign,
                ...updates,
            };

            const incomingPendingRoll = (updates.moduleState as any)?.pendingRoll;

            let newPendingRoll = state.pendingRoll;
            if (updates.moduleState && incomingPendingRoll !== undefined) {
                if (!state.isLoading) {
                    newPendingRoll = incomingPendingRoll;
                }
            }

            return {
                currentCampaign: updatedCampaign,
                pendingRoll: newPendingRoll
            };
        });
    },

    updateModuleState: (updates) => {
        set((state) => {
            if (!state.currentCampaign) return state;

            return {
                currentCampaign: {
                    ...state.currentCampaign,
                    moduleState: {
                        ...state.currentCampaign.moduleState,
                        ...updates,
                    } as any,
                    updatedAt: Date.now(),
                },
            };
        });
    },

    loadCampaign: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
            const userId = useUserStore.getState().user?.id;

            if (!userId) {
                throw new Error("Authentication required to load campaign");
            }

            const campaignData = await fetchCampaign(userId, id);

            if (campaignData) {
                const { messages = [], ...rest } = campaignData;

                const storedRollHistory = loadRollHistory(id);

                const rollHistory = storedRollHistory.length > 0
                    ? storedRollHistory
                    : extractRollsFromMessages(messages);

                if (rollHistory.length > 0 && storedRollHistory.length === 0) {
                    console.log('[Store] Extracted', rollHistory.length, 'dice rolls from messages on campaign load');
                    saveRollHistory(id, rollHistory);
                }

                set({
                    currentCampaign: rest as any,
                    messages,
                    rollHistory,
                    isLoading: false,
                    pendingRoll: (rest as any).moduleState?.pendingRoll || null,
                    pendingChoice: (rest as any).moduleState?.pendingChoice || null,
                });
                storage.set('lastCampaignId', id);
            } else {
                set({
                    error: 'Campaign not found',
                    isLoading: false
                });
            }
        } catch (error) {
            console.error(error);
            set({
                error: error instanceof Error ? error.message : 'Failed to load campaign',
                isLoading: false
            });
        }
    },
});
