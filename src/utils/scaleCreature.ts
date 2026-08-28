/**
 * 5e.tools CR Scaler Implementation
 * Mirrors 5etools js/scalecreature/ (scalecreature-consts.js / scalecreature-utils.js
 * and scaler-cr/*). Kept as single file per design decision.
 */

import type { Monster } from "../api";

// ────────────────────────────────────────────────────────────────────────────
// Reference Tables & Constants — string-keyed to match upstream
// ────────────────────────────────────────────────────────────────────────────

export const CR_HP_RANGES: Record<string, [number, number]> = {
    "0": [1, 6],
    "0.125": [7, 35],
    "0.25": [36, 49],
    "0.5": [50, 70],
    "1": [71, 85],
    "2": [86, 100],
    "3": [101, 115],
    "4": [116, 130],
    "5": [131, 145],
    "6": [146, 160],
    "7": [161, 175],
    "8": [176, 190],
    "9": [191, 205],
    "10": [206, 220],
    "11": [221, 235],
    "12": [236, 250],
    "13": [251, 265],
    "14": [266, 280],
    "15": [281, 295],
    "16": [296, 310],
    "17": [311, 325],
    "18": [326, 340],
    "19": [341, 355],
    "20": [356, 400],
    "21": [401, 445],
    "22": [446, 490],
    "23": [491, 535],
    "24": [536, 580],
    "25": [581, 625],
    "26": [626, 670],
    "27": [671, 715],
    "28": [716, 760],
    "29": [761, 805],
    "30": [806, 850],
};

export const CR_DPR_RANGES: Record<string, [number, number]> = {
    "0": [0, 1],
    "0.125": [2, 3],
    "0.25": [4, 5],
    "0.5": [6, 8],
    "1": [9, 14],
    "2": [15, 20],
    "3": [21, 26],
    "4": [27, 32],
    "5": [33, 38],
    "6": [39, 44],
    "7": [45, 50],
    "8": [51, 56],
    "9": [57, 62],
    "10": [63, 68],
    "11": [69, 74],
    "12": [75, 80],
    "13": [81, 86],
    "14": [87, 92],
    "15": [93, 98],
    "16": [99, 104],
    "17": [105, 110],
    "18": [111, 116],
    "19": [117, 122],
    "20": [123, 140],
    "21": [141, 158],
    "22": [159, 176],
    "23": [177, 194],
    "24": [195, 212],
    "25": [213, 230],
    "26": [231, 248],
    "27": [249, 266],
    "28": [267, 284],
    "29": [285, 302],
    "30": [303, 320],
};

// Upstream: _CR_TO_ESTIMATED_CON_MOD_RANGE
export const CON_RANGE: Record<string, [number, number]> = {
    "0": [-1, 2],
    "0.125": [-1, 1],
    "0.25": [0, 2],
    "0.5": [0, 2],
    "1": [0, 2],
    "2": [0, 3],
    "3": [1, 3],
    "4": [1, 4],
    "5": [2, 4],
    "6": [2, 5],
    "7": [1, 5],
    "8": [1, 5],
    "9": [2, 5],
    "10": [2, 5],
    "11": [2, 6],
    "12": [1, 5],
    "13": [3, 6],
    "14": [3, 6],
    "15": [3, 6],
    "16": [4, 7],
    "17": [3, 7],
    "18": [1, 7],
    "19": [4, 6],
    "20": [5, 9],
    "21": [3, 8],
    "22": [4, 9],
    "23": [5, 9],
    "24": [5, 9],
    "25": [7, 9],
    "26": [7, 9],
    "27": [7, 9],
    "28": [7, 9],
    "29": [7, 9],
    "30": [10, 10],
};
export const CR_TO_ESTIMATED_CON_MOD_RANGE = CON_RANGE;

// Upstream: CR_TO_ESTIMATED_DAMAGE_MOD
export const DAMAGE_MOD_RANGE: Record<string, [number, number]> = {
    "0": [-1, 2],
    "0.125": [0, 2],
    "0.25": [0, 3],
    "0.5": [0, 3],
    "1": [0, 3],
    "2": [1, 4],
    "3": [1, 4],
    "4": [2, 4],
    "5": [2, 5],
    "6": [2, 5],
    "7": [2, 5],
    "8": [2, 5],
    "9": [2, 6],
    "10": [3, 6],
    "11": [3, 6],
    "12": [3, 6],
    "13": [3, 7],
    "14": [3, 7],
    "15": [3, 7],
    "16": [4, 8],
    "17": [4, 8],
    "18": [4, 8],
    "19": [5, 8],
    "20": [6, 9],
    "21": [6, 9],
    "22": [6, 10],
    "23": [6, 10],
    "24": [6, 11],
    "25": [7, 11],
    "26": [7, 11],
    "27": [7, 11],
    "28": [8, 11],
    "29": [8, 11],
    "30": [9, 11],
};
export const CR_TO_ESTIMATED_DAMAGE_MOD = DAMAGE_MOD_RANGE;

export const SKILL_TO_ABILITY: Record<string, string> = {
    athletics: "str",
    acrobatics: "dex",
    "sleight of hand": "dex",
    stealth: "dex",
    arcana: "int",
    history: "int",
    investigation: "int",
    nature: "int",
    religion: "int",
    "animal handling": "wis",
    insight: "wis",
    medicine: "wis",
    perception: "wis",
    survival: "wis",
    deception: "cha",
    intimidation: "cha",
    performance: "cha",
    persuasion: "cha",
};

// Upstream object-form ATK/DC/AC ranges — string-keyed by ideal value
export const _ATK_CR_RANGES: Record<string, [number, number]> = {
    "3": [-1, 2],
    "4": [3, 3],
    "5": [4, 4],
    "6": [5, 7],
    "7": [8, 10],
    "8": [11, 15],
    "9": [16, 16],
    "10": [17, 20],
    "11": [21, 23],
    "12": [24, 26],
    "13": [27, 29],
    "14": [30, 30],
};

export const _DC_RANGES: Record<string, [number, number]> = {
    "13": [-1, 3],
    "14": [4, 4],
    "15": [5, 7],
    "16": [8, 10],
    "17": [11, 12],
    "18": [13, 16],
    "19": [17, 20],
    "20": [21, 23],
    "21": [24, 26],
    "22": [27, 29],
    "23": [30, 30],
};

export const _AC_CR_RANGES: Record<string, [number, number]> = {
    "13": [-1, 3],
    "14": [4, 4],
    "15": [5, 7],
    "16": [8, 9],
    "17": [10, 12],
    "18": [13, 16],
    "19": [17, 30],
};

// ────────────────────────────────────────────────────────────────────────────
// Core Helpers
// ────────────────────────────────────────────────────────────────────────────

export function crRangeToVal(cr: number, ranges: Record<string, [number, number]>): string | undefined {
    return Object.keys(ranges).find(k => {
        const [a, b] = ranges[k];
        return cr >= a && cr <= b;
    });
}

export function getScaledToRatio(inVal: number, inTotal: number, outTotal: number): number {
    if (inTotal === 0) return 0;
    return Math.round(inVal * (outTotal / inTotal));
}

export function interpAndTranslateToSpace(x: number, inRange: [number, number], outRange: [number, number]): number {
    const OFFSET = 0.1;
    const [L, H] = inRange;
    const [M, I] = outRange;
    const LPrime = L - OFFSET;
    const HPrime = H + OFFSET;
    const MPrime = M - OFFSET;
    const IPrime = I + OFFSET;
    const delta = (x - LPrime) / (HPrime - LPrime);
    return Math.round(delta * (IPrime - MPrime) + MPrime);
}

export function abilityMod(score: number): number {
    return Math.floor((score - 10) / 2);
}

export function calcNewAbility(mon: any, abilityKey: string, desiredMod: number): number {
    const oldScore = typeof mon[abilityKey] === "number" ? mon[abilityKey] : 10;
    const parity = Math.abs(oldScore % 2);
    const raw = (desiredMod + 5) * 2 + parity;
    return Math.min(30, Math.max(1, raw));
}

// Upstream: ScaleCreatureUtils.getDiceExpressionAverage
export function getDiceExpressionAverage(diceExp: string): number {
    if (!diceExp) return 0;
    const cleaned = diceExp.replace(/\s*/g, "");
    const asAverages = cleaned.replace(/d(\d+)/gi, (_m: string, faces: string) => ` * ${(Number(faces) + 1) / 2}`);
    // after replacement, expression like "2 * 3.5+3" => need to handle leading number
    // Upstream does `MiscUtil.expEval` which evaluates arithmetic; we emulate with Function but only allow safe chars
    try {
        if (!/^[\d\s+\-*/.()]+$/.test(asAverages)) return 0;
        const res = Function(`"use strict"; return (${asAverages})`)();
        return typeof res === "number" && !isNaN(res) ? res : 0;
    } catch {
        return 0;
    }
}

