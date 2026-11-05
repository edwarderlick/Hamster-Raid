import Phaser from "phaser";
import { Enemy, GearmawBoss, Pet, Player, floatText } from "./actors";
import { NPCS } from "./dialogue";
import { failAction, okAction } from "./fx";
import { gameplayOpen } from "./input";
import { SPAWNS, ZONES, tileWorld, type ZoneId } from "./maps";
import { TILE, W, H, KT } from "./palette";
import { ITEMS, useGame } from "./store";
import { currentObjective, tileDist, promptFor } from "./uiState";
import { meter, publishPerf } from "./perf";

type Spot = { id: string; x: number; y: number };

export class WorldScene extends Phaser.Scene {
  player!: Player;
  walls!: Phaser.Tilemaps.TilemapLayer;
  enemies!: Phaser.Physics.Arcade.Group;
  zone: ZoneId = "haven";
  overlay?: Phaser.GameObjects.Rectangle;
  gears: Phaser.GameObjects.Image[] = [];
  spots: Spot[] = [];
  near: string | null = null;
  hint?: Phaser.GameObjects.Text;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  prevPad = { A: false, B: false, X: false, Y: false };
  joy = { x: 0, y: 0 };
  buttons = { attack: false, skill: false, ult: false, roll: false, sprint: false, block: false };
  pending = { attack: false, skill: false, ult: false, roll: false, block: false };
  lastRoundSeen = -1;
  persistT = 0;
  hudT = 0;
  simPaused = false;
  nameTags: { id: string; x: number; y: number; text: Phaser.GameObjects.Text; quest: boolean }[] = [];
  pet?: Pet;
  dbgGfx?: Phaser.GameObjects.Graphics;
  fx: Phaser.GameObjects.Particles.ParticleEmitter[] = [];

  constructor() {
    super("world");
  }

  init(data: { zone?: ZoneId }) {
    this.zone = data.zone ?? useGame.getState().save?.zone ?? "haven";
  }

