export type WeaponId = "pistol" | "shotgun" | "rifle" | "launcher" | "coil";

export type WeaponDef = {
  id: WeaponId;
  name: string;
  short: string;
  dmg: number;
  rate: number;
  spread: number;
  pellets: number;
  speed: number;
  ammo: number;
  reload: number;
  explode?: number;
  beam?: boolean;
  burst?: number;
};

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: { id: "pistol", name: "Bolt Pistol", short: "Bolt", dmg: 7, rate: 150, spread: 0.04, pellets: 1, speed: 300, ammo: 14, reload: 650 },
  shotgun: { id: "shotgun", name: "Cog Shotgun", short: "Shot", dmg: 4, rate: 480, spread: 0.38, pellets: 5, speed: 240, ammo: 6, reload: 900 },
  rifle: { id: "rifle", name: "Steam Rifle", short: "Rifle", dmg: 5, rate: 110, spread: 0.06, pellets: 1, speed: 340, ammo: 24, reload: 800, burst: 3 },
  launcher: { id: "launcher", name: "Gear Launcher", short: "GL", dmg: 16, rate: 720, spread: 0.02, pellets: 1, speed: 180, ammo: 4, reload: 1100, explode: 32 },
  coil: { id: "coil", name: "Spark Coil", short: "Coil", dmg: 3, rate: 70, spread: 0, pellets: 1, speed: 0, ammo: 50, reload: 600, beam: true },
};

export type PickupId = "health" | "shield" | "rapid" | "damage" | "speed" | "magnet" | "nuke" | "ammo" | "charge";

export const PICKUPS: Record<PickupId, { label: string; color: string; ms: number }> = {
  health: { label: "Health", color: "#e4453a", ms: 0 },
  shield: { label: "Shield", color: "#2ee9ff", ms: 10000 },
  rapid: { label: "Rapid Fire", color: "#ff8a1f", ms: 8000 },
  damage: { label: "Double Dmg", color: "#ffe14a", ms: 8000 },
  speed: { label: "Speed", color: "#3dcc6e", ms: 8000 },
  magnet: { label: "Magnet", color: "#b56cff", ms: 10000 },
  nuke: { label: "Nuke", color: "#ff8a1f", ms: 0 },
  ammo: { label: "Ammo", color: "#a8b2c4", ms: 0 },
  charge: { label: "Wheel Charge", color: "#2ee9ff", ms: 0 },
};

export type EnemyId = "mite" | "slime" | "wasp" | "crawler" | "pellet" | "sentry" | "spark" | "brute" | "bomber";

export type WaveSpec = { kind: EnemyId; n: number; tier: number }[];

export const LEVELS: { name: string; waves: WaveSpec[] }[] = [
  {
    name: "Rust Yard",
    waves: [
      [{ kind: "mite", n: 6, tier: 0 }],
      [{ kind: "mite", n: 5, tier: 0 }, { kind: "slime", n: 4, tier: 0 }],
      [{ kind: "mite", n: 8, tier: 1 }, { kind: "slime", n: 6, tier: 0 }],
    ],
  },
  {
    name: "Cog Flats",
    waves: [
      [{ kind: "mite", n: 6, tier: 1 }, { kind: "wasp", n: 3, tier: 0 }],
      [{ kind: "crawler", n: 5, tier: 1 }, { kind: "slime", n: 5, tier: 1 }],
      [{ kind: "wasp", n: 6, tier: 1 }, { kind: "crawler", n: 6, tier: 1 }],
    ],
  },
  {
    name: "Oilworks",
    waves: [
      [{ kind: "pellet", n: 4, tier: 1 }, { kind: "mite", n: 8, tier: 1 }],
      [{ kind: "sentry", n: 3, tier: 2 }, { kind: "crawler", n: 6, tier: 1 }],
      [{ kind: "pellet", n: 5, tier: 2 }, { kind: "sentry", n: 4, tier: 2 }, { kind: "wasp", n: 4, tier: 1 }],
    ],
  },
  {
    name: "Steam Pit",
    waves: [
      [{ kind: "spark", n: 6, tier: 2 }, { kind: "mite", n: 8, tier: 2 }],
      [{ kind: "spark", n: 6, tier: 2 }, { kind: "pellet", n: 4, tier: 2 }, { kind: "bomber", n: 3, tier: 2 }],
      [{ kind: "brute", n: 1, tier: 5 }, { kind: "wasp", n: 6, tier: 2 }, { kind: "crawler", n: 6, tier: 2 }],
    ],
  },
  {
    name: "The Gearmaw",
    waves: [
      [{ kind: "mite", n: 8, tier: 2 }, { kind: "sentry", n: 3, tier: 2 }],
      [{ kind: "wasp", n: 6, tier: 2 }, { kind: "pellet", n: 4, tier: 2 }, { kind: "bomber", n: 3, tier: 2 }],
      [{ kind: "brute", n: 1, tier: 5 }],
    ],
  },
];

export const TRAIN_STEPS = [
  { id: "move", text: "WASD - walk the academy" },
  { id: "aim", text: "Aim - mouse or auto-lock a target" },
  { id: "shoot", text: "J or click - pop a target" },
  { id: "melee", text: "K - melee the dummy" },
  { id: "roll", text: "Space - roll through a hit" },
  { id: "block", text: "Hold H to block" },
  { id: "pickup", text: "Grab the health pack" },
  { id: "drones", text: "Down the 3 moving drones" },
] as const;

export const UPGRADES = [
  { id: "dmg", name: "+20% weapon damage" },
  { id: "rate", name: "+15% fire rate" },
  { id: "clip", name: "+4 clip size" },
  { id: "hp", name: "+12 max HP, heal" },
  { id: "speed", name: "+12% move speed" },
  { id: "surge", name: "Surge fills faster" },
] as const;

export function edgeSpawn(w: number, h: number, pad = 24) {
  const side = Math.floor(Math.random() * 4);
  if (side === 0) return { x: pad + Math.random() * (w - pad * 2), y: pad };
  if (side === 1) return { x: w - pad, y: pad + Math.random() * (h - pad * 2) };
  if (side === 2) return { x: pad + Math.random() * (w - pad * 2), y: h - pad };
  return { x: pad, y: pad + Math.random() * (h - pad * 2) };
}

export function threatBudget(level: number, wave: number) {
  return 8 + level * 6 + wave * 4;
}