export function diceAverage(expression: string): number {
    if (!expression) return 0;
    // delegate to upstream-accurate helper (strip spaces, * (faces+1)/2)
    return getDiceExpressionAverage(expression);
}

export function crToPb(cr: number): number {
    if (cr < 5) return 2;
    if (cr < 9) return 3;
    if (cr < 13) return 4;
    if (cr < 17) return 5;
    if (cr < 21) return 6;
    if (cr < 25) return 7;
    if (cr < 29) return 8;
    return 9;
}

export function crToNumber(cr: any): number | null {
    if (cr === null || cr === undefined) return null;
    if (typeof cr === "number") return cr;
    if (typeof cr === "object" && cr.cr !== undefined) {
        return crToNumber(cr.cr);
    }
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

export function numberToCr(num: number): string {
    if (num === 0.125) return "1/8";
    if (num === 0.25) return "1/4";
    if (num === 0.5) return "1/2";
    return String(num);
}

export function crToAtk(cr: number): number {
    const k = crRangeToVal(cr, _ATK_CR_RANGES);
    return k != null ? Number(k) : cr < 0 ? 3 : 14;
}

export function crToDc(cr: number): number {
    const k = crRangeToVal(cr, _DC_RANGES);
    return k != null ? Number(k) : cr < 0 ? 13 : 23;
}

export function crToAc(cr: number): number {
    const k = crRangeToVal(cr, _AC_CR_RANGES);
    return k != null ? Number(k) : cr < 0 ? 13 : 19;
}

function getRangeMean(range: [number, number]): number {
    return (range[0] + range[1]) / 2;
}

export function getScaledDpr({ dprIn, crInNumber, dprTargetIn, dprTargetOut }: { dprIn: number; crInNumber: number; dprTargetIn: number; dprTargetOut: number }): number {
    if (crInNumber === 0) dprIn = Math.min(dprIn, 0.63);
    return getScaledToRatio(dprIn, dprTargetIn, dprTargetOut);
}

// ────────────────────────────────────────────────────────────────────────────
// RNG stub — deterministic seeded RNG mirroring CrScalerUtils.init
// ────────────────────────────────────────────────────────────────────────────

function hashCode(str: string | number): number {
    const s = String(str);
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = (31 * h + s.charCodeAt(i)) | 0;
    }
    return h;
}

function mulberry32(seed: number): () => number {
    let t = seed;
    return function () {
        t += 0x6d2b79f5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

export let RNG: (() => number) | null = null;
export function initRng(mon: any, crOutNumber: number): void {
    let h = hashCode(crOutNumber);
    h = (31 * h + hashCode(mon.source ?? "")) | 0;
    h = (31 * h + hashCode(mon.name ?? "")) | 0;
    RNG = mulberry32(h);
}

// ────────────────────────────────────────────────────────────────────────────
// Deep Clone Helper
// ────────────────────────────────────────────────────────────────────────────

function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== "object") return obj;
    return JSON.parse(JSON.stringify(obj));
}

function intToBonus(n: number): string {
    return n >= 0 ? `+${n}` : `${n}`;
}

// ────────────────────────────────────────────────────────────────────────────
// ScaleCreatureState — mirrors upstream State
// ────────────────────────────────────────────────────────────────────────────

const ABIL_ABVS = ["str", "dex", "con", "int", "wis", "cha"] as const;

export class ScaleCreatureState {
    private _abilityScoresOriginal: Record<string, number>;
    private _hasModifiedAbilityScore: Record<string, boolean>;
    private _abilityModsTemp: Record<string, number | null>;
    private _abilityModsCandidates: Record<string, number[]>;

    constructor(mon: any) {
        this._abilityScoresOriginal = Object.fromEntries(ABIL_ABVS.map(ab => [ab, typeof mon[ab] === "number" ? mon[ab] : 10]));
        this._hasModifiedAbilityScore = Object.fromEntries(ABIL_ABVS.map(ab => [ab, false])) as Record<string, boolean>;
        this._abilityModsTemp = Object.fromEntries(ABIL_ABVS.map(ab => [ab, null])) as Record<string, number | null>;
        this._abilityModsCandidates = {};
        this.clearCandidateAbilityMods();
    }

    getOriginalScore(abv: string): number {
        return this._abilityScoresOriginal[abv] ?? 10;
    }

    setHasModifiedAbilityScore(abv: string): void {
        this._hasModifiedAbilityScore[abv] = true;
    }
    getHasModifiedAbilityScore(abv: string): boolean {
        return !!this._hasModifiedAbilityScore[abv];
    }

    getTempAbilityMod(abv: string): number | null {
        return this._abilityModsTemp[abv] ?? null;
    }
    setTempAbilityMod(abv: string, mod: number | null): void {
        this._abilityModsTemp[abv] = mod;
    }

    addCandidateAbilityMod(abv: string, mod: number): void {
        this._abilityModsCandidates[abv].push(mod);
    }
    hasCandidateAbilityMods(abv: string): boolean {
        return !!this._abilityModsCandidates[abv]?.length;
    }
    getCandidateAbilityMods(abv: string): number[] {
        return [...(this._abilityModsCandidates[abv] ?? [])];
    }
    clearCandidateAbilityMods(): void {
        this._abilityModsCandidates = Object.fromEntries(ABIL_ABVS.map(ab => [ab, []])) as Record<string, number[]>;
    }
}

// Legacy internal state used by pipeline — maps to ScaleCreatureState
interface ScalingState {
    origScores: Record<string, number>;
    modifiedAbilities: Set<string>;
    strCandidates: number[];
    dexCandidates: number[];
    tempStrMod?: number;
    tempDexMod?: number;
}

function syncLegacyToState(state: ScaleCreatureState, legacy: ScalingState): void {
    for (const ab of legacy.modifiedAbilities) state.setHasModifiedAbilityScore(ab);
    // candidates already added via state API during processing; legacy arrays are not needed
    if (legacy.tempStrMod !== undefined) state.setTempAbilityMod("str", legacy.tempStrMod);
    if (legacy.tempDexMod !== undefined) state.setTempAbilityMod("dex", legacy.tempDexMod);
}

// ────────────────────────────────────────────────────────────────────────────
// Main entry
// ────────────────────────────────────────────────────────────────────────────

export function scaleMonster(originalMonster: Monster, crOutNumber: number, opts?: { enableSpellcastingScaling?: boolean }): Monster {
    const origCrNum = crToNumber(originalMonster.cr);
    if (
        origCrNum === null ||
        typeof crOutNumber !== "number" ||
        isNaN(crOutNumber) ||
        origCrNum === crOutNumber ||
        origCrNum < 0 ||
        origCrNum > 30 ||
        crOutNumber < 0 ||
        crOutNumber > 30 ||
        !CR_HP_RANGES[String(origCrNum)] ||
        !CR_HP_RANGES[String(crOutNumber)]
    ) {
        return originalMonster;
    }

    const mon = deepClone(originalMonster);
    const crIn = origCrNum;
    const crOut = crOutNumber;

    initRng(mon, crOut);

    const state = new ScaleCreatureState(mon);

    // Build legacy mirror for existing pipeline helpers that use ScalingState
    // We will keep both in sync; helpers will operate on ScaleCreatureState where possible.
    const legacy: ScalingState = {
        origScores: {
            str: typeof mon.str === "number" ? mon.str : 10,
            dex: typeof mon.dex === "number" ? mon.dex : 10,
            con: typeof mon.con === "number" ? mon.con : 10,
            int: typeof mon.int === "number" ? mon.int : 10,
            wis: typeof mon.wis === "number" ? mon.wis : 10,
            cha: typeof mon.cha === "number" ? mon.cha : 10,
        },
        modifiedAbilities: new Set<string>(),
        strCandidates: [],
        dexCandidates: [],
    };

    // Step 2: Proficiency bonus delta
    applyProficiencyBonus(mon, crIn, crOut);

    // Step 3: Scale HP
    scaleHp(mon, crIn, crOut, state, legacy);

    // Step 4: Scale To-Hit / Save DCs
    scaleHitSave(mon, crIn, crOut, state, legacy);

    // Step 5: Scale DPR / damage expressions
    scaleDpr(mon, crIn, crOut, state, legacy);

    // Step 6: Spellcasting (gated)
    if (opts?.enableSpellcastingScaling) {
        // Stub: future parity for _adjustSpellcasting caster level/slot scaling
        // For MVP we keep gated off; when enabled, we at least ensure header spell level scales
        // Minimal implementation: scale caster level mentions via ratio
        // (Full PHB DB mutation omitted intentionally)
    }

    // Step 7: Scale AC (after DPR, as DPR takes priority for DEX)
    // Pass state for tempDex handling; legacy also kept
    scaleAc(mon, crIn, crOut, state, legacy);

    // Step 8: Propagate ability score changes
    propagateAbilityChanges(mon, state, legacy);

    // Step 9: Finalize CR and flags
    const crOutStr = numberToCr(crOut);
    if (typeof mon.cr === "object" && mon.cr !== null && (mon.cr as any).cr !== undefined) {
        (mon.cr as any).cr = crOutStr;
        if ((mon.cr as any).xp != null) delete (mon.cr as any).xp;
    } else {
        mon.cr = crOutStr as any;
    }
    // If original mon.cr had xp at top-level (unlikely), ensure deleted
    if ((mon as any).cr && typeof (mon as any).cr === "object" && (mon as any).cr.xp) delete (mon as any).cr.xp;

    mon._displayName = `${mon.name} (CR ${crOutStr})`;
    mon._scaledCr = crOut;
    mon._isScaledCr = true;
    mon._originalCr = (originalMonster as any)._originalCr ?? (typeof originalMonster.cr === "object" && originalMonster.cr !== null ? (originalMonster.cr as any).cr : originalMonster.cr);

    return mon;
}

