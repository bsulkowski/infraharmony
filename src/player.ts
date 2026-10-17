// Infraharmony player: plays the voices of the grid through Web Audio.
//
// Notes are scheduled ahead on the audio clock, never fired from timers: every TICK seconds
// the player looks LOOKAHEAD seconds ahead and books each hit at its exact time. The tick
// runs in a worker, because a page's own timers slow to once a second in a background tab.
//
// The sound is synthesised: a few harmonics with a quick attack and a long decay, between
// a marimba and a music box. No samples to load.
//
// In the Borderland the tones lie at 16–65 Hz, below what most speakers give out, so they get
// many harmonics: the ear finds the pitch from them, as it does on the lowest piano keys. And
// a voice there is one string that keeps vibrating and is struck again and again: one
// oscillator running for as long as the voice lives, its loudness bumped up at every strike
// and ringing down between them. Because the tone runs on unbroken, two voices held together
// beat at the difference of their tones, whatever their strikes are doing.

import {
  pitchFrequency, rhythmFrequency, hitTimes, offsetAt, phaseAt, phaseFor, retunedPhase,
  type Layout, type Tuning, type Voice,
} from './infraharmony.ts';
import type { PatternVoice } from './examples.ts';

const LOOKAHEAD = 0.15;   // s booked ahead of the clock
const TICK = 0.025;       // s between bookings
const START_DELAY = 0.01; // s from a click to the first hit, so it is never booked in the past
const DECAY = 0.9;        // s for a note to fade out
const PEAK = 0.16;        // gain of one note at its loudest
const RING = 0.3;         // s, time constant of a ringing note in the Borderland
const STRIKE = 0.012;     // s, time constant of the strike falling to the ringing level
const RING_LEVEL = 0.15;  // the ringing, as a part of the strike's peak
const RICH_BELOW = 200;   // Hz: tones lower than this get the harmonics they need to be heard
// A new voice is booked from a hair before its first hit: computed back from the phase,
// that hit can come out an ulp early, and would be taken for one of the window before.
const EPSILON = 1e-6;

interface Booked { node: OscillatorNode; time: number }
interface Tone { osc: OscillatorNode; gain: GainNode }
interface PlayedVoice extends Voice { booked: Set<Booked>; tone?: Tone }

export class Player {
  readonly ctx: AudioContext;
  private tuning: Tuning;
  private layout: Layout = 'infra';
  private richWaves = new Map<number, PeriodicWave>();
  private voices: PlayedVoice[] = [];
  private bookedUntil = 0;
  private master: GainNode;
  private wave: PeriodicWave;
  private ticker: Worker | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(tuning: Tuning = 'equal', ctx: AudioContext = new AudioContext()) {
    this.ctx = ctx;
    this.tuning = tuning;
    // Many voices can sound at once: a compressor keeps their sum from clipping.
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 12;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(compressor).connect(ctx.destination);
    // Harmonics 1–6, falling off; a touch of the 4th gives the bell.
    const imag = new Float32Array([0, 1, 0.42, 0.16, 0.22, 0.05, 0.03]);
    this.wave = ctx.createPeriodicWave(new Float32Array(imag.length), imag);
  }

  /** Starts the clock. Call from a click or a key: browsers keep audio off until then. */
  async start(): Promise<void> {
    // Safari: play with the ringer switch off, as a music app does.
    const session = (navigator as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'playback';
    if (this.ctx.state !== 'running') await this.ctx.resume();
    if (this.ticker || this.interval) return;
    this.bookedUntil = this.ctx.currentTime;
    try {
      const src = `setInterval(() => postMessage(0), ${TICK * 1000})`;
      this.ticker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      this.ticker.onmessage = () => this.book();
    } catch {
      this.interval = setInterval(() => this.book(), TICK * 1000);
    }
  }

  get running(): boolean {
    return this.ctx.state === 'running';
  }

  /** The time the listener hears now: the clock less the delay to the speakers. */
  get heardTime(): number {
    const latency = (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0);
    return Math.max(0, this.ctx.currentTime - latency);
  }

  get currentTuning(): Tuning {
    return this.tuning;
  }

  get currentLayout(): Layout {
    return this.layout;
  }

  /** Switches the grid between the infra layout and the Borderland; the voices are cleared. */
  setLayout(layout: Layout): void {
    if (layout === this.layout) return;
    this.clearAll();
    this.layout = layout;
  }

  private rhythmOf(step: number, tuning: Tuning = this.tuning): number {
    return rhythmFrequency(step, tuning, this.layout);
  }

  /** The voices, without their bookkeeping. */
  list(): Voice[] {
    return this.voices.map(({ pitch, rhythm, phase }) => ({ pitch, rhythm, phase }));
  }

  /** Adds a voice to a cell, sounding now and then once in every period of its rhythm. */
  add(pitch: number, rhythm: number): Voice {
    const t = this.ctx.currentTime + START_DELAY;
    const f = this.rhythmOf(rhythm);
    const voice: PlayedVoice = { pitch, rhythm, phase: phaseAt(t, f), booked: new Set() };
    // Book everyone up to the horizon now, so the new voice's first hit is never late,
    // and the new voice from its first hit on, so that hit is booked once.
    const to = Math.max(this.bookedUntil, this.ctx.currentTime + LOOKAHEAD);
    for (const v of this.voices) this.bookVoice(v, this.bookedUntil, to);
    this.bookedUntil = to;
    this.bookVoice(voice, t - EPSILON, to);
    this.voices.push(voice);
    return { pitch, rhythm, phase: voice.phase };
  }

  /** The voices as a pattern, with offsets measured from now: what load() takes back. */
  pattern(): PatternVoice[] {
    const now = this.ctx.currentTime;
    return this.voices.map(({ pitch, rhythm, phase }) =>
      ({ pitch, rhythm, offset: offsetAt(now, this.rhythmOf(rhythm), phase) }));
  }

  /** Replaces all voices with a pattern, starting together a moment from now. */
  load(pattern: PatternVoice[]): void {
    this.clearAll();
    const start = this.ctx.currentTime + START_DELAY;
    const to = Math.max(this.bookedUntil, this.ctx.currentTime + LOOKAHEAD);
    for (const { pitch, rhythm, offset = 0 } of pattern) {
      const f = this.rhythmOf(rhythm);
      const voice: PlayedVoice = { pitch, rhythm, phase: phaseFor(start, f, offset), booked: new Set() };
      this.bookVoice(voice, start - EPSILON, to);
      this.voices.push(voice);
    }
    this.bookedUntil = to;
  }

  /** Removes every voice of a cell, notes already booked included. */
  clear(pitch: number, rhythm: number): void {
    this.voices = this.voices.filter(v => {
      if (v.pitch !== pitch || v.rhythm !== rhythm) return true;
      this.cancel(v);
      return false;
    });
  }

  clearAll(): void {
    for (const v of this.voices) this.cancel(v);
    this.voices = [];
  }

  /** Changes the tuning of pitches and rhythms; every voice carries on from where it is. */
  setTuning(tuning: Tuning): void {
    if (tuning === this.tuning) return;
    const now = this.ctx.currentTime;
    for (const v of this.voices) {
      if (v.tone) {
        // The string keeps vibrating: its strikes are dropped and booked again, its tone retuned.
        const g = v.tone.gain.gain;
        if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(now); else g.cancelScheduledValues(now);
        v.tone.osc.frequency.setValueAtTime(pitchFrequency(v.pitch, tuning, this.layout), now);
      } else {
        this.cancel(v);
      }
      v.phase = retunedPhase(v.phase, now, this.rhythmOf(v.rhythm), this.rhythmOf(v.rhythm, tuning));
    }
    this.tuning = tuning;
    this.bookedUntil = now;
    this.book();
  }

  setVolume(volume: number): void {
    this.master.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.02);
  }

