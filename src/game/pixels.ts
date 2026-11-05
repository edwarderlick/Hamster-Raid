import Phaser from "phaser";
import { C, KENNEY_COLS, KENNEY_ROWS, TILE } from "./palette";

type Ctx = CanvasRenderingContext2D;

function canvas(w: number, h: number): { c: HTMLCanvasElement; g: Ctx } {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  return { c, g };
}

function p(g: Ctx, x: number, y: number, col: string, w = 1, h = 1) {
  g.fillStyle = col;
  g.fillRect(x, y, w, h);
}

function add(scene: Phaser.Scene, key: string, c: HTMLCanvasElement) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, c);
}

function addSheet(scene: Phaser.Scene, key: string, c: HTMLCanvasElement, fw: number, fh: number) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.addCanvas(key, c);
  if (!tex) return;
  const cols = Math.floor(c.width / fw);
  const rows = Math.floor(c.height / fh);
  let i = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      tex.add(i, 0, x * fw, y * fh, fw, fh);
      i += 1;
    }
  }
}

function outlineBlob(g: Ctx, cells: Array<[number, number, number, number]>, ox: number, oy: number, col = "#5a3010") {
  g.fillStyle = col;
  for (const [x, y, w, h] of cells) {
    g.fillRect(ox + x - 1, oy + y, w + 2, h);
    g.fillRect(ox + x, oy + y - 1, w, h + 2);
  }
}

type HamPose = "idle" | "walk" | "atk0" | "atk1" | "atk2" | "hurt" | "roll" | "dead";

function hamster(
  g: Ctx,
  ox: number,
  oy: number,
  pose: HamPose,
  frame: number,
  dir: number,
  pal: { armor: string; accent: string; cloak?: string },
) {
  const mystic = pal.accent === C.cyan;
  const trick = !!pal.cloak && pal.accent === C.purple;
  const bob = pose === "idle" ? (frame % 2) : 0;
  const lean = pose === "walk" ? (frame % 2 === 0 ? 1 : -1) : 0;
  const atk = pose.startsWith("atk");
  const combo = pose === "atk2" ? 2 : pose === "atk1" ? 1 : 0;
  const lunge = atk ? 2 + combo + (frame % 2) : 0;
  const x = ox + (dir === 3 ? 0 : lean);
  const y = oy + 4 - bob + (pose === "dead" ? 6 : 0);
  const back = dir === 3;
  if (pose === "roll") {
    const spin = frame % 4;
    outlineBlob(g, [[10, 10, 12, 12]], x, y);
    p(g, x + 10, y + 10, pal.armor, 12, 12);
    p(g, x + 13, y + 13, C.fur, 6, 6);
    p(g, x + 12 + (spin % 2), y + 12, pal.accent, 3, 3);
    p(g, x + 11, y + 11, "#e8c090", 2, 2);
    return;
  }
  const stepL = pose === "walk" ? (frame % 2 === 0 ? 2 : 0) : 0;
  const stepR = pose === "walk" ? (frame % 2 === 0 ? 0 : 2) : 0;
  const squash = pose === "hurt" ? 2 : 0;
  const cells: Array<[number, number, number, number]> = [
    [8, 0, 5, 5],
    [17, 0, 5, 5],
    [7, 4, 16, 12],
    [9, 16, 12, 8],
    [10, 24, 4, 4 + stepL],
    [16, 24, 4, 4 + stepR],
  ];
  if (trick) cells.push([22, 16, 6, 3]);
  if (!trick && !mystic) cells.push([6, 16, 4, 8], [20, 16, 4, 8]);
  outlineBlob(g, cells, x, y + squash, "#1a1208");
  p(g, x + 8, y + squash, C.furD, 5, 5);
  p(g, x + 17, y + squash, C.furD, 5, 5);
  p(g, x + 9, y + 1 + squash, C.fur, 3, 3);
  p(g, x + 18, y + 1 + squash, C.fur, 3, 3);
  p(g, x + 7, y + 4 + squash, C.fur, 16, 12);
  p(g, x + 9, y + 6 + squash, "#e8c090", 3, 3);
  if (!back) {
    p(g, x + 11, y + 8 + squash, C.eye, 3, 3);
    p(g, x + 16, y + 8 + squash, C.eye, 3, 3);
    p(g, x + 12, y + 9 + squash, "#fff", 1, 1);
    p(g, x + 17, y + 9 + squash, "#fff", 1, 1);
    p(g, x + 12, y + 12 + squash, C.cream, 6, 3);
  } else {
    p(g, x + 9, y + 6 + squash, C.furD, 12, 6);
  }
  if (pose === "hurt") p(g, x + 11, y + 8, C.red, 8, 3);
  p(g, x + 9, y + 16 + squash, pal.armor, 12, 8);
  p(g, x + 12, y + 18 + squash, pal.accent, 6, 3);
  if (pal.cloak) {
    const sway = frame % 2;
    p(g, x + 5, y + 14 + sway, pal.cloak, 4, 11);
    p(g, x + 3, y + 20 + sway, pal.cloak, 4, 5);
  }
  if (!trick && !mystic) {
    p(g, x + 8, y + 12, C.red, 14, 2);
    p(g, x + 7, y + 18, C.metalL, 4, 4);
    p(g, x + 19, y + 18, C.metalL, 4, 4);
  }
  if (mystic) {
    p(g, x + 7, y + 13, pal.cloak ?? C.cyanD, 16, 11);
    p(g, x + 22, y + 8, C.cyan, 2, 14);
    p(g, x + 20, y + 6, C.cream, 6, 3);
    p(g, x + 21, y + 4 + (frame % 2), C.cyan, 3, 3);
  }
  if (trick) {
    p(g, x + 8, y + 3, C.navy1, 14, 4);
    p(g, x + 22, y + 16, C.purple, 6, 2);
    p(g, x + 22, y + 18, C.furD, 5, 2);
  }
  p(g, x + 10, y + 24 + squash, C.furD, 4, 4 + stepL);
  p(g, x + 16, y + 24 + squash, C.furD, 4, 4 + stepR);
  if (atk) {
    const reach = 6 + combo * 3 + lunge;
    if (mystic) {
      p(g, x + 18 + reach - 6, y + 6, C.cyan, 3, 16);
      p(g, x + 16 + reach - 6, y + 4, C.cream, 7, 3);
    } else if (trick) {
      p(g, x + 20 + reach - 4, y + 14, C.metalL, 8, 2);
      p(g, x + 4, y + 16, C.metalL, 6, 2);
    } else {
      p(g, x + 20 + reach - 6, y + 12, C.metalL, 9, 5);
      p(g, x + 5, y + 16, C.metal, 5, 6);
    }
  }
}

