/* Pure collision/scoring helpers shared by the main engine and Duel. */

export interface LaneBody {
  lane: number;
  z: number;
  halfWidth?: number;
}

export function laneOverlap(a: number, b: number, threshold = 0.62) {
  return Math.abs(a - b) < threshold;
}

export function crossesPlayerPlane(previousZ: number, nextZ: number, plane = 0.4) {
  return previousZ > plane && nextZ <= plane;
}

export function vehicleHit(
  playerLane: number,
  playerHeight: number,
  body: LaneBody,
  clearHeight: number,
  zFront = 1.7,
  zBack = -1.2,
) {
  const lateral = (body.halfWidth ?? 0.62);
  return body.z < zFront && body.z > zBack && laneOverlap(playerLane, body.lane, lateral) && playerHeight < clearHeight;
}

export function hazardHit(playerLane: number, playerHeight: number, hazard: LaneBody, clearHeight: number) {
  return hazard.z < 1.3 && hazard.z > -0.8 && laneOverlap(playerLane, hazard.lane, hazard.halfWidth ?? 0.62) && playerHeight < clearHeight;
}

export type NearMissGrade = "CLOSE" | "RAZOR" | "IMPOSSIBLE";

export function nearMissGrade(dx: number): NearMissGrade {
  return dx < 0.42 ? "IMPOSSIBLE" : dx < 0.68 ? "RAZOR" : "CLOSE";
}

export function isPerfectDodge(now: number, lastActionAt: number, dx: number, actionSucceeded: boolean) {
  return now - lastActionAt <= 0.42 && dx < 1.05 && actionSucceeded;
}

export function clampLane(lane: number) {
  return Math.max(-1, Math.min(1, lane));
}