// portraits.js — dialogue portraits as cute stylized chibi illustrations (vector, drawn in code):
// huge round head, big dark eyes with large highlights, rosy cheeks, bold sticker outline,
// flat colours with one hard cel-shadow tone, muted earthy palette, soft round backdrop.
const S = 192;                 // canvas size (shown at ~96 css px → crisp on hi-dpi)
const INK = '#2b211c', LW = 5;

const shade = (hex, f) => { const v = parseInt(hex.slice(1), 16); return '#' + [v >> 16, (v >> 8) & 255, v & 255].map(k => Math.max(0, Math.min(255, Math.round(k * f))).toString(16).padStart(2, '0')).join(''); };

// ---- path helpers (all return a Path2D)
function ell(cx, cy, rx, ry, rot = 0) { const p = new Path2D(); p.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2); return p; }
function squircle(cx, cy, rx, ry, k = 0.62) { // rounder-than-ellipse head shape
  const p = new Path2D(), n = 64;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const x = cx + rx * Math.sign(c) * Math.pow(Math.abs(c), k), y = cy + ry * Math.sign(s) * Math.pow(Math.abs(s), k);
    i ? p.lineTo(x, y) : p.moveTo(x, y);
  }
  p.closePath(); return p;
}
function poly(pts, smooth = false) {
  const p = new Path2D();
  if (!smooth) { pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); return p; }
  const n = pts.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let m = mid(pts[n - 1], pts[0]); p.moveTo(m[0], m[1]);
  for (let i = 0; i < n; i++) { const c = pts[i], q = mid(c, pts[(i + 1) % n]); p.quadraticCurveTo(c[0], c[1], q[0], q[1]); }
  p.closePath(); return p;
}
// fill with a hard cel shadow (crescent on the lower right) and an ink outline
function shape(ctx, path, col, { shadow = 0.8, dx = 7, dy = 6, line = LW, hi = null } = {}) {
  ctx.save();
  ctx.fillStyle = col; ctx.fill(path);
  if (shadow) {
    ctx.clip(path);
    ctx.fillStyle = shade(col, shadow); ctx.fill(path);
    ctx.translate(-dx, -dy); ctx.fillStyle = col; ctx.fill(path);
    if (hi) { ctx.translate(-dx * 0.6, -dy * 0.8); ctx.globalAlpha = 0.35; ctx.fillStyle = hi; ctx.fill(path); }
  }
  ctx.restore();
  if (line) { ctx.lineWidth = line; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke(path); }
}
function line(ctx, pts, w = 4, col = INK) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.lineWidth = w; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); }
function arc(ctx, cx, cy, r, a0, a1, w = 4, col = INK) { ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.lineWidth = w; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.stroke(); }

// ---- face parts
function eyes(ctx, L, cy) {
  const gap = 25, Y = cy + 14;
  if (L.closed) { // happy closed eyes (^ ^)
    for (const s of [-1, 1]) arc(ctx, 96 + s * gap, Y + 6, 10, Math.PI * 1.1, Math.PI * 1.9, 5);
  } else {
    for (const s of [-1, 1]) {
      const x = 96 + s * gap;
      ctx.fillStyle = INK; ctx.fill(ell(x, Y, 12.5, 15));
      ctx.fillStyle = L.iris || '#4a3426'; ctx.fill(ell(x, Y + 4, 9, 9.5));
      ctx.fillStyle = INK; ctx.fill(ell(x, Y + 3, 6, 7));
      ctx.fillStyle = '#ffffff'; ctx.fill(ell(x - 4.5, Y - 5, 5, 5.5)); ctx.fill(ell(x + 5, Y + 7, 2.4, 2.4));
      if (L.lash) line(ctx, [[x + s * 9, Y - 12], [x + s * 15, Y - 17]], 3.5);
    }
  }
  if (L.glasses) for (const s of [-1, 1]) { ctx.lineWidth = 3.5; ctx.strokeStyle = '#6a4a30'; ctx.stroke(ell(96 + s * gap, Y + 1, 17, 17)); line(ctx, [[96 - 8, Y], [96 + 8, Y]], 3, '#6a4a30'); }
  // brows
  const bc = L.brow || shade(L.hair, 0.7), bw = L.thickBrow ? 6 : 3.5;
  for (const s of [-1, 1]) line(ctx, [[96 + s * (gap - 9), cy - 7 + (L.thickBrow ? 2 : 0)], [96 + s * (gap + 7), cy - 9 - (L.angry ? -3 : 0)]], bw, bc);
}
function cheeks(ctx, cy) { ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = '#f07a78'; ctx.fill(ell(96 - 42, cy + 32, 11, 6.5)); ctx.fill(ell(96 + 42, cy + 32, 11, 6.5)); ctx.restore(); }
function mouth(ctx, L, cy) {
  const y = cy + 36;
  if (L.beard) return;
  if (L.open) { const p = new Path2D(); p.moveTo(88, y - 2); p.quadraticCurveTo(96, y + 12, 104, y - 2); p.closePath(); ctx.fillStyle = '#9a3a32'; ctx.fill(p); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(p); }
  else arc(ctx, 96, y - 5, 6, Math.PI * 0.2, Math.PI * 0.8, 3.5);
}

