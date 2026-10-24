/* ================================================================
   Distinct Rival Personalities
   Courier rivals get recognizable behaviour archetypes:
   the Shortcut Junkie, the Careful Veteran and the Slipstream
   Shark. Each has a name, riding colours and AI parameters that
   change how they weave, when they take risks and how they draft.
   ================================================================ */

export type RivalPersonality = "risky" | "careful" | "drafter";

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
];

export function personaById(id: string | undefined): RivalPersona {
  return RIVAL_PERSONAS.find((p) => p.id === id) ?? RIVAL_PERSONAS[0];
}

/** Deterministic persona pick from a seed. */
export function pickPersona(rand: () => number): RivalPersona {
  return RIVAL_PERSONAS[Math.floor(rand() * RIVAL_PERSONAS.length)];
}

/* ---------------- duel sprint personalities ---------------- */

export interface DuelRivalBrain {
  /** target lane bias: -1..1 where the AI likes to sit */
  bias: number;
  /** 0..1 how likely to hop early for jumpable cars */
  jumper: number;
  /** 0..1 how likely to dodge a full lane early for trucks */
  truckDodge: number;
}

export function duelBrainFor(persona: RivalPersona): DuelRivalBrain {
  switch (persona.id) {
    case "risky":
      return { bias: 0, jumper: 0.35, truckDodge: 0.55 }; // lives dangerously, late hops
    case "careful":
      return { bias: 0, jumper: 0.9, truckDodge: 0.95 }; // everything, early
    case "drafter":
      return { bias: 0, jumper: 0.65, truckDodge: 0.8 };
  }
}
