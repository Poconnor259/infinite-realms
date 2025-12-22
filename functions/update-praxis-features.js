/**
 * Script to update PRAXIS world features in Firebase
 * Run from functions directory: node update-praxis-features.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin (uses default credentials from functions)
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

async function updatePraxisFeatures() {
    try {
        console.log('🚀 Updating PRAXIS world features...');

        const praxisRef = db.collection('worlds').doc('praxis');

        // Check if document exists
        const doc = await praxisRef.get();
        if (!doc.exists) {
            console.error('❌ PRAXIS world document not found!');
            process.exit(1);
        }

        console.log('📝 Current features:', doc.data().features);

        // Update features array to match schema
        await praxisRef.update({
            features: [
                "Military rank progression (Private → General)",
                "Adaptive nanite suit that morphs into any equipment",
                "Crashed ship serves as your base of operations",
                "Mission-based objectives with tactical choices",
                "Nanite command abilities"
            ]
        });

        console.log('✅ Successfully updated PRAXIS features!');
        console.log('\n📋 New features:');
        console.log('  1. Military rank progression (Private → General)');
        console.log('  2. Adaptive nanite suit that morphs into any equipment');
        console.log('  3. Crashed ship serves as your base of operations');
        console.log('  4. Mission-based objectives with tactical choices');
        console.log('  5. Nanite command abilities');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating PRAXIS features:', error);
        process.exit(1);
    }
}

updatePraxisFeatures();
