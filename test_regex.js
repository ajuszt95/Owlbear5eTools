
function render5etoolsText(text) {
    if (!text) return "";

    return text
        // 1. Attack type tags
        .replace(/{@atk\s+mw,rw(?:\|[^}]*)?}/gi, "Melee or Ranged Weapon Attack:")
        .replace(/{@atk\s+ms,rs(?:\|[^}]*)?}/gi, "Melee or Ranged Spell Attack:")
        .replace(/{@atk\s+mw(?:\|[^}]*)?}/gi, "Melee Weapon Attack:")
        .replace(/{@atk\s+rw(?:\|[^}]*)?}/gi, "Ranged Weapon Attack:")
        .replace(/{@atk\s+ms(?:\|[^}]*)?}/gi, "Melee Spell Attack:")
        .replace(/{@atk\s+rs(?:\|[^}]*)?}/gi, "Ranged Spell Attack:")
        .replace(/{@atk\s+m(?:\|[^}]*)?}/gi, "Melee Attack Roll:")
        .replace(/{@atk\s+r(?:\|[^}]*)?}/gi, "Ranged Attack Roll:")
        .replace(/{@atk\s+[^}]+}/gi, "Attack:")

        // 2. Roll/DC tags
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
        .replace(/{@d20\s+([-+]?\d+)(?:\|[^}]*)?}/gi, "$1")
        .replace(/{@h(?:\|[^}]*)?}/gi, "Hit:")
        .replace(/{@recharge\s+(\d+)(?:\|[^}]*)?}/gi, "(Recharge $1\u20136)")
        .replace(/{@recharge(?:\|[^}]*)?}/gi, "(Recharge 6)")

        // Catch-all
        .replace(/{@\w+\s+([^|}]+)(?:\|[^}]*)?\}/gi, "$1")
        .trim();
}

const tests = [
    "{@atk m|XMM}",
    "{@atk mw|XMM}",
    "{@atk r}",
    "{@sav dex|XMM}",
    "{@sav str}",
    "{@hit 12|XMM}",
    "{@dc 19|XMM}",
    "{@actSaveSuccessFail|XMM}" 
];

tests.forEach(t => {
    console.log(`${t} => ${render5etoolsText(t)}`);
});
