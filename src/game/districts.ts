/* ================================================================
   District Map & Story Delivery Campaign
   An interactive map of the courier city: Downtown, Industrial
   Docks, Neon Strip and Mountain Pass. Contracts live on nodes;
   completing them unlocks connected districts, shortcut paths and
   the courier headquarters.
   Maps onto the existing 12 fixed-seed CAREER contracts.
   ================================================================ */

export interface DistrictNode {
  /** maps to a CAREER contract id */
  contractId: number;
  /** node label */
  name: string;
  /** x/y in map space, 0..1 */
  x: number;
  y: number;
}

export interface DistrictDef {
  id: string;
  name: string;
  blurb: string;
  accent: string;
  /** contract nodes inside this district */
  nodes: DistrictNode[];
  /** districts that must be (partially) finished before this opens */
  requires: string[];
  /** requires stars across the whole map */
  requireStars: number;
}

export const DISTRICTS: DistrictDef[] = [
  {
    id: "downtown",
    name: "Downtown",
    blurb: "Where every courier starts: pizza runs, glass cargo and the first taste of rush hour.",
    accent: "#38bdf8",
    nodes: [
      { contractId: 1, name: "First Shift", x: 0.18, y: 0.62 },
      { contractId: 2, name: "Hot & Fresh", x: 0.32, y: 0.42 },
      { contractId: 3, name: "Glass Cargo", x: 0.24, y: 0.22 },
    ],
    requires: [],
    requireStars: 0,
  },
  {
    id: "docks",
    name: "Industrial Docks",
    blurb: "Container mazes and roadworks. The crews bet on who can keep a fragile load whole.",
    accent: "#fb923c",
    nodes: [
      { contractId: 4, name: "Rain Run", x: 0.5, y: 0.78 },
      { contractId: 6, name: "Rush Hour", x: 0.62, y: 0.55 },
      { contractId: 9, name: "Roadworks", x: 0.56, y: 0.3 },
    ],
    requires: ["downtown"],
    requireStars: 3,
  },
  {
    id: "neon",
    name: "Neon Strip",
    blurb: "The night district. Delivery windows tighten and the traffic never sleeps.",
    accent: "#e879f9",
    nodes: [
      { contractId: 5, name: "Desert Drop", x: 0.74, y: 0.24 },
      { contractId: 8, name: "Night Express", x: 0.85, y: 0.5 },
      { contractId: 11, name: "Fragile Gold", x: 0.72, y: 0.76 },
    ],
    requires: ["downtown"],
    requireStars: 5,
  },
  {
    id: "mountain",
    name: "Mountain Pass",
    blurb: "The old smugglers' road above the city. Monsoon, black ice, and the Last Delivery.",
    accent: "#4ade80",
    nodes: [
      { contractId: 7, name: "Black Ice", x: 0.36, y: 0.12 },
      { contractId: 10, name: "Monsoon", x: 0.6, y: 0.08 },
      { contractId: 12, name: "Last Delivery", x: 0.88, y: 0.1 },
    ],
    requires: ["docks", "neon"],
    requireStars: 12,
  },
  {
    id: "harbor",
    name: "Harbor Finale",
    blurb: "The end of the map. A cargo zeppelin owns this airspace — finish the story under its searchlights.",
    accent: "#f472b6",
    nodes: [
      { contractId: 13, name: "First Light", x: 0.16, y: 0.86 },
      { contractId: 14, name: "Container Storm", x: 0.5, y: 0.66 },
      { contractId: 15, name: "The Last Harbor", x: 0.84, y: 0.84 },
    ],
    requires: ["mountain"],
    requireStars: 20,
  },
];

/** Extra shortcut contracts that open at high star counts (visual + payout). */
export const SHORTCUTS: { id: string; name: string; from: string; to: string; requireStars: number; bonus: number }[] = [
  { id: "sc-1", name: "Back Alley Cut", from: "downtown", to: "neon", requireStars: 8, bonus: 300 },
  { id: "sc-2", name: "Dockside Weave", from: "downtown", to: "docks", requireStars: 4, bonus: 200 },
  { id: "sc-3", name: "Ridge Trail", from: "neon", to: "mountain", requireStars: 16, bonus: 500 },
  { id: "sc-4", name: "Pier Overpass", from: "mountain", to: "harbor", requireStars: 24, bonus: 750 },
];

export const HQ_CONTRACT = { requireStars: 24, name: "Courier HQ", blurb: "Every contract starred. The city is yours — the HQ rooftop key is waiting." };

export interface DistrictProgress {
  /** stars per contract id */
  stars: Record<string, number>;
}

/** Whether a district is currently unlocked given the star record. */
export function districtUnlocked(d: DistrictDef, stars: Record<string, number>): boolean {
  const total = totalStars(stars);
  if (total < d.requireStars) return false;
  for (const req of d.requires) {
    const rd = DISTRICTS.find((x) => x.id === req);
    if (!rd) continue;
    // need at least one contract cleared in each prerequisite district
    const anyDone = rd.nodes.some((n) => (stars[String(n.contractId)] ?? 0) > 0);
    if (!anyDone) return false;
  }
  return true;
}

export function totalStars(stars: Record<string, number>): number {
  return Object.values(stars).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
}

export function shortcutUnlocked(s: (typeof SHORTCUTS)[number], stars: Record<string, number>): boolean {
  return totalStars(stars) >= s.requireStars;
}

export function hqUnlocked(stars: Record<string, number>): boolean {
  return totalStars(stars) >= HQ_CONTRACT.requireStars;
}
