// ── Chronicle Campaign Engine ──────────────────────────────────────────────
// Drives structured campaigns (goblinCave, etc.) where the story follows a
// fixed branching script rather than open-ended AI narration.
//
// State shape:
// {
//   player:      { hp, attack, inventory, gold }
//   campaign:    goblinCaveCampaign   (the full campaign object)
//   currentStep: "entrance"           (key into campaign.steps)
//   enemy:       null | { name, hp, maxHp, attack, xp }
// }
// ──────────────────────────────────────────────────────────────────────────

import { rollDie } from "./gameEngine";
import { getNarration } from "./aiClient";

// ── Combat helpers ─────────────────────────────────────────────────────────

function detectCombatAction(playerInput) {
  const t = playerInput.toLowerCase();
  if (t === "defend" || t.includes("defend") || t.includes("block")) return "defend";
  if (t === "heavy"  || t.includes("heavy")  || t.includes("power")) return "heavy";
  return "attack";
}

// Damage with ±2 variance, minimum 1
function rollDamage(base) {
  return Math.max(1, base - 2 + rollDie(5) - 1);
}

// Enemy behaviour: roll d20 → miss / normal / heavy
function resolveEnemyTurn(enemy) {
  const roll = rollDie(20);
  if (roll < 6)  return { roll, damage: 0,                        result: "miss"   };
  if (roll > 15) return { roll, damage: Math.ceil(enemy.attack * 1.5), result: "heavy" };
                 return { roll, damage: enemy.attack,              result: "hit"    };
}

// ── Factory ────────────────────────────────────────────────────────────────

export function createCampaignState(campaign, playerOverrides = {}) {
  return {
    player: {
      hp:             20,
      maxHp:          20,
      attack:         5,
      defense:        10,
      inventory:      [],
      gold:           0,
      equippedWeapon: null,
      ...campaign.playerOverrides,
      ...playerOverrides,
    },
    campaign,
    currentStep: campaign.startStep,
    enemy: null,
    log:   [],
  };
}

// ── Navigation ─────────────────────────────────────────────────────────────

export function goToStep(gameState, stepId) {
  const step = gameState.campaign.steps[stepId];
  if (!step) throw new Error(`Campaign step "${stepId}" not found`);

  const next = {
    ...gameState,
    currentStep:       stepId,
    log:               [...gameState.log, stepId],
    enemy:             null,
    narration:         null,
    lastRoll:          null,
    pendingTransition: null,
  };

  if (step.type === "combat") {
    next.enemy       = { ...step.enemy, maxHp: step.enemy.hp };
    next.battleStats = { dealt: 0, taken: 0, rounds: 0, crits: 0, fumbles: 0 };
    next.battleLog   = [];
  }

  if (step.type === "loot") {
    next.player = applyLoot(next.player, step.loot);
  }

  return next;
}

export function chooseOption(gameState, choiceIndex) {
  const step = gameState.campaign.steps[gameState.currentStep];
  if (step.type !== "choice") throw new Error("chooseOption only valid on choice steps");
  const choice = step.choices[choiceIndex];
  if (!choice) throw new Error(`No choice at index ${choiceIndex}`);
  return goToStep(gameState, choice.next);
}

// ── Step Resolver ──────────────────────────────────────────────────────────
// Single entry point for all step types. Handles game logic then calls
// getNarration with a consistent payload shape:
//   { step, playerInput, gameState, roll, success }

