import * as admin from 'firebase-admin';

interface NormalizedAbility {
    name: string;
    type?: string;
    description?: string;
    [key: string]: any;
}

function normalizeAbilities(char: any): NormalizedAbility[] {
    const abilities: NormalizedAbility[] = [];

    // Standard abilities array
    if (Array.isArray(char.abilities)) {
        for (const ability of char.abilities) {
            let normalized: NormalizedAbility | null = null;

            if (ability && typeof ability === 'object') {
                normalized = {
                    name: ability.name || 'Unknown Ability',
                    type: ability.type,
                    description: ability.description,
                    // Copy other fields if needed, but for cleanup main focus is dedupe
                    ...ability
                };
            } else if (typeof ability === 'string') {
                // Try to parse "Name [Type] - Description" format
                // Example: "AUTO-LOOT [utility] - Magically harvest..."
                const complexMatch = ability.match(/^(.+?)\s*\[(.+?)\]\s*-\s*(.+)$/);

                if (complexMatch) {
                    normalized = {
                        name: complexMatch[1].trim(),
                        type: complexMatch[2].trim(),
                        description: complexMatch[3].trim(),
                    };
                } else {
                    normalized = {
                        name: ability,
                    };
                }
            }

            if (normalized) {
                const newNameLower = normalized.name.toLowerCase().trim();

                // Find existing match
                const existingIndex = abilities.findIndex(a => {
                    const existingLower = a.name.toLowerCase().trim();
                    return existingLower === newNameLower || existingLower.includes(newNameLower) || newNameLower.includes(existingLower);
                });

                if (existingIndex === -1) {
                    // No match, add it
                    abilities.push(normalized);
                } else {
                    // Match found, check if new one is "better"
                    const existing = abilities[existingIndex];

                    // Criteria for better:
                    // 1. Has type/description when existing doesn't
                    // 2. Name is longer (usually implies more detail or correct formatting like "Name [Type]")
                    const newHasMoreData = (normalized.type && !existing.type) || (normalized.description && !existing.description);
                    const newIsLonger = normalized.name.length > existing.name.length;

                    // If existing is just the short name and new is complex string parsed, strictly prefer new
                    const existingIsSimple = !existing.type && !existing.description;

                    if (newHasMoreData || (existingIsSimple && newIsLonger)) {
                        abilities[existingIndex] = normalized;
                    }
                }
            }
        }
    }
    return abilities;
}

export async function performCleanup(db: admin.firestore.Firestore) {
    console.log('Starting ability cleanup...');

    // Process Campaigns
    const campaignsSnapshot = await db.collection('campaigns').get();
    console.log(`Found ${campaignsSnapshot.size} campaigns to check.`);

    let validCampaigns = 0;
    let updatedCampaigns = 0;
    const results: any[] = [];

    for (const doc of campaignsSnapshot.docs) {
        const data = doc.data();
        if (data.state && data.state.abilities && Array.isArray(data.state.abilities)) {
            const originalCount = data.state.abilities.length;
            const cleanedAbilities = normalizeAbilities(data.state);
            const newCount = cleanedAbilities.length;

            // Check if changes are needed
            if (originalCount !== newCount || JSON.stringify(data.state.abilities) !== JSON.stringify(cleanedAbilities)) {
                const oldNames = data.state.abilities.map((a: any) => typeof a === 'string' ? a : a.name);
                const newNames = cleanedAbilities.map(a => a.name);

                const logMsg = `Updating campaign ${doc.id}: ${originalCount} -> ${newCount}`;
                console.log(logMsg);
                results.push({
                    id: doc.id,
                    originalCount,
                    newCount,
                    originalNames: oldNames,
                    newNames: newNames
                });

                await doc.ref.update({
                    'state.abilities': cleanedAbilities
                });
                updatedCampaigns++;
            }
            validCampaigns++;
        }
    }

    return {
        success: true,
        checked: validCampaigns,
        updated: updatedCampaigns,
        details: results
    };
}
