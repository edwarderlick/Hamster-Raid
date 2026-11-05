import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "qa-screens");
fs.mkdirSync(OUT, { recursive: true });

const SIZES = [
  { name: "720", w: 1280, h: 720 },
  { name: "1080", w: 1920, h: 1080 },
  { name: "1440", w: 2560, h: 1440 },
  { name: "ultrawide", w: 2560, h: 1080 },
  { name: "43", w: 1440, h: 1080 },
  { name: "mobile", w: 390, h: 844 },
] as const;

test("wheelbound visual pass", async ({ page }) => {
  test.setTimeout(180_000);
  page.on("pageerror", (err) => {
    throw err;
  });
  await page.goto("/?qa=1");
  await page.waitForSelector('[data-testid="hud-root"]', { timeout: 25000 });
  await page.waitForTimeout(1200);

  for (const s of SIZES) {
    await page.setViewportSize({ width: s.w, height: s.h });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, `haven-${s.name}.png`) });
  }

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.keyboard.down("D");
  await page.waitForTimeout(800);
  await page.keyboard.up("D");
  await page.keyboard.down("W");
  await page.waitForTimeout(500);
  await page.keyboard.up("W");
  await page.keyboard.press("KeyJ");
  await page.waitForTimeout(200);
  await page.keyboard.press("Space");
  await page.screenshot({ path: path.join(OUT, "haven-move.png") });

  await page.keyboard.press("KeyI");
  await page.waitForTimeout(300);
  await expect(page.locator('[data-testid="overlay-inventory"]')).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "menu-inventory.png") });
  await page.keyboard.press("Escape");

  await page.evaluate(() => (window as unknown as { __WB: { overlay: (o: string) => void } }).__WB.overlay("skills"));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, "menu-skills.png") });
  await page.evaluate(() => (window as unknown as { __WB: { overlay: (o: string) => void } }).__WB.overlay("pause"));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, "menu-pause.png") });
  await page.evaluate(() => (window as unknown as { __WB: { overlay: (o: string) => void } }).__WB.overlay("help"));
  await page.waitForTimeout(200);
  await expect(page.locator('[data-testid="overlay-help"]')).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "menu-help.png") });
  await page.evaluate(() => (window as unknown as { __WB: { overlay: (o: string) => void } }).__WB.overlay("journal"));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, "menu-journal.png") });
  await page.evaluate(() => (window as unknown as { __WB: { overlay: (o: string) => void } }).__WB.overlay("none"));
  await expect(page.locator('[data-testid="now-banner"]')).toBeVisible();
  await expect(page.locator('[data-testid="wheel-chip"]')).toBeVisible();

  const stage = page.locator('[data-testid="game-stage"]');
  const box = await stage.boundingBox();
  expect(box?.width).toBeGreaterThan(1200);
  expect(box?.height).toBeGreaterThan(680);

  for (const zone of ["forest", "mines", "foundry"] as const) {
    await page.evaluate((z) => (window as unknown as { __WB: { zone: (id: string) => void } }).__WB.zone(z), zone);
    await page.waitForFunction(() => Boolean((window as unknown as { __WB?: { zone: (id: string) => void } }).__WB));
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT, `${zone}-720.png`) });
  }

  await page.evaluate(() => (window as unknown as { __WB: { zone: (id: string) => void } }).__WB.zone("haven"));
  await page.waitForTimeout(400);
});

test("combat video", async ({ page }) => {
  await page.goto("/?qa=1");
  await page.waitForSelector('[data-testid="hud-root"]', { timeout: 25000 });
  await page.waitForFunction(() => Boolean((window as unknown as { __WB?: { zone: (id: string) => void } }).__WB));
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => (window as unknown as { __WB: { zone: (id: string) => void } }).__WB.zone("forest"));
  await page.waitForTimeout(600);
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("KeyJ");
    await page.keyboard.down("D");
    await page.waitForTimeout(180);
    await page.keyboard.up("D");
    await page.keyboard.press("Space");
    await page.waitForTimeout(120);
  }
  await page.screenshot({ path: path.join(OUT, "combat-forest.png") });
});
