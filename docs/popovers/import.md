---
type: Module
title: ImportPopover — Stat Block Import
description: Attaches a D&D 5e monster stat block from a 5e.tools URL to an existing Owlbear Rodeo token, and writes Stat Bubbles metadata in one operation.
resource: ../../src/ImportPopover.tsx
tags: [popover, ui, import, react, gm-only, stat-bubbles]
generated: { by: human:ajuszt95, at: 2026-08-15T09:45:00Z }
sources:
  - id: import-tsx
    resource: ../../src/ImportPopover.tsx
    title: src/ImportPopover.tsx
---

# ImportPopover — Stat Block Import

## Purpose

Rendered at `index.html#/import?id=<tokenId>` (350 × 300 px). Opened by the background worker
when the GM right-clicks a CHARACTER-layer image token that has **no** existing monster metadata.

## Workflow

1. Reads `tokenId` from the URL query string.
2. GM pastes a 5e.tools monster URL into the input field and clicks **Import**.
3. Calls `fetchMonsterData(url)` to retrieve the full stat block.
4. Calls `OBR.scene.items.updateItems` on the target token, writing:
   - `METADATA_KEY` → full `Monster` JSON
   - `BUBBLES_METADATA_KEY` → `{ health, "max health", "armor class", "temporary health", hide }`
   - `BUBBLES_NAME` → monster display name
   - Renames the OBR token to the monster name
5. On success, calls `OBR.popover.close(EXTENSION_ID + "/import-popover")` — the popover
   closes itself automatically.

## Error handling

If `fetchMonsterData` throws (invalid URL, network error, no match), the error message is
displayed inline inside the popover. The GM can correct the URL and retry.

## Related concepts

- [api](../api.md) — `fetchMonsterData` and `extractHP` / `extractAC`
- [metadata-keys](../metadata-keys.md) — keys written to the token
- [background](../background.md) — opens this popover when no metadata is found
- [view](view.md) — opened instead when metadata already exists
