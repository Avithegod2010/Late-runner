import type { Settings } from "../engine";
import { getTheme, customToTheme, type Theme } from "../themes";
import { drawRiderBody } from "../rider";
import { mulberry32, type Rand } from "../rng";
import { chooseWave, createSpawnCar, type SpawnCar } from "./spawning";
import { crossesPlayerPlane, laneOverlap } from "./collisions";
import { drawBaseWorld, drawRoadPlane, type LayerProjection } from "../render/layers";
import { drawVehicle } from "../render/vehicles";

interface DuelCar extends SpawnCar { passed: [boolean, boolean] }
interface DuelCoin { lane: number; z: number; taken: [boolean, boolean]; spin: number }
interface DuelPlayer {
  lane: number;
  x: number;
  h: number;
  v: number;
  score: number;
  coins: number;
  alive: boolean;
  invuln: number;
  tilt: number;
  distance: number;
  /* finish-line duel state */
  penalties: number;
  crashFlash: number;
  finishTime: number | null;
}

export interface DuelFrame {
  scores: [number, number];
  distances: [number, number];
  lanes: [number, number];
  fps: number;
  /** accumulated crash penalty seconds per player */
  penalties: [number, number];
  /** elapsed race clock seconds */
  elapsed: number;
  /** null until that player has crossed the finish line */
  finishTimes: [number | null, number | null];
}

export interface DuelFinish {
  p1: number;
  p2: number;
  winner: 0 | 1 | 2;
  /** total race time per player in seconds (penalties included); null = did not finish */
  p1Time: number | null;
  p2Time: number | null;
  p1Penalties: number;
  p2Penalties: number;
}

/** Fixed race distance for the Finish-Line Duel. */
export const DUEL_FINISH_DISTANCE = 2000;
/** Seconds added to your race time each time you crash. */
const CRASH_PENALTY_S = 8;
/** Safety cap: force the race to end after the first finisher + this many seconds. */
const GRACE_CAP_S = 75;

/**
 * A true shared-world Duel: one RNG, one traffic/coin array and one update loop,
 * rendered into two viewports. This replaces the previous two full Engine instances.
 */
export class SharedDuelSimulation {
  private canvases: [HTMLCanvasElement, HTMLCanvasElement];
  private ctxs: [CanvasRenderingContext2D, CanvasRenderingContext2D];
  private settings: Settings;
  private theme: Theme;
  private rand: Rand;
  private players: [DuelPlayer, DuelPlayer];
  private cars: DuelCar[] = [];
  private coins: DuelCoin[] = [];
  private raf = 0;
  private last = performance.now();
  private elapsed = 0;
  private speed = 18;
  private roadOffset = 0;
  private spawnT = 0.8;
  private lastFree = 0;
  private paused = false;
  private finished = false;
  private graceT = -1;
  private avgMs = 16.7;
  private dpr = 1;
  private wheel = 0;
  private keys = new Set<string>();

  constructor(
    canvases: [HTMLCanvasElement, HTMLCanvasElement],
    settings: Settings,
    private onFrame: (frame: DuelFrame) => void,
    private onFinish: (finish: DuelFinish) => void,
  ) {
    this.canvases = canvases;
    this.ctxs = [canvases[0].getContext("2d")!, canvases[1].getContext("2d")!];
    this.settings = settings;
    this.theme = settings.useCustom && settings.customTheme
      ? customToTheme(settings.customTheme)
      : getTheme(settings.themeId);
    this.rand = mulberry32(settings.route.seed || 20260808);
    const p = (): DuelPlayer => ({
      lane: 0, x: 0, h: 0, v: 0, score: 0, coins: 0,
      alive: true, invuln: 0, tilt: 0, distance: 0,
      penalties: 0, crashFlash: 0, finishTime: null,
    });
    this.players = [p(), p()];
    this.graceT = -1;
  }

  start() {
    this.resize();
    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
  }

  pause() { this.paused = true; }
  resume() { this.paused = false; this.last = performance.now(); }

  private onBlur = () => {
    // a keyup lost to a focus change would otherwise stick a button forever
    this.keys.clear();
  };

