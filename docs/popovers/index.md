---
type: Index
title: Popovers
description: Index for the three popover UI components that form the visible interface of the extension.
tags: [popovers, ui, react, owlbear-rodeo]
generated: { by: human:ajuszt95, at: 2026-08-15T09:45:00Z }
---

# Popovers

The extension UI is composed of three React components, each rendered into the same
`index.html` via hash routing.

| Concept | Hash route | Description |
|---------|-----------|-------------|
| [HelpPopover](help.md) | `#help` | Action-bar panel: quick token spawn form and usage guide |
| [ImportPopover](import.md) | `#/import?id=<tokenId>` | Attaches a stat block to an existing token |
| [ViewPopover](view.md) | `#/view?id=<tokenId>` | Full stat-block viewer with clickable dice and Remove button |
