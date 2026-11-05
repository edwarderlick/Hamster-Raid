export const INTERNAL_H = 270;
export const INTERNAL_W_MIN = 360;
export const INTERNAL_W_MAX = 800;

/** Internal pixel width for a 270-tall view that fills the window. Ultrawide sees more world. */
export function computeInternalWidth(viewW: number, viewH: number) {
  const h = Math.max(1, viewH);
  const w = Math.round((INTERNAL_H * viewW) / h);
  return Math.min(INTERNAL_W_MAX, Math.max(INTERNAL_W_MIN, w));
}

/** Auto HUD scale. 1080p ≈ 2.25 so 8px glyphs read ~18px and keycaps ~24px. */
export function computeUiScale(viewH: number, user = 0, viewW = 1920) {
  if (user > 0) return Math.min(4, Math.max(1, user));
  const raw = Math.min(viewH / 500, viewW / 900);
  return Math.min(3, Math.max(1.15, Math.round(raw * 4) / 4));
}

export function integerScale(viewH: number) {
  return Math.max(1, Math.floor(viewH / INTERNAL_H));
}

export const FS_KEY = "wb-fullscreen";

export function wantsFullscreen() {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(FS_KEY) === "1";
}

export function setFullscreenPref(on: boolean) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(FS_KEY, on ? "1" : "0");
}

export async function enterFullscreen(el?: Element | null) {
  const node = el ?? document.documentElement;
  if (!document.fullscreenElement && node.requestFullscreen) {
    try {
      await node.requestFullscreen();
      setFullscreenPref(true);
    } catch {
      /* browser or embed blocked */
    }
  }
}

export async function exitFullscreen() {
  if (document.fullscreenElement && document.exitFullscreen) {
    try {
      await document.exitFullscreen();
    } catch {
      /* already left */
    }
  }
  setFullscreenPref(false);
}

export async function toggleFullscreen(el?: Element | null) {
  if (document.fullscreenElement) await exitFullscreen();
  else await enterFullscreen(el);
}

export function wheelTooltip(status: string, stale: boolean) {
  if (stale) return "STALE: last good snapshot. Gears hold still until the API returns.";
  if (status === "IDLE") return "Napping: Foundry gate sleeps. Enemies slower. Gearmaw drinks quiet.";
  if (status === "ACTIVE") return "Running: gears spin at live RPM. Wheel Charge fills. Doors wake.";
  return "Wheel unknown. Keep the last snapshot.";
}

export function powerRating(s: { atk: number; def: number; hpMax: number; level: number }) {
  return s.atk + s.def + Math.floor(s.hpMax / 8) + s.level;
}
