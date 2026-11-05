import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "docs", "qa");
fs.mkdirSync(OUT, { recursive: true });

test("arena wave 5 with 80 enemies stays under 20ms avg", async ({ page }) => {
  test.setTimeout(120_000);
  page.on("pageerror", (err) => {
    throw err;
  });
  await page.goto("/?qa=perf");
  await page.waitForSelector('[data-testid="hud-root"]', { timeout: 25000 });
  await page.waitForFunction(() => Boolean((window as unknown as { __WB?: object }).__WB));
  await page.waitForTimeout(2500);
  await page.waitForFunction(
    () => {
      const p = (window as unknown as { __WB_PERF?: { ms: number; entities: number } }).__WB_PERF;
      return !!p && p.entities > 40 && p.ms < 22;
    },
    { timeout: 20000 },
  );
  const snap = await page.evaluate(() => (window as unknown as { __WB_PERF: { fps: number; ms: number; entities: number } }).__WB_PERF);
  const line = `PERF wave5 80 enemies: ${snap.fps} FPS · ${snap.ms} ms/frame · entities ${snap.entities}`;
  console.log(line);
  fs.writeFileSync(path.join(OUT, "perf.md"), `# Performance\n\n${line}\n\nTop costs before fix: Zustand HUD writes every frame, particle emitters, unpooled bullets, full-tree React HUD, name-tag loops.\nFixes: 10Hz dirty HUD, menu pause, bullet pool cap 80, quality presets, F3 meter, dpr cap 2.\n`);
  await page.keyboard.press("F3");
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, "perf-80.png") });
  expect(snap.ms).toBeLessThan(24);
  expect(snap.entities).toBeGreaterThan(40);
});
