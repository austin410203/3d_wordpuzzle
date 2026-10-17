// ui.js — dialogue runner, prompts, toasts, HUD, journal, portraits, fishing panel, captions
import * as THREE from 'three';
import { NAMES, POSTCARD_TEXT, FISH, UPGRADES, GOALS } from './story.js';
import { buildCharacter, buildCat, LOOKS, initCharacters } from './characters.js';
import { pixelIcon } from './textures.js';
import * as MAP from './map.js';
import { ITEMS, CAT_NAMES, icon } from './items.js';
import { portraitURL, hasPortrait, portraitArt } from './portraits.js';

const $ = (id) => document.getElementById(id);

export const ICONS = {};
function makeIcons() {
  for (const k of [...Object.keys(ITEMS), 'leaf', 'postcard', 'fish', 'sketch']) ICONS[k] = icon(k, 3);
  ICONS.card = ICONS.postcard;
}

export class UI {
  constructor(game) {
    this.g = game;
    makeIcons();
    $('ic-leaf').src = ICONS.leaf; $('ic-card').src = ICONS.card; $('ic-fish').src = ICONS.fish;
    this.dlg = null;          // active dialogue state
    this.journalOpen = false;
    this.portraitCache = {};
    this.toastQ = [];
    document.querySelectorAll('.jtabs button').forEach(b => b.addEventListener('click', () => this.tab(b.dataset.tab)));
    $('jclose').addEventListener('click', () => this.toggleJournal(false));
    $('dialog').addEventListener('pointerdown', (e) => { if (e.target.tagName !== 'BUTTON') this.advance(); });
  }
  busy() { return !!this.dlg || this.journalOpen || this.g.fishing || this.g.cutscene; }

