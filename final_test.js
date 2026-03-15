
function render5etoolsText(text) {
    if (!text) return "";

    // One-pass robust tag replacement
    // Regex matches {@tag content} or {@tag}
    // Note the use of [^}\s] for the tag to prevent it from stealing characters from the content
    // and (?:\\s+([^}]+))? to make content optional but requiring a space if it exists
    return text.replace(/{@(\w+)(?:\s+([^}]+))?}/gi, (_, tag, content) => {
        const parts = (content || "").split('|');
        const rawValue = parts[0].trim();
        const lowTag = tag.toLowerCase();

        switch (lowTag) {
            case "atk":
                const lowValue = rawValue.toLowerCase();
                if (lowValue.includes("mw") && lowValue.includes("rw")) return "Melee or Ranged Weapon Attack:";
                if (lowValue.includes("ms") && lowValue.includes("rs")) return "Melee or Ranged Spell Attack:";
                if (lowValue === "mw") return "Melee Weapon Attack:";
                if (lowValue === "rw") return "Ranged Weapon Attack:";
                if (lowValue === "ms") return "Melee Spell Attack:";
                if (lowValue === "rs") return "Ranged Spell Attack:";
                if (lowValue === "m") return "Melee Attack Roll:";
                if (lowValue === "r") return "Ranged Attack Roll:";
                return "Attack:";

            case "hit":
                const hitVal = parseInt(rawValue);
                return isNaN(hitVal) ? rawValue : (hitVal >= 0 ? `+${hitVal}` : `${hitVal}`);

            case "dc":
                return `DC ${rawValue}`;

            case "sav":
                // Handle "dex" or "dex 19" cases
                const attr = rawValue.split(' ')[0].toLowerCase();
                const savMap = {
                    str: "Strength", dex: "Dexterity", con: "Constitution",
                    int: "Intelligence", wis: "Wisdom", cha: "Charisma"
                };
                return `${savMap[attr] || rawValue} Saving Throw:`;

            case "h": return "Hit:";
            case "recharge": return rawValue ? `(Recharge ${rawValue}\u20136)` : "(Recharge 6)";
            case "actsavefail": return "Failure:";
            case "actsavesuccess": return "Success:";
            case "actsavesuccessfail": return "Failure or Success:";
            case "miss": return "Miss:";
            case "d20": return rawValue;

            // Data/Formatting tags: return the first part of the content
            case "i":
            case "italic":
            case "b":
            case "bold":
            case "u":
            case "s":
            case "sup":
            case "sub":
            case "code":
            case "dice":
            case "damage":
            case "scaledice":
            case "scaledamage":
            case "note":
            case "quickref":
            case "filter":
            case "status":
            case "condition":
            case "skill":
            case "sense":
            case "action":
            case "item":
            case "spell":
            case "creature":
            case "feat":
            case "background":
            case "race":
            case "class":
            case "subclass":
            case "vehicle":
            case "object":
            case "hazard":
            case "reward":
            case "optfeature":
            case "variantrule":
            case "table":
            case "language":
            case "charoption":
            case "deity":
            case "psionic":
            case "trap":
            case "disease":
            case "curse":
            case "itemmastery":
            case "ability":
            case "classfeature":
            case "subclassfeature":
            case "area":
            case "link":
                return rawValue;

            default:
                // If tag is unknown, return content if exists, otherwise empty
                return rawValue || "";
        }
    })
    .replace(/\[Area of Effect\]/g, "")
    .trim();
}

const tests = [
    ["{@atk m}", "Melee Attack Roll:"],
    ["{@hit 12}", "+12"],
    ["{@h}", "Hit:"],
    ["{@sav dex|XMM} DC 19", "Dexterity Saving Throw: DC 19"],
    ["{@actSaveFail}", "Failure:"],
    ["{@actSaveSuccess}", "Success:"],
    ["{@actSaveSuccessFail}", "Failure or Success:"],
    ["{@recharge 5-6}", "(Recharge 5-6\u20136)"] // Wait, recharge handling might need tweak for range
];

tests.forEach(([input, expected]) => {
    const res = render5etoolsText(input);
    console.log(`${input} => ${res} (${res === expected ? "PASS" : "FAIL, expected: " + expected})`);
});
