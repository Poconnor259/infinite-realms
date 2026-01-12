/**
 * One-time script to add difficulty field to all world modules
 * Run with: npx ts-node addDifficultyToWorlds.ts
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

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
    order: 0 // Place at the top of character creation
};

async function addDifficultyToWorlds() {
    try {
        const worldIds = ['classic', 'outworlder', 'tactical'];

        for (const worldId of worldIds) {
            console.log(`\nUpdating ${worldId}...`);

            const worldRef = db.collection('worlds').doc(worldId);
            const worldDoc = await worldRef.get();

            if (!worldDoc.exists) {
                console.log(`  ⚠️  World '${worldId}' not found, skipping`);
                continue;
            }

            const worldData = worldDoc.data();
            const creationFields = worldData?.creationFields || [];

            // Check if difficulty field already exists
            const hasDifficulty = creationFields.some((field: any) => field.id === 'difficulty');

            if (hasDifficulty) {
                console.log(`  ℹ️  Difficulty field already exists, skipping`);
                continue;
            }

            // Add difficulty field at the beginning
            const updatedFields = [difficultyField, ...creationFields];

            await worldRef.update({
                creationFields: updatedFields
            });

            console.log(`  ✅ Added difficulty field to ${worldId}`);
        }

        console.log('\n✅ All worlds updated successfully!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error updating worlds:', error);
        process.exit(1);
    }
}

addDifficultyToWorlds();