  // ---------------- portraits (tiny offscreen renderer)
  portrait(id) {
    if (this.portraitCache[id]) return this.portraitCache[id];
    if (!this.pr) {
      const cv = document.createElement('canvas'); cv.width = 48; cv.height = 48;
      this.pr = new THREE.WebGLRenderer({ canvas: cv, antialias: false, alpha: true, preserveDrawingBuffer: true });
      this.pr.outputColorSpace = THREE.SRGBColorSpace;
      this.pScene = new THREE.Scene();
      this.pScene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a6a, 2.2));
      const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(-1, 2, 3); this.pScene.add(d);
      this.pCam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    }
    const look = id === 'cat' ? null : LOOKS[id] || LOOKS.player;
    const m = look ? buildCharacter(look) : buildCat();
    this.pScene.add(m);
    const headY = look ? 1.3 * (look.big || 1) * 1.18 : 0.55;
    this.pCam.position.set(0.45, headY + 0.25, look ? 2.6 : 1.5); this.pCam.lookAt(0, headY - 0.12, look ? 0 : 0.2);
    this.pr.render(this.pScene, this.pCam);
    const url = this.pr.domElement.toDataURL();
    this.pScene.remove(m);
    const img = new Image(); img.src = url;
    this.portraitCache[id] = img;
    return img;
  }
  drawPortrait(id) {
    const cv = $('portrait'), ctx = cv.getContext('2d');
    if (cv.width !== 192) { cv.width = cv.height = 192; }
    ctx.imageSmoothingEnabled = true;
    if (!id || !hasPortrait(id)) { ctx.fillStyle = '#e8dcc0'; ctx.fillRect(0, 0, 192, 192); return; }
    const art = portraitArt(id);
    if (art) ctx.drawImage(art, 0, 0, 192, 192); else ctx.drawImage(portraitURL(id), 0, 0);
  }

  // ---------------- dialogue
  say(steps, npc) {
    if (this.dlg) { // never clobber an open dialogue: queue behind it
      const prev = this.dlg.res;
      return new Promise(res => { this.dlg.res = () => { prev(); setTimeout(() => this.say(steps, npc).then(res), 0); }; });
    }
    return new Promise(res => {
      this.dlg = { steps: [...steps], npc, res, i: -1, text: '', shown: 0, choice: null };
      $('dialog').classList.remove('hidden'); document.body.classList.add('dlg-open');
      this.g.audio.blip();
      this.next();
    });
  }
  next() {
    const d = this.dlg; if (!d) return;
    while (true) {
      d.i++;
      if (d.i >= d.steps.length) return this.close();
      const s = d.steps[d.i];
      if (s && s.do) { if (typeof s.do === 'function') s.do(); else if (this.g.cue) this.g.cue(s.do); continue; }
      if (s && s.ask) { this.showChoices(s.ask); return; }
      let who = d.npc, text = s;
      if (Array.isArray(s)) { who = Object.keys(NAMES).find(k => NAMES[k] === s[0]) || s[0]; text = s[1]; }
      d.who = who; d.text = text; d.shown = 0; d.choice = null;
      const name = NAMES[who] || who || '';
      $('dlg-name').textContent = name; $('dlg-name').style.visibility = name ? 'visible' : 'hidden';
      this.drawPortrait(who === '小禾' || who === 'me' ? 'player' : hasPortrait(who) ? who : null);
      $('dlg-choices').innerHTML = '';
      $('dlg-next').style.visibility = 'hidden';
      return;
    }
  }
  showChoices(opts) {
    const d = this.dlg;
    d.choice = { opts, sel: 0 };
    d.shown = d.text.length;
    $('dlg-text').textContent = d.text;
    const box = $('dlg-choices'); box.innerHTML = '';
    opts.forEach(([label], i) => {
      const b = document.createElement('button'); b.textContent = '▸ ' + label; if (i === 0) b.classList.add('sel');
      b.addEventListener('click', () => this.pick(i));
      box.appendChild(b);
    });
  }
  pick(i) {
    const d = this.dlg; if (!d || !d.choice) return;
    const [, steps] = d.choice.opts[i];
    d.steps.splice(d.i + 1, 0, ...(steps || []));
    d.choice = null; $('dlg-choices').innerHTML = '';
    this.g.audio.blip();
    this.next();
  }
  advance() {
    const d = this.dlg; if (!d || d.choice) return;
    if (d.shown < d.text.length) { d.shown = d.text.length; return; }
    this.g.audio.blip();
    this.next();
  }
  close() {
    const d = this.dlg; this.dlg = null;
    $('dialog').classList.add('hidden'); document.body.classList.remove('dlg-open');
    // the key that closed the dialogue must not also trigger the next interaction
    this.g.input.pressed.clear();
    this.g.blockInteract();
    d?.res();
  }
  updateDialog(dt, input) {
    const d = this.dlg; if (!d) return;
    if (d.choice) {
      const n = d.choice.opts.length;
      if (input.hit('ArrowUp', 'KeyW')) d.choice.sel = (d.choice.sel + n - 1) % n;
      if (input.hit('ArrowDown', 'KeyS')) d.choice.sel = (d.choice.sel + 1) % n;
      [...$('dlg-choices').children].forEach((b, i) => b.classList.toggle('sel', i === d.choice.sel));
      if (input.hit('KeyE', 'Space', 'Enter')) this.pick(d.choice.sel);
      return;
    }
    if (d.shown < d.text.length) {
      const before = Math.floor(d.shown);
      d.shown = Math.min(d.text.length, d.shown + dt * 42);
      if (Math.floor(d.shown) !== before && before % 2 === 0) this.g.audio.talkBlip(d.who === 'cat' ? 1.8 : d.who === 'chen' ? 0.7 : 1);
      $('dlg-text').textContent = d.text.slice(0, Math.floor(d.shown));
      if (d.shown >= d.text.length && d.steps[d.i + 1]?.ask) this.next();
    } else $('dlg-next').style.visibility = 'visible';
    if (input.hit('KeyE', 'Space', 'Enter')) this.advance();
  }

  // ---------------- HUD bits
  prompt(text, key = 'E', tone = '') {
    const p = $('prompt');
    if (!text) { p.classList.add('hidden'); return; }
    $('prompt-text').textContent = text; p.querySelector('.key').textContent = key;
    p.dataset.tone = tone; p.classList.remove('hidden');
  }
  toast(text, gold = false) {
    const el = document.createElement('div'); el.className = 'tst' + (gold ? ' gold' : ''); el.textContent = text;
    $('toast').appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = '0'; }, 2600);
    setTimeout(() => el.remove(), 3100);
    while ($('toast').children.length > 4) $('toast').firstChild.remove();
  }
  area(name, sub) {
    const a = $('area'); a.innerHTML = `${name}<small>${sub}</small>`;
    a.classList.add('show'); clearTimeout(this.areaT);
    this.areaT = setTimeout(() => a.classList.remove('show'), 2600);
  }
  refreshHUD() {
    const s = this.g.state;
    $('n-leaf').textContent = Object.keys(s.leaves).length;
    $('n-card').textContent = Object.keys(s.postcards).length;
    $('n-fish').textContent = Object.keys(s.fish).length;
    $('goal-text').textContent = GOALS[s.goal] || '';
    const inv = $('inv'); inv.innerHTML = '';
    const order = [['gloves', '工作手套'], ['rod', '釣竿'], ['rope', '繩索'], ['lantern', '提燈'], ['hammer', '鐘槌'], ['key', '工具棚鑰匙']];
    for (const [k, name] of order) {
      if (!s.inv[k]) continue;
      if (k === 'key' && s.inv.gloves) continue;
      const d = document.createElement('div'); d.className = 'slot'; d.title = name;
      const img = document.createElement('img'); img.src = ICONS[k]; d.appendChild(img); inv.appendChild(d);
    }
    $('compass').classList.toggle('hidden', !s.upgrades.compass);
  }

  // ---------------- fishing panel
  fishPanel(show) { $('fishing').classList.toggle('hidden', !show); }
  fishUpdate(f) {
    $('fish-title').textContent = f.phase === 'wait' ? '釣魚中…' : f.phase === 'bite' ? '有東西咬了!' : f.phase === 'reel' ? '收線!' : '';
    $('fish-hint').innerHTML = f.phase === 'wait' ? '等浮標下沉…(Esc 收竿)' : f.phase === 'bite' ? '快按 <b>E</b>!' : '白線進入綠色區域時按 <b>E</b>';
    $('fish-bar').style.visibility = f.phase === 'reel' ? 'visible' : 'hidden';
    $('fish-zone').style.left = (f.zone[0] * 100) + '%'; $('fish-zone').style.width = ((f.zone[1] - f.zone[0]) * 100) + '%';
    $('fish-mark').style.left = (f.mark * 100) + '%';
    $('fish-pips').textContent = f.phase === 'reel' ? '●'.repeat(f.hits) + '○'.repeat(3 - f.hits) + '  ' + '✕'.repeat(f.miss) : '';
  }

  // ---------------- journal
  openTab(t) {
    if (this.journalOpen && this.curTab === t) return this.toggleJournal(false);
    this.curTab = t;
    if (!this.journalOpen) this.toggleJournal(true);
    this.tab(t);
  }
  toggleJournal(force) {
    this.journalOpen = force ?? !this.journalOpen;
    $('journal').classList.toggle('hidden', !this.journalOpen);
    document.body.classList.toggle('journal-open', this.journalOpen);
    if (this.journalOpen) { this.render(this.curTab || 'quest'); this.g.audio.blip(); }
  }
  tab(t) {
    this.curTab = t;
    document.querySelectorAll('.jtabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    ['quest', 'bag', 'items', 'map', 'opts'].forEach(k => $('jp-' + k).classList.toggle('hidden', k !== t));
    this.render(t);
  }
  render(t) {
    const g = this.g, s = g.state;
    if (t === 'quest') {
      const tm = s.time | 0, hh = Math.floor(tm / 3600), mm = Math.floor(tm / 60) % 60, ss = tm % 60;
      const steps = [
        ['看信箱', s.postcards.p1], ['找回麻糬', s.flags.catHome], ['拿到工作手套', s.inv.gloves], ['渡過小溪', s.flags.creekDone],
        ['修好梯子', s.flags.LD1], ['讓水車轉動', s.flags.millFixed], ['點亮古燈林', s.flags.doorOpen], ['取得鐘槌', s.inv.hammer], ['敲響回音鐘', s.flags.rang],
      ];
      $('jp-quest').innerHTML = `<h3>目前目標</h3><p>${GOALS[s.goal] || ''}</p>
        <h3>旅程紀錄</h3>${steps.map(([n, d]) => `<div class="${d ? 'done' : 'todo'}">${d ? '✔' : '・'} ${n}</div>`).join('')}
        <h3>完成度</h3><div class="pct">${g.completion()}%</div>
        <div>遊戲時間 ${hh ? hh + ':' : ''}${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}${s.flags.rang ? ` · 登頂時間 ${fmt(s.flags.rangAt)}` : ''}</div>
        ${s.flags.trueEnd ? '<div class="done">★ 已看過「守鐘人」結局</div>' : s.flags.rang ? '<div>還有另一個結局…收集全部明信片後再敲一次鐘。</div>' : ''}`;
    } else if (t === 'bag') {
      this.renderBag();
    } else if (t === 'items') {
      const cards = MAP.POSTCARDS.map((p, i) => {
        const got = s.postcards[p.id]; const [title, text] = POSTCARD_TEXT[p.id];
        return `<div class="card ${got ? '' : 'lock'}"><b>${got ? title : '明信片 #' + (i + 1) + ' ???'}</b>${got ? text.replace(/\n/g, '<br>') : '還沒找到。'}</div>`;
      }).join('');
      const fish = Object.entries(FISH).map(([n, f]) => {
        const c = s.fish[n];
        return `<div class="card ${c ? '' : 'lock'}"><b>${c ? n + ' ×' + c : '???'}</b>${c ? f.desc : '稀有度 ' + '★'.repeat(f.rare)}</div>`;
      }).join('');
      const sk = MAP.SKETCH.map(sp => {
        const img = s.sketches[sp.id];
        return `<div class="card sketch ${img ? '' : 'lock'}">${img ? `<img src="${img}">` : ''}<b>${img ? sp.name : '??? 寫生點'}</b></div>`;
      }).join('');
      const ups = UPGRADES.map(u => `<div class="card ${s.upgrades[u.id] ? '' : 'lock'}"><b>${s.upgrades[u.id] ? u.name : '??? (' + u.n + ' 片金楓葉)'}</b>${s.upgrades[u.id] ? u.desc : '把金楓葉拿給阿梅奶奶看。'}</div>`).join('');
      $('jp-items').innerHTML = `<h3>爺爺的明信片 ${Object.keys(s.postcards).length}/5</h3><div class="cards">${cards}</div>
        <h3>金楓葉 ${Object.keys(s.leaves).length}/20 · 收藏品</h3><div class="cards">${ups}</div>
        <h3>魚類圖鑑 ${Object.keys(s.fish).length}/6</h3><div class="cards">${fish}</div>
        <h3>寫生本 ${Object.keys(s.sketches).length}/4</h3><div class="cards">${sk}</div>`;
    } else if (t === 'map') {
      this.drawMap();
    } else if (t === 'opts') {
      const a = g.audio.vol;
      $('jp-opts').innerHTML = `<h3>聲音</h3>
        <div class="opt">主音量 <input type="range" min="0" max="1" step="0.05" value="${a.master}" data-k="master"></div>
        <div class="opt">音樂 <input type="range" min="0" max="1" step="0.05" value="${a.music}" data-k="music"></div>
        <div class="opt">音效 <input type="range" min="0" max="1" step="0.05" value="${a.sfx}" data-k="sfx"></div>
        <h3>畫面</h3><div class="opt"><button id="opt-outline">描邊:${g.pr.uniforms.uOutline.value ? '開' : '關'}</button><button id="opt-shadow">陰影:${g.pr.renderer.shadowMap.enabled ? '開' : '關'}</button></div>
        <h3>存檔</h3><div class="opt"><button id="opt-save">立即存檔</button><button id="opt-wipe">刪除存檔並重新開始</button></div>
        <p style="font-size:13px;color:#6a4a30">遊戲會自動存檔。操作:WASD 移動、E 互動、Shift 奔跑、Tab 手帳、R 重置附近的推石謎題、Z 望遠鏡。</p>`;
      $('jp-opts').querySelectorAll('input[type=range]').forEach(el => el.addEventListener('input', () => { g.audio.setVol(el.dataset.k, +el.value); g.saveSettings(); }));
      $('opt-outline').onclick = () => { g.pr.uniforms.uOutline.value = 1 - g.pr.uniforms.uOutline.value; this.render('opts'); };
      $('opt-shadow').onclick = () => { g.pr.renderer.shadowMap.enabled = !g.pr.renderer.shadowMap.enabled; g.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); this.render('opts'); };
      $('opt-save').onclick = () => { g.save(); this.toast('已存檔'); };
      $('opt-wipe').onclick = () => { if (confirm('確定要刪除存檔嗎?')) { localStorage.removeItem('mapleRidgeSave'); location.reload(); } };
    }
  }
  bagEntries() {
    const s = this.g.state, out = [];
    for (const [id, it] of Object.entries(ITEMS)) {
      let n = 0;
      if (it.cat === 'tool' || it.cat === 'key') n = s.inv[id] ? 1 : 0;
      else if (it.cat === 'material') n = (s.mats || {})[id] || 0;
      else if (it.cat === 'upgrade') n = s.upgrades[id] ? 1 : 0;
      if (id === 'key' && s.inv.gloves) n = 0;
      if (n) out.push({ id, it, n, cat: it.cat });
    }
    for (const [name, n] of Object.entries(s.bagFish || {})) if (n > 0) out.push({ id: name, it: { name, cat: 'collect', desc: '剛釣到的魚,還活蹦亂跳。可以拿去餵貓或寵物。', use: 'feed', love: 3, fish: true }, n, cat: 'collect' });
    const nl = Object.keys(s.leaves).length, np = Object.keys(s.postcards).length;
    if (nl) out.push({ id: 'leaf', it: { name: '金楓葉', desc: '山裡散落的金色楓葉。拿給阿梅奶奶看會有好事。' }, n: nl, cat: 'collect' });
    if (np) out.push({ id: 'postcard', it: { name: '爺爺的明信片', desc: '在「收藏」頁可以重讀每一張。' }, n: np, cat: 'collect' });
    return out;
  }
  renderBag() {
    const ents = this.bagEntries(), el = $('jp-bag');
    const order = ['tool', 'key', 'material', 'collect', 'upgrade'];
    const cats = { ...CAT_NAMES, collect: '收集與漁獲' };
    let html = '<div class="bag"><div class="bag-grid">';
    const pet = this.g.pet;
    if (pet?.adopted) { const lv = pet.level(); html += `<div class="bag-pet"><img src="${icon('treat', 2)}"> 豆豆 <span class="hearts">${'♥'.repeat(lv)}${'♡'.repeat(4 - lv)}</span> 親密度 ${pet.st.love}${lv < 4 ? ' / ' + [5, 12, 24][lv - 1] : ''}<small>${['', '會跟著你、陪你冒險', '會嗅出附近的金楓葉', '會挖出藏在地下的寶物', '最好的夥伴'][lv]}</small></div>`; }
    for (const c of order) {
      const list = ents.filter(e => e.cat === c);
      html += `<div class="bag-h">${cats[c]}</div>`;
      if (!list.length) html += '<div class="bag-empty">(空)</div>';
      for (const e of list) html += `<button class="bslot ${this.bagSel === e.id ? 'sel' : ''}" data-id="${e.id}"><img src="${ICONS[e.id] || icon(e.id, 3)}">${e.n > 1 ? `<i>${e.n}</i>` : ''}</button>`;
    }
    html += '</div><div class="bag-info" id="bag-info"></div></div>';
    el.innerHTML = html;
    el.querySelectorAll('.bslot').forEach(b => b.addEventListener('click', () => { this.bagSel = b.dataset.id; this.renderBag(); }));
    const sel = ents.find(e => e.id === this.bagSel) || ents[0];
    const info = $('bag-info');
    if (!sel) { info.innerHTML = '<p>背包是空的。到處走走看吧!</p>'; return; }

    const canUse = sel.it.use === 'whistle' || (sel.it.use === 'feed' && pet && pet.adopted);
    info.innerHTML = `<img class="big" src="${icon(sel.id, 6)}"><b>${sel.it.name}</b>${sel.n > 1 ? ` ×${sel.n}` : ''}<p>${sel.it.desc}</p>
      ${sel.it.use === 'feed' ? `<p class="hint">${pet && pet.adopted ? `餵豆豆吃(親密度 +${sel.it.love})` : '可以拿來餵動物。'}</p>` : ''}
      ${canUse ? `<button id="bag-use">${sel.it.use === 'whistle' ? '吹狗哨' : '餵豆豆'}</button>` : ''}`;
    if (canUse) $('bag-use').onclick = () => { this.g.useItem(sel); this.renderBag(); };
  }
  mapBase() {
    if (this._mapBase) return this._mapBase;
    const cv = document.createElement('canvas'); cv.width = 448; cv.height = 384;
    const ctx = cv.getContext('2d'), w = this.g.world;
    const sx = cv.width / (MAP.COLS * 2), sz = cv.height / (MAP.ROWS * 2);
    const cols = ['#8a9a44', '#7a8a3c', '#6c7c34', '#5e6e2e', '#526228'];
    const img = ctx.createImageData(cv.width, cv.height);
    const pathMask = new Uint8Array(cv.width * cv.height);
    for (const p of w.paths) for (let i = 0; i < p.pts.length - 1; i++) {
      const [ax, az] = p.pts[i], [bx, bz] = p.pts[i + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az) * 3);
      for (let k = 0; k <= n; k++) {
        const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n, r = p.w * sx;
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const px = Math.round(x * sx + dx), py = Math.round(z * sz + dy); if (px >= 0 && py >= 0 && px < cv.width && py < cv.height) pathMask[py * cv.width + px] = 1; }
      }
    }
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
      const wx = x / sx, wz = y / sz, i = (y * cv.width + x) * 4;
      let c;
      if (w.main.isWater(wx, wz)) c = '#4f8a9a';
      else {
        const L = w.main.levelAt(wx, wz);
        c = pathMask[y * cv.width + x] ? '#c8975c' : cols[L];
        if (w.main.levelAt(wx, wz + 1.0) < L) c = '#7a5232';
      }
      const v = parseInt(c.slice(1), 16);
      img.data[i] = v >> 16; img.data[i + 1] = (v >> 8) & 255; img.data[i + 2] = v & 255; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    for (const t of w.canopies) if (t.x > 0 && t.z > 0 && (t.x * 7 + t.z * 3) % 3 < 1) { ctx.fillStyle = ['orange', 'amber', 'red'].includes(t.kind) ? 'rgba(216,112,42,.55)' : 'rgba(58,82,34,.45)'; ctx.fillRect(t.x * sx - 1, t.z * sz - 1, 3, 3); }
    return (this._mapBase = cv);
  }
  drawMap() {
    const g = this.g, cv = $('mapcv'), ctx = cv.getContext('2d');
    const sx = cv.width / (MAP.COLS * 2), sz = cv.height / (MAP.ROWS * 2);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.mapBase(), 0, 0);
    const dot = (x, z, col, r = 3) => { ctx.fillStyle = '#2a1a10'; ctx.fillRect(x * sx - r - 1, z * sz - r - 1, r * 2 + 2, r * 2 + 2); ctx.fillStyle = col; ctx.fillRect(x * sx - r, z * sz - r, r * 2, r * 2); };
    for (const h of MAP.HOUSES) dot(h.x * 2, h.z * 2, '#d8702a', 4);
    dot(MAP.BELL.x * 2, MAP.BELL.z * 2, '#ffd27a', 5);
    if (g.state.upgrades.scope) for (let i = 0; i < MAP.LEAVES.length; i++) if (!g.state.leaves[i]) dot(MAP.LEAVES[i][0] * 2, MAP.LEAVES[i][1] * 2, '#f2b53a', 2);
    ctx.font = '13px DotGothic16, sans-serif';
    const label = (t, x, z) => { ctx.fillStyle = 'rgba(243,230,200,.85)'; const w2 = ctx.measureText(t).width; ctx.fillRect(x * sx - 2, z * sz - 12, w2 + 4, 15); ctx.fillStyle = '#3a2a1e'; ctx.fillText(t, x * sx, z * sz); };
    [['楓嶺村', 8, 94], ['伐木營地', 64, 60], ['磨坊', 74, 40], ['古燈林', 6, 24], ['山頂', 44, 10]].forEach(([t, x, z]) => label(t, x, z));
    // you are here (blinks)
    const p = g.outsidePos(), on = Math.floor(performance.now() / 350) % 2 === 0;
    const X = p.x * sx, Z = p.z * sz;
    ctx.strokeStyle = '#d8402a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Z, on ? 9 : 6, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#2a1a10'; ctx.fillRect(X - 4, Z - 4, 8, 8); ctx.fillStyle = on ? '#ffffff' : '#ffd27a'; ctx.fillRect(X - 3, Z - 3, 6, 6);
    // facing arrow
    const f = g.player.face; ctx.fillStyle = '#d8402a'; ctx.fillRect(X + Math.sin(f) * 7 - 2, Z + Math.cos(f) * 7 - 2, 4, 4);
    const area = g.areaKey ? (g.areaName?.() || '') : '';
    label('你在這裡' + (area ? ' · ' + area : ''), Math.min(MAP.COLS * 2 - 30, p.x + 3), Math.max(6, p.z - 2));
    if (this.journalOpen && this.curTab === 'map') { cancelAnimationFrame(this._mapRAF); clearTimeout(this._mapT); this._mapT = setTimeout(() => this.drawMap(), 350); }
  }

  // ---------------- captions / fade
  fade(on) { $('fade').classList.toggle('on', on); return new Promise(r => setTimeout(r, 650)); }
  async captions(lines, hold = 2600) {
    const c = $('caption'); c.classList.remove('hidden');
    for (const l of lines) {
      c.style.transition = 'none'; c.style.opacity = 0; c.textContent = l;
      await new Promise(r => setTimeout(r, 60));
      c.style.transition = 'opacity .8s'; c.style.opacity = 1;
      await this.g.waitAdvance(hold + l.length * 40);
      c.style.opacity = 0;
      await new Promise(r => setTimeout(r, 700));
    }
    c.classList.add('hidden');
  }
}
const fmt = (t) => { t = t | 0; return `${Math.floor(t / 60)}分${t % 60}秒`; };
void initCharacters;
