// 存檔欄位（Company/playbooks/save-system.md）：進度 `mapleRidgeSave` 跟著欄位走（eosv_mr_s{N}_mapleRidgeSave），
// 聲音設定 `mapleRidgeSettings` 全欄位共用；舊進度第一次載入時搬進存檔 1。遊玩紀錄：每次目標推進、敲響回音鐘各一筆。
import { createSaves } from './save.js';
import { createSaveUI } from './saveui.js';
import { GOALS } from './story.js';

export const saves = createSaves({ game: 'MapleRidge', prefix: 'eosv_mr_', slotKeys: ['mapleRidgeSave'], raw: true });
const fmtT = s => `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}`;
export const saveUI = createSaveUI(saves, {
  name: '楓嶺·回音鐘', file: 'MapleRidge', lang: () => 'zh',
  summary: d => {
    let s = null; try { s = JSON.parse(d.mapleRidgeSave || 'null'); } catch { /* */ }
    if (!s) return '';
    const n = o => Object.keys(o || {}).length;
    return `目標：${GOALS[s.goal] || s.goal}<br>落葉 ${n(s.leaves)}・明信片 ${n(s.postcards)}・素描 ${n(s.sketches)}${s.time ? `・遊玩 ${fmtT(s.time)}` : ''}`;
  },
  logRow: e => e.k === 'bell'
    ? { title: '敲響回音鐘', result: e.golden ? '金色回音' : '鐘聲響起', ok: true }
    : { title: GOALS[e.goal] || e.goal, result: '新目標', ok: true },
});
