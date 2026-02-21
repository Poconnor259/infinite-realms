import { getPrompt } from '../../promptHelper';
import { getActiveQuest, type GameState } from '../stateHelpers';
import { buildCampaignLedger } from '../campaignLedger';
import { BrainInput } from './types';

export async function buildBrainSystemPrompt(
    input: BrainInput
): Promise<string> {
    const {
        worldModule,
        currentState,
        chatHistory,
        customRules,
        knowledgeDocuments,
        showSuggestedChoices = true,
        interactiveDiceRolls = false,
        rollResult,
        pendingRoll
    } = input;

    // Build knowledge base section if documents exist
    let knowledgeSection = '';
    if (knowledgeDocuments && knowledgeDocuments.length > 0) {
        knowledgeSection = `

REFERENCE MATERIALS (Use for world context and lore):
---
${knowledgeDocuments.join('\n\n---\n\n')}
---
`;
    }

    let customRulesSection = '';
    if (customRules) {
        customRulesSection = `

WORLD-SPECIFIC RULES (PRIORITIZE THESE):
---
${customRules}
---
`;
    }

    // Get brain prompt from Firestore
    const brainPrompt = await getPrompt('brain', worldModule);

    // Check if character already has essences (for Outworlder)
    let essenceOverrideSection = '';
    const directCharacter = currentState?.character as Record<string, any>;
    const moduleCharacter = (currentState as any)?.moduleState?.character as Record<string, any>;
    const character = directCharacter || moduleCharacter;

    if (character?.essences && Array.isArray(character.essences) && character.essences.length > 0) {
        const essenceSelection = character?.essenceSelection;

        if (essenceSelection === 'chosen' || essenceSelection === 'imported' || !essenceSelection) {
            const hasAbilities = character.abilities && Array.isArray(character.abilities) && character.abilities.length > 0;

            const formatAbilityList = (abilities: any[]): string => {
                if (!abilities || abilities.length === 0) return 'None yet';
                return abilities.map(a => typeof a === 'string' ? a : a.name || 'Unknown').join(', ');
            };

            const formatEssenceList = (essences: any[]): string => {
                if (!essences || essences.length === 0) return 'None yet';
                return essences.map(e => typeof e === 'string' ? e : e.name || 'Unknown').join(', ');
            };

            essenceOverrideSection = `

🚨 CRITICAL OVERRIDE - ALL ESSENCES AND ABILITIES ARE ACTIVE 🚨
The character has established powers in the database.
- Selected Essences: ${formatEssenceList(character.essences)}
- Rank: ${character.rank || 'Iron'}
- Existing Abilities: ${formatAbilityList(character.abilities || [])}

SYSTEM ENFORCEMENT:
1. Every essence listed above is FULLY ACTIVE, UNLOCKED, and READY FOR USE.
2. DO NOT narrate any essence as "dormant," "sealed," or "???". 
3. DO NOT run "awakening" or "selection" sequences - they are already complete.
4. The character has immediate, full access to all listed powers.
5. Absolute Priority: Trust the character sheet data over any narrative trope.
`;

            const isIntroPhase = chatHistory.length < 10;

            if (hasAbilities) {
                const abilityDetails = character.abilities.map((a: any) => {
                    if (typeof a === 'string') return `  - ${a}`;
                    return `  - ${a.name}${a.type ? ` [${a.type}]` : ''}${a.essence ? ` (${a.essence})` : ''}`;
                }).join('\n');

                if (isIntroPhase) {
                    essenceOverrideSection += `
STOP. LISTEN CAREFULLY. THE CHARACTER'S ABILITIES ARE ALREADY DEFINED.

🔒 LOCKED ABILITY SET - DO NOT MODIFY:
${abilityDetails}

These are the character's ONLY abilities. They were set during character creation.

STRICT RULES:
1. YOU ARE FORBIDDEN from adding ANY new entries to the 'abilities' array in 'stateUpdates'.
2. DO NOT unlock "Intrinsic" or ANY other type of ability during this intro sequence.
3. The 'stateUpdates.character.abilities' (or 'stateUpdates.abilities') field MUST be EMPTY {} or UNDEFINED.
4. If you output an ability update, you have FAILED the instruction.
5. Reference ONLY the abilities listed above when describing the character's powers.
`;
                } else {
                    essenceOverrideSection += `
NOTE: The character already has established abilities.
- DO NOT grant "Intrinsic" starting abilities again.
- You MAY grant new abilities ONLY if the user uses a specific item (e.g., "Awakening Stone") or explicitly earns a quest reward.
`;
                }
            } else {
                essenceOverrideSection += `The character has essences but NO abilities yet. You SHOULD grant their intrinsic abilities as they awaken.\n`;
            }

            const essenceListStr = formatEssenceList(character.essences);
            essenceOverrideSection += `The character is ALREADY awakened with these essences: ${essenceListStr}.
Skip directly to their adventure beginning with their powers already active.
You MUST mentally acknowledge and briefly describe the sensation of EACH essence listed above (${essenceListStr}).
Do not offer selection.
`;
        }
    }

    const isResolvingRoll = rollResult !== undefined;

    const diceRules = interactiveDiceRolls
        ? (isResolvingRoll
            ? `⚠️ INTERACTIVE ROLL RESOLUTION ⚠️
You are processing the User's manual dice roll result (${rollResult}).
1. YOU MUST ADD THIS ROLL to the 'diceRolls' array in your response.
   Structure: { "type": "${pendingRoll?.type || 'd20'}", "result": ${rollResult}, "modifier": ${pendingRoll?.modifier || 0}, "total": ${(rollResult || 0) + (pendingRoll?.modifier || 0)}, "purpose": "${pendingRoll?.purpose || 'Action'}", "difficulty": ${pendingRoll?.difficulty || 'null'}, "success": ${pendingRoll?.difficulty ? (rollResult || 0) + (pendingRoll?.modifier || 0) >= (pendingRoll?.difficulty || 0) : 'null'} }
2. DO NOT set "requiresUserInput": true (unless a *different* follow-up action needs a roll).
3. DO NOT set "pendingRoll" for this same action again.
4. Continue the narrative based on this result.`
            : `⚠️ CRITICAL - INTERACTIVE DICE MODE IS ACTIVE ⚠️
This is a MANDATORY requirement. When ANY situation requires a dice roll, you MUST:

1. Set "requiresUserInput": true
2. Set "pendingRoll" with the exact structure shown below
3. Leave "diceRolls" as an EMPTY array []
4. In "narrativeCues", describe ONLY the setup, NOT the outcome

REQUIRED pendingRoll JSON structure:
{
  "type": "d20",           // Required: "d20", "2d6", "d100", etc.
  "purpose": "Attack Roll vs Goblin",  // Required: Clear description
  "modifier": 5,           // Optional: Number bonus/penalty
  "stat": "Strength",      // Optional: Related stat
  "difficulty": 15         // REQUIRED for DC checks - ALWAYS include the target DC number
}

TRIGGERS for pendingRoll (ANY of these = MUST use pendingRoll):
- Combat attacks (melee, ranged, spell)
- Skill checks when player ACTIVELY ATTEMPTS (searching, sneaking, persuading, etc.)
  DO NOT trigger for informational questions ("What do I see?", "I ask the guard about...")
- Saving throws (reflex, will, fortitude)
- Ability checks (strength, dexterity, etc.)
- Damage rolls (only AFTER hit confirmed by previous roll)
- ONLY when you can assign a meaningful DC (at least 5, typically 10-20)


SAFE USAGE vs COMBAT RULES:
1. COMBAT & OFFENSE (ALWAYS ROLL):
   - ANY attack, offensive spell, or hostile action MUST require a roll.
   - NEVER assume success for an attack, even if the ability is innate.
   - Triggers: "Attack", "Cast [Damage Spell]", "Strike", "Shoot".
   - Set "diceRolls": [] and "requiresUserInput": true for these actions.

2. CHALLENGE & RISK (ALWAYS ROLL):
   - Actions with a chance of failure (climbing, persuading, sneaking).

3. UTILITY & FLAVOR (AUTO-SUCCESS):
   - Routine usage of known abilities in safe environments DOES NOT require a roll.
   - Non-hostile system interactions (e.g., "Requesting a quest", "Checking status", "Opening map", "Help: [topic]", "What is [topic]?") succeed AUTOMATICALLY.
   - Help queries MUST NEVER require a roll.
   - Examples: summoning a mount, opening a personal portal, lighting a magic torch.

DO NOT resolve outcomes. Wait for user's roll result.
DO NOT auto-roll. Leave diceRolls as [].`)
        : 'Calculate all dice rolls using proper randomization simulation and include them in "diceRolls" array. ALWAYS include "purpose", "modifier", "total", and "difficulty" (Target DC) if applicable to show your work.';

    const choicesRule = `USER PREFERENCE: showSuggestedChoices = ${showSuggestedChoices}. 
${showSuggestedChoices
            ? `ALWAYS include a "pendingChoice" object with 2-4 "options" representing suggested next actions.
STRICT GUIDELINES FOR SUGGESTED CHOICES:
1. FIRST-PERSON PERSPECTIVE: Every option MUST be written from the player's perspective (e.g., "I ask about...", "I attack...", "I examine...").
2. ACTION-ORIENTED: Suggestions must be THINGS THE PLAYER DOES, not things that happen to the player.
3. NO NARRATIVE OUTCOMES: Forbidden from suggesting NPC reactions, world changes, or outcomes as choices.
   - WRONG: "The merchant offers a discount."
   - RIGHT: "I haggle with the merchant for a better price."
   - WRONG: "The woman lowers her weapon."
   - RIGHT: "I try to convince her I'm not a threat."
4. Set "requiresUserInput": true to ensure these are displayed.`
            : 'Do NOT include options in pendingChoice.options. Set it to null/undefined.'}`;

    const rollResultRule = rollResult !== undefined
        ? `🎲 DICE ROLL RESULT RECEIVED: ${rollResult}
CONTEXT: The user rolled for "${pendingRoll?.purpose || 'unknown purpose'}".
${pendingRoll ? `Target DC: ${pendingRoll.difficulty || 'None'}, Modifier: ${pendingRoll.modifier || 0}, Stat: ${pendingRoll.stat || 'None'}` : ''}

⚠️ CRITICAL ROLL INTEGRITY RULES - STRICTLY ENFORCE ⚠️

The user has rolled ${rollResult}. This is the EXACT, FINAL dice result.

MANDATORY REQUIREMENTS:
1. **RESPECT THE TRAINING DOCUMENT**: Follow the "Dice Role specifics" training document EXACTLY
2. **NO MODIFIER INVENTION**: DO NOT add modifiers that weren't in the original pendingRoll.modifier (${pendingRoll?.modifier || 0})
3. **NO FAKE BONUSES**: DO NOT invent Spirit, Luck, Divine Favor, or ANY other modifiers to change the outcome
4. **HONEST CALCULATION**: Success/Failure = (${rollResult} + ${pendingRoll?.modifier || 0}) vs DC ${pendingRoll?.difficulty || 'N/A'}
5. **ALLOW FAILURES**: If the roll fails, IT FAILS - implement negative consequences (damage, failed checks, setbacks, complications)
6. **RESPECT RANDOMNESS**: The dice represent fate and chance - honor that uncertainty
7. **PROCESS HONESTLY**: Continue the narrative based on the actual result, not a desired outcome
8. **NO RE-ROLLS**: Do NOT request another roll for the same action

The training document contains the complete dice mechanics. Follow it precisely. Do NOT deviate to force success.`
        : '';

    let systemPrompt = brainPrompt;

    systemPrompt = systemPrompt.replace('{{KNOWLEDGE_SECTION}}', knowledgeSection || '');
    systemPrompt = systemPrompt.replace('{{CUSTOM_RULES_SECTION}}', customRulesSection || '');
    systemPrompt = systemPrompt.replace('{{ESSENCE_OVERRIDE_SECTION}}', essenceOverrideSection || '');
    systemPrompt = systemPrompt.replace('{{INTERACTIVE_DICE_RULES}}', diceRules);
    systemPrompt = systemPrompt.replace('{{SUGGESTED_CHOICES_RULES}}', choicesRule);
    systemPrompt = systemPrompt.replace('{{ROLL_RESULT_RULE}}', rollResultRule);

    if (interactiveDiceRolls && !isResolvingRoll) {
        const CRITICAL_DICE_HEADER = `
🚨🚨🚨 CRITICAL MANDATORY RULE - READ THIS FIRST 🚨🚨🚨

INTERACTIVE DICE MODE IS ACTIVE

When ANY action requires a dice roll, you MUST:
1. SET "pendingRoll" object with: type, purpose, modifier, stat, difficulty
2. SET "requiresUserInput": true
3. LEAVE "diceRolls": [] (empty array)
4. DO NOT describe the roll outcome - STOP before resolution

VIOLATING THIS RULE IS A SYSTEM ERROR.

🚨🚨🚨 END CRITICAL RULE 🚨🚨🚨

`;
        systemPrompt = CRITICAL_DICE_HEADER + systemPrompt;
    }

    const WORLD_STAT_CONTEXT: Record<string, string> = {
        classic: '\n📊 STATS: Use D&D 5E stats: STR, DEX, CON, INT, WIS, CHA\n',
        outworlder: '\n📊 STATS: Use Outworlder stats ONLY: power, speed, spirit, recovery. NEVER use D&D stat names (STR/DEX/WIS/etc).\n',
        tactical: '\n📊 STATS: Use Tactical stats ONLY: strength, agility, vitality, intelligence, perception. NEVER use D&D stat names (STR/DEX/WIS/etc).\n',
    };
    systemPrompt = (WORLD_STAT_CONTEXT[worldModule] || '') + systemPrompt;

    if (!systemPrompt.includes(diceRules) && !brainPrompt.includes('{{INTERACTIVE_DICE_RULES}}')) {
        systemPrompt += `
${knowledgeSection}
${customRulesSection}
${essenceOverrideSection}

CRITICAL INSTRUCTIONS:
1. You are ONLY the logic engine. You process game mechanics, not story.
2. You MUST respond with valid JSON. Include a "stateUpdates" object with any changed game state fields.
3. ${diceRules}
4. Update only the state fields that changed in the stateUpdates object.
5. Provide narrative cues for the storyteller, not full prose.
6. Include any system messages (level ups, achievements, warnings).
7. If reference materials or custom rules are provided, use them for world-consistent responses.
8. ${choicesRule}
${rollResultRule}`;
    }

    const activeQuest = getActiveQuest(currentState as GameState);
    let questContext = '';
    if (activeQuest) {
        const objectives = activeQuest.objectives?.map(obj =>
            `  ${obj.isCompleted ? '[\u2713]' : '[ ]'} ${obj.text}`
        ).join('\n') || '';

        questContext = `

ACTIVE QUEST:
Title: ${activeQuest.title}
Description: ${activeQuest.description}
Objectives:
${objectives}

IMPORTANT: Keep this quest objective in mind. The player is working towards completing these objectives.`;
    }

    systemPrompt += `${questContext}

${buildCampaignLedger(currentState, worldModule)}

CURRENT GAME STATE (RAW):
${JSON.stringify(currentState, null, 2)}

Respond with JSON only. No markdown, no explanation.`;

    return systemPrompt;
}
