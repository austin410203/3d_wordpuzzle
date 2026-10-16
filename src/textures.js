// textures.js — procedural pixel-art textures (16 texels per world unit)
import * as THREE from 'three';
import { mulberry } from './noise.js';

const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function canvasTex(w, h, draw, { repeat = true, srgb = true } = {}) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  const set = (x, y, c, a = 255) => {
    x = ((x % w) + w) % w; y = ((y % h) + h) % h;
    const i = (y * w + x) * 4; img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = a;
  };
  const get = (x, y) => { x = ((x % w) + w) % w; y = ((y % h) + h) % h; const i = (y * w + x) * 4; return [img.data[i], img.data[i + 1], img.data[i + 2]]; };
  draw({ set, get, w, h });
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.userData.canvas = cv;
  return t;
}

// periodic value noise for tileable textures
function tnoise(size, cells, rnd) {
  const g = new Float32Array(cells * cells).map(() => rnd());
  const sm = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = (x / size) * cells, fy = (y / size) * cells;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = sm(fx - x0), ty = sm(fy - y0);
    const v = (i, j) => g[((j % cells + cells) % cells) * cells + ((i % cells + cells) % cells)];
    const a = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * tx;
    const b = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * tx;
    return a + (b - a) * ty;
  };
}

export const PAL = {
  grass: ['#4d5a24', '#5c6b2b', '#6b7a32', '#7c8a3a', '#929a45', '#a8a852'],
  dirt: ['#7d5230', '#93623a', '#a87444', '#bb8650', '#cf9d62', '#e0b67a'],
  cliff: ['#4a3122', '#664530', '#80593b', '#9a6e48', '#b28457', '#c89b68', '#d9b07c'],
};

export function makeGrassTex() {
  return canvasTex(128, 128, ({ set, w, h }) => {
    const r = mulberry(11), n1 = tnoise(128, 8, r), n2 = tnoise(128, 32, r);
    const C = PAL.grass.map(hex);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = n1(x, y) * 0.6 + n2(x, y) * 0.4 + (r() - 0.5) * 0.18;
      const k = v < 0.33 ? 1 : v < 0.5 ? 2 : v < 0.68 ? 3 : 4;
      set(x, y, C[k]);
    }
    // grass blade strokes: dark tip under light blade (reads as tufts from above)
    for (let i = 0; i < 520; i++) {
      const x = Math.floor(r() * w), y = Math.floor(r() * h), tall = r() < 0.5 ? 2 : 3;
      const light = r() < 0.55;
      for (let k = 0; k < tall; k++) set(x, y - k, C[light ? 4 + (k === tall - 1 && r() < 0.5 ? 1 : 0) : 1]);
      if (light) set(x, y + 1, C[1]);
      if (r() < 0.3) { set(x + 1, y - 1, C[light ? 4 : 1]); }
    }
    for (let i = 0; i < 60; i++) { // tiny flowers / seeds
      const x = Math.floor(r() * w), y = Math.floor(r() * h);
      set(x, y, r() < 0.5 ? [214, 196, 120] : [196, 206, 120]);
    }
  });
}

export function makeDirtTex() {
  return canvasTex(128, 128, ({ set, w, h }) => {
    const r = mulberry(23), n1 = tnoise(128, 8, r), n2 = tnoise(128, 32, r);
    const C = PAL.dirt.map(hex);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = n1(x, y) * 0.55 + n2(x, y) * 0.45 + (r() - 0.5) * 0.12;
      set(x, y, C[v < 0.3 ? 1 : v < 0.52 ? 2 : v < 0.72 ? 3 : 4]);
    }
    for (let i = 0; i < 140; i++) { // pebbles
      const x = Math.floor(r() * w), y = Math.floor(r() * h), big = r() < 0.3;
      set(x, y, C[5]); if (big) set(x + 1, y, C[5]);
      set(x, y + 1, C[0]); if (big) set(x + 1, y + 1, C[1]);
    }
    for (let i = 0; i < 40; i++) { // rut scratches
      const x = Math.floor(r() * w), y = Math.floor(r() * h), L = 3 + Math.floor(r() * 5);
      for (let k = 0; k < L; k++) set(x + k, y, C[1]);
    }
  });
}

