import { getAddress } from "viem";
import {
  CHAIN_ID,
  ROUND_DURATION_SEC,
  roundStartUnix,
  weekIndexFromRound,
} from "../../src/lib/constants";
import { bossForWeek } from "../../src/lib/bosses";
import { playerWeight } from "../../src/lib/damage";
import { pickLastHit } from "../../src/lib/lastHit";
import {
  buildSignMessage,
  randomNonce,
  verifySignedIntent,
  type SignedIntent,
} from "../../src/lib/signatures";
import { currentRoundNow, readAccount } from "./chain";
import { processSettledRounds, refreshStatus, weeklyLeaderboard } from "./process";
import { applySurge } from "../../src/lib/processRound";
import { rateLimit } from "./rateLimit";
import { ensureProfile, loadStore, saveStore } from "./store";
import type { ApiReq, ApiRes } from "./types";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,authorization,x-cron-secret",
};

function json(status: number, body: unknown): ApiRes {
  return { status, json: body, headers: CORS };
}

function parseIntent(body: unknown): { intent: SignedIntent; signature: `0x${string}` } {
  const b = body as { intent?: SignedIntent; signature?: string };
  if (!b?.intent || !b.signature) throw new Error("missing_intent");
  return { intent: b.intent, signature: b.signature as `0x${string}` };
}

