// player.js — movement over terraced terrain with colliders, facing, animation state
import * as THREE from 'three';
import { buildCharacter, animateCharacter, LOOKS } from './characters.js';

const RAD = 0.28;

export class Player {
  constructor(world) {
    this.world = world;
    this.model = buildCharacter(LOOKS.player);
    this.model.traverse(o => o.layers.set(1));
    world.scene.add(this.model);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector2();
    this.face = 0;           // yaw (0 = facing +z / south / camera)
    this.mode = 'idle';
    this.lock = 0;           // >0: scripted (no input)
    this.speed = 0;
    this.blockedBy = null;   // collider we ran into this frame
    this.pushDir = null;
    this.walkSurface = 'grass';
    this.stepT = 0;
    this.runUnlocked = false;
  }
  place(x, z, face = 0) {
    this.pos.set(x, this.world.heightAt(x, z), z);
    this.face = face; this.model.rotation.y = face;
    this.model.position.copy(this.pos);
  }
  // can the player stand at (x,z) coming from height h0?
  standable(x, z, h0) {
    const w = this.world, b = w.bounds, T = w.T(x, z);
    const inCave = x > 250;
    if (!inCave && (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1)) return false;
    for (const [a, c] of [[0, 0], [RAD, 0], [-RAD, 0], [0, RAD], [0, -RAD]]) {
      const px = x + a, pz = z + c;
      const hh = this.surfaceAt(px, pz, T);
      if (hh == null) return false;
      if (Math.abs(hh - h0) > 0.42) return false;
    }
    return true;
  }
  surfaceAt(x, z, T = this.world.T(x, z)) {
    const k = T.cellIdx(x, z);
    if (k < 0) return null;
    const ov = this.world.walkOverride?.(x, z);
    if (ov != null) return ov;
    if (T.W[k]) return null;
    return T.heightAt(x, z);
  }
  update(dt, input, game) {
    const w = this.world;
    this.blockedBy = null; this.pushDir = null;
    let ax = 0, az = 0, mag = 0;
    if (this.lock <= 0 && !game.uiBusy()) { const a = input.axis(); ax = a.x; az = a.z; mag = a.mag; }
    const run = this.runUnlocked && input.down('ShiftLeft', 'ShiftRight');
    const maxS = (run ? 6.4 : 4.0) * mag;
    if (mag > 0.05) {
      const tgt = Math.atan2(ax, az);
      let d = tgt - this.face; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.face += d * Math.min(1, dt * 16);
    }
    const vx = mag > 0.05 ? ax / mag * maxS : 0, vz = mag > 0.05 ? az / mag * maxS : 0;
    let moved = 0;
    if (this.lock <= 0) {
      const h0 = this.surfaceAt(this.pos.x, this.pos.z) ?? this.pos.y;
      const steps = Math.max(1, Math.ceil(Math.hypot(vx, vz) * dt / 0.08));
      for (let s = 0; s < steps; s++) {
        const dx = vx * dt / steps, dz = vz * dt / steps;
        const tryMove = (nx, nz) => {
          const hit = w.colliders.hit(nx, nz, RAD);
          if (hit) { this.blockedBy = hit; return false; }
          if (game.dynBlock && game.dynBlock(nx, nz, RAD)) return false;
          return this.standable(nx, nz, this.surfaceAt(this.pos.x, this.pos.z) ?? h0);
        };
        const ox = this.pos.x, oz = this.pos.z;
        if (tryMove(ox + dx, oz + dz)) { this.pos.x += dx; this.pos.z += dz; }
        else if (dx && tryMove(ox + dx, oz)) this.pos.x += dx;
        else if (dz && tryMove(ox, oz + dz)) this.pos.z += dz;
        moved += Math.hypot(this.pos.x - ox, this.pos.z - oz);
      }
      if (mag > 0.3 && this.blockedBy) this.pushDir = Math.abs(ax) > Math.abs(az) ? [Math.sign(ax), 0] : [0, Math.sign(az)];
      const h = this.surfaceAt(this.pos.x, this.pos.z);
      if (h != null) this.pos.y += (h - this.pos.y) * Math.min(1, dt * 20);
    }
    this.speed = moved / Math.max(dt, 1e-4);
    if (this.lock > 0) this.lock -= dt;
    let mode = this.forceMode || (this.pushing ? 'push' : 'walk');
    animateCharacter(this.model, dt, this.forceMode ? 0 : this.speed, mode === 'walk' ? (this.speed > 0.1 ? 'walk' : 'idle') : mode);
    this.model.position.copy(this.pos);
    this.model.rotation.y = this.face;
    // footsteps
    if (this.speed > 0.5) {
      this.stepT -= dt * this.speed * 0.55;
      if (this.stepT <= 0) { this.stepT = 1; game.audio?.step(w.pathDist(this.pos.x, this.pos.z) < 0 ? 'dirt' : 'grass'); }
    }
  }
}
