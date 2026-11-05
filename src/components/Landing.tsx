import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useRaid } from "@/hooks/useRaid";
import { RAIDER } from "@/lib/classes";
import { sfx, startAmbient, stopAmbient, isMuted, setMuted } from "@/audio";
import { WEAPONS } from "@/game/arena";
import { GameplayGallery, GameplayReel } from "./GameplayReel";
import { LandStage } from "./LandStage";

type Props = {
  onEnter: () => void;
  onWallet: () => void;
  onWanderer: () => void;
  onContinue?: () => void;
  connected: boolean;
  address?: string;
  savedLabel?: string;
};

const EASE = [0.22, 1, 0.36, 1] as const;
const LINE1 = ["THE", "WHEEL", "NEVER STOPS."] as const;
const LINE2 = ["NEITHER", "DO", "YOU."] as const;
const TAGS = [
  "5 levels. 5 guns. 9 enemy types.",
  "Aim, dash, and hold the foundry.",
  "The Gearmaw drinks live wheel RPM.",
  "Real Squeektoshi data. Real last hits.",
];

export function Landing(p: Props) {
  const reduce = useReducedMotion() ?? false;
  const raid = useRaid();
  const [mute, setMute] = useState(true);
  const [trailer, setTrailer] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const hero = useRef<HTMLElement>(null);

  useEffect(() => {
    setMute(isMuted());
  }, []);

  function unlockAudio() {
    if (!isMuted()) startAmbient();
  }
  function hover() {
    unlockAudio();
    sfx.hover();
  }
  function click() {
    unlockAudio();
    sfx.click();
  }

  const st = raid.data?.status;
  const napping = !st || st.coreStatus === "IDLE";
  const rpm = (st?.rpmMilli ?? 0) / 1000;
  const boss = raid.data?.boss;
  const hpPct = boss ? Math.max(0, (boss.hp / boss.hpMax) * 100) : 100;

  return (
    <div className="land" data-testid="landing" onPointerDown={unlockAudio}>
      <header className="land-nav" data-testid="land-nav">
        <i className="land-nav-gear" aria-hidden />
        <img src="/art/logo.svg" alt="" className="land-top-mark" />
        <span className="land-kicker">WHEELBOUND</span>
        <a href="#gameplay">Gameplay</a>
        <a href="#raider">Raider</a>
        <a href="#weapons">Weapons</a>
        <a href="#wheel">Wheel</a>
        <a href="#boss">Boss</a>
        <a href="#board">Leaderboard</a>
        <button
          className="land-btn land-btn-primary land-nav-play"
          data-testid="nav-play"
          onMouseEnter={hover}
          onClick={() => {
            click();
            p.onEnter();
          }}
        >
          PLAY
        </button>
        <button
          className="land-mute"
          data-testid="land-mute"
          onClick={() => {
            const n = !isMuted();
            setMuted(n);
            setMute(n);
            if (n) stopAmbient();
            else startAmbient();
          }}
        >
          {mute ? "SOUND OFF" : "SOUND ON"}
        </button>
      </header>

      <section
        className="land-hero"
        data-testid="landing-hero"
        ref={hero}
        onMouseMove={(e) => {
          if (reduce) return;
          const r = e.currentTarget.getBoundingClientRect();
          setTilt({ x: ((e.clientX - r.left) / r.width - 0.5) * 12, y: ((e.clientY - r.top) / r.height - 0.5) * 8 });
        }}
      >
        <LandStage rpm={rpm} napping={napping} tilt={tilt} reduce={reduce} />
        <div className="land-hero-copy">
          <img src="/art/logo.svg" alt="Hamster Raid" className="land-logo" data-testid="land-logo" />
          <p className="land-sub">WHEELBOUND</p>
          <Headline reduce={reduce} />
          <TagLine reduce={reduce} />
          <p className="land-body">
            A real hamster. A real wheel. A real boss on the line. Every lap Squeektoshi runs powers your raid.
          </p>
          <p className="land-stats">
            5 levels · 5 guns · 9 enemy types · <CountUp n={rpm} digits={1} /> RPM live
          </p>
          <div className="land-cta" data-testid="land-cta">
            <button
              className="land-btn land-btn-primary land-btn-play"
              data-testid="enter-raid"
              onMouseEnter={hover}
              onClick={() => {
                click();
                p.onEnter();
              }}
            >
              PLAY NOW
            </button>
            <button
              className="land-btn land-btn-ghost land-btn-chase"
              data-testid="watch-gameplay"
              onMouseEnter={hover}
              onClick={() => {
                click();
                setTrailer(true);
              }}
            >
              WATCH GAMEPLAY
            </button>
            <button
              className="land-btn land-btn-ghost land-btn-chase"
              data-testid="connect-wallet"
              onMouseEnter={hover}
              onClick={() => {
                click();
                p.onWallet();
              }}
            >
              {p.connected && p.address ? `${p.address.slice(0, 6)}...${p.address.slice(-4)}` : "CONNECT WALLET"}
            </button>
          </div>
          <button
            className="land-link"
            data-testid="play-wanderer-link"
            onMouseEnter={hover}
            onClick={() => {
              click();
              p.onWanderer();
            }}
          >
            PLAY AS WANDERER
          </button>
          {p.onContinue && p.savedLabel && (
            <button className="land-link" onClick={p.onContinue}>
              {p.savedLabel}
            </button>
          )}
        </div>
        <div className="land-hero-media">
          <GameplayReel />
          <aside className="land-live" data-testid="land-live">
            <p className="land-live-k">LIVE WHEEL</p>
            <p className={`land-rpm ${napping ? "nap" : "run"}`}>
              {napping ? "NAPPING" : "RUNNING"} - <CountUp n={rpm} digits={1} /> RPM
            </p>
            <p className="land-live-k">GLOBAL BOSS</p>
            <div className="land-live-boss">
              <img src="/art/gearmaw.jpg" alt="" className="land-boss-face" />
              <div>
                <p className="land-boss-name">{boss?.name ?? "The Gearmaw"}</p>
                <div className={`land-hp ${hpPct < 30 ? "hurt" : ""}`}>
                  <i style={{ width: `${hpPct}%` }} />
                </div>
                <p className="land-hp-n">
                  {Math.ceil(boss?.hp ?? 500)} / {boss?.hpMax ?? 500}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <div className="land-marquee" aria-hidden>
        <div>
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i}>5 LEVELS • 5 GUNS • 9 ENEMIES • GLOBAL BOSS • REAL WHEEL DATA • </span>
          ))}
        </div>
      </div>

      <section className="land-section land-sec-cyan" id="gameplay" data-testid="land-preview">
        <Fade>
          <h2>GAMEPLAY</h2>
          <p className="land-lead">Real footage from the academy and the foundry. No toy canvas. No fake rectangles.</p>
          <GameplayReel />
          <GameplayGallery />
          <button className="land-btn land-btn-ghost land-btn-chase" data-testid="watch-trailer" onClick={() => setTrailer(true)}>
            WATCH GAMEPLAY
          </button>
        </Fade>
      </section>

      <section className="land-section land-sec-orange" id="how" data-testid="land-how">
        <Fade>
          <h2>HOW IT WORKS</h2>
          <div className="land-flow" data-testid="land-flow">
            <article className="land-flow-step">
              <i className="pix pix-wheel" />
              <b>WHEEL</b>
              <p>Squeektoshi runs. Work units tick.</p>
            </article>
            <i className="land-arrow" aria-hidden />
            <article className="land-flow-step">
              <i className="pix pix-rpm" />
              <b>RPM</b>
              <p>Live speed fills Surge and drops.</p>
            </article>
            <i className="land-arrow" aria-hidden />
            <article className="land-flow-step">
              <i className="pix pix-hp" />
              <b>BOSS HP</b>
              <p>The Gearmaw bleeds as the wheel spins.</p>
            </article>
          </div>
          <h3 className="land-subhead">TRAIN. ARM. SURVIVE.</h3>
          <div className="land-steps">
            {[
              ["01", "Rookie academy", "Learn the ropes in 90 seconds. Live targets from the first step.", "pix-train"],
              ["02", "Five battlefields", "Waves get meaner. Guns get wilder. Upgrades between levels.", "pix-map"],
              ["03", "Face the Gearmaw", "A boss powered by real wheel data. Three phases. One last hit.", "pix-boss"],
            ].map(([n, t, b, ic]) => (
              <article key={n} className="land-card land-feat">
                <i className={`pix ${ic}`} />
                <b>{n}</b>
                <h3>{t}</h3>
                <p>{b}</p>
              </article>
            ))}
          </div>
        </Fade>
      </section>

      <section className="land-section land-sec-gold" id="raider" data-testid="land-raider">
        <Fade>
          <h2>MEET THE RAIDER</h2>
          <article className="land-raider-card">
            <img src="/gameplay/train.png" alt="Pip Wheelrunner" />
            <div>
              <p className="land-sub">{RAIDER.title}</p>
              <h3>{RAIDER.name}</h3>
              <p className="land-lead">{RAIDER.blurb}</p>
              <p>HP 32 · ATK 7 · STA 100 · Bolt Pistol start. Weapons, power-ups and upgrade cards make him stronger. No class grid.</p>
            </div>
          </article>
        </Fade>
      </section>

      <section className="land-section land-sec-violet" id="weapons" data-testid="land-weapons">
        <Fade>
          <h2>FIVE GUNS. ZERO MERCY.</h2>
          <div className="land-weapons">
            {Object.values(WEAPONS).map((w) => (
              <article key={w.id} className="land-card land-gun-card">
                <i className={`land-gun-art gun-${w.id}`} aria-hidden />
                <h3>{w.name}</h3>
                <p>
                  {w.dmg} dmg - {w.ammo} clip - {w.pellets > 1 ? `${w.pellets} pellets` : w.beam ? "beam" : w.burst ? "burst" : "single"}
                </p>
              </article>
            ))}
          </div>
        </Fade>
      </section>

      <section className="land-section land-sec-orange" id="enemies" data-testid="land-enemies">
        <Fade>
          <h2>ENEMIES</h2>
          <p className="land-lead">They spawn at the rim and come at you. No idle aggro bubble.</p>
          <div className="land-foes">
            {[
              ["Mite", "Straight rush"],
              ["Rat", "Straight rush"],
              ["Wasp", "Arc flank + strafe"],
              ["Crawler", "Telegraph charge"],
              ["Pellet", "Keep 100-140px, fire"],
              ["Sentry", "Shield first, fire"],
              ["Bomber", "Sprint and explode"],
              ["Brute", "Slow slam"],
            ].map(([n, b]) => (
              <article key={n} className="land-card land-foe">
                <h3>{n}</h3>
                <p>{b}</p>
              </article>
            ))}
          </div>
        </Fade>
      </section>

      <section className="land-section land-sec-green" id="arena" data-testid="land-arena">
        <Fade>
          <h2>THE ARENA</h2>
          <p className="land-lead">Five maps. Real screenshots. Enemies spawn from telegraphed portals and come at you.</p>
          <GameplayGallery />
        </Fade>
      </section>

      <section className="land-section land-sec-cyan" id="wheel" data-testid="land-wheel">
        <Fade>
          <h2>THE WHEEL IS LIVE</h2>
          <p className="land-lead">Squeektoshi runs a real wheel. His RPM fills Surge. Naps only debuff the charge.</p>
          <div className="land-card land-wide">
            <p>
              Status <b>{st?.coreStatus ?? "..."}</b> - RPM <b>{rpm.toFixed(2)}</b> - Round <b>{raid.data?.currentRound ?? "--"}</b>
            </p>
            <p>Work units {st?.cumulativeWorkUnits ?? "0"}</p>
          </div>
        </Fade>
      </section>

      <section className="land-section land-sec-violet" id="boss" data-testid="land-boss">
        <Fade>
          <h2>THE GEARMAW</h2>
          <div className="land-boss-row">
            <div className="land-boss-shot">
              <img src="/art/gearmaw.jpg" alt="The Gearmaw" className="land-boss-face" />
            </div>
            <div>
              <h3>Bottled foundry heart</h3>
              <p className="land-lead">Three phases. Add spawns. A glowing core that spins with live RPM.</p>
              <div className={`land-hp land-hp-lg ${hpPct < 30 ? "hurt" : ""}`}>
                <i style={{ width: `${hpPct}%` }} />
              </div>
            </div>
          </div>
        </Fade>
      </section>

      <section className="land-section land-sec-gold" id="board" data-testid="land-board">
        <Fade>
          <h2>LEADERBOARD: WHO GETS THE LAST HIT?</h2>
          <ol className="land-board">
            {(raid.data?.leaderboard ?? []).slice(0, 5).map((row, i) => (
              <li key={row.address}>
                <span>{i + 1}</span> {row.address.slice(0, 6)}...{row.address.slice(-4)} - {row.damage} dmg
              </li>
            ))}
            {!raid.data?.leaderboard?.length && <li>Be the first last-hit of the week.</li>}
          </ol>
        </Fade>
      </section>

      <section className="land-section" data-testid="land-faq">
        <Fade>
          <h2>FAQ</h2>
          <details open>
            <summary>Do I need a wallet?</summary>
            <p>No. Play as Wanderer. Wallet is a free Sepolia signature so your save and last-hit can attach to an address.</p>
          </details>
          <details>
            <summary>Does it cost gas?</summary>
            <p>Never. Signatures only. No transactions.</p>
          </details>
          <details>
            <summary>How does the hamster change the fight?</summary>
            <p>Running boosts power-up drops and Surge charge. Napping applies a visible Surge debuff only.</p>
          </details>
        </Fade>
      </section>

      <footer className="land-foot">
        <button
          className="land-btn land-btn-primary land-btn-play land-foot-cta"
          data-testid="foot-play"
          onMouseEnter={hover}
          onClick={() => {
            click();
            p.onEnter();
          }}
        >
          PLAY NOW
        </button>
        <p>Hamster Raid: Wheelbound - Squeekchain Sepolia - Art CC0 Kenney Tiny Town + original pixel sheets</p>
      </footer>

      {trailer && (
        <div className="land-modal" data-testid="trailer-modal" onClick={() => setTrailer(false)}>
          <div className="land-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Watch gameplay</h3>
            <GameplayReel tall />
            <button className="land-btn land-btn-primary" onClick={() => setTrailer(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Headline({ reduce }: { reduce: boolean }) {
  const [shown, setShown] = useState(reduce ? 6 : 0);
  useEffect(() => {
    if (reduce) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(i);
      if (i >= 6) window.clearInterval(id);
    }, 140);
    return () => window.clearInterval(id);
  }, [reduce]);
  return (
    <h1 className="land-h1" data-testid="land-headline">
      <span className="land-h1-line">
        {LINE1.map((w, i) => (
          <Word key={w} text={w} show={shown > i} flicker={w.startsWith("NEVER")} reduce={reduce} delay={i} />
        ))}
      </span>
      <span className="land-h1-line">
        {LINE2.map((w, i) => (
          <Word key={w} text={w} show={shown > i + 3} reduce={reduce} delay={i + 3} />
        ))}
      </span>
    </h1>
  );
}

function TagLine({ reduce }: { reduce: boolean }) {
  const [tag, setTag] = useState(reduce ? TAGS[0]! : "");
  useEffect(() => {
    if (reduce) return;
    let line = 0;
    let i = 0;
    let dir: 1 | 0 | -1 = 1;
    let hold = 0;
    const id = window.setInterval(() => {
      const full = TAGS[line]!;
      if (dir === 1) {
        i += 1;
        setTag(full.slice(0, i));
        if (i >= full.length) {
          dir = 0;
          hold = 18;
        }
      } else if (dir === 0) {
        hold -= 1;
        if (hold <= 0) dir = -1;
      } else {
        i -= 1;
        setTag(full.slice(0, Math.max(0, i)));
        if (i <= 0) {
          line = (line + 1) % TAGS.length;
          dir = 1;
        }
      }
    }, 42);
    return () => window.clearInterval(id);
  }, [reduce]);
  return (
    <p className="land-tag" data-testid="land-tagline">
      {tag}
      {!reduce ? <span className="land-caret">_</span> : null}
    </p>
  );
}

function Word({
  text,
  show,
  flicker,
  reduce,
  delay,
}: {
  text: string;
  show: boolean;
  flicker?: boolean;
  reduce: boolean;
  delay: number;
}) {
  return (
    <motion.span
      className={`land-word ${flicker ? "land-flicker" : ""}`}
      initial={reduce ? false : { y: 22, opacity: 0, skewX: 12 }}
      animate={show || reduce ? { y: 0, opacity: 1, skewX: 0 } : { y: 22, opacity: 0, skewX: 12 }}
      transition={{ duration: 0.28, delay: reduce ? 0 : delay * 0.02, ease: EASE }}
    >
      {text}
    </motion.span>
  );
}

function Fade({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.55, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

export function CountUp({ n, digits = 0 }: { n: number; digits?: number }) {
  const [v, setV] = useState(n);
  const prev = useRef(n);
  const target = useMemo(() => n, [n]);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setV(target);
      prev.current = target;
      return;
    }
    const start = prev.current;
    prev.current = target;
    let frame = 0;
    const id = window.setInterval(() => {
      frame += 1;
      const t = Math.min(1, frame / 18);
      setV(start + (target - start) * t);
      if (t >= 1) window.clearInterval(id);
    }, 16);
    return () => window.clearInterval(id);
  }, [target]);
  return <span data-testid="rpm-count">{v.toFixed(digits)}</span>;
}
