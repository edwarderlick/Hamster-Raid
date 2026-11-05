/** Camera / player finite-value helpers. Scene.restart reuses the instance. */

export function finite(n: number, fallback = 0) {
  return Number.isFinite(n) ? n : fallback;
}

export function finiteAim(x: number, y: number) {
  if (Number.isFinite(x) && Number.isFinite(y) && (x !== 0 || y !== 0)) {
    const len = Math.hypot(x, y);
    if (Number.isFinite(len) && len > 1e-6) return { x: x / len, y: y / len };
  }
  return { x: 1, y: 0 };
}

export type CamProbe = {
  scrollX: number;
  scrollY: number;
  zoom: number;
  alpha: number;
  px: number;
  py: number;
  viewX?: number;
  viewY?: number;
  viewW?: number;
  viewH?: number;
  groundHidden?: boolean;
  groundAlpha?: number;
};

export function camCauses(cam: CamProbe) {
  const causes: string[] = [];
  if (!Number.isFinite(cam.alpha) || cam.alpha < 0.05) causes.push(`alpha=${cam.alpha}`);
  if (!Number.isFinite(cam.scrollX) || !Number.isFinite(cam.scrollY)) causes.push(`scroll=${cam.scrollX},${cam.scrollY}`);
  if (!Number.isFinite(cam.zoom) || cam.zoom <= 0.05 || cam.zoom > 8) causes.push(`zoom=${cam.zoom}`);
  if (!Number.isFinite(cam.px) || !Number.isFinite(cam.py)) causes.push(`player=${cam.px},${cam.py}`);
  const vw = cam.viewW ?? 0;
  const vh = cam.viewH ?? 0;
  if (
    Number.isFinite(cam.px) &&
    Number.isFinite(cam.py) &&
    Number.isFinite(cam.viewX) &&
    Number.isFinite(cam.viewY) &&
    vw > 8 &&
    vh > 8
  ) {
    const pad = 96;
    if (cam.px < cam.viewX! - pad || cam.px > cam.viewX! + vw + pad || cam.py < cam.viewY! - pad || cam.py > cam.viewY! + vh + pad) {
      causes.push(`player-outside-view px=${cam.px} py=${cam.py} view=${cam.viewX},${cam.viewY},${vw},${vh}`);
    }
  }
  if (cam.groundHidden) causes.push("ground-hidden");
  if (typeof cam.groundAlpha === "number" && cam.groundAlpha < 0.05) causes.push(`ground-alpha=${cam.groundAlpha}`);
  return causes;
}

export function logCam(tag: string, extra: Record<string, unknown>) {
  const nan = Object.values(extra).some((v) => typeof v === "number" && !Number.isFinite(v));
  const line = { tag, nan, ...extra };
  if (nan) console.warn("[WB-CAM]", line);
  else console.info("[WB-CAM]", line);
  return line;
}
