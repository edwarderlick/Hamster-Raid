import Phaser from "phaser";
import { useGame } from "./store";
import { logInput } from "./input";
import { capsFor, meter } from "./perf";

function poolOf<T>(scene: Phaser.Scene, key: string): T[] {
  let arr = scene.data.get(key) as T[] | undefined;
  if (!arr) {
    arr = [];
    scene.data.set(key, arr);
  }
  return arr;
}

function liveFx(s: Phaser.Scene) {
  return Number(s.data.get("fxLive") || 0);
}
function bumpFx(scene: Phaser.Scene, n: number) {
  scene.data.set("fxLive", Math.max(0, liveFx(scene) + n));
}

function fxCap(_scene?: Phaser.Scene) {
  return capsFor(useGame.getState().quality, meter.autoTier).particles;
}

export function shake(scene: Phaser.Scene, dur: number, mag: number) {
  const a = useGame.getState().a11y.shake;
  if (useGame.getState().reducedMotion || a <= 0) return;
  scene.cameras.main.shake(dur, mag * a);
}

export function hitStop(scene: Phaser.Scene, ms: number) {
  if (useGame.getState().reducedMotion) return;
  const world = scene.physics?.world;
  if (!world) return;
  const gen = Number(scene.data.get("hitStopGen") || 0) + 1;
  scene.data.set("hitStopGen", gen);
  scene.data.set("hitStop", true);
  if (!world.isPaused) world.pause();
  scene.time.delayedCall(ms, () => {
    try {
      if (Number(scene.data.get("hitStopGen")) !== gen) return;
      scene.data.set("hitStop", false);
      if (!scene.sys.isActive()) return;
      if (scene.data.get("simPaused")) return;
      if (world.isPaused) world.resume();
    } catch (err) {
      console.warn("[WB-HITSTOP] restore failed", err);
    }
  });
}

export function cancelHitStop(scene: Phaser.Scene) {
  scene.data.set("hitStopGen", Number(scene.data.get("hitStopGen") || 0) + 1);
  scene.data.set("hitStop", false);
  try {
    if (scene.sys.isActive() && scene.physics.world.isPaused && !scene.data.get("simPaused")) {
      scene.physics.world.resume();
    }
  } catch {
    /* scene already torn down */
  }
}

export function clearFxPools(scene: Phaser.Scene) {
  for (const key of ["pool-spark", "pool-shell", "pool-dmg"]) {
    const arr = scene.data.get(key) as { destroy?: () => void }[] | undefined;
    if (!Array.isArray(arr)) continue;
    for (const o of arr) {
      try {
        o.destroy?.();
      } catch {
        /* already gone */
      }
    }
    scene.data.set(key, []);
  }
  scene.data.set("fxLive", 0);
}

function grabRect(scene: Phaser.Scene, color: number) {
  const pool = poolOf<Phaser.GameObjects.Rectangle>(scene, "pool-spark");
  const d = pool.pop();
  if (d) {
    d.setActive(true).setVisible(true).setAlpha(1).setFillStyle(color, 1);
    return d;
  }
  return scene.add.rectangle(0, 0, 2, 2, color).setDepth(30);
}

function releaseRect(scene: Phaser.Scene, d: Phaser.GameObjects.Rectangle) {
  d.setActive(false).setVisible(false);
  poolOf<Phaser.GameObjects.Rectangle>(scene, "pool-spark").push(d);
  bumpFx(scene, -1);
}

export function sparks(scene: Phaser.Scene, x: number, y: number, color = 0xffcc66) {
  const cap = fxCap(scene);
  if (liveFx(scene) >= cap) return;
  const n = Math.min(6, Math.max(2, cap - liveFx(scene)));
  for (let i = 0; i < n; i++) {
    const d = grabRect(scene, color);
    d.setPosition(x, y).setDepth(30);
    bumpFx(scene, 1);
    scene.tweens.add({
      targets: d,
      x: x + (Math.random() - 0.5) * 18,
      y: y + (Math.random() - 0.5) * 14,
      alpha: 0,
      duration: 180 + Math.random() * 80,
      onComplete: () => releaseRect(scene, d),
    });
  }
}

