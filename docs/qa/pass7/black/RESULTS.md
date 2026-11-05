# Pass 7 black-world bug — results

Playwright: `npx playwright test qa/pass7-black.spec.ts` — **3/3 passed** (1.3m).

Screenshots: this folder (`r{run}-l{level}.png`, `gl-before.png`, `gl-after.png`, `hotbar-1280.png`, `hotbar-1920.png`). Loop log: `loop.json`.

## Root cause

Phaser `scene.restart()` **reuses the same `ArenaScene` instance**. Class field initializers do not run again.

`aim` was never reset in `init()`. Recoil writes `cameras.main.scrollX/Y` from aim, and every frame does `setFollowOffset(-aim.x * 22, ...)`. If aim or scroll became NaN (bad `getWorldPoint`, hypot of a zero vector, leftover recoil), the camera matrix stayed NaN after the restart. WebGL then drew a black world while the React HUD, minimap, and wave counter kept updating.

The first restart is Level 1 → **Level 2 (Cog Flats)**, which matches the report. A 0.9 vignette on Cog Flats' dark clear-color (`0x1a2230`) also made a missing/stale floor look fully black.

Secondary issues that could produce the same symptom:

- Two anonymous `make.tilemap` calls were never destroyed; canvas tilesets were not refreshed after restart.
- Hit-stop paused physics with a delayed resume and no scene-alive / overlay check.
- Camera FX (`resetFX`, alpha) were never cleared on level start.
- No WebGL context-lost handling.

## Fixes

1. `init()` resets `aim`, recoil, combo, pause flags, and other sim fields.
2. `resetView()` on every level: `resetFX()`, alpha 1, zoom 1, bounds, follow the new player. Logs `[WB-CAM]` with scroll/zoom/player.
3. Finite clamps on aim, player position, scroll, zoom, and recoil.
4. Tilemaps destroyed and recreated with unique cache keys; canvas textures refreshed; fallback floor + `[WB-FLOOR]` warning if `arena-tiles` is missing.
5. Hit-stop uses a generation token and restores physics only if the scene is active and the overlay did not pause the sim.
6. Watchdog every 1s: alpha 0 / NaN scroll / player off-view → `resetView()` and `console.warn("[WB-WATCHDOG]", cause)`.
7. `webglcontextlost` (preventDefault) + restored: rebake pixel atlas and restart the arena.
8. Hotbar uses short names (Bolt / Shot / Rifle / GL / Coil) with ellipsis so labels stay inside each slot.

## Playwright (real)

| Test | Result |
| --- | --- |
| a) 10× levels 1→2→3→4→5 with burst combat (crits, elites, hit-stop) at each transition | **passed**. 50 screenshots. `loop.json`: `nans: []`, `black: []`. `[WB-CAM]` lines all `nan: false`. |
| b) WEBGL_lose_context then restore | **passed**. `gl-after.png` shows Cog Flats floor, hamster, HUD. |
| c) Hotbar slots at 1280 and 1920 | **passed**. No overlapping bounding boxes. No `LOCKED LOCKED`. |

Camera log sample (no NaN):

```
[WB-CAM] {tag: level-start, nan: false, scrollX: 192, scrollY: 153, zoom: 1}
[WB-CAM] {tag: nextLevel, nan: false, level: 2, theme: rust, ...}
[WB-CAM] {tag: level-start, nan: false, scrollX: 192, scrollY: 153, zoom: 1}  // Cog Flats
```

Level 2 screenshots (`r1-l2.png` … `r10-l2.png`) show the Cog Flats grid, not a black frame.

## Vitest / tsc

- `npx tsc --noEmit` clean
- `src/lib/__tests__/arena.test.ts` 17 passed (includes `viewGuard` NaN clamps)
