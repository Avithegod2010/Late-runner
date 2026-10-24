import { describe, expect, it } from "vitest";
import { DEFAULT_KEYMAP, KEYMAP_ACTIONS, normalizeKey, keyMatches, keyLabel, resolveKeymap } from "../keymap";
import { t, isComplete, LANGS } from "../i18n";
import { CAREER, isHarborContract, HARBOR_FIRST_CONTRACT, activeSeason, SEASONS } from "../features";
import { DISTRICTS, districtUnlocked, SHORTCUTS, shortcutUnlocked } from "../districts";
import {
  EMPTY_PROFILE, applyRun, doRebirth, prestigeMultiplier, PRESTIGE_MIN_LEVEL, PRESTIGE_MAX,
  levelFromXp, xpForLevel, sanitizeProfile, type Profile,
} from "../progression";
import { makeRun } from "./helpers";

/* ---------------- keyboard remapping ---------------- */
describe("keymap", () => {
  it("normalizes DOM keys to storage form", () => {
    expect(normalizeKey(" ")).toBe("space");
    expect(normalizeKey("A")).toBe("a");
    expect(normalizeKey("ArrowLeft")).toBe("arrowleft");
    expect(normalizeKey("Shift")).toBe("shift");
  });
  it("matches case-insensitively", () => {
    expect(keyMatches("W", "w")).toBe(true);
    expect(keyMatches("w", "W")).toBe(true);
    expect(keyMatches("a", "b")).toBe(false);
  });
  it("resolves a hostile/partial stored map over defaults", () => {
    const km = resolveKeymap({ left: "Z", jump: 42, __proto__: {}, nitro: "M" });
    expect(km.left).toBe("z");
    expect(km.jump).toBe(DEFAULT_KEYMAP.jump); // junk falls back
    expect(km.nitro).toBe("m");
    expect(km.pause).toBe(DEFAULT_KEYMAP.pause);
    expect(resolveKeymap(null)).toEqual(DEFAULT_KEYMAP);
    expect(resolveKeymap("evil")).toEqual(DEFAULT_KEYMAP);
  });
  it("labels special keys for the UI", () => {
    expect(keyLabel("space")).toBe("SPACE");
    expect(keyLabel("shift")).toBe("SHIFT");
    expect(keyLabel("arrowleft")).toBe("←");
    expect(keyLabel("q")).toBe("Q");
  });
  it("covers 13 actions and every default is a single normalized key", () => {
    expect(KEYMAP_ACTIONS.length).toBe(13);
    for (const a of KEYMAP_ACTIONS) {
      expect(DEFAULT_KEYMAP[a.id].length).toBeGreaterThan(0);
      expect(normalizeKey(DEFAULT_KEYMAP[a.id])).toBe(DEFAULT_KEYMAP[a.id]);
    }
  });
});

/* ---------------- i18n scaffold ---------------- */
describe("i18n", () => {
  it("falls back to English and never renders a raw key", () => {
    expect(t("es", "tile.play", "PLAY")).toBe("JUGAR");
    expect(t("hi", "tile.play", "PLAY")).toBe("खेलें");
    expect(t("en", "mode.classic")).toBe("Classic");
    // every key resolves to something that is not the key itself
    for (const lang of LANGS) {
      expect(t(lang.id, "tile.shop", "SHOP")).not.toBe("tile.shop");
      expect(t(lang.id, "mode.duel", "Duel")).not.toBe("mode.duel");
    }
  });
  it("ships complete dictionaries for every language", () => {
    for (const l of LANGS) expect(isComplete(l.id)).toBe(true);
  });
});

/* ---------------- Harbor Finale ---------------- */
describe("harbor finale", () => {
  it("adds 3 contracts and a fifth district", () => {
    expect(CAREER.length).toBe(15);
    expect(DISTRICTS.length).toBe(5);
    const harbor = DISTRICTS.find((d) => d.id === "harbor")!;
    expect(harbor.nodes.length).toBe(3);
    expect(harbor.requires).toContain("mountain");
  });
  it("identifies harbor contracts for the zeppelin airspace", () => {
    expect(isHarborContract(12)).toBe(false);
    expect(isHarborContract(13)).toBe(true);
    expect(isHarborContract(undefined)).toBe(false);
    expect(HARBOR_FIRST_CONTRACT).toBe(13);
  });
  it("harbor unlocks only with mountain cleared and 20 stars", () => {
    const harbor = DISTRICTS.find((d) => d.id === "harbor")!;
    const stars: Record<string, number> = {};
    for (const d of DISTRICTS) for (const n of d.nodes) stars[String(n.contractId)] = 3;
    expect(districtUnlocked(harbor, stars)).toBe(true);
    const noMountain = { ...stars };
    for (const n of DISTRICTS.find((d) => d.id === "mountain")!.nodes) noMountain[String(n.contractId)] = 0;
    expect(districtUnlocked(harbor, noMountain)).toBe(false);
    const lowStars = { ...stars };
    for (const k of Object.keys(lowStars)) lowStars[k] = 1;
    expect(districtUnlocked(harbor, lowStars)).toBe(false);
  });
  it("has a pier shortcut gated at 24 stars", () => {
    const sc = SHORTCUTS.find((s) => s.id === "sc-4")!;
    expect(shortcutUnlocked(sc, { "1": 3 })).toBe(false);
    expect(shortcutUnlocked(sc, { "1": 3, "2": 3, "3": 3, "4": 3, "5": 3, "6": 3, "7": 3, "8": 3 })).toBe(true);
  });
});

