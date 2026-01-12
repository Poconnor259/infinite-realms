import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

/**
 * One-time HTTP endpoint to add difficulty field to all worlds
 * Call: https://us-central1-infinite-realms-5dcba.cloudfunctions.net/addDifficultyToWorlds
 */
export const addDifficultyToWorlds = onRequest(
    { cors: true, invoker: 'public' },
    async (req, res) => {
        try {
            const db = admin.firestore();

            const difficultyField = {
                id: 'difficulty',
                type: 'select',
                label: 'Game Difficulty',
                required: true,
                defaultValue: 'adventurer',
                options: [
                    { value: 'story', label: '🎭 Story Mode - Narrative Focus' },
                    { value: 'novice', label: '📚 Novice - Learning Curve' },
                    { value: 'adventurer', label: '⚔️ Adventurer - Balanced (Recommended)' },
                    { value: 'hero', label: '🏆 Hero - Tough but Fair' },
                    { value: 'legendary', label: '💀 Legendary - Unforgiving' }
                ],
                helpText: 'Affects how challenging the game master is. Story Mode focuses on narrative enjoyment, while Legendary is brutally punishing.',
                order: 0
            };

            const worldIds = ['classic', 'outworlder', 'tactical'];
            const results: any[] = [];

            for (const worldId of worldIds) {
                const worldRef = db.collection('worlds').doc(worldId);
                const worldDoc = await worldRef.get();

                if (!worldDoc.exists) {
                    results.push({ world: worldId, status: 'not_found' });
                    continue;
                }

                const worldData = worldDoc.data();
                const creationFields = worldData?.creationFields || [];

                // Check if difficulty already exists
                const hasDifficulty = creationFields.some((field: any) => field.id === 'difficulty');

                if (hasDifficulty) {
                    results.push({ world: worldId, status: 'already_exists' });
                    continue;
                }

                // Add difficulty field at the beginning
                const updatedFields = [difficultyField, ...creationFields];

                await worldRef.update({
                    creationFields: updatedFields
                });

                results.push({ world: worldId, status: 'added' });
            }

            res.json({
                success: true,
                message: 'Difficulty field processing complete',
                results
            });

        } catch (error: any) {
            console.error('Error adding difficulty:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);
