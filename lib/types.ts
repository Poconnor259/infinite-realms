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
        debug?: {
            brainResponse?: any;
            stateReport?: any;
            reviewerResult?: any;
            models?: {
                brain: string;
                voice: string;
            };
        };
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
    type: 'text' | 'textarea' | 'select' | 'multiselect' | 'number' | 'slider' | 'checkbox' | 'image' | 'statPicker';
    label: string;
    required: boolean;
    options?: { value: string; label: string }[];  // For select/multiselect
    placeholder?: string;

    // Validation
    validation?: {
        minLength?: number;
        maxLength?: number;
        min?: number;      // For number/slider
        max?: number;
        pattern?: string;  // Regex for text validation
    };

    // UX Enhancements
    helpText?: string;         // Shown below field
    dependsOn?: {              // Conditional display
        field: string;
        value: any;
    };
    defaultValue?: any;
    aiGeneratable?: boolean;   // Show AI generate button (for text/textarea)
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
        stamina: number;
        recovery: number;
    };
    abilities: OutworlderAbility[];
    stamina: {
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
    cost: 'mana' | 'health' | 'stamina' | 'none';
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
    nanites?: {
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

export type SubscriptionTier = 'scout' | 'adventurer' | 'hero' | 'legendary';

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
    preferredModels?: {
        brain?: string;
        voice?: string;
    };
    showSuggestedChoices?: boolean; // Default: true - Show AI-suggested choices for ambiguous inputs
    isAnonymous?: boolean;
    createdAt: number;
    role?: 'user' | 'admin';
    turns?: number; // Remaining turn balance for weighted turn economy
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
    id: 'topup_750' | 'topup_1500';
    turns: number;
    price: number; // In cents
    displayPrice: string;
    priceId?: string;
}

export const DEFAULT_SUBSCRIPTION_LIMITS: Record<SubscriptionTier, number> = {
    scout: 50,
    adventurer: 1500,
    hero: 4500,
    legendary: Infinity, // BYOK = unlimited
};

export const DEFAULT_SUBSCRIPTION_PRICING: Record<SubscriptionTier, { price: number; displayPrice: string; priceId?: string }> = {
    scout: { price: 0, displayPrice: 'Free' },
    adventurer: { price: 999, displayPrice: '$9.99/month', priceId: 'price_1Sj2flKYDhEuBvZw2mxvmxzZ' }, // sub_adventurer
    hero: { price: 2999, displayPrice: '$29.99/month', priceId: 'price_1Sj2o7KYDhEuBvZwAACQIHSv' }, // sub_hero
    legendary: { price: 3999, displayPrice: '$39.99 one-time', priceId: 'price_1Sj3AFKYDhEuBvZwvhdEZRjA' }, // ot_legendary
};

export const DEFAULT_TOP_UP_PACKAGES: TopUpPackage[] = [
    { id: 'topup_750', turns: 750, price: 499, displayPrice: '$4.99', priceId: 'price_1Sj374KYDhEuBvZwdo8htCVx' },
    { id: 'topup_1500', turns: 1500, price: 999, displayPrice: '$9.99', priceId: 'price_1Sj388KYDhEuBvZwsryc5wTj' },
];

// Default model permissions per tier
// Scout: Gemini Flash only (1 turn/action)
// Adventurer & Hero: All models (Gemini Flash 1 turn, Sonnet 4 turns, Opus 20 turns)
// Legendary: All models (unlimited with BYOK)
export const DEFAULT_SUBSCRIPTION_PERMISSIONS: Record<SubscriptionTier, { allowedModels: string[] }> = {
    scout: { allowedModels: ['gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-2.0-flash-exp'] },
    adventurer: { allowedModels: ['gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-2.0-flash-exp', 'claude-3-5-sonnet-20241022', 'claude-opus-4-20250514'] },
    hero: { allowedModels: ['gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-2.0-flash-exp', 'claude-3-5-sonnet-20241022', 'claude-opus-4-20250514'] },
    legendary: { allowedModels: ['gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-2.0-flash-exp', 'claude-3-5-sonnet-20241022', 'claude-opus-4-20250514', 'gpt-4o', 'gpt-4o-mini'] },
};

export interface ModelDefinition {
    id: string;
    name: string;
    provider: 'openai' | 'anthropic' | 'google';
    contextWindow?: number; // Context window size in tokens
    defaultPricing?: {
        prompt: number; // Cost per 1M tokens
        completion: number;
    };
}

export const AVAILABLE_MODELS: ModelDefinition[] = [
    // OpenAI Models
    {
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        defaultPricing: { prompt: 2.50, completion: 10.00 }
    },
    {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'openai',
        defaultPricing: { prompt: 0.15, completion: 0.60 }
    },
    {
        id: 'o1-preview',
        name: 'o1 Preview',
        provider: 'openai',
        defaultPricing: { prompt: 15.00, completion: 60.00 }
    },
    {
        id: 'o1-mini',
        name: 'o1 Mini',
        provider: 'openai',
        defaultPricing: { prompt: 3.00, completion: 12.00 }
    },

    // Anthropic Models
    {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet (New)',
        provider: 'anthropic',
        defaultPricing: { prompt: 3.00, completion: 15.00 }
    },
    {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        provider: 'anthropic',
        defaultPricing: { prompt: 1.00, completion: 5.00 } // Approx
    },
    {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        provider: 'anthropic',
        defaultPricing: { prompt: 15.00, completion: 75.00 }
    },

    // Google Gemini Models
    {
        id: 'gemini-3-flash-preview',
        name: 'Gemini 3.0 Flash (Preview)',
        provider: 'google',
        contextWindow: 2000000, // 2M+ context window
        defaultPricing: { prompt: 0.20, completion: 0.80 }
    },
    {
        id: 'gemini-2.0-flash-exp',
        name: 'Gemini 2.0 Flash (Exp)',
        provider: 'google',
        defaultPricing: { prompt: 0.00, completion: 0.00 } // Free during preview often
    },
    {
        id: 'gemini-1.5-pro-002',
        name: 'Gemini 1.5 Pro (002)',
        provider: 'google',
        defaultPricing: { prompt: 1.25, completion: 5.00 } // Lowered recently?
    },
    {
        id: 'gemini-1.5-flash-002',
        name: 'Gemini 1.5 Flash (002)',
        provider: 'google',
        defaultPricing: { prompt: 0.075, completion: 0.30 }
    },
    {
        id: 'gemini-1.5-flash-8b',
        name: 'Gemini 1.5 Flash-8B',
        provider: 'google',
        defaultPricing: { prompt: 0.0375, completion: 0.15 }
    }
];

export interface GlobalConfig {
    subscriptionLimits: Record<SubscriptionTier, number>;
    subscriptionPermissions: Record<SubscriptionTier, { allowedModels: string[] }>;
    subscriptionPricing: Record<SubscriptionTier, { price: number; displayPrice: string }>;
    topUpPackages: TopUpPackage[];
    worldModules: Record<string, { enabled: boolean }>; // Keyed by module ID
    systemSettings: {
        maintenanceMode: boolean;
        newRegistrationsOpen: boolean;
        debugLogging: boolean;
        showAdminDebug: boolean; // Show AI state reports in campaign for admins
        narratorWordLimitMin: number; // Minimum word count for narrator (default: 150)
        narratorWordLimitMax: number; // Maximum word count for narrator (default: 250)
        enableContextCaching: boolean; // Enable Anthropic context caching (default: true)
        enableHeartbeatSystem: boolean; // Enable cache keep-alive heartbeat (default: true)
        heartbeatIdleTimeout: number; // Minutes before heartbeat stops (default: 15)
    };
}

