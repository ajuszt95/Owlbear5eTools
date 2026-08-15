---
type: Index
title: Owlbear5eTools — Knowledge Bundle
description: OKF knowledge bundle for the Owlbear5eTools Owlbear Rodeo 2.0 extension.
tags: [owlbear-rodeo, dnd5e, 5etools, vtt, extension]
generated: { by: human:ajuszt95, at: 2026-08-15T09:45:00Z }
---

# Owlbear5eTools — Knowledge Bundle

This directory contains the Open Knowledge Format (OKF v0.2) documentation for the
**Owlbear5eTools** Owlbear Rodeo 2.0 extension.

## Concepts

| Concept | Type | Description |
|---------|------|-------------|
| [overview](overview.md) | Project Overview | What the extension is, who it is for, and how to install it. |
| [architecture](architecture.md) | Architecture | Single-page app routing, component responsibilities, and data-flow. |
| [api](api.md) | Module | Monster data fetching, URL parsing, sizing, and stat extraction. |
| [spawning](spawning.md) | Module | Token spawning logic and DPI calibration. |
| [renderer](renderer/index.md) | Module | 5e.tools markup tokenizer and plain-text stripper. |
| [popovers](popovers/index.md) | Module Group | HelpPopover, ImportPopover, and ViewPopover components. |
| [background](background.md) | Module | Background worker, extension constants, and context-menu registration. |
| [metadata-keys](metadata-keys.md) | Reference | All OBR metadata key names used by this extension. |
| [build-and-deploy](build-and-deploy.md) | Playbook | How to build, run locally, and deploy to GitHub Pages. |
| [contributing](contributing.md) | Playbook | Checklist and patterns for extending the project. |

## External dependencies

| Dependency | Role |
|-----------|------|
| [@owlbear-rodeo/sdk](https://www.npmjs.com/package/@owlbear-rodeo/sdk) | VTT platform SDK (OBR API) |
| [5etools-mirror-3](https://github.com/5etools-mirror-3/5etools-src) | Bestiary JSON source |
| [5etools-img](https://github.com/5etools-mirror-3/5etools-img) | Monster token images |
| [Stat Bubbles for D&D](https://extensions.owlbear.rodeo/) | HP/AC overlay extension, integrated via shared metadata keys |
| [Dice+](https://extensions.owlbear.rodeo/) | Optional dice-rolling extension, integrated via broadcast channels |
