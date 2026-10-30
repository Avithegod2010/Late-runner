import type { Weather } from "./themes";
import { bytesToB64url, b64urlToBytes } from "./codec";

export type ModifierId = "no-jump" | "double-coins" | "closed-lane" | "heavy-rain" | "speed-demons" | "mirror";

export const MODIFIERS: { id: ModifierId; name: string; detail: string; icon: string }[] = [
  { id: "no-jump", name: "No Jump", detail: "Steer around everything", icon: "BRAKE" },
  { id: "double-coins", name: "Double Coins", detail: "Coins are worth double", icon: "2X" },
  { id: "closed-lane", name: "Lane Closure", detail: "One lane is blocked", icon: "ROADWORK" },
  { id: "heavy-rain", name: "Downpour", detail: "Wet road and heavy rain", icon: "RAIN" },
  { id: "speed-demons", name: "Speed Demons", detail: "Faster oncoming cars", icon: "FAST" },
  { id: "mirror", name: "Mirror Mode", detail: "Steering is flipped all run", icon: "FLIP" },
];

export interface RouteConfig {
  name: string;
  seed: number;
  traffic: number;
  hazards: number;
  weather: Weather;
}

export const ROUTE_PRESETS: RouteConfig[] = [
  { name: "Sunset Sprint", seed: 19842026, traffic: 0.8, hazards: 0.7, weather: "none" },
  { name: "Rainy Ringroad", seed: 24051988, traffic: 1, hazards: 1.15, weather: "rain" },
  { name: "Desert Switchback", seed: 734901, traffic: 0.9, hazards: 1.3, weather: "sand" },
  { name: "Frostline Express", seed: 11235813, traffic: 1.1, hazards: 0.9, weather: "snow" },
];

export const UPGRADE_TREE = [
  { id: "magnet", name: "Magnet Coil", detail: "+1s coin magnet duration", max: 3, base: 350 },
  { id: "shield", name: "Kevlar Weave", detail: "Start runs with a rescue ticket", max: 2, base: 900 },
  { id: "coin", name: "Lucky Lining", detail: "+10% coin value", max: 3, base: 600 },
  { id: "jump", name: "Suspension Kit", detail: "+8% jump height", max: 3, base: 700 },
] as const;

export type UpgradeId = (typeof UPGRADE_TREE)[number]["id"];

export interface SeasonDef {
  id: string;
  name: string;
  month: number;
  accent: string;
  weather: Weather;
  /** shown on the home banner chip */
  tagline: string;
  /** extra coin fraction granted during the event (0.15 = +15%) */
  coinBonus: number;
}

export const SEASONS: SeasonDef[] = [
  { id: "halloween", name: "Haunted Highway", month: 10, accent: "#fb923c", weather: "ash", tagline: "Ember fog rolls through October", coinBonus: 0.15 },
  { id: "winter", name: "Winter Lights", month: 12, accent: "#7dd3fc", weather: "snow", tagline: "Slick streets, bright snow", coinBonus: 0.15 },
  { id: "spring", name: "Petal Festival", month: 4, accent: "#f9a8d4", weather: "petals", tagline: "Petals drift across the lanes", coinBonus: 0.1 },
  { id: "summer", name: "Firework Run", month: 7, accent: "#fde047", weather: "fireflies", tagline: "Fireflies light the night run", coinBonus: 0.1 },
];

export function activeSeason(month = new Date().getMonth() + 1) {
  return SEASONS.find((s) => s.month === month) ?? null;
}

export const DEFAULT_GAMEPAD = {
  left: 14, right: 15, jump: 0, brake: 1, horn: 2, pause: 9,
};

export type GamepadAction = keyof typeof DEFAULT_GAMEPAD;

export const STATION_NAMES = ["Synthwave", "Arcade", "Cruise"] as const;
export type StationId = "synthwave" | "arcade" | "cruise";
/* ---------------- career contracts ---------------- */

export interface CareerContract {
  id: number;
  name: string;
  brief: string;
  seed: number;
  weather: Weather;
  traffic: number;
  hazards: number;
  /** delivery distance in metres */
  distance: number;
  /** seconds; 0 = no limit */
  timeLimit: number;
  /** minimum package condition 0..100 */
  minQuality: number;
}

