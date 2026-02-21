import type { Toast } from './slices/types';

export function createStorage() {
    return {
        set(key: string, value: string) {
            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem(key, value);
                }
            } catch (error) {
                console.warn('Error setting storage', error);
            }
        },
        getString(key: string): string | undefined {
            try {
                if (typeof localStorage !== 'undefined') {
                    return localStorage.getItem(key) || undefined;
                }
            } catch (error) {
                console.warn('Error getting storage', error);
            }
            return undefined;
        },
        delete(key: string) {
            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.removeItem(key);
                }
            } catch (error) {
                console.warn('Error deleting storage', error);
            }
        }
    };
}

export const storage = createStorage();

const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    retryableCodes: ['internal', 'unavailable', 'deadline-exceeded', 'resource-exhausted'],
    retryableStatuses: [500, 502, 503, 504, 429],
};

export async function withRetry<T>(
    fn: () => Promise<T>,
    onRetry?: (attempt: number, delay: number, maxRetries: number) => void
): Promise<T> {
    let attempt = 0;

    const shouldRetry = (error: any) => {
        if (attempt >= RETRY_CONFIG.maxRetries) return false;

        const isNetworkError = error.message === 'Network request failed' ||
            error.message?.includes('network') ||
            error.message?.includes('fetch');

        if (isNetworkError) return true;

        const code = error.code || error.status;
        return RETRY_CONFIG.retryableCodes.includes(code) ||
            RETRY_CONFIG.retryableStatuses.includes(code);
    };

    while (true) {
        try {
            return await fn();
        } catch (error) {
            attempt++;

            if (!shouldRetry(error)) {
                throw error;
            }

            const delay = Math.min(
                RETRY_CONFIG.baseDelay * Math.pow(2, attempt - 1),
                RETRY_CONFIG.maxDelay
            );

            console.log(`[Retry] Attempt ${attempt} failed. Retrying in ${delay}ms...`, error);

            if (onRetry) {
                onRetry(attempt, delay, RETRY_CONFIG.maxRetries);
            }

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

export function generateToastId(): string {
    return `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function getErrorMessage(error: any): { message: string; isRetryable: boolean } {
    let message = 'An unexpected error occurred';
    let isRetryable = false;

    if (error instanceof Error) {
        if (error.message.includes('Network request failed') || error.message.includes('network')) {
            message = 'Connection lost. Please check your internet connection.';
            isRetryable = true;
        } else if (error.message.includes('No active campaign')) {
            message = 'Action failed: No active campaign found.';
        } else if (error.message.includes('quota') || error.message.includes('resource-exhausted')) {
            message = 'API quota exceeded. Please try again later.';
        } else {
            message = error.message;
        }
    }

    if (error?.code) {
        if (error.code === 'permission-denied') {
            message = 'You do not have permission to perform this action.';
        } else if (error.code === 'unauthenticated') {
            message = 'Your session has expired. Please sign in again.';
        } else if (RETRY_CONFIG.retryableCodes.includes(error.code)) {
            isRetryable = true;
        }
    }

    return { message, isRetryable };
}
