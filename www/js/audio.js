// ============================================================
// AUDIO SUPER BIMO
// Semua suara & musik dibuat langsung dengan Web Audio API
// (chiptune prosedural) - tidak butuh file audio eksternal.
// ============================================================

const AudioSys = {
  ctx: null,
  muted: false,
  musicTimer: null,
  musicSlot: 0,
  musicNextT: 0,

  unlock() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) this.stopMusic();
    else if (Game && Game.state === 'PLAY') this.startMusic();
    return this.muted;
  },

  // satu nada dengan slide opsional
  tone(f0, f1, dur, type, vol, when) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + (when || 0);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(Math.max(f0, 1), t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    g.gain.setValueAtTime(vol || 0.07, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.03);
  },

  noise(dur, vol) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    g.gain.value = vol || 0.12;
    src.buffer = buf;
    src.connect(g); g.connect(this.ctx.destination);
    src.start(t);
  },

  arpeggio(freqs, step, type, vol) {
    for (let i = 0; i < freqs.length; i++) {
      this.tone(freqs[i], freqs[i], step * 1.6, type || 'square', vol || 0.06, i * step);
    }
  },

  // ---------- efek suara ----------
  sfx: {
    jump()   { AudioSys.tone(320, 660, 0.16, 'square', 0.055); },
    coin()   { AudioSys.tone(988, 988, 0.07, 'square', 0.05);
               AudioSys.tone(1319, 1319, 0.22, 'square', 0.05, 0.07); },
    stomp()  { AudioSys.tone(420, 130, 0.14, 'square', 0.07); AudioSys.noise(0.08, 0.06); },
    bump()   { AudioSys.tone(180, 120, 0.09, 'square', 0.06); },
    brk()    { AudioSys.noise(0.2, 0.14); AudioSys.tone(240, 90, 0.15, 'sawtooth', 0.06); },
    power()  { AudioSys.arpeggio([523, 659, 784, 1047, 1319], 0.07); },
    shrink() { AudioSys.arpeggio([784, 622, 494, 392], 0.08); },
    die()    { AudioSys.arpeggio([660, 520, 392, 300, 220, 165], 0.11, 'square', 0.07); },
    oneup()  { AudioSys.arpeggio([523, 659, 784, 1047, 1319, 1568], 0.09); },
    clear()  { AudioSys.arpeggio([392, 523, 659, 784, 1047, 1319], 0.1, 'square', 0.06); },
    start()  { AudioSys.arpeggio([523, 784, 1047], 0.08); }
  },

  // ---------- musik latar (melodi original, loop 16 ketukan) ----------
  MELODY: [523, 659, 784, 659, 698, 880, 784, 659, 587, 698, 880, 698, 784, 659, 523, 0],
  BASSLN: [131, 0, 131, 0, 175, 0, 175, 0, 147, 0, 147, 0, 196, 0, 196, 0],

  startMusic() {
    if (!this.ctx || this.muted || this.musicTimer) return;
    this.musicSlot = 0;
    this.musicNextT = this.ctx.currentTime + 0.06;
    const STEP = 0.17;
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      while (this.musicNextT < this.ctx.currentTime + 0.4) {
        const i = this.musicSlot;
        const when = this.musicNextT - this.ctx.currentTime;
        const m = this.MELODY[i], b = this.BASSLN[i];
        if (m) this.tone(m, m, STEP * 0.85, 'square', 0.032, Math.max(when, 0));
        if (b) this.tone(b, b, STEP * 1.7, 'triangle', 0.05, Math.max(when, 0));
        this.musicSlot = (i + 1) % this.MELODY.length;
        this.musicNextT += STEP;
      }
    }, 90);
  },

  stopMusic() {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }
};
