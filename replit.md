# Chronicle — AI Dungeon Master for D&D 5e

## Overview
Chronicle is a full-stack web application that serves as an AI-powered Dungeon Master for Dungeons & Dragons 5e. Players can create characters, roll dice, manage inventory, and engage in a streaming AI-driven chat adventure powered by Anthropic's Claude.

## Architecture

### Frontend (`chronicle-dnd/`)
- **Framework**: React 19 with JSX
- **Build Tool**: Vite 8
- **Styling**: Tailwind CSS 4
- **Dev Server**: runs on port 5000 (0.0.0.0 host)
- **API**: Uses relative path `/api/chat` proxied to the backend via Vite proxy

### Backend (`server/`)
- **Runtime**: Node.js
- **Framework**: Express 5
- **AI**: Anthropic Claude via `@anthropic-ai/sdk`
- **Port**: 3001 (localhost)
- **Endpoints**:
  - `POST /api/chat` — streams DM responses via SSE
  - `GET /health` — health check

## Environment Variables / Secrets
- `ANTHROPIC_API_KEY` — Required. Anthropic API key for Claude AI (DM responses)

## Workflows
- **Start application** — `cd chronicle-dnd && npm run dev` (port 5000, webview)
- **Backend API** — `cd server && node index.js` (port 3001, console)

## Key Files
- `chronicle-dnd/src/App.jsx` — Main React app (character creation, dice, chat, inventory)
- `chronicle-dnd/vite.config.js` — Vite config with proxy to backend
- `server/index.js` — Express backend with Claude streaming integration

## Deployment
- Target: autoscale
- Build: installs deps and builds Vite frontend
- Run: starts backend on 3001, serves Vite preview on port 5000
