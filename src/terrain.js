// terrain.js — terraced terrain from a coarse level grid: fine height cells, cliff walls,
// water surfaces and waterfalls, plus height / walkability queries.
import * as THREE from 'three';
import { fbm, noise2 } from './noise.js';

const SMOOTH = 0.7;      // neighbour cells closer than this share corners (no wall)
const LIP = 0.22;        // grass lip at the top of every wall

export function buildTerrain(o) {
  const { cols, rows, cell = 2, step = 3, fs = 0.4, ox = 0, oz = 0 } = o;
  const NX = Math.round(cols * cell / fs), NZ = Math.round(rows * cell / fs);
  const per = Math.round(cell / fs);
  const H = new Float32Array(NX * NZ), W = new Uint8Array(NX * NZ), LV = new Int8Array(NX * NZ);
  const ST = new Uint8Array(NX * NZ);
  const bedDrop = o.bedDrop ?? 0.9, surfDrop = o.surfDrop ?? 0.32;
  const warpAmp = o.warpAmp ?? 1.25;

  // ---- 1. cell heights from (warped) coarse grid
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const mx = (i + 0.5) * fs / cell, mz = (j + 0.5) * fs / cell;   // coarse coords
    let wx = mx, wz = mz;
    if (warpAmp > 0 && !(o.noWarp && o.noWarp(mx, mz))) {
      wx += warpAmp * 0.5 * fbm(mx * 0.42 + 3.1, mz * 0.42 + 7.7, 3);
      wz += warpAmp * 0.5 * fbm(mx * 0.42 + 11.3, mz * 0.42 + 1.9, 3);
    }
    const c = Math.max(0, Math.min(cols - 1, Math.floor(wx))), r = Math.max(0, Math.min(rows - 1, Math.floor(wz)));
    const k = j * NX + i, L = o.level(c, r);
    LV[k] = L;
    if (o.water(c, r)) { W[k] = 1; H[k] = L * step - bedDrop; if (o.stone && o.stone(c, r)) ST[k] = 1; }
    else H[k] = L * step + (o.bump ? o.bump(ox + (i + 0.5) * fs, oz + (j + 0.5) * fs) : 0);
  }

  // ---- 2. paths (world coords) override heights; vertex splat for dirt
  const VX = NX + 1, VZ = NZ + 1;
  const splat = new Float32Array(VX * VZ);
  const best = new Float32Array(NX * NZ).fill(1e9);
  for (const p of o.paths || []) {
    for (let s = 0; s < p.pts.length - 1; s++) {
      const [ax, az, ah] = p.pts[s], [bx, bz, bh] = p.pts[s + 1], w = p.w;
      const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-6;
      const x0 = Math.min(ax, bx) - w - 1, x1 = Math.max(ax, bx) + w + 1, z0 = Math.min(az, bz) - w - 1, z1 = Math.max(az, bz) + w + 1;
      const i0 = Math.max(0, Math.floor((x0 - ox) / fs)), i1 = Math.min(NX - 1, Math.ceil((x1 - ox) / fs));
      const j0 = Math.max(0, Math.floor((z0 - oz) / fs)), j1 = Math.min(NZ - 1, Math.ceil((z1 - oz) / fs));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = ox + (i + 0.5) * fs, z = oz + (j + 0.5) * fs;
        let t = ((x - ax) * dx + (z - az) * dz) / L2; t = Math.max(0, Math.min(1, t));
        const d = Math.hypot(x - ax - dx * t, z - az - dz * t), k = j * NX + i;
        if (d < w && d < best[k] && !W[k]) { best[k] = d; H[k] = ah + (bh - ah) * t; }
      }
      // vertex splat
      for (let j = j0; j <= j1 + 1; j++) for (let i = i0; i <= i1 + 1; i++) {
        const x = ox + i * fs, z = oz + j * fs;
        let t = ((x - ax) * dx + (z - az) * dz) / L2; t = Math.max(0, Math.min(1, t));
        const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
        const v = Math.max(0, Math.min(1, (w + 0.05 - d) / 0.55 + 0.5));
        const k = j * VX + i; if (v > splat[k]) splat[k] = v;
      }
    }
  }
  for (const [cx, cz, rad] of o.dirtSpots || []) {
    const i0 = Math.max(0, Math.floor((cx - rad - 1 - ox) / fs)), i1 = Math.min(NX, Math.ceil((cx + rad + 1 - ox) / fs));
    const j0 = Math.max(0, Math.floor((cz - rad - 1 - oz) / fs)), j1 = Math.min(NZ, Math.ceil((cz + rad + 1 - oz) / fs));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const d = Math.hypot(ox + i * fs - cx, oz + j * fs - cz);
      const v = Math.max(0, Math.min(1, (rad - d) / 0.8 + 0.5)), k = j * VX + i;
      if (v > splat[k]) splat[k] = v;
    }
  }
  if (o.splatAll != null) for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const v = o.splatAll(LV[j * NX + i]);
    if (v != null) for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) splat[(j + b) * VX + i + a] = Math.max(splat[(j + b) * VX + i + a], v);
  }

  // ---- 3. per-cell corner heights
  const CH = new Float32Array(NX * NZ * 4);
  const cornerOf = (i, j, vi, vj, h) => {
    let s = 0, n = 0;
    for (let b = vj - 1; b <= vj; b++) for (let a = vi - 1; a <= vi; a++) {
      if (a < 0 || b < 0 || a >= NX || b >= NZ) continue;
      const k = b * NX + a;
      if (W[k] !== W[j * NX + i]) continue;
      const hh = H[k];
      if (Math.abs(hh - h) < SMOOTH) { s += hh; n++; }
    }
    return n ? s / n : h;
  };
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const k = j * NX + i, h = H[k];
    CH[k * 4] = cornerOf(i, j, i, j, h); CH[k * 4 + 1] = cornerOf(i, j, i + 1, j, h);
    CH[k * 4 + 2] = cornerOf(i, j, i + 1, j + 1, h); CH[k * 4 + 3] = cornerOf(i, j, i, j + 1, h);
  }

  // ---- 4. water distance-to-shore (cells), waterfall feet
  const shore = new Uint8Array(NX * NZ).fill(0);
  {
    const q = [];
    for (let k = 0; k < NX * NZ; k++) if (W[k]) {
      const i = k % NX, j = (k / NX) | 0;
      let edge = false;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= NX || jj >= NZ) continue;
        if (!W[jj * NX + ii]) edge = true;
      }
      shore[k] = edge ? 1 : 9; if (edge) q.push(k);
    }
    for (let qi = 0; qi < q.length; qi++) {
      const k = q[qi], i = k % NX, j = (k / NX) | 0;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= NX || jj >= NZ) continue;
        const kk = jj * NX + ii;
        if (W[kk] && shore[kk] > shore[k] + 1) { shore[kk] = shore[k] + 1; q.push(kk); }
      }
    }
  }
  const surf = k => H[k] + bedDrop - surfDrop;
  const foam = new Uint8Array(NX * NZ);

  // ---- 5. geometry
  const G = { p: [], n: [], s: [], c: [] };          // ground
  const C = { p: [], n: [], uv: [], c: [] };         // cliff
  const Wt = { p: [], s: [], f: [] };                // water
  const F = { p: [], uv: [], h: [] };                // falls
  const tint = (x, z) => {
    const a = fbm(x * 0.035, z * 0.035, 3), b = noise2(x * 0.11 + 5, z * 0.11 + 9);
    const m = 1 + a * 0.16 + b * 0.05;
    return [m * (1 + a * 0.05), m, m * (1 - a * 0.08)];
  };
  const tintMul = o.tintMul || [1, 1, 1];
  const pushGround = (pts, sp, nrm) => {
    for (const idx of [0, 1, 2, 0, 2, 3]) {
      const q = pts[idx];
      G.p.push(q[0], q[1], q[2]); G.n.push(nrm[0], nrm[1], nrm[2]); G.s.push(sp[idx]);
      const t = tint(q[0], q[2]); G.c.push(t[0] * tintMul[0], t[1] * tintMul[1], t[2] * tintMul[2]);
    }
  };
  const v3 = new THREE.Vector3(), v4 = new THREE.Vector3(), v5 = new THREE.Vector3();
  const faceNormal = (a, b, c) => {
    v3.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); v4.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    return v5.crossVectors(v3, v4).normalize().toArray();
  };

  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const k = j * NX + i, x0 = ox + i * fs, z0 = oz + j * fs, x1 = x0 + fs, z1 = z0 + fs;
    const c = [CH[k * 4], CH[k * 4 + 1], CH[k * 4 + 2], CH[k * 4 + 3]];
    const pts = [[x0, c[0], z0], [x1, c[1], z0], [x1, c[2], z1], [x0, c[3], z1]];
    // winding: (p0,p3,p2),(p0,p2,p1) gives +Y normal for x right / z down
    const ordered = [pts[0], pts[3], pts[2], pts[1]];
    const sp = [splat[j * VX + i], splat[(j + 1) * VX + i], splat[(j + 1) * VX + i + 1], splat[j * VX + i + 1]];
    pushGround(ordered, sp, faceNormal(ordered[0], ordered[1], ordered[2]));
    if (W[k]) {
      const y = surf(k);
      const sh = shore[k];
      for (const q of [[x0, z0], [x0, z1], [x1, z1], [x0, z0], [x1, z1], [x1, z0]]) { Wt.p.push(q[0], y, q[1]); Wt.s.push(sh); Wt.f.push(0); }
    }
  }
  const wallSeg = (a1, a2, b1, b2, e0, e1, axis, fixed, normalSign, topIsWater, lowIsWater, topK, lowK) => {
    // a* = high side corner heights at edge ends e0,e1 ; b* = low side
    const P = (e, y) => axis === 'x' ? [fixed, y, e] : [e, y, fixed];
    const want = axis === 'x' ? [normalSign, 0, 0] : [0, 0, normalSign];
    const top0 = a1, top1 = a2, bot0 = b1, bot1 = b2;
    const hgt = Math.max(top0 - bot0, top1 - bot1);
    if (hgt < 0.02) return;
    // waterfall
    if (topIsWater) {
      const ys0 = surf(topK), ysLow = lowIsWater ? surf(lowK) : Math.min(bot0, bot1);
      if (ys0 - ysLow > 0.4) {
        const off = normalSign * 0.06;
        const Q = (e, y) => axis === 'x' ? [fixed + off, y, e] : [e, y, fixed + off];
        const q = [Q(e0, ys0), Q(e1, ys0), Q(e1, ysLow), Q(e0, ysLow)];
        let tri = [0, 1, 2, 0, 2, 3];
        const nn = faceNormal(q[0], q[1], q[2]);
        if (nn[0] * want[0] + nn[2] * want[2] < 0) tri = [0, 2, 1, 0, 3, 2];
        const uvs = [[e0, ys0], [e1, ys0], [e1, ysLow], [e0, ysLow]];
        for (const t of tri) { F.p.push(...q[t]); F.uv.push(uvs[t][0], uvs[t][1]); F.h.push(t < 2 ? ys0 - ysLow : 0); }
        if (lowIsWater) foam[lowK] = 1;
      }
    }
    // rock wall, split into bands so the AO gradient sits at the foot
    const nb = Math.max(1, Math.ceil(hgt / 0.7));
    for (let b = 0; b < nb; b++) {
      const f0 = b / nb, f1 = (b + 1) / nb;
      const y00 = bot0 + (top0 - bot0) * f0, y01 = bot1 + (top1 - bot1) * f0;
      const y10 = bot0 + (top0 - bot0) * f1, y11 = bot1 + (top1 - bot1) * f1;
      const isLip = b === nb - 1 && !topIsWater;
      const lipY0 = Math.max(y00, top0 - LIP), lipY1 = Math.max(y01, top1 - LIP);
      const q = [P(e0, y00), P(e1, y01), P(e1, isLip ? lipY1 : y11), P(e0, isLip ? lipY0 : y10)];
      let tri = [0, 1, 2, 0, 2, 3];
      const nn = faceNormal(q[0], q[1], q[2]);
      if (nn[0] * want[0] + nn[2] * want[2] < 0) tri = [0, 2, 1, 0, 3, 2];
      for (const t of tri) {
        const p = q[t]; C.p.push(p[0], p[1], p[2]); C.n.push(want[0], 0, want[2]);
        C.uv.push((axis === 'x' ? p[2] : p[0]) / 8, p[1] / 8);
        const rel = (p[1] - Math.min(bot0, bot1)) / 1.5;
        const ao = 0.6 + 0.4 * Math.min(1, Math.max(0, rel));
        const sh = axis === 'x' ? 0.86 : 1.0;  // side walls a touch darker
        C.c.push(ao * sh, ao * sh, ao * sh * 1.02);
      }
      if (isLip) {
        const L = [P(e0, lipY0), P(e1, lipY1), P(e1, top1), P(e0, top0)];
        const o2 = normalSign * 0.035;
        for (const p of L) { if (axis === 'x') p[0] += o2; else p[2] += o2; }
        let tl = [0, 1, 2, 0, 2, 3];
        const n2 = faceNormal(L[0], L[1], L[2]);
        if (n2[0] * want[0] + n2[2] * want[2] < 0) tl = [0, 2, 1, 0, 3, 2];
        const spv = best[topK] < 1e8 ? 1 : 0;
        for (const t of tl) {
          const p = L[t]; G.p.push(p[0], p[1], p[2]); G.n.push(0, 1, 0); G.s.push(spv);
          G.c.push(0.78, 0.8, 0.72);
        }
      }
    }
  };
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const k = j * NX + i;
    if (i + 1 < NX) { // east edge
      const kb = k + 1, x = ox + (i + 1) * fs, z0 = oz + j * fs, z1 = z0 + fs;
      const a1 = CH[k * 4 + 1], a2 = CH[k * 4 + 2], b1 = CH[kb * 4], b2 = CH[kb * 4 + 3];
      if (Math.abs(a1 - b1) > 1e-3 || Math.abs(a2 - b2) > 1e-3) {
        if (a1 + a2 > b1 + b2) wallSeg(a1, a2, b1, b2, z0, z1, 'x', x, 1, W[k] && !W[kb] || (W[k] && W[kb] && H[k] > H[kb]), !!W[kb], k, kb);
        else wallSeg(b1, b2, a1, a2, z0, z1, 'x', x, -1, W[kb] && !W[k] || (W[k] && W[kb] && H[kb] > H[k]), !!W[k], kb, k);
      }
    }
    if (j + 1 < NZ) { // south edge
      const kb = k + NX, z = oz + (j + 1) * fs, x0 = ox + i * fs, x1 = x0 + fs;
      const a1 = CH[k * 4 + 3], a2 = CH[k * 4 + 2], b1 = CH[kb * 4], b2 = CH[kb * 4 + 1];
      if (Math.abs(a1 - b1) > 1e-3 || Math.abs(a2 - b2) > 1e-3) {
        if (a1 + a2 > b1 + b2) wallSeg(a1, a2, b1, b2, x0, x1, 'z', z, 1, W[k] && !W[kb] || (W[k] && W[kb] && H[k] > H[kb]), !!W[kb], k, kb);
        else wallSeg(b1, b2, a1, a2, x0, x1, 'z', z, -1, W[kb] && !W[k] || (W[k] && W[kb] && H[kb] > H[k]), !!W[k], kb, k);
      }
    }
  }
  // spread waterfall foam a little
  {
    const f2 = foam.slice();
    for (let j = 1; j < NZ - 1; j++) for (let i = 1; i < NX - 1; i++) {
      const k = j * NX + i; if (!W[k] || foam[k]) continue;
      let n = 0; for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) { const ii = i + a, jj = j + b; if (ii >= 0 && jj >= 0 && ii < NX && jj < NZ && foam[jj * NX + ii]) n++; }
      if (n) f2[k] = n > 2 ? 2 : 3;
    }
    // rewrite water foam attribute
    let w = 0;
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const k = j * NX + i; if (!W[k]) continue;
      const v = f2[k] === 1 ? 1 : f2[k] === 2 ? 0.6 : f2[k] === 3 ? 0.3 : 0;
      for (let t = 0; t < 6; t++) Wt.f[w++] = v;
    }
  }

  const geo = (arrs) => {
    const g = new THREE.BufferGeometry();
    for (const [name, arr, n] of arrs) g.setAttribute(name, new THREE.Float32BufferAttribute(arr, n));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  };
  const groundGeo = geo([['position', G.p, 3], ['normal', G.n, 3], ['splat', G.s, 1], ['color', G.c, 3]]);
  const cliffGeo = geo([['position', C.p, 3], ['normal', C.n, 3], ['uv', C.uv, 2], ['color', C.c, 3]]);
  const waterGeo = Wt.p.length ? geo([['position', Wt.p, 3], ['shore', Wt.s, 1], ['foam', Wt.f, 1]]) : null;
  const fallGeo = F.p.length ? geo([['position', F.p, 3], ['uv', F.uv, 2], ['fallh', F.h, 1]]) : null;

  // ---- 6. queries
  const cellIdx = (x, z) => {
    const i = Math.floor((x - ox) / fs), j = Math.floor((z - oz) / fs);
    if (i < 0 || j < 0 || i >= NX || j >= NZ) return -1;
    return j * NX + i;
  };
  const heightAt = (x, z) => {
    const fx = (x - ox) / fs, fz = (z - oz) / fs;
    const i = Math.max(0, Math.min(NX - 1, Math.floor(fx))), j = Math.max(0, Math.min(NZ - 1, Math.floor(fz)));
    const u = Math.min(1, Math.max(0, fx - i)), v = Math.min(1, Math.max(0, fz - j)), k = (j * NX + i) * 4;
    const top = CH[k] + (CH[k + 1] - CH[k]) * u, bot = CH[k + 3] + (CH[k + 2] - CH[k + 3]) * u;
    return top + (bot - top) * v;
  };
  return {
    NX, NZ, fs, ox, oz, per, step, H, W, LV, ST, CH, surf,
    groundGeo, cliffGeo, waterGeo, fallGeo, cellIdx, heightAt,
    waterSurfaceAt(x, z) { const k = cellIdx(x, z); return k >= 0 && W[k] ? surf(k) : null; },
    isWater(x, z) { const k = cellIdx(x, z); return k >= 0 && W[k] === 1; },
    levelAt(x, z) { const k = cellIdx(x, z); return k >= 0 ? LV[k] : 0; },
    rawH(x, z) { const k = cellIdx(x, z); return k >= 0 ? H[k] : 0; },
    flatness(x, z, r) { // max height deviation in radius
      const h0 = heightAt(x, z); let m = 0;
      for (const [a, b] of [[r, 0], [-r, 0], [0, r], [0, -r], [r * .7, r * .7], [-r * .7, r * .7], [r * .7, -r * .7], [-r * .7, -r * .7]]) {
        const k = cellIdx(x + a, z + b); if (k < 0) return 99;
        if (W[k]) return 99;
        m = Math.max(m, Math.abs(heightAt(x + a, z + b) - h0));
      }
      return m;
    },
  };
}

