// Type definitions for game state and world modules

// ==================== CORE TYPES ====================

export interface Character {
    id: string;
    name: string;
    hp: {
        current: number;
        max: number;
    };
    level: number;
}

export interface Message {
    id: string;
    role: 'user' | 'narrator' | 'system';
    content: string;
    timestamp: number;
    metadata?: {
        stateChanges?: StateChange[];
        diceRolls?: DiceRoll[];
        alertType?: 'info' | 'success' | 'warning' | 'danger' | 'blueBox';
    };
}

export interface StateChange {
    field: string;
    oldValue: any;
    newValue: any;
    description?: string;
}

export interface DiceRoll {
    type: string; // e.g., "d20", "2d6"
    result: number;
    modifier?: number;
    total: number;
    purpose?: string;
}

// ==================== CAMPAIGN ====================

export interface Campaign {
    id: string;
    userId: string;
    name: string;
    worldModule: WorldModuleType;
    createdAt: number;
    updatedAt: number;
    character: Character;
    moduleState: ModuleState;
}

export type WorldModuleType = 'classic' | 'outworlder' | 'tactical';

export interface WorldModule {
    id: string;
    type: WorldModuleType;
    name: string;
    subtitle: string;
    icon: string;
    color: string;
    description: string;
    features: string[];
    locked?: boolean;
    lockReason?: string;
    customRules?: string;
    initialNarrative?: string;
    generateIntro?: boolean;
    order?: number;
}

// Game Engine types (stored in Firestore, editable by admin)
export interface StatDefinition {
    id: string;          // e.g., "STR", "power"
    name: string;        // Display name: "Strength", "Power"
    abbreviation: string;
    min: number;
    max: number;
    default: number;
    description?: string;
}

export interface ResourceDefinition {
    id: string;         // e.g., "hp", "mana", "spirit"
    name: string;       // "Health", "Mana", "Spirit"
    color: string;      // "#10b981"
    icon?: string;      // Emoji or icon name
    showInHUD: boolean;
}

export interface ProgressionConfig {
    type: 'level' | 'rank';
    // For level-based:
    maxLevel?: number;
    // For rank-based:
    ranks?: { id: string; name: string; order: number }[];
}

export interface FormFieldDefinition {
    id: string;
    type: 'text' | 'select' | 'number' | 'statPicker';
    label: string;
    required: boolean;
    options?: { value: string; label: string }[];  // For select
    placeholder?: string;
}

export interface HUDConfig {
    showStats: boolean;
    showResources: boolean;
    showAbilities: boolean;
    showInventory: boolean;
    layout: 'compact' | 'expanded';
}

export interface GameEngine {
    id: string;
    name: string;
    description: string;

    // Character Stats Configuration
    stats?: StatDefinition[];

    // Stat Point Budget for Character Creation
    statPointBudget?: number;  // Total points players can spend above defaults

    // Resource Bars (HP, Mana, Spirit, etc.)
    resources?: ResourceDefinition[];

    // Progression System
    progression?: ProgressionConfig;

    // Character Creation Form Fields
    creationFields?: FormFieldDefinition[];

    // HUD Layout Configuration
    hudLayout?: HUDConfig;

    // AI Prompt Context (how to describe this system to AI)
    aiContext?: string;

    order?: number;
}

// ==================== D&D 5E (CLASSIC) ====================

export interface ClassicCharacter extends Character {
    class: string;
    race: string;
    stats: {
        STR: number;
        DEX: number;
        CON: number;
        INT: number;
        WIS: number;
        CHA: number;
    };
    ac: number;
    proficiencyBonus: number;
    inventory: InventoryItem[];
    gold: number;
    spellSlots?: Record<number, { current: number; max: number }>;
    abilities: ClassicAbility[];
}

export interface InventoryItem {
    id: string;
    name: string;
    quantity: number;
    type: 'weapon' | 'armor' | 'potion' | 'scroll' | 'misc';
    description?: string;
    equipped?: boolean;
}

export interface ClassicAbility {
    name: string;
    description: string;
    type: 'action' | 'bonus' | 'reaction' | 'passive';
    usesRemaining?: number;
    maxUses?: number;
    rechargeOn?: 'shortRest' | 'longRest';
}

export interface ClassicModuleState {
    type: 'classic';
    character: ClassicCharacter;
    encounterActive: boolean;
    currentLocation: string;
    questLog: Quest[];
}

// ==================== OUTWORLDER (HWFWM) ====================

export interface OutworlderCharacter extends Character {
    rank: 'Iron' | 'Bronze' | 'Silver' | 'Gold' | 'Diamond';
    essences: string[]; // max 4
    confluence?: string;
    stats: {
        power: number;
        speed: number;
        spirit: number;
        recovery: number;
    };
    abilities: OutworlderAbility[];
    spirit: {
        current: number;
        max: number;
    };
    mana: {
        current: number;
        max: number;
    };
}

