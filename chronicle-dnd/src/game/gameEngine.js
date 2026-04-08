// ── Chronicle Game Engine ──────────────────────────────────────────────────
// DESIGN PRINCIPLE: Game logic lives here. AI is only called for narration.
//
// Flow per turn:
//   1. detectIntent(input)        → what is the player trying to do?
//   2. resolveAction(intent, char) → roll dice, compute outcome in code
//   3. processTurn(input, state)  → full turn result object
//   4. applyTurnToState(result)   → deterministic state updates
//
// The AI receives the RESULT of step 3 and narrates it.
// The AI does NOT roll dice or decide success/failure.
// ──────────────────────────────────────────────────────────────────────────

// ── Dice (self-contained — does not replace the UI DiceRoller) ────────────
export function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

// ── Intent Detection ──────────────────────────────────────────────────────
// Maps player free-text to a structured action type.

const INTENT_PATTERNS = [
  {
    type: "attack",
    regex: /\b(attack|strike|hit|slash|stab|shoot|fire at|kill|slay|swing|bash|smash|cut|thrust|charge)\b/i,
  },
  {
    type: "stealth",
    regex: /\b(sneak|hide|conceal|creep|skulk|tiptoe|slip|move silently|stay hidden)\b/i,
  },
  {
    type: "persuade",
    regex: /\b(talk|speak|convince|persuade|negotiate|plead|charm|bluff|deceive|intimidate|reason with|barter)\b/i,
  },
  {
    type: "cast",
    regex: /\b(cast|spell|magic|incant|conjure|invoke|channel|use magic|activate)\b/i,
  },
  {
    type: "flee",
    regex: /\b(run|flee|escape|retreat|bolt|dash away|sprint away|get out|leave quickly)\b/i,
  },
  {
    type: "explore",
    regex: /\b(search|look|examine|investigate|check|explore|find|inspect|open|enter|go|move|head|approach|pick up|grab|take)\b/i,
  },
];

export function detectIntent(input) {
  for (const { type, regex } of INTENT_PATTERNS) {
    if (regex.test(input)) return type;
  }
  return "explore"; // sensible default
}

// ── Difficulty Classes ─────────────────────────────────────────────────────
// Standard DCs per action type. These are the target numbers for d20 rolls.

export const ACTION_DC = {
  attack:   13, // Medium combat — adjust if enemy AC is known
  stealth:  14, // Moderate stealth challenge
  persuade: 13, // Social skill check
  cast:     12, // Concentration / arcane check
  flee:     12, // Athletics to escape
  explore:  10, // Perception / investigation
  other:    12,
};

// ── Ability Modifiers ─────────────────────────────────────────────────────
function statMod(score) {
  return Math.floor(((score ?? 10) - 10) / 2);
}

function getModifier(intent, stats) {
  if (!stats) return 0;
  switch (intent) {
    case "attack":   return statMod(stats.STR);
    case "stealth":  return statMod(stats.DEX);
    case "persuade": return statMod(stats.CHA);
    case "cast":     return Math.max(statMod(stats.INT), statMod(stats.WIS));
    case "flee":     return statMod(stats.DEX);
    case "explore":  return statMod(stats.WIS);
    default:         return 0;
  }
}

// ── Outcome Computation ────────────────────────────────────────────────────
// Outcome is fully determined in code from the raw d20 result.
// AI receives the outcome label — it may NOT change it.

export function computeOutcome(rawRoll, total, dc) {
  if (rawRoll === 1)  return "fumble";   // Nat 1  — always fails regardless of modifier
  if (rawRoll === 20) return "critical"; // Nat 20 — always succeeds regardless of DC
  if (total >= dc)    return "success";
  if (total >= dc - 4) return "partial"; // Within 4 below DC: partial success / success with cost
  return "failure";
}

// ── Damage Dice by Class ──────────────────────────────────────────────────
const CLASS_DAMAGE_DIE = {
  Barbarian: 12, Fighter: 8, Paladin: 8, Ranger: 6,
  Rogue: 8,      Monk: 6,    Bard: 6,    Cleric: 6,
  Druid: 6,      Wizard: 4,  Sorcerer: 4, Warlock: 8,
};

function rollDamage(charClass, isCrit) {
  const sides = CLASS_DAMAGE_DIE[charClass] ?? 6;
  const base  = rollDie(sides);
  const extra = isCrit ? rollDie(sides) : 0; // Critical: roll damage dice twice
  return { total: base + extra, sides, base, extra };
}

