# Unseen Hand — Dev Log

Running log of all significant changes. Updated after every session.
Referenced by Claude to understand current state, past decisions, and known issues.

---

## Current Architecture

### Stack
- **Frontend**: Vite + React 18 + Tailwind CSS v4
- **Backend**: Node/Express (`server/index.js`) + Vercel serverless (`api/chat.js`)
- **AI**: Anthropic API (`claude-sonnet-4-6`) via SSE streaming
- **Deployment**: Vercel (auto-deploys from `main` branch)

### Key Files
| File | Purpose |
|------|---------|
| `chronicle-dnd/src/App.jsx` | Free-play game: character creation, chat, dice, inventory tabs |
| `chronicle-dnd/src/game/gameEngine.js` | Free-play rules: intent detection, dice, outcomes, damage |
| `chronicle-dnd/src/game/aiClient.js` | AI narration client — dual-mode (free-play + campaign) |
| `chronicle-dnd/src/game/campaignEngine.js` | Campaign rules: step resolution, combat, loot, item use |
| `chronicle-dnd/src/components/CampaignScreen.jsx` | Campaign UI: all screens (combat, loot, choice, inventory) |
| `chronicle-dnd/src/campaigns/goblinCave.js` | Goblin Cave campaign data (steps, enemies, loot) |
| `api/chat.js` | Vercel serverless: Claude API SSE streaming |
| `server/index.js` | Local dev server: same Claude API proxy |

---

## Campaign System — Current State

### Step Types
| Type | Behaviour |
|------|-----------|
| `choice` | Shows choice buttons, no AI narration |
| `combat` | Full turn-based combat loop, AI narrates each round |
| `loot` | Applies loot to player, shows item cards, Continue → next step |
| `exploration` | Free-text input, AI narrates, advances to next step |
| `end` | Shows outcome, triggers game-over state |

### Combat Mechanics
- **Actions**: Attack (standard d20 vs DC), Heavy (−3 DC penalty, ×2 damage), Defend (skip attack, halve incoming)
- **Player dice**: d20 roll vs `step.enemy.difficulty`; crit on 20, fumble on 1
- **Damage**: `rollDamage(base)` = `base − 2 + rollDie(5) − 1`, min 1. Heavy = `base × 2`. Crit = ×2.
- **Fumble**: deals 1–2 self-damage
- **Enemy turns**: roll < 6 = miss, > 15 = heavy (1.5×), else normal hit
- **Defend halves** incoming after enemy roll
- **Battle recap**: shown when combat ends (before advancing to next step). Shows Dealt/Taken/Rounds, crit/fumble badges, full battle log, AI narration of killing blow

### Player State Shape
```js
player: {
  hp, maxHp,          // current and max HP
  attack,             // current damage stat (changes on weapon equip)
  baseAttack,         // original attack value — restored on unequip (default 5)
  defense,            // unused in combat currently
  inventory,          // [{ name, type, desc, effect }]
  gold,               // integer
  equippedWeapon,     // string (item name) or null
}
```

### Item System
- **Effect schema** on each item in `goblinCave.js`:
  - Consumable heal: `{ type: "heal", numDice, sides, bonus }` or `{ type: "heal", flat }`
  - Weapon equip: `{ type: "weapon", attack }` (sets player.attack)
  - Misc: `effect: null`
- **`useItem(gameState, itemName)`** in `campaignEngine.js` — pure function, returns new state
- Consumables can be used **mid-combat** (bonus action, no turn cost)
- Weapons can only be **equipped outside combat**

### Goblin Cave — Step Map
```
entrance (choice)
  ├── patrol-front (combat DC 11, 10hp) → patrol-loot (loot) → inner-cave
  ├── back-entrance (choice)
  │     ├── inner-cave
  │     └── sleeper (combat DC 8, 5hp) → inner-cave
  └── watch (choice) → patrol-front or back-entrance

inner-cave (choice)
  ├── chieftain (direct)
  ├── side-passage (loot: 15g + Healing Salve) → chieftain
  └── storeroom (loot: 20g + Health Potion + Treasure Map) → chieftain
      [requires Storeroom Key from patrol-loot]

chieftain (combat DC 14, 22hp) → loot-strongbox (loot) → victory (end)
                                → defeat (end)
```

