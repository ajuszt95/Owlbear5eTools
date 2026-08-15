---
type: Module
title: api.ts — Monster Data API
description: Fetches D&D 5e monster data from the 5etools-mirror-3 GitHub repository, parses three 5e.tools URL formats, and extracts HP, AC, and token image URLs.
resource: ../src/api.ts
tags: [api, fetch, monster, 5etools, url-parsing]
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
| `tokenUrl` | `string` (optional, added) | Resolved GitHub raw image URL |
| `sourceUrl` | `string` (optional, added) | Original 5e.tools URL supplied by user |
| `[key]` | `any` | Full stat-block passthrough |

### `fetchMonsterData(url)`

Async function. Entry point for all data loading.

**Steps:**

1. **Parse URL** — detects one of three 5e.tools URL formats (see below) and extracts `source` and `nameIdentifier`.
2. **Fetch JSON** — requests `https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/bestiary/bestiary-{SOURCE}.json`.
3. **Find monster** — sanitizes both the target name identifier and each monster name (strips all non-alphanumeric characters, lowercases), then exact-matches; falls back to prefix-match.
4. **Attach helpers** — sets `tokenUrl` via `calculateTokenUrl` and `sourceUrl` from the original URL.

Throws descriptive `Error` objects on invalid URL, network failure, or no match found.

### `calculateTokenUrl(name, source)`

Builds the GitHub Raw image URL:

```
https://raw.githubusercontent.com/5etools-mirror-3/5etools-img/main/bestiary/tokens/{SOURCE}/{NAME}.webp
```

Name is `encodeURIComponent`-encoded; spaces are preserved for GitHub Raw compatibility.

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
```

## Related concepts

- [spawning](spawning.md) — consumes `fetchMonsterData`, `extractHP`, `extractAC`, `getMonsterDimensions`
- [popovers](popovers/index.md) — `ImportPopover` and `HelpPopover` call `fetchMonsterData` directly
