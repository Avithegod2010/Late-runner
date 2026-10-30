import { useEffect, useRef } from "react";
import type { Theme } from "../game/themes";

/**
 * Mini world preview for the Worlds panel: renders a stylized scene from a
 * Theme — sky gradient, celestial body, stars, ground band and a perspective
 * road with the world's edge stripes and lane dashes. Pure canvas, no engine.
 */
export default function ThemePreview({ theme }: { theme: Theme }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = cv.clientWidth || 320;
    const H = cv.clientHeight || 96;
    cv.width = Math.max(1, Math.round(W * dpr));
    cv.height = Math.max(1, Math.round(H * dpr));
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const horizon = H * 0.5;

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    for (const [stop, color] of theme.sky) {
      sky.addColorStop(Math.max(0, Math.min(1, stop)), color);
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, horizon);

    // stars (deterministic scatter so the preview never flickers)
    if (theme.stars > 0) {
      let seed = 7;
      const rnd = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      ctx.fillStyle = "#ffffff";
      const count = Math.min(theme.stars, 42);
      for (let i = 0; i < count; i++) {
        const x = rnd() * W;
        const y = rnd() * horizon * 0.85;
        const r = 0.5 + rnd() * 0.9;
        ctx.globalAlpha = 0.25 + rnd() * 0.55;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // celestial body with glow
    if (theme.celestial !== "none") {
      const [c0, c1] = theme.celestialColors;
      const cx = W * 0.72;
      const cy = horizon * 0.55;
      const r = H * 0.17;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.6);
      glow.addColorStop(0, theme.celestialGlow);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(cx - r * 2.6, cy - r * 2.6, r * 5.2, r * 5.2);
      const body = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
      body.addColorStop(0, c0);
      body.addColorStop(1, c1);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // ground band
    const ground = ctx.createLinearGradient(0, horizon, 0, H);
    ground.addColorStop(0, theme.ground[0]);
    ground.addColorStop(1, theme.ground[1]);
    ctx.fillStyle = ground;
    ctx.fillRect(0, horizon, W, H - horizon);

    // perspective road
    const cx = W * 0.5;
    const roadTopHalf = W * 0.05;
    const roadBotHalf = W * 0.28;
    ctx.fillStyle = theme.road;
    ctx.beginPath();
    ctx.moveTo(cx - roadTopHalf, horizon);
    ctx.lineTo(cx + roadTopHalf, horizon);
    ctx.lineTo(cx + roadBotHalf, H);
    ctx.lineTo(cx - roadBotHalf, H);
    ctx.closePath();
    ctx.fill();

    // horizon glow line
    ctx.strokeStyle = theme.horizon;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    ctx.lineTo(W, horizon);
    ctx.stroke();

    // edge stripes
    const stripe = (x1: number, x2: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, horizon + 1);
      ctx.lineTo(x2, H);
      ctx.stroke();
    };
    stripe(cx - roadTopHalf * 0.9, cx - roadBotHalf * 0.92, theme.edges[0]);
    stripe(cx + roadTopHalf * 0.9, cx + roadBotHalf * 0.92, theme.edges[1]);

    // center dashes
    ctx.strokeStyle = theme.dash;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 7]);
    ctx.beginPath();
    ctx.moveTo(cx, horizon + 3);
    ctx.lineTo(cx, H);
    ctx.stroke();
    ctx.setLineDash([]);

    // frame
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  }, [theme]);

  return <canvas ref={ref} aria-label={"World preview: " + theme.name} className="block h-24 w-full" />;
}
