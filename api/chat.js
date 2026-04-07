import Anthropic from "@anthropic-ai/sdk";

export const config = {
  api: {
    responseLimit: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { messages = [], character = {} } = req.body;

  const systemPrompt = `You are a Dungeon Master running a D&D 5e campaign. Be vivid, atmospheric, and reactive to player choices. Keep responses under 150 words. Always end with "What do you do?"

Player character: ${character.name || "Adventurer"}, ${character.race || ""} ${character.class || ""}`.trim();

  const apiMessages = messages
    .filter((m) => m.role === "player")
    .map((m) => ({ role: "user", content: m.text }));

  if (apiMessages.length === 0) {
    return res.status(400).json({ error: "No player messages provided" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
    const msg = err instanceof Anthropic.APIError ? err.message : "Unexpected error";
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    res.end();
  }
}
