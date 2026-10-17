// Infraharmony: ready-made patterns, and a generator of random ones.
//
// A pattern lists voices by cell and by offset: the fraction of its own cycle after the
// common start at which a voice first sounds. Offset 0 everywhere means everyone starts
// together; offsets k/n spread n voices of one cell evenly over its period.

import { rhythmFrequency, stepRatio, type GridSize, type Layout, type Tuning } from './infraharmony.ts';

export interface PatternVoice {
  pitch: number;    // row: scale step from C4
  rhythm: number;   // column: scale step from C−4
  offset?: number;  // fraction of its own cycle after the start, 0 if left out
}

export type ExampleGroup = 'interval' | 'chord' | 'canon' | 'other' | 'border';

export const EXAMPLE_GROUPS: { id: ExampleGroup; pl: string; en: string }[] = [
  { id: 'interval', pl: 'Interwały', en: 'Intervals' },
  { id: 'chord', pl: 'Akordy', en: 'Chords' },
  { id: 'canon', pl: 'Kanony', en: 'Canons' },
  { id: 'other', pl: 'Inne', en: 'More' },
  { id: 'border', pl: 'Pogranicze', en: 'Borderland' },
];

export interface Example {
  id: string;
  group: ExampleGroup;
  title: { pl: string; en: string };
  description: { pl: string; en: string };
  size: GridSize;   // the smallest grid that holds it
  tuning?: Tuning;  // the tuning it is meant for; left out if it sounds the same in both
  layout?: Layout;  // 'infra' if left out; the Borderland is always 15 × 15
  voices: PatternVoice[];
}

const diagonal = (n: number): PatternVoice[] => Array.from({ length: n }, (_, s) => ({ pitch: s, rhythm: s }));

/**
 * One tune played in several columns at once: its notes spread evenly over a period, and
 * the same notes, shifted by `transpose[i]` steps, in each rhythm of `rhythms`.
 * A rhythm is a tempo, so this is a mensuration canon: one melody at several speeds.
 */
const canon = (tune: number[], rhythms: number[], transpose: number[] = rhythms.map(() => 0)): PatternVoice[] =>
  rhythms.flatMap((rhythm, i) => tune.map((pitch, k) => ({ pitch: pitch + transpose[i], rhythm, offset: k / tune.length })));

/** Just ratios as whole numbers: C D E F G A B C = 24 27 30 32 36 40 45 48, and so on up. */
const whole = (step: number) => Math.round(stepRatio(step, 'just') * 24);
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/**
 * Seconds after which voices in these rhythms, started together in just tuning, all sound
 * together again: the length of one full turn of the pattern.
 */
export function commonPeriod(rhythms: number[]): number {
  const g = rhythms.map(whole).reduce(gcd);
  return 24 / g / rhythmFrequency(0, 'just');
}

/** The rhythms of a just-tuned pattern as the smallest whole numbers: [0, 2, 4] → [4, 5, 6]. */
export function proportion(rhythms: number[]): number[] {
  const ints = rhythms.map(whole);
  const g = ints.reduce(gcd);
  return ints.map(n => n / g);
}

const seconds = (s: number, lang: 'pl' | 'en') => {
  const x = s < 10 ? s.toFixed(1) : s.toFixed(0);
  return lang === 'pl' ? x.replace('.', ',') : x;
};
const periodsPl = (n: number) =>
  n === 1 ? 'okres' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'okresy' : 'okresów';

// The intervals of C major, from the most consonant to the most dissonant: two voices, each in
// the rhythm of its own note, so the interval sounds in pitch and repeats in time at once.
// The simpler the ratio, the sooner the two meet again.
const INTERVALS: { id: string; pl: string; en: string; low: number; high: number }[] = [
  { id: 'octave', pl: 'Oktawa', en: 'Octave', low: 0, high: 7 },
  { id: 'fifth', pl: 'Kwinta', en: 'Fifth', low: 0, high: 4 },
  { id: 'fourth', pl: 'Kwarta', en: 'Fourth', low: 0, high: 3 },
  { id: 'major-sixth', pl: 'Seksta wielka', en: 'Major sixth', low: 0, high: 5 },
  { id: 'major-third', pl: 'Tercja wielka', en: 'Major third', low: 0, high: 2 },
  { id: 'minor-third', pl: 'Tercja mała', en: 'Minor third', low: 2, high: 4 },
  { id: 'major-second', pl: 'Sekunda wielka', en: 'Major second', low: 0, high: 1 },
  { id: 'minor-second', pl: 'Sekunda mała', en: 'Minor second', low: 2, high: 3 },
  { id: 'tritone', pl: 'Tryton', en: 'Tritone', low: 3, high: 6 },
];

