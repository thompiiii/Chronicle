# Chronicle Changelog

---

## v1.1.0 — Game Engine & QOL
*April 2026*

### Game Engine Architecture
- Introduced `gameEngine.js` — all rules logic (dice, outcomes, stat modifiers) now lives in code, not in the AI
- AI is restricted to narration only; it cannot change success/failure or roll dice
- `processTurn()` resolves intent detection, d20 rolls, modifiers, and outcome (`critical` / `success` / `partial` / `failure` / `fumble`) before the AI is ever called
- `shouldRoll()` gate — only contested actions trigger a dice roll (attacks, stealth, social checks, spells, skill checks like Search); exploration and movement narrate freely without rolling
- Roll results shown as a color-coded pill in chat (yellow = crit, green = success, amber = partial, zinc = failure, red = fumble)
- Fumble on attack deals 1 point of self-inflicted damage
- Damage dice on hit — each class rolls its own die (d12 Barbarian → d4 Wizard); crits roll twice

### QOL Improvements
- **HP pill in header** — `❤️ current/max` always visible during play, no more tab-switching to check HP
- **Character portrait** — class emoji shown in game header next to HP
- **Background selection** — 5th character creation step (Acolyte, Criminal, Folk Hero, Noble, Sage, Soldier); background is passed to the DM for richer narrative flavor
- **Inventory preview** — starting equipment shown on the stats step before confirming character
- **Immersive loading indicator** — cycles through D&D-flavored messages ("Rolling behind the screen…", "Consulting the ancient tomes…") while waiting for DM response

---

## v1.0.0 — Initial Release
*April 2026*

### Core
- AI Dungeon Master powered by Anthropic API (claude-sonnet-4-6) with SSE streaming
- Character creation — name, race, class, ability scores (manual or random roll)
- Campaign save/load system via localStorage with auto-save after every DM response
- Saved campaigns screen with character preview, DM quote, delete confirmation

### Game Screen
- Chat interface with streaming DM responses and typing indicator
- Markdown rendering for DM messages (bold, italic)
- Voice narration (TTS) with on/off toggle
- Quick action buttons ("I search the room", "I attack!", etc.)
- Auto-send message after rolling dice

### Tabs (above input bar)
- **🎲 Dice** — d4 through d100, adjustable count and modifier, crit/fumble detection, sends roll to chat
- **📜 Sheet** — HP bar (current/max) with damage/heal buttons, AC auto-calculated from inventory, level tracker (1–20), ability scores, spell slots (all caster classes with correct per-level tables), conditions (all 15 D&D 5e conditions), death saves (with d20 roll mechanic)
- **🎒 Bag** — inventory with qty controls, add item form, gold with +/− buttons
- **⚔️ Fight** — initiative tracker with turn order, round counter, auto-roll for enemies
- **📝 Notes** — free-text notepad for quest notes, NPC names, clues
