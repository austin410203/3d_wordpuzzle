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

export function buildCharacter(look) {
  const L = look;
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const s = L.big || 1;
  // legs
  const legs = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(sx * 0.11, 0.45, 0);
    leg.add(mesh(B(0.17, 0.36, 0.19), L.pants, 0, -0.18, 0));
    leg.add(mesh(B(0.19, 0.12, 0.25), L.shoes, 0, -0.39, 0.03));
    body.add(leg); legs.push(leg);
  }
  // torso
  const torso = new THREE.Group(); torso.position.y = 0.45; body.add(torso);
  const tw = 0.5 * s;
  torso.add(mesh(B(tw, 0.48, 0.32 * s), L.top, 0, 0.24, 0));
  if (L.belly) torso.add(mesh(B(tw * 0.9, 0.3, 0.12), L.top2, 0, 0.18, 0.18));
  if (L.plaid) for (let i = 0; i < 3; i++) torso.add(mesh(B(tw + 0.01, 0.05, 0.33 * s), L.top2, 0, 0.08 + i * 0.15, 0));
  if (L.apron) torso.add(mesh(B(tw * 0.8, 0.5, 0.04), L.apron, 0, 0.16, 0.17 * s));
  if (L.shawl) torso.add(mesh(B(tw + 0.08, 0.16, 0.36 * s), L.shawl, 0, 0.42, 0));
  if (L.scarf) torso.add(mesh(B(tw * 0.8, 0.1, 0.34), L.scarf, 0, 0.47, 0));
  torso.add(mesh(B(tw + 0.02, 0.06, 0.33 * s), L.top2, 0, 0.02, 0)); // belt line
  if (L.pack) {
    torso.add(mesh(B(0.42, 0.46, 0.2), 0x8a5a32, 0, 0.26, -0.24));
    torso.add(mesh(B(0.38, 0.12, 0.14), 0x5a7a4a, 0, 0.56, -0.24));
    torso.add(mesh(B(0.3, 0.14, 0.06), 0x6a4426, 0, 0.18, -0.36));
  }
  // arms
  const arms = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(sx * (tw / 2 + 0.07), 0.9, 0);
    arm.add(mesh(B(0.13, 0.36, 0.14), L.top, 0, -0.16, 0));
    arm.add(mesh(new THREE.IcosahedronGeometry(0.075, 0), L.skin, 0, -0.38, 0));
    body.add(arm); arms.push(arm);
  }
  // head
  const head = new THREE.Group(); head.position.y = 1.2; body.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.32, 10, 8), L.skin, 0, 0.06, 0); skull.scale.set(1, 0.95, 0.95); head.add(skull);
  // hair (back + top shell)
  const hair = mesh(new THREE.SphereGeometry(0.345, 10, 8, Math.PI * 0.08, Math.PI * 1.84, 0, Math.PI * 0.62), L.hair, 0, 0.07, -0.01);
  hair.rotation.y = Math.PI; head.add(hair);
  const fringe = mesh(B(0.5, 0.12, 0.1), L.hair, 0, 0.26, 0.26); fringe.rotation.x = -0.4; head.add(fringe);
  // face
  for (const sx of [-1, 1]) {
    head.add(mesh(B(0.06, 0.09, 0.03), 0x241812, sx * 0.11, 0.06, 0.3));
    head.add(mesh(B(0.07, 0.035, 0.02), 0xe88a7a, sx * 0.17, -0.03, 0.28));
  }
  if (L.beard) { const b = mesh(B(0.42, 0.18, 0.12), L.beard, 0, -0.14, 0.24); head.add(b); }
  if (L.ponytail) head.add(mesh(B(0.12, 0.3, 0.12), L.hair, 0, -0.05, -0.36));
  let hat = null;
  if (L.hat === 'beanie') {
    hat = mesh(new THREE.SphereGeometry(0.35, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.45), L.hatC, 0, 0.12, 0);
    hat.add(mesh(new THREE.CylinderGeometry(0.355, 0.355, 0.1, 10), 0xf0e0c0, 0, 0.0, 0));
    hat.add(mesh(new THREE.IcosahedronGeometry(0.09, 0), 0xf0e0c0, 0, 0.36, 0));
  } else if (L.hat === 'straw') {
    hat = new THREE.Group(); hat.position.y = 0.26;
    hat.add(mesh(new THREE.CylinderGeometry(0.58, 0.6, 0.04, 12), 0xe0c070, 0, 0, 0));
    hat.add(mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.2, 10), 0xd8b460, 0, 0.11, 0));
    hat.add(mesh(new THREE.CylinderGeometry(0.305, 0.305, 0.05, 10), 0xa8402a, 0, 0.04, 0));
  } else if (L.hat === 'cap') {
    hat = mesh(new THREE.SphereGeometry(0.35, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.4), L.hatC, 0, 0.14, 0);
    hat.add(mesh(B(0.36, 0.04, 0.22), L.hatC, 0, -0.02, 0.36));
  } else if (L.hat === 'ranger') {
    hat = new THREE.Group(); hat.position.y = 0.27;
    hat.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 12), L.hatC, 0, 0, 0));
    hat.add(mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.24, 10), L.hatC, 0, 0.12, 0));
  } else if (L.hat === 'bun') {
    hat = mesh(new THREE.IcosahedronGeometry(0.16, 1), L.hair, 0, 0.36, -0.12);
  }
  if (hat) head.add(hat);
  if (L.stoop) { torso.rotation.x = L.stoop; head.position.z = 0.08; }
  body.scale.setScalar(s);
  // optional held item (fishing rod)
  const rod = new THREE.Group();
  rod.add(mesh(new THREE.CylinderGeometry(0.018, 0.025, 1.6, 4), 0x7a5232, 0, 0.8, 0));
  rod.rotation.x = 1.1; rod.position.set(0, -0.36, 0.05); rod.visible = false; arms[1].add(rod);
  const lantern = new THREE.Group();
  lantern.add(mesh(B(0.16, 0.2, 0.16), 0x3a3328, 0, 0, 0));
  const glow = new THREE.Mesh(B(0.12, 0.13, 0.17), new THREE.MeshBasicMaterial({ color: 0xffc860 })); lantern.add(glow);
  lantern.position.set(0, -0.5, 0.06); lantern.visible = false; arms[0].add(lantern);

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
