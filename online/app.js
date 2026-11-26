// 鱼虾蟹 · 骰运星河  客户端（登录 + 科幻大厅），协议与服务器保持不变
const $ = (s) => document.querySelector(s);
const SND = window.SND;
const SYMS = [
  { id: 'elephant', short: '大象', name: '星河象', cls: '' },
  { id: 'rabbit', short: '兔子', name: '瑞祥兔', cls: 'gold' },
  { id: 'carp', short: '锦鲤', name: '鸿运锦鲤', cls: 'red' },
  { id: 'shrimp', short: '虾', name: '长寿虾', cls: 'teal' },
  { id: 'peacock', short: '孔雀', name: '孔雀开屏', cls: '' },
  { id: 'horse', short: '骏马', name: '骏马奔腾', cls: 'gold' },
];
const IMG = (i) => `/o/img/${SYMS[i].id}.webp`;
const CHIPS = [{ v: 10, g: 0 }, { v: 50, g: 0 }, { v: 100, g: 0 }, { v: 500, g: 1 }, { v: 1000, g: 1 }];
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const kfmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + 'K' : fmt(n));
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toObj = (arr) => { const o = {}; (arr || []).forEach((v, i) => { if (v) o[i] = v; }); return o; };
const hhmm = (t) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`; };
const retrigger = (el, c) => { el.classList.remove(c); void el.offsetWidth; el.classList.add(c); };

const S = { round: 0, phase: 'idle', endAt: 0, offset: 0, balance: 0, chip: 100, me: '', pending: {}, mine: {},
  lastBets: JSON.parse(localStorage.getItem('yxx_last') || '{}'), pools: {}, history: [], cd: false, T: null, phaseStart: 0 };
let token = localStorage.getItem('yxx_token') || '';
let ws, sending = false, entered = false, stage = null, stageP = null;

// 预取 3D 模块与图片
const scenePromise = import('./scene.js?v='+(window.__V||'0')).catch((e) => { console.warn('scene load failed', e); return null; });
const imgsPromise = Promise.all(SYMS.map((_, i) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(im); im.src = IMG(i); })));

// ================= 防 iOS 缩放 / 版本检查 =================
['gesturestart', 'gesturechange', 'gestureend'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd < 350 && !(e.target.closest && e.target.closest('input,textarea'))) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 || (e.scale && e.scale !== 1)) e.preventDefault(); }, { passive: false });
async function checkVersion() {
  try {
    const r = await fetch('/version', { cache: 'no-store' }); const j = await r.json();
    if (window.__V && j.v && j.v !== window.__V) {
      if (sessionStorage.getItem('yxx_ver') === j.v) return;       // 只重载一次，避免死循环
      sessionStorage.setItem('yxx_ver', j.v); location.replace('/?v=' + j.v);
    }
  } catch (_) {}
}
checkVersion();
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVersion(); });

// ================= 音乐（登录即播放） =================
function syncMusicIcons() {
  const off = SND.muted || !SND.running;
  ['#loginMusic', '#lobbyMusic'].forEach((s) => $(s).classList.toggle('off', off));
  $('#loginMusic').classList.toggle('pulse', !SND.muted && !SND.running);
  $('#musicHint').hidden = SND.muted || SND.running || entered;
}
SND.onState(syncMusicIcons);
SND.music('login');
SND.tryResume().then(syncMusicIcons);
setTimeout(syncMusicIcons, 400);
const unlock = () => { SND.tryResume().then(syncMusicIcons); };
['pointerdown', 'keydown', 'touchstart'].forEach((ev) => document.addEventListener(ev, unlock, { capture: true, passive: true }));
function musicBtn(e) {
  e.stopPropagation();
  if (!SND.muted && !SND.running) { SND.tryResume().then(syncMusicIcons); return; }
  SND.toggle(); setTimeout(syncMusicIcons, 50);
}
$('#loginMusic').addEventListener('click', musicBtn);
$('#lobbyMusic').addEventListener('click', musicBtn);

// ================= 登录页金尘 =================
(function dust() {
  const c = $('#dust'), g = c.getContext('2d'); let W, H, P = [];
  const size = () => { const d = Math.min(devicePixelRatio || 1, 2); W = c.clientWidth; H = c.clientHeight; c.width = W * d; c.height = H * d; g.setTransform(d, 0, 0, d, 0, 0); };
  size(); addEventListener('resize', size);
  for (let i = 0; i < 46; i++) P.push({ x: Math.random(), y: Math.random(), r: 0.5 + Math.random() * 1.8, s: 0.00015 + Math.random() * 0.0005, ph: Math.random() * 6 });
  (function f(t) {
    if (!$('#login').hidden) {
      g.clearRect(0, 0, W, H);
      for (const p of P) { p.y -= p.s; if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }
        const a = 0.25 + 0.35 * Math.sin(t / 900 + p.ph); g.fillStyle = `rgba(240,200,120,${a})`; g.beginPath(); g.arc(p.x * W + Math.sin(t / 2000 + p.ph) * 8, p.y * H, p.r, 0, 7); g.fill(); }
    }
    requestAnimationFrame(f);
  })(0);
})();

// ================= 登录 / 注册 =================
let mode = 'login';
const api = async (url, body) => {
  const r = await fetch(url, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || '网络错误');
  return j;
};
document.querySelectorAll('.t-tabs button').forEach((b) => b.addEventListener('click', () => {
  mode = b.dataset.m; SND.tap();
  document.querySelectorAll('.t-tabs button').forEach((x) => x.classList.toggle('on', x === b));
  $('#pass2Row').hidden = mode !== 'register';
  $('#authBtn span').textContent = mode === 'register' ? '注册并进入' : '登录并进入';
  $('#fPass').autocomplete = mode === 'register' ? 'new-password' : 'current-password';
  $('#authErr').textContent = '';
}));
$('#eye').addEventListener('click', () => { const p = $('#fPass'); p.type = p.type === 'password' ? 'text' : 'password'; $('#eye').style.opacity = p.type === 'text' ? 1 : 0.6; });
$('#authForm').addEventListener('submit', async (e) => {
  e.preventDefault(); SND.tap();
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
$('#enterBtn').addEventListener('click', () => { SND.tap(); enter(); });
$('#switchUser').addEventListener('click', () => logout());

// ================= 大厅构建 =================
const board = $('#board');
board.innerHTML = SYMS.map((s, i) => `
  <button class="ped ${s.cls}" data-i="${i}">
    <i class="frame"></i>
    <div class="inner"><i class="plat"></i><img class="fig" src="${IMG(i)}" alt="${s.short}" draggable="false"></div>
    <div class="mine" id="mine${i}"></div>
    <div class="stack" id="stack${i}"></div>
    <span class="pool"><i class="coin"></i><b id="pool${i}">0</b></span>
    <div class="lbl"><span class="nm">${s.name}</span></div>
    <div class="badge" id="badge${i}"></div>
  </button>`).join('');
const peds = [...board.querySelectorAll('.ped')];
$('#chips').innerHTML = CHIPS.map((c) => `<button class="chip${c.g ? ' g' : ''}${c.v === S.chip ? ' sel' : ''}" data-v="${c.v}">${c.v >= 1000 ? '1K' : c.v}</button>`).join('');

function renderBalance(bump) { $('#balance').textContent = fmt(S.balance); if (bump) retrigger($('.bal'), 'bump'); }
function renderPed(i, pop) {
  $('#pool' + i).textContent = kfmt(S.pools[i] || 0);
  if (pop) retrigger($('#pool' + i).parentNode, 'pop');
  const m = S.mine[i] || 0, p = S.pending[i] || 0, el = $('#mine' + i);
  el.classList.toggle('on', !!(m || p));
  el.innerHTML = (m ? kfmt(m) : '') + (p ? `<em>+${kfmt(p)}</em>` : '');
  peds[i].classList.toggle('has', !!(m || p));
  let left = m + p, k = 0, html = '';
  for (let c = CHIPS.length - 1; c >= 0 && k < 5; c--) while (left >= CHIPS[c].v && k < 5) {
    const col = CHIPS[c].g ? '#f3c66a' : '#4fe9ff';
    html += `<i style="bottom:${k * 4}px;--cc:${col}"></i>`; left -= CHIPS[c].v; k++;
  }
  $('#stack' + i).innerHTML = html;
}
function renderAll() { SYMS.forEach((_, i) => renderPed(i)); renderBalance(); updateOk(); }
const histImgs = (r) => r.map((s) => `<img src="${IMG(s)}" alt="">`).join('');
function renderHistory() { $('#history').innerHTML = S.history.slice(0, 10).map((r) => `<div class="h-item">${histImgs(r)}</div>`).join(''); }
function updateOk() { $('#btnOk').classList.toggle('ready', sum(S.pending) > 0 && S.phase === 'bet'); }
function pushFeed(sym, name, amt, cls) {
  const li = document.createElement('li'); if (cls) li.className = cls;
  li.innerHTML = `<img src="${IMG(sym)}" alt=""><span class="n">${esc(name)}</span><span class="a">${kfmt(amt)}</span>`;
  const feed = $('#feed'); feed.prepend(li);
  while (feed.children.length > 9) feed.lastChild.remove();
}
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1600); }
function flyChip(from, to, gold) {
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect(), el = document.createElement('div');
  const col = gold ? '#f3c66a' : '#4fe9ff';
  el.className = 'fly-chip'; el.style.cssText = `left:${a.left + a.width / 2 - 12}px;top:${a.top + a.height / 2 - 12}px;background:radial-gradient(circle,#06121e 35%,${col} 36%);color:${col}`;
  document.body.appendChild(el);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2) + (Math.random() * 30 - 15), dy = b.top + b.height * 0.45 - (a.top + a.height / 2);
  el.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx / 2}px,${dy / 2 - 50}px) scale(1.25)`, offset: 0.5 }, { transform: `translate(${dx}px,${dy}px) scale(.6)`, opacity: 0.3 }], { duration: 420, easing: 'ease-in' }).onfinish = () => el.remove();
}

// ================= 操作 =================
$('#chips').addEventListener('click', (e) => {
  const b = e.target.closest('.chip'); if (!b) return;
  S.chip = +b.dataset.v; document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('sel', c === b)); SND.tap();
});
board.addEventListener('click', (e) => {
  const t = e.target.closest('.ped'); if (!t) return;
  if (S.phase !== 'bet') return toast('已封盘，请等待下一回合');
  const i = +t.dataset.i;
  if (sum(S.pending) + S.chip > S.balance) return toast('余额不足');
  S.pending[i] = (S.pending[i] || 0) + S.chip;
  flyChip(document.querySelector('.chip.sel'), t, S.chip >= 500);
  SND.chip(); renderPed(i); updateOk();
  if (navigator.vibrate) navigator.vibrate(8);
});
board.addEventListener('pointerenter', (e) => { if (e.target.closest && e.target.closest('.ped') && matchMedia('(hover:hover)').matches) SND.hover(); }, true);
$('#btnClear').addEventListener('click', () => { if (!sum(S.pending)) return toast('没有待确认的下注'); S.pending = {}; renderAll(); SND.clear(); });
$('#btnRepeat').addEventListener('click', () => {
  if (S.phase !== 'bet') return toast('已封盘，请等待下一回合');
  if (!sum(S.lastBets)) return toast('上一回合没有下注');
  if (sum(S.lastBets) + sum(S.pending) > S.balance) return toast('余额不足');
  for (const k in S.lastBets) S.pending[k] = (S.pending[k] || 0) + S.lastBets[k];
  renderAll(); SND.repeat();
});
$('#btnOk').addEventListener('click', () => {
  if (S.phase !== 'bet') return toast('已封盘，请等待下一回合');
  const tot = sum(S.pending);
  if (!tot) return toast('请先选择筹码并点击图案下注');
  if (tot > S.balance) return toast('余额不足');
  if (!ws || ws.readyState !== 1) return toast('网络连接中，请稍候');
  if (sending) return; sending = true;
  ws.send(JSON.stringify({ t: 'bet', bets: S.pending }));
});

// 底部导航 / 弹层
function sheet(html) { $('#sheetBody').innerHTML = html; $('#sheet').hidden = false; SND.tap(); }
$('#sheetX').addEventListener('click', () => { $('#sheet').hidden = true; });
$('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') $('#sheet').hidden = true; });
const showHist = () => sheet(`<h3>开奖历史</h3>${S.history.slice(0, 30).map((r, k) => `<div class="hrow"><span style="width:56px">#${S.round - k - (S.phase === 'bet' || S.phase === 'lock' ? 1 : 0)}</span>${histImgs(r)}<span>${r.map((s) => SYMS[s].short).join(' · ')}</span></div>`).join('') || '<p>暂无记录</p>'}`);
$('#navHist').addEventListener('click', showHist);
$('#historyBar').addEventListener('click', showHist);
$('#navFair').addEventListener('click', () => sheet(`<h3>规则说明</h3><ul>
  <li>每回合 ${S.T ? Math.round(S.T.bet / 1000) : 15} 秒下注，服务器摇出 3 颗骰子，每颗骰子六面分别是 6 种图案。</li>
  <li>押中的图案每出现 1 次，赔付 1 倍下注额并退还本金（出现 2 次赔 2 倍，3 次赔 3 倍）。</li>
  <li>开奖结果由服务器加密随机数（crypto.randomInt）生成，所有玩家同一回合看到同一结果。</li>
  <li>本游戏仅使用虚拟演示币，不可充值、提现或兑换。</li></ul>`));
$('#navMenu').addEventListener('click', () => {
  sheet(`<h3>菜单</h3><p>当前账号：<b>${esc(S.me)}</b></p><button class="menu-btn" id="mMusic">${SND.muted ? '开启音乐' : '关闭音乐'}</button><button class="menu-btn" id="mOut">退出登录</button>`);
  $('#mMusic').onclick = (e) => { musicBtn(e); $('#sheet').hidden = true; };
  $('#mOut').onclick = () => { $('#sheet').hidden = true; logout(); };
});

// ================= 3D 舞台 =================
async function ensureStage() {
  if (stageP) return stageP;
  stageP = (async () => {
    const [mod, imgs] = await Promise.all([scenePromise, imgsPromise]);
    try {
      if (!mod) throw new Error('no module');
      return await mod.createStage($('#stage3d'), imgs, {
        onHit: (s, pan) => SND.hit(s, pan),
        onCycle: (i, k) => SND.cycle(i, k),
        onStop: (i, pan) => { SND.stop(i, pan); if (navigator.vibrate) navigator.vibrate(18); },
        onLand: () => { SND.land(); if (navigator.vibrate) navigator.vibrate([20, 30, 20]); },
      });
    } catch (e) { console.warn('WebGL unavailable, fallback', e); return fallbackStage(); }
  })();
  stage = await stageP; return stage;
}
function fallbackStage() {
  const fb = $('#fallback'); fb.hidden = false; const ds = [...fb.children];
  const set = (r) => ds.forEach((d, k) => { d.innerHTML = `<img src="${IMG(r[k])}" alt="">`; });
  return {
    showIdle(r) { fb.classList.remove('spin'); if (r) set(r); }, lock() { fb.classList.add('spin'); },
    roll(r) { fb.classList.add('spin'); setTimeout(() => { fb.classList.remove('spin'); set(r); SND.land(); }, 2600); },
    reveal(r) { fb.classList.remove('spin'); set(r); }, resize() {},
  };
}
const withStage = (fn) => { if (stage) fn(stage); else ensureStage().then(fn); };

// ================= 阶段 =================
function setStatus(t) { $('#status').textContent = t; }
function setPhase(p, endAt) { S.phase = p; S.endAt = endAt; S.phaseStart = Date.now() + S.offset; board.classList.toggle('locked', p !== 'bet'); updateOk(); }
function enterBet(m) {
  S.round = m.round; $('#round').textContent = `第 ${S.round} 回合`;
  S.pools = toObj(m.pools); S.mine = {}; S.pending = {}; S.cd = false;
  peds.forEach((t) => t.classList.remove('win', 'dim'));
  $('#resultPop').classList.remove('go'); setStatus('请下注');
  SND.phase('bet'); SND.start();
  withStage((s) => s.showIdle(S.history[0]));
  renderAll();
}
function enterLock() {
  if (sum(S.pending)) { toast('未确认的下注已取消'); S.pending = {}; renderAll(); }
  setStatus('停止下注'); $('#banner').textContent = '停止下注'; retrigger($('#banner'), 'go');
  SND.phase('lock'); SND.lock();
  withStage((s) => s.lock());
}
function enterRoll(result, left) {
  setStatus('开奖中');
  if (left < 1500) { withStage((s) => s.reveal(result)); return; }
  SND.phase('roll'); SND.roll();
  withStage((s) => s.roll(result));
}
function enterShow(m) {
  SND.phase('show'); SND.reveal();
  const r = m.result, cnt = m.counts;
  setStatus('开奖结果');
  withStage((s) => s.reveal(r));
  peds.forEach((t, i) => { if (cnt[i]) { t.classList.add('win'); $('#badge' + i).textContent = '×' + cnt[i]; } else t.classList.add('dim'); });
  S.balance = m.balance;
  const win = m.myWin, bet = m.myBet, pop = $('#resultPop');
  const names = [...new Set(r)].map((s) => SYMS[s].short + (cnt[s] > 1 ? '×' + cnt[s] : '')).join(' · ');
  if (win > 0) {
    renderBalance(true);
    pop.className = 'result-pop win'; pop.innerHTML = `+${fmt(win)}<small>${names}</small>`;
    SND.win(win - bet >= bet * 2 || win >= 10000);
  } else {
    renderBalance();
    pop.className = 'result-pop lose'; pop.innerHTML = `${bet ? '本局未中奖' : '开奖结果'}<small>${names}</small>`;
    if (bet) SND.lose();
  }
  retrigger(pop, 'go');
  (m.winners || []).slice(0, 5).forEach((w, k) => setTimeout(() => {
    const top = r.find((s) => cnt[s]) ?? r[0];
    pushFeed(top, (w.name === S.me ? '我' : w.name) + ' 赢', w.win, 'win' + (w.name === S.me ? ' me' : ''));
  }, 600 + k * 450));
  if (bet) { S.lastBets = { ...S.mine }; localStorage.setItem('yxx_last', JSON.stringify(S.lastBets)); }
  S.history.unshift(r); renderHistory();
}

// ================= WebSocket =================
function onMsg(m) {
  if (m.now) S.offset = m.now - Date.now();
  switch (m.t) {
    case 'auth': toast(m.error); logout(); break;
    case 'state': {
      S.me = m.me.name; S.balance = m.me.balance; $('#meName').textContent = S.me;
      S.history = m.history || []; renderHistory(); if (m.T) S.T = m.T;
      $('#online').textContent = fmt(m.online);
      S.round = m.round; $('#round').textContent = `第 ${m.round} 回合`;
      S.pools = toObj(m.pools); S.mine = toObj(m.myBets);
      setPhase(m.phase, m.endAt); SND.phase(m.phase);
      setStatus({ bet: '请下注', lock: '停止下注', roll: '开奖中', show: '开奖结果' }[m.phase] || '请下注');
      withStage((s) => { if (m.phase === 'lock') s.lock(); else if ((m.phase === 'roll' || m.phase === 'show') && m.result) s.reveal(m.result); else s.showIdle(S.history[0]); });
      renderAll(); break;
    }
    case 'phase':
      setPhase(m.phase, m.endAt);
      if (m.phase === 'bet') enterBet(m);
      else if (m.phase === 'lock') enterLock();
      else if (m.phase === 'roll') enterRoll(m.result, m.endAt - m.now);
      else if (m.phase === 'show') enterShow(m);
      break;
    case 'bet': {
      S.pools[m.sym] = m.pool; const mine = m.name === S.me;
      pushFeed(m.sym, mine ? '我' : m.name, m.amt, mine ? 'me' : '');
      renderPed(m.sym, true); break;
    }
    case 'betok':
      sending = false; S.balance = m.balance; S.mine = toObj(m.myBets); S.pending = {};
      renderAll(); renderBalance(true); SND.confirm(); toast(`下注成功 ${fmt(m.total)}`); break;
    case 'betfail': sending = false; S.balance = m.balance; renderBalance(); toast(m.error); break;
    case 'online': $('#online').textContent = fmt(m.n); break;
  }
}
let retry = 0;
function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(token)}`);
  ws.onopen = () => { retry = 0; };
  ws.onmessage = (e) => { try { onMsg(JSON.parse(e.data)); } catch (err) { console.warn(err); } };
  ws.onclose = () => { sending = false; if (!token || !entered) return; setTimeout(connect, Math.min(5000, 500 * 2 ** retry++)); };
}

