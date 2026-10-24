import { sfx } from "./audio";
import {
  getTheme, blendThemes, customToTheme, CYCLE,
  type Theme, type PropKind, type CustomTheme, type Weather,
} from "./themes";
import { TRAILS, getChoice, type BikeId, type HelmetId, type JacketId, type SteeringId, type TrailId, type HornId } from "./garage";
import { drawRiderBody, roundRect as rrPath, type Pose } from "./rider";
import { BIKE_STATS } from "./garage";
import {
  CAR_SPECS, CAR_COLORS, LANE_HALF, NEAR, Z_FAR, GRAV, JUMP_V, RAMP_V, RAIL_H, RAIL_CLEAR,
  POLICE_EVERY, POLICE_FIRST, DIFF, MODE_CURVES, type CarKind, type CarSpec,
} from "./systems/config";
import { chooseWave, pickCarSpec, vehiclePalette } from "./systems/spawning";
import { hazardHit, isPerfectDodge, nearMissGrade, vehicleHit } from "./systems/collisions";
import {
  createFork, createRival, maybeStartFork, mirrorSchedule, policeSchedule, tunnelSchedule,
  updateFork, updateRival, type ForkState, type RivalCourierState,
} from "./systems/events";
import {
  drawDetailedRoad, drawGroundLayer, drawRoadFork, drawSkyScene, type LayerProjection,
} from "./render/layers";
import { drawVehicle } from "./render/vehicles";

import { mulberry32, todaySeed, type Rand } from "./rng";
import type { GhostFrame, ReplayFrame, RunResult } from "./progression";
import {
  DEFAULT_GAMEPAD, type GamepadAction, type ModifierId, type RouteConfig,
  type StationId, activeSeason, weekSeed,
} from "./features";
import { hasEscapeRoute, arrivalWindow, laneDropOrder, type RouteObstacle } from "./fairRoute";
import { analyzeCrash, finishPraise, type CoachTip } from "./coach";
import { drillById } from "./drills";
import { pickPersona, type RivalPersona } from "./rivals";
import { collectiblesForWorld, type CollectibleDef } from "./collectibles";
import type { TrackData, TrackItem } from "./trackcode";
import type { SoundPackId } from "./soundpacks";
import type { GadgetId } from "./gadgets";
import { resolveKeymap, keyMatches, type Keymap, type KeyAction } from "./keymap";
import { isHarborContract } from "./features";

/* ================================================================
   WRONG WAY RIDER — pseudo-3D endless bike runner engine
   ================================================================ */

/** NaN-safe clamp: corrupted settings must never poison the spawn timers. */
const clampNum = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};

/** Killers the coaching module treats as never jumpable. */
const UNJUMPABLE_KILLERS = new Set(["Heavy Truck", "City Bus", "Road Train", "SWAT Gunship", "Police Cruiser", "Cargo Zeppelin"]);

const COOP_P2_LOOK = {
  bikeId: "volt" as const,
  helmetId: "solar" as const,
  jacketId: "lime" as const,
  decal: "none",
  plateText: "P2",
};

export type Phase = "ready" | "playing" | "paused" | "over";
export type Mode =
  | "classic" | "zen" | "timetrial" | "daily" | "tournament" | "practice" | "duel" | "route"
  | "weekly" | "bossrush" | "career" | "coop";
export type Difficulty = "chill" | "normal" | "insane";

export interface Settings {
  themeId: string;
  shake: boolean;
  quality: "high" | "low";
  bikeId: BikeId;
  helmetId: HelmetId;
  jacketId: JacketId;
  trailId: TrailId;
  hornId: HornId;
  steering: SteeringId;
  difficulty: Difficulty;
  mode: Mode;
  dynamicTime: boolean;
  music: boolean;
  haptics: "off" | "light" | "strong";
  colorblind: boolean;
  reduceMotion: boolean;
  lefty: boolean;
  ghostOn: boolean;
  customTheme: CustomTheme | null;
  useCustom: boolean;
  modifiers: ModifierId[];
  route: RouteConfig;
  musicStation: StationId;
  announcer: "arcade" | "hype" | "chill" | "silent";
  hudScale: number;
  hudBottom: number;
  controllerMap: Record<GamepadAction, number>;
  decal: string;
  plateText: string;
  companion: string;
  upgrades: Record<string, number>;
  /** 8x8 pixel painter output: palette indices 0-7, row-major (64 entries); null = stock decal */
  customDecal?: number[] | null;
  autoPauseFocus: boolean;
  assist: boolean;
  tilt: boolean;
  tiltSens: number;
  tiltZero: number;
  newPlayer?: boolean;
  deliveryDistance?: number;
  bikeMastery?: number;
  careerId?: number;
  weekKey?: string;
  autoQuality: boolean;
  showFps: boolean;
  modeOverrides?: Partial<Record<Mode, { steering: SteeringId; hudScale: number; hudBottom: number }>>;
  /* ---- new feature settings ---- */
  soundPack: SoundPackId;
  directionalAudio: boolean;
  heartbeatAudio: boolean;
  /** home garage customization */
  garagePodium: "neon" | "chrome" | "wood" | "marble";
  garageLight: "spot" | "neon" | "sunset" | "midnight";
  garagePoster: "none" | "city" | "race" | "retro";
  garageTrophy: "none" | "bronze" | "silver" | "gold";
  /** practice drill preset id */
  drillId?: string;
  /** custom course from the Track Editor (route mode) */
  track?: TrackData | null;
  /** collectible ids the player already owns — spawns hide those */
  collectiblesOwned?: string[];
  /** 16-step custom horn (semitone offsets, -1 = rest) */
  customHorn?: number[] | null;
  /** pre-run gadgets granted for this run */
  gadgets?: Partial<Record<GadgetId, boolean>>;
  /* ---- v1.0 settings ---- */
  /** extra primary keys per action (arrows + Space always work as alternates) */
  keymap?: Partial<Keymap>;
  /** menu language (DOM UI only; engine HUD stays English) */
  lang?: "en" | "es" | "hi";
  /** idle attract demo on the home screen */
  attract?: boolean;
}

export interface CrashCallout {
  killer: string;
  speedKmh: number;
  comboLost: number;
}

export interface LiveStats {
  score: number;
  coins: number;
  speedKmh: number;
  combo: number;
  bankedCombo: number;
  scorePop: number;
  nitro: number;
  magnet: number;
  warp: number;
  shield: boolean;
  timeLeft: number | null;
  trick: string | null;
  multiplier: number;
  inTunnel: boolean;
  wanted: number;
  sector: number;
  sectorTime: number;
  draft: number;
  brake: number;
  surface: string;
  rescueTickets: number;
  laneClosed: number;
  fps: number;
  inputLatencyMs: number;
  avgLatencyMs: number;
  effectiveQuality: "high" | "low";
  crashCallout: CrashCallout | null;
  nitroMeter: number;
  wheelie: number;
  grinding: boolean;
  grindBalance: number;
  prestigeReady: boolean;
  prestige: boolean;
  weatherFx: string;
  danger: boolean;
  /* ---- new feature stats ---- */
  /** slingshot meter 0..1 */
  sling: number;
  /** active fusion buff name */
  fusion: string | null;
  /** remaining hyperspace warp-zone seconds */
  warpZone: number;
  /** +N toll boost multiplier remaining distance */
  tollBoost: number;
  /** portal shards collected this run (0..3) */
  shards: number;
  /** co-op second rider state (null outside co-op) */
  coop: { p2Lane: number; packageHp: number; p2Alive: boolean } | null;
}

export interface EngineCallbacks {
  onPhase: (phase: Phase) => void;
  onStats: (s: LiveStats) => void;
  onGameOver: (run: RunResult, ghost: GhostFrame[] | null) => void;
}

/* ---------------- vehicles ---------------- */

interface Car {
  lane: number;
  laneF: number;
  z: number;
  speed: number;
  color: string;
  dark: string;
  spec: CarSpec;
  honked: boolean;
  passed: boolean;
  weaver: boolean;
  weaveTo: number;
  weaving: boolean;
  signalT: number;
  flashT: number;
  flung: boolean;
  flyVy: number;
  flyRot: number;
  flyH: number;
}

interface Coin { lane: number; laneF: number; z: number; h: number; spin: number; }
type HazardKind = "pothole" | "cone" | "barrier" | "spikes";
interface Hazard { lane: number; z: number; kind: HazardKind; cleared: boolean; }
type PupKind = "nitro" | "magnet" | "shield" | "warp" | "shard";
interface Pickup { lane: number; z: number; kind: PupKind; spin: number; }
interface Rail { z: number; len: number; }
interface Chaser {
  lane: number;
  laneF: number;
  closeness: number;
  lungeT: number;
  lunging: boolean;
  sway: number;
}
interface Prop { side: number; z: number; kind: PropKind; h: number; hue: number; seed: number; }

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string;
  grav: number; shape: "dot" | "spark" | "smoke" | "ring" | "shard";
}
interface FloatText { x: number; y: number; text: string; life: number; color: string; scale: number; }
interface WeatherBit { x: number; y: number; vx: number; vy: number; s: number; p: number; }

/* ---- new entity types ---- */
/** SWAT gunship encounter state */
interface HeliBoss {
  /** encounter clock in seconds */
  t: number;
  /** total duration before it gives up and leaves */
  dur: number;
  /** lane currently targeted by the crosshair */
  targetLane: number;
  /** crosshair lock timer */
  lockT: number;
  /** spotlight beam lane (jump this or die) */
  beamLane: number;
  beamActive: boolean;
  beamT: number;
  /** whether the escape ramp has been spawned */
  rampSpawned: boolean;
  /** rotor phase for the draw */
  rotor: number;
  /** set once the player clears the beam airborne */
  leapt: boolean;
}
/** desert dust devil crossing the road */
interface DustDevil { z: number; x: number; vx: number; life: number; spin: number; }
/** Cargo Zeppelin finale boss — telegraphed container slams from above */
interface ZepBoss {
  /** encounter clock in seconds */
  t: number;
  /** total duration before it gives up and leaves */
  dur: number;
  /** countdown to the next container slam */
  dropT: number;
  /** telegraphed target lane for the current slam */
  targetLane: number;
  /** telegraph timer: shows the warn glow this long before the slam lands */
  telegraph: number;
  /** swing animation phase for the hanging container */
  swing: number;
  /** successful dodges this encounter */
  strikes: number;
}
/** world collectible pickup */
interface CollectiblePickup { lane: number; z: number; def: CollectibleDef; spin: number; }
/** co-op second rider */
interface CoopRider {
  lane: number;
  px: number;
  tilt: number;
  jumpH: number;
  jumpV: number;
  invuln: number;
  respawnT: number;
  alive: boolean;
}
/** portal shard pickup reuses Pickup with kind "shard" */

interface Trick { kind: "spin" | "whip" | "superman" | "flip"; t: number; dur: number; name: string; }
type SurfaceKind = "asphalt" | "oil" | "gravel" | "wet";
interface SurfacePatch { lane: number; z: number; kind: SurfaceKind; length: number; }
interface TollGate { z: number; taken: boolean; }
interface RoadProp { lane: number; z: number; kind: "cone" | "sign" | "bin" | "board"; broken: boolean; }
interface Boss { z: number; lane: number; phase: number; phaseT: number; }

