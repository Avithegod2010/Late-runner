import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Engine, type Phase, type Settings, type LiveStats, type Mode, type Difficulty,
} from "./game/engine";
import {
  THEMES, getTheme, customToTheme, DEFAULT_CUSTOM, encodeCustom, decodeCustom,
  type CustomTheme, type Weather,
} from "./game/themes";
import {
  BIKES, HELMETS, JACKETS, TRAILS, HORNS, STEERING, getChoice, rarityOf, BIKE_STATS, masteryLevel,
} from "./game/garage";
import {
  saveProfile, applyRun, touchStreak, buildMissions, levelFromXp, titleFor,
  CHAINS, TIER_NAMES, pityGuaranteed, nextPity, deathHeatmap, median, exportProfile, importProfile, careerStarsFor, hotStreakBonus,
  multiplierFor, leaderboardKey, filterBoard, lastSevenDays, BADGES, FIELD_GUIDE_TIERS,
  CRATE_PITY_MAX, doRebirth, prestigeMultiplier, PRESTIGE_MIN_LEVEL, PRESTIGE_MAX,
  type Profile, type RunResult, type Mission, type Badge,
} from "./game/progression";
import { KEYMAP_ACTIONS, DEFAULT_KEYMAP, keyLabel, normalizeKey, type KeyAction } from "./game/keymap";
import { LANGS } from "./game/i18n";
import { buildScoreCard, shareOrDownload } from "./game/scorecard";
import { RunClipRecorder, downloadClip, shareClip } from "./game/runClip";
import { sfx } from "./game/audio";
import { todayKey } from "./game/rng";
import {
  DEFAULT_GAMEPAD, MODIFIERS, ROUTE_PRESETS, UPGRADE_TREE, STATION_NAMES,
  type StationId, type GamepadAction, activeSeason,
  CAREER, isoWeekKey, weeklyModifiers, WEEKLY_ATTEMPTS, encodeGhost, decodeGhost,
} from "./game/features";
import RiderPreview from "./components/RiderPreview";
import Shop from "./components/Shop";
import DuelRace from "./components/DuelRace";
import ReplayTheater from "./components/ReplayTheater";
import { RouteLivePreview, RouteThumbnail } from "./components/RoutePreview";
import ThemePreview from "./components/ThemePreview";
import InteractiveTutorial from "./components/InteractiveTutorial";
import HomeScreen, { type HomePanel } from "./components/HomeScreen";
import type { PhotoFilterId } from "./components/RiderPreview";
import TrackEditor from "./components/TrackEditor";
import HornSequencer from "./components/HornSequencer";
import DecalPainter from "./components/DecalPainter";
import WheelLab from "./components/WheelLab";
import DistrictMap from "./components/DistrictMap";
import BountyBoard from "./components/BountyBoard";
import { makeLoadout, sanitizeLoadouts, MAX_LOADOUTS, type RiderLoadout } from "./game/loadouts";
import { sanitizeBountyState, todayBounties, bountyReward, GOLDEN_KEY_REWARD, type DailyBountyState, type BountyStat } from "./game/bounties";
import { GADGETS, sanitizeGadgets, type GadgetId } from "./game/gadgets";
import { DRILLS } from "./game/drills";
import { detectHighlights } from "./game/highlights";
import { loadProfileWithRecovery, rotateBackups, listBackups, restoreBackup, type BackupMeta } from "./game/backup";
import { SOUND_PACKS } from "./game/soundpacks";
import { COLLECTIBLES, collectiblesForWorld, COLLECTION_REWARDS, sanitizeCollections } from "./game/collectibles";
import {
  BikeIcon, CarIcon, CoinIcon, FlameIcon, GearIcon, HomeIcon, HelmetIcon,
  JacketIcon, JumpIcon, MedalIcon, PaletteIcon, PauseIcon, PlayIcon, RestartIcon,
  RulerIcon, SkullIcon, SoundOffIcon, SoundOnIcon, SpeedIcon, SteerIcon,
  TrophyIcon, ShieldIcon, StuntIcon,
  RampIcon, PoliceIcon, ShopIcon, MissionIcon, LevelIcon, CalendarIcon,
  ShareIcon, GhostIcon, CameraIcon, HornIcon, ZenIcon, TimerIcon, LockIcon, CheckIcon,
  XIcon, GamepadIcon, SparkleIcon,
} from "./components/Icons";

const LS_SETTINGS = "wwr-settings-v3";
const LS_LAST_PANEL = "wwr-last-panel-v1";
const LS_CUP_NAMES = "wwr-cup-names-v1";
const LS_WHATSNEW = "wwr-whatsnew-v1";

/* ---------------- v1.0 release stamp ---------------- */
export const GAME_VERSION = "1.2.0";
const GAME_BUILD = __BUILD_DATE__;
const WHATSNEW: string[] = [
  "REAL WHEELIES 2.0: torque burst up, balance-point wobble, gravity drop + suspension bounce",
  "WHEEL LAB: live spinning rim preview — 6 styles x 8 colors, in-game exact render",
  "DISTRICT PREVIEWS: tap any district on the City Map to watch its routes before you ride",
  "OLD TOWN + SKYLINE LOOP: 2 post-game districts, 6 new contracts, 2 new shortcuts",
  "HORNS +3: Klaxon, Train Chime and Basso Profondo on a compressed horn bus",
  "GADGETS +2: Nitro Siphon and Coin Compass join the pre-run loadout",
  "RIVALS +3: meet Wall, Vex and Nila on the dueling circuit",
  "SOUND PACKS +2: Vaporwave Mall and Sunrise Calm — plus chain whir & pedal cadence in the engine mix",
  "DAILY SHARE: after a Daily run, copy a challenge link that loads the same seed for friends",
  "REAL WHEELIES: hold it and the front wheel actually comes up, rider leaning back",
  "WHEEL TUNER: 6 rim styles x 8 colors in the Garage, saved inside loadouts",
  "WORLD PREVIEWS: the Worlds panel now paints a live scene of every palette",
  "HORNS 2.0: layered air-horn, dixie, siren and laser voices with real body",
  "TRUE PWA: proper install icons — one-tap install on Android, desktop and iOS",
  "RIDER REBIRTH: hit level 15, then prestige for a permanent +5% coins & score",
  "HARBOR FINALE: a fifth district, 3 new contracts and the Cargo Zeppelin boss",
  "WHAT'S NEW panel + in-game version & credits (you are reading it right now)",
  "Settings search + category chips — find any option in seconds",
  "Lifetime log: every run, coin, near-miss and stunt on one card in Profile",
  "Keyboard remapping: rebind every riding action in Settings",
  "Ghost Exchange: copy/paste ghost codes and race your friends' exact lines",
  "Attract demo: idle on the menu and your best run plays itself",
  "Share cards now carry your Rebirth count — flex responsibly",
  "Seasonal events apply their weather + bonus coins to every run",
  "New languages: Español & हिन्दी for the home menu (Settings → Language)",
  "Update toast: never miss a new build again",
];

/** Escape a string before it goes into any HUD innerHTML fragment. */
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

const DEFAULT_SETTINGS: Settings = {
  themeId: "synthwave", shake: true, quality: "high",
  bikeId: "neon", helmetId: "comet", jacketId: "ember", trailId: "mist", hornId: "airhorn",
  steering: "relaxed", difficulty: "normal", mode: "classic",
  dynamicTime: true, music: true, haptics: "light",
  colorblind: false, reduceMotion: false, lefty: false, ghostOn: true,
  customTheme: null, useCustom: false,
  modifiers: [], route: ROUTE_PRESETS[0],
  musicStation: "synthwave", announcer: "arcade", hudScale: 1, hudBottom: 16,
  controllerMap: DEFAULT_GAMEPAD, decal: "bolt", plateText: "RIDER", companion: "none",
  upgrades: {},
  autoPauseFocus: true, autoQuality: true, showFps: false,
  assist: false, tilt: false, tiltSens: 1, tiltZero: 0,
  modeOverrides: {},
  soundPack: "neon", directionalAudio: true, heartbeatAudio: true,
  garagePodium: "neon", garageLight: "spot", garagePoster: "city", garageTrophy: "bronze",
  wheelStyle: "sport", wheelColor: "#e2e8f0",
  drillId: undefined, track: null, collectiblesOwned: [], customHorn: null, gadgets: {},
  keymap: {}, lang: "en", attract: true,
};

type Panel =
  | "garage" | "shop" | "missions" | "profile" | "themes"
  | "settings" | "photo" | "route" | "upgrades" | "fieldguide" | "replay"
  | "ranks" | "career"
  | "editor" | "map" | "painter" | "horn"
  | null;

const VALID_PANELS = new Set<string>([
  "garage", "shop", "missions", "profile", "themes",
  "settings", "photo", "route", "upgrades", "fieldguide", "replay", "ranks", "career",
  "editor", "map", "painter", "horn",
]);

const WEATHER_IDS: readonly Weather[] = ["none", "rain", "snow", "petals", "sand", "fireflies", "ash"];

/* ---- PWA install support ---- */
const IOS_DEVICE =
  typeof navigator !== "undefined" &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    window.matchMedia?.("(display-mode: minimal-ui)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true);

/** Capture an install prompt that fired before React mounted (hardened flow). */
type InstallPromptEvent = Event & { prompt?: () => Promise<void>; userChoice?: Promise<{ outcome: string }> };
const earlyInstall = ((window as unknown as { __wwrInstall?: InstallPromptEvent | null }).__wwrInstall ?? null);

function loadSettings(): Settings & { muted: boolean } {
  try {
    const s = JSON.parse(localStorage.getItem(LS_SETTINGS) || "{}") as Record<string, unknown>;
    // keep only known keys so a corrupted/poisoned save cannot inject junk fields
    const clean: Record<string, unknown> = {};
    for (const k of Object.keys(DEFAULT_SETTINGS)) {
      if (k in s) clean[k] = s[k];
    }
    const route = isPlainRecord(clean.route)
      ? { ...DEFAULT_SETTINGS.route, ...clean.route, traffic: clampDensity(clean.route.traffic, DEFAULT_SETTINGS.route.traffic), hazards: clampDensity(clean.route.hazards, DEFAULT_SETTINGS.route.hazards) }
      : DEFAULT_SETTINGS.route;
    return {
      ...DEFAULT_SETTINGS,
      muted: false,
      ...clean,
      route,
    } as Settings & { muted: boolean };
  } catch {
    return { ...DEFAULT_SETTINGS, muted: false };
  }
}

function isPlainRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function clampDensity(v: unknown, fallback: number) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(1.6, Math.max(0.5, n)) : fallback;
}

function loadSavedPanel(): Panel {
  try {
    const raw = localStorage.getItem(LS_LAST_PANEL);
    if (raw && VALID_PANELS.has(raw)) return raw as Panel;
    return null;
  } catch {
    return null;
  }
}

function loadCupNames(): [string, string] {
  try {
    const parsed = JSON.parse(localStorage.getItem(LS_CUP_NAMES) || "null");
    if (Array.isArray(parsed) && parsed.length === 2) {
      return [String(parsed[0] || "RIDER 1"), String(parsed[1] || "RIDER 2")];
    }
  } catch { /* ignore */ }
  return ["RIDER 1", "RIDER 2"];
}

interface CupState {
  p1Name: string;
  p2Name: string;
  /** 6 alternating turns: 0=P1 H1, 1=P2 H1, 2=P1 H2, 3=P2 H2, 4=P1 H3, 5=P2 H3 */
  p1Heats: number[];
  p2Heats: number[];
}

const MODES: { id: Mode; name: string; desc: string; icon: ReactNode }[] = [
  { id: "classic", name: "Classic", desc: "Endless · ghost race", icon: <BikeIcon size={22} /> },
  { id: "zen", name: "Zen", desc: "No deaths · slow · cozy", icon: <ZenIcon size={22} /> },
  { id: "timetrial", name: "Time Trial", desc: "60s · splits", icon: <TimerIcon size={22} /> },
  { id: "daily", name: "Daily", desc: "Same seed worldwide", icon: <CalendarIcon size={22} /> },
  { id: "duel", name: "Duel", desc: "2P · 2000m finish line", icon: <GamepadIcon size={22} /> },
  { id: "coop", name: "Co-op", desc: "2P shared delivery", icon: <GamepadIcon size={22} /> },
  { id: "tournament", name: "Cup", desc: "Named 2P bracket", icon: <TrophyIcon size={22} /> },
  { id: "practice", name: "Practice", desc: "Test track · no crash", icon: <SteerIcon size={22} /> },
  { id: "route", name: "Route", desc: "Seed + delivery", icon: <PaletteIcon size={22} /> },
  { id: "weekly", name: "Weekly", desc: "3 tries · fixed seed", icon: <CalendarIcon size={22} /> },
  { id: "bossrush", name: "Boss Rush", desc: "Back-to-back bosses", icon: <SkullIcon size={22} /> },
];

const DIFFS: { id: Difficulty; name: string; desc: string }[] = [
  { id: "chill", name: "Chill", desc: "Slower · no trucks" },
  { id: "normal", name: "Normal", desc: "Balanced" },
  { id: "insane", name: "Insane", desc: "Fast · dense" },
];

/* ================================================================
   Small shared UI atoms (module scope so canvases never remount)
   ================================================================ */

function Toggle({ label, on, onClick, hint, accent }: {
  label: string; on: boolean; onClick: () => void; hint?: string; accent: string;
}) {
  return (
    <button
      onClick={onClick}
      className="btn-neon flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2"
    >
      <span className="text-left">
        <span className="block font-display text-[11px] font-bold tracking-wide text-white">{label}</span>
        {hint && <span className="block text-[9px] text-white/45">{hint}</span>}
      </span>
      <span className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
        style={{ background: on ? accent : "rgba(255,255,255,0.18)" }}>
        <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
          style={{ left: on ? "1.4rem" : "0.125rem" }} />
      </span>
    </button>
  );
}

function Seg<T extends string>({ options, value, onChange, accent }: {
  options: { id: T; name: string; desc?: string }[];
  value: T; onChange: (v: T) => void; accent: string;
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button key={o.id} onClick={() => onChange(o.id)}
            className={`btn-neon rounded-xl border px-1 py-2 ${active ? "bg-white/10 text-white" : "border-white/10 bg-black/30 text-white/60"}`}
            style={active ? { borderColor: accent, boxShadow: `0 0 12px ${accent}44` } : {}}>
            <span className="block font-display text-[10px] font-bold">{o.name}</span>
            {o.desc && <span className="block text-[8px] leading-tight opacity-60">{o.desc}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Modal({ title, icon, onClose, children, accent }: {
  title: string; icon: ReactNode; onClose: () => void; children: ReactNode; accent: string;
}) {
  // Escape closes; focus moves into the dialog so keyboard users land inside it
  const boxRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); closeRef.current(); }
    };
    window.addEventListener("keydown", onKey);
    boxRef.current?.querySelector<HTMLElement>("button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div
      className="fade-in absolute inset-0 z-30 flex items-stretch justify-center bg-[#05020d]/90 p-3 backdrop-blur-lg sm:items-center sm:p-5"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={boxRef}
        onClick={(e) => e.stopPropagation()}
        className="pop-in flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white/12 bg-[#0d0620]/95 shadow-[0_24px_80px_rgba(0,0,0,0.7)]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2 font-display text-sm font-black tracking-[0.2em] text-white">
            <span style={{ color: accent }}>{icon}</span>
            {title}
          </div>
          <button onClick={onClose} className="btn-neon rounded-lg bg-white/10 p-1.5 text-white" aria-label="Close">
            <XIcon size={16} />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-4">{children}</div>
      </div>
    </div>
  );
}

