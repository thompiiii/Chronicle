# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Chronicle is an AI-powered Dungeon Master for D&D 5e. Three top-level pieces:

- `chronicle-dnd/` — Vite + React 19 frontend (port 5000). Tailwind 4. Most UI lives in one large file, `src/App.jsx`.
- `server/` — Express 5 backend used for **local/Replit** development (port 3001). Proxies `/api/chat` to Anthropic via SSE.
- `api/chat.js` — Vercel serverless function. Functional superset of `server/index.js`. **This is what runs in production.**

The frontend always calls `/api/chat`. In dev, Vite proxies that to `http://localhost:3001` (`chronicle-dnd/vite.config.js`). On Vercel, the same path hits `api/chat.js`.

## Common commands

Run frontend and backend in separate terminals during local dev.

```bash
# Frontend (dev server with HMR, port 5000, proxies /api → localhost:3001)
cd chronicle-dnd && npm run dev

# Backend (Express, port 3001) — needs ANTHROPIC_API_KEY in server/.env
cd server && npm run dev      # nodemon
cd server && node index.js    # plain

# Lint (ESLint flat config) — frontend only
cd chronicle-dnd && npm run lint

# Production build
cd chronicle-dnd && npm run build
cd chronicle-dnd && npm run preview   # serves the built dist/
```

No test runner is configured in any workspace.

Each workspace (`chronicle-dnd/`, `server/`, repo root) has its own `package.json` and `node_modules`. There is no monorepo tooling — install deps in whichever workspace you're editing.

## Architecture — the one thing to internalize

**The AI narrates; the game engine decides.** Do not move dice rolls, success/failure, damage, or stat logic into prompts. Keep them in code under `chronicle-dnd/src/game/`.

Per-turn flow in free-play mode (`App.jsx` → `sendMessage`):

1. `processTurn(input, { character })` in `game/gameEngine.js` — detects intent (`attack`, `stealth`, `persuade`, `cast`, `flee`, `explore`), decides via `shouldRoll()` whether a d20 is needed, rolls it, applies the stat modifier, computes `outcome` (`critical`/`success`/`partial`/`failure`/`fumble`) against a per-intent DC, and rolls damage dice on a successful attack. Returns a fully-resolved `TurnResult`.
2. `applyTurnToState(turnResult)` — deterministic HP deltas (e.g. fumble-on-attack self-damage).
3. `getNarration(turnResult, { character, messages })` in `game/aiClient.js` — POSTs to `/api/chat` with `mode: "narration"`. It embeds the already-decided outcome in the user message and instructs Claude to narrate only.

The server recognizes two modes via the request body's `mode` field:

- `"dm"` (default) — classic DM system prompt, Claude may describe outcomes based on `[Rolled d20: **N**]` brackets in player text.
- `"narration"` — strict prompt: outcomes are pre-decided, Claude may not change them, rolls, or mechanics. **Only `api/chat.js` implements this branch.** `server/index.js` hard-codes the DM prompt and ignores `mode`. If you need narration mode locally, update `server/index.js` to mirror `api/chat.js` or run against Vercel.

Both endpoints stream SSE chunks (`data: {"text": "..."}\n\n`, terminated with `data: [DONE]\n\n`). Errors are also pushed as SSE `data: {"error": "..."}` so the client can render them inline.

### Two gameplay paths

- **Free-play** (default) — open chat in `App.jsx`. Uses the engine path above.
- **Structured campaign** — `components/CampaignScreen.jsx` + `game/campaignEngine.js`, driven by step graphs in `src/campaigns/` (see `goblinCave.js` for the schema: `choice` / `combat` / `exploration` / `loot` / `end` steps with `next` / `onVictory` / `onDefeat` / `choices[].next` refs). Combat steps run their own simpler d20 check (`roll >= step.enemy.difficulty`) rather than the free-play engine.

### Frontend state

`src/App.jsx` (~1400 lines) owns all React state: `screen` (`home`/`character`/`campaign`/`game`/`saves`), character, messages, inventory, gold, HP, spell slots, conditions, death saves, notes, session code. Sub-components defined in the same file: `DiceRoller`, `CombatTracker`, `SavedCampaignsScreen`. When extracting these, preserve the single-state-owner pattern — they currently receive callbacks from `App`.

Campaign saves auto-write to `localStorage` under key `chronicle_saves` after every DM response (`saveCampaign` in `App.jsx`). A save is keyed by `campaignId` (generated when character is created) and stores the full messages array plus all character sheet state.

Markdown rendering is a handwritten mini-parser (`renderMarkdown` in `App.jsx`) — bold/italic only. Don't reach for a markdown library.

## Environment

- `ANTHROPIC_API_KEY` — required. `server/index.js` reads it via `dotenv` from `server/.env`; on Vercel, set it as a project env var for `api/chat.js`.
- Model is hard-coded to `claude-sonnet-4-6` in both `server/index.js` and `api/chat.js`. Change both if bumping.
- Max tokens capped at 512 in both handlers.

## Deployment

- **Vercel** — `vercel.json` builds `chronicle-dnd/` to `dist/`, routes `/api/*` to the serverless function in `api/`, and SPA-rewrites everything else to `index.html`. The `server/` directory is not deployed.
- **Replit** — `.replit` runs `server/index.js` on 3001 and `vite preview` on 5000 in parallel. Autoscale target.

## Branch convention

Active work happens on `claude/add-claude-documentation-80ZeW` (see task brief). Don't push to other branches without explicit permission.