### Loot Items with Effects
| Item | Type | Effect |
|------|------|--------|
| Shortsword | Weapon | attack → 6 |
| Storeroom Key | Misc | none |
| Health Potion | Consumable | heal 2d4+2 |
| Treasure Map | Misc | none |
| Healing Salve | Consumable | heal 4 flat |
| Grix's Scimitar | Weapon | attack → 7 |
| Letter of Credit | Misc | none |

---

## AI Client — Current State (`aiClient.js`)

- **Free-play mode**: `getNarration(turnResult, gameState, callbacks)` — sends full `TurnResult` to Claude for narration
- **Campaign mode**: `getNarration({ step, playerInput, gameState, roll, success, isCrit }, callbacks)` — sends structured prompt with game facts + rules
- Combat narration: 1–2 sentences max, no mechanics/dice mentioned
- Both modes use shared `streamNarration()` SSE helper → `/api/chat`
- Error handling: maps "Failed to fetch" / "Load failed" to human-readable message

---

## UI — CampaignScreen Components
| Component | Description |
|-----------|-------------|
| `HpBar` | Animated % bar, green→amber→red by threshold |
| `EnemyPanel` | Enemy name + HP bar |
| `DiceDisplay` | Two large d20 results (player left, enemy right), color-coded |
| `CombatLog` | Last 5 combat lines; latest bright, older faded |
| `PlayerPanel` | HP bar + equipped weapon attack value |
| `ActionBar` | ⚔️ Attack / 💥 Heavy / 🛡️ Defend with subtext |
| `NarrationBox` | Serif prose, line-clamped, bottom of combat screen |
| `InventoryItemRow` | Item card: name, type badge, Use/Equip/hint button |
| `InventoryPanel` | Collapsible drawer: gold, equipped weapon, items by category |
| `BattleRecap` | Post-combat summary: stats, log, narration, Continue/Retry/Back |

---

## Change History

### 2026-04-14 — Rename App to "Unseen Hand"
- `index.html`: page title updated to "Unseen Hand — AI Dungeon Master"
- `App.jsx`: home screen `<h1>` and game header wordmark changed from CHRONICLE → UNSEEN HAND
- Engine file comments updated (gameEngine, campaignEngine, encounterEngine, aiClient)
- CSS class names (`.chronicle-app`, `--c-*`) unchanged — internal only

### 2026-04-13 — Full UI Retheme (Chronicle CSS Layer)
- `chronicle-dnd/src/index.css`: Complete replacement — removed Vite template defaults, added `@import "tailwindcss"` + Google Fonts (Cinzel + Crimson Pro), added `:root` CSS variables (`--c-bg`, `--c-surface`, `--c-accent`, etc.), added `.chronicle-app` grain overlay, and defined full Chronicle CSS class set
- `chronicle-dnd/src/App.jsx`: All screens, panels, and interactive components updated from Tailwind zinc/black utility classes to Chronicle CSS variables and semantic classes. Changes by section:
  - **Home screen**: `.c-home`, `.c-title`, `.c-subtitle`, `.c-home-form`, `.c-btn-primary`, `.c-btn-ghost`, `.c-field-input`, `.c-divider`, `.c-join-row`
  - **Character creation** (steps 0–4): `.c-character`, `.c-step-header`, `.c-step-prompt`, `.c-list-item`, `.c-card`, `.c-stat-grid`, `.c-stat-box`, `.c-bg-grid`, `.c-bg-card`
  - **Game header**: `.c-game`, `.c-game-header`, `.c-back-btn`, `.c-game-wordmark`, `.c-icon-btn`, `.c-hp-badge`
  - **Chat area**: `.c-chat`, `.c-msg-dm` / `.c-msg-dm-label` / `.c-msg-dm-text`, `.c-msg-player` / `.c-msg-player-bubble`
  - **Tab panels** (Dice/Sheet/Inventory/Notes): `.c-panel` with Chronicle inline style overrides; Dice → `.c-dice-controls`, `.c-die-btn`; Sheet → `.c-stat-box`, `.c-panel-title`; Inventory → inline CSS vars; Notes → `.c-textarea`
  - **Input bar**: `.c-input-area`, `.c-textarea`, `.c-d20-btn`, `.c-action-row`, `.c-action-btn`, `.c-quick-actions`, `.c-quick-btn`
  - **EncounterOverlay**: `.c-encounter-panel`, `.c-encounter-btn` + variants (attack/heavy/defend/flee/death) with colour variants in CSS
  - **EncounterRecap**: `.c-encounter-panel`, `.c-loot-gold-card`, `.c-loot-item-card`, `.c-continue-btn`
  - **LiveCombatView** + **CombatTracker**: `.c-panel` wrapper, inline CSS variable styles
  - **SavedCampaignsScreen**: `.chronicle-app` wrapper, `.c-back-btn`, inline Chronicle styles
