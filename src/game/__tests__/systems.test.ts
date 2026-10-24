import { describe, expect, it } from "vitest";
import { mulberry32 } from "../rng";
import { chooseWave, createSpawnCar, pickCarSpec } from "../systems/spawning";
import {
  clampLane, crossesPlayerPlane, hazardHit, isPerfectDodge, laneOverlap,
  nearMissGrade, vehicleHit,
} from "../systems/collisions";
import {
  createFork, createRival, maybeStartFork, mirrorSchedule, policeSchedule,
  tunnelSchedule, updateFork, updateRival,
} from "../systems/events";

describe("spawning system", () => {
  it("picks deterministically and respects heavy-vehicle filtering", () => {
    const a = pickCarSpec(mulberry32(99), { allowHeavy: false, time: 999 });
    const b = pickCarSpec(mulberry32(99), { allowHeavy: false, time: 999 });
    expect(a.kind).toBe(b.kind);
    expect(["truck", "bus"]).not.toContain(a.kind);
  });

  it("always leaves exactly one free lane in a double wave", () => {
    const wave = chooseWave(mulberry32(1), 0, 1);
    expect(wave.double).toBe(true);
    expect(wave.occupied).toHaveLength(2);
    expect(wave.occupied).not.toContain(wave.freeLane);
  });

  it("creates complete traffic data", () => {
    const c = createSpawnCar(mulberry32(4), 1, { allowHeavy: true, time: 100 });
    expect(c.lane).toBe(1);
    expect(c.z).toBeGreaterThanOrEqual(70);
    expect(c.speed).toBeGreaterThan(0);
    expect(c.color).toMatch(/^#/);
  });
});

describe("collision system", () => {
  it("checks lanes and player plane crossings", () => {
    expect(laneOverlap(0, 0.5, 0.6)).toBe(true);
    expect(laneOverlap(-1, 1, 0.6)).toBe(false);
    expect(crossesPlayerPlane(1, 0.2)).toBe(true);
    expect(crossesPlayerPlane(0.2, -1)).toBe(false);
  });

  it("lets a sufficiently high jump clear a car", () => {
    const body = { lane: 0, z: 0.5, halfWidth: 0.7 };
    expect(vehicleHit(0, 0.1, body, 0.32)).toBe(true);
    expect(vehicleHit(0, 0.5, body, 0.32)).toBe(false);
  });

  it("handles hazards and dodge grades", () => {
    expect(hazardHit(0, 0, { lane: 0, z: 0.2 }, 0.2)).toBe(true);
    expect(hazardHit(0, 0.4, { lane: 0, z: 0.2 }, 0.2)).toBe(false);
    expect(nearMissGrade(0.3)).toBe("IMPOSSIBLE");
    expect(nearMissGrade(0.55)).toBe("RAZOR");
    expect(nearMissGrade(0.8)).toBe("CLOSE");
  });

  it("checks perfect-dodge timing and clamps lanes", () => {
    expect(isPerfectDodge(5, 4.7, 0.6, true)).toBe(true);
    expect(isPerfectDodge(5, 4, 0.6, true)).toBe(false);
    expect(clampLane(4)).toBe(1);
    expect(clampLane(-4)).toBe(-1);
  });
});

describe("events system", () => {
  it("starts and resolves seeded road forks", () => {
    const rand = mulberry32(11);
    const fork = createFork(100);
    expect(maybeStartFork(fork, 99, rand)).toBe(false);
    expect(maybeStartFork(fork, 100, rand)).toBe(true);
    let result = null;
    for (let i = 0; i < 100 && !result; i++) result = updateFork(fork, 0.05, 30, fork.richLane);
    expect(result).toEqual({ rich: true, lane: fork.richLane });
  });

  it("moves the rival and scores checkpoints", () => {
    const rand = mulberry32(22);
    const rival = createRival(rand);
    const before = rival.lane;
    rival.targetLane = before === 1 ? -1 : 1;
    updateRival(rival, 0.5, 100, 30, rand);
    expect(rival.lane).not.toBe(before);
    rival.distance = 6;
    const result = updateRival(rival, 0.1, 500, 30, rand);
    expect(result?.won).toBe(true);
    expect(rival.playerWins).toBe(1);
  });

  it("provides pure police/tunnel/mirror schedules", () => {
    expect(policeSchedule(120, 120)).toBe(true);
    expect(tunnelSchedule(900, 900)).toBe(true);
    expect(mirrorSchedule("classic", "insane", 56, 54)).toBe(true);
    expect(mirrorSchedule("zen", "insane", 56, 54)).toBe(false);
  });
});