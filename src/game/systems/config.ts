/* ================================================================
   Engine tuning config: vehicle specs, difficulty tables, physics
   constants and per-mode escalation curves. Pure data, no state.
   ================================================================ */

import type { Mode } from "../engine";

export type CarKind =
  | "sedan" | "sports" | "van" | "truck" | "bus"
  | "taxi" | "police" | "ambulance" | "flatbed" | "moto";

export interface CarSpec {
  kind: CarKind;
  w: number;
  hMul: number;
  spd: [number, number];
  after: number;
  weight: number;
}

export const CAR_SPECS: CarSpec[] = [
  { kind: "sedan", w: 0.43, hMul: 0.95, spd: [11, 19], after: 0, weight: 28 },
  { kind: "sports", w: 0.41, hMul: 0.78, spd: [19, 28], after: 7, weight: 15 },
  { kind: "taxi", w: 0.44, hMul: 0.98, spd: [11, 17], after: 4, weight: 11 },
  { kind: "van", w: 0.47, hMul: 1.2, spd: [9, 14], after: 10, weight: 10 },
  { kind: "police", w: 0.44, hMul: 0.95, spd: [20, 29], after: 16, weight: 8 },
  { kind: "truck", w: 0.5, hMul: 1.45, spd: [8, 12], after: 14, weight: 9 },
  { kind: "ambulance", w: 0.48, hMul: 1.25, spd: [16, 22], after: 22, weight: 5 },
  { kind: "bus", w: 0.52, hMul: 1.75, spd: [9, 13], after: 24, weight: 6 },
  { kind: "flatbed", w: 0.5, hMul: 1.1, spd: [8, 12], after: 18, weight: 7 },
  { kind: "moto", w: 0.26, hMul: 0.8, spd: [16, 24], after: 20, weight: 7 },
];

export const CAR_COLORS: [string, string][] = [
  ["#ff4757", "#9e1f2d"], ["#2ed573", "#157a41"], ["#1e90ff", "#0f4e94"],
  ["#ffa502", "#9e6400"], ["#eccc68", "#a08427"], ["#70a1ff", "#3a5ab0"],
  ["#f1f2f6", "#8a93a8"], ["#a29bfe", "#5d53c4"], ["#ff6b81", "#a33548"],
  ["#20c997", "#0d7a5c"],
];


export const LANE_HALF = 0.72;
export const NEAR = 2.3;
export const Z_FAR = 70;
export const GRAV = 8.9;
export const JUMP_V = 3.95;
export const RAMP_V = 6.6;
export const RAIL_H = 1.5;
export const RAIL_CLEAR = 1.1;
export const POLICE_EVERY = 120;   // seconds between chases
export const POLICE_FIRST = 120;   // first chase trigger

export const DIFF = {
  chill: { cap: 32, ramp: 0.24, gap: 30, gapMin: 25, doubles: 0.14, heavy: false, hazard: 9 },
  normal: { cap: 42, ramp: 0.34, gap: 27, gapMin: 23, doubles: 0.26, heavy: true, hazard: 7.5 },
  insane: { cap: 56, ramp: 0.5, gap: 23, gapMin: 18.5, doubles: 0.42, heavy: true, hazard: 5.5 },
};

/** Explicit per-mode escalation so Cup heats & Duels ramp punchier without touching Difficulty. */
export const MODE_CURVES: Record<Mode, { rampMul: number; gapDecay: number; doubleMul: number; hazardMul: number }> = {
  classic: { rampMul: 1.0, gapDecay: 0.09, doubleMul: 1.0, hazardMul: 1.0 },
  weekly: { rampMul: 1.1, gapDecay: 0.1, doubleMul: 1.08, hazardMul: 1.08 },
  bossrush: { rampMul: 1.2, gapDecay: 0.0, doubleMul: 0.0, hazardMul: 0.6 },
  career: { rampMul: 0.95, gapDecay: 0.08, doubleMul: 0.95, hazardMul: 1.0 },
  tournament: { rampMul: 1.32, gapDecay: 0.145, doubleMul: 1.25, hazardMul: 1.22 },
  duel: { rampMul: 1.24, gapDecay: 0.125, doubleMul: 1.16, hazardMul: 1.12 },
  timetrial: { rampMul: 1.28, gapDecay: 0.13, doubleMul: 1.18, hazardMul: 1.15 },
  daily: { rampMul: 1.06, gapDecay: 0.1, doubleMul: 1.05, hazardMul: 1.05 },
  route: { rampMul: 1.0, gapDecay: 0.09, doubleMul: 1.0, hazardMul: 1.0 },
  zen: { rampMul: 0.55, gapDecay: 0.03, doubleMul: 0.35, hazardMul: 0.55 },
  practice: { rampMul: 0.3, gapDecay: 0.0, doubleMul: 0.0, hazardMul: 0.2 },
  coop: { rampMul: 0.9, gapDecay: 0.08, doubleMul: 0.95, hazardMul: 1.0 },
};

