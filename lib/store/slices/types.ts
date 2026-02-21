import { StateCreator } from 'zustand';
import type { Campaign, Message, ModuleState } from '../../types';

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

export interface RollHistoryEntry {
    type: string;
    purpose: string;
    roll: number;
    total: number;
    modifier?: number;
    difficulty?: number;
    success?: boolean;
    mode: 'auto' | 'digital' | 'physical';
    timestamp: number;
}

export interface CampaignSlice {
    currentCampaign: Campaign | null;
    syncBlockedUntil: number;
    setCurrentCampaign: (campaign: Campaign | null) => void;
    updateCurrentCampaign: (updates: Partial<Campaign>) => void;
    updateModuleState: (updates: Partial<ModuleState>) => void;
    loadCampaign: (id: string) => Promise<void>;
}

export interface MessageSlice {
    messages: Message[];
    editingMessage: string | null;
    lastFailedRequest: { input: string; timestamp: number } | null;
    addMessage: (message: Message) => void;
    setMessages: (messages: Message[]) => void;
    clearMessages: () => void;
    setEditingMessage: (text: string | null) => void;
    deleteLastUserMessageAndResponse: () => string | null;
    retryLastRequest: () => Promise<void>;
    clearFailedRequest: () => void;
    processUserInput: (input: string) => Promise<void>;
}

export interface UiSlice {
    isLoading: boolean;
    error: string | null;
    toasts: Toast[];
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    addToast: (toast: Omit<Toast, 'id'>) => void;
    removeToast: (id: string) => void;
}

export interface RollSlice {
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
        rollType?: 'skill' | 'attack' | 'savingThrow' | 'check';
        proficiencyApplies?: boolean;
        itemBonus?: number;
        situationalMod?: number;
        advantageSources?: string[];
        disadvantageSources?: string[];
    } | null;
    rollHistory: RollHistoryEntry[];
    setPendingChoice: (choice: { prompt: string; options?: string[]; choiceType: string } | null) => void;
    setPendingRoll: (roll: RollSlice['pendingRoll']) => void;
    triggerManualRoll: (type?: string, purpose?: string) => void;
    submitRollResult: (rollResult: number) => Promise<void>;
    addRollToHistory: (entry: RollHistoryEntry) => void;
    clearRollHistory: () => void;
}

export type GameState = CampaignSlice & MessageSlice & UiSlice & RollSlice;

export type GameSlice<T> = StateCreator<GameState, [], [], T>;
