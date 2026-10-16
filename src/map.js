// map.js — coarse world layout for 楓嶺 (pure data, no three.js so node can test it)
// Coordinates: coarse cell (c, r) covers world x∈[2c, 2c+2], z∈[2r, 2r+2]. North = row 0 = -z.
// "Map units" in PATHS / placements are world/2, so cell (c,r) centre = (c+0.5, r+0.5).

export const COLS = 56, ROWS = 48, CELL = 2, STEP = 4.2;

const wig = (c, k) => Math.round(1.15 * Math.sin(c * 0.37 + k * 1.7) + 0.95 * Math.sin(c * 0.83 + k * 2.9));
const BASE = [35, 27, 18, 9];
export const bound = (k, c) => BASE[k] + wig(c, k);

// [c0, r0, c1, r1, level] inclusive — straight cliffs where puzzles / ladders need exact cells
const LEVEL_RECTS = [
  [2, 29, 17, 35, 1], [2, 36, 17, 40, 0],            // tutorial ramp
  [31, 28, 45, 34, 1], [48, 29, 54, 34, 1],          // east bank + secret nook
  [19, 21, 34, 27, 2], [19, 28, 34, 35, 1], [19, 36, 34, 38, 0], // creek puzzle
  [34, 21, 39, 27, 2], [34, 28, 39, 34, 1],          // rope ladder LD1
  [9, 20, 15, 27, 2], [9, 28, 15, 31, 1],            // shortcut ladder LD2
  [40, 18, 45, 25, 2], [40, 11, 45, 17, 3],          // mill lift
  [3, 11, 17, 17, 3], [3, 18, 17, 19, 2],            // lantern grove + old trail top
  [9, 4, 15, 8, 4], [9, 9, 15, 12, 3],               // cave door
  [30, 4, 34, 8, 4], [30, 9, 34, 12, 3],             // summit ladder LD3
];

// rectangles with no domain-warp (exact cell edges)
export const NOWARP = [
  [2, 29, 18, 41], [19, 27, 35, 36], [33, 26, 40, 30], [8, 26, 16, 29], [39, 16, 46, 19],
  [3, 11, 17, 18], [8, 7, 16, 10], [29, 7, 35, 10],
];

// water bodies: painted at the land level underneath (letter a..e = water at level 0..4)
const ELLIPSES = [ // [cx, cy, rx, ry]  in map units
  [31.6, 41.6, 6.2, 4.4],  // village pond
  [30.0, 23.4, 2.6, 2.0],  // spring pool on level 2
  [44.0, 2.6, 5.0, 2.4],   // summit lake
  [46.0, 38.6, 2.8, 1.6],  // main fall plunge pool (level 0)
  [46.6, 15.2, 1.9, 1.2],  // level 3 plunge pool (fishing)
];
const STREAMS = [ // [c0, r0, c1, r1] rect of water cells
  [46, 0, 47, 47],   // main waterfall chain + outflow
  [29, 23, 30, 37],  // creek: spring pool → level 1 → pond
];

// natural stepping stones over water (walkable)
export const STONES = [[46, 33], [47, 33]];

// Sokoban / layout patches. chars: '#' rock  'T' tree  'B' boulder  '_' pressure plate
// '.' clear (no auto trees)  '~' untouched
export const PATCHES = [
  { id: 'tutorial', c0: 2, r0: 36, rows: [
    '~~~~~~~~~###~~~~',
    '#T##TT#T.#T##T##',
    '##T#T##T.##T#T##',
    '######.....B....',
    '##T###T##TT##T##',
  ] },
  { id: 'creek', c0: 19, r0: 28, rows: [ // verified with tools/soko.py: 14 pushes
    'TT##..####~~.',
    'T...B....#~~.',
    '..##.#B#..~~.',
    '.......#.#~~.',
    'T.#.#B....~~.',
    'T.....#.##~~.',
    'TT##....##~~.',
    'TTT#######~~.',
  ] },
];

