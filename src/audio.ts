let ctx: AudioContext | null = null;
let muted = true;

export function isMuted() {
  return muted;
}

export function setMuted(v: boolean) {
  muted = v;
  localStorage.setItem("hr-mute", v ? "1" : "0");
}

export function loadMute() {
  muted = localStorage.getItem("hr-mute") !== "0";
  return muted;
}

function ac() {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function beep(freq: number, dur: number, type: OscillatorType, gain = 0.04) {
  if (muted) return;
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start();
  o.stop(c.currentTime + dur);
}

export const sfx = {
  hit: () => {
    beep(180, 0.08, "square", 0.05);
    beep(90, 0.12, "sawtooth", 0.03);
  },
  ready: () => beep(520, 0.1, "triangle", 0.04),
  beat: () => beep(330, 0.16, "sine", 0.035),
  victory: () => {
    beep(523, 0.15, "square", 0.05);
    setTimeout(() => beep(659, 0.15, "square", 0.05), 120);
    setTimeout(() => beep(784, 0.3, "square", 0.05), 240);
  },
  nap: () => beep(110, 0.4, "sine", 0.03),
  click: () => beep(640, 0.04, "square", 0.02),
  hover: () => beep(880, 0.03, "sine", 0.012),
  ui: () => beep(420, 0.05, "triangle", 0.02),
};

let amb: { stop: () => void } | null = null;
export function startAmbient() {
  if (muted || amb) return;
  try {
    const c = ac();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = 72;
    g.gain.value = 0.012;
    o.connect(g);
    g.connect(c.destination);
    o.start();
    amb = {
      stop: () => {
        o.stop();
        amb = null;
      },
    };
  } catch {
    /* blocked */
  }
}
export function stopAmbient() {
  amb?.stop();
  amb = null;
}
