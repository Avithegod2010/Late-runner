/* ================================================================
   Selectable Audio Sound Packs
   Three full sound-design profiles for the entire game, switched
   from Settings. Each pack re-voices the synth engine: waveforms,
   pitch ranges and noise character.
   ================================================================ */

export type SoundPackId = "neon" | "bit8" | "cyber" | "outrun";

export interface SoundPackDef {
  id: SoundPackId;
  name: string;
  detail: string;
  /** multiplier applied to blip frequencies */
  pitch: number;
  /** preferred oscillator for one-shots */
  osc: OscillatorType;
  /** preferred oscillator for the engine loop */
  engineOsc: OscillatorType;
  /** engine filter base */
  engineCut: number;
  /** noise brightness multiplier */
  noise: number;
  /** coin jingle transposition (semitones) */
  coinShift: number;
  /** music tempo multiplier */
  tempo: number;
}

export const SOUND_PACKS: SoundPackDef[] = [
  {
    id: "neon",
    name: "Neon Default",
    detail: "The house mix — warm synthwave blips and a filtered engine",
    pitch: 1, osc: "square", engineOsc: "sawtooth", engineCut: 1, noise: 1, coinShift: 0, tempo: 1,
  },
  {
    id: "bit8",
    name: "8-Bit Chiptune",
    detail: "Retro arcade blips, noise drums and a square-wave engine",
    pitch: 1.26, osc: "square", engineOsc: "square", engineCut: 0.7, noise: 1.35, coinShift: 5, tempo: 1.16,
  },
  {
    id: "cyber",
    name: "Cyberpunk 2099",
    detail: "Heavy distorted basslines and an industrial synth engine",
    pitch: 0.62, osc: "sawtooth", engineOsc: "sawtooth", engineCut: 1.6, noise: 0.8, coinShift: -7, tempo: 0.94,
  },
  {
    id: "outrun",
    name: "Outrun 80s",
    detail: "Analog FM warmth, gated snare and vintage horns",
    pitch: 0.9, osc: "triangle", engineOsc: "triangle", engineCut: 0.85, noise: 0.72, coinShift: 3, tempo: 0.9,
  },
];

export function packById(id: string | undefined): SoundPackDef {
  return SOUND_PACKS.find((p) => p.id === id) ?? SOUND_PACKS[0];
}
