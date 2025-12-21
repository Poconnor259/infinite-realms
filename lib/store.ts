import { create } from 'zustand';
import type {
    Message,
    Campaign,
    ModuleState,
    WorldModuleType,
    SubscriptionTier,
    User,
    BrainResponse,
    ClassicModuleState,
    OutworlderModuleState,
    TacticalModuleState,
} from './types';
import { DEFAULT_SUBSCRIPTION_LIMITS } from './types';
import { loadCampaign as fetchCampaign, processGameAction } from './firebase';

// Simple localStorage-based storage (works on web and React Native with polyfill)
const createStorage = () => {
    return {
        set: (key: string, value: string) => {
            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem(key, value);
                }
            } catch (e) {
                console.warn('Storage not available');
            }
        },
        getString: (key: string): string | undefined => {
            try {
                if (typeof localStorage !== 'undefined') {
                    return localStorage.getItem(key) ?? undefined;
                }
            } catch (e) {
                // Storage not available
            }
            return undefined;
        },
        delete: (key: string) => {
            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.removeItem(key);
                }
            } catch (e) {
                console.warn('Storage not available');
            }
        },
    };
};

export const storage = createStorage();

// ==================== GAME STORE ====================

interface GameState {
    // Current session
    currentCampaign: Campaign | null;
    messages: Message[];
    isLoading: boolean;
    error: string | null;

    // Actions
    setCurrentCampaign: (campaign: Campaign | null) => void;
    addMessage: (message: Message) => void;
    setMessages: (messages: Message[]) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    updateModuleState: (updates: Partial<ModuleState>) => void;
    clearMessages: () => void;

    // Game logic
    processUserInput: (input: string) => Promise<void>;
    loadCampaign: (id: string) => Promise<void>;
}

