import type { Theme } from "../themes";

export interface LayerProjection {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  horizon: number;
  roadHalf: number;
  theme: Theme;
  xAt: (lane: number, z: number) => number;
  yAt: (z: number) => number;
  scaleAt: (z: number) => number;
  roadOffset: number;
}

/** Shared base sky/ground used by the main engine and shared Duel renderer. */
export function drawBaseWorld(p: LayerProjection) {
  const { ctx, width: W, height: H, horizon: hy, theme } = p;
  const sky = ctx.createLinearGradient(0, 0, 0, hy * 1.1);
  for (const [stop, color] of theme.sky) sky.addColorStop(stop, color);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, hy + 2);
  const ground = ctx.createLinearGradient(0, hy, 0, H);
  ground.addColorStop(0, theme.ground[0]);
  ground.addColorStop(1, theme.ground[1]);
  ctx.fillStyle = ground;
  ctx.fillRect(0, hy, W, H - hy);
  ctx.fillStyle = theme.horizon;
  ctx.fillRect(0, hy - 1, W, 2);
}

/** Shared curved 3-lane road plane. */
export function drawRoadPlane(p: LayerProjection) {
  const { ctx, horizon: hy, theme, xAt, yAt, scaleAt, roadOffset } = p;
  const yB = yAt(0) + 30;
  ctx.fillStyle = theme.road;
  ctx.beginPath();
  ctx.moveTo(xAt(-1.73, 70), hy);
  ctx.lineTo(xAt(1.73, 70), hy);
  ctx.lineTo(xAt(1.59, 0), yB);
  ctx.lineTo(xAt(-1.59, 0), yB);
  ctx.closePath();
  ctx.fill();

  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(xAt(side * 1.5, 70), yAt(70));
    ctx.lineTo(xAt(side * 1.5, 0), yB);
    ctx.strokeStyle = side < 0 ? theme.edges[0] : theme.edges[1];
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  ctx.fillStyle = theme.dash;
  for (const divider of [-0.5, 0.5]) {
    for (let k = 0; k < 12; k++) {
      const z0 = k * 8 - (roadOffset % 8);
      if (z0 < -2.6 || z0 > 70) continue;
      const z1 = z0 + 2.6;
      const zz = Math.max(z0, 0.01);
      const x0 = xAt(divider * 1.5, zz), x1 = xAt(divider * 1.5, z1);
      const w0 = 5 * scaleAt(zz), w1 = 5 * scaleAt(z1);
      ctx.beginPath();
      ctx.moveTo(x0 - w0, yAt(zz)); ctx.lineTo(x0 + w0, yAt(zz));
      ctx.lineTo(x1 + w1, yAt(z1)); ctx.lineTo(x1 - w1, yAt(z1));
      ctx.closePath(); ctx.fill();
    }
  }
}

