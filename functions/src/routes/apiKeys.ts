import * as admin from 'firebase-admin';

// ==================== API KEY HELPER ====================
// Get API keys from Firestore (single source of truth)
export async function getApiKeys(db: admin.firestore.Firestore): Promise<{ openai: string; anthropic: string; google: string }> {
    const providers = ['openai', 'anthropic', 'google'] as const;
    const keys: any = {};

    for (const provider of providers) {
        try {
            const keyDoc = await db.collection('apiKeys').doc(provider).get();
            if (keyDoc.exists && keyDoc.data()?.key) {
                keys[provider] = keyDoc.data()!.key;
            } else {
                keys[provider] = '';
            }
        } catch (error) {
            console.warn(`[API Keys] Error reading ${provider} from Firestore:`, error);
            keys[provider] = '';
        }
    }

    return keys;
}
