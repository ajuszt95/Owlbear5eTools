export type RenderSegment =
    | { type: 'text'; content: string }
    | { type: 'roll'; content: string; formula: string; label: string };

/**
 * Renders 5e.tools markup into an array of segments (text or rollable).
 */
export function render5etoolsText(text: string): RenderSegment[] {
    if (!text) return [];

    const segments: RenderSegment[] = [];
    let lastIndex = 0;
    const tagRegex = /{@(\w+)(?:\s+([^}]+))?}/gi;
    let match;

    while ((match = tagRegex.exec(text)) !== null) {
        // Add preceding text
        if (match.index > lastIndex) {
            segments.push({ type: 'text', content: text.substring(lastIndex, match.index) });
        }

        const [_, tag, content] = match;
        const parts = (content || "").split('|');
        const rawValue = (parts[0] || "").trim();
        const lowTag = tag.toLowerCase();

        switch (lowTag) {
            case "atk":
            case "atkr": {
                const lowValue = rawValue.toLowerCase();
                let label = "Attack:";
                if (lowValue === "mw") label = "Melee Weapon Attack:";
                else if (lowValue === "rw") label = "Ranged Weapon Attack:";
                else if (lowValue === "ms") label = "Melee Spell Attack:";
                else if (lowValue === "rs") label = "Ranged Spell Attack:";
                else if (lowValue === "mw,rw") label = "Melee or Ranged Weapon Attack:";
                else if (lowValue === "ms,rs") label = "Melee or Ranged Spell Attack:";
                else if (lowValue === "m") label = "Melee Attack Roll:";
                else if (lowValue === "r") label = "Ranged Attack Roll:";
                segments.push({ type: 'text', content: label });
                break;
            }

            case "hit": {
                const hitVal = parseInt(rawValue);
                const display = isNaN(hitVal) ? rawValue : (hitVal >= 0 ? `+${hitVal}` : `${hitVal}`);
                segments.push({ 
                    type: 'roll', 
                    content: display, 
                    formula: `1d20${display}`, 
                    label: "Attack Roll" 
                });
                break;
            }

            case "dc":
                segments.push({ type: 'text', content: "DC " });
                segments.push({ 
                    type: 'roll', 
                    content: rawValue, 
                    formula: "1d20", 
                    label: `DC ${rawValue} Check` 
                });
                break;

            case "sav":
            case "actsave": {
                const attr = rawValue.split(' ')[0].toLowerCase();
                const savMap: Record<string, string> = {
                    str: "Strength", dex: "Dexterity", con: "Constitution",
                    int: "Intelligence", wis: "Wisdom", cha: "Charisma"
                };
                segments.push({ type: 'text', content: `${savMap[attr] || rawValue} Saving Throw:` });
                break;
            }

            case "h":
                segments.push({ type: 'text', content: "Hit: " });
                break;

            case "recharge":
                const rechargeDisplay = rawValue ? `(Recharge ${rawValue}\u20136)` : "(Recharge 6)";
                segments.push({ 
                    type: 'roll', 
                    content: rechargeDisplay, 
                    formula: "1d6", 
                    label: "Recharge" 
                });
                break;

            case "damage":
            case "scaledice":
            case "scaledamage":
            case "dice":
                segments.push({ 
                    type: 'roll', 
                    content: rawValue, 
                    formula: rawValue, 
                    label: "Roll" 
                });
                break;

            case "actsavefail": segments.push({ type: 'text', content: "Failure:" }); break;
            case "actsavesuccess": segments.push({ type: 'text', content: "Success:" }); break;
            case "actsavesuccessfail": segments.push({ type: 'text', content: "Failure or Success:" }); break;
            case "actsavefailby": segments.push({ type: 'text', content: "Failure by 5 or more:" }); break;
            case "miss": segments.push({ type: 'text', content: "Miss:" }); break;
            case "d20": segments.push({ type: 'roll', content: rawValue, formula: "1d20", label: "d20" }); break;

            default:
                segments.push({ type: 'text', content: rawValue || "" });
        }
        lastIndex = tagRegex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        segments.push({ type: 'text', content: text.substring(lastIndex) });
    }

    // Cleanup double spaces and trim individual segments if they represent text
    return segments.map(seg => {
        if (seg.type === 'text') {
            return { ...seg, content: seg.content.replace(/  +/g, ' ') };
        }
        return seg;
    });
}
