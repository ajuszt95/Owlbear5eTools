/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 5e.tools bestiary entries can reference another creature with `_copy`
 * instead of repeating its stat block. The website resolves these at load
 * time; our importer has to do the same, otherwise copied monsters (Plane
 * Shift, most named NPCs, template variants, …) have no HP/AC/actions and
 * spawn with an empty stat block.
 *
 * This is a focused port of the relevant parts of 5e.tools'
 * `DataUtil.generic.copyApplier` (js/utils.js). Only the operations that
 * actually appear in the official and partnered bestiary data are handled.
 */

export type MonsterData = Record<string, any>;

export interface MonsterTemplateRef {
    name: string;
    source: string;
}

export interface MonsterTemplate {
    name: string;
    source: string;
    apply?: {
        _root?: MonsterData;
        _mod?: Record<string, any>;
    };
}

export interface ResolveMonsterCopyOptions {
    /** Loads the creature referenced by `_copy`. Return undefined if missing. */
    loadMonster: (name: string, source: string) => Promise<MonsterData | undefined>;
    /** Loads the 5e.tools template catalogue (data/bestiary/template.json). */
    loadTemplates?: () => Promise<MonsterTemplate[]>;
    /** Guard against malicious/cyclic data. */
    maxDepth?: number;
}

const COPY_ENTRY_PROPS = [
    "action",
    "bonus",
    "reaction",
    "trait",
    "legendary",
    "mythic",
    "variant",
    "spellcasting",
    "actionHeader",
    "bonusHeader",
    "reactionHeader",
    "legendaryHeader",
    "mythicHeader",
];

/**
 * Fields that are not inherited from the copied creature unless `_preserve`
 * explicitly opts in. Mirrors `_MERGE_REQUIRES_PRESERVE_BASE` upstream.
 */
const MERGE_REQUIRES_PRESERVE_BASE = new Set([
    "page",
    "otherSources",
    "referenceSources",
    "srd",
    "srd52",
    "basicRules",
    "basicRules2024",
    "reprintedAs",
    "hasFluff",
    "hasFluffImages",
    "hasToken",
    "tokenCredit",
]);

const SKILL_TO_ABILITY: Record<string, string> = {
    acrobatics: "dex",
    "animal handling": "wis",
    arcana: "int",
    athletics: "str",
    deception: "cha",
    history: "int",
    insight: "wis",
    intimidation: "cha",
    investigation: "int",
    medicine: "wis",
    nature: "int",
    perception: "wis",
    performance: "cha",
    persuasion: "cha",
    religion: "int",
    "sleight of hand": "dex",
    stealth: "dex",
    survival: "wis",
};

function isObject(value: unknown): value is Record<string, any> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clone<T>(value: T): T {
    if (value === undefined || value === null) return value;
    return JSON.parse(JSON.stringify(value)) as T;
}

function toArray<T>(value: T | T[] | undefined | null): T[] {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : [value];
}

function identityKey(name: string, source: string): string {
    return `${name.trim().toLowerCase()}\u0000${source.trim().toLowerCase()}`;
}

function getPath(obj: any, path: string[]): any {
    let current: any = obj;
    for (const key of path) {
        if (!isObject(current) && !Array.isArray(current)) return undefined;
        current = (current as any)[key];
    }
    return current;
}

function setPath(obj: any, path: string[], value: any): void {
    if (path.length === 0) return;
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        if (!isObject(current[key]) && !Array.isArray(current[key])) current[key] = {};
        current = current[key];
    }
    current[path[path.length - 1]] = value;
}

function deletePath(obj: any, path: string[]): void {
    if (path.length === 0) return;
    const parent: any = getPath(obj, path.slice(0, -1));
    if (isObject(parent) || Array.isArray(parent)) delete (parent as any)[path[path.length - 1]];
}

