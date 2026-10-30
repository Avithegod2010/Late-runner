import type { CarKind } from "../systems/config";
import { roundRect } from "../rider";

export interface VehicleVisual {
  kind: CarKind;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  dark: string;
  time: number;
  alpha?: number;
}

/** Lightweight shared vehicle renderer used by Duel and preview systems. */
export function drawVehicle(ctx: CanvasRenderingContext2D, v: VehicleVisual) {
  const { kind, x, y, width: w, height: h, color, dark, time } = v;
  ctx.save();
  ctx.globalAlpha = v.alpha ?? 1;
  ctx.translate(x, y);
  if (kind === "moto") {
    ctx.fillStyle = "#111827";
    ctx.beginPath(); ctx.ellipse(0, -h * 0.12, w * 0.12, h * 0.26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;
    roundRect(ctx, -w * 0.25, -h * 0.72, w * 0.5, h * 0.35, w * 0.1); ctx.fill();
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath(); ctx.arc(0, -h * 0.92, w * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath(); ctx.ellipse(0, 0, w * 0.58, w * 0.13, 0, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createLinearGradient(0, -h, 0, 0);
  g.addColorStop(0, color); g.addColorStop(1, dark);
  ctx.fillStyle = g; roundRect(ctx, -w / 2, -h, w, h * 0.94, w * 0.1); ctx.fill();
  ctx.fillStyle = "#8ec5e8"; roundRect(ctx, -w * 0.35, -h * 0.8, w * 0.7, h * 0.3, w * 0.06); ctx.fill();
  if (kind === "police") {
    const blue = Math.floor(time / 100) % 2 === 0;
    ctx.fillStyle = blue ? "#3b82f6" : "#ef4444"; ctx.fillRect(-w * 0.25, -h * 1.05, w * 0.22, h * 0.08);
    ctx.fillStyle = blue ? "#ef4444" : "#3b82f6"; ctx.fillRect(w * 0.03, -h * 1.05, w * 0.22, h * 0.08);
  }
  if (kind === "truck" || kind === "bus") {
    ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.fillRect(-w * 0.45, -h * 0.33, w * 0.9, h * 0.1);
  }
  for (const side of [-1, 1]) {
    ctx.fillStyle = "#fff4b0";
    roundRect(ctx, side * w * 0.34 - w * 0.09, -h * 0.34, w * 0.18, h * 0.08, w * 0.03); ctx.fill();
  }
  ctx.restore();
}