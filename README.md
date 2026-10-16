# Infra-beatbox

*Also available in Polish: [README](README_PL.md)*

A grid of tones and rhythms on one scale. The rows are the C major scale from middle C
(C4 ≈ 262 Hz). The columns are the same scale eight octaves lower, from C−4 ≈ 1.02 Hz,
where a frequency is no longer heard as a pitch but as a pulse. Each cell joins a tone
with a rhythm; the cells on the diagonal play a tone exactly 256 times faster than they repeat it.

A prototype, for a page in the Sandbox of [bsulkowski.pl](https://bsulkowski.pl).

## Playing

- **Left click** a cell: a voice starts there. It sounds at once and comes back every period
  of its rhythm. Another click on the same cell adds another voice of the same tone and
  rhythm, in the phase of that click.
- **Right click** a cell: clears all its voices. On a touch screen, hold the cell.
- Keyboard: arrows move, **Enter** adds, **Delete** clears.

Each voice is drawn as a dot circling its cell once a period; the note sounds as the dot passes
the mark at the top.

Two tunings: equal temperament, and just intonation, where the scale steps are whole-number
ratios (9/8, 5/4, 4/3, 3/2 …). In just intonation polyrhythms repeat exactly: C, E and G in the
rhythms of their own notes are 4 : 5 : 6 and line up every four periods of C. In equal temperament
they drift apart slowly and come back after minutes.

## Code

- `src/infra-beatbox.ts`: the scale, the rhythms and the timing of voices. Pure functions,
  no DOM or audio.
- `src/player.ts`: plays the voices through Web Audio, with notes booked ahead on the audio
  clock and a synthesised tone.
- `demo/`: the prototype page.

```sh
npm install
npm test        # the engine
npm run demo    # the page, at http://localhost:8000
```
