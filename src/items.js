// items.js — item catalog + hand-drawn 16×16 pixel icons (a dark outline is added automatically)
const OUT = '#2a1a10';

// draw art rows → canvas data URL at `scale`, with 1px outline around filled pixels
export function drawIcon(art, pal, scale = 3, outline = true) {
  const H = art.length + 2, W = Math.max(...art.map(r => r.length)) + 2;
  const grid = [...Array(H)].map(() => Array(W).fill(null));
  art.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.' && pal[ch]) grid[y + 1][x + 1] = pal[ch]; }));
  if (outline) {
    const filled = grid.map(r => r.map(c => !!c));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (filled[y][x]) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => filled[y + b]?.[x + a])) grid[y][x] = OUT;
    }
  }
  const cv = document.createElement('canvas'); cv.width = W * scale; cv.height = H * scale;
  const ctx = cv.getContext('2d');
  grid.forEach((row, y) => row.forEach((c, x) => { if (c) { ctx.fillStyle = c; ctx.fillRect(x * scale, y * scale, scale, scale); } }));
  return cv.toDataURL();
}

const ART = {
  gloves: [['..aa.aa.........', '.aAAaAAa.aa.....', '.aAAaAAaaAAa....', '.aAAaAAaaAAa....', '.aAAAAAAAAAa.aa.', '.aAAAAAAAAAaaAa.', '.aAAAAAAAAAAAAa.', '.aAAAAAAAAAAAa..', '..aAAAAAAAAAa...', '..cccccccccc....', '..cCcCcCcCcc....', '..cccccccccc....'],
    { a: '#d8a060', A: '#b87a3a', c: '#7a4a24', C: '#a06a3a' }],
  rod: [['.............ww.', '............b.w.', '...........b..w.', '..........b...w.', '.........b....w.', '........b.....w.', '.......b......w.', '......b.......r.', '.....b........r.', '....B.........R.', '...BB...........', '..BmB...........', '.Bmm............', 'BBB.............'],
    { b: '#a8743a', B: '#6a4426', m: '#c8c8c0', w: '#e8e8e8', r: '#e8402a', R: '#ffffff' }],
  rope: [['....rrrrrr......', '..rrRRRRRRrr....', '.rR........Rr...', 'rR..rrrrrr..Rr..', 'rR.rR....Rr.Rr..', 'rR.rR....Rr.Rr..', 'rR..rrrrrr..Rr..', '.rR........Rr...', '..rrRRRRRRrr....', '....rrrrrrRr....', '..........rR....', '...........rR...', '............r...'],
    { r: '#c9a66b', R: '#e8cc90' }],
  lantern: [['......kk........', '.....k..k.......', '....kkkkkk......', '...kmmmmmmk.....', '...kyYYYYyk.....', '...kyYWWYyk.....', '...kyYWWYyk.....', '...kyYYYYyk.....', '...kyyyyyyk.....', '...kmmmmmmk.....', '....kkkkkk......'],
    { k: '#3a3328', m: '#6a5a40', y: '#f0a030', Y: '#ffd060', W: '#fff6c0' }],
  hammer: [['..bbbbbbb.......', '.bBBBBBBBb......', '.bBYYYYYBb......', '.bBBBBBBBb......', '..bbbbbbb.......', '.....ww.........', '.....wW.........', '.....wW.........', '.....wW.........', '.....wW.........', '....cccc........', '.....ww.........', '.....ww.........'],
    { b: '#8a6020', B: '#c9963a', Y: '#f2cc6a', w: '#6a4426', W: '#8a5a32', c: '#d8402a' }],
  key: [['...yyyy.........', '..yY..Yy........', '..y....y........', '..y....y........', '..yY..Yy........', '...yyyyYyyyyy...', '........Yy.yy...', '........y...y...'],
    { y: '#e8c040', Y: '#fff0a0' }],
  truckKey: [['..bbbb..........', '.bBBBBb.........', '.bB..Bb.........', '.bBBBBbmmmmmmm..', '..bbbb.mMMMMMmm.', '.......m.m..m...', '.......m........'],
    { b: '#4a7ab0', B: '#7aa8d8', m: '#9a9a90', M: '#d0d0c8' }],
  whistle: [['.......bb.......', '......b..b......', '..ssssssssss....', '.sSSSSSSSSSSs...', '.sS.oo..SSSSs...', '.sSSSSSSSSSSs...', '..ssssssssss....', '..........rr....', '..........r.....'],
    { s: '#9a9a90', S: '#d8d8d0', o: '#3a3a40', b: '#c9a66b', r: '#d8402a' }],
  postcard: [['wwwwwwwwwwwwww', 'wWWWWWWWWWrrrw', 'wWkkkkkWWWrRrw', 'wWWWWWWWWWrrrw', 'wWkkkkkkkWWWWw', 'wWWWWWWWWWWWWw', 'wWkkkkkkWWbbbw', 'wWWWWWWWWWWWWw', 'wwwwwwwwwwwwww'],
    { w: '#c8b48a', W: '#f6eed8', k: '#9a8a70', r: '#d8402a', R: '#ffd27a', b: '#5a8ac0' }],
  leaf: [['.......y.......', '......yYy......', '..y..yYYYy..y..', '..yy.yYYYy.yy..', '..yyyyyYyyyyy..', 'yyyyyyyYyyyyyyy', '.yyyyyyYyyyyyy.', '..yyyyyYyyyyy..', '...yyyyYyyyy...', '..yyy..Y..yyy..', '.......b.......', '.......b.......'],
    { y: '#f2b53a', Y: '#a8641a', b: '#7a4a1a' }],
  fish: [['...........bb..', '....bbbbb.bBb..', '..bbBBBBBbBBb..', '.bBwBBBBBBBb...', 'bBBBBBBBBBBBb..', '.bBBBBBBBBBb...', '..bbBBBBBbBBb..', '....bbbbb.bBb..', '...........bb..'],
    { b: '#3a6a80', B: '#5a9ab0', w: '#ffffff' }],
  sketch: [['kkkkkkkkkkkk', 'kwwwwwwwwwwk', 'kwgggwwwwwwk', 'kwgGgwwooowk', 'kwgggwwoOowk', 'kwwwwwwooowk', 'kwbbbbbbbbwk', 'kwwwwwwwwwwk', 'kkkkkkkkkkkk'],
    { k: '#6a4426', w: '#f6eed8', g: '#6a8a3a', G: '#8aaa4a', o: '#d8702a', O: '#f0a040', b: '#5a8ac0' }],
  pinecone: [['.....gg.....', '....gG......', '...bBbBb....', '..bBbBbBb...', '..BbBbBbB...', '..bBbBbBb...', '...BbBbB....', '...bBbBb....', '....BbB.....', '.....b......'],
    { g: '#4f6a2b', G: '#6f8a3b', b: '#7a4a24', B: '#a8703a' }],
  berry: [['......gg......', '.....gGg......', '....g..g......', '..rr....rr....', '.rRrr..rRrr...', '.rrrr..rrrr...', '..rr.rr.rr....', '....rRrr......', '....rrrr......', '.....rr.......'],
    { g: '#4f6a2b', G: '#7f9a3b', r: '#b82a3a', R: '#ff8a9a' }],
  mushroom: [['...rrrrrr...', '..rRrWrrRr..', '.rrrrrrWrrr.', '.rWrrRrrrrr.', 'rrrrrrrrrWrr', '...wwwwww...', '....wWww....', '....wWww....', '....wwww....'],
    { r: '#c23a26', R: '#e86a4a', W: '#fff6e0', w: '#efe4cc' }],
  shoes: [['...........', '..bb.......', '.bBBb......', '.bBBbb.....', '.bBBBBbbb..', '.bBBBBBBBb.', '.wwwwwwwwww', '.kkkkkkkkkk'],
    { b: '#d8402a', B: '#f06a4a', w: '#f6eed8', k: '#3a2a1e' }],
  compass: [['...gggggg...', '..gGGGGGGg..', '.gGWWWWWWGg.', 'gGWWWrWWWWGg', 'gGWWWrrWWWGg', 'gGWWWrWWWWGg', 'gGWWWkWWWWGg', 'gGWWkkWWWWGg', '.gGWWkWWWGg.', '..gGGGGGGg..', '...gggggg...'],
    { g: '#8a6020', G: '#d8a040', W: '#f6eed8', r: '#d8402a', k: '#3a2a1e' }],
  scope: [['..........bb', '........bBBb', '......bBBBb.', '....mmBBBb..', '...mMMmBb...', '..bmMMmb....', '.bBbmmb.....', 'bBBBbb......', 'bBBb........', '.bb.........'],
    { b: '#6a4426', B: '#a8743a', m: '#8a8a80', M: '#d0d0c8' }],
  watch: [['.....yy.....', '....y..y....', '...yyyyyy...', '..yYYYYYYy..', '.yYWWWWWWYy.', '.yYWWkWWWYy.', '.yYWWkWWWYy.', '.yYWWkkkWYy.', '.yYWWWWWWYy.', '..yYYYYYYy..', '...yyyyyy...'],
    { y: '#a87a20', Y: '#f2cc6a', W: '#fff6e0', k: '#3a2a1e' }],
  treat: [['....bbbb....', '..bbBBBBbb..', '.bBBBbBBBBb.', 'bBBbBBBBbBBb', 'bBBBBBbBBBBb', '.bBBbBBBBBb.', '..bbBBBBbb..', '....bbbb....'],
    { b: '#8a5a2a', B: '#c88a4a' }],
};
const FISH_COL = { '鯽魚': ['#6a7a5a', '#9aa880'], '紅尾鯉': ['#a8402a', '#e8704a'], '楓葉鯰': ['#6a4a2a', '#b8803a'], '溪哥': ['#4a7a9a', '#8ac0d8'], '高山鱒': ['#5a7a6a', '#c88aa0'], '金鱗魚': ['#a87a10', '#ffd040'] };