export const useGameStore = create<GameState>((set, get) => ({
    currentCampaign: null,
    messages: [],
    isLoading: false,
    error: null,

    setCurrentCampaign: (campaign) => {
        set({ currentCampaign: campaign });
        if (campaign) {
            // Cache campaign ID
            storage.set('lastCampaignId', campaign.id);
        }
    },

    addMessage: (message) => {
        set((state) => ({
            messages: [...state.messages, message],
        }));
    },

    setMessages: (messages) => set({ messages }),

    setLoading: (loading) => set({ isLoading: loading }),

    setError: (error) => set({ error }),

    updateModuleState: (updates) => {
        set((state) => {
            if (!state.currentCampaign) return state;

            return {
                currentCampaign: {
                    ...state.currentCampaign,
                    moduleState: {
                        ...state.currentCampaign.moduleState,
                        ...updates,
                    } as ModuleState,
                    updatedAt: Date.now(),
                },
            };
        });
    },

    clearMessages: () => set({ messages: [] }),

    processUserInput: async (input: string) => {
        const state = get();
        if (!state.currentCampaign) {
            set({ error: 'No active campaign' });
            return;
        }

        set({ isLoading: true, error: null });

        // Add user message immediately
        const userMessage: Message = {
            id: `msg_${Date.now()}`,
            role: 'user',
            content: input,
            timestamp: Date.now(),
        };

        const newMessages = [...state.messages, userMessage];

        set((state) => ({
            messages: newMessages,
        }));

        try {
            // Get dependencies
            const user = useUserStore.getState().user;
            const settings = useSettingsStore.getState();
            const turnsStore = useTurnsStore.getState();

            if (!user) {
                throw new Error("User not authenticated");
            }

            // Check and use turn
            if (!turnsStore.canUseTurn()) {
                throw new Error("You have run out of turns for this month. Please upgrade your plan or wait for the monthly reset.");
            }

            // Optimistically use turn
            turnsStore.useTurn();

            console.log('[Game] Processing with Cloud Function...');

            // Call Cloud Function
            const result = await processGameAction({
                campaignId: state.currentCampaign.id,
                userInput: input,
                worldModule: state.currentCampaign.worldModule,
                currentState: state.currentCampaign.moduleState as any,
                chatHistory: newMessages.slice(-10).map(m => ({
                    role: m.role,
                    content: m.content
                })),
                userTier: user.tier || 'scout',
                byokKeys: {
                    openai: settings.openaiKey || undefined,
                    anthropic: settings.anthropicKey || undefined,
                }
            });

            console.log('[Game] Result:', result.data);

            if (!result.data.success) {
                throw new Error(result.data.error || 'Unknown error from Game Brain');
            }

            const narrative = result.data.narrativeText || '...';

            const narratorMessage: Message = {
                id: `msg_${Date.now() + 1}`,
                role: 'narrator',
                content: narrative,
                timestamp: Date.now(),
            };

            // Update state
            set((state) => {
                const updatedCampaign = state.currentCampaign!;

                // Merge state updates if any
                if (result.data.stateUpdates) {
                    updatedCampaign.moduleState = {
                        ...updatedCampaign.moduleState,
                        ...result.data.stateUpdates
                    };
                    updatedCampaign.updatedAt = Date.now();
                }

                return {
                    messages: [...newMessages, narratorMessage],
                    currentCampaign: updatedCampaign,
                    isLoading: false,
                };
            });

        } catch (error) {
            console.error('[Game] Error:', error);
            set({
                isLoading: false,
                error: error instanceof Error ? error.message : 'An error occurred',
            });

            // Add system error message to chat
            const errorMessage: Message = {
                id: `err_${Date.now()}`,
                role: 'system',
                content: `*Error: ${error instanceof Error ? error.message : 'Connection failed'}*`,
                timestamp: Date.now(),
            };

            set((state) => ({
                messages: [...state.messages, errorMessage]
            }));
        }
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
                // Extract messages from campaign data if available
                const { messages = [], ...rest } = campaignData;

                set({
                    currentCampaign: rest as Campaign,
                    messages,
                    isLoading: false
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
}));

// ==================== USER STORE ====================

interface UserState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;

    // Actions
    setUser: (user: User | null) => void;
    setLoading: (loading: boolean) => void;
    logout: () => void;
}

export const useUserStore = create<UserState>((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,

    setUser: (user) => set({
        user,
        isAuthenticated: !!user,
        isLoading: false,
    }),

    setLoading: (loading) => set({ isLoading: loading }),

    logout: () => {
        storage.delete('lastCampaignId');
        set({ user: null, isAuthenticated: false });
    },
}));

// ==================== APP SETTINGS STORE ====================

interface SettingsState {
    // BYOK Settings
    openaiKey: string | null;
    anthropicKey: string | null;
    googleKey: string | null;

    // Preferences
    hapticFeedback: boolean;
    soundEffects: boolean;
    narratorVoice: boolean;
    alternatingColors: boolean;
    themeMode: 'light' | 'dark' | 'system';

    // Actions
    setApiKey: (provider: 'openai' | 'anthropic' | 'google', key: string | null) => void;
    setPreference: (key: keyof Omit<SettingsState, 'setApiKey' | 'setPreference' | 'loadSettings'>, value: any) => void;
    loadSettings: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
    openaiKey: null,
    anthropicKey: null,
    googleKey: null,
    hapticFeedback: true,
    soundEffects: true,
    narratorVoice: false,
    alternatingColors: true,
    themeMode: 'system',

    setApiKey: (provider, key) => {
        // Store securely (will use expo-secure-store in production)
        if (key) {
            storage.set(`apiKey_${provider}`, key);
        } else {
            storage.delete(`apiKey_${provider}`);
        }

        set({ [`${provider}Key`]: key } as any);
    },

    setPreference: (key, value) => {
        storage.set(`pref_${key}`, JSON.stringify(value));
        set({ [key]: value } as any);
    },

    loadSettings: () => {
        // Load API keys from storage
        const openaiKey = storage.getString('apiKey_openai') ?? null;
        const anthropicKey = storage.getString('apiKey_anthropic') ?? null;
        const googleKey = storage.getString('apiKey_google') ?? null;

        // Load preferences
        const hapticFeedback = storage.getString('pref_hapticFeedback');
        const soundEffects = storage.getString('pref_soundEffects');
        const narratorVoice = storage.getString('pref_narratorVoice');
        const alternatingColors = storage.getString('pref_alternatingColors');
        const themeMode = storage.getString('pref_themeMode');

        set({
            openaiKey,
            anthropicKey,
            googleKey,
            hapticFeedback: hapticFeedback ? JSON.parse(hapticFeedback) : true,
            soundEffects: soundEffects ? JSON.parse(soundEffects) : true,
            narratorVoice: narratorVoice ? JSON.parse(narratorVoice) : false,
            alternatingColors: alternatingColors ? JSON.parse(alternatingColors) : true,
            themeMode: themeMode ? JSON.parse(themeMode) : 'system',
        });
    },
}));

// ==================== HELPER FUNCTIONS ====================

/**
 * Get default module state for a world module type
 */
