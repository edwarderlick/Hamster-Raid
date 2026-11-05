import Phaser from "phaser";
import { BootScene } from "./BootScene";
import { WorldScene } from "./WorldScene";
import { ArenaScene } from "./ArenaScene";
import { INTERNAL_H, computeInternalWidth } from "./scale";
import { capDpr } from "./perf";
import { bakeTextures } from "./pixels";

function viewSize(parent: HTMLElement) {
  const r = parent.getBoundingClientRect();
  const vw = r.width || window.innerWidth;
  const vh = r.height || window.innerHeight;
  return { w: computeInternalWidth(vw, vh), h: INTERNAL_H };
}

export function createGame(parent: HTMLElement) {
  const { w, h } = viewSize(parent);
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent,
    width: w,
    height: h,
    backgroundColor: "#163322",
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    physics: {
      default: "arcade",
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scale: {
      mode: Phaser.Scale.NONE,
      width: w,
      height: h,
    },
    render: {
      pixelArt: true,
      antialias: false,
      roundPixels: true,
      powerPreference: "high-performance",
    },
    input: { gamepad: true, keyboard: true },
    audio: { disableWebAudio: false },
    scene: [BootScene, WorldScene, ArenaScene],
    callbacks: {
      postBoot: (g) => {
        const canvas = g.canvas;
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.imageRendering = "pixelated";
        canvas.tabIndex = 0;
        canvas.setAttribute("tabindex", "0");
        canvas.setAttribute("data-testid", "phaser-canvas");
        canvas.focus();
        canvas.addEventListener("webglcontextlost", (ev) => {
          ev.preventDefault();
          console.warn("[WB-GL] context lost");
        });
        canvas.addEventListener("webglcontextrestored", () => {
          console.warn("[WB-GL] context restored");
          const live = g.scene.getScenes(true)[0];
          if (live) {
            try {
              bakeTextures(live);
            } catch (err) {
              console.warn("[WB-GL] bake failed", err);
            }
          }
        });
        void capDpr();
      },
    },
  });

  const apply = () => {
    const next = viewSize(parent);
    if (game.scale.width !== next.w || game.scale.height !== next.h) {
      game.scale.resize(next.w, next.h);
    }
    game.canvas.style.width = "100%";
    game.canvas.style.height = "100%";
    game.canvas.style.imageRendering = "pixelated";
  };
  window.addEventListener("resize", apply);
  game.events.once("destroy", () => window.removeEventListener("resize", apply));
  setTimeout(apply, 50);
  return game;
}
