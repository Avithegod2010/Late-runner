import { useEffect, useRef, useState } from "react";
import { drawRiderBody } from "../game/rider";
import { sfx } from "../game/audio";
import type { Theme } from "../game/themes";
import type { BikeId, HelmetId, JacketId } from "../game/garage";
import { CheckIcon, JumpIcon, NitroIcon, StuntIcon, SwipeIcon, WarningIcon } from "./Icons";

interface Props {
  isTouch: boolean;
  accent: string;
  theme: Theme;
  riderLook: { bikeId: BikeId; helmetId: HelmetId; jacketId: JacketId };
  onFinish: (stepReached: number, skipped: boolean) => void;
}

export default function InteractiveTutorial({ isTouch, accent, theme, riderLook, onFinish }: Props) {
  const [step, setStep] = useState(0);
  const [lane, setLane] = useState(0);
  const [triedSteer, setTriedSteer] = useState(false);
  const [triedJump, setTriedJump] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const laneRef = useRef(0);
  const jumpVelRef = useRef(0);
  const jumpHRef = useRef(0);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  laneRef.current = lane;

  const triggerMove = (dir: number) => {
    setLane((prev) => {
      const next = Math.max(-1, Math.min(1, prev + dir));
      if (next !== prev) {
        sfx.unlock();
        sfx.swoosh();
        setTriedSteer(true);
      }
      return next;
    });
  };

  const triggerJump = () => {
    if (jumpHRef.current > 0.02) return;
    jumpVelRef.current = 3.2;
    jumpHRef.current = 0.01;
    sfx.unlock();
    sfx.jump();
    setTriedJump(true);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === "ArrowLeft" || k === "a" || k === "A") {
        e.preventDefault();
        triggerMove(-1);
      } else if (k === "ArrowRight" || k === "d" || k === "D") {
        e.preventDefault();
        triggerMove(1);
      } else if (k === "ArrowUp" || k === "w" || k === "W" || k === " ") {
        e.preventDefault();
        triggerJump();
      } else if (k === "Enter") {
        e.preventDefault();
        if (step < 4) setStep((s) => s + 1);
        else onFinish(step, false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, onFinish]);

  useEffect(() => {
    const cv = canvasRef.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;

    let raf = 0;
    let px = 0;
    let tilt = 0;
    let t = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t += dt;

      const rect = cv.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(220, rect.width);
      const h = Math.max(120, rect.height);
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
      }

      px += (laneRef.current - px) * Math.min(1, dt * 13);
      tilt += ((laneRef.current - px) * 0.65 - tilt) * Math.min(1, dt * 10);

      if (jumpHRef.current > 0 || jumpVelRef.current > 0) {
        jumpVelRef.current -= 8.8 * dt;
        jumpHRef.current = Math.max(0, jumpHRef.current + jumpVelRef.current * dt);
        if (jumpHRef.current === 0) jumpVelRef.current = 0;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      const hy = h * 0.34;
      const sky = ctx.createLinearGradient(0, 0, 0, hy);
      sky.addColorStop(0, theme.sky[0][1]);
      sky.addColorStop(1, theme.sky[theme.sky.length - 1][1]);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, hy);

      ctx.fillStyle = theme.ground[0];
      ctx.fillRect(0, hy, w, h - hy);

      ctx.fillStyle = theme.road;
      ctx.beginPath();
      ctx.moveTo(w * 0.33, hy);
      ctx.lineTo(w * 0.67, hy);
      ctx.lineTo(w * 0.94, h);
      ctx.lineTo(w * 0.06, h);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(w * 0.33, hy);
      ctx.lineTo(w * 0.06, h);
      ctx.moveTo(w * 0.67, hy);
      ctx.lineTo(w * 0.94, h);
      ctx.stroke();

      ctx.strokeStyle = "rgba(255,255,255,0.65)";
      ctx.lineWidth = 1.6;
      ctx.setLineDash([8, 9]);
      ctx.lineDashOffset = -t * 110;
      for (const div of [-0.5, 0.5]) {
        ctx.beginPath();
        ctx.moveTo(w / 2 + div * w * 0.11, hy);
        ctx.lineTo(w / 2 + div * w * 0.29, h);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Demo cone on step 1 so jumping over something feels tangible
      if (step === 1) {
        const p = (t * 0.55) % 1;
        const cy = hy + p * (h - hy);
        const cx = w / 2;
        const r = 4 + p * 12;
        ctx.fillStyle = "#ff7a18";
        ctx.beginPath();
        ctx.moveTo(cx, cy - r * 1.4);
        ctx.lineTo(cx - r * 0.7, cy);
        ctx.lineTo(cx + r * 0.7, cy);
        ctx.closePath();
        ctx.fill();
      }

      // Demo heavy truck in right lane on step 2 with NO-JUMP marker
      if (step === 2) {
        const p = 0.62 + Math.sin(t * 1.8) * 0.04;
        const cy = hy + p * (h - hy);
        const cx = w / 2 + 1 * w * (0.1 + p * 0.18);
        ctx.fillStyle = "#94a3b8";
        ctx.fillRect(cx - 18, cy - 38, 36, 36);
        ctx.fillStyle = "#ef4444";
        ctx.font = "900 9px Orbitron, monospace";
        ctx.textAlign = "center";
        ctx.fillText("DODGE!", cx, cy - 43);
      }

      const rx = w / 2 + px * w * 0.27;
      const ry = h * 0.92 - jumpHRef.current * 44;
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath();
      ctx.ellipse(rx, h * 0.93, 20, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(tilt);
      drawRiderBody(ctx, 0.42, riderLook, "ride", t * 10);
      ctx.restore();

      ctx.restore();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [step, accent, theme, riderLook]);

  const steps = [
    {
      icon: <SwipeIcon size={40} />,
      title: "TRY STEERING",
      body: isTouch
        ? "Swipe left or right on the mini track below (or tap either side) to switch lanes!"
        : "Press A / D or ← / → right now to switch lanes on the live track below!",
      done: triedSteer,
      glyphs: isTouch ? ["⟵ SWIPE LEFT", "SWIPE RIGHT ⟶"] : ["[ A ] / [ ← ]", "[ D ] / [ → ]"],
    },
    {
      icon: <JumpIcon size={40} />,
      title: "TRY JUMPING",
      body: isTouch
        ? "Swipe UP on the mini track below to hop hazards & low cars! Swipe DOWN to slam fast."
        : "Press W, ↑, or SPACE right now to jump! Press S / ↓ in mid-air to slam down fast.",
      done: triedJump,
      glyphs: isTouch ? ["↑ SWIPE UP · JUMP", "↓ SWIPE DOWN · SLAM"] : ["[ W ] / [ SPACE ]", "[ S ] / [ ↓ ] SLAM"],
    },
    {
      icon: <WarningIcon size={40} />,
      title: "TRUCKS & BUSES = WALLS",
      body: "Sedans, sports cars, vans & police cruisers CAN be jumped — heavy Trucks and Buses can NEVER be jumped. Switch lanes!",
      done: true,
      glyphs: ["CARS: JUMP OR DODGE", "TRUCKS & BUSES: DODGE ONLY"],
    },
    {
      icon: <StuntIcon size={40} />,
      title: "STUNTS & COMBO BANK",
      body: isTouch
        ? "Swipe in mid-air to pull tricks. Tap BANK ×N on the HUD to lock your combo and cash it in on your next near-miss!"
        : "Steer in mid-air (or press F) for tricks. Press B or E to bank your live combo and cash it in on the next near-miss!",
      done: true,
      glyphs: isTouch ? ["AIR SWIPE · STUNT", "TAP BANK · SAVE COMBO"] : ["[ F ] BACKFLIP", "[ B ] BANK COMBO"],
    },
    {
      icon: <NitroIcon size={40} />,
      title: "POWER-UPS & SURFACES",
      body: "Grab Nitro to smash cars sky-high, Shields to survive a hit, Magnets for coins, and watch for oil & gravel patches!",
      done: true,
      glyphs: ["NITRO · MAGNET · SHIELD", "BULLET TIME"],
    },
  ];

  const cur = steps[step];

  return (
    <div className="fade-in absolute inset-0 z-40 flex items-center justify-center bg-[#05020d]/93 p-4 backdrop-blur-lg">
      <div className="pop-in flex w-full max-w-sm flex-col items-center rounded-3xl border border-white/12 bg-[#0d0620]/95 p-5 text-center shadow-[0_24px_80px_rgba(0,0,0,0.75)]">
        <span style={{ color: accent }}>{cur.icon}</span>
        <h3 className="font-display mt-2 text-xl font-black tracking-widest text-white">{cur.title}</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-white/75">{cur.body}</p>

        {/* Authentic device-matched input glyphs */}
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {cur.glyphs.map((g) => (
            <span
              key={g}
              className="rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 font-display text-[9px] font-bold tracking-wider text-cyan-200 shadow-inner"
            >
              {g}
            </span>
          ))}
        </div>

        {/* Interactive 3-lane Try-It Playground */}
        <div
          className="relative mt-3 h-32 w-full touch-none overflow-hidden rounded-2xl border border-white/15 bg-black/50"
          onTouchStart={(e) => {
            const t = e.touches[0];
            touchRef.current = { x: t.clientX, y: t.clientY };
          }}
          onTouchMove={(e) => {
            if (!touchRef.current) return;
            const t = e.touches[0];
            const dx = t.clientX - touchRef.current.x;
            const dy = t.clientY - touchRef.current.y;
            if (dy < -32 && Math.abs(dy) > Math.abs(dx)) {
              triggerJump();
              touchRef.current = { x: t.clientX, y: t.clientY };
            } else if (Math.abs(dx) > 34) {
              triggerMove(dx > 0 ? 1 : -1);
              touchRef.current = { x: t.clientX, y: t.clientY };
            }
          }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = (e.clientX - rect.left) / rect.width;
            const relY = (e.clientY - rect.top) / rect.height;
            if (relY < 0.42) triggerJump();
            else triggerMove(relX > 0.5 ? 1 : -1);
          }}
        >
          <canvas ref={canvasRef} className="block h-full w-full" />
          <div className="pointer-events-none absolute inset-x-2.5 top-2 flex items-center justify-between">
            <span className="rounded bg-black/60 px-2 py-0.5 font-display text-[8px] font-bold tracking-widest text-white/75">
              TRY IT LIVE
            </span>
            {step <= 1 && cur.done && (
              <span className="flex items-center gap-1 rounded bg-emerald-500/25 px-2 py-0.5 font-display text-[8px] font-black text-emerald-300 ring-1 ring-emerald-400/50">
                <CheckIcon size={10} /> NICE MOVE!
              </span>
            )}
          </div>
          <div className="pointer-events-none absolute inset-x-3 bottom-1.5 flex justify-between font-display text-[7px] text-white/40">
            <span>TAP LEFT</span>
            <span>TAP TOP = JUMP</span>
            <span>TAP RIGHT</span>
          </div>
        </div>

        <div className="mt-3.5 flex gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className="h-1.5 w-6 rounded-full transition-colors"
              style={{ background: i === step ? accent : "rgba(255,255,255,0.2)" }}
            />
          ))}
        </div>

        <button
          onClick={() => {
            sfx.unlock();
            sfx.ui();
            if (step < steps.length - 1) setStep(step + 1);
            else onFinish(step, false);
          }}
          className="btn-neon mt-4 w-full rounded-2xl py-3.5 font-display text-base font-black tracking-widest text-white"
          style={{ background: `linear-gradient(180deg, ${theme.swatch[0]}, ${theme.swatch[1]})` }}
        >
          {step < steps.length - 1 ? "NEXT" : "LET'S RIDE"}
        </button>
        <button
          onClick={() => {
            sfx.unlock();
            sfx.ui();
            onFinish(step, true);
          }}
          className="mt-2 font-display text-[10px] font-bold tracking-widest text-white/45"
        >
          SKIP TUTORIAL
        </button>
      </div>
    </div>
  );
}