export async function resolveStep(gameState, playerInput) {
  const step = gameState.campaign.steps[gameState.currentStep];

  console.log({
    currentStep: gameState.currentStep,
    stepType:    step.type,
    enemyHP:     gameState.enemy?.hp,
  });

  // ── Choice ───────────────────────────────────────────────────────────────
  if (step.type === "choice") {
    return {
      ...gameState,
      narration: "Choose an option to continue.",
    };
  }

  // ── End ─────────────────────────────────────────────────────────────────
  if (step.type === "end") {
    return {
      ...gameState,
      narration: step.text,
      gameOver:  true,
    };
  }

  // ── Combat ───────────────────────────────────────────────────────────────
  if (step.type === "combat") {
    const enemy     = gameState.enemy
      ? { ...gameState.enemy }
      : { ...step.enemy, maxHp: step.enemy.hp };
    const action    = detectCombatAction(playerInput);
    const combatLog = [];

    // ── Player turn ──────────────────────────────────────────────────────
    let playerRoll = 0;
    let isCrit     = false;
    let isFumble   = false;
    let playerHit  = false;
    let playerDamage = 0;
    let fumbleDamage = 0;

    if (action === "defend") {
      // Defending skips the player attack — just brace for the enemy turn
      combatLog.push(`🛡️ You take a defensive stance`);
    } else {
      playerRoll = rollDie(20);
      isCrit     = playerRoll === 20;
      isFumble   = playerRoll === 1;
      const dc   = step.enemy.difficulty + (action === "heavy" ? 3 : 0);
      playerHit  = !isFumble && (isCrit || playerRoll >= dc);

      if (playerHit) {
        playerDamage = action === "heavy"
          ? gameState.player.attack * 2
          : rollDamage(gameState.player.attack);
        if (isCrit) playerDamage *= 2;
      }
      fumbleDamage = isFumble ? rollDie(2) : 0;
      enemy.hp = Math.max(0, enemy.hp - playerDamage);

      combatLog.push(
        isCrit   ? `⚡ CRITICAL! You ${action} (${playerRoll} vs ${dc}) → HIT` :
        isFumble ? `💀 FUMBLE! You ${action} (${playerRoll} vs ${dc}) → MISS` :
                   `You ${action} (${playerRoll} vs ${dc}) → ${playerHit ? "HIT" : "MISS"}`
      );
      if (playerHit)    combatLog.push(`You deal ${playerDamage} damage${isCrit ? " (CRIT!)" : ""}`);
      if (fumbleDamage) combatLog.push(`You hurt yourself for ${fumbleDamage} damage`);
    }

    // ── Enemy turn ───────────────────────────────────────────────────────
    let playerHp     = gameState.player.hp - fumbleDamage;
    let enemyTurn    = { roll: 0, damage: 0, result: "miss" };
    let actualTaken  = fumbleDamage;

    if (enemy.hp > 0) {
      enemyTurn = resolveEnemyTurn(enemy);
      let incoming = enemyTurn.damage;
      if (action === "defend") incoming = Math.ceil(incoming * 0.5);
      playerHp    = Math.max(0, playerHp - incoming);
      actualTaken += incoming;

      if (action === "defend" && enemyTurn.result !== "miss") combatLog.push(`🛡️ You brace — damage halved`);
      if (enemyTurn.result === "miss") {
        combatLog.push(`${step.enemy.name} attacks (${enemyTurn.roll}) → MISS`);
      } else {
        combatLog.push(`${step.enemy.name} attacks (${enemyTurn.roll}) → ${enemyTurn.result === "heavy" ? "HEAVY HIT" : "HIT"}`);
        combatLog.push(`You take ${incoming} damage`);
      }
    }

    // ── Accumulate battle stats ───────────────────────────────────────────
    const prev = gameState.battleStats ?? { dealt: 0, taken: 0, rounds: 0, crits: 0, fumbles: 0 };
    const battleStats = {
      dealt:   prev.dealt   + playerDamage,
      taken:   prev.taken   + actualTaken,
      rounds:  prev.rounds  + 1,
      crits:   prev.crits   + (isCrit   ? 1 : 0),
      fumbles: prev.fumbles + (isFumble ? 1 : 0),
    };
    const battleLog = [...(gameState.battleLog ?? []), ...combatLog];

    // ── Resolve ──────────────────────────────────────────────────────────
    let next = {
      ...gameState,
      player:     { ...gameState.player, hp: Math.max(0, playerHp) },
      enemy:      enemy.hp > 0 ? enemy : null,
      combatLog,
      battleStats,
      battleLog,
    };

    const lastRoll = {
      playerRoll, playerHit, isCrit, isFumble, action,
      enemyRoll: enemyTurn.roll, enemyResult: enemyTurn.result,
    };

    const combatOver = enemy.hp <= 0 || playerHp <= 0;

    if (combatOver) {
      const outcome  = enemy.hp <= 0 ? "victory" : "defeat";
      const nextStep = outcome === "victory" ? step.onVictory : step.onDefeat;
      if (outcome === "victory") {
        next.player = {
          ...next.player,
          gold: next.player.gold + (step.enemy.xp ?? 0),
          hp:   next.player.maxHp,
        };
      }
      const narration = await getNarration({ step, playerInput, gameState: next, roll: playerRoll, success: playerHit, isCrit });
      return {
        ...next,
        lastRoll,
        narration: null,
        pendingTransition: { nextStep, outcome, battleStats, battleLog, narration },
      };
    }

    const narration = await getNarration({ step, playerInput, gameState: next, roll: playerRoll, success: playerHit, isCrit });
    return { ...next, narration, lastRoll };
  }

  // ── Loot ─────────────────────────────────────────────────────────────────
  if (step.type === "loot") {
    const narration = await getNarration({ step, playerInput, gameState });
    return goToStep({ ...gameState, narration }, step.next);
  }

  // ── Exploration ──────────────────────────────────────────────────────────
  if (step.type === "exploration") {
    const narration = await getNarration({ step, playerInput, gameState, roll: undefined, success: undefined });
    return { ...gameState, narration, currentStep: step.next };
  }
}

// ── React integration ──────────────────────────────────────────────────────
// Scene choices don't go through resolveStep — no AI, just state update:
//
//   function handleChoice(nextStep) {
//     setGameState(prev => ({ ...prev, currentStep: nextStep }))
//   }

// ── Loot helper ────────────────────────────────────────────────────────────

function applyLoot(player, loot) {
  if (!loot) return player;
  const gold      = (player.gold      ?? 0) + (loot.gold  ?? 0);
  const inventory = [...(player.inventory ?? []), ...(loot.items ?? [])];
  return { ...player, gold, inventory };
}

// ── Item Usage ─────────────────────────────────────────────────────────────

export function useItem(gameState, itemName) {
  const inventory = gameState.player.inventory;
  const idx = inventory.findIndex(i => i.name === itemName);
  if (idx === -1) return gameState;

  const item = inventory[idx];
  if (!item.effect) return gameState;

  if (item.effect.type === "heal") {
    let heal = 0;
    if (item.effect.flat !== undefined) {
      heal = item.effect.flat;
    } else {
      for (let d = 0; d < item.effect.numDice; d++) heal += rollDie(item.effect.sides);
      heal += (item.effect.bonus ?? 0);
    }
    const newInventory = [...inventory];
    newInventory.splice(idx, 1);
    return {
      ...gameState,
      player: {
        ...gameState.player,
        hp:        Math.min(gameState.player.maxHp, gameState.player.hp + heal),
        inventory: newInventory,
      },
    };
  }

  if (item.effect.type === "weapon") {
    return {
      ...gameState,
      player: {
        ...gameState.player,
        attack:         item.effect.attack,
        equippedWeapon: item.name,
      },
    };
  }

  return gameState;
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function isOver(gameState) {
  const step = gameState.campaign.steps[gameState.currentStep];
  return step?.type === "end";
}

export function playerIsAlive(gameState) {
  return gameState.player.hp > 0;
}
