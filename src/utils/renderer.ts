/**
 * Cleans 5e.tools internal markup tags (e.g., {@hit 5}, {@dc 14}) into human-readable text.
 * Aims for parity with the official 5e.tools display.
 */
export function render5etoolsText(text: string): string {
    if (!text) return "";

    return text
        // 1. Attack type tags — most specific first (combined types)
        .replace(/{@atk mw,rw}/g, "Melee or Ranged Weapon Attack:")
        .replace(/{@atk ms,rs}/g, "Melee or Ranged Spell Attack:")
        .replace(/{@atk mw}/g, "Melee Weapon Attack:")
        .replace(/{@atk rw}/g, "Ranged Weapon Attack:")
        .replace(/{@atk ms}/g, "Melee Spell Attack:")
        .replace(/{@atk rs}/g, "Ranged Spell Attack:")
        .replace(/{@atk m}/g, "Melee Attack:")
        .replace(/{@atk r}/g, "Ranged Attack:")
        // Catch-all for any remaining atk combos like mw,rw,ms,rs
        .replace(/{@atk [^}]+}/g, "Attack:")

        // 2. Roll/DC tags
        .replace(/{@hit ([-+]?\d+)}/g, (_, p1) => {
            const num = parseInt(p1);
            return num >= 0 ? `+${num}` : num.toString();
        })
        .replace(/{@dc (\d+)}/g, "DC $1")
        .replace(/{@d20 ([-+]?\d+)}/g, "$1")
        .replace(/{@h}/g, "Hit:")
        .replace(/{@recharge (\d+)}/g, "(Recharge $1\u20136)") // En-dash for range
        .replace(/{@recharge}/g, "(Recharge 6)")

        // 3. Formatting tags
        .replace(/{@i ([^}]+)}/g, "$1")
        .replace(/{@italic ([^}]+)}/g, "$1")
        .replace(/{@b ([^}]+)}/g, "$1")
        .replace(/{@bold ([^}]+)}/g, "$1")
        .replace(/{@u ([^}]+)}/g, "$1")
        .replace(/{@s ([^}]+)}/g, "$1")
        .replace(/{@sup ([^}]+)}/g, "$1")
        .replace(/{@sub ([^}]+)}/g, "$1")
        .replace(/{@code ([^}]+)}/g, "$1")

        // 4. Dice/damage — take the display formula (before any |)
        .replace(/{@(?:dice|damage|scaledice|scaledamage) ([^|}]+)(?:\|[^}]*)?\}/g, "$1")

        // 5. Notes/comments — keep content, strip tag wrapper
        .replace(/{@note ([^}]+)}/g, "$1")

        // 6. Quick reference / filter — keep only the display text (first segment before |)
        .replace(/{@quickref ([^|}]+)(?:\|[^}]*)?\}/g, "$1")
        .replace(/{@filter ([^|}]+)(?:\|[^}]*)?\}/g, "$1")

        // 7. Status/Condition/Skill/Sense — handle piped values: {@condition blinded|PHB}
        // Take the display text (first part before any |)
        .replace(/{@(?:status|condition|skill|sense|action|item|spell|creature|feat|background|race|class|subclass|vehicle|object|hazard|reward|optfeature|variantrule|table|language|charoption|deity|psionic|trap|disease|curse|itemMastery|ability|classFeature|subclassFeature) ([^|}]+)(?:\|[^}]*)?\}/g, "$1")

        // 8. Area tags — display just the type/description
        .replace(/{@area ([^|}]+)(?:\|[^}]*)?\}/g, "$1")

        // 9. Special action results
        .replace(/{@actSaveFail}/g, "Failure:")
        .replace(/{@actSaveSuccess}/g, "Success:")

        // 10. Hit/miss results
        .replace(/{@miss}/g, "Miss:")

        // 11. Generic catch-all for any remaining {@tag content|...}
        // Takes the first non-@ word after the tag name as display text
        .replace(/{@\w+ ([^|}]+)(?:\|[^}]*)?\}/g, "$1")

        // 12. Final cleanup — remove any leftover empty tags or lone braces
        .replace(/{@[^}]*}/g, "")

        // 13. Manual cleanup of known artifact strings
        .replace(/\[Area of Effect\]/g, "")
        .replace(/\|XPHB/g, "")
        .replace(/\|P[a-z]+/gi, "") // Remove common source tags like |PHB, |PHB2024

        // Final trim
        .trim();
}
