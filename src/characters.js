// characters.js — chibi hikers / villagers / cat, built from primitives + simple procedural animation
import * as THREE from 'three';

let GRAD;
export function initCharacters(gradient) { GRAD = gradient; }
const matCache = new Map();
const T = (c) => {
  if (!matCache.has(c)) matCache.set(c, new THREE.MeshToonMaterial({ color: c, gradientMap: GRAD }));
  return matCache.get(c);
};
const mesh = (geo, c, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, T(c)); m.position.set(x, y, z); m.castShadow = true; return m; };
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);

export const LOOKS = {
  player: { skin: 0xf2c79a, hair: 0x4a2c1c, top: 0x3f7a5a, top2: 0x2f5e45, pants: 0x3a3f5a, shoes: 0x5a3a24, hat: 'beanie', hatC: 0xd8582e, pack: true, scarf: 0xe8b84a },
  amei: { skin: 0xeec09a, hair: 0xd8d4cc, top: 0x8a5a9a, top2: 0x6a4078, pants: 0x5a4a6a, shoes: 0x4a3426, hat: 'bun', shawl: 0xd88a4a, stoop: 0.12 },
  wang: { skin: 0xd9a678, hair: 0x5a5048, top: 0x4a6a8a, top2: 0x3a5270, pants: 0x5a5040, shoes: 0x3a2a1a, hat: 'straw', beard: 0x8a8278, belly: true },
  chen: { skin: 0xd99a6a, hair: 0x2a1a12, top: 0xb23a2a, top2: 0x7a2418, pants: 0x3a4a5a, shoes: 0x3a2a1a, hat: 'cap', hatC: 0x3a5a3a, beard: 0x2a1a12, big: 1.15, plaid: true },
  song: { skin: 0xf0c49a, hair: 0x2a2a2a, top: 0xe8dcc0, top2: 0xb8a888, pants: 0x6a5038, shoes: 0x3a2a1a, hat: 'none', apron: 0x7a5a3a },
  yu: { skin: 0xf4d0a8, hair: 0x8a3a2a, top: 0xd8b03a, top2: 0xa8862a, pants: 0x2f3a4a, shoes: 0x7a3a2a, hat: 'cap', hatC: 0x2f5a7a, pack: true, ponytail: true },
  grandpa: { skin: 0xe8b890, hair: 0xe8e4dc, top: 0x5a6a3a, top2: 0x48562e, pants: 0x4a4038, shoes: 0x3a2a1a, hat: 'ranger', hatC: 0x6a5a3a, beard: 0xe8e4dc, pack: true },
};

