import { create } from "zustand";
import { migrateHero, type HeroClass } from "@/lib/classes";
import type { ZoneId } from "./maps";
import { advanceTutorial, overlayToggle, type Overlay } from "./uiState";
import { clampSave, type InputLog, type InputMode, modeFromOverlay } from "./input";
import { loadQuality, saveQuality, type Quality } from "./perf";
import { loadAimMode, saveAimMode, type AimMode } from "./aim";
import type { PickupId } from "./arena";
export type { Overlay };

export type ItemRarity = "common" | "uncommon" | "rare" | "relic";
export type EquipSlot = "weapon" | "armor" | "trinket";

export type Item = {
  id: string;
  name: string;
  slot: EquipSlot;
  rarity: ItemRarity;
  atk?: number;
  def?: number;
  hp?: number;
  desc: string;
};

export type QuestState = { id: string; stage: number; done: boolean };

export type SaveBlob = {
  heroClass: HeroClass | "wanderer";
  name: string;
  x: number;
  y: number;
  zone: ZoneId;
  hp: number;
  hpMax: number;
  stamina: number;
  staminaMax: number;
  level: number;
  xp: number;
  gold: number;
  atk: number;
  def: number;
  statPoints: number;
  skills: string[];
  inventory: Item[];
  equipped: Partial<Record<EquipSlot, Item>>;
  quests: QuestState[];
  chests: string[];
  shrines: string[];
  flags: Record<string, boolean>;
  codex: string[];
  wheelCharge: number;
  squeekLevel: number;
  spectator: boolean;
  tutorialStep: number;
  arenaLevel?: number;
  score?: number;
  bestScore?: number;
  gun?: string;
  guns?: string[];
};

export const ITEMS: Record<string, Item> = {
  "oak-blade": { id: "oak-blade", name: "Oak Cogblade", slot: "weapon", rarity: "uncommon", atk: 3, desc: "A forest tooth on a stick." },
  "iron-mail": { id: "iron-mail", name: "Rust Mail", slot: "armor", rarity: "uncommon", def: 3, hp: 8, desc: "Smells like the mines." },
  "ember-ring": { id: "ember-ring", name: "Ember Ring", slot: "trinket", rarity: "rare", atk: 2, desc: "Warm as a running wheel." },
  "volt-shard": { id: "volt-shard", name: "Volt Shard", slot: "trinket", rarity: "uncommon", atk: 1, desc: "Hums when Squeektoshi jogs." },
  "cog-key": { id: "cog-key", name: "Cog Key", slot: "trinket", rarity: "rare", def: 1, desc: "Opens the foundry side-hatch." },
  "starter-fist": { id: "starter-fist", name: "Knuckle Plate", slot: "weapon", rarity: "common", atk: 1, desc: "Standard issue." },
  "starter-staff": { id: "starter-staff", name: "Ice Twig", slot: "weapon", rarity: "common", atk: 1, desc: "A trainee's focus." },
  "starter-knife": { id: "starter-knife", name: "Paring Dagger", slot: "weapon", rarity: "common", atk: 1, desc: "Kitchen-born." },
};

export const SKILL_TREE = [
  { id: "hp1", name: "Thick Fur", desc: "+10 HP", req: [] },
  { id: "atk1", name: "Sharp Tooth", desc: "+2 ATK", req: [] },
  { id: "sta1", name: "Long Sprint", desc: "+20 stamina", req: [] },
  { id: "hp2", name: "Iron Gut", desc: "+15 HP", req: ["hp1"] },
  { id: "atk2", name: "Heavy Swing", desc: "+3 ATK", req: ["atk1"] },
  { id: "crit", name: "Lucky Seed", desc: "+8% crit", req: ["atk1"] },
  { id: "roll", name: "Grease Roll", desc: "Shorter roll cooldown", req: ["sta1"] },
  { id: "surge1", name: "Wheel Channel", desc: "Surge charges faster", req: ["sta1"] },
  { id: "def1", name: "Cog Hide", desc: "+2 DEF", req: ["hp1"] },
  { id: "skill", name: "Second Wind", desc: "Skill cooldown -20%", req: ["hp2", "sta1"] },
  { id: "ult", name: "Foundry Heart", desc: "Ultimate +25% damage", req: ["atk2", "surge1"] },
  { id: "cap", name: "Squeektoshi's Favor", desc: "+4% all damage", req: ["ult", "skill"] },
] as const;

