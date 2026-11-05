import { TILE, KT, XT } from "./palette";

export type ZoneId = "haven" | "forest" | "mines" | "foundry" | "arena" | "battle";

export type MapObj =
  | { kind: "spawn"; x: number; y: number }
  | { kind: "portal"; x: number; y: number; to: ZoneId; spawn: string }
  | { kind: "npc"; x: number; y: number; id: string; face?: number }
  | { kind: "enemy"; x: number; y: number; type: EnemyKind; tier: number }
  | { kind: "chest"; x: number; y: number; id: string; loot: string }
  | { kind: "shrine"; x: number; y: number; id: string }
  | { kind: "lever"; x: number; y: number; id: string; doors: string[] }
  | { kind: "door"; x: number; y: number; id: string; needsWheel?: boolean }
  | { kind: "shop"; x: number; y: number }
  | { kind: "smith"; x: number; y: number }
  | { kind: "board"; x: number; y: number }
  | { kind: "boss"; x: number; y: number }
  | { kind: "miniboss"; x: number; y: number }
  | { kind: "vent"; x: number; y: number }
  | { kind: "secret"; x: number; y: number; id: string }
  | { kind: "gear"; x: number; y: number }
  | { kind: "dummy"; x: number; y: number }
  | { kind: "lantern"; x: number; y: number }
  | { kind: "sign"; x: number; y: number; text: string };

export type EnemyKind = "mite" | "crawler" | "sentry" | "slime" | "wasp" | "pellet" | "spark" | "brute";

export type ZoneMap = {
  id: ZoneId;
  name: string;
  music: string;
  tileset: "world";
  cols: number;
  rows: number;
  ground: number[];
  decor: number[];
  walls: number[];
  objects: MapObj[];
};

type Grid = {
  cols: number;
  rows: number;
  ground: number[];
  decor: number[];
  walls: number[];
};

function make(cols: number, rows: number, fill: number): Grid {
  const n = cols * rows;
  return { cols, rows, ground: Array(n).fill(fill), decor: Array(n).fill(-1), walls: Array(n).fill(0) };
}

function at(g: Grid, x: number, y: number) {
  return y * g.cols + x;
}
function inb(g: Grid, x: number, y: number) {
  return x >= 0 && y >= 0 && x < g.cols && y < g.rows;
}
function gnd(g: Grid, x: number, y: number, t: number) {
  if (inb(g, x, y)) g.ground[at(g, x, y)] = t;
}
function dec(g: Grid, x: number, y: number, t: number, collide = false) {
  if (!inb(g, x, y)) return;
  g.decor[at(g, x, y)] = t;
  if (collide) g.walls[at(g, x, y)] = 1;
}
function wall(g: Grid, x: number, y: number, on = true) {
  if (inb(g, x, y)) g.walls[at(g, x, y)] = on ? 1 : 0;
}
function rect(_g: Grid, x: number, y: number, w: number, h: number, fn: (xx: number, yy: number) => void) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) fn(xx, yy);
}

function scatter(g: Grid, tiles: number[], chance: number, seed = 1) {
  let s = seed;
  for (let y = 0; y < g.rows; y++) {
    for (let x = 0; x < g.cols; x++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      if (s / 0x7fffffff < chance) gnd(g, x, y, tiles[s % tiles.length]!);
    }
  }
}

function tree(g: Grid, x: number, y: number, kind: "pine" | "oak" | "round" = "pine") {
  if (kind === "oak") {
    dec(g, x, y - 2, KT.treeO, true);
    dec(g, x, y - 1, KT.treeO2, true);
    dec(g, x, y, KT.treeO3, true);
  } else if (kind === "round") {
    dec(g, x, y - 1, KT.treeR, true);
    dec(g, x, y, KT.bush, true);
  } else {
    dec(g, x, y - 2, KT.pine, true);
    dec(g, x, y - 1, KT.pine2, true);
    dec(g, x, y, KT.pine3, true);
  }
}

function wheat(g: Grid, x: number, y: number) {
  dec(g, x, y - 2, KT.wheatT, false);
  dec(g, x, y - 1, KT.wheatM, false);
  dec(g, x, y, KT.wheatB, false);
}

