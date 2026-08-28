# cr-scaling Specification

## Purpose
Provides Challenge-Rating scaling for 5e monsters that mirrors the upstream 5etools `js/scalecreature` pipeline so that `,scaled:CR` URLs in Owlbear produce the same HP, proficiency, attack/DC, damage and AC adjustments as 5etools.

## Requirements

### Requirement: CR target parsing from URL
The system SHALL parse a `scaled:` sub-hash from both `?hash=` query-param and fragment-hash forms, supporting integer and fractional CR strings (`0`, `1/8`, `1/4`, `1/2`, `0.125`, `9`, `30`) and convert them via the same lookup as `crToNumber`; non-numeric or out-of-range targets SHALL NOT mutate the monster.

#### Scenario: Fractional scaled tag is honored
- **WHEN** URL contains `,scaled:1/2` or `,scaled:0.5`
- **THEN** fetched monster is scaled to CR 0.5 with `_scaledCr = 0.5` and `cr = "1/2"`

#### Scenario: Invalid scaled tag is ignored
- **WHEN** URL contains `,scaled:abc` or `,scaled:99`
- **THEN** fetch returns the unscaled monster and `fetchMonsterData` does not throw for scaling

#### Scenario: `scaled:` coexists with other sub-hashes
- **WHEN** URL contains `,scaledspellsummon:3` but no `scaled:` tag
- **THEN** system treats it as unscaled (`_isScaledCr` undefined)

### Requirement: Proficiency bonus delta applied once
The system SHALL apply proficiency bonus delta exactly once: saves, skills and stringified `{@hit}/{@dc}/DC` entries SHALL be shifted by `pbOut - pbIn` in the dedicated PB phase, and the later HitSave phase SHALL recover `orig = cur + pbIn - pbOut` before computing new values. Hit/DC SHALL NOT be double-counted on up-scale.

#### Scenario: Up-scale hit recovers before ideal diff
- **WHEN** Giant Squid CR 6 (`pb 3`, hit 8) is scaled to CR 9 (`pb 4`, ideal 6→7)
- **THEN** new hit equals `orig(8+3-4=7) + (7-6)=8` (not `8+1+1=10`)

#### Scenario: Skills and saves handle expertise
- **WHEN** save or skill bonus equals `abilityMod + pbIn*2` (expertise) or `abilityMod` (no proficiency)
- **THEN** new value uses `pbOut*2` or `0` respectively, formatted with `+` prefix for non-negative.

#### Scenario: Passive perception follows proficiency
- **WHEN** `skill.perception` changes and `passive` is a number
- **THEN** `passive = 10 + newPerception` (string passives are deleted per upstream).

### Requirement: HP scaling matches upstream mean-variance solver
The system SHALL compute `hpOutMean` and `hpOutRange = [floor(mean-var), ceil(mean+var)]` where `mean` and `var` derive from `CR_HP_RANGES` per DMG p274, interpolate `modPerHd` via `CR_TO_ESTIMATED_CON_MOD_RANGE`, and search `numHd` then `conMod` in an outer 100-iteration loop (numDice preference first, alternating mod steps). Unparseable `formula` SHALL produce a `special` HP with `floor(max(1,targetOut))`.

#### Scenario: HP lands inside variance window
- **WHEN** Giant Squid `16d10+32` (avg 120, CR6) scales to CR9
- **THEN** resulting `hp.average` is inside CR9's window and `hp.formula` is valid `NdM ± K`

#### Scenario: Special HP is preserved
- **WHEN** `hp.special` is set
- **THEN** HP phase returns without mutating `hp` or CON.

#### Scenario: CON tracks mod change
- **WHEN** chosen `conMod` differs from original ability mod
- **THEN** `mon.con` is updated via `calcNewAbility` preserving parity and capping to `1..30`, and `save.con` shifts by delta if present.

### Requirement: Hit and save DC scaling mirrors upstream HitSave
The system SHALL resolve ideal hit/DC via `ATK/DC` range tables, compute `orig = cur + pbIn - pbOut - enchant`, derive `target = crIn<crOut ? orig+dIdeal : ratio(orig)`, and collect `str`/`dex` candidate mods (three profMult variants) to set `tempStr`/`tempDex` as most-frequent. Spellcasting DC SHALL adjust the casting ability (`int`/`wis`/`cha`) when first encountered.

