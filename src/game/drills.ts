/* ================================================================
   Personalized Practice Drills
   Reads the death heatmap (lane × killer frequency) and recommends
   short exercises targeting the player's real weaknesses.
   Each drill is a practice-mode preset the engine understands.
   ================================================================ */

import type { RunHistoryItem } from "./progression";

export type DrillId =
  | "moto-dodge" | "van-hops" | "truck-lanes" | "hazard-hop"
  | "ramp-timing" | "weave-master" | "spike-sprint";

export interface DrillDef {
  id: DrillId;
  name: string;
  focus: string;
  desc: string;
  /** practice-mode spawn filter */
  spec: {
    /** only these vehicle kinds spawn (empty = all) */
    cars: string[];
    /** hazard kinds allowed (empty = none) */
    hazards: string[];
    /** flatbed ramps appear on a short cycle */
    ramps: boolean;
    /** seconds between spawn waves */
    waveGap: number;
  };
  /** which heatmap killers this drill trains */
  targets: string[];
}

export const DRILLS: DrillDef[] = [
  {
    id: "moto-dodge",
    name: "Lane-Splitter Slayer",
    focus: "Dodging motorcycles",
    desc: "Motos weave without warning. Read the signal, then claim the gap they leave behind.",
    spec: { cars: ["moto", "sports"], hazards: [], ramps: false, waveGap: 1.5 },
    targets: ["Lane-Splitter", "Sports Car"],
  },
  {
    id: "van-hops",
    name: "Van Hops",
    focus: "Timing jumps over vans",
    desc: "Vans need a full arc. Launch one car-length early and land past the rear bumper.",
    spec: { cars: ["van", "taxi"], hazards: [], ramps: false, waveGap: 2.2 },
    targets: ["Delivery Van", "Taxi Cab"],
  },
  {
    id: "truck-lanes",
    name: "Heavy Traffic IQ",
    focus: "Lane changes around trucks",
    desc: "Trucks and buses never clear a jump. Drill the early lane change until it is muscle memory.",
    spec: { cars: ["truck", "bus"], hazards: [], ramps: false, waveGap: 2.6 },
    targets: ["Heavy Truck", "City Bus", "Road Train"],
  },
  {
    id: "hazard-hop",
    name: "Hazard Hop",
    focus: "Jumping road hazards",
    desc: "Potholes, cones and barriers. Small targets, tight windows — pure jump timing.",
    spec: { cars: [], hazards: ["pothole", "cone", "barrier"], ramps: false, waveGap: 2.4 },
    targets: ["Pothole", "Traffic Cone", "Road Barrier"],
  },
  {
    id: "ramp-timing",
    name: "Ramp Timing",
    focus: "Flatbed launches & air control",
    desc: "Ride the flatbed ramps, steer mid-air and stick the landing between traffic.",
    spec: { cars: ["flatbed", "sedan"], hazards: [], ramps: true, waveGap: 2.8 },
    targets: ["Sedan", "Ramp Flatbed"],
  },
  {
    id: "weave-master",
    name: "Weave Master",
    focus: "Mixed traffic at speed",
    desc: "Everything at once, slightly faster. The graduation exam for lane-reading.",
    spec: { cars: [], hazards: [], ramps: false, waveGap: 1.2 },
    targets: [],
  },
  {
    id: "spike-sprint",
    name: "Spike Sprint",
    focus: "Police chase survival",
    desc: "Spike strips rain down like the wanted level is real. Hop or drift — never freeze.",
    spec: { cars: ["police"], hazards: ["spikes"], ramps: false, waveGap: 2.0 },
    targets: ["Spike Strip", "Police Cruiser"],
  },
];

export function drillById(id: string): DrillDef | null {
  return DRILLS.find((d) => d.id === id) ?? null;
}

/** Pick the 3 drills that best match the player's crash history. */
export function recommendDrills(history: RunHistoryItem[], heatmap: Record<string, number>): DrillDef[] {
  const killerCounts: Record<string, number> = {};
  for (const [key, n] of Object.entries(heatmap)) {
    const killer = key.split("|")[1];
    killerCounts[killer] = (killerCounts[killer] ?? 0) + n;
  }
  const scored = DRILLS.map((d) => ({
    drill: d,
    score: d.targets.reduce((sum, k) => sum + (killerCounts[k] ?? 0), 0),
  }));
  scored.sort((a, b) => b.score - a.score);
  const picked = scored.slice(0, 3).map((s) => s.drill);
  // always guarantee at least one drill for brand-new players
  if (!picked.length) return [DRILLS[0], DRILLS[4], DRILLS[5]];
  // keep the general weave drill in the rotation once there is history
  if (history.length >= 5 && !picked.includes(DRILLS[5])) picked[2] = DRILLS[5];
  return picked;
}