export function upgradeItem(s: SaveBlob, id: string): SaveBlob | null {
  const it = s.inventory.find((i) => i.id === id);
  if (!it || s.gold < 25) return null;
  const bumped: Item = {
    ...it,
    atk: (it.atk ?? 0) + (it.slot === "weapon" ? 1 : 0),
    def: (it.def ?? 0) + (it.slot === "weapon" ? 0 : 1),
    name: it.name.includes("+") ? it.name.replace(/\+\d+/, (m) => `+${Number(m.slice(1)) + 1}`) : `${it.name} +1`,
  };
  const inventory = s.inventory.map((i) => (i === it ? bumped : i));
  const equipped = { ...s.equipped };
  if (equipped[it.slot]?.id === it.id && equipped[it.slot]?.name === it.name) equipped[it.slot] = bumped;
  return { ...s, gold: s.gold - 25, inventory, equipped };
}

export function buySkill(s: SaveBlob, id: string): SaveBlob | null {
  const node = SKILL_TREE.find((n) => n.id === id);
  if (!node || s.skills.includes(id) || s.statPoints < 1) return null;
  if (node.req.some((r) => !s.skills.includes(r))) return null;
  const next: SaveBlob = { ...s, skills: [...s.skills, id], statPoints: s.statPoints - 1 };
  if (id === "hp1") {
    next.hpMax += 10;
    next.hp += 10;
  }
  if (id === "hp2") {
    next.hpMax += 15;
    next.hp += 15;
  }
  if (id === "atk1") next.atk += 2;
  if (id === "atk2") next.atk += 3;
  if (id === "sta1") {
    next.staminaMax += 20;
    next.stamina += 20;
  }
  if (id === "def1") next.def += 2;
  return next;
}

export function freshSave(heroClass: HeroClass | "wanderer", squeekLevel: number, spectator: boolean): SaveBlob {
  const role = migrateHero(heroClass);
  const base = { hp: 32, atk: 7, def: 2, weapon: ITEMS["starter-staff"] };
  return {
    heroClass: role,
    name: "Pip Wheelrunner",
    x: 168,
    y: 200,
    zone: "haven",
    hp: base.hp,
    hpMax: base.hp,
    stamina: 100,
    staminaMax: 100,
    level: 1,
    xp: 0,
    gold: 12,
    atk: base.atk,
    def: base.def,
    statPoints: 0,
    skills: [],
    inventory: [base.weapon!],
    equipped: { weapon: base.weapon },
    quests: [
      { id: "main-1", stage: 0, done: false },
      { id: "side-seeds", stage: 0, done: false },
      { id: "side-chest", stage: 0, done: false },
      { id: "side-hermit", stage: 0, done: false },
      { id: "side-mines", stage: 0, done: false },
      { id: "side-levers", stage: 0, done: false },
      { id: "side-shrine", stage: 0, done: false },
    ],
    chests: [],
    shrines: ["haven"],
    flags: {},
    codex: ["You wake in Wheelhaven. The shrine hums with the hamster's pulse."],
    wheelCharge: 0,
    squeekLevel,
    spectator,
    tutorialStep: 0,
    arenaLevel: 1,
    score: 0,
    bestScore: 0,
    gun: "pistol",
    guns: ["pistol", "shotgun"],
  };
}

export type MiniCell = { x: number; y: number; wall: boolean };
export type Poi = { x: number; y: number; kind: string; elite?: boolean };

