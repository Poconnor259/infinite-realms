"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initPromptHelper = initPromptHelper;
exports.getPrompt = getPrompt;
exports.getStateReviewerSettings = getStateReviewerSettings;
exports.seedAIPrompts = seedAIPrompts;
const admin = __importStar(require("firebase-admin"));
// ==================== DEFAULT PROMPTS ====================
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

Return a JSON object with only the fields that changed:
{
  "corrections": {
    // Only include fields that need updating
  },
  "reasoning": "Brief explanation of what changed"
}`;
// World-specific brain prompts
const WORLD_BRAIN_PROMPTS = {
    classic: `You are the LOGIC ENGINE for a D&D 5th Edition RPG.
Rules:
- Use standard 5e rules for combat, skill checks, and saves
- Roll d20 for attacks and checks, add appropriate modifiers
- AC determines if attacks hit
- Track HP changes from damage and healing
- Manage spell slots for spellcasters
- Track inventory changes

Stats to track: HP, AC, STR, DEX, CON, INT, WIS, CHA, proficiency bonus, gold, inventory items, spell slots.`,
    outworlder: `You are the LOGIC ENGINE for a HWFWM (He Who Fights With Monsters) style RPG.
Rules:
- Characters have essence abilities tied to their essences
- Rank progression: Iron → Bronze → Silver → Gold → Diamond
- Abilities have cooldowns and mana/spirit costs
- Health scales with rank
- Generate "Blue Box" style system notifications

Stats to track: HP, Mana, Spirit, Rank, Essences (max 4), Confluence, Abilities with cooldowns.`,
    tactical: `You are the LOGIC ENGINE for a PRAXIS: Operation Dark Tide RPG.
Rules:
- Daily missions must be tracked (physical training, tactical drills)
- Failure to complete daily missions triggers a penalty zone or mission failure
- Tactical recruitment and unit management can expand your squad
- Stats can be allocated from earned mission points
- Gates and mission zones have ranks from E to S

Stats to track: HP, Mana, Fatigue, STR/AGI/VIT/INT/PER, Mission Points, Tactical Squad roster, Rank/Job, Skills.`,
};
// World-specific voice prompts
const WORLD_VOICE_PROMPTS = {
    classic: `You are the NARRATOR for a classic high fantasy RPG in the style of D&D.
  
STYLE GUIDELINES:
- Write in second person ("You swing your sword...")
- Use vivid, descriptive prose suitable for epic fantasy
- Describe combat with weight and impact
- Give NPCs distinct voices and personalities
- Balance drama with moments of levity
- Reference classic fantasy tropes while keeping things fresh

TONE: Epic, heroic, occasionally humorous, always engaging.`,
    outworlder: `You are the NARRATOR for a LitRPG adventure in the style of "He Who Fights With Monsters."

STYLE GUIDELINES:
- Write in second person with snarky, modern sensibilities
- Include occasional pop culture references where fitting
- Format system messages as "Blue Box" alerts using code blocks:
  \`\`\`
  『SYSTEM MESSAGE』
  Content here
  \`\`\`
- Make abilities feel impactful and visually distinct
- Balance serious moments with witty banter
- The world should feel dangerous but also full of wonder

TONE: Witty, irreverent, action-packed, with genuine emotional moments.`,
    tactical: `You are the NARRATOR for a PRAXIS: Operation Dark Tide style elite tactical RPG.

STYLE GUIDELINES:
- Write in second person with emphasis on tactical precision and high-stakes missions
- Format system notifications with brackets: [SYSTEM MESSAGE]
- Combat should feel tactical, intense, and high-tech
- Squad members and tactical units should feel like a disciplined elite force
- Emphasize specialized gear and mission objectives
- Build tension during covert operations and gate breaches

TONE: Tactical, tense, high-stakes, professional, occasionally mysterious.`,
};
// ==================== HELPER FUNCTIONS ====================
let db = null;
function initPromptHelper(firestore) {
    db = firestore;
}
/**
 * Get a prompt from Firestore with world-specific override support
 * @param type - 'brain', 'voice', or 'reviewer'
 * @param worldId - The world module ID (e.g., 'classic', 'tactical')
 * @returns The appropriate prompt string
 */
