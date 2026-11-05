import Phaser from "phaser";
import { W, H } from "./palette";
import { SKILL_TREE, useGame, ITEMS, buySkill } from "./store";
import { SHOP, MAIN } from "./dialogue";
import { SPAWNS, ZONES, tileWorld } from "./maps";

export class HUDScene extends Phaser.Scene {
  hp!: Phaser.GameObjects.Rectangle;
  sta!: Phaser.GameObjects.Rectangle;
  charge!: Phaser.GameObjects.Rectangle;
  labels!: Phaser.GameObjects.Text;
  toast!: Phaser.GameObjects.Text;
  quest!: Phaser.GameObjects.Text;
  mini!: Phaser.GameObjects.Graphics;
  panel?: Phaser.GameObjects.Container;
  panelKind = "none";
  typed = 0;
  typedText?: Phaser.GameObjects.Text;
  constructor() {
    super("hud");
  }
  create() {
    this.cameras.main.setScroll(0, 0);
    this.add.rectangle(4, 4, 72, 6, 0x121a36).setOrigin(0, 0).setScrollFactor(0);
    this.hp = this.add.rectangle(4, 4, 72, 6, 0xe4453a).setOrigin(0, 0).setScrollFactor(0);
    this.add.rectangle(4, 12, 72, 4, 0x121a36).setOrigin(0, 0).setScrollFactor(0);
    this.sta = this.add.rectangle(4, 12, 72, 4, 0x3dcc6e).setOrigin(0, 0).setScrollFactor(0);
    this.add.rectangle(4, 18, 72, 4, 0x121a36).setOrigin(0, 0).setScrollFactor(0);
    this.charge = this.add.rectangle(4, 18, 72, 4, 0x2ee9ff).setOrigin(0, 0).setScrollFactor(0);
    this.labels = this.add
      .text(4, 24, "", { fontFamily: '"Press Start 2P"', fontSize: "5px", color: "#f0ddb4" })
      .setScrollFactor(0);
    this.toast = this.add
      .text(W / 2, 28, "", { fontFamily: '"Press Start 2P"', fontSize: "5px", color: "#ff8a1f" })
      .setOrigin(0.5, 0)
      .setScrollFactor(0);
    this.quest = this.add
      .text(4, H - 14, "", { fontFamily: '"Press Start 2P"', fontSize: "4px", color: "#2ee9ff" })
      .setScrollFactor(0);
    this.add
      .text(W - 4, 4, "J atk K skill L ult\nSPACE roll F talk\nI pack U tree Esc", {
        fontFamily: '"Press Start 2P"',
        fontSize: "4px",
        color: "#6d778c",
        align: "right",
      })
      .setOrigin(1, 0)
      .setScrollFactor(0);
    this.mini = this.add.graphics().setScrollFactor(0).setDepth(30);
    if (this.sys.game.device.input.touch) this.buildTouch();
  }

