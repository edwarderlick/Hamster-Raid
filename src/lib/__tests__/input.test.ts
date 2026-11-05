import { describe, expect, it } from "vitest";
import { clampNum, clampSave, modeFromOverlay, failReason } from "../../game/input";
import { freshSave } from "../../game/store";
import { advanceTutorial } from "../../game/uiState";

describe("clampSave", () => {
  it("never lets hp stamina gold xp go negative", () => {
    const s = freshSave("brawler", 1, true);
    const bad = clampSave({ ...s, hp: -13, stamina: -4, gold: -9, xp: -2, wheelCharge: 140 });
    expect(bad.hp).toBe(0);
    expect(bad.stamina).toBe(0);
    expect(bad.gold).toBe(0);
    expect(bad.xp).toBe(0);
    expect(bad.wheelCharge).toBe(100);
  });
  it("caps hp at max", () => {
    const s = freshSave("brawler", 1, true);
    expect(clampSave({ ...s, hp: 999 }).hp).toBe(s.hpMax);
  });
});

describe("clampNum", () => {
  it("handles NaN", () => {
    expect(clampNum(Number.NaN, 0, 10)).toBe(0);
  });
});

describe("input mode", () => {
  it("maps overlays to a single state machine", () => {
    expect(modeFromOverlay("none")).toBe("gameplay");
    expect(modeFromOverlay("dialogue")).toBe("dialogue");
    expect(modeFromOverlay("dead")).toBe("dead");
    expect(modeFromOverlay("gameover")).toBe("dead");
    expect(modeFromOverlay("inventory")).toBe("menu");
    expect(modeFromOverlay("victory")).toBe("menu");
    expect(modeFromOverlay("upgrade")).toBe("menu");
    expect(modeFromOverlay("help")).toBe("menu");
  });
});

describe("failReason", () => {
  it("names blocked actions", () => {
    expect(failReason("stamina")).toBe("Not enough stamina");
    expect(failReason("range")).toBe("Nothing to interact with");
    expect(failReason("cooldown", "On cooldown 2.1s")).toBe("On cooldown 2.1s");
  });
});

describe("tutorial events", () => {
  it("does not complete attack from a move event", () => {
    expect(advanceTutorial(1, "move")).toBe(1);
    expect(advanceTutorial(1, "attack")).toBe(2);
    expect(advanceTutorial(2, "roll")).toBe(3);
  });
});
