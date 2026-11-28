/* ================================================================
   Distinct Rival Personalities
   Courier rivals get recognizable behaviour archetypes:
   the Shortcut Junkie, the Careful Veteran and the Slipstream
   Shark. Each has a name, riding colours and AI parameters that
   change how they weave, when they take risks and how they draft.
   ================================================================ */

export type RivalPersonality = "risky" | "careful" | "drafter" | "blocker" | "sniper" | "turbo";

export interface RivalPersona {
  id: RivalPersonality;
  name: string;
  tagline: string;
  bio: string;
  colors: [string, string];
  /** seconds between lane-change decisions */
  moodInterval: [number, number];
  /** how aggressively they cut toward the player's lane */
  laneChase: number;
  /** relative cruise speed bias */
  speedBias: number;
  /** chance to dive into the rich lane at forks */
  richLaneLove: number;
}

export const RIVAL_PERSONAS: RivalPersona[] = [
  {
    id: "risky",
    name: "JET",
    tagline: "Shortcut Junkie",
    bio: "Cuts through gaps two lanes wide. Wins big, wrecks bigger.",
    colors: ["#ff6b6b", "#c0392b"],
    moodInterval: [0.7, 1.4],
    laneChase: 0.85,
    speedBias: 1.16,
    richLaneLove: 0.9,
  },
  {
    id: "careful",
    name: "MICA",
    tagline: "Careful Veteran",
    bio: "Never touches traffic, never misses a checkpoint. Grind her down slowly.",
    colors: ["#67e8f9", "#0e7490"],
    moodInterval: [2.0, 3.2],
    laneChase: 0.12,
    speedBias: 0.94,
    richLaneLove: 0.1,
  },
  {
    id: "drafter",
    name: "ROOK",
    tagline: "Slipstream Shark",
    bio: "Sits in your draft and pounces at the 500m boards. Break his tow.",
    colors: ["#c4b5fd", "#6d28d9"],
    moodInterval: [1.0, 1.8],
    laneChase: 0.55,
    speedBias: 1.05,
    richLaneLove: 0.45,
  },
  {
    id: "blocker",
    name: "WALL",
    tagline: "Lane Bulldozer",
    bio: "Doesn't chase you — parks in front of you. Outlast the rolling roadblock.",
    colors: ["#fdba74", "#9a3412"],
    moodInterval: [1.6, 2.6],
    laneChase: 0.95,
    speedBias: 0.9,
    richLaneLove: 0.3,
  },
  {
    id: "sniper",
    name: "VEX",
    tagline: "Late-Brake Sniper",
    bio: "Rides clean until the final 200m, then brakes late and cuts inside. Watch the finish line.",
    colors: ["#f9a8d4", "#be185d"],
    moodInterval: [1.2, 2.0],
    laneChase: 0.65,
    speedBias: 1.0,
    richLaneLove: 0.7,
  },
  {
    id: "turbo",
    name: "NILA",
    tagline: "Nitro Nomad",
    bio: "Burns boost on every straight. Catch her when the tank runs dry.",
    colors: ["#86efac", "#15803d"],
    moodInterval: [0.6, 1.1],
    laneChase: 0.4,
    speedBias: 1.2,
    richLaneLove: 0.5,
  },
];

export function personaById(id: string | undefined): RivalPersona {
  return RIVAL_PERSONAS.find((p) => p.id === id) ?? RIVAL_PERSONAS[0];
}

/** Deterministic persona pick from a seed. */
export function pickPersona(rand: () => number): RivalPersona {
  return RIVAL_PERSONAS[Math.floor(rand() * RIVAL_PERSONAS.length)];
}
