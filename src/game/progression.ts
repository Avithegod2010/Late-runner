/* ================================================================
   Meta-game: wallet, unlocks, missions, XP, streaks, leaderboards,
   telemetry, cup history, field guide rewards & crate pity.
   All local — no backend required.
   ================================================================ */

import { todayKey } from "./rng";
import { utf8ToB64url, b64urlToUtf8 } from "./codec";
import type { SeasonDef } from "./features";

export interface RunResult {
  score: number;
  coins: number;
  distance: number;
  nearMisses: number;
  jumps: number;
  carsJumped: number;
  policeJumped: number;
  stunts: number;
  airCoins: number;
  maxCombo: number;
  topSpeed: number;
  nitros: number;
  shields: number;
  magnets: number;
  warps: number;
  ramps: number;
  tunnelDistance: number;
  chases: number;
  perfectDodges: number;
  tolls: number;
  stuntChain: number;
  rescueUsed: number;
  deliveryQuality: number;
  bossWins: number;
  sectors: number[];
  vehicleTypes: string[];
  replay: ReplayFrame[];
  duelScore?: number;
  tournamentRound?: number;
  mode: string;
  difficulty: string;
  themeId: string;
  themeName: string;
  killer: string;
  killerLane: number;
  duration: number;
  bikeId: string;
  grindTime: number;
  wheelieTime: number;
  careerId?: number;
  weekKey?: string;
  banner: string;
  seed: number | null;
  /* ---- new feature results ---- */
  /** post-run coaching tips (crash analysis or clean-run praise) */
  coaching?: { title: string; detail: string }[];
  /** world collectibles picked up this run */
  collected?: string[];
  /** police chasers flung off (bounties) */
  flungPolice?: number;
  /** true once the brake was used (distanceNoBrake bounty) */
  brakeUsed?: boolean;
  /** slingshot bursts fired */
  slingshots?: number;
  /** toll-gate boost passes */
  tollBoosts?: number;
  /** hyperspace warp zones entered */
  warpZones?: number;
  /** power-up fusions triggered */
  fusions?: number;
  /** gunship encounters survived */
  heliWins?: number;
  /** co-op delivery outcome */
  coop?: { packageHp: number; combined: boolean };
}

export interface ReplayFrame {
  t: number;
  x: number;
  h: number;
  score: number;
  speed: number;
  lane: number;
  event?: string;
}

export interface RunHistoryItem {
  score: number;
  distance: number;
  coins: number;
  killer: string;
  killerLane?: number;
  mode: string;
  themeId: string;
  date: string;
}

export interface CupHistoryEntry {
  winner: string;
  runnerUp: string;
  winnerTotal: number;
  runnerTotal: number;
  p1Name: string;
  p2Name: string;
  p1Heats: number[];
  p2Heats: number[];
  date: string;
}

export const FIELD_GUIDE_TIERS = [
  { count: 3, reward: 150, title: "Spotter" },
  { count: 6, reward: 300, title: "Highway Scout" },
  { count: 9, reward: 500, title: "Traffic Master" },
] as const;

export const CRATE_PITY_MAX = 5;

/** True when the next crate is guaranteed Legendary. */
export function pityGuaranteed(pity: number) {
  return pity >= CRATE_PITY_MAX - 1;
}

/** Pity counter after opening a crate: resets on a Legendary or a forced pity roll, else climbs (capped). */
export function nextPity(pity: number, gotLegendary: boolean) {
  if (gotLegendary || pityGuaranteed(pity)) return 0;
  return Math.min(CRATE_PITY_MAX - 1, pity + 1);
}

/* ---------------- missions ---------------- */

export type MissionStat =
  | "nearMisses" | "coins" | "airCoins" | "carsJumped" | "distance"
  | "stunts" | "policeJumped" | "shields" | "nitros" | "maxCombo"
  | "ramps" | "tunnelDistance" | "jumps" | "warps" | "magnets" | "chases";

export interface Mission {
  id: string;
  stat: MissionStat;
  target: number;
  label: string;
}