/** Normalises a `_mod` map so every operation is an array, as upstream does. */
function normaliseMods(mods: Record<string, any>): void {
    for (const key of Object.keys(mods)) {
        const value = mods[key];
        if (!Array.isArray(value)) mods[key] = [value];
    }
}

function mergeMods(target: Record<string, any>, source: Record<string, any>): void {
    const normalisedSource = clone(source);
    normaliseMods(normalisedSource);
    for (const [key, ops] of Object.entries(normalisedSource)) {
        if (target[key]) target[key] = [...toArray(target[key]), ...toArray(ops)];
        else target[key] = ops;
    }
}

function findTemplate(templates: MonsterTemplate[], ref: MonsterTemplateRef): MonsterTemplate | undefined {
    const wantedName = String(ref?.name ?? "").trim().toLowerCase();
    const wantedSource = String(ref?.source ?? "").trim().toLowerCase();
    return templates.find(
        (template) =>
            template.name.trim().toLowerCase() === wantedName &&
            template.source.trim().toLowerCase() === wantedSource
    );
}

/** 5e.tools' short name: drop parentheticals and anything after a comma. */
function shortName(name: string): string {
    return String(name)
        .replace(/\s*\([^)]*\)\s*/g, " ")
        .split(",")[0]
        .replace(/^the\s+/i, "")
        .trim();
}

function titleCase(value: string): string {
    return value
        .split(/\s+/)
        .map((word) => (word.length ? word[0].toUpperCase() + word.slice(1) : word))
        .join(" ");
}

function abilityMod(score: any): number {
    const numeric = Number(score);
    if (!Number.isFinite(numeric)) return 0;
    return Math.floor((numeric - 10) / 2);
}

function crToPb(cr: any): number {
    const raw = typeof cr === "object" && cr !== null ? cr.cr : cr;
    let numeric: number;
    if (typeof raw === "number") numeric = raw;
    else if (typeof raw === "string") numeric = parseFloat(raw);
    else return 2;
    if (!Number.isFinite(numeric) || numeric <= 4) return 2;
    return 2 + Math.ceil((numeric - 4) / 4);
}

function signed(value: number): string {
    return value >= 0 ? `+${value}` : String(value);
}

function resolveVariable(name: string, monster: MonsterData): string {
    const key = name.trim();
    switch (key) {
        case "name":
            return String(monster.name ?? "");
        case "short_name":
            return shortName(monster.name);
        case "title_short_name":
            return titleCase(shortName(monster.name));
        case "spell_dc__int":
            return String(8 + crToPb(monster.cr) + abilityMod(monster.int));
        case "spell_dc__cha":
            return String(8 + crToPb(monster.cr) + abilityMod(monster.cha));
        case "to_hit__str":
            return String(crToPb(monster.cr) + abilityMod(monster.str));
        case "damage_mod__str":
            return signed(abilityMod(monster.str));
        case "damage_avg__2.5+str":
            return String(Math.floor(2.5 + abilityMod(monster.str)));
        default:
            return `<$${key}$>`;
    }
}

function resolveVariables(value: any, monster: MonsterData): any {
    if (typeof value === "string") {
        return value.replace(/<\$([^$]+)\$>/g, (_, variable: string) => resolveVariable(variable, monster));
    }
    if (Array.isArray(value)) return value.map((item) => resolveVariables(item, monster));
    if (isObject(value)) {
        const out: Record<string, any> = {};
        for (const [key, item] of Object.entries(value)) out[key] = resolveVariables(item, monster);
        return out;
    }
    return value;
}

/** Replaces text without touching 5e.tools tags such as `{@hit 5}`. */
function replaceOutsideTags(text: string, regex: RegExp, replacement: string): string {
    return text
        .split(/(\{@[^}]*\})/g)
        .map((part) => (part.startsWith("{@") ? part : part.replace(regex, replacement)))
        .join("");
}

