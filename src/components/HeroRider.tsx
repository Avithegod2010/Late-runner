import { useEffect, useRef } from "react";
import { drawRiderBody } from "../game/rider";
import { TRAILS, getChoice } from "../game/garage";
import type { Settings } from "../game/engine";
import type { Theme } from "../game/themes";

interface Puff { x: number; y: number; vx: number; vy: number; life: number; size: number; }

/**
 * Home-screen centrepiece: the rider on a neon podium under a spotlight.
 * Tapping the bike revs it (horn + hop + exhaust burst).
 */
export default function HeroRider({ settings, theme, onPoke }: {
  settings: Settings;
  theme: Theme;
  onPoke: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ settings, theme, onPoke });
  live.current = { settings, theme, onPoke };
  const layout = useRef({ cx: 0, floorY: 0, u: 1 });
  const hop = useRef({ v: 0, h: 0, burst: 0 });

  useEffect(() => {
    const cv = canvasRef.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;
    const puffs: Puff[] = [];
    const sparkles = Array.from({ length: 18 }, () => ({
      a: Math.random() * Math.PI * 2, r: 0.6 + Math.random() * 0.6, p: Math.random() * 6,
    }));
    const start = performance.now();
    let last = start;

    const resize = () => {
      const rect = cv.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;
      const t = (now - start) / 1000;
      const { settings: s, theme: th } = live.current;
      const rm = s.reduceMotion;
      const trail = getChoice(TRAILS, s.trailId);

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const floorY = h * 0.8;
      const u = Math.max(0.6, Math.min((h * 0.52) / 140, (w * 0.4) / 70));
      layout.current = { cx, floorY, u };

      // ---- Home Garage customization ----
      // wall backdrop (poster behind the podium)
      if (s.garagePoster && s.garagePoster !== "none") {
        ctx.save();
        ctx.globalAlpha = 0.5;
        const pw = 150 * u;
        const ph = 90 * u;
        const px0 = cx - pw / 2;
        const py0 = floorY - 235 * u;
        ctx.fillStyle = "rgba(10,5,22,0.75)";
        ctx.fillRect(px0, py0, pw, ph);
        if (s.garagePoster === "city") {
          // skyline silhouette
          ctx.fillStyle = th.accent;
          for (let b = 0; b < 7; b++) {
            const bw = pw / 9;
            const bh = (18 + ((b * 37) % 44)) * u * 0.8;
            ctx.fillRect(px0 + b * (pw / 8) + 4, py0 + ph - bh, bw, bh);
          }
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.fillRect(px0, py0 + ph - 3 * u, pw, 1.4 * u);
        } else if (s.garagePoster === "race") {
          // chequer flags
          const cw = pw / 12;
          for (let r = 0; r < 6; r++) {
            for (let c = 0; c < 12; c++) {
              ctx.fillStyle = (r + c) % 2 === 0 ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.4)";
              ctx.fillRect(px0 + c * cw, py0 + r * (ph / 6), cw, ph / 6);
            }
          }
        } else {
          // retro sun
          const sun = ctx.createLinearGradient(0, py0, 0, py0 + ph);
          sun.addColorStop(0, "#f472b6");
          sun.addColorStop(1, "#fb923c");
          ctx.fillStyle = sun;
          ctx.beginPath();
          ctx.arc(cx, py0 + ph * 0.62, pw * 0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(10,5,22,0.9)";
          for (let i = 0; i < 3; i++) {
            ctx.fillRect(px0, py0 + ph * 0.5 + i * 9 * u, pw, 2.6 * u);
          }
        }
        ctx.restore();
      }

      // spotlight cone (colour follows the lighting choice)
      const lightTint: Record<string, string> = {
        spot: "255,255,255", neon: "103,232,249", sunset: "251,146,60", midnight: "129,140,248",
      };
      const tint = lightTint[s.garageLight] ?? "255,255,255";
      const beam = ctx.createLinearGradient(0, 0, 0, floorY);
      beam.addColorStop(0, "rgba(255,255,255,0)");
      beam.addColorStop(1, `rgba(${tint},${s.garageLight === "midnight" ? 0.06 : 0.12})`);
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(cx - 20 * u, 0);
      ctx.lineTo(cx + 20 * u, 0);
      ctx.lineTo(cx + 110 * u, floorY);
      ctx.lineTo(cx - 110 * u, floorY);
      ctx.closePath();
      ctx.fill();
      // neon bar rig
      if (s.garageLight === "neon") {
        ctx.strokeStyle = "rgba(103,232,249,0.85)";
        ctx.lineWidth = Math.max(2, 3 * u);
        ctx.shadowColor = "#22d3ee";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(cx - 80 * u, 10 * u);
        ctx.lineTo(cx + 80 * u, 10 * u);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // podium underglow
      const glow = ctx.createRadialGradient(cx, floorY, 4, cx, floorY, 150 * u);
      glow.addColorStop(0, th.accentSoft);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(cx - 150 * u, floorY - 150 * u, 300 * u, 300 * u);

      // podium body
      ctx.save();
      ctx.translate(cx, floorY);
      const podTint: Record<string, [string, string, string]> = {
        neon: ["#2a1a45", "#0b0618", "#1c1233"],
        chrome: ["#9aa7bd", "#3c4658", "#7c8aa5"],
        wood: ["#7c4a21", "#3f2410", "#8a5a2a"],
        marble: ["#e8e6ef", "#8f8ca3", "#d5d3e0"],
      };
      const [podTop, podBot, podFace] = podTint[s.garagePodium] ?? podTint.neon;
      const pod = ctx.createLinearGradient(0, -6 * u, 0, 26 * u);
      pod.addColorStop(0, podTop);
      pod.addColorStop(1, podBot);
      ctx.fillStyle = pod;
      ctx.beginPath();
      ctx.ellipse(0, 10 * u, 96 * u, 26 * u, 0, 0, Math.PI);
      ctx.lineTo(-96 * u, 0);
      ctx.ellipse(0, 0, 96 * u, 24 * u, 0, Math.PI, 0, true);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = podFace;
      ctx.beginPath();
      ctx.ellipse(0, 0, 96 * u, 24 * u, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowColor = th.accent;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = th.accent;
      ctx.lineWidth = Math.max(2, 2.4 * u);
      ctx.beginPath();
      ctx.ellipse(0, 0, 96 * u, 24 * u, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // rotating inner ring
      ctx.strokeStyle = `${th.edges[0]}aa`;
      ctx.lineWidth = Math.max(1.2, 1.4 * u);
      ctx.setLineDash([10 * u, 8 * u]);
      ctx.lineDashOffset = rm ? 0 : -t * 30 * u;
      ctx.beginPath();
      ctx.ellipse(0, 0, 72 * u, 17 * u, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // hop physics (tap to rev)
      const hp = hop.current;
      if (hp.h > 0 || hp.v > 0) {
        hp.v -= 9 * dt;
        hp.h = Math.max(0, hp.h + hp.v * dt);
        if (hp.h === 0) hp.v = 0;
      }

      // exhaust puffs (bigger burst after a rev)
      const emit = rm ? 0.12 : hp.burst > 0 ? 1 : 0.4;
      if (Math.random() < emit) {
        for (let i = 0; i < (hp.burst > 0 ? 3 : 1); i++) {
          puffs.push({
            x: cx + (Math.random() - 0.5) * 12 * u,
            y: floorY - 8 * u - hp.h * 60 * u,
            vx: (Math.random() - 0.5) * 30 * u,
            vy: -(10 + Math.random() * 25) * u,
            life: 1,
            size: (2 + Math.random() * 4) * u,
          });
        }
      }
      if (hp.burst > 0) hp.burst -= dt;
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i];
        p.life -= dt * 1.1;
        if (p.life <= 0) { puffs.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        ctx.globalAlpha = p.life * 0.6;
        ctx.fillStyle = p.life > 0.5 ? trail.colors[0] : trail.colors[1];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.6 - p.life * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // contact shadow shrinks while hopping
      const shrink = 1 - Math.min(hp.h, 0.6);
      ctx.fillStyle = `rgba(0,0,0,${0.5 * shrink})`;
      ctx.beginPath();
      ctx.ellipse(cx, floorY + 2 * u, 40 * u * shrink, 9 * u * shrink, 0, 0, Math.PI * 2);
      ctx.fill();

      // the rider
      const bob = rm ? 0 : Math.sin(t * 2.4) * 1.6 * u;
      const sway = rm ? 0 : Math.sin(t * 0.8) * 0.06;
      ctx.save();
      ctx.translate(cx, floorY + bob - hp.h * 60 * u);
      ctx.rotate(sway - hp.h * 0.12);
      drawRiderBody(ctx, u, s, "ride", t * 7);

      // custom number plate on the rear fender
      const plate = (s.plateText || "RIDER").slice(0, 7);
      ctx.fillStyle = "#fef9c3";
      ctx.strokeStyle = "#1b1726";
      ctx.lineWidth = Math.max(1, 0.8 * u);
      ctx.fillRect(-12 * u, -37 * u, 24 * u, 7.5 * u);
      ctx.strokeRect(-12 * u, -37 * u, 24 * u, 7.5 * u);
      ctx.fillStyle = "#1b1726";
      ctx.font = `900 ${Math.max(6, 5.2 * u)}px Orbitron, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(plate, 0, -33.2 * u);
      ctx.restore();

      // twinkling sparkles orbiting the podium
      if (!rm) {
        for (const sp of sparkles) {
          sp.a += dt * 0.35;
          sp.p += dt * 3;
          const sx = cx + Math.cos(sp.a) * 110 * u * sp.r;
          const sy = floorY - 70 * u + Math.sin(sp.a) * 60 * u * sp.r;
          const a = 0.25 + 0.6 * Math.max(0, Math.sin(sp.p));
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ctx.beginPath();
          ctx.moveTo(sx, sy - 3);
          ctx.lineTo(sx + 1, sy - 1);
          ctx.lineTo(sx + 3, sy);
          ctx.lineTo(sx + 1, sy + 1);
          ctx.lineTo(sx, sy + 3);
          ctx.lineTo(sx - 1, sy + 1);
          ctx.lineTo(sx - 3, sy);
          ctx.lineTo(sx - 1, sy - 1);
          ctx.closePath();
          ctx.fill();
        }
      }

      // trophy shelf: a small cup on a riser beside the podium
      if (s.garageTrophy && s.garageTrophy !== "none") {
        const trophyCol: Record<string, string> = { bronze: "#b45309", silver: "#cbd5e1", gold: "#fbbf24" };
        const tc = trophyCol[s.garageTrophy] ?? "#fbbf24";
        const tx = cx + 96 * u * 0.92;
        const ty = floorY + 6 * u;
        ctx.save();
        ctx.translate(tx, ty);
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.beginPath();
        ctx.ellipse(0, 12 * u, 16 * u, 3.4 * u, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#241635";
        ctx.fillRect(-13 * u, 4 * u, 26 * u, 5 * u);
        ctx.fillStyle = tc;
        ctx.shadowColor = tc;
        ctx.shadowBlur = 8;
        // cup bowl
        ctx.beginPath();
        ctx.moveTo(-7 * u, -16 * u);
        ctx.lineTo(7 * u, -16 * u);
        ctx.quadraticCurveTo(6 * u, -4 * u, 0, -3 * u);
        ctx.quadraticCurveTo(-6 * u, -4 * u, -7 * u, -16 * u);
        ctx.closePath();
        ctx.fill();
        // handles
        ctx.strokeStyle = tc;
        ctx.lineWidth = Math.max(1, 1.6 * u);
        ctx.beginPath(); ctx.arc(-8.5 * u, -12 * u, 3.2 * u, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke();
        ctx.beginPath(); ctx.arc(8.5 * u, -12 * u, 3.2 * u, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
        // stem + base
        ctx.fillRect(-1.6 * u, -3.4 * u, 3.2 * u, 5.4 * u);
        ctx.fillRect(-5 * u, 1.8 * u, 10 * u, 2.2 * u);
        ctx.restore();
      }

      ctx.restore();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { cx, floorY, u } = layout.current;
    const onBike = Math.abs(x - cx) < 60 * u && y > floorY - 160 * u && y < floorY + 30 * u;
    if (!onBike) return;
    if (hop.current.h <= 0.01) hop.current.v = 2.6;
    hop.current.burst = 0.5;
    live.current.onPoke();
  };

  return <canvas ref={canvasRef} onClick={handleClick} className="absolute inset-0 block h-full w-full" />;
}
