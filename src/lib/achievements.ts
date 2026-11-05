export type AchievementId =
  | "first-blood"
  | "last-hit"
  | "seven-streak"
  | "nap-survivor"
  | "zoomies-ready"
  | "boss-slayer"
  | "spectator-scholar";

export const ACHIEVEMENTS: Record<
  AchievementId,
  { name: string; blurb: string }
> = {
  "first-blood": { name: "First Blood", blurb: "Deal damage in your first ready round." },
  "last-hit": { name: "Last Hit", blurb: "Be the hash-chosen last hitter on a round." },
  "seven-streak": { name: "Seven-Round Streak", blurb: "Ready up seven settled rounds in a row." },
  "nap-survivor": { name: "Nap Survivor", blurb: "Stay ready through three nap rounds." },
  "zoomies-ready": { name: "Zoomies Rider", blurb: "Be ready for three zoomies rounds." },
  "boss-slayer": { name: "Boss Slayer", blurb: "Land the last hit that drops a weekly boss." },
  "spectator-scholar": { name: "Wheel Watcher", blurb: "Open the raid in spectator mode." },
};

export const COSMETICS = [
  { id: "frame-ember", name: "Ember Frame", track: 1 },
  { id: "aura-volt", name: "Volt Aura", track: 3 },
  { id: "name-glitch", name: "Glitch Name", track: 5 },
  { id: "frame-crown", name: "Last-Hit Crown", track: 8 },
  { id: "aura-void", name: "Night Coil Aura", track: 10 },
] as const;

export const QUESTS = [
  { id: "daily-ready-3", name: "Stand the Wheel", blurb: "Ready up for 3 rounds today.", target: 3, period: "daily" },
  { id: "weekly-zoomies", name: "Chase Zoomies", blurb: "Be ready for 3 zoomies rounds this week.", target: 3, period: "weekly" },
  { id: "weekly-last-hit", name: "Hash Luck", blurb: "Earn a last-hit once this week.", target: 1, period: "weekly" },
] as const;
