export type BossId =
  | "gearmaw"
  | "naplord"
  | "voltspindle"
  | "iron-pellet"
  | "night-coil"
  | "rust-crown";

export type BossDef = {
  id: BossId;
  name: string;
  title: string;
  lore: string;
  art: string;
  artNote: string;
  accent: string;
};

export const BOSSES: BossDef[] = [
  {
    id: "gearmaw",
    name: "The Gearmaw",
    title: "Week I — The Foundry Titan",
    lore: "A furnace stuffed into a clockwork colossus. It keeps a hamster wheel as a trophy and a battery. Every magnet passage chips a tooth from its grin.",
    art: "/art/gearmaw.jpg",
    artNote: "Concept art (attached).",
    accent: "#ff6a00",
  },
  {
    id: "naplord",
    name: "The Naplord",
    title: "Week II — Sovereign of Stillness",
    lore: "A velvet-robed construct that feeds on idle rounds. When Squeektoshi sleeps, the Naplord heals. Wake the wheel or watch the HP bar crawl backwards.",
    art: "/art/boss-naplord.svg",
    artNote: "Original SVG illustration.",
    accent: "#7af6ff",
  },
  {
    id: "voltspindle",
    name: "Voltspindle",
    title: "Week III — The Live Wire",
    lore: "A spindle of cyan lightning wrapped around rusted axles. Zoomies rounds overload it. Jog rounds barely sting.",
    art: "/art/boss-voltspindle.svg",
    artNote: "Original SVG illustration.",
    accent: "#2ee9ff",
  },
  {
    id: "iron-pellet",
    name: "Iron Pellet",
    title: "Week IV — The Hoarded Core",
    lore: "A spherical vault of stolen sunflower seeds and pig iron. Last-hitters crack the shell. Everyone else just dents it.",
    art: "/art/boss-iron-pellet.svg",
    artNote: "Original SVG illustration.",
    accent: "#ffb347",
  },
  {
    id: "night-coil",
    name: "The Night Coil",
    title: "Week V — After-Hours Predator",
    lore: "It hunts in the dark hours of the livestream. Enrage stacks faster after consecutive naps.",
    art: "/art/boss-night-coil.svg",
    artNote: "Original SVG illustration.",
    accent: "#c084fc",
  },
  {
    id: "rust-crown",
    name: "Rust Crown",
    title: "Week VI — The Abdicated King",
    lore: "A discarded crown of oxidised gears. It remembers every last-hit name and repeats them in the story log like a curse.",
    art: "/art/boss-rust-crown.svg",
    artNote: "Original SVG illustration.",
    accent: "#e56a00",
  },
];

export function bossForWeek(weekIndex: number): BossDef {
  return BOSSES[Math.abs(weekIndex) % BOSSES.length]!;
}
