import Anthropic from "@anthropic-ai/sdk";

export const config = {
  api: { responseLimit: false },
};

// ── System prompts ─────────────────────────────────────────────────────────

function buildDMPrompt(character) {
  return `You are a Dungeon Master running a D&D 5e campaign. Be vivid, atmospheric, and reactive to player choices. Keep responses under 150 words. Always end with "What do you do?"

When a player's message contains a dice roll in brackets like [Rolled d20: **17**], narrate the outcome based on the result:
- 1 (Fumble): Something goes badly wrong — dramatic failure with real consequences
- 2-9: Failure or significant complication
- 10-14: Partial success, or success with a cost
- 15-19: Clear success
- 20 (Critical Hit): Exceptional, memorable success beyond all expectations

Player character: ${character.name || "Adventurer"}, ${character.race || ""} ${character.class || ""}${character.background ? `, Background: ${character.background}` : ""}`.trim();
}

function buildNarrationPrompt(character) {
  // Used by the game engine path. The turn result (dice + outcome) is already
  // computed in code. Claude's only job is vivid prose.
  return `You are a Dungeon Master providing narration for a D&D 5e game. The game engine has already determined all outcomes — your role is ONLY to narrate them.

STRICT RULES:
- The outcome is already decided. Do NOT change it.
- Do NOT roll dice, invent mechanics, or override success/failure.
- Be vivid, atmospheric, and immersive — 2-4 sentences.
- End every response with "What do you do?"

Player character: ${character.name || "Adventurer"}, ${character.race || ""} ${character.class || ""}${character.background ? `, Background: ${character.background}` : ""}`.trim();
}

function buildEncounterPrompt() {
  return `You generate D&D 5e enemy combat stats. Respond with ONLY a valid JSON object — no explanation, no markdown, no extra text.`;
}

// ── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { messages = [], character = {}, mode = "dm" } = req.body;

  const apiMessages = messages
    .filter((m) => m.role === "player")
    .map((m) => ({ role: "user", content: m.text }));

  if (apiMessages.length === 0) {
    return res.status(400).json({ error: "No player messages provided" });
  }

  // All errors go through SSE so the client can display them inline
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  if (!process.env.ANTHROPIC_API_KEY) {
    res.write(`data: ${JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured on the server" })}\n\n`);
    res.end();
    return;
  }

  const systemPrompt = mode === "narration" ? buildNarrationPrompt(character)
    : mode === "encounter"                  ? buildEncounterPrompt()
    :                                         buildDMPrompt(character);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const stream = client.messages.stream({
      model:      "claude-sonnet-4-6",
      max_tokens: 512,
      system:     systemPrompt,
      messages:   apiMessages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err?.message || "Unexpected error" })}\n\n`);
    res.end();
  }
}