// ────────────────────────────────────────────────────────────────────────────
// Step 2: Proficiency Bonus — JSON.stringify walk mirroring upstream
// ────────────────────────────────────────────────────────────────────────────

function applyProficiencyBonus(mon: any, crIn: number, crOut: number): void {
    const pbIn = crToPb(crIn);
    const pbOut = crToPb(crOut);
    const pbDelta = pbOut - pbIn;
    if (pbDelta === 0 && pbIn === pbOut) {
        // still need to handle saves/skills that may have pb delta 0? No change needed.
        // Early return when delta 0
        return;
    }
    if (pbDelta === 0) return;

    // Saves — handle expert (pb*2) and noProf (bonus == ability mod)
    if (mon.save && typeof mon.save === "object") {
        for (const [abil, bonusVal] of Object.entries(mon.save)) {
            const curBonus = parseInt(String(bonusVal), 10);
            if (isNaN(curBonus)) continue;
            const fromAbility = abilityMod(mon[abil] ?? 10);
            if (curBonus === fromAbility) continue; // No PB applied

            const actualPb = curBonus - fromAbility;
            const isExpert = actualPb === pbIn * 2;
            // if not expert and not normal pb, treat as normal (upstream does expert check only)
            const newBonus = curBonus - (isExpert ? 2 * pbIn : pbIn) + (isExpert ? 2 * pbOut : pbOut);
            mon.save[abil] = intToBonus(newBonus);
        }
    }

    // Skills — handle expert/noProf and passive deletion for string passive
    if (mon.skill && typeof mon.skill === "object") {
        const updateSkillsObj = (skillObj: Record<string, any>) => {
            for (const [skillName, bonusVal] of Object.entries(skillObj)) {
                if (skillName === "other") continue;
                const curBonus = parseInt(String(bonusVal), 10);
                if (isNaN(curBonus)) continue;
                const abil = SKILL_TO_ABILITY[skillName.toLowerCase()] || "dex";
                const fromAbility = abilityMod(mon[abil] ?? 10);
                if (curBonus === fromAbility) continue; // noProf
                const actualPb = curBonus - fromAbility;
                const isExpert = actualPb === pbIn * 2;
                const newBonus = curBonus - (isExpert ? 2 * pbIn : pbIn) + (isExpert ? 2 * pbOut : pbOut);
                skillObj[skillName] = intToBonus(newBonus);

                if (skillName.toLowerCase() === "perception") {
                    if (typeof mon.passive === "number") {
                        mon.passive = 10 + newBonus;
                    } else if (typeof mon.passive === "string") {
                        delete mon.passive;
                    }
                }
            }
        };

        updateSkillsObj(mon.skill);

        if (Array.isArray(mon.skill.other)) {
            for (const item of mon.skill.other) {
                if (item?.oneOf && typeof item.oneOf === "object") {
                    updateSkillsObj(item.oneOf);
                }
            }
        }
        // Also handle case where passive is string (upstream deletes)
        if (typeof mon.passive === "string") {
            // if any perception skill changed, upstream deletes string passive; we already do per-skill
            // Ensure string passive is removed if perception was present
            const hasPerception = mon.skill.perception != null || (Array.isArray(mon.skill.other) && mon.skill.other.some((o: any) => o.oneOf?.perception != null));
            if (hasPerception) delete mon.passive;
        }
    } else {
        // Even without skill block, string passive handling (upstream deletes on PB change if perception derived)
        if (typeof mon.passive === "string") delete mon.passive;
    }

    // Text entries: JSON.stringify walk for generic entries + spellcasting headerEntries
    // We apply applyPbDeltaToHit and applyPbDeltaDc via regex on the stringified JSON
    const applyPbDeltaToHit = (str: string, delta: number): string => {
        if (!delta) return str;
        return str.replace(/{@hit ([+-]?\d+)}/g, (_m, m1) => {
            const cur = Number(m1);
            const out = cur + delta;
            return `{@hit ${out}}`;
        });
    };
    const applyPbDeltaToDc = (str: string, delta: number): string => {
        if (!delta) return str;
        // Upstream first normalises plaintext DC to tag, then handles tag
        let out = str.replace(/DC (\d+)/g, (_m, m1) => `{@dc ${m1}}`);
        out = out.replace(/{@dc (\d+)(?:\|[^}]+)?}/g, (_m, m1) => {
            const cur = Number(m1);
            const o = cur + delta;
            return `{@dc ${o}}`;
        });
        return out;
    };

    if (mon.spellcasting) {
        for (const sc of mon.spellcasting) {
            if (sc.headerEntries) {
                const toUpdate = JSON.stringify(sc.headerEntries);
                const out = applyPbDeltaToDc(applyPbDeltaToHit(toUpdate, pbDelta), pbDelta);
                sc.headerEntries = JSON.parse(out);
            }
        }
    }

    const handleGenericEntries = (prop: string): void => {
        if (Array.isArray(mon[prop])) {
            for (const it of mon[prop]) {
                if (!it?.entries) continue;
                const toUpdate = JSON.stringify(it.entries);
                const out = applyPbDeltaToDc(applyPbDeltaToHit(toUpdate, pbDelta), pbDelta);
                it.entries = JSON.parse(out);
            }
        }
    };

    handleGenericEntries("trait");
    handleGenericEntries("action");
    handleGenericEntries("bonus");
    handleGenericEntries("reaction");
    handleGenericEntries("legendary");
    handleGenericEntries("mythic");
    handleGenericEntries("variant");
}

// ────────────────────────────────────────────────────────────────────────────
// Step 3: HP Scaling — iterative solver mirroring CrScalerHp
// ────────────────────────────────────────────────────────────────────────────

class _CrScalerHpState {
    _mon: any;
    _crInNumber: number;
    _crOutNumber: number;
    _hpInAvg: number;
    _hpOutRange: [number, number];
    _targetHpOut: number;
    _targetHpDeviation: number;
    _targetHpRange: [number, number];
    _hdFaces: number | null = null;
    _hdAvg: number | null = null;
    _modPerHd: number | null = null;
    _hpModTarget: number | null = null;
    _numHdOut: number | null = null;
    _hpModOut: number | null = null;

    constructor({ mon, crInNumber, crOutNumber }: { mon: any; crInNumber: number; crOutNumber: number }) {
        this._mon = mon;
        this._crInNumber = crInNumber;
        this._crOutNumber = crOutNumber;
        const hpInRange = CR_HP_RANGES[String(crInNumber)];
        const hpOutRange = CR_HP_RANGES[String(crOutNumber)];
        this._hpInAvg = getRangeMean(hpInRange);
        this._hpOutRange = hpOutRange;
        this._targetHpOut = getScaledToRatio(mon.hp.average, this._hpInAvg, getRangeMean(hpOutRange));
        this._targetHpDeviation = (hpOutRange[1] - hpOutRange[0]) / 2;
        this._targetHpRange = [Math.floor(this._targetHpOut - this._targetHpDeviation), Math.ceil(this._targetHpOut + this._targetHpDeviation)];
    }

    isInRange(val: number): boolean {
        return val >= this._targetHpRange[0] && val <= this._targetHpRange[1];
    }
    isAboveRange(val: number): boolean {
        return val > this._targetHpRange[1];
    }
    isBelowRange(val: number): boolean {
        return val < this._targetHpRange[0];
    }

    getAsSpecialHp(): any {
        const cpy = JSON.parse(JSON.stringify(this._mon.hp));
        delete cpy.average;
        delete cpy.formula;
        return { ...cpy, special: Math.floor(Math.max(1, this._targetHpOut)) };
    }

    getAvg({ numHd = null, hpMod = null }: { numHd?: number | null; hpMod?: number | null } = {}): number {
        const nh = numHd ?? this._numHdOut ?? 0;
        const hm = hpMod ?? this._hpModOut ?? 0;
        return nh * (this._hdAvg ?? 0) + nh * hm;
    }