export async function handleApi(req: ApiReq): Promise<ApiRes> {
  if (req.method === "OPTIONS") return json(204, {});
  const url = new URL(req.url, "http://local");
  const route = url.pathname.replace(/\/+$/, "") || "/";

  try {
    if (route === "/api/raid" && req.method === "GET") {
      const store = await processSettledRounds().catch(() => loadStore());
      await refreshStatus(store);
      await saveStore(store);
      const currentRound = Number(store.lastStatus?.currentRound ?? currentRoundNow());
      const week = weekIndexFromRound(currentRound);
      const boss = bossForWeek(store.week);
      const start = roundStartUnix(currentRound);
      const endsAt = start + ROUND_DURATION_SEC;
      const ready = store.ready[String(currentRound)] ?? [];
      return json(200, {
        status: store.lastStatus,
        week,
        currentRound,
        roundEndsAt: endsAt,
        boss: {
          ...boss,
          ...store.boss,
          phase:
            store.boss.hp / store.boss.hpMax > 0.75
              ? 1
              : store.boss.hp / store.boss.hpMax > 0.5
                ? 2
                : store.boss.hp / store.boss.hpMax > 0.25
                  ? 3
                  : 4,
        },
        ready,
        readyCount: ready.length,
        story: store.story.slice(-24).reverse(),
        processed: Object.values(store.processed)
          .sort((a, b) => b.roundId - a.roundId)
          .slice(0, 16),
        leaderboard: weeklyLeaderboard(store),
        graveyard: store.graveyard.slice(0, 12),
        toasts: store.toasts.slice(-8),
        joins: Object.keys(store.joins).length,
      });
    }

    if (route === "/api/nonce" && req.method === "POST") {
      if (!rateLimit(`nonce:${req.ip}`, 20, 60_000)) return json(429, { error: "rate_limited" });
      const address = getAddress(String((req.body as { address?: string })?.address ?? ""));
      const store = await loadStore();
      const nonce = randomNonce();
      const expiresAt = Date.now() + 5 * 60_000;
      store.nonces[address.toLowerCase()] = { nonce, expiresAt };
      await saveStore(store);
      const currentRound = Number((await loadStore()).lastStatus?.currentRound ?? currentRoundNow());
      const week = weekIndexFromRound(currentRound);
      return json(200, { nonce, expiresAt, week, currentRound, chainId: CHAIN_ID });
    }

    if (route === "/api/join" && req.method === "POST") {
      if (!rateLimit(`join:${req.ip}`, 10, 60_000)) return json(429, { error: "rate_limited" });
      const { intent, signature } = parseIntent(req.body);
      const verified = await verifySignedIntent(intent, signature, {
        action: "join",
        chainId: CHAIN_ID,
      });
      if (!verified.ok) return json(400, { error: verified.error });
      const address = getAddress(intent.address).toLowerCase();
      const store = await loadStore();
      const expected = store.nonces[address];
      if (!expected || expected.nonce !== intent.nonce) return json(400, { error: "bad_nonce" });
      delete store.nonces[address];
      const account = await readAccount(address);
      const spectator = !account.hero;
      store.joins[address] = {
        address,
        week: intent.week,
        joinedAt: Date.now(),
        tokenId: account.hero?.tokenId ?? "0",
        level: account.hero?.level ?? 1,
        heroClass: account.hero?.heroClass ?? "raider",
        spectator,
      };
      const profile = ensureProfile(store, address);
      if (spectator) {
        if (!profile.badges.includes("spectator-scholar")) {
          profile.badges.push("spectator-scholar");
        }
      }
      await saveStore(store);
      return json(200, {
        join: store.joins[address],
        tokens: account.tokens,
        profile,
        weight: playerWeight(account.hero?.level ?? 1),
        message: buildSignMessage(intent),
      });
    }

    if (route === "/api/ready" && req.method === "POST") {
      if (!rateLimit(`ready:${req.ip}`, 20, 60_000)) return json(429, { error: "rate_limited" });
      const { intent, signature } = parseIntent(req.body);
      const verified = await verifySignedIntent(intent, signature, {
        action: "ready",
        chainId: CHAIN_ID,
      });
      if (!verified.ok) return json(400, { error: verified.error });
      const address = getAddress(intent.address).toLowerCase();
      const store = await loadStore();
      const expected = store.nonces[address];
      if (!expected || expected.nonce !== intent.nonce) return json(400, { error: "bad_nonce" });
      delete store.nonces[address];
      if (!store.joins[address] || store.joins[address]!.spectator) {
        return json(403, { error: "join_with_squeek_first" });
      }
      const currentRound = Number(store.lastStatus?.currentRound ?? currentRoundNow());
      const round = intent.round ?? currentRound;
      if (round !== currentRound) return json(400, { error: "stale_round" });
      const list = new Set(store.ready[String(round)] ?? []);
      list.add(address);
      store.ready[String(round)] = [...list];
      const p = ensureProfile(store, address);
      const dayKey = new Date().toISOString().slice(0, 10);
      if (p.dailyKey !== dayKey) {
        p.dailyKey = dayKey;
        p.dailyReady = 0;
      }
      p.dailyReady += 1;
      await saveStore(store);
      return json(200, {
        round,
        ready: store.ready[String(round)],
        previewLastHit: pickLastHit("0xpreview", round, store.ready[String(round)] ?? []),
      });
    }

    if (route === "/api/profile" && req.method === "GET") {
      const address = String(url.searchParams.get("address") ?? "").toLowerCase();
      const store = await loadStore();
      return json(200, {
        profile: address ? store.profiles[address] ?? null : null,
        join: address ? store.joins[address] ?? null : null,
      });
    }

    if (route === "/api/process" && req.method === "POST") {
      if (!rateLimit(`process:${req.ip}`, 6, 60_000)) return json(429, { error: "rate_limited" });
      const store = await processSettledRounds();
      return json(200, { processed: store.processedIds.slice(-8), boss: store.boss });
    }

    if (route === "/api/save" && req.method === "GET") {
      const address = String(url.searchParams.get("address") ?? "").toLowerCase();
      if (!address) return json(400, { error: "missing_address" });
      const store = await loadStore();
      store.saves ??= {};
      return json(200, { blob: store.saves[address] ?? null });
    }

    if (route === "/api/save" && req.method === "POST") {
      if (!rateLimit(`save:${req.ip}`, 30, 60_000)) return json(429, { error: "rate_limited" });
      const body = req.body as { address?: string; blob?: unknown; intent?: SignedIntent; signature?: string };
      const address = getAddress(String(body?.address ?? body?.intent?.address ?? "")).toLowerCase();
      if (!body?.blob || typeof body.blob !== "object") return json(400, { error: "missing_blob" });
      const store = await loadStore();
      store.saves ??= {};
      if (body.intent && body.signature) {
        const verified = await verifySignedIntent(body.intent, body.signature as `0x${string}`, {
          action: "save",
          chainId: CHAIN_ID,
        });
        if (!verified.ok) return json(400, { error: verified.error });
        const expected = store.nonces[address];
        if (!expected || expected.nonce !== body.intent.nonce) return json(400, { error: "bad_nonce" });
        delete store.nonces[address];
      }
      store.saves[address] = body.blob;
      await saveStore(store);
      return json(200, { ok: true });
    }

    if (route === "/api/surge" && req.method === "POST") {
      if (!rateLimit(`surge:${req.ip}`, 20, 60_000)) return json(429, { error: "rate_limited" });
      const body = req.body as { damage?: number; address?: string };
      const damage = Number(body?.damage ?? 0);
      const store = await loadStore();
      store.boss = applySurge(store.boss, damage);
      if (store.boss.hp === 0 && store.boss.defeatedAtRound === -1) {
        store.toasts.push({
          id: `surge-kill-${Date.now()}`,
          text: "A Wheel Surge cracked the weekly wound to zero.",
          at: Date.now(),
        });
      }
      await saveStore(store);
      return json(200, { boss: store.boss });
    }

    if (route === "/api/cron" && (req.method === "GET" || req.method === "POST")) {
      const secret = process.env.CRON_SECRET;
      if (secret && req.headers["x-cron-secret"] !== secret && url.searchParams.get("secret") !== secret) {
        const ua = req.headers["user-agent"] ?? "";
        if (!ua.includes("vercel-cron")) return json(401, { error: "unauthorized" });
      }
      const store = await processSettledRounds();
      return json(200, { ok: true, through: store.processedIds.at(-1) ?? null });
    }

    return json(404, { error: "not_found", route });
  } catch (err) {
    return json(400, { error: "bad_request", detail: String(err) });
  }
}
