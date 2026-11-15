import { describe, it, expect } from "vitest";
import {
    applyMonsterCopy,
    resolveMonsterCopy,
    type MonsterData,
    type MonsterTemplate,
} from "./monsterCopy";

function baseMonster(overrides: MonsterData = {}): MonsterData {
    return {
        name: "Adult Red Dragon",
        source: "MM",
        cr: "17",
        hp: { average: 256, formula: "19d12 + 133" },
        ac: [19],
        size: ["H"],
        str: 27,
        dex: 10,
        con: 25,
        int: 16,
        wis: 13,
        cha: 21,
        senses: ["blindsight 60 ft.", "darkvision 120 ft."],
        resist: ["fire"],
        action: [
            { name: "Multiattack", entries: ["The dragon can use its Frightful Presence."] },
            { name: "Bite", entries: ["{@atk mw} {@hit 14} to hit. {@h}19 (2d10 + 8) piercing damage."] },
        ],
        ...overrides,
    };
}

function copyMonster(overrides: MonsterData = {}): MonsterData {
    return {
        name: "Adult Amonkhet Dragon",
        source: "PSA",
        _copy: { name: "Adult Red Dragon", source: "MM" },
        ...overrides,
    };
}

describe("applyMonsterCopy", () => {
    it("inherits the base stat block and drops the _copy marker", () => {
        const result = applyMonsterCopy(baseMonster(), copyMonster());

        expect(result.name).toBe("Adult Amonkhet Dragon");
        expect(result.source).toBe("PSA");
        expect(result.hp).toEqual({ average: 256, formula: "19d12 + 133" });
        expect(result.ac).toEqual([19]);
        expect(result._copy).toBeUndefined();
        expect(result._isCopy).toBe(true);
        // The base entry must not be mutated.
        expect(baseMonster()._isCopy).toBeUndefined();
    });

    it("does not inherit metadata that requires _preserve", () => {
        const base = baseMonster({ page: 10, hasToken: true, srd: true });
        const result = applyMonsterCopy(base, copyMonster());

        expect(result.page).toBeUndefined();
        expect(result.hasToken).toBeUndefined();
        expect(result.srd).toBeUndefined();
    });

    it("honours _preserve for metadata fields", () => {
        const base = baseMonster({ page: 10, hasToken: true, srd: true });
        const result = applyMonsterCopy(
            base,
            copyMonster({
                _copy: { name: "Adult Red Dragon", source: "MM", _preserve: { hasToken: true } },
            })
        );

        expect(result.hasToken).toBe(true);
        expect(result.page).toBeUndefined();
        expect(result.srd).toBeUndefined();
    });

    it("appends, replaces and removes array entries", () => {
        const result = applyMonsterCopy(
            baseMonster(),
            copyMonster({
                _copy: {
                    name: "Adult Red Dragon",
                    source: "MM",
                    _mod: {
                        action: [
                            { mode: "removeArr", names: ["Multiattack"] },
                            {
                                mode: "replaceArr",
                                replace: { name: "Bite" },
                                items: [{ name: "Bite", entries: ["Replaced bite."] }],
                            },
                            { mode: "appendArr", items: [{ name: "Tail", entries: ["Tail attack."] }] },
                        ],
                        resist: { mode: "appendIfNotExistsArr", items: ["fire", "necrotic"] },
                    },
                },
            })
        );

        expect((result.action as Array<{ name: string; entries: string[] }>).map((entry) => entry.name)).toEqual(["Bite", "Tail"]);
        expect((result.action as Array<{ name: string; entries: string[] }>)[0].entries).toEqual(["Replaced bite."]);
        expect(result.resist).toEqual(["fire", "necrotic"]);
    });

    it("renames array entries", () => {
        const result = applyMonsterCopy(
            baseMonster(),
            copyMonster({
                _copy: {
                    name: "Adult Red Dragon",
                    source: "MM",
                    _mod: { action: { mode: "renameArr", renames: [{ rename: "Bite", with: "Bite (Fire)" }] } },
                },
            })
        );

        expect((result.action as Array<{ name: string; entries: string[] }>).map((entry) => entry.name)).toEqual(["Multiattack", "Bite (Fire)"]);
    });

    it("applies setProp, addSenses, addSkills and replaceTxt without touching inline tags", () => {
        const result = applyMonsterCopy(
            baseMonster(),
            copyMonster({
                _copy: {
                    name: "Adult Red Dragon",
                    source: "MM",
                    _mod: {
                        _: [
                            { mode: "setProp", prop: "srd", value: true },
                            { mode: "addSenses", senses: [{ type: "darkvision", range: 180 }, { type: "tremorsense", range: 30 }] },
                            { mode: "addSkills", skills: { stealth: 1 } },
                        ],
                        "*": { mode: "replaceTxt", replace: "dragon", with: "dracolich" },
                    },
                },
            })
        );

        expect(result.srd).toBe(true);
        expect(result.senses).toEqual(["blindsight 60 ft.", "darkvision 180 ft.", "tremorsense 30 ft."]);
        // CR 17 -> PB 6, Dex 10 -> +0
        expect((result.skill as Record<string, string>).stealth).toBe("+6");
        expect((result.action as Array<{ name: string; entries: string[] }>)[0].entries[0]).toBe("The dracolich can use its Frightful Presence.");
        expect((result.action as Array<{ name: string; entries: string[] }>)[1].entries[0]).toBe(
            "{@atk mw} {@hit 14} to hit. {@h}19 (2d10 + 8) piercing damage."
        );
        // Names are not part of the default replaceTxt target set.
        expect(result.name).toBe("Adult Amonkhet Dragon");
    });

    it("applies templates and resolves <$variable$> placeholders", () => {
        const template: MonsterTemplate = {
            name: "Amonkhet Dragon",
            source: "PSA",
            apply: {
                _root: { size: ["G"], type: { type: "dragon" } },
                _mod: {
                    trait: {
                        mode: "appendArr",
                        items: [{ name: "Desert Walk", entries: ["<$title_short_name$> ignores difficult terrain."] }],
                    },
                },
            },
        };

        const result = applyMonsterCopy(
            baseMonster(),
            copyMonster({ _copy: { name: "Adult Red Dragon", source: "MM", _templates: [{ name: "Amonkhet Dragon", source: "PSA" }] } }),
            [template]
        );

        expect(result.size).toEqual(["G"]);
        expect(result.type).toEqual({ type: "dragon" });
        expect((result.trait as Array<{ entries: string[] }>)[0].entries[0]).toBe("Adult Amonkhet Dragon ignores difficult terrain.");
    });
});

