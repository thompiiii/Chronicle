// ── Goblin Cave ────────────────────────────────────────────────────────────
// A short introductory campaign (6 scenes, 2 combat encounters).
//
// Step schema:
//   id        — unique string key, used for next/onVictory/onDefeat refs
//   type      — "scene" | "combat" | "loot" | "end"
//   title     — short heading shown in UI
//   text      — narrative prose displayed to player
//   choices   — (scene only) array of { label, next }
//   enemy     — (combat only) { name, hp, attack, xp }
//   onVictory — (combat only) step id if player wins
//   onDefeat  — (combat only) step id if player dies
//   loot      — (loot only) { gold?, items?: [{ name, type, desc }] }
//   next      — (loot / end) step id to advance to after this step
// ──────────────────────────────────────────────────────────────────────────

export const goblinCaveCampaign = {
  id:   "goblin-cave",
  name: "The Goblin Cave",
  desc: "A merchant's missing cart was traced to a cave in the Thornwood. Clear it out and claim the reward.",

  // Starting player overrides (merged on top of default initialGameState.player)
  playerOverrides: {
    hp:     20,
    attack: 5,
    gold:   5,
  },

  steps: {

    // ── 1. Entrance ────────────────────────────────────────────────────────
    entrance: {
      id:    "entrance",
      type:  "choice",
      title: "Cave Entrance",
      text:  "The cave mouth yawns between two mossy boulders, reeking of smoke and rotting meat. Crude torch-holders — sharpened sticks jammed into the earth — line the first ten feet. Somewhere inside, low voices bicker in Goblin.\n\nA narrow game trail circles around to the rear of the hill.",
      choices: [
        { text: "Walk straight in through the front",  next: "patrol-front" },
        { text: "Circle around to find a back entrance", next: "back-entrance" },
        { text: "Wait and watch from the treeline",     next: "watch" },
      ],
    },

    // ── 2a. Front approach → ambush ────────────────────────────────────────
    "patrol-front": {
      id:    "patrol-front",
      type:  "combat",
      title: "Goblin Patrol",
      text:  "Two goblins spring from behind the torch-sticks, screeching. They weren't expecting someone bold enough to walk in the front.",
      enemy: { name: "Goblin Patrol (×2)", hp: 10, attack: 3, xp: 50, difficulty: 11 },
      onVictory: "patrol-loot",
      onDefeat:  "defeat",
    },

    // ── 2a loot — after patrol ─────────────────────────────────────────────
    "patrol-loot": {
      id:    "patrol-loot",
      type:  "loot",
      title: "Search the Bodies",
      text:  "You crouch over the fallen goblins. Between them you find a small coin purse, a dented shortsword, and — tucked inside one goblin's boot — a tarnished iron key with a tag that reads 'STOREROOM' scratched in crude letters.",
      loot: {
        gold:  8,
        items: [
          { name: "Shortsword",    type: "Weapon",     desc: "1d6 piercing · looted from the patrol" },
          { name: "Storeroom Key", type: "Misc",       desc: "A tarnished iron key — opens something deeper in the cave" },
        ],
      },
      next: "inner-cave",
    },

    // ── 2b. Back entrance → easier path ───────────────────────────────────
      id:    "back-entrance",
      type:  "choice",
      title: "The Crack in the Rock",
      text:  "A narrow split in the hillside leads into a storage alcove — crates of stolen goods, and one sleeping goblin slumped against the wall, snoring.\n\nBeyond the alcove, the cave opens up.",
      choices: [
        { text: "Slip past the sleeping goblin", next: "inner-cave" },
        { text: "Deal with it first",            next: "sleeper" },
      ],
    },

    sleeper: {
      id:    "sleeper",
      type:  "combat",
      title: "Sleeping Goblin",
      text:  "You move to dispatch the goblin — but it snorts awake at the last moment.",
      enemy: { name: "Groggy Goblin", hp: 5, attack: 2, xp: 25, difficulty: 8 },
      onVictory: "inner-cave",
      onDefeat:  "defeat",
    },

    // ── 2c. Watch → spot weakness ─────────────────────────────────────────
    watch: {
      id:    "watch",
      type:  "choice",
      title: "Patience",
      text:  "After ten minutes you count three goblins total — two near the entrance rotating shifts, one deeper inside. You also notice the patrol timing: there is a two-minute gap when only one is at the door.\n\nYou could exploit that window.",
      choices: [
        { text: "Wait for the gap and move in",     next: "patrol-front" },
        { text: "Circle to the back while distracted", next: "back-entrance" },
      ],
    },

    // ── 3. Inner cave ──────────────────────────────────────────────────────
    "inner-cave": {
      id:    "inner-cave",
      type:  "choice",
      title: "The Inner Cave",
      text:  "The cave widens into a rough chamber. A fire pit crackles in the centre — a stolen wagon wheel feeds the flames. Stolen goods are piled against the walls: sacks of grain, bolts of cloth, a locked iron strongbox.\n\nAt the far end, a goblin bigger than the rest sits on a throne of crates, gnawing a bone. A tarnished crown sits crooked on its head.\n\n\"WHO YOU?\" it roars.",
      choices: [
        { text: "\"I'm here for the strongbox. Stand aside.\"", next: "chieftain" },
        { text: "Attack without talking",                       next: "chieftain" },
        { text: "Search for another way around",                next: "side-passage" },
        { text: "Try the iron key on the storeroom door",       next: "storeroom" },
      ],
    },

    storeroom: {
      id:    "storeroom",
      type:  "loot",
      title: "The Storeroom",
      text:  "The key turns with a satisfying click. Inside: crates of stolen merchant goods and a wooden chest. The chest holds a health potion, a small sack of gold, and a rolled-up map with a red X marked near the cave's lower level.",
      loot: {
        gold:  20,
        items: [
          { name: "Health Potion",   type: "Consumable", desc: "Restores 2d4+2 HP" },
          { name: "Treasure Map",    type: "Misc",       desc: "Marks a location in the cave's lower level" },
        ],
      },
      next: "chieftain",
    },

    "side-passage": {
      id:    "side-passage",
      type:  "loot",
      title: "Side Passage",
      text:  "A narrow passage behind a stack of crates leads to a small alcove — clearly the chieftain's personal stash. A leather pouch clinks as you lift it.",
      loot: {
        gold:  15,
        items: [
          { name: "Healing Salve", type: "Consumable", desc: "Restore 4 HP when used" },
        ],
      },
      next: "chieftain",
    },

    // ── 4. Boss fight ──────────────────────────────────────────────────────
    chieftain: {
      id:    "chieftain",
      type:  "combat",
      title: "Grix, Goblin Chieftain",
      text:  "Grix hurls the bone aside and draws a jagged scimitar. The remaining goblins scatter into the shadows — this is between you and him.",
      enemy: { name: "Grix the Chieftain", hp: 22, attack: 5, xp: 150, difficulty: 14 },
      onVictory: "loot-strongbox",
      onDefeat:  "defeat",
    },

    // ── 5. Loot ────────────────────────────────────────────────────────────
    "loot-strongbox": {
      id:    "loot-strongbox",
      type:  "loot",
      title: "The Strongbox",
      text:  "Grix's crown rolls across the stone floor. You find a bent key on his belt — it opens the iron strongbox. Inside: the merchant's coin purse, a folded letter of credit, and something that glints.",
      loot: {
        gold:  40,
        items: [
          { name: "Grix's Scimitar",    type: "Weapon",     desc: "1d6 slashing · looted from the chieftain" },
          { name: "Letter of Credit",   type: "Misc",       desc: "Worth 20 gp at any trading post" },
          { name: "Health Potion",      type: "Consumable", desc: "Restores 2d4+2 HP" },
        ],
      },
      next: "victory",
    },

    // ── 6. End states ──────────────────────────────────────────────────────
    victory: {
      id:    "victory",
      type:  "end",
      title: "Cave Cleared",
      text:  "You step out of the cave into clean air. Behind you the fire pit gutters and dies. The merchant will pay handsomely for news that the Thornwood road is safe again.\n\nThe Goblin Cave has been cleared.",
      outcome: "victory",
    },

    defeat: {
      id:    "defeat",
      type:  "end",
      title: "Defeated",
      text:  "You have been defeated.",
      outcome: "defeat",
    },

  }, // end steps

  // The step the campaign starts on
  startStep: "entrance",
};
