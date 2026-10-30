/* ================================================================
   THEMES — sky, ground, road, props, weather + day/night blending
   ================================================================ */

import { utf8ToB64url, b64urlToUtf8 } from "./codec";

export type PropKind =
  | "palm" | "building" | "streetlight" | "billboard" | "pine" | "cactus"
  | "rock" | "skyscraper" | "neon" | "lantern" | "torii" | "sakura"
  | "windmill" | "watertower" | "arch" | "pumpkin" | "gift" | "lilypad" | "firework";

export type Weather = "none" | "rain" | "snow" | "petals" | "sand" | "fireflies" | "ash";

export interface Theme {
  id: string;
  name: string;
  tagline: string;
  swatch: [string, string, string];
  sky: [number, string][];
  celestial: "retro-sun" | "moon" | "sun" | "none";
  celestialColors: [string, string];
  celestialGlow: string;
  stars: number;
  ground: [string, string];
  road: string;
  edges: [string, string];
  dash: string;
  horizon: string;
  arrow: string;
  props: PropKind[];
  propTint: string;
  weather: Weather;
  weatherColor: string;
  vignette: string;
  accent: string;
  accentSoft: string;
  headlightTrail: boolean;
}

/* ---------------- colour helpers for blending ---------------- */

type RGBA = [number, number, number, number];

function parseColor(c: string): RGBA {
  if (c.startsWith("#")) {
    let h = c.slice(1);
    if (h.length === 3) h = h.split("").map((x) => x + x).join("");
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(",").map((x) => parseFloat(x.trim()));
    return [p[0] || 0, p[1] || 0, p[2] || 0, p[3] === undefined ? 1 : p[3]];
  }
  return [255, 255, 255, 1];
}

