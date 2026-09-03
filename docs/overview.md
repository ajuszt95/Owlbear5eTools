---
type: Project Overview
title: Owlbear5eTools
description: An Owlbear Rodeo 2.0 extension that integrates the 5e.tools bestiary with the virtual tabletop, enabling GMs to import D&D 5e monster stat blocks and spawn tokens directly from 5e.tools URLs.
resource: https://github.com/ajuszt95/Owlbear5eTools
tags: [owlbear-rodeo, dnd5e, 5etools, vtt, extension, gm-only]
generated: { by: human:ajuszt95, at: 2026-08-15T09:45:00Z }
sources:
  - id: manifest
    resource: ../public/manifest.json
    title: OBR Extension Manifest
  - id: readme
    resource: ../README.md
    title: Project README
  - id: claude-md
    resource: ../CLAUDE.md
    title: Developer guide (CLAUDE.md)
---

# Owlbear5eTools

## What it does

Owlbear5eTools is a **GM-only** Owlbear Rodeo 2.0 extension that bridges the popular
[5e.tools](https://5e.tools) website with the VTT.

It allows a Game Master to:

1. **Import a stat block** — right-click any existing token on the CHARACTER layer and paste a
   5e.tools monster URL to attach the full 5e stat block to that token.
2. **View a stat block** — right-click a token that already has a stat block attached to open a
   styled, scrollable stat-block viewer with clickable dice rolls.
3. **Spawn a new token** — paste a 5e.tools URL in the action-bar panel to fetch the monster's
   artwork and place a correctly-sized token in the centre of the viewport, pre-loaded with HP,
   max HP, AC, and a display name.

The extension automatically syncs HP, max HP, and AC values into the **Stat Bubbles for D&D**
extension format, so bubble overlays appear immediately after import or spawn.

## Access control

All entry points call `OBR.player.getRole()` and abort for non-GM players. Players who open the
extension see a restricted-access screen; no stat block data is written or displayed.

## Live URL & installation

| Item | Value |
|------|-------|
| Extension manifest | `https://ajuszt95.github.io/Owlbear5eTools/manifest.json` |
| Author | ajuszt95 |
| Current version | 1.7.0 |

Install by pasting the manifest URL into the Owlbear Rodeo extensions dialog.

## Technology stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript |
| Build | Vite 7 (`base: /Owlbear5eTools/`) |
| Platform SDK | `@owlbear-rodeo/sdk` v3 |
| Hosting | GitHub Pages (auto-deployed via GitHub Actions) |
| Linting | ESLint 9 with `typescript-eslint` + `eslint-plugin-react-hooks` |
| Testing | Vitest |