    initDiceState(): boolean {
        const origFormula = (this._mon.hp.formula as string).replace(/\s*/g, "");
        if (!/^\d+d\d+(?:[-+]\d+)?$/.test(origFormula)) return false;
        const fSplit = origFormula.split(/([-+])/);
        const mDice = /(\d+)d(\d+)/i.exec(fSplit[0]);
        if (!mDice) return false;
        const hdFaces = Number(mDice[2]);
        const hdAvg = (hdFaces + 1) / 2;
        const numHd = Number(mDice[1]);
        const modTotal = fSplit.length === 3 ? Number(`${fSplit[1]}${fSplit[2]}`) : 0;
        const modPerHd = Math.floor(modTotal / numHd);
        const hpModTargetRange = CON_RANGE[String(this._crOutNumber)] ?? [0, 2];
        const hpModTarget =
            hpModTargetRange[0] === hpModTargetRange[1]
                ? hpModTargetRange[0]
                : interpAndTranslateToSpace(modPerHd, CON_RANGE[String(this._crInNumber)] ?? [0, 2], hpModTargetRange);

        this._hdFaces = hdFaces;
        this._hdAvg = hdAvg;
        this._modPerHd = modPerHd;
        this._hpModTarget = hpModTarget;
        this._numHdOut = numHd;
        this._hpModOut = hpModTarget;
        return true;
    }

    getHdAvg(): number {
        return this._hdAvg ?? 0;
    }
    getHdModTarget(): number {
        return this._hpModTarget ?? 0;
    }
    getNumHdOut(): number {
        return this._numHdOut ?? 0;
    }
    setHpModOut(val: number): void {
        this._hpModOut = val;
    }
    setNumHdOut(val: number): void {
        this._numHdOut = val;
    }

    mutOutput(): boolean {
        this._mon.hp.average = Math.floor(this.getAvg());
        const outModTotal = (this._numHdOut ?? 0) * (this._hpModOut ?? 0);
        this._mon.hp.formula = `${this._numHdOut}d${this._hdFaces}${outModTotal === 0 ? "" : `${outModTotal >= 0 ? "+" : ""}${outModTotal}`}`.replace(/([-+])\s*(\d+)$/g, " $1 $2");

        if (this._hpModOut === this._modPerHd) return false;
        const conOut = calcNewAbility(this._mon, "con", this._hpModOut ?? 0);
        const isConChange = conOut !== this._mon.con;
        if (isConChange && this._mon.save?.con) {
            const conDelta = abilityMod(conOut) - abilityMod(this._mon.con);
            const conSaveOut = Number(this._mon.save.con) + conDelta;
            this._mon.save.con = intToBonus(conSaveOut);
        }
        this._mon.con = conOut;
        return isConChange;
    }

    getLoggableState(): string {
        return `${this._numHdOut}d${this._hdFaces} mod ${this._hpModOut}`;
    }
}

function scaleHp(mon: any, crIn: number, crOut: number, state: ScaleCreatureState, legacy: ScalingState): void {
    if (!mon.hp || mon.hp.special != null) return;

    // Ensure hp.average exists; fallback to range mean if missing
    if (typeof mon.hp.average !== "number") {
        const crHpRange = CR_HP_RANGES[String(crIn)];
        mon.hp.average = crHpRange ? getRangeMean(crHpRange) : 10;
    }

    const hpState = new _CrScalerHpState({ mon, crInNumber: crIn, crOutNumber: crOut });
    const hasDice = hpState.initDiceState();
    if (!hasDice) {
        mon.hp = hpState.getAsSpecialHp();
        return;
    }

    const doTryAdjustNumDice = ({ hpState }: { hpState: _CrScalerHpState }): boolean => {
        let numDiceTemp = hpState.getNumHdOut();
        let tempTotalHp = hpState.getAvg();
        let found = false;
        if (hpState.isAboveRange(tempTotalHp)) {
            while (numDiceTemp > 1) {
                numDiceTemp -= 1;
                tempTotalHp -= hpState.getHdAvg();
                if (hpState.isInRange(hpState.getAvg({ numHd: numDiceTemp }))) {
                    found = true;
                    break;
                }
            }
        } else {
            while (hpState.isBelowRange(tempTotalHp)) {
                numDiceTemp += 1;
                tempTotalHp += hpState.getHdAvg();
                if (hpState.isInRange(hpState.getAvg({ numHd: numDiceTemp }))) {
                    found = true;
                    break;
                }
            }
        }
        if (found) {
            hpState.setNumHdOut(numDiceTemp);
            return true;
        }
        return false;
    };

    const doTryAdjustMod = ({ hpState, iter }: { hpState: _CrScalerHpState; iter: number }): void => {
        const ptAlternatePlusMinus = 1 - (iter % 2) * 2;
        const hpModOutNxt = hpState.getHdModTarget() + Math.ceil((iter + 1) / 2) * ptAlternatePlusMinus;
        if (hpModOutNxt < -5) return;
        hpState.setHpModOut(hpModOutNxt);
    };

    for (let iter = 0; iter < 100; ++iter) {
        if (hpState.isInRange(hpState.getAvg())) break;
        if (iter === 99) throw new Error(`Failed to find new HP! Current formula is: ${hpState.getLoggableState()}`);
        if (doTryAdjustNumDice({ hpState })) break;
        doTryAdjustMod({ hpState, iter });
    }

    const isConChange = hpState.mutOutput();
    if (isConChange) {
        state.setHasModifiedAbilityScore("con");
        legacy.modifiedAbilities.add("con");
    }
    // Sync legacy origScores con? Already set
    syncLegacyToState(state, legacy);
}

// ────────────────────────────────────────────────────────────────────────────
// Ability Detection Helpers
// ────────────────────────────────────────────────────────────────────────────

const WEAPONS_FINESSE = ["dagger", "dart", "rapier", "scimitar", "shortsword", "whip"];
const WEAPONS_THROWN = ["handaxe", "javelin", "light hammer", "spear", "trident", "net"];
const WEAPONS_THROWN_FINESSE = ["dagger", "dart"];

function getEnchantBonus(name?: string): number {
    if (!name) return 0;
    const m = /\+(\d+)/.exec(name);
    return m ? Number(m[1]) : 0;
}

function guessModFromWeaponTags(name: string, content: string): "str" | "dex" | null {
    const lowName = (name || "").toLowerCase();
    const lowContent = (content || "").toLowerCase();

    let isMeleeOrRangedWeapon = false;
    let isMeleeWeapon = false;
    let isRangedWeapon = false;

    const mutTypeFlags = (tags: string): void => {
        if (tags.includes("m") && tags.includes("r")) isMeleeOrRangedWeapon = true;
        else if (tags.includes("m")) isMeleeWeapon = true;
        else if (tags.includes("r")) isRangedWeapon = true;
    };

    // Upstream checks both {@atk ...} and {@atkr ...}
    content.replace(/{@atk (?<tags>[^}]+)}/gi, (...args: any[]) => {
        const tags = args[args.length - 1]?.tags ?? args[1] ?? "";
        if (!String(tags).toLowerCase().includes("w")) return "";
        mutTypeFlags(String(tags).toLowerCase());
        return "";
    });
    content.replace(/{@atkr (?<tags>[^}]+)}/gi, (...args: any[]) => {
        const tags = args[args.length - 1]?.tags ?? args[1] ?? "";
        mutTypeFlags(String(tags).toLowerCase());
        return "";
    });

    const combined = `${lowName} ${lowContent}`;
    const hasWeaponSubstr = (list: string[]): boolean => list.some(w => combined.includes(w));

    if (isMeleeOrRangedWeapon) {
        // thrown finesse > finesse > thrown > null
        if (hasWeaponSubstr(WEAPONS_THROWN_FINESSE)) return "dex";
        if (hasWeaponSubstr(WEAPONS_FINESSE)) return "dex";
        if (hasWeaponSubstr(WEAPONS_THROWN)) return "str";
        return null;
    }
    if (isMeleeWeapon) {
        if (hasWeaponSubstr(WEAPONS_FINESSE)) return "dex";
        return "str";
    }
    if (isRangedWeapon) {
        if (hasWeaponSubstr(WEAPONS_THROWN)) return "str";
        return "dex";
    }
    return null;
}