export class Engine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cb: EngineCallbacks;
  private raf = 0;
  private lastT = 0;
  private W = 0;
  private H = 0;
  private dpr = 1;

  phase: Phase = "ready";
  settings: Settings;
  private theme: Theme;
  private baseTheme: Theme;
  private rand: Rand = Math.random;
  private seed: number | null = null;
  multiplier = 1;

  // world
  private speed = 16;
  private time = 0;
  private distance = 0;
  private roadOffset = 0;
  private cars: Car[] = [];
  private coins: Coin[] = [];
  private hazards: Hazard[] = [];
  private pickups: Pickup[] = [];
  private rails: Rail[] = [];
  private surfaces: SurfacePatch[] = [];
  private tollGates: TollGate[] = [];
  private roadside: RoadProp[] = [];
  private boss: Boss | null = null;
  private props: Prop[] = [];
  private particles: Particle[] = [];
  private texts: FloatText[] = [];
  private weatherBits: WeatherBit[] = [];
  private spawnTimer = 0;
  private coinTimer = 0;
  private hazardTimer = 0;
  private pupTimer = 0;
  private lastFree = 0;
  private sectorIndex = 0;
  private sectorClock = 0;
  private sectorSplits: number[] = [];
  private lastActionAt = -10;
  private actionType: "jump" | "lane" = "lane";
  private lastSurface: SurfaceKind = "asphalt";
  private driftT = 0;
  private brakeT = 0;
  private draftT = 0;
  private tollTimer = 26;
  private convoyTimer = 90;
  private bossTimer = 180;
  private fogT = 0;
  private mirrorT = 0;
  private laneClosed = -2; // -2 = nothing closed; -1..1 are valid closed lanes
  private rescueTickets = 0;
  private rescueUsed = 0;
  private deliveryDamage = 0;
  private deliveryActive = false;
  private perfectCount = 0;
  private tollCount = 0;
  private bestStuntChain = 0;
  private vehicleTypes = new Set<string>();
  private replayFrames: ReplayFrame[] = [];
  private stuntChain = 0;
  private stuntKinds = new Set<string>();
  private replayTimer = 0;
  private roadWarnTimer = 0;
  private surfaceTimer = 7;
  private closedTimer = 0;

  // player
  private lane = 0;
  private px = 0;
  private tilt = 0;
  private wheelSpin = 0;
  private crashed = false;
  private crashT = 0;
  private jumpH = 0;
  private jumpV = 0;
  private airT = 0;
  private trick: Trick | null = null;
  private trickRot = 0;
  private invuln = 0;

  // powerups
  private nitroT = 0;
  private magnetT = 0;
  private warpT = 0;
  private shield = false;

  // events
  private tunnelUntil = 0;
  private nextTunnel = 900;
  private policeT = 0;
  /** Police hunt you down on a 2 minute cadence. */
  private nextPoliceAt = POLICE_EVERY;
  private wanted = 0;
  private chasers: Chaser[] = [];
  private ramCooldown = 0;
  private spotLane = 0;
  private spotTimer = 0;
  private heliX = 0;

  // scoring / stats
  private score = 0;
  private coinsCollected = 0;
  private combo = 0;
  private comboTimer = 0;
  private stats = {
    nearMisses: 0, jumps: 0, carsJumped: 0, policeJumped: 0, stunts: 0,
    airCoins: 0, maxCombo: 0, topSpeed: 0, nitros: 0, shields: 0,
    magnets: 0, warps: 0, ramps: 0, tunnelDistance: 0, chases: 0,
    perfectDodges: 0, tolls: 0, bossWins: 0,
  };

  // juice + directional shake + hitstop + combo bank
  private shakeMag = 0;
  private shakeT = 0;
  private shakeDirX = 0;
  private hitstopT = 0;
  private scorePop = 0;
  private bankedCombo = 0;
  private flashA = 0;
  private flashColor = "255,120,80";
  private slowmo = 1;
  private countdown = 0;
  private camZoom = 1;
  private camZoomTarget = 1;
  private banner = "";
  private crashCallout: CrashCallout | null = null;
  private lastKiller = "Traffic";

  // 1.5s approaching warning geometry before lane closure barrier drops
  private closingLane = -2;
  private closingWarnT = 0;

  // frame-time auto quality + device speed-feel calibration + input latency diagnostics
  private avgFrameMs = 16.7;
  private autoLow = false;
  private frameProbeT = 0;
  private speedFeelBoost = 0;
  private pendingInputAt = 0;
  private lastInputLatencyMs = 0;
  private avgInputLatencyMs = 0;

  // attract mode polish
  private attractT = 0;
  private attractSpawnT = 0;

  // curved road, skill nitro, wheelie, rail grind, prestige, crash cam, assist/tilt
  private curvePhase = 0;
  private nitroMeter = 0;
  private wheelie = false;
  private wheelieT = 0;
  private wheelieTotal = 0;
  private grinding = false;
  private grindBalance = 0;
  private grindTotal = 0;
  private prestige = false;
  private crashCamX = 0;
  private crashLane = 0;
  private assistT = 0;
  private tiltGamma = 0;
  private dangerNow = false;
  private forcedWeather: Weather | null = null;
  private courier: RivalCourierState = createRival(Math.random);
  private fork: ForkState = createFork();

  // ghost
  private ghostRec: GhostFrame[] = [];
  private ghostPlay: GhostFrame[] | null = null;
  private ghostT = 0;
  private ghostCursor = 0;
  /** true once the ghost's burn-out vanish has been triggered (player outlasted it) */
  private ghostBye = false;
  private recTimer = 0;

  // fractional coin credit so percentage coin bonuses actually pay out
  private coinCredit = 0;

  // ============ new feature state ============
  // buffered jump: a jump pressed just before landing fires on touchdown
  private jumpBufferT = 0;
  // slingshot slipstream: charge while drafting oncoming traffic head-on
  private slingMeter = 0;
  private slingActive = 0;
  private slingChain = 0;
  private slingChainT = 0;
  private slingReady = false;
  // power-up synergies (dual-buff fusions)
  private fusionT = 0;
  private fusionKind: "vortex" | "phase" | "singularity" | null = null;
  private fusionsTriggered = 0;
  // toll boost: +1 run multiplier for 500 m after a fast centre pass
  private tollBoostUntil = 0;
  private tollBoostMul = 0;
  private tollBoosts = 0;
  // SWAT gunship milestone boss
  private heli: HeliBoss | null = null;
  private nextHeliAt = 2500;
  private heliWins = 0;
  // Cargo Zeppelin finale boss (Harbor Finale contracts + Boss Rush)
  private zep: ZepBoss | null = null;
  private nextZepAt = Number.POSITIVE_INFINITY;
  // hyperspace warp portal
  private portalShards = 0;
  private warpZoneT = 0;
  private warpZones = 0;
  private warpCoinT = 0;
  // environmental cataclysms
  private lightningT = 0;
  private lightningFlash = 0;
  private aquaplaneT = 0;
  private aquaWarned = false;
  private dustDevils: DustDevil[] = [];
  private devilT = 0;
  // post-run coaching context
  private coachLaneClear: Record<number, number> = { [-1]: 99, 0: 99, 1: 99 };
  private coachClearT = 0;
  private jumpStartT: number | null = null;
  private coaching: CoachTip[] = [];
  // co-op delivery rider
  private p2: CoopRider | null = null;
  private packageHp = 1;
  // pre-run gadgets
  private gadgetArmor = false;
  private gadgetRadar = false;
  private gadgetBeacon = false;
  private gadgetRadarCount = 0;
  private brakeUsed = false;
  private flungPolice = 0;
  private slingshots = 0;
  // track editor script
  private trackCursor = 0;
  // world collectibles
  private collectible: CollectiblePickup | null = null;
  private collectibleSpawned = false;
  private collectedIds: string[] = [];
  // replay event channel for highlight detection
  private replayEventText: string | null = null;
  private replayEventT = 0;
  // drill spec cache (practice mode)
  private drillSpec: ReturnType<typeof drillById> = null;
  // rival persona for the courier
  private persona: RivalPersona | null = null;

  // timed modes
  private timeLeft: number | null = null;

  private touchStart: { x: number; y: number; t: number; used: boolean } | null = null;
  private destroyed = false;
  private padPrev: boolean[] = [];

  constructor(canvas: HTMLCanvasElement, cb: EngineCallbacks, settings: Settings) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.cb = cb;
    this.settings = settings;
    this.baseTheme = this.resolveBaseTheme();
    this.theme = this.baseTheme;
    this.resize();
    this.initProps();
    this.initWeather();
    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    canvas.addEventListener("touchstart", this.onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", this.onTouchMove, { passive: false });
    canvas.addEventListener("touchend", this.onTouchEnd, { passive: false });
    document.addEventListener("visibilitychange", this.onVis);
    window.addEventListener("deviceorientation", this.onTilt);
    this.lastT = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.canvas.removeEventListener("touchstart", this.onTouchStart);
    this.canvas.removeEventListener("touchmove", this.onTouchMove);
    this.canvas.removeEventListener("touchend", this.onTouchEnd);
    document.removeEventListener("visibilitychange", this.onVis);
    window.removeEventListener("deviceorientation", this.onTilt);
    sfx.reset();
    sfx.setDanger(false);
    sfx.stopEngine();
    sfx.stopMusic();
    sfx.stopSiren();
  }

  /* ---------------- public API ---------------- */

  private resolveBaseTheme(): Theme {
    const s = this.settings;
    if (s.useCustom && s.customTheme) return customToTheme(s.customTheme);
    return getTheme(s.themeId);
  }

  private effectiveQuality(): "high" | "low" {
    return this.settings.quality === "low" || (this.settings.autoQuality && this.autoLow)
      ? "low"
      : "high";
  }

  private pCount(high: number, low: number) {
    const base = this.effectiveQuality() === "high" ? high : low;
    return this.settings.reduceMotion ? Math.max(1, Math.round(base * 0.35)) : base;
  }

  private flash(rgb: string, alpha: number) {
    if (this.settings.reduceMotion) return;
    this.flashColor = rgb;
    this.flashA = Math.max(this.flashA, alpha);
  }

  private stampInput() {
    if (this.pendingInputAt === 0) this.pendingInputAt = performance.now();
  }

  applySettings(s: Settings) {
    const prev = this.settings;
    this.settings = s;
    if (!s.autoQuality) this.autoLow = false;
    const nextBase = this.resolveBaseTheme();
    const themeChanged = nextBase.id !== this.baseTheme.id || s.useCustom !== prev.useCustom;
    this.baseTheme = nextBase;
    if (!s.dynamicTime) this.theme = nextBase;
    if (themeChanged) this.initProps();
    if (themeChanged || s.quality !== prev.quality || s.reduceMotion !== prev.reduceMotion) {
      this.initWeather();
    }
    if (s.quality !== prev.quality || s.autoQuality !== prev.autoQuality) this.resize();
    sfx.setMusicEnabled(s.music);
    sfx.setStation(s.musicStation);
    sfx.setSoundPack(s.soundPack);
    sfx.setCustomHorn(s.customHorn ?? null);
  }

  setRescueTickets(count: number) {
    this.rescueTickets = Math.max(0, Math.min(3, count));
  }

  updateCallbacks(cb: Partial<EngineCallbacks>) {
    this.cb = { ...this.cb, ...cb };
  }

  setGhost(frames: GhostFrame[] | null) {
    this.ghostPlay = this.settings.ghostOn ? frames : null;
  }

  /** Stamp a notable event into the replay's event channel (highlight detection). */
  private replayEvent(text: string) {
    this.replayEventText = text;
    this.replayEventT = 0.5;
  }

  setMultiplier(m: number) {
    this.multiplier = m;
  }

  start() {
    this.resetWorld();
    this.setPhase("playing");
    sfx.unlock();
    sfx.startEngine();
    sfx.go();
    if (this.settings.music) sfx.startMusic(this.settings.mode === "zen");
  }

  pause() {
    // Never auto-pause or freeze mid-crash-cam.
    if (this.phase !== "playing" || this.crashed) return;
    this.setPhase("paused");
    sfx.stopEngine();
    sfx.stopMusic();
    sfx.stopSiren();
  }

  resume() {
    if (this.phase !== "paused") return;
    this.countdown = 0.9;
    this.setPhase("playing");
    sfx.startEngine();
    if (this.settings.music) sfx.startMusic(this.settings.mode === "zen");
    if (this.policeT > 0) sfx.startSiren();
  }

  backToMenu() {
    this.resetWorld();
    this.setPhase("ready");
    sfx.stopEngine();
    sfx.stopMusic();
    sfx.stopSiren();
  }

  restart() { this.start(); }

  inputMove(dir: number) { this.stampInput(); this.move(dir); }
  inputJump() { this.stampInput(); this.doJump(); }
  inputDown() { this.stampInput(); this.fastFall(); }
  inputBrake() { this.stampInput(); this.brake(); }
  inputDrift(dir: number) { this.stampInput(); this.driftT = 0.75; this.move(dir); }
  inputHorn() { this.stampInput(); this.honk(); }
  inputBankCombo() { this.stampInput(); this.bankCombo(); }
  /** Co-op rider 2 lane change (on-screen touch controls). */
  inputMoveP2(dir: number) { this.stampInput(); this.moveP2(dir); }
  /** Co-op rider 2 jump (on-screen touch controls). */
  inputJumpP2() { this.stampInput(); this.doJumpP2(); }
  inputWheelie(on: boolean) { this.stampInput(); this.wheelie = on; }

  /** Spend a full skill-nitro bar earned from near-misses, perfects and held slipstream. */
  inputNitro() {
    this.stampInput();
    if (!this.canAct() || this.nitroMeter < 1 || this.nitroT > 0) return;
    this.nitroMeter = 0;
    this.nitroT = 4 + (this.settings.bikeId === "midnight" && (this.settings.bikeMastery ?? 0) >= 3 ? 0.5 : 0);
    this.stats.nitros++;
    sfx.nitro();
    this.addText(this.xAt(this.px, 0.4), this.yAt(0.4) - 140, "SKILL NITRO!", "#ff8c42", 1.2);
    this.flash("255,160,60", 0.45);
    this.juiceEvent(260, 0);
  }

  /** Endless Plus: opt in after 2000 m for doubled score and a higher speed cap. */
  inputPrestige() {
    this.stampInput();
    if (!this.canAct() || this.prestige || !this.prestigeReady()) return;
    this.prestige = true;
    sfx.powerup();
    sfx.announce(this.settings.announcer, "Endless plus");
    this.addText(this.W / 2, this.H * 0.27, "ENDLESS PLUS · ×2 SCORE", "#f472b6", 1.2);
    this.flash("244,114,182", 0.5);
  }

  /** Record the current phone tilt as neutral; returns the value so the UI can persist it. */
  calibrateTilt() {
    return this.tiltGamma;
  }

  grantStartShield() {
    this.shield = true;
    this.addText(this.W / 2, this.H * 0.3, "LOADOUT SHIELD", "#a5f3fc", 0.9);
  }

  private prestigeReady() {
    return !this.prestige && this.distance > 2000 &&
      (this.settings.mode === "classic" || this.settings.mode === "weekly");
  }

  private bikeStats() {
    return BIKE_STATS[this.settings.bikeId] ?? BIKE_STATS.neon;
  }

  private weatherFx(): string {
    if (this.settings.mode === "zen" || this.settings.mode === "practice") return "";
    switch (this.theme.weather) {
      case "rain": return "WET ROAD · slower lane change";
      case "sand": return "SANDSTORM · short visibility";
      case "snow": return "ICY BRAKES · braking drifts";
      default: return "";
    }
  }

  /** Lane with the most room ahead; shared by assist steering and the Scout drone. */
  private safestLane() {
    let best = this.lane;
    let bestDist = -1;
    for (const l of [-1, 0, 1]) {
      if (l === this.laneClosed || l === this.closingLane) continue;
      let nearest = 999;
      for (const c of this.cars) if (c.z > -0.5 && !c.flung && Math.abs(c.laneF - l) < 0.62) nearest = Math.min(nearest, c.z);
      for (const h of this.hazards) if (h.z > -0.5 && h.lane === l) nearest = Math.min(nearest, h.z + 4);
      // slight preference to stay put so the assist does not twitch
      const score = nearest + (l === this.lane ? 3 : 0) - Math.abs(l - this.lane) * 1.5;
      if (score > bestDist) { bestDist = score; best = l; }
    }
    return best;
  }

  private onTilt = (e: DeviceOrientationEvent) => {
    if (typeof e.gamma === "number") this.tiltGamma = e.gamma;
  };

  /* ---------------- internals ---------------- */

  private setPhase(p: Phase) {
    this.phase = p;
    this.cb.onPhase(p);
  }

  private diff() {
    // Zen is a true cruise: slow cap, gentle ramp, wide gaps, no heavies, rare hazards.
    if (this.settings.mode === "zen") {
      return { cap: 27, ramp: 0.15, gap: 37, gapMin: 31, doubles: 0.07, heavy: false, hazard: 13 };
    }
    if (this.settings.mode === "practice") {
      return { cap: 24, ramp: 0.08, gap: 42, gapMin: 38, doubles: 0, heavy: false, hazard: 30 };
    }
    return DIFF[this.settings.difficulty];
  }

  private resetWorld() {
    const mode = this.settings.mode;
    this.seed = mode === "daily" ? todaySeed()
      : mode === "weekly" ? weekSeed(this.settings.weekKey)
      : this.settings.route.seed || null;
    this.rand = this.seed !== null ? mulberry32(this.seed) : Math.random;

    this.speed = 16;
    this.time = 0;
    this.distance = 0;
    this.cars = [];
    this.coins = [];
    this.hazards = [];
    this.pickups = [];
    this.rails = [];
    this.surfaces = [];
    this.tollGates = [];
    this.roadside = [];
    this.boss = null;
    this.particles = [];
    this.texts = [];
    this.spawnTimer = 1.0;
    this.coinTimer = 2.0;
    this.hazardTimer = 6.5;
    this.pupTimer = 9;
    this.sectorIndex = 0;
    this.sectorClock = 0;
    this.sectorSplits = [];
    this.lastActionAt = -10;
    this.actionType = "lane";
    this.lastSurface = "asphalt";
    this.driftT = 0;
    this.brakeT = 0;
    this.draftT = 0;
    this.tollTimer = 22;
    this.convoyTimer = 70;
    this.bossTimer = mode === "bossrush" ? 4 : 180;
    if (mode === "bossrush") this.convoyTimer = 12;
    this.curvePhase = 0;
    this.nitroMeter = 0;
    this.wheelie = false;
    this.wheelieT = 0;
    this.wheelieTotal = 0;
    this.grinding = false;
    this.grindBalance = 0;
    this.grindTotal = 0;
    this.prestige = false;
    this.crashCamX = 0;
    this.crashLane = 0;
    this.assistT = 0;
    this.dangerNow = false;
    sfx.setDanger(false);
    sfx.setBikeTone(this.settings.bikeId);
    this.courier = createRival(this.rand);
    if (this.persona) {
      this.courier.name = this.persona.name;
      this.courier.tagline = this.persona.tagline;
      this.courier.persona = {
        moodMin: this.persona.moodInterval[0],
        moodMax: this.persona.moodInterval[1],
        laneChase: this.persona.laneChase,
        speedBias: this.persona.speedBias,
      };
    }
    this.fork = createFork(650 + this.rand() * 250);
    this.fogT = 0;
    this.mirrorT = 0;
    this.laneClosed = -1;
    this.rescueUsed = 0;
    this.deliveryDamage = 0;
    this.deliveryActive = mode === "route" || mode === "career" || mode === "coop";
    if (mode === "coop") this.settings.deliveryDistance = this.settings.deliveryDistance ?? 2000;
    this.perfectCount = 0;
    this.tollCount = 0;
    this.bestStuntChain = 0;
    this.vehicleTypes = new Set<string>();
    this.replayFrames = [];
    this.stuntChain = 0;
    this.stuntKinds = new Set<string>();
    this.replayTimer = 0;
    this.roadWarnTimer = 0;
    this.surfaceTimer = 6;
    this.closedTimer = 0;
    this.lane = 0;
    this.px = 0;
    this.tilt = 0;
    this.crashed = false;
    this.crashT = 0;
    this.jumpH = 0;
    this.jumpV = 0;
    this.airT = 0;
    this.trick = null;
    this.trickRot = 0;
    this.invuln = 0;
    this.nitroT = 0;
    this.magnetT = 0;
    this.warpT = 0;
    this.shield = (this.settings.upgrades.shield ?? 0) > 0;
    this.tunnelUntil = 0;
    this.nextTunnel = 900;
    this.policeT = 0;
    this.nextPoliceAt = POLICE_FIRST;
    this.wanted = 0;
    this.chasers = [];
    this.ramCooldown = 0;
    this.spotLane = 0;
    this.spotTimer = 0;
    this.score = 0;
    this.coinsCollected = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.stats = {
      nearMisses: 0, jumps: 0, carsJumped: 0, policeJumped: 0, stunts: 0,
      airCoins: 0, maxCombo: 0, topSpeed: 0, nitros: 0, shields: 0,
      magnets: 0, warps: 0, ramps: 0, tunnelDistance: 0, chases: 0,
      perfectDodges: 0, tolls: 0, bossWins: 0,
    };
    this.shakeMag = 0;
    this.shakeDirX = 0;
    this.hitstopT = 0;
    this.scorePop = 0;
    this.bankedCombo = 0;
    this.closingLane = -2;
    this.closingWarnT = 0;
    this.crashCallout = null;
    this.lastKiller = "Traffic";
    this.flashA = 0;
    this.slowmo = 1;
    this.countdown = 0;
    this.camZoom = 1;
    this.camZoomTarget = 1;
    this.banner = "";
    this.lastFree = 0;
    this.ghostRec = [];
    this.ghostT = 0;
    this.ghostCursor = 0;
    this.ghostBye = false;
    this.recTimer = 0;
    this.coinCredit = 0;
    // new feature state
    this.jumpBufferT = 0;
    this.slingMeter = 0;
    this.slingActive = 0;
    this.slingChain = 0;
    this.slingChainT = 0;
    this.slingReady = false;
    this.fusionT = 0;
    this.fusionKind = null;
    this.fusionsTriggered = 0;
    this.tollBoostUntil = 0;
    this.tollBoostMul = 0;
    this.tollBoosts = 0;
    this.heli = null;
    this.nextHeliAt = 2500;
    this.heliWins = 0;
    this.zep = null;
    // the zeppelin owns harbor airspace (career contracts 13+) and shows up in Boss Rush
    if (this.settings.mode === "bossrush") this.nextZepAt = 900;
    else if (isHarborContract(this.settings.careerId)) {
      this.nextZepAt = Math.max(500, (this.settings.deliveryDistance ?? 2400) * 0.4);
    } else this.nextZepAt = Number.POSITIVE_INFINITY;
    this.portalShards = 0;
    this.warpZoneT = 0;
    this.warpZones = 0;
    this.warpCoinT = 0;
    this.lightningT = 6 + this.rand() * 8;
    this.lightningFlash = 0;
    this.aquaplaneT = 0;
    this.aquaWarned = false;
    this.dustDevils = [];
    this.devilT = 14 + this.rand() * 10;
    this.coachLaneClear = { [-1]: 99, 0: 99, 1: 99 };
    this.coachClearT = 0;
    this.jumpStartT = null;
    this.coaching = [];
    this.packageHp = 1;
    this.p2 = mode === "coop"
      ? { lane: 1, px: 1, tilt: 0, jumpH: 0, jumpV: 0, invuln: 2, respawnT: 0, alive: true }
      : null;
    this.gadgetArmor = !!this.settings.gadgets?.spikeArmor;
    this.gadgetRadar = !!this.settings.gadgets?.coinRadar;
    this.gadgetBeacon = !!this.settings.gadgets?.ghostBeacon;
    this.gadgetRadarCount = 0;
    this.brakeUsed = false;
    this.flungPolice = 0;
    this.slingshots = 0;
    this.trackCursor = 0;
    this.collectible = null;
    this.collectibleSpawned = false;
    this.collectedIds = [];
    this.replayEventText = null;
    this.replayEventT = 0;
    this.drillSpec = mode === "practice" && this.settings.drillId ? drillById(this.settings.drillId) : null;
    this.persona = pickPersona(this.rand);
    this.timeLeft = mode === "timetrial" || mode === "tournament" ? 60 : null;
    this.theme = this.baseTheme;
    // Route/Career weather and the Downpour modifier pin weather so the day/night cycle cannot erase it.
    this.forcedWeather = this.settings.modifiers.includes("heavy-rain") ? "rain"
      : (mode === "route" || mode === "career") && this.settings.route.weather !== "none" ? this.settings.route.weather
      : null;
    if (this.forcedWeather) {
      this.theme = { ...this.theme, weather: this.forcedWeather };
    }
    if (this.settings.modifiers.includes("heavy-rain")) {
      this.theme = { ...this.theme, weather: "rain", weatherColor: "rgba(170,210,255,0.65)" };
    }
    this.initWeather();
    sfx.setTunnel(false);
    sfx.setComboLayer(0);
  }

  /** Theme prop, with a 25% chance of a seasonal prop when a season is active. */
  private pickProp(kinds: PropKind[]): PropKind {
    const season = activeSeason();
    if (season && Math.random() < 0.25) {
      const map: Record<string, PropKind> = {
        halloween: "pumpkin", winter: "gift", spring: "lilypad", summer: "firework",
      };
      return map[season.id] ?? kinds[0];
    }
    return kinds[Math.floor(Math.random() * kinds.length)];
  }

  private initProps() {
    const kinds = this.theme.props;
    this.props = [];
    for (let i = 0; i < 30; i++) {
      this.props.push({
        side: i % 2 === 0 ? -1 : 1,
        z: (i / 30) * Z_FAR,
        kind: this.pickProp(kinds),
        h: 0.7 + Math.random() * 0.75,
        hue: Math.random() * 360,
        seed: Math.random() * 1000,
      });
    }
  }

  private initWeather() {
    const t = this.theme;
    this.weatherBits = [];
    if (t.weather === "none") return;
    const base = (this.effectiveQuality() === "high" ? 1 : 0.42) * (this.settings.reduceMotion ? 0.35 : 1);
    const counts: Record<string, number> = {
      rain: 150, snow: 110, petals: 55, sand: 90, fireflies: 40, ash: 70,
    };
    const n = Math.round((counts[t.weather] ?? 60) * base);
    for (let i = 0; i < n; i++) this.weatherBits.push(this.makeBit(true));
  }

  private makeBit(initial = false): WeatherBit {
    const t = this.theme.weather;
    const x = Math.random() * (this.W + 120) - 60;
    const y = initial ? Math.random() * this.H : -20;
    if (t === "rain") return { x, y, vx: -90, vy: 900 + Math.random() * 420, s: 10 + Math.random() * 14, p: 0 };
    if (t === "snow") return { x, y, vx: -20, vy: 55 + Math.random() * 70, s: 1.4 + Math.random() * 2.8, p: Math.random() * 6 };
    if (t === "petals") return { x, y, vx: -60, vy: 60 + Math.random() * 60, s: 3 + Math.random() * 4, p: Math.random() * 6 };
    if (t === "sand") return { x, y: Math.random() * this.H, vx: -340 - Math.random() * 260, vy: 10, s: 1 + Math.random() * 2, p: 0 };
    if (t === "fireflies") return { x, y: Math.random() * this.H, vx: -14, vy: -8, s: 2 + Math.random() * 2, p: Math.random() * 6 };
    return { x, y, vx: -40, vy: 30 + Math.random() * 50, s: 1.5 + Math.random() * 2.5, p: Math.random() * 6 };
  }

  private resize = () => {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return; // detached canvas — nothing to size
    const maxDpr = this.effectiveQuality() === "high" ? 2 : 1.25;
    this.dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    this.W = rect.width;
    this.H = rect.height;
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    this.canvas.style.width = rect.width + "px";
    this.canvas.style.height = rect.height + "px";
  };

  private onVis = () => {
    if (document.hidden && this.phase === "playing" && !this.crashed && this.settings.autoPauseFocus) {
      this.pause();
    }
  };

  private onBlur = () => {
    if (this.phase === "playing" && !this.crashed && this.settings.autoPauseFocus) {
      this.pause();
    }
  };

  private buzz(ms: number | number[]) {
    const h = this.settings.haptics;
    if (h === "off" || !navigator.vibrate) return;
    const scale = h === "strong" ? 1.8 : 1;
    const pat = Array.isArray(ms) ? ms.map((v) => Math.round(v * scale)) : Math.round(ms * scale);
    navigator.vibrate(pat);
  }

  private bankCombo() {
    if (!this.canAct() || this.combo < 2 || this.bankedCombo > 0) return;
    this.bankedCombo = this.combo;
    this.combo = 0;
    this.comboTimer = 0;
    sfx.bank();
    const x = this.xAt(this.px, 0.35);
    const y = this.yAt(0.35) - 135;
    this.addText(x, y, `BANKED ×${this.bankedCombo}!`, "#67e8f9", 1.05);
    this.buzz(15);
  }

  /* ---------------- input ---------------- */

  private onKey = (e: KeyboardEvent) => {
    if (e.repeat) return; // OS key auto-repeat must not toggle pause/jump
    const k = e.key;
    const coop = this.settings.mode === "coop";
    if (this.phase === "playing") {
      this.stampInput();
      // Co-op: arrows drive rider 2; WASD/space stay with rider 1.
      if (coop && (k.startsWith("Arrow") || k === " ")) {
        if (k === "ArrowLeft") this.moveP2(-1);
        else if (k === "ArrowRight") this.moveP2(1);
        else if (k === "ArrowUp") this.doJumpP2();
        else if (k === "ArrowDown") this.doJumpP2();
        e.preventDefault();
        return;
      }
      // remappable keys (v1.0): arrows + Space stay hardcoded alternates so
      // a bad remap can never lock a player out of steering or jumping
      const km = resolveKeymap(this.settings.keymap);
      const hit = (a: KeyAction) => keyMatches(k, km[a]);
      if (k === "ArrowLeft" || hit("left")) { this.move(-1); e.preventDefault(); }
      else if (k === "ArrowRight" || hit("right")) { this.move(1); e.preventDefault(); }
      else if (k === "ArrowUp" || k === " " || hit("jump")) { this.doJump(); e.preventDefault(); }
      else if (k === "ArrowDown" || hit("down")) { this.fastFall(); e.preventDefault(); }
      else if (hit("horn")) this.honk();
      else if (hit("bank") || k === "e" || k === "E") this.bankCombo();
      else if (hit("nitro")) this.inputNitro();
      else if (hit("wheelie")) this.wheelie = true;
      else if (hit("prestige")) this.inputPrestige();
      else if (hit("sling")) this.fireSlingshot();
      else if (k === "Shift" || hit("drift")) this.driftT = 0.8;
      else if (hit("flip")) { this.startTrick("flip"); }
      else if (k === "Escape" || hit("pause")) { this.pause(); }
    } else if (this.phase === "paused") {
      // a modal panel (garage/settings/…) is open: Escape there closes the panel,
      // it must not also resume the run
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (k === "p" || k === "P" || k === "Escape" || k === " " || k === "Enter") this.resume();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const km = resolveKeymap(this.settings.keymap);
    if (e.key === "Shift" || keyMatches(e.key, km.drift)) this.driftT = 0;
    if (e.key === "q" || e.key === "Q" || keyMatches(e.key, km.wheelie)) this.wheelie = false;
  };

  private onTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    const t = e.touches[0];
    this.touchStart = { x: t.clientX, y: t.clientY, t: performance.now(), used: false };
  };

  private onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    if (!this.touchStart) return;
    const t = e.touches[0];
    const dx = t.clientX - this.touchStart.x;
    const dy = t.clientY - this.touchStart.y;
    if (Math.abs(dy) > 48 && Math.abs(dy) > Math.abs(dx) * 1.1) {
      this.stampInput();
      if (dy < 0) this.doJump();
      else this.fastFall();
      this.touchStart = { x: t.clientX, y: t.clientY, t: performance.now(), used: true };
      return;
    }
    if (Math.abs(dx) > this.swipeThreshold()) {
      this.stampInput();
      this.move(dx > 0 ? 1 : -1);
      this.touchStart = { x: t.clientX, y: t.clientY, t: performance.now(), used: true };
    }
  };

  private onTouchEnd = (e: TouchEvent) => {
    e.preventDefault();
    if (!this.touchStart) return;
    const dt = performance.now() - this.touchStart.t;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - this.touchStart.x;
    const dy = touch.clientY - this.touchStart.y;
    if (!this.touchStart.used && dt < 280 && Math.abs(dx) < 14 && Math.abs(dy) < 14 && this.phase === "playing") {
      this.stampInput();
      if (touch.clientY < this.H * 0.38) this.doJump();
      else this.move(touch.clientX > this.W / 2 ? 1 : -1);
    }
    this.touchStart = null;
  };

  private pollGamepad() {
    if (this.phase !== "playing" || !navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    const gp = pads && pads[0];
    if (!gp) return;
    const pressed: boolean[] = [];
    const map = this.settings.controllerMap ?? DEFAULT_GAMEPAD;
    const down = (i: number) => !!gp.buttons[i]?.pressed;
    const axis = gp.axes[0] ?? 0;
    pressed[0] = down(map.left) || axis < -0.55;
    pressed[1] = down(map.right) || axis > 0.55;
    pressed[2] = down(map.jump);
    pressed[3] = down(map.brake);
    pressed[4] = down(map.horn);
    pressed[5] = down(map.pause);
    pressed[6] = down(3); // Y / Triangle banks combo
    if (pressed[0] && !this.padPrev[0]) { this.stampInput(); this.move(-1); }
    if (pressed[1] && !this.padPrev[1]) { this.stampInput(); this.move(1); }
    if (pressed[2] && !this.padPrev[2]) { this.stampInput(); this.doJump(); }
    if (pressed[3] && !this.padPrev[3]) { this.stampInput(); this.fastFall(); }
    if (pressed[4] && !this.padPrev[4]) { this.stampInput(); this.honk(); }
    if (pressed[5] && !this.padPrev[5]) { this.stampInput(); this.pause(); }
    if (pressed[6] && !this.padPrev[6]) { this.stampInput(); this.bankCombo(); }
    this.padPrev = pressed;
  }

  private canAct() {
    return this.phase === "playing" && !this.crashed && this.countdown <= 0.35;
  }

  private swipeThreshold() {
    if (this.settings.steering === "quick") return 36;
    if (this.settings.steering === "balanced") return 52;
    return 70;
  }

  /** Remaining airtime in seconds for the current jump arc. */
  private airRemaining() {
    if (this.jumpH <= 0) return 0;
    const v = this.jumpV;
    return (v + Math.sqrt(Math.max(0, v * v + 2 * GRAV * this.jumpH))) / GRAV;
  }

  private move(dir: number) {
    if (!this.canAct()) return;
    if (this.grinding) {
      // on a rail, steering leans against the balance meter instead of changing lane
      this.grindBalance -= dir * 0.38;
      sfx.swoosh();
      return;
    }
    const airborne = this.jumpH > 0.1;
    if (this.mirrorT > 0) dir *= -1;
    const next = Math.max(-1, Math.min(1, this.lane + dir));
    if (next !== this.lane) {
      this.lane = next;
      this.lastActionAt = this.time;
      this.actionType = "lane";
      sfx.swoosh();
      if (!airborne) this.spawnDust();
      if (this.driftT > 0) {
        this.score += Math.round(18 * this.multiplier);
        this.addText(this.xAt(this.px, 0.3), this.yAt(0.3) - 110, "DRIFT +18", "#f9a8d4", 0.8);
      }
    } else {
      this.tilt += dir * 0.18;
    }
    if (airborne) this.startTrick(dir > 0 ? "spin" : "whip");
  }

  private doJump() {
    if (!this.canAct()) return;
    if (this.settings.modifiers.includes("no-jump")) return;
    if (this.jumpH > 0.02) {
      // Buffered jump: pressed just before landing — remember it and fire on
      // touchdown. Only the last ~130 ms of the descent counts, so rapid
      // sequences feel forgiving without changing normal jump timing.
      if (this.jumpV < 0 && this.airRemaining() < 0.13) this.jumpBufferT = 0.14;
      return;
    }
    // slingshot release: a full charge converts the jump into a fiery burst
    if (this.slingReady) {
      this.fireSlingshot();
      return;
    }
    const jumpBoost = 1 + (this.settings.upgrades.jump ?? 0) * 0.08;
    this.jumpV = JUMP_V * jumpBoost * this.bikeStats().jump;
    this.wheelie = false;
    this.jumpH = 0.001;
    this.airT = 0;
    this.jumpStartT = this.time;
    this.stats.jumps++;
    this.lastActionAt = this.time;
    this.actionType = "jump";
    sfx.jump();
    this.puffRing();
    this.buzz(12);
  }

  /** Release a full slingshot charge: fiery burst + brief invulnerability. */
  private fireSlingshot() {
    if (!this.canAct() || !this.slingReady) return;
    this.slingReady = false;
    this.slingMeter = 0;
    this.slingActive = 1.35;
    this.invuln = Math.max(this.invuln, 1.1);
    this.slingshots++;
    this.slingChainT = 4;
    this.slingChain = Math.min(5, this.slingChain + 1);
    const chainBonus = Math.round((220 + this.slingChain * 130) * this.multiplier);
    this.score += chainBonus;
    this.addText(this.xAt(this.px, 0.4), this.yAt(0.4) - 165, `SLINGSHOT! ${this.slingChain > 1 ? `×${this.slingChain} ` : ""}+${chainBonus}`, "#ff8c42", 1.25);
    this.replayEvent("SLINGSHOT!");
    sfx.slingshot();
    this.flash("255,120,40", 0.5);
    this.juiceEvent(chainBonus, 0);
    this.buzz([25, 30, 45]);
    // launch forward: a real jump so the burst threads between oncoming cars
    const jumpBoost = 1 + (this.settings.upgrades.jump ?? 0) * 0.08;
    this.jumpV = JUMP_V * jumpBoost * this.bikeStats().jump * 1.08;
    this.jumpH = 0.001;
    this.airT = 0;
    this.stats.jumps++;
    this.lastActionAt = this.time;
    this.actionType = "jump";
    // fiery wake
    const x = this.xAt(this.px, 0);
    const y = this.yAt(0);
    for (let i = 0; i < this.pCount(26, 13); i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
      this.particles.push({
        x, y: y - 30, vx: (Math.random() - 0.5) * 220, vy: Math.sin(a) * 300 + 120,
        life: 0.5 + Math.random() * 0.4, maxLife: 0.9, size: 3 + Math.random() * 6,
        color: ["#ff8c42", "#ffd166", "#ff5e62"][Math.floor(Math.random() * 3)], grav: -80, shape: "spark",
      });
    }
  }

  /** Co-op rider 2 lane change. */
  private moveP2(dir: number) {
    const p = this.p2;
    if (!p || !p.alive || this.phase !== "playing") return;
    const next = Math.max(-1, Math.min(1, p.lane + dir));
    if (next !== p.lane) {
      p.lane = next;
      sfx.swoosh();
    }
  }

  /** Co-op rider 2 jump. */
  private doJumpP2() {
    const p = this.p2;
    if (!p || !p.alive || this.phase !== "playing") return;
    if (p.jumpH > 0.02) return;
    p.jumpV = JUMP_V;
    p.jumpH = 0.001;
    sfx.jump();
  }

  private fastFall() {
    if (!this.canAct()) return;
    if (this.jumpH > 0.05) {
      this.jumpV = Math.min(this.jumpV, -1) - 2.6;
      sfx.swoosh();
      this.startTrick("superman");
    } else {
      this.brake();
    }
  }

  private brake() {
    if (!this.canAct() || this.jumpH > 0.08) return;
    this.brakeT = Math.max(this.brakeT, 0.75);
    this.brakeUsed = true;
    this.driftT = 0;
  }

  private honk() {
    if (this.phase !== "playing") return;
    sfx.horn(this.settings.hornId);
    // nearby traffic reacts: flash high beams and twitch aside
    for (const c of this.cars) {
      if (c.z < 32 && c.z > 0) {
        c.flashT = 0.9;
        const away = c.laneF >= this.px ? 1 : -1;
        c.laneF += away * 0.06;
      }
    }
  }

  /* ---------------- stunts ---------------- */

  private startTrick(kind: Trick["kind"]) {
    if (!this.canAct() || this.jumpH < 0.12 || this.trick) return;
    const table: Record<Trick["kind"], { dur: number; name: string }> = {
      spin: { dur: 0.34, name: "360 SPIN" },
      whip: { dur: 0.3, name: "TAILWHIP" },
      superman: { dur: 0.36, name: "SUPERMAN" },
      flip: { dur: 0.42, name: "BACKFLIP" },
    };
    const def = table[kind];
    // Only commit if the arc can finish it — fast-falling afterwards is the real risk.
    if (this.airRemaining() < def.dur * 0.92) return;
    this.trick = { kind, t: 0, dur: def.dur, name: def.name };
    this.trickRot = 0;
    sfx.stunt(this.stats.stunts);
  }

  private finishTrick(landed: boolean) {
    const tr = this.trick;
    if (!tr) return;
    this.trick = null;
    this.trickRot = 0;
    if (!landed) return;
    this.stats.stunts++;
    this.stuntKinds.add(tr.kind);
    this.stuntChain = this.stuntKinds.size;
    this.bestStuntChain = Math.max(this.bestStuntChain, this.stuntChain);
    const voltPassive = this.settings.bikeId === "volt" && (this.settings.bikeMastery ?? 0) >= 3 ? 1.1 : 1;
    const bonus = Math.round((120 + this.stuntChain * 55) * this.multiplier * voltPassive);
    this.score += bonus;
    const x = this.xAt(this.px, 0);
    const y = this.yAt(0) - 170;
    this.addText(x, y, this.stuntChain > 1 ? `${tr.name} ×${this.stuntChain}` : tr.name, "#a5f3fc", 1.05);
    this.addText(x, y + 30, `+${bonus}`, "#7cffc4", 0.85);
    this.spawnSparks(x, y + 60, 14, ["#a5f3fc", "#ffffff", "#c4b5fd"]);
    this.shake(5, 0.18);
  }

  /* ---------------- projection ---------------- */

  private roadHalf() { return Math.min(this.W, 700) * 0.5; }
  private horizonY() { return this.H * 0.36; }
  private scaleAt(z: number) { return NEAR / (NEAR + Math.max(z, -NEAR * 0.75)); }
  private yAt(z: number) {
    const s = this.scaleAt(z);
    return this.horizonY() + (this.H * 0.985 - this.horizonY()) * s;
  }
  private xAt(laneUnits: number, z: number) {
    const s = this.scaleAt(z);
    return this.W / 2 + laneUnits * (this.roadHalf() * (2 / 3)) * s + this.curveOffset(z);
  }

  /** Gentle S-curve: zero at the rider, bending toward the horizon. */
  private curveOffset(z: number) {
    const depth = 1 - this.scaleAt(Math.max(0, z));
    const amp = this.W * 0.16 * (this.settings.reduceMotion ? 0.35 : 1);
    return depth * depth * amp * Math.sin(this.curvePhase);
  }
  private airOffset(h: number, z: number) {
    return h * 168 * this.scaleAt(z) * Math.min(this.H / 700, 1.25);
  }

  /* ---------------- spawning ---------------- */

  private pickSpec(): CarSpec {
    return pickCarSpec(this.rand, {
      allowHeavy: this.diff().heavy,
      time: this.time,
    });
  }

  private hasCollectibleConflict(lane: number, arrivalTime: number) {
    return this.coins.some((coin) => {
      if (coin.lane !== lane || coin.h > 0.8) return false;
      return Math.abs(coin.z / Math.max(this.speed, 1) - arrivalTime) < 1.25;
    });
  }

  private safeCoinLanes(zStart: number) {
    const coinArrival = zStart / Math.max(this.speed, 1);
    return [-1, 0, 1].filter((lane) => {
      const carConflict = this.cars.some((car) => {
        if (car.lane !== lane) return false;
        return Math.abs(car.z / Math.max(this.speed + car.speed, 1) - coinArrival) < 1.5;
      });
      const hazardConflict = this.hazards.some((h) => {
        if (h.lane !== lane) return false;
        return Math.abs(h.z / Math.max(this.speed, 1) - coinArrival) < 1.1;
      });
      return !carConflict && !hazardConflict;
    });
  }

  private carClearHeight(car: Car) {
    switch (car.spec.kind) {
      case "sports": return 0.25;
      case "sedan": case "taxi": case "police": return 0.32;
      case "van": case "ambulance": return 0.42;
      case "flatbed": return 0.5;
      case "moto": return 0.2;
      // Heavy traffic is never clearable with a normal jump.
      default: return Number.POSITIVE_INFINITY;
    }
  }

  /** Build the fair-route obstacle list from everything currently inbound. */
  private routeObstacles(extraLanes: number[] = []): RouteObstacle[] {
    const out: RouteObstacle[] = [];
    const addLaneBlock = (lane: number, fromT: number, toT: number, clearH: number) => {
      if (fromT >= 0 && toT > fromT) out.push({ lane, fromT, toT, clearH });
    };
    for (const c of this.cars) {
      if (c.flung || c.z <= 0.5 || c.z > Z_FAR + 8) continue;
      const closing = this.speed + c.speed;
      const { fromT, toT } = arrivalWindow(c.z, closing, 0.6);
      addLaneBlock(Math.round(c.laneF), fromT, toT, this.carClearHeight(c));
    }
    for (const hz of this.hazards) {
      if (hz.z <= 0.5 || hz.z > Z_FAR) continue;
      const { fromT, toT } = arrivalWindow(hz.z, this.speed, 0.5);
      addLaneBlock(hz.lane, fromT, toT, Number.POSITIVE_INFINITY);
    }
    // proposed new wave lanes count as future blockers
    for (const lane of extraLanes) {
      const { fromT, toT } = arrivalWindow(Z_FAR + 3, this.speed + 12, 0.7);
      addLaneBlock(lane, fromT, toT, Number.POSITIVE_INFINITY);
    }
    // a closed lane is dead for as long as the closure lasts
    if (this.laneClosed >= -1 && this.closedTimer > 0) {
      addLaneBlock(this.laneClosed, 0, this.closedTimer, Number.POSITIVE_INFINITY);
    }
    // road train: only its open lane is safe while it sweeps
    if (this.boss && this.boss.z > 2 && this.boss.z < Z_FAR) {
      const open = this.boss.phase === 2 ? this.boss.lane : Math.max(-1, Math.min(1, this.boss.lane + (this.boss.phase === 0 ? -1 : 1)));
      const eta = this.boss.z / Math.max(1, this.speed);
      for (const lane of [-1, 0, 1]) {
        if (lane !== open) addLaneBlock(lane, Math.max(0, eta - 1.2), eta + 1.2, Number.POSITIVE_INFINITY);
      }
    }
    return out;
  }

  private spawnWave() {
    const d = this.diff();
    const isZen = this.settings.mode === "zen";
    const lanes = [-1, 0, 1];
    const curve = MODE_CURVES[this.settings.mode];
    const closed = this.laneClosed;
    const available = closed >= -1 && this.closedTimer > 0 && this.settings.modifiers.includes("closed-lane")
      ? lanes.filter((l) => l !== closed)
      : lanes;
    const routeFactor = clampNum(this.settings.route.traffic, 0.55, 1.6, 1);
    const doubleChance = this.time > (isZen ? 34 : 12)
      ? Math.min(0.1 + this.time * 0.004 * curve.doubleMul, d.doubles * curve.doubleMul) * routeFactor
      : 0;

    // practice drills replace the wave table with a focused car filter
    if (this.drillSpec) {
      const spec = this.drillSpec.spec;
      const lane = lanes[Math.floor(this.rand() * lanes.length)];
      this.spawnDrillCar(lane, spec.cars);
      if (this.rand() < 0.5) this.spawnDrillCar(lanes[Math.floor(this.rand() * lanes.length)], spec.cars);
      if (spec.ramps && this.rand() < 0.35) this.spawnDrillCar(lanes[Math.floor(this.rand() * lanes.length)], ["flatbed"]);
      return;
    }

    const wave = chooseWave(this.rand, this.lastFree, doubleChance, available);
    let free = wave.freeLane;
    let occupied = [...wave.occupied];

    // ---- Fair-Route Validator: never allow an unescapable pattern ----
    if (!isZen && available.length === 3) {
      const startLane = Math.abs(this.px - this.lane) < 0.5 ? this.lane : this.lane;
      let attempts = 0;
      while (occupied.length && !hasEscapeRoute(this.routeObstacles(occupied), {
        lanes: available,
        startLane,
        laneChangeTime: 0.34,
        horizon: 7,
        step: 0.25,
      })) {
        // strip the lane farthest from the escape lane and re-check
        const drop = laneDropOrder(occupied, free)[0];
        occupied = occupied.filter((l) => l !== drop);
        attempts++;
        if (attempts > 2) break;
      }
    }
    this.lastFree = free;

    for (const lane of occupied) {
      const spec = this.pickSpec();
      const carEta = Z_FAR / (this.speed + (spec.spd[0] + spec.spd[1]) / 2);
      const clash = this.hazards.some(
        (hz) => hz.lane === lane && Math.abs(hz.z / this.speed - carEta) < 0.7
      );
      if (clash || this.hasCollectibleConflict(lane, carEta)) continue;

      const [color, dark] = vehiclePalette(spec.kind, this.rand);
      this.vehicleTypes.add(spec.kind);
      const weaver = !isZen && ((spec.kind === "sports" && this.time > 15 && this.rand() < 0.45) || spec.kind === "moto");
      const weaveTo = weaver
        ? (lane === free ? lane : free)
        : lane;
      this.cars.push({
        lane, laneF: lane,
        z: Z_FAR + this.rand() * 6,
        speed: (spec.spd[0] + this.rand() * (spec.spd[1] - spec.spd[0])) *
          (isZen ? 0.7 : this.settings.modifiers.includes("speed-demons") ? 1.25 : 1),
        color,
        dark,
        spec, honked: false, passed: false,
        weaver, weaveTo, weaving: false, signalT: 0, flashT: 0,
        flung: false, flyVy: 0, flyRot: 0, flyH: 0,
      });
    }
    if (this.rand() < 0.4 && this.safeCoinLanes(Z_FAR + 10).includes(free)) {
      this.spawnCoinLine(free, Z_FAR + 10, 0);
    }
  }

  /** Spawn a drill-specific vehicle kind (practice mode only). */
  private spawnDrillCar(lane: number, kinds: string[]) {
    const spec = kinds.length
      ? CAR_SPECS.find((s) => kinds.includes(s.kind)) ?? CAR_SPECS[0]
      : this.pickSpec();
    const [color, dark] = vehiclePalette(spec.kind, this.rand);
    this.vehicleTypes.add(spec.kind);
    this.cars.push({
      lane, laneF: lane,
      z: Z_FAR + this.rand() * 6,
      speed: spec.spd[0] + this.rand() * (spec.spd[1] - spec.spd[0]),
      color, dark, spec,
      honked: false, passed: false,
      weaver: spec.kind === "moto" || spec.kind === "sports",
      weaveTo: lane === 0 ? (this.rand() < 0.5 ? -1 : 1) : 0,
      weaving: false, signalT: 0, flashT: 0,
      flung: false, flyVy: 0, flyRot: 0, flyH: 0,
    });
  }

  /** Track Editor: convert a script item into live entities at its distance. */
  private runTrackItem(item: TrackItem) {
    const kind = item.kind;
    if (kind.startsWith("car-")) {
      const carKind = kind.slice(4);
      const spec = CAR_SPECS.find((s) => s.kind === carKind);
      if (spec) {
        const [color, dark] = vehiclePalette(spec.kind, this.rand);
        this.vehicleTypes.add(spec.kind);
        this.cars.push({
          lane: item.lane, laneF: item.lane, z: Z_FAR + 3,
          speed: (spec.spd[0] + spec.spd[1]) / 2,
          color, dark, spec,
          honked: false, passed: false,
          weaver: false, weaveTo: item.lane, weaving: false, signalT: 0, flashT: 0,
          flung: false, flyVy: 0, flyRot: 0, flyH: 0,
        });
      }
    } else if (kind === "coin") {
      this.spawnCoinLine(item.lane, Z_FAR + 3, 0, 5);
    } else if (kind.startsWith("hazard-")) {
      this.hazards.push({ lane: item.lane, z: Z_FAR + 3, kind: kind.slice(7) as HazardKind, cleared: false });
    } else if (kind === "ramp") {
      const spec = CAR_SPECS.find((s) => s.kind === "flatbed")!;
      this.cars.push({
        lane: item.lane, laneF: item.lane, z: Z_FAR + 3,
        speed: 10, color: "#8d9aa8", dark: "#4a5663", spec,
        honked: false, passed: false, weaver: false, weaveTo: item.lane, weaving: false,
        signalT: 0, flashT: 0, flung: false, flyVy: 0, flyRot: 0, flyH: 0,
      });
    } else if (kind === "toll") {
      this.tollGates.push({ z: Z_FAR + 3, taken: false });
    } else if (kind === "portal-shard") {
      this.pickups.push({ lane: item.lane, z: Z_FAR + 3, kind: "shard", spin: 0 });
    }
  }

  private spawnCoinLine(lane: number, zStart: number, height: number, count?: number) {
    const n = count ?? 4 + Math.floor(this.rand() * 3);
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 0;
      this.coins.push({
        lane, laneF: lane,
        z: zStart + i * 3.1,
        h: height > 0 ? height * (0.55 + 0.45 * Math.sin(t * Math.PI)) : 0,
        spin: i * 0.6,
      });
    }
  }

  private spawnHazard(forceLane?: number, kind?: HazardKind) {
    const lane = forceLane ?? Math.floor(this.rand() * 3) - 1;
    if (this.cars.some((c) => c.lane === lane && c.z > Z_FAR - 14)) return;
    const kinds: HazardKind[] = ["pothole", "cone", "barrier"];
    const pool = this.settings.mode === "zen" ? 2 : this.time > 18 ? 3 : 2;
    const k = kind ?? kinds[Math.floor(this.rand() * pool)];
    this.hazards.push({ lane, z: Z_FAR + 4, kind: k, cleared: false });
    if (this.rand() < 0.65 && this.safeCoinLanes(Z_FAR - 2).includes(lane)) {
      this.spawnCoinLine(lane, Z_FAR - 2, 0.46);
    }
  }

  private spawnPickup() {
    const lanes = this.safeCoinLanes(Z_FAR + 6);
    if (!lanes.length) return;
    const lane = lanes[Math.floor(this.rand() * lanes.length)];
    // portal shards drop alongside normal power-ups once traffic is rolling
    if (this.time > 12 && this.portalShards < 3 && this.warpZoneT <= 0 && this.rand() < 0.18) {
      this.pickups.push({ lane, z: Z_FAR + 6, kind: "shard", spin: 0 });
      return;
    }
    const kinds: PupKind[] = ["nitro", "magnet", "shield", "warp"];
    const kind = kinds[Math.floor(this.rand() * kinds.length)];
    this.pickups.push({ lane, z: Z_FAR + 6, kind, spin: 0 });
  }

  private spawnSurface() {
    const lane = Math.floor(this.rand() * 3) - 1;
    const kinds: SurfaceKind[] = ["oil", "gravel", "wet"];
    const kind = kinds[Math.floor(this.rand() * kinds.length)];
    this.surfaces.push({ lane, z: Z_FAR + 4, kind, length: 15 + this.rand() * 13 });
  }

  private spawnToll() {
    this.tollGates.push({ z: Z_FAR + 4, taken: false });
  }

  private spawnRoadProp() {
    const lane = Math.floor(this.rand() * 3) - 1;
    const kinds: RoadProp["kind"][] = ["cone", "sign", "bin", "board"];
    this.roadside.push({ lane, z: Z_FAR + 3, kind: kinds[Math.floor(this.rand() * kinds.length)], broken: false });
  }

  private spawnConvoy() {
    const kinds: ("construction" | "parade" | "wide-load")[] = ["construction", "parade", "wide-load"];
    const kind = kinds[Math.floor(this.rand() * kinds.length)];
    const lane = Math.floor(this.rand() * 3) - 1;
    const spec = CAR_SPECS.find((s) => s.kind === "truck")!;
    const other = CAR_SPECS.find((s) => s.kind === "van")!;
    for (let i = 0; i < (kind === "wide-load" ? 2 : 3); i++) {
      const l = kind === "wide-load" ? lane : Math.max(-1, Math.min(1, lane + (i % 2 ? 1 : 0)));
      const c = CAR_COLORS[Math.floor(this.rand() * CAR_COLORS.length)];
      const s = kind === "parade" ? other : spec;
      this.cars.push({
        lane: l, laneF: l, z: Z_FAR + i * 7 + this.rand() * 2,
        speed: 7 + this.rand() * 4, color: kind === "parade" ? c[0] : "#f59e0b",
        dark: c[1], spec: s, honked: false, passed: false, weaver: false,
        weaveTo: l, weaving: false, signalT: 0, flashT: 0, flung: false,
        flyVy: 0, flyRot: 0, flyH: 0,
      });
    }
    this.addText(this.W / 2, this.H * 0.3, kind === "wide-load" ? "WIDE LOAD" : kind === "parade" ? "PARADE!" : "CONSTRUCTION CONVOY", "#fde68a", 0.95);
  }

  private spawnBoss() {
    if (this.boss) return;
    this.boss = { z: Z_FAR + 8, lane: Math.floor(this.rand() * 3) - 1, phase: 0, phaseT: 1.6 };
    this.addText(this.W / 2, this.H * 0.27, "ROAD TRAIN! FIND THE GAP", "#fb7185", 1.1);
    sfx.announce(this.settings.announcer, "Road train. Find the gap.");
  }

  private spawnRail() {
    this.rails.push({ z: 16, len: 34 });
    const lane = Math.max(-1, Math.min(1, Math.round(this.px)));
    for (let i = 0; i < 10; i++) {
      this.coins.push({ lane, laneF: lane, z: 20 + i * 3.2, h: RAIL_H, spin: i * 0.5 });
    }
  }

  /* ---------------- unified juice curve & directional shake ---------------- */

  private shake(mag: number, dur: number, dirX = 0) {
    if (!this.settings.shake || this.settings.reduceMotion) return;
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeT = Math.max(this.shakeT, dur);
    if (dirX !== 0) this.shakeDirX = Math.max(-1, Math.min(1, dirX));
  }

  /** Unified juice curve: scales directional shake, micro-hitstop, and HUD score pop together. */
  private juiceEvent(bonus: number, dirX = 0) {
    const intensity = Math.max(0.12, Math.min(1, (this.combo * 30 + bonus) / 850));
    this.scorePop = Math.min(0.42, Math.max(this.scorePop, 0.1 + intensity * 0.3));
    if (!this.settings.reduceMotion) {
      this.hitstopT = Math.max(this.hitstopT, Math.min(0.052, 0.01 + bonus / 14000));
    }
    this.shake(3.4 + intensity * 9.6, 0.15 + intensity * 0.15, dirX);
  }

  private addText(x: number, y: number, text: string, color: string, scale = 1) {
    this.texts.push({ x, y, text, life: 1, color, scale });
  }

  private puffRing() {
    const x = this.xAt(this.px, 0);
    const y = this.yAt(0);
    const n = this.pCount(14, 7);
    for (let i = 0; i < n; i++) {
      const a = Math.PI + Math.random() * Math.PI;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 36, y: y + 2,
        vx: Math.cos(a) * (60 + Math.random() * 140),
        vy: Math.abs(Math.sin(a)) * 40 + 20,
        life: 0.4, maxLife: 0.4, size: 3 + Math.random() * 5,
        color: "rgba(220,210,240,0.55)", grav: 120, shape: "smoke",
      });
    }
  }

  private spawnDust() {
    const x = this.xAt(this.px, 0);
    const y = this.yAt(0);
    const n = this.pCount(8, 4);
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 30, y: y - Math.random() * 8,
        vx: (Math.random() - 0.5) * 120, vy: -Math.random() * 60 - 20,
        life: 0.4, maxLife: 0.4, size: 3 + Math.random() * 4,
        color: "rgba(200,180,220,0.5)", grav: 60, shape: "smoke",
      });
    }
  }

  private spawnSparks(x: number, y: number, n: number, colors: string[]) {
    const count = this.pCount(n, Math.ceil(n * 0.5));
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 120 + Math.random() * 380;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120,
        life: 0.5 + Math.random() * 0.6, maxLife: 1,
        size: 2 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        grav: 520, shape: "spark",
      });
    }
  }

  private spawnShards(x: number, y: number) {
    const n = this.pCount(26, 13);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 150 + Math.random() * 420;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 150,
        life: 0.7 + Math.random() * 0.5, maxLife: 1.2,
        size: 4 + Math.random() * 9,
        color: Math.random() < 0.5 ? "rgba(170,230,255,0.85)" : "rgba(255,255,255,0.8)",
        grav: 620, shape: "shard",
      });
    }
  }

  private spawnCoinBurst(x: number, y: number) {
    const n = this.pCount(10, 5);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 180;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80,
        life: 0.45, maxLife: 0.45, size: 2 + Math.random() * 3,
        color: Math.random() < 0.5 ? "#ffd700" : "#fff6c0",
        grav: 300, shape: "dot",
      });
    }
    this.particles.push({ x, y, vx: 0, vy: -40, life: 0.3, maxLife: 0.3, size: 8, color: "#ffd700", grav: 0, shape: "ring" });
  }

  /* ---------------- power-ups ---------------- */

  private grantPickup(kind: PupKind) {
    const x = this.xAt(this.px, 0.4);
    const y = this.yAt(0.4) - 120;
    const zen = this.settings.mode === "zen";
    const magUpgrade = this.settings.upgrades.magnet ?? 0;

    if (kind === "shard") {
      this.portalShards = Math.min(3, this.portalShards + 1);
      sfx.chime();
      this.addText(x, y, `PORTAL SHARD ${this.portalShards}/3`, "#c4b5fd", 1.05);
      this.spawnSparks(x, y, 12, ["#c4b5fd", "#e9d5ff", "#a78bfa"]);
      if (this.portalShards >= 3 && this.warpZoneT <= 0) {
        this.enterWarpZone();
      }
      return;
    }

    // ---- Power-Up Synergies: two simultaneous buffs fuse ----
    const tryFuse = (a: boolean, b: boolean, fusion: "vortex" | "phase" | "singularity", name: string) => {
      if (a && b && this.fusionKind !== fusion) {
        this.fusionKind = fusion;
        this.fusionT = Math.min(6.5, 4 + magUpgrade * 0.5);
        this.fusionsTriggered++;
        this.addText(this.W / 2, this.H * 0.3, `FUSION: ${name}!`, "#f0abfc", 1.3);
        this.replayEvent(`FUSION ${name}`);
        this.flash("240,171,252", 0.55);
        this.shake(12, 0.4);
        sfx.powerup();
        sfx.warpIn();
        return true;
      }
      return false;
    };

    switch (kind) {
      case "nitro":
        if (tryFuse(this.magnetT > 0, true, "vortex", "ELECTROMAGNETIC VORTEX")) {
          this.nitroT = Math.max(this.nitroT, zen ? 7 : 5);
          this.stats.nitros++;
          return;
        }
        this.nitroT = zen ? 7 : 5;
        this.stats.nitros++;
        sfx.nitro();
        this.addText(x, y, "NITRO RAMPAGE!", "#ff8c42", 1.2);
        this.flash("255,160,60", 0.55);
        this.shake(14, 0.5);
        this.camZoomTarget = this.settings.reduceMotion ? 1 : 1.08;
        this.buzz([30, 40, 60]);
        break;
      case "magnet":
        if (tryFuse(true, this.nitroT > 0, "vortex", "ELECTROMAGNETIC VORTEX")) {
          this.magnetT = (zen ? 11 : 8) + magUpgrade;
          this.stats.magnets++;
          return;
        }
        if (tryFuse(true, this.warpT > 0, "singularity", "COIN SINGULARITY")) {
          this.magnetT = (zen ? 11 : 8) + magUpgrade;
          this.stats.magnets++;
          return;
        }
        this.magnetT = (zen ? 11 : 8) + magUpgrade;
        this.stats.magnets++;
        sfx.powerup();
        this.addText(x, y, "COIN MAGNET", "#67e8f9", 1.1);
        break;
      case "shield":
        if (tryFuse(true, this.warpT > 0, "phase", "PHASE SHIFT")) {
          this.shield = true;
          return;
        }
        this.shield = true;
        sfx.powerup();
        this.addText(x, y, "KEVLAR SHIELD", "#a5f3fc", 1.1);
        break;
      case "warp":
        if (tryFuse(this.shield, true, "phase", "PHASE SHIFT")) {
          this.warpT = zen ? 9 : 6;
          this.stats.warps++;
          return;
        }
        if (tryFuse(this.magnetT > 0, true, "singularity", "COIN SINGULARITY")) {
          this.warpT = zen ? 9 : 6;
          this.stats.warps++;
          return;
        }
        this.warpT = zen ? 9 : 6;
        this.stats.warps++;
        sfx.warpIn();
        this.addText(x, y, "BULLET TIME", "#c4b5fd", 1.15);
        this.flash("160,140,255", 0.4);
        break;
    }
  }

  /** Enter the hyperspace secret zone: 15 s of neon cyber-grid coin heaven. */
  private enterWarpZone() {
    this.warpZoneT = 15;
    this.warpZones++;
    this.portalShards = 0;
    // the dimension is empty of threats
    this.cars = [];
    this.hazards = [];
    this.pickups = this.pickups.filter((p) => p.kind === "shard");
    this.chasers = [];
    this.boss = null;
    this.heli = null;
    this.policeT = 0;
    sfx.stopSiren();
    sfx.warpIn();
    this.addText(this.W / 2, this.H * 0.28, "HYPERSPACE WARP!", "#c4b5fd", 1.4);
    this.addText(this.W / 2, this.H * 0.28 + 36, "15 SECONDS · GRAB EVERYTHING", "#e9d5ff", 0.85);
    this.replayEvent("WARP ZONE");
    this.flash("196,181,253", 0.75);
    this.shake(16, 0.6);
    this.buzz([40, 60, 40, 60]);
  }

  private flingCar(c: Car) {
    c.flung = true;
    c.flyVy = 6 + Math.random() * 4;
    c.flyRot = (Math.random() - 0.5) * 7;
    if (c.spec.kind === "police") this.flungPolice++;
    const bonus = Math.round(150 * this.multiplier);
    this.score += bonus;
    const x = this.xAt(c.laneF, Math.max(c.z, 0.4));
    const y = this.yAt(Math.max(c.z, 0.4)) - 60;
    this.addText(x, y, `SMASH +${bonus}`, "#ffd166", 1);
    this.spawnSparks(x, y, 22, ["#ffb347", "#ff6b35", "#ffffff", c.color]);
    const dir = Math.sign(this.px - c.laneF) || 1;
    this.juiceEvent(bonus, dir);
    sfx.crash();
    this.slowmo = 0.55;
    this.buzz(26);
  }

  private breakShield(dirX = 0) {
    this.shield = false;
    this.stats.shields++;
    if (this.deliveryActive) this.deliveryDamage = Math.min(1, this.deliveryDamage + 0.08);
    this.invuln = 1.6;
    sfx.glassBreak();
    const x = this.xAt(this.px, 0);
    const y = this.yAt(0) - 90 - this.airOffset(this.jumpH, 0);
    this.spawnShards(x, y);
    this.addText(x, y - 40, "SHIELD BROKEN!", "#a5f3fc", 1.1);
    this.flash("180,230,255", 0.7);
    this.shake(18, 0.5, dirX);
    this.slowmo = 0.4;
    this.buzz([40, 30, 40]);
    for (const c of this.cars) {
      if (c.z < 14 && c.z > -3) {
        const away = c.laneF >= this.px ? 1 : -1;
        c.laneF += away * 1.1;
        c.lane = Math.max(-1, Math.min(1, Math.round(c.laneF)));
      }
    }
  }

  /* ---------------- crash ---------------- */

  /** Colourblind palette keyed by threat class with distinct luminance, not hue alone. */
  private classColor(kind: CarKind): [string, string] {
    if (kind === "truck" || kind === "bus") return ["#ffd400", "#8a7300"]; // unjumpable: brightest
    if (kind === "flatbed") return ["#ffffff", "#8a8a8a"]; // ramp
    if (kind === "police" || kind === "ambulance") return ["#ff6ec7", "#7a1f5c"]; // special
    return ["#4aa8ff", "#1d4f8a"]; // jumpable light traffic: mid luminance
  }

  private carLabel(kind: CarKind): string {
    const names: Record<CarKind, string> = {
      sedan: "Sedan",
      sports: "Sports Car",
      taxi: "Taxi Cab",
      van: "Delivery Van",
      police: "Police Cruiser",
      truck: "Heavy Truck",
      ambulance: "Ambulance",
      bus: "City Bus",
      flatbed: "Flatbed Tow",
      moto: "Lane-Splitter",
    };
    return names[kind];
  }

  private doCrash(color: string, killer = "Traffic", dirX = 0) {
    if (this.settings.mode === "zen") {
      this.invuln = 2.4;
      this.comboTimer = Math.max(this.comboTimer, 2);
      this.flash("255,170,120", 0.35);
      this.shake(8, 0.25, dirX);
      sfx.land();
      for (const c of this.cars) {
        if (c.z < 14 && c.z > -3) {
          const away = c.laneF >= this.px ? 1 : -1;
          c.laneF += away * 1.4;
        }
      }
      this.hazards = this.hazards.filter((hz) => !(hz.z < 12 && hz.z > -3));
      this.addText(this.xAt(this.px, 0.4), this.yAt(0.4) - 140, "EASY…", "#bbf7d0", 0.95);
      return;
    }

    if (this.settings.mode === "practice") {
      this.invuln = 2;
      this.combo = 0;
      this.comboTimer = 0;
      this.lane = this.px >= 0 ? -1 : 1;
      this.addText(this.xAt(this.px, 0.4), this.yAt(0.4) - 140, "PRACTICE BUMP", "#a5f3fc", 0.9);
      return;
    }

    // Co-op Delivery: a rider hit costs package health, not the run —
    // the shared cargo only dies at 0%.
    if (this.settings.mode === "coop" && this.packageHp > 0.05) {
      this.packageHp = Math.max(0, this.packageHp - 0.22);
      this.invuln = 2;
      this.combo = 0;
      this.comboTimer = 0;
      this.speed *= 0.72;
      this.flash("255,140,90", 0.5);
      this.shake(14, 0.4, dirX);
      sfx.crash();
      this.addText(this.xAt(this.px, 0.4), this.yAt(0.4) - 150, `PACKAGE ${Math.round(this.packageHp * 100)}%`, "#fca5a5", 1.1);
      if (this.packageHp <= 0.05) {
        // cargo destroyed — the run ends here
        this.banner = "THE CARGO WAS DESTROYED";
        this.lastKiller = killer;
        this.crashed = true;
        this.crashT = 0;
        this.slowmo = 0.25;
        sfx.stopEngine();
        sfx.stopMusic();
        sfx.stopSiren();
      }
      return;
    }

    if (this.rescueTickets > 0 && this.rescueUsed === 0) {
      this.rescueTickets--;
      this.rescueUsed++;
      this.invuln = 2.3;
      this.combo = 0;
      this.comboTimer = 0;
      this.speed *= 0.7;
      this.flash("255,255,255", 0.78);
      this.shake(18, 0.45, dirX);
      sfx.glassBreak();
      this.spawnShards(this.xAt(this.px, 0), this.yAt(0) - 70);
      this.addText(this.xAt(this.px, 0.4), this.yAt(0.4) - 150, "RESCUE TICKET!", "#a5f3fc", 1.15);
      if (this.deliveryActive) this.deliveryDamage = Math.min(1, this.deliveryDamage + 0.2);
      return;
    }

    this.crashCamX = dirX || 1;
    this.crashLane = this.lane;
    this.wheelie = false;
    this.grinding = false;
    sfx.setDanger(false);
    const kmh = Math.round(this.speed * 3.1);
    const comboLost = Math.max(this.combo, this.bankedCombo);
    this.bankedCombo = 0;
    this.lastKiller = killer;
    this.crashCallout = { killer, speedKmh: kmh, comboLost };

    // ---- Post-Run Coaching: capture the context while it is still live ----
    const killerJumpable = !UNJUMPABLE_KILLERS.has(killer) && !killer.includes("Train") && !killer.includes("Gunship");
    this.coaching = analyzeCrash({
      killer,
      speedKmh: kmh,
      jumpH: this.jumpH,
      killerJumpable,
      idleSeconds: this.time - this.lastActionAt,
      lastActionWasJump: this.actionType === "jump",
      jumpLeadSeconds: this.jumpStartT !== null ? this.time - this.jumpStartT : null,
      laneClearance: { ...this.coachLaneClear },
      combo: this.combo,
      midTrick: !!this.trick,
      onSurface: this.lastSurface,
      deliveryActive: this.deliveryActive,
    });

    this.crashed = true;
    this.crashT = 0;
    this.flash("255,120,80", 0.9);
    this.slowmo = 0.22;
    this.camZoomTarget = this.settings.reduceMotion ? 1 : 1.55;
    this.shake(26, 0.9, dirX || 1);
    sfx.crash();
    sfx.stopEngine();
    sfx.stopMusic();
    sfx.stopSiren();

    const flew = Math.round(this.distance);
    const options = [
      `Hit by ${killer} at ${kmh} KM/H`,
      `Wiped out at ${kmh} KM/H (${killer})`,
      `Flew ${flew}m before meeting a ${killer}`,
    ];
    this.banner = options[Math.floor(Math.random() * options.length)];

    const x = this.xAt(this.px, 0);
    const y = this.yAt(0) - 30 - this.airOffset(this.jumpH, 0);
    this.spawnSparks(x, y, 46, ["#ffb347", "#ff6b35", "#ffd700", "#ffffff", color]);
    const n = this.pCount(14, 7);
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 50, y: y - Math.random() * 30,
        vx: (Math.random() - 0.5) * 160, vy: -Math.random() * 180 - 40,
        life: 1.4, maxLife: 1.4, size: 8 + Math.random() * 14,
        color: `rgba(60,50,70,${0.5 + Math.random() * 0.3})`, grav: -40, shape: "smoke",
      });
    }
    this.buzz([80, 40, 120]);
  }

  private finishRun() {
    this.setPhase("over");
    const run: RunResult = {
      score: Math.floor(this.score),
      coins: this.coinsCollected,
      distance: Math.floor(this.distance),
      nearMisses: this.stats.nearMisses,
      jumps: this.stats.jumps,
      carsJumped: this.stats.carsJumped,
      policeJumped: this.stats.policeJumped,
      stunts: this.stats.stunts,
      airCoins: this.stats.airCoins,
      maxCombo: this.stats.maxCombo,
      topSpeed: Math.round(this.stats.topSpeed * 3.1),
      nitros: this.stats.nitros,
      shields: this.stats.shields,
      magnets: this.stats.magnets,
      warps: this.stats.warps,
      ramps: this.stats.ramps,
      tunnelDistance: Math.round(this.stats.tunnelDistance),
      chases: this.stats.chases,
      perfectDodges: this.perfectCount,
      tolls: this.tollCount,
      stuntChain: this.bestStuntChain,
      rescueUsed: this.rescueUsed,
      deliveryQuality: Math.max(0, Math.round((1 - this.deliveryDamage) * 100)),
      bossWins: this.stats.bossWins,
      sectors: [...this.sectorSplits],
      vehicleTypes: [...this.vehicleTypes],
      replay: this.replayFrames,
      mode: this.settings.mode,
      difficulty: this.settings.difficulty,
      themeId: this.settings.useCustom ? "custom" : this.settings.themeId,
      themeName: this.theme.name,
      killer: this.lastKiller,
      killerLane: this.crashLane,
      duration: +this.time.toFixed(1),
      bikeId: this.settings.bikeId,
      grindTime: +this.grindTotal.toFixed(1),
      wheelieTime: +this.wheelieTotal.toFixed(1),
      careerId: this.settings.careerId,
      weekKey: this.settings.weekKey,
      banner: this.banner || `Rode ${Math.floor(this.distance)}m the wrong way`,
      seed: this.seed,
      // ---- new feature results ----
      coaching: this.coaching,
      collected: [...this.collectedIds],
      flungPolice: this.flungPolice,
      brakeUsed: this.brakeUsed,
      slingshots: this.slingshots,
      tollBoosts: this.tollBoosts,
      warpZones: this.warpZones,
      fusions: this.fusionsTriggered,
      heliWins: this.heliWins,
      coop: this.settings.mode === "coop"
        ? { packageHp: Math.max(0, Math.round(this.packageHp * 100)), combined: true }
        : undefined,
    };
    if (!this.coaching.length && (this.lastKiller === "Delivered" || this.lastKiller === "Time Up")) {
      run.coaching = [{ title: "CLEAN RUN", detail: finishPraise(run.distance, this.lastKiller === "Delivered") }];
    }
    const ghost = this.settings.mode === "classic" ? this.ghostRec : null;
    this.cb.onGameOver(run, ghost);
  }

  /* ---------------- loop + frame-time auto quality ---------------- */

  private sampleFrameTime(rawDt: number) {
    const ms = rawDt * 1000;
    this.avgFrameMs += (ms - this.avgFrameMs) * 0.08;
    // Calibrate speed feel upward slightly if frame rate dips so lower-FPS phones still feel fast
    this.speedFeelBoost = Math.max(0, Math.min(0.28, (this.avgFrameMs - 16.8) / 42));

    if (!this.settings.autoQuality) return;
    if (!this.autoLow && this.avgFrameMs > 19.2) {
      this.frameProbeT += rawDt;
      if (this.frameProbeT > 2.2) {
        this.autoLow = true;
        this.frameProbeT = 0;
        this.resize();
        this.initWeather();
      }
    } else if (this.autoLow && this.avgFrameMs < 15.2) {
      this.frameProbeT += rawDt;
      if (this.frameProbeT > 4.2) {
        this.autoLow = false;
        this.frameProbeT = 0;
        this.resize();
        this.initWeather();
      }
    } else {
      this.frameProbeT = Math.max(0, this.frameProbeT - rawDt * 0.5);
    }
  }

  private loop = (now: number) => {
    if (this.destroyed) return;
    const rawDt = Math.min((now - this.lastT) / 1000, 1 / 24);
    this.lastT = now;
    this.sampleFrameTime(rawDt);

    if (this.phase === "playing") {
      this.pollGamepad();
      if (this.hitstopT > 0) {
        this.hitstopT = Math.max(0, this.hitstopT - rawDt);
        this.scorePop = Math.max(0, this.scorePop - rawDt * 2.5);
      } else {
        this.update(rawDt);
      }
    } else if (this.phase === "ready") {
      this.updateAttract(rawDt);
    }
    this.render();

    // Input-to-frame latency measurement
    if (this.pendingInputAt > 0) {
      const lat = Math.max(0.2, performance.now() - this.pendingInputAt);
      this.lastInputLatencyMs = lat;
      this.avgInputLatencyMs = this.avgInputLatencyMs === 0
        ? lat
        : this.avgInputLatencyMs * 0.8 + lat * 0.2;
      this.pendingInputAt = 0;
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private updateAttract(dt: number) {
    this.attractT += dt;
    this.curvePhase = this.attractT * 0.11;
    this.roadOffset = (this.roadOffset + 12 * dt) % 8;
    // Gentle rider lane-weave idle motion on the menu backdrop
    if (!this.settings.reduceMotion) {
      this.px += (Math.sin(this.attractT * 0.52) * 0.42 - this.px) * Math.min(1, dt * 3);
      this.tilt = Math.cos(this.attractT * 0.52) * 0.08;
    } else {
      this.px = 0;
      this.tilt = 0;
    }

    // Ambient passing cars in outer lanes so the title road feels alive right away
    this.attractSpawnT -= dt;
    if (this.attractSpawnT <= 0 && this.cars.length < 4) {
      this.attractSpawnT = 2.4 + Math.random() * 1.8;
      const lane = Math.random() < 0.5 ? -1 : 1;
      const spec = CAR_SPECS[Math.floor(Math.random() * 3)];
      const c = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
      this.cars.push({
        lane, laneF: lane, z: Z_FAR + 4, speed: 12 + Math.random() * 6,
        color: c[0], dark: c[1], spec, honked: false, passed: true,
        weaver: false, weaveTo: lane, weaving: false, signalT: 0, flashT: 0,
        flung: false, flyVy: 0, flyRot: 0, flyH: 0,
      });
    }
    for (let i = this.cars.length - 1; i >= 0; i--) {
      this.cars[i].z -= (12 + this.cars[i].speed) * dt;
      if (this.cars[i].z < -6) this.cars.splice(i, 1);
    }

    for (const p of this.props) {
      p.z -= 12 * dt;
      if (p.z < 0) {
        p.z += Z_FAR;
        p.kind = this.pickProp(this.theme.props);
        p.h = 0.7 + Math.random() * 0.75;
        p.seed = Math.random() * 1000;
      }
    }
    this.wheelSpin += dt * 7;
    this.updateFx(dt);
    this.updateWeather(dt, 12);
  }

  /** Score multiplier including the active toll boost. */
  private effMul() {
    return this.multiplier + (this.distance < this.tollBoostUntil ? this.tollBoostMul : 0);
  }

  /** Phase Shift fusion: quantum ghost state passes straight through heavies. */
  private fusionActivePhase() {
    return this.fusionKind === "phase" && this.fusionT > 0;
  }

  private update(rawDt: number) {
    this.slowmo += (1 - this.slowmo) * (this.crashed ? 0 : rawDt * 4);
    const dt = rawDt * (this.crashed ? this.slowmo : Math.min(this.slowmo, 1));

    if (this.countdown > 0) {
      this.countdown -= rawDt;
      this.updateFx(rawDt);
      this.updateWeather(rawDt, this.speed);
      return;
    }

    const emitStats = (inTunnelNow: boolean) => {
      this.cb.onStats({
        score: Math.floor(this.score),
        coins: this.coinsCollected,
        speedKmh: Math.round(this.speed * 3.1),
        combo: this.comboTimer > 0 ? this.combo : 0,
        bankedCombo: this.bankedCombo,
        scorePop: this.scorePop,
        nitro: Math.max(0, this.nitroT),
        magnet: Math.max(0, this.magnetT),
        warp: Math.max(0, this.warpT),
        shield: this.shield,
        timeLeft: this.timeLeft,
        trick: this.trick ? this.trick.name : null,
        multiplier: this.multiplier,
        inTunnel: inTunnelNow,
        wanted: this.policeT > 0 ? this.wanted : 0,
        sector: this.sectorIndex + 1,
        sectorTime: this.sectorClock,
        draft: this.draftT,
        brake: this.brakeT,
        surface: this.lastSurface,
        rescueTickets: Math.max(0, this.rescueTickets),
        laneClosed: this.laneClosed,
        fps: Math.round(1000 / Math.max(1, this.avgFrameMs)),
        inputLatencyMs: +this.lastInputLatencyMs.toFixed(1),
        avgLatencyMs: +this.avgInputLatencyMs.toFixed(1),
        effectiveQuality: this.effectiveQuality(),
        crashCallout: this.crashed ? this.crashCallout : null,
        nitroMeter: this.nitroMeter,
        wheelie: this.wheelieT,
        grinding: this.grinding,
        grindBalance: this.grindBalance,
        prestigeReady: this.prestigeReady(),
        prestige: this.prestige,
        weatherFx: this.weatherFx(),
        danger: this.dangerNow,
        sling: this.slingMeter,
        fusion: this.fusionT > 0 ? this.fusionKind : null,
        warpZone: this.warpZoneT,
        tollBoost: this.distance < this.tollBoostUntil ? this.tollBoostMul : 0,
        shards: this.portalShards,
        coop: this.p2
          ? { p2Lane: this.p2.lane, packageHp: this.packageHp, p2Alive: this.p2.alive }
          : null,
      });
    };

    if (this.crashed) {
      this.crashT += rawDt;
      this.slowmo = Math.max(0.1, this.slowmo - rawDt * 0.1);
      this.camZoom += (this.camZoomTarget - this.camZoom) * Math.min(1, rawDt * 3);
      this.updateFx(rawDt);
      this.updateWeather(dt, this.speed);
      for (const c of this.cars) c.z -= (this.speed * 0.2 + c.speed * 0.3) * dt;
      emitStats(this.distance < this.tunnelUntil);
      if (this.crashT > 1.6) this.finishRun();
      return;
    }

    const d = this.diff();
    const curve = MODE_CURVES[this.settings.mode];
    this.time += dt;
    this.scorePop = Math.max(0, this.scorePop - dt * 2.5);

    // time trial countdown
    if (this.timeLeft !== null) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.lastKiller = "Time Up";
        this.banner = `Time trial complete — ${Math.floor(this.distance)}m`;
        this.finishRun();
        return;
      }
    }

    // speed: nitro pins it at the cap; per-mode curve scales acceleration
    const brakeScale = this.brakeT > 0 ? 0.62 : 1;
    if (this.brakeT > 0) this.brakeT = Math.max(0, this.brakeT - dt);
    if (this.driftT > 0) this.driftT = Math.max(0, this.driftT - dt);
    if (this.draftT > 0) this.draftT = Math.max(0, this.draftT - dt);
    const cap = d.cap * (this.prestige ? 1.3 : 1);
    const ramp = d.ramp * curve.rampMul * (this.settings.newPlayer ? 0.75 : 1) * (this.prestige ? 1.6 : 1);
    const targetBase = this.nitroT > 0 ? cap : Math.min(16 + this.time * ramp, cap);
    const slingBoost = this.slingActive > 0 ? 1.28 : 1;
    const warpBoost = this.warpZoneT > 0 ? 1.18 : 1;
    const target = targetBase * (this.draftT > 0 ? 1.1 : 1) * slingBoost * warpBoost;
    this.speed += (target * brakeScale - this.speed) * Math.min(1, dt * (this.nitroT > 0 || this.slingActive > 0 ? 3 : 1.2 * this.bikeStats().accel));
    if (this.slingActive > 0) this.slingActive = Math.max(0, this.slingActive - dt);
    if (this.slingChainT > 0) {
      this.slingChainT -= dt;
      if (this.slingChainT <= 0) this.slingChain = 0;
    }
    this.curvePhase = this.distance / 380;
    this.stats.topSpeed = Math.max(this.stats.topSpeed, this.speed);
    this.distance += this.speed * dt;
    this.roadOffset = (this.roadOffset + this.speed * dt) % 8;
    this.score += this.speed * dt * 1.1 * this.effMul() * (this.brakeT > 0 ? 0.78 : 1) * (this.prestige ? 2 : 1);
    this.wheelSpin += this.speed * dt * 0.6;
    sfx.updateEngine((this.speed - 16) / 26);
    if (this.deliveryActive && this.distance >= (this.settings.deliveryDistance ?? 1800)) {
      const quality = Math.max(0, 1 - this.deliveryDamage) * (this.settings.mode === "coop" ? this.packageHp : 1);
      const payout = Math.round(350 + quality * 1200);
      this.coinsCollected += payout;
      this.score += payout * this.effMul();
      this.lastKiller = "Delivered";
      this.banner = this.settings.mode === "coop"
        ? `CO-OP DELIVERY COMPLETE · CARGO ${Math.round(quality * 100)}% INTACT`
        : `DELIVERY COMPLETE · PACKAGE ${Math.round(quality * 100)}% INTACT`;
      this.addText(this.W / 2, this.H * 0.25, `DELIVERY +${payout} COINS`, "#fde68a", 1.1);
      this.finishRun();
      return;
    }

    // ---- hyperspace warp zone: pure coin heaven, no threats ----
    if (this.warpZoneT > 0) {
      this.warpZoneT -= dt;
      this.warpCoinT -= dt;
      if (this.warpCoinT <= 0) {
        this.warpCoinT = 0.22;
        // wall-to-wall coin clusters across all three lanes
        const lane = [-1, 0, 1][Math.floor(this.rand() * 3)];
        this.spawnCoinLine(lane, Z_FAR - 6, this.rand() < 0.4 ? 0.5 : 0, 6);
        if (this.rand() < 0.12) this.pickups.push({ lane: 0, z: Z_FAR + 4, kind: "nitro", spin: 0 });
      }
      if (this.warpZoneT <= 0) {
        this.addText(this.W / 2, this.H * 0.3, "WARPED BACK!", "#c4b5fd", 1.2);
        sfx.warpOut();
        this.flash("196,181,253", 0.5);
      }
    }

    // ---- SWAT Gunship milestone encounter ----
    if (
      this.heli === null && this.warpZoneT <= 0 && this.distance >= this.nextHeliAt &&
      this.settings.mode !== "zen" && this.settings.mode !== "practice" && this.settings.mode !== "bossrush" &&
      !this.boss
    ) {
      this.heli = {
        t: 0, dur: 14, targetLane: Math.floor(this.rand() * 3) - 1, lockT: 2.2,
        beamLane: 0, beamActive: false, beamT: 0, rampSpawned: false, rotor: 0, leapt: false,
      };
      this.addText(this.W / 2, this.H * 0.24, "SWAT GUNSHIP INBOUND!", "#60a5fa", 1.25);
      this.addText(this.W / 2, this.H * 0.24 + 34, "USE THE RAMP · JUMP THE BEAM", "#93c5fd", 0.8);
      sfx.announce(this.settings.announcer, "Gunship. Find the ramp.");
      this.buzz([40, 60, 80]);
    }
    if (this.heli) {
      const h = this.heli;
      h.t += dt;
      h.rotor += dt * 26;
      h.lockT -= dt;
      if (h.lockT <= 0) {
        // crosshair locks a lane and drops a spike strip / smoke flare
        const lane = Math.floor(this.rand() * 3) - 1;
        h.targetLane = lane;
        h.lockT = Math.max(1.1, 2.2 - h.t * 0.05);
        if (h.t > 1.5 && this.settings.mode !== "practice" && this.warpZoneT <= 0) {
          this.spawnHazard(lane, this.rand() < 0.7 ? "spikes" : "cone");
          this.spawnSparks(this.xAt(lane, 16), this.yAt(16), 8, ["#60a5fa", "#93c5fd"]);
        }
      }
      // spotlight beam phase in the back half of the encounter
      if (!h.beamActive && h.t > h.dur * 0.45) {
        h.beamActive = true;
        h.beamLane = Math.round(this.px) === 0 ? (this.rand() < 0.5 ? -1 : 1) : Math.round(this.px);
        h.beamT = 2.6;
        this.addText(this.W / 2, this.H * 0.3, "SPOTLIGHT BEAM — LAUNCH!", "#fde047", 1.1);
        // guarantee an escape ramp in a lane beside the beam
        if (!h.rampSpawned) {
          h.rampSpawned = true;
          const rampLane = Math.max(-1, Math.min(1, h.beamLane + (this.rand() < 0.5 ? -1 : 1)));
          const spec = CAR_SPECS.find((s) => s.kind === "flatbed")!;
          this.cars.push({
            lane: rampLane, laneF: rampLane, z: Z_FAR - 6, speed: 10,
            color: "#8d9aa8", dark: "#4a5663", spec,
            honked: false, passed: false, weaver: false, weaveTo: rampLane, weaving: false,
            signalT: 0, flashT: 0, flung: false, flyVy: 0, flyRot: 0, flyH: 0,
          });
        }
        sfx.thunder();
      }
      if (h.beamActive) {
        h.beamT -= dt;
        const inBeam = Math.abs(this.px - h.beamLane) < 0.55;
        if (inBeam && this.jumpH < RAIL_CLEAR && this.invuln <= 0 && this.nitroT <= 0 && !this.fusionActivePhase()) {
          if (this.shield) this.breakShield(Math.sign(this.px - h.beamLane) || 1);
          else {
            this.doCrash("#60a5fa", "SWAT Gunship", Math.sign(this.px - h.beamLane) || 1);
            return;
          }
        }
        if (inBeam && this.jumpH >= 0.9 && !h.leapt) {
          h.leapt = true;
          const bonus = Math.round(600 * this.effMul());
          this.score += bonus;
          this.addText(this.xAt(this.px, 0.4), this.yAt(0.4) - 170, `BEAM LEAP! +${bonus}`, "#fde047", 1.15);
          this.replayEvent("GUNSHIP LEAP");
          this.juiceEvent(bonus, 0);
        }
        if (h.beamT <= 0) h.beamActive = false;
      }
      if (h.t >= h.dur) {
        this.heliWins++;
        this.score += Math.round(900 * this.effMul());
        this.coinsCollected += 10;
        this.addText(this.W / 2, this.H * 0.26, "GUNSHIP ESCAPED! +10 COINS", "#93c5fd", 1.05);
        this.replayEvent("GUNSHIP ESCAPED");
        this.nextHeliAt = this.distance + 2500;
        this.heli = null;
      }
    }

    // ---- Cargo Zeppelin finale boss (Harbor Finale + Boss Rush) ----
    if (
      this.zep === null && this.heli === null && this.distance >= this.nextZepAt &&
      this.settings.mode !== "zen" && this.settings.mode !== "practice"
    ) {
      this.zep = {
        t: 0, dur: 32, dropT: 2.6, targetLane: 0, telegraph: 0, swing: 0, strikes: 0,
      };
      this.addText(this.W / 2, this.H * 0.2, "CARGO ZEPPELIN ABOVE!", "#f472b6", 1.3);
      this.addText(this.W / 2, this.H * 0.2 + 34, "WATCH THE WARN GLOW · DODGE THE SLAMS", "#fbcfe8", 0.8);
      sfx.announce(this.settings.announcer, "Zeppelin. Mind the sky.");
      this.buzz([50, 40, 70, 40, 90]);
    }
    if (this.zep) {
      const zp = this.zep;
      zp.t += dt;
      zp.swing += dt * 2.1;
      if (zp.telegraph > 0) {
        zp.telegraph -= dt;
        if (zp.telegraph <= 0) {
          // SLAM: the container hits the telegraphed lane
          const inLane = Math.abs(this.px - zp.targetLane) < 0.55;
          const airborne = this.jumpH >= 0.55;
          if (inLane && !airborne && this.invuln <= 0) {
            if (this.shield) this.breakShield(Math.sign(this.px - zp.targetLane) || 1);
            else {
              this.doCrash("#f472b6", "Cargo Zeppelin", Math.sign(this.px - zp.targetLane) || 1);
              return;
            }
          } else if (inLane && airborne) {
            // reward the players who read the glow and jumped
            const bonus = Math.round(450 * this.effMul());
            this.score += bonus;
            zp.strikes++;
            this.addText(this.xAt(this.px, 0.4), this.yAt(0.4) - 170, `SKY DODGE! +${bonus}`, "#fde047", 1.1);
            this.replayEvent("ZEPPELIN DODGE");
          }
          zp.dropT = Math.max(1.5, 2.6 - zp.t * 0.035);
        }
      } else {
        zp.dropT -= dt;
        if (zp.dropT <= 0) {
          // pick the next target: biased toward where the rider actually is
          const lanes = [-1, 0, 1];
          const biased = Math.abs(this.px) < 1.4 && this.rand() < 0.55 ? Math.round(this.px) : Math.floor(this.rand() * 3) - 1;
          zp.targetLane = lanes.includes(biased) ? biased : 0;
          zp.telegraph = Math.max(0.9, 1.5 - zp.t * 0.015);
          sfx.threatCue(zp.targetLane, true);
        }
      }
      if (zp.t >= zp.dur) {
        this.stats.bossWins++;
        this.score += Math.round(800 * this.effMul());
        this.coinsCollected += 12;
        this.addText(this.W / 2, this.H * 0.22, "ZEPPELIN OUTRUN! +12 COINS", "#f9a8d4", 1.1);
        this.replayEvent("ZEPPELIN SURVIVED");
        // Boss Rush chains it back in later; a harbor delivery sees it once per run
        this.nextZepAt = this.settings.mode === "bossrush" ? this.distance + 3200 : Number.POSITIVE_INFINITY;
        this.zep = null;
      }
    }

    // ---- environmental cataclysms ----
    const weatherNow = this.theme.weather;
    if (weatherNow === "rain" && this.settings.mode !== "zen") {
      // lightning illuminates the road (and tunnels) with a thunderclap
      this.lightningT -= dt;
      if (this.lightningT <= 0) {
        this.lightningT = 8 + this.rand() * 9;
        this.lightningFlash = 0.22;
        sfx.thunder();
        if (!this.settings.reduceMotion) this.shake(4, 0.2);
      }
    }
    if (this.lightningFlash > 0) this.lightningFlash = Math.max(0, this.lightningFlash - dt);
    // puddle aquaplaning: grounded + wet patch + high speed without hopping
    if (this.lastSurface === "wet" && this.jumpH < 0.08 && this.speed > 27) {
      this.aquaplaneT = Math.min(1.2, this.aquaplaneT + dt * 1.6);
      if (this.aquaplaneT > 0.35 && !this.aquaWarned) {
        this.aquaWarned = true;
        this.addText(this.xAt(this.px, 0.4), this.yAt(0.4) - 160, "AQUAPLANING — HOP!", "#67e8f9", 1);
      }
    } else {
      this.aquaplaneT = Math.max(0, this.aquaplaneT - dt * 2.4);
      if (this.aquaplaneT === 0) this.aquaWarned = false;
    }
    if (weatherNow === "sand" && this.settings.mode !== "zen") {
      this.devilT -= dt;
      if (this.devilT <= 0) {
        this.devilT = 16 + this.rand() * 12;
        const fromLeft = this.rand() < 0.5;
        this.dustDevils.push({
          z: 12 + this.rand() * 10, x: fromLeft ? -2.4 : 2.4,
          vx: (fromLeft ? 1 : -1) * (0.5 + this.rand() * 0.35), life: 4.5, spin: this.rand() * 6,
        });
      }
    }
    for (let i = this.dustDevils.length - 1; i >= 0; i--) {
      const dv = this.dustDevils[i];
      dv.x += dv.vx * dt;
      dv.life -= dt;
      dv.spin += dt * 9;
      dv.z -= this.speed * dt * 0.2;
      // crossing the rider's lane nudges the bike sideways
      if (Math.abs(dv.x - this.px) < 0.5 && dv.z < 3.5 && dv.z > -1 && this.jumpH < 0.3) {
        this.px += Math.sign(dv.vx) * dt * 1.4;
        this.tilt += Math.sign(dv.vx) * dt * 1.2;
        this.shake(3, 0.1, Math.sign(dv.vx));
        if (this.rand() < 0.1) this.spawnDust();
      }
      if (dv.life <= 0 || Math.abs(dv.x) > 3) this.dustDevils.splice(i, 1);
    }

    // ---- Track Editor script: spawn placements as the start line passes them ----
    if (this.settings.track && this.settings.track.items.length) {
      const items = this.settings.track.items;
      while (this.trackCursor < items.length && items[this.trackCursor].at <= this.distance) {
        this.runTrackItem(items[this.trackCursor]);
        this.trackCursor++;
      }
    }

    // ---- world collectible: one hidden pickup per run ----
    if (!this.collectibleSpawned && this.distance > 420 && this.settings.mode !== "practice") {
      const worldId = this.settings.useCustom ? "custom" : this.settings.themeId;
      const owned = new Set(this.settings.collectiblesOwned ?? []);
      const pool = collectiblesForWorld(worldId).filter((c) => !owned.has(c.id));
      if (pool.length && this.rand() < 0.5) {
        const def = pool[Math.floor(this.rand() * pool.length)];
        this.collectible = { lane: Math.floor(this.rand() * 3) - 1, z: Z_FAR + 4, def, spin: 0 };
      }
      this.collectibleSpawned = true;
    }
    if (this.collectible) {
      this.collectible.z -= this.speed * dt;
      this.collectible.spin += dt * 2.4;
      if (this.collectible.z < 1.3 && this.collectible.z > -1 && Math.abs(this.px - this.collectible.lane) < 0.7 && this.jumpH < 0.6) {
        const def = this.collectible.def;
        this.collectedIds.push(def.id);
        this.coinsCollected += 25;
        this.score += Math.round(300 * this.effMul());
        sfx.chime();
        this.addText(this.W / 2, this.H * 0.3, `FOUND: ${def.name.toUpperCase()}!`, "#fde047", 1.2);
        this.addText(this.W / 2, this.H * 0.3 + 34, def.lore.slice(0, 72) + "…", "#e2e8f0", 0.7);
        this.replayEvent("COLLECTIBLE");
        const cx = this.xAt(this.collectible.lane, 0.4);
        const cy = this.yAt(0.4) - 110;
        this.spawnSparks(cx, cy, 22, ["#fde047", "#ffffff", "#fbbf24"]);
        this.collectible = null;
      } else if (this.collectible && this.collectible.z < -3) {
        this.collectible = null;
      }
    }

    // ---- co-op rider 2 physics + protection duty ----
    if (this.p2) {
      const p = this.p2;
      if (!p.alive) {
        p.respawnT -= dt;
        if (p.respawnT <= 0) {
          p.alive = true;
          p.invuln = 2;
          p.lane = p.px >= 0 ? -1 : 1;
        }
      } else {
        if (p.invuln > 0) p.invuln -= dt;
        p.px += (p.lane - p.px) * Math.min(1, dt * 12);
        p.tilt += ((p.lane - p.px) * 0.7 - p.tilt) * Math.min(1, dt * 10);
        if (p.jumpH > 0 || p.jumpV > 0) {
          p.jumpV -= GRAV * dt;
          p.jumpH = Math.max(0, p.jumpH + p.jumpV * dt);
          if (p.jumpH === 0) p.jumpV = 0;
        }
        // P2 rides slightly ahead and to the side — the escort position
        // their near-misses feed the shared score
        for (const c of this.cars) {
          if (c.flung || c.z > 1.2 || c.z < -0.6) continue;
          if (Math.abs(p.px - c.laneF) < 0.62 && p.jumpH < 0.3 && p.invuln <= 0) {
            // the protector bashes traffic away from the cargo
            this.flingCar(c);
            this.packageHp = Math.max(0, this.packageHp - 0.05);
            p.invuln = 0.8;
            this.addText(this.xAt(p.px, 0.4), this.yAt(0.4) - 150, "BLOCKED!", "#a3e635", 0.95);
          }
        }
      }
    }

    // ---- coaching context: periodic lane clearance snapshot ----
    this.coachClearT -= dt;
    if (this.coachClearT <= 0) {
      this.coachClearT = 0.25;
      for (const lane of [-1, 0, 1]) {
        let nearest = 99;
        for (const c of this.cars) {
          if (Math.abs(c.laneF - lane) < 0.62 && c.z > 0) nearest = Math.min(nearest, c.z);
        }
        for (const hz of this.hazards) {
          if (hz.lane === lane && hz.z > 0) nearest = Math.min(nearest, hz.z + 3);
        }
        this.coachLaneClear[lane] = nearest;
      }
    }

    // ---- fusion buffs tick ----
    if (this.fusionT > 0) {
      this.fusionT -= dt;
      if (this.fusionKind === "vortex") {
        // electromagnetic vortex: traffic is dragged aside, coins pulled from all lanes
        for (const c of this.cars) {
          if (c.z < 26 && c.z > 1 && !c.flung) {
            const away = Math.sign(c.laneF - this.px) || 1;
            c.laneF += away * dt * 1.1;
            c.lane = Math.max(-1, Math.min(1, Math.round(c.laneF)));
            if (this.rand() < dt * 2) {
              this.spawnSparks(this.xAt(c.laneF, c.z), this.yAt(c.z) - 40, 3, ["#67e8f9", "#ffffff"]);
            }
          }
        }
      } else if (this.fusionKind === "singularity") {
        // coin singularity: coins freeze mid-air and glide in
        for (const co of this.coins) {
          if (co.z < 30 && co.z > -0.5) {
            co.laneF += (this.px - co.laneF) * Math.min(1, dt * 2.6);
            co.h += (this.jumpH * 0.6 - co.h) * Math.min(1, dt * 1.8);
          }
        }
      }
      if (this.fusionT <= 0) {
        this.fusionKind = null;
        this.addText(this.xAt(this.px, 0.5), this.yAt(0.5) - 150, "FUSION OVER", "#f5d0fe", 0.85);
      }
    }

    // sectors are fixed 500m checkpoints; split times are kept in run data for PB comparison.
    this.sectorClock += dt;
    if (this.distance >= (this.sectorIndex + 1) * 500) {
      this.sectorSplits.push(Math.round(this.sectorClock * 100) / 100);
      this.sectorIndex++;
      this.sectorClock = 0;
      this.addText(this.W / 2, this.H * 0.25, `SECTOR ${this.sectorIndex}  ${this.sectorSplits.at(-1)?.toFixed(2)}s`, "#67e8f9", 0.9);
      sfx.coin();
    }

    // A same-direction courier rival weaves just ahead. Catch them by each 500m checkpoint.
    const rivalResult = updateRival(this.courier, dt, this.distance, this.speed, this.rand, this.lane);
    if (rivalResult) {
      if (rivalResult.won) {
        const reward = Math.round(225 * this.multiplier);
        this.score += reward;
        this.coinsCollected += 5;
        this.addText(this.W / 2, this.H * 0.25, `BEAT ${this.courier.name}! +5 COINS`, "#67e8f9", 1.05);
        this.juiceEvent(reward, 0);
      } else {
        this.addText(this.W / 2, this.H * 0.25, `${this.courier.name} TOOK THE CHECKPOINT`, "#f9a8d4", 0.86);
      }
    }

    // Road forks: rich narrow lane versus broad safe lane. Rich path is seeded with coins.
    if (maybeStartFork(this.fork, this.distance, this.rand)) {
      for (let i = 0; i < 10; i++) {
        this.coins.push({ lane: this.fork.richLane, laneF: this.fork.richLane, z: 42 + i * 3.1, h: 0, spin: i * 0.5 });
      }
      this.addText(this.W / 2, this.H * 0.3, "ROAD FORK · COINS OR SAFETY?", "#fde047", 0.95);
    }
    const forkResult = updateFork(this.fork, dt, this.speed, this.px);
    if (forkResult) {
      if (forkResult.rich) {
        const reward = Math.round(180 * this.multiplier);
        this.score += reward;
        this.addText(this.xAt(forkResult.lane, 0.4), this.yAt(0.4) - 145, `RISK PATH +${reward}`, "#fde047", 0.95);
        this.juiceEvent(reward, 0);
      } else {
        this.invuln = Math.max(this.invuln, 1.2);
        this.addText(this.xAt(forkResult.lane, 0.4), this.yAt(0.4) - 135, "SAFE PATH", "#86efac", 0.82);
      }
    }

    // timed chaos events are opt-in outside Zen/Practice.
    if (this.settings.mode !== "zen" && this.settings.mode !== "practice") {
      if (mirrorSchedule(this.settings.mode, this.settings.difficulty, this.time, this.time - dt)) {
        this.mirrorT = 10;
        this.addText(this.W / 2, this.H * 0.28, "MIRROR MADNESS!", "#e879f9", 1.2);
        this.flash("180,70,255", 0.32);
      }
      if (this.time > 42 && Math.floor(this.time / 42) !== Math.floor((this.time - dt) / 42)) {
        this.fogT = 8;
        this.addText(this.W / 2, this.H * 0.31, "HEADLIGHTS ON", "#cbd5e1", 0.85);
      }
    }
    if (this.fogT > 0) this.fogT = Math.max(0, this.fogT - dt);
    if (this.mirrorT > 0) this.mirrorT = Math.max(0, this.mirrorT - dt);
    if (this.settings.modifiers.includes("mirror")) this.mirrorT = Math.max(this.mirrorT, 0.5);

    // challenge deck and custom route tune frequency without changing the physics loop.
    const modDouble = this.settings.modifiers.includes("double-coins");
    const routeFactor = clampNum(this.settings.route.traffic, 0.55, 1.6, 1);

    // Surface handling is visual-only in Zen and Practice.
    this.surfaceTimer -= dt;
    if (this.surfaceTimer <= 0 && this.settings.mode !== "practice") {
      this.surfaceTimer = 10 + this.rand() * 12;
      this.spawnSurface();
    }
    for (let i = this.surfaces.length - 1; i >= 0; i--) {
      this.surfaces[i].z -= this.speed * dt;
      if (this.surfaces[i].z + this.surfaces[i].length < -2) this.surfaces.splice(i, 1);
    }
    const patch = this.surfaces.find(
      (p) => p.lane === this.lane && p.z < 1.5 && p.z + p.length > 0
    );
    this.lastSurface = patch?.kind ?? "asphalt";

    // Challenge deck: 1.5s chevron warning before dropping the closed-lane barrier!
    if (this.settings.modifiers.includes("closed-lane") && this.settings.mode !== "zen" && this.settings.mode !== "practice") {
      if (this.closingWarnT > 0) {
        this.closingWarnT -= dt;
        if (this.closingWarnT <= 0 && this.closingLane >= -1) {
          this.laneClosed = this.closingLane;
          this.closingLane = -2;
          this.closedTimer = 14;
          this.hazards.push({ lane: this.laneClosed, z: Z_FAR, kind: "barrier", cleared: false });
          this.addText(this.W / 2, this.H * 0.28, `LANE ${this.laneClosed + 2} CLOSED`, "#fbbf24", 0.95);
        }
      } else {
        this.closedTimer -= dt;
        if (this.closedTimer <= 0) {
          if (this.laneClosed < -1) {
            this.closingLane = Math.floor(this.rand() * 3) - 1;
            this.closingWarnT = 1.5;
            this.addText(this.W / 2, this.H * 0.28, `LANE ${this.closingLane + 2} CLOSING!`, "#fde047", 0.9);
          } else {
            this.laneClosed = -2;
            this.closedTimer = 15;
            this.addText(this.W / 2, this.H * 0.28, "LANE OPEN", "#4ade80", 0.8);
          }
        }
      }
    } else {
      this.laneClosed = -2;
      this.closingLane = -2;
      this.closingWarnT = 0;
    }

    // Route events: toll gate, roadside convoy, and periodic boss.
    this.tollTimer -= dt;
    if (this.tollTimer <= 0 && this.settings.mode !== "zen" && this.settings.mode !== "practice") {
      this.tollTimer = 29 + this.rand() * 13;
      this.spawnToll();
    }
    this.roadWarnTimer -= dt;
    if (this.roadWarnTimer <= 0) {
      this.roadWarnTimer = 3.8 + this.rand() * 1.4;
      if (this.settings.mode !== "practice") this.spawnRoadProp();
    }
    this.convoyTimer -= dt;
    if (this.convoyTimer <= 0 && this.settings.mode !== "zen" && this.settings.mode !== "practice") {
      this.convoyTimer = this.settings.mode === "bossrush" ? 16 + this.rand() * 6 : 78 + this.rand() * 35;
      this.spawnConvoy();
    }
    this.bossTimer -= dt;
    if (this.bossTimer <= 0 && !this.boss && this.settings.mode !== "zen" && this.settings.mode !== "practice") {
      this.bossTimer = this.settings.mode === "bossrush" ? 6 : 180;
      this.spawnBoss();
    }

    // Timed events advance the boss through a telegraphed lane sweep.
    if (this.boss) {
      const b = this.boss;
      b.z -= this.speed * dt;
      b.phaseT -= dt;
      if (b.phaseT <= 0) {
        b.phase = (b.phase + 1) % 3;
        if (b.phase === 2) b.lane = Math.floor(this.rand() * 3) - 1;
        b.phaseT = b.phase === 0 ? 1.5 : b.phase === 1 ? 1.15 : 1.8;
      }
      // The open lane is the one illuminated by the train's amber marker.
      const openLane = b.phase === 2 ? b.lane : Math.max(-1, Math.min(1, b.lane + (b.phase === 0 ? -1 : 1)));
      if (b.z < 1.6 && b.z > -0.8 && Math.abs(this.px - openLane) > 0.62 && this.jumpH < RAIL_CLEAR) {
        const away = Math.sign(this.px - b.lane) || 1;
        if (this.shield) this.breakShield(away);
        else if (this.nitroT > 0 || this.invuln > 0) {
          // shrug it off — nitro/invulnerability powers through the train
        } else {
          this.doCrash("#fb7185", "Road Train", away);
          return;
        }
      }
      if (b.z < -1.5) {
        if (this.boss && Math.abs(this.px - openLane) < 0.8) {
          this.stats.bossWins++;
          this.score += Math.round(1200 * this.multiplier);
          this.coinsCollected += 15;
          this.addText(this.W / 2, this.H * 0.25, "BOSS CLEARED! +15 COINS", "#fde68a", 1.05);
        }
        this.boss = null;
      }
    }

    // power-up timers
    if (this.nitroT > 0) {
      this.nitroT -= dt;
      if (this.nitroT <= 0) { this.camZoomTarget = 1; this.addText(this.xAt(this.px, 0.5), this.yAt(0.5) - 150, "NITRO OVER", "#fca5a5", 0.9); }
    }
    if (this.magnetT > 0) this.magnetT -= dt;
    if (this.warpT > 0) {
      this.warpT -= dt;
      if (this.warpT <= 0) sfx.warpOut();
    }
    if (this.invuln > 0) this.invuln -= dt;
    this.camZoom += (this.camZoomTarget - this.camZoom) * Math.min(1, dt * 4);

    // dynamic time of day
    if (this.settings.dynamicTime && !this.settings.useCustom) {
      const stage = this.distance / 900;
      const i = Math.floor(stage) % CYCLE.length;
      const j = (i + 1) % CYCLE.length;
      const f = stage - Math.floor(stage);
      const blended = blendThemes(CYCLE[i], CYCLE[j], f);
      if (this.forcedWeather) blended.weather = this.forcedWeather;
      const weatherChanged = blended.weather !== this.theme.weather;
      this.theme = blended;
      if (weatherChanged) this.initWeather();
    }

    // tunnels
    if (tunnelSchedule(this.distance, this.nextTunnel) && this.tunnelUntil < this.distance) {
      const zenTunnel = this.settings.mode === "zen";
      this.tunnelUntil = this.distance + 260 + this.rand() * 180;
      this.nextTunnel = this.tunnelUntil + (zenTunnel ? 1500 + this.rand() * 800 : 700 + this.rand() * 500);
      sfx.setTunnel(true);
      this.addText(this.W / 2, this.H * 0.3, "TUNNEL", "#a5f3fc", 1);
    }
    const inTunnel = this.distance < this.tunnelUntil;
    if (inTunnel) this.stats.tunnelDistance += this.speed * dt;
    else if (this.tunnelUntil > 0 && this.distance >= this.tunnelUntil) {
      sfx.setTunnel(false);
      this.tunnelUntil = 0;
    }

    // ---------------- police chase: every 2 minutes (never in Zen) ----------------
    if (this.settings.mode !== "zen" && policeSchedule(this.time, this.nextPoliceAt) && this.policeT <= 0) {
      this.wanted = Math.min(this.wanted + 1, 5);
      this.stats.chases++;
      this.policeT = 18 + this.wanted * 4;
      this.nextPoliceAt = this.time + POLICE_EVERY;
      this.spotLane = Math.floor(this.rand() * 3) - 1;
      this.spotTimer = 2.4;
      this.heliX = -0.3;
      this.chasers = [];
      const units = Math.min(1 + Math.floor(this.wanted / 1.5), 3);
      for (let i = 0; i < units; i++) {
        const lane = [-1, 0, 1][(i + Math.floor(this.rand() * 3)) % 3];
        this.chasers.push({
          lane, laneF: lane, closeness: 0,
          lungeT: 2.5 + this.rand() * 2, lunging: false, sway: this.rand() * 6,
        });
      }
      sfx.startSiren();
      this.addText(this.W / 2, this.H * 0.26, `WANTED ×${this.wanted}`, "#60a5fa", 1.3);
      this.addText(this.W / 2, this.H * 0.26 + 40, "POLICE CHASE!", "#f87171", 1.05);
      this.flash("90,140,255", 0.45);
      this.shake(10, 0.4);
      this.buzz([30, 50, 30]);
    }

    if (this.ramCooldown > 0) this.ramCooldown -= dt;

    if (this.policeT > 0) {
      this.policeT -= dt;
      this.heliX += dt * 0.12;
      if (this.heliX > 1.3) this.heliX = -0.3;

      // spotlight telegraphs a spike strip
      this.spotTimer -= dt;
      if (this.spotTimer <= 0) {
        this.spotTimer = Math.max(1.3, 2.4 - this.wanted * 0.18) + this.rand();
        this.spotLane = Math.floor(this.rand() * 3) - 1;
        if (this.settings.mode !== "practice") this.spawnHazard(this.spotLane, "spikes");
      }

      // pursuing cruisers hunt your lane and lunge for a PIT
      for (const ch of this.chasers) {
        ch.sway += dt * 2.4;
        const aggression = 0.45 + this.wanted * 0.12;
        ch.laneF += (this.px - ch.laneF) * Math.min(1, dt * aggression);
        ch.lane = Math.max(-1, Math.min(1, Math.round(ch.laneF)));

        ch.lungeT -= dt;
        if (ch.lungeT <= 0 && !ch.lunging) {
          ch.lunging = true;
          ch.lungeT = 0.85;
          sfx.honk();
        } else if (ch.lunging && ch.lungeT <= 0) {
          ch.lunging = false;
          ch.lungeT = Math.max(1.8, 4 - this.wanted * 0.35) + this.rand() * 1.5;
        }

        const target = ch.lunging ? 1 : 0.35 + Math.sin(ch.sway) * 0.12;
        ch.closeness += (target - ch.closeness) * Math.min(1, dt * (ch.lunging ? 4.5 : 1.6));

        // PIT manoeuvre: shunted sideways, never an instant kill
        if (
          ch.lunging && ch.closeness > 0.82 && this.ramCooldown <= 0 &&
          Math.abs(this.px - ch.laneF) < 0.5 && this.jumpH < 0.3 && this.invuln <= 0
        ) {
          this.ramCooldown = 1.6;
          ch.closeness = 0.2;
          ch.lunging = false;
          ch.lungeT = 2.5;
          if (this.shield) {
            this.breakShield();
          } else if (this.nitroT > 0) {
            this.score += Math.round(200 * this.multiplier);
            this.addText(this.xAt(this.px, 0.4), this.yAt(0.4) - 150, "SHRUGGED OFF!", "#ffd166", 1);
          } else {
            const dir = this.px >= 0 ? -1 : 1;
            this.lane = Math.max(-1, Math.min(1, this.lane + dir));
            this.combo = 0;
            this.comboTimer = 0;
            this.invuln = 1.1;
            this.flash("90,140,255", 0.6);
            this.shake(16, 0.45);
            sfx.land();
            this.spawnSparks(this.xAt(this.px, 0.2), this.yAt(0.2) - 40, 18, ["#93c5fd", "#ffffff", "#f87171"]);
            this.addText(this.xAt(this.px, 0.4), this.yAt(0.4) - 150, "RAMMED!", "#f87171", 1.1);
            this.buzz([60, 30, 60]);
          }
        }
      }

      if (this.policeT <= 0) {
        sfx.stopSiren();
        this.chasers = [];
        const bonus = Math.round(500 * this.wanted * this.effMul());
        this.score += bonus;
        this.addText(this.W / 2, this.H * 0.26, "LOST THEM!", "#4ade80", 1.2);
        this.addText(this.W / 2, this.H * 0.26 + 38, `+${bonus}`, "#7cffc4", 1);
        this.replayEvent("WANTED SURVIVED");
        this.flash("80,220,140", 0.35);
      }
    }

    // combo decay
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    sfx.setComboLayer(this.combo >= 5 ? 2 : this.combo >= 3 ? 1 : 0);

    // lane easing + surface-specific audio & tactile signature
    const physicalSurface = this.settings.mode === "zen" || this.settings.mode === "practice" ? "asphalt" : this.lastSurface;
    const surfaceControl = physicalSurface === "oil" ? 0.48 : physicalSurface === "gravel" ? 0.72 : physicalSurface === "wet" ? 0.8 : 1;
    const wx = this.weatherFx();
    const weatherControl = wx.startsWith("WET") ? 0.8 : 1;
    // aquaplaning: standing water at speed briefly steals steering authority
    const aquaControl = this.aquaplaneT > 0.15 ? 0.38 : 1;
    const controlResponse = 13 * surfaceControl * weatherControl * aquaControl * this.bikeStats().handling * (this.driftT > 0 ? 0.62 : 1);
    if (this.aquaplaneT > 0.15) {
      this.px += Math.sin(this.time * 9) * dt * 0.1;
      this.shake(2.2, 0.08, Math.sin(this.time * 8));
    }
    if (wx.startsWith("ICY") && this.brakeT > 0 && this.jumpH < 0.05) {
      this.px += (this.tilt >= 0 ? 1 : -1) * dt * 0.22;
    }
    this.px += (this.lane - this.px) * Math.min(1, dt * controlResponse);
    if (physicalSurface !== "asphalt" && this.jumpH < 0.08 && this.phase === "playing") {
      sfx.surfaceTick(physicalSurface);
      if (physicalSurface === "oil") {
        this.px += Math.sin(this.time * 5.4) * dt * 0.065;
        this.shake(1.8, 0.08, Math.sin(this.time * 7));
      } else if (physicalSurface === "gravel") {
        this.shake(2.6, 0.06, 0);
      } else if (physicalSurface === "wet") {
        this.shake(1.4, 0.06, 0);
      }
    }
    // wheelie: hold Q / the wheelie button on the ground for escalating style points
    if (this.wheelie && this.jumpH <= 0 && this.brakeT <= 0) {
      this.wheelieT += dt;
      this.wheelieTotal += dt;
      this.score += (15 + this.wheelieT * 30) * dt * this.multiplier;
    } else if (this.wheelieT > 0) {
      if (this.wheelieT > 1) {
        const bonus = Math.round(this.wheelieT * 90 * this.multiplier);
        this.score += bonus;
        this.addText(this.xAt(this.px, 0.4), this.yAt(0.4) - 140, `WHEELIE ${this.wheelieT.toFixed(1)}s +${bonus}`, "#fde047", 0.95);
        this.nitroMeter = Math.min(1, this.nitroMeter + this.wheelieT * 0.04);
      }
      this.wheelieT = 0;
    }

    // one-switch assist auto-steers; tilt steering maps phone roll to lanes.
    // Both funnel through move() so Mirror Mode inverts them like every other input.
    if (this.settings.assist && this.canAct() && !this.grinding) {
      this.assistT -= dt;
      if (this.assistT <= 0) {
        this.assistT = 0.16;
        const target = this.safestLane();
        if (target !== this.lane) this.move(Math.sign(target - this.lane));
      }
    } else if (this.settings.tilt && this.canAct() && !this.grinding) {
      const g = this.tiltGamma - (this.settings.tiltZero ?? 0);
      const th = 16 / Math.max(0.4, this.settings.tiltSens ?? 1);
      const want = g > th ? 1 : g < -th ? -1 : 0;
      if (want !== this.lane) this.move(want > this.lane ? 1 : -1);
    }

    const vx = (this.lane - this.px) * 13;
    this.tilt += (vx * 0.055 - this.tilt) * Math.min(1, dt * 10);

    // jump + trick physics
    // sky-rail grind: land on a rail while descending to lock on
    const railUnder = this.rails.some((r) => r.z < 0.6 && r.z + r.len > -0.5);
    if (!this.grinding && railUnder && this.jumpV < 0 && this.jumpH <= RAIL_H + 0.12 && this.jumpH >= RAIL_H - 0.35) {
      this.grinding = true;
      this.grindBalance = 0;
      this.jumpH = RAIL_H;
      this.jumpV = 0;
      this.trick = null;
      sfx.ramp();
      this.addText(this.xAt(this.px, 0.4), this.yAt(0.4) - 190, "RAIL GRIND!", "#67e8f9", 1.1);
    }
    if (this.grinding) {
      this.grindTotal += dt;
      // balance drifts and self-amplifies; steering pushes it back toward centre
      this.grindBalance += ((this.rand() - 0.5) * 1.6 + this.grindBalance * 1.1) * dt;
      this.score += 70 * dt * this.multiplier;
      this.nitroMeter = Math.min(1, this.nitroMeter + dt * 0.05);
      this.jumpH = RAIL_H;
      this.jumpV = 0;
      if (Math.abs(this.grindBalance) > 1) {
        this.grinding = false;
        this.jumpV = 0;
        this.addText(this.xAt(this.px, 0.4), this.yAt(0.4) - 170, "LOST BALANCE", "#fca5a5", 0.9);
      } else if (!railUnder) {
        this.grinding = false;
        this.jumpV = 1.2;
        const bonus = Math.round(this.grindTotal * 40 * this.multiplier);
        this.score += bonus;
        this.addText(this.xAt(this.px, 0.4), this.yAt(0.4) - 170, `GRIND CLEAN +${bonus}`, "#7cffc4", 1);
      }
    }

    if (this.jumpH > 0 && !this.grinding) {
      this.airT += dt;
      this.jumpV -= GRAV * dt;
      this.jumpH += this.jumpV * dt;
      if (this.trick) {
        this.trick.t += dt;
        this.trickRot = (this.trick.t / this.trick.dur) * Math.PI * 2;
        if (this.trick.t >= this.trick.dur) this.finishTrick(true);
      }
      if (this.jumpH <= 0) {
        const air = this.airT;
        this.jumpH = 0;
        this.jumpV = 0;
        if (this.trick) {
          // landed mid-trick: wipeout
          this.trick = null;
          this.trickRot = 0;
          if (this.settings.mode !== "zen") {
            this.addText(this.xAt(this.px, 0.4), this.yAt(0.4) - 150, "BAILED!", "#fca5a5", 1.1);
            this.doCrash("#f59e0b", "Mid-Trick Bail", 1);
            return;
          }
        }
        sfx.land();
        this.shake(air > 0.5 ? 7 : 4, 0.16);
        const lx = this.xAt(this.px, 0);
        const ly = this.yAt(0);
        for (let i = 0; i < this.pCount(12, 6); i++) {
          this.particles.push({
            x: lx + (Math.random() - 0.5) * 40, y: ly,
            vx: (Math.random() - 0.5) * 220, vy: -Math.random() * 40,
            life: 0.35, maxLife: 0.35, size: 3 + Math.random() * 5,
            color: "rgba(230,220,255,0.5)", grav: 260, shape: "smoke",
          });
        }
        if (air > 0.55) {
          const bonus = Math.round(air * 120 * this.multiplier);
          this.score += bonus;
          this.addText(lx, ly - 150, "BIG AIR!", "#7dd3fc", 1.05);
          this.addText(lx, ly - 118, `+${bonus}`, "#7cffc4", 0.85);
        }
        if (this.stuntChain > 1) {
          const chainBonus = Math.round(this.stuntChain * 180 * this.effMul() * (this.stuntChain >= 3 ? 2.5 : 1));
          this.score += chainBonus;
          this.addText(lx, ly - 190, `STUNT CHAIN ×${this.stuntChain}  +${chainBonus}`, "#f9a8d4", 1);
          sfx.stunt(this.stuntChain);
          // ---- Multi-Trick Freestyle: a triple chain gets the full fireworks ----
          if (this.stuntChain >= 3) {
            this.replayEvent("TRIPLE STUNT!");
            this.addText(lx, ly - 224, "TRIPLE STUNT!! ×2.5 STYLE", "#fde047", 1.2);
            sfx.powerup();
            sfx.announce(this.settings.announcer, "Triple stunt!");
            this.flash("249,168,212", 0.5);
            this.slowmo = Math.min(this.slowmo, 0.5);
            this.shake(10, 0.4);
            // fireworks burst
            const n = this.pCount(42, 21);
            for (let i = 0; i < n; i++) {
              const a = Math.random() * Math.PI * 2;
              this.particles.push({
                x: lx, y: ly - 90, vx: Math.cos(a) * (140 + Math.random() * 300),
                vy: Math.sin(a) * (140 + Math.random() * 300) - 160,
                life: 0.8 + Math.random() * 0.6, maxLife: 1.4,
                size: 2 + Math.random() * 5,
                color: ["#f9a8d4", "#fde047", "#a5f3fc", "#ffffff"][Math.floor(Math.random() * 4)],
                grav: 300, shape: "spark",
              });
            }
            // neon sparks racing along the screen borders
            if (!this.settings.reduceMotion) {
              for (let b = 0; b < 10; b++) {
                const top = b % 2 === 0;
                this.particles.push({
                  x: Math.random() * this.W, y: top ? 4 : this.H - 4,
                  vx: (Math.random() - 0.5) * 420, vy: top ? 60 : -60,
                  life: 0.7, maxLife: 0.7, size: 2 + Math.random() * 3,
                  color: ["#f9a8d4", "#a5f3fc", "#fde047"][Math.floor(Math.random() * 3)],
                  grav: 0, shape: "spark",
                });
              }
            }
          }
        }
        this.stuntChain = 0;
        this.stuntKinds.clear();
        this.airT = 0;
        // ---- buffered jump: a press remembered just before touchdown ----
        if (this.jumpBufferT > 0) {
          this.jumpBufferT = 0;
          this.doJump();
        }
      }
    }
    const airborne = this.jumpH > 0.14;
    const aboveAll = this.jumpH >= RAIL_CLEAR;

    // buffered jump window ticks down even while grounded
    if (this.jumpBufferT > 0) this.jumpBufferT = Math.max(0, this.jumpBufferT - dt);
    // slingshot charge slowly bleeds when the draft is broken
    if (this.slingMeter > 0 && this.slingMeter < 1 && this.slingActive <= 0) {
      this.slingMeter = Math.max(0, this.slingMeter - dt * 0.1);
    }
    // replay event channel decays
    if (this.replayEventT > 0) {
      this.replayEventT -= dt;
      if (this.replayEventT <= 0) this.replayEventText = null;
    }

    // ghost recording
    this.recTimer -= dt;
    if (this.recTimer <= 0 && this.settings.mode === "classic") {
      this.recTimer = 1 / 15;
      this.ghostRec.push({
        t: +this.time.toFixed(2),
        x: +this.px.toFixed(3),
        h: +this.jumpH.toFixed(3),
      });
    }
    this.ghostT = this.time;

    this.replayTimer -= dt;
    if (this.replayTimer <= 0) {
      this.replayTimer = 1 / 15;
      this.replayFrames.push({
        t: +this.time.toFixed(2), x: +this.px.toFixed(3), h: +this.jumpH.toFixed(3),
        score: Math.floor(this.score), speed: Math.round(this.speed * 3.1), lane: this.lane,
        event: this.replayEventText ?? this.trick?.name,
      });
    }

    // props
    for (const p of this.props) {
      p.z -= this.speed * dt;
      if (p.z < -1) {
        p.z += Z_FAR;
        p.kind = this.pickProp(this.theme.props);
        p.h = 0.7 + Math.random() * 0.75;
        p.hue = Math.random() * 360;
        p.seed = Math.random() * 1000;
      }
    }

    // rails
    for (let i = this.rails.length - 1; i >= 0; i--) {
      this.rails[i].z -= this.speed * dt;
      if (this.rails[i].z + this.rails[i].len < -4) this.rails.splice(i, 1);
    }

    // spawning (scaled by explicit per-mode curve)
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      if (this.settings.mode !== "bossrush") this.spawnWave();
      const approach = this.speed + 14;
      const gap = Math.max(d.gap - this.time * curve.gapDecay, d.gapMin);
      this.spawnTimer = (gap / Math.max(0.55, routeFactor)) / approach;
    }
    this.coinTimer -= dt;
    if (this.coinTimer <= 0) {
      const zenCoins = this.settings.mode === "zen";
      this.coinTimer = zenCoins ? 2.6 + this.rand() * 2.6 : 5 + this.rand() * 5;
      const lanes = this.safeCoinLanes(Z_FAR + 4);
      if (lanes.length) {
        this.spawnCoinLine(lanes[Math.floor(this.rand() * lanes.length)], Z_FAR + 4, this.rand() < 0.35 ? 0.46 : 0);
      }
    }
    this.hazardTimer -= dt;
    if (this.hazardTimer <= 0) {
      const hazardDensity = clampNum(this.settings.route.hazards, 0.5, 1.8, 1) * curve.hazardMul;
      this.hazardTimer = (Math.max(d.hazard - this.time * 0.05, 3.4) + this.rand() * 2.5) / Math.max(0.25, hazardDensity);
      if (this.time > 6 && this.settings.mode !== "practice") this.spawnHazard();
    }
    this.pupTimer -= dt;
    if (this.pupTimer <= 0) {
      const zenPup = this.settings.mode === "zen";
      this.pupTimer = zenPup ? 7 + this.rand() * 6 : 13 + this.rand() * 10;
      if (this.time > 5) this.spawnPickup();
    }

    // ---------------- cars ----------------
    const trafficScale = this.warpT > 0 ? 0.3 : 1;
    let danger = false;
    let slipCharging = false;
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      if (c.flung) {
        c.flyVy -= 9 * dt;
        c.flyH += c.flyVy * dt;
        c.flyRot += dt * 4;
        c.z -= this.speed * dt * 0.6;
        if (c.flyH < -2 || c.z < -8) this.cars.splice(i, 1);
        continue;
      }

      const prevZ = c.z;
      c.z -= (this.speed + c.speed * trafficScale) * dt;
      if (c.flashT > 0) c.flashT -= dt;
      // weaving AI: signal, then slide across
      if (c.weaver && c.weaveTo !== c.lane) {
        if (!c.weaving && c.z < 30) {
          c.weaving = true;
        }
        if (c.weaving) {
          c.signalT += dt;
          if (c.z < 20) {
            c.laneF += Math.sign(c.weaveTo - c.laneF) * dt * 1.1;
            if (Math.abs(c.weaveTo - c.laneF) < 0.06) {
              c.laneF = c.weaveTo;
              c.lane = c.weaveTo;
            }
          }
        }
      } else {
        c.laneF += (c.lane - c.laneF) * Math.min(1, dt * 4);
      }

      if (!c.honked && c.z < 20 && Math.abs(this.px - c.laneF) < 0.6) {
        c.honked = true;
        sfx.honk();
      }

      const dxLane = Math.abs(this.px - c.laneF);
      const hitSlack = this.settings.mode === "zen" ? 0.16 : 0;
      // swept test: at high speed a car can cross the whole hit window in one
      // frame — evaluate the collision at the crossing plane instead of skipping it
      const zTest = prevZ > 1.7 && c.z < -1.2 ? 0.25 : c.z;
      const hit = vehicleHit(
        this.px,
        this.jumpH,
        { lane: c.laneF, z: zTest, halfWidth: LANE_HALF + c.spec.w - 0.42 - hitSlack },
        this.carClearHeight(c),
      );
      const awayDir = Math.sign(this.px - c.laneF) || 1;
      const eta = c.z / Math.max(1, this.speed + c.speed);
      const isHeavy = c.spec.kind === "truck" || c.spec.kind === "bus";
      if (isHeavy && Math.abs(c.laneF - this.lane) < 0.6 && c.z > 0 && eta < 2) {
        danger = true;
      }
      // held slipstream: riding alongside passing traffic charges the skill-nitro bar
      if (c.z > 0.4 && c.z < 7 && dxLane > 0.55 && dxLane < 1.35 && this.jumpH < 0.2) slipCharging = true;

      // ---- slingshot charging: hold your ground head-on with oncoming traffic ----
      if (
        this.warpZoneT <= 0 && c.z > 2 && c.z < 10 && dxLane < 0.45 && this.jumpH < 0.2 &&
        this.slingActive <= 0 && this.slingMeter < 1
      ) {
        this.slingMeter = Math.min(1, this.slingMeter + dt * (0.34 + (isHeavy ? 0.14 : 0)));
        if (this.slingMeter >= 1 && !this.slingReady) {
          this.slingReady = true;
          this.addText(this.xAt(this.px, 0.4), this.yAt(0.4) - 175, "SLINGSHOT READY · JUMP [X]", "#fdba74", 0.95);
          sfx.bank();
        }
      }

      // ---- directional audio assistance: stereo cue for off-lane threats ----
      if (
        this.settings.directionalAudio && c.z > 3 && c.z < 14 && dxLane > 0.5 && this.warpZoneT <= 0
      ) {
        sfx.threatCue(Math.sign(c.laneF - this.px) || 1, this.carClearHeight(c) !== Number.POSITIVE_INFINITY);
      }

      // ---- adaptive heartbeat: a heavy 0.1 s from impact at high speed ----
      if (this.settings.heartbeatAudio && isHeavy && eta < 0.45 && this.speed > 26 && this.invuln <= 0) {
        sfx.setPanic(true);
      }

      if (hit && !aboveAll) {
        // flatbed ramp launches you skyward instead of killing you
        if (c.spec.kind === "flatbed" && this.jumpH < 0.18) {
          this.jumpV = RAMP_V;
          this.jumpH = Math.max(this.jumpH, 0.05);
          this.airT = 0;
          this.stats.ramps++;
          this.stats.jumps++;
          sfx.ramp();
          this.spawnRail();
          this.addText(this.xAt(this.px, 0.5), this.yAt(0.5) - 140, "RAMP LAUNCH!", "#fde68a", 1.15);
          this.replayEvent("RAMP LAUNCH");
          this.juiceEvent(180, 0);
          this.buzz(30);
          continue;
        }
        const cleared = this.jumpH >= this.carClearHeight(c);
        if (!cleared) {
          if (this.fusionActivePhase()) {
            // Phase Shift: quantum ghost state — pass straight through heavies
          } else if (this.nitroT > 0) {
            this.flingCar(c);
            continue;
          } else if (this.invuln > 0) {
            // pass through harmlessly
          } else if (this.shield) {
            this.breakShield(awayDir);
          } else {
            this.doCrash(c.color, this.carLabel(c.spec.kind), awayDir);
            return;
          }
        }
      }

      if (!c.passed && prevZ > 0.4 && c.z <= 0.4) {
        c.passed = true;
        const cleared = this.jumpH >= this.carClearHeight(c) || aboveAll;
        if (cleared && dxLane < 0.7) {
          this.stats.carsJumped++;
          if (c.spec.kind === "police") this.stats.policeJumped++;
        }
        if (dxLane < 0.95 || (dxLane < 1.3 && airborne)) {
          this.combo = Math.min(this.combo + 1, 9);
          this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
          this.comboTimer = 3;
          this.stats.nearMisses++;
          this.nitroMeter = Math.min(1, this.nitroMeter + (dxLane < 0.82 ? 0.12 : 0.07));
          const over = cleared && dxLane < 0.6;
          const actionSucceeded = (this.actionType === "jump" && cleared) || (this.actionType === "lane" && dxLane < 0.78);
          const perfect = isPerfectDodge(this.time, this.lastActionAt, dxLane, actionSucceeded);
          const grade = nearMissGrade(dxLane);
          const bonus = Math.round((perfect ? 360 : over ? 120 : dxLane < 0.5 ? 110 : 50) * this.combo * this.multiplier);
          this.score += bonus;

          // Cash in any banked combo!
          let totalJuice = bonus;
          if (this.bankedCombo > 0) {
            const cashBonus = Math.round(this.bankedCombo * 95 * this.multiplier);
            const cashCoins = this.bankedCombo * 2;
            this.score += cashBonus;
            this.coinsCollected += cashCoins;
            totalJuice += cashBonus;
            sfx.cashIn();
            this.addText(
              this.xAt(this.px, 0.35),
              this.yAt(0.35) - 172,
              `BANK ×${this.bankedCombo} CASHED! +${cashBonus}`,
              "#fde047",
              1.05
            );
            this.bankedCombo = 0;
          }

          const x = this.xAt((this.px + c.laneF) / 2, 0.5);
          const y = this.yAt(0.5) - 90;
          this.addText(
            x, y,
            perfect ? "PERFECT!" : over ? `HURDLE ×${this.combo}` : `${grade} ×${this.combo}`,
            perfect ? "#ffffff" : over ? "#7dd3fc" : "#ffe066",
            1 + Math.min(this.combo * 0.08, 0.5)
          );
          this.addText(x, y + 34, `+${bonus}`, "#7cffc4", 0.9);
          this.spawnSparks(this.xAt(c.laneF, 0.4), this.yAt(0.4) - 40, 10, ["#ffe066", "#ffffff", "#7cffc4"]);
          this.juiceEvent(totalJuice, awayDir);
          sfx.nearMiss();
          sfx.announce(this.settings.announcer, perfect ? "Perfect!" : grade.toLowerCase());
          if (perfect) {
            this.perfectCount++;
            this.replayEvent("PERFECT DODGE");
            this.nitroMeter = Math.min(1, this.nitroMeter + 0.22);
            this.slowmo = Math.min(this.slowmo, 0.45);
            this.flash("180,230,255", 0.48);
            this.camZoomTarget = this.settings.reduceMotion ? 1 : 1.035;
            sfx.perfectSlow();
          }
          this.buzz(18);
        }
      }
      if (c.z < -6) this.cars.splice(i, 1);
    }

    if (slipCharging) {
      const racerBonus = this.settings.bikeId === "racer" && (this.settings.bikeMastery ?? 0) >= 3 ? 1.08 : 1;
      const before = this.nitroMeter;
      this.nitroMeter = Math.min(1, this.nitroMeter + dt * 0.16 * racerBonus);
      this.draftT = Math.max(this.draftT, 0.25);
      if (before < 1 && this.nitroMeter >= 1) {
        this.addText(this.xAt(this.px, 0.4), this.yAt(0.4) - 150, "NITRO READY · [N]", "#fdba74", 0.95);
        sfx.bank();
      }
    }
    this.dangerNow = danger && !this.crashed;
    sfx.setDanger(this.dangerNow);
    // adaptive heartbeat releases once the immediate threat has passed
    if (!this.dangerNow) sfx.setPanic(false);

    // ---------------- hazards ----------------
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const hz = this.hazards[i];
      const prevZ = hz.z;
      hz.z -= this.speed * dt;
      const dxLane = Math.abs(this.px - hz.lane);
      const clearH = hz.kind === "barrier" ? 0.3 : hz.kind === "spikes" ? 0.22 : 0.16;
      const hzSlack = this.settings.mode === "zen" ? 0.5 : 0.62;
      const hzTest = prevZ > 1.3 && hz.z < -0.8 ? 0.25 : hz.z;
      if (hazardHit(this.px, this.jumpH, { lane: hz.lane, z: hzTest, halfWidth: hzSlack }, clearH)) {
        if (this.nitroT > 0 || this.invuln > 0) {
          this.hazards.splice(i, 1);
          continue;
        }
        // ---- Spike Armor gadget: destroys the first hazard you hit ----
        if (this.gadgetArmor) {
          this.gadgetArmor = false;
          this.hazards.splice(i, 1);
          const bonus = Math.round(120 * this.effMul());
          this.score += bonus;
          this.addText(this.xAt(this.px, 0.4), this.yAt(0.4) - 155, `SPIKE ARMOR! +${bonus}`, "#a3e635", 1.05);
          this.spawnSparks(this.xAt(this.px, 0.2), this.yAt(0.2) - 50, 18, ["#a3e635", "#ffffff", "#fbbf24"]);
          sfx.glassBreak();
          this.shake(9, 0.3);
          continue;
        }
        const hzAway = Math.sign(this.px - hz.lane) || 1;
        if (this.shield) { this.breakShield(hzAway); this.hazards.splice(i, 1); continue; }
        const hzName = hz.kind === "spikes" ? "Spike Strip"
          : hz.kind === "barrier" ? "Road Barrier"
          : hz.kind === "cone" ? "Traffic Cone" : "Pothole";
        this.doCrash("#f59e0b", hzName, hzAway);
        return;
      }
      if (!hz.cleared && prevZ > 0.3 && hz.z <= 0.3 && dxLane < 0.62) {
        hz.cleared = true;
        const bonus = Math.round(75 * this.multiplier);
        this.score += bonus;
        this.juiceEvent(bonus, 0);
        this.addText(this.xAt(hz.lane, 0.4), this.yAt(0.4) - 160, `CLEARED! +${bonus}`, "#a3e635", 0.9);
        sfx.coin();
      }
      if (hz.z < -4) this.hazards.splice(i, 1);
    }

    // Toll gates: the illuminated centre aperture pays out on a clean pass.
    for (let i = this.tollGates.length - 1; i >= 0; i--) {
      const gate = this.tollGates[i];
      const prevGateZ = gate.z;
      gate.z -= this.speed * dt;
      // swept test keeps toll payouts from being skipped at very high speed
      const gateZ = prevGateZ > 0.65 && gate.z < -0.7 ? 0 : gate.z;
      if (!gate.taken && gateZ < 0.65 && gateZ > -0.7) {
        gate.taken = true;
        if (Math.abs(this.px - 0) < 0.62) {
          const coins = 18 + Math.floor(this.rand() * 13);
          this.tollCount++;
          this.stats.tolls++;
          this.coinsCollected += coins;
          this.score += Math.round(coins * 25 * this.effMul());
          this.addText(this.xAt(0, 0.2), this.yAt(0.2) - 155, `TOLL PAID +${coins}`, "#fde68a", 0.95);
          sfx.coin();
          // ---- Toll Boost Booster: fast centre pass = mini-nitro + run multiplier ----
          if (this.speed * 3.1 > 100) {
            this.tollBoosts++;
            this.tollBoostMul = Math.min(4, this.tollBoostMul + 1);
            this.tollBoostUntil = Math.max(this.tollBoostUntil, this.distance + 500);
            this.slingActive = Math.max(this.slingActive, 0.7);
            this.addText(this.W / 2, this.H * 0.3, `TOLL BOOST! ×+${this.tollBoostMul} FOR 500M`, "#fbbf24", 1.1);
            this.replayEvent("TOLL PAID +BOOST");
            sfx.slingshot();
            this.flash("251,191,36", 0.4);
          } else {
            this.addText(this.W / 2, this.H * 0.33, "OVER 100 KM/H FOR A TOLL BOOST", "#cbd5e1", 0.6);
          }
        } else {
          this.addText(this.W / 2, this.yAt(0.2) - 80, "MISSED THE GATE", "#cbd5e1", 0.7);
        }
      }
      if (gate.z < -3) this.tollGates.splice(i, 1);
    }

    // Small roadside objects are safe to smash for satisfying debris and style points.
    for (let i = this.roadside.length - 1; i >= 0; i--) {
      const p = this.roadside[i];
      p.z -= this.speed * dt;
      if (!p.broken && p.z < 0.9 && p.z > -0.8 && Math.abs(this.px - p.lane) < 0.55) {
        p.broken = true;
        const bonus = Math.round(35 * this.multiplier);
        this.score += bonus;
        this.spawnSparks(this.xAt(p.lane, p.z), this.yAt(p.z) - 24, 9, ["#fbbf24", "#ffffff", "#fb7185"]);
        this.addText(this.xAt(p.lane, 0.4), this.yAt(0.4) - 118, `SMASH +${bonus}`, "#fbbf24", 0.75);
        this.shake(2, 0.12);
      }
      if (p.z < -3) this.roadside.splice(i, 1);
    }

    // ---------------- pickups ----------------
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      const prevPuZ = p.z;
      p.z -= this.speed * dt;
      p.spin += dt * 3;
      const puZ = prevPuZ > 1.3 && p.z < -1 ? 0.15 : p.z;
      if (puZ < 1.3 && puZ > -1 && Math.abs(this.px - p.lane) < 0.7 && this.jumpH < 0.6) {
        this.grantPickup(p.kind);
        this.pickups.splice(i, 1);
        continue;
      }
      if (p.z < -3) this.pickups.splice(i, 1);
    }

    // ---------------- coins ----------------
    const magnetOn = this.magnetT > 0 || this.settings.companion === "coin";
    const fullMagnet = this.magnetT > 0;
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const co = this.coins[i];
      const prevCoZ = co.z;
      co.z -= this.speed * dt;
      co.spin += dt * 7;
      if (fullMagnet && co.z < 26 && co.z > -1) {
        co.laneF += (this.px - co.laneF) * Math.min(1, dt * 3.4);
        co.h += (this.jumpH - co.h) * Math.min(1, dt * 3);
      } else if (magnetOn && co.z < 11 && co.z > -1 && Math.abs(this.px - co.laneF) < 1.15) {
        // Companion coin drone gently pulls nearby coins across adjacent edge
        co.laneF += (this.px - co.laneF) * Math.min(1, dt * 2.2);
      } else {
        co.laneF += (co.lane - co.laneF) * Math.min(1, dt * 3);
      }
      const reach = fullMagnet ? 1.05 : magnetOn ? 0.78 : 0.55;
      const vReach = fullMagnet ? 0.75 : 0.38;
      const coZ = prevCoZ > 1.1 && co.z < -0.9 ? 0.1 : co.z;
      if (coZ < 1.1 && coZ > -0.9 && Math.abs(this.px - co.laneF) < reach && Math.abs(this.jumpH - co.h) < vReach) {
        const neonPassive = this.settings.bikeId === "neon" && (this.settings.bikeMastery ?? 0) >= 3 ? 0.05 : 0;
        const coinMult = 1 + (modDouble ? 1 : 0) + (this.settings.upgrades.coin ?? 0) * 0.1 + neonPassive;
        // accumulate fractional coin value so +10% bonuses actually pay out
        this.coinCredit += coinMult;
        // ---- Coin Doubler Radar gadget: every third coin becomes a diamond ----
        if (this.gadgetRadar) {
          this.gadgetRadarCount++;
          if (this.gadgetRadarCount % 3 === 0) {
            this.coinsCollected += 100;
            this.score += Math.round(100 * 12 * this.effMul());
            this.addText(this.xAt(co.laneF, Math.max(co.z, 0.3)), this.yAt(Math.max(co.z, 0.3)) - 70, "DIAMOND +100", "#e0f2fe", 0.9);
            sfx.chime();
            const dx = this.xAt(co.laneF, co.z);
            const dy = this.yAt(co.z) - 60 - this.airOffset(co.h, co.z);
            this.spawnSparks(dx, dy, 14, ["#e0f2fe", "#ffffff", "#7dd3fc"]);
          }
        }
        const whole = Math.floor(this.coinCredit);
        if (whole >= 1) {
          this.coinsCollected += whole;
          this.coinCredit -= whole;
        }
        if (this.jumpH > 0.25) this.stats.airCoins++;
        this.score += 25 * this.multiplier * coinMult;
        this.scorePop = Math.max(this.scorePop, 0.08);
        const x = this.xAt(co.laneF, co.z);
        const y = this.yAt(co.z) - 46 - this.airOffset(co.h, co.z);
        this.spawnCoinBurst(x, y);
        sfx.coin();
        this.coins.splice(i, 1);
        continue;
      }
      if (co.z < -3) this.coins.splice(i, 1);
    }

    this.updateFx(dt);
    this.updateWeather(dt, this.speed);
    emitStats(inTunnel);
  }

  private updateWeather(dt: number, speed: number) {
    if (this.weatherBits.length === 0) return;
    const kind = this.theme.weather;
    const boost = 1 + speed / 40;
    for (let i = 0; i < this.weatherBits.length; i++) {
      const b = this.weatherBits[i];
      b.p += dt * 2.4;
      if (kind === "snow" || kind === "petals" || kind === "ash") {
        b.x += (b.vx + Math.sin(b.p) * 42) * dt;
        b.y += b.vy * dt * boost;
      } else if (kind === "fireflies") {
        b.x += (b.vx + Math.cos(b.p * 0.8) * 26) * dt;
        b.y += (b.vy + Math.sin(b.p) * 22) * dt;
      } else {
        b.x += b.vx * dt * boost;
        b.y += b.vy * dt * boost;
      }
      if (b.y > this.H + 30 || b.x < -80 || b.y < -60) {
        this.weatherBits[i] = this.makeBit(false);
        if (kind === "sand" || kind === "fireflies") {
          this.weatherBits[i].x = this.W + 40;
          this.weatherBits[i].y = Math.random() * this.H;
        }
      }
    }
  }

  private updateFx(dt: number) {
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      if (this.shakeT <= 0) this.shakeMag = 0;
    }
    this.flashA = Math.max(0, this.flashA - dt * 2.2);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt * 0.85;
      t.y -= dt * 55;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
  }

  /* ================================================================
     RENDER
     ================================================================ */

  private render() {
    const { ctx, W, H } = this;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // crash cam zoom focused on the rider
    if (this.camZoom !== 1) {
      const fx = this.xAt(this.px, 0);
      const fy = this.yAt(0) - 60;
      ctx.translate(fx, fy);
      ctx.scale(this.camZoom, this.camZoom);
      ctx.translate(-fx, -fy);
    }

    // crash cam swings toward the side the killer came from
    if (this.crashed && !this.settings.reduceMotion) {
      const k = Math.min(1, this.crashT * 1.8);
      ctx.translate(W / 2, H * 0.7);
      ctx.rotate(this.crashCamX * 0.05 * k);
      ctx.translate(-W / 2, -H * 0.7);
      ctx.translate(this.crashCamX * W * 0.12 * k, 0);
    }

    // subtle camera sway on title attract screen
    if (this.phase === "ready" && !this.settings.reduceMotion) {
      ctx.translate(Math.sin(this.attractT * 0.42) * 9, Math.cos(this.attractT * 0.31) * 4);
    }

    if (this.shakeMag > 0 && this.shakeT > 0) {
      const decay = Math.min(this.shakeT * 3, 1);
      const m = this.shakeMag * decay;
      // Offset away from impact side first, plus micro-jitter
      const biasX = this.shakeDirX * m * 0.72 * decay;
      ctx.translate(biasX + (Math.random() - 0.5) * m * 0.65, (Math.random() - 0.5) * m * 0.75);
    }

    this.drawSky();
    this.drawGround();
    this.drawProps();
    this.drawRoad();
    this.drawTollBoostGlow();
    this.drawWarpZoneGrid();
    this.drawForkLayer();
    this.drawClosingWarning();
    this.drawRails();
    this.drawSurfaces();
    this.drawEntities();
    this.drawDustDevils();
    this.drawCourier();
    this.drawPriorityHazard();
    this.drawBoss();
    this.drawHeliBoss();
    this.drawZepBoss();
    this.drawGhost();
    // On the home screen the hero podium owns the rider, so the road stays an ambient backdrop.
    if (this.phase !== "over" && this.phase !== "ready") {
      this.drawBike();
      this.drawP2();
      this.drawCompanion();
    }
    this.drawParticles();
    this.drawWeather();
    // Night Storm: lightning strobes the whole scene for ~0.2s (reduce-motion aware)
    if (this.lightningFlash > 0) {
      const lf = this.lightningFlash / 0.22;
      const g = ctx.createLinearGradient(0, 0, 0, this.horizonY() + 60);
      g.addColorStop(0, `rgba(238,242,255,${0.55 * lf})`);
      g.addColorStop(1, `rgba(190,205,255,${0.16 * lf})`);
      ctx.fillStyle = g;
      ctx.fillRect(-200, -200, W + 400, this.horizonY() + 260);
    }
    if (this.distance < this.tunnelUntil) this.drawTunnel();
    if (this.policeT > 0) { this.drawPolice(); this.drawChasers(); }
    if (this.fogT > 0) this.drawFog();
    if (this.phase === "playing" && this.weatherFx().startsWith("SAND")) {
      // reduced draw distance: thick haze from the horizon down to mid-screen
      const hz = ctx.createLinearGradient(0, this.horizonY() - 40, 0, H * 0.66);
      hz.addColorStop(0, "rgba(214,160,92,0.92)");
      hz.addColorStop(1, "rgba(214,160,92,0)");
      ctx.fillStyle = hz;
      ctx.fillRect(0, 0, W, H * 0.66);
    }
    if (this.mirrorT > 0) this.drawMirrorGlitch();
    this.drawTexts();
    this.drawSpeedLines();

    if (this.nitroT > 0) this.drawNitroOverlay();
    if (this.warpT > 0) this.drawWarpOverlay();
    if (this.shield) this.drawShieldBubble();

    if (this.flashA > 0) {
      ctx.fillStyle = `rgba(${this.flashColor},${this.flashA})`;
      ctx.fillRect(-200, -200, W + 400, H + 400);
    }

    if (this.countdown > 0 && this.phase === "playing") {
      ctx.fillStyle = "rgba(10,4,26,0.45)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ffe066";
      ctx.font = "900 64px Orbitron, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(Math.max(Math.ceil(this.countdown / 0.3), 1)), W / 2, H / 2);
    }

    const vg = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, H * 0.85);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, this.theme.vignette);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    ctx.restore();
  }

  private layerProjection(): LayerProjection {
    return {
      ctx: this.ctx,
      width: this.W,
      height: this.H,
      horizon: this.horizonY(),
      roadHalf: this.roadHalf(),
      theme: this.theme,
      xAt: (lane, z) => this.xAt(lane, z),
      yAt: (z) => this.yAt(z),
      scaleAt: (z) => this.scaleAt(z),
      roadOffset: this.roadOffset,
    };
  }

  private drawSky() {
    drawSkyScene(this.ctx, this.W, this.horizonY(), this.theme, this.lastT, this.settings.reduceMotion);
  }

  private drawGround() {
    drawGroundLayer(this.ctx, this.W, this.H, this.horizonY(), this.theme);
  }

  private drawRoad() {
    drawDetailedRoad(this.layerProjection());
  }

  private drawForkLayer() {
    drawRoadFork(this.layerProjection(), this.fork);
  }

  /** Same-direction rival courier, always ahead and weaving between lanes. */
  private drawCourier() {
    if (!this.courier.active || this.phase === "ready") return;
    const z = Math.max(3, Math.min(34, this.courier.distance));
    const s = this.scaleAt(z);
    const x = this.xAt(this.courier.lane, z);
    const y = this.yAt(z) + 3 * s;
    const u = Math.min(this.H / 700, 1.2) * s;
    const ctx = this.ctx;
    // persona identity: colored aura + matching name tag
    const [pc1, pc2] = this.persona?.colors ?? ["#f9a8d4", "#f9a8d4"];
    ctx.save();
    ctx.globalAlpha = 0.5;
    const aura = ctx.createRadialGradient(x, y - 40 * u, 0, x, y - 40 * u, 78 * u);
    aura.addColorStop(0, `${pc1}66`);
    aura.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(x, y - 40 * u, 78 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.translate(x, y);
    drawRiderBody(ctx, u, {
      bikeId: "racer",
      helmetId: "frost",
      jacketId: "violet",
      decal: "star",
      plateText: this.courier.name,
    }, "ride", this.wheelSpin * 1.15);
    ctx.restore();
    ctx.fillStyle = pc2;
    ctx.font = `900 ${Math.max(7, 11 * s)}px Orbitron, monospace`;
    ctx.textAlign = "center";
    ctx.fillText(
      `${this.courier.name} · ${this.courier.playerWins}-${this.courier.rivalWins}`,
      x,
      y - 150 * u,
    );
    if (this.persona && s > 0.28) {
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = `600 ${Math.max(5, 7.5 * s)}px Rubik, sans-serif`;
      ctx.fillText(this.persona.tagline, x, y - 138 * u + 2);
    }
  }

  /* ---------------- new feature renders ---------------- */

  /** Cargo Zeppelin: hull, swaying container on a crane line, telegraphed slam glow. */
  private drawZepBoss() {
    const zp = this.zep;
    if (!zp || this.phase === "ready") return;
    const { ctx } = this;
    const s = this.scaleAt(26);
    const u = Math.min(this.H / 700, 1.2) * s * 1.7;
    // the hull drifts across the sky, biased toward its target lane
    const tx = this.xAt(zp.targetLane, 26);
    const drift = Math.sin(zp.t * 0.55) * 120 * s;
    const zx = Math.max(this.W * 0.14, Math.min(this.W * 0.86, tx + drift));
    const zy = this.horizonY() + (this.yAt(26) - this.horizonY()) * 0.1;

    // ---- telegraph glow in the doomed lane ----
    if (zp.telegraph > 0) {
      const bx = this.xAt(zp.targetLane, 0);
      const pulse = 0.3 + 0.22 * Math.sin(this.lastT * 0.024);
      ctx.fillStyle = `rgba(244,114,182,${pulse})`;
      ctx.beginPath();
      ctx.ellipse(bx, this.yAt(0), this.roadHalf() * 0.4, 20 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // sky warn stripe so the player looks up
      ctx.fillStyle = `rgba(244,114,182,${pulse * 0.5})`;
      ctx.fillRect(bx - this.roadHalf() * 0.36, this.horizonY(), this.roadHalf() * 0.72, 4 * s);
    }

    // ---- hull ----
    ctx.save();
    ctx.translate(zx, zy + Math.sin(zp.t * 0.8) * 5 * s);
    // shadow far below
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(0, 34 * u, 44 * u, 7 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    const hull = ctx.createLinearGradient(0, -16 * u, 0, 16 * u);
    hull.addColorStop(0, "#8b8fa3");
    hull.addColorStop(0.55, "#4b4f63");
    hull.addColorStop(1, "#262a3a");
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.ellipse(0, 0, 40 * u, 14 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    // pink stripe + fin
    ctx.fillStyle = "rgba(244,114,182,0.85)";
    ctx.fillRect(-34 * u, -3 * u, 68 * u, 4.5 * u);
    ctx.beginPath();
    ctx.moveTo(-36 * u, -2 * u);
    ctx.lineTo(-50 * u, -12 * u);
    ctx.lineTo(-44 * u, 0);
    ctx.closePath();
    ctx.fill();
    // gondola
    ctx.fillStyle = "#1d2130";
    rrPath(ctx, -10 * u, 13 * u, 20 * u, 7 * u, 3 * u);
    ctx.fill();
    // running lights
    const blink = 0.5 + 0.5 * Math.sin(this.lastT * 0.012);
    ctx.fillStyle = `rgba(255,77,166,${0.4 + blink * 0.6})`;
    ctx.beginPath();
    ctx.arc(30 * u, -4 * u, 2.2 * u, 0, Math.PI * 2);
    ctx.arc(-30 * u, -4 * u, 2.2 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ---- hanging container swings over the telegraphed lane ----
    if (zp.telegraph > 0 || zp.dropT < 0.6) {
      const cx = this.xAt(zp.targetLane, 18);
      const cy = this.horizonY() + (this.yAt(18) - this.horizonY()) * 0.42;
      const sway = Math.sin(zp.swing * 2.4) * 10 * s;
      const drop = zp.telegraph <= 0 ? (0.6 - zp.dropT) * 340 * s : 0;
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = Math.max(1, 1.6 * s);
      ctx.beginPath();
      ctx.moveTo(cx - sway * 0.3, zy + 16 * u);
      ctx.lineTo(cx + sway, cy - 16 * u + drop);
      ctx.stroke();
      ctx.save();
      ctx.translate(cx + sway, cy + drop);
      ctx.rotate(sway * 0.02);
      ctx.fillStyle = "#b45309";
      rrPath(ctx, -14 * u, -12 * u, 28 * u, 24 * u, 3 * u);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = Math.max(1, 1.4 * s);
      for (let i = -8; i <= 8; i += 4) {
        ctx.beginPath();
        ctx.moveTo(i * u, -12 * u);
        ctx.lineTo(i * u, 12 * u);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /** SWAT gunship: hull sprite, lane-targeting crosshair, spotlight beam. */
  private drawHeliBoss() {
    const h = this.heli;
    if (!h || this.phase === "ready") return;
    const { ctx } = this;
    const W = this.W;
    const s = this.scaleAt(26);
    // gunship hovers high above the road, slightly off to the target side
    const hx = this.xAt(h.targetLane, 26);
    const hy = this.horizonY() + (this.yAt(26) - this.horizonY()) * 0.18;
    const u = Math.min(this.H / 700, 1.2) * s * 1.6;

    // ---- spotlight beam (from t>45%: jump it or die) ----
    if (h.beamActive) {
      const bx = this.xAt(h.beamLane, 0);
      const pulse = 0.24 + 0.1 * Math.sin(this.lastT * 0.02);
      const g = ctx.createLinearGradient(0, this.horizonY(), 0, this.H);
      g.addColorStop(0, "rgba(253,224,71,0)");
      g.addColorStop(0.5, `rgba(253,224,71,${pulse})`);
      g.addColorStop(1, `rgba(253,224,71,${pulse * 1.4})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(hx - 30 * s, hy);
      ctx.lineTo(hx + 30 * s, hy);
      ctx.lineTo(bx + this.roadHalf() * 0.42, this.H * 0.99);
      ctx.lineTo(bx - this.roadHalf() * 0.42, this.H * 0.99);
      ctx.closePath();
      ctx.fill();
      // hot pool on the asphalt
      ctx.fillStyle = `rgba(253,224,71,${pulse * 0.7})`;
      ctx.beginPath();
      ctx.ellipse(bx, this.yAt(0), this.roadHalf() * 0.34, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- hull ----
    ctx.save();
    ctx.translate(hx + Math.sin(this.lastT * 0.0013) * 14 * s, hy + Math.sin(this.lastT * 0.0021) * 6 * s);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(0, 26 * u, 30 * u, 6 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    // body
    const body = ctx.createLinearGradient(0, -18 * u, 0, 18 * u);
    body.addColorStop(0, "#3f4654");
    body.addColorStop(1, "#171c26");
    ctx.fillStyle = body;
    this.roundRect(-26 * u, -10 * u, 52 * u, 22 * u, 8 * u);
    ctx.fill();
    // tail boom + rotor
    ctx.fillStyle = "#20242e";
    ctx.fillRect(-44 * u, -4 * u, 20 * u, 4.5 * u);
    ctx.fillRect(-46 * u, -9 * u, 7 * u, 12 * u);
    // cockpit glass
    ctx.fillStyle = "#8ecdfc";
    ctx.beginPath();
    ctx.ellipse(16 * u, -2 * u, 8 * u, 5.5 * u, -0.2, 0, Math.PI * 2);
    ctx.fill();
    // searchlight pod
    ctx.fillStyle = "#fde047";
    ctx.beginPath();
    ctx.arc(8 * u, 12 * u, 3.6 * u, 0, Math.PI * 2);
    ctx.fill();
    // main rotor blade sweep
    ctx.strokeStyle = "rgba(148,163,184,0.75)";
    ctx.lineWidth = Math.max(1.5, 2.6 * u);
    const rotorA = h.rotor;
    ctx.beginPath();
    ctx.moveTo(Math.cos(rotorA) * 40 * u, -14 * u + Math.sin(rotorA) * 4 * u);
    ctx.lineTo(-Math.cos(rotorA) * 40 * u, -14 * u - Math.sin(rotorA) * 4 * u);
    ctx.stroke();
    ctx.restore();

    // ---- lane-targeting crosshair ----
    const cx = this.xAt(h.targetLane, 0);
    const cy = this.yAt(0);
    const lockPulse = 0.5 + 0.5 * Math.sin(this.lastT * 0.018);
    ctx.strokeStyle = `rgba(248,113,113,${0.55 + lockPulse * 0.4})`;
    ctx.lineWidth = Math.max(1.5, 3 * s);
    const r = 26 * s * (1.25 - lockPulse * 0.25);
    ctx.beginPath();
    ctx.arc(cx, cy - 22 * s, r, 0, Math.PI * 2);
    ctx.moveTo(cx - r * 1.5, cy - 22 * s);
    ctx.lineTo(cx - r * 0.7, cy - 22 * s);
    ctx.moveTo(cx + r * 0.7, cy - 22 * s);
    ctx.lineTo(cx + r * 1.5, cy - 22 * s);
    ctx.moveTo(cx, cy - 22 * s - r * 1.5);
    ctx.lineTo(cx, cy - 22 * s - r * 0.7);
    ctx.moveTo(cx, cy - 22 * s + r * 0.7);
    ctx.lineTo(cx, cy - 22 * s + r * 1.5);
    ctx.stroke();
    if (W < 1) return; // (W reserved for future HUD ticks)
  }

  /** Co-op second rider, drawn slightly offset like a mirror wingman. */
  private drawP2() {
    const p2 = this.p2;
    if (!p2 || this.phase === "ready") return;
    const { ctx } = this;
    const x = this.xAt(p2.px, 0);
    const groundY = this.yAt(0) + 6;
    const lift = this.airOffset(p2.jumpH, 0);
    const y = groundY - lift;
    const u = Math.min(this.H / 700, 1.2) * (this.W < 480 ? 0.86 : 0.94);
    const bob = p2.jumpH > 0 ? 0 : Math.sin(this.wheelSpin * 2.2 + 1.4) * 1.6 * u;
    const tilt = Math.max(-0.5, Math.min(0.5, p2.tilt));

    if (!p2.alive) {
      // respawn ghost: fading marker at the re-entry lane
      if (p2.respawnT > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.55, p2.respawnT);
        ctx.fillStyle = "#a3e635";
        ctx.font = `700 ${Math.max(8, 12 * u)}px Orbitron, monospace`;
        ctx.textAlign = "center";
        ctx.fillText("P2 REJOINING", x, groundY - 60 * u);
        ctx.restore();
      }
      return;
    }

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(x + tilt * 16 * u, groundY + 4, 40 * u, 9 * u, 0, 0, Math.PI * 2);
    ctx.fill();

    const flick = p2.invuln > 0 && Math.floor(this.lastT / 70) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = flick ? 0.45 : 0.96;
    ctx.translate(x, y + bob);
    ctx.rotate(tilt);
    if (p2.jumpH > 0) {
      const pitch = Math.sin(Math.min(p2.jumpH / 0.62, 1) * Math.PI) * 0.2;
      ctx.rotate(-pitch * 0.5);
    }
    drawRiderBody(ctx, u, {
      bikeId: COOP_P2_LOOK.bikeId,
      helmetId: COOP_P2_LOOK.helmetId,
      jacketId: COOP_P2_LOOK.jacketId,
      decal: COOP_P2_LOOK.decal,
      plateText: COOP_P2_LOOK.plateText,
    }, p2.jumpH > 0 ? "tuck" : "ride", this.wheelSpin);
    ctx.restore();

    // P2 label
    ctx.fillStyle = "rgba(163,230,53,0.85)";
    ctx.font = `700 ${Math.max(7, 10 * u)}px Orbitron, monospace`;
    ctx.textAlign = "center";
    ctx.fillText("P2", x, groundY - 118 * u);
  }

  /** Desert dust devils: swirling sand columns that shove the bike. */
  private drawDustDevils() {
    if (!this.dustDevils.length) return;
    const { ctx } = this;
    for (const dv of this.dustDevils) {
      if (dv.z > Z_FAR || dv.z < 0.4) continue;
      const s = this.scaleAt(dv.z);
      const x = this.xAt(dv.x, dv.z);
      const y = this.yAt(dv.z);
      const hgt = 120 * s * Math.min(this.H / 700, 1.2);
      const alpha = Math.min(1, dv.life / 1.2) * 0.5;
      const col = ctx.createLinearGradient(x, y - hgt, x, y);
      col.addColorStop(0, `rgba(214,178,116,0)`);
      col.addColorStop(0.55, `rgba(206,166,100,${alpha})`);
      col.addColorStop(1, `rgba(180,140,80,${alpha * 1.2})`);
      ctx.fillStyle = col;
      // wobbling cone of sand
      const wob = Math.sin(dv.spin * 2.4) * 14 * s;
      ctx.beginPath();
      ctx.moveTo(x - 4 * s, y - hgt + wob * 0.4);
      ctx.quadraticCurveTo(x - 22 * s + wob, y - hgt * 0.45, x - 30 * s, y);
      ctx.lineTo(x + 30 * s, y);
      ctx.quadraticCurveTo(x + 22 * s + wob, y - hgt * 0.45, x + 4 * s, y - hgt + wob * 0.4);
      ctx.closePath();
      ctx.fill();
      // rotating debris flecks
      ctx.fillStyle = `rgba(120,90,50,${alpha})`;
      for (let i = 0; i < 5; i++) {
        const a = dv.spin * 3 + (i * Math.PI * 2) / 5;
        const rr = (10 + i * 4) * s;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * rr, y - hgt * 0.35 + Math.sin(a * 1.7) * 12 * s, 1.8 * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** Warp-zone cyber-grid: neon floor overlay replacing traffic for 15s. */
  private drawWarpZoneGrid() {
    if (this.warpZoneT <= 0) return;
    const { ctx } = this;
    const W = this.W;
    const hz = this.horizonY();
    const fade = Math.min(1, this.warpZoneT / 2);
    const alpha = 0.34 * fade * (0.85 + 0.15 * Math.sin(this.lastT * 0.006));
    ctx.save();
    // sky glow
    const sky = ctx.createLinearGradient(0, hz - 90, 0, hz + 40);
    sky.addColorStop(0, "rgba(124,58,237,0)");
    sky.addColorStop(1, `rgba(168,85,247,${alpha * 0.8})`);
    ctx.fillStyle = sky;
    ctx.fillRect(0, hz - 90, W, 130);
    // scrolling floor grid: lanes converge to the horizon
    ctx.strokeStyle = `rgba(217,180,255,${alpha})`;
    ctx.lineWidth = 1.6;
    const lanes = [-1.4, -0.7, 0, 0.7, 1.4];
    for (const l of lanes) {
      ctx.beginPath();
      ctx.moveTo(this.xAt(l * 1.9, 0), this.yAt(0));
      ctx.lineTo(this.xAt(l * 1.9, Z_FAR), this.yAt(Z_FAR));
      ctx.stroke();
    }
    // horizontal scan lines rushing toward the rider
    const speed = (this.lastT * 0.004) % 1;
    for (let i = 0; i < 9; i++) {
      const p = (i + speed) / 9;
      const z = 1 + Math.pow(p, 2.6) * Z_FAR;
      ctx.strokeStyle = `rgba(147,51,234,${alpha * (0.3 + p * 0.9)})`;
      ctx.lineWidth = 1 + p * 2.2;
      ctx.beginPath();
      ctx.moveTo(this.xAt(-2.1, z), this.yAt(z));
      ctx.lineTo(this.xAt(2.1, z), this.yAt(z));
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Toll-boost active: glowing centre-lane carpet for the next 500m. */
  private drawTollBoostGlow() {
    if (this.distance >= this.tollBoostUntil || this.tollBoostMul <= 0) return;
    const { ctx } = this;
    const remaining = Math.max(0, this.tollBoostUntil - this.distance);
    const near = 1.2;
    const far = Math.min(Z_FAR, 30);
    const pulse = 0.16 + 0.1 * Math.sin(this.lastT * 0.014);
    const alpha = pulse * Math.min(1, remaining / 120);
    ctx.save();
    for (let z = far; z > near; z -= 1.6) {
      const s = this.scaleAt(z);
      const x = this.xAt(0, z);
      const y = this.yAt(z);
      ctx.fillStyle = `rgba(251,191,36,${alpha * (1 - z / (far + 6))})`;
      const w = this.roadHalf() * (2 / 3) * 0.62 * s;
      ctx.fillRect(x - w / 2, y - 6 * s, w, 12 * s + 1);
    }
    // multiplier tag riding ahead of the rider
    const tagZ = 4.5;
    ctx.fillStyle = "#fde68a";
    ctx.font = `900 ${Math.max(9, 13 * this.scaleAt(tagZ))}px Orbitron, monospace`;
    ctx.textAlign = "center";
    ctx.fillText(`+${this.tollBoostMul} BOOST`, this.xAt(0, tagZ), this.yAt(tagZ) - 34 * this.scaleAt(tagZ));
    ctx.restore();
  }

  /* ---------------- elevated rails ---------------- */

  private drawRails() {
    const { ctx } = this;
    for (const r of this.rails) {
      const steps = 12;
      for (let i = 0; i < steps; i++) {
        const z = r.z + (i / steps) * r.len;
        if (z < 0.2 || z > Z_FAR) continue;
        const s = this.scaleAt(z);
        const y = this.yAt(z) - this.airOffset(RAIL_H, z);
        const x = this.xAt(0, z);
        const halfW = this.roadHalf() * s * 0.92;
        ctx.fillStyle = `rgba(120,200,255,${0.1 + 0.25 * s})`;
        ctx.fillRect(x - halfW, y, halfW * 2, Math.max(2, 7 * s));
        ctx.fillStyle = `rgba(190,240,255,${0.3 + 0.4 * s})`;
        ctx.fillRect(x - halfW, y, halfW * 2, Math.max(1, 2 * s));
        if (i % 2 === 0) {
          ctx.fillStyle = `rgba(90,160,220,${0.25 * s + 0.1})`;
          ctx.fillRect(x - halfW, y, Math.max(2, 5 * s), 60 * s);
          ctx.fillRect(x + halfW - Math.max(2, 5 * s), y, Math.max(2, 5 * s), 60 * s);
        }
      }
    }
  }

  private drawSurfaces() {
    const { ctx } = this;
    const paint: Record<SurfaceKind, string> = {
      asphalt: "transparent",
      oil: "rgba(168,85,247,0.3)",
      gravel: "rgba(217,180,130,0.38)",
      wet: "rgba(103,232,249,0.24)",
    };
    for (const patch of this.surfaces) {
      const z0 = Math.max(0.05, patch.z);
      const z1 = Math.min(Z_FAR, patch.z + patch.length);
      if (z1 <= z0) continue;
      const s0 = this.scaleAt(z0);
      const s1 = this.scaleAt(z1);
      const x0 = this.xAt(patch.lane, z0);
      const x1 = this.xAt(patch.lane, z1);
      const w0 = this.roadHalf() * (2 / 3) * 0.46 * s0;
      const w1 = this.roadHalf() * (2 / 3) * 0.46 * s1;
      ctx.fillStyle = paint[patch.kind];
      ctx.beginPath();
      ctx.moveTo(x0 - w0, this.yAt(z0));
      ctx.lineTo(x0 + w0, this.yAt(z0));
      ctx.lineTo(x1 + w1, this.yAt(z1));
      ctx.lineTo(x1 - w1, this.yAt(z1));
      ctx.closePath();
      ctx.fill();
      if (patch.kind === "wet") {
        ctx.strokeStyle = "rgba(210,250,255,0.22)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x0 - w0 * 0.4, this.yAt(z0));
        ctx.lineTo(x1 - w1 * 0.4, this.yAt(z1));
        ctx.stroke();
      }
    }
  }

  private drawBoss() {
    const b = this.boss;
    if (!b || b.z > Z_FAR || b.z < -4) return;
    const { ctx } = this;
    const s = this.scaleAt(b.z);
    const cx = this.xAt(b.lane, b.z);
    const y = this.yAt(b.z);
    const laneW = this.roadHalf() * (2 / 3) * s;
    const gapLane = b.phase === 2 ? b.lane : Math.max(-1, Math.min(1, b.lane + (b.phase === 0 ? -1 : 1)));
    const w = laneW * 1.65;
    const h = w * 1.38;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.ellipse(cx, y, w * 0.62, w * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    const body = ctx.createLinearGradient(0, y - h, 0, y);
    body.addColorStop(0, "#64748b");
    body.addColorStop(1, "#1e293b");
    ctx.fillStyle = body;
    this.roundRect(cx - w / 2, y - h, w, h, 10 * s);
    ctx.fill();
    ctx.fillStyle = "#94a3b8";
    this.roundRect(cx - w * 0.35, y - h * 0.92, w * 0.7, h * 0.28, 8 * s);
    ctx.fill();
    ctx.fillStyle = "#f97316";
    ctx.fillRect(cx - w * 0.48, y - h * 0.34, w * 0.96, h * 0.11);
    // two blocking lanes plus a clear, glowing gap marker
    ctx.fillStyle = `rgba(248,113,113,${0.3 + 0.18 * Math.sin(this.lastT / 100)})`;
    for (const lane of [-1, 0, 1]) {
      if (lane === gapLane) continue;
      const lx = this.xAt(lane, b.z);
      ctx.fillRect(lx - laneW * 0.47, y - h * 0.18, laneW * 0.94, h * 0.18);
    }
    const gx = this.xAt(gapLane, b.z);
    ctx.strokeStyle = "#fde68a";
    ctx.lineWidth = Math.max(2, 5 * s);
    ctx.shadowColor = "#fde68a";
    ctx.shadowBlur = 18 * s;
    ctx.beginPath();
    ctx.arc(gx, y - h * 0.15, 18 * s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fde68a";
    ctx.font = `900 ${Math.max(7, 15 * s)}px Orbitron, monospace`;
    ctx.textAlign = "center";
    ctx.fillText("GAP", gx, y - h * 0.15 + 4 * s);
    ctx.fillStyle = "#fff";
    ctx.font = `900 ${Math.max(7, 12 * s)}px Orbitron, monospace`;
    ctx.fillText(b.phase === 0 ? "SWEEP LEFT" : b.phase === 1 ? "SWEEP RIGHT" : "GAP MOVING", cx, y - h * 1.1);
  }

  private drawCompanion() {
    if (this.settings.companion === "none") return;
    const { ctx } = this;
    const x = this.xAt(this.px + 0.78, 0.4) + Math.sin(this.time * 3) * 8;
    const y = this.yAt(0.4) - this.airOffset(this.jumpH, 0) - 110 + Math.sin(this.time * 4) * 7;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 32);
    glow.addColorStop(0, "rgba(103,232,249,0.45)");
    glow.addColorStop(1, "rgba(103,232,249,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = this.settings.companion === "helper" ? "#67e8f9" : "#c4b5fd";
    ctx.beginPath();
    ctx.ellipse(x, y, 13, 9, Math.sin(this.time * 2) * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#071021";
    ctx.beginPath();
    ctx.arc(x + 5, y - 1, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 5, y - 9);
    ctx.lineTo(x + 5, y - 9);
    ctx.stroke();
  }

  private drawFog() {
    const { ctx, W, H } = this;
    ctx.fillStyle = `rgba(5,8,18,${0.56 + 0.08 * Math.sin(this.lastT / 500)})`;
    ctx.fillRect(0, 0, W, H);
    const x = this.xAt(this.px, 0);
    const y = this.yAt(0) - 85;
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    const g = ctx.createRadialGradient(x, y, 12, x, y, H * 0.42);
    g.addColorStop(0, "rgba(0,0,0,0.94)");
    g.addColorStop(0.55, "rgba(0,0,0,0.65)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    ctx.strokeStyle = "rgba(200,220,255,0.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, H * 0.38, -0.48, 0.48);
    ctx.stroke();
  }

  private drawMirrorGlitch() {
    const { ctx, W, H } = this;
    ctx.fillStyle = "rgba(190,80,255,0.07)";
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 8; i++) {
      const y = (Math.sin(this.lastT * 0.01 + i * 4) * 0.5 + 0.5) * H;
      ctx.fillStyle = i % 2 ? "rgba(255,70,180,0.18)" : "rgba(60,230,255,0.15)";
      ctx.fillRect(0, y, W, 2 + (i % 3));
    }
  }

  /* ---------------- props ---------------- */

  private drawProps() {
    const { ctx } = this;
    const sorted = [...this.props].sort((a, b) => b.z - a.z);
    for (const p of sorted) {
      const s = this.scaleAt(p.z);
      if (s < 0.045) continue;
      const spread = p.kind === "skyscraper" || p.kind === "building" ? 2.05 : 1.82;
      const x = this.xAt(p.side * spread, p.z);
      const y = this.yAt(p.z);
      const u = s * this.H * 0.004 * p.h;
      ctx.save();
      ctx.translate(x, y);
      switch (p.kind) {
        case "palm": this.pPalm(u); break;
        case "building": this.pBuilding(u, p.hue); break;
        case "streetlight": this.pStreetlight(u, p.side); break;
        case "billboard": this.pBillboard(u, p.hue); break;
        case "pine": this.pPine(u); break;
        case "cactus": this.pCactus(u); break;
        case "rock": this.pRock(u, p.seed); break;
        case "skyscraper": this.pSkyscraper(u, p.hue, p.seed); break;
        case "neon": this.pNeon(u, p.hue); break;
        case "lantern": this.pLantern(u); break;
        case "torii": this.pTorii(u); break;
        case "sakura": this.pSakura(u, p.seed); break;
        case "windmill": this.pWindmill(u); break;
        case "watertower": this.pWaterTower(u); break;
        case "arch": this.pArch(u); break;
        case "pumpkin": this.pPumpkin(u); break;
        case "gift": this.pGift(u, p.hue); break;
        case "lilypad": this.pFlowerBush(u, p.hue); break;
        case "firework": this.pFirework(u, p.hue); break;
      }
      ctx.restore();
    }
  }

  private pPalm(u: number) {
    const { ctx } = this;
    const h = 140 * u;
    ctx.strokeStyle = this.theme.propTint;
    ctx.lineWidth = Math.max(6 * u, 1);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(10 * u, -h * 0.6, 4 * u, -h);
    ctx.stroke();
    ctx.strokeStyle = "#1e9e6a";
    ctx.lineWidth = Math.max(5 * u, 1);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.55;
      ctx.beginPath();
      ctx.moveTo(4 * u, -h);
      ctx.quadraticCurveTo(
        4 * u + Math.cos(a) * 44 * u, -h + Math.sin(a) * 30 * u - 12 * u,
        4 * u + Math.cos(a) * 62 * u, -h + Math.sin(a) * 48 * u + 16 * u
      );
      ctx.stroke();
    }
  }

  private pBuilding(u: number, hue: number) {
    const { ctx } = this;
    const w = 90 * u, h = 220 * u;
    ctx.fillStyle = this.theme.propTint;
    ctx.fillRect(-w / 2, -h, w, h);
    ctx.fillStyle = `hsla(${(hue % 60) + 180}, 90%, 65%, 0.75)`;
    for (let c = 0; c < 3; c++)
      for (let r = 0; r < 6; r++) {
        if ((c * 7 + r * 3 + Math.floor(hue)) % 4 === 0) continue;
        ctx.fillRect(-w / 2 + w * 0.12 + c * w * 0.3, -h + h * 0.08 + r * h * 0.15, w * 0.17, h * 0.08);
      }
  }

  private pSkyscraper(u: number, hue: number, seed: number) {
    const { ctx } = this;
    const w = 110 * u, h = (340 + (seed % 160)) * u;
    const g = ctx.createLinearGradient(0, -h, 0, 0);
    g.addColorStop(0, this.theme.propTint);
    g.addColorStop(1, "rgba(0,0,0,0.75)");
    ctx.fillStyle = g;
    ctx.fillRect(-w / 2, -h, w, h);
    ctx.fillStyle = `hsla(${(hue % 50) + 185}, 95%, 70%, 0.65)`;
    const rows = Math.floor(h / (16 * u));
    for (let c = 0; c < 4; c++)
      for (let r = 0; r < rows; r++) {
        if ((c * 5 + r * 11 + Math.floor(seed)) % 3 === 0) continue;
        ctx.fillRect(-w / 2 + w * 0.1 + c * w * 0.22, -h + 8 * u + r * 16 * u, w * 0.14, 8 * u);
      }
    ctx.strokeStyle = this.theme.propTint;
    ctx.lineWidth = Math.max(3 * u, 1);
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.lineTo(0, -h - 40 * u);
    ctx.stroke();
    ctx.fillStyle = Math.floor(this.lastT / 500) % 2 === 0 ? "#ff3b3b" : "rgba(255,59,59,0.25)";
    ctx.beginPath();
    ctx.arc(0, -h - 42 * u, 4 * u, 0, Math.PI * 2);
    ctx.fill();
  }

  private pStreetlight(u: number, side: number) {
    const { ctx } = this;
    const h = 190 * u;
    ctx.strokeStyle = this.theme.propTint;
    ctx.lineWidth = Math.max(5 * u, 1);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -h);
    ctx.quadraticCurveTo(0, -h - 26 * u, -side * 40 * u, -h - 24 * u);
    ctx.stroke();
    const lx = -side * 40 * u, ly = -h - 24 * u;
    const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 46 * u);
    g.addColorStop(0, "rgba(255,230,140,0.95)");
    g.addColorStop(1, "rgba(255,230,140,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(lx, ly, 46 * u, 0, Math.PI * 2);
    ctx.fill();
  }

  private pBillboard(u: number, hue: number) {
    const { ctx } = this;
    const w = 120 * u, h = 70 * u, ph = 70 * u;
    ctx.strokeStyle = this.theme.propTint;
    ctx.lineWidth = Math.max(5 * u, 1);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -ph);
    ctx.stroke();
    ctx.fillStyle = `hsl(${hue}, 80%, 55%)`;
    ctx.fillRect(-w / 2, -ph - h, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(-w / 2 + w * 0.1, -ph - h + h * 0.3, w * 0.8, h * 0.16);
    ctx.fillRect(-w / 2 + w * 0.1, -ph - h + h * 0.58, w * 0.5, h * 0.12);
  }

  private pNeon(u: number, hue: number) {
    const { ctx } = this;
    const h = 150 * u, w = 46 * u;
    ctx.strokeStyle = this.theme.propTint;
    ctx.lineWidth = Math.max(4 * u, 1);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -h);
    ctx.stroke();
    const flick = 0.65 + 0.35 * Math.sin(this.lastT * 0.008 + hue);
    const col = `hsl(${hue}, 95%, 62%)`;
    ctx.globalAlpha = flick;
    ctx.strokeStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 16 * u;
    ctx.lineWidth = Math.max(5 * u, 1.5);
    ctx.strokeRect(-w / 2, -h - 70 * u, w, 68 * u);
    ctx.beginPath();
    ctx.moveTo(-w * 0.26, -h - 54 * u);
    ctx.lineTo(-w * 0.26, -h - 18 * u);
    ctx.moveTo(w * 0.26, -h - 54 * u);
    ctx.lineTo(w * 0.26, -h - 18 * u);
    ctx.moveTo(-w * 0.26, -h - 36 * u);
    ctx.lineTo(w * 0.26, -h - 36 * u);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  private pPine(u: number) {
    const { ctx } = this;
    const h = 180 * u, w = 56 * u;
    ctx.fillStyle = "#5b3a26";
    ctx.fillRect(-4 * u, -24 * u, 8 * u, 24 * u);
    for (let i = 0; i < 3; i++) {
      const yTop = -h + i * h * 0.26, yBot = yTop + h * 0.42;
      const ww = w * (0.55 + i * 0.26);
      ctx.fillStyle = i === 0 ? "#1f6b4a" : i === 1 ? "#1a5c40" : "#154d36";
      ctx.beginPath();
      ctx.moveTo(0, yTop);
      ctx.lineTo(-ww, yBot);
      ctx.lineTo(ww, yBot);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.moveTo(0, yTop);
      ctx.lineTo(-ww * 0.52, yBot - h * 0.2);
      ctx.lineTo(ww * 0.52, yBot - h * 0.2);
      ctx.closePath();
      ctx.fill();
    }
  }

  private pCactus(u: number) {
    const { ctx } = this;
    const h = 130 * u, w = 20 * u;
    ctx.fillStyle = "#3f8f54";
    this.roundRect(-w / 2, -h, w, h, w / 2);
    ctx.fill();
    ctx.fillStyle = "#357a48";
    this.roundRect(-w * 1.9, -h * 0.72, w * 0.8, h * 0.42, w * 0.4);
    ctx.fill();
    ctx.fillRect(-w * 1.9, -h * 0.4, w * 1.9, w * 0.8);
    this.roundRect(w * 1.1, -h * 0.84, w * 0.8, h * 0.36, w * 0.4);
    ctx.fill();
    ctx.fillRect(0, -h * 0.56, w * 1.9, w * 0.8);
    ctx.fillStyle = "#ff7ab5";
    ctx.beginPath();
    ctx.arc(0, -h, w * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  private pRock(u: number, seed: number) {
    const { ctx } = this;
    const w = (60 + (seed % 40)) * u, h = w * 0.7;
    ctx.fillStyle = this.theme.propTint;
    ctx.beginPath();
    ctx.moveTo(-w, 0);
    ctx.lineTo(-w * 0.6, -h * 0.85);
    ctx.lineTo(-w * 0.05, -h);
    ctx.lineTo(w * 0.62, -h * 0.72);
    ctx.lineTo(w, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath();
    ctx.moveTo(-w * 0.6, -h * 0.85);
    ctx.lineTo(-w * 0.05, -h);
    ctx.lineTo(w * 0.1, -h * 0.5);
    ctx.closePath();
    ctx.fill();
  }

  private pLantern(u: number) {
    const { ctx } = this;
    const h = 120 * u;
    ctx.strokeStyle = this.theme.propTint;
    ctx.lineWidth = Math.max(4 * u, 1);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -h);
    ctx.stroke();
    const glow = ctx.createRadialGradient(0, -h - 18 * u, 0, 0, -h - 18 * u, 52 * u);
    glow.addColorStop(0, "rgba(255,150,120,0.75)");
    glow.addColorStop(1, "rgba(255,150,120,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, -h - 18 * u, 52 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff5a5f";
    this.roundRect(-16 * u, -h - 38 * u, 32 * u, 42 * u, 12 * u);
    ctx.fill();
  }

  private pTorii(u: number) {
    const { ctx } = this;
    const h = 170 * u, w = 90 * u;
    ctx.fillStyle = "#e23b3b";
    ctx.fillRect(-w * 0.72, -h * 0.92, 12 * u, h * 0.92);
    ctx.fillRect(w * 0.6, -h * 0.92, 12 * u, h * 0.92);
    ctx.fillRect(-w, -h, w * 2, 14 * u);
    ctx.fillRect(-w * 0.82, -h * 0.76, w * 1.64, 10 * u);
    ctx.fillStyle = "#1b0f1f";
    ctx.fillRect(-w * 1.05, -h - 8 * u, w * 2.1, 8 * u);
  }

  private pSakura(u: number, seed: number) {
    const { ctx } = this;
    const h = 130 * u;
    ctx.strokeStyle = "#5a3b50";
    ctx.lineWidth = Math.max(7 * u, 1);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-8 * u, -h * 0.6, 0, -h);
    ctx.stroke();
    const blobs = [[0, -h - 18 * u, 46], [-44 * u, -h * 0.95, 32], [44 * u, -h * 0.98, 34], [-20 * u, -h - 44 * u, 28], [24 * u, -h - 40 * u, 30]] as const;
    blobs.forEach((b, i) => {
      ctx.fillStyle = i % 2 ? "#ffc0dd" : "#ff9ec9";
      ctx.beginPath();
      ctx.arc(b[0] + Math.sin(seed + i) * 2 * u, b[1], b[2] * u, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  private pWindmill(u: number) {
    const { ctx } = this;
    const h = 170 * u;
    ctx.strokeStyle = this.theme.propTint;
    ctx.lineWidth = Math.max(5 * u, 1);
    ctx.beginPath();
    ctx.moveTo(-10 * u, 0);
    ctx.lineTo(0, -h);
    ctx.lineTo(10 * u, 0);
    ctx.stroke();
    ctx.save();
    ctx.translate(0, -h);
    ctx.rotate(this.lastT * 0.0012);
    ctx.strokeStyle = "#d9d2e8";
    ctx.lineWidth = Math.max(4 * u, 1);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 42 * u, Math.sin(a) * 42 * u);
      ctx.stroke();
    }
    ctx.restore();
  }

  private pWaterTower(u: number) {
    const { ctx } = this;
    const h = 150 * u, w = 56 * u;
    ctx.strokeStyle = this.theme.propTint;
    ctx.lineWidth = Math.max(4 * u, 1);
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sd * 26 * u, 0);
      ctx.lineTo(sd * 12 * u, -h);
      ctx.stroke();
    }
    ctx.fillStyle = "#8e9aaf";
    this.roundRect(-w / 2, -h - 54 * u, w, 56 * u, 10 * u);
    ctx.fill();
    ctx.fillStyle = this.theme.propTint;
    ctx.beginPath();
    ctx.moveTo(-w / 2 - 4 * u, -h - 54 * u);
    ctx.lineTo(0, -h - 82 * u);
    ctx.lineTo(w / 2 + 4 * u, -h - 54 * u);
    ctx.closePath();
    ctx.fill();
  }

  private pPumpkin(u: number) {
    const { ctx } = this;
    const r = 34 * u;
    ctx.fillStyle = "#f97316";
    for (const dx of [-0.55, 0, 0.55]) {
      ctx.beginPath();
      ctx.ellipse(dx * r, -r, r * 0.55, r * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#3f6212";
    ctx.fillRect(-3 * u, -r * 2.05, 6 * u, 12 * u);
    const glow = 0.6 + 0.4 * Math.sin(this.lastT * 0.01);
    ctx.fillStyle = `rgba(253,224,71,${glow})`;
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, -r * 1.15); ctx.lineTo(-r * 0.2, -r * 1.35); ctx.lineTo(-r * 0.15, -r * 1.05);
    ctx.moveTo(r * 0.45, -r * 1.15); ctx.lineTo(r * 0.2, -r * 1.35); ctx.lineTo(r * 0.15, -r * 1.05);
    ctx.fill();
    ctx.fillRect(-r * 0.4, -r * 0.75, r * 0.8, r * 0.14);
  }

  private pGift(u: number, hue: number) {
    const { ctx } = this;
    const w = 70 * u, h = 56 * u;
    ctx.fillStyle = `hsl(${hue}, 75%, 50%)`;
    ctx.fillRect(-w / 2, -h, w, h);
    ctx.fillStyle = "#fde047";
    ctx.fillRect(-5 * u, -h, 10 * u, h);
    ctx.fillRect(-w / 2, -h * 0.58, w, 9 * u);
    ctx.beginPath();
    ctx.ellipse(-10 * u, -h - 8 * u, 12 * u, 7 * u, -0.5, 0, Math.PI * 2);
    ctx.ellipse(10 * u, -h - 8 * u, 12 * u, 7 * u, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  private pFlowerBush(u: number, hue: number) {
    const { ctx } = this;
    ctx.fillStyle = "#15803d";
    ctx.beginPath();
    ctx.ellipse(0, -22 * u, 44 * u, 26 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = `hsl(${(hue + i * 40) % 360}, 85%, 70%)`;
      ctx.beginPath();
      ctx.arc((i - 3) * 11 * u, -30 * u - Math.sin(i * 1.7) * 12 * u, 6 * u, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private pFirework(u: number, hue: number) {
    const { ctx } = this;
    const h = 170 * u;
    ctx.strokeStyle = this.theme.propTint;
    ctx.lineWidth = Math.max(2, 3 * u);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -h);
    ctx.stroke();
    const t = (this.lastT * 0.0012 + hue) % 1;
    const rr = 50 * u * t;
    ctx.strokeStyle = `hsla(${hue}, 95%, 65%, ${1 - t})`;
    ctx.lineWidth = Math.max(1.5, 2.5 * u);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * rr * 0.4, -h + Math.sin(a) * rr * 0.4);
      ctx.lineTo(Math.cos(a) * rr, -h + Math.sin(a) * rr);
      ctx.stroke();
    }
  }

  private pArch(u: number) {
    const { ctx } = this;
    const h = 150 * u, w = 70 * u;
    ctx.strokeStyle = "#cfe3f0";
    ctx.lineWidth = Math.max(8 * u, 1.5);
    ctx.beginPath();
    ctx.moveTo(-w, 0);
    ctx.lineTo(-w * 0.6, -h);
    ctx.lineTo(w * 0.1, -h * 0.92);
    ctx.stroke();
  }

  /* ---------------- entities ---------------- */

  private drawEntities() {
    const all: { z: number; layer: number; draw: () => void }[] = [];
    for (const c of this.cars) all.push({ z: c.z, layer: 2, draw: () => this.drawCar(c) });
    for (const co of this.coins) all.push({ z: co.z, layer: 0, draw: () => this.drawCoin(co) });
    for (const h of this.hazards) all.push({ z: h.z + 0.01, layer: 1, draw: () => this.drawHazard(h) });
    for (const p of this.pickups) all.push({ z: p.z, layer: 1, draw: () => this.drawPickup(p) });
    for (const g of this.tollGates) all.push({ z: g.z, layer: 1, draw: () => this.drawTollGate(g) });
    for (const p of this.roadside) all.push({ z: p.z, layer: 1, draw: () => this.drawRoadProp(p) });
    if (this.collectible) {
      all.push({ z: this.collectible.z, layer: 1, draw: () => this.drawCollectible(this.collectible!) });
    }
    all.sort((a, b) => {
      const depth = b.z - a.z;
      return Math.abs(depth) < 0.8 ? a.layer - b.layer : depth;
    });
    for (const e of all) e.draw();
  }

  /** World Exploration collectible: a gleaming artifact bobbing over a lore ring. */
  private drawCollectible(c: CollectiblePickup) {
    if (c.z > Z_FAR || c.z < -2) return;
    const { ctx } = this;
    const s = this.scaleAt(c.z);
    const x = this.xAt(c.lane, c.z);
    const yG = this.yAt(c.z);
    const r = 30 * s * Math.min(this.H / 700, 1.2);
    const bob = Math.sin(c.spin * 1.7) * 9 * s;
    const y = yG - r * 2.4 + bob;

    // lore ring on the asphalt
    ctx.strokeStyle = `rgba(253,224,71,${0.3 + 0.2 * Math.sin(this.lastT * 0.008)})`;
    ctx.lineWidth = 2.5 * s;
    ctx.beginPath();
    ctx.ellipse(x, yG, r * 1.5, r * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();

    // golden glow
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
    glow.addColorStop(0, "rgba(253,224,71,0.55)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.6, 0, Math.PI * 2);
    ctx.fill();

    // spinning artifact: diamond relic with a shine sweep
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(c.spin);
    const body = ctx.createLinearGradient(-r, -r, r, r);
    body.addColorStop(0, "#fde68a");
    body.addColorStop(0.5, "#f59e0b");
    body.addColorStop(1, "#b45309");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.72, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.72, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.3, -r * 0.15);
    ctx.lineTo(0, 0);
    ctx.lineTo(-r * 0.3, -r * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawTollGate(gate: TollGate) {
    if (gate.z > Z_FAR || gate.z < -3) return;
    const { ctx } = this;
    const s = this.scaleAt(gate.z);
    const x = this.xAt(0, gate.z);
    const y = this.yAt(gate.z);
    const w = this.roadHalf() * (2 / 3) * 0.52 * s;
    const h = w * 1.12;
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = Math.max(2, 7 * s);
    ctx.shadowColor = "#fbbf24";
    ctx.shadowBlur = 18 * s;
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.lineTo(x - w, y - h);
    ctx.quadraticCurveTo(x, y - h * 1.15, x + w, y - h);
    ctx.lineTo(x + w, y);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(253,230,138,${0.15 + Math.sin(this.lastT / 100) * 0.08})`;
    ctx.fillRect(x - w * 0.42, y - h * 0.84, w * 0.84, h * 0.62);
    ctx.fillStyle = "#fde68a";
    ctx.font = `900 ${Math.max(6, 14 * s)}px Orbitron, monospace`;
    ctx.textAlign = "center";
    ctx.fillText("TOLL", x, y - h * 1.22);
    // center aperture stays readable at distance
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = Math.max(1, 3 * s);
    ctx.beginPath();
    ctx.arc(x, y - h * 0.42, w * 0.24, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawRoadProp(p: RoadProp) {
    if (p.broken || p.z > Z_FAR || p.z < -2) return;
    const { ctx } = this;
    const s = this.scaleAt(p.z);
    const x = this.xAt(p.lane, p.z);
    const y = this.yAt(p.z);
    const size = 32 * s * Math.min(this.H / 700, 1.3);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(x, y, size * 0.8, size * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    if (p.kind === "cone") {
      ctx.fillStyle = "#fb923c";
      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.lineTo(x - size * 0.48, y);
      ctx.lineTo(x + size * 0.48, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillRect(x - size * 0.23, y - size * 0.42, size * 0.46, size * 0.13);
    } else if (p.kind === "bin") {
      ctx.fillStyle = "#22c55e";
      this.roundRect(x - size * 0.45, y - size * 0.75, size * 0.9, size * 0.75, size * 0.1);
      ctx.fill();
      ctx.fillRect(x - size * 0.52, y - size * 0.8, size * 1.04, size * 0.12);
    } else {
      const w = size * (p.kind === "board" ? 2 : 1.2);
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = Math.max(1, size * 0.09);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - size * 1.45);
      ctx.stroke();
      ctx.fillStyle = p.kind === "sign" ? "#f59e0b" : "#ef4444";
      this.roundRect(x - w / 2, y - size * 1.7, w, size * 0.58, size * 0.09);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `900 ${Math.max(5, size * 0.2)}px Orbitron, monospace`;
      ctx.textAlign = "center";
      ctx.fillText(p.kind === "sign" ? "!" : "GO", x, y - size * 1.32);
    }
  }

  private drawPickup(p: Pickup) {
    const { ctx } = this;
    if (p.z > Z_FAR || p.z < -2) return;
    const s = this.scaleAt(p.z);
    const x = this.xAt(p.lane, p.z);
    const yG = this.yAt(p.z);
    const r = 34 * s * Math.min(this.H / 700, 1.2);
    const bob = Math.sin(p.spin * 2) * 8 * s;
    const y = yG - r * 1.9 + bob;

    const colors: Record<PupKind, [string, string]> = {
      nitro: ["#ff8c42", "#b4340b"],
      magnet: ["#67e8f9", "#0e7490"],
      shield: ["#a5f3fc", "#2563eb"],
      warp: ["#c4b5fd", "#6d28d9"],
      shard: ["#e9d5ff", "#7c3aed"],
    };
    const [c1, c2] = colors[p.kind];

    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(x, yG, r * 0.7, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
    glow.addColorStop(0, `${c1}cc`);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(p.spin) * 0.25);
    const body = ctx.createLinearGradient(0, -r, 0, r);
    body.addColorStop(0, c1);
    body.addColorStop(1, c2);
    ctx.fillStyle = body;

    if (p.kind === "nitro") {
      this.roundRect(-r * 0.42, -r, r * 0.84, r * 1.9, r * 0.4);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      this.roundRect(-r * 0.18, -r * 1.35, r * 0.36, r * 0.4, r * 0.15);
      ctx.fill();
      ctx.fillStyle = "#fff3b0";
      ctx.beginPath();
      ctx.moveTo(0, r * 1.05);
      ctx.lineTo(-r * 0.3, r * 1.7);
      ctx.lineTo(0, r * 1.45);
      ctx.lineTo(r * 0.3, r * 1.7);
      ctx.closePath();
      ctx.fill();
    } else if (p.kind === "shard") {
      // glowing portal shard: rotating crystal triangle
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.8, r * 0.55);
      ctx.lineTo(-r * 0.8, r * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = Math.max(1.5, r * 0.09);
      ctx.stroke();
      ctx.strokeStyle = `rgba(196,181,253,${0.5 + 0.4 * Math.sin(p.spin * 5)})`;
      ctx.lineWidth = Math.max(1, r * 0.07);
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.kind === "magnet") {
      ctx.lineWidth = r * 0.42;
      ctx.strokeStyle = body;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.68, Math.PI * 0.08, Math.PI * 0.92, true);
      ctx.stroke();
      ctx.fillStyle = "#f1f5f9";
      ctx.fillRect(-r * 0.9, r * 0.1, r * 0.42, r * 0.5);
      ctx.fillRect(r * 0.48, r * 0.1, r * 0.42, r * 0.5);
      ctx.strokeStyle = `rgba(190,240,255,${0.4 + 0.4 * Math.sin(p.spin * 4)})`;
      ctx.lineWidth = Math.max(1.5, r * 0.1);
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.25, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.kind === "shield") {
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.05);
      ctx.lineTo(r * 0.8, -r * 0.55);
      ctx.lineTo(r * 0.62, r * 0.7);
      ctx.lineTo(0, r * 1.15);
      ctx.lineTo(-r * 0.62, r * 0.7);
      ctx.lineTo(-r * 0.8, -r * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.8);
      ctx.lineTo(r * 0.45, -r * 0.45);
      ctx.lineTo(0, r * 0.2);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = Math.max(2, r * 0.12);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -r * 0.55);
      ctx.moveTo(0, 0);
      ctx.lineTo(r * 0.42, r * 0.18);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawHazard(hz: Hazard) {
    const { ctx } = this;
    if (hz.z > Z_FAR || hz.z < -3) return;
    const s = this.scaleAt(hz.z);
    const x = this.xAt(hz.lane, hz.z);
    const y = this.yAt(hz.z);
    const w = this.roadHalf() * (2 / 3) * 0.62 * s;

    if (hz.kind === "pothole") {
      ctx.fillStyle = "rgba(0,0,0,0.85)";
      ctx.beginPath();
      ctx.ellipse(x, y, w, w * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,160,60,0.65)";
      ctx.lineWidth = Math.max(2 * s * 3, 1);
      ctx.beginPath();
      ctx.ellipse(x, y, w * 1.08, w * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (hz.kind === "cone") {
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath();
      ctx.ellipse(x, y, w * 0.6, w * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      const h = w * 1.5;
      ctx.fillStyle = "#ff7a18";
      ctx.beginPath();
      ctx.moveTo(x, y - h);
      ctx.lineTo(x - w * 0.5, y);
      ctx.lineTo(x + w * 0.5, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillRect(x - w * 0.33, y - h * 0.58, w * 0.66, h * 0.16);
    } else if (hz.kind === "spikes") {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath();
      ctx.ellipse(x, y, w * 1.15, w * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1f2937";
      ctx.fillRect(x - w * 1.1, y - w * 0.16, w * 2.2, w * 0.3);
      ctx.fillStyle = "#e2e8f0";
      for (let i = 0; i < 9; i++) {
        const sx = x - w * 1.02 + i * (w * 2.04 / 8);
        ctx.beginPath();
        ctx.moveTo(sx, y - w * 0.16);
        ctx.lineTo(sx - w * 0.08, y + w * 0.02);
        ctx.lineTo(sx + w * 0.08, y + w * 0.02);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      const h = w * 1.1;
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath();
      ctx.ellipse(x, y, w * 1.1, w * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f8fafc";
      this.roundRect(x - w, y - h, w * 2, h * 0.72, 3 * s * 4);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      this.roundRect(x - w, y - h, w * 2, h * 0.72, 3 * s * 4);
      ctx.clip();
      ctx.fillStyle = "#ef4444";
      for (let i = -3; i < 6; i++) {
        ctx.save();
        ctx.translate(x - w + i * w * 0.46, y - h);
        ctx.rotate(0.5);
        ctx.fillRect(0, -h * 0.4, w * 0.22, h * 2);
        ctx.restore();
      }
      ctx.restore();
    }
  }

  private drawCoin(co: Coin) {
    const { ctx } = this;
    if (co.z > Z_FAR || co.z < -2) return;
    const s = this.scaleAt(co.z);
    const x = this.xAt(co.laneF, co.z);
    const yGround = this.yAt(co.z);
    const r = 30 * s * Math.min(this.H / 700, 1.15);
    const squish = Math.abs(Math.cos(co.spin));
    const bob = Math.sin(co.spin * 1.4) * 6 * s;
    const y = yGround - this.airOffset(co.h, co.z);

    if (co.h < 0.2) {
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(x, yGround, r * 0.8, r * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(x, y - r * 1.6 + bob);
    ctx.scale(Math.max(squish, 0.14), 1);
    ctx.fillStyle = "#b8860b";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd700";
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b8860b";
    ctx.font = `900 ${r * 1.1}px Rubik, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("$", 0, r * 0.06);
    ctx.restore();
  }

  private drawCar(c: Car) {
    if (c.z > Z_FAR || c.z < -4) return;
    const { ctx } = this;
    const s = this.scaleAt(c.z);
    const x = this.xAt(c.laneF, c.z);
    const baseY = this.yAt(c.z);
    const y = baseY - (c.flung ? this.airOffset(Math.max(c.flyH, 0), c.z) : 0);
    const laneW = this.roadHalf() * (2 / 3);
    const w = laneW * (c.spec.w / 0.5) * 0.9 * s;
    const h = w * c.spec.hMul;

    if (this.theme.headlightTrail && c.z < 26 && !c.flung) {
      const beam = ctx.createLinearGradient(x, baseY, x, baseY + 100 * s);
      beam.addColorStop(0, "rgba(255,240,190,0.22)"); beam.addColorStop(1, "rgba(255,240,190,0)");
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.42, baseY); ctx.lineTo(x + w * 0.42, baseY);
      ctx.lineTo(x + w * 1.5, baseY + 110 * s); ctx.lineTo(x - w * 1.5, baseY + 110 * s);
      ctx.closePath(); ctx.fill();
    }

    const cb = this.settings.colorblind ? this.classColor(c.spec.kind) : null;
    ctx.save();
    if (c.flung) {
      ctx.translate(x, y); ctx.rotate(c.flyRot); ctx.translate(-x, -y);
    }
    drawVehicle(ctx, {
      kind: c.spec.kind,
      x, y, width: w, height: h,
      color: cb?.[0] ?? c.color,
      dark: cb?.[1] ?? c.dark,
      time: this.lastT,
    });
    ctx.restore();

    // Weaver turn signal: the readable tell before changing lanes.
    if (c.weaver && c.weaving && c.lane !== c.weaveTo && Math.floor(this.lastT / 150) % 2 === 0) {
      const side = Math.sign(c.weaveTo - c.laneF) || 1;
      const sx = x + side * w * 0.54;
      const sy = y - h * 0.42;
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, w * 0.55);
      glow.addColorStop(0, "rgba(255,170,30,0.95)"); glow.addColorStop(1, "rgba(255,170,30,0)");
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(sx, sy, w * 0.55, 0, Math.PI * 2); ctx.fill();
    }

    if (this.settings.colorblind) {
      ctx.fillStyle = "#fff";
      ctx.font = `900 ${Math.max(8, w * 0.28)}px Orbitron, monospace`;
      ctx.textAlign = "center";
      const glyph = this.carClearHeight(c) === Number.POSITIVE_INFINITY ? "X" : "^";
      ctx.fillText(glyph, x, y - h * 0.5);
    }
  }

  /* ---------------- rider + ghost ---------------- */

  private pose(): Pose {
    if (!this.trick) return "ride";
    if (this.trick.kind === "superman") return "superman";
    if (this.trick.kind === "flip") return "tuck";
    return "ride";
  }

  private drawBike() {
    const { ctx } = this;
    const trail = getChoice(TRAILS, this.settings.trailId);
    const x = this.xAt(this.px, 0);
    const groundY = this.yAt(0) + 6;
    const lift = this.airOffset(this.jumpH, 0);
    const y = groundY - lift;
    const u = Math.min(this.H / 700, 1.2) * (this.W < 480 ? 0.92 : 1);
    const bob = this.jumpH > 0 ? 0 : Math.sin(this.wheelSpin * 2.2) * 1.6 * u;
    const tilt = Math.max(-0.5, Math.min(0.5, this.tilt));

    if (this.crashed) {
      ctx.save();
      ctx.translate(x, groundY - 14 * u);
      ctx.rotate(1.35 + this.crashT * 2.2);
      ctx.globalAlpha = 1;
      drawRiderBody(ctx, u, this.settings, "tuck", this.wheelSpin);
      ctx.restore();
      return;
    }

    const shrink = 1 - Math.min(this.jumpH, 0.6) * 0.9;
    ctx.fillStyle = `rgba(0,0,0,${0.45 * shrink})`;
    ctx.beginPath();
    ctx.ellipse(x + tilt * 18 * u, groundY + 4, 44 * u * shrink, 10 * u * shrink, 0, 0, Math.PI * 2);
    ctx.fill();

    // invulnerability flicker
    const flick = this.invuln > 0 && Math.floor(this.lastT / 70) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = flick ? 0.45 : 1;
    ctx.translate(x, y + bob);
    ctx.rotate(tilt);
    if (this.wheelieT > 0 && this.jumpH <= 0) ctx.rotate(-0.24);
    if (this.grinding) ctx.rotate(this.grindBalance * 0.35);
    if (this.trick) {
      if (this.trick.kind === "spin") ctx.rotate(this.trickRot);
      else if (this.trick.kind === "whip") ctx.rotate(Math.sin(this.trickRot) * 0.9);
      else if (this.trick.kind === "flip") {
        const p = this.trick.t / this.trick.dur;
        ctx.scale(1, Math.cos(p * Math.PI * 2) * 0.5 + 0.5 + 0.0001);
      }
    }
    if (this.jumpH > 0) {
      const pitch = Math.sin(Math.min(this.airT / 0.72, 1) * Math.PI) * 0.26;
      ctx.rotate(-pitch * 0.5);
      ctx.scale(1 + this.jumpH * 0.05, 1 + this.jumpH * 0.08);
    }
    drawRiderBody(ctx, u, this.settings, this.pose(), this.wheelSpin);
    ctx.restore();

    if (this.phase === "playing" && this.jumpH > 0.1 && Math.random() < 0.6) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 20, y: y - 10,
        vx: (Math.random() - 0.5) * 20, vy: 90,
        life: 0.3, maxLife: 0.3, size: 2 + Math.random() * 3,
        color: trail.colors[0], grav: 0, shape: "dot",
      });
    }
    if (this.phase === "playing" && this.jumpH <= 0 && Math.random() < 0.3) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 10 - tilt * 30, y: groundY - 4,
        vx: (Math.random() - 0.5) * 30, vy: 30 + Math.random() * 40,
        life: 0.35, maxLife: 0.35, size: 3 + Math.random() * 4,
        color: trail.colors[1], grav: 0, shape: "smoke",
      });
    }
    if (this.phase === "playing" && this.nitroT > 0) {
      for (let i = 0; i < 2; i++) {
        this.particles.push({
          x: x + (Math.random() - 0.5) * 24, y: y - 20 - Math.random() * 20,
          vx: (Math.random() - 0.5) * 50, vy: 160 + Math.random() * 120,
          life: 0.4, maxLife: 0.4, size: 4 + Math.random() * 6,
          color: Math.random() < 0.5 ? "rgba(255,170,60,0.85)" : "rgba(255,90,40,0.8)",
          grav: 0, shape: "smoke",
        });
      }
    }
  }

  /** 1.5s animated chevron warning approaching from the horizon before a closed-lane barrier drops, plus Scout safe-lane hint. */
  private drawClosingWarning() {
    const { ctx } = this;
    if (this.phase !== "playing") return;

    // Scout drone highlights safest immediate lane subtly on the asphalt
    if (this.settings.companion === "scout") {
      const lanes = [-1, 0, 1];
      let bestLane = 0;
      let bestDist = -1;
      for (const l of lanes) {
        if (l === this.laneClosed || l === this.closingLane) continue;
        let nearest = 999;
        for (const c of this.cars) if (c.z > 0 && Math.abs(c.laneF - l) < 0.6) nearest = Math.min(nearest, c.z);
        for (const h of this.hazards) if (h.z > 0 && h.lane === l) nearest = Math.min(nearest, h.z);
        if (nearest > bestDist) { bestDist = nearest; bestLane = l; }
      }
      const x0 = this.xAt(bestLane, 2.5);
      const x1 = this.xAt(bestLane, 18);
      ctx.strokeStyle = "rgba(103,232,249,0.28)";
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 10]);
      ctx.beginPath();
      ctx.moveTo(x0, this.yAt(2.5));
      ctx.lineTo(x1, this.yAt(18));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Ghost Beacon gadget: a brighter, longer holographic guide line that
    // also marks jumpable threats with small chevrons at the horizon.
    if (this.gadgetBeacon && this.phase === "playing" && this.warpZoneT <= 0) {
      const lanes = [-1, 0, 1];
      let bestLane = 0;
      let bestDist = -1;
      for (const l of lanes) {
        if (l === this.laneClosed || l === this.closingLane) continue;
        let nearest = 999;
        for (const c of this.cars) if (c.z > 0 && Math.abs(c.laneF - l) < 0.6) nearest = Math.min(nearest, c.z);
        for (const h of this.hazards) if (h.z > 0 && h.lane === l) nearest = Math.min(nearest, h.z);
        if (nearest > bestDist) { bestDist = nearest; bestLane = l; }
      }
      const pulse = 0.3 + 0.18 * Math.sin(this.lastT * 0.012);
      const x0 = this.xAt(bestLane, 1.5);
      const x1 = this.xAt(bestLane, 26);
      ctx.strokeStyle = `rgba(125,211,252,${pulse})`;
      ctx.lineWidth = 6;
      ctx.setLineDash([14, 12]);
      ctx.beginPath();
      ctx.moveTo(x0, this.yAt(1.5));
      ctx.lineTo(x1, this.yAt(26));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const warnLane = this.closingWarnT > 0 ? this.closingLane : this.laneClosed;
    if (warnLane < -1) return;
    const progress = this.closingWarnT > 0 ? 1 - this.closingWarnT / 1.5 : 1;
    const zMax = Z_FAR * (1 - progress * 0.65);
    const pulse = 0.55 + 0.35 * Math.sin(this.lastT * 0.016);
    for (let i = 0; i < 6; i++) {
      const z = ((zMax - i * 7 + (this.lastT * 0.03) % 7) + Z_FAR) % Z_FAR;
      if (z < 1.2 || z > Z_FAR - 4) continue;
      const s = this.scaleAt(z);
      const x = this.xAt(warnLane, z);
      const y = this.yAt(z);
      const w = this.roadHalf() * (2 / 3) * 0.34 * s;
      const h = w * 0.62;
      ctx.strokeStyle = `rgba(251,191,36,${pulse * Math.min(1, s * 2.5)})`;
      ctx.lineWidth = Math.max(1.5, 4.5 * s);
      ctx.beginPath();
      ctx.moveTo(x - w, y - h);
      ctx.lineTo(x, y);
      ctx.lineTo(x + w, y - h);
      ctx.stroke();
    }
  }

  /** Highlights ONLY the single nearest upcoming hazard in your current lane so high-speed reading stays crisp. */
  private drawPriorityHazard() {
    if (this.phase !== "playing" || this.crashed) return;
    let nearest: Hazard | null = null;
    for (const hz of this.hazards) {
      if (hz.lane !== this.lane || hz.z < 0.4 || hz.z > 38) continue;
      if (!nearest || hz.z < nearest.z) nearest = hz;
    }
    if (!nearest) return;

    const { ctx } = this;
    const z = nearest.z;
    const s = this.scaleAt(z);
    const x = this.xAt(nearest.lane, z);
    const y = this.yAt(z);
    const w = this.roadHalf() * (2 / 3) * 0.66 * s;
    const pulse = this.settings.reduceMotion ? 0.85 : 0.65 + 0.35 * Math.sin(this.lastT * 0.014);

    // Thin animated priority outline around just this one threat
    ctx.save();
    ctx.strokeStyle = `rgba(253,224,71,${pulse})`;
    ctx.lineWidth = Math.max(1.6, 3.2 * s * 2.2);
    ctx.setLineDash([Math.max(4, 9 * s * 2), Math.max(3, 5 * s * 2)]);
    ctx.lineDashOffset = this.settings.reduceMotion ? 0 : -this.lastT * 0.04;
    ctx.beginPath();
    ctx.ellipse(x, y - w * 0.35, w * 1.16, Math.max(w * 0.58, 8 * s), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Subtle ground warning arrow in front of it
    const az = Math.max(0.5, z - 2.4);
    const as = this.scaleAt(az);
    const ax = this.xAt(nearest.lane, az);
    const ay = this.yAt(az);
    const aw = this.roadHalf() * (2 / 3) * 0.24 * as;
    ctx.strokeStyle = `rgba(253,224,71,${pulse * 0.9})`;
    ctx.lineWidth = Math.max(1.5, 3.5 * as * 2);
    ctx.beginPath();
    ctx.moveTo(ax - aw, ay + aw * 0.45);
    ctx.lineTo(ax, ay - aw * 0.45);
    ctx.lineTo(ax + aw, ay + aw * 0.45);
    ctx.stroke();
    ctx.restore();
  }

  private drawGhost() {
    const { ctx } = this;

    const g = this.ghostPlay;
    if (!g || !g.length || this.phase !== "playing") return;
    const t = this.ghostT;
    // The player outlasted the ghost's recording: burn it out for good instead
    // of parking it at its final position forever.
    const lastT = g[g.length - 1].t;
    const FADE = 1.5;
    if (t > lastT + FADE) return; // fully vanished — never draw again this run
    const fading = t > lastT;
    const fade = fading ? Math.max(0, 1 - (t - lastT) / FADE) : 1;
    if (fading && !this.ghostBye) {
      this.ghostBye = true;
      // one-time celebration: shimmer burst + callout
      const bx = this.xAt(g[g.length - 1].x, 0);
      const by = this.yAt(0) - 40;
      for (let k = 0; k < 16; k++) {
        const a = Math.random() * Math.PI * 2;
        this.particles.push({
          x: bx, y: by, vx: Math.cos(a) * (80 + Math.random() * 160), vy: Math.sin(a) * (80 + Math.random() * 120) - 60,
          life: 0.6, maxLife: 0.6, size: 2 + Math.random() * 4,
          color: Math.random() < 0.5 ? "#a5f3fc" : "#e0f2fe", grav: 40, shape: "spark",
        });
      }
      this.addText(bx, by - 60, "GHOST BEATEN!", "#7dd3fc", 1.1);
      this.replayEvent("GHOST BEATEN");
      sfx.swoosh();
    }
    // ghost time is monotonic per run — advance a persistent cursor instead of
    // rescanning the whole recording every frame
    if (this.ghostCursor >= g.length - 1) {
      this.ghostCursor = g.length - 1;
    } else {
      while (this.ghostCursor < g.length - 1 && g[this.ghostCursor + 1].t < t) this.ghostCursor++;
    }
    const i = this.ghostCursor;
    if (g[i].t > t + 1) return;
    const a = g[i];
    const b = g[Math.min(i + 1, g.length - 1)];
    const span = Math.max(0.0001, b.t - a.t);
    const f = Math.max(0, Math.min(1, (t - a.t) / span));
    const px = a.x + (b.x - a.x) * f;
    const h = a.h + (b.h - a.h) * f;

    const x = this.xAt(px, 0);
    const y = this.yAt(0) + 6 - this.airOffset(h, 0);
    const u = Math.min(this.H / 700, 1.2) * (this.W < 480 ? 0.92 : 1);
    // during the fade the ghost rises and corkscrews away
    const rise = (1 - fade) * 90 * u;
    const spin = (1 - fade) * 1.9;
    ctx.save();
    ctx.globalAlpha = 0.3 * fade;
    ctx.translate(x, y - rise);
    if (spin) ctx.rotate(spin);
    drawRiderBody(ctx, u, this.settings, "ride", this.wheelSpin);
    ctx.restore();
    if (!fading || fade > 0.15) {
      ctx.save();
      ctx.globalAlpha = 0.5 * fade;
      ctx.fillStyle = "#a5f3fc";
      ctx.font = "900 10px Orbitron, monospace";
      ctx.textAlign = "center";
      ctx.fillText("PB", x, y - 150 * u);
      ctx.restore();
    }
  }

  /* ---------------- events & overlays ---------------- */

  private drawTunnel() {
    const { ctx, W, H } = this;
    const hy = this.horizonY();
    ctx.fillStyle = "rgba(4,2,12,0.55)";
    ctx.fillRect(0, 0, W, H);

    // ribs receding into the distance
    for (let k = 0; k < 14; k++) {
      const z = (((k * 6 - this.roadOffset * 0.9) % 84) + 84) % 84;
      if (z < 1 || z > Z_FAR) continue;
      const s = this.scaleAt(z);
      const y = this.yAt(z);
      const halfW = this.roadHalf() * s * 1.5;
      const top = hy - (y - hy) * 0.35 - 180 * s;
      ctx.strokeStyle = `rgba(140,200,255,${0.1 + 0.35 * s})`;
      ctx.lineWidth = Math.max(1.5, 7 * s);
      ctx.beginPath();
      ctx.moveTo(this.xAt(0, z) - halfW, y);
      ctx.lineTo(this.xAt(0, z) - halfW * 0.86, top);
      ctx.lineTo(this.xAt(0, z) + halfW * 0.86, top);
      ctx.lineTo(this.xAt(0, z) + halfW, y);
      ctx.stroke();
      if (k % 2 === 0) {
        ctx.fillStyle = `rgba(255,220,120,${0.25 + 0.5 * s})`;
        ctx.fillRect(this.xAt(0, z) - halfW * 0.5, top + 4 * s, halfW, Math.max(1.5, 4 * s));
      }
    }

    // reflective arrows on the walls
    for (const side of [-1, 1]) {
      for (let k = 0; k < 6; k++) {
        const z = (((k * 11 - this.roadOffset * 1.2) % 66) + 66) % 66;
        if (z < 2 || z > 48) continue;
        const s = this.scaleAt(z);
        const x = this.xAt(side * 2.1, z);
        const y = this.yAt(z) - 90 * s;
        ctx.fillStyle = `rgba(120,255,200,${0.3 + 0.5 * s})`;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - side * 26 * s, y - 14 * s);
        ctx.lineTo(x - side * 26 * s, y + 14 * s);
        ctx.closePath();
        ctx.fill();
      }
    }

    const vg = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.18, W / 2, H * 0.5, H * 0.8);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.75)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  private drawPolice() {
    const { ctx, W, H } = this;
    // moving searchlight cone on the telegraphed lane
    const lx = this.xAt(this.spotLane, 2);
    const topX = this.W * this.heliX;
    const grad = ctx.createLinearGradient(topX, H * 0.12, lx, this.yAt(1.5));
    const pulse = 0.22 + 0.1 * Math.sin(this.lastT * 0.008);
    grad.addColorStop(0, `rgba(190,220,255,${pulse + 0.1})`);
    grad.addColorStop(1, "rgba(190,220,255,0.02)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(topX - 16, H * 0.13);
    ctx.lineTo(topX + 16, H * 0.13);
    ctx.lineTo(lx + 120, this.yAt(1.2));
    ctx.lineTo(lx - 120, this.yAt(1.2));
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = `rgba(190,220,255,${pulse})`;
    ctx.beginPath();
    ctx.ellipse(lx, this.yAt(1.2), 110, 26, 0, 0, Math.PI * 2);
    ctx.fill();

    // helicopter silhouette
    const hx = topX;
    const hy = H * 0.1;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.fillStyle = "#0f172a";
    this.roundRect(-26, -10, 52, 20, 9);
    ctx.fill();
    this.roundRect(18, -4, 34, 7, 3);
    ctx.fill();
    ctx.fillStyle = "#1e293b";
    const rot = this.lastT * 0.03;
    ctx.save();
    ctx.translate(0, -12);
    ctx.scale(Math.cos(rot), 1);
    ctx.fillRect(-46, -2, 92, 4);
    ctx.restore();
    const beacon = Math.floor(this.lastT / 180) % 2 === 0;
    ctx.fillStyle = beacon ? "#ef4444" : "rgba(239,68,68,0.3)";
    ctx.beginPath();
    ctx.arc(-22, 8, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // red/blue wash at the screen edges
    const wash = Math.floor(this.lastT / 220) % 2 === 0;
    const edge = ctx.createLinearGradient(0, 0, W, 0);
    edge.addColorStop(0, wash ? "rgba(59,130,246,0.22)" : "rgba(239,68,68,0.22)");
    edge.addColorStop(0.5, "rgba(0,0,0,0)");
    edge.addColorStop(1, wash ? "rgba(239,68,68,0.22)" : "rgba(59,130,246,0.22)");
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, W, H);
  }

  /** Cruisers hunting you from behind, cut off by the bottom edge. */
  private drawChasers() {
    const { ctx, W, H } = this;
    const sorted = [...this.chasers].sort((a, b) => a.closeness - b.closeness);
    for (const c of sorted) {
      const k = Math.max(0, Math.min(1, c.closeness));
      const scale = 0.8 + k * 0.75;
      const w = Math.min(W, 720) * 0.3 * scale;
      const h = w * 0.72;
      const laneSpread = this.roadHalf() * (2 / 3) * (1.05 + k * 0.45);
      const x = W / 2 + c.laneF * laneSpread + Math.sin(c.sway) * 4;
      // only the top slice is visible, so they read as right on your tail
      const y = H + h * (0.78 - k * 0.52);
      const r = w * 0.1;

      ctx.save();
      ctx.translate(x, y);

      // headlight wash thrown onto the road ahead of them
      const wash = ctx.createLinearGradient(0, -h * 0.4, 0, -h * 1.9);
      wash.addColorStop(0, `rgba(255,245,210,${0.2 + k * 0.22})`);
      wash.addColorStop(1, "rgba(255,245,210,0)");
      ctx.fillStyle = wash;
      ctx.beginPath();
      ctx.moveTo(-w * 0.44, -h * 0.4);
      ctx.lineTo(w * 0.44, -h * 0.4);
      ctx.lineTo(w * 1.25, -h * 1.9);
      ctx.lineTo(-w * 1.25, -h * 1.9);
      ctx.closePath();
      ctx.fill();

      // body
      const body = ctx.createLinearGradient(0, -h, 0, 0);
      body.addColorStop(0, "#f1f5f9");
      body.addColorStop(1, "#94a3b8");
      ctx.fillStyle = body;
      this.roundRect(-w / 2, -h, w, h * 1.3, r);
      ctx.fill();

      // dark doors / stripe
      ctx.fillStyle = "#1f2937";
      ctx.fillRect(-w / 2, -h * 0.34, w, h * 0.17);

      // windshield
      const ws = ctx.createLinearGradient(0, -h * 0.92, 0, -h * 0.45);
      ws.addColorStop(0, "#cfe9ff");
      ws.addColorStop(1, "#44648c");
      ctx.fillStyle = ws;
      this.roundRect(-w * 0.37, -h * 0.9, w * 0.74, h * 0.4, r * 0.7);
      ctx.fill();

      // lightbar
      const blue = Math.floor(this.lastT / 95) % 2 === 0;
      ctx.fillStyle = "#1f2937";
      this.roundRect(-w * 0.3, -h * 1.08, w * 0.6, h * 0.11, r * 0.4);
      ctx.fill();
      for (const [sd, on] of [[-1, blue], [1, !blue]] as const) {
        const lx = sd * w * 0.16;
        const col = sd < 0 ? "59,130,246" : "239,68,68";
        const g = ctx.createRadialGradient(lx, -h * 1.03, 0, lx, -h * 1.03, w * 0.75);
        g.addColorStop(0, `rgba(${col},${on ? 0.9 : 0.12})`);
        g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(lx, -h * 1.03, w * 0.75, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(${col},${on ? 1 : 0.35})`;
        this.roundRect(lx - w * 0.12, -h * 1.08, w * 0.24, h * 0.09, r * 0.25);
        ctx.fill();
      }

      // headlights flare when lunging
      for (const sd of [-1, 1]) {
        const hx = sd * w * 0.33;
        const hy = -h * 0.2;
        const rad = w * (c.lunging ? 0.42 : 0.24);
        const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, rad);
        g.addColorStop(0, "rgba(255,250,220,0.95)");
        g.addColorStop(1, "rgba(255,250,220,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(hx, hy, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = c.lunging ? "#ffffff" : "#ffe9a8";
        this.roundRect(hx - w * 0.09, hy - h * 0.04, w * 0.18, h * 0.08, r * 0.3);
        ctx.fill();
      }

      ctx.fillStyle = "rgba(15,23,42,0.9)";
      ctx.font = `900 ${Math.max(8, w * 0.1)}px Orbitron, monospace`;
      ctx.textAlign = "center";
      ctx.fillText("POLICE", 0, -h * 0.12);

      ctx.restore();
    }
  }

  private drawNitroOverlay() {
    const { ctx, W, H } = this;
    const a = Math.min(1, this.nitroT) * 0.5;
    const g = ctx.createRadialGradient(W / 2, H * 0.6, H * 0.2, W / 2, H * 0.6, H * 0.9);
    g.addColorStop(0, "rgba(255,160,40,0)");
    g.addColorStop(1, `rgba(255,120,30,${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = `rgba(255,220,150,${0.25 * a * 2})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      const t = (this.lastT / 60 + i * 37) % 100 / 100;
      const sx = (i / 14) * W;
      ctx.beginPath();
      ctx.moveTo(sx, t * H);
      ctx.lineTo(sx, t * H + 70);
      ctx.stroke();
    }
  }

  private drawWarpOverlay() {
    const { ctx, W, H } = this;
    const a = Math.min(1, this.warpT) * 0.3;
    ctx.fillStyle = `rgba(120,90,220,${a * 0.5})`;
    ctx.fillRect(0, 0, W, H);
    const rings = 3;
    for (let i = 0; i < rings; i++) {
      const p = ((this.lastT / 700 + i / rings) % 1);
      ctx.strokeStyle = `rgba(196,181,253,${(1 - p) * 0.35})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(W / 2, H * 0.62, p * W * 0.7, p * H * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawShieldBubble() {
    const { ctx } = this;
    const x = this.xAt(this.px, 0);
    const y = this.yAt(0) - 60 - this.airOffset(this.jumpH, 0);
    const u = Math.min(this.H / 700, 1.2);
    const r = 78 * u;
    const pulse = 0.55 + 0.25 * Math.sin(this.lastT * 0.006);
    const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r);
    g.addColorStop(0, "rgba(165,243,252,0.04)");
    g.addColorStop(0.8, `rgba(125,211,252,${0.16 * pulse})`);
    g.addColorStop(1, `rgba(56,189,248,${0.4 * pulse})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.82, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(190,240,255,${0.5 * pulse})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    // hex facets
    ctx.strokeStyle = `rgba(190,240,255,${0.18 * pulse})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(x, y, r * 0.82 * (0.3 + i * 0.22), r * (0.3 + i * 0.22), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /* ---------------- fx ---------------- */

  private drawWeather() {
    if (this.weatherBits.length === 0) return;
    const { ctx } = this;
    const kind = this.theme.weather;
    const col = this.theme.weatherColor;
    if (kind === "rain") {
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (const b of this.weatherBits) {
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - b.s * 0.12, b.y + b.s);
      }
      ctx.stroke();
    } else if (kind === "sand") {
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const b of this.weatherBits) {
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x + 24, b.y + 1.5);
      }
      ctx.stroke();
    } else if (kind === "petals") {
      for (const b of this.weatherBits) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.p);
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.ellipse(0, 0, b.s, b.s * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    } else if (kind === "fireflies") {
      for (const b of this.weatherBits) {
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.35 + 0.45 * Math.sin(b.p * 1.7);
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = col;
      for (const b of this.weatherBits) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawParticles() {
    const { ctx } = this;
    for (const p of this.particles) {
      const a = Math.max(p.life / p.maxLife, 0);
      if (p.shape === "smoke") {
        ctx.globalAlpha = a * 0.7;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.6 - a * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === "ring") {
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (2.6 - a * 2), 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.shape === "spark") {
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * 0.7;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
      } else if (p.shape === "shard") {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.vx * 0.004 + p.life * 6);
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size * 0.5, p.size * 0.6);
        ctx.lineTo(-p.size * 0.45, p.size * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawTexts() {
    const { ctx } = this;
    for (const t of this.texts) {
      const a = Math.min(t.life * 2, 1);
      ctx.globalAlpha = a;
      ctx.font = `900 ${Math.round(24 * t.scale)}px Orbitron, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(20,5,40,0.85)";
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  private drawSpeedLines() {
    if (this.phase !== "playing" || this.crashed || this.settings.reduceMotion) return;
    const { ctx, W, H } = this;
    const intensity = (this.speed - 24) / 18 + (this.nitroT > 0 ? 0.8 : 0) + this.speedFeelBoost;
    if (intensity <= 0) return;
    ctx.strokeStyle = `rgba(255,255,255,${0.1 * Math.min(intensity, 1.6)})`;
    ctx.lineWidth = 2;
    const n = Math.floor(8 * Math.min(intensity, 2));
    for (let i = 0; i < n; i++) {
      const seed = (i * 97 + Math.floor(this.lastT / 60)) % 100;
      const sx = (seed / 100) * W;
      const edge = Math.abs(sx - W / 2) / (W / 2);
      if (edge < 0.55) continue;
      const sy = (((seed * 37) % 100) / 100) * H;
      const len = 40 + edge * 120 * intensity;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + (sx > W / 2 ? len * 0.3 : -len * 0.3), sy + len);
      ctx.stroke();
    }
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number) {
    rrPath(this.ctx, x, y, w, h, r);
  }
}