// Paths: points [x, z, level] in map units, w = half width (map units)
export const PATHS = [
  // village main road: cabin → Ah-Mei → dock, and around the pond
  { w: 0.85, road: true, pts: [[4.2, 46.0, 0], [5.5, 46.0, 0], [8.4, 45.8, 0], [12, 46.4, 0], [16, 45.4, 0], [19, 43.0, 0], [21, 42.6, 0]] },
  { w: 0.6, pts: [[21, 42.6, 0], [24.6, 42.6, 0]] },
  { w: 0.6, pts: [[19, 43.0, 0], [18.2, 41.4, 0], [18.4, 39.6, 0]] },
  { w: 0.8, road: true, pts: [[21, 42.6, 0], [23, 45.6, 0], [28, 46.6, 0], [34, 46.8, 0], [38.5, 45.4, 0], [41, 43.2, 0], [42.2, 40.6, 0]] },
  // tutorial corridor + ramp to level 1
  { w: 0.6, pts: [[18.4, 39.6, 0], [15, 39.5, 0], [10.5, 39.5, 0], [10.5, 37.4, 0], [9.6, 36.75, 0], [4.4, 36.75, 1], [3.3, 35.6, 1], [3.4, 33.2, 1]] },
  // level 1 west forest trail to creek puzzle
  { w: 0.55, pts: [[3.4, 33.2, 1], [6, 31.8, 1], [10, 31.2, 1], [13, 30.6, 1], [16, 31.6, 1], [19.5, 31.5, 1], [22.5, 31.5, 1]] },
  // east bank: stones landing → camp → rope ladder
  { w: 0.55, pts: [[31.5, 31.5, 1], [34, 31.8, 1], [37.5, 32.2, 1], [36.5, 29.6, 1], [36.5, 28.5, 1]] },
  // level 2: ladder top → mill, and west to spring pool, hut, shortcut ladder, old trail foot
  { w: 0.55, pts: [[36.5, 26.4, 2], [39, 25.0, 2], [40.6, 24.8, 2], [42.6, 22.6, 2], [42.6, 19.6, 2], [42.5, 18.6, 2]] },
  { w: 0.55, pts: [[36.5, 26.4, 2], [33, 25.6, 2], [27, 25.8, 2], [24, 23.6, 2], [20, 22.6, 2], [16, 23.4, 2], [12.5, 26.2, 2]] },
  { w: 0.55, pts: [[16, 23.4, 2], [12, 21.4, 2], [8, 20.6, 2]] },
  // old switchback trail level 2 → level 3 (a ledge along the cliff face)
  { w: 0.6, pts: [[8, 20.6, 2], [4.2, 20.4, 2], [3.6, 19.0, 2], [4.4, 18.62, 2], [11.6, 18.62, 3], [12.6, 17.4, 3], [12.0, 16.0, 3], [10.0, 15.0, 3]] },
  // level 3: lift top → west along the terrace → grove → cave door
  { w: 0.55, pts: [[42.5, 17.2, 3], [41.6, 15.6, 3], [40, 14.6, 3], [36, 13.8, 3], [31, 14.4, 3], [26, 13.4, 3], [21, 14.2, 3], [16.5, 13.6, 3], [12.5, 12.6, 3], [12.5, 9.6, 3]] },
  { w: 0.5, pts: [[31, 14.4, 3], [32.5, 12.4, 3], [32.5, 9.4, 3]] },
  // summit: cave mouth → bell tower → lake
  { w: 0.55, pts: [[12.5, 5.6, 4], [16, 4.6, 4], [21, 4.4, 4], [25.5, 3.8, 4]] },
  { w: 0.5, pts: [[25.5, 3.8, 4], [30, 4.4, 4], [32.5, 7.0, 4]] },
  { w: 0.5, pts: [[30, 4.4, 4], [35, 4.0, 4], [38.5, 3.6, 4]] },
];

// clearings (no auto trees) — [x, z, radius] map units
export const CLEARINGS = [
  [8.2, 44.4, 3.4], [20.8, 41.2, 3.0], [13.6, 45.6, 2.0], [25, 42.5, 1.6], [37.5, 32, 3.4], [40.6, 23.0, 3.2],
  [25.5, 3.6, 4.2], [12.5, 6, 2.2], [9.5, 13.2, 5.2], [31, 12.4, 2.4], [24, 20.5, 2.6], [39, 3.6, 2.6],
  [49.8, 32, 1.8], [36.5, 27.8, 1.4], [42.5, 17.5, 1.6], [45.6, 21.4, 2.6], [12.5, 27.2, 1.5], [32.5, 8.2, 1.4],
  [6, 31.6, 1.8], [44, 13.6, 2.2],
];