type GameState = {
  save: SaveBlob | null;
  overlay: Overlay;
  dialogue: { speaker: string; text: string; choices?: { label: string; next: string }[] } | null;
  toast: string | null;
  prompt: string | null;
  near: string | null;
  zoneName: string;
  tutorialFlash: string | null;
  cooldowns: { atk: number; skill: number; ult: number; roll: number };
  bossHud: { name: string; hp: number; hpMax: number; phase: number } | null;
  minimap: {
    cols: number;
    rows: number;
    walls: number[];
    px: number;
    py: number;
    pois: Poi[];
    facing: number;
    view: { x: number; y: number; w: number; h: number };
    radar: boolean;
  };
  typedChars: number;
  wheel: {
    coreStatus: string;
    rpmMilli: number;
    currentRound: number;
    settledThroughRound: number;
    cumulativeWorkUnits: string;
    stale: boolean;
    globalHp: number;
    globalHpMax: number;
    lastHit: string | null;
  };
  keys: Record<string, string>;
  reducedMotion: boolean;
  volumes: { sfx: number; music: number };
  uiScale: number;
  zoneBanner: string | null;
  objectiveHud: { text: string; dist: number; angle: number; onscreen: boolean; tx: number; ty: number };
  inputMode: InputMode;
  debugOpen: boolean;
  inputLog: InputLog[];
  comboHud: number;
  failText: string | null;
  hotPulse: { atk: number; skill: number; ult: number; roll: number; block: number };
  a11y: { shake: number; flash: number; outline: boolean; holdBlock: boolean };
  aimMode: AimMode;
  moveAcc: number;
  quality: Quality;
  fpsOpen: boolean;
  arenaHud: {
    mode: "train" | "battle" | "story";
    level: number;
    wave: number;
    waves: number;
    left: number;
    score: number;
    combo: number;
    ammo: number;
    ammoMax: number;
    weapon: string;
    powerups: { id: PickupId; t: number }[];
    step: string;
    stepI: number;
    stepN: number;
  };
  setSave: (s: SaveBlob | null) => void;
  patch: (p: Partial<SaveBlob>) => void;
  setOverlay: (o: Overlay) => void;
  setDialogue: (d: GameState["dialogue"]) => void;
  setToast: (t: string | null) => void;
  setWheel: (w: Partial<GameState["wheel"]>) => void;
  setPrompt: (p: string | null) => void;
  setNear: (n: string | null) => void;
  setZoneName: (n: string) => void;
  setCooldowns: (c: Partial<GameState["cooldowns"]>) => void;
  setBossHud: (b: GameState["bossHud"]) => void;
  setMinimap: (m: Partial<GameState["minimap"]>) => void;
  bumpTutorial: (event: string) => void;
  bindKey: (action: string, code: string) => void;
  setUiScale: (n: number) => void;
  setZoneBanner: (n: string | null) => void;
  setObjectiveHud: (o: Partial<GameState["objectiveHud"]>) => void;
  skipTutorial: () => void;
  pushLog: (e: InputLog) => void;
  setFail: (t: string | null) => void;
  setComboHud: (n: number) => void;
  pulseHot: (slot: keyof GameState["hotPulse"]) => void;
  toggleDebug: () => void;
  setQuality: (q: Quality) => void;
  setAimMode: (m: AimMode | "hybrid") => void;
};

