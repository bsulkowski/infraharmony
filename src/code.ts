// Infraharmony: a piece written as a short code, to put in a link or send in a message.
//
// A piece is the grid size, the tuning and the voices, each voice with its offset: the
// fraction of its own cycle after the piece's start at which it first sounds. Offsets
// measured from one moment keep every voice in its place against the others, and that is
// all a piece is: played from any other start, it is the same music shifted in time.
//
// Format, version 1: `1` · tuning (`e` equal, `j` just) · size (`8`, or `f` for 15) · `.` ·
// four characters per voice: pitch, rhythm, and the offset in two digits, all in base 64
// (A–Z a–z 0–9 - _). The offset is kept to 1/4096 of a cycle, a quarter of a millisecond
// at the slowest rhythm. Every character is safe in a URL, in its path, query or fragment.
//
//   1j8.AAAACAVVEAqr    just tuning, 8 × 8: C4, E4, G4 in rhythm C−4 at 0, 1/3, 2/3 of a cycle

import { GRID_SIZES, type GridSize, type Tuning } from './infraharmony.ts';
import type { PatternVoice } from './examples.ts';

export interface Piece {
  size: GridSize;
  tuning: Tuning;
  voices: PatternVoice[];
}

const DIGITS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
/** The version of the code format, its first character. A code once valid keeps its meaning. */
export const FORMAT_VERSION = 1;
const VERSION = String(FORMAT_VERSION);
const STEPS = 64 * 64;  // offset resolution

export function encodePiece(piece: Piece): string {
  let out = VERSION + (piece.tuning === 'just' ? 'j' : 'e') + (piece.size === 15 ? 'f' : '8') + '.';
  for (const v of piece.voices) {
    const q = Math.round((v.offset ?? 0) * STEPS) % STEPS;
    out += DIGITS[v.pitch] + DIGITS[v.rhythm] + DIGITS[q >> 6] + DIGITS[q & 63];
  }
  return out;
}

/** The piece a code stands for, or null if it is not a valid code. Spaces are ignored. */
export function decodePiece(code: string): Piece | null {
  const s = code.replace(/\s+/g, '');
  const m = /^1([ej])([8f])\.([A-Za-z0-9_-]*)$/.exec(s);
  if (!m || m[3].length % 4 !== 0) return null;
  const tuning: Tuning = m[1] === 'j' ? 'just' : 'equal';
  const size: GridSize = m[2] === 'f' ? 15 : 8;
  if (!GRID_SIZES.includes(size)) return null;
  const voices: PatternVoice[] = [];
  for (let i = 0; i < m[3].length; i += 4) {
    const [p, r, hi, lo] = [...m[3].slice(i, i + 4)].map(c => DIGITS.indexOf(c));
    if (p >= size || r >= size) return null;
    voices.push({ pitch: p, rhythm: r, offset: (hi * 64 + lo) / STEPS });
  }
  return { size, tuning, voices };
}

/** A code found in a page address: the fragment (#…), or the `p` parameter of the query. */
export function codeFromUrl(url: string): string | null {
  const u = new URL(url);
  const hash = u.hash.slice(1);
  if (hash && decodePiece(hash)) return hash;
  const p = u.searchParams.get('p');
  return p && decodePiece(p) ? p : null;
}