// ---------------------------------------------------------------------------------------------
// Placements (map units). y comes from terrain.
export const HOUSES = [
  { id: 'cabin', x: 8.0, z: 43.4, w: 4.2, d: 3.0, style: 'barn', rot: 0 },
  { id: 'amei', x: 21.2, z: 40.0, w: 3.6, d: 2.8, style: 'tudor', rot: 0 },
  { id: 'shed', x: 13.6, z: 44.4, w: 2.2, d: 1.8, style: 'shed', rot: 0 },
  { id: 'hut2', x: 24.0, z: 19.8, w: 2.4, d: 2.0, style: 'hut', rot: 0 },
  { id: 'hut3', x: 31.0, z: 11.6, w: 2.4, d: 2.0, style: 'hut', rot: 0 },
  { id: 'mill', x: 41.0, z: 22.6, w: 3.6, d: 3.2, style: 'mill', rot: 0 },
  { id: 'hutE', x: 38.8, z: 34.4, w: 2.2, d: 1.8, style: 'hut', rot: 0 },
];

export const NPCS = [
  { id: 'amei', x: 22.5, z: 41.25 },
  { id: 'wang', x: 24.0, z: 43.6 },
  { id: 'cat', x: 38.6, z: 44.0 },
  { id: 'chen', x: 36.0, z: 32.6 },
  { id: 'song', x: 40.0, z: 24.4 },
  { id: 'yu', x: 21.0, z: 13.6 },
];

export const LADDERS = [ // bottom cell (c, r) lower, top is r-1. need: rope?
  { id: 'LD1', c: 36, r: 28, need: 'rope' },
  { id: 'LD2', c: 12, r: 28, need: 'rope' },
  { id: 'LD3', c: 32, r: 9, need: 'rope' },
];

export const LIFT = { c: 42, r: 18 };     // bottom cell (level 2), top r-1 (level 3)
export const CAVE_DOOR = { x: 12.5, z: 9.1 };    // on level 3 face of level-4 cliff
export const CAVE_MOUTH = { x: 12.5, z: 5.4 };   // on summit
export const BELL = { x: 25.5, z: 2.6 };
export const SPAWN = { x: 8.6, z: 46.2 };

export const LANTERNS = [ // order = ascending height; positions shuffled in the grove
  { x: 13.6, z: 15.4, h: 0.9 }, { x: 5.0, z: 12.0, h: 1.3 }, { x: 14.6, z: 11.4, h: 1.75 }, { x: 7.6, z: 14.2, h: 2.25 },
];
export const LANTERN_ORDER = [0, 1, 2, 3];

export const MILL = {   // world units here (troughs are fiddly)
  levers: [[77.4, 43.4], [77.4, 44.8], [77.4, 46.2], [77.4, 47.6]],
  wheel: [88.3, 45.6],
  // trough nodes: S source at the fall, G gates, J junction, W wheel, X spill end
  nodes: { S: [92.8, 37.6], G1: [91.2, 37.8], J: [89.6, 38.4], G2: [88.2, 38.4], X: [86.6, 38.4], G3: [89.5, 40.4], G4: [89.3, 42.3], W: [88.6, 43.9] },
  troughY: 2.9,     // above level-2 ground
  toggles: [['G1', 'G2'], ['G2', 'G3'], ['G3', 'G4'], ['G4']],
  start: { G1: 0, G2: 1, G3: 0, G4: 0 },
};

export const SKETCH = [
  { id: 's1', x: 36.6, z: 44.6, name: '楓葉池塘' },
  { id: 's2', x: 25.6, z: 20.6, name: '二層山屋' },
  { id: 's3', x: 32.4, z: 12.6, name: '雲海平台' },
  { id: 's4', x: 22.0, z: 3.4, name: '回音鐘頂' },
];

export const FISH_SPOTS = [
  { id: 'pond', x: 26.5, z: 42.6, r: 1.2, pool: ['鯽魚', '紅尾鯉', '楓葉鯰'] },
  { id: 'falls', x: 44.6, z: 15.0, r: 2.0, pool: ['溪哥', '高山鱒'] },
  { id: 'lake', x: 38.2, z: 3.6, r: 1.6, pool: ['高山鱒', '金鱗魚'] },
];

export const POSTCARDS = [
  { id: 'p1', x: 10.6, z: 45.4, inMailbox: true },
  { id: 'p2', x: 15.2, z: 33.8 },
  { id: 'p3', x: 24.6, z: 21.2 },
  { id: 'p4', x: 30.0, z: 12.5 },
  { id: 'p5', x: 50.4, z: 31.8 },
];

