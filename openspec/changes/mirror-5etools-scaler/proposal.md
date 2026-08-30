## Why

Local CR scaler in `src/utils/scaleCreature.ts` was built as a simplified port of `5etools js/scalecreature/`. Research against `5etools-mirror-3/5etools-src` shows systematic drift: hit scaling double-counts PB on up-scale, HP/DPR loops are single-pass instead of upstream's iterative variance solver, AC is ratio-only instead of the heavy/medium/light/shield dispatcher, and `calcNewAbility`/`xp`/`scaled:` parsing have edge bugs. Tests pass because they assert loose ranges. Users pasting `,scaled:9` links expect upstream-equivalent stats; current drift produces ~+1 hit/DC on up-scales and under-adjusted HP windows.

## What Changes

- Align core tables and helpers to upstream `scalecreature-consts.js` / `scalecreature-utils.js` (string-keyed `CR_HP_RANGES`, `CR_DPR_RANGES`, `CR_TO_ESTIMATED_*`, `ATK/DC/AC` ranges, `interpAndTranslateToSpace` offset, `getScaledToRatio`).
- Introduce `ScaleCreatureState` equivalent (orig scores, modified flags, candidateMods, tempMods) and deterministic seeded RNG stub.
- Fix `_applyPb` ordering/coverage to mirror upstream: JSON-stringified walk over `trait/action/bonus/reaction/legendary/mythic/variant` + `spellcasting.headerEntries`, handling `expert` (`pb*2`) and `noProf` paths, `passive` as number|string.
- Fix `CrScalerHitSave` recovery on way-up (`orig = cur + pbIn - pbOut - enchant` then `+idealDiff` or `ratio`), 3-way abil detection with `profMult`, most-frequent temp mod selection.
- Port HP iterative solver: `mean` + `variance` target range, outer 100-iter loop, `numDice` then `mod` preference, CON range interpolation, CON save propagation.
- Port DPR expression engine: reuse upstream `ScaleCreatureDamageExpression` preference order (numDice → faces → mod) with target range `max(0, floor(dprAdjusted - var)) .. ceil(max(1, dprAdjusted+var))`, enchant offsets, outer retry.
- Replace AC ratio with upstream dispatcher gated on `ac.from`: heavy/medium/light/mage/shield/natural branches with iterative fallback; pure numeric AC keeps ratio path.
- Fix `calcNewAbility` cap to `Math.min(30, ...)` and `Math.max(1,...)`, `crToNumber`/`parseTargetCr` fraction support (`1/8`→0.125 via `crToNumber`), stale `cr.xp` clear on finalize.
- DRY `scaled:` parser in `src/api.ts` and preserve `_originalCr` pinning semantics.
- Gate spellcasting caster-level/slot scaling behind `enableSpellcastingScaling` flag (default off) to match MVP intent while allowing future parity.

No breaking API: `scaleMonster(mon, crOutNumber): Monster` signature unchanged; callers `fetchMonsterData` / `spawning.ts` / popovers unaffected. Behavior changes are numeric corrections.

## Capabilities

### New Capabilities
- `cr-scaling`: Challenge-Rating-based monster statistic scaling that mirrors upstream 5etools `js/scalecreature` pipeline (PB, HP, Hit/DC, DPR, AC, ability propagation, finalization).

### Modified Capabilities
<!-- No existing specs to modify; repo has no `openspec/specs/` yet. -->

## Impact

- `src/utils/scaleCreature.ts` — major rewrite to upstream structure (kept as single file, no new deps).
- `src/api.ts` — `fetchMonsterData` scaled: parsing, `cr.xp` hygiene.
- `src/utils/scaleCreature.spec.ts` + new `scalecreature-parity.spec.ts` — tighten assertions, add upstream golden vectors.
- `src/spawning.ts` / popovers — no logic change, only consumption of corrected `scaleMonster`.
- No new runtime dependencies; no OBR permission changes; build/lint unchanged.
