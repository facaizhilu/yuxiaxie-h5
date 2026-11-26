/* 3D 开奖舞台：全息能量舱 + 三颗金属骰子（six faces = 六种图案） */
import * as THREE from './vendor/three.module.min.js';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const FLOOR = 0.35, HALF = 0.45, REST = FLOOR + HALF, R_WALL = 1.18;
const SLOTS = [new THREE.Vector3(-0.66, REST, 0.32), new THREE.Vector3(0.66, REST, 0.32), new THREE.Vector3(0, REST, -0.5)];
const SHOWP = [new THREE.Vector3(-0.6, 1.5, 0.3), new THREE.Vector3(0.6, 1.5, 0.3), new THREE.Vector3(0, 2.12, -0.1)];
const FLOAT = [new THREE.Vector3(-0.78, 1.55, 0.25), new THREE.Vector3(0.78, 1.55, 0.25), new THREE.Vector3(0, 2.2, -0.15)];
const LAYOUTS = [[0, 1, 2, 3, 4, 5], [2, 4, 0, 5, 1, 3], [5, 3, 1, 0, 2, 4]];
const STYLES = [
  { base: ['#f4f6fa', '#9aa3b2'], rim: '#7fe9ff', medal: ['#1b2633', '#0a1018'], metal: 0.75, rough: 0.28 },
  { base: ['#8a1622', '#2a0408'], rim: '#ffcf7a', medal: ['#3a0a10', '#120204'], metal: 0.65, rough: 0.3 },
  { base: ['#ffe3a0', '#a8741e'], rim: '#fff2c4', medal: ['#3a2508', '#140b02'], metal: 0.85, rough: 0.25 },
];

function faceTexture(img, st, maxAniso) {
  const S = 320, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d');
  const bg = g.createRadialGradient(S * 0.35, S * 0.3, 10, S / 2, S / 2, S * 0.75); bg.addColorStop(0, st.base[0]); bg.addColorStop(1, st.base[1]);
  g.fillStyle = bg; g.fillRect(0, 0, S, S);
  g.strokeStyle = st.rim; g.globalAlpha = 0.55; g.lineWidth = 4; g.strokeRect(18, 18, S - 36, S - 36); g.globalAlpha = 0.25; g.lineWidth = 2; g.strokeRect(30, 30, S - 60, S - 60); g.globalAlpha = 1;
  const md = g.createRadialGradient(S / 2, S / 2, 20, S / 2, S / 2, S * 0.4); md.addColorStop(0, st.medal[0]); md.addColorStop(1, st.medal[1]);
  g.beginPath(); g.arc(S / 2, S / 2, S * 0.38, 0, Math.PI * 2); g.fillStyle = md; g.fill();
  g.lineWidth = 5; g.strokeStyle = st.rim; g.shadowColor = st.rim; g.shadowBlur = 14; g.stroke(); g.shadowBlur = 0;
  g.save(); g.beginPath(); g.arc(S / 2, S / 2, S * 0.36, 0, Math.PI * 2); g.clip();
  const r = S * 0.62; g.drawImage(img, (S - r) / 2, (S - r) / 2, r, r); g.restore();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; return t;
}
function radialTex(stops, size = 128) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const g = cv.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); stops.forEach(([o, c]) => gr.addColorStop(o, c));
  g.fillStyle = gr; g.fillRect(0, 0, size, size); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function hexTex() {
  const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S); g.strokeStyle = 'rgba(70,220,255,0.55)'; g.lineWidth = 2;
  const r = 26, h = Math.sqrt(3) * r;
  for (let y = -1; y < S / h + 1; y++) for (let x = -1; x < S / (r * 1.5) + 1; x++) {
    const cx = x * r * 1.5, cy = y * h + (x % 2 ? h / 2 : 0); g.beginPath();
    for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k; g.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); } g.closePath(); g.stroke();
  }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); return t;
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

