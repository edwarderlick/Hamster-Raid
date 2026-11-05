import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { bakeTextures } from "@/game/pixels";

class SpriteViewScene extends Phaser.Scene {
  constructor() {
    super("sprites");
  }
  create() {
    bakeTextures(this);
    this.cameras.main.setBackgroundColor("#070b1a");
    this.add.text(8, 6, "SPRITE VIEWER  24-28px hamster-folk", {
      fontFamily: '"Press Start 2P"',
      fontSize: "8px",
      color: "#ff8a1f",
    });
    const heroes = ["raider", "wanderer"];
    heroes.forEach((cls, i) => {
      const s = this.add.sprite(40 + i * 70, 50, `hero-${cls}`, 0).setDisplaySize(48, 56);
      this.anims.create({
        key: `v-${cls}`,
        frames: this.anims.generateFrameNumbers(`hero-${cls}`, { start: 0, end: 3 }),
        frameRate: 4,
        repeat: -1,
      });
      s.play(`v-${cls}`);
      this.add.text(40 + i * 70, 82, cls, { fontFamily: '"Press Start 2P"', fontSize: "5px", color: "#f0ddb4" }).setOrigin(0.5);
    });
    const npcs = ["miller", "lore", "scout", "kid", "kid2", "shop", "smith", "hermit"];
    npcs.forEach((id, i) => {
      const key = this.textures.exists(`npc-${id}`) ? `npc-${id}` : "villager";
      this.add.image(30 + i * 36, 120, key, 0).setDisplaySize(28, 32);
      this.add.text(30 + i * 36, 140, id.slice(0, 6), { fontFamily: '"Press Start 2P"', fontSize: "4px", color: "#a8b2c4" }).setOrigin(0.5);
    });
    const foes = ["mite", "slime", "crawler", "wasp", "sentry", "pellet", "spark", "brute", "dummy", "pet"];
    foes.forEach((id, i) => {
      if (!this.textures.exists(id)) return;
      const s = this.add.sprite(30 + i * 36, 180, id, 0).setDisplaySize(28, 28);
      const key = `v-${id}`;
      if (!this.anims.exists(key)) {
        this.anims.create({ key, frames: this.anims.generateFrameNumbers(id, { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
      }
      s.play(key);
      this.add.text(30 + i * 36, 200, id.slice(0, 6), { fontFamily: '"Press Start 2P"', fontSize: "4px", color: "#2ee9ff" }).setOrigin(0.5);
    });
    if (this.textures.exists("gearmaw")) {
      this.add.sprite(80, 250, "gearmaw", 0).setDisplaySize(64, 64);
      this.add.text(80, 286, "gearmaw", { fontFamily: '"Press Start 2P"', fontSize: "5px", color: "#ff8a1f" }).setOrigin(0.5);
    }
  }
}

export function SpriteViewer() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    const g = new Phaser.Game({
      type: Phaser.CANVAS,
      parent: host.current,
      width: 480,
      height: 300,
      pixelArt: true,
      backgroundColor: "#070b1a",
      scene: [SpriteViewScene],
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    });
    return () => g.destroy(true);
  }, []);
  return (
    <div style={{ minHeight: "100dvh", background: "#070b1a", padding: 16 }} data-testid="sprite-viewer">
      <h1 style={{ fontFamily: "Press Start 2P, monospace", color: "#ff8a1f", fontSize: 14 }}> /dev/sprites </h1>
      <p style={{ color: "#a8b2c4" }}>Heroes 26×32 · NPCs 24×28 · enemies ~22px · dummy post · baby-hamster pet</p>
      <div ref={host} style={{ width: "100%", maxWidth: 960, aspectRatio: "16/10", imageRendering: "pixelated" }} />
    </div>
  );
}
