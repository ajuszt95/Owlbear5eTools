#!/usr/bin/env node
/**
 * Build-time monster index generator (issue #4).
 *
 * Fetches data/bestiary/index.json (source → filename map) from the
 * 5etools mirror, downloads each book JSON, and writes one compact record
 * per monster to public/data/monster-index.json:
 *   { meta: { builtAt, count }, monsters: [{ n, s, c, t, z }, ...] }
 *
 * Pure record builders (crToNumberJs / numberToCrJs / formatTypeJs /
 * monsterToRecord) mirror src/monsterIndex.ts — keep the two in sync.
 * They are exported for scripts/build-monster-index.spec.ts.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

export const MIRROR_DATA_BASE =
    "https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/bestiary";

export function crToNumberJs(cr) {
    if (cr === null || cr === undefined) return null;
    if (typeof cr === "number") return cr;
    if (typeof cr === "object") return crToNumberJs(cr.cr);
    if (typeof cr === "string") {
        const trimmed = cr.trim();
        if (trimmed === "1/8") return 0.125;
        if (trimmed === "1/4") return 0.25;
        if (trimmed === "1/2") return 0.5;
        const parsed = parseFloat(trimmed);
        return isNaN(parsed) ? null : parsed;
    }
    return null;
}

export function numberToCrJs(num) {
    if (num === 0.125) return "1/8";
    if (num === 0.25) return "1/4";
    if (num === 0.5) return "1/2";
    return String(num);
}

export function normalizeCrJs(cr) {
    const num = crToNumberJs(cr);
    return num === null ? "—" : numberToCrJs(num);
}

export function formatTypeJs(type) {
    if (!type) return "";
    if (typeof type === "string") return type;
    if (typeof type === "object") {
        const base = typeof type.type === "string" ? type.type : "";
        const tags = Array.isArray(type.tags) ? type.tags.filter((x) => typeof x === "string") : [];
        if (tags.length === 0) return base;
        return `${base} (${tags.join(", ")})`;
    }
    return "";
}

export function monsterToRecord(monster) {
    const sizeArr = Array.isArray(monster.size) ? monster.size : [];
    const first = typeof sizeArr[0] === "string" ? sizeArr[0].toUpperCase() : "M";
    return {
        n: monster.name,
        s: monster.source,
        c: normalizeCrJs(monster.cr),
        t: formatTypeJs(monster.type),
        z: first,
    };
}

function resolveIndexEntries(indexJson) {
    // Expected shape: { "MM": "bestiary-mm.json", ... } (~107 sources).
    // Tolerate a nested wrapper in case upstream changes the envelope.
    const candidate =
        indexJson && typeof indexJson === "object" && !Array.isArray(indexJson) && indexJson.index
            ? indexJson.index
            : indexJson;
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
        throw new Error("Unexpected index.json shape (expected source → filename map)");
    }
    return Object.entries(candidate).filter(([, v]) => typeof v === "string" && v.endsWith(".json"));
}

async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
    return res.json();
}

async function main() {
    console.log(`Fetching source map from ${MIRROR_DATA_BASE}/index.json ...`);
    const indexJson = await fetchJson(`${MIRROR_DATA_BASE}/index.json`);
    const entries = resolveIndexEntries(indexJson);
    console.log(`Found ${entries.length} sources.`);

    const monsters = [];
    for (const [source, filename] of entries) {
        const url = `${MIRROR_DATA_BASE}/${filename}`;
        try {
            const data = await fetchJson(url);
            const list = Array.isArray(data?.monster) ? data.monster : [];
            for (const m of list) {
                if (!m || typeof m.name !== "string" || typeof m.source !== "string") continue;
                monsters.push(monsterToRecord(m));
            }
            console.log(` - ${source} (${filename}): ${list.length} monsters`);
        } catch (err) {
            console.warn(` ! skipping ${source} (${filename}): ${err.message}`);
        }
    }

    // Deterministic output: sorted by name, then source.
    monsters.sort((a, b) => a.n.toLowerCase().localeCompare(b.n.toLowerCase()) || a.s.localeCompare(b.s));

    const out = {
        meta: { builtAt: new Date().toISOString(), count: monsters.length },
        monsters,
    };
    const outDir = path.join(root, "public", "data");
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, "monster-index.json");
    fs.writeFileSync(outPath, JSON.stringify(out) + "\n");
    const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
    console.log(`Wrote ${path.relative(root, outPath)}: ${out.meta.count} monsters, ${kb} KB`);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
    main().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
