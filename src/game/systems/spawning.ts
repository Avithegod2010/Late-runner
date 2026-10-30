import { CAR_COLORS, CAR_SPECS, type CarKind, type CarSpec } from "./config";
import type { Rand } from "../rng";

export interface SpawnDifficulty {
  allowHeavy: boolean;
  time: number;
}

export interface SpawnCar {
  kind: CarKind;
  lane: number;
  z: number;
  speed: number;
  color: string;
  dark: string;
  spec: CarSpec;
}

export function pickCarSpec(rand: Rand, cfg: SpawnDifficulty) {
  const pool = CAR_SPECS.filter(
    (s) => cfg.time >= s.after && (cfg.allowHeavy || (s.kind !== "truck" && s.kind !== "bus")),
  );
  const total = pool.reduce((sum, spec) => sum + spec.weight, 0);
  let roll = rand() * total;
  for (const spec of pool) {
    roll -= spec.weight;
    if (roll <= 0) return spec;
  }
  return pool[0] ?? CAR_SPECS[0];
}

export function vehiclePalette(kind: CarKind, rand: Rand): [string, string] {
  const random = CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)];
  if (kind === "taxi") return ["#ffc107", "#b07c00"];
  if (kind === "police") return ["#edf2f7", "#1f2937"];
  if (kind === "ambulance") return ["#ffffff", "#cbd5e1"];
  if (kind === "bus") return ["#ff7043", "#b03a16"];
  if (kind === "flatbed") return ["#8d9aa8", "#4a5663"];
  if (kind === "moto") return ["#22d3ee", "#0e7490"];
  return random;
}

export function createSpawnCar(rand: Rand, lane: number, cfg: SpawnDifficulty): SpawnCar {
  const spec = pickCarSpec(rand, cfg);
  const [color, dark] = vehiclePalette(spec.kind, rand);
  return {
    kind: spec.kind,
    lane,
    z: 70 + rand() * 6,
    speed: spec.spd[0] + rand() * (spec.spd[1] - spec.spd[0]),
    color,
    dark,
    spec,
  };
}

export function chooseWave(rand: Rand, lastFree: number, doubleChance: number, lanePool = [-1, 0, 1]) {
  const lanes = [...lanePool];
  if (!lanes.length) return { freeLane: 0, occupied: [] as number[], double: false };
  const double = rand() < doubleChance;
  const candidates = double ? lanes.filter((l) => Math.abs(l - lastFree) <= 1) : lanes;
  const freeLane = candidates[Math.floor(rand() * candidates.length)];
  const blocked = lanes.filter((lane) => lane !== freeLane);
  const occupied = double
    ? blocked
    : blocked.length ? [blocked[Math.floor(rand() * blocked.length)]] : [];
  return { freeLane, occupied, double };
}