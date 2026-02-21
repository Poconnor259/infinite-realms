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
    GlobalConfig,
} from './types';
import { DEFAULT_SUBSCRIPTION_LIMITS } from './types';
import { loadCampaign as fetchCampaign, processGameAction } from './firebase';

// Import our new sliced store structure
import { GameState } from './store/slices/types';
import { createCampaignSlice } from './store/slices/campaignSlice';
import { createMessageSlice } from './store/slices/messageSlice';
import { createUiSlice } from './store/slices/uiSlice';
import { createRollSlice } from './store/slices/rollSlice';
import { storage, withRetry, generateToastId, getErrorMessage } from './store/utils';

// Re-export utility types and functions for backwards compatibility
export { storage, withRetry, getErrorMessage };
export type { RollHistoryEntry, Toast } from './store/slices/types';

// ==================== GAME STORE ====================

export const useGameStore = create<GameState>((set, get, api) => ({
    ...createCampaignSlice(set, get, api),
    ...createMessageSlice(set, get, api),
    ...createUiSlice(set, get, api),
    ...createRollSlice(set, get, api),
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
    backgroundAmbiance: boolean;
    showFavoritesOnly: boolean;
    themeMode: 'light' | 'dark' | 'system';
    themeVariant: 'default' | 'midnight' | 'forest' | 'ocean';
    fontFamily: 'inter' | 'roboto' | 'outfit' | 'system';
    fontSize: 'small' | 'medium' | 'large' | 'xlarge';
    diceRollMode: 'auto' | 'digital' | 'physical';
    showSuggestedChoices: boolean; // Default: true

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
    backgroundAmbiance: false,
    showFavoritesOnly: false,
    themeMode: 'system',
    themeVariant: 'default',
    fontFamily: 'inter',
    fontSize: 'medium',
    diceRollMode: 'auto',
    showSuggestedChoices: true,

    setApiKey: (provider, key) => {
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
        const openaiKey = storage.getString('apiKey_openai') ?? null;
        const anthropicKey = storage.getString('apiKey_anthropic') ?? null;
        const googleKey = storage.getString('apiKey_google') ?? null;

        const hapticFeedback = storage.getString('pref_hapticFeedback');
        const soundEffects = storage.getString('pref_soundEffects');
        const narratorVoice = storage.getString('pref_narratorVoice');
        const backgroundAmbiance = storage.getString('pref_backgroundAmbiance');
        const showFavoritesOnly = storage.getString('pref_showFavoritesOnly');
        const themeMode = storage.getString('pref_themeMode');
        const themeVariant = storage.getString('pref_themeVariant');
        const fontFamily = storage.getString('pref_fontFamily');
        const fontSize = storage.getString('pref_fontSize');
        const diceRollMode = storage.getString('pref_diceRollMode');
        const showSuggestedChoices = storage.getString('pref_showSuggestedChoices');

        set({
            openaiKey,
            anthropicKey,
            googleKey,
            hapticFeedback: hapticFeedback ? JSON.parse(hapticFeedback) : true,
            soundEffects: soundEffects ? JSON.parse(soundEffects) : true,
            narratorVoice: narratorVoice ? JSON.parse(narratorVoice) : false,
            backgroundAmbiance: backgroundAmbiance ? JSON.parse(backgroundAmbiance) : false,
            showFavoritesOnly: showFavoritesOnly ? JSON.parse(showFavoritesOnly) : false,
            themeMode: themeMode ? JSON.parse(themeMode) : 'system',
            themeVariant: themeVariant ? JSON.parse(themeVariant) : 'default',
            fontFamily: fontFamily ? JSON.parse(fontFamily) : 'inter',
            fontSize: fontSize ? JSON.parse(fontSize) : 'medium',
            diceRollMode: diceRollMode ? JSON.parse(diceRollMode) : 'digital',
            showSuggestedChoices: showSuggestedChoices ? JSON.parse(showSuggestedChoices) : true,
        });
    },
}));

// ==================== HELPER FUNCTIONS ====================

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
                    mana: { current: 100, max: 100 },
                    stamina: { current: 100, max: 100 },
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
                    stamina: { current: 100, max: 100 },
                    mana: { current: 100, max: 100 },
                },
                encounterActive: false,
                currentLocation: 'Unknown',
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
                    nanites: { current: 10, max: 100 },
                    stamina: { current: 100, max: 100 },
                    skills: [],
                    tacticalSquad: [],
                },
                inDungeon: false,
                currentLocation: 'Unknown',
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
    balance: number;

    // Computed
    getLimit: () => number;
    getRemaining: () => number;
    canUseTurn: (cost?: number) => boolean;
    getUsagePercent: () => number;

    // Actions
    useTurn: (cost?: number) => boolean;
    addBonusTurns: (amount: number) => void;
    setTier: (tier: SubscriptionTier) => void;
    checkAndResetMonthly: () => void;
    syncFromFirestore: (userId: string) => Promise<void>;
}

