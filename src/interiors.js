// interiors.js — walk-in rooms for every house, furnished to fit the story.
// Rooms live far away at x ≥ 500 on a flat floor (y = 0); the camera cuts the front wall away.
import * as THREE from 'three';
import { M } from './props.js';
import * as P from './props.js';

export const ROOM_X0 = 500;
let GRAD;
const T = (c, o = {}) => new THREE.MeshToonMaterial({ color: c, gradientMap: GRAD, ...o });
const mats = {};
const mat = (c) => (mats[c] ??= T(c));
function box(w, h, d, m, x, y, z, parent) {
  const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof m === 'number' ? mat(m) : m);
  me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; parent?.add(me); return me;
}
function canvasMat(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false;
  return T(0xffffff, { map: t });
}
function plankFloor(w, d, a = '#a8743a', b = '#8a5a2e', c = '#c08a4a') {
  return canvasMat(w * 16, d * 16, (x, W, H) => {
    for (let y = 0; y < H; y++) { const row = Math.floor(y / 5); x.fillStyle = row % 3 === 0 ? c : row % 3 === 1 ? a : shadeHex(a, 0.93); x.fillRect(0, y, W, 1); if (y % 5 === 4) { x.fillStyle = b; x.fillRect(0, y, W, 1); } }
    for (let i = 0; i < W * H / 60; i++) { x.fillStyle = b; const yy = Math.floor(Math.random() * H / 5) * 5; x.fillRect(Math.floor(Math.random() * W), yy, 1, 4); }
  });
}
function wallpaper(w, h, base, stripe) {
  return canvasMat(w * 16, h * 16, (x, W, H) => {
    x.fillStyle = base; x.fillRect(0, 0, W, H);
    x.fillStyle = stripe; for (let i = 0; i < W; i += 6) x.fillRect(i, 0, 2, H);
    x.fillStyle = shadeHex(base, 0.7); x.fillRect(0, H - 8, W, 8);       // wainscot
    x.fillStyle = shadeHex(base, 0.55); x.fillRect(0, H - 9, W, 1);
  });
}
function shadeHex(hex, f) { const v = parseInt(hex.slice(1), 16); return '#' + [v >> 16, (v >> 8) & 255, v & 255].map(k => Math.min(255, Math.round(k * f)).toString(16).padStart(2, '0')).join(''); }
function rug(w, d, c1, c2) {
  const m = canvasMat(w * 16, d * 16, (x, W, H) => {
    x.fillStyle = c1; x.fillRect(0, 0, W, H); x.fillStyle = c2; x.fillRect(3, 3, W - 6, H - 6); x.fillStyle = c1; x.fillRect(6, 6, W - 12, H - 12);
    x.fillStyle = c2; for (let i = 10; i < W - 10; i += 8) x.fillRect(i, H / 2 - 1, 4, 2);
  });
  const me = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m); me.rotation.x = -Math.PI / 2; me.position.y = 0.02; me.receiveShadow = true; return me;
}
function picture(w, h, draw) {
  const g = new THREE.Group();
  box(w + 0.1, h + 0.1, 0.06, 0x5a3a24, 0, 0, 0, g);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), canvasMat(Math.round(w * 16), Math.round(h * 16), draw)); p.position.z = 0.035; g.add(p);
  return g;
}

