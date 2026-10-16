// world.js — assembles terrain, scattered nature, fences, static decor and colliders
import * as THREE from 'three';
import * as MAP from './map.js';
import { buildTerrain, groundMaterial, waterMaterial, fallMaterial, makeNoiseTex } from './terrain.js';
import { makeGrassTex, makeDirtTex, makeCliffTex, makeStoneTex } from './textures.js';
import * as P from './props.js';
import { fbm, mulberry, noise2 } from './noise.js';

const S = MAP.CELL;  // map units → world

export class Colliders {
  constructor() { this.cells = new Map(); this.all = new Set(); }
  key(i, j) { return i * 4096 + j; }
  add(c) {
    c.bb = c.r != null ? [c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r] : [c.x0, c.z0, c.x1, c.z1];
    const [a, b, d, e] = c.bb;
    c.keys = [];
    for (let i = Math.floor(a / 4); i <= Math.floor(d / 4); i++) for (let j = Math.floor(b / 4); j <= Math.floor(e / 4); j++) {
      const k = this.key(i, j); if (!this.cells.has(k)) this.cells.set(k, []); this.cells.get(k).push(c); c.keys.push(k);
    }
    this.all.add(c);
    return c;
  }
  remove(c) {
    if (!this.all.has(c)) return;
    for (const k of c.keys) { const a = this.cells.get(k); const i = a.indexOf(c); if (i >= 0) a.splice(i, 1); }
    this.all.delete(c);
  }
  move(c, x, z) { this.remove(c); c.x = x; c.z = z; if (c.r == null) { const hw = (c.x1 - c.x0) / 2, hd = (c.z1 - c.z0) / 2; c.x0 = x - hw; c.x1 = x + hw; c.z0 = z - hd; c.z1 = z + hd; } this.add(c); }
  hit(x, z, r, ignore) {
    const i0 = Math.floor((x - r) / 4), i1 = Math.floor((x + r) / 4), j0 = Math.floor((z - r) / 4), j1 = Math.floor((z + r) / 4);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const a = this.cells.get(this.key(i, j)); if (!a) continue;
      for (const c of a) {
        if (c === ignore || c.off) continue;
        if (c.r != null) { const dx = x - c.x, dz = z - c.z, rr = r + c.r; if (dx * dx + dz * dz < rr * rr) return c; }
        else if (x + r > c.x0 && x - r < c.x1 && z + r > c.z0 && z - r < c.z1) return c;
      }
    }
    return null;
  }
}

