/* 3D 开奖舞台：全息能量舱 + 三颗金属骰子（six faces = 六种图案） */
import * as THREE from './vendor/three.module.min.js';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const FLOOR = 0.35, HALF = 0.45, REST = FLOOR + HALF, R_WALL = 1.18;
const SLOTS = [new THREE.Vector3(-0.66, REST, 0.32), new THREE.Vector3(0.66, REST, 0.32), new THREE.Vector3(0, REST, -0.5)];
const SHOWP = [new THREE.Vector3(-0.6, 1.5, 0.3), new THREE.Vector3(0.6, 1.5, 0.3), new THREE.Vector3(0, 2.25, -0.1)];
const FLOAT = [new THREE.Vector3(-0.78, 1.55, 0.25), new THREE.Vector3(0.78, 1.55, 0.25), new THREE.Vector3(0, 2.35, -0.15)];
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
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  const CAM = { base: new THREE.Vector3(0, 2.9, 8.6), roll: new THREE.Vector3(0, 2.3, 6.4), show: new THREE.Vector3(0, 2.45, 7.5) };
  const camPos = CAM.base.clone(), camTarget = CAM.base.clone(), look = new THREE.Vector3(0, 1.25, 0);
  camera.position.copy(camPos);

  scene.add(new THREE.AmbientLight(0x406080, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(3, 6, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffc870, 1.2); rim.position.set(-4, 3, -3); scene.add(rim);
  const core = new THREE.PointLight(0x47e5ff, 6, 6, 1.6); core.position.set(0, 1.2, 0.6); scene.add(core);
  const flash = new THREE.PointLight(0xfff0c0, 0, 8, 1.5); flash.position.set(0, 1.4, 1); scene.add(flash);

  // 地面六边形网格
  const floorMat = new THREE.MeshBasicMaterial({ map: hexTex(), alphaMap: radialTex([[0, '#fff'], [0.55, '#555'], [1, '#000']], 256), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, color: 0x2ab8ff });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.02; scene.add(floor);

  // 底座
  const metal = new THREE.MeshStandardMaterial({ color: 0x1a2533, metalness: 0.9, roughness: 0.35 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.25, 0.35, 72), metal); base.position.y = FLOOR / 2; scene.add(base);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.78, 1.78, 0.02, 72), new THREE.MeshStandardMaterial({ color: 0x0b1622, metalness: 0.6, roughness: 0.2, emissive: 0x0a3a50, emissiveIntensity: 0.6 })); top.position.y = FLOOR + 0.005; scene.add(top);
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
    const mesh = new THREE.Mesh(geo, mats); scene.add(mesh);
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

  const camDir = () => camera.position.clone().sub(new THREE.Vector3(0, 1.6, 0)).normalize();
  const WUP = new THREE.Vector3(0, 1, 0);
  const faceOf = (d, sym) => LAYOUTS[d].indexOf(sym);
  let mode = 'idle', t0 = performance.now(), result = [0, 1, 2], shake = 0, power = 0.55, landed = false;
  const tq = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()];
  const setResult = (r) => { result = r.slice(); };
  function showIdle(r) {
    setResult(r); mode = 'idle'; t0 = performance.now(); camTarget.copy(CAM.base); power = 0.55;
    dice.forEach((d, i) => { d.p.copy(FLOAT[i]); d.q.copy(orient(faceOf(i, result[i]), camDir(), WUP)); d.halo.material.opacity = 0; });
  }
  function lock() { mode = 'lock'; t0 = performance.now(); power = 1; camTarget.lerpVectors(CAM.base, CAM.roll, 0.35);
    dice.forEach((d, i) => { d.w.set((Math.random() - 0.5) * 22, (Math.random() - 0.5) * 22, (Math.random() - 0.5) * 22); d.halo.material.opacity = 0; }); }
  function roll(r) {
    setResult(r); mode = 'roll'; t0 = performance.now(); landed = false; power = 1.3; camTarget.copy(CAM.roll);
    dice.forEach((d, i) => {
      d.p.set((i - 1) * 0.5, 1.9 + i * 0.25, -0.2 + Math.random() * 0.3);
      d.v.set((Math.random() - 0.5) * 4.2, 2.5 + Math.random() * 1.5, (Math.random() - 0.5) * 3.2);
      d.w.set((Math.random() - 0.5) * 26, (Math.random() - 0.5) * 26, (Math.random() - 0.5) * 26);
      tq[i].copy(orient(faceOf(i, result[i]), WUP, new THREE.Vector3(0, 0, -1))).premultiply(new THREE.Quaternion().setFromAxisAngle(WUP, (Math.random() - 0.5) * 0.5));
    });
  }
  function reveal(r) {
    if (r) setResult(r);
    if (mode !== 'roll') dice.forEach((d, i) => { d.p.copy(SLOTS[i]); tq[i].copy(orient(faceOf(i, result[i]), WUP, new THREE.Vector3(0, 0, -1))); d.q.copy(tq[i]); });
    mode = 'show'; t0 = performance.now(); camTarget.copy(CAM.show); power = 0.9;
  }
  function landFx() {
    shake = 1; flash.intensity = 30; shock.scale.setScalar(0.3); shock.material.opacity = 1; shock2.scale.setScalar(0.2); shock2.material.opacity = 0.9;
    if (hooks.onLand) hooks.onLand();
  }

  const tmpQ = new THREE.Quaternion(), clock = new THREE.Clock();
  let running = true;
  function step(dt) {
    const now = performance.now(), t = (now - t0) / 1000, time = now / 1000;
    glassU.time.value = time; beamU.time.value = time;
    glassU.power.value += (power - glassU.power.value) * 0.05; beamU.power.value = glassU.power.value;
    core.intensity = 4 + glassU.power.value * 5;
    ringG.rotation.z += dt * 0.25; ringC2.rotation.z -= dt * 0.4;
    for (let i = 0; i < PN; i++) { pPos[i * 3 + 1] += pSpd[i] * dt * (0.6 + glassU.power.value); if (pPos[i * 3 + 1] > FLOOR + 3.2) pPos[i * 3 + 1] = FLOOR; }
    pGeo.attributes.position.needsUpdate = true;
    flash.intensity *= 0.9;
    if (shock.material.opacity > 0) { shock.scale.multiplyScalar(1 + dt * 3.2); shock.material.opacity = Math.max(0, shock.material.opacity - dt * 1.4); }
    if (shock2.material.opacity > 0) { shock2.scale.multiplyScalar(1 + dt * 2.4); shock2.material.opacity = Math.max(0, shock2.material.opacity - dt * 1.1); }

    dice.forEach((d, i) => {
      if (mode === 'idle') {
        const tgt = FLOAT[i]; d.p.lerp(new THREE.Vector3(tgt.x, tgt.y + Math.sin(time * 1.4 + i * 2) * 0.08, tgt.z), 0.08);
        const base = orient(faceOf(i, result[i]), camDir(), WUP);
        tmpQ.setFromEuler(new THREE.Euler(Math.sin(time * 0.9 + i) * 0.12, Math.sin(time * 0.7 + i * 1.7) * 0.22, Math.sin(time * 0.8 + i) * 0.06));
        d.q.slerp(base.multiply(tmpQ), 0.08);
      } else if (mode === 'lock') {
        const tgt = new THREE.Vector3(FLOAT[i].x * 0.7, 1.85 + i * 0.12, FLOAT[i].z * 0.7);
        d.p.lerp(tgt, 0.08); d.p.x += (Math.random() - 0.5) * 0.04; d.p.y += (Math.random() - 0.5) * 0.04;
        const s = Math.min(1, t / 1.2); spin(d, dt * (0.4 + s));
      } else if (mode === 'roll') {
        const tl = Math.min(t, 2.6);
        if (tl < 2.0) physics(d, i, dt);
        else { spin(d, dt * 0.6); }
        const e = ease((tl - 1.55) / 0.95);
        if (e > 0) {
          const hop = tl > 2.15 ? Math.max(0, 0.75 * (1 - Math.pow((tl - 2.38) / 0.22, 2))) : 0;
          const tgt = SLOTS[i].clone(); tgt.y += hop;
          d.p.lerp(tgt, e); d.q.slerp(tq[i], e);
        }
        if (t >= 2.6 && !landed) { landed = true; dice.forEach((dd, k) => { dd.p.copy(SLOTS[k]); dd.q.copy(tq[k]); }); landFx(); }
        if (t > 2.6) { const k = t - 2.6, wob = Math.exp(-k * 6) * Math.sin(k * 30) * 0.06; d.p.copy(SLOTS[i]); d.q.copy(tq[i]).multiply(tmpQ.setFromEuler(new THREE.Euler(wob, 0, wob * 0.6))); }
      } else if (mode === 'show') {
        const e = ease((t - 0.35) / 0.9);
        const from = SLOTS[i], to = SHOWP[i];
        d.p.lerpVectors(from, to, e); d.p.y += Math.sin(time * 1.6 + i * 2) * 0.05 * e;
        const fq = orient(faceOf(i, result[i]), camDir(), WUP);
        d.q.slerpQuaternions(tq[i], fq, e);
        d.halo.material.opacity = 0.85 * e * (0.8 + 0.2 * Math.sin(time * 5 + i));
        d.mats.forEach((m) => m.emissive.setRGB(0.12 * e, 0.08 * e, 0.02 * e));
      }
      if (mode !== 'show') d.mats.forEach((m) => m.emissive.setRGB(0, 0, 0));
      d.mesh.position.copy(d.p); d.mesh.quaternion.copy(d.q);
      d.halo.position.copy(d.p).add(new THREE.Vector3(0, 0, -0.35));
      const hgt = Math.max(0, d.p.y - REST); d.blob.position.set(d.p.x, FLOOR + 0.02, d.p.z); d.blob.material.opacity = Math.max(0.15, 0.85 - hgt * 0.35); d.blob.scale.setScalar(1 + hgt * 0.35);
    });

    camPos.lerp(camTarget, 0.045);
    camera.position.copy(camPos);
    if (shake > 0.001) { camera.position.x += (Math.random() - 0.5) * 0.18 * shake; camera.position.y += (Math.random() - 0.5) * 0.12 * shake; shake *= 0.88; }
    camera.lookAt(look);
  }
  function spin(d, k) { const ang = d.w.length() * k; if (ang > 0) { tmpQ.setFromAxisAngle(d.w.clone().normalize(), ang); d.q.premultiply(tmpQ).normalize(); } }
  function physics(d, i, dt) {
    const sub = 3, h = dt / sub;
    for (let s = 0; s < sub; s++) {
      d.v.y -= 15 * h; d.p.addScaledVector(d.v, h);
      if (d.p.y < REST + 0.07) {
        d.p.y = REST + 0.07; const imp = Math.abs(d.v.y);
        if (d.v.y < 0) { d.v.y = -d.v.y * 0.48; d.v.x *= 0.78; d.v.z *= 0.78; d.w.multiplyScalar(0.72); d.w.x += (Math.random() - 0.5) * 6; d.w.z += (Math.random() - 0.5) * 6; }
        const now = performance.now(); if (imp > 1.2 && now - d.lastHit > 120 && hooks.onHit) { d.lastHit = now; hooks.onHit(Math.min(1, imp / 7), d.p.x / 2); }
      }
      const rr = Math.hypot(d.p.x, d.p.z);
      if (rr > R_WALL) { const nx = d.p.x / rr, nz = d.p.z / rr, vn = d.v.x * nx + d.v.z * nz; if (vn > 0) { d.v.x -= 1.6 * vn * nx; d.v.z -= 1.6 * vn * nz; } d.p.x = nx * R_WALL; d.p.z = nz * R_WALL; }
      dice.forEach((o, j) => { if (j <= i) return; const dv = o.p.clone().sub(d.p), dist = dv.length(); if (dist < 1.0 && dist > 0.001) { dv.divideScalar(dist); const push = (1.0 - dist) / 2; d.p.addScaledVector(dv, -push); o.p.addScaledVector(dv, push); const rel = o.v.clone().sub(d.v).dot(dv); if (rel < 0) { d.v.addScaledVector(dv, rel * 0.9); o.v.addScaledVector(dv, -rel * 0.9); } } });
    }
    spin(d, dt);
  }
  function loop() {
    if (!running) return; requestAnimationFrame(loop);
    const dt = Math.min(0.05, clock.getDelta()); step(dt); renderer.render(scene, camera);
  }
  showIdle([0, 1, 2]); loop();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) clock.getDelta(); });
  return { showIdle, lock, roll, reveal, resize };
}
