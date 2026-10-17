// Infraharmony: scale, rhythms and the timing of voices.
//
// Run: npm test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  C4, cyclePosition, hitTimes, phaseAt, pitchFrequency, pitchName, retunedPhase,
  rhythmFrequency, rhythmName, sameNote, stepRatio,
} from '../src/infraharmony.ts';

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test('pitches are the C major scale from middle C', () => {
  close(pitchFrequency(0, 'equal'), 261.6255653, 1e-6);
  close(pitchFrequency(5, 'equal'), 440);                 // A4
  close(pitchFrequency(7, 'equal'), 2 * C4);              // C5
  close(pitchFrequency(14, 'equal'), 4 * C4);             // C6, the corner of a 15 × 15 grid
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map(s => pitchName(s)),
    ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']);
});

test('rhythms are the same scale eight octaves lower, around 1 Hz', () => {
  for (let s = 0; s < 15; s++) {
    close(pitchFrequency(s, 'equal') / rhythmFrequency(s, 'equal'), 256);
    close(pitchFrequency(s, 'just') / rhythmFrequency(s, 'just'), 256);
  }
  close(rhythmFrequency(0, 'equal'), 1.0219748, 1e-6);
  close(rhythmFrequency(7, 'equal'), 2.0439497, 1e-6);
  assert.equal(rhythmName(0), 'C−4');
  assert.equal(rhythmName(7), 'C−3');
});

test('just intonation makes rhythms whole-number ratios: polyrhythms that repeat exactly', () => {
  close(stepRatio(4, 'just'), 3 / 2);  // C : G = 2 : 3
  close(stepRatio(2, 'just'), 5 / 4);  // C : E = 4 : 5
  // In equal temperament G is a hair flat of 3/2, so C against G drifts: a full slip
  // of one beat takes just under five minutes.
  const slip = 1 / Math.abs(3 * rhythmFrequency(0, 'equal') - 2 * rhythmFrequency(4, 'equal'));
  assert.ok(slip > 280 && slip < 300, `${slip}`);
});

test('a voice sounds at the moment its phase was taken, then once per period', () => {
  const f = rhythmFrequency(3, 'equal');
  const t0 = 12.345;
  const phase = phaseAt(t0, f);
  const hits = hitTimes(f, phase, t0, t0 + 5 / f + 1e-6);
  assert.equal(hits.length, 6);
  close(hits[0], t0, 1e-9);
  hits.forEach((t, i) => close(t, t0 + i / f, 1e-9));
  close(cyclePosition(t0, f, phase), 0, 1e-9);
  close(cyclePosition(t0 + 0.5 / f, f, phase), 0.5, 1e-9);
});

test('windows laid end to end play every hit exactly once', () => {
  for (const f of [rhythmFrequency(0, 'equal'), rhythmFrequency(6, 'just'), rhythmFrequency(14, 'equal')]) {
    const phase = phaseAt(3.3, f);
    const all: number[] = [];
    let t = 0;
    while (t < 600) {           // ten minutes in ticks of 25 ms, edges falling anywhere
      const next = t + 0.025;
      all.push(...hitTimes(f, phase, t, next));
      t = next;
    }
    const expected = hitTimes(f, phase, 0, t);
    assert.equal(all.length, expected.length);
    for (let i = 1; i < all.length; i++) close(all[i] - all[i - 1], 1 / f, 1e-6);
  }
});

test('an empty or reversed window has no hits', () => {
  assert.deepEqual(hitTimes(1, 0, 2, 2), []);
  assert.deepEqual(hitTimes(1, 0, 3, 2), []);
});

test('a change of tuning keeps each voice at the same point of its cycle', () => {
  const t = 47.2;
  const fOld = rhythmFrequency(5, 'equal');
  const fNew = rhythmFrequency(5, 'just');
  const phase = 0.37;
  const p = retunedPhase(phase, t, fOld, fNew);
  close(cyclePosition(t, fNew, p), cyclePosition(t, fOld, phase), 1e-9);
});

test('in the Borderland tones run down from C2 and rhythms up from C−2, meeting at C0', () => {
  const tone = (s: number) => pitchFrequency(s, 'just', 'border');
  const beat = (s: number) => rhythmFrequency(s, 'just', 'border');
  close(tone(0), C4 / 4);           // C2 ≈ 65 Hz
  close(beat(0), C4 / 64);          // C−2 ≈ 4.1 Hz
  close(tone(14), beat(14));        // the corner: C0 ≈ 16.35 Hz both ways
  close(tone(14), C4 / 16);
  for (let s = 1; s < 15; s++) {
    assert.ok(tone(s) < tone(s - 1), 'tones go down');
    assert.ok(beat(s) > beat(s - 1), 'rhythms go up');
  }
  assert.deepEqual([0, 1, 7, 14].map(s => pitchName(s, 'border')), ['C2', 'B1', 'C1', 'C0']);
  assert.deepEqual([0, 1, 7, 14].map(s => rhythmName(s, 'border')), ['C−2', 'D−2', 'C−1', 'C0']);
  // A name mapped straight over an array still reads as the infra grid.
  assert.deepEqual([0, 1].map(s => pitchName(s)), ['C4', 'D4']);
  // Even passed straight to map, where the second argument is an index, it reads as infra.
  assert.deepEqual([0, 1].map(pitchName as (s: number) => string), ['C4', 'D4']);
});

test('a cell is the same note as its rhythm when they are octaves apart', () => {
  assert.ok(sameNote(0, 0) && sameNote(0, 7) && sameNote(9, 2) && !sameNote(0, 1));
  assert.ok(sameNote(14, 14, 'border') && sameNote(0, 14, 'border') && sameNote(3, 11, 'border'));
  assert.ok(!sameNote(6, 0, 'border'));
  for (let p = 0; p < 15; p++) for (let r = 0; r < 15; r++) {
    const ratio = Math.log2(pitchFrequency(p, 'just', 'border') / rhythmFrequency(r, 'just', 'border'));
    assert.equal(sameNote(p, r, 'border'), Math.abs(ratio - Math.round(ratio)) < 1e-9, `${p},${r}`);
  }
});
