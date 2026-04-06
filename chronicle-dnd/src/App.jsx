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
];

// Tailwind class constants — module-level so they're not recreated each render
const card  = "bg-gray-800 border border-gray-700 rounded-lg";
const btn   = "px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors cursor-pointer";
const btnSm = "px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors cursor-pointer";
const inp   = "bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-full";

function rollDie(sides) { return Math.floor(Math.random() * sides) + 1; }

function modifier(score) {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

// Formats a signed integer for display: 0 → "+0", -2 → "-2", 3 → "+3"
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
      {/* Count + Modifier */}
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

      {/* Dice Buttons */}
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
  const chatRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    return () => window.speechSynthesis?.cancel();
  }, []);

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
    const char = { name: charName || `${charRace} ${charClass}`, class: charClass, race: charRace, stats, hp: 10 + Math.floor((stats.CON - 10) / 2) };
    setCharacter(char);
    setInventory(getStartingInventory(charClass));
    setGold(Math.floor(Math.random() * 15) + 5);
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
    const nextMessages = [...messages, makeMsg("player", msg, { name: character?.name })];
    setMessages(nextMessages);
    setLoading(true);

    const dmMsgId = msgIdCounter++;
    setMessages(prev => [...prev, { id: dmMsgId, role: "dm", text: "" }]);

    try {
      const res = await fetch("http://localhost:3001/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, character }),
      });

      if (!res.ok) throw new Error(`Server error ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;
          try {
            const { text, error } = JSON.parse(payload);
            if (error) throw new Error(error);
            fullText += text;
            setMessages(prev => prev.map(m => m.id === dmMsgId ? { ...m, text: fullText } : m));
          } catch {}
        }
      }

      speakText(fullText);
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === dmMsgId ? { ...m, text: `⚠️ ${err.message}` } : m
      ));
    } finally {
      setLoading(false);
    }
  }

  function speakText(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.88; utterance.pitch = 0.75;
    const voices = window.speechSynthesis.getVoices();
    const deep = voices.find(v => v.name.toLowerCase().includes("daniel") || v.lang === "en-GB");
    if (deep) utterance.voice = deep;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  if (screen === "home") return (
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
        <button className={`${btn} w-full py-3`} onClick={createSession}>🏰 Create Campaign (Host)</button>
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
          <span className="text-lg">⚔️</span>
          <div>
            <p className="font-semibold text-sm leading-none">
              Chronicle
              {speaking && <span className="ml-2 text-xs text-indigo-400 animate-pulse">● Speaking</span>}
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

      {/* Dice Panel */}
      {activeTab === "dice" && <DiceRoller onRollToChat={handleRollToChat} />}

      {/* Character Sheet Panel */}
      {activeTab === "sheet" && character && (
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex-shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">{CLASS_ICONS[character.class]}</span>
            <div>
              <p className="font-semibold">{character.name}</p>
              <p className="text-gray-400 text-xs">{character.race} · {character.class} · HP: {character.hp}</p>
            </div>
          </div>
          <div className="grid grid-cols-6 gap-1">
            {Object.entries(character.stats).map(([s, v]) => (
              <div key={s} className="bg-gray-900 rounded p-1.5 text-center">
                <p className="text-gray-500 text-xs">{s}</p>
                <p className="text-white font-bold">{v}</p>
                <p className="text-indigo-400 text-xs">{modifier(v)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inventory Panel */}
      {activeTab === "inventory" && (
        <div className="bg-gray-800 border-b border-gray-700 flex-shrink-0" style={{ maxHeight: "240px", overflowY: "auto" }}>
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-sm">Inventory</p>
              <span className="text-yellow-400 text-sm font-semibold">🪙 {gold} gp</span>
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
          </div>
        </div>
      )}

      {/* Chat */}
      <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(m => (
          <div key={m.id} className={`flex gap-3 ${m.role === "player" ? "flex-row-reverse" : ""}`}>
            <div className="text-xl flex-shrink-0 mt-1">{m.role === "dm" ? "🎲" : CLASS_ICONS[character?.class] || "🧙"}</div>
            <div className={`max-w-sm rounded-lg p-3 ${m.isRoll ? "bg-gray-700 border border-gray-600" : m.role === "dm" ? "bg-gray-800 border border-gray-700" : "bg-indigo-900 border border-indigo-700"}`}>
              <p className={`text-xs mb-1 font-semibold ${m.role === "dm" ? "text-indigo-400" : m.isRoll ? "text-yellow-400" : "text-indigo-300"}`}>
                {m.role === "dm" ? "Dungeon Master" : (m.name || "You")}
              </p>
              <p className="text-sm leading-relaxed text-gray-100">{m.text}</p>
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

      {/* Input */}
      <div className="p-4 bg-gray-800 border-t border-gray-700 flex-shrink-0">
        <div className="flex gap-2 mb-2">
          <input className={inp + " flex-1"} placeholder="What do you do?" value={userInput} onChange={e => setUserInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()} />
          <button className={btn} onClick={sendMessage} disabled={loading}>{loading ? "⏳" : "Send"}</button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {QUICK_ACTIONS.map(a => (
            <button key={a} onClick={() => setUserInput(a)} className="text-xs text-gray-400 border border-gray-700 rounded px-2 py-1 hover:border-gray-500 hover:text-white cursor-pointer transition-colors">{a}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
