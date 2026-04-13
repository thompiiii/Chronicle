// ── Chronicle Encounter Engine ─────────────────────────────────────────────
// Free-play combat encounters: enemy lookup, round resolution.
//
// Encounter state shape:
// {
//   enemy:         { name, hp, maxHp, attack, difficulty, tier, tierLabel }
//   battleStats:   { dealt, taken, rounds, crits, fumbles }
//   battleLog:     string[]   — all lines across all rounds
//   lastCombatLog: string[]   — just the latest round (for the overlay)
//   lastRoll:      { playerRoll, playerHit, isCrit, isFumble, action,
//                    enemyRoll, enemyResult }
// }
// ─────────────────────────────────────────────────────────────────────────────

import { rollDie } from "./gameEngine";

// ── Enemy Table ───────────────────────────────────────────────────────────────

const ENEMY_TABLE = [
  {
    tier: 1, tierLabel: "Trivial",
    hp: 6, attack: 2, difficulty: 8,
    keywords: ["rat", "bat", "spider", "kobold", "skeleton", "zombie", "cultist", "thug", "peasant", "imp"],
  },
  {
    tier: 2, tierLabel: "Standard",
    hp: 14, attack: 3, difficulty: 11,
    keywords: ["goblin", "wolf", "guard", "gnoll", "bugbear", "hobgoblin", "ghoul", "specter", "bandit", "brigand"],
  },
  {
    tier: 3, tierLabel: "Elite",
    hp: 28, attack: 5, difficulty: 14,
    keywords: ["orc", "troll", "ogre", "wight", "berserker", "veteran", "knight", "assassin", "werewolf", "manticore", "gargoyle"],
  },
  {
    tier: 4, tierLabel: "Boss",
    hp: 52, attack: 8, difficulty: 17,
    keywords: ["dragon", "vampire", "lich", "demon", "devil", "beholder", "giant", "wyvern", "wraith", "chimera", "hydra", "aboleth"],
  },
];

// Returns the first matching enemy entry (checks boss tier first so boss
// keywords win over overlapping standard ones).
export function lookupEnemy(text) {
  const lower = text.toLowerCase();
  for (const row of [...ENEMY_TABLE].reverse()) {
    for (const kw of row.keywords) {
      if (lower.includes(kw)) {
        return {
          name:       kw.charAt(0).toUpperCase() + kw.slice(1),
          hp:         row.hp,
          maxHp:      row.hp,
          attack:     row.attack,
          difficulty: row.difficulty,
          tier:       row.tier,
          tierLabel:  row.tierLabel,
        };
      }
    }
  }
  return null;
}

// ── State factory ─────────────────────────────────────────────────────────────
// playerStats: character.stats object ({ STR, DEX, ... }) — used for initiative mod

export function startEncounter(enemy, playerStats) {
  const dexMod          = Math.floor(((playerStats?.DEX ?? 10) - 10) / 2);
  const tierInitBonus   = { 1: 0, 2: 1, 3: 2, 4: 3 }[enemy.tier] ?? 0;
  const playerInit      = rollDie(20) + dexMod;
  const enemyInit       = rollDie(20) + tierInitBonus;

  return {
    enemy:         { ...enemy, maxHp: enemy.maxHp ?? enemy.hp, initiative: enemyInit },
    initiative:    { player: playerInit, enemy: enemyInit, playerFirst: playerInit >= enemyInit },
    battleStats:   { dealt: 0, taken: 0, rounds: 0, crits: 0, fumbles: 0 },
    battleLog:     [],
    lastCombatLog: [],
    lastRoll:      null,
    dying:         false,
    deathSaves:    { successes: 0, failures: 0 },
  };
}

// ── Enemy turn resolution ─────────────────────────────────────────────────────

function resolveEnemyTurn(enemy) {
  const roll = rollDie(20);
  if (roll < 6)  return { roll, damage: 0,                           result: "miss"  };
  if (roll > 15) return { roll, damage: Math.ceil(enemy.attack * 1.5), result: "heavy" };
                 return { roll, damage: enemy.attack,                 result: "hit"   };
}

// ── Round resolver ────────────────────────────────────────────────────────────
//
// turnResult — from processTurn() in gameEngine.js
// playerHp   — current player HP before this round
// actionHint — "attack" | "heavy" | "defend" | "flee" | "deathsave"
//              overrides intent when player uses fixed action buttons
//
// Returns:
//   { nextEncounter, combatLines, playerHpDelta, combatOver, outcome }
//   outcome: "victory" | "defeat" | "fled" | null

