import { describe, expect, it } from "vitest";
import { WHEEL_STYLES, WHEEL_COLORS, wheelStyleById, sanitizeWheelColor } from "../garage";
import { makeLoadout, sanitizeLoadouts } from "../loadouts";

describe("wheel customization", () => {
  it("has unique style ids and complete metadata", () => {
    const ids = WHEEL_STYLES.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("sport");
    expect(WHEEL_STYLES.every((w) => w.name.length > 0 && w.hint.length > 0)).toBe(true);
  });

  it("falls back to the sport style for unknown ids", () => {
    expect(wheelStyleById("mag5").id).toBe("mag5");
    expect(wheelStyleById("not-a-wheel").id).toBe("sport");
    expect(wheelStyleById("").id).toBe("sport");
  });

  it("only accepts #rrggbb rim colors", () => {
    expect(sanitizeWheelColor("#22d3ee")).toBe("#22d3ee");
    expect(sanitizeWheelColor("red")).toBe(WHEEL_COLORS[0]);
    expect(sanitizeWheelColor(42)).toBe(WHEEL_COLORS[0]);
    expect(sanitizeWheelColor(null)).toBe(WHEEL_COLORS[0]);
  });

  it("ships only valid hex rim colors", () => {
    expect(WHEEL_COLORS.length).toBeGreaterThan(4);
    expect(WHEEL_COLORS.every((c) => /^#[0-9a-fA-F]{6}$/.test(c))).toBe(true);
  });
});

describe("loadouts carry wheel customization", () => {
  const base = {
    bikeId: "neon", helmetId: "comet", jacketId: "ember",
    trailId: "mist", hornId: "airhorn", companion: "none",
    wheelStyle: "neon", wheelColor: "#22d3ee",
  };

  it("saves and restores wheel fields", () => {
    const l = makeLoadout("Wheels", base);
    expect(l.wheelStyle).toBe("neon");
    expect(l.wheelColor).toBe("#22d3ee");
    const [s] = sanitizeLoadouts([l]);
    expect(s.wheelStyle).toBe("neon");
    expect(s.wheelColor).toBe("#22d3ee");
  });

  it("sanitizes hostile wheel fields back to defaults", () => {
    const [bad] = sanitizeLoadouts([
      { name: "junk", ...base, wheelStyle: "<img>", wheelColor: "javascript:alert(1)" },
    ]);
    expect(bad.wheelStyle).toBe("sport");
    expect(bad.wheelColor).toBe(WHEEL_COLORS[0]);
  });
});
