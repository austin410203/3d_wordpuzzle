// props.js — procedural low-poly props that read as pixel art after the pixel/outline pass
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { noise2, mulberry } from './noise.js';
import { makeRoofTex, makePlankTex, makeStoneTex, makeLeafTex } from './textures.js';

export const M = {};   // shared materials
let GRAD;

export function initMaterials(gradient) {
  GRAD = gradient;
  const T = (o) => new THREE.MeshToonMaterial({ gradientMap: gradient, ...o });
  M.leaf = T({ vertexColors: true, map: makeLeafTex() });
  M.leaf.map.colorSpace = THREE.NoColorSpace;
  M.vc = T({ vertexColors: true });
  M.roofOrange = T({ map: makeRoofTex('#d9893a', '#9e5222', '#f2ad5c') });
  M.roofDark = T({ map: makeRoofTex('#6a5a55', '#3e3433', '#8a7a70') });
  M.roofRed = T({ map: makeRoofTex('#b5452e', '#7a2a1e', '#d8664a') });
  M.barn = T({ map: makePlankTex('#a63a2c', '#6a2420', '#c4553e') });
  M.wood = T({ map: makePlankTex('#8a5a36', '#5a3820', '#a87448') });
  M.woodLight = T({ map: makePlankTex('#b48452', '#7a5532', '#d0a06a') });
  M.plaster = T({ color: 0xe6d3a8 });
  M.timber = T({ color: 0x5a3a24 });
  M.stone = T({ map: makeStoneTex() });
  M.trim = T({ color: 0xf0e6cc });
  M.window = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  M.windowDark = T({ color: 0x3a3a48 });
  M.door = T({ color: 0x4e3020 });
  M.bronze = T({ color: 0xb9893a });
  M.rope = T({ color: 0xc9a66b });
  M.metal = T({ color: 0x6d6f75 });
  M.lanternGlow = new THREE.MeshBasicMaterial({ color: 0xffc35a });
  M.lanternOff = T({ color: 0x3b3328 });
  M.gold = new THREE.MeshBasicMaterial({ color: 0xffcf3a });
  M.white = T({ color: 0xf2efe6 });
  M.cloth = T({ color: 0x5a7a9a });
  M.fire = new THREE.MeshBasicMaterial({ color: 0xff9a2e });
  return M;
}

