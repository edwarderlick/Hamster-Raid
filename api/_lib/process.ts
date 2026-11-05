import { classifyWork, weekIndexFromRound, WEEKLY_BOSS_HP } from "../../src/lib/constants";
import { bossForWeek } from "../../src/lib/bosses";
import { writeBeat } from "../../src/lib/story";
import { applyRound, freshBoss } from "../../src/lib/processRound";
import { COSMETICS, type AchievementId } from "../../src/lib/achievements";
import { fetchBatchFrontier, fetchCoreEvents, fetchStatus } from "./chain";
import { ensureProfile, loadStore, saveStore } from "./store";
import type { Store } from "./types";

function llmConfig() {
  const key = process.env.LLM_API_KEY;
  if (!key) return undefined;
  return {
    key,
    url: process.env.LLM_API_URL || "https://api.openai.com/v1/chat/completions",
    model: process.env.LLM_MODEL || "gpt-4o-mini",
  };
}

function grant(store: Store, address: string, badge: AchievementId) {
  const p = ensureProfile(store, address);
  if (!p.badges.includes(badge)) {
    p.badges.push(badge);
    store.toasts.push({
      id: `${address}-${badge}-${Date.now()}`,
      text: `Achievement: ${badge}`,
      at: Date.now(),
    });
  }
}

function addXp(store: Store, address: string, amount: number) {
  const p = ensureProfile(store, address);
  p.xp += amount;
  p.seasonXp += amount;
  p.level = 1 + Math.floor(p.xp / 250);
  for (const c of COSMETICS) {
    if (p.seasonXp >= c.track * 80 && !p.cosmetics.includes(c.id)) {
      p.cosmetics.push(c.id);
    }
  }
}

function rolloverWeek(store: Store, week: number) {
  if (store.week === week) return;
  const prev = bossForWeek(store.week);
  store.graveyard.unshift({
    week: store.week,
    bossId: prev.id,
    bossName: prev.name,
    killedAt: Date.now(),
    killedRound: store.boss.defeatedAtRound ?? -1,
    killer: store.boss.lastHit,
    totalDamage: store.boss.totalDamage,
    recap: store.story.slice(-8).map((s) => s.text),
  });
  store.week = week;
  store.boss = freshBoss(week, WEEKLY_BOSS_HP);
  store.joins = {};
  store.ready = {};
  store.leaderboardWeek = week;
  store.toasts.push({
    id: `week-${week}`,
    text: `${prev.name} archived. ${bossForWeek(week).name} enters the foundry.`,
    at: Date.now(),
  });
}

export async function refreshStatus(store: Store) {
  try {
    const status = await fetchStatus();
    store.lastStatus = status;
  } catch {
    if (store.lastStatus) store.lastStatus = { ...store.lastStatus, stale: true };
  }
}

export async function processSettledRounds(): Promise<Store> {
  const store = await loadStore();
  await refreshStatus(store);

  const currentRound = Number(store.lastStatus?.currentRound ?? 0);
  rolloverWeek(store, weekIndexFromRound(currentRound));

  const frontier = await fetchBatchFrontier();
  const recorded = await fetchCoreEvents();
  const workByRound = new Map(recorded.map((r) => [r.roundId, r]));

  const target = frontier.settledThroughRound;
  const lastDone = store.processedIds.length
    ? Math.max(...store.processedIds)
    : target;
  const processedSet = new Set(store.processedIds);

  for (let roundId = Math.max(0, lastDone + 1); roundId <= target; roundId++) {
    if (processedSet.has(roundId)) continue;
    const rec = workByRound.get(roundId);
    const work = rec?.work ?? 0;
    const dataHash = rec?.dataHash ?? frontier.digests[roundId] ?? `0x${roundId.toString(16).padStart(64, "0")}`;
    const readyAddrs = store.ready[String(roundId)] ?? [];
    const ready = readyAddrs.map((addr) => {
      const join = store.joins[addr];
      return { address: addr, level: join?.level ?? 1 };
    });

    const { boss, result } = applyRound({
      boss: store.boss,
      roundId,
      work,
      dataHash,
      ready,
      processedIds: processedSet,
    });
    if (result.alreadyProcessed) continue;

    store.boss = boss;
    store.processed[String(roundId)] = result;
    store.processedIds.push(roundId);
    processedSet.add(roundId);

    const kind = classifyWork(work);
    for (const share of result.shares) {
      const p = ensureProfile(store, share.address);
      if (share.damage > 0) {
        addXp(store, share.address, 10 + share.damage);
        grant(store, share.address, "first-blood");
      }
      if (p.lastReadyRound !== null && p.lastReadyRound === roundId - 1) {
        p.streak += 1;
        p.bestStreak = Math.max(p.bestStreak, p.streak);
        if (p.streak >= 7) grant(store, share.address, "seven-streak");
      } else {
        p.streak = 1;
      }
      p.lastReadyRound = roundId;
      if (kind === "nap") {
        p.napReady += 1;
        if (p.napReady >= 3) grant(store, share.address, "nap-survivor");
      }
      if (kind === "zoomies") {
        p.zoomiesReady += 1;
        p.weeklyZoomies += 1;
        if (p.zoomiesReady >= 3) grant(store, share.address, "zoomies-ready");
      }
    }
    if (result.lastHit) {
      grant(store, result.lastHit, "last-hit");
      ensureProfile(store, result.lastHit).weeklyLastHits += 1;
      addXp(store, result.lastHit, 25);
      if (result.killed) {
        grant(store, result.lastHit, "boss-slayer");
        const prof = ensureProfile(store, result.lastHit);
        if (!prof.titles.includes("Gearbreaker")) prof.titles.push("Gearbreaker");
      }
    }

    const beat = await writeBeat(
      {
        roundId,
        work,
        bossName: bossForWeek(store.week).name,
        lastHit: result.lastHit,
        lastHitClass: result.lastHit ? store.joins[result.lastHit]?.heroClass : null,
        killed: result.killed,
        healed: result.healed,
        enrage: store.boss.enrage,
        hpAfter: store.boss.hp,
        hpMax: store.boss.hpMax,
        priorBeat: store.story.at(-1)?.text,
      },
      llmConfig(),
    );
    store.story.push({
      roundId,
      text: beat.text,
      source: beat.source,
      at: Date.now(),
      work,
      lastHit: result.lastHit,
    });
    store.toasts.push({
      id: `beat-${roundId}`,
      text: `New beat for round ${roundId}`,
      at: Date.now(),
    });

    if (result.killed) {
      const def = bossForWeek(store.week);
      store.graveyard.unshift({
        week: store.week,
        bossId: def.id,
        bossName: def.name,
        killedAt: Date.now(),
        killedRound: roundId,
        killer: result.lastHit,
        totalDamage: store.boss.totalDamage,
        recap: store.story.slice(-12).map((s) => s.text),
      });
    }
  }

  store.toasts = store.toasts.slice(-40);
  store.story = store.story.slice(-80);
  await saveStore(store);
  return store;
}

export function weeklyLeaderboard(store: Store) {
  const totals = new Map<string, number>();
  for (const round of Object.values(store.processed)) {
    for (const share of round.shares) {
      totals.set(share.address, (totals.get(share.address) ?? 0) + share.damage);
    }
  }
  return [...totals.entries()]
    .map(([address, damage]) => ({
      address,
      damage,
      class: store.joins[address]?.heroClass ?? null,
      lastHits: Object.values(store.processed).filter((r) => r.lastHit === address).length,
      profile: store.profiles[address] ?? null,
    }))
    .sort((a, b) => b.damage - a.damage)
    .slice(0, 50);
}