/** Mission pool grows with set number so later sets ask for more. */
const MISSION_POOL: { stat: MissionStat; base: number; label: (n: number) => string }[] = [
  { stat: "nearMisses", base: 10, label: (n) => `Near-miss ${n} cars in one run` },
  { stat: "coins", base: 60, label: (n) => `Collect ${n} coins in one run` },
  { stat: "airCoins", base: 15, label: (n) => `Grab ${n} coins while airborne` },
  { stat: "carsJumped", base: 3, label: (n) => `Jump over ${n} cars` },
  { stat: "distance", base: 700, label: (n) => `Ride ${n}m in a single run` },
  { stat: "stunts", base: 4, label: (n) => `Land ${n} mid-air stunts` },
  { stat: "policeJumped", base: 2, label: (n) => `Jump over ${n} police cars` },
  { stat: "shields", base: 1, label: (n) => `Use ${n} crash shield${n > 1 ? "s" : ""}` },
  { stat: "nitros", base: 2, label: (n) => `Trigger ${n} nitro rampages` },
  { stat: "maxCombo", base: 5, label: (n) => `Reach a ×${n} near-miss combo` },
  { stat: "ramps", base: 2, label: (n) => `Launch off ${n} flatbed ramps` },
  { stat: "tunnelDistance", base: 250, label: (n) => `Ride ${n}m inside tunnels` },
  { stat: "jumps", base: 20, label: (n) => `Perform ${n} jumps` },
  { stat: "warps", base: 2, label: (n) => `Activate bullet time ${n} times` },
  { stat: "magnets", base: 2, label: (n) => `Activate ${n} coin magnets` },
  { stat: "chases", base: 1, label: (n) => `Survive ${n} police chase${n > 1 ? "s" : ""}` },
];

export function buildMissions(set: number): Mission[] {
  const scale = 1 + set * 0.45;
  const out: Mission[] = [];
  for (let i = 0; i < 3; i++) {
    const p = MISSION_POOL[(set * 3 + i) % MISSION_POOL.length];
    const target = Math.max(1, Math.round(p.base * scale));
    out.push({ id: `${set}-${i}-${p.stat}`, stat: p.stat, target, label: p.label(target) });
  }
  return out;
}

/* ---------------- rider levels ---------------- */

export const TITLES = [
  "Rookie", "Lane Splitter", "Curb Hopper", "Traffic Weaver", "Night Courier",
  "Chrome Dasher", "Siren Dodger", "Asphalt Ghost", "Neon Legend", "Highway Phantom",
];

export function xpForLevel(level: number) {
  return Math.round(500 * Math.pow(1.22, level - 1));
}

export function levelFromXp(xp: number) {
  let level = 1;
  let rem = xp;
  while (level < 60 && rem >= xpForLevel(level)) {
    rem -= xpForLevel(level);
    level++;
  }
  return { level, into: rem, need: xpForLevel(level) };
}

export function titleFor(level: number) {
  return TITLES[Math.min(TITLES.length - 1, Math.floor((level - 1) / 3))];
}

/* ---------------- badges ---------------- */

export interface Badge {
  id: string;
  name: string;
  desc: string;
  test: (p: Profile, r: RunResult | null) => boolean;
}

export const BADGES: Badge[] = [
  { id: "first", name: "First Ride", desc: "Finish a run", test: (p) => p.runs >= 1 },
  { id: "century", name: "Century", desc: "Ride 1,000m in one run", test: (_p, r) => !!r && r.distance >= 1000 },
  { id: "combo9", name: "Untouchable", desc: "Hit a ×9 combo", test: (_p, r) => !!r && r.maxCombo >= 9 },
  { id: "rich", name: "Coin Baron", desc: "Bank 5,000 coins total", test: (p) => p.lifetimeCoins >= 5000 },
  { id: "stunt", name: "Showboat", desc: "Land 10 stunts in a run", test: (_p, r) => !!r && r.stunts >= 10 },
  { id: "nitro", name: "Rampage", desc: "Use 3 nitros in a run", test: (_p, r) => !!r && r.nitros >= 3 },
  { id: "streak7", name: "Regular", desc: "7-day play streak", test: (p) => p.streak >= 7 },
  { id: "lvl10", name: "Veteran", desc: "Reach rider level 10", test: (p) => levelFromXp(p.xp).level >= 10 },
  { id: "police", name: "Outlaw", desc: "Jump 5 police cars", test: (_p, r) => !!r && r.policeJumped >= 5 },
  { id: "tunnel", name: "Underground", desc: "500m of tunnels in a run", test: (_p, r) => !!r && r.tunnelDistance >= 500 },
  { id: "mostwanted", name: "Most Wanted", desc: "Survive 3 chases in a run", test: (_p, r) => !!r && r.chases >= 3 },
];

/* ---------------- profile ---------------- */

export interface ScoreEntry {
  score: number;
  coins: number;
  distance: number;
  theme: string;
  themeId?: string;
  mode: string;
  difficulty: string;
  date: string;
}

export interface GhostFrame {
  t: number;
  x: number;
  h: number;
}

