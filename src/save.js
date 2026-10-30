// 存檔系統：多個存檔欄位＋自動存檔＋匯出／匯入（.json 檔，可換裝置、備份）＋遊玩紀錄。
// 進度（slotKeys）每個欄位各自一份：localStorage `${prefix}s${n}_${key}`；設定（畫風、語言、聲音…）全欄位共用。
// 沒有 three.js 依賴，可以直接複製到其他遊戲用（Company/playbooks/save-system.md）。
//
// 兩種用法：
// - JSON 模式（預設，紙飛機）：store.get(k, 預設)／store.set(k, v) 自動 JSON；設定 key 存在 `${prefix}${key}`，舊進度 `${prefix}${key}`。
// - raw 模式（raw: true，舊遊戲改版用）：slotKeys 直接寫遊戲原本的 localStorage key（結尾 * 代表前綴，例如 'sm-case-*'），
//   遊戲把 localStorage.getItem/setItem/removeItem 換成 saves.ls.getItem/…（字串進字串出，跟原本一樣），
//   進度 key 自動導到目前欄位，其他 key 原封不動（設定不用搬家）。舊進度第一次載入時搬進存檔 1。
export function createSaves({ game, prefix, slotKeys, slots = 3, version = 1, raw = false }) {
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { localStorage.setItem(k, v); },                       // 會丟例外（空間滿了）：呼叫端決定怎麼辦
    del(k) { try { localStorage.removeItem(k); } catch { /* private mode */ } },
    keys() { const a = []; try { for (let i = 0; i < localStorage.length; i++) a.push(localStorage.key(i)); } catch { /* */ } return a; },
  };
  const parse = (s, d) => { if (s == null) return d; try { return JSON.parse(s); } catch { return d; } };
  const exact = slotKeys.filter(k => !k.endsWith('*')), pre = slotKeys.filter(k => k.endsWith('*')).map(k => k.slice(0, -1));
  const isSlotKey = k => exact.includes(k) || pre.some(p => k.startsWith(p));
  const sk = (n, k) => `${prefix}s${n}_${k}`;
  const metaKey = n => `${prefix}s${n}_meta`, logKey = n => sk(n, '__log');
  const legacyName = k => raw ? k : prefix + k;
  // 某個欄位實際有哪些進度 key（含前綴 key 展開）
  function keysOf(n) {
    if (!pre.length) return exact;
    const head = sk(n, ''), extra = ls.keys().filter(k => k.startsWith(head)).map(k => k.slice(head.length)).filter(k => !exact.includes(k) && pre.some(p => k.startsWith(p)));
    return exact.concat(extra);
  }
  const enc = v => raw ? (typeof v === 'string' ? v : JSON.stringify(v)) : JSON.stringify(v);
  const dec = s => raw ? s : parse(s, null);

  // 舊版（還沒有欄位時）的進度搬進存檔 1
  const ours = k => k.startsWith(prefix) && /^s\d+_/.test(k.slice(prefix.length));
  const legacy = exact.map(legacyName).filter(k => ls.get(k) != null)
    .concat(pre.length ? ls.keys().filter(k => !ours(k) && (raw || k.startsWith(prefix)) && pre.some(p => (raw ? k : k.slice(prefix.length)).startsWith(p))) : []);
  if (ls.get(metaKey(1)) == null && legacy.length) {
    for (const old of legacy) {
      const k = raw ? old : old.slice(prefix.length), v = ls.get(old);
      if (v != null) { try { ls.set(sk(1, k), v); ls.del(old); } catch { /* keep the old key */ } }
    }
    try { ls.set(metaKey(1), JSON.stringify({ created: Date.now(), saved: Date.now(), migrated: true })); } catch { /* full */ }
  }
  let slot = Math.min(slots, Math.max(1, +parse(ls.get(prefix + 'slot'), 1) || 1));
  const key = k => isSlotKey(k) ? sk(slot, k) : raw ? k : prefix + k;
  const meta = n => parse(ls.get(metaKey(n)), null);
  let lastSaved = meta(slot)?.saved || 0;
  function touch() {
    const m = meta(slot) || { created: Date.now() };
    m.saved = lastSaved = Date.now();
    try { ls.set(metaKey(slot), JSON.stringify(m)); } catch { /* full */ }
  }

  // JSON 模式的讀寫介面：get(k, 預設)、set(k, v)
  const store = {
    key,
    get(k, d) { return parse(ls.get(key(k)), d); },
    set(k, v) {
      try { ls.set(key(k), JSON.stringify(v)); } catch { return false; }
      if (isSlotKey(k)) touch();
      return true;
    },
  };
  // raw 模式：跟 localStorage 一樣的介面（字串）。setItem 空間滿了照樣丟例外，跟原本的 localStorage 一樣
  const facade = {
    getItem(k) { return ls.get(key(k)); },
    setItem(k, v) { ls.set(key(k), String(v)); if (isSlotKey(k)) touch(); },
    removeItem(k) { ls.del(key(k)); if (isSlotKey(k)) touch(); },
  };

  function read(n) {
    const o = Object.fromEntries(keysOf(n).map(k => [k, dec(ls.get(sk(n, k)))]));
    const lg = parse(ls.get(logKey(n)), null); if (lg) o.__log = lg;
    return o;
  }
  const used = n => meta(n) != null || keysOf(n).some(k => ls.get(sk(n, k)) != null) || ls.get(logKey(n)) != null;
  function setSlot(n) {
    slot = Math.min(slots, Math.max(1, n | 0));
    try { ls.set(prefix + 'slot', JSON.stringify(slot)); } catch { /* private mode */ }
    lastSaved = meta(slot)?.saved || 0;
  }
  function clear(n) { for (const k of keysOf(n)) ls.del(sk(n, k)); ls.del(logKey(n)); ls.del(metaKey(n)); if (n === slot) lastSaved = 0; }
  function exportSlot(n = slot) {
    return { game, version, exported: Date.now(), slot: n, meta: meta(n), data: read(n) };
  }
  // 匯入：檢查是不是這款遊戲的存檔，寫進欄位 n（覆蓋）。回傳 true／丟出錯誤碼（'bad' | 'otherGame' | 'full'）
  function importSlot(obj, n = slot) {
    if (!obj || typeof obj !== 'object' || !obj.data || typeof obj.data !== 'object') throw new Error('bad');
    if (obj.game !== game) throw new Error('otherGame');
    if ((obj.version | 0) > version) throw new Error('bad');
    const before = keysOf(n).map(k => [sk(n, k), ls.get(sk(n, k))]).concat([[logKey(n), ls.get(logKey(n))], [metaKey(n), ls.get(metaKey(n))]]);
    const incoming = Object.keys(obj.data).filter(k => k !== '__log' && isSlotKey(k));
    try {
      for (const k of keysOf(n)) if (!incoming.includes(k)) ls.del(sk(n, k));
      for (const k of incoming) { const v = obj.data[k]; if (v == null) ls.del(sk(n, k)); else ls.set(sk(n, k), enc(v)); }
      if (Array.isArray(obj.data.__log)) ls.set(logKey(n), JSON.stringify(obj.data.__log)); else ls.del(logKey(n));
      ls.set(metaKey(n), JSON.stringify({ ...(obj.meta || {}), created: obj.meta?.created || Date.now(), saved: Date.now(), imported: Date.now() }));
    } catch {
      // 空間不夠：還原成匯入前的樣子
      for (const k of keysOf(n)) ls.del(sk(n, k));
      for (const [k, v] of before) { if (v == null) ls.del(k); else try { ls.set(k, v); } catch { /* */ } }
      throw new Error('full');
    }
    if (n === slot) lastSaved = Date.now();
    return true;
  }
  // 遊玩紀錄（每局一筆，最新的在最後；最多 max 筆）
  const logs = (n = slot) => parse(ls.get(logKey(n)), []);
  function log(entry, max = 100) {
    const a = logs(); a.push({ ...entry, t: Date.now() });   // t＝時間戳（紀錄裡不要用 t 當其他欄位）
    while (a.length > max) a.shift();
    try { ls.set(logKey(slot), JSON.stringify(a)); } catch { return false; }
    touch(); return true;
  }
  return {
    game, store, ls: facade, slots, read, meta, used, setSlot, clear, exportSlot, importSlot, log, logs,
    get slot() { return slot; }, get lastSaved() { return lastSaved; },
  };
}
