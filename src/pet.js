// pet.js — 豆豆 the Shiba puppy: adopt by feeding, follows, sits, sniffs out golden leaves, digs up treats
import * as THREE from 'three';
import { PET } from './story.js';

let GRAD;
const mats = {};
const T = (c) => (mats[c] ??= new THREE.MeshToonMaterial({ color: c, gradientMap: GRAD }));
const box = (w, h, d, c, x, y, z, p) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), T(c)); m.position.set(x, y, z); m.castShadow = true; p.add(m); return m; };

export function buildDog(gradient) {
  GRAD = gradient;
  const O = 0xd8843a, Od = 0xb0642a, Wc = 0xfbf1e0, K = 0x2a1a12;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  box(0.34, 0.28, 0.6, O, 0, 0.36, 0, body);
  box(0.3, 0.2, 0.4, Wc, 0, 0.28, 0.08, body);
  const head = new THREE.Group(); head.position.set(0, 0.6, 0.3); body.add(head);
  box(0.36, 0.3, 0.3, O, 0, 0, 0, head);
  box(0.24, 0.14, 0.18, Wc, 0, -0.07, 0.2, head);
  box(0.08, 0.06, 0.05, K, 0, -0.02, 0.3, head);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.16, 4), T(Od)); ear.position.set(s * 0.11, 0.21, -0.02); ear.rotation.y = Math.PI / 4; ear.castShadow = true; head.add(ear);
    box(0.05, 0.06, 0.02, K, s * 0.08, 0.04, 0.155, head);
    box(0.06, 0.04, 0.02, Wc, s * 0.08, 0.1, 0.152, head);
  }
  box(0.3, 0.06, 0.32, 0xd8402a, 0, -0.17, -0.02, head); // collar
  const legs = [];
  for (const [x, z] of [[-0.11, 0.2], [0.11, 0.2], [-0.11, -0.2], [0.11, -0.2]]) { const l = new THREE.Group(); l.position.set(x, 0.25, z); box(0.09, 0.25, 0.09, O, 0, -0.12, 0, l); box(0.1, 0.06, 0.12, Wc, 0, -0.23, 0.01, l); body.add(l); legs.push(l); }
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.045, 5, 8, Math.PI * 1.5), T(O)); tail.position.set(0, 0.55, -0.3); tail.rotation.y = Math.PI / 2; tail.castShadow = true; body.add(tail);
  root.userData = { body, head, legs, tail };
  return root;
}