export const CAREER: CareerContract[] = [
  { id: 1, name: "First Shift", brief: "Deliver a pizza across town. No rush.", seed: 1101, weather: "none", traffic: 0.7, hazards: 0.6, distance: 900, timeLimit: 0, minQuality: 0 },
  { id: 2, name: "Hot & Fresh", brief: "Pizza in under 70s.", seed: 1102, weather: "none", traffic: 0.8, hazards: 0.7, distance: 1000, timeLimit: 70, minQuality: 0 },
  { id: 3, name: "Glass Cargo", brief: "Package must arrive 80% intact.", seed: 1103, weather: "none", traffic: 0.8, hazards: 0.8, distance: 1100, timeLimit: 0, minQuality: 80 },
  { id: 4, name: "Rain Run", brief: "Wet roads. Under 90s.", seed: 1104, weather: "rain", traffic: 0.9, hazards: 0.9, distance: 1300, timeLimit: 90, minQuality: 0 },
  { id: 5, name: "Desert Drop", brief: "Sandstorm, 70% intact.", seed: 1105, weather: "sand", traffic: 0.9, hazards: 1.0, distance: 1300, timeLimit: 0, minQuality: 70 },
  { id: 6, name: "Rush Hour", brief: "Heavy traffic. Under 100s.", seed: 1106, weather: "none", traffic: 1.3, hazards: 0.9, distance: 1500, timeLimit: 100, minQuality: 0 },
  { id: 7, name: "Black Ice", brief: "Snow and icy brakes, 75% intact.", seed: 1107, weather: "snow", traffic: 1.0, hazards: 1.0, distance: 1500, timeLimit: 0, minQuality: 75 },
  { id: 8, name: "Night Express", brief: "Under 110s, 60% intact.", seed: 1108, weather: "fireflies", traffic: 1.1, hazards: 1.1, distance: 1700, timeLimit: 110, minQuality: 60 },
  { id: 9, name: "Roadworks", brief: "Hazards everywhere. 70% intact.", seed: 1109, weather: "none", traffic: 1.0, hazards: 1.5, distance: 1700, timeLimit: 0, minQuality: 70 },
  { id: 10, name: "Monsoon", brief: "Rain, heavy traffic, under 120s.", seed: 1110, weather: "rain", traffic: 1.4, hazards: 1.2, distance: 1900, timeLimit: 120, minQuality: 0 },
  { id: 11, name: "Fragile Gold", brief: "90% intact, any time.", seed: 1111, weather: "none", traffic: 1.2, hazards: 1.2, distance: 1900, timeLimit: 0, minQuality: 90 },
  { id: 12, name: "Last Delivery", brief: "Under 130s and 80% intact.", seed: 1112, weather: "snow", traffic: 1.5, hazards: 1.4, distance: 2200, timeLimit: 130, minQuality: 80 },
  /* ---- Harbor Finale: the campaign capstone (unlock: District Map) ---- */
  { id: 13, name: "First Light", brief: "Dawn run on the pier. No time limit.", seed: 1113, weather: "none", traffic: 1.4, hazards: 1.4, distance: 2400, timeLimit: 0, minQuality: 60 },
  { id: 14, name: "Container Storm", brief: "The zeppelin hunts. Survive to the drop.", seed: 1114, weather: "rain", traffic: 1.5, hazards: 1.5, distance: 2600, timeLimit: 0, minQuality: 70 },
  { id: 15, name: "The Last Harbor", brief: "Everything at once. Under 140s, 80% intact.", seed: 1115, weather: "fireflies", traffic: 1.6, hazards: 1.5, distance: 2800, timeLimit: 140, minQuality: 80 },
  /* ---- Old Town: post-game district (petal season in the old quarter) ---- */
  { id: 16, name: "Morning Market", brief: "Petals, market stalls, 85% intact.", seed: 1116, weather: "petals", traffic: 1.1, hazards: 1.2, distance: 2000, timeLimit: 0, minQuality: 85 },
  { id: 17, name: "Cobble Rush", brief: "The old quarter, under 115s.", seed: 1117, weather: "none", traffic: 1.2, hazards: 1.3, distance: 2100, timeLimit: 115, minQuality: 0 },
  { id: 18, name: "Tram Chase", brief: "Ash over the tram lines. 70% intact.", seed: 1118, weather: "ash", traffic: 1.3, hazards: 1.4, distance: 2300, timeLimit: 0, minQuality: 70 },
  /* ---- Skyline Loop: the final district, up where the air thins ---- */
  { id: 19, name: "Rooftop Run", brief: "Up high with the drones. 75% intact.", seed: 1119, weather: "none", traffic: 1.4, hazards: 1.4, distance: 2400, timeLimit: 0, minQuality: 75 },
  { id: 20, name: "Storm Sprint", brief: "Rain-slick rooftops, under 125s.", seed: 1120, weather: "rain", traffic: 1.5, hazards: 1.5, distance: 2600, timeLimit: 125, minQuality: 0 },
  { id: 21, name: "Final Bell", brief: "The city's last word. Under 150s, 80% intact.", seed: 1121, weather: "fireflies", traffic: 1.6, hazards: 1.6, distance: 3000, timeLimit: 150, minQuality: 80 },
];

