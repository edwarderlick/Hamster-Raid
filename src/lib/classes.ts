export type HeroClass = "raider" | "wanderer" | "brawler" | "mystic" | "trickster";

export const RAIDER = {
  name: "Pip Wheelrunner",
  title: "Wheel Raider",
  blurb: "One hamster. Five guns. A real wheel at his back.",
  accent: "#2ee9ff",
};

export function migrateHero(c: string | undefined): "raider" | "wanderer" {
  if (c === "wanderer") return "wanderer";
  return "raider";
}

export function classFromTokenId(_tokenId: number | string): "raider" {
  return "raider";
}

export function pickHeroSqueek(
  tokens: { tokenId: string; level: number }[],
): { tokenId: string; level: number; heroClass: "raider" } | null {
  if (tokens.length === 0) return null;
  const best = [...tokens].sort((a, b) => {
    if (b.level !== a.level) return b.level - a.level;
    return Number(b.tokenId) - Number(a.tokenId);
  })[0]!;
  return { tokenId: best.tokenId, level: best.level, heroClass: "raider" };
}