// --------------------------------------------------------------------------------------------
// materials
export function makeGradient(stops = [90, 170, 255]) {
  const d = new Uint8Array(stops.length * 4);
  stops.forEach((v, i) => { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; });
  const t = new THREE.DataTexture(d, stops.length, 1, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}

export function makeNoiseTex(size = 64) {
  const d = new Uint8Array(size * size * 4);
  const g = new Float32Array(8 * 8).map((_, i) => ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1);
  const sm = t => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const fx = x / size * 8, fy = y / size * 8, x0 = Math.floor(fx), y0 = Math.floor(fy);
    const v = (i, j) => g[(j & 7) * 8 + (i & 7)];
    const tx = sm(fx - x0), ty = sm(fy - y0);
    const a = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * tx, b = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * tx;
    const fine = ((Math.sin((x * 7 + y * 13) * 0.917) * 43758.5) % 1 + 1) % 1;
    const val = (a + (b - a) * ty) * 0.8 + fine * 0.2;
    const i = (y * size + x) * 4; d[i] = d[i + 1] = d[i + 2] = Math.round(val * 255); d[i + 3] = 255;
  }
  const t = new THREE.DataTexture(d, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

export function groundMaterial({ grassTex, dirtTex, noiseTex, gradient, uniforms }) {
  const m = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gradient });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.grassMap = { value: grassTex };
    sh.uniforms.dirtMap = { value: dirtTex };
    sh.uniforms.noiseMap = { value: noiseTex };
    sh.uniforms.uTime = uniforms.uTime;
    sh.uniforms.uCloud = uniforms.uCloud;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float splat;\nvarying float vSplat;\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSplat = splat;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D grassMap; uniform sampler2D dirtMap; uniform sampler2D noiseMap; uniform float uTime; uniform float uCloud;
varying float vSplat; varying vec3 vWPos;
float bayer4(vec2 p){ ivec2 q = ivec2(mod(p, 4.0)); int i = q.x + q.y*4;
  float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.); return m[i]/16.; }`)
      .replace('#include <map_fragment>', `