function woodHouse(g: Grid, x: number, y: number) {
  const rows = [
    [KT.roofO, KT.roofO2, KT.roofO3],
    [KT.roofLo, KT.roofGable, KT.roofLo3],
    [KT.woodWall, KT.woodWin, KT.woodWall3],
    [KT.woodWall, KT.woodDoorOpen, KT.woodWall3],
  ];
  rows.forEach((row, i) => row.forEach((t, j) => dec(g, x + j, y + i, t, true)));
}

function stoneHouse(g: Grid, x: number, y: number) {
  const rows = [
    [KT.stoneTop, KT.stoneTop2, KT.stoneTop3],
    [KT.stoneMid, KT.stoneWin, KT.stoneMid3],
    [KT.stoneWall, KT.stoneWin2, KT.stoneWall3],
    [KT.stoneWall, KT.stoneDoor, KT.stoneWall3],
  ];
  rows.forEach((row, i) => row.forEach((t, j) => dec(g, x + j, y + i, t, true)));
}

function shrineCastle(g: Grid, x: number, y: number) {
  const rows = [
    [KT.castleT, KT.castleT2, KT.castleT2, KT.castleT3],
    [KT.castleM, KT.castleWin, KT.castleM2, KT.castleM3],
    [KT.archL, KT.arch, KT.archR, KT.arch2],
    [KT.gateL, KT.gate, KT.gateR, KT.gateW],
  ];
  rows.forEach((row, i) => row.forEach((t, j) => dec(g, x + j, y + i, t, true)));
}

function fenceBox(g: Grid, x: number, y: number, w: number, h: number) {
  for (let i = 0; i < w; i++) {
    dec(g, x + i, y, i === 0 ? KT.fenceTL : i === w - 1 ? KT.fenceTR : KT.fenceT, true);
    dec(g, x + i, y + h - 1, i === 0 ? KT.fenceL : i === w - 1 ? KT.fenceR : KT.fenceH, true);
  }
  for (let j = 1; j < h - 1; j++) {
    dec(g, x, y + j, KT.fenceV, true);
    dec(g, x + w - 1, y + j, KT.fencePost3, true);
  }
}

function pathTo(g: Grid, x0: number, y0: number, x1: number, y1: number, tile = KT.path) {
  let x = x0;
  let y = y0;
  while (x !== x1) {
    gnd(g, x, y, tile);
    x += x1 > x ? 1 : -1;
  }
  while (y !== y1) {
    gnd(g, x, y, tile);
    y += y1 > y ? 1 : -1;
  }
  gnd(g, x1, y1, tile);
}

function brickRoom(g: Grid, x: number, y: number, w: number, h: number, floor: number) {
  rect(g, x, y, w, h, (xx, yy) => {
    const edge = xx === x || yy === y || xx === x + w - 1 || yy === y + h - 1;
    if (edge) {
      gnd(g, xx, yy, XT.brick);
      dec(g, xx, yy, yy === y ? XT.brickTop : XT.brick, true);
    } else gnd(g, xx, yy, floor);
  });
}

