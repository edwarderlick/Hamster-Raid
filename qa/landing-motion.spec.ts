import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "docs", "qa");
fs.mkdirSync(OUT, { recursive: true });

function angleFromMatrix(t: string) {
  const m = t.match(/matrix\(([^)]+)\)/);
  if (!m) return 0;
  const p = m[1].split(",").map((n) => parseFloat(n.trim()));
  return Math.atan2(p[1] ?? 0, p[0] ?? 1);
}

test.use({ video: "off" });

test("landing looping motion acceptance", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.addInitScript(() => sessionStorage.setItem("hr-intro", "1"));
  await page.setViewportSize({ width: 1920, height: 1080 });
  const measureFps = () =>
    page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let n = 0;
          const t0 = performance.now();
          const tick = (t: number) => {
            n += 1;
            if (t - t0 >= 1000) resolve(n / ((t - t0) / 1000));
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
    );
  await page.goto("/");
  await page.waitForSelector('[data-testid="hero-wheel"]', { timeout: 20000 });
  await page.waitForTimeout(200);

  await page.evaluate(() => {
    document.querySelectorAll("video").forEach((v) => {
      v.pause();
      v.removeAttribute("autoplay");
    });
  });
  const fpsMotion = await measureFps();
  await page.evaluate(() => {
    document.querySelectorAll("video").forEach((v) => void v.play().catch(() => undefined));
  });
  const fpsWithVideo = await measureFps();
  fs.writeFileSync(path.join(OUT, "motion-fps.json"), JSON.stringify({ fpsMotion, fpsWithVideo, errors }, null, 2));
  expect(fpsMotion).toBeGreaterThan(10);

  const a0 = await page.locator('[data-testid="hero-wheel"]').evaluate((el) => getComputedStyle(el).transform);
  await page.screenshot({ path: path.join(OUT, "motion-wheel-0.png") });
  await page.waitForTimeout(900);
  const a1 = await page.locator('[data-testid="hero-wheel"]').evaluate((el) => getComputedStyle(el).transform);
  await page.screenshot({ path: path.join(OUT, "motion-wheel-1.png") });
  await page.waitForTimeout(900);
  const a2 = await page.locator('[data-testid="hero-wheel"]').evaluate((el) => getComputedStyle(el).transform);
  await page.screenshot({ path: path.join(OUT, "motion-wheel-2.png") });

  const deg = [a0, a1, a2].map(angleFromMatrix);
  expect(Math.abs(deg[1] - deg[0])).toBeGreaterThan(0.01);
  expect(Math.abs(deg[2] - deg[1])).toBeGreaterThan(0.01);
  fs.writeFileSync(path.join(OUT, "motion-wheel-angles.json"), JSON.stringify({ transforms: [a0, a1, a2], deg }, null, 2));

  const clip = page.locator('[data-testid="gameplay-clip"]').first();
  await expect(clip).toBeVisible();
  const videoStats = await clip.evaluate((el) => {
    const v = el as HTMLVideoElement;
    return { paused: v.paused, t: v.currentTime, dur: v.duration || 0, tag: v.tagName };
  });
  if (videoStats.tag === "VIDEO") {
    await page.waitForFunction(() => {
      const v = document.querySelector('[data-testid="gameplay-clip"]') as HTMLVideoElement | null;
      return Boolean(v && !v.paused && v.currentTime > 0.2);
    }, null, { timeout: 8000 });
    const tA = await clip.evaluate((el) => (el as HTMLVideoElement).currentTime);
    await page.waitForTimeout(1200);
    const tB = await clip.evaluate((el) => (el as HTMLVideoElement).currentTime);
    expect(tB).toBeGreaterThan(tA);
    const looped = await clip.evaluate(async (el) => {
      const v = el as HTMLVideoElement;
      if (!v.duration || !Number.isFinite(v.duration) || v.duration < 2) return v.loop;
      v.currentTime = Math.max(0, v.duration - 0.15);
      await new Promise((r) => setTimeout(r, 500));
      return v.loop && !v.paused;
    });
    expect(looped).toBeTruthy();
  }

  async function row(w: number, h: number, name: string) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);
    const boxes = await page.evaluate(() =>
      ["enter-raid", "watch-gameplay", "connect-wallet"].map((id) => {
        const r = (document.querySelector(`[data-testid="${id}"]`) as HTMLElement).getBoundingClientRect();
        return { id, x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
      }),
    );
    await page.screenshot({ path: path.join(OUT, `motion-cta-${name}.png`) });
    expect(Math.abs(boxes[0]!.y - boxes[1]!.y)).toBeLessThan(6);
    expect(Math.abs(boxes[1]!.y - boxes[2]!.y)).toBeLessThan(6);
    expect(boxes[0]!.x).toBeLessThan(boxes[1]!.x);
    expect(boxes[1]!.x).toBeLessThan(boxes[2]!.x);
    for (const b of boxes) {
      expect(b.right).toBeLessThanOrEqual(w + 2);
      expect(b.x).toBeGreaterThanOrEqual(-2);
      expect(b.bottom).toBeLessThanOrEqual(h + 8);
    }
    return boxes;
  }

  const row1280 = await row(1280, 720, "1280");
  const row390 = await row(390, 844, "390");
  fs.writeFileSync(path.join(OUT, "motion-cta-rows.json"), JSON.stringify({ row1280, row390 }, null, 2));

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);

  await page.locator('[data-testid="enter-raid"]').click();
  await page.waitForSelector('[data-testid="hud-root"]', { timeout: 25000 });
  await page.screenshot({ path: path.join(OUT, "motion-play-now.png") });

  const filtered = errors.filter((e) => !/Failed to load resource|net::ERR|sessionStorage/i.test(e));
  expect(filtered).toEqual([]);
});
