import { useState } from "react";
import { resolveStep, createCampaignState, goToStep, useItem as applyCampaignItem, unequipWeapon } from "../game/campaignEngine";

// ── Sub-components ────────────────────────────────────────────────────────────

function HpBar({ current, max }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const cls = pct <= 25 ? "red" : pct <= 50 ? "amber" : "";
  return (
    <div className="c-hp-track" style={{ height: 4 }}>
      <div className={`c-hp-fill${cls ? " " + cls : ""}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function EnemyPanel({ enemy, step }) {
  const name  = enemy?.name ?? step.enemy?.name ?? "Enemy";
  const hp    = enemy?.hp   ?? 0;
  const maxHp = enemy?.maxHp ?? step.enemy?.hp ?? 1;
  return (
    <div style={{ background: "var(--c-surface2)", border: "1px solid var(--c-border)", borderRadius: 6, padding: "0.65rem 0.85rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--c-text-muted)" }}>Enemy</span>
        <span style={{ fontSize: "0.65rem", fontFamily: "monospace", color: "var(--c-red-bright)" }}>{hp} / {maxHp} HP</span>
      </div>
      <p style={{ margin: 0, fontWeight: 700, color: "var(--c-text)", fontSize: "0.9rem" }}>{name}</p>
      <HpBar current={hp} max={maxHp} />
    </div>
  );
}

function DiceDisplay({ lastRoll }) {
  if (!lastRoll) return null;
  const isDefend = lastRoll.action === "defend";

  const playerColor = isDefend ? "#6a88d8"
    : lastRoll.isCrit    ? "var(--c-accent)"
    : lastRoll.isFumble  ? "var(--c-red-bright)"
    : lastRoll.playerHit ? "#4ab060"
    :                      "var(--c-text-muted)";

  const playerLabel = isDefend ? "STANCE"
    : lastRoll.isCrit    ? "CRIT"
    : lastRoll.isFumble  ? "FUMBLE"
    : lastRoll.playerHit ? "HIT"
    :                      "MISS";

  const enemyColor = lastRoll.enemyResult === "miss"  ? "var(--c-text-muted)"
                   : lastRoll.enemyResult === "heavy" ? "#c8883a"
                   :                                    "var(--c-red-bright)";

  const enemyLabel = lastRoll.enemyResult === "miss"  ? "MISS"
                   : lastRoll.enemyResult === "heavy" ? "HEAVY"
                   :                                    "HIT";

  return (
    <div style={{ display: "flex", gap: "0.5rem" }}>
      <div style={{ flex: 1, background: "var(--c-surface2)", border: "1px solid var(--c-border)", borderRadius: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0.85rem 0.5rem", gap: "0.2rem" }}>
        <span style={{ fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--c-text-muted)" }}>{isDefend ? "🛡️ You" : "⚔️ You"}</span>
        <span style={{ fontSize: "3rem", fontWeight: 900, lineHeight: 1, color: playerColor }}>{isDefend ? "—" : lastRoll.playerRoll}</span>
        <span style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", color: playerColor }}>{playerLabel}</span>
      </div>
      <div style={{ flex: 1, background: "var(--c-surface2)", border: "1px solid var(--c-border)", borderRadius: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0.85rem 0.5rem", gap: "0.2rem" }}>
        <span style={{ fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--c-text-muted)" }}>👺 Enemy</span>
        <span style={{ fontSize: "3rem", fontWeight: 900, lineHeight: 1, color: enemyColor }}>{lastRoll.enemyRoll || "—"}</span>
        <span style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", color: enemyColor }}>{lastRoll.enemyRoll ? enemyLabel : "MISS"}</span>
      </div>
    </div>
  );
}

function CombatLog({ lines }) {
  if (!lines || lines.length === 0) return null;
  const recent = lines.slice(-5);
  return (
    <div style={{ background: "var(--c-bg)", border: "1px solid var(--c-border)", borderRadius: 6, padding: "0.6rem 0.85rem", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
      {recent.map((line, i) => (
        <p key={i} style={{ margin: 0, fontSize: "0.65rem", fontFamily: "monospace", color: i === recent.length - 1 ? "var(--c-text-dim)" : "var(--c-text-muted)" }}>
          {line}
        </p>
      ))}
    </div>
  );
}

function PlayerPanel({ player }) {
  return (
    <div style={{ background: "var(--c-surface2)", border: "1px solid var(--c-border)", borderRadius: 6, padding: "0.65rem 0.85rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--c-text-muted)" }}>You</span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {player.equippedWeapon && (
            <span style={{ fontSize: "0.6rem", fontFamily: "monospace", color: "var(--c-red-bright)" }}>⚔️ {player.attack} atk</span>
          )}
          <span style={{ fontSize: "0.65rem", fontFamily: "monospace", color: player.hp <= 5 ? "var(--c-red-bright)" : "#4ab060" }}>
            {player.hp} / {player.maxHp ?? 20} HP
          </span>
        </div>
      </div>
      <HpBar current={player.hp} max={player.maxHp ?? 20} />
    </div>
  );
}

function StatusBadges({ statuses }) {
  if (!statuses || statuses.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", paddingTop: "0.2rem" }}>
      {statuses.map((s, i) => {
        const colors = {
          guard:   { bg: "rgba(50,100,200,0.15)",  border: "rgba(50,100,200,0.45)",  text: "#7090e8" },
          stagger: { bg: "rgba(200,150,0,0.15)",   border: "rgba(200,150,0,0.45)",   text: "#e8c060" },
          bleed:   { bg: "rgba(200,0,0,0.15)",     border: "rgba(200,0,0,0.45)",     text: "#e87070" },
        }[s.type] ?? { bg: "var(--c-surface2)", border: "var(--c-border)", text: "var(--c-text-muted)" };
        const icon = { guard: "🛡️", stagger: "💫", bleed: "🩸" }[s.type] ?? "●";
        return (
          <span key={i} style={{ fontSize: "0.55rem", padding: "0.1rem 0.45rem", borderRadius: 10,
            background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}>
            {icon} {s.type}{s.turns > 0 ? ` (${s.turns})` : ""}
          </span>
        );
      })}
    </div>
  );
}

function ActionBar({ onAttack, onDefend, onHeavy, loading, isV2 }) {
  return (
    <div style={{ display: "flex", gap: "0.4rem" }}>
      <button onClick={onAttack} disabled={loading} className="c-encounter-btn c-encounter-btn-attack">
        <span style={{ fontSize: "1.1rem" }}>⚔️</span>
        <span>Attack</span>
        <span style={{ fontSize: "0.55rem", opacity: 0.7 }}>Standard</span>
      </button>
      <button onClick={onHeavy} disabled={loading} className="c-encounter-btn c-encounter-btn-heavy">
        <span style={{ fontSize: "1.1rem" }}>💥</span>
        <span>Heavy</span>
        <span style={{ fontSize: "0.55rem", opacity: 0.7 }}>{isV2 ? "−3 hit, ×2, stagger" : "−3 hit, ×2 dmg"}</span>
      </button>
      <button onClick={onDefend} disabled={loading} className="c-encounter-btn c-encounter-btn-defend">
        <span style={{ fontSize: "1.1rem" }}>🛡️</span>
        <span>Defend</span>
        <span style={{ fontSize: "0.55rem", opacity: 0.7 }}>{isV2 ? "Guard + +2 next roll" : "Halve incoming"}</span>
      </button>
    </div>
  );
}

function NarrationBox({ text }) {
  if (!text) return null;
  return (
    <div className="c-narration" style={{ fontSize: "0.95rem", lineHeight: 1.7 }}>
      {text}
    </div>
  );
}

function InventoryItemRow({ item, player, isCombat, onUseItem, onUnequip }) {
  const isEquipped = player.equippedWeapon === item.name;
  const typeColor = item.type === "Weapon" ? "var(--c-red-bright)" : item.type === "Consumable" ? "#4ab060" : "var(--c-text-muted)";

  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem", borderRadius: 4, padding: "0.5rem 0.65rem", background: isEquipped ? "rgba(200,169,110,0.05)" : "var(--c-bg)", border: `1px solid ${isEquipped ? "var(--c-accent-dim)" : "var(--c-border)"}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
          <span style={{ color: "var(--c-text)", fontSize: "0.82rem", fontWeight: 600 }}>{item.name}</span>
          <span style={{ fontSize: "0.55rem", padding: "0.1rem 0.4rem", borderRadius: 10, border: `1px solid ${typeColor}`, color: typeColor, opacity: 0.8 }}>
            {item.type === "Weapon" ? "⚔️" : item.type === "Consumable" ? "🧪" : "📦"} {item.type}
          </span>
          {isEquipped && (
            <span style={{ fontSize: "0.55rem", padding: "0.1rem 0.4rem", borderRadius: 10, background: "rgba(200,169,110,0.1)", border: "1px solid var(--c-accent-dim)", color: "var(--c-accent)" }}>
              Equipped
            </span>
          )}
        </div>
        <p style={{ margin: 0, color: "var(--c-text-muted)", fontSize: "0.68rem", marginTop: "0.15rem" }}>{item.desc}</p>
      </div>

      {item.type === "Consumable" && item.effect && (
        <button onClick={() => onUseItem(item.name)}
          style={{ flexShrink: 0, fontSize: "0.65rem", padding: "0.25rem 0.6rem", borderRadius: 4, background: "rgba(40,100,50,0.35)", border: "1px solid rgba(40,100,50,0.6)", color: "#4ab060", fontWeight: 600, cursor: "pointer" }}>
          Use
        </button>
      )}
      {item.type === "Weapon" && item.effect && (
        isEquipped ? (
          isCombat ? (
            <span style={{ flexShrink: 0, fontSize: "0.6rem", color: "var(--c-text-muted)", fontStyle: "italic", alignSelf: "center", whiteSpace: "nowrap" }}>out of combat</span>
          ) : (
            <button onClick={onUnequip}
              style={{ flexShrink: 0, fontSize: "0.65rem", padding: "0.25rem 0.6rem", borderRadius: 4, background: "var(--c-surface2)", border: "1px solid var(--c-border)", color: "var(--c-text-dim)", fontWeight: 600, cursor: "pointer" }}>
              Unequip
            </button>
          )
        ) : (
          isCombat ? (
            <span style={{ flexShrink: 0, fontSize: "0.6rem", color: "var(--c-text-muted)", fontStyle: "italic", alignSelf: "center", whiteSpace: "nowrap" }}>out of combat</span>
          ) : (
            <button onClick={() => onUseItem(item.name)}
              style={{ flexShrink: 0, fontSize: "0.65rem", padding: "0.25rem 0.6rem", borderRadius: 4, background: "rgba(155,48,48,0.35)", border: "1px solid rgba(155,48,48,0.6)", color: "#e87070", fontWeight: 600, cursor: "pointer" }}>
              Equip
            </button>
          )
        )
      )}
    </div>
  );
}

function InventoryPanel({ player, onUseItem, isCombat, onUnequip }) {
  const [isOpen, setIsOpen] = useState(false);
  const items      = player.inventory ?? [];
  const weapons    = items.filter(i => i.type === "Weapon");
  const consumables= items.filter(i => i.type === "Consumable");
  const misc       = items.filter(i => i.type === "Misc");

  return (
    <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 6, overflow: "hidden" }}>
      <button onClick={() => setIsOpen(o => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 0.85rem", cursor: "pointer", background: "none", border: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>🎒</span>
          <span style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--c-text-dim)", fontFamily: "'Cinzel', serif" }}>Inventory</span>
          <span style={{ fontSize: "0.65rem", fontFamily: "monospace", color: "var(--c-text-muted)" }}>({items.length})</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ color: "var(--c-accent)", fontSize: "0.8rem", fontFamily: "monospace" }}>🪙 {player.gold ?? 0}</span>
          {player.equippedWeapon && (
            <span style={{ fontSize: "0.55rem", padding: "0.1rem 0.4rem", borderRadius: 10, background: "rgba(155,48,48,0.15)", border: "1px solid rgba(155,48,48,0.4)", color: "#e87070" }}>
              ⚔️ {player.equippedWeapon}
            </span>
          )}
          <span style={{ color: "var(--c-text-muted)", fontSize: "0.65rem" }}>{isOpen ? "▲" : "▼"}</span>
        </div>
      </button>

      {isOpen && (
        <div style={{ borderTop: "1px solid var(--c-border)", padding: "0.65rem 0.85rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {items.length === 0 && (
            <p style={{ color: "var(--c-text-muted)", fontSize: "0.85rem", textAlign: "center", padding: "0.25rem 0", margin: 0 }}>Your pack is empty.</p>
          )}
          {[
            { label: "Weapons",     list: weapons },
            { label: "Consumables", list: consumables },
            { label: "Misc",        list: misc },
          ].map(({ label, list }) => list.length > 0 && (
            <div key={label}>
              <p style={{ margin: "0 0 0.4rem", fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--c-text-muted)" }}>{label}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                {list.map(item => (
                  <InventoryItemRow
                    key={item.name}
                    item={item}
                    player={player}
                    isCombat={isCombat}
                    onUseItem={onUseItem}
                    onUnequip={onUnequip}
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
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ borderRadius: 6, padding: "1rem 1.25rem", textAlign: "center", border: `1px solid ${isVictory ? "rgba(40,100,50,0.5)" : "rgba(155,48,48,0.5)"}`, background: isVictory ? "rgba(40,100,50,0.12)" : "rgba(155,48,48,0.12)" }}>
        <p style={{ fontSize: "1.5rem", margin: "0 0 0.25rem" }}>{isVictory ? "⚔️" : "💀"}</p>
        <p style={{ margin: 0, fontFamily: "'Cinzel', serif", fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: isVictory ? "#4ab060" : "var(--c-red-bright)" }}>
          {isVictory ? "Victory" : "Defeated"}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.4rem" }}>
        <div style={{ background: "var(--c-surface2)", border: "1px solid var(--c-border)", borderRadius: 5, display: "flex", flexDirection: "column", alignItems: "center", padding: "0.65rem 0.4rem", gap: "0.15rem" }}>
          <span style={{ fontFamily: "'Cinzel', serif", fontSize: "1.3rem", color: "var(--c-red-bright)" }}>{battleStats.dealt}</span>
          <span style={{ fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--c-text-muted)" }}>Dealt</span>
        </div>
        <div style={{ background: "var(--c-surface2)", border: "1px solid var(--c-border)", borderRadius: 5, display: "flex", flexDirection: "column", alignItems: "center", padding: "0.65rem 0.4rem", gap: "0.15rem" }}>
          <span style={{ fontFamily: "'Cinzel', serif", fontSize: "1.3rem", color: "var(--c-accent)" }}>{battleStats.taken}</span>
          <span style={{ fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--c-text-muted)" }}>Taken</span>
        </div>
        <div style={{ background: "var(--c-surface2)", border: "1px solid var(--c-border)", borderRadius: 5, display: "flex", flexDirection: "column", alignItems: "center", padding: "0.65rem 0.4rem", gap: "0.15rem" }}>
          <span style={{ fontFamily: "'Cinzel', serif", fontSize: "1.3rem", color: "var(--c-text)" }}>{battleStats.rounds}</span>
          <span style={{ fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--c-text-muted)" }}>Rounds</span>
        </div>
      </div>

      {(battleStats.crits > 0 || battleStats.fumbles > 0) && (
        <div style={{ display: "flex", gap: "0.4rem" }}>
          {battleStats.crits > 0 && (
            <span style={{ fontSize: "0.7rem", padding: "0.25rem 0.65rem", borderRadius: 10, background: "rgba(200,169,110,0.1)", border: "1px solid var(--c-accent-dim)", color: "var(--c-accent)", fontFamily: "monospace" }}>
              ⚡ {battleStats.crits} crit{battleStats.crits > 1 ? "s" : ""}
            </span>
          )}
          {battleStats.fumbles > 0 && (
            <span style={{ fontSize: "0.7rem", padding: "0.25rem 0.65rem", borderRadius: 10, background: "rgba(155,48,48,0.15)", border: "1px solid rgba(155,48,48,0.4)", color: "var(--c-red-bright)", fontFamily: "monospace" }}>
              💀 {battleStats.fumbles} fumble{battleStats.fumbles > 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      <div style={{ background: "var(--c-bg)", border: "1px solid var(--c-border)", borderRadius: 5, padding: "0.6rem 0.85rem", display: "flex", flexDirection: "column", gap: "0.2rem", maxHeight: "10rem", overflowY: "auto" }}>
        <p style={{ margin: "0 0 0.2rem", fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--c-text-muted)" }}>Battle Log</p>
        {battleLog.map((line, i) => (
          <p key={i} style={{ margin: 0, fontSize: "0.65rem", fontFamily: "monospace", color: "var(--c-text-dim)" }}>{line}</p>
        ))}
      </div>

      {narration && (
        <div className="c-narration" style={{ fontSize: "0.95rem" }}>{narration}</div>
      )}

      {isVictory ? (
        <button onClick={onContinue} className="c-btn-primary">Continue →</button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <button onClick={onRetry} className="c-btn-primary">Try Again</button>
          <button onClick={onBack} className="c-btn-ghost">← Back to Menu</button>
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
    setGameState(prev => applyCampaignItem(prev, itemName));
  }

  function handleUnequip() {
    setGameState(prev => unequipWeapon(prev));
  }

  const { lastRoll, combatLog } = gameState;
  const isCombat = step.type === "combat";
  const isV2     = isCombat && !!(step.enemy?.behavior);

  return (
    <div className="chronicle-app c-campaign">

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
        <button onClick={onBack} className="c-back-btn">←</button>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--c-text-muted)" }}>{step.type}</p>
          <h2 style={{ margin: 0, fontFamily: "'Cinzel', serif", fontSize: "0.95rem", color: "var(--c-text)" }}>{step.title}</h2>
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
          {isV2 && <StatusBadges statuses={gameState.status?.enemy} />}
          <DiceDisplay lastRoll={lastRoll} />
          <CombatLog lines={combatLog} />
          <PlayerPanel player={gameState.player} />
          {isV2 && <StatusBadges statuses={gameState.status?.player} />}

          {/* V2: intent banner — shown before player chooses action */}
          {isV2 && gameState.intent === "heavy" && (
            <div style={{ background: "rgba(180,80,0,0.15)", border: "1px solid rgba(200,100,0,0.45)",
              borderRadius: 6, padding: "0.45rem 0.85rem", color: "#e8a060",
              fontSize: "0.8rem", fontWeight: 700, textAlign: "center", letterSpacing: "0.05em" }}>
              ⚠️ Heavy Attack Incoming
            </div>
          )}

          <ActionBar
            onAttack={() => handleAction("I attack!")}
            onDefend={() => handleAction("I defend!")}
            onHeavy={()  => handleAction("heavy attack!")}
            loading={loading}
            isV2={isV2}
          />
          {loading && (
            <p style={{ textAlign: "center", color: "var(--c-text-muted)", fontSize: "0.75rem", margin: 0 }}>Resolving turn…</p>
          )}

          <InventoryPanel player={gameState.player} onUseItem={handleUseItem} isCombat={true} onUnequip={handleUnequip} />

          <NarrationBox text={gameState.narration} />
        </>
      )}

      {/* ── NON-COMBAT LAYOUTS ───────────────────────────────────────────────── */}
      {!isCombat && !gameState.pendingTransition && (
        <>
          {/* Narrative text */}
          <div className="c-narration">
            {(gameState.narration ?? step.text).split("\n\n").map((p, i) => (
              <p key={i} style={{ margin: "0 0 0.5rem" }}>{p}</p>
            ))}
          </div>

          {/* Loot cards */}
          {step.type === "loot" && step.loot && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {step.loot.gold > 0 && (
                <div className="c-loot-gold-card">
                  <span style={{ fontSize: "1.4rem" }}>🪙</span>
                  <div>
                    <p style={{ margin: 0, color: "var(--c-accent)", fontWeight: 700, fontSize: "0.9rem" }}>+{step.loot.gold} Gold</p>
                    <p style={{ margin: 0, color: "var(--c-text-muted)", fontSize: "0.7rem" }}>Added to your purse</p>
                  </div>
                </div>
              )}
              {(step.loot.items ?? []).map((item, i) => (
                <div key={i} className="c-loot-item-card">
                  <span style={{ fontSize: "1.4rem" }}>{item.type === "Weapon" ? "⚔️" : item.type === "Consumable" ? "🧪" : "📦"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                      <p style={{ margin: 0, color: "var(--c-text)", fontWeight: 700, fontSize: "0.9rem" }}>{item.name}</p>
                      <span style={{ fontSize: "0.55rem", padding: "0.1rem 0.4rem", borderRadius: 10, border: "1px solid var(--c-border)", color: "var(--c-text-muted)" }}>{item.type}</span>
                    </div>
                    <p style={{ margin: 0, color: "var(--c-text-muted)", fontSize: "0.75rem", marginTop: "0.15rem" }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Loot continue */}
          {step.type === "loot" && (
            <button onClick={() => handleChoice(step.next)} className="c-continue-btn">
              Continue →
            </button>
          )}

          {/* Choice buttons */}
          {step.type === "choice" && step.choices
            .filter(c => !c.requires?.item || gameState.player.inventory.some(i => i.name === c.requires.item))
            .map(choice => (
            <button key={choice.next} onClick={() => handleChoice(choice.next)} className="c-choice-btn">
              <span>{choice.text}</span>
              <span style={{ color: "var(--c-border-bright)", fontSize: "1rem" }}>›</span>
            </button>
          ))}

          {/* Exploration input */}
          {step.type === "exploration" && !gameState.gameOver && (
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <input
                style={{ flex: 1, background: "var(--c-surface2)", border: "1px solid var(--c-border)", borderRadius: 4, padding: "0.65rem 0.85rem", color: "var(--c-text)", fontFamily: "'Crimson Pro', serif", fontSize: "1rem", outline: "none" }}
                placeholder="What do you do?"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAction()}
                disabled={loading}
              />
              <button
                onClick={() => handleAction()}
                disabled={loading || !input.trim()}
                className="c-btn-primary"
                style={{ width: "auto", padding: "0 1.25rem", fontSize: "1rem" }}
              >
                {loading ? "…" : "▶"}
              </button>
            </div>
          )}

          {/* Inventory (all non-combat, non-end screens) */}
          {!gameState.gameOver && (
            <InventoryPanel player={gameState.player} onUseItem={handleUseItem} isCombat={false} onUnequip={handleUnequip} />
          )}

          {/* End state */}
          {gameState.gameOver && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1rem" }}>
              <p style={{ textAlign: "center", color: "var(--c-text-muted)", fontSize: "0.9rem", margin: 0 }}>
                {step.outcome === "victory" ? "🏆 Campaign complete" : "💀 Defeated"}
              </p>
              <button onClick={() => setGameState(createCampaignState(gameState.campaign))} className="c-btn-primary">
                Try Again
              </button>
              <button onClick={onBack} className="c-btn-ghost">
                ← Back to Menu
              </button>
            </div>
          )}
        </>
      )}

    </div>
  );
}
