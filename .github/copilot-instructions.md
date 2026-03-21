# Copilot Instructions — Owlbear5eTools

## Project Summary

This is an **Owlbear Rodeo 2.0 extension** (VTT plugin) that bridges the [5e.tools](https://5e.tools) bestiary with Owlbear Rodeo token metadata. GMs can import D&D 5e monster stat blocks onto tokens and view full stat blocks in-VTT with clickable dice rolls.

**Stack:** React 19 + TypeScript + Vite 7, deployed to GitHub Pages. The only runtime dependency is `@owlbear-rodeo/sdk`.

---

## Project Structure

```
src/
  main.tsx           # Hash-based router + ErrorBoundary — single entry point for all views
  Background.ts      # Shared constants + OBR context menu registration (background worker)
  api.ts             # 5e.tools data fetching, URL parsing, monster helpers
  spawning.ts        # Token creation logic (OBR buildImage + metadata)
  ImportPopover.tsx  # Right-click → import URL → attach stats to existing token
  ViewPopover.tsx    # Right-click → view full stat block (dice-clickable)
  HelpPopover.tsx    # Action bar panel: Quick Spawn + usage instructions
  utils/
    renderer.ts      # 5e.tools {@tag} markup → RenderSegment[] tokenizer
public/
  manifest.json      # OBR extension manifest
```

---

## Routing

There is **no router library**. `main.tsx` reads `window.location.hash` directly:

| Hash pattern | Rendered component |
|---|---|
| `#background` | `initBackground()` (no UI) |
| `#/import?id=TOKEN_ID` | `<ImportPopover />` |
| `#/view?id=TOKEN_ID` | `<ViewPopover />` |
| `#help` | `<HelpPopover />` |

When adding a new view, add a route here and a matching `OBR.popover.open(...)` call in `Background.ts`.

---

## OBR API Patterns

### Reading the current token ID
Popovers are opened with the token ID in the hash query string. Parse it like this:
```ts
const hashParts = window.location.hash.split("?");
const urlParams = new URLSearchParams(hashParts[1] || "");
const tokenId = urlParams.get("id");
```

### Writing metadata to a token
```ts
await OBR.scene.items.updateItems([tokenId], (items) => {
    items[0].metadata[METADATA_KEY] = monsterData;
    items[0].metadata[BUBBLES_METADATA_KEY] = { health: hp, "max health": hp, ... };
});
```

### Creating a new token (spawning)
See `spawning.ts`. Use `buildImage(...).position(...).layer("CHARACTER").metadata({...}).build()` then `OBR.scene.items.addItems([item])`. Token sizing uses `itemDpi = imageNativePixels / gridMultiplier` — do NOT use `.scale()`.

### Closing a popover
```ts
await OBR.popover.close(`${EXTENSION_ID}/import-popover`);
```

### Role check (GM guard)
```ts
OBR.onReady(async () => {
    const role = await OBR.player.getRole();
    if (role !== "GM") return; // or show restricted UI
});
```

---

## Metadata Key Constants

All metadata keys live in `Background.ts`. Always import from there — never hardcode strings.

```ts
export const EXTENSION_ID = "com.ajuszt95.5etools";
export const METADATA_KEY = `${EXTENSION_ID}/monster`;            // monster JSON blob
export const BUBBLES_METADATA_KEY = "com.owlbear-rodeo-bubbles-extension/metadata"; // Stat Bubbles
export const BUBBLES_NAME = "com.owlbear-rodeo-bubbles-extension/name";
```

---

## 5e.tools Data

### Fetching
`fetchMonsterData(url)` in `api.ts` accepts three URL formats from 5e.tools:
- `bestiary.html#name_source` (fragment)
- `index.html?source=X&hash=name_source` (query param, may be double-encoded)
- `bestiary/name-source.html` (path slug)

It fetches `https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/bestiary/bestiary-SOURCE.json` and finds the matching monster.

### Markup rendering
5e.tools embeds `{@tag value|pipe|separated}` tokens in all text fields. `renderer.ts` tokenizes these into `RenderSegment[]`:
- `{ type: 'text', content: string }` — plain text
- `{ type: 'roll', content: string, formula: string, label: string }` — clickable dice

When rendering stat block text, always use `renderMarkup(text, activeDice, rollTarget)` from `ViewPopover.tsx` (which calls `render5etoolsText`). For plain string contexts (e.g. conditions, speed labels), use `render5etoolsPlainText(text)` from `renderer.ts`.

---

## Dice Integration

The extension integrates with the **Dice+** extension via `OBR.broadcast`. On `ViewPopover` mount, it pings multiple channel names every second until it receives a `{ ready: true, requestId }` response. Rolls are broadcast to all four known channel variants simultaneously:

```ts
const channels = ["dice-plus/roll-request", "dice/roll-request", "dice-plus/roll", "dice/roll"];
for (const ch of channels) {
    await OBR.broadcast.sendMessage(ch, payload, { destination: 'ALL' });
}
```

The `activeDice` boolean gates whether dice elements are clickable. It can also be forced on via the "Force Enable" button in the footer.

---

## Styling Rules

- **All styles are inline React style objects** — no CSS files (except `index.css` for resets), no CSS modules, no Tailwind.
- Color palette:
  - Primary: `#58180D` (D&D red)
  - Background: `#fdf5e6` (parchment)
  - Card: `#ffffff`
  - Border: `#e0d0b0`
- Cards use `borderRadius: "12px"`, `boxShadow: "0 4px 12px rgba(88, 24, 13, 0.1)"`.
- Buttons: `background: "#58180D"`, white text, `borderRadius: "8px"`. Disabled state uses `background: "#ccc"`.

---

## What NOT to Do

- Do not add a router library (react-router, etc.) — hash routing is intentional.
- Do not use `.scale()` on tokens — it breaks Stat Bubbles compatibility.
- Do not hardcode metadata key strings — always use constants from `Background.ts`.
- Do not add CSS files or a CSS framework — use inline styles to match existing code.
- Do not write to metadata without the full Stat Bubbles structure when modifying health/AC — other extensions depend on the exact key names.
- Do not bypass the GM role check in any popover or background script.