  private resize = () => {
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    for (const c of this.canvases) {
      const r = c.parentElement?.getBoundingClientRect();
      if (!r || !r.width || !r.height) return;
      c.width = Math.max(1, Math.round(r.width * this.dpr));
      c.height = Math.max(1, Math.round(r.height * this.dpr));
      c.style.width = `${r.width}px`;
      c.style.height = `${r.height}px`;
    }
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.keys.has(e.key)) return;
    this.keys.add(e.key);
    if (["ArrowLeft", "a", "A"].includes(e.key)) this.move(0, -1);
    if (["ArrowRight", "d", "D"].includes(e.key)) this.move(0, 1);
    if (["ArrowUp", "w", "W", " "].includes(e.key)) this.jump(0);
    if (["j", "J"].includes(e.key)) this.move(1, -1);
    if (["l", "L"].includes(e.key)) this.move(1, 1);
    if (["i", "I"].includes(e.key)) this.jump(1);
  };

  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.key); };

  private move(slot: 0 | 1, dir: number) {
    const p = this.players[slot];
    if (!p.alive) return;
    p.lane = Math.max(-1, Math.min(1, p.lane + dir));
  }

  private jump(slot: 0 | 1) {
    const p = this.players[slot];
    if (p.alive && p.h <= 0.01) p.v = 4;
  }

  private pollPads() {
    const pads = navigator.getGamepads?.();
    if (!pads) return;
    for (const slot of [0, 1] as const) {
      const gp = pads[slot];
      if (!gp) continue;
      const axis = gp.axes[0] ?? 0;
      const want = axis < -0.55 || gp.buttons[14]?.pressed ? -1 : axis > 0.55 || gp.buttons[15]?.pressed ? 1 : 0;
      if (want && this.players[slot].lane !== want) this.players[slot].lane = want;
      if (gp.buttons[0]?.pressed) this.jump(slot);
    }
  }

  private loop = (now: number) => {
    const raw = Math.min(0.04, (now - this.last) / 1000);
    this.last = now;
    this.avgMs += (raw * 1000 - this.avgMs) * 0.06;
    if (!this.paused && !this.finished) {
      this.pollPads();
      this.update(raw);
    }
    this.render(0);
    this.render(1);
    this.onFrame({
      scores: [Math.floor(this.players[0].score), Math.floor(this.players[1].score)],
      distances: [Math.floor(this.players[0].distance), Math.floor(this.players[1].distance)],
      lanes: [this.players[0].x, this.players[1].x],
      fps: Math.round(1000 / Math.max(1, this.avgMs)),
      penalties: [this.players[0].penalties * CRASH_PENALTY_S, this.players[1].penalties * CRASH_PENALTY_S],
      elapsed: this.elapsed,
      finishTimes: [this.players[0].finishTime, this.players[1].finishTime],
    });
    this.raf = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    this.elapsed += dt;
    this.speed = Math.min(45, 18 + this.elapsed * 0.32);
    this.roadOffset = (this.roadOffset + this.speed * dt) % 8;
    this.wheel += this.speed * dt * 0.5;
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      const wave = chooseWave(this.rand, this.lastFree, Math.min(0.35, 0.12 + this.elapsed * 0.002));
      this.lastFree = wave.freeLane;
      for (const lane of wave.occupied) {
        const car = createSpawnCar(this.rand, lane, { allowHeavy: true, time: this.elapsed });
        this.cars.push({ ...car, passed: [false, false] });
      }
      for (let i = 0; i < 4; i++) this.coins.push({ lane: wave.freeLane, z: 72 + i * 4, taken: [false, false], spin: i });
      this.spawnT = Math.max(0.65, 1.08 - this.elapsed * 0.002);
    }

    for (const p of this.players) {
      if (!p.alive) continue;
      p.x += (p.lane - p.x) * Math.min(1, dt * 12);
      p.tilt += ((p.lane - p.x) * 0.7 - p.tilt) * Math.min(1, dt * 10);
      if (p.h > 0 || p.v > 0) {
        p.v -= 8.9 * dt;
        p.h = Math.max(0, p.h + p.v * dt);
        if (p.h === 0) p.v = 0;
      }
      if (p.invuln > 0) p.invuln -= dt;
      if (p.crashFlash > 0) p.crashFlash -= dt;
      p.score += this.speed * dt;
      p.distance += this.speed * dt;
      // ---- finish-line duel: record crossing times ----
      if (p.finishTime === null && p.distance >= DUEL_FINISH_DISTANCE) {
        p.finishTime = this.elapsed + p.penalties * CRASH_PENALTY_S;
        if (this.graceT < 0) this.graceT = GRACE_CAP_S;
      }
    }
    // once someone finished, the trailing rider has a grace window to finish too
    if (this.graceT > 0) {
      this.graceT -= dt;
      if (this.graceT <= 0) {
        for (const p of this.players) {
          if (p.finishTime === null) p.finishTime = this.elapsed + p.penalties * CRASH_PENALTY_S + 30;
        }
      }
    }

    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      const prev = c.z;
      c.z -= (this.speed + c.speed) * dt;
      for (const slot of [0, 1] as const) {
        const p = this.players[slot];
        if (!p.alive) continue;
        const clear = c.kind === "truck" || c.kind === "bus" ? Infinity : c.kind === "van" ? 0.42 : 0.3;
        if (c.z < 1.5 && c.z > -1 && laneOverlap(p.x, c.lane, 0.68) && p.h < clear && p.invuln <= 0) {
          // ---- finish-line duel: crashes are time penalties, not eliminations ----
          p.penalties++;
          p.crashFlash = 1.4;
          p.invuln = 2.2;
          p.v = 0;
          p.h = 0;
          continue;
        }
        if (!c.passed[slot] && crossesPlayerPlane(prev, c.z)) {
          c.passed[slot] = true;
          const dx = Math.abs(p.x - c.lane);
          if (dx < 1.2) p.score += dx < 0.55 ? 180 : 70;
        }
      }
      if (c.z < -5) this.cars.splice(i, 1);
    }

    for (let i = this.coins.length - 1; i >= 0; i--) {
      const coin = this.coins[i];
      coin.z -= this.speed * dt;
      coin.spin += dt * 6;
      for (const slot of [0, 1] as const) {
        const p = this.players[slot];
        if (!coin.taken[slot] && coin.z < 1 && coin.z > -0.8 && laneOverlap(p.x, coin.lane, 0.55) && p.h < 0.35) {
          coin.taken[slot] = true;
          p.coins++;
          p.score += 25;
        }
      }
      if (coin.z < -3) this.coins.splice(i, 1);
    }

    // race ends when both riders have crossed (or the grace cap forces a finish)
    if (
      this.players[0].finishTime !== null &&
      this.players[1].finishTime !== null
    ) {
      this.finish();
    }
  }

  private finish() {
    if (this.finished) return;
    this.finished = true;
    const p1 = Math.floor(this.players[0].score);
    const p2 = Math.floor(this.players[1].score);
    const t1 = this.players[0].finishTime;
    const t2 = this.players[1].finishTime;
    // the finish-line duel is decided by race time, not score
    let winner: 0 | 1 | 2 = 0;
    if (t1 !== null && t2 !== null) winner = t1 === t2 ? 0 : t1 < t2 ? 1 : 2;
    else if (t1 !== null) winner = 1;
    else if (t2 !== null) winner = 2;
    else winner = p1 === p2 ? 0 : p1 > p2 ? 1 : 2;
    this.onFinish({
      p1,
      p2,
      winner,
      p1Time: t1,
      p2Time: t2,
      p1Penalties: this.players[0].penalties,
      p2Penalties: this.players[1].penalties,
    });
  }

  private render(slot: 0 | 1) {
    const ctx = this.ctxs[slot];
    const c = this.canvases[slot];
    const W = c.width / this.dpr;
    const H = c.height / this.dpr;
    const hy = H * 0.33;
    const roadHalf = Math.min(W, 700) * 0.5;
    const scaleAt = (z: number) => 2.3 / (2.3 + Math.max(z, -1.7));
    const yAt = (z: number) => hy + (H * 0.985 - hy) * scaleAt(z);
    const xAt = (lane: number, z: number) => W / 2 + lane * roadHalf * (2 / 3) * scaleAt(z);
    const projection: LayerProjection = {
      ctx, width: W, height: H, horizon: hy, roadHalf, theme: this.theme,
      xAt, yAt, scaleAt, roadOffset: this.roadOffset,
    };
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    drawBaseWorld(projection);
    drawRoadPlane(projection);

    const entities = this.cars.map((car) => ({ z: car.z, kind: "car" as const, car }))
      .concat(this.coins.filter((coin) => !coin.taken[slot]).map((coin) => ({ z: coin.z, kind: "coin" as const, coin }) as never))
      .sort((a, b) => b.z - a.z);
    for (const e of entities as Array<{ z: number; kind: "car" | "coin"; car?: DuelCar; coin?: DuelCoin }>) {
      const s = scaleAt(e.z);
      if (e.kind === "car" && e.car) {
        const w = roadHalf * (2 / 3) * (e.car.spec.w / 0.5) * 0.9 * s;
        drawVehicle(ctx, {
          kind: e.car.kind, x: xAt(e.car.lane, e.z), y: yAt(e.z), width: w,
          height: w * e.car.spec.hMul, color: e.car.color, dark: e.car.dark, time: performance.now(),
        });
      } else if (e.coin) {
        const x = xAt(e.coin.lane, e.z), y = yAt(e.z) - 20 * s;
        ctx.fillStyle = "#ffd700";
        ctx.beginPath(); ctx.arc(x, y, Math.max(2, 15 * s), 0, Math.PI * 2); ctx.fill();
      }
    }

    // opponent ghost in the same shared world
    const other = this.players[slot === 0 ? 1 : 0];
    const otherScale = Math.min(H / 610, 0.9) * scaleAt(2.2);
    const otherX = xAt(other.x, 2.2);
    const otherY = yAt(2.2) - other.h * 90 * scaleAt(2.2);
    ctx.save(); ctx.globalAlpha = 0.35; ctx.translate(otherX, otherY);
    drawRiderBody(ctx, otherScale, this.settings, "ride", this.wheel);
    ctx.restore();

    const p = this.players[slot];
    const px = xAt(p.x, 0), py = yAt(0) + 5 - p.h * 105;
    ctx.save(); ctx.translate(px, py); ctx.rotate(p.tilt);
    drawRiderBody(ctx, Math.min(H / 610, 0.9), this.settings, "ride", this.wheel);
    ctx.restore();
    if (!p.alive) {
      ctx.fillStyle = "rgba(255,30,60,0.25)"; ctx.fillRect(0, 0, W, H);
    }

    // ---- finish-line duel HUD draws ----
    // crash penalty flash
    if (p.crashFlash > 0) {
      ctx.fillStyle = `rgba(255,30,60,${0.3 * Math.min(1, p.crashFlash)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fecaca";
      ctx.font = `900 ${Math.round(W * 0.055)}px Orbitron, monospace`;
      ctx.textAlign = "center";
      ctx.fillText(`+${CRASH_PENALTY_S}s PENALTY`, W / 2, H * 0.3);
    }
    // finish-line banner when it is on screen
    const finishRemaining = DUEL_FINISH_DISTANCE - p.distance;
    if (finishRemaining > -40 && finishRemaining < 90) {
      const fz = finishRemaining;
      const fx = xAt(0, fz);
      const fy = yAt(fz);
      const fw = roadHalf * (2 / 3) * 1.5 * scaleAt(fz);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = Math.max(2, 6 * scaleAt(fz));
      ctx.beginPath();
      ctx.moveTo(fx - fw, fy);
      ctx.lineTo(fx + fw, fy - fw * 0.55);
      ctx.stroke();
      // checker pattern
      const cells = 8;
      for (let i = 0; i < cells; i++) {
        ctx.fillStyle = i % 2 === 0 ? "#fff" : "#111";
        const sw = (fw * 2) / cells;
        ctx.fillRect(fx - fw + i * sw, fy - fw * 0.5 - sw * 0.5, sw, sw * 0.9);
      }
      ctx.fillStyle = "#fde047";
      ctx.font = `900 ${Math.max(8, 16 * scaleAt(fz))}px Orbitron, monospace`;
      ctx.textAlign = "center";
      ctx.fillText("FINISH", fx, fy - fw * 0.62);
    }
    if (p.finishTime !== null) {
      ctx.fillStyle = "rgba(253,224,71,0.9)";
      ctx.font = `900 ${Math.round(W * 0.045)}px Orbitron, monospace`;
      ctx.textAlign = "center";
      ctx.fillText(`FINISHED · ${p.finishTime.toFixed(1)}s`, W / 2, H * 0.24);
    } else {
      // distance-to-finish pip
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = `700 ${Math.round(W * 0.032)}px Orbitron, monospace`;
      ctx.textAlign = "center";
      ctx.fillText(`FINISH ${Math.max(0, Math.ceil(finishRemaining))}m`, W / 2, H * 0.1);
    }
    ctx.restore();
  }
}