// Voxel "mini-fig" chibi: cube head ≈ half the height, block hair with a notched fringe,
// tall rectangle eyes, small boxy body and stubby legs. 1 voxel = V units.
const V = 0.075;
function vox(parent, x, y, z, w, h, d, c) { // voxel coords: x,z centred on the part pivot, y up from pivot
  const m = mesh(B(w * V, h * V, d * V), c, (x + w / 2) * V, (y + h / 2) * V, (z + d / 2) * V);
  parent.add(m); return m;
}
export function buildCharacter(look) {
  const L = look, root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const big = L.big || 1;
  const shade = (c, f) => { const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255; return (Math.min(255, Math.round(r * f)) << 16) | (Math.min(255, Math.round(g * f)) << 8) | Math.min(255, Math.round(b * f)); };
  // legs (pivot at hip)
  const legs = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(sx * 1.1 * V, 3 * V, 0); body.add(leg);
    vox(leg, -1, -3, -1, 2, 2, 2, L.pants); vox(leg, -1, -3.6, -1.2, 2, 1, 2.6, L.shoes);
    legs.push(leg);
  }
  // torso
  const torso = new THREE.Group(); torso.position.y = 3 * V; body.add(torso);
  const tw = Math.round(6 * big);
  vox(torso, -tw / 2, 0, -2, tw, 5, 4, L.top);
  vox(torso, -tw / 2, 0, -2, tw, 1, 4, L.top2);                         // belt
  if (L.plaid) { vox(torso, -tw / 2 - 0.01, 2, -2.01, tw + 0.02, 1, 4.02, L.top2); vox(torso, -0.5, 0, 2, 1, 5, 0.1, L.top2); }
  if (L.belly) vox(torso, -2, 1, 1.6, 4, 3, 1, shade(L.top, 0.85));
  if (L.apron) vox(torso, -2, 0, 2, 4, 4.5, 0.4, L.apron);
  if (L.shawl) vox(torso, -tw / 2 - 0.4, 3.6, -2.3, tw + 0.8, 1.4, 4.6, L.shawl);
  if (L.scarf) { vox(torso, -tw / 2 + 0.3, 4.2, -2.2, tw - 0.6, 1, 4.4, L.scarf); vox(torso, 1, 2.4, 2, 1.2, 2, 0.4, L.scarf); }
  if (L.pack) { vox(torso, -2.5, 0.5, -4, 5, 5, 2, 0x8a5a32); vox(torso, -2.2, 5, -3.8, 4.4, 1.2, 1.6, 0x5a7a4a); vox(torso, -1.5, 1.5, -4.4, 3, 1.4, 0.5, 0x6a4426); }
  // arms (pivot at shoulder)
  const arms = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(sx * (tw / 2 + 1) * V, 7.6 * V, 0); body.add(arm);
    vox(arm, -1, -3.4, -1, 2, 3.4, 2, L.top); vox(arm, -1, -4.4, -1, 2, 1, 2, L.skin);
    arms.push(arm);
  }
  // head: cube 8×8×7 sitting on the torso
  const head = new THREE.Group(); head.position.y = 8 * V; body.add(head);
  const sk = L.skin, skD = shade(sk, 0.9), hr = L.hair, hrD = shade(hr, 0.78);
  vox(head, -4, 0, -3.5, 8, 7.5, 7, sk);
  vox(head, -4.01, 0, 2.4, 8.02, 0.6, 1.11, skD);                      // chin shade
  // eyes: tall black rectangles with a white glint
  if (L.old) { vox(head, -2.6, 3.2, 3.5, 1.6, 0.5, 0.12, 0x241812); vox(head, 1.0, 3.2, 3.5, 1.6, 0.5, 0.12, 0x241812); }
  else for (const ex of [-2.4, 1.2]) { vox(head, ex, 2.6, 3.5, 1.2, 2.2, 0.12, 0x241812); vox(head, ex + 0.25, 4.0, 3.55, 0.5, 0.6, 0.12, 0xffffff); }
  vox(head, -3.4, 2.0, 3.5, 1.2, 0.6, 0.1, 0xf0a090); vox(head, 2.2, 2.0, 3.5, 1.2, 0.6, 0.1, 0xf0a090); // blush
  if (L.glasses) { for (const ex of [-3, 0.6]) { vox(head, ex, 2.4, 3.6, 2.4, 0.35, 0.1, 0x5a4030); vox(head, ex, 4.6, 3.6, 2.4, 0.35, 0.1, 0x5a4030); vox(head, ex, 2.4, 3.6, 0.35, 2.5, 0.1, 0x5a4030); vox(head, ex + 2.05, 2.4, 3.6, 0.35, 2.5, 0.1, 0x5a4030); } }
  if (L.beard) { vox(head, -4.05, -0.2, 1.5, 8.1, 2.4, 2.2, L.beard); vox(head, -2, 1.9, 3.6, 4, 0.7, 0.2, L.beard); vox(head, -1, 0.6, 3.65, 2, 0.6, 0.12, 0x8a3a2a); }
  else vox(head, -0.8, 1.1, 3.5, 1.6, 0.4, 0.12, 0x8a3a2a);                // mouth
  // hair: top + back + sides + notched fringe
  vox(head, -4.4, 7.5, -3.9, 8.8, 1.4, 7.8, hr);
  vox(head, -4.4, 1.5, -3.9, 8.8, 6, 1.2, hrD);
  for (const sx of [-1, 1]) vox(head, sx > 0 ? 4 : -4.4, L.girl ? 0.5 : 3, -3.9, 0.4, L.girl ? 7 : 4.5, 6.4, hr);
  const fr = { spiky: [2, 1, 2, 1.5, 2, 1, 2, 1.5], swept: [2.5, 2.5, 2, 2, 1.5, 1.5, 1, 1], short: [1, 1, 1, 1, 1, 1, 1, 1], messy: [2, 1, 2.5, 1, 2, 1.5, 2.5, 1], side: [2.5, 2.5, 2, 1, 1, 1, 1, 1.5] }[L.bangs || 'short'];
  fr.forEach((h, i) => vox(head, -4.4 + i * 1.1, 7.5 - h, 3.3, 1.1, h, 0.7, i % 2 ? hrD : hr));
  if (L.ponytail) vox(head, -1, 1, -5.2, 2, 5, 1.6, hr);
  // hats
  let hat = null;
  if (L.hat === 'beanie') {
    hat = new THREE.Group(); hat.position.y = 7.2 * V; head.add(hat);
    vox(hat, -4.6, 0, -4.1, 9.2, 1.4, 8.2, 0xf0e0c0); vox(hat, -4.3, 1.4, -3.8, 8.6, 1.8, 7.6, L.hatC); vox(hat, -3.3, 3.2, -2.8, 6.6, 0.9, 5.6, L.hatC); vox(hat, -1, 4.1, -1, 2, 1.6, 2, 0xf6ead0);
  } else if (L.hat === 'straw') {
    hat = new THREE.Group(); hat.position.y = 8.4 * V; head.add(hat);
    vox(hat, -7, 0, -6.5, 14, 0.6, 13, 0xe0c070); vox(hat, -3.6, 0.6, -3.4, 7.2, 2.6, 6.8, 0xd8b460); vox(hat, -3.7, 0.6, -3.5, 7.4, 0.8, 7, 0xa8402a);
  } else if (L.hat === 'cap') {
    hat = new THREE.Group(); hat.position.y = 7.6 * V; head.add(hat);
    vox(hat, -4.5, 0, -4, 9, 2, 8, L.hatC); vox(hat, -3.4, 0, 3.9, 6.8, 0.6, 3, shade(L.hatC, 0.8)); vox(hat, -0.5, 2, -0.5, 1, 0.5, 1, 0xf0e0c0);
  } else if (L.hat === 'ranger') {
    hat = new THREE.Group(); hat.position.y = 8.4 * V; head.add(hat);
    vox(hat, -6.5, 0, -6, 13, 0.6, 12, shade(L.hatC, 0.9)); vox(hat, -3.4, 0.6, -3.2, 6.8, 2.8, 6.4, L.hatC); vox(hat, -3.5, 0.6, -3.3, 7, 0.7, 6.6, 0x4a3a20);
  } else if (L.hat === 'bun') {
    hat = new THREE.Group(); hat.position.y = 8.9 * V; head.add(hat);
    vox(hat, -1.6, 0, -2.8, 3.2, 2.6, 3.2, hr); vox(hat, -1.7, 0, -0.3, 3.4, 0.6, 0.6, 0xd8402a);
  }
  if (L.stoop) { torso.rotation.x = L.stoop; head.position.z = 0.06; }
  body.scale.setScalar(1.22 * (big > 1 ? 1.06 : 1));
  // held items
  const rod = new THREE.Group();
  rod.add(mesh(new THREE.BoxGeometry(0.04, 1.6, 0.04), 0x7a5232, 0, 0.8, 0));
  rod.rotation.x = 1.1; rod.position.set(0, -0.32, 0.05); rod.visible = false; arms[1].add(rod);
  const lantern = new THREE.Group();
  lantern.add(mesh(B(0.16, 0.2, 0.16), 0x3a3328, 0, 0, 0));
  const glow = new THREE.Mesh(B(0.12, 0.13, 0.17), new THREE.MeshBasicMaterial({ color: 0xffc860 })); lantern.add(glow);
  lantern.position.set(0, -0.42, 0.06); lantern.visible = false; arms[0].add(lantern);
  const st = { phase: 0, mode: 'idle', t: 0 };
  root.userData = { body, torso, head, arms, legs, hat, rod, lantern, st };
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return root;
}

