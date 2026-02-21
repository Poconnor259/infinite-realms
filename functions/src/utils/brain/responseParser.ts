import { BrainResponseSchema } from './types';

export function repairJsonResponse(raw: string): object | null {
    console.log('[Brain] Attempting JSON repair with multiple strategies...');

    // Strategy 1: Try to find complete JSON object with stateUpdates
    const patterns = [
        /\{[\s\S]*"stateUpdates"[\s\S]*"narrativeCues"[\s\S]*\}/,
        /\{[\s\S]*"narrativeCues"[\s\S]*"diceRolls"[\s\S]*\}/,
        /\{[\s\S]*"narrativeCue"[\s\S]*\}/,
    ];

    for (const pattern of patterns) {
        const match = raw.match(pattern);
        if (match) {
            try {
                const parsed = JSON.parse(match[0]);
                console.log('[Brain] Repair successful with pattern match');
                return parsed;
            } catch {
                // Continue to next pattern
            }
        }
    }

    // Strategy 2: Try to extract just the first complete object
    const firstBrace = raw.indexOf('{');
    if (firstBrace !== -1) {
        let braceCount = 0;
        let inString = false;
        let escapeNext = false;

        for (let i = firstBrace; i < raw.length; i++) {
            const char = raw[i];

            if (escapeNext) {
                escapeNext = false;
                continue;
            }

            if (char === '\\') {
                escapeNext = true;
                continue;
            }

            if (char === '"') {
                inString = !inString;
                continue;
            }

            if (!inString) {
                if (char === '{') braceCount++;
                if (char === '}') braceCount--;

                if (braceCount === 0) {
                    const extracted = raw.substring(firstBrace, i + 1);
                    try {
                        const parsed = JSON.parse(extracted);
                        console.log('[Brain] Repair successful with brace matching');
                        return parsed;
                    } catch {
                        break;
                    }
                }
            }
        }
    }

    console.log('[Brain] All repair strategies failed');
    return null;
}

export function parseBrainResponse(content: string) {
    // Extract JSON from markdown code blocks if present (for non-JSON mode models)
    let jsonText = content.trim();
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
        jsonText = codeBlockMatch[1].trim();
    }
    jsonText = jsonText.trim();

    // Parse and validate response
    let parsed: any;
    try {
        parsed = JSON.parse(jsonText);
    } catch (parseError) {
        console.error('[Brain] Failed to parse JSON, attempting repair...', parseError);

        // Try to repair JSON by extracting valid objects
        const repaired = repairJsonResponse(jsonText);
        if (repaired) {
            console.log('[Brain] Successfully repaired JSON response');
            parsed = repaired;
        } else {
            console.error('[Brain] JSON repair failed. Original content:', content.substring(0, 500));
            return {
                success: false,
                error: 'Invalid JSON response from Brain (repair failed)',
            };
        }
    }

    // Normalizations
    if (parsed.narrativeCues) {
        if (typeof parsed.narrativeCues === 'string') {
            parsed.narrativeCues = [{ type: 'description', content: parsed.narrativeCues }];
        } else if (Array.isArray(parsed.narrativeCues)) {
            parsed.narrativeCues = parsed.narrativeCues.map((cue: any) => {
                if (typeof cue === 'string') {
                    return { type: 'description', content: cue };
                }
                return cue;
            });
        }
    }
    if (parsed.systemMessages && typeof parsed.systemMessages === 'string') {
        parsed.systemMessages = [parsed.systemMessages];
    }

    const validated = BrainResponseSchema.safeParse(parsed);

    let finalData: any;
    if (!validated.success) {
        console.warn('Brain response validation failed, attempting robust recovery:', validated.error.message);
        finalData = {
            stateUpdates: parsed.stateUpdates || {},
            narrativeCues: Array.isArray(parsed.narrativeCues) ? parsed.narrativeCues : [],
            narrativeCue: parsed.narrativeCue || '',
            diceRolls: Array.isArray(parsed.diceRolls) ? parsed.diceRolls : [],
            systemMessages: Array.isArray(parsed.systemMessages) ? parsed.systemMessages : [],
            requiresUserInput: !!parsed.requiresUserInput,
            pendingChoice: parsed.pendingChoice || undefined,
            pendingRoll: parsed.pendingRoll ? {
                ...parsed.pendingRoll,
                type: parsed.pendingRoll.type || 'd20'
            } : undefined,
        };
    } else {
        finalData = validated.data;
    }

    if (!String(finalData.narrativeCue || '').trim() && finalData.narrativeCues.length > 0) {
        finalData.narrativeCue = finalData.narrativeCues
            .map((c: any) => typeof c === 'string' ? c : (c.content || ''))
            .join(' ')
            .trim();
    }

    if (!String(finalData.narrativeCue || '').trim()) {
        finalData.narrativeCue = 'The action was processed.';
    }

    return { success: true, data: finalData };
}
