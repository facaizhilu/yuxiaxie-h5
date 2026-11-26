/* 共享合成工具（被 render-audio*.html 使用） */
const SR = 44100;
let seed = 12345;
const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const mk = (len, ch = 2) => new OfflineAudioContext(ch, Math.ceil(len * SR), SR);

function setup(c, revSec = 1.6, revVol = 0.3) {
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.18;
  const master = c.createGain(); master.connect(comp); comp.connect(c.destination);
  const conv = c.createConvolver(); const n = Math.floor(SR * revSec);
  const ib = c.createBuffer(2, n, SR);
  for (let ch = 0; ch < 2; ch++) { const d = ib.getChannelData(ch); let lp = 0; for (let i = 0; i < n; i++) { lp = lp * 0.55 + (rnd() * 2 - 1) * 0.45; d[i] = lp * Math.pow(1 - i / n, 2.6); } }
  conv.buffer = ib; const rv = c.createGain(); rv.gain.value = revVol; conv.connect(rv); rv.connect(master);
  const nb = c.createBuffer(1, SR * 2, SR); const nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = rnd() * 2 - 1;
  c.__nb = nb;
  return { master, in(pan = 0, send = 0.2) { const p = c.createStereoPanner(); p.pan.value = pan; const s = c.createGain(); s.gain.value = send; p.connect(master); p.connect(s); s.connect(conv); return p; } };
}
function nz(c, t, dur, type, f, q, vol, out, sweepTo, atk = 0.002) {
  const s = c.createBufferSource(); s.buffer = c.__nb; s.loop = true;
  const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (sweepTo) fl.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(out); s.start(t, rnd()); s.stop(t + dur + 0.05);
}
function osc(c, t, dur, type, f, vol, out, f2, atk = 0.004, dcy) {
  const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + (dcy || dur));
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
}

