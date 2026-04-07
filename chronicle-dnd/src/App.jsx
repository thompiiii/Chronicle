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

// ── D&D 5e Item Database ───────────────────────────────────────────────────
const ITEM_DB = [
  // Weapons — Simple Melee
  { name:"Club",            type:"Weapon", weight:2,    desc:"1d4 bludgeoning · Light" },
  { name:"Dagger",          type:"Weapon", weight:1,    desc:"1d4 piercing · Finesse, Light, Thrown (20/60)" },
  { name:"Greatclub",       type:"Weapon", weight:10,   desc:"1d8 bludgeoning · Two-handed" },
  { name:"Handaxe",         type:"Weapon", weight:2,    desc:"1d6 slashing · Light, Thrown (20/60)" },
  { name:"Javelin",         type:"Weapon", weight:2,    desc:"1d6 piercing · Thrown (30/120)" },
  { name:"Light Hammer",    type:"Weapon", weight:2,    desc:"1d4 bludgeoning · Light, Thrown (20/60)" },
  { name:"Mace",            type:"Weapon", weight:4,    desc:"1d6 bludgeoning" },
  { name:"Quarterstaff",    type:"Weapon", weight:4,    desc:"1d6 bludgeoning · Versatile (1d8)" },
  { name:"Spear",           type:"Weapon", weight:3,    desc:"1d6 piercing · Thrown (20/60), Versatile (1d8)" },
  // Weapons — Simple Ranged
  { name:"Dart",            type:"Weapon", weight:0.25, desc:"1d4 piercing · Finesse, Thrown (20/60)" },
  { name:"Shortbow",        type:"Weapon", weight:2,    desc:"1d6 piercing · Range (80/320), Two-handed" },
  { name:"Sling",           type:"Weapon", weight:0,    desc:"1d4 bludgeoning · Range (30/120)" },
  { name:"Light Crossbow",  type:"Weapon", weight:5,    desc:"1d8 piercing · Range (80/320), Loading, Two-handed" },
  // Weapons — Martial Melee
  { name:"Battleaxe",       type:"Weapon", weight:4,    desc:"1d8 slashing · Versatile (1d10)" },
  { name:"Flail",           type:"Weapon", weight:2,    desc:"1d8 bludgeoning" },
  { name:"Glaive",          type:"Weapon", weight:6,    desc:"1d10 slashing · Heavy, Reach, Two-handed" },
  { name:"Greataxe",        type:"Weapon", weight:7,    desc:"1d12 slashing · Heavy, Two-handed" },
  { name:"Greatsword",      type:"Weapon", weight:6,    desc:"2d6 slashing · Heavy, Two-handed" },
  { name:"Halberd",         type:"Weapon", weight:6,    desc:"1d10 slashing · Heavy, Reach, Two-handed" },
  { name:"Longsword",       type:"Weapon", weight:3,    desc:"1d8 slashing · Versatile (1d10)" },
  { name:"Maul",            type:"Weapon", weight:10,   desc:"2d6 bludgeoning · Heavy, Two-handed" },
  { name:"Morningstar",     type:"Weapon", weight:4,    desc:"1d8 piercing" },
  { name:"Pike",            type:"Weapon", weight:18,   desc:"1d10 piercing · Heavy, Reach, Two-handed" },
  { name:"Rapier",          type:"Weapon", weight:2,    desc:"1d8 piercing · Finesse" },
  { name:"Scimitar",        type:"Weapon", weight:3,    desc:"1d6 slashing · Finesse, Light" },
  { name:"Shortsword",      type:"Weapon", weight:2,    desc:"1d6 piercing · Finesse, Light" },
  { name:"Trident",         type:"Weapon", weight:4,    desc:"1d6 piercing · Thrown (20/60), Versatile (1d8)" },
  { name:"War Pick",        type:"Weapon", weight:2,    desc:"1d8 piercing" },
  { name:"Warhammer",       type:"Weapon", weight:2,    desc:"1d8 bludgeoning · Versatile (1d10)" },
  { name:"Whip",            type:"Weapon", weight:3,    desc:"1d4 slashing · Finesse, Reach" },
  // Weapons — Martial Ranged
  { name:"Hand Crossbow",   type:"Weapon", weight:3,    desc:"1d6 piercing · Range (30/120), Light, Loading" },
  { name:"Heavy Crossbow",  type:"Weapon", weight:18,   desc:"1d10 piercing · Heavy, Range (100/400), Loading, Two-handed" },
  { name:"Longbow",         type:"Weapon", weight:2,    desc:"1d8 piercing · Heavy, Range (150/600), Two-handed" },
  // Armor — Light
  { name:"Leather Armor",   type:"Armor",  weight:10,   desc:"AC 11 + DEX · Light armor" },
  { name:"Padded Armor",    type:"Armor",  weight:8,    desc:"AC 11 + DEX · Light armor, Disadvantage on Stealth" },
  { name:"Studded Leather", type:"Armor",  weight:13,   desc:"AC 12 + DEX · Light armor" },
  // Armor — Medium
  { name:"Chain Shirt",     type:"Armor",  weight:20,   desc:"AC 13 + DEX (max 2) · Medium armor" },
  { name:"Hide Armor",      type:"Armor",  weight:12,   desc:"AC 12 + DEX (max 2) · Medium armor" },
  { name:"Scale Mail",      type:"Armor",  weight:45,   desc:"AC 14 + DEX (max 2) · Medium armor, Disadvantage on Stealth" },
  { name:"Breastplate",     type:"Armor",  weight:20,   desc:"AC 14 + DEX (max 2) · Medium armor" },
  { name:"Half Plate",      type:"Armor",  weight:40,   desc:"AC 15 + DEX (max 2) · Medium armor, Disadvantage on Stealth" },
  // Armor — Heavy
  { name:"Ring Mail",       type:"Armor",  weight:40,   desc:"AC 14 · Heavy armor, Disadvantage on Stealth" },
  { name:"Chain Mail",      type:"Armor",  weight:55,   desc:"AC 16 · Heavy armor, Disadvantage on Stealth, STR 13 required" },
  { name:"Splint Armor",    type:"Armor",  weight:60,   desc:"AC 17 · Heavy armor, Disadvantage on Stealth, STR 15 required" },
  { name:"Plate Armor",     type:"Armor",  weight:65,   desc:"AC 18 · Heavy armor, Disadvantage on Stealth, STR 15 required" },
  { name:"Shield",          type:"Armor",  weight:6,    desc:"+2 AC" },
  // Consumables
  { name:"Health Potion",          type:"Consumable", weight:0.5, desc:"Restores 2d4+2 HP" },
  { name:"Greater Health Potion",  type:"Consumable", weight:0.5, desc:"Restores 4d4+4 HP" },
  { name:"Superior Health Potion", type:"Consumable", weight:0.5, desc:"Restores 8d4+8 HP" },
  { name:"Supreme Health Potion",  type:"Consumable", weight:0.5, desc:"Restores 10d4+20 HP" },
  { name:"Antitoxin",              type:"Consumable", weight:0,   desc:"Advantage on CON saves vs poison for 1 hour" },
  { name:"Alchemist's Fire",       type:"Consumable", weight:1,   desc:"1d4 fire damage/round until extinguished (DC 10 DEX to put out)" },
  { name:"Acid Vial",              type:"Consumable", weight:1,   desc:"2d6 acid damage on hit" },
  { name:"Holy Water",             type:"Consumable", weight:1,   desc:"2d6 radiant damage to undead/fiends" },
  { name:"Healer's Kit",           type:"Consumable", weight:3,   desc:"Stabilize dying creature without Medicine check · 10 uses" },
  { name:"Rations",                type:"Consumable", weight:2,   desc:"One day of food and water" },
  { name:"Torch",                  type:"Consumable", weight:1,   desc:"Bright light 20 ft, dim 20 ft · 1 hour" },
  { name:"Oil Flask",              type:"Consumable", weight:1,   desc:"Coat surface or deal 5 fire damage if ignited" },
  // Tools
  { name:"Thieves' Tools",   type:"Tool", weight:1, desc:"Pick locks and disarm traps" },
  { name:"Herbalism Kit",    type:"Tool", weight:3, desc:"Craft antitoxins and healing potions" },
  { name:"Disguise Kit",     type:"Tool", weight:3, desc:"Create disguises" },
  { name:"Forgery Kit",      type:"Tool", weight:5, desc:"Create forged documents" },
  { name:"Poisoner's Kit",   type:"Tool", weight:2, desc:"Craft and apply poisons" },
  { name:"Navigator's Tools",type:"Tool", weight:2, desc:"Navigate by sea or land" },
  // Misc / Gear
  { name:"Arcane Focus",     type:"Misc", weight:1,  desc:"Spellcasting focus for arcane spells" },
  { name:"Holy Symbol",      type:"Misc", weight:1,  desc:"Spellcasting focus for clerics and paladins" },
  { name:"Druidic Focus",    type:"Misc", weight:2,  desc:"Spellcasting focus for druids" },
  { name:"Spellbook",        type:"Misc", weight:3,  desc:"Contains wizard spells · 100 pages" },
  { name:"Rope (Hempen)",    type:"Misc", weight:10, desc:"50 feet · supports up to 1,500 lbs" },
  { name:"Rope (Silken)",    type:"Misc", weight:5,  desc:"50 feet · supports up to 1,500 lbs" },
  { name:"Backpack",         type:"Misc", weight:5,  desc:"Holds 1 cubic foot / 30 lbs of gear" },
  { name:"Bedroll",          type:"Misc", weight:7,  desc:"For resting outdoors" },
  { name:"Tinderbox",        type:"Misc", weight:1,  desc:"Start a fire in one action" },
  { name:"Grappling Hook",   type:"Misc", weight:4,  desc:"Thrown up to 25 ft to anchor rope" },
  { name:"Crowbar",          type:"Misc", weight:5,  desc:"+2 to STR checks where leverage applies" },
  { name:"Steel Mirror",     type:"Misc", weight:0.5,desc:"See around corners, reflect gaze attacks" },
  { name:"Lantern (Bullseye)",type:"Misc",weight:2,  desc:"Bright light 60 ft cone, dim 60 ft · 6 hours/oil" },
  { name:"Lantern (Hooded)", type:"Misc", weight:2,  desc:"Bright light 30 ft, dim 30 ft · 6 hours/oil" },
  { name:"Compass",          type:"Misc", weight:0,  desc:"+1 to Survival checks for navigation" },
  { name:"Quiver",           type:"Misc", weight:1,  desc:"Holds 20 arrows or bolts" },
  { name:"Explorer's Pack",  type:"Misc", weight:10, desc:"Backpack, bedroll, mess kit, tinderbox, 10 torches, 10 rations, waterskin, 50 ft hempen rope" },
];

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

