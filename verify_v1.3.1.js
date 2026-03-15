
function render5etoolsText(text) {
    if (!text) return "";

    return text.replace(/{@(\w+)(?:\s+([^}]+))?}/gi, (_, tag, content) => {
        const parts = (content || "").split('|');
        const rawValue = parts[0].trim();
        const lowTag = tag.toLowerCase();

        switch (lowTag) {
            case "atk":
            case "atkr":
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
            case "actsave":
                const attr = rawValue.split(' ')[0].toLowerCase();
                const savMap = {
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

            default:
                return rawValue || "";
        }
    }).trim();
}

console.log("XMM Rend: " + render5etoolsText("{@atkr m} {@hit 12}, reach 10 ft. {@h}16"));
console.log("XMM Breath: " + render5etoolsText("{@actSave dex|XMM} {@dc 19} {@actSaveFail}"));
console.log("XMM Success: " + render5etoolsText("{@actSaveSuccess} Half damage."));
