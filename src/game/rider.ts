import {
  BIKES, HELMETS, JACKETS, getChoice,
  type BikeId, type HelmetId, type JacketId,
} from "./garage";

export interface RiderLook {
  bikeId: BikeId;
  helmetId: HelmetId;
  jacketId: JacketId;
  decal?: string;
  plateText?: string;
  /** 8x8 custom pixel decal (palette indices, row-major); overrides decal when present */
  customDecal?: number[] | null;
}

/** Palette shared with the Decal Painter UI (index 0 = transparent). */
export const DECAL_PALETTE = [
  "transparent", "#ffffff", "#f87171", "#fbbf24",
  "#4ade80", "#22d3ee", "#818cf8", "#f472b6",
] as const;

export type Pose = "ride" | "superman" | "tuck";

/** Single shared rounded-rect path helper (engine + renderers all use this). */
export function roundRect(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number
) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * Rear-view rider drawn at the canvas origin.
 * Shared by the engine, the ghost replay and the garage preview.
 */
export function drawRiderBody(
  ctx: CanvasRenderingContext2D,
  u: number,
  look: RiderLook,
  pose: Pose = "ride",
  wheelSpin = 0
) {
  const bike = getChoice(BIKES, look.bikeId);
  const helmet = getChoice(HELMETS, look.helmetId);
  const jacketColors = getChoice(JACKETS, look.jacketId).colors;

  // rear wheel (spokes hint at rotation)
  ctx.fillStyle = "#121019";
  ctx.beginPath();
  ctx.ellipse(0, -16 * u, 15 * u, 26 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2c2838";
  ctx.beginPath();
  ctx.ellipse(0, -16 * u, 8 * u, 17 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = Math.max(1.2 * u, 0.6);
  for (let i = 0; i < 3; i++) {
    const a = wheelSpin + (i / 3) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 7 * u, -16 * u + Math.sin(a) * 15 * u);
    ctx.lineTo(-Math.cos(a) * 7 * u, -16 * u - Math.sin(a) * 15 * u);
    ctx.stroke();
  }

  const fender = ctx.createLinearGradient(0, -50 * u, 0, -28 * u);
  fender.addColorStop(0, bike.colors[0]);
  fender.addColorStop(1, bike.colors[1]);
  ctx.fillStyle = fender;
  roundRect(ctx, -18 * u, -48 * u, 36 * u, 18 * u, 8 * u);
  ctx.fill();

  const tg = ctx.createRadialGradient(0, -40 * u, 0, 0, -40 * u, 26 * u);
  tg.addColorStop(0, bike.colors[0]);
  tg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.arc(0, -40 * u, 26 * u, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = bike.colors[0];
  roundRect(ctx, -10 * u, -45 * u, 20 * u, 7 * u, 3 * u);
  ctx.fill();
  ctx.fillStyle = "#1b1726";
  roundRect(ctx, -14 * u, -62 * u, 28 * u, 16 * u, 6 * u);
  ctx.fill();

  // rider body — pose changes torso height and arm shape
  const torsoTop = pose === "superman" ? -96 : pose === "tuck" ? -102 : -112;
  const torsoH = pose === "superman" ? 38 : pose === "tuck" ? 44 : 54;
  const jacket = ctx.createLinearGradient(0, torsoTop, 0, torsoTop + torsoH);
  jacket.addColorStop(0, jacketColors[0]);
  jacket.addColorStop(1, jacketColors[1]);
  ctx.fillStyle = jacket;
  roundRect(ctx, -20 * u, torsoTop * u, 40 * u, torsoH * u, 14 * u);
  ctx.fill();

  ctx.fillStyle = bike.colors[0];
  roundRect(ctx, -12 * u, (torsoTop + 6) * u, 24 * u, (torsoH - 14) * u, 8 * u);
  ctx.fill();
  // custom 8x8 pixel decal painted by the Decal Painter takes priority
  if (look.customDecal && look.customDecal.length === 64) {
    const cell = 24 * u / 8;
    const x0 = -12 * u;
    const y0 = (torsoTop + 6) * u;
    for (let i = 0; i < 64; i++) {
      const idx = look.customDecal[i];
      if (!Number.isInteger(idx) || idx <= 0 || idx >= DECAL_PALETTE.length) continue;
      ctx.fillStyle = DECAL_PALETTE[idx];
      ctx.fillRect(x0 + (i % 8) * cell, y0 + Math.floor(i / 8) * cell, cell + 0.5, cell + 0.5);
    }
  } else if (look.decal && look.decal !== "none") {
    const decalColor = look.decal === "flame" ? "#ff7a18" : look.decal === "star" ? "#fde047" : look.decal === "wave" ? "#67e8f9" : "#ffffff";
    ctx.fillStyle = decalColor;
    if (look.decal === "star") {
      ctx.beginPath();
      ctx.arc(0, (torsoTop + torsoH * 0.58) * u, 5 * u, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(-10 * u, (torsoTop + torsoH * 0.58) * u, 20 * u, 3 * u);
      if (look.decal === "flame") ctx.fillRect(-6 * u, (torsoTop + torsoH * 0.58 - 5) * u, 12 * u, 2 * u);
    }
  }

  ctx.strokeStyle = jacketColors[1];
  ctx.lineWidth = 9 * u;
  ctx.lineCap = "round";
  if (pose === "superman") {
    // legs kicked out behind, arms locked forward
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sd * 14 * u, -88 * u);
      ctx.quadraticCurveTo(sd * 30 * u, -84 * u, sd * 30 * u, -74 * u);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sd * 10 * u, -62 * u);
      ctx.quadraticCurveTo(sd * 26 * u, -34 * u, sd * 34 * u, -8 * u);
      ctx.stroke();
    }
  } else {
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sd * 16 * u, (torsoTop + 12) * u);
      ctx.quadraticCurveTo(sd * 34 * u, -92 * u, sd * 30 * u, -76 * u);
      ctx.stroke();
    }
  }

  ctx.fillStyle = "#1b1726";
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(sd * 31 * u, -74 * u, 5.5 * u, 0, Math.PI * 2);
    ctx.fill();
  }

  const headY = pose === "superman" ? -110 : pose === "tuck" ? -116 : -126;
  ctx.fillStyle = "#f8f9fa";
  ctx.beginPath();
  ctx.arc(0, headY * u, 16 * u, 0, Math.PI * 2);
  ctx.fill();
  const hg = ctx.createLinearGradient(-16 * u, headY * u, 16 * u, headY * u);
  hg.addColorStop(0, helmet.colors[0]);
  hg.addColorStop(1, helmet.colors[1]);
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(0, headY * u, 16 * u, Math.PI * 0.95, Math.PI * 2.05);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.ellipse(-5 * u, (headY - 6) * u, 5 * u, 3 * u, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // per-bike signature detail
  if (bike.id === "racer") {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(-3 * u, -47 * u, 6 * u, 16 * u);
  } else if (bike.id === "midnight") {
    ctx.strokeStyle = bike.colors[0];
    ctx.lineWidth = Math.max(1.5 * u, 1);
    ctx.beginPath();
    ctx.ellipse(0, -16 * u, 11 * u, 21 * u, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (bike.id === "volt") {
    ctx.fillStyle = bike.colors[0];
    roundRect(ctx, -13 * u, -34 * u, 26 * u, 4 * u, 2 * u);
    ctx.fill();
  }
}
