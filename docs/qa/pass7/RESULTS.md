# Pass 7 acceptance

Playwright `qa/pass7.spec.ts` + updated `qa/pass5.spec.ts`: **10/10 passed**.
Vitest: **56/56 passed**. `tsc --noEmit`: clean. Console errors: **0**.

## Skip training
- Button visible top-right on academy entry, orange, Tab/N on the label (`skip-entry.png`).
- 4s callout: “New here? Do the drills…”
- Confirm modal: Skip to Level 1 (orange) / Keep Training; Esc closes (`skip-modal.png`).
- Confirm lands in Level 1 Wave 1 (`skip-level1.png`).
- Later visit: “Skip (done before)”, no callout (`skip-done-before.png`).

## Combat readability
- Mid-fight 15+ foes (`mid-fight.png`): orange hero vs rust-red cog-mites / rust rats / cyan-back beetles / brutes. White muzzle/hit flash. Wave banner `WAVE 1/3 — 22 LEFT`. Score `x2`.
- Floor is navy plate with seams; no blue streaks. Crates/barrels on the rim.
- Minimap legend removed from HUD; lives in F1 help (`help-legend.png`).
- Weapon slots 1–5 in the hotbar with ammo and lock icons (`hud-hotbar.png`).

## Aim
- 8 compass shots `aim-E.png` … `aim-NE.png`. Gun FlipY and body FlipX follow the cursor.

## FPS
Playwright Chromium, `?qa=perf` then 40 extra spawns (81 entities on screen):

- Run A: **59 fps**
- Run B: **44 fps**

Headless GPU Chrome, not a 1080p windowed game client. No console errors (`fps.md`, `fps-40.png`).
