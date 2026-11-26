// 用法: node tools/render-audio.js   （需要 playwright + 系统 chrome + ffmpeg）
// 离线合成所有原创音频并压缩成 mp3，输出到 audio/
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const names = process.argv.slice(2).length ? process.argv.slice(2) : ['bgm', 'gong', 'riser', 'tick', 'drumroll', 'impact', 'thump', 'reveal', 'bigwin', 'smallwin', 'lose', 'ding', 'start'];
const mono = new Set(['tick', 'thump']);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome' });
  const p = await b.newPage(); await p.goto('file://' + path.join(__dirname, 'render-audio.html'));
  fs.mkdirSync(path.join(__dirname, '../audio'), { recursive: true });
  for (const n of names) {
    const b64 = await p.evaluate((x) => window.RENDER(x), n);
    const wav = `/tmp/yxx-${n}.wav`; fs.writeFileSync(wav, Buffer.from(b64, 'base64'));
    const out = path.join(__dirname, '../audio', n + '.mp3');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', wav, '-ac', mono.has(n) ? '1' : '2', '-c:a', 'libmp3lame', '-b:a', n === 'bgm' ? '112k' : '96k', out]);
    console.log(n, (fs.statSync(out).size / 1024).toFixed(0) + 'KB');
  }
  await b.close();
})();
