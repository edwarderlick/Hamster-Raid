import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useSignMessage, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { Intro } from "./components/Intro";
import { WalletModal } from "./components/WalletModal";
import { type HeroClass } from "./lib/classes";
import { buildSignMessage, type SignedIntent } from "./lib/signatures";
import { createGame } from "./game/main";
import { freshSave, useGame } from "./game/store";
import { loadMute, setMuted, isMuted } from "./audio";
import { GameHUD } from "./components/GameHUD";
import { enterFullscreen, toggleFullscreen, wantsFullscreen } from "./game/scale";
import { SpriteViewer } from "./pages/SpriteViewer";
import { Landing } from "./components/Landing";

type Shell = "intro" | "land" | "play";

export default function App() {
  const [shell, setShell] = useState<Shell>(() => (sessionStorage.getItem("hr-intro") ? "land" : "intro"));
  const [walletOpen, setWalletOpen] = useState(false);
  const [mute, setMute] = useState(true);
  const [savedBlob, setSavedBlob] = useState<ReturnType<typeof freshSave> | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const { address, isConnected, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { switchChain } = useSwitchChain();

  useEffect(() => {
    const m = loadMute();
    setMute(m);
    useGame.setState({
      volumes: { sfx: m ? 0 : 0.4, music: m ? 0 : 0.25 },
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F11") {
        e.preventDefault();
        void toggleFullscreen();
      }
      if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!address) {
      setSavedBlob(null);
      return;
    }
    fetch(`/api/save?address=${address}`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.blob?.heroClass) setSavedBlob(j.blob);
      })
      .catch(() => undefined);
  }, [address]);

  const finishIntro = useCallback(() => {
    sessionStorage.setItem("hr-intro", "1");
    setShell("land");
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const qa = q.get("qa");
    if (qa === "1" || qa === "wanderer") {
      sessionStorage.setItem("hr-intro", "1");
      useGame.getState().setSave(freshSave("wanderer", 1, true));
      setShell("play");
      return;
    }
    if (qa === "arena" || qa === "battle" || qa === "perf") {
      sessionStorage.setItem("hr-intro", "1");
      const blob = freshSave("wanderer", 1, true);
      blob.zone = qa === "arena" ? "arena" : "battle";
      blob.arenaLevel = qa === "perf" ? 5 : 1;
      if (qa === "perf") blob.flags = { ...blob.flags, perf: true };
      if (qa === "battle" || qa === "perf") blob.guns = ["pistol", "shotgun", "rifle", "launcher", "coil"];
      useGame.getState().setSave(blob);
      setShell("play");
    }
  }, []);

  async function signJoin() {
    if (!address) {
      setWalletOpen(true);
      return false;
    }
    if (chainId !== sepolia.id) {
      switchChain({ chainId: sepolia.id });
      return false;
    }
    const nonceRes = await fetch("/api/nonce", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address }),
    });
    const nonceJson = await nonceRes.json();
    const intent: SignedIntent = {
      address,
      nonce: nonceJson.nonce,
      expiresAt: nonceJson.expiresAt,
      action: "join",
      week: nonceJson.week,
      chainId: 11155111,
    };
    const signature = await signMessageAsync({ message: buildSignMessage(intent) });
    const res = await fetch("/api/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ intent, signature }),
    });
    if (!res.ok) throw new Error("join failed");
    return res.json();
  }

  async function begin(cls: HeroClass | "wanderer") {
    let squeek = 1;
    let spectator = cls === "wanderer";
    try {
      const j = await signJoin();
      if (j && cls !== "wanderer") {
        squeek = j.join?.level ?? 1;
        spectator = j.join?.spectator ?? false;
      }
    } catch {
      spectator = true;
    }
    const blob = freshSave(cls, spectator ? 1 : squeek, spectator);
    blob.zone = "arena";
    useGame.getState().setSave(blob);
    setShell("play");
    if (wantsFullscreen()) void enterFullscreen();
  }

  function continueSave() {
    if (!savedBlob) return;
    useGame.getState().setSave(savedBlob);
    setShell("play");
    if (wantsFullscreen()) void enterFullscreen();
  }

  useEffect(() => {
    if (shell !== "play" || !host.current) return;
    const g = createGame(host.current);
    gameRef.current = g;
    const focusCanvas = () => {
      const canvas = host.current?.querySelector("canvas") as HTMLCanvasElement | null;
      if (!canvas) return false;
      canvas.tabIndex = 0;
      canvas.focus();
      return true;
    };
    const fid = window.setInterval(() => {
      if (focusCanvas()) window.clearInterval(fid);
    }, 80);
    const onVis = () => {
      if (document.visibilityState === "visible") focusCanvas();
    };
    window.addEventListener("focus", focusCanvas);
    document.addEventListener("visibilitychange", onVis);
    host.current.addEventListener("pointerdown", focusCanvas);
    const id = setInterval(() => {
      const s = useGame.getState().save;
      const addr = address;
      if (!s || !addr) return;
      fetch("/api/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: addr, blob: s }),
      }).catch(() => undefined);
    }, 15000);
    const onQuit = () => {
      setShell("land");
      useGame.getState().setSave(null);
    };
    window.addEventListener("wb-quit", onQuit);
    return () => {
      clearInterval(id);
      window.clearInterval(fid);
      g.destroy(true);
      gameRef.current = null;
      window.removeEventListener("wb-quit", onQuit);
      window.removeEventListener("focus", focusCanvas);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [shell, address]);

  function toggleMute() {
    const n = !isMuted();
    setMuted(n);
    setMute(n);
    useGame.setState({ volumes: { sfx: n ? 0 : 0.4, music: n ? 0 : 0.25 } });
  }

  if (typeof window !== "undefined" && window.location.pathname.startsWith("/dev/sprites")) {
    return <SpriteViewer />;
  }

  if (shell === "intro") return <Intro onDone={finishIntro} />;

  if (shell === "play") {
    return (
      <div className="game-root">
        <div className="game-stage" data-testid="game-stage">
          <div ref={host} className="game-canvas-host" data-testid="game-canvas" />
          <GameHUD />
          <button
            data-testid="sfx-toggle"
            className="pointer-events-auto"
            style={{ position: "absolute", right: 12, top: 12, zIndex: 8, opacity: 0, width: 1, height: 1 }}
            onClick={toggleMute}
          >
            {mute ? "SFX OFF" : "SFX ON"}
          </button>
        </div>
        <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
      </div>
    );
  }

  return (
    <>
      <Landing
        onEnter={() => {
          void enterFullscreen();
          void begin("raider");
        }}
        onWallet={() => setWalletOpen(true)}
        onWanderer={() => void begin("wanderer")}
        onContinue={savedBlob ? continueSave : undefined}
        connected={isConnected}
        address={address}
        savedLabel={savedBlob ? `Continue Pip Lv${savedBlob.level}` : undefined}
      />
      <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
    </>
  );
}
