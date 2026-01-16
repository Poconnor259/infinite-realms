/**
 * Seed Knowledge Documents to Firestore
 * 
 * Run with: node scripts/seedKnowledgeDocs.js
 * 
 * This script seeds the knowledgeDocuments collection with reference materials
 * for the AI to use when generating responses.
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin with service account
// Run from functions directory: node seedKnowledgeDocs.js
let serviceAccount;
try {
    // When running directly from functions directory
    serviceAccount = require('./atlas-cortex-firebase-adminsdk.json');
} catch (e) {
    // Fallback: try from parent scripts directory
    const serviceAccountPath = path.join(__dirname, '..', 'functions', 'atlas-cortex-firebase-adminsdk.json');
    serviceAccount = require(serviceAccountPath);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ==================== KNOWLEDGE DOCUMENTS ====================

const knowledgeDocuments = [
    // ==================== GLOBAL (All Modules) ====================
    {
        name: 'Core RPG Mechanics',
        worldModule: 'global',
        category: 'rules',
        targetModel: 'brain',
        enabled: true,
        content: `# Core RPG Mechanics

## Dice Rolling
- d20: Primary resolution die for skill checks and attacks
- d4-d12: Variable damage dice based on weapons/spells
- Modifiers: Stats, proficiency, and situational bonuses

## Combat Flow
1. Initiative: Determines turn order
2. Action Phase: Move, Attack, Cast Spell, or Use Item
3. Resolution: Roll to hit, calculate damage, apply effects
4. Status Update: Track HP changes, conditions, cooldowns

## State Management
- Always track: HP, Resources (Mana/Stamina/Energy), Inventory
- Update incrementally: Only change what the action affects
- Validate bounds: HP cannot exceed max, resources have limits

## Skill Checks
- Base DC 10 (Easy), 15 (Medium), 20 (Hard), 25 (Very Hard)
- Roll = d20 + stat modifier + proficiency (if applicable)
- Natural 1 = Critical Failure, Natural 20 = Critical Success`
    },
    {
        name: 'Narrative Guidelines',
        worldModule: 'global',
        category: 'other',
        targetModel: 'voice',
        enabled: true,
        content: `# Narrative Voice Guidelines

## Perspective
- Always use second person ("You walk...", "You see...")
- Keep the player as the protagonist
- NPCs speak in first person with distinct voices

## Scene Structure
- Opening: Set the scene, describe the environment
- Action: React to player input, describe consequences
- Tension: Build dramatic moments, use pacing
- Resolution: Provide clear outcomes, set up next beat

## Dialogue Writing
- Give NPCs personality through speech patterns
- Use dialects sparingly but effectively
- Actions in *italics*, spoken words in quotes
- Inner thoughts can be italicized

## Combat Narration
- Make attacks feel impactful
- Describe wounds without being gratuitous
- Keep combat flowing, avoid repetition
- Celebrate critical hits and critical failures

## Word Count
- Standard: 150-250 words
- Combat: Shorter, punchier
- Exploration: Can be more descriptive
- Dialogue-heavy: Let characters speak`
    },
    {
        name: 'Player Interaction Patterns',
        worldModule: 'global',
        category: 'rules',
        targetModel: 'both',
        enabled: true,
        content: `# Player Interaction Patterns

## When to Present Choices
1. Ambiguous situations (multiple valid interpretations)
2. Moral dilemmas or character-defining moments
3. Combat tactical decisions
4. Resource allocation (what to buy, use, or discard)
5. Dialogue branches with significant NPCs

## Choice Formatting
When presenting options:
- Use bullet points (•)
- Limit to 2-4 choices
- Make choices meaningfully different
- Include creative/unexpected options when appropriate

## Interpreting Player Intent
- "I attack" → Ask for target if multiple enemies
- "I search" → Automatically search the current area
- "I talk to him" → Begin dialogue, maybe ask tone
- "I use magic" → Ask for specific spell if multiple known

## Handling Failures
- Make failures interesting, not just "you fail"
- Failures can reveal information or new paths
- Critical failures should be memorable but fair
- Never punish creative thinking too harshly`
    },

    // ==================== CLASSIC (D&D 5e) ====================
    {
        name: 'D&D 5e Core Rules',
        worldModule: 'classic',
        category: 'rules',
        targetModel: 'brain',
        enabled: true,
        content: `# D&D 5e Core Rules Reference

## Ability Scores (1-20 scale)
- STR: Melee attacks, carrying capacity, athletics
- DEX: Ranged attacks, AC, stealth, acrobatics
- CON: HP bonus, concentration saves
- INT: Arcana, investigation, wizard spells
- WIS: Perception, insight, cleric/druid spells
- CHA: Persuasion, deception, warlock/bard spells

## Modifier Calculation
Score 1: -5, 10-11: +0, 12-13: +1, 14-15: +2, 16-17: +3, 18-19: +4, 20: +5

## Combat Rules
- Attack Roll: d20 + ability mod + proficiency vs AC
- Damage: Weapon die + ability mod
- Critical Hit (Nat 20): Double damage dice
- Death Saves: 3 successes = stable, 3 failures = death

## Spell Slots
- Cantrips: Unlimited use
- Leveled Spells: Consume spell slots
- Short Rest: Recover some abilities (class-dependent)
- Long Rest: Recover all HP and spell slots

## Conditions
- Prone: Disadvantage on attacks, advantage against (melee)
- Stunned: Can't move or act, auto-fail STR/DEX saves
- Poisoned: Disadvantage on attacks and ability checks
- Frightened: Can't move toward source, disadvantage`
    },
    {
        name: 'Forgotten Realms Lore',
        worldModule: 'classic',
        category: 'lore',
        targetModel: 'voice',
        enabled: true,
        content: `# The Forgotten Realms

## Overview
The Forgotten Realms is a world of high fantasy where magic is common and gods walk among mortals. The Sword Coast is the primary adventuring region.

## Major Locations
- **Waterdeep**: The City of Splendors, a massive metropolis
- **Baldur's Gate**: A coastal city of intrigue and commerce
- **Neverwinter**: The Jewel of the North, rebuilt after cataclysm
- **Candlekeep**: The great fortress library
- **Icewind Dale**: Frozen northern wilderness

## Pantheon (Common Gods)
- Tymora: Goddess of luck and fortune
- Tempus: God of war and battle
- Mystra: Goddess of magic
- Kelemvor: God of the dead
- Torm: God of duty and loyalty
- Lolth: Dark goddess of the drow

## Common Races
- Humans: Adaptable and ambitious
- Elves: Long-lived, magical, aloof
- Dwarves: Sturdy, crafters, mountain-dwellers
- Halflings: Small, lucky, community-focused
- Tieflings: Infernal heritage, mistrusted
- Dragonborn: Draconic humanoids, honor-bound

## Tone and Feel
- Epic fantasy with shades of grey
- Magic is wondrous but dangerous
- Heroes rise from humble beginnings
- Evil lurks in ancient ruins and dark places`
    },
    {
        name: 'Classic Character Classes',
        worldModule: 'classic',
        category: 'characters',
        targetModel: 'both',
        enabled: true,
        content: `# D&D 5e Character Classes

## Martial Classes
**Fighter**: Weapon masters, heavy armor, Action Surge
**Barbarian**: Rage, unarmored defense, reckless attack
**Rogue**: Sneak attack, cunning action, expertise
**Monk**: Martial arts, ki points, unarmored movement

## Spellcasters
**Wizard**: Arcane magic, spellbook, ritual casting
**Sorcerer**: Innate magic, metamagic, flexible casting
**Warlock**: Pact magic, eldritch invocations, short rest spells
**Cleric**: Divine magic, channel divinity, heavy armor
**Druid**: Nature magic, wild shape, elemental powers

## Hybrid Classes
**Paladin**: Divine smite, lay on hands, aura of protection
**Ranger**: Favored enemy, natural explorer, hunter's mark
**Bard**: Bardic inspiration, Jack of all trades, magical secrets

## Class-Specific Notes for AI
- Fighters can take multiple attacks per turn at higher levels
- Rogues need advantage OR an ally adjacent for Sneak Attack
- Spellcasters track concentration on spells
- Clerics and Paladins can heal with magic
- Barbarians have damage resistance while raging`
    },

    // ==================== OUTWORLDER (HWFWM) ====================
    {
        name: 'Essence System Rules',
        worldModule: 'outworlder',
        category: 'rules',
        targetModel: 'brain',
        enabled: true,
        content: `# Outworlder Essence System

## Core Concepts
Essences are the source of all supernatural power. Characters absorb essence cores from monsters or receive them from awakening stones to gain abilities.

## Essence Types
- **Sin Essences**: Dark, Doom, Blood, etc.
- **Virtue Essences**: Adept, Swift, Healer, etc.
- **Confluence Essences**: Unlock when 4 essences combine correctly

## Stats (1-100 scale)
- **Power (PWR)**: Physical and magical damage output
- **Speed (SPD)**: Movement, attack speed, dodge
- **Spirit (SPI)**: Mana pool, magical potency
- **Recovery (REC)**: HP/Mana regeneration, healing received

## Rank Progression
Iron → Bronze → Silver → Gold → Diamond
- Each rank multiplies base capabilities
- Higher ranks have access to stronger abilities
- Rank-ups require essence strengthening and challenges

## Resources
- **HP**: Health points, regenerates based on Recovery
- **Mana**: Powers abilities, regenerates over time
- **Stamina**: Physical efforts, recovered through rest

## Ability Slots
- 4 ability slots per essence (16 total with full set)
- Abilities range from Common to Legendary rarity
- Awakening abilities at iron-rank, evolve with rank-ups`
    },
    {
        name: 'Outworlder World Lore',
        worldModule: 'outworlder',
        category: 'lore',
        targetModel: 'voice',
        enabled: true,
        content: `# The World of Pallimustus

## Overview
Pallimustus is a world where magic is systematized through essences and everyone has the potential to become an adventurer. Cities are built around Adventure Society branches that manage quests and monster threats.

## Key Factions
- **Adventure Society**: Regulates adventurers, assigns quests, maintains order
- **Magic Society**: Studies magic, sells awakening stones
- **Builder's Society**: Constructs essence-powered infrastructure
- **Hegemony**: Corrupt organization seeking world control

## Social Structure
- **Nobility**: Blue blood (literally blue), ancient family lines
- **Adventurers**: Ranked by iron to diamond, respected based on rank
- **Commoners**: Non-awakened or low-rank individuals
- **Monsters**: Creatures that drop essence cores when killed

## Unique Elements
- Blue Box notifications appear for system messages
- Cores drop from monsters (coin-like, essence-infused)
- Magic is visible, often as auras or lights
- Death is final unless healing magic is immediate

## Tone and Style
- Modern sensibilities in fantasy world
- Snarky inner monologue encouraged
- System notifications in [bracketed format]
- Balance humor with genuine stakes
- Pop culture references acceptable (character is from Earth)`
    },
    {
        name: 'Blue Box System Guide',
        worldModule: 'outworlder',
        category: 'rules',
        targetModel: 'both',
        enabled: true,
        content: `# Blue Box System Notifications

## When to Show Notifications
- Ability use and cooldowns
- Rank-ups and progression
- System warnings (danger levels)
- Quest completions
- Loot acquisition

## Notification Format
Wrap system messages in brackets:

[ABILITY ACTIVATED: SHADOW STRIKE]
[COOLDOWN: 30 SECONDS]

[WARNING: MONSTER THREAT DETECTED]
[ESTIMATED RANK: BRONZE]

[RANK UP AVAILABLE]
[REQUIREMENTS MET: SILVER-RANK]

## Notification Types
- **ABILITY**: Blue tint, skill activation
- **WARNING**: Red/orange tint, danger
- **PROGRESS**: Gold tint, advancement
- **LOOT**: Green tint, acquisition
- **SYSTEM**: White tint, general info

## Integration with Narrative
- Notifications should punctuate action
- Don't overuse - key moments only
- Character can "check" their status on request
- Inner monologue can reference notifications`
    },

    // ==================== PRAXIS (Tactical) ====================
    {
        name: 'PRAXIS Combat System',
        worldModule: 'shadowMonarch',
        category: 'rules',
        targetModel: 'brain',
        enabled: true,
        content: `# PRAXIS Tactical Combat System

## Stat System (max 999)
- **STR**: Physical power, melee damage, carrying capacity
- **AGI**: Speed, dodge, critical hit chance
- **VIT**: HP pool, damage resistance, stamina
- **INT**: Skill power, mana pool, strategic ability
- **SEN**: Detection, accuracy, awareness

## Resource Management
- **HP**: Health, scales with VIT
- **MP**: Mana/skill resource, scales with INT
- All resources regenerate based on stats and rest

## Level Progression
- Max level: 100
- Each level grants stat points
- Skills unlock at specific levels
- Gate/mission difficulty scales with level

## Combat Mechanics
- Turn-based tactical combat
- Cover system: Partial (+25% defense) or Full (+50%)
- Flanking bonuses apply
- Critical hits deal 2x damage

## Skill Categories
- **Active Skills**: Consume MP, have cooldowns
- **Passive Skills**: Always active buffs
- **Ultimate Skills**: Powerful, long cooldowns

## Equipment
- Weapons affect damage and range
- Armor provides defense and bonuses
- Accessories grant special effects
- Rarity: Common → Rare → Epic → Legendary → Mythic`
    },
    {
        name: 'PRAXIS World Setting',
        worldModule: 'shadowMonarch',
        category: 'lore',
        targetModel: 'voice',
        enabled: true,
        content: `# PRAXIS: Operation Dark Tide

## Setting Overview
In a world where supernatural threats have emerged through dimensional rifts called "Gates," elite operatives of the PRAXIS division stand as humanity's last defense. Part military, part dungeon crawler.

## The Gates
- Dimensional rifts appear randomly worldwide
- Each Gate contains monsters and a boss
- Uncleared Gates "break" and release monsters
- Gate ranks: E (weakest) through S (catastrophic)

## PRAXIS Organization
- Government-funded supernatural response force
- Operatives are awakened individuals with powers
- Strict hierarchy and mission structure
- Advanced tech combined with magical abilities

## Operative Classes
- **Fighter**: Frontline combat specialists
- **Mage**: Ranged magical damage dealers
- **Assassin**: Stealth and critical damage
- **Tank**: Defensive specialists
- **Healer**: Support and recovery

## Tone and Style
- Military professionalism
- Tactical and strategic focus
- System notifications in [SYSTEM] format
- Modern weapons alongside supernatural powers
- High stakes, life-and-death missions

## Key Terminology
- "Awakened": Humans with supernatural abilities
- "Gate Break": When an uncleared Gate releases monsters
- "Dungeon": The dimension inside a Gate
- "Boss": The strongest monster in a Gate
- "Clear": Successfully completing and closing a Gate`
    },
    {
        name: 'PRAXIS Mission Structure',
        worldModule: 'shadowMonarch',
        category: 'rules',
        targetModel: 'both',
        enabled: true,
        content: `# PRAXIS Mission Protocol

## Mission Types
- **Gate Assault**: Clear a dungeon before break
- **Rescue**: Extract civilians or operatives
- **Elimination**: Take out specific high-value targets
- **Recon**: Gather intel, avoid detection
- **Defense**: Protect location from monster waves

## Mission Briefing Format
[MISSION DESIGNATION: OPERATION NAME]
[OBJECTIVE: Primary goal]
[THREAT LEVEL: E through S rank]
[RECOMMENDED PARTY: Number and roles]
[INTEL: Known information]

## Ranking System
Missions earn points toward rank advancement:
- E-Class Operative → D-Class → C-Class → B-Class → A-Class → S-Class

## Mission Rewards
- Experience points
- Credits (currency)
- Equipment drops
- Skill advancement materials
- Organization reputation

## Team Dynamics
- Parties typically 4-6 operatives
- Role balance is crucial
- Chain of command must be respected
- Mission comes before individual glory

## System Notifications
[MISSION START]
[OBJECTIVE UPDATED: New goal]
[THREAT DETECTED: Enemy details]
[MISSION COMPLETE: Grade S/A/B/C/D/F]`
    }
];

// ==================== SEED FUNCTION ====================

async function seedKnowledgeDocs() {
    console.log('🌱 Starting Knowledge Documents seeding...\n');

    const collectionRef = db.collection('knowledgeDocuments');

    // Check existing documents
    const existingDocs = await collectionRef.get();
    console.log(`📋 Found ${existingDocs.size} existing documents\n`);

    let created = 0;
    let skipped = 0;

    for (const doc of knowledgeDocuments) {
        // Check if document with same name and module exists
        const existing = await collectionRef
            .where('name', '==', doc.name)
            .where('worldModule', '==', doc.worldModule)
            .get();

        if (!existing.empty) {
            console.log(`⏭️  Skipping "${doc.name}" (${doc.worldModule}) - already exists`);
            skipped++;
            continue;
        }

        try {
            const docRef = await collectionRef.add({
                ...doc,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`✓ Created "${doc.name}" (${doc.worldModule}) → ${doc.targetModel}`);
            created++;
        } catch (error) {
            console.error(`❌ Failed to create "${doc.name}":`, error.message);
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`✅ Seeding complete!`);
    console.log(`   Created: ${created} documents`);
    console.log(`   Skipped: ${skipped} documents (already exist)`);
    console.log(`   Total in collection: ${existingDocs.size + created}`);
}

// Run the seeding
seedKnowledgeDocs()
    .then(() => {
        console.log('\n🎉 Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Seeding failed:', error);
        process.exit(1);
    });
