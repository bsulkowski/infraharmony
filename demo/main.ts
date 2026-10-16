// Prototype page: the grid of tone × rhythm, played by the Player.
//
// Left button (or Enter) adds a voice to a cell at the moment of the press, so its phase is
// the press. Right button (or Delete, or a long touch) clears the cell. Each voice is drawn
// as a dot circling its cell once per period; it sounds as it passes the mark at the top.

import {
  pitchFrequency, rhythmFrequency, pitchName, rhythmName, cyclePosition,
  type Tuning, type GridSize,
} from '../src/infraharmony.ts';
import { Player } from '../src/player.ts';
import { EXAMPLES, randomPattern, type PatternVoice } from '../src/examples.ts';
import { codeFromUrl, decodePiece, encodePiece, type Piece } from '../src/code.ts';

const SVG = 'http://www.w3.org/2000/svg';
const R = 36;                 // radius of the orbit, in a 100 × 100 cell
const FLASH = 0.22;           // s a cell glows after a hit
const LONG_PRESS = 550;       // ms of touch that clears a cell

const player = new Player('equal');
let size: GridSize = 8;

const grid = document.getElementById('grid') as HTMLDivElement;
const status = document.getElementById('status') as HTMLSpanElement;
const notice = document.getElementById('notice') as HTMLSpanElement;

interface CellView { el: HTMLButtonElement; dots: SVGCircleElement[]; group: SVGGElement }
const cells = new Map<string, CellView>();
const key = (pitch: number, rhythm: number) => `${pitch}:${rhythm}`;

const fmt = (x: number, digits: number) =>
  x.toLocaleString('pl-PL', { minimumFractionDigits: digits, maximumFractionDigits: digits });

// Hue by scale degree: the same note has the same colour in every octave.
const hue = (step: number) => Math.round(((step % 7) / 7) * 360 + 8);

function build(): void {
  grid.replaceChildren();
  cells.clear();
  grid.style.setProperty('--n', String(size));
  grid.dataset.n = String(size);
  const tuning = player.currentTuning;
  for (let row = 0; row < size; row++) {
    const pitch = size - 1 - row;  // high tones on top
    const label = document.createElement('div');
    label.className = 'rowlabel';
    label.innerHTML = `<span class="name">${pitchName(pitch)}</span><span class="hz">${fmt(pitchFrequency(pitch, tuning), 0)} Hz</span>`;
    grid.append(label);
    for (let rhythm = 0; rhythm < size; rhythm++) grid.append(makeCell(pitch, rhythm));
  }
  const corner = document.createElement('div');
  corner.className = 'corner';
  grid.append(corner);
  for (let rhythm = 0; rhythm < size; rhythm++) {
    const label = document.createElement('div');
    label.className = 'collabel';
    label.innerHTML = `<span class="name">${rhythmName(rhythm)}</span><span class="hz">${fmt(rhythmFrequency(rhythm, tuning), 2)} Hz</span>`;
    grid.append(label);
  }
  refreshAll();
}

function makeCell(pitch: number, rhythm: number): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'cell' + (pitch === rhythm ? ' diag' : '');
  el.dataset.pitch = String(pitch);
  el.dataset.rhythm = String(rhythm);
  el.style.setProperty('--h', String(hue(pitch)));
  el.setAttribute('aria-label', `${pitchName(pitch)} w rytmie ${rhythmName(rhythm)}`);
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('aria-hidden', 'true');
  const track = document.createElementNS(SVG, 'circle');
  track.setAttribute('class', 'track');
  track.setAttribute('cx', '50'); track.setAttribute('cy', '50'); track.setAttribute('r', String(R));
  const tick = document.createElementNS(SVG, 'line');
  tick.setAttribute('class', 'tick');
  tick.setAttribute('x1', '50'); tick.setAttribute('x2', '50');
  tick.setAttribute('y1', String(50 - R - 9)); tick.setAttribute('y2', String(50 - R + 9));
  const group = document.createElementNS(SVG, 'g');
  svg.append(track, tick, group);
  el.append(svg);
  cells.set(key(pitch, rhythm), { el, dots: [], group });
  return el;
}