- CSS additions in `index.css`: `.c-encounter-btn-*` colour variants, `.c-hp-track` / `.c-hp-fill` HP bar classes; `.c-panel` updated to use `border-top` instead of `border-bottom`
- Typography: Cinzel display font used for labels, tabs, buttons; Crimson Pro for all prose/narration
- Palette: `--c-bg #0c0c0e`, `--c-accent #c8a96e` (gold), `--c-red #9b3030` — throughout

### 2026-04-13 — Death Saving Throws (Free-Play Encounters)
- `encounterEngine.js`: added `dying: false` and `deathSaves: { successes: 0, failures: 0 }` to encounter state shape (`startEncounter`)
- `resolveEncounterRound`: when `encounter.dying` or `actionHint === "deathsave"`, enters death save path instead of normal combat:
  - Rolls d20 internally; 10+ = success, 9 or less = failure
  - 3 successes → `dying: false`, `playerHpDelta: 1` (stabilizes at 1 HP), resets save counters, combat continues (player can flee)
  - 3 failures → `combatOver: true`, `outcome: "defeat"`
  - Otherwise → updates `deathSaves`, returns `combatOver: false`
- Normal path: when player HP hits 0 and enemy is alive, sets `dying: true` instead of ending combat immediately; adds "You fall unconscious!" log line
- `App.jsx`: death save short-circuit in `sendMessage` — skips `processTurn` and goes straight to `resolveEncounterRound` with `"deathsave"` hint; no player chat message added for saves
- `EncounterOverlay`: when `dying`, shows pulsing red player panel, death save tracker (3 success / 3 failure dots filled progressively), single "🎲 Roll Death Save" button replacing normal action buttons; dice display shows SUCCESS/FAILURE label for save rolls

### 2026-04-13 — Fix: HP Now Resets Between Free-Play Encounters
- `App.jsx`: on encounter `victory` or `fled` outcome, `setCurrentHp(character.hp)` restores HP to max before setting `pendingRecap`
- This prevents free-play `currentHp` from bleeding into subsequent encounters (HP now works per-encounter, not per-session)
- Defeat leaves HP at 0 as before (player was downed)

### 2026-04-13 — Remove Fight Tab + Tier-Appropriate Loot Tables
- `TAB_BUTTONS` in `App.jsx`: removed `{ id: "combat", label: "⚔️ Fight" }` — manual initiative tracker was redundant now that `EncounterOverlay` handles all combat UI
- `encounterEngine.js`: added `LOOT_TABLES` (4 tiers) and exported `rollLoot(tier)`:
  - Tier 1 Trivial: 0–3 gp; Torch 30%, Rations 25%, Minor Healing Vial 20%, Tinderbox 10%
  - Tier 2 Standard: 2–12 gp; Health Potion 55%, Antitoxin 30%, Dagger 25%, Thieves' Tools 20%, Oil Flask 15%
  - Tier 3 Elite: 14–50 gp; Health Potion 90%, Greater Health Potion 50%, Shortsword 40%, Studded Leather 30%, Healer's Kit 25%, Rope 20%
  - Tier 4 Boss: 65–200 gp; Greater Health Potion 100%, Superior Health Potion 70%, Longsword 65%, Chain Mail 50%, Shield 45%, Potion of Heroism 35%, Arcane Focus 25%
