import { useState } from "react";
import { resolveStep, createCampaignState, goToStep, useItem } from "../game/campaignEngine";

// ── Item type styles ──────────────────────────────────────────────────────────

const ITEM_TYPE_STYLES = {
  Weapon:     { badge: "bg-red-950 border-red-800 text-red-400",      icon: "⚔️" },
  Consumable: { badge: "bg-green-950 border-green-800 text-green-400", icon: "🧪" },
  Misc:       { badge: "bg-zinc-800 border-zinc-700 text-zinc-400",    icon: "📦" },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function HpBar({ current, max, color = "bg-green-500" }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const barColor = pct <= 25 ? "bg-red-500" : pct <= 50 ? "bg-amber-500" : color;
  return (
    <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function EnemyPanel({ enemy, step }) {
  const name  = enemy?.name ?? step.enemy?.name ?? "Enemy";
  const hp    = enemy?.hp   ?? 0;
  const maxHp = enemy?.maxHp ?? step.enemy?.hp ?? 1;
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-zinc-500">Enemy</span>
        <span className="text-xs font-mono text-red-400">{hp} / {maxHp} HP</span>
      </div>
      <p className="font-bold text-white text-sm">{name}</p>
      <HpBar current={hp} max={maxHp} color="bg-red-500" />
    </div>
  );
}

function DiceDisplay({ lastRoll }) {
  if (!lastRoll) return null;
  const isDefend = lastRoll.action === "defend";

  const playerColor = isDefend
    ? "text-blue-300"
    : lastRoll.isCrit    ? "text-yellow-300"
    : lastRoll.isFumble  ? "text-red-400"
    : lastRoll.playerHit ? "text-green-400"
    :                      "text-zinc-500";

  const playerLabel = isDefend
    ? "STANCE"
    : lastRoll.isCrit    ? "CRIT"
    : lastRoll.isFumble  ? "FUMBLE"
    : lastRoll.playerHit ? "HIT"
    :                      "MISS";

  const enemyColor = lastRoll.enemyResult === "miss"  ? "text-zinc-500"
                   : lastRoll.enemyResult === "heavy" ? "text-orange-400"
                   :                                    "text-red-400";

  const enemyLabel = lastRoll.enemyResult === "miss"  ? "MISS"
                   : lastRoll.enemyResult === "heavy" ? "HEAVY"
                   :                                    "HIT";

  return (
    <div className="flex gap-3">
      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col items-center justify-center py-4 gap-1">
        <span className="text-xs uppercase tracking-widest text-zinc-500">{isDefend ? "🛡️ You" : "⚔️ You"}</span>
        <span className={`text-5xl font-black leading-none ${playerColor}`}>{isDefend ? "—" : lastRoll.playerRoll}</span>
        <span className={`text-xs font-bold tracking-widest ${playerColor}`}>{playerLabel}</span>
      </div>
      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col items-center justify-center py-4 gap-1">
        <span className="text-xs uppercase tracking-widest text-zinc-500">👺 Enemy</span>
        <span className={`text-5xl font-black leading-none ${enemyColor}`}>{lastRoll.enemyRoll || "—"}</span>
        <span className={`text-xs font-bold tracking-widest ${enemyColor}`}>{lastRoll.enemyRoll ? enemyLabel : "MISS"}</span>
      </div>
    </div>
  );
}

function CombatLog({ lines }) {
  if (!lines || lines.length === 0) return null;
  const recent = lines.slice(-5);
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 flex flex-col gap-1">
      {recent.map((line, i) => (
        <p key={i} className={`text-xs font-mono transition-all duration-200 ${i === recent.length - 1 ? "text-zinc-300" : "text-zinc-600"}`}>
          {line}
        </p>
      ))}
    </div>
  );
}

function PlayerPanel({ player }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-zinc-500">You</span>
        <div className="flex items-center gap-2">
          {player.equippedWeapon && (
            <span className="text-[10px] text-red-400 font-mono">⚔️ {player.attack} atk</span>
          )}
          <span className={`text-xs font-mono ${player.hp <= 5 ? "text-red-400" : "text-green-400"}`}>
            {player.hp} / {player.maxHp ?? 20} HP
          </span>
        </div>
      </div>
      <HpBar current={player.hp} max={player.maxHp ?? 20} />
    </div>
  );
}