describe("resolveMonsterCopy", () => {
    const catalogue = new Map<string, MonsterData>([
        ["adult red dragon|mm", baseMonster()],
        [
            "young red dragon|mm",
            baseMonster({
                name: "Young Red Dragon",
                cr: "10",
                hp: { average: 178, formula: "17d12 + 68" },
                _copy: { name: "Adult Red Dragon", source: "MM" },
            }),
        ],
    ]);

    const loadMonster = async (name: string, source: string) =>
        catalogue.get(`${name.toLowerCase()}|${source.toLowerCase()}`);

    it("resolves a multi-step _copy chain", async () => {
        const result = await resolveMonsterCopy(
            {
                name: "Amonkhet Hatchling",
                source: "PSA",
                _copy: { name: "Young Red Dragon", source: "MM" },
            },
            { loadMonster }
        );

        expect(result.name).toBe("Amonkhet Hatchling");
        expect(result.hp).toEqual({ average: 178, formula: "17d12 + 68" });
        expect((result.action as Array<{ name: string; entries: string[] }>).length).toBe(2);
        expect(result._copy).toBeUndefined();
    });

    it("leaves the entry untouched when the base is missing", async () => {
        const result = await resolveMonsterCopy(
            { name: "Orphan", source: "PSA", hp: { average: 1 }, _copy: { name: "Nobody", source: "MM" } },
            { loadMonster }
        );

        expect(result.name).toBe("Orphan");
        expect(result.hp).toEqual({ average: 1 });
        expect(result._copy).toBeDefined();
    });

    it("does not recurse forever on cyclic references", async () => {
        const cyclic = new Map<string, MonsterData>([
            ["a|x", { name: "A", source: "X", _copy: { name: "B", source: "X" } }],
            ["b|x", { name: "B", source: "X", _copy: { name: "A", source: "X" } }],
        ]);
        const result = await resolveMonsterCopy(
            { name: "A", source: "X", _copy: { name: "B", source: "X" } },
            {
                loadMonster: async (name, source) => cyclic.get(`${name.toLowerCase()}|${source.toLowerCase()}`),
                maxDepth: 5,
            }
        );

        expect(result.name).toBe("A");
    });
});
