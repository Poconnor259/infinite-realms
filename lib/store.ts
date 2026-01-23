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

// ==================== RETRY CONFIGURATION ====================

const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 1000,  // 1 second
    maxDelay: 10000,  // 10 seconds
    retryableCodes: ['internal', 'unavailable', 'deadline-exceeded', 'resource-exhausted'],
    retryableStatuses: [500, 502, 503, 504, 429],
};

/**
 * Retry a function with exponential backoff
 * @param fn Function to retry
 * @param onRetry Callback for each retry attempt (attempt number, delay in ms, max retries)
 */
async function withRetry<T>(
    fn: () => Promise<T>,
    onRetry?: (attempt: number, delay: number, maxRetries: number) => void
): Promise<T> {
    let lastError: any = null;

    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;

            // Check if error is retryable
            const errorCode = error?.code || '';
            const errorStatus = error?.status || 0;
            const isRetryable =
                RETRY_CONFIG.retryableCodes.includes(errorCode) ||
                RETRY_CONFIG.retryableStatuses.includes(errorStatus);

            // Don't retry if not retryable or max retries reached
            if (!isRetryable || attempt === RETRY_CONFIG.maxRetries) {
                throw error;
            }

            // Calculate delay with exponential backoff
            const delay = Math.min(
                RETRY_CONFIG.baseDelay * Math.pow(2, attempt),
                RETRY_CONFIG.maxDelay
            );

            // Notify about retry
            onRetry?.(attempt + 1, delay, RETRY_CONFIG.maxRetries);

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

// ==================== TOAST NOTIFICATIONS ====================

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
    action?: {
        label: string;
        onPress: () => void;
    };
}