export interface Profile {
  wallet: number;
  lifetimeCoins: number;
  xp: number;
  runs: number;
  owned: string[];
  missionSet: number;
  missionProgress: Record<string, number>;
  badges: string[];
  streak: number;
  lastPlay: string;
  playDates: string[];
  scores: Record<string, ScoreEntry[]>;
  daily: Record<string, number>;
  ghost: GhostFrame[] | null;
  ghostScore: number;
  seenTutorial: boolean;
  vehicleSightings: Record<string, number>;
  claimedGuideTiers: number[];
  upgrades: Record<string, number>;
  rescueTickets: number;
  lastReplay: ReplayFrame[];
  bestSectors: number[];
  tournamentWins: number;
  duelWins: number;
  cupHistory: CupHistoryEntry[];
  ownedDecals: string[];
  plateText: string;
  companion: string;
  crates: number;
  cratePity: number;
  runHistory: RunHistoryItem[];
  hotStreak: number;
  lastRunScore: number;
  bikeXp: Record<string, number>;
  lifetime: { nearMisses: number; stunts: number; distance: number; coins: number; perfects: number; crashes: number };
  /** completed Rider Rebirths (prestige). Each grants +5% coins & score, capped. */
  rebirths: number;
  chainTiers: Record<string, number>;
  careerStars: Record<string, number>;
  weekly: { key: string; used: number; best: number };
  tutorial: { started: number; finished: number; skipped: number; stepReached: number[] };
  firstRuns: number[];
  consumables: { shield: number; ticket: number };
}

const LS_PROFILE = "wwr-profile-v3";

export const EMPTY_PROFILE: Profile = {
  wallet: 0,
  lifetimeCoins: 0,
  xp: 0,
  runs: 0,
  owned: ["neon", "comet", "ember", "mist", "airhorn"],
  missionSet: 0,
  missionProgress: {},
  badges: [],
  streak: 0,
  lastPlay: "",
  playDates: [],
  scores: {},
  daily: {},
  ghost: null,
  ghostScore: 0,
  seenTutorial: false,
  vehicleSightings: {},
  claimedGuideTiers: [],
  upgrades: {},
  rescueTickets: 1,
  lastReplay: [],
  bestSectors: [],
  tournamentWins: 0,
  duelWins: 0,
  cupHistory: [],
  ownedDecals: ["bolt", "flame"],
  plateText: "RIDER",
  companion: "none",
  crates: 0,
  cratePity: 0,
  runHistory: [],
  hotStreak: 0,
  lastRunScore: 0,
  bikeXp: {},
  lifetime: { nearMisses: 0, stunts: 0, distance: 0, coins: 0, perfects: 0, crashes: 0 },
  rebirths: 0,
  chainTiers: {},
  careerStars: {},
  weekly: { key: "", used: 0, best: 0 },
  tutorial: { started: 0, finished: 0, skipped: 0, stepReached: [0, 0, 0, 0, 0] },
  firstRuns: [],
  consumables: { shield: 0, ticket: 0 },
};

/* ---------------- untrusted-data sanitization ----------------
   localStorage saves and imported profile codes are untrusted: a
   corrupted write or a hostile code must never reach the render
   path with a wrong-typed field (that used to persist crash loops).
   Every loader funnels through sanitizeProfile. */

const isPlainObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const numOr = (v: unknown, fallback: number, min: number, max: number) => {
  // strict: a real save always stores actual numbers; anything else is tampering
  return typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
};

const intOr = (v: unknown, fallback: number, min: number, max: number) =>
  Math.round(numOr(v, fallback, min, max));

const strOr = (v: unknown, fallback: string, max: number) =>
  typeof v === "string" ? v.slice(0, max) : fallback;

const boolOr = (v: unknown, fallback: boolean) =>
  typeof v === "boolean" ? v : fallback;

const strArr = (v: unknown, max: number): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string").slice(0, max)
    : [];

const numArr = (v: unknown, max: number): number[] =>
  Array.isArray(v)
    ? v.filter((x): x is number => typeof x === "number" && Number.isFinite(x)).slice(0, max)
    : [];

/** string-keyed -> finite-number record; drops dangerous keys and non-numeric junk. */
const numRec = (v: unknown): Record<string, number> => {
  if (!isPlainObj(v)) return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v)) {
    if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
    if (typeof val === "number" && Number.isFinite(val)) out[k] = val;
  }
  return out;
};

const scoreEntryOf = (v: unknown): ScoreEntry | null => {
  if (!isPlainObj(v)) return null;
  const score = numOr(v.score, 0, 0, 1e12);
  if (score <= 0) return null;
  return {
    score,
    coins: numOr(v.coins, 0, 0, 1e9),
    distance: numOr(v.distance, 0, 0, 1e9),
    theme: strOr(v.theme, "Unknown", 60),
    themeId: typeof v.themeId === "string" ? v.themeId : undefined,
    mode: strOr(v.mode, "classic", 24),
    difficulty: strOr(v.difficulty, "normal", 24),
    date: strOr(v.date, "", 24),
  };
};

