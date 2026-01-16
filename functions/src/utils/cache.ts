/**
 * Simple in-memory cache with TTL for knowledge documents
 */

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

class SimpleCache<T> {
    private cache: Map<string, CacheEntry<T>> = new Map();
    private defaultTTL: number;

    constructor(defaultTTLMs: number = 300000) { // 5 minutes default
        this.defaultTTL = defaultTTLMs;
    }

    set(key: string, value: T, ttl?: number): void {
        const expiresAt = Date.now() + (ttl ?? this.defaultTTL);
        this.cache.set(key, { data: value, expiresAt });
    }

    get(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return entry.data;
    }

    has(key: string): boolean {
        return this.get(key) !== null;
    }

    clear(): void {
        this.cache.clear();
    }

    // Clean up expired entries
    cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
            }
        }
    }
}

// Export singleton instance for knowledge documents
export const knowledgeCache = new SimpleCache<string[]>(600000); // 10 minute TTL

// Run cleanup every 5 minutes
setInterval(() => knowledgeCache.cleanup(), 300000);
