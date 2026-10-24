/* ================================================================
   Synthesised audio: SFX, adaptive synthwave BGM, tunnel reverb.
   No asset files — everything is generated with WebAudio.
   ================================================================ */

import type { HornId } from "./garage";
import type { StationId } from "./features";
import { packById, type SoundPackDef, type SoundPackId } from "./soundpacks";

type Osc = OscillatorNode;

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

export class SFX {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private duckFilter: BiquadFilterNode | null = null;
  private wetGain: GainNode | null = null;
  private delay: DelayNode | null = null;
  private feedback: GainNode | null = null;

  private engineOsc: Osc | null = null;
  private engineSub: Osc | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  private sirenOsc: Osc | null = null;
  private sirenGain: GainNode | null = null;
  private sirenLfo: Osc | null = null;

  private musicTimer: number | null = null;
  private step = 0;
  private nextNoteTime = 0;
  private comboLayer = 0;
  private station: StationId = "synthwave";
  private lastAnnounce = 0;
  private inTunnelMix = false;
  private slowPitch = 1;
  private slowGen = 0;
  private lastSurfaceTick = 0;
  private voiceRestoreTimer: number | null = null;
  musicOn = true;
  muted = false;

  /* sound pack + custom horn + danger heartbeat state */
  private pack: SoundPackDef = packById("neon");
  private customHorn: number[] | null = null;
  private lastThreatCue = 0;
  private panic = false;
  private panicTimer: number | null = null;
  private panicBeats = 0;
  private nextBeatAt = 0;

  /* ---------------- graph ---------------- */

  private ensure() {
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      const ctx = new AC();
      this.ctx = ctx;

      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;

      // global lowpass used to "duck" everything during jumps / near misses
      this.duckFilter = ctx.createBiquadFilter();
      this.duckFilter.type = "lowpass";
      this.duckFilter.frequency.value = 20000;

      // feedback delay doubles as the tunnel reverb
      this.delay = ctx.createDelay(1.0);
      this.delay.delayTime.value = 0.17;
      this.feedback = ctx.createGain();
      this.feedback.gain.value = 0.32;
      this.wetGain = ctx.createGain();
      this.wetGain.gain.value = 0;

      this.sfxBus = ctx.createGain();
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = 0.42;

      this.sfxBus.connect(this.duckFilter);
      this.musicBus.connect(this.duckFilter);
      this.duckFilter.connect(this.master);

      this.duckFilter.connect(this.delay);
      this.delay.connect(this.feedback);
      this.feedback.connect(this.delay);
      this.delay.connect(this.wetGain);
      this.wetGain.connect(this.master);

      this.master.connect(ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => { /* autoplay policy */ });
    return this.ctx;
  }

  unlock() {
    this.ensure();
  }

