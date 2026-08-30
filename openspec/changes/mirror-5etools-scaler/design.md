## Context

Current `src/utils/scaleCreature.ts:1-1127` is a single-file MVP that approximates `5etools-mirror-3/5etools-src/js/scalecreature/`. It was validated against 5etools via comment only; no mirror commit is pinned. `src/api.ts:50-182` does URL→monster→scale, and `ViewPopover`/`ImportPopover`/`spawning.ts` consume the scaled JSON. The repo has no `openspec/specs/` yet; all scaling behavior is spec'd in this change.

Constraints: OBR extension runs offline on `https://5e.tools` mirrored JSON (GitHub raw); no access to `Renderer`, `Parser`, `DataUtil` from 5etools; must stay deterministic without external RNG; `scaleMonster` public signature must not break popovers.

## Goals / Non-Goals

**Goals:**
- Reach numeric parity with upstream for `,scaled:CR` links across PB, HP, hit/DC, DPR, AC for pure-numeric and simple armored monsters.
- Keep single-file implementation, no new runtime deps, no DOM/parser deps.
- Deterministic scaling independent of load order.

**Non-Goals:**
- Full upstream spellcasting slot/cantrip/warlock-arcanum mutation (heavy, needs PHB spell DB). Gated behind flag.
- `Renderer.monster.updateParsed` / `displayName` DOM side effects.
- Supporting CR >30 or custom CR strings.

## Decisions

**Decision 1 — Keep single file, internal classes vs split modules.**
_Why:_ Upstream splits into `CrScalerHp`, `HitSave`, `Dpr`, `ArmorClass`, `DamageExpression`. Splitting in OBR adds bundle complexity for little isolation. Internal classes/functions inside `scaleCreature.ts` mirror upstream structure with region comments, staying tree-shakeable.
_Alt:_ Split into `src/utils/scaler/*.ts` — rejected for churn/no perf win.

**Decision 2 — String-keyed const tables matching upstream `scalecreature-consts.js:1`.**
_Why:_ Upstream keys are `"0.125"` strings; local numeric keys relied on coercion — same at runtime but diverges for `Object.keys` lookups. Switch to `"0.125"` literal keys and `Number()` on access to match `CrScalerUtils.crRangeToVal`.
_Trade:_ No behavior change for valid CRs, but fixes future `crRangeToVal` port.

**Decision 3 — PB walk via JSON.stringify on entries (upstream) vs `walkMonsterStrings`.**
_Why:_ Upstream's `ScaleCreature.scale:63-84` does `JSON.stringify(it.entries)` → `applyPbDelta*` → `JSON.parse`. This covers nested `type:"entries"`/`list`/`table` uniformly. Local `walkMonsterStrings:1080` enumerates prop names and misses header shapes. Switch generic entries to `JSON.stringify` walk; keep typed `transformEntry` only for header cases where string tags need context.
_Alt:_ Keep enumerating — rejected for coverage gaps (spellcasting headers already needed special case).

**Decision 4 — HitSave recovery on both directions.**
_Why:_ Upstream `scalecreature-scaler-cr-hitsave.js:62-98` does `orig = cur + pbIn - pbOut` always. Local only on way-down. Fix is one-line: compute `orig` first, then branch on `crIn<crOut` for flat vs ratio. Validated against Giant Squid 6→9 vector (8→8 not 10).

**Decision 5 — HP/DPR outer retry loops (100 / 99 iter).**
_Why:_ Upstream HP does `for iter 0..99 { if inRange break; tryAdjustNumDice || tryAdjustMod }`, DPR does `for i 0..99 { getCandidate(); if(entry) break; }`. Local single-pass can fail to find in-range when first numDice step misses but mod adjust would succeed on next iter. Add outer loop, preserve `max -5` floor, add `isInRange` helpers.
_Alt:_ Keep single-pass but widen delta — rejected, produces different dice than upstream.

**Decision 6 — DPR expression engine: reuse preference order but simplified.**
_Why:_ Upstream `ScaleCreatureDamageExpression.getScaled:44-70` prefers numDice → faces → mod in nested loops. Local already does count→face→mod but with flat loops and `Math.floor(avg)`. Port upstream's `getDiceExpressionAverage` (strip spaces, `* (faces+1)/2`) and range `max(0, floor(adj-var))` to match DPR window exactly. No need for `Renderer.dice.getNextDice` — local `dieFaces=[4,6,8,10,12,20]` suffices.

**Decision 7 — AC dispatcher gated fallback.**
_Why:_ Upstream `CrScalerArmorClass` is ~900 lines handling armor tags. Full port without PHB `VetoolsConfig`/`Parser` context is heavy and risky for OBR. Gate: if `acItem.from` is falsy or `typeof acItem=="number"` → ratio path (current). Only when `from: string[]` present enter simplified dispatcher (mage→shield→heavy→medium→light→natural) that caps at strongest supported tier without re-rolling tags. This keeps pure monsters identical and only armored monsters get iterative behavior.

**Decision 8 — Spellcasting behind flag.**
_Why:_ Upstream `_adjustSpellcasting:120+lines` needs PHB spell DB + seeded rolls. MVP requirement (see `scaleCreature.ts:357` comment) intentionally skipped. Add `opts: {enableSpellcastingScaling?: boolean}` default `false` to `scaleMonster` overload for future parity without breaking current consumers.

**Decision 9 — Seeded RNG stub.**
_Why:_ Upstream seeds via `CryptUtil.hashCode(name+source+crOut)`. OBR doesn't need non-determinism for attacker choice (finesse vs str). Keep deterministic `most-frequent` temp mod selection and avoid random rolls for armor fallback (pick first variant). Seed helper added but not required for MVP numeric parity.

## Risks / Trade-offs

- **Ratio vs floor divergence** — upstream uses `ScaleCreatureUtils.getDiceExpressionAverage` (exact `* (faces+1)/2`) while local `diceAverage` uses `Function` eval; porting to upstream helper may shift a few HD choices by ±1 → Mitigation: pin golden vectors and compare both helpers in parity test.
- **AC tag fidelity** — without full PHB tag table, armored outputs may keep armor type but choose different tier than upstream (e.g., `+3 plate` cap) → Mitigation: gate armored path behind `from` presence and document known divergence; add tagged fixtures but not block rollout.
- **Behavior change for up-scaled hits** — fixing double PB lowers hit by 1 for existing saved tokens — not a break but a visible stat change → Mitigation: version bump `v1.6.4`, release notes call out "up-scale hit/DC now matches 5etools".
- **Error throwing vs returning original** — upstream throws on equal/out-of-range; local returns original ref (used by tests). Changing to throw would break `api.spec.ts:128` → Mitigation: keep return-original contract, only document divergence in design.

## Migration Plan

1. Land behind no feature flag (corrections are numeric only). Bump `src/ViewPopover.tsx` version string and `manifest.json`/`docs`.
2. Deploy via existing GitHub Pages workflow — no data migration; existing tokens keep stored scaled JSON until re-imported.
3. Rollback: revert `scaleCreature.ts` single file to prior tag; no DB migration needed.

## Open Questions

- Pin upstream mirror commit? Currently `main` (≈ `a1ea635`). Should we record a specific SHA in `design.md` appendix for future drift detection? Can be added without changing specs/tasks.
