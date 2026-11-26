# 资源来源与许可（v2 在线版重做）

## 0. v2 音乐与音效（原创合成，CC0 1.0）
`audio/v2/*.mp3` 全部由本仓库 `tools/render-audio2.html` + `tools/audio-lib.js` 用代码离线渲染（Web Audio 合成 / Karplus-Strong 物理建模），未使用任何第三方采样，按 CC0 1.0 发布。重新渲染：`node tools/render-audio2.js`（需要 playwright、Chrome、ffmpeg）。
- `login.mp3`：东南亚佛寺氛围曲，76 BPM D 五声音阶，16 小节无缝循环 —— 拉纳德木琴式琶音、围锣（khong wong）、钹（ching/chap）、通鼓、老挝笙（khaen）式簧管长音与旋律、寺钟、蟋蟀与风声、长混响。
- `lobby.mp3`：科幻电子曲，124 BPM A 小调（Am-F-C-G），16 小节无缝循环 —— 四拍底鼓、侧链超锯齿铺底、反拍贝斯、带延迟的方波琶音、第 8-15 小节主旋律、过门与上扬。
- 音效：chip、tap、hover、confirm、tick、riser、lock、spin、hit、land、reveal、win、bigwin、lose、start。
- 运行时另叠加下文第 2 节的 Kenney CC0 实录骰子/筹码/硬币采样。

## 图像、字体与库
- `online/img/*.webp`（六种图案与登录背景）：本项目用 AI 图像生成工具生成后抠图处理，为本项目原创素材。
- `online/fonts/orbitron.woff2`：Orbitron 字体，SIL Open Font License 1.1（见 `online/fonts/Orbitron-OFL.txt`）。
- `online/vendor/three.module.min.js`、`RoundedBoxGeometry.js`、`RoomEnvironment.js`：three.js r170，MIT 许可（见 `online/vendor/three-LICENSE.txt`）。

---

# 音频来源与许可

## 1. 原创合成音频（CC0 / 公共领域）
`audio/*.mp3`（bgm、gong、riser、tick、drumroll、impact、thump、reveal、bigwin、smallwin、lose、ding、start）
全部由本仓库的 `tools/render-audio.html` 用代码（Web Audio 合成器 + Karplus-Strong 拨弦）离线渲染而成，没有使用任何第三方采样或录音。
作者放弃一切权利，按 CC0 1.0 发布，可自由商用。重新渲染：`node tools/render-audio.js`（需要 playwright、Chrome、ffmpeg）。

- `bgm.mp3`：D 大调五声音阶，120 BPM，16 小节无缝循环（鼓/太鼓、低音、琵琶式拨弦、二胡式主旋律、铺底）

## 2. Kenney「Casino Audio」「RPG Audio」「UI Audio」音效（CC0 1.0）
`audio/kenney/*.mp3` 由 Kenney (https://kenney.nl) 的免费素材包转码（单声道 64 kbps mp3）而来。
- 许可：Creative Commons CC0 1.0 Universal —— https://creativecommons.org/publicdomain/zero/1.0/ （无需署名，可商用；这里仍致谢 Kenney）
- 素材包：Casino Audio https://kenney.nl/assets/casino-audio ，RPG Audio https://kenney.nl/assets/rpg-audio ，UI Audio https://kenney.nl/assets/ui-audio
- 获取方式：官网下载入口在本环境无法直接访问，因此取自 GitHub 上带有 CC0-1.0 许可证的 Kenney 素材镜像 https://github.com/iwenzhou/kenney （文件为 Kenney 原版 ogg）。

使用的文件：diceThrow1-3、dieShuffle1-3、dieThrow1-3、dieGrab1、chipLay1-3、chipsCollide1-2、chipsHandle1-2、chipsStack1/3/5（Casino）；handleCoins、handleCoins2、metalClick（RPG）；click1、click3、switch2（UI）。