/** First contract id that belongs to the Harbor Finale district. */
export const HARBOR_FIRST_CONTRACT = 13;
/** Contract ids that belong to the Harbor Finale district. */
const HARBOR_CONTRACTS = new Set([13, 14, 15]);
/** True when this career run happens under the Cargo Zeppelin's airspace. */
export function isHarborContract(careerId?: number): boolean {
  return typeof careerId === "number" && HARBOR_CONTRACTS.has(careerId);
}

/* ---------------- weekly challenge ---------------- */

/** ISO-8601 week key like 2026-W07. */
export function isoWeekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function weekSeed(key = isoWeekKey()) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Two modifiers chosen deterministically from the week seed (never no-jump + mirror together). */
export function weeklyModifiers(seed = weekSeed()): ModifierId[] {
  const pool: ModifierId[] = ["double-coins", "closed-lane", "heavy-rain", "speed-demons", "mirror", "no-jump"];
  const a = pool[seed % pool.length];
  let b = pool[Math.floor(seed / 7) % pool.length];
  if (b === a || (a === "mirror" && b === "no-jump") || (a === "no-jump" && b === "mirror")) {
    b = pool[(pool.indexOf(a) + 2) % pool.length];
  }
  return [a, b];
}

export const WEEKLY_ATTEMPTS = 3;

/* ---------------- ghost share codes ---------------- */

export interface GhostPoint { t: number; x: number; h: number }

/** Upper bound for accepted ghost codes (~150 s × 5 Hz × 2 B ≈ 800 chars; generous headroom). */
const MAX_GHOST_CODE = 8192;

/**
 * Compact ghost codec: resample to 5 Hz, quantise x/h to bytes, delta-free
 * fixed width (2 bytes per sample), URL-safe base64. A 2-minute run is
 * roughly 1,600 characters.
 */
export function encodeGhost(frames: GhostPoint[], maxSeconds = 150): string {
  if (!frames.length) return "";
  const out: number[] = [];
  let fi = 0;
  const end = Math.min(frames[frames.length - 1].t, maxSeconds);
  for (let t = 0; t <= end; t += 0.2) {
    while (fi < frames.length - 1 && frames[fi + 1].t <= t) fi++;
    const f = frames[fi];
    out.push(Math.max(0, Math.min(255, Math.round((f.x + 1.2) * 100))));
    out.push(Math.max(0, Math.min(255, Math.round(f.h * 100))));
  }
  return bytesToB64url(new Uint8Array(out));
}

export function decodeGhost(code: string): GhostPoint[] | null {
  if (!code || code.length > MAX_GHOST_CODE) return null;
  const bytes = b64urlToBytes(code);
  if (!bytes) return null;
  const frames: GhostPoint[] = [];
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    frames.push({
      t: +((i / 2) * 0.2).toFixed(2),
      x: bytes[i] / 100 - 1.2,
      h: bytes[i + 1] / 100,
    });
  }
  return frames.length > 4 ? frames : null;
}
