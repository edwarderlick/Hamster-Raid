import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "docs", "qa");
fs.mkdirSync(OUT, { recursive: true });

test("landing cinematic sizes and sections", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => sessionStorage.setItem("hr-intro", "1"));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await page.waitForSelector('[data-testid="landing-hero"]', { timeout: 20000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, "land-hero.png") });

  const sizes = await page.evaluate(() => {
    const h = document.querySelector('[data-testid="land-headline"]') as HTMLElement;
    const logo = document.querySelector('[data-testid="land-logo"]') as HTMLImageElement;
    const btn = document.querySelector('[data-testid="enter-raid"]') as HTMLElement;
    const body = document.querySelector(".land-body") as HTMLElement;
    const cs = (el: HTMLElement, prop: string) => parseFloat(getComputedStyle(el).getPropertyValue(prop));
    return {
      headline: cs(h, "font-size"),
      btnH: btn.getBoundingClientRect().height,
      btnFont: cs(btn, "font-size"),
      body: cs(body, "font-size"),
      logo: logo.getBoundingClientRect().height,
    };
  });
  expect(sizes.headline).toBeGreaterThanOrEqual(56);
  expect(sizes.btnH).toBeGreaterThanOrEqual(72);
  expect(sizes.btnFont).toBeGreaterThanOrEqual(26);
  expect(sizes.body).toBeGreaterThanOrEqual(20);
  expect(sizes.logo).toBeGreaterThanOrEqual(220);

  await expect(page.locator('[data-testid="gameplay-clip"]').first()).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "land-preview.png") });

  await expect(page.locator("text=CHOOSE YOUR CLASS")).toHaveCount(0);
  await expect(page.locator('[data-testid="gameplay-clip"]').first()).toBeVisible();
  for (const id of ["land-how", "land-raider", "land-weapons", "land-enemies", "land-arena", "land-wheel", "land-boss", "land-board", "land-faq"]) {
    await page.locator(`[data-testid="${id}"]`).scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT, `${id}.png`) });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "land-mobile.png") });
});
