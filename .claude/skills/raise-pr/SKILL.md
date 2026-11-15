---
name: raise-pr
description: Use when the user asks to raise, open, create or push a pull request for bill-pro-max-frontend. Runs every quality gate (lint, prettier, typecheck, tests, changed-files coverage, build), checks the cross-repo contract with the backend, then opens the PR with the standard description format.
---

# Raise a PR (BillProMax frontend)

Run every step in order. **Stop at the first failing gate**, fix it (or report it if out of scope), then restart from step 2. Never open a PR on a red gate, and never weaken a gate (lower thresholds, `eslint-disable`, `.skip`) without the user's explicit say-so.

## 1. Preconditions

```bash
git rev-parse --abbrev-ref HEAD        # must NOT be main
git status --porcelain                 # commit or discard everything first
git fetch origin
```
- Base: `main`, unless stacked on another open PR's branch — then that branch. Use it as `<base>` below.
- Commits follow Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `style:`, `docs:`), each ending with the session's attribution trailer.
- UI changes: the `frontend-design` skill's rules hold (no inline `style={}`, only `var(--…)` tokens).

## 2. Gates (same as CI)

```bash
npm run lint             # eslint, --max-warnings 0
npm run format:check     # prettier
npm run typecheck        # tsc -b
npm run test:coverage    # vitest + coverage; enforces the repo-wide floor
npm run coverage:changed -- --base origin/<base>   # each changed source file >= 80% lines
npm run build
```
- `format:check` fails → `npm run format`, commit as `style: format`.
- `coverage:changed` fails → use the **write-tests** skill for the listed files.
- Total coverage rose ≥ 1 point → raise `coverage.thresholds.lines` in `vitest.config.ts` in this PR.

## 3. Cross-repo contract check

```bash
git diff --name-only origin/<base>...HEAD
```
| Frontend change | Backend counterpart (`../bill-pro-max-backend-v2`, see root `CLAUDE.md`) |
|---|---|
| `src/types/index.ts` entity fields | `src/models/*` |
| `src/api/*Api.ts` URL, method, body, response | `src/routes/v1/*`, `src/types/api.ts` (Zod), controllers |
| WebSocket listeners in `src/hooks/*` | `src/websocket/*` emitters |
| Form validation (Zod in forms) | backend Zod schema constraints |

If the frontend depends on a backend change, find the backend PR (`gh pr list -R siddhanty47/bill-pro-max-backend-v2 --head <same-branch-name>`), link both ways, and state the merge/deploy order. No backend PR but one is needed → tell the user before opening.

## 4. Manual check for UI changes

Start the app (`npm run dev`) and exercise the changed screens, or state in the test plan exactly what was not checked in a browser. Never tick a box you didn't do.

## 5. Open the PR

```bash
git push -u origin HEAD
gh pr create --base <base> --title "<type>: <summary>" --body-file - <<'MD'
...body...
MD
```
Title: Conventional Commit style, ≤ 72 chars.

Body template — keep every heading; write "None" rather than deleting:

```markdown
## Summary
<1–3 sentences: what and why.>

## Changes
- <grouped by area: pages / components / api / hooks / store / styles>

## Behavior changes
<What a user will notice. Screenshots/GIF for visual changes. "None — refactor only" if so.>

## Contract impact
<Types / API calls / WebSocket events changed, and the linked backend PR. "None" if frontend-only.>

## Test plan
- [x] `npm run lint` · `format:check` · `typecheck` · `build`
- [x] `npm run test:coverage` — <N> tests, total lines <X>%
- [x] `coverage:changed` — all changed files ≥ 80%
- [x] <browser steps actually performed>
- [ ] <anything NOT verified>

## Merge notes
<Stacked on #N / merge order with backend / squash vs rebase. "None" if plain.>

<attribution line from the session, e.g. 🤖 Generated with [Claude Code](https://claude.com/claude-code)>
```

## 6. Report

PR URL, one line per gate result, and anything left unchecked.
