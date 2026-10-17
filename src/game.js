// game.js — entities, puzzles, quests, interaction, save, ending
import * as THREE from 'three';
import * as MAP from './map.js';
import * as P from './props.js';
import { Player } from './player.js';
import { buildCharacter, animateCharacter, buildCat, animateCat, buildDuck, buildBird, LOOKS } from './characters.js';
import { UI } from './ui.js';
import { Audio } from './audio.js';
import { talk, INTRO, AREAS, POSTCARD_TEXT, FISH, UPGRADES, SIGNS, ENDING, NAMES } from './story.js';
import { PPU, PITCH } from './render.js';
import { buildInteriors } from './interiors.js';
import { Pet } from './pet.js';
import { Truck } from './vehicle.js';
import { ITEMS } from './items.js';
import { mulberry } from './noise.js';
import { ROOM_TEXT, PET } from './story.js';

const S = MAP.CELL;
const SAVE_KEY = 'mapleRidgeSave';
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const ease = (t) => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

function newState() {
  return { v: 1, flags: {}, inv: {}, leaves: {}, postcards: {}, fish: {}, sketches: {}, upgrades: {}, goal: 'start', time: 0,
    pos: null, boulders: {}, filled: [], gates: { ...MAP.MILL.start }, lit: [] };
}

export class Game {
  constructor(ctx) {
    Object.assign(this, ctx);
    this.audio = new Audio();
    this.ui = new UI(this);
    this.player = new Player(this.world);
    this.world.walkOverride = (x, z) => this.walkOverride(x, z);
    this.dockY = this.world.dockY;
    this.cam = new THREE.Vector3();
    this.tweens = [];
    this.inter = [];
    this.fishing = null;
    this.cutscene = false;
    this.started = false;
    this.shake = 0;
    this.saveT = 0;
    this.areaKey = null;
    const raw = localStorage.getItem(SAVE_KEY);
    this.hasSave = !!raw;
    this.state = raw ? Object.assign(newState(), JSON.parse(raw)) : newState();
    this.flags = this.state.flags;
    try { const st = JSON.parse(localStorage.getItem('mapleRidgeSettings') || '{}'); for (const k of ['master', 'music', 'sfx']) if (st[k] != null) this.audio.vol[k] = st[k]; } catch { }
    this.buildEntities();
    if (!this.state.bagFish) { this.state.bagFish = { ...this.state.fish }; let fed = this.state.fedFish || 0; for (const k of Object.keys(this.state.bagFish)) { const t = Math.min(fed, this.state.bagFish[k]); this.state.bagFish[k] -= t; fed -= t; } }
    this.state.mats ||= {}; this.state.dug ||= {}; this.forageAt = {};
    this.buildCompanions();
    this.applyState();
    const sp = this.state.pos || [MAP.SPAWN.x * S, MAP.SPAWN.z * S];
    this.player.place(sp[0], sp[1], Math.PI);
    this.player.runUnlocked = !!this.state.upgrades.shoes;
    this.cam.copy(this.player.pos);
    this.ui.refreshHUD();
    if (this.input.touch) {
      this.$('touch').classList.remove('hidden'); document.body.classList.add('touch');
      this.input.bindTouch(this.$('stickzone'), this.$('stick'), this.$('knob'), this.$('tbtn-a'), this.$('tbtn-b'), this.$('tbtn-m'), this.$('tbtn-bag'));
    }
  }

  // ======================================================================================
  // helpers used by story.js
  has(k) { return !!this.state.inv[k]; }
  give(k) {
    if (this.state.inv[k]) return;
    this.state.inv[k] = 1;
    const names = { key: '工具棚鑰匙', gloves: '工作手套', rod: '釣竿', rope: '繩索', lantern: '提燈', hammer: '鐘槌' };
    const desc = { gloves: '可以推動大石頭了', rod: '面對水邊按 E 釣魚', rope: '可以修理壞掉的梯子', lantern: '可以點燈,也能照亮黑暗', hammer: '可以敲響回音鐘', key: '可以打開工具棚' };
    this.toast(`獲得「${names[k]}」── ${desc[k]}`, true);
    this.audio.item();
    this.ui.refreshHUD(); this.save();
  }
  setGoal(k) { this.state.goal = k; this.ui.refreshHUD(); this.save(); }
  toast(t, gold) { this.ui.toast(t, gold); }
  rand(n) { return Math.floor(Math.random() * n); }
  fishCount() { return Object.values(this.state.bagFish || {}).reduce((a, b) => a + b, 0); }
  catFollowing() { return !!this.flags.catFollow && !this.flags.catHome; }
  feedCat() { const k = Object.keys(this.state.bagFish).find(k => this.state.bagFish[k] > 0); if (k) this.state.bagFish[k]--; this.flags.catFollow = 1; this.audio.meow(); this.setGoal('catHome'); }
  catGoHome() { this.flags.catHome = 1; this.flags.catFollow = 0; const c = this.npcs.cat; c.home = V(19.0 * S, 0, 41.0 * S); this.audio.meow(); }
  completion() {
    const s = this.state;
    const n = Object.keys(s.postcards).length + Object.keys(s.leaves).length + Object.keys(s.fish).length + Object.keys(s.sketches).length + (s.flags.rang ? 1 : 0) + (s.flags.trueEnd ? 1 : 0);
    return Math.round(n / (5 + 20 + 6 + 4 + 2) * 100);
  }
  waitAdvance(ms) {
    return new Promise(res => {
      const t0 = performance.now();
      const chk = () => { if (performance.now() - t0 > ms || (performance.now() - t0 > 600 && this._advance)) { this._advance = false; res(); } else setTimeout(chk, 30); };
      this._advance = false; chk();
    });
  }
  uiBusy() { return this.ui.busy(); }
  // where the player is on the overworld map (inside a cave/house → its entrance)
  areaName() { if (this.curRoom && this.player.pos.x >= 500) return this.curRoom.name; return AREAS[this.areaKey]?.[0] || ''; }
  outsidePos() {
    const p = this.player.pos;
    if (p.x >= 500 && this.curRoom) return this.curRoom.outside;
    if (p.x > 250 && p.x < 490) return V(MAP.CAVE_DOOR.x * S, 0, MAP.CAVE_DOOR.z * S);
    return p;
  }
  // after a dialogue / fishing / cutscene: wait for the action key to be released + a short pause
  blockInteract(ms = 450) {
    this.interactAfter = performance.now() + ms; this.needRelease = true;
    // the thing we just used stays quiet until the player walks away from it
    if (this.activeInter) this.quiet = { it: this.activeInter, pos: this.player.pos.clone() };
    this.activeInter = null;
  }
  canInteract() {
    if (this.needRelease && !this.input.down('KeyE', 'Space', 'Enter')) this.needRelease = false;
    return !this.needRelease && performance.now() >= (this.interactAfter || 0);
  }
  saveSettings() { localStorage.setItem('mapleRidgeSettings', JSON.stringify(this.audio.vol)); }
  save() {
    if (!this.started) return;
    const s = this.state;
    if (this.player.pos.x < 250 && !this.player.lock) s.pos = [this.player.pos.x, this.player.pos.z];
    s.boulders = {}; for (const b of this.boulders) s.boulders[b.id] = [b.c, b.r, b.sunk ? 1 : 0];
    s.filled = [...this.filled];
    if (this.truck) s.truck = [this.truck.pos.x, this.truck.pos.z, this.truck.heading];
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  }

