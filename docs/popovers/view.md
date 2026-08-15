---
type: Module
title: ViewPopover — Stat Block Viewer
description: Full D&D 5e stat-block viewer with ability scores, saves, skills, actions, spellcasting, and clickable dice rolls via Dice+ integration. Also exposes a Remove button.
resource: ../../src/ViewPopover.tsx
tags: [popover, ui, stat-block, dice, react, gm-only]
generated: { by: human:ajuszt95, at: 2026-08-15T09:45:00Z }
sources:
  - id: view-tsx
    resource: ../../src/ViewPopover.tsx
    title: src/ViewPopover.tsx (42 KB)
  - id: claude-md
    resource: ../../CLAUDE.md
    title: Developer guide (CLAUDE.md)
---

# ViewPopover — Stat Block Viewer

## Purpose

Rendered at `index.html#/view?id=<tokenId>` (350 × 600 px). Opened by the background worker when
the GM right-clicks a token that **already has** monster metadata attached.

## Data loading

1. Reads `tokenId` from the URL query string.
2. Subscribes to `OBR.scene.items.onChange` to get the token item.
3. Reads `monster = item.metadata[METADATA_KEY]` — the full `Monster` JSON previously stored by
   `ImportPopover` or `spawnMonster`.

## Stat block sections rendered

| Section | 5e stat block element |
|---------|----------------------|
| Header | Name, size, type, alignment |
| Core stats | AC, HP (average + formula), Speed |
| Ability scores | STR/DEX/CON/INT/WIS/CHA with modifiers |
| Saving throws | Only the proficient saves |
| Skills | Only the proficient skills |
| Resistances / Immunities / Vulnerabilities | Damage types |
| Senses | Darkvision, tremorsense, etc. + Passive Perception |
| Languages | |
| Challenge Rating | CR + XP |
| Special abilities | Trait blocks |
| Actions | With full `{@ ...}` markup rendering |
| Reactions | |
| Bonus Actions | |
| Legendary Actions | With preamble and per-action entries |
| Mythic Actions | |
| Spellcasting | Spell slots per level, innate casting, at-will lists |
| Inset (Lair Actions etc.) | Nested entry blocks |
| Tables | Rendered as HTML tables |

All entry text passes through `render5etoolsText` from [renderer.ts](../renderer/renderer.md),
producing a mix of plain text spans and clickable dice buttons.

## Dice & Rolling integration

### Roll Engines

The stat-block viewer supports two roll modes via the **Roll Engine** toggle:

1. **Dice+ (Default)**: Broadcasts roll requests over OBR broadcast channels to the 3rd-party Dice+ extension.
   - On mount, polls `dice-plus/isReady` until Dice+ confirms ready.
   - Click broadcasts `{ rollId, playerId, playerName, rollTarget, diceNotation, showResults, timestamp, source }` to `dice-plus/roll-request`.
   - Supports rolling to **Everyone** or **Self**.
2. **Basic (Local fallback)**: Evaluates dice formulas locally using `src/utils/diceRoller.ts` without relying on external extensions.
   - Displays result toasts directly on the tabletop via `OBR.notification.show()`.
   - Automatically forces and locks the **Roll to** option to **Self** (unclickable/disabled).
   - Formats breakdowns (e.g. `Result of the roll: 14 (1d20) + 3 = 17`), with special indicators for Natural 20 (`Nat 20! 😎`, green `SUCCESS` toast) and Natural 1 (`Nat 1 :(`, red `ERROR` toast).
   - Dice buttons are always active and clickable in Basic mode regardless of Dice+ status.

Both `rollTarget` and `rollEngine` are persisted in `localStorage` (`5etools-roll-target` and `5etools-roll-engine`).

## Remove button

Strips all extension metadata from the token and resets its OBR name to `"Token"`, then closes
the popover. Constants used:

- `METADATA_KEY` — set to `undefined`
- `BUBBLES_METADATA_KEY` — set to `undefined`
- `BUBBLES_NAME` — set to `undefined`

## Related concepts

- [renderer](../renderer/renderer.md) — markup tokenizer used to render action text
- [metadata-keys](../metadata-keys.md) — keys read and removed by this component
- [background](../background.md) — opens this popover when metadata exists
- [import](import.md) — writes the metadata this viewer reads
