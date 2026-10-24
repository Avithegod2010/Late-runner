import {
  DISTRICTS, SHORTCUTS, HQ_CONTRACT, districtUnlocked, totalStars, shortcutUnlocked, hqUnlocked,
} from "../game/districts";
import type { CareerContract } from "../game/features";

const STAR = "★";

export default function DistrictMap({ stars, contracts, onStart, accent }: {
  stars: Record<string, number>;
  contracts: CareerContract[];
  onStart: (contractId: number) => void;
  accent: string;
}) {
  const total = totalStars(stars);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="font-display text-[10px] font-bold tracking-[0.24em] text-white/70">COURIER CITY MAP</div>
        <div className="rounded-full px-2.5 py-1 font-display text-[10px] font-black" style={{ background: "rgba(255,255,255,0.08)", color: accent }}>
          {total} {STAR}
        </div>
      </div>

      {/* ---- map canvas ---- */}
      <div className="relative overflow-hidden rounded-2xl border border-white/12" style={{ aspectRatio: "4 / 3", background: "radial-gradient(120% 90% at 50% 110%, #1b0f33 0%, #0a0518 70%)" }}>
        {/* district zones */}
        {DISTRICTS.map((d) => {
          const open = districtUnlocked(d, stars);
          const avgX = d.nodes.reduce((a, n) => a + n.x, 0) / d.nodes.length;
          const avgY = d.nodes.reduce((a, n) => a + n.y, 0) / d.nodes.length;
          return (
            <div key={d.id} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border text-center"
              style={{
                left: `${avgX * 100}%`, top: `${avgY * 100}%`,
                width: "44%", height: "44%",
                borderColor: open ? `${d.accent}55` : "rgba(255,255,255,0.08)",
                background: open ? `${d.accent}12` : "rgba(255,255,255,0.03)",
              }}>
              <span className="absolute left-1/2 top-1.5 -translate-x-1/2 whitespace-nowrap font-display text-[8px] font-black tracking-[0.18em]"
                style={{ color: open ? d.accent : "rgba(255,255,255,0.28)" }}>
                {open ? d.name.toUpperCase() : `LOCKED · ${d.requireStars}${STAR}`}
              </span>
            </div>
          );
        })}

        {/* shortcut links */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {SHORTCUTS.map((s) => {
            const from = DISTRICTS.find((d) => d.id === s.from);
            const to = DISTRICTS.find((d) => d.id === s.to);
            if (!from || !to) return null;
            const fx = from.nodes.reduce((a, n) => a + n.x, 0) / from.nodes.length * 100;
            const fy = from.nodes.reduce((a, n) => a + n.y, 0) / from.nodes.length * 100;
            const tx = to.nodes.reduce((a, n) => a + n.x, 0) / to.nodes.length * 100;
            const ty = to.nodes.reduce((a, n) => a + n.y, 0) / to.nodes.length * 100;
            const open = shortcutUnlocked(s, stars);
            return (
              <line key={s.id} x1={fx} y1={fy} x2={tx} y2={ty}
                stroke={open ? "rgba(253,224,71,0.7)" : "rgba(255,255,255,0.1)"}
                strokeWidth="0.7" strokeDasharray="2.4 2" />
            );
          })}
        </svg>

        {/* contract nodes */}
        {DISTRICTS.flatMap((d) =>
          d.nodes.map((n) => {
            const contract = contracts.find((c) => c.id === n.contractId);
            const got = stars[String(n.contractId)] ?? 0;
            const open = districtUnlocked(d, stars);
            return (
              <button key={n.contractId} disabled={!open} onClick={() => onStart(n.contractId)}
                className="btn-neon absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-2 disabled:opacity-45"
                style={{
                  left: `${n.x * 100}%`, top: `${n.y * 100}%`,
                  borderColor: got > 0 ? d.accent : "rgba(255,255,255,0.3)",
                  background: got >= 3 ? `${d.accent}44` : "rgba(6,2,16,0.9)",
                  boxShadow: got > 0 ? `0 0 12px ${d.accent}66` : "none",
                }}>
                <span className="font-display text-[8px] font-black leading-none text-white">{got > 0 ? STAR.repeat(got) : "?"}</span>
                <span className="mt-0.5 max-w-[46px] truncate text-[5px] leading-none text-white/60">{contract?.name ?? n.name}</span>
              </button>
            );
          })
        )}

        {/* HQ */}
        <button disabled={!hqUnlocked(stars)} onClick={() => { /* celebration only */ }}
          className="absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border px-3 py-1 font-display text-[8px] font-black tracking-[0.2em] disabled:opacity-40"
          style={{
            borderColor: hqUnlocked(stars) ? "#fde047" : "rgba(255,255,255,0.15)",
            color: hqUnlocked(stars) ? "#fde047" : "rgba(255,255,255,0.3)",
            background: "rgba(6,2,16,0.85)",
          }}>
          🏠 {HQ_CONTRACT.name.toUpperCase()} · {HQ_CONTRACT.requireStars}{STAR}
        </button>
      </div>

      {/* ---- district detail ---- */}
      <div className="flex flex-col gap-1.5">
        {DISTRICTS.map((d) => {
          const open = districtUnlocked(d, stars);
          const done = d.nodes.filter((n) => (stars[String(n.contractId)] ?? 0) > 0).length;
          return (
            <div key={d.id} className="rounded-xl border p-2.5" style={{ borderColor: open ? `${d.accent}44` : "rgba(255,255,255,0.08)", background: open ? `${d.accent}0a` : "rgba(255,255,255,0.02)" }}>
              <div className="flex items-center justify-between">
                <span className="font-display text-[10px] font-black tracking-widest" style={{ color: open ? d.accent : "rgba(255,255,255,0.35)" }}>
                  {d.name.toUpperCase()} {!open && "· LOCKED"}
                </span>
                <span className="text-[8px] text-white/45">{done}/{d.nodes.length} RUNS · {d.requireStars}{STAR} TO OPEN</span>
              </div>
              <p className="mt-1 text-[9px] leading-snug text-white/55">{d.blurb}</p>
            </div>
          );
        })}
        {SHORTCUTS.map((s) => {
          const open = shortcutUnlocked(s, stars);
          return (
            <div key={s.id} className="flex items-center justify-between rounded-xl border border-dashed px-2.5 py-1.5"
              style={{ borderColor: open ? "rgba(253,224,71,0.4)" : "rgba(255,255,255,0.08)" }}>
              <span className="font-display text-[9px] font-bold" style={{ color: open ? "#fde047" : "rgba(255,255,255,0.3)" }}>
                {open ? "⇄" : "🔒"} {s.name}
              </span>
              <span className="text-[8px] text-white/45">{s.from} ⇄ {s.to} · +{s.bonus} PAYOUT · {s.requireStars}{STAR}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
