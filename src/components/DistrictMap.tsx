import { useState } from "react";
import {
  DISTRICTS, SHORTCUTS, HQ_CONTRACT, districtUnlocked, totalStars, shortcutUnlocked, hqUnlocked,
  type DistrictDef,
} from "../game/districts";
import type { CareerContract } from "../game/features";
import { RouteThumbnail } from "./RoutePreview";

const STAR = "★";

/** Weather chip colors for the preview header. */
function weatherChip(w: CareerContract["weather"]): { label: string; color: string } {
  switch (w) {
    case "rain": return { label: "RAIN", color: "#38bdf8" };
    case "snow": return { label: "SNOW", color: "#7dd3fc" };
    case "sand": return { label: "SAND", color: "#fb923c" };
    case "fireflies": return { label: "FIREFLIES", color: "#fde047" };
    case "ash": return { label: "ASH", color: "#a3e635" };
    case "petals": return { label: "PETALS", color: "#f9a8d4" };
    default: return { label: "CLEAR", color: "#94a3b8" };
  }
}

/** One tappable contract row inside a district preview: animated route thumbnail + stats. */
function ContractPreviewRow({ contract, district, got, onStart, selected, onSelect }: {
  contract: CareerContract;
  district: DistrictDef;
  got: number;
  onStart: (id: number) => void;
  selected: boolean;
  onSelect: () => void;
}) {
  const chip = weatherChip(contract.weather);
  return (
    <button
      onClick={onSelect}
      className="btn-neon w-full rounded-xl border p-2 text-left transition-colors"
      style={{
        borderColor: selected ? district.accent : "rgba(255,255,255,0.1)",
        background: selected ? `${district.accent}14` : "rgba(0,0,0,0.3)",
        boxShadow: selected ? `0 0 14px ${district.accent}44` : "none",
      }}
    >
      <RouteThumbnail
        route={{
          name: contract.name,
          seed: contract.seed,
          traffic: contract.traffic,
          hazards: contract.hazards,
          weather: contract.weather,
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-display text-[10px] font-black tracking-wider text-white">
            {contract.name.toUpperCase()}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            <span className="rounded-full px-1.5 py-0.5 font-display text-[7px] font-bold"
              style={{ background: `${chip.color}22`, color: chip.color }}>
              {chip.label}
            </span>
            <span className="text-[8px] text-white/50">{contract.distance}m</span>
            {contract.timeLimit > 0 && <span className="text-[8px] text-white/50">· {contract.timeLimit}s</span>}
            {contract.minQuality > 0 && <span className="text-[8px] text-white/50">· {contract.minQuality}% intact</span>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-display text-[9px]" style={{ color: got > 0 ? district.accent : "rgba(255,255,255,0.4)" }}>
            {got > 0 ? STAR.repeat(got) : "☆☆☆"}
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onStart(contract.id); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onStart(contract.id); } }}
            className="btn-neon rounded-lg px-2.5 py-1 font-display text-[8px] font-black tracking-widest text-black"
            style={{ background: district.accent }}
          >
            RIDE
          </span>
        </div>
      </div>
    </button>
  );
}

