// ── Chronicle AI Client ────────────────────────────────────────────────────
// Responsible ONLY for narration. Receives a fully-resolved TurnResult from
// the game engine and asks Claude to narrate the outcome.
//
// Claude's role here is purely storytelling:
//   ✓ Vivid, atmospheric prose
//   ✓ References the confirmed outcome
//   ✗ Cannot change success/failure
//   ✗ Cannot roll dice
//   ✗ Cannot modify stats
// ──────────────────────────────────────────────────────────────────────────

const OUTCOME_DIRECTION = {
  critical: "This was a NATURAL 20 — an extraordinary, memorable critical success. Make it spectacular.",
  success:  "This succeeded cleanly. Narrate the outcome with confidence.",
  partial:  "This partially succeeded but at a cost or complication. Narrate both the success and the price.",
  failure:  "This failed. Narrate the failure vividly — consequences matter.",
  fumble:   "This was a NATURAL 1 — a critical failure or mishap. Something went embarrassingly or dangerously wrong.",
};

// Build the structured turn description sent to Claude.
function buildTurnMessage(turnResult) {
  const { action, intent, rawRoll, modifier, total, dc, outcome, isCrit, isFumble, damage } = turnResult;

  const modStr   = modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : "";
  const totalStr = modifier !== 0 ? ` = ${total}` : "";

  const lines = [`Player action: "${action}"`, `Action type: ${intent}`];

  if (outcome) {
    // Contested action — dice were rolled, outcome is decided
    lines.push(
      `Dice: d20 rolled ${rawRoll}${modStr}${totalStr} vs DC ${dc}`,
      `Outcome: ${outcome.toUpperCase()}${isCrit ? " (NATURAL 20)" : ""}${isFumble ? " (NATURAL 1)" : ""}`,
    );
    if (damage) {
      const critNote = isCrit ? ` (${damage.base} + ${damage.extra} crit bonus = ${damage.total})` : "";
      lines.push(`Damage dealt: ${damage.total}${critNote}`);
    }
    if (isFumble && intent === "attack") {
      lines.push("The fumble also caused 1 point of self-inflicted damage.");
    }
    lines.push("", OUTCOME_DIRECTION[outcome]);
  } else {
    // No roll needed — free narration action (exploring, moving, observing)
    lines.push("No dice roll required. Narrate this action freely and atmospherically.");
  }

  return lines.join("\n");
}

// ── getNarration ───────────────────────────────────────────────────────────
// Streams narration from the API. Returns the full narration string.
// Calls onChunk(text) for each streamed token (for live display if wanted).
// Calls onError(message) if something goes wrong.
//
// Two call styles:
//   getNarration(turnResult, gameState, callbacks)        — free-play mode
//   getNarration({ step, playerInput, gameState }, callbacks) — campaign exploration

export async function getNarration(arg1, arg2, callbacks = {}) {
  // ── Campaign exploration style ─────────────────────────────────────────
  if (arg1 && "step" in arg1) {
    const { step, playerInput, gameState } = arg1;
    const { onChunk, onError } = arg2 ?? {};
    const text = [
      `Scene: ${step.title}`,
      `Scene description: ${step.text}`,
      `Player action: "${playerInput}"`,
      "",
      "Narrate the player's action in this scene atmospherically. 2–4 sentences. End with 'What do you do?'",
    ].join("\n");
    return streamNarration({ text, gameState: gameState ?? {}, onChunk, onError });
  }

  // ── Free-play turn style ───────────────────────────────────────────────
  const turnResult = arg1;
  const gameState  = arg2;
  const { onChunk, onError } = callbacks;
  const { character, messages = [] } = gameState;

  // Include the last 2 DM messages as scene context so Claude knows what's happening
  const contextMessages = messages
    .filter((m) => m.role === "dm")
    .slice(-2)
    .map((m) => ({ role: "player", text: `[Scene context] ${m.text}` }));

  const payload = {
    messages: [
      ...contextMessages,
      { role: "player", text: buildTurnMessage(turnResult) },
    ],
    character: {
      name:       character?.name,
      class:      character?.class,
      race:       character?.race,
      background: character?.background,
    },
    mode: "narration", // tells api/chat.js to use the strict narration system prompt
  };

  return streamNarration({ payload, onChunk, onError });
}

// ── Shared SSE stream helper ───────────────────────────────────────────────
async function streamNarration({ text, payload, gameState, onChunk, onError }) {
  // Build payload from raw text when called from the exploration path
  const body = payload ?? {
    messages: [{ role: "player", text }],
    character: {
      name:       gameState?.character?.name,
      class:      gameState?.character?.class,
      race:       gameState?.character?.race,
      background: gameState?.character?.background,
    },
    mode: "narration",
  };

  try {
    const response = await fetch("/api/chat", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });

    if (!response.ok) throw new Error(`Server error ${response.status}`);

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let narration = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") break;
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.text) {
            narration += parsed.text;
            onChunk?.(parsed.text);
          }
        } catch (e) {
          if (e.message !== "Unexpected end of JSON input") throw e;
        }
      }
    }

    return narration;
  } catch (err) {
    const msg = err.message === "Failed to fetch" || err.message === "Load failed"
      ? "Could not reach the server. Check your connection and try again."
      : err.message;
    onError?.(msg);
    return null;
  }
}
