// 存檔畫面（共用）：3 個存檔欄位卡片（使用／開始新遊戲、匯出 .json、匯入、刪除按兩次）＋「遊玩紀錄」分頁＋「已自動存檔」提示。
// 自己插 DOM 和 CSS，不依賴遊戲的樣式；中／英／日／韓文字內建。搭配 save.js（Company/playbooks/save-system.md）。
//
// import { createSaveUI } from './saveui.js';
// const ui = createSaveUI(saves, { name: { zh: '疊居謎案', en: 'Stack Mystery' }, lang: () => getLang(), summary: (data, n) => '…', logRow: e => ({ title, result, detail, ok }) });
// menu.appendChild(ui.button());   // 「💾 存檔 1」按鈕
// App 有原生備份時：onData(n, 'delete'|'import') 在任何欄位被刪除／匯入後呼叫，用來同步備份。
// 一局結束：saves.log({ title: '第 3 案', result: '破案', detail: 'A・12:30', ok: true }); ui.toast();  // 或 resultEl.textContent = ui.savedText()
const T = {
  zh: {
    saves: '存檔', slotN: '存檔 {n}', inUse: '使用中', emptySlot: '空的存檔欄位', lastSave: '最後存檔：{d}', useSlot: '使用這個存檔', newSlot: '從這裡開始新遊戲',
    exportS: '匯出', importS: '匯入', del: '刪除', sure: '再按一次確定', close: '關閉', tabSlots: '存檔欄位', tabLog: '遊玩紀錄',
    tip: '進度會自動存到「使用中」的欄位。匯出成 .json 檔可以備份，或換裝置繼續玩；語言、聲音、畫面等設定所有欄位共用。',
    logEmpty: '還沒有紀錄，玩一局就會出現在這裡。', logSum: '存檔 {s} 最近 {n} 筆紀錄（最多保留 100 筆）', records: '{n} 筆遊玩紀錄', noRecords: '有進度，還沒有遊玩紀錄',
    expOk: '已匯出存檔 {n}', impOk: '已匯入到存檔 {n}', delOk: '已刪除存檔 {n}', errBad: '這不是有效的存檔檔案', errOther: '這是別款遊戲的存檔', errFull: '儲存空間不夠，沒有改動任何東西',
    autosaved: '已自動存檔（存檔 {n}）', file: '存檔',
  },
  en: {
    saves: 'Saves', slotN: 'Save {n}', inUse: 'In use', emptySlot: 'Empty slot', lastSave: 'Last saved: {d}', useSlot: 'Use this save', newSlot: 'Start a new game here',
    exportS: 'Export', importS: 'Import', del: 'Delete', sure: 'Tap again to confirm', close: 'Close', tabSlots: 'Save slots', tabLog: 'Play log',
    tip: 'Progress saves automatically to the slot in use. Export a .json file to back it up or continue on another device. Settings (language, sound, display) are shared by all slots.',
    logEmpty: 'No records yet. Play a round and it will show up here.', logSum: 'Last {n} records in Save {s} (up to 100 are kept)', records: '{n} play records', noRecords: 'Progress, no play records yet',
    expOk: 'Exported Save {n}', impOk: 'Imported into Save {n}', delOk: 'Deleted Save {n}', errBad: 'This is not a valid save file', errOther: 'This save file is from another game', errFull: 'Not enough storage space; nothing was changed',
    autosaved: 'Saved automatically (Save {n})', file: 'save',
  },
  ja: {
    saves: 'セーブ', slotN: 'セーブ {n}', inUse: '使用中', emptySlot: '空きスロット', lastSave: '最終セーブ：{d}', useSlot: 'このセーブを使う', newSlot: 'ここで新しく始める',
    exportS: '書き出し', importS: '読み込み', del: '削除', sure: 'もう一度押して確定', close: '閉じる', tabSlots: 'セーブスロット', tabLog: 'プレイ記録',
    tip: '進行状況は「使用中」のスロットに自動でセーブされます。.json ファイルに書き出せば、バックアップや別の端末での続きに使えます。言語・サウンド・画面の設定は全スロット共通です。',
    logEmpty: 'まだ記録がありません。1 回遊ぶとここに表示されます。', logSum: 'セーブ {s} の最近 {n} 件（最大 100 件）', records: 'プレイ記録 {n} 件', noRecords: '進行あり・プレイ記録なし',
    expOk: 'セーブ {n} を書き出しました', impOk: 'セーブ {n} に読み込みました', delOk: 'セーブ {n} を削除しました', errBad: '有効なセーブファイルではありません', errOther: '別のゲームのセーブファイルです', errFull: '保存容量が足りません。何も変更していません',
    autosaved: '自動セーブしました（セーブ {n}）', file: 'セーブ',
  },
  ko: {
    saves: '저장', slotN: '저장 {n}', inUse: '사용 중', emptySlot: '빈 슬롯', lastSave: '마지막 저장: {d}', useSlot: '이 저장 사용', newSlot: '여기서 새 게임 시작',
    exportS: '내보내기', importS: '가져오기', del: '삭제', sure: '한 번 더 눌러 확인', close: '닫기', tabSlots: '저장 슬롯', tabLog: '플레이 기록',
    tip: '진행 상황은 "사용 중" 슬롯에 자동 저장됩니다. .json 파일로 내보내면 백업하거나 다른 기기에서 이어서 할 수 있습니다. 언어·소리·화면 설정은 모든 슬롯이 함께 씁니다.',
    logEmpty: '아직 기록이 없습니다. 한 판 플레이하면 여기에 나타납니다.', logSum: '저장 {s}의 최근 기록 {n}개 (최대 100개)', records: '플레이 기록 {n}개', noRecords: '진행 있음, 플레이 기록 없음',
    expOk: '저장 {n}을(를) 내보냈습니다', impOk: '저장 {n}에 가져왔습니다', delOk: '저장 {n}을(를) 삭제했습니다', errBad: '올바른 저장 파일이 아닙니다', errOther: '다른 게임의 저장 파일입니다', errFull: '저장 공간이 부족합니다. 아무것도 바꾸지 않았습니다',
    autosaved: '자동 저장됨 (저장 {n})', file: 'save',
  },
};
const LOCALE = { zh: 'zh-TW', en: 'en-US', ja: 'ja-JP', ko: 'ko-KR' };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CSS = `
.eoSave{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:12px;background:rgba(20,16,12,.55);font-family:var(--eo-font,system-ui,-apple-system,"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif);color:#2b2622;-webkit-text-size-adjust:100%}
.eoSave.hidden,.eoSave .hidden{display:none!important}
.eoSave *{box-sizing:border-box}
.eoSave .eoCard{width:min(720px,100%);max-height:calc(100dvh - 24px);display:flex;flex-direction:column;background:#fbf6ec;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.35);padding:14px 16px;overflow:hidden}
.eoSave .eoHead{display:flex;align-items:center;gap:10px}.eoSave h2{margin:0;font-size:20px;flex:1}
.eoSave button{font:inherit;font-size:14px;line-height:1.2;padding:8px 12px;min-height:36px;border-radius:10px;border:1.5px solid #c9bba6;background:#fff;color:#2b2622;cursor:pointer;touch-action:manipulation}
.eoSave button:hover{border-color:#8a7a66}
.eoSave button.pri{background:var(--eo-accent,#2f6f5e);border-color:var(--eo-accent,#2f6f5e);color:#fff}
.eoSave button.warn{background:#c0392b;border-color:#c0392b;color:#fff}
.eoSave .eoX{min-width:36px;padding:6px 10px}
.eoSave .eoTabs{display:flex;gap:6px;margin:10px 0 8px}.eoSave .eoTabs button.on{background:#2b2622;border-color:#2b2622;color:#fbf6ec}
.eoSave .eoBody{overflow:auto;-webkit-overflow-scrolling:touch;flex:1;min-height:0}
.eoSave .eoTip{font-size:13px;color:#6d6257;margin:0 0 10px;line-height:1.5}
.eoSave .eoSlots{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.eoSave .eoSlot{border:1.5px solid #ddd0bd;border-radius:12px;padding:10px;background:#fff;display:flex;flex-direction:column;gap:6px;min-width:0}
.eoSave .eoSlot.on{border-color:var(--eo-accent,#2f6f5e);box-shadow:0 0 0 2px var(--eo-accent,#2f6f5e) inset}
.eoSave .eoSh{display:flex;align-items:center;gap:6px}.eoSave .eoSh b{font-size:16px}
.eoSave .eoPill{font-size:11px;padding:2px 8px;border-radius:99px;background:var(--eo-accent,#2f6f5e);color:#fff}
.eoSave .eoSs{font-size:13px;line-height:1.45;color:#2b2622;word-break:break-word}.eoSave .eoSs.empty{color:#9a8e80}
.eoSave .eoSd{font-size:11px;color:#8a7f72;min-height:14px}
.eoSave .eoSb{display:flex;flex-wrap:wrap;gap:6px;margin-top:auto}.eoSave .eoSb button{padding:6px 9px;font-size:13px;min-height:34px}
.eoSave .eoMsg{min-height:20px;margin-top:8px;font-size:13px;color:#2f6f5e}.eoSave .eoMsg.bad{color:#c0392b}
.eoSave .eoSum{font-size:12px;color:#8a7f72;margin-bottom:6px}
.eoSave .eoRow{display:grid;grid-template-columns:1fr auto;gap:2px 12px;padding:7px 4px;border-bottom:1px dashed #ddd0bd;font-size:13px}
.eoSave .eoRow b{font-size:13px}.eoSave .eoRow small{display:block;font-size:11px;color:#8a7f72}
.eoSave .eoRow .r{text-align:right;white-space:nowrap}.eoSave .eoRow.bad .r{color:#b5493c}.eoSave .eoRow.ok .r{color:#2f6f5e}
.eoSave .eoRow .d{grid-column:1/-1;font-size:12px;color:#6d6257}
.eoSave .eoEmpty{padding:24px 8px;text-align:center;color:#8a7f72;font-size:14px}
.eoSaveBtn{cursor:pointer}
.eoToast{position:fixed;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translate(-50%,20px);opacity:0;z-index:2147482999;pointer-events:none;background:rgba(30,26,22,.88);color:#fff;font:13px/1.3 system-ui,-apple-system,"Noto Sans TC",sans-serif;padding:8px 14px;border-radius:99px;transition:opacity .25s,transform .25s;white-space:nowrap}
.eoToast.show{opacity:1;transform:translate(-50%,0)}
@media (max-width:640px){
  .eoSave{padding:8px}.eoSave .eoCard{padding:12px;border-radius:14px;max-height:calc(100dvh - 16px)}
  .eoSave .eoSlots{grid-template-columns:1fr;gap:8px}.eoSave h2{font-size:18px}
  .eoSave .eoSlot{padding:9px}
}
@media (max-height:500px){
  .eoSave{padding:6px}.eoSave .eoCard{padding:10px 12px;max-height:calc(100dvh - 12px)}.eoSave h2{font-size:16px}
  .eoSave .eoTip{display:none}.eoSave .eoTabs{margin:6px 0}.eoSave .eoTabs button,.eoSave .eoX{min-height:32px;padding:5px 10px}
  .eoSave .eoSlot{padding:8px;gap:4px}.eoSave .eoSb button{min-height:30px;padding:4px 8px}
}`;

