/**
 * Cleans 5e.tools internal markup tags (e.g., {@hit 5}, {@dc 14}) into human-readable text.
 * Aims for parity with the official 5e.tools display.
 */
export function render5etoolsText(text: string): string {
    if (!text) return "";

    return text
        // 1. Attack type tags — most specific first (combined types)
        .replace(/{@atk\s+mw,rw(?:\|[^}]*)?}/gi, "Melee or Ranged Weapon Attack:")
        .replace(/{@atk\s+ms,rs(?:\|[^}]*)?}/gi, "Melee or Ranged Spell Attack:")
        .replace(/{@atk\s+mw(?:\|[^}]*)?}/gi, "Melee Weapon Attack:")
        .replace(/{@atk\s+rw(?:\|[^}]*)?}/gi, "Ranged Weapon Attack:")
        .replace(/{@atk\s+ms(?:\|[^}]*)?}/gi, "Melee Spell Attack:")
        .replace(/{@atk\s+rs(?:\|[^}]*)?}/gi, "Ranged Spell Attack:")
        .replace(/{@atk\s+m(?:\|[^}]*)?}/gi, "Melee Attack Roll:")
        .replace(/{@atk\s+r(?:\|[^}]*)?}/gi, "Ranged Attack Roll:")
        // Catch-all for any remaining atk combos
        .replace(/{@atk\s+[^}]+}/gi, "Attack:")

        // 2. Roll/DC tags
        .replace(/{@hit\s+([-+]?\d+)(?:\|[^}]*)?}/gi, (_, p1) => {
            const num = parseInt(p1);
            return num >= 0 ? `+${num}` : num.toString();
        })
        .replace(/{@dc\s+(\d+)(?:\|[^}]*)?}/gi, "DC $1")
        .replace(/{@sav\s+(int|wis|cha|str|dex|con)(?:\|[^}]*)?}/gi, (_, p1) => {
            const map: Record<string, string> = {
                str: "Strength", dex: "Dexterity", con: "Constitution",
                int: "Intelligence", wis: "Wisdom", cha: "Charisma"
            };
            return `${map[p1.toLowerCase()] || p1} Saving Throw:`;
        })
        .replace(/{@d20\s+([-+]?\d+)(?:\|[^}]*)?}/gi, "$1")
        .replace(/{@h(?:\|[^}]*)?}/gi, "Hit:")
        .replace(/{@recharge\s+(\d+)(?:\|[^}]*)?}/gi, "(Recharge $1\u20136)")
        .replace(/{@recharge(?:\|[^}]*)?}/gi, "(Recharge 6)")

        // 3. Formatting tags
        .replace(/{@(?:i|italic)\s+([^}|]+)(?:\|[^}]*)?\}/gi, "$1")
        .replace(/{@(?:b|bold)\s+([^}|]+)(?:\|[^}]*)?\}/gi, "$1")
        .replace(/{@u\s+([^}|]+)(?:\|[^}]*)?\}/gi, "$1")
        .replace(/{@s\s+([^}|]+)(?:\|[^}]*)?\}/gi, "$1")
        .replace(/{@sup\s+([^}|]+)(?:\|[^}]*)?\}/gi, "$1")
        .replace(/{@sub\s+([^}|]+)(?:\|[^}]*)?\}/gi, "$1")
        .replace(/{@code\s+([^}|]+)(?:\|[^}]*)?\}/gi, "$1")

        // 4. Dice/damage
        .replace(/{@(?:dice|damage|scaledice|scaledamage)\s+([^|}]+)(?:\|[^}]*)?\}/gi, "$1")

        // 5. Notes/comments
        .replace(/{@note\s+([^}|]+)(?:\|[^}]*)?\}/gi, "$1")

        // 6. Quick reference / filter
        .replace(/{@(?:quickref|filter)\s+([^|}]+)(?:\|[^}]*)?\}/gi, "$1")

        // 7. Status/Condition/Skill/Sense...
        .replace(/{@(?:status|condition|skill|sense|action|item|spell|creature|feat|background|race|class|subclass|vehicle|object|hazard|reward|optfeature|variantrule|table|language|charoption|deity|psionic|trap|disease|curse|itemMastery|ability|classFeature|subclassFeature)\s+([^|}]+)(?:\|[^}]*)?\}/gi, "$1")

        // 8. Area tags
        .replace(/{@area\s+([^|}]+)(?:\|[^}]*)?\}/gi, "$1")

        // 9. Special action results
        .replace(/{@actSaveFail(?:\|[^}]*)?}/gi, "Failure:")
        .replace(/{@actSaveSuccess(?:\|[^}]*)?}/gi, "Success:")
        .replace(/{@actSaveSuccessFail(?:\|[^}]*)?}/gi, "Failure or Success:")

        // 10. Hit/miss results
        .replace(/{@miss(?:\|[^}]*)?}/gi, "Miss:")

        // 11. Generic catch-all
        .replace(/{@\w+\s+([^|}]+)(?:\|[^}]*)?\}/gi, "$1")

        // 12. Final cleanup — remove any leftover empty tags or lone braces
        .replace(/{@[^}]*}/g, "")

        // 13. Manual cleanup of known artifact strings
        .replace(/\[Area of Effect\]/g, "")
        .replace(/\|XPHB/g, "")
        .replace(/\|P[a-z]+/gi, "") // Remove common source tags like |PHB, |PHB2024

        // Final trim
        .trim();
}