export function trailDot(scene: Phaser.Scene, x: number, y: number, color: number) {
  if (liveFx(scene) >= fxCap(scene)) return;
  const d = grabRect(scene, color);
  d.setPosition(x, y).setDepth(14).setAlpha(0.85);
  bumpFx(scene, 1);
  scene.tweens.add({
    targets: d,
    alpha: 0,
    scale: 0.4,
    duration: 90,
    onComplete: () => releaseRect(scene, d),
  });
}

export function ejectCasing(scene: Phaser.Scene, x: number, y: number, aimX: number, aimY: number) {
  if (liveFx(scene) >= fxCap(scene)) return;
  const pool = poolOf<Phaser.GameObjects.Image>(scene, "pool-shell");
  const key = scene.textures.exists("shell") ? "shell" : "dust";
  const img = pool.pop() ?? scene.add.image(x, y, key).setDepth(14);
  img.setTexture(key).setActive(true).setVisible(true).setAlpha(1).setPosition(x, y).setAngle(0);
  bumpFx(scene, 1);
  scene.tweens.add({
    targets: img,
    x: x - aimY * 16 - aimX * 4 + (Math.random() - 0.5) * 6,
    y: y + 14,
    angle: 140 + Math.random() * 80,
    alpha: 0,
    duration: 320,
    onComplete: () => {
      img.setActive(false).setVisible(false);
      pool.push(img);
      bumpFx(scene, -1);
    },
  });
}

export function coinFly(scene: Phaser.Scene, x: number, y: number) {
  const c = scene.add.image(x, y, "coin").setDepth(40).setScale(1.4);
  scene.tweens.add({
    targets: c,
    x: scene.cameras.main.worldView.x + 40,
    y: scene.cameras.main.worldView.y + 24,
    duration: 420,
    ease: "Quad.easeIn",
    onComplete: () => c.destroy(),
  });
}

export function slashArc(scene: Phaser.Scene, x: number, y: number, facing: number, combo: number) {
  const key = scene.textures.exists(`slash-${combo}`) ? `slash-${combo}` : "slash";
  const img = scene.add.image(x, y, key).setDepth(12);
  img.setFlipX(facing === 1);
  img.setAngle(facing === 3 ? -90 : facing === 0 ? 90 : 0);
  img.setScale(1.4 + combo * 0.25);
  scene.tweens.add({ targets: img, alpha: 0, scale: 1.8, duration: 220, onComplete: () => img.destroy() });
  return img;
}

export function failAction(scene: Phaser.Scene, x: number, y: number, key: string, action: string, reason: string) {
  logInput({ key, action, ok: false, reason });
  useGame.getState().pushLog({ t: Date.now(), key, action, ok: false, reason });
  useGame.getState().setFail(reason);
  const t = scene.add
    .text(x, y - 20, reason, {
      fontFamily: '"Press Start 2P"',
      fontSize: "5px",
      color: "#e4453a",
      stroke: "#070b1a",
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setDepth(40);
  scene.tweens.add({ targets: t, y: y - 32, alpha: 0, duration: 700, onComplete: () => t.destroy() });
}

export function okAction(key: string, action: string) {
  logInput({ key, action, ok: true, reason: "" });
  useGame.getState().pushLog({ t: Date.now(), key, action, ok: true, reason: "" });
}

export function floatDmg(scene: Phaser.Scene, x: number, y: number, n: number, crit: boolean) {
  const pool = poolOf<Phaser.GameObjects.Text>(scene, "pool-dmg");
  const t =
    pool.pop() ??
    scene.add
      .text(x, y, "", {
        fontFamily: '"Press Start 2P"',
        fontSize: "8px",
        color: "#ffffff",
        stroke: "#070b1a",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(40);
  t.setText(crit ? `${n}!` : `${n}`);
  t.setStyle({ fontSize: crit ? "10px" : "8px", color: crit ? "#ffe14a" : "#ffffff" });
  t.setPosition(x, y).setAlpha(1).setScale(crit ? 1.25 : 1.05).setActive(true).setVisible(true);
  scene.tweens.add({
    targets: t,
    y: y - 20,
    alpha: 0,
    scale: crit ? 1.05 : 0.95,
    duration: 520,
    onComplete: () => {
      t.setActive(false).setVisible(false);
      pool.push(t);
    },
  });
}

export function fxLiveCount(scene: Phaser.Scene) {
  return liveFx(scene);
}