  create() {
    const save = useGame.getState().save;
    if (!save) return;
    if (this.zone === "arena" || this.zone === "battle") {
      this.scene.start("arena", { mode: this.zone === "battle" ? "battle" : "train", level: save.arenaLevel ?? 1 });
      return;
    }
    this.spots = [];
    this.gears = [];
    this.near = null;
    this.fx = [];
    const zone = ZONES[this.zone];
    useGame.getState().setZoneName(zone.name);
    const sheet = "world";
    const map = this.make.tilemap({
      data: reshape(zone.ground, zone.cols),
      tileWidth: TILE,
      tileHeight: TILE,
    });
    const ts = map.addTilesetImage(sheet, sheet, TILE, TILE, 0, 0) ?? map.addTilesetImage("kenney-town", "kenney-town", TILE, TILE, 0, 0)!;
    const groundLayer = map.createLayer(0, ts, 0, 0)!.setDepth(0);
    const canopy = new Set<number>([
      KT.treeO, KT.pine, KT.treeR, KT.treeO2, KT.pine2, KT.canopyL, KT.canopyM, KT.canopyR,
      KT.roofO, KT.roofO2, KT.roofO3, KT.roofLo, KT.roofGable, KT.roofLo3, KT.castleT, KT.castleT2, KT.castleT3,
      KT.wheatT, KT.stoneTop, KT.stoneTop2, KT.stoneTop3,
    ]);
    const decorData = zone.decor.slice();
    for (let i = 0; i < decorData.length; i++) {
      const t = decorData[i]!;
      if (!canopy.has(t)) continue;
      const tx = i % zone.cols;
      const ty = Math.floor(i / zone.cols);
      this.add.image(tx * TILE + 8, ty * TILE + 8, "world", t).setDepth(10 + ty * TILE);
      decorData[i] = -1;
    }
    const decorMap = this.make.tilemap({
      data: reshape(decorData, zone.cols),
      tileWidth: TILE,
      tileHeight: TILE,
    });
    const decorLayer = decorMap.createLayer(0, ts, 0, 0)!.setDepth(2);
    const wallMap = this.make.tilemap({
      data: reshape(zone.walls, zone.cols),
      tileWidth: TILE,
      tileHeight: TILE,
    });
    this.walls = wallMap.createLayer(0, ts, 0, 0)!;
    this.walls.setCollisionByExclusion([-1, 0]);
    this.walls.setVisible(false);

    const spawnObj = zone.objects.find((o) => o.kind === "spawn");
    const sp = tileWorld(spawnObj?.x ?? 4, spawnObj?.y ?? 4);
    const useSaved = save.zone === this.zone && save.flags.visited && save.x > 16;
    this.player = new Player(this, useSaved ? save.x : sp.x, useSaved ? save.y : sp.y, save.heroClass);
    this.physics.add.collider(this.player, this.walls);
    this.cameras.main.startFollow(this.player, true, 0.18, 0.18);
    this.cameras.main.setSize(this.scale.width, this.scale.height);
    this.cameras.main.setBounds(0, 0, zone.cols * TILE, zone.rows * TILE);
    this.cameras.main.setDeadzone(40, 24);
    this.cameras.main.roundPixels = true;
    this.physics.world.setBounds(0, 0, zone.cols * TILE, zone.rows * TILE);
    this.player.setCollideWorldBounds(true);
    this.scale.on("resize", (gs: Phaser.Structs.Size) => {
      this.cameras.main.setSize(gs.width, gs.height);
    });
    const shadow = this.add.image(this.player.x, this.player.y + 12, "blob-shadow").setDepth(9);
    this.registry.set("pshadow", shadow);
    void groundLayer;
    void decorLayer;
    const tut = useGame.getState().save?.tutorialStep ?? 99;
    if (tut >= 5) {
      useGame.getState().setZoneBanner(zone.name);
      this.time.delayedCall(2200, () => useGame.getState().setZoneBanner(null));
    }

    this.enemies = this.physics.add.group();
    this.overlay = this.add
      .rectangle(0, 0, zone.cols * TILE, zone.rows * TILE, 0x1a3348, 0)
      .setOrigin(0)
      .setDepth(6)
      .setBlendMode(Phaser.BlendModes.NORMAL);

    for (const o of zone.objects) {
      const p = tileWorld(o.x, o.y);
      if (o.kind === "dummy") {
        const e = new Enemy(this, p.x, p.y, "dummy", 0);
        this.enemies.add(e);
        this.registry.set("dummy", e);
      }
      if (o.kind === "lantern") {
        const glow = this.add.circle(p.x, p.y, 18, 0xff8a1f, 0.18).setDepth(4);
        this.tweens.add({ targets: glow, alpha: 0.08, yoyo: true, duration: 700, repeat: -1 });
        this.add.circle(p.x, p.y, 28, 0xffcc66, 0.12).setDepth(3);
      }
      if (o.kind === "enemy") {
        const e = new Enemy(this, p.x, p.y, o.type, o.tier);
        this.enemies.add(e);
        this.physics.add.collider(e, this.walls);
      }
      if (o.kind === "miniboss") {
        const e = new Enemy(this, p.x, p.y, this.zone === "forest" ? "brute" : "pellet", 5);
        e.hp = e.hpMax = 90;
        e.setScale(1.25);
        this.enemies.add(e);
      }
      if (o.kind === "boss") {
        const b = new GearmawBoss(this, p.x, p.y);
        this.physics.add.collider(this.player, b);
        this.registry.set("boss", b);
        this.add
          .text(p.x, p.y - 48, "THE GEARMAW", {
            fontFamily: '"Press Start 2P"',
            fontSize: "6px",
            color: "#ff8a1f",
            stroke: "#070b1a",
            strokeThickness: 3,
          })
          .setOrigin(0.5)
          .setDepth(21);
        if (!save.flags.sawGearmaw) {
          useGame.getState().patch({ flags: { ...save.flags, sawGearmaw: true } });
          this.cameras.main.stopFollow();
          this.cameras.main.pan(p.x, p.y, 900, "Sine.easeInOut");
          this.time.delayedCall(1100, () => {
            this.cameras.main.shake(200, 0.01);
            useGame.getState().setDialogue({
              speaker: "The Gearmaw",
              text: "The wheel is a heart I bottled. Run, hamster. I drink your quiet.",
            });
            this.cameras.main.startFollow(this.player, true, 0.18, 0.18);
          });
        }
      }
      if (o.kind === "npc") this.villager(p, o.id, o.face ?? 0);
      if (o.kind === "shop") this.villager(p, "shop", 1);
      if (o.kind === "smith") this.villager(p, "smith", 2);
      if (o.kind === "board") {
        this.add.image(p.x, p.y, "world", 83).setDepth(8);
        this.spots.push({ id: "board", x: p.x, y: p.y });
      }
      if (o.kind === "shrine") {
        this.add.image(p.x, p.y, "world", 104).setDepth(8);
        this.spots.push({ id: `shrine:${o.id}`, x: p.x, y: p.y });
      }
      if (o.kind === "chest" && !save.chests.includes(o.id)) {
        this.add.image(p.x, p.y, "world", 130).setDepth(8);
        this.spots.push({ id: `chest:${o.id}`, x: p.x, y: p.y });
      }
      if (o.kind === "sign") {
        const msg = this.add
          .text(p.x, p.y - 10, o.text, {
            fontFamily: '"Press Start 2P"',
            fontSize: "5px",
            color: "#f0ddb4",
            stroke: "#070b1a",
            strokeThickness: 3,
            align: "center",
          })
          .setOrigin(0.5)
          .setDepth(21);
        this.registry.set(`sign-${o.text}`, msg);
      }
      if (o.kind === "portal") {
        this.add.rectangle(p.x, p.y, 14, 14, 0x2ee9ff, 0.18);
        const destName = o.to === "forest" ? "COGWOOD" : o.to === "mines" ? "MINES" : o.to === "foundry" ? "FOUNDRY" : "WHEELHAVEN";
        const dir = o.to === "forest" ? "→" : o.to === "mines" ? "↓" : o.to === "haven" && o.spawn === "east" ? "←" : "↑";
        this.add
          .text(p.x, p.y - 14, `${dir} ${destName}`, {
            fontFamily: '"Press Start 2P"',
            fontSize: "5px",
            color: "#2ee9ff",
            stroke: "#070b1a",
            strokeThickness: 3,
          })
          .setOrigin(0.5)
          .setDepth(21);
        this.spots.push({ id: `portal:${o.to}:${o.spawn}`, x: p.x, y: p.y });
      }
      if (o.kind === "lever") {
        this.add.image(p.x, p.y, "world", 128).setDepth(8);
        this.spots.push({ id: `lever:${o.id}`, x: p.x, y: p.y });
      }
      if (o.kind === "gear") {
        const gimg = this.add.image(p.x, p.y, "world", 145).setDepth(2);
        this.gears.push(gimg);
      }
      if (o.kind === "vent") {
        const v = this.add.rectangle(p.x, p.y, 16, 16, 0xff8a1f, 0.0).setData("vent", true);
        this.physics.add.existing(v, true);
        this.physics.add.overlap(this.player, v, () => {
          if (this.registry.get("ventsOn")) this.player.hurt(8, v.x);
        });
      }
      if (o.kind === "secret") {
        this.spots.push({ id: `secret:${o.id}`, x: p.x, y: p.y });
      }
    }

    this.physics.add.overlap(this.player.hitbox, this.enemies, (_h, e) => {
      const en = e as Enemy;
      if (en.state === "dead") return;
      let dmg = Number(this.player.getData("dmg") || 1);
      if (this.player.cls === "trickster") {
        const behind = (en.body as Phaser.Physics.Arcade.Body).velocity.x * (this.player.x - en.x) > 0;
        if (behind) dmg = Math.round(dmg * 1.75);
      }
      en.takeHit(dmg, this.player);
      (this.player.hitbox.body as Phaser.Physics.Arcade.Body).enable = false;
    });

    this.events.on("spawn-proj", (orb: Phaser.Physics.Arcade.Image) => {
      this.physics.add.overlap(orb, this.enemies, (o, e) => {
        (e as Enemy).takeHit(Number((o as Phaser.Physics.Arcade.Image).getData("dmg")), this.player);
        (o as Phaser.Physics.Arcade.Image).destroy();
      });
      const boss = this.registry.get("boss") as GearmawBoss | undefined;
      if (boss) {
        this.physics.add.overlap(orb, boss, (o) => {
          boss.takeHit(Number((o as Phaser.Physics.Arcade.Image).getData("dmg")), !!this.player.getData("surge"));
          (o as Phaser.Physics.Arcade.Image).destroy();
        });
      }
    });

    this.events.on("boss-summon", () => {
      const b = this.registry.get("boss") as GearmawBoss;
      if (!b || b.state === "dead") return;
      const e = new Enemy(this, b.x + 20, b.y + 16, "sentry", 2);
      this.enemies.add(e);
    });
    this.events.on("boss-vents", () => {
      this.registry.set("ventsOn", true);
      this.time.delayedCall(700, () => this.registry.set("ventsOn", false));
    });

    const boss = this.registry.get("boss") as GearmawBoss | undefined;
    if (boss) {
      this.physics.add.overlap(this.player.hitbox, boss, () => {
        const dmg = Number(this.player.getData("dmg") || 1);
        boss.takeHit(dmg, !!this.player.getData("surge"));
        (this.player.hitbox.body as Phaser.Physics.Arcade.Body).enable = false;
      });
    }

    const kb = this.input.keyboard!;
    const bind = useGame.getState().keys;
    this.keys = {
      left: kb.addKey(bind.left),
      right: kb.addKey(bind.right),
      up: kb.addKey(bind.up),
      down: kb.addKey(bind.down),
      attack: kb.addKey(bind.attack),
      skill: kb.addKey(bind.skill),
      ult: kb.addKey(bind.ult),
      roll: kb.addKey(bind.roll),
      sprint: kb.addKey(bind.sprint),
      block: kb.addKey(bind.block),
      arrowL: kb.addKey("LEFT"),
      arrowR: kb.addKey("RIGHT"),
      arrowU: kb.addKey("UP"),
      arrowD: kb.addKey("DOWN"),
      space: kb.addKey("SPACE"),
    };
    kb.on("keydown-F", () => {
      if (useGame.getState().overlay === "dialogue") {
        useGame.getState().setDialogue(null);
        okAction("F", "close-dialogue");
        return;
      }
      if (!gameplayOpen(useGame.getState().overlay)) return;
      this.interact();
    });
    try {
      kb.addCapture([
        Phaser.Input.Keyboard.KeyCodes.SPACE,
        Phaser.Input.Keyboard.KeyCodes.W,
        Phaser.Input.Keyboard.KeyCodes.A,
        Phaser.Input.Keyboard.KeyCodes.S,
        Phaser.Input.Keyboard.KeyCodes.D,
      ]);
    } catch {
      /* capture optional */
    }
    kb.on("keydown-I", () => {
      if (!gameplayOpen(useGame.getState().overlay) && useGame.getState().overlay !== "inventory") return;
      useGame.getState().setOverlay("inventory");
      useGame.getState().bumpTutorial("pack");
      okAction("I", "inventory");
    });
    kb.on("keydown-ESC", () => {
      const ov = useGame.getState().overlay;
      useGame.getState().setOverlay(ov === "none" ? "pause" : "none");
      okAction("ESC", ov === "none" ? "pause" : "close");
    });
    kb.on("keydown-M", () => {
      if (!gameplayOpen(useGame.getState().overlay) && useGame.getState().overlay !== "questlog") return;
      useGame.getState().setOverlay("questlog");
      okAction("M", "journal");
    });
    kb.on("keydown-U", () => {
      if (!gameplayOpen(useGame.getState().overlay) && useGame.getState().overlay !== "skills") return;
      useGame.getState().setOverlay("skills");
      okAction("U", "skills");
    });
    kb.on("keydown-F1", () => {
      useGame.getState().setOverlay("help");
      okAction("F1", "help");
    });
    kb.on("keydown", (ev: KeyboardEvent) => {
      if (ev.key === "`" || ev.code === "Backquote") {
        useGame.getState().toggleDebug();
        okAction("`", "debug");
      }
    });
    const onWinDown = (ev: KeyboardEvent) => {
      if (ev.repeat) return;
      const code = ev.code;
      if (code === "KeyJ") this.pending.attack = true;
      if (code === "KeyK") this.pending.skill = true;
      if (code === "KeyL") this.pending.ult = true;
      if (code === "Space") this.pending.roll = true;
      if (code === "KeyH") this.pending.block = true;
      if (code === "F3") useGame.setState({ fpsOpen: !useGame.getState().fpsOpen });
    };
    const onWinUp = (ev: KeyboardEvent) => {
      if (ev.code === "KeyH") this.pending.block = false;
    };
    window.addEventListener("keydown", onWinDown);
    window.addEventListener("keyup", onWinUp);
    this.events.once("shutdown", () => {
      window.removeEventListener("keydown", onWinDown);
      window.removeEventListener("keyup", onWinUp);
    });

    this.events.on("touch-joy", (v: { x: number; y: number }) => (this.joy = v));
    this.events.on("touch-btn", (b: string, d: boolean) => {
      if (b === "talk" && d) this.interact();
      else (this.buttons as Record<string, boolean>)[b] = d;
    });

    this.hint = this.add
      .text(0, 0, "", {
        fontFamily: '"Press Start 2P"',
        fontSize: "6px",
        color: "#2ee9ff",
        stroke: "#070b1a",
        strokeThickness: 3,
      })
      .setDepth(20)
      .setOrigin(0.5);

    this.time.addEvent({ delay: 12000, loop: true, callback: () => this.pullWheel() });
    const onTravel = (ev: Event) => {
      const id = (ev as CustomEvent<string>).detail;
      const dest = SPAWNS[id] ?? { zone: id as ZoneId, x: 10, y: 10 };
      const tw = tileWorld(dest.x, dest.y);
      useGame.getState().patch({ zone: dest.zone, x: tw.x, y: tw.y });
      useGame.getState().setDialogue(null);
      this.scene.restart({ zone: dest.zone });
    };
    const onRestart = (ev: Event) => this.scene.restart({ zone: (ev as CustomEvent<string>).detail });
    const onJoy = (ev: Event) => (this.joy = (ev as CustomEvent<{ x: number; y: number }>).detail);
    const onBtn = (ev: Event) => {
      const { b, d } = (ev as CustomEvent<{ b: string; d: boolean }>).detail;
      if (b === "talk" && d) this.interact();
      else (this.buttons as Record<string, boolean>)[b] = d;
    };
    window.addEventListener("wb-travel", onTravel);
    window.addEventListener("wb-restart", onRestart);
    window.addEventListener("wb-joy", onJoy);
    window.addEventListener("wb-btn", onBtn);
    this.events.once("shutdown", () => {
      window.removeEventListener("wb-travel", onTravel);
      window.removeEventListener("wb-restart", onRestart);
      window.removeEventListener("wb-joy", onJoy);
      window.removeEventListener("wb-btn", onBtn);
    });
    this.pet = new Pet(this, this.player.x - 14, this.player.y + 4);
    this.dbgGfx = this.add.graphics().setDepth(50);
    this.events.on("aoe", (x: number, y: number, r: number, dmg: number) => {
      this.enemies.getChildren().forEach((ch) => {
        const e = ch as Enemy;
        if (e.state === "dead") return;
        if (Phaser.Math.Distance.Between(e.x, e.y, x, y) <= r) e.takeHit(dmg, this.player);
      });
      const boss = this.registry.get("boss") as GearmawBoss | undefined;
      if (boss && boss.state !== "dead" && Phaser.Math.Distance.Between(boss.x, boss.y, x, y) <= r) {
        boss.takeHit(dmg, !!this.player.getData("surge"));
      }
    });
    (window as unknown as { __WB: object }).__WB = {
      zone: (z: ZoneId) => this.scene.restart({ zone: z }),
      overlay: (o: string) => {
        if (o === "none") useGame.getState().setDialogue(null);
        useGame.setState({ overlay: o as never, inputMode: o === "none" ? "gameplay" : o === "dead" ? "dead" : o === "dialogue" ? "dialogue" : "menu" });
      },
      scene: this,
      warp: (x: number, y: number) => {
        this.player.setPosition(x, y);
        (this.player.body as Phaser.Physics.Arcade.Body).reset(x, y);
        this.cameras.main.centerOn(x, y);
      },
      swing: () => this.player.trySwing(),
      roll: () => this.player.tryRoll(this.player.body as Phaser.Physics.Arcade.Body, this.player.save),
      dummy: () => this.registry.get("dummy"),
      hurt: (n: number) => this.player.hurt(n, this.player.x + 8),
      sta: (n: number) => useGame.getState().patch({ stamina: n }),
      hp: (n: number) => useGame.getState().patch({ hp: n }),
      charge: (n: number) => useGame.getState().patch({ wheelCharge: n }),
      skipTut: () => useGame.getState().skipTutorial(),
    };
    this.pullWheel();
    if (this.zone === "forest" && this.textures.exists("dust")) {
      this.fx.push(
        this.add.particles(0, 0, "dust", {
          x: { min: 0, max: zone.cols * TILE },
          y: 0,
          lifespan: 2400,
          speedY: { min: 12, max: 28 },
          speedX: { min: -8, max: 8 },
          quantity: 1,
          frequency: 280,
          scale: { start: 0.8, end: 0.2 },
          alpha: { start: 0.5, end: 0 },
          emitting: true,
        }),
      );
    }
    if ((this.zone === "foundry" || this.zone === "mines") && this.textures.exists("dust")) {
      this.fx.push(
        this.add.particles(0, 0, "orb", {
          x: { min: 0, max: zone.cols * TILE },
          y: { min: 0, max: zone.rows * TILE },
          lifespan: 1800,
          speedY: { min: -16, max: -4 },
          quantity: 1,
          frequency: 400,
          scale: { start: 0.4, end: 0 },
          alpha: { start: 0.5, end: 0 },
          emitting: true,
        }),
      );
    }
    const mus = `mus-${this.zone}`;
    const vol = useGame.getState().volumes.music;
    if (vol > 0 && this.cache.audio.exists(mus)) {
      try {
        this.sound.stopAll();
        this.sound.play(mus, { loop: true, volume: vol });
      } catch {
        /* audio locked */
      }
    }
  }

