/* Rider garage selections stay lightweight so every option works offline. */

export type BikeId = "neon" | "racer" | "midnight" | "volt";
export type HelmetId = "comet" | "frost" | "solar" | "toxic";
export type JacketId = "ember" | "ocean" | "violet" | "lime";
export type TrailId = "mist" | "sparks" | "neon" | "confetti";
export type SteeringId = "relaxed" | "balanced" | "quick";
export type HornId = "airhorn" | "siren" | "dixie" | "laser" | "klaxon" | "train" | "basso";

export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface GarageChoice<T extends string> {
  id: T;
  name: string;
  detail: string;
  colors: [string, string];
  /** 0 = owned from the start. */
  price: number;
}

export const RARITY: Record<Rarity, { label: string; color: string; glow: string }> = {
  common: { label: "COMMON", color: "#94a3b8", glow: "rgba(148,163,184,0.35)" },
  rare: { label: "RARE", color: "#38bdf8", glow: "rgba(56,189,248,0.4)" },
  epic: { label: "EPIC", color: "#c084fc", glow: "rgba(192,132,252,0.45)" },
  legendary: { label: "LEGENDARY", color: "#fbbf24", glow: "rgba(251,191,36,0.5)" },
};

/** Price tiers double as rarity so the shop always reads consistently. */
export function rarityOf(price: number): Rarity {
  if (price <= 0) return "common";
  if (price <= 450) return "rare";
  if (price <= 800) return "epic";
  return "legendary";
}

export const BIKES: GarageChoice<BikeId>[] = [
  { id: "neon", name: "Neon Comet", detail: "All-rounder", colors: ["#ff4da6", "#c91870"], price: 0 },
  { id: "racer", name: "Sky Sprint", detail: "Race fairing", colors: ["#38bdf8", "#1265bb"], price: 450 },
  { id: "midnight", name: "Night Shift", detail: "Stealth trim", colors: ["#a78bfa", "#5b36ba"], price: 800 },
  { id: "volt", name: "Volt Runner", detail: "Electric lime", colors: ["#a3e635", "#4d8d13"], price: 500 },
];

export const HELMETS: GarageChoice<HelmetId>[] = [
  { id: "comet", name: "Comet", detail: "Pink racing stripe", colors: ["#ff4da6", "#ff8c42"], price: 0 },
  { id: "frost", name: "Frost", detail: "Ice blue visor", colors: ["#e0f2fe", "#38bdf8"], price: 250 },
  { id: "solar", name: "Solar", detail: "Gold visor", colors: ["#ffe066", "#f97316"], price: 400 },
  { id: "toxic", name: "Toxic", detail: "Radioactive green", colors: ["#bbf7d0", "#22c55e"], price: 650 },
];

export const JACKETS: GarageChoice<JacketId>[] = [
  { id: "ember", name: "Ember", detail: "Burnt orange", colors: ["#ff9a4d", "#d95316"], price: 0 },
  { id: "ocean", name: "Ocean", detail: "Deep cyan", colors: ["#67e8f9", "#0891b2"], price: 300 },
  { id: "violet", name: "Violet", detail: "Electric purple", colors: ["#c4b5fd", "#7c3aed"], price: 550 },
  { id: "lime", name: "Lime", detail: "High visibility", colors: ["#d9f99d", "#65a30d"], price: 700 },
];

export const TRAILS: GarageChoice<TrailId>[] = [
  { id: "mist", name: "Mist", detail: "Soft road dust", colors: ["#e9d5ff", "#a78bfa"], price: 0 },
  { id: "sparks", name: "Sparks", detail: "Hot metal", colors: ["#ffe066", "#f97316"], price: 600 },
  { id: "neon", name: "Neon", detail: "Pink afterglow", colors: ["#f9a8d4", "#ec4899"], price: 900 },
  { id: "confetti", name: "Prism", detail: "Color burst", colors: ["#67e8f9", "#a3e635"], price: 1200 },
];