/* ---- 乐器 ---- */
function kick(c, t, v, out) { osc(c, t, 0.4, 'sine', 165, v, out, 42, 0.002, 0.38); nz(c, t, 0.02, 'bandpass', 3500, 1, v * 0.3, out); }
function taiko(c, t, v, out) { osc(c, t, 0.9, 'sine', 120, v, out, 52, 0.003, 0.8); osc(c, t, 0.5, 'triangle', 240, v * 0.3, out, 90, 0.002, 0.3); nz(c, t, 0.12, 'bandpass', 600, 0.8, v * 0.45, out); }
function clap(c, t, v, out) { for (let i = 0; i < 3; i++) nz(c, t + i * 0.011, 0.07, 'bandpass', 1500, 0.9, v * 0.5, out); nz(c, t + 0.033, 0.2, 'bandpass', 1700, 0.8, v * 0.6, out); osc(c, t, 0.12, 'triangle', 190, v * 0.25, out, 140); }
function hat(c, t, v, open, out) { nz(c, t, open ? 0.2 : 0.045, 'highpass', 7500, 0.7, v, out); }
function shaker(c, t, v, out) { nz(c, t, 0.05, 'bandpass', 6500, 1.2, v, out, 0, 0.012); }
function wood(c, t, v, out, f = 1800) { osc(c, t, 0.09, 'triangle', f, v, out, f * 0.92, 0.001, 0.08); osc(c, t, 0.05, 'sine', f * 1.9, v * 0.4, out, 0, 0.001, 0.04); nz(c, t, 0.02, 'bandpass', 4000, 2, v * 0.3, out); }
function crash(c, t, v, dur, out) { nz(c, t, dur, 'highpass', 4200, 0.6, v, out, 0, 0.004); nz(c, t, dur * 0.7, 'bandpass', 8000, 1.5, v * 0.5, out, 0, 0.004); }
function bell(c, t, midi, v, d, out) {
  const f = mtof(midi), R = [1, 2, 3, 4.2, 5.4], A = [1, 0.5, 0.3, 0.15, 0.08];
  R.forEach((r, i) => osc(c, t, d / (1 + i * 0.6), 'sine', f * r, v * A[i], out, 0, 0.002, d / (1 + i * 0.6)));
}
function bass(c, t, midi, dur, v, out) {
  const f = mtof(midi), o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter();
  o.type = 'sawtooth'; o2.type = 'sine'; o.frequency.value = f; o2.frequency.value = f;
  fl.type = 'lowpass'; fl.Q.value = 3; fl.frequency.setValueAtTime(1400, t); fl.frequency.exponentialRampToValueAtTime(260, t + 0.16);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.006); g.gain.setValueAtTime(v, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const g2 = c.createGain(); g2.gain.value = 0.9; o.connect(fl); fl.connect(g); o2.connect(g2); g2.connect(g); g.connect(out); o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
}
const ksCache = {};
function ksBuf(f, dur) {
  const key = f.toFixed(1) + dur; if (ksCache[key]) return ksCache[key];
  const n = Math.floor(SR * dur), d = new Float32Array(n), L = Math.max(2, Math.round(SR / f));
  let prev = 0; for (let i = 0; i < L; i++) { const w = rnd() * 2 - 1; prev = prev * 0.45 + w * 0.55; d[i] = prev; }
  const decay = 0.9972 - Math.min(0.004, f / 200000);
  for (let i = L; i < n; i++) d[i] = 0.5 * (d[i - L] + d[i - L + 1]) * decay;
  let mx = 0; for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(d[i])); for (let i = 0; i < n; i++) d[i] /= mx;
  const b = new AudioBuffer({ length: n, sampleRate: SR, numberOfChannels: 1 }); b.copyToChannel(d, 0); return (ksCache[key] = b);
}
function pluck(c, t, midi, v, out, dur = 1.3) {
  const s = c.createBufferSource(); s.buffer = ksBuf(mtof(midi), dur); const g = c.createGain(); g.gain.value = v;
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 160; s.connect(hp); hp.connect(g); g.connect(out); s.start(t);
}
function erhu(c, t, midi, dur, v, out) {
  const f = mtof(midi), o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain();
  const fl = c.createBiquadFilter(), pk = c.createBiquadFilter();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 0.94, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
  lfo.frequency.value = 5.6; lg.gain.value = f * 0.012; lfo.connect(lg); lg.connect(o.frequency);
  fl.type = 'lowpass'; fl.frequency.value = 2400; fl.Q.value = 1.2; pk.type = 'peaking'; pk.frequency.value = 1400; pk.gain.value = 7; pk.Q.value = 1.4;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.05); g.gain.setValueAtTime(v * 0.9, t + Math.max(0.06, dur - 0.1)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
  o.connect(fl); fl.connect(pk); pk.connect(g); g.connect(out); o.start(t); lfo.start(t + 0.1); o.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
}
function pad(c, t, midis, dur, v, out) {
  midis.forEach((m) => [-6, 6].forEach((dt) => {
    const o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter(); o.type = 'triangle'; o.frequency.value = mtof(m); o.detune.value = dt;
    fl.type = 'lowpass'; fl.frequency.value = 1100; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + dur * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); fl.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  }));
}
function brass(c, t, midis, dur, v, out, swell = 0) {
  midis.forEach((m) => [-7, 7].forEach((dt) => {
    const o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = dt;
    fl.type = 'lowpass'; fl.Q.value = 1; fl.frequency.setValueAtTime(500, t); fl.frequency.exponentialRampToValueAtTime(3800, t + 0.07 + swell); fl.frequency.exponentialRampToValueAtTime(1600, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.025 + swell * 0.6); g.gain.setValueAtTime(v * 0.8, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); fl.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  }));
}
function sparkle(c, t, out, v = 0.1) { const f = 2600 + rnd() * 3800; osc(c, t, 0.25, 'sine', f, v, out, f * 1.02, 0.001, 0.22); osc(c, t, 0.12, 'sine', f * 2.01, v * 0.4, out, 0, 0.001, 0.1); }

/* ---- 导出 ---- */
function norm(buf, peak) {
  let mx = 0; for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < d.length; i++) mx = Math.max(mx, Math.abs(d[i])); }
  const k = peak / (mx || 1); for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] *= k; }
}
function wavB64(buf) {
  const ch = buf.numberOfChannels, n = buf.length, out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true);
  out.setUint32(24, SR, true); out.setUint32(28, SR * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * ch * 2, true);
  const dd = []; for (let c = 0; c < ch; c++) dd.push(buf.getChannelData(c));
  let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, dd[c][i])); out.setInt16(o, s < 0 ? s * 32768 : s * 32767, true); o += 2; }
  const u = new Uint8Array(out.buffer); let bin = ''; for (let i = 0; i < u.length; i += 8192) bin += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(bin);
}
function fadeOut(buf, sec) { const n = Math.floor(sec * SR); for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < n; i++) d[d.length - 1 - i] *= i / n; } }

async function fin(c, peak, fade = 0.02) { const r = await c.startRendering(); norm(r, peak); if (fade) fadeOut(r, fade); return r; }