const card  = "bg-zinc-900 border border-zinc-800 rounded-xl";
const btn   = "px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-bold tracking-wide transition-colors cursor-pointer";
const btnSm = "px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-sm transition-colors cursor-pointer";
const inp   = "bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 w-full";

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
    <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex-shrink-0">
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-xs">Dice</span>
          <button onClick={() => setCount(Math.max(1, count - 1))} className="w-6 h-6 bg-zinc-800 hover:bg-zinc-700 rounded text-white text-sm cursor-pointer flex items-center justify-center">−</button>
          <span className="text-white font-bold w-4 text-center">{count}</span>
          <button onClick={() => setCount(Math.min(10, count + 1))} className="w-6 h-6 bg-zinc-800 hover:bg-zinc-700 rounded text-white text-sm cursor-pointer flex items-center justify-center">+</button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-xs">Mod</span>
          <button onClick={() => setRollMod(m => m - 1)} className="w-6 h-6 bg-zinc-800 hover:bg-zinc-700 rounded text-white text-sm cursor-pointer flex items-center justify-center">−</button>
          <span className="text-white font-bold w-6 text-center">{fmtSign(rollMod)}</span>
          <button onClick={() => setRollMod(m => m + 1)} className="w-6 h-6 bg-zinc-800 hover:bg-zinc-700 rounded text-white text-sm cursor-pointer flex items-center justify-center">+</button>
        </div>
        {lastRoll && (
          <div className="ml-auto text-right">
            <span className={`text-2xl font-bold ${resultColor}`}>{lastRoll.total}</span>
            {lastRoll.isCrit && <span className="ml-1 text-xs text-amber-400">CRIT!</span>}
            {lastRoll.isFumble && <span className="ml-1 text-xs text-red-400">FUMBLE</span>}
            {lastRoll.count > 1 && <p className="text-zinc-500 text-xs">[{lastRoll.rolls.join(", ")}]{lastRoll.modifier !== 0 ? ` ${fmtSign(lastRoll.modifier)}` : ""}</p>}
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
    <div className="bg-zinc-900 border-t border-zinc-800 flex-shrink-0" style={{ maxHeight: "260px", overflowY: "auto" }}>
      <div className="px-4 py-3">
        {/* Header row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-semibold">⚔️ Combat</span>
            {started && <span className="text-zinc-400 text-xs">Round {round}</span>}
          </div>
          <div className="flex gap-1">
            {!started ? (
              <button onClick={() => setStarted(true)} disabled={combatants.length < 2}
                className="px-2 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-black rounded text-xs cursor-pointer transition-colors font-bold">
                Start
              </button>
            ) : (
              <button onClick={nextTurn}
                className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-black rounded text-xs cursor-pointer transition-colors font-bold">
                Next →
              </button>
            )}
            <button onClick={resetCombat}
              className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs cursor-pointer transition-colors">
              Reset
            </button>
          </div>
        </div>

        {/* Combatant list */}
        <div className="space-y-1 mb-2">
          {(started ? sorted : combatants).map((c, i) => {
            const isActive = started && sorted[currentIdx]?.id === c.id;
            return (
              <div key={c.id} className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors ${isActive ? "bg-amber-900/30 border border-amber-700" : "bg-black"}`}>
                <span className="w-3 text-center text-amber-400">{isActive ? "▶" : ""}</span>
                <span className={`flex-1 truncate font-medium ${c.isPlayer ? "text-amber-300" : "text-white"}`}>{c.name}{c.isPlayer ? " (you)" : ""}</span>
                <div className="flex items-center gap-1">
                  {c.isPlayer ? (
                    <button onClick={rollPlayerInit} title="Roll initiative"
                      className="text-zinc-400 hover:text-white cursor-pointer px-1">🎲</button>
                  ) : null}
                  <span className="text-zinc-400 w-14 text-right">Init: <span className="text-white font-bold">{c.initiative}</span></span>
                </div>
                <button onClick={() => remove(c.id)} className="text-zinc-700 hover:text-red-400 cursor-pointer ml-1">✕</button>
              </div>
            );
          })}
          {combatants.length === 0 && <p className="text-zinc-700 text-xs text-center py-1">Add combatants below</p>}
        </div>

        {/* Add combatant form */}
        <div className="flex gap-1 pt-2 border-t border-zinc-800">
          <input
            className="bg-black border border-zinc-700 rounded px-2 py-1 text-white placeholder-zinc-600 text-xs focus:outline-none focus:border-amber-500 flex-1"
            placeholder="Enemy name…"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addCombatant()}
          />
          <input
            className="bg-black border border-zinc-700 rounded px-2 py-1 text-white placeholder-zinc-600 text-xs focus:outline-none focus:border-amber-500 w-14 text-center"
            placeholder="Init"
            type="number"
            value={newInit}
            onChange={e => setNewInit(e.target.value)}
          />
          <button onClick={addCombatant}
            className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-black rounded text-xs cursor-pointer transition-colors font-bold">
            Add
          </button>
        </div>
        <p className="text-zinc-700 text-xs mt-1">Leave Init blank to roll d20 automatically.</p>
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
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="p-4">
        <button onClick={onBack} className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center text-lg cursor-pointer hover:bg-zinc-800 transition-colors">🔥</button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <p className="text-zinc-500 text-lg font-serif mb-2">No saved campaigns</p>
        <p className="text-zinc-700 text-sm mb-8">Start a new adventure and your progress saves automatically.</p>
        <button className={btn} onClick={onBack}>← Back</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="flex items-center gap-3 p-4 border-b border-zinc-900">
        <button onClick={onBack} className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center text-lg cursor-pointer hover:bg-zinc-800 transition-colors">🔥</button>
        <span className="text-zinc-400 text-sm">Saved Campaigns</span>
      </div>
      <div className="px-4 py-3 space-y-1 overflow-y-auto">
        {saves.map((save, i) => (
          <div key={save.id}>
            {confirmDelete === save.id ? (
              <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900 rounded-xl border border-zinc-800">
                <span className="flex-1 text-zinc-400 text-sm">Delete this save?</span>
                <button onClick={() => handleDelete(save.id)} className="px-3 py-1 bg-red-700 hover:bg-red-600 text-white rounded-lg text-xs cursor-pointer">Delete</button>
                <button onClick={() => setConfirmDelete(null)} className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs cursor-pointer">Cancel</button>
              </div>
            ) : (
              <div className="flex items-center px-4 py-4 bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-zinc-800 transition-colors cursor-pointer" onClick={() => onContinue(save)}>
                <span className="text-zinc-600 text-sm w-7 flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{save.character?.name}</p>
                  <p className="text-zinc-500 text-xs">{save.character?.race} · {save.character?.class} · {formatDate(save.savedAt)}</p>
                  {save.preview && <p className="text-zinc-700 text-xs mt-0.5 italic truncate">"{save.preview}"</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <button onClick={e => { e.stopPropagation(); setConfirmDelete(save.id); }} className="text-zinc-700 hover:text-red-400 text-sm cursor-pointer transition-colors">🗑</button>
                  <span className="text-zinc-600 text-lg">›</span>
                </div>
              </div>
            )}
          </div>
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
  const [itemSuggestions, setItemSuggestions] = useState([]);
  const [selectedDbItem, setSelectedDbItem] = useState(null);
  const [charStep, setCharStep] = useState(0);
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
    setCharStep(0);
    setCharName("");
    setScreen("character");
  }

  function joinSession() {
    if (inputCode.trim().length < 4) return;
    setSessionCode(inputCode.toUpperCase());
    setIsHost(false);
    setCharStep(0);
    setCharName("");
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
    const label = result.isCrit ? " — Critical Hit!" : result.isFumble ? " — Fumble!" : "";
    const modStr = result.modifier !== 0 ? fmtSign(result.modifier) : "";
    const detail = result.count > 1 ? ` [${result.rolls.join(", ")}]` : "";
    const rollPart = `[Rolled ${result.count}d${result.sides}${modStr}: **${result.total}**${detail}${label}]`;
    const combined = userInput.trim() ? `${userInput.trim()} ${rollPart}` : rollPart;
    setUserInput("");
    sendMessage(combined);
  }

  async function sendMessage(overrideText) {
    const msg = (typeof overrideText === "string" ? overrideText : userInput).trim();
    if (!msg || loading) return;
    if (typeof overrideText !== "string") setUserInput("");
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
      if (!response.ok) throw new Error(`Server error ${response.status}`);
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
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.text) dmReply += parsed.text;
            } catch (e) {
              if (e.message && e.message !== 'Unexpected end of JSON input') {
                setMessages(prev => [...prev, makeMsg("dm", `⚠️ ${e.message}`)]);
                setLoading(false);
                return;
              }
            }
          }
        }
      }
      if (dmReply) {
        setMessages(prev => [...prev, makeMsg("dm", dmReply)]);
        speakText(dmReply);
        triggerSaveFlash();
      }
    } catch (err) {
      setMessages(prev => [...prev, makeMsg("dm", `⚠️ ${err.message}`)]);
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
      <div className="min-h-screen bg-black text-white flex flex-col">
        <div className="p-4">
          <div className="inline-flex items-center bg-zinc-900 rounded-full px-3 py-2">
            <span className="text-lg">🔥</span>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-10">
          <div className="text-center">
            <h1 className="text-5xl font-serif font-bold mb-2 tracking-tight">Chronicle</h1>
            <p className="text-zinc-600 text-xs tracking-widest uppercase">AI Dungeon Master · D&D 5e</p>
          </div>
          <div className="w-full max-w-xs space-y-4">
            <div className="text-center">
              <p className="text-zinc-600 text-sm mb-2 font-serif">Your name…</p>
              <input
                className="w-full bg-transparent border-0 border-b border-zinc-800 text-white text-2xl font-serif text-center pb-2 focus:outline-none focus:border-amber-500 placeholder-zinc-800 transition-colors"
                placeholder="Type here…"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && createSession()}
              />
            </div>
            <button
              className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-black font-bold text-lg rounded-2xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
              onClick={createSession}
            >
              ▶ BEGIN
            </button>
            {hasSaves && (
              <button
                className="w-full py-3 bg-transparent border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white rounded-2xl font-semibold transition-colors cursor-pointer"
                onClick={() => setScreen("saves")}
              >
                Continue Campaign
              </button>
            )}
            {/* Join with session code */}
            <div className="pt-2">
              <p className="text-zinc-700 text-xs text-center mb-2 tracking-widest uppercase">Join a session</p>
              <div className="flex gap-2 items-center">
                <input
                  className="flex-1 bg-transparent border-b border-zinc-800 text-white text-center text-lg font-mono pb-1 focus:outline-none focus:border-amber-500 placeholder-zinc-800 tracking-widest uppercase transition-colors"
                  placeholder="CODE"
                  value={inputCode}
                  onChange={e => setInputCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  onKeyDown={e => e.key === "Enter" && joinSession()}
                />
                <button
                  onClick={joinSession}
                  disabled={inputCode.trim().length < 4}
                  className="text-zinc-500 hover:text-amber-400 disabled:opacity-30 text-sm font-bold cursor-pointer transition-colors tracking-wide"
                >
                  JOIN →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (screen === "character") {
    // Step 0: Name
    if (charStep === 0) return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <div className="flex items-center justify-between p-4">
          <button onClick={() => setScreen("home")} className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center text-lg cursor-pointer hover:bg-zinc-800 transition-colors">🔥</button>
          <div className="flex items-center gap-3">
            {sessionCode && <span className="text-amber-500 font-mono font-bold tracking-widest text-sm">{sessionCode}</span>}
            <span className="text-zinc-600 text-sm">Step 1 of 3</span>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-10">
          <p className="text-zinc-500 text-lg font-serif">Enter your character's name…</p>
          <input
            className="w-full bg-transparent border-0 text-center text-4xl font-serif text-zinc-300 placeholder-zinc-800 focus:outline-none focus:text-white transition-colors"
            placeholder="Type here…"
            value={charName}
            onChange={e => setCharName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && charName.trim() && setCharStep(1)}
            autoFocus
          />
          <button
            className="px-12 py-4 bg-amber-500 hover:bg-amber-400 text-black font-bold text-lg rounded-2xl flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-40"
            disabled={!charName.trim()}
            onClick={() => charName.trim() && setCharStep(1)}
          >
            ▶ START
          </button>
        </div>
      </div>
    );

    // Step 1: Class
    if (charStep === 1) return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <div className="flex items-center justify-between p-4">
          <button onClick={() => setCharStep(0)} className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center text-lg cursor-pointer hover:bg-zinc-800 transition-colors">🔥</button>
          <span className="text-zinc-600 text-sm">Step 2 of 3</span>
        </div>
        <div className="px-4 py-2 flex flex-col flex-1 overflow-y-auto">
          <p className="text-zinc-500 text-lg mb-4 font-serif">Select a class…</p>
          <div className="space-y-1">
            {CLASSES.map((c, i) => (
              <button key={c} onClick={() => { setCharClass(c); setCharStep(2); }}
                className={`w-full flex items-center px-4 py-4 rounded-xl border transition-colors cursor-pointer ${charClass === c ? "bg-zinc-800 border-amber-500" : "bg-zinc-900 border-zinc-800 hover:bg-zinc-800"}`}>
                <span className="text-zinc-600 text-sm w-7 text-left">{i + 1}</span>
                <span className="text-lg mr-3">{CLASS_ICONS[c]}</span>
                <span className="flex-1 text-left text-white text-base font-medium">{c}</span>
                <span className="text-zinc-600 text-lg">›</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );

    // Step 2: Race
    if (charStep === 2) return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <div className="flex items-center justify-between p-4">
          <button onClick={() => setCharStep(1)} className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center text-lg cursor-pointer hover:bg-zinc-800 transition-colors">🔥</button>
          <span className="text-zinc-600 text-sm">Step 3 of 3</span>
        </div>
        <div className="px-4 py-2 flex flex-col flex-1 overflow-y-auto">
          <p className="text-zinc-500 text-lg mb-4 font-serif">Choose your race…</p>
          <div className="space-y-1">
            {RACES.map((r, i) => (
              <button key={r} onClick={() => { setCharRace(r); setCharStep(3); }}
                className={`w-full flex items-center px-4 py-4 rounded-xl border transition-colors cursor-pointer ${charRace === r ? "bg-zinc-800 border-amber-500" : "bg-zinc-900 border-zinc-800 hover:bg-zinc-800"}`}>
                <span className="text-zinc-600 text-sm w-7 text-left">{i + 1}</span>
                <span className="flex-1 text-left text-white text-base font-medium">{r}</span>
                <span className="text-zinc-600 text-lg">›</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );

    // Step 3: Stats
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <div className="flex items-center justify-between p-4">
          <button onClick={() => setCharStep(2)} className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center text-lg cursor-pointer hover:bg-zinc-800 transition-colors">🔥</button>
          <span className="text-zinc-600 text-sm">{charName} · {charClass}</span>
        </div>
        <div className="px-4 py-2 flex-1 overflow-y-auto">
          <p className="text-zinc-500 text-lg mb-4 font-serif">Set your ability scores…</p>
          <div className="flex items-center justify-between mb-3">
            <span className="text-zinc-600 text-sm">Roll 4d6, drop lowest</span>
            <button onClick={autoGenerateCharacter} className={btnSm}>🎲 Roll Stats</button>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-6">
            {Object.entries(stats).map(([stat, val]) => (
              <div key={stat} className="flex flex-col items-center bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                <p className="text-zinc-500 text-xs mb-1">{stat}</p>
                <p className="text-white text-2xl font-bold">{val}</p>
                <p className="text-amber-500 text-xs mb-2">{modifier(val)}</p>
                <div className="flex gap-2">
                  <button onClick={() => setStats(s => ({ ...s, [stat]: Math.max(3, s[stat] - 1) }))} className="w-6 h-6 bg-zinc-800 hover:bg-zinc-700 rounded text-white text-sm cursor-pointer flex items-center justify-center">−</button>
                  <button onClick={() => setStats(s => ({ ...s, [stat]: Math.min(20, s[stat] + 1) }))} className="w-6 h-6 bg-zinc-800 hover:bg-zinc-700 rounded text-white text-sm cursor-pointer flex items-center justify-center">+</button>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-black font-bold text-lg rounded-2xl transition-colors cursor-pointer" onClick={enterGame}>
            Enter the Campaign →
          </button>
        </div>
      </div>
    );
  }

  if (screen === "game") return (
    <div className="h-screen bg-black text-white flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black border-b border-zinc-900 flex-shrink-0">
        <button
          onClick={() => setScreen("home")}
          className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center text-lg cursor-pointer hover:bg-zinc-800 transition-colors flex-shrink-0"
          title="Back to home"
        >🔥</button>
        <div className="flex items-center gap-2">
          {sessionCode && <span className="text-amber-600 font-mono text-xs font-bold tracking-widest">{sessionCode}</span>}
          {speaking && <span className="text-xs text-amber-400 animate-pulse">● Speaking</span>}
          {justSaved && <span className="text-xs text-green-400">✓</span>}
          {TAB_BUTTONS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(activeTab === t.id ? null : t.id)}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-base cursor-pointer transition-colors ${activeTab === t.id ? "bg-amber-500 text-black" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"}`}>
              {t.label.split(" ")[0]}
            </button>
          ))}
          <button onClick={() => setVoiceEnabled(!voiceEnabled)}
            className="w-9 h-9 rounded-full bg-zinc-900 flex items-center justify-center text-base cursor-pointer hover:bg-zinc-800 transition-colors">
            {voiceEnabled ? "🔊" : "🔇"}
          </button>
        </div>
      </div>

      {/* Story / Chat */}
      <div ref={chatRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {messages.map(m => (
          m.role === "dm" ? (
            <div key={m.id} className="bg-zinc-900 rounded-2xl px-5 py-4">
              <div className="text-white text-lg font-serif leading-relaxed">
                {renderMarkdown(m.text)}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex justify-end px-1">
              <p className={`text-sm text-right max-w-xs leading-relaxed ${m.isRoll ? "text-amber-400 font-medium" : "text-zinc-500"}`}>
                {m.text}
              </p>
            </div>
          )
        ))}
        {loading && (
          <div className="bg-zinc-900 rounded-2xl px-5 py-4">
            <div className="flex gap-1.5 items-center">
              {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
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
          <div className="bg-zinc-900 border-t border-zinc-800 flex-shrink-0" style={{ maxHeight: "320px", overflowY: "auto" }}>
            <div className="px-4 py-3">
              {/* Name + Level + AC */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{CLASS_ICONS[character.class]}</span>
                  <div>
                    <p className="font-semibold text-sm leading-none">{character.name}</p>
                    <p className="text-zinc-400 text-xs">{character.race} · {character.class}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-zinc-800 text-zinc-200 text-xs font-bold px-2 py-0.5 rounded-lg" title="Armor Class">AC {ac}</span>
                  <span className="text-zinc-500 text-xs">Lvl</span>
                  <button onClick={() => { setCharacter(c => ({ ...c, level: Math.max(1, (c.level||1) - 1) })); setUsedSlots(s => { const m = getSpellSlotMaxes(character.class, Math.max(1,(character.level||1)-1)); return Object.fromEntries(Object.entries(s).map(([k,v])=>[k,Math.min(v,m[k]||0)])); }); }} className="w-5 h-5 bg-zinc-800 hover:bg-zinc-700 rounded text-white text-xs cursor-pointer flex items-center justify-center">−</button>
                  <span className="text-white font-bold w-5 text-center text-sm">{character.level || 1}</span>
                  <button onClick={() => setCharacter(c => ({ ...c, level: Math.min(20, (c.level||1) + 1) }))} className="w-5 h-5 bg-zinc-800 hover:bg-zinc-700 rounded text-white text-xs cursor-pointer flex items-center justify-center">+</button>
                </div>
              </div>

              {/* HP Bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-zinc-500">HP</span>
                  <span className={`text-xs font-bold ${currentHp === 0 ? "text-red-400 animate-pulse" : "text-white"}`}>{currentHp} / {character.hp}</span>
                </div>
                <div className="h-2 bg-black rounded-full overflow-hidden mb-2">
                  <div className={`h-full rounded-full transition-all ${currentHp / character.hp > 0.5 ? "bg-green-500" : currentHp / character.hp > 0.25 ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${Math.max(0, (currentHp / character.hp) * 100)}%` }} />
                </div>
                <div className="flex gap-1">
                  {[1, 5, 10].map(n => (
                    <button key={`d${n}`} onClick={() => setCurrentHp(h => Math.max(0, h - n))}
                      className="flex-1 py-1 bg-red-900/60 hover:bg-red-800 text-red-300 rounded-lg text-xs cursor-pointer transition-colors">−{n}</button>
                  ))}
                  <div className="w-px bg-zinc-700 mx-0.5" />
                  {[1, 5, 10].map(n => (
                    <button key={`h${n}`} onClick={() => setCurrentHp(h => { const next = Math.min(character.hp, h + n); if (next > 0) setDeathSaves({ successes: 0, failures: 0 }); return next; })}
                      className="flex-1 py-1 bg-green-900/60 hover:bg-green-800 text-green-300 rounded-lg text-xs cursor-pointer transition-colors">+{n}</button>
                  ))}
                </div>
              </div>

              {/* Death Saves — only at 0 HP */}
              {currentHp === 0 && (
                <div className="mb-3 bg-black rounded-xl p-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-red-400 text-xs font-semibold">💀 Death Saves</span>
                    <div className="flex gap-2 items-center">
                      <button onClick={() => {
                        const roll = rollDie(20);
                        if (roll === 20) { setCurrentHp(1); setDeathSaves({ successes: 0, failures: 0 }); }
                        else if (roll === 1) setDeathSaves(d => ({ ...d, failures: Math.min(3, d.failures + 2) }));
                        else if (roll >= 10) setDeathSaves(d => ({ ...d, successes: Math.min(3, d.successes + 1) }));
                        else setDeathSaves(d => ({ ...d, failures: Math.min(3, d.failures + 1) }));
                      }} className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-xs cursor-pointer">🎲 Roll</button>
                      <button onClick={() => setDeathSaves({ successes: 0, failures: 0 })} className="text-zinc-600 hover:text-zinc-400 text-xs cursor-pointer">Reset</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <span className="text-green-400 text-xs">✓</span>
                      {[0,1,2].map(i => <div key={i} onClick={() => setDeathSaves(d => ({ ...d, successes: d.successes === i+1 ? i : i+1 }))} className={`w-4 h-4 rounded-full border cursor-pointer ${i < deathSaves.successes ? "bg-green-500 border-green-400" : "bg-zinc-900 border-zinc-700"}`} />)}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-red-400 text-xs">✗</span>
                      {[0,1,2].map(i => <div key={i} onClick={() => setDeathSaves(d => ({ ...d, failures: d.failures === i+1 ? i : i+1 }))} className={`w-4 h-4 rounded-full border cursor-pointer ${i < deathSaves.failures ? "bg-red-500 border-red-400" : "bg-zinc-900 border-zinc-700"}`} />)}
                    </div>
                    {deathSaves.successes >= 3 && <span className="text-green-400 text-xs">Stable!</span>}
                    {deathSaves.failures >= 3 && <span className="text-red-400 text-xs">Dead</span>}
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-6 gap-1 mb-3">
                {Object.entries(character.stats).map(([s, v]) => (
                  <div key={s} className="bg-black rounded-xl p-1.5 text-center">
                    <p className="text-zinc-600 text-xs">{s}</p>
                    <p className="text-white font-bold">{v}</p>
                    <p className="text-amber-500 text-xs">{modifier(v)}</p>
                  </div>
                ))}
              </div>

              {/* Spell Slots */}
              {isSpellcaster && Object.keys(slotMaxes).length > 0 && (
                <div className="mb-3">
                  <p className="text-zinc-500 text-xs mb-1.5 font-semibold">Spell Slots</p>
                  <div className="space-y-1">
                    {Object.entries(slotMaxes).map(([lvl, max]) => {
                      const used = usedSlots[lvl] || 0;
                      return (
                        <div key={lvl} className="flex items-center gap-2">
                          <span className="text-zinc-600 text-xs w-6">{ORDINALS[lvl-1]}</span>
                          <div className="flex gap-1">
                            {Array.from({ length: max }).map((_, i) => (
                              <button key={i} onClick={() => setUsedSlots(s => ({ ...s, [lvl]: s[lvl] === i+1 ? i : i+1 }))}
                                className={`w-4 h-4 rounded-full border cursor-pointer transition-colors ${i < used ? "bg-amber-500 border-amber-400" : "bg-black border-zinc-700 hover:border-amber-600"}`} />
                            ))}
                          </div>
                          <span className="text-zinc-700 text-xs">{max - used}/{max}</span>
                        </div>
                      );
                    })}
                  </div>
                  <button onClick={() => setUsedSlots({})} className="mt-1.5 text-xs text-zinc-700 hover:text-zinc-400 cursor-pointer">Long rest (restore all)</button>
                </div>
              )}

              {/* Conditions */}
              <div>
                <p className="text-zinc-500 text-xs mb-1.5 font-semibold">Conditions</p>
                <div className="flex flex-wrap gap-1">
                  {CONDITIONS.map(c => {
                    const active = conditions.includes(c);
                    return (
                      <button key={c} onClick={() => setConditions(cs => active ? cs.filter(x => x !== c) : [...cs, c])}
                        className={`text-xs px-1.5 py-0.5 rounded-lg border cursor-pointer transition-colors ${active ? "bg-red-900/60 border-red-700 text-red-300" : "bg-black border-zinc-800 text-zinc-600 hover:border-zinc-600"}`}>
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
        <div className="bg-zinc-900 border-t border-zinc-800 flex-shrink-0" style={{ maxHeight: "260px", overflowY: "auto" }}>
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-sm">Inventory</p>
              <div className="flex items-center gap-1">
                {[-10,-1,1,10].map(n => (
                  <button key={n} onClick={() => setGold(g => Math.max(0, g + n))}
                    className={`px-1.5 py-0.5 rounded-lg text-xs cursor-pointer transition-colors ${n < 0 ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-300" : "bg-amber-900/40 hover:bg-amber-900/70 text-amber-400"}`}>
                    {n > 0 ? `+${n}` : n}
                  </button>
                ))}
                <span className="text-amber-400 text-sm font-semibold ml-1">🪙 {gold}</span>
              </div>
            </div>
            {inventory.length === 0 && <p className="text-zinc-600 text-sm text-center py-2">Your pack is empty.</p>}
            <div className="space-y-1">
              {inventory.map(item => (
                <div key={item.id} className="flex items-center gap-2 bg-black rounded-xl p-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-medium truncate">{item.name}</span>
                      <span className={`text-xs ${TYPE_COLORS[item.type] || "text-zinc-400"}`}>{item.type}</span>
                    </div>
                    <p className="text-zinc-600 text-xs truncate">{item.desc} · {item.weight} lb</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {item.qty > 1 || item.type === "Consumable" ? (
                      <>
                        <button onClick={() => changeQty(item.id, -1)} className="w-5 h-5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-white cursor-pointer flex items-center justify-center">−</button>
                        <span className="text-white text-xs w-4 text-center">{item.qty}</span>
                        <button onClick={() => changeQty(item.id, 1)} className="w-5 h-5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-white cursor-pointer flex items-center justify-center">+</button>
                      </>
                    ) : (
                      <span className="text-zinc-700 text-xs w-14 text-center">×1</span>
                    )}
                    <button onClick={() => removeItem(item.id)} className="w-5 h-5 bg-red-900/50 hover:bg-red-800 rounded text-xs text-red-400 cursor-pointer flex items-center justify-center ml-1">✕</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-zinc-800 flex justify-between text-xs text-zinc-600">
              <span>{inventory.length} items</span>
              <span>{inventory.reduce((a, i) => a + i.weight * i.qty, 0).toFixed(1)} lb total</span>
            </div>
            {/* Add item with autocomplete */}
            <div className="mt-2 pt-2 border-t border-zinc-800">
              {/* Suggestions */}
              {itemSuggestions.length > 0 && (
                <div className="mb-1 rounded-lg border border-zinc-800 overflow-hidden">
                  {itemSuggestions.map(item => (
                    <button
                      key={item.name}
                      onClick={() => {
                        setNewItemName(item.name);
                        setNewItemType(item.type);
                        setSelectedDbItem(item);
                        setItemSuggestions([]);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-left transition-colors cursor-pointer border-b border-zinc-800 last:border-0"
                    >
                      <span className={`text-xs font-medium w-14 flex-shrink-0 ${TYPE_COLORS[item.type]}`}>{item.type}</span>
                      <span className="text-white text-xs font-medium flex-shrink-0">{item.name}</span>
                      <span className="text-zinc-600 text-xs truncate">{item.desc}</span>
                      <span className="text-zinc-700 text-xs flex-shrink-0 ml-auto">{item.weight} lb</span>
                    </button>
                  ))}
                </div>
              )}
              {/* Selected item preview */}
              {selectedDbItem && (
                <div className="mb-1 px-2 py-1 bg-amber-900/20 border border-amber-900/40 rounded-lg">
                  <p className="text-amber-400 text-xs">{selectedDbItem.desc} · {selectedDbItem.weight} lb</p>
                </div>
              )}
              <div className="flex gap-1">
                <input
                  className="bg-black border border-zinc-800 rounded-lg px-2 py-1 text-white placeholder-zinc-700 text-xs focus:outline-none focus:border-amber-500 flex-1"
                  placeholder="Search or add item…"
                  value={newItemName}
                  onChange={e => {
                    const val = e.target.value;
                    setNewItemName(val);
                    setSelectedDbItem(null);
                    if (val.trim().length >= 2) {
                      const q = val.toLowerCase();
                      setItemSuggestions(ITEM_DB.filter(i => i.name.toLowerCase().includes(q)).slice(0, 6));
                    } else {
                      setItemSuggestions([]);
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter" && newItemName.trim()) {
                      const base = selectedDbItem || { name: newItemName.trim(), type: newItemType, weight: 0, desc: "" };
                      setInventory(inv => [...inv, { ...base, id: Date.now(), qty: 1 }]);
                      setNewItemName(""); setSelectedDbItem(null); setItemSuggestions([]);
                    }
                    if (e.key === "Escape") setItemSuggestions([]);
                  }}
                />
                {!selectedDbItem && (
                  <select value={newItemType} onChange={e => setNewItemType(e.target.value)}
                    className="bg-black border border-zinc-800 rounded-lg px-1 py-1 text-white text-xs focus:outline-none focus:border-amber-500 cursor-pointer">
                    {Object.keys(TYPE_COLORS).map(t => <option key={t}>{t}</option>)}
                  </select>
                )}
                <button
                  onClick={() => {
                    if (!newItemName.trim()) return;
                    const base = selectedDbItem || { name: newItemName.trim(), type: newItemType, weight: 0, desc: "" };
                    setInventory(inv => [...inv, { ...base, id: Date.now(), qty: 1 }]);
                    setNewItemName(""); setSelectedDbItem(null); setItemSuggestions([]);
                  }}
                  className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-black rounded-lg text-xs cursor-pointer transition-colors font-bold flex-shrink-0">
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notes Panel */}
      {activeTab === "notes" && (
        <div className="flex-shrink-0 border-t border-zinc-800" style={{ maxHeight: "300px", background: "#0f0a04" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-amber-900/30">
            <div className="flex items-center gap-2">
              <span className="text-amber-600 text-sm">📜</span>
              <span className="text-amber-700 text-xs font-serif tracking-widest uppercase">Quest Log</span>
              {character && <span className="text-amber-900 text-xs font-serif">— {character.name}</span>}
            </div>
            <div className="flex gap-1">
              {["Quest", "NPC", "Item", "Clue"].map(tag => (
                <button
                  key={tag}
                  onClick={() => setNotes(n => n + (n && !n.endsWith("\n") ? "\n" : "") + `\n[ ${tag} ] `)}
                  className="text-xs text-amber-800 hover:text-amber-500 border border-amber-900/40 hover:border-amber-700 rounded px-1.5 py-0.5 cursor-pointer transition-colors font-serif"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          {/* Textarea */}
          <textarea
            className="w-full resize-none focus:outline-none font-serif text-sm leading-relaxed px-4 py-3"
            style={{
              height: "200px",
              background: "#0f0a04",
              color: "#c8a96e",
              caretColor: "#c8a96e",
            }}
            placeholder={"Write your notes here...\n\nUse the tags above to organize quests, NPCs, items, and clues."}
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
      )}

      {/* Input Bar */}
      <div className="flex-shrink-0 bg-black border-t border-zinc-900 px-4 pt-3 pb-4">
        <div className="flex gap-2 mb-2 items-start">
          <textarea
            ref={inputRef}
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-base font-serif placeholder-zinc-700 focus:outline-none focus:border-amber-500 resize-none transition-colors"
            rows={2}
            placeholder="What do you do?"
            value={userInput}
            onChange={e => setUserInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          />
          <button
            onClick={() => {
              const roll = rollDie(20);
              const label = roll === 20 ? " — Critical Hit!" : roll === 1 ? " — Fumble!" : "";
              const rollPart = `[Rolled d20: **${roll}**${label}]`;
              const combined = userInput.trim() ? `${userInput.trim()} ${rollPart}` : rollPart;
              setUserInput("");
              sendMessage(combined);
            }}
            disabled={loading}
            title="Quick roll d20"
            className="w-10 h-10 mt-1 rounded-xl bg-zinc-900 hover:bg-amber-500 hover:text-black border border-zinc-800 text-base flex items-center justify-center cursor-pointer transition-colors disabled:opacity-30 flex-shrink-0"
          >🎲</button>
        </div>
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => sendMessage()}
            disabled={loading || !userInput.trim()}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white rounded-2xl font-bold text-xs tracking-widest disabled:opacity-30 cursor-pointer transition-colors">
            ✏️ TAKE A TURN
          </button>
          <button
            onClick={() => sendMessage("Continue the story.")}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white rounded-2xl font-bold text-xs tracking-widest disabled:opacity-30 cursor-pointer transition-colors">
            ✦ CONTINUE
          </button>
          <button
            onClick={() => { const last = [...messages].reverse().find(m => m.role === "player" && !m.isRoll); if (last) sendMessage(last.text); }}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white rounded-2xl font-bold text-xs tracking-widest disabled:opacity-30 cursor-pointer transition-colors">
            ↺ RETRY
          </button>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {QUICK_ACTIONS.map(a => (
            <button key={a} onClick={() => setUserInput(a)}
              className="text-xs text-zinc-600 border border-zinc-900 rounded-full px-3 py-1 hover:border-zinc-700 hover:text-zinc-400 cursor-pointer transition-colors">{a}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
