// 無畫面測試 save.js：舊資料搬家、欄位互不影響、匯出／匯入、錯誤碼、空間不夠時還原
import { createSaves } from '../src/save.js';
let LIMIT = Infinity;
const mem = new Map();
globalThis.localStorage = {
  getItem: k => mem.has(k) ? mem.get(k) : null,
  setItem: (k, v) => { const size = [...mem].reduce((a, [kk, vv]) => a + (kk === k ? 0 : vv.length), 0) + v.length; if (size > LIMIT) throw new Error('QuotaExceeded'); mem.set(k, String(v)); },
  removeItem: k => mem.delete(k),
  key: i => [...mem.keys()][i] ?? null,
  get length() { return mem.size; },
};
const ok = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } console.log('ok  ', m); };
const opt = { game: 'PaperPlaneGlide', prefix: 'ppg_', slotKeys: ['best', 'journal', 'photos', 'log'], slots: 3 };
mem.set('ppg_best', JSON.stringify({ qixing: { score: 900, stars: 2 } })); mem.set('ppg_style', '"sketch"');
let sv = createSaves(opt);
ok(sv.slot === 1 && sv.store.get('best').qixing.score === 900 && !mem.has('ppg_best'), 'old progress moved into save 1');
ok(sv.store.get('style') === 'sketch', 'settings stay global');
sv.setSlot(2); ok(sv.store.get('best', {}).qixing === undefined && !sv.used(2), 'save 2 starts empty');
sv.store.set('best', { jiantan: { score: 1141, stars: 3 } }); ok(sv.used(2) && sv.meta(2).saved > 0, 'writing marks save 2 used');
sv = createSaves(opt); ok(sv.slot === 2, 'current slot remembered after reload');
const ex = JSON.parse(JSON.stringify(sv.exportSlot(1)));
ok(ex.game === 'PaperPlaneGlide' && ex.data.best.qixing.score === 900, 'export save 1');
sv.importSlot(ex, 3); ok(sv.read(3).best.qixing.score === 900 && sv.meta(3).imported, 'import into save 3');
for (const [bad, code] of [[{ x: 1 }, 'bad'], [{ ...ex, game: 'Other' }, 'otherGame'], [{ ...ex, version: 9 }, 'bad']]) {
  let e = ''; try { sv.importSlot(bad, 3); } catch (x) { e = x.message; } ok(e === code, 'reject ' + code);
}
LIMIT = [...mem].reduce((a, [, v]) => a + v.length, 0) + 50;
const big = { ...ex, data: { ...ex.data, photos: ['x'.repeat(5000)] } };
let e = ''; try { sv.importSlot(big, 1); } catch (x) { e = x.message; }
ok(e === 'full' && sv.read(1).best.qixing.score === 900 && sv.read(1).photos == null, 'full storage: nothing changed');
LIMIT = Infinity;
ok(sv.store.set('photos', [1]) === true, 'store.set reports success');
sv.clear(3); ok(!sv.used(3), 'delete save 3');
console.log('all save tests passed');

// ---- raw 模式（舊遊戲改版用）：原本的 localStorage key 直接當進度 key，前綴 key（*）、遊玩紀錄 ----
mem.clear();
mem.set('sm-progress', '{"solved":[1,2]}'); mem.set('sm-case-3', 'A'); mem.set('sm-lang', 'ja');
const ropt = { game: 'StackMystery', prefix: 'eosv_sm_', slotKeys: ['sm-progress', 'sm-case-*'], raw: true };
let rs = createSaves(ropt);
ok(rs.ls.getItem('sm-progress') === '{"solved":[1,2]}' && rs.ls.getItem('sm-case-3') === 'A' && !mem.has('sm-progress') && !mem.has('sm-case-3'), 'raw: old keys (exact + prefix) moved into save 1');
ok(rs.ls.getItem('sm-lang') === 'ja' && mem.get('sm-lang') === 'ja', 'raw: settings untouched');
rs.log({ title: 'Case 3', result: 'solved', ok: true }); ok(rs.logs().length === 1 && rs.read(1).__log.length === 1, 'raw: log entry stored in slot');
rs.setSlot(2); ok(rs.ls.getItem('sm-progress') === null && rs.logs().length === 0, 'raw: save 2 empty');
rs.ls.setItem('sm-case-5', 'B'); ok(rs.used(2) && Object.keys(rs.read(2)).includes('sm-case-5'), 'raw: prefix key in save 2');
const rex = JSON.parse(JSON.stringify(rs.exportSlot(1)));
rs.importSlot(rex, 2); ok(rs.ls.getItem('sm-progress') === '{"solved":[1,2]}' && rs.ls.getItem('sm-case-5') === null && rs.logs().length === 1, 'raw: import replaces save 2 (stale prefix keys removed)');
rs = createSaves(ropt); ok(rs.slot === 2 && rs.ls.getItem('sm-case-3') === 'A', 'raw: reload keeps slot, no second migration');
for (let i = 0; i < 130; i++) rs.log({ title: 'r' + i }); ok(rs.logs().length === 100 && rs.logs()[99].title === 'r129', 'raw: log capped at 100');
rs.clear(2); ok(!rs.used(2) && rs.logs().length === 0, 'raw: delete save 2 incl. log');
console.log('all raw-mode tests passed');