const CLASS_PAL = {
  brawler: { armor: C.orangeD, accent: C.orange },
  mystic: { armor: C.navy4, accent: C.cyan, cloak: C.cyanD },
  trickster: { armor: C.navy2, accent: C.purple, cloak: C.purpleD },
  wanderer: { armor: C.metal, accent: C.cream },
  raider: { armor: C.navy4, accent: C.cyan, cloak: C.orange },
} as const;

export function bakeTextures(scene: Phaser.Scene) {
  // tileset 8x8 tiles
  const tw = 8 * TILE;
  const { c: tiles, g } = canvas(tw, tw);
  const tile = (i: number, draw: (x: number, y: number) => void) => {
    const x = (i % 8) * TILE;
    const y = Math.floor(i / 8) * TILE;
    draw(x, y);
  };
  tile(0, (x, y) => p(g, x, y, C.void, TILE, TILE));
  tile(1, (x, y) => {
    p(g, x, y, C.navy2, TILE, TILE);
    p(g, x + 1, y + 1, C.navy3, 6, 6);
    p(g, x + 9, y + 8, C.navy1, 5, 5);
    p(g, x + 3, y + 10, C.navy4, 2, 2);
  });
  tile(2, (x, y) => {
    p(g, x, y, C.furD, TILE, TILE);
    p(g, x, y + 7, C.orangeD, TILE, 1);
    p(g, x + 7, y, C.orangeD, 1, TILE);
  });
  tile(3, (x, y) => {
    p(g, x, y, C.navy2, TILE, TILE);
    p(g, x + 2, y + 2, C.green, 3, 2);
    p(g, x + 8, y + 9, C.green, 4, 2);
    p(g, x + 5, y + 5, "#245c32", 2, 2);
  });
  tile(4, (x, y) => {
    p(g, x, y, C.navy1, TILE, TILE);
    p(g, x + 1, y + 1, C.metal, 6, 6);
    p(g, x + 8, y + 8, C.metal, 6, 6);
    p(g, x + 7, y + 1, C.cyanD, 2, 2);
  });
  tile(5, (x, y) => {
    p(g, x, y, C.navy0, TILE, TILE);
    p(g, x, y, C.navy4, TILE, 3);
    p(g, x, y + 3, C.navy3, TILE, 10);
    p(g, x + 2, y + 5, C.navy2, 4, 4);
    p(g, x + 10, y + 8, C.metal, 3, 2);
  });
  tile(6, (x, y) => {
    p(g, x, y, C.navy1, TILE, TILE);
    p(g, x, y + 4, C.cyanD, TILE, 8);
    p(g, x + 3, y + 6, C.cyan, 4, 1);
  });
  tile(7, (x, y) => {
    p(g, x, y, C.navy3, TILE, TILE);
    p(g, x + 1, y + 7, C.orangeD, 14, 2);
  });
  tile(8, (x, y) => {
    p(g, x, y, C.navy2, TILE, TILE);
    p(g, x + 3, y + 2, C.orange, 10, 2);
    p(g, x + 6, y + 4, C.cyan, 4, 8);
    p(g, x + 5, y + 12, C.metal, 6, 3);
  });
  tile(9, (x, y) => {
    p(g, x, y, C.navy2, TILE, TILE);
    p(g, x + 3, y + 5, C.orangeD, 10, 8);
    p(g, x + 4, y + 6, C.orange, 8, 3);
    p(g, x + 7, y + 4, C.metalL, 2, 2);
  });
  tile(10, (x, y) => {
    p(g, x, y, C.furD, TILE, TILE);
    p(g, x + 2, y, C.orangeD, 12, TILE);
    p(g, x + 6, y + 7, C.metal, 3, 3);
  });
  tile(11, (x, y) => {
    p(g, x, y, C.navy2, TILE, TILE);
    p(g, x + 3, y + 3, C.orangeD, 10, 10);
    p(g, x + 7, y + 3, C.orange, 2, 10);
    p(g, x + 3, y + 7, C.orange, 10, 2);
  });
  tile(12, (x, y) => {
    p(g, x, y, C.orangeD, TILE, TILE);
    p(g, x + 2, y + 4, C.orange, 5, 3);
    p(g, x + 8, y + 9, C.red, 4, 3);
  });
  tile(13, (x, y) => {
    p(g, x, y, C.navy2, TILE, TILE);
    p(g, x + 4, y + 2, C.furD, 8, 12);
    p(g, x + 6, y + 1, C.green, 4, 4);
  });
  tile(14, (x, y) => {
    p(g, x, y, C.navy3, TILE, TILE);
    p(g, x, y + 6, C.metal, TILE, 4);
  });
  tile(15, (x, y) => {
    p(g, x, y, C.navy1, TILE, TILE);
    p(g, x + 2, y + 2, C.purpleD, 12, 12);
    p(g, x + 6, y + 6, C.cyan, 4, 4);
  });
  addSheet(scene, "tiles", tiles, TILE, TILE);

  bakeWorldAtlas(scene);

  for (const [cls, pal] of Object.entries(CLASS_PAL)) {
    const { c, g: hg } = canvas(8 * 32, 8 * 32);
    const poses: HamPose[] = ["idle", "walk", "atk0", "atk1", "atk2", "hurt", "roll", "dead"];
    poses.forEach((pose, row) => {
      for (let f = 0; f < 8; f++) {
        hamster(hg, f * 32, row * 32, pose, f % 4, f < 4 ? 0 : 3, pal);
      }
    });
    addSheet(scene, `hero-${cls}`, c, 32, 32);
  }

  bakeCritters(scene);

  // fx
  const { c: sw, g: swg } = canvas(16, 16);
  p(swg, 2, 6, C.cream, 12, 4);
  p(swg, 8, 2, C.orange, 6, 12);
  add(scene, "slash", sw);
  for (let i = 0; i < 3; i++) {
    const { c: sc, g: sg } = canvas(24, 16);
    p(sg, 1, 6, C.cream, 20, 3 + i);
    p(sg, 10, 2, C.orange, 10 + i * 2, 12);
    if (i === 2) p(sg, 4, 4, C.cyan, 14, 2);
    add(scene, `slash-${i}`, sc);
  }
  const guns: Array<[string, string, string]> = [
    ["gun-pistol", C.metalL, C.orange],
    ["gun-shotgun", C.metal, C.orangeD],
    ["gun-rifle", C.cyanD, C.cyan],
    ["gun-launcher", C.orangeD, C.orange],
    ["gun-coil", C.cyan, C.cream],
  ];
  for (const [key, a, b] of guns) {
    const { c: gc, g: gg } = canvas(16, 8);
    outlineBlob(gg, [[1, 3, 12, 3], [10, 2, 5, 4], [0, 2, 3, 4]], 0, 0, "#1a1208");
    p(gg, 1, 3, a, 12, 3);
    p(gg, 10, 2, b, 5, 4);
    p(gg, 0, 2, C.furD, 3, 4);
    p(gg, 12, 1, "#fff", 2, 1);
    add(scene, key, gc);
  }

  const { c: dum, g: dmg } = canvas(96, 32);
  for (let i = 0; i < 4; i++) {
    const x = i * 24;
    outlineBlob(dmg, [[6, 2, 12, 10], [10, 12, 4, 16]], x, 0, "#3a2410");
    p(dmg, x + 6, 2, "#c4a06a", 12, 10);
    p(dmg, x + 8, 4, C.cream, 8, 6);
    p(dmg, x + 9, 6, C.eye, 2, 2);
    p(dmg, x + 13, 6, C.eye, 2, 2);
    p(dmg, x + 10, 9, C.red, 4, 2);
    p(dmg, x + 10, 12, "#8a5a28", 4, 16);
    p(dmg, x + 11, 14, C.orangeD, 2, 12);
    p(dmg, x + 6, 26, "#5a3a18", 12, 4);
  }
  addSheet(scene, "dummy", dum, 24, 32);

  const { c: petc, g: petg } = canvas(64, 16);
  for (let i = 0; i < 4; i++) {
    const x = i * 16;
    const b = i % 2;
    outlineBlob(petg, [[4, 4 - b, 8, 8]], x, 0, "#6a3a14");
    p(petg, x + 4, 4 - b, C.fur, 8, 8);
    p(petg, x + 5, 3 - b, C.furD, 2, 2);
    p(petg, x + 9, 3 - b, C.furD, 2, 2);
    p(petg, x + 6, 6 - b, C.eye, 1, 1);
    p(petg, x + 9, 6 - b, C.eye, 1, 1);
    p(petg, x + 7, 8 - b, C.cream, 3, 2);
    p(petg, x + 12, 8 - b, C.furD, 3, 2);
  }
  addSheet(scene, "pet", petc, 16, 16);

  const { c: orb, g: og } = canvas(8, 8);
  p(og, 1, 1, "#1a1208", 6, 6);
  p(og, 2, 2, C.cyan, 4, 4);
  p(og, 3, 3, C.cream, 2, 2);
  p(og, 2, 2, "#fff", 1, 1);
  add(scene, "orb", orb);

  const { c: sh, g: shg } = canvas(16, 16);
  p(shg, 3, 3, C.orange, 10, 10);
  p(shg, 5, 5, C.navy1, 6, 6);
  add(scene, "shield", sh);

  const { c: sm, g: smg } = canvas(16, 16);
  p(smg, 2, 4, C.purpleD, 12, 8);
  p(smg, 5, 6, C.purple, 6, 4);
  add(scene, "smoke", sm);

  const { c: ht, g: htg } = canvas(8, 8);
  p(htg, 2, 2, C.red, 4, 4);
  add(scene, "heart", ht);

  const { c: coin, g: cg } = canvas(8, 8);
  p(cg, 2, 2, C.orange, 4, 4);
  p(cg, 3, 3, C.cream, 2, 2);
  add(scene, "coin", coin);

  bakeVillagers(scene);

  const { c: dust, g: dg } = canvas(8, 8);
  p(dg, 2, 3, "#c4b49a", 4, 3);
  p(dg, 3, 2, "#f0ddb4", 2, 2);
  add(scene, "dust", dust);

  const { c: warn, g: wg } = canvas(16, 16);
  wg.fillStyle = "rgba(228,69,58,0.45)";
  wg.beginPath();
  wg.ellipse(8, 8, 7, 4, 0, 0, Math.PI * 2);
  wg.fill();
  add(scene, "telegraph", warn);

  const { c: shadow, g: sg2 } = canvas(12, 6);
  sg2.fillStyle = "rgba(0,0,0,0.35)";
  sg2.beginPath();
  sg2.ellipse(6, 3, 5, 2, 0, 0, Math.PI * 2);
  sg2.fill();
  add(scene, "blob-shadow", shadow);
  bakeArenaKit(scene);
}

