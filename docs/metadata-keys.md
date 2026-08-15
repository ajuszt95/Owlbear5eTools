---
type: Reference
title: OBR Metadata Keys
description: All Owlbear Rodeo metadata key names used by this extension, their owners, and the shape of the value stored under each key.
tags: [metadata, constants, owlbear-rodeo, stat-bubbles, reference]
generated: { by: human:ajuszt95, at: 2026-08-15T09:45:00Z }
sources:
  - id: background-ts
    resource: ../src/Background.ts
    title: src/Background.ts — constant definitions
---

# OBR Metadata Keys

All OBR item metadata must be namespaced. This page is the authoritative reference.

## Extension-owned keys

| Constant | Key string | Value shape |
|----------|-----------|------------|
| `METADATA_KEY` | `com.ajuszt95.5etools/monster` | Full `Monster` JSON object (see [api.ts](api.md)) |

## Stat Bubbles extension keys

These keys are owned by the **Stat Bubbles for D&D** extension. Writing to them causes Stat
Bubbles to display HP/AC overlays without any further coordination.

| Constant | Key string | Value |
|----------|-----------|-------|
| `BUBBLES_METADATA_KEY` | `com.owlbear-rodeo-bubbles-extension/metadata` | Object (see below) |
| `BUBBLES_NAME` | `com.owlbear-rodeo-bubbles-extension/name` | `string` — display name |

### `BUBBLES_METADATA_KEY` value shape

```json
{
  "health":           <number>,   // current HP
  "max health":       <number>,   // maximum HP
  "armor class":      <number>,   // AC
  "temporary health": <number>,   // temp HP (0 on spawn/import)
  "hide":             <boolean>   // whether to hide bubbles (false on spawn/import)
}
```

## Rules

- **Never hardcode key strings** — always import constants from `src/Background.ts`.
- All keys are set atomically in a single `OBR.scene.items.updateItems` or `addItems` call to
  avoid partial writes.
- The **Remove** action in `ViewPopover` strips all keys and resets the token name to `"Token"`.

## Related concepts

- [background](background.md) — where constants are defined
- [spawning](spawning.md) — writes both key families on token creation
- [popovers](popovers/index.md) — `ImportPopover` writes both families; `ViewPopover` reads and removes `METADATA_KEY`
