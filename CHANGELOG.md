# Chronicle Changelog

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
