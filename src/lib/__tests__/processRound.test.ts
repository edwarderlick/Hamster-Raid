import { describe, expect, it } from "vitest";
import { applyRound, applySurge, freshBoss } from "../processRound";

const HASH = "0x148d43c1ff79feb26321bf9aa3d032104e502f8725f4225b282d4bd18c430939";

describe("applyRound idempotency", () => {
  it("never counts the same round twice", () => {
    const ready = [{ address: "0xabc", level: 2 }];
    const first = applyRound({
      boss: freshBoss(0, 100),
      roundId: 205,
      work: 40,
      dataHash: HASH,
      ready,
      processedIds: new Set(),
    });
    const second = applyRound({
      boss: first.boss,
      roundId: 205,
      work: 40,
      dataHash: HASH,
      ready,
      processedIds: new Set([205]),
    });
    expect(first.result.alreadyProcessed).toBeUndefined();
    expect(second.result.alreadyProcessed).toBe(true);
    expect(second.boss.hp).toBe(first.boss.hp);
  });
});

describe("naps and zoomies", () => {
  it("heals and enrages on zero work", () => {
    const { boss, result } = applyRound({
      boss: { ...freshBoss(0, 100), hp: 80 },
      roundId: 1,
      work: 0,
      dataHash: HASH,
      ready: [{ address: "0xabc", level: 1 }],
      processedIds: new Set(),
    });
    expect(result.healed).toBeGreaterThan(0);
    expect(boss.hp).toBe(83);
    expect(boss.enrage).toBe(1);
    expect(result.damage).toBe(0);
  });

  it("kills when damage meets remaining HP and records last hit", () => {
    const { boss, result } = applyRound({
      boss: freshBoss(0, 50),
      roundId: 204,
      work: 316,
      dataHash: HASH,
      ready: [
        { address: "0xaaa", level: 1 },
        { address: "0xbbb", level: 4 },
      ],
      processedIds: new Set(),
    });
    expect(result.killed).toBe(true);
    expect(boss.hp).toBe(0);
    expect(boss.defeatedAtRound).toBe(204);
    expect(result.lastHit).toMatch(/^0x/);
  });
});

describe("applySurge", () => {
  it("ticks global HP without rewriting a hash last-hit", () => {
    const start = { ...freshBoss(0, 100), lastHit: "0xabc" };
    const next = applySurge(start, 12);
    expect(next.hp).toBe(88);
    expect(next.totalDamage).toBe(12);
    expect(next.lastHit).toBe("0xabc");
  });

  it("caps a single surge tick and ignores defeated bosses", () => {
    expect(applySurge(freshBoss(0, 100), 999).hp).toBe(60);
    const dead = { ...freshBoss(0, 100), hp: 0, defeatedAtRound: 3 };
    expect(applySurge(dead, 10).hp).toBe(0);
  });
});
