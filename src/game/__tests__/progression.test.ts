import { describe, expect, it } from "vitest";
import {
  EMPTY_PROFILE, applyRun, levelFromXp, xpForLevel, careerStarsFor, median, hotStreakBonus,
  exportProfile, importProfile, deathHeatmap, filterBoard, leaderboardKey, CHAINS,
  pityGuaranteed, nextPity, CRATE_PITY_MAX, sanitizeProfile, type Profile,
} from "../progression";
import { makeRun } from "./helpers";

const fresh = (): Profile => structuredClone(EMPTY_PROFILE);

describe("applyRun", () => {
  it("does not mutate the input profile", () => {
    const p = fresh();
    const snapshot = JSON.stringify(p);
    applyRun(p, makeRun(), null);
    expect(JSON.stringify(p)).toBe(snapshot);
  });

  it("banks coins, counts the run and grants XP", () => {
    const { profile } = applyRun(fresh(), makeRun({ coins: 80, distance: 1000 }), null);
    expect(profile.runs).toBe(1);
    expect(profile.wallet).toBeGreaterThanOrEqual(80);
    expect(profile.lifetimeCoins).toBe(80);
    expect(profile.xp).toBeGreaterThan(0);
  });

  it("keeps leaderboards sorted and capped at 5 per world", () => {
    let p = fresh();
    for (let i = 0; i < 8; i++) p = applyRun(p, makeRun({ score: i * 100 }), null).profile;
    const board = p.scores[leaderboardKey("classic", "normal")];
    expect(board.length).toBe(5);
    expect(board.map((e) => e.score)).toEqual([700, 600, 500, 400, 300]);
  });

  it("caps rescue tickets at 3", () => {
    let p = { ...fresh(), rescueTickets: 3 };
    for (let i = 0; i < 10; i++) p = applyRun(p, makeRun({ bossWins: 1 }), null).profile;
    expect(p.rescueTickets).toBe(3);
  });

  it("grows the hot streak only when beating the previous run", () => {
    let p = applyRun(fresh(), makeRun({ score: 1000 }), null).profile;
    p = applyRun(p, makeRun({ score: 1200 }), null).profile;
    p = applyRun(p, makeRun({ score: 1500 }), null).profile;
    expect(p.hotStreak).toBe(2);
    p = applyRun(p, makeRun({ score: 300 }), null).profile;
    expect(p.hotStreak).toBe(0);
  });

  it("pays an achievement-chain tier exactly once", () => {
    const near = CHAINS.find((c) => c.id === "nearMisses")!;
    const a = applyRun(fresh(), makeRun({ nearMisses: near.tiers[0] }), null);
    expect(a.chainUnlocks.length).toBe(1);
    const b = applyRun(a.profile, makeRun({ nearMisses: 1 }), null);
    expect(b.chainUnlocks.length).toBe(0);
    expect(b.profile.chainTiers.nearMisses).toBe(1);
  });

  it("records only the first five runs for first-run instrumentation", () => {
    let p = fresh();
    for (let i = 0; i < 7; i++) p = applyRun(p, makeRun({ distance: 100 + i }), null).profile;
    expect(p.firstRuns).toEqual([100, 101, 102, 103, 104]);
  });

  it("tracks per-bike mastery XP separately", () => {
    let p = applyRun(fresh(), makeRun({ bikeId: "volt", distance: 1000 }), null).profile;
    p = applyRun(p, makeRun({ bikeId: "racer", distance: 200 }), null).profile;
    expect(p.bikeXp.volt).toBeGreaterThan(p.bikeXp.racer);
  });

  it("counts weekly attempts and resets them for a new week", () => {
    let p = applyRun(fresh(), makeRun({ mode: "weekly", weekKey: "2026-W01", score: 500 }), null).profile;
    p = applyRun(p, makeRun({ mode: "weekly", weekKey: "2026-W01", score: 900 }), null).profile;
    expect(p.weekly).toEqual({ key: "2026-W01", used: 2, best: 900 });
    p = applyRun(p, makeRun({ mode: "weekly", weekKey: "2026-W02", score: 100 }), null).profile;
    expect(p.weekly.used).toBe(1);
  });
});

describe("levels", () => {
  it("is monotonic and leaves a remainder below the next requirement", () => {
    let last = 0;
    for (let xp = 0; xp < 50000; xp += 750) {
      const l = levelFromXp(xp);
      expect(l.level).toBeGreaterThanOrEqual(last);
      expect(l.into).toBeLessThan(l.need);
      last = l.level;
    }
    expect(levelFromXp(xpForLevel(1)).level).toBe(2);
  });
});