  buildTouch() {
    const mk = (x: number, y: number, label: string, btn: string) => {
      const r = this.add.circle(x, y, 14, 0x1a2550, 0.7).setScrollFactor(0).setInteractive();
      this.add
        .text(x, y, label, { fontFamily: '"Press Start 2P"', fontSize: "4px", color: "#2ee9ff" })
        .setOrigin(0.5)
        .setScrollFactor(0);
      r.on("pointerdown", () => this.scene.get("world").events.emit("touch-btn", btn, true));
      r.on("pointerup", () => this.scene.get("world").events.emit("touch-btn", btn, false));
      r.on("pointerout", () => this.scene.get("world").events.emit("touch-btn", btn, false));
    };
    mk(W - 28, H - 22, "J", "attack");
    mk(W - 52, H - 22, "K", "skill");
    mk(W - 28, H - 46, "L", "ult");
    mk(W - 52, H - 46, "R", "roll");
    mk(W - 76, H - 22, "F", "talk");
    const stick = this.add.circle(32, H - 32, 22, 0x1a2550, 0.55).setScrollFactor(0).setInteractive();
    stick.on("pointerdown", (p: Phaser.Input.Pointer) => this.joy(stick, p));
    stick.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (p.isDown) this.joy(stick, p);
    });
    stick.on("pointerup", () => this.scene.get("world").events.emit("touch-joy", { x: 0, y: 0 }));
    stick.on("pointerout", () => this.scene.get("world").events.emit("touch-joy", { x: 0, y: 0 }));
  }

  joy(stick: Phaser.GameObjects.Arc, p: Phaser.Input.Pointer) {
    const dx = Phaser.Math.Clamp((p.x - stick.x) / 22, -1, 1);
    const dy = Phaser.Math.Clamp((p.y - stick.y) / 22, -1, 1);
    this.scene.get("world").events.emit("touch-joy", { x: dx, y: dy });
  }

  update(_t: number, dt: number) {
    const s = useGame.getState().save;
    const w = useGame.getState().wheel;
    if (!s) return;
    this.hp.width = 72 * (s.hp / s.hpMax);
    this.sta.width = 72 * (s.stamina / s.staminaMax);
    this.charge.width = 72 * (s.wheelCharge / 100);
    const stale = w.stale ? " STALE" : "";
    this.labels.setText(
      `HP ${Math.ceil(s.hp)}/${s.hpMax}  ${s.heroClass} Lv${s.level}\n${w.coreStatus}${stale} r${w.currentRound}  g${w.globalHp}/${w.globalHpMax}`,
    );
    this.toast.setText(useGame.getState().toast ?? "");
    const q = MAIN[0];
    const qs = s.quests.find((x) => x.id === "main-1");
    this.quest.setText(q && qs ? `${q.title}: ${q.stages[qs.stage] ?? "done"}` : "");
    this.drawMini();
    const ov = useGame.getState().overlay;
    if (ov !== this.panelKind) {
      this.panel?.destroy();
      this.panel = undefined;
      this.panelKind = ov;
      this.typed = 0;
      if (ov !== "none") this.drawPanel(ov);
    }
    if (ov === "dialogue" && this.typedText) {
      const full = useGame.getState().dialogue?.text ?? "";
      this.typed = Math.min(full.length, this.typed + dt * 0.045);
      this.typedText.setText(wrap(full.slice(0, Math.floor(this.typed)), 34));
    }
  }

  drawMini() {
    const world = this.scene.get("world") as Phaser.Scene & { zone?: string; player?: Phaser.Physics.Arcade.Sprite };
    const zid = (world.zone ?? "haven") as keyof typeof ZONES;
    const z = ZONES[zid];
    const px = 4;
    const py = 42;
    this.mini.clear();
    this.mini.fillStyle(0x070b1a, 0.7);
    this.mini.fillRect(px - 1, py - 1, z.cols + 2, z.rows + 2);
    for (let i = 0; i < z.walls.length; i++) {
      if (z.walls[i]) {
        const x = i % z.cols;
        const y = Math.floor(i / z.cols);
        this.mini.fillStyle(0x1a2550, 1);
        this.mini.fillRect(px + x, py + y, 1, 1);
      }
    }
    if (world.player) {
      this.mini.fillStyle(0xff8a1f, 1);
      this.mini.fillRect(px + Math.floor(world.player.x / 16), py + Math.floor(world.player.y / 16), 1, 1);
    }
  }

  drawPanel(kind: string) {
    const c = this.add.container(0, 0);
    const bg = this.add.rectangle(W / 2, H / 2, W - 20, H - 16, 0x0b1228, 0.94).setStrokeStyle(1, 0x2ee9ff);
    c.add(bg);
    const s = useGame.getState().save!;
    const title = this.add
      .text(W / 2, 18, kind.toUpperCase(), { fontFamily: '"Press Start 2P"', fontSize: "6px", color: "#ff8a1f" })
      .setOrigin(0.5);
    c.add(title);
    const close = this.add
      .text(W - 18, 14, "X", { fontFamily: '"Press Start 2P"', fontSize: "6px", color: "#2ee9ff" })
      .setInteractive();
    close.on("pointerdown", () => {
      useGame.getState().setOverlay("none");
      useGame.getState().setDialogue(null);
    });
    c.add(close);

    if (kind === "dialogue" && useGame.getState().dialogue) {
      const d = useGame.getState().dialogue!;
      c.add(this.add.text(18, 32, d.speaker, { fontFamily: '"Press Start 2P"', fontSize: "5px", color: "#2ee9ff" }));
      this.typedText = this.add.text(18, 44, "", {
        fontFamily: '"Press Start 2P"',
        fontSize: "5px",
        color: "#f0ddb4",
        lineSpacing: 6,
      });
      c.add(this.typedText);
      d.choices?.forEach((ch, i) => {
        const t = this.add
          .text(18, 110 + i * 10, `> ${ch.label}`, {
            fontFamily: '"Press Start 2P"',
            fontSize: "4px",
            color: "#2ee9ff",
          })
          .setInteractive();
        t.on("pointerdown", () => {
          if (ch.next.startsWith("travel:")) {
            const dest = ch.next.slice(7);
            const sp = SPAWNS[dest] ?? { zone: dest as "haven", x: 10, y: 12 };
            const tw = tileWorld(sp.x, sp.y);
            useGame.getState().patch({ zone: sp.zone, x: tw.x, y: tw.y });
            useGame.getState().setDialogue(null);
            this.scene.get("world").scene.restart({ zone: sp.zone });
          }
        });
        c.add(t);
      });
    }
    if (kind === "inventory") {
      c.add(
        this.add.text(18, 32, `Gold ${s.gold}  Pts ${s.statPoints}`, {
          fontFamily: '"Press Start 2P"',
          fontSize: "5px",
          color: "#ff8a1f",
        }),
      );
      s.inventory.slice(0, 10).forEach((it, i) => {
        const t = this.add
          .text(18, 46 + i * 10, `${it.name} [${it.slot}]`, {
            fontFamily: '"Press Start 2P"',
            fontSize: "5px",
            color: "#f0ddb4",
          })
          .setInteractive();
        t.on("pointerdown", () => {
          const cur = useGame.getState().save!;
          useGame.getState().patch({ equipped: { ...cur.equipped, [it.slot]: it } });
          useGame.getState().setToast(`Equip ${it.name}`);
        });
        c.add(t);
      });
    }
    if (kind === "shop") {
      SHOP.forEach((row, i) => {
        const it = ITEMS[row.id];
        if (!it) return;
        const t = this.add
          .text(18, 36 + i * 12, `${it.name}  ${row.cost}g`, {
            fontFamily: '"Press Start 2P"',
            fontSize: "5px",
            color: "#f0ddb4",
          })
          .setInteractive();
        t.on("pointerdown", () => {
          const cur = useGame.getState().save!;
          if (cur.gold < row.cost) return useGame.getState().setToast("Not enough gold");
          useGame.getState().patch({ gold: cur.gold - row.cost, inventory: [...cur.inventory, it] });
          useGame.getState().setToast(`Bought ${it.name}`);
        });
        c.add(t);
      });
    }
    if (kind === "skills") {
      SKILL_TREE.forEach((n, i) => {
        const have = s.skills.includes(n.id);
        const col = i < 6 ? 16 : 168;
        const row = i < 6 ? i : i - 6;
        const t = this.add
          .text(col, 32 + row * 18, `${have ? "*" : "-"} ${n.name}\n  ${n.desc}`, {
            fontFamily: '"Press Start 2P"',
            fontSize: "4px",
            color: have ? "#2ee9ff" : "#f0ddb4",
          })
          .setInteractive();
        t.on("pointerdown", () => {
          const cur = useGame.getState().save!;
          const next = buySkill(cur, n.id);
          if (!next) return;
          useGame.getState().setSave(next);
          useGame.getState().setToast(n.name);
          this.panel?.destroy();
          this.panel = undefined;
          this.panelKind = "none";
        });
        c.add(t);
      });
    }
    if (kind === "questlog") {
      MAIN.forEach((q, i) => {
        c.add(
          this.add.text(16, 32 + i * 16, `${q.title}\n ${q.stages[0]}`, {
            fontFamily: '"Press Start 2P"',
            fontSize: "4px",
            color: "#f0ddb4",
          }),
        );
      });
    }
    if (kind === "pause") {
      const resume = this.add
        .text(W / 2, 50, "RESUME", { fontFamily: '"Press Start 2P"', fontSize: "6px", color: "#2ee9ff" })
        .setOrigin(0.5)
        .setInteractive();
      resume.on("pointerdown", () => useGame.getState().setOverlay("none"));
      const sk = this.add
        .text(W / 2, 68, "SKILL TREE", { fontFamily: '"Press Start 2P"', fontSize: "6px", color: "#f0ddb4" })
        .setOrigin(0.5)
        .setInteractive();
      sk.on("pointerdown", () => useGame.getState().setOverlay("skills"));
      const inv = this.add
        .text(W / 2, 86, "PACK", { fontFamily: '"Press Start 2P"', fontSize: "6px", color: "#f0ddb4" })
        .setOrigin(0.5)
        .setInteractive();
      inv.on("pointerdown", () => useGame.getState().setOverlay("inventory"));
      c.add(resume);
      c.add(sk);
      c.add(inv);
    }
    if (kind === "dead") {
      c.add(
        this.add
          .text(W / 2, 60, "YOU FELL\nClick to rise in Wheelhaven.", {
            fontFamily: '"Press Start 2P"',
            fontSize: "5px",
            color: "#e4453a",
            align: "center",
          })
          .setOrigin(0.5),
      );
      bg.setInteractive();
      bg.on("pointerdown", () => {
        const cur = useGame.getState().save!;
        useGame.getState().patch({ hp: cur.hpMax, zone: "haven", x: 168, y: 200 });
        useGame.getState().setOverlay("none");
        this.scene.get("world").scene.restart({ zone: "haven" });
      });
    }
    this.panel = c;
  }
}

function wrap(s: string, n: number) {
  const out: string[] = [];
  let line = "";
  for (const w of s.split(" ")) {
    if ((line + w).length > n) {
      out.push(line);
      line = w + " ";
    } else line += w + " ";
  }
  out.push(line);
  return out.join("\n");
}