export class Pet {
  constructor(game) {
    this.g = game;
    const st = game.state.pet || (game.state.pet = { adopted: 0, love: 0 });
    this.st = st;
    this.model = buildDog(game.player.model.userData.body.children[0]?.material?.gradientMap);
    this.model.traverse(o => o.layers.set(1));
    game.scene.add(this.model);
    this.home = new THREE.Vector3(11.2 * 2, 0, 46.4 * 2);
    this.pos = this.home.clone();
    this.face = 0; this.t = 0; this.phase = 0; this.mode = 'idle'; this.target = null; this.sniffT = 4; this.barkT = 0;
    if (st.adopted) { const p = game.player.pos; this.pos.set(p.x - 1, 0, p.z + 0.5); }
    this.pos.y = this.surf(this.pos.x, this.pos.z);
  }
  get adopted() { return !!this.st.adopted; }
  surf(x, z) { return this.g.player.surfaceAt(x, z) ?? this.g.world.heightAt(x, z); }
  warp(p) { this.pos.set(p.x, this.surf(p.x, p.z), p.z); this.target = null; }
  // ---- interaction
  label() { return this.adopted ? '摸摸豆豆' : '小柴犬'; }
  async interact() {
    const g = this.g, say = (l) => g.ui.say(l.map(t => Array.isArray(t) ? t : ['小禾', t]), 'pet');
    g.audio.bark?.();
    if (!this.adopted) {
      if (!this.st.met) { this.st.met = 1; await say(PET.meet); }
      const food = g.firstFood();
      if (!food) return say(PET.hungry);
      g.consumeFood(food);
      await say([`你把${food.name}遞給牠——`, ...PET.adopt]);
      this.st.adopted = 1; this.st.love = 2;
      g.give('whistle');
      g.toast('豆豆成為了你的夥伴!牠會跟著你,還會幫你找東西。', true);
      g.save();
      return;
    }
    const now = g.state.time;
    if (!this.st.patAt || now - this.st.patAt > 45) { this.st.patAt = now; this.love(1); }
    this.hearts();
    await g.ui.say([['豆豆', PET.lines[Math.floor(Math.random() * PET.lines.length)]]], 'pet');
  }
  love(n) {
    const before = this.level();
    this.st.love = Math.min(30, (this.st.love || 0) + n);
    const after = this.level();
    if (after > before) {
      const msg = { 2: '豆豆學會了「嗅探」:靠近金楓葉時牠會叫給你聽!', 3: '豆豆學會了「挖寶」:牠會在附近挖出好東西!', 4: '豆豆對你完全放心了。親密度最高!' }[after];
      if (msg) this.g.toast(msg, true);
    }
    this.g.save();
  }
  level() { const l = this.st.love || 0; return l >= 24 ? 4 : l >= 12 ? 3 : l >= 5 ? 2 : 1; }
  hearts() {
    const g = this.g;
    const s = g.heartSprite.clone(); s.position.copy(this.pos).add(new THREE.Vector3(0, 1.1, 0)); g.scene.add(s);
    g.tween(1.2, k => { s.position.y = this.pos.y + 1.1 + k * 0.8; s.material.opacity = 1 - k; }).then(() => g.scene.remove(s));
  }
  // ---- per frame
  update(dt) {
    const g = this.g, p = g.player, u = this.model.userData;
    this.t += dt;
    let goal = null, speed = 0;
    if (!this.adopted) {
      goal = new THREE.Vector3(this.home.x + Math.sin(this.t * 0.35) * 2.2, 0, this.home.z + Math.cos(this.t * 0.27) * 1.2);
    } else if (g.truck?.driving) {
      // ride in the truck bed
      const tr = g.truck; const back = tr.localToWorld(0, 0.95, -1.05);
      this.pos.copy(back); this.face = tr.heading; this.mode = 'sit';
      this.model.position.copy(this.pos); this.model.rotation.y = this.face;
      this.pose(dt, 0); return;
    } else {
      const d = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
      if (d > 14 || Math.abs(p.pos.y - this.pos.y) > 3.5 && d > 3) { this.warp(new THREE.Vector3(p.pos.x - Math.sin(p.face) * 1.2, 0, p.pos.z - Math.cos(p.face) * 1.2)); }
      // abilities
      this.sniffT -= dt;
      if (this.level() >= 2 && this.sniffT <= 0 && !this.target) {
        this.sniffT = 7;
        const leaf = g.leaves.find(l => !g.state.leaves[l.i] && Math.hypot(l.x - p.pos.x, l.z - p.pos.z) < 11);
        if (leaf) { this.target = { x: leaf.x, z: leaf.z, t: 5, kind: 'leaf' }; g.audio.bark?.(); g.toast('豆豆聞到了什麼!汪汪!'); }
        else if (this.level() >= 3) {
          const spot = g.digSpots.find(s => !g.state.dug?.[s.i] && Math.hypot(s.x - p.pos.x, s.z - p.pos.z) < 7);
          if (spot) { this.target = { x: spot.x, z: spot.z, t: 4, kind: 'dig', spot }; g.audio.bark?.(); }
        }
      }
      if (this.target) {
        goal = new THREE.Vector3(this.target.x, 0, this.target.z);
        if (Math.hypot(goal.x - this.pos.x, goal.z - this.pos.z) < 0.6) {
          this.target.t -= dt; this.mode = this.target.kind === 'dig' ? 'dig' : 'sit';
          if (this.target.kind === 'dig' && this.target.t < 2.5 && !this.target.done) { this.target.done = true; g.digUp(this.target.spot); }
          if (Math.random() < dt * 1.2) g.audio.bark?.();
          if (this.target.t <= 0 || (this.target.kind === 'leaf' && Math.hypot(p.pos.x - this.target.x, p.pos.z - this.target.z) < 1.5)) this.target = null;
          goal = null;
        }
      } else if (d > 2.0) goal = new THREE.Vector3(p.pos.x - Math.sin(p.face) * 1.2, 0, p.pos.z - Math.cos(p.face) * 1.2);
    }
    if (goal) {
      const dx = goal.x - this.pos.x, dz = goal.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d > 0.2) {
        const far = this.adopted ? Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) : 0;
        speed = Math.min(this.adopted ? (far > 5 ? 7.5 : 4.6) : 1.2, d * 3);
        const nx = this.pos.x + dx / d * speed * dt, nz = this.pos.z + dz / d * speed * dt;
        const h0 = this.pos.y, h1 = this.surf(nx, nz);
        if (h1 != null && Math.abs(h1 - h0) < 0.5) { this.pos.x = nx; this.pos.z = nz; }
        else speed = 0;
        let df = Math.atan2(dx, dz) - this.face; df = Math.atan2(Math.sin(df), Math.cos(df)); this.face += df * Math.min(1, dt * 10);
        this.mode = 'walk';
      }
    } else if (this.mode === 'walk') this.mode = 'sit';
    const h = this.surf(this.pos.x, this.pos.z); if (h != null) this.pos.y += (h - this.pos.y) * Math.min(1, dt * 15);
    this.model.position.copy(this.pos); this.model.rotation.y = this.face;
    this.pose(dt, speed);
  }
  pose(dt, speed) {
    const u = this.model.userData;
    this.phase += dt * (speed > 0.1 ? 6 + speed * 2 : 0);
    const s = Math.sin(this.phase), k = Math.min(1, dt * 12), L = (a, b) => a + (b - a) * k;
    const sit = this.mode === 'sit' && speed < 0.1, dig = this.mode === 'dig';
    u.legs.forEach((l, i) => { l.rotation.x = L(l.rotation.x, speed > 0.1 ? (i % 2 ? s : -s) * 0.8 : dig && i < 2 ? Math.sin(this.t * 20) * 0.9 : sit && i >= 2 ? -1.2 : 0); });
    u.body.rotation.x = L(u.body.rotation.x, sit ? -0.35 : dig ? 0.3 : 0);
    u.body.position.y = L(u.body.position.y, sit ? -0.06 : speed > 0.1 ? Math.abs(Math.cos(this.phase)) * 0.05 : 0);
    u.tail.rotation.x = Math.sin(this.t * (this.adopted ? 14 : 6)) * 0.4;
    u.head.rotation.y = Math.sin(this.t * 0.8) * 0.3;
    u.head.rotation.x = L(u.head.rotation.x, sit ? 0.3 : dig ? 0.5 : 0);
  }
}