// ---------------------------------------------------------------------------------------------
// geometry helpers
const C = (h) => new THREE.Color(h);
function prep(g, color, m) {
  g = g.index ? g.toNonIndexed() : g;
  if (m) g.applyMatrix4(m);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  const cc = color instanceof THREE.Color ? color : C(color);
  for (let i = 0; i < n; i++) { col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const mat4 = (x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const merge = (parts) => mergeGeometries(parts.map(p => { for (const k of Object.keys(p.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) p.deleteAttribute(k); return p; }), false);

// lumpy faceted blob with tone ramp by height (dark under, light on top)
function blob(r, detail, seed, tones, sq = 0.86) {
  let g = new THREE.IcosahedronGeometry(r, detail);
  g = g.index ? g.toNonIndexed() : g;
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const d = 1 + 0.13 * noise2(x * 2.1 + seed, z * 2.1 + y * 1.3 - seed) + 0.05 * noise2(x * 5 + seed, y * 5);
    p.setXYZ(i, x * d, y * d * sq, z * d);
  }
  g.computeVertexNormals();
  const n = p.count, col = new Float32Array(n * 3), cs = tones.map(C);
  for (let i = 0; i < n; i += 3) {
    const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3 / (r * sq);
    const nz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3 / r;
    let t = y < -0.35 ? 0 : y < 0.25 ? 1 : y < 0.7 ? 2 : 3;
    if (nz > 0.6 && t > 1 && ((i / 3) % 3 === 0)) t -= 1;
    const cc = cs[Math.min(t, cs.length - 1)];
    for (let k = 0; k < 3; k++) { col[(i + k) * 3] = cc.r * 1.25; col[(i + k) * 3 + 1] = cc.g * 1.25; col[(i + k) * 3 + 2] = cc.b * 1.25; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export const TREE_TONES = {
  green: ['#2f4420', '#465f27', '#617a31', '#7f963d'],
  green2: ['#34481f', '#4f6a2b', '#6c8636', '#8ea444'],
  olive: ['#3f4a1f', '#5b6628', '#788232', '#98a040'],
  orange: ['#8c3a1a', '#c25a22', '#e57f2c', '#f6a744'],
  amber: ['#9a5a1a', '#d08a2a', '#ecae3c', '#f8cf60'],
  red: ['#7a261c', '#a83a24', '#cf5a30', '#e8864a'],
  pine: ['#1f3326', '#2c4a33', '#3c6040', '#4f7650'],
};

export function treeGeometry(kind, seed) {
  const r = mulberry(seed * 977 + 13);
  const parts = [];
  const trunkC = '#5a3a24';
  if (kind === 'pine') {
    const h = 3.2 + r() * 1.4;
    parts.push(prep(new THREE.CylinderGeometry(0.12, 0.18, 0.9, 6), trunkC, mat4(0, 0.45, 0)));
    const tiers = 3;
    const T = TREE_TONES.pine.map(C);
    for (let t = 0; t < tiers; t++) {
      const f = t / tiers, rad = (1.25 - f * 0.75) * (0.9 + r() * 0.2), th = h * 0.42;
      let g = new THREE.ConeGeometry(rad, th, 8, 1);
      g = g.toNonIndexed();
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i), y = p.getY(i);
        const d = 1 + 0.12 * noise2(x * 3 + seed + t, z * 3);
        p.setXYZ(i, x * d, y, z * d);
      }
      g.computeVertexNormals();
      g.applyMatrix4(mat4(0, 0.7 + f * h * 0.62 + th / 2, 0, 1, 1, 1, r() * 3));
      const col = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i += 3) {
        const yl = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
        const top = 0.7 + f * h * 0.62 + th * 0.5;
        const k = yl < top - th * 0.75 ? 0 : yl < top - th * 0.35 ? 1 : yl < top ? 2 : 3;
        const cc = T[Math.min(3, k + (t === tiers - 1 ? 1 : 0))];
        for (let q = 0; q < 3; q++) col.set([cc.r * 1.25, cc.g * 1.25, cc.b * 1.25], (i + q) * 3);
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      parts.push(g);
    }
    return { geo: merge(parts), r: 0.45, h };
  }
  if (kind === 'bush' || kind === 'bushO') {
    const tones = kind === 'bush' ? TREE_TONES.green2 : TREE_TONES.orange;
    const n = 2 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      const a = r() * 6.28, d = i ? 0.35 : 0;
      parts.push(blob(0.42 + r() * 0.2, 0, seed + i, tones).applyMatrix4(mat4(Math.cos(a) * d, 0.35, Math.sin(a) * d)));
    }
    return { geo: merge(parts), r: 0.4, h: 0.8 };
  }
  // deciduous
  const tones = TREE_TONES[kind];
  const R = 1.05 + r() * 0.45;
  const th = 0.9 + r() * 0.4;
  parts.push(prep(new THREE.CylinderGeometry(0.14, 0.22, th + 0.4, 6), trunkC, mat4(0, (th + 0.4) / 2, 0)));
  const cy = th + R * 0.75;
  parts.push(blob(R, 1, seed, tones).applyMatrix4(mat4(0, cy, 0)));
  const n = 4 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.28 + r() * 0.6, d = R * (0.55 + r() * 0.25), rr = R * (0.45 + r() * 0.2);
    parts.push(blob(rr, 1, seed * 3 + i, tones).applyMatrix4(mat4(Math.cos(a) * d, cy + (r() - 0.35) * R * 0.6, Math.sin(a) * d * 0.9)));
  }
  parts.push(blob(R * 0.55, 1, seed + 99, tones).applyMatrix4(mat4((r() - 0.5) * 0.4, cy + R * 0.55, (r() - 0.5) * 0.4)));
  return { geo: merge(parts), r: 0.4, h: cy + R };
}

export function rockGeometry(seed, size = 1, mossy = true) {
  const r = mulberry(seed * 31 + 5);
  let g = new THREE.DodecahedronGeometry(0.5 * size, 0);
  g = g.toNonIndexed();
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const d = 1 + 0.18 * noise2(x * 3 + seed, z * 3 + y * 2);
    p.setXYZ(i, x * d * (1 + r() * 0.0), Math.max(-0.15 * size, y * d * 0.72), z * d);
  }
  g.computeVertexNormals();
  const col = new Float32Array(p.count * 3);
  const tones = ['#5a4e42', '#786a58', '#968670', '#b0a088'].map(C), moss = C('#6b7a32');
  for (let i = 0; i < p.count; i += 3) {
    const ny = g.attributes.normal.getY(i);
    let cc = tones[ny < -0.2 ? 0 : ny < 0.3 ? 1 : ny < 0.75 ? 2 : 3];
    if (mossy && ny > 0.8 && r() < 0.6) cc = moss;
    for (let q = 0; q < 3; q++) col.set([cc.r, cc.g, cc.b], (i + q) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.translate(0, 0.12 * size, 0);
  return g;
}

export function tuftGeometry() {
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1;
    parts.push(prep(new THREE.ConeGeometry(0.07, 0.34, 3), i === 1 ? '#7f8f38' : '#56652a', mat4(Math.cos(a) * 0.08, 0.15, Math.sin(a) * 0.08, 1, 1, 1, 0, Math.cos(a) * 0.3, Math.sin(a) * 0.3)));
  }
  return merge(parts);
}
export function flowerGeometry(color) {
  return merge([
    prep(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 3), '#4f6a2b', mat4(0, 0.11, 0)),
    prep(new THREE.IcosahedronGeometry(0.07, 0), color, mat4(0, 0.24, 0)),
  ]);
}
export function leafLitterGeometry() {
  const g = new THREE.PlaneGeometry(0.16, 0.12); g.rotateX(-Math.PI / 2); g.translate(0, 0.02, 0);
  return prep(g, '#ffffff');
}
export function mushroomGeometry() {
  return merge([
    prep(new THREE.CylinderGeometry(0.035, 0.045, 0.14, 5), '#efe4cc', mat4(0, 0.07, 0)),
    prep(new THREE.SphereGeometry(0.1, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), '#c23a26', mat4(0, 0.13, 0)),
  ]);
}

// ---------------------------------------------------------------------------------------------
// buildings
function box(w, h, d, mat, x = 0, y = 0, z = 0, uvScale) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (uvScale) { // world-scaled uvs: 16 texels/unit with 64px textures → 4 units per repeat
    const uv = g.attributes.uv, pos = g.attributes.position, nrm = g.attributes.normal;
    for (let i = 0; i < uv.count; i++) {
      const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i));
      const px = pos.getX(i) + x, py = pos.getY(i) + y, pz = pos.getZ(i) + z;
      const u = nx > 0.5 ? pz : px, v = ny > 0.5 ? pz : py;
      uv.setXY(i, u / uvScale, v / uvScale);
    }
  }
  const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  return m;
}