  // ======================================================================================
  buildEntities() {
    const w = this.world, sc = this.scene, H = (x, z) => w.heightAt(x, z);
    const addI = (o) => { this.inter.push(o); return o; };
    // ---------- NPCs
    this.npcs = {};
    for (const n of MAP.NPCS) {
      const x = n.x * S, z = n.z * S;
      const model = n.id === 'cat' ? buildCat() : buildCharacter(LOOKS[n.id]);
      model.traverse(o => o.layers.set(1));
      model.position.set(x, H(x, z), z);
      sc.add(model);
      const npc = { id: n.id, model, home: V(x, 0, z), pos: V(x, H(x, z), z), face: 0, coll: w.colliders.add({ x, z, r: n.id === 'cat' ? 0.3 : 0.38, npc: n.id }) };
      this.npcs[n.id] = npc;
      addI({ npc: n.id, get pos() { return npc.pos; }, r: 2.0, on: () => !(n.id === 'cat' && this.catFollowing()), label: () => n.id === 'cat' ? '摸摸貓' : `和${NAMES[n.id]}說話`, use: () => this.talkTo(n.id) });
    }
    this.npcs.amei.face = 0.3; this.npcs.wang.face = Math.PI / 2; this.npcs.chen.face = 0.6;
    // ---------- ducks & birds
    this.ducks = [];
    const duckSpots = [[30.4 * S, 31.2 * S, 0.9], [29.6 * S, 33.4 * S, 0.7], [30.2 * S, 29.8 * S, 0.5], [32 * S, 42 * S, 3.5], [29.5 * S, 40.5 * S, 2.6]];
    for (const [x, z, r] of duckSpots) {
      const d = buildDuck(); d.layers.set(0); sc.add(d);
      this.ducks.push({ m: d, cx: x, cz: z, r, a: Math.random() * 6, sp: 0.25 + Math.random() * 0.2 });
    }
    this.birds = [];
    for (const [x, z] of [[14, 47], [40, 46], [10, 32], [26, 24], [36, 14], [20, 5], [44, 34]]) {
      for (let i = 0; i < 4; i++) {
        const b = buildBird(); const bx = x * S / 2 + (Math.random() - 0.5) * 3, bz = z * S / 2 + (Math.random() - 0.5) * 3;
        b.position.set(bx, H(bx, bz) + 0.05, bz); sc.add(b);
        this.birds.push({ m: b, home: b.position.clone(), fly: 0, vel: V(0, 0, 0), t: Math.random() * 5 });
      }
    }
    this.buildRooms(addI);
    // ---------- mailbox / postcards
    this.cards = [];
    const env = () => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.34), P.M.white));
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.12), P.M.fire); st.position.set(0.15, 0.01, -0.08); g.add(st);
      return g;
    };
    for (const p of MAP.POSTCARDS) {
      let x = p.x * S, z = p.z * S;
      const inRoom = { p3: 'hut2', p4: 'hut3' }[p.id];
      if (inRoom) { const R = this.rooms[inRoom]; x = R.ox + R.cardAt[0]; z = R.oz + R.cardAt[1]; }
      let mesh = null;
      if (!p.inMailbox) { mesh = env(); mesh.position.set(x, H(x, z) + (inRoom ? 1.0 : 0.7), z); mesh.layers.enable(3); sc.add(mesh); }
      const card = { id: p.id, x, z, mesh, inRoom };
      this.cards.push(card);
      addI({ get pos() { return V(x, H(x, z), z); }, r: p.inMailbox ? 1.9 : inRoom ? 1.3 : 1.4, label: () => p.inMailbox ? '打開信箱' : '撿起明信片', on: () => !this.state.postcards[p.id], use: () => this.readCard(p.id) });
    }
    // ---------- golden leaves
    const leafShape = new THREE.Shape();
    const pts = [[0, 0.5], [0.12, 0.25], [0.4, 0.32], [0.26, 0.08], [0.46, -0.12], [0.16, -0.12], [0.05, -0.35], [-0.05, -0.35], [-0.16, -0.12], [-0.46, -0.12], [-0.26, 0.08], [-0.4, 0.32], [-0.12, 0.25]];
    leafShape.moveTo(...pts[0]); for (const p of pts.slice(1)) leafShape.lineTo(...p); leafShape.closePath();
    const leafGeo = new THREE.ExtrudeGeometry(leafShape, { depth: 0.06, bevelEnabled: false });
    const leafMat = new THREE.MeshBasicMaterial({ color: 0xffc23a });
    this.leaves = MAP.LEAVES.map(([mx, mz], i) => {
      const x = mx * S, z = mz * S;
      const m = new THREE.Mesh(leafGeo, leafMat); m.scale.setScalar(0.9);
      m.position.set(x, H(x, z) + 0.8, z); sc.add(m);
      return { i, x, z, m, y0: H(x, z) + 0.8 };
    });
    // ---------- tool shed
    // ---------- signs
    const signs = [['楓嶺村', 17.2, 44.2], ['步道 →', 19.4, 39.3], ['伐木營地', 32.6, 32.6], ['磨坊', 37.4, 24.4], ['古燈林', 17.6, 13.0], ['山頂 · 回音鐘', 14.2, 6.0]];
    for (const [t, mx, mz] of signs) addI({ pos: V(mx * S, 0, mz * S), r: 1.2, label: () => '看告示牌', use: () => this.ui.say([['', SIGNS[t]]]) });
    // ---------- boulders (sokoban)
    this.boulders = []; this.filled = new Set(this.state.filled || []);
    const mkB = (id, c, r, cave) => {
      const m = P.boulderMesh(c * 7 + r); sc.add(m);
      const b = { id, c, r, home: [c, r], cave, m, sunk: false, coll: null };
      const [x, z] = this.cellXZ(c, r, cave);
      b.coll = w.colliders.add({ x0: x - 0.92, x1: x + 0.92, z0: z - 0.92, z1: z + 0.92, boulder: b });
      this.boulders.push(b); this.placeBoulder(b);
      return b;
    };
    let bi = 0;
    for (const b of w.g.boulders) mkB(b.patch + (bi++), b.c, b.r, false);
    w.caveData.boulders.forEach((b, i) => mkB('cave' + i, b.c, b.r, true));
    // ---------- cave plates
    this.plates = w.caveData.plates.map(p => {
      const [x, z] = this.cellXZ(p.c, p.r, true);
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 1.5), P.M.stone); m.position.set(x, H(x, z) + 0.04, z); m.receiveShadow = true; sc.add(m);
      const rune = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.13, 0.6), P.M.lanternOff); rune.position.copy(m.position); rune.position.y += 0.01; sc.add(rune);
      return { ...p, m, rune };
    });
    // ---------- ladders
    this.ladders = MAP.LADDERS.map(L => {
      const x = (L.c + 0.5) * S, zw = L.r * S;
      const hb = H(x, zw + 0.9), ht = H(x, zw - 0.9);
      const lad = { ...L, x, zw, hb, ht, fixed: !!this.flags[L.id] };
      const mk = () => { const m = P.ladderMesh(ht - hb, !lad.fixed); m.position.set(x, hb, zw + 0.14); sc.add(m); return m; };
      lad.mesh = mk(); lad.rebuild = () => { sc.remove(lad.mesh); lad.mesh = mk(); };
      const use = (fromTop) => this.useLadder(lad, fromTop);
      addI({ pos: V(x, hb, zw + 0.9), r: 1.2, label: () => lad.fixed ? '爬梯子 ↑' : '壞掉的梯子', use: () => use(false) });
      addI({ pos: V(x, ht, zw - 0.8), r: 1.2, label: () => lad.fixed ? '爬梯子 ↓' : '壞掉的梯子', use: () => use(true) });
      return lad;
    });
    for (const l of this.ladders) this.ladders[l.id] = l;
    // ---------- lift
    {
      const x = (MAP.LIFT.c + 0.5) * S, zw = MAP.LIFT.r * S;
      const hb = H(x, zw + 1.0), ht = H(x, zw - 1.0);
      const m = P.lift(); m.position.set(x, hb, zw + 0.95); sc.add(m);
      for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, ht - hb + 2.2, 0.18), P.M.timber); post.position.set(x + s * 0.95, (hb + ht + 2.2) / 2, zw + 0.2); post.castShadow = true; sc.add(post); }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.2, 0.25), P.M.timber); beam.position.set(x, ht + 2.2, zw + 0.2); sc.add(beam);
      const gear = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.16, 8), P.M.metal); gear.rotation.x = Math.PI / 2; gear.position.set(x, ht + 2.2, zw + 0.42); sc.add(gear);
      this.lift = { x, zw, hb, ht, m, gear, up: false };
      addI({ pos: V(x, hb, zw + 1.0), r: 1.3, label: () => '搭升降台 ↑', use: () => this.useLift(true) });
      addI({ pos: V(x, ht, zw - 1.0), r: 1.3, label: () => '搭升降台 ↓', use: () => this.useLift(false) });
    }
    // ---------- mill
    this.buildMill();
    // ---------- lanterns
    this.lanterns = MAP.LANTERNS.map((L, i) => {
      const x = L.x * S, z = L.z * S;
      const m = P.stoneLantern(L.h); m.position.set(x, H(x, z), z); sc.add(m);
      w.colliders.add({ x, z, r: 0.45 });
      const lan = { i, x, z, m, lit: false };
      addI({ pos: V(x, 0, z), r: 1.4, label: () => lan.lit ? '石燈(已點亮)' : '點燈', on: () => !this.flags.doorOpen || true, use: () => this.lightLantern(lan) });
      return lan;
    });
    // ---------- cave door + mouths
    {
      const x = MAP.CAVE_DOOR.x * S, z = MAP.CAVE_DOOR.z * S;
      const d = P.caveDoor(); d.position.set(x, H(x, z + 0.8), z + 0.05); sc.add(d);
      const hole = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.1, 0.1), new THREE.MeshBasicMaterial({ color: 0x0c0a08 })); hole.position.set(x, H(x, z + 0.8) + 1.05, z - 0.02); sc.add(hole);
      this.door = { x, z, d, coll: w.colliders.add({ x0: x - 0.9, x1: x + 0.9, z0: z - 0.4, z1: z + 0.4 }) };
      addI({ pos: V(x, 0, z + 1.0), r: 1.4, label: () => this.flags.doorOpen ? '進入回音洞' : '刻著圓環的石門', use: () => this.flags.doorOpen ? this.enterCave() : this.ui.say([['小禾', '石門上刻著一個圓環。四周的地上有四盞石燈……看來要把燈點亮。']], 'me') });
      const mx = MAP.CAVE_MOUTH.x * S, mz = MAP.CAVE_MOUTH.z * S;
      const mouth = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.25, 10), P.M.stone); mouth.add(ring);
      const pit = new THREE.Mesh(new THREE.CircleGeometry(0.8, 10), new THREE.MeshBasicMaterial({ color: 0x0a0806 })); pit.rotation.x = -Math.PI / 2; pit.position.y = 0.13; mouth.add(pit);
      mouth.position.set(mx, H(mx, mz), mz); sc.add(mouth);
      w.colliders.add({ x: mx, z: mz, r: 0.9 });
      addI({ pos: V(mx, 0, mz + 1.1), r: 1.5, label: () => '下到回音洞', use: () => this.teleport(this.caveExitStand(), Math.PI, true) });
    }
    // cave: entrance (back to world), exit to summit, gate, chest, crystals
    {
      const cd = w.caveData;
      const [ex, ez] = this.cellXZ(cd.entry.c, cd.entry.r, true);
      addI({ pos: V(ex, 0, ez + 0.6), r: 1.3, label: () => '離開山洞', use: () => this.teleport(V(MAP.CAVE_DOOR.x * S, 0, MAP.CAVE_DOOR.z * S + 1.4), 0, false) });
      const [xx, xz] = this.cellXZ(cd.exit.c, cd.exit.r, true);
      const glow = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 1.8), new THREE.MeshBasicMaterial({ color: 0xbfe0ff })); glow.position.set(xx, H(xx, xz) + 0.03, xz); sc.add(glow);
      addI({ pos: V(xx, 0, xz), r: 1.4, label: () => '往上爬 → 山頂', use: () => this.toSummit() });
      const [gx, gz] = this.cellXZ(cd.gate.c, cd.gate.r, true);
      const gate = P.portcullis(1.9); gate.rotation.y = Math.PI / 2; gate.position.set(gx, H(gx, gz), gz); sc.add(gate);
      this.gate = { m: gate, y0: H(gx, gz), coll: w.colliders.add({ x0: gx - 1, x1: gx + 1, z0: gz - 1, z1: gz + 1 }) };
      const [cx, cz] = this.cellXZ(cd.chest.c, cd.chest.r, true);
      const ch = P.chest(); ch.position.set(cx, H(cx, cz), cz); sc.add(ch);
      w.colliders.add({ x: cx, z: cz, r: 0.5 });
      this.chest = { m: ch };
      addI({ pos: V(cx, 0, cz + 0.9), r: 1.3, label: () => this.has('hammer') ? '空箱子' : '打開箱子', use: () => this.openChest() });
      this.caveLights = [];
      for (const [c, r] of [[2, 2], [7, 1], [11, 1], [8, 10], [12, 9], [4, 6]]) {
        const [x, z] = this.cellXZ(c, r, true);
        const cr = P.crystal([0x9ad8e8, 0xc8a0f0, 0x9ae8c0][(c + r) % 3]); cr.position.set(x + 0.6, H(x, z), z - 0.6); sc.add(cr);
        this.caveLights.push(V(x + 0.6, H(x, z) + 0.4, z - 0.6));
      }
      this.caveLights.push(V(xx, H(xx, xz) + 0.4, xz));
      // reset hint stone in cave
      addI({ pos: V(ex, 0, ez - 1.6), r: 0.0, label: () => '', use: () => { } });
    }
    // ---------- bell
    {
      const x = MAP.BELL.x * S, z = MAP.BELL.z * S;
      const b = P.bellTower(); b.position.set(x, H(x, z), z); sc.add(b);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) w.colliders.add({ x: x + sx * 1.1, z: z + sz * 1.1, r: 0.25 });
      this.bell = { m: b, swing: 0, x, z };
      addI({ pos: V(x, 0, z + 1.6), r: 1.6, label: () => this.has('hammer') ? '敲響回音鐘' : '回音鐘', use: () => this.ringBell() });
    }
    // ---------- barricade (old trail shortcut)
    {
      const x = 12.25 * S, z = 17.75 * S;
      const m = P.barricade(); m.position.set(x, H(x, z - 0.5), z); sc.add(m);
      this.barricade = { m, x, z, coll: this.flags.barricade ? null : w.colliders.add({ x0: x - 1.4, x1: x + 1.4, z0: z - 0.35, z1: z + 0.35 }) };
      addI({ pos: V(x, 0, z), r: 1.6, on: () => !this.flags.barricade, label: () => this.player.pos.z < z ? '踢倒木頭' : '倒木', use: () => this.kickBarricade() });
    }
    // ---------- 林道 gate (opens once the trail boulder has been pushed aside)
    {
      const x = MAP.ROAD_GATE.x * S, z = MAP.ROAD_GATE.z * S, y = w.heightAt(x + 0.6, z);
      const g = new THREE.Group(); g.position.set(x, y, z);
      for (const dz of [-1.7, 1.7]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.5, 0.22), P.M.timber); post.position.set(0, 0.75, dz); post.castShadow = true; g.add(post); }
      for (const yy of [0.5, 1.05]) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 3.4), new THREE.MeshToonMaterial({ color: 0xc8402e, gradientMap: P.M.leaf.gradientMap })); bar.position.set(0, yy, 0); bar.castShadow = true; g.add(bar); const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.17, 0.5), P.M.white); stripe.position.set(0, yy, 0); g.add(stripe); }
      const sign = P.signpost('林道'); sign.position.set(0.7, 0, 2.4); g.add(sign);
      sc.add(g);
      this.roadGate = { g, coll: this.flags.tutorialDone ? null : w.colliders.add({ x0: x - 0.4, x1: x + 0.4, z0: z - 2.2, z1: z + 2.2 }) };
      this.roadGate.coll2 = this.flags.tutorialDone ? null : w.colliders.add({ x0: x - 0.6, x1: x + 0.4, z0: z + 1.6, z1: z + 3.2 });   // closes the gap to the rocks
      if (this.flags.tutorialDone) g.children.slice(2, 6).forEach(m => m.visible = false);
      addI({ pos: V(x + 1.2, 0, z), r: 1.6, on: () => !this.flags.tutorialDone, label: () => '林道柵欄', use: () => this.ui.say([['小禾', '「林道:車輛通行」。柵欄上掛著一張紙條:「步道口的大石頭推開之前,這裡先不開放。——楓嶺村」']], 'me') });
    }
    // ---------- sketch easels
    for (const sp of MAP.SKETCH) {
      const x = sp.x * S, z = sp.z * S;
      const e = P.easel(); e.position.set(x, H(x, z), z); e.rotation.y = 0.4; sc.add(e);
      w.colliders.add({ x, z, r: 0.35 });
      addI({ pos: V(x, 0, z + 0.4), r: 1.3, label: () => this.state.sketches[sp.id] ? `重新寫生「${sp.name}」` : `寫生「${sp.name}」`, use: () => this.sketch(sp) });
    }
    // ---------- fishing spots
    for (const f of MAP.FISH_SPOTS) {
      addI({ pos: V(f.x * S, 0, f.z * S), r: f.r * 1.2, on: () => this.has('rod'), label: () => '釣魚', use: () => this.startFishing(f) });
    }
    // ---------- shrine (secret)
    addI({ pos: V(51.2 * S, 0, 31.0 * S + 1.0), r: 1.3, label: () => '小神社', use: () => this.ui.say([['小禾', '小小的神社,供著一顆松果和一張褪色的照片——照片裡是年輕的爺爺,和一個笑得很大聲的女孩。']], 'me') });
    // ---------- falling leaves particles
    {
      const n = 90, g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
      const pal = [[0.9, 0.42, 0.12], [0.85, 0.25, 0.1], [0.95, 0.7, 0.2], [0.75, 0.35, 0.1]];
      for (let i = 0; i < n; i++) { const c = pal[i % 4]; col.set(c, i * 3); }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true }));
      pts.frustumCulled = false; pts.layers.set(3); sc.add(pts);
      this.particles = { pts, n, seeds: [...Array(n)].map(() => ({ x: Math.random(), y: Math.random(), z: Math.random(), s: 0.5 + Math.random() })) };
    }
    // fishing bobber
    this.bobber = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), P.M.fire); this.bobber.visible = false; sc.add(this.bobber);
  }

  buildCompanions() {
    const sc = this.scene, w = this.world;
    // heart sprite for petting
    const cv = document.createElement('canvas'); cv.width = 9; cv.height = 8; const c = cv.getContext('2d');
    ['.rr...rr.', 'rRRr.rRRr', 'rRRRrRRRr', 'rRRRRRRRr', '.rRRRRRr.', '..rRRRr..', '...rRr...', '....r....'].forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') { c.fillStyle = ch === 'r' ? '#8a1a2a' : '#f0506a'; c.fillRect(x, y, 1, 1); } }));
    const tex = new THREE.CanvasTexture(cv); tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
    this.heartSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true })); this.heartSprite.scale.set(0.45, 0.4, 1); this.heartSprite.layers.set(3);
    // pet
    this.pet = new Pet(this);
    const game = this;
    this.inter.push({ lowPri: true, get pos() { return game.pet.pos; }, r: 1.6, on: () => !this.truck?.driving, label: () => this.pet.label(), use: () => this.pet.interact() });
    // truck
    const tp = this.state.truck || [6.2 * S, 46.0 * S, Math.PI / 2];
    this.truck = new Truck(this, tp[0], tp[1], tp[2]);
    if (this.truck.snapToRoad() === false && this.world.roadInfo(this.truck.pos.x, this.truck.pos.z).d > 0.3) { this.truck.pos.set(6.2 * S, 0, 46.0 * S); this.truck.heading = Math.PI / 2; this.truck.sync(); }
    this.inter.push({ get pos() { return game.truck.pos; }, r: 2.3, on: () => !this.truck.driving, label: () => this.has('truckKey') ? '開「小藍」' : '藍色小貨車', use: () => this.enterTruck() });
    // forage nodes: pine cones, berries, mushrooms near the trails (they grow back)
    const r = mulberry(99), F = [];
    for (let i = 0; i < 4000 && F.length < 44; i++) {
      const x = 6 + r() * 98, z = 6 + r() * 88;
      const d = w.pathDist(x, z);
      if (d < 0.4 || d > 2.6 || w.main.isWater(x, z) || w.main.flatness(x, z, 0.4) > 0.2 || w.colliders.hit(x, z, 0.5)) continue;
      if (F.some(f => Math.hypot(f.x - x, f.z - z) < 7)) continue;
      const L = w.main.levelAt(x, z);
      const kind = L >= 3 ? 'pinecone' : ['berry', 'mushroom', 'pinecone'][F.length % 3];
      F.push({ i: F.length, x, z, kind });
    }
    const gm = P.M.leaf.gradientMap;
    const berryMat = new THREE.MeshToonMaterial({ color: 0xb82a3a, gradientMap: gm }), capMat = new THREE.MeshToonMaterial({ color: 0xc23a26, gradientMap: gm }), bushMat = new THREE.MeshToonMaterial({ color: 0x4f7a2b, gradientMap: gm });
    for (const f of F) {
      const g = new THREE.Group();
      if (f.kind === 'berry') { const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), bushMat); bush.position.y = 0.22; bush.scale.y = 0.75; g.add(bush); for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), berryMat); b.position.set(Math.cos(k * 1.7) * 0.24, 0.3 + (k % 2) * 0.1, Math.sin(k * 1.7) * 0.24); g.add(b); } }
      else if (f.kind === 'mushroom') { for (let k = 0; k < 2; k++) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.14, 5), P.M.white); st.position.set(k * 0.2, 0.07, k * 0.1); g.add(st); const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.05, 0.16, 6), capMat); cap.position.set(k * 0.2, 0.16, k * 0.1); cap.scale.setScalar(1 - k * 0.3); g.add(cap); } }
      else { const pc = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 6), P.M.wood); pc.rotation.z = 1.4; pc.position.y = 0.1; g.add(pc); }
      g.traverse(o => { if (o.isMesh) o.castShadow = true; });
      g.position.set(f.x, w.heightAt(f.x, f.z), f.z); sc.add(g); f.m = g;
    }
    this.forage = F;
    // dig spots (only the pet can find them)
    const ds = [[6, 44], [24, 47], [44, 44], [8, 33], [26, 31], [40, 33], [14, 24], [30, 25], [8, 13], [28, 15], [18, 4], [36, 6]];
    this.digSpots = ds.map(([x, z], i) => ({ i, x: x * S, z: z * S })).filter(d => !this.world.main.isWater(d.x, d.z));
  }
  firstFood() {
    const s = this.state;
    for (const id of ['treat', 'berry', 'mushroom', 'pinecone']) if ((s.mats[id] || 0) > 0) return { id, name: ITEMS[id].name, love: ITEMS[id].love };
    const fk = Object.keys(s.bagFish || {}).find(k => s.bagFish[k] > 0);
    return fk ? { id: fk, name: fk, love: 3, fish: true } : null;
  }
  consumeFood(f) { if (f.fish) this.state.bagFish[f.id]--; else this.state.mats[f.id]--; this.ui.refreshHUD(); }
  useItem(sel) {
    if (sel.it.use === 'whistle') return this.whistlePet();
    if (sel.it.use === 'feed' && this.pet?.adopted) {
      this.consumeFood({ id: sel.id, fish: !!sel.it.fish });
      this.pet.love(sel.it.love || 1); this.pet.hearts(); this.audio.bark();
      this.toast(`豆豆開心地吃掉了${sel.it.name}!`);
    }
  }
  whistlePet() {
    if (!this.pet?.adopted) return;
    this.audio.dogWhistle();
    const p = this.player;
    setTimeout(() => { this.pet.warp(V(p.pos.x - Math.sin(p.face) * 1.2, 0, p.pos.z - Math.cos(p.face) * 1.2)); this.audio.bark(); }, 500);
  }
  digUp(spot) {
    if (this.state.dug[spot.i]) return;
    this.state.dug[spot.i] = 1;
    const loot = ['treat', 'berry', 'mushroom', 'pinecone'][spot.i % 4];
    this.audio.thunk(); this.addMat(loot, 2);
    this.toast('豆豆挖出了寶物!', true);
  }
  async enterTruck() {
    if (!this.has('truckKey')) return this.ui.say([['小禾', '爺爺的藍色小貨車「小藍」。車門鎖著——鑰匙大概在爺爺家裡。']], 'me');
    const t = this.truck; t.snapToRoad(); t.driving = true; this.player.model.visible = false;
    this.pr.zoom = 0.8; this.pr.updateFrustum();
    this.audio.thunk(); this.quietHere();
    if (!this.flags.drove) { this.flags.drove = 1; this.toast('開車:往哪推就往哪開 · Shift 加速 · H 喇叭 · E 下車'); }
  }
  exitTruck() {
    const t = this.truck, p = this.player;
    for (const side of [-1.6, 1.6, -2.4, 2.4]) {
      const q = t.localToWorld(side, 0, 0);
      if (!this.world.colliders.hit(q.x, q.z, 0.35, t.coll) && p.standable(q.x, q.z, t.pos.y)) {
        t.driving = false; t.speed = 0; t.sync();
        p.place(q.x, q.z, t.heading); p.model.visible = true;
        this.pr.zoom = 1; this.pr.updateFrustum(); this.audio.engine(-1); this.audio.thunk(); this.quietHere(); this.save();
        return;
      }
    }
    this.toast('這裡沒地方下車');
  }
  buildRooms(addI) {
    const w = this.world;
    this.rooms = buildInteriors(this.scene, P.M.leaf.gradientMap);
    const DOOR = { barn: -0.4, tudor: 0.2, shed: 0, hut: -0.3, mill: -0.5 };
    for (const h of MAP.HOUSES) {
      const R = this.rooms[h.id]; if (!R) continue;
      const hx = h.x * S + (DOOR[h.style] || 0), hz = h.z * S + h.d / 2;
      R.outside = V(hx, 0, hz + 1.3);
      const enter = () => this.enterRoom(R);
      addI({ pos: V(hx, 0, hz + 0.7), r: 1.3, label: () => `進入${R.name}`, use: () => {
        if (h.id === 'shed' && !this.has('key')) return this.ui.say([['小禾', '門鎖著。爺爺的明信片說,鑰匙在「村裡最愛說話的人」手上。']], 'me');
        if (h.id === 'shed' && !this.flags.shedOpened) { this.flags.shedOpened = 1; this.audio.thunk(); }
        enter();
      } });
      // walls
      const x0 = R.ox - R.w / 2, x1 = R.ox + R.w / 2, z0 = R.oz - R.d / 2, z1 = R.oz + R.d / 2;
      w.colliders.add({ x0: x0 - 1, x1: x1 + 1, z0: z0 - 1, z1: z0 + 0.15 });
      w.colliders.add({ x0: x0 - 1, x1: x0 + 0.15, z0: z0 - 1, z1: z1 + 1 });
      w.colliders.add({ x0: x1 - 0.15, x1: x1 + 1, z0: z0 - 1, z1: z1 + 1 });
      w.colliders.add({ x0: x0 - 1, x1: x1 + 1, z0: z1 - 0.2, z1: z1 + 1 });
      for (const list of Object.values(R.objs)) for (const o of list) if (o.userData.coll) { const [a, b, c, d] = o.userData.coll; w.colliders.add({ x0: a, x1: b, z0: c, z1: d }); }
      addI({ pos: V(R.ox, 0, z1 - 0.6), r: 1.1, label: () => '離開', use: () => this.leaveRoom(R) });
      // examinable spots
      const texts = ROOM_TEXT[h.id] || {};
      for (const [k, [sx, sz]] of Object.entries(R.spots)) {
        const pos = V(R.ox + sx, 0, R.oz + sz);
        const act = this.roomAction(h.id, k, R);
        if (!act && !texts[k]) continue;
        addI({ pos, r: 1.0, on: () => !act || !act.on || act.on(), label: () => act?.label?.() || '調查', use: () => act?.use ? act.use(texts[k]) : this.ui.say(texts[k].map(t => Array.isArray(t) ? t : ['小禾', t]), 'me') });
      }
    }
  }
  roomAction(room, key, R) {
    const say = (lines) => this.ui.say(lines.map(t => Array.isArray(t) ? t : ['小禾', t]), 'me');
    if (room === 'cabin' && key === 'desk') return { label: () => '看看書桌', use: async (txt) => {
      await say(txt);
      if (!this.has('truckKey')) { await say(['書桌的抽屜卡住了……用力一拉——', '抽屜裡有一把掛著松果的鑰匙。是爺爺那台藍色小貨車「小藍」的鑰匙!']); this.give('truckKey'); }
    } };
    if (room === 'cabin' && key === 'doorframe') return { use: (txt) => say(this.flags.rang ? [...txt, '最上面那條旁邊,不知道什麼時候多了一行小字:「長得比我高了。」'] : txt) };
    if (room === 'cabin' && key === 'dogbed') return { use: (txt) => say(this.pet?.adopted ? ['豆豆的新家。牠已經把這裡當成自己的窩了。'] : txt) };
    if (room === 'shed' && key === 'gloves') return { on: () => !this.has('gloves'), label: () => '拿下手套', use: async () => {
      R.objs.pegboard[0].userData.gloves.visible = false;
      await say(['牆上掛著一雙磨得發亮的工作手套,上面用麥克筆寫著:「小禾專用」。']);
      this.give('gloves'); this.setGoal('boulder');
      await say(['……爺爺早就準備好了。']);
    } };
    if (room === 'amei' && key === 'jar') return { label: () => '狗餅乾罐', use: async () => {
      const now = this.state.time;
      if (this.state.treatAt && now - this.state.treatAt < 90) return say(['罐子空了。阿梅奶奶在外面喊:「下一批還在烤!等一下再來!」']);
      this.state.treatAt = now; this.addMat('treat', 3);
      await this.ui.say([['阿梅奶奶', '(從門外喊)狗餅乾?拿去拿去,別客氣!那隻在你爺爺家附近晃的小狗最愛吃了。']], 'amei');
    } };
    if (room === 'mill' && key === 'gears') return { use: () => say([this.flags.millFixed ? '齒輪喀啦喀啦地轉著,整間磨坊都在微微震動。阿松說這是「全世界最好聽的論文口試」。' : '巨大的齒輪,三年沒動了。上面結著一層薄薄的蜘蛛網。']) };
    return null;
  }
  async enterRoom(R) {
    this.curRoom = R;
    this.pr.zoom = R.w > 7 ? 1.55 : 1.85; this.pr.updateFrustum();
    await this.teleport(V(R.ox, 0, R.oz + R.d / 2 - 1.0), Math.PI, false);
    if (this.pet?.adopted) this.pet.warp(V(R.ox + 0.8, 0, R.oz + R.d / 2 - 1.2));
  }
  async leaveRoom(R) {
    await this.teleport(R.outside.clone(), 0, false);
    this.pr.zoom = 1; this.pr.updateFrustum();
    if (this.pet?.adopted) this.pet.warp(R.outside.clone().add(V(0.9, 0, 0.4)));
  }
  addMat(id, n = 1) {
    const m = this.state.mats || (this.state.mats = {});
    m[id] = (m[id] || 0) + n;
    this.toast(`獲得 ${({ pinecone: '松果', berry: '野莓', mushroom: '香菇', treat: '狗餅乾' })[id]} ×${n}`);
    this.audio.leaf(); this.save();
  }
  openRoadGate() {
    const rg = this.roadGate; if (!rg || !rg.coll) return;
    this.world.colliders.remove(rg.coll); rg.coll = null; if (rg.coll2) { this.world.colliders.remove(rg.coll2); rg.coll2 = null; }
    const bars = rg.g.children.slice(2, 6);
    this.tween(0.8, k => bars.forEach(b => { b.rotation.x = -k * 1.4; b.position.y = (b.userData.y0 ??= b.position.y) + k * 0.6; })).then(() => bars.forEach(b => b.visible = false));
  }
  buildMill() {
    const w = this.world, sc = this.scene, M = MAP.MILL, H = (x, z) => w.heightAt(x, z);
    const N = M.nodes;
    const gy = MAP.STEP * 2 + M.troughY;
    const segs = [['S', 'G1'], ['G1', 'J'], ['J', 'G2'], ['G2', 'X'], ['J', 'G3'], ['G3', 'G4'], ['G4', 'W']];
    this.mill = { segs: {}, gates: {}, levers: [], wheel: null, turning: false, spin: 0 };
    const wetMat = new THREE.MeshBasicMaterial({ color: 0x8ac8d0 });
    for (const [a, b] of segs) {
      const [ax, az] = N[a], [bx, bz] = N[b];
      const L = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bz - az, bx - ax);
      const g = new THREE.Group(); g.position.set((ax + bx) / 2, gy, (az + bz) / 2); g.rotation.y = -ang;
      const base = new THREE.Mesh(new THREE.BoxGeometry(L + 0.3, 0.12, 0.6), P.M.wood); base.castShadow = true; g.add(base);
      for (const s of [-1, 1]) { const side = new THREE.Mesh(new THREE.BoxGeometry(L + 0.3, 0.3, 0.08), P.M.wood); side.position.set(0, 0.15, s * 0.28); side.castShadow = true; g.add(side); }
      const water = new THREE.Mesh(new THREE.BoxGeometry(L + 0.3, 0.06, 0.46), wetMat); water.position.y = 0.1; water.visible = false; g.add(water);
      sc.add(g);
      // posts
      const n = Math.max(1, Math.round(L / 1.6));
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, hy = H(x, z);
        if (gy - hy < 0.3) continue;
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, gy - hy, 0.14), P.M.timber); post.position.set(x, (gy + hy) / 2, z); post.castShadow = true; sc.add(post);
        if (i > 0 && i < n) w.colliders.add({ x, z, r: 0.12 });
      }
      this.mill.segs[a + b] = water;
    }
    // spill: water falling from X to the ground, and from S down the cliff (source)
    const [xx, xz] = N.X;
    const spill = new THREE.Mesh(new THREE.BoxGeometry(0.4, gy - H(xx - 0.4, xz), 0.4), wetMat); spill.position.set(xx - 0.3, (gy + H(xx - 0.4, xz)) / 2, xz); spill.visible = false; sc.add(spill);
    this.mill.spill = spill;
    const [wx, wz] = N.W;
    const pour = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.4), wetMat); pour.position.set(wx, gy - 0.35, wz + 0.3); pour.visible = false; sc.add(pour);
    this.mill.pour = pour;
    for (const k of ['G1', 'G2', 'G3', 'G4']) {
      const [x, z] = N[k];
      const board = P.gateBoard(); board.scale.set(1, 1, 0.75); sc.add(board);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 0.12), P.M.timber); frame.position.set(x, gy + 0.5, z - 0.38); sc.add(frame);
      const frame2 = frame.clone(); frame2.position.z = z + 0.38; sc.add(frame2);
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.9), P.M.timber); top.position.set(x, gy + 1.2, z); sc.add(top);
      const label = this.numberSprite(k.slice(1)); label.position.set(x, gy + 1.65, z); sc.add(label);
      // orient: gates on N-S runs rotate
      const isNS = k === 'G3' || k === 'G4';
      if (isNS) { board.rotation.y = Math.PI / 2; frame.position.set(x - 0.38, gy + 0.5, z); frame2.position.set(x + 0.38, gy + 0.5, z); top.rotation.y = Math.PI / 2; }
      board.position.set(x, gy, z);
      this.mill.gates[k] = { board, x, z, gy };
    }
    const [whx, whz] = M.wheel;
    const wheel = P.millWheel(); wheel.position.set(whx, H(whx, whz) + 1.6, whz); sc.add(wheel);
    const pier = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.7, 0.5), P.M.stone); pier.position.set(whx, H(whx, whz) + 0.85, whz - 0.45); sc.add(pier);
    const axle = new THREE.Mesh(new THREE.BoxGeometry(whx - 83.8, 0.16, 0.16), P.M.timber); axle.position.set((whx + 83.8) / 2, H(whx, whz) + 1.6, whz - 0.3); sc.add(axle);
    w.colliders.add({ x0: whx - 1.4, x1: whx + 1.4, z0: whz - 0.7, z1: whz + 0.4 });
    this.mill.wheel = wheel;
    M.levers.forEach(([x, z], i) => {
      const lv = P.lever(); lv.position.set(x, H(x, z), z); lv.rotation.y = Math.PI / 2; sc.add(lv);
      w.colliders.add({ x, z, r: 0.32 });
      const num = this.numberSprite(String(i + 1), '#3a2a1e'); num.position.set(x - 0.5, H(x, z) + 0.9, z); sc.add(num);
      const lever = { i, m: lv, on: false };
      this.mill.levers.push(lever);
      const tg = M.toggles[i].map(g => g.slice(1)).join('、');
      this.inter.push({ pos: V(x - 0.7, 0, z), r: 1.0, label: () => `拉桿 ${i + 1}(閘門 ${tg})`, use: () => this.pullLever(lever) });
    });
    // gate number board near levers
  }
  numberSprite(t, col = '#fff6e0') {
    const cv = document.createElement('canvas'); cv.width = 16; cv.height = 16;
    const c = cv.getContext('2d'); c.fillStyle = '#3a2a1e'; c.fillRect(2, 2, 12, 12); c.fillStyle = col === '#3a2a1e' ? '#f3e6c8' : '#d8702a'; c.fillRect(3, 3, 10, 10);
    c.fillStyle = col === '#3a2a1e' ? '#3a2a1e' : '#fff6e0'; c.font = 'bold 11px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, 8, 9);
    const tex = new THREE.CanvasTexture(cv); tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex })); s.scale.set(0.55, 0.55, 1); s.layers.set(3);
    return s;
  }

  cellXZ(c, r, cave) { return cave ? [MAP.CAVE_OX + (c + 0.5) * S, MAP.CAVE_OZ + (r + 0.5) * S] : [(c + 0.5) * S, (r + 0.5) * S]; }
  placeBoulder(b) {
    const [x, z] = this.cellXZ(b.c, b.r, b.cave);
    const w = this.world;
    if (b.sunk) {
      const ws = w.main.waterSurfaceAt(x, z) ?? w.heightAt(x, z);
      b.m.position.set(x, ws - 0.42, z); b.m.scale.set(1.05, 0.8, 1.05);
    } else { b.m.position.set(x, w.heightAt(x, z) - 0.06, z); b.m.scale.set(1, 1, 1); }
    b.coll.off = b.sunk;
    w.colliders.move(b.coll, x, z);
  }

  applyState() {
    const s = this.state, f = this.flags;
    for (const b of this.boulders) { const v = s.boulders[b.id]; if (v) { b.c = v[0]; b.r = v[1]; b.sunk = !!v[2]; this.placeBoulder(b); } }
    if (f.catHome) { this.npcs.cat.home = V(19.0 * S, 0, 41.0 * S); this.npcs.cat.pos.copy(this.npcs.cat.home); }
    for (const id of ['LD1', 'LD2', 'LD3']) if (f[id]) { this.ladders[id].fixed = true; this.ladders[id].rebuild(); }
    for (const k of Object.keys(this.mill.gates)) this.setGateVisual(k);
    this.mill.levers.forEach((l, i) => { l.on = !!(s.levers && s.levers[i]); l.m.userData.arm.rotation.z = l.on ? -0.7 : 0.7; });
    this.updateFlow();
    if (f.doorOpen) { this.door.d.userData.slab.position.y = -2.3; this.world.colliders.remove(this.door.coll); this.lanterns.forEach(l => this.setLit(l, true)); }
    else for (const i of s.lit || []) this.setLit(this.lanterns[i], true);
    if (f.gateOpen) { this.gate.m.position.y = this.gate.y0 + 2.2; this.gate.coll.off = true; }
    if (s.inv.hammer) this.chest.m.userData.lid.rotation.x = -1.6;
    if (f.barricade) { this.barricade.m.visible = false; }
    for (const c of this.cards) if (s.postcards[c.id] && c.mesh) c.mesh.visible = false;
    for (const l of this.leaves) if (s.leaves[l.i]) l.m.visible = false;
    if (s.postcards.p1) this.world.decor.mailbox.userData.flag.rotation.z = 1.4;
  }

  // ======================================================================================
  // interactions
  async talkTo(id) {
    const npc = this.npcs[id];
    npc.facePlayer = 1.5;
    if (id === 'cat') this.audio.meow();
    await this.ui.say(talk(id, this), id);
    this.ui.refreshHUD();
    this.save();
  }
  ameiShop() {
    const n = Object.keys(this.state.leaves).length;
    const next = UPGRADES.find(u => !this.state.upgrades[u.id]);
    if (next && n >= next.n) {
      return [next.line, { do: () => { this.state.upgrades[next.id] = 1; if (next.id === 'shoes') this.player.runUnlocked = true; this.toast(`獲得「${next.name}」── ${next.desc}`, true); this.audio.item(); this.ui.refreshHUD(); } },
        ...(UPGRADES.find(u => !this.state.upgrades[u.id] && u.id !== next.id) ? ['山裡還有更多金楓葉。下次再拿來給我看看吧!'] : [])];
    }
    const lines = [
      `金楓葉?你有 ${n} 片了。${next ? `收集到 ${next.n} 片的時候來找我,我有好東西給你。` : '你已經全部找齊了,真了不起。'}`,
      '你爺爺年輕的時候,每年秋天都會帶一片金楓葉給我。後來我才知道,那是他在路邊撿的普通葉子塗上油漆。',
      '池塘的王伯又在吹牛了吧?他說的話打個對折,再打個對折,大概就是真的。',
      '麻糬最近胖了。不是我餵的。好吧,是我餵的。',
      this.flags.rang ? '昨晚我聽到鐘聲了。好久沒聽到了……我還以為是我的耳鳴。' : '山頂的鐘?我年輕時也爬上去過。下山的時候,你爺爺背著我。他說是因為我扭到腳——其實我沒有。',
    ];
    return [lines[this.rand(lines.length)]];
  }
  async readCard(id) {
    if (this.state.postcards[id]) return;
    this.state.postcards[id] = 1;
    const c = this.cards.find(c => c.id === id);
    if (c.mesh) c.mesh.visible = false;
    if (id === 'p1') this.world.decor.mailbox.userData.flag.rotation.z = 1.4;
    this.audio.card();
    const [title, text] = POSTCARD_TEXT[id];
    this.toast(`獲得 ${title}(${Object.keys(this.state.postcards).length}/5)`, true);
    await this.ui.say([['爺爺', text]], 'grandpa');
    if (id === 'p1' && this.state.goal === 'start') this.setGoal('key');
    this.ui.refreshHUD(); this.save();
  }
  async openShed() {
    if (this.has('gloves')) return this.ui.say([['小禾', '工具棚裡只剩下一把生鏽的鋸子,和一張寫著「別偷看」的紙條。我偷看了,背面是空白的。']], 'me');
    if (!this.has('key')) return this.ui.say([['小禾', '門鎖著。爺爺的明信片說,鑰匙在「村裡最愛說話的人」手上。']], 'me');
    this.audio.thunk();
    await this.ui.say([['小禾', '門咿呀一聲開了。牆上掛著一雙磨得發亮的工作手套,上面用麥克筆寫著:「小禾專用」。'], { do: () => { this.give('gloves'); this.setGoal('boulder'); } }, ['小禾', '……爺爺早就準備好了。']], 'me');
  }
  async useLadder(lad, fromTop) {
    if (!lad.fixed) {
      if (!this.has('rope')) return this.ui.say([['小禾', '梯子壞了,少了好幾根橫木。要是有繩子就能綁起來……']], 'me');
      this.audio.thunk();
      lad.fixed = true; this.flags[lad.id] = 1; lad.rebuild();
      this.toast('用繩索修好了梯子!');
      if (lad.id === 'LD1' && this.state.goal === 'ladder') this.setGoal('mill');
      this.save();
      return;
    }
    const p = this.player;
    const b = V(lad.x, lad.hb, lad.zw + 0.9), t = V(lad.x, lad.ht, lad.zw - 0.8);
    const w0 = V(lad.x, lad.hb, lad.zw + 0.45), w1 = V(lad.x, lad.ht + 0.05, lad.zw + 0.45);
    const path = fromTop ? [t, V(lad.x, lad.ht, lad.zw + 0.45), w1, w0, b] : [b, w0, w1, V(lad.x, lad.ht, lad.zw + 0.45), t];
    await this.scripted(path, [0.25, 0.2, 0.25 + (lad.ht - lad.hb) * 0.22, 0.25], 'climb', Math.PI);
  }
  async useLift(up) {
    if (!this.flags.millFixed) return this.ui.say([['小禾', '升降台一動也不動。上面的齒輪用皮帶連著……磨坊的水車?']], 'me');
    const L = this.lift, p = this.player;
    const yA = up ? L.hb : L.ht, yB = up ? L.ht : L.hb;
    const platZ = L.zw + 0.95;
    if ((L.up ? L.ht : L.hb) !== yA) await this.tween(1.2, (k) => { L.m.position.y = (L.up ? L.ht : L.hb) + (yA - (L.up ? L.ht : L.hb)) * ease(k); });
    L.up = !up;
    this.audio.thunk();
    const start = p.pos.clone(), on = V(L.x, yA + 0.14, platZ);
    await this.scripted([start, on], [0.4], 'walk', Math.PI);
    p.lock = 99;
    await this.tween(2.4, (k) => {
      const y = yA + (yB - yA) * ease(k);
      L.m.position.y = y; p.pos.set(L.x, y + 0.14, platZ); p.model.position.copy(p.pos); L.gear.rotation.z += 0.08;
    });
    L.up = up;
    const off = V(L.x, yB, up ? L.zw - 1.1 : L.zw + 2.0);
    p.lock = 0;
    await this.scripted([p.pos.clone(), off], [0.45], 'walk', up ? Math.PI : 0);
    this.audio.thunk();
    if (up && this.state.goal === 'lift') this.setGoal('lanterns');
  }
  pullLever(lv) {
    if (this.flags.millFixed) return this.ui.say([['小禾', '水車轉得正順,還是別亂動比較好。']], 'me');
    lv.on = !lv.on;
    this.state.levers = this.mill.levers.map(l => l.on ? 1 : 0);
    this.tween(0.25, (k) => { lv.m.userData.arm.rotation.z = (lv.on ? 1 : -1) * (0.7 - 1.4 * ease(k)); });
    this.audio.thunk();
    for (const g of MAP.MILL.toggles[lv.i]) { this.state.gates[g] = this.state.gates[g] ? 0 : 1; this.setGateVisual(g, true); }
    setTimeout(() => this.updateFlow(true), 300);
  }
  setGateVisual(k, anim) {
    const g = this.mill.gates[k], open = !!this.state.gates[k];
    const y1 = open ? g.gy + 0.75 : g.gy;
    if (anim) { const y0 = g.board.position.y; this.tween(0.35, (t) => { g.board.position.y = y0 + (y1 - y0) * ease(t); }); }
    else g.board.position.y = y1;
  }
  updateFlow(check) {
    const G = this.state.gates, s = this.mill.segs;
    const wet = { SG1: true };
    wet.G1J = !!G.G1; wet.JG2 = wet.G1J; wet.G2X = wet.JG2 && !!G.G2; wet.JG3 = wet.G1J; wet.G3G4 = wet.JG3 && !!G.G3; wet.G4W = wet.G3G4 && !!G.G4;
    for (const k of Object.keys(s)) s[k].visible = !!wet[k];
    this.mill.spill.visible = !!wet.G2X;
    this.mill.pour.visible = !!wet.G4W;
    const turning = wet.G4W && !G.G2;
    this.mill.leaky = wet.G4W && !!G.G2;
    if (turning && !this.flags.millFixed) {
      this.flags.millFixed = 1;
      if (check) {
        this.audio.solve(); this.shake = 0.5;
        this.toast('水車轉起來了!', true);
        this.setGoal('millDone');
        setTimeout(() => this.ui.say([['阿松', '轉……轉了!!它轉了!!快過來,我有東西要給你!']], 'song'), 900);
      }
      this.save();
    } else if (check && this.mill.leaky) this.toast('水流到水車了,可是有一半從閘門 2 漏掉……');
    this.mill.turning = !!this.flags.millFixed;
  }
  setLit(l, on) {
    l.lit = on;
    l.m.userData.light.material = on ? P.M.lanternGlow : P.M.lanternOff;
  }
  async lightLantern(l) {
    if (this.flags.doorOpen) return;
    if (!this.has('lantern')) return this.ui.say([['小禾', '古老的石燈,燈芯還在。需要火……或是一盞提燈。']], 'me');
    if (l.lit) return;
    const lit = this.state.lit || (this.state.lit = []);
    const expect = MAP.LANTERN_ORDER[lit.length];
    if (l.i !== expect) {
      this.setLit(l, true); this.audio.whoosh();
      await sleep(350);
      this.audio.wrong();
      for (const x of this.lanterns) this.setLit(x, false);
      this.state.lit = [];
      this.toast('燈火一陣搖晃,全部熄滅了……順序不對?');
      this.flags.lanternFails = (this.flags.lanternFails || 0) + 1;
      if (this.flags.lanternFails === 3 && !this.state.postcards.p4) this.toast('(提示:雲海平台的小屋裡好像有什麼)');
      return;
    }
    this.setLit(l, true); lit.push(l.i); this.audio.whoosh();
    if (lit.length === 4) {
      this.flags.doorOpen = 1; this.save();
      await sleep(500);
      this.audio.solve(); this.cutscene = true;
      const d = this.door;
      this.audio.rumble(); this.shake = 1.5;
      const fromCam = this.cam.clone();
      await this.tween(1.0, k => { this.cam.lerpVectors(fromCam, V(d.x, this.world.heightAt(d.x, d.z + 1) + 1, d.z + 2), ease(k)); this.pr.setTarget(this.cam); });
      await this.tween(1.8, k => { d.d.userData.slab.position.y = -2.3 * ease(k); });
      this.world.colliders.remove(d.coll);
      this.cutscene = false;
      this.setGoal('cave');
      this.toast('石門打開了!', true);
    }
    this.save();
  }
  async kickBarricade() {
    if (this.player.pos.z > this.barricade.z) return this.ui.say([['小禾', '倒下的木頭把步道堵死了。從這一側推不動……從上面那一側也許可以。']], 'me');
    this.audio.push(); this.shake = 0.6;
    this.flags.barricade = 1;
    this.world.colliders.remove(this.barricade.coll);
    const m = this.barricade.m, y0 = m.position.y, z0 = m.position.z;
    await this.tween(0.9, k => { m.position.z = z0 + k * 3.5; m.position.y = y0 - k * k * 4; m.rotation.x = k * 3; });
    m.visible = false;
    this.audio.rumble();
    this.toast('舊步道通了!可以直接下到山腰。');
    this.save();
  }
  async enterCave() {
    await this.teleport(this.caveEntryStand(), Math.PI, true);
    if (this.state.goal === 'cave') this.setGoal('hammer');
  }
  caveEntryStand() { const cd = this.world.caveData; const [x, z] = this.cellXZ(cd.entry.c, cd.entry.r, true); return V(x, 0, z - 0.2); }
  caveExitStand() { const cd = this.world.caveData; const [x, z] = this.cellXZ(cd.exit.c - 1, cd.exit.r, true); return V(x, 0, z); }
  async toSummit() {
    await this.teleport(V(MAP.CAVE_MOUTH.x * S, 0, MAP.CAVE_MOUTH.z * S + 1.4), 0, false);
    if (!this.flags.summitSeen) {
      this.flags.summitSeen = 1;
      if (!this.flags.rang) this.setGoal(this.has('hammer') ? 'bell' : 'hammer');
      await this.ui.say([['小禾', '風好大……整片楓嶺都在腳下。'], ['小禾', '那就是回音鐘。']], 'me');
    }
  }
  async teleport(to, face, intoCave) {
    this.cutscene = true;
    await this.ui.fade(true);
    this.player.place(to.x, to.z, face);
    this.cam.copy(this.player.pos);
    this.quietHere();
    this.inCave = intoCave;
    await sleep(150);
    await this.ui.fade(false);
    this.cutscene = false;
    this.save();
  }
  async openChest() {
    if (this.has('hammer')) return;
    const lid = this.chest.m.userData.lid;
    this.audio.thunk();
    await this.tween(0.6, k => { lid.rotation.x = -1.6 * ease(k); });
    await this.ui.say([['小禾', '箱子裡有一把包著布的小鐘槌。布上縫著一行字:「給下一個守鐘人」。'], { do: () => { this.give('hammer'); this.setGoal('exit'); } }]);
  }
  async sketch(sp) {
    this.audio.shutter();
    this.pr.uniforms.uFlash.value = 1;
    this.frame?.(0);
    const src = this.pr.renderer.domElement;
    const cv = document.createElement('canvas'); cv.width = 192; cv.height = 108;
    const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    this.pr.uniforms.uFlash.value = 0;
    this.frame?.(0);
    const ar = src.width / src.height, tw = ar > 16 / 9 ? src.height * 16 / 9 : src.width, th = tw * 9 / 16;
    ctx.drawImage(src, (src.width - tw) / 2, (src.height - th) / 2, tw, th, 0, 0, 192, 108);
    const first = !this.state.sketches[sp.id];
    this.state.sketches[sp.id] = cv.toDataURL('image/jpeg', 0.82);
    this.pr.uniforms.uFlash.value = 0.8;
    this.tween(0.5, k => { this.pr.uniforms.uFlash.value = 0.8 * (1 - k); });
    this.toast(`寫生完成「${sp.name}」(${Object.keys(this.state.sketches).length}/4)`, first);
    if (first) this.audio.card();
    this.save();
  }

  // ---------------- fishing
  startFishing(spot) {
    const p = this.player;
    // find water in front: search ring for nearest water point
    let best = null;
    for (let a = 0; a < 16; a++) for (const d of [1.6, 2.4, 3.2]) {
      const ang = a / 16 * Math.PI * 2, x = p.pos.x + Math.sin(ang) * d, z = p.pos.z + Math.cos(ang) * d;
      if (this.world.main.isWater(x, z) && (!best || d < best.d)) best = { x, z, d, ang };
    }
    if (!best) return this.toast('這裡離水太遠了');
    p.face = best.ang;
    const ws = this.world.main.waterSurfaceAt(best.x, best.z);
    this.bobber.position.set(best.x, ws + 0.05, best.z); this.bobber.visible = true;
    p.forceMode = 'fish';
    this.fishing = { spot, phase: 'wait', t: 1.5 + Math.random() * 3.5, mark: 0, dir: 1, zone: [0.4, 0.6], hits: 0, miss: 0, ws, species: null };
    this.audio.splash();
    this.ui.fishPanel(true); this.ui.fishUpdate(this.fishing);
  }
  pickFish(spot) {
    const opts = spot.pool.map(n => [n, 1 / Math.pow(FISH[n].rare, 1.5)]);
    let tot = opts.reduce((a, b) => a + b[1], 0), r = Math.random() * tot;
    for (const [n, w] of opts) { r -= w; if (r <= 0) return n; }
    return opts[0][0];
  }
  updateFishing(dt) {
    const f = this.fishing, inp = this.input;
    if (inp.hit('Escape')) return this.endFishing();
    f.t -= dt;
    if (f.phase === 'wait') {
      this.bobber.position.y = f.ws + 0.05 + Math.sin(performance.now() / 300) * 0.03;
      if (inp.hit('KeyE', 'Space')) { this.toast('太早了,魚被嚇跑了'); return this.endFishing(); }
      if (f.t <= 0) { f.phase = 'bite'; f.t = 0.85; this.audio.bite(); this.bobber.position.y = f.ws - 0.08; }
    } else if (f.phase === 'bite') {
      if (inp.hit('KeyE', 'Space')) {
        f.phase = 'reel'; f.species = this.pickFish(f.spot);
        const rare = FISH[f.species].rare;
        f.speed = 0.7 + rare * 0.22; const wd = 0.24 - rare * 0.03;
        const c = 0.2 + Math.random() * 0.6; f.zone = [Math.max(0, c - wd / 2), Math.min(1, c + wd / 2)];
      } else if (f.t <= 0) { this.toast('魚跑掉了……'); return this.endFishing(); }
    } else if (f.phase === 'reel') {
      f.mark += f.dir * f.speed * dt;
      if (f.mark > 1) { f.mark = 1; f.dir = -1; } if (f.mark < 0) { f.mark = 0; f.dir = 1; }
      this.bobber.position.y = f.ws + Math.sin(performance.now() / 60) * 0.05;
      if (inp.hit('KeyE', 'Space')) {
        if (f.mark >= f.zone[0] && f.mark <= f.zone[1]) {
          f.hits++; this.audio.click();
          const wd = f.zone[1] - f.zone[0], c = 0.15 + Math.random() * 0.7; f.zone = [Math.max(0, c - wd / 2), Math.min(1, c + wd / 2)];
          f.speed *= 1.12;
          if (f.hits >= 3) {
            const n = f.species, first = !this.state.fish[n];
            this.state.fish[n] = (this.state.fish[n] || 0) + 1;
            this.state.bagFish[n] = (this.state.bagFish[n] || 0) + 1;
            this.audio.splash(); this.audio[first ? 'card' : 'leaf']();
            this.toast(`釣到了「${n}」!${first ? '(新魚種!)' : ''}`, first);
            if (this.state.goal === 'catch') this.setGoal('cat');
            this.ui.refreshHUD();
            this.endFishing(); this.save();
            return;
          }
        } else {
          f.miss++; this.audio.wrong();
          if (f.miss >= 3) { this.toast('線斷了……魚跑掉了'); return this.endFishing(); }
        }
      }
    }
    this.ui.fishUpdate(f);
  }
  endFishing() { this.blockInteract(); this.fishing = null; this.bobber.visible = false; this.player.forceMode = null; this.ui.fishPanel(false); }

  // ---------------- sokoban
  tryPush(dt) {
    const p = this.player, b = p.blockedBy?.boulder;
    if (!b || !p.pushDir || b.sunk) { p.pushing = false; this.pushT = 0; return; }
    const [bx, bz] = this.cellXZ(b.c, b.r, b.cave);
    const [dx, dz] = p.pushDir;
    const offX = bx - p.pos.x, offZ = bz - p.pos.z;
    const along = offX * dx + offZ * dz, perp = Math.abs(offX * dz - offZ * dx);
    if (along < 0.5 || perp > 0.85) { p.pushing = false; this.pushT = 0; return; }
    if (!this.has('gloves')) {
      p.pushing = true;
      this.pushT = (this.pushT || 0) + dt;
      if (this.pushT > 0.6 && !this.saidHeavy) { this.saidHeavy = true; this.toast('好重……徒手推大概要推到明年。'); setTimeout(() => this.saidHeavy = false, 4000); }
      return;
    }
    p.pushing = true;
    this.pushT = (this.pushT || 0) + dt;
    if (this.pushT < 0.28 || b.moving) return;
    this.pushT = 0;
    const nc = b.c + dx, nr = b.r + dz;
    const res = this.canPushTo(b, nc, nr);
    if (!res) { if (!this.bumpT || performance.now() - this.bumpT > 700) { this.audio.thunk(); this.bumpT = performance.now(); } return; }
    b.moving = true;
    this.audio.push();
    const [x0, z0] = this.cellXZ(b.c, b.r, b.cave), [x1, z1] = this.cellXZ(nc, nr, b.cave);
    const y0 = b.m.position.y;
    b.c = nc; b.r = nr;
    const sinks = res === 'sink';
    const w = this.world;
    this.tween(0.32, (k) => {
      b.m.position.x = x0 + (x1 - x0) * k; b.m.position.z = z0 + (z1 - z0) * k;
      b.m.rotation.x += dz * 0.06; b.m.rotation.z -= dx * 0.06;
      if (!sinks) b.m.position.y = y0 + (w.heightAt(b.m.position.x, b.m.position.z) - 0.06 - y0) * k;
    }).then(() => {
      b.moving = false;
      if (sinks) { b.sunk = true; this.filled.add(`${nc},${nr}`); this.audio.splash(); this.shake = 0.25; }
      this.placeBoulder(b);
      this.afterPush(b);
    });
    w.colliders.move(b.coll, x1, z1);
  }
  // ---- push indicators: ring under every movable boulder nearby, arrow showing where a push goes
  ensurePushMarks() {
    if (this.pushArrow) return;
    const sh = new THREE.Shape(); sh.moveTo(-0.22, -0.55); sh.lineTo(0.22, -0.55); sh.lineTo(0.22, 0.05); sh.lineTo(0.5, 0.05); sh.lineTo(0, 0.6); sh.lineTo(-0.5, 0.05); sh.lineTo(-0.22, 0.05); sh.closePath();
    const geo = new THREE.ShapeGeometry(sh); geo.rotateX(-Math.PI / 2);
    this.pushArrow = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x6cd06a, transparent: true, opacity: 0.85, depthWrite: false }));
    this.pushArrow.renderOrder = 5; this.pushArrow.layers.set(3); this.pushArrow.visible = false; this.scene.add(this.pushArrow);
    const ringGeo = new THREE.RingGeometry(1.0, 1.18, 20); ringGeo.rotateX(-Math.PI / 2);
    for (const b of this.boulders) {
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.0, depthWrite: false }));
      ring.renderOrder = 4; ring.layers.set(3); this.scene.add(ring); b.ring = ring;
    }
  }
  pushTarget() {
    const p = this.player;
    let best = null;
    for (const b of this.boulders) {
      if (b.sunk || b.moving) continue;
      const [bx, bz] = this.cellXZ(b.c, b.r, b.cave);
      const dx = bx - p.pos.x, dz = bz - p.pos.z, d = Math.hypot(dx, dz);
      if (d > 2.1) continue;
      const ax = Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)];
      const perp = Math.abs(ax[0] ? dz : dx);
      if (perp > 0.95) continue;
      if (!best || d < best.d) best = { b, d, dir: ax, bx, bz };
    }
    return best;
  }
  pushHint() {
    const t = this.pushTarget(); this._pt = t;
    if (!t) return null;
    const arrows = { '1,0': '→', '-1,0': '←', '0,1': '↓', '0,-1': '↑' }, key = arrows[t.dir.join(',')];
    if (!this.has('gloves')) return { text: '大石頭太重了,需要工作手套', key, tone: 'need' };
    t.ok = !!this.canPushTo(t.b, t.b.c + t.dir[0], t.b.r + t.dir[1]);
    return t.ok ? { text: `往${key}推動石頭(朝石頭走過去)`, key, tone: 'ok' } : { text: '這個方向推不動,前面有東西擋住', key, tone: 'no' };
  }
  updatePushMarks(dt) {
    this.ensurePushMarks();
    const p = this.player, glove = this.has('gloves'), t = this._pt, tm = this.U.uTime.value;
    for (const b of this.boulders) {
      const [bx, bz] = this.cellXZ(b.c, b.r, b.cave);
      const near = !b.sunk && Math.hypot(bx - p.pos.x, bz - p.pos.z) < 9;
      const target = near ? (glove ? 0.55 + 0.25 * Math.sin(tm * 3) : 0.25) : 0;
      b.ring.material.opacity += (target - b.ring.material.opacity) * Math.min(1, dt * 6);
      b.ring.visible = b.ring.material.opacity > 0.02;
      b.ring.position.set(b.m.position.x, this.world.heightAt(b.m.position.x, b.m.position.z) + 0.06, b.m.position.z);
    }
    const a = this.pushArrow;
    if (t && !this.truck?.driving && this._pt === t) {
      a.visible = true;
      a.material.color.set(!glove ? 0x9a8a7a : t.ok ? 0x6cd06a : 0xe0503a);
      const ex = t.bx + t.dir[0] * 1.55, ez = t.bz + t.dir[1] * 1.55;
      const pulse = this.player.pushing ? 1.15 + 0.15 * Math.sin(tm * 14) : 1;
      a.position.set(ex, this.world.heightAt(ex, ez) + 0.08, ez); a.scale.setScalar(pulse);
      a.rotation.y = Math.atan2(t.dir[0], t.dir[1]) + Math.PI;
    } else a.visible = false;
    this._pt = null;
  }
  canPushTo(b, nc, nr) {
    const w = this.world;
    const [x, z] = this.cellXZ(nc, nr, b.cave);
    if (this.boulders.some(o => o !== b && !o.sunk && o.c === nc && o.r === nr && o.cave === b.cave)) return null;
    if (w.colliders.hit(x, z, 0.75, b.coll)) return null;
    if (Math.hypot(this.player.pos.x - x, this.player.pos.z - z) < 1.2) return null;
    if (b.cave) {
      const cd = w.caveData;
      if (nc < 0 || nr < 0 || nc >= MAP.CAVE_COLS || nr >= MAP.CAVE_ROWS) return null;
      if (cd.level(nc, nr) !== 0) return null;
      if (nc === cd.gate.c && nr === cd.gate.r) return null;
      return 'move';
    }
    const g = w.g, i = g.I(nc, nr), i0 = g.I(b.c, b.r);
    if (nc < 0 || nr < 0 || nc >= MAP.COLS || nr >= MAP.ROWS) return null;
    if (g.obst[i] || g.level[i] !== g.level[i0]) return null;
    if (g.water[i]) return this.filled.has(`${nc},${nr}`) || g.stone[i] ? 'move' : 'sink';
    const [x0, z0] = this.cellXZ(b.c, b.r, false);
    const h0 = this.filled.has(`${b.c},${b.r}`) ? MAP.STEP * g.level[i0] : w.heightAt(x0, z0);
    for (const [a, c] of [[0, 0], [0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7]]) if (Math.abs(w.heightAt(x + a, z + c) - h0) > 0.35 || w.main.isWater(x + a, z + c)) return null;
    return 'move';
  }
  afterPush(b) {
    // creek crossing done?
    if (!b.cave && !this.flags.creekDone) {
      for (let r = 28; r <= 35; r++) if (this.filled.has(`29,${r}`) && this.filled.has(`30,${r}`)) {
        this.flags.creekDone = 1; this.audio.solve(); this.toast('踏腳石完成了!', true);
        if (['creek', 'boulder'].includes(this.state.goal)) this.setGoal('chen');
      }
    }
    if (b.patch === undefined && b.id.startsWith('tutorial') && !this.flags.tutorialDone && b.c <= 9) { this.flags.tutorialDone = 1; this.audio.solve(); this.toast('路通了!林道的柵欄也打開了,小藍可以開上去了。', true); this.openRoadGate(); if (this.state.goal === 'boulder') this.setGoal('creek'); }
    if (b.cave) {
      const pressed = this.plates.filter(p => this.boulders.some(o => o.cave && o.c === p.c && o.r === p.r));
      this.plates.forEach(p => { p.rune.material = pressed.includes(p) ? P.M.lanternGlow : P.M.lanternOff; });
      if (pressed.length === this.plates.length && !this.flags.gateOpen) {
        this.flags.gateOpen = 1; this.audio.solve(); this.audio.rumble(); this.shake = 0.8;
        const g = this.gate; g.coll.off = true;
        this.tween(1.6, k => { g.m.position.y = g.y0 + 2.2 * ease(k); });
        this.toast('鐵柵門升起來了!', true);
      }
    }
    this.save();
  }
  resetPuzzle() {
    const p = this.player.pos;
    let zone = null;
    if (p.x >= 490) return;
    if (p.x > 250) zone = 'cave';
    else if (p.x > 34 && p.x < 66 && p.z > 54 && p.z < 74) zone = 'creek';
    else if (p.x > 4 && p.x < 40 && p.z > 70 && p.z < 84) zone = 'tutorial';
    if (!zone) return;
    if (zone === 'creek' && this.flags.creekDone) return this.toast('踏腳石已經完成了');
    if (zone === 'cave' && this.flags.gateOpen) return this.toast('機關已經解開了');
    if (zone === 'tutorial' && this.flags.tutorialDone) return;
    for (const b of this.boulders) {
      if ((zone === 'cave') !== b.cave) continue;
      if (zone !== 'cave' && !b.id.startsWith(zone)) continue;
      if (b.sunk) this.filled.delete(`${b.c},${b.r}`);
      b.sunk = false; b.c = b.home[0]; b.r = b.home[1]; this.placeBoulder(b);
    }
    if (zone === 'cave') this.plates.forEach(pl => pl.rune.material = P.M.lanternOff);
    // make sure the player isn't standing inside something
    if (zone === 'creek') this.player.place(19.6 * S, 31.5 * S, Math.PI / 2);
    if (zone === 'cave') { const s = this.caveEntryStand(); this.player.place(s.x, s.z, Math.PI); }
    this.audio.whoosh(); this.toast('石頭回到了原位'); this.save();
  }
  walkOverride(x, z) {
    if (x > 250) return null;
    const c = Math.floor(x / S), r = Math.floor(z / S);
    const w = this.world, g = w.g;
    if (c >= 0 && r >= 0 && c < MAP.COLS && r < MAP.ROWS) {
      const i = g.I(c, r);
      if (g.water[i] && (this.filled.has(`${c},${r}`) || g.stone[i])) {
        const ws = w.main.waterSurfaceAt((c + 0.5) * S, (r + 0.5) * S);
        if (ws != null) return ws + 0.3;
      }
    }
    if (x > 49.0 && x < 53.4 && z > 84.45 && z < 85.95) return this.dockY;
    return null;
  }

  // ---------------- ending
  async ringBell() {
    if (!this.has('hammer')) return this.ui.say([['小禾', '一口沉甸甸的銅鐘。要敲響它,需要專用的鐘槌。'], ['小禾', '爺爺說他把東西藏在山裡……山洞裡會有嗎?']], 'me');
    const p = this.player, B = this.bell;
    this.cutscene = true;
    await this.scripted([p.pos.clone(), V(B.x + 0.35, this.world.heightAt(B.x, B.z + 0.9), B.z + 0.75)], [0.5], 'walk', Math.PI);
    p.forceMode = 'ring';
    await sleep(500);
    const golden = !!this.state.upgrades.watch;
    this.audio.bell(golden);
    this.endingMusic = true; setTimeout(() => { if (this.audio.tracks) { this.audio.tracks.ending.currentTime = 0; } this.audio.playTrack('ending'); }, 2500);
    this.pr.uniforms.uFlash.value = 0.6; this.shake = 1.0;
    this.tween(0.6, k => { this.pr.uniforms.uFlash.value = 0.6 * (1 - k); });
    B.swing = 1;
    p.forceMode = null;
    const first = !this.flags.rang;
    const allCards = Object.keys(this.state.postcards).length >= 5;
    if (first || allCards && !this.flags.trueEnd || golden) {
      await sleep(2200);
      // pan out over the valley at sunset
      const fromCam = this.cam.clone(), tint = this.pr.uniforms.uTint.value;
      // sweep down the whole mountain: summit → mill → creek → village pond, at sunset
      const to = V(58, 0.5, 82);
      const way = [fromCam, V(70, 12, 30), V(52, 6, 58), to];
      this._sweepStop = false;
      this.tween(12, k => {
        if (this._sweepStop) return;
        const e = ease(k) * (way.length - 1), i = Math.min(way.length - 2, Math.floor(e));
        this.cam.lerpVectors(way[i], way[i + 1], e - i);
        tint.setRGB(1, 1 - 0.12 * Math.min(1, k * 2), 1 - 0.25 * Math.min(1, k * 2));
      });
      await sleep(2500);
      if (golden) this.goldenLeaves(true);
      const lines = [];
      if (first) lines.push(ENDING.normal);
      if (allCards && !this.flags.trueEnd) { this.audio.whistle(); lines.push(ENDING.trueEnd); }
      if (golden) lines.push(ENDING.golden);
      if (allCards && !this.flags.trueEnd) this.spawnGrandpa();
      await this.ui.captions(lines, 3200);
      if (first) {
        this.flags.rang = 1; this.flags.rangAt = this.state.time;
        const el = this.$('ending'), inner = this.$('ending-inner');
        inner.innerHTML = `<h1>楓嶺</h1>${ENDING.credits.replace(/\n/g, '<br>')}<br><br><span style="font-size:15px;opacity:.85">完成度 ${this.completion()}% · ${Object.keys(this.state.postcards).length}/5 明信片 · ${Object.keys(this.state.leaves).length}/20 金楓葉</span>`;
        el.classList.remove('hidden'); el.style.background = 'rgba(12,10,6,.75)';
        await this.waitAdvance(7000);
        el.classList.add('hidden');
      }
      if (allCards) this.flags.trueEnd = 1;
      await sleep(800);
      this._sweepStop = true;
      const back = this.cam.clone();
      await this.tween(2.5, k => { this.cam.lerpVectors(back, p.pos.clone().add(V(0, 0.8, 0)), ease(k)); tint.setRGB(1, 0.88 + 0.12 * k, 0.75 + 0.25 * k); });
      if (golden) setTimeout(() => this.goldenLeaves(false), 20000);
      this.setGoal('free');
      if (first) this.toast(`後日談:山裡還藏著 ${5 - Object.keys(this.state.postcards).length} 張明信片、${20 - Object.keys(this.state.leaves).length} 片金楓葉`);
    }
    this.cutscene = false;
    setTimeout(() => { this.endingMusic = false; }, 4000);
    this.save();
  }
  spawnGrandpa() {
    const g = buildCharacter(LOOKS.grandpa);
    g.traverse(o => { o.layers.set(1); if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.85; } });
    const x = MAP.BELL.x * S - 6, z = MAP.BELL.z * S + 5;
    g.position.set(x, this.world.heightAt(x, z), z); g.rotation.y = 0.6;
    this.scene.add(g);
    this.ghost = { m: g, t: 0 };
  }
  goldenLeaves(on) {
    const target = on ? new THREE.Color(1.25, 1.05, 0.45) : new THREE.Color(1, 1, 1);
    const from = P.M.leaf.color.clone();
    this.tween(2, k => P.M.leaf.color.lerpColors(from, target, k));
  }

  // ---------------- scripted movement helpers
  tween(dur, fn) {
    return new Promise(res => this.tweens.push({ t: 0, dur, fn, res }));
  }
  async scripted(path, durs, mode, face) {
    const p = this.player;
    p.lock = 999; p.forceMode = mode;
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1], d = durs[Math.min(i, durs.length - 1)];
      const f0 = p.face;
      const fwd = Math.hypot(b.x - a.x, b.z - a.z) > 0.2 && mode === 'walk' ? Math.atan2(b.x - a.x, b.z - a.z) : face;
      await this.tween(d, k => {
        p.pos.lerpVectors(a, b, k);
        let df = fwd - f0; df = Math.atan2(Math.sin(df), Math.cos(df)); p.face = f0 + df * Math.min(1, k * 3);
      });
    }
    p.face = face; p.lock = 0; p.forceMode = null;
    this.quietHere();
  }
  quietHere() { this.needRelease = true; this.interactAfter = performance.now() + 300; this.quiet = { all: true, pos: this.player.pos.clone() }; this.activeInter = null; }

  // ======================================================================================
  showTitle() {
    this.titleT = 0;
    const $ = this.$;
    $('tload').classList.add('hidden'); $('tbtns').classList.remove('hidden');
    if (this.hasSave) { $('btn-continue').classList.remove('hidden'); $('btn-continue').focus(); } else $('btn-new').focus();
    $('btn-continue').onclick = () => this.begin(false);
    $('btn-new').onclick = () => {
      if (this.hasSave && !confirm('開始新的旅程會覆蓋目前的存檔,確定嗎?')) return;
      localStorage.removeItem(SAVE_KEY);
      if (this.hasSave) { location.reload(); return; }
      this.begin(true);
    };
    addEventListener('pointerdown', () => { this._advance = true; });
    addEventListener('keydown', (e) => { if (['KeyE', 'Space', 'Enter'].includes(e.code)) this._advance = true; });
  }
  async begin(fresh) {
    this.audio.ensure(); this.audio.setVol('master', this.audio.vol.master);
    const $ = this.$;
    $('title').classList.add('hidden');
    this.cutscene = true;
    if (fresh) {
      $('fade').classList.add('on');
      await sleep(400);
      await this.ui.captions(INTRO, 2400);
      this.player.place(MAP.SPAWN.x * S, MAP.SPAWN.z * S, Math.PI);
      this.cam.copy(this.player.pos);
      $('fade').classList.remove('on');
      await sleep(700);
    }
    this.started = true;
    document.body.classList.add('playing');
    this.inCave = this.player.pos.x > 250 && this.player.pos.x < 490;
    $('hud').classList.remove('hidden');
    this.cutscene = false;
    this.ui.refreshHUD();
    if (fresh) {
      await this.ui.say([['小禾', '……楓嶺,好久不見。'], ['小禾', '爺爺的信上說,先看看門口的信箱。']], 'me');
    }
  }

  areaOf(x, z) {
    if (x >= 490) return 'room';
    if (x > 250) return 'cave';
    const L = this.world.main.levelAt(x, z);
    if (L === 0) return 'village';
    if (L === 1) return x > 94 ? 'nook' : x > 60 ? 'camp' : 'forest';
    if (L === 2) return x > 62 ? 'mill' : 'forest';
    if (L === 3) return x < 40 ? 'grove' : 'terrace';
    return 'summit';
  }

  // ======================================================================================
  update(dt) {
    const inp = this.input, p = this.player, w = this.world;
    // tweens
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const t = this.tweens[i]; t.t += dt;
      const k = Math.min(1, t.t / t.dur); t.fn(k);
      if (k >= 1) { this.tweens.splice(i, 1); t.res(); }
    }
    if (!this.started) {
      // title: slow drift over the village
      this.titleT = (this.titleT || 0) + dt;
      const t = this.titleT * 0.05;
      this.cam.set(40 + Math.sin(t) * 16, 2, 78 - Math.sin(t * 0.7) * 6);
      this.pr.setTarget(this.cam);
      this.animateWorld(dt);
      return;
    }
    if (!this.cutscene && !this.fishing) this.state.time += dt;
    if (this.ui.dlg) this.ui.updateDialog(dt, inp);
    else if (this.fishing) this.updateFishing(dt);
    else if (!this.cutscene) {
      if (inp.hit('Tab', 'KeyM')) this.ui.openTab('map');
      else if (inp.hit('KeyJ')) this.ui.openTab('quest');
      else if (inp.hit('KeyB', 'KeyI')) this.ui.openTab('bag');
      else if (this.ui.journalOpen && inp.hit('Escape')) this.ui.toggleJournal(false);
      else if (!this.ui.journalOpen && inp.hit('Escape')) this.ui.toggleJournal(true);
    }
    if (this.needRelease && !inp.down('KeyE', 'Space', 'Enter')) this.needRelease = false;
    const free = !this.ui.busy() && p.lock <= 0;
    const driving = this.truck?.driving;
    if (driving) {
      this.truck.update(dt, this.ui.busy() ? { axis: () => ({ x: 0, z: 0, mag: 0 }), down: () => false, hit: () => false } : inp);
      if (free && this.canInteract() && inp.hit('KeyE', 'Space', 'Enter')) this.exitTruck();
    } else {
      this.truck?.update(dt, inp);
      p.update(dt, inp, this);
    }
    if (free && !driving) this.tryPush(dt); else { p.pushing = false; }
    this.pet?.update(dt);
    if (free && inp.hit('KeyP')) this.whistlePet();
    // forage pickups (they grow back)
    for (const f of this.forage || []) {
      if (!f.m.visible) { if (this.state.time - (this.forageAt[f.i] || 0) > 240) f.m.visible = true; continue; }
      if (!driving && Math.hypot(f.x - p.pos.x, f.z - p.pos.z) < 0.9) { f.m.visible = false; this.forageAt[f.i] = this.state.time; this.addMat(f.kind, f.kind === 'berry' ? 2 : 1); }
    }
    // interaction
    let best = null;
    if (free && !driving) {
      for (const it of this.inter) {
        if (!it.r || (it.on && !it.on())) continue;
        if (this.quiet && (this.quiet.all || this.quiet.it === it)) continue;
        const ip = it.pos, d = Math.hypot(ip.x - p.pos.x, ip.z - p.pos.z);
        const score = d + (it.lowPri ? 1.8 : 0);   // the pet trailing behind you never steals the prompt
        if (d < it.r && Math.abs((ip.y || p.pos.y) - p.pos.y) < 2.2 && (!best || score < best.d)) best = { it, d: score };
      }
    }
    const ph = !best && free && !driving ? this.pushHint() : null;
    if (ph) this.ui.prompt(ph.text, ph.key, ph.tone); else this.ui.prompt(best ? best.it.label() : null);
    this.updatePushMarks(dt);
    if (this.quiet && Math.hypot(p.pos.x - this.quiet.pos.x, p.pos.z - this.quiet.pos.z) > 0.9) this.quiet = null;
    if (best && this.canInteract() && inp.hit('KeyE', 'Space', 'Enter')) { this.activeInter = best.it; best.it.use(); }
    if (free && inp.hit('KeyR')) this.resetPuzzle();
    if (free && inp.hit('KeyZ') && this.state.upgrades.scope) { this.pr.zoom = this.pr.zoom === 1 ? 0.62 : 1; this.pr.updateFrustum(); }
    // collectibles
    for (const l of this.leaves) {
      if (this.state.leaves[l.i]) continue;
      if (Math.hypot(l.x - p.pos.x, l.z - p.pos.z) < 0.95 && Math.abs(l.y0 - 0.8 - p.pos.y) < 1.2) {
        this.state.leaves[l.i] = 1; l.m.visible = false; this.audio.leaf();
        const n = Object.keys(this.state.leaves).length;
        const up = UPGRADES.find(u => u.n === n);
        this.toast(`金楓葉 ${n}/20${up ? ' ── 拿給阿梅奶奶看看吧!' : ''}`, true);
        this.ui.refreshHUD(); this.save();
      }
    }
    // area banner
    let ak = this.areaOf(p.pos.x, p.pos.z);
    if (ak === 'room') ak = 'room:' + (this.curRoom?.id || '');
    if (ak !== this.areaKey) {
      this.areaKey = ak; const [n, s] = ak.startsWith('room') ? [this.curRoom?.name || '', 'INSIDE'] : AREAS[ak]; if (n) this.ui.area(n, s);
      if (ak === 'forest' && this.state.goal === 'boulder') this.setGoal('creek');
      if (ak === 'camp' && !this.flags.creekDone && p.pos.x > 62) { this.flags.creekDone = 1; }
      if (ak === 'nook' && !this.flags.nook) { this.flags.nook = 1; this.toast('發現了秘密的地方!', true); }
    }
    this.inCave = p.pos.x > 250 && p.pos.x < 490;
    this.inRoom = p.pos.x >= 490;
    // camera
    const tgt = p.pos.clone(); tgt.y += 0.8;
    if (!this.cutscene || this.camFollow) this.cam.lerp(tgt, 1 - Math.exp(-dt * 5));
    const hv = this.pr.viewHalf(), PADW = w.PAD * S;
    if (!this.inCave && !this.inRoom) {
      const x0 = -PADW + hv.x, x1 = MAP.COLS * S + PADW - hv.x, z0 = -PADW + hv.z, z1 = MAP.ROWS * S + PADW - hv.z;
      this.cam.x = x0 < x1 ? Math.min(x1, Math.max(x0, this.cam.x)) : (x0 + x1) / 2;
      this.cam.z = z0 < z1 ? Math.min(z1, Math.max(z0, this.cam.z)) : (z0 + z1) / 2;
    }
    const sh = this.shake > 0 ? (this.shake -= dt, this.shake * 0.25) : 0;
    const ct = this.cam.clone(); if (sh) { ct.x += (Math.random() - 0.5) * sh; ct.z += (Math.random() - 0.5) * sh; }
    this.pr.setTarget(ct);
    // darkness in the cave
    const U = this.pr.uniforms;
    U.uDark.value += ((this.inCave ? 1 : 0) - U.uDark.value) * Math.min(1, dt * 4);
    if (this.inCave) {
      const uv = this.pr.toUV(p.pos.clone().add(V(0, 0.8, 0)));
      U.uLight.value.copy(uv);
      U.uLightR.value = this.has('lantern') ? 0.3 / this.pr.zoom * (330 / this.pr.H) : 0.12;
    }
    this.pr.clearColor = this.inCave ? 0x050405 : this.inRoom ? 0x1a120c : 0x1c2414;
    this.U.uCloud.value = this.inCave || this.inRoom ? 0 : 1;
    const tint = this.pr.uniforms.uTint.value; if (!this.cutscene) { if (this.inRoom) tint.setRGB(1.04, 0.97, 0.88); else tint.setRGB(1, 1, 1); }
    p.model.userData.lantern.visible = this.inCave && this.has('lantern');
    // compass
    if (this.state.upgrades.compass) {
      let bl = null, bd = 1e9;
      for (const l of this.leaves) if (!this.state.leaves[l.i]) { const d = Math.hypot(l.x - p.pos.x, l.z - p.pos.z); if (d < bd) { bd = d; bl = l; } }
      const n = this.$('compass-needle');
      if (bl) n.style.transform = `rotate(${Math.atan2(bl.x - p.pos.x, -(bl.z - p.pos.z))}rad)`;
    }
    this.animateWorld(dt);
    // audio
    if (!this.endingMusic) {
      const L = this.inCave ? -1 : this.world.main.levelAt(p.pos.x, p.pos.z);
      this.audio.playTrack(this.inCave ? 'cave' : (this.inRoom || p.pos.x < 250 && L === 0) ? 'village' : 'trail');
    }
    const waterNear = this.waterNear(p.pos);
    this.audio.update(dt, { waterNear, cave: this.inCave, birds: !this.inRoom });
    this.saveT += dt;
    if (this.saveT > 8) { this.saveT = 0; this.save(); }
  }
  waterNear(pos) {
    let d = 1e9;
    for (const [x, z] of [[94, pos.z], [59, 62], [60, 46]]) d = Math.min(d, Math.hypot(pos.x - x, pos.z - z));
    return pos.x > 250 ? 0 : Math.max(0, 1 - d / 22);
  }
  animateWorld(dt) {
    const w = this.world, p = this.player, t = this.U.uTime.value;
    // NPCs
    for (const npc of Object.values(this.npcs)) {
      let speed = 0;
      if (npc.id === 'cat') {
        let goal = npc.home;
        if (this.catFollowing()) {
          const back = V(p.pos.x - Math.sin(p.face) * 1.1, 0, p.pos.z - Math.cos(p.face) * 1.1);
          goal = back;
        } else if (!this.flags.catHome) {
          goal = V(npc.home.x + Math.sin(t * 0.3) * 1.2, 0, npc.home.z + Math.cos(t * 0.21) * 0.8);
        }
        const dx = goal.x - npc.pos.x, dz = goal.z - npc.pos.z, d = Math.hypot(dx, dz);
        if (d > 0.15) {
          const sp = Math.min(this.catFollowing() ? (d > 4 ? 7 : 4.2) : 1.0, d * 3);
          if (this.catFollowing() && d > 9) { npc.pos.x = goal.x; npc.pos.z = goal.z; }
          npc.pos.x += dx / d * sp * dt; npc.pos.z += dz / d * sp * dt;
          npc.face = Math.atan2(dx, dz); speed = sp;
        }
        npc.pos.y = this.surfY(npc.pos.x, npc.pos.z);
        npc.coll.off = this.catFollowing();
        w.colliders.move(npc.coll, npc.pos.x, npc.pos.z);
        npc.model.position.copy(npc.pos); npc.model.rotation.y = npc.face;
        animateCat(npc.model, dt, speed);
        continue;
      }
      const dp = Math.hypot(p.pos.x - npc.pos.x, p.pos.z - npc.pos.z);
      if (dp < 3.5 || npc.facePlayer > 0) {
        npc.facePlayer = Math.max(0, (npc.facePlayer || 0) - dt);
        const tgt = Math.atan2(p.pos.x - npc.pos.x, p.pos.z - npc.pos.z);
        let df = tgt - npc.model.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df));
        npc.model.rotation.y += df * Math.min(1, dt * 6);
      } else {
        let df = npc.face - npc.model.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df));
        npc.model.rotation.y += df * Math.min(1, dt * 2);
      }
      animateCharacter(npc.model, dt, 0, npc.id === 'wang' && !this.fishing ? 'fish' : 'idle');
    }
    // ducks paddle in circles; scatter if close
    for (const d of this.ducks) {
      d.a += dt * d.sp / Math.max(0.5, d.r);
      const x = d.cx + Math.cos(d.a) * d.r, z = d.cz + Math.sin(d.a) * d.r * 0.6;
      const ws = w.main.waterSurfaceAt(x, z) ?? d.m.position.y;
      d.m.position.set(x, ws + Math.sin(t * 3 + d.a) * 0.015, z);
      d.m.rotation.y = Math.atan2(-Math.sin(d.a) * d.r, Math.cos(d.a) * d.r * 0.6) + Math.PI;
      if (Math.hypot(x - p.pos.x, z - p.pos.z) < 2.5 && Math.random() < dt * 0.8) this.audio.quack();
    }
    // birds hop and flee
    for (const b of this.birds) {
      b.t += dt;
      const dp = Math.hypot(b.m.position.x - p.pos.x, b.m.position.z - p.pos.z);
      if (!b.fly && dp < 3.2) { b.fly = 1; b.vel.set((b.m.position.x - p.pos.x) * 0.8 + (Math.random() - 0.5) * 2, 3 + Math.random() * 2, (b.m.position.z - p.pos.z) * 0.8 - 2); }
      if (b.fly) {
        b.fly += dt; b.m.position.addScaledVector(b.vel, dt);
        b.m.userData.wings.forEach((wg, i) => wg.rotation.z = Math.sin(b.t * 30) * 0.9 * (i ? -1 : 1));
        if (b.fly > 6) { b.fly = 0; b.m.position.copy(b.home); }
        b.m.rotation.y = Math.atan2(b.vel.x, b.vel.z);
      } else {
        if (Math.random() < dt * 0.6) { b.m.rotation.y += (Math.random() - 0.5) * 2; }
        b.m.position.y = b.home.y + Math.max(0, Math.sin(b.t * 9)) * 0.04 * (Math.sin(b.t * 0.7) > 0.6 ? 1 : 0);
      }
    }
    // leaves spin
    for (const l of this.leaves) { if (!l.m.visible) continue; l.m.rotation.y += dt * 2; l.m.position.y = l.y0 + Math.sin(t * 2 + l.i) * 0.12; }
    for (const c of this.cards) if (c.mesh && c.mesh.visible) { c.mesh.rotation.y += dt; c.mesh.position.y = w.heightAt(c.x, c.z) + (c.inRoom ? 1.0 : 0.7) + Math.sin(t * 2.4) * 0.08; }
    // mill wheel
    if (this.mill.turning) { this.mill.wheel.userData.spin.rotation.z -= dt * 1.2; this.lift.gear.rotation.z -= dt * 0.6; }
    else if (this.mill.leaky) this.mill.wheel.userData.spin.rotation.z = Math.sin(t * 3) * 0.05;
    // campfire flicker
    const fl = w.decor.fire.userData.flames; fl[0].scale.y = 1 + Math.sin(t * 13) * 0.15; fl[1].scale.y = 1 + Math.sin(t * 17 + 1) * 0.2;
    // bell swing
    if (this.bell.swing > 0) { this.bell.swing = Math.max(0, this.bell.swing - dt * 0.18); this.bell.m.userData.bell.rotation.x = Math.sin(t * 4) * 0.35 * this.bell.swing; }
    // ghost
    if (this.ghost) { this.ghost.t += dt; animateCharacter(this.ghost.m, dt, 0, this.ghost.t > 2 && this.ghost.t < 6 ? 'cheer' : 'idle'); if (this.ghost.t > 14) { this.ghost.m.traverse(o => { if (o.isMesh) o.material.opacity = Math.max(0, 0.85 - (this.ghost.t - 14) * 0.3); }); if (this.ghost.t > 17) { this.scene.remove(this.ghost.m); this.ghost = null; } } }
    // falling leaves: each leaf drops from a canopy that is on screen and lands under that tree
    const pa = this.particles, pos = pa.pts.geometry.attributes.position, hv = this.pr.viewHalf();
    pa.pts.visible = !this.inCave && !this.inRoom;
    pa.pick = (pa.pick || 0) - dt;
    if (pa.pick <= 0 || !pa.near) {
      pa.pick = 0.5;
      const cx = this.cam.x, cz = this.cam.z, mx = hv.x + 2, mz = hv.z + 4;
      pa.near = w.canopies.filter(tr => Math.abs(tr.x - cx) < mx && Math.abs(tr.z - cz) < mz && ['orange', 'amber', 'red'].includes(tr.kind) || (Math.abs(tr.x - cx) < mx && Math.abs(tr.z - cz) < mz && Math.random() < 0.25));
    }
    for (let i = 0; i < pa.n; i++) {
      const s = pa.seeds[i];
      if (!s.tree || s.y <= s.ground) {
        s.tree = pa.near.length && Math.random() < 0.6 ? pa.near[Math.floor(Math.random() * pa.near.length)] : null;
        if (!s.tree) { s.y = -999; s.ground = -998; pos.setXYZ(i, 0, -999, 0); continue; }
        const tr = s.tree, a = Math.random() * 6.28, r = Math.random() * 1.3 * tr.s;
        s.ox = Math.cos(a) * r; s.oz = Math.sin(a) * r * 0.8;
        s.ground = tr.y + 0.02; s.y = tr.y + (1.4 + Math.random() * 1.6) * tr.s;
        s.vy = 0.35 + Math.random() * 0.35; s.ph = Math.random() * 6.28; s.drift = (Math.random() - 0.5) * 0.5;
      }
      s.y -= dt * s.vy; s.ox += dt * s.drift;
      const sw = Math.sin(t * 2.2 + s.ph) * 0.35;
      pos.setXYZ(i, s.tree.x + s.ox + sw, Math.max(s.ground, s.y), s.tree.z + s.oz);
    }
    pos.needsUpdate = true;
    // cave lights
    if (this.inCave) {
      // nothing extra: uLight follows the player
    }
    void PPU; void PITCH;
  }
  surfY(x, z) { return this.player.surfaceAt(x, z) ?? this.world.heightAt(x, z); }
}
