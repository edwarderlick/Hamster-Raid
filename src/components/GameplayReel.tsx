import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

const SHOTS = [
  { src: "/gameplay/train.png", alt: "Training Academy" },
  { src: "/gameplay/l1.png", alt: "Rust Yard" },
  { src: "/gameplay/l3.png", alt: "Oilworks" },
  { src: "/gameplay/l5.png", alt: "Gearmaw Foundry" },
  { src: "/gameplay/upgrade.png", alt: "Upgrade cards" },
  { src: "/gameplay/victory.png", alt: "Victory" },
];

export function GameplayReel({ tall }: { tall?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const v = useRef<HTMLVideoElement>(null);
  const reduce = useReducedMotion() ?? false;

  useEffect(() => {
    const host = wrap.current;
    const vid = v.current;
    if (!host || !vid || reduce) return;
    const io = new IntersectionObserver(
      (ents) => {
        if (ents[0]?.isIntersecting) void vid.play().catch(() => undefined);
        else vid.pause();
      },
      { threshold: 0.25 },
    );
    io.observe(host);
    return () => io.disconnect();
  }, [reduce]);

  return (
    <div className={`land-preview land-crt ${tall ? "tall" : ""}`} data-testid="attract-preview" ref={wrap}>
      <span className="land-crt-live" data-testid="crt-live">
        LIVE
      </span>
      {reduce ? (
        <img className="land-reel" src="/gameplay/poster.png" alt="Gameplay still" data-testid="gameplay-clip" />
      ) : (
        <video
          ref={v}
          className="land-reel"
          data-testid="gameplay-clip"
          poster="/gameplay/poster.png"
          muted
          loop
          playsInline
          autoPlay
          preload="none"
        >
          <source src="/gameplay/raid.webm" type="video/webm" />
          <source src="/gameplay/raid.mp4" type="video/mp4" />
        </video>
      )}
      <i className="land-scan" />
    </div>
  );
}

export function GameplayGallery() {
  return (
    <div className="land-gallery" data-testid="gameplay-gallery">
      {SHOTS.map((s) => (
        <figure key={s.src}>
          <img src={s.src} alt={s.alt} />
          <figcaption>{s.alt}</figcaption>
        </figure>
      ))}
    </div>
  );
}
