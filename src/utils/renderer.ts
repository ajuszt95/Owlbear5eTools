/**
 * Cleans 5e.tools internal markup tags (e.g., {@hit 5}, {@dc 14}) into human-readable text.
 * Aims for parity with the official 5e.tools display.
 */
export function render5etoolsText(text: string): string {
    if (!text) return "";

    return text
        // 1. Attack type tags
        .replace(/{@atk mw}/g, "Melee Weapon Attack:")
        .replace(/{@atk rw}/g, "Ranged Weapon Attack:")
        .replace(/{@atk m}/g, "Melee Attack:")
        .replace(/{@atk r}/g, "Ranged Attack:")
        .replace(/{@atk ms}/g, "Melee Spell Attack:")
        .replace(/{@atk rs}/g, "Ranged Spell Attack:")
        
        // 2. Roll/DC tags
        .replace(/{@hit ([-+]?\d+)}/g, (_, p1) => {
            const num = parseInt(p1);
            return num >= 0 ? `+${num}` : num.toString();
        })
        .replace(/{@dc (\d+)}/g, "DC $1")
        .replace(/{@d20 ([-+]?\d+)}/g, "$1")
        .replace(/{@h}/g, "Hit:")
        .replace(/{@recharge (\d+)}/g, "(Recharge $1–6)") // En-dash for range
        .replace(/{@recharge}/g, "(Recharge 6)")
        
        // 3. Formatting tags
        .replace(/{@i ([^}]+)}/g, "*$1*")
        .replace(/{@b ([^}]+)}/g, "**$1**")
        .replace(/{@u ([^}]+)}/g, "$1")
        .replace(/{@s ([^}]+)}/g, "$1")

        // 4. Status/Condition/Skill/Sense - handle piped values: {@condition blinded|PHB}
        // Take the first part before any | if it's there, otherwise just the content
        .replace(/{@(status|condition|skill|sense|dice|damage|atk|link|area|action|item|spell|creature|skill|feat|background|race) ([^}|]+)(?:\|[^}]+)?}/g, "$2")
        
        // 5. Special cases like {@actSaveFail} or {@actSaveSuccess}
        .replace(/{@actSaveFail}/g, "Failure:")
        .replace(/{@actSaveSuccess}/g, "Success:")
        
        // 6. Generic catch-all for any remaining {@tag content|...}
        .replace(/{@\w+ ([^}|]+)(?:\|[^}]+)?}/g, "$1")
        
        // 7. Manual cleanup of known artifact strings
        .replace(/\[Area of Effect\]/g, "")
        .replace(/\|XPHB/g, "")
        .replace(/\|P[a-z]+/gi, "") // Remove common source tags like |PHB, |PHB2024
        
        // Final trim
        .trim();
}