- `App.jsx` victory path: calls `rollLoot(tier)`, adds gold and items to free-play inventory, includes `loot` in `pendingRecap`
- `EncounterRecap` component: new Loot section below narration — gold card (yellow-themed) + item cards (icon, name, desc) for each dropped item

### 2026-04-13 — Fight Tab: Live Combat Dashboard
- `encounterEngine.js`: `startEncounter` now accepts `playerStats`; rolls initiative for player (d20 + DEX mod) and enemy (d20 + tier bonus 0–3); stores `initiative: { player, enemy, playerFirst }` in encounter state
- `App.jsx`: extracted `LiveCombatView` component — shown in Fight tab when encounter is active; shows round counter, initiative-order badge (green "You go first" / red "Enemy goes first"), HP bars for both combatants sorted by initiative, real-time dealt/taken/crit/fumble stats, scrollable full battle log
- Manual initiative tracker still shown in Fight tab when no encounter is active
- `CombatTracker` now takes `encounterState` prop and delegates to `LiveCombatView` or manual tracker accordingly

### 2026-04-13 — Free-Play Encounter System
- New file `encounterEngine.js`: tiered enemy table (Trivial/Standard/Elite/Boss), `lookupEnemy(text)` keyword match, `startEncounter(enemy)`, `resolveEncounterRound(encounter, turnResult, playerHp, actionHint)`
- Auto-detect: attack intent in free-play triggers combat. Lookup table checked first; AI generation fallback (`generateEnemyAI`) for unknown enemies
- Full round resolution: player turn (attack/heavy/defend/flee), enemy counterattack, damage, HP tracking
- `gameEngine.js`: added `defend` to `INTENT_PATTERNS`
- `aiClient.js`: `buildTurnMessage` now accepts `encounter` context; narration prompt includes enemy HP, round number, this-round log lines, contextual direction (kill blow vs ongoing fight)
- `App.jsx`: `encounterState` + `pendingRecap` state; `EncounterOverlay` component (enemy+player HP bars, dice display, last 3 combat log lines, Attack/Heavy/Defend/Flee buttons); `EncounterRecap` component (outcome banner, dealt/taken/rounds stats, Continue button); combat overlay sits above input bar, disappears when dismissed

### 2026-04-12 — Restore D&D Item Autocomplete (Free-Play)
- Restored `itemSuggestions` + `selectedDbItem` state in `App.jsx`
- "Search or add item…" input shows up to 6 matching items from `ITEM_DB` after 2+ chars typed
- Suggestions show type (color-coded), name, desc, weight
- Selecting a suggestion fills name/type/desc/weight and shows a preview bar
- Escape dismisses dropdown; Enter or Add confirms
- Custom items (not in DB) still supported via type selector

### 2026-04-12 — Equip/Unequip Weapons (Free-Play + Campaign)
- `gameEngine.js`: added `parseWeaponDice(desc)` to parse "1d8 slashing" → `{ numDice, sides }`; `rollDamage` now accepts optional `weaponDice` override; `processTurn` reads `equippedWeapon` from gameState
- `App.jsx`: added `equippedWeaponId` state; Equip/Unequip toggle in Bag tab; equipped weapon's dice used in free-play combat rolls
- `campaignEngine.js`: added `baseAttack: 5` to player init; exported `unequipWeapon()` (reverts attack to baseAttack, clears equippedWeapon)
- `CampaignScreen.jsx`: `handleUnequip` handler; `InventoryItemRow` shows Equip/Unequip/out-of-combat hint based on context; `InventoryPanel` wired with `onUnequip` prop

