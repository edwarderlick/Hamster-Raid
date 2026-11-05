import { TILE } from "./palette";

export type ArenaTheme = "train" | "rust" | "cog" | "oil" | "steam" | "foundry";

export const THEMES: Record<
  ArenaTheme,
  { name: string; bg: number; accent: number; threat: string; w: number; h: number }
> = {
  train: { name: "Training Academy", bg: 0x1a2433, accent: 0x2ee9ff, threat: "ROOKIE", w: 44, h: 32 },
  rust: { name: "Rust Yard", bg: 0x241810, accent: 0xff8a1f, threat: "LOW", w: 52, h: 36 },
  cog: { name: "Cog Flats", bg: 0x1a2230, accent: 0xa8b2c4, threat: "MED", w: 54, h: 36 },
  oil: { name: "Oilworks", bg: 0x121810, accent: 0x3dcc6e, threat: "HIGH", w: 56, h: 38 },
  steam: { name: "Steam Pit", bg: 0x182028, accent: 0x2ee9ff, threat: "ELITE", w: 56, h: 38 },
  foundry: { name: "The Gearmaw", bg: 0x1a1018, accent: 0xb56cff, threat: "BOSS", w: 60, h: 40 },
};

export function themeFor(mode: "train" | "battle", level: number): ArenaTheme {
  if (mode === "train") return "train";
  return (["rust", "cog", "oil", "steam", "foundry"] as ArenaTheme[])[Math.max(0, Math.min(4, level - 1))]!;
}

/** Tile indices in arena-tiles sheet. */
export const AT = {
  metal: 0,
  grate: 1,
  rust: 2,
  oil: 3,
  crack: 4,
  hazard: 5,
  paint: 6,
  plate: 7,
  wall: 8,
  wallTop: 9,
  pillar: 10,
  convey: 11,
  volt: 12,
  pad: 13,
  core: 14,
  border: 15,
};

export type ArenaMap = {
  cols: number;
  rows: number;
  ground: number[];
  walls: number[];
  pxW: number;
  pxH: number;
  props: { kind: "crate" | "barrel" | "pillar" | "lamp" | "vent" | "slick" | "convey" | "volt" | "pipe" | "fence" | "wheel"; x: number; y: number }[];
  doors: { x: number; y: number }[];
};

export function buildArenaMap(theme: ArenaTheme, seed = 1): ArenaMap {
  const t = THEMES[theme];
  const cols = t.w;
  const rows = t.h;
  const ground = new Array(cols * rows).fill(AT.metal);
  const walls = new Array(cols * rows).fill(0);
  const props: ArenaMap["props"] = [];
  const doors: ArenaMap["doors"] = [];
  const rnd = (n: number) => {
    seed = (seed * 16807) % 2147483647;
    return seed % n;
  };
  const floorMix =
    theme === "rust"
      ? [AT.metal, AT.metal, AT.plate, AT.metal]
      : theme === "oil"
        ? [AT.metal, AT.plate, AT.metal, AT.metal]
        : theme === "steam"
          ? [AT.metal, AT.plate, AT.grate, AT.metal]
          : theme === "foundry"
            ? [AT.metal, AT.plate, AT.metal, AT.crack]
            : theme === "cog"
              ? [AT.metal, AT.plate, AT.metal, AT.grate]
              : [AT.metal, AT.plate, AT.metal, AT.metal];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const edge = x < 2 || y < 2 || x >= cols - 2 || y >= rows - 2;
      if (edge) {
        walls[i] = 1;
        ground[i] = y < 2 ? AT.wallTop : AT.wall;
      } else {
        ground[i] = floorMix[rnd(floorMix.length)]!;
        if (rnd(70) === 0) ground[i] = AT.paint;
        if (rnd(80) === 0) ground[i] = AT.grate;
        if (theme === "rust" && rnd(22) === 0) ground[i] = AT.rust;
        if (theme === "oil" && rnd(16) === 0) ground[i] = AT.oil;
        if (theme === "foundry" && rnd(18) === 0) ground[i] = AT.volt;
      }
    }
  }
  const midX = Math.floor(cols / 2);
  const midY = Math.floor(rows / 2);
  ground[midY * cols + midX] = AT.core;
  ground[midY * cols + midX - 1] = AT.pad;
  ground[midY * cols + midX + 1] = AT.pad;
  const pillarSpots = [
    [8, 8],
    [cols - 9, 8],
    [8, rows - 9],
    [cols - 9, rows - 9],
    [midX - 8, midY],
    [midX + 8, midY],
  ];
  for (const [x, y] of pillarSpots) {
    if (x < 3 || y < 3 || x >= cols - 3 || y >= rows - 3) continue;
    walls[y * cols + x] = 1;
    ground[y * cols + x] = AT.pillar;
    props.push({ kind: "pillar", x: x * TILE + 8, y: y * TILE + 8 });
  }
  const openR = 6;
  const inCenter = (tx: number, ty: number) => Math.hypot(tx - midX, ty - midY) < openR;
  const crateN = theme === "train" ? 4 : 8 + rnd(4);
  for (let i = 0; i < crateN; i++) {
    const x = 5 + rnd(cols - 10);
    const y = 5 + rnd(rows - 10);
    if (walls[y * cols + x] || inCenter(x, y)) continue;
    props.push({ kind: i % 3 === 0 ? "barrel" : "crate", x: x * TILE + 8, y: y * TILE + 8 });
  }
  for (let i = 0; i < 5; i++) {
    const x = 4 + rnd(cols - 8);
    const y = 4 + rnd(rows - 8);
    if (walls[y * cols + x] || inCenter(x, y)) continue;
    const kinds = ["pipe", "fence", "wheel"] as const;
    props.push({ kind: kinds[i % 3]!, x: x * TILE + 8, y: y * TILE + 8 });
  }
  for (let i = 0; i < 6; i++) {
    props.push({ kind: "lamp", x: (4 + i * Math.floor((cols - 8) / 6)) * TILE + 8, y: 3 * TILE + 8 });
  }
  if (theme === "steam" || theme === "foundry") {
    for (let i = 0; i < 4; i++) props.push({ kind: "vent", x: (10 + i * 8) * TILE + 8, y: (10 + (i % 2) * 8) * TILE + 8 });
  }
  if (theme === "oil") {
    for (let i = 0; i < 5; i++) props.push({ kind: "slick", x: (8 + i * 7) * TILE + 8, y: (12 + (i % 3) * 6) * TILE + 8 });
  }
  if (theme === "cog") {
    for (let i = 0; i < 3; i++) props.push({ kind: "convey", x: (12 + i * 10) * TILE + 8, y: (rows - 8) * TILE + 8 });
  }
  if (theme === "foundry") {
    for (let i = 0; i < 3; i++) props.push({ kind: "volt", x: (14 + i * 10) * TILE + 8, y: 14 * TILE + 8 });
  }
  const sides: Array<[number, number]> = [
    [midX, 2],
    [midX, rows - 3],
    [2, midY],
    [cols - 3, midY],
  ];
  for (const [x, y] of sides) {
    walls[y * cols + x] = 0;
    ground[y * cols + x] = AT.pad;
    doors.push({ x: x * TILE + 8, y: y * TILE + 8 });
  }
  return { cols, rows, ground, walls, pxW: cols * TILE, pxH: rows * TILE, props, doors };
}
