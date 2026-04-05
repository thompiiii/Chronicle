import "dotenv/config";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";

const app = express();
app.use(express.json());

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /api/chat
// Body: { messages: [{ role, text }], character: { name, class, race } }
// Streams the DM response back as plain text chunks (SSE).
app.post("/api/chat", async (req, res) => {
  const { messages = [], character = {} } = req.body;

  const systemPrompt = `You are a Dungeon Master running a D&D 5e campaign. Be vivid, atmospheric, and reactive to player choices. Keep responses under 150 words. Always end with "What do you do?"

Player character: ${character.name || "Adventurer"}, ${character.race || ""} ${character.class || ""}`.trim();

  const apiMessages = messages
    .filter((m) => m.role === "player" && !m.isRoll)
    .map((m) => ({ role: "user", content: m.text }));

  // Need at least one message
  if (apiMessages.length === 0) {
    return res.status(400).json({ error: "No player messages provided" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = client.messages.stream({
      model: "claude-opus-4-6",
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
    if (err instanceof Anthropic.APIError) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({ error: "Unexpected error" })}\n\n`);
    }
    res.end();
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
