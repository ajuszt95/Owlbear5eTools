---
type: Module
title: Background.ts — Worker & Constants
description: Exports all shared extension constants (IDs, metadata keys) and registers the OBR right-click context menu for GM players only.
resource: ../src/Background.ts
tags: [background, context-menu, constants, gm-only, owlbear-rodeo]
generated: { by: human:ajuszt95, at: 2026-08-15T09:45:00Z }
sources:
  - id: background-ts
    resource: ../src/Background.ts
    title: src/Background.ts
---

# Background.ts — Worker & Constants

## Exported constants

These constants are the canonical source of truth for all metadata key names used across the
extension. **Never hardcode these strings elsewhere** — import from `Background.ts`.

| Constant | Value | Purpose |
|----------|-------|---------|
| `EXTENSION_ID` | `"com.ajuszt95.5etools"` | Unique extension namespace |
| `METADATA_KEY` | `"com.ajuszt95.5etools/monster"` | Key under which the full `Monster` JSON is stored on a token |
| `BUBBLES_METADATA_KEY` | `"com.owlbear-rodeo-bubbles-extension/metadata"` | Stat Bubbles extension metadata key |
| `BUBBLES_NAME` | `"com.owlbear-rodeo-bubbles-extension/name"` | Stat Bubbles display name key |
| `BUBBLES_HEALTH` | `"health"` | HP field name inside Stat Bubbles metadata |
| `BUBBLES_MAX_HEALTH` | `"max health"` | Max HP field |
| `BUBBLES_TEMP_HEALTH` | `"temporary health"` | Temp HP field |
| `BUBBLES_ARMOR_CLASS` | `"armor class"` | AC field |
| `BUBBLES_HIDE` | `"hide"` | Hide-bubbles flag |

## `initBackground()`

Called when `window.location.hash === "#background"`. This is the invisible worker role.

**Lifecycle:**

1. Waits for `OBR.onReady`.
2. Reads `OBR.player.getRole()`. If not `"GM"` → returns immediately, no menu is registered.
3. Calls `OBR.contextMenu.create` to register a right-click item on **CHARACTER-layer IMAGE
   tokens** only (enforced by OBR filter).
4. On click, reads the first selected token's metadata under `METADATA_KEY`:
   - **Has metadata** → opens the **view-popover** (`#/view?id=<tokenId>`, 350×600).
   - **No metadata** → opens the **import-popover** (`#/import?id=<tokenId>`, 350×300).

## Context menu filter

```json
{
  "every": [
    { "key": "layer", "operator": "==", "value": "CHARACTER" },
    { "key": "type",  "operator": "==", "value": "IMAGE" }
  ]
}
```

The menu only appears on image tokens placed on the CHARACTER layer, matching the expected
placement for monster tokens.

## Related concepts

- [architecture](architecture.md) — routing and entry points
- [metadata-keys](metadata-keys.md) — full reference for all key names
- [popovers](popovers/index.md) — the popover components opened by this worker
