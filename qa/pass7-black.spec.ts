import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";

const OUT = path.join(process.cwd(), "docs", "qa", "pass7", "black");
fs.mkdirSync(OUT, { recursive: true });

type WB = {
  startBattle: (n: number) => void;
  nextLevel: () => void;
  burstCombat: () => void;
  cam: () => { nan: boolean; scrollX: number; scrollY: number; zoom: number; alpha: number; px: number; py: number; level: number; theme: string; ground: boolean };
  loseGl: () => void;
  restoreGl: () => void;
  scene: { mode: string; level: number };
  overlay: (o: string) => void;
  spawnMix: (n: number) => void;
  bootGen: number;
};

function pngLit(buf: Buffer) {
  if (buf[0] !== 0x89) return { lit: 0, n: 0, w: 0, h: 0 };
  let i = 8;
  let w = 0;
  let h = 0;
  let depth = 8;
  let colorType = 6;
  const chunks: Buffer[] = [];
  while (i + 8 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString("ascii", i + 4, i + 8);
    const data = buf.subarray(i + 8, i + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      depth = data[8]!;
      colorType = data[9]!;
    }
    if (type === "IDAT") chunks.push(Buffer.from(data));
    i += 12 + len;
    if (type === "IEND") break;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1;
  void depth;
  const stride = w * bpp;
  let lit = 0;
  let n = 0;
  let max = 0;
  let sum = 0;
  let prev = Buffer.alloc(stride);
  let p = 0;
  const x0 = 0;
  const x1 = w;
  const y0 = 0;
  const y1 = h;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    const row = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const v = raw[p++];
      const a = x >= bpp ? row[x - bpp]! : 0;
      const b = prev[x]!;
      const c = x >= bpp ? prev[x - bpp]! : 0;
      let val = v;
      if (filter === 1) val = (v + a) & 255;
      else if (filter === 2) val = (v + b) & 255;
      else if (filter === 3) val = (v + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const pr = a + b - c;
        const pa = Math.abs(pr - a);
        const pb = Math.abs(pr - b);
        const pc = Math.abs(pr - c);
        val = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
      row[x] = val;
    }
    prev = row;
    if (y < y0 || y > y1) continue;
    for (let x = x0; x < x1; x += 2) {
      const r = row[x * bpp]!;
      const g = bpp > 1 ? row[x * bpp + 1]! : r;
      const bl = bpp > 2 ? row[x * bpp + 2]! : r;
      const lum = r + g + bl;
      n += 1;
      sum += lum;
      if (lum > max) max = lum;
      if (lum > 8) lit += 1;
    }
  }
  return { lit, n, w, h, max, mean: n ? sum / n : 0, ratio: n ? lit / n : 0 };
}

async function boot(page: import("@playwright/test").Page) {
  const camLogs: string[] = [];
  page.on("pageerror", (err) => {
    throw err;
  });
  page.on("console", (msg) => {
    const t = msg.text();
    if (t.includes("[WB-CAM]") || t.includes("[WB-WATCHDOG]") || t.includes("[WB-GL]") || t.includes("[WB-FLOOR]")) {
      camLogs.push(t);
    }
  });
  await page.goto("/?qa=arena");
  await page.waitForSelector('[data-testid="hud-root"]', { timeout: 25000 });
  await page.waitForFunction(() => Boolean((window as unknown as { __WB?: WB }).__WB));
  await page.waitForTimeout(600);
  return camLogs;
}

async function waitLevel(page: import("@playwright/test").Page, level: number, prevGen?: number) {
  await page.waitForFunction(
    ({ lv, gen }) => {
      const wb = (window as unknown as { __WB?: WB }).__WB;
      if (!wb || wb.bootGen <= gen) return false;
      return wb.scene.mode === "battle" && wb.scene.level === lv && Boolean(wb.cam) && !wb.cam().nan;
    },
    { lv: level, gen: prevGen ?? 0 },
    { timeout: 20000 },
  );
  await page.waitForTimeout(350);
}