// Polish names the seventh step H.
const NOTES = { pl: ['C', 'D', 'E', 'F', 'G', 'A', 'H'], en: ['C', 'D', 'E', 'F', 'G', 'A', 'B'] };
const note = (step: number, lang: 'pl' | 'en') => NOTES[lang][step % 7] + (4 + Math.floor(step / 7));
const beatsPl = (n: number) =>
  n === 1 ? 'uderzenie' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'uderzenia' : 'uderzeń';

function intervalExample(i: (typeof INTERVALS)[number]): Example {
  const [p, q] = proportion([i.low, i.high]);
  const t = commonPeriod([i.low, i.high]);
  const name = (lang: 'pl' | 'en') => NOTES[lang][i.low % 7];
  const meetPl = p === 1 ? `przy każdym uderzeniu ${name('pl')}` : `co ${p} ${periodsPl(p)} ${name('pl')}`;
  const meetEn = p === 1 ? `on every beat of ${name('en')}` : `every ${p} periods of ${name('en')}`;
  return {
    id: i.id,
    group: 'interval',
    title: { pl: `${i.pl} ${p} : ${q}`, en: `${i.en} ${p} : ${q}` },
    description: {
      pl: `${note(i.low, 'pl')} i ${note(i.high, 'pl')}, każdy w rytmie swojej nuty: ${p} ${beatsPl(p)} na ${q}. ` +
        `Schodzą się ${meetPl}, co ${seconds(t, 'pl')} s. Im prostsza proporcja, tym częściej głosy się spotykają.`,
      en: `${note(i.low, 'en')} and ${note(i.high, 'en')}, each in the rhythm of its own note: ${p} beats against ${q}. ` +
        `They meet ${meetEn}, ${seconds(t, 'en')} s. The simpler the ratio, the more often the voices meet.`,
    },
    size: 8,
    tuning: 'just',
    voices: [{ pitch: i.low, rhythm: i.low }, { pitch: i.high, rhythm: i.high }],
  };
}

