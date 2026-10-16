// Infra-beatbox: ready-made patterns, and a generator of random ones.
//
// A pattern lists voices by cell and by offset: the fraction of its own cycle after the
// common start at which a voice first sounds. Offset 0 everywhere means everyone starts
// together; offsets k/n spread n voices of one cell evenly over its period.

import type { GridSize, Tuning } from './infra-beatbox.ts';

export interface PatternVoice {
  pitch: number;    // row: scale step from C4
  rhythm: number;   // column: scale step from C−4
  offset?: number;  // fraction of its own cycle after the start, 0 if left out
}

export interface Example {
  id: string;
  title: { pl: string; en: string };
  description: { pl: string; en: string };
  size: GridSize;   // the smallest grid that holds it
  tuning?: Tuning;  // the tuning it is meant for; left out if it sounds the same in both
  voices: PatternVoice[];
}

const diagonal = (n: number): PatternVoice[] => Array.from({ length: n }, (_, s) => ({ pitch: s, rhythm: s }));

export const EXAMPLES: Example[] = [
  {
    id: 'heart',
    title: { pl: 'Serce', en: 'Heartbeat' },
    description: {
      pl: 'Dwa głosy C4 w jednej kratce, drugi tuż po pierwszym. Rytm C−4 to 61 uderzeń na minutę, tętno w spoczynku.',
      en: 'Two C4 voices in one cell, the second just after the first. Rhythm C−4 is 61 beats a minute, a resting pulse.',
    },
    size: 8,
    voices: [{ pitch: 0, rhythm: 0, offset: 0 }, { pitch: 0, rhythm: 0, offset: 0.2 }],
  },
  {
    id: 'arpeggio',
    title: { pl: 'Arpeggio w jednym rytmie', en: 'Arpeggio in one rhythm' },
    description: {
      pl: 'C, E, G i C wyżej w tej samej kolumnie, rozłożone co ćwierć okresu. Jeden rytm i cztery fazy dają melodię.',
      en: 'C, E, G and the C above in one column, a quarter of a period apart. One rhythm and four phases make a tune.',
    },
    size: 8,
    voices: [0, 2, 4, 7].map((pitch, i) => ({ pitch, rhythm: 0, offset: i / 4 })),
  },
  {
    id: 'chord',
    title: { pl: 'Akord jako polirytm', en: 'A chord as a polyrhythm' },
    description: {
      pl: 'C, E i G, każdy w rytmie swojej nuty: 4 : 5 : 6, jak w samym akordzie. Zbiegają się co cztery okresy C, prawie co 4 s.',
      en: 'C, E and G, each in the rhythm of its own note: 4 : 5 : 6, as in the chord itself. They meet every four periods of C, almost 4 s.',
    },
    size: 8,
    tuning: 'just',
    voices: [0, 2, 4].map(s => ({ pitch: s, rhythm: s })),
  },
  {
    id: 'fifth',
    title: { pl: 'Kwinta 2 : 3', en: 'Fifth, 2 : 3' },
    description: {
      pl: 'C i G w rytmach C i G: kwinta w dźwięku i ta sama kwinta w rytmie, trzy uderzenia na dwa. W stroju równomiernym wzór przesuwa się o jedno uderzenie w ciągu niecałych 5 minut.',
      en: 'C and G in the rhythms of C and G: a fifth in the tone and the same fifth in the rhythm, three beats against two. In equal tuning the pattern slips one beat in just under 5 minutes.',
    },
    size: 8,
    tuning: 'just',
    voices: [{ pitch: 0, rhythm: 0 }, { pitch: 4, rhythm: 4 }],
  },
  {
    id: 'third',
    title: { pl: 'Tercja, która płynie', en: 'A drifting third' },
    description: {
      pl: 'C i E w rytmach C i E, w stroju równomiernym. Ta tercja jest szersza od czystego 4 : 5, więc uderzenia rozjeżdżają się i schodzą znowu co 25 s. Przełącz na strój naturalny, a wzór zastygnie.',
      en: 'C and E in the rhythms of C and E, in equal tuning. Its third is wider than a pure 4 : 5, so the beats slide apart and meet again every 25 s. Switch to just tuning and the pattern stands still.',
    },
    size: 8,
    tuning: 'equal',
    voices: [{ pitch: 0, rhythm: 0 }, { pitch: 2, rhythm: 2 }],
  },
  {
    id: 'canon',
    title: { pl: 'Kanon w proporcji 2 : 3', en: 'Canon in proportion 2 : 3' },
    description: {
      pl: 'Ta sama melodia C–E–G w dwóch tempach: w rytmie C i półtora raza szybciej, w rytmie G. Tak jak w kanonach menzuralnych, głosy schodzą się co dwa okresy C.',
      en: 'One tune, C–E–G, at two speeds: in the rhythm of C and half as fast again, in the rhythm of G. As in a mensuration canon, the voices meet every two periods of C.',
    },
    size: 8,
    tuning: 'just',
    voices: [0, 4].flatMap(rhythm => [0, 2, 4].map((pitch, i) => ({ pitch, rhythm, offset: i / 3 }))),
  },
  {
    id: 'pendulums',
    title: { pl: 'Fala wahadeł', en: 'Pendulum wave' },
    description: {
      pl: 'Cała gama na przekątnej, każdy dźwięk w rytmie swojej nuty, startują razem. Rozchodzą się w fale i akordy, a po 23,5 s znów uderzają wszystkie naraz.',
      en: 'The whole scale on the diagonal, each note in the rhythm of its own, all starting together. They spread into waves and chords, and after 23.5 s strike all at once again.',
    },
    size: 8,
    tuning: 'just',
    voices: diagonal(8),
  },
  {
    id: 'pendulums-15',
    title: { pl: 'Fala wahadeł, dwie oktawy', en: 'Pendulum wave, two octaves' },
    description: {
      pl: 'Piętnaście wahadeł zamiast ośmiu. Wysokie dźwięki biją do czterech razy na sekundę, a wspólny okres zostaje ten sam: 23,5 s.',
      en: 'Fifteen pendulums instead of eight. The high notes beat up to four times a second, and the common period stays the same: 23.5 s.',
    },
    size: 15,
    tuning: 'just',
    voices: diagonal(15),
  },
  {
    id: 'octaves',
    title: { pl: 'Oktawy rytmu', en: 'Octaves of rhythm' },
    description: {
      pl: 'C4, C5 i C6, każde w rytmie swojego C: oktawę wyżej i dwa razy szybciej. Oktawa w dźwięku i oktawa w czasie to ta sama proporcja 1 : 2.',
      en: 'C4, C5 and C6, each in the rhythm of its own C: an octave up and twice as fast. An octave in pitch and an octave in time are the same 1 : 2.',
    },
    size: 15,
    voices: [0, 7, 14].map(s => ({ pitch: s, rhythm: s })),
  },
];

// Steps of the major pentatonic, C D E G A: random notes from it rarely clash.
const PENTATONIC = [0, 1, 2, 4, 5];
const OFFSETS = [0, 0, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4];

/**
 * A random pattern for a grid of `size`: a few voices on pentatonic notes, in rhythms from
 * the slower half of the grid, at simple fractions of their cycles. `random` returns
 * numbers in [0, 1), as Math.random does.
 */
export function randomPattern(size: GridSize, random: () => number = Math.random): PatternVoice[] {
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(random() * xs.length)];
  const pitches = Array.from({ length: size }, (_, s) => s).filter(s => PENTATONIC.includes(s % 7));
  const slow = Math.ceil(size / 2) + 1;   // 5 of 8 columns, 9 of 15
  const count = 4 + Math.floor(random() * (size === 8 ? 4 : 6));
  const voices: PatternVoice[] = [];
  const seen = new Set<string>();
  while (voices.length < count) {
    const v = { pitch: pick(pitches), rhythm: Math.floor(random() * slow), offset: pick(OFFSETS) };
    const k = `${v.pitch}:${v.rhythm}:${v.offset}`;
    if (seen.has(k)) continue;
    seen.add(k);
    voices.push(v);
  }
  return voices;
}
