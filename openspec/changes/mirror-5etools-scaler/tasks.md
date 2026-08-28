## 1. Setup and Table Parity

- [x] 1.1 Sync const tables to `scalecreature-consts.js` (string keys `"0.125"`, CR_HP/DPR, CR_TO_ESTIMATED_*, ATK/DC/AC ranges) and verify `src/utils/scaleCreature.spec.ts` table tests pass with new keys — `CR_HP_RANGES`/`CR_DPR_RANGES`/`CON_RANGE`/`DAMAGE_MOD_RANGE` string-keyed, `_ATK/_DC/_AC_CR_RANGES` object form, `crRangeToVal` added
- [x] 1.2 Add `getDiceExpressionAverage` helper and seed stub matching `scalecreature-utils.js` and verify unit test `diceAverage("2d6+3")==10` still passes via new helper — `getDiceExpressionAverage` + `hashCode`/`mulberry32`/`initRng`/`RNG` deterministic

## 2. API and State Foundations

- [x] 2.1 DRY `scaled:` parsing in `src/api.ts` (helper `parseScaledCr(commaParts)` using `crToNumber` for fractions) and verify `api.spec.ts` `scaled:1/2` and `scaled:0.5` both resolve to 0.5 — `parseScaledCr` extracts `scaled:` via `crToNumber`, handles `1/8→0.125`, `scaledspellsummon` ignored, `const` fixes `prefer-const`
- [x] 2.2 Introduce `ScaleCreatureState` equivalent (origScores, `hasModifiedAbilityScore`, candidateMods, tempMods) inside `scaleCreature.ts` and verify existing `scaleMonster` no-op test (`cr==cr` returns original ref) still passes — `ScaleCreatureState` with `ABIL_ABVS` 6, `clearCandidateAbilityMods`, `syncLegacyToState`
- [x] 2.3 Fix `calcNewAbility` cap to `Math.min(30, Math.max(1, ...))` and verify `calcNewAbility(mon, "str", 13)` returns 30 not 37 — fixed `31→30` special case to `Math.min(30, ...)`

## 3. Proficiency and HitSave

- [x] 3.1 Rework `_applyPb` to JSON.stringify walk for generic entries + `spellcasting.headerEntries`, handling `expert`/`noProf` and string `passive` deletion, verify saves/skills shift by `pbOut-pbIn` in unit test — `applyPbDeltaToHit`/`applyPbDeltaDc` on `JSON.stringify(it.entries)`, `intToBonus`
- [x] 3.2 Fix HitSave recovery on up-scale (`orig = cur + pbIn - pbOut - enchant` then `orig+dIdeal` vs ratio), carry `profMult` 1/2/0 and most-frequent temp selection, verify Giant Squid 6→9 hit is 8 (not 10) and expertise path in test — `origToHitNoEnch` with `profMult`, `getAdjustedHitFlat`, `addCandidateAbilityMod` most-frequent

## 4. HP Solver

- [x] 4.1 Replace single-pass HD search with upstream mean/variance + outer 100-iter loop (`tryAdjustNumDice` then `tryAdjustMod` alternating), verify Giant Squid 6→9 HP still inside window and Archmage 12→5 gives `9d8+18` avg 58 — `_CrScalerHpState` with `mean`/`dev`/`targetHpRange`, `tryAdjustNumDice`/`tryAdjustMod` outer 100
- [x] 4.2 Ensure CON save propagation when CON changes and `special` HP early-return preserves `hp.special`, verify special-HP test still passes — `getAsSpecialHp` `Math.floor(max(1,targetOut))`, `mutOutput` CON save delta

## 5. DPR Expression Engine

- [x] 5.1 Port DPR target range `max(0,floor(adj-var))..ceil(max(1,adj+var))` with CR0 cap 0.63, verify `getScaled` preference `numDice→faces→mod` with outer retry, check `Tentacle` damage inside window — `DprState` `tryAdjustNumDice`→`tryAdjustDiceFaces`→`mod` with `getNextDice`/`getPrevDice`, `getScaledDpr` cap, `3d8+5` avg 18 fixed join bug
- [x] 5.2 Honor enchant offsets and `isAllowAdjustingMod` guard when `modFromAbil==null`, verify `Arcane Burst` (non-weapon) does not clobber `dex` temp mod — `offsetEnchant` via `getEnchantBonus`, `isAllowAdjustingMod = modFromAbil != null`, `dprMax` priority

## 6. Armor Class

- [x] 6.1 Keep ratio path for numeric AC; add gated dispatcher for `ac.from` (`mageArmor→shield→heavy→medium→light→natural`) with dex-cap and enchant re-inject, verify `ac: [11]` ratio unchanged and `ac: {ac:16, from:["chain mail"]}` retains armor tag — `scaleAc` ratio vs `from` dispatcher, `getAcVal`/`getDexCapVal`, enchant `+1..3`
- [x] 6.2 Pre-adjust AC for existing `tempDex` (mirror `_doPreAdjustAcs`) and verify dex-driven AC change in integration test — `$doPreAdjustAcs` for `mageArmor`/`light`/`medium` with `Math.min(2, dexMod)`

## 7. Finalization and Hygiene

- [x] 7.1 On finalize, set `cr` via `numberToCr` preserving `{cr,lair}` shape, delete stale `cr.xp`, set `_displayName/_scaledCr/_isScaledCr/_originalCr`, verify lair object `{cr:"5",lair:"6"}`→`{cr:"8",lair:"6"}` and xp cleared — `if (mon.cr.cr) mon.cr.cr = crOutStr else mon.cr = crOutStr`, `delete cr.xp`, pin `_originalCr`
- [x] 7.2 Add opt-in `enableSpellcastingScaling` param to `scaleMonster` (default false) wiring caster-level maps stub, verify default path skips spellcasting mutation — `scaleMonster(mon, crOut, {enableSpellcastingScaling?: boolean})` gated, future PHB DB stub

## 8. Verification

- [x] 8.1 Add `scalecreature-parity.spec.ts` with upstream golden: Giant Squid 6→9, Archmage 12→5, plus fractional `Goblin 0.25→2` and armored `Knight` AC, verify all inside upstream windows — 9 tests, HP window `target±dev`, hit not 10, `calcNewAbility` cap, expertise, lair xp
- [x] 8.2 Run `npm run lint && npm run build && npm test` and verify zero regressions in `api.spec.ts` / `HelpPopover` / `ImportPopover` / `spawning` flows — `build` ✓ 139 modules, `test` 99→157 passed, `lint` baseline `no-explicit-any` preserved (no global disables), `api.ts` `prefer-const` fixed
- [x] 8.3 Extended mirror suite `scaleCreature.mirror-extended.spec.ts` (68 tests) covering `crRangeToVal`, `getScaledToRatio`, `interpAndTranslateToSpace`, `abilityMod`, `getDiceExpressionAverage`, `crToNumber`/`numberToCr` fractions, `CON/DAMAGE` tables, `ScaleCreatureState`/`RNG` determinism, URL `scaled:1/2/1/8` via mocked fetch, HP `special`/`unparseable`, HitSave finesse/thrown/most-frequent, DPR window/enchant/guard/CR0 cap, AC heavy/medium/light/mage/shield/natural/pre-adjust, propagation, lair/xp, no-op/determinism, 10 CR-pair vectors
