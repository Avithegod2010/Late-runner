/* ================================================================
   Custom animated SVG icon set — replaces system emoji everywhere
   ================================================================ */

type P = { className?: string; size?: number };

const base = (size = 24) => ({
  width: size,
  height: size,
  viewBox: "0 0 48 48",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
});

/* ---- Coin: flips on its vertical axis ---- */
export const CoinIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <g className="ico-flip">
      <circle cx="24" cy="24" r="17" fill="#b8860b" />
      <circle cx="24" cy="24" r="14" fill="url(#coinG)" />
      <circle cx="24" cy="24" r="10.5" fill="#ffe680" />
      <path d="M24 14v20M28.5 18.5c0-2-2-3.5-4.5-3.5s-4.5 1.3-4.5 3.3 1.8 2.9 4.5 3.6 4.8 1.7 4.8 4-2.2 3.8-4.8 3.8-4.8-1.6-4.8-3.6" stroke="#b8860b" strokeWidth="2.6" strokeLinecap="round" />
    </g>
    <defs>
      <linearGradient id="coinG" x1="10" y1="10" x2="38" y2="38">
        <stop stopColor="#ffd700" />
        <stop offset="1" stopColor="#f0a500" />
      </linearGradient>
    </defs>
  </svg>
);

/* ---- Speedometer: needle sweeps ---- */
export const SpeedIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <path d="M7 34a19 19 0 1 1 34 0" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.35" />
    <path d="M7 34a19 19 0 0 1 9-16.2" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    <g className="ico-needle">
      <path d="M24 34 32 18" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" />
    </g>
    <circle cx="24" cy="34" r="4" fill="currentColor" />
  </svg>
);

/* ---- Bike: wheels spin, frame bobs ---- */
export const BikeIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <g className="ico-bob">
      <circle cx="12" cy="33" r="9" stroke="currentColor" strokeWidth="3" />
      <circle cx="36" cy="33" r="9" stroke="currentColor" strokeWidth="3" />
      <g className="ico-wheel" style={{ transformOrigin: "12px 33px" }}>
        <path d="M12 24v18M3 33h18M5.6 26.6l12.8 12.8M18.4 26.6 5.6 39.4" stroke="currentColor" strokeWidth="1.6" opacity="0.65" />
      </g>
      <g className="ico-wheel" style={{ transformOrigin: "36px 33px" }}>
        <path d="M36 24v18M27 33h18M29.6 26.6l12.8 12.8M42.4 26.6 29.6 39.4" stroke="currentColor" strokeWidth="1.6" opacity="0.65" />
      </g>
      <path d="m12 33 8-12h10l-6 12M20 21h8M36 33l-6-12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="31" cy="11" r="4.2" fill="currentColor" />
    </g>
  </svg>
);

/* ---- Helmet visor glints as a garage preview ---- */
export const HelmetIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <path d="M7 29c0-13 7-21 18-21 9 0 16 6 18 15H26v10H10c-2 0-3-2-3-4z" fill="currentColor" />
    <path d="M26 20h15c1 0 2 1 2 3v4H26z" fill="#bfe8ff" opacity="0.9" />
    <path className="ico-shine" d="M13 15h5" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.75" />
  </svg>
);

/* ---- Jacket zipper zips up/down ---- */
export const JacketIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <path d="m15 12 9-5 9 5 7 12-5 17H13L8 24z" fill="currentColor" />
    <path d="M24 8v33" stroke="rgba(255,255,255,0.8)" strokeWidth="2.5" strokeDasharray="2 2" />
    <path d="m15 12-5 9M33 12l5 9" stroke="rgba(255,255,255,0.65)" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

/* ---- Oncoming car with flashing headlights ---- */
export const CarIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <rect x="9" y="14" width="30" height="27" rx="7" fill="currentColor" />
    <path d="M14 20h20l-2.5 7h-15z" fill="#bfe8ff" />
    <rect x="15" y="31" width="18" height="4" rx="2" fill="rgba(0,0,0,0.35)" />
    <g className="ico-blink">
      <circle cx="14" cy="37" r="3.2" fill="#fff6c0" />
      <circle cx="34" cy="37" r="3.2" fill="#fff6c0" />
    </g>
  </svg>
);