// ---- characters
const LOOK = {
  player: { skin: '#f7d2b0', hair: '#6a4028', top: '#4f8a64', iris: '#5a3a22', hat: 'beanie', hatC: '#d0573a', scarf: '#e8b74a', bangs: 'boy', straps: '#8a5a32', open: true },
  amei: { skin: '#f2cfae', hair: '#dcd8d2', top: '#8e6aa0', hat: 'bun', shawl: '#d98f52', glasses: true, closed: true, wrinkle: true },
  wang: { skin: '#e2b088', hair: '#9a928a', top: '#5a7a98', hat: 'straw', beard: '#b0aaa2', closed: true, wrinkle: true },
  chen: { skin: '#df9f72', hair: '#3a2a20', top: '#b8483a', plaid: '#7c2c22', hat: 'cap', hatC: '#4a6a44', beard: '#3a2a20', thickBrow: true, iris: '#3a2418' },
  song: { skin: '#f6d2ae', hair: '#2e2e36', top: '#ece2c8', apron: '#7c5c3c', glasses: true, bangs: 'messy', iris: '#2e2e44' },
  yu: { skin: '#f9dcbc', hair: '#b4482e', top: '#e8b840', hat: 'cap', hatC: '#36628a', bangs: 'side', pony: true, iris: '#3a6aa0', lash: true, open: true },
  grandpa: { skin: '#efc29a', hair: '#efeee8', top: '#62703e', hat: 'ranger', hatC: '#80704a', beard: '#efeee8', closed: true, wrinkle: true },
};

function backdrop(ctx, a, b) {
  const g = ctx.createRadialGradient(96, 80, 10, 96, 96, 130); g.addColorStop(0, a); g.addColorStop(1, b);
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = '#ffffff';
  for (const [x, y, r] of [[30, 34, 5], [160, 28, 3.5], [168, 120, 4], [22, 140, 3]]) ctx.fill(ell(x, y, r, r));
  ctx.restore();
}