export interface OutworlderAbility {
    name: string;
    essence: string;
    rank: 'Normal' | 'Iron' | 'Bronze' | 'Silver' | 'Gold' | 'Diamond';
    type: 'attack' | 'defense' | 'utility' | 'movement' | 'special';
    cooldown: number;
    currentCooldown: number;
    cost: 'mana' | 'health' | 'spirit' | 'none';
    costAmount?: number;
    description: string;
}

export interface OutworlderModuleState {
    type: 'outworlder';
    character: OutworlderCharacter;
    currentDungeon?: string;
    dungeonFloor?: number;
    lootAwarded: InventoryItem[];
}

// ==================== TACTICAL (PRAXIS) ====================

export interface TacticalCharacter extends Character {
    job: 'None' | 'Specialist' | 'PRAXIS Operative';
    title?: string;
    stats: {
        strength: number;
        agility: number;
        vitality: number;
        intelligence: number;
        perception: number;
    };
    statPoints: number;
    mana: {
        current: number;
        max: number;
    };
    fatigue: {
        current: number;
        max: number;
    };
    skills: TacticalSkill[];
    tacticalSquad: TacticalUnit[];
}

export interface TacticalSkill {
    name: string;
    rank: 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
    type: 'active' | 'passive';
    manaCost?: number;
    cooldown?: number;
    description: string;
}

export interface TacticalUnit {
    id: string;
    name: string;
    rank: 'Normal' | 'Elite' | 'Knight' | 'General';
    type: string;
    status: 'active' | 'stored' | 'destroyed';
}

export interface DailyQuest {
    runKm: { current: number; target: number };
    pushups: { current: number; target: number };
    situps: { current: number; target: number };
    squats: { current: number; target: number };
    completed: boolean;
    deadline: number; // timestamp
}

export interface TacticalModuleState {
    type: 'tactical';
    character: TacticalCharacter;
    dailyQuest?: DailyQuest;
    inDungeon: boolean;
    gateRank?: 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
    penaltyZoneActive: boolean;
}

// ==================== UNION TYPES ====================

export type ModuleState =
    | ClassicModuleState
    | OutworlderModuleState
    | TacticalModuleState;

export type ModuleCharacter =
    | ClassicCharacter
    | OutworlderCharacter
    | TacticalCharacter;

// ==================== AUXILIARY TYPES ====================

export interface Quest {
    id: string;
    name: string;
    description: string;
    objectives: QuestObjective[];
    completed: boolean;
}

export interface QuestObjective {
    description: string;
    completed: boolean;
}

// ==================== AI RESPONSE TYPES ====================

export interface BrainResponse {
    stateUpdates: Partial<ModuleState>;
    narrativeCues: NarrativeCue[];
    diceRolls: DiceRoll[];
    systemMessages: string[];
}

export interface NarrativeCue {
    type: 'action' | 'dialogue' | 'description' | 'combat' | 'discovery';
    content: string;
    emotion?: 'neutral' | 'tense' | 'triumphant' | 'mysterious' | 'danger';
    characters?: string[];
}

// ==================== USER & SUBSCRIPTION ====================

export type SubscriptionTier = 'scout' | 'hero' | 'legend';

// Per-model token tracking
export interface ModelTokenUsage {
    prompt: number;
    completion: number;
    total: number;
}

export interface TokensByModel {
    gpt4oMini?: ModelTokenUsage;  // Brain + Text Generation
    claude?: ModelTokenUsage;      // Voice/Narrator
}

export interface User {
    id: string;
    email: string;
    displayName?: string;
    tier: SubscriptionTier;
    byokKeys?: {
        openai?: string;
        anthropic?: string;
        google?: string;
    };
    isAnonymous?: boolean;
    createdAt: number;
    role?: 'user' | 'admin';
    turnsUsed?: number;

    // Per-model token tracking (new)
    tokens?: TokensByModel;

    // Legacy token fields (kept for backward compatibility)
    tokensPrompt?: number;
    tokensCompletion?: number;
    tokensTotal?: number;
}

// ==================== TURNS & MONETIZATION ====================

export interface TurnsUsage {
    used: number;
    limit: number;
    bonusTurns: number; // From top-ups
    resetDate: number; // Timestamp for monthly reset
}

export interface TopUpPackage {
    id: 'topup_150' | 'topup_300';
    turns: number;
    price: number; // In cents
    displayPrice: string;
}

export const SUBSCRIPTION_LIMITS: Record<SubscriptionTier, number> = {
    scout: 15,
    hero: 300,
    legend: Infinity, // BYOK = unlimited
};

export const SUBSCRIPTION_PRICING: Record<SubscriptionTier, { price: number; displayPrice: string }> = {
    scout: { price: 0, displayPrice: 'Free' },
    hero: { price: 999, displayPrice: '$9.99/month' },
    legend: { price: 4999, displayPrice: '$49.99 one-time' },
};

export const TOP_UP_PACKAGES: TopUpPackage[] = [
    { id: 'topup_150', turns: 150, price: 500, displayPrice: '$5' },
    { id: 'topup_300', turns: 300, price: 1000, displayPrice: '$10' },
];

