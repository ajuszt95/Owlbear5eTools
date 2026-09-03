---
type: Playbook
title: Build & Deploy
description: How to install dependencies, run a local dev server, build the production bundle, and deploy to GitHub Pages.
tags: [build, deploy, vite, github-pages, ci]
generated: { by: human:ajuszt95, at: 2026-08-15T09:45:00Z }
sources:
  - id: package-json
    resource: ../package.json
    title: package.json
  - id: deploy-yml
    resource: ../.github/workflows/deploy.yml
    title: .github/workflows/deploy.yml
  - id: vite-config
    resource: ../vite.config.ts
    title: vite.config.ts
---

# Build & Deploy

## Prerequisites

- Node.js 20+
- npm

## Local development (HTTPS dev loop)

Owlbear Rodeo runs on HTTPS, so a plain-HTTP localhost dev server is blocked as
mixed content. This repo therefore serves the extension over HTTPS (self-signed
cert, dev only) and installs it as a **separate `(DEV)` extension** alongside the
store version — a different manifest URL means a separate install. Everyday
testing is **edit → save → reopen the popover** (~2 s hot reload): no merge, no
version bump, no deploy.

### One-time setup

```bash
npm install        # installs @vitejs/plugin-basic-ssl (dev-only cert plugin)
npm run dev        # HTTPS dev server on https://localhost:5173/ (fixed port)
```

1. Trust the self-signed cert **once**: visit
   `https://localhost:5173/Owlbear5eTools/manifest-dev.json` in your browser and
   click through the warning. (Alternative: enable
   `chrome://flags/#allow-insecure-localhost`. For a proper local CA, `mkcert`
   is an option but not required.)
2. In the Owlbear Rodeo room: **Extensions → Add Custom Extension** → paste
   `https://localhost:5173/Owlbear5eTools/manifest-dev.json`. This persists, so
   you only do it once.
3. Confirm a second, distinctly-named action-bar entry
   (`5e Tools Integration (DEV)`) appears next to the store version.

The dev manifest (`public/manifest-dev.json`) mirrors the prod manifest except
for the `(DEV)` name/title suffix and a static `version: "0.0.0-dev"`.
`npm run sync:version` never touches it (guarded by `src/manifest-dev.spec.ts`).

### Daily use

- Edit code → save → **reopen the popover** in the room to see the change.
- If hot reload misses the tiny popover iframe, close and reopen the popover.
- `npm run dev` uses `strictPort`: if port 5173 is taken, Vite fails loudly
  instead of drifting to another port — kill the old Vite process and retry.

### Two-client testing (GM gating)

Open the room in a **second window or incognito tab** as a player to verify the
GM-only gating (restricted-access screens, no stat writes) while you test the GM
flows in the main window.

### Remote playtest via tunnel

To let someone outside your machine test the dev build:

```bash
cloudflared tunnel --url https://localhost:5173
```

Install `https://<tunnel-host>/Owlbear5eTools/manifest-dev.json` as a custom
extension in the room, playtest, then **kill the tunnel** when done.

### Troubleshooting

| Symptom | Fix |
|---|---|
| `Port 5173 is already in use` on `npm run dev` | Kill the old Vite process; `strictPort` intentionally fails instead of moving ports |
| Cert / blank iframe in OBR | Revisit the manifest-dev URL directly in a tab and re-accept the cert |
| Popover shows stale UI after save | Close and reopen the popover (HMR can miss the small iframe) |
| Can't tell dev vs store apart | Look for the `(DEV)` suffix in the action-bar entry and popover title |

## Running tests

```bash
npm test           # vitest run (one-shot)
```

Test files: `src/**/*.spec.ts` (`api`, `spawning`, `manifest-dev`, `utils/renderer`,
`utils/diceRoller`, `utils/scaleCreature*`).

## Linting

```bash
npm run lint       # ESLint 9 check
```

## Production build

```bash
npm run build      # tsc -b && vite build → ./dist/
```

The Vite base path is `/Owlbear5eTools/`, matching the GitHub Pages deployment path.

## Continuous deployment

Pushing to `main` (or `master`) triggers the GitHub Actions workflow
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml):

1. Checkout (`actions/checkout@v4`)
2. Node 20 setup (`actions/setup-node@v4`)
3. `npm ci`
4. `npm run build`
5. Upload `./dist` as a Pages artifact
6. Deploy to GitHub Pages

The live extension manifest is at:
```
https://ajuszt95.github.io/Owlbear5eTools/manifest.json
```

## Vite configuration

The only non-default Vite configuration is:

```ts
base: "/Owlbear5eTools/"
```

This ensures all asset paths resolve correctly on GitHub Pages.

## Related concepts

- [overview](overview.md) — installation URL
- [contributing](contributing.md) — how to add new features
