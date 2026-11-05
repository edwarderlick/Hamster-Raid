import Phaser from "phaser";
import { applyDefense, goldForKill, rollDamage, xpToNext } from "@/lib/combat";
import { useGame } from "./store";
import { TILE } from "./palette";
import { failAction, floatDmg, hitStop, okAction, shake, slashArc, sparks, coinFly } from "./fx";
import { chaseStep } from "./chase";
import { dir8 } from "./aim";

export function facingFrom(vx: number, vy: number, prev: number) {
  if (Math.abs(vx) < 8 && Math.abs(vy) < 8) return prev;
  if (Math.abs(vx) > Math.abs(vy)) return vx < 0 ? 1 : 2;
  return vy < 0 ? 3 : 0;
}

export { dir8 };

export function attachShadow(sprite: Phaser.GameObjects.Sprite, dy = 10) {
  if (!sprite.scene.textures.exists("blob-shadow")) return;
  const sh = sprite.scene.add.image(sprite.x, sprite.y + dy, "blob-shadow").setDepth(6);
  sh.setDisplaySize(Math.max(12, sprite.displayWidth * 0.7), 6);
  sprite.setData("shadow", sh);
}

export function syncShadow(sprite: Phaser.GameObjects.Sprite, dy = 10) {
  const sh = sprite.getData("shadow") as Phaser.GameObjects.Image | undefined;
  if (sh && sh.active) sh.setPosition(sprite.x, sprite.y + dy);
}

export function dropShadow(sprite: Phaser.GameObjects.Sprite) {
  const sh = sprite.getData("shadow") as Phaser.GameObjects.Image | undefined;
  sh?.destroy();
}

type ClassId = "brawler" | "mystic" | "trickster" | "wanderer" | "raider";

export class Player extends Phaser.Physics.Arcade.Sprite {
  cls: ClassId;
  facing = 0;
  combo = 0;
  comboT = 0;
  atkCd = 0;
  skillCd = 0;
  ultCd = 0;
  rollT = 0;
  rollCd = 0;
  iFrames = 0;
  blocking = false;
  parryWin = 0;
  attacking = false;
  hitbox!: Phaser.GameObjects.Zone;
  constructor(scene: Phaser.Scene, x: number, y: number, cls: ClassId) {
    const tex = scene.textures.exists("hero-raider") ? "hero-raider" : scene.textures.exists(`hero-${cls}`) ? `hero-${cls}` : "hero-mystic";
    super(scene, x, y, tex, 0);
    this.cls = "mystic";
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setSize(10, 12).setOffset(7, 14);
    this.setDisplaySize(36, 38);
    this.setDepth(10);
    this.anims.create({
      key: "idle",
      frames: this.anims.generateFrameNumbers(tex, { start: 0, end: 3 }),
      frameRate: 4,
      repeat: -1,
    });
    this.anims.create({
      key: "idle-back",
      frames: this.anims.generateFrameNumbers(tex, { start: 4, end: 7 }),
      frameRate: 4,
      repeat: -1,
    });
    this.anims.create({
      key: "walk",
      frames: this.anims.generateFrameNumbers(tex, { start: 8, end: 11 }),
      frameRate: 10,
      repeat: -1,
    });
    this.anims.create({
      key: "walk-back",
      frames: this.anims.generateFrameNumbers(tex, { start: 12, end: 15 }),
      frameRate: 10,
      repeat: -1,
    });
    this.anims.create({
      key: "atk",
      frames: this.anims.generateFrameNumbers(tex, { start: 16, end: 19 }),
      frameRate: 14,
    });
    this.anims.create({
      key: "atk0",
      frames: this.anims.generateFrameNumbers(tex, { start: 16, end: 19 }),
      frameRate: 16,
    });
    this.anims.create({
      key: "atk1",
      frames: this.anims.generateFrameNumbers(tex, { start: 24, end: 27 }),
      frameRate: 16,
    });
    this.anims.create({
      key: "atk2",
      frames: this.anims.generateFrameNumbers(tex, { start: 32, end: 35 }),
      frameRate: 14,
    });
    this.anims.create({
      key: "hurt",
      frames: this.anims.generateFrameNumbers(tex, { start: 40, end: 41 }),
      frameRate: 8,
    });
    this.anims.create({
      key: "block",
      frames: this.anims.generateFrameNumbers(tex, { start: 42, end: 43 }),
      frameRate: 6,
      repeat: -1,
    });
    this.anims.create({
      key: "roll",
      frames: this.anims.generateFrameNumbers(tex, { start: 48, end: 51 }),
      frameRate: 12,
    });
    this.anims.create({
      key: "death",
      frames: this.anims.generateFrameNumbers(tex, { start: 56, end: 59 }),
      frameRate: 6,
    });
    this.play(this.anims.exists("idle") ? "idle" : `${cls}-idle`);
    this.hitbox = scene.add.zone(x, y, 24, 16);
    scene.physics.add.existing(this.hitbox);
    (this.hitbox.body as Phaser.Physics.Arcade.Body).enable = false;
    this.setData("moved", 0);
    attachShadow(this, 14);
  }

