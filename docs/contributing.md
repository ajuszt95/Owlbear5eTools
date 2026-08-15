---
type: Playbook
title: Contributing — Feature Checklist
description: Patterns and checklists for safely extending the Owlbear5eTools codebase without breaking existing functionality.
tags: [contributing, patterns, checklist, developer-guide]
generated: { by: human:ajuszt95, at: 2026-08-15T09:45:00Z }
sources:
  - id: claude-md
    resource: ../CLAUDE.md
    title: Developer guide (CLAUDE.md)
---

# Contributing — Feature Checklist

## General principles

- **Inline styles only** — no CSS framework, no CSS Modules. Match the existing inline style
  objects and the four-color palette (`#58180D`, `#fdf5e6`, `#ffffff`, `#e0d0b0` / `#999`).
- **No `.scale()` on tokens** — always control size via `dpi`. See [spawning](spawning.md).
- **Always import metadata key constants** from `src/Background.ts`. Never hardcode key strings.
- **GM gate every entry point** — call `OBR.player.getRole()` and bail if not `"GM"`.

## Adding a new popover

- [ ] Add a new hash route in `src/main.tsx`.
- [ ] Open it via `OBR.popover.open(...)` in `src/Background.ts`.
- [ ] Add a matching `OBR.popover.close(...)` call on completion inside the new component.
- [ ] Register it in this docs bundle (`docs/popovers/`).

## Adding a new stat block section to ViewPopover

- [ ] Add a renderer block inside `ViewPopover.tsx`'s `renderEntries` function, or add a
  standalone `render*` function following the signature:
  ```ts
  (entries: any[], activeDice: boolean, rollTarget: string) => ReactNode
  ```
- [ ] Test with at least one real 5e.tools monster that has the new field.

## Adding a new 5e.tools `{@tag}` in the renderer

- [ ] Add a `case` in the `switch` inside `render5etoolsText` in `src/utils/renderer.ts`.
- [ ] Add a test case in `src/utils/renderer.spec.ts`.
- [ ] Update the supported-tags table in [renderer/renderer.md](renderer/renderer.md).

## Adding a new metadata field

- [ ] Add the constant to `src/Background.ts`.
- [ ] Update [metadata-keys.md](metadata-keys.md).
- [ ] Write and read using the namespaced constant everywhere.

## Adding a new monster size

- [ ] Add a `case` to `getMonsterDimensions` in `src/api.ts` with the appropriate multiplier.
- [ ] Update the size table in [api.md](api.md).

## Adding a new 5e.tools URL format

- [ ] Add a parsing branch in `fetchMonsterData` in `src/api.ts`.
- [ ] Add test coverage in `src/api.spec.ts`.
- [ ] Update the URL-format table in [api.md](api.md).

## Related concepts

- [architecture](architecture.md) — routing overview
- [api](api.md) — URL parsing and data model
- [metadata-keys](metadata-keys.md) — key naming rules
- [build-and-deploy](build-and-deploy.md) — how to run tests and build
