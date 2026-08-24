/**
 * 5e.tools CR Scaler Implementation
 * Based on 5etools js/scalecreature/ and the 2014 DMG p. 274 monster statistics.
 */

import type { Monster } from "../api";

// ────────────────────────────────────────────────────────────────────────────
// Reference Tables & Constants
// ────────────────────────────────────────────────────────────────────────────

export const CR_HP_RANGES: Record<number, [number, number]> = {
    0: [1, 6],
    0.125: [7, 35],
    0.25: [36, 49],
    0.5: [50, 70],
    1: [71, 85],
    2: [86, 100],
    3: [101, 115],
    4: [116, 130],
    5: [131, 145],
    6: [146, 160],
    7: [161, 175],
    8: [176, 190],
    9: [191, 205],
    10: [206, 220],
    11: [221, 235],
    12: [236, 250],
    13: [251, 265],
    14: [266, 280],
    15: [281, 295],
    16: [296, 310],
    17: [311, 325],
    18: [326, 340],
    19: [341, 355],
    20: [356, 400],
    21: [401, 445],
    22: [446, 490],
    23: [491, 535],
    24: [536, 580],
    25: [581, 625],
    26: [626, 670],
    27: [671, 715],
    28: [716, 760],
    29: [761, 805],
    30: [806, 850],
};

export const CR_DPR_RANGES: Record<number, [number, number]> = {
    0: [0, 1],
    0.125: [2, 3],
    0.25: [4, 5],
    0.5: [6, 8],
    1: [9, 14],
    2: [15, 20],
    3: [21, 26],
    4: [27, 32],
    5: [33, 38],
    6: [39, 44],
    7: [45, 50],
    8: [51, 56],
    9: [57, 62],
    10: [63, 68],
    11: [69, 74],
    12: [75, 80],
    13: [81, 86],
    14: [87, 92],
    15: [93, 98],
    16: [99, 104],
    17: [105, 110],
    18: [111, 116],
    19: [117, 122],
    20: [123, 140],
    21: [141, 158],
    22: [159, 176],
    23: [177, 194],
    24: [195, 212],
    25: [213, 230],
    26: [231, 248],
    27: [249, 266],
    28: [267, 284],
    29: [285, 302],
    30: [303, 320],
};

export const _ATK_CR_RANGES: Array<{ ideal: number; min: number; max: number }> = [
    { ideal: 3, min: -1, max: 2 },
    { ideal: 4, min: 3, max: 3 },
    { ideal: 5, min: 4, max: 4 },
    { ideal: 6, min: 5, max: 7 },
    { ideal: 7, min: 8, max: 10 },
    { ideal: 8, min: 11, max: 15 },
    { ideal: 9, min: 16, max: 16 },
    { ideal: 10, min: 17, max: 20 },
    { ideal: 11, min: 21, max: 23 },
    { ideal: 12, min: 24, max: 26 },
    { ideal: 13, min: 27, max: 29 },
    { ideal: 14, min: 30, max: 30 },
];

export const _DC_RANGES: Array<{ ideal: number; min: number; max: number }> = [
    { ideal: 13, min: -1, max: 3 },
    { ideal: 14, min: 4, max: 4 },
    { ideal: 15, min: 5, max: 7 },
    { ideal: 16, min: 8, max: 10 },
    { ideal: 17, min: 11, max: 12 },
    { ideal: 18, min: 13, max: 16 },
    { ideal: 19, min: 17, max: 20 },
    { ideal: 20, min: 21, max: 23 },
    { ideal: 21, min: 24, max: 26 },
    { ideal: 22, min: 27, max: 29 },
    { ideal: 23, min: 30, max: 30 },
];

export const _AC_CR_RANGES: Array<{ ideal: number; min: number; max: number }> = [
    { ideal: 13, min: -1, max: 3 },
    { ideal: 14, min: 4, max: 4 },
    { ideal: 15, min: 5, max: 7 },
    { ideal: 16, min: 8, max: 9 },
    { ideal: 17, min: 10, max: 12 },
    { ideal: 18, min: 13, max: 16 },
    { ideal: 19, min: 17, max: 30 },
];

export const CON_RANGE: Record<number, [number, number]> = {
    0: [-1, 2], 0.125: [-1, 1], 0.25: [0, 2], 0.5: [0, 2],
    1: [0, 2], 2: [0, 3], 3: [1, 3], 4: [1, 4],
    5: [2, 4], 6: [2, 5], 7: [1, 5], 8: [1, 5],
    9: [2, 5], 10: [2, 5], 11: [2, 6], 12: [1, 5],
    13: [3, 6], 14: [3, 6], 15: [3, 6], 16: [4, 7],
    17: [3, 7], 18: [1, 7], 19: [4, 6], 20: [5, 9],
    21: [3, 8], 22: [4, 9], 23: [5, 9], 24: [5, 9],
    25: [7, 9], 26: [7, 9], 27: [7, 9], 28: [7, 9], 29: [7, 9],
    30: [10, 10],
};

