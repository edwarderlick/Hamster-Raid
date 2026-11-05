export type Quality = "auto" | "low" | "medium" | "high";

export type QualityCaps = {
  particles: number;
  lights: number;
  bloom: boolean;
  shake: number;
  enemyCap: number;
  bulletCap: number;
};

const PRESETS: Record<Exclude<Quality, "auto">, QualityCaps> = {
  low: { particles: 8, lights: 2, bloom: false, shake: 0.35, enemyCap: 40, bulletCap: 40 },
  medium: { particles: 24, lights: 4, bloom: false, shake: 0.7, enemyCap: 64, bulletCap: 64 },
  high: { particles: 48, lights: 6, bloom: true, shake: 1, enemyCap: 80, bulletCap: 80 },
};

export type PerfSnap = {
  fps: number;
  ms: number;
  entities: number;
  draws: number;
  particles: number;
  quality: Quality;
};

const KEY = "wb-quality";

export function loadQuality(): Quality {
  if (typeof localStorage === "undefined") return "auto";
  const v = localStorage.getItem(KEY);
  if (v === "low" || v === "medium" || v === "high" || v === "auto") return v;
  return "auto";
}

export function saveQuality(q: Quality) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, q);
}

export function capsFor(q: Quality, autoTier: Exclude<Quality, "auto"> = "high"): QualityCaps {
  if (q === "auto") return PRESETS[autoTier];
  return PRESETS[q];
}

export function capDpr(raw = typeof window !== "undefined" ? window.devicePixelRatio : 1) {
  return Math.min(2, Math.max(1, raw || 1));
}

export class FrameMeter {
  fps = 60;
  ms = 16.6;
  samples: number[] = [];
  last = 0;
  autoTier: Exclude<Quality, "auto"> = "high";
  autoT = 0;
  constructor() {
    this.last = typeof performance !== "undefined" ? performance.now() : 0;
  }
  tick(entities: number, particles: number, draws = 0): PerfSnap {
    const now = performance.now();
    const dt = Math.max(0.1, now - this.last);
    this.last = now;
    this.ms = dt;
    this.samples.push(dt);
    if (this.samples.length > 180) this.samples.shift();
    const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    this.fps = Math.round(1000 / Math.max(1, avg));
    this.autoT += dt;
    if (this.autoT > 3000 && this.samples.length > 60) {
      this.autoT = 0;
      if (avg > 22) this.autoTier = "low";
      else if (avg > 18) this.autoTier = "medium";
      else this.autoTier = "high";
    }
    return { fps: this.fps, ms: Math.round(avg * 10) / 10, entities, draws, particles, quality: "auto" };
  }
  avgMs() {
    if (!this.samples.length) return this.ms;
    return this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
  }
  reset() {
    this.samples = [];
    this.autoT = 0;
    this.last = performance.now();
  }
}

export const meter = new FrameMeter();

export function publishPerf(snap: PerfSnap) {
  (window as unknown as { __WB_PERF: PerfSnap }).__WB_PERF = snap;
}
