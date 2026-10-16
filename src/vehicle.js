// vehicle.js — 小藍, grandpa's little blue voxel pickup. Arcade top-down driving:
// the stick/keys give the direction you want to go; the truck turns toward it and accelerates.
import * as THREE from 'three';

let GRAD;
const mats = {};
const T = (c) => (mats[c] ??= new THREE.MeshToonMaterial({ color: c, gradientMap: GRAD }));
const box = (p, w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof c === 'number' ? T(c) : c); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; p.add(m); return m; };

export function buildTruck(gradient) {
  GRAD = gradient;
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const BL = 0x3f78b8, BD = 0x2c5a8e, WH = 0xf0ece0, K = 0x22201e;
  box(body, 1.5, 0.45, 3.2, BL, 0, 0.62, 0);                 // chassis
  box(body, 1.52, 0.12, 3.22, BD, 0, 0.42, 0);               // skirt
  box(body, 1.42, 0.7, 1.2, BL, 0, 1.18, 0.45);              // cab
  box(body, 1.44, 0.12, 1.26, WH, 0, 1.56, 0.45);            // white roof
  const glass = new THREE.MeshBasicMaterial({ color: 0x9cc8e0 });
  box(body, 1.2, 0.42, 0.06, glass, 0, 1.22, 1.06);          // windshield
  for (const s of [-1, 1]) box(body, 0.06, 0.38, 0.8, glass, s * 0.72, 1.22, 0.45);
  box(body, 1.2, 0.36, 0.06, glass, 0, 1.22, -0.16);         // rear window
  // bed
  box(body, 1.5, 0.28, 1.5, BD, 0, 0.98, -0.85);
  box(body, 1.3, 0.1, 1.3, 0x6a4426, 0, 0.9, -0.85);
  for (const s of [-1, 1]) box(body, 0.1, 0.32, 1.5, BL, s * 0.7, 1.0, -0.85);
  box(body, 1.5, 0.32, 0.1, BL, 0, 1.0, -1.6);
  // front: grille, lights, bumper
  box(body, 1.1, 0.26, 0.06, 0xd0d0c8, 0, 0.72, 1.62);
  for (const s of [-1, 1]) box(body, 0.24, 0.18, 0.06, new THREE.MeshBasicMaterial({ color: 0xfff2b0 }), s * 0.55, 0.78, 1.63);
  for (const s of [-1, 1]) box(body, 0.22, 0.14, 0.06, new THREE.MeshBasicMaterial({ color: 0xd84030 }), s * 0.58, 0.8, -1.62);
  box(body, 1.56, 0.14, 0.18, 0x9a9a92, 0, 0.45, 1.66); box(body, 1.56, 0.14, 0.18, 0x9a9a92, 0, 0.45, -1.66);
  // maple-leaf decal on the door
  for (const s of [-1, 1]) box(body, 0.04, 0.2, 0.2, 0xe07a2c, s * 0.76, 1.0, 0.45);
  // wheels
  const wheels = [];
  for (const [x, z] of [[-0.74, 1.05], [0.74, 1.05], [-0.74, -1.05], [0.74, -1.05]]) {
    const w = new THREE.Group(); w.position.set(x, 0.36, z); body.add(w);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.3, 8), T(K)); t.rotation.z = Math.PI / 2; t.castShadow = true; w.add(t);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.32, 6), T(0xc8c8c0)); hub.rotation.z = Math.PI / 2; w.add(hub);
    wheels.push(w);
  }
  // driver (a voxel head peeks out of the cab)
  const driver = new THREE.Group(); driver.position.set(-0.3, 1.1, 0.45); body.add(driver); driver.visible = false;
  box(driver, 0.42, 0.42, 0.4, 0xf6cfa4, 0, 0.15, 0); box(driver, 0.46, 0.18, 0.44, 0xd8582e, 0, 0.42, 0);
  g.userData = { body, wheels, driver };
  return g;
}

