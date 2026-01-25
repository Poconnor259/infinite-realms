import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

/**
 * Comprehensive data seeding for Atlas Cortex
 * Seeds all required Firestore collections and documents
 * 
 * Call with: https://us-central1-atlas-cortex.cloudfunctions.net/seedAllData
 */
export const seedAllData = onRequest(async (req, res) => {
    try {
        const db = admin.firestore();
        const batch = db.batch();

        console.log('[SeedAllData] Starting comprehensive data seed...');

        // ==================== CONFIG DOCUMENTS ====================

        // 1. config/global
        const globalConfig = {
            subscriptionLimits: {
                scout: 50,
                adventurer: 1500,
                hero: 4500,
                legendary: 999999999
            },
            subscriptionPermissions: {
                scout: {
                    allowedModels: ['gemini-1.5-flash-002', 'gpt-4o-mini'],
                    allowedTiers: ['economical']
                },
                adventurer: {
                    allowedModels: ['gemini-1.5-flash-002', 'gpt-4o-mini', 'claude-3-5-haiku-latest', 'gemini-1.5-pro-002'],
                    allowedTiers: ['economical', 'balanced']
                },
                hero: {
                    allowedModels: ['gemini-1.5-flash-002', 'gpt-4o-mini', 'claude-3-5-haiku-latest', 'gemini-1.5-pro-002', 'claude-3-5-sonnet-latest', 'gpt-4o'],
                    allowedTiers: ['economical', 'balanced', 'premium']
                },
                legendary: {
                    allowedModels: ['*'],
                    allowedTiers: ['economical', 'balanced', 'premium']
                }
            },
            subscriptionPricing: {
                scout: { price: 0, displayPrice: 'Free' },
                adventurer: { price: 9.99, displayPrice: '$9.99/mo' },
                hero: { price: 24.99, displayPrice: '$24.99/mo' },
                legendary: { price: 49.99, displayPrice: '$49.99/mo' }
            },
            topUpPackages: [
                { id: 'small', turns: 100, price: 4.99, displayPrice: '$4.99' },
                { id: 'medium', turns: 500, price: 19.99, displayPrice: '$19.99' },
                { id: 'large', turns: 1500, price: 49.99, displayPrice: '$49.99' }
            ],
            worldModules: {
                classic: { enabled: true },
                outworlder: { enabled: true },
                tactical: { enabled: true }
            },
            systemSettings: {
                maintenanceMode: false,
                newRegistrationsOpen: true,
                debugLogging: false,
                showAdminDebug: true,
                narratorWordLimitMin: 150,
                narratorWordLimitMax: 250,
                enableContextCaching: true,
                enableHeartbeatSystem: true,
                heartbeatIdleTimeout: 15,
                enforceNarratorWordLimits: true,
                defaultTurnCost: 1,
                maxOutputTokens: 2048,
                enforceMaxOutputTokens: true
            },
            modelCosts: {
                'gpt-4o': 10,
                'gpt-4o-mini': 1,
                'claude-3-5-sonnet-latest': 10,
                'claude-3-5-haiku-latest': 3,
                'claude-opus-4-0-20250514': 50,
                'gemini-1.5-flash-002': 1,
                'gemini-1.5-pro-002': 5,
                'gemini-2.0-flash-exp': 1
            },
            tierMapping: {
                economical: 'gemini-1.5-flash-002',
                balanced: 'claude-3-5-sonnet-latest',
                premium: 'claude-opus-4-0-20250514'
            },
            favoriteModels: [
                'gpt-4o-mini',
                'claude-3-5-sonnet-latest',
                'gemini-1.5-flash-002'
            ],
            questMaster: {
                enabled: true,
                autoTrigger: false,
                modelId: 'gpt-4o-mini',
                maxQuestsPerTrigger: 2,
                cooldownTurns: 5,
                triggerConditions: {
                    onLevelUp: true,
                    onLocationChange: true,
                    onQuestComplete: true,
                    onQuestQueueEmpty: true
                },
                autoAcceptQuests: false,
                enableQuestChains: true,
                enableTimedQuests: false
            }
        };
        batch.set(db.collection('config').doc('global'), globalConfig);
        console.log('[SeedAllData] ✓ config/global');

        // 2. config/aiSettings
        const aiSettings = {
            brainModel: 'gpt-4o-mini',
            voiceModel: 'claude-3-5-sonnet-latest'
        };
        batch.set(db.collection('config').doc('aiSettings'), aiSettings);
        console.log('[SeedAllData] ✓ config/aiSettings');

        // 3. config/modelPricing
        const modelPricing = {
            'gpt-4o': { prompt: 2.50, completion: 10.00 },
            'gpt-4o-mini': { prompt: 0.15, completion: 0.60 },
            'claude-3-5-sonnet-latest': { prompt: 3.00, completion: 15.00 },
            'claude-3-5-haiku-latest': { prompt: 0.80, completion: 4.00 },
            'claude-opus-4-0-20250514': { prompt: 15.00, completion: 75.00 },
            'gemini-1.5-flash-002': { prompt: 0.075, completion: 0.30 },
            'gemini-1.5-pro-002': { prompt: 1.25, completion: 5.00 },
            'gemini-2.0-flash-exp': { prompt: 0.00, completion: 0.00 }
        };
        batch.set(db.collection('config').doc('modelPricing'), modelPricing);
        console.log('[SeedAllData] ✓ config/modelPricing');

        // ==================== SETTINGS DOCUMENTS ====================

        // 4. settings/ambiance
        const ambianceSettings = {
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
                    priority: 8,
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
        batch.set(db.collection('settings').doc('ambiance'), ambianceSettings);
        console.log('[SeedAllData] ✓ settings/ambiance');

        // Commit first batch (config + settings)
        await batch.commit();
        console.log('[SeedAllData] Committed config + settings batch');

        // ==================== AI PROMPTS ====================

        const promptsBatch = db.batch();

        const DEFAULT_BRAIN_PROMPT = `You are the LOGIC ENGINE for a tabletop RPG.

CORE RESPONSIBILITIES:
- Process game mechanics, dice rolls, and state changes
- Track HP, Mana, inventory, abilities, and party members
- Return structured JSON with state updates and narrative cues
- Pause for player clarification when input is ambiguous

WHEN TO PAUSE FOR INPUT:
Set requiresUserInput: true and provide pendingChoice when:
- Player input is ambiguous (e.g., "I attack" without specifying a target)
- Multiple valid options exist (e.g., two doors, multiple NPCs to talk to)
- Player attempts something requiring a choice (e.g., "I cast a spell" without naming it)
- Significant decisions (e.g., accept/reject quest, ally with faction)
- Major story decisions (e.g., spare or kill an enemy, choose a path)
- Moral dilemmas or character-defining moments
- Any situation where the player's choice significantly impacts the story
- Resource allocation decisions (e.g., which item to buy with limited gold)
- Tactical decisions in combat (e.g., "I use a special ability" without specifying)

When pausing:
- Set requiresUserInput: true
- Set pendingChoice.prompt: Clear question for the player
- Set pendingChoice.options: 2-4 suggested choices (ONLY if user preference allows)
- Set pendingChoice.choiceType: Category (action/target/dialogue/direction/item/decision)

WHEN TO PROCEED AUTOMATICALLY:
- Clear, specific actions ("I attack the goblin with my sword")
- Movement to named locations ("I go to the tavern")
- Using specific items ("I drink the health potion")
- Simple skill checks ("I search the room")

RULES:
- Calculate all dice rolls with proper randomization
- Update only the state fields that changed
- Provide narrative cues for the storyteller, not full prose
- Include system messages for level ups, achievements, warnings

RESPONSE FORMAT:
Respond with valid JSON only. No markdown, no explanation.`;

        const DEFAULT_VOICE_PROMPT = `You are the NARRATOR for a tabletop RPG adventure.

STYLE GUIDELINES:
- Write in second person ("You swing your sword...")
- Use vivid, descriptive prose
- Keep responses between 150-250 words
- One strong scene beat per response
- Give NPCs distinct voices and personalities

STORYTELLING RULES:
1. You are the STORYTELLER. Write immersive, engaging prose.
2. Transform the logic engine's cues into compelling narrative.
3. Include dialogue where appropriate.
4. Balance drama with moments of levity.

PRESENTING CHOICES:
If Brain provides a pendingChoice, end your narrative with the choice prompt.

If options are provided (user preference enabled):
"What would you like to do?
• Attack the goblin archer
• Take cover behind the barrels  
• Call out to negotiate"

If NO options provided (user preference disabled):
"What would you like to do?"
(Player types their own response for more immersive, freeform play)`;

        const DEFAULT_STATE_REVIEWER_PROMPT = `You are a STATE CONSISTENCY REVIEWER for an RPG game.

Your job is to review the narrative output and extract any state changes that should be tracked.

LOOK FOR CHANGES TO:
- Inventory (items picked up, used, or lost)
- HP/Health changes (damage taken, healing received)
- Mana/Energy/Nanites changes (spells cast, abilities used)
- Powers/Abilities (new abilities gained or lost)
- Party members (NPCs joining or leaving)
- Quest progress (objectives completed)
- Currency (gold, credits, etc.)

CURRENT GAME STATE:
{currentState}

NARRATIVE TO REVIEW:
{narrative}

RESPONSE FORMAT:
Return JSON with detected changes:
{
  "stateChanges": {
    "inventory": { "add": ["item"], "remove": ["item"] },
    "hp": { "current": 45, "max": 50 },
    "mana": { "current": 20, "max": 30 }
  },
  "confidence": "high" | "medium" | "low"
}`;

        // 5. aiPrompts/global
        promptsBatch.set(db.collection('aiPrompts').doc('global'), {
            brainPrompt: DEFAULT_BRAIN_PROMPT,
            voicePrompt: DEFAULT_VOICE_PROMPT,
            stateReviewerPrompt: DEFAULT_STATE_REVIEWER_PROMPT,
            stateReviewerEnabled: true,
            stateReviewerModel: 'gpt-4o-mini',
            stateReviewerFrequency: 1,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('[SeedAllData] ✓ aiPrompts/global');

        // 6. aiPrompts/classic (D&D 5e)
        promptsBatch.set(db.collection('aiPrompts').doc('classic'), {
            brainPrompt: `${DEFAULT_BRAIN_PROMPT}

CLASSIC D&D 5E RULES:
- Use d20 for ability checks, add relevant stat modifiers
- Combat uses initiative order
- Spell slots are tracked and consumed
- Death saves at 0 HP (3 successes = stable, 3 failures = death)
- Short rest recovers some HP, long rest recovers all HP and spell slots`,
            voicePrompt: `${DEFAULT_VOICE_PROMPT}

CLASSIC D&D STYLE:
- Epic fantasy tone with heroic moments
- Rich descriptions of magic and combat
- NPCs speak in medieval/fantasy dialect when appropriate
- Emphasize the weight of heroic choices`,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('[SeedAllData] ✓ aiPrompts/classic');

        // 7. aiPrompts/outworlder (HWFWM)
        promptsBatch.set(db.collection('aiPrompts').doc('outworlder'), {
            brainPrompt: `${DEFAULT_BRAIN_PROMPT}

OUTWORLDER (HWFWM) RULES:
- Essence-based power system (abilities from absorbed essences)
- Rank progression: Iron → Bronze → Silver → Gold → Diamond
- Stats: Power, Speed, Spirit, Recovery (1-100 scale)
- Resources: HP, Mana, Stamina
- Combat emphasizes essence ability combinations and synergies
- "Blue Box" system notifications for rank ups and ability unlocks`,
            voicePrompt: `${DEFAULT_VOICE_PROMPT}

OUTWORLDER STYLE:
- Modern protagonist in fantasy world
- System notifications in [BLUE BOX] format
- Snarky internal monologue
- Emphasis on creative essence ability use
- Balance humor with serious moments`,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('[SeedAllData] ✓ aiPrompts/outworlder');

        // 8. aiPrompts/tactical (PRAXIS)
        promptsBatch.set(db.collection('aiPrompts').doc('tactical'), {
            brainPrompt: `${DEFAULT_BRAIN_PROMPT}

PRAXIS TACTICAL RULES:
- Stats: STR, AGI, VIT, INT, SEN (can reach 999)
- Level-based progression (max level 100)
- Mission-based gameplay with ranking system
- Tactical combat with skills and supernatural threats
- Equipment and gear upgrades
- Squad and unit management`,
            voicePrompt: `${DEFAULT_VOICE_PROMPT}

PRAXIS STYLE:
- Military/tactical tone with supernatural elements
- System notifications in [SYSTEM] format
- Professional operative perspective
- Emphasis on tactical decision-making
- Balance action with strategic planning`,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('[SeedAllData] ✓ aiPrompts/tactical');

        await promptsBatch.commit();
        console.log('[SeedAllData] Committed AI prompts batch');

        // ==================== WORLD MODULES ====================

        const worldsBatch = db.batch();

        // 9. worlds/classic
        worldsBatch.set(db.collection('worlds').doc('classic'), {
            id: 'classic',
            type: 'classic',
            name: 'The Classic',
            subtitle: 'Dungeons & Dragons 5e',
            icon: '⚔️',
            color: '#ffd700',
            description: 'Experience the timeless fantasy of D&D with full 5e rules integration. Roll for initiative, manage spell slots, and explore dungeons with your party.',
            features: [
                'Full D&D 5e stat system (STR, DEX, CON, INT, WIS, CHA)',
                'Spell slot management',
                'Equipment and inventory tracking',
                'Classic fantasy setting',
            ],
            order: 0,
            customRules: '',
            initialNarrative: '*The tavern is warm and loud. You sit in the corner, polishing your gear. A shadow falls across your table.*',
            generateIntro: false,
        });
        console.log('[SeedAllData] ✓ worlds/classic');

        // 10. worlds/outworlder
        worldsBatch.set(db.collection('worlds').doc('outworlder'), {
            id: 'outworlder',
            type: 'outworlder',
            name: 'The Outworlder',
            subtitle: 'He Who Fights With Monsters',
            icon: '🌌',
            color: '#10b981',
            description: 'Enter a world where essence abilities define your power. Climb the ranks from Iron to Diamond as you absorb monster essences and unlock your confluence.',
            features: [
                'Essence-based power system',
                'Rank progression (Iron → Diamond)',
                'Unique ability combinations',
                'Blue Box system notifications',
            ],
            order: 1,
            customRules: '',
            initialNarrative: '*Darkness... then light. Blinding, violet light. You gasp for air as you wake up in a strange forest.*',
            generateIntro: false,
        });
        console.log('[SeedAllData] ✓ worlds/outworlder');

        // 11. worlds/praxis
        worldsBatch.set(db.collection('worlds').doc('praxis'), {
            id: 'praxis',
            type: 'tactical',
            name: 'PRAXIS: Operation Dark Tide',
            subtitle: 'Elite Tactical Operations',
            icon: '👤',
            color: '#8b5cf6',
            description: 'Join PRAXIS, an elite tactical unit operating in a world of supernatural threats. Complete missions, upgrade your gear, and lead covert operations against dark forces.',
            features: [
                'Daily mission system with ranking',
                'Tactical squad and unit management',
                'Strategic stat point allocation',
                'Gate and mission ranking system',
            ],
            order: 2,
            customRules: '',
            initialNarrative: '*[SYSTEM NOTIFICATION]*\n\n*Validation complete. Player registered. Welcome, Operative.*',
            generateIntro: false,
        });
        console.log('[SeedAllData] ✓ worlds/praxis');

        await worldsBatch.commit();
        console.log('[SeedAllData] Committed worlds batch');

        // ==================== GAME ENGINES ====================

        const enginesBatch = db.batch();

        // 12. gameEngines/classic
        enginesBatch.set(db.collection('gameEngines').doc('classic'), {
            id: 'classic',
            name: 'Classic D&D',
            description: 'D&D 5e style gameplay with six core attributes',
            order: 1,
            stats: [
                { id: 'strength', name: 'Strength', abbreviation: 'STR', min: 1, max: 20, default: 10 },
                { id: 'dexterity', name: 'Dexterity', abbreviation: 'DEX', min: 1, max: 20, default: 10 },
                { id: 'constitution', name: 'Constitution', abbreviation: 'CON', min: 1, max: 20, default: 10 },
                { id: 'intelligence', name: 'Intelligence', abbreviation: 'INT', min: 1, max: 20, default: 10 },
                { id: 'wisdom', name: 'Wisdom', abbreviation: 'WIS', min: 1, max: 20, default: 10 },
                { id: 'charisma', name: 'Charisma', abbreviation: 'CHA', min: 1, max: 20, default: 10 },
            ],
            resources: [
                { id: 'hp', name: 'Health', color: '#10b981', showInHUD: true },
            ],
            progression: { type: 'level', maxLevel: 20 },
            creationFields: [
                {
                    id: 'class', type: 'select', label: 'Class', required: true, options: [
                        { value: 'fighter', label: 'Fighter' },
                        { value: 'wizard', label: 'Wizard' },
                        { value: 'rogue', label: 'Rogue' },
                        { value: 'cleric', label: 'Cleric' },
                    ]
                },
                {
                    id: 'race', type: 'select', label: 'Race', required: true, options: [
                        { value: 'human', label: 'Human' },
                        { value: 'elf', label: 'Elf' },
                        { value: 'dwarf', label: 'Dwarf' },
                        { value: 'halfling', label: 'Halfling' },
                    ]
                },
                { id: 'background', type: 'text', label: 'Background', required: false },
            ],
            aiContext: 'D&D 5e fantasy RPG. Characters have six core attributes (STR, DEX, CON, INT, WIS, CHA) ranging from 1-20. Use d20 rolls for ability checks, adding relevant attribute modifiers. Combat uses turn-based initiative.',
        });
        console.log('[SeedAllData] ✓ gameEngines/classic');

        // 13. gameEngines/outworlder
        enginesBatch.set(db.collection('gameEngines').doc('outworlder'), {
            id: 'outworlder',
            name: 'Outworlder',
            description: 'HWFWM Essence System with rank-based progression',
            order: 2,
            stats: [
                { id: 'power', name: 'Power', abbreviation: 'PWR', min: 1, max: 100, default: 10 },
                { id: 'speed', name: 'Speed', abbreviation: 'SPD', min: 1, max: 100, default: 10 },
                { id: 'spirit', name: 'Spirit', abbreviation: 'SPI', min: 1, max: 100, default: 10 },
                { id: 'recovery', name: 'Recovery', abbreviation: 'REC', min: 1, max: 100, default: 10 },
            ],
            resources: [
                { id: 'hp', name: 'Health', color: '#10b981', showInHUD: true },
                { id: 'mana', name: 'Mana', color: '#3b82f6', showInHUD: true },
                { id: 'stamina', name: 'Stamina', color: '#f59e0b', showInHUD: true },
            ],
            progression: {
                type: 'rank',
                ranks: [
                    { id: 'iron', name: 'Iron', order: 1 },
                    { id: 'bronze', name: 'Bronze', order: 2 },
                    { id: 'silver', name: 'Silver', order: 3 },
                    { id: 'gold', name: 'Gold', order: 4 },
                    { id: 'diamond', name: 'Diamond', order: 5 },
                ]
            },
            creationFields: [
                { id: 'background', type: 'text', label: 'Origin Story', required: false },
            ],
            aiContext: 'HWFWM-style essence magic system. Characters progress through ranks (Iron → Bronze → Silver → Gold → Diamond). Powers come from absorbed essences. Stats are Power, Speed, Spirit, and Recovery (1-100 scale). Combat emphasizes essence ability combinations. Essences are selected via a specialized interface.',
        });
        console.log('[SeedAllData] ✓ gameEngines/outworlder');

        // 14. gameEngines/tactical
        enginesBatch.set(db.collection('gameEngines').doc('tactical'), {
            id: 'tactical',
            name: 'Praxis',
            description: 'Elite tactical operations system with mission-based progression',
            order: 3,
            stats: [
                { id: 'strength', name: 'Strength', abbreviation: 'STR', min: 1, max: 999, default: 10 },
                { id: 'agility', name: 'Agility', abbreviation: 'AGI', min: 1, max: 999, default: 10 },
                { id: 'vitality', name: 'Vitality', abbreviation: 'VIT', min: 1, max: 999, default: 10 },
                { id: 'intelligence', name: 'Intelligence', abbreviation: 'INT', min: 1, max: 999, default: 10 },
                { id: 'sense', name: 'Sense', abbreviation: 'SEN', min: 1, max: 999, default: 10 },
            ],
            resources: [
                { id: 'hp', name: 'Health', color: '#ef4444', showInHUD: true },
                { id: 'mp', name: 'Mana', color: '#3b82f6', showInHUD: true },
            ],
            progression: { type: 'level', maxLevel: 100 },
            creationFields: [
                {
                    id: 'class', type: 'select', label: 'Operative Class', required: true, options: [
                        { value: 'fighter', label: 'Fighter' },
                        { value: 'mage', label: 'Mage' },
                        { value: 'assassin', label: 'Assassin' },
                        { value: 'tank', label: 'Tank' },
                        { value: 'healer', label: 'Healer' },
                    ]
                },
                { id: 'title', type: 'text', label: 'Operative Title', required: false },
            ],
            aiContext: 'PRAXIS tactical operations system. Operatives have game-like stats (STR, AGI, VIT, INT, SEN) that can reach 999. Level-based progression up to level 100. Combat is tactical with skills, missions, and supernatural threat encounters. Stats grow significantly with each level.',
        });
        console.log('[SeedAllData] ✓ gameEngines/tactical');

        await enginesBatch.commit();
        console.log('[SeedAllData] Committed game engines batch');

        // ==================== SUMMARY ====================

        const summary = {
            success: true,
            message: 'All data seeded successfully',
            seededDocuments: {
                config: ['global', 'aiSettings', 'modelPricing'],
                settings: ['ambiance'],
                aiPrompts: ['global', 'classic', 'outworlder', 'tactical'],
                worlds: ['classic', 'outworlder', 'praxis'],
                gameEngines: ['classic', 'outworlder', 'tactical']
            },
            totalDocuments: 14,
            timestamp: new Date().toISOString()
        };

        console.log('[SeedAllData] ✅ Complete! Seeded 14 documents across 5 collections');

        res.status(200).json(summary);

    } catch (error) {
        console.error('[SeedAllData] ❌ Error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        });
    }
});