  faceAim(ax: number, ay: number) {
    const d = dir8(ax, ay);
    this.setData("dir8", d);
    this.setFlipX(d === 3 || d === 4 || d === 5);
    const back = d === 5 || d === 6 || d === 7;
    this.facing = back ? 3 : this.flipX ? 1 : 2;
    if (this.attacking) return;
    const moving = Math.hypot((this.body as Phaser.Physics.Arcade.Body).velocity.x, (this.body as Phaser.Physics.Arcade.Body).velocity.y) > 12;
    this.play(back ? (moving ? "walk-back" : "idle-back") : moving ? "walk" : "idle", true);
  }

  get save() {
    return useGame.getState().save!;
  }

  tick(cursors: {
    x: number;
    y: number;
    attack: boolean;
    skill: boolean;
    ult: boolean;
    roll: boolean;
    sprint: boolean;
    block: boolean;
    dt: number;
  }) {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const s = this.save;
    if (this.iFrames > 0) this.iFrames -= cursors.dt;
    if (this.atkCd > 0) this.atkCd -= cursors.dt;
    if (this.skillCd > 0) this.skillCd -= cursors.dt;
    if (this.ultCd > 0) this.ultCd -= cursors.dt;
    if (this.rollCd > 0) this.rollCd -= cursors.dt;
    if (this.comboT > 0) this.comboT -= cursors.dt;
    else this.combo = 0;
    if (this.parryWin > 0) this.parryWin -= cursors.dt;

    if (this.rollT > 0) {
      this.rollT -= cursors.dt;
      this.play("roll", true);
      return;
    }

    const hold = useGame.getState().a11y.holdBlock;
    if (hold) {
      const wantBlock = cursors.block && !this.attacking;
      if (wantBlock && !this.blocking) this.parryWin = 150;
      this.blocking = wantBlock;
    } else if (cursors.block && !this.attacking) {
      this.blocking = !this.blocking;
      if (this.blocking) this.parryWin = 150;
    }
    if (this.blocking) {
      this.setTint(0x88ddff);
      if (this.anims.exists("block")) this.play("block", true);
    }

    const accel = 620;
    const max = cursors.sprint && s.stamina > 0 ? 96 : 66;
    let ax = cursors.x * accel;
    let ay = cursors.y * accel;
    if (this.attacking) {
      ax *= 0.25;
      ay *= 0.25;
    }
    body.setAcceleration(ax, ay);
    body.setMaxVelocity(max, max);
    body.setDrag(720, 720);
    if (cursors.x || cursors.y) {
      const len = Math.hypot(cursors.x, cursors.y) || 1;
      body.setAcceleration((cursors.x / len) * accel, (cursors.y / len) * accel);
      this.facing = facingFrom(cursors.x, cursors.y, this.facing);
      if (!this.getData("aimFace")) this.setFlipX(this.facing === 1);
      if (!this.attacking) this.play(this.facing === 3 ? "walk-back" : "walk", true);
      const acc = (useGame.getState().moveAcc ?? 0) + cursors.dt * 0.06;
      useGame.setState({ moveAcc: acc });
      if (acc >= 48) {
        useGame.getState().bumpTutorial("move");
        useGame.setState({ moveAcc: 0 });
      }
    } else if (!this.attacking) {
      this.play(this.facing === 3 ? "idle-back" : "idle", true);
    }
    this.setDepth(10 + this.y);
    syncShadow(this, 14);
    if (this.blocking) this.setTint(0x88ddff);
    else if (s.hp <= s.hpMax * 0.3) this.setTint(0xff8888);
    else if (s.equipped.armor) this.setTint(0xd0e8ff);
    else this.clearTint();
    if (this.iFrames > 0 && Math.floor(this.iFrames / 50) % 2 === 0) this.setAlpha(0.35);
    else this.setAlpha(1);
    if (cursors.sprint && (cursors.x || cursors.y) && s.stamina > 0) {
      useGame.getState().patch({ stamina: s.stamina - cursors.dt * 0.028 });
    } else {
      useGame.getState().patch({ stamina: s.stamina + cursors.dt * 0.018 });
    }

    if (cursors.x || cursors.y) {
      if (Math.random() < 0.08) {
        const d = this.scene.add.image(this.x, this.y + 12, "dust").setDepth(8).setAlpha(0.7);
        this.scene.tweens.add({ targets: d, alpha: 0, y: d.y + 4, duration: 260, onComplete: () => d.destroy() });
      }
    }

    if (cursors.roll) this.tryRoll(body, s);
    if (cursors.attack) this.trySwing();
    if (cursors.skill) this.trySkill();
    if (cursors.ult) this.tryUlt();
    if (cursors.block) useGame.getState().pulseHot("block");

    const hb = this.hitbox.body as Phaser.Physics.Arcade.Body;
    const dir = this.facing === 1 ? -1 : this.facing === 2 ? 1 : 0;
    const vdir = this.facing === 3 ? -1 : this.facing === 0 ? 1 : 0;
    this.hitbox.setPosition(this.x + dir * 16, this.y + vdir * 12);
    if (!this.attacking) hb.enable = false;
  }

