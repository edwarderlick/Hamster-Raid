import { describe, expect, it } from "vitest";
import { pickLastHit, verifyLastHit } from "../lastHit";

const HASH = "0x9109e249a27b4d7677fe2b17d71d2b6cb7228eee7ac9db0c0820d2c54ceb3828";

describe("pickLastHit", () => {
  it("is deterministic for the same hash, round, and roster", () => {
    const roster = ["0xaaa", "0xbbb", "0xccc"];
    const a = pickLastHit(HASH, 210, roster);
    const b = pickLastHit(HASH, 210, [...roster].reverse());
    expect(a).toBe(b);
    expect(a).toMatch(/^0x/);
  });

  it("changes when the round id changes", () => {
    const roster = ["0xaaa", "0xbbb", "0xccc"];
    expect(pickLastHit(HASH, 210, roster)).not.toBeUndefined();
    const many = new Set(
      Array.from({ length: 40 }, (_, i) => pickLastHit(HASH, i, roster)),
    );
    expect(many.size).toBeGreaterThan(1);
  });

  it("returns null for an empty roster", () => {
    expect(pickLastHit(HASH, 1, [])).toBeNull();
  });

  it("verifies a claimed winner", () => {
    const roster = ["0x111", "0x222"];
    const winner = pickLastHit(HASH, 204, roster)!;
    expect(verifyLastHit(HASH, 204, roster, winner)).toBe(true);
    expect(verifyLastHit(HASH, 204, roster, "0xdead")).toBe(false);
  });
});