async function getPrompt(type, worldId) {
    if (!db) {
        console.warn('[PromptHelper] Firestore not initialized, using defaults');
        return getDefaultPrompt(type, worldId);
    }
    try {
        // 1. Try to get world-specific override
        const worldDoc = await db.collection('aiPrompts').doc(worldId).get();
        if (worldDoc.exists) {
            const worldData = worldDoc.data();
            const fieldName = type === 'brain' ? 'brainPrompt'
                : type === 'voice' ? 'voicePrompt'
                    : 'stateReviewerPrompt';
            if (worldData[fieldName] !== null && worldData[fieldName] !== undefined) {
                return worldData[fieldName];
            }
        }
        // 2. Fall back to global prompt
        const globalDoc = await db.collection('aiPrompts').doc('global').get();
        if (globalDoc.exists) {
            const globalData = globalDoc.data();
            const fieldName = type === 'brain' ? 'brainPrompt'
                : type === 'voice' ? 'voicePrompt'
                    : 'stateReviewerPrompt';
            if (globalData[fieldName]) {
                return globalData[fieldName];
            }
        }
        // 3. If neither exists, return default
        console.warn(`[PromptHelper] No prompt found in Firestore for ${type}/${worldId}, using default`);
        return getDefaultPrompt(type, worldId);
    }
    catch (error) {
        console.error('[PromptHelper] Error fetching prompt:', error);
        return getDefaultPrompt(type, worldId);
    }
}
/**
 * Get state reviewer settings
 */
async function getStateReviewerSettings() {
    if (!db) {
        return {
            enabled: true,
            model: 'gpt-4o-mini',
            frequency: 1,
            prompt: DEFAULT_STATE_REVIEWER_PROMPT
        };
    }
    try {
        const globalDoc = await db.collection('aiPrompts').doc('global').get();
        if (globalDoc.exists) {
            const data = globalDoc.data();
            return {
                enabled: data.stateReviewerEnabled ?? true,
                model: data.stateReviewerModel || 'gpt-4o-mini',
                frequency: data.stateReviewerFrequency ?? 1,
                prompt: data.stateReviewerPrompt || DEFAULT_STATE_REVIEWER_PROMPT
            };
        }
    }
    catch (error) {
        console.error('[PromptHelper] Error fetching reviewer settings:', error);
    }
    return {
        enabled: true,
        model: 'gpt-4o-mini',
        frequency: 1,
        prompt: DEFAULT_STATE_REVIEWER_PROMPT
    };
}
function getDefaultPrompt(type, worldId) {
    if (type === 'brain') {
        return WORLD_BRAIN_PROMPTS[worldId] || DEFAULT_BRAIN_PROMPT;
    }
    else if (type === 'voice') {
        return WORLD_VOICE_PROMPTS[worldId] || DEFAULT_VOICE_PROMPT;
    }
    else {
        return DEFAULT_STATE_REVIEWER_PROMPT;
    }
}
// ==================== SEED FUNCTION ====================
/**
 * Seed the aiPrompts collection with initial data
 * Call this once to populate Firestore with default prompts
 */
async function seedAIPrompts(firestore) {
    const batch = firestore.batch();
    // Global default
    batch.set(firestore.collection('aiPrompts').doc('global'), {
        brainPrompt: DEFAULT_BRAIN_PROMPT,
        voicePrompt: DEFAULT_VOICE_PROMPT,
        stateReviewerPrompt: DEFAULT_STATE_REVIEWER_PROMPT,
        stateReviewerEnabled: true,
        stateReviewerModel: 'gpt-4o-mini',
        stateReviewerFrequency: 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    // World-specific overrides
    for (const worldId of ['classic', 'outworlder', 'tactical']) {
        batch.set(firestore.collection('aiPrompts').doc(worldId), {
            worldId,
            brainPrompt: WORLD_BRAIN_PROMPTS[worldId],
            voicePrompt: WORLD_VOICE_PROMPTS[worldId],
            stateReviewerPrompt: null, // Use global
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }
    await batch.commit();
    console.log('[PromptHelper] Seeded aiPrompts collection');
}
//# sourceMappingURL=promptHelper.js.map