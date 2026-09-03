import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    searchMonsters,
    loadMonsterIndex,
    clearMonsterIndexCache,
    MonsterIndexError,
    monsterToIndexEntry,
    normalizeCrForIndex,
    formatTypeForIndex,
    formatMonsterEntrySubtitle,
    type MonsterIndexEntry,
} from "./monsterIndex";

const sample: MonsterIndexEntry[] = [
    { n: "Goblin", s: "MM", c: "1/4", t: "humanoid (goblinoid)", z: "S" },
    { n: "Goblin Boss", s: "MM", c: "1", t: "humanoid (goblinoid)", z: "S" },
    { n: "Hobgoblin", s: "MM", c: "1/2", t: "humanoid (goblinoid)", z: "M" },
    { n: "Ancient Red Dragon", s: "MM", c: "24", t: "dragon", z: "G" },
    { n: "Redcap", s: "VGM", c: "3", t: "fey", z: "S" },
];

describe("searchMonsters", () => {
    it("returns empty for queries shorter than 2 chars", () => {
        expect(searchMonsters(sample, "")).toEqual([]);
        expect(searchMonsters(sample, "g")).toEqual([]);
        expect(searchMonsters(sample, " ")).toEqual([]);
    });

    it("ranks prefix matches before substring matches", () => {
        const results = searchMonsters(sample, "goblin");
        expect(results.map((r) => r.n)).toEqual(["Goblin", "Goblin Boss", "Hobgoblin"]);
    });

    it("is case-insensitive and trims whitespace", () => {
        expect(searchMonsters(sample, "  GOBLIN  ").length).toBe(3);
    });

    it("caps results at the limit (default 50)", () => {
        const big: MonsterIndexEntry[] = Array.from({ length: 60 }, (_, i) => ({
            n: `Goblin Test ${String(i).padStart(2, "0")}`,
            s: "MM",
            c: "1/4",
            t: "humanoid",
            z: "S",
        }));
        const results = searchMonsters(big, "goblin");
        expect(results).toHaveLength(50);
    });

    it("respects a custom limit", () => {
        expect(searchMonsters(sample, "goblin", 1)).toHaveLength(1);
    });
});

describe("loadMonsterIndex", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        clearMonsterIndexCache();
        global.fetch = vi.fn() as unknown as typeof fetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
        clearMonsterIndexCache();
    });

    it("loads and caches the index", async () => {
        (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ meta: { builtAt: "2026-09-02", count: 1 }, monsters: [sample[0]] }),
        });
        const first = await loadMonsterIndex();
        expect(first).toHaveLength(1);
        // Second call serves the in-memory cache without another fetch.
        const second = await loadMonsterIndex();
        expect(second).toBe(first);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("throws a typed error on corrupt JSON shape", async () => {
        (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ monsters: [{ nope: true }] }),
        });
        await expect(loadMonsterIndex()).rejects.toBeInstanceOf(MonsterIndexError);
    });

    it("throws a typed error when the file is missing", async () => {
        (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: false,
            status: 404,
        });
        const err = await loadMonsterIndex().catch((e) => e);
        expect(err).toBeInstanceOf(MonsterIndexError);
        expect((err as MonsterIndexError).code).toBe("missing");
    });
});

describe("index record builders", () => {
    it("normalizes string and object CR forms", () => {
        expect(normalizeCrForIndex("1/4")).toBe("1/4");
        expect(normalizeCrForIndex({ cr: "1/2" })).toBe("1/2");
        expect(normalizeCrForIndex({ cr: "1/2", lair: "13" })).toBe("1/2");
        expect(normalizeCrForIndex(undefined)).toBe("—");
    });

    it("formats string and tagged object types", () => {
        expect(formatTypeForIndex("dragon")).toBe("dragon");
        expect(formatTypeForIndex({ type: "humanoid", tags: ["goblinoid"] })).toBe("humanoid (goblinoid)");
        expect(formatTypeForIndex({ type: "ooze" })).toBe("ooze");
        expect(formatTypeForIndex(undefined)).toBe("");
    });

    it("builds records with object-CR and missing fields", () => {
        expect(
            monsterToIndexEntry({ name: "Goblin", source: "MM", cr: { cr: "1/4" }, type: { type: "humanoid", tags: ["goblinoid"] }, size: ["S"] })
        ).toEqual({ n: "Goblin", s: "MM", c: "1/4", t: "humanoid (goblinoid)", z: "S" });
        expect(monsterToIndexEntry({ name: "Mystery", source: "HB" })).toEqual({
            n: "Mystery",
            s: "HB",
            c: "—",
            t: "",
            z: "M",
        });
    });
});

describe("formatMonsterEntrySubtitle", () => {
    it("renders source, CR, type, and full size name", () => {
        expect(
            formatMonsterEntrySubtitle({ n: "Goblin", s: "MM", c: "1/4", t: "humanoid (goblinoid)", z: "S" })
        ).toBe("MM · CR 1/4 · humanoid (goblinoid) · Small");
    });

    it("omits unknown CR and empty type instead of dangling separators", () => {
        expect(formatMonsterEntrySubtitle({ n: "Mystery", s: "HB", c: "—", t: "", z: "M" })).toBe("HB · Medium");
    });

    it("passes unknown size codes through untouched", () => {
        expect(formatMonsterEntrySubtitle({ n: "X", s: "HB", c: "1", t: "", z: "X" })).toBe("HB · CR 1 · X");
    });
});
