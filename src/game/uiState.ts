import type { ZoneId } from "./maps";

export type Overlay =
  | "none"
  | "pause"
  | "inventory"
  | "dialogue"
  | "shop"
  | "skills"
  | "dead"
  | "questlog"
  | "map"
  | "controls"
  | "equip"
  | "help"
  | "settings"
  | "journal"
  | "levelup"
  | "victory"
  | "gameover"
  | "upgrade"
  | "skip";

export const TUTORIAL = [
  { id: "move", key: "WASD", label: "Move", text: "Walk with WASD or the stick." },
  { id: "attack", key: "J", label: "Attack", text: "Press J to swing. Hit the dummy." },
  { id: "roll", key: "SPC", label: "Roll", text: "Space to roll through a hit." },
  { id: "talk", key: "F", label: "Talk", text: "Walk to the Miller and press F." },
  { id: "pack", key: "I", label: "Pack", text: "Press I to open your pack." },
] as const;

export type TutorialId = (typeof TUTORIAL)[number]["id"];

export function advanceTutorial(step: number, event: string): number {
  const cur = TUTORIAL[step];
  if (!cur) return step;
  if (cur.id === event) return Math.min(step + 1, TUTORIAL.length);
  return step;
}

export function tutorialDone(step: number) {
  return step >= TUTORIAL.length;
}

export function overlayToggle(current: Overlay, next: Overlay): Overlay {
  if (current === next) return "none";
  return next;
}

export function rarityColor(r: string) {
  if (r === "relic") return "#ff8a1f";
  if (r === "rare") return "#b56cff";
  if (r === "uncommon") return "#3dcc6e";
  return "#f0ddb4";
}

export type Objective = {
  text: string;
  zone: ZoneId;
  x: number;
  y: number;
};

const STAGES: Objective[] = [
  { text: "Talk to the Miller", zone: "haven", x: 18, y: 16 },
  { text: "Clear Cogwood mites", zone: "forest", x: 20, y: 8 },
  { text: "Rest at a Wheel Shrine", zone: "haven", x: 24, y: 10 },
  { text: "Enter the Foundry", zone: "forest", x: 48, y: 24 },
  { text: "Fell the Gearmaw", zone: "foundry", x: 18, y: 12 },
];

export function currentObjective(save: {
  tutorialStep: number;
  flags: Record<string, boolean>;
  quests: { id: string; stage: number }[];
  zone: ZoneId;
}): Objective {
  if (!save.flags.skipTutorial && save.tutorialStep < TUTORIAL.length) {
    const t = TUTORIAL[save.tutorialStep]!;
    if (t.id === "attack") return { text: "Hit the training dummy (J)", zone: "haven", x: 14, y: 13 };
    if (t.id === "talk") return { text: "Talk to the Miller (F)", zone: "haven", x: 18, y: 16 };
    if (t.id === "pack") return { text: "Open your pack (I)", zone: "haven", x: 20, y: 16 };
    if (t.id === "roll") return { text: "Roll with Space", zone: "haven", x: 20, y: 16 };
    return { text: "Walk the plaza (WASD)", zone: "haven", x: 24, y: 16 };
  }
  const q = save.quests.find((x) => x.id === "main-1");
  const stage = q?.stage ?? 0;
  return STAGES[Math.min(stage, STAGES.length - 1)]!;
}

export function tileDist(ax: number, ay: number, bx: number, by: number) {
  return Math.round(Math.hypot(ax - bx, ay - by));
}

export function promptFor(id: string | null) {
  if (!id) return null;
  if (id.startsWith("portal")) return { key: "F", verb: "Enter" };
  if (id.startsWith("chest")) return { key: "F", verb: "Open" };
  if (id.startsWith("shrine")) return { key: "F", verb: "Rest" };
  if (id.startsWith("lever")) return { key: "F", verb: "Pull" };
  if (id.startsWith("door")) return { key: "F", verb: "Open" };
  return { key: "F", verb: "Talk" };
}