export const EXAMPLES: Example[] = [
  ...INTERVALS.map(intervalExample),
  {
    id: 'heart',
    group: 'other',
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
    group: 'other',
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
    group: 'chord',
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
    id: 'chord-rhythm-only',
    group: 'chord',
    title: { pl: 'Sam rytm akordu', en: 'Just the rhythm of a chord' },
    description: {
      pl: 'Rytmy C, E i G, czyli 4 : 5 : 6, ale wszystkie na jednym dźwięku C4. Bez wysokości zostaje akord C-dur słyszany wyłącznie w czasie.',
      en: 'The rhythms of C, E and G, 4 : 5 : 6, all on one tone, C4. With pitch taken away, the C major chord is left to be heard in time alone.',
    },
    size: 8,
    tuning: 'just',
    voices: [0, 2, 4].map(r => ({ pitch: 0, rhythm: r })),
  },
  {
    id: 'chord-minor',
    group: 'chord',
    title: { pl: 'Akord e-moll 10 : 12 : 15', en: 'E minor chord 10 : 12 : 15' },
    description: {
      pl: 'E, G i H w rytmach swoich nut. Molowy akord ma większe liczby niż durowy 4 : 5 : 6, więc głosy schodzą się rzadziej, co dziesięć okresów E, prawie co 8 s.',
      en: 'E, G and B in the rhythms of their own notes. A minor chord has larger numbers than the major 4 : 5 : 6, so the voices meet less often, every ten periods of E, almost 8 s.',
    },
    size: 8,
    tuning: 'just',
    voices: [2, 4, 6].map(s => ({ pitch: s, rhythm: s })),
  },
  {
    id: 'chord-first-inversion',
    group: 'chord',
    title: { pl: 'C-dur w pierwszym przewrocie 5 : 6 : 8', en: 'C major, first inversion 5 : 6 : 8' },
    description: {
      pl: 'E, G i C wyżej: ten sam akord C-dur z E na dole. Proporcja zmienia się na 5 : 6 : 8, a głosy schodzą się co pięć okresów E, prawie co 4 s.',
      en: 'E, G and the C above: the same C major chord with E at the bottom. The ratio becomes 5 : 6 : 8, and the voices meet every five periods of E, almost 4 s.',
    },
    size: 8,
    tuning: 'just',
    voices: [2, 4, 7].map(s => ({ pitch: s, rhythm: s })),
  },
  {
    id: 'chord-second-inversion',
    group: 'chord',
    title: { pl: 'C-dur w drugim przewrocie 3 : 4 : 5', en: 'C major, second inversion 3 : 4 : 5' },
    description: {
      pl: 'G, C i E wyżej: akord C-dur z G na dole. Wychodzi 3 : 4 : 5, najprostszy polirytm na trzy głosy, który schodzi się co trzy okresy G, prawie co 2 s.',
      en: 'G, C and E above: the C major chord with G at the bottom. It comes to 3 : 4 : 5, the simplest polyrhythm in three voices, meeting every three periods of G, almost 2 s.',
    },
    size: 15,
    tuning: 'just',
    voices: [4, 7, 9].map(s => ({ pitch: s, rhythm: s })),
  },
  {
    id: 'third',
    group: 'other',
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
    group: 'canon',
    title: { pl: 'Kanon w proporcji 2 : 3', en: 'Canon in proportion 2 : 3' },
    description: {
      pl: 'Ta sama melodia C–E–G w dwóch tempach: w rytmie C i półtora raza szybciej, w rytmie G. Tak jak w kanonach menzuralnych, głosy schodzą się co dwa okresy C.',
      en: 'One tune, C–E–G, at two speeds: in the rhythm of C and half as fast again, in the rhythm of G. As in a mensuration canon, the voices meet every two periods of C.',
    },
    size: 8,
    tuning: 'just',
    voices: canon([0, 2, 4], [0, 4]),
  },
  {
    id: 'canon-34',
    group: 'canon',
    title: { pl: 'Kanon 3 : 4', en: 'Canon 3 : 4' },
    description: {
      pl: 'Melodia C–E–G–C w rytmie C i w rytmie F, o jedną trzecią szybciej. Kwarta w tempie: głosy schodzą się co trzy okresy C, prawie co 3 s.',
      en: 'The tune C–E–G–C in the rhythm of C and in the rhythm of F, a third faster. A fourth in tempo: the voices meet every three periods of C, almost 3 s.',
    },
    size: 8,
    tuning: 'just',
    voices: canon([0, 2, 4, 7], [0, 3]),
  },
  {
    id: 'canon-456',
    group: 'canon',
    title: { pl: 'Kanon na trzy tempa', en: 'Canon at three speeds' },
    description: {
      pl: 'Melodia C–D–E–G naraz w rytmach C, E i G, czyli w tempach 4 : 5 : 6, tych samych co akord C-dur. Głosy rozchodzą się w gęstą fakturę i zbiegają co cztery okresy C.',
      en: 'The tune C–D–E–G at once in the rhythms of C, E and G, at speeds 4 : 5 : 6, the same as a C major chord. The voices spread into a thick texture and meet every four periods of C.',
    },
    size: 8,
    tuning: 'just',
    voices: canon([0, 1, 2, 4], [0, 2, 4]),
  },
  {
    id: 'canon-8910',
    group: 'canon',
    title: { pl: 'Kanon 8 : 9 : 10', en: 'Canon 8 : 9 : 10' },
    description: {
      pl: 'Pentatonika C–D–E–G–A w rytmach C, D i E. Tempa są bliskie, więc trzy głosy długo się mijają, zanim zejdą się znowu, po ośmiu okresach C, prawie 8 s.',
      en: 'The pentatonic C–D–E–G–A in the rhythms of C, D and E. The speeds are close, so the three voices pass each other for a long time before they meet again, after eight periods of C, almost 8 s.',
    },
    size: 8,
    tuning: 'just',
    voices: canon([0, 1, 2, 4, 5], [0, 1, 2]),
  },
  {
    id: 'canon-augmentation',
    group: 'canon',
    title: { pl: 'Kanon w augmentacji', en: 'Canon in augmentation' },
    description: {
      pl: 'Melodia C–E–G–A w rytmie C−4 i ta sama oktawę wyżej, w rytmie C−3: wyższy głos gra ją dwa razy, zanim niższy zagra raz. Oktawa w dźwięku idzie w parze z oktawą w tempie.',
      en: 'The tune C–E–G–A in rhythm C−4, and the same an octave up in rhythm C−3: the upper voice plays it twice while the lower plays it once. An octave in pitch goes with an octave in tempo.',
    },
    size: 15,
    voices: canon([0, 2, 4, 5], [0, 7], [0, 7]),
  },
  {
    id: 'pendulums',
    group: 'other',
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
    group: 'other',
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
    group: 'other',
    title: { pl: 'Oktawy rytmu', en: 'Octaves of rhythm' },
    description: {
      pl: 'C4, C5 i C6, każde w rytmie swojego C: oktawę wyżej i dwa razy szybciej. Oktawa w dźwięku i oktawa w czasie to ta sama proporcja 1 : 2.',
      en: 'C4, C5 and C6, each in the rhythm of its own C: an octave up and twice as fast. An octave in pitch and an octave in time are the same 1 : 2.',
    },
    size: 15,
    voices: [0, 7, 14].map(s => ({ pitch: s, rhythm: s })),
  },
  // The Borderland: tones from C2 (row 0) down to C0 (row 14), rhythms from C−2 (column 0) up
  // to C0 (column 14). C1 is row 7, D1 row 6, E1 row 5, G1 row 3; C−1 is column 7, E−1 9, G−1 11.
  {
    id: 'border-meeting',
    group: 'border',
    title: { pl: 'Spotkanie', en: 'The meeting' },
    description: {
      pl: 'Ton C0, 16 drgań na sekundę, uderzany 16 razy na sekundę: dźwięk i rytm o tej samej częstotliwości, w rogu, gdzie obie skale się spotykają. Każde uderzenie to jedna fala tonu. Za szybkie, żeby liczyć, za wolne na czysty ton: słychać warkot, a wysokość podpowiadają dopiero wyższe harmoniczne.',
      en: 'The tone C0, 16 vibrations a second, struck 16 times a second: a sound and a rhythm of the same frequency, in the corner where the two scales meet. Each strike is one wave of the tone. Too fast to count, too slow for a clear pitch: what you hear is a growl, and the pitch comes only from the harmonics above it.',
    },
    size: 15,
    layout: 'border',
    tuning: 'just',
    voices: [{ pitch: 14, rhythm: 14 }],
  },
  {
    id: 'border-strikes-into-tone',
    group: 'border',
    title: { pl: 'Uderzenia, które stają się tonem', en: 'Strikes that become a tone' },
    description: {
      pl: 'Ton C2 (65 Hz) w rytmie C0: cztery głosy w jednej kratce, równo rozłożone, czyli 65 uderzeń na sekundę, dokładnie tyle, ile drgań ma sam ton. Uderzenia zlewają się z tonem w jeden równy dźwięk. Usuń kratkę prawym przyciskiem i dodawaj głosy po jednym: z jednym słychać warkot 16 uderzeń na sekundę, z każdym następnym gęstnieje, aż znika w tonie.',
      en: 'The tone C2 (65 Hz) in rhythm C0: four voices in one cell, evenly spread, so 65 strikes a second, exactly as many as the tone has vibrations. The strikes merge with the tone into one even sound. Clear the cell with the right button and add the voices one at a time: with one there is a growl of 16 strikes a second, and it thickens with each until it vanishes into the tone.',
    },
    size: 15,
    layout: 'border',
    tuning: 'just',
    voices: [0, 1, 2, 3].map(k => ({ pitch: 0, rhythm: 14, offset: k / 4 })),
  },
  {
    id: 'border-beats',
    group: 'border',
    title: { pl: 'Dudnienie jako rytm', en: 'Beating as a rhythm' },
    description: {
      pl: 'C1 i D1, 32,7 i 36,8 Hz, brzmiące razem. Dwa bliskie tony dudnią: głośność faluje z częstotliwością równą ich różnicy, 4,09 Hz. A ta różnica to C−2, pierwsza kolumna, więc dudnienie wypada na skali rytmów, równo z uderzeniami. Dwa dźwięki, każdy słyszalny, dają razem rytm.',
      en: 'C1 and D1, 32.7 and 36.8 Hz, sounding together. Two close tones beat: the loudness swells and fades at their difference, 4.09 Hz. And that difference is C−2, the first column, so the beating lands on the scale of rhythms, in step with the strikes. Two sounds, each of them audible, make a rhythm between them.',
    },
    size: 15,
    layout: 'border',
    tuning: 'just',
    voices: [{ pitch: 7, rhythm: 0 }, { pitch: 6, rhythm: 0 }],
  },
  {
    id: 'border-beats-equal',
    group: 'border',
    title: { pl: 'Dudnienie, które się rozjeżdża', en: 'Beating that drifts' },
    description: {
      pl: 'Ta sama para C1 i D1 w stroju równomiernym. Tu cały ton jest odrobinę węższy, więc dudni wolniej, 4,00 Hz, a uderzenia w rytmie C−2 biją 4,09 razy na sekundę. Dudnienie i uderzenia rozjeżdżają się: przez kilka sekund uderzenia trafiają w ciche miejsca dudnienia i prawie giną, potem znów w głośne, i tak co 12 s. Tak słucha stroiciel fortepianu: liczy dudnienia, żeby wiedzieć, o ile interwał odstaje od czystego.',
      en: 'The same pair, C1 and D1, in equal tuning. Here the whole tone is a little narrower, so it beats more slowly, 4.00 Hz, while the strikes in rhythm C−2 come 4.09 times a second. The beating and the strikes slide apart: for a few seconds the strikes fall into the quiet parts of the beating and almost vanish, then into the loud parts again, round and round every 12 s. This is how a piano tuner listens: counting beats to know how far an interval is from pure.',
    },
    size: 15,
    layout: 'border',
    tuning: 'equal',
    voices: [{ pitch: 7, rhythm: 0 }, { pitch: 6, rhythm: 0 }],
  },
  {
    id: 'border-chord',
    group: 'border',
    title: { pl: 'Akord, który dudni', en: 'A chord that beats' },
    description: {
      pl: 'C1, E1 i G1, akord C-dur, uderzany razem w rytmie C−2, cztery razy na sekundę. Tony mają się jak 4 : 5 : 6, więc sąsiednie różnią się o tyle samo, 8,18 Hz, i akord dudni z tą częstotliwością, dwa razy na każde uderzenie. To C−1, kolumna 7: brakujący bas akordu, dwie oktawy pod C1, który zamiast tonem staje się rytmem.',
      en: 'C1, E1 and G1, a C major chord, struck together in rhythm C−2, four times a second. The tones stand as 4 : 5 : 6, so neighbours differ by the same 8.18 Hz, and the chord beats at that frequency, twice for every strike. That is C−1, column 7: the missing bass of the chord, two octaves below C1, which turns into a rhythm instead of a tone.',
    },
    size: 15,
    layout: 'border',
    tuning: 'just',
    voices: [7, 5, 3].map(p => ({ pitch: p, rhythm: 0 })),
  },
];

