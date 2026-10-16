// portraits.js — procedural pixel-art dialogue portraits (48×48), JRPG style
const W = 48, H = 48, OUT = '#2a1a10';

function grid() { return [...Array(H)].map(() => Array(W).fill(null)); }
const inEll = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
function ell(g, cx, cy, rx, ry, col, clip) { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inEll(x + 0.5, y + 0.5, cx, cy, rx, ry) && (!clip || clip(x, y))) g[y][x] = typeof col === 'function' ? col(x, y) : col; }
function rect(g, x0, y0, x1, y1, col) { for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) g[y][x] = typeof col === 'function' ? col(x, y) : col; }
function px(g, x, y, c) { if (x >= 0 && y >= 0 && x < W && y < H) g[y][x] = c; }
function outline(g, layerMask) {
  const out = g.map(r => r.slice());
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (g[y][x]) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => g[y + b]?.[x + a] && g[y + b][x + a] !== OUT)) out[y][x] = OUT;
  }
  void layerMask;
  return out;
}
const shade = (hex, f) => { const v = parseInt(hex.slice(1), 16); const c = [v >> 16, (v >> 8) & 255, v & 255].map(k => Math.max(0, Math.min(255, Math.round(k * f)))); return '#' + c.map(k => k.toString(16).padStart(2, '0')).join(''); };

const LOOK = {
  player: { skin: '#f6cfa4', hair: '#5a321e', eye: '#4a3a2a', top: '#3f7a5a', hat: 'beanie', hatC: '#d8582e', scarf: '#e8b84a', bangs: 'spiky' },
  amei: { skin: '#f0c8a0', hair: '#dedad2', eye: '#5a4030', top: '#8a5a9a', hat: 'bun', shawl: '#d88a4a', old: true, glasses: true, bangs: 'swept' },
  wang: { skin: '#dca878', hair: '#7a7068', eye: '#3a2a20', top: '#4a6a8a', hat: 'straw', beard: '#9a9288', old: true, bangs: 'short' },
  chen: { skin: '#dc9c6c', hair: '#2a1a12', eye: '#2a1a12', top: '#b23a2a', plaid: '#7a2418', hat: 'cap', hatC: '#3a5a3a', beard: '#2a1a12', brows: 'thick', bangs: 'short' },
  song: { skin: '#f4caa0', hair: '#2a2a32', eye: '#2a2a40', top: '#e8dcc0', apron: '#7a5a3a', glasses: true, bangs: 'messy' },
  yu: { skin: '#f8d6b0', hair: '#a8402a', eye: '#3a5a8a', top: '#e8b83a', hat: 'cap', hatC: '#2f5a7a', pony: true, bangs: 'side', girl: true },
  grandpa: { skin: '#eebc94', hair: '#ecebe4', eye: '#4a3a2a', top: '#5a6a3a', hat: 'ranger', hatC: '#7a6a44', beard: '#ecebe4', old: true, bangs: 'short' },
};

