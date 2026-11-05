import { describe, expect, it } from "vitest";
import { playerWeight, splitDamage, outgoingDamage } from "../damage";

describe("playerWeight", () => {
  it("is 105 at level 1 and 150 at level 10", () => {
    expect(playerWeight(1)).toBe(105);
    expect(playerWeight(10)).toBe(150);
  });
  it("clamps junk levels", () => {
    expect(playerWeight(0)).toBe(105);
    expect(playerWeight(99)).toBe(150);
  });
});

describe("splitDamage", () => {
  it("splits 100 work by weight and gives remainder to last-hit", () => {
    const shares = splitDamage(
      100,
      [
        { address: "0xAAA", level: 1 },
        { address: "0xBBB", level: 10 },
      ],
      "0xaaa",
    );
    const total = shares.reduce((s, x) => s + x.damage, 0);
    expect(total).toBe(100);
    const a = shares.find((s) => s.address === "0xaaa")!;
    const b = shares.find((s) => s.address === "0xbbb")!;
    expect(b.damage).toBeGreaterThan(a.damage);
  });

  it("returns zeros when work is 0", () => {
    const shares = splitDamage(0, [{ address: "0x1", level: 3 }]);
    expect(shares[0]!.damage).toBe(0);
  });

  it("never lets a high level take the whole pot alone against peers", () => {
    const shares = splitDamage(1000, [
      { address: "0x1", level: 1 },
      { address: "0x2", level: 10 },
    ]);
    const low = shares.find((s) => s.address === "0x1")!.damage;
    expect(low).toBeGreaterThan(300);
    expect(low).toBeLessThan(500);
  });
});

describe("outgoingDamage", () => {
  it("adds 4% per enrage stack", () => {
    expect(outgoingDamage(100, 0)).toBe(100);
    expect(outgoingDamage(100, 1)).toBe(104);
  });
});
