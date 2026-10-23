---
type: Module
title: api.ts — Monster Data API
description: Fetches D&D 5e monster data from the 5etools-mirror-3 and partnered homebrew GitHub repositories, parses three 5e.tools URL formats, and extracts HP, AC, and token image URLs.
resource: ../src/api.ts
tags: [api, fetch, monster, 5etools, url-parsing, homebrew]
generated: { by: human:ajuszt95, at: 2026-08-15T09:45:00Z }
sources:
  - id: api-ts
    resource: ../src/api.ts
    title: src/api.ts
  - id: mirror-base
    resource: https://github.com/5etools-mirror-3/5etools-src
    title: 5etools-mirror-3 source data
  - id: img-base
    resource: https://github.com/5etools-mirror-3/5etools-img
    title: 5etools-mirror-3 token images
  - id: homebrew-base
    resource: https://github.com/TheGiddyLimit/homebrew
    title: Partnered (non-WotC) 5e.tools data
  - id: homebrew-img-base
    resource: https://github.com/TheGiddyLimit/homebrew-img
    title: Partnered token images
---

# api.ts — Monster Data API

## Exports

### `Monster` interface

The raw 5e.tools JSON schema, extended with two extra fields added after fetch:

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Monster display name |
| `source` | `string` | Source book abbreviation (e.g. `MM`, `PHB`) |
| `hp` | `{ average?: number }` (optional) | Hit point block |
| `ac` | `Array<number \| { ac: number }>` (optional) | Armor class block |
| `size` | `string[]` (optional) | Size codes, e.g. `["M"]` for Medium |
| `tokenUrl` | `string` (optional, added) | Resolved token image URL (official mirror or `homebrew-img`) |
| `sourceUrl` | `string` (optional, added) | Original 5e.tools URL supplied by user |
| `[key]` | `any` | Full stat-block passthrough |

### `fetchMonsterData(url)`

Async function. Entry point for all data loading.

**Steps:**

1. **Parse URL** — detects one of three 5e.tools URL formats (see below) and extracts `source` and `nameIdentifier`.
2. **Resolve source** — looks the source up in `PARTNERED_HOMEBREW_SOURCES` (`src/homebrewSources.ts`). WotC books fetch `https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/bestiary/bestiary-{SOURCE}.json`; partnered books fetch their file from `TheGiddyLimit/homebrew`.
3. **Find monster** — sanitizes both the target name identifier and each monster name (strips all non-alphanumeric characters, lowercases), then exact-matches; falls back to prefix-match. For partnered books, candidates are first filtered to the URL's source id so duplicate names from other sources in the same file cannot win.
4. **Attach helpers** — uses the monster's embedded `tokenHref.url` when present (partnered tokens live in `TheGiddyLimit/homebrew-img`; literal spaces are percent-encoded), otherwise falls back to `calculateTokenUrl` for WotC sources. Sets `sourceUrl` from the original URL.

Throws descriptive `Error` objects on invalid URL, network failure, or no match found.

### `calculateTokenUrl(name, source)`

Builds the GitHub Raw image URL:

```
https://raw.githubusercontent.com/5etools-mirror-3/5etools-img/main/bestiary/tokens/{SOURCE}/{NAME}.webp
```

Name is `encodeURIComponent`-encoded; spaces are preserved for GitHub Raw compatibility.

Only used for WotC sources. Partnered books supply their own token URL in the
data (`tokenHref.url`); if a partnered monster has no token, `tokenUrl` stays
unset rather than pointing at a path that does not exist in the official image repo.

### `homebrewSources.ts`

`PARTNERED_HOMEBREW_SOURCES` maps lowercase 5e.tools source ids to repo-relative
paths in [TheGiddyLimit/homebrew](https://github.com/TheGiddyLimit/homebrew).
`getPartneredHomebrewUrl(source)` returns the encoded raw URL, or `undefined`
for WotC sources. The registry is generated from the homebrew repo's
`_generated/index-meta.json` (partnered entries have `p: 1`) and
`_generated/index-props.json` (which files contain `monster` data); refresh the
map when a new partnered book is added.

### `getMonsterDimensions(size?)`

Maps 5e.tools single-character size codes to OBR grid multipliers:

| Code | Size | Multiplier |
|------|------|-----------|
| `T` | Tiny | 0.5 |
| `S` | Small | 0.8 |
| `M` | Medium | 1 |
| `L` | Large | 2 |
| `H` | Huge | 3 |
| `G` | Gargantuan | 4 |

Defaults to `1` for unknown codes. Returns `{ multiplier: number }`.

### `extractAC(monster)` / `extractHP(monster)`

Safe accessors that handle the polymorphic 5e.tools schema:

- `ac` can be `number` or `{ ac: number }` — both forms are read; defaults to `10`.
- `hp.average` is read if present; defaults to `10`.

## URL parsing — three formats

| Format | Example | Extraction |
|--------|---------|-----------|
| Query-param | `bestiary.html?source=MM&hash=goblin_mm` | `hash` param, double-decoded; `source` param or last `_`-segment |
| Fragment hash | `bestiary.html#goblin_mm` | `#` stripped; split on `_`; last segment = source |
| Path slug | `bestiary/goblin-mm.html` | Filename without `.html`; split on `-`; last segment = source |

Name matching strips all non-alphanumeric characters before comparing, with a prefix-match
fallback for cases where the URL slug doesn't exactly match the canonical name.

## Examples

```ts
// Import a goblin from the Monster Manual
const monster = await fetchMonsterData("https://5e.tools/bestiary.html#goblin_mm");
// monster.name === "Goblin"
// monster.source === "MM"
// monster.tokenUrl === "https://raw.githubusercontent.com/5etools-mirror-3/5etools-img/main/bestiary/tokens/MM/Goblin.webp"

// Import partnered content (Tome of Beasts 1, 2023 edition)
const beetle = await fetchMonsterData(
  "https://5e.tools/bestiary.html#swarm%20of%20prismatic%20beetles_tob1-2023"
);
// beetle.source === "ToB1-2023"
// beetle.tokenUrl === "https://raw.githubusercontent.com/TheGiddyLimit/homebrew-img/main/img/ToB1-2023/bestiary/tokens/Swarm%20of%20Prismatic%20Beetles.webp"
```

## Related concepts

- [spawning](spawning.md) — consumes `fetchMonsterData`, `extractHP`, `extractAC`, `getMonsterDimensions`
- [popovers](popovers/index.md) — `ImportPopover` and `HelpPopover` call `fetchMonsterData` directly