export function makeCliffTex() {
  return canvasTex(128, 128, ({ set, get, w, h }) => {
    const r = mulberry(37);
    const C = PAL.cliff.map(hex);
    // vertical rock columns, wrapping horizontally
    let x = 0;
    const cols = [];
    while (x < w) { const cw = 5 + Math.floor(r() * 10); cols.push([x, Math.min(cw, w - x)]); x += cw; }
    for (const [x0, cw] of cols) {
      const base = 2 + Math.floor(r() * 3); // 2..4
      const breaks = [];
      let y = Math.floor(r() * 30);
      while (y < h) { breaks.push(y); y += 18 + Math.floor(r() * 34); }
      for (let yy = 0; yy < h; yy++) {
        // which segment → slight tone shift per segment
        let seg = 0; for (const b of breaks) if (yy >= b) seg++;
        const tone = Math.max(1, Math.min(5, base + ((seg * 7 + x0) % 3 === 0 ? 1 : 0) - ((seg * 5) % 4 === 0 ? 1 : 0)));
        for (let k = 0; k < cw; k++) {
          let t = tone;
          if (k === 0) t = Math.min(6, tone + 2);          // lit left edge
          else if (k === 1) t = Math.min(6, tone + 1);
          else if (k >= cw - 2) t = Math.max(1, tone - 1);   // shaded right side
          if (r() < 0.06) t = Math.max(1, t - 1);
          set(x0 + k, yy, C[t]);
        }
        set(x0 + cw - 1, yy, C[0]);                         // crack between columns
      }
      for (const b of breaks) { // horizontal ledge: dark line, light line under
        for (let k = 0; k < cw - 1; k++) { set(x0 + k, b, C[1]); set(x0 + k, b + 1, C[Math.min(6, base + 2)]); }
      }
    }
    // occasional deep cracks
    for (let i = 0; i < 14; i++) {
      let cx = Math.floor(r() * w), cy = Math.floor(r() * h);
      for (let k = 0; k < 8 + r() * 14; k++) { set(cx, cy, C[0]); cy++; if (r() < 0.3) cx += r() < 0.5 ? -1 : 1; }
    }
    void get;
  });
}

export function makeRoofTex(colA = '#d9893a', colB = '#a85a24', colC = '#f0aa58') {
  return canvasTex(64, 64, ({ set, w, h }) => {
    const r = mulberry(51); const A = hex(colA), B = hex(colB), Cc = hex(colC);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const row = Math.floor(y / 5), off = (row % 2) * 3, yy = y % 5;
      const seam = ((x + off) % 6) === 0;
      let c = A;
      if (yy === 4 || seam) c = B; else if (yy === 0) c = Cc; else if (r() < 0.07) c = B;
      set(x, y, c);
    }
  });
}

export function makePlankTex(colA = '#a63a2c', colB = '#6e2620', colC = '#c4553e', vertical = true) {
  return canvasTex(64, 64, ({ set, w, h }) => {
    const r = mulberry(61); const A = hex(colA), B = hex(colB), Cc = hex(colC);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = vertical ? x : y, v = vertical ? y : x;
      const k = u % 5;
      let c = k === 0 ? B : k === 1 ? Cc : A;
      if (r() < 0.04) c = B;
      if ((v + Math.floor(u / 5) * 13) % 37 === 0) c = B; // plank ends
      set(x, y, c);
    }
  });
}

export function makeStoneTex() {
  return canvasTex(64, 64, ({ set, w, h }) => {
    const r = mulberry(71), n = tnoise(64, 8, r);
    const C = ['#5d5a52', '#77746a', '#8f8b7e', '#a7a291', '#bdb7a3'].map(hex);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = n(x, y) + (r() - 0.5) * 0.25;
      set(x, y, C[v < 0.3 ? 1 : v < 0.55 ? 2 : v < 0.75 ? 3 : 4]);
    }
    for (let i = 0; i < 30; i++) { const x = r() * w | 0, y = r() * h | 0; set(x, y, C[0]); set(x + 1, y, C[0]); }
  });
}

// grayscale-ish multiplier for foliage (≈0.8 average so vertex colours carry the hue)
export function makeLeafTex() {
  return canvasTex(64, 64, ({ set, w, h }) => {
    const r = mulberry(83);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) set(x, y, [205, 205, 205]);
    for (let i = 0; i < 260; i++) { // leaf clumps: light arc on top, dark under
      const x = r() * w | 0, y = r() * h | 0;
      set(x, y, [255, 255, 255]); set(x + 1, y, [240, 240, 240]); set(x - 1, y + 1, [230, 230, 230]);
      set(x, y + 1, [160, 160, 160]); set(x + 1, y + 1, [150, 150, 150]);
    }
    for (let i = 0; i < 90; i++) { const x = r() * w | 0, y = r() * h | 0; set(x, y, [130, 130, 130]); }
  });
}

// a few pixel icons for the UI, drawn from string art → data URL
export function pixelIcon(art, colors, scale = 3) {
  const h = art.length, w = art[0].length;
  const cv = document.createElement('canvas'); cv.width = w * scale; cv.height = h * scale;
  const ctx = cv.getContext('2d');
  art.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.' || !colors[ch]) return;
    ctx.fillStyle = colors[ch]; ctx.fillRect(x * scale, y * scale, scale, scale);
  }));
  return cv.toDataURL();
}
