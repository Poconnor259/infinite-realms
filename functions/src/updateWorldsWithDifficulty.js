/**
 * Script to add difficulty field to all world modules
 * Run from functions directory: node lib/updateWorldsWithDifficulty.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin (uses default credentials from Firebase environment)
if (!admin.apps.length) {
    admin.initializeApp();
}

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

async function updateWorlds() {
    try {
        console.log('Starting world updates...\n');

        const worldIds = ['classic', 'outworlder', 'tactical'];

        for (const worldId of worldIds) {
            console.log(`Processing ${worldId}...`);

            const worldRef = db.collection('gameEngines').doc(worldId);
            const worldDoc = await worldRef.get();

            if (!worldDoc.exists) {
                console.log(`  ⚠️  World '${worldId}' not found in gameEngines, trying worlds collection...`);

                // Try worlds collection instead
                const worldsRef = db.collection('worlds').doc(worldId);
                const worldsDoc = await worldsRef.get();

                if (!worldsDoc.exists) {
                    console.log(`  ❌ World '${worldId}' not found in either collection, skipping\n`);
                    continue;
                }

                const worldData = worldsDoc.data();
                const creationFields = worldData.creationFields || [];

                // Check if difficulty already exists
                const hasDifficulty = creationFields.some(field => field.id === 'difficulty');

                if (hasDifficulty) {
                    console.log(`  ℹ️  Difficulty field already exists\n`);
                    continue;
                }

                // Add difficulty field at the beginning
                const updatedFields = [difficultyField, ...creationFields];

                await worldsRef.update({
                    creationFields: updatedFields
                });

                console.log(`  ✅ Added difficulty field to ${worldId} in worlds collection\n`);
                continue;
            }

            const worldData = worldDoc.data();
            const creationFields = worldData.creationFields || [];

            // Check if difficulty already exists
            const hasDifficulty = creationFields.some(field => field.id === 'difficulty');

            if (hasDifficulty) {
                console.log(`  ℹ️  Difficulty field already exists\n`);
                continue;
            }

            // Add difficulty field at the beginning
            const updatedFields = [difficultyField, ...creationFields];

            await worldRef.update({
                creationFields: updatedFields
            });

            console.log(`  ✅ Added difficulty field to ${worldId}\n`);
        }

        console.log('✅ All worlds updated successfully!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error updating worlds:', error);
        process.exit(1);
    }
}

updateWorlds();
