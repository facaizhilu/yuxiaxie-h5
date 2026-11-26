/* 3D 开奖舞台 v5：俯视约 53° 的金属骰盘 + 三颗 PBR 金属圆角骰子
 * 流程：待机（静止在盘面，顶面=上一局结果）→ 封盘（骰子升空）→ 开奖（空中猛烈摇晃 ~4s）→ 落下（重力/弹跳/落定，顶面=结果）→ 揭晓（镜头推近、发光）*/
import * as THREE from './vendor/three.module.min.js';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const HALF = 0.68, G = 26, SHAKE = 4.0;
const BXS = 1.85, BZS = 0.8;                 // 空中摇晃范围（骰子中心）
const SLOTS = [[-1.72, 0.14], [0, -0.26], [1.72, 0.22]];
const LAYOUTS = [[0, 1, 2, 3, 4, 5], [2, 4, 0, 5, 1, 3], [5, 3, 1, 0, 2, 4]];
const STYLES = [
  { base: ['#f4f6fa', '#9aa3b2'], rim: '#7fe9ff', medal: ['#1b2633', '#0a1018'], metal: 0.7, rough: 0.3 },
  { base: ['#9a1a28', '#2e050a'], rim: '#ffcf7a', medal: ['#3a0a10', '#120204'], metal: 0.6, rough: 0.32 },
  { base: ['#ffe3a0', '#a8741e'], rim: '#fff2c4', medal: ['#3a2508', '#140b02'], metal: 0.8, rough: 0.28 },
];

function faceTexture(img, st, maxAniso) {
  const S = 1024, k = S / 320, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  const bg = g.createRadialGradient(S * 0.35, S * 0.3, 10 * k, S / 2, S / 2, S * 0.75); bg.addColorStop(0, st.base[0]); bg.addColorStop(1, st.base[1]);
  g.fillStyle = bg; g.fillRect(0, 0, S, S);
  g.strokeStyle = st.rim; g.globalAlpha = 0.55; g.lineWidth = 4 * k; g.strokeRect(18 * k, 18 * k, S - 36 * k, S - 36 * k); g.globalAlpha = 0.25; g.lineWidth = 2 * k; g.strokeRect(30 * k, 30 * k, S - 60 * k, S - 60 * k); g.globalAlpha = 1;
  const md = g.createRadialGradient(S / 2, S / 2, 20 * k, S / 2, S / 2, S * 0.4); md.addColorStop(0, st.medal[0]); md.addColorStop(1, st.medal[1]);
  g.beginPath(); g.arc(S / 2, S / 2, S * 0.38, 0, Math.PI * 2); g.fillStyle = md; g.fill();
  g.lineWidth = 5 * k; g.strokeStyle = st.rim; g.shadowColor = st.rim; g.shadowBlur = 14 * k; g.stroke(); g.shadowBlur = 0;
  g.save(); g.beginPath(); g.arc(S / 2, S / 2, S * 0.36, 0, Math.PI * 2); g.clip();
  const r = S * 0.64; g.drawImage(img, (S - r) / 2, (S - r) / 2, r, r); g.restore();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; return t;
}
function radialTex(stops, size = 128) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const g = cv.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); stops.forEach(([o, c]) => gr.addColorStop(o, c));
  g.fillStyle = gr; g.fillRect(0, 0, size, size); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function hexTex(lineA, bgc, rep, size = 1024, r = 52) {
  const S = size, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d');
  g.fillStyle = bgc; g.fillRect(0, 0, S, S); g.strokeStyle = lineA; g.lineWidth = 2.5;
  const h = Math.sqrt(3) * r;
  for (let y = -1; y < S / h + 1; y++) for (let x = -1; x < S / (r * 1.5) + 1; x++) {
    const cx = x * r * 1.5, cy = y * h + (x % 2 ? h / 2 : 0); g.beginPath();
    for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k; g.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); } g.closePath(); g.stroke();
  }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function faceInfo() {
  // 由 BoxGeometry 的 UV 算出每个面的法线和“图片朝上”方向
  const geo = new THREE.BoxGeometry(1, 1, 1), pos = geo.attributes.position, uv = geo.attributes.uv, idx = geo.index, out = [];
  geo.groups.forEach((gr) => {
    const i0 = idx.getX(gr.start), i1 = idx.getX(gr.start + 1), i2 = idx.getX(gr.start + 2);
    const p0 = new THREE.Vector3().fromBufferAttribute(pos, i0), p1 = new THREE.Vector3().fromBufferAttribute(pos, i1), p2 = new THREE.Vector3().fromBufferAttribute(pos, i2);
    const u0 = new THREE.Vector2().fromBufferAttribute(uv, i0), u1 = new THREE.Vector2().fromBufferAttribute(uv, i1), u2 = new THREE.Vector2().fromBufferAttribute(uv, i2);
    const e1 = p1.clone().sub(p0), e2 = p2.clone().sub(p0), d1 = u1.clone().sub(u0), d2 = u2.clone().sub(u0);
    const rr = 1 / (d1.x * d2.y - d2.x * d1.y);
    const B = e2.clone().multiplyScalar(d1.x).sub(e1.clone().multiplyScalar(d2.x)).multiplyScalar(rr).normalize();
    const N = e1.clone().cross(e2).normalize(); out.push({ n: N, up: B });
  });
  geo.dispose(); return out;
}
const FACES = faceInfo();
function orient(face, dirN, dirUp) {
  const f = FACES[face], L = new THREE.Matrix4().makeBasis(f.up, f.n, f.up.clone().cross(f.n));
  const up = dirUp.clone().sub(dirN.clone().multiplyScalar(dirUp.dot(dirN))).normalize();
  const W = new THREE.Matrix4().makeBasis(up, dirN, up.clone().cross(dirN));
  return new THREE.Quaternion().setFromRotationMatrix(W.multiply(L.transpose()));
}
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));


