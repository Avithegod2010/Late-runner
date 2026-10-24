/* ================================================================
   Automatic Replay Highlights
   Scans a recorded run's frames and bookmarks the moments worth
   re-watching: perfect dodges, long grinds, boss victories, big
   stunt chains, slingshots and close finishes.
   ================================================================ */

import type { ReplayFrame } from "./progression";

export interface Highlight {
  /** replay time in seconds */
  t: number;
  /** frame index to seek to */
  index: number;
  label: string;
  color: string;
  icon: string;
}

interface EventRule {
  match: (e: string) => boolean;
  label: (e: string) => string;
  color: string;
  icon: string;
}

const RULES: EventRule[] = [
  { match: (e) => e.startsWith("PERFECT"), label: () => "Perfect dodge", color: "#ffffff", icon: "★" },
  { match: (e) => e.startsWith("SLINGSHOT"), label: () => "Slingshot", color: "#ff8c42", icon: "»" },
  { match: (e) => e.startsWith("TRIPLE"), label: () => "Triple stunt!", color: "#f9a8d4", icon: "⚡" },
  { match: (e) => e.startsWith("STUNT CHAIN"), label: (e) => e, color: "#f9a8d4", icon: "⚡" },
  { match: (e) => e.startsWith("BOSS"), label: () => "Boss cleared", color: "#fde68a", icon: "☠" },
  { match: (e) => e.startsWith("GUNSHIP"), label: () => "Gunship escaped", color: "#60a5fa", icon: "✦" },
  { match: (e) => e.startsWith("GHOST BEATEN"), label: () => "Ghost beaten", color: "#7dd3fc", icon: "◈" },
  { match: (e) => e.startsWith("TOLL PAID"), label: () => "Toll bonus", color: "#fde68a", icon: "⌾" },
  { match: (e) => e.startsWith("GRIND"), label: () => "Rail grind", color: "#67e8f9", icon: "≈" },
  { match: (e) => e.startsWith("WANTED"), label: () => "Chase survived", color: "#60a5fa", icon: "▲" },
  { match: (e) => e.startsWith("WARP"), label: () => "Portal zone", color: "#c4b5fd", icon: "◉" },
  { match: (e) => e.startsWith("FUSION"), label: (e) => e, color: "#f0abfc", icon: "✚" },
];

/** Detect highlight bookmarks from the replay's event channel. */
export function detectHighlights(frames: ReplayFrame[]): Highlight[] {
  const out: Highlight[] = [];
  if (!frames.length) return out;
  let lastAirStart = -1;

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const e = f.event ?? "";

    for (const rule of RULES) {
      if (e && rule.match(e)) {
        out.push({ t: f.t, index: i, label: rule.label(e), color: rule.color, icon: rule.icon });
        break; // one bookmark per frame
      }
    }

    // long airtime = big jump worth scrubbing to
    if (f.h > 0.6) {
      if (lastAirStart < 0) {
        lastAirStart = i;
      }
    } else if (lastAirStart >= 0) {
      const airFrames = i - lastAirStart;
      if (airFrames >= 18) {
        out.push({
          t: frames[lastAirStart].t,
          index: lastAirStart,
          label: "Long flight",
          color: "#7dd3fc",
          icon: "↑",
        });
      }
      lastAirStart = -1;
    }

    // score spikes (banked combos cashing in) — detect via score delta
  }

  // close finish: the final 2 seconds are always interesting if the run
  // lasted more than 20s
  if (frames.length > 20) {
    const last = frames[frames.length - 1];
    out.push({ t: Math.max(0, last.t - 1.5), index: Math.max(0, frames.length - 30), label: "The finish", color: "#ffe066", icon: "▶" });
  }

  // dedupe by label+1s window and sort by time
  out.sort((a, b) => a.t - b.t);
  const deduped: Highlight[] = [];
  for (const h of out) {
    const dup = deduped.some((x) => x.label === h.label && Math.abs(x.t - h.t) < 2);
    if (!dup) deduped.push(h);
  }
  return deduped.slice(0, 12);
}