/* ---- Trophy with sweeping shine ---- */
export const TrophyIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <path d="M14 8h20v12a10 10 0 0 1-20 0z" fill="url(#tG)" />
    <path d="M14 11H9a6 6 0 0 0 6 6M34 11h5a6 6 0 0 1-6 6" stroke="url(#tG)" strokeWidth="3" />
    <path d="M21 30h6v5h-6z" fill="#c98a1a" />
    <rect x="15" y="35" width="18" height="5" rx="2.5" fill="url(#tG)" />
    <g className="ico-shine">
      <rect x="10" y="4" width="5" height="34" fill="rgba(255,255,255,0.55)" transform="rotate(18 12 20)" />
    </g>
    <defs>
      <linearGradient id="tG" x1="12" y1="8" x2="36" y2="38">
        <stop stopColor="#ffe066" />
        <stop offset="1" stopColor="#f59e0b" />
      </linearGradient>
    </defs>
  </svg>
);

/* ---- Medals ---- */
export const MedalIcon = ({ rank, size = 22 }: { rank: number; size?: number }) => {
  const cols: [string, string][] = [
    ["#ffe066", "#f59e0b"],
    ["#e2e8f0", "#94a3b8"],
    ["#f0b27a", "#b45309"],
  ];
  const c = cols[rank] ?? ["#7c6f9e", "#4c4269"];
  return (
    <svg {...base(size)} className={rank === 0 ? "ico ico-wobble" : "ico"}>
      <path d="M16 6 24 22 32 6" stroke={c[1]} strokeWidth="5" strokeLinecap="round" />
      <circle cx="24" cy="32" r="12" fill={`url(#m${rank})`} />
      <circle cx="24" cy="32" r="8.5" fill="rgba(0,0,0,0.12)" />
      <text x="24" y="37" textAnchor="middle" fontSize="13" fontWeight="900" fill={c[1]} fontFamily="Orbitron, monospace">
        {rank + 1}
      </text>
      <defs>
        <linearGradient id={`m${rank}`} x1="12" y1="20" x2="36" y2="44">
          <stop stopColor={c[0]} />
          <stop offset="1" stopColor={c[1]} />
        </linearGradient>
      </defs>
    </svg>
  );
};

/* ---- Flame (combo) ---- */
export const FlameIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <g className="ico-flicker">
      <path d="M24 4c3 8-6 10-6 17a9 9 0 0 0 18 0c0-3-1-5-2-7 5 4 8 9 8 15a14 14 0 1 1-28 0C14 18 24 16 24 4z" fill="url(#fG)" />
      <path d="M24 26c2 4-3 5-3 9a5 5 0 0 0 10 0c0-4-5-6-7-9z" fill="#fff3b0" />
    </g>
    <defs>
      <linearGradient id="fG" x1="24" y1="4" x2="24" y2="44">
        <stop stopColor="#ffd166" />
        <stop offset="0.5" stopColor="#ff7a18" />
        <stop offset="1" stopColor="#ef4444" />
      </linearGradient>
    </defs>
  </svg>
);

/* ---- Controls ---- */
export const PauseIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <rect x="13" y="10" width="8" height="28" rx="3" fill="currentColor" />
    <rect x="27" y="10" width="8" height="28" rx="3" fill="currentColor" />
  </svg>
);

export const PlayIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <path d="M16 10.5 38 24 16 37.5z" fill="currentColor" strokeLinejoin="round" strokeWidth="4" stroke="currentColor" />
  </svg>
);

export const RestartIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <g className="ico-spin-slow">
      <path d="M40 24a16 16 0 1 1-5.2-11.8" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M37 4v10H27" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </svg>
);

export const HomeIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <path d="M7 22 24 8l17 14" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 22v16h24V22" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const SoundOnIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <path d="M10 19h7l10-8v26l-10-8h-7z" fill="currentColor" />
    <g className="ico-waves">
      <path d="M32 18a9 9 0 0 1 0 12" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M37 13a16 16 0 0 1 0 22" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    </g>
  </svg>
);

export const SoundOffIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <path d="M10 19h7l10-8v26l-10-8h-7z" fill="currentColor" />
    <path d="M32 19l10 10M42 19 32 29" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
  </svg>
);

