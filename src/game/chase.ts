export type ChaseKind = "mite" | "slime" | "wasp" | "crawler" | "pellet" | "sentry" | "spark" | "brute" | "bomber" | "dummy";

export type Body = { x: number; y: number };

export type ChaseIn = {
  kind: string;
  self: Body;
  player: Body;
  others: Body[];
  t: number;
  hunt: boolean;
  boost: number;
  id: number;
};

export type ChaseOut = {
  vx: number;
  vy: number;
  windup: boolean;
  shoot: boolean;
  explode: boolean;
  dist: number;
};

const SPEED: Record<string, number> = {
  mite: 52,
  slime: 28,
  wasp: 58,
  crawler: 36,
  pellet: 30,
  sentry: 28,
  spark: 70,
  bomber: 70,
  brute: 22,
  dummy: 0,
};

export function baseSpeed(kind: string) {
  return SPEED[kind] ?? 40;
}

export function chaseStep(a: ChaseIn): ChaseOut {
  const dx = a.player.x - a.self.x;
  const dy = a.player.y - a.self.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;
  const kind = a.kind === "bomber" ? "spark" : a.kind;
  let speed = baseSpeed(kind) * (a.boost || 1);
  let tx = nx;
  let ty = ny;
  let windup = false;
  let shoot = false;
  let explode = false;

  if (kind === "dummy" && !a.hunt) {
    return { vx: 0, vy: 0, windup: false, shoot: false, explode: false, dist };
  }

  if (kind === "wasp") {
    const side = a.id % 2 === 0 ? 1 : -1;
    tx = nx + -ny * 0.85 * side;
    ty = ny + nx * 0.85 * side;
    const ang = a.t / 280 + a.id;
    tx += Math.cos(ang) * 0.35;
    ty += Math.sin(ang) * 0.35;
  } else if (kind === "pellet") {
    const want = 120;
    if (dist < 100) {
      tx = -nx;
      ty = -ny;
    } else if (dist > 140) {
      tx = nx;
      ty = ny;
    } else {
      tx = -ny * (a.id % 2 === 0 ? 1 : -1);
      ty = nx * (a.id % 2 === 0 ? 1 : -1);
    }
    shoot = dist < 180 && Math.floor(a.t / 900 + a.id) !== Math.floor((a.t - 16) / 900 + a.id);
    speed = dist < want - 20 || dist > want + 20 ? speed : speed * 0.9;
  } else if (kind === "sentry") {
    speed *= 0.72;
    if (dist < 28) {
      tx = 0;
      ty = 0;
    }
    shoot = dist < 160 && Math.floor(a.t / 1100 + a.id) !== Math.floor((a.t - 16) / 1100 + a.id);
  } else if (kind === "crawler") {
    if (dist < 72) windup = true;
  } else if (kind === "spark" || a.kind === "bomber") {
    if (dist < 18) explode = true;
  } else if (kind === "brute") {
    if (dist < 28) windup = true;
    speed *= 0.85;
  } else {
    if (dist < 18) windup = true;
  }

  const wob = Math.sin(a.t / 180 + a.id * 1.7) * 0.22;
  tx += -ny * wob;
  ty += nx * wob;

  let sx = 0;
  let sy = 0;
  for (const o of a.others) {
    const ox = a.self.x - o.x;
    const oy = a.self.y - o.y;
    const d = Math.hypot(ox, oy);
    if (d > 0 && d < 20) {
      sx += ox / d;
      sy += oy / d;
    }
  }
  tx += sx * 0.7;
  ty += sy * 0.7;
  const len = Math.hypot(tx, ty) || 1;
  return { vx: (tx / len) * speed, vy: (ty / len) * speed, windup, shoot, explode, dist };
}

export function simChase(kind: string, start: Body, player: Body, ms: number, step = 16) {
  let x = start.x;
  let y = start.y;
  for (let t = 0; t < ms; t += step) {
    const o = chaseStep({ kind, self: { x, y }, player, others: [], t, hunt: true, boost: 1, id: 0 });
    x += o.vx * (step / 1000);
    y += o.vy * (step / 1000);
    if (Math.hypot(player.x - x, player.y - y) < 18) return { x, y, t, reached: true };
  }
  return { x, y, t: ms, reached: Math.hypot(player.x - x, player.y - y) < 18 };
}

export type SpawnJob = { kind: string; tier: number };

export function flattenWave(wave: { kind: string; n: number; tier: number }[]): SpawnJob[] {
  const jobs: SpawnJob[] = [];
  for (const row of wave) for (let i = 0; i < row.n; i++) jobs.push({ kind: row.kind, tier: row.tier });
  return jobs;
}

export function takeBatch(queue: SpawnJob[], n = 3): { batch: SpawnJob[]; rest: SpawnJob[] } {
  return { batch: queue.slice(0, n), rest: queue.slice(n) };
}

export function spawnOutsideView(
  view: { x: number; y: number; width: number; height: number },
  world: { w: number; h: number },
  pad = 20,
) {
  const side = Math.floor(Math.random() * 4);
  let x = view.x + view.width / 2;
  let y = view.y + view.height / 2;
  if (side === 0) {
    x = Math.max(pad, view.x - pad);
    y = view.y + Math.random() * view.height;
  } else if (side === 1) {
    x = Math.min(world.w - pad, view.x + view.width + pad);
    y = view.y + Math.random() * view.height;
  } else if (side === 2) {
    y = Math.max(pad, view.y - pad);
    x = view.x + Math.random() * view.width;
  } else {
    y = Math.min(world.h - pad, view.y + view.height + pad);
    x = view.x + Math.random() * view.width;
  }
  return { x: Math.min(world.w - pad, Math.max(pad, x)), y: Math.min(world.h - pad, Math.max(pad, y)) };
}
