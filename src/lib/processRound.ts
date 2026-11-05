import { ENRAGE_PER_NAP, MAX_ENRAGE, NAP_HEAL, WEEKLY_BOSS_HP } from "./constants.js";
import { outgoingDamage, splitDamage, type WeightedPlayer } from "./damage.js";
import { pickLastHit } from "./lastHit.js";

export type BossState = {
  week: number;
  hp: number;
  hpMax: number;
  enrage: number;
  lastHit: string | null;
  defeatedAtRound: number | null;
  totalDamage: number;
};

export type ProcessedRound = {
  roundId: number;
  work: number;
  dataHash: string;
  batchDigest?: string;
  damage: number;
  healed: number;
  killed: boolean;
  lastHit: string | null;
  shares: { address: string; weight: number; damage: number }[];
  ready: string[];
  alreadyProcessed?: boolean;
};

export function applyRound(opts: {
  boss: BossState;
  roundId: number;
  work: number;
  dataHash: string;
  ready: WeightedPlayer[];
  processedIds: Set<number>;
}): { boss: BossState; result: ProcessedRound } {
  if (opts.processedIds.has(opts.roundId)) {
    return {
      boss: opts.boss,
      result: {
        roundId: opts.roundId,
        work: opts.work,
        dataHash: opts.dataHash,
        damage: 0,
        healed: 0,
        killed: false,
        lastHit: opts.boss.lastHit,
        shares: [],
        ready: opts.ready.map((p) => p.address.toLowerCase()),
        alreadyProcessed: true,
      },
    };
  }

  const readyAddrs = opts.ready.map((p) => p.address.toLowerCase());
  const lastHit = pickLastHit(opts.dataHash, opts.roundId, readyAddrs);

  if (opts.boss.defeatedAtRound !== null) {
    return {
      boss: opts.boss,
      result: {
        roundId: opts.roundId,
        work: opts.work,
        dataHash: opts.dataHash,
        damage: 0,
        healed: 0,
        killed: false,
        lastHit,
        shares: splitDamage(0, opts.ready, lastHit ?? undefined),
        ready: readyAddrs,
      },
    };
  }

  if (opts.work <= 0) {
    const healed = Math.min(NAP_HEAL, opts.boss.hpMax - opts.boss.hp);
    const boss: BossState = {
      ...opts.boss,
      hp: Math.min(opts.boss.hpMax, opts.boss.hp + NAP_HEAL),
      enrage: Math.min(MAX_ENRAGE, opts.boss.enrage + ENRAGE_PER_NAP),
      lastHit: lastHit ?? opts.boss.lastHit,
    };
    return {
      boss,
      result: {
        roundId: opts.roundId,
        work: 0,
        dataHash: opts.dataHash,
        damage: 0,
        healed,
        killed: false,
        lastHit: boss.lastHit,
        shares: splitDamage(0, opts.ready, lastHit ?? undefined),
        ready: readyAddrs,
      },
    };
  }

  const damage = outgoingDamage(opts.work, opts.boss.enrage);
  const hpAfter = Math.max(0, opts.boss.hp - damage);
  const killed = hpAfter === 0 && opts.boss.hp > 0;
  const shares = splitDamage(damage, opts.ready, lastHit ?? undefined);
  const boss: BossState = {
    ...opts.boss,
    hp: hpAfter,
    lastHit: lastHit ?? opts.boss.lastHit,
    defeatedAtRound: killed ? opts.roundId : opts.boss.defeatedAtRound,
    totalDamage: opts.boss.totalDamage + Math.min(damage, opts.boss.hp),
    enrage: killed ? 0 : opts.boss.enrage,
  };
  return {
    boss,
    result: {
      roundId: opts.roundId,
      work: opts.work,
      dataHash: opts.dataHash,
      damage,
      healed: 0,
      killed,
      lastHit: boss.lastHit,
      shares,
      ready: readyAddrs,
    },
  };
}

/** Personal Wheel Surge ticks the shared weekly bar. Does not rewrite last-hit (that stays hash-derived). */
export function applySurge(boss: BossState, damage: number): BossState {
  if (boss.defeatedAtRound !== null) return boss;
  const dmg = Math.max(0, Math.min(40, Math.floor(damage)));
  if (dmg <= 0) return boss;
  const applied = Math.min(dmg, boss.hp);
  const hp = boss.hp - applied;
  return {
    ...boss,
    hp,
    totalDamage: boss.totalDamage + applied,
    defeatedAtRound: hp === 0 ? -1 : boss.defeatedAtRound,
  };
}

export function freshBoss(week: number, hpMax = WEEKLY_BOSS_HP): BossState {
  return {
    week,
    hp: hpMax,
    hpMax,
    enrage: 0,
    lastHit: null,
    defeatedAtRound: null,
    totalDamage: 0,
  };
}
