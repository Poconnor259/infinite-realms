const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();

async function fixPraxisWorldType() {
    try {
        console.log('Updating PRAXIS world type to "tactical"...');

        const worldRef = db.collection('worlds').doc('praxis');
        await worldRef.update({
            type: 'tactical' // Lowercase to match game engine ID
        });

        console.log('✅ Successfully updated PRAXIS world type to "tactical"');

        // Verify the update
        const doc = await worldRef.get();
        if (doc.exists) {
            console.log('Current PRAXIS world data:', doc.data());
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating PRAXIS world:', error);
        process.exit(1);
    }
}

fixPraxisWorldType();