/** Brings the dots of every cell in line with the player's voices. */
function refreshAll(): void {
  const counts = new Map<string, number>();
  for (const v of player.list()) {
    const k = key(v.pitch, v.rhythm);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  for (const [k, view] of cells) {
    const n = counts.get(k) ?? 0;
    while (view.dots.length < n) {
      const dot = document.createElementNS(SVG, 'circle');
      dot.setAttribute('class', 'dot');
      dot.setAttribute('r', '7');
      view.group.append(dot);
      view.dots.push(dot);
    }
    while (view.dots.length > n) view.dots.pop()!.remove();
    view.el.classList.toggle('on', n > 0);
    view.el.dataset.voices = String(n);
    if (n === 0) view.el.style.setProperty('--flash', '0');
  }
  const total = player.list().length;
  status.textContent = `Głosy: ${total}`;
  updateCode();
}

function frame(): void {
  requestAnimationFrame(frame);
  if (!player.running) return;
  const t = player.heardTime;
  const tuning = player.currentTuning;
  const seen = new Map<string, number>();
  const flash = new Map<string, number>();
  for (const v of player.list()) {
    const k = key(v.pitch, v.rhythm);
    const view = cells.get(k);
    if (!view) continue;
    const i = seen.get(k) ?? 0;
    seen.set(k, i + 1);
    const f = rhythmFrequency(v.rhythm, tuning);
    const pos = cyclePosition(t, f, v.phase);
    const since = pos / f;
    const glow = since < FLASH ? (1 - since / FLASH) ** 2 : 0;
    flash.set(k, Math.max(flash.get(k) ?? 0, glow));
    const a = pos * 2 * Math.PI;
    const dot = view.dots[i];
    if (!dot) continue;
    dot.setAttribute('cx', (50 + R * Math.sin(a)).toFixed(2));
    dot.setAttribute('cy', (50 - R * Math.cos(a)).toFixed(2));
    dot.setAttribute('r', (7 + 5 * glow).toFixed(2));
  }
  for (const [k, g] of flash) cells.get(k)!.el.style.setProperty('--flash', g.toFixed(3));
}

// A piece from a link waits here for the first click: browsers allow no sound before it.
let pending: Piece | null = null;

async function ensureAudio(): Promise<void> {
  await player.start();
  notice.hidden = true;
  if (pending) {
    const { voices } = pending;
    pending = null;
    examplePlay.hidden = true;
    player.load(voices);
    refreshAll();
  }
}

async function addVoice(pitch: number, rhythm: number): Promise<void> {
  await ensureAudio();
  player.add(pitch, rhythm);
  refreshAll();
}

function clearCell(pitch: number, rhythm: number): void {
  player.clear(pitch, rhythm);
  refreshAll();
}

const cellOf = (target: EventTarget | null) =>
  (target as Element | null)?.closest?.('.cell') as HTMLButtonElement | null;
const coords = (el: HTMLButtonElement) => [Number(el.dataset.pitch), Number(el.dataset.rhythm)] as const;

// Voices are added on press, not on release: the phase is the moment the finger comes down.
let pressTimer: ReturnType<typeof setTimeout> | null = null;
grid.addEventListener('pointerdown', e => {
  const el = cellOf(e.target);
  if (!el) return;
  const [pitch, rhythm] = coords(el);
  if (e.button === 2) { clearCell(pitch, rhythm); return; }
  if (e.button !== 0) return;
  void addVoice(pitch, rhythm);
  if (e.pointerType !== 'mouse') {
    pressTimer = setTimeout(() => { pressTimer = null; clearCell(pitch, rhythm); }, LONG_PRESS);
  }
});
for (const type of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
  grid.addEventListener(type, () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } });
}
grid.addEventListener('contextmenu', e => e.preventDefault());
grid.addEventListener('click', e => e.preventDefault());
grid.addEventListener('keydown', e => {
  const el = cellOf(e.target);
  if (!el) return;
  const [pitch, rhythm] = coords(el);
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (!e.repeat) void addVoice(pitch, rhythm);
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    clearCell(pitch, rhythm);
  } else if (e.key.startsWith('Arrow')) {
    e.preventDefault();
    const dp = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0;
    const dr = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    cells.get(key(pitch + dp, rhythm + dr))?.el.focus();
  }
});

// A touch only counts as permission to play once the finger lifts: resume again then.
for (const type of ['pointerup', 'keydown'] as const) {
  document.addEventListener(type, () => { if (player.ctx.state === 'suspended') void player.ctx.resume(); });
}

function press(group: string, attr: string, value: string): void {
  for (const b of document.querySelectorAll<HTMLButtonElement>(`[data-${attr}]`)) {
    if (b.closest('.seg')?.getAttribute('aria-labelledby') === group) {
      b.setAttribute('aria-pressed', String(b.dataset[attr] === value));
    }
  }
}

function setSize(n: GridSize): void {
  size = n;
  for (const v of player.list()) if (v.pitch >= size || v.rhythm >= size) player.clear(v.pitch, v.rhythm);
  press('size-label', 'size', String(size));
  build();
}

function setTuning(tuning: Tuning): void {
  player.setTuning(tuning);
  press('tuning-label', 'tuning', tuning);
  build();
}

for (const b of document.querySelectorAll<HTMLButtonElement>('[data-size]')) {
  b.addEventListener('click', () => setSize(Number(b.dataset.size) as GridSize));
}

for (const b of document.querySelectorAll<HTMLButtonElement>('[data-tuning]')) {
  b.addEventListener('click', () => setTuning(b.dataset.tuning as Tuning));
}

(document.getElementById('volume') as HTMLInputElement).addEventListener('input', e => {
  player.setVolume(Number((e.target as HTMLInputElement).value));
});

const exampleSelect = document.getElementById('example') as HTMLSelectElement;
const exampleNote = document.getElementById('example-note') as HTMLParagraphElement;
const exampleTitle = document.getElementById('example-title') as HTMLElement;
const exampleText = document.getElementById('example-text') as HTMLElement;
const examplePlay = document.getElementById('example-play') as HTMLButtonElement;