const getMonthlyResetDate = (): number => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.getTime();
};

export const useTurnsStore = create<TurnsState>((set, get) => {
    const savedData = storage.getString('turnsData');
    const parsed = savedData ? JSON.parse(savedData) : null;

    const initialState = {
        used: parsed?.used ?? 0,
        bonusTurns: parsed?.bonusTurns ?? 0,
        resetDate: parsed?.resetDate ?? getMonthlyResetDate(),
        tier: (parsed?.tier as SubscriptionTier) ?? 'scout',
        balance: parsed?.balance ?? 0,
    };

    return {
        ...initialState,

        getLimit: () => {
            const { tier } = get();
            return DEFAULT_SUBSCRIPTION_LIMITS[tier] || 15;
        },

        getRemaining: () => {
            const { getLimit, balance, tier } = get();
            if (tier === 'legendary') return Infinity;
            return balance;
        },

        canUseTurn: (cost = 1) => {
            const { getRemaining, tier } = get();
            if (tier === 'legendary') return true;
            return getRemaining() >= cost;
        },

        getUsagePercent: () => {
            const { getLimit, balance, tier } = get();
            if (tier === 'legendary') return 0;
            const limit = getLimit();
            if (limit === Infinity || limit === 0) return 0;

            const used = Math.max(0, limit - balance);
            return Math.min(100, (used / limit) * 100);
        },

        useTurn: (cost = 1) => {
            const { canUseTurn, used, tier, balance } = get();
            if (!canUseTurn(cost)) return false;

            if (tier !== 'legendary') {
                const newUsed = used + cost;
                const newBalance = balance - cost;
                set({ used: newUsed, balance: newBalance });

                const data = JSON.stringify({
                    used: newUsed,
                    balance: newBalance,
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
                const newResetDate = getMonthlyResetDate();
                set({
                    used: 0,
                    bonusTurns: 0,
                    resetDate: newResetDate,
                });

                const data = JSON.stringify({
                    used: 0,
                    bonusTurns: 0,
                    resetDate: newResetDate,
                    tier: get().tier,
                });
                storage.set('turnsData', data);
            }
        },

        syncFromFirestore: async (userId: string) => {
            try {
                const { db } = await import('./firebase');
                const { getDoc, doc } = await import('firebase/firestore');
                const userDocRef = doc(db, 'users', userId);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const firestoreTurnsUsed = userData?.turnsUsed || 0;
                    const firestoreTurnsBalance = userData?.turns ?? 0;
                    const tier = (userData?.tier as SubscriptionTier) || 'scout';

                    set({
                        used: firestoreTurnsUsed,
                        balance: firestoreTurnsBalance,
                        tier,
                    });

                    const data = JSON.stringify({
                        used: firestoreTurnsUsed,
                        balance: firestoreTurnsBalance,
                        bonusTurns: get().bonusTurns,
                        resetDate: get().resetDate,
                        tier,
                    });
                    storage.set('turnsData', data);

                    console.log('[TurnsStore] Synced from Firestore:', { used: firestoreTurnsUsed, balance: firestoreTurnsBalance, tier });
                }
            } catch (error) {
                console.error('[TurnsStore] Failed to sync from Firestore:', error);
            }
        },
    };
});

// ==================== CONFIG STORE ====================

interface ConfigState {
    config: GlobalConfig | null;
    isLoading: boolean;
    error: string | null;

    // Actions
    setConfig: (config: GlobalConfig | null) => void;
    syncConfig: () => () => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
    config: null,
    isLoading: true,
    error: null,

    setConfig: (config) => set({ config, isLoading: false }),

    syncConfig: () => {
        set({ isLoading: true });
        const sync = async () => {
            try {
                const { db } = await import('./firebase');
                const { doc, onSnapshot } = await import('firebase/firestore');

                const unsubscribe = onSnapshot(doc(db, 'config', 'global'), (snapshot) => {
                    if (snapshot.exists()) {
                        set({ config: snapshot.data() as GlobalConfig, isLoading: false, error: null });
                    } else {
                        set({ isLoading: false, error: 'Config document not found' });
                    }
                }, (err) => {
                    console.error('[ConfigStore] Sync error:', err);
                    set({ error: err.message, isLoading: false });
                });

                return unsubscribe;
            } catch (err: any) {
                console.error('[ConfigStore] Initialization error:', err);
                set({ error: err.message, isLoading: false });
                return () => { };
            }
        };

        let unsub: () => void = () => { };
        sync().then(u => unsub = u);
        return () => unsub();
    }
}));
