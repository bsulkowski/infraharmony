# Infraharmony

*Eight octaves below sound*

*Also available in Polish: [README](README_PL.md)*

Harmony for rhythms. Music has long known which tones go well together: frequencies in simple
ratios, a fifth at 3 : 2, a major chord at 4 : 5 : 6. Rhythms are frequencies too, only slower,
so the same ratios should tell which rhythms go well together. Infraharmony carries the scale
down to where a frequency is heard as a pulse, and lets you combine the two.

A grid of tones and rhythms on one scale. The rows are the C major scale from middle C
(C4 ≈ 262 Hz). The columns are the same scale eight octaves lower, from C−4 ≈ 1.02 Hz,
where a frequency is no longer heard as a pitch but as a pulse. Each cell joins a tone
with a rhythm; the cells on the diagonal play a tone exactly 256 times faster than they repeat it.

A distant relative of the Rhythmicon, built by Leon Theremin for Henry Cowell in 1931, which
played each tone of the overtone series together with a rhythm in the same ratio.

A prototype, for a page in the Sandbox of [bsulkowski.pl](https://bsulkowski.pl).

## Playing

- **Left click** a cell: a voice starts there. It sounds at once and comes back every period
  of its rhythm. Another click on the same cell adds another voice of the same tone and
  rhythm, in the phase of that click.
- **Right click** a cell: clears all its voices. On a touch screen, hold the cell.
- Keyboard: arrows move, **Enter** adds, **Delete** clears.

Each voice is drawn as a dot circling its cell once a period; the note sounds as the dot passes
the mark at the top.

The page has ready-made patterns (a heartbeat, an arpeggio in one rhythm, a chord as a
polyrhythm, canons with one tune at several speeds, a pendulum wave …) and a button for random
ones, pentatonic in both tone and rhythm.

A piece can be sent as a short code, kept in the page address after `#` and in a field on the
page: `1j8.AAAACAVVEAqr` is C4, E4 and G4 in rhythm C−4, a third of a period apart, in just
tuning. The format is described in `src/code.ts`.

Two tunings: equal temperament, and just intonation, where the scale steps are whole-number
ratios (9/8, 5/4, 4/3, 3/2 …). In just intonation polyrhythms repeat exactly: C, E and G in the
rhythms of their own notes are 4 : 5 : 6 and line up every four periods of C. In equal temperament
they drift: the third comes back into line every 25 s, the fifth in just under five minutes.

## Code

- `src/infraharmony.ts`: the scale, the rhythms and the timing of voices. Pure functions,
  no DOM or audio.
- `src/examples.ts`: the ready-made patterns and the random one.
- `src/code.ts`: a piece as a code for a link, and back.
- `src/player.ts`: plays the voices through Web Audio, with notes booked ahead on the audio
  clock and a synthesised tone.
- `demo/`: the prototype page.

```sh
npm install
npm test        # the engine
npm run demo    # the page, at http://localhost:8000
```