function checker(g: Ctx, x: number, y: number, a: string, b: string, s = 4) {
  p(g, x, y, a, TILE, TILE);
  for (let yy = 0; yy < TILE; yy += s) {
    for (let xx = 0; xx < TILE; xx += s) {
      if (((xx + yy) / s) % 2 === 0) p(g, x + xx, y + yy, b, s, s);
    }
  }
}

function bakeWorldAtlas(scene: Phaser.Scene) {
  const src = scene.textures.get("kenney-town").getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const extraRows = 3;
  const { c, g } = canvas(KENNEY_COLS * TILE, (KENNEY_ROWS + extraRows) * TILE);
  g.drawImage(src, 0, 0);
  const put = (i: number, draw: (x: number, y: number) => void) => {
    const col = i % KENNEY_COLS;
    const row = Math.floor(i / KENNEY_COLS);
    draw(col * TILE, row * TILE);
  };
  const base = KENNEY_COLS * KENNEY_ROWS;
  put(base + 0, (x, y) => {
    p(g, x, y, "#2a6a9a", TILE, TILE);
    p(g, x + 2, y + 3, "#3ec0e0", 5, 2);
    p(g, x + 8, y + 9, "#7ee7ff", 4, 2);
  });
  put(base + 1, (x, y) => {
    p(g, x, y, "#245e8c", TILE, TILE);
    p(g, x + 6, y + 2, "#7ee7ff", 5, 2);
    p(g, x + 1, y + 10, "#3ec0e0", 6, 2);
  });
  put(base + 2, (x, y) => {
    p(g, x, y, "#6a1408", TILE, TILE);
    p(g, x + 2, y + 4, "#e4453a", 12, 8);
    p(g, x + 5, y + 6, "#ff8a1f", 6, 4);
    p(g, x + 1, y + 1, "#ffb070", 3, 2);
  });
  put(base + 3, (x, y) => {
    p(g, x, y, "#4a0c08", TILE, TILE);
    p(g, x + 1, y + 6, "#ff8a1f", 14, 6);
    p(g, x + 6, y + 3, "#e4453a", 4, 8);
  });
  put(base + 4, (x, y) => {
    p(g, x, y, "#4a4034", TILE, TILE);
    p(g, x, y + 6, "#c45c08", TILE, 4);
    p(g, x, y + 7, "#ff8a1f", TILE, 2);
    p(g, x + 4, y + 5, C.metalL, 2, 6);
  });
  put(base + 5, (x, y) => {
    p(g, x, y, "#4a4034", TILE, TILE);
    p(g, x + 6, y, "#c45c08", 4, TILE);
    p(g, x + 7, y, "#ff8a1f", 2, TILE);
  });
  put(base + 6, (x, y) => {
    checker(g, x, y, "#6a6258", "#8a8274", 8);
    p(g, x + 1, y + 1, "#a8a090", 2, 2);
  });
  put(base + 7, (x, y) => {
    checker(g, x, y, "#5a5248", "#7a7264", 8);
    p(g, x + 10, y + 10, "#c4b49a", 3, 3);
  });
  put(base + 8, (x, y) => {
    p(g, x, y, "#3a322c", TILE, TILE);
    p(g, x, y, "#8a7a66", TILE, 3);
    p(g, x + 1, y + 4, "#5a4e46", 14, 11);
    p(g, x + 2, y + 6, "#2a221c", 4, 4);
  });
  put(base + 9, (x, y) => {
    p(g, x, y, "#2a221c", TILE, TILE);
    p(g, x, y, "#c4b49a", TILE, 5);
    p(g, x + 1, y + 6, "#5a4e46", 14, 9);
  });
  put(base + 10, (x, y) => {
    p(g, x, y, "#3a322c", TILE, TILE);
    p(g, x + 6, y + 2, "#ff8a1f", 4, 8);
    p(g, x + 5, y + 1, C.cream, 6, 3);
    p(g, x + 7, y + 10, C.metal, 2, 4);
  });
  put(base + 11, (x, y) => {
    checker(g, x, y, "#3a2a28", "#5a3a30", 8);
    p(g, x + 3, y + 3, "#2ee9ff", 2, 2);
  });
  put(base + 12, (x, y) => {
    checker(g, x, y, "#2a1a18", "#4a2a22", 8);
    p(g, x + 10, y + 2, C.orange, 3, 2);
  });
  put(base + 13, (x, y) => {
    p(g, x, y, "#2a221c", TILE, TILE);
    p(g, x + 3, y + 3, C.orangeD, 10, 10);
    p(g, x + 7, y + 3, C.orange, 2, 10);
    p(g, x + 3, y + 7, C.orange, 10, 2);
    p(g, x + 7, y + 7, C.cyan, 2, 2);
  });
  put(base + 14, (x, y) => {
    p(g, x, y, "#2a221c", TILE, TILE);
    p(g, x + 2, y + 6, C.cyanD, 12, 4);
    p(g, x + 6, y + 2, C.cyan, 4, 12);
  });
  put(base + 15, (x, y) => {
    p(g, x, y, "#3a140c", TILE, TILE);
    p(g, x + 4, y + 4, C.red, 8, 8);
    p(g, x + 6, y + 6, C.orange, 4, 4);
  });
  put(base + 16, (x, y) => {
    p(g, x, y, "#245c32", TILE, TILE);
    p(g, x + 2, y + 8, C.green, 12, 4);
    p(g, x + 6, y + 4, "#3dcc6e", 4, 6);
  });
  put(base + 17, (x, y) => {
    p(g, x, y, "#6a4a28", TILE, TILE);
    p(g, x, y + 4, "#8a6a38", TILE, 2);
    p(g, x, y + 10, "#4a3218", TILE, 2);
  });
  put(base + 18, (x, y) => {
    p(g, x, y, "#8a6a38", TILE, TILE);
    p(g, x, y + 6, "#c4a060", TILE, 4);
    p(g, x + 2, y + 2, "#6a4a28", 12, 2);
  });
  put(base + 19, (x, y) => {
    p(g, x, y, "#5a4e46", TILE, TILE);
    p(g, x + 4, y + 2, "#1a120c", 8, 12);
    p(g, x + 5, y + 4, C.orangeD, 6, 8);
  });
  put(base + 20, (x, y) => {
    checker(g, x, y, "#2a2a30", "#4a4a52", 4);
    p(g, x + 6, y + 6, C.cyan, 4, 4);
  });
  put(base + 21, (x, y) => {
    p(g, x, y, "#3a2218", TILE, TILE);
    p(g, x + 5, y + 5, C.orange, 6, 6);
    p(g, x + 7, y + 3, C.cream, 2, 2);
  });
  put(base + 22, (x, y) => {
    p(g, x, y, "#3a3a44", TILE, TILE);
    p(g, x + 4, y + 2, "#a8b2c4", 8, 3);
    p(g, x + 6, y + 6, "#d0d8e4", 4, 6);
  });
  put(base + 23, (x, y) => {
    p(g, x, y, "#1a2550", TILE, TILE);
    p(g, x + 5, y + 4, C.cyan, 6, 8);
    p(g, x + 7, y + 2, C.cream, 2, 2);
  });
  const img = g.getImageData(0, 0, c.width, KENNEY_ROWS * TILE);
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i]! < 10 && img.data[i + 1]! < 10 && img.data[i + 2]! < 10) img.data[i + 3] = 0;
  }
  g.putImageData(img, 0, 0);
  addSheet(scene, "world", c, TILE, TILE);
}