function generateToastId(): string {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ==================== ERROR MESSAGE HELPER ====================

function getErrorMessage(error: any): { message: string; isRetryable: boolean } {
    const errorCode = error?.code || '';
    const errorMessage = error?.message || '';

    // Authentication errors
    if (errorCode === 'unauthenticated' || errorCode.includes('auth')) {
        return { message: 'Please sign in again to continue', isRetryable: false };
    }

    // Turn limit errors
    if (errorMessage.includes('run out of turns')) {
        return { message: 'Out of turns. Upgrade your plan or wait for monthly reset.', isRetryable: false };
    }

    // Network/timeout errors
    if (errorCode === 'unavailable' || errorCode === 'deadline-exceeded') {
        return { message: 'Connection timeout. Check your internet connection.', isRetryable: true };
    }

    // Rate limit
    if (errorCode === 'resource-exhausted' || error?.status === 429) {
        return { message: 'Too many requests. Please wait a moment.', isRetryable: true };
    }

    // AI-specific errors (Anthropic/OpenAI)
    if (errorMessage.includes('overloaded') || errorMessage.includes('capacity')) {
        return { message: 'AI service is busy. Please try again.', isRetryable: true };
    }

    // Server errors
    if (errorCode === 'internal' || (error?.status >= 500 && error?.status < 600)) {
        return { message: 'Server error. Our team has been notified.', isRetryable: true };
    }

    // Generic fallback
    return { message: errorMessage || 'An unexpected error occurred', isRetryable: false };
}

// ==================== GAME STORE ====================

export interface RollHistoryEntry {
    type: string;           // "d20", "2d6", etc.
    purpose: string;        // "Attack Roll", "Saving Throw", etc.
    roll: number;           // Raw dice result
    total: number;          // Result + modifier
    modifier?: number;      // Modifier applied (+3, -2, etc.)
    difficulty?: number;    // DC/Target number
    success?: boolean;      // If there was a DC check
    mode: 'auto' | 'digital' | 'physical';  // How the roll was made
    timestamp: number;      // When the roll occurred
}

interface GameState {
    // Current session
    currentCampaign: Campaign | null;
    messages: Message[];
    isLoading: boolean;
    error: string | null;
    pendingChoice: {
        prompt: string;
        options?: string[];
        choiceType: string;
    } | null;
    pendingRoll: {
        type: string;
        purpose: string;
        modifier?: number;
        stat?: string;
        difficulty?: number;
    } | null;
    rollHistory: RollHistoryEntry[];

    // Sync control - prevents Firestore sync from overwriting local state during active flows
    syncBlockedUntil: number;

    // Toast notifications
    toasts: Toast[];

    // Edit & Retry
    editingMessage: string | null; // Text of message being edited
    lastFailedRequest: { input: string; timestamp: number } | null;

    // Actions
    setCurrentCampaign: (campaign: Campaign | null) => void;
    updateCurrentCampaign: (updates: Partial<Campaign>) => void;
    addMessage: (message: Message) => void;
    setMessages: (messages: Message[]) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    updateModuleState: (updates: Partial<ModuleState>) => void;
    clearMessages: () => void;
    setPendingChoice: (choice: { prompt: string; options?: string[]; choiceType: string } | null) => void;
    setPendingRoll: (roll: { type: string; purpose: string; modifier?: number; stat?: string; difficulty?: number } | null) => void;
    submitRollResult: (rollResult: number) => Promise<void>;
    addRollToHistory: (entry: RollHistoryEntry) => void;
    clearRollHistory: () => void;

    // Toast Actions
    addToast: (toast: Omit<Toast, 'id'>) => void;
    removeToast: (id: string) => void;

    // Edit & Retry Actions
    setEditingMessage: (text: string | null) => void;
    deleteLastUserMessageAndResponse: () => string | null; // Returns the deleted message text
    retryLastRequest: () => Promise<void>;
    clearFailedRequest: () => void;

    // Game logic
    processUserInput: (input: string) => Promise<void>;
    loadCampaign: (id: string) => Promise<void>;
}

// Initialize roll history from localStorage (campaign-specific)
const loadRollHistory = (campaignId?: string): RollHistoryEntry[] => {
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

const saveRollHistory = (campaignId: string | undefined, history: RollHistoryEntry[]) => {
    if (!campaignId) return;
    try {
        storage.set(`rollHistory_${campaignId}`, JSON.stringify(history));
    } catch (e) {
        console.warn('Failed to save roll history to storage');
    }
};

/**
 * Extract dice rolls from message metadata and convert to RollHistoryEntry[]
 * Used to populate roll history from Firestore messages
 */
function extractRollsFromMessages(messages: Message[]): RollHistoryEntry[] {
    const rolls: RollHistoryEntry[] = [];

    for (const message of messages) {
        if (message.metadata?.diceRolls) {
            for (const diceRoll of message.metadata.diceRolls) {
                rolls.push({
                    type: diceRoll.type,
                    purpose: diceRoll.purpose || 'Unknown',
                    roll: diceRoll.result,
                    total: diceRoll.total,
                    success: undefined, // Not stored in DiceRoll type
                    mode: 'auto', // Assume auto since it came from backend
                    timestamp: message.timestamp,
                });
            }
        }
    }

    // Sort by timestamp (newest first) and limit to 10
    return rolls.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
}

export const useGameStore = create<GameState>((set, get) => ({
    currentCampaign: null,
    messages: [],
    isLoading: false,
    error: null,
    pendingChoice: null,
    pendingRoll: null,
    rollHistory: [], // Will be loaded when campaign loads
    syncBlockedUntil: 0, // Timestamp - blocks Firestore sync until this time
    toasts: [],
    editingMessage: null,
    lastFailedRequest: null,

    setCurrentCampaign: (campaign) => {
        set({ currentCampaign: campaign });
        if (campaign) {
            // Cache campaign ID
            storage.set('lastCampaignId', campaign.id);
        }
    },

    updateCurrentCampaign: (updates) => {
        set((state) => {
            if (!state.currentCampaign) return state;
            return {
                currentCampaign: {
                    ...state.currentCampaign,
                    ...updates,
                }
            };
        });
    },

    addMessage: (message) => {
        set((state) => ({
            messages: [...state.messages, message],
        }));
    },

    setMessages: (messages) => {
        set({ messages });

        // Extract dice rolls from message metadata and populate roll history
        const campaignId = get().currentCampaign?.id;
        if (campaignId) {
            const extractedRolls = extractRollsFromMessages(messages);
            if (extractedRolls.length > 0) {
                console.log('[Store] Extracted', extractedRolls.length, 'dice rolls from messages');
                set({ rollHistory: extractedRolls });
                saveRollHistory(campaignId, extractedRolls);
            }
        }
    },

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

    addToast: (toast) => {
        const id = generateToastId();
        const newToast: Toast = { ...toast, id };
        set((state) => ({ toasts: [...state.toasts, newToast] }));

        // Auto-remove toast after duration (default 5 seconds)
        const duration = toast.duration || 5000;
        setTimeout(() => {
            get().removeToast(id);
        }, duration);
    },

    removeToast: (id) => {
        set((state) => ({
            toasts: state.toasts.filter(t => t.id !== id)
        }));
    },

    submitRollResult: async (rollResult: number) => {
        const state = get();
        if (!state.currentCampaign || !state.pendingRoll) return;

        // IMPORTANT: Capture pendingRoll data BEFORE clearing state
        // This prevents race condition where we try to access null pendingRoll later
        const capturedRoll = { ...state.pendingRoll };

        // Determine the dice mode used for history
        const settings = useSettingsStore.getState();
        const diceMode = settings.diceRollMode || 'digital';

        // Add roll to history IMMEDIATELY (before backend call)
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

        // Clear the pending roll and set loading
        set({ pendingRoll: null, isLoading: true, error: null });

        try {
            const user = useUserStore.getState().user;
            const settings = useSettingsStore.getState();

            if (!user) {
                throw new Error("User not authenticated");
            }

            // Call Cloud Function with roll result to continue
            const result = await processGameAction({
                campaignId: state.currentCampaign.id,
                userInput: `[DICE ROLL RESULT: ${rollResult}]`, // Special marker for continuation
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
                interactiveDiceRolls: false, // Don't pause again
                rollResult: rollResult,
                // Send captured pendingRoll data for Fate Engine processing
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
                    diceRolls: [{ type: capturedRoll.type || 'd20', result: rollResult, total: rollResult + (capturedRoll.modifier || 0), purpose: capturedRoll.purpose }],
                    debug: result.data.debug,
                },
            };

            // Update state with narrator message
            set((s) => {
                const updatedCampaign = s.currentCampaign!;
                if (result.data.stateUpdates) {
                    updatedCampaign.moduleState = {
                        ...updatedCampaign.moduleState,
                        ...result.data.stateUpdates
                    };
                    updatedCampaign.updatedAt = Date.now();
                }
                return {
                    messages: [...s.messages, narratorMessage],
                    currentCampaign: updatedCampaign,
                    isLoading: false,
                    pendingChoice: result.data.requiresUserInput && result.data.pendingChoice
                        ? result.data.pendingChoice
                        : null,
                };
            });

            // Sync turns balance if provided
            if (result.data.remainingTurns !== undefined) {
                useTurnsStore.setState({ balance: result.data.remainingTurns });
            }

            // Block Firestore sync for 2 seconds to prevent race conditions
            set({ syncBlockedUntil: Date.now() + 2000 });
        } catch (error) {
            console.error('[Game] Roll result submission error:', error);

            const errorMessage = error instanceof Error ? error.message : 'Roll submission failed';

            // Show error toast to user
            get().addToast({
                type: 'error',
                message: errorMessage,
                duration: 7000,
            });

            set({
                isLoading: false,
                error: errorMessage,
                syncBlockedUntil: Date.now() + 2000, // Block sync even on error
            });
        }
    },

    setEditingMessage: (text) => set({ editingMessage: text }),

    clearFailedRequest: () => set({ lastFailedRequest: null }),

    deleteLastUserMessageAndResponse: () => {
        const state = get();
        const messages = [...state.messages];

        // Find the last user message
        let lastUserIndex = -1;
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'user') {
                lastUserIndex = i;
                break;
            }
        }

        if (lastUserIndex === -1) return null;

        const userMessageText = messages[lastUserIndex].content;

        // Remove the user message and everything after it (including any narrator response)
        const newMessages = messages.slice(0, lastUserIndex);

        // Clear dice roll and choice state when editing
        set({
            messages: newMessages,
            editingMessage: userMessageText,
            pendingRoll: null,  // Clear any pending dice roll
            pendingChoice: null // Clear any pending choice
        });

        return userMessageText;
    },

    retryLastRequest: async () => {
        const { lastFailedRequest, processUserInput, clearFailedRequest, isLoading } = get();

        // Prevent double-retry
        if (isLoading) {
            console.warn('[Game] Request already in progress, skipping retry');
            return;
        }

        if (!lastFailedRequest) {
            console.warn('[Game] No failed request to retry');
            return;
        }

        // Clear the failed request and remove the error message
        const messages = get().messages.filter(m => !m.id.startsWith('err_'));
        set({ messages });

        clearFailedRequest();

        // Retry the request
        await processUserInput(lastFailedRequest.input);
    },

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

            // Check turn availability (server will handle actual deduction atomically)
            if (!turnsStore.canUseTurn()) {
                throw new Error("You have run out of turns for this month. Please upgrade your plan or wait for the monthly reset.");
            }

            console.log('[Game] Processing with Cloud Function...');

            // Call Cloud Function with retry logic
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
                }),
                (attempt, delay, maxRetries) => {
                    // Show retry toast with counter
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

            // Check if we have a pending dice roll (no narrator message yet)
            if (result.data.pendingRoll) {
                console.log('[Game] Pending dice roll detected:', result.data.pendingRoll);
                set({
                    isLoading: false,
                    pendingRoll: result.data.pendingRoll,
                    pendingChoice: null,
                });
                return; // Wait for user to roll dice
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
                    debug: result.data.debug, // Attach debug data for admin viewing
                },
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
                    pendingChoice: result.data.requiresUserInput && result.data.pendingChoice
                        ? result.data.pendingChoice
                        : null,
                    pendingRoll: null, // Clear any pending roll
                };
            });

            // Sync turns balance if provided
            if (result.data.remainingTurns !== undefined) {
                useTurnsStore.setState({ balance: result.data.remainingTurns });

                // Persist
                const turnsData = storage.getString('turnsData');
                if (turnsData) {
                    const parsed = JSON.parse(turnsData);
                    storage.set('turnsData', JSON.stringify({
                        ...parsed,
                        balance: result.data.remainingTurns
                    }));
                }
            }

            // Trigger ambiance detection if enabled
            const backgroundAmbianceEnabled = useSettingsStore.getState().backgroundAmbiance;
            if (backgroundAmbianceEnabled && narrative) {
                // Dynamic import to avoid circular dependencies
                import('./ambiance').then(({ detectAmbianceFromText, fadeToAmbiance }) => {
                    const detectedAmbiance = detectAmbianceFromText(narrative);
                    if (detectedAmbiance !== 'none') {
                        fadeToAmbiance(detectedAmbiance).catch(console.warn);
                    }
                });
            }

            // Play message received sound if enabled
            const soundEffectsEnabled = useSettingsStore.getState().soundEffects;
            if (soundEffectsEnabled && narrative) {
                import('./sounds').then(({ playMessageReceived }) => {
                    playMessageReceived();
                });
            }

            // Block Firestore sync for 2 seconds to prevent race conditions
            set({ syncBlockedUntil: Date.now() + 2000 });

        } catch (error) {
            console.error('[Game] Error:', error);

            // Get specific error message
            const { message: errorMessage, isRetryable } = getErrorMessage(error);

            // Show error toast with optional retry button
            get().addToast({
                type: 'error',
                message: errorMessage,
                duration: isRetryable ? 10000 : 7000,
                action: isRetryable ? {
                    label: 'Retry',
                    onPress: () => get().retryLastRequest()
                } : undefined,
            });

            // Save the failed request for retry
            set({
                isLoading: false,
                error: errorMessage,
                lastFailedRequest: { input, timestamp: Date.now() },
            });

            // Add system error message to chat
            const systemErrorMessage: Message = {
                id: `err_${Date.now()}`,
                role: 'system',
                content: `*${errorMessage}*`,
                timestamp: Date.now(),
            };

            set((state) => ({
                messages: [...state.messages, systemErrorMessage],
                syncBlockedUntil: Date.now() + 2000, // Block sync even on error
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

                // Load campaign-specific roll history
                const storedRollHistory = loadRollHistory(id);

                // If no stored history, extract from messages
                const rollHistory = storedRollHistory.length > 0
                    ? storedRollHistory
                    : extractRollsFromMessages(messages);

                if (rollHistory.length > 0 && storedRollHistory.length === 0) {
                    console.log('[Store] Extracted', rollHistory.length, 'dice rolls from messages on campaign load');
                    saveRollHistory(id, rollHistory);
                }

                set({
                    currentCampaign: rest as Campaign,
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
    diceRollMode: 'digital',

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
        const backgroundAmbiance = storage.getString('pref_backgroundAmbiance');
        const showFavoritesOnly = storage.getString('pref_showFavoritesOnly');
        const themeMode = storage.getString('pref_themeMode');
        const themeVariant = storage.getString('pref_themeVariant');
        const fontFamily = storage.getString('pref_fontFamily');
        const fontSize = storage.getString('pref_fontSize');
        const diceRollMode = storage.getString('pref_diceRollMode');

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
    // Load from storage
    const savedData = storage.getString('turnsData');
    const parsed = savedData ? JSON.parse(savedData) : null;

    const initialState = {
        used: parsed?.used ?? 0,
        bonusTurns: parsed?.bonusTurns ?? 0,
        resetDate: parsed?.resetDate ?? getMonthlyResetDate(),
        tier: (parsed?.tier as SubscriptionTier) ?? 'scout',
        balance: parsed?.balance ?? 0, // Cache balance
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
            const { used, bonusTurns, getLimit, balance, tier } = get();
            if (tier === 'legendary') return Infinity;

            const limit = getLimit();
            // If we have a cached balance from Firestore, prefer it? 
            // Actually, balance should be sync'd. 
            // remaining = limit - used + bonusTurns
            // But if Firestore 'turns' exists, that's our absolute truth.
            return balance;
        },

        canUseTurn: (cost = 1) => {
            const { getRemaining, tier } = get();
            if (tier === 'legendary') return true; // BYOK = unlimited
            return getRemaining() >= cost;
        },

        getUsagePercent: () => {
            const { getLimit, balance, tier } = get();
            if (tier === 'legendary') return 0;
            const limit = getLimit();
            if (limit === Infinity || limit === 0) return 0;

            // Usage % = ((Limit - Balance) / Limit) * 100
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

                // Persist
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

        syncFromFirestore: async (userId: string) => {
            try {
                const { db } = await import('./firebase');
                const { getDoc, doc } = await import('firebase/firestore');
                const userDocRef = doc(db, 'users', userId);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const firestoreTurnsUsed = userData?.turnsUsed || 0;
                    const firestoreTurnsBalance = userData?.turns ?? 0; // The actual remaining turns
                    const tier = (userData?.tier as SubscriptionTier) || 'scout';

                    // Update local state with Firestore data
                    set({
                        used: firestoreTurnsUsed,
                        balance: firestoreTurnsBalance,
                        tier,
                    });

                    // Persist to storage
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
    syncConfig: () => () => void; // Returns unsubscribe function
}

export const useConfigStore = create<ConfigState>((set) => ({
    config: null,
    isLoading: true,
    error: null,

    setConfig: (config) => set({ config, isLoading: false }),

    syncConfig: () => {
        set({ isLoading: true });
        // Dynamic import to avoid circular dependencies or early initialization issues
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
