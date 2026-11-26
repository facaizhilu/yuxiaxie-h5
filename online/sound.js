/* v2 音频引擎：登录页寺庙氛围曲 / 大厅科幻电子曲 + 科幻音效（全部预加载，Web Audio 混音）
 * 资源许可见 LICENSES/AUDIO-CREDITS.md */
window.SND = (function () {
  const V2 = ['login', 'lobby', 'chip', 'tap', 'confirm', 'tick', 'riser', 'lock', 'spin', 'hit', 'land', 'reveal', 'win', 'bigwin', 'lose', 'start', 'hover'];
  const KEN = ['dieShuffle1', 'dieShuffle2', 'diceThrow1', 'diceThrow2', 'dieThrow1', 'dieThrow2', 'dieThrow3', 'chipLay1', 'chipLay2', 'chipLay3', 'chipsStack1', 'chipsStack3', 'chipsCollide1', 'chipsCollide2', 'chipsHandle1', 'handleCoins', 'handleCoins2'];
  const URLS = {}; V2.forEach((n) => (URLS[n] = '/audio/v2/' + n + '.mp3')); KEN.forEach((n) => (URLS[n] = '/audio/kenney/' + n + '.mp3'));
  const PRIORITY = ['login', 'tap', 'hover'];
  let muted = localStorage.getItem('yxx_mute') === '1';
  let ctx, master, musicBus, duckG, sfx, track = null, want = null, onState = () => {};
  const bufs = {}, raw = {};
  const rnd = (a, b) => a + Math.random() * (b - a), pick = (a) => a[Math.floor(Math.random() * a.length)];

  const load = (k) => fetch(URLS[k]).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => { raw[k] = b; if (ctx) return dec(k); }).catch(() => {});
  const first = Promise.all(PRIORITY.map(load));
  first.then(() => Promise.all(Object.keys(URLS).filter((k) => !PRIORITY.includes(k)).map(load)));
  function dec(k) {
    if (!raw[k] || bufs[k] !== undefined) return Promise.resolve();
    bufs[k] = null;
    return new Promise((res) => { try { const p = ctx.decodeAudioData(raw[k].slice(0), (b) => { bufs[k] = b; res(); if (want && want.name === k) startTrack(); }, () => res()); if (p && p.catch) p.catch(() => res()); } catch (_) { res(); } });
  }
  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC({ latencyHint: 'interactive' });
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.95; master.connect(comp); comp.connect(ctx.destination);
    duckG = ctx.createGain(); duckG.connect(master); musicBus = ctx.createGain(); musicBus.connect(duckG);
    sfx = ctx.createGain(); sfx.gain.value = 0.9; sfx.connect(master);
    ctx.onstatechange = () => onState(ctx.state);
    Object.keys(raw).forEach(dec);
    document.addEventListener('visibilitychange', () => { if (document.hidden) ctx.suspend(); else if (unlocked) ctx.resume(); });
  }
  let unlocked = false;
  function tryResume() { init(); if (!ctx) return Promise.resolve(false); return ctx.resume().then(() => { unlocked = ctx.state === 'running'; return unlocked; }).catch(() => false); }

  function startTrack() {
    if (!ctx || !want || !bufs[want.name]) return;
    if (track && track.name === want.name) return;
    const now = ctx.currentTime;
    if (track) { const old = track; old.g.gain.setTargetAtTime(0.0001, now, 0.4); setTimeout(() => { try { old.src.stop(); } catch (_) {} }, 2500); }
    const src = ctx.createBufferSource(); src.buffer = bufs[want.name]; src.loop = true;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(want.vol, now + 1.6);
    src.connect(g); g.connect(musicBus); src.start();
    track = { name: want.name, src, g };
  }
  function play(n, o = {}) {
    if (!ctx || !bufs[n] || ctx.state !== 'running') return;
    const s = ctx.createBufferSource(); s.buffer = bufs[n]; s.playbackRate.value = o.rate || 1;
    const g = ctx.createGain(); g.gain.value = o.v == null ? 1 : o.v; s.connect(g);
    if (o.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = o.pan; g.connect(p); p.connect(sfx); } else g.connect(sfx);
    s.start(ctx.currentTime + (o.at || 0), o.offset || 0);
  }
  const duck = (l, tc = 0.2) => { if (duckG) duckG.gain.setTargetAtTime(l, ctx.currentTime, tc); };

  return {
    init, tryResume,
    get muted() { return muted; }, get running() { return !!ctx && ctx.state === 'running'; },
    onState(fn) { onState = fn; },
    music(name) { want = { name, vol: name === 'login' ? 0.6 : 0.34 }; init(); dec(name); startTrack(); },
    toggle() { muted = !muted; localStorage.setItem('yxx_mute', muted ? '1' : '0'); tryResume(); if (master) master.gain.setTargetAtTime(muted ? 0 : 0.95, ctx.currentTime, 0.06); return muted; },
    phase(p) { if (ctx) duck({ bet: 1, lock: 0.35, roll: 0.22, show: 0.32 }[p] || 1, p === 'bet' ? 1 : 0.12); },
    tap() { play('tap', { v: 0.7 }); }, hover() { play('hover', { v: 0.35 }); },
    chip() { play('chip', { v: 0.7, rate: rnd(0.95, 1.08) }); play(pick(['chipLay1', 'chipLay2', 'chipLay3']), { v: 0.6, rate: rnd(1, 1.15) }); },
    confirm() { play('confirm', { v: 0.8 }); play(pick(['chipsStack1', 'chipsStack3']), { v: 0.75 }); },
    clear() { play('chipsHandle1', { v: 0.6, rate: 1.1 }); play('tap', { v: 0.5, rate: 0.8 }); },
    repeat() { play(pick(['chipsCollide1', 'chipsCollide2']), { v: 0.7 }); play('tap', { v: 0.5, rate: 1.2 }); },
    start() { play('start', { v: 0.7 }); },
    countdown(left) {
      if (!ctx) return; const el = Math.max(0, 3 - left); duck(0.55, 0.3);
      play('riser', { v: 0.75, offset: el });
      [0, 0.5, 1, 1.5, 2, 2.25, 2.5, 2.65, 2.8, 2.9].forEach((t) => { if (t >= el - 0.02) play('tick', { v: 0.5 + t / 6, rate: 0.9 + t / 3 * 0.8, at: Math.max(0, t - el) }); });
    },
    lock() { play('lock', { v: 1 }); play(pick(['dieShuffle1', 'dieShuffle2']), { v: 0.55, at: 0.15, rate: 1.1 }); },
    roll() {
      play('spin', { v: 0.55 }); play('diceThrow1', { v: 0.5, at: 0.02 });
      // 摇骰“哗啦哗啦”：约 4 秒的密集骰子碰撞声
      for (let k = 0; k < 11; k++) play(pick(['dieShuffle1', 'dieShuffle2', 'diceThrow1', 'diceThrow2', 'dieThrow1']), { v: rnd(0.3, 0.6), at: 0.25 + k * 0.33 + rnd(0, 0.12), rate: rnd(0.9, 1.25), pan: rnd(-0.7, 0.7) });
    },
    hit(strength, pan) { play('hit', { v: Math.min(1, 0.25 + strength * 0.75), pan, rate: rnd(0.9, 1.15) }); play(pick(['dieThrow1', 'dieThrow2', 'dieThrow3']), { v: Math.min(0.8, 0.2 + strength * 0.6), pan, rate: rnd(0.95, 1.1) }); },
    cycle(i, k) { const n = performance.now(); if (n - (this._ct || 0) < 70) return; this._ct = n; play('tick', { v: 0.28, rate: 1.25 + i * 0.22 + (k % 3) * 0.05, pan: (i - 1) * 0.5 }); },
    stop(i, pan) {
      play('hit', { v: 1, pan, rate: 0.78 + i * 0.07 });
      play(pick(['dieThrow1', 'dieThrow2', 'dieThrow3']), { v: 1, pan, rate: 0.9 + i * 0.05 });
      play('diceThrow2', { v: 0.55, at: 0.03, pan, rate: 1.1 });
    },
    land() { play('land', { v: 1 }); play('dieThrow1', { v: 0.9, rate: 0.8 }); play('diceThrow1', { v: 0.7, at: 0.04, rate: 0.9 }); },
    reveal() { duck(0.3, 0.1); play('reveal', { v: 0.9 }); },
    win(big) {
      if (big) { play('bigwin', { v: 1, at: 0.5 }); for (let i = 0; i < 30; i++) play(pick(['handleCoins', 'handleCoins2', 'chipsCollide1', 'chipsCollide2']), { v: rnd(0.3, 0.65), at: 1 + Math.pow(Math.random(), 0.8) * 3.4, rate: rnd(0.95, 1.45), pan: rnd(-0.8, 0.8) }); }
      else { play('win', { v: 1, at: 0.45 }); for (let i = 0; i < 6; i++) play(pick(['handleCoins2', 'chipsCollide1']), { v: rnd(0.35, 0.6), at: 0.8 + i * 0.12, rate: rnd(1, 1.4) }); }
    },
    lose() { play('lose', { v: 0.8, at: 0.55 }); },
  };
})();