function buildHaven(): Omit<ZoneMap, "id" | "name" | "music" | "tileset" | "objects"> & { objects: MapObj[] } {
  const g = make(56, 36, KT.grass);
  scatter(g, [KT.grass, KT.grassF1, KT.grassF2, KT.grassS], 0.18, 7);

  for (let x = 0; x < g.cols; x++) {
    tree(g, x, 2, x % 3 === 0 ? "oak" : "pine");
    tree(g, x, g.rows - 2, x % 2 === 0 ? "pine" : "round");
    wall(g, x, 0);
    wall(g, x, g.rows - 1);
    dec(g, x, 0, KT.pine, true);
    dec(g, x, g.rows - 1, KT.pine3, true);
  }
  for (let y = 0; y < g.rows; y++) {
    tree(g, 1, y, y % 2 ? "pine" : "oak");
    tree(g, g.cols - 2, y, y % 3 ? "pine" : "round");
    wall(g, 0, y);
    wall(g, g.cols - 1, y);
  }

  rect(g, 16, 9, 16, 9, (x, y) => gnd(g, x, y, KT.path));
  shrineCastle(g, 22, 5);
  const pad = [
    [KT.plaza, KT.plaza2, KT.plaza2, KT.plaza3],
    [KT.plazaB, KT.plazaB2, KT.plazaB2, KT.plazaB3],
  ];
  pad.forEach((row, i) => row.forEach((t, j) => gnd(g, 22 + j, 9 + i, t)));
  dec(g, 24, 10, KT.well, true);

  pathTo(g, 10, 16, 16, 16);
  pathTo(g, 32, 16, 40, 16);
  pathTo(g, 24, 18, 24, 23);
  pathTo(g, 24, 9, 24, 5);
  pathTo(g, 8, 20, 40, 20, KT.path);
  rect(g, 18, 15, 12, 3, (x, y) => gnd(g, x, y, KT.path));

  woodHouse(g, 7, 10);
  stoneHouse(g, 36, 10);
  woodHouse(g, 36, 16);
  stoneHouse(g, 7, 16);

  fenceBox(g, 40, 5, 7, 5);
  wheat(g, 42, 8);
  wheat(g, 44, 8);
  dec(g, 43, 7, KT.mush, false);

  rect(g, 2, 23, 46, 3, (x, y) => {
    gnd(g, x, y, (x + y) % 2 === 0 ? XT.water : XT.water2);
    wall(g, x, y, true);
  });
  rect(g, 22, 23, 5, 3, (x, y) => {
    gnd(g, x, y, XT.bridge);
    wall(g, x, y, false);
    g.decor[at(g, x, y)] = -1;
  });

  dec(g, 18, 14, KT.lantern, false);
  dec(g, 29, 14, KT.lantern, false);
  dec(g, 12, 20, KT.lantern, false);
  dec(g, 33, 20, KT.lantern, false);
  dec(g, 20, 13, KT.crate, true);
  dec(g, 21, 13, KT.barrel, true);
  dec(g, 28, 13, KT.crate, true);
  dec(g, 19, 19, KT.sign, true);
  dec(g, 14, 12, KT.target, false);

  const objects: MapObj[] = [
    { kind: "spawn", x: 20, y: 16 },
    { kind: "shrine", x: 24, y: 10, id: "haven" },
    { kind: "npc", x: 18, y: 16, id: "miller", face: 0 },
    { kind: "npc", x: 26, y: 16, id: "lore", face: 1 },
    { kind: "npc", x: 30, y: 17, id: "scout", face: 2 },
    { kind: "shop", x: 8, y: 14 },
    { kind: "smith", x: 37, y: 14 },
    { kind: "board", x: 19, y: 19 },
    { kind: "dummy", x: 14, y: 13 },
    { kind: "sign", x: 14, y: 12, text: "DUMMY" },
    { kind: "enemy", x: 32, y: 17, type: "slime", tier: 0 },
    { kind: "enemy", x: 34, y: 16, type: "slime", tier: 0 },
    { kind: "enemy", x: 33, y: 18, type: "mite", tier: 0 },
    { kind: "sign", x: 32, y: 15, text: "TRAINING YARD" },
    { kind: "lantern", x: 18, y: 14 },
    { kind: "lantern", x: 29, y: 14 },
    { kind: "lantern", x: 12, y: 20 },
    { kind: "lantern", x: 33, y: 20 },
    { kind: "chest", x: 43, y: 6, id: "haven-secret", loot: "ember-ring" },
    { kind: "portal", x: 46, y: 16, to: "forest", spawn: "west" },
    { kind: "portal", x: 24, y: 27, to: "mines", spawn: "north" },
    { kind: "sign", x: 24, y: 11, text: "WHEEL SHRINE" },
    { kind: "sign", x: 44, y: 15, text: "EAST → COGWOOD" },
    { kind: "sign", x: 24, y: 25, text: "SOUTH → MINES" },
    { kind: "npc", x: 22, y: 18, id: "kid", face: 0 },
    { kind: "npc", x: 28, y: 19, id: "kid2", face: 2 },
  ];
  return { ...g, objects };
}

