/**
 * Campaign Ledger - AI-readable game state summary
 * Provides consistent context to Brain, Voice, and Quest Master AIs
 */

export function buildCampaignLedger(state: any, worldModule: string): string {
    const char = state.character || {};
    const difficulty = state.difficulty || 'adventurer';

    let ledger = `
📜 CAMPAIGN LEDGER (MANDATORY REFERENCE)
═══════════════════════════════════════

CHARACTER:
• Name: ${char.name || 'Unknown'}
• ${getProgressionLabel(worldModule)}: ${char.rank || char.level || 1}
${char.essences?.length ? `• Essences: ${char.essences.join(', ')}` : ''}
${char.class ? `• Class: ${char.class}` : ''}
${char.race ? `• Race: ${char.race}` : ''}
${char.job ? `• Job: ${char.job}` : ''}

PROGRESSION:
${formatProgression(char, worldModule, state)}

ABILITIES (⚠️ ONLY REFERENCE THESE - DO NOT INVENT):
${formatAbilities(char.abilities || [])}

INVENTORY:
${formatInventory(char.inventory || state.inventory || [])}

RESOURCES:
${formatResources(char, worldModule)}

KEY NPCs MET:
${formatNPCs(state.keyNpcs || state.npcs || {})}

CURRENT LOCATION: ${state.currentLocation || 'Unknown'}

ACTIVE QUESTS:
${formatQuests(state.questLog || [])}

DIFFICULTY: ${difficulty.toUpperCase()}
${getDifficultyInstructions(difficulty)}

═══════════════════════════════════════
⚠️ CRITICAL: Use ONLY the abilities, inventory, and NPCs listed above.
Do NOT invent new ones. If something isn't listed, it doesn't exist yet.

${getGameMasterPrinciples(difficulty)}
`;
    return ledger;
}

// Helper: Get progression label based on world type
function getProgressionLabel(worldModule: string): string {
    if (worldModule === 'outworlder') return 'Rank';
    if (worldModule === 'tactical') return 'Level';
    return 'Level';
}

// Helper: Format progression based on world type
function formatProgression(char: any, worldModule: string, state: any): string {
    if (worldModule === 'outworlder') {
        const rank = char.rank || 'Iron';
        const nextRank = getNextRank(rank);
        return `• Rank: ${rank} → Next: ${nextRank}
• Rank Progress: ${char.rankProgress || 0}%`;
    } else if (worldModule === 'classic') {
        const level = char.level || 1;
        const xpNeeded = getXPForNextLevel(level);
        return `• Level: ${level}
• XP: ${char.experience || 0} / ${xpNeeded}
• Proficiency Bonus: +${char.proficiencyBonus || 2}`;
    } else if (worldModule === 'tactical') {
        const level = char.level || 1;
        const xpNeeded = getXPForNextLevel(level);
        const gateRank = state.gateRank || char.gateRank || 'E';
        return `• Level: ${level}
• XP: ${char.experience || 0} / ${xpNeeded}
• Stat Points Available: ${char.statPoints || 0}
• Job: ${char.job || 'None'}
• Gate Rank: ${gateRank} (Dungeons accessible)`;
    } else {
        return `• Level: ${char.level || 1}`;
    }
}

// Helper: Get next rank for Outworlder
function getNextRank(currentRank: string): string {
    const ranks = ['Iron', 'Bronze', 'Silver', 'Gold', 'Diamond'];
    const currentIndex = ranks.indexOf(currentRank);
    if (currentIndex === -1 || currentIndex === ranks.length - 1) return currentRank;
    return ranks[currentIndex + 1];
}

// Helper: Calculate XP needed for next level
function getXPForNextLevel(level: number): number {
    // Simple formula: level * 1000
    return (level + 1) * 1000;
}

