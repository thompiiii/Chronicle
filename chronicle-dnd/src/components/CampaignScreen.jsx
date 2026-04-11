import { useState } from "react";
import { resolveStep, createCampaignState, goToStep } from "../game/campaignEngine";

export default function CampaignScreen({ gameState, setGameState, onBack }) {
  const [loading, setLoading] = useState(false);
  const [input, setInput]     = useState("");

  const step = gameState.campaign.steps[gameState.currentStep];

  function handleChoice(nextStep) {
    setGameState(prev => goToStep(prev, nextStep));
  }

  async function handleAction(overrideInput) {
    const text = (overrideInput ?? input).trim();
    if (!text || loading) return;
    setLoading(true);
    const next = await resolveStep(gameState, text);
    setGameState(next);
    setInput("");
    setLoading(false);
  }

  const { lastRoll, combatLog } = gameState;

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

      {/* Roll badges — shown after a combat round */}
      {lastRoll && step.type === "combat" && (
        <div className="flex gap-2">
          {lastRoll.action === "defend" ? (
            <div className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-mono text-blue-300 border-blue-800 bg-blue-950/40">
              🛡️ Defensive stance — incoming halved
            </div>
          ) : (
            <div className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-mono ${
              lastRoll.isCrit   ? "text-yellow-300 border-yellow-700 bg-yellow-950/40" :
              lastRoll.isFumble ? "text-red-400 border-red-900 bg-red-950/40" :
              lastRoll.playerHit ? "text-green-400 border-green-900 bg-green-950/40" :
                                   "text-zinc-400 border-zinc-800 bg-zinc-950/40"
            }`}>
              {lastRoll.isCrit ? "⚡" : lastRoll.isFumble ? "💀" : "⚔️"} {lastRoll.playerRoll} — {lastRoll.isCrit ? "CRIT" : lastRoll.isFumble ? "FUMBLE" : lastRoll.playerHit ? "HIT" : "MISS"}
            </div>
          )}
          <div className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-mono ${
            lastRoll.enemyResult === "miss"  ? "text-zinc-400 border-zinc-800 bg-zinc-950/40" :
            lastRoll.enemyResult === "heavy" ? "text-orange-400 border-orange-900 bg-orange-950/40" :
                                               "text-red-400 border-red-900 bg-red-950/40"
          }`}>
            👺 {lastRoll.enemyRoll} — {lastRoll.enemyResult === "miss" ? "MISS" : lastRoll.enemyResult === "heavy" ? "HEAVY HIT" : "HIT"}
          </div>
        </div>
      )}

      {/* HP strip — combat only */}
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

      {/* Narrative text */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-zinc-200 leading-relaxed font-serif">
        {(gameState.narration ?? step.text).split("\n\n").map((p, i) => (
          <p key={i} className="mb-2 last:mb-0">{p}</p>
        ))}
      </div>

      {/* Combat log — most recent turn */}
      {combatLog && combatLog.length > 0 && step.type === "combat" && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 flex flex-col gap-1">
          {combatLog.map((line, i) => (
            <p key={i} className="text-xs font-mono text-zinc-400">{line}</p>
          ))}
        </div>
      )}

      {/* Loot items */}
      {step.type === "loot" && step.loot && (
        <div className="flex flex-wrap gap-2">
          {step.loot.gold > 0 && (
            <span className="text-xs px-3 py-1.5 rounded-full bg-yellow-950 border border-yellow-800 text-yellow-300 font-mono">
              +{step.loot.gold} gold
            </span>
          )}
          {(step.loot.items ?? []).map((item, i) => (
            <span key={i} className="text-xs px-3 py-1.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300">
              {item.name}
            </span>
          ))}
        </div>
      )}

      {/* Loot continue */}
      {step.type === "loot" && (
        <button
          onClick={() => handleChoice(step.next)}
          className="w-full py-3 bg-zinc-900 border border-zinc-700 hover:border-amber-500 hover:bg-zinc-800 text-zinc-200 font-semibold rounded-xl transition-colors cursor-pointer mt-auto"
        >
          Continue →
        </button>
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

      {/* Combat actions */}
      {step.type === "combat" && !gameState.gameOver && (
        <div className="flex flex-col gap-2 mt-auto">
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleAction("I attack!")}
              disabled={loading}
              className="py-3 bg-red-900 hover:bg-red-800 disabled:opacity-40 text-white font-bold rounded-xl transition-colors cursor-pointer text-sm tracking-wide flex flex-col items-center gap-0.5"
            >
              <span>⚔️</span>
              <span className="text-xs">Attack</span>
            </button>
            <button
              onClick={() => handleAction("I defend!")}
              disabled={loading}
              className="py-3 bg-blue-900 hover:bg-blue-800 disabled:opacity-40 text-white font-bold rounded-xl transition-colors cursor-pointer text-sm tracking-wide flex flex-col items-center gap-0.5"
            >
              <span>🛡️</span>
              <span className="text-xs">Defend</span>
            </button>
            <button
              onClick={() => handleAction("heavy attack!")}
              disabled={loading}
              className="py-3 bg-orange-900 hover:bg-orange-800 disabled:opacity-40 text-white font-bold rounded-xl transition-colors cursor-pointer text-sm tracking-wide flex flex-col items-center gap-0.5"
            >
              <span>💥</span>
              <span className="text-xs">Heavy</span>
            </button>
          </div>
          {loading && (
            <p className="text-center text-zinc-500 text-xs animate-pulse">Resolving…</p>
          )}
        </div>
      )}

      {/* Exploration input */}
      {step.type === "exploration" && !gameState.gameOver && (
        <div className="flex gap-2 mt-auto">
          <input
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
            placeholder="What do you do?"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAction()}
            disabled={loading}
          />
          <button
            onClick={() => handleAction()}
            disabled={loading || !input.trim()}
            className="px-4 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold rounded-xl transition-colors cursor-pointer"
          >
            {loading ? "…" : "▶"}
          </button>
        </div>
      )}

      {/* End state */}
      {gameState.gameOver && (
        <div className="flex flex-col gap-3 mt-4">
          <p className="text-center text-zinc-500 text-sm">
            {step.outcome === "victory" ? "🏆 Campaign complete" : "💀 Defeated"}
          </p>
          <button
            onClick={() => setGameState(createCampaignState(gameState.campaign))}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl cursor-pointer transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={onBack}
            className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 font-semibold rounded-xl cursor-pointer transition-colors"
          >
            ← Back to Menu
          </button>
        </div>
      )}

    </div>
  );
}