// 倒计时环（rAF 驱动，只在数值变化时写 DOM）
const CIRC = 326.7;
let lastTxt = '', lastOff = '', lastUrg = null, lastGold = null, lastHide = null;
const cdEl = document.querySelector('.cd'), cdNum = $('#cdNum'), cdBar = $('#cdBar');
function tick() {
  requestAnimationFrame(tick);
  if (!entered) return;
  const now = Date.now() + S.offset, left = Math.max(0, S.endAt - now);
  const dur = S.T && S.T[S.phase] ? S.T[S.phase] : (S.phase === 'bet' ? 20000 : 5000);
  const txt = S.phase === 'bet' ? `00:${String(Math.ceil(left / 1000)).padStart(2, '0')}` : ({ lock: '封盘', roll: '开奖', show: '结果' }[S.phase] || '--');
  if (txt !== lastTxt) { cdNum.textContent = txt; lastTxt = txt; }
  const off = (CIRC * (1 - Math.min(1, left / dur))).toFixed(1);
  if (off !== lastOff) { cdBar.style.strokeDashoffset = off; lastOff = off; }
  const urgent = S.phase === 'bet' && left <= 3000, gold = S.phase !== 'bet', hide = S.phase === 'show';
  if (urgent !== lastUrg) { cdEl.classList.toggle('urgent', urgent); lastUrg = urgent; }
  if (gold !== lastGold) { cdEl.classList.toggle('gold', gold); lastGold = gold; }
  if (hide !== lastHide) { cdEl.classList.toggle('hide', hide); lastHide = hide; }
  if (urgent && !S.cd && left > 200) { S.cd = true; SND.countdown(left / 1000); }
}
requestAnimationFrame(tick);

async function enter() {
  if (entered) return; entered = true;
  $('#login').hidden = true; $('#lobby').hidden = false; syncMusicIcons();
  SND.music('lobby'); SND.tryResume();
  renderAll(); renderHistory();
  ensureStage().then((s) => { s.resize && s.resize(); });
  connect();
}
function logout() {
  if (token) fetch('/api/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + token } }).catch(() => {});
  token = ''; localStorage.removeItem('yxx_token'); entered = false;
  if (ws) ws.close();
  $('#lobby').hidden = true; $('#login').hidden = false; $('#welcome').hidden = true; $('#authForm').hidden = false;
  SND.music('login'); syncMusicIcons();
}

(async () => {
  if (token) {
    try { const j = await api('/api/me'); $('#wName').textContent = j.user.name; $('#authForm').hidden = true; $('#welcome').hidden = false; return; }
    catch (_) { token = ''; localStorage.removeItem('yxx_token'); }
  }
})();
window.__yxx = S;
