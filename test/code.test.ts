// Infraharmony: pieces written as codes, and back.
//
// Run: npm test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codeFromUrl, decodePiece, encodePiece, type Piece } from '../src/code.ts';
import { EXAMPLES } from '../src/examples.ts';
import { cyclePosition, offsetAt, phaseFor, rhythmFrequency } from '../src/infraharmony.ts';

test('the example in the format note reads as it says', () => {
  const piece: Piece = { size: 8, tuning: 'just', voices: [0, 2, 4].map((pitch, k) => ({ pitch, rhythm: 0, offset: k / 3 })) };
  assert.equal(encodePiece(piece), '1j8.AAAACAVVEAqr');
});

test('every example survives the trip through a code, offsets to 1/4096 of a cycle', () => {
  for (const e of EXAMPLES) {
    const piece: Piece = { size: e.size, tuning: e.tuning ?? 'equal', voices: e.voices };
    const code = encodePiece(piece);
    assert.match(code, /^[A-Za-z0-9._~-]+$/, 'only characters a plain #anchor may hold');
    const back = decodePiece(code)!;
    assert.equal(back.size, e.size);
    assert.equal(back.tuning, piece.tuning);
    assert.equal(back.voices.length, e.voices.length);
    back.voices.forEach((v, i) => {
      assert.equal(v.pitch, e.voices[i].pitch);
      assert.equal(v.rhythm, e.voices[i].rhythm);
      assert.ok(Math.abs(v.offset! - (e.voices[i].offset ?? 0)) <= 0.5 / 4096, e.id);
    });
    assert.equal(encodePiece(back), code);
  }
});

test('an offset just under a whole cycle wraps to 0', () => {
  const code = encodePiece({ size: 8, tuning: 'equal', voices: [{ pitch: 1, rhythm: 2, offset: 0.99999 }] });
  assert.equal(decodePiece(code)!.voices[0].offset, 0);
});

test('saving and loading keeps every voice in its place against the others', () => {
  // Voices playing since some time, saved at t = 100, loaded to start at t = 7.
  const phases = [{ r: 0, phase: 0.13 }, { r: 2, phase: 0.71 }, { r: 4, phase: 0.42 }];
  const f = (r: number) => rhythmFrequency(r, 'just');
  const saved = phases.map(({ r, phase }) => offsetAt(100, f(r), phase));
  const loaded = phases.map(({ r }, i) => phaseFor(7, f(r), saved[i]));
  // The time from any voice's hit to any other's is the same before and after.
  for (const dt of [0, 0.37, 5.5]) {
    const before = phases.map(({ r, phase }) => cyclePosition(100 + dt, f(r), phase));
    const after = phases.map(({ r }, i) => cyclePosition(7 + dt, f(r), loaded[i]));
    before.forEach((b, i) => assert.ok(Math.min(Math.abs(b - after[i]), 1 - Math.abs(b - after[i])) < 1e-9));
  }
});

test('broken codes are refused', () => {
  for (const bad of ['', '1j8', '2j8.', '1x8.', '1j9.', '1j8.AAA', '1j8.AAA*', '1j8.IAAA', '1jf.PAAA']) {
    assert.equal(decodePiece(bad), null, bad);
  }
  assert.deepEqual(decodePiece('1e8.'), { size: 8, tuning: 'equal', voices: [] });
  assert.ok(decodePiece(' 1j8.AAAA CAVV\n'));
});

test('a code is read from the fragment or the p parameter of a link', () => {
  assert.equal(codeFromUrl('https://bsulkowski.pl/infraharmony#1j8.AAAACAVV'), '1j8.AAAACAVV');
  assert.equal(codeFromUrl('https://bsulkowski.pl/infraharmony?p=1jf.OOAA'), '1jf.OOAA');
  assert.equal(codeFromUrl('https://bsulkowski.pl/infraharmony#intro'), null);
});

test('a Borderland piece is written with the grid letter b and read back as one', () => {
  const piece: Piece = { size: 15, tuning: 'just', layout: 'border', voices: [{ pitch: 14, rhythm: 14, offset: 0 }] };
  const code = encodePiece(piece);
  assert.equal(code, '1jb.OOAA');
  assert.deepEqual(decodePiece(code), piece);
  assert.equal(decodePiece('1jb.PAAA'), null);       // row 15 is off the grid
  assert.equal(decodePiece('1jf.OOAA')!.layout, undefined);  // older codes keep their meaning
});