function replaceContentDeep(value: any, regex: RegExp, replacement: string): any {
    if (typeof value === "string") return replaceOutsideTags(value, regex, replacement);
    if (Array.isArray(value)) return value.map((item) => replaceContentDeep(item, regex, replacement));
    if (!isObject(value)) return value;
    const out: Record<string, any> = {};
    for (const [key, item] of Object.entries(value)) {
        out[key] = replaceContentDeep(item, regex, replacement);
    }
    return out;
}

function replaceTextDeep(value: any, regex: RegExp, replacement: string, props: string[]): any {
    if (typeof value === "string") return replaceOutsideTags(value, regex, replacement);
    if (Array.isArray(value)) return value.map((item) => replaceTextDeep(item, regex, replacement, props));
    if (!isObject(value)) return value;

    const out: Record<string, any> = { ...value };
    for (const prop of props) {
        if (prop && typeof out[prop] === "string") {
            out[prop] = replaceOutsideTags(out[prop], regex, replacement);
        }
    }
    for (const prop of ["entries", "headerEntries", "footerEntries"]) {
        if (out[prop] !== undefined) {
            out[prop] = replaceContentDeep(out[prop], regex, replacement);
        }
    }
    if (props.includes("name") && typeof out.name === "string") {
        out.name = replaceOutsideTags(out.name, regex, replacement);
    }
    return out;
}

function deepEqual(a: any, b: any): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

function getArrayAt(target: any, path: string[]): any[] | undefined {
    const value = path.length === 0 ? target : getPath(target, path);
    return Array.isArray(value) ? value : undefined;
}

function setArrayAt(target: any, path: string[], value: any[]): void {
    if (path.length === 0) return;
    setPath(target, path, value);
}

function applyArrayMod(target: any, path: string[], op: Record<string, any>): void {
    const existing = getArrayAt(target, path);
    const items = toArray(op.items);

    switch (op.mode) {
        case "prependArr":
            setArrayAt(target, path, existing ? [...items, ...existing] : items);
            return;
        case "appendArr":
            setArrayAt(target, path, existing ? [...existing, ...items] : items);
            return;
        case "appendIfNotExistsArr": {
            if (!existing) {
                setArrayAt(target, path, items);
                return;
            }
            setArrayAt(target, path, [
                ...existing,
                ...items.filter((item) => !existing.some((current) => deepEqual(current, item))),
            ]);
            return;
        }
        case "insertArr": {
            if (!existing) return;
            const index = typeof op.index === "number" && op.index >= 0 ? op.index : existing.length;
            existing.splice(index, 0, ...items);
            return;
        }
        case "removeArr": {
            if (!existing) return;
            if (op.names !== undefined) {
                for (const name of toArray(op.names)) {
                    const index = existing.findIndex((item) => isObject(item) && item.name === name);
                    if (index >= 0) existing.splice(index, 1);
                }
                return;
            }
            if (op.items !== undefined) {
                for (const item of toArray(op.items)) {
                    const index = existing.findIndex((current) => deepEqual(current, item));
                    if (index >= 0) existing.splice(index, 1);
                }
                return;
            }
            return;
        }
        case "renameArr": {
            if (!existing) return;
            for (const rename of toArray(op.renames)) {
                const item = existing.find((current) => isObject(current) && current.name === rename.rename);
                if (item) item.name = rename.with;
            }
            return;
        }
        case "replaceArr":
        case "replaceOrAppendArr": {
            if (!existing) {
                if (op.mode === "replaceOrAppendArr") setArrayAt(target, path, items);
                return;
            }
            let index = -1;
            if (isObject(op.replace) && op.replace.regex) {
                const regex = new RegExp(op.replace.regex, op.replace.flags ?? "");
                index = existing.findIndex((item) =>
                    isObject(item) && typeof item.name === "string"
                        ? regex.test(item.name)
                        : typeof item === "string"
                            ? regex.test(item)
                            : false
                );
            } else if (isObject(op.replace) && typeof op.replace.index === "number") {
                index = op.replace.index;
            } else if (isObject(op.replace) && typeof op.replace.name === "string") {
                index = existing.findIndex((item) =>
                    isObject(item) ? item.name === op.replace.name : item === op.replace.name
                );
            } else {
                index = existing.findIndex((item) =>
                    isObject(item) ? item.name === op.replace : item === op.replace
                );
            }
            if (index >= 0) existing.splice(index, 1, ...items);
            else if (op.mode === "replaceOrAppendArr") existing.push(...items);
            return;
        }
        default:
            return;
    }
}

