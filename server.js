/* 鱼虾蟹 演示服务器：注册登录 + 公共大厅（服务端开奖、机器人、WebSocket 广播）
 * 仅虚拟演示币，无任何充值 / 兑换 / 支付功能。 */
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const { WebSocketServer } = require('ws');

const PORT = +process.env.PORT || 8790;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const START_BAL = 10000;
const CHIPS = [10, 50, 100, 500, 1000];
const MAX_BET_PER_ROUND = 1000000;
const T = { bet: 15000, lock: 1500, roll: 3300, show: 5000 };
const SYM_NAMES = ['大象', '兔子', '红鲤鱼', '虾', '孔雀', '马'];
const ROBOTS = ['阿强', '小美', 'LuckyKing', '金龙', 'Somchai', '财神到', '海风', '老王', 'Noy', '阿杰', '发财哥', 'Mali', '小鱼儿',
  'Bounmy', '星辰', 'Kham', '大头', 'Lina', '阿福', 'Tony88', '旺旺', 'Vong', '锦鲤附体', 'Ploy', '一路发', 'Sengdao', '豹子头', 'Ken', '好运来', 'Nana'];

// ---------------- 存储（JSON 文件） ----------------
fs.mkdirSync(DATA_DIR, { recursive: true });
let db = { users: {}, sessions: {}, history: [], round: 1000 };
try { db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) }; } catch (_) {}
let saveT;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, DB_FILE);
  }, 300);
}
function saveNow() { clearTimeout(saveT); fs.writeFileSync(DB_FILE, JSON.stringify(db)); }
process.on('SIGINT', () => { saveNow(); process.exit(0); });
process.on('SIGTERM', () => { saveNow(); process.exit(0); });

const keyOf = (u) => String(u).trim().toLowerCase();

// 固定测试账号：TEST_USER / TEST_PASS 环境变量（Render 免费版磁盘会重置，启动时自动补建）
(function seedTestAccount() {
  const name = process.env.TEST_USER || 'test01', pass = process.env.TEST_PASS;
  if (!pass) return;
  const k = keyOf(name), bal = +(process.env.TEST_BALANCE || 1000000);
  const u = db.users[k];
  if (!u || !bcrypt.compareSync(pass, u.hash)) {
    db.users[k] = { name, hash: bcrypt.hashSync(pass, 10), balance: u ? u.balance : bal, created: u ? u.created : Date.now() };
  }
  if (!u) console.log('seeded test account', name);
  saveNow();
})();
const USER_RE = /^[A-Za-z0-9_\u4e00-\u9fa5]{3,16}$/;

// ---------------- HTTP ----------------
const app = express();
app.set('trust proxy', true);
app.use(require('compression')());
app.use(express.json({ limit: '10kb' }));

const regLog = new Map(); // ip -> [timestamps]
const loginFail = new Map();
function rate(map, ip, limit, windowMs) {
  const now = Date.now();
  const arr = (map.get(ip) || []).filter((t) => now - t < windowMs);
  map.set(ip, arr);
  return arr.length >= limit;
}

function newSession(name) {
  const token = crypto.randomBytes(24).toString('hex');
  db.sessions[token] = { user: keyOf(name), at: Date.now() };
  save();
  return token;
}
function userByToken(token) {
  const s = token && db.sessions[token];
  return s ? db.users[s.user] : null;
}
const pub = (u) => ({ name: u.name, balance: u.balance });

app.post('/api/register', async (req, res) => {
  const ip = req.ip;
  const { username, password } = req.body || {};
  if (!USER_RE.test(username || '')) return res.status(400).json({ error: '用户名需 3-16 位字母、数字、下划线或中文' });
  if (typeof password !== 'string' || password.length < 6 || password.length > 32) return res.status(400).json({ error: '密码需 6-32 位' });
  if (rate(regLog, ip, 20, 3600e3)) return res.status(429).json({ error: '注册太频繁，请稍后再试' });
  const k = keyOf(username);
  if (db.users[k]) return res.status(409).json({ error: '用户名已被注册' });
  db.users[k] = { name: username.trim(), hash: await bcrypt.hash(password, 10), balance: START_BAL, created: Date.now() };
  regLog.get(ip).push(Date.now());
  const token = newSession(username);
  res.json({ token, user: pub(db.users[k]) });
});

