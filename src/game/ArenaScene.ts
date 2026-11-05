import Phaser from "phaser";
import { Enemy, Player } from "./actors";
import { cancelHitStop, clearFxPools, ejectCasing, failAction, okAction, shake, sparks, trailDot } from "./fx";
import { LEVELS, PICKUPS, TRAIN_STEPS, UPGRADES, WEAPONS, type PickupId, type WeaponId } from "./arena";
import { buildArenaMap, themeFor, THEMES, type ArenaMap, type ArenaTheme } from "./arenaMaps";
import { dir8, resolveAim } from "./aim";
import { flattenWave, spawnOutsideView, takeBatch } from "./chase";
import { capsFor, meter, publishPerf } from "./perf";
import { TILE } from "./palette";
import { bakeTextures } from "./pixels";
import { useGame } from "./store";
import { markSkippedTrain } from "./skipTrain";
import { camCauses, finite, finiteAim, logCam } from "./viewGuard";

export class ArenaScene extends Phaser.Scene {
  mode: "train" | "battle" = "train";
  level = 1;
  wave = 0;
  score = 0;
  combo = 0;
  player!: Player;
  gun!: Phaser.GameObjects.Image;
  muzzle!: Phaser.GameObjects.Image;
  reticle!: Phaser.GameObjects.Image;
  laser!: Phaser.GameObjects.Graphics;
  enemies!: Phaser.Physics.Arcade.Group;
  bullets!: Phaser.Physics.Arcade.Group;
  pickups!: Phaser.Physics.Arcade.Group;
  targets!: Phaser.Physics.Arcade.Group;
  weapon: WeaponId = "pistol";
  ammo = WEAPONS.pistol.ammo;
  fireCd = 0;
  reloadT = 0;
  aim = { x: 1, y: 0 };
  autoAim = false;
  step = 0;
  moved = 0;
  pending = { shoot: false, melee: false, roll: false, ult: false, block: false };
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  hudT = 0;
  simPaused = false;
  live = 0;
  power: { id: PickupId; t: number }[] = [];
  mods = { dmg: 1, rate: 1, clip: 0, speed: 1, surge: 1 };
  instructor?: Phaser.GameObjects.Text;
  gate?: Phaser.GameObjects.Image;
  bossOut = false;
  crates: Phaser.Physics.Arcade.Image[] = [];
  map!: ArenaMap;
  theme: ArenaTheme = "train";
  lastMouse = 0;
  lastPtr = { x: 0, y: 0 };
  moveDir = { x: 1, y: 0 };
  recoil = 0;
  walls!: Phaser.Tilemaps.TilemapLayer;
  doors: { x: number; y: number }[] = [];
  core?: Phaser.GameObjects.Image;
  dummy?: Enemy;
  pendingSpawns = 0;
  spawnQueue: { kind: string; tier: number }[] = [];
  batchT = 0;
  stillT = 0;
  zeroT = 0;
  pressure = 1;
  eShots!: Phaser.Physics.Arcade.Group;
  ptrOver = true;
  squeekGlow?: Phaser.GameObjects.Arc;
  scarf?: Phaser.GameObjects.Rectangle;
  rim?: Phaser.GameObjects.Image;
  slicks: { x: number; y: number }[] = [];
  groundMap?: Phaser.Tilemaps.Tilemap;
  wallMap?: Phaser.Tilemaps.Tilemap;
  groundLayer?: Phaser.Tilemaps.TilemapLayer;
  floorFallback?: Phaser.GameObjects.Graphics;
  vignette?: Phaser.GameObjects.Image;
  glHooked = false;
  mapSeq = 0;
  bootGen = 0;
  constructor() {
    super("arena");
  }
  init(data: { mode?: "train" | "battle"; level?: number }) {
    const save = useGame.getState().save;
    this.mode = data.mode ?? (save?.zone === "battle" ? "battle" : "train");
    this.level = data.level ?? save?.arenaLevel ?? 1;
    this.wave = 0;
    this.score = save?.score ?? 0;
    this.step = 0;
    this.mods = { dmg: 1, rate: 1, clip: 0, speed: 1, surge: 1 };
    this.power = [];
    this.bossOut = false;
    this.crates = [];
    this.slicks = [];
    this.pendingSpawns = 0;
    this.spawnQueue = [];
    this.batchT = 0;
    this.stillT = 0;
    this.zeroT = 0;
    this.pressure = 1;
    this.weapon = (save?.gun as WeaponId) || "pistol";
    this.aim = { x: 1, y: 0 };
    this.autoAim = false;
    this.simPaused = false;
    this.recoil = 0;
    this.combo = 0;
    this.fireCd = 0;
    this.reloadT = 0;
    this.live = 0;
    this.hudT = 0;
    this.moved = 0;
    this.lastMouse = 0;
    this.lastPtr = { x: 0, y: 0 };
    this.moveDir = { x: 1, y: 0 };
    this.pending = { shoot: false, melee: false, roll: false, ult: false, block: false };
    this.gate = undefined;
    this.dummy = undefined;
    this.core = undefined;
    this.instructor = undefined;
    this.squeekGlow = undefined;
    this.scarf = undefined;
    this.rim = undefined;
    this.vignette = undefined;
    this.groundMap = undefined;
    this.wallMap = undefined;
    this.groundLayer = undefined;
    this.floorFallback = undefined;
    this.ammo = WEAPONS[this.weapon].ammo;
    this.data.set("simPaused", false);
  }
  create() {
    const save = useGame.getState().save;
    if (!save) return;
    cancelHitStop(this);
    this.time.timeScale = 1;
    this.tweens.killAll();
    this.destroyMaps();
    this.theme = themeFor(this.mode, this.level);
    this.map = buildArenaMap(this.theme, this.level * 17 + (this.mode === "train" ? 3 : 9));
    const spec = THEMES[this.theme];
    this.cameras.main.setBackgroundColor(spec.bg);
    this.physics.world.setBounds(0, 0, this.map.pxW, this.map.pxH);
    this.paintMap();
    const cx = this.map.pxW / 2;
    const cy = this.map.pxH / 2;
    this.player = new Player(this, cx, cy, save.heroClass === "wanderer" ? "wanderer" : "raider");
    this.player.setData("aimFace", true);
    this.input.setDefaultCursor("none");
    this.game.canvas.style.cursor = "none";
    this.ptrOver = true;
    const onPtrEnter = () => {
      this.ptrOver = true;
    };
    const onPtrLeave = () => {
      this.ptrOver = false;
    };
    this.game.canvas.addEventListener("pointerenter", onPtrEnter);
    this.game.canvas.addEventListener("pointerleave", onPtrLeave);
    const glow = Math.min(10, save.squeekLevel ?? 1);
    this.squeekGlow = this.add.circle(cx, cy, 16, 0x2ee9ff, 0.08 + glow * 0.03).setDepth(11);
    this.scarf = this.add.rectangle(cx, cy, 5, 12, 0xff8a1f, 0.95).setDepth(12);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(12);
    if (this.walls) this.physics.add.collider(this.player, this.walls);
    this.resetView("level-start");
    this.scale.off("resize", this.onScaleResize, this);
    this.scale.on("resize", this.onScaleResize, this);
    this.gun = this.add.image(this.player.x, this.player.y, "gun-pistol").setDepth(13);
    this.gun.setOrigin(0.18, 0.5);
    this.gun.setDisplaySize(28, 12);
    this.muzzle = this.add.image(0, 0, "muzzle").setDepth(14).setVisible(false).setDisplaySize(16, 16);
    this.rim = this.add.image(cx, cy, "hero-rim").setDepth(12).setDisplaySize(18, 18);
    if (this.textures.exists("arena-vignette")) {
      this.vignette = this.add
        .image(this.scale.width / 2, this.scale.height / 2, "arena-vignette")
        .setScrollFactor(0)
        .setDisplaySize(this.scale.width + 8, this.scale.height + 8)
        .setDepth(24)
        .setAlpha(0.55);
    }
    this.reticle = this.add.image(this.player.x + 40, this.player.y, "reticle").setDepth(30).setDisplaySize(12, 12);
    this.laser = this.add.graphics().setDepth(11);
    this.enemies = this.physics.add.group({ maxSize: 80 });
    this.bullets = this.physics.add.group({ maxSize: 80 });
    this.pickups = this.physics.add.group();
    this.targets = this.physics.add.group();
    this.eShots = this.physics.add.group({ maxSize: 40 });
    if (this.walls) this.physics.add.collider(this.enemies, this.walls);
    this.physics.add.overlap(this.eShots, this.player, (b) => {
      this.recycle(b as Phaser.Physics.Arcade.Image, this.eShots);
      this.player.hurt(5, this.player.x);
    });
    this.events.on("wb-eshot", (p: { x: number; y: number; dx: number; dy: number; dmg: number }) => this.enemyShot(p));
    this.events.on("wb-explode", (p: { x: number; y: number; dmg: number }) => {
      this.aoe(p.x, p.y, 32, p.dmg);
      shake(this, 80, 0.01);
    });
    this.physics.add.overlap(this.bullets, this.enemies, (b, e) => this.hitShot(b as Phaser.Physics.Arcade.Image, e as Enemy));
    this.physics.add.overlap(this.bullets, this.targets, (b, t) => {
      this.recycle(b as Phaser.Physics.Arcade.Image);
      const img = t as Phaser.Physics.Arcade.Image;
      img.setData("hp", Number(img.getData("hp") || 2) - 1);
      sparks(this, img.x, img.y, 0xff8a1f);
      if (Number(img.getData("hp")) <= 0) {
        img.destroy();
        if (this.mode === "train" && TRAIN_STEPS[this.step]?.id === "shoot") this.advance();
      }
    });
    this.physics.add.overlap(this.player, this.pickups, (_p, pk) => this.grab(pk as Phaser.Physics.Arcade.Image));
    this.physics.add.overlap(this.player.hitbox, this.enemies, (_h, e) => {
      const en = e as Enemy;
      if (en.state === "dead") return;
      en.takeHit(Number(this.player.getData("dmg") || 8), this.player);
      (this.player.hitbox.body as Phaser.Physics.Arcade.Body).enable = false;
    });
    const kb = this.input.keyboard!;
    this.keys = {
      left: kb.addKey("A"),
      right: kb.addKey("D"),
      up: kb.addKey("W"),
      down: kb.addKey("S"),
      shoot: kb.addKey("J"),
      melee: kb.addKey("K"),
      ult: kb.addKey("L"),
      roll: kb.addKey("SPACE"),
      block: kb.addKey("H"),
      reload: kb.addKey("R"),
    };
    const onDown = (ev: KeyboardEvent) => {
      if (ev.repeat) return;
      if (ev.code === "KeyJ") this.pending.shoot = true;
      if (ev.code === "KeyK") this.pending.melee = true;
      if (ev.code === "KeyL") this.pending.ult = true;
      if (ev.code === "Space") this.pending.roll = true;
      if (ev.code === "KeyH") this.pending.block = true;
      if (ev.code === "Digit1") this.swap("pistol");
      if (ev.code === "Digit2") this.swap("shotgun");
      if (ev.code === "Digit3") this.swap("rifle");
      if (ev.code === "Digit4") this.swap("launcher");
      if (ev.code === "Digit5") this.swap("coil");
      if (ev.code === "KeyQ") this.cycle(-1);
      if (ev.code === "KeyE") this.cycle(1);
      if (ev.code === "F3") useGame.setState({ fpsOpen: !useGame.getState().fpsOpen });
      if (ev.code === "Tab") ev.preventDefault();
      if (ev.code === "F9" || ev.code === "Tab" || ev.code === "KeyN") this.skipTrain();
      if (ev.code === "Escape") {
        const ov = useGame.getState().overlay;
        if (ov === "skip") {
          useGame.getState().setOverlay("none");
          return;
        }
        useGame.getState().setOverlay(ov === "none" ? "pause" : "none");
      }
      if (ev.code === "KeyI") useGame.getState().setOverlay("inventory");
      if (ev.code === "KeyU") useGame.getState().setOverlay("skills");
      if (ev.code === "F1") useGame.getState().setOverlay("help");
    };
    const onUp = (ev: KeyboardEvent) => {
      if (ev.code === "KeyH") this.pending.block = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    this.input.on("pointerdown", () => {
      this.pending.shoot = true;
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (Math.hypot(p.x - this.lastPtr.x, p.y - this.lastPtr.y) > 2) this.lastMouse = this.time.now;
      this.lastPtr = { x: p.x, y: p.y };
    });
    const onRestart = (ev: Event) => {
      const z = (ev as CustomEvent<string>).detail;
      if (z === "arena" || z === "battle") this.scene.restart({ mode: z === "battle" ? "battle" : "train", level: useGame.getState().save?.arenaLevel ?? 1 });
      else this.scene.start("world", { zone: z });
    };
    window.addEventListener("wb-restart", onRestart);
    this.hookWebGl();
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.watchdog() });
    this.events.once("shutdown", () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("wb-restart", onRestart);
      this.game.canvas.removeEventListener("pointerenter", onPtrEnter);
      this.game.canvas.removeEventListener("pointerleave", onPtrLeave);
      this.scale.off("resize", this.onScaleResize, this);
      this.events.off("wb-eshot");
      this.events.off("wb-explode");
      cancelHitStop(this);
      this.time.timeScale = 1;
      this.tweens.killAll();
      clearFxPools(this);
      this.destroyMaps();
    });
    this.instructor = this.add
      .text(this.scale.width / 2, 28, "", {
        fontFamily: '"Press Start 2P"',
        fontSize: "6px",
        color: "#2ee9ff",
        stroke: "#070b1a",
        strokeThickness: 3,
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(40);
    this.bootGen += 1;
    this.bindWb();
    this.placeProps();
    if (this.mode === "train") this.setupTrain();
    else this.nextWave();
    if (save.flags.perf) {
      this.mode = "battle";
      this.level = 5;
      for (let i = 0; i < 80; i++) this.spawn("mite", 0);
      meter.reset();
    }
    useGame.getState().setZoneName(spec.name);
    useGame.getState().setZoneBanner(`${spec.name.toUpperCase()}  -  ${spec.threat}`);
    this.time.delayedCall(1800, () => useGame.getState().setZoneBanner(null));
    this.ammo = WEAPONS[this.weapon].ammo + this.mods.clip;
    this.publishMini();
  }
  bindWb() {
    (window as unknown as { __WB: object }).__WB = {
      zone: (z: string) => {
        useGame.getState().patch({ zone: z as never });
        this.scene.start(z === "arena" || z === "battle" ? "arena" : "world", { zone: z });
      },
      overlay: (o: string) => {
        if (o === "none") useGame.getState().setDialogue(null);
        useGame.getState().setOverlay(o as never);
      },
      scene: this,
      bootGen: this.bootGen,
      warp: (x: number, y: number) => this.player.setPosition(x, y),
      hurt: (n: number) => this.player.hurt(n, this.player.x + 8),
      sta: (n: number) => useGame.getState().patch({ stamina: n }),
      skipTut: () => this.skipTrain(),
      skipTrain: () => this.skipTrain(),
      confirmSkip: () => this.confirmSkip(),
      swap: (id: WeaponId) => this.swap(id),
      spawnMix: (n: number) => {
        const kinds = ["mite", "slime", "spark", "brute", "wasp"] as const;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const r = 48 + (i % 3) * 18;
          this.spawn(kinds[i % kinds.length], i % 5 === 0 ? 2 : 0, this.player.x + Math.cos(a) * r, this.player.y + Math.sin(a) * r * 0.75);
        }
        meter.reset();
      },
      face: () => ({
        flipX: this.player.flipX,
        gunFlipY: this.gun.flipY,
        gunRot: this.gun.rotation,
        dir8: this.player.getData("dir8") ?? dir8(this.aim.x, this.aim.y),
        facing: this.player.facing,
      }),
      startBattle: (level = 1) => {
        this.mode = "battle";
        this.level = level;
        this.wave = 0;
        this.bossOut = false;
        this.scene.restart({ mode: "battle", level });
      },
      spawnN: (n: number) => {
        for (let i = 0; i < n; i++) this.spawn("mite", 0);
        meter.reset();
      },
      pickUpgrade: (id: string) => this.applyUpgrade(id),
      killAll: () => {
        this.enemies.getChildren().forEach((ch) => (ch as Enemy).takeHit(999, this.player));
        this.targets.getChildren().forEach((t) => (t as Phaser.GameObjects.GameObject).destroy());
      },
      win: () => useGame.getState().setOverlay("victory"),
      dummy: () => this.dummy,
      gun: () => ({
        rot: this.gun.rotation,
        x: this.gun.x,
        y: this.gun.y,
        flipY: this.gun.flipY,
        tex: this.gun.texture.key,
        w: this.gun.displayWidth,
        visible: this.gun.visible,
        aimX: this.aim.x,
        aimY: this.aim.y,
      }),
      nearestDist: () => {
        let d = 9999;
        this.enemies.getChildren().forEach((ch) => {
          const e = ch as Enemy;
          if (e.state === "dead" || e.getData("dummy")) return;
          d = Math.min(d, Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y));
        });
        return d;
      },
      dummyInView: () => {
        if (!this.dummy) return false;
        const v = this.cameras.main.worldView;
        return Boolean(this.dummy.visible && this.dummy.alpha > 0 && this.dummy.depth >= 8 && v.contains(this.dummy.x, this.dummy.y));
      },
      sprites: () => ({
        dummy: Boolean(this.dummy?.visible && this.dummy.alpha > 0),
        targets: this.targets.countActive(true),
        drones: this.enemies.getChildren().filter((ch) => (ch as Enemy).getData("drone")).length,
        gun: this.gun.visible,
        reticle: this.reticle.visible,
      }),
      keepAlive: () => {
        const s = useGame.getState().save;
        if (s) useGame.getState().patch({ hp: s.hpMax });
      },
      setAim: (m: "mouse" | "auto" | "assist" | "hybrid") =>
        useGame.getState().setAimMode(m === "hybrid" ? "mouse" : m),
      perf: () => (window as unknown as { __WB_PERF?: object }).__WB_PERF,
      cam: () => this.camSnap(),
      forceLevel: (n: number) => {
        this.mode = "battle";
        this.level = n;
        this.wave = 0;
        this.bossOut = false;
        this.scene.restart({ mode: "battle", level: n });
      },
      nextLevel: () => this.applyUpgrade("dmg"),
      resetView: () => this.resetView("qa"),
      burstCombat: () => {
        const kinds = ["mite", "slime", "spark", "brute", "wasp"] as const;
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          this.spawn(kinds[i % kinds.length], i % 3 === 0 ? 2 : 1, this.player.x + Math.cos(a) * 52, this.player.y + Math.sin(a) * 40);
        }
        this.player.setData("crit", true);
        this.enemies.getChildren().forEach((ch, i) => {
          if (i % 2 === 0) (ch as Enemy).takeHit(24, this.player);
        });
        this.player.setData("crit", false);
      },
      loseGl: () => {
        const gl = (this.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).gl;
        const ext = gl.getExtension("WEBGL_lose_context");
        this.data.set("glLose", ext);
        ext?.loseContext();
      },
      restoreGl: () => {
        const ext = this.data.get("glLose") as { restoreContext?: () => void } | undefined;
        try {
          ext?.restoreContext?.();
        } catch (err) {
          console.warn("[WB-GL] restoreContext failed", err);
        }
        window.setTimeout(() => {
          if (this.sys.isActive()) this.rebuildAfterGl();
        }, 200);
      },
    };
  }
  onScaleResize(gs: Phaser.Structs.Size) {
    this.cameras.main.setSize(gs.width, gs.height);
    this.vignette?.setPosition(gs.width / 2, gs.height / 2).setDisplaySize(gs.width + 8, gs.height + 8);
  }
  camSnap() {
    const cam = this.cameras.main;
    const v = cam.worldView;
    return {
      scrollX: cam.scrollX,
      scrollY: cam.scrollY,
      zoom: cam.zoom,
      alpha: cam.alpha,
      px: this.player?.x ?? 0,
      py: this.player?.y ?? 0,
      viewX: v.x,
      viewY: v.y,
      viewW: v.width,
      viewH: v.height,
      level: this.level,
      theme: this.theme,
      nan: [cam.scrollX, cam.scrollY, cam.zoom, cam.alpha, this.player?.x, this.player?.y].some((n) => typeof n === "number" && !Number.isFinite(n)),
      ground: Boolean(this.groundLayer?.visible && (this.groundLayer?.alpha ?? 0) > 0.2),
    };
  }
  resetView(reason = "reset") {
    const cam = this.cameras.main;
    cam.resetFX();
    cam.setAlpha(1);
    cam.setZoom(1);
    cam.setRotation(0);
    cam.setSize(this.scale.width, this.scale.height);
    cam.roundPixels = true;
    cam.setFollowOffset(0, 0);
    if (this.map) {
      cam.setBackgroundColor(THEMES[this.theme].bg);
      cam.setBounds(0, 0, this.map.pxW, this.map.pxH);
      this.physics.world.setBounds(0, 0, this.map.pxW, this.map.pxH);
    }
    if (this.player) {
      const x = finite(this.player.x, this.map.pxW / 2);
      const y = finite(this.player.y, this.map.pxH / 2);
      this.player.setPosition(x, y);
      cam.centerOn(x, y);
      cam.startFollow(this.player, true, 0.14, 0.14);
    }
    this.time.timeScale = 1;
    if (this.physics.world.isPaused && !this.simPaused && !this.data.get("hitStop")) this.physics.world.resume();
    this.groundLayer?.setVisible(true).setAlpha(1).setDepth(0);
    this.walls?.setVisible(true).setAlpha(1).setDepth(2);
    this.floorFallback?.setVisible(true).setAlpha(1).setDepth(0);
    logCam(reason, this.camSnap());
  }
  watchdog() {
    if (!this.sys.isActive() || !this.player) return;
    const snap = this.camSnap();
    let causes = camCauses({
      scrollX: snap.scrollX,
      scrollY: snap.scrollY,
      zoom: snap.zoom,
      alpha: snap.alpha,
      px: snap.px,
      py: snap.py,
      viewX: snap.viewX,
      viewY: snap.viewY,
      viewW: snap.viewW,
      viewH: snap.viewH,
      groundHidden: this.groundLayer ? !this.groundLayer.visible : false,
      groundAlpha: this.groundLayer?.alpha,
    });
    if (this.mode !== "battle") {
      causes = causes.filter((c) => !c.startsWith("player-outside-view"));
    }
    if (!causes.length) return;
    console.warn("[WB-WATCHDOG]", causes.join("; "));
    this.resetView("watchdog");
  }
  hookWebGl() {
    if (this.glHooked) return;
    this.glHooked = true;
    const canvas = this.game.canvas;
    canvas.addEventListener("webglcontextlost", (ev) => {
      ev.preventDefault();
      console.warn("[WB-GL] context lost");
    });
    canvas.addEventListener("webglcontextrestored", () => {
      console.warn("[WB-GL] context restored, rebaking atlas");
      this.rebuildAfterGl();
    });
  }
  rebuildAfterGl() {
    try {
      bakeTextures(this);
      this.refreshCanvasTextures();
    } catch (err) {
      console.warn("[WB-GL] rebake failed", err);
    }
    if (this.sys.isActive()) this.scene.restart({ mode: this.mode, level: this.level });
  }
  refreshCanvasTextures() {
    for (const key of this.textures.getTextureKeys()) {
      const tex = this.textures.get(key);
      if (tex && typeof (tex as Phaser.Textures.CanvasTexture).refresh === "function") {
        try {
          (tex as Phaser.Textures.CanvasTexture).refresh();
        } catch {
          /* not a canvas texture */
        }
      }
    }
  }
  destroyMaps() {
    const gm = this.groundMap;
    const wm = this.wallMap;
    this.groundMap = undefined;
    this.wallMap = undefined;
    this.groundLayer = undefined;
    this.floorFallback?.destroy();
    this.floorFallback = undefined;
    try {
      gm?.destroy();
    } catch {
      /* already destroyed with the scene */
    }
    try {
      wm?.destroy();
    } catch {
      /* already destroyed with the scene */
    }
    this.walls = undefined as unknown as Phaser.Tilemaps.TilemapLayer;
    for (const key of ["arena-ground", "arena-walls"]) {
      if (this.cache.tilemap.exists(key)) this.cache.tilemap.remove(key);
    }
    for (let i = Math.max(0, this.mapSeq - 4); i <= this.mapSeq; i++) {
      const gk = `arena-ground-${i}`;
      const wk = `arena-walls-${i}`;
      if (this.cache.tilemap.exists(gk)) this.cache.tilemap.remove(gk);
      if (this.cache.tilemap.exists(wk)) this.cache.tilemap.remove(wk);
    }
  }
  paintMap() {
    this.destroyMaps();
    this.refreshCanvasTextures();
    if (!this.textures.exists("arena-tiles")) {
      console.warn("[WB-FLOOR] arena-tiles missing; rebaking");
      bakeTextures(this);
    }
    this.mapSeq += 1;
    const gKey = `arena-ground-${this.mapSeq}`;
    const wKey = `arena-walls-${this.mapSeq}`;
    const data: number[][] = [];
    for (let y = 0; y < this.map.rows; y++) data.push(this.map.ground.slice(y * this.map.cols, (y + 1) * this.map.cols));
    const wdata: number[][] = [];
    for (let y = 0; y < this.map.rows; y++) {
      wdata.push(
        this.map.walls.slice(y * this.map.cols, (y + 1) * this.map.cols).map((v) => (v ? 8 : -1)),
      );
    }
    if (!this.textures.exists("arena-tiles")) {
      console.warn("[WB-FLOOR] arena-tiles still missing; drawing fallback floor");
      const g = this.add.graphics().setDepth(0);
      g.fillStyle(THEMES[this.theme].bg, 1);
      g.fillRect(0, 0, this.map.pxW, this.map.pxH);
      g.lineStyle(2, THEMES[this.theme].accent, 0.45);
      for (let x = 0; x < this.map.pxW; x += TILE) g.lineBetween(x, 0, x, this.map.pxH);
      for (let y = 0; y < this.map.pxH; y += TILE) g.lineBetween(0, y, this.map.pxW, y);
      this.floorFallback = g;
    }
    const tm = this.make.tilemap({ key: gKey, data, tileWidth: TILE, tileHeight: TILE });
    this.groundMap = tm;
    if (this.textures.exists("arena-tiles")) {
      const ts = tm.addTilesetImage("arena-tiles", "arena-tiles", TILE, TILE, 0, 0);
      if (!ts) {
        console.warn("[WB-FLOOR] addTilesetImage failed; drawing fallback floor");
        this.floorFallback = this.add.graphics().setDepth(0);
        this.floorFallback.fillStyle(THEMES[this.theme].bg, 1);
        this.floorFallback.fillRect(0, 0, this.map.pxW, this.map.pxH);
      } else {
        this.groundLayer = tm.createLayer(0, ts, 0, 0)!;
        this.groundLayer.setDepth(0).setVisible(true).setAlpha(1);
      }
    }
    const wm = this.make.tilemap({ key: wKey, data: wdata, tileWidth: TILE, tileHeight: TILE });
    this.wallMap = wm;
    if (this.textures.exists("arena-tiles")) {
      const wts = wm.addTilesetImage("arena-tiles", "arena-tiles", TILE, TILE, 0, 0)!;
      this.walls = wm.createLayer(0, wts, 0, 0)!;
      this.walls.setCollisionByExclusion([-1]);
      this.walls.setDepth(2).setVisible(true).setAlpha(1);
    } else {
      try {
        this.walls = wm.createBlankLayer("walls", [], 0, 0, this.map.cols, this.map.rows, TILE, TILE)!;
      } catch {
        this.walls = undefined as unknown as Phaser.Tilemaps.TilemapLayer;
      }
    }
    this.doors = this.map.doors;
    if (this.textures.exists("arena-tiles")) {
      this.core = this.add.image(this.map.pxW / 2, this.map.pxH / 2, "arena-tiles", 14).setDepth(1).setDisplaySize(28, 28);
      this.tweens.add({ targets: this.core, angle: 360, duration: 8000, repeat: -1 });
    }
    const cap = capsFor(useGame.getState().quality, meter.autoTier);
    if (cap.particles > 8 && this.textures.exists("dust")) {
      this.add.particles(0, 0, "dust", {
        x: { min: 0, max: this.map.pxW },
        y: { min: 0, max: this.map.pxH },
        lifespan: 2200,
        speedY: { min: -8, max: -2 },
        quantity: 1,
        frequency: 420,
        alpha: { start: 0.35, end: 0 },
        scale: { start: 0.6, end: 0.1 },
      });
    }
  }
  placeProps() {
    for (const pr of this.map.props) {
      if (pr.kind === "crate" || pr.kind === "barrel") this.crate(pr.x, pr.y, pr.kind === "barrel");
      if (pr.kind === "lamp") {
        const lamp = this.add.circle(pr.x, pr.y, 10, 0xffcc66, 0.22).setDepth(3);
        this.tweens.add({ targets: lamp, alpha: 0.08, yoyo: true, duration: 420 + Math.random() * 200, repeat: -1 });
      }
      if (pr.kind === "pillar" || pr.kind === "pipe" || pr.kind === "fence" || pr.kind === "wheel") {
        const frame = pr.kind === "pillar" ? 10 : pr.kind === "pipe" ? 8 : pr.kind === "wheel" ? 11 : 9;
        const p = this.physics.add.staticImage(pr.x, pr.y, "arena-tiles", frame);
        p.setDisplaySize(pr.kind === "fence" ? 16 : 14, pr.kind === "pipe" ? 20 : 14);
        this.physics.add.collider(this.player, p);
        this.physics.add.collider(this.enemies, p);
      }
      if (pr.kind === "vent") {
        const v = this.add.circle(pr.x, pr.y, 8, 0xa8b2c4, 0.28).setDepth(3);
        this.tweens.add({ targets: v, scale: 1.8, alpha: 0.04, yoyo: true, duration: 900, repeat: -1 });
      }
      if (pr.kind === "slick") {
        this.add.ellipse(pr.x, pr.y, 26, 14, 0x0a1210, 0.62).setDepth(1);
        this.slicks.push({ x: pr.x, y: pr.y });
      }
      if (pr.kind === "volt") {
        const v = this.add.rectangle(pr.x, pr.y, 16, 16, 0xb56cff, 0.28).setDepth(1);
        this.tweens.add({ targets: v, alpha: 0.06, yoyo: true, duration: 380, repeat: -1 });
      }
      if (pr.kind === "convey") this.add.rectangle(pr.x, pr.y, 36, 12, 0x3a3a3a, 0.85).setDepth(1);
    }
  }
  setupTrain() {
    const cx = this.map.pxW / 2;
    const cy = this.map.pxH / 2;
    this.dummy = new Enemy(this, cx + 56, cy, "dummy", 0);
    this.dummy.setDepth(12);
    this.dummy.setDisplaySize(28, 36);
    this.dummy.setVisible(true);
    this.enemies.add(this.dummy);
    const fighter = new Enemy(this, cx + 90, cy + 36, "dummy", 1);
    fighter.setData("fighter", true);
    fighter.setTint(0xff8866);
    fighter.setDepth(12);
    this.enemies.add(fighter);
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2;
      const t = this.physics.add.image(cx + Math.cos(ang) * 70, cy + Math.sin(ang) * 50, "target");
      t.setData("hp", 2);
      t.setDepth(11);
      t.setDisplaySize(16, 20);
      this.targets.add(t);
      this.tweens.add({ targets: t, y: t.y - 6, yoyo: true, duration: 500 + i * 80, repeat: -1 });
    }
    for (let i = 0; i < 3; i++) {
      const d = new Enemy(this, cx - 80 + i * 20, cy - 70, "wasp", 0);
      d.setData("drone", true);
      d.setDepth(12);
      this.enemies.add(d);
    }
    this.drop("health", cx - 70, cy + 40);
    this.instructor?.setText(TRAIN_STEPS[0]!.text);
  }
  crate(x: number, y: number, boom = false) {
    const tex = boom && this.textures.exists("prop-barrel") ? "prop-barrel" : this.textures.exists("prop-crate") ? "prop-crate" : "arena-tiles";
    const img = tex === "arena-tiles" ? this.physics.add.staticImage(x, y, tex, boom ? 5 : 7) : this.physics.add.staticImage(x, y, tex);
    img.setData("crate", true);
    img.setData("boom", boom);
    img.setDisplaySize(14, 14);
    img.setDepth(8);
    img.refreshBody();
    this.crates.push(img);
    this.physics.add.collider(this.player, img);
    this.physics.add.collider(this.enemies, img);
    this.physics.add.overlap(this.bullets, img, (b) => this.breakCrate(img, b as Phaser.Physics.Arcade.Image));
  }
  breakCrate(img: Phaser.Physics.Arcade.Image, bullet?: Phaser.Physics.Arcade.Image) {
    if (!img.active) return;
    const x = img.x;
    const y = img.y;
    const boom = !!img.getData("boom");
    img.destroy();
    if (bullet) this.recycle(bullet);
    sparks(this, x, y, boom ? 0xe4453a : 0xc4a06a);
    if (boom) {
      this.aoe(x, y, 32, 12);
      shake(this, 80, 0.008);
    }
    this.drop(Math.random() > 0.5 ? "ammo" : "health", x, y);
  }
  skipTrain() {
    if (this.mode !== "train") return;
    if (useGame.getState().overlay === "skip") return;
    useGame.getState().setOverlay("skip");
  }
  confirmSkip() {
    markSkippedTrain();
    useGame.getState().patch({ zone: "battle", arenaLevel: 1, score: 0 });
    useGame.getState().setOverlay("none");
    this.scene.restart({ mode: "battle", level: 1 });
  }
  swap(id: WeaponId) {
    const owned = useGame.getState().save?.guns ?? ["pistol"];
    if (!owned.includes(id)) {
      failAction(this, this.player.x, this.player.y, "1-5", "swap", "Weapon locked");
      return;
    }
    this.weapon = id;
    this.ammo = WEAPONS[id].ammo + this.mods.clip;
    this.reloadT = 0;
    const tex = `gun-${id}`;
    if (this.textures.exists(tex)) this.gun.setTexture(tex);
    this.tweens.add({ targets: this.gun, scaleY: 0.4, yoyo: true, duration: 80 });
    okAction("1-5", "swap");
    useGame.getState().setToast(WEAPONS[id].name);
  }
  cycle(dir: number) {
    const owned = (useGame.getState().save?.guns ?? ["pistol"]) as WeaponId[];
    const i = Math.max(0, owned.indexOf(this.weapon));
    this.swap(owned[(i + dir + owned.length) % owned.length]!);
  }
  nextWave() {
    const spec = LEVELS[this.level - 1];
    if (!spec) {
      useGame.getState().setOverlay("victory");
      return;
    }
    if (this.spawnQueue.length || this.pendingSpawns > 0) return;
    if (this.wave >= spec.waves.length) {
      if (this.level >= 5) {
        if (this.bossOut) {
          const s = useGame.getState().save!;
          useGame.getState().patch({ bestScore: Math.max(s.bestScore ?? 0, this.score), score: this.score, flags: { ...s.flags, gearmaw: true } });
          useGame.getState().setOverlay("victory");
          return;
        }
        this.spawnBoss();
        return;
      }
      useGame.setState({ overlay: "upgrade", inputMode: "menu" });
      useGame.getState().setToast("WAVE CLEAR");
      return;
    }
    this.spawnQueue = flattenWave(spec.waves[this.wave]!);
    this.wave += 1;
    this.batchT = 9999;
    this.zeroT = 0;
    useGame.getState().setToast(`${spec.name} - WAVE ${this.wave}/${spec.waves.length}`);
  }
  flushBatch() {
    if (!this.spawnQueue.length) return;
    const n = 2 + (this.level > 2 ? 1 : 0);
    const { batch, rest } = takeBatch(this.spawnQueue, n);
    this.spawnQueue = rest;
    batch.forEach((j) => this.spawnPortal(j.kind, j.tier));
    this.batchT = 0;
  }
  spawnPortal(kind: string, tier: number) {
    const view = this.cameras.main.worldView;
    const p = spawnOutsideView({ x: view.x, y: view.y, width: view.width, height: view.height }, { w: this.map.pxW, h: this.map.pxH });
    const ring = this.add.image(p.x, p.y, "portal").setDepth(9).setDisplaySize(22, 22);
    this.pendingSpawns += 1;
    this.tweens.add({ targets: ring, angle: 180, alpha: 0.2, duration: 420, onComplete: () => ring.destroy() });
    this.time.delayedCall(420, () => {
      this.spawn(kind, tier, p.x, p.y);
      this.pendingSpawns = Math.max(0, this.pendingSpawns - 1);
    });
  }
  enemyShot(p: { x: number; y: number; dx: number; dy: number; dmg: number }) {
    const len = Math.hypot(p.dx, p.dy) || 1;
    const b = this.eShots.get(p.x, p.y, this.textures.exists("orb") ? "orb" : "muzzle") as Phaser.Physics.Arcade.Image | null;
    if (!b) return;
    b.setActive(true).setVisible(true).setDepth(15).setTint(0xe4453a).setDisplaySize(7, 5);
    if (b.body) b.body.enable = true;
    b.setData("dmg", p.dmg);
    (b.body as Phaser.Physics.Arcade.Body | null)?.setVelocity((p.dx / len) * 160, (p.dy / len) * 160);
    this.time.delayedCall(900, () => this.recycle(b, this.eShots));
  }
  spawnBoss() {
    if (this.bossOut) return;
    this.bossOut = true;
    const b = new Enemy(this, this.map.pxW / 2, 80, "brute", 6);
    b.hp = b.hpMax = 220;
    b.setDisplaySize(48, 48);
    b.setData("boss", true);
    b.setDepth(12);
    this.enemies.add(b);
  }
  spawn(kind: string, tier: number, x?: number, y?: number) {
    const cap = capsFor(useGame.getState().quality, meter.autoTier).enemyCap;
    if (this.enemies.countActive(true) >= cap) return;
    const placed = x != null && y != null;
    const p = placed ? { x, y } : this.doors[Math.floor(Math.random() * this.doors.length)] ?? { x: 48, y: 48 };
    if (!placed && Phaser.Math.Distance.Between(p.x, p.y, this.player.x, this.player.y) < 50) {
      p.x = this.map.pxW - p.x;
      p.y = this.map.pxH - p.y;
    }
    const k = (kind === "bomber" ? "spark" : kind) as "mite";
    const e = new Enemy(this, p.x, p.y, k, tier);
    if (kind === "bomber") {
      e.setTint(0xff6644);
      e.setData("bomber", true);
    }
    if (tier >= 2) e.setScale(1.15);
    e.setDepth(12);
    e.setVisible(true);
    this.enemies.add(e);
  }
  drop(id: PickupId, x: number, y: number) {
    const img = this.physics.add.image(x, y, "coin");
    img.setData("pick", id);
    img.setTint(Number((PICKUPS[id].color || "#ff8a1f").replace("#", "0x")));
    img.setDepth(9);
    img.setDisplaySize(12, 12);
    const rim = this.add.circle(x, y, 9, 0xffffff, 0.16).setDepth(8);
    img.setData("rim", rim);
    this.pickups.add(img);
    this.tweens.add({ targets: img, y: y - 4, yoyo: true, duration: 400, repeat: -1 });
    const lab = this.add.text(x, y - 12, PICKUPS[id].label, { fontFamily: '"Press Start 2P"', fontSize: "5px", color: PICKUPS[id].color }).setOrigin(0.5).setDepth(20);
    img.setData("lab", lab);
  }
  grab(img: Phaser.Physics.Arcade.Image) {
    const id = img.getData("pick") as PickupId;
    const s = useGame.getState().save!;
    if (id === "health") useGame.getState().patch({ hp: Math.min(s.hpMax, s.hp + 16) });
    else if (id === "ammo") this.ammo = WEAPONS[this.weapon].ammo + this.mods.clip;
    else if (id === "charge") useGame.getState().patch({ wheelCharge: Math.min(100, s.wheelCharge + 40) });
    else if (id === "nuke") {
      this.enemies.getChildren().forEach((ch) => (ch as Enemy).takeHit(40, this.player));
      shake(this, 120, 0.01);
    } else {
      const def = PICKUPS[id];
      this.power = this.power.filter((p) => p.id !== id);
      this.power.push({ id, t: def.ms });
    }
    (img.getData("lab") as Phaser.GameObjects.Text | undefined)?.destroy();
    (img.getData("rim") as Phaser.GameObjects.Arc | undefined)?.destroy();
    okAction("pickup", id);
    if (this.mode === "train" && TRAIN_STEPS[this.step]?.id === "pickup") this.advance();
    img.destroy();
  }
  advance() {
    this.step = Math.min(this.step + 1, TRAIN_STEPS.length);
    const cur = TRAIN_STEPS[this.step];
    this.instructor?.setText(cur ? cur.text : "ENTER THE BATTLEFIELD");
    if (this.step >= TRAIN_STEPS.length) this.openGate();
  }
  openGate() {
    if (this.gate) return;
    const door = this.doors[1] ?? { x: this.map.pxW / 2, y: 40 };
    this.gate = this.add.image(door.x, door.y, "portal").setDepth(10).setDisplaySize(36, 36);
    this.tweens.add({ targets: this.gate, scale: 1.3, alpha: 0.5, yoyo: true, duration: 280, repeat: -1 });
    this.add
      .text(door.x, door.y - 22, "ENTER THE BATTLEFIELD", {
        fontFamily: '"Press Start 2P"',
        fontSize: "6px",
        color: "#ff8a1f",
        stroke: "#070b1a",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.instructor?.setText("Walk into the gate");
    this.cameras.main.stopFollow();
    this.cameras.main.pan(door.x, door.y, 500);
    this.time.delayedCall(1600, () => {
      if (!this.sys.isActive() || !this.player) return;
      this.cameras.main.startFollow(this.player, true, 0.14, 0.14);
    });
  }
  hitShot(bullet: Phaser.Physics.Arcade.Image, en: Enemy) {
    if (en.state === "dead") return;
    const dmg = Number(bullet.getData("dmg") || 4);
    en.takeHit(dmg, this.player);
    this.combo += 1;
    this.score += 10 * Math.max(1, this.combo);
    const expl = WEAPONS[this.weapon].explode;
    if (expl) this.aoe(bullet.x, bullet.y, expl, dmg);
    this.recycle(bullet);
    if (this.mode === "train" && TRAIN_STEPS[this.step]?.id === "shoot") this.advance();
  }
  shoot() {
    const w = WEAPONS[this.weapon];
    if (this.reloadT > 0) return;
    if (this.fireCd > 0) return;
    if (this.ammo <= 0) {
      this.reloadT = w.reload;
      failAction(this, this.player.x, this.player.y, "J", "shoot", "Reloading");
      this.tweens.add({ targets: this.gun, angle: this.gun.angle + 25, yoyo: true, duration: w.reload / 2 });
      return;
    }
    const rapid = this.power.some((p) => p.id === "rapid");
    const dmgMul = (this.power.some((p) => p.id === "damage") ? 2 : 1) * this.mods.dmg;
    this.fireCd = w.rate / this.mods.rate / (rapid ? 1.6 : 1);
    this.ammo -= 1;
    const ang = Math.atan2(this.aim.y, this.aim.x);
    const dmg = Math.round(w.dmg * dmgMul);
    const bx = this.player.x + this.aim.x * 16;
    const by = this.player.y + this.aim.y * 10;
    this.recoil = 6;
    this.muzzle.setPosition(bx + this.aim.x * 10, by + this.aim.y * 7).setVisible(true).setRotation(ang).setAlpha(1);
    this.time.delayedCall(55, () => this.muzzle.setVisible(false));
    if (Number.isFinite(this.aim.x) && Number.isFinite(this.aim.y) && Number.isFinite(this.cameras.main.scrollX)) {
      this.cameras.main.scrollX -= this.aim.x * 1.6;
      this.cameras.main.scrollY -= this.aim.y * 1.4;
    }
    shake(this, 22, 0.0014);
    ejectCasing(this, this.player.x, this.player.y + 2, this.aim.x, this.aim.y);
    const tint: Record<string, number> = { pistol: 0xffcc66, shotgun: 0xf0ddb4, rifle: 0x2ee9ff, launcher: 0xff6644, coil: 0x9ef6ff };
    const col = tint[this.weapon] ?? 0xffcc66;
    if (w.beam) {
      const beam = this.add.rectangle(bx + this.aim.x * 40, by + this.aim.y * 40, 90, 3, 0x2ee9ff, 0.85).setDepth(16);
      beam.setRotation(ang);
      this.time.delayedCall(80, () => beam.destroy());
      this.aoe(this.player.x + this.aim.x * 50, this.player.y + this.aim.y * 50, 28, dmg);
    } else {
      const cap = capsFor(useGame.getState().quality, meter.autoTier).bulletCap;
      const key = this.textures.exists(`bullet-${this.weapon}`) ? `bullet-${this.weapon}` : w.explode ? "orb" : "muzzle";
      for (let i = 0; i < w.pellets; i++) {
        if (this.bullets.countActive(true) >= cap) break;
        const spr = this.aim.x + (Math.random() - 0.5) * w.spread * 2;
        const spy = this.aim.y + (Math.random() - 0.5) * w.spread * 2;
        const len = Math.hypot(spr, spy) || 1;
        const b = this.bullets.get(bx, by, key) as Phaser.Physics.Arcade.Image | null;
        if (!b) break;
        b.setTexture(key);
        b.setActive(true).setVisible(true).setDepth(15).clearTint().setTint(col).setDisplaySize(10, 5).setRotation(ang);
        if (b.body) b.body.enable = true;
        b.setData("dmg", dmg);
        b.setData("col", col);
        (b.body as Phaser.Physics.Arcade.Body | null)?.setVelocity((spr / len) * w.speed, (spy / len) * w.speed);
        this.time.delayedCall(900, () => this.recycle(b));
      }
    }
    sparks(this, bx, by, col);
    okAction("J", "shoot");
  }
  recycle(b: Phaser.Physics.Arcade.Image, group = this.bullets) {
    if (b.body) b.body.enable = false;
    group.killAndHide(b);
  }
  aoe(x: number, y: number, r: number, dmg: number) {
    this.enemies.getChildren().forEach((ch) => {
      const e = ch as Enemy;
      if (e.state === "dead") return;
      if (Phaser.Math.Distance.Between(e.x, e.y, x, y) <= r) e.takeHit(dmg, this.player);
    });
  }
  nearestEnemy() {
    let best: Enemy | null = null;
    let d = 140;
    for (const ch of this.enemies.getChildren()) {
      const e = ch as Enemy;
      if (e.state === "dead" || !e.active) continue;
      const dist = Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y);
      if (dist < d) {
        d = dist;
        best = e;
      }
    }
    for (const ch of this.targets.getChildren()) {
      const t = ch as Phaser.Physics.Arcade.Image;
      if (!t.active) continue;
      const dist = Phaser.Math.Distance.Between(t.x, t.y, this.player.x, this.player.y);
      if (dist < d) {
        d = dist;
        best = t as unknown as Enemy;
      }
    }
    return best;
  }
  publishMini() {
    const view = this.cameras.main.worldView;
    const pois = [
      ...this.enemies.getChildren().map((ch) => {
        const e = ch as Enemy;
        const kind = e.getData("boss") ? "boss" : e.getData("dummy") ? "dummy" : e.tier >= 2 ? "elite" : "enemy";
        return { x: e.x / TILE, y: e.y / TILE, kind, elite: e.tier >= 2 };
      }),
      ...this.targets.getChildren().map((ch) => {
        const t = ch as Phaser.Physics.Arcade.Image;
        return { x: t.x / TILE, y: t.y / TILE, kind: "target" };
      }),
      ...this.pickups.getChildren().map((ch) => {
        const t = ch as Phaser.Physics.Arcade.Image;
        return { x: t.x / TILE, y: t.y / TILE, kind: `pickup-${t.getData("pick") || "ammo"}` };
      }),
      ...this.crates.filter((c) => c.active).map((c) => ({ x: c.x / TILE, y: c.y / TILE, kind: "crate" })),
      ...(this.gate ? [{ x: this.gate.x / TILE, y: this.gate.y / TILE, kind: "gate" }] : []),
    ];
    useGame.getState().setMinimap({
      cols: this.map.cols,
      rows: this.map.rows,
      walls: this.map.walls,
      px: this.player.x / TILE,
      py: this.player.y / TILE,
      pois,
      facing: Math.atan2(this.aim.y, this.aim.x),
      view: { x: view.x / TILE, y: view.y / TILE, w: view.width / TILE, h: view.height / TILE },
      radar: true,
    });
  }
  update(_t: number, dt: number) {
    if (!this.player?.body) return;
    const kids = this.enemies.getChildren() as Enemy[];
    publishPerf(meter.tick(1 + kids.length + this.bullets.countActive(true), this.power.length));
    const mode = useGame.getState().inputMode;
    if (mode !== "gameplay") {
      if (!this.simPaused) {
        this.physics.world.pause();
        this.tweens.pauseAll();
        this.simPaused = true;
        this.data.set("simPaused", true);
      }
      this.pending.shoot = false;
      const ov = useGame.getState().overlay;
      if (ov === "dead" && this.mode !== "train") useGame.getState().setOverlay("gameover");
      return;
    }
    if (this.simPaused) {
      this.physics.world.resume();
      this.tweens.resumeAll();
      this.simPaused = false;
      this.data.set("simPaused", false);
    }
    const rpm = useGame.getState().wheel.rpmMilli / 1000;
    if (this.core) this.core.rotation += dt * 0.002 * (0.4 + rpm);
    const k = this.keys;
    let mx = 0;
    let my = 0;
    if (k.left.isDown) mx -= 1;
    if (k.right.isDown) mx += 1;
    if (k.up.isDown) my -= 1;
    if (k.down.isDown) my += 1;
    const pad = this.input.gamepad?.pad1;
    if (pad) {
      mx += pad.leftStick.x;
      my += pad.leftStick.y;
    }
    if (mx || my) this.moveDir = { x: mx, y: my };
    const ptr = this.input.activePointer;
    const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
    const wx = wp.x;
    const wy = wp.y;
    const over = this.ptrOver || this.game.canvas.matches(":hover");
    const near = this.nearestEnemy();
    const resolved = resolveAim({
      mode: useGame.getState().aimMode,
      pointerOver: over,
      mouse: { x: wx - this.player.x, y: wy - this.player.y },
      stick: pad && Math.hypot(pad.rightStick.x, pad.rightStick.y) > 0.2 ? { x: pad.rightStick.x, y: pad.rightStick.y } : null,
      nearest: near ? { x: near.x - this.player.x, y: near.y - this.player.y } : null,
      move: this.moveDir,
      last: this.aim,
    });
    this.aim = finiteAim(resolved.x, resolved.y);
    this.autoAim = resolved.auto;
    if (!Number.isFinite(this.player.x) || !Number.isFinite(this.player.y)) {
      console.warn("[WB-CAM] player NaN, recentering");
      this.player.setPosition(this.map.pxW / 2, this.map.pxH / 2);
    }
    if (!Number.isFinite(this.cameras.main.scrollX) || !Number.isFinite(this.cameras.main.scrollY) || !Number.isFinite(this.cameras.main.zoom) || this.cameras.main.alpha < 0.05) {
      this.resetView("update-nan");
    }
    if (this.mode === "train" && TRAIN_STEPS[this.step]?.id === "aim" && this.time.now - this.lastMouse < 400) this.advance();
    this.recoil = Math.max(0, this.recoil - dt * 0.04);
    const spd = this.power.some((p) => p.id === "speed") ? 1.25 : 1;
    this.player.tick({
      x: mx,
      y: my,
      attack: false,
      skill: this.pending.melee || Phaser.Input.Keyboard.JustDown(k.melee),
      ult: this.pending.ult || Phaser.Input.Keyboard.JustDown(k.ult),
      roll: this.pending.roll || Phaser.Input.Keyboard.JustDown(k.roll),
      sprint: false,
      block: this.pending.block || k.block.isDown,
      dt,
    });
    this.player.faceAim(this.aim.x, this.aim.y);
    const vel = this.player.body as Phaser.Physics.Arcade.Body;
    if (kids.length < 40) {
      this.squeekGlow?.setPosition(this.player.x, this.player.y + 4);
      this.squeekGlow?.setAlpha(0.12 + Math.sin(this.time.now / 280) * 0.05);
      this.scarf?.setPosition(this.player.x - this.aim.x * 5, this.player.y + 8 + Math.sin(this.time.now / 140) * 2);
      this.scarf?.setRotation(-vel.velocity.x * 0.006 + (this.aim.x < 0 ? 0.4 : -0.4));
    } else {
      this.squeekGlow?.setVisible(false);
      this.scarf?.setVisible(false);
    }
    const gripX = this.player.x + this.aim.x * (8 - this.recoil);
    const gripY = this.player.y + 4 + this.aim.y * (5 - this.recoil * 0.4);
    this.gun.setPosition(gripX, gripY);
    this.gun.setRotation(Math.atan2(this.aim.y, this.aim.x));
    this.gun.setFlipY(this.aim.x < 0);
    if (this.reloadT > 0) this.gun.rotation += this.aim.x < 0 ? 0.55 : -0.55;
    const rx = this.autoAim && near ? near.x : wx;
    const ry = this.autoAim && near ? near.y : wy;
    this.reticle.setPosition(rx, ry);
    this.reticle.setTint(this.autoAim ? 0xff8a1f : 0x2ee9ff);
    this.laser.clear();
    if (kids.length < 36) {
      this.laser.lineStyle(1, this.autoAim ? 0xff8a1f : 0x2ee9ff, 0.45);
      const dist = Math.hypot(rx - gripX, ry - gripY);
      const steps = Math.min(18, Math.floor(dist / 6));
      for (let i = 0; i < steps; i++) {
        if (i % 2) continue;
        const a = i / steps;
        const b = (i + 1) / steps;
        this.laser.lineBetween(gripX + (rx - gripX) * a, gripY + (ry - gripY) * a, gripX + (rx - gripX) * b, gripY + (ry - gripY) * b);
      }
    }
    this.rim?.setPosition(this.player.x + this.aim.x * 10, this.player.y + this.aim.y * 5);
    this.rim?.setRotation(Math.atan2(this.aim.y, this.aim.x));
    let oil = 1;
    for (const s of this.slicks) {
      if (Math.hypot(this.player.x - s.x, this.player.y - s.y) < 16) oil = 0.52;
    }
    vel.setMaxVelocity(66 * this.mods.speed * spd * oil, 66 * this.mods.speed * spd * oil);
    if ((this.time.now | 0) % 2 === 0) {
      this.bullets.getChildren().forEach((ch) => {
        const b = ch as Phaser.Physics.Arcade.Image;
        if (!b.active) return;
        trailDot(this, b.x, b.y, Number(b.getData("col") || 0xffcc66));
      });
    }
    if (mx || my) {
      this.moved += dt * 0.06;
      this.stillT = 0;
      if (this.mode === "train" && TRAIN_STEPS[this.step]?.id === "move" && this.moved > 28) this.advance();
    } else {
      this.stillT += dt;
    }
    this.pressure = this.mode === "battle" && this.stillT > 8000 ? 1.45 : 1;
    if (this.pending.shoot || k.shoot.isDown || this.input.activePointer.isDown) this.shoot();
    if (this.pending.melee && this.mode === "train" && TRAIN_STEPS[this.step]?.id === "melee") this.advance();
    if (this.pending.roll && this.mode === "train" && TRAIN_STEPS[this.step]?.id === "roll") this.advance();
    if (this.pending.block && this.mode === "train" && TRAIN_STEPS[this.step]?.id === "block") this.advance();
    this.pending.shoot = false;
    this.pending.melee = false;
    this.pending.roll = false;
    this.pending.ult = false;
    this.fireCd = Math.max(0, this.fireCd - dt);
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.ammo = WEAPONS[this.weapon].ammo + this.mods.clip;
    }
    if (Phaser.Input.Keyboard.JustDown(k.reload)) this.reloadT = WEAPONS[this.weapon].reload;
    this.power = this.power.map((p) => ({ ...p, t: p.t - dt })).filter((p) => p.t > 0);
    const napping = useGame.getState().wheel.coreStatus === "IDLE";
    const frame = this.time.now | 0;
    const stride = kids.length > 40 ? 3 : kids.length > 24 ? 2 : 1;
    const bodies = kids.length > 8 ? kids.filter((e) => e.state !== "dead" && e.active).map((e) => ({ x: e.x, y: e.y })) : [];
    kids.forEach((e, i) => {
      if (e.state === "dead") return;
      if (e.getData("drone")) {
        const t = this.time.now / 400 + i;
        e.setVelocity(Math.cos(t) * 40, Math.sin(t) * 30);
        return;
      }
      if (stride > 1 && i % stride !== frame % stride) return;
      e.think(this.player, dt * stride, napping, { hunt: this.mode === "battle" || !!e.getData("fighter"), bodies, boost: this.pressure, id: i });
    });
    this.live = kids.filter((e) => e.state !== "dead" && e.active && !e.getData("dummy")).length;
    if (this.mode === "train" && TRAIN_STEPS[this.step]?.id === "drones") {
      const drones = kids.filter((e) => e.getData("drone") && e.state !== "dead");
      if (drones.length === 0) this.advance();
    }
    const ov = useGame.getState().overlay;
    if (this.mode === "battle" && ov === "none") {
      this.batchT += dt;
      if (this.live === 0 && this.pendingSpawns === 0 && this.spawnQueue.length) this.zeroT += dt;
      else this.zeroT = 0;
      if (this.spawnQueue.length && (this.batchT > 2200 || this.live < 4 || this.zeroT > 3000)) this.flushBatch();
      if (this.live === 0 && this.pendingSpawns === 0 && this.spawnQueue.length === 0) this.nextWave();
    }
    const hp = useGame.getState().save?.hp ?? 1;
    if (hp <= 0 && ov !== "gameover" && ov !== "dead") {
      const s = useGame.getState().save!;
      useGame.getState().patch({ bestScore: Math.max(s.bestScore ?? 0, this.score), score: this.score });
      useGame.getState().setOverlay("gameover");
    }
    if (ov === "dead" && this.mode !== "train") useGame.getState().setOverlay("gameover");
    const boss = kids.find((e) => e.getData("boss"));
    if (boss && boss.state !== "dead") {
      useGame.getState().setBossHud({ name: "THE GEARMAW", hp: boss.hp, hpMax: boss.hpMax, phase: boss.hp < 70 ? 3 : boss.hp < 140 ? 2 : 1 });
    }
    if (this.gate && Phaser.Math.Distance.Between(this.player.x, this.player.y, this.gate.x, this.gate.y) < 28) {
      useGame.getState().patch({ zone: "battle", arenaLevel: 1 });
      this.scene.restart({ mode: "battle", level: 1 });
      return;
    }
    this.cameras.main.setFollowOffset(-finite(this.aim.x) * 22, -finite(this.aim.y) * 16);
    this.hudT += dt;
    if (this.hudT >= 100) {
      this.hudT = 0;
      this.publishMini();
      const lv = LEVELS[this.level - 1];
      useGame.getState().setCooldowns({
        atk: this.fireCd,
        skill: 0,
        ult: this.player.ultCd,
        roll: this.player.rollCd,
      });
      useGame.setState({
        arenaHud: {
          mode: this.mode,
          level: this.level,
          wave: this.wave,
          waves: lv?.waves.length ?? 0,
          left: this.live,
          score: this.score,
          combo: this.combo,
          ammo: this.ammo,
          ammoMax: WEAPONS[this.weapon].ammo + this.mods.clip,
          weapon: WEAPONS[this.weapon].name,
          powerups: this.power.map((p) => ({ id: p.id, t: p.t })),
          step: this.mode === "train" ? (TRAIN_STEPS[this.step]?.text ?? "Walk into the gate") : "",
          stepI: Math.min(this.step + 1, TRAIN_STEPS.length),
          stepN: TRAIN_STEPS.length,
        },
      });
    }
  }
  applyUpgrade(id: string) {
    if (id === "dmg") this.mods.dmg *= 1.2;
    if (id === "rate") this.mods.rate *= 1.15;
    if (id === "clip") this.mods.clip += 4;
    if (id === "hp") {
      const s = useGame.getState().save!;
      useGame.getState().patch({ hpMax: s.hpMax + 12, hp: s.hpMax + 12 });
    }
    if (id === "speed") this.mods.speed *= 1.12;
    if (id === "surge") this.mods.surge *= 1.25;
    this.level += 1;
    this.wave = 0;
    const owned = new Set(useGame.getState().save?.guns ?? ["pistol"]);
    if (this.level === 2) owned.add("rifle");
    if (this.level === 3) owned.add("launcher");
    if (this.level >= 4) owned.add("coil");
    useGame.getState().patch({ arenaLevel: this.level, score: this.score, guns: [...owned], gun: this.weapon });
    useGame.getState().setOverlay("none");
    logCam("nextLevel", {
      level: this.level,
      theme: this.theme,
      scrollX: this.cameras.main.scrollX,
      scrollY: this.cameras.main.scrollY,
      zoom: this.cameras.main.zoom,
      px: this.player?.x,
      py: this.player?.y,
    });
    this.scene.restart({ mode: "battle", level: this.level });
  }
}

export { UPGRADES };
