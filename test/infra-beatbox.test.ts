// Infra-beatbox: scale, rhythms and the timing of voices.
//
// Run: npm test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  C4, cyclePosition, hitTimes, phaseAt, pitchFrequency, pitchName, retunedPhase,
  rhythmFrequency, rhythmName, stepRatio,
} from '../src/infra-beatbox.ts';

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test('pitches are the C major scale from middle C', () => {
  close(pitchFrequency(0, 'equal'), 261.6255653, 1e-6);
  close(pitchFrequency(5, 'equal'), 440);                 // A4
  close(pitchFrequency(7, 'equal'), 2 * C4);              // C5
  close(pitchFrequency(14, 'equal'), 4 * C4);             // C6, the corner of a 15 × 15 grid
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map(pitchName),
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
  // of one beat takes about four and a half minutes.
  const slip = 1 / Math.abs(3 * rhythmFrequency(0, 'equal') - 2 * rhythmFrequency(4, 'equal'));
  assert.ok(slip > 250 && slip < 300, `${slip}`);
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
