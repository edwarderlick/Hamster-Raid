import { useEffect, useMemo, useRef, useState } from "react";
import { buySkill, ITEMS, SKILL_TREE, upgradeItem, useGame } from "@/game/store";
import { MAIN, SHOP } from "@/game/dialogue";
import { TUTORIAL, rarityColor, tutorialDone } from "@/game/uiState";
import { xpToNext } from "@/lib/combat";
import { computeUiScale, powerRating, toggleFullscreen, wheelTooltip } from "@/game/scale";
import { PICKUPS, UPGRADES, WEAPONS, type WeaponId } from "@/game/arena";
import type { Quality } from "@/game/perf";
import { hasSkippedTrain } from "@/game/skipTrain";

export function GameHUD() {
  const save = useGame((s) => s.save);
  const overlay = useGame((s) => s.overlay);
  const dialogue = useGame((s) => s.dialogue);
  const toast = useGame((s) => s.toast);
  const prompt = useGame((s) => s.prompt);
  const wheel = useGame((s) => s.wheel);
  const cds = useGame((s) => s.cooldowns);
  const boss = useGame((s) => s.bossHud);
  const zoneName = useGame((s) => s.zoneName);
  const zoneBanner = useGame((s) => s.zoneBanner);
  const keys = useGame((s) => s.keys);
  const obj = useGame((s) => s.objectiveHud);
  const uiScale = useGame((s) => s.uiScale);
  const comboHud = useGame((s) => s.comboHud);
  const failText = useGame((s) => s.failText);
  const debugOpen = useGame((s) => s.debugOpen);
  const inputLog = useGame((s) => s.inputLog);
  const hotPulse = useGame((s) => s.hotPulse);
  const inputMode = useGame((s) => s.inputMode);
  const arenaHud = useGame((s) => s.arenaHud);
  const fpsOpen = useGame((s) => s.fpsOpen);
  const [typed, setTyped] = useState("");
  const [tip, setTip] = useState<string | null>(null);
  const [callout, setCallout] = useState(false);
  const [wavePop, setWavePop] = useState(false);
  const [comboPop, setComboPop] = useState(false);
  const prevWave = useRef(0);
  const prevCombo = useRef(0);
  const skippedBefore = hasSkippedTrain();
  const arena = arenaHud.mode !== "story";

  useEffect(() => {
    const apply = () => {
      const s = computeUiScale(window.innerHeight, useGame.getState().uiScale, window.innerWidth);
      document.documentElement.style.setProperty("--ui-scale", String(s));
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [uiScale]);

  useEffect(() => {
    if (!dialogue) {
      setTyped("");
      return;
    }
    setTyped("");
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(dialogue.text.slice(0, i));
      if (i >= dialogue.text.length) clearInterval(id);
    }, 18);
    return () => clearInterval(id);
  }, [dialogue]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => useGame.getState().setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!failText) return;
    const t = setTimeout(() => useGame.getState().setFail(null), 900);
    return () => clearTimeout(t);
  }, [failText]);
  useEffect(() => {
    if (comboHud <= 0) return;
    const t = setTimeout(() => useGame.getState().setComboHud(0), 900);
    return () => clearTimeout(t);
  }, [comboHud]);

  useEffect(() => {
    if (arenaHud.mode !== "train") return;
    if (hasSkippedTrain()) return;
    setCallout(true);
    const t = setTimeout(() => setCallout(false), 4000);
    return () => clearTimeout(t);
  }, [arenaHud.mode]);

  useEffect(() => {
    if (arenaHud.mode !== "battle" || arenaHud.wave <= 0) return;
    if (arenaHud.wave === prevWave.current) return;
    prevWave.current = arenaHud.wave;
    setWavePop(true);
    const t = setTimeout(() => setWavePop(false), 1800);
    return () => clearTimeout(t);
  }, [arenaHud.wave, arenaHud.mode]);

  useEffect(() => {
    if (arenaHud.combo > prevCombo.current && arenaHud.combo > 1) {
      setComboPop(true);
      const t = setTimeout(() => setComboPop(false), 280);
      prevCombo.current = arenaHud.combo;
      return () => clearTimeout(t);
    }
    prevCombo.current = arenaHud.combo;
  }, [arenaHud.combo]);

  if (!save) return null;
  const napping = wheel.coreStatus === "IDLE";
  const rpm = wheel.rpmMilli / 1000;
  const chip = wheel.stale ? "STALE" : napping ? "NAPPING" : "RUNNING";
  const q = MAIN[0];
  const qs = save.quests.find((x) => x.id === "main-1");
  const hpSafe = Math.max(0, save.hp);
  const hearts = Math.max(0, Math.round((hpSafe / save.hpMax) * 8));
  const power = powerRating(save);
  const pointer = !obj.onscreen
    ? {
        left: `${50 + Math.cos(obj.angle) * 42}%`,
        top: `${50 + Math.sin(obj.angle) * 36}%`,
        transform: `translate(-50%, -50%) rotate(${obj.angle + Math.PI / 2}rad)`,
      }
    : null;

  return (
    <div className="hud-root" data-testid="hud-root">
      {overlay === "none" && !arena && (
        <div className="hud-now" data-testid="now-banner">
          <b>NOW</b> - {obj.text}
          {obj.dist > 0 ? ` - ${obj.dist}m` : ""}
        </div>
      )}
      {arena && overlay === "none" && (
        <div className={`hud-now ${wavePop && arenaHud.mode === "battle" ? "hud-wave-pop" : ""}`} data-testid="arena-banner">
          {arenaHud.mode === "train" ? (
            <>
              <b data-testid="train-step">
                STEP {arenaHud.stepI}/{arenaHud.stepN}
              </b>{" "}
              - {arenaHud.step || "Academy"}
            </>
          ) : (
            <>
              <b data-testid="wave-banner">
                WAVE {arenaHud.wave}/{arenaHud.waves || 1} — {arenaHud.left} LEFT
              </b>{" "}
              L{arenaHud.level} · {arenaHud.score} pts
              {arenaHud.combo > 1 ? (
                <em className={`hud-mult ${comboPop ? "pop" : ""}`} data-testid="score-mult">
                  {" "}
                  x{arenaHud.combo}
                </em>
              ) : null}
            </>
          )}
        </div>
      )}
      {arenaHud.mode === "train" && (
        <>
          <button
            type="button"
            className="hud-skip-battle"
            data-testid="skip-train"
            onClick={() => {
              const wb = (window as unknown as { __WB?: { skipTrain?: () => void } }).__WB;
              wb?.skipTrain?.();
            }}
          >
            <span className="skip-label">{skippedBefore ? "Skip (done before)" : "SKIP TRAINING"}</span>
            <span className="skip-arrow" aria-hidden>
              →
            </span>
            <span className="skip-dest">BATTLEFIELD</span>
            <kbd className="skip-keys">Tab / N</kbd>
          </button>
          {callout && overlay === "none" && (
            <div className="skip-callout" data-testid="skip-callout">
              New here? Do the drills. Know the controls? Skip to the fight.
            </div>
          )}
        </>
      )}
      {overlay === "none" && pointer && <div className="hud-pointer" data-testid="obj-pointer" style={pointer} />}
      {hpSafe <= save.hpMax * 0.3 && overlay === "none" && <div className="hud-vignette" data-testid="low-hp" />}

      {boss && (
        <div className="hud-boss">
          <div className="hud-boss-name">
            {boss.name} - PHASE {boss.phase}
          </div>
          <div className="hud-bar hud-bar-wide">
            <i style={{ width: `${(boss.hp / boss.hpMax) * 100}%` }} className="fill-hp" />
            <span>
              {Math.ceil(boss.hp)} / {boss.hpMax}
            </span>
          </div>
        </div>
      )}

      <div className="hud-tl">
        <div className="hud-portrait" data-class="raider" />
        <div className="hud-vitals">
          <div className="hud-name">
            {save.name} <em>Wheel Raider Lv{save.level}</em>
          </div>
          <div className="hud-hearts">{Array.from({ length: 8 }, (_, i) => (i < hearts ? "♥" : "♡")).join("")}</div>
          <div className="hud-bar" title="Hit points">
            <i style={{ width: `${(save.hp / save.hpMax) * 100}%` }} className="fill-hp" />
            <span>
              HP {Math.ceil(hpSafe)}/{save.hpMax}
            </span>
          </div>
          <div className="hud-bar" title="Stamina">
            <i style={{ width: `${(save.stamina / save.staminaMax) * 100}%` }} className="fill-sta" />
            <span>
              STA {Math.ceil(save.stamina)}/{save.staminaMax}
            </span>
          </div>
          {arena && (
            <div className="hud-bar" title="Ammo" data-testid="ammo-bar">
              <i style={{ width: `${arenaHud.ammoMax ? (arenaHud.ammo / arenaHud.ammoMax) * 100 : 0}%` }} className="fill-xp" />
              <span>
                {arenaHud.weapon} {arenaHud.ammo}/{arenaHud.ammoMax}
              </span>
            </div>
          )}
          <div className="hud-bar" title="Experience">
            <i style={{ width: `${(save.xp / xpToNext(save.level)) * 100}%` }} className="fill-xp" />
            <span>
              XP {save.xp}/{xpToNext(save.level)}
            </span>
          </div>
          <div className="hud-gold">
            * {save.gold}g - PWR {power}
          </div>
        </div>
      </div>

      <div className="hud-tr">
        <div
          className={`hud-chip ${napping ? "nap" : "run"} ${wheel.stale ? "stale" : ""}`}
          data-testid="wheel-chip"
          title={wheelTooltip(wheel.coreStatus, wheel.stale)}
          onMouseEnter={() => setTip(wheelTooltip(wheel.coreStatus, wheel.stale))}
          onMouseLeave={() => setTip(null)}
        >
          <div className={`wheel-spin ${napping ? "stopped" : ""}`} style={{ display: "inline-block", verticalAlign: "middle", marginRight: 8 }} />
          {chip} {rpm.toFixed(1)} RPM
        </div>
        <MiniMap />
        {arena && (
          <div className="hud-pups" data-testid="powerups">
            {arenaHud.powerups.map((p) => (
              <span key={p.id} style={{ color: PICKUPS[p.id]?.color }}>
                {PICKUPS[p.id]?.label} {Math.ceil(p.t / 1000)}s
              </span>
            ))}
          </div>
        )}
        <div className="hud-zone">{zoneName}</div>
      </div>

      {!arena && (
        <div className="hud-bl">
          <div className="hud-quest">
            <b>QUEST</b>
            <p>{q && qs ? q.stages[qs.stage] ?? "Fell the Gearmaw." : "Explore Wheelhaven."}</p>
          </div>
        </div>
      )}

      <div className="hud-bc">
        {prompt && (
          <div className="hud-prompt" data-testid="context-prompt">
            <span className="kb">F</span> {prompt.replace("[F] ", "")}
          </div>
        )}
        {comboHud > 1 && (
          <div className="hud-combo" data-testid="combo-hud">
            x{comboHud} COMBO
          </div>
        )}
        {failText && (
          <div className="hud-fail" data-testid="fail-text">
            {failText}
          </div>
        )}
        <div className="hud-hotbar" data-testid="hotbar">
          {arena
            ? (Object.keys(WEAPONS) as WeaponId[]).map((id, i) => {
                const owned = (save.guns ?? ["pistol"]).includes(id);
                const on = WEAPONS[id].name === arenaHud.weapon;
                return (
                  <button
                    type="button"
                    key={id}
                    className={`hot hot-gun ${on ? "on" : ""} ${owned ? "" : "locked"}`}
                    data-testid={`gun-slot-${i + 1}`}
                    onClick={() => {
                      const wb = (window as unknown as { __WB?: { swap?: (id: string) => void } }).__WB;
                      wb?.swap?.(id);
                    }}
                  >
                    <div className="hot-icon">{owned ? WEAPONS[id].name.slice(0, 1) : "🔒"}</div>
                    <small className="kb">{i + 1}</small>
                    <em title={owned ? WEAPONS[id].name : "Locked"}>{owned ? WEAPONS[id].short : "LOCK"}</em>
                    {owned && on && <span className="hot-num">{arenaHud.ammo}/{arenaHud.ammoMax}</span>}
                  </button>
                );
              })
            : null}
          <Hot icon="⚔" label={keys.attack} cd={cds.atk} max={arena ? 150 : 220} name={arena ? "Fire" : "Atk"} btn="attack" pulse={hotPulse.atk} />
          <Hot icon="✦" label={keys.skill} cd={cds.skill} max={2400} name={arena ? "Melee" : "Skill"} btn="skill" pulse={hotPulse.skill} ready={cds.skill <= 0} />
          <Hot icon="☀" label={keys.ult} cd={cds.ult} max={8000} name="Surge" btn="ult" pulse={hotPulse.ult} ready={cds.ult <= 0 && save.wheelCharge >= 40} charge={save.wheelCharge} />
          <Hot icon="↩" label={keys.roll === "SPACE" ? "SPC" : keys.roll} cd={cds.roll} max={560} name="Roll" btn="roll" pulse={hotPulse.roll} />
          <Hot icon="⛨" label={keys.block} cd={0} max={1} name="Block" btn="block" pulse={hotPulse.block} hold />
        </div>
      </div>

      {!arena && !tutorialDone(save.tutorialStep) && overlay === "none" && (
        <div className="hud-tutorial" data-testid="tutorial">
          <ul>
            {TUTORIAL.map((t, i) => (
              <li key={t.id} className={i < save.tutorialStep ? "done" : i === save.tutorialStep ? "now" : ""}>
                <span className="kb">{t.key}</span> {t.label}
                {i < save.tutorialStep ? " ✓" : ""}
              </li>
            ))}
          </ul>
          <button style={{ marginTop: 8 }} onClick={() => useGame.getState().skipTutorial()}>
            Skip
          </button>
        </div>
      )}

      {zoneBanner && <div className="hud-zone-banner">{zoneBanner}</div>}
      {toast && <div className="hud-toast">{toast}</div>}
      {tip && overlay === "none" && <div className="hud-toast">{tip}</div>}

      <button className="hud-fs" data-testid="hud-fullscreen" onClick={() => void toggleFullscreen()}>
        Fullscreen - F11
      </button>

      {overlay === "skip" && (
        <div className="hud-modal" data-testid="overlay-skip">
          <div className="hud-panel skip-panel">
            <header>
              <h2>SKIP TO THE FIGHT?</h2>
            </header>
            <p className="hud-copy">Jump to Level 1 Wave 1. You can still train later from the academy gate.</p>
            <nav className="hud-menu skip-actions">
              <button
                type="button"
                className="skip-primary"
                data-testid="skip-confirm"
                onClick={() => {
                  const wb = (window as unknown as { __WB?: { confirmSkip?: () => void } }).__WB;
                  wb?.confirmSkip?.();
                }}
              >
                Skip to Level 1
              </button>
              <button type="button" data-testid="skip-keep" onClick={() => useGame.getState().setOverlay("none")}>
                Keep Training
              </button>
            </nav>
            <div className="hud-footer">
              <span className="kb">Esc</span> close
            </div>
          </div>
        </div>
      )}

      {overlay !== "none" && overlay !== "skip" && (
        <div className="hud-modal" data-testid={`overlay-${overlay}`}>
          <div className="hud-panel">
            <header>
              <h2>{overlay.toUpperCase()}</h2>
              <button
                onClick={() => {
                  if (useGame.getState().overlay === "dialogue") useGame.getState().setDialogue(null);
                  else useGame.getState().setOverlay("none");
                }}
              >
                X
              </button>
            </header>
            {overlay === "pause" && <PauseMenu />}
            {(overlay === "inventory" || overlay === "equip") && <Inv />}
            {overlay === "shop" && <Shop />}
            {overlay === "skills" && <Skills />}
            {(overlay === "questlog" || overlay === "journal") && <Quests />}
            {overlay === "controls" && <Controls />}
            {overlay === "help" && <Help />}
            {overlay === "settings" && <Settings />}
            {overlay === "levelup" && <LevelUp />}
            {overlay === "map" && (
              <p className="hud-copy">
                {zoneName}. Walls on the minimap. Gold stars are shrines. East Cogwood, south Mines.
              </p>
            )}
            {overlay === "dialogue" && dialogue && (
              <div className="hud-dialog">
                <div className="hud-dialog-face" data-speaker={dialogue.speaker} />
                <div>
                  <b>{dialogue.speaker}</b>
                  <p>{typed}</p>
                  {typed.length >= dialogue.text.length &&
                    dialogue.choices?.map((c) => (
                      <button
                        key={c.label}
                        className="hud-choice"
                        onClick={() => {
                          if (c.next.startsWith("travel:")) {
                            window.dispatchEvent(new CustomEvent("wb-travel", { detail: c.next.slice(7) }));
                          }
                        }}
                      >
                        {c.label}
                      </button>
                    ))}
                  {typed.length >= dialogue.text.length && !dialogue.choices?.length && (
                    <em className="hud-advance">F / click to close</em>
                  )}
                </div>
              </div>
            )}
            {overlay === "dead" && !arena && (
              <div className="hud-dead" data-testid="defeated">
                <h3>Defeated</h3>
                <p>You fell. The shrine remembers your last rest.</p>
                <nav className="hud-menu">
                  <button
                    data-testid="retry"
                    onClick={() => {
                      const cur = useGame.getState().save!;
                      useGame.getState().patch({ hp: cur.hpMax, stamina: cur.staminaMax, zone: "haven", x: 200, y: 220 });
                      useGame.getState().setOverlay("none");
                      window.dispatchEvent(new CustomEvent("wb-restart", { detail: "haven" }));
                    }}
                  >
                    Retry
                  </button>
                  <button
                    data-testid="return-town"
                    onClick={() => {
                      const cur = useGame.getState().save!;
                      useGame.getState().patch({ hp: cur.hpMax, stamina: cur.staminaMax, zone: "haven", x: 200, y: 220 });
                      useGame.getState().setOverlay("none");
                      window.dispatchEvent(new CustomEvent("wb-restart", { detail: "haven" }));
                    }}
                  >
                    Return to Town
                  </button>
                </nav>
              </div>
            )}
            {(overlay === "gameover" || (overlay === "dead" && arena)) && (
              <div className="hud-dead" data-testid="gameover">
                <h3>GAME OVER</h3>
                <p>
                  Level {arenaHud.level} - score {arenaHud.score} - best {save.bestScore ?? 0}
                </p>
                <nav className="hud-menu">
                  <button
                    data-testid="retry-level"
                    onClick={() => {
                      const cur = useGame.getState().save!;
                      useGame.getState().patch({ hp: cur.hpMax, stamina: cur.staminaMax, zone: "battle", arenaLevel: Math.max(1, arenaHud.level) });
                      useGame.getState().setOverlay("none");
                      window.dispatchEvent(new CustomEvent("wb-restart", { detail: "battle" }));
                    }}
                  >
                    Retry level
                  </button>
                  <button
                    data-testid="retry-arena"
                    onClick={() => {
                      const cur = useGame.getState().save!;
                      useGame.getState().patch({ hp: cur.hpMax, stamina: cur.staminaMax, zone: "arena", arenaLevel: 1, score: 0 });
                      useGame.getState().setOverlay("none");
                      window.dispatchEvent(new CustomEvent("wb-restart", { detail: "arena" }));
                    }}
                  >
                    Training Arena
                  </button>
                </nav>
              </div>
            )}
            {overlay === "victory" && (
              <div className="hud-dead" data-testid="victory">
                <h3>VICTORY</h3>
                <p>
                  Gearmaw down. Score {arenaHud.score}. Best {Math.max(save.bestScore ?? 0, arenaHud.score)}.
                </p>
                <div className="hud-share" data-testid="share-card">
                  HAMSTER RAID - WHEELBOUND
                  <br />
                  Beat the Gearmaw - {arenaHud.score} pts
                </div>
                <nav className="hud-menu">
                  <button
                    onClick={() => {
                      useGame.getState().patch({ zone: "arena", hp: save.hpMax, score: 0, arenaLevel: 1 });
                      useGame.getState().setOverlay("none");
                      window.dispatchEvent(new CustomEvent("wb-restart", { detail: "arena" }));
                    }}
                  >
                    Play again
                  </button>
                </nav>
              </div>
            )}
            {overlay === "upgrade" && (
              <div data-testid="upgrade-pick">
                <p className="hud-copy">WAVE CLEAR - pick one.</p>
                <nav className="hud-upgrades">
                  {UPGRADES.slice(0, 3).map((u, i) => (
                    <button
                      key={u.id}
                      className={`up-card rare-${i === 0 ? "common" : i === 1 ? "rare" : "relic"}`}
                      data-testid={`upgrade-${u.id}`}
                      onClick={() => {
                        const wb = (window as unknown as { __WB?: { pickUpgrade?: (id: string) => void } }).__WB;
                        wb?.pickUpgrade?.(u.id);
                      }}
                    >
                      <em>{i === 0 ? "COMMON" : i === 1 ? "RARE" : "RELIC"}</em>
                      <b>{u.name}</b>
                      <span>Press {i + 1} or click</span>
                    </button>
                  ))}
                </nav>
              </div>
            )}
            <div className="hud-footer">
              <span className="kb">Esc</span> close - <span className="kb">F1</span> help - <span className="kb">I</span> pack -{" "}
              <span className="kb">U</span> skills - <span className="kb">H</span> block
            </div>
          </div>
        </div>
      )}

      {debugOpen && (
        <div className="hud-debug" data-testid="debug-overlay">
          <b>INPUT</b> mode {inputMode}
          <ul>
            {inputLog.slice(0, 8).map((e, i) => (
              <li key={i}>
                {e.key} → {e.action} {e.ok ? "OK" : `BLOCKED ${e.reason}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {typeof window !== "undefined" && "ontouchstart" in window && <TouchPad />}
      {fpsOpen && <FpsMeter />}
    </div>
  );
}

function FpsMeter() {
  const [snap, setSnap] = useState({ fps: 0, ms: 0, entities: 0, draws: 0, particles: 0, quality: "auto" });
  useEffect(() => {
    const id = window.setInterval(() => {
      const p = (window as unknown as { __WB_PERF?: typeof snap }).__WB_PERF;
      if (p) setSnap(p);
    }, 200);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="hud-fps" data-testid="fps-meter">
      {snap.fps} FPS - {snap.ms} ms - foes {snap.entities} - draw {snap.draws} - fx {snap.particles} - {snap.quality}
    </div>
  );
}

function fireBtn(b: string, d: boolean) {
  window.dispatchEvent(new CustomEvent("wb-btn", { detail: { b, d } }));
}

function Hot({
  icon,
  label,
  cd,
  max,
  name,
  btn,
  pulse,
  ready,
  charge,
  hold,
}: {
  icon: string;
  label: string;
  cd: number;
  max: number;
  name: string;
  btn: string;
  pulse: number;
  ready?: boolean;
  charge?: number;
  hold?: boolean;
}) {
  const pct = max > 0 ? Math.min(100, (cd / max) * 100) : 0;
  const lit = Date.now() - pulse < 180;
  return (
    <button
      type="button"
      className={`hot ${lit ? "hot-pulse" : ""} ${ready ? "hot-ready" : ""}`}
      data-testid={`hot-${btn}`}
      onPointerDown={() => fireBtn(btn, true)}
      onPointerUp={() => fireBtn(btn, false)}
      onPointerLeave={() => hold && fireBtn(btn, false)}
    >
      <div className="hot-icon">
        {icon}
        {pct > 0 && <i className="hot-cd" style={{ height: `${pct}%` }} />}
      </div>
      <small className="kb">{label}</small>
      <em>{name}</em>
      {cd > 0 && <span className="hot-num">{(cd / 1000).toFixed(1)}</span>}
      {typeof charge === "number" && cd <= 0 && <span className="hot-num">{Math.floor(charge)}%</span>}
    </button>
  );
}

function MiniMap() {
  const m = useGame((s) => s.minimap);
  const obj = useGame((s) => s.objectiveHud);
  const zone = useGame((s) => s.zoneName);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    let raf = 0;
    const draw = () => {
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = m.radar ? "#0b1228" : "#163322";
      ctx.fillRect(0, 0, c.width, c.height);
      const sx = c.width / Math.max(1, m.cols);
      const sy = c.height / Math.max(1, m.rows);
      ctx.fillStyle = m.radar ? "#3a4a62" : "#2a4a32";
      for (let i = 0; i < m.walls.length; i++) {
        if (!m.walls[i]) continue;
        const x = i % m.cols;
        const y = Math.floor(i / m.cols);
        ctx.fillRect(Math.floor(x * sx), Math.floor(y * sy), Math.max(1, Math.ceil(sx)), Math.max(1, Math.ceil(sy)));
      }
      ctx.strokeStyle = "rgba(46,233,255,0.55)";
      ctx.lineWidth = 1;
      ctx.strokeRect(m.view.x * sx, m.view.y * sy, m.view.w * sx, m.view.h * sy);
      const color = (kind: string) => {
        if (kind === "boss") return "#b56cff";
        if (kind === "elite" || kind === "enemy") return "#e4453a";
        if (kind === "dummy") return "#f0ddb4";
        if (kind === "target") return "#ff8a1f";
        if (kind === "gate") return "#2ee9ff";
        if (kind === "crate") return "#c47a3a";
        if (kind.startsWith("pickup")) return "#3dcc6e";
        if (kind.startsWith("shrine")) return "#ff8a1f";
        if (kind.startsWith("portal")) return "#2ee9ff";
        return "#f0ddb4";
      };
      m.pois.forEach((p) => {
        const px = p.x * sx;
        const py = p.y * sy;
        ctx.fillStyle = color(p.kind);
        if (p.kind === "boss") {
          ctx.fillRect(px - 3, py - 2, 6, 6);
          ctx.fillStyle = "#ffe14a";
          ctx.fillRect(px - 1, py - 4, 2, 2);
        } else {
          const r = p.kind === "elite" || p.elite ? 4 : 2.5;
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 180);
      if (!m.radar) {
        ctx.fillStyle = `rgba(255,138,31,${pulse})`;
        ctx.fillRect(Math.floor(obj.tx * sx) - 2, Math.floor(obj.ty * sy) - 2, 5, 5);
      }
      const px = m.px * sx;
      const py = m.py * sy;
      ctx.fillStyle = "rgba(255,225,74,0.45)";
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.arc(px, py, 11, m.facing - 0.45, m.facing + 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffe14a";
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [m, obj]);
  return (
    <div className={`hud-radar ${m.radar ? "is-radar" : ""}`} data-testid="minimap-wrap">
      <div className="hud-radar-label" data-testid="radar-zone">
        {zone}
      </div>
      <canvas ref={canvas} width={200} height={160} className="hud-mini" data-testid="minimap" />
    </div>
  );
}

function PauseMenu() {
  const set = useGame.getState().setOverlay;
  return (
    <nav className="hud-menu">
      <button onClick={() => set("none")}>Resume</button>
      <button onClick={() => set("journal")}>Quests</button>
      <button onClick={() => set("controls")}>Controls</button>
      <button onClick={() => set("settings")}>Settings</button>
      <button onClick={() => set("help")}>Help</button>
      <button
        onClick={() => {
          const z = useGame.getState().save?.zone ?? "haven";
          useGame.getState().setOverlay("none");
          window.dispatchEvent(new CustomEvent("wb-restart", { detail: z }));
        }}
      >
        Restart level
      </button>
      <button onClick={() => void toggleFullscreen()}>Fullscreen</button>
      <button onClick={() => window.dispatchEvent(new CustomEvent("wb-quit"))}>Quit</button>
    </nav>
  );
}

function Inv() {
  const s = useGame((g) => g.save)!;
  const [tip, setTip] = useState<string | null>(null);
  const power = powerRating(s);
  return (
    <div className="hud-inv">
      <p className="hud-copy">
        Gold {s.gold} - ATK {s.atk} - DEF {s.def} - PWR {power}
      </p>
      <div className="hud-doll">
        <div className="hud-portrait" data-class="raider" />
        <div>
          <p>WPN {s.equipped.weapon?.name ?? "—"}</p>
          <p>ARM {s.equipped.armor?.name ?? "—"}</p>
          <p>TRK {s.equipped.trinket?.name ?? "—"}</p>
        </div>
      </div>
      <div className="hud-grid">
        {s.inventory.map((it, i) => {
          const eq = s.equipped[it.slot];
          const delta = it.slot === "weapon" ? (it.atk ?? 0) - (eq?.atk ?? 0) : (it.def ?? 0) - (eq?.def ?? 0);
          const unseen = !s.flags[`seen-${it.id}`];
          return (
            <button
              key={it.id + i}
              style={{ color: rarityColor(it.rarity) }}
              onMouseEnter={() => setTip(`${it.desc}  ${delta >= 0 ? "+" : ""}${delta} vs equipped`)}
              onMouseLeave={() => setTip(null)}
              onClick={() => {
                const cur = useGame.getState().save!;
                useGame.getState().patch({
                  equipped: { ...cur.equipped, [it.slot]: it },
                  flags: { ...cur.flags, [`seen-${it.id}`]: true },
                });
                useGame.getState().setToast(`Equipped ${it.name}`);
              }}
            >
              <b>
                {it.name} {unseen && <span className="badge-new">NEW</span>}
              </b>
              <small>
                {it.slot} - {it.rarity}{" "}
                <span className={delta >= 0 ? "delta-up" : "delta-down"}>
                  {delta >= 0 ? "▲" : "▼"}
                  {Math.abs(delta)}
                </span>
              </small>
            </button>
          );
        })}
      </div>
      <button
        onClick={() => {
          const cur = useGame.getState().save!;
          const w = cur.equipped.weapon;
          if (!w) return;
          const next = upgradeItem(cur, w.id);
          if (!next) return useGame.getState().setToast("Need 25g at the anvil");
          useGame.getState().setSave(next);
          useGame.getState().setToast("Blacksmith: +1");
        }}
      >
        Upgrade equipped (25g)
      </button>
      {tip && <p className="hud-copy">{tip}</p>}
    </div>
  );
}

function Shop() {
  return (
    <div className="hud-grid">
      {SHOP.map((row) => {
        const it = ITEMS[row.id];
        if (!it) return null;
        return (
          <button
            key={row.id}
            onClick={() => {
              const cur = useGame.getState().save!;
              if (cur.gold < row.cost) return useGame.getState().setToast("Not enough gold");
              useGame.getState().patch({ gold: cur.gold - row.cost, inventory: [...cur.inventory, it] });
              useGame.getState().setToast(`Bought ${it.name}`);
            }}
          >
            {it.name}
            <small>{row.cost}g</small>
          </button>
        );
      })}
    </div>
  );
}

function Skills() {
  const s = useGame((g) => g.save)!;
  const cols = [
    ["hp1", "hp2", "def1", "skill"],
    ["atk1", "atk2", "crit", "cap"],
    ["sta1", "roll", "surge1", "ult"],
  ];
  return (
    <div>
      <p className="hud-copy">Points {s.statPoints} - lines show unlock paths</p>
      <div className="hud-tree">
        {cols.map((col, ci) => (
          <div key={ci} className="hud-tree-col">
            {col.map((id) => {
              const n = SKILL_TREE.find((x) => x.id === id)!;
              const have = s.skills.includes(n.id);
              const locked = n.req.some((r) => !s.skills.includes(r));
              const isNew = !have && !locked;
              return (
                <button
                  key={n.id}
                  className={have ? "on" : locked ? "locked" : ""}
                  onClick={() => {
                    const cur = useGame.getState().save!;
                    const next = buySkill(cur, n.id);
                    if (!next) return;
                    useGame.getState().setSave(next);
                    useGame.getState().setToast(n.name);
                  }}
                >
                  {n.name} {isNew && <span className="badge-new">NEW</span>}
                  <small>{n.desc}</small>
                  {n.req.length > 0 && <em>needs {n.req.join(", ")}</em>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function Quests() {
  const s = useGame((g) => g.save)!;
  const obj = useGame((g) => g.objectiveHud);
  return (
    <div>
      <p className="hud-copy">
        <b>Next:</b> {obj.text}
      </p>
      {MAIN.map((q) => {
        const st = s.quests.find((x) => x.id === q.id);
        return (
          <p key={q.id} className="hud-copy">
            <b>{q.title}</b> — {q.stages[st?.stage ?? 0] ?? "Done."} {st?.done ? "✓" : ""}
          </p>
        );
      })}
    </div>
  );
}

function Controls() {
  const keys = useGame((s) => s.keys);
  const [listen, setListen] = useState<string | null>(null);
  useEffect(() => {
    if (!listen) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      useGame.getState().bindKey(listen, e.key.toUpperCase() === " " ? "SPACE" : e.key.toUpperCase());
      setListen(null);
    };
    window.addEventListener("keydown", onKey, { once: true });
    return () => window.removeEventListener("keydown", onKey);
  }, [listen]);
  return (
    <div className="hud-copy">
      {Object.entries(keys).map(([k, v]) => (
        <p key={k}>
          <button onClick={() => setListen(k)}>{listen === k ? "press a key…" : k}</button> {v}
        </p>
      ))}
      <p>Gamepad: stick move, A attack, X skill, Y ult, B roll.</p>
    </div>
  );
}

function Help() {
  return (
    <div className="hud-copy">
      <p>
        <b>How to play</b>
      </p>
      <p>
        Walk with <span className="kb">WASD</span>. Swing <span className="kb">J</span>. Roll{" "}
        <span className="kb">SPC</span>. Block <span className="kb">H</span>. Talk <span className="kb">F</span>. Pack <span className="kb">I</span>.
      </p>
      <p>Follow the NOW banner. The glowing arrow points at your next job. Hit the dummy, then the training yard east of the plaza.</p>
      <p>
        <b>Keyboard</b>
      </p>
      <p>WASD move - J attack - K skill - L ultimate - Space roll - H block - F talk - I pack - U skills - F1 help - Esc pause - debug - F11 fullscreen</p>
      <p>
        <b>Gamepad</b>
      </p>
      <p>Left stick move - A attack - X skill - Y ultimate - B roll</p>
      <p>
        <b>Minimap</b>
      </p>
      <p className="hud-legend" data-testid="radar-legend">
        you / foe / elite / boss / loot / gate — gold you, red foes, violet elites, purple boss, green loot, cyan gate.
      </p>
      <p>
        <b>How the wheel affects the game</b>
      </p>
      <p>When Squeektoshi runs, gears spin at live RPM, Wheel Charge fills, and doors wake. When he naps, the Foundry gate sleeps and enemies slow down.</p>
      <button onClick={() => useGame.getState().patch({ tutorialStep: 0, flags: { ...useGame.getState().save!.flags, skipTutorial: false } })}>
        Replay tutorial
      </button>
    </div>
  );
}

function Settings() {
  const ui = useGame((s) => s.uiScale);
  const vol = useGame((s) => s.volumes);
  const a11y = useGame((s) => s.a11y);
  const quality = useGame((s) => s.quality);
  const aimMode = useGame((s) => s.aimMode);
  return (
    <div className="hud-copy" data-testid="a11y-panel">
      <p>Aim mode</p>
      <nav className="hud-menu">
        {(["mouse", "assist", "auto"] as const).map((m) => (
          <button key={m} className={aimMode === m ? "on" : ""} data-testid={`aim-${m}`} onClick={() => useGame.getState().setAimMode(m)}>
            {m === "mouse" ? "Mouse" : m === "assist" ? "Assist" : "Auto-aim"}
          </button>
        ))}
      </nav>
      <p>Quality</p>
      <nav className="hud-menu">
        {(["auto", "low", "medium", "high"] as Quality[]).map((q) => (
          <button key={q} className={quality === q ? "on" : ""} data-testid={`quality-${q}`} onClick={() => useGame.getState().setQuality(q)}>
            {q}
          </button>
        ))}
      </nav>
      <p>UI scale (0 = auto)</p>
      <input
        type="range"
        min={0}
        max={4}
        step={0.25}
        value={ui}
        onChange={(e) => useGame.getState().setUiScale(Number(e.target.value))}
      />
      <p>SFX</p>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={vol.sfx}
        onChange={(e) => useGame.setState({ volumes: { ...useGame.getState().volumes, sfx: Number(e.target.value) } })}
      />
      <p>Music</p>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={vol.music}
        onChange={(e) => useGame.setState({ volumes: { ...useGame.getState().volumes, music: Number(e.target.value) } })}
      />
      <p>Screen shake</p>
      <p>
        <label>
          <input
            type="checkbox"
            data-testid="shake-toggle"
            checked={a11y.shake > 0}
            onChange={(e) => useGame.setState({ a11y: { ...useGame.getState().a11y, shake: e.target.checked ? 1 : 0 } })}
          />{" "}
          Enable screen shake
        </label>
      </p>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={a11y.shake}
        data-testid="shake-slider"
        onChange={(e) => useGame.setState({ a11y: { ...useGame.getState().a11y, shake: Number(e.target.value) } })}
      />
      <p>Flash intensity</p>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={a11y.flash}
        onChange={(e) => useGame.setState({ a11y: { ...useGame.getState().a11y, flash: Number(e.target.value) } })}
      />
      <p>
        <label>
          <input
            type="checkbox"
            checked={a11y.outline}
            onChange={(e) => useGame.setState({ a11y: { ...useGame.getState().a11y, outline: e.target.checked } })}
          />{" "}
          High-contrast outlines
        </label>
      </p>
      <p>
        <label>
          <input
            type="checkbox"
            checked={a11y.holdBlock}
            onChange={(e) => useGame.setState({ a11y: { ...useGame.getState().a11y, holdBlock: e.target.checked } })}
          />{" "}
          Hold to block (off = toggle)
        </label>
      </p>
      <button onClick={() => useGame.getState().setOverlay("controls")}>Remap keys</button>
      <button onClick={() => void toggleFullscreen()}>Toggle fullscreen</button>
    </div>
  );
}

function LevelUp() {
  const s = useGame((g) => g.save)!;
  function pick(stat: "hp" | "atk" | "def") {
    const cur = useGame.getState().save!;
    if (cur.statPoints < 1) return;
    if (stat === "hp") useGame.getState().patch({ hpMax: cur.hpMax + 8, hp: cur.hp + 8, statPoints: cur.statPoints - 1 });
    if (stat === "atk") useGame.getState().patch({ atk: cur.atk + 1, statPoints: cur.statPoints - 1 });
    if (stat === "def") useGame.getState().patch({ def: cur.def + 1, statPoints: cur.statPoints - 1 });
    if ((useGame.getState().save?.statPoints ?? 0) <= 0) useGame.getState().setOverlay("none");
  }
  return (
    <div className="hud-copy">
      <p>Level {s.level}. Spend {s.statPoints} point{s.statPoints === 1 ? "" : "s"}.</p>
      <nav className="hud-menu">
        <button onClick={() => pick("hp")}>+8 HP</button>
        <button onClick={() => pick("atk")}>+1 ATK</button>
        <button onClick={() => pick("def")}>+1 DEF</button>
      </nav>
    </div>
  );
}

function TouchPad() {
  return (
    <div className="hud-touch">
      <div
        className="stick"
        onPointerDown={(e) => sendJoy(e)}
        onPointerMove={(e) => e.buttons && sendJoy(e)}
        onPointerUp={() => window.dispatchEvent(new CustomEvent("wb-joy", { detail: { x: 0, y: 0 } }))}
      />
      {["attack", "skill", "ult", "roll", "block", "talk"].map((b) => (
        <button
          key={b}
          onPointerDown={() => window.dispatchEvent(new CustomEvent("wb-btn", { detail: { b, d: true } }))}
          onPointerUp={() => window.dispatchEvent(new CustomEvent("wb-btn", { detail: { b, d: false } }))}
        >
          {b[0]!.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function sendJoy(e: React.PointerEvent) {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * 2 - 1;
  const y = ((e.clientY - r.top) / r.height) * 2 - 1;
  window.dispatchEvent(new CustomEvent("wb-joy", { detail: { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) } }));
}

export function useMemoHud() {
  return useMemo(() => 1, []);
}
