/* 全部声音由 Web Audio API 实时合成，无任何版权音频 */
window.Sound = (function () {
  let ctx, master, music, sfx, noiseBuf, timer;
  let muted = localStorage.getItem('yxx_mute') === '1';
  let intense = false, step = 0, nextT = 0;
  const BPM = 112;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
    master.connect(comp); comp.connect(ctx.destination);
    music = ctx.createGain(); music.gain.value = 0.2; music.connect(master);
    sfx = ctx.createGain(); sfx.gain.value = 0.85; sfx.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    nextT = ctx.currentTime + 0.1;
    timer = setInterval(schedule, 40);
  }

  function tone(freq, t, dur, type = 'sine', vol = 0.3, dest = sfx, slideTo) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(t, dur, vol, freq, q = 1, dest = sfx, type = 'bandpass', sweepTo) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }

  // ----- 背景音乐：五声音阶循环 -----
  const roots = [50, 46, 48, 45]; // D  Bb  C  A
  const mel = [
    [74, -1, 77, 79, 81, -1, 79, 77],
    [74, 77, -1, 74, 72, -1, 70, -1],
    [72, -1, 76, 79, 76, -1, 74, 72],
    [69, -1, 72, 74, 76, 74, -1, -1],
  ];
  function schedule() {
    if (!ctx) return;
    const sd = 60 / BPM / 4;
    while (nextT < ctx.currentTime + 0.2) {
      playStep(step, nextT);
      nextT += intense ? sd * 0.75 : sd;
      step = (step + 1) % 64;
    }
  }
  function playStep(st, t) {
    const bar = Math.floor(st / 16), s = st % 16, root = roots[bar];
    if (s % 4 === 0 && (intense || s === 0 || s === 8)) tone(120, t, 0.2, 'sine', 0.55, music, 42);
    if (s === 0 || s === 6 || s === 10) tone(mtof(root), t, 0.32, 'triangle', 0.4, music);
    if (s === 4 || s === 12) noise(t, 0.12, 0.18, 1800, 0.8, music);
    if (s % 4 === 2 || (intense && s % 2 === 1)) noise(t, 0.04, 0.12, 8000, 1, music, 'highpass');
    if (s % 2 === 0) {
      const n = mel[bar][s / 2];
      if (n > 0) { tone(mtof(n), t, 0.28, 'triangle', 0.13, music); tone(mtof(n + 12), t, 0.12, 'sine', 0.04, music); }
    }
    if (s === 0) { [0, 7, 12].forEach((iv) => tone(mtof(root + 12 + iv), t, 1.8, 'sine', 0.035, music)); }
  }

  const api = {
    unlock: init,
    get muted() { return muted; },
    toggle() {
      muted = !muted; localStorage.setItem('yxx_mute', muted ? '1' : '0');
      init();
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05);
      return muted;
    },
    setIntense(v) { intense = v; },
    chip() { if (!ctx) return; const t = ctx.currentTime; tone(1900, t, 0.06, 'sine', 0.22); tone(2700, t + 0.02, 0.05, 'sine', 0.12); noise(t, 0.03, 0.1, 5000, 2); },
    confirm() { if (!ctx) return; const t = ctx.currentTime; tone(880, t, 0.12, 'triangle', 0.25); tone(1320, t + 0.07, 0.18, 'triangle', 0.22); },
    tick(hi) { if (!ctx) return; tone(hi ? 1400 : 1000, ctx.currentTime, 0.07, 'square', 0.07); },
    lock() {
      if (!ctx) return; const t = ctx.currentTime;
      noise(t, 0.6, 0.35, 400, 1, sfx, 'bandpass', 4000);
      tone(300, t, 0.35, 'sawtooth', 0.08, sfx, 900);
      tone(600, t + 0.3, 0.25, 'square', 0.08);
    },
    roll(dur) {
      if (!ctx) return; const t0 = ctx.currentTime;
      // 骰子在碗里碰撞的咔嗒声，越来越稀
      let t = 0;
      while (t < dur) {
        const p = t / dur;
        noise(t0 + t, 0.035, 0.45 * (1 - p * 0.5), 2200 + Math.random() * 3000, 5);
        tone(500 + Math.random() * 900, t0 + t, 0.045, 'square', 0.035);
        t += 0.025 + Math.random() * 0.05 + p * p * 0.12;
      }
      noise(t0, dur, 0.25, 300, 0.7, sfx, 'bandpass', 2500); // 呼啸
      tone(180, t0, dur, 'sawtooth', 0.05, sfx, 720);          // 紧张感上升音
    },
    impact() {
      if (!ctx) return; const t = ctx.currentTime;
      tone(150, t, 0.45, 'sine', 0.8, sfx, 38);
      noise(t, 0.25, 0.6, 500, 0.8, sfx, 'lowpass');
      noise(t, 0.9, 0.18, 7000, 0.5, sfx, 'highpass');
    },
    win(big) {
      if (!ctx) return; const t = ctx.currentTime;
      const notes = big ? [72, 76, 79, 84, 88, 91, 96] : [72, 76, 79, 84, 88];
      notes.forEach((n, i) => { tone(mtof(n), t + i * 0.08, 0.35, 'triangle', 0.22); tone(mtof(n + 12), t + i * 0.08, 0.2, 'sine', 0.06); });
      for (let i = 0; i < 14; i++) tone(2500 + Math.random() * 2500, t + 0.3 + i * 0.05, 0.08, 'sine', 0.07);
    },
    lose() { if (!ctx) return; const t = ctx.currentTime; tone(392, t, 0.25, 'triangle', 0.15); tone(330, t + 0.18, 0.4, 'triangle', 0.13); },
  };
  return api;
})();