function ActionBar({ onAttack, onDefend, onHeavy, loading }) {
  const btn = "flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-2xl font-bold transition-all duration-200 cursor-pointer disabled:opacity-40 active:scale-95";
  return (
    <div className="flex gap-2">
      <button onClick={onAttack} disabled={loading} className={`${btn} bg-red-900 hover:bg-red-800 text-white`}>
        <span className="text-xl">⚔️</span>
        <span className="text-xs tracking-wide">Attack</span>
        <span className="text-[10px] text-red-300/70">Standard</span>
      </button>
      <button onClick={onHeavy} disabled={loading} className={`${btn} bg-orange-900 hover:bg-orange-800 text-white`}>
        <span className="text-xl">💥</span>
        <span className="text-xs tracking-wide">Heavy</span>
        <span className="text-[10px] text-orange-300/70">−3 to hit, ×2 dmg</span>
      </button>
      <button onClick={onDefend} disabled={loading} className={`${btn} bg-blue-900 hover:bg-blue-800 text-white`}>
        <span className="text-xl">🛡️</span>
        <span className="text-xs tracking-wide">Defend</span>
        <span className="text-[10px] text-blue-300/70">Halve incoming</span>
      </button>
    </div>
  );
}

function NarrationBox({ text }) {
  if (!text) return null;
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-3">
      <p className="text-zinc-300 text-sm leading-relaxed font-serif line-clamp-3">{text}</p>
    </div>
  );
}

function InventoryItemRow({ item, player, isCombat, onUseItem }) {
  const styles  = ITEM_TYPE_STYLES[item.type] ?? ITEM_TYPE_STYLES.Misc;
  const isEquipped = player.equippedWeapon === item.name;

  return (
    <div className={`flex items-start justify-between gap-2 rounded-xl px-3 py-2.5 border ${
      isEquipped ? "bg-red-950/20 border-red-900" : "bg-black border-zinc-800"
    }`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-white text-xs font-semibold">{item.name}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-mono ${styles.badge}`}>
            {styles.icon} {item.type}
          </span>
          {isEquipped && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-950 border border-amber-800 text-amber-400 font-mono">
              Equipped
            </span>
          )}
        </div>
        <p className="text-zinc-500 text-[11px] mt-0.5 leading-snug">{item.desc}</p>
      </div>

      {item.type === "Consumable" && item.effect && (
        <button
          onClick={() => onUseItem(item.name)}
          className="flex-shrink-0 text-[11px] px-2.5 py-1.5 rounded-lg bg-green-900 hover:bg-green-800 border border-green-700 text-green-300 font-semibold transition-colors cursor-pointer"
        >
          Use
        </button>
      )}
      {item.type === "Weapon" && item.effect && !isEquipped && (
        isCombat ? (
          <span className="flex-shrink-0 text-[10px] text-zinc-600 italic self-center whitespace-nowrap">
            out of combat
          </span>
        ) : (
          <button
            onClick={() => onUseItem(item.name)}
            className="flex-shrink-0 text-[11px] px-2.5 py-1.5 rounded-lg bg-red-900 hover:bg-red-800 border border-red-700 text-red-300 font-semibold transition-colors cursor-pointer"
          >
            Equip
          </button>
        )
      )}
    </div>
  );
}

