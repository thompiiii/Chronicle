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
    log: [], // record of step ids visited
  };
}

// ── Accessors ──────────────────────────────────────────────────────────────

export function currentStep(state) {
  return state.campaign.steps[state.currentStep];
}

// ── Navigation ─────────────────────────────────────────────────────────────
// Move to a specific step by id. Returns new state (immutable update).

export function goToStep(state, stepId) {
  const step = state.campaign.steps[stepId];
  if (!step) throw new Error(`Campaign step "${stepId}" not found`);

  const next = {
    ...state,
    currentStep: stepId,
    log: [...state.log, stepId],
    enemy: null,
  };

  // Entering a combat step — spawn the enemy
  if (step.type === "combat") {
    next.enemy = {
      ...step.enemy,
      maxHp: step.enemy.hp,
      hp:    step.enemy.hp,
    };
  }

  // Entering a loot step — apply rewards immediately
  if (step.type === "loot") {
    next.player = applyLoot(next.player, step.loot);
  }

  return next;
}

// Shorthand: follow a choice's next field
export function chooseOption(state, choiceIndex) {
  const step = currentStep(state);
  if (step.type !== "scene") throw new Error("chooseOption only valid on scene steps");
  const choice = step.choices[choiceIndex];
  if (!choice) throw new Error(`No choice at index ${choiceIndex}`);
  return goToStep(state, choice.next);
}

// ── Combat ─────────────────────────────────────────────────────────────────
// Both player and enemy attack each other once per call.
// Returns { state, playerRoll, enemyRoll, playerDmg, enemyDmg, result }
// result: "ongoing" | "victory" | "defeat"

export function resolveCombatRound(state) {
  if (!state.enemy) throw new Error("No active enemy");

  const playerRoll = rollDie(20);
  const enemyRoll  = rollDie(20);

  // Player attacks enemy
  const playerDmg  = playerRoll >= 10 ? state.player.attack + rollDie(6) : 0;
  // Enemy attacks player
  const enemyDmg   = enemyRoll  >= 10 ? state.enemy.attack                : 0;

  const newEnemyHp  = Math.max(0, state.enemy.hp  - playerDmg);
  const newPlayerHp = Math.max(0, state.player.hp  - enemyDmg);

  let next = {
    ...state,
    player: { ...state.player, hp: newPlayerHp },
    enemy:  { ...state.enemy,  hp: newEnemyHp  },
  };

  const step = currentStep(state);
  let result = "ongoing";

  if (newEnemyHp <= 0) {
    result = "victory";
    next.player = { ...next.player, gold: next.player.gold + (state.enemy.xp ?? 0) };
    next = goToStep(next, step.onVictory);
  } else if (newPlayerHp <= 0) {
    result = "defeat";
    next = goToStep(next, step.onDefeat);
  }

  return { state: next, playerRoll, enemyRoll, playerDmg, enemyDmg, result };
}

// ── Loot ───────────────────────────────────────────────────────────────────

function applyLoot(player, loot) {
  if (!loot) return player;
  const gold      = (player.gold      ?? 0) + (loot.gold  ?? 0);
  const inventory = [...(player.inventory ?? []), ...(loot.items ?? [])];
  return { ...player, gold, inventory };
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function isOver(state) {
  return currentStep(state)?.type === "end";
}

export function playerIsAlive(state) {
  return state.player.hp > 0;
}