export async function createStage(host, imgs, hooks = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: (window.devicePixelRatio || 1) < 2, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  const CAM = { base: new THREE.Vector3(0, 2.9, 8.6), roll: new THREE.Vector3(0, 2.3, 6.4), show: new THREE.Vector3(0, 2.45, 7.5) };
  const camPos = CAM.base.clone(), camTarget = CAM.base.clone(), look = new THREE.Vector3(0, 1.25, 0);
  camera.position.copy(camPos);

  scene.add(new THREE.AmbientLight(0x406080, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(3, 6, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -3.2; key.shadow.camera.right = 3.2; key.shadow.camera.top = 3.2; key.shadow.camera.bottom = -3.2; key.shadow.camera.near = 2; key.shadow.camera.far = 16; key.shadow.bias = -0.0006; key.shadow.radius = 4; scene.add(key);
  const rim = new THREE.DirectionalLight(0xffc870, 1.2); rim.position.set(-4, 3, -3); scene.add(rim);
  const core = new THREE.PointLight(0x47e5ff, 6, 6, 1.6); core.position.set(0, 1.2, 0.6); scene.add(core);
  const flash = new THREE.PointLight(0xfff0c0, 0, 8, 1.5); flash.position.set(0, 1.4, 1); scene.add(flash);

  // 地面六边形网格
  const floorMat = new THREE.MeshBasicMaterial({ map: hexTex(), alphaMap: radialTex([[0, '#fff'], [0.55, '#555'], [1, '#000']], 256), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, color: 0x2ab8ff });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.02; scene.add(floor);

  // 底座
  const metal = new THREE.MeshStandardMaterial({ color: 0x1a2533, metalness: 0.9, roughness: 0.35 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.25, 0.35, 72), metal); base.position.y = FLOOR / 2; scene.add(base);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.78, 1.78, 0.02, 72), new THREE.MeshStandardMaterial({ color: 0x0b1622, metalness: 0.6, roughness: 0.2, emissive: 0x0a3a50, emissiveIntensity: 0.6 })); top.position.y = FLOOR + 0.005; top.receiveShadow = true; scene.add(top);
  const glow = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
  const ringC = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.035, 12, 120), glow(0x5ff3ff)); ringC.rotation.x = Math.PI / 2; ringC.position.y = FLOOR + 0.01; scene.add(ringC);
  const ringG = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.03, 10, 120, Math.PI * 1.1), glow(0xffc35a)); ringG.rotation.x = Math.PI / 2; ringG.rotation.z = Math.PI * 1.05; ringG.position.y = 0.05; scene.add(ringG);
  const ringC2 = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.02, 8, 120, Math.PI * 0.8), glow(0x3fd8ff)); ringC2.rotation.x = Math.PI / 2; ringC2.rotation.z = -0.3; ringC2.position.y = 0.03; scene.add(ringC2);
  const topRing = new THREE.Mesh(new THREE.TorusGeometry(1.78, 0.03, 10, 120), glow(0x5ff3ff)); topRing.rotation.x = Math.PI / 2; topRing.position.y = 3.55; scene.add(topRing);
  const topCap = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.85, 0.16, 72, 1, true), metal); topCap.position.y = 3.62; scene.add(topCap);

  // 全息玻璃舱（着色器）
  const glassU = { time: { value: 0 }, power: { value: 0.6 } };
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.76, 1.76, 3.2, 72, 1, true), new THREE.ShaderMaterial({
    uniforms: glassU, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'uniform float time; uniform float power; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float f=pow(1.0-abs(dot(vN,vV)),2.2); float scan=0.5+0.5*sin(vUv.y*90.0-time*3.0); float band=smoothstep(0.0,0.08,vUv.y)*0.0+pow(1.0-vUv.y,3.0)*0.9+pow(vUv.y,6.0)*0.6; float lines=step(0.985,fract(vUv.x*36.0))*0.35; vec3 c=vec3(0.25,0.85,1.0); float a=(f*0.75+band*0.5+scan*0.06+lines*f)*power; gl_FragColor=vec4(c*a,a); }',
  }));
  glass.position.y = FLOOR + 1.6; scene.add(glass);

  // 能量光柱 + 粒子
  const beamU = { time: { value: 0 }, power: { value: 0.5 } };
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.5, 3.1, 48, 1, true), new THREE.ShaderMaterial({
    uniforms: beamU, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform float time; uniform float power; varying vec2 vUv; void main(){ float a=pow(1.0-vUv.y,2.5)*(0.6+0.4*sin(vUv.x*40.0+time*4.0))*power*0.35; gl_FragColor=vec4(vec3(0.35,0.9,1.0)*a,a); }',
  }));
  beam.position.y = FLOOR + 1.55; scene.add(beam);
  const PN = 260, pGeo = new THREE.BufferGeometry(), pPos = new Float32Array(PN * 3), pSpd = new Float32Array(PN);
  for (let i = 0; i < PN; i++) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 1.6; pPos[i * 3] = Math.cos(a) * r; pPos[i * 3 + 1] = FLOOR + Math.random() * 3.2; pPos[i * 3 + 2] = Math.sin(a) * r; pSpd[i] = 0.2 + Math.random() * 0.6; }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({ size: 0.05, map: radialTex([[0, '#fff'], [0.3, 'rgba(120,230,255,0.8)'], [1, 'rgba(0,0,0,0)']], 64), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0x9ff4ff });
  scene.add(new THREE.Points(pGeo, pMat));

  // 冲击波 + 光晕
  const shock = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.0, 96), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  shock.rotation.x = -Math.PI / 2; shock.position.y = FLOOR + 0.03; scene.add(shock);
  const shock2 = shock.clone(); shock2.material = shock.material.clone(); shock2.material.color.set(0x5ff3ff); scene.add(shock2);
  const haloTex = radialTex([[0, 'rgba(255,230,150,0.95)'], [0.35, 'rgba(255,190,80,0.35)'], [1, 'rgba(0,0,0,0)']]);
  const blobTex = radialTex([[0, 'rgba(0,0,0,0.75)'], [1, 'rgba(0,0,0,0)']]);

  // 骰子
  const aniso = renderer.capabilities.getMaxAnisotropy ? Math.min(4, renderer.capabilities.getMaxAnisotropy()) : 1;
  const geo = new RoundedBoxGeometry(HALF * 2, HALF * 2, HALF * 2, 5, 0.12);
  const dice = STYLES.map((st, d) => {
    const mats = LAYOUTS[d].map((sym) => new THREE.MeshStandardMaterial({ map: faceTexture(imgs[sym], st, aniso), metalness: st.metal, roughness: st.rough, envMapIntensity: 1.1, emissive: 0x000000 }));
    const mesh = new THREE.Mesh(geo, mats); mesh.castShadow = true; scene.add(mesh);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); halo.scale.set(2.2, 2.2, 1); scene.add(halo);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false })); blob.rotation.x = -Math.PI / 2; blob.position.y = FLOOR + 0.02; scene.add(blob);
    return { mesh, mats, halo, blob, p: FLOAT[d].clone(), v: new THREE.Vector3(), q: new THREE.Quaternion(), w: new THREE.Vector3(), sym: d, lastHit: 0 };
  });

  let W = 1, H = 1;
  function resize() {
    W = host.clientWidth || 1; H = host.clientHeight || 1; renderer.setSize(W, H, false);
    renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
    camera.aspect = W / H;
    camera.setViewOffset(W, H, Math.min(W * 0.15, 110), 0, W, H);
    camera.fov = W / H < 1.1 ? 42 : 34; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize); resize();

  // ---------- 预分配临时对象（循环内零分配） ----------
  const WUP = new THREE.Vector3(0, 1, 0), LOOKC = new THREE.Vector3(0, 1.6, 0);
  const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion(), tmpE = new THREE.Euler();
  const faceOf = (d, sym) => LAYOUTS[d].indexOf(sym);
  const AXES = [new THREE.Vector3(1, 0.32, 0.1), new THREE.Vector3(1, -0.38, 0.18), new THREE.Vector3(0.92, 0.22, -0.3)].map((v) => v.normalize());
  dice.forEach((d, i) => { d.fin = new THREE.Quaternion(); d.qs = new THREE.Quaternion(); d.q0 = new THREE.Quaternion(); d.p0 = new THREE.Vector3(); d.axis = AXES[i]; d.Th = Math.PI * 2 * (4 + i * 0.9); d.glow = 0; d.pulse = 0; d.pass = -1; d.n = 0; d.stopped = false; d.stopT = 0; });
  let mode = 'idle', t0 = performance.now(), result = [0, 1, 2], shake = 0, power = 0.55;
  const setResult = (r) => { result = r.slice(); };
  function setFin(camP) { tmpV.copy(camP).sub(LOOKC).normalize(); dice.forEach((d, i) => d.fin.copy(orient(faceOf(i, result[i]), tmpV, WUP))); }
  const setEmi = (d, r, g, b) => { for (let k = 0; k < 6; k++) d.mats[k].emissive.setRGB(r, g, b); };
  function showIdle(r) {
    setResult(r); mode = 'idle'; t0 = performance.now(); camTarget.copy(CAM.base); power = 0.55; setFin(CAM.base);
    dice.forEach((d, i) => { d.p.copy(FLOAT[i]); d.q.copy(d.fin); d.halo.material.opacity = 0; d.mesh.scale.setScalar(1); setEmi(d, 0, 0, 0); });
  }
  function lock() { mode = 'lock'; t0 = performance.now(); power = 1; camTarget.lerpVectors(CAM.base, CAM.roll, 0.35);
    dice.forEach((d) => { d.w.set((Math.random() - 0.5) * 22, (Math.random() - 0.5) * 22, (Math.random() - 0.5) * 22); d.halo.material.opacity = 0; }); }
  // 老虎机式开奖：三颗 3D 骰子原地沿倾斜轴高速翻转（图案快速掠过 + 每过一面“咚”一下），逐颗减速定格
  const STOP = [1.9, 2.85, 3.8];
  function roll(r) {
    setResult(r); mode = 'roll'; t0 = performance.now(); power = 1.4; camTarget.copy(CAM.roll); setFin(CAM.roll);
    dice.forEach((d) => { d.qs.copy(d.q); d.pass = -1; d.n = 0; d.glow = 0.6; d.pulse = 0; d.stopped = false; d.stopT = 0; d.halo.material.opacity = 0; });
  }
  function reveal(r) {
    if (r) setResult(r);
    setFin(CAM.show);
    if (mode !== 'roll') dice.forEach((d, i) => { d.p.copy(FLOAT[i]); d.q.copy(d.fin); });
    dice.forEach((d) => { d.p0.copy(d.p); d.q0.copy(d.q); d.pulse = 0; });
    mode = 'show'; t0 = performance.now(); camTarget.copy(CAM.show); power = 0.9;
  }
  function landFx() {
    shake = 1; flash.intensity = 30; shock.scale.setScalar(0.3); shock.material.opacity = 1; shock2.scale.setScalar(0.2); shock2.material.opacity = 0.9;
    if (hooks.onLand) hooks.onLand();
  }

  const clock = new THREE.Clock(), HP = Math.PI / 2;
  let running = true;
  function step(dt) {
    const now = performance.now(), t = (now - t0) / 1000, time = now / 1000;
    const kf = 1 - Math.exp(-dt * 5);
    glassU.time.value = time; beamU.time.value = time;
    glassU.power.value += (power - glassU.power.value) * (1 - Math.exp(-dt * 3)); beamU.power.value = glassU.power.value;
    core.intensity = 4 + glassU.power.value * 5;
    ringG.rotation.z += dt * 0.25; ringC2.rotation.z -= dt * 0.4;
    const pk = dt * (0.6 + glassU.power.value);
    for (let i = 0; i < PN; i++) { let y = pPos[i * 3 + 1] + pSpd[i] * pk; if (y > FLOOR + 3.2) y = FLOOR; pPos[i * 3 + 1] = y; }
    pGeo.attributes.position.needsUpdate = true;
    flash.intensity *= Math.exp(-dt * 6);
    if (shock.material.opacity > 0) { shock.scale.multiplyScalar(1 + dt * 3.2); shock.material.opacity = Math.max(0, shock.material.opacity - dt * 1.4); }
    if (shock2.material.opacity > 0) { shock2.scale.multiplyScalar(1 + dt * 2.4); shock2.material.opacity = Math.max(0, shock2.material.opacity - dt * 1.1); }
    const decG = Math.exp(-dt * 7), decP = Math.exp(-dt * 9);

    for (let i = 0; i < 3; i++) {
      const d = dice[i], F = FLOAT[i];
      if (mode === 'idle') {
        d.p.x += (F.x - d.p.x) * kf; d.p.y += (F.y + Math.sin(time * 1.4 + i * 2) * 0.08 - d.p.y) * kf; d.p.z += (F.z - d.p.z) * kf;
        tmpQ2.copy(d.fin).multiply(tmpQ.setFromEuler(tmpE.set(Math.sin(time * 0.9 + i) * 0.12, Math.sin(time * 0.7 + i * 1.7) * 0.22, Math.sin(time * 0.8 + i) * 0.06)));
        d.q.slerp(tmpQ2, kf);
      } else if (mode === 'lock') {
        d.p.x += (F.x * 0.7 - d.p.x) * kf; d.p.y += (1.85 + i * 0.12 - d.p.y) * kf; d.p.z += (F.z * 0.7 - d.p.z) * kf;
        d.p.x += (Math.random() - 0.5) * 0.03; d.p.y += (Math.random() - 0.5) * 0.03;
        spin(d, dt * (0.4 + Math.min(1, t / 1.2)) );
      } else if (mode === 'roll') {
        let th = 0;
        if (!d.stopped) {
          if (t >= STOP[i]) {
            d.stopped = true; d.stopT = t; d.glow = 2; d.pulse = 1.6;
            shake = Math.max(shake, 0.6); flash.intensity = Math.max(flash.intensity, 14);
            shock.scale.setScalar(0.25); shock.material.opacity = 0.7;
            if (hooks.onStop) hooks.onStop(i, (i - 1) * 0.6);
            if (i === 2) landFx();
          } else {
            const pp = t / STOP[i]; th = d.Th * (1 - pp) * (1 - pp);
            const pass = Math.floor(th / HP);
            if (pass !== d.pass) { if (d.pass >= 0) { d.glow = 1; d.pulse = 0.8; d.n++; if (hooks.onCycle) hooks.onCycle(i, d.n); } d.pass = pass; }
          }
        }
        let sq = 0;
        if (d.stopped) { const k = t - d.stopT, e = Math.exp(-k * 7.5); th = 0.16 * e * Math.sin(k * 28); sq = e * Math.cos(k * 26); }
        tmpQ.setFromAxisAngle(d.axis, th); d.q.copy(tmpQ).multiply(d.fin);
        const bl = ease(t / 0.2); if (bl < 1) d.q.slerpQuaternions(d.qs, tmpQ2.copy(d.q), bl);
        d.p.x += (F.x - d.p.x) * kf; d.p.y += (F.y - 0.2 * sq - d.p.y) * Math.min(1, kf * 3); d.p.z += (F.z - d.p.z) * kf;
        d.glow *= decG; d.pulse *= decP;
        const g = d.glow, gold = d.stopped ? 1 : 0;
        setEmi(d, 0.1 * g + 0.25 * gold * g, 0.12 * g + 0.17 * gold * g, 0.16 * g);
        d.halo.material.opacity = Math.min(0.9, 0.1 * g + (d.stopped ? 0.45 : 0));
        d.mesh.scale.setScalar(1 + 0.12 * d.pulse - 0.1 * sq * (d.stopped ? 1 : 0));
      } else if (mode === 'show') {
        const e = ease((t - 0.35) / 0.9);
        d.mesh.scale.setScalar(1 + 0.1 * (1 - e));
        d.p.lerpVectors(d.p0, SHOWP[i], e); d.p.y += Math.sin(time * 1.6 + i * 2) * 0.05 * e;
        d.q.slerpQuaternions(d.q0, d.fin, e);
        d.halo.material.opacity = 0.85 * e * (0.8 + 0.2 * Math.sin(time * 5 + i));
        setEmi(d, 0.12 * e, 0.08 * e, 0.02 * e);
      }
      d.mesh.position.copy(d.p); d.mesh.quaternion.copy(d.q);
      d.halo.position.set(d.p.x, d.p.y, d.p.z - 0.35);
      const hgt = Math.max(0, d.p.y - REST); d.blob.position.set(d.p.x, FLOOR + 0.02, d.p.z); d.blob.material.opacity = Math.max(0.12, 0.6 - hgt * 0.25); d.blob.scale.setScalar(1 + hgt * 0.35);
    }

    camPos.lerp(camTarget, 1 - Math.exp(-dt * 2.6));
    camera.position.copy(camPos);
    // 轻微镜头环绕呼吸，增强纵深；开奖时更明显
    const sw = mode === 'roll' ? 0.38 : 0.16;
    camera.position.x += Math.sin(time * 0.8) * sw; camera.position.y += Math.sin(time * 0.6 + 1) * sw * 0.35;
    if (shake > 0.001) { camera.position.x += (Math.random() - 0.5) * 0.18 * shake; camera.position.y += (Math.random() - 0.5) * 0.12 * shake; shake *= Math.exp(-dt * 7); }
    camera.lookAt(look);
  }
  function spin(d, k) { const ang = d.w.length() * k; if (ang > 0) { tmpV.copy(d.w).normalize(); tmpQ.setFromAxisAngle(tmpV, ang); d.q.premultiply(tmpQ).normalize(); } }

  // 自适应分辨率：连续掉帧时降低像素比，保证流畅
  let curPR = Math.min(window.devicePixelRatio || 1, 1.6), ema = 1 / 60, slow = 0;
  function loop() {
    if (!running) return; requestAnimationFrame(loop);
    const raw = clock.getDelta(), dt = Math.min(0.05, raw);
    ema += (raw - ema) * 0.05;
    if (ema > 1 / 42) { slow += raw; if (slow > 1.2 && curPR > 1) { curPR = Math.max(1, curPR - 0.25); renderer.setPixelRatio(curPR); renderer.setSize(W, H, false); slow = 0; ema = 1 / 60; } } else slow = 0;
    step(dt); renderer.render(scene, camera);
  }
  // 预热：提前上传全部纹理并编译着色器，开奖时不会卡顿
  dice.forEach((d) => d.mats.forEach((m) => renderer.initTexture(m.map)));
  [haloTex, blobTex].forEach((t) => renderer.initTexture(t));
  renderer.compile(scene, camera);
  showIdle([0, 1, 2]); loop();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) clock.getDelta(); });
  return { showIdle, lock, roll, reveal, resize };
}