for (const n of [8, 15]) {
  const group = document.createElement('optgroup');
  group.label = `Siatka ${n} × ${n}`;
  for (const e of EXAMPLES.filter(x => x.size === n)) {
    const option = document.createElement('option');
    option.value = e.id;
    option.textContent = e.title.pl;
    group.append(option);
  }
  exampleSelect.append(group);
}

function describe(title: string, text: string): void {
  exampleTitle.textContent = `${title}.`;
  exampleText.textContent = text;
  exampleNote.hidden = false;
}

async function play(pattern: PatternVoice[]): Promise<void> {
  await ensureAudio();
  player.load(pattern);
  refreshAll();
}

exampleSelect.addEventListener('change', async () => {
  const e = EXAMPLES.find(x => x.id === exampleSelect.value);
  if (!e) return;
  // A larger grid when the example needs it; a smaller one is left as it is.
  if (e.size > size) setSize(e.size);
  if (e.tuning) setTuning(e.tuning);
  describe(e.title.pl, e.description.pl);
  await play(e.voices);
});

document.getElementById('random')!.addEventListener('click', async () => {
  exampleSelect.value = '';
  const pattern = randomPattern(size);
  describe('Losowy wzór', `${voicesWord(pattern.length)} na nutach pentatoniki C–D–E–G–A, w rytmach z tej samej pentatoniki, w prostych ułamkach okresu. Losuj dalej albo dopisuj własne głosy.`);
  await play(pattern);
});

// Sharing: the piece as a code, kept in the address and in the field.

const codeInput = document.getElementById('code') as HTMLInputElement;
const shareMsg = document.getElementById('share-msg') as HTMLSpanElement;
const framed = (() => { try { return window.self !== window.top; } catch { return true; } })();

function voicesWord(n: number): string {
  const few = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14);
  return `${n} ${n === 1 ? 'głos' : few ? 'głosy' : 'głosów'}`;
}

function currentPiece(): Piece {
  return pending ?? { size, tuning: player.currentTuning, voices: player.pattern() };
}

function updateCode(): void {
  const piece = currentPiece();
  const code = piece.voices.length ? encodePiece(piece) : '';
  if (document.activeElement !== codeInput) codeInput.value = code;
  try {
    history.replaceState(null, '', code ? `#${code}` : location.pathname + location.search);
  } catch { /* an address that cannot change: the field still has the code */ }
}

function say(text: string, error = false): void {
  shareMsg.textContent = text;
  shareMsg.classList.toggle('error', error);
}

/** Puts a piece on the grid: playing at once if sound is on, else waiting for a click. */
async function openPiece(piece: Piece, title: string): Promise<void> {
  exampleSelect.value = '';
  setSize(piece.size);
  setTuning(piece.tuning);
  const n = voicesWord(piece.voices.length);
  if (player.running) {
    describe(title, `${n}.`);
    await play(piece.voices);
  } else {
    pending = piece;
    describe(title, `Gotowe do odtworzenia: ${n}.`);
    examplePlay.hidden = false;
    refreshAll();
  }
}

examplePlay.addEventListener('click', () => void ensureAudio());

document.getElementById('copy')!.addEventListener('click', () => {
  const piece = currentPiece();
  if (!piece.voices.length) { say('Siatka jest pusta, nie ma czego kopiować.', true); return; }
  const code = encodePiece(piece);
  codeInput.value = code;
  // On a page of its own the address is the link; inside a frame its address is not
  // one anybody else can open, so the code goes alone.
  const link = framed ? null : location.origin + location.pathname + location.search + '#' + code;
  navigator.clipboard.writeText(link ?? code).then(
    () => say(link ? 'Skopiowano link.' : 'Skopiowano kod.'),
    () => { codeInput.select(); say('Kod zaznaczony: skopiuj go skrótem Ctrl+C.'); },
  );
});

function loadFromField(): void {
  const text = codeInput.value.trim();
  let code = text;
  if (/^https?:\/\//.test(text)) {
    try { code = codeFromUrl(text) ?? ''; } catch { code = ''; }
  }
  const piece = decodePiece(code);
  if (!piece) { say('To nie jest kod utworu. Kod zaczyna się od 1e8. albo 1j8. (1ef. i 1jf. dla siatki 15 × 15).', true); return; }
  say('');
  codeInput.blur();
  void openPiece(piece, 'Utwór z kodu');
}

document.getElementById('load-code')!.addEventListener('click', loadFromField);
codeInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); loadFromField(); } });

window.addEventListener('hashchange', () => {
  const code = codeFromUrl(location.href);
  const piece = code && decodePiece(code);
  if (piece && code !== encodePiece(currentPiece())) void openPiece(piece, 'Utwór z linku');
});

document.getElementById('clear-all')!.addEventListener('click', () => {
  player.clearAll();
  pending = null;
  examplePlay.hidden = true;
  exampleSelect.value = '';
  exampleNote.hidden = true;
  refreshAll();
});

// Read the address before the first drawing, which writes the (empty) grid's code into it.
const linked = decodePiece(codeFromUrl(location.href) ?? '');
build();
if (linked) void openPiece(linked, 'Utwór z linku');
requestAnimationFrame(frame);
