/* ================================================================
   Track Editor share codec
   A custom course is a list of placements on a distance timeline.
   Encoded compactly to base64url JSON for sharing via link/code.
   ================================================================ */

import { utf8ToB64url, b64urlToUtf8 } from "./codec";

export type TrackItemKind =
  | "car-sedan" | "car-sports" | "car-taxi" | "car-van" | "car-police"
  | "car-truck" | "car-ambulance" | "car-bus" | "car-flatbed" | "car-moto"
  | "coin" | "hazard-pothole" | "hazard-cone" | "hazard-barrier" | "hazard-spikes"
  | "ramp" | "toll" | "portal-shard";

export interface TrackItem {
  /** placement distance in metres from the start */
  at: number;
  /** -1 | 0 | 1 */
  lane: number;
  kind: TrackItemKind;
}

export interface TrackData {
  name: string;
  length: number;
  items: TrackItem[];
}

export const TRACK_MAX_ITEMS = 220;
export const TRACK_MAX_LENGTH = 3000;
export const TRACK_MAX_CODE = 16000;

const KINDS: TrackItemKind[] = [
  "car-sedan", "car-sports", "car-taxi", "car-van", "car-police",
  "car-truck", "car-ambulance", "car-bus", "car-flatbed", "car-moto",
  "coin", "hazard-pothole", "hazard-cone", "hazard-barrier", "hazard-spikes",
  "ramp", "toll", "portal-shard",
];

const KIND_SET = new Set<string>(KINDS);

/** Validate & clamp an untrusted track object. */
export function sanitizeTrack(v: unknown): TrackData | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.items)) return null;
  const items: TrackItem[] = [];
  for (const raw of o.items) {
    if (typeof raw !== "object" || raw === null) continue;
    const it = raw as Record<string, unknown>;
    if (typeof it.kind !== "string" || !KIND_SET.has(it.kind)) continue;
    const at = typeof it.at === "number" && Number.isFinite(it.at) ? Math.max(0, Math.min(TRACK_MAX_LENGTH, it.at)) : -1;
    const lane = typeof it.lane === "number" && Number.isFinite(it.lane) ? Math.round(Math.max(-1, Math.min(1, it.lane))) : 0;
    if (at < 0) continue;
    items.push({ at: Math.round(at), lane, kind: it.kind as TrackItemKind });
    if (items.length >= TRACK_MAX_ITEMS) break;
  }
  items.sort((a, b) => a.at - b.at);
  const length = typeof o.length === "number" && Number.isFinite(o.length)
    ? Math.max(100, Math.min(TRACK_MAX_LENGTH, o.length))
    : Math.max(100, ...items.map((i) => i.at + 60));
  return {
    name: typeof o.name === "string" ? o.name.slice(0, 24) : "Custom Course",
    length,
    items,
  };
}

export function encodeTrack(t: TrackData): string {
  // compact array form: [kindIndex*1000-ish packing is overkill; JSON is fine at this size]
  const json = JSON.stringify({ v: 1, t: { n: t.name.slice(0, 24), l: Math.round(t.length), i: t.items.map((i) => [i.at, i.lane, KINDS.indexOf(i.kind)]) } });
  return utf8ToB64url(json);
}

export function decodeTrack(code: string): TrackData | null {
  if (!code || code.length > TRACK_MAX_CODE) return null;
  try {
    const json = b64urlToUtf8(code.trim());
    if (!json) return null;
    const data = JSON.parse(json) as { v?: number; t?: { n?: unknown; l?: unknown; i?: unknown } };
    if (!data || data.v !== 1 || typeof data.t !== "object" || data.t === null) return null;
    const rawItems = Array.isArray(data.t.i) ? data.t.i : [];
    const items: TrackItem[] = [];
    for (const entry of rawItems) {
      if (!Array.isArray(entry) || entry.length < 3) continue;
      const [at, lane, ki] = entry;
      if (typeof at !== "number" || typeof lane !== "number" || typeof ki !== "number") continue;
      if (ki < 0 || ki >= KINDS.length) continue;
      items.push({
        at: Math.max(0, Math.min(TRACK_MAX_LENGTH, Math.round(at))),
        lane: Math.max(-1, Math.min(1, Math.round(lane))),
        kind: KINDS[ki],
      });
      if (items.length >= TRACK_MAX_ITEMS) break;
    }
    items.sort((a, b) => a.at - b.at);
    return {
      name: typeof data.t.n === "string" ? data.t.n.slice(0, 24) : "Shared Course",
      length: typeof data.t.l === "number" && Number.isFinite(data.t.l) ? Math.max(100, Math.min(TRACK_MAX_LENGTH, data.t.l)) : Math.max(100, ...items.map((i) => i.at + 60)),
      items,
    };
  } catch {
    return null;
  }
}

export const TRACK_KIND_LABELS: Record<string, string> = {
  "car-sedan": "Sedan", "car-sports": "Sports", "car-taxi": "Taxi", "car-van": "Van",
  "car-police": "Police", "car-truck": "Truck", "car-ambulance": "Ambulance",
  "car-bus": "Bus", "car-flatbed": "Ramp Flatbed", "car-moto": "Moto",
  coin: "Coins", "hazard-pothole": "Pothole", "hazard-cone": "Cone",
  "hazard-barrier": "Barrier", "hazard-spikes": "Spikes", ramp: "Ramp Jump",
  toll: "Toll Gate", "portal-shard": "Portal Shard",
};