  tryRoll(body: Phaser.Physics.Arcade.Body, _s: unknown) {
    void _s;
    const cur = this.save;
    if (this.rollCd > 0) {
      failAction(this.scene, this.x, this.y, "SPACE", "roll", `On cooldown ${(this.rollCd / 1000).toFixed(1)}s`);
      return;
    }
    if (cur.stamina < 18) {
      failAction(this.scene, this.x, this.y, "SPACE", "roll", "Not enough stamina");
      useGame.getState().pulseHot("roll");
      return;
    }
    this.rollT = 180;
    this.rollCd = cur.skills.includes("roll") ? 420 : 560;
    this.iFrames = 220;
    const ang = this.facing === 1 ? Math.PI : this.facing === 2 ? 0 : this.facing === 3 ? -Math.PI / 2 : Math.PI / 2;
    body.setVelocity(Math.cos(ang) * 180, Math.sin(ang) * 180);
    useGame.getState().patch({ stamina: cur.stamina - 18 });
    playSfx(this.scene, "sfx-roll");
    okAction("SPACE", "roll");
    useGame.getState().pulseHot("roll");
    useGame.getState().bumpTutorial("roll");
    for (let i = 0; i < 3; i++) {
      const ghost = this.scene.add.image(this.x - Math.cos(ang) * i * 8, this.y - Math.sin(ang) * i * 8, this.texture.key, this.frame.name);
      ghost.setDisplaySize(26, 32).setAlpha(0.45 - i * 0.1).setTint(0x2ee9ff).setDepth(9);
      this.scene.tweens.add({ targets: ghost, alpha: 0, duration: 180 + i * 40, onComplete: () => ghost.destroy() });
    }
    const dust = this.scene.add.image(this.x, this.y + 10, "dust").setDepth(8);
    this.scene.tweens.add({ targets: dust, alpha: 0, y: dust.y + 6, duration: 280, onComplete: () => dust.destroy() });
  }

  trySwing() {
    if (this.atkCd > 0 && this.comboT <= 0) {
      failAction(this.scene, this.x, this.y, "J", "attack", `On cooldown ${(this.atkCd / 1000).toFixed(1)}s`);
      return;
    }
    if (this.atkCd > 0) return;
    this.swing();
  }

  trySkill() {
    if (this.skillCd > 0) {
      failAction(this.scene, this.x, this.y, "K", "skill", `On cooldown ${(this.skillCd / 1000).toFixed(1)}s`);
      return;
    }
    this.castSkill();
  }

  tryUlt() {
    if (this.ultCd > 0) {
      failAction(this.scene, this.x, this.y, "L", "ult", `On cooldown ${(this.ultCd / 1000).toFixed(1)}s`);
      return;
    }
    if (this.save.wheelCharge < 40 && this.cls !== "mystic") {
      failAction(this.scene, this.x, this.y, "L", "ult", "Need Wheel Charge");
      return;
    }
    this.castUlt();
  }

