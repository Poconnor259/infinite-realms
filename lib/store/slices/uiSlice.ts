import { GameSlice, UiSlice } from './types';
import { generateToastId } from '../utils';

export const createUiSlice: GameSlice<UiSlice> = (set, get) => ({
    isLoading: false,
    error: null,
    toasts: [],

    setLoading: (loading) => set({ isLoading: loading }),

    setError: (error) => set({ error }),

    addToast: (toast) => {
        const id = generateToastId();
        const newToast = { ...toast, id };
        set((state) => ({ toasts: [...state.toasts, newToast as any] }));

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
});