function bakeCritters(scene: Phaser.Scene) {
  const R = C.rust;
  const RD = C.rustD;
  const O = C.oxide;
  const OD = C.oxideD;
  const V = C.purple;
  const VD = C.purpleD;
  const ink = "#1a1208";

  const { c: mite, g: mg } = canvas(96, 24);
  for (let i = 0; i < 4; i++) {
    const x = i * 24;
    const bob = i % 2;
    const wind = i === 3 ? 1 : 0;
    outlineBlob(mg, [[7, 8 - bob, 10, 10], [4, 10, 3, 3], [17, 10, 3, 3], [8, 18, 3, 3 + bob], [14, 18, 3, 3 - bob]], x, 0, ink);
    p(mg, x + 7, 8 - bob, R, 10, 10);
    p(mg, x + 6, 11 - bob, RD, 2, 4);
    p(mg, x + 16, 11 - bob, RD, 2, 4);
    p(mg, x + 9, 6 - bob, RD, 6, 2);
    p(mg, x + 9, 10 - bob, C.eye, 2, 2);
    p(mg, x + 13, 10 - bob, C.eye, 2, 2);
    p(mg, x + 10, 14 - bob, "#d8c4a0", 4, 2);
    p(mg, x + 8, 18, RD, 3, 3 + bob);
    p(mg, x + 14, 18, RD, 3, 3 - bob);
    if (wind) p(mg, x + 10, 6, R, 4, 2);
  }
  addSheet(scene, "mite", mite, 24, 24);

  const { c: slime, g: sg } = canvas(96, 24);
  for (let i = 0; i < 4; i++) {
    const x = i * 24;
    const step = i % 2;
    outlineBlob(sg, [[4, 10, 14, 8], [2, 8, 6, 6], [16, 12, 6, 3], [3, 6, 3, 3], [8, 6, 3, 3]], x, 0, ink);
    p(sg, x + 4, 10 + step, R, 14, 8 - step);
    p(sg, x + 2, 8, RD, 6, 6);
    p(sg, x + 3, 6, RD, 3, 3);
    p(sg, x + 8, 6, RD, 3, 3);
    p(sg, x + 4, 9, C.eye, 2, 2);
    p(sg, x + 8, 9, C.eye, 2, 2);
    p(sg, x + 5, 12, "#d8c4a0", 3, 2);
    p(sg, x + 16, 12 + step, RD, 6, 3);
  }
  addSheet(scene, "slime", slime, 24, 24);

  const { c: wasp, g: wg } = canvas(96, 24);
  for (let i = 0; i < 4; i++) {
    const x = i * 24;
    const wing = i % 2 === 0 ? 2 : 0;
    outlineBlob(wg, [[8, 8, 8, 10], [4, 6, 6, 4], [14, 6, 6, 4]], x, 0, ink);
    p(wg, x + 8, 8, O, 8, 10);
    p(wg, x + 10, 10, "#d8c4a0", 4, 4);
    p(wg, x + 4, 6 - wing, C.cyan, 6, 4);
    p(wg, x + 14, 6 + wing, C.cyan, 6, 4);
    p(wg, x + 10, 12, C.eye, 2, 2);
    p(wg, x + 9, 16, OD, 6, 3);
  }
  addSheet(scene, "wasp", wasp, 24, 24);

  const { c: crawler, g: cg } = canvas(96, 24);
  for (let i = 0; i < 4; i++) {
    const x = i * 24;
    const crawl = i % 2;
    outlineBlob(cg, [[2, 10, 20, 8], [0, 12, 4, 3], [20, 12, 4, 3]], x, 0, ink);
    p(cg, x + 2, 10, R, 20, 8);
    p(cg, x + 4, 8, RD, 6, 6);
    p(cg, x + 16, 8, RD, 6, 6);
    p(cg, x + 6, 12, C.eye, 2, 2);
    p(cg, x + 4 + crawl, 18, RD, 3, 3);
    p(cg, x + 16 - crawl, 18, RD, 3, 3);
    p(cg, x + 18, 14, RD, 5, 2);
  }
  addSheet(scene, "crawler", crawler, 24, 24);

  const { c: sentry, g: n } = canvas(96, 32);
  for (let i = 0; i < 4; i++) {
    const x = i * 24;
    outlineBlob(n, [[6, 4, 12, 24]], x, 0, ink);
    p(n, x + 6, 4, C.metal, 12, 24);
    p(n, x + 8, 8, O, 8, 6);
    p(n, x + 9, 18, C.navy4, 6, 8);
    p(n, x + 10, 10, i % 2 ? C.red : "#d8c4a0", 4, 3);
    p(n, x + 7, 26, OD, 10, 4);
  }
  addSheet(scene, "sentry", sentry, 24, 32);

  const { c: pellet, g: pg } = canvas(96, 24);
  for (let i = 0; i < 4; i++) {
    const x = i * 24;
    outlineBlob(pg, [[4, 6, 16, 14]], x, 0, ink);
    p(pg, x + 4, 6, C.metal, 16, 14);
    p(pg, x + 8, 10, R, 8, 6);
    p(pg, x + 10, 12, C.red, 4, 3);
    p(pg, x + 6, 4, C.metalL, 12, 4);
  }
  addSheet(scene, "pellet", pellet, 24, 24);

  const { c: spark, g: spg } = canvas(96, 24);
  for (let i = 0; i < 4; i++) {
    const x = i * 24;
    const glow = i % 2;
    outlineBlob(spg, [[6, 8, 12, 10], [4, 12, 4, 4], [16, 12, 4, 4]], x, 0, ink);
    p(spg, x + 6, 8, OD, 12, 10);
    p(spg, x + 8, 9, C.cyanD, 8, 6);
    p(spg, x + 9, 10, glow ? C.cyan : "#9ef6ff", 6, 4);
    p(spg, x + 10, 12, C.eye, 2, 2);
    p(spg, x + 4, 14, OD, 3, 3);
    p(spg, x + 17, 14, OD, 3, 3);
  }
  addSheet(scene, "spark", spark, 24, 24);

  const { c: brute, g: br } = canvas(128, 32);
  for (let i = 0; i < 4; i++) {
    const x = i * 32;
    const step = i % 2;
    const wind = i === 3 ? 2 : 0;
    outlineBlob(br, [[4, 10, 22, 16], [8, 2, 14, 10], [24, 12, 6, 3]], x, 0, ink);
    p(br, x + 4, 10, R, 22, 16);
    p(br, x + 6, 10, RD, 20, 4);
    p(br, x + 8, 2, RD, 14, 10);
    p(br, x + 10, 12, C.eye, 3, 3);
    p(br, x + 17, 12, C.eye, 3, 3);
    p(br, x + 13, 18, "#d8c4a0", 6, 3);
    p(br, x + 6 + step, 24, RD, 6, 6);
    p(br, x + 18 - step, 24, RD, 6, 6);
    p(br, x + 24 + wind, 12, C.metalL, 7, 3);
    p(br, x + 28 + wind, 10, C.metal, 3, 8);
  }
  addSheet(scene, "brute", brute, 32, 32);

  const { c: cr, g: crg } = canvas(12, 10);
  p(crg, 2, 4, V, 8, 3);
  p(crg, 3, 1, V, 2, 4);
  p(crg, 5, 0, VD, 2, 5);
  p(crg, 7, 1, V, 2, 4);
  add(scene, "elite-crown", cr);

  const { c: bc, g: bg } = canvas(256, 64);
  for (let i = 0; i < 4; i++) {
    const x = i * 64;
    outlineBlob(bg, [[12, 16, 40, 40], [20, 6, 24, 14]], x, 0);
    p(bg, x + 12, 16, C.navy2, 40, 40);
    p(bg, x + 16, 20, C.metal, 32, 28);
    p(bg, x + 20, 6, C.orangeD, 24, 14);
    p(bg, x + 24, 24, C.orange, 16, 16);
    p(bg, x + 26, 28, C.red, 4, 4);
    p(bg, x + 34, 28, C.red, 4, 4);
    p(bg, x + 30, 36, C.cyan, 6, 6);
    p(bg, x + 18, 18, C.orange, 8, 2);
    p(bg, x + 38, 18, C.orange, 8, 2);
    if (i === 1) p(bg, x + 8, 12, C.orange, 6, 6);
    if (i === 2) p(bg, x + 50, 28, C.cyan, 8, 4);
    if (i === 3) p(bg, x + 16, 48, C.red, 32, 6);
  }
  addSheet(scene, "gearmaw", bc, 64, 64);
}

