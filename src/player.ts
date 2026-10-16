// Infra-beatbox player: plays the voices of the grid through Web Audio.
//
// Notes are scheduled ahead on the audio clock, never fired from timers: every TICK seconds
// the player looks LOOKAHEAD seconds ahead and books each hit at its exact time. The tick
// runs in a worker, because a page's own timers slow to once a second in a background tab.
//
// The sound is synthesised: a few harmonics with a quick attack and a long decay, between
// a marimba and a music box. No samples to load.

import {
  pitchFrequency, rhythmFrequency, hitTimes, phaseAt, retunedPhase,
  type Tuning, type Voice,
} from './infra-beatbox.ts';

const LOOKAHEAD = 0.15;   // s booked ahead of the clock
const TICK = 0.025;       // s between bookings
const START_DELAY = 0.01; // s from a click to the first hit, so it is never booked in the past
const DECAY = 0.9;        // s for a note to fade out
const PEAK = 0.16;        // gain of one note at its loudest

interface Booked { node: OscillatorNode; time: number }
interface PlayedVoice extends Voice { booked: Set<Booked> }

export class Player {
  readonly ctx: AudioContext;
  private tuning: Tuning;
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

  /** The voices, without their bookkeeping. */
  list(): Voice[] {
    return this.voices.map(({ pitch, rhythm, phase }) => ({ pitch, rhythm, phase }));
  }

  /** Adds a voice to a cell, sounding now and then once in every period of its rhythm. */
  add(pitch: number, rhythm: number): Voice {
    const t = this.ctx.currentTime + START_DELAY;
    const f = rhythmFrequency(rhythm, this.tuning);
    const voice: PlayedVoice = { pitch, rhythm, phase: phaseAt(t, f), booked: new Set() };
    // Book everyone up to the horizon now, so the new voice's first hit is never late,
    // and the new voice from its first hit on, so that hit is booked once.
    const to = Math.max(this.bookedUntil, this.ctx.currentTime + LOOKAHEAD);
    for (const v of this.voices) this.bookVoice(v, this.bookedUntil, to);
    this.bookedUntil = to;
    this.bookVoice(voice, t, to);
    this.voices.push(voice);
    return { pitch, rhythm, phase: voice.phase };
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
      this.cancel(v);
      v.phase = retunedPhase(v.phase, now,
        rhythmFrequency(v.rhythm, this.tuning), rhythmFrequency(v.rhythm, tuning));
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
    const f = rhythmFrequency(v.rhythm, this.tuning);
    for (const time of hitTimes(f, v.phase, from, to)) {
      const node = this.note(pitchFrequency(v.pitch, this.tuning), time);
      const booked = { node, time };
      v.booked.add(booked);
      node.onended = () => v.booked.delete(booked);
    }
  }

  /** Stops the notes of a voice that have not started yet; the one sounding fades on. */
  private cancel(v: PlayedVoice): void {
    const now = this.ctx.currentTime;
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
}
