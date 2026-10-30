/* ================================================================
   Saved Rider Loadouts
   Named combinations of bike, outfit, horn and companion — e.g.
   "Stunt Build" or "Night Courier" — with instant switching.
   ================================================================ */

import { wheelStyleById, sanitizeWheelColor } from "./garage";

export interface RiderLoadout {
  name: string;
  bikeId: string;
  helmetId: string;
  jacketId: string;
  trailId: string;
  hornId: string;
  companion: string;
  wheelStyle: string;
  wheelColor: string;
}

export const MAX_LOADOUTS = 6;

export function makeLoadout(name: string, cur: Omit<RiderLoadout, "name">): RiderLoadout {
  return {
    name: name.trim().slice(0, 18) || "BUILD " + String(Math.floor(Math.random() * 90) + 10),
    bikeId: cur.bikeId,
    helmetId: cur.helmetId,
    jacketId: cur.jacketId,
    trailId: cur.trailId,
    hornId: cur.hornId,
    companion: cur.companion,
    wheelStyle: cur.wheelStyle,
    wheelColor: cur.wheelColor,
  };
}

/** Sanitize an untrusted loadout list (localStorage / import). */
export function sanitizeLoadouts(v: unknown): RiderLoadout[] {
  if (!Array.isArray(v)) return [];
  const out: RiderLoadout[] = [];
  for (const item of v) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.name !== "string" || !o.name.trim()) continue;
    out.push({
      name: o.name.slice(0, 18),
      bikeId: String(o.bikeId ?? "neon").slice(0, 24),
      helmetId: String(o.helmetId ?? "comet").slice(0, 24),
      jacketId: String(o.jacketId ?? "ember").slice(0, 24),
      trailId: String(o.trailId ?? "mist").slice(0, 24),
      hornId: String(o.hornId ?? "airhorn").slice(0, 24),
      companion: String(o.companion ?? "none").slice(0, 24),
      wheelStyle: wheelStyleById(typeof o.wheelStyle === "string" ? o.wheelStyle : "").id,
      wheelColor: sanitizeWheelColor(o.wheelColor),
    });
    if (out.length >= MAX_LOADOUTS) break;
  }
  return out;
}