function npcBody(g: Ctx, x: number, armor: string, accent: string, hat?: string) {
  outlineBlob(g, [[6, 2, 12, 8], [6, 10, 12, 12], [7, 22, 4, 6], [13, 22, 4, 6]], x, 0, "#6a3a14");
  p(g, x + 6, 2, C.fur, 12, 8);
  p(g, x + 8, 5, C.eye, 2, 2);
  p(g, x + 14, 5, C.eye, 2, 2);
  p(g, x + 10, 8, C.cream, 4, 2);
  p(g, x + 6, 10, armor, 12, 12);
  p(g, x + 9, 13, accent, 6, 3);
  p(g, x + 7, 22, C.furD, 4, 6);
  p(g, x + 13, 22, C.furD, 4, 6);
  if (hat) p(g, x + 5, 1, hat, 14, 3);
}

function bakeVillagers(scene: Phaser.Scene) {
  const specs: Array<{ id: string; armor: string; accent: string; extra: (g: Ctx, x: number) => void }> = [
    { id: "miller", armor: C.cream, accent: C.orange, extra: (g, x) => { p(g, x + 4, 1, C.orangeD, 16, 3); p(g, x + 16, 14, C.cream, 6, 8); } },
    { id: "lore", armor: C.navy4, accent: C.cyan, extra: (g, x) => { p(g, x + 8, 10, C.cream, 8, 8); p(g, x + 20, 8, C.cyan, 2, 16); } },
    { id: "scout", armor: C.green, accent: C.cream, extra: (g, x) => { p(g, x + 18, 6, C.metal, 6, 2); p(g, x + 22, 5, C.cyan, 2, 4); } },
    { id: "kid", armor: C.orange, accent: C.red, extra: (g, x) => { p(g, x + 6, 10, C.red, 12, 3); } },
    { id: "kid2", armor: C.navy3, accent: C.green, extra: (g, x) => { p(g, x + 4, 12, C.green, 4, 12); } },
    { id: "shop", armor: C.purpleD, accent: C.purple, extra: (g, x) => { p(g, x + 5, 1, C.purple, 14, 3); } },
    { id: "smith", armor: C.metal, accent: C.orange, extra: (g, x) => { p(g, x + 5, 12, C.metalL, 14, 8); p(g, x + 18, 16, C.metalL, 5, 8); } },
    { id: "hermit", armor: C.navy2, accent: C.cream, extra: (g, x) => { p(g, x + 7, 8, C.cream, 10, 6); } },
  ];
  const { c, g } = canvas(192, 28);
  specs.forEach((s, i) => {
    const x = i * 24;
    npcBody(g, x, s.armor, s.accent);
    s.extra(g, x);
    const { c: one, g: og } = canvas(24, 28);
    og.drawImage(c, x, 0, 24, 28, 0, 0, 24, 28);
    add(scene, `npc-${s.id}`, one);
  });
  addSheet(scene, "villager", c, 24, 28);
  add(scene, "npc", c);
}