#### Scenario: Weapon ability detection uses tag context
- **WHEN** attack contains `{@atk mw}` or `{@atkr}` and name/content implies finesse vs thrown vs melee/ranged
- **THEN** candidate mod is attributed to `str` or `dex` per upstream lists (`dagger, dart, rapier, scimitar, shortsword, whip`, `handaxe, javelin, light hammer, spear, trident, net`)

#### Scenario: DC floor and casting ability bump
- **WHEN** DC is scaled down
- **THEN** output DC is `max(10, orig + idealDiff)` and, if `spellcasting[0].ability` is int/wis/cha and not yet modified, ability score is bumped by `dcDiff + pbIn - pbOut`.

### Requirement: DPR / damage expression scaling mirrors upstream DamageExpression
The system SHALL scale each `{@damage}/{@scaledamage}` and plain `N (XdY ±K) type` expression using DPR target `dprAdjusted = ratio(avg, dprMeanIn, dprMeanOut)` (CR0 capped to 0.63) and range `[max(0,floor(adj-var)), ceil(max(1,adj+var))]`, with mod resolution via `CR_TO_ESTIMATED_DAMAGE_MOD` and enchant offsets. Preference order SHALL be `numDice` → `diceFaces` → `mod` with outer retry loop, and `tempStr`/`tempDex` are finalized only when candidates exist.

#### Scenario: Damage stays within target window
- **WHEN** an action deals `14 (2d8+5)` at CR6 and is scaled to CR9
- **THEN** new expression average is inside DPR window for CR9 and ability mod, if applicable, is updated.

#### Scenario: Flat damage scales as fallback
- **WHEN** damage is a flat number without dice (`10 slashing`)
- **THEN** it scales to `max(1, dprAdjusted)`.

### Requirement: Armor Class scaling uses upstream dispatcher
The system SHALL scale numeric `ac: 13` via ratio to ideal AC per `AC_CR_RANGES`. For object `ac: {ac, from: ["chain mail", ...]}` it SHALL enter the upstream dispatcher: pre-adjust for existing `tempDex`, then iterate over handlers `mageArmor → shield → heavy → medium → light → natural` with fallback ratio, respecting dex caps, enchant re-injection, and dual-shield +1 rule. Pure numeric AC without `from` keeps ratio behavior.

#### Scenario: Simple AC scales proportionally
- **WHEN** `ac: [11]` at CR6 scales to CR9 (ideal 16→16)
- **THEN** AC ratio preserves ~11 (or correctly shifted if ideal differs).

#### Scenario: Armored AC preserves gear type
- **WHEN** `ac: {ac:16, from:["chain mail"]}` scales
- **THEN** result retains a valid armor tag from heavy/medium/light sets, not a bare number, with dex mod accounted.

### Requirement: Ability propagation and finalization
The system SHALL, after HP/HitSave/DPR/AC, propagate each modified ability (`str,dex,int,wis,cha,con`) delta to `save[abil]`, matching `skill` entries via `skill→ability` map and `passive` if `wis`, clamping final scores to `1..30` (31→30). Final `mon.cr` SHALL be updated to `numberToCr(crOut)` (preserving `{cr, lair}` shape, clearing stale `cr.xp`), and `_displayName`, `_scaledCr`, `_isScaledCr`, `_originalCr` set. Invalid or equal CR SHALL return the original object reference without mutation.

#### Scenario: Ability delta propagates
- **WHEN** `str` temp mod raises strength from 20 (+5) to 22 (+6)
- **THEN** `save.str` and `skill.athletics` each increase by +1.

#### Scenario: Finalization clears stale XP
- **WHEN** input `cr: {cr:"6", xp: 2300, lair:"6"}` scales to 9
- **THEN** output is `{cr:"9", lair:"6"}` with no `xp` field and `_displayName = "Name (CR 9)"`.

#### Scenario: No-op on same or out-of-range CR
- **WHEN** `crOut` equals `crIn` or is `null/NaN/<0/>30` or missing table entry
- **THEN** `scaleMonster` returns the exact input reference and sets no `_scaledCr`.
