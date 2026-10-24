/* ================================================================
   Post-Run Coaching
   The engine records a small rolling context at crash time; this
   module turns it into human advice: "Jump earlier", "Trucks require
   a lane change", "The right lane was clear"…
   Pure module: deterministic, unit-testable.
   ================================================================ */

export interface CoachSnapshot {
  /** what killed you */
  killer: string;
  /** km/h at impact */
  speedKmh: number;
  /** jump height at impact (0 = grounded) */
  jumpH: number;
  /** true when the killer is jumpable with a normal jump */
  killerJumpable: boolean;
  /** seconds since your last input action (jump or lane) */
  idleSeconds: number;
  /** last action was a jump */
  lastActionWasJump: boolean;
  /** seconds between the jump starting and the impact */
  jumpLeadSeconds: number | null;
  /** free distance (metres of clearance) per lane at crash time */
  laneClearance: Record<number, number>;
  /** combo held at crash */
  combo: number;
  /** crashed while a trick was mid-animation */
  midTrick: boolean;
  /** crashed on a wet/oil/gravel patch */
  onSurface: string;
  /** was the run a delivery with the package damaged */
  deliveryActive: boolean;
}

export interface CoachTip {
  /** short headline, e.g. "JUMP EARLIER" */
  title: string;
  /** one-sentence explanation */
  detail: string;
}

const UNJUMPABLE = new Set(["Heavy Truck", "City Bus", "Road Train", "SWAT Gunship"]);
const HAZARD_NAMES = new Set(["Spike Strip", "Road Barrier", "Traffic Cone", "Pothole"]);

export function analyzeCrash(s: CoachSnapshot): CoachTip[] {
  const tips: CoachTip[] = [];
  const laneNames: Record<number, string> = { [-1]: "left", 0: "centre", 1: "right" };

  // 1. Unjumpable heavies need a lane change, full stop.
  if (UNJUMPABLE.has(s.killer)) {
    tips.push({
      title: "TRUCKS REQUIRE A LANE CHANGE",
      detail: `${s.killer}s can't be jumped — commit to a side early and never hesitate mid-gap.`,
    });
  } else if (HAZARD_NAMES.has(s.killer)) {
    tips.push({
      title: "HOP HAZARDS EARLY",
      detail: s.onSurface !== "asphalt"
        ? `You were on ${s.onSurface} — surface patches steal steering. Jump before the ${s.killer.toLowerCase()}, not on it.`
        : `Press jump a half-second before the ${s.killer.toLowerCase()} reaches you, or steer a full lane wide.`,
    });
  } else if (s.killerJumpable && s.jumpH <= 0.05) {
    // grounded into a jumpable vehicle
    tips.push({
      title: "JUMP EARLIER",
      detail: `The ${s.killer.toLowerCase()} is jumpable — take off about a car-length before it reaches you.`,
    });
  } else if (s.killerJumpable && s.jumpH > 0.05 && s.jumpLeadSeconds !== null && s.jumpLeadSeconds < 0.28) {
    tips.push({
      title: "JUMP EARLIER",
      detail: `You left it late (${s.jumpLeadSeconds.toFixed(2)}s of lead). Buffered jumps help, but a clean early arc clears the ${s.killer.toLowerCase()} entirely.`,
    });
  } else if (s.midTrick) {
    tips.push({
      title: "FINISH TRICKS BEFORE TRAFFIC",
      detail: "You landed mid-trick. Only start a stunt when the landing zone is clear — or fast-fall to bail safely.",
    });
  }

  // 2. The escape lane that was actually open.
  const entries = Object.entries(s.laneClearance).map(([lane, m]) => ({ lane: Number(lane), m }));
  if (entries.length) {
    const best = entries.sort((a, b) => b.m - a.m)[0];
    if (best.m >= 18) {
      tips.push({
        title: `THE ${laneNames[best.lane] ?? "other"} LANE WAS CLEAR`,
        detail: `${Math.round(best.m)}m of open road sat in the ${laneNames[best.lane] ?? "other"} lane — dodge at first sight, not at the bumper.`,
      });
    }
  }

  // 3. Situational habits.
  if (s.idleSeconds > 1.4 && s.speedKmh > 90) {
    tips.push({
      title: "KEEP STEERING ALIVE",
      detail: `You went ${s.idleSeconds.toFixed(1)}s without a move at ${s.speedKmh} km/h. Tap a lane early so options stay open.`,
    });
  }
  if (s.combo >= 5) {
    tips.push({
      title: "BANK YOUR COMBO",
      detail: `You were holding ×${s.combo} when you crashed. Press B to bank it before threading tight gaps.`,
    });
  }
  if (s.deliveryActive) {
    tips.push({
      title: "PROTECT THE PACKAGE",
      detail: "Every bump costs delivery condition — shields and rescue tickets keep the payout at 100%.",
    });
  }

  // dedupe by title, cap at 3 for the game-over card
  const seen = new Set<string>();
  return tips.filter((t) => (seen.has(t.title) ? false : (seen.add(t.title), true))).slice(0, 3);
}

/** Encouraging line for clean/finished runs (no crash). */
export function finishPraise(distance: number, delivery: boolean): string {
  if (delivery) return "Delivered clean — the dispatcher is impressed.";
  if (distance >= 3000) return "Marathon run. Your line-reading is on another level.";
  if (distance >= 1500) return "Solid ride — the traffic never really had you.";
  return "Clean finish. Keep stacking those near-miss combos.";
}
