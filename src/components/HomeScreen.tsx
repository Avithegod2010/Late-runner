import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Difficulty, Mode, Settings } from "../game/engine";
import type { Theme } from "../game/themes";
import type { Mission, Profile } from "../game/progression";
import { ALL_SHOP, BIKES, HELMETS, getChoice } from "../game/garage";
import { todayKey } from "../game/rng";
import { t, type I18nKey } from "../game/i18n";
import HeroRider from "./HeroRider";
import {
  BikeIcon, CalendarIcon, CarIcon, CheckIcon, CoinIcon, FlameIcon, GearIcon,
  InstallIcon, MissionIcon, PlayIcon, RulerIcon, ShieldIcon, ShopIcon, SoundOffIcon,
  SoundOnIcon, SparkleIcon, TrophyIcon, XIcon,
} from "./Icons";

export type HomePanel =
  | "shop" | "garage" | "upgrades" | "missions" | "ranks" | "route"
  | "fieldguide" | "replay" | "photo" | "settings" | "profile" | "career";

export interface ModeDef { id: Mode; name: string; desc: string; icon: ReactNode }

interface Props {
  profile: Profile;
  settings: Settings;
  theme: Theme;
  accent: string;
  level: number;
  levelInto: number;
  levelNeed: number;
  title: string;
  multiplier: number;
  missions: Mission[];
  best: number;
  muted: boolean;
  modes: ModeDef[];
  diffs: { id: Difficulty; name: string; desc: string }[];
  cupNames: [string, string];
  installAvailable: boolean;
  weekly: { used: number; best: number; attempts: number; mods: string };
  careerDone: number;
  careerTotal: number;
  /** active seasonal event (calendar month) shown under the logo */
  season: { name: string; tagline: string; accent: string } | null;
  onPlay: () => void;
  onOpenPanel: (p: HomePanel) => void;
  onToggleMute: () => void;
  onCycleBike: (dir: number) => void;
  onSelectMode: (m: Mode) => void;
  onSelectDifficulty: (d: Difficulty) => void;
  onCupName: (i: 0 | 1, v: string) => void;
  onInstall: () => void;
  onPokeRider: () => void;
  onUi: () => void;
}

/* ---------------- wall tile ---------------- */

function WallTile({
  icon, label, sub, onClick, gradient, badge, big = false, glow,
}: {
  icon: ReactNode;
  label: string;
  sub?: string;
  onClick: () => void;
  gradient: string;
  badge?: string | number | null;
  big?: boolean;
  glow?: string;
}) {
  return (
    <button
      onClick={onClick}
      data-tile
      className={`btn-neon tile-shine relative flex w-[68px] flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border border-white/20 text-white sm:w-[118px] ${big ? "h-[92px] sm:h-[124px]" : "h-[58px] sm:h-[76px]"}`}
      style={{
        background: gradient,
        boxShadow: `0 5px 0 rgba(0,0,0,0.45), 0 0 22px ${glow ?? "rgba(0,0,0,0)"}`,
      }}
    >
      <span className={big ? "scale-125 sm:scale-150" : "sm:scale-110"}>{icon}</span>
      <span className={`font-display font-black tracking-wider drop-shadow ${big ? "text-[10px] sm:text-sm" : "text-[8px] sm:text-[10px]"}`}>
        {label}
      </span>
      {sub && <span className="hidden max-w-full truncate px-1 text-[8px] font-medium text-white/80 sm:block">{sub}</span>}
      {badge !== undefined && badge !== null && badge !== 0 && badge !== "" && (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff3b5c] px-1 font-display text-[8px] font-black text-white shadow ring-2 ring-white/70">
          {badge}
        </span>
      )}
    </button>
  );
}

function TopChip({ children, onClick, title }: { children: ReactNode; onClick?: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="btn-neon flex h-9 items-center gap-1.5 rounded-xl border border-white/15 bg-black/55 px-2.5 backdrop-blur-md sm:h-10"
    >
      {children}
    </button>
  );
}

function IconBtn({ children, onClick, label }: { children: ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="btn-neon flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-black/55 text-white backdrop-blur-md sm:h-10 sm:w-10"
    >
      {children}
    </button>
  );
}

/* ================================================================ */