// ── Should this action trigger a dice roll? ────────────────────────────────
// Only contested / skill-check actions roll. Pure narration (exploring a room,
// looking around, moving) flows straight to the AI without a roll.

const ROLL_TRIGGERS = [
  // Combat
  "attack", "strike", "hit", "slash", "stab", "shoot", "fire", "kill", "slay",
  "swing", "bash", "smash", "charge", "thrust",
  // Stealth / theft
  "sneak", "hide", "steal", "pickpocket", "pick lock", "picklock", "disarm",
  // Social
  "persuade", "convince", "deceive", "bluff", "intimidate", "charm", "bribe",
  // Magic
  "cast", "spell",
  // Athletics / action
  "flee", "escape", "climb", "jump", "swim", "force", "break", "push", "pull",
];

export function shouldRoll(playerInput) {
  const lower = playerInput.toLowerCase();
  return ROLL_TRIGGERS.some(word => lower.includes(word));
}

// ── Main Turn Processor ────────────────────────────────────────────────────
// Call this with the player's raw text and the current game state.
// Returns a deterministic TurnResult. No AI involved.
//
// TurnResult shape:
// {
//   action:    string,   // original player text
//   intent:    string,   // detected action type
//   rawRoll:   number,   // d20 face value (1-20)
//   modifier:  number,   // stat mod applied
//   total:     number,   // rawRoll + modifier
//   dc:        number,   // difficulty class rolled against
//   outcome:   string,   // "critical" | "success" | "partial" | "failure" | "fumble"
//   isCrit:    bool,
//   isFumble:  bool,
//   damage?:   { total, sides, base, extra },
// }

export function processTurn(playerInput, gameState) {
  const { character } = gameState;
  const stats     = character?.stats ?? {};
  const charClass = character?.class  ?? "Fighter";

  const intent  = detectIntent(playerInput);
  const needsRoll = shouldRoll(playerInput);

  const result = {
    action: playerInput,
    intent,
    needsRoll,
  };

  if (needsRoll) {
    const dc       = ACTION_DC[intent] ?? 12;
    const modifier = getModifier(intent, stats);

    // ── Dice rolls happen HERE, before AI is called ──
    const rawRoll  = rollDie(20);
    const total    = rawRoll + modifier;
    const isCrit   = rawRoll === 20;
    const isFumble = rawRoll === 1;
    const outcome  = computeOutcome(rawRoll, total, dc);

    Object.assign(result, { rawRoll, modifier, total, dc, outcome, isCrit, isFumble });

    // ── Intent-specific resolutions ────────────────────────────────────────
    if (intent === "attack" && outcome !== "failure" && outcome !== "fumble") {
      result.damage = rollDamage(charClass, isCrit);
    }
  }

  return result;
}

// ── State Updates (code only — not AI) ────────────────────────────────────
// Returns a plain object of changes to apply to React state.
// Expand this as the game grows (enemy HP, conditions, loot, etc.)

export function applyTurnToState(turnResult) {
  const changes = { hpDelta: 0 };

  // Fumble while attacking → minor self-inflicted mishap
  if (turnResult.isFumble && turnResult.intent === "attack") {
    changes.hpDelta = -1;
    changes.fumbleSelf = true;
  }

  return changes;
}

// ── Roll Summary String (for chat display) ────────────────────────────────
export function formatRollSummary(turnResult) {
  const { rawRoll, modifier, total, dc, outcome, isCrit, isFumble, damage } = turnResult;
  const modStr = modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : "";
  const totalStr = modifier !== 0 ? ` = ${total}` : "";
  const outcomeLabel = {
    critical: "CRITICAL HIT",
    success:  "SUCCESS",
    partial:  "PARTIAL",
    failure:  "FAILURE",
    fumble:   "FUMBLE",
  }[outcome] ?? outcome.toUpperCase();

  let summary = `d20: ${rawRoll}${modStr}${totalStr} vs DC ${dc} — ${outcomeLabel}`;
  if (damage) {
    const critNote = isCrit ? ` (${damage.base}+${damage.extra} crit)` : "";
    summary += ` · ${damage.total} dmg${critNote}`;
  }
  if (isFumble) summary += " · You hurt yourself!";
  return summary;
}