export class Truck {
  constructor(game, x, z, heading = 0) {
    this.g = game;
    this.model = buildTruck(game.player.model.userData.body.children[0]?.material?.gradientMap);
    this.model.traverse(o => o.layers.set(0));
    game.scene.add(this.model);
    this.pos = new THREE.Vector3(x, game.world.heightAt(x, z), z);
    this.heading = heading; this.speed = 0; this.driving = false; this.steer = 0;
    this.coll = game.world.colliders.add({ x, z, r: 1.15, truck: true });
    this.sync();
  }
  localToWorld(x, y, z) {
    const c = Math.cos(this.heading), s = Math.sin(this.heading);
    return new THREE.Vector3(this.pos.x + x * c + z * s, this.pos.y + y, this.pos.z - x * s + z * c);
  }
  // can the truck stand at (x,z) with heading hd? Small things (fence posts, signs, bushes) don't stop it —
  // the terrain check already keeps it on ledges.
  fits(x, z, hd = this.heading, margin = 0.55) {
    const w = this.g.world, p = this.g.player;
    const c = Math.cos(hd), s = Math.sin(hd);
    const skip = (k) => k === this.coll || k.bush || (k.r != null && k.r <= 0.2);
    const hc = p.surfaceAt(this.pos.x, this.pos.z) ?? this.pos.y;
    let lo = 1e9, hi = -1e9;
    for (const f of [-1.05, 0, 1.05]) {
      const cx = x + f * s, cz = z + f * c;
      if (w.colliders.hit(cx, cz, 0.6, skip)) return false;
      if (w.roadInfo(cx, cz).d > (f ? Math.max(margin, 1.1) : margin)) { this.offRoad = true; return false; } // nose/tail may hang over the verge
      for (const [a, b] of [[0, 0], [0.55, 0], [-0.55, 0]]) {
        const ax = cx + a * c, az = cz - a * s;
        const h = p.surfaceAt(ax, az);
        if (h == null) return false;
        lo = Math.min(lo, h); hi = Math.max(hi, h);
      }
    }
    const b = w.bounds; if (x < b.x0 + 0.8 || x > b.x1 - 0.8 || z < b.z0 + 0.8 || z > b.z1 - 0.8) return false;
    return hi - lo < 1.1 && Math.abs((hi + lo) / 2 - hc) < 0.7;
  }
  // try to move by `dist` along heading; slide along walls by testing a fan of nearby directions
  drive(dist) {
    for (const off of [0, 0.28, -0.28, 0.6, -0.6, 0.95, -0.95]) {
      const hd = this.heading + off * Math.sign(dist || 1), k = Math.cos(off);
      const nx = this.pos.x + Math.sin(hd) * dist * k, nz = this.pos.z + Math.cos(hd) * dist * k;
      if (this.fits(nx, nz)) {
        this.pos.x = nx; this.pos.z = nz;
        if (off) { this.heading += off * 0.12; this.speed *= 0.985; }
        return true;
      }
    }
    return false;
  }
  update(dt, input) {
    const u = this.model.userData;
    if (this.driving) {
      const a = input.axis();
      const run = input.down('ShiftLeft', 'ShiftRight');
      const maxV = run ? 12.5 : 9;
      const p0x = this.pos.x, p0z = this.pos.z;
      if (a.mag > 0.15) {
        let want = Math.atan2(a.x, a.z);
        // road-follow assist: steering roughly along the road follows its curve and keeps to the middle
        const ri = this.g.world.roadInfo(this.pos.x, this.pos.z);
        if (ri.d < 1.5) {
          let tx = ri.tx, tz = ri.tz;
          if (tx * a.x + tz * a.z < 0) { tx = -tx; tz = -tz; }
          if (tx * a.x / a.mag + tz * a.z / a.mag > 0.55) {
            const off = Math.hypot(ri.cx - this.pos.x, ri.cz - this.pos.z), pull = Math.min(0.6, off * 0.25);
            const vx = tx + (ri.cx - this.pos.x) / (off || 1) * pull, vz = tz + (ri.cz - this.pos.z) / (off || 1) * pull;
            want = Math.atan2(vx, vz);
          }
        }
        let d = want - this.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
        if (this.backT > 0 || (Math.abs(d) > 2.3 && this.speed < 1.5)) { // reverse (also used to get unstuck)
          this.speed = Math.max(-4.5, this.speed - dt * 12); d = -Math.sign(d) * (Math.PI - Math.abs(d));
        } else this.speed = Math.min(maxV * a.mag, this.speed + dt * (this.speed < 0 ? 16 : 8));
        // turning still works when slow, so you can always steer away from a wall
        const grip = 0.5 + 0.5 * Math.min(1, Math.abs(this.speed) / 3);
        const turn = Math.max(-1, Math.min(1, d * 2.2)) * grip * 2.8 * (this.speed < -0.1 ? -1 : 1);
        const nh = this.heading + turn * dt;
        if (this.fits(this.pos.x, this.pos.z, nh, 1.5)) this.heading = nh;
        else if (this.fits(this.pos.x, this.pos.z, this.heading + turn * dt * 0.4, 1.5)) this.heading += turn * dt * 0.4;
        this.steer = turn;
      } else { this.speed *= Math.pow(0.12, dt); this.steer *= 0.8; if (Math.abs(this.speed) < 0.05) this.speed = 0; }
      const steps = Math.max(1, Math.ceil(Math.abs(this.speed) * dt / 0.12));
      for (let i = 0; i < steps; i++) {
        this.offRoad = false;
        if (!this.drive(this.speed * dt / steps)) { if (Math.abs(this.speed) > 6) { this.g.audio.thunk(); this.g.shake = 0.2; } this.speed *= 0.35; break; }
      }
      // stuck for a moment while the player is pushing → back up briefly on its own
      const moved = Math.hypot(this.pos.x - p0x, this.pos.z - p0z);
      if (a.mag > 0.3 && moved < 0.01 && !(this.backT > 0)) { this.stuckT = (this.stuckT || 0) + dt; if (this.stuckT > 0.8) { this.backT = 0.55; this.stuckT = 0; } }
      else this.stuckT = 0;
      if (this.backT > 0) this.backT -= dt;
      if (this.offRoad && a.mag > 0.3 && (!this.roadMsgT || performance.now() - this.roadMsgT > 6000)) { this.roadMsgT = performance.now(); this.g.toast('小藍只能開在車道上(村子裡的大路)'); }
      if (input.hit('KeyH') || input.hit('ShiftLeft') && Math.abs(this.speed) < 0.2) this.g.audio.honk?.();
      const p = this.g.player; p.pos.copy(this.pos); p.model.position.copy(this.pos);
    }
    const h = this.g.player.surfaceAt(this.pos.x, this.pos.z) ?? this.pos.y;
    this.pos.y += (h - this.pos.y) * Math.min(1, dt * 14);
    for (const w of u.wheels) w.children[0].rotation.x += this.speed * dt * 2.8;
    u.wheels[0].rotation.y = u.wheels[1].rotation.y = this.steer * 0.15;
    u.body.rotation.z = -this.steer * Math.abs(this.speed) * 0.004;
    u.body.position.y = this.driving ? Math.sin(performance.now() / 70) * 0.012 * Math.min(1, Math.abs(this.speed)) : 0;
    u.driver.visible = this.driving;
    this.g.audio.engine?.(this.driving ? Math.abs(this.speed) : -1);
    this.sync();
  }
  sync() {
    this.model.position.copy(this.pos); this.model.rotation.y = this.heading;
    this.g.world.colliders.move(this.coll, this.pos.x, this.pos.z);
    this.coll.off = this.driving;
  }
}