async function worldShot(page: import("@playwright/test").Page, name: string) {
  const loc = page.locator('[data-testid="game-canvas"]');
  const box = await loc.boundingBox();
  if (!box) throw new Error("game-canvas missing");
  await page.screenshot({ path: path.join(OUT, name) });
  const clip = {
    x: Math.round(box.x + box.width * 0.08),
    y: Math.round(box.y + box.height * 0.42),
    width: Math.round(box.width * 0.28),
    height: Math.round(box.height * 0.22),
  };
  const buf = await page.screenshot({ clip });
  const stats = pngLit(buf);
  return stats;
}

function boxesOverlap(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width - 1 && a.x + a.width - 1 > b.x && a.y < b.y + b.height - 1 && a.y + a.height - 1 > b.y;
}

test("a) 10x levels 1-5 with combat, no black world, no NaN camera", async ({ page }) => {
  test.setTimeout(360_000);
  const camLogs = await boot(page);
  const nans: string[] = [];
  const black: string[] = [];
  for (let run = 1; run <= 10; run++) {
    for (let lv = 1; lv <= 5; lv++) {
      const prevGen = await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.bootGen);
      if (lv === 1) {
        await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.startBattle(1));
      } else {
        await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.nextLevel());
      }
      await waitLevel(page, lv, prevGen);
      await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.burstCombat());
      await page.waitForTimeout(280);
      const cam = await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.cam());
      if (cam.nan) nans.push(`run${run}-L${lv} ${JSON.stringify(cam)}`);
      const shot = await worldShot(page, `r${run}-l${lv}.png`);
      if (shot.mean < 8 || shot.max < 20) black.push(`run${run}-L${lv} lit=${shot.lit}/${shot.n} max=${shot.max} mean=${shot.mean.toFixed(1)}`);
      expect(cam.nan, `NaN camera on run ${run} level ${lv}`).toBe(false);
      expect(shot.max, `black world run ${run} level ${lv} max=${shot.max} mean=${shot.mean.toFixed(1)}`).toBeGreaterThan(20);
      expect(shot.mean, `black world run ${run} level ${lv} mean=${shot.mean.toFixed(1)}`).toBeGreaterThan(8);
    }
  }
  fs.writeFileSync(
    path.join(OUT, "loop.json"),
    JSON.stringify({ nans, black, camLogs: camLogs.slice(0, 80), ok: !nans.length && !black.length }, null, 2),
  );
  expect(nans, nans.join("\n")).toEqual([]);
  expect(black, black.join("\n")).toEqual([]);
});

test("b) WebGL context loss then restore redraws the world", async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page);
  const g0 = await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.bootGen);
  await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.startBattle(2));
  await waitLevel(page, 2, g0);
  const before = await worldShot(page, "gl-before.png");
  expect(before.max).toBeGreaterThan(20);
  expect(before.mean).toBeGreaterThan(8);
  await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.loseGl());
  await page.waitForTimeout(400);
  const g1 = await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.bootGen);
  await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.restoreGl());
  await page.waitForTimeout(400);
  await waitLevel(page, 2, g1);
  const after = await worldShot(page, "gl-after.png");
  expect(after.max).toBeGreaterThan(20);
  expect(after.mean).toBeGreaterThan(8);
  const cam = await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.cam());
  expect(cam.nan).toBe(false);
});

test("c) hotbar labels do not overlap at 1280 and 1920", async ({ page }) => {
  test.setTimeout(90_000);
  for (const width of [1280, 1920] as const) {
    await page.setViewportSize({ width, height: 720 });
    await boot(page);
    const g = await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.bootGen);
    await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.startBattle(1));
    await waitLevel(page, 1, g);
    const boxes = [];
    for (let i = 1; i <= 5; i++) {
      const box = await page.locator(`[data-testid="gun-slot-${i}"]`).boundingBox();
      expect(box, `slot ${i} at ${width}`).toBeTruthy();
      boxes.push(box!);
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(boxesOverlap(boxes[i]!, boxes[j]!), `slots ${i + 1} and ${j + 1} overlap at ${width}`).toBe(false);
      }
    }
    const labels = await page.locator('[data-testid="hotbar"] .hot-gun em').allTextContents();
    expect(labels.join(" ")).not.toMatch(/LOCKED LOCKED/i);
    expect(labels.every((t) => t.length <= 6)).toBe(true);
    await page.screenshot({ path: path.join(OUT, `hotbar-${width}.png`) });
  }
});
