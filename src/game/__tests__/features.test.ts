import { describe, it, expect } from "vitest";
import { analyzeCrash, finishPraise } from "../coach";
import { DRILLS, drillById, recommendDrills } from "../drills";
import { todayBounties, freshBountyState, sanitizeBountyState, bountyReward, GOLDEN_KEY_REWARD } from "../bounties";
import { detectHighlights } from "../highlights";
import { sanitizeTrack, encodeTrack, decodeTrack, TRACK_MAX_ITEMS } from "../trackcode";
import { makeLoadout, sanitizeLoadouts, MAX_LOADOUTS } from "../loadouts";
import { SOUND_PACKS, packById } from "../soundpacks";
import { DISTRICTS, districtUnlocked, totalStars, shortcutUnlocked, hqUnlocked } from "../districts";
import { GADGETS, sanitizeGadgets, gadgetById } from "../gadgets";
import { COLLECTIBLES, collectiblesForWorld, sanitizeCollections, COLLECTION_REWARDS } from "../collectibles";
import { RIVAL_PERSONAS, pickPersona, personaById } from "../rivals";
import { hasEscapeRoute, laneDropOrder } from "../fairRoute";
import { rotateBackups, readBackup, loadProfileWithRecovery, BACKUP_SLOTS } from "../backup";
import { sanitizeProfile, type Profile } from "../progression";

/* ---------------- Post-Run Coaching ---------------- */
describe("coach", () => {
  const base = {
    killer: "Heavy Truck", speedKmh: 120, jumpH: 0, killerJumpable: false,
    idleSeconds: 1.2, lastActionWasJump: false, jumpLeadSeconds: null,
    laneClearance: { [-1]: 40, 0: 0, 1: 55 }, combo: 4, midTrick: false,
    onSurface: "asphalt", deliveryActive: false,
  };
  it("tells you trucks need a lane change", () => {
    const tips = analyzeCrash(base);
    expect(tips.length).toBeGreaterThan(0);
    expect(tips.some((t) => /lane/i.test(t.title))).toBe(true);
  });
  it("tells you to jump earlier when you jumped too late", () => {
    const tips = analyzeCrash({ ...base, killer: "Sedan", killerJumpable: true, lastActionWasJump: true, jumpLeadSeconds: 0.05 });
    expect(tips.some((t) => /earlier/i.test(t.title))).toBe(true);
  });
  it("caps at 3 tips", () => {
    const tips = analyzeCrash({ ...base, combo: 9, midTrick: true, onSurface: "oil" });
    expect(tips.length).toBeLessThanOrEqual(3);
  });
  it("finish praise covers delivery and distance tiers", () => {
    expect(finishPraise(500, true)).toMatch(/delivered/i);
    expect(finishPraise(2000, false)).toMatch(/solid/i);
    expect(finishPraise(5000, false)).toMatch(/marathon/i);
  });
});

/* ---------------- Practice Drills ---------------- */
describe("drills", () => {
  it("has 7 drills with unique ids", () => {
    expect(DRILLS.length).toBe(7);
    expect(new Set(DRILLS.map((d) => d.id)).size).toBe(7);
  });
  it("drillById finds and rejects", () => {
    expect(drillById("van-hops")?.id).toBe("van-hops");
    expect(drillById("nope")).toBeNull();
  });
  it("recommends drills matching the nemesis", () => {
    const history = [{ score: 1, distance: 10, coins: 1, killer: "Heavy Truck", mode: "classic", themeId: "synthwave", difficulty: "normal", date: "d", duration: 5 }];
    const recs = recommendDrills(history, {});
    expect(recs.length).toBeGreaterThan(0);
  });
});

/* ---------------- Daily Bounties ---------------- */
describe("bounties", () => {
  it("picks exactly 3 deterministic bounties per day key", () => {
    const a = todayBounties("2026-10-24");
    const b = todayBounties("2026-10-24");
    const c = todayBounties("2026-10-25");
    expect(a.length).toBe(3);
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
    expect(a.map((x) => x.id)).not.toEqual(c.map((x) => x.id));
  });
  it("sanitizer resets stale dates and strips junk", () => {
    const fresh = freshBountyState("2026-10-24");
    const stale = sanitizeBountyState({ ...fresh, date: "1999-01-01", progress: { "b-near": 99 }, claimed: ["b-near"], goldenKeyAwarded: true }, "2026-10-24");
    expect(stale.date).toBe("2026-10-24");
    expect(stale.progress).toEqual({});
    expect(stale.claimed).toEqual([]);
    expect(stale.goldenKeyAwarded).toBe(false);
  });
  it("rewards are positive and golden key pays out", () => {
    expect(bountyReward(todayBounties("2026-10-24")[0])).toBeGreaterThanOrEqual(250);
    expect(GOLDEN_KEY_REWARD).toBe(800);
  });
});

