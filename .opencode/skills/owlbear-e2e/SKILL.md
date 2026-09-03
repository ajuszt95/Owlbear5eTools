---
name: owlbear-e2e
description: E2E smoke verification of Owlbear5eTools user-facing changes against a live Owlbear Rodeo room via the local HTTPS dev loop. Load after implementing any user-facing change, before claiming done.
metadata:
  author: ajuszt95
  version: "1.0"
---

# Owlbear E2E smoke

Verify user-facing changes in a real Owlbear Rodeo room against the local `(DEV)`
extension build. This skill describes **operation** only.

## When to load

After implementing any user-facing change, before claiming done. If the change
is not user-facing (pure refactor, docs, CI), skip this skill and say why.

## Setup (source of truth lives elsewhere)

Do not duplicate setup instructions here. The authoritative setup is
`docs/build-and-deploy.md`, section **"Local development (HTTPS dev loop)"**:
`npm run dev` on `https://localhost:5173/`, one-time cert trust, and the
one-time custom-extension install of
`https://localhost:5173/Owlbear5eTools/manifest-dev.json` (the `(DEV)` entry).
If setup and this skill disagree, the doc wins — update this skill to match.

## Preconditions (check first, STOP and ask the human if unmet)

1. **Dev server running**: `https://localhost:5173/Owlbear5eTools/manifest-dev.json`
   returns the dev manifest (valid JSON, `(DEV)` title) over HTTPS.
2. **Playwright MCP browser profile with a saved OBR session exists** (a
   persistent profile directory under a gitignored local path — see
   Secrets rules below).
3. **E2E room URL available to the agent** (provided by the human out-of-band
   on first setup, stored only in gitignored local paths).

If the saved session is missing or expired, **STOP**. Do **NOT** attempt to log
in to Owlbear Rodeo yourself. Ask the human for a one-time login capture: they
log in once in the profile browser, you reuse the saved session afterwards.

## The smoke run (max 3 flows)

Keep it to these flows; do not expand scope without asking. After **each**
step, check the browser console for errors and take a screenshot.

1. **Spawn** — open the `(DEV)` action-bar help popover, paste a 5e.tools
   monster URL into Quick Token Spawn, spawn. Expect: a correctly-sized token
   appears in the viewport centre with HP/AC bubbles.
2. **Import → View** — right-click a plain token, import a monster URL, then
   right-click the same token again to open the stat block viewer. Expect:
   full stat block renders, no console errors.
3. **One dice roll** — in the viewer, click one rollable value. Expect: the
   roll resolves (Dice+ broadcast or Basic-mode notification) with no errors.

## Verdict format

Report exactly this, nothing fancier:

- Flow 1 (spawn): PASS / FAIL + screenshot path + console errors (if any)
- Flow 2 (import → view): PASS / FAIL + screenshot path + console errors (if any)
- Flow 3 (dice roll): PASS / FAIL + screenshot path + console errors (if any)

On FAIL: fix the code, then re-run the smoke from the top. Never "verify" by
reading code alone.

## Secrets rules

- Browser profile directories and any session/cookie/storage files live under
  gitignored local paths only (e.g. `.owlbear-e2e/`). Never move them into the
  repo tree outside those paths.
- The room URL counts as a credential (invite links grant room access): never
  commit it to any file, never print it in logs or screenshots paths, and never
  paste it into issues or PRs. The human provides it out-of-band on first
  setup; store it only in a gitignored file (e.g. `.owlbear-e2e/room-url.txt`).
- Before finishing, sanity-check with `git status` (and `git check-ignore` on
  the paths you used) that no secret or session file is staged or tracked.
