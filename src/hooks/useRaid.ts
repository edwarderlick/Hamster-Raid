import { useQuery } from "@tanstack/react-query";
import { STATUS_POLL_MS } from "@/lib/constants";

export type RaidPayload = {
  status: {
    coreStatus: string;
    rpmMilli: number;
    cumulativeWorkUnits: string;
    observedAt: string;
    freshness: string;
    settledThroughRound: string;
    currentRound: string;
    stale: boolean;
  } | null;
  week: number;
  currentRound: number;
  roundEndsAt: number;
  boss: {
    id: string;
    name: string;
    title: string;
    lore: string;
    art: string;
    artNote: string;
    hp: number;
    hpMax: number;
    enrage: number;
    lastHit: string | null;
    defeatedAtRound: number | null;
    totalDamage: number;
    phase: number;
  };
  ready: string[];
  readyCount: number;
  story: { roundId: number; text: string; source: string; work: number; lastHit: string | null; at: number }[];
  processed: {
    roundId: number;
    work: number;
    damage: number;
    healed: number;
    killed: boolean;
    lastHit: string | null;
    shares: { address: string; damage: number }[];
  }[];
  leaderboard: {
    address: string;
    damage: number;
    class: string | null;
    lastHits: number;
    profile: { titles: string[]; streak: number; level: number } | null;
  }[];
  graveyard: {
    week: number;
    bossId: string;
    bossName: string;
    killedAt: number;
    killedRound: number;
    killer: string | null;
    totalDamage: number;
    recap: string[];
  }[];
  toasts: { id: string; text: string; at: number }[];
  joins: number;
};

export function useRaid() {
  return useQuery({
    queryKey: ["raid"],
    queryFn: async () => {
      const res = await fetch("/api/raid");
      if (!res.ok) throw new Error("raid_unavailable");
      return (await res.json()) as RaidPayload;
    },
    refetchInterval: STATUS_POLL_MS,
    retry: 2,
  });
}