export function buildWorld(scene, gradient, U) {
  const g = MAP.buildCoarse();
  const lvl = (c, r) => g.level[g.I(c, r)], wat = (c, r) => g.water[g.I(c, r)] === 1, stn = (c, r) => g.stone[g.I(c, r)] === 1;
  const noWarp = (mx, mz) => MAP.NOWARP.some(([c0, r0, c1, r1]) => mx >= c0 && mx < c1 + 1 && mz >= r0 && mz < r1 + 1);
  const paths = MAP.PATHS.map(p => ({ w: p.w * S, pts: p.pts.map(([x, z, l]) => [x * S, z * S, l * MAP.STEP]) }));
  const dirtSpots = [
    [MAP.HOUSES[0].x * S, MAP.HOUSES[0].z * S + 2.2, 2.2], [MAP.HOUSES[1].x * S - 1, MAP.HOUSES[1].z * S + 2, 1.8],
    [36.5 * S, 32.3 * S, 2.6], [40.4 * S, 23.6 * S, 3.2], [MAP.BELL.x * S, MAP.BELL.z * S, 2.6],
    [MAP.CAVE_DOOR.x * S, MAP.CAVE_DOOR.z * S + 1.2, 1.6], [MAP.CAVE_MOUTH.x * S, MAP.CAVE_MOUTH.z * S, 1.6],
    [24.8 * S, 21 * S, 1.6], [31.6 * S, 12.6 * S, 1.6], [22.4 * S, 30.6 * S, 4.2], [47.2 * S, 31.8 * S, 1.2],
  ];
  const noiseTex = makeNoiseTex(64);
  const grassTex = makeGrassTex(), dirtTex = makeDirtTex(), cliffTex = makeCliffTex();
  const t0 = performance.now();
  const PAD = 7;
  const cl = (v, n) => Math.max(0, Math.min(n - 1, v));
  const main = buildTerrain({
    cols: MAP.COLS + PAD * 2, rows: MAP.ROWS + PAD * 2, cell: S, step: MAP.STEP, ox: -PAD * S, oz: -PAD * S,
    level: (c, r) => lvl(cl(c - PAD, MAP.COLS), cl(r - PAD, MAP.ROWS)),
    water: (c, r) => wat(cl(c - PAD, MAP.COLS), cl(r - PAD, MAP.ROWS)),
    stone: (c, r) => (c - PAD >= 0 && r - PAD >= 0 && c - PAD < MAP.COLS && r - PAD < MAP.ROWS) && stn(c - PAD, r - PAD),
    noWarp: (mx, mz) => noWarp(mx - PAD, mz - PAD), paths, dirtSpots,
    bump: (x, z) => 0.05 * noise2(x * 0.5, z * 0.5),
  });
  console.log('terrain', (performance.now() - t0).toFixed(0), 'ms');
  const groundMat = groundMaterial({ grassTex, dirtTex, noiseTex, gradient, uniforms: U });
  const cliffMat = new THREE.MeshToonMaterial({ map: cliffTex, vertexColors: true, gradientMap: gradient });
  const add = (geo, mat, cast = false) => { const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.castShadow = cast; scene.add(m); return m; };
  add(main.groundGeo, groundMat, true);
  add(main.cliffGeo, cliffMat, true);
  const waterMat = waterMaterial(U, noiseTex);
  if (main.waterGeo) add(main.waterGeo, waterMat);
  if (main.fallGeo) add(main.fallGeo, fallMaterial(U, noiseTex));

  // cave
  const caveData = MAP.buildCave();
  const caveStone = makeStoneTex();
  const cave = buildTerrain({
    cols: MAP.CAVE_COLS, rows: MAP.CAVE_ROWS, cell: S, step: MAP.CAVE_STEP, ox: MAP.CAVE_OX, oz: MAP.CAVE_OZ,
    level: caveData.level, water: () => false, warpAmp: 0.0, paths: [], tintMul: [0.55, 0.5, 0.6],
    splatAll: (L) => (L === 0 ? 1 : null), bump: (x, z) => 0.03 * noise2(x, z),
  });
  const caveGround = groundMaterial({ grassTex: caveStone, dirtTex, noiseTex, gradient, uniforms: { uTime: U.uTime, uCloud: { value: 0 } } });
  add(cave.groundGeo, caveGround);
  add(cave.cliffGeo, new THREE.MeshToonMaterial({ map: cliffTex, vertexColors: true, gradientMap: gradient, color: 0x8a7f96 }), true);

  const colliders = new Colliders();
  const T = (x, z) => (x >= MAP.CAVE_OX - 10 ? cave : main);
  const heightAt = (x, z) => T(x, z).heightAt(x, z);

  // ---- exclusion helpers
  const segs = [];
  for (const p of paths) for (let i = 0; i < p.pts.length - 1; i++) segs.push([p.pts[i], p.pts[i + 1], p.w]);
  const pathDist = (x, z) => {
    let best = 1e9;
    for (const [a, b, w] of segs) {
      const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1e-6;
      let t = ((x - a[0]) * dx + (z - a[1]) * dz) / L2; t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) - w;
      if (d < best) best = d;
    }
    return best;
  };
  const excl = []; // [x, z, r] world
  for (const [x, z, r] of MAP.CLEARINGS) excl.push([x * S, z * S, r * S]);
  for (const h of MAP.HOUSES) excl.push([h.x * S, h.z * S, Math.max(h.w, h.d) * 0.75 + 1.2]);
  for (const n of MAP.NPCS) excl.push([n.x * S, n.z * S, 1.6]);
  for (const l of MAP.LEAVES) excl.push([l[0] * S, l[1] * S, 1.3]);
  for (const p of MAP.POSTCARDS) excl.push([p.x * S, p.z * S, 1.3]);
  for (const s of MAP.SKETCH) excl.push([s.x * S, s.z * S, 1.4]);
  for (const l of MAP.LANTERNS) excl.push([l.x * S, l.z * S, 1.4]);
  for (const l of MAP.LADDERS) excl.push([(l.c + 0.5) * S, l.r * S, 2.0]);
  excl.push([(MAP.LIFT.c + 0.5) * S, MAP.LIFT.r * S, 2.6]);
  for (const f of MAP.FISH_SPOTS) excl.push([f.x * S, f.z * S, 1.6]);
  for (const k of Object.values(MAP.MILL.nodes)) excl.push([k[0], k[1], 1.3]);
  for (const k of MAP.MILL.levers) excl.push([k[0], k[1], 1.2]);
  const isExcluded = (x, z, extra = 0) => excl.some(([ex, ez, r]) => (x - ex) ** 2 + (z - ez) ** 2 < (r + extra) ** 2);
  const coarseClear = (x, z) => { const c = Math.floor(x / S), r = Math.floor(z / S); if (c < 0 || r < 0 || c >= MAP.COLS || r >= MAP.ROWS) return false; return g.clear[g.I(c, r)] === 1; };
  const nearWater = (x, z, r) => [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].some(([a, b]) => main.isWater(x + a, z + b));

  // ---- trees (instanced per kind+variant, chunked for culling)
  const VARIANTS = {};
  const kinds = { green: 4, green2: 3, olive: 2, orange: 3, amber: 2, red: 2, pine: 3, bush: 3, bushO: 2 };
  let seed = 1;
  for (const [k, n] of Object.entries(kinds)) VARIANTS[k] = [...Array(n)].map(() => P.treeGeometry(k, seed++));
  const placed = []; // {kind, v, x, y, z, s, rot}
  const rnd = mulberry(4242);
  const pickKind = (x, z, L) => {
    const o = fbm(x * 0.045 + 50, z * 0.045 - 20, 3), q = rnd();
    const pine = 0.1 + L * 0.07 + (fbm(x * 0.06 - 9, z * 0.06 + 4, 2) > 0.2 ? 0.25 : 0);
    if (q < pine) return 'pine';
    if (o > 0.12) { const t = rnd(); return t < 0.55 ? 'orange' : t < 0.85 ? 'amber' : 'red'; }
    if (o > 0.0 && rnd() < 0.3) return 'amber';
    const t = rnd(); return t < 0.45 ? 'green' : t < 0.8 ? 'green2' : 'olive';
  };
  const tryTree = (x, z, kind, force = false) => {
    const isBush = !!kind && kind.startsWith('bush');
    if (!force) {
      if (x < -PAD * S + 1 || z < -PAD * S + 1 || x > (MAP.COLS + PAD) * S - 1 || z > (MAP.ROWS + PAD) * S - 1) return false;
      if (nearWater(x, z, 1.1) || isExcluded(x, z) || coarseClear(x, z)) return false;
      if (pathDist(x, z) < 1.0) return false;
      if (main.flatness(x, z, 0.55) > 0.25) return false;
      for (const t of placed) if ((t.x - x) ** 2 + (t.z - z) ** 2 < (isBush ? 0.8 : 1.3)) return false;
    }
    const L = main.levelAt(x, z);
    kind = kind || pickKind(x, z, L);
    const vs = VARIANTS[kind], v = Math.floor(rnd() * vs.length);
    const s = kind.startsWith('bush') ? 0.8 + rnd() * 0.5 : 0.85 + rnd() * 0.35;
    const t = { kind, v, x, y: main.heightAt(x, z), z, s, rot: rnd() * 6.28 };
    placed.push(t);
    if (!kind.startsWith('bush')) colliders.add({ x, z, r: 0.42 * s, tree: true });
    else colliders.add({ x, z, r: 0.35 * s, tree: true });
    return true;
  };
  // explicit patch trees
  for (const p of MAP.PATCHES) p.rows.forEach((row, dr) => [...row].forEach((ch, dc) => {
    const x = (p.c0 + dc + 0.5) * S, z = (p.r0 + dr + 0.5) * S;
    if (ch === 'T') tryTree(x + (rnd() - 0.5) * 0.4, z + (rnd() - 0.5) * 0.4, rnd() < 0.3 ? 'orange' : rnd() < 0.5 ? 'pine' : 'green', true);
  }));
  // forest scatter
  for (let z = -PAD * S + 1.5; z < (MAP.ROWS + PAD) * S - 1; z += 1.45) for (let x = -PAD * S + 1.5; x < (MAP.COLS + PAD) * S - 1; x += 1.45) {
    const jx = x + (rnd() - 0.5) * 1.3, jz = z + (rnd() - 0.5) * 1.3;
    const dens = 0.42 + 0.5 * fbm(jx * 0.04 + 3, jz * 0.04 - 7, 3);
    const edge = jx < 4 || jx > MAP.COLS * S - 4 || jz > MAP.ROWS * S - 1 || jz < 3 ? 0.5 : 0;
    const village = jz > 76 && jx < 92 ? -0.12 : 0;
    if (rnd() < dens + edge + village) tryTree(jx, jz);
  }
  // bushes along path edges
  for (let i = 0; i < 900; i++) {
    const x = 2 + rnd() * (MAP.COLS * S - 4), z = 2 + rnd() * (MAP.ROWS * S - 4);
    const d = pathDist(x, z);
    if (d > 0.5 && d < 2.2 && rnd() < 0.7) tryTree(x, z, rnd() < 0.25 ? 'bushO' : 'bush');
  }
  // build instanced meshes per chunk
  const CH = 28;
  const groups = new Map();
  for (const t of placed) {
    const key = `${t.kind}|${t.v}|${Math.floor(t.x / CH)}|${Math.floor(t.z / CH)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v3 = new THREE.Vector3(), sc = new THREE.Vector3();
  const treeMeshes = [];
  for (const [key, list] of groups) {
    const [kind, v] = key.split('|');
    const geo = VARIANTS[kind][+v].geo;
    const im = new THREE.InstancedMesh(geo, P.M.leaf, list.length);
    const col = new THREE.Color();
    list.forEach((t, i) => {
      q.setFromEuler(e.set(0, t.rot, 0));
      m4.compose(v3.set(t.x, t.y - 0.05, t.z), q, sc.set(t.s, t.s * (0.92 + (i % 5) * 0.04), t.s));
      im.setMatrixAt(i, m4);
      const b = 0.92 + ((i * 37) % 17) / 100;
      im.setColorAt(i, col.setRGB(b, b, b * 0.98));
    });
    im.castShadow = true; im.receiveShadow = true;
    im.computeBoundingSphere();
    scene.add(im); treeMeshes.push(im);
  }
  console.log('trees', placed.length, 'meshes', treeMeshes.length);

  // ---- rocks (decor + colliders)
  const rockGeos = [0, 1, 2, 3].map(i => P.rockGeometry(i + 3, 1, true));
  const rockList = [];
  for (const p of MAP.PATCHES) p.rows.forEach((row, dr) => [...row].forEach((ch, dc) => {
    if (ch !== '#') return;
    const x = (p.c0 + dc + 0.5) * S, z = (p.r0 + dr + 0.5) * S;
    rockList.push({ x, z, s: 1.3 + rnd() * 0.3, v: rnd() * 4 | 0 });
    colliders.add({ x0: x - 1, x1: x + 1, z0: z - 1, z1: z + 1, rock: true });
  }));
  for (let i = 0; i < 260; i++) {
    const x = 3 + rnd() * (MAP.COLS * S - 6), z = 3 + rnd() * (MAP.ROWS * S - 6);
    if (nearWater(x, z, 0.8) || isExcluded(x, z) || coarseClear(x, z) || pathDist(x, z) < 0.6 || main.flatness(x, z, 0.4) > 0.3) continue;
    const s = 0.35 + rnd() * rnd() * 1.1;
    rockList.push({ x, z, s, v: rnd() * 4 | 0 });
    if (s > 0.6) colliders.add({ x, z, r: s * 0.42 });
  }
  // shore rocks around water
  for (let i = 0; i < 700; i++) {
    const x = 3 + rnd() * (MAP.COLS * S - 6), z = 3 + rnd() * (MAP.ROWS * S - 6);
    if (main.isWater(x, z) || !nearWater(x, z, 0.7) || isExcluded(x, z, -0.6) || pathDist(x, z) < 0.2) continue;
    rockList.push({ x, z, s: 0.3 + rnd() * 0.45, v: rnd() * 4 | 0 });
  }
  for (const [c, r] of MAP.STONES) {
    const x = (c + 0.5) * S, z = (r + 0.5) * S;
    rockList.push({ x, z, s: 1.7, v: 1, y: main.waterSurfaceAt(x, z) - 0.55, flat: true });
  }
  for (let v = 0; v < 4; v++) {
    const list = rockList.filter(r => r.v === v);
    const im = new THREE.InstancedMesh(rockGeos[v], P.M.vc, list.length);
    list.forEach((r, i) => {
      q.setFromEuler(e.set(0, r.x * 7.1, 0));
      m4.compose(v3.set(r.x, r.y ?? main.heightAt(r.x, r.z) - 0.05, r.z), q, sc.set(r.s, r.flat ? r.s * 0.5 : r.s, r.s));
      im.setMatrixAt(i, m4);
    });
    im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); scene.add(im);
  }

  // ---- ground clutter (no shadows)
  const clutter = (geo, n, accept, colorFn, mat = P.M.vc, scl = [0.8, 1.3]) => {
    const pts = [];
    for (let i = 0; i < n * 3 && pts.length < n; i++) {
      const x = -PAD * S + rnd() * ((MAP.COLS + PAD * 2) * S), z = -PAD * S + rnd() * ((MAP.ROWS + PAD * 2) * S);
      if (main.isWater(x, z) || main.flatness(x, z, 0.12) > 0.12) continue;
      if (accept(x, z)) pts.push([x, z]);
    }
    const im = new THREE.InstancedMesh(geo, mat, pts.length);
    const col = new THREE.Color();
    pts.forEach(([x, z], i) => {
      const s = scl[0] + rnd() * (scl[1] - scl[0]);
      q.setFromEuler(e.set(0, rnd() * 6.28, 0));
      m4.compose(v3.set(x, main.heightAt(x, z), z), q, sc.set(s, s, s));
      im.setMatrixAt(i, m4);
      if (colorFn) im.setColorAt(i, colorFn(col, x, z));
    });
    im.receiveShadow = true; im.computeBoundingSphere(); scene.add(im);
    return im;
  };
  const offPath = (x, z) => pathDist(x, z) > 0.15;
  clutter(P.tuftGeometry(), 5200, (x, z) => offPath(x, z));
  const fl = [['#f2efe0', 0.4], ['#f2d14a', 0.3], ['#e07a9a', 0.15], ['#9ab0e8', 0.15]];
  for (const [c, f] of fl) clutter(P.flowerGeometry(c), Math.round(900 * f), (x, z) => offPath(x, z) && fbm(x * 0.09 + 31, z * 0.09, 2) > 0.1 && main.levelAt(x, z) < 4);
  const litter = new THREE.MeshToonMaterial({ gradientMap: gradient, side: THREE.DoubleSide });
  clutter(P.leafLitterGeometry(), 4200, (x, z) => fbm(x * 0.045 + 50, z * 0.045 - 20, 3) > 0.02 || pathDist(x, z) < 0.6,
    (c) => c.set(['#e07a2c', '#c9502a', '#eeb04a', '#d88a34', '#a8402a'][Math.floor(rnd() * 5)]), litter, [0.9, 1.6]);
  clutter(P.mushroomGeometry(), 160, (x, z) => offPath(x, z) && fbm(x * 0.05, z * 0.05 + 70, 2) > 0.15);

  // ---- fences along path edges over drops
  const fence = P.fenceGeometries();
  const posts = [], rails = [];
  for (const p of paths) {
    for (let s = 0; s < p.pts.length - 1; s++) {
      const [ax, az, ah] = p.pts[s], [bx, bz, bh] = p.pts[s + 1];
      const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 1.1));
      const nx = -(bz - az) / L, nz = (bx - ax) / L;
      for (const side of [-1, 1]) {
        let prev = null;
        for (let i = 0; i <= n; i++) {
          const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, h = ah + (bh - ah) * t;
          const px = x + nx * side * (p.w - 0.18), pz = z + nz * side * (p.w - 0.18);
          const ox2 = x + nx * side * (p.w + 0.55), oz2 = z + nz * side * (p.w + 0.55);
          const drop = h - main.heightAt(ox2, oz2);
          const ok = drop > 1.0 && !main.isWater(ox2, oz2) && pathDist(ox2, oz2) > 0.3 && !isExcluded(px, pz, -0.4);
          if (ok) {
            const y = main.heightAt(px, pz);
            const cur = [px, y, pz];
            posts.push(cur);
            colliders.add({ x: px, z: pz, r: 0.12 });
            if (prev) rails.push([prev, cur]);
            prev = cur;
          } else prev = null;
        }
      }
    }
  }
  {
    const im = new THREE.InstancedMesh(fence.post, P.M.vc, posts.length);
    posts.forEach(([x, y, z], i) => { m4.compose(v3.set(x, y, z), q.identity(), sc.set(1, 1, 1)); im.setMatrixAt(i, m4); });
    im.castShadow = true; im.computeBoundingSphere(); scene.add(im);
    const ir = new THREE.InstancedMesh(fence.rail, P.M.vc, rails.length * 2);
    rails.forEach(([a, b], i) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dz);
      q.setFromEuler(e.set(0, -Math.atan2(dz, dx), Math.atan2(dy, L)));
      for (const [k, hh] of [[0, 0.5], [1, 0.25]]) {
        m4.compose(v3.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + hh, (a[2] + b[2]) / 2), q, sc.set(Math.hypot(L, dy), 1, 1));
        ir.setMatrixAt(i * 2 + k, m4);
      }
    });
    ir.castShadow = true; ir.computeBoundingSphere(); scene.add(ir);
    // colliders between posts so the player can't squeeze off the ledge
    for (const [a, b] of rails) {
      const n = 3; for (let k = 1; k < n; k++) colliders.add({ x: a[0] + (b[0] - a[0]) * k / n, z: a[2] + (b[2] - a[2]) * k / n, r: 0.12 });
    }
  }

  // ---- houses
  const houses = {};
  for (const h of MAP.HOUSES) {
    const grp = P.buildHouse(h.style, h.w, h.d);
    const x = h.x * S, z = h.z * S;
    let y = Infinity; for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) y = Math.min(y, main.heightAt(x + a * h.w / 2, z + b * h.d / 2));
    grp.position.set(x, y, z); grp.rotation.y = h.rot || 0;
    scene.add(grp); houses[h.id] = grp;
    colliders.add({ x0: x - h.w / 2, x1: x + h.w / 2, z0: z - h.d / 2, z1: z + h.d / 2, house: h.id });
  }

  // ---- static decor
  const put = (obj, mx, mz, rot = 0, collR = 0, world = false) => {
    const x = world ? mx : mx * S, z = world ? mz : mz * S;
    obj.position.set(x, main.heightAt(x, z), z); obj.rotation.y = rot;
    obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(obj);
    if (collR) colliders.add({ x, z, r: collR });
    return obj;
  };
  const decor = {};
  decor.mailbox = put(P.mailbox(), 10.6, 45.4, 0, 0.25);
  put(P.bench(), 5.8, 45.0, 0.2, 0.5);
  put(P.barrel(), 10.0, 42.6, 0, 0.3); put(P.barrel(), 10.4, 42.9, 0, 0.3);
  put(P.crate(), 5.6, 43.0, 0.3, 0.4);
  put(P.cart(), 15.6, 43.4, -0.4, 0.8);
  put(P.clothesline(), 23.4, 38.6, 0.1, 0);
  put(P.crate(), 19.6, 38.8, 0, 0.4); put(P.barrel(), 19.4, 39.4, 0, 0.3);
  put(P.signpost('楓嶺村'), 17.2, 44.2, 0, 0.15);
  put(P.signpost('步道 →'), 19.4, 39.3, 0, 0.15);
  const dockX = 25.6 * S, dockZ = 42.6 * S;
  const dk = P.dock(4.4, 1.4); const dockY = (main.waterSurfaceAt(dockX + 1.4, dockZ) ?? 0) + 0.32; dk.position.set(dockX, dockY, dockZ); scene.add(dk);
  // lumberjack camp (east bank)
  decor.fire = put(P.campfire(), 37.4, 31.4, 0, 0.5);
  put(P.tent(), 39.4, 30.8, 0.3, 1.0);
  put(P.logPile(), 34.2, 30.4, 0.2, 0.9);
  put(P.crate(), 38.6, 33.0, 0.5, 0.4);
  put(P.signpost('伐木營地'), 32.6, 32.6, 0, 0.15);
  put(P.bench(), 36.2, 31.0, 0, 0.4);
  // level 2/3/summit details
  put(P.bench(), 25.4, 22.0, -0.2, 0.4);
  put(P.signpost('磨坊'), 37.4, 24.4, 0, 0.15);
  put(P.signpost('古燈林'), 17.6, 13.0, 0, 0.15);
  put(P.signpost('山頂 · 回音鐘'), 14.2, 6.0, 0, 0.15);
  put(P.bench(), 29.0, 3.4, 0.3, 0.4);
  put(P.shrine(), 51.2, 31.0, 0, 0.6);
  put(P.logPile(), 21.6, 24.6, 1.2, 0.9);
  for (const [x, z] of [[4.8, 12.8], [15.6, 15.8], [6.4, 15.6]]) put(P.crystal(0x9ad8c8), x, z, x, 0);

  return {
    canopies: placed.filter(t => !t.kind.startsWith('bush') && t.kind !== 'pine'),
    scene, main, cave, caveData, g, colliders, dockY: dockY + 0.07, heightAt, T, paths, pathDist, houses, decor, noiseTex, waterMat,
    bounds: { x0: 4.3, x1: MAP.COLS * S - 4, z0: 3.4, z1: MAP.ROWS * S - 0.6 }, PAD,
    put,
  };
}
