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

## Local development

```bash
npm install        # install dependencies
npm run dev        # Vite dev server (HMR enabled)
```

The dev server runs on `http://localhost:5173` by default. To test against Owlbear Rodeo, use the
OBR developer extension loader and point it at `http://localhost:5173/Owlbear5eTools/manifest.json`.

## Running tests

```bash
npm test           # vitest run (one-shot)
```

Test files: `src/api.spec.ts`, `src/spawning.spec.ts`, `src/utils/renderer.spec.ts`.

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
