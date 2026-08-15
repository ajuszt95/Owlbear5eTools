---
type: Module
title: renderer.ts — 5e.tools Markup Renderer
description: Tokenizes 5e.tools {@ ...} inline markup into text and clickable-dice segments, and provides a plain-text stripper for metadata fields.
resource: ../../src/utils/renderer.ts
tags: [renderer, markup, dice, 5etools, tokenizer]
generated: { by: human:ajuszt95, at: 2026-08-15T09:45:00Z }
sources:
  - id: renderer-ts
    resource: ../../src/utils/renderer.ts
    title: src/utils/renderer.ts
---

# renderer.ts — 5e.tools Markup Renderer

## `RenderSegment` type

```ts
type RenderSegment =
  | { type: 'text'; content: string }
  | { type: 'roll'; content: string; formula: string; label: string };
```

- `text` segments are rendered as plain inline text in `ViewPopover`.
- `roll` segments are rendered as clickable buttons that broadcast a dice-roll request to the
  Dice+ extension.

## `render5etoolsText(text)`

Tokenizes a 5e.tools entry string containing `{@tag value|...}` inline markup and returns an
ordered array of `RenderSegment` objects.

The function uses a single regex pass (`/{@(\w+)(?:\s+([^}]+))?}/gi`) and processes each tag
via a `switch` statement:

### Supported tags

| Tag(s) | Output segment type | Notes |
|--------|-------------------|-------|
| `{@atk mw}` / `{@atkr rw}` etc. | `text` | Expands attack type abbreviations to full labels (e.g. `"Melee Weapon Attack:"`) |
| `{@hit +5}` | `roll` | Formula: `1d20+5`; label: `"Attack Roll"` |
| `{@dc 15}` | `text` + `roll` | Prefixes `"DC "` text, then a `1d20` roll button |
| `{@sav dex}` / `{@actsave con}` | `text` | Expands to full attribute saving throw label |
| `{@h}` | `text` | Literal `"Hit: "` |
| `{@recharge 5}` | `roll` | Display: `"(Recharge 5–6)"`; formula: `1d6` |
| `{@damage 2d6+3}` / `{@dice …}` / `{@scaleDice …}` / `{@scaleDamage …}` | `roll` | Formula and content are the raw dice expression |
| `{@actsavefail}` | `text` | `"Failure:"` |
| `{@actsavesuccess}` | `text` | `"Success:"` |
| `{@actsavesuccessfail}` | `text` | `"Failure or Success:"` |
| `{@actsavefailby}` | `text` | `"Failure by 5 or more:"` |
| `{@miss}` | `text` | `"Miss:"` |
| `{@d20 …}` | `roll` | Formula: `1d20`; label: `"d20"` |
| Any unknown tag | `text` | Raw value (or empty string) — unknown tags are tolerated |

After processing, consecutive spaces within text segments are collapsed to a single space.

## `render5etoolsPlainText(text)`

```ts
function render5etoolsPlainText(text: string): string
```

Convenience helper. Runs `render5etoolsText` and joins all `content` fields without separators.
Used wherever a dice-clickable UI is not needed (metadata display strings, AC condition labels, etc.).

## Examples

```ts
render5etoolsText("{@atk mw} {@hit +5} to hit, {@damage 2d6+3} bludgeoning.");
// [
//   { type: 'text',  content: 'Melee Weapon Attack:' },
//   { type: 'roll',  content: '+5', formula: '1d20+5', label: 'Attack Roll' },
//   { type: 'text',  content: ' to hit, ' },
//   { type: 'roll',  content: '2d6+3', formula: '2d6+3', label: 'Roll' },
//   { type: 'text',  content: ' bludgeoning.' },
// ]

render5etoolsPlainText("{@atk mw} {@hit +5} to hit.");
// "Melee Weapon Attack: +5 to hit."
```

## Related concepts

- [popovers](../popovers/index.md) — `ViewPopover` calls `render5etoolsText` to render all action text