  private book(): void {
    const to = this.ctx.currentTime + LOOKAHEAD;
    if (to <= this.bookedUntil) return;
    for (const v of this.voices) this.bookVoice(v, this.bookedUntil, to);
    this.bookedUntil = to;
  }

  private bookVoice(v: PlayedVoice, from: number, to: number): void {
    const f = this.rhythmOf(v.rhythm);
    const pitch = pitchFrequency(v.pitch, this.tuning, this.layout);
    if (this.layout === 'border') {
      for (const time of hitTimes(f, v.phase, from, to)) this.strike(v, pitch, time);
      return;
    }
    for (const time of hitTimes(f, v.phase, from, to)) {
      const node = this.note(pitch, time);
      const booked = { node, time };
      v.booked.add(booked);
      node.onended = () => v.booked.delete(booked);
    }
  }

  /** Stops the notes of a voice that have not started yet; the one sounding fades on. */
  private cancel(v: PlayedVoice): void {
    const now = this.ctx.currentTime;
    if (v.tone) {
      const g = v.tone.gain.gain;
      if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(now); else g.cancelScheduledValues(now);
      g.setTargetAtTime(0, now, 0.02);
      v.tone.osc.stop(now + 0.2);
      v.tone = undefined;
    }
    for (const b of v.booked) {
      if (b.time > now) {
        try { b.node.stop(); } catch { /* already stopped */ }
      }
    }
    v.booked.clear();
  }

  private note(freq: number, time: number): OscillatorNode {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(this.wave);
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    // Higher tones are heard louder: ease them down a little.
    const peak = PEAK * Math.min(1, (330 / freq) ** 0.35);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peak, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(peak * 0.25, time + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + DECAY);
    osc.connect(gain).connect(this.master);
    osc.start(time);
    osc.stop(time + DECAY + 0.02);
    return osc;
  }

  /**
   * A strike on a Borderland voice. The voice's string starts vibrating at its first strike
   * and keeps going; each strike lifts its loudness to the peak, which falls in a few
   * milliseconds to a ringing level and then dies away slowly until the next strike.
   */
  private strike(v: PlayedVoice, freq: number, time: number): void {
    if (!v.tone) {
      const osc = this.ctx.createOscillator();
      osc.setPeriodicWave(freq < RICH_BELOW ? this.richWave(freq) : this.wave);
      osc.frequency.value = freq;
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain).connect(this.master);
      osc.start(time);
      v.tone = { osc, gain };
    }
    const g = v.tone.gain.gain;
    g.setTargetAtTime(PEAK, time, 0.0015);
    g.setTargetAtTime(PEAK * RING_LEVEL, time + 0.006, STRIKE);
    g.setTargetAtTime(0, time + 0.006 + 4 * STRIKE, RING);
  }

  /**
   * A tone with harmonics up to about 4 kHz, falling off as 1/n: for a low tone the
   * fundamental is felt more than heard, and the pitch comes from the harmonics above it.
   */
  private richWave(freq: number): PeriodicWave {
    const n = Math.max(6, Math.min(128, Math.floor(4000 / freq)));
    let wave = this.richWaves.get(n);
    if (!wave) {
      const imag = new Float32Array(n + 1);
      for (let k = 1; k <= n; k++) imag[k] = 1 / k;
      wave = this.ctx.createPeriodicWave(new Float32Array(n + 1), imag);
      this.richWaves.set(n, wave);
    }
    return wave;
  }
}
