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
    ShadowMonarchModuleState,
} from './types';

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

        set((state) => ({
            messages: [...state.messages, userMessage],
        }));

        try {
            // This will be replaced with actual API call to Cloud Functions
            // For now, simulate a response
            await new Promise((resolve) => setTimeout(resolve, 1500));

            const narratorMessage: Message = {
                id: `msg_${Date.now() + 1}`,
                role: 'narrator',
                content: `*Processing your action: "${input}"*\n\n[This is a placeholder. Connect to Firebase Cloud Functions to enable the AI Brain and Voice.]`,
                timestamp: Date.now(),
            };

            set((state) => ({
                messages: [...state.messages, narratorMessage],
                isLoading: false,
            }));
        } catch (error) {
            set({
                isLoading: false,
                error: error instanceof Error ? error.message : 'An error occurred',
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

        set({
            openaiKey,
            anthropicKey,
            googleKey,
            hapticFeedback: hapticFeedback ? JSON.parse(hapticFeedback) : true,
            soundEffects: soundEffects ? JSON.parse(soundEffects) : true,
            narratorVoice: narratorVoice ? JSON.parse(narratorVoice) : false,
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
                    abilities: [],
                    spirit: { current: 100, max: 100 },
                    mana: { current: 100, max: 100 },
                },
                lootAwarded: [],
            } as OutworlderModuleState;

        case 'shadowMonarch':
            return {
                type: 'shadowMonarch',
                character: {
                    id: `char_${Date.now()}`,
                    name: 'Hunter',
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
                    shadowArmy: [],
                },
                inDungeon: false,
                penaltyZoneActive: false,
            } as ShadowMonarchModuleState;
    }
}
