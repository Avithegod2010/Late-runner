/* ================================================================
   Keyboard remapping (v1.0). The arrow keys and Space always keep
   working as alternates so a player can never lock themselves out;
   this map assigns the *extra* primary key per action. Persisted in
   settings, merged over DEFAULT_KEYMAP at use time.
   ================================================================ */

export interface Keymap {
  left: string;
  right: string;
  jump: string;
  down: string;
  drift: string;
  wheelie: string;
  flip: string;
  bank: string;
  nitro: string;
  sling: string;
  prestige: string;
  horn: string;
  pause: string;
}

export const DEFAULT_KEYMAP: Keymap = {
  left: "a",
  right: "d",
  jump: "w",
  down: "s",
  drift: "shift",
  wheelie: "q",
  flip: "f",
  bank: "b",
  nitro: "n",
  sling: "x",
  prestige: "g",
  horn: "h",
  pause: "p",
};

export type KeyAction = keyof Keymap;

export const KEYMAP_ACTIONS: { id: KeyAction; name: string; hint: string }[] = [
  { id: "left", name: "Steer left", hint: "also ←" },
  { id: "right", name: "Steer right", hint: "also →" },
  { id: "jump", name: "Jump", hint: "also ↑ / Space" },
  { id: "down", name: "Fast fall", hint: "also ↓" },
  { id: "drift", name: "Hold drift", hint: "" },
  { id: "wheelie", name: "Hold wheelie", hint: "" },
  { id: "flip", name: "Flip trick", hint: "" },
  { id: "bank", name: "Bank combo", hint: "also E" },
  { id: "nitro", name: "Nitro", hint: "" },
  { id: "sling", name: "Slingshot", hint: "" },
  { id: "prestige", name: "Prestige move", hint: "" },
  { id: "horn", name: "Honk", hint: "" },
  { id: "pause", name: "Pause", hint: "also Esc" },
];

/** Normalise a DOM key name to our storage form (" ", "A", "ArrowLeft" → "space","a","arrowleft"). */
export function normalizeKey(k: string): string {
  const s = (k ?? "").toLowerCase();
  if (s === " " || s === "spacebar") return "space";
  return s;
}

/** True when a DOM key event's key activates an action's mapped key. */
export function keyMatches(eventKey: string, mapped: string): boolean {
  return normalizeKey(eventKey) === normalizeKey(mapped);
}

/** Human label for a stored key value. */
export function keyLabel(k: string): string {
  const s = normalizeKey(k);
  if (s === "space") return "SPACE";
  if (s === "shift") return "SHIFT";
  if (s === "arrowleft") return "←";
  if (s === "arrowright") return "→";
  if (s === "arrowup") return "↑";
  if (s === "arrowdown") return "↓";
  if (s === "escape") return "ESC";
  return s.toUpperCase();
}

/** Merge a (possibly hostile/partial) stored map over the defaults. */
export function resolveKeymap(stored: unknown): Keymap {
  const out: Keymap = { ...DEFAULT_KEYMAP };
  if (typeof stored === "object" && stored !== null && !Array.isArray(stored)) {
    const rec = stored as Record<string, unknown>;
    for (const a of Object.keys(DEFAULT_KEYMAP) as KeyAction[]) {
      const v = rec[a];
      if (typeof v === "string" && v.length > 0 && v.length <= 24) out[a] = normalizeKey(v);
    }
  }
  return out;
}
