import { describe, expect, it } from "vitest";
import { PARTNERED_HOMEBREW_SOURCES, getPartneredHomebrewUrl } from "./homebrewSources";

describe("homebrewSources", () => {
    it("resolves a partnered source id case-insensitively", () => {
        expect(getPartneredHomebrewUrl("ToB1-2023")).toBe(
            "https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/creature/Kobold%20Press%3B%20Tome%20of%20Beasts%201%20(2023%20Edition).json"
        );
    });

    it("returns undefined for official sources", () => {
        expect(getPartneredHomebrewUrl("MM")).toBeUndefined();
    });

    it("keeps every registry key lowercase and pointing at a JSON file", () => {
        for (const [source, path] of Object.entries(PARTNERED_HOMEBREW_SOURCES)) {
            expect(source).toBe(source.toLowerCase());
            expect(path.endsWith(".json")).toBe(true);
        }
    });
});