export const GearIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <g className="ico-spin-slow">
      <path
        d="M24 6l2.6 4.7 5.3-1 .9 5.3 4.8 2.4-2.6 4.7 2.6 4.7-4.8 2.4-.9 5.3-5.3-1L24 38l-2.6-4.5-5.3 1-.9-5.3L10.4 27 13 22.3l-2.6-4.7 4.8-2.4.9-5.3 5.3 1z"
        fill="currentColor"
      />
    </g>
    <circle cx="24" cy="22" r="6" fill="#140a2e" />
  </svg>
);

export const PaletteIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <path d="M24 6c10 0 18 7 18 16 0 6-5 8-9 8h-3c-2 0-4 1-4 3.5 0 1.5 1 2.5 1 4 0 2.5-1.5 4.5-4 4.5C13 42 6 34 6 23 6 13 14 6 24 6z" fill="currentColor" opacity="0.28" />
    <circle className="ico-pulse-a" cx="16" cy="18" r="3.4" fill="#ff4da6" />
    <circle className="ico-pulse-b" cx="24" cy="13" r="3.4" fill="#ffe066" />
    <circle className="ico-pulse-c" cx="32" cy="18" r="3.4" fill="#38bdf8" />
    <circle className="ico-pulse-b" cx="15" cy="28" r="3.4" fill="#4ade80" />
  </svg>
);

/* ---- Tutorial icons ---- */
export const SteerIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <g className="ico-nudge-l">
      <path d="M17 14 7 24l10 10" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </g>
    <g className="ico-nudge-r">
      <path d="M31 14 41 24 31 34" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </g>
    <rect x="21" y="20" width="6" height="8" rx="3" fill="currentColor" opacity="0.6" />
  </svg>
);

export const SwipeIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <g className="ico-swipe">
      <path d="M22 40V20a3 3 0 0 1 6 0v8m0-3a3 3 0 0 1 6 0v3m0-1a3 3 0 0 1 6 0v10c0 6-4 10-10 10h-3c-4 0-6-2-8-6l-4-8a3 3 0 0 1 5-3l2 3" fill="currentColor" />
    </g>
    <path d="M8 14h8M32 14h8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
  </svg>
);

export const JumpIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <path d="M6 40h36" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" opacity="0.5" />
    <path d="M10 34c4-16 24-16 28 0" stroke="currentColor" strokeWidth="2.5" strokeDasharray="3 4" opacity="0.6" />
    <g className="ico-hop">
      <circle cx="24" cy="16" r="6" fill="currentColor" />
      <path d="M18 24h12l-3 8h-6z" fill="currentColor" />
    </g>
  </svg>
);

export const WarningIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <g className="ico-blink">
      <path d="M24 6 44 40H4z" fill="#fbbf24" stroke="#78350f" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="21.5" y="17" width="5" height="12" rx="2.5" fill="#78350f" />
      <circle cx="24" cy="34" r="2.8" fill="#78350f" />
    </g>
  </svg>
);

export const ConeIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <ellipse cx="24" cy="40" rx="16" ry="4" fill="currentColor" opacity="0.3" />
    <path d="M24 6 36 40H12z" fill="#ff7a18" />
    <path d="M18.5 23h11l1.6 5H16.9z" fill="#fff" />
    <rect x="8" y="38" width="32" height="5" rx="2.5" fill="#ff7a18" />
  </svg>
);

export const SkullIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <g className="ico-wobble">
      <path d="M24 5c10 0 17 7 17 16 0 5-2 9-5 11v6a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3v-6c-3-2-5-6-5-11C7 12 14 5 24 5z" fill="currentColor" />
      <circle cx="17" cy="22" r="5" fill="#2b0d22" />
      <circle cx="31" cy="22" r="5" fill="#2b0d22" />
      <path d="M21 33h6M19 38v3M29 38v3" stroke="#2b0d22" strokeWidth="3" strokeLinecap="round" />
    </g>
  </svg>
);

export const RulerIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <rect x="5" y="17" width="38" height="14" rx="3" stroke="currentColor" strokeWidth="3.5" />
    <path d="M13 17v6M21 17v9M29 17v6M37 17v9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

/* ================= power-ups ================= */

