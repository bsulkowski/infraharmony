// Infraharmony: the ready-made patterns keep the promises of their descriptions.
//
// Run: npm test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXAMPLES, EXAMPLE_GROUPS, proportion, randomPattern } from '../src/examples.ts';
import { cyclePosition, phaseFor, pitchFrequency, rhythmFrequency, stepRatio } from '../src/infraharmony.ts';

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

test('every example belongs to a group that the picker shows', () => {
  const ids = EXAMPLE_GROUPS.map(g => g.id);
  for (const e of EXAMPLES) assert.ok(ids.includes(e.group), e.id);
});

test('intervals run from consonant to dissonant: each takes at least as long to come round', () => {
  const intervals = EXAMPLES.filter(e => e.group === 'interval');
  assert.deepEqual(intervals.map(e => e.title.pl.replace(/^.* (\d+ : \d+)$/, '$1')),
    ['1 : 2', '2 : 3', '3 : 4', '3 : 5', '4 : 5', '5 : 6', '8 : 9', '15 : 16', '32 : 45']);
  const periods = intervals.map(e => commonPeriod(e.voices.map(v => v.rhythm)));
  for (let i = 1; i < periods.length; i++) assert.ok(periods[i] >= periods[i - 1] - 1e-9, intervals[i].id);
  assert.ok(Math.abs(periods.at(-1)! - 23.48) < 0.01);  // the tritone: as long as the whole scale
});

test('chords and their inversions have the ratios their titles give', () => {
  const ratio = (id: string) => proportion(byId(id).voices.map(v => v.rhythm)).join(' : ');
  assert.equal(ratio('chord'), '4 : 5 : 6');
  assert.equal(ratio('chord-rhythm-only'), '4 : 5 : 6');
  assert.equal(ratio('chord-minor'), '10 : 12 : 15');
  assert.equal(ratio('chord-first-inversion'), '5 : 6 : 8');
  assert.equal(ratio('chord-second-inversion'), '3 : 4 : 5');
  assert.ok(byId('chord-rhythm-only').voices.every(v => v.pitch === 0));
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

test('each canon comes back whole after as many periods of C as its description says', () => {
  const tC = 1 / rhythmFrequency(0, 'just');
  const promised: Record<string, number> = { canon: 2, 'canon-34': 3, 'canon-456': 4, 'canon-8910': 8, 'canon-augmentation': 1 };
  for (const [id, periods] of Object.entries(promised)) {
    const rhythms = [...new Set(byId(id).voices.map(v => v.rhythm))];
    assert.ok(Math.abs(commonPeriod(rhythms) - periods * tC) < 1e-9, id);
  }
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

test('random patterns are pentatonic in tone and rhythm, in the slower columns, and repeat with the same seed', () => {
  const seeded = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  for (const size of [8, 15] as const) {
    for (let s = 1; s <= 50; s++) {
      const p = randomPattern(size, seeded(s));
      assert.ok(p.length >= 4 && p.length <= (size === 8 ? 7 : 9));
      for (const v of p) {
        assert.ok([0, 1, 2, 4, 5].includes(v.pitch % 7) && v.pitch < size);
        assert.ok([0, 1, 2, 4, 5].includes(v.rhythm % 7) && v.rhythm < (size === 8 ? 6 : 10));
      }
      assert.deepEqual(p, randomPattern(size, seeded(s)));
    }
  }
});

test('Borderland examples keep the promises of their descriptions', () => {
  const tone = (s: number, t: 'just' | 'equal' = 'just') => pitchFrequency(s, t, 'border');
  const beat = (s: number, t: 'just' | 'equal' = 'just') => rhythmFrequency(s, t, 'border');
  for (const e of EXAMPLES.filter(x => x.group === 'border')) {
    assert.equal(e.layout, 'border', e.id);
    assert.equal(e.size, 15, e.id);
  }
  // The meeting: a tone and a rhythm of one frequency.
  const m = byId('border-meeting').voices[0];
  assert.ok(Math.abs(tone(m.pitch) - beat(m.rhythm)) < 1e-9);
  // Strikes into a tone: four voices evenly spread strike as often as the tone vibrates.
  const s = byId('border-strikes-into-tone').voices;
  assert.equal(s.length, 4);
  assert.ok(Math.abs(s.length * beat(s[0].rhythm) - tone(s[0].pitch)) < 1e-9);
  // Beating: in just tuning C1–D1 beats exactly at C−2, the strikes' own rhythm …
  const [a, b] = byId('border-beats').voices;
  assert.ok(Math.abs(Math.abs(tone(a.pitch) - tone(b.pitch)) - beat(a.rhythm)) < 1e-9);
  // … in equal tuning at 4.00 Hz, slipping against the strikes every 12 s.
  const d = Math.abs(tone(a.pitch, 'equal') - tone(b.pitch, 'equal'));
  assert.ok(Math.abs(d - 4.00) < 0.01, `${d}`);
  const slip = 1 / Math.abs(d - beat(a.rhythm, 'equal'));
  assert.ok(slip > 11.5 && slip < 12.5, `${slip}`);
  // The chord: tones 4 : 5 : 6 an equal 8.18 Hz apart, which is C−1, twice the strikes' C−2.
  const c = byId('border-chord').voices;
  const tones = c.map(v => tone(v.pitch)).sort((x, y) => x - y);
  assert.ok(Math.abs(tones[1] - tones[0] - beat(7)) < 1e-9 && Math.abs(tones[2] - tones[1] - beat(7)) < 1e-9);
  assert.ok(c.every(v => v.rhythm === 0) && Math.abs(beat(7) - 2 * beat(0)) < 1e-9);
  assert.ok(Math.abs(beat(7) - 8.18) < 0.01);
});