export function getDefaultModuleState(moduleType: WorldModuleType): ModuleState {
    switch (moduleType) {
        case 'classic':
            return {
                type: 'classic',
                character: {
                    id: `char_${Date.now()}`,
                    name: 'Adventurer',
                    hp: { current: 10, max: 10 },
                    level: 1,
                    class: 'Fighter',
                    race: 'Human',
                    stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
                    ac: 10,
                    proficiencyBonus: 2,
                    inventory: [],
                    gold: 0,
                    abilities: [],
                },
                encounterActive: false,
                currentLocation: 'Unknown',
                questLog: [],
            } as ClassicModuleState;

        case 'outworlder':
            return {
                type: 'outworlder',
                character: {
                    id: `char_${Date.now()}`,
                    name: 'Outworlder',
                    hp: { current: 100, max: 100 },
                    level: 1,
                    rank: 'Iron',
                    essences: [],
                    stats: {
                        power: 10,
                        speed: 10,
                        spirit: 10,
                        recovery: 10,
                    },
                    abilities: [],
                    spirit: { current: 100, max: 100 },
                    mana: { current: 100, max: 100 },
                },
                lootAwarded: [],
            } as OutworlderModuleState;

        case 'tactical':
            return {
                type: 'tactical',
                character: {
                    id: `char_${Date.now()}`,
                    name: 'Operative',
                    hp: { current: 100, max: 100 },
                    level: 1,
                    job: 'None',
                    stats: {
                        strength: 10,
                        agility: 10,
                        vitality: 10,
                        intelligence: 10,
                        perception: 10,
                    },
                    statPoints: 0,
                    mana: { current: 100, max: 100 },
                    fatigue: { current: 0, max: 100 },
                    skills: [],
                    tacticalSquad: [],
                },
                inDungeon: false,
                penaltyZoneActive: false,
            } as TacticalModuleState;
    }
}

// ==================== TURNS STORE ====================

interface TurnsState {
    used: number;
    bonusTurns: number;
    resetDate: number;
    tier: SubscriptionTier;

    // Computed
    getLimit: () => number;
    getRemaining: () => number;
    canUseTurn: () => boolean;
    getUsagePercent: () => number;

    // Actions
    useTurn: () => boolean;
    addBonusTurns: (amount: number) => void;
    setTier: (tier: SubscriptionTier) => void;
    checkAndResetMonthly: () => void;
}

const getMonthlyResetDate = (): number => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.getTime();
};

export const useTurnsStore = create<TurnsState>((set, get) => {
    // Load from storage
    const savedData = storage.getString('turnsData');
    const parsed = savedData ? JSON.parse(savedData) : null;

    const initialState = {
        used: parsed?.used ?? 0,
        bonusTurns: parsed?.bonusTurns ?? 0,
        resetDate: parsed?.resetDate ?? getMonthlyResetDate(),
        tier: (parsed?.tier as SubscriptionTier) ?? 'scout',
    };

    return {
        ...initialState,

        getLimit: () => {
            const { tier } = get();
            // If config is loaded, use it; otherwise fallback to defaults
            // For now, we only have defaults available here synchronously
            return DEFAULT_SUBSCRIPTION_LIMITS[tier] || 15;
        },

        getRemaining: () => {
            const { used, bonusTurns, getLimit } = get();
            const limit = getLimit();
            if (limit === Infinity) return Infinity;
            return Math.max(0, limit + bonusTurns - used);
        },

        canUseTurn: () => {
            const { getRemaining, tier } = get();
            if (tier === 'legend') return true; // BYOK = unlimited
            return getRemaining() > 0;
        },

        getUsagePercent: () => {
            const { used, bonusTurns, getLimit } = get();
            const limit = getLimit();
            if (limit === Infinity) return 0;
            const total = limit + bonusTurns;
            return Math.min(100, (used / total) * 100);
        },

        useTurn: () => {
            const { canUseTurn, used, tier } = get();
            if (!canUseTurn()) return false;

            if (tier !== 'legend') {
                const newUsed = used + 1;
                set({ used: newUsed });

                // Persist
                const data = JSON.stringify({
                    used: newUsed,
                    bonusTurns: get().bonusTurns,
                    resetDate: get().resetDate,
                    tier: get().tier,
                });
                storage.set('turnsData', data);
            }

            return true;
        },

        addBonusTurns: (amount) => {
            const { bonusTurns } = get();
            const newBonus = bonusTurns + amount;
            set({ bonusTurns: newBonus });

            // Persist
            const data = JSON.stringify({
                used: get().used,
                bonusTurns: newBonus,
                resetDate: get().resetDate,
                tier: get().tier,
            });
            storage.set('turnsData', data);
        },

        setTier: (tier) => {
            set({ tier });

            // Persist
            const data = JSON.stringify({
                used: get().used,
                bonusTurns: get().bonusTurns,
                resetDate: get().resetDate,
                tier,
            });
            storage.set('turnsData', data);
        },

        checkAndResetMonthly: () => {
            const { resetDate } = get();
            const now = Date.now();

            if (now >= resetDate) {
                // Reset for new month
                const newResetDate = getMonthlyResetDate();
                set({
                    used: 0,
                    bonusTurns: 0, // Bonus turns don't carry over
                    resetDate: newResetDate,
                });

                // Persist
                const data = JSON.stringify({
                    used: 0,
                    bonusTurns: 0,
                    resetDate: newResetDate,
                    tier: get().tier,
                });
                storage.set('turnsData', data);
            }
        },
    };
});

