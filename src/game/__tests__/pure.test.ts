import { describe, expect, it } from "vitest";
import { mulberry32 } from "../rng";
import { THEMES, CYCLE, blendThemes, mixColor, encodeCustom, decodeCustom, DEFAULT_CUSTOM } from "../themes";
import { encodeGhost, decodeGhost, isoWeekKey, weekSeed, weeklyModifiers, CAREER } from "../features";
import { masteryLevel, BIKE_STATS, BIKES } from "../garage";

describe("rng", () => {
  it("is deterministic for a seed and differs across seeds", () => {
    const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
    const sa = Array.from({ length: 5 }, a), sb = Array.from({ length: 5 }, b), sc = Array.from({ length: 5 }, c);
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
    expect(sa.every((v) => v >= 0 && v < 1)).toBe(true);
  });
});

describe("theme blending", () => {
  it("mixColor hits both endpoints", () => {
    expect(mixColor("#000000", "#ffffff", 0)).toBe("rgba(0,0,0,1)");
    expect(mixColor("#000000", "#ffffff", 1)).toBe("rgba(255,255,255,1)");
  });
  it("blendThemes returns each side at t=0 and t=1", () => {
    const [a, b] = [CYCLE[0], CYCLE[1]];
    expect(blendThemes(a, b, 0).road).toBe(mixColor(a.road, a.road, 0));
    expect(blendThemes(a, b, 1).name).toBe(b.name);
    expect(blendThemes(a, b, 0.25).weather).toBe(a.weather);
  });
  it("custom palettes round-trip through share codes", () => {
    const c = { ...DEFAULT_CUSTOM, name: "Test Road", skyTop: "#123456" };
    expect(decodeCustom(encodeCustom(c))).toMatchObject({ name: "Test Road", skyTop: "#123456" });
  });
  it("round-trips palettes with non-ASCII names (URL-safe base64)", () => {
    const c = { ...DEFAULT_CUSTOM, name: "Café ☕ Road" };
    const back = decodeCustom(encodeCustom(c))!;
    expect(back.name).toBe("Café ☕ Road");
    expect(encodeCustom(c)).toMatch(/^[A-Za-z0-9_-]*$/);
  });
  it("rejects malformed palette share codes instead of crashing", () => {
    // base64 of '["abc"]' — parseable JSON of the wrong shape used to white-screen the app
    expect(decodeCustom("WyJhYmMiXQ==")).toBeNull();
    expect(decodeCustom("!!!")).toBeNull();
    expect(decodeCustom("")).toBeNull();
    // wrong-typed colour fields fall back to defaults instead of undefined
    const weird = btoa(JSON.stringify(["N", 1, 2, 3, 4, 5, 6, "nope"]));
    const back = decodeCustom(weird)!;
    expect(back.skyTop).toBe(DEFAULT_CUSTOM.skyTop);
    expect(back.weather).toBe(DEFAULT_CUSTOM.weather);
  });
  it("ships the high-contrast theme", () => {
    expect(THEMES.some((t) => t.id === "contrast")).toBe(true);
  });
});

describe("ghost codes", () => {
  it("round-trips within quantisation", () => {
    const frames = Array.from({ length: 300 }, (_, i) => ({ t: i / 15, x: Math.sin(i / 20), h: Math.max(0, Math.sin(i / 7)) }));
    const back = decodeGhost(encodeGhost(frames))!;
    expect(back.length).toBeGreaterThan(90);
    for (const f of back) {
      const src = frames.reduce((best, g) => (Math.abs(g.t - f.t) < Math.abs(best.t - f.t) ? g : best));
      expect(Math.abs(src.x - f.x)).toBeLessThan(0.08);
    }
  });
  it("produces URL-safe output and rejects junk", () => {
    const code = encodeGhost([{ t: 0, x: 0, h: 0 }, { t: 2, x: 1, h: 0.5 }]);
    expect(code).toMatch(/^[A-Za-z0-9_-]*$/);
    expect(decodeGhost("!!!")).toBeNull();
  });
  it("rejects oversized ghost codes", () => {
    expect(decodeGhost("A".repeat(9000))).toBeNull();
  });
});

describe("weekly challenge", () => {
  it("computes ISO week keys correctly", () => {
    expect(isoWeekKey(new Date(2026, 0, 1))).toBe("2026-W01");
    expect(isoWeekKey(new Date(2024, 11, 30))).toBe("2025-W01");
  });
  it("picks two distinct, compatible modifiers deterministically", () => {
    for (let w = 1; w <= 52; w++) {
      const key = `2026-W${String(w).padStart(2, "0")}`;
      const m = weeklyModifiers(weekSeed(key));
      expect(m.length).toBe(2);
      expect(m[0]).not.toBe(m[1]);
      expect(m.includes("mirror") && m.includes("no-jump")).toBe(false);
      expect(weeklyModifiers(weekSeed(key))).toEqual(m);
    }
  });
});

describe("bikes & career data", () => {
  it("every bike has stats", () => {
    for (const b of BIKES) expect(BIKE_STATS[b.id]).toBeDefined();
  });
  it("mastery grows with XP and caps at 5", () => {
    expect(masteryLevel(0)).toBe(0);
    expect(masteryLevel(600)).toBe(1);
    expect(masteryLevel(10_000_000)).toBe(5);
  });
  it("has 21 contracts with unique seeds and rising distance", () => {
    expect(CAREER.length).toBe(21);
    expect(new Set(CAREER.map((c) => c.seed)).size).toBe(21);
    expect(CAREER[11].distance).toBeGreaterThan(CAREER[0].distance);
    expect(CAREER[14].distance).toBeGreaterThan(CAREER[11].distance);
    expect(CAREER[20].distance).toBeGreaterThan(CAREER[14].distance);
  });
});
