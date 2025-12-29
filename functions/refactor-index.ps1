# PowerShell script to refactor index.ts
$filePath = "src/index.ts"
$content = Get-Content $filePath -Raw

# Step 1: Update imports
$content = $content -replace 'import \{ processWithBrain \} from ''\.\/brain'';', ''
$content = $content -replace 'import \{ generateNarrative \} from ''\.\/voice'';', ''
$content = $content -replace 'import \{ initPromptHelper, seedAIPrompts, getStateReviewerSettings \} from ''\.\/promptHelper'';', 'import { initPromptHelper, seedAIPrompts } from ''./promptHelper'';'
$content = $content -replace 'import \{ reviewStateConsistency, applyCorrections \} from ''\.\/stateReviewer'';', ''

# Add new import after the stripe import
$content = $content -replace "(import \{ createCheckoutSession, handleStripeWebhook \} from '\.\/stripe';)", "`$1`r`nimport { processGameAction as processGameActionCore, GameRequest, GameResponse } from './gameEngine';"

# Step 2: Replace type definitions with re-exports
$typePattern = '(?s)interface GameRequest \{.*?\}\r?\n\r?\ninterface GameResponse \{.*?\}'
$typeReplacement = "// Types are now exported from gameEngine.ts`r`n// Re-export for backwards compatibility`r`nexport type { GameRequest, GameResponse } from './gameEngine';"
$content = $content -replace $typePattern, $typeReplacement

# Step 3: Remove helper functions
$content = $content -replace '(?s)function getProviderFromModel\(.*?\n\}\r?\n', ''
$content = $content -replace '(?s)const MODEL_ID_MAP: Record<.*?\n\};\r?\n', ''
$content = $content -replace '(?s)function resolveModelConfig\(.*?\n\}\r?\n', ''

# Step 4: Replace processGameAction function
# Find the function and replace it with wrapper
$functionPattern = '(?s)export const processGameAction = onCall\(\s*\{ cors: true, invoker: ''public'' \},\s*async \(request\): Promise<GameResponse> => \{.*?^\);'
$functionReplacement = @"
export const processGameAction = onCall(
    { cors: true, invoker: 'public' },
    async (request): Promise<GameResponse> => {
        const secrets = await getApiKeys();
        return processGameActionCore(request.data, db, request.auth, secrets);
    }
);
"@

$content = $content -replace $functionPattern, $functionReplacement

# Save the file
$content | Set-Content $filePath -NoNewline

Write-Host "Refactoring complete!"