// ---- furniture
const F = {
  bed(c = 0xc84a3a) { const g = new THREE.Group(); box(1.3, 0.35, 2.1, 0x7a5232, 0, 0.18, 0, g); box(1.2, 0.18, 1.9, 0xf0e8d8, 0, 0.44, 0.05, g); box(1.22, 0.2, 1.3, c, 0, 0.5, 0.35, g); box(0.9, 0.16, 0.4, 0xffffff, 0, 0.58, -0.7, g); box(1.3, 0.8, 0.12, 0x6a4426, 0, 0.5, -1.02, g); return g; },
  table(w = 1.4, d = 0.9) { const g = new THREE.Group(); box(w, 0.1, d, 0x9a6a3a, 0, 0.75, 0, g); for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.08, 0.72, 0.08, 0x6a4426, sx * (w / 2 - 0.08), 0.36, sz * (d / 2 - 0.08), g); return g; },
  chair() { const g = new THREE.Group(); box(0.45, 0.06, 0.45, 0x9a6a3a, 0, 0.45, 0, g); box(0.45, 0.5, 0.06, 0x8a5a32, 0, 0.72, -0.2, g); for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.05, 0.45, 0.05, 0x6a4426, sx * 0.18, 0.22, sz * 0.18, g); return g; },
  shelf(items = 'jars', w = 1.6) {
    const g = new THREE.Group(); box(w, 1.9, 0.4, 0x7a5232, 0, 0.95, 0, g);
    const cols = items === 'books' ? [0x8a3a2a, 0x3a5a7a, 0x5a7a3a, 0xc9963a, 0x6a4a7a] : [0xd8a040, 0xb85a3a, 0x8ab06a, 0xe8d8a8, 0x7aa0c8];
    for (const y of [0.35, 0.85, 1.35]) {
      box(w - 0.08, 0.05, 0.36, 0x5a3a24, 0, y - 0.03, 0.03, g);
      for (let i = 0; i < Math.floor(w / 0.2); i++) {
        const c = cols[(i * 7 + Math.round(y * 10)) % cols.length];
        if (items === 'books') box(0.12, 0.3 + (i % 3) * 0.04, 0.26, c, -w / 2 + 0.15 + i * 0.18, y + 0.16, 0.05, g);
        else if (i % 2 === 0) { const j = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.22, 6), mat(c)); j.position.set(-w / 2 + 0.2 + i * 0.2, y + 0.11, 0.06); g.add(j); }
      }
    }
    return g;
  },
  stove() { const g = new THREE.Group(); box(0.9, 0.8, 0.7, 0x3a3a40, 0, 0.4, 0, g); box(0.92, 0.06, 0.72, 0x55555c, 0, 0.82, 0, g); box(0.16, 1.6, 0.16, 0x3a3a40, 0.3, 1.6, -0.2, g); const k = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.2, 8), mat(0xc84a3a)); k.position.set(-0.15, 0.95, 0.05); g.add(k); const fire = box(0.4, 0.2, 0.02, M.fire, 0, 0.35, 0.36, g); void fire; return g; },
  fireplace() { const g = new THREE.Group(); box(1.6, 1.4, 0.5, M.stone, 0, 0.7, 0, g); box(0.9, 0.7, 0.3, 0x1a1210, 0, 0.45, 0.12, g); const f = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 5), M.fire); f.position.set(0, 0.32, 0.18); g.add(f); g.userData.flame = f; box(1.8, 0.12, 0.6, 0x6a4426, 0, 1.45, 0.02, g); return g; },
  desk() { const g = F.table(1.3, 0.7); box(0.4, 0.3, 0.6, 0x8a5a32, 0.4, 0.55, 0, g); box(0.38, 0.05, 0.02, 0xd8b060, 0.4, 0.6, 0.31, g); box(0.5, 0.02, 0.35, 0xf6eed8, -0.25, 0.81, 0, g); box(0.3, 0.12, 0.2, 0x8a3a2a, 0.3, 0.86, -0.1, g); return g; },
  armchair(c = 0x6a8a5a) { const g = new THREE.Group(); box(0.8, 0.4, 0.75, c, 0, 0.3, 0, g); box(0.8, 0.6, 0.18, c, 0, 0.75, -0.3, g); for (const s of [-1, 1]) box(0.16, 0.3, 0.75, shadeNum(c, 0.85), s * 0.38, 0.55, 0, g); return g; },
  counter(w = 2.6) { const g = new THREE.Group(); box(w, 0.95, 0.6, 0x8a5a32, 0, 0.48, 0, g); box(w + 0.1, 0.08, 0.7, 0xb07a44, 0, 0.98, 0, g); box(0.35, 0.25, 0.3, 0xc9963a, w / 2 - 0.4, 1.15, 0, g); return g; },
  barrel() { return P.barrel(); },
  crate() { return P.crate(); },
  sacks() { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 5), mat(0xe8dcc0)); s.scale.set(1, 0.85, 0.8); s.position.set(i * 0.45 - 0.45, 0.25 + (i === 1 ? 0.35 : 0), i === 1 ? 0.05 : 0); g.add(s); } return g; },
  plant() { const g = new THREE.Group(); const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.3, 7), mat(0xb85a3a)); pot.position.y = 0.15; g.add(pot); for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), mat(0x5a8a3a)); l.position.set(Math.cos(i * 1.6) * 0.1, 0.4 + i * 0.07, Math.sin(i * 1.6) * 0.1); g.add(l); } return g; },
  lamp() { const g = new THREE.Group(); box(0.05, 1.3, 0.05, 0x3a3a40, 0, 0.65, 0, g); const s = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.3, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd890 })); s.position.y = 1.4; g.add(s); return g; },
  workbench() { const g = F.table(1.8, 0.8); box(0.6, 0.08, 0.1, 0x9a9a90, -0.3, 0.84, 0.1, g); box(0.15, 0.15, 0.15, 0x6a6a70, 0.5, 0.88, 0, g); return g; },
  pegboard(withGloves) {
    const g = new THREE.Group(); box(1.8, 1.1, 0.05, 0xb08a5a, 0, 1.5, 0, g);
    box(0.06, 0.6, 0.04, 0x6a6a70, -0.6, 1.5, 0.05, g); box(0.3, 0.12, 0.04, 0x6a6a70, -0.6, 1.8, 0.05, g); // hammer
    box(0.5, 0.12, 0.04, 0x9a9a90, 0.1, 1.7, 0.05, g); // saw
    const gl = new THREE.Group(); box(0.18, 0.26, 0.05, 0xd8a060, 0, 0, 0, gl); box(0.18, 0.26, 0.05, 0xd8a060, 0.22, 0, 0, gl); gl.position.set(0.55, 1.35, 0.06); gl.visible = withGloves; g.add(gl); g.userData.gloves = gl;
    return g;
  },
  gearWall() { const g = new THREE.Group(); const gears = []; for (const [x, y, r] of [[-0.8, 1.4, 0.6], [0.35, 1.0, 0.45], [0.9, 1.75, 0.35]]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.14, 10), mat(0x8a6a3a)); m.rotation.x = Math.PI / 2; m.position.set(x, y, 0.1); g.add(m); gears.push(m); box(0.12, r * 2.1, 0.16, 0x5a3a24, x, y, 0.12, g); } g.userData.gears = gears; return g; },
  millstone() { const g = new THREE.Group(); const a = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.3, 12), M.stone); a.position.y = 0.15; g.add(a); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.25, 12), M.stone); b.position.y = 0.45; g.add(b); g.userData.top = b; box(0.08, 0.6, 0.08, 0x6a4426, 0.5, 0.75, 0, g); return g; },
  chalkboard(draw) { const g = new THREE.Group(); box(1.6, 1.0, 0.06, 0x5a3a24, 0, 1.5, 0, g); const p = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.85), canvasMat(46, 27, draw)); p.position.set(0, 1.5, 0.04); g.add(p); return g; },
  bunk() { const g = F.bed(0x3a5a3a); const top = F.bed(0x8a3a2a); top.position.y = 1.0; g.add(top); for (const sx of [-1, 1]) box(0.08, 1.8, 0.08, 0x6a4426, sx * 0.62, 0.9, 0.98, g); return g; },
  axeRack() { const g = new THREE.Group(); box(1.2, 0.08, 0.1, 0x6a4426, 0, 1.6, 0, g); for (let i = 0; i < 3; i++) { box(0.05, 0.9, 0.05, 0x8a5a32, -0.4 + i * 0.4, 1.2, 0.06, g); box(0.22, 0.16, 0.04, 0x9a9aa0, -0.4 + i * 0.4 + 0.08, 1.6, 0.08, g); } return g; },
  telescope() { const g = new THREE.Group(); for (const [x, z] of [[-0.2, 0.1], [0.2, 0.1], [0, -0.2]]) { const l = box(0.04, 1.0, 0.04, 0x6a4426, x, 0.48, z, g); l.rotation.z = -x * 0.6; l.rotation.x = z * 0.6; } const t = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.9, 8), mat(0xb9893a)); t.rotation.x = Math.PI / 2 - 0.4; t.position.set(0, 1.05, -0.1); g.add(t); return g; },
  dogBed() { const g = new THREE.Group(); const r = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.14, 5, 10), mat(0xa85a3a)); r.rotation.x = Math.PI / 2; r.position.y = 0.12; g.add(r); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 10), mat(0xe8d8b0)); c.position.y = 0.06; g.add(c); return g; },
  hatHook(c = 0x7a6a44) { const g = new THREE.Group(); box(0.06, 0.06, 0.2, 0x5a3a24, 0, 1.7, 0.08, g); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.03, 10), mat(c)); b.rotation.x = Math.PI / 2 - 0.3; b.position.set(0, 1.6, 0.18); g.add(b); const t = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.18, 8), mat(c)); t.rotation.x = Math.PI / 2 - 0.3; t.position.set(0, 1.64, 0.25); g.add(t); return g; },
  clock() { const g = new THREE.Group(); box(0.4, 1.7, 0.3, 0x6a4426, 0, 0.85, 0, g); const f = new THREE.Mesh(new THREE.CircleGeometry(0.14, 10), mat(0xf6eed8)); f.position.set(0, 1.45, 0.16); g.add(f); const pend = box(0.04, 0.4, 0.02, 0xc9963a, 0, 0.9, 0.16, g); g.userData.pend = pend; return g; },
  window(lit = true) { const g = new THREE.Group(); box(1.0, 0.9, 0.08, 0xf0e6cc, 0, 0, 0, g); const p = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.75), new THREE.MeshBasicMaterial({ color: lit ? 0xbfe0f0 : 0x6a7a8a })); p.position.z = 0.05; g.add(p); box(0.05, 0.75, 0.1, 0xf0e6cc, 0, 0, 0.05, g); box(0.85, 0.05, 0.1, 0xf0e6cc, 0, 0, 0.05, g); return g; },
};
function shadeNum(c, f) { const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255; return (Math.round(r * f) << 16) | (Math.round(g * f) << 8) | Math.round(b * f); }

