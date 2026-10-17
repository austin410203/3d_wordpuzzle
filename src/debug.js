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
    // drive the truck through map-unit waypoints; returns stuck events
    async drivePath(pts, maxSec = 90) {
      const t = game.truck, log = [];
      let i = 0, stuck = 0, last = t.pos.clone(), lt = 0;
      for (let s = 0; s < maxSec && i < pts.length; s += 1 / 30) {
        const [mx, mz] = pts[i], dx = mx * S - t.pos.x, dz = mz * S - t.pos.z, d = Math.hypot(dx, dz);
        if (d < 1.6) { i++; continue; }
        inp.joy.active = true; inp.joy.x = dx / d; inp.joy.y = dz / d;
        await D.f();
        if (s - lt > 1) { lt = s; if (t.pos.distanceTo(last) < 0.5) { stuck++; log.push([+(t.pos.x / S).toFixed(1), +(t.pos.z / S).toFixed(1)]); } last.copy(t.pos); }
        if (stuck > 6) break;
      }
      inp.joy.active = false; inp.joy.x = inp.joy.y = 0;
      return { reached: i, of: pts.length, stuckSec: stuck, at: log.slice(0, 6) };
    },
    // ---- full playthrough from a fresh save; results in window.__run
    async use() { await D.press(); await D.realWait(900); for (let i = 0; i < 40; i++) { await D.talk(); await new Promise(r => setTimeout(r, 120)); await D.tick(0.1); if (!game.ui.dlg && i > 2) break; } },
    async realWait(ms) { const t0 = performance.now(); while (performance.now() - t0 < ms) { await D.f(); await new Promise(r => setTimeout(r, 30)); } },
    async fullRun(from) {
      const g = game, run = window.__run = { log: [], ok: false };
      const step = (name, cond, extra = '') => { run.log.push(`${cond ? 'OK ' : 'FAIL'} ${name}${extra ? ' ' + extra : ''}`); if (!cond) throw new Error('failed at ' + name); };
      const near = async (id, dz = 0.7) => { const n = g.npcs[id]; return D.go(n.pos.x / S, n.pos.z / S + dz, 15); };
      const C = (c, r) => [150 + c + 0.5, r + 0.5];
      try {
        if (!g.started) await g.begin(false);
        await D.go(10.6, 46.0); await D.use(); step('mailbox postcard', !!g.state.postcards.p1);
        await D.path([[16, 45.6], [19, 43.2]]); await near('amei'); await D.use(); step('Ah-Mei gives cat quest', !!g.flags.catQuest);
        await near('wang'); await D.use(); step('Wang gives rod', g.has('rod'));
        await D.path([[22, 42.6], [24.6, 42.6], [26.4, 42.6]]); await D.press();
        for (let n = 0; n < 3000 && g.fishCount() < 1; n++) { const f = g.fishing; if (!f) { await D.press(); continue; } if (f.phase === 'bite') { await D.press(); continue; } if (f.phase === 'reel' && f.mark > f.zone[0] + 0.02 && f.mark < f.zone[1] - 0.02) { await D.press(); continue; } await D.f(); }
        if (g.fishing) g.endFishing();
        step('caught a fish', g.fishCount() >= 1);
        await D.path([[24.6, 42.6], [22, 43.4], [23, 45.6], [28, 46.6], [34, 46.8], [38, 45.4]]); await near('cat'); await D.use(); step('cat follows', g.catFollowing());
        await D.path([[34, 46.8], [28, 46.6], [23, 45.6], [21, 43]]); await near('amei'); await D.realWait(400); await D.use(); step('cat home, key', g.has('key'));
        await D.path([[19, 43.2], [16, 45.6], [13.6, 45.7]]); await D.use(); await D.realWait(1500); step('enter shed', g.player.pos.x > 490);
        const R = g.rooms.shed; await D.go((R.ox + 0.9) / S, (R.oz - 0.9) / S, 8); await D.use(); step('gloves', g.has('gloves'));
        await D.go(R.ox / S, (R.oz + R.d / 2 - 0.6) / S, 8); await D.use(); await D.realWait(1500); step('leave shed', g.player.pos.x < 250);
        await D.path([[16, 45.6], [19, 43.2], [18.3, 41.4], [18.4, 39.6], [15, 39.5]]);
        for (let i = 0; i < 8 && !g.flags.tutorialDone; i++) await D.hold(-1, 0, 1.5);
        step('tutorial boulder', !!g.flags.tutorialDone);
        await D.path([[10.5, 39.5], [10.5, 37.6], [9.6, 36.75], [4.4, 36.75], [3.3, 35.6], [3.4, 33.2], [6, 31.8], [10, 31.2], [13, 30.6], [16, 31.6], [19.5, 31.5]]);
        step('reached creek west bank', Math.abs(g.player.pos.x / S - 19.5) < 1);
        const mv = [[[6, 2], [0, 1]], [[5, 4], [0, -1]], [[6, 3], [0, 1]], [[5, 3], [1, 0]], [[6, 4], [1, 0]], [[7, 4], [1, 0]], [[8, 4], [1, 0]], [[6, 3], [0, 1]], [[6, 4], [1, 0]], [[9, 4], [1, 0]], [[7, 4], [1, 0]], [[8, 4], [1, 0]], [[9, 4], [1, 0]], [[10, 4], [1, 0]]];
        const sl = await D.soko(mv, 19, 28, false); step('creek stepping stones', !!g.flags.creekDone, sl[sl.length - 1]);
        await D.path([[29.5, 32.5], [30.5, 32.5], [32, 32], [34, 31.8]]); await near('chen', 0.8); await D.use(); step('Chen gives rope', g.has('rope'));
        await D.path([[37.5, 32.2], [36.5, 29.6], [36.5, 28.5]]); await D.use(); step('ladder fixed', !!g.flags.LD1);
        await D.press(); await D.realWait(3500); step('climbed to level 2', g.player.pos.y > 8);
        await D.path([[39, 25.0], [40.0, 25.2]]); await near('song', 0.8); await D.use(); step('met Song', !!g.flags.metSong);
        const lever = async (i) => { await D.go(38.05, [43.4, 44.8, 46.2, 47.6][i] / S, 8); await D.press(); await D.realWait(700); };
        await D.path([[39.4, 25.2], [38.05, 25.0]]); await lever(2); await lever(0); await D.realWait(1500); await D.talk();
        step('mill wheel turning', !!g.flags.millFixed, JSON.stringify(g.state.gates));
        await D.path([[38.05, 25.0], [39.4, 25.2]]); await near('song', 0.8); await D.use(); step('lantern', g.has('lantern'));
        await D.path([[41.2, 24.4], [42.6, 22.6], [42.6, 19.6], [42.5, 18.6]]); await D.press(); await D.realWait(5000); step('lift up', g.player.pos.y > 12);
        await D.path([[41.6, 15.6], [40, 14.6], [36, 13.8], [31, 14.4], [26, 13.4], [21.5, 14.6], [16.5, 13.6], [12.5, 12.8]]);
        const L = [[13.6, 15.4], [5.0, 12.0], [14.6, 11.4], [7.6, 14.2]];
        for (const i of [0, 1, 2, 3]) { await D.go(L[i][0], L[i][1] + 0.55, 12); await D.press(); await D.realWait(600); }
        await D.realWait(4000); step('lanterns → door open', !!g.flags.doorOpen);
        await D.go(12.5, 9.7); await D.press(); await D.realWait(1600); step('enter cave', g.player.pos.x > 250 && g.player.pos.x < 490);
        const cm = [[[3, 4], [0, -1]], [[2, 4], [1, 0]], [[3, 4], [1, 0]], [[4, 4], [0, -1]], [[3, 3], [0, 1]], [[3, 4], [1, 0]], [[4, 3], [1, 0]], [[5, 3], [1, 0]], [[4, 4], [0, -1]], [[6, 3], [1, 0]], [[4, 3], [1, 0]], [[5, 3], [1, 0]], [[7, 3], [0, -1]], [[6, 3], [1, 0]], [[7, 3], [1, 0]], [[8, 3], [0, -1]], [[7, 2], [0, -1]]];
        await D.soko(cm, 3, 5, true); step('cave gate open', !!g.flags.gateOpen);
        await D.path([C(6, 9), C(5, 9), C(4, 9), C(4, 8), C(4, 7), C(3, 7), C(2, 7), C(1, 7), C(1, 4), C(1, 3), C(3, 3)]); await D.use(); step('hammer', g.has('hammer'));
        await D.path([C(5, 1), C(12, 1), [163.4, 1.5]]); await D.press(); await D.realWait(1800); await D.talk(); step('summit', g.player.pos.y > 16);
        await D.path([[16, 4.6], [21, 4.4], [25.5, 3.9]]); await D.press();
        for (let i = 0; i < 120 && !g.flags.rang; i++) { g._advance = true; await D.realWait(500); }
        step('bell rung / ending', !!g.flags.rang);
        run.ok = true;
      } catch (e) { run.err = e.message; }
      run.done = true;
      return run;
    },
    boulders() { return game.boulders.map(b => `${b.id}:${b.c},${b.r}${b.sunk ? 's' : ''}`).join(' '); },
  };
  window.D = D;
}
