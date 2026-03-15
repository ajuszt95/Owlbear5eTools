
function render5etoolsText(text) {
    if (!text) return "";

    let res = text
        .replace(/{@atk\s+mw,rw(?:\|[^}]*)?}/gi, "Melee or Ranged Weapon Attack:")
        .replace(/{@atk\s+ms,rs(?:\|[^}]*)?}/gi, "Melee or Ranged Spell Attack:")
        .replace(/{@atk\s+mw(?:\|[^}]*)?}/gi, "Melee Weapon Attack:")
        .replace(/{@atk\s+rw(?:\|[^}]*)?}/gi, "Ranged Weapon Attack:")
        .replace(/{@atk\s+ms(?:\|[^}]*)?}/gi, "Melee Spell Attack:")
        .replace(/{@atk\s+rs(?:\|[^}]*)?}/gi, "Ranged Spell Attack:")
        .replace(/{@atk\s+m(?:\|[^}]*)?}/gi, "Melee Attack Roll:")
        .replace(/{@atk\s+r(?:\|[^}]*)?}/gi, "Ranged Attack Roll:")
        .replace(/{@atk\s+[^}]+}/gi, "Attack:")
        
        .replace(/{@hit\s+([-+]?\d+)(?:\|[^}]*)?}/gi, (_, p1) => {
            const num = parseInt(p1);
            return num >= 0 ? `+${num}` : num.toString();
        })
        .replace(/{@dc\s+(\d+)(?:\|[^}]*)?}/gi, "DC $1")
        .replace(/{@sav\s+(int|wis|cha|str|dex|con)(?:\|[^}]*)?}/gi, (_, p1) => {
            const map = {
                str: "Strength", dex: "Dexterity", con: "Constitution",
                int: "Intelligence", wis: "Wisdom", cha: "Charisma"
            };
            return `${map[p1.toLowerCase()] || p1} Saving Throw:`;
        })
        
        .replace(/{@\w+\s+([^|}]+)(?:\|[^}]*)?\}/gi, "$1");
        
    return res;
}

console.log("Test 1: " + render5etoolsText("{@atk m} {@hit 12}"));
console.log("Test 2: " + render5etoolsText("{@sav dex|XMM} DC 19"));
console.log("Test 3: " + render5etoolsText("{@sav str|XMM} DC 19"));
