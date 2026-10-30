import { useEffect, useRef, useState } from "react";
import { drawRiderBody } from "../game/rider";
import type { Settings } from "../game/engine";
import type { ReplayFrame } from "../game/progression";
import type { Theme } from "../game/themes";
import { PlayIcon, PauseIcon } from "./Icons";

export default function ReplayTheater({ frames, settings, theme, autoPlay = false }: {
  frames: ReplayFrame[];
  settings: Settings;
  theme: Theme;
  /** start playing immediately (attract demo) */
  autoPlay?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const [zoom, setZoom] = useState(1);
  const frame = frames[Math.min(index, Math.max(0, frames.length - 1))];

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setIndex((i) => {
        if (i >= frames.length - 1) {
          // loop forever in attract mode; stop in the theater
          if (autoPlay) return 0;
          setPlaying(false);
          return frames.length - 1;
        }
        return i + 1;
      });
    }, 1000 / 15);
    return () => clearInterval(id);
  }, [playing, frames.length, autoPlay]);

  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const rect = c.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(rect.width * dpr);
    c.height = Math.round(rect.height * dpr);
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const sky = ctx.createLinearGradient(0, 0, 0, h);
    for (const [o, col] of theme.sky) sky.addColorStop(o, col);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = theme.road;
    ctx.beginPath();
    ctx.moveTo(w * 0.32, h * 0.32);
    ctx.lineTo(w * 0.68, h * 0.32);
    ctx.lineTo(w * 1.25, h);
    ctx.lineTo(-w * 0.25, h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = theme.edges[0];
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.32);
    ctx.lineTo(w / 2, h);
    ctx.setLineDash([12, 16]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Score trace and a small replay timeline make the saved run inspectable.
    const slice = frames.slice(0, index + 1);
    if (slice.length > 1) {
      const max = Math.max(1, ...frames.map((f) => f.score));
      ctx.strokeStyle = "rgba(255,224,102,0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      slice.forEach((f, i) => {
        const x = 14 + (i / Math.max(frames.length - 1, 1)) * (w - 28);
        const y = h * 0.25 - (f.score / max) * h * 0.16;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    const riderX = w / 2 + (frame?.x ?? 0) * w * 0.14;
    const groundY = h * 0.88;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.ellipse(riderX, groundY, 38, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(riderX, groundY - (frame?.h ?? 0) * 100 * zoom);
    ctx.scale(zoom, zoom);
    drawRiderBody(ctx, 1.45, settings, "ride", (frame?.t ?? 0) * 8);
    ctx.restore();

    ctx.fillStyle = "#fff";
    ctx.font = "700 11px Orbitron, monospace";
    ctx.textAlign = "left";
    ctx.fillText(`${frame?.speed ?? 0} KM/H`, 12, 20);
    ctx.textAlign = "right";
    ctx.fillText(`${(frame?.score ?? 0).toLocaleString()} PTS`, w - 12, 20);
    if (frame?.event) {
      ctx.fillStyle = theme.accent;
      ctx.textAlign = "center";
      ctx.font = "900 16px Orbitron, monospace";
      ctx.fillText(frame.event, w / 2, h * 0.4);
    }
  }, [frames, frame, index, settings, theme, zoom]);

  if (!frames.length) {
    return <div className="rounded-xl border border-white/10 bg-black/30 p-8 text-center text-sm text-white/55">No recorded run yet.</div>;
  }

  return (
    <div>
      <canvas ref={canvasRef} className="h-64 w-full rounded-xl border border-white/10" />
      <div className="mt-3 flex items-center gap-2">
        <button onClick={() => {
          if (!playing && index >= frames.length - 1) setIndex(0);
          setPlaying((v) => !v);
        }} className="btn-neon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
          {playing ? <PauseIcon size={17} /> : <PlayIcon size={17} />}
        </button>
        <input type="range" min={0} max={frames.length - 1} value={index}
          onChange={(e) => { setPlaying(false); setIndex(Number(e.target.value)); }} className="w-full accent-cyan-300" />
        <select value={zoom} onChange={(e) => setZoom(Number(e.target.value))}
          className="rounded-lg border border-white/10 bg-[#140a2e] px-2 py-2 text-[10px] text-white">
          <option value="0.8">0.8×</option><option value="1">1×</option><option value="1.25">1.25×</option>
        </select>
      </div>
      <div className="mt-1 flex justify-between font-display text-[9px] text-white/45">
        <span>{frame?.t.toFixed(1)}s</span>
        <span>FRAME {index + 1} / {frames.length}</span>
      </div>
    </div>
  );
}