const ghostFrameOf = (v: unknown): GhostFrame | null => {
  if (!isPlainObj(v)) return null;
  if (![v.t, v.x, v.h].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  return { t: v.t as number, x: v.x as number, h: v.h as number };
};

const replayFrameOf = (v: unknown): ReplayFrame | null => {
  const g = ghostFrameOf(v);
  if (!g || !isPlainObj(v)) return null;
  return {
    ...g,
    score: numOr(v.score, 0, 0, 1e12),
    speed: numOr(v.speed, 0, 0, 1e6),
    lane: Math.round(numOr(v.lane, 0, -1, 1)),
    event: typeof v.event === "string" ? v.event.slice(0, 32) : undefined,
  };
};

/** Structural deep-validate of an untrusted profile-shaped value. */
export function sanitizeProfile(saved: unknown): Profile {
  const s = isPlainObj(saved) ? saved : {};
  const replay = Array.isArray(s.lastReplay)
    ? (s.lastReplay.map(replayFrameOf).filter(Boolean) as ReplayFrame[]).slice(-2700)
    : [];

  const profile: Profile = {
    wallet: numOr(s.wallet, 0, 0, 1e9),
    lifetimeCoins: numOr(s.lifetimeCoins, 0, 0, 1e12),
    xp: numOr(s.xp, 0, 0, 1e12),
    runs: intOr(s.runs, 0, 0, 1e9),
    owned: strArr(s.owned, 200),
    missionSet: intOr(s.missionSet, 0, 0, 999),
    missionProgress: numRec(s.missionProgress),
    badges: strArr(s.badges, 100),
    streak: intOr(s.streak, 0, 0, 9999),
    lastPlay: strOr(s.lastPlay, "", 10),
    playDates: strArr(s.playDates, 60),
    scores: (() => {
      if (!isPlainObj(s.scores)) return {};
      const out: Record<string, ScoreEntry[]> = {};
      const keys = Object.keys(s.scores)
        .filter((k) => k !== "__proto__" && k !== "constructor" && k !== "prototype")
        .slice(0, 200);
      for (const k of keys) {
        const list = Array.isArray(s.scores[k]) ? s.scores[k] : [];
        const entries = list
          .map(scoreEntryOf)
          .filter((e): e is ScoreEntry => e !== null)
          .sort((a, b) => b.score - a.score)
          .slice(0, 50);
        if (entries.length) out[k] = entries;
      }
      return out;
    })(),
    daily: numRec(s.daily),
    ghost: (() => {
      const g = Array.isArray(s.ghost)
        ? (s.ghost.map(ghostFrameOf).filter(Boolean) as GhostFrame[])
        : null;
      // the game only races ghosts with more than 4 frames — keep the same bar here
      return g && g.length > 4 ? g.slice(-12000) : null;
    })(),
    ghostScore: numOr(s.ghostScore, 0, 0, 1e12),
    seenTutorial: boolOr(s.seenTutorial, false),
    vehicleSightings: numRec(s.vehicleSightings),
    claimedGuideTiers: numArr(s.claimedGuideTiers, 10).map((n) => intOr(n, 0, 0, 9)),
    upgrades: numRec(s.upgrades),
    rescueTickets: intOr(s.rescueTickets, 0, 0, 3),
    lastReplay: replay,
    bestSectors: numArr(s.bestSectors, 8),
    tournamentWins: intOr(s.tournamentWins, 0, 0, 1e6),
    duelWins: intOr(s.duelWins, 0, 0, 1e6),
    cupHistory: Array.isArray(s.cupHistory)
      ? s.cupHistory.filter(isPlainObj).slice(0, 30) as unknown as CupHistoryEntry[]
      : [],
    ownedDecals: strArr(s.ownedDecals, 100),
    plateText: strOr(s.plateText, "RIDER", 16),
    companion: strOr(s.companion, "none", 32),
    crates: intOr(s.crates, 0, 0, 9999),
    cratePity: intOr(s.cratePity, 0, 0, CRATE_PITY_MAX),
    runHistory: (() => {
      if (!Array.isArray(s.runHistory)) return [];
      const out: RunHistoryItem[] = [];
      for (const item of s.runHistory) {
        if (!isPlainObj(item)) continue;
        // drop items whose core fields are junk instead of keeping zeros
        if (typeof item.score !== "number" || !Number.isFinite(item.score)) continue;
        out.push({
          score: Math.min(1e12, Math.max(0, item.score)),
          distance: numOr(item.distance, 0, 0, 1e9),
          coins: numOr(item.coins, 0, 0, 1e9),
          killer: strOr(item.killer, "Unknown", 40),
          killerLane: typeof item.killerLane === "number" && Number.isFinite(item.killerLane)
            ? Math.max(-1, Math.min(1, item.killerLane))
            : undefined,
          mode: strOr(item.mode, "classic", 24),
          themeId: strOr(item.themeId, "", 40),
          date: strOr(item.date, "", 24),
        });
      }
      return out.slice(-10);
    })(),
    hotStreak: intOr(s.hotStreak, 0, 0, 10),
    lastRunScore: numOr(s.lastRunScore, 0, 0, 1e12),
    bikeXp: numRec(s.bikeXp),
    lifetime: (() => {
      const l = isPlainObj(s.lifetime) ? s.lifetime : {};
      return {
        nearMisses: numOr(l.nearMisses, 0, 0, 1e9),
        stunts: numOr(l.stunts, 0, 0, 1e9),
        distance: numOr(l.distance, 0, 0, 1e12),
        coins: numOr(l.coins, 0, 0, 1e12),
        perfects: numOr(l.perfects, 0, 0, 1e9),
        crashes: numOr(l.crashes, 0, 0, 1e9),
      };
    })(),
    rebirths: intOr(s.rebirths, 0, 0, 99),
    chainTiers: numRec(s.chainTiers),
    careerStars: numRec(s.careerStars),
    weekly: (() => {
      const w = isPlainObj(s.weekly) ? s.weekly : {};
      return {
        key: strOr(w.key, "", 16),
        used: intOr(w.used, 0, 0, 3),
        best: numOr(w.best, 0, 0, 1e12),
      };
    })(),
    tutorial: (() => {
      const t = isPlainObj(s.tutorial) ? s.tutorial : {};
      return {
        started: intOr(t.started, 0, 0, 1e9),
        finished: intOr(t.finished, 0, 0, 1e9),
        skipped: intOr(t.skipped, 0, 0, 1e9),
        stepReached: numArr(t.stepReached, 5).map((n) => intOr(n, 0, 0, 99)),
      };
    })(),
    firstRuns: numArr(s.firstRuns, 5),
    consumables: (() => {
      const c = isPlainObj(s.consumables) ? s.consumables : {};
      return {
        shield: intOr(c.shield, 0, 0, 99),
        ticket: intOr(c.ticket, 0, 0, 99),
      };
    })(),
  };
  // never lose the starter items, even from an empty/hostile payload
  for (const id of EMPTY_PROFILE.owned) {
    if (!profile.owned.includes(id)) profile.owned.push(id);
  }
  for (const id of EMPTY_PROFILE.ownedDecals) {
    if (!profile.ownedDecals.includes(id)) profile.ownedDecals.push(id);
  }
  return profile;
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(LS_PROFILE);
    if (!raw) return structuredClone(EMPTY_PROFILE);
    return sanitizeProfile(JSON.parse(raw));
  } catch {
    return structuredClone(EMPTY_PROFILE);
  }
}

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(LS_PROFILE, JSON.stringify(p));
  } catch {
    /* storage full or blocked — game still runs */
  }
}