export const NitroIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <rect x="16" y="8" width="16" height="26" rx="7" fill="#f97316" />
    <rect x="21" y="4" width="6" height="6" rx="2" fill="#e2e8f0" />
    <rect x="19" y="14" width="10" height="4" rx="2" fill="rgba(255,255,255,0.8)" />
    <g className="ico-flicker">
      <path d="M24 34c4 4 7 7 7 11a7 7 0 0 1-14 0c0-4 3-7 7-11z" fill="#fbbf24" />
      <path d="M24 39c2 2 3 4 3 6a3 3 0 0 1-6 0c0-2 1-4 3-6z" fill="#fff7cc" />
    </g>
  </svg>
);

export const MagnetIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <path d="M12 34V22a12 12 0 0 1 24 0v12" stroke="#22d3ee" strokeWidth="9" fill="none" />
    <rect x="7" y="32" width="11" height="9" fill="#e2e8f0" />
    <rect x="30" y="32" width="11" height="9" fill="#e2e8f0" />
    <g className="ico-pulse-a">
      <circle cx="24" cy="20" r="18" stroke="#67e8f9" strokeWidth="2" fill="none" opacity="0.6" />
    </g>
  </svg>
);

export const ShieldIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <path d="M24 5 41 12v13c0 10-7 17-17 21C14 42 7 35 7 25V12z" fill="url(#shG)" />
    <path d="M24 11v26" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
    <g className="ico-shine">
      <rect x="12" y="2" width="5" height="44" fill="rgba(255,255,255,0.4)" transform="rotate(14 14 24)" />
    </g>
    <defs>
      <linearGradient id="shG" x1="7" y1="5" x2="41" y2="46">
        <stop stopColor="#a5f3fc" />
        <stop offset="1" stopColor="#2563eb" />
      </linearGradient>
    </defs>
  </svg>
);

export const ClockIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <circle cx="24" cy="26" r="17" stroke="currentColor" strokeWidth="4" fill="none" />
    <path d="M18 5h12" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    <g className="ico-spin-slow" style={{ transformOrigin: "24px 26px" }}>
      <path d="M24 26V15" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    </g>
    <path d="M24 26h8" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
  </svg>
);

export const StuntIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <g className="ico-spin-slow">
      <path d="M10 24a14 14 0 1 1 5 10.7" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M8 36l7-2 1 7" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </g>
    <circle cx="24" cy="24" r="5" fill="currentColor" />
  </svg>
);

export const RampIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <path d="M4 40h40" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" opacity="0.5" />
    <path d="M8 40 36 18v22z" fill="currentColor" opacity="0.85" />
    <g className="ico-hop">
      <circle cx="34" cy="10" r="6" fill="#fbbf24" />
    </g>
  </svg>
);

export const TunnelIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <path d="M6 42V26a18 18 0 0 1 36 0v16" stroke="currentColor" strokeWidth="4" fill="none" />
    <path d="M15 42V27a9 9 0 0 1 18 0v15" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.6" />
    <g className="ico-blink">
      <circle cx="24" cy="30" r="4" fill="#fde68a" />
    </g>
  </svg>
);

export const PoliceIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <rect x="7" y="22" width="34" height="18" rx="6" fill="#e2e8f0" />
    <path d="M12 26h24l-2 7H14z" fill="#334155" />
    <g className="ico-blink">
      <rect x="15" y="13" width="8" height="7" rx="3" fill="#3b82f6" />
    </g>
    <g className="ico-blink" style={{ animationDelay: "0.37s" }}>
      <rect x="25" y="13" width="8" height="7" rx="3" fill="#ef4444" />
    </g>
  </svg>
);

/* ================= meta ================= */

export const ShopIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <path d="M8 16h32l-3 24H11z" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" fill="none" />
    <path d="M17 20v-5a7 7 0 0 1 14 0v5" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
  </svg>
);

export const MissionIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <rect x="9" y="7" width="30" height="36" rx="5" stroke="currentColor" strokeWidth="4" fill="none" />
    <path d="M16 19l3.5 3.5L26 16" stroke="#4ade80" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 31l3.5 3.5L26 28" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
    <path d="M30 20h4M30 32h4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
  </svg>
);

