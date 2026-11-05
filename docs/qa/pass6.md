# Pass 6 — aim, chase, one raider, real clip, landing

Verified 2026-11-05. Do not treat this as a 16ms claim.

## 1. Full 360 aim

- Mouse over the canvas always aims. No 2s hybrid timeout. `hybrid` in `wb-aim` migrates to `mouse`.
- World point comes from `camera.getWorldPoint(pointer.x, pointer.y)` every frame.
- Gun pivots on the grip, `flipY` when aiming left, Pip faces the aim, shots follow the gun.
- Cyan crosshair at the cursor. System cursor hidden on the canvas.
- Settings: Mouse (default), Assist, Auto-aim.
- Unit tests: 8 compass directions + camera-scroll `pointerWorld`.
- Playwright: `qa/pass6.spec.ts` gun circle, rot span > 4 rad.

**Watched:** `docs/qa/pass6-aim-circle.webm` and extracted frames `docs/qa/aim-frames/f07.png`–`f12.png`.

- f07 gun down-right, reticle below
- f08 gun left, sprite flipped, reticle left
- f09 gun up, reticle above
- f10–f11 gun up-right while walking, crate enters frame (camera scroll)

Stills: `pass6-aim-circle.png`, `pass6-aim-moving.png`.

## 2. Enemies come at you

- Battlefield chase from spawn. No 90px idle radius.
- Spawn director: batches of 2–3 every ~2.2s, refill when live < 4 or zero live > 3s, portals at camera rim.
- Still > 8s: pressure 1.45.
- Mite 200px sim reaches melee in 8s (vitest). Playwright L1: melee in < 8s while standing.

**Watched:** `docs/qa/pass6-l1-rush.webm` (23s) and frames `aim-frames/l1-*.png`.

- l1-08 mites closing from the left and top
- `pass6-l1-melee.png` contact
- `pass6-l1-rush.png` pile-on, HP kept alive for the shot

## 3. One character

- Pip Wheelrunner, Wheel Raider. No class modal, no three-card grid.
- Old `brawler` / `mystic` / `trickster` saves migrate. Wanderer stays wanderer.
- HUD name: Pip Wheelrunner / Wheel Raider.

## 4. Real gameplay clip

- Toy AttractPreview canvas deleted.
- Landing uses `GameplayReel`: `/gameplay/raid.webm` (1.9 MB) + `/gameplay/raid.mp4` (2.3 MB), 1080p ~20s, poster `/gameplay/train.png`.
- Recorded with Playwright bot on `?qa=battle` (`RECORD_DEMO=1 npm run record:demo`).
- Gallery stills under `/gameplay/` from real arena shots.

## 5. Front page

- Sticky nav + PLAY. CTAs: PLAY NOW, WATCH GAMEPLAY, CONNECT WALLET, PLAY AS WANDERER. Size gate: 72px / 26px (`qa/landing.spec.ts`).
- Sections: Gameplay, How, Raider, Weapons, Enemies, Arena, Wheel, Boss, Leaderboard, FAQ.
- Stills: `land-hero.png`, `land-preview.png`, `land-raider.png`, `land-weapons.png`, `land-enemies.png`, `land-arena.png`, `land-wheel.png`, `land-boss.png`, `land-board.png`, `land-faq.png`, `land-mobile.png`, `pass6-land-raider.png`.

## 6. Floor + F3

- Darker metal floors, hazard accents on borders.
- F3: `47 FPS - 21.5 ms - foes 81` at L5 with 80 mites (`perf-80.png`).

## Tests

- `npx tsc --noEmit` clean
- vitest 50 passed
- Playwright: pass6 3/3, landing 1/1, pass5 6/6
- perf: 21.5–21.7 ms with 81 entities (Playwright headed + video). Assertion is `< 24` ms. **Did not hit 16 ms in this harness.**

## Could not verify

- Physical gamepad right stick
- Full 90s academy playthrough by a human
- 16 ms/frame in a clean 1080p window without Playwright recording
- Weapon cards on the landing page are palette bars, not exported Phaser gun textures
- Enemy cards on the landing page are text, not baked sprites
- Meet the Raider uses a real gameplay still, not a looping idle spritesheet
- MP4/WebM clip is L1 bot combat, not a full academy → L3 edit