// Gemini-generated icon art (assets/items/*.png); code-drawn pixel icons are the fallback
const ASSET = { '鯽魚': 'fish_jiyu', '紅尾鯉': 'fish_koi', '楓葉鯰': 'fish_catfish', '溪哥': 'fish_minnow', '高山鱒': 'fish_trout', '金鱗魚': 'fish_gold', fish: 'fish_jiyu' };
const HAS = new Set(['gloves', 'rod', 'rope', 'lantern', 'hammer', 'whistle', 'key', 'truckKey', 'pinecone', 'berry', 'mushroom', 'treat', 'shoes', 'compass', 'scope', 'watch', 'leaf', 'postcard', 'sketch']);
const cache = {};
export function icon(id, scale = 3) {
  if (HAS.has(id) || ASSET[id]) return `./assets/items/${ASSET[id] || id}.png`;
  const k = id + '@' + scale;
  if (cache[k]) return cache[k];
  let a = ART[id];
  if (!a && FISH_COL[id]) a = [ART.fish[0], { ...ART.fish[1], b: FISH_COL[id][0], B: FISH_COL[id][1] }];
  if (!a) a = ART.postcard;
  return (cache[k] = drawIcon(a[0], a[1], scale));
}

// cat: tool | key | collect | material | upgrade
export const ITEMS = {
  gloves: { name: '工作手套', cat: 'tool', desc: '爺爺留給你的手套,上面寫著「小禾專用」。可以推動大石頭。' },
  rod: { name: '釣竿', cat: 'tool', desc: '王伯「第二好」的釣竿。面對水邊按 E 釣魚。' },
  rope: { name: '繩索', cat: 'tool', desc: '老陳本來要拿來綁鴨子的繩子。可以修好壞掉的梯子。' },
  lantern: { name: '提燈', cat: 'tool', desc: '爺爺寄放在磨坊的提燈。能點亮古燈,也能照亮山洞。' },
  hammer: { name: '鐘槌', cat: 'tool', desc: '包著布的小鐘槌。布上縫著「給下一個守鐘人」。' },
  whistle: { name: '狗哨', cat: 'tool', desc: '吹一下(按 P),豆豆就會跑回你身邊。', use: 'whistle' },
  key: { name: '工具棚鑰匙', cat: 'key', desc: '阿梅奶奶保管的鑰匙,打開爺爺的工具棚。' },
  truckKey: { name: '小藍的鑰匙', cat: 'key', desc: '爺爺那台藍色小貨車的鑰匙。鑰匙圈是一顆松果。' },
  pinecone: { name: '松果', cat: 'material', desc: '松樹下撿到的。豆豆很喜歡追著它跑。', use: 'feed', love: 1 },
  berry: { name: '野莓', cat: 'material', desc: '酸酸甜甜。可以餵寵物,也可以自己吃(但你沒有胃口)。', use: 'feed', love: 2 },
  mushroom: { name: '香菇', cat: 'material', desc: '林子裡的香菇。阿梅奶奶說這種可以吃,你選擇相信她。', use: 'feed', love: 2 },
  treat: { name: '狗餅乾', cat: 'material', desc: '阿梅奶奶烤的狗餅乾。豆豆的最愛。', use: 'feed', love: 4 },
  shoes: { name: '輕便跑鞋', cat: 'upgrade', desc: '穿上之後跑得更快(按住 Shift 或「跑」鍵奔跑)。' },
  compass: { name: '楓葉羅盤', cat: 'upgrade', desc: '指向最近的金楓葉。' },
  scope: { name: '望遠鏡', cat: 'upgrade', desc: '按 Z 拉遠視野;地圖上會顯示金楓葉。' },
  watch: { name: '爺爺的懷錶', cat: 'upgrade', desc: '停在爺爺第一次敲鐘的那一刻。' },
};
export const CAT_NAMES = { tool: '道具', key: '鑰匙', material: '素材', upgrade: '收藏品', collect: '收集' };
