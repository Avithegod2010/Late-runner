/* ================================================================
   Daily Bounties & Road Hunter Contracts
   Three deterministic micro-challenges per day. Completing all
   three awards a Golden Crate Key (guaranteed-Legendary crate).
   ================================================================ */

import { todayKey } from "./rng";

export type BountyStat =
  | "flungPolice" | "distanceNoBrake" | "stuntChain" | "nearMisses"
  | "maxCombo" | "coins" | "tolls" | "tunnelDistance" | "perfectDodges" | "slingshots";

export interface BountyDef {
  id: string;
  stat: BountyStat;
  target: number;
  label: string;
  detail: string;
}

const POOL: BountyDef[] = [
  { id: "b-police", stat: "flungPolice", target: 3, label: "Smash 3 police cruisers in one run", detail: "Nitro through the lightbars" },
  { id: "b-nobrake", stat: "distanceNoBrake", target: 1200, label: "Complete a 1,200m run without braking", detail: "No brake input, no mercy" },
  { id: "b-triple", stat: "stuntChain", target: 3, label: "Land a Triple Stunt", detail: "Three distinct tricks, one jump" },
  { id: "b-near", stat: "nearMisses", target: 25, label: "Near-miss 25 cars in one run", detail: "Paint-scraper specials" },
  { id: "b-combo", stat: "maxCombo", target: 6, label: "Bank a ×6 near-miss combo", detail: "Chain the brushes" },
  { id: "b-coins", stat: "coins", target: 120, label: "Collect 120 coins in one run", detail: "Follow the gold lines" },
  { id: "b-toll", stat: "tolls", target: 3, label: "Clear 3 toll gates in one run", detail: "Thread the amber centre" },
  { id: "b-tunnel", stat: "tunnelDistance", target: 400, label: "Ride 400m inside tunnels in one run", detail: "Echoes and headlight beams" },
  { id: "b-perfect", stat: "perfectDodges", target: 6, label: "Land 6 Perfect dodges in one run", detail: "Last-millisecond swerves" },
  { id: "b-sling", stat: "slingshots", target: 3, label: "Slingshot 3 times in one run", detail: "Charge the draft, release the fire" },
];

export interface DailyBountyState {
  /** todayKey() this state belongs to */
  date: string;
  /** chosen bounty ids in order */
  ids: string[];
  /** best progress per bounty id */
  progress: Record<string, number>;
  /** claimed reward flags */
  claimed: string[];
  /** golden crate key awarded for finishing all three */
  goldenKeyAwarded: boolean;
}

/** Deterministic 3-bounty pick from the day key. */
export function todayBounties(key = todayKey()): BountyDef[] {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  const seed = h >>> 0;
  const a = seed % POOL.length;
  const b = Math.floor(seed / 7) % POOL.length;
  const c = Math.floor(seed / 131) % POOL.length;
  const ids = new Set<number>([a, b === a ? (a + 1) % POOL.length : b, c === a || c === b ? (a + 2) % POOL.length : c]);
  return [...ids].map((i) => POOL[i]);
}

export function freshBountyState(key = todayKey()): DailyBountyState {
  return { date: key, ids: todayBounties(key).map((b) => b.id), progress: {}, claimed: [], goldenKeyAwarded: false };
}

/** Sanitize untrusted stored state. */
export function sanitizeBountyState(v: unknown, key = todayKey()): DailyBountyState {
  const fresh = freshBountyState(key);
  if (typeof v !== "object" || v === null) return fresh;
  const o = v as Record<string, unknown>;
  if (o.date !== key) return fresh; // yesterday's board is gone
  const validIds = new Set(POOL.map((b) => b.id));
  const ids = Array.isArray(o.ids) ? o.ids.filter((x): x is string => typeof x === "string" && validIds.has(x)) : [];
  const progress: Record<string, number> = {};
  if (typeof o.progress === "object" && o.progress !== null) {
    for (const [k, val] of Object.entries(o.progress as Record<string, unknown>)) {
      if (validIds.has(k) && typeof val === "number" && Number.isFinite(val)) progress[k] = Math.max(0, val);
    }
  }
  const claimed = Array.isArray(o.claimed)
    ? o.claimed.filter((x): x is string => typeof x === "string" && validIds.has(x))
    : [];
  return {
    date: key,
    ids: ids.length === 3 ? ids : fresh.ids,
    progress,
    claimed,
    goldenKeyAwarded: o.goldenKeyAwarded === true,
  };
}

export function bountyReward(b: BountyDef): number {
  // harder contracts (longer combos / distances) pay a small premium
  const premium = b.stat === "stuntChain" || b.stat === "distanceNoBrake" ? 50 : 0;
  return 250 + premium;
}

export const GOLDEN_KEY_REWARD = 800;
