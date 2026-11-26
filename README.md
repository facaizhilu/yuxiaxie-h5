# 鱼虾蟹 H5 演示原型

手机优先的单页 H5 小游戏原型（纯 HTML/CSS/JS，无需构建）。

- 六种图案：大象、兔子、红鲤鱼、虾、孔雀、马（原创 SVG 插画，骰子每一面都是图案）
- 公共大厅、无座位：倒计时 15 秒下注 → 封盘 → 3D 骰子翻滚开奖（震屏、火花、冲击光圈）→ 派彩 → 近期开奖 → 下一回合
- 赔率：押中 1 个 1 赔 1，2 个 1 赔 2，3 个 1 赔 3（返还本金）
- 模拟玩家（机器人）在倒计时内下注，实时显示在押注滚动和各格子总额里
- 背景音乐、摇骰声、落地冲击、中奖音效全部由 Web Audio API 实时合成，右上角可静音
- 仅虚拟演示币（初始 10,000，用完自动补充），无任何充值、兑换或支付功能

本地运行：`npx serve .` 或直接用任意静态服务器打开 `index.html`。

## 在线版（Node + WebSocket 公共大厅）

`server.js` + `online/`：注册 / 登录（bcrypt 加密密码）、服务端余额、服务端开奖与约 30 个机器人、WebSocket 广播所有下注与结果，所有人同一回合。仍然只用虚拟演示币。

- 本地运行：`npm install && node server.js`（默认端口 8790，可用 `PORT` 覆盖），打开 `http://localhost:8790/`
- 数据存放在 `data/db.json`（已在 .gitignore 中，不入库）
- 固定测试账号：设置环境变量 `TEST_USER`（默认 test01）、`TEST_PASS`、`TEST_BALANCE`（默认 1000000），启动时自动创建
- 也可手动设置：`node set-account.js <用户名> <密码> <余额>`（先停服务器）
- 临时服务器：`./start-temp.sh`（后台启动 server，并尝试开 cloudflared 临时隧道；地址写入 `data/tunnel-url.txt`）

### 部署到 Render（免费版）

仓库根目录有 `render.yaml`。在 Render 控制台 New → Blueprint，选择本仓库，按提示填写 `TEST_PASS` 即可，推送到 main 会自动部署。
免费版磁盘是临时的：重新部署或休眠重启后注册的账号与余额会重置，test01 会按环境变量自动重建为 1,000,000。免费实例闲置约 15 分钟会休眠，首次打开需等待约 30-60 秒。

## 音频
BGM 与大部分特效由 `tools/render-audio.html` 用代码合成（CC0），骰子/筹码/金币采样来自 Kenney CC0 素材包，全部预加载（约 1 MB）。详见 `LICENSES/AUDIO-CREDITS.md`。
