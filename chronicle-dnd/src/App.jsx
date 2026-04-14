import { useState, useEffect, useRef } from "react";
import { processTurn, applyTurnToState, formatRollSummary, shouldRoll } from "./game/gameEngine";
import { getNarration } from "./game/aiClient";
import { lookupEnemy, startEncounter, resolveEncounterRound, rollLoot } from "./game/encounterEngine";
import { createCampaignState } from "./game/campaignEngine";
import { goblinCaveCampaign } from "./campaigns/goblinCave";
import CampaignScreen from "./components/CampaignScreen";

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
  { name:"Arrows",                 type:"Consumable", weight:1,   desc:"Ammunition for bows · 20 arrows" },
  { name:"Bolts",                  type:"Consumable", weight:1.5, desc:"Ammunition for crossbows · 20 bolts" },
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
  { name:"Lute",             type:"Misc", weight:2,  desc:"Musical instrument · Bardic Inspiration focus" },
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

const BACKGROUNDS = [
  { id: "acolyte",   label: "Acolyte",   desc: "Served in a temple" },
  { id: "criminal",  label: "Criminal",  desc: "Life of crime and stealth" },
  { id: "folk-hero", label: "Folk Hero", desc: "Champion of the common people" },
  { id: "noble",     label: "Noble",     desc: "Born to wealth and privilege" },
  { id: "sage",      label: "Sage",      desc: "Scholarly seeker of knowledge" },
  { id: "soldier",   label: "Soldier",   desc: "Trained for war" },
];

const DM_THINKING = [
  "The Dungeon Master ponders...",
  "Rolling behind the screen...",
  "Consulting the ancient tomes...",
  "The fates are deciding...",
  "Shadows stir in the darkness...",
];

