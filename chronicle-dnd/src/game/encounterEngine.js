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
// actionHint — "attack" | "heavy" | "defend" | "flee" (from button presses)
//              overrides intent when player uses fixed action buttons
//
// Returns:
//   { nextEncounter, combatLines, playerHpDelta, combatOver, outcome }
//   outcome: "victory" | "defeat" | "fled" | null

export function resolveEncounterRound(encounter, turnResult, playerHp, actionHint) {
  const enemy      = { ...encounter.enemy };
  const combatLog  = [];

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
  const combatOver  = enemy.hp <= 0 || newPlayerHp <= 0;
  const outcome     = enemy.hp <= 0 ? "victory" : newPlayerHp <= 0 ? "defeat" : null;

  const lastRoll = {
    playerRoll: rawRoll, playerHit, isCrit, isFumble, action,
    enemyRoll: enemyTurn.roll, enemyResult: enemyTurn.result,
  };

  return {
    nextEncounter: {
      ...encounter,
      enemy,
      battleStats,
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