// ---- the rooms. Local coords: x ∈ [-w/2, w/2], z ∈ [-d/2, d/2], door at the front (+z) centre.
// items: [kind, x, z, rotY, args, collider [w, d] | null]; spots: named interaction points.
export const ROOMS = {
  cabin: { name: '爺爺的家', w: 9, d: 7, floor: ['#a8743a', '#7a4a24', '#c08a4a'], wall: ['#d8c8a0', '#cdb98c'],
    items: [['bed', -3.3, -1.9, 0, [0xc84a3a], [1.4, 2.2]], ['desk', 2.6, -2.9, 0, [], [1.4, 0.8]], ['chair', 2.4, -2.1, Math.PI, [], null],
      ['fireplace', 0, -3.2, 0, [], [1.7, 0.6]], ['armchair', -0.9, -1.6, 0.5, [0x6a8a5a], [0.9, 0.9]], ['shelf', 4.0, -0.6, -Math.PI / 2, ['books'], [0.5, 1.7]],
      ['stove', -3.8, 1.6, Math.PI / 2, [], [0.8, 1.0]], ['table', -1.8, 1.4, 0, [1.2, 0.8], [1.3, 0.9]], ['chair', -1.8, 2.1, Math.PI, [], null],
      ['dogBed', 3.4, 1.9, 0, [], null], ['hatHook', -4.4, -0.2, Math.PI / 2, [0x7a6a44], null], ['plant', 4.0, 2.7, 0, [], [0.4, 0.4]], ['clock', -4.2, -3.1, 0, [], [0.5, 0.4]]],
    rugs: [[0, -0.8, 3.2, 2.2, '#8a3a2a', '#d8a040']],
    pics: [[-1.6, 'photo1'], [1.2, 'photo2']],
    spots: { desk: [2.6, -2.1], bed: [-3.3, -0.5], photos: [-0.2, -2.6], doorframe: [1.3, 2.9], stove: [-3.0, 1.6], dogbed: [3.4, 1.0], shelf: [3.4, -0.6], fire: [0, -2.4], hat: [-3.8, -0.2] } },
  amei: { name: '阿梅雜貨店', w: 8, d: 6, floor: ['#b48452', '#7a5532', '#cfa06a'], wall: ['#e8d0b8', '#dcc0a4'],
    items: [['counter', 0.6, -0.6, 0, [2.8], [2.9, 0.7]], ['shelf', -2.6, -2.5, 0, ['jars'], [1.7, 0.5]], ['shelf', 0.4, -2.5, 0, ['jars'], [1.7, 0.5]], ['shelf', 3.1, -2.5, 0, ['books'], [1.7, 0.5]],
      ['barrel', -3.3, 1.6, 0, [], [0.6, 0.6]], ['barrel', -2.7, 2.0, 0, [], [0.6, 0.6]], ['crate', 3.2, 1.9, 0.2, [], [0.7, 0.7]], ['plant', -3.4, -0.6, 0, [], [0.4, 0.4]],
      ['dogBed', 3.0, 0.4, 0, [], null], ['lamp', 2.3, -0.6, 0, [], null]],
    rugs: [[0.4, 1.2, 2.8, 1.6, '#5a7a9a', '#e8d8b0']],
    pics: [[-1.0, 'amei'], [2.4, 'sign']],
    spots: { jar: [1.6, 0.1], photos: [-1.0, -1.6], letters: [-0.4, 0.1], shelf: [-2.6, -1.8], catbed: [3.0, 1.2] } },
  shed: { name: '爺爺的工具棚', w: 5, d: 4, floor: ['#8a6a4a', '#5a3a24', '#9a7a5a'], wall: ['#9a7a52', '#8a6a44'],
    items: [['workbench', -0.6, -1.4, 0, [], [1.9, 0.9]], ['pegboard', 0.6, -1.95, 0, [true], null], ['crate', 1.8, 1.0, 0.3, [], [0.7, 0.7]], ['barrel', -1.9, 1.0, 0, [], [0.6, 0.6]], ['sacks', 1.4, -1.3, 0, [], [1.3, 0.6]]],
    rugs: [], pics: [],
    spots: { gloves: [0.9, -1.0], bench: [-0.6, -0.7], note: [1.8, 0.3] } },
  mill: { name: '山腰磨坊', w: 7, d: 6, floor: ['#9a8a6a', '#6a5a44', '#b0a07a'], wall: ['#c8b890', '#b8a880'],
    items: [['gearWall', 1.2, -2.85, 0, [], null], ['millstone', 1.2, -1.2, 0, [], [1.6, 1.6]], ['sacks', -2.4, -2.3, 0, [], [1.4, 0.6]], ['desk', -2.2, 0.6, Math.PI / 2, [], [0.8, 1.4]],
      ['chalkboard', -1.6, -2.9, 0, ['mill'], null], ['shelf', 3.1, 0.6, -Math.PI / 2, ['books'], [0.5, 1.7]], ['lamp', -2.9, 2.0, 0, [], null]],
    rugs: [], pics: [],
    spots: { thesis: [-1.4, 0.6], board: [-1.6, -2.2], gears: [1.2, 0.0], sacks: [-2.4, -1.6] } },
  hutE: { name: '老陳的小屋', w: 5, d: 4, floor: ['#9a6a3a', '#6a4426', '#b07a44'], wall: ['#b08a5a', '#a07a4a'],
    items: [['bunk', -1.6, -0.6, 0, [], [1.4, 2.2]], ['axeRack', 1.0, -1.95, 0, [], null], ['stove', 1.7, 0.9, -Math.PI / 2, [], [0.8, 1.0]], ['chalkboard', 0.3, -1.95, 0, ['duck'], null]],
    rugs: [[0.6, 0.6, 1.6, 1.2, '#7a2418', '#d8a040']],
    spots: { duck: [0.3, -1.2], axes: [1.0, -1.2], stew: [1.0, 0.9], bunk: [-0.7, 0.4] }, pics: [] },
  hut2: { name: '山腰小屋', w: 5, d: 4, floor: ['#b48452', '#7a5532', '#cfa06a'], wall: ['#d8c8a0', '#cdb98c'],
    items: [['table', 0.2, -0.6, 0, [1.2, 0.8], [1.3, 0.9]], ['chair', -0.6, -0.6, Math.PI / 2, [], null], ['shelf', -1.8, -1.6, 0, ['books'], [1.0, 0.5]], ['plant', 1.9, -1.5, 0, [], [0.4, 0.4]]],
    rugs: [], pics: [[1.0, 'map']],
    spots: { card: [0.2, 0.2], map: [1.0, -1.2], guest: [-1.8, -1.0] }, cardAt: [0.2, -0.6] },
  hut3: { name: '雲海平台小屋', w: 5, d: 4, floor: ['#b48452', '#7a5532', '#cfa06a'], wall: ['#c8d8e0', '#b8c8d4'],
    items: [['table', -0.6, -0.8, 0, [1.2, 0.8], [1.3, 0.9]], ['telescope', 1.5, -1.3, 0.4, [], [0.6, 0.6]], ['chair', -0.6, 0.0, Math.PI, [], null], ['shelf', -1.9, 0.6, Math.PI / 2, ['books'], [0.5, 1.0]]],
    rugs: [], pics: [[-0.6, 'peak']],
    spots: { card: [-0.6, 0.0], scope: [1.5, -0.5], log: [-1.5, 0.6] }, cardAt: [-0.6, -0.8] },
};

