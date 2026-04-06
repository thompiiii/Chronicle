import { useState, useEffect, useRef } from "react";

const CLASSES = ["Barbarian","Bard","Cleric","Druid","Fighter","Monk","Paladin","Ranger","Rogue","Sorcerer","Warlock","Wizard"];
const RACES = ["Human","Elf","Dwarf","Halfling","Gnome","Half-Orc","Tiefling","Dragonborn","Half-Elf","Aasimar"];
const CLASS_ICONS = { Barbarian:"⚔️", Bard:"🎵", Cleric:"✝️", Druid:"🌿", Fighter:"🛡️", Monk:"👊", Paladin:"⚜️", Ranger:"🏹", Rogue:"🗡️", Sorcerer:"✨", Warlock:"🔮", Wizard:"📚" };
const INITIAL_STATS = { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 };

const STARTING_INVENTORY = {
  Fighter:  [{ id:1, name:"Longsword", type:"Weapon", weight:3, desc:"1d8 slashing" }, { id:2, name:"Shield", type:"Armor", weight:6, desc:"+2 AC" }, { id:3, name:"Chain Mail", type:"Armor", weight:55, desc:"AC 16" }, { id:4, name:"Health Potion", type:"Consumable", weight:0.5, desc:"Restores 2d4+2 HP", qty:2 }],
  Wizard:   [{ id:1, name:"Quarterstaff", type:"Weapon", weight:4, desc:"1d6 bludgeoning" }, { id:2, name:"Spellbook", type:"Misc", weight:3, desc:"Contains your spells" }, { id:3, name:"Arcane Focus", type:"Misc", weight:1, desc:"Crystal orb" }, { id:4, name:"Health Potion", type:"Consumable", weight:0.5, desc:"Restores 2d4+2 HP", qty:1 }],
  Rogue:    [{ id:1, name:"Shortsword", type:"Weapon", weight:2, desc:"1d6 piercing" }, { id:2, name:"Daggers", type:"Weapon", weight:1, desc:"1d4 piercing", qty:5 }, { id:3, name:"Thieves' Tools", type:"Tool", weight:1, desc:"Pick locks & disarm traps" }, { id:4, name:"Health Potion", type:"Consumable", weight:0.5, desc:"Restores 2d4+2 HP", qty:2 }],
  Cleric:   [{ id:1, name:"Mace", type:"Weapon", weight:4, desc:"1d6 bludgeoning" }, { id:2, name:"Holy Symbol", type:"Misc", weight:1, desc:"Channel Divinity focus" }, { id:3, name:"Scale Mail", type:"Armor", weight:45, desc:"AC 14" }, { id:4, name:"Health Potion", type:"Consumable", weight:0.5, desc:"Restores 2d4+2 HP", qty:3 }],
  default:  [{ id:1, name:"Handaxe", type:"Weapon", weight:2, desc:"1d6 slashing", qty:2 }, { id:2, name:"Explorer's Pack", type:"Misc", weight:10, desc:"Rope, rations, torches" }, { id:3, name:"Health Potion", type:"Consumable", weight:0.5, desc:"Restores 2d4+2 HP", qty:2 }],
};

const MOCK_RESPONSES = [
  "You step forward cautiously. The corridor ahead is dark — your torchlight barely reaches ten feet. The air grows colder with each step. To your left, you notice a rusted iron door slightly ajar. To your right, a narrow staircase descends into blackness. What do you do?",
  "You draw your weapon and scan the shadows. Something moves in the corner — a large rat, its eyes glinting red. It hisses and scurries away. Seems harmless… for now. The room yields nothing of obvious value, though a loose stone in the far wall catches your eye. What do you do?",
  "You search the area carefully. After a few minutes, your hands find a small leather pouch tucked behind a crumbling stone — inside are 12 gold pieces and a folded note written in a cipher you don't recognize. What do you do?",
  "You attempt the action with confidence. The environment reacts to your choice. Paths open and close. The dungeon remembers what you've done here. What do you do next?",
  "The shadows stir. From the darkness emerges a figure — cloaked, hunched, moving with unnatural stillness. It stops ten feet away and tilts its head. It has not yet attacked. It seems to be… waiting. What do you do?",
];

const SAMPLE_CAMPAIGN = `You stand at the entrance of the Sunken Keep of Malgrath — a crumbling fortress half-swallowed by the Thornwood. Torchlight flickers against moss-covered stones. The air smells of rot and old iron. Somewhere deep within, something stirs.\n\nThe iron gate before you hangs open, its hinges long since surrendered to rust. Two paths diverge beyond the threshold: a wide corridor littered with the bones of previous adventurers, and a narrow servants' passage cloaked in shadow.\n\nWhat do you do?`;

const TYPE_COLORS = { Weapon:"text-red-400", Armor:"text-blue-400", Consumable:"text-green-400", Tool:"text-yellow-400", Misc:"text-gray-400" };

const DICE = [
  { sides: 4,   label: "d4",   color: "bg-purple-700 hover:bg-purple-600", dot: "◆" },
  { sides: 6,   label: "d6",   color: "bg-blue-700 hover:bg-blue-600",     dot: "⬡" },
  { sides: 8,   label: "d8",   color: "bg-teal-700 hover:bg-teal-600",     dot: "◈" },
  { sides: 10,  label: "d10",  color: "bg-green-700 hover:bg-green-600",   dot: "⬟" },
  { sides: 12,  label: "d12",  color: "bg-yellow-700 hover:bg-yellow-600", dot: "⬠" },
  { sides: 20,  label: "d20",  color: "bg-red-700 hover:bg-red-600",       dot: "⬡" },
  { sides: 100, label: "d100", color: "bg-pink-700 hover:bg-pink-600",     dot: "○" },
];

const QUICK_ACTIONS = ["I search the room", "I attack!", "I cast a spell", "I try to sneak", "I talk to them"];

const TAB_BUTTONS = [
  { id: "dice",      label: "🎲 Dice" },
  { id: "sheet",     label: "📜 Sheet" },
  { id: "inventory", label: "🎒 Bag" },
  { id: "combat",    label: "⚔️ Fight" },
  { id: "notes",     label: "📝 Notes" },
];