/* ---------------- seasonal events ---------------- */
describe("seasons", () => {
  it("finds the active season by month", () => {
    expect(activeSeason(10)?.id).toBe("halloween");
    expect(activeSeason(12)?.id).toBe("winter");
    expect(activeSeason(3)).toBeNull();
  });
  it("every season carries a tagline and a sane coin bonus", () => {
    for (const s of SEASONS) {
      expect(s.tagline.length).toBeGreaterThan(4);
      expect(s.coinBonus).toBeGreaterThan(0);
      expect(s.coinBonus).toBeLessThanOrEqual(0.2);
    }
  });
});

/* ---------------- Rider Rebirth (prestige) ---------------- */
function profileWithXp(xp: number, over: Partial<Profile> = {}): Profile {
  return sanitizeProfile({ ...EMPTY_PROFILE, xp, ...over });
}

describe("rider rebirth", () => {
  it("blocks below the required level and at the cap", () => {
    const low = profileWithXp(xpSum(PRESTIGE_MIN_LEVEL - 1));
    expect(doRebirth(low)).toBeNull();
    const capped = profileWithXp(1e9, { rebirths: PRESTIGE_MAX });
    expect(doRebirth(capped)).toBeNull();
  });
  it("resets level but keeps possessions, granting +5% per rebirth", () => {
    const rich = profileWithXp(1e9, {
      rebirths: 0, wallet: 4321, crates: 3, hotStreak: 4, lastRunScore: 900,
    });
    const reborn = doRebirth(rich)!;
    expect(reborn.xp).toBe(0);
    expect(reborn.rebirths).toBe(1);
    expect(reborn.wallet).toBe(4321);
    expect(reborn.crates).toBe(3);
    expect(reborn.hotStreak).toBe(0);
    expect(levelFromXp(reborn.xp).level).toBe(1);
  });
  it("prestige multiplier caps at PRESTIGE_MAX", () => {
    expect(prestigeMultiplier(0)).toBe(1);
    expect(prestigeMultiplier(1)).toBeCloseTo(1.05);
    expect(prestigeMultiplier(2)).toBeCloseTo(1.1);
    expect(prestigeMultiplier(99)).toBeCloseTo(1 + PRESTIGE_MAX * 0.05);
    expect(prestigeMultiplier(-3)).toBe(1);
  });
  it("applyRun pays prestige coin bonus and stores the multiplied score", () => {
    const p = profileWithXp(0, { rebirths: 2 }); // +10%
    const run = makeRun({ score: 1000, coins: 100 });
    const res = applyRun(p, run, null);
    expect(res.profile.lifetimeCoins).toBe(100 + 10); // base + prestige
    const key = Object.keys(res.profile.scores)[0];
    expect(res.profile.scores[key][0].score).toBe(1100);
  });
  it("applyRun counts crashes but not deliveries or zen rides", () => {
    const crash = applyRun(profileWithXp(0), makeRun({ killer: "Heavy Truck", mode: "classic" }), null).profile;
    expect(crash.lifetime.crashes).toBe(1);
    const delivered = applyRun(profileWithXp(0), makeRun({ killer: "Delivered", mode: "career" }), null).profile;
    expect(delivered.lifetime.crashes).toBe(0);
    const zen = applyRun(profileWithXp(0), makeRun({ killer: "Heavy Truck", mode: "zen" }), null).profile;
    expect(zen.lifetime.crashes).toBe(0);
  });
  it("applyRun adds the seasonal coin bonus when a season is passed", () => {
    const season = { id: "s", name: "Test", month: 1, accent: "#fff", weather: "none" as const, tagline: "test", coinBonus: 0.15 };
    const res = applyRun(profileWithXp(0), makeRun({ coins: 200 }), null, season);
    expect(res.profile.lifetimeCoins).toBe(200 + 30);
    const off = applyRun(profileWithXp(0), makeRun({ coins: 200 }), null);
    expect(off.profile.lifetimeCoins).toBe(200);
  });
  it("sanitizeProfile survives the new fields from hostile saves", () => {
    // strict: non-numeric junk falls back, real numbers clamp in
    const p = sanitizeProfile({ ...EMPTY_PROFILE, rebirths: "9", lifetime: { crashes: "x", distance: 12 } });
    expect(p.rebirths).toBe(0);
    expect(p.lifetime.crashes).toBe(0);
    expect(p.lifetime.distance).toBe(12);
    const good = sanitizeProfile({ ...EMPTY_PROFILE, rebirths: 9 });
    expect(good.rebirths).toBe(9);
  });
});

/* ---- local helpers ---- */
/** Total xp needed to *reach* a level (sum of each level's requirement). */
function xpSum(level: number) {
  let sum = 0;
  for (let l = 1; l < level; l++) sum += xpForLevel(l);
  return sum;
}
