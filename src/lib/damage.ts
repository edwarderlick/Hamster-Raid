import { BASE_WEIGHT, LEVEL_WEIGHT, MAX_LEVEL } from "./constants.js";

export type WeightedPlayer = {
  address: string;
  level: number;
};

export type DamageShare = {
  address: string;
  weight: number;
  damage: number;
};

export function clampLevel(level: number): number {
  if (!Number.isFinite(level) || level < 1) return 1;
  return Math.min(MAX_LEVEL, Math.floor(level));
}

/** Weight is 100 + 5 per Squeek level (capped at 10). Level is a small bonus, never a buy-in. */
export function playerWeight(level: number): number {
  return BASE_WEIGHT + clampLevel(level) * LEVEL_WEIGHT;
}

/**
 * Split integer work units across ready players by weight.
 * Remainder units (from flooring) go to `remainderAddress` when present, else the first sorted player.
 */
export function splitDamage(
  work: number,
  players: WeightedPlayer[],
  remainderAddress?: string,
): DamageShare[] {
  const sorted = [...players].sort((a, b) =>
    a.address.toLowerCase().localeCompare(b.address.toLowerCase()),
  );
  if (work <= 0 || sorted.length === 0) {
    return sorted.map((p) => ({
      address: p.address.toLowerCase(),
      weight: playerWeight(p.level),
      damage: 0,
    }));
  }

  const shares: DamageShare[] = sorted.map((p) => ({
    address: p.address.toLowerCase(),
    weight: playerWeight(p.level),
    damage: 0,
  }));
  const totalWeight = shares.reduce((sum, s) => sum + s.weight, 0);
  let assigned = 0;
  for (const share of shares) {
    share.damage = Math.floor((work * share.weight) / totalWeight);
    assigned += share.damage;
  }
  let remainder = work - assigned;
  if (remainder > 0) {
    const target =
      remainderAddress?.toLowerCase() ?? shares[0]!.address;
    const hit = shares.find((s) => s.address === target) ?? shares[0]!;
    hit.damage += remainder;
  }
  return shares;
}

export function outgoingDamage(work: number, enrageStacks: number): number {
  if (work <= 0) return 0;
  const stacks = Math.max(0, Math.min(8, enrageStacks));
  return work + Math.floor((work * stacks * 400) / 10_000);
}
