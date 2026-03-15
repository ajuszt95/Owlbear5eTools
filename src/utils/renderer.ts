/**
 * Cleans 5e.tools internal markup tags (e.g., {@hit 5}, {@dc 14}) into human-readable text.
 * Aims for parity with the official 5e.tools display.
 */
export function render5etoolsText(text: string): string {
    if (!text) return "";

    // One-pass robust tag replacement
    return text.replace(/{@(\w+)(?:\s+([^}]+))?}/gi, (_, tag, content) => {
        const parts = (content || "").split('|');
        const rawValue = (parts[0] || "").trim();
        const lowTag = tag.toLowerCase();

        switch (lowTag) {
            case "atk":
            case "atkr":
                const lowValue = rawValue.toLowerCase();
                // Specific 5e.tools mappings
                if (lowValue === "mw") return "Melee Weapon Attack:";
                if (lowValue === "rw") return "Ranged Weapon Attack:";
                if (lowValue === "ms") return "Melee Spell Attack:";
                if (lowValue === "rs") return "Ranged Spell Attack:";
                if (lowValue === "mw,rw") return "Melee or Ranged Weapon Attack:";
                if (lowValue === "ms,rs") return "Melee or Ranged Spell Attack:";
                if (lowValue === "m") return "Melee Attack Roll:";
                if (lowValue === "r") return "Ranged Attack Roll:";
                return "Attack:";

            case "hit":
                const hitVal = parseInt(rawValue);
                return isNaN(hitVal) ? rawValue : (hitVal >= 0 ? `+${hitVal}` : `${hitVal}`);

            case "dc":
                return `DC ${rawValue}`;

            case "sav":
            case "actsave":
                const attr = rawValue.split(' ')[0].toLowerCase();
                const savMap: Record<string, string> = {
                    str: "Strength", dex: "Dexterity", con: "Constitution",
                    int: "Intelligence", wis: "Wisdom", cha: "Charisma"
                };
                return `${savMap[attr] || rawValue} Saving Throw:`;

            case "h": return "Hit: ";
            case "recharge": return rawValue ? `(Recharge ${rawValue}\u20136)` : "(Recharge 6)";
            case "actsavefail": return "Failure:";
            case "actsavesuccess": return "Success:";
            case "actsavesuccessfail": return "Failure or Success:";
            case "actsavefailby": return "Failure by 5 or more:";
            case "miss": return "Miss:";
            case "d20": return rawValue;

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
                return rawValue || "";
        }
    }).replace(/  +/g, ' ').trim();
}
