# Chronicle — Claude Context

## What This Project Is
Chronicle is a browser-based AI Dungeon Master RPG. Two modes:
1. **Free-play** — open-ended chat with an AI DM, character creation, dice, inventory tabs
2. **Campaign** — structured branching campaigns (currently: Goblin Cave) with turn-based combat, loot, and item usage

## Stack
- Vite + React 18 + Tailwind CSS v4
- Anthropic API (`claude-sonnet-4-6`) via SSE streaming
- Deployed on **Vercel** — pushes to `main` auto-deploy
- Local dev server: `server/index.js` | Vercel serverless: `api/chat.js`

## Always Read First
Before starting any task, read the dev log:
```
/home/user/Chronicle/DEVLOG.md
```
It contains: full architecture, current state of all systems, component list, campaign step map, item effects table, change history, and known issues.

## Key Directories
```
chronicle-dnd/src/
  App.jsx                     — free-play game (character creation, chat, tabs)
  game/
    gameEngine.js             — free-play rules (dice, outcomes, damage)
    aiClient.js               — AI narration client (dual-mode)
    campaignEngine.js         — campaign rules (combat, loot, useItem)
  components/
    CampaignScreen.jsx        — all campaign UI
  campaigns/
    goblinCave.js             — Goblin Cave campaign data
api/
  chat.js                     — Vercel serverless Claude proxy
server/
  index.js                    — local dev Claude proxy
DEVLOG.md                     — full running dev log (keep this updated)
CHANGELOG.md                  — user-facing changelog
```

## Development Rules
- All pushes go to `main` (triggers Vercel deploy)
- State is always immutable — spread operator pattern throughout, never mutate
- AI is narration-only — it cannot change success/failure, roll dice, or modify stats
- `resolveStep` is the single entry point for all campaign step logic
- `goToStep` handles all step transitions (clears narration, lastRoll, pendingTransition, resets battleStats on combat entry, applies loot)
- `useItem` is a pure function — no async, no side effects beyond returning new state

## After Every Change
Update `DEVLOG.md` — change history section + any state/architecture changes.