function human(ctx, L) {
  const cy = 86, hr = L.hair, skin = L.skin;
  // ---- shoulders / outfit (behind head)
  shape(ctx, poly([[28, 192], [36, 156], [62, 138], [130, 138], [156, 156], [164, 192]], true), L.top, { dx: 10, dy: 4 });
  if (L.plaid) { ctx.save(); ctx.clip(poly([[28, 192], [36, 156], [62, 138], [130, 138], [156, 156], [164, 192]], true)); ctx.globalAlpha = 0.45; ctx.fillStyle = L.plaid; for (let x = 20; x < 180; x += 22) ctx.fillRect(x, 130, 8, 70); for (let y = 150; y < 200; y += 22) ctx.fillRect(0, y, 200, 7); ctx.restore(); }
  if (L.apron) shape(ctx, poly([[70, 192], [72, 150], [120, 150], [122, 192]]), L.apron, { dx: 6, dy: 0 });
  if (L.straps) { shape(ctx, poly([[52, 192], [58, 146], [70, 144], [66, 192]]), L.straps, { shadow: 0.85 }); shape(ctx, poly([[140, 192], [134, 146], [122, 144], [126, 192]]), L.straps, { shadow: 0.85 }); }
  if (L.shawl) shape(ctx, poly([[40, 168], [56, 140], [96, 154], [136, 140], [152, 168], [96, 182]], true), L.shawl, { dx: 6, dy: 5 });
  if (L.scarf) { shape(ctx, poly([[56, 146], [70, 132], [122, 132], [136, 146], [96, 160]], true), L.scarf); shape(ctx, poly([[108, 150], [124, 148], [128, 182], [112, 184]], true), shade(L.scarf, 0.92)); }
  // neck
  shape(ctx, poly([[82, 120], [110, 120], [108, 144], [84, 144]]), shade(skin, 0.9), { shadow: 0 });
  // ---- back hair / hood
  if (L.pony) shape(ctx, poly([[150, 70], [176, 92], [172, 140], [150, 128], [148, 96]], true), shade(hr, 0.92));
  if (!L.hat || L.hat === 'bun' || L.hat === 'cap') shape(ctx, squircle(96, cy - 2, 64, 60, 0.7), shade(hr, 0.85), { shadow: 0 });
  // ears
  for (const s of [-1, 1]) shape(ctx, ell(96 + s * 58, cy + 16, 9, 12), skin, { shadow: 0.88, dx: s * 3, dy: 3 });
  // ---- face
  shape(ctx, squircle(96, cy + 6, 56, 52, 0.66), skin, { dx: 9, dy: 7, shadow: 0.9 });
  cheeks(ctx, cy);
  eyes(ctx, L, cy);
  mouth(ctx, L, cy);
  if (L.wrinkle) for (const s of [-1, 1]) arc(ctx, 96 + s * 40, cy + 22, 6, s > 0 ? 0.2 : Math.PI - 1.2, s > 0 ? 1.2 : Math.PI - 0.2, 2.5, shade(skin, 0.7));
  if (L.beard) {
    shape(ctx, poly([[46, cy + 18], [60, cy + 46], [96, cy + 70], [132, cy + 46], [146, cy + 18], [120, cy + 36], [96, cy + 32], [72, cy + 36]], true), L.beard, { dx: 6, dy: 6 });
    shape(ctx, poly([[74, cy + 30], [96, cy + 24], [118, cy + 30], [106, cy + 40], [96, cy + 36], [86, cy + 40]], true), shade(L.beard, 0.95), { shadow: 0 });
    arc(ctx, 96, cy + 40, 5, Math.PI * 0.15, Math.PI * 0.85, 3);
  }
  // ---- front hair (fringe)
  if (L.hat !== 'straw' && L.hat !== 'ranger') {
    const fr = L.bangs === 'messy' ? [[38, 80], [44, 40], [70, 22], [100, 18], [130, 24], [152, 46], [156, 82], [138, 62], [128, 76], [116, 56], [100, 72], [86, 54], [72, 74], [60, 56], [50, 80]]
      : L.bangs === 'side' ? [[38, 84], [44, 40], [72, 20], [112, 18], [146, 34], [156, 84], [146, 60], [120, 50], [94, 54], [70, 62], [56, 80]]
      : L.bangs === 'boy' ? [[38, 82], [46, 42], [76, 24], [118, 24], [148, 44], [154, 82], [140, 64], [126, 70], [116, 54], [102, 66], [90, 52], [76, 66], [62, 54], [52, 74]]
      : [[40, 78], [50, 40], [80, 24], [116, 24], [144, 40], [152, 78], [130, 54], [96, 50], [62, 54]];
    shape(ctx, poly(fr, true), hr, { dx: 6, dy: 7, hi: '#ffffff' });
  }
  // ---- hats
  if (L.hat === 'beanie') {
    shape(ctx, poly([[34, 70], [40, 34], [70, 10], [122, 10], [152, 34], [158, 70], [96, 60]], true), L.hatC, { dx: 8, dy: 6, hi: '#ffffff' });
    shape(ctx, poly([[30, 74], [34, 56], [96, 48], [158, 56], [162, 74], [96, 68]], true), '#f2e6cc', { dx: 4, dy: 4 });
    for (let x = 44; x < 152; x += 12) line(ctx, [[x, 58], [x, 68]], 2, '#d8c8a4');
    shape(ctx, ell(96, 10, 16, 14), '#f6eedc', { dx: 4, dy: 4 });
  } else if (L.hat === 'cap') {
    shape(ctx, poly([[36, 66], [44, 30], [76, 12], [120, 12], [150, 30], [156, 66], [96, 56]], true), L.hatC, { dx: 8, dy: 6, hi: '#ffffff' });
    shape(ctx, poly([[32, 66], [96, 58], [150, 64], [140, 78], [96, 72], [40, 80]], true), shade(L.hatC, 0.85), { dx: 3, dy: 3 });
    shape(ctx, ell(96, 30, 9, 9), '#f2e6cc', { shadow: 0 });
  } else if (L.hat === 'straw') {
    shape(ctx, ell(96, 52, 92, 22), '#e2c272', { dx: 8, dy: 5 });
    shape(ctx, poly([[56, 52], [60, 18], [96, 8], [132, 18], [136, 52]], true), '#d8b45e', { dx: 7, dy: 5, hi: '#ffffff' });
    shape(ctx, poly([[57, 46], [135, 46], [136, 56], [56, 56]]), '#b0442e', { shadow: 0.85, line: 3 });
    for (let x = 14; x < 180; x += 16) line(ctx, [[x, 52], [x + 6, 56]], 2, '#b8964a');
  } else if (L.hat === 'ranger') {
    shape(ctx, ell(96, 50, 84, 18), shade(L.hatC, 0.9), { dx: 8, dy: 5 });
    shape(ctx, poly([[58, 50], [62, 16], [82, 8], [96, 16], [110, 8], [130, 16], [134, 50]], true), L.hatC, { dx: 7, dy: 5, hi: '#ffffff' });
    shape(ctx, poly([[59, 42], [133, 42], [134, 52], [58, 52]]), '#5a4426', { shadow: 0.85, line: 3 });
  } else if (L.hat === 'bun') {
    shape(ctx, ell(96, 22, 26, 22), hr, { dx: 5, dy: 5, hi: '#ffffff' });
    shape(ctx, poly([[74, 40], [118, 40], [116, 48], [76, 48]]), '#c9402e', { shadow: 0.85, line: 3 });
  }
  if (L.hat === 'straw' || L.hat === 'ranger') { // hair peeking out under the brim
    for (const s of [-1, 1]) shape(ctx, poly([[96 + s * 56, 60], [96 + s * 60, 88], [96 + s * 48, 80], [96 + s * 42, 62]], true), hr, { shadow: 0.85 });
  }
}

