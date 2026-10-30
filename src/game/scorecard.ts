import { drawRiderBody, roundRect } from "./rider";
import { getChoice, BIKES, HELMETS, JACKETS } from "./garage";
import type { RunResult } from "./progression";
import type { Settings } from "./engine";

/** Renders a 1080×1920 arcade poster of a run and returns it as a blob URL. */
export async function buildScoreCard(
  run: RunResult,
  settings: Settings,
  extras: { level: number; title: string; badges: string[]; multiplier: number; rebirths?: number }
): Promise<Blob | null> {
  const W = 1080;
  const H = 1920;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d");
  if (!ctx) return null;

  // backdrop
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#140a2e");
  bg.addColorStop(0.45, "#3b1465");
  bg.addColorStop(0.75, "#8a2e7a");
  bg.addColorStop(1, "#1a0b2e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // retro sun
  const sunY = 560;
  const sg = ctx.createLinearGradient(0, sunY - 220, 0, sunY + 220);
  sg.addColorStop(0, "#ffe066");
  sg.addColorStop(1, "#ff4da6");
  ctx.save();
  ctx.beginPath();
  ctx.arc(W / 2, sunY, 220, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = sg;
  ctx.fillRect(W / 2 - 220, sunY - 220, 440, 440);
  ctx.fillStyle = "#3b1465";
  for (let i = 0; i < 6; i++) ctx.fillRect(W / 2 - 220, sunY + 10 + i * 34, 440, 8 + i * 3);
  ctx.restore();

  // perspective grid floor
  ctx.strokeStyle = "rgba(255,77,166,0.45)";
  ctx.lineWidth = 3;
  const hz = 760;
  for (let i = -10; i <= 10; i++) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + i * 34, hz);
    ctx.lineTo(W / 2 + i * 360, H);
    ctx.stroke();
  }
  for (let i = 0; i < 14; i++) {
    const y = hz + Math.pow(i / 14, 2.2) * (H - hz);
    ctx.globalAlpha = 0.5 - (i / 14) * 0.3;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // title
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffe066";
  ctx.font = "900 54px Orbitron, monospace";
  ctx.fillText("WRONG WAY RIDER", W / 2, 140);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "700 30px Rubik, sans-serif";
  ctx.fillText(run.banner.toUpperCase(), W / 2, 196);

  // rider
  ctx.save();
  ctx.translate(W / 2, 1010);
  drawRiderBody(ctx, 2.6, settings, "ride", 0);
  ctx.restore();

  // score block
  ctx.fillStyle = "rgba(10,4,26,0.72)";
  roundRect(ctx, 90, 1080, W - 180, 300, 36);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,77,166,0.6)";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = "#ff8ac4";
  ctx.font = "700 28px Orbitron, monospace";
  ctx.fillText("FINAL SCORE", W / 2, 1150);
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 130px Orbitron, monospace";
  ctx.fillText(run.score.toLocaleString(), W / 2, 1272);
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "600 26px Rubik, sans-serif";
  ctx.fillText(
    `${run.mode.toUpperCase()} · ${run.difficulty.toUpperCase()} · ${run.themeName} · ×${extras.multiplier.toFixed(1)}`,
    W / 2, 1338
  );

  // stat grid
  const stats: [string, string][] = [
    ["DISTANCE", `${run.distance} m`],
    ["COINS", String(run.coins)],
    ["TOP SPEED", `${run.topSpeed} km/h`],
    ["NEAR MISSES", String(run.nearMisses)],
    ["STUNTS", String(run.stunts)],
    ["BEST COMBO", `×${run.maxCombo}`],
  ];
  const gx = 90;
  const gw = (W - 180) / 3;
  stats.forEach(([label, value], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = gx + col * gw;
    const y = 1420 + row * 128;
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    roundRect(ctx, x + 8, y, gw - 16, 112, 22);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "700 20px Orbitron, monospace";
    ctx.fillText(label, x + gw / 2, y + 42);
    ctx.fillStyle = "#ffe066";
    ctx.font = "900 40px Orbitron, monospace";
    ctx.fillText(value, x + gw / 2, y + 88);
  });

  // rider build + level
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = "600 26px Rubik, sans-serif";
  const plate = settings.plateText ? ` · [${settings.plateText}]` : "";
  const build = `${getChoice(BIKES, settings.bikeId).name} · ${getChoice(HELMETS, settings.helmetId).name} · ${getChoice(JACKETS, settings.jacketId).name}${plate}`;
  ctx.fillText(build, W / 2, 1724);
  ctx.fillStyle = "#67e8f9";
  ctx.font = "900 32px Orbitron, monospace";
  ctx.fillText(`LVL ${extras.level} — ${extras.title.toUpperCase()}`, W / 2, 1778);

  if (extras.rebirths && extras.rebirths > 0) {
    ctx.fillStyle = "#f0abfc";
    ctx.font = "900 26px Orbitron, monospace";
    ctx.fillText(`REBIRTH ×${extras.rebirths}`, W / 2, 1724 - 46);
  }

  if (extras.badges.length) {
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "600 22px Rubik, sans-serif";
    ctx.fillText(extras.badges.slice(0, 4).join("  •  "), W / 2, 1822);
  }

  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "600 22px Rubik, sans-serif";
  ctx.fillText("Ride the wrong side. Beat my score.", W / 2, 1872);

  return new Promise((resolve) => cv.toBlob((b) => resolve(b), "image/png"));
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function shareOrDownload(blob: Blob, text: string) {
  const file = new File([blob], "wrong-way-rider.png", { type: "image/png" });
  const nav = navigator as Navigator & {
    canShare?: (d: { files?: File[] }) => boolean;
    share?: (d: { files?: File[]; text?: string; title?: string }) => Promise<void>;
  };
  if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], text, title: "Wrong Way Rider" });
      return "shared";
    } catch {
      /* user cancelled — fall through to download */
    }
  }
  downloadBlob(blob, "wrong-way-rider.png");
  return "downloaded";
}
