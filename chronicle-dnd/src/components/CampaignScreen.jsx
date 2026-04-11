import { useState } from "react";
import { resolveStep } from "../game/campaignEngine";

export default function CampaignScreen({ gameState, setGameState, onBack }) {
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");

  const step = gameState.campaign.steps[gameState.currentStep];

  function handleChoice(nextStep) {
    setGameState(prev => ({ ...prev, currentStep: nextStep }));
  }

  async function handleAction() {
    if (!input.trim() || loading) return;
    setLoading(true);
    const next = await resolveStep(gameState, input.trim());
    setGameState(next);
    setInput("");
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col px-5 py-6 gap-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center text-lg cursor-pointer hover:bg-zinc-800 transition-colors">🔥</button>
        <div className="text-right">
          <p className="text-zinc-500 text-xs uppercase tracking-widest">{step.type}</p>
          <h2 className="text-base font-serif font-bold">{step.title}</h2>
        </div>
      </div>

      {/* Narrative text */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-zinc-200 leading-relaxed font-serif">
        {(gameState.narration ?? step.text).split("\n\n").map((p, i) => (
          <p key={i} className="mb-2 last:mb-0">{p}</p>
        ))}
      </div>

      {/* Player / enemy HP strip — shown during combat */}
      {step.type === "combat" && (
        <div className="flex gap-3 text-sm">
          <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 flex justify-between">
            <span className="text-zinc-500">You</span>
            <span className={`font-bold ${gameState.player.hp <= 5 ? "text-red-400" : "text-green-400"}`}>
              {gameState.player.hp} HP
            </span>
          </div>
          {gameState.enemy && (
            <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 flex justify-between">
              <span className="text-zinc-500 truncate mr-2">{gameState.enemy.name}</span>
              <span className="font-bold text-red-400">{gameState.enemy.hp} HP</span>
            </div>
          )}
        </div>
      )}

      {/* Choice buttons */}
      {step.type === "choice" && step.choices.map(choice => (
        <button
          key={choice.next}
          onClick={() => handleChoice(choice.next)}
          className="w-full text-left px-4 py-3 bg-zinc-900 border border-zinc-800 hover:border-amber-500 hover:bg-zinc-800 rounded-xl text-zinc-200 transition-colors cursor-pointer"
        >
          {choice.text}
        </button>
      ))}

      {/* Free-text input — combat and exploration */}
      {(step.type === "combat" || step.type === "exploration") && !gameState.gameOver && (
        <div className="flex gap-2 mt-auto">
          <input
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
            placeholder={step.type === "combat" ? "What do you do in combat?" : "What do you do?"}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAction()}
            disabled={loading}
          />
          <button
            onClick={handleAction}
            disabled={loading || !input.trim()}
            className="px-4 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold rounded-xl transition-colors cursor-pointer"
          >
            {loading ? "…" : "▶"}
          </button>
        </div>
      )}

      {/* End state */}
      {gameState.gameOver && (
        <div className="text-center mt-4">
          <p className="text-zinc-500 text-sm mb-3">
            {step.outcome === "victory" ? "🏆 Campaign complete" : "💀 Defeated"}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl cursor-pointer transition-colors"
          >
            Play Again
          </button>
        </div>
      )}

    </div>
  );
}
