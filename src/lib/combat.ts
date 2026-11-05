import { clampLevel } from "./damage";

export const COMBO_MUL = [1, 1.18, 1.42];

export function squeekMul(level: number): number {
  return 1 + (clampLevel(level) - 1) * 0.04;
}

export function rollDamage(opts: {
  baseAtk: number;
  weaponAtk: number;
  comboIndex: number;
  crit: boolean;
  squeekLevel: number;
  skillMul?: number;
  backstab?: boolean;
  surge?: boolean;
}): number {
  const combo = COMBO_MUL[Math.max(0, Math.min(2, opts.comboIndex))] ?? 1;
  const raw =
    (opts.baseAtk + opts.weaponAtk) *
    combo *
    (opts.skillMul ?? 1) *
    squeekMul(opts.squeekLevel) *
    (opts.backstab ? 1.75 : 1) *
    (opts.surge ? 2.4 : 1);
  return Math.max(1, Math.round(raw * (opts.crit ? 1.5 : 1)));
}

export function applyDefense(dmg: number, defense: number): number {
  const reduced = dmg - Math.floor(defense * 0.35);
  return Math.max(1, reduced);
}

export function xpToNext(level: number): number {
  return 40 + level * 25;
}

export function goldForKill(enemyTier: number): number {
  return 3 + enemyTier * 4;
}
