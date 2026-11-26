(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const SYMS = window.SYMBOLS;
  const CHIPS = [
    { v: 10, c: '#2e8b57' }, { v: 50, c: '#1f6fb2' }, { v: 100, c: '#c9971f' },
    { v: 500, c: '#7d3aa8' }, { v: 1000, c: '#c0392b' },
  ];
  const T = { bet: 15000, lock: 1500, roll: 3300, show: 5000 };
  const START_BAL = 10000;
  const rnd = (n) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const svg = (id) => `<svg viewBox="0 0 100 100"><use href="#s-${id}"/></svg>`;
  const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `00:${String(s).padStart(2, '0')}`; };

  const S = {
    round: +(localStorage.getItem('yxx_round') || 128),
    phase: 'idle', endAt: 0,
    balance: +(localStorage.getItem('yxx_bal') ?? START_BAL),
    chip: 100,
    pending: {}, mine: {}, lastBets: JSON.parse(localStorage.getItem('yxx_last') || '{}'),
    pools: {}, robotBets: [],
    history: JSON.parse(localStorage.getItem('yxx_hist') || '[]'),
    online: 2400 + rnd(120),
    dice: [], lastTick: -1,
  };
  if (!(S.balance >= 0)) S.balance = START_BAL;
  if (!S.history.length) for (let i = 0; i < 8; i++) S.history.push([rnd(6), rnd(6), rnd(6)]);

  const ROBOTS = ['阿强', '小美', 'LuckyKing', '金龙', 'Somchai', '财神到', '海风', '老王', 'Noy', '阿杰', '发财哥', 'Mali', '小鱼儿',
    'Bounmy', '星辰', 'Kham', '大头', 'Lina', '阿福', 'Tony88', '旺旺', 'Vong', '锦鲤附体', 'Ploy', '一路发', 'Sengdao', '豹子头', 'Ken', '好运来', 'Nana'];

  // ---------------- 构建界面 ----------------
  const board = $('#board');
  board.innerHTML = SYMS.map((s, i) => `
    <button class="tile" data-i="${i}">
      <div class="tile-art">${svg(s.id)}</div>
      <div class="tile-info">
        <div class="tile-name">${s.name}</div>
        <div class="tile-pool" id="pool${i}">0</div>
        <div class="tile-mine"><i class="coin"></i><span id="mine${i}">0</span><em id="pend${i}"></em></div>
      </div>
      <div class="tile-stack" id="stack${i}"></div>
      <div class="tile-badge" id="badge${i}"></div>
    </button>`).join('');
  const tiles = [...board.querySelectorAll('.tile')];

  $('#chips').innerHTML = CHIPS.map((c) => `<button class="chip${c.v === S.chip ? ' sel' : ''}" data-v="${c.v}" style="--c:${c.c}">${c.v}</button>`).join('');

  // 骰子：六面全部是图案，每颗骰子的排列不同
  const FACE_POS = [
    { t: 'rotateY(0deg)', x: 0, y: 0 },
    { t: 'rotateY(90deg)', x: 0, y: -90 },
    { t: 'rotateY(180deg)', x: 0, y: 180 },
    { t: 'rotateY(-90deg)', x: 0, y: 90 },
    { t: 'rotateX(90deg)', x: -90, y: 0 },
    { t: 'rotateX(-90deg)', x: 90, y: 0 },
  ];
  const LAYOUTS = [[0, 1, 2, 3, 4, 5], [2, 4, 0, 5, 1, 3], [5, 3, 1, 0, 2, 4]];
  document.querySelectorAll('.die-wrap').forEach((w, d) => {
    const cube = w.querySelector('.cube');
    const layout = LAYOUTS[d];
    cube.innerHTML = layout.map((sym, p) =>
      `<div class="face" style="transform:${FACE_POS[p].t} translateZ(calc(var(--cube) / 2))">${svg(SYMS[sym].id)}</div>`).join('');
    S.dice.push({ wrap: w, cube, layout, rx: 0, ry: 0, rz: 0 });
  });

  function setDie(d, sym, instant) {
    const die = S.dice[d];
    const pos = die.layout.indexOf(sym);
    const f = FACE_POS[pos];
    const turn = (cur, extra) => (Math.floor(cur / 360) + extra) * 360;
    if (instant) { die.rx = f.x; die.ry = f.y; die.rz = 0; }
    else {
      die.rx = turn(die.rx, 3 + rnd(2)) + f.x;
      die.ry = turn(die.ry, 2 + rnd(2)) + f.y;
      die.rz = turn(die.rz, 1 + rnd(2));
    }
    die.cube.classList.toggle('instant', !!instant);
    die.cube.style.transform = `rotateX(${die.rx}deg) rotateY(${die.ry}deg) rotateZ(${die.rz}deg)`;
  }
  S.history[0].forEach((s, d) => setDie(d, s, true));

  // ---------------- 渲染 ----------------
  function renderBalance(bump) {
    $('#balance').textContent = fmt(S.balance);
    if (bump) { const b = $('.balance'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
    localStorage.setItem('yxx_bal', S.balance);
  }
  function renderTile(i, popPool) {
    $('#pool' + i).textContent = fmt(S.pools[i] || 0);
    if (popPool) { const p = $('#pool' + i); p.classList.remove('pop'); void p.offsetWidth; p.classList.add('pop'); }
    $('#mine' + i).textContent = fmt(S.mine[i] || 0);
    $('#pend' + i).textContent = S.pending[i] ? `+${fmt(S.pending[i])} 待确认` : '';
    tiles[i].classList.toggle('has-bet', !!(S.mine[i] || S.pending[i]));
    const total = (S.mine[i] || 0) + (S.pending[i] || 0);
    const st = $('#stack' + i);
    let html = '', left = total, k = 0;
    for (let c = CHIPS.length - 1; c >= 0 && k < 5; c--) while (left >= CHIPS[c].v && k < 5) { html += `<i style="bottom:${k * 4}px;background:${CHIPS[c].c}"></i>`; left -= CHIPS[c].v; k++; }
    st.innerHTML = html;
  }
  function renderAll() { SYMS.forEach((_, i) => renderTile(i)); renderBalance(); updateOkBtn(); }
  function renderHistory() {
    $('#history').innerHTML = S.history.slice(0, 12).map((r) => `<div class="h-item">${r.map((s) => svg(SYMS[s].id)).join('')}</div>`).join('');
    localStorage.setItem('yxx_hist', JSON.stringify(S.history.slice(0, 20)));
  }
  function updateOkBtn() { $('#btnOk').classList.toggle('ready', sum(S.pending) > 0 && S.phase === 'bet'); }

  const feed = $('#feed');
  function pushFeed(html, cls) {
    const li = document.createElement('li');
    if (cls) li.className = cls;
    li.innerHTML = html;
    feed.prepend(li);
    while (feed.children.length > 3) feed.lastChild.remove();
  }

  let toastT;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1600);
  }
  function retrigger(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  // ---------------- 特效：火花粒子 ----------------
  const cvs = $('#fx'), g = cvs.getContext('2d');
  let parts = [], fxRun = false;
  function sizeCanvas() { const r = cvs.getBoundingClientRect(), dpr = window.devicePixelRatio || 1; cvs.width = r.width * dpr; cvs.height = r.height * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); }
  window.addEventListener('resize', sizeCanvas);
  function sparks(x, y, n, spread) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * (spread || 6);
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2.5, life: 1, s: 1 + Math.random() * 2.5, h: 38 + Math.random() * 18 });
    }
    if (!fxRun) { fxRun = true; requestAnimationFrame(fxLoop); }
  }
  function fxLoop() {
    const r = cvs.getBoundingClientRect();
    g.clearRect(0, 0, r.width, r.height);
    g.globalCompositeOperation = 'lighter';
    parts = parts.filter((p) => p.life > 0);
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.16; p.vx *= 0.985; p.life -= 0.016;
      g.fillStyle = `hsla(${p.h},100%,${55 + p.life * 30}%,${p.life})`;
      g.beginPath(); g.arc(p.x, p.y, p.s * (0.5 + p.life), 0, Math.PI * 2); g.fill();
      g.strokeStyle = `hsla(${p.h},100%,70%,${p.life * 0.5})`; g.lineWidth = p.s * 0.6;
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 3, p.y - p.vy * 3); g.stroke();
    }
    if (parts.length) requestAnimationFrame(fxLoop); else { fxRun = false; g.clearRect(0, 0, r.width, r.height); }
  }

  // ---------------- 筹码飞行 ----------------
  function flyChip(fromEl, toEl, color) {
    const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'fly-chip'; el.style.background = color;
    el.style.left = a.left + a.width / 2 - 13 + 'px'; el.style.top = a.top + a.height / 2 - 13 + 'px';
    document.body.appendChild(el);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2) + (Math.random() * 30 - 15);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2) + (Math.random() * 20 - 10);
    el.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx / 2}px,${dy / 2 - 40}px) scale(1.2)`, offset: 0.5 }, { transform: `translate(${dx}px,${dy}px) scale(.7)`, opacity: 0.2 }],
      { duration: 420, easing: 'ease-in' }).onfinish = () => el.remove();
  }

  // ---------------- 玩家操作 ----------------
  $('#chips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    S.chip = +b.dataset.v;
    document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('sel', c === b));
    Sound.tap();
  });
  board.addEventListener('click', (e) => {
    const t = e.target.closest('.tile'); if (!t) return;
    if (S.phase !== 'bet') return toast('已封盘，请等待下一回合');
    const i = +t.dataset.i;
    if (sum(S.pending) + S.chip > S.balance) return toast('余额不足');
    S.pending[i] = (S.pending[i] || 0) + S.chip;
    flyChip(document.querySelector('.chip.sel'), t, CHIPS.find((c) => c.v === S.chip).c);
    Sound.chip(); renderTile(i); updateOkBtn();
  });
  $('#btnClear').addEventListener('click', () => {
    if (!sum(S.pending)) return toast('没有待确认的下注');
    S.pending = {}; renderAll(); Sound.clear();
  });
  $('#btnRepeat').addEventListener('click', () => {
    if (S.phase !== 'bet') return toast('已封盘，请等待下一回合');
    if (!sum(S.lastBets)) return toast('上一回合没有下注');
    if (sum(S.lastBets) + sum(S.pending) > S.balance) return toast('余额不足');
    for (const k in S.lastBets) S.pending[k] = (S.pending[k] || 0) + S.lastBets[k];
    renderAll(); Sound.repeat();
  });
  $('#btnOk').addEventListener('click', () => {
    if (S.phase !== 'bet') return toast('已封盘，请等待下一回合');
    const tot = sum(S.pending);
    if (!tot) return toast('请先选择筹码并点击图案下注');
    if (tot > S.balance) return toast('余额不足');
    S.balance -= tot;
    for (const k in S.pending) {
      S.mine[k] = (S.mine[k] || 0) + S.pending[k];
      S.pools[k] = (S.pools[k] || 0) + S.pending[k];
      pushFeed(`<b>我</b> 押 ${SYMS[k].name} <b>${fmt(S.pending[k])}</b>`, 'me');
      renderTile(k, true);
    }
    S.pending = {};
    renderAll(); renderBalance(true); Sound.confirm(); toast(`下注成功 ${fmt(tot)}`);
  });
  $('#musicBtn').addEventListener('click', () => { const m = Sound.toggle(); $('#musicBtn').classList.toggle('off', m); });
  $('#musicBtn').classList.toggle('off', Sound.muted);

  // ---------------- 机器人 ----------------
  let robotT;
  function robotBet() {
    if (S.phase !== 'bet') return;
    const name = ROBOTS[rnd(ROBOTS.length)];
    const w = rnd(100);
    const base = w < 28 ? 10 : w < 58 ? 50 : w < 82 ? 100 : w < 96 ? 500 : 1000;
    const amt = base * (1 + (rnd(10) < 3 ? rnd(4) : 0));
    const i = rnd(6);
    S.pools[i] = (S.pools[i] || 0) + amt;
    S.robotBets.push({ name, i, amt });
    pushFeed(`<b>${name}</b> 押 ${SYMS[i].name} <b>${fmt(amt)}</b>`);
    renderTile(i, true);
    const left = S.endAt - Date.now();
    robotT = setTimeout(robotBet, left < 4000 ? 90 + rnd(200) : 220 + rnd(520));
  }

  // ---------------- 回合循环 ----------------
  const stage = $('#stage');
  function setPhase(p, dur) { S.phase = p; S.endAt = Date.now() + dur; board.classList.toggle('locked', p !== 'bet'); updateOkBtn(); }

  function startBet() {
    S.round++; localStorage.setItem('yxx_round', S.round);
    $('#roundNo').textContent = S.round;
    S.pools = {}; S.mine = {}; S.pending = {}; S.robotBets = [];
    tiles.forEach((t) => t.classList.remove('win', 'dim'));
    S.dice.forEach((d) => d.wrap.classList.remove('win', 'hop'));
    S.dice.forEach((d) => d.wrap.classList.add('idle'));
    stage.classList.remove('reveal', 'rolling'); $('#resultPop').classList.remove('go');
    $('#stageTitle').textContent = '请下注';
    if (S.balance < 10) { S.balance = START_BAL; toast('演示币已补充 10,000'); }
    renderAll();
    setPhase('bet', T.bet);
    Sound.phase('bet'); Sound.roundStart(); S.cd = false;
    // 开局时先来一波下注
    for (let k = 0; k < 4 + rnd(4); k++) setTimeout(robotBet, k * 120);
    clearTimeout(robotT); robotT = setTimeout(robotBet, 600);
  }

  function lock() {
    clearTimeout(robotT);
    if (sum(S.pending)) { toast('未确认的下注已取消'); S.pending = {}; renderAll(); }
    setPhase('lock', T.lock);
    $('#stageTitle').textContent = '停止下注';
    retrigger($('#banner'), 'go'); $('#banner').textContent = '停止下注';
    Sound.phase('lock'); Sound.lock();
    S.dice.forEach((d) => { d.wrap.classList.remove('idle'); d.wrap.classList.add('jitter'); });
    const sr = stage.getBoundingClientRect();
    sparks(sr.width / 2, sr.height * 0.6, 30, 4);
  }

  function roll() {
    setPhase('roll', T.roll);
    $('#stageTitle').textContent = '开奖中';
    stage.classList.add('rolling');
    const result = [rnd(6), rnd(6), rnd(6)];
    S.result = result;
    Sound.phase('roll'); Sound.roll();
    S.dice.forEach((d, i) => {
      d.wrap.classList.remove('jitter'); void d.wrap.offsetWidth; d.wrap.classList.add('hop');
      setDie(i, result[i]);
    });
    const sr = stage.getBoundingClientRect();
    // 空中碰撞的火花
    [500, 1100, 1700].forEach((ms) => setTimeout(() => sparks(sr.width * (0.3 + Math.random() * 0.4), sr.height * 0.5, 14, 4), ms));
    setTimeout(() => {
      retrigger(stage, 'shake'); retrigger($('#ring'), 'go'); retrigger($('#flash'), 'go');
      S.dice.forEach((d) => { const r = d.wrap.getBoundingClientRect(); sparks(r.left - sr.left + r.width / 2, r.top - sr.top + r.height, 26, 7); });
    }, 2600);
  }

  function reveal() {
    setPhase('show', T.show);
    Sound.phase('show'); Sound.reveal();
    stage.classList.remove('rolling'); stage.classList.add('reveal');
    const r = S.result, cnt = [0, 0, 0, 0, 0, 0];
    r.forEach((s) => cnt[s]++);
    $('#stageTitle').textContent = '开奖结果';
    tiles.forEach((t, i) => {
      if (cnt[i]) { t.classList.add('win'); $('#badge' + i).textContent = '×' + cnt[i]; } else t.classList.add('dim');
    });
    S.dice.forEach((d) => d.wrap.classList.add('win'));

    const bet = sum(S.mine);
    let win = 0;
    for (const k in S.mine) if (cnt[k]) win += S.mine[k] * (1 + cnt[k]);
    const pop = $('#resultPop');
    const names = [...new Set(r)].map((s) => SYMS[s].name + (cnt[s] > 1 ? '×' + cnt[s] : '')).join(' · ');
    if (win > 0) {
      S.balance += win; renderBalance(true);
      pop.className = 'result-pop win'; pop.innerHTML = `+${fmt(win)}<small>${names}</small>`;
      Sound.win(win - bet >= bet * 2 || win >= 10000);
      const sr = stage.getBoundingClientRect();
      for (let k = 0; k < 4; k++) setTimeout(() => sparks(sr.width * (0.2 + Math.random() * 0.6), sr.height * 0.4, 40, 8), k * 250);
      pushFeed(`🎉 <b>我</b> 赢得 <b>${fmt(win)}</b>`, 'win me');
    } else {
      pop.className = 'result-pop lose'; pop.innerHTML = `${bet ? '本局未中奖' : '本局开奖'}<small>${names}</small>`;
      if (bet) Sound.lose();
    }
    retrigger(pop, 'go');

    // 机器人赢家播报
    const wins = {};
    S.robotBets.forEach((b) => { if (cnt[b.i]) wins[b.name] = (wins[b.name] || 0) + b.amt * (1 + cnt[b.i]); });
    Object.entries(wins).sort((a, b) => b[1] - a[1]).slice(0, 3).forEach(([n, w], k) =>
      setTimeout(() => pushFeed(`🎉 <b>${n}</b> 赢得 <b>${fmt(w)}</b>`, 'win'), 600 + k * 500));

    if (bet) S.lastBets = { ...S.mine };
    localStorage.setItem('yxx_last', JSON.stringify(S.lastBets));
    S.history.unshift(r); renderHistory();
  }

  function tick() {
    const left = S.endAt - Date.now();
    const tt = mmss(left);
    $('#stageTimer').textContent = tt; $('#topTimer').textContent = tt;
    const urgent = S.phase === 'bet' && left <= 3000;
    $('#stageTimer').classList.toggle('urgent', urgent);
    if (urgent && !S.cd && left > 0) { S.cd = true; Sound.countdown(left / 1000); }
    if (left > 0) return;
    if (S.phase === 'bet') lock();
    else if (S.phase === 'lock') roll();
    else if (S.phase === 'roll') reveal();
    else if (S.phase === 'show') startBet();
  }
  setInterval(() => {
    S.online += rnd(11) - 5; $('#online').textContent = fmt(S.online);
  }, 2500);

  // ---------------- 启动流程 ----------------
  renderHistory(); renderAll();
  $('#online').textContent = fmt(S.online);
  let prog = 0;
  const loadSteps = ['资源加载中…', '生成骰子…', '连接游戏大厅…', '同步开奖记录…'];
  const lt = setInterval(() => {
    prog = Math.min(100, prog + 8 + rnd(14));
    $('#loadfill').style.width = prog + '%';
    $('#loadtxt').textContent = loadSteps[Math.min(3, Math.floor(prog / 26))] + ' ' + prog + '%';
    if (prog >= 100) { clearInterval(lt); $('#loadtxt').textContent = '加载完成'; $('#enterBtn').hidden = false; }
  }, 120);
  $('#enterBtn').addEventListener('click', () => {
    Sound.unlock();
    $('#splash').classList.add('hide');
    sizeCanvas();
    S.round--; startBet();
    setInterval(tick, 100);
  });
  document.addEventListener('pointerdown', () => Sound.unlock(), { once: true });
  window.__yxx = S; // 调试用
})();
