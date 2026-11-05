import { describe, expect, it } from "vitest";
import { advanceTutorial, overlayToggle, rarityColor, tutorialDone, TUTORIAL, currentObjective, promptFor } from "../../game/uiState";
import { ZONES } from "../../game/maps";
import { KT, XT } from "../../game/palette";
import { computeInternalWidth, computeUiScale, powerRating, INTERNAL_H } from "../../game/scale";

describe("tutorial", () => {
  it("advances only on the matching event", () => {
    expect(advanceTutorial(0, "attack")).toBe(0);
    expect(advanceTutorial(0, "move")).toBe(1);
    expect(advanceTutorial(1, "attack")).toBe(2);
    expect(tutorialDone(TUTORIAL.length)).toBe(true);
  });
});

describe("overlayToggle", () => {
  it("closes when the same overlay is requested", () => {
    expect(overlayToggle("inventory", "inventory")).toBe("none");
    expect(overlayToggle("none", "pause")).toBe("pause");
  });
});

describe("rarityColor", () => {
  it("returns palette colors", () => {
    expect(rarityColor("relic")).toBe("#ff8a1f");
    expect(rarityColor("rare")).toBe("#b56cff");
    expect(rarityColor("common")).toBe("#f0ddb4");
  });
});

describe("currentObjective", () => {
  it("points a new player at the plaza walk", () => {
    const o = currentObjective({
      tutorialStep: 0,
      flags: {},
      quests: [{ id: "main-1", stage: 0 }],
      zone: "haven",
    });
    expect(o.text).toMatch(/Walk/);
  });
  it("uses story stages after skip", () => {
    const o = currentObjective({
      tutorialStep: 5,
      flags: { skipTutorial: true },
      quests: [{ id: "main-1", stage: 0 }],
      zone: "haven",
    });
    expect(o.text).toBe("Talk to the Miller");
  });
});

describe("promptFor", () => {
  it("labels interactables", () => {
    expect(promptFor("miller")?.verb).toBe("Talk");
    expect(promptFor("portal:forest:west")?.verb).toBe("Enter");
    expect(promptFor("chest:x")?.verb).toBe("Open");
  });
});

describe("scale", () => {
  it("keeps height 270 and widens for ultrawide", () => {
    expect(INTERNAL_H).toBe(270);
    expect(computeInternalWidth(2560, 1080)).toBeGreaterThan(computeInternalWidth(1920, 1080));
    expect(computeInternalWidth(1920, 1080)).toBe(480);
  });
  it("scales HUD to readable 1080p sizes", () => {
    const u = computeUiScale(1080, 0, 1920);
    expect(u).toBeGreaterThanOrEqual(2);
    expect(8 * u).toBeGreaterThanOrEqual(18);
    expect(11 * u).toBeGreaterThanOrEqual(24);
  });
  it("rates power from stats", () => {
    expect(powerRating({ atk: 8, def: 4, hpMax: 42, level: 1 })).toBe(8 + 4 + 5 + 1);
  });
});

describe("zones", () => {
  it("builds designed maps with plaza, water, and foundry metal", () => {
    const haven = ZONES.haven;
    expect(haven.ground).toContain(KT.plaza);
    expect(haven.ground).toContain(XT.water);
    expect(haven.decor).toContain(KT.roofO);
    expect(haven.decor).toContain(KT.castleT);
    expect(ZONES.forest.objects.some((o) => o.kind === "enemy")).toBe(true);
    expect(ZONES.mines.ground).toContain(XT.railH);
    expect(ZONES.foundry.ground).toContain(XT.foundry);
    expect(haven.cols * haven.rows).toBe(haven.ground.length);
  });
});