function bakeArenaKit(scene: Phaser.Scene) {
  const { c, g } = canvas(16 * TILE, TILE);
  const cell = (i: number, fn: (x: number) => void) => fn(i * TILE);
  const plate = (x: number, a: string, b: string, seam = true) => {
    p(g, x, 0, a, TILE, TILE);
    p(g, x + 2, 2, b, 5, 5);
    p(g, x + 9, 8, b, 4, 4);
    if (seam) {
      p(g, x, 0, "#0e1424", TILE, 1);
      p(g, x, 0, "#0e1424", 1, TILE);
    }
  };
  cell(0, (x) => plate(x, "#161e2e", "#1a2436"));
  cell(1, (x) => {
    plate(x, "#182232", "#1c283c");
    p(g, x + 3, 3, "#2a3448", 2, 2);
    p(g, x + 11, 10, "#2a3448", 2, 2);
  });
  cell(2, (x) => {
    plate(x, "#1a221c", "#24281c");
    p(g, x + 4, 6, "#3a2a18", 6, 3);
  });
  cell(3, (x) => {
    plate(x, "#12181c", "#161e22");
    p(g, x + 3, 8, "#0a1014", 8, 4);
    p(g, x + 5, 9, "#1a2420", 4, 2);
  });
  cell(4, (x) => {
    p(g, x, 0, "#141c2a", TILE, TILE);
    p(g, x + 2, 2, "#0c121c", 12, 12);
    p(g, x + 2, 6, "#2a3448", 12, 1);
    p(g, x + 6, 2, "#2a3448", 1, 12);
  });
  cell(5, (x) => {
    p(g, x, 0, "#2a1a14", TILE, TILE);
    p(g, x + 1, 1, C.red, 14, 14);
    p(g, x + 4, 4, "#3a2018", 8, 8);
    p(g, x + 6, 6, C.red, 4, 4);
  });
  cell(6, (x) => {
    plate(x, "#161e2e", "#1a2436");
    p(g, x + 4, 8, "#121018", 7, 4);
    p(g, x + 5, 9, "#1a1810", 4, 2);
  });
  cell(7, (x) => plate(x, "#182232", "#1e2a3c"));
  cell(8, (x) => {
    p(g, x, 0, "#121826", TILE, TILE);
    p(g, x, 2, "#243044", TILE, 12);
    p(g, x + 2, 4, "#4a556c", 12, 2);
  });
  cell(9, (x) => {
    p(g, x, 0, "#2a3448", TILE, TILE);
    p(g, x, 0, C.navy4, TILE, 4);
    p(g, x + 3, 8, "#1a2230", 10, 2);
  });
  cell(10, (x) => {
    p(g, x, 0, "#2a3348", TILE, TILE);
    p(g, x + 4, 2, "#5a6478", 8, 12);
    p(g, x + 6, 4, C.metal, 4, 8);
  });
  cell(11, (x) => {
    p(g, x, 0, "#1a2230", TILE, TILE);
    p(g, x + 2, 2, C.metal, 12, 12);
    p(g, x + 6, 2, C.metalL, 4, 12);
    p(g, x + 2, 6, C.metalL, 12, 4);
  });
  cell(12, (x) => {
    p(g, x, 0, "#1a1420", TILE, TILE);
    p(g, x + 3, 3, C.purpleD, 10, 10);
    p(g, x + 6, 6, C.purple, 4, 4);
  });
  cell(13, (x) => {
    plate(x, "#161e2e", "#1c283c");
    p(g, x + 5, 5, "#243848", 6, 6);
  });
  cell(14, (x) => {
    p(g, x, 0, "#12141c", TILE, TILE);
    p(g, x + 4, 4, C.purpleD, 8, 8);
    p(g, x + 6, 6, C.cyan, 4, 4);
  });
  cell(15, (x) => {
    p(g, x, 0, "#070b1a", TILE, TILE);
    p(g, x, 0, "#121a2c", TILE, 3);
  });
  addSheet(scene, "arena-tiles", c, TILE, TILE);

  const guns: Array<[string, string, string, number]> = [
    ["gun-pistol", C.metalL, C.orange, 26],
    ["gun-shotgun", C.metal, C.orangeD, 28],
    ["gun-rifle", C.cyanD, C.cyan, 32],
    ["gun-launcher", C.orangeD, C.orange, 28],
    ["gun-coil", C.cyan, C.cream, 30],
  ];
  for (const [key, a, b, len] of guns) {
    const { c: gc, g: gg } = canvas(32, 14);
    p(gg, 0, 4, C.furD, 6, 6);
    p(gg, 4, 5, a, len - 6, 4);
    p(gg, len - 6, 3, b, 6, 8);
    p(gg, 2, 9, C.metal, 4, 3);
    add(scene, key, gc);
  }
  const { c: mz, g: mzg } = canvas(16, 16);
  p(mzg, 1, 6, C.orange, 14, 4);
  p(mzg, 5, 2, C.cream, 8, 12);
  p(mzg, 7, 6, "#fff", 5, 4);
  add(scene, "muzzle", mz);
  const { c: sh, g: shg } = canvas(4, 3);
  p(shg, 0, 0, C.cream, 4, 3);
  p(shg, 1, 1, C.orangeD, 2, 1);
  add(scene, "shell", sh);
  const bullets: Array<[string, string, string]> = [
    ["bullet-pistol", C.orange, "#fff"],
    ["bullet-shotgun", C.cream, "#fff"],
    ["bullet-rifle", C.cyan, "#fff"],
    ["bullet-launcher", C.red, C.cream],
    ["bullet-coil", C.cyan, C.cream],
  ];
  for (const [key, core, hi] of bullets) {
    const { c: bc, g: bg } = canvas(10, 6);
    p(bg, 0, 1, core, 10, 4);
    p(bg, 2, 2, hi, 5, 2);
    p(bg, 1, 0, core, 2, 6);
    add(scene, key, bc);
  }
  const { c: rim, g: rimg } = canvas(16, 16);
  rimg.fillStyle = "rgba(46,233,255,0.55)";
  rimg.fillRect(12, 3, 3, 10);
  rimg.fillStyle = "rgba(46,233,255,0.25)";
  rimg.fillRect(10, 4, 2, 8);
  add(scene, "hero-rim", rim);
  const { c: crate, g: crg } = canvas(16, 16);
  p(crg, 0, 0, "#1a1208", 16, 16);
  p(crg, 1, 1, "#5a3e28", 14, 14);
  p(crg, 3, 4, "#2a1c12", 10, 2);
  p(crg, 3, 9, "#2a1c12", 10, 2);
  add(scene, "prop-crate", crate);
  const { c: bar, g: barg } = canvas(16, 16);
  p(barg, 2, 1, "#1a1208", 12, 14);
  p(barg, 3, 2, "#6a4030", 10, 12);
  p(barg, 4, 4, C.red, 8, 2);
  p(barg, 5, 8, "#3a2018", 6, 4);
  add(scene, "prop-barrel", bar);
  const { c: vg, g: vgg } = canvas(64, 36);
  const grd = vgg.createRadialGradient(32, 18, 10, 32, 18, 34);
  grd.addColorStop(0, "rgba(0,0,0,0)");
  grd.addColorStop(0.62, "rgba(0,0,0,0)");
  grd.addColorStop(1, "rgba(5,8,20,0.72)");
  vgg.fillStyle = grd;
  vgg.fillRect(0, 0, 64, 36);
  add(scene, "arena-vignette", vg);
  const { c: tg, g: tgg } = canvas(20, 24);
  p(tgg, 8, 0, C.metal, 4, 8);
  p(tgg, 2, 8, C.red, 16, 16);
  p(tgg, 6, 12, C.cream, 8, 8);
  p(tgg, 8, 14, C.red, 4, 4);
  add(scene, "target", tg);
  const { c: po, g: pog } = canvas(24, 24);
  pog.strokeStyle = C.orange;
  pog.lineWidth = 2;
  pog.beginPath();
  pog.arc(12, 12, 10, 0, Math.PI * 2);
  pog.stroke();
  p(pog, 10, 10, C.cyan, 4, 4);
  add(scene, "portal", po);
  const { c: rt, g: rtg } = canvas(16, 16);
  p(rtg, 7, 0, C.cyan, 2, 5);
  p(rtg, 7, 11, C.cyan, 2, 5);
  p(rtg, 0, 7, C.cyan, 5, 2);
  p(rtg, 11, 7, C.cyan, 5, 2);
  add(scene, "reticle", rt);
}
