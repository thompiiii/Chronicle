import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import Anthropic from "@anthropic-ai/sdk";

const app = express();

// ── CORS — local dev only; lock to Vite dev server origin ─────────────────
app.use(cors({
  origin: ["http://localhost:5000", "http://127.0.0.1:5000"],
  methods: ["POST", "GET"],
}));

// ── Rate limit — 20 requests per minute per IP ────────────────────────────
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — slow down." },
}));

app.use(express.json({ limit: "50kb" }));

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("ERROR: ANTHROPIC_API_KEY is not set");
  process.exit(1);
}
const client = new Anthropic({ apiKey });

// ── Input validation ───────────────────────────────────────────────────────
function validateBody(body) {
  const { messages = [], character = {} } = body;
  if (!Array.isArray(messages))           return "messages must be an array";
  if (messages.length > 50)               return "Too many messages (max 50)";
  for (const m of messages) {
    if (typeof m.text !== "string")       return "Each message must have a text string";
    if (m.text.length > 2000)             return "Message too long (max 2000 chars)";
  }
  if (typeof character !== "object" || Array.isArray(character)) return "character must be an object";
  return null;
}

// POST /api/chat
app.post("/api/chat", async (req, res) => {
  const validationError = validateBody(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const { messages = [], character = {} } = req.body;

  const systemPrompt = `You are a Dungeon Master running a D&D 5e campaign. Be vivid, atmospheric, and reactive to player choices. Keep responses under 150 words. Always end with "What do you do?"

When a player's message contains a dice roll in brackets like [Rolled d20: **17**], narrate the outcome based on the result:
- 1 (Fumble): Something goes badly wrong — dramatic failure with real consequences
- 2-9: Failure or significant complication
- 10-14: Partial success, or success with a cost
- 15-19: Clear success
- 20 (Critical Hit): Exceptional, memorable success beyond all expectations

Player character: ${character.name || "Adventurer"}, ${character.race || ""} ${character.class || ""}${character.background ? `, Background: ${character.background}` : ""}`.trim();

  const apiMessages = messages
    .filter((m) => m.role === "player")
    .map((m) => ({ role: "user", content: m.text }));

  if (apiMessages.length === 0) {
    return res.status(400).json({ error: "No player messages provided" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: systemPrompt,
      messages: apiMessages,
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("Claude API error:", err?.message);
    res.write(`data: ${JSON.stringify({ error: "An error occurred. Please try again." })}\n\n`);
    res.end();
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