function applySpellMod(monster: MonsterData, op: Record<string, any>): void {
    const spellcasting = Array.isArray(monster.spellcasting) ? monster.spellcasting[0] : undefined;
    if (!isObject(spellcasting)) return;

    if (op.mode === "addSpells") {
        if (isObject(op.spells)) {
            spellcasting.spells = isObject(spellcasting.spells) ? spellcasting.spells : {};
            for (const [key, value] of Object.entries(op.spells)) {
                const existing = spellcasting.spells[key];
                if (existing === undefined) spellcasting.spells[key] = clone(value);
                else if (Array.isArray(existing) && Array.isArray(value)) {
                    spellcasting.spells[key] = [...existing, ...value.filter((item) => !existing.includes(item))];
                } else if (isObject(existing) && isObject(value)) {
                    for (const [subKey, subValue] of Object.entries(value)) {
                        const subExisting = existing[subKey];
                        if (Array.isArray(subExisting) && Array.isArray(subValue)) {
                            existing[subKey] = [...subExisting, ...subValue.filter((item) => !subExisting.includes(item))];
                        } else if (subExisting === undefined) existing[subKey] = clone(subValue);
                    }
                }
            }
        }
        for (const prop of ["constant", "will", "ritual"]) {
            if (Array.isArray(op[prop])) {
                spellcasting[prop] = Array.isArray(spellcasting[prop]) ? spellcasting[prop] : [];
                spellcasting[prop].push(...op[prop]);
            }
        }
        return;
    }

    if (op.mode === "replaceSpells" && isObject(op.spells)) {
        for (const value of Object.values(op.spells)) {
            if (!Array.isArray(value)) continue;
            for (const replacement of value) {
                if (!isObject(replacement)) continue;
                for (const [, spells] of Object.entries(spellcasting.spells ?? {})) {
                    if (!Array.isArray(spells)) continue;
                    const index = spells.indexOf(replacement.replace);
                    if (index >= 0) spells.splice(index, 1, replacement.with);
                }
            }
        }
        return;
    }

    if (op.mode === "removeSpells") {
        for (const category of ["daily", "weekly", "monthly", "yearly", "recharge", "legendary", "charges", "rest", "restLong"]) {
            const groups = op[category];
            if (!isObject(groups)) continue;
            const target = spellcasting[category];
            if (!isObject(target)) continue;
            for (const [key, spells] of Object.entries(groups)) {
                if (!Array.isArray(spells) || !Array.isArray(target[key])) continue;
                target[key] = target[key].filter((spell: any) => !spells.includes(spell));
            }
        }
    }
}