export const DAMAGE_MOD_RANGE: Record<number, [number, number]> = {
    0: [-1, 2], 0.125: [0, 2], 0.25: [0, 3], 0.5: [0, 3],
    1: [0, 3], 2: [1, 4], 3: [1, 4], 4: [2, 4],
    5: [2, 5], 6: [2, 5], 7: [2, 5], 8: [2, 5],
    9: [2, 6], 10: [3, 6], 11: [3, 6], 12: [3, 6],
    13: [3, 7], 14: [3, 7], 15: [3, 7], 16: [4, 8],
    17: [4, 8], 18: [4, 8], 19: [5, 8], 20: [6, 9],
    21: [6, 9], 22: [6, 10], 23: [6, 10], 24: [6, 11],
    25: [7, 11], 26: [7, 11], 27: [7, 11], 28: [8, 11],
    29: [8, 11], 30: [9, 11],
};

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

// ────────────────────────────────────────────────────────────────────────────
// Core Helpers (Section 3)
// ────────────────────────────────────────────────────────────────────────────

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
    let result = Math.max(1, (desiredMod + 5) * 2 + parity);
    if (result === 31) result = 30;
    return result;
}

export function diceAverage(expression: string): number {
    if (!expression) return 0;
    // Replace NdM with N * ((M+1)/2)
    const expanded = expression.replace(/(\d+)?d(\d+)/gi, (_, countStr, faceStr) => {
        const count = countStr ? parseInt(countStr, 10) : 1;
        const face = parseInt(faceStr, 10);
        return String(count * ((face + 1) / 2));
    });
    try {
        // Safe evaluation of basic arithmetic (+, -, *, /, numbers, decimals, parens)
        if (!/^[\d\s+\-*/.()]+$/.test(expanded)) return 0;
        // eslint-disable-next-line no-new-func
        const res = Function(`"use strict"; return (${expanded})`)();
        return typeof res === "number" && !isNaN(res) ? res : 0;
    } catch {
        return 0;
    }
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
    for (const r of _ATK_CR_RANGES) {
        if (cr >= r.min && cr <= r.max) return r.ideal;
    }
    return cr < 0 ? 3 : 14;
}

export function crToDc(cr: number): number {
    for (const r of _DC_RANGES) {
        if (cr >= r.min && cr <= r.max) return r.ideal;
    }
    return cr < 0 ? 13 : 23;
}

export function crToAc(cr: number): number {
    for (const r of _AC_CR_RANGES) {
        if (cr >= r.min && cr <= r.max) return r.ideal;
    }
    return cr < 0 ? 13 : 19;
}

function getRangeMean(range: [number, number]): number {
    return (range[0] + range[1]) / 2;
}

function getRangeHalfWidth(range: [number, number]): number {
    return (range[1] - range[0]) / 2;
}

// ────────────────────────────────────────────────────────────────────────────
// Deep Clone Helper
// ────────────────────────────────────────────────────────────────────────────

function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== "object") return obj;
    return JSON.parse(JSON.stringify(obj));
}

// ────────────────────────────────────────────────────────────────────────────
// Pipeline Implementation
// ────────────────────────────────────────────────────────────────────────────

interface ScalingState {
    origScores: Record<string, number>;
    modifiedAbilities: Set<string>;
    strCandidates: number[];
    dexCandidates: number[];
    tempStrMod?: number;
    tempDexMod?: number;
}

/**
 * Main function to scale a creature to a target CR.
 */