  aimAssist() {
    const kids = (this.scene as Phaser.Scene).children.list;
    let best: Phaser.GameObjects.Sprite | null = null;
    let bestD = 56;
    for (const ch of kids) {
      const e = ch as Phaser.Physics.Arcade.Sprite & { kind?: string; state?: string };
      if (!e.kind || e.state === "dead") continue;
      const d = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    if (best) {
      this.facing = facingFrom(best.x - this.x, best.y - this.y, this.facing);
      this.setFlipX(this.facing === 1);
      const ring = this.scene.add.circle(best.x, best.y + 6, 10, 0xff8a1f, 0.0).setStrokeStyle(1, 0xff8a1f, 0.8).setDepth(11);
      this.scene.tweens.add({ targets: ring, alpha: 0, duration: 180, onComplete: () => ring.destroy() });
    }
  }

  swing() {
    const s = this.save;
    this.aimAssist();
    this.attacking = true;
    const chained = this.comboT > 0;
    this.combo = chained ? Math.min(2, this.combo + 1) : 0;
    this.comboT = 350;
    this.atkCd = this.combo === 2 ? 220 : 70;
    const atkKey = this.anims.exists(`atk${this.combo}`) ? `atk${this.combo}` : "atk";
    this.play(atkKey);
    const ang = this.facing === 1 ? Math.PI : this.facing === 2 ? 0 : this.facing === 3 ? -Math.PI / 2 : Math.PI / 2;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Math.cos(ang) * (40 + this.combo * 18), Math.sin(ang) * (40 + this.combo * 18));
    const hb = this.hitbox.body as Phaser.Physics.Arcade.Body;
    hb.enable = true;
    const dir = this.facing === 1 ? -1 : this.facing === 2 ? 1 : 0;
    const vdir = this.facing === 3 ? -1 : this.facing === 0 ? 1 : 0;
    this.hitbox.setPosition(this.x + dir * 16, this.y + vdir * 12);
    slashArc(this.scene, this.hitbox.x, this.hitbox.y, this.facing, this.combo);
    playSfx(this.scene, "sfx-swing");
    okAction("J", "attack");
    useGame.getState().pulseHot("atk");
    useGame.getState().setComboHud(this.combo + 1);
    useGame.getState().bumpTutorial("attack");
    this.scene.time.delayedCall(this.combo === 2 ? 140 : 100, () => {
      this.attacking = false;
      hb.enable = false;
    });
    const crit = Math.random() < (s.skills.includes("crit") ? 0.16 : 0.08);
    const dmg = rollDamage({
      baseAtk: s.atk,
      weaponAtk: s.equipped.weapon?.atk ?? 0,
      comboIndex: this.combo,
      crit,
      squeekLevel: s.squeekLevel,
    });
    this.setData("combo", this.combo);
    this.setData("crit", crit);
    this.setData("dmg", s.skills.includes("cap") ? Math.round(dmg * 1.04) : dmg);
  }

  castSkill() {
    const s = this.save;
    const cdMul = s.skills.includes("skill") ? 0.8 : 1;
    this.skillCd = 2400 * cdMul;
    const scene = this.scene as Phaser.Scene;
    const dmg = rollDamage({
      baseAtk: s.atk,
      weaponAtk: s.equipped.weapon?.atk ?? 0,
      comboIndex: 2,
      crit: false,
      squeekLevel: s.squeekLevel,
      skillMul: 1.6,
    });
    this.setData("dmg", dmg);
    okAction("K", "skill");
    useGame.getState().pulseHot("skill");
    playSfx(scene, "sfx-skill");
    const flash = scene.add.rectangle(this.x, this.y - 8, 10, 14, 0xff8a1f, 0.5).setDepth(12);
    scene.tweens.add({ targets: flash, alpha: 0, duration: 160, onComplete: () => flash.destroy() });
    if (this.cls === "brawler") {
      this.play(this.anims.exists("atk2") ? "atk2" : "atk");
      const ring = scene.add.circle(this.x, this.y + 8, 6, 0xff8a1f, 0.35).setDepth(11);
      scene.tweens.add({
        targets: ring,
        radius: 42,
        alpha: 0,
        duration: 280,
        onComplete: () => ring.destroy(),
      });
      scene.time.delayedCall(80, () => scene.events.emit("aoe", this.x, this.y, 40, dmg));
      shake(scene, 90, 0.006);
    } else if (this.cls === "mystic") {
      const orb = scene.physics.add.image(this.x, this.y, "orb");
      const ang = this.facing === 1 ? Math.PI : this.facing === 2 ? 0 : this.facing === 3 ? -Math.PI / 2 : Math.PI / 2;
      orb.setVelocity(Math.cos(ang) * 160, Math.sin(ang) * 160);
      orb.setData("dmg", rollDamage({ baseAtk: s.atk, weaponAtk: s.equipped.weapon?.atk ?? 0, comboIndex: 1, crit: false, squeekLevel: s.squeekLevel, skillMul: 1.3 }));
      orb.setData("proj", true);
      scene.time.delayedCall(1000, () => orb.destroy());
      scene.events.emit("spawn-proj", orb);
      scene.time.delayedCall(120, () => {
        const bolt = scene.add.rectangle(this.x, this.y, 4, 28, 0x2ee9ff, 0.8).setDepth(12);
        bolt.setAngle((ang * 180) / Math.PI);
        scene.tweens.add({ targets: bolt, alpha: 0, duration: 180, onComplete: () => bolt.destroy() });
      });
    } else {
      this.iFrames = 180;
      const ang = this.facing === 1 ? Math.PI : this.facing === 2 ? 0 : this.facing === 3 ? -Math.PI / 2 : Math.PI / 2;
      (this.body as Phaser.Physics.Arcade.Body).setVelocity(Math.cos(ang) * 220, Math.sin(ang) * 220);
      for (let i = 0; i < 4; i++) {
        const ghost = scene.add.image(this.x - Math.cos(ang) * i * 10, this.y - Math.sin(ang) * i * 10, this.texture.key, this.frame.name);
        ghost.setDisplaySize(26, 32).setAlpha(0.5 - i * 0.1).setTint(0xb56cff).setDepth(9);
        scene.tweens.add({ targets: ghost, alpha: 0, duration: 200 + i * 40, onComplete: () => ghost.destroy() });
      }
      (this.hitbox.body as Phaser.Physics.Arcade.Body).enable = true;
      scene.time.delayedCall(140, () => ((this.hitbox.body as Phaser.Physics.Arcade.Body).enable = false));
    }
  }

