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
  }
  let unlocked = false, duckLevel = 1;

  function makeBgm(name) {
    const a = new Audio(URLS[name]);
    a.preload = 'auto';
    a.loop = true;
    a.playsInline = true;
    a.setAttribute('playsinline', '');
    a.setAttribute('webkit-playsinline', '');
    a.crossOrigin = 'anonymous';
    a.volume = 0;
    try { a.load(); } catch (_) {}
    return a;
  }
  const bgmEl = { login: makeBgm('login'), lobby: makeBgm('lobby') };
  Object.keys(bgmEl).forEach((n) => {
    const a = bgmEl[n];
    const retry = () => { if (!muted && want && want.name === n && unlocked) kickEl(a, volFor(n)); };
    a.addEventListener('canplay', retry);
    a.addEventListener('loadeddata', retry);
  });

  function volFor(name) { return muted ? 0 : (name === 'login' ? 0.6 : 0.34) * duckLevel; }
  function currentEl() { return (want && bgmEl[want.name]) || bgmEl.login; }
  function applyVol() { Object.keys(bgmEl).forEach((n) => { bgmEl[n].volume = (want && want.name === n) ? volFor(n) : 0; }); }
  function kickEl(a, vol) {
    if (!a) return;
    try { a.muted = false; a.volume = vol; } catch (_) {}
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  }
  function elementPlaying() { const a = currentEl(); return !!(a && !a.paused && !a.ended); }
  function isPlaying() { return elementPlaying() || (!!ctx && ctx.state === 'running' && !!track); }

  // Prime every BGM element during a gesture so later track switches need no second unlock.
  function primeAll() {
    Object.keys(bgmEl).forEach((n) => {
      const a = bgmEl[n];
      if (want && want.name === n && !muted) { kickEl(a, volFor(n)); return; }
      const prev = a.volume;
      a.volume = 0;
      const p = a.play();
      if (p && p.then) p.then(() => { try { a.pause(); a.currentTime = 0; } catch (_) {} a.volume = prev; }).catch(() => {});
      else { try { a.pause(); } catch (_) {} a.volume = prev; }
    });
  }

  function unlock() {
    init();
    if (ctx) {
      const p = ctx.resume();
      if (p && p.then) p.then(() => { unlocked = ctx.state === 'running'; if (unlocked && !elementPlaying() && want) startTrack(); }).catch(() => {});
      if (ctx.state === 'running') unlocked = true;
    }
    if (!want) want = { name: 'login', vol: 0.6 };
    primeAll();
    if (!muted) kickEl(currentEl(), volFor(want.name));
    if (elementPlaying() || (ctx && ctx.state === 'running')) unlocked = true;
    return isPlaying();
  }
  function tryResume() {
    const ok = unlock();
    return Promise.resolve(ok);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (ctx) ctx.suspend(); return; }
    if (unlocked && !muted) { if (ctx) ctx.resume(); kickEl(currentEl(), volFor(want ? want.name : 'login')); }
  });

  const GESTURES = ['touchstart', 'touchend', 'pointerdown', 'click', 'keydown'];
  const onGesture = () => { if (!muted && !isPlaying()) unlock(); };
  GESTURES.forEach((ev) => {
    document.addEventListener(ev, onGesture, { capture: true, passive: true });
    window.addEventListener(ev, onGesture, { capture: true, passive: true });
  });
  // Page-load autoplay attempt (may succeed on Android/Chrome with media engagement).
  setTimeout(() => { if (!muted) unlock(); }, 0);

  function startTrack() {
    if (elementPlaying()) return;
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
  const duck = (l, tc = 0.2) => { duckLevel = l; if (duckG && ctx) duckG.gain.setTargetAtTime(l, ctx.currentTime, tc); applyVol(); };

  return {
    init, tryResume, unlock,
    get muted() { return muted; }, get running() { return isPlaying(); },
    get el() { return currentEl(); }, get ctx() { return ctx; },
    onState(fn) { onState = fn; },
    music(name) {
      const prev = want && want.name;
      want = { name, vol: name === 'login' ? 0.6 : 0.34 };
      init(); dec(name);
      const next = bgmEl[name], old = prev && prev !== name ? bgmEl[prev] : null;
      applyVol();
      if (!muted) kickEl(next, 0);
      if (old && next && old !== next) {
        const from = old.volume, to = volFor(name), t0 = performance.now();
        (function fade() {
          const k = Math.min(1, (performance.now() - t0) / 700);
          try { next.volume = to * k; if (old) old.volume = from * (1 - k); } catch (_) {}
          if (k < 1) requestAnimationFrame(fade);
          else if (old) { try { old.pause(); old.currentTime = 0; } catch (_) {} }
        })();
      } else applyVol();
      // Buffer-source BGM only as fallback if the element is not playing after unlock
      if (unlocked && !elementPlaying()) startTrack();
    },
    toggle() {
      muted = !muted; localStorage.setItem('yxx_mute', muted ? '1' : '0');
      if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.95, ctx.currentTime, 0.06);
      applyVol();
      if (!muted) unlock();
      else { try { currentEl().pause(); } catch (_) {} }
      return muted;
    },
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
    reveal() { duck(0.3, 0.1); play('reveal', { v: 0.9 }); setTimeout(() => duck(1, 1.2), 4500); },
    win(big) {
      if (big) { play('bigwin', { v: 1, at: 0.5 }); for (let i = 0; i < 30; i++) play(pick(['handleCoins', 'handleCoins2', 'chipsCollide1', 'chipsCollide2']), { v: rnd(0.3, 0.65), at: 1 + Math.pow(Math.random(), 0.8) * 3.4, rate: rnd(0.95, 1.45), pan: rnd(-0.8, 0.8) }); }
      else { play('win', { v: 1, at: 0.45 }); for (let i = 0; i < 6; i++) play(pick(['handleCoins2', 'chipsCollide1']), { v: rnd(0.35, 0.6), at: 0.8 + i * 0.12, rate: rnd(1, 1.4) }); }
    },
    lose() { play('lose', { v: 0.8, at: 0.55 }); },
    // —— 拉绳放骰 ——
    grab() { play('tap', { v: 0.45, rate: 0.7 }); },
    notch(lv) { play('tick', { v: lv === 2 ? 0.8 : 0.5, rate: lv === 2 ? 0.75 : 1.1 }); if (lv === 2) play('chipsHandle1', { v: 0.4, rate: 0.7 }); },
    ropeBack() { play('chipsCollide1', { v: 0.3, rate: 0.6 }); },
    release() { duck(0.45, 0.15); play('lock', { v: 0.9, rate: 1.15 }); play('hit', { v: 0.35, rate: 1.6, at: 0.02 }); },
    rollDie(pan) { play(pick(['dieShuffle1', 'dieShuffle2']), { v: 0.6, pan, rate: rnd(1, 1.2) }); play(pick(['diceThrow1', 'diceThrow2']), { v: 0.45, pan, at: 0.35, rate: rnd(0.95, 1.15) }); },
    bounce(st, pan) {
      play('hit', { v: Math.min(1, 0.3 + st * 0.7), pan, rate: rnd(0.85, 1.1) });
      play(pick(['dieThrow1', 'dieThrow2', 'dieThrow3']), { v: Math.min(1, 0.25 + st * 0.75), pan, rate: rnd(0.9, 1.1) });
      if (st >= 1) play('land', { v: 0.55, pan });
    },
  };
})();