export const LevelIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <path d="M24 4l6 12 13 2-9.5 9 2.3 13L24 34l-11.8 6 2.3-13L5 18l13-2z" fill="url(#lvG)" />
    <defs>
      <linearGradient id="lvG" x1="5" y1="4" x2="43" y2="40">
        <stop stopColor="#ffe066" />
        <stop offset="1" stopColor="#f97316" />
      </linearGradient>
    </defs>
  </svg>
);

export const CalendarIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <rect x="6" y="11" width="36" height="32" rx="5" stroke="currentColor" strokeWidth="4" fill="none" />
    <path d="M6 20h36M16 5v9M32 5v9" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    <g className="ico-pulse-a">
      <rect x="20" y="26" width="8" height="8" rx="2" fill="#4ade80" />
    </g>
  </svg>
);

export const ShareIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <circle cx="36" cy="11" r="6" fill="currentColor" />
    <circle cx="12" cy="24" r="6" fill="currentColor" />
    <circle cx="36" cy="37" r="6" fill="currentColor" />
    <path d="m18 21 12-7M18 27l12 7" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
  </svg>
);

export const GhostIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <g className="ico-bob">
      <path d="M9 42V22a15 15 0 0 1 30 0v20l-5-4-5 4-5-4-5 4-5-4z" fill="currentColor" opacity="0.85" />
      <circle cx="18" cy="22" r="3.4" fill="#140a2e" />
      <circle cx="30" cy="22" r="3.4" fill="#140a2e" />
    </g>
  </svg>
);

export const CameraIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <rect x="5" y="14" width="38" height="27" rx="6" stroke="currentColor" strokeWidth="4" fill="none" />
    <path d="M18 14l3-6h6l3 6" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" fill="none" />
    <circle cx="24" cy="28" r="8" stroke="currentColor" strokeWidth="4" fill="none" />
  </svg>
);

export const HornIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <path d="M8 20h8l14-10v28L16 28H8z" fill="currentColor" />
    <g className="ico-waves">
      <path d="M35 18a9 9 0 0 1 0 12" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M40 13a16 16 0 0 1 0 22" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    </g>
  </svg>
);

export const ZenIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="3.5" fill="none" opacity="0.45" />
    <path d="M6 24a18 18 0 0 0 36 0" stroke="currentColor" strokeWidth="3.5" fill="none" />
    <g className="ico-bob">
      <circle cx="24" cy="24" r="5" fill="currentColor" />
    </g>
  </svg>
);

export const TimerIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <path d="M12 6h24L26 24l10 18H12l10-18z" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" fill="none" />
    <g className="ico-flicker">
      <path d="M18 36h12l-6-9z" fill="currentColor" />
    </g>
  </svg>
);

export const LockIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <rect x="10" y="21" width="28" height="21" rx="5" fill="currentColor" />
    <path d="M16 21v-6a8 8 0 0 1 16 0v6" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
    <circle cx="24" cy="31" r="3" fill="#140a2e" />
  </svg>
);

export const CheckIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <path d="M10 25l9 9 19-20" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

export const XIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <path d="M12 12l24 24M36 12 12 36" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
  </svg>
);

export const InstallIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <path d="M24 6v24" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
    <path d="m14 22 10 10 10-10" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M8 38h32" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
  </svg>
);

export const GamepadIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <rect x="4" y="16" width="40" height="20" rx="10" stroke="currentColor" strokeWidth="4" fill="none" />
    <path d="M13 22v8M9 26h8" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    <circle cx="33" cy="23" r="2.6" fill="currentColor" />
    <circle cx="38" cy="29" r="2.6" fill="currentColor" />
  </svg>
);

export const SparkleIcon = ({ className = "", size = 24 }: P) => (
  <svg {...base(size)} className={`ico ${className}`}>
    <g className="ico-pulse-a">
      <path d="M24 6l3.5 10.5L38 20l-10.5 3.5L24 34l-3.5-10.5L10 20l10.5-3.5z" fill="currentColor" />
    </g>
    <g className="ico-pulse-c">
      <path d="M36 30l1.8 5.2L43 37l-5.2 1.8L36 44l-1.8-5.2L29 37l5.2-1.8z" fill="currentColor" opacity="0.8" />
    </g>
  </svg>
);
