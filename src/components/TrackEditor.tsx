import { useMemo, useRef, useState } from "react";
import {
  sanitizeTrack, encodeTrack, decodeTrack, TRACK_KIND_LABELS,
  type TrackData, type TrackItem, type TrackItemKind,
} from "../game/trackcode";

const KINDS = Object.keys(TRACK_KIND_LABELS) as TrackItemKind[];
const LANES: (-1 | 0 | 1)[] = [-1, 0, 1];

/** Colour chip per palette entry for the editor grid. */
const KIND_CHIP: Record<TrackItemKind, string> = {
  "car-sedan": "#64748b", "car-sports": "#ef4444", "car-taxi": "#fbbf24",
  "car-van": "#8b5cf6", "car-police": "#3b82f6", "car-truck": "#111827",
  "car-ambulance": "#f8fafc", "car-bus": "#f97316", "car-flatbed": "#0ea5e9",
  "car-moto": "#22c55e", "coin": "#ffd700", "hazard-pothole": "#78350f",
  "hazard-cone": "#fb923c", "hazard-barrier": "#ef4444", "hazard-spikes": "#f43f5e",
  "ramp": "#38bdf8", "toll": "#fde047", "portal-shard": "#c084fc",
};

interface Draft extends TrackItem { key: number }
let draftKey = 1;

export default function TrackEditor({ initial, accent, onRide, onClose }: {
  initial: TrackData | null;
  accent: string;
  /** starts a run with the given track */
  onRide: (track: TrackData) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "My Track");
  const [length, setLength] = useState(initial?.length ?? 1500);
  const [items, setItems] = useState<Draft[]>(
    (initial?.items ?? []).map((i) => ({ ...i, key: draftKey++ }))
  );
  const [kind, setKind] = useState<TrackItemKind>("car-sedan");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const keySeed = useRef(1);

  const zoomSteps = 100; // 1 cell = 100m
  const cols = 30; // 3000m
  const rows = 3;

  const grid = useMemo(() => {
    // cell [row][col] -> item or null; col 0 is the start
    const g: (Draft | null)[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
    for (const it of items) {
      const col = Math.min(cols - 1, Math.floor(it.at / zoomSteps));
      const row = LANES.indexOf(it.lane as -1 | 0 | 1);
      if (row >= 0 && !g[row][col]) g[row][col] = it;
    }
    return g;
  }, [items]);

  const place = (row: number, col: number) => {
    const lane = LANES[row];
    const at = col * zoomSteps + zoomSteps / 2;
    const existing = grid[row][col];
    if (existing) {
      setItems((prev) => prev.filter((i) => i.key !== existing.key));
      return;
    }
    setItems((prev) => [...prev, { key: draftKey++, at, lane, kind }]);
  };

  const track: TrackData = useMemo(
    () => ({ name: name.slice(0, 24) || "My Track", length, items: items.map(({ at, lane, kind: k }) => ({ at, lane, kind: k })) }),
    [name, length, items]
  );

  const sanitized = useMemo(() => sanitizeTrack(track) ?? { ...track, items: [] }, [track]);
  const dropped = items.length - sanitized.items.length;

  const doExport = () => {
    setCode(encodeTrack(sanitized));
    setMsg("Share code created — copy it below");
  };

  const doImport = () => {
    const t = decodeTrack(code);
    if (!t) { setMsg("Invalid track code"); return; }
    setName(t.name);
    setLength(t.length);
    setItems(t.items.map((i) => ({ ...i, key: draftKey++ })));
    setMsg(`Loaded "${t.name}"`);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          value={name}
          maxLength={24}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/45 px-2.5 py-2 text-xs font-bold text-white outline-none focus:border-white/40"
          placeholder="Track name"
        />
        <select
          value={length}
          onChange={(e) => setLength(Number(e.target.value))}
          className="rounded-lg border border-white/15 bg-[#140a2e] px-2 py-2 text-xs text-white"
        >
          {[500, 1000, 1500, 2000, 3000].map((l) => <option key={l} value={l}>{l}m</option>)}
        </select>
      </div>

      <div>
        <div className="mb-1.5 font-display text-[10px] font-bold tracking-[0.24em] text-white/70">PALETTE</div>
        <div className="grid grid-cols-6 gap-1.5">
          {KINDS.map((k) => (
            <button key={k} onClick={() => setKind(k)}
              className={`rounded-lg border px-1 py-1.5 text-center ${kind === k ? "bg-white/10" : "border-white/10 bg-black/30"}`}
              style={kind === k ? { borderColor: accent } : {}}>
              <span className="mx-auto mb-0.5 block h-1.5 w-4 rounded-full" style={{ background: KIND_CHIP[k] }} />
              <span className="block truncate text-[7px] font-bold text-white/80">{TRACK_KIND_LABELS[k]}</span>
            </button>
          ))}
        </div>
        <p className="mt-1 text-[9px] text-white/45">Pick a piece, then tap a road cell to place it. Tap an item to remove it.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-2">
        <div className="min-w-[430px]">
          <div className="mb-1 flex justify-between text-[8px] text-white/40">
            <span>START</span><span>{Math.round(length / 2)}m</span><span>FINISH {length}m</span>
          </div>
          {grid.map((rowCells, r) => (
            <div key={r} className="mb-1 flex items-center gap-0.5">
              <span className="w-4 shrink-0 text-center text-[8px] text-white/35">{LANES[r] === -1 ? "L" : LANES[r] === 0 ? "C" : "R"}</span>
              {rowCells.map((cell, c) => (
                <button key={c} onClick={() => place(r, c)}
                  className="h-6 flex-1 rounded border border-white/8 bg-white/4 active:scale-95"
                  style={cell ? { background: KIND_CHIP[cell.kind], borderColor: "rgba(255,255,255,0.5)" } : {}}>
                  {cell && <span className="block h-full w-full" />}
                </button>
              ))}
            </div>
          ))}
          <div className="mt-0.5 flex justify-between text-[7px] text-white/25">
            <span>0m</span><span>1.5k</span><span>3.0k</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[9px] text-white/50">
        <span>{items.length} pieces placed{dropped > 0 ? ` · ${dropped} overflow dropped on save` : ""} · max 220</span>
        <button onClick={() => setItems([])} className="rounded-lg bg-white/5 px-2 py-1 font-bold text-white/70">CLEAR</button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => { keySeed.current++; onRide(sanitized); }}
          className="btn-neon flex-1 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-700 py-2.5 font-display text-xs font-black text-black"
        >
          TEST RIDE
        </button>
        <button onClick={doExport} className="btn-neon rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 font-display text-xs font-bold text-white">
          EXPORT
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/30 p-2.5">
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Paste a track share code…"
          className="h-14 w-full resize-none rounded-lg border border-white/10 bg-black/45 p-2 font-mono text-[9px] text-emerald-200 outline-none"
        />
        <div className="mt-1.5 flex items-center gap-2">
          <button onClick={doImport} className="btn-neon rounded-lg bg-white/10 px-3 py-1.5 font-display text-[9px] font-bold text-white">IMPORT CODE</button>
          {code && <button onClick={() => { void navigator.clipboard?.writeText(code); setMsg("Code copied"); }}
            className="btn-neon rounded-lg bg-white/10 px-3 py-1.5 font-display text-[9px] font-bold text-white">COPY</button>}
          {msg && <span className="text-[9px] text-emerald-300">{msg}</span>}
        </div>
      </div>

      <button onClick={onClose} className="btn-neon rounded-xl border border-white/15 bg-white/5 py-2 font-display text-[10px] font-bold text-white/80">
        BACK
      </button>
    </div>
  );
}