app.post('/api/login', async (req, res) => {
  const ip = req.ip;
  if (rate(loginFail, ip, 15, 600e3)) return res.status(429).json({ error: '尝试次数过多，请 10 分钟后再试' });
  const { username, password } = req.body || {};
  const u = db.users[keyOf(username || '')];
  if (!u || typeof password !== 'string' || !(await bcrypt.compare(password, u.hash))) {
    loginFail.get(ip).push(Date.now());
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  res.json({ token: newSession(u.name), user: pub(u) });
});

app.get('/api/me', (req, res) => {
  const u = userByToken((req.headers.authorization || '').replace(/^Bearer /, ''));
  if (!u) return res.status(401).json({ error: '未登录' });
  res.json({ user: pub(u) });
});
app.post('/api/logout', (req, res) => {
  delete db.sessions[(req.headers.authorization || '').replace(/^Bearer /, '')]; save(); res.json({ ok: true });
});
app.get('/healthz', (_req, res) => res.json({ ok: true, round: game.round, phase: game.phase }));

// 只对外提供前端文件（不暴露 data/ 与服务端代码）
const sendFile = (f) => (_req, res) => res.sendFile(path.join(__dirname, f));
app.get('/', sendFile('online/index.html'));
app.get('/online.js', sendFile('online/online.js'));
app.get('/online.css', sendFile('online/online.css'));
['style.css', 'symbols.js', 'audio.js'].forEach((f) => app.get('/' + f, sendFile(f)));
app.use('/o', express.static(path.join(__dirname, 'online'), { maxAge: '1h', index: false, setHeaders: (res, f) => { if (/\.(webp|woff2|mp3)$|vendor/.test(f)) res.setHeader('Cache-Control', 'public, max-age=604800'); } }));
app.use('/audio', express.static(path.join(__dirname, 'audio'), { maxAge: '7d', index: false }));

const server = http.createServer(app);

// ---------------- 游戏大厅 ----------------
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
const clients = new Set(); // {ws, user}
const game = { round: db.round, phase: 'bet', endAt: 0, pools: [0, 0, 0, 0, 0, 0], bets: new Map(), robotBets: [], result: null };

function send(ws, msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }
function broadcast(msg) { const s = JSON.stringify(msg); for (const c of clients) if (c.ws.readyState === 1) c.ws.send(s); }
const onlineCount = () => new Set([...clients].map((c) => c.user.name)).size + ROBOTS.length;
function snapshot(c) {
  return {
    t: 'state', round: game.round, phase: game.phase, endAt: game.endAt, now: Date.now(),
    pools: game.pools, history: db.history.slice(0, 20), result: game.result, online: onlineCount(),
    me: pub(c.user), myBets: game.bets.get(keyOf(c.user.name)) || [0, 0, 0, 0, 0, 0], T,
  };
}
function setPhase(p, dur, extra) {
  game.phase = p; game.endAt = Date.now() + dur;
  broadcast({ t: 'phase', phase: p, round: game.round, endAt: game.endAt, now: Date.now(), ...extra });
}

function startBet() {
  game.round++; db.round = game.round; save();
  game.pools = [0, 0, 0, 0, 0, 0]; game.bets = new Map(); game.robotBets = []; game.result = null;
  setPhase('bet', T.bet, { pools: game.pools });
  for (let k = 0; k < 4 + crypto.randomInt(4); k++) setTimeout(robotBet, k * 120);
  scheduleRobot(600);
  setTimeout(lock, T.bet);
}
let robotT;
function scheduleRobot(ms) { clearTimeout(robotT); robotT = setTimeout(() => { robotBet(); const left = game.endAt - Date.now(); if (game.phase === 'bet') scheduleRobot(left < 4000 ? 90 + crypto.randomInt(200) : 220 + crypto.randomInt(520)); }, ms); }
function robotBet() {
  if (game.phase !== 'bet') return;
  const name = ROBOTS[crypto.randomInt(ROBOTS.length)];
  const w = crypto.randomInt(100);
  const base = w < 28 ? 10 : w < 58 ? 50 : w < 82 ? 100 : w < 96 ? 500 : 1000;
  const amt = base * (1 + (crypto.randomInt(10) < 3 ? crypto.randomInt(4) : 0));
  const i = crypto.randomInt(6);
  game.pools[i] += amt;
  game.robotBets.push({ name, i, amt });
  broadcast({ t: 'bet', name, sym: i, amt, pool: game.pools[i] });
}
function lock() {
  clearTimeout(robotT);
  setPhase('lock', T.lock);
  setTimeout(roll, T.lock);
}
function roll() {
  game.result = [crypto.randomInt(6), crypto.randomInt(6), crypto.randomInt(6)];
  setPhase('roll', T.roll, { result: game.result });
  setTimeout(reveal, T.roll);
}
function reveal() {
  const r = game.result, cnt = [0, 0, 0, 0, 0, 0];
  r.forEach((s) => cnt[s]++);
  const winners = [];
  const payouts = new Map();
  for (const [k, bets] of game.bets) {
    const u = db.users[k]; if (!u) continue;
    let win = 0, bet = 0;
    bets.forEach((b, i) => { bet += b; if (b && cnt[i]) win += b * (1 + cnt[i]); });
    u.balance += win;
    payouts.set(k, { win, bet });
    if (win) winners.push({ name: u.name, win });
  }
  const rw = {};
  game.robotBets.forEach((b) => { if (cnt[b.i]) rw[b.name] = (rw[b.name] || 0) + b.amt * (1 + cnt[b.i]); });
  Object.entries(rw).forEach(([name, win]) => winners.push({ name, win }));
  winners.sort((a, b) => b.win - a.win);
  db.history.unshift(r); db.history = db.history.slice(0, 50); save();
  game.phase = 'show'; game.endAt = Date.now() + T.show;
  for (const c of clients) {
    const k = keyOf(c.user.name);
    const p = payouts.get(k) || { win: 0, bet: 0 };
    send(c.ws, { t: 'phase', phase: 'show', round: game.round, endAt: game.endAt, now: Date.now(), result: r, counts: cnt,
      myWin: p.win, myBet: p.bet, balance: c.user.balance, winners: winners.slice(0, 3) });
  }
  setTimeout(startBet, T.show);
}

wss.on('connection', (ws, req) => {
  const token = new URL(req.url, 'http://x').searchParams.get('token');
  const user = userByToken(token);
  if (!user) { send(ws, { t: 'auth', error: '请重新登录' }); return ws.close(); }
  const c = { ws, user };
  clients.add(c);
  send(ws, snapshot(c));
  broadcast({ t: 'online', n: onlineCount() });
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch (_) { return; }
    if (m.t === 'bet') return placeBet(c, m);
    if (m.t === 'ping') return send(ws, { t: 'pong', now: Date.now() });
  });
  ws.on('close', () => { clients.delete(c); broadcast({ t: 'online', n: onlineCount() }); });
});
setInterval(() => { for (const c of clients) { if (!c.ws.isAlive) { c.ws.terminate(); continue; } c.ws.isAlive = false; c.ws.ping(); } }, 25000);

