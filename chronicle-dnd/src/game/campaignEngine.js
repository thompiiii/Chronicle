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

// ── Factory ────────────────────────────────────────────────────────────────
// Build the initial state for a campaign. Call once when the player starts.

export function createCampaignState(campaign, playerOverrides = {}) {
  return {
    player: {
      hp:        20,
      maxHp:     20,
      attack:    5,
      inventory: [],
      gold:      0,
      ...campaign.playerOverrides,
      ...playerOverrides,
    },
    campaign,
    currentStep: campaign.startStep,
    enemy: null,
    log: [],
  };
}

// ── Navigation ─────────────────────────────────────────────────────────────
// Move to a specific step by id. Returns new state (immutable update).

export function goToStep(gameState, stepId) {
  const step = gameState.campaign.steps[stepId];
  if (!step) throw new Error(`Campaign step "${stepId}" not found`);

  const next = {
    ...gameState,
    currentStep: stepId,
    log: [...gameState.log, stepId],
    enemy: null,
  };

  // Entering a combat step — spawn the enemy
  if (step.type === "combat") {
    next.enemy = { ...step.enemy, maxHp: step.enemy.hp, hp: step.enemy.hp };
  }

  // Entering a loot step — apply rewards immediately
  if (step.type === "loot") {
    next.player = applyLoot(next.player, step.loot);
  }

  return next;
}

// Shorthand: follow a choice by index
export function chooseOption(gameState, choiceIndex) {
  const step = gameState.campaign.steps[gameState.currentStep];
  if (step.type !== "scene") throw new Error("chooseOption only valid on scene steps");
  const choice = step.choices[choiceIndex];
  if (!choice) throw new Error(`No choice at index ${choiceIndex}`);
  return goToStep(gameState, choice.next);
}

// ── Combat ─────────────────────────────────────────────────────────────────
// Both player and enemy attack each other once per call.
// Returns { gameState, playerRoll, enemyRoll, playerDmg, enemyDmg, result }
// result: "ongoing" | "victory" | "defeat"

export function resolveCombatRound(gameState) {
  const step = gameState.campaign.steps[gameState.currentStep];
  if (!gameState.enemy) throw new Error("No active enemy");

  const playerRoll = rollDie(20);
  const enemyRoll  = rollDie(20);

  const playerDmg = playerRoll >= 10 ? gameState.player.attack + rollDie(6) : 0;
  const enemyDmg  = enemyRoll  >= 10 ? gameState.enemy.attack               : 0;

  const newEnemyHp  = Math.max(0, gameState.enemy.hp  - playerDmg);
  const newPlayerHp = Math.max(0, gameState.player.hp - enemyDmg);

  let next = {
    ...gameState,
    player: { ...gameState.player, hp: newPlayerHp },
    enemy:  { ...gameState.enemy,  hp: newEnemyHp  },
  };

  let result = "ongoing";

  if (newEnemyHp <= 0) {
    result = "victory";
    next.player = { ...next.player, gold: next.player.gold + (gameState.enemy.xp ?? 0) };
    next = goToStep(next, step.onVictory);
  } else if (newPlayerHp <= 0) {
    result = "defeat";
    next = goToStep(next, step.onDefeat);
  }

  return { gameState: next, playerRoll, enemyRoll, playerDmg, enemyDmg, result };
}

// ── Loot ───────────────────────────────────────────────────────────────────

function applyLoot(player, loot) {
  if (!loot) return player;
  const gold      = (player.gold      ?? 0) + (loot.gold  ?? 0);
  const inventory = [...(player.inventory ?? []), ...(loot.items ?? [])];
  return { ...player, gold, inventory };
}

// ── Combat ─────────────────────────────────────────────────────────────────
// One round of campaign combat — player rolls, enemy retaliates, narration follows.
// Returns new gameState with narration attached.

export async function resolveCombatStep(gameState, playerInput) {
  const step = gameState.campaign.steps[gameState.currentStep];
  if (step.type !== "combat") throw new Error("resolveCombatStep called on non-combat step");

  // Spawn enemy on first round if not yet in state
  const enemy = gameState.enemy
    ? { ...gameState.enemy }
    : { ...step.enemy, maxHp: step.enemy.hp };

  // Player attacks — roll d20 vs step.enemy.difficulty
  const roll    = rollDie(20);
  const success = roll >= step.enemy.difficulty;

  if (success) {
    enemy.hp -= gameState.player.attack;
  }

  // Enemy retaliates if still alive
  let playerHp = gameState.player.hp;
  if (enemy.hp > 0) {
    playerHp -= enemy.attack;
  }

  // Build intermediate state for narration context
  let next = {
    ...gameState,
    player: { ...gameState.player, hp: Math.max(0, playerHp) },
    enemy:  enemy.hp > 0 ? enemy : null,
  };

  // Advance step on resolution
  if (enemy.hp <= 0) {
    next.player = { ...next.player, gold: next.player.gold + (step.enemy.xp ?? 0) };
    next.currentStep = step.onVictory;
  } else if (playerHp <= 0) {
    next.currentStep = step.onDefeat;
  }

  const narration = await getNarration({ step, playerInput, gameState: next, roll, success });

  return { ...next, narration };
}

// ── Exploration ────────────────────────────────────────────────────────────
// Exploration steps hand the player's input to the AI for free narration,
// then automatically advance to step.next. No dice rolled.

export async function resolveExplorationStep(gameState, playerInput) {
  const step = gameState.campaign.steps[gameState.currentStep];
  if (step.type !== "exploration") throw new Error("resolveExplorationStep called on non-exploration step");

  const narration = await getNarration({ step, playerInput, gameState });

  return {
    ...gameState,
    narration,
    currentStep: step.next,
  };
}

// ── End ────────────────────────────────────────────────────────────────────
// Terminal step — no AI call, no further navigation. Uses step.text directly.

export function resolveEndStep(gameState) {
  const step = gameState.campaign.steps[gameState.currentStep];
  if (step.type !== "end") throw new Error("resolveEndStep called on non-end step");

  return {
    ...gameState,
    narration: step.text,
    gameOver:  true,
  };
}

// ── React integration ──────────────────────────────────────────────────────
// Drop this into your component — moves to a scene choice without AI:
//
//   function handleChoice(nextStep) {
//     setGameState(prev => ({ ...prev, currentStep: nextStep }))
//   }

// ── Helpers ────────────────────────────────────────────────────────────────

export function isOver(gameState) {
  const step = gameState.campaign.steps[gameState.currentStep];
  return step?.type === "end";
}

export function playerIsAlive(gameState) {
  return gameState.player.hp > 0;
}