function buildForest(): Omit<ZoneMap, "id" | "name" | "music" | "tileset" | "objects"> & { objects: MapObj[] } {
  const g = make(58, 34, KT.grass);
  scatter(g, [KT.grass, KT.grassF1, KT.grassS], 0.22, 11);
  for (let x = 0; x < g.cols; x++) {
    tree(g, x, 2, x % 2 ? "pine" : "oak");
    tree(g, x, g.rows - 2, x % 3 ? "pine" : "round");
    wall(g, x, 0);
    wall(g, x, g.rows - 1);
  }
  for (let y = 0; y < g.rows; y++) {
    tree(g, 1, y, "pine");
    tree(g, g.cols - 2, y, y % 2 ? "oak" : "pine");
    wall(g, 0, y);
    wall(g, g.cols - 1, y);
  }
  const groves: Array<[number, number, "pine" | "oak" | "round"]> = [
    [8, 8, "pine"],
    [10, 9, "oak"],
    [12, 8, "pine"],
    [18, 12, "oak"],
    [20, 14, "pine"],
    [22, 12, "round"],
    [30, 8, "pine"],
    [32, 10, "oak"],
    [34, 8, "pine"],
    [40, 16, "pine"],
    [42, 18, "oak"],
    [14, 20, "pine"],
    [16, 22, "round"],
    [28, 20, "oak"],
    [36, 22, "pine"],
  ];
  groves.forEach(([x, y, k]) => tree(g, x, y, k));

  pathTo(g, 4, 6, 20, 6);
  pathTo(g, 20, 6, 20, 16);
  pathTo(g, 20, 16, 40, 16);
  pathTo(g, 40, 16, 46, 24);
  pathTo(g, 12, 6, 12, 16);
  rect(g, 18, 14, 6, 5, (x, y) => gnd(g, x, y, KT.path));

  stoneHouse(g, 26, 4);
  dec(g, 28, 8, KT.stoneDoor, true);
  fenceBox(g, 6, 14, 6, 5);
  dec(g, 8, 16, KT.mush, false);
  dec(g, 22, 15, KT.lantern, false);
  dec(g, 38, 15, KT.lantern, false);
  dec(g, 20, 10, KT.crate, true);
  dec(g, 32, 16, KT.well, true);

  rect(g, 8, 24, 8, 3, (x, y) => {
    gnd(g, x, y, (x + y) % 2 ? XT.water : XT.water2);
    wall(g, x, y, true);
  });
  rect(g, 11, 24, 2, 3, (x, y) => {
    gnd(g, x, y, XT.bridge);
    wall(g, x, y, false);
    g.decor[at(g, x, y)] = -1;
  });

  const objects: MapObj[] = [
    { kind: "spawn", x: 6, y: 6 },
    { kind: "portal", x: 3, y: 6, to: "haven", spawn: "east" },
    { kind: "portal", x: 48, y: 24, to: "foundry", spawn: "gate" },
    { kind: "shrine", x: 32, y: 16, id: "forest" },
    { kind: "npc", x: 10, y: 16, id: "hermit", face: 3 },
    { kind: "enemy", x: 20, y: 8, type: "mite", tier: 1 },
    { kind: "enemy", x: 24, y: 12, type: "mite", tier: 1 },
    { kind: "enemy", x: 36, y: 10, type: "wasp", tier: 2 },
    { kind: "enemy", x: 42, y: 16, type: "mite", tier: 2 },
    { kind: "enemy", x: 16, y: 18, type: "slime", tier: 1 },
    { kind: "enemy", x: 30, y: 22, type: "wasp", tier: 2 },
    { kind: "enemy", x: 28, y: 18, type: "spark", tier: 2 },
    { kind: "enemy", x: 12, y: 10, type: "slime", tier: 1 },
    { kind: "miniboss", x: 40, y: 20 },
    { kind: "chest", x: 28, y: 5, id: "forest-1", loot: "oak-blade" },
    { kind: "chest", x: 44, y: 22, id: "forest-2", loot: "volt-shard" },
    { kind: "secret", x: 14, y: 8, id: "cog-hollow" },
    { kind: "lantern", x: 22, y: 15 },
    { kind: "lantern", x: 38, y: 15 },
    { kind: "sign", x: 46, y: 23, text: "FOUNDRY GATE" },
    { kind: "sign", x: 5, y: 5, text: "WEST → WHEELHAVEN" },
  ];
  return { ...g, objects };
}