  spot(p: { x: number; y: number }, id: string, tex: string) {
    this.physics.add.staticImage(p.x, p.y, tex).setDisplaySize(24, 24);
    this.spots.push({ id, x: p.x, y: p.y });
  }

  villager(p: { x: number; y: number }, id: string, face: number) {
    const names: Record<string, string> = {
      miller: "Miller",
      lore: "Elder",
      scout: "Scout Pip",
      hermit: "Hermit",
      shop: "Nettle",
      smith: "Mattie",
      kid: "Pipkin",
      kid2: "Bramble",
    };
    const tex = this.textures.exists(`npc-${id}`) ? `npc-${id}` : "villager";
    const img = this.add.image(p.x, p.y, tex, tex === "villager" ? face % 4 : 0).setDepth(10 + p.y).setDisplaySize(24, 28);
    this.tweens.add({ targets: img, y: p.y - 1, yoyo: true, duration: 800, repeat: -1, ease: "Sine.inOut" });
    const glow = this.add.circle(p.x, p.y + 4, 8, 0x2ee9ff, 0.14).setDepth(7);
    this.tweens.add({ targets: glow, alpha: 0.04, yoyo: true, duration: 800, repeat: -1 });
    const label = this.add
      .text(p.x, p.y - 18, names[id] ?? id, {
        fontFamily: '"Press Start 2P"',
        fontSize: "5px",
        color: "#f0ddb4",
        stroke: "#070b1a",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(21)
      .setVisible(false);
    this.nameTags.push({ id, x: p.x, y: p.y, text: label, quest: id === "miller" });
    this.add.image(p.x, p.y + 10, "blob-shadow").setDepth(9);
    this.spots.push({ id, x: p.x, y: p.y });
  }

  interact() {
    if (!this.near) {
      failAction(this, this.player.x, this.player.y, "F", "interact", "Nothing to interact with");
      return;
    }
    if (this.near.startsWith("portal:")) {
      const [, to, spawn] = this.near.split(":");
      const dest = SPAWNS[spawn ?? ""] ?? { zone: to as ZoneId, x: 8, y: 8 };
      const napping = useGame.getState().wheel.coreStatus === "IDLE";
      if (dest.zone === "foundry" && napping && !useGame.getState().save!.equipped.trinket) {
        useGame.getState().setToast("Foundry gate is dark. The hamster sleeps.");
        return;
      }
      const tw = tileWorld(dest.x, dest.y);
      useGame.getState().patch({ zone: dest.zone, x: tw.x, y: tw.y });
      if (dest.zone === "foundry") {
        const qs = useGame.getState().save?.quests ?? [];
        useGame.getState().patch({
          quests: qs.map((q) => (q.id === "main-1" && q.stage < 4 ? { ...q, stage: 4 } : q)),
        });
      }
      this.scene.restart({ zone: dest.zone });
      return;
    }
    if (this.near.startsWith("chest:")) {
      const id = this.near.slice(6);
      const z = ZONES[this.zone];
      const chest = z.objects.find((o) => o.kind === "chest" && o.id === id);
      if (chest && chest.kind === "chest" && !useGame.getState().save!.chests.includes(id)) {
        const item = ITEMS[chest.loot];
        const s = useGame.getState().save!;
        useGame.getState().patch({
          chests: [...s.chests, id],
          inventory: item ? [...s.inventory, item] : s.inventory,
          gold: s.gold + 8,
        });
        useGame.getState().setToast(item ? `Got ${item.name}` : "Empty.");
        floatText(this, this.player.x, this.player.y - 14, "GET", "#2ee9ff");
      }
      return;
    }
    if (this.near.startsWith("shrine:")) {
      const id = this.near.slice(7);
      const s = useGame.getState().save!;
      const shrines = s.shrines.includes(id) ? s.shrines : [...s.shrines, id];
      useGame.getState().patch({
        hp: s.hpMax,
        stamina: s.staminaMax,
        shrines,
        x: this.player.x,
        y: this.player.y,
        zone: this.zone,
      });
      const w = useGame.getState().wheel;
      const dests = shrines.filter((x) => x !== id);
      useGame.getState().setDialogue({
        speaker: "Wheel Shrine",
        text: `Round ${w.currentRound}. Wheel ${w.coreStatus}${w.stale ? " STALE" : ""}. Global ${w.globalHp}/${w.globalHpMax}. Rest granted.`,
        choices: dests.map((d) => ({ label: `Travel: ${d}`, next: `travel:${d}` })),
      });
      this.persist();
      const qs = useGame.getState().save?.quests ?? [];
      useGame.getState().patch({
        quests: qs.map((q) => (q.id === "main-1" && q.stage === 2 ? { ...q, stage: 3 } : q)),
      });
      return;
    }
    if (this.near.startsWith("lever:")) {
      useGame.getState().setToast("The rust-gate rattles open.");
      useGame.getState().patch({ flags: { ...useGame.getState().save!.flags, mineGate: true } });
      return;
    }
    if (this.near.startsWith("secret:")) {
      const s = useGame.getState().save!;
      if (!s.flags.hollow) {
        useGame.getState().patch({
          flags: { ...s.flags, hollow: true },
          gold: s.gold + 25,
          inventory: [...s.inventory, ITEMS["ember-ring"]!],
        });
        useGame.getState().setToast("A hollow cache. Ember Ring.");
      }
      return;
    }
    if (this.near === "shop") {
      useGame.getState().setOverlay("shop");
      return;
    }
    if (this.near === "smith") {
      useGame.getState().setOverlay("equip");
      useGame.getState().setToast("Blacksmith: upgrade equipped gear for 25g.");
      return;
    }
    const lines = NPCS[this.near];
    if (lines) {
      const line = lines[0]!;
      useGame.getState().setDialogue({ speaker: line.speaker, text: line.text });
      if (line.flag) useGame.getState().patch({ flags: { ...useGame.getState().save!.flags, [line.flag]: true } });
      if (this.near === "miller") {
        const s = useGame.getState().save!;
        useGame.getState().patch({
          quests: s.quests.map((q) => (q.id === "main-1" && q.stage === 0 ? { ...q, stage: 1 } : q)),
        });
      }
      useGame.getState().bumpTutorial("talk");
    }
  }

  persist() {
    const s = useGame.getState().save;
    if (!s) return;
    useGame.getState().patch({
      x: this.player.x,
      y: this.player.y,
      zone: this.zone,
      flags: { ...s.flags, visited: true },
    });
  }

  async pullWheel() {
    try {
      const res = await fetch("/api/raid");
      if (!res.ok) throw new Error("raid");
      const j = await res.json();
      useGame.getState().setWheel({
        coreStatus: j.status?.coreStatus ?? "UNKNOWN",
        rpmMilli: j.status?.rpmMilli ?? 0,
        currentRound: j.currentRound,
        settledThroughRound: Number(j.status?.settledThroughRound ?? 0),
        cumulativeWorkUnits: j.status?.cumulativeWorkUnits ?? "0",
        stale: !!j.status?.stale,
        globalHp: j.boss?.hp ?? 500,
        globalHpMax: j.boss?.hpMax ?? 500,
        lastHit: j.boss?.lastHit ?? null,
      });
      const napping = j.status?.coreStatus === "IDLE";
      this.overlay?.setFillStyle(0x1b3350, napping ? 0.18 : 0.0);
      const gate = this.children.list.find((c) => (c as Phaser.GameObjects.Text).text === "THE GEARMAW") as Phaser.GameObjects.Text | undefined;
      if (napping && this.zone === "foundry") {
        useGame.getState().setToast("Squeektoshi is napping. The Foundry gate sleeps with him.");
        if (gate) gate.setText("GATE SLEEPS");
      } else if (gate && this.zone === "foundry") gate.setText("THE GEARMAW");
      const rpm = Number(j.status?.rpmMilli ?? 0) / 1000;
      this.gears.forEach((g) => {
        this.tweens.killTweensOf(g);
        if (rpm > 0) this.tweens.add({ targets: g, angle: 360, duration: Math.max(400, 4000 / (rpm || 1)), repeat: -1 });
      });
      const s = useGame.getState().save;
      if (s && !napping) {
        const extra = s.skills.includes("surge1") ? 2.2 : 1.4;
        useGame.getState().patch({ wheelCharge: Math.min(100, s.wheelCharge + extra) });
      }
      const latest = j.processed?.[0];
      if (latest && latest.roundId !== this.lastRoundSeen) {
        this.lastRoundSeen = latest.roundId;
        const kind = latest.work <= 0 ? "nap" : latest.work >= 40 ? "zoomies" : "jog";
        const s2 = useGame.getState().save;
        if (s2) {
          const beat =
            kind === "nap"
              ? `Round ${latest.roundId}: the wheel went still. Gears cooled.`
              : kind === "zoomies"
                ? `Round ${latest.roundId}: zoomies. A meteor of cogs.`
                : `Round ${latest.roundId}: a working jog. Lanterns brighten.`;
          useGame.getState().patch({ codex: [...s2.codex, beat].slice(-40) });
          useGame.getState().setToast(beat);
          if (kind === "zoomies") {
            const c = this.add.image(this.player.x + 24, this.player.y - 8, "tiles", 9);
            this.tweens.add({ targets: c, y: c.y + 12, duration: 400 });
            useGame.getState().patch({ gold: s2.gold + 12 });
          }
        }
      }
    } catch {
      useGame.getState().setWheel({ stale: true });
    }
  }

  update(_t: number, dt: number) {
    if (!this.player?.body) return;
    this.persistT += dt;
    if (this.persistT > 4000) {
      this.persistT = 0;
      this.persist();
    }
    const kids = this.enemies.getChildren();
    publishPerf(meter.tick(1 + kids.length, this.fx.length * 8));
    const mode = useGame.getState().inputMode;
    const playing = mode === "gameplay";
    if (!playing) {
      if (!this.simPaused) {
        this.physics.world.pause();
        this.tweens.pauseAll();
        this.fx.forEach((e) => e.stop());
        this.simPaused = true;
      }
      (this.player.body as Phaser.Physics.Arcade.Body).setAcceleration(0, 0);
      if (mode !== "cutscene") (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      this.buttons.attack = false;
      this.buttons.skill = false;
      this.buttons.ult = false;
      this.buttons.roll = false;
      this.pending.attack = false;
      this.pending.skill = false;
      this.pending.ult = false;
      this.pending.roll = false;
      if (mode === "dead" && this.player.anims.exists("death")) this.player.play("death", true);
      this.pet?.follow(this.player, dt);
      return;
    }
    if (this.simPaused) {
      this.physics.world.resume();
      this.tweens.resumeAll();
      this.fx.forEach((e) => e.start());
      this.simPaused = false;
    }
    let best = 18;
    this.near = null;
    for (const s of this.spots) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, s.x, s.y);
      if (d < best) {
        best = d;
        this.near = s.id;
      }
    }
    const pr = promptFor(this.near);
    if (this.hint) {
      const bob = Math.sin(this.time.now / 220) * 2;
      this.hint.setPosition(this.player.x, this.player.y - 26 + bob);
      this.hint.setText(pr ? `[${pr.key}] ${pr.verb}` : "");
      this.hint.setAlpha(pr ? 1 : 0.35);
    }
    this.hudT += dt;
    const flushHud = this.hudT >= 100;
    if (flushHud) this.hudT = 0;
    if (flushHud) useGame.getState().setPrompt(pr ? `[F] ${pr.verb}` : null);
    const nearPx = 4 * TILE;
    let nearest: (typeof this.nameTags)[number] | null = null;
    let nearestD = nearPx;
    for (const tag of this.nameTags) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, tag.x, tag.y);
      tag.text.setVisible(false);
      if (d < nearestD) {
        nearestD = d;
        nearest = tag;
      }
    }
    const shown: typeof this.nameTags = [];
    if (nearest) shown.push(nearest);
    for (const tag of this.nameTags) {
      if (tag.quest && tag !== nearest) shown.push(tag);
    }
    const usedY = new Set<number>();
    for (const tag of shown) {
      tag.text.setVisible(true);
      let ly = tag.y - 18;
      while ([...usedY].some((uy) => Math.abs(uy - ly) < 8)) ly -= 8;
      usedY.add(ly);
      tag.text.setPosition(tag.x, ly);
    }
    if (flushHud) useGame.getState().setNear(this.near);
    const save = useGame.getState().save;
    if (save) {
      const goal = currentObjective(save);
      const gx = goal.x * TILE + 8;
      const gy = goal.y * TILE + 8;
      const same = goal.zone === this.zone;
      const ang = Math.atan2(gy - this.player.y, gx - this.player.x);
      const view = this.cameras.main.worldView;
      const onscreen = same && view.contains(gx, gy);
      if (flushHud)
        useGame.getState().setObjectiveHud({
          text: goal.text,
          dist: same ? tileDist(this.player.x / TILE, this.player.y / TILE, goal.x, goal.y) : 99,
          angle: ang,
          onscreen,
          tx: same ? goal.x : this.player.x / TILE,
          ty: same ? goal.y : this.player.y / TILE,
        });
      let marker = this.registry.get("obj-mark") as Phaser.GameObjects.Arc | undefined;
      if (same) {
        if (!marker) {
          marker = this.add.circle(gx, gy, 8, 0xff8a1f, 0.35).setDepth(7);
          this.tweens.add({ targets: marker, scale: 1.4, alpha: 0.1, yoyo: true, duration: 500, repeat: -1 });
          this.registry.set("obj-mark", marker);
        }
        marker.setPosition(gx, gy).setVisible(true);
      } else marker?.setVisible(false);
    }
    const psh = this.registry.get("pshadow") as Phaser.GameObjects.Image | undefined;
    psh?.setPosition(this.player.x, this.player.y + 14);
    if (flushHud) {
      useGame.getState().setMinimap({
        cols: ZONES[this.zone].cols,
        rows: ZONES[this.zone].rows,
        walls: ZONES[this.zone].walls,
        px: this.player.x / TILE,
        py: this.player.y / TILE,
        pois: this.spots.map((s) => ({ x: s.x / TILE, y: s.y / TILE, kind: s.id })),
      });
      useGame.getState().setCooldowns({
        atk: Math.max(0, this.player.atkCd),
        skill: Math.max(0, this.player.skillCd),
        ult: Math.max(0, this.player.ultCd),
        roll: Math.max(0, this.player.rollCd),
      });
    }
    const k = this.keys;
    const pad = this.input.gamepad?.pad1;
    let x = 0;
    let y = 0;
    if (k.left.isDown || k.arrowL.isDown) x -= 1;
    if (k.right.isDown || k.arrowR.isDown) x += 1;
    if (k.up.isDown || k.arrowU.isDown) y -= 1;
    if (k.down.isDown || k.arrowD.isDown) y += 1;
    if (pad) {
      x += pad.leftStick.x;
      y += pad.leftStick.y;
    }
    x += this.joy.x;
    y += this.joy.y;
    const just = Phaser.Input.Keyboard.JustDown;
    const padA = !!pad?.A && !this.prevPad.A;
    const padB = !!pad?.B && !this.prevPad.B;
    const padX = !!pad?.X && !this.prevPad.X;
    const padY = !!pad?.Y && !this.prevPad.Y;
    this.prevPad = { A: !!pad?.A, B: !!pad?.B, X: !!pad?.X, Y: !!pad?.Y };
    const look = 22;
    this.cameras.main.setFollowOffset(-x * look, -y * look);
    const liveBoss = this.registry.get("boss") as GearmawBoss | undefined;
    if (flushHud) {
      if (liveBoss && liveBoss.state !== "dead") {
        useGame.getState().setBossHud({ name: "THE GEARMAW", hp: liveBoss.hp, hpMax: liveBoss.hpMax, phase: liveBoss.phase });
      } else useGame.getState().setBossHud(null);
    }
    const nearEnemy = this.enemies.getChildren().some((ch) => {
      const e = ch as Enemy;
      return e.state !== "dead" && Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y) < 70;
    });
    const wantZoom = liveBoss ? 1.12 : nearEnemy ? 1.06 : this.zone === "haven" ? 1 : 0.94;
    this.cameras.main.setZoom(Phaser.Math.Linear(this.cameras.main.zoom, wantZoom, 0.04));
    this.player.tick({
      x,
      y,
      attack: just(k.attack) || this.buttons.attack || this.pending.attack || padA,
      skill: just(k.skill) || this.buttons.skill || this.pending.skill || padX,
      ult: just(k.ult) || this.buttons.ult || this.pending.ult || padY,
      roll: just(k.roll) || just(k.space) || this.buttons.roll || this.pending.roll || padB,
      sprint: k.sprint.isDown || this.buttons.sprint || !!pad?.R1,
      block: useGame.getState().a11y.holdBlock
        ? k.block.isDown || this.buttons.block || this.pending.block
        : just(k.block) || this.buttons.block || this.pending.block,
      dt,
    });
    this.pending.attack = false;
    this.pending.skill = false;
    this.pending.ult = false;
    this.pending.roll = false;
    const napping = useGame.getState().wheel.coreStatus === "IDLE";
    this.enemies.getChildren().forEach((ch) => {
      (ch as Enemy).think(this.player, dt, napping);
    });
    const boss = this.registry.get("boss") as GearmawBoss | undefined;
    boss?.think(this.player, dt, napping);
    this.buttons.attack = false;
    this.buttons.skill = false;
    this.buttons.ult = false;
    this.buttons.roll = false;
    this.pet?.follow(this.player, dt);
    if (this.dbgGfx) {
      this.dbgGfx.clear();
      if (useGame.getState().debugOpen) {
        this.dbgGfx.lineStyle(1, 0x2ee9ff, 0.9);
        const hb = this.player.hitbox;
        this.dbgGfx.strokeRect(hb.x - 12, hb.y - 8, 24, 16);
        this.dbgGfx.lineStyle(1, 0xe4453a, 0.7);
        this.enemies.getChildren().forEach((ch) => {
          const e = ch as Enemy;
          this.dbgGfx!.strokeCircle(e.x, e.y, 10);
        });
      }
    }
  }
}

function reshape(data: number[], cols: number) {
  const rows: number[][] = [];
  for (let i = 0; i < data.length; i += cols) rows.push(data.slice(i, i + cols));
  return rows;
}

export { W, H };
