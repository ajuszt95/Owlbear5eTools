---
type: Architecture
title: Application Architecture
description: How the single-page app routes hash-based URLs to its four rendering roles, and how data flows from 5e.tools through the OBR platform.
tags: [architecture, routing, spa, owlbear-rodeo]
generated: { by: human:ajuszt95, at: 2026-08-15T09:45:00Z }
sources:
  - id: main-tsx
    resource: ../src/main.tsx
    title: src/main.tsx — hash router and ErrorBoundary
  - id: background-ts
    resource: ../src/Background.ts
    title: src/Background.ts — background worker
  - id: claude-md
    resource: ../CLAUDE.md
    title: Developer guide (CLAUDE.md)
---

# Application Architecture

## Overview

The extension is a **single HTML file** (`index.html`) deployed to GitHub Pages. It uses
**hash-based routing** — the OBR manifest registers the same file under two roles, and `main.tsx`
reads `window.location.hash` to decide which React component to render.

## Routing table

| Hash pattern | Rendered component | Opened by | Size |
|---|---|---|---|
| `#background` | `initBackground()` (no UI) | OBR on load | — |
| `#help` | `<HelpPopover />` | Action bar icon | 500 × 600 |
| `#/import?id=<tokenId>` | `<ImportPopover />` | Background worker (right-click, no metadata) | 350 × 300 |
| `#/view?id=<tokenId>` | `<ViewPopover />` | Background worker (right-click, has metadata) | 350 × 600 |

Hash changes fire `window.addEventListener("hashchange", ...)` so navigation within the single
page does not require a reload.

## Data-flow diagram

```
User action (right-click token / Help popover form)
        │
        ▼
Background.ts (initBackground)
  · registers OBR context menu (GM only)
  · reads token metadata → decides import vs view
  · opens the appropriate popover via OBR.popover.open
        │
        ▼
ImportPopover / HelpPopover (spawning)
  · user provides 5e.tools URL
        │
        ▼
api.ts:fetchMonsterData
  · parses three URL formats (query-param, hash, path)
  · fetches bestiary-SOURCE.json from 5etools-mirror-3 GitHub
  · finds monster by sanitized name match
  · attaches tokenUrl and sourceUrl
        │
        ▼
OBR.scene.items (write)
  · stores Monster JSON under com.ajuszt95.5etools/monster
  · stores HP/AC under Stat Bubbles metadata key
        │
        ▼
ViewPopover (read path)
  · reads monster JSON from OBR.scene.items metadata
  · renders full stat block
  · pings Dice+ extension; renders clickable dice on reply
```

## Error handling

`main.tsx` wraps all routes in a class-based `ErrorBoundary`. On unhandled render errors, it
displays the component stack trace and a **Reload** button so the GM can recover without leaving
the VTT.

## Key design constraints

- **No CSS framework or CSS modules** — all styles are inline React style objects. This avoids
  class-name collisions with OBR's own stylesheet.
- **No `.scale()` on tokens** — OBR sizing is controlled exclusively via `dpi`; using `.scale()`
  breaks Stat Bubbles and other extension compatibility.
- **No react-router** — the single-hash router is intentionally minimal to keep the bundle small
  and avoid hydration concerns.

## Related concepts

- [background](../background.md) — context menu registration and routing decisions
- [api](../api.md) — monster data fetch pipeline
- [spawning](../spawning.md) — token placement and DPI calibration
- [popovers](../popovers/index.md) — UI components for each route