function buildMines(): Omit<ZoneMap, "id" | "name" | "music" | "tileset" | "objects"> & { objects: MapObj[] } {
  const g = make(50, 34, XT.brick);
  rect(g, 0, 0, g.cols, g.rows, (x, y) => {
    gnd(g, x, y, XT.brick);
    wall(g, x, y, true);
  });
  brickRoom(g, 2, 2, 12, 8, XT.metal);
  brickRoom(g, 14, 2, 16, 8, XT.metal);
  brickRoom(g, 30, 2, 12, 8, XT.metal);
  brickRoom(g, 2, 10, 12, 8, XT.metal2);
  brickRoom(g, 14, 10, 18, 10, XT.metal);
  brickRoom(g, 32, 10, 10, 10, XT.metal2);
  brickRoom(g, 2, 18, 40, 10, XT.foundry);

  // corridors
  rect(g, 13, 5, 2, 2, (x, y) => {
    gnd(g, x, y, XT.door);
    wall(g, x, y, false);
    g.decor[at(g, x, y)] = -1;
  });
  rect(g, 29, 5, 2, 2, (x, y) => {
    gnd(g, x, y, XT.door);
    wall(g, x, y, false);
    g.decor[at(g, x, y)] = -1;
  });
  rect(g, 7, 9, 2, 2, (x, y) => {
    gnd(g, x, y, XT.metal);
    wall(g, x, y, false);
    g.decor[at(g, x, y)] = -1;
  });
  rect(g, 20, 9, 3, 2, (x, y) => {
    gnd(g, x, y, XT.metal);
    wall(g, x, y, false);
    g.decor[at(g, x, y)] = -1;
  });
  rect(g, 36, 9, 2, 2, (x, y) => {
    gnd(g, x, y, XT.metal);
    wall(g, x, y, false);
    g.decor[at(g, x, y)] = -1;
  });
  rect(g, 20, 19, 4, 2, (x, y) => {
    gnd(g, x, y, XT.metal);
    wall(g, x, y, false);
    g.decor[at(g, x, y)] = -1;
  });

  for (let x = 16; x < 30; x++) gnd(g, x, 14, XT.railH);
  for (let y = 12; y < 18; y++) gnd(g, 22, y, XT.railV);
  rect(g, 18, 16, 6, 2, (x, y) => {
    gnd(g, x, y, XT.lava);
    wall(g, x, y, true);
  });
  rect(g, 26, 22, 4, 2, (x, y) => {
    gnd(g, x, y, XT.lava2);
    wall(g, x, y, true);
  });
  dec(g, 6, 5, XT.torch, false);
  dec(g, 20, 5, XT.torch, false);
  dec(g, 36, 5, XT.torch, false);
  dec(g, 8, 14, XT.torch, false);
  dec(g, 24, 12, XT.torch, false);
  dec(g, 38, 14, XT.torch, false);
  dec(g, 10, 22, XT.torch, false);
  dec(g, 34, 22, XT.torch, false);

  const objects: MapObj[] = [
    { kind: "spawn", x: 6, y: 5 },
    { kind: "portal", x: 4, y: 5, to: "haven", spawn: "south" },
    { kind: "shrine", x: 8, y: 22, id: "mines" },
    { kind: "lever", x: 8, y: 14, id: "lift", doors: ["mine-gate"] },
    { kind: "enemy", x: 18, y: 5, type: "crawler", tier: 2 },
    { kind: "enemy", x: 24, y: 6, type: "crawler", tier: 2 },
    { kind: "enemy", x: 10, y: 15, type: "crawler", tier: 2 },
    { kind: "enemy", x: 26, y: 14, type: "pellet", tier: 3 },
    { kind: "enemy", x: 16, y: 22, type: "crawler", tier: 2 },
    { kind: "enemy", x: 32, y: 22, type: "sentry", tier: 3 },
    { kind: "enemy", x: 34, y: 6, type: "spark", tier: 3 },
    { kind: "enemy", x: 12, y: 22, type: "brute", tier: 3 },
    { kind: "chest", x: 36, y: 5, id: "mine-1", loot: "iron-mail" },
    { kind: "chest", x: 38, y: 14, id: "mine-2", loot: "cog-key" },
    { kind: "miniboss", x: 36, y: 14 },
    { kind: "vent", x: 18, y: 16 },
    { kind: "vent", x: 22, y: 16 },
    { kind: "lantern", x: 6, y: 5 },
    { kind: "lantern", x: 20, y: 5 },
    { kind: "sign", x: 8, y: 13, text: "LEVER" },
  ];
  return { ...g, objects };
}

