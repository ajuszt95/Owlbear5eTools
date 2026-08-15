---
type: Module
title: spawning.ts — Token Spawning
description: Fetches monster data, computes DPI-based sizing, and places a new image token centered in the current viewport with Stat Bubbles metadata pre-set.
resource: ../src/spawning.ts
tags: [spawning, token, dpi, owlbear-rodeo, stat-bubbles]
generated: { by: human:ajuszt95, at: 2026-08-15T09:45:00Z }
sources:
  - id: spawning-ts
    resource: ../src/spawning.ts
    title: src/spawning.ts
  - id: claude-md
    resource: ../CLAUDE.md
    title: Developer guide (CLAUDE.md)
---

# spawning.ts — Token Spawning

## `spawnMonster(url, itemWidth, itemHeight)`

Async function called by `HelpPopover` after the user pre-fetches the token image to get its
natural pixel dimensions.

### Steps

1. Calls `fetchMonsterData(url)` → `Monster`.
2. Extracts `hp` and `ac` via `extractHP` / `extractAC`.
3. Gets the OBR grid DPI via `OBR.scene.grid.getDpi()`.
4. Gets the viewport centre in world coordinates:
   ```
   viewCenter = OBR.viewport.inverseTransformPoint({ x: width/2, y: height/2 })
   ```
5. Computes `worldSize = multiplier × gridDpi` and `topLeft` so the token is centred.
6. Computes `itemDpi`:
   ```
   itemDpi = imageNativePixels / multiplier
   ```
   This is the core DPI-calibration formula (see below).
7. Builds an OBR image item via `buildImage(...)`, applying:
   - Token image URL (falls back to a blank PNG)
   - MIME type `image/png`
   - Native pixel dimensions
   - Computed `itemDpi` and zero offset
   - Layer `CHARACTER`
   - `monster.name` as the display name
   - Both `METADATA_KEY` (full monster JSON) and `BUBBLES_METADATA_KEY` (HP/AC/name) in metadata
8. Calls `OBR.scene.items.addItems([imageItem])`.

### DPI calibration formula

OBR determines how many grid squares a token occupies via:

```
nativeUnits = imagePixels / dpi
```

Setting `dpi = imagePixels / targetGridMultiplier` makes the token occupy exactly
`targetGridMultiplier` grid squares in each axis.

**Example:** A 280 × 280 px image for a Large creature (multiplier = 2):

```
itemDpi = 280 / 2 = 140
→ nativeUnits = 280 / 140 = 2   ✓
```

> **Do not use `.scale()`** — it breaks Stat Bubbles and other extensions that read token DPI.

### Metadata written on spawn

```json
{
  "com.ajuszt95.5etools/monster": { /* full Monster object */ },
  "com.owlbear-rodeo-bubbles-extension/metadata": {
    "health": <hp>,
    "max health": <hp>,
    "armor class": <ac>,
    "temporary health": 0,
    "hide": false
  },
  "com.owlbear-rodeo-bubbles-extension/name": "<monster.name>"
}
```

## Related concepts

- [api](api.md) — `fetchMonsterData`, `extractHP`, `extractAC`, `getMonsterDimensions`
- [metadata-keys](metadata-keys.md) — canonical key constants
- [popovers/help](popovers/index.md) — calls `spawnMonster` after image pre-fetch
