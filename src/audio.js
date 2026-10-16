// audio.js — everything synthesized with WebAudio (no asset files)
export class Audio {
  constructor() { this.ctx = null; this.vol = { master: 0.8, music: 0.55, sfx: 0.9 }; this.water = 0; this.musicOn = true; this.mood = 'day'; }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = C.createGain(); this.master.gain.value = this.vol.master; this.master.connect(C.destination);
    this.sfxBus = C.createGain(); this.sfxBus.gain.value = this.vol.sfx; this.sfxBus.connect(this.master);
    this.musBus = C.createGain(); this.musBus.gain.value = this.vol.music; this.musBus.connect(this.master);
    // reverb
    this.verb = C.createConvolver(); this.verb.buffer = this.impulse(3.2, 2.4);
    this.verbGain = C.createGain(); this.verbGain.gain.value = 0.35; this.verb.connect(this.verbGain); this.verbGain.connect(this.master);
    // music delay
    this.delay = C.createDelay(1); this.delay.delayTime.value = 0.42;
    const fb = C.createGain(); fb.gain.value = 0.32; const dl = C.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2200;
    this.delay.connect(dl); dl.connect(fb); fb.connect(this.delay); dl.connect(this.musBus);
    this.noise = this.noiseBuf();
    // ambience: wind + water
    this.wind = this.loopNoise(380, 0.05, 'lowpass');
    this.waterN = this.loopNoise(900, 0.0, 'bandpass', 0.6);
    this.t0 = C.currentTime; this.nextNote = C.currentTime + 0.5; this.mstep = 0; this.bar = 0;
    this.nextBird = C.currentTime + 2;
  }
  impulse(sec, decay) {
    const C = this.ctx, n = Math.floor(C.sampleRate * sec), b = C.createBuffer(2, n, C.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  noiseBuf() { const C = this.ctx, b = C.createBuffer(1, C.sampleRate * 2, C.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
  loopNoise(freq, gain, type, q = 0.7) {
    const C = this.ctx, s = C.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = C.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = C.createGain(); g.gain.value = gain;
    s.connect(f); f.connect(g); g.connect(this.sfxBus); s.start();
    return { f, g };
  }
  setVol(k, v) { this.vol[k] = v; if (!this.ctx) return; ({ master: this.master, music: this.musBus, sfx: this.sfxBus })[k].gain.value = v; }
  env(g, t, a, peak, d) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  tone(freq, dur, { type = 'sine', vol = 0.2, at = 0, bus, verb = 0.2, attack = 0.005, slide = 0 } = {}) {
    if (!this.ctx) return;
    const C = this.ctx, t = C.currentTime + at, o = C.createOscillator(), g = C.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    o.connect(g); g.connect(bus || this.sfxBus);
    if (verb) { const s = C.createGain(); s.gain.value = verb; g.connect(s); s.connect(this.verb); }
    this.env(g, t, attack, vol, dur); o.start(t); o.stop(t + attack + dur + 0.05);
  }
  burst(dur, freq, { vol = 0.2, type = 'bandpass', q = 1, at = 0, slide = 0 } = {}) {
    if (!this.ctx) return;
    const C = this.ctx, t = C.currentTime + at, s = C.createBufferSource(); s.buffer = this.noise;
    const f = C.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    const g = C.createGain(); s.connect(f); f.connect(g); g.connect(this.sfxBus);
    this.env(g, t, 0.004, vol, dur); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  // ---- sfx
  step(kind) { this.burst(0.06, kind === 'dirt' ? 900 : 2400, { vol: kind === 'dirt' ? 0.07 : 0.045, q: 0.9 }); }
  blip() { this.tone(880, 0.05, { type: 'square', vol: 0.04, verb: 0 }); }
  talkBlip(p = 1) { this.tone(420 * p + Math.random() * 60, 0.035, { type: 'square', vol: 0.025, verb: 0 }); }
  leaf() { [0, 4, 7, 12].forEach((s, i) => this.tone(659 * 2 ** (s / 12), 0.35, { type: 'triangle', vol: 0.12, at: i * 0.07, verb: 0.5 })); }
  card() { [0, 7, 12, 16, 19].forEach((s, i) => this.tone(523 * 2 ** (s / 12), 0.6, { type: 'sine', vol: 0.12, at: i * 0.09, verb: 0.6 })); }
  item() { [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => this.tone(392 * 2 ** (s / 12), 0.25, { type: 'square', vol: 0.05, at: i * 0.08, verb: 0.3 })); }
  solve() { [0, 4, 7, 11, 12, 16].forEach((s, i) => this.tone(440 * 2 ** (s / 12), 0.5, { type: 'triangle', vol: 0.12, at: i * 0.11, verb: 0.6 })); }
  wrong() { [0, -3, -7].forEach((s, i) => this.tone(330 * 2 ** (s / 12), 0.25, { type: 'square', vol: 0.05, at: i * 0.12, verb: 0.1 })); }
  push() { this.burst(0.35, 180, { vol: 0.3, type: 'lowpass', q: 0.5 }); this.tone(70, 0.25, { type: 'sine', vol: 0.25, verb: 0 }); }
  splash() { this.burst(0.6, 1200, { vol: 0.35, q: 0.4, slide: 0.3 }); this.tone(160, 0.3, { vol: 0.15, slide: 0.5 }); }
  thunk() { this.tone(110, 0.15, { type: 'square', vol: 0.08, verb: 0.1 }); this.burst(0.08, 600, { vol: 0.15 }); }
  whoosh() { this.burst(0.5, 400, { vol: 0.2, q: 0.7, slide: 4 }); this.tone(520, 0.6, { type: 'triangle', vol: 0.06, slide: 1.5, verb: 0.5 }); }
  rumble() { this.burst(1.8, 90, { vol: 0.5, type: 'lowpass', q: 0.3 }); this.tone(45, 1.6, { vol: 0.3, verb: 0.3 }); }
  meow() { this.tone(700, 0.35, { type: 'sawtooth', vol: 0.05, slide: 1.4, verb: 0.2, attack: 0.04 }); this.tone(980, 0.25, { type: 'sine', vol: 0.05, slide: 0.7, at: 0.2, verb: 0.2 }); }
  quack() { this.tone(300, 0.12, { type: 'sawtooth', vol: 0.06, slide: 0.7, verb: 0.1 }); this.tone(290, 0.1, { type: 'sawtooth', vol: 0.05, slide: 0.7, at: 0.16, verb: 0.1 }); }
  bite() { this.tone(1200, 0.08, { type: 'square', vol: 0.06, verb: 0 }); this.burst(0.2, 1500, { vol: 0.15 }); }
  click() { this.tone(1500, 0.02, { type: 'square', vol: 0.04, verb: 0 }); }
  shutter() { this.burst(0.05, 3000, { vol: 0.2 }); this.burst(0.06, 2000, { vol: 0.15, at: 0.08 }); }
  bell(golden = false) {
    if (!this.ctx) return;
    const base = 196;
    for (let k = 0; k < 3; k++) {
      const at = k * 1.9, v = 0.5 / (k + 1);
      [[1, 1], [2.0, 0.6], [2.76, 0.4], [5.4, 0.25], [8.9, 0.12], [0.5, 0.5]].forEach(([m, a]) =>
        this.tone(base * m, 5.5 - k, { type: 'sine', vol: v * a * 0.4, at, verb: 1.0, attack: 0.002 }));
    }
    if (golden) [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.tone(784 * 2 ** (s / 12), 1.2, { type: 'triangle', vol: 0.06, at: 1 + i * 0.15, verb: 1 }));
  }
  whistle() { // grandpa's slightly-off whistle
    [0, 2, 4, 7, 4, 2, 0, -1, 0].forEach((s, i) => this.tone(880 * 2 ** ((s + (i === 7 ? 0.3 : 0)) / 12), 0.38, { type: 'sine', vol: 0.06, at: i * 0.42, verb: 0.9, attack: 0.05 }));
  }
  // ---- update: ambience + generative music
  update(dt, { waterNear = 0, cave = false, birds = true } = {}) {
    if (!this.ctx) return;
    const C = this.ctx, t = C.currentTime;
    this.wind.g.gain.setTargetAtTime(cave ? 0.012 : 0.05 + 0.03 * Math.sin(t * 0.2), t, 0.5);
    this.waterN.g.gain.setTargetAtTime(Math.min(0.28, waterNear * 0.28), t, 0.3);
    if (birds && !cave && t > this.nextBird) {
      this.nextBird = t + 2 + Math.random() * 6;
      const f = 2200 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) this.tone(f * (1 + (i % 2) * 0.15), 0.07, { type: 'sine', vol: 0.025, at: i * 0.11, slide: 1.3, verb: 0.4 });
    }
    if (!this.musicOn) return;
    const bpm = cave ? 54 : 72, beat = 60 / bpm / 2;
    // pentatonic in D (day) / A minor-ish (cave)
    const scale = cave ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
    const root = cave ? 220 : 293.66;
    const prog = cave ? [0, -2, -4, -2] : [0, -3, -5, -1];   // scale-degree roots per bar
    while (this.nextNote < t + 0.3) {
      const at = this.nextNote - t;
      const barRoot = prog[this.bar % 4];
      if (this.mstep % 16 === 0) { // pad chord
        const r = root / 2 * 2 ** (this.semi(scale, barRoot) / 12);
        [0, 7, 16].forEach(s => this.tone(r * 2 ** (s / 12), beat * 15, { type: 'triangle', vol: cave ? 0.025 : 0.03, at, bus: this.musBus, verb: 0.6, attack: 0.8 }));
      }
      const pat = cave ? [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0] : [1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0];
      if (pat[this.mstep % 16] && Math.random() < 0.9) {
        const deg = barRoot + Math.floor(Math.random() * 6);
        const f = root * 2 ** (this.semi(scale, deg) / 12);
        this.tone(f, beat * 2.5, { type: 'triangle', vol: 0.05, at, bus: this.musBus, verb: 0.3 });
        const s = this.ctx.createGain(); void s;
        this.tone(f, beat * 2.5, { type: 'sine', vol: 0.02, at: at + 0.001, bus: this.delay, verb: 0 });
      }
      if (!cave && this.mstep % 8 === 4 && Math.random() < 0.5) this.tone(root / 2 * 2 ** (this.semi(scale, barRoot) / 12), beat * 3, { type: 'sine', vol: 0.06, at, bus: this.musBus, verb: 0.1 });
      this.nextNote += beat; this.mstep++;
      if (this.mstep % 16 === 0) this.bar++;
    }
  }
  semi(scale, deg) { const n = scale.length, o = Math.floor(deg / n); return scale[((deg % n) + n) % n] + 12 * o; }
}