// animate: speed = horizontal speed (u/s); mode: idle|walk|push|climb|fish|cheer|ring
export function animateCharacter(ch, dt, speed, mode) {
  const u = ch.userData, st = u.st;
  st.t += dt;
  const walk = speed > 0.1;
  st.phase += dt * (walk ? 2.2 + speed * 1.6 : 0);
  const sw = Math.sin(st.phase);
  const tgt = { lx: 0, rx: 0, al: 0, ar: 0, bob: 0, lean: 0, alz: 0, arz: 0, head: 0 };
  if (mode === 'climb') {
    const c = Math.sin(st.t * 8);
    tgt.al = -2.6 + c * 0.4; tgt.ar = -2.6 - c * 0.4; tgt.lx = c * 0.5; tgt.rx = -c * 0.5;
  } else if (mode === 'push') {
    tgt.al = tgt.ar = -1.45; tgt.lean = 0.28; tgt.lx = sw * 0.45; tgt.rx = -sw * 0.45; tgt.bob = Math.abs(sw) * 0.02;
    st.phase += dt * 3;
  } else if (mode === 'fish') {
    tgt.ar = -0.9; tgt.al = -0.4; tgt.alz = 0; tgt.head = 0.1;
  } else if (mode === 'cheer') {
    const c = Math.abs(Math.sin(st.t * 7));
    tgt.al = tgt.ar = -2.8; tgt.alz = -0.3; tgt.arz = 0.3; tgt.bob = c * 0.12;
  } else if (mode === 'ring') {
    tgt.ar = -2.2 + Math.sin(st.t * 3) * 0.6; tgt.al = -0.5;
  } else if (walk) {
    tgt.lx = sw * 0.75; tgt.rx = -sw * 0.75; tgt.al = -sw * 0.6; tgt.ar = sw * 0.6; tgt.bob = Math.abs(Math.cos(st.phase)) * 0.06; tgt.lean = 0.06;
  } else {
    tgt.bob = Math.sin(st.t * 2.2) * 0.012; tgt.al = Math.sin(st.t * 2.2) * 0.04; tgt.ar = -tgt.al;
  }
  const k = Math.min(1, dt * 14);
  const lerp = (a, b) => a + (b - a) * k;
  u.legs[0].rotation.x = lerp(u.legs[0].rotation.x, tgt.lx);
  u.legs[1].rotation.x = lerp(u.legs[1].rotation.x, tgt.rx);
  u.arms[0].rotation.x = lerp(u.arms[0].rotation.x, tgt.al);
  u.arms[1].rotation.x = lerp(u.arms[1].rotation.x, tgt.ar);
  u.arms[0].rotation.z = lerp(u.arms[0].rotation.z, tgt.alz);
  u.arms[1].rotation.z = lerp(u.arms[1].rotation.z, tgt.arz);
  u.body.position.y = lerp(u.body.position.y, tgt.bob);
  u.body.rotation.x = lerp(u.body.rotation.x, tgt.lean);
  u.head.rotation.x = lerp(u.head.rotation.x, tgt.head);
  if (u.hat) u.hat.rotation.z = Math.sin(st.phase * 0.5) * (walk ? 0.06 : 0.01);
  u.rod.visible = mode === 'fish';
}

