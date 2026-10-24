import { useEffect, useRef, useState } from "react";
import type { Settings } from "../game/engine";
import { SharedDuelSimulation, type DuelFrame, type DuelFinish } from "../game/systems/duel";
import { BikeIcon, GamepadIcon, TrophyIcon } from "./Icons";

export default function DuelRace({ settings, multiplier, onExit, onWin }: {
  settings: Settings;
  multiplier: number;
  onExit: () => void;
  onWin: () => void;
}) {
  const c1 = useRef<HTMLCanvasElement>(null);
  const c2 = useRef<HTMLCanvasElement>(null);
  const sim = useRef<SharedDuelSimulation | null>(null);
  const score1 = useRef<HTMLSpanElement>(null);
  const score2 = useRef<HTMLSpanElement>(null);
  const gapLabelRef = useRef<HTMLSpanElement>(null);
  const fpsRef = useRef<HTMLSpanElement>(null);
  const pen1Ref = useRef<HTMLSpanElement>(null);
  const pen2Ref = useRef<HTMLSpanElement>(null);
  const p1DotRef = useRef<HTMLSpanElement>(null);
  const p2DotRef = useRef<HTMLSpanElement>(null);
  const [result, setResult] = useState<DuelFinish | null>(null);

  const onFrame = (frame: DuelFrame) => {
    if (score1.current) score1.current.textContent = Math.round(frame.scores[0] * multiplier).toLocaleString();
    if (score2.current) score2.current.textContent = Math.round(frame.scores[1] * multiplier).toLocaleString();
    if (fpsRef.current) fpsRef.current.textContent = `${Math.max(0, 2000 - frame.distances[0])}m TO FINISH`;
    const diff = frame.distances[0] - frame.distances[1];
    if (gapLabelRef.current) {
      gapLabelRef.current.textContent = Math.abs(diff) <= 1 ? "NECK & NECK" : diff > 0 ? `P1 +${diff}m` : `P2 +${Math.abs(diff)}m`;
      gapLabelRef.current.style.color = Math.abs(diff) <= 1 ? "#fde68a" : diff > 0 ? "#67e8f9" : "#f9a8d4";
    }
    if (p1DotRef.current && p2DotRef.current) {
      // dots now show race progress toward the 2000m finish line
      const pct1 = Math.max(4, Math.min(96, (frame.distances[0] / 2000) * 100));
      const pct2 = Math.max(4, Math.min(96, (frame.distances[1] / 2000) * 100));
      p1DotRef.current.style.left = `${pct1}%`;
      p2DotRef.current.style.left = `${pct2}%`;
    }
    if (pen1Ref.current) pen1Ref.current.textContent = frame.penalties[0] > 0 ? `+${frame.penalties[0]}s` : "CLEAN";
    if (pen2Ref.current) pen2Ref.current.textContent = frame.penalties[1] > 0 ? `+${frame.penalties[1]}s` : "CLEAN";
  };

  const begin = () => {
    if (!c1.current || !c2.current) return;
    sim.current?.destroy();
    const shared = new SharedDuelSimulation(
      [c1.current, c2.current],
      { ...settings, mode: "duel", quality: "low", autoPauseFocus: false },
      onFrame,
      (finish) => {
        setResult(finish);
        if (finish.winner === 1) onWin();
      },
    );
    sim.current = shared;
    shared.start();
  };

  useEffect(() => {
    begin();
    return () => sim.current?.destroy();
    // one shared simulation per duel; Rematch recreates it explicitly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rematch = () => { setResult(null); setTimeout(begin, 0); };

  return (
    <div className="absolute inset-0 z-25 flex flex-col bg-[#100820]">
      <div className="flex min-h-0 flex-1 flex-col">
        <section className="relative min-h-0 flex-1">
          <canvas ref={c1} className="absolute inset-0 h-full w-full" />
          <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex items-start justify-between px-3">
            <div className="rounded-xl border border-cyan-300/40 bg-black/65 px-3 py-1.5 backdrop-blur-sm">
              <div className="font-display text-[8px] font-bold tracking-widest text-cyan-200">PLAYER 1 · A/D OR ARROWS · W JUMP · CRASH = +8s</div>
              <div className="flex items-baseline gap-2">
                <span ref={score1} className="font-display text-lg font-black text-white">0</span>
                <span ref={pen1Ref} className="font-display text-[9px] font-black text-rose-300">CLEAN</span>
              </div>
            </div>
            <button onClick={onExit} className="pointer-events-auto rounded-lg bg-black/60 px-2.5 py-1 font-display text-[9px] font-bold text-white/85">EXIT</button>
          </div>
        </section>
        <div className="relative z-15 flex h-7 shrink-0 items-center gap-3 border-y border-white/15 bg-[#090416] px-3">
          <span className="font-display text-[8px] font-black text-cyan-300">P1</span>
          <div className="relative h-2 flex-1 rounded-full bg-white/10">
            <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white/25" />
            <span ref={p1DotRef} className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
            <span ref={p2DotRef} className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-pink-400 shadow-[0_0_8px_#f472b6]" />
          </div>
          <span ref={gapLabelRef} className="w-24 text-right font-display text-[8px] font-black text-yellow-200">NECK &amp; NECK</span>
          <span className="font-display text-[8px] font-black text-pink-300">P2</span>
          <span ref={fpsRef} className="w-24 text-right font-mono text-[8px] text-emerald-300/80">-- FPS · SHARED</span>
        </div>
        <section className="relative min-h-0 flex-1">
          <canvas ref={c2} className="absolute inset-0 h-full w-full" />
          <div className="pointer-events-none absolute inset-x-0 top-2 z-10 px-3">
            <div className="w-fit rounded-xl border border-pink-300/40 bg-black/65 px-3 py-1.5 backdrop-blur-sm">
              <div className="font-display text-[8px] font-bold tracking-widest text-pink-200">PLAYER 2 · J/L · I JUMP · GAMEPAD 2</div>
              <div className="flex items-baseline gap-2">
                <span ref={score2} className="font-display text-lg font-black text-white">0</span>
                <span ref={pen2Ref} className="font-display text-[9px] font-black text-rose-300">CLEAN</span>
              </div>
            </div>
            <span className="absolute right-3 top-0 rounded-lg bg-black/55 p-1.5 text-white/60"><GamepadIcon size={18} /></span>
          </div>
        </section>
      </div>
      {result && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#05020d]/85 p-5 backdrop-blur-md">
          <div className="pop-in w-full max-w-xs rounded-3xl border border-white/15 bg-[#0d0620]/95 p-5 text-center">
            <span className="mx-auto flex justify-center"><TrophyIcon size={44} /></span>
            <h2 className="font-display mt-2 text-2xl font-black tracking-widest text-white">{result.winner === 0 ? "DRAW!" : `PLAYER ${result.winner} WINS!`}</h2>
            <p className="font-display mt-1 text-[9px] tracking-widest text-white/50">FIRST ACROSS 2,000m · CRASH = +8s</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-cyan-300/10 p-3">
                <div className="font-display text-[9px] text-cyan-200">P1 RACE TIME</div>
                <div className="font-display text-2xl font-black text-white">{result.p1Time !== null ? `${result.p1Time.toFixed(1)}s` : "DNF"}</div>
                <div className="font-display text-[9px] text-rose-300">{result.p1Penalties} crash{result.p1Penalties === 1 ? "" : "es"}</div>
              </div>
              <div className="rounded-xl bg-pink-300/10 p-3">
                <div className="font-display text-[9px] text-pink-200">P2 RACE TIME</div>
                <div className="font-display text-2xl font-black text-white">{result.p2Time !== null ? `${result.p2Time.toFixed(1)}s` : "DNF"}</div>
                <div className="font-display text-[9px] text-rose-300">{result.p2Penalties} crash{result.p2Penalties === 1 ? "" : "es"}</div>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <button onClick={rematch} className="btn-neon flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-cyan-400 to-blue-600 py-3 font-display text-sm font-black text-black"><BikeIcon size={17} /> REMATCH</button>
              <button onClick={onExit} className="btn-neon rounded-xl border border-white/15 bg-white/5 py-2.5 font-display text-xs font-bold text-white/80">BACK TO GARAGE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
