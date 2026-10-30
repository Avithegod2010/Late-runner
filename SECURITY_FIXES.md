# Security Audit & Fix Report

**Project:** Wrong Way Rider (bike-lane-runner) — static single-file PWA for GitHub Pages
**Scope:** full codebase (engine, systems, UI shell, pure modules, service worker, build)
**Result:** 48/48 tests pass · TypeScript clean · production build verified in-browser (zero console/page errors)

---

## 1. Threat model for a static game

There is no backend. The attack surface is:

| Surface | Risk |
|---|---|
| `?t=` / `?route=` / `?g=` URL params | Malformed share links (malicious or corrupted) reaching the render path |
| `localStorage` saves & imported profile codes | Poisoned data → persistent crash loops (bricked save) |
| HUD `innerHTML` fragments | Injection class if engine strings ever carry user text |
| Service worker | Cache abuse / stale-shell behaviour |
| Supply chain | External requests, eval-class APIs |

Verified clean: **no `eval`, no `new Function`, no `dangerouslySetInnerHTML`, no `postMessage`, no network calls beyond Google Fonts** (only `index.html` font links).

## 2. Vulnerabilities found & fixed

### CRITICAL — Malformed `?t=` palette link white-screened AND bricked the save
- `decodeCustom()` only guarded `atob`/`JSON.parse`; a parseable-but-wrong-shaped payload produced `undefined` colour fields → `TypeError` during render → white screen. The URL-derived settings were then persisted, so the crash looped on every reload until site data was cleared.
- **Fix:** full shape validation (8-element array of strings, weather whitelisted, name/colour length caps, per-field fallbacks), code length cap, and the payload is now UTF-8-safe base64url.
- Verified: `?t=WyJhYmMiXQ==` (old poison link) now loads the game with defaults.

### CRITICAL — Import codes / corrupted saves could persist a crash loop
- `importProfile()` validated exactly one field (`wallet`); `loadProfile()` trusted shapes. `scores: null`, `runHistory: "abc"`, etc. crashed the game and were saved back → unbreakable loop.
- **Fix:** `sanitizeProfile(unknown): Profile` deep-validates every field (types, ranges, array caps, `__proto__`/`constructor`/`prototype` key stripping, ghost/replay frame caps). Both `loadProfile()` and `importProfile()` funnel through it. Import also rejects unknown schema versions (`v !== 3`).
- Verified in-browser: a hostile profile (wrong types, `__proto__` own-property, junk arrays) loads cleanly.

### MAJOR — HUD `innerHTML` injection class (latent)
- 4 sites interpolated engine strings unescaped. All values are engine constants today (not exploitable), but one refactor away from stored XSS.
- **Fix:** all dynamic values now pass through an `esc()` HTML-escape helper.

### MEDIUM — No Content-Security-Policy
- **Fix:** CSP meta tag: `default-src 'self'` + Google Fonts + `script-src 'unsafe-inline'` (required by the single-file build) + `base-uri 'none'; form-action 'none'`. Blocks any future external script/connect exfiltration.

### MEDIUM — Deprecated & non-URL-safe codecs
- `escape()`/`unescape()` (Annex-B deprecated) replaced by a shared `game/codec.ts` (`TextEncoder`/`TextDecoder`, chunked, URL-safe base64url with legacy-standard input support).
- Palette codes are now URL-safe end-to-end (non-ASCII names no longer corrupt via `+`→space) — regression-tested.
- Ghost share codes capped at 8 KB; profile import codes capped at 1 MB.

### MEDIUM — Service worker hardening
- Navigation cache write now inside `event.waitUntil` (was killable mid-write); core pre-cache failures logged instead of silently swallowed; `icon-maskable.svg` added to offline core; explicit offline `Response` fallback; runtime cache capped (60 entries, shell never evicted).

## 3. Gameplay bugs found & fixed