function gableRoof(w, d, rise, over, mat, gableMat, y0) {
  const grp = new THREE.Group();
  const hw = w / 2 + over, hd = d / 2 + over;
  const slope = Math.hypot(hd, rise);
  // two slopes as thin boxes rotated around x (ridge along x)
  const ang = Math.atan2(rise, hd);
  for (const s of [-1, 1]) {
    const g = new THREE.BoxGeometry(hw * 2, 0.12, slope);
    const uv = g.attributes.uv, pos = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 4, pos.getZ(i) / 4);
    const m = new THREE.Mesh(g, mat);
    m.position.set(0, y0 + rise / 2, s * hd / 2);
    m.rotation.x = s * ang;
    m.castShadow = m.receiveShadow = true;
    grp.add(m);
  }
  // gable triangles
  const shape = new THREE.Shape();
  shape.moveTo(-d / 2, 0); shape.lineTo(d / 2, 0); shape.lineTo(0, rise * (d / 2) / hd); shape.closePath();
  for (const s of [-1, 1]) {
    const g = new THREE.ShapeGeometry(shape);
    const m = new THREE.Mesh(g, gableMat);
    m.rotation.y = s * Math.PI / 2;
    m.position.set(s * w / 2, y0, 0);
    m.castShadow = true;
    grp.add(m);
  }
  // ridge
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 0.05, 0.14, 0.18), M.timber);
  ridge.position.set(0, y0 + rise + 0.02, 0); grp.add(ridge);
  return grp;
}

