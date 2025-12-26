/**
 * HWFWM Essences - Full list from He Who Fights With Monsters
 * https://he-who-fights-with-monsters.fandom.com/wiki/Essences
 */

export interface Essence {
    name: string;
    rarity: 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';
    category: 'Animal' | 'Element' | 'Object' | 'Concept' | 'Body';
    description?: string;
}

// Organized by category for better UX
export const ESSENCES: Essence[] = [
    // === COMMON - Animals ===
    { name: 'Ape', rarity: 'Common', category: 'Animal' },
    { name: 'Bat', rarity: 'Common', category: 'Animal' },
    { name: 'Bear', rarity: 'Common', category: 'Animal' },
    { name: 'Bee', rarity: 'Common', category: 'Animal' },
    { name: 'Bird', rarity: 'Common', category: 'Animal' },
    { name: 'Cat', rarity: 'Common', category: 'Animal' },
    { name: 'Cattle', rarity: 'Common', category: 'Animal' },
    { name: 'Crocodile', rarity: 'Common', category: 'Animal' },
    { name: 'Deer', rarity: 'Common', category: 'Animal' },
    { name: 'Dog', rarity: 'Common', category: 'Animal' },
    { name: 'Duck', rarity: 'Common', category: 'Animal' },
    { name: 'Fish', rarity: 'Common', category: 'Animal' },
    { name: 'Flea', rarity: 'Common', category: 'Animal' },
    { name: 'Fox', rarity: 'Common', category: 'Animal' },
    { name: 'Frog', rarity: 'Common', category: 'Animal' },
    { name: 'Goat', rarity: 'Common', category: 'Animal' },
    { name: 'Horse', rarity: 'Common', category: 'Animal' },
    { name: 'Lizard', rarity: 'Common', category: 'Animal' },
    { name: 'Locust', rarity: 'Common', category: 'Animal' },
    { name: 'Monkey', rarity: 'Common', category: 'Animal' },
    { name: 'Mouse', rarity: 'Common', category: 'Animal' },
    { name: 'Octopus', rarity: 'Common', category: 'Animal' },
    { name: 'Pangolin', rarity: 'Common', category: 'Animal' },
    { name: 'Rabbit', rarity: 'Common', category: 'Animal' },
    { name: 'Rat', rarity: 'Common', category: 'Animal' },
    { name: 'Shark', rarity: 'Common', category: 'Animal' },
    { name: 'Skunk', rarity: 'Common', category: 'Animal' },
    { name: 'Sloth', rarity: 'Common', category: 'Animal' },
    { name: 'Snake', rarity: 'Common', category: 'Animal' },
    { name: 'Spider', rarity: 'Common', category: 'Animal' },
    { name: 'Turtle', rarity: 'Common', category: 'Animal' },
    { name: 'Wasp', rarity: 'Common', category: 'Animal' },
    { name: 'Whale', rarity: 'Common', category: 'Animal' },
    { name: 'Wolf', rarity: 'Common', category: 'Animal' },

    // === COMMON - Elements ===
    { name: 'Air', rarity: 'Common', category: 'Element' },
    { name: 'Earth', rarity: 'Common', category: 'Element' },
    { name: 'Fire', rarity: 'Common', category: 'Element' },
    { name: 'Water', rarity: 'Common', category: 'Element' },
    { name: 'Plant', rarity: 'Common', category: 'Element' },
    { name: 'Fungus', rarity: 'Common', category: 'Element' },
    { name: 'Coral', rarity: 'Common', category: 'Element' },
    { name: 'Tree', rarity: 'Common', category: 'Element' },
    { name: 'Iron', rarity: 'Common', category: 'Element' },

    // === COMMON - Objects ===
    { name: 'Armour', rarity: 'Common', category: 'Object' },
    { name: 'Axe', rarity: 'Common', category: 'Object' },
    { name: 'Bow', rarity: 'Common', category: 'Object' },
    { name: 'Cage', rarity: 'Common', category: 'Object' },
    { name: 'Chain', rarity: 'Common', category: 'Object' },
    { name: 'Cloth', rarity: 'Common', category: 'Object' },
    { name: 'Fork', rarity: 'Common', category: 'Object' },
    { name: 'Hammer', rarity: 'Common', category: 'Object' },
    { name: 'Hook', rarity: 'Common', category: 'Object' },
    { name: 'Knife', rarity: 'Common', category: 'Object' },
    { name: 'Needle', rarity: 'Common', category: 'Object' },
    { name: 'Net', rarity: 'Common', category: 'Object' },
    { name: 'Paper', rarity: 'Common', category: 'Object' },
    { name: 'Rake', rarity: 'Common', category: 'Object' },
    { name: 'Sceptre', rarity: 'Common', category: 'Object' },
    { name: 'Shield', rarity: 'Common', category: 'Object' },
    { name: 'Ship', rarity: 'Common', category: 'Object' },
    { name: 'Shovel', rarity: 'Common', category: 'Object' },
    { name: 'Sickle', rarity: 'Common', category: 'Object' },
    { name: 'Spear', rarity: 'Common', category: 'Object' },
    { name: 'Spike', rarity: 'Common', category: 'Object' },
    { name: 'Staff', rarity: 'Common', category: 'Object' },
    { name: 'Sword', rarity: 'Common', category: 'Object' },
    { name: 'Thread', rarity: 'Common', category: 'Object' },
    { name: 'Trap', rarity: 'Common', category: 'Object' },
    { name: 'Trowel', rarity: 'Common', category: 'Object' },
    { name: 'Vehicle', rarity: 'Common', category: 'Object' },
    { name: 'Wheel', rarity: 'Common', category: 'Object' },
    { name: 'Whip', rarity: 'Common', category: 'Object' },

    // === COMMON - Body Parts ===
    { name: 'Eye', rarity: 'Common', category: 'Body' },
    { name: 'Foot', rarity: 'Common', category: 'Body' },
    { name: 'Hair', rarity: 'Common', category: 'Body' },
    { name: 'Hand', rarity: 'Common', category: 'Body' },
    { name: 'Tooth', rarity: 'Common', category: 'Body' },

    // === COMMON - Concepts ===
    { name: 'Adept', rarity: 'Common', category: 'Concept' },
    { name: 'Feast', rarity: 'Common', category: 'Concept' },
    { name: 'Hunt', rarity: 'Common', category: 'Concept' },
    { name: 'Might', rarity: 'Common', category: 'Concept' },
    { name: 'Swift', rarity: 'Common', category: 'Concept' },

    // === UNCOMMON ===
    { name: 'Balance', rarity: 'Uncommon', category: 'Concept' },
    { name: 'Blood', rarity: 'Uncommon', category: 'Body' },
    { name: 'Bone', rarity: 'Uncommon', category: 'Body' },
    { name: 'Claw', rarity: 'Uncommon', category: 'Body' },
    { name: 'Cloud', rarity: 'Uncommon', category: 'Element' },
    { name: 'Cold', rarity: 'Uncommon', category: 'Element' },
    { name: 'Dance', rarity: 'Uncommon', category: 'Concept' },
    { name: 'Dark', rarity: 'Uncommon', category: 'Element' },
    { name: 'Growth', rarity: 'Uncommon', category: 'Concept' },
    { name: 'Hunger', rarity: 'Uncommon', category: 'Concept' },
    { name: 'Light', rarity: 'Uncommon', category: 'Element' },
    { name: 'Omen', rarity: 'Uncommon', category: 'Concept' },
    { name: 'Potent', rarity: 'Uncommon', category: 'Concept' },
    { name: 'Renewal', rarity: 'Uncommon', category: 'Concept' },
    { name: 'Rune', rarity: 'Uncommon', category: 'Concept' },
    { name: 'Wing', rarity: 'Uncommon', category: 'Body' },
    { name: 'Wind', rarity: 'Uncommon', category: 'Element' },
    { name: 'Gun', rarity: 'Uncommon', category: 'Object' },
    { name: 'Technology', rarity: 'Uncommon', category: 'Object' },

    // === RARE ===
    { name: 'Death', rarity: 'Rare', category: 'Concept' },
    { name: 'Magic', rarity: 'Rare', category: 'Concept' },
    { name: 'Sin', rarity: 'Rare', category: 'Concept' },
    { name: 'Void', rarity: 'Rare', category: 'Element' },

    // === EPIC ===
    { name: 'Dimension', rarity: 'Epic', category: 'Concept' },
    { name: 'Doom', rarity: 'Epic', category: 'Concept' },
    { name: 'Soul', rarity: 'Epic', category: 'Concept' },
    { name: 'Time', rarity: 'Epic', category: 'Concept' },

    // === LEGENDARY ===
    { name: 'Absolution', rarity: 'Legendary', category: 'Concept' },
    { name: 'Apocalypse', rarity: 'Legendary', category: 'Concept' },
];

// Get essences by rarity
export const getEssencesByRarity = (rarity: Essence['rarity']) =>
    ESSENCES.filter(e => e.rarity === rarity);

// Get essences by category
export const getEssencesByCategory = (category: Essence['category']) =>
    ESSENCES.filter(e => e.category === category);

// Get rarity color
export const getRarityColor = (rarity: Essence['rarity']): string => {
    switch (rarity) {
        case 'Common': return '#9CA3AF'; // Gray
        case 'Uncommon': return '#22C55E'; // Green
        case 'Rare': return '#3B82F6'; // Blue
        case 'Epic': return '#A855F7'; // Purple
        case 'Legendary': return '#F59E0B'; // Gold/Orange
        default: return '#9CA3AF';
    }
};

// Grouped for dropdown display
export const ESSENCE_GROUPS = [
    { label: 'Common', essences: getEssencesByRarity('Common') },
    { label: 'Uncommon', essences: getEssencesByRarity('Uncommon') },
    { label: 'Rare', essences: getEssencesByRarity('Rare') },
    { label: 'Epic', essences: getEssencesByRarity('Epic') },
    { label: 'Legendary', essences: getEssencesByRarity('Legendary') },
];