export function scaleMonster(originalMonster: Monster, crOutNumber: number): Monster {
    const origCrNum = crToNumber(originalMonster.cr);
    if (
        origCrNum === null ||
        typeof crOutNumber !== "number" ||
        isNaN(crOutNumber) ||
        origCrNum === crOutNumber ||
        origCrNum < 0 || origCrNum > 30 ||
        crOutNumber < 0 || crOutNumber > 30 ||
        !CR_HP_RANGES[origCrNum] ||
        !CR_HP_RANGES[crOutNumber]
    ) {
        return originalMonster;
    }

    const mon = deepClone(originalMonster);
    const crIn = origCrNum;
    const crOut = crOutNumber;

    const state: ScalingState = {
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
    scaleHp(mon, crIn, crOut, state);

    // Step 4: Scale To-Hit / Save DCs
    scaleHitSave(mon, crIn, crOut, state);

    // Step 5: Scale DPR / damage expressions
    scaleDpr(mon, crIn, crOut, state);

    // Step 7: Scale AC (Spellcasting step 6 is skipped per MVP)
    scaleAc(mon, crIn, crOut);

    // Step 8: Propagate ability score changes
    propagateAbilityChanges(mon, state);

    // Step 9: Finalize CR and flags
    const crOutStr = numberToCr(crOut);
    if (typeof mon.cr === "object" && mon.cr !== null && mon.cr.cr !== undefined) {
        mon.cr.cr = crOutStr;
    } else {
        mon.cr = crOutStr;
    }

    mon._displayName = `${mon.name} (CR ${crOutStr})`;
    mon._scaledCr = crOut;
    mon._isScaledCr = true;
    mon._originalCr = mon._originalCr ?? (typeof originalMonster.cr === "object" && originalMonster.cr !== null ? originalMonster.cr.cr : originalMonster.cr);

    return mon;
}

// ────────────────────────────────────────────────────────────────────────────
// Step 2: Proficiency Bonus
// ────────────────────────────────────────────────────────────────────────────

function applyProficiencyBonus(mon: any, crIn: number, crOut: number): void {
    const pbIn = crToPb(crIn);
    const pbOut = crToPb(crOut);
    const pbDelta = pbOut - pbIn;
    if (pbDelta === 0) return;

    // Saves
    if (mon.save && typeof mon.save === "object") {
        for (const [abil, bonusVal] of Object.entries(mon.save)) {
            const curBonus = parseInt(String(bonusVal), 10);
            if (isNaN(curBonus)) continue;
            const fromAbility = abilityMod(mon[abil] ?? 10);
            if (curBonus === fromAbility) continue; // No PB applied

            const actualPb = curBonus - fromAbility;
            const isExpert = actualPb === pbIn * 2;
            const newBonus = curBonus - (isExpert ? 2 * pbIn : pbIn) + (isExpert ? 2 * pbOut : pbOut);
            mon.save[abil] = newBonus >= 0 ? `+${newBonus}` : `${newBonus}`;
        }
    }

    // Skills
    if (mon.skill && typeof mon.skill === "object") {
        const updateSkillsObj = (skillObj: Record<string, any>) => {
            for (const [skillName, bonusVal] of Object.entries(skillObj)) {
                if (skillName === "other") continue;
                const curBonus = parseInt(String(bonusVal), 10);
                if (isNaN(curBonus)) continue;
                const abil = SKILL_TO_ABILITY[skillName.toLowerCase()] || "dex";
                const fromAbility = abilityMod(mon[abil] ?? 10);
                const actualPb = curBonus - fromAbility;
                const isExpert = actualPb === pbIn * 2;
                const newBonus = curBonus - (isExpert ? 2 * pbIn : pbIn) + (isExpert ? 2 * pbOut : pbOut);
                skillObj[skillName] = newBonus >= 0 ? `+${newBonus}` : `${newBonus}`;

                if (skillName.toLowerCase() === "perception" && typeof mon.passive === "number") {
                    mon.passive = 10 + newBonus;
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
    }

    // Text entries: replace {@hit N} and {@dc N} / DC N
    walkMonsterStrings(mon, (str) => {
        let updated = str.replace(/\{@hit ([+-]?\d+)\}/gi, (_, hitStr) => {
            const hitVal = parseInt(hitStr, 10);
            const newHit = hitVal + pbDelta;
            return `{@hit ${newHit >= 0 ? `${newHit}` : newHit}}`;
        });

        updated = updated.replace(/\{@dc (\d+)([^}]*)\}/gi, (_, dcStr, rest) => {
            const dcVal = parseInt(dcStr, 10);
            return `{@dc ${dcVal + pbDelta}${rest}}`;
        });

        updated = updated.replace(/\bDC (\d+)\b/g, (_, dcStr) => {
            const dcVal = parseInt(dcStr, 10);
            return `DC ${dcVal + pbDelta}`;
        });

        return updated;
    });
}

// ────────────────────────────────────────────────────────────────────────────
// Step 3: HP Scaling (Bug 1 Fix)
// ────────────────────────────────────────────────────────────────────────────

function scaleHp(mon: any, crIn: number, crOut: number, state: ScalingState): void {
    if (!mon.hp || mon.hp.special) return;

    const hpInAvg = getRangeMean(CR_HP_RANGES[crIn]);
    const hpOutMean = getRangeMean(CR_HP_RANGES[crOut]);
    const origAvg = typeof mon.hp.average === "number" ? mon.hp.average : hpInAvg;
    const targetHp = getScaledToRatio(origAvg, hpInAvg, hpOutMean);
    const band = getRangeHalfWidth(CR_HP_RANGES[crOut]);
    const targetRange: [number, number] = [Math.floor(targetHp - band), Math.ceil(targetHp + band)];

    const formula = mon.hp.formula;
    const match = formula ? /^(\d+)\s*d\s*(\d+)(?:\s*([+-])\s*(\d+))?$/i.exec(formula.trim()) : null;

    if (!match) {
        mon.hp = { special: Math.floor(Math.max(1, targetHp)), ...mon.hp };
        delete mon.hp.average;
        delete mon.hp.formula;
        return;
    }

    const origNumHd = parseInt(match[1], 10);
    const hdFaces = parseInt(match[2], 10);
    const sign = match[3] === "-" ? -1 : 1;
    const modTotal = match[4] ? sign * parseInt(match[4], 10) : 0;
    const modPerHd = Math.floor(modTotal / origNumHd);
    const hdAvg = (hdFaces + 1) / 2;

    const inConRange = CON_RANGE[crIn] || [0, 2];
    const outConRange = CON_RANGE[crOut] || [0, 2];
    const targetConMod = interpAndTranslateToSpace(modPerHd, inConRange, outConRange);

    let bestNumHd = origNumHd;
    let bestModPerHd = targetConMod;
    let found = false;

    const calcAvg = (count: number, mod: number) => Math.floor(count * hdAvg + count * mod);

    const initAvg = calcAvg(origNumHd, targetConMod);

    if (initAvg >= targetRange[0] && initAvg <= targetRange[1]) {
        bestNumHd = origNumHd;
        found = true;
    } else if (initAvg > targetRange[1]) {
        // Decrease numHd (min 1) until in band; stop at first in-band value
        for (let c = origNumHd - 1; c >= 1; c--) {
            const avg = calcAvg(c, targetConMod);
            if (avg <= targetRange[1] && avg >= targetRange[0]) {
                bestNumHd = c;
                found = true;
                break;
            }
        }
    } else if (initAvg < targetRange[0]) {
        // Increase numHd until in band
        for (let c = origNumHd + 1; c <= 300; c++) {
            const avg = calcAvg(c, targetConMod);
            if (avg >= targetRange[0] && avg <= targetRange[1]) {
                bestNumHd = c;
                found = true;
                break;
            }
        }
    }

    // Only if still out of range, adjust modifier with alternating steps: +1, -1, +2, -2...
    if (!found) {
        const deltas = [1, -1, 2, -2, 3, -3, 4, -4, 5, -5];
        for (const d of deltas) {
            const tryMod = Math.max(-5, targetConMod + d);
            const tryInitAvg = calcAvg(origNumHd, tryMod);
            if (tryInitAvg >= targetRange[0] && tryInitAvg <= targetRange[1]) {
                bestNumHd = origNumHd;
                bestModPerHd = tryMod;
                found = true;
                break;
            }
            if (tryInitAvg > targetRange[1]) {
                for (let c = origNumHd - 1; c >= 1; c--) {
                    const avg = calcAvg(c, tryMod);
                    if (avg <= targetRange[1] && avg >= targetRange[0]) {
                        bestNumHd = c;
                        bestModPerHd = tryMod;
                        found = true;
                        break;
                    }
                }
            } else {
                for (let c = origNumHd + 1; c <= 300; c++) {
                    const avg = calcAvg(c, tryMod);
                    if (avg >= targetRange[0] && avg <= targetRange[1]) {
                        bestNumHd = c;
                        bestModPerHd = tryMod;
                        found = true;
                        break;
                    }
                }
            }
            if (found) break;
        }
    }

    const finalModTotal = bestNumHd * bestModPerHd;
    const finalAvg = Math.floor(bestNumHd * hdAvg + finalModTotal);

    mon.hp.average = finalAvg;
    const modStr = finalModTotal !== 0 ? (finalModTotal > 0 ? ` + ${finalModTotal}` : ` - ${Math.abs(finalModTotal)}`) : "";
    mon.hp.formula = `${bestNumHd}d${hdFaces}${modStr}`;

    // If Con mod changed, update mon.con
    const oldConMod = abilityMod(state.origScores.con);
    if (bestModPerHd !== oldConMod) {
        mon.con = calcNewAbility(mon, "con", bestModPerHd);
        state.modifiedAbilities.add("con");
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Ability Detection Helpers (Bug 3 & 4 Fix)
// ────────────────────────────────────────────────────────────────────────────

const WEAPONS_FINESSE = ["dagger", "dart", "rapier", "scimitar", "shortsword", "whip"];
const WEAPONS_THROWN = ["handaxe", "javelin", "light hammer", "spear", "trident", "net"];
const WEAPONS_THROWN_FINESSE = ["dagger", "dart"];

function getEnchantBonus(name?: string): number {
    if (!name) return 0;
    const m = /^\+(\d+)\b/.exec(name.trim());
    return m ? parseInt(m[1], 10) : 0;
}

function guessModFromWeaponTags(name: string, content: string): "str" | "dex" | null {
    const lowName = (name || "").toLowerCase();
    const lowContent = (content || "").toLowerCase();
    const combined = `${lowName} ${lowContent}`;

    // Check @atk / @atkr tags
    const atkMatch = /\{@(atk|atkr)\s*([^}]+)?\}/i.exec(lowContent);
    if (!atkMatch) return null;

    const atkTag = atkMatch[1].toLowerCase();
    const atkVal = (atkMatch[2] || "").trim().toLowerCase();

    // Must include weapon context: tag is atkr, or value has "w" (mw, rw, mw,rw)
    const isWeapon = atkTag === "atkr" || atkVal.includes("w");
    if (!isWeapon) return null;

    const isMelee = atkVal.includes("m");
    const isRanged = atkVal.includes("r");

    const hasWeaponSubstr = (list: string[]) => list.some(w => combined.includes(w));

    if (isMelee && isRanged) {
        if (hasWeaponSubstr(WEAPONS_THROWN_FINESSE)) return "dex";
        if (hasWeaponSubstr(WEAPONS_FINESSE)) return "dex";
        if (hasWeaponSubstr(WEAPONS_THROWN)) return "str";
        return null;
    }

    if (isMelee) {
        if (hasWeaponSubstr(WEAPONS_FINESSE)) return "dex";
        return "str";
    }

    if (isRanged) {
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
    if (strMod === modFromAbil) {
        return "str";
    }
    if (dexMod === modFromAbil) {
        return "dex";
    }

    return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Step 4: To-Hit & Save DCs (HitSave) - Bug 2, 3, 5 Fix
// ────────────────────────────────────────────────────────────────────────────

function scaleHitSave(mon: any, crIn: number, crOut: number, state: ScalingState): void {
    const idealHitIn = crToAtk(crIn);
    const idealHitOut = crToAtk(crOut);
    const idealDcIn = crToDc(crIn);
    const idealDcOut = crToDc(crOut);
    const pbIn = crToPb(crIn);
    const pbOut = crToPb(crOut);

    const strModOrig = abilityMod(state.origScores.str);
    const dexModOrig = abilityMod(state.origScores.dex);

    // Spellcasting DC -> Int/Wis/Cha ability score update (Bug 2)
    const updateSpellcastingAbilityFromDc = (outDc: number, origDc: number, abilityKey?: string) => {
        if (!abilityKey) return;
        const key = abilityKey.toLowerCase();
        if (["int", "wis", "cha"].includes(key) && !state.modifiedAbilities.has(key)) {
            const dcDiff = outDc - origDc;
            const curMod = abilityMod(mon[key] ?? 10);
            mon[key] = calcNewAbility(mon, key, curMod + dcDiff + pbIn - pbOut);
            state.modifiedAbilities.add(key);
        }
    };

    // If spellcasting is present, identify primary casting ability
    let primarySpellAbility: string | undefined;
    if (Array.isArray(mon.spellcasting) && mon.spellcasting.length > 0) {
        primarySpellAbility = mon.spellcasting[0]?.ability;
    }

    // Process named entries
    processNamedEntries(mon, (name, content) => {
        let updatedContent = content;

        // Process {@hit N}
        updatedContent = updatedContent.replace(/\{@hit ([+-]?\d+)\}/gi, (_, hitStr) => {
            const curToHit = parseInt(hitStr, 10);
            const enchant = getEnchantBonus(name);

            // Recover pre-PB/enchant to-hit for scaling down
            let scaledHit: number;
            if (crIn < crOut) {
                scaledHit = curToHit + (idealHitOut - idealHitIn);
            } else {
                const recoveredPreAdj = curToHit - pbOut + pbIn - enchant;
                const scaledBase = getScaledToRatio(recoveredPreAdj, idealHitIn, idealHitOut);
                scaledHit = scaledBase + pbOut - pbIn + enchant;
            }

            // Only detect Str/Dex if this is a weapon attack (has 'w' in @atk tag, or uses atkr)
            const atkTagMatch = /\{@(atk|atkr)\s*([^}]*)}/i.exec(content);
            const isWeaponAttack = atkTagMatch && (
                atkTagMatch[1].toLowerCase() === "atkr" ||
                (atkTagMatch[2] || "").toLowerCase().includes("w")
            );

            if (isWeaponAttack) {
                // Find modFromAbil (try normal, expertise, no proficiency)
                const candidates = [
                    curToHit - pbOut - enchant,
                    curToHit - 2 * pbOut - enchant,
                    curToHit - enchant
                ];

                let detectedAbil: "str" | "dex" | null = null;
                let chosenModFromAbil: number | null = null;

                for (const c of candidates) {
                    const abil = getAbilBeingScaled({
                        strMod: strModOrig,
                        dexMod: dexModOrig,
                        modFromAbil: c,
                        name,
                        content
                    });
                    if (abil) {
                        detectedAbil = abil;
                        chosenModFromAbil = c;
                        break;
                    }
                }

                if (detectedAbil) {
                    const impliedNewMod = (chosenModFromAbil ?? 0) + (scaledHit - curToHit);
                    if (detectedAbil === "str") {
                        state.strCandidates.push(impliedNewMod);
                    } else if (detectedAbil === "dex") {
                        state.dexCandidates.push(impliedNewMod);
                    }
                }
            }

            return `{@hit ${scaledHit >= 0 ? `${scaledHit}` : scaledHit}}`;
        });

        // Process {@dc N}
        updatedContent = updatedContent.replace(/\{@dc (\d+)([^}]*)\}/gi, (_, dcStr, rest) => {
            const curDc = parseInt(dcStr, 10);
            const origDc = curDc + pbIn - pbOut;
            const outDc = Math.max(10, origDc + (idealDcOut - idealDcIn));
            updateSpellcastingAbilityFromDc(outDc, origDc, primarySpellAbility);
            return `{@dc ${outDc}${rest}}`;
        });

        // Process DC N
        updatedContent = updatedContent.replace(/\bDC (\d+)\b/g, (_, dcStr) => {
            const curDc = parseInt(dcStr, 10);
            const origDc = curDc + pbIn - pbOut;
            const outDc = Math.max(10, origDc + (idealDcOut - idealDcIn));
            updateSpellcastingAbilityFromDc(outDc, origDc, primarySpellAbility);
            return `DC ${outDc}`;
        });

        return updatedContent;
    });

    // Also walk spellcasting headerEntries
    if (Array.isArray(mon.spellcasting)) {
        for (const sc of mon.spellcasting) {
            const scAbility = sc.ability || primarySpellAbility;
            if (Array.isArray(sc.headerEntries)) {
                sc.headerEntries = sc.headerEntries.map((entry: any) =>
                    transformEntry(entry, (str) => {
                        let updated = str.replace(/\{@dc (\d+)([^}]*)\}/gi, (_, dcStr, rest) => {
                            const curDc = parseInt(dcStr, 10);
                            const origDc = curDc + pbIn - pbOut;
                            const outDc = Math.max(10, origDc + (idealDcOut - idealDcIn));
                            updateSpellcastingAbilityFromDc(outDc, origDc, scAbility);
                            return `{@dc ${outDc}${rest}}`;
                        });
                        updated = updated.replace(/\bDC (\d+)\b/g, (_, dcStr) => {
                            const curDc = parseInt(dcStr, 10);
                            const origDc = curDc + pbIn - pbOut;
                            const outDc = Math.max(10, origDc + (idealDcOut - idealDcIn));
                            updateSpellcastingAbilityFromDc(outDc, origDc, scAbility);
                            return `DC ${outDc}`;
                        });
                        return updated;
                    })
                );
            }
        }
    }

    const getMostFrequent = (arr: number[]): number | undefined => {
        if (arr.length === 0) return undefined;
        const counts = new Map<number, number>();
        let maxCount = 0;
        let bestVal = arr[0];
        for (const val of arr) {
            const c = (counts.get(val) || 0) + 1;
            counts.set(val, c);
            if (c > maxCount) {
                maxCount = c;
                bestVal = val;
            }
        }
        return bestVal;
    };

    state.tempStrMod = getMostFrequent(state.strCandidates);
    state.tempDexMod = getMostFrequent(state.dexCandidates);
}

// ────────────────────────────────────────────────────────────────────────────
// Step 5: DPR / Damage Expressions (Bug 4 Fix)
// ────────────────────────────────────────────────────────────────────────────

function scaleDpr(mon: any, crIn: number, crOut: number, state: ScalingState): void {
    let dprAvgIn = getRangeMean(CR_DPR_RANGES[crIn]);
    if (crIn === 0) dprAvgIn = Math.min(dprAvgIn, 0.63);
    const dprAvgOut = getRangeMean(CR_DPR_RANGES[crOut]);
    const variance = getRangeHalfWidth(CR_DPR_RANGES[crOut]);

    const strModOrig = abilityMod(state.origScores.str);
    const dexModOrig = abilityMod(state.origScores.dex);

    const strModTarget = state.tempStrMod ?? interpAndTranslateToSpace(
        strModOrig,
        DAMAGE_MOD_RANGE[crIn] || [0, 3],
        DAMAGE_MOD_RANGE[crOut] || [0, 3]
    );
    const dexModTarget = state.tempDexMod ?? interpAndTranslateToSpace(
        dexModOrig,
        DAMAGE_MOD_RANGE[crIn] || [0, 3],
        DAMAGE_MOD_RANGE[crOut] || [0, 3]
    );

    const dieFaces = [4, 6, 8, 10, 12, 20];

    const scaleExpression = (
        _fullMatch: string,
        avgStr: string,
        diceFormula: string,
        damageType: string,
        actionName: string,
        fullContent: string
    ): string => {
        const oldAvg = avgStr ? parseInt(avgStr, 10) : diceAverage(diceFormula);
        const dprAdjusted = getScaledToRatio(oldAvg, dprAvgIn, dprAvgOut);
        const targetRange: [number, number] = [
            Math.max(0, Math.floor(dprAdjusted - variance)),
            Math.ceil(Math.max(1, dprAdjusted + variance))
        ];

        const match = /^(\d+)?d(\d+)(?:\s*([+-])\s*(\d+))?$/i.exec(diceFormula.trim());
        if (!match) {
            // Flat damage
            const flatVal = Math.max(1, dprAdjusted);
            return damageType ? `${flatVal} ${damageType}` : `${flatVal}`;
        }

        const count = match[1] ? parseInt(match[1], 10) : 1;
        const faces = parseInt(match[2], 10);
        const sign = match[3] === "-" ? -1 : 1;
        const mod = match[4] ? sign * parseInt(match[4], 10) : 0;

        const enchant = getEnchantBonus(actionName);
        const rawMod = mod - enchant;

        // Detect ability
        const detectedAbil = getAbilBeingScaled({
            strMod: strModOrig,
            dexMod: dexModOrig,
            modFromAbil: rawMod,
            name: actionName,
            content: fullContent
        });

        let desiredMod: number;

        if (detectedAbil === "str") {
            desiredMod = strModTarget + enchant;
        } else if (detectedAbil === "dex") {
            desiredMod = dexModTarget + enchant;
        } else {
            // Null ability (e.g. Arcane Burst tied to Int/Wis/Cha or no stat)
            // If monster has a modified casting ability (e.g. Int from Spell DC), check if mod matches it
            let matchedCastingMod: number | null = null;
            for (const k of ["int", "wis", "cha"]) {
                if (abilityMod(state.origScores[k]) === rawMod) {
                    matchedCastingMod = abilityMod(mon[k]) + enchant;
                    break;
                }
            }
            desiredMod = matchedCastingMod !== null ? matchedCastingMod : mod;
        }

        let bestCount = count;
        let bestFace = faces;
        let bestMod = desiredMod;
        let found = false;

        // Preference 1: Adjust number of dice
        const faceAvg = (faces + 1) / 2;
        for (let c = 1; c <= 50; c++) {
            const avg = Math.floor(c * faceAvg + desiredMod);
            if (avg >= targetRange[0] && avg <= targetRange[1]) {
                bestCount = c;
                bestFace = faces;
                bestMod = desiredMod;
                found = true;
                break;
            }
        }

        // Preference 2: Adjust die face
        if (!found) {
            for (const f of dieFaces) {
                const fAvg = (f + 1) / 2;
                for (let c = 1; c <= 50; c++) {
                    const avg = Math.floor(c * fAvg + desiredMod);
                    if (avg >= targetRange[0] && avg <= targetRange[1]) {
                        bestCount = c;
                        bestFace = f;
                        bestMod = desiredMod;
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
        }

        // Preference 3: Adjust modifier with alternating steps (only if ability is not locked or forced)
        if (!found) {
            const deltas = [1, -1, 2, -2, 3, -3, 4, -4, 5, -5];
            for (const d of deltas) {
                const tryMod = desiredMod + d;
                for (const f of dieFaces) {
                    const fAvg = (f + 1) / 2;
                    for (let c = 1; c <= 50; c++) {
                        const avg = Math.floor(c * fAvg + tryMod);
                        if (avg >= targetRange[0] && avg <= targetRange[1]) {
                            bestCount = c;
                            bestFace = f;
                            bestMod = tryMod;
                            found = true;
                            break;
                        }
                    }
                    if (found) break;
                }
                if (found) break;
            }
        }

        const finalAvg = Math.max(1, Math.floor(bestCount * ((bestFace + 1) / 2) + bestMod));
        const modStr = bestMod !== 0 ? (bestMod > 0 ? ` + ${bestMod}` : ` - ${Math.abs(bestMod)}`) : "";
        const newFormula = `${bestCount}d${bestFace}${modStr}`;
        const typeStr = damageType ? ` ${damageType}` : "";

        if (avgStr) {
            return `${finalAvg} (${newFormula})${typeStr}`;
        }
        return `${newFormula}${typeStr}`;
    };

    processNamedEntries(mon, (actionName, content) => {
        // Match: {@damage 2d6 + 3} or {@scaledamage ...}
        let updated = content.replace(/\{@(damage|scaledamage|scaledice) ([^}]+)\}/gi, (_, tag, expr) => {
            const scaled = scaleExpression("", "", expr, "", actionName, content);
            return `{@${tag} ${scaled}}`;
        });

        // Match: 10 (2d6 + 3) slashing damage
        updated = updated.replace(/(\d+)\s*\(((\d+)?d\d+(?:\s*[+-]\s*\d+)?)\)(?:\s+([a-zA-Z]+))?/gi, (m, avg, formula, _, type) => {
            return scaleExpression(m, avg, formula, type || "", actionName, content);
        });

        return updated;
    });

    // Finalize Str/Dex scores ONLY if candidates were detected
    if (state.tempStrMod !== undefined && state.strCandidates.length > 0) {
        mon.str = calcNewAbility(mon, "str", state.tempStrMod);
        state.modifiedAbilities.add("str");
    }
    if (state.tempDexMod !== undefined && state.dexCandidates.length > 0) {
        mon.dex = calcNewAbility(mon, "dex", state.tempDexMod);
        state.modifiedAbilities.add("dex");
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Step 7: Armor Class
// ────────────────────────────────────────────────────────────────────────────

function scaleAc(mon: any, crIn: number, crOut: number): void {
    if (!mon.ac || !Array.isArray(mon.ac) || mon.ac.length === 0) return;

    const idealAcIn = crToAc(crIn);
    const idealAcOut = crToAc(crOut);

    mon.ac = mon.ac.map((acEntry: any) => {
        if (typeof acEntry === "number") {
            const newAc = getScaledToRatio(acEntry, idealAcIn, idealAcOut);
            return Math.max(1, newAc);
        }
        if (typeof acEntry === "object" && typeof acEntry.ac === "number") {
            const newAc = getScaledToRatio(acEntry.ac, idealAcIn, idealAcOut);
            return { ...acEntry, ac: Math.max(1, newAc) };
        }
        return acEntry;
    });
}

// ────────────────────────────────────────────────────────────────────────────
// Step 8: Propagate Ability Changes
// ────────────────────────────────────────────────────────────────────────────

function propagateAbilityChanges(mon: any, state: ScalingState): void {
    for (const abil of state.modifiedAbilities) {
        const oldScore = state.origScores[abil] ?? 10;
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
                mon.save[abil] = updated >= 0 ? `+${updated}` : `${updated}`;
            }
        }

        // Skills
        if (mon.skill && typeof mon.skill === "object") {
            const updateObj = (obj: Record<string, any>) => {
                for (const [skillName, val] of Object.entries(obj)) {
                    if (skillName === "other") continue;
                    if (SKILL_TO_ABILITY[skillName.toLowerCase()] === abil) {
                        const curSkill = parseInt(String(val), 10);
                        if (!isNaN(curSkill)) {
                            const updated = curSkill + diff;
                            obj[skillName] = updated >= 0 ? `+${updated}` : `${updated}`;
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
        if (abil === "wis" && typeof mon.passive === "number") {
            mon.passive += diff;
        }
    }
}

// ────────────────────────────────────────────────────────────────────────────
// String Traversal Helpers
// ────────────────────────────────────────────────────────────────────────────

function walkMonsterStrings(mon: any, transform: (str: string) => string): void {
    const fields = ["trait", "action", "bonus", "reaction", "legendary", "mythic", "variant"];
    for (const f of fields) {
        if (Array.isArray(mon[f])) {
            mon[f] = mon[f].map((entry: any) => transformEntry(entry, transform));
        }
    }
}

function processNamedEntries(mon: any, transform: (name: string, content: string) => string): void {
    const fields = ["trait", "action", "bonus", "reaction", "legendary", "mythic", "variant"];
    for (const f of fields) {
        if (Array.isArray(mon[f])) {
            mon[f] = mon[f].map((item: any) => {
                if (item && typeof item === "object") {
                    const actionName = item.name || "";
                    if (Array.isArray(item.entries)) {
                        item.entries = item.entries.map((entry: any) =>
                            transformEntry(entry, (str) => transform(actionName, str))
                        );
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
    if (typeof entry === "string") {
        return transform(entry);
    }
    if (Array.isArray(entry)) {
        return entry.map((e) => transformEntry(e, transform));
    }
    if (typeof entry === "object" && entry !== null) {
        const copy: any = {};
        for (const [k, v] of Object.entries(entry)) {
            copy[k] = transformEntry(v, transform);
        }
        return copy;
    }
    return entry;
}