### 2026-04-12 — Inventory & Item Usage System
- Added `effect` field to all items in `goblinCave.js`
- Added `useItem(gameState, itemName)` to `campaignEngine.js`
- Added `equippedWeapon: null` to player state init
- Redesigned loot screen with item cards (icon, name, type badge, desc)
- Added `InventoryPanel` (collapsible) on all screens
- Consumables usable mid-combat as bonus action (no turn cost)
- Weapons equippable only outside combat; changes `player.attack`
- `PlayerPanel` shows equipped weapon attack stat

### 2026-04-12 — Battle Recap Screen
- Added `pendingTransition` state to campaign: set when combat ends instead of immediately advancing
- Accumulated `battleStats` (dealt/taken/rounds/crits/fumbles) and `battleLog` (all turn lines) across rounds
- `BattleRecap` component: Victory/Defeated banner, 3-stat row, crit/fumble badges, scrollable log, AI narration, Continue/Retry/Back
- Defeat recap shows Retry + Back to Menu directly (no extra Continue step)

### 2026-04-12 — Combat UI Redesign
- Replaced flat combat layout with structured component stack
- `EnemyPanel` + `DiceDisplay` (giant numbers) + `CombatLog` + `PlayerPanel` + `ActionBar` + `NarrationBox`
- Roll badges: yellow=crit, red=fumble, orange=heavy, green=hit, grey=miss/defend

### 2026-04-12 — Defend Rework
- Defend no longer rolls to attack or deal damage
- Defend = skip player attack, brace: enemy still attacks, damage halved
- Roll badge shows blue "Defensive stance" pill

### 2026-04-12 — Loot Step UI Fix
- Loot steps had no interaction — player was stuck after combat victory
- Added gold + item chip display and Continue → button on loot screens

### 2026-04-12 — Three-Button Combat + Combat Upgrade
- Replaced single ATTACK button with ⚔️ Attack / 💥 Heavy / 🛡️ Defend grid
- Engine: `detectCombatAction`, `rollDamage` variance, `resolveEnemyTurn` (miss/normal/heavy)
- `isCrit` / `isFumble` flags; defend halves incoming; fumble self-damage
- `combatLog` array per turn; AI narration capped at 1–2 sentences in combat
- Fixed syntax bug in `goblinCave.js` (missing `{` on `back-entrance` step)

### 2026-04-12 — Full Turn-Based Combat
- Enemies now take full turns with their own dice rolls
- Enemy turn: roll < 6 miss, > 15 heavy (1.5×), else normal hit
- Roll badges displayed for both player and enemy after each round

### 2026-04-12 — Campaign System (Goblin Cave)
- Built `campaignEngine.js`: `createCampaignState`, `goToStep`, `resolveStep`, `chooseOption`
- Built `goblinCave.js`: 6-scene branching campaign with 2 combat + 3 loot encounters
- Built `CampaignScreen.jsx`: choice/combat/loot/end step rendering
- Wired "⚔️ Goblin Cave" button in `App.jsx`
- Fixed narrative bleed (3-layer bug): `goToStep` clears narration, `handleChoice` uses `goToStep`, combat return guards `combatOver ? null : narration`
- Fixed duplicate error messages in AI client

### 2026-04-11 — Free-Play Game Engine (v1.1.0)
- `gameEngine.js`: intent detection, d20 rolls, modifiers, outcome (critical/success/partial/failure/fumble)
- `shouldRoll()` gate — only contested actions roll dice
- Roll pill in chat (color-coded by outcome)
- Fumble = 1 self-damage; crits double damage
- Per-class damage dice (d12 Barbarian → d4 Wizard)

### 2026-04-11 — Initial Release (v1.0.0)
- AI DM chat with SSE streaming, character creation, save/load via localStorage
- Tabs: Dice / Sheet / Bag / Fight / Notes

---

## Known Issues / Watch Points
- `defense` stat on player is tracked but not used in any combat calculation yet
- `exploration` step type exists in engine but no campaign steps use it currently
- Storeroom Key is a Misc item with no mechanical gate — the `inner-cave` choice for "Try the iron key" is always available regardless of whether the player has the key
- `lastHeal` is not surfaced in the UI (no "+5 HP" feedback when using a potion)
- `showInventory` state in `CampaignScreen` persists across step navigation (panel stays open)
