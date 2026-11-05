import { describe, expect, it } from "vitest";
import { LEVELS, TRAIN_STEPS, WEAPONS, PICKUPS, threatBudget, edgeSpawn, UPGRADES } from "../../game/arena";
import { capsFor, capDpr, FrameMeter } from "../../game/perf";
import { overlayToggle } from "../../game/uiState";
import { pointerWorld, resolveAim, dir8 } from "../../game/aim";
import { themeFor, THEMES, buildArenaMap, AT } from "../../game/arenaMaps";
import { hasSkippedTrain, markSkippedTrain, clearSkippedTrain, SKIP_TRAIN_KEY } from "../../game/skipTrain";
import { simChase } from "../../game/chase";
import { migrateHero } from "../classes";
import { loadAimMode } from "../../game/aim";
import { camCauses, finite, finiteAim } from "../../game/viewGuard";

describe("arena content", () => {
  it("has 5 levels and 8 training steps", () => {
    expect(LEVELS).toHaveLength(5);
    expect(TRAIN_STEPS).toHaveLength(8);
    expect(Object.keys(WEAPONS)).toHaveLength(5);
    expect(WEAPONS.shotgun.short.length).toBeLessThanOrEqual(5);
    expect(WEAPONS.pistol.short.length).toBeLessThanOrEqual(5);
    expect(Object.keys(PICKUPS)).toHaveLength(9);
    expect(UPGRADES.length).toBeGreaterThanOrEqual(3);
  });
  it("scales threat and keeps spawns on the rim", () => {
    expect(threatBudget(5, 3)).toBeGreaterThan(threatBudget(1, 1));
    const p = edgeSpawn(640, 480, 24);
    expect(p.x === 24 || p.x === 616 || p.y === 24 || p.y === 456).toBe(true);
  });
});

describe("quality caps", () => {
  it("caps dpr at 2 and auto-downgrades after slow frames", () => {
    expect(capDpr(3)).toBe(2);
    expect(capsFor("high").enemyCap).toBe(80);
    expect(capsFor("low").bloom).toBe(false);
    const m = new FrameMeter();
    m.samples = Array.from({ length: 80 }, () => 24);
    m.autoT = 4000;
    m.tick(80, 4);
    expect(m.autoTier).toBe("low");
  });
});

describe("overlay extras", () => {
  it("toggles upgrade closed", () => {
    expect(overlayToggle("upgrade", "upgrade")).toBe("none");
  });
  it("opens skip confirm from none", () => {
    expect(overlayToggle("none", "skip")).toBe("skip");
    expect(overlayToggle("skip", "skip")).toBe("none");
  });
});

describe("mouse aim", () => {
  const last = { x: 1, y: 0 };
  const dirs = [
    ["E", 40, 0],
    ["NE", 40, -40],
    ["N", 0, -40],
    ["NW", -40, -40],
    ["W", -40, 0],
    ["SW", -40, 40],
    ["S", 0, 40],
    ["SE", 40, 40],
  ] as const;
  it("covers all 8 compass directions", () => {
    for (const [, x, y] of dirs) {
      const r = resolveAim({
        mode: "mouse",
        pointerOver: true,
        mouse: { x, y },
        stick: null,
        nearest: { x: 99, y: 0 },
        move: { x: 0, y: 0 },
        last,
      });
      expect(r.auto).toBe(false);
      expect(Math.abs(r.x - x / Math.hypot(x, y))).toBeLessThan(0.02);
      expect(Math.abs(r.y - y / Math.hypot(x, y))).toBeLessThan(0.02);
    }
  });
  it("keeps mouse aim when the pointer is over the canvas even if stale", () => {
    const r = resolveAim({
      mode: "mouse",
      pointerOver: true,
      mouse: { x: 0, y: 40 },
      stick: null,
      nearest: { x: 30, y: 0 },
      move: { x: 1, y: 0 },
      last,
    });
    expect(r.auto).toBe(false);
    expect(r.y).toBeGreaterThan(0.8);
  });
  it("auto-aims only with no pointer and no stick", () => {
    const r = resolveAim({
      mode: "mouse",
      pointerOver: false,
      mouse: { x: 8, y: 0 },
      stick: null,
      nearest: { x: 0, y: 40 },
      move: { x: 0, y: 0 },
      last,
    });
    expect(r.auto).toBe(true);
    expect(r.y).toBeGreaterThan(0.8);
  });
});

describe("pointer world from camera scroll", () => {
  it("uses scroll plus pointer, not a stale worldX", () => {
    const a = pointerWorld({ scrollX: 0, scrollY: 0 }, 180, 135);
    const b = pointerWorld({ scrollX: 120, scrollY: 40 }, 180, 135);
    expect(b.x - a.x).toBe(120);
    expect(b.y - a.y).toBe(40);
  });
});