/* ---------------- Replay Highlights ---------------- */
describe("highlights", () => {
  const f = (t: number, event?: string, h = 0) => ({ t, x: 0, h, score: 0, speed: 20, lane: 0, event });
  it("bookmarks known events", () => {
    const out = detectHighlights([f(1, "PERFECT DODGE"), f(2, "SLINGSHOT!"), f(3, "TRIPLE STUNT!")]);
    const labels = out.map((o) => o.label.toLowerCase());
    expect(labels.some((l) => l.includes("perfect"))).toBe(true);
    expect(labels.some((l) => l.includes("slingshot"))).toBe(true);
    expect(labels.some((l) => l.includes("triple"))).toBe(true);
  });
  it("marks long airtime exactly once", () => {
    const air = Array.from({ length: 22 }, (_, i) => f(i, undefined, 0.8));
    air.push(f(22, undefined, 0)); // touchdown closes the air window
    const out = detectHighlights(air);
    expect(out.filter((o) => o.label === "Long flight").length).toBe(1);
  });
  it("empty replay yields nothing", () => {
    expect(detectHighlights([])).toEqual([]);
  });
});

/* ---------------- Track codec ---------------- */
describe("trackcode", () => {
  it("round-trips a track through encode/decode", () => {
    const t = { name: "Test", length: 1500, items: [{ at: 200, lane: -1, kind: "car-truck" as const }, { at: 400, lane: 1, kind: "ramp" as const }] };
    const code = encodeTrack(t);
    const back = decodeTrack(code);
    expect(back?.name).toBe("Test");
    expect(back?.items.length).toBe(2);
    expect(back?.items[0].kind).toBe("car-truck");
  });
  it("sanitize drops invalid kinds and clamps ranges", () => {
    const s = sanitizeTrack({ name: "x".repeat(99), length: 99999, items: [{ at: -5, lane: 9, kind: "laser" }, { at: 12000, lane: 0, kind: "coin" }] });
    expect(s?.items.length).toBe(1);
    expect(s?.items[0].at).toBeLessThanOrEqual(3000);
    expect(s?.name.length).toBeLessThanOrEqual(24);
  });
  it("caps items", () => {
    const items = Array.from({ length: 500 }, (_, i) => ({ at: i * 5, lane: 0, kind: "coin" as const }));
    expect(sanitizeTrack({ name: "t", length: 3000, items })?.items.length).toBe(TRACK_MAX_ITEMS);
  });
});

/* ---------------- Loadouts ---------------- */
describe("loadouts", () => {
  it("makeLoadout snapshots the current look", () => {
    const l = makeLoadout("Night Courier", { bikeId: "midnight", helmetId: "frost", jacketId: "violet", trailId: "star", hornId: "laser", companion: "scout", wheelStyle: "deep", wheelColor: "#fbbf24" });
    expect(l.name).toBe("Night Courier");
    expect(l.bikeId).toBe("midnight");
    expect(l.companion).toBe("scout");
  });
  it("sanitizer caps at MAX_LOADOUTS and drops junk", () => {
    const junk = Array.from({ length: MAX_LOADOUTS + 5 }, (_, i) => ({ name: "L" + i, bikeId: "b" + i }));
    expect(sanitizeLoadouts(junk).length).toBe(MAX_LOADOUTS);
    expect(sanitizeLoadouts([{ nope: true }, null, 42])).toEqual([]);
  });
});

/* ---------------- Sound Packs ---------------- */
describe("soundpacks", () => {
  it("has 6 packs with unique ids", () => {
    expect(SOUND_PACKS.length).toBe(6);
    expect(new Set(SOUND_PACKS.map((p) => p.id)).size).toBe(6);
  });
  it("packById falls back to neon", () => {
    expect(packById("bit8").id).toBe("bit8");
    expect(packById("junk").id).toBe("neon");
  });
});

/* ---------------- Districts ---------------- */
describe("districts", () => {
  it("downtown always unlocked; mountain needs stars + prereqs", () => {
    const stars = {};
    expect(districtUnlocked(DISTRICTS[0], stars)).toBe(true);
    expect(districtUnlocked(DISTRICTS[3], stars)).toBe(false);
    // both prereq districts cleared but not enough stars
    const partial: Record<string, number> = { "4": 1, "5": 1 };
    expect(districtUnlocked(DISTRICTS[3], partial)).toBe(false);
    // full stars
    const full: Record<string, number> = {};
    for (const d of DISTRICTS) for (const n of d.nodes) full[String(n.contractId)] = 3;
    expect(districtUnlocked(DISTRICTS[3], full)).toBe(true);
    expect(hqUnlocked(full)).toBe(true);
  });
  it("totalStars sums", () => {
    expect(totalStars({ a: 2, b: 3 })).toBe(5);
  });
  it("shortcuts gate on total stars", () => {
    const s = DISTRICTS.length && shortcutUnlocked({ id: "sc-1", name: "x", from: "downtown", to: "neon", requireStars: 8, bonus: 300 }, { "1": 3, "2": 3, "3": 3 });
    expect(s).toBe(true);
  });
});

