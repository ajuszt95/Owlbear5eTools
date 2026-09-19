# Owlbear5eTools

An [Owlbear Rodeo](https://www.owlbear.rodeo/) extension that brings the
[5e.tools](https://5e.tools) bestiary to your virtual tabletop. Right-click any
token to import a D&D 5e monster stat block from a 5e.tools URL — HP/AC sync
automatically to the **Stat Bubbles for D&D** extension — or spawn brand-new
monster tokens straight from a URL.

GM-only: every entry point checks the player role and shows a restricted-access
screen to non-GM players.

## Install

Add this custom extension URL in Owlbear Rodeo:

```
https://ajuszt95.github.io/Owlbear5eTools/manifest.json
```

## Features

- **Import** a monster stat block onto an existing token (right-click → 5e Tools),
  from a 5e.tools URL or the built-in monster search.
- **View** the full stat block on a token: ability scores, saves, skills,
  actions, reactions, legendary/mythic actions, spellcasting — with clickable
  dice rolls.
- **Quick Spawn** new tokens from the action-bar panel, sized to the correct
  grid footprint via DPI math (never `.scale()`, so Stat Bubbles stays happy).
- **Stat Bubbles sync**: HP/AC write to
  `com.owlbear-rodeo-bubbles-extension/metadata` on import and spawn.
- **Two dice engines**: Dice+ broadcast rolls, or a local Basic roller with
  Nat 1/20 callouts. Advantage/disadvantage + crit doubling included.
- **Initiative bridge**: one click writes DEX-based initiative (with tiebreak
  decimals) to the Initiative Tracker, with a safety net for interrupted rolls.
- **CR scaling**: append `,scaled:CR` to a monster hash to scale its stats
  (e.g. `#goblin_mm,scaled:5`).

## Development

```bash
npm install
npm run dev       # Vite dev server
npm run build     # tsc + vite build → dist/
npm run lint      # ESLint check
npm test          # vitest run
```

Pushing to `main` auto-deploys `./dist` to GitHub Pages via
`.github/workflows/deploy.yml`.

## Versioning

`package.json` is the single source of truth. Never hand-edit built version
files — bump with:

```bash
npm run bump:patch   # or bump:minor / bump:major
```

which also runs `scripts/sync-version.mjs` to propagate the version.

## Docs

- `docs/overview.md` — feature overview and user flows
- `docs/architecture.md` — routes, popovers, metadata keys
- `docs/contributing.md` — contributor guide
- `CLAUDE.md` — architecture + file-by-file guide for agents
- `openspec/` — specs and change proposals