  castUlt() {
    const s = this.save;
    if (s.wheelCharge < 40 && this.cls !== "mystic") {
      failAction(this.scene, this.x, this.y, "L", "ult", "Need Wheel Charge");
      return;
    }
    this.ultCd = 8000;
    const scene = this.scene;
    const surge = s.wheelCharge >= 40;
    if (surge) useGame.getState().patch({ wheelCharge: s.wheelCharge - 40 });
    const dmg = rollDamage({
      baseAtk: s.atk,
      weaponAtk: s.equipped.weapon?.atk ?? 0,
      comboIndex: 2,
      crit: false,
      squeekLevel: s.squeekLevel,
      skillMul: s.skills.includes("ult") ? 2.6 : 2.1,
      surge,
    });
    this.setData("dmg", dmg);
    this.setData("surge", surge);
    (this.hitbox.body as Phaser.Physics.Arcade.Body).enable = true;
    okAction("L", "ult");
    useGame.getState().pulseHot("ult");
    playSfx(scene, "sfx-ult");
    shake(scene, surge ? 180 : 90, surge ? 0.01 : 0.005);
    const rpm = Math.max(0.4, useGame.getState().wheel.rpmMilli / 1000);
    const flash = scene.add.rectangle(scene.cameras.main.worldView.centerX, scene.cameras.main.worldView.centerY, 800, 400, 0xffffff, 0.45 * useGame.getState().a11y.flash).setScrollFactor(0).setDepth(60);
    scene.tweens.add({ targets: flash, alpha: 0, duration: 220, onComplete: () => flash.destroy() });
    if (!useGame.getState().reducedMotion) {
      scene.time.timeScale = 0.45;
      scene.time.delayedCall(280, () => {
        if (scene.sys.isActive()) scene.time.timeScale = 1;
      });
    }
    const ring = scene.add.circle(this.x, this.y, 8, 0x2ee9ff, 0.4).setDepth(12);
    scene.tweens.add({
      targets: ring,
      radius: 28 + rpm * 18,
      alpha: 0,
      duration: 420,
      onComplete: () => ring.destroy(),
    });
    scene.time.delayedCall(90, () => scene.events.emit("aoe", this.x, this.y, 36 + rpm * 10, dmg));
    if (this.cls === "mystic") {
      useGame.getState().patch({ hp: Math.min(s.hpMax, s.hp + 14) });
    }
    scene.time.delayedCall(220, () => {
      (this.hitbox.body as Phaser.Physics.Arcade.Body).enable = false;
      this.setData("surge", false);
    });
  }

  hurt(raw: number, fromX: number) {
    if (this.iFrames > 0) return;
    const s = this.save;
    if (this.blocking) {
      if (this.parryWin > 0) {
        this.iFrames = 200;
        useGame.getState().setToast("Parry!");
        return;
      }
      raw = Math.floor(raw * 0.4);
    }
    const dmg = applyDefense(raw, s.def + (s.equipped.armor?.def ?? 0));
    const hp = Math.max(0, s.hp - dmg);
    useGame.getState().patch({ hp });
    this.iFrames = 600;
    this.play("hurt");
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(this.x < fromX ? -80 : 80, -40);
    floatDmg(this.scene, this.x, this.y - 12, dmg, false);
    shake(this.scene, 70, 0.005);
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(40, () => this.clearTint());
    if (hp <= 0) {
      this.play(this.anims.exists("death") ? "death" : "hurt");
      useGame.getState().setOverlay("dead");
    }
  }
}

