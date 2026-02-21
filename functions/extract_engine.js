const fs = require('fs');
const path = require('path');

const indexFile = path.join(__dirname, 'src', 'index.ts');
const gameEngineFile = path.join(__dirname, 'src', 'gameEngine.ts');

const indexContent = fs.readFileSync(indexFile, 'utf8');
const lines = indexContent.split('\n');

// Find processGameAction block in index.ts
let startIndex = -1;
let endIndex = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('export const processGameAction = onCall(')) {
        startIndex = i;
    }
    // Very naïve way to find the end of the `onCall` block, but given the structure we can look for `);` right before `// ==================== CAMPAIGN MANAGEMENT ====================`
    if (startIndex !== -1 && lines[i].includes('// ==================== CAMPAIGN MANAGEMENT ====================')) {
        // The end of the block is a few lines before this comment
        for (let j = i - 1; j > startIndex; j--) {
            if (lines[j].trim() === ');') {
                endIndex = j;
                break;
            }
        }
        break;
    }
}

if (startIndex === -1 || endIndex === -1) {
    console.error('Could not find processGameAction block', { startIndex, endIndex });
    process.exit(1);
}

const processGameActionBlock = lines.slice(startIndex, endIndex + 1).join('\n');


// Now replace the processGameAction block in gameEngine.ts
const geContent = fs.readFileSync(gameEngineFile, 'utf8');
const geLines = geContent.split('\n');

let geStartIndex = -1;
let geEndIndex = -1;

for (let i = 0; i < geLines.length; i++) {
    if (geLines[i].includes('export async function processGameAction(')) {
        geStartIndex = i;
    }
    // Find the end of processGameAction in gameEngine.ts
    // It's the last function in the file before the EOF
    if (geStartIndex !== -1 && geLines[i].startsWith('}')) {
        // Wait, it might not be the last. Let's look for the matching closing brace.
        // Actually, looking at the layout, let's just find the first `export async function processGameAction`
        // and replace everything from there to the end of the file, because processGameAction takes up the remainder of the file.
        // Or we can just do a regex replace if we know the bounds.
    }
}

// better approach for gameEngine.ts replacement
const boundaryComment = '// ==================== MAIN GAME ENGINE FUNCTION ====================';
const boundaryIndex = geLines.findIndex(line => line.includes(boundaryComment));

if (boundaryIndex === -1) {
    console.error('Could not find boundary in gameEngine.ts');
    process.exit(1);
}

// Keep everything before the boundary
const keptGeLines = geLines.slice(0, boundaryIndex + 1);

// We need to modify `processGameActionBlock` slightly because in gameEngine.ts it should not be an `onCall`
// It should be a standard async function that takes arguments, instead of the `request`.
// Actually, wait, it's easier to just export the `onCall` from `gameEngine.ts` and import it into `index.ts`.
// Let's modify gameEngine.ts to just export `processGameAction` as an onCall function.

let newProcessGameActionBlock = processGameActionBlock;
// We need to add the imports it needs to the top of gameEngine.ts
// But frankly, gameEngine.ts already imports everything.

const finalGeContent = keptGeLines.join('\n') + '\n\n' + newProcessGameActionBlock;
fs.writeFileSync(gameEngineFile, finalGeContent);

// And remove it from index.ts
const newIndexContent = [
    ...lines.slice(0, startIndex),
    ...lines.slice(endIndex + 1)
].join('\n');
fs.writeFileSync(indexFile, newIndexContent);

console.log('Successfully extracted processGameAction to gameEngine.ts');
