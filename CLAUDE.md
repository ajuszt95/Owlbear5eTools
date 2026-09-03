# CLAUDE.md — Owlbear5eTools

## What This Project Is

An **Owlbear Rodeo 2.0 extension** that integrates the [5e.tools](https://5e.tools) bestiary with the virtual tabletop. It lets a GM right-click any token, import a D&D 5e monster stat block from a 5e.tools URL, and have it automatically sync HP/AC to the **Stat Bubbles for D&D** extension. It can also spawn brand-new tokens directly from a URL, pulled from the 5e.tools GitHub mirror.

The extension is **GM-only**: all entry-points check `OBR.player.getRole()` and bail out or show a restricted-access screen for non-GM players.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 7 (base path `/Owlbear5eTools/`) |
| Platform SDK | `@owlbear-rodeo/sdk` v3 |
| Hosting | GitHub Pages (auto-deployed from `main` via GitHub Actions) |
| Linting | ESLint 9 with `typescript-eslint` and `eslint-plugin-react-hooks` |

---

## Architecture

The extension runs as a **single-page app** with **hash-based routing** in `src/main.tsx`. The OBR manifest registers two entry points — a background worker and a help/action popover — then the background script opens additional popovers on demand.

```
index.html#background      → initBackground()  (no UI, GM-only worker)
index.html#help            → <HelpPopover />   (action bar panel, 500×600)
index.html#/import?id=ID   → <ImportPopover /> (attach stats to existing token, 350×300)
index.html#/view?id=ID     → <ViewPopover />   (full stat block viewer, 350×600)
```

`main.tsx` reads `window.location.hash` and renders the matching component. Hash changes are listened to via `window.addEventListener("hashchange", ...)` so the single HTML file can serve all roles.

---

## File-by-File Guide

### `src/Background.ts`
- Exports all shared **constant identifiers** (extension ID, metadata keys, Stat Bubbles keys).
- `initBackground()`: called when hash is `#background`. Registers the right-click context menu (GM only). On click, checks if the token already has monster metadata — opens `view-popover` if yes, `import-popover` if no.
- `initInitiativeSafetyNet()`: GM-only background listener that completes orphaned Dice+ initiative rolls when the ViewPopover closes mid-roll (writes if absent, notifies without overwriting if present). See `src/Background.spec.ts`.

### `src/api.ts`
- `Monster` interface — the raw 5e.tools JSON schema with an extra `tokenUrl` and `sourceUrl` field attached after fetch.
- `fetchMonsterData(url)` — parses three 5e.tools URL formats (query param hash, fragment hash, path slug), fetches the correct `bestiary-SOURCE.json` from the 5etools-mirror-3 GitHub repo, finds the monster by sanitized name match, and attaches `tokenUrl`.
- `calculateTokenUrl(name, source)` — constructs the GitHub raw image URL (`/bestiary/tokens/SOURCE/NAME.webp`).
- `getMonsterDimensions(size[])` — maps 5e size codes (T/S/M/L/H/G) to OBR grid multipliers (0.5 → 4).
- `extractAC(monster)` / `extractHP(monster)` — safe accessors that handle both number and object forms of the `ac`/`hp` fields.

### `src/spawning.ts`
- `spawnMonster(url, itemWidth, itemHeight)` — fetches monster data, calculates DPI (`itemDpi = itemWidth / multiplier`) so the image occupies exactly the right number of grid squares, centers the token in the current viewport, and calls `OBR.scene.items.addItems`. Sets both the extension's own metadata key and the Stat Bubbles metadata keys in one operation.

### `src/main.tsx`
- Single-file router (no react-router). Hash-based. Wraps everything in a class-based `ErrorBoundary` that displays the stack trace and a reload button on crash.

### `src/HelpPopover.tsx`
- The action bar panel. Shows Quick Token Spawn form (URL → spawn with image pre-fetch for natural dimensions), usage instructions, and Stat Bubbles integration notes. Role-gated.

### `src/ImportPopover.tsx`
- Opened by right-clicking an **existing** token that has no monster metadata. Fetches monster data from a URL and writes it to the token's metadata, including Stat Bubbles fields. Closes itself on success.

### `src/ViewPopover.tsx`
- The main stat block viewer. Opened by right-clicking a token that **already has** monster metadata. Full 5e stat block rendering: ability scores, saves, skills, actions, reactions, legendary actions, mythic actions, spellcasting, tables, lists, insets.
- **Dice integration**: supports **Dice+** and **Basic** rolling modes. In Dice+ mode, pings `dice-plus/isReady` and broadcasts rolls to `dice-plus/roll-request`. In Basic mode, evaluates dice formulas locally and displays results via `OBR.notification.show()` with Nat 1/20 indicators while locking roll target to Self. Both roll target and roll engine are persisted in `localStorage`.
- **Remove button**: strips all metadata keys and resets token name to "Token", then closes the popover.

### `src/utils/diceRoller.ts`
- `parseDiceFormula(formula)` — parses dice expressions (`1d20+5`, `2d6+3`, `8`, etc.) into structured dice groups and static modifiers.
- `evaluateRoll(formula, options)` — rolls dice, calculates totals, identifies Natural 1 / Natural 20 on single d20s, and generates formatted result strings and OBR notification variants (`SUCCESS`, `ERROR`, `DEFAULT`).

### `src/utils/renderer.ts`
- `render5etoolsText(text)` — tokenizer for 5e.tools `{@tag value}` markup. Returns an array of `RenderSegment` objects (`{ type: 'text' }` or `{ type: 'roll', formula, label }`). Handles: `@atk`, `@hit`, `@damage`, `@dice`, `@dc`, `@sav`, `@recharge`, `@scaleDice`, and several action-result tags.
- `render5etoolsPlainText(text)` — strips markup to plain string (used in metadata fields and display strings like AC conditions).

---

## Key Patterns

### Metadata Keys
All OBR metadata must be namespaced. This project uses:
- `com.ajuszt95.5etools/monster` — the full `Monster` JSON blob stored on a token.
- `com.owlbear-rodeo-bubbles-extension/metadata` — Stat Bubbles' format: `{ health, "max health", "armor class", "temporary health", hide }`.
- `com.owlbear-rodeo-bubbles-extension/name` — Stat Bubbles' display name key.

Never use bare string keys in metadata.

### Token Sizing
OBR uses DPI-based sizing. The formula used is:
```
itemDpi = imageNativePixels / gridMultiplier
```
This means a 280×280px image for a Large creature (multiplier 2) gets `dpi = 140`, which OBR interprets as 2 grid squares wide. **Do not use `.scale()`** — it breaks Stat Bubbles and other extension compatibility.

### URL Parsing (three formats)
`fetchMonsterData` handles:
1. `?hash=name_source&source=SOURCE` (query param format, double-URL-encoded)
2. `bestiary.html#name_source` (fragment hash format)
3. `bestiary/name-source.html` (path slug format)

Name matching uses a sanitizer that strips all non-alphanumeric characters before comparing, with a prefix-match fallback.

### Dice Handshake
The dice integration is opportunistic — the extension pings a set of channel names every second and stops once it gets a `{ ready: true, requestId }` reply. Rolls are "shotgun" broadcast across four channel variants because different versions of Dice+ extension use different channel names.

### Styling Convention
All styles are inline React style objects. The color palette is:
- Primary red: `#58180D` (D&D Player's Handbook red)
- Background: `#fdf5e6` (parchment)
- Card white: `#ffffff`
- Muted: `#e0d0b0` borders, `#999` text

No CSS framework or CSS Modules — keep to inline styles to match existing code.

---

## Build & Deploy

```bash
npm install
npm run dev       # Vite dev server
npm run build     # tsc + vite build → dist/
npm run lint      # ESLint check
```

Pushing to `main` triggers the GitHub Actions workflow (`.github/workflows/deploy.yml`) which builds and deploys `./dist` to GitHub Pages. The live URL is the base for the OBR manifest entries.

> After implementing a user-facing change, load the `owlbear-e2e` skill (`.opencode/skills/owlbear-e2e/SKILL.md`) and run the live-room smoke before claiming done.

---

## Adding Features — Checklist

- [ ] New popover? Add a route in `main.tsx`, open it via `OBR.popover.open` in `Background.ts`, add a matching `close()` call on completion.
- [ ] New stat block section? Add a renderer block in `ViewPopover.tsx`'s `renderEntries` or as a standalone `render*` function following the same `(entries, activeDice, rollTarget) => ReactNode` signature.
- [ ] New 5e.tools tag? Add a `case` in the `switch` inside `render5etoolsText` in `renderer.ts`.
- [ ] New metadata field? Always use the namespaced key from `Background.ts` constants.
- [ ] New size? Add a case to `getMonsterDimensions` in `api.ts`.