function windowMesh(x, y, z, w = 0.55, h = 0.6, lit = true, rotY = 0) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, h + 0.14, 0.06), M.trim);
  const pane = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.07), lit ? M.window : M.windowDark);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, h, 0.08), M.trim);
  const bar2 = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.08), M.trim);
  g.add(frame, pane, bar, bar2); g.position.set(x, y, z); g.rotation.y = rotY;
  return g;
}

export function buildHouse(style, w, d) {
  const g = new THREE.Group();
  if (style === 'barn') {
    const wh = 2.1;
    g.add(box(w, 0.3, d, M.stone, 0, 0.15, 0, 4));
    g.add(box(w - 0.1, wh, d - 0.1, M.barn, 0, 0.3 + wh / 2, 0, 4));
    const roof = gableRoof(w, d, 1.6, 0.32, M.roofDark, M.barn, 0.3 + wh); g.add(roof);
    // front: door with white X-trim, two windows
    g.add(box(0.95, 1.5, 0.08, M.door, -0.4, 0.3 + 0.75, d / 2 - 0.02));
    for (const s of [-1, 1]) { const t = box(0.07, 1.65, 0.1, M.trim, -0.4, 0.3 + 0.75, d / 2); t.rotation.z = s * 0.56; g.add(t); }
    g.add(box(1.1, 0.08, 0.1, M.trim, -0.4, 0.3 + 1.52, d / 2));
    g.add(windowMesh(1.05, 1.45, d / 2 + 0.01, 0.6, 0.6, true));
    g.add(windowMesh(0, 2.15, d / 2 + 0.01, 0.0, 0, false));
    g.add(box(0.5, 1.4, 0.5, M.stone, w / 2 - 0.7, 0.3 + wh + 1.2, -0.3, 4));
    // porch planks + bench
    g.add(box(w * 0.7, 0.12, 0.9, M.woodLight, -0.2, 0.06, d / 2 + 0.45, 4));
  } else if (style === 'tudor') {
    const wh = 2.0;
    g.add(box(w, 0.3, d, M.stone, 0, 0.15, 0, 4));
    g.add(box(w - 0.1, wh, d - 0.1, M.plaster, 0, 0.3 + wh / 2, 0));
    for (const x of [-w / 2 + 0.08, -w / 6, w / 6, w / 2 - 0.08]) g.add(box(0.12, wh, 0.06, M.timber, x, 0.3 + wh / 2, d / 2 - 0.04));
    g.add(box(w, 0.12, 0.07, M.timber, 0, 0.3 + wh * 0.55, d / 2 - 0.03));
    g.add(box(w, 0.12, 0.07, M.timber, 0, 0.3 + wh - 0.06, d / 2 - 0.03));
    for (const z of [-d / 2 + 0.08, d / 2 - 0.08]) for (const s of [-1, 1]) g.add(box(0.06, wh, 0.12, M.timber, s * (w / 2 - 0.04), 0.3 + wh / 2, z));
    g.add(gableRoof(w, d, 1.5, 0.35, M.roofOrange, M.plaster, 0.3 + wh));
    g.add(box(0.8, 1.35, 0.08, M.door, 0.2, 0.3 + 0.68, d / 2 + 0.01));
    g.add(windowMesh(-0.95, 1.5, d / 2 + 0.02, 0.5, 0.5, true));
    g.add(windowMesh(1.15, 1.5, d / 2 + 0.02, 0.45, 0.5, true));
    // flower box
    g.add(box(0.7, 0.16, 0.2, M.wood, -0.95, 1.1, d / 2 + 0.12));
    for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), i % 2 ? M.fire : M.trim); f.position.set(-1.2 + i * 0.17, 1.25, d / 2 + 0.14); g.add(f); }
    g.add(box(0.45, 1.2, 0.45, M.stone, -w / 2 + 0.7, 0.3 + wh + 1.0, -0.2, 4));
  } else if (style === 'shed') {
    const wh = 1.5;
    g.add(box(w, wh, d, M.wood, 0, wh / 2, 0, 4));
    g.add(gableRoof(w, d, 0.9, 0.22, M.roofOrange, M.wood, wh));
    g.add(box(0.75, 1.15, 0.08, M.door, 0, 0.58, d / 2 + 0.01));
    g.add(box(0.85, 0.07, 0.1, M.trim, 0, 1.2, d / 2 + 0.02));
  } else if (style === 'hut') {
    const wh = 1.5;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.14, 0.5, 0.14, M.timber, sx * (w / 2 - 0.1), 0.25, sz * (d / 2 - 0.1)));
    g.add(box(w + 0.2, 0.12, d + 0.5, M.woodLight, 0, 0.5, 0.2, 4));
    g.add(box(w, wh, d, M.woodLight, 0, 0.5 + wh / 2, 0, 4));
    g.add(gableRoof(w, d, 1.0, 0.25, M.roofOrange, M.woodLight, 0.5 + wh));
    g.add(box(0.65, 1.05, 0.08, M.door, -0.3, 0.5 + 0.53, d / 2 + 0.01));
    g.add(windowMesh(0.55, 1.35, d / 2 + 0.02, 0.4, 0.4, true));
  } else if (style === 'mill') {
    const wh = 1.4, wh2 = 1.5;
    g.add(box(w, wh, d, M.stone, 0, wh / 2, 0, 4));
    g.add(box(w - 0.2, wh2, d - 0.2, M.woodLight, 0, wh + wh2 / 2, 0, 4));
    g.add(gableRoof(w - 0.2, d - 0.2, 1.4, 0.3, M.roofRed, M.woodLight, wh + wh2));
    g.add(box(0.8, 1.2, 0.08, M.door, -0.5, 0.6, d / 2 + 0.01));
    g.add(windowMesh(0.6, wh + 0.8, d / 2 - 0.08, 0.5, 0.5, true));
    g.add(windowMesh(-0.8, wh + 0.8, d / 2 - 0.08, 0.5, 0.5, true));
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function millWheel() {
  const g = new THREE.Group();
  const R = 1.35, parts = [];
  const ring = new THREE.TorusGeometry(R, 0.09, 4, 16);
  parts.push(prep(ring, '#6a4428', mat4(0, 0, 0.18)), prep(ring.clone(), '#6a4428', mat4(0, 0, -0.18)));
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    parts.push(prep(new THREE.BoxGeometry(0.5, 0.08, 0.5), '#9a6a40', mat4(Math.cos(a) * R, Math.sin(a) * R, 0, 1, 1, 1, 0, 0, a + Math.PI / 2)));
    if (i % 3 === 0) parts.push(prep(new THREE.BoxGeometry(R * 2, 0.08, 0.08), '#5a3820', mat4(0, 0, 0, 1, 1, 1, 0, 0, a)));
  }
  parts.push(prep(new THREE.CylinderGeometry(0.16, 0.16, 0.6, 8), '#4a3020', mat4(0, 0, 0, 1, 1, 1, 0, Math.PI / 2)));
  const m = new THREE.Mesh(merge(parts), M.vc); m.castShadow = true;
  g.add(m); g.userData.spin = m;
  return g;
}

