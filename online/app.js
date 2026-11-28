// 鱼虾蟹 · 骰运星河  客户端（登录 + 单人局：下注 → 确认 → 拉绳放骰）
const $ = (s) => document.querySelector(s);
const SND = window.SND;
const SYMS = [
  { id: 'elephant', short: '大象', name: '星河象', cls: '' },
  { id: 'rabbit', short: '兔子', name: '瑞祥兔', cls: 'gold' },
  { id: 'carp', short: '锦鲤', name: '鸿运锦鲤', cls: 'red' },
  { id: 'tiger', short: '老虎', name: '威武虎', cls: 'amber' },
  { id: 'peacock', short: '孔雀', name: '孔雀开屏', cls: '' },
  { id: 'horse', short: '骏马', name: '骏马奔腾', cls: 'gold' },
];
const IMG = (i) => `/o/img/${SYMS[i].id}.webp`;
const CHIPS = [{ v: 10000, g: 0 }, { v: 50000, g: 0 }, { v: 100000, g: 0 }, { v: 500000, g: 1 }, { v: 1000000, g: 1 }];
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const kfmt = (n) => { if (n >= 1e6) { const x = n / 1e6; return (x % 1 ? x.toFixed(1) : x) + 'M'; } if (n >= 1e4) { const x = n / 1e3; return (x % 1 ? x.toFixed(1) : x) + 'K'; } return fmt(n); };
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toObj = (arr) => { const o = {}; (arr || []).forEach((v, i) => { if (v) o[i] = v; }); return o; };
const hhmm = (t) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`; };
const retrigger = (el, c) => { el.classList.remove(c); void el.offsetWidth; el.classList.add(c); };

const S = { round: 0, phase: 'bet', offset: 0, balance: 0, chip: 10000, me: '', pending: {}, mine: {}, inflight: 0,
  lastBets: JSON.parse(localStorage.getItem('yxx_last') || '{}'), history: [], released: 0 };
let token = localStorage.getItem('yxx_token') || '';
let ws, sending = false, entered = false, pulling = false;

// 预取图片
const imgsPromise = Promise.all(SYMS.map((_, i) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(im); im.src = IMG(i); })));

// ================= 防 iOS 缩放 / 版本检查 =================
['gesturestart', 'gesturechange', 'gestureend'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
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
  ['#loginMusic', '#lobbyMusic'].forEach((s) => { const el = $(s); if (el) el.classList.toggle('off', SND.muted); });
}
SND.onState(syncMusicIcons);
SND.music('login');
SND.tryResume().then(syncMusicIcons);
const unlock = () => { if (SND.muted) return; SND.tryResume().then(syncMusicIcons); };
['pointerdown', 'keydown', 'touchstart'].forEach((ev) => document.addEventListener(ev, unlock, { capture: true, passive: true }));
function musicBtn(e) {
  e.stopPropagation();
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
    <div class="lbl"><span class="nm">${s.name}</span></div>
    <div class="badge" id="badge${i}"></div>
  </button>`).join('');
const peds = [...board.querySelectorAll('.ped')];
const chipLbl = (v) => (v >= 1e6 ? (v / 1e6) + 'M' : (v / 1e3) + 'K');
$('#chips').innerHTML = CHIPS.map((c) => `<button class="chip${c.g ? ' g' : ''}${c.v === S.chip ? ' sel' : ''}" data-v="${c.v}">${chipLbl(c.v)}</button>`).join('');

