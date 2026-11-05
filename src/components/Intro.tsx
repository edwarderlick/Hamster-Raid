import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function Intro({ onDone }: { onDone: () => void }) {
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [progress, setProgress] = useState(reduce ? 100 : 8);

  useEffect(() => {
    if (reduce) {
      const t = setTimeout(onDone, 400);
      return () => clearTimeout(t);
    }
    const start = Date.now();
    const id = setInterval(() => {
      const p = Math.min(100, ((Date.now() - start) / 2600) * 100);
      setProgress(p);
      if (p >= 100) {
        clearInterval(id);
        setTimeout(onDone, 280);
      }
    }, 40);
    const cap = setTimeout(onDone, 3200);
    const skip = () => onDone();
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => {
      clearInterval(id);
      clearTimeout(cap);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, [onDone, reduce]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-navy-950"
        exit={{ opacity: 0 }}
        role="dialog"
        aria-label="Hamster Raid intro"
      >
        <motion.img
          src="/art/logo.svg"
          alt="Hamster Raid"
          className="w-[min(520px,86vw)] glitch-in"
          initial={reduce ? false : { scale: 0.6, opacity: 0, rotate: -8 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 160, damping: 14 }}
        />
        <p className="mt-6 font-pixel text-[10px] tracking-widest text-volt-400">
          SQUEEKTOSHI LIVES
        </p>
        <div className="mt-8 h-1.5 w-56 overflow-hidden rounded-full bg-navy-700">
          <div
            className="h-full bg-gradient-to-r from-ember-500 to-volt-400"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-3 text-xs text-white/50">Click or press any key to skip</p>
      </motion.div>
    </AnimatePresence>
  );
}