/* ---------------- achievement chains (tiered badges) ---------------- */

export interface AchievementChain {
  id: keyof Profile["lifetime"];
  name: string;
  tiers: number[];
  reward: number[];
}

export const CHAINS: AchievementChain[] = [
  { id: "nearMisses", name: "Close Call", tiers: [100, 500, 2000], reward: [150, 400, 1200] },
  { id: "stunts", name: "Showboat", tiers: [25, 150, 600], reward: [150, 400, 1200] },
  { id: "distance", name: "Long Hauler", tiers: [10000, 50000, 200000], reward: [200, 500, 1500] },
  { id: "coins", name: "Coin Hoarder", tiers: [2000, 10000, 50000], reward: [150, 400, 1200] },
  { id: "perfects", name: "Matrix Mind", tiers: [20, 100, 400], reward: [200, 500, 1500] },
];

export const TIER_NAMES = ["BRONZE", "SILVER", "GOLD"];

/* ---------------- hot streak ---------------- */

/** +4% score bonus per consecutive personal improvement, capped at +40%. */
export function hotStreakBonus(streak: number) {
  return Math.min(0.4, streak * 0.04);
}

/* ---------------- Rider Rebirth (prestige, v1.0) ---------------- */

/** Rider level required before a Rebirth is offered. */
export const PRESTIGE_MIN_LEVEL = 15;
/** Maximum Rebirth count. */
export const PRESTIGE_MAX = 5;

