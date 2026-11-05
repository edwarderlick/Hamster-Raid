import Phaser from "phaser";
import { bakeTextures } from "./pixels";
import { bakeSfx } from "./sfx";
import { W, H } from "./palette";
import { useGame } from "./store";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }
  preload() {
    this.load.spritesheet("kenney-town", "/art/kenney-town.png", {
      frameWidth: 16,
      frameHeight: 16,
      spacing: 0,
      margin: 0,
    });
  }
  create() {
    bakeTextures(this);
    try {
      bakeSfx(this);
    } catch {
      /* audio context may be blocked until gesture */
    }
    const g = this.add.graphics();
    g.fillStyle(0x070b1a, 1);
    g.fillRect(0, 0, W, H);
    this.add
      .text(W / 2, H / 2 - 16, "HAMSTER RAID", {
        fontFamily: '"Press Start 2P"',
        fontSize: "8px",
        color: "#ff8a1f",
      })
      .setOrigin(0.5);
    this.add
      .text(W / 2, H / 2 + 4, "WHEELBOUND", {
        fontFamily: '"Press Start 2P"',
        fontSize: "6px",
        color: "#2ee9ff",
      })
      .setOrigin(0.5);
    const bar = this.add.rectangle(W / 2 - 40, H / 2 + 24, 0, 4, 0xff8a1f).setOrigin(0, 0.5);
    this.tweens.add({
      targets: bar,
      width: 80,
      duration: 700,
      onComplete: () => {
        const z = useGame.getState().save?.zone;
        this.scene.start(z === "arena" || z === "battle" ? "arena" : "world");
      },
    });

    const mk = (key: string, tex: string, start: number, end: number, rate: number, repeat = -1) => {
      if (this.anims.exists(key)) return;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(tex, { start, end }),
        frameRate: rate,
        repeat,
      });
    };
    for (const cls of ["brawler", "mystic", "trickster", "wanderer", "raider"]) {
      mk(`${cls}-idle`, `hero-${cls}`, 0, 3, 4);
      mk(`${cls}-walk`, `hero-${cls}`, 8, 13, 10);
      mk(`${cls}-atk`, `hero-${cls}`, 16, 19, 14, 0);
      mk(`${cls}-atk0`, `hero-${cls}`, 16, 19, 16, 0);
      mk(`${cls}-atk1`, `hero-${cls}`, 24, 27, 16, 0);
      mk(`${cls}-atk2`, `hero-${cls}`, 32, 35, 14, 0);
      mk(`${cls}-hurt`, `hero-${cls}`, 40, 41, 8, 0);
      mk(`${cls}-roll`, `hero-${cls}`, 48, 51, 12, 0);
      mk(`${cls}-death`, `hero-${cls}`, 56, 59, 6, 0);
    }
  }
}