function cat(ctx) {
  const W = '#f8f0e4', O = '#e2944e', cy = 92;
  shape(ctx, poly([[40, 192], [50, 150], [96, 136], [142, 150], [152, 192]], true), W, { dx: 8, dy: 4 });
  for (const s of [-1, 1]) shape(ctx, poly([[96 + s * 30, 52], [96 + s * 62, 18], [96 + s * 64, 72]], true), s > 0 ? O : W, { dx: s * 3, dy: 4 });
  for (const s of [-1, 1]) shape(ctx, poly([[96 + s * 40, 52], [96 + s * 58, 32], [96 + s * 58, 64]], true), '#f2a8a8', { shadow: 0, line: 0 });
  shape(ctx, squircle(96, cy, 66, 54, 0.7), W, { dx: 9, dy: 7, shadow: 0.9 });
  ctx.save(); ctx.clip(squircle(96, cy, 66, 54, 0.7)); ctx.fillStyle = O; ctx.fill(ell(130, cy - 34, 48, 30)); ctx.fill(ell(52, cy - 42, 30, 18)); ctx.restore();
  ctx.lineWidth = LW; ctx.strokeStyle = INK; ctx.stroke(squircle(96, cy, 66, 54, 0.7));
  eyes(ctx, { iris: '#4f8a4a', hair: '#a07050' }, cy - 4);
  ctx.fillStyle = '#e88a8a'; ctx.fill(poly([[90, cy + 26], [102, cy + 26], [96, cy + 32]]));
  arc(ctx, 90, cy + 33, 6, 0.1, Math.PI - 0.6, 3); arc(ctx, 102, cy + 33, 6, 0.6, Math.PI - 0.1, 3);
  for (const s of [-1, 1]) for (const k of [0, 1]) line(ctx, [[96 + s * 30, cy + 26 + k * 7], [96 + s * 64, cy + 20 + k * 12]], 2.5, '#9a8a7a');
  cheeks(ctx, cy - 6);
}
function dog(ctx) {
  const O = '#dc8a42', W = '#fbf2e2', cy = 92;
  shape(ctx, poly([[40, 192], [50, 150], [96, 136], [142, 150], [152, 192]], true), O, { dx: 8, dy: 4 });
  shape(ctx, poly([[70, 192], [74, 150], [96, 144], [118, 150], [122, 192]], true), W, { shadow: 0, line: 3 });
  shape(ctx, poly([[46, 150], [96, 160], [146, 150], [146, 162], [96, 172], [46, 162]], true), '#d0463a', { dx: 3, dy: 3 });
  shape(ctx, ell(96, 168, 9, 9), '#f2c844', { dx: 2, dy: 2 });
  for (const s of [-1, 1]) shape(ctx, poly([[96 + s * 26, 50], [96 + s * 58, 14], [96 + s * 64, 66]], true), O, { dx: s * 4, dy: 4 });
  for (const s of [-1, 1]) shape(ctx, poly([[96 + s * 36, 50], [96 + s * 54, 30], [96 + s * 56, 60]], true), '#f6d8b4', { shadow: 0, line: 0 });
  shape(ctx, squircle(96, cy, 66, 56, 0.7), O, { dx: 9, dy: 7, shadow: 0.88 });
  ctx.save(); ctx.clip(squircle(96, cy, 66, 56, 0.7)); ctx.fillStyle = W;
  ctx.fill(poly([[40, cy + 10], [70, cy - 4], [96, cy + 6], [122, cy - 4], [152, cy + 10], [150, cy + 60], [42, cy + 60]], true));
  ctx.fill(ell(70, cy - 30, 9, 5)); ctx.fill(ell(122, cy - 30, 9, 5)); ctx.restore();
  ctx.lineWidth = LW; ctx.strokeStyle = INK; ctx.stroke(squircle(96, cy, 66, 56, 0.7));
  eyes(ctx, { iris: '#3a2418', hair: '#a06030', brow: 'rgba(0,0,0,0)' }, cy - 6);
  shape(ctx, ell(96, cy + 24, 11, 8), INK, { shadow: 0, line: 0 }); ctx.fillStyle = '#6a6a72'; ctx.fill(ell(92, cy + 21, 3.5, 2.4));
  const t = new Path2D(); t.moveTo(86, cy + 34); t.quadraticCurveTo(96, cy + 52, 106, cy + 34); t.closePath(); ctx.fillStyle = '#e8707a'; ctx.fill(t); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(t);
  cheeks(ctx, cy - 4);
}