function human(L) {
  const g = grid(), sk = L.skin, skD = shade(sk, 0.86), hr = L.hair, hrD = shade(hr, 0.72), hrL = shade(hr, 1.25);
  // shoulders / outfit
  ell(g, 24, 50, 19, 11, (x, y) => (x > 30 ? shade(L.top, 0.82) : L.top));
  if (L.plaid) for (let y = 40; y < H; y += 3) rect(g, 6, y, 42, y, L.plaid);
  if (L.apron) rect(g, 15, 42, 33, 47, L.apron);
  if (L.shawl) ell(g, 24, 42, 15, 4, L.shawl);
  if (L.scarf) { ell(g, 24, 40, 9, 3, L.scarf); rect(g, 27, 40, 30, 46, shade(L.scarf, 0.85)); }
  // neck
  rect(g, 20, 33, 28, 39, skD);
  // head
  ell(g, 24, 22, 12.5, 13.5, (x) => (x > 30 ? skD : sk));
  // ears
  ell(g, 11.5, 24, 2, 3, skD); ell(g, 36.5, 24, 2, 3, skD);
  // hair back/top
  const top = (x, y) => (y < 19);
  ell(g, 24, 18, 13.5, 11, (x, y) => (x < 20 && y < 14 ? hrL : x > 31 ? hrD : hr), top);
  // bangs
  const bang = { spiky: [[13, 19], [16, 21], [19, 18], [22, 21], [25, 18], [28, 21], [31, 18], [34, 20]], swept: [[13, 17], [18, 18], [24, 17], [30, 16], [35, 18]], short: [[13, 16], [35, 16]], messy: [[13, 20], [16, 18], [19, 21], [23, 19], [27, 21], [30, 18], [34, 21]], side: [[13, 21], [16, 20], [20, 19], [25, 17], [31, 16], [35, 17]] }[L.bangs || 'short'];
  for (let i = 0; i < bang.length - 1; i++) {
    const [x0, y0] = bang[i], [x1, y1] = bang[i + 1];
    for (let x = x0; x <= x1; x++) { const t = (x - x0) / Math.max(1, x1 - x0), yy = Math.round(y0 + (y1 - y0) * t); for (let y = 12; y <= yy; y++) px(g, x, y, y > yy - 1 ? hrD : hr); }
  }
  // side locks
  rect(g, 11, 17, 13, L.girl ? 30 : 25, hr); rect(g, 35, 17, 37, L.girl ? 30 : 25, hrD);
  if (L.pony) { ell(g, 39, 22, 3.5, 8, hrD); }
  // eyes (big JRPG eyes with highlight)
  const eye = (cx) => {
    rect(g, cx - 2, 22, cx + 2, 27, '#ffffff');
    rect(g, cx - 2, 21, cx + 2, 21, OUT);                  // upper lid
    rect(g, cx - 1, 23, cx + 2, 27, L.eye);                // iris
    rect(g, cx, 24, cx + 1, 26, shade(L.eye, 0.5));        // pupil
    px(g, cx - 1, 23, '#ffffff'); px(g, cx - 1, 24, '#ffffff'); // highlight
    px(g, cx + 2, 27, shade(L.eye, 1.4));
    rect(g, cx - 2, 28, cx + 2, 28, skD);
  };
  if (L.old) { // gentle closed-smile eyes
    for (const cx of [18, 30]) { px(g, cx - 2, 24, OUT); px(g, cx - 1, 23, OUT); px(g, cx, 23, OUT); px(g, cx + 1, 23, OUT); px(g, cx + 2, 24, OUT); }
  } else { eye(18); eye(30); }
  // brows
  const bc = L.brows === 'thick' ? OUT : hrD;
  rect(g, 16, 19, 20, 19, bc); rect(g, 28, 19, 32, 19, bc);
  if (L.brows === 'thick') { rect(g, 16, 18, 20, 18, bc); rect(g, 28, 18, 32, 18, bc); }
  if (L.glasses) { for (const cx of [18, 30]) { rect(g, cx - 3, 21, cx + 3, 21, '#5a4030'); rect(g, cx - 3, 28, cx + 3, 28, '#5a4030'); rect(g, cx - 3, 21, cx - 3, 28, '#5a4030'); rect(g, cx + 3, 21, cx + 3, 28, '#5a4030'); } rect(g, 22, 23, 26, 23, '#5a4030'); }
  // blush + nose + mouth
  rect(g, 14, 29, 16, 29, '#f09a8a'); rect(g, 32, 29, 34, 29, '#f09a8a');
  px(g, 24, 28, skD); px(g, 25, 29, skD);
  rect(g, 22, 31, 26, 31, '#8a3a2a'); px(g, 21, 30, '#8a3a2a'); px(g, 27, 30, '#8a3a2a');
  if (L.beard) { ell(g, 24, 34, 9, 5, (x) => (x > 28 ? shade(L.beard, 0.85) : L.beard), (x, y) => y > 30); rect(g, 21, 30, 27, 30, L.beard); rect(g, 22, 32, 26, 32, '#8a3a2a'); }
  // hats
  if (L.hat === 'beanie') {
    ell(g, 24, 13, 14, 8.5, (x) => (x > 31 ? shade(L.hatC, 0.8) : L.hatC), (x, y) => y < 16);
    rect(g, 10, 14, 38, 17, '#f0e0c0'); for (let x = 11; x < 38; x += 3) px(g, x, 15, '#d8c8a0');
    ell(g, 24, 4, 3.5, 3.5, '#f6ead0');
  } else if (L.hat === 'straw') {
    ell(g, 24, 13, 22, 4, '#e0c070'); ell(g, 24, 9, 9, 6, '#d8b460', (x, y) => y < 13); rect(g, 15, 11, 33, 12, '#a8402a');
    for (let x = 4; x < 44; x += 4) px(g, x, 13, '#c8a050');
  } else if (L.hat === 'cap') {
    ell(g, 24, 13, 13.5, 8, (x) => (x > 31 ? shade(L.hatC, 0.8) : L.hatC), (x, y) => y < 16);
    ell(g, 21, 16, 10, 2.2, shade(L.hatC, 0.7)); px(g, 24, 6, '#f0e0c0');
  } else if (L.hat === 'ranger') {
    ell(g, 24, 13, 20, 3.5, shade(L.hatC, 0.85)); ell(g, 24, 9, 9, 6, L.hatC, (x, y) => y < 13); rect(g, 15, 11, 33, 11, '#4a3a20');
  } else if (L.hat === 'bun') {
    ell(g, 24, 6, 5, 4.5, hr); px(g, 22, 4, hrL); rect(g, 19, 9, 29, 9, '#d8402a');
  }
  return g;
}