function placeBet(c, m) {
  const fail = (error) => send(c.ws, { t: 'betfail', error, balance: c.user.balance });
  if (game.phase !== 'bet' || Date.now() > game.endAt - 150) return fail('已封盘，请等待下一回合');
  const bets = m.bets;
  if (!bets || typeof bets !== 'object') return fail('下注数据错误');
  const add = [0, 0, 0, 0, 0, 0];
  for (const [k, v] of Object.entries(bets)) {
    const i = Number(k);
    if (!Number.isInteger(i) || i < 0 || i > 5) return fail('下注数据错误');
    if (!Number.isInteger(v) || v <= 0 || v % 10 !== 0) return fail('下注金额错误');
    add[i] += v;
  }
  const total = add.reduce((a, b) => a + b, 0);
  if (!total) return fail('请先下注');
  const key = keyOf(c.user.name);
  const mine = game.bets.get(key) || [0, 0, 0, 0, 0, 0];
  if (mine.reduce((a, b) => a + b, 0) + total > MAX_BET_PER_ROUND) return fail('超过单局下注上限');
  if (total > c.user.balance) return fail('余额不足');
  c.user.balance -= total; save();
  add.forEach((v, i) => { mine[i] += v; game.pools[i] += v; });
  game.bets.set(key, mine);
  for (const o of clients) if (o.user === c.user) send(o.ws, { t: 'betok', balance: c.user.balance, myBets: mine, total });
  add.forEach((v, i) => { if (v) broadcast({ t: 'bet', name: c.user.name, sym: i, amt: v, pool: game.pools[i] }); });
}

server.listen(PORT, () => { console.log(`鱼虾蟹 server on :${PORT}`); startBet(); });