const BG = { player: ['#e8f0d0', '#b9cf96'], amei: ['#f2e2f0', '#cfb2d6'], wang: ['#e2eef4', '#a9c4d8'], chen: ['#f6e4cc', '#d9b48a'], song: ['#f2ecd8', '#cfc29c'], yu: ['#fbf0cc', '#e6c87e'], grandpa: ['#efe8d2', '#c9bc92'], cat: ['#fbe9d8', '#e6c0a0'], pet: ['#fdebd0', '#ebc48c'] };
// Gemini-generated portrait art (assets/portraits/<id>.png); the code-drawn version is the fallback
const ART = {};
for (const id of ['player', 'amei', 'wang', 'chen', 'song', 'yu', 'grandpa', 'cat', 'pet']) {
  const img = new Image(); img.src = `./assets/portraits/${id}.png`; ART[id] = img;
}
export function portraitArt(id) { const img = ART[id]; return img && img.complete && img.naturalWidth ? img : null; }
const cache = {};
export function portraitURL(id) {
  if (cache[id]) return cache[id];
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const bg = BG[id] || BG.player; backdrop(ctx, bg[0], bg[1]);
  if (id === 'cat') cat(ctx); else if (id === 'pet') dog(ctx); else human(ctx, LOOK[id] || LOOK.player);
  return (cache[id] = cv);
}
export const hasPortrait = (id) => id === 'cat' || id === 'pet' || !!LOOK[id];
