export type AimMode = "mouse" | "auto" | "assist";

/** 8-way compass: 0=E 1=SE 2=S 3=SW 4=W 5=NW 6=N 7=NE */
export function dir8(ax: number, ay: number) {
  const a = Math.atan2(ay, ax);
  return ((Math.round(a / (Math.PI / 4)) + 8) % 8) as number;
}

export type AimIn = {
  mode: AimMode;
  pointerOver: boolean;
  mouse: { x: number; y: number };
  stick: { x: number; y: number } | null;
  nearest: { x: number; y: number } | null;
  move: { x: number; y: number };
  last: { x: number; y: number };
};

export function pointerWorld(cam: { scrollX: number; scrollY: number; zoom?: number }, px: number, py: number) {
  const z = cam.zoom || 1;
  return { x: cam.scrollX + px / z, y: cam.scrollY + py / z };
}

export function resolveAim(a: AimIn): { x: number; y: number; auto: boolean } {
  const stickLen = a.stick ? Math.hypot(a.stick.x, a.stick.y) : 0;
  const moveLen = Math.hypot(a.move.x, a.move.y);

  if (a.mode === "auto") {
    if (a.nearest) return { ...norm(a.nearest), auto: true };
    if (moveLen > 0.2) return { ...norm(a.move), auto: false };
    return { ...norm(a.last), auto: false };
  }

  if (stickLen > 0.25 && a.stick) return { ...norm(a.stick), auto: false };

  if (a.pointerOver) return { ...norm(a.mouse), auto: false };

  if (a.mode === "assist" && a.nearest) return { ...norm(a.nearest), auto: true };
  if (a.nearest) return { ...norm(a.nearest), auto: true };
  if (moveLen > 0.2) return { ...norm(a.move), auto: false };
  return { ...norm(a.last), auto: false };
}

function norm(v: { x: number; y: number }) {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
}

export function loadAimMode(): AimMode {
  if (typeof localStorage === "undefined") return "mouse";
  const v = localStorage.getItem("wb-aim");
  if (v === "hybrid") return "mouse";
  if (v === "mouse" || v === "auto" || v === "assist") return v;
  return "mouse";
}

export function saveAimMode(m: AimMode) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem("wb-aim", m);
}
