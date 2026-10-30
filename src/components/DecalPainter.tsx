import { useState } from "react";
import { DECAL_PALETTE } from "../game/rider";
import { utf8ToB64url, b64urlToUtf8 } from "../game/codec";

const SIZE = 8;

const STAMPS: { name: string; pixels: number[] }[] = [
  {
    name: "HEART",
    pixels: [
      0,2,2,0,0,2,2,0,
      2,2,2,2,2,2,2,2,
      2,2,2,2,2,2,2,2,
      2,2,2,2,2,2,2,2,
      0,2,2,2,2,2,2,0,
      0,0,2,2,2,2,0,0,
      0,0,0,2,2,0,0,0,
      0,0,0,0,0,0,0,0,
    ],
  },
  {
    name: "BOLT",
    pixels: [
      0,0,0,3,3,0,0,0,
      0,0,0,3,3,0,0,0,
      0,0,3,3,0,0,0,0,
      0,3,3,3,3,0,0,0,
      0,0,3,3,3,0,0,0,
      0,0,0,3,3,0,0,0,
      0,0,3,3,0,0,0,0,
      0,0,0,0,0,0,0,0,
    ],
  },
  {
    name: "SMILEY",
    pixels: [
      0,0,3,3,3,3,0,0,
      0,3,3,3,3,3,3,0,
      3,3,0,3,3,0,3,3,
      3,3,0,3,3,0,3,3,
      3,3,3,3,3,3,3,3,
      3,0,3,0,0,3,0,3,
      3,0,0,3,3,0,0,3,
      0,3,3,3,3,3,3,0,
    ],
  },
  {
    name: "SKULL",
    pixels: [
      0,1,1,1,1,1,1,0,
      1,1,1,1,1,1,1,1,
      1,0,1,1,1,1,0,1,
      1,0,1,1,1,1,0,1,
      1,1,1,0,0,1,1,1,
      1,1,0,1,1,0,1,1,
      1,1,1,1,1,1,1,1,
      0,1,1,1,1,1,1,0,
    ],
  },
];

function sanitizeDecal(v: unknown): number[] {
  const arr = Array.isArray(v) ? v : [];
  const out: number[] = [];
  for (let i = 0; i < SIZE * SIZE; i++) {
    const n = arr[i];
    out.push(typeof n === "number" && Number.isInteger(n) && n >= 0 && n < DECAL_PALETTE.length ? n : 0);
  }
  return out;
}

function encodeDecal(pixels: number[]): string {
  return utf8ToB64url(JSON.stringify({ v: 1, d: pixels.join("") }));
}

function decodeDecal(code: string): number[] | null {
  try {
    const json = b64urlToUtf8(code.trim());
    if (!json) return null;
    const data = JSON.parse(json) as { v?: number; d?: unknown };
    if (data.v !== 1 || typeof data.d !== "string" || !/^[0-7]{64}$/.test(data.d)) return null;
    return data.d.split("").map((c) => Number(c));
  } catch {
    return null;
  }
}

export default function DecalPainter({ initial, onSave }: {
  initial: number[] | null;
  /** persists the decal (null = back to the stock decal choice) */
  onSave: (pixels: number[] | null) => void;
}) {
  const [pixels, setPixels] = useState<number[]>(() => sanitizeDecal(initial));
  const [color, setColor] = useState(2);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");

  const paint = (i: number) => setPixels((prev) => {
    const next = [...prev];
    next[i] = next[i] === color ? 0 : color;
    return next;
  });

  const anyPainted = pixels.some((p) => p > 0);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10px] leading-snug text-white/55">
        Paint an 8×8 vinyl for your tank. Your painted decal overrides the stock decal choices until you clear it.
      </p>

      <div>
        <div className="mb-1.5 font-display text-[10px] font-bold tracking-[0.24em] text-white/70">COLOUR</div>
        <div className="flex gap-1.5">
          {DECAL_PALETTE.map((c, i) => (
            <button key={c} onClick={() => setColor(i)}
              className={`h-7 w-7 rounded-lg border-2 ${color === i ? "scale-110" : "border-white/20"}`}
              style={i === 0
                ? { background: "repeating-conic-gradient(#334 0% 25%, #223 0% 50%) 50% / 8px 8px" }
                : { background: c, boxShadow: color === i ? `0 0 10px ${c}` : "none" }}
              aria-label={i === 0 ? "eraser" : `colour ${i}`} />
          ))}
        </div>
      </div>

      <div className="flex justify-center">
        <div className="grid grid-cols-8 gap-0.5 rounded-xl border border-white/15 bg-black/50 p-2"
          style={{ width: "min(100%, 260px)" }}>
          {pixels.map((p, i) => (
            <button key={i} onClick={() => paint(i)}
              className="aspect-square rounded-[2px]"
              style={{
                background: p === 0
                  ? "rgba(255,255,255,0.06)"
                  : DECAL_PALETTE[p],
                boxShadow: p > 0 ? "inset 0 0 2px rgba(0,0,0,0.4)" : "none",
              }}
              aria-label={`pixel ${i}`} />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STAMPS.map((s) => (
          <button key={s.name} onClick={() => setPixels(sanitizeDecal(s.pixels))}
            className="btn-neon rounded-lg border border-white/10 bg-black/30 px-2 py-1 font-display text-[8px] font-bold text-white/70">
            {s.name}
          </button>
        ))}
        <button onClick={() => setPixels(Array(64).fill(0))}
          className="btn-neon rounded-lg border border-white/10 bg-black/30 px-2 py-1 font-display text-[8px] font-bold text-white/70">
          CLEAR
        </button>
      </div>

      <div className="flex gap-2">
        <button onClick={() => { onSave(anyPainted ? pixels : null); }}
          className="btn-neon flex-1 rounded-xl bg-gradient-to-b from-fuchsia-400 to-purple-700 py-2.5 font-display text-xs font-black text-black">
          {anyPainted ? "SAVE VINYL" : "USE STOCK DECAL"}
        </button>
        <button onClick={() => { setCode(encodeDecal(pixels)); setMsg("Code created"); }}
          className="btn-neon rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 font-display text-xs font-bold text-white">
          EXPORT
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/30 p-2.5">
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Paste a vinyl code…"
          className="h-10 w-full resize-none rounded-lg border border-white/10 bg-black/45 p-2 font-mono text-[9px] text-fuchsia-200 outline-none"
        />
        <div className="mt-1.5 flex items-center gap-2">
          <button onClick={() => {
            const d = decodeDecal(code);
            if (!d) { setMsg("Invalid vinyl code"); return; }
            setPixels(d);
            setMsg("Vinyl loaded");
          }} className="btn-neon rounded-lg bg-white/10 px-3 py-1.5 font-display text-[9px] font-bold text-white">IMPORT</button>
          {code && <button onClick={() => { void navigator.clipboard?.writeText(code); setMsg("Code copied"); }}
            className="btn-neon rounded-lg bg-white/10 px-3 py-1.5 font-display text-[9px] font-bold text-white">COPY</button>}
          {msg && <span className="text-[9px] text-fuchsia-300">{msg}</span>}
        </div>
      </div>
    </div>
  );
}
