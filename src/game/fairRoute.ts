/* ================================================================
   Fair-Route Validator
   Checks upcoming traffic patterns BEFORE committing a spawn wave.
   Simulates lane reachability over a time horizon so there is always
   an escape route — even when bosses, roadworks and forks overlap.
   Pure module: no engine state, fully unit-testable.
   ================================================================ */

export interface RouteObstacle {
  /** -1 | 0 | 1 lane index */
  lane: number;
  /** seconds from now the lane first becomes deadly */
  fromT: number;
  /** seconds from now the lane is safe again */
  toT: number;
  /** max jump height that clears it (Infinity = unjumpable) */
  clearH: number;
}

export interface FairRouteOptions {
  /** lanes that exist right now (excludes closed/roadwork lanes) */
  lanes: number[];
  /** current player lane */
  startLane: number;
  /** seconds a lane change takes to be effective */
  laneChangeTime: number;
  /** how far ahead to simulate */
  horizon: number;
  /** simulation step in seconds */
  step: number;
}

/**
 * Breadth-first reachability over the lane timeline.
 * A lane is "survivable" at time t if the player can be in some lane
 * (reachable through changes) that is not deadly at t. Deadly means an
 * obstacle window covers t AND the player cannot clear it by jumping
 * (we treat jumpable obstacles as survivable because a buffered jump
 * escapes them; unjumpable ones — Infinity — must be dodged).
 */
export function hasEscapeRoute(obstacles: RouteObstacle[], opts: FairRouteOptions): boolean {
  const { lanes, startLane, laneChangeTime, horizon, step } = opts;
  if (!lanes.length) return false;
  if (!lanes.includes(startLane)) return false;

  let reachable = new Set<number>([startLane]);
  let t = 0;
  while (t < horizon) {
    t += step;
    // allow one lane hop per laneChangeTime worth of elapsed steps
    const hops = Math.max(1, Math.round(laneChangeTime / step));
    for (let h = 0; h < hops; h++) {
      const next = new Set<number>(reachable);
      for (const lane of reachable) {
        for (const adj of [lane - 1, lane + 1]) {
          if (lanes.includes(adj)) next.add(adj);
        }
      }
      reachable = next;
    }
    // which lanes are deadly RIGHT NOW
    let safeCount = 0;
    for (const lane of reachable) {
      const deadly = obstacles.some(
        (o) => o.lane === lane && t >= o.fromT && t <= o.toT && o.clearH === Number.POSITIVE_INFINITY,
      );
      if (!deadly) safeCount++;
    }
    if (safeCount === 0) return false;
    if (reachable.size === lanes.length && safeCount === reachable.size) {
      // every lane reachable and all safe — the far future can only improve
      // when obstacles are finite; verify no later window blocks everything
      const later = obstacles.filter((o) => o.fromT > t && o.clearH === Number.POSITIVE_INFINITY);
      if (!later.length) return true;
    }
  }
  return true;
}

/**
 * Arrival window (seconds until the obstacle reaches the player) for a
 * vehicle approaching at closing speed `closing` from distance `z`,
 * deadly for ±window seconds around impact.
 */
export function arrivalWindow(z: number, closing: number, window = 0.55): { fromT: number; toT: number } {
  const impact = z / Math.max(1, closing);
  return { fromT: Math.max(0, impact - window), toT: impact + window };
}

/** How many lanes to strip from a blocked wave before retrying. */
export function laneDropOrder(occupied: number[], freeLane: number): number[] {
  // drop the lane farthest from the free lane first — keeps the gap readable
  return [...occupied].sort((a, b) => Math.abs(b - freeLane) - Math.abs(a - freeLane));
}
