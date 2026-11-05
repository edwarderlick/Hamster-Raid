import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "docs", "qa");
fs.mkdirSync(OUT, { recursive: true });

type WB = {
  startBattle: (n: number) => void;
  gun: () => { rot: number; aimX: number; aimY: number; visible: boolean };
  nearestDist: () => number;
  setAim: (m: "mouse" | "auto" | "assist") => void;
  overlay: (o: string) => void;
  keepAlive: () => void;
};

async function boot(page: import("@playwright/test").Page, qa: string) {
  page.on("pageerror", (err) => {
    throw err;
  });
  await page.goto(`/?qa=${qa}`);
  await page.waitForSelector('[data-testid="hud-root"]', { timeout: 25000 });
  await page.waitForFunction(() => Boolean((window as unknown as { __WB?: WB }).__WB));
  await page.waitForTimeout(600);
}

test("gun follows mouse through a full circle", async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page, "arena");
  await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.setAim("mouse"));
  const box = await page.locator("canvas").first().boundingBox();
  expect(box).toBeTruthy();
  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;
  const rots: number[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    await page.mouse.move(cx + Math.cos(a) * 120, cy + Math.sin(a) * 90);
    await page.waitForTimeout(80);
    const g = await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.gun());
    rots.push(g.rot);
  }
  await page.screenshot({ path: path.join(OUT, "pass6-aim-circle.png") });
  const span = Math.max(...rots) - Math.min(...rots);
  expect(span).toBeGreaterThan(4);
  await page.keyboard.down("KeyD");
  await page.mouse.move(cx + 140, cy - 80);
  await page.waitForTimeout(400);
  await page.keyboard.up("KeyD");
  await page.screenshot({ path: path.join(OUT, "pass6-aim-moving.png") });
});

test("level 1 enemies close in within 8s while player is still", async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page, "battle");
  await page.waitForTimeout(500);
  const start = Date.now();
  await page.waitForFunction(
    () => {
      const wb = (window as unknown as { __WB?: WB }).__WB;
      return wb && wb.nearestDist() < 22;
    },
    null,
    { timeout: 12000 },
  );
  const ms = Date.now() - start;
  expect(ms).toBeLessThan(8000);
  await page.screenshot({ path: path.join(OUT, "pass6-l1-melee.png") });
  const until = Date.now() + 12000;
  while (Date.now() < until) {
    await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.keepAlive());
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: path.join(OUT, "pass6-l1-rush.png") });
  const d = await page.evaluate(() => (window as unknown as { __WB: WB }).__WB.nearestDist());
  expect(d).toBeLessThan(80);
});

test("no class select on landing or in game", async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => sessionStorage.setItem("hr-intro", "1"));
  await page.goto("/");
  await page.waitForSelector('[data-testid="landing-hero"]');
  await expect(page.locator("text=CHOOSE YOUR CLASS")).toHaveCount(0);
  await expect(page.locator('[data-testid="land-raider"]')).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "pass6-land-raider.png") });
  await boot(page, "arena");
  const name = await page.locator(".hud-name").innerText();
  expect(name).toMatch(/Pip Wheelrunner/);
});
