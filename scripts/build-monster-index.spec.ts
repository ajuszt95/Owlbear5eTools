import { describe, it, expect } from "vitest";
import {
    monsterToRecord,
    normalizeCrJs,
    formatTypeJs,
    collectMonsterRecords,
    loadHomebrewRegistry,
    homebrewUrlFor,
    assertIndexComplete,
} from "./build-monster-index.mjs";
import { getPartneredHomebrewUrl } from "../src/homebrewSources";

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

describe("collectMonsterRecords", () => {
    it("skips invalid entries and dedupes case-insensitively by name+source across calls", () => {
        const seen = new Set<string>();
        const first = collectMonsterRecords([
            { name: "Goblin", source: "MM", cr: "1/4", type: "humanoid", size: ["S"] },
            { name: "Mystery", source: "HB" },
            null,
            { name: 42, source: "MM" },
            { name: "Missing source" },
        ], seen);
        const second = collectMonsterRecords([
            { name: "Goblin", source: "MM", cr: "1/4", type: "humanoid", size: ["S"] },
            { name: "Goblin", source: "mm", cr: "1/4", type: "humanoid", size: ["S"] },
            { name: "Swarm of Prismatic Beetles", source: "ToB1-2023", cr: "3", type: "beast", size: ["M"] },
        ], seen);

        expect(first).toEqual([
            { n: "Goblin", s: "MM", c: "1/4", t: "humanoid", z: "S" },
            { n: "Mystery", s: "HB", c: "—", t: "", z: "M" },
        ]);
        expect(second).toEqual([
            { n: "Swarm of Prismatic Beetles", s: "ToB1-2023", c: "3", t: "beast", z: "M" },
        ]);
        expect(seen.size).toBe(3);
    });
});

describe("index completeness guard", () => {
    it("throws and names every failed source", () => {
        expect(() => assertIndexComplete(["tob1-2023: 500", "partner fleemortals: timeout"])).toThrow(/tob1-2023/);
        expect(() => assertIndexComplete(["tob1-2023: 500", "partner fleemortals: timeout"])).toThrow(/fleemortals/);
    });

    it("allows a complete build", () => {
        expect(() => assertIndexComplete([])).not.toThrow();
    });
});

describe("partnered homebrew registry", () => {
    it("includes Tome of Beasts 1 (2023) and Griffon's Saddlebag Book 2", () => {
        const registry = loadHomebrewRegistry();
        expect(registry.sources["tob1-2023"]).toContain("Tome of Beasts 1");
        expect(registry.sources["griffonssaddlebag2"]).toContain("Griffon's Saddlebag, Book 2");
    });

    it("builds the same URL as the runtime resolver for every source", () => {
        const registry = loadHomebrewRegistry();
        for (const [source, relativePath] of Object.entries(registry.sources)) {
            expect(homebrewUrlFor(registry.rawBase, relativePath)).toBe(getPartneredHomebrewUrl(source));
        }
    });
});
