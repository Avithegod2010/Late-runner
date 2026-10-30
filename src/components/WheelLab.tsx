import { useEffect, useRef } from "react";
import { WHEEL_STYLES, WHEEL_COLORS, wheelStyleById } from "../game/garage";
import { drawRearWheel } from "../game/rider";

/** Live spinning rear-wheel preview rendered with the exact in-game renderer. */
function WheelCanvas({ style, color, spinning }: { style: string; color: string; spinning: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const spinRef = useRef(0);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const W = 132;
    const H = 116;
    cv.width = W * 2;
    cv.height = H * 2;
    let raf = 0;
    let last = performance.now();
    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (spinning) spinRef.current += dt * 5.2;
      ctx.save();
      ctx.scale(2, 2);
      ctx.clearRect(0, 0, W, H);
      // podium glow behind the wheel
      const glow = ctx.createRadialGradient(W / 2, H * 0.52, 4, W / 2, H * 0.52, 52);
      glow.addColorStop(0, `${color}44`);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
      ctx.translate(W / 2, H * 0.62);
      drawRearWheel(ctx, 1.55, spinRef.current, style, color);
      ctx.restore();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [style, color, spinning]);

  return <canvas ref={ref} className="block h-[116px] w-[132px]" aria-label="Wheel preview" />;
}

/**
 * WHEEL LAB — the Garage wheel customizer. Pick a rim style, paint it, watch
 * it spin live with the same renderer the game uses.
 */
export default function WheelLab({ style, color, onStyle, onColor, accent, tapUi }: {
  style: string;
  color: string;
  onStyle: (id: string) => void;
  onColor: (c: string) => void;
  accent: string;
  tapUi: () => void;
}) {
  const cur = wheelStyleById(style);
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="mb-1 flex items-center justify-between">
        <div className="font-display text-[10px] font-bold tracking-[0.2em] text-white/70">WHEEL LAB</div>
        <div className="rounded-full px-2 py-0.5 font-display text-[8px] font-black tracking-widest"
          style={{ background: `${accent}22`, color: accent }}>
          {cur.name}
        </div>
      </div>
      <div className="mb-2 text-[9px] text-white/45">Rims + tire style for your bike. Preview spins exactly like in-game.</div>

      <div className="flex gap-3">
        <div className="shrink-0 rounded-xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent">
          <WheelCanvas style={cur.id} color={color} spinning />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {WHEEL_STYLES.map((w) => {
            const active = w.id === cur.id;
            return (
              <button key={w.id}
                onClick={() => { tapUi(); onStyle(w.id); }}
                className={`btn-neon flex items-center justify-between rounded-lg border px-2 py-1 text-left ${active ? "" : "border-white/10 bg-black/30"}`}
                style={active ? { borderColor: accent, background: `${accent}1c` } : undefined}>
                <span className="font-display text-[9px] font-black tracking-wider" style={{ color: active ? accent : "rgba(255,255,255,0.75)" }}>
                  {w.name}
                </span>
                <span className="ml-2 truncate text-[8px] text-white/40">{w.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-1 mt-2.5 font-display text-[9px] tracking-widest text-white/55">RIM COLOR</div>
      <div className="flex flex-wrap items-center gap-1.5">
        {WHEEL_COLORS.map((c) => (
          <button key={c} aria-label={"Rim color " + c}
            onClick={() => { tapUi(); onColor(c); }}
            className={`btn-neon h-6 w-6 rounded-full border-2 ${color === c ? "border-white" : "border-white/20"}`}
            style={{ background: c }} />
        ))}
        <span className="ml-1 font-display text-[8px] tracking-widest text-white/35">{color.toUpperCase()}</span>
      </div>
    </div>
  );
}