function toCss([r, g, b, a]: RGBA) {
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${+a.toFixed(3)})`;
}

export function mixColor(a: string, b: string, t: number) {
  const A = parseColor(a);
  const B = parseColor(b);
  return toCss([
    A[0] + (B[0] - A[0]) * t,
    A[1] + (B[1] - A[1]) * t,
    A[2] + (B[2] - A[2]) * t,
    A[3] + (B[3] - A[3]) * t,
  ]);
}

export function shade(c: string, amount: number) {
  const [r, g, b, a] = parseColor(c);
  const f = (v: number) =>
    amount >= 0 ? v + (255 - v) * amount : v * (1 + amount);
  return toCss([f(r), f(g), f(b), a]);
}

/* ---------------- selectable themes ---------------- */

export const THEMES: Theme[] = [
  {
    id: "synthwave", name: "Neon Sunset", tagline: "Retro vapor highway",
    swatch: ["#ff4da6", "#8a2e7a", "#ffe066"],
    sky: [[0, "#140a2e"], [0.45, "#3b1465"], [0.78, "#8a2e7a"], [1, "#ff5e62"]],
    celestial: "retro-sun", celestialColors: ["#ffe066", "#ff4da6"],
    celestialGlow: "rgba(255,140,90,0.45)", stars: 26,
    ground: ["#2a1245", "#190b33"], road: "#231836",
    edges: ["#ffb703", "#ff4da6"], dash: "rgba(255,255,255,0.75)",
    horizon: "rgba(255,105,180,0.6)", arrow: "rgba(255,70,70,0.5)",
    props: ["palm", "building", "streetlight", "billboard", "palm", "neon"],
    propTint: "#3d2259", weather: "none", weatherColor: "#ffffff",
    vignette: "rgba(10,2,24,0.5)", accent: "#ff4da6", accentSoft: "rgba(255,77,166,0.25)",
    headlightTrail: true,
  },
  {
    id: "city", name: "Midnight City", tagline: "Rain-slick downtown",
    swatch: ["#38bdf8", "#0f172a", "#a78bfa"],
    sky: [[0, "#04060f"], [0.5, "#0b1733"], [0.82, "#1b3a63"], [1, "#3b6ea8"]],
    celestial: "moon", celestialColors: ["#f1f5ff", "#b9c8e8"],
    celestialGlow: "rgba(150,190,255,0.35)", stars: 40,
    ground: ["#101a2e", "#070c18"], road: "#141b2b",
    edges: ["#f8fafc", "#38bdf8"], dash: "rgba(226,232,240,0.8)",
    horizon: "rgba(56,189,248,0.55)", arrow: "rgba(248,113,113,0.42)",
    props: ["skyscraper", "neon", "streetlight", "building", "skyscraper", "billboard"],
    propTint: "#1e293b", weather: "rain", weatherColor: "rgba(170,210,255,0.55)",
    vignette: "rgba(2,6,18,0.62)", accent: "#38bdf8", accentSoft: "rgba(56,189,248,0.22)",
    headlightTrail: true,
  },
  {
    id: "desert", name: "Desert Dawn", tagline: "Dust & big sky",
    swatch: ["#fb923c", "#fcd34d", "#7c2d12"],
    sky: [[0, "#2b1055"], [0.38, "#7e3f8f"], [0.68, "#e86a4a"], [1, "#ffc46b"]],
    celestial: "sun", celestialColors: ["#fff3c4", "#fb923c"],
    celestialGlow: "rgba(255,180,90,0.5)", stars: 14,
    ground: ["#a2603a", "#5b3220"], road: "#4a3a33",
    edges: ["#fde68a", "#f97316"], dash: "rgba(255,247,222,0.85)",
    horizon: "rgba(255,196,107,0.7)", arrow: "rgba(190,40,40,0.45)",
    props: ["cactus", "rock", "windmill", "billboard", "cactus", "watertower"],
    propTint: "#6b4226", weather: "sand", weatherColor: "rgba(255,214,150,0.5)",
    vignette: "rgba(60,20,10,0.5)", accent: "#fb923c", accentSoft: "rgba(251,146,60,0.22)",
    headlightTrail: false,
  },
  {
    id: "alpine", name: "Alpine Frost", tagline: "Snowy mountain pass",
    swatch: ["#e0f2fe", "#7dd3fc", "#1e3a5f"],
    sky: [[0, "#1e3a5f"], [0.42, "#4e7fae"], [0.75, "#9ec8e4"], [1, "#e6f3fb"]],
    celestial: "sun", celestialColors: ["#ffffff", "#cfe9ff"],
    celestialGlow: "rgba(220,240,255,0.55)", stars: 0,
    ground: ["#cfe3f0", "#9bb6c9"], road: "#5a6b78",
    edges: ["#fef3c7", "#e11d48"], dash: "rgba(255,255,255,0.92)",
    horizon: "rgba(255,255,255,0.75)", arrow: "rgba(190,40,60,0.4)",
    props: ["pine", "pine", "rock", "streetlight", "pine", "arch"],
    propTint: "#415a6b", weather: "snow", weatherColor: "rgba(255,255,255,0.9)",
    vignette: "rgba(30,58,95,0.45)", accent: "#7dd3fc", accentSoft: "rgba(125,211,252,0.22)",
    headlightTrail: false,
  },
  {
    id: "sakura", name: "Sakura Night", tagline: "Petals on the wind",
    swatch: ["#fda4d4", "#4c1d60", "#fde68a"],
    sky: [[0, "#190b2e"], [0.42, "#43175c"], [0.76, "#9d3f7d"], [1, "#f6a7c6"]],
    celestial: "moon", celestialColors: ["#fff6fb", "#ffd8ea"],
    celestialGlow: "rgba(255,190,220,0.4)", stars: 34,
    ground: ["#33143f", "#1d0b28"], road: "#2b1b33",
    edges: ["#fde68a", "#fb7ab5"], dash: "rgba(255,240,250,0.8)",
    horizon: "rgba(253,164,212,0.65)", arrow: "rgba(255,90,120,0.45)",
    props: ["sakura", "lantern", "torii", "sakura", "lantern", "building"],
    propTint: "#4a2350", weather: "petals", weatherColor: "#ffb7d5",
    vignette: "rgba(20,5,30,0.52)", accent: "#fb7ab5", accentSoft: "rgba(251,122,181,0.22)",
    headlightTrail: true,
  },
  {
    id: "toxic", name: "Toxic Grid", tagline: "Radioactive outskirts",
    swatch: ["#4ade80", "#052e16", "#a3e635"],
    sky: [[0, "#020c08"], [0.46, "#06301f"], [0.78, "#0d7a4a"], [1, "#7ef0a8"]],
    celestial: "moon", celestialColors: ["#d9ffe9", "#86efac"],
    celestialGlow: "rgba(110,240,160,0.4)", stars: 30,
    ground: ["#07291c", "#031510"], road: "#13261f",
    edges: ["#a3e635", "#22d3ee"], dash: "rgba(214,255,228,0.8)",
    horizon: "rgba(74,222,128,0.6)", arrow: "rgba(255,80,80,0.45)",
    props: ["watertower", "neon", "skyscraper", "streetlight", "rock", "windmill"],
    propTint: "#17402f", weather: "ash", weatherColor: "rgba(163,230,53,0.6)",
    vignette: "rgba(2,16,10,0.6)", accent: "#4ade80", accentSoft: "rgba(74,222,128,0.2)",
    headlightTrail: true,
  },
];

/* ---------------- day/night cycle stages ---------------- */

THEMES.push({
  id: "contrast", name: "High Contrast", tagline: "Max legibility",
  swatch: ["#ffffff", "#000000", "#ffd400"],
  sky: [[0, "#000000"], [0.5, "#0a0a0a"], [0.85, "#1a1a1a"], [1, "#2a2a2a"]],
  celestial: "none", celestialColors: ["#ffffff", "#ffffff"],
  celestialGlow: "rgba(0,0,0,0)", stars: 0,
  ground: ["#111111", "#000000"], road: "#1c1c1c",
  edges: ["#ffd400", "#00e5ff"], dash: "rgba(255,255,255,1)",
  horizon: "rgba(255,255,255,0.9)", arrow: "rgba(255,60,60,0.75)",
  props: ["streetlight", "rock", "streetlight", "billboard"],
  propTint: "#3a3a3a", weather: "none", weatherColor: "#ffffff",
  vignette: "rgba(0,0,0,0.2)", accent: "#ffd400", accentSoft: "rgba(255,212,0,0.25)",
  headlightTrail: false,
});

export const CYCLE: Theme[] = [
  {
    ...THEMES[0], id: "c-sunset", name: "Sunset", tagline: "Golden hour",
  },
  {
    id: "c-twilight", name: "Twilight", tagline: "Fading light",
    swatch: ["#a78bfa", "#4c1d95", "#f9a8d4"],
    sky: [[0, "#0d0725"], [0.45, "#2b1e60"], [0.78, "#6d3b8f"], [1, "#c86a9a"]],
    celestial: "retro-sun", celestialColors: ["#ffd8a8", "#c94f9a"],
    celestialGlow: "rgba(190,120,200,0.4)", stars: 34,
    ground: ["#21153f", "#120a2a"], road: "#1f1733",
    edges: ["#fcd34d", "#c084fc"], dash: "rgba(240,235,255,0.78)",
    horizon: "rgba(200,130,220,0.6)", arrow: "rgba(255,90,90,0.46)",
    props: ["building", "streetlight", "palm", "neon", "billboard", "skyscraper"],
    propTint: "#2e1f4d", weather: "fireflies", weatherColor: "rgba(255,230,160,0.8)",
    vignette: "rgba(8,3,20,0.54)", accent: "#c084fc", accentSoft: "rgba(192,132,252,0.22)",
    headlightTrail: true,
  },
  {
    id: "c-storm", name: "Night Storm", tagline: "Heavy rain",
    swatch: ["#60a5fa", "#0b1120", "#94a3b8"],
    sky: [[0, "#03060e"], [0.5, "#0a1425"], [0.82, "#16304d"], [1, "#2b5478"]],
    celestial: "none", celestialColors: ["#cbd5e1", "#94a3b8"],
    celestialGlow: "rgba(120,160,200,0.25)", stars: 8,
    ground: ["#0c1624", "#050a12"], road: "#111926",
    edges: ["#e2e8f0", "#60a5fa"], dash: "rgba(226,232,240,0.85)",
    horizon: "rgba(96,165,250,0.5)", arrow: "rgba(248,113,113,0.4)",
    props: ["skyscraper", "streetlight", "building", "neon", "skyscraper", "watertower"],
    propTint: "#172033", weather: "rain", weatherColor: "rgba(190,220,255,0.6)",
    vignette: "rgba(1,4,12,0.68)", accent: "#60a5fa", accentSoft: "rgba(96,165,250,0.2)",
    headlightTrail: true,
  },
  {
    id: "c-neon", name: "Neon Midnight", tagline: "Electric deep night",
    swatch: ["#22d3ee", "#1e1b4b", "#f472b6"],
    sky: [[0, "#05031a"], [0.48, "#160f45"], [0.8, "#3b1a6b"], [1, "#6d28d9"]],
    celestial: "moon", celestialColors: ["#e9d5ff", "#a78bfa"],
    celestialGlow: "rgba(167,139,250,0.4)", stars: 52,
    ground: ["#140c33", "#07041a"], road: "#17122e",
    edges: ["#22d3ee", "#f472b6"], dash: "rgba(226,232,255,0.82)",
    horizon: "rgba(34,211,238,0.6)", arrow: "rgba(255,70,120,0.48)",
    props: ["neon", "skyscraper", "neon", "billboard", "streetlight", "building"],
    propTint: "#241a4d", weather: "none", weatherColor: "#ffffff",
    vignette: "rgba(3,1,14,0.62)", accent: "#22d3ee", accentSoft: "rgba(34,211,238,0.22)",
    headlightTrail: true,
  },
  {
    id: "c-dawn", name: "Golden Dawn", tagline: "First light",
    swatch: ["#fcd34d", "#fb923c", "#60a5fa"],
    sky: [[0, "#243b6b"], [0.42, "#7b5fa0"], [0.72, "#e9865f"], [1, "#ffd79a"]],
    celestial: "sun", celestialColors: ["#fffbe6", "#fbbf24"],
    celestialGlow: "rgba(255,210,130,0.5)", stars: 6,
    ground: ["#6d5a53", "#3b2d2a"], road: "#4a4049",
    edges: ["#fde68a", "#fb7185"], dash: "rgba(255,250,235,0.88)",
    horizon: "rgba(255,215,154,0.72)", arrow: "rgba(200,60,60,0.44)",
    props: ["palm", "billboard", "streetlight", "building", "windmill", "palm"],
    propTint: "#5b4660", weather: "none", weatherColor: "#ffffff",
    vignette: "rgba(40,22,30,0.46)", accent: "#fbbf24", accentSoft: "rgba(251,191,36,0.22)",
    headlightTrail: false,
  },
];

export const getTheme = (id: string) =>
  THEMES.find((t) => t.id === id) ?? CYCLE.find((t) => t.id === id) ?? THEMES[0];

/** Linear blend between two themes; discrete fields swap at the midpoint. */
export function blendThemes(a: Theme, b: Theme, t: number): Theme {
  const k = Math.max(0, Math.min(1, t));
  const late = k >= 0.5;
  const sky = a.sky.map(([off, col], i) => {
    const other = b.sky[Math.min(i, b.sky.length - 1)];
    return [off, mixColor(col, other[1], k)] as [number, string];
  });
  return {
    ...(late ? b : a),
    id: `${a.id}>${b.id}`,
    name: late ? b.name : a.name,
    sky,
    celestialColors: [
      mixColor(a.celestialColors[0], b.celestialColors[0], k),
      mixColor(a.celestialColors[1], b.celestialColors[1], k),
    ],
    celestialGlow: mixColor(a.celestialGlow, b.celestialGlow, k),
    stars: Math.round(a.stars + (b.stars - a.stars) * k),
    ground: [mixColor(a.ground[0], b.ground[0], k), mixColor(a.ground[1], b.ground[1], k)],
    road: mixColor(a.road, b.road, k),
    edges: [mixColor(a.edges[0], b.edges[0], k), mixColor(a.edges[1], b.edges[1], k)],
    dash: mixColor(a.dash, b.dash, k),
    horizon: mixColor(a.horizon, b.horizon, k),
    arrow: mixColor(a.arrow, b.arrow, k),
    propTint: mixColor(a.propTint, b.propTint, k),
    weatherColor: mixColor(a.weatherColor, b.weatherColor, k),
    vignette: mixColor(a.vignette, b.vignette, k),
    accent: mixColor(a.accent, b.accent, k),
    accentSoft: mixColor(a.accentSoft, b.accentSoft, k),
  };
}

/* ---------------- custom palette generator ---------------- */

export interface CustomTheme {
  name: string;
  skyTop: string;
  skyBottom: string;
  road: string;
  edgeA: string;
  edgeB: string;
  ground: string;
  weather: Weather;
  props: PropKind[];
}

export const DEFAULT_CUSTOM: CustomTheme = {
  name: "My Highway",
  skyTop: "#140a2e",
  skyBottom: "#ff5e62",
  road: "#231836",
  edgeA: "#ffb703",
  edgeB: "#ff4da6",
  ground: "#2a1245",
  weather: "none",
  props: ["palm", "building", "streetlight", "billboard", "neon", "skyscraper"],
};

export function customToTheme(c: CustomTheme): Theme {
  const mid = mixColor(c.skyTop, c.skyBottom, 0.55);
  return {
    id: "custom",
    name: c.name || "Custom",
    tagline: "Your palette",
    swatch: [c.edgeB, c.skyBottom, c.edgeA],
    sky: [
      [0, c.skyTop],
      [0.45, mixColor(c.skyTop, c.skyBottom, 0.3)],
      [0.78, mid],
      [1, c.skyBottom],
    ],
    celestial: "retro-sun",
    celestialColors: [c.edgeA, c.edgeB],
    celestialGlow: mixColor(c.skyBottom, "#ffffff", 0.2),
    stars: 24,
    ground: [c.ground, shade(c.ground, -0.45)],
    road: c.road,
    edges: [c.edgeA, c.edgeB],
    dash: "rgba(255,255,255,0.78)",
    horizon: mixColor(c.edgeB, "#ffffff", 0.2),
    arrow: "rgba(255,70,70,0.5)",
    props: c.props.length ? c.props : DEFAULT_CUSTOM.props,
    propTint: shade(c.ground, -0.2),
    weather: c.weather,
    weatherColor: mixColor(c.edgeA, "#ffffff", 0.4),
    vignette: shade(c.skyTop, -0.55),
    accent: c.edgeB,
    accentSoft: mixColor(c.edgeB, "rgba(0,0,0,0)", 0.75),
    headlightTrail: true,
  };
}

/** Compact URL-sharable encoding of a custom palette. */
export function encodeCustom(c: CustomTheme): string {
  const raw = JSON.stringify([
    c.name, c.skyTop, c.skyBottom, c.road, c.edgeA, c.edgeB, c.ground, c.weather,
  ]);
  return utf8ToB64url(raw);
}

const WEATHERS: readonly Weather[] = ["none", "rain", "snow", "petals", "sand", "fireflies", "ash"];

/**
 * Decode a palette share code. Share codes are untrusted input: the payload
 * must be an 8-element array of non-empty strings (name capped) and the
 * weather must be a known value — anything else falls back to defaults
 * instead of producing undefined colours that would crash rendering.
 */
export function decodeCustom(s: string): CustomTheme | null {
  if (!s || s.length > 2048) return null;
  const raw = b64urlToUtf8(s);
  if (!raw) return null;
  try {
    const a = JSON.parse(raw) as unknown[];
    if (!Array.isArray(a) || a.length < 8) return null;
    const str = (v: unknown, fallback: string, max = 48) =>
      typeof v === "string" && v.length ? v.slice(0, max) : fallback;
    const weather = WEATHERS.includes(a[7] as Weather)
      ? (a[7] as Weather)
      : DEFAULT_CUSTOM.weather;
    return {
      name: str(a[0], DEFAULT_CUSTOM.name, 40),
      skyTop: str(a[1], DEFAULT_CUSTOM.skyTop, 32),
      skyBottom: str(a[2], DEFAULT_CUSTOM.skyBottom, 32),
      road: str(a[3], DEFAULT_CUSTOM.road, 32),
      edgeA: str(a[4], DEFAULT_CUSTOM.edgeA, 32),
      edgeB: str(a[5], DEFAULT_CUSTOM.edgeB, 32),
      ground: str(a[6], DEFAULT_CUSTOM.ground, 32),
      weather,
      props: [...DEFAULT_CUSTOM.props],
    };
  } catch {
    return null;
  }
}
