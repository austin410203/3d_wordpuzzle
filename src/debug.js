// debug.js — scripted playtest helpers (load with ?debug). Works even when rAF is paused.
export function installDebug(game) {
  const inp = game.input, S = 2;
  const D = {
    async tick(sec = 0.1, dt = 1 / 30) { for (let t = 0; t < sec; t += dt) { game.frame(dt); await null; await null; } },
    async f() { game.frame(1 / 30); await null; await null; },
    async press(code = 'KeyE') { inp.pressed.add(code); inp.keys.add(code); await D.f(); inp.keys.delete(code); await D.tick(0.1); },
    async talk() { // advance any dialogue to the end, picking the first choice
      for (let i = 0; i < 200 && game.ui.dlg; i++) { const d = game.ui.dlg; if (d.choice) game.ui.pick(0); else { d.shown = d.text.length; game.ui.advance(); } await D.tick(0.05); }
    },
    // walk toward a map-unit point (x,z = world/2); returns where we ended
    async go(mx, mz, maxSec = 25) {
      const tx = mx * S, tz = mz * S, p = game.player.pos;
      let stuck = 0, last = p.clone();
      for (let t = 0; t < maxSec; t += 1 / 30) {
        const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
        if (d < 0.35) { inp.joy.active = false; return { ok: true, x: +(p.x / S).toFixed(2), z: +(p.z / S).toFixed(2) }; }
        inp.joy.active = true; inp.joy.x = dx / d; inp.joy.y = dz / d;
        if (game.ui.dlg) await D.talk();
        await D.f();
        if (Math.floor(t * 30) % 15 === 0) { if (p.distanceTo(last) < 0.05) { if (++stuck > 3) break; } else stuck = 0; last.copy(p); }
      }
      inp.joy.active = false; inp.joy.x = inp.joy.y = 0;
      return { ok: false, x: +(p.x / S).toFixed(2), z: +(p.z / S).toFixed(2) };
    },
    async path(pts) { for (const [x, z] of pts) { const r = await D.go(x, z); if (!r.ok) return { stuckAt: r, target: [x, z] }; } return { ok: true }; },
    // push: stand west/east/... handled by walking into the boulder along an axis for some time
    async hold(dx, dz, sec) { inp.joy.active = true; inp.joy.x = dx; inp.joy.y = dz; await D.tick(sec); inp.joy.active = false; inp.joy.x = inp.joy.y = 0; await D.tick(0.05); },
    info() {
      const s = game.state, p = game.player.pos;
      return { goal: s.goal, inv: Object.keys(s.inv), flags: Object.keys(s.flags), pos: [+(p.x / S).toFixed(2), +(p.z / S).toFixed(2), +p.y.toFixed(2)], prompt: document.getElementById('prompt').classList.contains('hidden') ? null : document.getElementById('prompt-text').textContent };
    },
    async tp(mx, mz) { game.player.place(mx * S, mz * S); game.cam.copy(game.player.pos); await D.tick(0.1); },
    // execute solver pushes [[[bc,br],[dc,dr]],...] in local coords offset by (c0,r0)
    async soko(moves, c0, r0, cave) {
      const g = game, w = g.world, gg = w.g, cd = w.caveData, log = [];
      const free = (c, r) => {
        if (g.boulders.some(b => !b.sunk && b.cave == cave && b.c == c && b.r == r)) return false;
        if (cave) return c >= 0 && r >= 0 && c < 16 && r < 14 && cd.level(c, r) === 0 && !(c === cd.gate.c && r === cd.gate.r && !g.flags.gateOpen);
        const i = gg.I(c, r); if (gg.obst[i]) return false; if (gg.water[i] && !g.filled.has(c + ',' + r)) return false; return true;
      };
      const cellOf = () => { const p = g.player.pos; return cave ? [Math.floor((p.x - 300) / 2), Math.floor(p.z / 2)] : [Math.floor(p.x / 2), Math.floor(p.z / 2)]; };
      const walk = async (tc, tr) => {
        const [sc, sr] = cellOf(), key = (c, r) => c + ',' + r, prev = { [key(sc, sr)]: null }, q = [[sc, sr]];
        while (q.length) { const [c, r] = q.shift(); if (c === tc && r === tr) break; for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = [c + dc, r + dr]; if (key(...n) in prev || !free(...n)) continue; prev[key(...n)] = [c, r]; q.push(n); } }
        if (!(key(tc, tr) in prev)) return false;
        const pts = []; let k = [tc, tr]; while (k) { pts.unshift(k); k = prev[key(...k)]; }
        for (const [c, r] of pts.slice(1)) if (!(await D.go((cave ? 150 : 0) + c + 0.5, r + 0.5, 6)).ok) return false;
        return true;
      };
      for (const [[bc, br], [dc, dr]] of moves) {
        const c = bc + c0, r = br + r0, b = g.boulders.find(b => !b.sunk && b.cave == cave && b.c == c && b.r == r);
        if (!b) { log.push('noB ' + c + ',' + r); break; }
        if (!(await walk(c - dc, r - dr))) { log.push('walkfail ' + (c - dc) + ',' + (r - dr)); break; }
        inp.joy.active = true; inp.joy.x = dc; inp.joy.y = dr;
        for (let t = 0; t < 4 && b.c === c && b.r === r; t += 1 / 30) await D.f();
        inp.joy.active = false; inp.joy.x = inp.joy.y = 0; await D.tick(0.6);
        if (b.c === c && b.r === r) { log.push('pushfail ' + c + ',' + r); break; }
        log.push(`${c},${r}->${b.c},${b.r}${b.sunk ? 's' : ''}`);
      }
      return log;
    },
    boulders() { return game.boulders.map(b => `${b.id}:${b.c},${b.r}${b.sunk ? 's' : ''}`).join(' '); },
  };
  window.D = D;
}