export const useGame = create<GameState>((set, get) => ({
  save: null,
  overlay: "none",
  dialogue: null,
  toast: null,
  prompt: null,
  near: null,
  zoneName: "Wheelhaven",
  tutorialFlash: null,
  cooldowns: { atk: 0, skill: 0, ult: 0, roll: 0 },
  bossHud: null,
  minimap: { cols: 1, rows: 1, walls: [], px: 0, py: 0, pois: [], facing: 0, view: { x: 0, y: 0, w: 1, h: 1 }, radar: false },
  typedChars: 0,
  wheel: {
    coreStatus: "IDLE",
    rpmMilli: 0,
    currentRound: 0,
    settledThroughRound: 0,
    cumulativeWorkUnits: "0",
    stale: false,
    globalHp: 500,
    globalHpMax: 500,
    lastHit: null,
  },
  keys: {
    up: "W",
    down: "S",
    left: "A",
    right: "D",
    attack: "J",
    skill: "K",
    ult: "L",
    roll: "SPACE",
    sprint: "SHIFT",
    interact: "F",
    inv: "I",
    block: "H",
    help: "F1",
  },
  reducedMotion: typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  volumes: { sfx: 0.4, music: 0.25 },
  uiScale: 0,
  zoneBanner: null,
  objectiveHud: { text: "Talk to the Miller", dist: 0, angle: 0, onscreen: true, tx: 0, ty: 0 },
  inputMode: "gameplay",
  debugOpen: false,
  inputLog: [],
  comboHud: 0,
  failText: null,
  hotPulse: { atk: 0, skill: 0, ult: 0, roll: 0, block: 0 },
  a11y: { shake: 1, flash: 1, outline: false, holdBlock: true },
  aimMode: typeof window !== "undefined" ? loadAimMode() : "mouse",
  moveAcc: 0,
  quality: typeof window !== "undefined" ? loadQuality() : "auto",
  fpsOpen: false,
  arenaHud: {
    mode: "story",
    level: 1,
    wave: 0,
    waves: 0,
    left: 0,
    score: 0,
    combo: 0,
    ammo: 0,
    ammoMax: 0,
    weapon: "Bolt Pistol",
    powerups: [],
    step: "",
    stepI: 0,
    stepN: 8,
  },
  setSave: (save) => set({ save: save ? clampSave(save) : null }),
  patch: (p) => {
    const s = get().save;
    if (s) set({ save: clampSave({ ...s, ...p }) });
  },
  setOverlay: (overlay) => {
    const next = overlayToggle(get().overlay, overlay);
    set({ overlay: next, inputMode: modeFromOverlay(next) });
  },
  setDialogue: (dialogue) => {
    const overlay: Overlay = dialogue ? "dialogue" : get().overlay === "dialogue" ? "none" : get().overlay;
    set({ dialogue, overlay, inputMode: modeFromOverlay(overlay) });
  },
  setToast: (toast) => set({ toast }),
  setWheel: (w) => set({ wheel: { ...get().wheel, ...w } }),
  setPrompt: (prompt) => {
    if (get().prompt === prompt) return;
    set({ prompt });
  },
  setNear: (near) => {
    if (get().near === near) return;
    set({ near });
  },
  setZoneName: (zoneName) => {
    if (get().zoneName === zoneName) return;
    set({ zoneName });
  },
  setCooldowns: (c) => {
    const cur = get().cooldowns;
    const next = { ...cur, ...c };
    if (cur.atk === next.atk && cur.skill === next.skill && cur.ult === next.ult && cur.roll === next.roll) return;
    set({ cooldowns: next });
  },
  setBossHud: (bossHud) => {
    const cur = get().bossHud;
    if (!cur && !bossHud) return;
    if (cur && bossHud && cur.hp === bossHud.hp && cur.phase === bossHud.phase && cur.name === bossHud.name) return;
    set({ bossHud });
  },
  setMinimap: (m) => {
    const cur = get().minimap;
    const next = { ...cur, ...m };
    if (
      cur.px === next.px &&
      cur.py === next.py &&
      cur.cols === next.cols &&
      cur.rows === next.rows &&
      cur.walls === next.walls &&
      cur.pois === next.pois &&
      cur.facing === next.facing &&
      cur.radar === next.radar &&
      cur.view.x === next.view.x &&
      cur.view.y === next.view.y &&
      cur.view.w === next.view.w &&
      cur.view.h === next.view.h
    )
      return;
    set({ minimap: next });
  },
  bumpTutorial: (event) => {
    const s = get().save;
    if (!s) return;
    const next = advanceTutorial(s.tutorialStep, event);
    if (next !== s.tutorialStep) set({ save: { ...s, tutorialStep: next } });
  },
  bindKey: (action, code) => set({ keys: { ...get().keys, [action]: code } }),
  setUiScale: (uiScale) => set({ uiScale }),
  setZoneBanner: (zoneBanner) => set({ zoneBanner }),
  setObjectiveHud: (o) => {
    const cur = get().objectiveHud;
    const next = { ...cur, ...o };
    if (cur.text === next.text && cur.dist === next.dist && cur.onscreen === next.onscreen && cur.angle === next.angle) return;
    set({ objectiveHud: next });
  },
  skipTutorial: () => {
    const s = get().save;
    if (!s) return;
    set({ save: clampSave({ ...s, tutorialStep: 5, flags: { ...s.flags, skipTutorial: true } }) });
    const wb = (typeof window !== "undefined" ? (window as unknown as { __WB?: { skipTrain?: () => void } }).__WB : null);
    wb?.skipTrain?.();
  },
  pushLog: (e) => set({ inputLog: [e, ...get().inputLog].slice(0, 24) }),
  setFail: (failText) => set({ failText }),
  setComboHud: (comboHud) => set({ comboHud }),
  pulseHot: (slot) => set({ hotPulse: { ...get().hotPulse, [slot]: Date.now() } }),
  toggleDebug: () => set({ debugOpen: !get().debugOpen }),
  setQuality: (quality) => {
    saveQuality(quality);
    set({ quality });
  },
  setAimMode: (m) => {
    const aimMode = m === "hybrid" ? "mouse" : m;
    saveAimMode(aimMode);
    set({ aimMode });
  },
}));
