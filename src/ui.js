// ui.js — dialogue runner, prompts, toasts, HUD, journal, portraits, fishing panel, captions
import * as THREE from 'three';
import { NAMES, POSTCARD_TEXT, FISH, UPGRADES, GOALS } from './story.js';
import { buildCharacter, buildCat, LOOKS, initCharacters } from './characters.js';
import { pixelIcon } from './textures.js';
import * as MAP from './map.js';

const $ = (id) => document.getElementById(id);

export const ICONS = {};
function makeIcons() {
  ICONS.leaf = pixelIcon([
    '....y....', '...yyy...', '.y.yYy.y.', '.yyyYyyy.', 'yyyyYyyyy', '.yyyYyyy.', '..yyYyy..', '....b....', '....b....'],
  { y: '#f2b53a', Y: '#a8641a', b: '#7a4a1a' });
  ICONS.card = pixelIcon([
    'wwwwwwwwww', 'wrrwwwwbbw', 'wrrwwwwbbw', 'wwwwwwwwww', 'wkkkkkwwww', 'wwwwwwwwww', 'wkkkkkkkww', 'wwwwwwwwww'],
  { w: '#f6eed8', r: '#d8402a', b: '#5a8ac0', k: '#9a8a70' });
  ICONS.fish = pixelIcon([
    '..........', '...bbbb...', '.bbBbbbb.b', 'bbwbbbbbbb', '.bbbbbbb.b', '...bbbb...', '..........'],
  { b: '#5a9ab0', B: '#3a6a80', w: '#ffffff' });
  const it = (art, pal) => pixelIcon(art, pal, 3);
  ICONS.key = it(['..yyy.....', '.y...y....', '.y...yyyyy', '.y...y.y.y', '..yyy.....'], { y: '#e8c040' });
  ICONS.gloves = it(['.bb.bb....', '.bbbbb.b..', '.bbbbbbb..', '.bbbbbb...', '.bbbbb....', '..ddd.....'], { b: '#b87a3a', d: '#6a4020' });
  ICONS.rod = it(['........b.', '.......b..', '......b...', '.....b....', '....b...w.', '...b....w.', '..b.....w.', '.r......w.'], { b: '#8a5a32', r: '#d8402a', w: '#dddddd' });
  ICONS.rope = it(['..rrrr..', '.r....r.', 'r..rr..r', 'r.r..r.r', 'r..rr..r', '.r....r.', '..rrrr..'], { r: '#c9a66b' });
  ICONS.lantern = it(['...kk...', '..k..k..', '.kkkkkk.', '.kyyyyk.', '.kyYYyk.', '.kyyyyk.', '.kkkkkk.'], { k: '#3a3328', y: '#ffc860', Y: '#fff0a0' });
  ICONS.hammer = it(['.bbbbb..', '.bbbbb..', '...w....', '...w....', '...w....', '...w....'], { b: '#b9893a', w: '#6a4426' });
  ICONS.fishItem = ICONS.fish;
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
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#c9b48a'; ctx.fillRect(0, 0, 48, 48);
    if (!id) return;
    const img = this.portrait(id);
    const draw = () => { ctx.fillStyle = '#c9b48a'; ctx.fillRect(0, 0, 48, 48); ctx.drawImage(img, 0, 0); };
    if (img.complete) draw(); else img.onload = draw;
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
      this.drawPortrait(who === '小禾' || who === 'me' ? 'player' : (LOOKS[who] || who === 'cat') ? who : null);
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
  prompt(text) {
    const p = $('prompt');
    if (!text) { p.classList.add('hidden'); return; }
    $('prompt-text').textContent = text; p.classList.remove('hidden');
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
  toggleJournal(force) {
    this.journalOpen = force ?? !this.journalOpen;
    $('journal').classList.toggle('hidden', !this.journalOpen);
    document.body.classList.toggle('journal-open', this.journalOpen);
    if (this.journalOpen) { this.render(this.curTab || 'quest'); this.g.audio.blip(); }
  }
  tab(t) {
    this.curTab = t;
    document.querySelectorAll('.jtabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    ['quest', 'items', 'map', 'opts'].forEach(k => $('jp-' + k).classList.toggle('hidden', k !== t));
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
  drawMap() {
    const g = this.g, cv = $('mapcv'), ctx = cv.getContext('2d'), w = this.g.world;
    const sx = cv.width / (MAP.COLS * 2), sz = cv.height / (MAP.ROWS * 2);
    const cols = ['#7a8a3a', '#6e7e34', '#62722e', '#566628', '#4a5a22'];
    const img = ctx.createImageData(cv.width, cv.height);
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
      const wx = x / sx, wz = y / sz, i = (y * cv.width + x) * 4;
      let c;
      if (w.main.isWater(wx, wz)) c = '#4f8a87';
      else {
        const L = w.main.levelAt(wx, wz), d = w.pathDist(wx, wz);
        c = d < 0 ? '#c39058' : cols[L];
        const L2 = w.main.levelAt(wx, wz + 1.2);
        if (L2 < L) c = '#7a5232';
      }
      const v = parseInt(c.slice(1), 16);
      img.data[i] = v >> 16; img.data[i + 1] = (v >> 8) & 255; img.data[i + 2] = v & 255; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const dot = (x, z, col, r = 3) => { ctx.fillStyle = '#2a1a10'; ctx.fillRect(x * sx - r - 1, z * sz - r - 1, r * 2 + 2, r * 2 + 2); ctx.fillStyle = col; ctx.fillRect(x * sx - r, z * sz - r, r * 2, r * 2); };
    for (const h of MAP.HOUSES) dot(h.x * 2, h.z * 2, '#d8702a', 4);
    dot(MAP.BELL.x * 2, MAP.BELL.z * 2, '#ffd27a', 5);
    if (g.state.upgrades.scope) for (let i = 0; i < MAP.LEAVES.length; i++) if (!g.state.leaves[i]) dot(MAP.LEAVES[i][0] * 2, MAP.LEAVES[i][1] * 2, '#f2b53a', 2);
    const p = g.player.pos;
    if (p.x < 250) { dot(p.x, p.z, '#ffffff', 4); ctx.fillStyle = '#d8402a'; ctx.fillRect(p.x * sx - 2, p.z * sz - 2, 4, 4); }
    ctx.fillStyle = '#3a2a1e'; ctx.font = '14px DotGothic16, sans-serif';
    [['楓嶺村', 14, 92], ['伐木營地', 66, 62], ['磨坊', 76, 40], ['古燈林', 10, 26], ['山頂', 46, 12]].forEach(([t, x, z]) => ctx.fillText(t, x * sx, z * sz));
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
