// Infraharmony: tones on one scale, rhythms on the same scale eight octaves lower.
//
// A cell of the grid joins a pitch (rows) with a rhythm (columns). Both are steps of the
// C major scale counted from C: the pitch from middle C (C4 ≈ 262 Hz), the rhythm from
// the C eight octaves below it (C−4 ≈ 1.02 Hz). The rhythm is the scale carried on past the
// edge of hearing, into infrasound, where a frequency is heard as a pulse instead of a tone.
//
// A voice is one looped tone in a cell: it sounds once per period of its rhythm, at its own
// phase. Time is the audio clock's, in seconds. A phase is a fraction of a cycle: a voice of
// rhythm f and phase φ sounds at every t with t·f − φ a whole number.
//
// The Borderland is a second layout of the grid, for the region between the two worlds: its
// tones run down the scale from C2 (≈ 65 Hz) towards the lowest pitch an ear can hear, and its
// rhythms run up from C−2 (≈ 4 Hz) towards the fastest pulse it can still follow. The two scales
// go in opposite directions and meet at C0 ≈ 16 Hz, in the corner of the grid, where a tone and
// a rhythm are the same frequency.
//
// Pure functions with no DOM or audio access, so the same code runs in tests and in the browser.

// The version of the tool, shown discreetly under the grid; package.json's version goes with it.
// Codes of pieces (src/code.ts) have a version of their own, FORMAT_VERSION.
export const TOOL_VERSION = '1.1';

export type Tuning = 'equal' | 'just';

export const NOTE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

// Semitones above C of the C major steps (equal temperament), and their just ratios.
const SEMITONES = [0, 2, 4, 5, 7, 9, 11];
const JUST_RATIOS = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8];

export const A4 = 440;
export const C4 = A4 * 2 ** (-9 / 12);   // middle C, ≈ 261.63 Hz
export const PITCH_OCTAVE = 4;          // pitches start at C4
export const INFRA_OCTAVES = 8;         // rhythms start eight octaves below: C−4 ≈ 1.02 Hz

export const GRID_SIZES = [8, 15] as const;  // one octave with its closing C, or two
export type GridSize = (typeof GRID_SIZES)[number];

/** Which scales the axes carry: the infra grid of 8 or 15, or the Borderland (always 15 × 15). */
export type Layout = 'infra' | 'border';
export const BORDER_SIZE: GridSize = 15;

// For each layout and axis: the C that step 0 is, its octave in scientific pitch, and the way
// the steps go: up the scale (1) or down it (−1).
const AXES = {
  infra: {
    pitch: { base: C4, octave: PITCH_OCTAVE, way: 1 },
    rhythm: { base: C4 / 2 ** INFRA_OCTAVES, octave: PITCH_OCTAVE - INFRA_OCTAVES, way: 1 },
  },
  border: {
    pitch: { base: C4 / 4, octave: 2, way: -1 },   // C2, B1, A1 … C0
    rhythm: { base: C4 / 64, octave: -2, way: 1 },  // C−2, D−2, E−2 … C0
  },
} as const;

/** Frequency ratio of a scale step to the C it counts from. Step 7 is the next C, and so on. */
export function stepRatio(step: number, tuning: Tuning): number {
  const octave = Math.floor(step / 7);
  const degree = step - octave * 7;
  const within = tuning === 'just' ? JUST_RATIOS[degree] : 2 ** (SEMITONES[degree] / 12);
  return 2 ** octave * within;
}

/** Frequency of the tone in row `step`, in Hz. */
export function pitchFrequency(step: number, tuning: Tuning, layout: Layout = 'infra'): number {
  const a = axes(layout).pitch;
  return a.base * stepRatio(a.way * step, tuning);
}

/** Frequency of the rhythm in column `step`, in Hz: in the infra grid the same step, eight octaves lower. */
export function rhythmFrequency(step: number, tuning: Tuning, layout: Layout = 'infra'): number {
  const a = axes(layout).rhythm;
  return a.base * stepRatio(a.way * step, tuning);
}

/** Scientific pitch name of a step counted from C of `baseOctave`: 0 → C4, 7 → C5; −4 → C−4. */
export function stepName(step: number, baseOctave: number): string {
  const octave = baseOctave + Math.floor(step / 7);
  const name = NOTE_NAMES[step - Math.floor(step / 7) * 7];
  return `${name}${octave < 0 ? '−' + -octave : octave}`;
}

// A layout that is not one (an index, when these are passed straight to Array.map) means infra.
const axes = (layout: Layout) => AXES[layout] ?? AXES.infra;

export const pitchName = (step: number, layout: Layout = 'infra') =>
  stepName(axes(layout).pitch.way * step, axes(layout).pitch.octave);
export const rhythmName = (step: number, layout: Layout = 'infra') =>
  stepName(axes(layout).rhythm.way * step, axes(layout).rhythm.octave);

/**
 * Whether the tone of a cell is the same note as its rhythm, some octaves up: then the tone is
 * a whole number of its own periods long between two strikes, and every strike finds it in step.
 */
export function sameNote(pitch: number, rhythm: number, layout: Layout = 'infra'): boolean {
  const mod7 = (n: number) => ((n % 7) + 7) % 7;
  return mod7(axes(layout).pitch.way * pitch) === mod7(axes(layout).rhythm.way * rhythm);
}

export interface Voice {
  pitch: number;   // row: scale step from C4
  rhythm: number;  // column: scale step from C−4
  phase: number;   // fraction of a cycle, 0 ≤ phase < 1
}

const frac = (x: number) => x - Math.floor(x);

/** The phase of a voice of rhythm frequency `f` that sounds at time `t`. */
export function phaseAt(t: number, f: number): number {
  return frac(t * f);
}

/** The phase of a voice of rhythm frequency `f` that first sounds `offset` cycles after `start`. */
export function phaseFor(start: number, f: number, offset: number): number {
  return frac(start * f + offset);
}

/**
 * Where a voice is in its cycle at time `t`, as a fraction: 0 when it sounds, rising to 1
 * just before it sounds again. Divided by `f`, it is the time since it last sounded.
 */
export function cyclePosition(t: number, f: number, phase: number): number {
  return frac(t * f - phase);
}

/**
 * How far into its cycle after time `t` a voice next sounds, as a fraction: 0 if it sounds at
 * `t`. The inverse of phaseFor: a voice saved with this offset at `t` and loaded with it at
 * any other start keeps its place against every other voice saved at the same `t`.
 */
export function offsetAt(t: number, f: number, phase: number): number {
  return frac(-cyclePosition(t, f, phase));
}

/** The times in [from, to) at which a voice of rhythm frequency `f` and `phase` sounds. */
export function hitTimes(f: number, phase: number, from: number, to: number): number[] {
  const times: number[] = [];
  if (!(to > from)) return times;
  // t = (k + phase) / f for whole k.
  for (let k = Math.ceil(from * f - phase); ; k++) {
    const t = (k + phase) / f;
    // After rounding, t can fall a hair below `from`: then it belonged to the window before,
    // which computes the same t and keeps it, so skipping it here plays every hit once.
    if (t < from) continue;
    if (t >= to) break;
    times.push(t);
  }
  return times;
}

/**
 * The phase that keeps a voice at the same point of its cycle at time `t` when its rhythm
 * changes from `fOld` to `fNew` (a change of tuning), so it carries on without a jump.
 */
export function retunedPhase(phase: number, t: number, fOld: number, fNew: number): number {
  return frac(t * fNew - cyclePosition(t, fOld, phase));
}
