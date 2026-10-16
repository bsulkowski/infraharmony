// Infra-beatbox: tones on one scale, rhythms on the same scale eight octaves lower.
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
// Pure functions with no DOM or audio access, so the same code runs in tests and in the browser.

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

/** Frequency ratio of a scale step to the C it counts from. Step 7 is the next C, and so on. */
export function stepRatio(step: number, tuning: Tuning): number {
  const octave = Math.floor(step / 7);
  const degree = step - octave * 7;
  const within = tuning === 'just' ? JUST_RATIOS[degree] : 2 ** (SEMITONES[degree] / 12);
  return 2 ** octave * within;
}

/** Frequency of the tone in row `step`, in Hz. */
export function pitchFrequency(step: number, tuning: Tuning): number {
  return C4 * stepRatio(step, tuning);
}

/** Frequency of the rhythm in column `step`, in Hz: the same step, eight octaves lower. */
export function rhythmFrequency(step: number, tuning: Tuning): number {
  return (C4 / 2 ** INFRA_OCTAVES) * stepRatio(step, tuning);
}

/** Scientific pitch name of a step counted from C of `baseOctave`: 0 → C4, 7 → C5; −4 → C−4. */
export function stepName(step: number, baseOctave: number): string {
  const octave = baseOctave + Math.floor(step / 7);
  const name = NOTE_NAMES[step - Math.floor(step / 7) * 7];
  return `${name}${octave < 0 ? '−' + -octave : octave}`;
}

export const pitchName = (step: number) => stepName(step, PITCH_OCTAVE);
export const rhythmName = (step: number) => stepName(step, PITCH_OCTAVE - INFRA_OCTAVES);

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

/**
 * Where a voice is in its cycle at time `t`, as a fraction: 0 when it sounds, rising to 1
 * just before it sounds again. Divided by `f`, it is the time since it last sounded.
 */
export function cyclePosition(t: number, f: number, phase: number): number {
  return frac(t * f - phase);
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
