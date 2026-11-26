/* 六种图案：统一风格的 SVG 插画（原创矢量） */
(function () {
  const r = (n) => Math.round(n * 10) / 10;
  const rad = (d) => (d * Math.PI) / 180;

  // ---------- 虾：沿弧线生成分节身体 ----------
  function shrimp() {
    const cx = 54, cy = 50, R = 23;
    const segs = [];
    const n = 8;
    for (let k = n - 1; k >= 0; k--) {
      const a = -140 + k * 33;
      const x = cx + R * Math.cos(rad(a)), y = cy + R * Math.sin(rad(a));
      const s = 13.5 - k * 0.9;
      segs.push(`<ellipse cx="${r(x)}" cy="${r(y)}" rx="${r(s * 0.78)}" ry="${r(s)}" transform="rotate(${r(a)} ${r(x)} ${r(y)})" fill="url(#g-shr)" stroke="#b3261e" stroke-width="1"/>`);
      segs.push(`<ellipse cx="${r(x + Math.cos(rad(a)) * s * 0.35)}" cy="${r(y + Math.sin(rad(a)) * s * 0.35)}" rx="${r(s * 0.25)}" ry="${r(s * 0.75)}" transform="rotate(${r(a)} ${r(x)} ${r(y)})" fill="#ffd2b0" opacity=".45"/>`);
      if (k > 0 && k < 6) {
        const ix = cx + (R - 12) * Math.cos(rad(a)), iy = cy + (R - 12) * Math.sin(rad(a));
        const ex = cx + (R - 20) * Math.cos(rad(a + 8)), ey = cy + (R - 20) * Math.sin(rad(a + 8));
        segs.unshift(`<path d="M${r(ix)} ${r(iy)} L${r(ex)} ${r(ey)}" stroke="#e0533a" stroke-width="2" stroke-linecap="round"/>`);
      }
    }
    // tail fan
    const ta = 132, tx = cx + R * Math.cos(rad(ta)), ty = cy + R * Math.sin(rad(ta));
    const tail = [-28, 0, 28].map((o) => `<ellipse cx="${r(tx - 9)}" cy="${r(ty + 5)}" rx="11" ry="5" transform="rotate(${150 + o} ${r(tx)} ${r(ty)})" fill="url(#g-shr2)" stroke="#b3261e" stroke-width=".8"/>`).join('');
    const ha = -150, hx = cx + (R + 1) * Math.cos(rad(ha)), hy = cy + (R + 1) * Math.sin(rad(ha));
    const head = `
      <path d="M${r(hx - 4)} ${r(hy - 6)} C 40 2, 78 0, 96 12" stroke="#e8542f" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <path d="M${r(hx - 2)} ${r(hy - 8)} C 34 -4, 64 -6, 88 4" stroke="#f07a4a" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <path d="M${r(hx - 6)} ${r(hy)} L 10 22 L ${r(hx - 2)} ${r(hy + 4)} Z" fill="#e8542f"/>
      <ellipse cx="${r(hx)}" cy="${r(hy)}" rx="12" ry="14" transform="rotate(-60 ${r(hx)} ${r(hy)})" fill="url(#g-shr)" stroke="#b3261e" stroke-width="1"/>
      <ellipse cx="${r(hx + 2)}" cy="${r(hy - 3)}" rx="4" ry="7" transform="rotate(-60 ${r(hx)} ${r(hy)})" fill="#ffd2b0" opacity=".5"/>
      <circle cx="${r(hx - 5)}" cy="${r(hy - 3)}" r="3" fill="#1c0f0a"/><circle cx="${r(hx - 6)}" cy="${r(hy - 4)}" r="1" fill="#fff"/>
      <path d="M${r(hx - 2)} ${r(hy + 8)} l -8 10 M${r(hx + 3)} ${r(hy + 10)} l -5 12" stroke="#e0533a" stroke-width="2" stroke-linecap="round"/>`;
    return tail + segs.join('') + head;
  }

  // ---------- 孔雀：开屏尾羽 ----------
  function peacock() {
    const fx = 58, fy = 70;
    let out = '';
    const layer = (len, w, from, to, step, eyeR) => {
      for (let a = from; a <= to; a += step) {
        const mx = fx + (len / 2) * Math.cos(rad(a)), my = fy + (len / 2) * Math.sin(rad(a));
        const ex = fx + (len - eyeR) * Math.cos(rad(a)), ey = fy + (len - eyeR) * Math.sin(rad(a));
        out += `<ellipse cx="${r(mx)}" cy="${r(my)}" rx="${r(len / 2)}" ry="${w}" transform="rotate(${a} ${r(mx)} ${r(my)})" fill="url(#g-feather)"/>`;
        out += `<path d="M${fx} ${fy} L${r(ex)} ${r(ey)}" stroke="#c9e27a" stroke-width=".7" opacity=".6"/>`;
        out += `<ellipse cx="${r(ex)}" cy="${r(ey)}" rx="${eyeR}" ry="${r(eyeR * 0.8)}" transform="rotate(${a} ${r(ex)} ${r(ey)})" fill="#e7c24a"/>`;
        out += `<ellipse cx="${r(ex)}" cy="${r(ey)}" rx="${r(eyeR * 0.68)}" ry="${r(eyeR * 0.55)}" transform="rotate(${a} ${r(ex)} ${r(ey)})" fill="#1d8f74"/>`;
        out += `<circle cx="${r(ex)}" cy="${r(ey)}" r="${r(eyeR * 0.36)}" fill="#122a6b"/>`;
      }
    };
    layer(44, 8, -168, -4, 14, 5.2);
    layer(30, 6, -160, -10, 15, 3.6);
    return out + `
      <path d="M50 88 L48 96 M56 88 L58 96" stroke="#c8892c" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M42 82 C30 76 32 58 40 52 C44 46 42 38 40 31 L47 29 C51 39 50 46 53 52 C63 60 62 82 42 82 Z" fill="url(#g-pea)"/>
      <path d="M46 62 C56 60 60 70 56 80 C50 80 44 74 46 62 Z" fill="#0f5e74" opacity=".9"/>
      <circle cx="43" cy="27" r="7" fill="url(#g-pea)"/>
      <path d="M36 26 L29 29 L36 30 Z" fill="#e0a030"/>
      <path d="M40 24 C42 22 46 22 47 25 C45 27 42 27 40 24 Z" fill="#fff"/>
      <circle cx="42.5" cy="24.8" r="1.4" fill="#111"/>
      <path d="M42 20 L39 11 M44 20 L44 10 M46 20 L49 11" stroke="#1f5fbf" stroke-width="1" />
      <circle cx="39" cy="10.5" r="1.8" fill="#2a7bd8"/><circle cx="44" cy="9.5" r="1.8" fill="#2a7bd8"/><circle cx="49" cy="10.5" r="1.8" fill="#2a7bd8"/>`;
  }

  // ---------- 红鲤鱼鳞片 ----------
  function carpScales() {
    let s = '';
    for (let row = 0; row < 3; row++) {
      for (let c = 0; c < 6; c++) {
        const x = 30 + c * 6.5 + (row % 2) * 3, y = 42 + row * 6;
        if (x > 66) continue;
        s += `<path d="M${x} ${y} q3 4 0 7" stroke="#ffd29a" stroke-width="1" fill="none" opacity=".55"/>`;
      }
    }
    return s;
  }

  const SHADOW = '<ellipse cx="52" cy="92" rx="34" ry="4" fill="rgba(0,0,0,.18)"/>';

  const defs = `
  <defs>
    <radialGradient id="g-ele" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#c9c4cc"/><stop offset="1" stop-color="#77717d"/></radialGradient>
    <linearGradient id="g-ele-d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8d8793"/><stop offset="1" stop-color="#5f5965"/></linearGradient>
    <radialGradient id="g-ear" cx="40%" cy="40%" r="70%"><stop offset="0" stop-color="#d9c6c8"/><stop offset="1" stop-color="#8f8792"/></radialGradient>
    <linearGradient id="g-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a3"/><stop offset=".5" stop-color="#e5b53f"/><stop offset="1" stop-color="#a87520"/></linearGradient>
    <linearGradient id="g-red" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e23b3b"/><stop offset="1" stop-color="#8e1420"/></linearGradient>
    <radialGradient id="g-rab" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#f2ece4"/><stop offset="1" stop-color="#d9cdbf"/></radialGradient>
    <linearGradient id="g-carp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7a45"/><stop offset=".55" stop-color="#e8262b"/><stop offset="1" stop-color="#9e0f1e"/></linearGradient>
    <linearGradient id="g-fin" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff5a3c"/><stop offset="1" stop-color="#ffb36b" stop-opacity=".85"/></linearGradient>
    <radialGradient id="g-shr" cx="35%" cy="35%" r="75%"><stop offset="0" stop-color="#ffab7a"/><stop offset="1" stop-color="#e2412b"/></radialGradient>
    <linearGradient id="g-shr2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff8a5c"/><stop offset="1" stop-color="#c9301f"/></linearGradient>
    <linearGradient id="g-feather" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1e6b4a"/><stop offset=".6" stop-color="#2f9e5c"/><stop offset="1" stop-color="#7cc46a"/></linearGradient>
    <radialGradient id="g-pea" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#4aa8ff"/><stop offset=".6" stop-color="#1857c4"/><stop offset="1" stop-color="#0c2f7a"/></radialGradient>
    <radialGradient id="g-horse" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="#c98447"/><stop offset="1" stop-color="#6e3a1c"/></radialGradient>
    <radialGradient id="g-face" cx="40%" cy="35%" r="75%"><stop offset="0" stop-color="#ffe2c4"/><stop offset="1" stop-color="#d9a37a"/></radialGradient>
  </defs>`;

  const sym = {};

  sym.elephant = SHADOW + `
    <path d="M89 50 q6 9 1 19" stroke="#6d6a70" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <rect x="42" y="62" width="11" height="27" rx="4" fill="url(#g-ele-d)"/>
    <rect x="76" y="62" width="11" height="27" rx="4" fill="url(#g-ele-d)"/>
    <ellipse cx="63" cy="54" rx="28" ry="21" fill="url(#g-ele)"/>
    <rect x="50" y="64" width="11" height="26" rx="4" fill="url(#g-ele)"/>
    <rect x="67" y="64" width="11" height="26" rx="4" fill="url(#g-ele)"/>
    <path d="M51 88h9M68 88h9" stroke="#efe7d8" stroke-width="2" stroke-linecap="round"/>
    <path d="M52 34 C62 30 76 31 83 37 L81 56 C72 60 60 60 54 56 Z" fill="url(#g-red)" stroke="url(#g-gold)" stroke-width="2"/>
    <path d="M55 52 C63 55 73 55 80 52" stroke="url(#g-gold)" stroke-width="1.5" fill="none"/>
    <circle cx="67" cy="45" r="3" fill="url(#g-gold)"/>
    <circle cx="35" cy="42" r="17" fill="url(#g-ele)"/>
    <path d="M40 28 C60 25 62 54 46 62 C39 60 37 46 40 28 Z" fill="url(#g-ear)" stroke="#7d7880" stroke-width="1"/>
    <path d="M23 46 C14 56 14 71 20 81 C23 85 29 83 28 78 C24 70 25 60 32 54 Z" fill="url(#g-ele)"/>
    <path d="M18 62 q4 1 7 -1 M17 69 q4 1 7 -1 M18 75 q4 1 7 -1" stroke="#6f6975" stroke-width="1" fill="none"/>
    <path d="M28 55 C23 61 20 64 13 64 C20 69 29 65 32 57 Z" fill="#fffaf0" stroke="#d8cfb8" stroke-width=".8"/>
    <circle cx="30" cy="38" r="2.3" fill="#2b2420"/><circle cx="29.3" cy="37.2" r=".8" fill="#fff"/>
    <path d="M21 31 C27 20 43 20 49 31 L45 34 C39 27 31 27 25 34 Z" fill="url(#g-gold)"/>
    <circle cx="35" cy="25.5" r="3.2" fill="#c0392b" stroke="#ffe9a3" stroke-width="1"/>
    <path d="M25 34 l-1 6 M30 31 l-.5 6 M40 31 l.5 6 M45 34 l1 6" stroke="#e5b53f" stroke-width="1.4" stroke-linecap="round"/>`;

  sym.rabbit = SHADOW + `
    <circle cx="81" cy="68" r="7" fill="url(#g-rab)"/>
    <ellipse cx="59" cy="66" rx="24" ry="20" fill="url(#g-rab)"/>
    <ellipse cx="67" cy="80" rx="17" ry="8" fill="url(#g-rab)" stroke="#e3d8ca" stroke-width=".8"/>
    <g transform="rotate(-14 34 22)"><ellipse cx="34" cy="20" rx="7" ry="18" fill="url(#g-rab)"/><ellipse cx="34" cy="21" rx="3.4" ry="13" fill="#f6a9bb"/></g>
    <g transform="rotate(14 47 20)"><ellipse cx="47" cy="19" rx="7" ry="18" fill="url(#g-rab)"/><ellipse cx="47" cy="20" rx="3.4" ry="13" fill="#f6a9bb"/></g>
    <circle cx="39" cy="45" r="17" fill="url(#g-rab)"/>
    <circle cx="31" cy="51" r="4.5" fill="#f7b6c2" opacity=".75"/>
    <circle cx="36" cy="42" r="3.3" fill="#3a1f1a"/><circle cx="35" cy="40.8" r="1.1" fill="#fff"/>
    <path d="M23 47 q2.2 -2.4 4.4 0 q-2.2 3 -4.4 0z" fill="#e57391"/>
    <path d="M25 50 q1 3 4 3" stroke="#c98b8b" stroke-width="1" fill="none"/>
    <path d="M24 48 L12 45 M24 49.5 L11 50 M24 51 L13 55" stroke="#bfb1a2" stroke-width=".8"/>
    <ellipse cx="42" cy="81" rx="8" ry="5" fill="url(#g-rab)" stroke="#e3d8ca" stroke-width=".8"/>
    <path d="M44 63 L30 84 C28 87 25 85 26 82 L40 61 Z" fill="#f28b2a"/>
    <path d="M42 62 c-2 -6 2 -8 4 -9 M43 62 c3 -5 7 -4 8 -3 M42 62 c-4 -3 -7 -1 -8 0" stroke="#3aa04a" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M34 72 l3 1 M31 77 l3 1" stroke="#c76a15" stroke-width="1"/>`;

  sym.carp = SHADOW + `
    <path d="M68 50 C78 34 92 26 97 31 C90 42 90 58 97 69 C91 74 78 66 68 50 Z" fill="url(#g-fin)" stroke="#c8102e" stroke-width=".8"/>
    <path d="M74 48 C82 40 88 36 92 36 M74 52 C82 60 88 64 92 64" stroke="#ffd29a" stroke-width=".8" fill="none" opacity=".7"/>
    <path d="M30 36 C38 18 58 20 64 40 Z" fill="url(#g-fin)" stroke="#c8102e" stroke-width=".8"/>
    <path d="M38 62 C40 76 52 78 54 64 Z" fill="url(#g-fin)"/>
    <path d="M10 50 C18 33 52 28 71 44 C75 48 75 52 71 56 C52 72 18 67 10 50 Z" fill="url(#g-carp)" stroke="#8e0c18" stroke-width="1"/>
    <path d="M16 56 C30 64 52 64 66 56" stroke="#ffcf8a" stroke-width="3" fill="none" opacity=".55" stroke-linecap="round"/>
    ${carpScales()}
    <path d="M26 38 C24 46 24 54 27 61" stroke="#9e0f1e" stroke-width="1.4" fill="none"/>
    <circle cx="19" cy="46" r="3.8" fill="#fff6e0"/><circle cx="18.4" cy="46" r="2.2" fill="#1a0b08"/><circle cx="17.8" cy="45.2" r=".7" fill="#fff"/>
    <path d="M12 53 Q5 60 8 68 M14 55 Q10 62 13 70" stroke="#c8102e" stroke-width="1.3" fill="none" stroke-linecap="round"/>
    <path d="M30 32 C34 26 40 24 44 25" stroke="#ffd29a" stroke-width="1" fill="none"/>`;

  sym.shrimp = shrimp();
  sym.peacock = SHADOW + peacock();

  sym.horse = SHADOW + `
    <path d="M76 44 C92 40 96 58 88 74 C86 64 82 57 76 53 Z" fill="#3e2311"/>
    <path d="M71 56 L79 69 L72 84" stroke="#5c3118" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M64 58 L61 72 L68 85" stroke="#5c3118" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="68" y="83" width="8" height="4" rx="1.5" fill="#24140a"/><rect x="65" y="84" width="8" height="4" rx="1.5" fill="#24140a"/>
    <ellipse cx="57" cy="49" rx="24" ry="13.5" fill="url(#g-horse)"/>
    <path d="M42 57 L32 65 L27 56" stroke="#8a4c25" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M47 59 L45 73 L38 85" stroke="#8a4c25" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="23" y="51" width="7" height="4" rx="1.5" transform="rotate(-50 26 53)" fill="#24140a"/><rect x="34" y="84" width="8" height="4" rx="1.5" fill="#24140a"/>
    <path d="M36 50 C29 40 27 29 30 20 L43 16 C45 29 47 37 54 42 Z" fill="url(#g-horse)"/>
    <path d="M31 19 C26 16 17 21 11 29 C8 33 11 38 15 37 C22 36 28 34 35 31 Z" fill="url(#g-horse)"/>
    <path d="M33 17 L35 8 L39 17 Z" fill="#7a4220"/>
    <path d="M38 14 C47 18 49 31 56 40 C49 38 45 32 41 26 C40 31 37 25 35 22 C33 21 34 16 38 14 Z" fill="#3b2212"/>
    <path d="M36 15 C32 11 30 14 31 18" fill="#3b2212"/>
    <circle cx="25.5" cy="24" r="1.9" fill="#1a0f08"/><circle cx="25" cy="23.4" r=".6" fill="#fff"/>
    <circle cx="13.5" cy="32" r="1.1" fill="#2a160b"/>
    <path d="M44 40 C52 36 62 36 70 40" stroke="#e0a86a" stroke-width="1.5" fill="none" opacity=".5"/>`;

  sym.avatar = `
    <circle cx="50" cy="50" r="50" fill="#123f3c"/>
    <path d="M18 100 C20 74 80 74 82 100 Z" fill="#d4a63a"/>
    <circle cx="50" cy="44" r="20" fill="url(#g-face)"/>
    <path d="M28 44 C26 20 74 18 72 44 C70 34 60 28 50 30 C40 28 30 34 28 44 Z" fill="#2a1a12"/>
    <circle cx="43" cy="46" r="2" fill="#2a1a12"/><circle cx="57" cy="46" r="2" fill="#2a1a12"/>
    <path d="M44 55 q6 4 12 0" stroke="#a5523a" stroke-width="2" fill="none" stroke-linecap="round"/>
    <circle cx="68" cy="30" r="5" fill="#e8542f"/>`;

  const symbols = Object.entries(sym).map(([id, body]) => `<symbol id="s-${id}" viewBox="0 0 100 100">${body}</symbol>`).join('');
  document.getElementById('sprite').innerHTML =
    `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">${defs}${symbols}</svg>`;

  window.SYMBOLS = [
    { id: 'elephant', name: '大象' },
    { id: 'rabbit', name: '兔子' },
    { id: 'carp', name: '红鲤鱼' },
    { id: 'shrimp', name: '虾' },
    { id: 'peacock', name: '孔雀' },
    { id: 'horse', name: '马' },
  ];
})();