const PICS = {
  photo1(x, W, H) { x.fillStyle = '#e8dcc0'; x.fillRect(0, 0, W, H); x.fillStyle = '#8ab0d0'; x.fillRect(1, 1, W - 2, H / 2); x.fillStyle = '#6a8a3a'; x.fillRect(1, H / 2, W - 2, H / 2 - 1); x.fillStyle = '#b9893a'; x.fillRect(W / 2 - 2, 3, 4, 4); x.fillStyle = '#3a2a1e'; x.fillRect(4, H / 2 - 3, 2, 5); x.fillRect(W - 7, H / 2 - 3, 2, 5); x.fillStyle = '#d8402a'; x.fillRect(W - 8, H / 2 - 5, 3, 2); },
  photo2(x, W, H) { x.fillStyle = '#e8dcc0'; x.fillRect(0, 0, W, H); x.fillStyle = '#d8a060'; x.fillRect(1, 1, W - 2, H - 2); x.fillStyle = '#5a6a3a'; x.fillRect(W / 2 - 3, 5, 6, 8); x.fillStyle = '#f2c79a'; x.fillRect(W / 2 - 2, 2, 4, 3); x.fillStyle = '#d8582e'; x.fillRect(W / 2 - 1, 0, 3, 2); x.fillStyle = '#e07a2c'; x.fillRect(W / 2 + 3, 1, 2, 2); },
  amei(x, W, H) { x.fillStyle = '#e8dcc0'; x.fillRect(0, 0, W, H); x.fillStyle = '#c8b090'; x.fillRect(1, 1, W - 2, H - 2); x.fillStyle = '#3a2a1e'; x.fillRect(4, 3, 4, 4); x.fillRect(W - 8, 3, 4, 4); x.fillStyle = '#8a5a9a'; x.fillRect(3, 7, 6, 6); x.fillStyle = '#d8582e'; x.fillRect(W - 9, 7, 6, 6); },
  sign(x, W, H) { x.fillStyle = '#3a2a1e'; x.fillRect(0, 0, W, H); x.fillStyle = '#f3e6c8'; x.font = '6px monospace'; x.fillText('SALE', 2, 7); x.fillStyle = '#e8a040'; x.fillRect(3, 9, W - 6, 3); },
  map(x, W, H) { x.fillStyle = '#e8d8b0'; x.fillRect(0, 0, W, H); const c = ['#7a8a3a', '#6e7e34', '#62722e', '#566628', '#4a5a22']; for (let i = 0; i < 5; i++) { x.fillStyle = c[i]; x.fillRect(1, H - 2 - (i + 1) * (H - 3) / 5, W - 2, (H - 3) / 5); } x.fillStyle = '#4f8a87'; x.fillRect(W - 4, 1, 2, H - 2); x.fillStyle = '#d8402a'; x.fillRect(W / 2, 2, 2, 2); },
  peak(x, W, H) { x.fillStyle = '#c8e0f0'; x.fillRect(0, 0, W, H); x.fillStyle = '#6a7a8a'; for (let i = 0; i < W; i++) { const h = Math.max(0, H / 2 + 2 - Math.abs(i - W / 2)); x.fillRect(i, H - h, 1, h); } x.fillStyle = '#ffffff'; x.fillRect(W / 2 - 2, H / 2 - 1, 4, 2); },
};
const BOARDS = {
  mill(x, W, H) { x.fillStyle = '#2f4a3a'; x.fillRect(0, 0, W, H); x.fillStyle = '#e8f0e0'; x.fillRect(4, 6, 30, 1); x.fillRect(20, 6, 1, 16); x.fillRect(8, 3, 2, 6); x.fillRect(14, 3, 2, 6); x.fillRect(19, 11, 3, 2); x.fillRect(19, 17, 3, 2); x.fillStyle = '#f0a0a0'; x.fillRect(25, 3, 2, 6); x.fillRect(29, 10, 6, 1); x.fillRect(31, 13, 1, 1); x.fillRect(34, 13, 1, 1); x.fillRect(31, 16, 4, 1); x.fillStyle = '#e8f0e0'; x.fillRect(16, 22, 9, 4); },
  duck(x, W, H) { x.fillStyle = '#e8d8b0'; x.fillRect(0, 0, W, H); x.fillStyle = '#f2ead8'; x.fillRect(12, 9, 20, 12); x.fillStyle = '#3a6a4a'; x.fillRect(28, 5, 8, 8); x.fillStyle = '#e8a030'; x.fillRect(36, 8, 4, 2); x.fillStyle = '#d8402a'; for (const [a, b] of [[31, 7], [30, 8], [32, 8], [31, 9], [20, 14], [15, 18]]) x.fillRect(a, b, 1, 1); },
};