function ChoiceGrid({
  label, icon, options, selected, owned, wallet, avgCoins, onSelect, onOpenShop, accent,
}: {
  label: string;
  icon: ReactNode;
  options: ReadonlyArray<{ id: string; name: string; detail: string; colors: [string, string]; price: number }>;
  selected: string;
  owned: string[];
  wallet: number;
  avgCoins: number;
  onSelect: (id: string) => void;
  onOpenShop: () => void;
  accent: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 font-display text-[10px] font-bold tracking-[0.24em] text-white/70">
        <span style={{ color: accent }}>{icon}</span>{label}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map((o) => {
          const active = o.id === selected;
          const have = owned.includes(o.id);
          const need = Math.max(0, o.price - wallet);
          const estRuns = Math.max(1, Math.ceil(need / Math.max(25, avgCoins)));
          const tip = have
            ? o.detail
            : need === 0
              ? "Ready in Shop!"
              : `${need} more coins (~${estRuns}r)`;
          return (
            <button
              key={o.id}
              onClick={() => (have ? onSelect(o.id) : onOpenShop())}
              className={`btn-neon relative min-w-0 rounded-xl border p-2 text-left ${active ? "bg-white/10" : "border-white/10 bg-black/30"} ${have ? "" : "opacity-80"}`}
              style={active ? { borderColor: o.colors[0], boxShadow: `0 0 12px ${o.colors[1]}55` } : {}}
              title={have ? o.detail : `Locked (${o.price} coins) — ${need === 0 ? "Tap to unlock in Shop" : `${need} more coins or open a level-up crate`}`}
            >
              <span className="mb-1.5 block h-2.5 w-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${o.colors[0]}, ${o.colors[1]})` }} />
              <span className="block truncate font-display text-[10px] font-bold text-white">{o.name}</span>
              <span className={`block truncate text-[8px] ${!have && need === 0 ? "font-bold text-emerald-300" : "text-white/50"}`}>
                {tip}
              </span>
              {!have && <span className="absolute right-1.5 top-1.5 text-white/70"><LockIcon size={12} /></span>}
              {active && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full" style={{ background: o.colors[0] }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================
   App
   ================================================================ */

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [stored] = useState(loadSettings);
  const [settings, setSettings] = useState<Settings>(() => {
    const base: Settings = { ...DEFAULT_SETTINGS, ...stored };
    try {
      const params = new URLSearchParams(location.search);
      const p = params.get("t");
      if (p) {
        const c = decodeCustom(p);
        if (c) return { ...base, customTheme: c, useCustom: true };
      }
      // daily challenge deep link: ?mode=daily opens straight into today's run
      if (params.get("mode") === "daily") {
        return { ...base, mode: "daily" };
      }
      const route = params.get("route");
      if (route) {
        const [seed, traffic, hazards, weather] = route.split(",");
        return {
          ...base,
          mode: "route",
          route: {
            ...base.route,
            name: "Shared Route",
            seed: Number(seed) || base.route.seed,
            traffic: clampDensity(traffic, 1),
            hazards: clampDensity(hazards, 1),
            weather: WEATHER_IDS.includes(weather as Weather) ? (weather as Weather) : "none",
          },
        };
      }
    } catch { /* ignore malformed link */ }
    return base;
  });

  const [muted, setMuted] = useState(stored.muted);
  // Automatic Save Recovery: sanitize the primary save; fall back to rotating backups.
  const [profile, setProfile] = useState<Profile>(() => {
    const r = loadProfileWithRecovery();
    if (r.recovered) {
      setTimeout(() => showToast("Save was corrupted — restored your latest backup", 4200), 600);
    }
    return r.profile;
  });
  /* ---- new feature state ---- */
  const LS_LOADOUTS = "wwr-loadouts-v1";
  const LS_BOUNTIES = "wwr-bounties-v1";
  const LS_GADGETS = "wwr-gadgets-v1";
  const [loadoutList, setLoadoutList] = useState<RiderLoadout[]>(() => {
    try { return sanitizeLoadouts(JSON.parse(localStorage.getItem(LS_LOADOUTS) || "[]")); } catch { return []; }
  });
  const [loadoutName, setLoadoutName] = useState("");
  const today = todayKey();
  const [bountyState, setBountyState] = useState<DailyBountyState>(() => {
    try { return sanitizeBountyState(JSON.parse(localStorage.getItem(LS_BOUNTIES) || "null"), today); }
    catch { return sanitizeBountyState(null, today); }
  });
  const [gadgetInv, setGadgetInv] = useState<Record<GadgetId, number>>(() => {
    try { return sanitizeGadgets(JSON.parse(localStorage.getItem(LS_GADGETS) || "null")); } catch { return sanitizeGadgets(null); }
  });
  const [backupList, setBackupList] = useState<BackupMeta[]>([]);
  const saveLoadoutList = (ls: RiderLoadout[]) => {
    setLoadoutList(ls);
    try { localStorage.setItem(LS_LOADOUTS, JSON.stringify(ls)); } catch { /* ignore */ }
  };
  const saveBountyState = (bs: DailyBountyState) => {
    setBountyState(bs);
    try { localStorage.setItem(LS_BOUNTIES, JSON.stringify(bs)); } catch { /* ignore */ }
  };
  const saveGadgetInv = (gi: Record<GadgetId, number>) => {
    setGadgetInv(gi);
    try { localStorage.setItem(LS_GADGETS, JSON.stringify(gi)); } catch { /* ignore */ }
  };
  // Session return-state: reopen directly to the last screen you were using
  const [panel, setPanelState] = useState<Panel>(loadSavedPanel);
  const [tutorial, setTutorial] = useState(false);
  const [streakBonus, setStreakBonus] = useState(0);
  const [installEvt, setInstallEvt] = useState<InstallPromptEvent | null>(earlyInstall);
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [copiedMsg, setCopiedMsg] = useState("");
  const [runClip, setRunClip] = useState<Blob | null>(null);
  const clipRecorderRef = useRef<RunClipRecorder | null>(null);
  const clipRecorder = clipRecorderRef.current ??= new RunClipRecorder();
  const [loadout, setLoadout] = useState({ shield: false, ticket: false });
  const [sharedGhost] = useState(() => {
    try {
      const g = new URLSearchParams(location.search).get("g");
      return g ? decodeGhost(g) : null;
    } catch { return null; }
  });
  const [sharing, setSharing] = useState(false);
  const [duelActive, setDuelActive] = useState(false);
  const [cupNames, setCupNames] = useState<[string, string]>(loadCupNames);
  const [tournament, setTournament] = useState<CupState | null>(null);
  const tournamentRef = useRef<CupState | null>(null);
  const [crateReveal, setCrateReveal] = useState("");
  const [worldFilter, setWorldFilter] = useState<string>("all");
  const [telemetryMetric, setTelemetryMetric] = useState<"score" | "distance">("score");
  const [showLatencyDiag, setShowLatencyDiag] = useState(false);
  const [photoFilter, setPhotoFilter] = useState<PhotoFilterId>("none");
  const [photoStickers, setPhotoStickers] = useState<string[]>([]);
  const scoreHoldTimer = useRef<number | null>(null);

  /* ---- v1.0 feature state ---- */
  const [whatsNew, setWhatsNew] = useState(false);
  const [settingsQuery, setSettingsQuery] = useState("");
  const settingsBodyRef = useRef<HTMLDivElement | null>(null);
  const [capturingKey, setCapturingKey] = useState<KeyAction | null>(null);
  const [attract, setAttract] = useState(false);
  const attractTimer = useRef<number | null>(null);
  const [rebirthAsk, setRebirthAsk] = useState(false);
  const [ghostPaste, setGhostPaste] = useState("");

  const [final, setFinal] = useState<{
    run: RunResult; isBest: boolean; rank: number;
    completed: Mission[]; badges: Badge[]; levelUp: boolean; ticketsEarned: number;
    streakBonusCoins: number; chainUnlocks: string[]; careerStars: number; careerFirstClear: boolean;
  } | null>(null);

  const setPanel = useCallback((next: Panel) => {
    setPanelState(next);
    try {
      if (next) localStorage.setItem(LS_LAST_PANEL, next);
      else localStorage.removeItem(LS_LAST_PANEL);
    } catch { /* ignore */ }
  }, []);

  /* ---- v1.0: What's New + service-worker update toast ---- */
  useEffect(() => {
    try {
      const seen = localStorage.getItem(LS_WHATSNEW);
      if (seen !== GAME_VERSION) setWhatsNew(true);
    } catch { setWhatsNew(true); }
    const onUpdate = () => showToast("New version downloaded — close & reopen the game to update", 4200);
    window.addEventListener("wwr-update-ready", onUpdate);
    return () => window.removeEventListener("wwr-update-ready", onUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissWhatsNew = () => {
    setWhatsNew(false);
    try { localStorage.setItem(LS_WHATSNEW, GAME_VERSION); } catch { /* ignore */ }
  };

  /* ---- v1.0: attract demo — idle on the home screen replays the last run ---- */
  useEffect(() => {
    const idleOk = phase === "ready" && !panel && !tutorial && !duelActive && !tournament && !whatsNew;
    if (!idleOk || settings.attract === false || profile.lastReplay.length < 100) {
      setAttract(false);
      if (attractTimer.current !== null) { clearTimeout(attractTimer.current); attractTimer.current = null; }
      return;
    }
    const arm = () => {
      if (attractTimer.current !== null) clearTimeout(attractTimer.current);
      attractTimer.current = window.setTimeout(() => setAttract(true), 30000);
    };
    arm();
    window.addEventListener("pointerdown", arm);
    window.addEventListener("keydown", arm);
    return () => {
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
      if (attractTimer.current !== null) clearTimeout(attractTimer.current);
    };
  }, [phase, panel, tutorial, duelActive, tournament, whatsNew, settings.attract, profile.lastReplay.length]);

  /* ---- v1.0: keyboard remap capture ---- */
  useEffect(() => {
    if (!capturingKey) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key !== "Escape") {
        const nk = normalizeKey(e.key);
        if (nk.length > 0 && nk.length <= 24) {
          setSettings((s) => ({ ...s, keymap: { ...(s.keymap ?? {}), [capturingKey]: nk } }));
          tapUi();
        }
      }
      setCapturingKey(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capturingKey]);

  /* ---- v1.0: settings search filter (DOM-level, keeps panel JSX untouched) ---- */
  useEffect(() => {
    const body = settingsBodyRef.current;
    if (!body) return;
    const q = settingsQuery.trim().toLowerCase();
    for (const child of Array.from(body.children) as HTMLElement[]) {
      if (!q) { child.style.display = ""; continue; }
      const text = (child.textContent ?? "").toLowerCase();
      child.style.display = text.includes(q) ? "" : "none";
    }
  }, [settingsQuery, panel]);

  const theme = useMemo(
    () => (settings.useCustom && settings.customTheme ? customToTheme(settings.customTheme) : getTheme(settings.themeId)),
    [settings.useCustom, settings.customTheme, settings.themeId]
  );
  const accent = theme.accent;
  // Automatic Replay Highlights: derived from the finished run's event channel
  const highlightChips = useMemo(
    () => (final ? detectHighlights(final.run.replay).slice(0, 8) : []),
    [final]
  );
  const ownedCollectibles = useMemo(
    () => sanitizeCollections(settings.collectiblesOwned),
    [settings.collectiblesOwned]
  );
  const isTouch = useMemo(
    () => typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0),
    []
  );
  const lvl = levelFromXp(profile.xp);
  const multiplier = multiplierFor(profile.missionSet);
  const missions = useMemo(() => buildMissions(profile.missionSet), [profile.missionSet]);
  const weekKey = isoWeekKey();
  const weekMods = useMemo(() => weeklyModifiers(), []);
  const lbKey = leaderboardKey(settings.mode, settings.difficulty, weekKey);
  const rawBoard = profile.scores[lbKey] ?? [];
  const board = useMemo(() => filterBoard(rawBoard, worldFilter), [rawBoard, worldFilter]);
  const best = rawBoard.length ? rawBoard[0].score : 0;

  // Telemetry derivations
  const avgRunCoins = useMemo(() => {
    if (!profile.runHistory.length) return 45;
    return Math.round(profile.runHistory.reduce((a, r) => a + r.coins, 0) / profile.runHistory.length);
  }, [profile.runHistory]);

  const telemetrySummary = useMemo(() => {
    const h = profile.runHistory;
    if (!h.length) return { avgDist: 0, avgScore: 0, nemesis: "None yet" };
    const avgDist = Math.round(h.reduce((a, r) => a + r.distance, 0) / h.length);
    const avgScore = Math.round(h.reduce((a, r) => a + r.score, 0) / h.length);
    const counts: Record<string, number> = {};
    for (const r of h) {
      if (r.killer && r.killer !== "Time Up" && r.killer !== "Delivered") {
        counts[r.killer] = (counts[r.killer] ?? 0) + 1;
      }
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return {
      avgDist,
      avgScore,
      nemesis: top ? `${top[0]} (${top[1]}×)` : "Clean runs!",
    };
  }, [profile.runHistory]);

  const streakDays = useMemo(() => lastSevenDays(profile.playDates), [profile.playDates]);

  // HUD refs (updated at 60fps without React re-renders)
  const scoreRef = useRef<HTMLSpanElement>(null);
  const coinsRef = useRef<HTMLSpanElement>(null);
  const speedRef = useRef<HTMLSpanElement>(null);
  const comboRef = useRef<HTMLDivElement>(null);
  const bankBtnRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<HTMLDivElement>(null);
  const pupRef = useRef<HTMLDivElement>(null);
  const trickRef = useRef<HTMLDivElement>(null);
  const wantedRef = useRef<HTMLDivElement>(null);
  const hudExtraRef = useRef<HTMLDivElement>(null);
  const nitroBtnRef = useRef<HTMLButtonElement>(null);
  const prestigeBtnRef = useRef<HTMLButtonElement>(null);
  const fpsRef = useRef<HTMLDivElement>(null);
  const diagRef = useRef<HTMLDivElement>(null);
  const crashCalloutRef = useRef<HTMLDivElement>(null);
  const lastCombo = useRef(0);

  const onStats = useCallback((s: LiveStats) => {
    if (scoreRef.current) {
      scoreRef.current.textContent = s.score.toLocaleString();
      scoreRef.current.style.transform = s.scorePop > 0.01 ? `scale(${(1 + s.scorePop).toFixed(3)})` : "scale(1)";
    }
    if (coinsRef.current) coinsRef.current.textContent = String(s.coins);
    if (speedRef.current) speedRef.current.textContent = String(s.speedKmh);

    const el = comboRef.current;
    if (el) {
      if (s.combo > 1) {
        el.style.opacity = "1";
        const label = el.querySelector("span");
        if (label) label.textContent = `COMBO ×${s.combo}`;
        if (s.combo !== lastCombo.current) {
          el.classList.remove("combo-bump");
          void el.offsetWidth;
          el.classList.add("combo-bump");
        }
      } else el.style.opacity = "0";
      lastCombo.current = s.combo;
    }

    // Combo bank button / status pill
    if (bankBtnRef.current) {
      if (s.bankedCombo > 0) {
        bankBtnRef.current.style.opacity = "1";
        bankBtnRef.current.style.pointerEvents = "none";
        bankBtnRef.current.textContent = `BANKED ×${s.bankedCombo} · DODGE TO CASH!`;
      } else if (s.combo >= 2) {
        bankBtnRef.current.style.opacity = "1";
        bankBtnRef.current.style.pointerEvents = "auto";
        bankBtnRef.current.textContent = `BANK ×${s.combo} [B]`;
      } else {
        bankBtnRef.current.style.opacity = "0";
        bankBtnRef.current.style.pointerEvents = "none";
      }
    }

    if (timerRef.current) {
      if (s.timeLeft !== null) {
        timerRef.current.style.display = "flex";
        const t = Math.max(0, s.timeLeft);
        timerRef.current.textContent = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
        timerRef.current.style.color = t < 10 ? "#ff6b6b" : "#fff";
      } else timerRef.current.style.display = "none";
    }

    if (trickRef.current) {
      trickRef.current.textContent = s.trick ?? "";
      trickRef.current.style.opacity = s.trick ? "1" : "0";
    }

    // 1.5s Crash Cam "What Hit You" callout
    if (crashCalloutRef.current) {
      if (s.crashCallout) {
        crashCalloutRef.current.style.opacity = "1";
        const c = s.crashCallout;
        const lost = c.comboLost > 1 ? ` · LOST ×${c.comboLost} COMBO` : "";
        crashCalloutRef.current.innerHTML =
          `<div style="font:900 10px Orbitron,monospace;letter-spacing:.22em;color:#fca5a5">CRASH REPORT</div>` +
          `<div style="font:900 16px Orbitron,monospace;color:#fff;margin-top:2px">${esc(c.killer.toUpperCase())}</div>` +
          `<div style="font:700 10px Orbitron,monospace;color:#fde68a;margin-top:2px">AT ${c.speedKmh} KM/H${lost}</div>`;
      } else {
        crashCalloutRef.current.style.opacity = "0";
      }
    }

    if (fpsRef.current) {
      fpsRef.current.textContent = `${s.fps} FPS · ${s.effectiveQuality.toUpperCase()}`;
    }

    if (diagRef.current) {
      diagRef.current.textContent =
        `IN→FRAME ${s.inputLatencyMs.toFixed(1)}ms · AVG ${s.avgLatencyMs.toFixed(1)}ms · ${s.fps} FPS (${s.effectiveQuality.toUpperCase()})`;
    }

    // weather rule chip + rail-grind balance meter + new feature meters
    const hx = hudExtraRef.current;
    if (hx) {
      const parts: string[] = [];
      if (s.weatherFx) {
        parts.push(`<div style="background:rgba(0,0,0,0.55);border:1px solid rgba(253,224,71,0.5);border-radius:999px;padding:3px 10px;font:800 9px Orbitron,monospace;letter-spacing:.08em;color:#fde68a">${esc(s.weatherFx)}</div>`);
      }
      // hyperspace warp portal: shards + live bonus-zone timer
      if (s.warpZone > 0) {
        parts.push(`<div style="background:rgba(59,7,100,0.75);border:1px solid rgba(216,180,254,0.8);border-radius:999px;padding:3px 10px;font:900 9px Orbitron,monospace;letter-spacing:.14em;color:#e9d5ff">HYPERSPACE ${s.warpZone.toFixed(1)}s</div>`);
      } else if (s.shards > 0) {
        parts.push(`<div style="background:rgba(0,0,0,0.55);border:1px solid rgba(192,132,252,0.6);border-radius:999px;padding:3px 10px;font:900 9px Orbitron,monospace;letter-spacing:.14em;color:#d8b4fe">SHARDS ${"◆".repeat(s.shards)}${"◇".repeat(3 - s.shards)}</div>`);
      }
      // power-up fusion buff
      if (s.fusion) {
        const names: Record<string, string> = {
          vortex: "ELECTROMAGNETIC VORTEX",
          singularity: "COIN SINGULARITY",
          phase: "PHASE SHIFT",
        };
        parts.push(`<div style="background:rgba(0,0,0,0.6);border:1px solid rgba(103,232,249,0.8);border-radius:999px;padding:3px 10px;font:900 9px Orbitron,monospace;letter-spacing:.1em;color:#a5f3fc">⚡ ${esc(names[s.fusion] ?? s.fusion.toUpperCase())}</div>`);
      }
      // slingshot slipstream meter
      if (s.sling > 0.02) {
        const pct = Math.round(Math.min(1, s.sling) * 100);
        const ready = s.sling >= 1;
        parts.push(`<div style="background:rgba(0,0,0,0.6);border:1px solid ${ready ? "#fb923c" : "rgba(251,146,60,0.5)"};border-radius:10px;padding:3px 8px;min-width:130px">
          <div style="font:900 8px Orbitron,monospace;letter-spacing:.18em;color:${ready ? "#fdba74" : "rgba(253,186,116,0.8)"};text-align:center">${ready ? "SLINGSHOT READY · JUMP/X" : "DRAFTING… CHARGE"}</div>
          <div style="height:4px;background:rgba(255,255,255,0.12);border-radius:2px;margin-top:3px">
            <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#f97316,#fdba74);border-radius:2px"></div>
          </div></div>`);
      }
      // interactive toll boost
      if (s.tollBoost > 0) {
        parts.push(`<div style="background:rgba(0,0,0,0.55);border:1px solid rgba(251,191,36,0.75);border-radius:999px;padding:3px 10px;font:900 9px Orbitron,monospace;letter-spacing:.12em;color:#fde68a">TOLL BOOST +${s.tollBoost} ×</div>`);
      }
      // co-op shared cargo
      if (s.coop) {
        const cargo = Math.max(0, Math.min(1, s.coop.packageHp));
        const col = cargo > 0.6 ? "#4ade80" : cargo > 0.25 ? "#fbbf24" : "#f87171";
        parts.push(`<div style="background:rgba(0,0,0,0.6);border:1px solid ${col};border-radius:10px;padding:3px 8px;min-width:140px">
          <div style="font:900 8px Orbitron,monospace;letter-spacing:.16em;color:${col};text-align:center">SHARED CARGO · P2 ${s.coop.p2Alive ? "ONLINE" : "DOWN"}</div>
          <div style="height:5px;background:rgba(255,255,255,0.12);border-radius:2px;margin-top:3px">
            <div style="height:100%;width:${Math.round(cargo * 100)}%;background:${col};border-radius:2px"></div>
          </div></div>`);
      }
      if (s.grinding) {
        const pos = Math.max(-1, Math.min(1, s.grindBalance));
        const col = Math.abs(pos) > 0.7 ? "#f87171" : "#67e8f9";
        parts.push(`<div style="background:rgba(0,0,0,0.6);border:1px solid ${col};border-radius:10px;padding:4px 8px;min-width:150px">
          <div style="font:900 8px Orbitron,monospace;letter-spacing:.2em;color:${col};text-align:center">BALANCE · STEER TO CORRECT</div>
          <div style="position:relative;height:6px;background:rgba(255,255,255,0.15);border-radius:3px;margin-top:4px">
            <div style="position:absolute;left:50%;top:-2px;width:2px;height:10px;background:rgba(255,255,255,0.6)"></div>
            <div style="position:absolute;top:-3px;left:${50 + pos * 48}%;width:12px;height:12px;margin-left:-6px;border-radius:50%;background:${col}"></div>
          </div></div>`);
      }
      if (s.wheelie > 0) {
        parts.push(`<div style="font:900 11px Orbitron,monospace;color:#fde047;text-shadow:0 0 10px #fde047">WHEELIE ${s.wheelie.toFixed(1)}s</div>`);
      }
      hx.innerHTML = parts.join("");
    }
    const nb = nitroBtnRef.current;
    if (nb) {
      const pct = Math.round(s.nitroMeter * 100);
      const ready = s.nitroMeter >= 1 && s.nitro <= 0;
      nb.style.background = `linear-gradient(90deg, ${ready ? "#f97316" : "rgba(249,115,22,0.55)"} ${pct}%, rgba(0,0,0,0.55) ${pct}%)`;
      nb.style.boxShadow = ready ? "0 0 18px rgba(249,115,22,0.8)" : "none";
      nb.textContent = ready ? "NITRO READY [N]" : `NITRO ${pct}%`;
    }
    const pb = prestigeBtnRef.current;
    if (pb) {
      pb.style.display = s.prestigeReady || s.prestige ? "block" : "none";
      pb.textContent = s.prestige ? "ENDLESS+ ×2" : "GO ENDLESS+ [G]";
      pb.style.pointerEvents = s.prestige ? "none" : "auto";
    }

    const wr = wantedRef.current;
    if (wr) {
      if (s.wanted > 0) {
        wr.style.opacity = "1";
        wr.innerHTML =
          `<span style="font:900 9px Orbitron,monospace;letter-spacing:.2em;color:#93c5fd">WANTED</span>` +
          Array.from({ length: 5 }, (_, i) =>
            `<span style="color:${i < s.wanted ? "#f87171" : "rgba(255,255,255,0.18)"};font-size:13px;line-height:1">★</span>`
          ).join("");
      } else wr.style.opacity = "0";
    }

    const p = pupRef.current;
    if (p) {
      const pills: [string, number, string][] = [];
      if (s.nitro > 0) pills.push(["NITRO", s.nitro / 5, "#ff8c42"]);
      if (s.magnet > 0) pills.push(["MAGNET", s.magnet / 8, "#22d3ee"]);
      if (s.warp > 0) pills.push(["SLOW-MO", s.warp / 6, "#c4b5fd"]);
      if (s.shield) pills.push(["SHIELD", 1, "#a5f3fc"]);
      if (s.rescueTickets > 0) pills.push([`RESCUE ×${s.rescueTickets}`, 1, "#fde68a"]);
      p.innerHTML = pills.map(([n, f, c]) =>
        `<div style="background:rgba(0,0,0,0.45);border:1px solid ${c}66;border-radius:9px;padding:3px 7px;min-width:74px">
           <div style="font:700 8px Orbitron,monospace;letter-spacing:.12em;color:${c}">${esc(n)}</div>
           <div style="height:3px;background:rgba(255,255,255,0.15);border-radius:2px;margin-top:3px">
             <div style="height:100%;width:${Math.round(Math.max(0, Math.min(1, f)) * 100)}%;background:${c};border-radius:2px"></div>
           </div>
         </div>`).join("");
    }
  }, []);

  const onGameOver = useCallback((run: RunResult, ghost: Parameters<typeof applyRun>[2]) => {
    void clipRecorder.stop().then((blob) => {
      if (blob) setRunClip(blob);
    });
    let cupEntry: Profile["cupHistory"][number] | null = null;
    if (run.mode === "tournament" && tournamentRef.current) {
      const cur = tournamentRef.current;
      const totalTurnsDone = cur.p1Heats.length + cur.p2Heats.length;
      const isP1Turn = totalTurnsDone % 2 === 0;
      const nextCup: CupState = {
        ...cur,
        p1Heats: isP1Turn ? [...cur.p1Heats, run.score] : cur.p1Heats,
        p2Heats: !isP1Turn ? [...cur.p2Heats, run.score] : cur.p2Heats,
      };
      tournamentRef.current = nextCup;
      setTournament(nextCup);
      if (nextCup.p1Heats.length >= 3 && nextCup.p2Heats.length >= 3) {
        const p1Total = nextCup.p1Heats.reduce((a, b) => a + b, 0);
        const p2Total = nextCup.p2Heats.reduce((a, b) => a + b, 0);
        const p1Won = p1Total >= p2Total;
        cupEntry = {
          winner: p1Won ? nextCup.p1Name : nextCup.p2Name,
          runnerUp: p1Won ? nextCup.p2Name : nextCup.p1Name,
          winnerTotal: Math.max(p1Total, p2Total),
          runnerTotal: Math.min(p1Total, p2Total),
          p1Name: nextCup.p1Name,
          p2Name: nextCup.p2Name,
          p1Heats: nextCup.p1Heats,
          p2Heats: nextCup.p2Heats,
          date: new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        };
      }
    }

    setProfile((prev) => {
      const res = applyRun(prev, run, ghost, activeSeason());
      const { completed, newBadges, levelUp, ticketsEarned, streakBonusCoins, chainUnlocks } = res;
      let applied = res.profile;
      // career contracts are scored against their objective; improvements pay out
      let careerStars = 0;
      let careerFirstClear = false;
      if (run.careerId) {
        const contract = CAREER.find((c) => c.id === run.careerId);
        if (contract) {
          careerStars = careerStarsFor(run, contract);
          const prevStars = applied.careerStars[String(contract.id)] ?? 0;
          if (careerStars > prevStars) {
            careerFirstClear = prevStars === 0;
            applied = {
              ...applied,
              careerStars: { ...applied.careerStars, [String(contract.id)]: careerStars },
              wallet: applied.wallet + (careerStars - prevStars) * 120,
            };
          }
        }
      }
      const next: Profile = cupEntry
        ? {
            ...applied,
            tournamentWins: applied.tournamentWins + 1,
            cupHistory: [cupEntry, ...applied.cupHistory].slice(0, 10),
          }
        : applied;
      saveProfile(next);
      rotateBackups(next); // Automatic Save Recovery: rolling snapshot after every run
      // weekly runs are stored under "weekly:<weekKey>" — the game-over lookup
      // must use the same bucket or rank/NEW BEST read an empty board
      const key = leaderboardKey(run.mode, run.difficulty, run.weekKey);
      const list = filterBoard(next.scores[key] ?? [], "all");
      const rank = list.findIndex((e) => e.score === run.score && e.distance === run.distance);
      const prevBest = filterBoard(prev.scores[key] ?? [], "all")[0]?.score ?? 0;
      setFinal({
        run, isBest: run.score > prevBest && run.score > 0,
        rank, completed, badges: newBadges, levelUp, ticketsEarned,
        streakBonusCoins, chainUnlocks, careerStars, careerFirstClear,
      });
      return next;
    });

    /* ---- World Exploration collectibles: merge finds + completion rewards ---- */
    if (run.collected && run.collected.length > 0) {
      const prevOwned = sanitizeCollections(settings.collectiblesOwned);
      const merged = [...new Set([...prevOwned, ...run.collected])];
      set("collectiblesOwned", merged);
      // world completion bonus
      const worldIds = new Set(run.collected
        .map((id) => COLLECTIBLES.find((c) => c.id === id)?.worldId)
        .filter(Boolean) as string[]);
      for (const w of worldIds) {
        const pool = collectiblesForWorld(w);
        const done = pool.every((c) => merged.includes(c.id));
        const wasDone = pool.every((c) => prevOwned.includes(c.id));
        if (done && !wasDone && COLLECTION_REWARDS[w]) {
          const rw = COLLECTION_REWARDS[w];
          setProfile((p) => {
            const nx = {
              ...p,
              wallet: p.wallet + rw.coins,
              ownedDecals: p.ownedDecals.includes(rw.decalId) ? p.ownedDecals : [...p.ownedDecals, rw.decalId],
            };
            saveProfile(nx);
            rotateBackups(nx);
            return nx;
          });
          setTimeout(() => showToast(`COLLECTION COMPLETE · ${rw.decalName} unlocked +${rw.coins} coins`, 4200), 1400);
        }
      }
    }

    /* ---- Daily Bounties: fold this run's best values into today's progress ---- */
    if (run.mode !== "practice" && run.mode !== "zen") {
      const statValues: Partial<Record<BountyStat, number>> = {
        nearMisses: run.nearMisses,
        maxCombo: run.maxCombo,
        coins: run.coins,
        tolls: run.tolls,
        tunnelDistance: Math.round(run.tunnelDistance),
        perfectDodges: run.perfectDodges,
        stuntChain: run.stuntChain,
        slingshots: run.slingshots ?? 0,
        flungPolice: run.flungPolice ?? 0,
        distanceNoBrake: run.brakeUsed ? 0 : Math.round(run.distance),
        wheelieTime: +Number(run.wheelieTime ?? 0).toFixed(1),
        grindTime: +Number(run.grindTime ?? 0).toFixed(1),
        jumps: run.jumps ?? 0,
      };
      const bs = todayBounties(today);
      const progress = { ...bountyState.progress };
      let newlyDone: string[] = [];
      for (const b of bs) {
        if (bountyState.claimed.includes(b.id)) continue;
        const v = statValues[b.stat] ?? 0;
        const best = Math.max(progress[b.id] ?? 0, v);
        if (best > (progress[b.id] ?? 0)) {
          progress[b.id] = best;
          if (best >= b.target) newlyDone.push(b.label);
        }
      }
      if (newlyDone.length) {
        saveBountyState({ ...bountyState, progress });
        setTimeout(() => showToast(`BOUNTY READY TO CLAIM: ${newlyDone[0]}`, 3600), 900);
      } else if (bountyState.progress !== progress) {
        saveBountyState({ ...bountyState, progress });
      }
    }
  }, []);

  // create engine once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new Engine(canvas, { onPhase: setPhase, onStats, onGameOver }, settings);
    engineRef.current = engine;
    engine.setMultiplier(multiplierFor(profile.missionSet));
    engine.setGhost(profile.ghost);
    sfx.setMuted(stored.muted);
    sfx.setMusicEnabled(settings.music);
    return () => {
      clipRecorder.abort();
      engine.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { engineRef.current?.updateCallbacks({ onGameOver }); }, [onGameOver]);

  useEffect(() => {
    engineRef.current?.applySettings(settings);
    try { localStorage.setItem(LS_SETTINGS, JSON.stringify({ ...settings, muted })); } catch { /* ignore */ }
  }, [settings, muted]);

  useEffect(() => {
    engineRef.current?.setMultiplier(multiplier);
    engineRef.current?.setGhost(settings.ghostOn ? (sharedGhost ?? profile.ghost) : null);
  }, [multiplier, profile.ghost, settings.ghostOn]);

  // daily streak on first load
  useEffect(() => {
    setProfile((p) => {
      const { profile: next, bonus } = touchStreak(p);
      saveProfile(next);
      if (bonus > 0) {
        setStreakBonus(bonus);
        setTimeout(() => setStreakBonus(0), 5200);
      }
      return next;
    });
  }, []);

  // PWA install prompt
  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      (window as unknown as { __wwrInstall?: InstallPromptEvent | null }).__wwrInstall = null; // consume
      setInstallEvt(e as InstallPromptEvent);
    };
    const installed = () => {
      setInstallEvt(null);
      showToast("Installed! Launch Wrong Way Rider from your home screen", 3600);
    };
    window.addEventListener("beforeinstallprompt", h);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", h);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  const tapUi = () => { sfx.unlock(); sfx.ui(); };

  // single toast slot: a new message cancels the previous clear-timer
  const toastTimer = useRef<number | null>(null);
  const showToast = (msg: string, ms = 2400) => {
    if (toastTimer.current !== null) clearTimeout(toastTimer.current);
    setCopiedMsg(msg);
    toastTimer.current = window.setTimeout(() => setCopiedMsg(""), ms);
  };
  useEffect(() => () => { if (toastTimer.current !== null) clearTimeout(toastTimer.current); }, []);

  // Persistent per-mode settings profile: switching modes saves & restores per-mode steering + HUD tuning!
  const copyText = async (text: string, msg: string) => {
    try { await navigator.clipboard.writeText(text); showToast(msg); }
    catch { showToast("Copy blocked — select and copy manually"); }
  };

  const shareGhost = () => {
    const ghost = profile.ghost;
    if (!ghost || ghost.length < 5) {
      showToast("Finish a Classic run to record a ghost");
      return;
    }
    void copyText(`${location.origin}${location.pathname}?g=${encodeGhost(ghost)}`, "Ghost link copied — friends race your exact line");
  };

  const doImport = () => {
    const p = importProfile(importText);
    if (!p) { setImportMsg("That code is not a valid profile."); return; }
    setProfile(p);
    saveProfile(p);
    setImportText("");
    setImportMsg("Profile imported.");
  };

  const requestTilt = async () => {    const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
    if (DOE?.requestPermission) {
      try { if ((await DOE.requestPermission()) !== "granted") return false; } catch { return false; }
    }
    return true;
  };

  const switchMode = (nextMode: Mode) => {
    setSettings((s) => {
      const savedOverrides = {
        ...(s.modeOverrides ?? {}),
        [s.mode]: { steering: s.steering, hudScale: s.hudScale, hudBottom: s.hudBottom },
      };
      const target = savedOverrides[nextMode];
      return {
        ...s,
        mode: nextMode,
        steering: target?.steering ?? (nextMode === "zen" ? "relaxed" : s.steering),
        hudScale: target?.hudScale ?? s.hudScale,
        hudBottom: target?.hudBottom ?? s.hudBottom,
        modeOverrides: savedOverrides,
      };
    });
  };

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setSettings((s) => {
      const next = { ...s, [k]: v };
      if (k === "steering" || k === "hudScale" || k === "hudBottom") {
        next.modeOverrides = {
          ...(next.modeOverrides ?? {}),
          [next.mode]: {
            steering: next.steering,
            hudScale: next.hudScale,
            hudBottom: next.hudBottom,
          },
        };
      }
      return next;
    });

  const toggleMute = () => { const m = !muted; setMuted(m); sfx.setMuted(m); };

  /** Builds the effective per-run settings (weekly mods, career contract, mastery, new-player ramp). */
  const runSettings = useCallback((base: Settings, careerId?: number): Settings => {
    const bikeMastery = masteryLevel(profile.bikeXp[base.bikeId] ?? 0);
    let eff: Settings = {
      ...base,
      upgrades: profile.upgrades,
      bikeMastery,
      newPlayer: profile.runs < 3,
      careerId: undefined,
      weekKey: undefined,
      deliveryDistance: undefined,
    };
    if (base.mode === "weekly") eff = { ...eff, modifiers: weekMods, weekKey };
    const contract = careerId ? CAREER.find((c) => c.id === careerId) : undefined;
    // seasonal event weather: applies its atmosphere when the player hasn't picked one
    const seasonNow = activeSeason();
    if (seasonNow && !contract && base.route.weather === "none" && base.mode !== "weekly") {
      eff = { ...eff, route: { ...eff.route, weather: seasonNow.weather } };
    }
    if (contract) {
      eff = {
        ...eff,
        mode: "career",
        careerId: contract.id,
        modifiers: [],
        deliveryDistance: contract.distance,
        route: {
          name: contract.name, seed: contract.seed, traffic: contract.traffic,
          hazards: contract.hazards, weather: contract.weather,
        },
      };
    }
    return eff;
  }, [profile.bikeXp, profile.upgrades, profile.runs, weekMods, weekKey]);

  const activeCareer = useRef<number | undefined>(undefined);

  /** Starts the engine with the effective settings and consumes any loadout items. */
  const launch = useCallback((careerId?: number) => {
    const eng = engineRef.current;
    if (!eng) return;
    if (settings.mode === "weekly" && !careerId) {
      const used = profile.weekly.key === weekKey ? profile.weekly.used : 0;
      if (used >= WEEKLY_ATTEMPTS) {
        showToast("No weekly attempts left — resets Monday.", 2600);
        return;
      }
    }
    activeCareer.current = careerId;
    const eff = runSettings(settings, careerId);
    // pre-run gadgets: only granted if equipped AND in inventory; consumed on launch
    const equipped: Partial<Record<GadgetId, boolean>> = {};
    const consumed: GadgetId[] = [];
    for (const g of GADGETS) {
      if (settings.gadgets?.[g.id] && (gadgetInv[g.id] ?? 0) > 0) {
        equipped[g.id] = true;
        consumed.push(g.id);
      }
    }
    eff.gadgets = equipped;
    eng.applySettings(eff);
    // a consumable ticket is only spent if the engine can actually use it (cap is 3)
    const extraTicket = loadout.ticket && profile.consumables.ticket > 0 && profile.rescueTickets < 3 ? 1 : 0;
    eng.setRescueTickets(profile.rescueTickets + extraTicket);
    setRunClip(null);
    eng.start();
    // Keep only the rolling final 10 seconds. Duel owns separate canvases and skips this recorder.
    if (settings.mode !== "duel" && canvasRef.current) clipRecorder.start(canvasRef.current, 10);
    const useShield = loadout.shield && profile.consumables.shield > 0;
    if (useShield) eng.grantStartShield();
    if (useShield || extraTicket || consumed.length) {
      setProfile((p) => {
        const nx = {
          ...p,
          consumables: {
            shield: p.consumables.shield - (useShield ? 1 : 0),
            ticket: p.consumables.ticket - extraTicket,
          },
        };
        saveProfile(nx);
        return nx;
      });
      if (consumed.length) {
        const nextInv = { ...gadgetInv };
        for (const id of consumed) nextInv[id] = Math.max(0, (nextInv[id] ?? 0) - 1);
        saveGadgetInv(nextInv);
      }
      setLoadout({ shield: false, ticket: false });
    }
  }, [settings, profile.weekly, profile.rescueTickets, profile.consumables, loadout, runSettings, weekKey, gadgetInv]);

  const startCareer = (id: number) => {
    tapUi();
    setPanel(null);
    setFinal(null);
    sfx.unlock();
    launch(id);
  };

  /** Ride again from game over: career replays its contract, everything else restarts. */
  const rideAgain = useCallback(() => {
    setFinal(null);
    launch(activeCareer.current);
  }, [launch]);

  const startRun = useCallback(() => {
    if (!profile.seenTutorial) {
      setProfile((p) => {
        const nx = { ...p, tutorial: { ...p.tutorial, started: p.tutorial.started + 1 } };
        saveProfile(nx);
        return nx;
      });
      setTutorial(true);
      return;
    }
    setPanel(null);
    setFinal(null);
    sfx.unlock();
    if (settings.mode === "duel") {
      setDuelActive(true);
      setPhase("playing");
      return;
    }
    if (settings.mode === "tournament" && !tournamentRef.current) {
      const initCup: CupState = {
        p1Name: cupNames[0].trim() || "RIDER 1",
        p2Name: cupNames[1].trim() || "RIDER 2",
        p1Heats: [],
        p2Heats: [],
      };
      tournamentRef.current = initCup;
      setTournament(initCup);
    }
    launch();
  }, [profile.seenTutorial, settings, cupNames, setPanel, launch]);

  const nextTournamentRound = useCallback(() => {
    const t = tournamentRef.current;
    if (!t) return;
    if (t.p1Heats.length >= 3 && t.p2Heats.length >= 3) {
      tournamentRef.current = null;
      setTournament(null);
      setFinal(null);
      engineRef.current?.backToMenu();
      return;
    }
    setFinal(null);
    launch();
  }, [launch]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (panel || tutorial) return;
      if ((e.key === " " || e.key === "Enter") && phase === "ready") {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "SELECT") return;
        e.preventDefault();
        startRun();
      } else if ((e.key === " " || e.key === "Enter" || e.key === "r" || e.key === "R") && phase === "over") {
        e.preventDefault();
        if (settings.mode === "tournament") nextTournamentRound();
        else rideAgain();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, panel, tutorial, startRun, settings.mode, nextTournamentRound, rideAgain]);

  const buy = (id: string, price: number, key: string) => {
    if (profile.owned.includes(id) || profile.wallet < price) return;
    setProfile((p) => {
      // fresh-state re-check: a fast double-click must not double-spend or duplicate the item
      if (p.owned.includes(id) || p.wallet < price) return p;
      const next = { ...p, wallet: p.wallet - price, owned: [...p.owned, id] };
      saveProfile(next);
      return next;
    });
    if (price > 0) {
      set(key as keyof Settings, id as never);
      sfx.powerup();
    }
  };

  const finishTutorial = (stepReached: number, skipped: boolean) => {
    setTutorial(false);
    setProfile((p) => {
      const reached = [...p.tutorial.stepReached];
      for (let i = 0; i <= Math.min(stepReached, reached.length - 1); i++) reached[i] += 1;
      const next = {
        ...p,
        seenTutorial: true,
        tutorial: {
          ...p.tutorial,
          finished: p.tutorial.finished + (skipped ? 0 : 1),
          skipped: p.tutorial.skipped + (skipped ? 1 : 0),
          stepReached: reached,
        },
      };
      saveProfile(next);
      return next;
    });
    setTimeout(() => {
      if (settings.mode === "duel") {
        setDuelActive(true);
        setPhase("playing");
      } else {
        launch();
      }
    }, 60);
  };

  const cycleBike = (dir: number) => {
    tapUi();
    const owned = BIKES.filter((b) => profile.owned.includes(b.id));
    if (owned.length < 2) {
      setPanel("shop");
      return;
    }
    const idx = Math.max(0, owned.findIndex((b) => b.id === settings.bikeId));
    const next = owned[(idx + dir + owned.length) % owned.length];
    set("bikeId", next.id);
  };

  const doShare = async () => {
    if (!final || sharing) return;
    setSharing(true);
    try {
      const blob = await buildScoreCard(final.run, settings, {
        level: lvl.level, title: titleFor(lvl.level), multiplier,
        rebirths: profile.rebirths,
        badges: profile.badges.map((b) => BADGES.find((x) => x.id === b)?.name ?? "").filter(Boolean),
      });
      if (blob) await shareOrDownload(blob, `I scored ${final.run.score.toLocaleString()} in Wrong Way Rider!`);
    } catch {
      showToast("Could not build the score card");
    } finally {
      setSharing(false);
    }
  };

  const custom: CustomTheme = settings.customTheme ?? DEFAULT_CUSTOM;
  const updateCustom = (patch: Partial<CustomTheme>) =>
    setSettings((s) => ({ ...s, customTheme: { ...(s.customTheme ?? DEFAULT_CUSTOM), ...patch }, useCustom: true }));
  const updateRoute = (patch: Partial<Settings["route"]>) =>
    setSettings((s) => ({ ...s, mode: "route", route: { ...s.route, ...patch } }));

  const shareLink = `${location.origin}${location.pathname}?t=${encodeCustom(custom)}`;
  const routeLink = `${location.origin}${location.pathname}?route=${settings.route.seed},${settings.route.traffic},${settings.route.hazards},${settings.route.weather}`;
  const season = activeSeason();

  const purchaseUpgrade = (id: string, base: number, max: number) => {
    const current = profile.upgrades[id] ?? 0;
    const price = base * (current + 1);
    if (current >= max || profile.wallet < price) return;
    setProfile((p) => {
      // fresh-state re-check: a fast double-click must not double-charge
      const lvl = p.upgrades[id] ?? 0;
      const cost = base * (lvl + 1);
      if (lvl >= max || p.wallet < cost) return p;
      const next = { ...p, wallet: p.wallet - cost, upgrades: { ...p.upgrades, [id]: lvl + 1 } };
      saveProfile(next);
      return next;
    });
    sfx.powerup();
  };

  // Mystery Crate with Legendary Pity Timer (guarantees Legendary at 5 opens!)
  const openCrate = () => {
    if (profile.crates <= 0 || crateReveal) return; // reveal guard kills the double-open race
    const all = [...BIKES, ...HELMETS, ...JACKETS, ...TRAILS, ...HORNS];
    const locked = all.filter((c) => !profile.owned.includes(c.id));
    const pityTriggered = pityGuaranteed(profile.cratePity);
    // Golden Crate Key from daily bounties: this open is guaranteed Legendary
    const goldenKey = bountyState.goldenKeyAwarded;
    const legendPool = locked.filter((c) => rarityOf(c.price) === "legendary");
    const epicPool = locked.filter((c) => rarityOf(c.price) === "epic");
    const guaranteed = pityTriggered || (goldenKey && legendPool.length > 0);
    const pool = guaranteed
      ? (legendPool.length ? legendPool : epicPool.length ? epicPool : locked)
      : locked;
    const reward = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    const gotLegendary = !!reward && rarityOf(reward.price) === "legendary";

    setProfile((p) => {
      const pityAfter = nextPity(p.cratePity, gotLegendary);
      const next = reward
        ? { ...p, crates: p.crates - 1, cratePity: pityAfter, owned: p.owned.includes(reward.id) ? p.owned : [...p.owned, reward.id] }
        : { ...p, crates: p.crates - 1, cratePity: 0, wallet: p.wallet + (guaranteed ? 600 : 250) };
      saveProfile(next);
      rotateBackups(next);
      return next;
    });
    if (goldenKey) {
      saveBountyState({ ...bountyState, goldenKeyAwarded: false });
      showToast("GOLDEN CRATE KEY spent — Legendary guaranteed!", 3200);
    }
    sfx.powerup();
    setCrateReveal(
      reward
        ? `${gotLegendary ? "★ LEGENDARY · " : ""}${reward.name} unlocked!`
        : `+${pityTriggered ? 600 : 250} bonus coins!`
    );
  };

  const claimGuideReward = (tierCount: number, reward: number) => {
    setProfile((p) => {
      if (p.claimedGuideTiers.includes(tierCount)) return p;
      const next = {
        ...p,
        wallet: p.wallet + reward,
        claimedGuideTiers: [...p.claimedGuideTiers, tierCount],
      };
      saveProfile(next);
      return next;
    });
    sfx.powerup();
  };

  const copyRouteLink = async () => {
    try { await navigator.clipboard.writeText(routeLink); } catch { /* clipboard can be blocked */ }
    tapUi();
  };

  // Long-press on HUD SCORE toggles hidden input-latency diagnostic overlay
  const beginScoreHold = () => {
    if (scoreHoldTimer.current) clearTimeout(scoreHoldTimer.current);
    scoreHoldTimer.current = window.setTimeout(() => {
      setShowLatencyDiag((v) => !v);
      sfx.ui();
    }, 520);
  };
  const endScoreHold = () => {
    if (scoreHoldTimer.current) {
      clearTimeout(scoreHoldTimer.current);
      scoreHoldTimer.current = null;
    }
  };

  const updateCupName = (idx: 0 | 1, val: string) => {
    const next: [string, string] = idx === 0 ? [val, cupNames[1]] : [cupNames[0], val];
    setCupNames(next);
    try { localStorage.setItem(LS_CUP_NAMES, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const renderWorldFilter = () => (
    <div className="mb-2 flex gap-1 overflow-x-auto pb-1">
      <button
        onClick={() => { tapUi(); setWorldFilter("all"); }}
        className={`btn-neon shrink-0 rounded-lg px-2 py-1 font-display text-[8px] font-bold ${worldFilter === "all" ? "text-black" : "bg-white/10 text-white/65"}`}
        style={worldFilter === "all" ? { background: accent } : {}}
      >
        ALL
      </button>
      {THEMES.map((t) => (
        <button
          key={t.id}
          onClick={() => { tapUi(); setWorldFilter(t.id); }}
          className={`btn-neon shrink-0 rounded-lg px-2 py-1 font-display text-[8px] font-bold ${worldFilter === t.id ? "text-black" : "bg-white/10 text-white/65"}`}
          style={worldFilter === t.id ? { background: t.accent } : {}}
        >
          {t.name.split(" ")[0].toUpperCase()}
        </button>
      ))}
    </div>
  );

  // Cup turn info helper
  const cupTurnInfo = useMemo(() => {
    if (!tournament) return null;
    const done = tournament.p1Heats.length + tournament.p2Heats.length;
    const finished = done >= 6;
    const isP1Next = done % 2 === 0;
    const nextRider = isP1Next ? tournament.p1Name : tournament.p2Name;
    const heatNum = Math.min(3, Math.floor(done / 2) + 1);
    const p1Total = tournament.p1Heats.reduce((a, b) => a + b, 0);
    const p2Total = tournament.p2Heats.reduce((a, b) => a + b, 0);
    return { done, finished, nextRider, heatNum, p1Total, p2Total };
  }, [tournament]);

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: theme.sky[0][1] }}>
      <canvas ref={canvasRef} className={`absolute inset-0 block ${duelActive ? "opacity-0" : ""}`} />

      {duelActive && (
        <DuelRace
          settings={{ ...settings, upgrades: profile.upgrades }}
          multiplier={multiplier}
          onExit={() => { setDuelActive(false); setPhase("ready"); switchMode("classic"); engineRef.current?.backToMenu(); }}
          onWin={() => setProfile((p) => { const n = { ...p, duelWins: p.duelWins + 1 }; saveProfile(n); return n; })}
        />
      )}

      {/* ================= HUD ================= */}
      <div
        style={{ transform: `scale(${settings.hudScale})`, transformOrigin: "top center", top: `${settings.hudBottom}px` }}
        className={`pointer-events-none absolute inset-x-0 z-10 flex items-start justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))] transition-opacity duration-300 ${phase === "playing" || phase === "paused" ? "opacity-100" : "opacity-0"} ${duelActive ? "hidden" : ""}`}
      >
        <div className="flex flex-col gap-1">
          <div
            onMouseDown={beginScoreHold}
            onMouseUp={endScoreHold}
            onMouseLeave={endScoreHold}
            onTouchStart={beginScoreHold}
            onTouchEnd={endScoreHold}
            title="Long-press to toggle input latency HUD"
            className="pointer-events-auto cursor-pointer rounded-xl bg-black/40 px-3 py-1.5 backdrop-blur-sm select-none"
          >
            <div className="flex items-center gap-1.5">
              <div className="font-display text-[10px] font-bold tracking-widest" style={{ color: accent }}>SCORE</div>
              {multiplier > 1 && (
                <div className="rounded px-1 font-display text-[9px] font-black text-black" style={{ background: accent }}>
                  ×{multiplier.toFixed(1)}
                </div>
              )}
            </div>
            <span
              ref={scoreRef}
              className="font-display inline-block origin-left text-2xl font-black text-white transition-transform duration-75"
              style={{ textShadow: `0 0 12px ${accent}` }}
            >
              0
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl bg-black/40 px-2.5 py-1 backdrop-blur-sm">
            <CoinIcon size={16} />
            <span ref={coinsRef} className="font-display text-sm font-bold text-yellow-300">0</span>
          </div>
          {settings.showFps && (
            <div ref={fpsRef} className="rounded-lg bg-black/45 px-2 py-0.5 font-mono text-[9px] text-emerald-300" />
          )}
          {showLatencyDiag && (
            <div ref={diagRef} className="rounded-lg border border-cyan-400/40 bg-[#050c1a]/85 px-2.5 py-1 font-mono text-[9px] text-cyan-200 shadow" />
          )}
          <div ref={pupRef} className="flex flex-col gap-1" />
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="pointer-events-auto flex gap-2">
            <button onClick={toggleMute} className="btn-neon flex h-10 w-10 items-center justify-center rounded-xl bg-black/40 text-white backdrop-blur-sm" aria-label="Sound">
              {muted ? <SoundOffIcon size={20} /> : <SoundOnIcon size={20} />}
            </button>
            <button onClick={() => engineRef.current?.pause()} className="btn-neon flex h-10 w-10 items-center justify-center rounded-xl bg-black/40 text-white backdrop-blur-sm" aria-label="Pause">
              <PauseIcon size={20} />
            </button>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl bg-black/40 px-2.5 py-1 backdrop-blur-sm">
            <span style={{ color: accent }}><SpeedIcon size={16} /></span>
            <span ref={speedRef} className="font-display text-lg font-bold" style={{ color: accent }}>50</span>
            <span className="font-display text-[9px] text-white/50">KM/H</span>
          </div>
          <div ref={timerRef} className="hidden items-center gap-1.5 rounded-xl bg-black/50 px-3 py-1 font-display text-lg font-black text-white backdrop-blur-sm" />
        </div>
      </div>

      {/* Live combo + push-your-luck Combo Bank pill */}
      <div className="pointer-events-none absolute left-1/2 top-[16.5%] z-10 flex -translate-x-1/2 flex-col items-center gap-1.5">
        <div ref={comboRef} className="flex items-center gap-2 opacity-0 transition-opacity">
          <FlameIcon size={26} />
          <span className="font-display text-stroke text-2xl font-black tracking-wider text-yellow-300 [text-shadow:0_0_20px_rgba(255,224,102,0.9)]" />
        </div>
        <button
          ref={bankBtnRef}
          onClick={() => engineRef.current?.inputBankCombo()}
          onTouchStart={(e) => { e.preventDefault(); engineRef.current?.inputBankCombo(); }}
          className="btn-neon rounded-full border border-cyan-300/60 bg-[#0b1930]/85 px-3 py-1 font-display text-[9px] font-black tracking-widest text-cyan-200 opacity-0 shadow-[0_0_16px_rgba(103,232,249,0.4)] backdrop-blur-sm transition-opacity"
        >
          BANK COMBO
        </button>
      </div>

      <div ref={hudExtraRef} className="pointer-events-none absolute left-1/2 top-[40%] z-10 flex -translate-x-1/2 flex-col items-center gap-1.5" />
      {phase === "playing" && !duelActive && (
        <div className="pointer-events-none absolute right-3 top-[150px] z-10 flex flex-col items-end gap-1.5">
          <button
            ref={nitroBtnRef}
            onClick={() => engineRef.current?.inputNitro()}
            onTouchStart={(e) => { e.preventDefault(); engineRef.current?.inputNitro(); }}
            className="pointer-events-auto w-32 rounded-xl border border-orange-300/50 px-2 py-1.5 font-display text-[9px] font-black tracking-widest text-white"
          >
            NITRO 0%
          </button>
          <button
            ref={prestigeBtnRef}
            onClick={() => engineRef.current?.inputPrestige()}
            onTouchStart={(e) => { e.preventDefault(); engineRef.current?.inputPrestige(); }}
            style={{ display: "none" }}
            className="pointer-events-auto w-32 rounded-xl border border-pink-300/60 bg-pink-600/70 px-2 py-1.5 font-display text-[9px] font-black tracking-widest text-white"
          >
            GO ENDLESS+
          </button>
        </div>
      )}
      <div ref={trickRef} className="pointer-events-none absolute left-1/2 top-[28%] z-10 -translate-x-1/2 font-display text-stroke text-xl font-black tracking-[0.2em] text-cyan-300 opacity-0 transition-opacity" />
      <div ref={wantedRef} className="pointer-events-none absolute left-1/2 top-[8.5%] z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-blue-400/40 bg-[#0b1733]/80 px-3 py-1 opacity-0 backdrop-blur-sm transition-opacity" />

      {/* 1.5s Crash Cam "What Hit You" Callout */}
      <div
        ref={crashCalloutRef}
        className="pointer-events-none absolute left-1/2 top-[34%] z-20 -translate-x-1/2 rounded-2xl border border-red-400/50 bg-[#1a0510]/90 px-5 py-3 text-center opacity-0 shadow-[0_12px_40px_rgba(0,0,0,0.75)] backdrop-blur-md transition-opacity"
      />

      {/* ================= touch controls ================= */}
      {isTouch && phase === "playing" && !duelActive && (
        <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end p-4 pb-[max(1rem,env(safe-area-inset-bottom))] ${settings.lefty ? "flex-row-reverse" : ""} justify-between`}>
          <div className={`flex items-end gap-3 ${settings.lefty ? "flex-row-reverse" : ""}`}>
            <button onTouchStart={(e) => { e.preventDefault(); engineRef.current?.inputDrift(-1); }}
              className="pointer-events-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur-sm active:bg-white/25" aria-label="Left">
              <SteerIcon size={28} />
            </button>
            <button onTouchStart={(e) => { e.preventDefault(); engineRef.current?.inputDrift(1); }}
              className="pointer-events-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur-sm active:bg-white/25" aria-label="Right">
              <span className="rotate-180"><SteerIcon size={28} /></span>
            </button>
          </div>
          <div className={`flex items-end gap-3 ${settings.lefty ? "flex-row-reverse" : ""}`}>
            <button
              onTouchStart={(e) => { e.preventDefault(); engineRef.current?.inputWheelie(true); }}
              onTouchEnd={(e) => { e.preventDefault(); engineRef.current?.inputWheelie(false); }}
              className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 font-display text-[9px] font-black text-yellow-200 backdrop-blur-sm active:bg-white/25"
              aria-label="Hold for wheelie"
            >
              WHEELIE
            </button>
            <button onTouchStart={(e) => { e.preventDefault(); engineRef.current?.inputBrake(); }}
              className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur-sm active:bg-white/25" aria-label="Brake and tuck">
              <span className="font-display text-sm font-black">▼</span>
            </button>
            <button onTouchStart={(e) => { e.preventDefault(); engineRef.current?.inputHorn(); }}
              className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur-sm active:bg-white/25" aria-label="Horn">
              <HornIcon size={24} />
            </button>
            <button onTouchStart={(e) => { e.preventDefault(); engineRef.current?.inputJump(); }}
              className="pointer-events-auto flex h-20 w-20 items-center justify-center rounded-full text-white active:scale-95"
              style={{ background: theme.accentSoft, border: `2px solid ${accent}` }} aria-label="Jump">
              <JumpIcon size={34} />
            </button>
          </div>

          {/* ---- Co-op second rider touch cluster (top-right, P2 drives with these) ---- */}
          {settings.mode === "coop" && phase === "playing" && (
            <div className="pointer-events-none absolute right-3 top-3 z-25 flex flex-col items-end gap-2">
              <div className="pointer-events-none rounded-lg bg-lime-400/15 px-2 py-1 font-display text-[8px] font-black tracking-widest text-lime-200">
                P2 · ARROWS/SPACE OR TAP HERE
              </div>
              <div className="flex items-center gap-2">
                <button
                  onTouchStart={(e) => { e.preventDefault(); engineRef.current?.inputMoveP2(-1); }}
                  className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-lime-300/50 bg-lime-400/15 font-display text-lg font-black text-lime-200 backdrop-blur-sm active:bg-lime-400/35"
                  aria-label="P2 left">◀</button>
                <button
                  onTouchStart={(e) => { e.preventDefault(); engineRef.current?.inputJumpP2(); }}
                  className="pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full border border-lime-300/60 bg-lime-400/20 font-display text-[9px] font-black text-lime-100 backdrop-blur-sm active:scale-95"
                  aria-label="P2 jump">P2<br />JUMP</button>
                <button
                  onTouchStart={(e) => { e.preventDefault(); engineRef.current?.inputMoveP2(1); }}
                  className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-lime-300/50 bg-lime-400/15 font-display text-lg font-black text-lime-200 backdrop-blur-sm active:bg-lime-400/35"
                  aria-label="P2 right">▶</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* crate drop reveal */}
      {crateReveal && (
        <div className="pop-in absolute left-1/2 top-16 z-40 -translate-x-1/2 rounded-2xl border border-fuchsia-400/50 bg-fuchsia-500/25 px-5 py-2.5 text-center backdrop-blur-md">
          <div className="flex items-center justify-center gap-2">
            <SparkleIcon size={20} />
            <span className="font-display text-xs font-black tracking-widest text-fuchsia-100">CRATE DROP</span>
          </div>
          <div className="mt-0.5 font-display text-[10px] text-white/90">{crateReveal}</div>
          <button onClick={() => setCrateReveal("")} className="mt-1 font-display text-[8px] tracking-widest text-white/55">TAP TO DISMISS</button>
        </div>
      )}

      {/* tournament named bracket HUD pill */}
      {cupTurnInfo && !cupTurnInfo.finished && settings.mode === "tournament" && phase === "playing" && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-2xl border border-yellow-400/40 bg-[#1b1002]/85 px-4 py-1.5 text-center backdrop-blur-md">
          <div className="flex items-center justify-center gap-1.5 font-display text-[9px] font-black tracking-widest text-yellow-200">
            <TrophyIcon size={14} />
            <span>{cupTurnInfo.nextRider} · HEAT {cupTurnInfo.heatNum}/3</span>
          </div>
          <div className="mt-0.5 font-display text-[8px] text-white/65">
            {tournament?.p1Name}: {cupTurnInfo.p1Total.toLocaleString()} · {tournament?.p2Name}: {cupTurnInfo.p2Total.toLocaleString()}
          </div>
        </div>
      )}

      {copiedMsg && (
        <div className="pop-in absolute left-1/2 top-16 z-50 -translate-x-1/2 rounded-xl border border-cyan-300/40 bg-[#071a2b]/90 px-4 py-2 font-display text-[10px] font-bold text-cyan-100 backdrop-blur-md">
          {copiedMsg}
        </div>
      )}
      {sharedGhost && settings.ghostOn && phase === "ready" && (
        <div className="pointer-events-none absolute left-1/2 top-[86px] z-30 -translate-x-1/2 rounded-full border border-cyan-300/50 bg-black/60 px-3 py-1 font-display text-[9px] font-black tracking-widest text-cyan-200">
          RACING A SHARED GHOST
        </div>
      )}

      {/* streak toast */}
      {streakBonus > 0 && (
        <div className="pop-in absolute left-1/2 top-4 z-40 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-500/20 px-4 py-2 backdrop-blur-md">
          <CalendarIcon size={20} />
          <span className="font-display text-xs font-bold text-emerald-200">
            DAY {profile.streak} STREAK · +{streakBonus} COINS
          </span>
        </div>
      )}

      {/* ================= HOME SCREEN ================= */}
      {phase === "ready" && !tutorial && !duelActive && (
        <HomeScreen
          profile={profile}
          settings={settings}
          theme={theme}
          accent={accent}
          level={lvl.level}
          levelInto={lvl.into}
          levelNeed={lvl.need}
          title={titleFor(lvl.level)}
          multiplier={multiplier}
          missions={missions}
          best={best}
          muted={muted}
          modes={MODES}
          diffs={DIFFS}
          cupNames={cupNames}
          installAvailable={(!!installEvt || (IOS_DEVICE && !isStandalone())) && !isStandalone()}
          weekly={{
            used: profile.weekly.key === weekKey ? profile.weekly.used : 0,
            best: profile.weekly.key === weekKey ? profile.weekly.best : 0,
            attempts: WEEKLY_ATTEMPTS,
            mods: weekMods.map((m) => MODIFIERS.find((x) => x.id === m)?.name ?? m).join(" + "),
          }}
          careerDone={Object.values(profile.careerStars).filter((v) => v > 0).length}
          careerTotal={CAREER.length}
          season={season ? { name: season.name, tagline: season.tagline, accent: season.accent } : null}
          onPlay={startRun}
          onOpenPanel={(p: HomePanel) => setPanel(p as Panel)}
          onToggleMute={() => { tapUi(); toggleMute(); }}
          onCycleBike={cycleBike}
          onSelectMode={switchMode}
          onSelectDifficulty={(d) => set("difficulty", d)}
          onCupName={updateCupName}
          onInstall={async () => {
            const e = installEvt;
            if (e?.prompt) {
              try { await e.prompt(); } catch { /* user dismissed */ }
              setInstallEvt(null);
            } else if (IOS_DEVICE) {
              showToast("iOS install: tap Share, then Add to Home Screen", 4200);
            } else {
              showToast("Install via your browser menu: “Install app” / “Add to Home screen”", 4200);
            }
          }}
          onPokeRider={() => { sfx.unlock(); sfx.horn(settings.hornId); sfx.nitro(); }}
          onUi={tapUi}
        />
      )}

      {/* ================= WHAT'S NEW (v1.0) ================= */}
      {whatsNew && (
        <Modal title={`WHAT'S NEW · v${GAME_VERSION}`} icon={<SparkleIcon size={18} />} accent="#ff4da6" onClose={dismissWhatsNew}>
          <div className="rounded-xl border border-pink-400/30 bg-pink-500/10 p-3">
            <div className="font-display text-xs font-black tracking-widest text-pink-200">THE GAME JUST GOT BIGGER</div>
            <div className="mt-0.5 text-[10px] text-white/55">
              13 new systems shipped in this update. Your saves, ghosts and cosmetics all carry over — jump in anywhere.
            </div>
          </div>
          <ul className="mt-3 flex flex-col gap-1.5">
            {WHATSNEW.map((line, i) => (
              <li key={i} className="flex items-start gap-2 rounded-lg border border-white/8 bg-black/25 px-2.5 py-1.5">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-pink-500/30 font-display text-[8px] font-black text-pink-200">{i + 1}</span>
                <span className="text-[10px] leading-snug text-white/80">{line}</span>
              </li>
            ))}
          </ul>
          <button onClick={() => { tapUi(); sfx.chime(); dismissWhatsNew(); }}
            className="btn-neon mt-4 w-full rounded-2xl py-3 font-display text-sm font-black tracking-widest text-white"
            style={{ background: "linear-gradient(180deg,#4ade80,#15803d)" }}>
            LET'S RIDE
          </button>
          <div className="mt-1.5 text-center text-[8px] text-white/35">build {GAME_BUILD} · this panel lives in Settings and Profile → About</div>
        </Modal>
      )}

      {/* ================= ATTRACT DEMO (v1.0) ================= */}
      {attract && profile.lastReplay.length > 0 && (
        <div
          className="fade-in absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#05020d]/94 backdrop-blur-md"
          onPointerDown={() => setAttract(false)}
          role="button"
          aria-label="Dismiss demo"
        >
          <div className="mb-2 rounded-full border border-fuchsia-300/40 bg-fuchsia-500/15 px-4 py-1 font-display text-[10px] font-black tracking-[0.3em] text-fuchsia-200">
            ATTRACT MODE · YOUR LAST RUN
          </div>
          <div className="w-full max-w-lg px-4" onPointerDown={(e) => e.stopPropagation()}>
            <ReplayTheater frames={profile.lastReplay} settings={settings} theme={theme} autoPlay />
          </div>
          <div className="mt-3 animate-pulse font-display text-[10px] font-bold tracking-[0.25em] text-white/60">
            TAP ANYWHERE OR PRESS ANY KEY TO PLAY
          </div>
        </div>
      )}

      {/* ================= INTERACTIVE TUTORIAL ================= */}
      {tutorial && (
        <InteractiveTutorial
          isTouch={isTouch}
          accent={accent}
          theme={theme}
          riderLook={{ bikeId: settings.bikeId, helmetId: settings.helmetId, jacketId: settings.jacketId }}
          onFinish={finishTutorial}
        />
      )}

      {/* ================= PANELS ================= */}
      {panel === "garage" && (
        <Modal title="RIDER GARAGE" icon={<BikeIcon size={18} />} accent={accent} onClose={() => setPanel(null)}>
          <RiderPreview bikeId={settings.bikeId} helmetId={settings.helmetId} jacketId={settings.jacketId}
            trailId={settings.trailId} theme={theme} />
          <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[9px] text-white/55">
            <span>{getChoice(BIKES, settings.bikeId).name}</span><span>·</span>
            <span>{getChoice(HELMETS, settings.helmetId).name} helmet</span><span>·</span>
            <span>{getChoice(JACKETS, settings.jacketId).name} jacket</span><span>·</span>
            <span>Plate: {settings.plateText}</span>
          </div>
          <div className="mt-2 rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-3 py-1.5 text-center text-[9px] text-cyan-100/80">
            Wallet: <strong className="text-yellow-300">{profile.wallet} coins</strong> · Locked items show exact coins/runs needed (tap any locked card to open Shop, or earn free Crates every level-up — next LVL in {Math.max(1, lvl.need - lvl.into)} XP).
          </div>
          {(() => {
            const st = BIKE_STATS[settings.bikeId];
            const xp = profile.bikeXp[settings.bikeId] ?? 0;
            const ml = masteryLevel(xp);
            const nextXp = Math.pow(ml + 1, 2) * 600;
            const bar = (label: string, v: number) => (
              <div key={label} className="flex items-center gap-2">
                <span className="w-16 font-display text-[9px] font-bold text-white/65">{label}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full rounded-full" style={{ width: `${Math.min(100, (v / 1.25) * 100)}%`, background: accent }} />
                </span>
                <span className="w-9 text-right font-mono text-[9px] text-white/60">{v.toFixed(2)}</span>
              </div>
            );
            return (
              <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="mb-2 flex items-center justify-between font-display text-[10px] font-bold tracking-[0.2em] text-white/75">
                  <span>{getChoice(BIKES, settings.bikeId).name.toUpperCase()} STATS</span>
                  <span style={{ color: accent }}>MASTERY {ml}/5</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {bar("HANDLING", st.handling)}
                  {bar("ACCEL", st.accel)}
                  {bar("JUMP", st.jump)}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-amber-300" style={{ width: `${ml >= 5 ? 100 : Math.min(100, (xp / nextXp) * 100)}%` }} />
                </div>
                <div className="mt-1 text-[9px] text-white/50">
                  {ml >= 3 ? <span className="text-emerald-300">Passive active: {st.passive}</span> : <>Mastery 3 unlocks: {st.passive}</>}
                  {ml < 5 && <> · {xp.toLocaleString()} / {nextXp.toLocaleString()} XP</>}
                </div>
              </div>
            );
          })()}
          <div className="mt-4 flex flex-col gap-3">
            <ChoiceGrid label="BIKE" icon={<BikeIcon size={14} />} options={BIKES} selected={settings.bikeId}
              owned={profile.owned} wallet={profile.wallet} avgCoins={avgRunCoins}
              onSelect={(v) => { tapUi(); set("bikeId", v as Settings["bikeId"]); }}
              onOpenShop={() => { tapUi(); setPanel("shop"); }} accent={accent} />
            <ChoiceGrid label="HELMET" icon={<HelmetIcon size={14} />} options={HELMETS} selected={settings.helmetId}
              owned={profile.owned} wallet={profile.wallet} avgCoins={avgRunCoins}
              onSelect={(v) => { tapUi(); set("helmetId", v as Settings["helmetId"]); }}
              onOpenShop={() => { tapUi(); setPanel("shop"); }} accent={accent} />
            <ChoiceGrid label="JACKET" icon={<JacketIcon size={14} />} options={JACKETS} selected={settings.jacketId}
              owned={profile.owned} wallet={profile.wallet} avgCoins={avgRunCoins}
              onSelect={(v) => { tapUi(); set("jacketId", v as Settings["jacketId"]); }}
              onOpenShop={() => { tapUi(); setPanel("shop"); }} accent={accent} />
            <ChoiceGrid label="TRAIL" icon={<FlameIcon size={14} />} options={TRAILS} selected={settings.trailId}
              owned={profile.owned} wallet={profile.wallet} avgCoins={avgRunCoins}
              onSelect={(v) => { tapUi(); set("trailId", v as Settings["trailId"]); }}
              onOpenShop={() => { tapUi(); setPanel("shop"); }} accent={accent} />
            <ChoiceGrid label="HORN" icon={<HornIcon size={14} />} options={HORNS} selected={settings.hornId}
              owned={profile.owned} wallet={profile.wallet} avgCoins={avgRunCoins}
              onSelect={(v) => { tapUi(); sfx.horn(v as Settings["hornId"]); set("hornId", v as Settings["hornId"]); }}
              onOpenShop={() => { tapUi(); setPanel("shop"); }} accent={accent} />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="mb-1 font-display text-[10px] font-bold tracking-[0.2em] text-white/70">DECAL</div>
                <Seg
                  options={[{ id: "bolt", name: "BOLT" }, { id: "flame", name: "FLAME" }, { id: "star", name: "STAR" }, { id: "none", name: "NONE" }]}
                  value={settings.decal}
                  onChange={(v) => { tapUi(); set("decal", v); }}
                  accent={accent}
                />
              </div>
              <label className="block font-display text-[10px] font-bold tracking-[0.2em] text-white/70">
                PLATE TEXT
                <input
                  value={settings.plateText}
                  maxLength={7}
                  onChange={(e) => set("plateText", e.target.value.toUpperCase())}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-2.5 py-1.5 font-display text-xs font-black tracking-widest text-yellow-200 uppercase outline-none"
                />
              </label>
            </div>

            {/* ---- Saved Rider Loadouts ---- */}
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="mb-2 font-display text-[10px] font-bold tracking-[0.2em] text-white/70">SAVED LOADOUTS ({loadoutList.length}/{MAX_LOADOUTS})</div>
              <div className="flex gap-2">
                <input
                  value={loadoutName}
                  maxLength={18}
                  onChange={(e) => setLoadoutName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); } }}
                  placeholder="Name this build…"
                  className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/45 px-2.5 py-1.5 text-xs font-bold text-white outline-none focus:border-white/40"
                />
                <button
                  onClick={() => {
                    if (loadoutList.length >= MAX_LOADOUTS) { showToast("Loadout slots full — delete one first"); return; }
                    const l = makeLoadout(loadoutName, {
                      bikeId: settings.bikeId, helmetId: settings.helmetId, jacketId: settings.jacketId,
                      trailId: settings.trailId, hornId: settings.hornId, companion: settings.companion,
                      wheelStyle: settings.wheelStyle, wheelColor: settings.wheelColor,
                    });
                    saveLoadoutList([...loadoutList, l]);
                    setLoadoutName("");
                    showToast(`Loadout "${l.name}" saved`);
                  }}
                  className="btn-neon shrink-0 rounded-lg bg-white/10 px-3 py-1.5 font-display text-[9px] font-black text-white"
                >
                  SAVE CURRENT
                </button>
              </div>
              {loadoutList.length > 0 && (
                <div className="mt-2 flex flex-col gap-1.5">
                  {loadoutList.map((l, idx) => (
                    <div key={l.name + idx} className="flex items-center gap-2 rounded-lg bg-black/25 px-2 py-1.5">
                      <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-white/85">{l.name}</span>
                      <span className="truncate text-[8px] text-white/40">{l.bikeId} · {l.helmetId} · {l.companion}</span>
                      <button
                        onClick={() => {
                          tapUi();
                          setSettings((s) => ({ ...s, bikeId: l.bikeId as Settings["bikeId"], helmetId: l.helmetId as Settings["helmetId"], jacketId: l.jacketId as Settings["jacketId"], trailId: l.trailId as Settings["trailId"], hornId: l.hornId as Settings["hornId"], companion: l.companion, wheelStyle: l.wheelStyle, wheelColor: l.wheelColor }));
                          showToast(`"${l.name}" equipped`);
                        }}
                        className="btn-neon rounded-md bg-white/10 px-2 py-1 font-display text-[8px] font-black text-emerald-300"
                      >
                        APPLY
                      </button>
                      <button
                        onClick={() => saveLoadoutList(loadoutList.filter((_, i) => i !== idx))}
                        className="btn-neon rounded-md bg-white/10 px-2 py-1 font-display text-[8px] font-black text-rose-300"
                      >
                        DEL
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ---- Home Garage customization ---- */}
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="mb-2 font-display text-[10px] font-bold tracking-[0.2em] text-white/70">HOME GARAGE</div>
              <div className="mb-1.5 text-[9px] text-white/45">Dress the podium your hero rider poses on.</div>
              <div className="mb-1 font-display text-[9px] tracking-widest text-white/55">PODIUM</div>
              <Seg options={[
                { id: "neon", name: "NEON" }, { id: "chrome", name: "CHROME" },
                { id: "wood", name: "WOOD" }, { id: "marble", name: "MARBLE" },
              ]} value={settings.garagePodium} onChange={(v) => { tapUi(); set("garagePodium", v); }} accent={accent} />
              <div className="mb-1 mt-2 font-display text-[9px] tracking-widest text-white/55">LIGHTING</div>
              <Seg options={[
                { id: "spot", name: "SPOT" }, { id: "neon", name: "NEON BAR" },
                { id: "sunset", name: "SUNSET" }, { id: "midnight", name: "MIDNIGHT" },
              ]} value={settings.garageLight} onChange={(v) => { tapUi(); set("garageLight", v); }} accent={accent} />
              <div className="mb-1 mt-2 font-display text-[9px] tracking-widest text-white/55">WALL</div>
              <Seg options={[
                { id: "none", name: "PLAIN" }, { id: "city", name: "CITY POSTER" },
                { id: "race", name: "RACE FLAGS" }, { id: "retro", name: "RETRO SUN" },
              ]} value={settings.garagePoster} onChange={(v) => { tapUi(); set("garagePoster", v); }} accent={accent} />
              <div className="mb-1 mt-2 font-display text-[9px] tracking-widest text-white/55">TROPHY SHELF</div>
              <Seg options={[
                { id: "none", name: "EMPTY" }, { id: "bronze", name: "BRONZE" },
                { id: "silver", name: "SILVER" }, { id: "gold", name: "GOLD" },
              ]} value={settings.garageTrophy} onChange={(v) => { tapUi(); set("garageTrophy", v); }} accent={accent} />
            </div>

            {/* ---- Wheel Lab: live wheel customization ---- */}
            <WheelLab
              style={settings.wheelStyle}
              color={settings.wheelColor}
              onStyle={(v) => set("wheelStyle", v)}
              onColor={(c) => set("wheelColor", c)}
              accent={accent}
              tapUi={tapUi}
            />

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { tapUi(); setPanel("painter"); }}
                className="btn-neon rounded-xl border border-white/15 bg-white/5 py-2.5 font-display text-[10px] font-black tracking-widest text-white">
                VINYL PAINTER
              </button>
              <button onClick={() => { tapUi(); setPanel("horn"); }}
                className="btn-neon rounded-xl border border-white/15 bg-white/5 py-2.5 font-display text-[10px] font-black tracking-widest text-white">
                HORN STUDIO
              </button>
            </div>

            <div>
              <div className="mb-1.5 flex items-center gap-2 font-display text-[10px] font-bold tracking-[0.24em] text-white/70">
                <SteerIcon size={14} /> STEERING ({settings.mode.toUpperCase()} PROFILE)
              </div>
              <Seg options={STEERING} value={settings.steering} onChange={(v) => { tapUi(); set("steering", v); }} accent={accent} />
            </div>
          </div>
        </Modal>
      )}

      {panel === "shop" && (
        <Modal title="COIN SHOP" icon={<ShopIcon size={18} />} accent={accent} onClose={() => setPanel(null)}>
          <Shop
            profile={profile}
            settings={settings}
            theme={theme}
            accent={accent}
            onBuy={(id, price, key) => buy(id, price, key)}
            onEquip={(key, id) => set(key as keyof Settings, id as never)}
          />
        </Modal>
      )}

      {panel === "missions" && (
        <Modal title="MISSIONS" icon={<MissionIcon size={18} />} accent={accent} onClose={() => setPanel(null)}>
          <div className="mb-3 rounded-xl border border-white/10 bg-black/30 p-3 text-center">
            <div className="font-display text-[10px] tracking-[0.25em] text-white/60">CURRENT MULTIPLIER</div>
            <div className="font-display text-4xl font-black" style={{ color: accent }}>×{multiplier.toFixed(1)}</div>
            <div className="mt-1 text-[10px] text-white/50">Completing all 3 advances your multiplier (max ×30) AND grants +1 Rescue Ticket!</div>
          </div>
          <div className="flex flex-col gap-2">
            {missions.map((m) => {
              const prog = Math.min(profile.missionProgress[m.id] ?? 0, m.target);
              const pct = (prog / m.target) * 100;
              const done = prog >= m.target;
              return (
                <div key={m.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="flex items-center gap-2">
                    <span className={done ? "text-emerald-400" : "text-white/30"}><CheckIcon size={16} /></span>
                    <span className={`flex-1 text-xs ${done ? "text-emerald-300" : "text-white/85"}`}>{m.label}</span>
                    <span className="font-display text-[10px] text-white/50">{prog}/{m.target}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: done ? "#4ade80" : accent }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 text-center text-[10px] text-white/45">
            Set {profile.missionSet + 1} · Rescue Tickets held: {profile.rescueTickets}/3 (also earned from Boss wins &amp; every 5 runs)
          </div>

          <div className="mt-4 border-t border-white/10 pt-3">
            <BountyBoard
              state={bountyState}
              today={today}
              accent={accent}
              onClaim={(id) => {
                const b = todayBounties(today).find((x) => x.id === id);
                if (!b || bountyState.claimed.includes(id)) return;
                const value = bountyState.progress[id] ?? 0;
                if (value < b.target) return;
                const claimed = [...bountyState.claimed, id];
                const gain = bountyReward(b);
                let goldenNow = false;
                let next: DailyBountyState;
                const allDone = todayBounties(today).every((x) => claimed.includes(x.id));
                if (allDone && !bountyState.goldenKeyAwarded) {
                  goldenNow = true;
                  next = { ...bountyState, claimed, goldenKeyAwarded: true };
                } else {
                  next = { ...bountyState, claimed };
                }
                saveBountyState(next);
                setProfile((p) => {
                  const nx = { ...p, wallet: p.wallet + gain + (goldenNow ? GOLDEN_KEY_REWARD : 0) };
                  saveProfile(nx);
                  rotateBackups(nx);
                  return nx;
                });
                sfx.cashIn();
                showToast(goldenNow ? "GOLDEN CRATE KEY! Next crate is guaranteed Legendary" : `Bounty complete +${gain} coins`, 3400);
              }}
            />
          </div>
        </Modal>
      )}

      {panel === "profile" && (
        <Modal title="RIDER PROFILE & TELEMETRY" icon={<LevelIcon size={18} />} accent={accent} onClose={() => setPanel(null)}>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center">
            <div className="font-display text-3xl font-black text-white">LVL {lvl.level}</div>
            <div className="font-display text-sm font-bold" style={{ color: accent }}>{titleFor(lvl.level)} · [{settings.plateText}]</div>
            <div className="mx-auto mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full" style={{ width: `${(lvl.into / lvl.need) * 100}%`, background: accent }} />
            </div>
            <div className="mt-1 text-[10px] text-white/45">{lvl.into} / {lvl.need} XP</div>
          </div>

          {/* 7-Cell Streak Calendar Grid */}
          <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-display text-[10px] font-bold tracking-[0.2em] text-white/75">
                <CalendarIcon size={14} /> 7-DAY STREAK CALENDAR
              </span>
              <span className="font-display text-xs font-black text-emerald-300">{profile.streak} DAY{profile.streak === 1 ? "" : "S"}</span>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {streakDays.map((d) => (
                <div
                  key={d.key}
                  className={`flex flex-col items-center justify-center rounded-xl border py-2 ${
                    d.played
                      ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                      : "border-white/10 bg-black/30 text-white/35"
                  } ${d.isToday ? "ring-1 ring-white/50" : ""}`}
                >
                  <span className="font-display text-[9px] font-bold">{d.label}</span>
                  <span className="mt-1 h-4 w-4 rounded-full flex items-center justify-center bg-black/25">
                    {d.played ? <CheckIcon size={11} /> : <span className="text-[9px]">·</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Analytics-Free Local Play Telemetry */}
          <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-display text-[10px] font-bold tracking-[0.2em] text-white/75">
                LAST 10 RUNS (LOCAL TELEMETRY)
              </span>
              <div className="flex gap-1">
                {(["score", "distance"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setTelemetryMetric(m)}
                    className={`rounded px-2 py-0.5 font-display text-[8px] font-bold ${telemetryMetric === m ? "text-black" : "bg-white/10 text-white/60"}`}
                    style={telemetryMetric === m ? { background: accent } : {}}
                  >
                    {m === "score" ? "SCORE" : "DIST"}
                  </button>
                ))}
              </div>
            </div>

            {profile.runHistory.length > 0 ? (
              <>
                <svg viewBox="0 0 260 64" className="h-16 w-full overflow-visible rounded-lg bg-black/35 p-1.5">
                  {(() => {
                    const vals = profile.runHistory.map((r) => (telemetryMetric === "score" ? r.score : r.distance));
                    const max = Math.max(1, ...vals);
                    const pts = vals.map((v, idx) => {
                      const x = vals.length === 1 ? 130 : 12 + (idx / (vals.length - 1)) * 236;
                      const y = 54 - (v / max) * 44;
                      return `${x},${y}`;
                    });
                    return (
                      <>
                        <polyline
                          fill="none"
                          stroke={accent}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={pts.join(" ")}
                        />
                        {vals.map((v, idx) => {
                          const x = vals.length === 1 ? 130 : 12 + (idx / (vals.length - 1)) * 236;
                          const y = 54 - (v / max) * 44;
                          return <circle key={idx} cx={x} cy={y} r="3.2" fill="#ffe066" />;
                        })}
                      </>
                    );
                  })()}
                </svg>
                <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                  <div className="rounded-lg bg-black/35 p-1.5">
                    <div className="font-display text-xs font-black text-white">{telemetrySummary.avgDist}m</div>
                    <div className="text-[7px] tracking-widest text-white/45">AVG LENGTH</div>
                  </div>
                  <div className="rounded-lg bg-black/35 p-1.5">
                    <div className="font-display text-xs font-black text-white">{telemetrySummary.avgScore.toLocaleString()}</div>
                    <div className="text-[7px] tracking-widest text-white/45">AVG SCORE</div>
                  </div>
                  <div className="rounded-lg bg-black/35 p-1.5">
                    <div className="truncate font-display text-[10px] font-black text-rose-300">{telemetrySummary.nemesis}</div>
                    <div className="text-[7px] tracking-widest text-white/45">TOP WIPEOUT</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-3 text-center text-[10px] text-white/45">Complete a run to populate local sparkline telemetry.</div>
            )}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              ["RUNS", profile.runs], ["DUEL WINS", profile.duelWins],
              ["LIFETIME", profile.lifetimeCoins.toLocaleString()],
            ].map(([l, v]) => (
              <div key={l as string} className="rounded-xl border border-white/10 bg-black/30 p-2">
                <div className="font-display text-base font-black text-white">{v}</div>
                <div className="text-[8px] tracking-widest text-white/40">{l}</div>
              </div>
            ))}
          </div>

          {/* Persistent Named Cup History */}
          {profile.cupHistory.length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 font-display text-[10px] font-bold tracking-[0.24em] text-yellow-200/80">CUP TROPHY HISTORY</div>
              <div className="flex flex-col gap-1.5">
                {profile.cupHistory.slice(0, 5).map((c, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-xl border border-yellow-400/25 bg-yellow-400/10 px-3 py-2 text-xs">
                    <div>
                      <span className="font-display font-black text-yellow-200">🏆 {c.winner}</span>
                      <span className="ml-1.5 text-[10px] text-white/55">def. {c.runnerUp}</span>
                    </div>
                    <div className="text-right">
                      <span className="block font-display text-[10px] font-bold text-white">{c.winnerTotal.toLocaleString()} pts</span>
                      <span className="block text-[8px] text-white/45">{c.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ---- v1.0 Lifetime Log ---- */}
          <div className="mt-4 rounded-2xl border border-cyan-300/25 bg-cyan-400/5 p-3">
            <div className="mb-2 font-display text-[10px] font-black tracking-[0.24em] text-cyan-200">LIFETIME LOG</div>
            <div className="grid grid-cols-4 gap-1.5 text-center">
              {([
                ["RIDES", profile.runs],
                ["DISTANCE", profile.lifetime.distance >= 10000 ? `${(profile.lifetime.distance / 1000).toFixed(1)}k` : profile.lifetime.distance],
                ["NEAR MISSES", profile.lifetime.nearMisses],
                ["STUNTS", profile.lifetime.stunts],
                ["PERFECTS", profile.lifetime.perfects],
                ["WIPEOUTS", profile.lifetime.crashes],
                ["DAYS RIDDEN", profile.playDates.length],
                ["COINS EARNED", profile.lifetime.coins >= 10000 ? `${(profile.lifetime.coins / 1000).toFixed(1)}k` : profile.lifetime.coins],
              ] as [string, string | number][]).map(([l, v]) => (
                <div key={l} className="rounded-lg bg-black/35 p-1.5">
                  <div className="font-display text-[11px] font-black text-white">{v}</div>
                  <div className="text-[6.5px] tracking-widest text-white/40">{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ---- v1.0 Rider Rebirth ---- */}
          <div className="mt-3 rounded-2xl border border-fuchsia-400/35 bg-fuchsia-500/8 p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-display text-[10px] font-black tracking-[0.24em] text-fuchsia-200">RIDER REBIRTH</span>
              <span className="font-display text-[10px] font-black text-white">
                ×{profile.rebirths} <span className="text-emerald-300">+{Math.round((prestigeMultiplier(profile.rebirths) - 1) * 100)}%</span>
              </span>
            </div>
            <p className="mb-2 text-[9px] leading-snug text-white/55">
              Prestige: reset your level to 1 and keep everything you own — coins, gear, career, records.
              Each rebirth grants a permanent +5% coins &amp; score. Max {PRESTIGE_MAX}.
            </p>
            {profile.rebirths >= PRESTIGE_MAX ? (
              <div className="rounded-lg bg-fuchsia-400/15 py-2 text-center font-display text-[9px] font-black tracking-widest text-fuchsia-200">
                MAX REBIRTH — THE STREETS REMEMBER YOU
              </div>
            ) : lvl.level >= PRESTIGE_MIN_LEVEL ? (
              rebirthAsk ? (
                <div className="flex gap-2">
                  <button onClick={() => { tapUi(); setRebirthAsk(false); }}
                    className="btn-neon flex-1 rounded-lg border border-white/20 bg-white/5 py-2 font-display text-[9px] font-black tracking-widest text-white">
                    NOT YET
                  </button>
                  <button
                    onClick={() => {
                      tapUi();
                      setProfile((p) => {
                        const nx = doRebirth(p);
                        if (!nx) return p;
                        saveProfile(nx);
                        sfx.chime();
                        showToast(`REBIRTH ×${nx.rebirths}! Permanent +${Math.round((prestigeMultiplier(nx.rebirths) - 1) * 100)}% coins & score`, 3600);
                        return nx;
                      });
                      setRebirthAsk(false);
                    }}
                    className="btn-neon flex-1 rounded-lg bg-gradient-to-b from-fuchsia-400 to-fuchsia-700 py-2 font-display text-[9px] font-black tracking-widest text-white">
                    YES — REBIRTH NOW
                  </button>
                </div>
              ) : (
                <button onClick={() => { tapUi(); sfx.horn(settings.hornId); setRebirthAsk(true); }}
                  className="btn-neon w-full rounded-lg bg-gradient-to-b from-fuchsia-400 to-fuchsia-700 py-2 font-display text-[10px] font-black tracking-widest text-white">
                  REBIRTH NOW — LEVEL RESETS TO 1
                </button>
              )
            ) : (
              <div className="rounded-lg bg-black/35 py-2 text-center font-display text-[9px] font-bold tracking-widest text-white/50">
                REACH LEVEL {PRESTIGE_MIN_LEVEL} TO REBIRTH · NOW {lvl.level}
              </div>
            )}
          </div>

          {/* ---- v1.0 About / credits ---- */}
          <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-center">
            <div className="font-display text-[10px] font-black tracking-[0.24em] text-white/70">
              WRONG WAY RIDER · v{GAME_VERSION}
            </div>
            <div className="mt-0.5 text-[8px] text-white/40">build {GAME_BUILD} · runs 100% offline · no account, no tracking</div>
            <div className="mt-1 text-[9px] leading-snug text-white/50">
              A neon courier saga built for the open road. Every save, ghost and custom horn lives on your device.
            </div>
            <button onClick={() => { tapUi(); setWhatsNew(true); }}
              className="btn-neon mt-2 rounded-lg border border-pink-400/35 bg-pink-500/10 px-3 py-1.5 font-display text-[9px] font-black tracking-widest text-pink-200">
              WHAT'S NEW
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => { tapUi(); setPanel("photo"); }} className="btn-neon flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 py-2 font-display text-[10px] font-bold tracking-widest text-white">
              <CameraIcon size={15} /> PHOTO MODE
            </button>
            <div className="flex items-center justify-center gap-1.5 rounded-xl border border-orange-400/30 bg-orange-500/10 py-2 font-display text-[10px] font-black text-orange-200">
              <FlameIcon size={15} /> HOT STREAK ×{profile.hotStreak} (+{Math.round(hotStreakBonus(profile.hotStreak) * 100)}% coins)
            </div>
          </div>

          {(() => {
            const heat = deathHeatmap(profile.runHistory);
            const killers = Array.from(new Set(Object.keys(heat).map((k) => k.split("|")[1])));
            const max = Math.max(1, ...Object.values(heat));
            const top = Object.entries(heat).sort((a, b) => b[1] - a[1])[0];
            return (
              <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3">
                <div className="mb-2 font-display text-[10px] font-bold tracking-[0.2em] text-white/75">DEATH HEATMAP · LANE × CAUSE</div>
                {killers.length ? (
                  <>
                    <div className="grid gap-1" style={{ gridTemplateColumns: "92px repeat(3, 1fr)" }}>
                      <span />
                      {["LEFT", "CENTRE", "RIGHT"].map((l) => <span key={l} className="text-center font-display text-[8px] text-white/45">{l}</span>)}
                      {killers.slice(0, 5).map((k) => (
                        <div key={k} className="contents">
                          <span className="truncate font-display text-[8px] text-white/70">{k}</span>
                          {[-1, 0, 1].map((lane) => {
                            const v = heat[`${lane}|${k}`] ?? 0;
                            return (
                              <span key={lane} className="flex h-6 items-center justify-center rounded font-display text-[9px] font-black text-white"
                                style={{ background: v ? `rgba(248,113,113,${0.18 + (v / max) * 0.72})` : "rgba(255,255,255,0.05)" }}>
                                {v || ""}
                              </span>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                    {top && (
                      <div className="mt-2 text-[10px] text-rose-200">
                        You crash into {top[0].split("|")[1]} in the {["left", "centre", "right"][Number(top[0].split("|")[0]) + 1]} lane most often.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-[10px] text-white/45">Crash a few times and your weak spots show up here.</div>
                )}
              </div>
            );
          })()}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/10 bg-black/30 p-2.5">
              <div className="font-display text-[8px] font-bold tracking-widest text-white/55">FIRST-RUN MEDIAN</div>
              <div className={`font-display text-lg font-black ${profile.firstRuns.length && median(profile.firstRuns) < 400 ? "text-rose-300" : "text-emerald-300"}`}>
                {profile.firstRuns.length ? `${median(profile.firstRuns)}m` : "—"}
              </div>
              <div className="text-[8px] text-white/40">first {profile.firstRuns.length}/5 runs · target ≥ 400m</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-2.5">
              <div className="font-display text-[8px] font-bold tracking-widest text-white/55">TUTORIAL FUNNEL</div>
              <div className="font-display text-xs font-black text-white">{profile.tutorial.finished} done · {profile.tutorial.skipped} skipped</div>
              <div className="mt-1 flex gap-0.5">
                {profile.tutorial.stepReached.map((v, i) => (
                  <span key={i} className="flex-1 rounded-sm bg-cyan-400/70 text-center font-mono text-[7px] text-black" title={`Step ${i + 1}`}>{v}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 mb-2 font-display text-[10px] font-bold tracking-[0.24em] text-amber-200/90">TROPHY ROOM</div>
          <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-b from-[#2a1a08]/80 to-[#120a04]/90 p-3">
            {CHAINS.map((ch) => {
              const tier = profile.chainTiers[ch.id] ?? 0;
              const val = profile.lifetime[ch.id];
              const next = ch.tiers[tier];
              return (
                <div key={ch.id} className="mb-3 last:mb-0">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-display text-[10px] font-black text-amber-100">{ch.name}</span>
                    <span className="font-mono text-[9px] text-amber-200/70">{val.toLocaleString()}{next ? ` / ${next.toLocaleString()}` : " · MAXED"}</span>
                  </div>
                  <div className="flex items-end gap-2 border-b-4 border-amber-900/80 pb-1">
                    {TIER_NAMES.map((tn, i) => {
                      const got = i < tier;
                      const col = ["#cd7f32", "#d8dee9", "#fbbf24"][i];
                      return (
                        <div key={tn} className="flex flex-1 flex-col items-center">
                          <span className={got ? "" : "opacity-25 grayscale"} style={{ color: col, filter: got ? `drop-shadow(0 0 6px ${col})` : undefined }}>
                            <TrophyIcon size={22 + i * 4} />
                          </span>
                          <span className="font-display text-[7px] font-bold" style={{ color: got ? col : "rgba(255,255,255,0.3)" }}>{tn}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 mb-2 font-display text-[10px] font-bold tracking-[0.24em] text-white/70">ACHIEVEMENTS</div>
          {(() => {
            const got = profile.badges.length;
            const pct = Math.round((got / BADGES.length) * 100);
            return (
              <div className="mb-2 rounded-xl border border-yellow-400/25 bg-yellow-400/8 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-display text-[10px] font-black tracking-widest text-yellow-200">
                    {got} / {BADGES.length} UNLOCKED
                  </span>
                  <span className="font-display text-[10px] font-black text-yellow-100/80">{pct}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/50">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-200 transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })()}
          <div className="grid grid-cols-2 gap-2">
            {BADGES.map((b) => {
              const have = profile.badges.includes(b.id);
              return (
                <div key={b.id} className={`flex items-center gap-2 rounded-xl border p-2 ${have ? "border-yellow-400/40 bg-yellow-400/10" : "border-white/10 bg-black/30 opacity-50"}`}>
                  <span className={have ? "text-yellow-300" : "text-white/40"}>{have ? <TrophyIcon size={18} /> : <LockIcon size={16} />}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-display text-[10px] font-bold text-white">{b.name}</span>
                    <span className="block truncate text-[8px] text-white/45">{b.desc}</span>
                  </span>
                </div>
              );
            })}
          </div>
          {profile.ghostScore > 0 && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-3">
              <GhostIcon size={20} />
              <span className="flex-1 text-[11px] text-cyan-100">Ghost saved from your {profile.ghostScore.toLocaleString()} point run</span>
              <button onClick={() => { tapUi(); setProfile((p) => { const n = { ...p, ghost: null, ghostScore: 0 }; saveProfile(n); return n; }); }}
                className="btn-neon rounded-lg bg-white/10 px-2 py-1 font-display text-[9px] text-white">CLEAR</button>
            </div>
          )}
        </Modal>
      )}

      {panel === "themes" && (
        <Modal title="WORLDS & PALETTE" icon={<PaletteIcon size={18} />} accent={accent} onClose={() => setPanel(null)}>
          <Toggle label="DYNAMIC TIME OF DAY" hint="Sunset → twilight → storm → midnight → dawn"
            on={settings.dynamicTime} accent={accent} onClick={() => { tapUi(); set("dynamicTime", !settings.dynamicTime); }} />
          <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
            <ThemePreview theme={theme} />
          </div>
          <div className="mt-1 mb-2 text-center text-[9px] text-white/40">Live preview — tap any world or edit the palette to see it here</div>
          <div className="mb-2 font-display text-[10px] font-bold tracking-[0.24em] text-white/70">FIXED WORLDS</div>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((t) => {
              const active = !settings.useCustom && settings.themeId === t.id;
              return (
                <button key={t.id} onClick={() => { tapUi(); setSettings((s) => ({ ...s, themeId: t.id, useCustom: false })); }}
                  className={`btn-neon relative flex flex-col items-center gap-1 rounded-2xl border-2 p-2 ${active ? "bg-white/10" : "border-white/10 bg-black/30"}`}
                  style={active ? { borderColor: t.accent, boxShadow: `0 0 18px ${t.accentSoft}` } : {}}>
                  <span className="h-10 w-10 rounded-full border border-white/25"
                    style={{ background: `conic-gradient(from 0deg, ${t.swatch[0]}, ${t.swatch[1]}, ${t.swatch[2]}, ${t.swatch[0]})` }} />
                  <span className="font-display text-[9px] font-bold leading-tight text-white">{t.name}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-display text-[10px] font-bold tracking-[0.2em] text-white/80">
                <SparkleIcon size={14} /> CUSTOM PALETTE
              </span>
              <button onClick={() => { tapUi(); set("useCustom", !settings.useCustom); }}
                className="btn-neon rounded-lg px-2 py-1 font-display text-[9px] font-bold"
                style={{ background: settings.useCustom ? accent : "rgba(255,255,255,0.12)", color: settings.useCustom ? "#000" : "#fff" }}>
                {settings.useCustom ? "ACTIVE" : "USE"}
              </button>
            </div>
            <input value={custom.name} onChange={(e) => updateCustom({ name: e.target.value })} placeholder="Palette name"
              className="mb-2 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white outline-none" />
            <div className="grid grid-cols-3 gap-2">
              {([
                ["skyTop", "Sky top"], ["skyBottom", "Sky base"], ["ground", "Ground"],
                ["road", "Road"], ["edgeA", "Edge A"], ["edgeB", "Edge B"],
              ] as [keyof CustomTheme, string][]).map(([k, label]) => (
                <label key={k} className="flex flex-col items-center gap-1 rounded-lg bg-black/30 p-1.5">
                  <input type="color" value={custom[k] as string} onChange={(e) => updateCustom({ [k]: e.target.value } as Partial<CustomTheme>)}
                    className="h-7 w-full cursor-pointer rounded border-0 bg-transparent" />
                  <span className="text-[8px] text-white/50">{label}</span>
                </label>
              ))}
            </div>
            <div className="mt-2">
              <Seg options={(["none", "rain", "snow", "petals", "sand", "fireflies"] as Weather[]).map((w) => ({ id: w, name: w.toUpperCase() }))}
                value={custom.weather} onChange={(w) => updateCustom({ weather: w })} accent={accent} />
            </div>
            <button onClick={async () => {
              try { await navigator.clipboard.writeText(shareLink); } catch { /* clipboard blocked */ }
              tapUi();
            }} className="btn-neon mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2 font-display text-[10px] font-bold tracking-widest text-white">
              <ShareIcon size={14} /> COPY SHARE LINK
            </button>
          </div>
        </Modal>
      )}

      {panel === "route" && (
        <Modal title="ROUTE LAB" icon={<RulerIcon size={18} />} accent={accent} onClose={() => setPanel(null)}>
          {/* Live 4-second test ride preview of chosen seed/density/weather */}
          <RouteLivePreview
            route={settings.route}
            traffic={settings.route.traffic}
            hazards={settings.route.hazards}
            modifiers={settings.modifiers}
            theme={theme}
            riderLook={{ bikeId: settings.bikeId, helmetId: settings.helmetId, jacketId: settings.jacketId }}
          />

          <div className="mb-3 rounded-xl border border-white/10 bg-black/30 p-3">
            <div className="mb-2 font-display text-[10px] font-bold tracking-[0.25em] text-white/75">ROUTE PRESETS</div>
            <div className="grid grid-cols-2 gap-2">
              {ROUTE_PRESETS.map((r) => (
                <button key={r.name} onClick={() => { tapUi(); setSettings((s) => ({ ...s, mode: "route", route: { ...r } })); }}
                  className={`btn-neon rounded-xl border p-2 text-left ${settings.route.name === r.name ? "bg-white/10" : "border-white/10 bg-black/20"}`}
                  style={settings.route.name === r.name ? { borderColor: accent } : {}}>
                  <RouteThumbnail route={r} />
                  <span className="block font-display text-[10px] font-bold text-white">{r.name}</span>
                  <span className="block text-[8px] text-white/45">Seed {r.seed} · {r.weather === "none" ? "Clear" : r.weather}</span>
                </button>
              ))}
            </div>
          </div>
          <label className="mb-2 block font-display text-[10px] font-bold tracking-[0.2em] text-white/70">ROUTE NAME
            <input value={settings.route.name} onChange={(e) => updateRoute({ name: e.target.value })}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-xs text-white outline-none" />
          </label>
          <label className="mb-3 block font-display text-[10px] font-bold tracking-[0.2em] text-white/70">SEED
            <input type="number" value={settings.route.seed} onChange={(e) => updateRoute({ seed: Number(e.target.value) || 1 })}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-2 font-mono text-xs text-white outline-none" />
          </label>
          {([
            ["TRAFFIC DENSITY", settings.route.traffic, (v: number) => { updateRoute({ traffic: v }); }],
            ["HAZARD DENSITY", settings.route.hazards, (v: number) => { updateRoute({ hazards: v }); }],
          ] as [string, number, (v: number) => void][]).map(([label, value, change]) => (
            <label key={label} className="mb-3 block font-display text-[10px] font-bold tracking-[0.2em] text-white/70">
              <span className="flex justify-between"><span>{label}</span><span style={{ color: accent }}>{value.toFixed(1)}×</span></span>
              <input type="range" min="0.5" max="1.6" step="0.1" value={value} onChange={(e) => change(Number(e.target.value))} className="mt-2 w-full accent-cyan-300" />
            </label>
          ))}
          <div className="mb-3">
            <div className="mb-1.5 font-display text-[10px] font-bold tracking-[0.2em] text-white/70">WEATHER</div>
            <Seg options={(["none", "rain", "snow", "petals", "sand", "fireflies"] as Weather[]).map((w) => ({ id: w, name: w.toUpperCase() }))}
              value={settings.route.weather} onChange={(weather) => updateRoute({ weather })} accent={accent} />
          </div>
          <div className="mb-2 font-display text-[10px] font-bold tracking-[0.2em] text-white/70">CHALLENGE MODIFIERS</div>
          <div className="flex flex-col gap-1.5">
            {MODIFIERS.map((m) => {
              const active = settings.modifiers.includes(m.id);
              return (
                <button key={m.id} onClick={() => {
                  const next = active ? settings.modifiers.filter((v) => v !== m.id) : [...settings.modifiers, m.id];
                  tapUi();
                  set("modifiers", next);
                }} className={`btn-neon flex items-center gap-2 rounded-xl border p-2 text-left ${active ? "bg-white/10" : "border-white/10 bg-black/20"}`}
                  style={active ? { borderColor: accent } : {}}>
                  <span className="flex h-7 w-9 items-center justify-center rounded-lg font-display text-[8px] font-black text-black" style={{ background: active ? accent : "#94a3b8" }}>{m.icon}</span>
                  <span className="flex-1"><span className="block font-display text-[9px] font-bold text-white">{m.name}</span><span className="block text-[8px] text-white/45">{m.detail}</span></span>
                  <span className={active ? "text-emerald-300" : "text-white/30"}><CheckIcon size={14} /></span>
                </button>
              );
            })}
          </div>
          {settings.mode === "practice" && (
            <div className="mb-3 rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="mb-2 font-display text-[10px] font-bold tracking-[0.2em] text-white/70">PRACTICE DRILL</div>
              <div className="grid grid-cols-2 gap-1.5">
                <button onClick={() => { tapUi(); set("drillId", undefined); }}
                  className={`btn-neon rounded-lg border px-2 py-2 text-left ${!settings.drillId ? "bg-white/10" : "border-white/10 bg-black/20"}`}
                  style={!settings.drillId ? { borderColor: accent } : {}}>
                  <span className="block font-display text-[9px] font-bold text-white">FREE PRACTICE</span>
                  <span className="block text-[8px] text-white/45">All traffic, no crash</span>
                </button>
                {DRILLS.map((d) => (
                  <button key={d.id} onClick={() => { tapUi(); set("drillId", d.id); }}
                    className={`btn-neon rounded-lg border px-2 py-2 text-left ${settings.drillId === d.id ? "bg-white/10" : "border-white/10 bg-black/20"}`}
                    style={settings.drillId === d.id ? { borderColor: accent } : {}}>
                    <span className="block font-display text-[9px] font-bold text-white">{d.name.toUpperCase()}</span>
                    <span className="block truncate text-[8px] text-white/45">{d.focus}</span>
                  </button>
                ))}
              </div>
              {settings.drillId && (
                <p className="mt-1.5 text-[9px] leading-snug text-cyan-200/80">
                  {DRILLS.find((d) => d.id === settings.drillId)?.desc}
                </p>
              )}
            </div>
          )}

          {/* ---- Hands-On Track Editor ---- */}
          <div className="mb-3 rounded-xl border border-white/10 bg-black/30 p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <div className="font-display text-[10px] font-bold tracking-[0.2em] text-white/70">CUSTOM TRACK</div>
              {settings.track && <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 font-display text-[8px] font-black text-emerald-300">“{settings.track.name}” ARMED</span>}
            </div>
            <p className="mb-2 text-[9px] leading-snug text-white/50">
              Place vehicles, ramps, coins and hazards on a course timeline. Ride it, share it as a code.
            </p>
            <div className="flex gap-2">
              <button onClick={() => { tapUi(); setPanel("editor"); }}
                className="btn-neon flex-1 rounded-lg border border-white/15 bg-white/5 py-2 font-display text-[10px] font-black text-white">
                {settings.track ? "EDIT TRACK" : "OPEN TRACK EDITOR"}
              </button>
              {settings.track && (
                <button onClick={() => { tapUi(); set("track", null); showToast("Custom track cleared"); }}
                  className="btn-neon rounded-lg bg-white/10 px-3 py-2 font-display text-[10px] font-black text-rose-300">
                  CLEAR
                </button>
              )}
            </div>
          </div>

          {/* ---- Pre-Run Consumable Gadgets ---- */}
          <div className="mb-3 rounded-xl border border-white/10 bg-black/30 p-3">
            <div className="mb-2 font-display text-[10px] font-bold tracking-[0.2em] text-white/70">PRE-RUN GADGETS</div>
            <div className="flex flex-col gap-1.5">
              {GADGETS.map((g) => {
                const owned = gadgetInv[g.id] ?? 0;
                const armed = !!settings.gadgets?.[g.id] && owned > 0;
                return (
                  <div key={g.id} className="flex items-center gap-2 rounded-lg bg-black/25 px-2 py-1.5">
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[9px] font-bold text-white">{g.name} <span className="font-normal text-white/40">×{owned} held</span></span>
                      <span className="block truncate text-[8px] text-white/45">{g.detail}</span>
                    </span>
                    {owned <= 0 && (
                      <button
                        onClick={() => {
                          if (profile.wallet < g.price) { showToast(`Need ${g.price - profile.wallet} more coins`); return; }
                          setProfile((p) => {
                            const nx = { ...p, wallet: p.wallet - g.price };
                            saveProfile(nx);
                            rotateBackups(nx);
                            return nx;
                          });
                          saveGadgetInv({ ...gadgetInv, [g.id]: owned + 1 });
                          sfx.cashIn();
                        }}
                        className="btn-neon shrink-0 rounded-md bg-yellow-400/20 px-2 py-1 font-display text-[8px] font-black text-yellow-300"
                      >
                        BUY {g.price}
                      </button>
                    )}
                    <button
                      disabled={owned <= 0}
                      onClick={() => { tapUi(); set("gadgets", { ...settings.gadgets, [g.id]: !armed }); }}
                      className={`btn-neon shrink-0 rounded-md px-2 py-1 font-display text-[8px] font-black disabled:opacity-30 ${armed ? "bg-emerald-400/25 text-emerald-300" : "bg-white/10 text-white/60"}`}
                    >
                      {armed ? "ARMED" : "EQUIP"}
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="mt-1.5 text-[8px] text-white/40">Gadgets are consumed on launch — one per run.</p>
          </div>

          {season && (
            <div className="mt-3 rounded-xl border p-2 text-center" style={{ borderColor: `${season.accent}66`, background: `${season.accent}18` }}>
              <span className="font-display text-[9px] font-bold tracking-widest" style={{ color: season.accent }}>SEASONAL EVENT · {season.name.toUpperCase()}</span>
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={copyRouteLink} className="btn-neon flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 py-2.5 font-display text-[10px] font-bold tracking-widest text-white">
              <ShareIcon size={14} /> SHARE LINK
            </button>
            <button onClick={() => { tapUi(); startRun(); }} className="btn-neon flex items-center justify-center gap-1.5 rounded-xl py-2.5 font-display text-[10px] font-black tracking-widest text-black"
              style={{ background: accent }}>
              <PlayIcon size={14} /> RIDE ROUTE
            </button>
          </div>
        </Modal>
      )}

      {panel === "upgrades" && (
        <Modal title="UPGRADES & CRATES" icon={<SparkleIcon size={18} />} accent={accent} onClose={() => setPanel(null)}>
          <div className="mb-3 flex items-center justify-between rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-3 py-2">
            <span className="font-display text-[10px] font-bold tracking-widest text-yellow-200">WALLET</span>
            <span className="flex items-center gap-1 font-display text-lg font-black text-yellow-300"><CoinIcon size={17} />{profile.wallet.toLocaleString()}</span>
          </div>
          <div className="mb-2 font-display text-[10px] font-bold tracking-[0.24em] text-white/70">PERMANENT UPGRADE TREE</div>
          <div className="flex flex-col gap-2">
            {UPGRADE_TREE.map((u) => {
              const level = profile.upgrades[u.id] ?? 0;
              const cost = u.base * (level + 1);
              const full = level >= u.max;
              return (
                <div key={u.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex-1"><span className="block font-display text-[10px] font-bold text-white">{u.name}</span><span className="block text-[9px] text-white/45">{u.detail}</span></span>
                    <span className="font-display text-[9px] text-cyan-200">LV {level}/{u.max}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    {Array.from({ length: u.max }, (_, i) => <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < level ? accent : "rgba(255,255,255,0.15)" }} />)}
                  </div>
                  <button disabled={full || profile.wallet < cost} onClick={() => purchaseUpgrade(u.id, u.base, u.max)}
                    className={`btn-neon mt-2 flex w-full items-center justify-center gap-1 rounded-lg py-1.5 font-display text-[9px] font-black ${full ? "bg-emerald-500/15 text-emerald-200" : profile.wallet >= cost ? "text-black" : "bg-white/10 text-white/40"}`}
                    style={!full && profile.wallet >= cost ? { background: accent } : {}}>
                    {full ? "MAX LEVEL" : <><CoinIcon size={11} /> UPGRADE · {cost}</>}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/10 p-3">
            <div className="flex items-center justify-between">
              <span className="font-display text-[10px] font-bold tracking-widest text-fuchsia-200">MYSTERY CRATES</span>
              <span className="font-display text-sm font-black text-white">{profile.crates} available</span>
            </div>
            <p className="mt-1 text-[9px] text-white/55">
              Level-ups earn a free crate. Guaranteed <strong className="text-amber-300">Legendary</strong> every {CRATE_PITY_MAX} opens!
            </p>
            <div className="mt-2">
              <div className="flex justify-between font-display text-[8px] text-amber-200/80">
                <span>LEGENDARY PITY TIMER</span>
                <span>{profile.cratePity}/{CRATE_PITY_MAX - 1} {profile.cratePity >= CRATE_PITY_MAX - 1 ? "· NEXT IS GUARANTEED!" : ""}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/40">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-amber-300 transition-all"
                  style={{ width: `${(profile.cratePity / (CRATE_PITY_MAX - 1)) * 100}%` }}
                />
              </div>
            </div>
            <button disabled={profile.crates <= 0} onClick={openCrate}
              className="btn-neon mt-2.5 w-full rounded-xl py-2 font-display text-[10px] font-black tracking-widest text-black"
              style={{ background: profile.crates > 0 ? "#e879f9" : "#64748b" }}>OPEN CRATE</button>
          </div>
          <div className="mt-4 rounded-2xl border border-cyan-400/25 bg-cyan-400/5 p-3">
            <div className="mb-2 font-display text-[10px] font-bold tracking-[0.24em] text-cyan-200">PRE-RUN LOADOUT (CONSUMABLE)</div>
            {([
              ["shield", "Starting Shield", "Begin the run with a Kevlar shield", 150],
              ["ticket", "Extra Rescue Ticket", "One more continue for the next run", 300],
            ] as const).map(([key, name, desc, price]) => (
              <div key={key} className="mb-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 p-2">
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[10px] font-bold text-white">{name} · owned {profile.consumables[key]}</span>
                  <span className="block text-[9px] text-white/45">{desc}</span>
                </span>
                <button
                  disabled={profile.wallet < price}
                  onClick={() => {
                    tapUi();
                    setProfile((p) => {
                      if (p.wallet < price) return p;
                      const nx = { ...p, wallet: p.wallet - price, consumables: { ...p.consumables, [key]: p.consumables[key] + 1 } };
                      saveProfile(nx);
                      return nx;
                    });
                  }}
                  className="btn-neon flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 font-display text-[9px] font-bold text-white disabled:opacity-40"
                >
                  <CoinIcon size={11} /> {price}
                </button>
                <button
                  disabled={profile.consumables[key] <= 0}
                  onClick={() => { tapUi(); setLoadout((l) => ({ ...l, [key]: !l[key] })); }}
                  className="btn-neon rounded-lg px-2 py-1 font-display text-[9px] font-black disabled:opacity-40"
                  style={loadout[key] ? { background: accent, color: "#000" } : { background: "rgba(255,255,255,0.1)", color: "#fff" }}
                >
                  {loadout[key] ? "EQUIPPED" : "USE"}
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-white/10 pt-3">
            <div className="mb-2 font-display text-[10px] font-bold tracking-[0.24em] text-white/70">COMPANION DRONE</div>
            <Seg options={[{ id: "none", name: "OFF" }, { id: "scout", name: "SCOUT", desc: "Safe lane hint" }, { id: "coin", name: "COIN", desc: "Auto-pickup" }]}
              value={settings.companion} onChange={(v) => { tapUi(); set("companion", v); setProfile((p) => { const n = { ...p, companion: v }; saveProfile(n); return n; }); }} accent={accent} />
          </div>
        </Modal>
      )}

      {panel === "fieldguide" && (
        <Modal title="TRAFFIC FIELD GUIDE" icon={<CarIcon size={18} />} accent={accent} onClose={() => setPanel(null)}>
          {(() => {
            const discoveredCount = Object.keys(profile.vehicleSightings).filter((k) => (profile.vehicleSightings[k] ?? 0) > 0).length;
            return (
              <div className="mb-3 rounded-2xl border border-yellow-400/25 bg-yellow-400/10 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-display text-[10px] font-bold tracking-widest text-yellow-200">RESEARCH REWARDS</span>
                  <span className="font-display text-xs font-black text-white">{discoveredCount}/9 IDENTIFIED</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {FIELD_GUIDE_TIERS.map((tier) => {
                    const claimed = profile.claimedGuideTiers.includes(tier.count);
                    const ready = discoveredCount >= tier.count && !claimed;
                    return (
                      <button
                        key={tier.count}
                        disabled={!ready}
                        onClick={() => claimGuideReward(tier.count, tier.reward)}
                        className={`btn-neon rounded-xl border p-2 text-center ${
                          claimed
                            ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                            : ready
                              ? "border-yellow-300 bg-yellow-300 text-black shadow-[0_0_16px_rgba(253,224,71,0.45)]"
                              : "border-white/10 bg-black/30 text-white/45"
                        }`}
                      >
                        <span className="block font-display text-[9px] font-black">{tier.count} LOGGED</span>
                        <span className="mt-0.5 block font-display text-[10px] font-bold">
                          {claimed ? "CLAIMED" : `+${tier.reward} 🪙`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          <p className="mb-3 text-[10px] text-white/50">Encounter vehicles to log them. Specials have visible tells: signals mean a swerve; trucks/buses cannot be jumped.</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["sedan", "Sedan", "Standard oncoming traffic"], ["sports", "Sports car", "May signal and weave"],
              ["taxi", "Taxi", "Roof sign, steady speed"], ["van", "Van", "Taller; needs a higher jump"],
              ["police", "Police cruiser", "Flashing lightbar"], ["truck", "Truck", "Unjumpable heavy"],
              ["ambulance", "Ambulance", "Strobe and red cross"], ["bus", "Bus", "Unjumpable heavy"],
              ["flatbed", "Ramp flatbed", "Yellow ramp launches you"],
            ].map(([id, name, desc]) => {
              const seen = profile.vehicleSightings[id] ?? 0;
              return (
                <div key={id} className={`rounded-xl border p-2 ${seen ? "border-cyan-400/25 bg-cyan-400/5" : "border-white/10 bg-black/25 opacity-55"}`}>
                  <div className="flex items-center gap-1.5"><CarIcon size={16} /><span className="font-display text-[9px] font-bold text-white">{seen ? name : "Unknown vehicle"}</span></div>
                  <p className="mt-1 text-[8px] text-white/45">{seen ? desc : "Ride farther to identify this traffic."}</p>
                  <div className="mt-1 font-display text-[8px] text-cyan-200">{seen ? `${seen} sightings` : "UNDISCOVERED"}</div>
                </div>
              );
            })}
          </div>

          {/* ---- World Exploration Collection Book ---- */}
          <div className="mt-4 border-t border-white/10 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="font-display text-[10px] font-bold tracking-[0.24em] text-white/70">WORLD RELICS</div>
              <span className="font-display text-[9px] text-amber-200">
                {ownedCollectibles.length}/{COLLECTIBLES.length} FOUND
              </span>
            </div>
            <p className="mb-2 text-[9px] leading-snug text-white/50">
              One gleaming relic hides in each world every few runs. Collect a world's set to unlock its reward decal.
            </p>
            {["synthwave", "city", "desert", "alpine", "tokyo"].map((w) => {
              const pool = collectiblesForWorld(w);
              const got = pool.filter((c) => ownedCollectibles.includes(c.id));
              const reward = COLLECTION_REWARDS[w];
              const complete = pool.length > 0 && got.length === pool.length;
              return (
                <div key={w} className="mb-2 rounded-xl border p-2.5"
                  style={{ borderColor: complete ? "rgba(253,224,71,0.5)" : "rgba(255,255,255,0.08)", background: complete ? "rgba(253,224,71,0.06)" : "rgba(255,255,255,0.02)" }}>
                  <div className="flex items-center justify-between">
                    <span className="font-display text-[9px] font-black tracking-widest text-white/80">{w.toUpperCase()}</span>
                    <span className="font-display text-[8px]" style={{ color: complete ? "#fde047" : "rgba(255,255,255,0.4)" }}>
                      {got.length}/{pool.length}{complete && reward ? ` · ${reward.decalName}` : ""}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-col gap-1">
                    {pool.map((c) => {
                      const has = ownedCollectibles.includes(c.id);
                      return (
                        <div key={c.id} className="rounded-lg bg-black/25 px-2 py-1">
                          <div className="flex items-center gap-1.5">
                            <span className={has ? "text-amber-300" : "text-white/25"}>{has ? "◆" : "◇"}</span>
                            <span className={`font-display text-[9px] font-bold ${has ? "text-white" : "text-white/40"}`}>
                              {has ? c.name : "???"}
                            </span>
                          </div>
                          <p className="mt-0.5 pl-4 text-[8px] leading-snug text-white/45">
                            {has ? c.lore : c.hint}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Modal>
      )}

      {panel === "career" && (
        <Modal title="CAREER · DELIVERY CONTRACTS" icon={<TrophyIcon size={18} />} accent={accent} onClose={() => setPanel(null)}>
          <p className="mb-3 text-[10px] text-white/55">
            Twelve fixed-seed contracts. Deliver the package to earn stars: 1 = delivered, 2 = objective met, 3 = beat it comfortably.
          </p>
          <button onClick={() => { tapUi(); setPanel("map"); }}
            className="btn-neon mb-3 w-full rounded-xl border border-white/15 bg-white/5 py-2.5 font-display text-[10px] font-black tracking-widest text-white">
            OPEN CITY MAP
          </button>
          <div className="flex flex-col gap-2">
            {CAREER.map((c, i) => {
              const stars = profile.careerStars[String(c.id)] ?? 0;
              const unlocked = i === 0 || (profile.careerStars[String(CAREER[i - 1].id)] ?? 0) > 0;
              return (
                <div key={c.id} className={`flex items-center gap-3 rounded-xl border p-2.5 ${unlocked ? "border-white/12 bg-black/30" : "border-white/5 bg-black/20 opacity-50"}`}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-display text-sm font-black text-black" style={{ background: stars ? "#fbbf24" : unlocked ? accent : "#475569" }}>
                    {c.id}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[11px] font-black text-white">{c.name}</span>
                    <span className="block truncate text-[9px] text-white/55">{c.brief}</span>
                    <span className="block text-[9px] text-amber-200">{"★".repeat(stars)}<span className="text-white/20">{"★".repeat(3 - stars)}</span> · {c.distance}m{c.weather !== "none" ? ` · ${c.weather}` : ""}</span>
                  </span>
                  <button
                    disabled={!unlocked}
                    onClick={() => startCareer(c.id)}
                    className="btn-neon flex items-center gap-1 rounded-lg px-3 py-2 font-display text-[9px] font-black text-black disabled:opacity-40"
                    style={{ background: unlocked ? "#4ade80" : "#64748b" }}
                  >
                    {unlocked ? <><PlayIcon size={11} /> {stars ? "REPLAY" : "START"}</> : <LockIcon size={12} />}
                  </button>
                </div>
              );
            })}
          </div>
        </Modal>
      )}

      {panel === "map" && (
        <Modal title="DISTRICT MAP" icon={<PaletteIcon size={18} />} accent={accent} onClose={() => setPanel(null)}>
          <DistrictMap
            stars={profile.careerStars}
            contracts={CAREER}
            accent={accent}
            onStart={(id) => { setPanel(null); startCareer(id); }}
          />
        </Modal>
      )}

      {panel === "editor" && (
        <Modal title="TRACK EDITOR" icon={<RulerIcon size={18} />} accent={accent} onClose={() => setPanel(null)}>
          <TrackEditor
            initial={settings.track ?? null}
            accent={accent}
            onClose={() => setPanel("route")}
            onRide={(track) => {
              setSettings((s) => ({ ...s, track, mode: s.mode === "practice" ? "practice" : "route", route: { ...s.route, name: track.name } }));
              setPanel(null);
              setFinal(null);
              sfx.unlock();
              showToast(`Testing "${track.name}"`);
              setTimeout(() => {
                const eng = engineRef.current;
                if (!eng) return;
                eng.applySettings(runSettings({ ...settings, track, mode: settings.mode === "practice" ? "practice" : "route" }));
                eng.start();
                if (canvasRef.current) clipRecorder.start(canvasRef.current, 10);
              }, 30);
            }}
          />
        </Modal>
      )}

      {panel === "painter" && (
        <Modal title="VINYL PAINTER" icon={<PaletteIcon size={18} />} accent={accent} onClose={() => setPanel(null)}>
          <DecalPainter
            initial={settings.customDecal ?? null}
            onSave={(pixels) => {
              set("customDecal", pixels);
              showToast(pixels ? "Vinyl saved — check your tank!" : "Custom vinyl cleared");
            }}
          />
        </Modal>
      )}

      {panel === "horn" && (
        <Modal title="HORN STUDIO" icon={<HornIcon size={18} />} accent={accent} onClose={() => setPanel(null)}>
          <HornSequencer
            initial={settings.customHorn ?? null}
            accent={accent}
            onSave={(steps) => {
              set("customHorn", steps);
              showToast(steps ? "Custom horn saved!" : "Stock horn restored");
            }}
          />
        </Modal>
      )}

      {panel === "ranks" && (
        <Modal title="LOCAL RANKS" icon={<TrophyIcon size={18} />} accent={accent} onClose={() => setPanel(null)}>
          <div className="mb-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-center font-display text-[10px] font-bold tracking-widest text-white/70">
            {settings.mode === "daily" ? `DAILY · SEED #${todayKey()}` : `${settings.mode.toUpperCase()} · ${settings.difficulty.toUpperCase()}`}
          </div>
          {renderWorldFilter()}
          {board.length > 0 ? board.map((s, i) => (
            <div key={i} className="mb-1 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/85">
              <MedalIcon rank={i} size={22} />
              <span className="flex-1 min-w-0">
                <span className="block font-display font-black text-white">{s.score.toLocaleString()}</span>
                <span className="block truncate text-[9px] text-white/45">{s.distance}m · {s.coins} coins · {s.theme}</span>
              </span>
              <span className="text-[10px] text-white/40">{s.date}</span>
            </div>
          )) : (
            <div className="py-8 text-center text-xs text-white/50">No runs here yet — go set the first record.</div>
          )}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[["CUPS", profile.tournamentWins], ["DUEL WINS", profile.duelWins], ["RUNS", profile.runs]].map(([l, v]) => (
              <div key={l as string} className="rounded-xl border border-white/10 bg-black/30 p-2">
                <div className="font-display text-base font-black text-white">{v}</div>
                <div className="text-[8px] tracking-widest text-white/40">{l}</div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {panel === "replay" && (
        <Modal title="REPLAY THEATER" icon={<PlayIcon size={18} />} accent={accent} onClose={() => setPanel(null)}>
          <ReplayTheater frames={profile.lastReplay} settings={settings} theme={theme} />
          <p className="mt-2 text-center text-[9px] text-white/40">Your latest run is saved locally and stays on this device.</p>

          {/* ---- v1.0 Ghost Exchange ---- */}
          <div className="mt-3 rounded-xl border border-cyan-300/30 bg-cyan-400/5 p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-display text-[10px] font-black tracking-widest text-cyan-200">GHOST EXCHANGE</span>
              <span className="font-display text-[9px] text-white/50">PB {profile.ghostScore.toLocaleString()}</span>
            </div>
            <p className="mb-2 text-[9px] leading-snug text-white/50">
              Copy your ghost code and send it to a friend — they race your exact line. Pasting a code replaces
              your current ghost.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  const code = profile.ghost ? encodeGhost(profile.ghost) : "";
                  if (!code) { showToast("No ghost yet — set a Classic score first"); return; }
                  void copyText(code, "Ghost code copied — send it to a friend");
                }}
                className="btn-neon rounded-lg border border-cyan-300/40 bg-cyan-400/10 py-2 font-display text-[9px] font-black tracking-widest text-cyan-100"
              >
                COPY MY GHOST CODE
              </button>
              <button
                onClick={() => {
                  const clean = ghostPaste.trim();
                  const frames = decodeGhost(clean);
                  if (!frames) { showToast("That ghost code didn't parse — check it and try again"); return; }
                  setProfile((p) => {
                    const nx = { ...p, ghost: frames, ghostScore: 0 };
                    saveProfile(nx);
                    return nx;
                  });
                  setGhostPaste("");
                  showToast("Ghost imported! Beat it in Classic to make it yours");
                  sfx.chime();
                }}
                className="btn-neon rounded-lg border border-fuchsia-300/40 bg-fuchsia-400/10 py-2 font-display text-[9px] font-black tracking-widest text-fuchsia-100"
              >
                IMPORT A GHOST
              </button>
            </div>
            <input
              value={ghostPaste}
              onChange={(e) => setGhostPaste(e.target.value)}
              placeholder="Paste a friend's ghost code here…"
              spellCheck={false}
              className="mt-2 w-full rounded-lg border border-white/15 bg-black/45 px-2.5 py-1.5 font-mono text-[9px] text-white outline-none focus:border-cyan-300"
            />
          </div>
        </Modal>
      )}

      {panel === "photo" && (
        <Modal title="PHOTO MODE" icon={<CameraIcon size={18} />} accent={accent} onClose={() => setPanel(null)}>
          <RiderPreview bikeId={settings.bikeId} helmetId={settings.helmetId} jacketId={settings.jacketId}
            trailId={settings.trailId} theme={theme} height={330} photo
            photoFilter={photoFilter} stickers={photoStickers}
            decal={settings.decal} customDecal={settings.customDecal ?? null} plateText={settings.plateText} />
          <div className="mt-3 mb-2 font-display text-[10px] font-bold tracking-[0.24em] text-white/70">FILTER STUDIO</div>
          <div className="grid grid-cols-4 gap-1.5">
            {([
              ["none", "CLEAN"], ["crt", "CRT"], ["vhs", "VHS"], ["chroma", "CHROMA"],
              ["tilt", "TILT-SHIFT"], ["warm", "WARM"], ["noir", "NOIR"],
            ] as [PhotoFilterId, string][]).map(([id, label]) => (
              <button key={id} onClick={() => { tapUi(); setPhotoFilter(id); }}
                className={`btn-neon rounded-lg border px-1 py-2 font-display text-[8px] font-black ${photoFilter === id ? "bg-white/10 text-white" : "border-white/10 bg-black/30 text-white/55"}`}
                style={photoFilter === id ? { borderColor: accent, boxShadow: `0 0 10px ${accent}44` } : {}}>
                {label}
              </button>
            ))}
          </div>
          <div className="mt-3 mb-2 font-display text-[10px] font-bold tracking-[0.24em] text-white/70">STICKERS</div>
          <div className="flex flex-wrap gap-1.5">
            {["🔥", "⭐", "💀", "🦄", "🌴", "⚡", "🏁", "🛞"].map((st) => {
              const on = photoStickers.includes(st);
              return (
                <button key={st} onClick={() => { tapUi(); setPhotoStickers(on ? photoStickers.filter((s) => s !== st) : [...photoStickers, st]); }}
                  className={`btn-neon h-9 w-9 rounded-lg border text-base ${on ? "border-white/60 bg-white/10" : "border-white/10 bg-black/30"}`}>
                  {st}
                </button>
              );
            })}
          </div>
          <div className="mt-3 mb-2 font-display text-[10px] font-bold tracking-[0.24em] text-white/70">BACKDROP</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {THEMES.map((t) => (
              <button key={t.id} onClick={() => { tapUi(); setSettings((s) => ({ ...s, themeId: t.id, useCustom: false })); }}
                className="btn-neon flex shrink-0 flex-col items-center gap-1 rounded-xl border border-white/10 bg-black/30 p-2">
                <span className="h-8 w-8 rounded-full border border-white/25"
                  style={{ background: `conic-gradient(from 0deg, ${t.swatch[0]}, ${t.swatch[1]}, ${t.swatch[2]}, ${t.swatch[0]})` }} />
                <span className="font-display text-[8px] text-white/80">{t.name}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 text-center text-[10px] text-white/45">Tap SNAP to download a hi-res PNG with your filter and stickers baked in.</div>
        </Modal>
      )}

      {panel === "settings" && (
        <Modal title="SETTINGS" icon={<GearIcon size={18} />} accent={accent} onClose={() => setPanel(null)}>
          {/* ---- v1.0: search + category chips ---- */}
          <div className="mb-2">
            <input
              value={settingsQuery}
              onChange={(e) => setSettingsQuery(e.target.value)}
              placeholder="Search settings…"
              className="w-full rounded-lg border border-white/15 bg-black/45 px-3 py-2 text-xs font-bold text-white outline-none focus:border-cyan-300"
            />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {[
                { label: "ALL", q: "" },
                { label: "SOUND", q: "sound" },
                { label: "RIDING", q: "steering" },
                { label: "SCREEN", q: "hud" },
                { label: "CONTROLS", q: "remap" },
                { label: "ACCESS", q: "assist" },
                { label: "DATA", q: "profile" },
              ].map((c) => (
                <button key={c.label} onClick={() => { tapUi(); setSettingsQuery(c.q); }}
                  className={`btn-neon rounded-full border px-2.5 py-1 font-display text-[8px] font-black tracking-widest ${
                    settingsQuery === c.q ? "border-white/60 bg-white/10 text-white" : "border-white/10 bg-black/30 text-white/55"
                  }`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div ref={settingsBodyRef} className="flex flex-col gap-2">
            <Toggle label="SOUND EFFECTS" hint="engine, horns, surface tires, impacts" on={!muted} accent={accent} onClick={() => { tapUi(); toggleMute(); }} />
            <Toggle label="MUSIC" hint="adaptive synthwave layers + ~4dB voice duck" on={settings.music} accent={accent}
              onClick={() => { tapUi(); set("music", !settings.music); }} />
            <Toggle label="AUTO-PAUSE ON FOCUS LOSS" hint="streamers who tab out can turn this off" on={settings.autoPauseFocus} accent={accent}
              onClick={() => { tapUi(); set("autoPauseFocus", !settings.autoPauseFocus); }} />
            <Toggle label="AUTO QUALITY (60FPS GUARD)" hint="steps DPR/particles if frame > 19ms" on={settings.autoQuality} accent={accent}
              onClick={() => { tapUi(); set("autoQuality", !settings.autoQuality); }} />
            <Toggle label="HIGH QUALITY" hint="particles, weather, resolution" on={settings.quality === "high"} accent={accent}
              onClick={() => { tapUi(); set("quality", settings.quality === "high" ? "low" : "high"); }} />
            <Toggle label="SHOW TINY FPS READOUT" hint="live FPS + quality tier in HUD" on={settings.showFps} accent={accent}
              onClick={() => { tapUi(); set("showFps", !settings.showFps); }} />
            <Toggle label="INPUT LATENCY HUD" hint="or long-press SCORE during a run" on={showLatencyDiag} accent={accent}
              onClick={() => { tapUi(); setShowLatencyDiag((v) => !v); }} />
            <Toggle label="SCREEN SHAKE" hint="directional impact kick" on={settings.shake} accent={accent}
              onClick={() => { tapUi(); set("shake", !settings.shake); }} />
            <Toggle label="GHOST RIDER" hint="race your best run" on={settings.ghostOn} accent={accent}
              onClick={() => { tapUi(); set("ghostOn", !settings.ghostOn); }} />
            <Toggle label="LEFT-HANDED LAYOUT" hint="mirror on-screen buttons" on={settings.lefty} accent={accent}
              onClick={() => { tapUi(); set("lefty", !settings.lefty); }} />
            <Toggle label="COLOURBLIND ASSIST" hint="outlines + jump/no-jump glyphs" on={settings.colorblind} accent={accent}
              onClick={() => { tapUi(); set("colorblind", !settings.colorblind); }} />
            <Toggle label="REDUCE MOTION" hint="cuts flashes, particles, zoom, shake & sky drift" on={settings.reduceMotion} accent={accent}
              onClick={() => { tapUi(); set("reduceMotion", !settings.reduceMotion); }} />

            <div className="mt-1">
              <div className="mb-1.5 font-display text-[10px] font-bold tracking-[0.24em] text-white/70">HAPTICS</div>
              <Seg options={[{ id: "off", name: "OFF" }, { id: "light", name: "LIGHT" }, { id: "strong", name: "STRONG" }]}
                value={settings.haptics} onChange={(v) => { tapUi(); set("haptics", v); }} accent={accent} />
            </div>
            <div>
              <div className="mb-1.5 font-display text-[10px] font-bold tracking-[0.24em] text-white/70">STEERING ({settings.mode.toUpperCase()})</div>
              <Seg options={STEERING} value={settings.steering} onChange={(v) => { tapUi(); set("steering", v); }} accent={accent} />
            </div>

            <div>
              <div className="mb-1.5 font-display text-[10px] font-bold tracking-[0.24em] text-white/70">MUSIC STATION</div>
              <Seg options={(["synthwave", "arcade", "cruise"] as StationId[]).map((id, i) => ({ id, name: STATION_NAMES[i].toUpperCase() }))}
                value={settings.musicStation} onChange={(v) => { tapUi(); set("musicStation", v); sfx.setStation(v); }} accent={accent} />
            </div>
            <div>
              <div className="mb-1.5 font-display text-[10px] font-bold tracking-[0.24em] text-white/70">SOUND PACK</div>
              <Seg options={SOUND_PACKS.map((p) => ({ id: p.id, name: p.name.toUpperCase(), desc: p.detail }))}
                value={settings.soundPack} onChange={(v) => { tapUi(); set("soundPack", v); }} accent={accent} />
            </div>
            <Toggle label="DIRECTIONAL AUDIO CUES" hint="stereo left/right warnings · harsh horn = unjumpable truck" on={settings.directionalAudio} accent={accent}
              onClick={() => { tapUi(); set("directionalAudio", !settings.directionalAudio); }} />
            <Toggle label="DANGER HEARTBEAT" hint="sub-bass pulse accelerates when a heavy vehicle is about to hit" on={settings.heartbeatAudio} accent={accent}
              onClick={() => { tapUi(); set("heartbeatAudio", !settings.heartbeatAudio); }} />
            <label className="block font-display text-[10px] font-bold tracking-[0.2em] text-white/70">ANNOUNCER PACK
              <select value={settings.announcer} onChange={(e) => set("announcer", e.target.value as Settings["announcer"])}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#140a2e] px-2 py-2 text-xs text-white">
                <option value="arcade">Arcade calls</option><option value="hype">Hype voice</option><option value="chill">Chill coach</option><option value="silent">Silent</option>
              </select>
            </label>

            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="mb-2 font-display text-[10px] font-bold tracking-[0.2em] text-white/70">HUD LAYOUT ({settings.mode.toUpperCase()} PROFILE)</div>
              <label className="mb-2 block text-[9px] text-white/55">Size · {Math.round(settings.hudScale * 100)}%
                <input type="range" min="0.75" max="1.3" step="0.05" value={settings.hudScale} onChange={(e) => set("hudScale", Number(e.target.value))} className="mt-1 w-full accent-cyan-300" />
              </label>
              <label className="block text-[9px] text-white/55">Vertical position · {settings.hudBottom}px
                <input type="range" min="0" max="80" step="4" value={settings.hudBottom} onChange={(e) => set("hudBottom", Number(e.target.value))} className="mt-1 w-full accent-cyan-300" />
              </label>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="mb-2 flex items-center gap-1.5 font-display text-[10px] font-bold tracking-[0.2em] text-white/70"><GamepadIcon size={15} /> CONTROLLER REMAP</div>
              <div className="grid grid-cols-2 gap-2">
                {(["left", "right", "jump", "brake", "horn", "pause"] as GamepadAction[]).map((action) => (
                  <label key={action} className="flex items-center justify-between rounded-lg bg-black/25 px-2 py-1.5 text-[9px] uppercase text-white/60">
                    {action}
                    <select value={settings.controllerMap[action]} onChange={(e) => set("controllerMap", { ...settings.controllerMap, [action]: Number(e.target.value) })}
                      className="rounded bg-[#140a2e] px-1 py-1 text-[9px] text-white">
                      {Array.from({ length: 16 }, (_, i) => <option key={i} value={i}>B{i}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-1 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 p-3 text-[10px] text-white/55">
              <GamepadIcon size={18} />
              <span>Gamepad: D-pad steers, A jumps, B slams, X honks, Y banks combo, Start pauses.</span>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="mb-2 font-display text-[10px] font-bold tracking-[0.2em] text-white/70">ACCESSIBLE STEERING</div>
              <div className="flex flex-col gap-2">
                <Toggle label="ONE-SWITCH ASSIST" hint="auto-steers to the safest lane · you only jump" on={settings.assist} accent={accent}
                  onClick={() => { tapUi(); setSettings((st) => ({ ...st, assist: !st.assist, tilt: false })); }} />
                <Toggle label="TILT STEERING" hint="roll your phone to change lanes" on={settings.tilt} accent={accent}
                  onClick={async () => {
                    tapUi();
                    if (!settings.tilt && !(await requestTilt())) {
                      showToast("Motion access denied by the browser");
                      return;
                    }
                    setSettings((st) => ({ ...st, tilt: !st.tilt, assist: false }));
                  }} />
                {settings.tilt && (
                  <>
                    <label className="block text-[9px] text-white/55">Sensitivity · {settings.tiltSens.toFixed(1)}×
                      <input type="range" min="0.5" max="2" step="0.1" value={settings.tiltSens}
                        onChange={(e) => set("tiltSens", Number(e.target.value))} className="mt-1 w-full accent-cyan-300" />
                    </label>
                    <button
                      onClick={() => { tapUi(); const z = engineRef.current?.calibrateTilt() ?? 0; set("tiltZero", z); showToast(`Neutral set to ${z.toFixed(0)}°`, 2000); }}
                      className="btn-neon rounded-lg border border-white/15 bg-white/5 py-1.5 font-display text-[9px] font-bold tracking-widest text-white"
                    >
                      CALIBRATE · HOLD PHONE LEVEL
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="mb-2 font-display text-[10px] font-bold tracking-[0.2em] text-white/70">PROFILE TRANSFER</div>
              <button
                onClick={() => { tapUi(); void copyText(exportProfile(profile), "Profile code copied — paste it on your other device"); }}
                className="btn-neon mb-2 w-full rounded-lg border border-white/15 bg-white/5 py-1.5 font-display text-[9px] font-bold tracking-widest text-white"
              >
                COPY EXPORT CODE
              </button>
              <textarea
                value={importText}
                onChange={(e) => { setImportText(e.target.value); setImportMsg(""); }}
                placeholder="Paste an export code here…"
                rows={2}
                className="w-full rounded-lg border border-white/15 bg-black/45 px-2 py-1.5 font-mono text-[9px] text-white outline-none"
              />
              <button
                onClick={() => { tapUi(); doImport(); }}
                disabled={!importText.trim()}
                className="btn-neon mt-1.5 w-full rounded-lg py-1.5 font-display text-[9px] font-black tracking-widest text-black disabled:opacity-40"
                style={{ background: accent }}
              >
                IMPORT (REPLACES THIS PROFILE)
              </button>
              {importMsg && <div className="mt-1 text-[10px] text-cyan-200">{importMsg}</div>}
            </div>

            {/* ---- Automatic Save Recovery ---- */}
            <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/8 p-3">
              <div className="mb-1.5 font-display text-[10px] font-bold tracking-[0.2em] text-emerald-200">SAVE RECOVERY</div>
              <p className="mb-2 text-[9px] leading-snug text-white/55">
                The game keeps {4} rotating backups after every run. If a save or import ever corrupts, restore one here.
              </p>
              <button onClick={() => setBackupList(listBackups())}
                className="btn-neon w-full rounded-lg bg-emerald-400/20 py-1.5 font-display text-[9px] font-black tracking-widest text-emerald-200">
                SCAN BACKUP SLOTS
              </button>
              {backupList.length > 0 && (
                <div className="mt-2 flex flex-col gap-1.5">
                  {backupList.map((b) => (
                    <div key={b.slot} className="flex items-center gap-2 rounded-lg bg-black/30 px-2 py-1.5">
                      <span className="flex-1 text-[9px] text-white/70">
                        Slot {b.slot} · {new Date(b.savedAt).toLocaleString()} · {b.runs} runs
                      </span>
                      <button
                        onClick={() => {
                          const p = restoreBackup(b.slot);
                          if (p) {
                            setProfile(p);
                            saveProfile(p);
                            showToast("Backup restored!", 2600);
                          }
                        }}
                        className="btn-neon rounded-md bg-emerald-400/20 px-2 py-1 font-display text-[8px] font-black text-emerald-200"
                      >
                        RESTORE
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => { tapUi(); setProfile((p) => { const n = { ...p, seenTutorial: false }; saveProfile(n); return n; }); setPanel(null); }}
              className="btn-neon mt-1 w-full rounded-xl border border-white/15 bg-white/5 py-2 font-display text-[10px] font-bold tracking-widest text-white">
              REPLAY INTERACTIVE TUTORIAL
            </button>

            {/* ---- v1.0: keyboard remap ---- */}
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="mb-2 font-display text-[10px] font-bold tracking-[0.2em] text-white/70">KEYBOARD REMAP</div>
              <p className="mb-2 text-[9px] leading-snug text-white/50">
                Arrow keys and Space always work too — these add extra keys so you can never lock yourself out.
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {KEYMAP_ACTIONS.map((a) => {
                  const km = { ...DEFAULT_KEYMAP, ...(settings.keymap ?? {}) };
                  return (
                    <button key={a.id}
                      onClick={() => { tapUi(); setCapturingKey(a.id); }}
                      className={`btn-neon flex items-center justify-between rounded-lg border px-2 py-1.5 ${
                        capturingKey === a.id ? "border-amber-300 bg-amber-400/10" : "border-white/10 bg-black/25"
                      }`}>
                      <span className="text-left">
                        <span className="block text-[9px] font-bold uppercase text-white/75">{a.name}</span>
                        {a.hint && <span className="block text-[7px] text-white/35">{a.hint}</span>}
                      </span>
                      <span className={`rounded-md border border-white/20 bg-[#140a2e] px-1.5 py-0.5 font-mono text-[9px] font-bold ${
                        capturingKey === a.id ? "text-amber-200" : "text-cyan-200"
                      }`}>
                        {capturingKey === a.id ? "PRESS…" : keyLabel(km[a.id])}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => { tapUi(); set("keymap", {}); setCapturingKey(null); showToast("Keyboard reset to defaults"); }}
                className="btn-neon mt-2 w-full rounded-lg border border-white/15 bg-white/5 py-1.5 font-display text-[9px] font-bold tracking-widest text-white"
              >
                RESET TO DEFAULTS
              </button>
            </div>

            {/* ---- v1.0: language ---- */}
            <div>
              <div className="mb-1.5 font-display text-[10px] font-bold tracking-[0.24em] text-white/70">LANGUAGE · MENU TEXT</div>
              <Seg options={LANGS.map((l) => ({ id: l.id, name: l.name.toUpperCase() }))}
                value={settings.lang ?? "en"} onChange={(v) => { tapUi(); set("lang", v); }} accent={accent} />
            </div>

            {/* ---- v1.0: attract demo toggle ---- */}
            <Toggle label="ATTRACT DEMO" hint="idle 30s on the menu and your last run plays itself" on={settings.attract !== false} accent={accent}
              onClick={() => { tapUi(); set("attract", settings.attract === false); }} />

            {/* ---- v1.0: what's new / about ---- */}
            <button onClick={() => { tapUi(); setWhatsNew(true); }}
              className="btn-neon w-full rounded-xl border border-pink-400/35 bg-pink-500/10 py-2 font-display text-[10px] font-black tracking-widest text-pink-200">
              WHAT'S NEW IN v{GAME_VERSION}
            </button>
          </div>
        </Modal>
      )}

      {/* ================= PAUSE ================= */}
      {phase === "paused" && (
        <div className="fade-in absolute inset-0 z-20 overflow-y-auto bg-[#07020f]/88 backdrop-blur-lg">
          <div className="flex min-h-full flex-col items-center justify-center p-5">
            <div className="pop-in flex w-full max-w-xs flex-col items-center gap-3 rounded-3xl border border-white/12 bg-[#0d0620]/85 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
              <h2 className="font-display text-4xl font-black tracking-widest" style={{ color: accent, textShadow: `0 0 24px ${accent}` }}>PAUSED</h2>
              <button onClick={() => engineRef.current?.resume()}
                className="btn-neon flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-[#2ed573] to-[#1a9e4f] py-3.5 font-display text-lg font-black tracking-widest text-white shadow-[0_5px_0_#116b35]">
                <PlayIcon size={20} /> RESUME
              </button>
              <button onClick={() => launch(activeCareer.current)}
                className="btn-neon flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-[#ff8c42] to-[#e3611f] py-3.5 font-display text-lg font-black tracking-widest text-white shadow-[0_5px_0_#9c3f0f]">
                <RestartIcon size={20} /> RESTART
              </button>
              <div className="grid w-full grid-cols-3 gap-2">
                <button onClick={() => { tapUi(); setPanel("garage"); }} className="btn-neon flex flex-col items-center gap-1 rounded-xl border border-white/15 bg-white/5 py-2 text-white">
                  <BikeIcon size={18} /><span className="font-display text-[8px] font-bold">GARAGE</span>
                </button>
                <button onClick={() => { tapUi(); setPanel("themes"); }} className="btn-neon flex flex-col items-center gap-1 rounded-xl border border-white/15 bg-white/5 py-2 text-white">
                  <PaletteIcon size={18} /><span className="font-display text-[8px] font-bold">WORLDS</span>
                </button>
                <button onClick={() => { tapUi(); setPanel("settings"); }} className="btn-neon flex flex-col items-center gap-1 rounded-xl border border-white/15 bg-white/5 py-2 text-white">
                  <GearIcon size={18} /><span className="font-display text-[8px] font-bold">SETTINGS</span>
                </button>
              </div>
              <button onClick={() => { setPanel(null); engineRef.current?.backToMenu(); }}
                className="btn-neon flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-white/20 bg-white/5 py-2.5 font-display text-sm font-bold tracking-widest text-white/80">
                <HomeIcon size={18} /> MAIN MENU
              </button>
              <div className="text-[11px] text-white/45">P / Esc / Space to resume</div>
            </div>
          </div>
        </div>
      )}

      {/* ================= GAME OVER ================= */}
      {phase === "over" && final && (
        <div className="fade-in absolute inset-0 z-20 overflow-y-auto bg-[#07020f]/88 backdrop-blur-lg">
          <div className="flex min-h-full flex-col items-center justify-center p-4">
            <div className="pop-in flex w-full max-w-sm flex-col items-center rounded-3xl border border-white/12 bg-[#0d0620]/85 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
              <span className="text-[#ff4757]"><SkullIcon size={50} /></span>
              <h2 className="font-display mt-1 text-center text-3xl font-black tracking-wider text-[#ff4757] [text-shadow:0_0_26px_rgba(255,71,87,0.8)]">
                {final.run.mode === "timetrial" && final.run.banner.startsWith("Time") ? "TIME UP!" : "WIPED OUT!"}
              </h2>
              <p className="mt-1 text-center text-xs italic text-white/65">“{final.run.banner}”</p>

              {final.isBest && (
                <div className="best-flash mt-3 flex items-center gap-2 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 px-4 py-1.5 font-display text-sm font-black tracking-widest text-amber-950">
                  <TrophyIcon size={18} /> NEW BEST!
                </div>
              )}
              {final.levelUp && (
                <div className="pop-in mt-2 flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-400/15 px-4 py-1.5 font-display text-xs font-black text-cyan-200">
                  <LevelIcon size={16} /> LEVEL {lvl.level} — {titleFor(lvl.level).toUpperCase()}
                </div>
              )}
              {final.streakBonusCoins > 0 && (
                <div className="pop-in mt-2 flex items-center gap-2 rounded-full border border-orange-400/40 bg-orange-500/15 px-4 py-1 font-display text-[10px] font-black text-orange-200">
                  <FlameIcon size={14} /> HOT STREAK ×{profile.hotStreak} · +{final.streakBonusCoins} COINS
                </div>
              )}
              {final.run.careerId && (
                <div className="pop-in mt-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-1.5 text-center font-display text-[10px] font-black text-amber-100">
                  CONTRACT {final.run.careerId}: {final.careerStars ? "★".repeat(final.careerStars) : "FAILED"}
                  {final.careerFirstClear && " · NEXT CONTRACT UNLOCKED"}
                </div>
              )}
              {final.chainUnlocks.length > 0 && (
                <div className="pop-in mt-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 text-center">
                  <div className="font-display text-[9px] font-black tracking-widest text-amber-200">TROPHY EARNED</div>
                  {final.chainUnlocks.map((c) => <div key={c} className="text-[10px] text-amber-50">{c}</div>)}
                </div>
              )}
              {final.ticketsEarned > 0 && (
                <div className="pop-in mt-2 flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-4 py-1 font-display text-[10px] font-black text-emerald-200">
                  <ShieldIcon size={14} /> +{final.ticketsEarned} RESCUE TICKET EARNED! ({profile.rescueTickets}/3)
                </div>
              )}

              <div className="mt-4 w-full rounded-2xl border bg-black/45 p-4 text-center" style={{ borderColor: `${accent}55` }}>
                <div className="font-display text-[10px] font-bold tracking-[0.3em]" style={{ color: accent }}>FINAL SCORE</div>
                <div className="font-display mt-1 text-5xl font-black text-white" style={{ textShadow: `0 0 18px ${accent}` }}>
                  {final.run.score.toLocaleString()}
                </div>
                <div className="mt-1 text-[10px] text-white/45">
                  {final.run.mode.toUpperCase()} · {final.run.difficulty.toUpperCase()} · {final.run.themeName} · ×{multiplier.toFixed(1)}
                </div>
                <div className="mt-4 grid grid-cols-4 gap-1 text-white/85">
                  {[
                    { i: <CoinIcon size={18} />, v: final.run.coins, l: "COINS" },
                    { i: <RulerIcon size={18} />, v: `${final.run.distance}m`, l: "DIST" },
                    { i: <FlameIcon size={18} />, v: final.run.nearMisses, l: "MISSES" },
                    { i: <StuntIcon size={18} />, v: final.run.stunts, l: "STUNTS" },
                    { i: <JumpIcon size={18} />, v: final.run.carsJumped, l: "HURDLES" },
                    { i: <RampIcon size={18} />, v: final.run.ramps, l: "RAMPS" },
                    { i: <SpeedIcon size={18} />, v: final.run.topSpeed, l: "TOP KM/H" },
                    { i: <PoliceIcon size={18} />, v: final.run.chases, l: "CHASES" },
                  ].map((s, i) => (
                    <div key={i} className="flex flex-col items-center gap-0.5 py-1">
                      {s.i}
                      <span className="font-display text-xs font-bold">{s.v}</span>
                      <span className="text-[7px] tracking-widest text-white/40">{s.l}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sector Splits vs PB */}
              {final.run.sectors.length > 0 && (
                <div className="mt-3 w-full rounded-xl border border-cyan-400/25 bg-cyan-400/5 p-2.5">
                  <div className="mb-1.5 font-display text-[9px] font-bold tracking-widest text-cyan-200">500M SECTOR SPLITS VS PB</div>
                  <div className="flex flex-wrap gap-1.5">
                    {final.run.sectors.map((sec, idx) => {
                      const pb = profile.bestSectors[idx];
                      const delta = pb !== undefined ? +(sec - pb).toFixed(2) : 0;
                      return (
                        <span key={idx} className="rounded-lg bg-black/40 px-2 py-1 font-mono text-[9px] text-white">
                          S{idx + 1}: {sec.toFixed(2)}s{" "}
                          <span className={delta <= 0 ? "text-emerald-300" : "text-amber-300"}>
                            ({delta <= 0 ? "PB" : `+${delta}s`})
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-3 flex w-full items-center justify-between rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-3 py-2">
                <span className="flex items-center gap-1.5 font-display text-[10px] font-bold tracking-widest text-yellow-200">
                  <CoinIcon size={14} /> +{final.run.coins} EARNED
                </span>
                <span className="font-display text-sm font-black text-yellow-300">{profile.wallet.toLocaleString()}</span>
              </div>

              {final.completed.length > 0 && (
                <div className="slide-up mt-3 w-full rounded-xl border border-emerald-400/35 bg-emerald-500/10 p-3">
                  <div className="mb-1 flex items-center gap-1.5 font-display text-[10px] font-bold tracking-widest text-emerald-200">
                    <CheckIcon size={14} /> MISSION COMPLETE
                  </div>
                  {final.completed.map((m) => (
                    <div key={m.id} className="text-[10px] text-emerald-100/85">• {m.label}</div>
                  ))}
                </div>
              )}

              {final.badges.length > 0 && (
                <div className="slide-up mt-2 w-full rounded-xl border border-yellow-400/35 bg-yellow-400/10 p-3">
                  <div className="mb-1 flex items-center gap-1.5 font-display text-[10px] font-bold tracking-widest text-yellow-200">
                    <TrophyIcon size={14} /> BADGE UNLOCKED
                  </div>
                  {final.badges.map((b) => (
                    <div key={b.id} className="text-[10px] text-yellow-100/85">• {b.name} — {b.desc}</div>
                  ))}
                </div>
              )}

              {/* ---- Post-Run Coaching ---- */}
              {final.run.coaching && final.run.coaching.length > 0 && (
                <div className="slide-up mt-2 w-full rounded-xl border border-cyan-300/35 bg-cyan-400/10 p-3">
                  <div className="mb-1 flex items-center gap-1.5 font-display text-[10px] font-bold tracking-widest text-cyan-200">
                    <SteerIcon size={14} /> COACH'S NOTES
                  </div>
                  {final.run.coaching.map((t, i) => (
                    <div key={i} className="mb-1 last:mb-0">
                      <div className="font-display text-[10px] font-black text-white">{t.title}</div>
                      <div className="text-[10px] leading-snug text-cyan-100/80">{t.detail}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* ---- Automatic Replay Highlights ---- */}
              {highlightChips.length > 0 && (
                <div className="slide-up mt-2 w-full rounded-xl border border-fuchsia-300/30 bg-fuchsia-400/10 p-3">
                  <div className="mb-1.5 font-display text-[10px] font-bold tracking-widest text-fuchsia-200">REPLAY HIGHLIGHTS</div>
                  <div className="flex flex-wrap gap-1.5">
                    {highlightChips.map((h, i) => (
                      <span key={i} className="rounded-full border px-2 py-1 font-display text-[8px] font-black"
                        style={{ borderColor: `${h.color}66`, color: h.color, background: "rgba(0,0,0,0.35)" }}>
                        {h.icon} {h.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ---- World collectibles found ---- */}
              {final.run.collected && final.run.collected.length > 0 && (
                <div className="slide-up mt-2 w-full rounded-xl border border-amber-300/35 bg-amber-400/10 p-3">
                  <div className="mb-1 font-display text-[10px] font-bold tracking-widest text-amber-200">RELIC FOUND!</div>
                  {final.run.collected.map((id) => {
                    const def = COLLECTIBLES.find((c) => c.id === id);
                    if (!def) return null;
                    return (
                      <div key={id} className="mb-1 last:mb-0">
                        <div className="font-display text-[10px] font-black text-white">{def.name}</div>
                        <div className="text-[10px] italic leading-snug text-amber-100/75">“{def.lore}”</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ---- Co-op delivery result ---- */}
              {final.run.coop && (
                <div className="slide-up mt-2 w-full rounded-xl border border-lime-300/35 bg-lime-400/10 p-3 text-center">
                  <div className="font-display text-[10px] font-bold tracking-widest text-lime-200">SHARED CARGO DELIVERED</div>
                  <div className="mt-1 font-display text-2xl font-black text-white">{Math.round(final.run.coop.packageHp)}% INTACT</div>
                  <div className="text-[9px] text-lime-100/70">Team payout scaled by cargo condition</div>
                </div>
              )}

              <div className="slide-up mt-3 w-full rounded-2xl border border-white/10 bg-black/40 p-3" style={{ animationDelay: "0.15s" }}>
                <div className="mb-2 flex items-center justify-center gap-2 font-display text-[10px] font-bold tracking-[0.3em] text-white/70">
                  <TrophyIcon size={16} /> {final.run.mode === "daily" ? "DAILY BOARD" : "LOCAL LEGENDS"}
                </div>
                {final.run.mode === "daily" && (
                  <button
                    onClick={() => {
                      void copyText(
                        `${location.origin}${location.pathname}?mode=daily`,
                        "Daily challenge link copied — same seed, same road, good luck"
                      );
                    }}
                    className="btn-neon mx-auto mb-2 flex items-center gap-1.5 rounded-xl bg-black/60 px-3 py-1.5 font-display text-[9px] font-black tracking-widest text-cyan-200 ring-1 ring-cyan-300/40">
                    ⚔ CHALLENGE A FRIEND
                  </button>
                )}
                {renderWorldFilter()}
                {board.map((s, i) => (
                  <div key={i} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${i === final.rank && worldFilter === "all" ? "font-bold text-white" : "text-white/75"}`}
                    style={i === final.rank && worldFilter === "all" ? { background: theme.accentSoft, boxShadow: `inset 0 0 0 1px ${accent}` } : {}}>
                    <MedalIcon rank={i} size={20} />
                    <span className="font-display flex-1 text-right font-bold">{s.score.toLocaleString()}</span>
                    <span className="w-24 truncate text-right text-[10px] text-white/40">{s.theme} · {s.date}</span>
                  </div>
                ))}
              </div>

              {/* Named 2-Player Pass-and-Play Cup Bracket Summary */}
              {final.run.mode === "tournament" && tournament && cupTurnInfo && (
                <div className="mt-3 w-full rounded-2xl border border-yellow-400/35 bg-yellow-400/10 p-3 text-center">
                  <div className="flex items-center justify-center gap-2 font-display text-[10px] font-bold tracking-widest text-yellow-200">
                    <TrophyIcon size={15} /> {cupTurnInfo.finished ? "CUP FINAL RESULT" : `NEXT UP: ${cupTurnInfo.nextRider} (HEAT ${cupTurnInfo.heatNum}/3)`}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-black/35 p-2">
                      <div className="font-display text-[9px] font-bold text-cyan-200">{tournament.p1Name}</div>
                      <div className="font-display text-base font-black text-white">{cupTurnInfo.p1Total.toLocaleString()}</div>
                      <div className="text-[8px] text-white/45">{tournament.p1Heats.map((h) => h.toLocaleString()).join(" + ") || "—"}</div>
                    </div>
                    <div className="rounded-xl bg-black/35 p-2">
                      <div className="font-display text-[9px] font-bold text-pink-200">{tournament.p2Name}</div>
                      <div className="font-display text-base font-black text-white">{cupTurnInfo.p2Total.toLocaleString()}</div>
                      <div className="text-[8px] text-white/45">{tournament.p2Heats.map((h) => h.toLocaleString()).join(" + ") || "—"}</div>
                    </div>
                  </div>
                  {cupTurnInfo.finished && (
                    <div className="mt-2 font-display text-xs font-black text-emerald-300">
                      🏆 CHAMPION: {cupTurnInfo.p1Total >= cupTurnInfo.p2Total ? tournament.p1Name : tournament.p2Name}!
                    </div>
                  )}
                </div>
              )}

              <button onClick={() => {
                if (final.run.mode === "tournament") { setFinal(null); nextTournamentRound(); }
                else rideAgain();
              }}
                className="btn-neon mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-display text-xl font-black tracking-widest text-white"
                style={{ background: `linear-gradient(180deg, ${theme.swatch[0]}, ${theme.swatch[1]})`, boxShadow: `0 0 26px ${theme.accentSoft}, 0 6px 0 rgba(0,0,0,0.45)` }}>
                <RestartIcon size={22} /> {final.run.mode === "tournament" && cupTurnInfo && !cupTurnInfo.finished ? `PASS TO ${cupTurnInfo.nextRider}` : "RIDE AGAIN"}
              </button>
              <button onClick={() => { tapUi(); shareGhost(); }}
                className="btn-neon mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-cyan-300/30 bg-cyan-400/10 py-2.5 font-display text-[11px] font-bold tracking-widest text-cyan-100">
                <GhostIcon size={16} /> SHARE GHOST LINK
              </button>
              {runClip && (
                <div className="mt-2 grid w-full grid-cols-2 gap-2">
                  <button
                    onClick={() => { tapUi(); downloadClip(runClip); }}
                    className="btn-neon flex items-center justify-center gap-2 rounded-2xl border-2 border-fuchsia-300/30 bg-fuchsia-400/10 py-2.5 font-display text-[10px] font-bold tracking-widest text-fuchsia-100"
                  >
                    <CameraIcon size={15} /> DOWNLOAD LAST 10s
                  </button>
                  <button
                    onClick={() => { tapUi(); void shareClip(runClip); }}
                    className="btn-neon flex items-center justify-center gap-2 rounded-2xl border-2 border-fuchsia-300/30 bg-fuchsia-400/10 py-2.5 font-display text-[10px] font-bold tracking-widest text-fuchsia-100"
                  >
                    <ShareIcon size={15} /> SHARE CLIP
                  </button>
                </div>
              )}
              <div className="mt-2 grid w-full grid-cols-2 gap-2">
                <button onClick={doShare} disabled={sharing}
                  className="btn-neon flex items-center justify-center gap-2 rounded-2xl border-2 border-white/20 bg-white/5 py-2.5 font-display text-[11px] font-bold tracking-widest text-white/85">
                  <ShareIcon size={16} /> {sharing ? "MAKING…" : "SHARE CARD"}
                </button>
                <button onClick={() => { setFinal(null); tournamentRef.current = null; setTournament(null); engineRef.current?.backToMenu(); }}
                  className="btn-neon flex items-center justify-center gap-2 rounded-2xl border-2 border-white/20 bg-white/5 py-2.5 font-display text-[11px] font-bold tracking-widest text-white/85">
                  <HomeIcon size={16} /> MENU
                </button>
              </div>
              <div className="blink mt-3 flex items-center gap-2 font-display text-[10px] font-bold tracking-widest text-white/55">
                <BikeIcon size={16} /> SPACE / R FOR INSTANT RESTART
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
