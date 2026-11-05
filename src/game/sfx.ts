import Phaser from "phaser";

function beep(scene: Phaser.Scene, key: string, freq: number, dur: number, type: OscillatorType) {
  const ctx = new AudioContext();
  const rate = ctx.sampleRate;
  const n = Math.floor(rate * dur);
  const buf = ctx.createBuffer(1, n, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const env = 1 - i / n;
    let s = 0;
    if (type === "square") s = Math.sign(Math.sin(2 * Math.PI * freq * t));
    else if (type === "sawtooth") s = 2 * ((t * freq) % 1) - 1;
    else s = Math.sin(2 * Math.PI * freq * t);
    d[i] = s * env * 0.25;
  }
  ctx.close();
  scene.cache.audio.add(key, buf);
}

export function bakeSfx(scene: Phaser.Scene) {
  const make = (key: string, freq: number, dur: number, type: OscillatorType) => {
    const ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const rate = ac.sampleRate;
    const n = Math.max(1, Math.floor(rate * dur));
    const buf = ac.createBuffer(1, n, rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const t = i / rate;
      const env = Math.pow(1 - i / n, 1.4);
      let s: number;
      if (type === "square") s = Math.sign(Math.sin(2 * Math.PI * freq * t));
      else if (type === "sawtooth") s = 2 * ((freq * t) % 1) - 1;
      else s = Math.sin(2 * Math.PI * freq * t);
      data[i] = s * env * 0.22;
    }
    if (scene.cache.audio.exists(key)) scene.cache.audio.remove(key);
    scene.cache.audio.add(key, buf);
    try {
      if (!scene.sound.get(key)) scene.sound.add(key);
    } catch {
      /* sound manager may wait for a user gesture */
    }
    ac.close();
  };
  make("sfx-swing", 220, 0.08, "square");
  make("sfx-hit", 90, 0.1, "sawtooth");
  make("sfx-roll", 180, 0.12, "sine");
  make("sfx-skill", 440, 0.14, "square");
  make("sfx-ult", 130, 0.28, "sawtooth");
  make("sfx-ui", 660, 0.05, "square");
  make("sfx-ok", 523, 0.1, "sine");
  make("sfx-talk", 720, 0.03, "square");
  const song = (key: string, notes: number[]) => {
    const ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const rate = ac.sampleRate;
    const beat = 0.18;
    const n = Math.floor(rate * beat * notes.length);
    const buf = ac.createBuffer(1, n, rate);
    const data = buf.getChannelData(0);
    notes.forEach((f, idx) => {
      const start = Math.floor(idx * beat * rate);
      const len = Math.floor(beat * rate);
      for (let i = 0; i < len && start + i < n; i++) {
        const env = Math.sin((i / len) * Math.PI) * 0.08;
        data[start + i] += Math.sign(Math.sin((2 * Math.PI * f * i) / rate)) * env;
      }
    });
    if (scene.cache.audio.exists(key)) scene.cache.audio.remove(key);
    scene.cache.audio.add(key, buf);
    try {
      if (!scene.sound.get(key)) scene.sound.add(key);
    } catch {
      /* gesture */
    }
    ac.close();
  };
  song("mus-haven", [262, 330, 392, 330, 294, 330, 392, 523]);
  song("mus-forest", [196, 247, 294, 247, 220, 247, 196, 165]);
  song("mus-mines", [130, 164, 196, 164, 146, 110, 130, 98]);
  song("mus-foundry", [98, 123, 147, 185, 147, 123, 98, 73]);
}

export { beep };