export function fenceGeometries() {
  return {
    post: prep(new THREE.BoxGeometry(0.12, 0.62, 0.12), '#7a5232', mat4(0, 0.31, 0)),
    rail: prep(new THREE.BoxGeometry(1, 0.07, 0.06), '#93653e'),
  };
}

export function ladderMesh(height, broken) {
  const parts = [];
  for (const s of [-1, 1]) parts.push(prep(new THREE.BoxGeometry(0.09, height + 0.5, 0.09), '#7a5232', mat4(s * 0.33, (height + 0.5) / 2, 0)));
  const n = Math.floor(height / 0.42);
  for (let i = 1; i <= n; i++) {
    if (broken && (i % 3 !== 1 || i > n * 0.5)) continue;
    parts.push(prep(new THREE.BoxGeometry(0.66, 0.06, 0.07), '#a87448', mat4(0, i * 0.42, 0, 1, 1, 1, 0, 0, broken ? (i % 2 ? 0.25 : -0.3) : 0)));
  }
  const m = new THREE.Mesh(merge(parts), M.vc); m.castShadow = true; m.receiveShadow = true;
  if (broken) m.scale.y = 0.55;
  return m;
}

export function stoneLantern(h) {
  const g = new THREE.Group();
  const s = h / 2.25;
  const add = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  add(new THREE.CylinderGeometry(0.38, 0.45, 0.22, 6), M.stone, 0.11);
  const pillarH = Math.max(0.25, h - 1.15);
  add(new THREE.CylinderGeometry(0.14, 0.17, pillarH, 6), M.stone, 0.22 + pillarH / 2);
  const y1 = 0.22 + pillarH;
  add(new THREE.BoxGeometry(0.62, 0.12, 0.62), M.stone, y1 + 0.06);
  const light = add(new THREE.BoxGeometry(0.42, 0.36, 0.42), M.lanternOff, y1 + 0.3);
  for (const [x, z] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.4, 0.09), M.stone); p.position.set(x, y1 + 0.3, z); g.add(p);
  }
  add(new THREE.ConeGeometry(0.58, 0.38, 4), M.stone, y1 + 0.66).rotation.y = Math.PI / 4;
  add(new THREE.IcosahedronGeometry(0.1, 0), M.stone, y1 + 0.9);
  g.userData.light = light; g.userData.lightY = y1 + 0.3;
  void s;
  return g;
}

