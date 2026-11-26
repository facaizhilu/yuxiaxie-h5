// 用法: node set-account.js <用户名> <密码> <余额>   （服务器需先停止或之后重启，避免覆盖）
'use strict';
const fs = require('fs'), path = require('path'), bcrypt = require('bcryptjs');
const [name, pass, bal] = process.argv.slice(2);
if (!name || !pass) { console.error('usage: node set-account.js <user> <pass> [balance]'); process.exit(1); }
const file = path.join(__dirname, 'data', 'db.json');
fs.mkdirSync(path.dirname(file), { recursive: true });
let db = { users: {}, sessions: {}, history: [], round: 1000 };
try { db = { ...db, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch (_) {}
const k = name.toLowerCase();
db.users[k] = { ...(db.users[k] || { created: Date.now() }), name, hash: bcrypt.hashSync(pass, 10), balance: Number(bal || 1000000) };
fs.writeFileSync(file, JSON.stringify(db));
console.log('account set:', name, 'balance', db.users[k].balance);
