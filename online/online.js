(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const SYMS = window.SYMBOLS;
  const CHIPS = [
    { v: 10, c: '#2e8b57' }, { v: 50, c: '#1f6fb2' }, { v: 100, c: '#c9971f' },
    { v: 500, c: '#7d3aa8' }, { v: 1000, c: '#c0392b' },
  ];
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const svg = (id) => `<svg viewBox="0 0 100 100"><use href="#s-${id}"/></svg>`;
  const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `00:${String(s).padStart(2, '0')}`; };
  const rnd = (n) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toObj = (arr) => { const o = {}; (arr || []).forEach((v, i) => { if (v) o[i] = v; }); return o; };

  const S = {
    round: 0, phase: 'idle', endAt: 0, offset: 0,
    balance: 0, chip: 100, me: '',
    pending: {}, mine: {}, lastBets: JSON.parse(localStorage.getItem('yxx_last') || '{}'),
    pools: {}, history: [], online: 0, dice: [], lastTick: -1, result: [0, 1, 2],
  };
  let token = localStorage.getItem('yxx_token') || '';
  let ws, sending = false, entered = false;
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
  

  // ---------------- 渲染 ----------------
  function renderBalance(bump) {
    $('#balance').textContent = fmt(S.balance);
    if (bump) { const b = $('.balance'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
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
    if (!ws || ws.readyState !== 1) return toast('网络连接中，请稍候');
    if (sending) return;
    sending = true;
    ws.send(JSON.stringify({ t: 'bet', bets: S.pending }));
  });
  $('#musicBtn').addEventListener('click', () => { const m = Sound.toggle(); $('#musicBtn').classList.toggle('off', m); });
  $('#musicBtn').classList.toggle('off', Sound.muted);
  $('#meName').addEventListener('click', () => { if (confirm('退出当前账号？')) logout(); });

  // ---------------- 阶段表现（由服务器驱动） ----------------
  const stage = $('#stage');
  function setPhase(p, endAt) { S.phase = p; S.endAt = endAt; board.classList.toggle('locked', p !== 'bet'); updateOkBtn(); }

  function enterBet(m) {
    S.round = m.round; $('#roundNo').textContent = S.round;
    S.pools = toObj(m.pools); S.mine = {}; S.pending = {};
    tiles.forEach((t) => t.classList.remove('win', 'dim'));
    S.dice.forEach((d) => d.wrap.classList.remove('win', 'hop', 'jitter'));
    S.dice.forEach((d) => d.wrap.classList.add('idle'));
    stage.classList.remove('reveal', 'rolling'); $('#resultPop').classList.remove('go');
    $('#stageTitle').textContent = '请下注';
    Sound.phase('bet'); Sound.roundStart(); S.cd = false;
    renderAll();
  }
  function enterLock() {
    if (sum(S.pending)) { toast('未确认的下注已取消'); S.pending = {}; renderAll(); }
    $('#stageTitle').textContent = '停止下注';
    retrigger($('#banner'), 'go'); $('#banner').textContent = '停止下注';
    Sound.phase('lock'); Sound.lock();
    S.dice.forEach((d) => { d.wrap.classList.remove('idle'); d.wrap.classList.add('jitter'); });
    const sr = stage.getBoundingClientRect();
    sparks(sr.width / 2, sr.height * 0.6, 30, 4);
  }
  function enterRoll(result, left) {
    $('#stageTitle').textContent = '开奖中';
    S.result = result;
    if (left < 2800) { result.forEach((s, d) => setDie(d, s, true)); S.dice.forEach((d) => d.wrap.classList.remove('idle', 'jitter')); return; }
    stage.classList.add('rolling');
    Sound.phase('roll'); Sound.roll();
    S.dice.forEach((d, i) => {
      d.wrap.classList.remove('jitter', 'idle'); void d.wrap.offsetWidth; d.wrap.classList.add('hop');
      setDie(i, result[i]);
    });
    const sr = stage.getBoundingClientRect();
    [500, 1100, 1700].forEach((ms) => setTimeout(() => sparks(sr.width * (0.3 + Math.random() * 0.4), sr.height * 0.5, 14, 4), ms));
    setTimeout(() => {
      retrigger(stage, 'shake'); retrigger($('#ring'), 'go'); retrigger($('#flash'), 'go');
      S.dice.forEach((d) => { const r = d.wrap.getBoundingClientRect(); sparks(r.left - sr.left + r.width / 2, r.top - sr.top + r.height, 26, 7); });
    }, 2600);
  }
  function enterShow(m) {
    Sound.phase('show'); Sound.reveal();
    stage.classList.remove('rolling'); stage.classList.add('reveal');
    const r = m.result, cnt = m.counts;
    if (S.result.join() !== r.join()) r.forEach((s, d) => setDie(d, s, true));
    $('#stageTitle').textContent = '开奖结果';
    tiles.forEach((t, i) => {
      if (cnt[i]) { t.classList.add('win'); $('#badge' + i).textContent = '×' + cnt[i]; } else t.classList.add('dim');
    });
    S.dice.forEach((d) => d.wrap.classList.add('win'));
    S.balance = m.balance;
    const win = m.myWin, bet = m.myBet;
    const pop = $('#resultPop');
    const names = [...new Set(r)].map((s) => SYMS[s].name + (cnt[s] > 1 ? '×' + cnt[s] : '')).join(' · ');
    if (win > 0) {
      renderBalance(true);
      pop.className = 'result-pop win'; pop.innerHTML = `+${fmt(win)}<small>${names}</small>`;
      Sound.win(win - bet >= bet * 2 || win >= 10000);
      const sr = stage.getBoundingClientRect();
      for (let k = 0; k < 4; k++) setTimeout(() => sparks(sr.width * (0.2 + Math.random() * 0.6), sr.height * 0.4, 40, 8), k * 250);
    } else {
      renderBalance();
      pop.className = 'result-pop lose'; pop.innerHTML = `${bet ? '本局未中奖' : '本局开奖'}<small>${names}</small>`;
      if (bet) Sound.lose();
    }
    retrigger(pop, 'go');
    (m.winners || []).forEach((w, k) => setTimeout(() =>
      pushFeed(`🎉 <b>${w.name === S.me ? '我' : esc(w.name)}</b> 赢得 <b>${fmt(w.win)}</b>`, 'win' + (w.name === S.me ? ' me' : '')), 500 + k * 500));
    if (bet) { S.lastBets = { ...S.mine }; localStorage.setItem('yxx_last', JSON.stringify(S.lastBets)); }
    S.history.unshift(r); renderHistory();
  }

  // ---------------- WebSocket ----------------
  function onMsg(m) {
    if (m.now) S.offset = m.now - Date.now();
    switch (m.t) {
      case 'auth': toast(m.error); logout(); break;
      case 'state': {
        S.me = m.me.name; S.balance = m.me.balance; $('#meName').textContent = S.me;
        S.history = m.history || []; renderHistory();
        $('#online').textContent = fmt(m.online);
        S.round = m.round; $('#roundNo').textContent = m.round;
        S.pools = toObj(m.pools); S.mine = toObj(m.myBets);
        setPhase(m.phase, m.endAt); Sound.phase(m.phase);
        if (S.history[0] && m.phase !== 'roll') S.history[0].forEach((s, d) => setDie(d, s, true));
        if (m.phase === 'bet') { $('#stageTitle').textContent = '请下注'; S.dice.forEach((d) => d.wrap.classList.add('idle')); }
        else if (m.phase === 'lock') $('#stageTitle').textContent = '停止下注';
        else if (m.phase === 'roll') { enterRoll(m.result, 0); }
        else $('#stageTitle').textContent = '开奖结果';
        renderAll();
        break;
      }
      case 'phase': {
        setPhase(m.phase, m.endAt);
        if (m.phase === 'bet') enterBet(m);
        else if (m.phase === 'lock') enterLock();
        else if (m.phase === 'roll') enterRoll(m.result, m.endAt - m.now);
        else if (m.phase === 'show') enterShow(m);
        break;
      }
      case 'bet': {
        S.pools[m.sym] = m.pool;
        const mine = m.name === S.me;
        pushFeed(`<b>${mine ? '我' : esc(m.name)}</b> 押 ${SYMS[m.sym].name} <b>${fmt(m.amt)}</b>`, mine ? 'me' : '');
        renderTile(m.sym, true);
        break;
      }
      case 'betok': {
        sending = false;
        S.balance = m.balance; S.mine = toObj(m.myBets); S.pending = {};
        renderAll(); renderBalance(true); Sound.confirm(); toast(`下注成功 ${fmt(m.total)}`);
        break;
      }
      case 'betfail': sending = false; S.balance = m.balance; renderBalance(); toast(m.error); break;
      case 'online': $('#online').textContent = fmt(m.n); break;
    }
  }
  let retry = 0;
  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(token)}`);
    ws.onopen = () => { retry = 0; $('#conn').classList.add('ok'); };
    ws.onmessage = (e) => { try { onMsg(JSON.parse(e.data)); } catch (err) { console.warn(err); } };
    ws.onclose = () => {
      $('#conn').classList.remove('ok'); sending = false;
      if (!token) return;
      setTimeout(connect, Math.min(5000, 500 * 2 ** retry++));
    };
  }

  function tick() {
    const left = S.endAt - (Date.now() + S.offset);
    const tt = mmss(left);
    $('#stageTimer').textContent = tt; $('#topTimer').textContent = tt;
    const urgent = S.phase === 'bet' && left <= 3000;
    $('#stageTimer').classList.toggle('urgent', urgent);
    if (urgent && !S.cd && left > 0) { S.cd = true; Sound.countdown(left / 1000); }
  }

  // ---------------- 登录 / 注册 ----------------
  let mode = 'login';
  const api = async (url, body) => {
    const r = await fetch(url, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || '网络错误');
    return j;
  };
  function showForm() { $('#loadbarWrap').hidden = true; $('#loadtxt').hidden = true; $('#welcome').hidden = true; $('#authForm').hidden = false; }
  document.querySelectorAll('.auth-tabs button').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.m;
    document.querySelectorAll('.auth-tabs button').forEach((x) => x.classList.toggle('on', x === b));
    $('#fPass2').hidden = mode !== 'register';
    $('#authBtn').textContent = mode === 'register' ? '注册并进入' : '登录并进入';
    $('#fPass').autocomplete = mode === 'register' ? 'new-password' : 'current-password';
    $('#authErr').textContent = '';
  }));
  $('#authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    Sound.unlock();
    const username = $('#fUser').value.trim(), password = $('#fPass').value;
    if (mode === 'register' && password !== $('#fPass2').value) { $('#authErr').textContent = '两次密码不一致'; return; }
    $('#authBtn').disabled = true; $('#authErr').textContent = '';
    try {
      const j = await api('/api/' + mode, { username, password });
      token = j.token; localStorage.setItem('yxx_token', token);
      enter();
    } catch (err) { $('#authErr').textContent = err.message; }
    $('#authBtn').disabled = false;
  });
  $('#enterBtn').addEventListener('click', () => { Sound.unlock(); enter(); });
  $('#switchUser').addEventListener('click', () => logout());
  function enter() {
    if (entered) return; entered = true;
    $('#splash').classList.add('hide');
    sizeCanvas(); connect();
  }
  function logout() {
    if (token) fetch('/api/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + token } }).catch(() => {});
    token = ''; localStorage.removeItem('yxx_token');
    if (ws) ws.close();
    entered = false;
    $('#splash').classList.remove('hide'); showForm();
  }

  renderHistory(); renderAll();
  setInterval(tick, 100);
  document.addEventListener('pointerdown', () => Sound.unlock(), { once: true });
  $('#loadfill').style.width = '60%';
  (async () => {
    if (token) {
      try { const j = await api('/api/me'); $('#loadfill').style.width = '100%'; $('#loadbarWrap').hidden = true; $('#loadtxt').hidden = true; $('#wName').textContent = j.user.name; $('#welcome').hidden = false; return; }
      catch (_) { token = ''; localStorage.removeItem('yxx_token'); }
    }
    showForm();
  })();
  window.__yxx = S;
})();