function applyMod(target: MonsterData, prop: string, rawOps: any): void {
    const paths: Array<string[] | null> =
        prop === "_"
            ? [null]
            : prop === "*"
                ? COPY_ENTRY_PROPS.map((name) => [name])
                : [prop.split(".")];

    for (const rawOp of toArray(rawOps)) {
        if (typeof rawOp === "string") {
            if (rawOp === "remove") {
                for (const path of paths) if (path) deletePath(target, path);
            }
            continue;
        }
        if (!isObject(rawOp)) continue;

        const mode = rawOp.mode;
        for (const path of paths) {
            switch (mode) {
                case "appendStr": {
                    if (!path) break;
                    const existing = getPath(target, path);
                    setPath(target, path, `${existing ?? ""}${rawOp.joiner ?? ""}${rawOp.str ?? ""}`);
                    break;
                }
                case "replaceName": {
                    if (!path) break;
                    const existing = getArrayAt(target, path);
                    if (!existing) break;
                    const regex = new RegExp(rawOp.replace, `g${rawOp.flags ?? ""}`);
                    for (const item of existing) {
                        if (isObject(item) && typeof item.name === "string") {
                            item.name = replaceOutsideTags(item.name, regex, rawOp.with ?? "");
                        }
                    }
                    break;
                }
                case "replaceTxt": {
                    if (!path) break;
                    const existing = getPath(target, path);
                    if (existing === undefined) break;
                    const regex = new RegExp(rawOp.replace, `g${rawOp.flags ?? ""}`);
                    const replacement = rawOp.with ?? "";
                    const props = Array.isArray(rawOp.props) ? rawOp.props : [null, "entries", "headerEntries", "footerEntries"];
                    if (props.includes(null) && Array.isArray(existing)) {
                        const updated = existing.map((item: any) =>
                            typeof item === "string" ? replaceOutsideTags(item, regex, replacement) : item
                        );
                        setPath(target, path, updated);
                    }
                    setPath(
                        target,
                        path,
                        replaceTextDeep(getPath(target, path), regex, replacement, props.filter(Boolean))
                    );
                    break;
                }
                case "prependArr":
                case "appendArr":
                case "appendIfNotExistsArr":
                case "insertArr":
                case "removeArr":
                case "renameArr":
                case "replaceArr":
                case "replaceOrAppendArr": {
                    if (!path) break;
                    applyArrayMod(target, path, rawOp);
                    break;
                }
                case "setProp": {
                    const targetPath = typeof rawOp.prop === "string" ? rawOp.prop.split(".") : [];
                    if (path) targetPath.unshift(...path);
                    if (targetPath.length) setPath(target, targetPath, clone(rawOp.value));
                    break;
                }
                case "addSenses": {
                    target.senses = Array.isArray(target.senses) ? target.senses : [];
                    const senses = toArray(rawOp.senses);
                    for (const sense of senses) {
                        if (!isObject(sense)) continue;
                        const label = String(sense.type ?? "");
                        const range = Number(sense.range);
                        if (!label || !Number.isFinite(range)) continue;
                        const index = target.senses.findIndex((entry: any) =>
                            typeof entry === "string" && new RegExp(`${label} (\\d+)`, "i").test(entry)
                        );
                        if (index >= 0) {
                            const match = new RegExp(`${label} (\\d+)`, "i").exec(target.senses[index]);
                            if (match && Number(match[1]) < range) target.senses[index] = `${label} ${range} ft.`;
                        } else {
                            target.senses.push(`${label} ${range} ft.`);
                        }
                    }
                    break;
                }
                case "addSaves": {
                    target.save = isObject(target.save) ? target.save : {};
                    for (const [ability, modeValue] of Object.entries(isObject(rawOp.saves) ? rawOp.saves : {})) {
                        const total = Number(modeValue) * crToPb(target.cr) + abilityMod(target[ability]);
                        const text = signed(total);
                        if (target.save[ability] === undefined || Number(target.save[ability]) < total) {
                            target.save[ability] = text;
                        }
                    }
                    break;
                }
                case "addSkills": {
                    target.skill = isObject(target.skill) ? target.skill : {};
                    for (const [skill, modeValue] of Object.entries(isObject(rawOp.skills) ? rawOp.skills : {})) {
                        const ability = SKILL_TO_ABILITY[skill] ?? "int";
                        const total = Number(modeValue) * crToPb(target.cr) + abilityMod(target[ability]);
                        const text = signed(total);
                        if (target.skill[skill] === undefined || Number(target.skill[skill]) < total) {
                            target.skill[skill] = text;
                        }
                    }
                    break;
                }
                case "addSpells":
                case "replaceSpells":
                case "removeSpells":
                    applySpellMod(target, rawOp);
                    break;
                default:
                    // Unsupported upstream mode; keep the base data rather than
                    // failing the whole import.
                    break;
            }
        }
    }
}

