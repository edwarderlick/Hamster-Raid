import type { Overlay } from "./uiState";
import type { SaveBlob } from "./store";

export type InputMode = "gameplay" | "dialogue" | "menu" | "cutscene" | "dead";

export type InputLog = {
  t: number;
  key: string;
  action: string;
  ok: boolean;
  reason: string;
};

export function modeFromOverlay(overlay: Overlay): InputMode {
  if (overlay === "dead" || overlay === "gameover") return "dead";
  if (overlay === "dialogue") return "dialogue";
  if (overlay === "none") return "gameplay";
  return "menu";
}

export function gameplayOpen(overlay: Overlay) {
  return modeFromOverlay(overlay) === "gameplay";
}

export function clampNum(n: number, lo: number, hi: number) {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

export function clampSave(s: SaveBlob): SaveBlob {
  const hpMax = Math.max(1, s.hpMax);
  const staMax = Math.max(1, s.staminaMax);
  const heroClass = s.heroClass === "wanderer" ? "wanderer" : "raider";
  return {
    ...s,
    heroClass,
    name: s.name && s.name !== "brawler" && s.name !== "mystic" && s.name !== "trickster" && s.name !== "wanderer" ? s.name : "Pip Wheelrunner",
    hp: clampNum(s.hp, 0, hpMax),
    hpMax,
    stamina: clampNum(s.stamina, 0, staMax),
    staminaMax: staMax,
    gold: Math.max(0, Math.floor(s.gold)),
    xp: Math.max(0, s.xp),
    wheelCharge: clampNum(s.wheelCharge, 0, 100),
    level: Math.max(1, s.level),
  };
}

export function cdRemain(ms: number) {
  return Math.max(0, ms);
}

const logs: InputLog[] = [];

export function logInput(entry: Omit<InputLog, "t">) {
  logs.unshift({ ...entry, t: Date.now() });
  if (logs.length > 24) logs.pop();
  return logs[0]!;
}

export function inputLogs() {
  return logs;
}

export function clearInputLogs() {
  logs.length = 0;
}

export function failReason(kind: "stamina" | "cooldown" | "charge" | "range" | "mode" | "dead", extra = "") {
  if (kind === "stamina") return extra || "Not enough stamina";
  if (kind === "cooldown") return extra || "On cooldown";
  if (kind === "charge") return extra || "Need Wheel Charge";
  if (kind === "range") return extra || "Nothing to interact with";
  if (kind === "dead") return "You are down";
  return extra || "Can't do that now";
}
