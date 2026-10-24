import type { Rand } from "../rng";

export interface RivalPersonaParams {
  /** seconds between lane-change decisions */
  moodMin: number;
  moodMax: number;
  /** 0..1 how often the rival cuts toward the player's lane */
  laneChase: number;
  /** relative cruise speed multiplier */
  speedBias: number;
}

export interface RivalCourierState {
  lane: number;
  targetLane: number;
  distance: number;
  checkpoint: number;
  mood: number;
  name: string;
  active: boolean;
  playerWins: number;
  rivalWins: number;
  /** distinct personality parameters (kept optional so tests stay light) */
  persona?: RivalPersonaParams;
  /** shown on the road, e.g. "JET · SHORTCUT JUNKIE" */
  tagline?: string;
}

export interface ForkState {
  active: boolean;
  z: number;
  richLane: number;
  safeLane: number;
  resolved: boolean;
  nextAt: number;
}

export function createRival(rand: Rand): RivalCourierState {
  const names = ["NOVA", "KAI", "JET", "MICA", "ROOK"];
  return {
    lane: rand() < 0.5 ? -1 : 1,
    targetLane: 0,
    distance: 18,
    checkpoint: 500,
    mood: rand() * 10,
    name: names[Math.floor(rand() * names.length)],
    active: true,
    playerWins: 0,
    rivalWins: 0,
  };
}

export function updateRival(
  rival: RivalCourierState,
  dt: number,
  playerDistance: number,
  speed: number,
  rand: Rand,
  playerLane = 0,
) {
  if (!rival.active) return null;
  const moodMin = rival.persona?.moodMin ?? 1.2;
  const moodMax = rival.persona?.moodMax ?? 3.2;
  const laneChase = rival.persona?.laneChase ?? 0;
  const speedBias = rival.persona?.speedBias ?? 1;
  rival.mood -= dt;
  if (rival.mood <= 0) {
    rival.mood = moodMin + rand() * (moodMax - moodMin);
    // personalities either hunt the player's lane or pick freely
    rival.targetLane = rand() < laneChase
      ? Math.max(-1, Math.min(1, playerLane + (rand() < 0.5 ? 0 : rand() < 0.5 ? -1 : 1)))
      : Math.floor(rand() * 3) - 1;
  }
  rival.lane += (rival.targetLane - rival.lane) * Math.min(1, dt * 2.8);
  // Rival cruises just ahead; player can reel them in with speed/nitro.
  rival.distance += ((14.5 / speedBias) - speed) * dt * 0.18;
  rival.distance = Math.max(4, Math.min(34, rival.distance));
  if (playerDistance >= rival.checkpoint) {
    const won = rival.distance <= 8;
    if (won) rival.playerWins++;
    else rival.rivalWins++;
    rival.checkpoint += 500;
    rival.distance = 15 + rand() * 8;
    return { won, checkpoint: rival.checkpoint - 500 };
  }
  return null;
}

export function createFork(nextAt = 700): ForkState {
  return { active: false, z: 70, richLane: -1, safeLane: 1, resolved: false, nextAt };
}

export function maybeStartFork(fork: ForkState, distance: number, rand: Rand) {
  if (!fork.active && distance >= fork.nextAt) {
    fork.active = true;
    fork.z = 70;
    fork.richLane = rand() < 0.5 ? -1 : 1;
    fork.safeLane = -fork.richLane;
    fork.resolved = false;
    fork.nextAt = distance + 800 + rand() * 500;
    return true;
  }
  return false;
}

export function updateFork(fork: ForkState, dt: number, speed: number, playerLane: number) {
  if (!fork.active) return null;
  fork.z -= speed * dt;
  if (!fork.resolved && fork.z <= 1) {
    fork.resolved = true;
    const rich = Math.abs(playerLane - fork.richLane) < 0.62;
    return { rich, lane: rich ? fork.richLane : fork.safeLane };
  }
  if (fork.z < -12) fork.active = false;
  return null;
}

export function policeSchedule(time: number, nextPoliceAt: number) {
  return time >= nextPoliceAt;
}

export function tunnelSchedule(distance: number, nextTunnel: number) {
  return distance >= nextTunnel;
}

export function mirrorSchedule(mode: string, difficulty: string, time: number, previousTime: number) {
  return mode !== "zen" && mode !== "practice" && difficulty === "insane" &&
    time > 55 && Math.floor(time / 55) !== Math.floor(previousTime / 55);
}