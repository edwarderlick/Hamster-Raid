import { memo, useEffect, useRef } from "react";

type Props = {
  rpm: number;
  napping: boolean;
  tilt: { x: number; y: number };
  reduce: boolean;
};

export function wheelSeconds(rpm: number, napping: boolean) {
  if (napping || rpm < 0.05) return 90;
  return Math.max(8, Math.min(60, 60 / (1 + rpm / 8)));
}

export const LandStage = memo(function LandStage({ rpm, napping, tilt, reduce }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spin = wheelSeconds(rpm, napping);
  const hot = !napping && rpm > 4;
  const gearA = reduce ? 0 : Math.max(12, spin * 1.35);
  const gearB = reduce ? 0 : Math.max(18, spin * 1.8);

  useEffect(() => {
    if (reduce) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const mobile = window.matchMedia("(max-width: 700px)").matches;
    const cap = mobile ? 25 : 60;
    type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; col: string };
    const sparks: P[] = [];
    let raf = 0;
    let running = true;

    const resize = () => {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      c.width = Math.floor(c.clientWidth * dpr);
      c.height = Math.floor(c.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const spawn = (n: number) => {
      const w = c.clientWidth;
      const h = c.clientHeight;
      for (let i = 0; i < n && sparks.length < cap; i++) {
        const ember = Math.random() > 0.35;
        sparks.push({
          x: w * (0.12 + Math.random() * 0.32),
          y: h * (0.4 + Math.random() * 0.32),
          vx: (Math.random() - 0.5) * 0.35,
          vy: -0.25 - Math.random() * (hot ? 0.9 : 0.45),
          life: 0,
          max: 90 + Math.random() * 80,
          r: ember ? 1.6 : 1.1,
          col: ember ? "rgba(255,138,31,0.85)" : "rgba(46,233,255,0.7)",
        });
      }
    };
    spawn(Math.min(18, cap));

    const tick = () => {
      if (!running) return;
      const w = c.clientWidth;
      const h = c.clientHeight;
      ctx.clearRect(0, 0, w, h);
      if (sparks.length < cap && Math.random() < (hot ? 0.45 : 0.18)) spawn(hot ? 2 : 1);
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i]!;
        p.x += p.vx;
        p.y += p.vy;
        p.life += 1;
        const a = 1 - p.life / p.max;
        ctx.globalAlpha = Math.max(0, a);
        ctx.fillStyle = p.col;
        ctx.fillRect(p.x, p.y, p.r, p.r * 2);
        if (p.life > p.max || p.y < -8) sparks.splice(i, 1);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [reduce, hot]);

  return (
    <div className="land-stage" aria-hidden>
      <div className="land-fog" style={{ transform: `translate3d(${tilt.x * -0.15}px, ${tilt.y * -0.1}px, 0)` }} data-testid="land-fog">
        <div className="land-fog-strip" />
      </div>

      <div className="land-gear-tilt" style={{ transform: `translate3d(${tilt.x * -0.22}px, ${tilt.y * -0.12}px, 0)` }}>
        <div
          className={`land-gear land-gear-c ${napping ? "nap" : "run"}`}
          style={{ animationDuration: reduce ? "0s" : `${gearB}s` }}
        />
      </div>
      <div className="land-gear-tilt" style={{ transform: `translate3d(${tilt.x * -0.38}px, ${tilt.y * -0.18}px, 0)` }}>
        <div
          className={`land-gear land-gear-b ${napping ? "nap" : "run"}`}
          style={{ animationDuration: reduce ? "0s" : `${gearA}s` }}
        />
      </div>

      <div className="land-wheel-wrap" style={{ transform: `translate3d(${tilt.x * -0.55}px, ${tilt.y * -0.3}px, 0)` }}>
        <svg
          className={`land-hero-wheel ${napping ? "nap" : "run"} ${hot ? "hot" : ""}`}
          data-testid="hero-wheel"
          data-spin={spin.toFixed(1)}
          viewBox="0 0 200 200"
          style={{ animationDuration: reduce ? "0s" : `${spin}s` }}
        >
          <defs>
            <radialGradient id="wh-glow" cx="50%" cy="50%" r="50%">
              <stop offset="70%" stopColor="rgba(255,138,31,0)" />
              <stop offset="100%" stopColor="rgba(255,138,31,0.45)" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="96" fill="url(#wh-glow)" />
          <circle cx="100" cy="100" r="88" fill="#0b1228" stroke="#ff8a1f" strokeWidth="6" />
          <circle cx="100" cy="100" r="74" fill="none" stroke="#1a2550" strokeWidth="10" />
          <g className="land-spokes" stroke={hot ? "#ffe14a" : "#e56a00"} strokeWidth={hot ? 6 : 5}>
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i / 8) * Math.PI * 2;
              return <line key={i} x1={100} y1={100} x2={100 + Math.cos(a) * 70} y2={100 + Math.sin(a) * 70} />;
            })}
          </g>
          <circle cx="100" cy="100" r="16" fill="#070b1a" stroke="#2ee9ff" strokeWidth="3" />
          <circle cx="100" cy="100" r="6" fill="#ff8a1f" />
          <circle className="land-wheel-rim" cx="100" cy="100" r="88" fill="none" stroke="#2ee9ff" strokeWidth="2" />
        </svg>
      </div>

      <div className="land-ham-wrap" style={{ transform: `translate3d(${tilt.x * -0.8}px, ${tilt.y * -0.45}px, 0)` }}>
        <img src="/art/key-art.png" alt="" className="land-ham" data-testid="hero-ham" />
        <i className="land-whisker" />
        <i className="land-ear" />
      </div>

      {!reduce && <canvas ref={canvasRef} className="land-sparks" data-testid="land-sparks" />}
    </div>
  );
});
