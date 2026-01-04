/**
 * Seed Firestore with default ambiance settings
 * Run with: node scripts/seed-ambiance.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const defaultAmbianceSettings = {
    global: {
        autoDetection: true,
        defaultVolume: 0.3,
        fadeInMs: 1000,
        fadeOutMs: 1000,
    },
    types: {
        tavern: {
            url: 'https://cdn.pixabay.com/audio/2024/02/08/audio_ac56737be4.mp3',
            filename: 'tavern-ambience.mp3',
            enabled: true,
            keywords: ['tavern', 'inn', 'bar', 'pub', 'drink', 'ale', 'mead'],
            volume: 0.5,
            priority: 5,
        },
        forest: {
            url: 'https://cdn.pixabay.com/audio/2022/03/09/audio_c7acb35bca.mp3',
            filename: 'forest-ambience.mp3',
            enabled: true,
            keywords: ['forest', 'woods', 'trees', 'grove', 'wilderness'],
            volume: 0.5,
            priority: 5,
        },
        dungeon: {
            url: 'https://cdn.pixabay.com/audio/2022/11/17/audio_fe4aaeecb0.mp3',
            filename: 'dungeon-ambience.mp3',
            enabled: true,
            keywords: ['dungeon', 'prison', 'dark corridor', 'underground', 'crypt'],
            volume: 0.5,
            priority: 5,
        },
        city: {
            url: 'https://cdn.pixabay.com/audio/2021/09/02/audio_95e4dc3d6f.mp3',
            filename: 'city-ambience.mp3',
            enabled: true,
            keywords: ['city', 'town', 'market', 'street', 'crowd', 'shop'],
            volume: 0.5,
            priority: 5,
        },
        combat: {
            url: 'https://cdn.pixabay.com/audio/2023/10/24/audio_7fd0df0e06.mp3',
            filename: 'combat-ambience.mp3',
            enabled: true,
            keywords: ['attack', 'combat', 'battle', 'fight', 'enemy', 'sword drawn'],
            volume: 0.5,
            priority: 8, // Higher priority for combat
        },
        castle: {
            url: 'https://cdn.pixabay.com/audio/2022/05/27/audio_f5462cdede.mp3',
            filename: 'castle-ambience.mp3',
            enabled: true,
            keywords: ['castle', 'palace', 'throne', 'king', 'queen', 'royal'],
            volume: 0.5,
            priority: 5,
        },
        cave: {
            url: 'https://cdn.pixabay.com/audio/2022/06/01/audio_c067fb28ea.mp3',
            filename: 'cave-ambience.mp3',
            enabled: true,
            keywords: ['cave', 'cavern', 'underground', 'mining'],
            volume: 0.5,
            priority: 5,
        },
        ocean: {
            url: 'https://cdn.pixabay.com/audio/2022/02/22/audio_ea1a0c0a91.mp3',
            filename: 'ocean-ambience.mp3',
            enabled: true,
            keywords: ['ocean', 'sea', 'beach', 'waves', 'ship', 'sail'],
            volume: 0.5,
            priority: 5,
        },
        night: {
            url: 'https://cdn.pixabay.com/audio/2022/05/31/audio_32e41c0bc6.mp3',
            filename: 'night-ambience.mp3',
            enabled: true,
            keywords: ['night', 'moon', 'stars', 'evening', 'dark sky'],
            volume: 0.5,
            priority: 5,
        },
        rain: {
            url: 'https://cdn.pixabay.com/audio/2022/03/24/audio_bae35a2adf.mp3',
            filename: 'rain-ambience.mp3',
            enabled: true,
            keywords: ['rain', 'storm', 'thunder', 'lightning', 'wet'],
            volume: 0.5,
            priority: 5,
        },
    }
};

async function seedAmbiance() {
    try {
        console.log('Seeding ambiance settings...');

        await db.collection('settings').doc('ambiance').set(defaultAmbianceSettings);

        console.log('✅ Ambiance settings seeded successfully!');
        console.log('Document: settings/ambiance');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding ambiance settings:', error);
        process.exit(1);
    }
}

seedAmbiance();
