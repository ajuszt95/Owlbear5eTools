
const fs = require('fs');
const content = fs.readFileSync('src/utils/renderer.ts', 'utf8');

// Extract the function body
const functionMatch = content.match(/export function render5etoolsText\(text: string\): string {([\s\S]*?)^}/m);
if (!functionMatch) {
    console.error("Could not find function body");
    process.exit(1);
}

const functionBody = functionMatch[1]
    .replace('return text', 'let output = text')
    .replace(/;/g, ';\n')
    .replace(/\s*\)\s*\./g, ').')
    .replace(/\.replace/g, 'output = output.replace');

const render5etoolsText = new Function('text', `
    if (!text) return "";
    ${functionBody}
    return output;
`);

const testStrings = [
    "{@atk m} {@hit 12}, reach 10 ft.",
    "{@sav dex|XMM} DC 19, each creature",
    "{@sav str|XMM} DC 19, each creature",
    "{@atk mw} {@hit 12}",
    "{@actSaveSuccessFail|XMM}"
];

testStrings.forEach(s => {
    console.log(`Original: ${s}`);
    console.log(`Rendered: ${render5etoolsText(s)}`);
    console.log("---");
});
