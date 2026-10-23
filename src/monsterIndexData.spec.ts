import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { searchMonsters, type MonsterIndexFile } from "./monsterIndex";
import { PARTNERED_HOMEBREW_SOURCES } from "./homebrewSources";

const indexPath = fileURLToPath(new URL("../public/data/monster-index.json", import.meta.url));
const data = JSON.parse(readFileSync(indexPath, "utf8")) as MonsterIndexFile;

describe("shipped monster index", () => {
    it("includes partnered homebrew monsters by exact source id", () => {
        expect(data.monsters).toContainEqual(
            expect.objectContaining({ n: "Swarm of Prismatic Beetles", s: "ToB1-2023" })
        );
        expect(data.monsters).toContainEqual(
            expect.objectContaining({ n: "Swarm of Giant Mosquitoes", s: "GriffonsSaddlebag2" })
        );
    });

    it("includes at least one record for every partnered source", () => {
        const present = new Set(data.monsters.map((m) => m.s.toLowerCase()));
        const missing = Object.keys(PARTNERED_HOMEBREW_SOURCES).filter((source) => !present.has(source));
        expect(missing).toEqual([]);
    });

    it("surfaces partnered monsters through the runtime search", () => {
        expect(searchMonsters(data.monsters, "prismatic beetles")).toContainEqual(
            expect.objectContaining({ n: "Swarm of Prismatic Beetles", s: "ToB1-2023" })
        );
        expect(searchMonsters(data.monsters, "giant mosquitoes")).toContainEqual(
            expect.objectContaining({ n: "Swarm of Giant Mosquitoes", s: "GriffonsSaddlebag2" })
        );
    });

    it("keeps meta.count in sync with the records", () => {
        expect(data.meta.count).toBe(data.monsters.length);
    });
});