/**
 * Synchronously merges `copyFrom` into `copyTo` and applies `_mod`/templates.
 * Neither input is mutated. `copyTo._copy` is removed from the result.
 */
export function applyMonsterCopy(
    copyFrom: MonsterData,
    copyTo: MonsterData,
    templates: MonsterTemplate[] = []
): MonsterData {
    const out: MonsterData = clone(copyTo);
    const copyMeta = out._copy;
    if (!isObject(copyMeta)) return out;

    const mods: Record<string, any> = isObject(copyMeta._mod) ? clone(copyMeta._mod) : {};
    normaliseMods(mods);

    const templateRoot: MonsterData = {};
    if (Array.isArray(copyMeta._templates)) {
        for (const ref of copyMeta._templates) {
            const template = findTemplate(templates, ref);
            if (!template?.apply) continue;
            if (isObject(template.apply._root)) {
                Object.assign(templateRoot, clone(template.apply._root));
            }
            if (isObject(template.apply._mod)) {
                mergeMods(mods, template.apply._mod);
            }
        }
    }

    const originalKeys = new Set(Object.keys(out));

    for (const [key, value] of Object.entries(copyFrom)) {
        if (out[key] === null) {
            delete out[key];
            continue;
        }
        if (out[key] === undefined) {
            if (MERGE_REQUIRES_PRESERVE_BASE.has(key)) {
                if (copyMeta._preserve?.["*"] || copyMeta._preserve?.[key]) out[key] = clone(value);
            } else {
                out[key] = clone(value);
            }
        }
    }

    for (const [key, value] of Object.entries(templateRoot)) {
        if (!originalKeys.has(key)) out[key] = clone(value);
    }

    const resolvedMods = resolveVariables(mods, out) as Record<string, any>;
    const props = Object.keys(resolvedMods).sort((a, b) => {
        const tail = (value: string) => (value === "_" ? 0 : value === "*" ? 1 : 2);
        return tail(a) - tail(b);
    });
    for (const prop of props) applyMod(out, prop, resolvedMods[prop]);

    delete out._copy;
    out._isCopy = true;
    return out;
}

function isCopyCycle(seen: Set<string>, _monster: MonsterData, ref: any): boolean {
    const refKey = identityKey(String(ref?.name ?? ""), String(ref?.source ?? ""));
    return seen.has(refKey);
}

/**
 * Recursively resolves `_copy` chains. Missing parents leave the entry
 * untouched instead of throwing, so a single bad reference cannot block an
 * otherwise valid import.
 */
export async function resolveMonsterCopy(
    monster: MonsterData,
    options: ResolveMonsterCopyOptions,
    seen: Set<string> = new Set(),
    depth = 0
): Promise<MonsterData> {
    if (!monster?._copy || depth >= (options.maxDepth ?? 10)) return monster;

    const ref = monster._copy;
    if (isCopyCycle(seen, monster, ref)) return monster;

    const currentKey = identityKey(String(monster.name ?? ""), String(monster.source ?? ""));
    const refKey = identityKey(String(ref?.name ?? ""), String(ref?.source ?? ""));
    seen.add(currentKey);
    seen.add(refKey);

    const base = await options.loadMonster(String(ref.name ?? ""), String(ref.source ?? ""));
    if (!base) return { ...monster };

    const resolvedBase = await resolveMonsterCopy(base, options, seen, depth + 1);
    const templates =
        Array.isArray(ref?._templates) && ref._templates.length > 0 && options.loadTemplates
            ? await options.loadTemplates()
            : [];
    return applyMonsterCopy(resolvedBase, monster, templates);
}
