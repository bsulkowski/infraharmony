// Prototype page: the grid of tone × rhythm, played by the Player.
//
// Left button (or Enter) adds a voice to a cell at the moment of the press, so its phase is
// the press. Right button (or Delete, or a long touch) clears the cell. Each voice is drawn
// as a dot circling its cell once per period; it sounds as it passes the mark at the top.

import {
  pitchFrequency, rhythmFrequency, pitchName, rhythmName, cyclePosition,
  type Tuning, type GridSize,
} from '../src/infra-beatbox.ts';
import { Player } from '../src/player.ts';

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

async function ensureAudio(): Promise<void> {
  await player.start();
  notice.hidden = true;
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

for (const b of document.querySelectorAll<HTMLButtonElement>('[data-size]')) {
  b.addEventListener('click', () => {
    size = Number(b.dataset.size) as GridSize;
    for (const v of player.list()) if (v.pitch >= size || v.rhythm >= size) player.clear(v.pitch, v.rhythm);
    press('size-label', 'size', String(size));
    build();
  });
}

for (const b of document.querySelectorAll<HTMLButtonElement>('[data-tuning]')) {
  b.addEventListener('click', () => {
    player.setTuning(b.dataset.tuning as Tuning);
    press('tuning-label', 'tuning', b.dataset.tuning!);
    build();
  });
}

(document.getElementById('volume') as HTMLInputElement).addEventListener('input', e => {
  player.setVolume(Number((e.target as HTMLInputElement).value));
});

document.getElementById('clear-all')!.addEventListener('click', () => {
  player.clearAll();
  refreshAll();
});

// C, E and G, each in the rhythm of its own note: 4 : 5 : 6, a chord played as a polyrhythm.
// In just tuning the pattern comes back exactly every four seconds.
document.getElementById('example')!.addEventListener('click', async () => {
  await ensureAudio();
  player.clearAll();
  for (const step of [0, 2, 4]) player.add(step, step);
  refreshAll();
});

build();
requestAnimationFrame(frame);
