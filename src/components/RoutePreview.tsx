import { useEffect, useRef, useState } from "react";
import type { ModifierId, RouteConfig } from "../game/features";
import type { Theme, Weather } from "../game/themes";
import { mulberry32 } from "../game/rng";
import { drawRiderBody } from "../game/rider";
import type { BikeId, HelmetId, JacketId } from "../game/garage";
import { PlayIcon } from "./Icons";

function weatherPalette(weather: Weather): { skyA: string; skyB: string; edge: string; particle: string } {
  switch (weather) {
    case "rain":
      return { skyA: "#061024", skyB: "#254e7b", edge: "#38bdf8", particle: "rgba(170,215,255,0.75)" };
    case "snow":
      return { skyA: "#1e3a5f", skyB: "#bfe0f5", edge: "#7dd3fc", particle: "rgba(255,255,255,0.9)" };
    case "sand":
      return { skyA: "#3b1750", skyB: "#f59e0b", edge: "#fb923c", particle: "rgba(255,214,150,0.65)" };
    case "petals":
      return { skyA: "#1c0c33", skyB: "#ec6fa9", edge: "#f9a8d4", particle: "#ffb7d5" };
    case "fireflies":
      return { skyA: "#0b0724", skyB: "#5b2a82", edge: "#fde047", particle: "rgba(253,224,71,0.85)" };
    case "ash":
      return { skyA: "#03150e", skyB: "#10b981", edge: "#a3e635", particle: "rgba(163,230,53,0.75)" };
    default:
      return { skyA: "#140a2e", skyB: "#ff5e62", edge: "#ff4da6", particle: "rgba(255,255,255,0)" };
  }
}

/** Tiny live animated canvas thumbnail for each Route Lab preset card. */
export function RouteThumbnail({ route }: { route: RouteConfig }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;

    const W = 128;
    const H = 56;
    cv.width = W * 2;
    cv.height = H * 2;

    const rnd = mulberry32(route.seed || 1);
    const blips = Array.from({ length: Math.max(2, Math.round(4 * route.traffic)) }, () => ({
      lane: Math.floor(rnd() * 3) - 1,
      z: rnd(),
      col: ["#ff4757", "#38bdf8", "#fbbf24", "#4ade80"][Math.floor(rnd() * 4)],
    }));

    let raf = 0;
    const draw = (now: number) => {
      const t = now / 1000;
      const pal = weatherPalette(route.weather);
      ctx.save();
      ctx.scale(2, 2);

      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.45);
      sky.addColorStop(0, pal.skyA);
      sky.addColorStop(1, pal.skyB);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H * 0.45);

      ctx.fillStyle = "#140c24";
      ctx.fillRect(0, H * 0.45, W, H * 0.55);

      // perspective road
      ctx.fillStyle = "#221936";
      ctx.beginPath();
      ctx.moveTo(W * 0.36, H * 0.45);
      ctx.lineTo(W * 0.64, H * 0.45);
      ctx.lineTo(W * 0.94, H);
      ctx.lineTo(W * 0.06, H);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = pal.edge;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(W * 0.36, H * 0.45);
      ctx.lineTo(W * 0.06, H);
      ctx.moveTo(W * 0.64, H * 0.45);
      ctx.lineTo(W * 0.94, H);
      ctx.stroke();

      // moving lane dashes
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 5]);
      ctx.lineDashOffset = -t * 28;
      for (const lx of [-0.5, 0.5]) {
        ctx.beginPath();
        ctx.moveTo(W / 2 + lx * W * 0.09, H * 0.45);
        ctx.lineTo(W / 2 + lx * W * 0.28, H);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // seeded traffic blips
      for (const b of blips) {
        const prog = ((b.z + t * 0.45 * route.traffic) % 1);
        const y = H * 0.46 + prog * H * 0.52;
        const spread = W * (0.09 + prog * 0.19);
        const x = W / 2 + b.lane * spread;
        const sz = 2 + prog * 5;
        ctx.fillStyle = b.col;
        ctx.fillRect(x - sz / 2, y - sz * 0.7, sz, sz * 0.7);
      }

      // weather particles
      if (route.weather !== "none") {
        ctx.fillStyle = pal.particle;
        for (let i = 0; i < 14; i++) {
          const wx = ((i * 29 + t * (route.weather === "sand" ? 70 : 16)) % W);
          const wy = ((i * 17 + t * (route.weather === "rain" ? 95 : 28)) % H);
          ctx.fillRect(wx, wy, route.weather === "rain" ? 1 : 2, route.weather === "rain" ? 5 : 2);
        }
      }

      ctx.restore();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [route.seed, route.traffic, route.hazards, route.weather]);

  return (
    <canvas
      ref={ref}
      className="mb-1.5 block h-14 w-full rounded-lg border border-white/10"
    />
  );
}