describe("career stars", () => {
  const c = { timeLimit: 90, minQuality: 70 };
  it("fails when the package is not delivered", () => {
    expect(careerStarsFor({ banner: "Wiped out", duration: 50, deliveryQuality: 100 }, c)).toBe(0);
  });
  it("gives 1 star when delivered but objective missed", () => {
    expect(careerStarsFor({ banner: "DELIVERY COMPLETE", duration: 120, deliveryQuality: 100 }, c)).toBe(1);
  });
  it("gives 2 stars for meeting the objective and 3 for beating it comfortably", () => {
    expect(careerStarsFor({ banner: "DELIVERY COMPLETE", duration: 88, deliveryQuality: 75 }, c)).toBe(2);
    expect(careerStarsFor({ banner: "DELIVERY COMPLETE", duration: 60, deliveryQuality: 95 }, c)).toBe(3);
  });
});

describe("crate pity counter", () => {
  it("climbs until guaranteed, then resets", () => {
    let pity = 0;
    for (let i = 0; i < CRATE_PITY_MAX - 1; i++) {
      expect(pityGuaranteed(pity)).toBe(false);
      pity = nextPity(pity, false);
    }
    expect(pityGuaranteed(pity)).toBe(true);
    expect(nextPity(pity, false)).toBe(0);
  });
  it("resets early on a natural legendary", () => {
    expect(nextPity(2, true)).toBe(0);
  });
});

describe("helpers", () => {
  it("median handles odd, even and empty lists", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(3);
    expect(median([])).toBe(0);
  });
  it("hot streak bonus is capped at 40%", () => {
    expect(hotStreakBonus(3)).toBeCloseTo(0.12);
    expect(hotStreakBonus(50)).toBe(0.4);
  });
  it("export/import round-trips a profile", () => {
    const p = { ...fresh(), wallet: 4321, owned: [...EMPTY_PROFILE.owned, "volt"] };
    const back = importProfile(exportProfile(p))!;
    expect(back.wallet).toBe(4321);
    expect(back.owned).toContain("volt");
  });
  it("rejects garbage import codes", () => {
    expect(importProfile("not-a-code")).toBeNull();
  });
  it("rejects unknown schema versions instead of mis-importing", () => {
    const p = fresh();
    const code = btoa(JSON.stringify({ v: 99, p }));
    expect(importProfile(code)).toBeNull();
  });
  it("sanitizes hostile or corrupted profiles into a safe shape", () => {
    // JSON.parse-style payload: "__proto__" arrives as an OWN property, like a real attack
    const missionProgress = JSON.parse('{"__proto__": {"polluted": 1}, "legit": 3, "bad": "x"}');
    const hostile = {
      wallet: "99999",                       // wrong type -> 0
      owned: "everything",                   // wrong type -> []
      scores: null,                          // null -> {}
      runHistory: [{ score: "x" }, 5, null], // junk items dropped, cap 10
      missionProgress,
      ghost: [{ t: 0, x: 0, h: 0 }, "junk"],
      rescueTickets: 99,                     // clamped to 3
      plateText: "X".repeat(500),            // capped
    };
    const p = sanitizeProfile(hostile);
    expect(p.wallet).toBe(0);
    expect(Array.isArray(p.owned)).toBe(true);
    expect(p.owned).toContain("neon"); // starter items always present
    expect(p.scores).toEqual({});
    expect(p.runHistory).toEqual([]);
    expect(p.missionProgress).toEqual({ legit: 3 });
    expect(Object.keys(p.missionProgress)).not.toContain("__proto__");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined(); // no prototype pollution
    expect(p.ghost).toBeNull();
    expect(p.rescueTickets).toBe(3);
    expect(p.plateText).toHaveLength(16);
    // ...and it still supports a real applyRun without crashing
    expect(() => applyRun(p, makeRun(), null)).not.toThrow();
  });
  it("builds a lane × cause death heatmap, ignoring timeouts", () => {
    const grid = deathHeatmap([
      { score: 1, distance: 1, coins: 0, killer: "Bus", killerLane: 1, mode: "classic", themeId: "x", date: "" },
      { score: 1, distance: 1, coins: 0, killer: "Bus", killerLane: 1, mode: "classic", themeId: "x", date: "" },
      { score: 1, distance: 1, coins: 0, killer: "Time Up", killerLane: 0, mode: "timetrial", themeId: "x", date: "" },
    ]);
    expect(grid).toEqual({ "1|Bus": 2 });
  });
  it("filters boards by world id", () => {
    const e = (themeId: string, score: number) => ({ score, coins: 0, distance: 0, theme: themeId, themeId, mode: "classic", difficulty: "normal", date: "" });
    expect(filterBoard([e("city", 5), e("desert", 4)], "city").map((x) => x.score)).toEqual([5]);
  });
});