export function buildInteriors(scene, gradient) {
  GRAD = gradient;
  const rooms = {};
  let i = 0;
  for (const [id, R] of Object.entries(ROOMS)) {
    const ox = ROOM_X0 + i * 30, oz = 10; i++;
    const g = new THREE.Group(); g.position.set(ox, 0, oz); scene.add(g);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(R.w, R.d), plankFloor(R.w, R.d, ...R.floor)); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
    const WH = 2.7;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(R.w, WH), wallpaper(R.w, WH, ...R.wall)); back.position.set(0, WH / 2, -R.d / 2); back.receiveShadow = true; g.add(back);
    for (const s of [-1, 1]) { const side = new THREE.Mesh(new THREE.PlaneGeometry(R.d, WH), wallpaper(R.d, WH, shadeHex(R.wall[0], 0.86), shadeHex(R.wall[1], 0.86))); side.rotation.y = -s * Math.PI / 2; side.position.set(s * R.w / 2, WH / 2, 0); side.receiveShadow = true; g.add(side); }
    box(R.w + 0.3, 0.3, 0.3, 0x5a3a24, 0, 0.15, R.d / 2 + 0.15, g);                // cut-away front wall
    for (const s of [-1, 1]) box(0.3, WH, 0.3, 0x5a3a24, s * (R.w / 2 + 0.15), WH / 2, R.d / 2 + 0.15, g);
    box(R.w + 0.3, 0.2, 0.2, 0x5a3a24, 0, WH, -R.d / 2, g);
    const mat2 = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), mat(0x8a5a3a)); mat2.rotation.x = -Math.PI / 2; mat2.position.set(0, 0.03, R.d / 2 - 0.45); g.add(mat2);
    // back-wall windows (light)
    for (const wx of [-R.w / 4, R.w / 4]) { if (R.pics.some(([px]) => Math.abs(px - wx) < 1.2)) continue; const w = F.window(); w.position.set(wx, 1.6, -R.d / 2 + 0.05); g.add(w); }
    const objs = {};
    for (const [kind, x, z, ry, args, coll] of R.items) {
      const o = F[kind](...(kind === 'chalkboard' ? [BOARDS[args[0]]] : args)); o.position.set(x, 0, z); o.rotation.y = ry; g.add(o);
      o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      (objs[kind] ||= []).push(o);
      if (coll) { const [cw, cd] = Math.abs(Math.sin(ry)) > 0.7 ? [coll[1], coll[0]] : coll; o.userData.coll = [ox + x - cw / 2, ox + x + cw / 2, oz + z - cd / 2, oz + z + cd / 2]; }
    }
    for (const [x, z, w, d, a, b] of R.rugs) { const r = rug(w, d, a, b); r.position.x = x; r.position.z = z; g.add(r); }
    for (const [x, key] of R.pics) { const p = picture(0.8, 0.6, PICS[key]); p.position.set(x, 1.65, -R.d / 2 + 0.05); g.add(p); }
    rooms[id] = { id, ...R, ox, oz, group: g, objs };
  }
  return rooms;
}
export const roomWorld = (room, x, z) => [room.ox + x, room.oz + z];
