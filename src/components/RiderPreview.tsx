import { useEffect, useRef } from "react";
import { drawRiderBody, type Pose } from "../game/rider";
import { TRAILS, getChoice, type BikeId, type HelmetId, type JacketId, type TrailId } from "../game/garage";
import type { Theme } from "../game/themes";
import { CameraIcon } from "./Icons";
import { downloadBlob } from "../game/scorecard";

interface Props {
  bikeId: BikeId;
  helmetId: HelmetId;
  jacketId: JacketId;
  trailId: TrailId;
  theme: Theme;
  height?: number;
  photo?: boolean;
  pose?: Pose;
  /** photo-mode filter studio id */
  photoFilter?: PhotoFilterId;
  /** emoji stickers pinned to the shot */
  stickers?: string[];
  /** pass-through look fields so photo mode shows the real build */
  decal?: string;
  customDecal?: number[] | null;
  plateText?: string;
}

export type PhotoFilterId = "none" | "crt" | "vhs" | "chroma" | "tilt" | "warm" | "noir";

interface Puff { x: number; y: number; vx: number; vy: number; life: number; size: number; }

/** Live turntable preview of the rider build; photo mode adds a scene + capture. */
export default function RiderPreview({
  bikeId, helmetId, jacketId, trailId, theme, height = 190, photo = false, pose = "ride",
  photoFilter = "none", stickers = [], decal, customDecal, plateText,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const look = useRef({ bikeId, helmetId, jacketId, trailId, theme, photo, pose, photoFilter, stickers, decal, customDecal, plateText });
  look.current = { bikeId, helmetId, jacketId, trailId, theme, photo, pose, photoFilter, stickers, decal, customDecal, plateText };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;
    const puffs: Puff[] = [];
    const start = performance.now();
    let last = start;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;
      const t = (now - start) / 1000;
      const cur = look.current;
      const th = cur.theme;
      const trail = getChoice(TRAILS, cur.trailId);

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      // ---- Photo Mode Filter Studio ----
      const pf = cur.photoFilter;
      if (pf === "crt") ctx.filter = "contrast(1.18) saturate(1.3) brightness(1.04)";
      else if (pf === "vhs") ctx.filter = "saturate(1.35) contrast(1.08) blur(0.4px)";
      else if (pf === "warm") ctx.filter = "sepia(0.24) saturate(1.35) hue-rotate(-12deg) brightness(1.05)";
      else if (pf === "noir") ctx.filter = "grayscale(1) contrast(1.3)";
      else if (pf === "tilt") ctx.filter = "saturate(1.12) contrast(1.06)";

      if (cur.photo) {
        // full themed backdrop for screenshots
        const sky = ctx.createLinearGradient(0, 0, 0, h);
        for (const [o, c] of th.sky) sky.addColorStop(o, c);
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h * 0.62);
        const gr = ctx.createLinearGradient(0, h * 0.62, 0, h);
        gr.addColorStop(0, th.ground[0]);
        gr.addColorStop(1, th.ground[1]);
        ctx.fillStyle = gr;
        ctx.fillRect(0, h * 0.62, w, h * 0.38);
        // sun + horizon line
        const sunR = Math.min(w, 420) * 0.17;
        const sunX = w / 2 + Math.sin(t * 0.25) * w * 0.12;
        const sg = ctx.createLinearGradient(0, h * 0.62 - sunR, 0, h * 0.62 + sunR);
        sg.addColorStop(0, th.celestialColors[0]);
        sg.addColorStop(1, th.celestialColors[1]);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, w, h * 0.62);
        ctx.clip();
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.arc(sunX, h * 0.62 - sunR * 0.25, sunR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = th.horizon;
        ctx.fillRect(0, h * 0.62 - 1, w, 2);
        // road wedge
        ctx.fillStyle = th.road;
        ctx.beginPath();
        ctx.moveTo(w * 0.34, h * 0.62);
        ctx.lineTo(w * 0.66, h * 0.62);
        ctx.lineTo(w * 1.12, h);
        ctx.lineTo(-w * 0.12, h);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = th.edges[1];
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(w * 0.5, h * 0.62);
        ctx.lineTo(w * 0.5, h);
        ctx.setLineDash([12, 14]);
        ctx.lineDashOffset = -t * 90;
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        const bg = ctx.createRadialGradient(w / 2, h * 0.58, 8, w / 2, h * 0.58, h * 0.95);
        bg.addColorStop(0, th.accentSoft);
        bg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);
      }

      const discY = cur.photo ? h * 0.9 : h * 0.84;

      // turntable ring
      ctx.save();
      ctx.translate(w / 2, discY);
      ctx.scale(1, 0.24);
      const disc = ctx.createRadialGradient(0, 0, 4, 0, 0, h * 0.42);
      disc.addColorStop(0, `${th.accent}55`);
      disc.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = disc;
      ctx.beginPath();
      ctx.arc(0, 0, h * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `${th.accent}70`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, h * 0.34, t * 0.6, t * 0.6 + Math.PI * 1.35);
      ctx.stroke();
      ctx.restore();

      // trail particles
      if (Math.random() < 0.5) {
        puffs.push({
          x: w / 2 + (Math.random() - 0.5) * 14,
          y: discY - 6,
          vx: (Math.random() - 0.5) * 26,
          vy: -18 - Math.random() * 26,
          life: 1,
          size: 2 + Math.random() * 4,
        });
      }
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i];
        p.life -= dt * 1.5;
        if (p.life <= 0) { puffs.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        ctx.globalAlpha = Math.max(p.life, 0) * 0.7;
        ctx.fillStyle = p.life > 0.5 ? trail.colors[0] : trail.colors[1];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.fillStyle = "rgba(0,0,0,0.42)";
      ctx.beginPath();
      ctx.ellipse(w / 2, discY, 44, 9, 0, 0, Math.PI * 2);
      ctx.fill();

      // rider — photo mode does a slow orbit, garage mode a gentle sway
      const u = (h / 210) * (cur.photo ? 1.25 : 1.06);
      const bob = Math.sin(t * 2.2) * 2.2;
      const orbit = cur.photo ? Math.sin(t * 0.5) : 0;
      const sway = cur.photo ? orbit * 0.22 : Math.sin(t * 0.85) * 0.12;
      ctx.save();
      ctx.translate(w / 2 + orbit * 16, discY + bob);
      ctx.rotate(sway);
      ctx.scale(1 - Math.abs(orbit) * 0.1, 1);
      drawRiderBody(ctx, u, {
        bikeId: cur.bikeId,
        helmetId: cur.helmetId,
        jacketId: cur.jacketId,
        decal: cur.decal,
        customDecal: cur.customDecal,
        plateText: cur.plateText,
      }, cur.pose, t * 6);
      ctx.restore();

      // stickers pinned to the shot
      if (cur.photo && cur.stickers.length) {
        ctx.font = "22px sans-serif";
        ctx.textAlign = "center";
        cur.stickers.forEach((st, i) => {
          const sx = w * (0.16 + 0.68 * ((i * 0.37) % 1));
          const sy = h * (0.2 + 0.24 * ((i * 0.61) % 1)) + Math.sin(t * 1.4 + i) * 3;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(Math.sin(t * 0.9 + i * 1.7) * 0.16);
          ctx.fillText(st, 0, 0);
          ctx.restore();
        });
      }

      // per-filter overlays (after the scene)
      if (cur.photo && pf === "crt") {
        ctx.filter = "none";
        ctx.fillStyle = "rgba(0,0,0,0.16)";
        for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1.2);
      }
      if (cur.photo && pf === "vhs") {
        ctx.filter = "none";
        const by = (t * 90) % (h + 40) - 20;
        const bg2 = ctx.createLinearGradient(0, by - 12, 0, by + 12);
        bg2.addColorStop(0, "rgba(255,255,255,0)");
        bg2.addColorStop(0.5, "rgba(255,255,255,0.14)");
        bg2.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = bg2;
        ctx.fillRect(0, by - 12, w, 24);
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        for (let i = 0; i < 24; i++) {
          ctx.fillRect(Math.random() * w, Math.random() * h, 14 + Math.random() * 30, 1);
        }
      }
      if (cur.photo && pf === "chroma") {
        ctx.filter = "none";
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.14;
        ctx.drawImage(ctx.canvas, 2.2, 0, w, h);
        ctx.drawImage(ctx.canvas, -2.2, 0.6, w, h);
        ctx.restore();
      }
      if (cur.photo && pf === "tilt") {
        ctx.filter = "none";
        for (const band of [[0, 0, w, h * 0.22], [0, h * 0.78, w, h * 0.22]] as const) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(band[0], band[1], band[2], band[3]);
          ctx.clip();
          ctx.filter = "blur(2.4px)";
          ctx.drawImage(ctx.canvas, 0, 0, w, h);
          ctx.restore();
        }
      }
      ctx.filter = "none";

      ctx.restore();
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const snap = () => {
    const c = canvasRef.current;
    if (!c) return;
    c.toBlob((b) => {
      if (b) downloadBlob(b, "wrong-way-rider-garage.png");
    }, "image/png");
  };

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-white/12 bg-black/45"
      style={{ height }}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
      <span className="pointer-events-none absolute left-3 top-2.5 font-display text-[9px] font-bold tracking-[0.3em] text-white/45">
        {photo ? "PHOTO MODE" : "LIVE PREVIEW"}
      </span>
      {photo && (
        <button
          onClick={snap}
          className="btn-neon absolute bottom-3 right-3 flex items-center gap-1.5 rounded-xl bg-black/60 px-3 py-2 font-display text-[10px] font-bold tracking-widest text-white backdrop-blur-sm"
        >
          <CameraIcon size={16} /> SNAP
        </button>
      )}
    </div>
  );
}