const SPELLCASTER_CLASSES = ["Bard","Cleric","Druid","Sorcerer","Warlock","Wizard","Paladin","Ranger"];

// Spell slots per class level index (0=lv1): [1st,2nd,3rd,4th,5th,6th,7th,8th,9th]
const FULL_CASTER_SLOTS = [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]];
const HALF_CASTER_SLOTS  = [[],[2],[3],[3],[4,2],[4,2],[4,3],[4,3],[4,3,2],[4,3,2],[4,3,3],[4,3,3],[4,3,3,1],[4,3,3,1],[4,3,3,2],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2]];
const WARLOCK_SLOTS      = [[1],[2],[0,2],[0,2],[0,0,2],[0,0,2],[0,0,0,2],[0,0,0,2],[0,0,0,0,2],[0,0,0,0,2],[0,0,0,0,3],[0,0,0,0,3],[0,0,0,0,3],[0,0,0,0,3],[0,0,0,0,4],[0,0,0,0,4],[0,0,0,0,4],[0,0,0,0,4],[0,0,0,0,4],[0,0,0,0,4]];
const CLASS_SLOT_TABLE = { Bard: FULL_CASTER_SLOTS, Cleric: FULL_CASTER_SLOTS, Druid: FULL_CASTER_SLOTS, Sorcerer: FULL_CASTER_SLOTS, Wizard: FULL_CASTER_SLOTS, Paladin: HALF_CASTER_SLOTS, Ranger: HALF_CASTER_SLOTS, Warlock: WARLOCK_SLOTS };

function getSpellSlotMaxes(charClass, level) {
  const table = CLASS_SLOT_TABLE[charClass];
  if (!table) return {};
  const row = table[Math.min(level || 1, 20) - 1] || [];
  const result = {};
  row.forEach((max, i) => { if (max > 0) result[i + 1] = max; });
  return result;
}

const ORDINALS = ["1st","2nd","3rd","4th","5th","6th","7th","8th","9th"];

const CONDITIONS = ["Blinded","Charmed","Deafened","Exhausted","Frightened","Grappled",
  "Incapacitated","Invisible","Paralyzed","Petrified","Poisoned","Prone",
  "Restrained","Stunned","Unconscious"];

function calcAC(inventory, stats) {
  const dex = Math.floor(((stats?.DEX || 10) - 10) / 2);
  const names = (inventory || []).map(i => i.name.toLowerCase());
  const hasShield = names.some(n => n.includes("shield"));
  let base;
  if (names.some(n => n.includes("chain mail"))) base = 16;
  else if (names.some(n => n.includes("scale mail"))) base = 14 + Math.min(2, dex);
  else if (names.some(n => n.includes("leather"))) base = 11 + dex;
  else if (names.some(n => n.includes("studded"))) base = 12 + dex;
  else base = 10 + dex;
  return base + (hasShield ? 2 : 0);
}

const card  = "bg-gray-800 border border-gray-700 rounded-lg";
const btn   = "px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors cursor-pointer";
const btnSm = "px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors cursor-pointer";
const inp   = "bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-full";

// ── Campaign Save/Load Helpers ─────────────────────────────────────────────
const SAVES_KEY = "chronicle_saves";