export const HORNS: GarageChoice<HornId>[] = [
  { id: "airhorn", name: "Air Horn", detail: "Classic blast", colors: ["#fca5a5", "#dc2626"], price: 0 },
  { id: "siren", name: "Siren", detail: "Wail sweep", colors: ["#93c5fd", "#2563eb"], price: 350 },
  { id: "dixie", name: "Dixie", detail: "Three-note", colors: ["#fcd34d", "#d97706"], price: 500 },
  { id: "laser", name: "Laser Blip", detail: "Sci-fi zap", colors: ["#a5f3fc", "#06b6d4"], price: 750 },
  { id: "klaxon", name: "Klaxon", detail: "Ahooga double blast", colors: ["#fdba74", "#c2410c"], price: 300 },
  { id: "train", name: "Train Chime", detail: "Two-note brass chord", colors: ["#d4d4d8", "#71717a"], price: 600 },
  { id: "basso", name: "Basso Profondo", detail: "Deep truck rumble", colors: ["#a8a29e", "#44403c"], price: 900 },
];

/* ---------------- wheel customization (Garage → WHEELS) ---------------- */

export type WheelStyleId = "sport" | "mag5" | "disc" | "neon" | "knobby" | "deep";

export const WHEEL_STYLES: { id: WheelStyleId; name: string; hint: string }[] = [
  { id: "sport", name: "SPORT", hint: "3-spoke stock rims" },
  { id: "mag5", name: "MAG 5", hint: "5-spoke mag wheels" },
  { id: "disc", name: "DISC", hint: "Aero solid covers" },
  { id: "neon", name: "NEON", hint: "Glowing rim rings" },
  { id: "knobby", name: "KNOBBY", hint: "Off-road tread" },
  { id: "deep", name: "DEEP DISH", hint: "Wide low-profile rims" },
];

export const WHEEL_COLORS: string[] = [
  "#e2e8f0", "#fbbf24", "#f87171", "#4ade80",
  "#22d3ee", "#f472b6", "#a78bfa", "#ffffff",
];

export function wheelStyleById(id: string): { id: WheelStyleId; name: string; hint: string } {
  return WHEEL_STYLES.find((w) => w.id === id) ?? WHEEL_STYLES[0];
}

/** Rim colors must be plain #rrggbb hex — anything else falls back to stock. */
export function sanitizeWheelColor(v: unknown): string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : WHEEL_COLORS[0];
}

export const STEERING: { id: SteeringId; name: string; detail: string }[] = [
  { id: "relaxed", name: "Relaxed", detail: "70px swipe" },
  { id: "balanced", name: "Balanced", detail: "52px swipe" },
  { id: "quick", name: "Quick", detail: "36px swipe" },
];

export const getChoice = <T extends string>(choices: GarageChoice<T>[], id: string) =>
  choices.find((choice) => choice.id === id) ?? choices[0];

export const ALL_SHOP: {
  key: "bikeId" | "helmetId" | "jacketId" | "trailId" | "hornId";
  label: string;
  items: GarageChoice<string>[];
}[] = [
  { key: "bikeId", label: "BIKES", items: BIKES as GarageChoice<string>[] },
  { key: "helmetId", label: "HELMETS", items: HELMETS as GarageChoice<string>[] },
  { key: "jacketId", label: "JACKETS", items: JACKETS as GarageChoice<string>[] },
  { key: "trailId", label: "TRAILS", items: TRAILS as GarageChoice<string>[] },
  { key: "hornId", label: "HORNS", items: HORNS as GarageChoice<string>[] },
];

/* ---------------- bike handling stats (1.0 = baseline) ---------------- */

export interface BikeStats {
  handling: number;
  accel: number;
  jump: number;
  /** passive unlocked at mastery level 3 */
  passive: string;
}

export const BIKE_STATS: Record<BikeId, BikeStats> = {
  neon: { handling: 1.0, accel: 1.0, jump: 1.0, passive: "+5% coins" },
  racer: { handling: 1.18, accel: 1.12, jump: 0.92, passive: "+8% slipstream charge" },
  midnight: { handling: 0.94, accel: 1.22, jump: 1.04, passive: "+0.5s nitro" },
  volt: { handling: 1.06, accel: 0.9, jump: 1.16, passive: "+10% stunt score" },
};

/** Mastery level from per-bike XP (0..5). */
export function masteryLevel(xp: number) {
  return Math.min(5, Math.floor(Math.sqrt(Math.max(0, xp) / 600)));
}