export function resolveEncounterRound(encounter, turnResult, playerHp, actionHint) {
  const enemy      = { ...encounter.enemy };
  const combatLog  = [];

  // ── Death save path ───────────────────────────────────────────────────────────
  // Entered when the player is already dying (HP ≤ 0) or the actionHint is
  // "deathsave". Normal combat is skipped entirely.
  if (encounter.dying || actionHint === "deathsave") {
    const roll    = rollDie(20);
    const success = roll >= 10;
    const prev    = encounter.deathSaves;
    const deathSaves = {
      successes: prev.successes + (success ? 1 : 0),
      failures:  prev.failures  + (success ? 0 : 1),
    };

    combatLog.push(
      success
        ? `💫 Death Save (${roll}) → SUCCESS (${deathSaves.successes}/3 successes)`
        : `💀 Death Save (${roll}) → FAILURE (${deathSaves.failures}/3 failures)`
    );

    // 3 successes — stabilize at 1 HP, re-enter normal combat
    if (deathSaves.successes >= 3) {
      combatLog.push("✨ You stabilize and regain consciousness at 1 HP!");
      return {
        nextEncounter: {
          ...encounter,
          enemy,
          dying:         false,
          deathSaves:    { successes: 0, failures: 0 },
          battleLog:     [...encounter.battleLog, ...combatLog],
          lastCombatLog: combatLog,
          lastRoll:      { playerRoll: roll, isCrit: false, isFumble: false, action: "deathsave", enemyRoll: 0, enemyResult: "miss" },
        },
        combatLines:   combatLog,
        playerHpDelta: 1,   // brings HP from 0 → 1
        combatOver:    false,
        outcome:       null,
      };
    }

    // 3 failures — death
    if (deathSaves.failures >= 3) {
      combatLog.push("☠️ You succumb to your wounds...");
      return {
        nextEncounter: {
          ...encounter,
          enemy,
          dying:         true,
          deathSaves,
          battleLog:     [...encounter.battleLog, ...combatLog],
          lastCombatLog: combatLog,
          lastRoll:      { playerRoll: roll, isCrit: false, isFumble: false, action: "deathsave", enemyRoll: 0, enemyResult: "miss" },
        },
        combatLines:   combatLog,
        playerHpDelta: 0,
        combatOver:    true,
        outcome:       "defeat",
      };
    }

    // Still dying — neither 3 successes nor 3 failures yet
    return {
      nextEncounter: {
        ...encounter,
        enemy,
        dying:         true,
        deathSaves,
        battleLog:     [...encounter.battleLog, ...combatLog],
        lastCombatLog: combatLog,
        lastRoll:      { playerRoll: roll, isCrit: false, isFumble: false, action: "deathsave", enemyRoll: 0, enemyResult: "miss" },
      },
      combatLines:   combatLog,
      playerHpDelta: 0,
      combatOver:    false,
      outcome:       null,
    };
  }

  // ── Normal combat path ────────────────────────────────────────────────────────
  const action = actionHint
    ?? (turnResult.intent === "flee"   ? "flee"
      : turnResult.intent === "defend" ? "defend"
      :                                  "attack");

  const rawRoll  = turnResult.rawRoll  ?? 0;
  const modifier = turnResult.modifier ?? 0;
  const isCrit   = rawRoll === 20;
  const isFumble = rawRoll === 1 && action !== "defend";

  let playerDamage = 0;
  let playerHit    = false;
  let fumbleDamage = 0;

  // ── Player turn ──────────────────────────────────────────────────────────────
  if (action === "defend") {
    combatLog.push("🛡️ You take a defensive stance");

  } else if (action === "flee") {
    const dc      = enemy.difficulty;
    const escaped = isCrit || (!isFumble && (rawRoll + modifier) >= dc);
    if (escaped) {
      return {
        nextEncounter: encounter,
        combatLines:   ["🏃 You successfully flee!"],
        playerHpDelta: 0,
        combatOver:    true,
        outcome:       "fled",
      };
    }
    combatLog.push(`🏃 Flee attempt (${rawRoll}) → FAILED`);

  } else {
    // attack or heavy
    const dc   = action === "heavy" ? enemy.difficulty + 3 : enemy.difficulty;
    playerHit  = isCrit || (!isFumble && (rawRoll + modifier) >= dc);

    if (playerHit) {
      playerDamage = turnResult.damage?.total ?? 3;
      if (action === "heavy") playerDamage = Math.ceil(playerDamage * 1.5);
      enemy.hp = Math.max(0, enemy.hp - playerDamage);
    }
    fumbleDamage = isFumble ? rollDie(2) : 0;

    const label = action === "heavy" ? "heavy attack" : "attack";
    combatLog.push(
      isCrit   ? `⚡ CRITICAL! You ${label} (${rawRoll}) → HIT` :
      isFumble ? `💀 FUMBLE! You ${label} (${rawRoll}) → MISS` :
                 `You ${label} (${rawRoll}+${modifier} vs DC ${dc}) → ${playerHit ? "HIT" : "MISS"}`
    );
    if (playerHit && playerDamage) combatLog.push(`You deal ${playerDamage} damage${isCrit ? " (CRIT!)" : action === "heavy" ? " (HEAVY)" : ""}`);
    if (fumbleDamage)              combatLog.push(`You hurt yourself for ${fumbleDamage} damage`);
  }

  // ── Enemy turn ───────────────────────────────────────────────────────────────
  let actualTaken = fumbleDamage;
  let enemyTurn   = { roll: 0, damage: 0, result: "miss" };

  if (enemy.hp > 0) {
    enemyTurn       = resolveEnemyTurn(enemy);
    let incoming    = enemyTurn.damage;
    if (action === "defend") incoming = Math.ceil(incoming * 0.5);
    actualTaken    += incoming;

    if (action === "defend" && enemyTurn.result !== "miss") combatLog.push("🛡️ Damage halved");
    if (enemyTurn.result === "miss") {
      combatLog.push(`${enemy.name} attacks (${enemyTurn.roll}) → MISS`);
    } else {
      combatLog.push(`${enemy.name} attacks (${enemyTurn.roll}) → ${enemyTurn.result === "heavy" ? "HEAVY HIT" : "HIT"}`);
      combatLog.push(`You take ${incoming} damage`);
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const prev        = encounter.battleStats;
  const battleStats = {
    dealt:   prev.dealt   + playerDamage,
    taken:   prev.taken   + actualTaken,
    rounds:  prev.rounds  + 1,
    crits:   prev.crits   + (isCrit   ? 1 : 0),
    fumbles: prev.fumbles + (isFumble ? 1 : 0),
  };

  const newPlayerHp = Math.max(0, playerHp - actualTaken);

  // If the player just hit 0 HP (and enemy is still alive), enter dying state
  // instead of ending combat immediately.
  const playerWentDown = newPlayerHp <= 0 && enemy.hp > 0;
  if (playerWentDown) {
    combatLog.push("💔 You fall unconscious! Make death saving throws to survive...");
  }

  const combatOver = enemy.hp <= 0;   // only enemy death ends combat normally
  const outcome    = enemy.hp <= 0 ? "victory" : null;

  const lastRoll = {
    playerRoll: rawRoll, playerHit, isCrit, isFumble, action,
    enemyRoll: enemyTurn.roll, enemyResult: enemyTurn.result,
  };

  return {
    nextEncounter: {
      ...encounter,
      enemy,
      battleStats,
      dying:         playerWentDown,
      deathSaves:    playerWentDown ? { successes: 0, failures: 0 } : encounter.deathSaves,
      battleLog:     [...encounter.battleLog, ...combatLog],
      lastCombatLog: combatLog,
      lastRoll,
    },
    combatLines:   combatLog,
    playerHpDelta: -actualTaken,
    combatOver,
    outcome,
  };
}

// ── Loot Tables ───────────────────────────────────────────────────────────────

const LOOT_TABLES = {
  // Tier 1 — Trivial (rats, bats, kobolds, skeletons…)
  1: {
    gold:  () => rollDie(4) - 1,   // 0–3 gp — scraps and loose coin
    items: [
      { chance: 0.30, item: { name: "Torch",              type: "Consumable", weight: 1,   desc: "Bright light 20 ft · 1 hour" } },
      { chance: 0.25, item: { name: "Rations",            type: "Consumable", weight: 2,   desc: "One day of food and water" } },
      { chance: 0.20, item: { name: "Minor Healing Vial", type: "Consumable", weight: 0.5, desc: "Restores 1d4 HP", effect: { type: "heal", numDice: 1, sides: 4, bonus: 0 } } },
      { chance: 0.10, item: { name: "Tinderbox",          type: "Misc",       weight: 1,   desc: "Start a fire in one action" } },
    ],
  },

  // Tier 2 — Standard (goblins, bandits, wolves…)
  2: {
    gold:  () => rollDie(6) + rollDie(6),   // 2–12 gp
    items: [
      { chance: 0.55, item: { name: "Health Potion",    type: "Consumable", weight: 0.5, desc: "Restores 2d4+2 HP", effect: { type: "heal", numDice: 2, sides: 4, bonus: 2 } } },
      { chance: 0.30, item: { name: "Antitoxin",        type: "Consumable", weight: 0,   desc: "Advantage on CON saves vs poison for 1 hour" } },
      { chance: 0.25, item: { name: "Dagger",           type: "Weapon",     weight: 1,   desc: "1d4 piercing · Finesse, Light, Thrown (20/60)" } },
      { chance: 0.20, item: { name: "Thieves' Tools",   type: "Tool",       weight: 1,   desc: "Pick locks and disarm traps" } },
      { chance: 0.15, item: { name: "Oil Flask",        type: "Consumable", weight: 1,   desc: "Deal 5 fire damage if ignited" } },
    ],
  },

  // Tier 3 — Elite (orcs, trolls, veterans…)
  3: {
    gold:  () => rollDie(10) * 2 + rollDie(10) * 2 + 10,  // 14–50 gp
    items: [
      { chance: 0.90, item: { name: "Health Potion",         type: "Consumable", weight: 0.5, desc: "Restores 2d4+2 HP", effect: { type: "heal", numDice: 2, sides: 4, bonus: 2 } } },
      { chance: 0.50, item: { name: "Greater Health Potion", type: "Consumable", weight: 0.5, desc: "Restores 4d4+4 HP", effect: { type: "heal", numDice: 4, sides: 4, bonus: 4 } } },
      { chance: 0.40, item: { name: "Shortsword",            type: "Weapon",     weight: 2,   desc: "1d6 piercing · Finesse, Light" } },
      { chance: 0.30, item: { name: "Studded Leather",       type: "Armor",      weight: 13,  desc: "AC 12 + DEX · Light armor" } },
      { chance: 0.25, item: { name: "Healer's Kit",          type: "Consumable", weight: 3,   desc: "Stabilize a dying creature · 10 uses" } },
      { chance: 0.20, item: { name: "Rope (Hempen)",         type: "Misc",       weight: 10,  desc: "50 feet · supports up to 1,500 lbs" } },
    ],
  },

  // Tier 4 — Boss (dragons, vampires, liches…)
  4: {
    gold:  () => rollDie(10) * 10 + rollDie(10) * 5 + 50,  // 65–200 gp
    items: [
      { chance: 1.00, item: { name: "Greater Health Potion",   type: "Consumable", weight: 0.5, desc: "Restores 4d4+4 HP", effect: { type: "heal", numDice: 4, sides: 4, bonus: 4 } } },
      { chance: 0.70, item: { name: "Superior Health Potion",  type: "Consumable", weight: 0.5, desc: "Restores 8d4+8 HP", effect: { type: "heal", numDice: 8, sides: 4, bonus: 8 } } },
      { chance: 0.65, item: { name: "Longsword",               type: "Weapon",     weight: 3,   desc: "1d8 slashing · Versatile (1d10)" } },
      { chance: 0.50, item: { name: "Chain Mail",              type: "Armor",      weight: 55,  desc: "AC 16 · Heavy armor, Disadvantage on Stealth" } },
      { chance: 0.45, item: { name: "Shield",                  type: "Armor",      weight: 6,   desc: "+2 AC" } },
      { chance: 0.35, item: { name: "Potion of Heroism",       type: "Consumable", weight: 0.5, desc: "Gain 10 temporary HP and the Bless effect for 1 hour" } },
      { chance: 0.25, item: { name: "Arcane Focus",            type: "Misc",       weight: 1,   desc: "Spellcasting focus for arcane spells" } },
    ],
  },
};

export function rollLoot(tier) {
  const table = LOOT_TABLES[tier] ?? LOOT_TABLES[1];
  const gold  = Math.max(0, table.gold());
  const items = table.items
    .filter(entry => Math.random() < entry.chance)
    .map((entry, i) => ({ ...entry.item, id: Date.now() + i, qty: 1 }));
  return { gold, items };
}
