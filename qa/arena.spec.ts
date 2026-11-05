import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "docs", "qa");
fs.mkdirSync(OUT, { recursive: true });

type WB = {
  startBattle: (n: number) => void;
  killAll: () => void;
  hurt: (n: number) => void;
  overlay: (o: string) => void;
  spawnN: (n: number) => void;
  scene: { player: { x: number; y: number }; mode: string };
};

async function boot(page: import("@playwright/test").Page, qa: string) {
  page.on("pageerror", (err) => {
    throw err;
  });
  await page.goto(`/?qa=${qa}`);
  await page.waitForSelector('[data-testid="hud-root"]', { timeout: 25000 });
  await page.waitForFunction(() => Boolean((window as unknown as { __WB?: WB }).__WB));
  await page.waitForTimeout(500);
  await page.evaluate(() => (document.querySelector("canvas") as HTMLCanvasElement | null)?.focus());
}

test("training arena to battlefield and screens", async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page, "arena");
  await page.screenshot({ path: path.join(OUT, "arena-train.png") });
  await expect(page.locator('[data-testid="arena-banner"]')).toBeVisible();

  await page.keyboard.down("KeyD");
  await page.waitForTimeout(400);
  await page.keyboard.up("KeyD");
  await page.mouse.move(900, 400);
  await page.keyboard.press("KeyJ");
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(OUT, "arena-shoot.png") });

  await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.startBattle(1));
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, "arena-l1.png") });

  await page.keyboard.press("Digit2");
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, "arena-swap.png") });

  await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.startBattle(3));
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, "arena-l3.png") });

  await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.startBattle(5));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "arena-l5.png") });
  await page.screenshot({ path: path.join(OUT, "arena-boss.png") });

  await page.evaluate(() => {
    const wb = window as unknown as { __WB: WB & { win?: () => void; overlay: (o: string) => void } };
    wb.__WB.killAll();
    wb.__WB.overlay("victory");
  });
  await page.waitForTimeout(400);
  await expect(page.locator('[data-testid="victory"]')).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "arena-victory.png") });
});

test("game over retry", async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page, "battle");
  await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.hurt(999));
  await page.waitForTimeout(400);
  await expect(page.locator('[data-testid="gameover"]')).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "arena-gameover.png") });
});

test("inventory grid and fps meter", async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page, "arena");
  await page.keyboard.press("KeyI");
  await page.waitForTimeout(300);
  await expect(page.locator('[data-testid="overlay-inventory"]')).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "arena-inventory.png") });
  await page.keyboard.press("Escape");
  await page.keyboard.press("F3");
  await page.waitForTimeout(300);
  await expect(page.locator('[data-testid="fps-meter"]')).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "arena-fps.png") });
});
