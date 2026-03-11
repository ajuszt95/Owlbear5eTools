/**
 * Cleans 5e.tools internal markup tags (e.g., {@hit 5}, {@dc 14}) into human-readable text.
 */
export function render5etoolsText(text: string): string {
    if (!text) return "";

    return text
        // 1. Specific common tags
        .replace(/{@hit ([-+]?\d+)}/g, "$1")
        .replace(/{@dc (\d+)}/g, "DC $1")
        .replace(/{@d20 ([-+]?\d+)}/g, "$1")
        .replace(/{@h}/g, "Hit:")
        .replace(/{@recharge (\d+)}/g, "(Recharge $1-6)")
        .replace(/{@recharge}/g, "(Recharge 6)")
        
        // 2. Bold/Italic (just removing tags for now, keep content)
        .replace(/{@i ([^}]+)}/g, "$1")
        .replace(/{@b ([^}]+)}/g, "$1")
        .replace(/{@u ([^}]+)}/g, "$1")
        .replace(/{@s ([^}]+)}/g, "$1")

        // 3. Status/Condition/Skill/Sense - handle piped values: {@condition blinded|PHB}
        // Take the first part before any |
        .replace(/{@(status|condition|skill|sense|dice|damage|atk|link|area|action|item|spell|creature|skill|feat|background|race) ([^}|]+)(?:\|[^}]+)?}/g, "$2")
        
        // 4. Special cases like {@actSaveFail} or {@actSaveSuccess}
        .replace(/{@actSaveFail}/g, "Failure:")
        .replace(/{@actSaveSuccess}/g, "Success:")
        
        // 5. General catch-all for any remaining {@tag content|...}
        .replace(/{@\w+ ([^}|]+)(?:\|[^}]+)?}/g, "$1")
        
        // 6. Cleanup any remaining artifacts
        .replace(/\[Area of Effect\]/g, "")
        .replace(/\|XPHB/g, "")
        .replace(/\|P[a-z]+/gi, "") // Remove common source tags like |PHB, |PHB2024
        
        // Final trim
        .trim();
}
