import { createPublicClient, http, parseAbi, type Hex } from "viem";
import { sepolia } from "viem/chains";
import {
  API_BASE,
  CHAIN_ID,
  COLLECTION_ADDRESS,
  CORE_ABI,
  CORE_ADDRESS,
  GENESIS_TIMESTAMP,
  ROUND_DURATION_SEC,
} from "../../src/lib/constants.js";
import { classFromTokenId, pickHeroSqueek } from "../../src/lib/classes.js";
import type { CachedStatus } from "./types.js";

const client = createPublicClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org"),
});

const coreAbi = parseAbi([...CORE_ABI]);

export async function fetchStatus(): Promise<CachedStatus> {
  const res = await fetch(`${API_BASE}/status`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`status_${res.status}`);
  const json = (await res.json()) as {
    measurement?: {
      coreStatus?: string;
      rpmMilli?: number;
      speedMmPerSecond?: number;
      distanceMm?: number;
      cumulativeWorkUnits?: string;
      observedAt?: string;
      freshness?: string;
    };
    builder?: { anchor?: { settledThroughRound?: string } };
  };
  let currentRound = String(currentRoundNow());
  try {
    const economy = await fetch(`${API_BASE}/economy/state`, {
      headers: { accept: "application/json" },
    });
    if (economy.ok) {
      const eco = (await economy.json()) as {
        capabilities?: { core?: { currentRound?: string } };
      };
      const n = Number(eco.capabilities?.core?.currentRound);
      if (Number.isFinite(n) && n > 0) currentRound = String(n);
    }
  } catch {
    /* keep clock-derived round */
  }
  const m = json.measurement ?? {};
  return {
    coreStatus: String(m.coreStatus ?? "UNKNOWN"),
    rpmMilli: Number(m.rpmMilli ?? 0),
    speedMmPerSecond: Number(m.speedMmPerSecond ?? 0),
    distanceMm: Number(m.distanceMm ?? 0),
    cumulativeWorkUnits: String(m.cumulativeWorkUnits ?? "0"),
    observedAt: String(m.observedAt ?? new Date().toISOString()),
    freshness: String(m.freshness ?? "unknown"),
    settledThroughRound: String(json.builder?.anchor?.settledThroughRound ?? "0"),
    currentRound,
    fetchedAt: Date.now(),
    stale: false,
  };
}

export type RoundWork = { roundId: number; work: number; dataHash: Hex; tx: Hex };

export async function fetchCoreEvents(): Promise<RoundWork[]> {
  const res = await fetch(`${API_BASE}/core`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`core_${res.status}`);
  const json = (await res.json()) as {
    configuration?: { genesisTimestamp?: string; roundDuration?: string };
    events?: {
      eventName: string;
      transactionHash: string;
      arguments: { name: string; value: string }[];
    }[];
  };
  const recorded: RoundWork[] = [];
  for (const ev of json.events ?? []) {
    if (ev.eventName !== "RoundRecorded") continue;
    const arg = (name: string) => ev.arguments.find((a) => a.name === name)?.value;
    recorded.push({
      roundId: Number(arg("roundId")),
      work: Number(arg("work")),
      dataHash: (arg("dataHash") ?? "0x0") as Hex,
      tx: ev.transactionHash as Hex,
    });
  }
  return recorded;
}

export async function fetchBatchFrontier(): Promise<{
  settledThroughRound: number;
  digests: Record<number, Hex>;
}> {
  const res = await fetch(`${API_BASE}/core`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`core_${res.status}`);
  const json = (await res.json()) as {
    core?: { settledThroughRound?: string };
    events?: { eventName: string; arguments: { name: string; value: string }[] }[];
  };
  const digests: Record<number, Hex> = {};
  for (const ev of json.events ?? []) {
    if (ev.eventName !== "BatchSettled") continue;
    const settled = Number(ev.arguments.find((a) => a.name === "settledThroughRound")?.value);
    const prev = Number(
      ev.arguments.find((a) => a.name === "previousSettledThroughRound")?.value,
    );
    const digest = (ev.arguments.find((a) => a.name === "digest")?.value ?? "0x0") as Hex;
    for (let r = prev + 1; r <= settled; r++) digests[r] = digest;
  }
  return {
    settledThroughRound: Number(json.core?.settledThroughRound ?? 0),
    digests,
  };
}

export async function readAccount(address: string): Promise<{
  tokens: { tokenId: string; level: number }[];
  hero: ReturnType<typeof pickHeroSqueek>;
}> {
  const res = await fetch(`${API_BASE}/accounts/${address}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`account_${res.status}`);
  const json = (await res.json()) as {
    error?: string;
    tokens?: { tokenId: string; level: number }[];
  };
  if (json.error) return { tokens: [], hero: null };
  const tokens = (json.tokens ?? []).map((t) => ({
    tokenId: String(t.tokenId),
    level: Number(t.level ?? 1),
  }));
  return { tokens, hero: pickHeroSqueek(tokens) };
}

export function currentRoundNow(nowSec = Math.floor(Date.now() / 1000)): number {
  return Math.floor((nowSec - GENESIS_TIMESTAMP) / ROUND_DURATION_SEC);
}

export { client, coreAbi, CHAIN_ID, COLLECTION_ADDRESS, CORE_ADDRESS, classFromTokenId };
