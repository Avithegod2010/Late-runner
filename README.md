# Wrong Way Rider

A pseudo-3D endless bike runner: you ride the wrong way down a highway, dodging and jumping oncoming traffic. It runs fully offline as one static `index.html`, with no backend and no tracking. Saves stay in the browser's `localStorage`.

## Quick start

```bash
npm install
npm run dev      # local dev server
npm test         # Vitest logic suite (progression, themes, rng, ghost codec, pity, career)
npm run build    # outputs dist/index.html plus the PWA files
```

## Deploying to GitHub Pages

The build inlines all JS and CSS into `dist/index.html`. Every asset path is relative, so the game works from a repo sub-path like `/<repo>/`.

1. `npm run build`
2. Publish the **contents** of `dist/` (`index.html`, `manifest.webmanifest`, `sw.js`, `icon.svg`, `icon-maskable.svg`).
   - **Manual:** push `dist/` to a `gh-pages` branch, then set *Settings → Pages → Branch: gh-pages / root*.
   - **Actions:** use `actions/upload-pages-artifact` with `path: dist` and then `actions/deploy-pages`.
3. Open `https://<user>.github.io/<repo>/`.

After a deploy, the service worker serves the new HTML on the next load: navigations are network-first and fall back to the cache. To force an update, bump `CACHE` in `public/sw.js`.

## Testing the service worker locally

Service workers only register on **HTTPS** or **`localhost`**. `npm run dev` does register it, but stale-cache behaviour is easier to check against the production build:

```bash
npm run build && npx serve dist        # or: npx http-server dist
```

Then in Chrome DevTools, go to **Application → Service Workers**. Tick *Offline* and reload: the game should still start. Use *Update on reload* while iterating. A `file://` URL will never register the worker.

## Share links

Everything is encoded into the URL. Nothing is stored on a server.

| Param | Example | Meaning |
|---|---|---|
| `?t=` | `?t=WyJNeSBI…` | Custom colour palette (base64 JSON from *Worlds → Custom palette → Copy share link*). |
| `?route=` | `?route=19842026,1.2,0.8,rain` | Route Lab setup: `seed,trafficDensity,hazardDensity,weather`. Weather is `none \| rain \| snow \| petals \| sand \| fireflies`. |
| `?g=` | `?g=gHOAk…` | Ghost run to race. The best Classic ghost is sampled at 5 Hz into 2 bytes per sample, base64url, capped at 150 s (≈800 chars). Copy it from *Game over → Share ghost link*. |

## Controls

### Keyboard

| Action | Player 1 | Player 2 (Duel) |
|---|---|---|
| Steer | `A`/`D` or `←`/`→` | `J`/`L` |
| Jump | `W`, `↑` or `Space` | `I` |
| Slam down / brake | `S` or `↓` | `K` |
| Drift (hold) | `Shift` | — |
| Wheelie (hold) | `Q` | — |
| Spend skill nitro | `N` | — |
| Bank combo | `B` or `E` | — |
| Endless Plus (after 2000 m) | `G` | — |
| Backflip (airborne) | `F` | — |
| Horn | `H` | `U` |
| Pause | `P` or `Esc` | — |

In the menus, arrow keys move between home-screen tiles, `Enter`/`Space` activates the focused tile, `Esc` closes any dialog, and so does clicking outside it.

### Touch

- **Swipe** left/right to steer and up to jump. Swipe down to slam or brake.
- **Tap** the left or right side of the screen to steer, or the top third to jump.
- **On-screen buttons:** steer, wheelie (hold), brake, horn and jump. The Nitro and Endless+ buttons appear in the HUD when available.
- **Left-handed layout** in Settings mirrors the buttons.
- **Tilt steering** (Settings) steers by rolling the phone. Calibrate while holding the phone level. iOS asks for motion permission the first time.

### Gamepad (remappable in Settings)

| Action | Default button |
|---|---|
| Steer | D-pad or left stick |
| Jump | A |
| Brake | B |
| Horn | X |
| Bank combo | Y |
| Pause | Start |

Duel mode reads gamepad 1 for Player 1 and gamepad 2 for Player 2.

## Code map

```
src/
  App.tsx                 UI shell: HUD, panels, home screen wiring, run lifecycle
  components/             HomeScreen, HeroRider, Shop, DuelRace, ReplayTheater, RoutePreview, InteractiveTutorial, Icons
  game/
    engine.ts             simulation + canvas renderer (one class)
    codec.ts              shared UTF-8-safe base64url helpers for every share code
    systems/config.ts     vehicle specs, difficulty tables, physics constants, per-mode curves
    systems/spawning.ts   weighted traffic selection and seeded wave construction
    systems/collisions.ts lane/plane collision tests, near-miss grades and perfect-dodge windows
    systems/events.ts     police/tunnel/mirror schedules, courier rival and road-fork state
    systems/duel.ts       one shared Duel simulation rendered into both player viewports
    render/layers.ts      sky, ground, curved road, lane markings and fork layers
    render/vehicles.ts    shared vehicle renderer used by the main game and Duel
    progression.ts        profile, XP, missions, streaks, chains, career stars, sanitizing, export/import (pure)
    features.ts           modifiers, route presets, career contracts, weekly seed, ghost codec (pure)
    garage.ts             cosmetics, bike stats, mastery (pure)
    themes.ts             themes, day/night blending, custom palettes (pure)
    audio.ts              WebAudio SFX, adaptive music, synthesized announcer
    __tests__/            Vitest suite for all pure modules
```

## Cheat code

Open **Settings → Enter code** and redeem `Avithegod`. This unlocks every cosmetic, maxes all upgrades, fills rescue tickets and adds 99,999 coins. Typing the code anywhere on the home screen also works.

## Shared Duel architecture

Duel no longer runs two `Engine` instances. `SharedDuelSimulation` owns one seeded traffic array, one coin array, one fixed update loop and two lightweight player states. That shared state is rendered into two canvases, so both players see identical waves without paying twice for spawning, particles, weather or progression logic. The centre spectator band is driven by the same shared frame.

## Rolling run clips

On supported browsers, normal runs record the canvas at 30 fps. The recorder preserves the video initialization chunk and only the newest timed clusters, so memory remains bounded while retaining approximately the final 10 seconds. At Game Over, use **Download Last 10s** or **Share Clip**.

- Chrome, Edge and modern Firefox export WebM.
- Safari may export MP4 depending on `MediaRecorder.isTypeSupported`.
- Browsers without `canvas.captureStream` or `MediaRecorder` simply hide the clip controls; gameplay is unaffected.

## Weekly challenge

The ISO week key generates one fixed seed and two deterministic, non-conflicting modifiers. Each local profile gets three attempts per week; only its best score is retained under a separate `weekly:<week-key>` leaderboard.

## Engine architecture

`Engine` remains the stateful orchestrator and public input/lifecycle API. Pure and reusable responsibilities are delegated to `game/systems` and `game/render`: seeded spawning, collision math, schedules/events, road/world layers, vehicles, and the shared Duel simulation. These modules are covered by Vitest without requiring DOM or canvas fixtures.