export function buildCat() {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const W = 0xf4ece0, O = 0xe0904a;
  body.add(mesh(B(0.3, 0.26, 0.52), W, 0, 0.3, 0));
  body.add(mesh(B(0.31, 0.12, 0.3), O, 0, 0.42, -0.08));
  const head = new THREE.Group(); head.position.set(0, 0.5, 0.3); body.add(head);
  head.add(mesh(B(0.32, 0.28, 0.28), W, 0, 0, 0));
  head.add(mesh(B(0.33, 0.1, 0.29), O, 0, 0.1, -0.01));
  for (const sx of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(0.07, 0.14, 4), O, sx * 0.1, 0.2, 0); head.add(ear);
    head.add(mesh(B(0.05, 0.06, 0.02), 0x2a1a12, sx * 0.07, 0.02, 0.145));
  }
  head.add(mesh(B(0.04, 0.03, 0.02), 0xe88a8a, 0, -0.04, 0.15));
  const legs = [];
  for (const [x, z] of [[-0.1, 0.17], [0.1, 0.17], [-0.1, -0.17], [0.1, -0.17]]) { const l = mesh(B(0.08, 0.2, 0.08), W, x, 0.1, z); body.add(l); legs.push(l); }
  const tail = new THREE.Group(); tail.position.set(0, 0.38, -0.26); body.add(tail);
  tail.add(mesh(B(0.07, 0.07, 0.36), O, 0, 0.08, -0.15));
  tail.rotation.x = -0.7;
  root.userData = { body, head, legs, tail, st: { t: 0, phase: 0 } };
  return root;
}
export function animateCat(cat, dt, speed) {
  const u = cat.userData; u.st.t += dt; u.st.phase += dt * speed * 5;
  const s = Math.sin(u.st.phase);
  u.legs.forEach((l, i) => l.rotation.x = (i % 2 ? s : -s) * (speed > 0.1 ? 0.6 : 0));
  u.tail.rotation.y = Math.sin(u.st.t * 2.5) * 0.5;
  u.head.rotation.y = Math.sin(u.st.t * 0.7) * 0.3;
}

export function buildDuck() {
  const g = new THREE.Group();
  g.add(mesh(B(0.26, 0.18, 0.4), 0xf2ead8, 0, 0.09, 0));
  g.add(mesh(B(0.16, 0.18, 0.16), 0x3a6a4a, 0, 0.24, 0.17));
  g.add(mesh(B(0.08, 0.05, 0.1), 0xe8a030, 0, 0.21, 0.29));
  g.add(mesh(B(0.18, 0.08, 0.1), 0x8a7a6a, 0, 0.16, -0.18));
  return g;
}
export function buildBird() {
  const g = new THREE.Group();
  g.add(mesh(B(0.12, 0.1, 0.2), 0x6a4a3a, 0, 0, 0));
  const wl = mesh(B(0.22, 0.02, 0.1), 0x5a3a2a, -0.14, 0.02, 0), wr = mesh(B(0.22, 0.02, 0.1), 0x5a3a2a, 0.14, 0.02, 0);
  g.add(wl, wr); g.userData.wings = [wl, wr];
  return g;
}
