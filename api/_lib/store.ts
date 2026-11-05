import fs from "node:fs";
import path from "node:path";
import { freshBoss } from "../../src/lib/processRound";
import type { Profile, Store } from "./types";

const DATA_PATH = path.join(process.cwd(), ".data", "store.json");

function emptyStore(): Store {
  return {
    week: 0,
    boss: freshBoss(0),
    joins: {},
    ready: {},
    processed: {},
    processedIds: [],
    story: [],
    profiles: {},
    graveyard: [],
    nonces: {},
    lastStatus: null,
    leaderboardWeek: 0,
    toasts: [],
    saves: {},
  };
}

let memory: Store | null = null;

async function kvGet(): Promise<Store | null> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  const res = await fetch(`${url}/get/hamster-raid`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { result?: string | null };
  if (!json.result) return null;
  return JSON.parse(json.result) as Store;
}

async function kvSet(store: Store): Promise<boolean> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return false;
  await fetch(`${url}/set/hamster-raid`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ value: JSON.stringify(store) }),
  });
  return true;
}

function readFileStore(): Store {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf8");
    return JSON.parse(raw) as Store;
  } catch {
    return emptyStore();
  }
}

function writeFileStore(store: Store) {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(store));
}

export async function loadStore(): Promise<Store> {
  if (memory) return memory;
  const fromKv = await kvGet();
  memory = fromKv ?? readFileStore();
  memory.saves ??= {};
  return memory;
}

export async function saveStore(store: Store): Promise<void> {
  memory = store;
  const ok = await kvSet(store);
  if (!ok) writeFileStore(store);
}

export function ensureProfile(store: Store, address: string): Profile {
  const key = address.toLowerCase();
  if (!store.profiles[key]) {
    store.profiles[key] = {
      address: key,
      xp: 0,
      level: 1,
      titles: [],
      badges: [],
      streak: 0,
      bestStreak: 0,
      cosmetics: [],
      seasonXp: 0,
      lastReadyRound: null,
      napReady: 0,
      zoomiesReady: 0,
      dailyReady: 0,
      dailyKey: "",
      weeklyLastHits: 0,
      weeklyZoomies: 0,
    };
  }
  return store.profiles[key]!;
}