function renderBalance(bump) { $('#balance').textContent = fmt(S.balance); if (bump) retrigger($('.bal'), 'bump'); }
function renderPed(i) {
  const m = S.mine[i] || 0, el = $('#mine' + i);
  el.classList.toggle('on', !!m);
  el.innerHTML = m ? kfmt(m) : '';
  peds[i].classList.toggle('has', !!m);
  let left = m, k = 0, html = '';
  for (let c = CHIPS.length - 1; c >= 0 && k < 5; c--) while (left >= CHIPS[c].v && k < 5) {
    const col = CHIPS[c].g ? '#f3c66a' : '#4fe9ff';
    html += `<i style="bottom:${k * 4}px;--cc:${col}"></i>`; left -= CHIPS[c].v; k++;
  }
  $('#stack' + i).innerHTML = html;
}
function renderAll() { SYMS.forEach((_, i) => renderPed(i)); renderBalance(); }
const histImgs = (r) => r.map((s) => `<img src="${IMG(s)}" alt="">`).join('');
function setRound(n) { S.round = n; $('#round').textContent = `第 ${n} 局`; }
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1600); }
function flyChip(from, to, gold) {
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect(), el = document.createElement('div');
  const col = gold ? '#f3c66a' : '#4fe9ff';
  el.className = 'fly-chip'; el.style.cssText = `left:${a.left + a.width / 2 - 12}px;top:${a.top + a.height / 2 - 12}px;background:radial-gradient(circle,#06121e 35%,${col} 36%);color:${col}`;
  document.body.appendChild(el);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2) + (Math.random() * 30 - 15), dy = b.top + b.height * 0.45 - (a.top + a.height / 2);
  el.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 40}px) scale(1.1)`, opacity: 1, offset: 0.5 }, { transform: `translate(${dx}px,${dy}px) scale(.7)`, opacity: 0.2 }], { duration: 380, easing: 'cubic-bezier(.3,.7,.4,1)' }).onfinish = () => el.remove();
}

// ================= 下注操作 =================
$('#chips').addEventListener('click', (e) => {
  const b = e.target.closest('.chip'); if (!b) return;
  S.chip = +b.dataset.v; document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('sel', c === b)); SND.tap();
});
const canBet = () => { if (S.phase === 'show') resetRound(); if (S.phase !== 'bet') { toast('骰子已放下，请等待开奖'); return false; } return true; };
function placeChip(i) {
  if (!canBet()) return;
  if (S.chip > S.balance) return toast('余额不足');
  if (!ws || ws.readyState !== 1) return toast('网络连接中，请稍候');
  S.balance -= S.chip;
  S.mine[i] = (S.mine[i] || 0) + S.chip;
  S.inflight = (S.inflight || 0) + 1;
  flyChip(document.querySelector('.chip.sel'), peds[i], S.chip >= 500000);
  SND.chip(); renderPed(i); renderBalance(true); hideHint(); armHint();
  if (navigator.vibrate) navigator.vibrate(8);
  ws.send(JSON.stringify({ t: 'bet', bets: { [i]: S.chip } }));
}
board.addEventListener('pointerdown', (e) => {
  const t = e.target.closest('.ped'); if (!t) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  e.preventDefault();
  placeChip(+t.dataset.i);
});
board.addEventListener('pointerenter', (e) => { if (e.target.closest && e.target.closest('.ped') && matchMedia('(hover:hover)').matches) SND.hover(); }, true);
$('#btnClear').addEventListener('click', () => {
  if (!canBet()) return;
  if (!sum(S.mine)) return toast('没有可取消的下注');
  if (!ws || ws.readyState !== 1) return toast('网络连接中，请稍候');
  ws.send(JSON.stringify({ t: 'cancel' }));
});

// 底部导航 / 弹层
function sheet(html) { $('#sheetBody').innerHTML = html; $('#sheet').hidden = false; SND.tap(); }
$('#sheetX').addEventListener('click', () => { $('#sheet').hidden = true; });
$('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') $('#sheet').hidden = true; });
$('#navHist').addEventListener('click', () => sheet(`<h3>开奖历史</h3>${S.history.slice(0, 30).map((r, k) => `<div class="hrow"><span style="width:56px">#${S.rounds - k}</span>${histImgs(r)}<span>${r.map((s) => SYMS[s].short).join(' · ')}</span></div>`).join('') || '<p>暂无记录</p>'}`));
$('#navFair').addEventListener('click', () => sheet(`<h3>规则说明</h3><ul>
  <li>选择筹码，点击图案即可下注，点一次下一注，可连续快速点击。</li>
  <li>拉下右侧拉绳放下骰子：轻拉放下一颗，用力拉到底放下全部。第一次拉绳后本局下注锁定。</li>
  <li>「取消下注」可在拉绳前取消本局全部下注并退还金币。</li>
  <li>押中的图案每出现 1 次，赔付 1 倍下注额并退还本金（出现 2 次赔 2 倍，3 次赔 3 倍）。</li>
  <li>第一次点击下注时服务器用加密随机数（crypto.randomInt）定下结果，每位玩家独立一局。</li>
  <li>本游戏仅使用虚拟演示币，不可充值、提现或兑换。</li></ul>`));
$('#navMenu').addEventListener('click', () => {
  sheet(`<h3>菜单</h3><p>当前账号：<b>${esc(S.me)}</b></p><button class="menu-btn" id="mMusic">${SND.muted ? '开启音乐' : '关闭音乐'}</button><button class="menu-btn" id="mOut">退出登录</button>`);
  $('#mMusic').onclick = (e) => { musicBtn(e); $('#sheet').hidden = true; };
  $('#mOut').onclick = () => { $('#sheet').hidden = true; logout(); };
});

// ================= 斜坡舞台（CSS 3D 骰子） =================
const stageEl = $('#stage'), diceBox = $('#dice'), fxBox = $('#fx'), barEl = $('#bar'), ropeEl = $('#rope'), handleEl = $('#handle'), hintEl = $('#pullHint');
const FACES = ['ft', 'ff', 'fr', 'fl', 'fb', 'fk'];
const RF = { ft: [0, 0], ff: [90, 0], fb: [-90, 0], fk: [180, 0], fr: [0, -90], fl: [0, 90] };   // 把该面转到正上方
const PERM = [[0, 2, 5, 1, 4, 3], [1, 3, 4, 2, 5, 0], [5, 0, 2, 3, 1, 4]];                      // 每颗骰子 6 面的图案
const STY = [
  { base: ['#f4f6fa', '#9aa3b2'], rim: '#7fe9ff', medal: ['#1b2633', '#0a1018'] },
  { base: ['#9a1a28', '#2e050a'], rim: '#ffcf7a', medal: ['#3a0a10', '#120204'] },
  { base: ['#ffe3a0', '#a8741e'], rim: '#fff2c4', medal: ['#3a2508', '#140b02'] },
];
const TILT = -26;
let G = {}, faceURL = [[], [], []];
const D = [0, 1, 2].map((i) => ({ i, state: 'held', yaw: 18 + i * 3, el: null, ghosts: [] }));

function faceImg(img, st) {
  const S2 = 256, k = S2 / 320, cv = document.createElement('canvas'); cv.width = cv.height = S2; const g = cv.getContext('2d');
  const bg = g.createRadialGradient(S2 * 0.35, S2 * 0.3, 10 * k, S2 / 2, S2 / 2, S2 * 0.75); bg.addColorStop(0, st.base[0]); bg.addColorStop(1, st.base[1]);
  g.fillStyle = bg; g.fillRect(0, 0, S2, S2);
  g.strokeStyle = st.rim; g.globalAlpha = 0.55; g.lineWidth = 4 * k; g.strokeRect(18 * k, 18 * k, S2 - 36 * k, S2 - 36 * k); g.globalAlpha = 1;
  const md = g.createRadialGradient(S2 / 2, S2 / 2, 20 * k, S2 / 2, S2 / 2, S2 * 0.4); md.addColorStop(0, st.medal[0]); md.addColorStop(1, st.medal[1]);
  g.beginPath(); g.arc(S2 / 2, S2 / 2, S2 * 0.38, 0, 7); g.fillStyle = md; g.fill();
  g.lineWidth = 5 * k; g.strokeStyle = st.rim; g.stroke();
  g.save(); g.beginPath(); g.arc(S2 / 2, S2 / 2, S2 * 0.36, 0, 7); g.clip();
  const r = S2 * 0.64; try { g.drawImage(img, (S2 - r) / 2, (S2 - r) / 2, r, r); } catch (_) {} g.restore();
  return cv.toDataURL('image/png');
}
function cubeHTML(i) { return '<i class="die-sh"></i><div class="die">' + FACES.map((f, k) => `<i class="f ${f}" style="background-image:url(${faceURL[i][PERM[i][k]]})"></i>`).join('') + '</div>'; }
function buildDice() {
  diceBox.innerHTML = '';
  D.forEach((d) => {
    d.ghosts = [0, 1].map((k) => { const g = document.createElement('div'); g.className = 'die-wrap ghost g' + k; g.innerHTML = cubeHTML(d.i); diceBox.appendChild(g); return g; });
    d.el = document.createElement('div'); d.el.className = 'die-wrap'; d.el.innerHTML = cubeHTML(d.i); diceBox.appendChild(d.el);
  });
}
function layout() {
  const W = stageEl.clientWidth, H = stageEl.clientHeight; if (!W || !H) return;
  const ds = Math.round(Math.min(56, W * 0.135, H * 0.15));
  const barY = Math.round(Math.max(H * 0.3, 54 + ds + 12));
  const handleY = Math.round(Math.min(barY + H * 0.36, H - 70));
  G = { W, H, ds, barY, holdY: barY - ds / 2 - 3, edgeY: H * 0.58, landY: H * 0.79, hx: [0.32, 0.5, 0.68].map((f) => W * f),
    lx: [0.25, 0.5, 0.75].map((f) => W * f), handleY, D: Math.max(50, Math.min(H * 0.3, H - handleY - 24)), lift: 0, drag: 0 };
  stageEl.style.setProperty('--ds', ds + 'px'); stageEl.style.setProperty('--barY', barY + 'px');
  hintEl.style.top = (handleY + 26) + 'px';
  drawRope(); D.forEach((d) => { if (d.state !== 'roll') place(d); });
}
function drawRope() {
  const top = G.barY - G.lift, hy = G.handleY + G.drag;
  barEl.style.transform = `translateY(${-G.lift}px)`;
  ropeEl.style.top = top + 'px'; ropeEl.style.height = (hy - top) + 'px';
}
function tf(x, y, sc, yaw, ax, az, face) {
  const [rx, rz] = RF[face];
  return [`translate3d(${x - G.ds / 2}px,${y - G.ds / 2}px,0) scale(${sc})`, `rotateX(${TILT}deg) rotateY(${yaw}deg) rotateX(${ax}deg) rotateZ(${az}deg) rotateX(${rx}deg) rotateZ(${rz}deg)`];
}
function apply(el, t) { el.style.transform = t[0]; el.firstChild.nextSibling.style.transform = t[1]; }
function place(d) {
  if (d.state === 'landed') apply(d.el, tf(d.lx, d.ly, 1.16, d.yawF, 0, 0, d.face));
  else apply(d.el, tf(G.hx[d.i], G.holdY, 1, d.yaw, 0, 0, 'ft'));
  d.ghosts.forEach((g) => { g.style.opacity = 0; });
  d.el.style.opacity = 1;
}
// 骰子运动：沿斜坡加速滚下 → 冲出坡边落到平台 → 弹跳两次 → 停稳（结果面朝上）
const T_ROLL = 1.9, P_EDGE = 0.5, SEG = [0, 0.42, 0.7, 0.88, 1], AMP = [0.075, 0.032, 0.012, 0];
function motion(d, t) {
  const p = Math.max(0, Math.min(1, t / T_ROLL));
  let s, hop = 0, seg = -1;
  if (p < P_EDGE) { const q = p / P_EDGE; s = 0.58 * q * q; hop = Math.abs(Math.sin(q * Math.PI * 3)) * G.H * 0.012 * q; }
  else {
    const q = (p - P_EDGE) / (1 - P_EDGE); s = 0.58 + 0.42 * (1 - Math.pow(1 - q, 2.2));
    for (let k = 0; k < 4; k++) if (q >= SEG[k] && q < SEG[k + 1]) { seg = k; hop = Math.sin((q - SEG[k]) / (SEG[k + 1] - SEG[k]) * Math.PI) * AMP[k] * G.H; }
    if (q >= 1) seg = 4;
  }
  const x0 = G.hx[d.i], y0 = G.holdY, ye = G.edgeY - G.ds * 0.3;
  const x = x0 + (d.lx - x0) * s, yBase = s < 0.58 ? y0 + (ye - y0) * (s / 0.58) : ye + (d.ly - ye) * ((s - 0.58) / 0.42);
  const e = 1 - Math.pow(1 - p, 1.7);
  return { tr: tf(x, yBase - hop, 1 + 0.16 * s, d.yaw + (d.yawF - d.yaw) * e, d.ax0 * (1 - e), d.az0 * (1 - e), d.face), seg, x, y: yBase };
}
let rafOn = false, onAllLanded = null;
function loop() {
  const now = performance.now() / 1000; let any = false;
  for (const d of D) {
    if (d.state !== 'roll') continue; any = true;
    const t = now - d.t0; if (t < 0) continue;
    const m = motion(d, t); apply(d.el, m.tr);
    d.ghosts.forEach((g, k) => { const lag = 0.045 * (k + 1), mg = motion(d, t - lag); apply(g, mg.tr); g.style.opacity = t > T_ROLL * 0.85 || t < lag ? 0 : (k ? 0.16 : 0.32); });
    if (m.seg > d.seg) {
      if (m.seg >= 1 && m.seg <= 3) { const st = [1, 0.55, 0.3][m.seg - 1]; SND.bounce(st, (m.x / G.W - 0.5) * 1.4); impact(m.x, m.y + G.ds * 0.45, st); if (m.seg === 1 && navigator.vibrate) navigator.vibrate(15); }
      d.seg = m.seg;
    }
    if (t >= T_ROLL) { d.state = 'landed'; place(d); dieDone(); }
  }
  if (any) requestAnimationFrame(loop); else rafOn = false;
}
function impact(x, y, st) {
  const r = document.createElement('i'); r.className = 'fx-ring'; r.style.cssText = `left:${x}px;top:${y}px;--s:${0.6 + st}`; fxBox.appendChild(r);
  for (let k = 0; k < Math.round(4 + st * 8); k++) {
    const sp = document.createElement('i'); sp.className = 'spark' + (k % 3 ? '' : ' c');
    const a = Math.PI * (1.05 + Math.random() * 0.9), v = (24 + Math.random() * 46) * (0.5 + st);
    sp.style.cssText = `left:${x}px;top:${y}px;--dx:${Math.cos(a) * v}px;--dy:${Math.sin(a) * v * 0.7}px`; fxBox.appendChild(sp);
  }
  setTimeout(() => { fxBox.innerHTML = ''; }, 800);
}
function rollDie(i, sym, delay) {
  const d = D[i], face = FACES[PERM[i].indexOf(sym)], [rx, rz] = RF[face], sg = Math.random() < 0.5 ? -1 : 1;
  Object.assign(d, { state: 'roll', face, seg: 0, t0: performance.now() / 1000 + delay, lx: G.lx[i] + (Math.random() - 0.5) * G.W * 0.04, ly: G.landY + (i === 1 ? 0.03 : -0.01) * G.H + (Math.random() - 0.5) * G.H * 0.03,
    yawF: (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 20), ax0: 1080 + 360 * Math.floor(Math.random() * 2) - rx, az0: 360 * sg - rz, sym });
  setTimeout(() => SND.rollDie((G.hx[i] / G.W - 0.5) * 1.2), delay * 1000);
  if (!rafOn) { rafOn = true; requestAnimationFrame(loop); }
}
function landInstant(i, sym) {
  const d = D[i]; d.face = FACES[PERM[i].indexOf(sym)]; d.state = 'landed'; d.lx = G.lx[i]; d.ly = G.landY; d.yawF = 20; d.sym = sym; place(d);
}
let pendingSettle = null;
function dieDone() {
  if (D.some((d) => d.state === 'roll')) return;
  if (pendingSettle) { const m = pendingSettle; pendingSettle = null; setTimeout(() => showResult(m), 300); }
  else { pulling = false; if (S.released < 3) { lowerBar(); armHint(); } }
}

// 横杠：放骰时竖直抬起，剩余骰子时放回
function liftBar(px) { animLift(px); }
function lowerBar() { animLift(0); }
let liftAnim = null;
function animLift(to) {
  cancelAnimationFrame(liftAnim); const from = G.lift, t0 = performance.now();
  const f = (n) => { const k = Math.min(1, (n - t0) / 220); G.lift = from + (to - from) * (1 - Math.pow(1 - k, 3)); drawRope(); if (k < 1) liftAnim = requestAnimationFrame(f); };
  liftAnim = requestAnimationFrame(f);
}

// ================= 拉绳（触屏 / 鼠标拖动把手） =================
let drag = null;
const LIGHT = 16;
function canPull(quiet) {
  if (pulling || S.phase === 'show') return false;
  if (!sum(S.mine)) { if (!quiet) toast('请先下注'); return false; }
  return S.released < 3;
}
ropeEl.addEventListener('pointerdown', (e) => {
  if (drag) return; e.preventDefault();
  drag = { y0: e.clientY, lv: 0, id: e.pointerId }; ropeEl.setPointerCapture(e.pointerId); hideHint(); SND.grab(); SND.tryResume();
});
ropeEl.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const d = Math.max(0, Math.min(G.D, e.clientY - drag.y0)); G.drag = d;
  if (!pulling) G.lift = Math.min(6, d * 0.06);
  const lv = d >= G.D * 0.82 ? 2 : d >= LIGHT ? 1 : 0;
  if (lv > drag.lv) { SND.notch(lv); if (navigator.vibrate) navigator.vibrate(lv === 2 ? 20 : 8); }
  drag.lv = lv; drawRope();
});
function endDrag(e) {
  if (!drag || (e && e.pointerId !== drag.id)) return;
  const lv = drag.lv; drag = null;
  const from = G.drag, t0 = performance.now();
  const f = (n) => { const k = Math.min(1, (n - t0) / 260); G.drag = from * Math.pow(1 - k, 3) * (1 + 0.15 * Math.sin(k * 9)); if (!pulling && G.lift < 8) G.lift = Math.max(0, G.lift * (1 - k)); drawRope(); if (k < 1) requestAnimationFrame(f); else { G.drag = 0; drawRope(); } };
  requestAnimationFrame(f);
  SND.ropeBack();
  if (lv && canPull()) doPull(lv === 2 ? 3 : 1); else armHint();
}
ropeEl.addEventListener('pointerup', endDrag); ropeEl.addEventListener('pointercancel', endDrag);
function doPull(n) {
  if (!ws || ws.readyState !== 1) return toast('网络连接中，请稍候');
  pulling = true; ws.send(JSON.stringify({ t: 'pull', n }));
}
window.__pull = (n) => { if (canPull()) { SND.ropeBack(); doPull(n); } };   // 调试 / 自动化测试用

// 拉绳提示箭头：玩家一段时间没拉才出现，每 2 秒弹两下（暗→亮）
let hintT;
function hideHint() { clearTimeout(hintT); hintEl.classList.remove('on'); }
function armHint() { hideHint(); if (!canPull(true)) return; hintT = setTimeout(() => { if (canPull(true) && !drag) hintEl.classList.add('on'); }, 4000); }

// ================= 回合流程 =================
function onDrop(m) {
  hideHint(); SND.release(); liftBar(Math.round(G.ds * 0.85));
  S.phase = 'drop'; board.classList.add('locked');
  m.drops.forEach((d, k) => { S.released = Math.max(S.released, d.i + 1); rollDie(d.i, d.s, 0.12 + k * 0.32); });
  if (m.done) pendingSettle = m;
}
function showResult(m) {
  const r = m.result, cnt = m.counts;
  S.phase = 'show'; pulling = false;
  SND.reveal();
  $('#win3d').innerHTML = r.map((s, k) => `<div class="mw" style="--k:${k}"><div class="medal"><i class="edge"></i><div class="face"><img src="${IMG(s)}" alt=""></div><i class="shine"></i></div><span class="nm">${SYMS[s].short}</span></div>`).join('');
  retrigger($('#win3d'), 'go'); $('#ring').classList.add('hot');
  peds.forEach((t, i) => { if (cnt[i]) { t.classList.add('win'); $('#badge' + i).textContent = '×' + cnt[i]; } else t.classList.add('dim'); });
  S.balance = m.balance; S.mine = toObj(m.bets);
  const win = m.myWin, bet = m.myBet, pop = $('#resultPop');
  if (win > 0) { renderBalance(true); pop.className = 'result-pop win'; pop.innerHTML = `+${fmt(win)}`; SND.win(win - bet >= bet * 2 || win >= 10000); }
  else { renderBalance(); pop.className = 'result-pop lose'; pop.innerHTML = '本局未中奖'; SND.lose(); }
  retrigger(pop, 'go');
  S.lastBets = { ...S.mine }; localStorage.setItem('yxx_last', JSON.stringify(S.lastBets));
  S.history.unshift(r); S.rounds = (S.rounds || 0) + 1;
  clearTimeout(resetT); resetT = setTimeout(resetRound, 5200);
}
let resetT;
function resetRound() {
  clearTimeout(resetT);
  S.phase = 'bet'; S.released = 0; S.mine = {}; pulling = false; pendingSettle = null;
  peds.forEach((t) => t.classList.remove('win', 'dim')); board.classList.remove('locked');
  $('#win3d').classList.remove('go'); $('#win3d').innerHTML = ''; $('#ring').classList.remove('hot'); $('#resultPop').classList.remove('go');
  D.forEach((d) => { d.state = 'held'; d.yaw = 16 + Math.random() * 10; place(d); retrigger(d.el, 'back'); });
  lowerBar(); setRound(S.round + 1); renderAll(); SND.start();
}

// ================= WebSocket =================
function onMsg(m) {
  if (m.now) S.offset = m.now - Date.now();
  switch (m.t) {
    case 'auth': toast(m.error); logout(); break;
    case 'state':
      S.me = m.me.name; $('#meName').textContent = S.me;
      S.history = m.history || []; S.rounds = m.rounds || 0; setRound(m.round);
      if (S.phase !== 'show' && !D.some((d) => d.state === 'roll')) {
        if (!S.inflight) { S.balance = m.me.balance; S.mine = toObj(m.myBets); }
        S.released = m.released || 0;
        S.phase = S.released ? 'drop' : 'bet'; board.classList.toggle('locked', !!S.released);
        D.forEach((d, i) => { if (i < S.released) landInstant(i, m.landed[i]); else { d.state = 'held'; place(d); } });
        G.lift = 0; drawRope();
      }
      renderAll(); armHint(); break;
    case 'betok':
      S.inflight = Math.max(0, (S.inflight || 0) - 1);
      setRound(m.round);
      if (!S.inflight) { S.balance = m.balance; S.mine = toObj(m.myBets); renderAll(); }
      armHint(); break;
    case 'betfail':
      S.inflight = Math.max(0, (S.inflight || 0) - 1);
      S.balance = m.balance; if (m.myBets) S.mine = toObj(m.myBets);
      renderAll(); toast(m.error); break;
    case 'cancelok':
      S.inflight = 0; S.balance = m.balance; S.mine = {}; S.pending = {};
      renderAll(); renderBalance(true); SND.clear(); toast('已取消下注，退还 ' + fmt(m.refund)); armHint(); break;
    case 'cancelfail': toast(m.error); break;
    case 'drop': onDrop(m); break;
    case 'pullfail': pulling = false; toast(m.error); armHint(); break;
  }
}
let retry = 0;
function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(token)}`);
  ws.onopen = () => { retry = 0; };
  ws.onmessage = (e) => { try { onMsg(JSON.parse(e.data)); } catch (err) { console.warn(err); } };
  ws.onclose = () => { sending = false; pulling = false; if (!token || !entered) return; setTimeout(connect, Math.min(5000, 500 * 2 ** retry++)); };
}

async function enter() {
  if (entered) return; entered = true;
  $('#login').hidden = true; $('#lobby').hidden = false; syncMusicIcons();
  SND.music('lobby'); SND.tryResume();
  const imgs = await imgsPromise;
  faceURL = STY.map((st) => imgs.map((im) => faceImg(im, st)));
  buildDice(); layout(); renderAll();
  connect();
}
addEventListener('resize', () => { if (entered) layout(); });
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