function cat() {
  const g = grid(), W1 = '#f6eee2', O = '#e0904a', Od = '#b86a30';
  ell(g, 24, 50, 15, 10, W1);
  for (const s of [-1, 1]) { const x0 = 24 + s * 9; for (let y = 6; y < 16; y++) { const w = Math.round((y - 6) * 0.6); rect(g, x0 - w, y, x0 + w, y, O); } px(g, x0, 12, '#f0a0a0'); px(g, x0, 13, '#f0a0a0'); }
  ell(g, 24, 25, 15, 13, W1);
  ell(g, 24, 16, 13, 6, O, (x, y) => y < 19); ell(g, 33, 24, 5, 6, Od);
  for (const cx of [18, 30]) { rect(g, cx - 2, 22, cx + 2, 27, '#3a6a40'); rect(g, cx, 23, cx, 27, OUT); px(g, cx - 1, 23, '#ffffff'); rect(g, cx - 2, 21, cx + 2, 21, OUT); }
  rect(g, 23, 29, 25, 29, '#e88a8a'); px(g, 24, 30, OUT); px(g, 23, 31, OUT); px(g, 25, 31, OUT);
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { px(g, 24 + s * (8 + i), 30 + (i > 3 ? 1 : 0), '#b8a898'); px(g, 24 + s * (8 + i), 32 + (i > 2 ? 1 : 0), '#b8a898'); }
  return g;
}
function dog() {
  const g = grid(), O = '#d8843a', Od = '#a85e24', Wc = '#fbf1e0';
  ell(g, 24, 51, 15, 10, O);
  ell(g, 24, 48, 7, 5, Wc);
  for (const s of [-1, 1]) { const x0 = 24 + s * 9; for (let y = 5; y < 15; y++) { const w = Math.round((y - 5) * 0.55); rect(g, x0 - w, y, x0 + w, y, s > 0 ? Od : O); } rect(g, x0 - 1, 9, x0 + 1, 12, '#f6d6b0'); }
  ell(g, 24, 24, 15, 13, (x) => (x > 32 ? Od : O));
  ell(g, 24, 31, 9, 6, Wc); ell(g, 17, 27, 4, 4, Wc); ell(g, 31, 27, 4, 4, Wc);
  ell(g, 18, 18, 2, 1.2, Wc); ell(g, 30, 18, 2, 1.2, Wc);
  for (const cx of [18, 30]) { rect(g, cx - 2, 21, cx + 2, 25, OUT); px(g, cx - 1, 22, '#ffffff'); px(g, cx, 22, '#ffffff'); px(g, cx + 1, 24, '#5a3a2a'); }
  rect(g, 22, 28, 26, 29, OUT); px(g, 23, 28, '#6a6a70');
  rect(g, 21, 32, 27, 33, '#c84a4a'); px(g, 20, 31, OUT); px(g, 28, 31, OUT); rect(g, 23, 34, 25, 35, '#e87a8a');
  rect(g, 13, 38, 35, 39, '#d8402a'); px(g, 24, 40, '#ffd040');
  return g;
}

const cache = {};
export function portraitURL(id) {
  if (cache[id]) return cache[id];
  const g = outline(id === 'cat' ? cat() : id === 'pet' ? dog() : human(LOOK[id] || LOOK.player));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  g.forEach((row, y) => row.forEach((c, x) => { if (c) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); } }));
  return (cache[id] = cv);
}
export const hasPortrait = (id) => id === 'cat' || id === 'pet' || !!LOOK[id];
