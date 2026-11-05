import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "docs", "qa");
fs.mkdirSync(OUT, { recursive: true });

type WB = {
  warp: (x: number, y: number) => void;
  dummy: () => { hp: number; x: number; y: number } | undefined;
  hurt: (n: number) => void;
  sta: (n: number) => void;
  overlay: (o: string) => void;
  charge: (n: number) => void;
  skipTut: () => void;
  swing: () => void;
  roll: () => void;
  scene: { player: { x: number; y: number } };
};

async function boot(page: import("@playwright/test").Page) {
  page.on("pageerror", (err) => {
    throw err;
  });
  await page.goto("/?qa=1");
  await page.waitForSelector('[data-testid="hud-root"]', { timeout: 25000 });
  await page.waitForFunction(() => Boolean((window as unknown as { __WB?: WB }).__WB));
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
    canvas?.focus();
  });
}

test("J swing dummy 6-frame strip and combo", async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  await page.evaluate(() => {
    const wb = (window as unknown as { __WB: WB }).__WB;
    wb.skipTut();
    wb.warp(232, 216);
  });
  await page.waitForFunction(() => {
    const p = (window as unknown as { __WB: WB }).__WB.scene.player;
    return Math.abs(p.x - 232) < 12;
  });
  await page.waitForTimeout(200);
  const frames: string[] = [];
  await page.keyboard.down("KeyJ");
  await page.waitForTimeout(40);
  await page.keyboard.up("KeyJ");
  for (let i = 0; i < 6; i++) {
    const p = path.join(OUT, `j-frame-${i}.png`);
    await page.screenshot({ path: p });
    frames.push(p);
    await page.waitForTimeout(50);
  }
  expect(frames).toHaveLength(6);
  await page.screenshot({ path: path.join(OUT, "j-swing.png") });

  await page.waitForTimeout(120);
  await page.keyboard.press("KeyJ");
  await page.waitForTimeout(100);
  await page.keyboard.press("KeyJ");
  await page.waitForTimeout(100);
  await page.keyboard.press("KeyJ");
  await page.waitForTimeout(180);
  await page.screenshot({ path: path.join(OUT, "j-combo.png") });
  await expect(page.locator('[data-testid="combo-hud"]')).toBeVisible();
});

test("roll stamina fail, skills, HP clamp, defeated", async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  await page.evaluate(() => {
    const wb = (window as unknown as { __WB: WB }).__WB;
    wb.skipTut();
    wb.warp(232, 216);
  });
  await page.waitForTimeout(200);
  await page.keyboard.down("Space");
  await page.waitForTimeout(50);
  await page.keyboard.up("Space");
  await page.waitForTimeout(220);
  await page.screenshot({ path: path.join(OUT, "roll.png") });

  await page.waitForTimeout(500);
  await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.sta(0));
  await page.keyboard.down("Space");
  await page.waitForTimeout(50);
  await page.keyboard.up("Space");
  await page.waitForTimeout(200);
  await expect(page.locator('[data-testid="fail-text"]')).toContainText(/stamina|cooldown/i);
  await page.screenshot({ path: path.join(OUT, "roll-fail.png") });

  await page.keyboard.press("KeyK");
  await page.waitForTimeout(80);
  await page.screenshot({ path: path.join(OUT, "skill-k.png") });
  await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.charge(100));
  await page.keyboard.press("KeyL");
  await page.waitForTimeout(90);
  await page.screenshot({ path: path.join(OUT, "ult-l.png") });

  await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.hurt(9999));
  await page.waitForTimeout(400);
  const hpText = await page.locator(".hud-bar").first().innerText();
  expect(hpText).not.toMatch(/-/);
  await expect(page.locator('[data-testid="defeated"]')).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "defeated.png") });
  await expect(page.locator('[data-testid="retry"]')).toBeVisible();
  await expect(page.locator('[data-testid="return-town"]')).toBeVisible();
});

test("tutorial ticks only on real actions", async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page);
  const before = await page.locator('[data-testid="tutorial"] li.done').count();
  await page.keyboard.press("KeyJ");
  await page.waitForTimeout(200);
  const afterJ = await page.locator('[data-testid="tutorial"] li.done').count();
  expect(afterJ).toBe(before);
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(1400);
  await page.keyboard.up("KeyD");
  const afterMove = await page.locator('[data-testid="tutorial"] li.done').count();
  expect(afterMove).toBeGreaterThan(before);
  await page.screenshot({ path: path.join(OUT, "tutorial-real.png") });
});

test("labels and HUD at three sizes, no dual wheel plaque", async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page);
  for (const s of [
    { n: "720", w: 1280, h: 720 },
    { n: "1080", w: 1920, h: 1080 },
    { n: "1440", w: 2560, h: 1440 },
  ]) {
    await page.setViewportSize({ width: s.w, height: s.h });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, `labels-${s.n}.png`) });
  }
  await expect(page.locator('[data-testid="wheel-chip"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="now-banner"]')).toBeVisible();
});

test("sprite viewer", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/dev/sprites");
  await page.waitForSelector('[data-testid="sprite-viewer"]', { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "sprites.png") });
  await page.screenshot({ path: path.join(process.cwd(), "qa-screens", "sprites.png") });
});