// Helper: Format abilities
function formatAbilities(abilities: any[]): string {
    if (!abilities || abilities.length === 0) {
        return '• None yet';
    }

    return abilities.map(ability => {
        const name = typeof ability === 'string' ? ability : ability.name;
        const desc = typeof ability === 'object' && ability.description
            ? ` - ${ability.description.substring(0, 60)}${ability.description.length > 60 ? '...' : ''}`
            : '';
        const type = typeof ability === 'object' && ability.type ? ` [${ability.type}]` : '';
        return `• ${name}${type}${desc}`;
    }).join('\n');
}

// Helper: Format inventory
function formatInventory(inventory: any[]): string {
    if (!inventory || inventory.length === 0) {
        return '• Empty';
    }

    return inventory.map(item => {
        const name = typeof item === 'string' ? item : item.name;
        const qty = typeof item === 'object' && item.quantity ? ` x${item.quantity}` : '';
        const equipped = typeof item === 'object' && item.equipped ? ' [EQUIPPED]' : '';
        return `• ${name}${qty}${equipped}`;
    }).join('\n');
}

// Helper: Format resources
function formatResources(char: any, worldModule: string): string {
    const resources: string[] = [];

    // HP is universal
    if (char.hp) {
        resources.push(`• HP: ${char.hp.current}/${char.hp.max}`);
    }

    // Module-specific resources
    if (worldModule === 'classic' || worldModule === 'outworlder') {
        if (char.mana) resources.push(`• Mana: ${char.mana.current}/${char.mana.max}`);
        if (char.stamina) resources.push(`• Stamina: ${char.stamina.current}/${char.stamina.max}`);
    } else if (worldModule === 'tactical') {
        if (char.nanites) resources.push(`• Nanites: ${char.nanites.current}/${char.nanites.max}`);
        if (char.stamina) resources.push(`• Stamina: ${char.stamina.current}/${char.stamina.max}`);
    }

    return resources.length > 0 ? resources.join('\n') : '• None tracked';
}

// Helper: Format NPCs
function formatNPCs(npcs: any): string {
    if (!npcs || Object.keys(npcs).length === 0) {
        return '• None yet';
    }

    return Object.entries(npcs).map(([name, data]: [string, any]) => {
        const info = data?.info ? ` - ${data.info}` : '';
        return `• ${name}${info}`;
    }).join('\n');
}

// Helper: Format quests
function formatQuests(quests: any[]): string {
    if (!quests || quests.length === 0) {
        return '• None active';
    }

    const activeQuests = quests.filter(q => q.status === 'active');
    if (activeQuests.length === 0) {
        return '• None active';
    }

    return activeQuests.map(quest => {
        const objectives = quest.objectives?.filter((o: any) => !o.completed).length || 0;
        return `• ${quest.title || quest.name} (${objectives} objectives remaining)`;
    }).join('\n');
}

// Helper: Get difficulty-specific instructions
function getDifficultyInstructions(difficulty: string): string {
    switch (difficulty) {
        case 'story':
            return `🎭 STORY MODE: Focus on narrative enjoyment. Be generous with success, soften failures into "almost" moments. The player is here for the story, not the challenge.`;
        case 'novice':
            return `📚 NOVICE: Provide helpful hints. Be forgiving but educational. Failures should teach, not punish.`;
        case 'adventurer':
            return `⚔️ ADVENTURER: Balanced and fair. Success feels earned, failure has consequences but isn't devastating.`;
        case 'hero':
            return `🏆 HERO: No safety nets. Dice results are absolute. Failures hurt. Victory is hard-won.`;
        case 'legendary':
            return `💀 LEGENDARY: Unforgiving. Death is permanent. The world doesn't care about you. Every decision could be your last.`;
        default:
            return `⚔️ ADVENTURER: Balanced and fair. Success feels earned, failure has consequences but isn't devastating.`;
    }
}

// Helper: Get game master principles
function getGameMasterPrinciples(difficulty: string): string {
    return `
🎲 GAME MASTER PRINCIPLES:
• Be FAIR, not punishing - challenge appropriately for ${difficulty}
• Dice results are sacred - honor the roll
• NPCs have their own agendas
• Quests should test varied skills, not just strengths
• The world feels real - actions have consequences
`;
}
