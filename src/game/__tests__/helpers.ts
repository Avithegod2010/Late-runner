import type { RunResult } from "../progression";

/** A complete, neutral RunResult; override only what a test cares about. */
export function makeRun(over: Partial<RunResult> = {}): RunResult {
  return {
    score: 1000, coins: 50, distance: 600, nearMisses: 5, jumps: 4, carsJumped: 1,
    policeJumped: 0, stunts: 2, airCoins: 3, maxCombo: 3, topSpeed: 120, nitros: 0,
    shields: 0, magnets: 0, warps: 0, ramps: 0, tunnelDistance: 0, chases: 0,
    perfectDodges: 1, tolls: 0, stuntChain: 1, rescueUsed: 0, deliveryQuality: 100,
    bossWins: 0, sectors: [], vehicleTypes: ["sedan"], replay: [],
    mode: "classic", difficulty: "normal", themeId: "synthwave", themeName: "Neon Sunset",
    killer: "Sedan", killerLane: 0, duration: 40, bikeId: "neon", grindTime: 0, wheelieTime: 0,
    banner: "Wiped out", seed: null,
    ...over,
  };
}