**Physics / fairness**
- **Collision tunneling:** at top speed (~80 m/s) a single frame step exceeded the entire hit window — cars, hazards, coins, pickups and toll gates could be skipped entirely. All five checks now use swept (crossing-plane) tests.
- **Rain weather never applied** when forced by Route/Career contracts (Rain Run, Monsoon…) unless the Downpour modifier was also active.
- **Mirror Mode ignored by one-switch assist and tilt steering** (they wrote `lane` directly); both now funnel through `move()` like every other input.
- **Coin-value upgrades were no-ops** (`Math.round(1.05…1.35)` = 1); fractional coin value now accumulates, so "+10% coin value" pays out.
- **Practice mode** still spawned deadly police spike strips and lane-closure barriers; both excluded now.

**Input / UI**
- Holding `P`/`Esc` flickered pause↔resume (OS key auto-repeat, no `e.repeat` guard).
- `Esc` with a panel open over a paused game closed the panel *and* resumed the run.
- Weekly game-over always showed "NEW BEST!" (leaderboard key was missing `weekKey` → looked up an empty bucket).
- Failed purchases still equipped the item; upgrade double-click could double-charge; crate double-click could duplicate rewards; rescue tickets could be silently wasted at the 3-cap.
- Toast messages overwrote each other's timers; score-card share failures were silent; "RACING A SHARED GHOST" badge lied when ghosts were disabled.

**Stability / performance**
- Particles spawned while paused (air trail + nitro exhaust had no phase guard) → unbounded growth during blur auto-pause, bursting on resume.
- BGM scheduler caught up catastrophically after background-tab throttling (scheduled every missed note at once); now resyncs.
- Ghost playback rescanned the whole recording every frame (O(n)); now uses a monotonic cursor.
- Corrupted `routeTraffic`/`routeHazards` (NaN) permanently halted wave/hazard spawning; all numeric setting reads are NaN-safe clamps now.
- Stale audio state after `destroy()` (pitched-down engine, tunnel reverb) — `sfx.reset()` on teardown; `AudioContext.resume()` rejection handled; slow-mo pitch timer can no longer fight bullet-time.
- Duel: rival ghost rendered ~1.5× too large; stuck keys after window blur; resize on detached canvas no longer throws.
- Police chase flash now respects Reduce Motion; daily seed is UTC (same run worldwide, matching the "Same seed worldwide" promise); grind balance uses the seeded RNG so Daily runs are truly deterministic.

## 4. Dead code removed

- Legacy in-engine Duel path (dead since the shared simulation): `playerSlot`, P2 keymap, `RivalState`, `setRivalState`/`getLivePosition`, spectator-band renderer.
- `Convoy` marker objects (maintained but never rendered — the member cars still spawn), `convoyCount`.
- `src/utils/cn.ts` + `clsx`/`tailwind-merge` dependencies (unused).
- Hidden "tree-shake-safe" icon span (+ 5 icon imports).
- Duplicate `routeTraffic`/`routeHazards`/`routeWeather` settings (`settings.route` is the single source), duplicate `settings.upgrades` write.
- `SpawnDifficulty.speed`, `TollGate.lane`, `Boss.sweepTo`/`hits`, unreachable `HazardKind` members, `Pose "tailwhip"`, `SFX.countTick`, `applyRun.careerStars` (always 0), cheat-buffer Backspace branch, `.swatch-spin` CSS.
- Triplicated `roundRect` → one shared helper in `rider.ts`; 4 dead/no-op statements removed.

## 5. Residual risk (accepted)

- `script-src 'unsafe-inline'` is required by the single-file build; the CSP still blocks external script/context exfiltration.
- Profile import can self-grant coins (no server) — self-cheat only, capped values.
- `setProfile` updaters perform `saveProfile` side effects (idempotent in production; flagged as known tech debt for a future `useProfile` hook refactor).

## 6. Regression coverage added

- Palette codec: non-ASCII round-trip, URL-safe output, malformed/wrong-typed codes rejected.
- Ghost codec: oversized code rejection.
- Profile sanitizing: hostile payload (wrong types, `__proto__` own-property, junk arrays, out-of-range numbers) → safe shape, no prototype pollution, still playable; unknown import versions rejected.
