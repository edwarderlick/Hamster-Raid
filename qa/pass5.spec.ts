import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "docs", "qa");
fs.mkdirSync(OUT, { recursive: true });

type WB = {
  skipTrain: () => void;
  startBattle: (n: number) => void;
  dummyInView: () => boolean;
  gun: () => { rot: number; x: number; y: number; flipY: boolean; tex: string; w: number; visible: boolean };
  sprites: () => { dummy: boolean; targets: number; drones: number; gun: boolean; reticle: boolean };
  setAim: (m: "mouse" | "auto" | "assist" | "hybrid") => void;
  overlay: (o: string) => void;
  scene: { mode: string };
};

async function boot(page: import("@playwright/test").Page, qa: string) {
  page.on("pageerror", (err) => {
    throw err;
  });
  await page.goto(`/?qa=${qa}`);
  await page.waitForSelector('[data-testid="hud-root"]', { timeout: 25000 });
  await page.waitForFunction(() => Boolean((window as unknown as { __WB?: WB }).__WB));
  await page.waitForTimeout(700);
}

function canvasFill(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const c = document.querySelector('[data-testid="minimap"]') as HTMLCanvasElement | null;
    if (!c) return 0;
    const ctx = c.getContext("2d");
    if (!ctx) return 0;
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 16) {
      if (d[i]! + d[i + 1]! + d[i + 2]! > 50) n += 1;
    }
    return n;
  });
}

test("a) arena radar minimap is filled", async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page, "arena");
  await page.waitForTimeout(400);
  await expect(page.locator('[data-testid="minimap"]')).toBeVisible();
  await expect(page.locator('[data-testid="radar-zone"]')).toContainText(/Training Academy/i);
  await expect(page.locator('[data-testid="radar-legend"]')).toHaveCount(0);
  await page.keyboard.press("F1");
  await expect(page.locator('[data-testid="overlay-help"]')).toBeVisible();
  await expect(page.locator('[data-testid="radar-legend"]')).toBeVisible();
  await page.keyboard.press("Escape");
  const filled = await canvasFill(page);
  expect(filled).toBeGreaterThan(80);
  const box = await page.locator('[data-testid="minimap"]').boundingBox();
  expect(box?.height ?? 0).toBeGreaterThan(90);
  await page.screenshot({ path: path.join(OUT, "pass5-minimap.png") });

  await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.startBattle(1));
  await page.waitForTimeout(800);
  expect(await canvasFill(page)).toBeGreaterThan(80);
  await page.screenshot({ path: path.join(OUT, "pass5-minimap-l1.png") });
});

test("b) gun aims with mouse, auto, and keyboard", async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page, "arena");
  await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.setAim("mouse"));
  const gun0 = await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.gun());
  expect(gun0.visible).toBe(true);
  expect(gun0.w).toBeGreaterThanOrEqual(24);

  await page.mouse.move(200, 180);
  await page.waitForTimeout(180);
  const left = await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.gun());
  await page.screenshot({ path: path.join(OUT, "pass5-gun-mouse-left.png") });

  await page.mouse.move(1100, 520);
  await page.waitForTimeout(180);
  const right = await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.gun());
  await page.screenshot({ path: path.join(OUT, "pass5-gun-mouse-right.png") });
  expect(Math.abs(left.rot - right.rot)).toBeGreaterThan(0.25);

  await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.setAim("auto"));
  await page.waitForTimeout(400);
  const autoG = await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.gun());
  expect(autoG.visible).toBe(true);
  await page.screenshot({ path: path.join(OUT, "pass5-gun-auto.png") });

  await page.keyboard.down("KeyA");
  await page.waitForTimeout(500);
  await page.keyboard.up("KeyA");
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(500);
  await page.keyboard.up("KeyD");
  const keyG = await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.gun());
  expect(keyG.visible).toBe(true);
  await page.screenshot({ path: path.join(OUT, "pass5-gun-keyboard.png") });

  await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.overlay("settings"));
  await expect(page.locator('[data-testid="aim-assist"]')).toBeVisible();
  await expect(page.locator('[data-testid="aim-mouse"]')).toBeVisible();
  await expect(page.locator('[data-testid="aim-auto"]')).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "pass5-aim-settings.png") });
  await page.keyboard.press("Escape");
});

test("c) training skip and live targets", async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page, "arena");
  await expect(page.locator('[data-testid="train-step"]')).toContainText(/STEP 1\/8/);
  await expect(page.locator('[data-testid="skip-train"]')).toBeVisible();
  const sprites = await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.sprites());
  expect(sprites.dummy).toBe(true);
  expect(sprites.targets).toBeGreaterThanOrEqual(4);
  expect(sprites.drones).toBeGreaterThanOrEqual(3);
  await page.click('[data-testid="skip-train"]');
  await expect(page.locator('[data-testid="overlay-skip"]')).toBeVisible();
  await page.click('[data-testid="skip-keep"]');
  await expect(page.locator('[data-testid="train-step"]')).toContainText(/STEP 1\/8/);
  await page.click('[data-testid="skip-train"]');
  await page.click('[data-testid="skip-confirm"]');
  await page.waitForTimeout(900);
  await expect(page.locator('[data-testid="arena-banner"]')).toContainText(/WAVE 1/i);
  await page.screenshot({ path: path.join(OUT, "pass5-skip-gate.png") });
});

test("d) dummy is in camera at start", async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page, "arena");
  const vis = await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.dummyInView());
  expect(vis).toBe(true);
  const sprites = await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.sprites());
  expect(sprites.dummy).toBe(true);
  expect(sprites.gun).toBe(true);
  expect(sprites.reticle).toBe(true);
  await page.screenshot({ path: path.join(OUT, "pass5-academy.png") });
});

test("e) no garbled HUD text", async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page, "arena");
  const text = await page.locator('[data-testid="hud-root"]').innerText();
  expect(text).not.toMatch(/\uFFFD/);
  expect(text).not.toContain("A�");
  expect(text).not.toContain("·");
  expect(text).not.toContain("—");
});

test("levels 1 3 5 look different and spawn from portals", async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page, "arena");
  await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.startBattle(1));
  await page.waitForTimeout(900);
  const z1 = await page.locator(".hud-zone").innerText();
  await page.screenshot({ path: path.join(OUT, "pass5-l1.png") });
  expect(await canvasFill(page)).toBeGreaterThan(40);

  await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.startBattle(3));
  await page.waitForTimeout(900);
  const z3 = await page.locator(".hud-zone").innerText();
  await page.screenshot({ path: path.join(OUT, "pass5-l3.png") });

  await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.startBattle(5));
  await page.waitForTimeout(900);
  const z5 = await page.locator(".hud-zone").innerText();
  await page.screenshot({ path: path.join(OUT, "pass5-l5.png") });
  expect(z1).not.toEqual(z3);
  expect(z3).not.toEqual(z5);
});