  setMuted(m: boolean) {
    this.muted = m;
    const ctx = this.ctx;
    if (this.master && ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.55, ctx.currentTime, 0.02);
    }
  }

  setMusicEnabled(on: boolean) {
    this.musicOn = on;
    if (!on) this.stopMusic();
  }

  setStation(station: StationId) {
    this.station = station;
  }

  /* ---------------- selectable sound pack (Settings) ----------------
     Re-voices the whole synth: one-shot waveform, pitch, engine
     character, noise brightness, coin transposition and music tempo. */

  setSoundPack(id: SoundPackId) {
    this.pack = packById(id);
    // re-voice a running engine without restarting it
    if (this.engineOsc && this.ctx) {
      this.engineOsc.type = this.pack.engineOsc;
      if (this.engineFilter) {
        this.engineFilter.frequency.setTargetAtTime(
          220 * this.pack.engineCut, this.ctx.currentTime, 0.2
        );
      }
    }
  }

  /** 16-step custom horn (semitone offsets, -1 = rest). null restores the stock horn. */
  setCustomHorn(steps: number[] | null) {
    this.customHorn =
      steps && steps.length
        ? steps
            .slice(0, 16)
            .map((s) => (typeof s === "number" && Number.isFinite(s) ? Math.max(-1, Math.min(24, Math.round(s))) : -1))
        : null;
  }

  /* ---------------- synthesized announcer (no speechSynthesis) ---------------- */

  /**
   * Arcade-style vocal chop built from the WebAudio graph: a sawtooth "voice"
   * through two moving band-pass formants, one syllable per word.
   * Works offline, sounds identical on every platform, and ducks music ~4 dB.
   */
  announce(pack: "arcade" | "hype" | "chill" | "silent", line: string) {
    if (pack === "silent" || !line) return;
    const now = performance.now();
    if (now - this.lastAnnounce < 900) return;
    this.lastAnnounce = now;
    const ctx = this.ensure();
    const bus = this.sfxBus;
    if (!ctx || !bus) return;

    if (this.musicBus) {
      this.musicBus.gain.setTargetAtTime(0.265, ctx.currentTime, 0.04);
      if (this.voiceRestoreTimer !== null) clearTimeout(this.voiceRestoreTimer);
      this.voiceRestoreTimer = window.setTimeout(() => {
        // restore to whatever the danger ducking currently wants, not a hardcoded level
        if (this.ctx && this.musicBus) {
          this.musicBus.gain.setTargetAtTime(this.danger ? 0.2 : 0.42, this.ctx.currentTime, 0.16);
        }
        this.voiceRestoreTimer = null;
      }, 700);
    }

    const pitch = pack === "hype" ? 1.35 : pack === "chill" ? 0.72 : 1;
    const rate = pack === "hype" ? 0.8 : pack === "chill" ? 1.3 : 1;
    const words = line.toUpperCase().replace(/[^A-Z ]/g, "").split(/\s+/).filter(Boolean).slice(0, 3);
    // vowel formant pairs (F1, F2) chosen from each word's first vowel
    const formants: Record<string, [number, number]> = {
      A: [800, 1200], E: [500, 1900], I: [320, 2300], O: [500, 900], U: [350, 800], Y: [320, 2200],
    };
    let t0 = ctx.currentTime + 0.01;
    words.forEach((word, wi) => {
      const syl = Math.max(1, Math.min(3, (word.match(/[AEIOUY]+/g) ?? ["A"]).length));
      const vowels = word.match(/[AEIOUY]/g) ?? ["A"];
      for (let si = 0; si < syl; si++) {
        const dur = 0.11 * rate;
        const v = vowels[Math.min(si, vowels.length - 1)];
        const [f1, f2] = formants[v] ?? formants.A;
        const base = (wi === words.length - 1 && si === syl - 1 ? 150 : 185) * pitch;
        const src = ctx.createOscillator();
        src.type = "sawtooth";
        src.frequency.setValueAtTime(base * 1.12, t0);
        src.frequency.exponentialRampToValueAtTime(base * 0.86, t0 + dur);
        const bp1 = ctx.createBiquadFilter();
        bp1.type = "bandpass"; bp1.frequency.value = f1 * pitch; bp1.Q.value = 6;
        const bp2 = ctx.createBiquadFilter();
        bp2.type = "bandpass"; bp2.frequency.value = f2 * pitch; bp2.Q.value = 8;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.5, t0 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        src.connect(bp1); src.connect(bp2);
        bp1.connect(g); bp2.connect(g);
        g.connect(bus);
        src.start(t0);
        src.stop(t0 + dur + 0.03);
        // consonant click at each syllable start
        this.noiseAt(t0, 0.025, 0.12, 3200 * pitch);
        t0 += dur + 0.02 * rate;
      }
      t0 += 0.05 * rate;
    });
  }

  private noiseAt(t0: number, dur: number, vol: number, freq: number) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxBus);
    src.start(t0);
  }

  /* ---------------- danger-reactive music ---------------- */

  private danger = false;
  /** Drop the mix to a filtered pulse while a heavy vehicle is ~2s out in your lane. */
  setDanger(on: boolean) {
    if (on === this.danger) return;
    this.danger = on;
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    this.musicBus.gain.setTargetAtTime(on ? 0.2 : 0.42, ctx.currentTime, on ? 0.05 : 0.12);
  }
  get inDanger() { return this.danger; }

  /* ---------------- per-bike engine tone ---------------- */

  private bikeTone: { type: OscillatorType; mul: number; q: number } = { type: "sawtooth", mul: 1, q: 2 };
  setBikeTone(bikeId: string) {
    const tones: Record<string, { type: OscillatorType; mul: number; q: number }> = {
      neon: { type: "sawtooth", mul: 1, q: 2 },
      racer: { type: "square", mul: 1.45, q: 4 },
      midnight: { type: "sawtooth", mul: 0.7, q: 7 },
      volt: { type: "triangle", mul: 1.9, q: 1.2 },
    };
    this.bikeTone = tones[bikeId] ?? tones.neon;
  }

  /** Tunnel sections get a wet echoing tail while trimming engine drone so mobile speakers stay clear. */
  setTunnel(inside: boolean) {
    this.inTunnelMix = inside;
    const ctx = this.ctx;
    if (!ctx || !this.wetGain || !this.feedback) return;
    this.wetGain.gain.setTargetAtTime(inside ? 0.33 : 0, ctx.currentTime, 0.25);
    this.feedback.gain.setTargetAtTime(inside ? 0.45 : 0.3, ctx.currentTime, 0.25);
    if (this.engineGain) {
      this.engineGain.gain.setTargetAtTime(inside ? 0.052 : 0.09, ctx.currentTime, 0.25);
    }
  }

  /** Momentary muffle — used on jumps and near misses. */
  duck(amount = 900, release = 0.45) {
    const ctx = this.ctx;
    if (!ctx || !this.duckFilter) return;
    const t = ctx.currentTime;
    this.duckFilter.frequency.cancelScheduledValues(t);
    this.duckFilter.frequency.setValueAtTime(amount, t);
    this.duckFilter.frequency.exponentialRampToValueAtTime(20000, t + release);
  }

  /* ---------------- engine loop ---------------- */

  startEngine() {
    const ctx = this.ensure();
    if (!ctx || !this.sfxBus || this.engineOsc) return;
    const osc = ctx.createOscillator();
    osc.type = this.pack.engineOsc;
    osc.frequency.value = 55 * this.bikeTone.mul;
    const sub = ctx.createOscillator();
    sub.type = "square";
    sub.frequency.value = 27.5;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 220 * this.pack.engineCut;
    filter.Q.value = this.bikeTone.q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);
    osc.start();
    sub.start();
    gain.gain.setTargetAtTime(this.inTunnelMix ? 0.052 : 0.09, ctx.currentTime, 0.4);
    this.engineOsc = osc;
    this.engineSub = sub;
    this.engineGain = gain;
    this.engineFilter = filter;
  }

  updateEngine(speed01: number) {
    const ctx = this.ctx;
    if (!ctx || !this.engineOsc || !this.engineFilter) return;
    const t = ctx.currentTime;
    const baseFreq = (50 + speed01 * 95) * this.slowPitch * this.bikeTone.mul;
    this.engineOsc.frequency.setTargetAtTime(baseFreq, t, 0.12);
    if (this.engineSub) {
      this.engineSub.frequency.setTargetAtTime(baseFreq * 0.5, t, 0.12);
    }
    this.engineFilter.frequency.setTargetAtTime((180 + speed01 * 520) * this.slowPitch * this.pack.engineCut, t, 0.12);
  }

  stopEngine() {
    const ctx = this.ctx;
    if (!ctx || !this.engineGain) return;
    this.engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
    const osc = this.engineOsc;
    const sub = this.engineSub;
    setTimeout(() => {
      try {
        osc?.stop();
        sub?.stop();
      } catch {
        /* already stopped */
      }
    }, 500);
    this.engineOsc = null;
    this.engineSub = null;
    this.engineGain = null;
    this.engineFilter = null;
  }

  /* ---------------- primitives ---------------- */

  private blip(
    freq: number, dur: number, type: OscillatorType, vol: number,
    slideTo?: number, delay = 0, pan = 0
  ) {
    const ctx = this.ensure();
    if (!ctx || !this.sfxBus) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    // the active sound pack re-voices the stock square lead
    osc.type = type === "square" ? this.pack.osc : type;
    osc.frequency.setValueAtTime(Math.max(1, freq * this.pack.pitch), t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo * this.pack.pitch), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    if (pan !== 0 && typeof ctx.createStereoPanner === "function") {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp1(pan);
      g.connect(p);
      p.connect(this.sfxBus);
    } else {
      g.connect(this.sfxBus);
    }
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, vol: number, filterFreq: number, slideTo?: number, type: BiquadFilterType = "bandpass") {
    const ctx = this.ensure();
    if (!ctx || !this.sfxBus) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = 0.8;
    const t0 = ctx.currentTime;
    f.frequency.setValueAtTime(Math.max(20, filterFreq * this.pack.noise), t0);
    if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo * this.pack.noise), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start();
  }

  /* ---------------- one-shots ---------------- */

  swoosh() { this.noise(0.18, 0.2, 900, 2600); }
  coin() {
    // coin jingle transposes with the sound pack (semitone shift)
    const shift = Math.pow(2, this.pack.coinShift / 12);
    this.blip(1175 * shift, 0.09, "square", 0.12);
    this.blip(1568 * shift, 0.16, "square", 0.12, undefined, 0.07);
  }
  honk() {
    this.blip(370, 0.22, "square", 0.07);
    this.blip(466, 0.22, "square", 0.07);
  }
  nearMiss() {
    this.noise(0.3, 0.36, 500, 3400);
    this.blip(880, 0.2, "triangle", 0.14, 1320, 0.05);
    this.duck(1400, 0.35);
  }
  crash() {
    this.noise(0.65, 0.85, 400, 60);
    this.blip(110, 0.5, "sawtooth", 0.32, 30);
    this.blip(70, 0.7, "square", 0.28, 24, 0.05);
  }
  ui() { this.blip(660, 0.08, "sine", 0.16, 880); }
  go() { this.blip(784, 0.25, "square", 0.15, 1046); }
  jump() {
    this.blip(300, 0.22, "triangle", 0.18, 760);
    this.noise(0.12, 0.1, 700, 2200);
    this.duck(1200, 0.3);
  }
  land() {
    this.noise(0.16, 0.26, 240, 90);
    this.blip(140, 0.14, "sine", 0.16, 70);
  }

  /** Shield shatter: bright glass shards. */
  glassBreak() {
    this.noise(0.5, 0.5, 5200, 1400, "highpass");
    for (let i = 0; i < 7; i++) {
      this.blip(1800 + Math.random() * 2600, 0.12 + Math.random() * 0.2, "triangle", 0.09,
        600 + Math.random() * 500, i * 0.035);
    }
    this.blip(220, 0.4, "sine", 0.18, 90);
  }

  /** Nitro ignition: rising roar. */
  nitro() {
    this.noise(0.9, 0.45, 300, 4200);
    this.blip(120, 0.8, "sawtooth", 0.22, 900);
    this.blip(240, 0.8, "square", 0.12, 1400, 0.04);
  }

  powerup() {
    this.blip(523, 0.1, "square", 0.13);
    this.blip(659, 0.1, "square", 0.13, undefined, 0.07);
    this.blip(988, 0.22, "square", 0.14, undefined, 0.14);
  }

  /** Bullet-time entry: pitch-dropping whoosh + engine pitch-down. */
  warpIn() {
    this.slowGen++;
    this.slowPitch = 0.62;
    this.duck(820, 0.85);
    this.blip(1320, 0.65, "sine", 0.2, 135);
    this.blip(660, 0.65, "sawtooth", 0.08, 72);
    this.noise(0.7, 0.26, 3200, 260);
  }

  /** Bullet-time exit: rising reverse sweep back to full speed. */
  warpOut() {
    this.slowGen++;
    this.slowPitch = 1;
    this.blip(145, 0.52, "sine", 0.19, 1480);
    this.blip(95, 0.48, "triangle", 0.12, 920, 0.04);
    this.noise(0.45, 0.22, 280, 4600);
  }

  /** Short Matrix-beat slow-mo sweep for Perfect Dodges. */
  perfectSlow() {
    const gen = ++this.slowGen;
    this.slowPitch = 0.68;
    this.duck(900, 0.45);
    this.blip(1180, 0.24, "sine", 0.18, 220);
    this.noise(0.24, 0.22, 2600, 420);
    setTimeout(() => {
      if (gen !== this.slowGen) return; // a warpIn/warpOut superseded this slow-mo
      this.slowPitch = 1;
      this.blip(240, 0.22, "triangle", 0.14, 1320);
      this.noise(0.2, 0.16, 420, 3800);
    }, 260);
  }

  /** Reset transient mixer state so a fresh run never inherits stale effects. */
  reset() {
    this.slowGen++;
    this.slowPitch = 1;
    this.inTunnelMix = false;
    this.comboLayer = 0;
    this.danger = false;
    this.setPanic(false);
    this.lastThreatCue = 0;
    if (this.voiceRestoreTimer !== null) {
      clearTimeout(this.voiceRestoreTimer);
      this.voiceRestoreTimer = null;
    }
  }

  bank() {
    this.blip(587, 0.09, "triangle", 0.16);
    this.blip(880, 0.14, "triangle", 0.17, undefined, 0.07);
  }

  cashIn() {
    this.blip(784, 0.08, "square", 0.14);
    this.blip(1046, 0.09, "square", 0.14, undefined, 0.06);
    this.blip(1568, 0.2, "square", 0.16, undefined, 0.12);
  }

  /** Distinct tire texture per non-asphalt surface. */
  surfaceTick(kind: "oil" | "gravel" | "wet") {
    const now = performance.now();
    if (now - this.lastSurfaceTick < 135) return;
    this.lastSurfaceTick = now;
    if (kind === "oil") {
      this.blip(185, 0.13, "sine", 0.075, 92);
    } else if (kind === "gravel") {
      this.noise(0.09, 0.12, 2500, 1400, "bandpass");
    } else {
      this.noise(0.12, 0.095, 4400, 2900, "highpass");
    }
  }

  stunt(index: number) {
    const scale = [523, 659, 784, 988, 1175];
    this.blip(scale[index % scale.length], 0.14, "square", 0.13, undefined, 0);
    this.blip(scale[(index + 2) % scale.length], 0.18, "triangle", 0.1, undefined, 0.06);
  }

  /** Slingshot Slipstream release: fiery burst + brief thrust roar. */
  slingshot() {
    this.noise(0.55, 0.42, 600, 4200);
    this.blip(150, 0.5, "sawtooth", 0.26, 1050);
    this.blip(300, 0.42, "square", 0.14, 1700, 0.05);
    this.blip(75, 0.6, "sine", 0.2, 240);
    this.duck(1100, 0.4);
  }

  /** Portal shard / bonus pickup: bright bell arpeggio. */
  chime() {
    const base = 1046.5;
    this.blip(base, 0.34, "sine", 0.16);
    this.blip(base * 1.335, 0.38, "sine", 0.14, undefined, 0.09);
    this.blip(base * 1.498, 0.46, "sine", 0.13, undefined, 0.18);
    this.blip(base * 2, 0.6, "triangle", 0.1, undefined, 0.27);
  }

  /** Night Storm thunderclap: crack + rolling sub-bass rumble. */
  thunder() {
    this.noise(0.16, 0.34, 3400, 900, "highpass");
    this.noise(1.7, 0.5, 340, 48, "lowpass");
    this.blip(72, 1.15, "sawtooth", 0.18, 26);
    this.blip(48, 1.5, "sine", 0.16, 22, 0.12);
  }

  /**
   * Directional threat cue (Directional Audio Assistance).
   * Panned left/right toward the incoming vehicle; a soft airy blip
   * marks jumpable traffic, a harsh double horn marks trucks/buses
   * that can only be avoided with a lane change.
   */
  threatCue(side: number, jumpable: boolean) {
    const now = performance.now();
    if (now - this.lastThreatCue < 240) return; // never spam
    this.lastThreatCue = now;
    const pan = clamp1(side * 0.85);
    if (jumpable) {
      this.blip(880, 0.12, "triangle", 0.11, 1240, 0, pan);
    } else {
      this.blip(196, 0.16, "sawtooth", 0.14, undefined, 0, pan);
      this.blip(247, 0.16, "sawtooth", 0.12, undefined, 0.09, pan);
    }
  }

  /* ---------------- adaptive danger heartbeat ---------------- */

  /**
   * Sub-bass heartbeat that accelerates while a heavy vehicle is about
   * to hit you; stops the moment danger clears. Pairs with the music
   * low-pass duck in setDanger for the "strip the highs" effect.
   */
  setPanic(on: boolean) {
    if (on === this.panic) return;
    this.panic = on;
    if (on) {
      this.panicBeats = 0;
      this.nextBeatAt = performance.now() + 120;
      if (this.panicTimer === null) {
        this.panicTimer = window.setInterval(() => this.tickHeartbeat(), 55);
      }
    } else if (this.panicTimer !== null) {
      clearInterval(this.panicTimer);
      this.panicTimer = null;
    }
  }

  private tickHeartbeat() {
    if (!this.panic) return;
    const now = performance.now();
    if (now < this.nextBeatAt) return;
    // accelerate from 66 to 132 BPM the longer the threat persists
    const bpm = Math.min(132, 66 + this.panicBeats * 9);
    this.panicBeats++;
    const period = 60000 / bpm;
    const vol = Math.min(0.3, 0.17 + this.panicBeats * 0.012);
    this.heartThump(now, vol);
    this.heartThump(now + period * 0.3, vol * 0.7);
    this.nextBeatAt = now + period;
  }

  private heartThump(atMs: number, vol: number) {
    const ctx = this.ensure();
    if (!ctx || !this.sfxBus) return;
    const t0 = ctx.currentTime + Math.max(0, (atMs - performance.now()) / 1000);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(58, t0);
    osc.frequency.exponentialRampToValueAtTime(33, t0 + 0.15);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.018);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.17);
    osc.connect(g);
    g.connect(this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + 0.22);
  }

  ramp() {
    this.noise(0.3, 0.3, 400, 2600);
    this.blip(180, 0.45, "sawtooth", 0.2, 820);
  }

  horn(kind: HornId) {
    // a saved 16-step custom horn takes priority over the stock horns
    if (this.customHorn) {
      this.playCustomHorn();
      return;
    }
    switch (kind) {
      case "siren":
        this.blip(700, 0.5, "sawtooth", 0.12, 1250);
        this.blip(1250, 0.5, "sawtooth", 0.1, 700, 0.5);
        break;
      case "dixie":
        this.blip(659, 0.16, "square", 0.12);
        this.blip(784, 0.16, "square", 0.12, undefined, 0.16);
        this.blip(1046, 0.3, "square", 0.13, undefined, 0.32);
        break;
      case "laser":
        this.blip(1800, 0.18, "sawtooth", 0.13, 300);
        this.blip(900, 0.12, "square", 0.08, 220, 0.1);
        break;
      default:
        this.blip(210, 0.45, "sawtooth", 0.16);
        this.blip(265, 0.45, "sawtooth", 0.14);
        this.noise(0.4, 0.08, 500, 300);
    }
  }

  /** Play the sequenced 16-step horn: 95 ms steps, semitone offsets. */
  private playCustomHorn() {
    const steps = this.customHorn;
    if (!steps) return;
    const stepDur = 0.095;
    const base = 330 * this.pack.pitch;
    let t = 0;
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (s < 0) {
        t += stepDur;
        continue;
      }
      const freq = base * Math.pow(2, s / 12);
      this.blip(freq, stepDur * 1.2, this.pack.osc, 0.15, undefined, t);
      this.blip(freq * 2, stepDur * 0.9, "sine", 0.05, undefined, t);
      t += stepDur;
    }
  }

  /* ---------------- police siren loop ---------------- */

  startSiren() {
    const ctx = this.ensure();
    if (!ctx || !this.sfxBus || this.sirenOsc) return;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 760;
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.9;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 240;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    const g = ctx.createGain();
    g.gain.value = 0;
    osc.connect(g);
    g.connect(this.sfxBus);
    osc.start();
    lfo.start();
    g.gain.setTargetAtTime(0.055, ctx.currentTime, 0.4);
    this.sirenOsc = osc;
    this.sirenGain = g;
    this.sirenLfo = lfo;
  }

  stopSiren() {
    const ctx = this.ctx;
    if (!ctx || !this.sirenGain) return;
    this.sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    const osc = this.sirenOsc;
    const lfo = this.sirenLfo;
    setTimeout(() => {
      try {
        osc?.stop();
        lfo?.stop();
      } catch {
        /* already stopped */
      }
    }, 900);
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
  }

  /* ---------------- adaptive BGM ---------------- */

  /** 0 = drums only, 1 = +bass, 2 = +lead (driven by combo). */
  setComboLayer(layer: number) {
    this.comboLayer = Math.max(0, Math.min(2, layer));
  }

  startMusic(mellow = false) {
    const ctx = this.ensure();
    if (!ctx || !this.musicOn || this.musicTimer !== null) return;
    this.step = 0;
    this.nextNoteTime = ctx.currentTime + 0.1;
    const bpm = (mellow ? 78 : this.station === "arcade" ? 148 : this.station === "cruise" ? 92 : 124) * this.pack.tempo;
    const stepDur = 60 / bpm / 4;
    const tick = () => {
      const c = this.ctx;
      if (!c) return;
      // background tabs throttle timers; resync instead of scheduling every
      // missed step at once (which blasted thousands of nodes on return)
      if (this.nextNoteTime < c.currentTime - 0.2) this.nextNoteTime = c.currentTime + 0.05;
      while (this.nextNoteTime < c.currentTime + 0.12) {
        this.scheduleStep(this.step, this.nextNoteTime, mellow);
        this.nextNoteTime += stepDur;
        this.step = (this.step + 1) % 32;
      }
    };
    tick();
    this.musicTimer = window.setInterval(tick, 40);
  }

  stopMusic() {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private mVoice(
    freq: number, t: number, dur: number, type: OscillatorType, vol: number, slideTo?: number
  ) {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(this.musicBus);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  private mNoise(t: number, dur: number, vol: number, freq: number) {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.musicBus);
    src.start(t);
  }

  /** Am - F - C - G flavoured synthwave pattern. */
  private scheduleStep(step: number, t: number, mellow: boolean) {
    const bar = Math.floor(step / 8) % 4;
    const roots = this.station === "arcade"
      ? [130.81, 164.81, 196, 146.83]
      : this.station === "cruise"
        ? [82.41, 73.42, 98, 65.41]
        : [110, 87.31, 130.81, 98];
    const root = roots[bar];

    // kick — always present
    if (step % 4 === 0) this.mVoice(120, t, 0.16, "sine", mellow ? 0.16 : 0.3, 48);
    // hats
    if (!mellow && step % 2 === 1) this.mNoise(t, 0.045, 0.07, 7000);
    // snare on backbeat
    if (!mellow && (step % 8 === 4)) this.mNoise(t, 0.14, 0.13, 1800);

    // danger pulse: strip to kick + a filtered low thump
    if (this.danger) {
      if (step % 2 === 0) this.mVoice(root * 0.5, t, 0.09, "sine", 0.12);
      return;
    }

    // bass from layer 1
    if (this.comboLayer >= 1 || mellow) {
      const pattern = [0, 0, 7, 0, 5, 0, 7, 3];
      const semi = pattern[step % 8];
      if (step % 2 === 0) {
        this.mVoice(root * Math.pow(2, semi / 12), t, mellow ? 0.42 : 0.17,
          mellow ? "sine" : "sawtooth", mellow ? 0.1 : 0.13);
      }
    }

    // lead arpeggio from layer 2
    if (this.comboLayer >= 2 && !mellow) {
      const arp = [12, 15, 19, 24, 19, 15];
      const semi = arp[step % arp.length];
      this.mVoice(root * Math.pow(2, semi / 12), t, 0.13, "square", 0.055);
    }

    // mellow pad shimmer
    if (mellow && step % 16 === 0) {
      this.mVoice(root * 4, t, 1.6, "triangle", 0.045);
      this.mVoice(root * 6, t, 1.6, "sine", 0.03);
    }
  }
}

export const sfx = new SFX();
