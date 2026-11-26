/* 音频引擎：预加载 mp3（原创合成音乐/音效 + Kenney CC0 采样），Web Audio 混音。
 * 资源与版权见 LICENSES/AUDIO-CREDITS.md */
window.Sound = (function () {
  const BASE = 'audio/';
  const NAMES = ['bgm', 'gong', 'riser', 'tick', 'drumroll', 'impact', 'thump', 'reveal', 'bigwin', 'smallwin', 'lose', 'ding', 'start'];
  const KEN = ['diceThrow1', 'diceThrow2', 'diceThrow3', 'dieShuffle1', 'dieShuffle2', 'dieShuffle3', 'dieThrow1', 'dieThrow2', 'dieThrow3', 'dieGrab1',
    'chipLay1', 'chipLay2', 'chipLay3', 'chipsCollide1', 'chipsCollide2', 'chipsHandle1', 'chipsHandle2', 'chipsStack1', 'chipsStack3', 'chipsStack5',
    'handleCoins', 'handleCoins2', 'metalClick', 'click1', 'click3', 'switch2'];
  const URLS = {}; NAMES.forEach((n) => (URLS[n] = BASE + n + '.mp3')); KEN.forEach((n) => (URLS[n] = BASE + 'kenney/' + n + '.mp3'));

  let muted = localStorage.getItem('yxx_mute') === '1';
  let ctx, master, musicG, duckG, sfxG, bgmSrc, ready = false, started = false;
  const bufs = {}, raw = {};
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // 页面一加载就开始下载（不需要用户手势）
  const fetched = Promise.all(Object.keys(URLS).map((k) =>
    fetch(URLS[k]).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => { raw[k] = b; }).catch(() => {})));

  const decode = (ab) => new Promise((res) => { try { const p = ctx.decodeAudioData(ab.slice(0), res, () => res(null)); if (p && p.catch) p.catch(() => res(null)); } catch (_) { res(null); } });

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC({ latencyHint: 'interactive' });
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 10; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(comp); comp.connect(ctx.destination);
    duckG = ctx.createGain(); duckG.connect(master);
    musicG = ctx.createGain(); musicG.gain.value = 0.3; musicG.connect(duckG);
    sfxG = ctx.createGain(); sfxG.gain.value = 0.85; sfxG.connect(master);
    document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else ctx.resume(); });
    fetched.then(async () => {
      await Promise.all(Object.keys(raw).map(async (k) => { if (raw[k]) bufs[k] = await decode(raw[k]); }));
      ready = true; startBgm();
    });
  }

  function startBgm() {
    if (!ready || started || !bufs.bgm) return; started = true;
    bgmSrc = ctx.createBufferSource(); bgmSrc.buffer = bufs.bgm; bgmSrc.loop = true;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.linearRampToValueAtTime(1, ctx.currentTime + 2);
    bgmSrc.connect(g); g.connect(musicG); bgmSrc.start();
  }

  function play(name, o = {}) {
    if (!ctx || !bufs[name]) return null;
    const s = ctx.createBufferSource(); s.buffer = bufs[name]; s.playbackRate.value = o.rate || 1;
    const g = ctx.createGain(); g.gain.value = o.v == null ? 1 : o.v;
    let node = g;
    if (o.pan) { const p = ctx.createStereoPanner(); p.pan.value = o.pan; g.connect(p); node = p; }
    s.connect(g); node.connect(o.bus || sfxG);
    s.start(ctx.currentTime + (o.at || 0), o.offset || 0);
    return s;
  }
  function duck(level, tc = 0.25) { if (duckG) duckG.gain.setTargetAtTime(level, ctx.currentTime, tc); }

  const api = {
    unlock: init,
    get muted() { return muted; },
    toggle() {
      muted = !muted; localStorage.setItem('yxx_mute', muted ? '1' : '0'); init();
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05);
      if (!muted) play('switch2', { v: 0.8 });
      return muted;
    },
    setIntense() {}, impact() {},
    stats() { return { ctx: ctx && ctx.state, loaded: Object.keys(bufs).filter((k) => bufs[k]).length, total: Object.keys(URLS).length, ready, bgm: started }; },
    phase(p) { if (!ctx) return; duck({ bet: 1, lock: 0.3, roll: 0.18, show: 0.3 }[p] || 1, p === 'bet' ? 1.2 : 0.15); },
    roundStart() { play('start', { v: 0.7 }); },
    chip() { play(pick(['chipLay1', 'chipLay2', 'chipLay3']), { v: 0.9, rate: rnd(0.95, 1.1) }); },
    confirm() { play(pick(['chipsStack1', 'chipsStack3', 'chipsStack5']), { v: 0.9 }); play('ding', { v: 0.55, at: 0.06 }); },
    clear() { play('chipsHandle2', { v: 0.7, rate: 1.1 }); },
    repeat() { play(pick(['chipsCollide1', 'chipsCollide2']), { v: 0.85 }); },
    tap() { play('click1', { v: 0.8, rate: rnd(0.95, 1.05) }); },
    error() { play('metalClick', { v: 0.5, rate: 0.7 }); },
    // 最后 3 秒：上升音效 + 越来越快的滴答 + BGM 压低
    countdown(leftSec) {
      if (!ctx) return;
      const el = Math.max(0, 3 - leftSec);
      duck(0.55, 0.3);
      play('riser', { v: 0.85, offset: el });
      [0, 0.5, 1, 1.5, 2, 2.25, 2.5, 2.65, 2.8, 2.9].forEach((t) => {
        if (t >= el - 0.02) play('tick', { v: 0.55 + t / 3 * 0.45, rate: 0.9 + t / 3 * 0.9, at: Math.max(0, t - el) });
      });
    },
    // 封盘：锣 + 骰盅里摇骰子
    lock() {
      if (!ctx) return;
      duck(0.3, 0.1);
      play('gong', { v: 1 });
      play('dieGrab1', { v: 0.9, at: 0.05 });
      play(pick(['dieShuffle1', 'dieShuffle2', 'dieShuffle3']), { v: 1, at: 0.2, rate: 1.0 });
      play(pick(['dieShuffle1', 'dieShuffle2', 'dieShuffle3']), { v: 0.6, at: 0.6, rate: 1.18, pan: 0.3 });
    },
    // 开奖：鼓点渐强 + 骰子翻滚碰撞 + 三颗骰子依次落地 + 重击
    roll() {
      if (!ctx) return;
      duck(0.18, 0.1);
      play('drumroll', { v: 0.9 });
      play('diceThrow2', { v: 0.9, at: 0.05 });
      [[0.9, 'diceThrow1', 0.7, -0.4], [1.5, 'dieThrow2', 0.8, 0.4], [1.95, 'diceThrow3', 0.8, -0.2], [2.3, 'dieThrow3', 0.9, 0.2]]
        .forEach(([t, n, v, pan]) => play(n, { v, at: t, pan, rate: rnd(0.95, 1.1) }));
      [[2.5, -0.5, 'dieThrow1'], [2.6, 0, 'dieThrow2'], [2.68, 0.5, 'diceThrow1']].forEach(([t, pan, n]) => {
        play('thump', { v: 0.9, at: t, pan }); play(n, { v: 0.9, at: t, pan, rate: rnd(0.92, 1.08) });
      });
      play('impact', { v: 1, at: 2.6 });
    },
    reveal() { if (!ctx) return; duck(0.3, 0.1); play('reveal', { v: 0.95 }); },
    win(big) {
      if (!ctx) return;
      if (big) {
        play('bigwin', { v: 1, at: 0.6 });
        // 金币雨
        for (let i = 0; i < 34; i++) {
          const t = 1.2 + Math.pow(Math.random(), 0.8) * 3.6;
          play(pick(['handleCoins', 'handleCoins2', 'chipsCollide1', 'chipsCollide2', 'chipsHandle1']), { v: rnd(0.35, 0.75), at: t, rate: rnd(0.9, 1.45), pan: rnd(-0.8, 0.8) });
        }
      } else {
        play('smallwin', { v: 1, at: 0.5 });
        for (let i = 0; i < 6; i++) play(pick(['handleCoins2', 'chipsCollide1', 'chipsCollide2']), { v: rnd(0.4, 0.7), at: 0.9 + i * 0.12, rate: rnd(1, 1.4), pan: rnd(-0.5, 0.5) });
      }
    },
    lose() { play('lose', { v: 0.85, at: 0.6 }); },
  };
  return api;
})();
