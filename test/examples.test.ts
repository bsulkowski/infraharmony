// Infra-beatbox: the ready-made patterns keep the promises of their descriptions.
//
// Run: npm test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXAMPLES, randomPattern } from '../src/examples.ts';
import { cyclePosition, phaseFor, rhythmFrequency, stepRatio } from '../src/infra-beatbox.ts';

const byId = (id: string) => EXAMPLES.find(e => e.id === id)!;

/** Seconds until every voice of a just-tuned pattern starting together sounds at once again. */
function commonPeriod(rhythms: number[]): number {
  // Just ratios are fractions over 24: C D E F G A B C = 24 27 30 32 36 40 45 48 (/ 24).
  const ints = rhythms.map(r => Math.round(stepRatio(r, 'just') * 24));
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const g = ints.reduce(gcd);
  return 24 / g / rhythmFrequency(0, 'equal');
}

test('every example fits its grid, with ids unique and offsets within a cycle', () => {
  assert.equal(new Set(EXAMPLES.map(e => e.id)).size, EXAMPLES.length);
  for (const e of EXAMPLES) {
    assert.ok(e.voices.length > 0, e.id);
    for (const v of e.voices) {
      assert.ok(v.pitch >= 0 && v.pitch < e.size && v.rhythm >= 0 && v.rhythm < e.size, e.id);
      assert.ok((v.offset ?? 0) >= 0 && (v.offset ?? 0) < 1, e.id);
    }
  }
});

test('a voice loaded with an offset first sounds that far into its cycle', () => {
  const f = rhythmFrequency(4, 'just');
  const start = 7.31;
  for (const offset of [0, 0.2, 0.75]) {
    const phase = phaseFor(start, f, offset);
    assert.ok(Math.abs(cyclePosition(start + offset / f, f, phase)) < 1e-9 ||
      Math.abs(cyclePosition(start + offset / f, f, phase) - 1) < 1e-9);
  }
});

test('the heartbeat is a resting pulse', () => {
  const bpm = 60 * rhythmFrequency(byId('heart').voices[0].rhythm, 'equal');
  assert.ok(bpm > 60 && bpm < 62, `${bpm}`);
});

test('the chord meets every four periods of C, the canon every two', () => {
  const tC = 1 / rhythmFrequency(0, 'just');
  assert.ok(Math.abs(commonPeriod([0, 2, 4]) - 4 * tC) < 1e-9);
  assert.ok(Math.abs(commonPeriod([0, 4]) - 2 * tC) < 1e-9);
});

test('both pendulum waves come back together after 23.5 s', () => {
  for (const id of ['pendulums', 'pendulums-15']) {
    const p = commonPeriod(byId(id).voices.map(v => v.rhythm));
    assert.ok(Math.abs(p - 23.48) < 0.01, `${id}: ${p}`);
  }
});

test('in equal tuning the third slips a beat every 25 s, the fifth just under 5 minutes', () => {
  const f = (s: number) => rhythmFrequency(s, 'equal');
  const third = 1 / Math.abs(4 * f(2) - 5 * f(0));
  const fifth = 1 / Math.abs(3 * f(0) - 2 * f(4));
  assert.ok(third > 24 && third < 25.5, `${third}`);
  assert.ok(fifth > 280 && fifth < 300, `${fifth}`);
});

test('random patterns are pentatonic, in the slower columns, and repeat with the same seed', () => {
  const seeded = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  for (const size of [8, 15] as const) {
    for (let s = 1; s <= 50; s++) {
      const p = randomPattern(size, seeded(s));
      assert.ok(p.length >= 4 && p.length <= (size === 8 ? 7 : 9));
      for (const v of p) {
        assert.ok([0, 1, 2, 4, 5].includes(v.pitch % 7) && v.pitch < size);
        assert.ok(v.rhythm < Math.ceil(size / 2) + 1);
      }
      assert.deepEqual(p, randomPattern(size, seeded(s)));
    }
  }
});
