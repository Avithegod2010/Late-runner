/* ================================================================
   i18n scaffold (v1.0). English is the source of truth; Spanish and
   Hindi are shipped for the home menu (tiles, modes, common buttons).
   t() always falls back to the English string, so missing keys can
   never render raw key names. The engine canvas HUD intentionally
   stays English for now — DOM UI only.
   ================================================================ */

export type Lang = "en" | "es" | "hi";

export const LANGS: { id: Lang; name: string }[] = [
  { id: "en", name: "English" },
  { id: "es", name: "Español" },
  { id: "hi", name: "हिन्दी" },
];

const EN = {
  "tile.shop": "SHOP",
  "tile.garage": "GARAGE",
  "tile.career": "CAREER",
  "tile.upgrades": "UPGRADES",
  "tile.missions": "MISSIONS",
  "tile.daily": "DAILY",
  "tile.weekly": "WEEKLY",
  "tile.ranks": "RANKS",
  "tile.routelab": "ROUTE LAB",
  "tile.guide": "GUIDE",
  "tile.replay": "REPLAY",
  "tile.play": "PLAY",
  "label.gameMode": "GAME MODE",
  "label.difficulty": "DIFFICULTY",
  "label.selectMode": "SELECT MODE",
  "label.done": "DONE",
  "label.playNow": "PLAY NOW",
  "diff.chill": "Chill",
  "diff.normal": "Normal",
  "diff.insane": "Insane",
  "mode.classic": "Classic",
  "mode.zen": "Zen",
  "mode.timetrial": "Time Trial",
  "mode.daily": "Daily",
  "mode.duel": "Duel",
  "mode.coop": "Co-op",
  "mode.tournament": "Cup",
  "mode.practice": "Practice",
  "mode.route": "Route",
  "mode.weekly": "Weekly",
  "mode.bossrush": "Boss Rush",
  "mode.career": "Career",
  "ticker.allDone": "All missions done — ride to level up the set!",
} as const;

export type I18nKey = keyof typeof EN;

const ES: Partial<Record<I18nKey, string>> = {
  "tile.shop": "TIENDA",
  "tile.garage": "GARAJE",
  "tile.career": "CARRERA",
  "tile.upgrades": "MEJORAS",
  "tile.missions": "MISIONES",
  "tile.daily": "DIARIA",
  "tile.weekly": "SEMANAL",
  "tile.ranks": "RANKING",
  "tile.routelab": "TALLER",
  "tile.guide": "GUÍA",
  "tile.replay": "REPLAY",
  "tile.play": "JUGAR",
  "label.gameMode": "MODO DE JUEGO",
  "label.difficulty": "DIFICULTAD",
  "label.selectMode": "ELEGIR MODO",
  "label.done": "LISTO",
  "label.playNow": "JUGAR YA",
  "diff.chill": "Tranquilo",
  "diff.normal": "Normal",
  "diff.insane": "Demente",
  "mode.classic": "Clásico",
  "mode.zen": "Zen",
  "mode.timetrial": "Contrarreloj",
  "mode.daily": "Diaria",
  "mode.duel": "Duelo",
  "mode.coop": "Coop",
  "mode.tournament": "Copa",
  "mode.practice": "Práctica",
  "mode.route": "Ruta",
  "mode.weekly": "Semanal",
  "mode.bossrush": "Jefes",
  "mode.career": "Carrera",
  "ticker.allDone": "¡Misiones completadas! Sigue rodando para subir el conjunto.",
};

const HI: Partial<Record<I18nKey, string>> = {
  "tile.shop": "दुकान",
  "tile.garage": "गैराज",
  "tile.career": "करियर",
  "tile.upgrades": "अपग्रेड",
  "tile.missions": "मिशन",
  "tile.daily": "डेली",
  "tile.weekly": "साप्ताहिक",
  "tile.ranks": "रैंक",
  "tile.routelab": "रूट लैब",
  "tile.guide": "गाइड",
  "tile.replay": "रिप्ले",
  "tile.play": "खेलें",
  "label.gameMode": "गेम मोड",
  "label.difficulty": "कठिनाई",
  "label.selectMode": "मोड चुनें",
  "label.done": "पूर्ण",
  "label.playNow": "अभी खेलें",
  "diff.chill": "आराम",
  "diff.normal": "सामान्य",
  "diff.insane": "पागल",
  "mode.classic": "क्लासिक",
  "mode.zen": "ज़ेन",
  "mode.timetrial": "टाइम ट्रायल",
  "mode.daily": "डेली",
  "mode.duel": "ड्यूल",
  "mode.coop": "को-ऑप",
  "mode.tournament": "कप",
  "mode.practice": "प्रैक्टिस",
  "mode.route": "रूट",
  "mode.weekly": "साप्ताहिक",
  "mode.bossrush": "बॉस रश",
  "mode.career": "करियर",
  "ticker.allDone": "सारे मिशन पूरे — सेट बढ़ाने के लिए और चलें!",
};

const DICTS: Record<Lang, Partial<Record<I18nKey, string>>> = { en: EN, es: ES, hi: HI };

/** Translate a key with graceful fallback: lang dict → English → provided fallback → key. */
export function t(lang: Lang | undefined, key: I18nKey, fallback?: string): string {
  const l: Lang = lang ?? "en";
  if (l !== "en") {
    const v = DICTS[l]?.[key];
    if (v) return v;
  }
  return EN[key] ?? fallback ?? key;
}

/** True when every English key has a translation in the given language (used by tests). */
export function isComplete(lang: Lang): boolean {
  const d = DICTS[lang];
  return (Object.keys(EN) as I18nKey[]).every((k) => !!d[k]);
}
