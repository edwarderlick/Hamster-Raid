import { describe, expect, it } from "vitest";
import { wheelSeconds } from "../../components/LandStage";

describe("wheelSeconds", () => {
  it("creeps when napping or at 0 RPM", () => {
    expect(wheelSeconds(0, true)).toBe(90);
    expect(wheelSeconds(0, false)).toBe(90);
    expect(wheelSeconds(0.02, false)).toBe(90);
  });

  it("maps live RPM into an 8–60s turn", () => {
    expect(wheelSeconds(8, false)).toBe(30);
    expect(wheelSeconds(2, false)).toBe(48);
    expect(wheelSeconds(80, false)).toBe(8);
    expect(wheelSeconds(0.2, false)).toBeLessThanOrEqual(60);
  });
});