export function bellTower() {
  const g = new THREE.Group();
  const H = 3.6;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.26, H, 0.26, M.timber, sx * 1.1, H / 2, sz * 1.1));
  g.add(box(2.6, 0.22, 2.6, M.stone, 0, 0.11, 0, 4));
  for (const y of [H - 0.3, 1.2]) { g.add(box(2.5, 0.16, 0.18, M.timber, 0, y, 1.1)); g.add(box(2.5, 0.16, 0.18, M.timber, 0, y, -1.1)); g.add(box(0.18, 0.16, 2.5, M.timber, 1.1, y, 0)); g.add(box(0.18, 0.16, 2.5, M.timber, -1.1, y, 0)); }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.5, 4), M.roofRed);
  roof.rotation.y = Math.PI / 4; roof.position.y = H + 0.7; roof.castShadow = true; g.add(roof);
  const pts = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(0.18 + 0.55 * Math.pow(t, 1.8) + (t > 0.9 ? 0.06 : 0), -t * 1.05)); }
  const bell = new THREE.Mesh(new THREE.LatheGeometry(pts, 10), M.bronze);
  bell.position.y = H - 0.45; bell.castShadow = true;
  const bg = new THREE.Group(); bg.position.y = H - 0.38; bell.position.y = -0.07; bg.add(bell);
  const rope = box(0.05, 1.3, 0.05, M.rope, 0.35, -1.6, 0); bg.add(rope);
  g.add(bg); g.userData.bell = bg;
  return g;
}