/** Permanent bonus multiplier from completed Rebirths: +5% per rebirth, capped at PRESTIGE_MAX. */
export function prestigeMultiplier(rebirths: number) {
  return 1 + Math.max(0, Math.min(PRESTIGE_MAX, Math.floor(rebirths))) * 0.05;
}

/**
 * Rebirth: resets level/xp back to 1 (the run of the gauntlet starts again)
 * while keeping everything a player actually owns — wallet, gear, crates,
 * career stars, records. Grants a permanent +5% coins & score per rebirth.
 * Returns null when the requirements are not met.
 */
export function doRebirth(profile: Profile): Profile | null {
  const lvl = levelFromXp(profile.xp).level;
  if (lvl < PRESTIGE_MIN_LEVEL) return null;
  if (profile.rebirths >= PRESTIGE_MAX) return null;
  return { ...profile, xp: 0, rebirths: profile.rebirths + 1, hotStreak: 0, lastRunScore: 0 };
}

/* ---------------- career scoring ---------------- */

/** 0 = failed, 1–3 stars. Delivered + objective = 2; beating it comfortably = 3. */
export function careerStarsFor(
  run: Pick<RunResult, "banner" | "duration" | "deliveryQuality">,
  c: { timeLimit: number; minQuality: number }
) {
  if (!run.banner.startsWith("DELIVERY COMPLETE")) return 0;
  const timeOk = !c.timeLimit || run.duration <= c.timeLimit;
  const qualOk = run.deliveryQuality >= c.minQuality;
  if (!timeOk || !qualOk) return 1;
  const timeGreat = !c.timeLimit || run.duration <= c.timeLimit * 0.85;
  const qualGreat = run.deliveryQuality >= Math.min(100, c.minQuality + 15);
  return timeGreat && qualGreat ? 3 : 2;
}

/* ---------------- death heatmap ---------------- */

export function deathHeatmap(history: RunHistoryItem[]) {
  const grid: Record<string, number> = {};
  for (const r of history) {
    if (r.killerLane === undefined || !r.killer || r.killer === "Time Up" || r.killer === "Delivered") continue;
    const k = `${r.killerLane}|${r.killer}`;
    grid[k] = (grid[k] ?? 0) + 1;
  }
  return grid;
}

/* ---------------- first-run instrumentation ---------------- */

export function median(xs: number[]) {
  if (!xs.length) return 0;
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
}

/* ---------------- profile export / import ---------------- */

export function exportProfile(p: Profile): string {
  const json = JSON.stringify({ v: 3, p: { ...p, lastReplay: [] } });
  return utf8ToB64url(json);
}

const IMPORT_MAX_CODE = 1_000_000;

export function importProfile(code: string): Profile | null {
  if (!code || code.length > IMPORT_MAX_CODE) return null;
  const json = b64urlToUtf8(code.trim());
  if (!json) return null;
  try {
    const data = JSON.parse(json) as { v?: number; p?: unknown };
    // reject unknown schema versions outright instead of mis-importing them
    if (!data || typeof data !== "object" || data.v !== 3 || !isPlainObj(data.p)) return null;
    return sanitizeProfile(data.p);
  } catch {
    return null;
  }
}

export function multiplierFor(set: number) {
  // 1x -> 30x across 20 completed sets.
  return Math.min(30, 1 + set * 1.45);
}

export function leaderboardKey(mode: string, difficulty: string, weekKey?: string) {
  if (mode === "daily") return "daily";
  if (mode === "weekly") return `weekly:${weekKey ?? ""}`;
  return `${mode}:${difficulty}`;
}

/** Filter board entries globally or for a specific world ID. */
export function filterBoard(entries: ScoreEntry[], worldId: string): ScoreEntry[] {
  if (!worldId || worldId === "all") return entries.slice(0, 5);
  return entries
    .filter((e) => e.themeId === worldId || e.theme.toLowerCase().includes(worldId.toLowerCase()))
    .slice(0, 5);
}

/** Returns the last 7 calendar days ending today for the streak calendar UI. */
export function lastSevenDays(playDates: string[]): { key: string; label: string; played: boolean; isToday: boolean }[] {
  const set = new Set(playDates);
  const now = new Date();
  const out: { key: string; label: string; played: boolean; isToday: boolean }[] = [];
  const names = ["S", "M", "T", "W", "T", "F", "S"];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    out.push({
      key,
      label: names[d.getDay()],
      played: set.has(key),
      isToday: i === 0,
    });
  }
  return out;
}