export const LEAVES = [
  [3.4, 44.6], [15.4, 47.0], [23.4, 37.0], [39.0, 41.2], [43.4, 46.0],    // village
  [2.6, 30.2], [17.6, 34.2], [26.2, 34.2], [42.6, 33.6], [51.6, 33.0],    // level 1
  [10.6, 24.2], [21.0, 26.2], [33.6, 21.6], [44.8, 25.0],                // level 2
  [3.8, 16.6], [25.6, 15.8], [38.0, 12.2],                               // level 3
  [6.4, 3.2], [33.6, 1.8], [36.4, 7.2],                                  // summit
];

// ---------------------------------------------------------------------------------------------
export function buildCoarse() {
  const N = COLS * ROWS;
  const level = new Int8Array(N), water = new Uint8Array(N), obst = new Uint8Array(N);
  const clear = new Uint8Array(N), plate = new Uint8Array(N), stone = new Uint8Array(N);
  const boulders = [];
  const I = (c, r) => r * COLS + c;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    let L = 4;
    if (r >= bound(3, c)) L = 3;
    if (r >= bound(2, c)) L = 2;
    if (r >= bound(1, c)) L = 1;
    if (r >= bound(0, c)) L = 0;
    level[I(c, r)] = L;
  }
  for (const [c0, r0, c1, r1, L] of LEVEL_RECTS)
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) level[I(c, r)] = L;
  for (const [cx, cy, rx, ry] of ELLIPSES)
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const dx = (c + 0.5 - cx) / rx, dy = (r + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) water[I(c, r)] = 1;
    }
  for (const [c0, r0, c1, r1] of STREAMS)
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) water[I(c, r)] = 1;
  // the pond basin and plunge pools sit at their lowest touching level
  for (const [c, r] of STONES) stone[I(c, r)] = 1;
  for (const p of PATCHES) p.rows.forEach((row, dr) => [...row].forEach((ch, dc) => {
    const c = p.c0 + dc, r = p.r0 + dr, i = I(c, r);
    if (ch === '~') return;
    clear[i] = 1;
    if (ch === '#' || ch === 'T') obst[i] = ch === '#' ? 1 : 2;
    if (ch === 'B') boulders.push({ patch: p.id, c, r });
    if (ch === '_') plate[i] = 1;
  }));
  return { level, water, obst, clear, plate, stone, boulders, I };
}

export function asciiMap(g) {
  const L = 'abcde';
  let out = '';
  for (let r = 0; r < ROWS; r++) {
    let s = '';
    for (let c = 0; c < COLS; c++) {
      const i = g.I(c, r);
      if (g.obst[i]) s += g.obst[i] === 1 ? '#' : 'T';
      else if (g.water[i]) s += g.stone[i] ? 'o' : L[g.level[i]];
      else s += g.level[i];
    }
    out += String(r).padStart(2) + ' ' + s + '\n';
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// The cave under the summit (separate little terrain at world x = CAVE_OX)
export const CAVE_OX = 300, CAVE_OZ = 0, CAVE_COLS = 16, CAVE_ROWS = 14, CAVE_STEP = 1.3;
const CAVE_ROOM = [ // sokoban room, placed at (3, 5); '1' wall '0' floor 'B' boulder '_' plate
  '1111111111',
  '1000010_01',
  '10000010_1',
  '1010000001',
  '10BB011001',
  '1000000001',
  '1111111111',
];
export function buildCave() {
  const g = [...Array(CAVE_ROWS)].map(() => [...'1'.repeat(CAVE_COLS)]);
  const carve = (c, r, ch = '0') => { g[r][c] = ch; };
  CAVE_ROOM.forEach((row, r) => [...row].forEach((ch, c) => carve(c + 3, r + 5, ch)));
  for (let c = 1; c <= 12; c++) carve(c, 1);              // upper gallery → exit
  for (let c = 1; c <= 7; c++) { carve(c, 2); carve(c, 3); }
  for (let r = 4; r <= 7; r++) carve(1, r);               // west corridor down to the gate
  carve(2, 7); carve(3, 7, 'D');                          // gate in the room's west wall
  carve(5, 11); carve(5, 12);                             // entrance from the south
  carve(13, 1, 'E');
  const rows = g.map(r => r.join(''));
  const level = (c, r) => (rows[r][c] === '1' ? 1 : 0);
  const boulders = [], plates = [];
  rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === 'B') boulders.push({ c, r }); if (ch === '_') plates.push({ c, r }); }));
  return { rows, level, boulders, plates, gate: { c: 3, r: 7 }, entry: { c: 5, r: 12 }, exit: { c: 13, r: 1 }, chest: { c: 3, r: 2 } };
}
