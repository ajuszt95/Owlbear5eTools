---
type: Module
title: HelpPopover — Action Bar Panel
description: The action-bar popover rendered at #help. Shows the Quick Token Spawn form and usage instructions. Entry point for the token-spawn workflow.
resource: ../../src/HelpPopover.tsx
tags: [popover, ui, spawn, react, gm-only]
generated: { by: human:ajuszt95, at: 2026-08-15T09:45:00Z }
sources:
  - id: help-tsx
    resource: ../../src/HelpPopover.tsx
    title: src/HelpPopover.tsx
---

# HelpPopover — Action Bar Panel

## Purpose

Rendered at `index.html#help` (500 × 600 px). This is the extension's primary action-bar panel,
opened by clicking the extension icon in the OBR sidebar.

## Role gate

On mount, checks `OBR.player.getRole()`. If the player is not a GM, the panel renders a
restricted-access screen instead of the spawn form.

## Quick Token Spawn workflow

1. GM pastes a 5e.tools monster URL into the input field.
2. The component pre-fetches the monster data (via `fetchMonsterData`) to obtain the `tokenUrl`.
3. The token image is loaded into a hidden `<img>` element to obtain its **natural pixel
   dimensions** (`naturalWidth`, `naturalHeight`).
4. On "Spawn Token" click, calls `spawnMonster(url, naturalWidth, naturalHeight)`.
5. On success, shows a confirmation message with the monster name.

Pre-fetching the image dimensions is essential for the DPI-calibration formula in
[spawning.ts](../spawning.md).

## Content sections

| Section | Description |
|---------|-------------|
| Quick Token Spawn | URL input + Spawn button |
| Usage instructions | Step-by-step guide for right-click import and view workflows |
| Stat Bubbles note | Explains automatic HP/AC sync with Stat Bubbles extension |

## Styling

All styles are inline React style objects using the project color palette:

| Token | Value |
|-------|-------|
| Primary red | `#58180D` (D&D Player's Handbook red) |
| Background | `#fdf5e6` (parchment) |
| Card background | `#ffffff` |
| Borders | `#e0d0b0` |
| Muted text | `#999` |

## Related concepts

- [spawning](../spawning.md) — `spawnMonster` called on form submit
- [architecture](../architecture.md) — hash routing entry point `#help`