/** Day streak bookkeeping: returns updated profile + whether a bonus fired. */
export function touchStreak(p: Profile): { profile: Profile; bonus: number } {
  const today = new Date();
  const key = today.toISOString().slice(0, 10);
  let dates = [...(p.playDates ?? [])];
  // Backfill legacy streak dates once if needed (lastPlay is a UTC date key)
  if (dates.length === 0 && p.streak > 0 && p.lastPlay) {
    const base = new Date(p.lastPlay + "T00:00:00Z");
    for (let i = 0; i < Math.min(p.streak, 7); i++) {
      const k = new Date(base.getTime() - i * 86400000).toISOString().slice(0, 10);
      if (!dates.includes(k)) dates.push(k);
    }
  }
  if (p.lastPlay === key) {
    if (!dates.includes(key)) dates.push(key);
    return { profile: { ...p, playDates: dates.slice(-14) }, bonus: 0 };
  }
  const yesterday = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);
  const streak = p.lastPlay === yesterday ? p.streak + 1 : 1;
  const bonus = 25 + Math.min(streak, 10) * 15;
  if (!dates.includes(key)) dates.push(key);
  return {
    profile: { ...p, streak, lastPlay: key, playDates: dates.slice(-14), wallet: p.wallet + bonus },
    bonus,
  };
}