export default function DistrictMap({ stars, contracts, onStart, accent }: {
  stars: Record<string, number>;
  contracts: CareerContract[];
  onStart: (contractId: number) => void;
  accent: string;
}) {
  const total = totalStars(stars);
  // district currently previewed in the panel under the map
  const [selId, setSelId] = useState<string | null>(null);
  // contract highlighted inside the preview panel
  const [selContract, setSelContract] = useState<number | null>(null);

  const sel = DISTRICTS.find((d) => d.id === selId) ?? null;
  const selOpen = sel ? districtUnlocked(sel, stars) : false;
  const selContracts = sel
    ? sel.nodes
        .map((n) => contracts.find((c) => c.id === n.contractId))
        .filter((c): c is CareerContract => Boolean(c))
    : [];
  const activeContract =
    selContracts.find((c) => c.id === selContract) ??
    selContracts.find((c) => (stars[String(c.id)] ?? 0) === 0) ??
    selContracts[0] ??
    null;

  const pickDistrict = (d: DistrictDef) => {
    setSelId((cur) => (cur === d.id ? null : d.id));
    setSelContract(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="font-display text-[10px] font-bold tracking-[0.24em] text-white/70">COURIER CITY MAP</div>
        <div className="flex items-center gap-2">
          {selId && (
            <button onClick={() => { setSelId(null); setSelContract(null); }}
              className="rounded-full border border-white/15 bg-black/40 px-2.5 py-1 font-display text-[8px] font-bold tracking-widest text-white/60">
              CLOSE PREVIEW
            </button>
          )}
          <div className="rounded-full px-2.5 py-1 font-display text-[10px] font-black" style={{ background: "rgba(255,255,255,0.08)", color: accent }}>
            {total} {STAR}
          </div>
        </div>
      </div>

      {/* ---- map canvas ---- */}
      <div className="relative overflow-hidden rounded-2xl border border-white/12" style={{ aspectRatio: "4 / 3", background: "radial-gradient(120% 90% at 50% 110%, #1b0f33 0%, #0a0518 70%)" }}>
        {/* district zones — tap to preview the district route below */}
        {DISTRICTS.map((d) => {
          const open = districtUnlocked(d, stars);
          const avgX = d.nodes.reduce((a, n) => a + n.x, 0) / d.nodes.length;
          const avgY = d.nodes.reduce((a, n) => a + n.y, 0) / d.nodes.length;
          const isSel = selId === d.id;
          return (
            <button key={d.id} onClick={() => pickDistrict(d)}
              className="btn-neon absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border text-center"
              style={{
                left: `${avgX * 100}%`, top: `${avgY * 100}%`,
                width: "44%", height: "44%",
                borderColor: isSel ? d.accent : open ? `${d.accent}55` : "rgba(255,255,255,0.08)",
                background: isSel ? `${d.accent}22` : open ? `${d.accent}12` : "rgba(255,255,255,0.03)",
                boxShadow: isSel ? `0 0 18px ${d.accent}55` : "none",
              }}
              aria-label={`Preview ${d.name}`}>
              <span className="absolute left-1/2 top-1.5 -translate-x-1/2 whitespace-nowrap font-display text-[8px] font-black tracking-[0.18em]"
                style={{ color: open ? d.accent : "rgba(255,255,255,0.28)" }}>
                {open ? d.name.toUpperCase() : `LOCKED · ${d.requireStars}${STAR}`}
              </span>
              <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap font-display text-[7px] tracking-[0.2em] text-white/40">
                {isSel ? "PREVIEWING" : "TAP TO PREVIEW"}
              </span>
            </button>
          );
        })}

        {/* shortcut links */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
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

        {/* contract nodes — tap to open the district preview with that contract highlighted */}
        {DISTRICTS.flatMap((d) =>
          d.nodes.map((n) => {
            const contract = contracts.find((c) => c.id === n.contractId);
            const got = stars[String(n.contractId)] ?? 0;
            const open = districtUnlocked(d, stars);
            const isSel = selId === d.id && selContract === n.contractId;
            return (
              <button key={n.contractId} disabled={!open}
                onClick={() => { setSelId(d.id); setSelContract(n.contractId); }}
                className="btn-neon absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-2 disabled:opacity-45"
                style={{
                  left: `${n.x * 100}%`, top: `${n.y * 100}%`,
                  borderColor: isSel ? "#ffffff" : got > 0 ? d.accent : "rgba(255,255,255,0.3)",
                  background: got >= 3 ? `${d.accent}44` : "rgba(6,2,16,0.9)",
                  boxShadow: isSel ? `0 0 16px ${d.accent}` : got > 0 ? `0 0 12px ${d.accent}66` : "none",
                }}
                aria-label={`Preview contract ${contract?.name ?? n.name}`}>
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

      {/* ---- world preview panel ---- */}
      {sel && (
        <div className="pop-in flex flex-col gap-2 rounded-2xl border p-3"
          style={{ borderColor: `${sel.accent}55`, background: `linear-gradient(160deg, ${sel.accent}0f 0%, rgba(0,0,0,0.45) 60%)` }}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-display text-xs font-black tracking-[0.2em]" style={{ color: sel.accent }}>
                {sel.name.toUpperCase()}
              </div>
              <p className="mt-0.5 text-[9px] leading-snug text-white/55">{sel.blurb}</p>
            </div>
            <span className="shrink-0 rounded-full px-2 py-1 font-display text-[8px] font-black"
              style={{
                background: selOpen ? `${sel.accent}22` : "rgba(255,255,255,0.06)",
                color: selOpen ? sel.accent : "rgba(255,255,255,0.4)",
              }}>
              {selOpen ? "UNLOCKED" : `LOCKED · ${sel.requireStars}${STAR}`}
            </span>
          </div>

          {selOpen ? (
            <>
              <div className="mt-1 font-display text-[8px] font-bold tracking-[0.24em] text-white/45">
                ROUTE PREVIEWS · TAP A CARD, THEN RIDE
              </div>
              <div className="flex flex-col gap-2">
                {selContracts.map((c) => (
                  <ContractPreviewRow
                    key={c.id}
                    contract={c}
                    district={sel}
                    got={stars[String(c.id)] ?? 0}
                    selected={activeContract?.id === c.id}
                    onSelect={() => setSelContract(c.id)}
                    onStart={onStart}
                  />
                ))}
              </div>
              {activeContract && (
                <button
                  onClick={() => onStart(activeContract.id)}
                  className="btn-neon mt-1 rounded-xl py-2.5 font-display text-xs font-black tracking-widest text-black"
                  style={{ background: sel.accent }}>
                  ▶ START · {activeContract.name.toUpperCase()}
                </button>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/30 p-2.5 text-[9px] text-white/50">
              Earn <span className="font-black text-white/80">{sel.requireStars} stars</span>
              {sel.requires.length > 0 && (
                <> and clear at least one run in <span className="font-black text-white/80">{sel.requires.join(" + ")}</span></>
              )}{" "}
              to open this district.
            </div>
          )}
        </div>
      )}

      {/* ---- district detail list ---- */}
      <div className="flex flex-col gap-1.5">
        {DISTRICTS.map((d) => {
          const open = districtUnlocked(d, stars);
          const done = d.nodes.filter((n) => (stars[String(n.contractId)] ?? 0) > 0).length;
          const isSel = selId === d.id;
          return (
            <button key={d.id} onClick={() => pickDistrict(d)}
              className="rounded-xl border p-2.5 text-left"
              style={{
                borderColor: isSel ? d.accent : open ? `${d.accent}44` : "rgba(255,255,255,0.08)",
                background: open ? `${d.accent}0a` : "rgba(255,255,255,0.02)",
              }}>
              <div className="flex items-center justify-between">
                <span className="font-display text-[10px] font-black tracking-widest" style={{ color: open ? d.accent : "rgba(255,255,255,0.35)" }}>
                  {d.name.toUpperCase()} {!open && "· LOCKED"}
                </span>
                <span className="text-[8px] text-white/45">{done}/{d.nodes.length} RUNS · {d.requireStars}{STAR} TO OPEN</span>
              </div>
              <p className="mt-1 text-[9px] leading-snug text-white/55">{d.blurb}</p>
            </button>
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
