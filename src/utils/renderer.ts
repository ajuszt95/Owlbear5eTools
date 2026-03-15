/**
 * Cleans 5e.tools internal markup tags (e.g., {@hit 5}, {@dc 14}) into human-readable text.
 * Aims for parity with the official 5e.tools display.
 */
export function render5etoolsText(text: string): string {
    if (!text) return "";

    // Use a single regex pass to find all {@tag content|pipe|...} blocks
    return text.replace(/{@(\w+)\s*([^}]+)}/gi, (_, tag, content) => {
        const parts = content.split('|');
        const rawValue = parts[0].trim();

        switch (tag.toLowerCase()) {
            case "atk":
                switch (rawValue) {
                    case "mw,rw": return "Melee or Ranged Weapon Attack:";
                    case "ms,rs": return "Melee or Ranged Spell Attack:";
                    case "mw": return "Melee Weapon Attack:";
                    case "rw": return "Ranged Weapon Attack:";
                    case "ms": return "Melee Spell Attack:";
                    case "rs": return "Ranged Spell Attack:";
                    case "m": return "Melee Attack Roll:";
                    case "r": return "Ranged Attack Roll:";
                    default: return "Attack:";
                }

            case "hit":
                const hitNum = parseInt(rawValue);
                return hitNum >= 0 ? `+${hitNum}` : hitNum.toString();

            case "dc":
                return `DC ${rawValue}`;

            case "sav":
                const savMap: Record<string, string> = {
                    str: "Strength", dex: "Dexterity", con: "Constitution",
                    int: "Intelligence", wis: "Wisdom", cha: "Charisma"
                };
                return `${savMap[rawValue.toLowerCase()] || rawValue} Saving Throw:`;

            case "d20":
                return rawValue;

            case "h":
                return "Hit:";

            case "recharge":
                return rawValue ? `(Recharge ${rawValue}\u20136)` : "(Recharge 6)";

            case "actsavefail":
                return "Failure:";

            case "actsavesuccess":
                return "Success:";

            case "actsavesuccessfail":
                return "Failure or Success:";

            case "miss":
                return "Miss:";

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
                return rawValue;

            default:
                // Generic catch-all: return the first part
                return rawValue;
        }
    })
    // Final cleanup of leftover braces or common artifacts
    .replace(/{@[^}]*}/g, "")
    .replace(/\[Area of Effect\]/g, "")
    .trim();
}
