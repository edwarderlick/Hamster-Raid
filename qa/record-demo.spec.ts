import { test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "public", "gameplay");
fs.mkdirSync(OUT, { recursive: true });
const QA = path.join(process.cwd(), "docs", "qa");
fs.mkdirSync(QA, { recursive: true });

test("record gameplay demo loop", async ({ page }) => {
  test.skip(!process.env.RECORD_DEMO, "set RECORD_DEMO=1 to capture the landing clip");
  test.setTimeout(120_000);
  await page.addInitScript(() => sessionStorage.setItem("hr-intro", "1"));
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/?qa=battle");
  await page.waitForSelector('[data-testid="hud-root"]', { timeout: 25000 });
  await page.waitForFunction(() => Boolean((window as unknown as { __WB?: { startBattle: (n: number) => void } }).__WB));
  await page.evaluate(() => (window as unknown as { __WB: { startBattle: (n: number) => void } }).__WB.startBattle(1));
  await page.waitForTimeout(1200);
  await page.waitForFunction(() => Boolean((window as unknown as { __WB?: { scene: unknown } }).__WB));
  await page.evaluate(() => {
    const wb = (window as unknown as { __WB: { scene: { drop: (id: string, x: number, y: number) => void; player: { x: number; y: number }; spawn: (k: string, t: number) => void } } }).__WB;
    wb.scene.drop("rapid", wb.scene.player.x + 28, wb.scene.player.y);
    wb.scene.drop("damage", wb.scene.player.x - 18, wb.scene.player.y + 16);
    for (let i = 0; i < 4; i++) wb.scene.spawn("mite", 0);
  });
  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  const cx = (box?.x ?? 0) + (box?.width ?? 800) / 2;
  const cy = (box?.y ?? 0) + (box?.height ?? 400) / 2;
  const t0 = Date.now();
  while (Date.now() - t0 < 16000) {
    const t = (Date.now() - t0) / 1000;
    await page.mouse.move(cx + Math.cos(t * 1.7) * 180, cy + Math.sin(t * 1.3) * 120);
    if (Math.floor(t * 5) % 2 === 0) await page.mouse.down();
    else await page.mouse.up();
    if (Math.floor(t) % 3 === 0) await page.keyboard.down("KeyD");
    else await page.keyboard.up("KeyD");
    if (Math.floor(t) % 4 === 1) await page.keyboard.down("KeyW");
    else await page.keyboard.up("KeyW");
    if (Math.floor(t) % 5 === 2) await page.keyboard.down("KeyA");
    else await page.keyboard.up("KeyA");
    if (Math.floor(t) === 4) await page.keyboard.press("KeyE");
    if (Math.floor(t) === 9) await page.keyboard.press("Digit3");
    if (Math.floor(t * 2) % 5 === 0) {
      await page.evaluate(() => (window as unknown as { __WB: { keepAlive: () => void } }).__WB.keepAlive());
    }
    await page.waitForTimeout(70);
  }
  await page.mouse.up();
  await page.keyboard.up("KeyD");
  await page.keyboard.up("KeyW");
  await page.keyboard.up("KeyA");
  await page.screenshot({ path: path.join(QA, "pass6-demo-still.png") });
  await page.screenshot({ path: path.join(OUT, "train.png") });
});