/** Apply a finished run: coins, xp, missions, badges, leaderboards, telemetry, ghost. */
export function applyRun(
  profile: Profile,
  run: RunResult,
  ghost: GhostFrame[] | null,
  season: SeasonDef | null = null
): {
  profile: Profile; completed: Mission[]; newBadges: Badge[]; levelUp: boolean; ticketsEarned: number;
  streakBonusCoins: number; chainUnlocks: string[];
} {
  const p: Profile = {
    ...profile,
    scores: { ...profile.scores },
    missionProgress: { ...profile.missionProgress },
    daily: { ...profile.daily },
    badges: [...profile.badges],
    vehicleSightings: { ...profile.vehicleSightings },
    runHistory: [...profile.runHistory],
    bikeXp: { ...profile.bikeXp },
    lifetime: { ...profile.lifetime },
    chainTiers: { ...profile.chainTiers },
    careerStars: { ...profile.careerStars },
    weekly: { ...profile.weekly },
    firstRuns: [...profile.firstRuns],
  };

  // first-60-seconds instrumentation: remember the distance of the first 5 runs ever
  if (p.firstRuns.length < 5 && run.mode !== "practice") p.firstRuns.push(run.distance);

  // Rider Rebirth prestige multiplier for this run (permanent +5% per rebirth)
  const pm = prestigeMultiplier(p.rebirths);

  // hot streak: beat your previous run to keep it alive
  let streakBonusCoins = 0;
  if (run.mode !== "practice" && run.mode !== "zen") {
    if (run.score > p.lastRunScore && p.lastRunScore > 0) {
      p.hotStreak = Math.min(10, p.hotStreak + 1);
      streakBonusCoins = Math.round(run.coins * hotStreakBonus(p.hotStreak));
    } else if (run.score < p.lastRunScore * 0.7) {
      p.hotStreak = 0;
    }
    p.lastRunScore = Math.round(run.score * pm);
  }

  // per-bike mastery XP
  p.bikeXp[run.bikeId] = (p.bikeXp[run.bikeId] ?? 0) + Math.round(run.distance * 0.5 + run.stunts * 20);

  // lifetime counters feed tiered achievement chains
  p.lifetime.nearMisses += run.nearMisses;
  p.lifetime.stunts += run.stunts;
  p.lifetime.distance += run.distance;
  p.lifetime.coins += run.coins;
  p.lifetime.perfects += run.perfectDodges;
  if (run.mode !== "zen" && run.killer && run.killer !== "Delivered" && run.killer !== "Time Up") {
    p.lifetime.crashes += 1;
  }
  // Rider Rebirth prestige: permanent +5% coins per rebirth (score handled below)
  if (pm > 1) {
    const prestigeCoins = Math.round(run.coins * (pm - 1));
    p.wallet += prestigeCoins;
    p.lifetimeCoins += prestigeCoins;
  }
  // seasonal event coin bonus (active calendar month only; off in practice)
  if (season && season.coinBonus > 0 && run.mode !== "practice") {
    const seasonCoins = Math.round(run.coins * season.coinBonus);
    p.wallet += seasonCoins;
    p.lifetimeCoins += seasonCoins;
  }
  const chainUnlocks: string[] = [];
  for (const ch of CHAINS) {
    let tier = p.chainTiers[ch.id] ?? 0;
    while (tier < ch.tiers.length && p.lifetime[ch.id] >= ch.tiers[tier]) {
      p.wallet += ch.reward[tier];
      chainUnlocks.push(`${ch.name} ${TIER_NAMES[tier]} (+${ch.reward[tier]})`);
      tier++;
    }
    p.chainTiers[ch.id] = tier;
  }

  // weekly challenge attempt
  if (run.mode === "weekly" && run.weekKey) {
    if (p.weekly.key !== run.weekKey) p.weekly = { key: run.weekKey, used: 0, best: 0 };
    p.weekly.used += 1;
    p.weekly.best = Math.max(p.weekly.best, Math.round(run.score * pm));
  }

  p.wallet += streakBonusCoins;

  const beforeLevel = levelFromXp(p.xp).level;
  // prestige-multiplied score is what the records store (engine score itself is untouched)
  const finalScore = Math.round(run.score * pm);
  p.runs += 1;
  p.wallet += run.coins;
  p.lifetimeCoins += run.coins;
  p.xp += Math.round(run.distance * 0.6 + run.stunts * 40 + run.nearMisses * 12);
  p.lastReplay = run.replay.slice(-2700);
  for (const kind of run.vehicleTypes) p.vehicleSightings[kind] = (p.vehicleSightings[kind] ?? 0) + 1;
  if (run.sectors.length) {
    p.bestSectors = run.sectors.map((split, i) => {
      const old = p.bestSectors[i];
      return old === undefined ? split : Math.min(old, split);
    });
  }

  // local analytics-free telemetry (last 10 runs)
  const dateLabel = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });
  p.runHistory = [
    ...p.runHistory,
    {
      score: run.score,
      distance: run.distance,
      coins: run.coins,
      killer: run.killer,
      killerLane: run.killerLane,
      mode: run.mode,
      themeId: run.themeId,
      date: dateLabel,
    },
  ].slice(-10);

  // missions
  const active = buildMissions(p.missionSet);
  const completed: Mission[] = [];
  let setCompleted = false;
  for (const m of active) {
    const value = (run as unknown as Record<string, number>)[m.stat] ?? 0;
    const prev = p.missionProgress[m.id] ?? 0;
    const next = Math.max(prev, Math.min(m.target, value));
    p.missionProgress[m.id] = next;
    if (next >= m.target && prev < m.target) completed.push(m);
  }
  if (active.every((m) => (p.missionProgress[m.id] ?? 0) >= m.target)) {
    p.missionSet += 1;
    p.wallet += 150 + p.missionSet * 50;
    setCompleted = true;
  }

  // rescue ticket economy: every 5 runs + boss wins + completed mission sets (cap 3)
  p.rescueTickets = Math.max(0, p.rescueTickets - run.rescueUsed);
  let ticketsEarned = 0;
  if (p.runs > 0 && p.runs % 5 === 0) ticketsEarned += 1;
  if (run.bossWins > 0) ticketsEarned += 1;
  if (setCompleted) ticketsEarned += 1;
  if (ticketsEarned > 0) {
    const before = p.rescueTickets;
    p.rescueTickets = Math.min(3, p.rescueTickets + ticketsEarned);
    ticketsEarned = p.rescueTickets - before;
  }

  // leaderboard: keep up to 5 top scores per world so per-theme leaderboards stay populated
  const key = leaderboardKey(run.mode, run.difficulty, run.weekKey);
  const entry: ScoreEntry = {
    score: finalScore,
    coins: run.coins,
    distance: run.distance,
    theme: run.themeName,
    themeId: run.themeId,
    mode: run.mode,
    difficulty: run.difficulty,
    date: dateLabel,
  };
  const allEntries = [...(p.scores[key] ?? []), entry].sort((a, b) => b.score - a.score);
  const perThemeCounts: Record<string, number> = {};
  p.scores[key] = allEntries.filter((e) => {
    const tk = e.themeId ?? e.theme;
    perThemeCounts[tk] = (perThemeCounts[tk] ?? 0) + 1;
    return perThemeCounts[tk] <= 5;
  });

  if (run.mode === "daily") {
    const dk = todayKey();
    p.daily[dk] = Math.max(p.daily[dk] ?? 0, finalScore);
  }

  // ghost: keep the best classic run
  if (ghost && ghost.length > 8 && run.score > p.ghostScore) {
    p.ghost = ghost;
    p.ghostScore = run.score;
  }

  // badges
  const newBadges: Badge[] = [];
  for (const b of BADGES) {
    if (!p.badges.includes(b.id) && b.test(p, run)) {
      p.badges.push(b.id);
      newBadges.push(b);
      p.wallet += 100;
    }
  }

  const level = levelFromXp(p.xp).level;
  const levelUp = level > beforeLevel;
  p.crates += Math.max(0, level - beforeLevel);
  // career stars are evaluated by the caller (needs the contract) and stored there
  return { profile: p, completed, newBadges, levelUp, ticketsEarned, streakBonusCoins, chainUnlocks };
}