function buildFoundry(): Omit<ZoneMap, "id" | "name" | "music" | "tileset" | "objects"> & { objects: MapObj[] } {
  const g = make(44, 32, XT.brick);
  rect(g, 0, 0, g.cols, g.rows, (x, y) => {
    gnd(g, x, y, XT.brick);
    wall(g, x, y, true);
  });
  brickRoom(g, 2, 2, 32, 24, XT.foundry);
  rect(g, 6, 6, 24, 14, (x, y) => {
    const ring = (x + y) % 2 === 0 ? XT.foundry2 : XT.metal;
    gnd(g, x, y, ring);
  });
  rect(g, 14, 8, 8, 8, (x, y) => gnd(g, x, y, XT.grate));
  for (let x = 8; x < 28; x++) {
    gnd(g, x, 10, XT.conduit);
    gnd(g, x, 16, XT.conduit);
  }
  for (let y = 8; y < 18; y++) {
    gnd(g, 10, y, XT.conduit);
    gnd(g, 25, y, XT.conduit);
  }
  dec(g, 10, 8, XT.gear, false);
  dec(g, 25, 8, XT.gear, false);
  dec(g, 10, 16, XT.gear, false);
  dec(g, 25, 16, XT.gear, false);
  rect(g, 8, 20, 3, 2, (x, y) => {
    gnd(g, x, y, XT.lava);
    wall(g, x, y, true);
  });
  rect(g, 25, 20, 3, 2, (x, y) => {
    gnd(g, x, y, XT.lava2);
    wall(g, x, y, true);
  });
  dec(g, 6, 6, XT.torch, false);
  dec(g, 29, 6, XT.torch, false);
  dec(g, 6, 18, XT.torch, false);
  dec(g, 29, 18, XT.torch, false);
  rect(g, 16, 2, 4, 2, (x, y) => {
    gnd(g, x, y, XT.door);
    dec(g, x, y, XT.door, true);
  });

  const objects: MapObj[] = [
    { kind: "spawn", x: 18, y: 22 },
    { kind: "portal", x: 18, y: 24, to: "forest", spawn: "east" },
    { kind: "shrine", x: 8, y: 22, id: "foundry" },
    { kind: "boss", x: 18, y: 12 },
    { kind: "vent", x: 8, y: 20 },
    { kind: "vent", x: 26, y: 20 },
    { kind: "enemy", x: 8, y: 10, type: "sentry", tier: 3 },
    { kind: "enemy", x: 27, y: 10, type: "sentry", tier: 3 },
    { kind: "enemy", x: 12, y: 18, type: "brute", tier: 3 },
    { kind: "enemy", x: 24, y: 18, type: "spark", tier: 3 },
    { kind: "gear", x: 10, y: 8 },
    { kind: "gear", x: 25, y: 8 },
    { kind: "gear", x: 10, y: 16 },
    { kind: "gear", x: 25, y: 16 },
    { kind: "door", x: 18, y: 3, id: "inner-gate", needsWheel: true },
    { kind: "lantern", x: 6, y: 6 },
    { kind: "lantern", x: 29, y: 6 },
    { kind: "sign", x: 18, y: 20, text: "THE GEARMAW" },
  ];
  return { ...g, objects };
}

function buildArenaPad(): Omit<ZoneMap, "id" | "name" | "music" | "tileset" | "objects"> & { objects: MapObj[] } {
  const g = make(24, 24, KT.grass);
  return { ...g, objects: [{ kind: "spawn", x: 12, y: 12 }] };
}

export const ZONES: Record<ZoneId, ZoneMap> = {
  haven: { id: "haven", name: "Wheelhaven", music: "haven", tileset: "world", ...buildHaven() },
  forest: { id: "forest", name: "Cogwood Forest", music: "forest", tileset: "world", ...buildForest() },
  mines: { id: "mines", name: "The Rust Mines", music: "mines", tileset: "world", ...buildMines() },
  foundry: { id: "foundry", name: "The Gearmaw's Foundry", music: "foundry", tileset: "world", ...buildFoundry() },
  arena: { id: "arena", name: "Training Arena", music: "haven", tileset: "world", ...buildArenaPad() },
  battle: { id: "battle", name: "Battlefield", music: "foundry", tileset: "world", ...buildArenaPad() },
};

export function tileWorld(tx: number, ty: number) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

export const SPAWNS: Record<string, { zone: ZoneId; x: number; y: number }> = {
  "haven-default": { zone: "haven", x: 20, y: 16 },
  east: { zone: "haven", x: 44, y: 16 },
  south: { zone: "haven", x: 24, y: 21 },
  west: { zone: "forest", x: 6, y: 6 },
  north: { zone: "mines", x: 6, y: 5 },
  gate: { zone: "foundry", x: 18, y: 22 },
};