export function drawSkyScene(
  ctx: CanvasRenderingContext2D,
  W: number,
  horizon: number,
  theme: Theme,
  now: number,
  reduceMotion: boolean,
) {
  const g = ctx.createLinearGradient(0, 0, 0, horizon * 1.15);
  for (const [o, c] of theme.sky) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, horizon + 4);

  if (theme.stars > 0) {
    ctx.fillStyle = "#fff";
    for (let i = 0; i < theme.stars; i++) {
      const sx = ((i * 739) % W | 0) + Math.sin(i * 9.1) * 8;
      const sy = (i * 211) % Math.max(1, (horizon * 0.6) | 0);
      const tw = 0.5 + 0.5 * Math.sin(now * 0.002 + i * 2.2);
      ctx.globalAlpha = 0.2 + tw * 0.55;
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  const skyT = (now / 1000) * (reduceMotion ? 0 : 1);
  const driftX = Math.sin(skyT * 0.17) * W * 0.075;
  const driftY = Math.cos(skyT * 0.105) * 14;
  if (theme.celestial !== "none") {
    const cx = W / 2 + driftX;
    const cy = horizon - 34 + driftY;
    const r = Math.min(W, 600) * (theme.celestial === "retro-sun" ? 0.14 : 0.085);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 3);
    glow.addColorStop(0, theme.celestialGlow);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(cx - r * 3, cy - r * 3, r * 6, r * 6);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, horizon); ctx.clip();
    const body = ctx.createLinearGradient(0, cy - r, 0, cy + r);
    body.addColorStop(0, theme.celestialColors[0]);
    body.addColorStop(1, theme.celestialColors[1]);
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    if (theme.celestial === "retro-sun") {
      ctx.fillStyle = theme.sky[1][1];
      for (let i = 0; i < 5; i++) ctx.fillRect(cx - r, cy + r * (0.05 + i * 0.22), r * 2, 3 + i * 1.5);
    } else if (theme.celestial === "moon") {
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.beginPath();
      ctx.arc(cx - r * 0.3, cy - r * 0.25, r * 0.2, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.26, cy + r * 0.2, r * 0.14, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.05, cy - r * 0.45, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  const shift = Math.sin(skyT * 0.09) * 12;
  ctx.fillStyle = theme.propTint;
  ctx.globalAlpha = 0.55;
  ctx.beginPath(); ctx.moveTo(0, horizon);
  for (let i = 0; i <= 14; i++) {
    const x = (i / 14) * W + shift;
    const n = Math.sin(i * 1.7 + 0.5 + skyT * 0.07) * 0.5 + Math.sin(i * 0.63) * 0.5 + Math.sin(i * 3.1) * 0.22;
    ctx.lineTo(x, horizon - 28 - n * 22);
  }
  ctx.lineTo(W, horizon); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
}

export function drawGroundLayer(ctx: CanvasRenderingContext2D, W: number, H: number, horizon: number, theme: Theme) {
  const g = ctx.createLinearGradient(0, horizon, 0, H);
  g.addColorStop(0, theme.ground[0]);
  g.addColorStop(1, theme.ground[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, horizon, W, H - horizon);
  ctx.fillStyle = theme.horizon;
  ctx.fillRect(0, horizon - 1, W, 2);
}

/** Main road plane plus wrong-way directional arrows and edge glow. */
export function drawDetailedRoad(p: LayerProjection) {
  drawRoadPlane(p);
  const { ctx, theme, xAt, yAt, scaleAt, roadOffset } = p;
  // strengthen edge glow over the shared base plane
  for (const side of [-1, 1]) {
    const col = side < 0 ? theme.edges[0] : theme.edges[1];
    ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 10; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(xAt(side * 1.5, 70), yAt(70)); ctx.lineTo(xAt(side * 1.5, 0), yAt(0) + 30); ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.fillStyle = theme.arrow;
  for (let k = 0; k < 3; k++) {
    const z = (((k * 24 - roadOffset) % 72) + 72) % 72;
    if (z < 2) continue;
    const s = scaleAt(z), x = xAt(0, z), y = yAt(z), w = 26 * s, h = 40 * s;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x - w, y - h * 0.5); ctx.lineTo(x - w * 0.4, y - h * 0.5);
    ctx.lineTo(x - w * 0.4, y - h); ctx.lineTo(x + w * 0.4, y - h);
    ctx.lineTo(x + w * 0.4, y - h * 0.5); ctx.lineTo(x + w, y - h * 0.5); ctx.closePath(); ctx.fill();
  }
}

/** Visual split decision: rich narrow lane vs. wide safe lane. */
export function drawRoadFork(
  p: LayerProjection,
  fork: { active: boolean; z: number; richLane: number; safeLane: number },
) {
  if (!fork.active || fork.z < -8 || fork.z > 70) return;
  const { ctx, xAt, yAt, scaleAt, theme } = p;
  const z = Math.max(0.4, fork.z);
  const s = scaleAt(z);
  const y = yAt(z);
  for (const [lane, rich] of [[fork.richLane, true], [fork.safeLane, false]] as const) {
    const x = xAt(lane, z);
    const w = 34 * s;
    ctx.strokeStyle = rich ? "#fde047" : "#4ade80";
    ctx.lineWidth = Math.max(2, 5 * s);
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 12 * s;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - w, y - 42 * s);
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y - 42 * s);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = rich ? "#fde047" : "#bbf7d0";
    ctx.font = `900 ${Math.max(7, 15 * s)}px Orbitron, monospace`;
    ctx.textAlign = "center";
    ctx.fillText(rich ? "COINS" : "SAFE", x, y - 52 * s);
  }
  ctx.strokeStyle = theme.arrow;
}