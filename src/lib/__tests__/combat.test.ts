import { describe, expect, it } from "vitest";
import { applyDefense, rollDamage, squeekMul, xpToNext } from "../combat";
import { buySkill, freshSave } from "../../game/store";

describe("squeekMul", () => {
  it("is a small bonus, 4% per level after 1, capped at 10", () => {
    expect(squeekMul(1)).toBe(1);
    expect(squeekMul(10)).toBeCloseTo(1.36);
  });
});

describe("rollDamage", () => {
  it("scales with combo and never pays to win", () => {
    const a = rollDamage({
      baseAtk: 10,
      weaponAtk: 0,
      comboIndex: 0,
      crit: false,
      squeekLevel: 1,
    });
    const b = rollDamage({
      baseAtk: 10,
      weaponAtk: 0,
      comboIndex: 2,
      crit: false,
      squeekLevel: 1,
    });
    const maxSqueek = rollDamage({
      baseAtk: 10,
      weaponAtk: 0,
      comboIndex: 0,
      crit: false,
      squeekLevel: 10,
    });
    expect(b).toBeGreaterThan(a);
    expect(maxSqueek / a).toBeLessThan(1.5);
  });

  it("surge and backstab multiply, defense floors at 1", () => {
    const s = rollDamage({
      baseAtk: 8,
      weaponAtk: 2,
      comboIndex: 0,
      crit: false,
      squeekLevel: 1,
      surge: true,
    });
    expect(s).toBeGreaterThan(20);
    expect(applyDefense(4, 99)).toBe(1);
  });
});

describe("xpToNext", () => {
  it("rises with level", () => {
    expect(xpToNext(2)).toBeGreaterThan(xpToNext(1));
  });
});

describe("buySkill", () => {
  it("spends a point and applies Thick Fur", () => {
    const s = { ...freshSave("brawler", 1, false), statPoints: 1 };
    const next = buySkill(s, "hp1");
    expect(next?.hpMax).toBe(s.hpMax + 10);
    expect(next?.statPoints).toBe(0);
    expect(buySkill(s, "ult")).toBeNull();
  });
});
