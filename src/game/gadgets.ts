/* ================================================================
   Pre-Run Consumable Gadgets
   Tactical gear bought with spare coins and equipped in the loadout:
   Spike Armor, Coin Doubler Radar, Ghost Beacon.
   ================================================================ */

export type GadgetId = "spikeArmor" | "coinRadar" | "ghostBeacon" | "nitroSiphon" | "coinCompass";

export interface GadgetDef {
  id: GadgetId;
  name: string;
  detail: string;
  price: number;
  /** in-run announcement when its effect triggers */
  trigger: string;
}

export const GADGETS: GadgetDef[] = [
  {
    id: "spikeArmor",
    name: "Spike Armor",
    detail: "Destroys the first road hazard you hit this run.",
    price: 220,
    trigger: "SPIKE ARMOR ABSORBED IT!",
  },
  {
    id: "coinRadar",
    name: "Coin Doubler Radar",
    detail: "Every third coin this run becomes a diamond worth 100.",
    price: 300,
    trigger: "DIAMOND +100!",
  },
  {
    id: "ghostBeacon",
    name: "Ghost Beacon",
    detail: "An AI companion bike guides you through the safest lane.",
    price: 260,
    trigger: "GHOST BEACON ONLINE",
  },
  {
    id: "nitroSiphon",
    name: "Nitro Siphon",
    detail: "Every near-miss also siphons +6% nitro into the tank.",
    price: 340,
    trigger: "NITRO SIPHON FLOWING",
  },
  {
    id: "coinCompass",
    name: "Coin Compass",
    detail: "Nearby coins drift toward your lane even without a magnet.",
    price: 280,
    trigger: "COIN COMPASS LOCKED ON",
  },
];

export function gadgetById(id: string): GadgetDef | null {
  return GADGETS.find((g) => g.id === id) ?? null;
}

/** Sanitize an untrusted gadget inventory record. */
export function sanitizeGadgets(v: unknown): Record<GadgetId, number> {
  const out: Record<GadgetId, number> = { spikeArmor: 0, coinRadar: 0, ghostBeacon: 0, nitroSiphon: 0, coinCompass: 0 };
  if (typeof v !== "object" || v === null) return out;
  const o = v as Record<string, unknown>;
  for (const g of GADGETS) {
    const n = o[g.id];
    if (typeof n === "number" && Number.isFinite(n)) out[g.id] = Math.min(99, Math.max(0, Math.round(n)));
  }
  return out;
}
