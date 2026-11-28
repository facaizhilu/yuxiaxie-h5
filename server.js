/* 鱼虾蟹 演示服务器：注册登录 + 单人局（下注→确认→拉绳放骰，服务端加密随机开奖、按用户结算）
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
const CHIPS = [10000, 50000, 100000, 500000, 1000000];
const MAX_BET_PER_ROUND = 100000000;
const SYM_NAMES = ['大象', '兔子', '红鲤鱼', '老虎', '孔雀', '马'];

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

// 固定测试账号：TEST_PASS 环境变量，TEST_USERS 为逗号分隔列表（默认 test01–test05）。
// Render 免费版磁盘会重置，启动时自动补建；已有账号只在密码不匹配时更新哈希，余额保留。
(function seedTestAccounts() {
  const pass = process.env.TEST_PASS;
  if (!pass) return;
  const names = (process.env.TEST_USERS || 'test01,test02,test03,test04,test05').split(/[,;\s]+/).filter(Boolean);
  const bal = +(process.env.TEST_BALANCE || 1000000);
  const added = [];
  for (const name of names) {
    const k = keyOf(name), u = db.users[k];
    if (!u || !bcrypt.compareSync(pass, u.hash)) {
      db.users[k] = { name, hash: bcrypt.hashSync(pass, 10), balance: u ? u.balance : bal, created: u ? u.created : Date.now() };
      if (!u) added.push(name);
    }
  }
  if (added.length) console.log('seeded test accounts', added.join(', '));
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
app.get('/healthz', (_req, res) => res.json({ ok: true, round: db.round }));

// 只对外提供前端文件（不暴露 data/ 与服务端代码）
// 版本号：优先用 Render 的提交号，否则对前端文件内容做哈希；index 永不缓存，资源 URL 带 ?v=版本
const crypto2 = require('crypto');
const OL = path.join(__dirname, 'online');
const BUILD = (() => {
  if (process.env.RENDER_GIT_COMMIT) return process.env.RENDER_GIT_COMMIT.slice(0, 8);
  const h = crypto2.createHash('md5');
  ['index.html', 'app.js', 'app.css', 'scene.js', 'sound.js'].forEach((f) => { try { h.update(fs.readFileSync(path.join(OL, f))); } catch (_) {} });
  return h.digest('hex').slice(0, 8);
})();
const noStore = (res) => res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
const INDEX_HTML = fs.readFileSync(path.join(OL, 'index.html'), 'utf8').replace(/__V__/g, BUILD);
app.get('/', (_req, res) => { noStore(res); res.type('html').send(INDEX_HTML); });
app.get('/version', (_req, res) => { noStore(res); res.json({ v: BUILD }); });
// 旧版客户端（被手机缓存的旧页面）会请求这个文件：返回一个“强制刷新”脚本
app.get('/online.js', (_req, res) => { noStore(res); res.type('js').send("(function(){var k='yxx_old_reload';if(sessionStorage.getItem(k))return;sessionStorage.setItem(k,'1');fetch('/',{cache:'reload'}).finally(function(){location.replace('/?r='+Date.now());});})();"); });
['online.css', 'style.css', 'symbols.js', 'audio.js'].forEach((f) => app.get('/' + f, (_req, res) => { noStore(res); res.sendFile(path.join(__dirname, f === 'online.css' ? 'online/online.css' : f)); }));
app.use('/o', express.static(OL, { maxAge: 0, index: false, setHeaders: (res, f) => {
  if (/\.(webp|woff2)$/.test(f) || /vendor/.test(f)) res.setHeader('Cache-Control', 'public, max-age=86400');
  else res.setHeader('Cache-Control', 'no-cache');
} }));
app.use('/audio', express.static(path.join(__dirname, 'audio'), { maxAge: '7d', index: false }));

const server = http.createServer(app);

// ---------------- 单人局 ----------------
// 每位玩家独立一局：确认下注时服务器用 crypto.randomInt 定下 3 颗骰子（不下发客户端），
// 每次拉绳只下发被放下的骰子；3 颗全部放下后按用户结算。未结算局存于用户记录，刷新/断线不丢。
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
const clients = new Set(); // {ws, user}
const ZERO = () => [0, 0, 0, 0, 0, 0];
function send(ws, msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }
function sendUser(u, msg) { const s = JSON.stringify(msg); for (const c of clients) if (c.user === u && c.ws.readyState === 1) c.ws.send(s); }
function snapshot(u) {
  const cur = u.cur;
  return { t: 'state', now: Date.now(), me: pub(u), history: (u.hist || []).slice(0, 30), rounds: u.rounds || 0,
    round: cur ? cur.id : db.round + 1, myBets: cur ? cur.bets : ZERO(), released: cur ? cur.released : 0,
    landed: cur ? cur.result.slice(0, cur.released) : [] };
}

wss.on('connection', (ws, req) => {
  const token = new URL(req.url, 'http://x').searchParams.get('token');
  const user = userByToken(token);
  if (!user) { send(ws, { t: 'auth', error: '请重新登录' }); return ws.close(); }
  const c = { ws, user };
  clients.add(c);
  send(ws, snapshot(user));
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch (_) { return; }
    if (m.t === 'bet') return placeBet(c, m);
    if (m.t === 'pull') return pull(c, m);
    if (m.t === 'cancel') return cancelBets(c);
    if (m.t === 'ping') return send(ws, { t: 'pong', now: Date.now() });
  });
  ws.on('close', () => { clients.delete(c); });
});
setInterval(() => { for (const c of clients) { if (!c.ws.isAlive) { c.ws.terminate(); continue; } c.ws.isAlive = false; c.ws.ping(); } }, 25000);

function placeBet(c, m) {
  const u = c.user;
  const fail = (error) => send(c.ws, { t: 'betfail', error, balance: u.balance, myBets: u.cur ? u.cur.bets : ZERO() });
  if (u.cur && u.cur.released > 0) return fail('骰子已放下，请等待开奖');
  const bets = m.bets;
  if (!bets || typeof bets !== 'object') return fail('下注数据错误');
  const add = ZERO();
  for (const [k, v] of Object.entries(bets)) {
    const i = Number(k);
    if (!Number.isInteger(i) || i < 0 || i > 5) return fail('下注数据错误');
    if (!Number.isInteger(v) || !CHIPS.includes(v)) return fail('下注金额错误');
    add[i] += v;
  }
  const total = add.reduce((a, b) => a + b, 0);
  if (!total) return fail('请先下注');
  const mine = u.cur ? u.cur.bets : ZERO();
  if (mine.reduce((a, b) => a + b, 0) + total > MAX_BET_PER_ROUND) return fail('超过单局下注上限');
  if (total > u.balance) return fail('余额不足');
  if (!u.cur) { db.round++; u.cur = { id: db.round, bets: mine, result: [crypto.randomInt(6), crypto.randomInt(6), crypto.randomInt(6)], released: 0 }; }
  u.balance -= total;
  add.forEach((v, i) => { mine[i] += v; });
  save();
  sendUser(u, { t: 'betok', balance: u.balance, myBets: mine, total, round: u.cur.id });
}

function pull(c, m) {
  const u = c.user, cur = u.cur;
  if (!cur || !cur.bets.some(Boolean)) return send(c.ws, { t: 'pullfail', error: '请先下注' });
  const n = m.n === 3 ? 3 : 1;
  const from = cur.released, k = Math.min(n, 3 - from);
  if (k <= 0) return send(c.ws, { t: 'pullfail', error: '骰子已全部放下' });
  cur.released += k;
  const drops = [];
  for (let i = from; i < from + k; i++) drops.push({ i, s: cur.result[i] });
  if (cur.released < 3) { save(); return sendUser(u, { t: 'drop', drops, done: false }); }
  const r = cur.result, cnt = ZERO();
  r.forEach((s) => cnt[s]++);
  let win = 0, bet = 0;
  cur.bets.forEach((b, i) => { bet += b; if (b && cnt[i]) win += b * (1 + cnt[i]); });
  u.balance += win;
  u.hist = [r, ...(u.hist || [])].slice(0, 30);
  u.rounds = (u.rounds || 0) + 1;
  const id = cur.id; delete u.cur; save();
  sendUser(u, { t: 'drop', drops, done: true, round: id, result: r, counts: cnt, myWin: win, myBet: bet, balance: u.balance, bets: cur.bets });
}


function cancelBets(c) {
  const u = c.user, cur = u.cur;
  const fail = (error) => send(c.ws, { t: 'cancelfail', error, balance: u.balance });
  if (!cur || !cur.bets.some(Boolean)) return fail('没有可取消的下注');
  if (cur.released > 0) return fail('骰子已放下，无法取消');
  const refund = cur.bets.reduce((a, b) => a + b, 0);
  u.balance += refund;
  delete u.cur;
  save();
  sendUser(u, { t: 'cancelok', balance: u.balance, refund, myBets: ZERO() });
}

server.listen(PORT, () => { console.log(`鱼虾蟹 server on :${PORT}`); });