export function boulderMesh(seed) {
  const g = rockGeometry(seed, 1.75, true);
  const m = new THREE.Mesh(g, M.vc); m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function signpost(text) {
  const g = new THREE.Group();
  g.add(box(0.1, 1.1, 0.1, M.timber, 0, 0.55, 0));
  g.add(box(0.8, 0.32, 0.06, M.woodLight, 0.1, 0.95, 0.05));
  g.userData.text = text;
  return g;
}

export function mailbox() {
  const g = new THREE.Group();
  g.add(box(0.08, 0.9, 0.08, M.timber, 0, 0.45, 0));
  g.add(box(0.36, 0.3, 0.5, M.barn, 0, 1.0, 0));
  const flag = box(0.04, 0.22, 0.12, M.fire, 0.2, 1.1, 0.1); g.add(flag); g.userData.flag = flag;
  return g;
}

export function crate(x = 0, z = 0) { return box(0.6, 0.6, 0.6, M.woodLight, x, 0.3, z, 4); }
export function barrel() {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.25, 0.7, 8), M.wood); m.position.y = 0.35; m.castShadow = true; return m;
}
export function logPile() {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const row = i < 3 ? 0 : i < 5 ? 1 : 2, k = i < 3 ? i : i < 5 ? i - 3 : 0;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.6, 7), M.wood);
    m.rotation.z = Math.PI / 2; m.position.set(0, 0.18 + row * 0.3, (k - (row === 0 ? 1 : row === 1 ? 0.5 : 0)) * 0.36);
    m.castShadow = true; g.add(m);
  }
  return g;
}
export function tent() {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(0.01, 1.1, 1.3, 3, 1);
  const m = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color: 0x5f7f4a, gradientMap: GRAD }));
  m.rotation.z = Math.PI / 2; m.rotation.y = Math.PI / 2; m.scale.set(1, 1.6, 1); m.position.y = 0.5; m.castShadow = true;
  g.add(m);
  return g;
}
export function campfire() {
  const g = new THREE.Group();
  for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28; const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14, 0), M.stone); s.position.set(Math.cos(a) * 0.42, 0.08, Math.sin(a) * 0.42); g.add(s); }
  for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 5), M.wood); l.rotation.z = Math.PI / 2; l.rotation.y = i * 1.05; l.position.y = 0.1; g.add(l); }
  const f = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 5), M.fire); f.position.y = 0.38; g.add(f);
  const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 5), new THREE.MeshBasicMaterial({ color: 0xffe08a })); f2.position.y = 0.32; g.add(f2);
  g.userData.flames = [f, f2];
  return g;
}
export function easel() {
  const g = new THREE.Group();
  for (const [x, rz] of [[-0.22, 0.12], [0.22, -0.12]]) { const l = box(0.06, 1.3, 0.06, M.timber, x, 0.65, 0); l.rotation.z = rz; g.add(l); }
  const back = box(0.06, 1.2, 0.06, M.timber, 0, 0.6, -0.3); back.rotation.x = -0.3; g.add(back);
  g.add(box(0.7, 0.55, 0.05, M.white, 0, 1.0, 0.05));
  g.add(box(0.5, 0.3, 0.06, new THREE.MeshToonMaterial({ color: 0xd8702a, gradientMap: GRAD }), 0, 1.0, 0.06));
  return g;
}
export function dock(len, wid) {
  const g = new THREE.Group();
  g.add(box(len, 0.12, wid, M.woodLight, 0, 0, 0, 4));
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) g.add(box(0.14, 1.2, 0.14, M.timber, -len / 2 + 0.2 + i * (len - 0.4) / 2, -0.5, sx * (wid / 2 - 0.08)));
  return g;
}
export function bench() {
  const g = new THREE.Group();
  g.add(box(1.2, 0.08, 0.4, M.woodLight, 0, 0.42, 0));
  g.add(box(1.2, 0.3, 0.06, M.woodLight, 0, 0.65, -0.18));
  for (const s of [-1, 1]) g.add(box(0.07, 0.42, 0.36, M.timber, s * 0.5, 0.21, 0));
  return g;
}
export function lever() {
  const g = new THREE.Group();
  g.add(box(0.5, 0.3, 0.4, M.stone, 0, 0.15, 0));
  const arm = new THREE.Group(); arm.position.y = 0.3;
  arm.add(box(0.08, 0.8, 0.08, M.timber, 0, 0.4, 0));
  const knob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), M.fire); knob.position.y = 0.8; arm.add(knob);
  g.add(arm); g.userData.arm = arm;
  return g;
}
export function gateBoard() { return box(0.12, 0.7, 0.9, M.wood, 0, 0.35, 0); }
export function lift() {
  const g = new THREE.Group();
  const plat = new THREE.Group();
  plat.add(box(1.6, 0.14, 1.6, M.woodLight, 0, 0.07, 0, 4));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) plat.add(box(0.06, 0.6, 0.06, M.timber, sx * 0.75, 0.37, sz * 0.75));
  plat.add(box(1.6, 0.06, 0.06, M.timber, 0, 0.65, 0.75));
  g.add(plat); g.userData.plat = plat;
  return g;
}
export function portcullis(w) {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) g.add(box(0.1, 2.0, 0.1, M.metal, -w / 2 + 0.2 + i * (w - 0.4) / 4, 1.0, 0));
  for (const y of [0.4, 1.0, 1.6]) g.add(box(w - 0.2, 0.08, 0.12, M.metal, 0, y, 0));
  return g;
}
export function chest() {
  const g = new THREE.Group();
  g.add(box(0.9, 0.5, 0.6, M.wood, 0, 0.25, 0));
  const lid = new THREE.Group(); lid.position.set(0, 0.5, -0.3);
  lid.add(box(0.92, 0.18, 0.62, M.woodLight, 0, 0.09, 0.3));
  g.add(lid); g.userData.lid = lid;
  g.add(box(0.12, 0.16, 0.05, M.bronze, 0, 0.45, 0.31));
  return g;
}
export function caveDoor() {
  const g = new THREE.Group();
  const slab = box(1.7, 2.2, 0.35, M.stone, 0, 1.1, 0, 4); g.add(slab); g.userData.slab = slab;
  const carving = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.05, 4, 12), M.lanternOff); carving.position.set(0, 1.3, 0.19); g.add(carving);
  g.userData.carving = carving;
  return g;
}
export function crystal(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color });
  for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.18 + i * 0.05, 0), mat); c.scale.y = 2.2; c.position.set((i - 1) * 0.18, 0.3 + i * 0.05, (i % 2) * 0.1); c.rotation.z = (i - 1) * 0.35; g.add(c); }
  return g;
}
export function barricade() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 2.4, 7), M.wood); l.rotation.z = Math.PI / 2; l.rotation.y = (i - 1) * 0.15; l.position.set(0, 0.22 + i * 0.36, 0); l.castShadow = true; g.add(l); }
  return g;
}
export function shrine() {
  const g = new THREE.Group();
  g.add(box(0.9, 0.2, 0.7, M.stone, 0, 0.1, 0, 4));
  g.add(box(0.6, 0.7, 0.45, M.woodLight, 0, 0.55, 0));
  const r = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.4, 4), M.roofRed); r.rotation.y = Math.PI / 4; r.position.y = 1.1; g.add(r);
  return g;
}
export function clothesline() {
  const g = new THREE.Group();
  for (const x of [-1.2, 1.2]) g.add(box(0.07, 1.5, 0.07, M.timber, x, 0.75, 0));
  g.add(box(2.4, 0.02, 0.02, M.rope, 0, 1.42, 0));
  const cols = [0xe8d8b0, 0x6a8ab0, 0xc9573a];
  cols.forEach((c, i) => g.add(box(0.45, 0.5, 0.03, new THREE.MeshToonMaterial({ color: c, gradientMap: GRAD }), -0.7 + i * 0.7, 1.15, 0)));
  return g;
}
export function cart() {
  const g = new THREE.Group();
  g.add(box(1.4, 0.4, 0.9, M.wood, 0, 0.55, 0, 4));
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 10), M.timber); w.rotation.x = Math.PI / 2; w.position.set(0.2, 0.32, s * 0.5); g.add(w); }
  g.add(box(1.1, 0.06, 0.06, M.timber, -1.1, 0.5, 0.25)); g.add(box(1.1, 0.06, 0.06, M.timber, -1.1, 0.5, -0.25));
  return g;
}
