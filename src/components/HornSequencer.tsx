import { useEffect, useRef, useState } from "react";
import { sfx } from "../game/audio";

const STEPS = 16;
/** Rows = semitone offsets (pentatonic + do notes), top = highest. */
const NOTE_ROWS: { label: string; semi: number }[] = [
  { label: "C6", semi: 24 }, { label: "A5", semi: 21 }, { label: "G5", semi: 19 },
  { label: "F5", semi: 17 }, { label: "E5", semi: 16 }, { label: "D5", semi: 14 },
  { label: "C5", semi: 12 }, { label: "A4", semi: 9 }, { label: "G4", semi: 7 },
  { label: "E4", semi: 4 }, { label: "C4", semi: 0 },
];

const PRESETS: { name: string; steps: number[] }[] = [
  { name: "AIRHORN", steps: [7, -1, 7, -1, 9, -1, 7, -1, 4, -1, 4, -1, 7, 7, -1, -1] },
  { name: "FANFARE", steps: [0, 4, 7, 12, -1, 12, -1, 9, 7, -1, 4, -1, 0, -1, -1, -1] },
  { name: "ARPEGGIO", steps: [0, 4, 7, 12, 7, 4, 0, 4, 7, 12, 16, 12, 7, 4, 0, -1] },
  { name: "RIFF", steps: [7, -1, -1, 7, 9, -1, 7, -1, 4, -1, 7, -1, -1, -1, 2, -1] },
];

function normalize(steps: unknown): number[] {
  const arr = Array.isArray(steps) ? steps : [];
  const out: number[] = [];
  for (let i = 0; i < STEPS; i++) {
    const v = arr[i];
    out.push(typeof v === "number" && Number.isFinite(v) ? Math.max(-1, Math.min(24, Math.round(v))) : -1);
  }
  return out;
}

export default function HornSequencer({ initial, accent, onSave }: {
  initial: number[] | null;
  accent: string;
  /** persists the horn (null clears it) */
  onSave: (steps: number[] | null) => void;
}) {
  const [grid, setGrid] = useState<number[]>(() => normalize(initial));
  const [playing, setPlaying] = useState(-1);
  const playTimer = useRef<number | null>(null);

  useEffect(() => () => { if (playTimer.current !== null) window.clearInterval(playTimer.current); }, []);

  const toggle = (row: number, step: number) => {
    setGrid((prev) => {
      const next = [...prev];
      next[step] = next[step] === NOTE_ROWS[row].semi ? -1 : NOTE_ROWS[row].semi;
      return next;
    });
  };

  const preview = () => {
    sfx.unlock();
    sfx.setCustomHorn(grid);
    sfx.horn("airhorn"); // plays the custom horn while one is loaded
    // simple playhead animation at the same 95ms step the synth uses
    if (playTimer.current !== null) window.clearInterval(playTimer.current);
    let step = 0;
    setPlaying(0);
    playTimer.current = window.setInterval(() => {
      step++;
      if (step >= STEPS) {
        window.clearInterval(playTimer.current!);
        playTimer.current = null;
        setPlaying(-1);
        return;
      }
      setPlaying(step);
    }, 95);
  };

  const hasNotes = grid.some((s) => s >= 0);

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[10px] leading-snug text-white/55">
        Tap cells to place notes — a saved horn replaces your stock horn everywhere: run honks,
        near-miss taunts and the podium fanfare.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button key={p.name} onClick={() => setGrid(normalize(p.steps))}
            className="btn-neon rounded-lg border border-white/10 bg-black/30 px-2 py-1 font-display text-[8px] font-bold text-white/70">
            {p.name}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-2">
        <div className="min-w-[330px]">
          {NOTE_ROWS.map((row, r) => (
            <div key={row.label} className="mb-1 flex items-center gap-0.5">
              <span className="w-6 shrink-0 text-right font-display text-[7px] text-white/35">{row.label}</span>
              {grid.map((semi, s) => {
                const on = semi === row.semi;
                return (
                  <button key={s} onClick={() => toggle(r, s)}
                    className={`h-4.5 flex-1 rounded-sm ${on ? "" : "bg-white/6"} ${playing === s ? "ring-1 ring-white/60" : ""}`}
                    style={on ? { background: accent, boxShadow: `0 0 6px ${accent}` } : {}}
                    aria-label={`${row.label} step ${s + 1}`} />
                );
              })}
            </div>
          ))}
          <div className="mt-0.5 flex gap-0.5 pl-6.5 text-center text-[6px] text-white/30">
            {grid.map((_, s) => <span key={s} className="flex-1">{s % 4 === 0 ? s + 1 : "·"}</span>)}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={preview} disabled={!hasNotes}
          className="btn-neon flex-1 rounded-xl bg-gradient-to-b from-cyan-400 to-blue-600 py-2.5 font-display text-xs font-black text-black disabled:opacity-40">
          PREVIEW
        </button>
        <button onClick={() => { onSave(hasNotes ? grid : null); sfx.setCustomHorn(hasNotes ? grid : null); }}
          className="btn-neon flex-1 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-700 py-2.5 font-display text-xs font-black text-black">
          {hasNotes ? "SAVE HORN" : "CLEAR HORN"}
        </button>
      </div>
    </div>
  );
}