vec2 wuv = vWPos.xz / 8.0;
vec4 gC = texture2D(grassMap, wuv);
vec4 dC = texture2D(dirtMap, wuv);
float jit = texture2D(noiseMap, vWPos.xz * 0.31).r - 0.5;
float sAmt = vSplat + jit * 0.42;
float sDirt = step(0.5, sAmt);
float sEdge = step(0.38, sAmt) - sDirt;
vec4 tex = mix(gC, dC, sDirt);
tex.rgb *= 1.0 - sEdge * 0.16;
diffuseColor *= tex;
float cl = texture2D(noiseMap, vWPos.xz * 0.011 + vec2(uTime * 0.0035, uTime * 0.0012)).r;
cl += (bayer4(gl_FragCoord.xy) - 0.5) * 0.06;
diffuseColor.rgb *= mix(1.0, 0.8, step(0.6, cl) * uCloud);
`);
  };
  return m;
}

export function waterMaterial(uniforms, noiseTex, cave = false) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime, noiseMap: { value: noiseTex }, uDark: { value: cave ? 1 : 0 } },
    vertexShader: `attribute float shore; attribute float foam; varying float vShore; varying float vFoam; varying vec3 vW;
      void main(){ vShore = shore; vFoam = foam; vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform sampler2D noiseMap; uniform float uDark; varying float vShore; varying float vFoam; varying vec3 vW;
      void main(){
        vec3 deep = vec3(0.13,0.30,0.33), mid = vec3(0.22,0.43,0.43), lite = vec3(0.37,0.60,0.56), foamC = vec3(0.80,0.90,0.82);
        float d = clamp((vShore - 1.0) / 5.0, 0.0, 1.0);
        vec3 c = mix(lite, mid, step(0.2, d));
        c = mix(c, deep, step(0.7, d));
        vec2 p = vW.xz;
        float n1 = texture2D(noiseMap, p * 0.09 + vec2(uTime * 0.02, uTime * 0.013)).r;
        float n2 = texture2D(noiseMap, p * 0.23 - vec2(uTime * 0.03, -uTime * 0.021)).r;
        float rip = step(0.78, n1 * 0.6 + n2 * 0.55);
        c = mix(c, lite + 0.06, rip * 0.7);
        float sp = step(0.93, n2 * 0.7 + texture2D(noiseMap, p * 0.6 + uTime * 0.05).r * 0.4);
        c = mix(c, foamC, sp * 0.8);
        float edgeFoam = step(vShore, 1.5) * step(0.45, texture2D(noiseMap, p * 0.5 + vec2(uTime * 0.04)).r);
        c = mix(c, foamC, edgeFoam * 0.85);
        float ff = vFoam * step(0.35, texture2D(noiseMap, p * 0.7 + vec2(0.0, -uTime * 0.25)).r + vFoam * 0.4);
        c = mix(c, foamC, clamp(ff, 0.0, 1.0));
        if (uDark > 0.5) c *= 0.55;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

export function fallMaterial(uniforms, noiseTex) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime, noiseMap: { value: noiseTex } },
    vertexShader: `attribute float fallh; varying vec2 vUv; varying float vH;
      void main(){ vUv = uv; vH = fallh; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform float uTime; uniform sampler2D noiseMap; varying vec2 vUv; varying float vH;
      void main(){
        float x = floor(vUv.x * 16.0) / 16.0;
        float s = texture2D(noiseMap, vec2(x * 0.35, vUv.y * 0.05 + uTime * 0.55)).r;
        float s2 = texture2D(noiseMap, vec2(x * 0.9 + 0.3, vUv.y * 0.11 + uTime * 0.9)).r;
        vec3 a = vec3(0.47,0.70,0.68), b = vec3(0.70,0.86,0.82), w = vec3(0.92,0.97,0.93);
        vec3 c = mix(a, b, step(0.5, s));
        c = mix(c, w, step(0.62, s2 * 0.7 + s * 0.4));
        float edge = step(0.75, fract(vUv.x * 2.0 + s * 0.3));
        c = mix(c, a * 0.8, edge * 0.4);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}