describe("enemy chase", () => {
  it("a mite 200px away reaches melee within 8 seconds", () => {
    const r = simChase("mite", { x: 0, y: 0 }, { x: 200, y: 0 }, 8000);
    expect(r.reached).toBe(true);
    expect(r.t).toBeLessThanOrEqual(8000);
  });
});

describe("one hero migration", () => {
  it("maps old classes to raider and keeps wanderer", () => {
    expect(migrateHero("brawler")).toBe("raider");
    expect(migrateHero("mystic")).toBe("raider");
    expect(migrateHero("trickster")).toBe("raider");
    expect(migrateHero("wanderer")).toBe("wanderer");
    expect(migrateHero("raider")).toBe("raider");
  });
  it("migrates hybrid aim to mouse", () => {
    const mem: Record<string, string> = { "wb-aim": "hybrid" };
    const store = {
      getItem: (k: string) => mem[k] ?? null,
      setItem: (k: string, v: string) => {
        mem[k] = v;
      },
      removeItem: (k: string) => {
        delete mem[k];
      },
    };
    (globalThis as { localStorage: typeof store }).localStorage = store;
    expect(loadAimMode()).toBe("mouse");
  });
});

describe("arena maps", () => {
  it("gives each level a distinct theme and a map bigger than one screen", () => {
    expect(themeFor("train", 1)).toBe("train");
    expect(themeFor("battle", 1)).toBe("rust");
    expect(themeFor("battle", 3)).toBe("oil");
    expect(themeFor("battle", 5)).toBe("foundry");
    const m = buildArenaMap("oil", 3);
    expect(m.pxW).toBeGreaterThan(360 * 1.4);
    expect(m.pxH).toBeGreaterThan(270 * 1.4);
    expect(THEMES.train.name).toBe("Training Academy");
    expect(THEMES.foundry.name).toBe("The Gearmaw");
  });
  it("keeps a calm floor without hazard stripes and parks props off-center", () => {
    const m = buildArenaMap("cog", 11);
    expect(m.ground.filter((t) => t === AT.hazard).length).toBe(0);
    expect(m.props.some((p) => p.kind === "crate" || p.kind === "barrel")).toBe(true);
    expect(m.props.some((p) => p.kind === "pipe" || p.kind === "fence" || p.kind === "wheel")).toBe(true);
    const cx = m.pxW / 2;
    const cy = m.pxH / 2;
    const blocking = m.props.filter((p) => p.kind === "crate" || p.kind === "barrel" || p.kind === "pipe");
    expect(blocking.every((p) => Math.hypot(p.x - cx, p.y - cy) > 48)).toBe(true);
  });
});

describe("aim body facing", () => {
  it("maps 8 compass octants", () => {
    expect(dir8(1, 0)).toBe(0);
    expect(dir8(1, 1)).toBe(1);
    expect(dir8(0, 1)).toBe(2);
    expect(dir8(-1, 0)).toBe(4);
    expect(dir8(0, -1)).toBe(6);
  });
});

describe("skip training storage", () => {
  it("round-trips the localStorage flag", () => {
    const mem: Record<string, string> = {};
    (globalThis as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => mem[k] ?? null,
      setItem: (k: string, v: string) => {
        mem[k] = v;
      },
      removeItem: (k: string) => {
        delete mem[k];
      },
      clear: () => {
        for (const k of Object.keys(mem)) delete mem[k];
      },
      key: () => null,
      length: 0,
    } as Storage;
    clearSkippedTrain();
    expect(hasSkippedTrain()).toBe(false);
    markSkippedTrain();
    expect(hasSkippedTrain()).toBe(true);
    expect(mem[SKIP_TRAIN_KEY]).toBe("1");
    clearSkippedTrain();
    expect(hasSkippedTrain()).toBe(false);
  });
});

describe("viewGuard", () => {
  it("clamps non-finite aim and flags a dead camera", () => {
    expect(finite(Number.NaN, 3)).toBe(3);
    expect(finite(Infinity, 1)).toBe(1);
    expect(finiteAim(Number.NaN, 0)).toEqual({ x: 1, y: 0 });
    const broken = camCauses({
      scrollX: Number.NaN,
      scrollY: 0,
      zoom: 1,
      alpha: 0,
      px: 100,
      py: 100,
    });
    expect(broken.some((c) => c.startsWith("alpha"))).toBe(true);
    expect(broken.some((c) => c.startsWith("scroll"))).toBe(true);
    expect(camCauses({ scrollX: 10, scrollY: 10, zoom: 1, alpha: 1, px: 20, py: 20, viewX: 0, viewY: 0, viewW: 200, viewH: 120 })).toEqual([]);
  });
});