export class Pet extends Phaser.GameObjects.Sprite {
  tx: number;
  ty: number;
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, scene.textures.exists("pet") ? "pet" : "mite", 0);
    this.tx = x;
    this.ty = y;
    scene.add.existing(this);
    this.setDisplaySize(14, 14).setDepth(9);
    if (!this.anims.exists("pet-idle")) {
      this.anims.create({
        key: "pet-idle",
        frames: this.anims.generateFrameNumbers(this.texture.key, { start: 0, end: 3 }),
        frameRate: 6,
        repeat: -1,
      });
    }
    this.play("pet-idle");
  }
  follow(player: Player, dt: number) {
    this.tx = player.x - (player.flipX ? -12 : 12);
    this.ty = player.y + 6;
    const k = Math.min(1, dt * 0.008);
    this.x += (this.tx - this.x) * k;
    this.y += (this.ty - this.y) * k;
    this.setDepth(9 + this.y * 0.01);
    this.setFlipX(player.flipX);
    if (player.attacking) this.setTint(0xff8a1f);
    else this.clearTint();
  }
}

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  hp: number;
  hpMax: number;
  tier: number;
  state: "idle" | "chase" | "windup" | "recover" | "dead" = "idle";
  timer = 0;
  kind: string;
  bar?: Phaser.GameObjects.Graphics;
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    kind: "mite" | "crawler" | "sentry" | "slime" | "wasp" | "pellet" | "spark" | "brute" | "dummy",
    tier: number,
  ) {
    const tex = scene.textures.exists(kind) ? kind : kind === "dummy" && scene.textures.exists("dummy") ? "dummy" : "mite";
    super(scene, x, y, tex, 0);
    this.kind = kind;
    this.tier = tier;
    this.hpMax = kind === "dummy" ? 40 : 12 + tier * 10 + (kind === "brute" ? 28 : kind === "spark" ? 6 : 0);
    this.hp = this.hpMax;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setSize(10, 12).setOffset(7, 12).setDepth(8);
    const big = kind === "brute" || kind === "sentry";
    this.setDisplaySize(kind === "dummy" ? 24 : big ? 28 : 22, kind === "dummy" ? 32 : big ? 32 : 22);
    if (kind === "dummy") this.setData("dummy", true);
    const walkKey = `${tex}-walk`;
    if (!this.anims.exists(walkKey)) {
      this.anims.create({
        key: walkKey,
        frames: this.anims.generateFrameNumbers(tex, { start: 0, end: 2 }),
        frameRate: 6,
        repeat: -1,
      });
    }
    this.play(walkKey);
    const windKey = `${tex}-wind`;
    if (!this.anims.exists(windKey)) {
      this.anims.create({
        key: windKey,
        frames: this.anims.generateFrameNumbers(tex, { start: 3, end: 3 }),
        frameRate: 4,
      });
    }
    attachShadow(this, kind === "brute" ? 16 : 10);
    if (tier >= 2) {
      this.setData("elite", true);
      const aura = scene.add.circle(x, y, 14, 0xb56cff, 0.22).setDepth(7);
      this.setData("aura", aura);
      const crown = scene.textures.exists("elite-crown") ? scene.add.image(x, y - 12, "elite-crown").setDepth(11).setDisplaySize(10, 8) : null;
      this.setData("crown", crown);
    }
  }

  showBar() {
    if (this.hp >= this.hpMax) {
      this.bar?.clear();
      return;
    }
    if (!this.bar) this.bar = this.scene.add.graphics().setDepth(20);
    this.bar.clear();
    this.bar.fillStyle(0x070b1a, 0.9);
    this.bar.fillRect(this.x - 9, this.y - 16, 18, 2);
    this.bar.fillStyle(0xe4453a, 1);
    this.bar.fillRect(this.x - 9, this.y - 16, 18 * Math.max(0, this.hp / this.hpMax), 2);
  }

  think(
    player: Player,
    dt: number,
    slowed: boolean,
    opts: { hunt?: boolean; others?: Enemy[]; bodies?: { x: number; y: number }[]; boost?: number; id?: number } = {},
  ) {
    if (this.state === "dead") return;
    const fighter = !!this.getData("fighter");
    if (this.getData("dummy") && !fighter) {
      this.setDepth(10 + this.y);
      if (this.bar) this.showBar();
      return;
    }
    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.timer -= dt;
    syncShadow(this, this.kind === "brute" ? 16 : 10);
    const aura = this.getData("aura") as Phaser.GameObjects.Arc | undefined;
    if (aura) aura.setPosition(this.x, this.y);
    const crown = this.getData("crown") as Phaser.GameObjects.Image | undefined;
    if (crown) crown.setPosition(this.x, this.y - 12);
    if (this.state === "windup") {
      body.setVelocity(0);
      const windKey = `${this.texture.key}-wind`;
      if (this.anims.exists(windKey)) this.play(windKey, true);
      this.setTint(0xff6644);
      const crowded = this.scene.children.length > 90;
      if (!this.getData("tel") && !crowded) {
        const tel = this.scene.add.image(this.x, this.y + 8, "telegraph").setDepth(7).setDisplaySize(28, 16);
        this.setData("tel", tel);
        const bang = this.scene.add
          .text(this.x, this.y - 16, "!", { fontFamily: '"Press Start 2P"', fontSize: "8px", color: "#e4453a", stroke: "#070b1a", strokeThickness: 3 })
          .setOrigin(0.5)
          .setDepth(22);
        this.setData("bang", bang);
        this.scene.tweens.add({ targets: tel, alpha: 0.2, yoyo: true, duration: 90, repeat: 3, onComplete: () => tel.destroy() });
      }
      if (this.timer <= 0) {
        this.clearTint();
        this.setData("tel", null);
        (this.getData("bang") as Phaser.GameObjects.Text | undefined)?.destroy();
        if (dist < 22) player.hurt(6 + this.tier * 2, this.x);
        this.state = "recover";
        this.timer = 380;
      }
      return;
    }
    if (this.state === "recover") {
      body.setVelocity(0);
      if (this.timer <= 0) this.state = "chase";
      return;
    }
    if ((this.scene.time.now | 0) % 3 === 0) this.setDepth(10 + this.y);
    if (this.bar && this.hp < this.hpMax) this.showBar();
    const step = chaseStep({
      kind: this.kind === "spark" && this.getData("bomber") ? "bomber" : this.kind,
      self: { x: this.x, y: this.y },
      player: { x: player.x, y: player.y },
      others: opts.bodies ?? (opts.others ?? []).filter((o) => o !== this && o.state !== "dead").map((o) => ({ x: o.x, y: o.y })),
      t: this.scene.time.now,
      hunt: opts.hunt ?? true,
      boost: (opts.boost ?? 1) * (slowed ? 0.6 : 1) * (fighter ? 0.45 : 1),
      id: opts.id ?? 0,
    });
    this.state = "chase";
    body.setVelocity(step.vx, step.vy);
    this.setFlipX(player.x < this.x);
    if (step.shoot) this.scene.events.emit("wb-eshot", { x: this.x, y: this.y, dx: player.x - this.x, dy: player.y - this.y, dmg: 4 + this.tier });
    if (step.explode) {
      this.scene.events.emit("wb-explode", { x: this.x, y: this.y, dmg: 14 + this.tier * 2 });
      this.die();
      return;
    }
    if (step.windup && this.timer <= 0 && dist < 28) {
      this.state = "windup";
      this.timer = this.kind === "crawler" || this.kind === "brute" ? 360 : 240;
      body.setVelocity(0);
    }
  }

  takeHit(dmg: number, from: Player) {
    if (this.state === "dead") return;
    this.hp = Math.max(0, this.hp - dmg);
    const crit = !!from.getData("crit");
    const combo = Number(from.getData("combo") || 0);
    const crowded = this.scene.children.length > 90;
    if (!crowded) floatDmg(this.scene, this.x, this.y - 10, dmg, crit);
    this.showBar();
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => this.clearTint());
    if (!crowded) {
      this.setScale(this.scaleX * 1.12, this.scaleY * 0.88);
      this.scene.time.delayedCall(60, () => this.setScale(this.tier >= 2 ? 1.15 : 1));
    }
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(this.x < from.x ? -110 : 110, -42);
    const elite = this.tier >= 2 || !!this.getData("elite");
    const dying = this.hp <= 0;
    if (!crowded) {
      playSfx(this.scene, "sfx-hit");
      sparks(this.scene, this.x, this.y, 0xffffff);
      if (dying && elite) shake(this.scene, 90, 0.01);
      else shake(this.scene, 28, 0.0025);
      if (crit || (dying && elite)) hitStop(this.scene, 40);
    }
    void combo;
    if (this.getData("dummy")) {
      this.scene.time.delayedCall(900, () => {
        this.hp = this.hpMax;
        this.showBar();
      });
      return;
    }
    if (this.hp <= 0) this.die();
  }

  die() {
    this.state = "dead";
    this.bar?.destroy();
    dropShadow(this);
    (this.getData("aura") as Phaser.GameObjects.Arc | undefined)?.destroy();
    (this.getData("crown") as Phaser.GameObjects.Image | undefined)?.destroy();
    const s = useGame.getState().save!;
    const xp = 8 + this.tier * 6;
    let level = s.level;
    let cur = s.xp + xp;
    let points = s.statPoints;
    while (cur >= xpToNext(level)) {
      cur -= xpToNext(level);
      level += 1;
      points += 1;
    }
    useGame.getState().patch({
      xp: cur,
      level,
      statPoints: points,
      gold: s.gold + goldForKill(this.tier),
    });
    coinFly(this.scene, this.x, this.y);
    sparks(this.scene, this.x, this.y, 0x2ee9ff);
    if (level > s.level) useGame.setState({ overlay: "levelup" });
    if (this.kind === "mite") {
      const qs = useGame.getState().save?.quests ?? [];
      const main = qs.find((q) => q.id === "main-1");
      if (main && main.stage === 1) {
        useGame.getState().patch({
          quests: qs.map((q) => (q.id === "main-1" ? { ...q, stage: 2 } : q)),
        });
      }
    }
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.45,
      scaleY: 0.25,
      alpha: 0,
      duration: 180,
      onComplete: () => this.destroy(),
    });
  }
}