export default function HomeScreen(props: Props) {
  const {
    profile, settings, theme, accent, level, levelInto, levelNeed, title, multiplier,
    missions, best, muted, modes, diffs, cupNames, installAvailable,
  } = props;
  const [modeSheet, setModeSheet] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const lang = settings.lang;
  /** translated label with English fallback */
  const tr = (key: I18nKey, fallback?: string) => t(lang, key, fallback);

  // keyboard path: arrow keys walk focus across wall tiles and the Play button
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modeSheet) return;
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
      const active = document.activeElement as HTMLElement | null;
      // never steal arrows from form fields or from an open dialog layered above the home screen
      if (active && (/^(INPUT|SELECT|TEXTAREA)$/.test(active.tagName) || active.closest("[role=dialog]"))) return;
      if (document.querySelector("[role=dialog]")) return;
      const tiles = Array.from(rootRef.current?.querySelectorAll<HTMLElement>("[data-tile]") ?? []);
      if (!tiles.length) return;
      e.preventDefault();
      const cur = tiles.indexOf(document.activeElement as HTMLElement);
      if (cur < 0) { tiles[0].focus(); return; }
      const r0 = tiles[cur].getBoundingClientRect();
      const cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
      let best = -1, bestD = Infinity;
      tiles.forEach((t, i) => {
        if (i === cur) return;
        const r = t.getBoundingClientRect();
        const dx = r.left + r.width / 2 - cx, dy = r.top + r.height / 2 - cy;
        const ok = e.key === "ArrowUp" ? dy < -4 : e.key === "ArrowDown" ? dy > 4 : e.key === "ArrowLeft" ? dx < -4 : dx > 4;
        if (!ok) return;
        const primary = e.key === "ArrowUp" || e.key === "ArrowDown" ? Math.abs(dy) : Math.abs(dx);
        const secondary = e.key === "ArrowUp" || e.key === "ArrowDown" ? Math.abs(dx) : Math.abs(dy);
        const d = primary + secondary * 2.5;
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best >= 0) tiles[best].focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modeSheet]);

  const helmet = getChoice(HELMETS, settings.helmetId);
  const bike = getChoice(BIKES, settings.bikeId);
  const ownedBikes = BIKES.filter((b) => profile.owned.includes(b.id)).length;
  const currentMode = modes.find((m) => m.id === settings.mode) ?? modes[0];
  const showDifficulty = settings.mode !== "daily" && settings.mode !== "zen";
  const diffName = diffs.find((d) => d.id === settings.difficulty)?.name ?? "Normal";

  const affordable = useMemo(
    () => ALL_SHOP.flatMap((g) => g.items).filter((i) => !profile.owned.includes(i.id) && i.price <= profile.wallet).length,
    [profile.owned, profile.wallet]
  );
  const missionsDone = missions.filter((m) => (profile.missionProgress[m.id] ?? 0) >= m.target).length;
  const nextMission = missions.find((m) => (profile.missionProgress[m.id] ?? 0) < m.target);
  const nextProg = nextMission ? Math.min(profile.missionProgress[nextMission.id] ?? 0, nextMission.target) : 0;
  const dailyBest = profile.daily[todayKey()] ?? 0;
  const guideSeen = Object.values(profile.vehicleSightings).filter((v) => v > 0).length;
  const guideClaimable = [3, 6, 9].filter((n) => guideSeen >= n && !profile.claimedGuideTiers.includes(n)).length;

  const open = (p: HomePanel) => { props.onUi(); props.onOpenPanel(p); };

  return (
    <div ref={rootRef} className="fade-in absolute inset-0 z-20 flex flex-col overflow-hidden">
      {/* scene grading: dark edges, open centre so the live road reads behind the podium */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(8,3,16,0.82) 0%, rgba(8,3,16,0.25) 22%, rgba(8,3,16,0.05) 50%, rgba(8,3,16,0.55) 78%, rgba(8,3,16,0.92) 100%), " +
            "linear-gradient(90deg, rgba(8,3,16,0.7) 0%, rgba(8,3,16,0) 24%, rgba(8,3,16,0) 76%, rgba(8,3,16,0.7) 100%)",
        }}
      />

      {/* ================= TOP BAR ================= */}
      <div className="relative z-20 flex items-center justify-between gap-2 px-2.5 pt-[max(0.6rem,env(safe-area-inset-top))] sm:px-4">
        <button
          onClick={() => open("profile")}
          className="btn-neon flex min-w-0 items-center gap-2 rounded-2xl border border-white/15 bg-black/55 py-1 pl-1 pr-3 backdrop-blur-md"
        >
          <span
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-2 ring-white/80 sm:h-10 sm:w-10"
            style={{ background: `conic-gradient(${helmet.colors[0]}, ${helmet.colors[1]}, ${helmet.colors[0]})` }}
          >
            <span className="font-display text-sm font-black text-white drop-shadow">{level}</span>
          </span>
          <span className="min-w-0 text-left">
            <span className="block truncate font-display text-[10px] font-black text-white sm:text-xs">{settings.plateText || "RIDER"}</span>
            <span className="block truncate text-[8px] text-white/60 sm:text-[9px]">{title}</span>
            <span className="mt-0.5 block h-1 w-16 overflow-hidden rounded-full bg-white/15 sm:w-24">
              <span className="block h-full rounded-full" style={{ width: `${(levelInto / levelNeed) * 100}%`, background: accent }} />
            </span>
          </span>
        </button>

        <div className="flex items-center gap-1.5">
          <TopChip onClick={() => open("shop")} title="Coins — open shop">
            <CoinIcon size={18} />
            <span className="font-display text-xs font-black text-yellow-300 sm:text-sm">{profile.wallet.toLocaleString()}</span>
            <span className="flex h-4 w-4 items-center justify-center rounded-md bg-emerald-500 font-display text-[10px] font-black text-white">+</span>
          </TopChip>
          <span className="hidden sm:block">
            <TopChip onClick={() => open("missions")} title="Rescue tickets">
              <ShieldIcon size={16} />
              <span className="font-display text-xs font-black text-cyan-200">{profile.rescueTickets}/3</span>
            </TopChip>
          </span>
          {profile.hotStreak > 0 && (
            <TopChip onClick={() => open("profile")} title="Hot streak: beat your last score to keep it">
              <FlameIcon size={16} />
              <span className="font-display text-xs font-black text-orange-300">×{profile.hotStreak}</span>
            </TopChip>
          )}
          {profile.crates > 0 && (
            <TopChip onClick={() => open("upgrades")} title="Unopened crates">
              <SparkleIcon size={16} />
              <span className="font-display text-xs font-black text-fuchsia-200">{profile.crates}</span>
            </TopChip>
          )}
          {installAvailable && (
            <IconBtn label="Install" onClick={() => { props.onUi(); props.onInstall(); }}>
              <InstallIcon size={18} />
            </IconBtn>
          )}
          <IconBtn label="Sound" onClick={props.onToggleMute}>
            {muted ? <SoundOffIcon size={18} /> : <SoundOnIcon size={18} />}
          </IconBtn>
          <IconBtn label="Settings" onClick={() => open("settings")}>
            <GearIcon size={18} />
          </IconBtn>
        </div>
      </div>

      {/* ================= STAGE ================= */}
      <div className="relative z-10 min-h-0 flex-1">
        <HeroRider settings={settings} theme={theme} onPoke={props.onPokeRider} />

        {/* logo + active seasonal event */}
        <div className="pointer-events-none absolute inset-x-0 top-1 flex flex-col items-center sm:top-3">
          <h1 className="title-glow font-display text-center text-2xl font-black leading-[0.9] text-[#ff4da6] sm:text-5xl">
            WRONG WAY<br /><span className="text-[#ffe066]">RIDER</span>
          </h1>
          <div className="mt-1 rounded-full border border-white/15 bg-black/45 px-3 py-0.5 font-display text-[8px] font-bold tracking-[0.3em] text-white/70 backdrop-blur-sm sm:text-[10px]">
            ×{multiplier.toFixed(1)} SCORE · DAY {profile.streak} STREAK
          </div>
          {props.season && (
            <div
              className="pointer-events-auto mt-1.5 max-w-[86%] rounded-full border px-3 py-1 text-center backdrop-blur-md"
              style={{ borderColor: `${props.season.accent}77`, background: `${props.season.accent}22` }}
            >
              <span className="font-display text-[8px] font-black tracking-widest sm:text-[10px]" style={{ color: props.season.accent }}>
                {props.season.name.toUpperCase()} · {props.season.tagline}
              </span>
            </div>
          )}
        </div>

        {/* LEFT WALL — economy & loadout */}
        <div className="absolute left-2 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2 sm:left-4 sm:gap-2.5">
          <WallTile
            big
            icon={<ShopIcon size={24} />}
            label={tr("tile.shop", "SHOP")}
            sub={affordable ? `${affordable} affordable` : "Bikes · gear · horns"}
            badge={affordable || null}
            gradient="linear-gradient(160deg,#ff4da6,#a21caf)"
            glow="rgba(255,77,166,0.45)"
            onClick={() => open("shop")}
          />
          <WallTile
            icon={<BikeIcon size={22} />}
            label={tr("tile.garage", "GARAGE")}
            sub={bike.name}
            gradient="linear-gradient(160deg,#38bdf8,#1d4ed8)"
            onClick={() => open("garage")}
          />
          <WallTile
            icon={<TrophyIcon size={22} />}
            label={tr("tile.career", "CAREER")}
            sub={`${props.careerDone}/${props.careerTotal} contracts`}
            gradient="linear-gradient(160deg,#fb923c,#9a3412)"
            onClick={() => open("career")}
          />
          <WallTile
            icon={<SparkleIcon size={22} />}
            label={tr("tile.upgrades", "UPGRADES")}
            sub={profile.crates ? `${profile.crates} crate${profile.crates > 1 ? "s" : ""}` : "Perks · crates"}
            badge={profile.crates || null}
            gradient="linear-gradient(160deg,#a78bfa,#6d28d9)"
            onClick={() => open("upgrades")}
          />
          <WallTile
            icon={<MissionIcon size={22} />}
            label={tr("tile.missions", "MISSIONS")}
            sub={`${missionsDone}/3 done`}
            badge={`${missionsDone}/3`}
            gradient="linear-gradient(160deg,#34d399,#047857)"
            onClick={() => open("missions")}
          />
        </div>

        {/* RIGHT WALL — events & community */}
        <div className="absolute right-2 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2 sm:right-4 sm:gap-2.5">
          <WallTile
            icon={<CalendarIcon size={22} />}
            label={tr("tile.daily", "DAILY")}
            sub={dailyBest ? `Best ${dailyBest.toLocaleString()}` : "Same seed worldwide"}
            badge={dailyBest ? null : "!"}
            gradient="linear-gradient(160deg,#fbbf24,#c2410c)"
            glow={dailyBest ? undefined : "rgba(251,191,36,0.4)"}
            onClick={() => { props.onUi(); props.onSelectMode("daily"); }}
          />
          <WallTile
            icon={<CalendarIcon size={22} />}
            label={tr("tile.weekly", "WEEKLY")}
            sub={`${Math.max(0, props.weekly.attempts - props.weekly.used)} tries · ${props.weekly.mods}`}
            badge={props.weekly.used === 0 ? "NEW" : null}
            gradient="linear-gradient(160deg,#e879f9,#7e22ce)"
            onClick={() => { props.onUi(); props.onSelectMode("weekly"); }}
          />
          <WallTile
            icon={<TrophyIcon size={22} />}
            label={tr("tile.ranks", "RANKS")}
            sub={best ? `PB ${best.toLocaleString()}` : "Local legends"}
            gradient="linear-gradient(160deg,#f59e0b,#92400e)"
            onClick={() => open("ranks")}
          />
          <WallTile
            icon={<RulerIcon size={22} />}
            label={tr("tile.routelab", "ROUTE LAB")}
            sub="Seeds · modifiers"
            gradient="linear-gradient(160deg,#22d3ee,#0e7490)"
            onClick={() => open("route")}
          />
          <WallTile
            icon={<CarIcon size={22} />}
            label={tr("tile.guide", "GUIDE")}
            sub={`${guideSeen}/9 logged`}
            badge={guideClaimable || null}
            gradient="linear-gradient(160deg,#64748b,#1e293b)"
            onClick={() => open("fieldguide")}
          />
          <WallTile
            icon={<PlayIcon size={20} />}
            label={tr("tile.replay", "REPLAY")}
            sub="Last run"
            gradient="linear-gradient(160deg,#818cf8,#3730a3)"
            onClick={() => open("replay")}
          />
        </div>

        {/* hero nameplate + quick bike swap */}
        <div className="absolute inset-x-0 bottom-1 z-20 flex flex-col items-center gap-1 sm:bottom-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => props.onCycleBike(-1)}
              aria-label="Previous bike"
              className="btn-neon flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-black/60 font-display text-sm font-black text-white backdrop-blur-sm"
            >
              ‹
            </button>
            <button
              onClick={() => open("garage")}
              className="btn-neon rounded-2xl border bg-black/65 px-4 py-1.5 text-center backdrop-blur-md"
              style={{ borderColor: `${bike.colors[0]}88`, boxShadow: `0 0 18px ${bike.colors[1]}55` }}
            >
              <span className="block font-display text-xs font-black tracking-wider text-white sm:text-sm">{bike.name.toUpperCase()}</span>
              <span className="block text-[8px] text-white/55 sm:text-[9px]">
                {ownedBikes}/{BIKES.length} bikes · tap bike to rev · tap here to customize
              </span>
            </button>
            <button
              onClick={() => props.onCycleBike(1)}
              aria-label="Next bike"
              className="btn-neon flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-black/60 font-display text-sm font-black text-white backdrop-blur-sm"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* ================= BOTTOM BAR ================= */}
      <div className="relative z-20 flex items-end justify-between gap-3 px-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-4">
        <div className="flex min-w-0 max-w-[280px] flex-1 flex-col gap-2">
          {/* mission ticker */}
          <button
            onClick={() => open("missions")}
            className="btn-neon flex min-w-0 items-center gap-2 rounded-xl border border-white/15 bg-black/60 px-2.5 py-1.5 text-left backdrop-blur-md"
          >
            <span className={nextMission ? "text-white/70" : "text-emerald-300"}>
              {nextMission ? <MissionIcon size={16} /> : <CheckIcon size={16} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[9px] text-white/85 sm:text-[10px]">
                {nextMission ? nextMission.label : tr("ticker.allDone", "All missions done — ride to level up the set!")}
              </span>
              {nextMission && (
                <span className="mt-0.5 block h-1 overflow-hidden rounded-full bg-white/15">
                  <span className="block h-full rounded-full" style={{ width: `${(nextProg / nextMission.target) * 100}%`, background: accent }} />
                </span>
              )}
            </span>
          </button>

          {/* mode selector */}
          <button
            onClick={() => { props.onUi(); setModeSheet(true); }}
            className="btn-neon flex items-center gap-2.5 rounded-2xl border-2 bg-black/65 px-3 py-2 text-left backdrop-blur-md"
            style={{ borderColor: `${accent}99` }}
          >
            <span style={{ color: accent }}>{currentMode.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[8px] font-bold tracking-[0.25em] text-white/50">{tr("label.gameMode", "GAME MODE")}</span>
              <span className="block truncate font-display text-xs font-black text-white sm:text-sm">
                {tr(("mode." + currentMode.id) as I18nKey, currentMode.name).toUpperCase()}{showDifficulty ? ` · ${tr(("diff." + settings.difficulty) as I18nKey, diffName).toUpperCase()}` : ""}
              </span>
            </span>
            <span className="font-display text-[10px] font-black text-white/60">▲</span>
          </button>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {best > 0 && (
            <span className="flex items-center gap-1 rounded-full border border-yellow-300/40 bg-black/60 px-2.5 py-0.5 font-display text-[9px] font-black text-yellow-200 backdrop-blur-sm">
              <TrophyIcon size={12} /> BEST {best.toLocaleString()}
            </span>
          )}
          <button
            onClick={() => { props.onUi(); props.onPlay(); }}
            data-tile
            className="btn-neon play-pulse relative flex h-[72px] w-[150px] flex-col items-center justify-center overflow-hidden rounded-[22px] border-2 border-white/70 sm:h-24 sm:w-56"
            style={{ background: "linear-gradient(180deg,#4ade80 0%,#16a34a 55%,#15803d 100%)" }}
          >
            <span className="pointer-events-none absolute inset-x-2 top-1 h-1/3 rounded-full bg-white/25" />
            <span className="flex items-center gap-2 font-display text-3xl font-black tracking-widest text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.35)] sm:text-4xl">
              <PlayIcon size={26} /> {tr("tile.play", "PLAY")}
            </span>
            <span className="font-display text-[8px] font-bold tracking-[0.25em] text-white/85 sm:text-[10px]">
              {settings.mode === "tournament" ? `CUP · ${cupNames[0]}` : tr(("mode." + currentMode.id) as I18nKey, currentMode.name).toUpperCase()}
            </span>
          </button>
          <span className="hidden font-display text-[9px] font-bold tracking-widest text-white/45 sm:block">OR PRESS SPACE</span>
        </div>
      </div>

      {/* ================= MODE SHEET ================= */}
      {modeSheet && (
        <div className="fade-in absolute inset-0 z-40 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={() => setModeSheet(false)}>
          <div
            className="slide-up w-full max-w-lg rounded-t-3xl border border-white/15 bg-[#0d0620]/97 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-20px_60px_rgba(0,0,0,0.6)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-sm font-black tracking-[0.2em] text-white">{tr("label.selectMode", "SELECT MODE")}</span>
              <button onClick={() => setModeSheet(false)} className="btn-neon rounded-lg bg-white/10 p-1.5 text-white" aria-label="Close">
                <XIcon size={16} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {modes.map((m) => {
                const active = settings.mode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => { props.onUi(); props.onSelectMode(m.id); }}
                    className={`btn-neon flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 ${active ? "bg-white/10 text-white" : "border-white/10 bg-black/30 text-white/60"}`}
                    style={active ? { borderColor: accent, boxShadow: `0 0 14px ${accent}55` } : {}}
                  >
                    {m.icon}
                    <span className="font-display text-[9px] font-black">{tr(("mode." + m.id) as I18nKey, m.name)}</span>
                    <span className="text-[7px] leading-tight opacity-60">{m.desc}</span>
                  </button>
                );
              })}
            </div>

            {showDifficulty && (
              <div className="mt-3">
                <div className="mb-1.5 font-display text-[9px] font-bold tracking-[0.24em] text-white/60">{tr("label.difficulty", "DIFFICULTY")}</div>
                <div className="grid grid-cols-3 gap-2">
                  {diffs.map((d) => {
                    const active = settings.difficulty === d.id;
                    return (
                      <button
                        key={d.id}
                        onClick={() => { props.onUi(); props.onSelectDifficulty(d.id); }}
                        className={`btn-neon rounded-xl border py-2 ${active ? "bg-white/10 text-white" : "border-white/10 bg-black/30 text-white/60"}`}
                        style={active ? { borderColor: accent } : {}}
                      >
                        <span className="block font-display text-[10px] font-black">{tr(("diff." + d.id) as I18nKey, d.name)}</span>
                        <span className="block text-[8px] opacity-60">{d.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {settings.mode === "tournament" && (
              <div className="mt-3 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-3">
                <div className="mb-1.5 font-display text-[9px] font-bold tracking-widest text-yellow-200">
                  PASS &amp; PLAY CUP · 3 HEATS EACH · {profile.tournamentWins} CUPS WON
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[0, 1].map((i) => (
                    <input
                      key={i}
                      value={cupNames[i]}
                      maxLength={12}
                      onChange={(e) => props.onCupName(i as 0 | 1, e.target.value)}
                      placeholder={`Rider ${i + 1}`}
                      className={`rounded-lg border border-white/15 bg-black/45 px-2.5 py-1.5 font-display text-[10px] font-bold uppercase outline-none ${i === 0 ? "text-cyan-200" : "text-pink-200"}`}
                    />
                  ))}
                </div>
              </div>
            )}

            {settings.mode === "daily" && (
              <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                <span className="font-display text-[10px] font-bold text-white/75">TODAY'S SEED #{todayKey()}</span>
                <span className="font-display text-xs font-black" style={{ color: accent }}>{dailyBest.toLocaleString()}</span>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setModeSheet(false)}
                className="btn-neon rounded-2xl border-2 border-white/20 bg-white/5 py-3 font-display text-xs font-black tracking-widest text-white"
              >
                {tr("label.done", "DONE")}
              </button>
              <button
                onClick={() => { setModeSheet(false); props.onUi(); props.onPlay(); }}
                className="btn-neon flex items-center justify-center gap-2 rounded-2xl py-3 font-display text-xs font-black tracking-widest text-white"
                style={{ background: "linear-gradient(180deg,#4ade80,#15803d)" }}
              >
                <PlayIcon size={16} /> {tr("label.playNow", "PLAY NOW")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* streak flame accent for returning players */}
    </div>
  );
}