const TAB_BUTTONS = [
  { id: "dice",      label: "🎲 Dice" },
  { id: "sheet",     label: "📜 Sheet" },
  { id: "inventory", label: "🎒 Bag" },
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

function getPortrait(cls) {
  return CLASS_ICONS[cls] || "⚔️";
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
          return <strong key={j} style={{ color: "var(--c-text)", fontWeight: 600 }}>{chunk.slice(2, -2)}</strong>;
        if (chunk.startsWith("*") && chunk.endsWith("*"))
          return <em key={j} style={{ color: "var(--c-text-dim)", fontStyle: "italic" }}>{chunk.slice(1, -1)}</em>;
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

  return (
    <div className="c-panel">
      <div className="c-dice-controls">
        <div className="c-counter-group">
          <span className="c-counter-lbl">Dice</span>
          <button onClick={() => setCount(Math.max(1, count - 1))} className="c-counter-btn">−</button>
          <span className="c-counter-val">{count}</span>
          <button onClick={() => setCount(Math.min(10, count + 1))} className="c-counter-btn">+</button>
        </div>
        <div className="c-counter-group">
          <span className="c-counter-lbl">Mod</span>
          <button onClick={() => setRollMod(m => m - 1)} className="c-counter-btn">−</button>
          <span className="c-counter-val">{fmtSign(rollMod)}</span>
          <button onClick={() => setRollMod(m => m + 1)} className="c-counter-btn">+</button>
        </div>
        {lastRoll && (
          <div className="c-dice-result">
            <div className={`c-dice-result-val${lastRoll.isCrit ? " crit" : lastRoll.isFumble ? " fumble" : ""}`}>{lastRoll.total}</div>
            {lastRoll.isCrit   && <span className="c-dice-result-lbl" style={{ color: "var(--c-accent)" }}>CRIT!</span>}
            {lastRoll.isFumble && <span className="c-dice-result-lbl" style={{ color: "var(--c-red-bright)" }}>FUMBLE</span>}
            {lastRoll.count > 1 && <div className="c-dice-result-lbl">[{lastRoll.rolls.join(", ")}]{lastRoll.modifier !== 0 ? ` ${fmtSign(lastRoll.modifier)}` : ""}</div>}
          </div>
        )}
        {rolling && <div style={{ marginLeft: "auto", fontSize: "1.5rem" }}>🎲</div>}
      </div>
      <div className="c-dice-grid">
        {DICE.map(d => (
          <button key={d.sides} onClick={() => roll(d.sides)} className="c-die-btn">
            <span style={{ fontSize: "1rem", lineHeight: 1 }}>{d.dot}</span>
            <span>{d.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Live combat view (shown in Fight tab during an active encounter) ──────────
function LiveCombatView({ encounter, character, currentHp }) {
  const { enemy, initiative, battleStats, battleLog } = encounter;
  const playerFirst = initiative?.playerFirst ?? true;
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [battleLog.length]);

  const order = playerFirst
    ? [
        { label: character?.name ?? "You", init: initiative?.player, hp: currentHp, maxHp: character?.hp ?? 20, isPlayer: true },
        { label: enemy.name, init: initiative?.enemy, hp: enemy.hp, maxHp: enemy.maxHp, isPlayer: false },
      ]
    : [
        { label: enemy.name, init: initiative?.enemy, hp: enemy.hp, maxHp: enemy.maxHp, isPlayer: false },
        { label: character?.name ?? "You", init: initiative?.player, hp: currentHp, maxHp: character?.hp ?? 20, isPlayer: true },
      ];

  return (
    <div className="c-panel" style={{ maxHeight: "300px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ color: "var(--c-text)", fontSize: "0.85rem", fontWeight: 600 }}>⚔️ Combat</span>
            <span style={{ color: "var(--c-text-muted)", fontSize: "0.7rem" }}>Round {battleStats.rounds + 1}</span>
            <span style={{ fontSize: "0.6rem", padding: "0.1rem 0.4rem", borderRadius: 10, fontFamily: "monospace", border: `1px solid ${playerFirst ? "rgba(40,100,50,0.5)" : "rgba(155,48,48,0.5)"}`, background: playerFirst ? "rgba(40,100,50,0.12)" : "rgba(155,48,48,0.12)", color: playerFirst ? "#4ab060" : "var(--c-red-bright)" }}>
              {playerFirst ? "You go first" : "Enemy goes first"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontFamily: "monospace", fontSize: "0.65rem" }}>
            <span style={{ color: "var(--c-red-bright)" }}>⚔ {battleStats.dealt}</span>
            <span style={{ color: "var(--c-accent)" }}>🛡 {battleStats.taken}</span>
            {battleStats.crits   > 0 && <span style={{ color: "var(--c-accent)" }}>⚡{battleStats.crits}</span>}
            {battleStats.fumbles > 0 && <span style={{ color: "var(--c-red-bright)" }}>💀{battleStats.fumbles}</span>}
          </div>
        </div>

        {/* Initiative order with HP bars */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {order.map((c, i) => {
            const pct = Math.max(0, Math.min(100, (c.hp / c.maxHp) * 100));
            const barColor = pct <= 25 ? "var(--c-red-bright)" : pct <= 50 ? "#c8883a" : c.isPlayer ? "#3a9a4a" : "#9b3a3a";
            return (
              <div key={i} style={{ borderRadius: 5, padding: "0.5rem 0.65rem", border: `1px solid ${i === 0 ? "var(--c-accent-dim)" : "var(--c-border)"}`, background: i === 0 ? "rgba(200,169,110,0.06)" : "var(--c-bg)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    {i === 0 && <span style={{ color: "var(--c-accent)", fontSize: "0.6rem" }}>▶</span>}
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: c.isPlayer ? "var(--c-accent)" : "var(--c-text)" }}>
                      {c.label}{c.isPlayer ? " (you)" : ""}
                    </span>
                    <span style={{ color: "var(--c-text-muted)", fontSize: "0.6rem", fontFamily: "monospace" }}>init {c.init}</span>
                  </div>
                  <span style={{ fontSize: "0.65rem", fontFamily: "monospace", color: pct <= 25 ? "var(--c-red-bright)" : "var(--c-text-muted)" }}>{c.hp}/{c.maxHp} HP</span>
                </div>
                <div style={{ width: "100%", height: 3, background: "var(--c-surface2)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 2, transition: "width 0.5s", background: barColor, width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Full battle log */}
        {battleLog.length > 0 && (
          <div ref={logRef} style={{ background: "var(--c-bg)", border: "1px solid var(--c-border)", borderRadius: 5, padding: "0.5rem 0.65rem", display: "flex", flexDirection: "column", gap: "0.15rem", overflowY: "auto", maxHeight: "90px" }}>
            <p style={{ margin: 0, fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--c-text-muted)", marginBottom: "0.2rem" }}>Battle Log</p>
            {battleLog.map((line, i) => (
              <p key={i} style={{ margin: 0, fontSize: "0.65rem", fontFamily: "monospace", color: i >= battleLog.length - 4 ? "var(--c-text-dim)" : "var(--c-text-muted)" }}>{line}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Combat Tracker ────────────────────────────────────────────────────────
// Live encounter dashboard when in combat; manual initiative tracker when idle.
function CombatTracker({ character, currentHp, encounterState }) {
  if (encounterState) {
    return <LiveCombatView encounter={encounterState} character={character} currentHp={currentHp} />;
  }

  // ── Manual initiative tracker (no active encounter) ───────────────────────
  const [combatants, setCombatants] = useState(() =>
    character ? [{ id: "player", name: character.name, initiative: 0, hp: currentHp, maxHp: character.hp, isPlayer: true }] : []
  );
  const [currentIdx, setCurrentIdx] = useState(0);
  const [round, setRound] = useState(1);
  const [newName, setNewName] = useState("");
  const [newInit, setNewInit] = useState("");
  const [started, setStarted] = useState(false);

  const sorted = [...combatants].sort((a, b) => b.initiative - a.initiative);

  function addCombatant() {
    const name = newName.trim();
    if (!name) return;
    const init = newInit !== "" ? Number(newInit) : Math.floor(Math.random() * 20) + 1;
    setCombatants(prev => [...prev, { id: Date.now(), name, initiative: init, hp: null, maxHp: null, isPlayer: false }]);
    setNewName(""); setNewInit("");
  }

  function rollPlayerInit() {
    const roll = Math.floor(Math.random() * 20) + 1;
    const dexMod = character ? Math.floor((character.stats.DEX - 10) / 2) : 0;
    setCombatants(prev => prev.map(c => c.isPlayer ? { ...c, initiative: roll + dexMod } : c));
  }

  function nextTurn() {
    const next = (currentIdx + 1) % sorted.length;
    if (next === 0) setRound(r => r + 1);
    setCurrentIdx(next);
  }

  function resetCombat() {
    setCurrentIdx(0); setRound(1); setStarted(false);
    setCombatants(character
      ? [{ id: "player", name: character.name, initiative: 0, hp: currentHp, maxHp: character.hp, isPlayer: true }]
      : []);
  }

  return (
    <div className="c-panel" style={{ maxHeight: "260px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ color: "var(--c-text)", fontSize: "0.85rem", fontWeight: 600 }}>⚔️ Initiative</span>
          {started && <span style={{ color: "var(--c-text-muted)", fontSize: "0.7rem" }}>Round {round}</span>}
        </div>
        <div style={{ display: "flex", gap: "0.3rem" }}>
          {!started
            ? <button onClick={() => setStarted(true)} disabled={combatants.length < 2}
                style={{ padding: "0.2rem 0.5rem", background: "var(--c-accent)", color: "var(--c-bg)", borderRadius: 3, fontSize: "0.65rem", cursor: "pointer", fontWeight: 700, border: "none", opacity: combatants.length < 2 ? 0.4 : 1 }}>Start</button>
            : <button onClick={nextTurn}
                style={{ padding: "0.2rem 0.5rem", background: "var(--c-accent)", color: "var(--c-bg)", borderRadius: 3, fontSize: "0.65rem", cursor: "pointer", fontWeight: 700, border: "none" }}>Next →</button>
          }
          <button onClick={resetCombat}
            style={{ padding: "0.2rem 0.5rem", background: "var(--c-surface2)", border: "1px solid var(--c-border)", color: "var(--c-text-dim)", borderRadius: 3, fontSize: "0.65rem", cursor: "pointer" }}>Reset</button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginBottom: "0.5rem" }}>
        {(started ? sorted : combatants).map((c, i) => {
          const isActive = started && sorted[currentIdx]?.id === c.id;
          return (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", borderRadius: 4, padding: "0.35rem 0.5rem", fontSize: "0.75rem", background: isActive ? "rgba(200,169,110,0.06)" : "var(--c-bg)", border: `1px solid ${isActive ? "var(--c-accent-dim)" : "var(--c-border)"}` }}>
              <span style={{ width: "0.75rem", textAlign: "center", color: "var(--c-accent)", fontSize: "0.6rem" }}>{isActive ? "▶" : ""}</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500, color: c.isPlayer ? "var(--c-accent)" : "var(--c-text)" }}>{c.name}{c.isPlayer ? " (you)" : ""}</span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                {c.isPlayer && <button onClick={rollPlayerInit} style={{ color: "var(--c-text-muted)", cursor: "pointer", padding: "0 0.2rem", background: "none", border: "none", fontSize: "0.75rem" }}>🎲</button>}
                <span style={{ color: "var(--c-text-muted)", fontSize: "0.65rem", minWidth: "3.5rem", textAlign: "right" }}>Init: <span style={{ color: "var(--c-text)", fontWeight: 700 }}>{c.initiative}</span></span>
              </div>
              <button onClick={() => { setCombatants(prev => prev.filter(x => x.id !== c.id)); setCurrentIdx(0); }} style={{ color: "var(--c-text-muted)", cursor: "pointer", marginLeft: "0.2rem", background: "none", border: "none", fontSize: "0.75rem" }}>✕</button>
            </div>
          );
        })}
        {combatants.length === 0 && <p style={{ color: "var(--c-text-muted)", fontSize: "0.75rem", textAlign: "center", padding: "0.25rem 0", margin: 0 }}>Add combatants below</p>}
      </div>

      <div style={{ display: "flex", gap: "0.3rem", paddingTop: "0.5rem", borderTop: "1px solid var(--c-border)" }}>
        <input style={{ flex: 1, background: "var(--c-bg)", border: "1px solid var(--c-border)", borderRadius: 4, padding: "0.3rem 0.5rem", color: "var(--c-text)", fontSize: "0.72rem", outline: "none" }}
          placeholder="Enemy name…" value={newName}
          onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && addCombatant()} />
        <input style={{ background: "var(--c-bg)", border: "1px solid var(--c-border)", borderRadius: 4, padding: "0.3rem 0.25rem", color: "var(--c-text)", fontSize: "0.72rem", outline: "none", width: "3.5rem", textAlign: "center" }}
          placeholder="Init" type="number" value={newInit} onChange={e => setNewInit(e.target.value)} />
        <button onClick={addCombatant}
          style={{ padding: "0.3rem 0.6rem", background: "var(--c-accent)", color: "var(--c-bg)", borderRadius: 4, fontSize: "0.7rem", fontWeight: 700, cursor: "pointer", border: "none" }}>Add</button>
      </div>
      <p style={{ margin: "0.3rem 0 0", color: "var(--c-text-muted)", fontSize: "0.6rem" }}>Leave Init blank to auto-roll d20.</p>
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
    <div className="chronicle-app" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "1rem" }}>
        <button onClick={onBack} className="c-back-btn">←</button>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
        <p style={{ color: "var(--c-text-muted)", fontSize: "1.1rem", marginBottom: "0.5rem" }}>No saved campaigns</p>
        <p style={{ color: "var(--c-text-muted)", fontSize: "0.85rem", marginBottom: "2rem", opacity: 0.6 }}>Start a new adventure and your progress saves automatically.</p>
        <button className="c-btn-ghost" style={{ width: "auto", padding: "0.65rem 1.5rem" }} onClick={onBack}>← Back</button>
      </div>
    </div>
  );

  return (
    <div className="chronicle-app" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.85rem 1rem", borderBottom: "1px solid var(--c-border)" }}>
        <button onClick={onBack} className="c-back-btn">←</button>
        <span style={{ color: "var(--c-text-muted)", fontSize: "0.85rem" }}>Saved Campaigns</span>
      </div>
      <div style={{ padding: "0.75rem 1rem", display: "flex", flexDirection: "column", gap: "0.35rem", overflowY: "auto" }}>
        {saves.map((save, i) => (
          <div key={save.id}>
            {confirmDelete === save.id ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem 1rem", background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 6 }}>
                <span style={{ flex: 1, color: "var(--c-text-dim)", fontSize: "0.85rem" }}>Delete this save?</span>
                <button onClick={() => handleDelete(save.id)} style={{ padding: "0.25rem 0.75rem", background: "rgba(155,48,48,0.4)", border: "1px solid rgba(155,48,48,0.6)", color: "#e87070", borderRadius: 4, fontSize: "0.7rem", cursor: "pointer" }}>Delete</button>
                <button onClick={() => setConfirmDelete(null)} style={{ padding: "0.25rem 0.75rem", background: "var(--c-surface2)", border: "1px solid var(--c-border)", color: "var(--c-text-dim)", borderRadius: 4, fontSize: "0.7rem", cursor: "pointer" }}>Cancel</button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", padding: "0.85rem 1rem", background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 6, cursor: "pointer" }} onClick={() => onContinue(save)}>
                <span style={{ color: "var(--c-text-muted)", fontSize: "0.85rem", width: "1.75rem", flexShrink: 0 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, color: "var(--c-text)", fontWeight: 500 }}>{save.character?.name}</p>
                  <p style={{ margin: 0, color: "var(--c-text-muted)", fontSize: "0.75rem" }}>{save.character?.race} · {save.character?.class} · {formatDate(save.savedAt)}</p>
                  {save.preview && <p style={{ margin: 0, color: "var(--c-text-muted)", fontSize: "0.72rem", fontStyle: "italic" }}>"{save.preview}"</p>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0, marginLeft: "0.5rem" }}>
                  <button onClick={e => { e.stopPropagation(); setConfirmDelete(save.id); }} style={{ color: "var(--c-text-muted)", cursor: "pointer", background: "none", border: "none", fontSize: "0.85rem" }}>🗑</button>
                  <span style={{ color: "var(--c-text-muted)", fontSize: "1.1rem" }}>›</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Encounter UI components ────────────────────────────────────────────────

function EncounterHpBar({ current, max }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const cls = pct <= 25 ? "red" : pct <= 50 ? "amber" : "";
  return (
    <div className="c-hp-track">
      <div className={`c-hp-fill${cls ? " " + cls : ""}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function EncounterOverlay({ encounter, playerHp, playerMaxHp, loading, onAttack, onHeavy, onDefend, onFlee, onDeathSave }) {
  const { enemy, lastCombatLog, lastRoll, battleStats, dying, deathSaves } = encounter;

  const isDeathSave = lastRoll?.action === "deathsave";
  const playerColor = !lastRoll            ? "text-zinc-400"
    : isDeathSave                          ? (lastRoll.playerRoll >= 10 ? "text-green-400" : "text-red-400")
    : lastRoll.isCrit                      ? "text-yellow-300"
    : lastRoll.isFumble                    ? "text-red-400"
    : lastRoll.action === "defend"         ? "text-blue-300"
    : lastRoll.playerHit                   ? "text-green-400"
    :                                        "text-zinc-500";

  const enemyColor = !lastRoll                         ? "text-zinc-400"
    : lastRoll.enemyResult === "miss"                  ? "text-zinc-500"
    : lastRoll.enemyResult === "heavy"                 ? "text-orange-400"
    :                                                    "text-red-400";

  return (
    <div className="c-encounter-panel">
      {/* HP rows */}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <div style={{ flex: 1, background: "var(--c-surface2)", border: "1px solid var(--c-border)", borderRadius: 6, padding: "0.6rem 0.75rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--c-text-muted)" }}>{enemy.tierLabel}</span>
            <span style={{ fontSize: "0.6rem", fontFamily: "monospace", color: "var(--c-red-bright)" }}>{enemy.hp}/{enemy.maxHp} HP</span>
          </div>
          <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--c-text)", lineHeight: 1, margin: 0 }}>{enemy.name}</p>
          <EncounterHpBar current={enemy.hp} max={enemy.maxHp} />
        </div>
        <div style={{ flex: 1, background: dying ? "rgba(155,48,48,0.15)" : "var(--c-surface2)", border: `1px solid ${dying ? "rgba(155,48,48,0.5)" : "var(--c-border)"}`, borderRadius: 6, padding: "0.6rem 0.75rem", display: "flex", flexDirection: "column", gap: "0.35rem", animation: dying ? "pulse 2s infinite" : "none" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.12em", color: dying ? "#e87070" : "var(--c-text-muted)" }}>{dying ? "💀 Dying" : "You"}</span>
            <span style={{ fontSize: "0.6rem", fontFamily: "monospace", color: dying ? "#e87070" : playerHp <= Math.ceil(playerMaxHp * 0.25) ? "var(--c-red-bright)" : "#4a9a5a" }}>{playerHp}/{playerMaxHp} HP</span>
          </div>
          <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--c-text)", lineHeight: 1, margin: 0 }}>Round {battleStats.rounds + 1}</p>
          <EncounterHpBar current={playerHp} max={playerMaxHp} />
        </div>
      </div>

      {/* Death save tracker */}
      {dying && (
        <div style={{ background: "rgba(155,48,48,0.12)", border: "1px solid rgba(155,48,48,0.4)", borderRadius: 6, padding: "0.5rem 0.75rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "#e87070", fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em" }}>Death Saves</span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <span style={{ fontSize: "0.6rem", color: "#4a9a5a" }}>✓</span>
              {[0,1,2].map(i => <div key={i} style={{ width: 14, height: 14, borderRadius: "50%", border: `1px solid ${i < deathSaves.successes ? "#3a9a4a" : "var(--c-border)"}`, background: i < deathSaves.successes ? "#3a9a4a" : "var(--c-bg)" }} />)}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <span style={{ fontSize: "0.6rem", color: "var(--c-red-bright)" }}>✗</span>
              {[0,1,2].map(i => <div key={i} style={{ width: 14, height: 14, borderRadius: "50%", border: `1px solid ${i < deathSaves.failures ? "var(--c-red-bright)" : "var(--c-border)"}`, background: i < deathSaves.failures ? "var(--c-red-bright)" : "var(--c-bg)" }} />)}
            </div>
          </div>
        </div>
      )}

      {/* Dice display */}
      {lastRoll && (
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <div style={{ flex: 1, background: "var(--c-surface2)", border: "1px solid var(--c-border)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.4rem" }}>
            <span style={{ fontSize: "0.55rem", color: "var(--c-text-muted)" }}>{isDeathSave ? "💫 Death Save" : "⚔️ You"}</span>
            <span style={{ fontSize: "1.5rem", fontWeight: 900, lineHeight: 1, color: playerColor.replace("text-", "").replace("-400","").replace("zinc-500","var(--c-text-muted)").includes("green") ? "#4a9a5a" : playerColor.includes("yellow") ? "var(--c-accent)" : playerColor.includes("red") ? "var(--c-red-bright)" : playerColor.includes("blue") ? "#6a88d8" : "var(--c-text-muted)" }}>
              {lastRoll.action === "defend" ? "—" : lastRoll.playerRoll}
            </span>
            <span style={{ fontSize: "0.55rem", fontWeight: 700, color: playerColor.includes("green") ? "#4a9a5a" : playerColor.includes("yellow") ? "var(--c-accent)" : playerColor.includes("red") ? "var(--c-red-bright)" : playerColor.includes("blue") ? "#6a88d8" : "var(--c-text-muted)" }}>
              {isDeathSave ? (lastRoll.playerRoll >= 10 ? "SUCCESS" : "FAILURE") : lastRoll.action === "defend" ? "STANCE" : lastRoll.isCrit ? "CRIT" : lastRoll.isFumble ? "FUMBLE" : lastRoll.playerHit ? "HIT" : "MISS"}
            </span>
          </div>
          {!isDeathSave && (
            <div style={{ flex: 1, background: "var(--c-surface2)", border: "1px solid var(--c-border)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.4rem" }}>
              <span style={{ fontSize: "0.55rem", color: "var(--c-text-muted)" }}>👺 {enemy.name}</span>
              <span style={{ fontSize: "1.5rem", fontWeight: 900, lineHeight: 1, color: enemyColor.includes("orange") ? "#c8883a" : enemyColor.includes("red") ? "var(--c-red-bright)" : "var(--c-text-muted)" }}>{lastRoll.enemyRoll || "—"}</span>
              <span style={{ fontSize: "0.55rem", fontWeight: 700, color: enemyColor.includes("orange") ? "#c8883a" : enemyColor.includes("red") ? "var(--c-red-bright)" : "var(--c-text-muted)" }}>
                {lastRoll.enemyResult === "miss" ? "MISS" : lastRoll.enemyResult === "heavy" ? "HEAVY" : "HIT"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Last round log */}
      {lastCombatLog?.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
          {lastCombatLog.slice(-3).map((line, i) => (
            <p key={i} style={{ fontSize: "0.65rem", fontFamily: "monospace", margin: 0, color: i === lastCombatLog.slice(-3).length - 1 ? "var(--c-text-dim)" : "var(--c-text-muted)" }}>{line}</p>
          ))}
        </div>
      )}

      {/* Narration */}
      {encounter.narration && (
        <div style={{ background: "var(--c-surface2)", border: "1px solid var(--c-border)", borderRadius: 6, padding: "0.6rem 0.75rem" }}>
          <p style={{ margin: 0, color: "var(--c-text-dim)", fontSize: "0.9rem", lineHeight: 1.6, fontFamily: "'Crimson Pro', serif" }}>{encounter.narration}</p>
        </div>
      )}
      {loading && <p style={{ textAlign: "center", color: "var(--c-text-muted)", fontSize: "0.7rem", margin: 0 }}>Resolving turn…</p>}

      {/* Action buttons — death save mode or normal */}
      {dying ? (
        <button onClick={onDeathSave} disabled={loading} className="c-encounter-btn c-encounter-btn-death">
          <span style={{ fontSize: "1.1rem" }}>🎲</span> Roll Death Save
        </button>
      ) : (
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <button onClick={onAttack}  disabled={loading} className="c-encounter-btn c-encounter-btn-attack"><span>⚔️</span>Attack</button>
          <button onClick={onHeavy}   disabled={loading} className="c-encounter-btn c-encounter-btn-heavy"><span>💥</span>Heavy</button>
          <button onClick={onDefend}  disabled={loading} className="c-encounter-btn c-encounter-btn-defend"><span>🛡️</span>Defend</button>
          <button onClick={onFlee}    disabled={loading} className="c-encounter-btn c-encounter-btn-flee"><span>🏃</span>Flee</button>
        </div>
      )}
    </div>
  );
}

function EncounterRecap({ recap, onDismiss }) {
  const isVictory = recap.outcome === "victory";
  const isFled    = recap.outcome === "fled";
  return (
    <div className="c-encounter-panel">
      <div style={{ borderRadius: 6, padding: "0.6rem 0.85rem", display: "flex", alignItems: "center", justifyContent: "space-between", background: isVictory ? "rgba(40,100,50,0.15)" : isFled ? "var(--c-surface2)" : "rgba(155,48,48,0.15)", border: `1px solid ${isVictory ? "rgba(40,100,50,0.4)" : isFled ? "var(--c-border)" : "rgba(155,48,48,0.4)"}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "1.1rem" }}>{isVictory ? "⚔️" : isFled ? "🏃" : "💀"}</span>
          <span style={{ fontFamily: "'Cinzel', serif", fontSize: "0.65rem", letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 700, color: isVictory ? "#4ab060" : isFled ? "var(--c-text-dim)" : "var(--c-red-bright)" }}>
            {isVictory ? "Victory" : isFled ? "Escaped" : "Defeated"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontFamily: "monospace", fontSize: "0.65rem" }}>
          <span style={{ color: "var(--c-red-bright)" }}>⚔️ {recap.dealt}</span>
          <span style={{ color: "var(--c-accent)" }}>🛡 {recap.taken}</span>
          <span style={{ color: "var(--c-text-muted)" }}>↺ {recap.rounds}</span>
        </div>
      </div>
      {recap.narration && (
        <div style={{ background: "var(--c-surface2)", border: "1px solid var(--c-border)", borderRadius: 6, padding: "0.65rem 0.85rem" }}>
          <p style={{ margin: 0, color: "var(--c-text-dim)", fontSize: "0.92rem", lineHeight: 1.65, fontFamily: "'Crimson Pro', serif" }}>{recap.narration}</p>
        </div>
      )}
      {recap.loot && (recap.loot.gold > 0 || recap.loot.items.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <p style={{ margin: 0, fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--c-text-muted)" }}>Loot</p>
          {recap.loot.gold > 0 && (
            <div className="c-loot-gold-card">
              <span>🪙</span>
              <span style={{ color: "var(--c-accent)", fontSize: "0.85rem", fontWeight: 600 }}>+{recap.loot.gold} gold</span>
            </div>
          )}
          {recap.loot.items.map((item, i) => (
            <div key={i} className="c-loot-item-card">
              <span style={{ fontSize: "1.1rem" }}>{item.type === "Weapon" ? "⚔️" : item.type === "Armor" ? "🛡️" : item.type === "Consumable" ? "🧪" : "📦"}</span>
              <div>
                <p style={{ margin: 0, color: "var(--c-text)", fontSize: "0.85rem", fontWeight: 600 }}>{item.name}</p>
                <p style={{ margin: 0, color: "var(--c-text-muted)", fontSize: "0.7rem" }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <button onClick={onDismiss} className="c-continue-btn">Continue →</button>
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
  const [equippedWeaponId, setEquippedWeaponId] = useState(null);
  const [gold, setGold] = useState(10);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [campaignId, setCampaignId] = useState(null);
  const [campaignState, setCampaignState] = useState(null);
  const [justSaved, setJustSaved] = useState(false);
  const [currentHp, setCurrentHp] = useState(10);
  const [usedSlots, setUsedSlots] = useState({});
  const [conditions, setConditions] = useState([]);
  const [notes, setNotes] = useState("");
  const [deathSaves, setDeathSaves] = useState({ successes: 0, failures: 0 });
  const [encounterState, setEncounterState] = useState(null);
  const [pendingRecap, setPendingRecap] = useState(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemType, setNewItemType] = useState("Misc");
  const [itemSuggestions, setItemSuggestions] = useState([]);
  const [selectedDbItem, setSelectedDbItem] = useState(null);
  const [charStep, setCharStep] = useState(0);
  const [charBackground, setCharBackground] = useState("acolyte");
  const [thinkingIdx, setThinkingIdx] = useState(0);
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
    if (!loading) return;
    const id = setInterval(() => setThinkingIdx(i => i + 1), 2000);
    return () => clearInterval(id);
  }, [loading]);

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
    const bg = BACKGROUNDS.find(b => b.id === charBackground);
    const char = { name: charName || `${charRace} ${charClass}`, class: charClass, race: charRace, background: bg?.label || "Adventurer", stats, hp: maxHp, level: 1 };
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
    sendMessage(combined, true); // skipEngine — dice already rolled by the player
  }

  async function generateEnemyAI(playerMessage, dmContext) {
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{
            role: "player",
            text: `Based on this context, generate combat stats for the enemy the player is about to fight.\n\nDM narration: ${dmContext}\nPlayer action: "${playerMessage}"\n\nRespond with ONLY a JSON object, nothing else:\n{"name":"Enemy Name","hp":14,"attack":3,"difficulty":11,"tier":2,"tierLabel":"Standard"}\n\nTier guide: 1=Trivial(hp 6,atk 2,dc 8) 2=Standard(hp 14,atk 3,dc 11) 3=Elite(hp 28,atk 5,dc 14) 4=Boss(hp 52,atk 8,dc 17)`
          }],
          character: null,
          mode: "encounter",
        }),
      });
      if (!response.ok) return null;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const d = line.slice(6);
          if (d === "[DONE]") break;
          try { const p = JSON.parse(d); if (p.text) text += p.text; } catch {}
        }
      }
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return null;
      const parsed = JSON.parse(match[0]);
      return { ...parsed, maxHp: parsed.hp };
    } catch {
      return null;
    }
  }

  async function sendMessage(overrideText, skipEngine = false, combatActionHint = null) {
    const msg = (typeof overrideText === "string" ? overrideText : userInput).trim();
    if ((!msg && combatActionHint !== "deathsave") || loading) return;
    if (typeof overrideText !== "string") setUserInput("");

    // Use the game engine for all typed player actions.
    // Skip it for: manual dice rolls, CONTINUE, and pre-game screens.
    const useEngine = !skipEngine && character !== null;

    // Don't add a player message for death saves — the combat log shows the roll instead
    if (combatActionHint !== "deathsave") {
      setMessages(prev => [...prev, makeMsg("player", msg, { name: character?.name })]);
    }
    setLoading(true);

    try {
      if (useEngine) {
        // ── Death save short-circuit ──────────────────────────────────────
        // When the player is dying, skip processTurn entirely and resolve
        // a death save directly in resolveEncounterRound.
        if (combatActionHint === "deathsave" && encounterState?.dying) {
          const { nextEncounter, playerHpDelta, combatOver, outcome } =
            resolveEncounterRound(encounterState, {}, currentHp, "deathsave");

          setCurrentHp(h => Math.max(0, h + playerHpDelta));

          const narration = await getNarration(
            { action: "death save", intent: "deathsave", rawRoll: nextEncounter.lastRoll?.playerRoll, outcome: null },
            { character, messages, encounter: nextEncounter },
            { onError: (e) => setMessages(prev => [...prev, makeMsg("dm", `⚠️ ${e}`)]) }
          );

          if (combatOver) {
            setPendingRecap({ outcome, ...nextEncounter.battleStats, battleLog: nextEncounter.battleLog, narration, loot: null });
            setEncounterState(null);
            if (narration) setMessages(prev => [...prev, makeMsg("dm", narration)]);
          } else {
            setEncounterState({ ...nextEncounter, narration });
          }
          setLoading(false);
          return;
        }

        // ── Game Engine Path ──────────────────────────────────────────────
        // Step 1: resolve action in code — dice roll + outcome determined here,
        //         BEFORE the AI is ever called.
        const equippedWeapon = inventory.find(i => i.id === equippedWeaponId) ?? null;
        const turnResult = processTurn(msg, { character, equippedWeapon });

        // Step 2: show the roll badge only if this action required a roll
        if (turnResult.needsRoll) {
          setMessages(prev => [...prev, makeMsg("roll", formatRollSummary(turnResult), { turnResult })]);
        }

        // Step 3: apply deterministic state changes (fumble self-damage, etc.)
        const changes = applyTurnToState(turnResult);
        if (changes.hpDelta) {
          setCurrentHp(h => Math.max(0, h + changes.hpDelta));
        }

        // ── Encounter path ────────────────────────────────────────────────
        // Capture encounter at call time (React state is closed over).
        let activeEncounter = encounterState;

        // Auto-start an encounter when an attack intent is detected and no
        // encounter is active. Try the lookup table first; fall back to AI.
        if (!activeEncounter && (combatActionHint === "attack" || turnResult.intent === "attack")) {
          // 1. Check player message for an enemy keyword
          let enemy = lookupEnemy(msg);
          // 2. Check recent DM narration (player often just says "I attack!" while
          //    the DM already described the enemy)
          if (!enemy) {
            const recentDm = messages.filter(m => m.role === "dm").slice(-3).map(m => m.text).join(" ");
            enemy = lookupEnemy(recentDm);
          }
          // 3. AI fallback for exotic/named enemies not in the table
          if (!enemy) {
            const dmContext = messages.filter(m => m.role === "dm").slice(-2).map(m => m.text).join("\n");
            enemy = await generateEnemyAI(msg, dmContext);
          }
          if (enemy) {
            activeEncounter = startEncounter(enemy, character?.stats);
            setEncounterState(activeEncounter);
            setMessages(prev => [...prev, makeMsg("roll", `⚔️ ${enemy.name} appears! (${enemy.tierLabel ?? "?"}) — Combat begins`)]);
          }
        }

        // Resolve the combat round if an encounter is active.
        if (activeEncounter) {
          const { nextEncounter, playerHpDelta, combatOver, outcome } =
            resolveEncounterRound(activeEncounter, turnResult, currentHp, combatActionHint);

          setCurrentHp(h => Math.max(0, h + playerHpDelta));

          const narration = await getNarration(
            turnResult,
            { character, messages, encounter: nextEncounter },
            { onError: (e) => setMessages(prev => [...prev, makeMsg("dm", `⚠️ ${e}`)]) }
          );

          if (combatOver) {
            const loot = outcome === "victory" ? rollLoot(activeEncounter.enemy.tier) : null;
            if (loot) {
              setGold(g => g + loot.gold);
              if (loot.items.length > 0) setInventory(inv => [...inv, ...loot.items]);
            }
            // Restore HP to full after victory or escape so HP doesn't bleed between encounters
            if (outcome === "victory" || outcome === "fled") {
              setCurrentHp(character?.hp ?? 10);
            }
            setPendingRecap({ outcome, ...nextEncounter.battleStats, battleLog: nextEncounter.battleLog, narration, loot });
            setEncounterState(null);
          } else {
            setEncounterState({ ...nextEncounter, narration });
          }

          if (narration) {
            // Narration is shown inside EncounterOverlay during combat.
            // Only push to chat when combat ends so the log is preserved.
            if (combatOver) setMessages(prev => [...prev, makeMsg("dm", narration)]);
            speakText(narration);
            triggerSaveFlash();
          }
          setLoading(false);
          return;
        }

        // ── Standard free-play narration (no active encounter) ────────────
        // Step 4: ask AI to narrate — it receives the outcome, cannot change it
        const narration = await getNarration(
          turnResult,
          { character, messages },
          { onError: (e) => setMessages(prev => [...prev, makeMsg("dm", `⚠️ ${e}`)]) }
        );

        if (narration) {
          setMessages(prev => [...prev, makeMsg("dm", narration)]);
          speakText(narration);
          triggerSaveFlash();
        }
      } else {
        // ── Freeform Path (CONTINUE, manual dice rolls from Dice tab) ─────
        const filteredMessages = messages
          .concat(makeMsg("player", msg, { name: character?.name }))
          .map(m => ({ role: m.role, text: m.text }));
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: filteredMessages,
            character: { name: character?.name, class: character?.class, race: character?.race, background: character?.background }
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
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue;
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
        if (dmReply) {
          setMessages(prev => [...prev, makeMsg("dm", dmReply)]);
          speakText(dmReply);
          triggerSaveFlash();
        }
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
      <div className="chronicle-app">
        <div className="c-screen c-home">
          <svg className="c-home-logo" viewBox="0 0 52 52" fill="none">
            <path d="M26 4L30 18H44L33 27L37 41L26 32L15 41L19 27L8 18H22L26 4Z" fill="none" stroke="#c8a96e" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M26 14L28.5 22H37L30.5 26.5L33 34.5L26 30L19 34.5L21.5 26.5L15 22H23.5L26 14Z" fill="#c8a96e" opacity="0.15"/>
          </svg>
          <h1 className="c-title">CHRONICLE</h1>
          <p className="c-subtitle">AI Dungeon Master · D&amp;D 5e</p>

          <div className="c-home-form">
            <button className="c-btn-primary" onClick={createSession}>▶ Begin</button>

            <button className="c-btn-ghost" onClick={() => { setCampaignState(createCampaignState(goblinCaveCampaign)); setScreen("campaign"); }}>
              ⚔️ Goblin Cave
            </button>

            {hasSaves && (
              <button className="c-btn-ghost" onClick={() => setScreen("saves")}>
                Continue Campaign
              </button>
            )}

            <div className="c-divider">
              <div className="c-divider-line" />
              <span className="c-divider-text">Join a session</span>
              <div className="c-divider-line" />
            </div>

            <div className="c-join-row">
              <input
                className="c-join-input"
                placeholder="Enter session code…"
                value={inputCode}
                onChange={e => setInputCode(e.target.value.toUpperCase())}
                maxLength={6}
                onKeyDown={e => e.key === "Enter" && joinSession()}
              />
              <button className="c-join-btn" onClick={joinSession} disabled={inputCode.trim().length < 4}>
                Join →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (screen === "campaign") return (
    <CampaignScreen
      gameState={campaignState}
      setGameState={setCampaignState}
      onBack={() => setScreen("home")}
    />
  );

  if (screen === "character") {
    // Step 0: Name
    if (charStep === 0) return (
      <div className="chronicle-app">
        <div className="c-screen c-character">
          <div className="c-step-header">
            <button className="c-back-btn" onClick={() => setScreen("home")}>←</button>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              {sessionCode && <span className="c-session-badge">{sessionCode}</span>}
              <span className="c-step-hint">Step 1 of 5</span>
            </div>
          </div>
          <p className="c-step-prompt">Name your hero…</p>
          <input
            className="c-field-input"
            style={{ fontSize: "2rem", textAlign: "center", marginBottom: "2rem" }}
            placeholder="Enter a name…"
            value={charName}
            onChange={e => setCharName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && charName.trim() && setCharStep(1)}
            autoFocus
          />
          <button className="c-btn-primary" disabled={!charName.trim()} onClick={() => charName.trim() && setCharStep(1)}>
            ▶ Continue
          </button>
        </div>
      </div>
    );

    // Step 1: Class
    if (charStep === 1) return (
      <div className="chronicle-app">
        <div className="c-screen c-character">
          <div className="c-step-header">
            <button className="c-back-btn" onClick={() => setCharStep(0)}>←</button>
            <span className="c-step-hint">Step 2 of 5</span>
          </div>
          <p className="c-step-prompt">Choose your class…</p>
          <div>
            {CLASSES.map((c, i) => (
              <button key={c} onClick={() => { setCharClass(c); setCharStep(2); }}
                className={`c-list-item${charClass === c ? " active" : ""}`}>
                <span className="c-list-num">{i + 1}</span>
                <span className="c-list-icon">{CLASS_ICONS[c]}</span>
                <span style={{ flex: 1 }}>{c}</span>
                <span className="c-list-arrow">›</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );

    // Step 2: Race
    if (charStep === 2) return (
      <div className="chronicle-app">
        <div className="c-screen c-character">
          <div className="c-step-header">
            <button className="c-back-btn" onClick={() => setCharStep(1)}>←</button>
            <span className="c-step-hint">Step 3 of 5</span>
          </div>
          <p className="c-step-prompt">Choose your race…</p>
          <div>
            {RACES.map((r, i) => (
              <button key={r} onClick={() => { setCharRace(r); setCharStep(3); }}
                className={`c-list-item${charRace === r ? " active" : ""}`}>
                <span className="c-list-num">{i + 1}</span>
                <span style={{ flex: 1 }}>{r}</span>
                <span className="c-list-arrow">›</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );

    // Step 3: Stats
    if (charStep === 3) return (
      <div className="chronicle-app">
        <div className="c-screen c-character">
          <div className="c-step-header">
            <button className="c-back-btn" onClick={() => setCharStep(2)}>←</button>
            <span className="c-step-hint">Step 4 of 5 · {charName}</span>
          </div>
          <p className="c-step-prompt">Set your ability scores…</p>

          <div className="c-card">
            <div className="c-card-header">
              <span className="c-label" style={{ margin: 0 }}>Ability Scores</span>
              <button className="c-roll-btn" onClick={autoGenerateCharacter}>🎲 Roll Stats</button>
            </div>
            <div className="c-stat-grid">
              {Object.entries(stats).map(([stat, val]) => (
                <div key={stat} className="c-stat-box">
                  <span className="c-stat-lbl">{stat}</span>
                  <span className="c-stat-val">{val}</span>
                  <span className="c-stat-mod">{modifier(val)}</span>
                  <div className="c-stat-ctrl">
                    <button className="c-stat-btn" onClick={() => setStats(s => ({ ...s, [stat]: Math.max(3, s[stat] - 1) }))}>−</button>
                    <button className="c-stat-btn" onClick={() => setStats(s => ({ ...s, [stat]: Math.min(20, s[stat] + 1) }))}>+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="c-card">
            <p className="c-label">Starting Equipment</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {getStartingInventory(charClass).map((item, i) => (
                <span key={i} style={{
                  fontSize: "0.72rem", padding: "0.2rem 0.6rem",
                  background: "var(--c-surface2)", border: "1px solid var(--c-border)",
                  borderRadius: "3px", color: "var(--c-text-dim)"
                }}>
                  {item.name}{item.qty > 1 ? ` ×${item.qty}` : ""}
                </span>
              ))}
            </div>
          </div>

          <button className="c-btn-primary" onClick={() => setCharStep(4)}>Next: Background →</button>
        </div>
      </div>
    );

    // Step 4: Background
    return (
      <div className="chronicle-app">
        <div className="c-screen c-character">
          <div className="c-step-header">
            <button className="c-back-btn" onClick={() => setCharStep(3)}>←</button>
            <span className="c-step-hint">Step 5 of 5 · {charName}</span>
          </div>
          <p className="c-step-prompt">Choose your background…</p>
          <p className="c-step-subtext">Shapes how the DM narrates your story.</p>
          <div className="c-bg-grid">
            {BACKGROUNDS.map(bg => (
              <button key={bg.id} onClick={() => setCharBackground(bg.id)}
                className={`c-bg-card${charBackground === bg.id ? " active" : ""}`}>
                <p style={{ color: "var(--c-text)", fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.2rem" }}>{bg.label}</p>
                <p style={{ color: "var(--c-text-muted)", fontSize: "0.75rem" }}>{bg.desc}</p>
              </button>
            ))}
          </div>
          <button className="c-btn-primary" onClick={enterGame}>Enter the Campaign →</button>
        </div>
      </div>
    );
  }

  if (screen === "game") return (
    <div className="chronicle-app c-game">

      {/* Header */}
      <div className="c-game-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <button className="c-back-btn" onClick={() => setScreen("home")} title="Back to home">←</button>
          <div className="c-game-wordmark">
            <div className="c-game-title">CHRONICLE</div>
            {sessionCode && <div className="c-game-session">{sessionCode}</div>}
          </div>
        </div>
        <div className="c-header-actions">
          {speaking  && <span style={{ fontSize: "0.6rem", color: "var(--c-accent)", letterSpacing: "0.1em" }}>● Speaking</span>}
          {justSaved && <span style={{ fontSize: "0.6rem", color: "#4a9a5a" }}>✓</span>}
          {TAB_BUTTONS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(activeTab === t.id ? null : t.id)}
              className={`c-icon-btn${activeTab === t.id ? " c-active" : ""}`}>
              {t.label.split(" ")[0]}
            </button>
          ))}
          <span title={`${character?.race} ${character?.class}`} style={{ fontSize: "1.1rem" }}>{getPortrait(character?.class)}</span>
          <div className="c-hp-badge">♥ {currentHp}/{character?.hp}</div>
          <button className="c-icon-btn" onClick={() => { if (voiceEnabled) window.speechSynthesis?.pause(); else window.speechSynthesis?.resume(); setVoiceEnabled(!voiceEnabled); }}>
            {voiceEnabled ? "🔊" : "🔇"}
          </button>
        </div>
      </div>

      {/* Story / Chat */}
      <div ref={chatRef} className="c-chat">
        {messages.map(m => {
          if (m.role === "dm") return (
            <div key={m.id} className="c-msg-dm">
              <div className="c-msg-dm-label">Dungeon Master</div>
              <div className="c-msg-dm-text">{renderMarkdown(m.text)}</div>
            </div>
          );
          if (m.role === "roll") {
            const rollColors = {
              critical: { color: "var(--c-accent)",    border: "rgba(200,169,110,0.4)" },
              success:  { color: "#4a9a5a",            border: "rgba(74,154,90,0.4)" },
              partial:  { color: "#c8a96e",            border: "rgba(200,169,110,0.3)" },
              failure:  { color: "var(--c-text-muted)", border: "var(--c-border)" },
              fumble:   { color: "var(--c-red-bright)", border: "rgba(196,58,58,0.4)" },
            }[m.turnResult?.outcome] ?? { color: "var(--c-text-muted)", border: "var(--c-border)" };
            return (
              <div key={m.id} style={{ display: "flex", justifyContent: "center" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: "0.4rem",
                  padding: "0.25rem 0.75rem", borderRadius: "20px",
                  background: "var(--c-surface)", border: `1px solid ${rollColors.border}`,
                  fontFamily: "'Cinzel', serif", fontSize: "0.65rem",
                  letterSpacing: "0.05em", color: rollColors.color
                }}>
                  🎲 {m.text}
                </div>
              </div>
            );
          }
          return (
            <div key={m.id} className="c-msg-player">
              <div className="c-msg-player-bubble">
                <div className="c-msg-player-label">You</div>
                <div className="c-msg-player-text" style={m.isRoll ? { color: "var(--c-accent)", fontFamily: "'Cinzel',serif", fontSize: "0.75rem" } : {}}>
                  {m.text}
                </div>
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="c-msg-dm">
            <div className="c-msg-dm-label">Dungeon Master</div>
            <div className="c-msg-dm-text" style={{ color: "var(--c-accent)", opacity: 0.6, fontStyle: "italic", animation: "pulse 2s infinite" }}>
              {DM_THINKING[thinkingIdx % DM_THINKING.length]}
            </div>
          </div>
        )}
      </div>

      {/* Sidebar: tab panels + encounter — becomes right column on desktop */}
      <div className="c-sidebar">

      {/* Dice Panel */}
      {activeTab === "dice" && <DiceRoller onRollToChat={handleRollToChat} />}

      {/* Character Sheet Panel */}
      {activeTab === "sheet" && character && (() => {
        const ac = calcAC(inventory, character.stats);
        const slotMaxes = getSpellSlotMaxes(character.class, character.level || 1);
        const isSpellcaster = SPELLCASTER_CLASSES.includes(character.class);
        return (
          <div className="c-panel" style={{ maxHeight: "340px" }}>
            {/* Name + Level + AC */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.2rem" }}>{CLASS_ICONS[character.class]}</span>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: "0.9rem", color: "var(--c-text)" }}>{character.name}</p>
                  <p style={{ margin: 0, color: "var(--c-text-muted)", fontSize: "0.7rem" }}>{character.race} · {character.class}</p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span style={{ background: "var(--c-surface2)", border: "1px solid var(--c-border)", color: "var(--c-text-dim)", fontSize: "0.65rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: 4 }} title="Armor Class">AC {ac}</span>
                <span style={{ color: "var(--c-text-muted)", fontSize: "0.65rem" }}>Lvl</span>
                <button onClick={() => { setCharacter(c => ({ ...c, level: Math.max(1, (c.level||1) - 1) })); setUsedSlots(s => { const m = getSpellSlotMaxes(character.class, Math.max(1,(character.level||1)-1)); return Object.fromEntries(Object.entries(s).map(([k,v])=>[k,Math.min(v,m[k]||0)])); }); }} className="c-counter-btn">−</button>
                <span style={{ fontFamily: "'Cinzel', serif", fontSize: "0.85rem", color: "var(--c-text)", minWidth: "1.25rem", textAlign: "center" }}>{character.level || 1}</span>
                <button onClick={() => setCharacter(c => ({ ...c, level: Math.min(20, (c.level||1) + 1) }))} className="c-counter-btn">+</button>
              </div>
            </div>

            {/* HP Bar */}
            <div style={{ marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                <span style={{ fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-text-muted)" }}>HP</span>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: currentHp === 0 ? "var(--c-red-bright)" : "var(--c-text)" }}>{currentHp} / {character.hp}</span>
              </div>
              <div style={{ height: 4, background: "var(--c-bg)", borderRadius: 2, overflow: "hidden", marginBottom: "0.5rem" }}>
                <div style={{ height: "100%", borderRadius: 2, transition: "width 0.3s", background: currentHp / character.hp > 0.5 ? "#3a9a4a" : currentHp / character.hp > 0.25 ? "#c8883a" : "var(--c-red-bright)", width: `${Math.max(0, (currentHp / character.hp) * 100)}%` }} />
              </div>
              <div style={{ display: "flex", gap: "0.3rem" }}>
                {[1, 5, 10].map(n => (
                  <button key={`d${n}`} onClick={() => setCurrentHp(h => Math.max(0, h - n))}
                    style={{ flex: 1, padding: "0.2rem", background: "rgba(155,48,48,0.3)", border: "1px solid rgba(155,48,48,0.4)", color: "#e87070", borderRadius: 4, fontSize: "0.7rem", cursor: "pointer" }}>−{n}</button>
                ))}
                <div style={{ width: 1, background: "var(--c-border)", margin: "0 0.1rem" }} />
                {[1, 5, 10].map(n => (
                  <button key={`h${n}`} onClick={() => setCurrentHp(h => { const next = Math.min(character.hp, h + n); if (next > 0) setDeathSaves({ successes: 0, failures: 0 }); return next; })}
                    style={{ flex: 1, padding: "0.2rem", background: "rgba(40,100,50,0.3)", border: "1px solid rgba(40,100,50,0.4)", color: "#4ab060", borderRadius: 4, fontSize: "0.7rem", cursor: "pointer" }}>+{n}</button>
                ))}
              </div>
            </div>

            {/* Death Saves — only at 0 HP */}
            {currentHp === 0 && (
              <div style={{ marginBottom: "0.75rem", background: "var(--c-bg)", border: "1px solid rgba(155,48,48,0.4)", borderRadius: 6, padding: "0.5rem 0.65rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <span style={{ color: "var(--c-red-bright)", fontSize: "0.7rem", fontWeight: 600 }}>💀 Death Saves</span>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <button onClick={() => {
                      const roll = rollDie(20);
                      if (roll === 20) { setCurrentHp(1); setDeathSaves({ successes: 0, failures: 0 }); }
                      else if (roll === 1) setDeathSaves(d => ({ ...d, failures: Math.min(3, d.failures + 2) }));
                      else if (roll >= 10) setDeathSaves(d => ({ ...d, successes: Math.min(3, d.successes + 1) }));
                      else setDeathSaves(d => ({ ...d, failures: Math.min(3, d.failures + 1) }));
                    }} style={{ padding: "0.15rem 0.5rem", background: "var(--c-surface2)", border: "1px solid var(--c-border)", color: "var(--c-text)", borderRadius: 3, fontSize: "0.65rem", cursor: "pointer" }}>🎲 Roll</button>
                    <button onClick={() => setDeathSaves({ successes: 0, failures: 0 })} style={{ color: "var(--c-text-muted)", fontSize: "0.65rem", cursor: "pointer", background: "none", border: "none" }}>Reset</button>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <span style={{ color: "#4ab060", fontSize: "0.65rem" }}>✓</span>
                    {[0,1,2].map(i => <div key={i} onClick={() => setDeathSaves(d => ({ ...d, successes: d.successes === i+1 ? i : i+1 }))} style={{ width: 14, height: 14, borderRadius: "50%", border: `1px solid ${i < deathSaves.successes ? "#3a9a4a" : "var(--c-border)"}`, background: i < deathSaves.successes ? "#3a9a4a" : "var(--c-bg)", cursor: "pointer" }} />)}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <span style={{ color: "var(--c-red-bright)", fontSize: "0.65rem" }}>✗</span>
                    {[0,1,2].map(i => <div key={i} onClick={() => setDeathSaves(d => ({ ...d, failures: d.failures === i+1 ? i : i+1 }))} style={{ width: 14, height: 14, borderRadius: "50%", border: `1px solid ${i < deathSaves.failures ? "var(--c-red-bright)" : "var(--c-border)"}`, background: i < deathSaves.failures ? "var(--c-red-bright)" : "var(--c-bg)", cursor: "pointer" }} />)}
                  </div>
                  {deathSaves.successes >= 3 && <span style={{ color: "#4ab060", fontSize: "0.65rem" }}>Stable!</span>}
                  {deathSaves.failures >= 3 && <span style={{ color: "var(--c-red-bright)", fontSize: "0.65rem" }}>Dead</span>}
                </div>
              </div>
            )}

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "0.35rem", marginBottom: "0.75rem" }}>
              {Object.entries(character.stats).map(([s, v]) => (
                <div key={s} className="c-stat-box">
                  <span className="c-stat-lbl">{s}</span>
                  <span className="c-stat-val" style={{ fontSize: "1.1rem" }}>{v}</span>
                  <span className="c-stat-mod">{modifier(v)}</span>
                </div>
              ))}
            </div>

            {/* Spell Slots */}
            {isSpellcaster && Object.keys(slotMaxes).length > 0 && (
              <div style={{ marginBottom: "0.75rem" }}>
                <p className="c-panel-title">Spell Slots</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  {Object.entries(slotMaxes).map(([lvl, max]) => {
                    const used = usedSlots[lvl] || 0;
                    return (
                      <div key={lvl} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontSize: "0.6rem", color: "var(--c-text-muted)", width: "1.5rem" }}>{ORDINALS[lvl-1]}</span>
                        <div style={{ display: "flex", gap: "0.25rem" }}>
                          {Array.from({ length: max }).map((_, i) => (
                            <button key={i} onClick={() => setUsedSlots(s => ({ ...s, [lvl]: s[lvl] === i+1 ? i : i+1 }))}
                              style={{ width: 14, height: 14, borderRadius: "50%", border: `1px solid ${i < used ? "var(--c-accent-dim)" : "var(--c-border)"}`, background: i < used ? "var(--c-accent)" : "var(--c-bg)", cursor: "pointer", transition: "all 0.15s" }} />
                          ))}
                        </div>
                        <span style={{ fontSize: "0.65rem", color: "var(--c-text-muted)" }}>{max - used}/{max}</span>
                      </div>
                    );
                  })}
                </div>
                <button onClick={() => setUsedSlots({})} style={{ marginTop: "0.4rem", fontSize: "0.65rem", color: "var(--c-text-muted)", cursor: "pointer", background: "none", border: "none", padding: 0 }}>Long rest (restore all)</button>
              </div>
            )}

            {/* Conditions */}
            <div>
              <p className="c-panel-title">Conditions</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                {CONDITIONS.map(c => {
                  const active = conditions.includes(c);
                  return (
                    <button key={c} onClick={() => setConditions(cs => active ? cs.filter(x => x !== c) : [...cs, c])}
                      style={{ fontSize: "0.65rem", padding: "0.15rem 0.5rem", borderRadius: 4, border: `1px solid ${active ? "rgba(155,48,48,0.5)" : "var(--c-border)"}`, background: active ? "rgba(155,48,48,0.25)" : "var(--c-bg)", color: active ? "#e87070" : "var(--c-text-muted)", cursor: "pointer", transition: "all 0.15s" }}>
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Inventory Panel */}
      {activeTab === "inventory" && (
        <div className="c-panel" style={{ maxHeight: "280px" }}>
          {/* Header: title + gold */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.65rem" }}>
            <p className="c-panel-title" style={{ margin: 0 }}>Inventory</p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              {[-10,-1,1,10].map(n => (
                <button key={n} onClick={() => setGold(g => Math.max(0, g + n))}
                  style={{ padding: "0.15rem 0.4rem", borderRadius: 3, fontSize: "0.65rem", cursor: "pointer", background: n < 0 ? "var(--c-surface2)" : "rgba(200,169,110,0.12)", border: `1px solid ${n < 0 ? "var(--c-border)" : "var(--c-accent-dim)"}`, color: n < 0 ? "var(--c-text-dim)" : "var(--c-accent)" }}>
                  {n > 0 ? `+${n}` : n}
                </button>
              ))}
              <span style={{ color: "var(--c-accent)", fontSize: "0.85rem", fontWeight: 600, marginLeft: "0.25rem" }}>🪙 {gold}</span>
            </div>
          </div>
          {inventory.length === 0 && <p style={{ color: "var(--c-text-muted)", fontSize: "0.85rem", textAlign: "center", padding: "0.5rem 0" }}>Your pack is empty.</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            {inventory.map(item => {
              const isEquipped = item.id === equippedWeaponId;
              return (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", borderRadius: 4, padding: "0.45rem 0.6rem", background: isEquipped ? "rgba(200,169,110,0.06)" : "var(--c-bg)", border: `1px solid ${isEquipped ? "var(--c-accent-dim)" : "var(--c-border)"}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                      <span style={{ color: "var(--c-text)", fontSize: "0.85rem", fontWeight: 500 }}>{item.name}</span>
                      <span style={{ fontSize: "0.6rem", color: "var(--c-text-muted)" }}>{item.type}</span>
                      {isEquipped && <span style={{ fontSize: "0.55rem", padding: "0.1rem 0.4rem", borderRadius: 10, background: "rgba(200,169,110,0.1)", border: "1px solid var(--c-accent-dim)", color: "var(--c-accent)" }}>Equipped</span>}
                    </div>
                    <p style={{ margin: 0, color: "var(--c-text-muted)", fontSize: "0.65rem" }}>{item.desc} · {item.weight} lb</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", flexShrink: 0 }}>
                    {item.type === "Weapon" && (
                      <button onClick={() => setEquippedWeaponId(isEquipped ? null : item.id)}
                        style={{ fontSize: "0.6rem", padding: "0.15rem 0.4rem", borderRadius: 3, fontWeight: 600, cursor: "pointer", background: isEquipped ? "var(--c-surface2)" : "rgba(155,48,48,0.3)", border: `1px solid ${isEquipped ? "var(--c-border)" : "rgba(155,48,48,0.5)"}`, color: isEquipped ? "var(--c-text-dim)" : "#e87070" }}>
                        {isEquipped ? "Unequip" : "Equip"}
                      </button>
                    )}
                    {item.qty > 1 || item.type === "Consumable" ? (
                      <>
                        <button onClick={() => changeQty(item.id, -1)} className="c-counter-btn">−</button>
                        <span style={{ color: "var(--c-text)", fontSize: "0.7rem", minWidth: "1rem", textAlign: "center" }}>{item.qty}</span>
                        <button onClick={() => changeQty(item.id, 1)} className="c-counter-btn">+</button>
                      </>
                    ) : (
                      <span style={{ color: "var(--c-text-muted)", fontSize: "0.65rem", width: "1.5rem", textAlign: "center" }}>×1</span>
                    )}
                    <button onClick={() => { if (isEquipped) setEquippedWeaponId(null); removeItem(item.id); }}
                      style={{ width: 18, height: 18, background: "rgba(155,48,48,0.25)", border: "1px solid rgba(155,48,48,0.4)", borderRadius: 3, fontSize: "0.6rem", color: "#e87070", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: "0.15rem" }}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid var(--c-border)", display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "var(--c-text-muted)" }}>
            <span>{inventory.length} items</span>
            <span>{inventory.reduce((a, i) => a + i.weight * i.qty, 0).toFixed(1)} lb total</span>
          </div>
          {/* Add item with autocomplete */}
          <div style={{ marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid var(--c-border)" }}>
            {itemSuggestions.length > 0 && (
              <div style={{ marginBottom: "0.3rem", borderRadius: 4, border: "1px solid var(--c-border)", overflow: "hidden" }}>
                {itemSuggestions.map(item => (
                  <button key={item.name} onClick={() => { setNewItemName(item.name); setNewItemType(item.type); setSelectedDbItem(item); setItemSuggestions([]); }}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0.6rem", background: "var(--c-surface2)", textAlign: "left", cursor: "pointer", borderBottom: "1px solid var(--c-border)" }}>
                    <span style={{ fontSize: "0.6rem", fontWeight: 600, width: "3.5rem", flexShrink: 0, color: "var(--c-text-muted)" }}>{item.type}</span>
                    <span style={{ color: "var(--c-text)", fontSize: "0.7rem", fontWeight: 500, flexShrink: 0 }}>{item.name}</span>
                    <span style={{ color: "var(--c-text-muted)", fontSize: "0.65rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.desc}</span>
                    <span style={{ color: "var(--c-text-muted)", fontSize: "0.6rem", flexShrink: 0, marginLeft: "auto" }}>{item.weight} lb</span>
                  </button>
                ))}
              </div>
            )}
            {selectedDbItem && (
              <div style={{ marginBottom: "0.3rem", padding: "0.25rem 0.5rem", background: "rgba(200,169,110,0.06)", border: "1px solid var(--c-accent-dim)", borderRadius: 4 }}>
                <p style={{ margin: 0, color: "var(--c-accent)", fontSize: "0.65rem" }}>{selectedDbItem.desc} · {selectedDbItem.weight} lb</p>
              </div>
            )}
            <div style={{ display: "flex", gap: "0.3rem" }}>
              <input
                style={{ flex: 1, background: "var(--c-bg)", border: "1px solid var(--c-border)", borderRadius: 4, padding: "0.3rem 0.5rem", color: "var(--c-text)", fontSize: "0.75rem", outline: "none" }}
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
                  style={{ background: "var(--c-bg)", border: "1px solid var(--c-border)", borderRadius: 4, padding: "0.3rem 0.25rem", color: "var(--c-text)", fontSize: "0.7rem", outline: "none", cursor: "pointer" }}>
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
                style={{ padding: "0.3rem 0.6rem", background: "var(--c-accent)", color: "var(--c-bg)", borderRadius: 4, fontSize: "0.7rem", fontWeight: 700, cursor: "pointer", border: "none", flexShrink: 0 }}>
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes Panel */}
      {activeTab === "notes" && (
        <div className="c-panel" style={{ maxHeight: "240px", padding: 0 }}>
          <textarea
            className="c-textarea"
            style={{ height: "200px", border: "none", borderRadius: 0, background: "var(--c-surface)" }}
            placeholder="Quest notes, NPC names, clues, loot to track…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
      )}

      {/* Encounter Overlay */}
      {encounterState && !pendingRecap && (
        <EncounterOverlay
          encounter={encounterState}
          playerHp={currentHp}
          playerMaxHp={character?.hp ?? 20}
          loading={loading}
          onAttack={() => sendMessage("I attack!", false, "attack")}
          onHeavy={()  => sendMessage("Heavy attack!", false, "heavy")}
          onDefend={()    => sendMessage("I defend!", false, "defend")}
          onFlee={()      => sendMessage("I flee!", false, "flee")}
          onDeathSave={()  => sendMessage("", false, "deathsave")}
        />
      )}

      {/* Encounter Recap */}
      {pendingRecap && (
        <EncounterRecap
          recap={pendingRecap}
          onDismiss={() => setPendingRecap(null)}
        />
      )}

      </div>{/* end .c-sidebar */}

      {/* Input Bar */}
      <div className="c-input-area">
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "flex-start" }}>
          <textarea
            ref={inputRef}
            className="c-textarea"
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
              sendMessage(combined, true);
            }}
            disabled={loading}
            title="Quick roll d20"
            className="c-d20-btn"
            style={{ marginTop: "2px" }}
          >🎲</button>
        </div>
        <div className="c-action-row" style={{ marginBottom: "0.5rem" }}>
          <button onClick={() => sendMessage()} disabled={loading || !userInput.trim()} className="c-action-btn">
            ✏️ Take a Turn
          </button>
          <button onClick={() => sendMessage("Continue the story.", true)} disabled={loading} className="c-action-btn">
            ✦ Continue
          </button>
          <button onClick={() => { const last = [...messages].reverse().find(m => m.role === "player" && !m.isRoll); if (last) sendMessage(last.text); }} disabled={loading} className="c-action-btn">
            ↺ Retry
          </button>
        </div>
        <div className="c-quick-actions">
          {QUICK_ACTIONS.map(a => (
            <button key={a} onClick={() => setUserInput(a)} className="c-quick-btn">{a}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