const rnd = (a, b) => a + Math.random() * (b - a);

export async function createStage(host, imgs, hooks = {}) {
  const dpr = window.devicePixelRatio || 1;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  let curPR = Math.min(dpr, 3); const minPR = Math.min(dpr, 2);          // iPhone(3x) 不低于 2x
  renderer.setPixelRatio(curPR);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  const look = new THREE.Vector3(0, 0.55, 0.1);
  const CAM = { base: new THREE.Vector3(), roll: new THREE.Vector3(), show: new THREE.Vector3() };
  const camPos = new THREE.Vector3(), camTarget = new THREE.Vector3();

  // ---- 灯光（含真实阴影）----
  scene.add(new THREE.HemisphereLight(0x9fd8ff, 0x101820, 0.4));
  const key = new THREE.DirectionalLight(0xffffff, 3.0); key.position.set(2.6, 8, 3.2); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); const sc = key.shadow.camera; sc.left = -5; sc.right = 5; sc.top = 3.8; sc.bottom = -3.8; sc.near = 2; sc.far = 18;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025; key.shadow.radius = 3.5; scene.add(key);
  const rim = new THREE.DirectionalLight(0xffc27a, 1.1); rim.position.set(-5, 3.5, -3); scene.add(rim);
  const core = new THREE.PointLight(0x47e5ff, 5, 7, 1.6); core.position.set(0, 0.9, 0.4); scene.add(core);
  const flash = new THREE.PointLight(0xfff0c0, 0, 9, 1.4); flash.position.set(0, 1.6, 0.6); scene.add(flash);

  // ---- 外围六边形地面 + 骰盘 ----
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshBasicMaterial({ map: hexTex('rgba(70,220,255,0.5)', '#000', [8, 8]), alphaMap: radialTex([[0, '#fff'], [0.5, '#666'], [1, '#000']], 256), transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false, color: 0x2ab8ff }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.46; scene.add(outer);
  const metal = new THREE.MeshStandardMaterial({ color: 0x232f3f, metalness: 0.92, roughness: 0.32 });
  const TW = 6.2, TD = 3.9;
  const tray = new THREE.Mesh(new RoundedBoxGeometry(TW + 0.7, 0.5, TD + 0.7, 4, 0.12), metal); tray.position.y = -0.27; tray.receiveShadow = true; scene.add(tray);
  const floorMat = new THREE.MeshStandardMaterial({ map: hexTex('rgba(80,200,240,0.34)', '#16304a', [3.6, 2.3]), color: 0xffffff, metalness: 0.55, roughness: 0.38, envMapIntensity: 0.8 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(TW, TD), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.002; floor.receiveShadow = true; scene.add(floor);
  const wallM = new THREE.MeshStandardMaterial({ color: 0x2c3b50, metalness: 0.95, roughness: 0.28 });
  [[0, -TD / 2 - 0.12, TW + 0.7, 0.26], [0, TD / 2 + 0.12, TW + 0.7, 0.26], [-TW / 2 - 0.12, 0, 0.26, TD], [TW / 2 + 0.12, 0, 0.26, TD]].forEach(([x, z, w, d]) => {
    const wmesh = new THREE.Mesh(new RoundedBoxGeometry(w, 0.34, d, 3, 0.08), wallM); wmesh.position.set(x, 0.12, z); wmesh.castShadow = true; wmesh.receiveShadow = true; scene.add(wmesh);
  });
  const trim = new THREE.MeshBasicMaterial({ color: 0x4fe9ff, toneMapped: false, transparent: true, opacity: 0.8 });   // 静态细灯带，不旋转
  [[0, -TD / 2, TW, 0.025], [0, TD / 2, TW, 0.025], [-TW / 2, 0, 0.025, TD], [TW / 2, 0, 0.025, TD]].forEach(([x, z, w, d]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), trim); m.position.set(x, 0.3, z); scene.add(m); });

  // ---- 上升能量粒子（解释骰子悬浮） ----
  const PN = 200, pGeo = new THREE.BufferGeometry(), pPos = new Float32Array(PN * 3), pSpd = new Float32Array(PN);
  for (let i = 0; i < PN; i++) { pPos[i * 3] = rnd(-2.6, 2.6); pPos[i * 3 + 1] = rnd(0, 3); pPos[i * 3 + 2] = rnd(-1.6, 1.6); pSpd[i] = rnd(0.2, 0.7); }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  scene.add(new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.06, map: radialTex([[0, '#fff'], [0.3, 'rgba(120,230,255,0.8)'], [1, 'rgba(0,0,0,0)']], 64), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0x9ff4ff, opacity: 0.8 })));

  // ---- 落地冲击波（每颗骰子一个，一次性扩散，不旋转） + 揭晓发光 ----
  const ringGeo = new THREE.RingGeometry(0.7, 0.86, 64);
  const mkRing = (c) => { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); m.rotation.x = -Math.PI / 2; m.position.y = 0.02; scene.add(m); return m; };
  const rings = [mkRing(0xffe08a), mkRing(0xffe08a), mkRing(0xffe08a)], bigRing = mkRing(0x7fefff);
  const glowTex = radialTex([[0, 'rgba(255,225,140,0.95)'], [0.4, 'rgba(255,180,70,0.35)'], [1, 'rgba(0,0,0,0)']]);

  // ---- 骰子 ----
  const aniso = Math.min(16, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1);
  const geo = new RoundedBoxGeometry(HALF * 2, HALF * 2, HALF * 2, 6, 0.12);
  const dice = STYLES.map((st, d) => {
    const mats = LAYOUTS[d].map((sym) => new THREE.MeshStandardMaterial({ map: faceTexture(imgs[sym], st, aniso), metalness: st.metal, roughness: st.rough, envMapIntensity: 1.15, emissive: 0x000000 }));
    const mesh = new THREE.Mesh(geo, mats); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.5), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    gl.rotation.x = -Math.PI / 2; gl.position.y = 0.03; scene.add(gl);
    return { mesh, mats, gl, i: d, p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), qf: new THREE.Quaternion(), tq: new THREE.Quaternion(), w: new THREE.Vector3(), tp: new THREE.Vector3(),
      nextT: 0, fall: false, settled: false, lastHit: 0, glow: 0, acc: 0, yaw: 0 };
  });

  // ---- 相机布局（俯视 ~53°，随舞台宽高自适应取景） ----
  let W = 1, H = 1;
  const PITCH = 53 * Math.PI / 180, PITCH_SHOW = 62 * Math.PI / 180;
  function layoutCam() {
    const a = W / H, tanH = Math.tan(camera.fov * Math.PI / 360);
    const D = Math.max(3.75 / (a * tanH), 5.5 / (2 * tanH));
    const put = (v, pitch, dist) => v.set(look.x, look.y + Math.sin(pitch) * dist, look.z + Math.cos(pitch) * dist);
    put(CAM.base, PITCH, D); put(CAM.roll, PITCH, D * 0.98); put(CAM.show, PITCH_SHOW, D * 0.86);
  }
  function resize() {
    W = host.clientWidth || 1; H = host.clientHeight || 1; renderer.setSize(W, H, false);
    renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
    camera.aspect = W / H; camera.clearViewOffset(); camera.updateProjectionMatrix(); layoutCam();
    if (mode === 'show' || mode === 'roll') camTarget.copy(mode === 'show' ? CAM.show : CAM.roll); else camTarget.copy(CAM.base);
    if (!camReady) { camPos.copy(camTarget); camReady = true; }
  }
  let camReady = false;
  window.addEventListener('resize', resize);

  // ---------- 临时对象（循环内零分配） ----------
  const WUP = new THREE.Vector3(0, 1, 0), NZ = new THREE.Vector3(0, 0, -1);
  const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpM = new THREE.Matrix4();
  const restY = (q) => { tmpM.makeRotationFromQuaternion(q); const e = tmpM.elements; return HALF * (Math.abs(e[1]) + Math.abs(e[5]) + Math.abs(e[9])); };
  const faceOf = (d, sym) => LAYOUTS[d].indexOf(sym);
  let mode = 'idle', t0 = performance.now(), result = [0, 1, 2], shake = 0, power = 0.5, camSwayAmp = 0.1;
  const setResult = (r) => { result = (r || result).slice(); };
  const setTargets = () => dice.forEach((d, i) => { d.tq.copy(orient(faceOf(i, result[i]), WUP, NZ)); tmpQ.setFromAxisAngle(WUP, d.yaw); d.tq.premultiply(tmpQ); });
  const setEmi = (d, r, g, b) => { for (let k = 0; k < 6; k++) d.mats[k].emissive.setRGB(r, g, b); };
  const place = (d, i) => { d.q.copy(d.tq); d.p.set(SLOTS[i][0], restY(d.q), SLOTS[i][1]); d.v.set(0, 0, 0); };

  function showIdle(r) {
    setResult(r); mode = 'idle'; t0 = performance.now(); camTarget.copy(CAM.base); power = 0.5; camSwayAmp = 0.1;
    dice.forEach((d, i) => { d.yaw = (i - 1) * 0.22 + 0.1; }); setTargets();
    dice.forEach((d, i) => { place(d, i); d.fall = false; d.settled = true; d.gl.material.opacity = 0; d.mesh.scale.setScalar(1); setEmi(d, 0, 0, 0); });
  }
  function lock() {
    mode = 'lock'; t0 = performance.now(); power = 1; camTarget.copy(CAM.base); camSwayAmp = 0.14;
    dice.forEach((d) => { d.w.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(7, 11)); d.fall = false; d.settled = false; d.gl.material.opacity = 0; });
  }
  function roll(r, elapsed = 0) {
    setResult(r); const wasLock = mode === 'lock'; mode = 'roll'; t0 = performance.now() - elapsed * 1000; power = 1.5; camTarget.copy(CAM.roll); camSwayAmp = 0.3;
    dice.forEach((d, i) => { d.yaw = rnd(-0.35, 0.35); d.fall = false; d.settled = false; d.nextT = 0; d.acc = 0; d.gl.material.opacity = 0;
      if (!wasLock) { d.p.set(SLOTS[i][0], 1.9, SLOTS[i][1]); d.w.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(14); } });
    setTargets();
  }
  function reveal(r) {
    if (r) setResult(r);
    if (mode !== 'roll') { dice.forEach((d, i) => { d.yaw = d.yaw || 0; }); setTargets(); }
    dice.forEach((d, i) => { if (!d.settled || mode !== 'roll') { place(d, i); d.settled = true; } });
    mode = 'show'; t0 = performance.now(); camTarget.copy(CAM.show); power = 0.9; camSwayAmp = 0.12;
  }
  function impactFx(d, k, str) { const rg = rings[d.i]; rg.position.x = d.p.x; rg.position.z = d.p.z; rg.scale.setScalar(0.5); rg.material.opacity = Math.min(0.8, 0.25 + str * 0.6); shake = Math.max(shake, 0.25 + str * 0.5); }
  function landFx() {
    shake = 1; flash.intensity = 26; bigRing.scale.setScalar(0.6); bigRing.material.opacity = 0.9;
    if (hooks.onLand) hooks.onLand();
  }

  const clock = new THREE.Clock();
  function spinFree(q, w, dt) { const m = w.length(); if (m > 1e-4) { tmpV.copy(w).divideScalar(m); tmpQ.setFromAxisAngle(tmpV, m * dt); q.premultiply(tmpQ).normalize(); } }
  function pushApart(d, o, minD) { const dx = o.p.x - d.p.x, dy = o.p.y - d.p.y, dz = o.p.z - d.p.z, dist = Math.hypot(dx, dy, dz); if (dist < minD && dist > 1e-3) { const k = (minD - dist) / 2 / dist; d.p.x -= dx * k; d.p.y -= dy * k; d.p.z -= dz * k; o.p.x += dx * k; o.p.y += dy * k; o.p.z += dz * k; } }
  let allLanded = false;
  function step(dt) {
    const now = performance.now(), t = (now - t0) / 1000, time = now / 1000;
    const kf = 1 - Math.exp(-dt * 5);
    core.intensity = 3 + power * 4 + (mode === 'roll' ? Math.sin(time * 30) * 1.2 : 0);
    const pk = dt * (0.5 + power);
    for (let i = 0; i < PN; i++) { let y = pPos[i * 3 + 1] + pSpd[i] * pk; if (y > 3.2) y = 0; pPos[i * 3 + 1] = y; }
    pGeo.attributes.position.needsUpdate = true;
    flash.intensity *= Math.exp(-dt * 6);
    for (let k = 0; k < 3; k++) { const m = rings[k].material; if (m.opacity > 0) { rings[k].scale.multiplyScalar(1 + dt * 3.4); m.opacity = Math.max(0, m.opacity - dt * 1.5); } }
    if (bigRing.material.opacity > 0) { bigRing.scale.multiplyScalar(1 + dt * 3.2); bigRing.material.opacity = Math.max(0, bigRing.material.opacity - dt * 1.0); }

    if (mode === 'roll' && !allLanded && t >= SHAKE) { /* 落下阶段在逐颗骰子里处理 */ }
    let landedCount = 0;
    for (let i = 0; i < 3; i++) {
      const d = dice[i];
      if (mode === 'lock') {
        d.p.x += (SLOTS[i][0] * 0.85 - d.p.x) * kf; d.p.z += (SLOTS[i][1] - d.p.z) * kf;
        d.p.y += (1.9 + i * 0.1 + Math.sin(time * 18 + i) * 0.06 - d.p.y) * Math.min(1, kf * 1.6);
        d.p.x += (Math.random() - 0.5) * 0.03;
        spinFree(d.q, d.w, dt * (0.35 + Math.min(1, t / 1.2) * 0.9));
      } else if (mode === 'roll') {
        if (t < SHAKE) {
          // ---- 空中猛烈摇晃：目标点高频切换 + 大角速度翻滚 ----
          if (t >= d.nextT) {
            d.tp.set(rnd(-BXS, BXS), rnd(1.5, 2.1), rnd(-BZS, BZS)); d.nextT = t + rnd(0.07, 0.15);
            d.w.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(14, 26));
          }
          const kv = 1 - Math.exp(-dt * 16), amp = Math.min(1, t / 0.4 + 0.3);
          d.v.x += ((d.tp.x - d.p.x) * 10 * amp - d.v.x) * kv; d.v.y += ((d.tp.y - d.p.y) * 10 * amp - d.v.y) * kv; d.v.z += ((d.tp.z - d.p.z) * 10 * amp - d.v.z) * kv;
          d.p.addScaledVector(d.v, dt);
          spinFree(d.q, d.w, dt);
          d.acc += d.w.length() * dt; if (d.acc > Math.PI / 2) { d.acc = 0; if (hooks.onCycle) hooks.onCycle(i, 0); }
          for (let j = i + 1; j < 3; j++) pushApart(d, dice[j], HALF * 2.1);
          d.mesh.scale.setScalar(1);
        } else {
          // ---- 落下：重力、弹跳、逐渐转正到“结果面朝上” ----
          const td = t - SHAKE;
          if (!d.fall) { d.fall = true; d.qf.copy(d.q); d.v.set(d.v.x * 0.25, rnd(0.3, 1.2), d.v.z * 0.25); d.lastHit = 0; }
          d.w.multiplyScalar(Math.exp(-dt * 0.9)); spinFree(d.qf, d.w, dt);
          const e = ease((td - 0.28) / 1.1);
          d.q.slerpQuaternions(d.qf, d.tq, e);
          d.v.y -= G * dt; d.p.addScaledVector(d.v, dt);
          const damp = Math.exp(-dt * 1.0); d.v.x *= damp; d.v.z *= damp;
          const pull = 1 - Math.exp(-dt * 9 * e); d.p.x += (SLOTS[i][0] - d.p.x) * pull; d.p.z += (SLOTS[i][1] - d.p.z) * pull;
          const hy = restY(d.q);
          if (d.p.y < hy) {
            d.p.y = hy;
            if (d.v.y < -1.0) {
              const imp = -d.v.y; d.v.y = imp * 0.5; d.v.x *= 0.7; d.v.z *= 0.7; d.w.multiplyScalar(0.6);
              if (imp > 2 && now - d.lastHit > 90) { d.lastHit = now; if (hooks.onHit) hooks.onHit(Math.min(1, imp / 14), d.p.x / 3); impactFx(d, 0, Math.min(1, imp / 14)); }
            } else d.v.y = 0;
          }
          for (let j = i + 1; j < 3; j++) { const o = dice[j]; const dx = o.p.x - d.p.x, dz = o.p.z - d.p.z, dist = Math.hypot(dx, dz); if (dist < HALF * 2.15 && dist > 1e-3 && Math.abs(o.p.y - d.p.y) < HALF * 2) { const k = (HALF * 2.15 - dist) / 2 / dist; d.p.x -= dx * k; d.p.z -= dz * k; o.p.x += dx * k; o.p.z += dz * k; } }
          if (td > 0.9) camTarget.copy(CAM.show);
          if (td >= 1.25 + i * 0.13) {
            if (!d.settled) { d.settled = true; d.q.copy(d.tq); if (hooks.onStop) hooks.onStop(i, (i - 1) * 0.6); }
            d.q.copy(d.tq); d.p.x += (SLOTS[i][0] - d.p.x) * kf * 2; d.p.z += (SLOTS[i][1] - d.p.z) * kf * 2; d.p.y = restY(d.tq); d.v.set(0, 0, 0);
            landedCount++;
          }
        }
      } else if (mode === 'show') {
        const e = ease(t / 0.6), pulse = 0.8 + 0.2 * Math.sin(time * 5 + i);
        d.gl.position.set(d.p.x, 0.03, d.p.z); d.gl.material.opacity = 0.85 * e * pulse;
        setEmi(d, 0.1 * e * pulse, 0.07 * e * pulse, 0.015 * e * pulse);
      }
      d.mesh.position.copy(d.p); d.mesh.quaternion.copy(d.q);
      if (mode !== 'show') d.gl.position.set(d.p.x, 0.03, d.p.z);
    }
    if (mode === 'roll' && landedCount === 3 && !allLanded) { allLanded = true; landFx(); }
    if (mode !== 'roll') allLanded = false;

    camPos.lerp(camTarget, 1 - Math.exp(-dt * 2.4));
    camera.position.copy(camPos);
    camera.position.x += Math.sin(time * 0.8) * camSwayAmp; camera.position.y += Math.sin(time * 0.6 + 1) * camSwayAmp * 0.3;
    if (mode === 'roll' && now - t0 < SHAKE * 1000) { camera.position.x += (Math.random() - 0.5) * 0.06; camera.position.y += (Math.random() - 0.5) * 0.05; }
    if (shake > 0.001) { camera.position.x += (Math.random() - 0.5) * 0.2 * shake; camera.position.y += (Math.random() - 0.5) * 0.14 * shake; shake *= Math.exp(-dt * 7); }
    camera.lookAt(look);
  }

  let ema = 1 / 60, slow = 0;
  function loop() {
    requestAnimationFrame(loop);
    const raw = clock.getDelta(), dt = Math.min(0.05, raw);
    ema += (raw - ema) * 0.05;
    if (ema > 1 / 35) { slow += raw; if (slow > 2 && curPR > minPR) { curPR = Math.max(minPR, curPR - 0.5); renderer.setPixelRatio(curPR); renderer.setSize(W, H, false); slow = 0; ema = 1 / 60; } } else slow = 0;
    step(dt); renderer.render(scene, camera);
  }
  resize();
  showIdle([0, 1, 2]);
  // 预热：上传全部纹理、编译着色器，开奖时不卡顿
  dice.forEach((d) => d.mats.forEach((m) => renderer.initTexture(m.map)));
  renderer.initTexture(glowTex); renderer.compile(scene, camera);
  loop();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) clock.getDelta(); });
  return { showIdle, lock, roll, reveal, resize };
}