/** Interactive 4-second live preview ride for the active Route Lab setup. */
export function RouteLivePreview({
  route,
  traffic,
  hazards,
  modifiers,
  theme,
  riderLook,
}: {
  route: RouteConfig;
  traffic: number;
  hazards: number;
  modifiers: ModifierId[];
  theme: Theme;
  riderLook: { bikeId: BikeId; helmetId: HelmetId; jacketId: JacketId };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [testTimeLeft, setTestTimeLeft] = useState(0);
  const stateRef = useRef({ route, traffic, hazards, modifiers, theme, riderLook, testTimeLeft });
  stateRef.current = { route, traffic, hazards, modifiers, theme, riderLook, testTimeLeft };

  useEffect(() => {
    if (testTimeLeft <= 0) return;
    const id = window.setInterval(() => {
      setTestTimeLeft((prev) => {
        const next = +(prev - 0.1).toFixed(1);
        return next <= 0 ? 0 : next;
      });
    }, 100);
    return () => clearInterval(id);
  }, [testTimeLeft]);

  useEffect(() => {
    const cv = canvasRef.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;

    let raf = 0;
    let simT = 0;
    let riderX = 0;
    let jumpH = 0;
    let jumpV = 0;
    let last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const cur = stateRef.current;
      const boosting = cur.testTimeLeft > 0;
      const speedMul = (boosting ? 1.85 : 0.75) * (cur.modifiers.includes("speed-demons") ? 1.25 : 1);
      simT += dt * speedMul;

      const rect = cv.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(200, rect.width);
      const h = Math.max(120, rect.height);
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
      }

      const rnd = mulberry32(cur.route.seed || 1);
      const carCount = Math.max(3, Math.round(6 * cur.traffic));
      const cars = Array.from({ length: carCount }, (_, idx) => ({
        lane: Math.floor(rnd() * 3) - 1,
        offset: idx / carCount + rnd() * 0.08,
        col: ["#ff4757", "#38bdf8", "#fbbf24", "#2ed573", "#c084fc"][Math.floor(rnd() * 5)],
      }));
      const hzCount = Math.max(1, Math.round(3 * cur.hazards));
      const hzs = Array.from({ length: hzCount }, (_, idx) => ({
        lane: Math.floor(rnd() * 3) - 1,
        offset: (idx + 0.5) / hzCount,
      }));

      // Auto-pilot dodges incoming seeded traffic & hops hazards during the preview ride!
      const closedLane = cur.modifiers.includes("closed-lane") ? 1 : -99;
      let safeLane = 0;
      let bestScore = -1e9;
      for (const l of [-1, 0, 1]) {
        if (l === closedLane) continue;
        let threat = 99;
        for (const c of cars) {
          if (c.lane !== l) continue;
          const p = 1 - ((simT * 0.42 + c.offset) % 1);
          if (p > 0.04) threat = Math.min(threat, p);
        }
        if (threat > bestScore) { bestScore = threat; safeLane = l; }
      }
      riderX += (safeLane - riderX) * Math.min(1, dt * 8);

      // Hop upcoming hazard if not no-jump
      if (!cur.modifiers.includes("no-jump") && jumpH <= 0.01) {
        const nearHz = hzs.some((hz) => {
          const p = 1 - ((simT * 0.36 + hz.offset) % 1);
          return Math.abs(hz.lane - safeLane) < 0.5 && p < 0.22 && p > 0.06;
        });
        if (nearHz) jumpV = 2.8;
      }
      if (jumpH > 0 || jumpV > 0) {
        jumpV -= 7.5 * dt;
        jumpH = Math.max(0, jumpH + jumpV * dt);
        if (jumpH === 0) jumpV = 0;
      }

      const pal = weatherPalette(cur.route.weather);
      ctx.save();
      ctx.scale(dpr, dpr);

      const hy = h * 0.38;
      const sky = ctx.createLinearGradient(0, 0, 0, hy);
      sky.addColorStop(0, pal.skyA);
      sky.addColorStop(1, pal.skyB);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, hy);

      ctx.fillStyle = cur.theme.ground[0];
      ctx.fillRect(0, hy, w, h - hy);

      // road trapezoid
      ctx.fillStyle = cur.theme.road;
      ctx.beginPath();
      ctx.moveTo(w * 0.37, hy);
      ctx.lineTo(w * 0.63, hy);
      ctx.lineTo(w * 0.92, h);
      ctx.lineTo(w * 0.08, h);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = pal.edge;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(w * 0.37, hy);
      ctx.lineTo(w * 0.08, h);
      ctx.moveTo(w * 0.63, hy);
      ctx.lineTo(w * 0.92, h);
      ctx.stroke();

      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([7, 9]);
      ctx.lineDashOffset = -simT * 95;
      for (const div of [-0.5, 0.5]) {
        ctx.beginPath();
        ctx.moveTo(w / 2 + div * w * 0.085, hy);
        ctx.lineTo(w / 2 + div * w * 0.27, h);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // closed-lane warning chevrons
      if (closedLane === 1) {
        for (let i = 0; i < 4; i++) {
          const p = ((simT * 0.6 + i * 0.25) % 1);
          const y = hy + p * (h - hy);
          const spread = w * (0.085 + p * 0.185);
          const x = w / 2 + closedLane * spread;
          ctx.strokeStyle = "rgba(251,191,36,0.75)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x - 6 - p * 8, y - 5);
          ctx.lineTo(x, y);
          ctx.lineTo(x + 6 + p * 8, y - 5);
          ctx.stroke();
        }
      }

      // hazards
      for (const hz of hzs) {
        const p = ((simT * 0.36 + hz.offset) % 1);
        const y = hy + p * (h - hy);
        const spread = w * (0.085 + p * 0.185);
        const x = w / 2 + hz.lane * spread;
        const r = 3 + p * 8;
        ctx.fillStyle = "#ff7a18";
        ctx.beginPath();
        ctx.moveTo(x, y - r * 1.4);
        ctx.lineTo(x - r * 0.7, y);
        ctx.lineTo(x + r * 0.7, y);
        ctx.closePath();
        ctx.fill();
      }

      // oncoming cars
      const sorted = cars
        .map((c) => ({ ...c, p: (simT * 0.42 + c.offset) % 1 }))
        .sort((a, b) => a.p - b.p);
      for (const c of sorted) {
        if (c.lane === closedLane) continue;
        const y = hy + c.p * (h - hy);
        const spread = w * (0.085 + c.p * 0.185);
        const x = w / 2 + c.lane * spread;
        const cw = 6 + c.p * 26;
        const ch = cw * 0.82;
        ctx.fillStyle = c.col;
        ctx.fillRect(x - cw / 2, y - ch, cw, ch);
        ctx.fillStyle = "#bfe8ff";
        ctx.fillRect(x - cw * 0.35, y - ch * 0.78, cw * 0.7, ch * 0.3);
      }

      // auto-piloted rider
      const rx = w / 2 + riderX * w * 0.24;
      const ry = h * 0.94 - jumpH * 34;
      ctx.save();
      ctx.translate(rx, ry);
      drawRiderBody(ctx, 0.34, cur.riderLook, "ride", simT * 10);
      ctx.restore();

      // weather overlay
      if (cur.route.weather !== "none") {
        ctx.fillStyle = pal.particle;
        for (let i = 0; i < 28; i++) {
          const wx = (i * 43 + simT * (cur.route.weather === "sand" ? 160 : 30)) % w;
          const wy = (i * 29 + simT * (cur.route.weather === "rain" ? 210 : 55)) % h;
          ctx.fillRect(wx, wy, cur.route.weather === "rain" ? 1.5 : 2.5, cur.route.weather === "rain" ? 8 : 2.5);
        }
      }

      ctx.restore();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="mb-3 overflow-hidden rounded-2xl border border-white/12 bg-black/45">
      <div className="relative h-36 w-full">
        <canvas ref={canvasRef} className="block h-full w-full" />
        <span className="pointer-events-none absolute left-3 top-2 rounded-md bg-black/55 px-2 py-0.5 font-display text-[8px] font-bold tracking-[0.22em] text-white/80">
          {testTimeLeft > 0 ? `TEST RIDE · ${testTimeLeft.toFixed(1)}s` : `SEED #${route.seed}`}
        </span>
        <button
          onClick={() => setTestTimeLeft(4)}
          className="btn-neon absolute bottom-2.5 right-2.5 flex items-center gap-1.5 rounded-xl bg-black/70 px-3 py-1.5 font-display text-[9px] font-black tracking-widest text-cyan-200 ring-1 ring-cyan-300/40 backdrop-blur-sm"
        >
          <PlayIcon size={12} /> {testTimeLeft > 0 ? "RIDING…" : "4s PREVIEW RIDE"}
        </button>
      </div>
      {testTimeLeft > 0 && (
        <div className="h-1 w-full bg-white/10">
          <div
            className="h-full bg-cyan-400 transition-all duration-100"
            style={{ width: `${(testTimeLeft / 4) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