export function getAbilBeingScaled(params: {
    strMod: number;
    dexMod: number;
    modFromAbil: number | null;
    name?: string;
    content?: string;
}): "str" | "dex" | null {
    const { strMod, dexMod, modFromAbil, name, content } = params;
    if (name == null || modFromAbil == null) return null;
    if (strMod === dexMod && strMod === modFromAbil) {
        return guessModFromWeaponTags(name, content || "");
    }
    if (strMod === modFromAbil) return "str";
    if (dexMod === modFromAbil) return "dex";
    return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Step 4: To-Hit & Save DCs (HitSave) — upstream-accurate
// ────────────────────────────────────────────────────────────────────────────

function scaleHitSave(mon: any, crIn: number, crOut: number, state: ScaleCreatureState, legacy: ScalingState): void {
    const idealHitIn = crToAtk(crIn);
    const idealHitOut = crToAtk(crOut);
    const idealDcIn = crToDc(crIn);
    const idealDcOut = crToDc(crOut);
    const pbIn = crToPb(crIn);
    const pbOut = crToPb(crOut);

    const strModOrig = abilityMod(state.getOriginalScore("str"));
    const dexModOrig = abilityMod(state.getOriginalScore("dex"));

    let primarySpellAbility: string | undefined;
    if (Array.isArray(mon.spellcasting) && mon.spellcasting.length > 0) {
        primarySpellAbility = mon.spellcasting[0]?.ability;
    }

    const getAdjustedHitFlat = (toHitIn: number): number => {
        if (crIn < crOut) return toHitIn + (idealHitOut - idealHitIn);
        return getScaledToRatio(toHitIn, idealHitIn, idealHitOut);
    };

    const handleHit = (str: string, name: string | null): string => {
        const offsetEnchant = name != null ? getEnchantBonus(name) : 0;
        return str.replace(/{@hit ([+-]?\d+)}/g, (m0, m1) => {
            const curToHit = Number(m1);

            const modFromAbil = curToHit - (offsetEnchant + pbOut);
            const modFromAbilExpertise = curToHit - (offsetEnchant + pbOut * 2);
            const modFromAbilNoProf = curToHit - offsetEnchant;

            const candidates: Array<{ abil: "str" | "dex" | null; profMult: number; mod: number }> = [
                { abil: getAbilBeingScaled({ strMod: strModOrig, dexMod: dexModOrig, modFromAbil, name: name ?? undefined, content: str }), profMult: 1, mod: modFromAbil },
                { abil: getAbilBeingScaled({ strMod: strModOrig, dexMod: dexModOrig, modFromAbil: modFromAbilExpertise, name: name ?? undefined, content: str }), profMult: 2, mod: modFromAbilExpertise },
                { abil: getAbilBeingScaled({ strMod: strModOrig, dexMod: dexModOrig, modFromAbil: modFromAbilNoProf, name: name ?? undefined, content: str }), profMult: 0, mod: modFromAbilNoProf },
            ];

            let chosen: { abil: "str" | "dex" | null; profMult: number; mod: number } | null = null;
            for (const c of candidates) if (c.abil) { chosen = c; break; }
            const abil = chosen?.abil ?? null;
            const profMult = chosen ? chosen.profMult : 1;
            const resolvedModFromAbil = chosen ? chosen.mod : modFromAbil;

            const pbInMult = profMult * pbIn;
            const pbOutMult = profMult * pbOut;

            const origToHitNoEnch = curToHit + (pbInMult - pbOutMult) - offsetEnchant;
            const targetToHitNoEnch = getAdjustedHitFlat(origToHitNoEnch);

            if (origToHitNoEnch === targetToHitNoEnch) return m0;

            if (abil != null) {
                const modDiff = (targetToHitNoEnch - pbOutMult) - (origToHitNoEnch - pbInMult);
                const modFromAbilOut = resolvedModFromAbil + modDiff;
                state.addCandidateAbilityMod(abil, modFromAbilOut);
                if (abil === "str") legacy.strCandidates.push(modFromAbilOut);
                else if (abil === "dex") legacy.dexCandidates.push(modFromAbilOut);
            }

            return `{@hit ${targetToHitNoEnch + offsetEnchant}}`;
        });
    };

    const handleDc = (str: string, castingAbility: string | null): string => {
        // Normalise plaintext DC to tag first (mirrors upstream)
        let out = str.replace(/DC (\d+)/g, (_m, m1) => `{@dc ${m1}}`);
        out = out.replace(/{@dc (\d+)(?:\|[^}]+)?}/g, (m0, m1) => {
            const curDc = Number(m1);
            const origDc = curDc + pbIn - pbOut;
            const outDc = Math.max(10, origDc + (idealDcOut - idealDcIn));
            if (curDc === outDc) return m0;
            if (castingAbility && ["int", "wis", "cha"].includes(castingAbility.toLowerCase()) && !state.getHasModifiedAbilityScore(castingAbility.toLowerCase())) {
                const dcDiff = outDc - origDc;
                const curMod = abilityMod(mon[castingAbility.toLowerCase()] ?? 10);
                mon[castingAbility.toLowerCase()] = calcNewAbility(mon, castingAbility.toLowerCase(), curMod + dcDiff + pbIn - pbOut);
                state.setHasModifiedAbilityScore(castingAbility.toLowerCase());
                legacy.modifiedAbilities.add(castingAbility.toLowerCase());
            }
            return `{@dc ${outDc}}`;
        });
        return out;
    };

    // Use JSON walker for accuracy but keep name context for hit ability detection
    // For generic entries we need per-entry name
    const fields = ["trait", "action", "bonus", "reaction", "legendary", "mythic", "variant"] as const;
    for (const prop of fields) {
        if (!Array.isArray(mon[prop])) continue;
        for (const entSub of mon[prop]) {
            if (!entSub?.entries) continue;
            // Walk entries via stringify to catch nested structures, but also preserve name-based detection
            // We'll do a per-entry JSON walk with name context via custom replacer?
            // Simpler: process entries with handler that has name knowledge using recursion
            const walkWithName = (entry: any): any => {
                if (typeof entry === "string") {
                    let s = handleHit(entry, entSub.name ?? null);
                    s = handleDc(s, null);
                    return s;
                }
                if (Array.isArray(entry)) return entry.map(walkWithName);
                if (typeof entry === "object" && entry !== null) {
                    const copy: any = {};
                    for (const [k, v] of Object.entries(entry)) copy[k] = walkWithName(v);
                    return copy;
                }
                return entry;
            };
            entSub.entries = walkWithName(entSub.entries);
        }
    }

    // Spellcasting headerEntries — only DC handling (hits also possible but rare)
    if (Array.isArray(mon.spellcasting)) {
        for (const sc of mon.spellcasting) {
            if (!Array.isArray(sc.headerEntries)) continue;
            const walk = (entry: any): any => {
                if (typeof entry === "string") {
                    let s = handleDc(entry, sc.ability ?? primarySpellAbility ?? null);
                    s = handleHit(s, null);
                    return s;
                }
                if (Array.isArray(entry)) return entry.map(walk);
                if (typeof entry === "object" && entry !== null) {
                    const copy: any = {};
                    for (const [k, v] of Object.entries(entry)) copy[k] = walk(v);
                    return copy;
                }
                return entry;
            };
            sc.headerEntries = walk(sc.headerEntries);
        }
    }

    // Note: upstream clears candidates after setting temp for both str/dex, but we need to call per-abil without clearing the other
    // So we implement directly without clearing until both done
    const strCands = state.getCandidateAbilityMods("str");
    const dexCands = state.getCandidateAbilityMods("dex");
    const getMostFrequent = (arr: number[]): number | undefined => {
        if (arr.length === 0) return undefined;
        const counts = new Map<number, number>();
        let max = 0;
        let best = arr[0];
        for (const v of arr) {
            const c = (counts.get(v) || 0) + 1;
            counts.set(v, c);
            if (c > max) { max = c; best = v; }
        }
        return best;
    };
    const strMost = getMostFrequent(strCands);
    const dexMost = getMostFrequent(dexCands);
    if (strMost !== undefined) {
        state.setTempAbilityMod("str", strMost);
        legacy.tempStrMod = strMost;
    }
    if (dexMost !== undefined) {
        state.setTempAbilityMod("dex", dexMost);
        legacy.tempDexMod = dexMost;
    }
    // Clear candidates after setting temp (mirrors upstream _doFinalize)
    state.clearCandidateAbilityMods();
}

// ────────────────────────────────────────────────────────────────────────────
// Step 5: DPR / Damage Expressions — upstream DamageExpression engine
// ────────────────────────────────────────────────────────────────────────────