export class GearmawBoss extends Phaser.Physics.Arcade.Sprite {
  hp: number;
  hpMax = 420;
  phase = 1;
  state: "idle" | "telegraph" | "attack" | "summon" | "dead" = "idle";
  timer = 800;
  pattern = 0;
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "gearmaw", 0);
    this.hp = this.hpMax;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setImmovable(true).setSize(36, 36).setOffset(14, 20).setDepth(9);
    this.setDisplaySize(64, 64);
    this.anims.create({
      key: "g-idle",
      frames: this.anims.generateFrameNumbers("gearmaw", { start: 0, end: 3 }),
      frameRate: 5,
      repeat: -1,
    });
    this.play("g-idle");
  }

  think(player: Player, dt: number, napping: boolean) {
    if (this.state === "dead") return;
    if (napping && Math.random() < 0.01) this.hp = Math.min(this.hpMax, this.hp + 1);
    this.phase = this.hp > this.hpMax * 0.66 ? 1 : this.hp > this.hpMax * 0.33 ? 2 : 3;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.pattern = (this.pattern + 1) % (this.phase === 1 ? 2 : this.phase === 2 ? 3 : 4);
    this.state = "telegraph";
    this.setTint(0xffaa44);
    const kind = this.pattern;
    this.timer = 500;
    this.scene.time.delayedCall(500, () => {
      this.clearTint();
      this.state = "attack";
      if (kind === 0) this.sweep(player);
      else if (kind === 1) this.slam(player);
      else if (kind === 2) this.vents();
      else this.scene.events.emit("boss-summon");
      this.timer = 900 - this.phase * 80;
      this.state = "idle";
    });
  }

  sweep(player: Player) {
    const beam = this.scene.add.rectangle(this.x, this.y + 20, 220, 10, 0xff8a1f, 0.35);
    this.scene.physics.add.existing(beam);
    this.scene.time.delayedCall(180, () => {
      if (Math.abs(player.y - (this.y + 20)) < 16 && Math.abs(player.x - this.x) < 110) player.hurt(14 * this.phase, this.x);
      beam.destroy();
    });
  }

  slam(player: Player) {
    shake(this.scene, 180, 0.014);
    const ring = this.scene.add.circle(this.x, this.y, 8, 0x2ee9ff, 0.3);
    this.scene.tweens.add({
      targets: ring,
      radius: 70,
      alpha: 0,
      duration: 420,
      onComplete: () => ring.destroy(),
    });
    if (Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) < 56) player.hurt(16, this.x);
  }

  vents() {
    this.scene.events.emit("boss-vents");
  }

  takeHit(dmg: number, surge: boolean) {
    if (this.state === "dead") return;
    this.hp = Math.max(0, this.hp - dmg);
    floatText(this.scene, this.x, this.y - 20, `${dmg}${surge ? " SURGE" : ""}`, surge ? "#2ee9ff" : "#ff8a1f");
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(50, () => this.clearTint());
    if (surge) {
      fetch("/api/surge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ damage: dmg }),
      }).catch(() => undefined);
    }
    if (this.hp <= 0) {
      this.state = "dead";
      this.scene.cameras.main.shake(400, 0.02);
      this.scene.time.timeScale = 0.35;
      this.scene.time.delayedCall(700, () => {
        if (this.scene.sys.isActive()) this.scene.time.timeScale = 1;
        useGame.getState().setToast("The Gearmaw falls. Loot: Foundry Heart.");
      });
      useGame.getState().patch({
        flags: { ...useGame.getState().save!.flags, gearmawDown: true },
        gold: useGame.getState().save!.gold + 120,
        inventory: [...useGame.getState().save!.inventory, { id: "foundry-heart", name: "Foundry Heart", slot: "trinket", rarity: "relic", atk: 4, desc: "Still ticking." }],
      });
      this.scene.tweens.add({ targets: this, alpha: 0.2, angle: 8, duration: 800 });
    }
  }
}

function playSfx(scene: Phaser.Scene, key: string) {
  const vol = useGame.getState().volumes.sfx;
  if (vol <= 0) return;
  try {
    scene.sound.play(key, { volume: vol });
  } catch {
    /* gesture / cache */
  }
}

export function floatText(scene: Phaser.Scene, x: number, y: number, text: string, color: string) {
  const t = scene.add.text(x, y, text, { fontFamily: '"Press Start 2P"', fontSize: "6px", color }).setDepth(40).setOrigin(0.5);
  scene.tweens.add({ targets: t, y: y - 16, alpha: 0, duration: 520, onComplete: () => t.destroy() });
}

export { TILE };
