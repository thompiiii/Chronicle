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
    log:   [],
  };
}

// ── Navigation ─────────────────────────────────────────────────────────────

export function goToStep(gameState, stepId) {
  const step = gameState.campaign.steps[stepId];
  if (!step) throw new Error(`Campaign step "${stepId}" not found`);

  const next = {
    ...gameState,
    currentStep: stepId,
    log: [...gameState.log, stepId],
    enemy: null,
  };

  if (step.type === "combat") {
    next.enemy = { ...step.enemy, maxHp: step.enemy.hp, hp: step.enemy.hp };
  }

  if (step.type === "loot") {
    next.player = applyLoot(next.player, step.loot);
  }

  return next;
}

export function chooseOption(gameState, choiceIndex) {
  const step = gameState.campaign.steps[gameState.currentStep];
  if (step.type !== "scene") throw new Error("chooseOption only valid on scene steps");
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
    const enemy = gameState.enemy
      ? { ...gameState.enemy }
      : { ...step.enemy, maxHp: step.enemy.hp };

    const roll    = rollDie(20);
    const success = roll >= step.enemy.difficulty;

    if (success) {
      enemy.hp -= gameState.player.attack;
    }

    let playerHp = gameState.player.hp;
    if (enemy.hp > 0) {
      playerHp -= enemy.attack;
    }

    let next = {
      ...gameState,
      player: { ...gameState.player, hp: Math.max(0, playerHp) },
      enemy:  enemy.hp > 0 ? enemy : null,
    };

    if (enemy.hp <= 0) {
      next.player = { ...next.player, gold: next.player.gold + (step.enemy.xp ?? 0) };
      next.currentStep = step.onVictory;
    } else if (playerHp <= 0) {
      next.currentStep = step.onDefeat;
    }

    const narration = await getNarration({ step, playerInput, gameState: next, roll, success });
    return { ...next, narration };
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

// ── Helpers ────────────────────────────────────────────────────────────────

export function isOver(gameState) {
  const step = gameState.campaign.steps[gameState.currentStep];
  return step?.type === "end";
}

export function playerIsAlive(gameState) {
  return gameState.player.hp > 0;
}