function InventoryPanel({ player, onUseItem, isCombat }) {
  const [isOpen, setIsOpen] = useState(false);
  const items      = player.inventory ?? [];
  const weapons    = items.filter(i => i.type === "Weapon");
  const consumables= items.filter(i => i.type === "Consumable");
  const misc       = items.filter(i => i.type === "Misc");

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => setIsOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🎒</span>
          <span className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">Inventory</span>
          <span className="text-xs text-zinc-600 font-mono">({items.length})</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-amber-400 text-xs font-mono">🪙 {player.gold ?? 0}</span>
          {player.equippedWeapon && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-950 border border-red-800 text-red-400 font-mono">
              ⚔️ {player.equippedWeapon}
            </span>
          )}
          <span className="text-zinc-600 text-xs">{isOpen ? "▲" : "▼"}</span>
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-zinc-800 px-4 py-3 flex flex-col gap-3">
          {items.length === 0 && (
            <p className="text-zinc-600 text-sm text-center py-2">Your pack is empty.</p>
          )}
          {[
            { label: "Weapons",     list: weapons },
            { label: "Consumables", list: consumables },
            { label: "Misc",        list: misc },
          ].map(({ label, list }) => list.length > 0 && (
            <div key={label}>
              <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">{label}</p>
              <div className="flex flex-col gap-2">
                {list.map(item => (
                  <InventoryItemRow
                    key={item.name}
                    item={item}
                    player={player}
                    isCombat={isCombat}
                    onUseItem={onUseItem}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BattleRecap({ transition, onContinue, onRetry, onBack }) {
  const { outcome, battleStats, battleLog, narration } = transition;
  const isVictory = outcome === "victory";

  return (
    <div className="flex flex-col gap-3">
      <div className={`rounded-2xl px-5 py-4 text-center border ${
        isVictory ? "bg-green-950/40 border-green-800" : "bg-red-950/40 border-red-900"
      }`}>
        <p className="text-2xl mb-1">{isVictory ? "⚔️" : "💀"}</p>
        <p className={`text-lg font-black tracking-widest uppercase ${isVictory ? "text-green-300" : "text-red-400"}`}>
          {isVictory ? "Victory" : "Defeated"}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col items-center py-3 gap-0.5">
          <span className="text-xl font-black text-red-400">{battleStats.dealt}</span>
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Dealt</span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col items-center py-3 gap-0.5">
          <span className="text-xl font-black text-amber-400">{battleStats.taken}</span>
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Taken</span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col items-center py-3 gap-0.5">
          <span className="text-xl font-black text-zinc-300">{battleStats.rounds}</span>
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Rounds</span>
        </div>
      </div>

      {(battleStats.crits > 0 || battleStats.fumbles > 0) && (
        <div className="flex gap-2">
          {battleStats.crits > 0 && (
            <span className="text-xs px-3 py-1.5 rounded-full bg-yellow-950 border border-yellow-800 text-yellow-300 font-mono">
              ⚡ {battleStats.crits} crit{battleStats.crits > 1 ? "s" : ""}
            </span>
          )}
          {battleStats.fumbles > 0 && (
            <span className="text-xs px-3 py-1.5 rounded-full bg-red-950 border border-red-900 text-red-400 font-mono">
              💀 {battleStats.fumbles} fumble{battleStats.fumbles > 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 flex flex-col gap-1 max-h-40 overflow-y-auto">
        <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">Battle Log</p>
        {battleLog.map((line, i) => (
          <p key={i} className="text-xs font-mono text-zinc-400">{line}</p>
        ))}
      </div>

      {narration && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-3">
          <p className="text-zinc-300 text-sm leading-relaxed font-serif">{narration}</p>
        </div>
      )}

      {isVictory ? (
        <button onClick={onContinue} className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition-colors cursor-pointer">
          Continue →
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <button onClick={onRetry} className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition-colors cursor-pointer">
            Try Again
          </button>
          <button onClick={onBack} className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 font-semibold rounded-xl transition-colors cursor-pointer">
            ← Back to Menu
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

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

  function handleUseItem(itemName) {
    setGameState(prev => useItem(prev, itemName));
  }

  const { lastRoll, combatLog } = gameState;
  const isCombat = step.type === "combat";

  return (
    <div className="min-h-screen bg-black text-white flex flex-col px-4 py-5 gap-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center text-lg cursor-pointer hover:bg-zinc-800 transition-colors">
          🔥
        </button>
        <div className="text-right">
          <p className="text-zinc-500 text-xs uppercase tracking-widest">{step.type}</p>
          <h2 className="text-base font-serif font-bold">{step.title}</h2>
        </div>
      </div>

      {/* ── BATTLE RECAP ─────────────────────────────────────────────────────── */}
      {gameState.pendingTransition && (
        <BattleRecap
          transition={gameState.pendingTransition}
          onContinue={() => setGameState(prev => goToStep(prev, prev.pendingTransition.nextStep))}
          onRetry={() => setGameState(createCampaignState(gameState.campaign))}
          onBack={onBack}
        />
      )}

      {/* ── COMBAT LAYOUT ────────────────────────────────────────────────────── */}
      {isCombat && !gameState.pendingTransition && !gameState.gameOver && (
        <>
          <EnemyPanel enemy={gameState.enemy} step={step} />
          <DiceDisplay lastRoll={lastRoll} />
          <CombatLog lines={combatLog} />
          <PlayerPanel player={gameState.player} />
          <ActionBar
            onAttack={() => handleAction("I attack!")}
            onDefend={() => handleAction("I defend!")}
            onHeavy={()  => handleAction("heavy attack!")}
            loading={loading}
          />
          {loading && (
            <p className="text-center text-zinc-600 text-xs animate-pulse">Resolving turn…</p>
          )}

          <InventoryPanel player={gameState.player} onUseItem={handleUseItem} isCombat={true} />

          <NarrationBox text={gameState.narration} />
        </>
      )}

      {/* ── NON-COMBAT LAYOUTS ───────────────────────────────────────────────── */}
      {!isCombat && !gameState.pendingTransition && (
        <>
          {/* Narrative text */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-zinc-200 leading-relaxed font-serif">
            {(gameState.narration ?? step.text).split("\n\n").map((p, i) => (
              <p key={i} className="mb-2 last:mb-0">{p}</p>
            ))}
          </div>

          {/* Loot cards */}
          {step.type === "loot" && step.loot && (
            <div className="flex flex-col gap-2">
              {step.loot.gold > 0 && (
                <div className="flex items-center gap-3 bg-yellow-950/30 border border-yellow-900/60 rounded-2xl px-4 py-3">
                  <span className="text-2xl">🪙</span>
                  <div>
                    <p className="text-yellow-300 font-bold text-sm">+{step.loot.gold} Gold</p>
                    <p className="text-yellow-700 text-xs">Added to your purse</p>
                  </div>
                </div>
              )}
              {(step.loot.items ?? []).map((item, i) => {
                const styles = ITEM_TYPE_STYLES[item.type] ?? ITEM_TYPE_STYLES.Misc;
                return (
                  <div key={i} className="flex items-start gap-3 bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-3">
                    <span className="text-2xl mt-0.5">{styles.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-bold text-sm">{item.name}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${styles.badge}`}>
                          {item.type}
                        </span>
                      </div>
                      <p className="text-zinc-400 text-xs mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Loot continue */}
          {step.type === "loot" && (
            <button
              onClick={() => handleChoice(step.next)}
              className="w-full py-3 bg-zinc-900 border border-zinc-700 hover:border-amber-500 hover:bg-zinc-800 text-zinc-200 font-semibold rounded-xl transition-colors cursor-pointer"
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

          {/* Exploration input */}
          {step.type === "exploration" && !gameState.gameOver && (
            <div className="flex gap-2">
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

          {/* Inventory (all non-combat, non-end screens) */}
          {!gameState.gameOver && (
            <InventoryPanel player={gameState.player} onUseItem={handleUseItem} isCombat={false} />
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
        </>
      )}

    </div>
  );
}