// Steps of the major pentatonic, C D E G A: random notes from it rarely clash.
const PENTATONIC = [0, 1, 2, 4, 5];
const OFFSETS = [0, 0, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4];

/** Pentatonic steps of a grid of `size`, below `below`. */
const pentatonic = (size: number, below = size) =>
  Array.from({ length: Math.min(size, below) }, (_, s) => s).filter(s => PENTATONIC.includes(s % 7));

/** The rhythms a random pattern draws from: the pentatonic columns of the slower part of the grid. */
export const randomRhythms = (size: GridSize) => pentatonic(size, size === 8 ? 6 : 10);

/**
 * A random pattern for a grid of `size`: a few voices on pentatonic notes, in pentatonic
 * rhythms from the slower part of the grid (C D E G A, and in 15 × 15 also the C D E above),
 * at simple fractions of their cycles. `random` returns numbers in [0, 1), as Math.random does.
 */
export function randomPattern(size: GridSize, random: () => number = Math.random): PatternVoice[] {
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(random() * xs.length)];
  const pitches = pentatonic(size);
  const rhythms = randomRhythms(size);
  const count = 4 + Math.floor(random() * (size === 8 ? 4 : 6));
  const voices: PatternVoice[] = [];
  const seen = new Set<string>();
  while (voices.length < count) {
    const v = { pitch: pick(pitches), rhythm: pick(rhythms), offset: pick(OFFSETS) };
    const k = `${v.pitch}:${v.rhythm}:${v.offset}`;
    if (seen.has(k)) continue;
    seen.add(k);
    voices.push(v);
  }
  return voices;
}
