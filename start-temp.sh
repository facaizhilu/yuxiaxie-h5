#!/usr/bin/env bash
# 一键（重新）启动临时测试服务器 + Cloudflare 临时隧道
# 用法: ./start-temp.sh        公网地址会打印出来并写入 data/tunnel-url.txt
set -e
cd "$(dirname "$0")"
PORT="${PORT:-18790}"
CF="$(command -v cloudflared || echo "$HOME/.local/bin/cloudflared")"
mkdir -p data
[ -d node_modules ] || npm install --omit=dev
for f in data/server.pid data/tunnel.pid; do
  [ -f "$f" ] && kill "$(cat "$f")" 2>/dev/null || true
done
sleep 1
PORT=$PORT setsid nohup node server.js > data/server.log 2>&1 < /dev/null &
echo $! > data/server.pid
for i in $(seq 1 20); do curl -fs "http://localhost:$PORT/healthz" >/dev/null && break; sleep 0.5; done
setsid nohup "$CF" tunnel --no-autoupdate --protocol http2 --url "http://localhost:$PORT" > data/tunnel.log 2>&1 < /dev/null &
echo $! > data/tunnel.pid
URL=""
for i in $(seq 1 60); do
  URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' data/tunnel.log | head -1 || true)
  [ -n "$URL" ] && break; sleep 1
done
echo "$URL" > data/tunnel-url.txt
echo "server: http://localhost:$PORT"
echo "public: ${URL:-未获取到，请查看 data/tunnel.log}"
