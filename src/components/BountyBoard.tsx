import {
  todayBounties, bountyReward, GOLDEN_KEY_REWARD,
  type DailyBountyState, type BountyDef,
} from "../game/bounties";

function fmtTarget(stat: string, target: number): string {
  if (stat === "distanceNoBrake") return `${target.toLocaleString()}m`;
  return String(target);
}

function progressLabel(b: BountyDef, value: number): string {
  return `${Math.min(value, b.target).toLocaleString()} / ${fmtTarget(b.stat, b.target)}`;
}

export default function BountyBoard({ state, today, onClaim, accent }: {
  state: DailyBountyState;
  today: string;
  onClaim: (id: string) => void;
  accent: string;
}) {
  const bounties = todayBounties(today);
  const allClaimed = bounties.every((b) => state.claimed.includes(b.id));

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="font-display text-[10px] font-bold tracking-[0.24em] text-white/70">ROAD HUNTER CONTRACTS</div>
        <span className="rounded-full bg-white/8 px-2 py-0.5 font-display text-[8px] font-bold text-white/60">RESETS DAILY</span>
      </div>

      {bounties.map((b) => {
        const value = state.progress[b.id] ?? 0;
        const done = value >= b.target;
        const claimed = state.claimed.includes(b.id);
        const pct = Math.max(4, Math.min(100, (value / b.target) * 100));
        return (
          <div key={b.id}
            className="rounded-xl border p-2.5"
            style={{
              borderColor: claimed ? "rgba(74,222,128,0.45)" : done ? "rgba(253,224,71,0.5)" : "rgba(255,255,255,0.1)",
              background: claimed ? "rgba(74,222,128,0.07)" : "rgba(255,255,255,0.03)",
            }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-display text-[10px] font-black text-white">{b.label}</div>
                <div className="mt-0.5 text-[9px] italic text-white/50">“{b.detail}”</div>
              </div>
              {claimed ? (
                <span className="shrink-0 rounded-full bg-emerald-400/15 px-2 py-1 font-display text-[8px] font-black text-emerald-300">PAID</span>
              ) : done ? (
                <button onClick={() => onClaim(b.id)}
                  className="btn-neon shrink-0 rounded-full px-3 py-1 font-display text-[9px] font-black text-black"
                  style={{ background: "#fde047" }}>
                  CLAIM +{bountyReward(b)}
                </button>
              ) : (
                <span className="shrink-0 rounded-full bg-white/8 px-2 py-1 font-display text-[8px] font-bold text-white/60">+{bountyReward(b)}</span>
              )}
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-[8px] text-white/45">
                <span>{progressLabel(b, value)}</span>
                {done && !claimed && <span className="font-black text-amber-300">COMPLETE!</span>}
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: done ? "#fde047" : accent }} />
              </div>
            </div>
          </div>
        );
      })}

      <div className="rounded-xl border p-2.5 text-center"
        style={{
          borderColor: allClaimed ? "#fde047" : "rgba(255,255,255,0.1)",
          background: allClaimed ? "rgba(253,224,71,0.08)" : "rgba(255,255,255,0.03)",
        }}>
        <div className="font-display text-[10px] font-black tracking-widest" style={{ color: allClaimed ? "#fde047" : "rgba(255,255,255,0.5)" }}>
          {allClaimed
            ? "GOLDEN CRATE KEY AWARDED!"
            : "COMPLETE ALL 3 → GOLDEN CRATE KEY"}
        </div>
        <div className="mt-0.5 text-[9px] text-white/50">
          {allClaimed
            ? "Your next crate is guaranteed Legendary."
            : `Grand prize: guaranteed-Legendary crate + ${GOLDEN_KEY_REWARD} coins`}
        </div>
      </div>
    </div>
  );
}
