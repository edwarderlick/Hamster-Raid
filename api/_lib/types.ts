import type { HeroClass } from "../../src/lib/classes.js";
import type { AchievementId } from "../../src/lib/achievements.js";
import type { BossState, ProcessedRound } from "../../src/lib/processRound.js";

export type ApiReq = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
  ip: string;
};

export type ApiRes = {
  status: number;
  json: unknown;
  headers?: Record<string, string>;
};

export type JoinRecord = {
  address: string;
  week: number;
  joinedAt: number;
  tokenId: string;
  level: number;
  heroClass: HeroClass;
  spectator: boolean;
};

export type Profile = {
  address: string;
  xp: number;
  level: number;
  titles: string[];
  badges: AchievementId[];
  streak: number;
  bestStreak: number;
  cosmetics: string[];
  seasonXp: number;
  lastReadyRound: number | null;
  napReady: number;
  zoomiesReady: number;
  dailyReady: number;
  dailyKey: string;
  weeklyLastHits: number;
  weeklyZoomies: number;
};

export type StoryBeat = {
  roundId: number;
  text: string;
  source: "llm" | "template";
  at: number;
  work: number;
  lastHit: string | null;
};

export type GraveyardEntry = {
  week: number;
  bossId: string;
  bossName: string;
  killedAt: number;
  killedRound: number;
  killer: string | null;
  totalDamage: number;
  recap: string[];
};

export type CachedStatus = {
  coreStatus: string;
  rpmMilli: number;
  speedMmPerSecond: number;
  distanceMm: number;
  cumulativeWorkUnits: string;
  observedAt: string;
  freshness: string;
  settledThroughRound: string;
  currentRound: string;
  fetchedAt: number;
  stale: boolean;
};

export type Store = {
  week: number;
  boss: BossState;
  joins: Record<string, JoinRecord>;
  ready: Record<string, string[]>;
  processed: Record<string, ProcessedRound>;
  processedIds: number[];
  story: StoryBeat[];
  profiles: Record<string, Profile>;
  graveyard: GraveyardEntry[];
  nonces: Record<string, { nonce: string; expiresAt: number }>;
  lastStatus: CachedStatus | null;
  leaderboardWeek: number;
  toasts: { id: string; text: string; at: number }[];
  saves: Record<string, unknown>;
};