export function createSaveUI(saves, opt = {}) {
  const lang = () => { const l = (opt.lang ? opt.lang() : 'zh') || 'zh'; const k = String(l).slice(0, 2).toLowerCase(); return T[k] ? k : 'en'; };
  const t = (k, p = {}) => (T[lang()][k] ?? T.en[k]).replace(/\{(\w+)\}/g, (_, x) => p[x] ?? '');
  const gameName = () => { const n = opt.name; return typeof n === 'string' ? n : n ? (n[lang()] || n.en || n.zh || saves.game) : saves.game; };
  const fmt = ms => new Date(ms).toLocaleString(LOCALE[lang()], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const onChange = opt.onChange || (() => location.reload());

  if (!document.getElementById('eoSaveCss')) { const s = document.createElement('style'); s.id = 'eoSaveCss'; s.textContent = CSS; document.head.appendChild(s); }
  const root = document.createElement('div'); root.className = 'eoSave hidden'; root.id = 'eoSave';
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
  root.innerHTML = `<div class="eoCard"><div class="eoHead"><h2></h2><button class="eoX" data-a="close">✕</button></div>
    <div class="eoTabs"><button data-tab="slots"></button><button data-tab="log"></button></div><div class="eoBody"></div><div class="eoMsg"></div>
    <input type="file" accept=".json,application/json" hidden></div>`;
  document.body.appendChild(root);
  const $ = s => root.querySelector(s), file = $('input[type=file]');
  const toastEl = document.createElement('div'); toastEl.className = 'eoToast'; document.body.appendChild(toastEl);
  // 存檔畫面打開時，遊戲收不到按鍵／點擊
  for (const ev of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'click', 'wheel', 'contextmenu']) root.addEventListener(ev, e => e.stopPropagation(), { passive: ev !== 'contextmenu' && ev !== 'click' });
  window.addEventListener('keydown', e => { if (root.classList.contains('hidden')) return; e.stopImmediatePropagation(); if (e.key === 'Escape') close(); }, true);
  window.addEventListener('keyup', e => { if (!root.classList.contains('hidden')) e.stopImmediatePropagation(); }, true);

  let tab = 'slots', sure = null, impTarget = 1, msg = '', bad = false;
  const btns = new Set();
  function summary(n) {
    const d = saves.read(n), lg = d.__log || [];
    let s = '';
    try { s = opt.summary ? opt.summary(d, n, lang()) : ''; } catch { s = ''; }
    const rec = lg.length ? t('records', { n: lg.length }) : '';
    return s ? (rec ? `${s}<br><small>${esc(rec)}</small>` : s) : esc(rec || t('noRecords'));
  }
  function row(e) {
    let r = e;
    try { if (opt.logRow) r = { ...e, ...opt.logRow(e, lang()) }; } catch { /* old entry */ }
    return `<div class="eoRow ${r.ok === false ? 'bad' : r.ok ? 'ok' : ''}"><div><b>${esc(r.title || '')}</b><small>${fmt(e.t)}</small></div><div class="r">${esc(r.result || '')}</div>${r.detail ? `<div class="d">${esc(r.detail)}</div>` : ''}</div>`;
  }
  function render() {
    $('h2').textContent = `${t('saves')}・${gameName()}`;
    $('[data-tab=slots]').textContent = t('tabSlots'); $('[data-tab=log]').textContent = t('tabLog');
    $('.eoX').setAttribute('aria-label', t('close'));
    for (const b of root.querySelectorAll('.eoTabs button')) b.classList.toggle('on', b.dataset.tab === tab);
    let h = '';
    if (tab === 'slots') {
      h = `<p class="eoTip">${esc(t('tip'))}</p><div class="eoSlots">`;
      for (let n = 1; n <= saves.slots; n++) {
        const cur = n === saves.slot, used = saves.used(n), m = saves.meta(n), s = a => sure === a + n;
        h += `<div class="eoSlot ${cur ? 'on' : ''}" data-n="${n}"><div class="eoSh"><b>${esc(t('slotN', { n }))}</b>${cur ? `<span class="eoPill">${esc(t('inUse'))}</span>` : ''}</div>
          <div class="eoSs ${used ? '' : 'empty'}">${used ? summary(n) : esc(t('emptySlot'))}</div><div class="eoSd">${m && m.saved ? esc(t('lastSave', { d: fmt(m.saved) })) : ''}</div>
          <div class="eoSb">${cur ? '' : `<button data-a="use" class="pri">${esc(t(used ? 'useSlot' : 'newSlot'))}</button>`}${used ? `<button data-a="exp">${esc(t('exportS'))}</button>` : ''}`
          + `<button data-a="imp" class="${s('imp') ? 'warn' : ''}">${esc(t(s('imp') ? 'sure' : 'importS'))}</button>${used ? `<button data-a="del" class="${s('del') ? 'warn' : ''}">${esc(t(s('del') ? 'sure' : 'del'))}</button>` : ''}</div></div>`;
      }
      h += '</div>';
    } else {
      const lg = saves.logs();
      h = lg.length ? `<div class="eoSum">${esc(t('logSum', { n: lg.length, s: saves.slot }))}</div>` + lg.slice().reverse().map(row).join('') : `<div class="eoEmpty">${esc(t('logEmpty'))}</div>`;
    }
    $('.eoBody').innerHTML = h;
    const m = $('.eoMsg'); m.textContent = msg; m.classList.toggle('bad', bad);
    for (const b of btns) b.textContent = `💾 ${t('slotN', { n: saves.slot })}`;
  }
  function say(text, isBad) { msg = text; bad = !!isBad; }
  function exportSave(n) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(saves.exportSlot(n), null, 1)], { type: 'application/json' }));
    a.download = `${opt.file || saves.game}_${t('file')}${n}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  root.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) { if (sure) { sure = null; render(); } return; }
    if (b.dataset.tab) { tab = b.dataset.tab; sure = null; say(''); render(); return; }
    const a = b.dataset.a;
    if (a === 'close') { close(); return; }
    const n = +b.closest('.eoSlot')?.dataset.n;
    say('');
    if (a === 'use') { sure = null; saves.setSlot(n); render(); onChange(n, 'switch'); return; }
    if (a === 'exp') { sure = null; exportSave(n); say(t('expOk', { n })); }
    else if (a === 'imp') {
      if (saves.used(n) && sure !== 'imp' + n) sure = 'imp' + n;            // 會覆蓋：再按一次才選檔
      else { sure = null; impTarget = n; file.value = ''; file.click(); }
    } else if (a === 'del') {
      if (sure !== 'del' + n) sure = 'del' + n;
      else { sure = null; saves.clear(n); opt.onData?.(n, 'delete'); say(t('delOk', { n })); render(); if (n === saves.slot) onChange(n, 'delete'); return; }
    }
    render();
  });
  file.onchange = async () => {
    const f = file.files[0]; if (!f) return;
    let err = '';
    try { saves.importSlot(JSON.parse(await f.text()), impTarget); opt.onData?.(impTarget, 'import'); } catch (e) { err = e instanceof SyntaxError ? 'bad' : e.message; }
    say(err ? t({ otherGame: 'errOther', full: 'errFull' }[err] || 'errBad') : t('impOk', { n: impTarget }), !!err);
    render();
    if (!err && impTarget === saves.slot) onChange(impTarget, 'import');
  };
  function open(which) { tab = which || tab; sure = null; say(''); render(); root.classList.remove('hidden'); opt.onOpen?.(); }
  function close() { root.classList.add('hidden'); sure = null; opt.onClose?.(); }
  function button(cls = '') {
    const b = document.createElement('button'); b.type = 'button'; b.className = ('eoSaveBtn ' + cls).trim();
    b.textContent = `💾 ${t('slotN', { n: saves.slot })}`;
    b.addEventListener('click', e => { e.stopPropagation(); open('slots'); });
    btns.add(b); return b;
  }
  const savedText = () => t('autosaved', { n: saves.slot });
  function toast(text) {
    toastEl.textContent = text || savedText(); toastEl.classList.add('show');
    clearTimeout(toastEl._t); toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }
  const ui = { open, close, button, savedText, toast, refresh: render, el: root, get isOpen() { return !root.classList.contains('hidden'); }, t };
  try { window.__saves = { saves, ui }; } catch { /* */ }
  return ui;
}
