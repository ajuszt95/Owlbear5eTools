import { describe, it, expect } from "vitest";
import { monsterToRecord, normalizeCrJs, formatTypeJs } from "./build-monster-index.mjs";

describe("build-monster-index record builders", () => {
    it("normalizes string and object CR forms", () => {
        expect(normalizeCrJs("1/4")).toBe("1/4");
        expect(normalizeCrJs({ cr: "1/2" })).toBe("1/2");
        expect(normalizeCrJs({ cr: "1/2", lair: "13" })).toBe("1/2");
        expect(normalizeCrJs(undefined)).toBe("—");
    });

    it("formats string and tagged object types", () => {
        expect(formatTypeJs("dragon")).toBe("dragon");
        expect(formatTypeJs({ type: "humanoid", tags: ["goblinoid"] })).toBe("humanoid (goblinoid)");
        expect(formatTypeJs({ type: "ooze" })).toBe("ooze");
        expect(formatTypeJs(undefined)).toBe("");
    });

    it("builds records from fixture bestiary entries incl. object-CR and missing fields", () => {
        const fixture = {
            monster: [
                { name: "Goblin", source: "MM", cr: "1/4", type: { type: "humanoid", tags: ["goblinoid"] }, size: ["S"] },
                { name: "Ancient Red Dragon", source: "MM", cr: { cr: "24", lair: "24" }, type: "dragon", size: ["G"] },
                { name: "Mystery", source: "HB" },
            ],
        };
        const records = fixture.monster.map(monsterToRecord);
        expect(records).toEqual([
            { n: "Goblin", s: "MM", c: "1/4", t: "humanoid (goblinoid)", z: "S" },
            { n: "Ancient Red Dragon", s: "MM", c: "24", t: "dragon", z: "G" },
            { n: "Mystery", s: "HB", c: "—", t: "", z: "M" },
        ]);
    });
});