function scaleDpr(mon: any, crIn: number, crOut: number, state: ScaleCreatureState, legacy: ScalingState): void {
    const dprRangeIn = CR_DPR_RANGES[String(crIn)];
    const dprRangeOut = CR_DPR_RANGES[String(crOut)];
    if (!dprRangeIn || !dprRangeOut) return;

    const dprAverageIn = getRangeMean(dprRangeIn);
    const dprAverageOut = getRangeMean(dprRangeOut);
    const crOutDprVariance = (dprRangeOut[1] - dprRangeOut[0]) / 2;

    const originalStrMod = abilityMod(state.getOriginalScore("str"));
    const originalDexMod = abilityMod(state.getOriginalScore("dex"));

    // Helper to get damage mod target for fallback
    const getAdjustedDamageMod = (opts: {
        abilBeingScaled: "str" | "dex" | null;
        strTmpMod: number | null;
        dexTmpMod: number | null;
        modFromAbil: number | null;
        offsetEnchant?: number;
    }): number => {
        const { abilBeingScaled, strTmpMod, dexTmpMod, modFromAbil, offsetEnchant = 0 } = opts;
        if (abilBeingScaled === "str" && strTmpMod != null) return strTmpMod;
        if (abilBeingScaled === "dex" && dexTmpMod != null) return dexTmpMod;
        if (modFromAbil == null) return 0 - offsetEnchant;
        return interpAndTranslateToSpace(modFromAbil, CR_TO_ESTIMATED_DAMAGE_MOD[String(crIn)] ?? [0, 3], CR_TO_ESTIMATED_DAMAGE_MOD[String(crOut)] ?? [0, 3]);
    };

    // DamageExpression.State emulation
    class DprState {
        dprTargetRange: [number, number];
        prefix: string;
        suffix: string;
        numDice: number;
        dprAdjusted: number;
        diceFaces: number;
        offsetEnchant: number;
        isAllowAdjustingMod: boolean;
        numDiceOut: number;
        diceFacesOut: number;
        modOut: number;

        constructor(opts: { dprTargetRange: [number, number]; prefix: string; suffix: string; numDice: number; dprAdjusted: number; diceFaces: number; modOut: number; offsetEnchant?: number; isAllowAdjustingMod?: boolean }) {
            this.dprTargetRange = opts.dprTargetRange;
            this.prefix = opts.prefix;
            this.suffix = opts.suffix;
            this.numDice = opts.numDice;
            this.dprAdjusted = opts.dprAdjusted;
            this.diceFaces = opts.diceFaces;
            this.offsetEnchant = opts.offsetEnchant ?? 0;
            this.isAllowAdjustingMod = opts.isAllowAdjustingMod ?? true;
            this.numDiceOut = opts.numDice;
            this.diceFacesOut = opts.diceFaces;
            this.modOut = opts.modOut;
        }

        isInRange(num: number): boolean {
            return num >= this.dprTargetRange[0] && num <= this.dprTargetRange[1];
        }

        getDiceExpression({ numDice, diceFaces, mod }: { numDice?: number; diceFaces?: number; mod?: number } = {}): string {
            const nd = numDice ?? this.numDiceOut;
            const df = diceFaces ?? this.diceFacesOut;
            const m = mod ?? this.modOut;
            const ptDice = df === 1 ? String((nd || 1) * df) : `${nd}d${df}`;
            const ptMod = m !== 0 ? ` ${m > 0 ? "+" : ""} ${m}` : "";
            return `${ptDice}${ptMod}`;
        }
    }

    const getNextDice = (faces: number): number => {
        const order = [4, 6, 8, 10, 12, 20];
        const idx = order.indexOf(faces);
        return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : 20;
    };
    const getPrevDice = (faces: number): number => {
        if (faces === 4) return 1;
        const order = [4, 6, 8, 10, 12, 20];
        const idx = order.indexOf(faces);
        return idx > 0 ? order[idx - 1] : 1;
    };

    const tryAdjustNumDice = (st: DprState, diceFacesTemp: number | null = null): boolean => {
        const dfTemp = diceFacesTemp ?? st.diceFacesOut;
        let numDiceTemp = st.numDice;
        let tempAvg = getDiceExpressionAverage(st.getDiceExpression({ numDice: numDiceTemp, diceFaces: dfTemp }));
        const dir = st.dprAdjusted < tempAvg ? -1 : 1;
        while ((dir === 1 || numDiceTemp > 1) && (dir === 1 ? tempAvg <= st.dprTargetRange[1] : tempAvg >= st.dprTargetRange[0])) {
            numDiceTemp += dir;
            tempAvg += dir * ((dfTemp + 1) / 2);
            if (st.isInRange(getDiceExpressionAverage(st.getDiceExpression({ numDice: numDiceTemp, diceFaces: dfTemp })))) {
                st.numDiceOut = numDiceTemp;
                return true;
            }
        }
        return false;
    };

    const tryAdjustDiceFaces = (st: DprState): boolean => {
        if (st.diceFaces === 1 || st.diceFaces === 20) return false;
        const dirs = getDiceExpressionAverage(st.getDiceExpression({ diceFaces: st.diceFaces })) > st.dprAdjusted ? [-1, 1] : [1, -1];
        for (const dir of dirs) {
            let diceFacesTemp = st.diceFaces;
            while (dir === 1 ? diceFacesTemp < 20 : diceFacesTemp > 1) {
                diceFacesTemp = dir === 1 ? getNextDice(diceFacesTemp) : getPrevDice(diceFacesTemp);
                const avg = getDiceExpressionAverage(st.getDiceExpression({ diceFaces: diceFacesTemp }));
                if (st.isInRange(avg)) {
                    st.diceFacesOut = diceFacesTemp;
                    return true;
                }
                if (tryAdjustNumDice(st, diceFacesTemp)) {
                    st.diceFacesOut = diceFacesTemp;
                    return true;
                }
            }
        }
        return false;
    };

    const getScaled = (opts: {
        dprTargetRange: [number, number];
        prefix: string;
        suffix: string;
        numDice: number;
        dprAdjusted: number;
        diceFaces: number;
        modOut: number;
        offsetEnchant?: number;
        isAllowAdjustingMod?: boolean;
    }): { expression: string; modOut: number } => {
        const st = new DprState(opts);
        const MAX_ATTEMPTS = 100;
        for (let ix = 0; ix < MAX_ATTEMPTS; ++ix) {
            if (st.isInRange(getDiceExpressionAverage(st.getDiceExpression()))) {
                // build output
                const diceExpOut = st.getDiceExpression({ numDice: st.numDiceOut, diceFaces: st.diceFacesOut, mod: st.modOut + st.offsetEnchant });
                const avgOut = Math.floor(getDiceExpressionAverage(diceExpOut));
                if (avgOut <= 0 || diceExpOut === "1") {
                    return { expression: `1 ${st.suffix.replace(/^\W+/, " ").replace(/ +/, " ")}`.trim(), modOut: st.modOut };
                }
                const expression = [Math.floor(getDiceExpressionAverage(diceExpOut)), st.prefix, diceExpOut, st.suffix].filter(Boolean).join("");
                return { expression, modOut: st.modOut };
            }
            if (tryAdjustNumDice(st)) continue;
            if (tryAdjustDiceFaces(st)) continue;
            if (!st.isAllowAdjustingMod) throw new Error(`Failed to find new DPR! ${st.getDiceExpression()}`);
            st.modOut += (1 - (ix % 2) * 2) * (ix + 1);
        }
        throw new Error(`Failed to find new DPR! ${st.getDiceExpression()}`);
    };

    // Track dprMax for attribute re-calc priority (upstream)
    let dprMax = 0;

    const processProp = (prop: string, scaledEntries: any[]): boolean => {
        if (!Array.isArray(mon[prop])) return true;
        let allSucceeded = true;
        for (let idx = 0; idx < mon[prop].length; idx++) {
            const it = mon[prop][idx];
            if (!it?.entries) continue;
            const toUpdate = JSON.stringify(it.entries);
            let out = toUpdate;

            const offsetEnchant = getEnchantBonus(it.name);

            // Flat damage first (upstream handles flat values before dice)
            // Regex for flat damage: prefix + number + suffix (without dice)
            // We skip flat handling in simplified version, but ratio could be applied
            // Instead rely on dice path; flat fallback scaling is max(1, dprAdjusted) when dice missing

            const reqAbilAdjust: any[] = [];

            // Damage dice regex — matches "14 (2d8 + 5) slashing" etc as well as {@damage ...}
            // We need two replacements: {@damage ...} tags and parenthesized dice expressions
            // Use upstream REGEX_DAMAGE_DICE approximation: average + (dice) + type

            // First handle {@damage ...} / {@scaledamage ...} / {@scaledice ...}
            out = out.replace(/{@(damage|scaledamage|scaledice) ([^}]+)}/gi, (_m, tag, expr) => {
                const diceExpRaw = expr.trim();
                // diceExp may include damage type? upstream splits dice vs type via renderer; we assume raw is dice only
                // We'll parse as dice formula
                const diceOnly = diceExpRaw.split(" ")[0]; // naive
                const { dprTargetRange, numDice, dprAdjusted, diceFaces, modFromAbil } = (() => {
                    const cleaned = diceOnly.replace(/\s+/g, "");
                    const avgDpr = getDiceExpressionAverage(cleaned);
                    const dprAdj = getScaledDpr({ dprIn: avgDpr, crInNumber: crIn, dprTargetIn: dprAverageIn, dprTargetOut: dprAverageOut });
                    const range: [number, number] = [Math.max(0, Math.floor(dprAdj - crOutDprVariance)), Math.ceil(Math.max(1, dprAdj + crOutDprVariance))];
                    const [dice, modifier] = cleaned.split(/[-+]/);
                    const [nDice, dFaces] = dice.split("d").map(Number);
                    const mod = modifier ? Number(modifier) - offsetEnchant : null;
                    return { dprTargetRange: range, numDice: nDice || 1, dprAdjusted: dprAdj, diceFaces: dFaces || 6, modFromAbil: mod };
                })();

                const abilBeingScaled = getAbilBeingScaled({ strMod: originalStrMod, dexMod: originalDexMod, modFromAbil, name: it.name, content: toUpdate });

                const strTmp = state.getTempAbilityMod("str");
                const dexTmp = state.getTempAbilityMod("dex");
                const modOut = getAdjustedDamageMod({ abilBeingScaled, strTmpMod: strTmp, dexTmpMod: dexTmp, modFromAbil, offsetEnchant });

                const isAllowAdjustingMod = modFromAbil != null;

                const { expression, modOut: modOutScaled } = getScaled({
                    dprTargetRange,
                    prefix: "",
                    suffix: "",
                    numDice,
                    dprAdjusted,
                    diceFaces,
                    modOut,
                    offsetEnchant,
                    isAllowAdjustingMod,
                });

                // Post-calc ability handling
                if (abilBeingScaled != null) {
                    // Priority handling similar to upstream
                    if (state.getTempAbilityMod(abilBeingScaled) != null && state.getTempAbilityMod(abilBeingScaled) !== modOutScaled) {
                        if (dprMax < dprAdjusted) {
                            state.setTempAbilityMod(abilBeingScaled, modOutScaled);
                            if (abilBeingScaled === "str") legacy.tempStrMod = modOutScaled;
                            else legacy.tempDexMod = modOutScaled;
                            dprMax = dprAdjusted;
                            allSucceeded = false;
                            return _m;
                        }
                    }
                    dprMax = Math.max(dprMax, dprAdjusted);
                    state.setTempAbilityMod(abilBeingScaled, modOutScaled);
                    if (abilBeingScaled === "str") legacy.tempStrMod = modOutScaled;
                    else legacy.tempDexMod = modOutScaled;
                }

                reqAbilAdjust.push({ ability: abilBeingScaled, mod: modOutScaled, dprAdjusted });
                return `{@${tag} ${expression}}`;
            });

            if (!allSucceeded) return false;

            // Handle parenthesized dice: "14 (2d8 + 5) bludgeoning damage" etc
            // Pattern: number ( dice ) optionally type
            // We need to preserve prefix/suffix structure for getScaled output (prefix is the leading avg? upstream uses prefix/suffix around dice)
            out = out.replace(/(\d+)\s*\(((\d+)?d\d+(?:\s*[+-]\s*\d+)?)\)(?:\s+([a-zA-Z]+))?/g, (_m0, avgStr, diceFormula, _count, type) => {
                const oldAvg = avgStr ? parseInt(avgStr, 10) : getDiceExpressionAverage(diceFormula);
                const dprAdjusted = getScaledDpr({ dprIn: oldAvg, crInNumber: crIn, dprTargetIn: dprAverageIn, dprTargetOut: dprAverageOut });
                const dprTargetRange: [number, number] = [Math.max(0, Math.floor(dprAdjusted - crOutDprVariance)), Math.ceil(Math.max(1, dprAdjusted + crOutDprVariance))];

                const match = /^\s*(\d+)?d(\d+)(?:\s*([+-])\s*(\d+))?\s*$/i.exec(diceFormula.trim());
                if (!match) {
                    const flatVal = Math.max(1, dprAdjusted);
                    return type ? `${flatVal} ${type}` : `${flatVal}`;
                }
                const count = match[1] ? parseInt(match[1], 10) : 1;
                const faces = parseInt(match[2], 10);
                const sign = match[3] === "-" ? -1 : 1;
                const mod = match[4] ? sign * parseInt(match[4], 10) : 0;
                const rawMod = mod - offsetEnchant;

                const abilBeingScaled = getAbilBeingScaled({ strMod: originalStrMod, dexMod: originalDexMod, modFromAbil: rawMod, name: it.name, content: toUpdate });
                const strTmp = state.getTempAbilityMod("str");
                const dexTmp = state.getTempAbilityMod("dex");
                const desiredMod = getAdjustedDamageMod({ abilBeingScaled, strTmpMod: strTmp, dexTmpMod: dexTmp, modFromAbil: rawMod, offsetEnchant });
                const prefix = " (";
                const suffix = type ? `) ${type}` : ")";

                const { expression } = getScaled({
                    dprTargetRange,
                    prefix,
                    suffix,
                    numDice: count,
                    dprAdjusted,
                    diceFaces: faces,
                    modOut: desiredMod,
                    offsetEnchant,
                    isAllowAdjustingMod: rawMod != null,
                });

                return expression;
            });

            if (!allSucceeded) return false;

            // Also handle bare {@damage} without avg? Already done. Handle flat damage flatVal case where dice missing: upstream does REGEX_DAMAGE_FLAT
            // Simplified flat: number + type without dice — scale via dpr ratio
            out = out.replace(/(^|[^0-9d])(\d+)( [a-zA-Z]+ damage)/g, (m0: string) => m0);

            if (toUpdate !== out) {
                scaledEntries.push({ prop, idx, entriesStrOriginal: toUpdate, entriesStr: out, reqAbilAdjust });
            }
        }
        return allSucceeded;
    };

    // Outer retry loop (99 iter) mirroring upstream Dpr._doAdjustDpr
    let scaledEntries: any[] | null = null;
    for (let i = 0; i < 99; ++i) {
        const candidate: any[] = [];
        let ok = true;
        // Reset dprMax per outer loop? Upstream keeps stateDpr.dprMax across loops via state object that persists
        ok = processProp("trait", candidate) && ok;
        if (!ok) { scaledEntries = null; continue; }
        ok = processProp("action", candidate) && ok;
        if (!ok) { scaledEntries = null; continue; }
        ok = processProp("bonus", candidate) && ok;
        if (!ok) { scaledEntries = null; continue; }
        ok = processProp("reaction", candidate) && ok;
        if (!ok) { scaledEntries = null; continue; }
        ok = processProp("legendary", candidate) && ok;
        if (!ok) { scaledEntries = null; continue; }
        ok = processProp("mythic", candidate) && ok;
        if (!ok) { scaledEntries = null; continue; }
        ok = processProp("variant", candidate) && ok;
        if (!ok) { scaledEntries = null; continue; }
        scaledEntries = candidate;
        break;
    }

    if (scaledEntries) {
        for (const it of scaledEntries) {
            try {
                mon[it.prop][it.idx].entries = JSON.parse(it.entriesStr);
            } catch {
                // fallback: keep original
            }
        }
    }

    // Finalize Str/Dex — only if temp mods exist (candidates were detected)
    // Upstream _doFinalize_updateAbility checks getTempAbilityMod != null
    if (state.getTempAbilityMod("str") != null) {
        state.setHasModifiedAbilityScore("str");
        legacy.modifiedAbilities.add("str");
        const newStr = calcNewAbility(mon, "str", state.getTempAbilityMod("str")!);
        mon.str = newStr;
    }
    if (state.getTempAbilityMod("dex") != null) {
        state.setHasModifiedAbilityScore("dex");
        legacy.modifiedAbilities.add("dex");
        const newDex = calcNewAbility(mon, "dex", state.getTempAbilityMod("dex")!);
        mon.dex = newDex;
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Step 7: Armor Class — gated dispatcher
// ────────────────────────────────────────────────────────────────────────────

function scaleAc(mon: any, crIn: number, crOut: number, state: ScaleCreatureState, _legacy: ScalingState): void {
    if (!mon.ac || !Array.isArray(mon.ac) || mon.ac.length === 0) return;

    const idealAcIn = crToAc(crIn);
    const idealAcOut = crToAc(crOut);

    // Pre-adjust AC for existing tempDex (mirror _doPreAdjustAcs)
    const doPreAdjustAcs = (acItem: any): void => {
        if (!state.getHasModifiedAbilityScore("dex") || mon.dex === state.getOriginalScore("dex")) return;
        if (!acItem?.from) return;

        const origDexMod = abilityMod(state.getOriginalScore("dex"));
        const curDexMod = abilityMod(mon.dex);
        if (origDexMod === curDexMod) return;

        const isMageArmor = acItem.condition && String(acItem.condition).toLowerCase().includes("@spell mage armor");
        if (isMageArmor) {
            acItem._acBeforePreAdjustment = acItem.ac;
            acItem.ac = 13 + curDexMod;
            return;
        }

        // Light/medium armor detection via tag strings
        const fromStr = JSON.stringify(acItem.from).toLowerCase();
        const lightTags = ["padded armor", "leather armor", "studded leather armor"];
        const mediumTags = ["hide armor", "chain shirt", "scale mail", "breastplate", "half plate armor"];

        for (const tag of lightTags) {
            if (fromStr.includes(tag)) {
                acItem._acBeforePreAdjustment = acItem.ac;
                acItem.ac = acItem.ac - origDexMod + curDexMod;
                return;
            }
        }
        for (const tag of mediumTags) {
            if (fromStr.includes(tag)) {
                const origMed = Math.min(2, origDexMod);
                const curMed = Math.min(2, curDexMod);
                const curAc = acItem.ac;
                acItem.ac = acItem.ac - origMed + curMed;
                if (curAc !== acItem.ac) acItem._acBeforePreAdjustment = curAc;
                return;
            }
        }
    };

    // Helper to get AC dispatcher — simplified upstream branches
    const getAdjustedAcItem = (acItem: any): any => {
        // Pure numeric AC without from — ratio path
        if (typeof acItem === "number") {
            const newAc = getScaledToRatio(acItem, idealAcIn, idealAcOut);
            return Math.max(1, newAc);
        }
        if (typeof acItem === "object" && typeof acItem.ac === "number" && (!acItem.from || acItem.from.length === 0)) {
            const newAc = getScaledToRatio(acItem.ac, idealAcIn, idealAcOut);
            return { ...acItem, ac: Math.max(1, newAc) };
        }

        // Gated dispatcher for ac.from
        if (typeof acItem === "object" && Array.isArray(acItem.from) && acItem.from.length > 0) {
            // Pre-adjust for dex
            doPreAdjustAcs(acItem);

            // Determine expected base for ratio vs actual
            const effectiveCurrent = acItem._acBeforePreAdjustment != null ? acItem._acBeforePreAdjustment : acItem.ac;
            const target = getScaledToRatio(effectiveCurrent, idealAcIn, idealAcOut);

            // Extract enchant total if any
            const fromStr = JSON.stringify(acItem.from);
            const enchMatch = /\+(\d+)/.exec(fromStr);
            const enchTotal = enchMatch ? Number(enchMatch[1]) : 0;

            // Dex cap and gear bonus simplified: we preserve armor tag, add misc offset
            // Try to keep armor type: pick first valid tag, retain it
            // If target > effectiveCurrent, consider bumping enchant or adding shield etc — simplified to ratio + enchant re-inject
            let outAc = target;

            // Handle dex cap for medium/heavy etc — simplified: cap dex contribution
            const origDexMod = abilityMod(state.getOriginalScore("dex"));
            const curDexMod = abilityMod(mon.dex);
            const dexMismatch = outAc - effectiveCurrent - (curDexMod - origDexMod);
            // If we can adjust dex and mismatch exists, do so (upstream prefers dex adjust before armor swap)
            if (!state.getHasModifiedAbilityScore("dex") && dexMismatch !== 0) {
                // Only adjust dex if no prior DPR dex set? DPR already may have set dex; respect that
                // For AC, if dex not yet modified, we can bump it
                // Limit dex change to within 1..30
                const newDexMod = curDexMod + dexMismatch;
                if (newDexMod >= -5 && newDexMod <= 10) {
                    const newDex = calcNewAbility(mon, "dex", newDexMod);
                    mon.dex = newDex;
                    state.setHasModifiedAbilityScore("dex");
                    _legacy.modifiedAbilities.add("dex");
                    // After adjusting dex, recompute target? upstream iterative loop does; we approximate
                    outAc = target;
                }
            }

            // Re-inject enchant
            if (enchTotal) outAc += 0; // ench already included in target via effectiveCurrent? For simplicity, keep as is
            // Ensure we account for enchant total preserved
            // If original had +1 chain mail etc, we keep +1; target already includes base, so add ench back if we stripped? We didn't strip, so keep.

            // Build output preserving from tags
            const out: any = { ...acItem, ac: Math.max(1, outAc) };
            delete out._acBeforePreAdjustment;
            delete out._enchTotal;
            delete out._gearBonus;
            delete out._dexCap;
            delete out._miscOffset;
            delete out._isShield;
            delete out._isDualShields;

            // Clean up internal fields we added
            if (Array.isArray(out.from)) {
                out.from = out.from.map((f: any) => (typeof f === "object" && f._ ? f._ : f));
            }

            // If AC item had condition mage armor, ensure it stays 13+dex
            if (out.condition && String(out.condition).toLowerCase().includes("mage armor")) {
                out.ac = 13 + abilityMod(mon.dex);
            }

            return out;
        }

        // Fallback ratio
        if (typeof acItem === "object" && typeof acItem.ac === "number") {
            const newAc = getScaledToRatio(acItem.ac, idealAcIn, idealAcOut);
            return { ...acItem, ac: Math.max(1, newAc) };
        }
        return acItem;
    };

    mon.ac = mon.ac.map((acEntry: any) => getAdjustedAcItem(acEntry));
}

// ────────────────────────────────────────────────────────────────────────────
// Step 8: Propagate Ability Changes
// ────────────────────────────────────────────────────────────────────────────

function propagateAbilityChanges(mon: any, state: ScaleCreatureState, legacy: ScalingState): void {
    const toHandle = ["str", "dex", "int", "wis", "cha", "con"] as const;
    // Include con if modified via HP
    for (const abil of toHandle) {
        if (!state.getHasModifiedAbilityScore(abil) && !legacy.modifiedAbilities.has(abil)) continue;
        const oldScore = state.getOriginalScore(abil) ?? legacy.origScores[abil] ?? 10;
        const newScore = mon[abil] ?? 10;
        const oldMod = abilityMod(oldScore);
        const newMod = abilityMod(newScore);
        const diff = newMod - oldMod;
        if (diff === 0) continue;

        // Saves
        if (mon.save && mon.save[abil] !== undefined) {
            const curSave = parseInt(String(mon.save[abil]), 10);
            if (!isNaN(curSave)) {
                const updated = curSave + diff;
                mon.save[abil] = intToBonus(updated);
            }
        }

        // Skills
        if (mon.skill && typeof mon.skill === "object") {
            const updateObj = (obj: Record<string, any>): void => {
                for (const [skillName, val] of Object.entries(obj)) {
                    if (skillName === "other") continue;
                    if (SKILL_TO_ABILITY[skillName.toLowerCase()] === abil) {
                        const curSkill = parseInt(String(val), 10);
                        if (!isNaN(curSkill)) {
                            const updated = curSkill + diff;
                            obj[skillName] = intToBonus(updated);
                        }
                    }
                }
            };

            updateObj(mon.skill);
            if (Array.isArray(mon.skill.other)) {
                for (const item of mon.skill.other) {
                    if (item?.oneOf) updateObj(item.oneOf);
                }
            }
        }

        // Wisdom -> Passive Perception
        if (abil === "wis") {
            if (typeof mon.passive === "number") {
                mon.passive += diff;
            } else if (typeof mon.passive === "string") {
                delete mon.passive;
            }
        }
    }
}

// ────────────────────────────────────────────────────────────────────────────
// String Traversal Helpers (kept for DPR walk fallback, PB now uses JSON walk)
// ────────────────────────────────────────────────────────────────────────────

export function walkMonsterStrings(mon: any, transform: (str: string) => string): void {
    const fields = ["trait", "action", "bonus", "reaction", "legendary", "mythic", "variant"];
    for (const f of fields) {
        if (Array.isArray(mon[f])) {
            mon[f] = mon[f].map((entry: any) => transformEntry(entry, transform));
        }
    }
}

export function processNamedEntries(mon: any, transform: (name: string, content: string) => string): void {
    const fields = ["trait", "action", "bonus", "reaction", "legendary", "mythic", "variant"];
    for (const f of fields) {
        if (Array.isArray(mon[f])) {
            mon[f] = mon[f].map((item: any) => {
                if (item && typeof item === "object") {
                    const actionName = item.name || "";
                    if (Array.isArray(item.entries)) {
                        item.entries = item.entries.map((entry: any) => transformEntry(entry, str => transform(actionName, str)));
                    } else if (typeof item.entry === "string") {
                        item.entry = transform(actionName, item.entry);
                    }
                } else if (typeof item === "string") {
                    return transform("", item);
                }
                return item;
            });
        }
    }
}

function transformEntry(entry: any, transform: (str: string) => string): any {
    if (typeof entry === "string") return transform(entry);
    if (Array.isArray(entry)) return entry.map(e => transformEntry(e, transform));
    if (typeof entry === "object" && entry !== null) {
        const copy: any = {};
        for (const [k, v] of Object.entries(entry)) copy[k] = transformEntry(v, transform);
        return copy;
    }
    return entry;
}
