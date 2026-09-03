import { crToNumber, numberToCr } from "./utils/scaleCreature";

/** One compact record per monster. Field names are short to keep the shipped JSON small. */
export interface MonsterIndexEntry {
    /** Display name, e.g. "Goblin" */
    n: string;
    /** Source book code, e.g. "MM" */
    s: string;
    /** Normalized CR display string, e.g. "1/4" (or "—" when unknown) */
    c: string;
    /** Type display string, e.g. "humanoid (goblinoid)" */
    t: string;
    /** First size code, e.g. "S" */
    z: string;
}

export interface MonsterIndexFile {
    meta: { builtAt: string; count: number };
    monsters: MonsterIndexEntry[];
}

/** Typed error so the UI can degrade to URL-paste-only without crashing. */
export class MonsterIndexError extends Error {
    readonly code: "missing" | "corrupt" | "network";
    constructor(code: "missing" | "corrupt" | "network", message: string) {
        super(message);
        this.name = "MonsterIndexError";
        this.code = code;
    }
}

let cachedIndex: MonsterIndexEntry[] | null = null;

/** Test-only escape hatch to reset the in-memory cache between cases. */
export function clearMonsterIndexCache(): void {
    cachedIndex = null;
}

function indexUrl(): string {
    const base = import.meta.env.BASE_URL || "/";
    return base.endsWith("/") ? `${base}data/monster-index.json` : `${base}/data/monster-index.json`;
}

function isValidEntry(e: unknown): e is MonsterIndexEntry {
    if (typeof e !== "object" || e === null) return false;
    const r = e as Record<string, unknown>;
    return typeof r.n === "string" && typeof r.s === "string";
}

/**
 * Loads the prebuilt monster index shipped with the extension.
 * Result is cached in memory. Throws MonsterIndexError when the
 * file is missing or corrupt — callers degrade to URL-paste-only.
 */
export async function loadMonsterIndex(): Promise<MonsterIndexEntry[]> {
    if (cachedIndex) return cachedIndex;
    let response: Response;
    try {
        response = await fetch(indexUrl());
    } catch (err) {
        throw new MonsterIndexError("network", `Monster index could not be loaded: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!response.ok) {
        throw new MonsterIndexError("missing", `Monster index missing (HTTP ${response.status})`);
    }
    let data: unknown;
    try {
        data = await response.json();
    } catch {
        throw new MonsterIndexError("corrupt", "Monster index is corrupt (invalid JSON)");
    }
    const monsters = (data as Partial<MonsterIndexFile>)?.monsters;
    if (!Array.isArray(monsters) || !monsters.every(isValidEntry)) {
        throw new MonsterIndexError("corrupt", "Monster index is corrupt (unexpected shape)");
    }
    cachedIndex = monsters as MonsterIndexEntry[];
    return cachedIndex;
}

/**
 * Substring search ranked prefix-first, then substring. Case-insensitive.
 * Returns at most `limit` entries. Queries shorter than 2 chars return [].
 */
export function searchMonsters(index: MonsterIndexEntry[], query: string, limit = 50): MonsterIndexEntry[] {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const prefix: MonsterIndexEntry[] = [];
    const substr: MonsterIndexEntry[] = [];
    for (const entry of index) {
        const name = entry.n.toLowerCase();
        if (name.startsWith(q)) prefix.push(entry);
        else if (name.includes(q)) substr.push(entry);
    }
    const byNameSource = (a: MonsterIndexEntry, b: MonsterIndexEntry) =>
        a.n.localeCompare(b.n) || a.s.localeCompare(b.s);
    prefix.sort(byNameSource);
    substr.sort(byNameSource);
    return [...prefix, ...substr].slice(0, limit);
}

// ── Index-record builders (pure; build script mirrors this logic in JS) ──

export function normalizeCrForIndex(cr: unknown): string {
    const num = crToNumber(cr);
    return num === null ? "—" : numberToCr(num);
}

export function formatTypeForIndex(type: unknown): string {
    if (!type) return "";
    if (typeof type === "string") return type;
    if (typeof type === "object") {
        const t = type as { type?: unknown; tags?: unknown };
        const base = typeof t.type === "string" ? t.type : "";
        const tags = Array.isArray(t.tags) ? t.tags.filter((x): x is string => typeof x === "string") : [];
        if (tags.length === 0) return base;
        return `${base} (${tags.join(", ")})`;
    }
    return "";
}

export function monsterToIndexEntry(monster: { name: string; source: string; cr?: unknown; type?: unknown; size?: unknown }): MonsterIndexEntry {
    const sizeArr = Array.isArray(monster.size) ? monster.size : [];
    const first = typeof sizeArr[0] === "string" ? (sizeArr[0] as string).toUpperCase() : "M";
    return {
        n: monster.name,
        s: monster.source,
        c: normalizeCrForIndex(monster.cr),
        t: formatTypeForIndex(monster.type),
        z: first,
    };
}

const SIZE_NAMES: Record<string, string> = {
    T: "Tiny",
    S: "Small",
    M: "Medium",
    L: "Large",
    H: "Huge",
    G: "Gargantuan",
};

/**
 * Human-readable one-liner for picker rows and selection chips, e.g.
 * "MM · CR 1/4 · humanoid (goblinoid) · Small". Unknown CR and empty
 * type are omitted instead of rendering a bare "—" or dangling separator.
 */
export function formatMonsterEntrySubtitle(entry: MonsterIndexEntry): string {
    const parts: string[] = [entry.s];
    if (entry.c && entry.c !== "—") parts.push(`CR ${entry.c}`);
    if (entry.t) parts.push(entry.t);
    const sizeName = SIZE_NAMES[entry.z] ?? entry.z;
    if (sizeName) parts.push(sizeName);
    return parts.join(" · ");
}