function loadSaves() {
  try {
    return JSON.parse(localStorage.getItem(SAVES_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeSaves(saves) {
  localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
}

function saveCampaign({ id, character, messages, inventory, gold, currentHp, usedSlots, conditions, notes, deathSaves, sessionCode, playerName }) {
  const saves = loadSaves();
  const now = Date.now();
  const existing = saves.findIndex(s => s.id === id);
  const lastDmMsg = [...messages].reverse().find(m => m.role === "dm");
  const preview = lastDmMsg ? lastDmMsg.text.slice(0, 90) + (lastDmMsg.text.length > 90 ? "…" : "") : "";
  const entry = { id, character, messages, inventory, gold, currentHp, usedSlots, conditions, notes, deathSaves, sessionCode, playerName, savedAt: now, preview };
  if (existing >= 0) {
    saves[existing] = entry;
  } else {
    saves.unshift(entry);
  }
  writeSaves(saves);
}

function deleteSave(id) {
  writeSaves(loadSaves().filter(s => s.id !== id));
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function rollDie(sides) { return Math.floor(Math.random() * sides) + 1; }

function modifier(score) {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

function fmtSign(n) { return n >= 0 ? `+${n}` : `${n}`; }

function getStartingInventory(charClass) {
  return (STARTING_INVENTORY[charClass] || STARTING_INVENTORY.default).map(item => ({ ...item, qty: item.qty || 1 }));
}

function generateStats() {
  const stats = {};
  ["STR","DEX","CON","INT","WIS","CHA"].forEach(s => {
    const rolls = Array.from({ length: 4 }, () => rollDie(6));
    rolls.sort((a, b) => a - b);
    stats[s] = rolls.slice(1).reduce((a, b) => a + b, 0);
  });
  return stats;
}

let msgIdCounter = 1;
function makeMsg(role, text, extra = {}) {
  return { id: msgIdCounter++, role, text, ...extra };
}

function renderMarkdown(text) {
  return text.split("\n\n").map((para, i) => (
    <p key={i} className="mb-2 last:mb-0">
      {para.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((chunk, j) => {
        if (chunk.startsWith("**") && chunk.endsWith("**"))
          return <strong key={j} className="text-white font-semibold">{chunk.slice(2, -2)}</strong>;
        if (chunk.startsWith("*") && chunk.endsWith("*"))
          return <em key={j} className="text-gray-200 italic">{chunk.slice(1, -1)}</em>;
        return chunk;
      })}
    </p>
  ));
}

// ── Dice Roller Panel ──────────────────────────────────────────────────────
function DiceRoller({ onRollToChat }) {
  const [count, setCount] = useState(1);
  const [rollMod, setRollMod] = useState(0);
  const [lastRoll, setLastRoll] = useState(null);
  const [rolling, setRolling] = useState(false);

  async function roll(sides) {
    setRolling(true);
    setLastRoll(null);
    await new Promise(r => setTimeout(r, 350));
    const rolls = Array.from({ length: count }, () => rollDie(sides));
    const total = rolls.reduce((a, b) => a + b, 0) + rollMod;
    const result = { sides, count, rolls, modifier: rollMod, total, isCrit: sides === 20 && rolls[0] === 20, isFumble: sides === 20 && rolls[0] === 1 };
    setLastRoll(result);
    setRolling(false);
    if (onRollToChat) onRollToChat(result);
  }

  const resultColor = lastRoll?.isCrit ? "text-yellow-400" : lastRoll?.isFumble ? "text-red-400" : "text-white";

  return (
    <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex-shrink-0">
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs">Dice</span>
          <button onClick={() => setCount(Math.max(1, count - 1))} className="w-6 h-6 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm cursor-pointer flex items-center justify-center">−</button>
          <span className="text-white font-bold w-4 text-center">{count}</span>
          <button onClick={() => setCount(Math.min(10, count + 1))} className="w-6 h-6 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm cursor-pointer flex items-center justify-center">+</button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs">Mod</span>
          <button onClick={() => setRollMod(m => m - 1)} className="w-6 h-6 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm cursor-pointer flex items-center justify-center">−</button>
          <span className="text-white font-bold w-6 text-center">{fmtSign(rollMod)}</span>
          <button onClick={() => setRollMod(m => m + 1)} className="w-6 h-6 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm cursor-pointer flex items-center justify-center">+</button>
        </div>
        {lastRoll && (
          <div className="ml-auto text-right">
            <span className={`text-2xl font-bold ${resultColor}`}>{lastRoll.total}</span>
            {lastRoll.isCrit && <span className="ml-1 text-xs text-yellow-400">CRIT!</span>}
            {lastRoll.isFumble && <span className="ml-1 text-xs text-red-400">FUMBLE</span>}
            {lastRoll.count > 1 && <p className="text-gray-500 text-xs">[{lastRoll.rolls.join(", ")}]{lastRoll.modifier !== 0 ? ` ${fmtSign(lastRoll.modifier)}` : ""}</p>}
          </div>
        )}
        {rolling && <div className="ml-auto text-2xl animate-spin">🎲</div>}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {DICE.map(d => (
          <button key={d.sides} onClick={() => roll(d.sides)}
            className={`${d.color} text-white rounded py-2 text-xs font-bold cursor-pointer transition-colors flex flex-col items-center gap-0.5`}>
            <span className="text-base leading-none">{d.dot}</span>
            <span>{d.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Combat Tracker ────────────────────────────────────────────────────────
function CombatTracker({ character, currentHp }) {
  const [combatants, setCombatants] = useState(() =>
    character ? [{ id: "player", name: character.name, initiative: 0, hp: currentHp, maxHp: character.hp, isPlayer: true }] : []
  );
  const [currentIdx, setCurrentIdx] = useState(0);
  const [round, setRound] = useState(1);
  const [newName, setNewName] = useState("");
  const [newInit, setNewInit] = useState("");
  const [started, setStarted] = useState(false);

  const sorted = [...combatants].sort((a, b) => b.initiative - a.initiative);
  const activeCombatant = sorted[currentIdx];

  function addCombatant() {
    const name = newName.trim();
    if (!name) return;
    const init = newInit !== "" ? Number(newInit) : Math.floor(Math.random() * 20) + 1;
    setCombatants(prev => [...prev, { id: Date.now(), name, initiative: init, hp: null, maxHp: null, isPlayer: false }]);
    setNewName("");
    setNewInit("");
  }

  function rollPlayerInit() {
    const roll = Math.floor(Math.random() * 20) + 1;
    const dexMod = character ? Math.floor((character.stats.DEX - 10) / 2) : 0;
    setCombatants(prev => prev.map(c => c.isPlayer ? { ...c, initiative: roll + dexMod } : c));
  }

  function remove(id) {
    const newList = combatants.filter(c => c.id !== id);
    setCombatants(newList);
    setCurrentIdx(0);
  }

  function nextTurn() {
    const next = (currentIdx + 1) % sorted.length;
    if (next === 0) setRound(r => r + 1);
    setCurrentIdx(next);
  }

  function resetCombat() {
    setCurrentIdx(0);
    setRound(1);
    setStarted(false);
    setCombatants(character
      ? [{ id: "player", name: character.name, initiative: 0, hp: currentHp, maxHp: character.hp, isPlayer: true }]
      : []
    );
  }

  return (
    <div className="bg-gray-800 border-t border-gray-700 flex-shrink-0" style={{ maxHeight: "260px", overflowY: "auto" }}>
      <div className="px-4 py-3">
        {/* Header row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-semibold">⚔️ Combat</span>
            {started && <span className="text-gray-400 text-xs">Round {round}</span>}
          </div>
          <div className="flex gap-1">
            {!started ? (
              <button onClick={() => setStarted(true)} disabled={combatants.length < 2}
                className="px-2 py-1 bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded text-xs cursor-pointer transition-colors">
                Start
              </button>
            ) : (
              <button onClick={nextTurn}
                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs cursor-pointer transition-colors">
                Next →
              </button>
            )}
            <button onClick={resetCombat}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs cursor-pointer transition-colors">
              Reset
            </button>
          </div>
        </div>

        {/* Combatant list */}
        <div className="space-y-1 mb-2">
          {(started ? sorted : combatants).map((c, i) => {
            const isActive = started && sorted[currentIdx]?.id === c.id;
            return (
              <div key={c.id} className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors ${isActive ? "bg-indigo-900 border border-indigo-600" : "bg-gray-900"}`}>
                <span className="w-3 text-center text-indigo-400">{isActive ? "▶" : ""}</span>
                <span className={`flex-1 truncate font-medium ${c.isPlayer ? "text-indigo-300" : "text-white"}`}>{c.name}{c.isPlayer ? " (you)" : ""}</span>
                <div className="flex items-center gap-1">
                  {c.isPlayer ? (
                    <button onClick={rollPlayerInit} title="Roll initiative"
                      className="text-gray-400 hover:text-white cursor-pointer px-1">🎲</button>
                  ) : null}
                  <span className="text-gray-400 w-14 text-right">Init: <span className="text-white font-bold">{c.initiative}</span></span>
                </div>
                <button onClick={() => remove(c.id)} className="text-gray-600 hover:text-red-400 cursor-pointer ml-1">✕</button>
              </div>
            );
          })}
          {combatants.length === 0 && <p className="text-gray-600 text-xs text-center py-1">Add combatants below</p>}
        </div>

        {/* Add combatant form */}
        <div className="flex gap-1 pt-2 border-t border-gray-700">
          <input
            className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white placeholder-gray-600 text-xs focus:outline-none focus:border-indigo-500 flex-1"
            placeholder="Enemy name…"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addCombatant()}
          />
          <input
            className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white placeholder-gray-600 text-xs focus:outline-none focus:border-indigo-500 w-14 text-center"
            placeholder="Init"
            type="number"
            value={newInit}
            onChange={e => setNewInit(e.target.value)}
          />
          <button onClick={addCombatant}
            className="px-2 py-1 bg-indigo-700 hover:bg-indigo-600 text-white rounded text-xs cursor-pointer transition-colors">
            Add
          </button>
        </div>
        <p className="text-gray-600 text-xs mt-1">Leave Init blank to roll d20 automatically.</p>
      </div>
    </div>
  );
}

// ── Saved Campaigns Screen ─────────────────────────────────────────────────
function SavedCampaignsScreen({ onBack, onContinue }) {
  const [saves, setSaves] = useState(loadSaves);
  const [confirmDelete, setConfirmDelete] = useState(null);

  function handleDelete(id) {
    deleteSave(id);
    setSaves(loadSaves());
    setConfirmDelete(null);
  }

  if (saves.length === 0) return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
      <div className="text-5xl mb-4">📜</div>
      <h2 className="text-xl font-bold mb-2">No saved campaigns</h2>
      <p className="text-gray-400 text-sm mb-6">Start a new campaign and your progress will be saved automatically.</p>
      <button className={btn} onClick={onBack}>← Back</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors cursor-pointer text-lg">←</button>
          <h2 className="text-2xl font-bold">Saved Campaigns</h2>
        </div>
        <div className="space-y-3">
          {saves.map(save => (
            <div key={save.id} className={card + " p-4"}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl flex-shrink-0">{CLASS_ICONS[save.character?.class] || "🧙"}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{save.character?.name}</p>
                    <p className="text-gray-400 text-xs">{save.character?.race} · {save.character?.class} · {save.messages?.length || 0} messages</p>
                    <p className="text-gray-500 text-xs mt-0.5">Saved {formatDate(save.savedAt)}</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => onContinue(save)} className={btn + " text-sm py-1.5 px-3"}>Continue</button>
                  {confirmDelete === save.id ? (
                    <div className="flex gap-1">
                      <button onClick={() => handleDelete(save.id)} className="px-2 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded text-xs cursor-pointer">Delete</button>
                      <button onClick={() => setConfirmDelete(null)} className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs cursor-pointer">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(save.id)} className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-red-400 rounded text-xs cursor-pointer">🗑</button>
                  )}
                </div>
              </div>
              {save.preview && (
                <p className="text-gray-500 text-xs mt-3 border-t border-gray-700 pt-2 italic leading-relaxed">"{save.preview}"</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("home");
  const [sessionCode, setSessionCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [charClass, setCharClass] = useState("Fighter");
  const [charRace, setCharRace] = useState("Human");
  const [charName, setCharName] = useState("");
  const [stats, setStats] = useState(INITIAL_STATS);
  const [messages, setMessages] = useState([makeMsg("dm", SAMPLE_CAMPAIGN)]);
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [dmOverride, setDmOverride] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [character, setCharacter] = useState(null);
  const [activeTab, setActiveTab] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [gold, setGold] = useState(10);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [campaignId, setCampaignId] = useState(null);
  const [justSaved, setJustSaved] = useState(false);
  const [currentHp, setCurrentHp] = useState(10);
  const [usedSlots, setUsedSlots] = useState({});
  const [conditions, setConditions] = useState([]);
  const [notes, setNotes] = useState("");
  const [deathSaves, setDeathSaves] = useState({ successes: 0, failures: 0 });
  const [newItemName, setNewItemName] = useState("");
  const [newItemType, setNewItemType] = useState("Misc");
  const chatRef = useRef(null);
  const mockIndex = useRef(0);
  const inputRef = useRef(null);
  const autoSendTimeout = useRef(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    return () => window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    const isLastMsgARoll = lastMsg?.isRoll;
    if (isLastMsgARoll && userInput.trim() && !loading) {
      if (autoSendTimeout.current) clearTimeout(autoSendTimeout.current);
      autoSendTimeout.current = setTimeout(() => {
        sendMessage();
      }, 800);
    }
    return () => {
      if (autoSendTimeout.current) clearTimeout(autoSendTimeout.current);
    };
  }, [userInput, messages, loading]);

  // Auto-save whenever key state changes (only while in game)
  useEffect(() => {
    if (screen === "game" && character && campaignId) {
      saveCampaign({ id: campaignId, character, messages, inventory, gold, currentHp, usedSlots, conditions, notes, deathSaves, sessionCode, playerName });
    }
  }, [messages, inventory, gold, currentHp, usedSlots, conditions, notes, deathSaves]);

  function triggerSaveFlash() {
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  }

  function createSession() {
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    setSessionCode(code);
    setIsHost(true);
    setScreen("create-session");
  }

  function joinSession() {
    if (inputCode.length < 4) return;
    setSessionCode(inputCode.toUpperCase());
    setIsHost(false);
    setScreen("character");
  }

  function autoGenerateCharacter() {
    setStats(generateStats());
    setCharName(`${charRace} ${charClass} #${Math.floor(Math.random() * 999) + 1}`);
  }

  function enterGame() {
    const maxHp = 10 + Math.floor((stats.CON - 10) / 2);
    const char = { name: charName || `${charRace} ${charClass}`, class: charClass, race: charRace, stats, hp: maxHp, level: 1 };
    const id = Math.random().toString(36).substring(2, 12);
    setCharacter(char);
    setCurrentHp(maxHp);
    setInventory(getStartingInventory(charClass));
    setGold(Math.floor(Math.random() * 15) + 5);
    setCampaignId(id);
    setMessages([makeMsg("dm", SAMPLE_CAMPAIGN)]);
    setUsedSlots({});
    setConditions([]);
    setNotes("");
    setDeathSaves({ successes: 0, failures: 0 });
    setScreen("game");
  }

  function continueGame(save) {
    msgIdCounter = Math.max(msgIdCounter, ...save.messages.map(m => m.id + 1));
    const char = { level: 1, ...save.character };
    setCharacter(char);
    setCurrentHp(save.currentHp ?? char.hp ?? 10);
    setMessages(save.messages);
    setInventory(save.inventory);
    setGold(save.gold);
    setSessionCode(save.sessionCode || "");
    setPlayerName(save.playerName || "");
    setCampaignId(save.id);
    setUsedSlots(save.usedSlots || {});
    setConditions(save.conditions || []);
    setNotes(save.notes || "");
    setDeathSaves(save.deathSaves || { successes: 0, failures: 0 });
    setIsHost(true);
    setScreen("game");
  }

  function removeItem(id) { setInventory(inv => inv.filter(i => i.id !== id)); }
  function changeQty(id, delta) {
    setInventory(inv => inv.map(i => {
      if (i.id !== id) return i;
      const newQty = i.qty + delta;
      return newQty <= 0 ? null : { ...i, qty: newQty };
    }).filter(Boolean));
  }

  function handleRollToChat(result) {
    const label = result.isCrit ? " 🌟 CRITICAL HIT!" : result.isFumble ? " 💀 FUMBLE" : "";
    const modStr = result.modifier !== 0 ? fmtSign(result.modifier) : "";
    const detail = result.count > 1 ? `[${result.rolls.join(", ")}]${modStr ? ` ${modStr}` : ""}` : "";
    const text = `🎲 Rolled ${result.count}d${result.sides}${modStr}: **${result.total}**${detail}${label}`;
    setMessages(prev => [...prev, makeMsg("player", text, { name: character?.name, isRoll: true })]);
  }

  async function sendMessage() {
    if (!userInput.trim() || loading) return;
    const msg = userInput.trim();
    setUserInput("");
    setMessages(prev => [...prev, makeMsg("player", msg, { name: character?.name })]);
    setLoading(true);
    try {
      const filteredMessages = messages.concat(makeMsg("player", msg, { name: character?.name })).map(m => ({ role: m.role, text: m.text }));
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: filteredMessages,
          character: { name: character?.name, class: character?.class, race: character?.race }
        })
      });
      if (!response.ok) throw new Error('API error');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let dmReply = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              dmReply += parsed.text;
            } catch (e) {
              // ignore invalid JSON
            }
          }
        }
      }
      setMessages(prev => [...prev, makeMsg("dm", dmReply)]);
      speakText(dmReply);
      triggerSaveFlash();
    } finally {
      setLoading(false);
    }
  }

  function speakText(text) {
    if (!window.speechSynthesis || !voiceEnabled) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/\*\*/g, '').replace(/\*/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.88; utterance.pitch = 0.75;
    const voices = window.speechSynthesis.getVoices();
    const deep = voices.find(v => v.name.toLowerCase().includes("daniel") || v.lang === "en-GB");
    if (deep) utterance.voice = deep;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  if (screen === "saves") return (
    <SavedCampaignsScreen
      onBack={() => setScreen("home")}
      onContinue={save => { continueGame(save); }}
    />
  );

  if (screen === "home") {
    const hasSaves = loadSaves().length > 0;
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
        <div className="text-center mb-10">
          <div className="text-5xl mb-3">⚔️</div>
          <h1 className="text-4xl font-bold mb-1">Chronicle</h1>
          <p className="text-gray-400">AI Dungeon Master · D&D 5e</p>
        </div>
        <div className="w-full max-w-sm space-y-4">
          <div className={card + " p-4"}>
            <label className="block text-sm text-gray-400 mb-1">Your name</label>
            <input className={inp} placeholder="Enter your name…" value={playerName} onChange={e => setPlayerName(e.target.value)} />
          </div>
          <button className={`${btn} w-full py-3`} onClick={createSession}>🏰 New Campaign</button>
          {hasSaves && (
            <button
              className="w-full py-3 px-4 bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-gray-500 text-white rounded-lg font-semibold transition-colors cursor-pointer"
              onClick={() => setScreen("saves")}
            >
              📜 Continue Campaign
            </button>
          )}
          <div className={card + " p-4"}>
            <label className="block text-sm text-gray-400 mb-2">Join with session code</label>
            <div className="flex gap-2">
              <input className={inp} placeholder="XXXXX" value={inputCode} onChange={e => setInputCode(e.target.value)} maxLength={6} style={{ textTransform: "uppercase", letterSpacing: "0.2em" }} />
              <button className={btn} onClick={joinSession}>Join</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (screen === "create-session") return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-md mx-auto">
        <h2 className="text-2xl font-bold mb-1">Campaign Lobby</h2>
        <p className="text-gray-400 mb-6 text-sm">Share this code with your party</p>
        <div className={card + " p-6 mb-4 text-center"}>
          <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">Session Code</p>
          <div className="text-5xl font-bold tracking-widest text-indigo-400">{sessionCode}</div>
        </div>
        <div className={card + " p-4 mb-4"}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">DM Override</p>
              <p className="text-gray-400 text-sm">Bend rules for fun</p>
            </div>
            <button onClick={() => setDmOverride(!dmOverride)} className={`w-12 h-6 rounded-full transition-colors cursor-pointer relative ${dmOverride ? "bg-indigo-600" : "bg-gray-600"}`}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all duration-200 ${dmOverride ? "left-6" : "left-0.5"}`} />
            </button>
          </div>
        </div>
        <button className={`${btn} w-full py-3`} onClick={() => setScreen("character")}>Create Your Character →</button>
      </div>
    </div>
  );

  if (screen === "character") return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Create Character</h2>
          <span className="text-indigo-400 text-sm font-mono">{sessionCode}</span>
        </div>
        <div className={card + " p-4 mb-4"}>
          <label className="block text-sm text-gray-400 mb-1">Character Name</label>
          <input className={inp} placeholder="Name your hero…" value={charName} onChange={e => setCharName(e.target.value)} />
        </div>
        <div className={card + " p-4 mb-4"}>
          <p className="text-sm text-gray-400 mb-2">Race</p>
          <div className="grid grid-cols-5 gap-1">
            {RACES.map(r => (
              <button key={r} onClick={() => setCharRace(r)} className={`text-xs py-1.5 rounded border transition-colors cursor-pointer ${charRace === r ? "bg-indigo-600 border-indigo-500 text-white" : "bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500"}`}>{r}</button>
            ))}
          </div>
        </div>
        <div className={card + " p-4 mb-4"}>
          <p className="text-sm text-gray-400 mb-2">Class</p>
          <div className="grid grid-cols-4 gap-2">
            {CLASSES.map(c => (
              <button key={c} onClick={() => setCharClass(c)} className={`flex flex-col items-center py-2 rounded border transition-colors cursor-pointer ${charClass === c ? "bg-indigo-600 border-indigo-500" : "bg-gray-900 border-gray-700 hover:border-gray-500"}`}>
                <span className="text-lg">{CLASS_ICONS[c]}</span>
                <span className="text-xs mt-0.5 text-gray-200">{c}</span>
              </button>
            ))}
          </div>
        </div>
        <div className={card + " p-4 mb-4"}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-400">Ability Scores</p>
            <button onClick={autoGenerateCharacter} className={btnSm}>🎲 Roll Stats</button>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {Object.entries(stats).map(([stat, val]) => (
              <div key={stat} className="flex flex-col items-center bg-gray-900 border border-gray-700 rounded p-2">
                <p className="text-gray-400 text-xs">{stat}</p>
                <p className="text-white text-xl font-bold">{val}</p>
                <p className="text-indigo-400 text-xs">{modifier(val)}</p>
                <div className="flex gap-1 mt-1">
                  <button onClick={() => setStats(s => ({ ...s, [stat]: Math.max(3, s[stat] - 1) }))} className="text-gray-400 hover:text-white w-4 text-center cursor-pointer">−</button>
                  <button onClick={() => setStats(s => ({ ...s, [stat]: Math.min(20, s[stat] + 1) }))} className="text-gray-400 hover:text-white w-4 text-center cursor-pointer">+</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <button className={`${btn} w-full py-3`} onClick={enterGame}>Enter the Campaign →</button>
      </div>
    </div>
  );

  if (screen === "game") return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScreen("home")}
            className="text-gray-400 hover:text-white transition-colors cursor-pointer mr-1 text-lg leading-none"
            title="Back to home"
          >←</button>
          <span className="text-lg">⚔️</span>
          <div>
            <p className="font-semibold text-sm leading-none">
              Chronicle
              {speaking && <span className="ml-2 text-xs text-indigo-400 animate-pulse">● Speaking</span>}
              {justSaved && <span className="ml-2 text-xs text-green-400 animate-pulse">✓ Saved</span>}
            </p>
            <p className="text-gray-500 text-xs">{sessionCode}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isHost && (
            <button onClick={() => setDmOverride(!dmOverride)} className={`text-xs px-2 py-1 rounded border cursor-pointer transition-colors ${dmOverride ? "bg-indigo-600 border-indigo-500 text-white" : "border-gray-600 text-gray-400 hover:border-gray-500"}`}>
              {dmOverride ? "⚡ ON" : "Override"}
            </button>
          )}
          {TAB_BUTTONS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(activeTab === t.id ? null : t.id)}
              className={`text-xs px-2 py-1 rounded border cursor-pointer transition-colors ${activeTab === t.id ? "bg-gray-600 border-gray-500 text-white" : "border-gray-600 text-gray-400 hover:border-gray-500"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chat */}
      <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(m => (
          <div key={m.id} className={`flex gap-3 ${m.role === "player" ? "flex-row-reverse" : ""}`}>
            <div className="text-xl flex-shrink-0 mt-1">{m.role === "dm" ? "🎲" : CLASS_ICONS[character?.class] || "🧙"}</div>
            <div className={`max-w-sm rounded-lg p-3 ${m.isRoll ? "bg-gray-700 border border-gray-600" : m.role === "dm" ? "bg-gray-800 border border-gray-700" : "bg-indigo-900 border border-indigo-700"}`}>
              <p className={`text-xs mb-1 font-semibold ${m.role === "dm" ? "text-indigo-400" : m.isRoll ? "text-yellow-400" : "text-indigo-300"}`}>
                {m.role === "dm" ? "Dungeon Master" : (m.name || "You")}
              </p>
              <div className="text-sm leading-relaxed text-gray-100">
                {m.role === "dm" ? renderMarkdown(m.text) : m.text}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="text-xl">🎲</div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
              <p className="text-xs text-indigo-400 font-semibold mb-2">Dungeon Master</p>
              <div className="flex gap-1">
                {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dice Panel */}
      {activeTab === "dice" && <DiceRoller onRollToChat={handleRollToChat} />}

      {/* Combat Tracker Panel */}
      {activeTab === "combat" && <CombatTracker character={character} currentHp={currentHp} />}

      {/* Character Sheet Panel */}
      {activeTab === "sheet" && character && (() => {
        const ac = calcAC(inventory, character.stats);
        const slotMaxes = getSpellSlotMaxes(character.class, character.level || 1);
        const isSpellcaster = SPELLCASTER_CLASSES.includes(character.class);
        return (
          <div className="bg-gray-800 border-t border-gray-700 flex-shrink-0" style={{ maxHeight: "320px", overflowY: "auto" }}>
            <div className="px-4 py-3">
              {/* Name + Level + AC */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{CLASS_ICONS[character.class]}</span>
                  <div>
                    <p className="font-semibold text-sm leading-none">{character.name}</p>
                    <p className="text-gray-400 text-xs">{character.race} · {character.class}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-gray-700 text-gray-200 text-xs font-bold px-2 py-0.5 rounded" title="Armor Class">AC {ac}</span>
                  <span className="text-gray-400 text-xs">Lvl</span>
                  <button onClick={() => { setCharacter(c => ({ ...c, level: Math.max(1, (c.level||1) - 1) })); setUsedSlots(s => { const m = getSpellSlotMaxes(character.class, Math.max(1,(character.level||1)-1)); return Object.fromEntries(Object.entries(s).map(([k,v])=>[k,Math.min(v,m[k]||0)])); }); }} className="w-5 h-5 bg-gray-700 hover:bg-gray-600 rounded text-white text-xs cursor-pointer flex items-center justify-center">−</button>
                  <span className="text-white font-bold w-5 text-center text-sm">{character.level || 1}</span>
                  <button onClick={() => setCharacter(c => ({ ...c, level: Math.min(20, (c.level||1) + 1) }))} className="w-5 h-5 bg-gray-700 hover:bg-gray-600 rounded text-white text-xs cursor-pointer flex items-center justify-center">+</button>
                </div>
              </div>

              {/* HP Bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">HP</span>
                  <span className={`text-xs font-bold ${currentHp === 0 ? "text-red-400 animate-pulse" : "text-white"}`}>{currentHp} / {character.hp}</span>
                </div>
                <div className="h-2 bg-gray-900 rounded-full overflow-hidden mb-2">
                  <div className={`h-full rounded-full transition-all ${currentHp / character.hp > 0.5 ? "bg-green-500" : currentHp / character.hp > 0.25 ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${Math.max(0, (currentHp / character.hp) * 100)}%` }} />
                </div>
                <div className="flex gap-1">
                  {[1, 5, 10].map(n => (
                    <button key={`d${n}`} onClick={() => setCurrentHp(h => Math.max(0, h - n))}
                      className="flex-1 py-1 bg-red-900 hover:bg-red-700 text-red-300 rounded text-xs cursor-pointer transition-colors">−{n}</button>
                  ))}
                  <div className="w-px bg-gray-600 mx-0.5" />
                  {[1, 5, 10].map(n => (
                    <button key={`h${n}`} onClick={() => setCurrentHp(h => { const next = Math.min(character.hp, h + n); if (next > 0) setDeathSaves({ successes: 0, failures: 0 }); return next; })}
                      className="flex-1 py-1 bg-green-900 hover:bg-green-700 text-green-300 rounded text-xs cursor-pointer transition-colors">+{n}</button>
                  ))}
                </div>
              </div>

              {/* Death Saves — only at 0 HP */}
              {currentHp === 0 && (
                <div className="mb-3 bg-gray-900 rounded p-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-red-400 text-xs font-semibold">💀 Death Saves</span>
                    <div className="flex gap-2 items-center">
                      <button onClick={() => {
                        const roll = rollDie(20);
                        if (roll === 20) { setCurrentHp(1); setDeathSaves({ successes: 0, failures: 0 }); }
                        else if (roll === 1) setDeathSaves(d => ({ ...d, failures: Math.min(3, d.failures + 2) }));
                        else if (roll >= 10) setDeathSaves(d => ({ ...d, successes: Math.min(3, d.successes + 1) }));
                        else setDeathSaves(d => ({ ...d, failures: Math.min(3, d.failures + 1) }));
                      }} className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs cursor-pointer">🎲 Roll</button>
                      <button onClick={() => setDeathSaves({ successes: 0, failures: 0 })} className="text-gray-600 hover:text-gray-400 text-xs cursor-pointer">Reset</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <span className="text-green-400 text-xs">✓</span>
                      {[0,1,2].map(i => <div key={i} onClick={() => setDeathSaves(d => ({ ...d, successes: d.successes === i+1 ? i : i+1 }))} className={`w-4 h-4 rounded-full border cursor-pointer ${i < deathSaves.successes ? "bg-green-500 border-green-400" : "bg-gray-800 border-gray-600"}`} />)}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-red-400 text-xs">✗</span>
                      {[0,1,2].map(i => <div key={i} onClick={() => setDeathSaves(d => ({ ...d, failures: d.failures === i+1 ? i : i+1 }))} className={`w-4 h-4 rounded-full border cursor-pointer ${i < deathSaves.failures ? "bg-red-500 border-red-400" : "bg-gray-800 border-gray-600"}`} />)}
                    </div>
                    {deathSaves.successes >= 3 && <span className="text-green-400 text-xs">Stable!</span>}
                    {deathSaves.failures >= 3 && <span className="text-red-400 text-xs">Dead</span>}
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-6 gap-1 mb-3">
                {Object.entries(character.stats).map(([s, v]) => (
                  <div key={s} className="bg-gray-900 rounded p-1.5 text-center">
                    <p className="text-gray-500 text-xs">{s}</p>
                    <p className="text-white font-bold">{v}</p>
                    <p className="text-indigo-400 text-xs">{modifier(v)}</p>
                  </div>
                ))}
              </div>

              {/* Spell Slots */}
              {isSpellcaster && Object.keys(slotMaxes).length > 0 && (
                <div className="mb-3">
                  <p className="text-gray-400 text-xs mb-1.5 font-semibold">Spell Slots</p>
                  <div className="space-y-1">
                    {Object.entries(slotMaxes).map(([lvl, max]) => {
                      const used = usedSlots[lvl] || 0;
                      return (
                        <div key={lvl} className="flex items-center gap-2">
                          <span className="text-gray-500 text-xs w-6">{ORDINALS[lvl-1]}</span>
                          <div className="flex gap-1">
                            {Array.from({ length: max }).map((_, i) => (
                              <button key={i} onClick={() => setUsedSlots(s => ({ ...s, [lvl]: s[lvl] === i+1 ? i : i+1 }))}
                                className={`w-4 h-4 rounded-full border cursor-pointer transition-colors ${i < used ? "bg-indigo-500 border-indigo-400" : "bg-gray-900 border-gray-600 hover:border-indigo-500"}`} />
                            ))}
                          </div>
                          <span className="text-gray-600 text-xs">{max - used}/{max}</span>
                        </div>
                      );
                    })}
                  </div>
                  <button onClick={() => setUsedSlots({})} className="mt-1.5 text-xs text-gray-600 hover:text-gray-400 cursor-pointer">Long rest (restore all)</button>
                </div>
              )}

              {/* Conditions */}
              <div>
                <p className="text-gray-400 text-xs mb-1.5 font-semibold">Conditions</p>
                <div className="flex flex-wrap gap-1">
                  {CONDITIONS.map(c => {
                    const active = conditions.includes(c);
                    return (
                      <button key={c} onClick={() => setConditions(cs => active ? cs.filter(x => x !== c) : [...cs, c])}
                        className={`text-xs px-1.5 py-0.5 rounded border cursor-pointer transition-colors ${active ? "bg-red-900 border-red-700 text-red-300" : "bg-gray-900 border-gray-700 text-gray-500 hover:border-gray-500"}`}>
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Inventory Panel */}
      {activeTab === "inventory" && (
        <div className="bg-gray-800 border-t border-gray-700 flex-shrink-0" style={{ maxHeight: "260px", overflowY: "auto" }}>
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-sm">Inventory</p>
              <div className="flex items-center gap-1">
                {[-10,-1,1,10].map(n => (
                  <button key={n} onClick={() => setGold(g => Math.max(0, g + n))}
                    className={`px-1.5 py-0.5 rounded text-xs cursor-pointer transition-colors ${n < 0 ? "bg-gray-700 hover:bg-gray-600 text-gray-300" : "bg-yellow-800 hover:bg-yellow-700 text-yellow-300"}`}>
                    {n > 0 ? `+${n}` : n}
                  </button>
                ))}
                <span className="text-yellow-400 text-sm font-semibold ml-1">🪙 {gold}</span>
              </div>
            </div>
            {inventory.length === 0 && <p className="text-gray-500 text-sm text-center py-2">Your pack is empty.</p>}
            <div className="space-y-1">
              {inventory.map(item => (
                <div key={item.id} className="flex items-center gap-2 bg-gray-900 rounded p-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-medium truncate">{item.name}</span>
                      <span className={`text-xs ${TYPE_COLORS[item.type] || "text-gray-400"}`}>{item.type}</span>
                    </div>
                    <p className="text-gray-500 text-xs truncate">{item.desc} · {item.weight} lb</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {item.qty > 1 || item.type === "Consumable" ? (
                      <>
                        <button onClick={() => changeQty(item.id, -1)} className="w-5 h-5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white cursor-pointer flex items-center justify-center">−</button>
                        <span className="text-white text-xs w-4 text-center">{item.qty}</span>
                        <button onClick={() => changeQty(item.id, 1)} className="w-5 h-5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white cursor-pointer flex items-center justify-center">+</button>
                      </>
                    ) : (
                      <span className="text-gray-600 text-xs w-14 text-center">×1</span>
                    )}
                    <button onClick={() => removeItem(item.id)} className="w-5 h-5 bg-red-900 hover:bg-red-700 rounded text-xs text-red-300 cursor-pointer flex items-center justify-center ml-1">✕</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-gray-700 flex justify-between text-xs text-gray-500">
              <span>{inventory.length} items</span>
              <span>{inventory.reduce((a, i) => a + i.weight * i.qty, 0).toFixed(1)} lb total</span>
            </div>
            {/* Add item */}
            <div className="mt-2 pt-2 border-t border-gray-700 flex gap-1">
              <input
                className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white placeholder-gray-600 text-xs focus:outline-none focus:border-indigo-500 flex-1"
                placeholder="Add item…"
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && newItemName.trim()) {
                    setInventory(inv => [...inv, { id: Date.now(), name: newItemName.trim(), type: newItemType, weight: 0, desc: "", qty: 1 }]);
                    setNewItemName("");
                  }
                }}
              />
              <select value={newItemType} onChange={e => setNewItemType(e.target.value)}
                className="bg-gray-900 border border-gray-600 rounded px-1 py-1 text-white text-xs focus:outline-none focus:border-indigo-500 cursor-pointer">
                {Object.keys(TYPE_COLORS).map(t => <option key={t}>{t}</option>)}
              </select>
              <button
                onClick={() => {
                  if (!newItemName.trim()) return;
                  setInventory(inv => [...inv, { id: Date.now(), name: newItemName.trim(), type: newItemType, weight: 0, desc: "", qty: 1 }]);
                  setNewItemName("");
                }}
                className="px-2 py-1 bg-indigo-700 hover:bg-indigo-600 text-white rounded text-xs cursor-pointer transition-colors">
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes Panel */}
      {activeTab === "notes" && (
        <div className="bg-gray-800 border-t border-gray-700 flex-shrink-0" style={{ maxHeight: "260px" }}>
          <textarea
            className="w-full bg-gray-900 text-gray-100 text-sm p-3 resize-none focus:outline-none placeholder-gray-600"
            style={{ height: "180px" }}
            placeholder="Quest notes, NPC names, clues, loot to track…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
      )}

      {/* Input */}
      <div className="p-4 bg-gray-800 border-t border-gray-700 flex-shrink-0">
        <div className="flex gap-2 mb-2">
          <input ref={inputRef} className={inp + " flex-1"} placeholder="What do you do?" value={userInput} onChange={e => setUserInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()} />
          <button className={btn} onClick={sendMessage} disabled={loading}>{loading ? "⏳" : "Send"}</button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {QUICK_ACTIONS.map(a => (
            <button key={a} onClick={() => setUserInput(a)} className="text-xs text-gray-400 border border-gray-700 rounded px-2 py-1 hover:border-gray-500 hover:text-white cursor-pointer transition-colors">{a}</button>
          ))}
        </div>
        <div className="flex justify-end mt-2">
          <button onClick={() => setVoiceEnabled(!voiceEnabled)} className={btnSm}>{voiceEnabled ? "🔊 Voice On" : "🔇 Voice Off"}</button>
        </div>
      </div>
    </div>
  );
}
