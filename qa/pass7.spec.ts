import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "docs", "qa", "pass7");
fs.mkdirSync(OUT, { recursive: true });

type WB = {
  skipTrain: () => void;
  confirmSkip: () => void;
  startBattle: (n: number) => void;
  spawnMix: (n: number) => void;
  spawnN: (n: number) => void;
  setAim: (m: "mouse" | "auto" | "assist") => void;
  overlay: (o: string) => void;
  face: () => { flipX: boolean; gunFlipY: boolean; gunRot: number; dir8: number; facing: number };
  gun: () => { rot: number; flipY: boolean; visible: boolean };
  scene: { mode: string; level: number; wave: number };
};

async function boot(page: import("@playwright/test").Page, qa = "arena") {
  const errors: string[] = [];
  page.on("pageerror", (err) => {
    errors.push(String(err));
    throw err;
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.goto(`/?qa=${qa}`);
  await page.waitForSelector('[data-testid="hud-root"]', { timeout: 25000 });
  await page.waitForFunction(() => Boolean((window as unknown as { __WB?: WB }).__WB));
  await page.waitForTimeout(700);
  return errors;
}

test("a) skip training highlight, callout, confirm, Tab/N, lands in L1 W1", async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page, "arena");
  const btn = page.locator('[data-testid="skip-train"]');
  await expect(btn).toBeVisible();
  const box = await btn.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(160);
  expect(box?.height ?? 0).toBeGreaterThan(28);
  await expect(btn).toContainText(/SKIP TRAINING/i);
  await expect(btn).toContainText(/Tab/i);
  await expect(page.locator('[data-testid="skip-callout"]')).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "skip-entry.png") });

  await page.click('[data-testid="skip-train"]');
  await expect(page.locator('[data-testid="overlay-skip"]')).toBeVisible();
  await expect(page.locator('[data-testid="skip-confirm"]')).toBeVisible();
  await expect(page.locator('[data-testid="skip-keep"]')).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "skip-modal.png") });
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="overlay-skip"]')).toHaveCount(0);

  await page.keyboard.press("Tab");
  await expect(page.locator('[data-testid="overlay-skip"]')).toBeVisible();
  await page.click('[data-testid="skip-keep"]');

  await page.keyboard.press("KeyN");
  await expect(page.locator('[data-testid="overlay-skip"]')).toBeVisible();
  await page.click('[data-testid="skip-confirm"]');
  await page.waitForTimeout(1000);
  const mode = await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.scene.mode);
  expect(mode).toBe("battle");
  await expect(page.locator('[data-testid="arena-banner"]')).toContainText(/WAVE 1/i);
  await page.screenshot({ path: path.join(OUT, "skip-level1.png") });

  await page.goto("/?qa=arena");
  await page.waitForSelector('[data-testid="skip-train"]', { timeout: 25000 });
  await expect(page.locator('[data-testid="skip-train"]')).toContainText(/done before/i);
  await expect(page.locator('[data-testid="skip-callout"]')).toHaveCount(0);
  await page.screenshot({ path: path.join(OUT, "skip-done-before.png") });
});

test("b) mid-fight readability: hero, 3 enemy types, bullets, muzzle, numbers, floor, HUD", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await boot(page, "arena");
  await page.evaluate(() => {
    const wb = (window as unknown as { __WB: WB }).__WB;
    wb.startBattle(1);
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.spawnMix(18));
  await page.waitForTimeout(500);
  await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.setAim("mouse"));
  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;
  await page.mouse.move(cx + 90, cy - 10);
  await page.mouse.down();
  await page.waitForTimeout(280);
  await page.screenshot({ path: path.join(OUT, "mid-fight.png") });
  await page.mouse.up();

  await expect(page.locator('[data-testid="radar-legend"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="gun-slot-1"]')).toBeVisible();
  await expect(page.locator('[data-testid="hotbar"]')).toBeVisible();
  const slot = await page.locator('[data-testid="gun-slot-1"]').boundingBox();
  expect(slot?.height ?? 0).toBeGreaterThan(36);
  await page.screenshot({ path: path.join(OUT, "hud-hotbar.png") });

  await page.keyboard.press("F1");
  await expect(page.locator('[data-testid="radar-legend"]')).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "help-legend.png") });
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});

test("c) 8-direction aim faces the cursor", async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page, "arena");
  await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.setAim("mouse"));
  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;
  await page.mouse.move(cx + 40, cy);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(80);
  const dirs = [
    ["E", 1, 0],
    ["SE", 1, 1],
    ["S", 0, 1],
    ["SW", -1, 1],
    ["W", -1, 0],
    ["NW", -1, -1],
    ["N", 0, -1],
    ["NE", 1, -1],
  ] as const;
  const faces: number[] = [];
  for (const [name, x, y] of dirs) {
    await page.mouse.move(cx + x * 70, cy + y * 50);
    await page.waitForTimeout(150);
    const f = await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.face());
    faces.push(f.dir8);
    await page.screenshot({ path: path.join(OUT, `aim-${name}.png`) });
    if (x < 0) expect(f.gunFlipY, name).toBe(true);
    if (x > 0) expect(f.gunFlipY, name).toBe(false);
    if (x < 0) expect(f.flipX, name).toBe(true);
    if (x > 0) expect(f.flipX, name).toBe(false);
  }
  expect(new Set(faces).size).toBeGreaterThanOrEqual(6);
});

test("d) 40-enemy FPS and no console errors", async ({ page }) => {
  test.setTimeout(90_000);
  const errors = await boot(page, "perf");
  await page.evaluate(() => {
    const wb = window as unknown as { __WB: WB };
    wb.__WB.startBattle(1);
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.spawnN(40));
  await page.waitForTimeout(1800);
  const snap = await page.evaluate(() => (window as unknown as { __WB_PERF?: { fps: number; entities: number } }).__WB_PERF);
  const report = [
    `# Pass 7 FPS`,
    ``,
    `- fps: ${snap?.fps ?? "n/a"}`,
    `- entities: ${snap?.entities ?? "n/a"}`,
    `- viewport: 1080p target, Playwright Chromium`,
    `- console errors: ${errors.length}`,
  ].join("\n");
  fs.writeFileSync(path.join(OUT, "fps.md"), report);
  expect(snap?.entities ?? 0).toBeGreaterThanOrEqual(20);
  expect(snap?.fps ?? 0).toBeGreaterThan(10);
  expect(errors).toEqual([]);
  await page.screenshot({ path: path.join(OUT, "fps-40.png") });
});