/* ---------------- Gadgets ---------------- */
describe("gadgets", () => {
  it("has 5 gadgets with prices", () => {
    expect(GADGETS.length).toBe(5);
    expect(GADGETS.every((g) => g.price >= 200)).toBe(true);
    expect(gadgetById("spikeArmor")?.name).toContain("Spike");
  });
  it("sanitizer clamps inventory counts", () => {
    const inv = sanitizeGadgets({ spikeArmor: 99, coinRadar: -4, ghostBeacon: "x" });
    expect(inv.spikeArmor).toBeLessThanOrEqual(99);
    expect(inv.coinRadar).toBe(0);
    expect(inv.ghostBeacon).toBe(0);
  });
});

/* ---------------- Collectibles ---------------- */
describe("collectibles", () => {
  it("5 worlds with 3 relics each and a reward", () => {
    expect(COLLECTIBLES.length).toBe(15);
    for (const w of ["synthwave", "city", "desert", "alpine", "tokyo"]) {
      expect(collectiblesForWorld(w).length).toBe(3);
      expect(COLLECTION_REWARDS[w]).toBeTruthy();
    }
  });
  it("sanitizer strips unknown ids and dupes", () => {
    const out = sanitizeCollections(["ns-horseshoe", "ns-horseshoe", "fake-item", 42, null]);
    expect(out).toEqual(["ns-horseshoe"]);
  });
});

/* ---------------- Rivals ---------------- */
describe("rivals", () => {
  it("6 personas with distinct behavior knobs", () => {
    expect(RIVAL_PERSONAS.length).toBe(6);
    expect(new Set(RIVAL_PERSONAS.map((p) => p.id)).size).toBe(6);
    expect(RIVAL_PERSONAS.every((p) => p.colors.length === 2)).toBe(true);
  });
  it("pickPersona is deterministic per rand and personaById resolves", () => {
    const r = () => 0.1;
    expect(pickPersona(r).id).toBe(pickPersona(r).id);
    expect(personaById("drafter")?.name).toBeTruthy();
  });
});

/* ---------------- Fair Route ---------------- */
describe("fairRoute", () => {
  const OPTS = { lanes: [-1, 0, 1], startLane: 0, laneChangeTime: 0.34, horizon: 7, step: 0.25 };
  it("empty road always has an escape route", () => {
    expect(hasEscapeRoute([], OPTS)).toBe(true);
  });
  it("a fully blocked horizon fails validation", () => {
    const obs = [-1, 0, 1].map((lane) => ({
      lane, fromT: 0, toT: 99, clearH: Number.POSITIVE_INFINITY,
    }));
    expect(hasEscapeRoute(obs, OPTS)).toBe(false);
  });
  it("jumpable obstacles never block the route", () => {
    const obs = [-1, 0, 1].map((lane) => ({ lane, fromT: 0, toT: 99, clearH: 0.62 }));
    expect(hasEscapeRoute(obs, OPTS)).toBe(true);
  });
  it("a temporary wall on all lanes is still unfair (rejected)", () => {
    const obs = [-1, 0, 1].map((lane) => ({ lane, fromT: 1, toT: 1.6, clearH: Number.POSITIVE_INFINITY }));
    expect(hasEscapeRoute(obs, OPTS)).toBe(false);
  });
  it("a wall covering two lanes leaves the third as escape", () => {
    const obs = [0, -1].map((lane) => ({ lane, fromT: 1, toT: 1.6, clearH: Number.POSITIVE_INFINITY }));
    expect(hasEscapeRoute(obs, OPTS)).toBe(true);
  });
  it("laneDropOrder ranks the lane farthest from the free lane first", () => {
    const order = laneDropOrder([0, -1], 1);
    expect(order[0]).toBe(-1);
    expect(order).toContain(0);
  });
});

/* ---------------- Save Recovery ---------------- */

/** Minimal localStorage stub for the node test environment. */
const store = new Map<string, string>();
const lsStub: Storage = {
  get length() { return store.size; },
  clear: () => store.clear(),
  getItem: (k) => store.get(k) ?? null,
  key: (i) => [...store.keys()][i] ?? null,
  removeItem: (k) => { store.delete(k); },
  setItem: (k, v) => { store.set(k, String(v)); },
};
if (typeof globalThis.localStorage === "undefined") {
  Object.defineProperty(globalThis, "localStorage", { value: lsStub, configurable: true, writable: true });
}

describe("backup", () => {
  it("rotates and reads back a valid snapshot", () => {
    localStorage.clear();
    const profile: Profile = sanitizeProfile({ runs: 3, xp: 40, wallet: 120 });
    rotateBackups(profile);
    const b = readBackup(0);
    expect(b?.profile.runs).toBe(3);
    expect(b?.profile.wallet).toBe(120);
  });
  it("loadProfileWithRecovery restores from backup when primary is junk", () => {
    localStorage.clear();
    const good: Profile = sanitizeProfile({ runs: 5, xp: 90, wallet: 300 });
    rotateBackups(good);
    localStorage.setItem("wwr-profile-v3", "{corrupted json!!");
    const r = loadProfileWithRecovery();
    expect(r.recovered).toBe(true);
    expect(r.profile.runs).toBe(5);
  });
  it("BACKUP_SLOTS is at least 3", () => {
    expect(BACKUP_SLOTS).toBeGreaterThanOrEqual(3);
  });
});
