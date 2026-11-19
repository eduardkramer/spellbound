/* Spellbound — proof of concept
 * Isometrische pixel-kamer, volledig procedureel getekend op een canvas.
 * Coördinaten: (a, b, z)  a = naar rechtsonder, b = naar linksonder, z = omhoog.
 * Achterhoek van de kamer = (0,0,0). Zie P() voor de projectie.
 */
(function () {
'use strict';

const TILE_SIZE = 8;
const ROOM_TILES = 8;
const N = ROOM_TILES * TILE_SIZE;
const EXIT_COLUMN = 4;
const EXIT_CENTER = (EXIT_COLUMN + .5) * TILE_SIZE;
const POTION_COLUMNS = 8;
const POTION_ROWS = 7;
const POTION_DOOR_ROW = 3;
const LIBRARY_POTION_DOOR_ROW = 4;
const STOCK_COLUMNS = 12, STOCK_ROWS = 10;
const STOCK_WIDTH = STOCK_COLUMNS * TILE_SIZE, STOCK_DEPTH = STOCK_ROWS * TILE_SIZE;
const POTION_STOCK_DOOR_ROW = 1, STOCK_DOOR_ROW = 4;
const T = 20;     // muurdikte
const WH = 104;   // muurhoogte
const F = 56;     // dikte onderbouw
const W = 4 * (STOCK_WIDTH + T) + 10, CX = W / 2, CY = 162;
const H = CY + STOCK_WIDTH + STOCK_DEPTH + F + 12;

const cv = document.getElementById('scene');
const preview = cv.dataset?.preview !== undefined;
if (preview && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
cv.width = W; cv.height = H;
const ctx = cv.getContext('2d');
const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
const statC = mk(), secondC = mk(), potionC = mk(), stockC = mk();
const rooms = {
  tower: { canvas: statC, exits: [
    { tile: [EXIT_COLUMN, ROOM_TILES - 1], target: 'library', arrival: [EXIT_COLUMN, 1], direction: 'sw' }
  ] },
  library: { canvas: secondC, exits: [
    { tile: [EXIT_COLUMN, 0], target: 'tower', arrival: [EXIT_COLUMN, ROOM_TILES - 2], direction: 'ne' },
    { tile: [ROOM_TILES - 1, LIBRARY_POTION_DOOR_ROW], wallA: N, target: 'potion', arrival: [1, POTION_DOOR_ROW], direction: 'se' }
  ] },
  potion: { canvas: potionC, exits: [
    { tile: [0, POTION_DOOR_ROW], wallA: 0, target: 'library', arrival: [ROOM_TILES - 2, LIBRARY_POTION_DOOR_ROW], direction: 'nw' },
    { tile: [POTION_COLUMNS - 1, POTION_STOCK_DOOR_ROW], wallA: (POTION_COLUMNS - .5) * TILE_SIZE,
      target: 'stockroom', arrival: [1, STOCK_DOOR_ROW], direction: 'se' }
  ] },
  stockroom: { canvas: stockC, exits: [
    { tile: [0, STOCK_DOOR_ROW], wallA: 0, target: 'potion',
      arrival: [POTION_COLUMNS - 2, POTION_STOCK_DOOR_ROW], direction: 'nw' }
  ] }
};

const P = (a, b, z) => [CX + 2 * (a - b), CY + a + b - z];

/* ---------- helpers ---------- */
function hash(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const _sh = new Map();
function sh(color, factor) {
  const key = color + '|' + factor;
  if (_sh.has(key)) return _sh.get(key);
  const channels = color.startsWith('#')
    ? [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16))
    : color.slice(4, -1).split(',').map(Number);
  const result = 'rgb(' + channels.map(channel => Math.min(255, Math.floor(channel * factor))).join(',') + ')';
  _sh.set(key, result);
  return result;
}
function rect(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); }
function dot(g, x, y, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); }
function line(g, x0, y0, x1, y1, c) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    dot(g, x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function ell(g, cx, cy, rx, ry, c) {
  cx = Math.round(cx); cy = Math.round(cy);
  g.fillStyle = c;
  for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++)
    if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) g.fillRect(cx + x, cy + y, 1, 1);
}

/* muur-painters: u = pixelkolom langs de muur (2 px per eenheid) */
function wallL(g, a, u0, u1, z0, z1, fn) {      // vlak a = const (linker muur), u = 2*b
  for (let u = u0; u < u1; u++) {
    const x = CX + 2 * a - 1 - u, yb = CY + a + (u >> 1) - 1;
    for (let z = z0; z < z1; z++) {
      const c = fn(u, z);
      if (c) { g.fillStyle = c; g.fillRect(x, yb - z, 1, 1); }
    }
  }
}
function wallR(g, b, u0, u1, z0, z1, fn) {      // vlak b = const (rechter muur), u = 2*a
  for (let u = u0; u < u1; u++) {
    const x = CX - 2 * b + u, yb = CY + b + (u >> 1) - 1;
    for (let z = z0; z < z1; z++) {
      const c = fn(u, z);
      if (c) { g.fillStyle = c; g.fillRect(x, yb - z, 1, 1); }
    }
  }
}
const pxL = (g, u, z, c) => dot(g, CX - 1 - u, CY + (u >> 1) - 1 - z, c);
const pxR = (g, u, z, c) => dot(g, CX + u, CY + (u >> 1) - 1 - z, c);

function topFace(g, z, a0, a1, b0, b1, fn) {
  const xmin = Math.floor(CX + 2 * (a0 - b1)) - 1, xmax = Math.ceil(CX + 2 * (a1 - b0)) + 1;
  const ymin = Math.floor(CY + a0 + b0 - z) - 1, ymax = Math.ceil(CY + a1 + b1 - z) + 1;
  for (let y = ymin; y <= ymax; y++) for (let x = xmin; x <= xmax; x++) {
    const X = (x + .5 - CX) / 2, Y = y + .5 - CY + z;
    const a = (Y + X) / 2, b = (Y - X) / 2;
    if (a >= a0 && a < a1 && b >= b0 && b < b1) {
      const c = fn(a, b);
      if (c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); }
    }
  }
}
function box(g, a0, b0, z0, da, db, dz, c) {
  const a1 = a0 + da, b1 = b0 + db, z1 = z0 + dz;
  const xmin = Math.floor(CX + 2 * (a0 - b1)) - 1, xmax = Math.ceil(CX + 2 * (a1 - b0)) + 1;
  const ymin = Math.floor(CY + a0 + b0 - z1) - 1, ymax = Math.ceil(CY + a1 + b1 - z0) + 1;
  const get = (f, u, v) => (typeof f === 'function' ? f(u, v) : f);
  for (let y = ymin; y <= ymax; y++) for (let x = xmin; x <= xmax; x++) {
    const X = (x + .5 - CX) / 2, yy = y + .5;
    let col = null;
    const Y = yy - CY + z1;
    let a = (Y + X) / 2, b = (Y - X) / 2;
    if (a >= a0 && a < a1 && b >= b0 && b < b1) col = get(c.top, a, b);
    else {
      a = X + b1; let z = CY + a + b1 - yy;
      if (a >= a0 && a < a1 && z >= z0 && z < z1) col = get(c.left, Math.floor(a * 2), Math.floor(z));
      else {
        b = a1 - X; z = CY + a1 + b - yy;
        if (b >= b0 && b < b1 && z >= z0 && z < z1) col = get(c.right, Math.floor(b * 2), Math.floor(z));
      }
    }
    if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
  }
}
function woodC(base) {
  return {
    top: (a, b) => (hash(Math.floor(a * 2), Math.floor(b * 3)) > .82 ? sh(base, 1.28) : sh(base, 1.15)),
    left: (u, z) => (hash(u, z >> 2) > .85 ? sh(base, 1.0) : sh(base, .88)),
    right: (u, z) => (hash(u >> 1, z) > .85 ? sh(base, .72) : sh(base, .62))
  };
}
const flat = (t, l, r) => ({ top: t, left: l, right: r });

/* ---------- stenen ---------- */
function scalePal(p, f) {
  return { mortar: sh(p.mortar, f), c: p.c.map(x => sh(x, f)), hi: sh(p.hi, f), lo: sh(p.lo, f) };
}
function brickFn(p, bw = 14, bh = 6) {
  return (u, z) => {
    const row = Math.floor(z / bh), zz = z - row * bh;
    const uu = u + ((row & 1) ? bw / 2 : 0), col = Math.floor(uu / bw), ux = uu - col * bw;
    if (zz === 0 || ux === 0) return p.mortar;
    const r = hash(col, row);
    const c = p.c[r < .34 ? 0 : r < .67 ? 1 : 2];
    if (zz === bh - 1) return p.hi;
    if (zz === 1) return p.lo;
    const r2 = hash(u * 7, z * 13);
    if (r2 > .95) return p.hi;
    if (r2 < .04) return p.lo;
    return c;
  };
}
const palInL = { mortar: '#26274a', c: ['#3f437f', '#464b88', '#4d5393'], hi: '#5d63a3', lo: '#363a70' };
const palInR = { mortar: '#2b2b52', c: ['#4d4a86', '#55528f', '#5e5a98'], hi: '#6f6ba8', lo: '#403d78' };
const palChim = { mortar: '#3a3558', c: ['#6c668e', '#7a749a', '#837da3'], hi: '#9791b5', lo: '#58527a' };
const palOut = { mortar: '#2e4472', c: ['#456296', '#4f70a4', '#5a7cb0'], hi: '#7da0cd', lo: '#3a5586' };
const brL = brickFn(palInL), brR = brickFn(palInR), brC = brickFn(palChim);
const brOutL = brickFn(scalePal(palOut, .88)), brOutR = brickFn(scalePal(palOut, 1.08));
const brOut = brickFn(palOut);

const copingFn = (a, b) => {
  const ea = ((a % TILE_SIZE) + TILE_SIZE) % TILE_SIZE, eb = ((b % TILE_SIZE) + TILE_SIZE) % TILE_SIZE;
  if (ea < .5 || eb < .5) return '#5f80ac';
  return hash(Math.floor(a / 8), Math.floor(b / 8)) > .5 ? '#86a8cf' : '#7c9ec6';
};

/* ---------- vloer ---------- */
// Middelpunt en beide stralen in vloercoördinaten.
const towerShadows = [
  [21.5, 4.5, 11.5, 3.4], [29, 21.5, 4.8, 4.8], [29, 29, 12.5, 4.7],
  [49, 45.5, 5, 5], [53, 5.5, 4.8, 3.7],
  [5, 53.5, 4.1, 4.1], [5, 5.5, 3.4, 3.4],
  [8, 34.5, 3.4, 3.4]
];

function contactShade(a, b, centerA, centerB, radiusA, radiusB) {
  const distance = ((a - centerA) / radiusA) ** 2 + ((b - centerB) / radiusB) ** 2;
  return distance < .55 ? .62 : distance < 1 ? .8 : 1;
}

function shadedTowerFloor(a, b) {
  let shade = 1;
  for (const shadow of towerShadows) shade = Math.min(shade, contactShade(a, b, ...shadow));
  const color = floorFn(a, b);
  // Hetzelfde kruis als in het glas, geprojecteerd vanaf de linkerwand.
  const u = 44 + 2 * (b - 24 + a * .33);
  const z = 60 + (a - 4) * .85;
  const inGlass = u >= 24 && u < 64 && z >= 60 && z < 90;
  const frame = u >= 43 && u < 45 || z >= 74 && z < 76;
  const sunset = inGlass && !frame ? .19 * (1 - a / 44) : 0;
  return tintFloor(color, 1 - (1 - shade) * .72, sunset);
}

function floorFn(a, b) {
  if (a >= 12 && a < 30 && b >= 4 && b < 40) {                 // tapijt
    const la = a - 12, lb = b - 4;
    if (b >= 38.8) return (Math.floor(la * 1.5) & 1) ? '#e8d9a0' : '#bda86a';      // franje
    if (la < 1.2 || la > 16.8) return '#5b1221';
    if (la < 2 || la > 16) return '#d6a83c';
    if (la < 3 || la > 15) return lb % 4 < 1 ? '#c99054' : '#862333';
    if (lb < 1.2 || lb >= 33.5) return '#a97643';
    const d = Math.abs(((lb % 8) + 8) % 8 - 4) + Math.abs(la - 9);
    if (d < 3.2) return '#c43a4a';
    if (d < 4.2) return '#7d1a28';
    return hash(Math.floor(a * 2), Math.floor(b * 2)) > .9 ? '#a82838' : '#9c2030';
  }
  if (b >= N - .8 || a >= N - .8) return '#6a6aa0';  // voorrand
  const width = 4, length = 4;
  const column = Math.floor(a / width), row = Math.floor(b / width);
  const phase = (column + row) % (length * 2);
  const acrossA = phase < length;
  const offset = phase % length;
  const cross = (acrossA ? b : a) % width;
  const along = offset * width + (acrossA ? a : b) % width;
  if (cross < .38 || along < .38) return '#59402f';

  // Elke plank is vier vakjes lang. De twee richtingen grijpen trapsgewijs in elkaar.
  const startA = column - (acrossA ? offset : 0);
  const startB = row - (acrossA ? 0 : offset);
  const tone = .95 + hash(startA, startB) * .1;
  const edge = cross > width - .4 ? 1.035 : 1;
  const grain = hash(Math.floor(along / 3) + startA, Math.floor(cross * 2) + startB);
  return sh('#6c4d3a', tone * edge * (grain > .87 ? 1.09 : grain < .12 ? .94 : 1));
};

/* ---------- onderbouw met bogen ---------- */
function arch(adu, z) {
  const w = 26, zs = -40, c = 6.7, R = w + c;
  if (adu > w) return 0;
  const inside = z <= zs ? true : ((adu + c) * (adu + c) + (z - zs) * (z - zs) <= R * R);
  if (!inside) return 0;
  const w2 = w - 3, R2 = R - 3;
  const inner = adu <= w2 && (z <= zs ? true : ((adu + c) * (adu + c) + (z - zs) * (z - zs) <= R2 * R2));
  return inner ? 2 : 1;
}
function facadeFn(br, span) {
  return (u, z) => {
    if (u >= 0 && z >= 0) return null;
    if (u >= 0) {
      const r = arch(Math.abs(u - span + .5), z + .5);
      if (r === 2) return z > -22 ? '#10132b' : '#171b38';
      if (r === 1) return ((Math.floor(Math.abs(u - span) / 3) + Math.floor((z + 60) / 3)) & 1) ? '#7a9cca' : '#6684b6';
    }
    return br(u, z);
  };
}

/* ---------- hout / boekenkast / raam ---------- */
const woodEdge = (u, z) => (z >= 90 || (u === 22 && z > 6)) ? '#9a6038' : (hash(u, 3) > .8 ? '#6a3c22' : '#5c331d');
const woodMid = (u, z) => (hash(u >> 1, z) > .85 ? '#744327' : '#66391f');
const bookCols = ['#8c2f39', '#2f6e4f', '#3b4f9a', '#b08a3a', '#6a3a8a', '#c0603a', '#2a7a8a', '#7a7a8e'];
const bookRows = [];
for (let r = 0; r < 4; r++) {
  const arr = {}; let u = 24;
  while (u < 64) {
    const w = 2 + Math.floor(hash(u, r) * 3), h = 6 + Math.floor(hash(u * 3, r + 9) * 4);
    const c = bookCols[Math.floor(hash(u, r + 31) * bookCols.length)];
    for (let k = 0; k < w && u < 64; k++, u++) arr[u] = { c, h, first: k === 0 };
    if (hash(u, r + 50) > .86) u += 2;
  }
  bookRows.push(arr);
}
function bookFn(u, z) {
  const r = Math.floor((z - 8) / 12), lz = (z - 8) - r * 12;
  if (lz < 2) return '#5a3320';
  const b = bookRows[r] && bookRows[r][u];
  if (b && lz - 2 < b.h) return b.first ? sh(b.c, 1.3) : ((lz - 2) === b.h - 1 ? sh(b.c, 1.2) : b.c);
  return '#1d1830';
}
function hatFn(u, z) {
  const hu = u - 11;
  if (z >= 62 && z < 64 && Math.abs(hu) <= 8) return '#2a2160';
  if (z >= 64 && z < 87) {
    const hw = 6 - (z - 64) * .27;
    if (Math.abs(hu) <= hw) {
      if (z < 67) return '#d9a53a';
      if ((u === 10 && z === 73) || (u === 12 && z === 70)) return '#ffd45a';
      return hu > 1 ? '#6354c4' : '#4b3fa8';
    }
  }
  if (z === 87 && hu === 0) return '#222';
  return null;
}
function leftFn(u, z) {
  if (u >= 22 && u < 66 && z >= 6 && z < 92) {
    if (u < 24 || u >= 64 || z < 8 || z >= 90) return woodEdge(u, z);
    if (z >= 56 && z < 60) return woodMid(u, z);
    if (z >= 60) {
      if ((u >= 43 && u < 45) || (z >= 74 && z < 76)) return woodMid(u, z);
      return null;                                  // glas (hier komt de hemel doorheen)
    }
    if (u >= 43 && u < 45) return woodMid(u, z);
    return bookFn(u, z);
  }
  const h = hatFn(u, z); if (h) return h;
  return towerWallStone(brL, u, z);
}

/* ---------- haard / schoorsteen / portret ---------- */
const soot = (u, z) => (((u + (((z >> 3) & 1) * 4)) % 8 === 0) ? '#221829' : '#17111f');
function portraitFn(u, z) {
  if (u < 34 || u >= 50 || z < 66 || z >= 94)
    return (u === 32 || u === 51 || z === 64 || z === 95) ? '#f3cf6a' : '#b17a24';
  const pu = u - 34, pz = z - 66, cx = 7.5, d = Math.abs(pu - cx);
  if (pz >= 18 && pz < 28) {
    const hw = (27.5 - pz) * .55 + .5;
    if (d <= hw) { if (pu === 7 && pz === 22) return '#ffd45a'; return pu > cx ? '#5a4cb0' : '#4c3f9a'; }
  }
  if (pz >= 16 && pz < 18 && d <= 7) return '#3a2e7a';
  if (pz >= 8 && pz < 16 && d <= 3.6) { if (pz === 10 && d < 1) return '#b88660'; return '#d6ab84'; }
  if (pz < 10) {
    const hw = pz >= 8 ? 3.6 : 5.4 - Math.abs(pz - 5) * .6;
    if (d <= hw) return d > hw - 1.2 ? '#a9acc6' : '#d9d9ea';
  }
  return pz > 14 ? '#241a44' : '#1a1330';
}
const fireOpen = (u, z) => {
  if (u < 30 || u >= 54 || z >= 40) return false;
  const du = Math.abs(u - 42), zm = du <= 8 ? 40 : 40 - (du - 8) * 2.5;
  return z < zm;
};
function rightFn(u, z) {
  if (fireOpen(u, z)) return soot(u, z);
  if (u >= 22 && u < 62 && z < 54) {
    if (u < 24 || u >= 60 || z >= 52) return '#9a94b8';
    return brC(u, z);
  }
  if (u >= 26 && u < 58 && z >= 54) {
    if (u >= 32 && u < 52 && z >= 64 && z < 96) return portraitFn(u, z);
    if (u < 28 || u >= 56) return '#8c86ac';
    return brC(u, z);
  }
  return towerWallStone(brR, u, z);
}

function towerWallStone(brick, u, z) {
  const color = brick(u, z);
  if (z < 5) return sh(color, .8 + z * .035);
  const texture = hash(Math.floor(u / 2), z);
  return texture > .91 ? sh(color, 1.12) : texture < .08 ? sh(color, .89) : color;
}

function passageColor(dx, z) {
  const curve = Math.hypot(dx, Math.max(0, z - 31));
  if (curve > 17) return null;
  if (curve > 12) {
    const joint = z < 31 ? z % 7 === 0 : Math.floor(Math.atan2(z - 31, dx) * 12) % 5 === 0;
    return joint ? '#3b3d63' : curve > 15 ? '#8997ba' : '#626c96';
  }
  if (curve > 11) return '#242849';
  if (z < 3) return '#d6af67';
  if (z < 9) return '#4d4261';
  return '#171933';
}

function drawPassage(g, rear) {
  const center = EXIT_CENTER * 2;
  box(g, EXIT_CENTER - 7, rear ? 0 : N - 7, 0, 14, 7, 1, flat('#62678f', '#3d4166', '#464b70'));
  wallR(g, rear ? 0 : N, center - 17, center + 18, 0, 49, (u, z) => passageColor(u - center, z));
}

function drawSidePassage(g, { wallA, tile }, foreground) {
  const center = (tile[1] + .5) * TILE_SIZE;
  if (!foreground) {
    box(g, wallA === 0 ? 0 : wallA - 7, center - 7, 0, 7, 14, 1, flat('#62678f', '#3d4166', '#464b70'));
    if (wallA !== 0) return;
  }
  wallL(g, wallA, 2 * center - 17, 2 * center + 18, 0, 49, (u, z) => passageColor(2 * center - u, z));
}

/* ---------- bibliotheek ---------- */
// Een bank kan meerdere zitplekken in hetzelfde meubel registreren.
const armchairSeat = { tile: [3, 2], approach: [4, 2], direction: 'sw', offsetB: 1, height: 7, hit: [13, 25] };
const readingSeat = { tile: [1, 5], approach: [2, 5], direction: 'ne', offsetB: 0, height: 7, hit: [14, 24] };
const librarySeats = [
  readingSeat,
  { tile: [2, 4], approach: [1, 4], direction: 'ne', height: 7, hit: [9, 16] },
  { tile: [5, 4], approach: [6, 4], direction: 'ne', height: 7, hit: [9, 16] },
  { tile: [4, 7], approach: [3, 7], direction: 'ne', height: 7, hit: [9, 16] }
];

const libraryLayout = [
  [2, 3, 'desk'], [2, 4, 'chair'], [5, 3, 'desk'], [5, 4, 'chair'],
  [4, 6, 'desk'], [4, 7, 'chair'], [1, 6, 'plant'], [7, 1, 'plant'],
  [1, 5, 'reading chair'], [0, 4, 'tea table']
];
const leftShelfRanges = [[4, 64], [115, 126]];
const rightShelfRanges = [[8, 48], [98, 126]];

function shadedLibraryFloor(a, b) {
  const color = libraryFloor(a, b);
  let shade = 1;
  if ((a < 8 && leftShelfRanges.some(([start, end]) => b * 2 >= start && b * 2 < end)) ||
      (b < 8 && rightShelfRanges.some(([start, end]) => a * 2 >= start && a * 2 < end))) {
    shade = Math.min(shade, Math.min(a, b) < 5 ? .65 : .85);
  }
  for (const [column, row, type] of libraryLayout) {
    const radius = type === 'desk' ? 5 : 3.4;
    const centerA = (column + .5) * TILE_SIZE + 1;
    const centerB = (row + .5) * TILE_SIZE + 1.5;
    shade = Math.min(shade, contactShade(a, b, centerA, centerB, radius, radius));
  }
  const lamplight = Math.max(0, 1 - Math.hypot((a - 39) / 20, (b - 22) / 17),
    1 - Math.hypot((a - 13) / 17, (b - 44) / 16));
  const adjusted = shade * (1 + lamplight * .32);
  if (!lamplight) return sh(color, adjusted);
  const channels = color.startsWith('#')
    ? [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16))
    : color.slice(4, -1).split(',').map(Number);
  const amber = [255, 190, 106];
  const amount = lamplight * .24;
  return 'rgb(' + channels.map((channel, index) =>
    Math.min(255, Math.round((channel * (1 - amount) + amber[index] * amount) * adjusted))).join(',') + ')';
}

function libraryFloor(a, b) {
  if (a >= 9 && a < 58 && b >= 15 && b < 58) {
    const edge = Math.min(a - 9, 58 - a, b - 15, 58 - b);
    if (edge < .8 || (edge > 1.8 && edge < 2.7)) return '#bea875';
    if (edge < 4) return '#485b48';
    const pattern = Math.abs(a - 33.5) + Math.abs(b - 36.5);
    const weave = hash(Math.floor(a * 2), Math.floor(b * 2));
    if (Math.abs(pattern - 13) < .85 || Math.abs(pattern - 16) < .55) return '#91a17a';
    return weave > .86 ? '#68795d' : '#52674d';
  }
  const row = Math.floor(b / 8);
  const offsetA = a + (row % 2) * 5;
  const seam = Math.min(offsetA % 10, b % 8);
  const stone = hash(Math.floor(offsetA / 10), row);
  if (seam < .55) return '#33383f';
  if (seam < 1.15) return '#777f7d';
  const speck = hash(Math.floor(a * 2), Math.floor(b * 2));
  return sh('#5e656a', .83 + stone * .24 + (speck > .92 ? .09 : 0));
}

function libraryShelf(start, end, ladderAt) {
  const width = end - start;
  const dividers = width >= 56 ? [Math.floor(width / 2)] : [];
  const isFrame = column => column < 3 || column >= width - 3 ||
    dividers.some(divider => Math.abs(column - divider) <= 1);
  const shelves = Array.from({ length: 6 }, (_, row) => {
    const books = [];
    for (let column = 3; column < width - 3;) {
      if (isFrame(column)) { column++; continue; }
      const seed = hash(start + column, row);
      const size = 2 + Math.floor(seed * 4);
      const height = 6 + Math.floor(hash(start + column, row + 13) * 6);
      const color = bookCols[Math.floor(seed * bookCols.length)];
      for (let spine = 0; spine < size && !isFrame(column); spine++, column++) {
        books[column] = { color, height, spine, gilt: seed > .54 };
      }
      if (seed > .35) column++;
    }
    return books;
  });
  return (u, z) => {
    const column = u - start;
    if (isFrame(column) || z >= 86 || z < 4) return (z === 86 || column === 1) ? '#865a40' : '#603e31';
    const row = Math.floor((z - 4) / 14), height = (z - 4) % 14;
    const ladder = ladderAt === null ? -1 : u - ladderAt - Math.floor(z / 7);
    if (z < 74 && ladder >= 0 && ladder <= 10) {
      if (ladder <= 1 || ladder >= 9) return '#966643';
      if (z % 9 < 2) return '#825536';
    }
    if (height < 2) return height === 1 ? '#80553d' : '#4c3128';
    const book = shelves[row]?.[column];
    const page = height - 2;
    if (!book || page >= book.height) return '#292025';
    if (page === book.height - 1) return '#ad9671';
    if (book.gilt && book.spine > 0 && (page === 1 || page === book.height - 3)) return '#b19a67';
    return sh(book.color, book.spine === 0 ? 1.02 : .75);
  };
}

const sunsetSky = ['#ffce8f', '#f7a279', '#db7b83', '#ae6683', '#795778', '#584763'];

function autumnSunset(x, y, showSun = true) {
  const ridge = .24 + Math.sin(x * .085) * .045 + Math.cos(x * .16) * .028;
  const canopy = .14 + Math.sin(x * .24) * .045 + Math.cos(x * .68) * .026;
  const leaf = hash(Math.floor(x / 2), Math.floor(y * 23));
  if (y < canopy) {
    if (y > canopy - .047) return leaf > .5 ? '#d49555' : '#b7754c';
    return leaf > .7 ? '#a8674d' : '#774853';
  }
  if (y < ridge) return '#765773';
  if (showSun && Math.hypot(x - 48, (y - .43) * 49) < 5) return '#ffe8a9';
  if (y > .51 && y < .56 && Math.sin(x * .15) > .35) return '#ffc191';
  return sunsetSky[Math.max(0, Math.min(5, Math.floor((y - .23) * 7.7)))];
}

function drawReadingWindow(g) {
  wallL(g, 0, 66, 108, 28, 88, (u, z) => {
    const x = u - 87, y = z - 28;
    const arch = Math.hypot(x, Math.max(0, y - 37));
    if (arch > 20) return null;
    if (arch > 17 || y < 3) return arch > 19 ? '#394047' : '#947358';
    if (Math.abs(x) < 1 || y === 27 || y === 28) return '#6b5144';
    return autumnSunset(u - 51, y / 53);
  });
}

function drawLibraryShelves(g) {
  const depth = 3, height = 87;
  const timber = woodC('#926348');
  for (const [start, end] of leftShelfRanges) {
    const narrow = end - start < 24;
    const shelfDepth = narrow ? 2 : depth;
    box(g, 0, start / 2, 0, shelfDepth, (end - start) / 2, height, timber);
    const shelf = libraryShelf(start, end, narrow ? null : 37);
    wallL(g, shelfDepth, start, end, 0, height, (u, z) => {
      if (narrow && (z < 7 || z >= 83)) {
        if (z === 6 || z === 85) return '#ba895d';
        return z % 4 === 0 ? '#51362b' : '#785037';
      }
      return shelf(u, z);
    });
    if (narrow) {
      box(g, 0, start / 2 - .5, height, shelfDepth + .5, (end - start) / 2 + 1, 1.5, timber);
    }
  }
  for (const [start, end] of rightShelfRanges) {
    box(g, start / 2, 0, 0, (end - start) / 2, depth, height, timber);
    wallR(g, depth, start, end, 0, height, libraryShelf(start, end, null));
  }
}

const potionBookcases = [[3, 31], [87, 109]];
const cauldronA = 6 * TILE_SIZE, cauldronB = 4 * TILE_SIZE;
const workbenchA = 3.5 * TILE_SIZE, workbenchB = 5.5 * TILE_SIZE;
const [potionLampX, potionLampY] = P(32, 1, 78);
const rackStart = 2 * TILE_SIZE + 4;
const rackEnd = 6 * TILE_SIZE;
const rackWidth = rackEnd - rackStart;
const rackDepth = 5;
const rackHeight = 40;
const rackBubbles = [];
const rackGlass = mk();
const rackBottleShapes = [
  ['..ccc..', '..gsg..', '..g.g..', '.gh..g.', 'gh...dg', 'gldlldg', 'gdllbdg', '.ddddd.', '..ggg..'],
  ['.ccccc.', '.gsssg.', 'g.....g', 'gh....g', 'ghllldg', 'glkdldg', 'gdkbkdg', 'gdddddg', '.ggggg.'],
  ['ccc', 'gsg', 'g.g', 'ghg', 'g.g', 'glg', 'gbg', 'glg', 'gdg', '.g.'],
  ['..ccc..', '..gsg..', '...g...', '..g.g..', '.gh..g.', 'gllkldg', '.gkbdg.', '..gdg..', '...g...']
];

function drawRackBottle(g, a, z, shape, color) {
  const [x, y] = P(a, rackDepth - .5, z);
  const rows = rackBottleShapes[shape];
  const colors = {
    c: '#b0875e', s: sh(color, 1.18), g: '#879ea8', h: '#f4eadd',
    l: color, d: sh(color, .58), b: sh(color, 1.28),
    k: color === '#78a655' ? '#cadc83' : sh(color, 1.53)
  };
  const left = Math.round(x) - (rows[0].length >> 1);
  const top = Math.round(y) - rows.length + 1;
  ell(g, x, y, (rows[0].length >> 1) + 1, 1, '#4b3631');
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      if (row[dx] === '.') continue;
      const pixel = row[dx];
      const pigment = pixel === 'c' && dx === (row.length >> 1) ? '#d7af7e' : colors[pixel];
      dot(g, left + dx, top + dy, pigment);
    }
  });
  const surface = rows.findIndex(row => row.includes('l'));
  rackBubbles.push([left + rows[surface].indexOf('l'), top + surface, sh(color, 1.62)]);
}

function drawPotionRack(g) {
  const trim = {
    top: (a, b) => {
      if (b >= rackDepth) return '#c19669';
      if (b >= 2.5 && b < 3) return '#795236';
      return hash(Math.floor(a / 5), Math.floor(b * 2)) > .72 ? '#b0885c' : '#9c714b';
    },
    left: (u, z) => {
      if (z === 2 || z === 14 || z === 26 || z === rackHeight - 1) {
        return hash(u, z) > .86 ? '#a7774e' : '#be9061';
      }
      return '#69452f';
    },
    right: '#573b30'
  };
  const post = flat('#a87b53', (u, z) => {
    const edge = u >= (rackEnd - 2) * 2 ? u - (rackEnd - 2) * 2 : u - rackStart * 2;
    if (z < 2) return '#63432f';
    if (edge === 0) return '#69452f';
    if (edge === 3) return '#4b3228';
    if (edge === 1) return '#a67b56';
    return hash(u, z >> 2) > .78 ? '#96704d' : '#825936';
  }, (u, z) => {
    if (u === 0 || u === rackDepth * 2 - 1 || z < 3 || z >= rackHeight - 4) return '#765238';
    if (u === 1 || z === rackHeight - 5) return '#49342c';
    return hash(u, z >> 2) > .83 ? '#634735' : '#56402f';
  });
  const inner = flat('#49352f', '#332731', '#392a2c');
  box(g, rackStart, 0, 0, rackWidth, 1.5, rackHeight, inner);
  // De sokkel ligt onder de voorstijlen en loopt door tot tegen de muur.
  box(g, rackStart, 0, 0, rackWidth, rackDepth, 2, flat('#a97c53', '#63432f', '#50372c'));

  // Op de middelste plank blijft ruimte voor het flesje op de werkbank.
  const stock = [
    [[6.5, 1, 3], [8, 2, 0], [12, 0, 2], [16, 3, 1], [21, 1, 2], [24.5, 2, 4]],
    [[6.5, 0, 1], [8, 2, 3], [11.5, 1, 4], [14, 2, 2], [24, 0, 3]],
    [[6.5, 3, 2], [8.5, 0, 3], [12, 2, 1], [15.5, 1, 0], [20, 0, 4], [25, 3, 1]]
  ];
  const palette = ['#ba6183', '#569aac', '#78a655', '#9e72b3', '#cd9351'];
  stock.forEach((row, index) => {
    const z = 3 + index * 12;
    box(g, rackStart, 0, z - 2, rackWidth, rackDepth, 2, trim);
    for (const [offset, shape, color] of row) {
      drawRackBottle(g, rackStart + offset, z, shape, palette[color]);
    }
  });

  // De linker stijl is slanker zodat de flessen dichter bij het hout staan.
  for (const [a, stileWidth] of [[rackStart, 1], [rackEnd - 2, 2]]) {
    box(g, a, 0, 0, stileWidth, rackDepth, rackHeight - 2, post);
    for (const z of [4, 16, 28, 36]) {
      const [x, y] = P(a + stileWidth / 2, rackDepth, z);
      dot(g, x, y, '#503a2c');
      dot(g, x, y - 1, '#bf9b69');
    }
  }
  box(g, rackStart - .5, 0, rackHeight - 2, rackWidth + 1, rackDepth + .5, 2, trim);
}

function drawRackDoors(g) {
  const left = (rackStart + 1) * 2;
  const right = (rackEnd - 2) * 2;
  const middle = Math.floor((left + right) / 2);
  const top = rackHeight - 2;
  wallR(g, rackDepth, left, right, 2, top, (u, z) => {
    if (z === 2 || z === top - 1) return '#bd9567';
    if (u === left || u === right - 1 || u === middle || u === middle - 1) {
      return u === middle - 1 ? '#bc9468' : '#765139';
    }
    if ((u === middle - 2 || u === middle + 1) && z >= 18 && z <= 20) {
      return z === 20 ? '#ecd29a' : '#a47a4a';
    }
    const offset = u < middle ? u - left : u - middle;
    if (offset > 2 && offset < 14 && z === 23 + (offset >> 1)) {
      return 'rgba(205,236,230,.30)';
    }
    if (offset >= 4 && offset < 10 && z === 20 + (offset >> 1)) {
      return 'rgba(205,236,230,.17)';
    }
    return 'rgba(131,194,181,.08)';
  });
}
drawRackDoors(rackGlass.getContext('2d'));

function drawRackBubbles(t) {
  rackBubbles.forEach(([x, y, color], index) => {
    const phase = (t * .85 + index * .381) % 1;
    if (phase < .34) dot(ctx, x, y, color);
  });
}

const workshopStone = brickFn({
  mortar: '#232934', c: ['#414b59', '#4d5963', '#586470'],
  hi: '#697783', lo: '#343d49'
}, 22, 10);

function drawWallIvy(g, vines) {
  // Getekend vóór de meubels, zodat de ranken tegen het metselwerk blijven.
  for (const [a, b, length] of vines) {
    let previous = P(a, b, 103);
    for (let drop = 3; drop <= length; drop += 3) {
      const sway = Math.sin(drop * .25 + a + b) * 3;
      const [x, y] = P(a ? a + sway : a, b ? b + sway : b, 103 - drop);
      line(g, ...previous, x, y, '#394936');
      previous = [x, y];
      const side = drop % 2 ? -1 : 1;
      const size = drop < length * .65 ? 3 : 2;
      const color = hash(a + b, drop) > .45 ? '#789c60' : '#56794e';
      ell(g, x + side * 3, y + 2, size + 1, 2, '#2e4b3d');
      ell(g, x + side * 3, y + 1, size, 2, color);
      dot(g, x + side * 4, y, '#a5bd74');
    }
  }
}

const potionWindowCenters = [39, 88];
const potionWindowBase = 48;
const potionGlassRadius = 18;

function potionWindowArch(x, y) {
  return Math.hypot(x, Math.max(0, y - 31));
}

function potionWindowCross(x, y) {
  return x >= -1 && x < 1 || y >= 27 && y < 29;
}

function potionWindowLight(a, b) {
  // Licht door de bovenste ruit valt verder de kamer in.
  const y = (b - 5) * 1.3;
  if (y < 3 || y >= 49) return 0;
  const u = 2 * (a - (b - 18) * .36);
  for (const center of potionWindowCenters) {
    const x = u - center;
    const arch = potionWindowArch(x, y);
    if (arch > potionGlassRadius || potionWindowCross(x, y)) continue;
    return (1 - b / 65) * (arch > potionGlassRadius - 1 ? .55 : 1);
  }
  return 0;
}

function drawPotionDryingRack(g, timber) {
  const railZ = 94;
  box(g, 0, 17, railZ - 2, 2, 25, 2, timber);
  for (const b of [17.75, 29, 41.25]) {
    const [x, y] = P(2, b, railZ - 1);
    dot(g, x, y, '#49342c');
    dot(g, x, y - 1, '#d9ad77');
  }

  const bundles = [
    [19.5, 'herb', '#819354'],
    [23, 'flower', '#a87b9c'],
    [35.5, 'mushroom', '#b76d4a'],
    [39.5, 'mushroom', '#94705d']
  ];
  for (const [b, kind, color] of bundles) {
    const [x, y] = P(2, b, railZ - 1);
    line(g, x, y, x, y + 6, '#c29a69');
    if (kind === 'mushroom') {
      line(g, x, y + 6, x - 2, y + 14, '#cbb090');
      line(g, x, y + 6, x + 2, y + 16, '#d6bc99');
      ell(g, x - 2, y + 14, 2, 1, color);
      ell(g, x + 2, y + 16, 3, 2, color);
      dot(g, x + 1, y + 15, '#dab184');
    } else {
      for (const [dx, dy] of [[-3, 9], [2, 11], [-2, 14], [1, 16]]) {
        line(g, x, y + 6, x + dx, y + dy, '#48513b');
        ell(g, x + dx, y + dy, 2, 1, color);
        dot(g, x + dx - 1, y + dy, sh(color, 1.28));
      }
    }
    // Een kort touwtje met een beschreven perkamentlabel.
    dot(g, x + 2, y + 4, '#dbb987');
    rect(g, x + 2, y + 5, 4, 4, '#be925f');
    rect(g, x + 2, y + 5, 3, 3, '#e2bf83');
    dot(g, x + 3, y + 6, '#765340');
    dot(g, x + 4, y + 7, '#96744e');
  }
}

function drawPotionWorkshop(g) {
  const timber = {
    top: (a, b) => {
      const board = Math.floor(b * 2);
      if (b * 2 - board < .22) return '#745139';
      return sh('#ad8054', .9 + hash(Math.floor(a / 4), board) * .24);
    },
    left: (u, z) => sh('#805337', .82 + hash(u, Math.floor(z / 7)) * .26),
    right: (u, z) => sh('#63402f', .82 + hash(u, Math.floor(z / 7)) * .22)
  };
  drawWallIvy(g, [[0, 48, 38], [0, 5, 27], [58, 0, 43], [31, 0, 20]]);
  for (const [start, end] of potionBookcases) {
    box(g, 0, start / 2, 0, 4, (end - start) / 2, 87, timber);
    wallL(g, 4, start, end, 0, 87, libraryShelf(start, end, null));
  }

  for (const center of potionWindowCenters) {
    wallR(g, 0, center - 21, center + 22, potionWindowBase, potionWindowBase + 53, (u, z) => {
      const x = u - center, y = z - potionWindowBase;
      const arch = potionWindowArch(x, y);
      if (arch > 21) return null;
      if (arch > potionGlassRadius || y < 3) return arch > 20 || y === 0 ? '#593c34' : '#b68057';
      if (potionWindowCross(x, y)) return '#77513e';
      return autumnSunset(u - 21, y / 49, false);
    });
    box(g, (center - 22) / 2, 0, 47, 22, 2, 2, timber);
  }

  // Het recept hangt onder het droogrek, boven de doorgang.
  wallL(g, 0, 48, 66, 59, 82, (u, z) => {
    const x = u - 48, y = z - 59;
    if (y > 20 || y < 2) return '#78523e';
    if (y === 18 && x >= 6 && x <= 11) return '#a06a43';
    if (y > 4 && y < 15 && x > 3 && x < 14 && (y % 4 === 0 || x === 8)) return '#a27754';
    return '#dfbb80';
  });
  drawPotionDryingRack(g, timber);
  drawPotionRack(g);

}

function drawPotionLight(t) {
  const x = potionLampX, y = potionLampY;
  glow(x, y, 34, 31, '255,181,85', .047 + Math.sin(t * 4) * .009);
  line(ctx, x, y - 13, x, y - 6, '#a7774a');
  ell(ctx, x, y, 5, 7, '#5b3a35');
  ell(ctx, x, y + 1, 4, 5, '#d58c46');
  ell(ctx, x, y + 1, 2, 3, Math.sin(t * 7) > 0 ? '#ffe9a6' : '#ffd080');
  rect(ctx, x - 3, y + 5, 7, 2, '#815237');
}

function drawPotionWorkbench(g) {
  const a = workbenchA, b = workbenchB;
  const wood = woodC('#815334'), trim = woodC('#b78252');
  for (const da of [-3, 2]) for (const db of [-3, 2]) {
    box(g, a + da, b + db, 0, 1, 1, 12, wood);
  }
  box(g, a - 3.8, b - 3.8, 11, 7.6, 7.6, 2, trim);
  const paper = flat('#edcf94', '#ae8053', '#b88c62');
  box(g, a - 2.7, b - 1, 13, 4, 3, 1, paper);
  for (let row = 0; row < 3; row++) {
    line(g, ...P(a - 2, b - .4 + row * .7, 14), ...P(a + (row === 2 ? -.6 : .6), b - .4 + row * .7, 14), '#a47b58');
  }
  const [stainX, stainY] = P(a + .4, b + 1.25, 14);
  ell(g, stainX, stainY, 2, 1, '#b88e5c');
  const [fx, fy] = P(a - 2.7, b + 2.8, 13);
  // De open fles vangt het brouwsel uit een koperen trechter.
  ell(g, fx, fy - 2, 3, 2, '#82aaa5');
  rect(g, fx - 2, fy - 2, 5, 2, '#668b55');
  dot(g, fx - 2, fy - 3, '#edf1ca');
  rect(g, fx, fy - 6, 2, 3, '#9eaaa0');
  rect(g, fx, fy - 7, 2, 2, '#976047');
  rect(g, fx - 1, fy - 8, 4, 1, '#be8151');
  rect(g, fx - 2, fy - 9, 6, 1, '#dfa26a');
  rect(g, fx - 1, fy - 9, 4, 1, '#624338');
  const [mx, my] = P(a + 2, b - 2, 13);
  ell(g, mx, my - 1, 4, 3, '#514b5d');
  ell(g, mx, my - 3, 4, 2, '#8c8799');
  ell(g, mx, my - 3, 2, 1, '#3b3846');
  for (const [dx, dy, color] of [[-3, 0, '#687746'], [-2, 1, '#a2a95d'],
    [0, 1, '#78864a'], [1, 2, '#b39c61'], [3, 1, '#84954d']]) {
    dot(g, mx + dx, my + dy, color);
  }
  line(g, mx, my - 3, mx + 3, my - 8, '#c7b3a4');
}

// Opeenvolgende silhouetten van een laag, breed vuur tussen de ketelpoten.
const cauldronFlameFrames = [
  [1, 3, 5, 4, 2, 3, 7, 10, 8, 5, 3, 3, 6, 8, 7, 4, 3, 2, 1],
  [1, 2, 4, 7, 4, 3, 5, 8, 11, 7, 5, 3, 4, 7, 9, 6, 3, 2, 1],
  [1, 3, 5, 8, 5, 3, 4, 6, 9, 10, 6, 4, 3, 5, 8, 8, 5, 3, 1],
  [1, 2, 4, 6, 8, 4, 3, 5, 8, 10, 8, 4, 3, 5, 7, 9, 6, 2, 1],
  [1, 3, 6, 5, 7, 5, 3, 7, 9, 8, 6, 4, 4, 7, 9, 6, 4, 3, 1],
  [1, 4, 6, 5, 3, 4, 6, 9, 8, 6, 4, 3, 5, 9, 7, 5, 4, 2, 1]
];

function drawCauldronFire(x, y, t, intensity) {
  if (intensity <= 0) return;
  ell(ctx, x, y + 1, 11, 3, '#502636');
  ell(ctx, x, y, 9, 2, '#8e342c');
  const frame = cauldronFlameFrames[Math.floor(t * 12) % cauldronFlameFrames.length];
  for (const [i, tip] of frame.entries()) {
    const height = Math.round(tip * intensity);
    if (!height) continue;
    const dx = i - 9;
    const baseY = y - (Math.abs(dx) > 6 ? 1 : 0);
    rect(ctx, x + dx, baseY - height + 1, 1, height, '#b73b2e');
    const orange = Math.floor(height * .8);
    if (orange) rect(ctx, x + dx, baseY - orange + 1, 1, orange, '#f47b31');
    const core = Math.floor(height * (i % 3 === 0 ? .54 : .4));
    if (core) rect(ctx, x + dx, baseY - core + 1, 1, core, '#ffbc45');
    if (core >= 3) rect(ctx, x + dx, baseY - 1, 1, 2, '#ffea89');
  }
  for (let i = 0; i < 4; i++) {
    const age = (t * (1.1 + i * .13) + i * .31) % 1;
    if (intensity < .45 || age >= .82) continue;
    dot(ctx, x + (i - 1.5) * 5 + Math.sin(age * 5 + i) * 2,
      y - 3 - age * 11 * intensity, age < .38 ? '#ffd06a' : '#b85037');
  }
}

function drawCauldron(t, dt) {
  const [x, y] = P(cauldronA, cauldronB, 0);
  const lit = questStage === 'ready' || questStage === 'complete';
  if (lit) cauldronWarmup = Math.min(1, cauldronWarmup + dt / 2.5);
  ell(ctx, x, y, 19, 6, '#282339');
  ell(ctx, x, y - 1, 10, 3, '#3e302f');
  line(ctx, x - 7, y + 1, x + 6, y - 1, '#76573f');
  line(ctx, x - 5, y - 2, x + 7, y + 1, '#5a4033');
  for (const offset of [-11, 11]) {
    rect(ctx, x + offset - 2, y - 7, 5, 8, '#242733');
    rect(ctx, x + offset - 1, y - 5, 2, 4, '#545561');
  }
  ell(ctx, x, y - 15, 17, 15, '#252632');
  ell(ctx, x - 2, y - 15, 14, 13, '#3b3e4b');
  ell(ctx, x - 9, y - 16, 4, 8, '#4d5662');
  ell(ctx, x - 11, y - 17, 2, 6, '#646a70');
  for (const dx of [-10, -5, 0, 5, 10]) {
    dot(ctx, x + dx, y - 21 + Math.round((1 - Math.abs(dx) / 10) * 2), '#999485');
  }
  ell(ctx, x, y - 11, 12, 7, '#303440');
  drawCauldronFire(x, y + 1, t, Math.min(1, cauldronWarmup * 2.2));
  for (const side of [-1, 1]) {
    ell(ctx, x + side * 17, y - 21, 4, 4, '#787281');
    ell(ctx, x + side * 17, y - 21, 2, 2, '#292632');
  }
  // Open kruidenzak naast de ketel, binnen de schaduw van het brouwstation.
  ell(ctx, x - 21, y - 1, 6, 2, '#322838');
  ell(ctx, x - 21, y - 5, 5, 5, '#886343');
  ell(ctx, x - 22, y - 5, 3, 4, '#ab8157');
  ell(ctx, x - 21, y - 9, 4, 2, '#c19b70');
  ell(ctx, x - 21, y - 9, 2, 1, '#5c6641');
  dot(ctx, x - 22, y - 10, '#9dae64');
  dot(ctx, x - 19, y - 8, '#889b54');

  ell(ctx, x, y - 26, 19, 8, '#242431');
  ell(ctx, x, y - 27, 18, 7, '#73757b');
  const warmth = cauldronWarmup * cauldronWarmup * (3 - 2 * cauldronWarmup);
  const liquidColor = (cold, hot) => `rgb(${cold.map((channel, i) =>
    Math.round(channel + (hot[i] - channel) * warmth)).join(',')})`;
  ell(ctx, x, y - 27, 16, 5, liquidColor([61, 102, 70], [79, 158, 66]));
  ell(ctx, x - 2, y - 27, 12, 4, liquidColor([84, 124, 81], [118, 201, 81]));
  ctx.save();
  for (let i = 0; warmth > i / 8 && i < 7; i++) {
    ctx.globalAlpha = Math.min(1, (warmth - i / 8) * 4);
    const age = (t * (.55 + hash(i, 17) * .27) + hash(i, 8)) % 1;
    const bx = x + (hash(i, 13) - .5) * 22;
    const by = y - 27 + (hash(i, 15) - .5) * 6;
    const radius = age < .45 ? 1 : 2;
    if (age < .8) {
      ell(ctx, bx, by, radius, 1, '#abe86e');
      dot(ctx, bx - 1, by - 1, '#e1ff9c');
    } else {
      dot(ctx, bx + 1, by - 3 - 10 * (age - .8), '#d2f989');
    }
  }
  ctx.restore();

  // Een deels ondergedompelde houten lepel met een verdikte grip.
  ell(ctx, x + 5, y - 28, 4, 2, '#573b30');
  ell(ctx, x + 5, y - 29, 3, 2, '#94633f');
  line(ctx, x + 3, y - 29, x + 6, y - 30, '#c39563');
  line(ctx, x + 6, y - 30, x + 18, y - 40, '#593b30');
  line(ctx, x + 6, y - 31, x + 18, y - 41, '#bd8959');
  line(ctx, x + 15, y - 39, x + 19, y - 42, '#dba873');
  dot(ctx, x + 18, y - 42, '#ecc295');
  dot(ctx, x + 18, y - 40, '#976441');
  ctx.save();
  for (let i = 0; i < 4 && warmth > 0; i++) {
    const age = (t * .39 + i / 4) % 1;
    ctx.globalAlpha = Math.sin(age * Math.PI) * .29 * warmth;
    const steamX = x + (i - 1.5) * 6 + Math.sin(age * 5 + i) * 3 + age * 5;
    const steamY = y - 31 - 25 * age;
    ell(ctx, steamX, steamY, 2 + Math.floor(age * 4), 2, '#bfe88e');
    ell(ctx, steamX - 2, steamY + 1, 2, 1, '#e9edbc');
  }
  ctx.restore();
}

function potionFloor(a, b) {
  const row = Math.floor(b / 8);
  const stagger = row % 2 ? 4 : 0;
  const column = Math.floor((a + stagger) / 10);
  const variation = hash(column, row);
  const grain = hash(Math.floor(a * 2), Math.floor(b * 2));
  const edge = Math.min(a - 11, 39 - a, b - 15, 35 - b);
  const contact = Math.min(
    contactShade(a, b, cauldronA, cauldronB, 9, 7),
    contactShade(a, b, workbenchA, workbenchB, 5, 5),
    b < rackDepth + 2 && a >= rackStart && a < rackEnd ? .74 : 1
  );
  const daylight = potionWindowLight(a, b);

  let color;
  if (edge >= 0) {
    const diamond = Math.abs(a - 25) + Math.abs(b - 25);
    if (edge < 1) color = '#442d47';
    else if (edge < 2 || (diamond >= 5 && diamond < 6)) color = '#b78a63';
    else color = grain > .8 ? '#775369' : '#69475e';
  } else {
    const seam = Math.min((a + stagger) % 10, b % 8);
    if (seam < .55) color = '#343843';
    else if (seam < 1.15) color = '#7c8081';
    else color = sh('#606674', .78 + variation * .35 + (grain > .91 ? .13 : 0));
  }
  return tintFloor(color, contact, daylight * .84);
}

function tintFloor(color, contact, amount) {
  if (!amount) return contact === 1 ? color : sh(color, contact);
  const rgb = color.startsWith('#')
    ? [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16))
    : color.slice(4, -1).split(',').map(Number);
  const light = [241, 207, 158];
  return 'rgb(' + rgb.map((channel, index) =>
    Math.round((channel * (1 - amount) + light[index] * amount) * contact)).join(',') + ')';
}

function stockroomFloor(a, b) {
  const column = Math.floor(a / 8), row = Math.floor(b / 8);
  if (a % 8 < .55 || b % 8 < .55) return '#34343e';
  const beam = Math.max(0, 1 - Math.abs(a - 35) / 24) * Math.max(0, 1 - Math.abs(b - 23) / 27);
  return sh('#66636a', .84 + hash(column, row) * .25 + beam * .3);
}

const stockShelfRanges = [[6, 29], [34, 58], [64, 89]];
const stockLayout = [
  [2, 1, false], [7, 1, true], [10, 2, false], [10, 3, true],
  [4, 5, false], [5, 5, true], [8, 6, true], [9, 6, false],
  [2, 8, false], [3, 8, true], [10, 8, false]
];

function drawStockShelves(g) {
  const timber = woodC('#83583c');
  for (const [start, end] of stockShelfRanges) {
    box(g, start, 0, 0, end - start, 5, 57, timber);
    wallR(g, 5, start * 2, end * 2, 2, 56, (u, z) => {
      const column = u - start * 2;
      const shelf = (z - 2) % 14;
      if (column < 3 || u >= end * 2 - 3 || shelf < 2) return shelf === 1 ? '#ac7b52' : '#745039';
      const item = column % 9;
      if (item >= 1 && item <= 6 && shelf < 10) {
        if (shelf === 9) return '#b68e61';
        if (item === 1) return '#a38b73';
        return ['#817452', '#82647d', '#527c72'][Math.floor(column / 9 + z / 14) % 3];
      }
      return '#352b35';
    });
    box(g, start - .5, 0, 56, end - start + 1, 5.5, 2, timber);
  }
}

function drawStockContainer(g, a, b, sack) {
  const [x, y] = P(a, b, 0);
  ell(g, x, y, 8, 3, '#38313c');
  if (sack) {
    ell(g, x, y - 4, 6, 6, '#8f6c4f');
    ell(g, x - 1, y - 5, 4, 5, '#b28e65');
    ell(g, x, y - 10, 3, 2, '#79573f');
    line(g, x - 3, y - 9, x + 2, y - 9, '#d8b986');
    return;
  }
  const timber = woodC('#9b6b43');
  box(g, a - 2.6, b - 2.6, 0, 5.2, 5.2, 8, timber);
  box(g, a - 2.8, b - 2.8, 7, 5.6, 5.6, 1, woodC('#ae8156'));
  line(g, ...P(a - 2, b + 2.6, 1), ...P(a + 2, b + 2.6, 7), '#bd8b5c');
  line(g, ...P(a + 2.6, b - 2, 7), ...P(a + 2.6, b + 2, 1), '#81573d');
}

function buildStatic(sg, room) {
  const library = room === rooms.library;
  const potion = room === rooms.potion;
  const stockroom = room === rooms.stockroom;
  const width = stockroom ? STOCK_WIDTH : potion ? POTION_COLUMNS * TILE_SIZE : N;
  const depth = stockroom ? STOCK_DEPTH : potion ? POTION_ROWS * TILE_SIZE : N;
  const floor = stockroom ? stockroomFloor : potion ? potionFloor : library ? shadedLibraryFloor : shadedTowerFloor;
  topFace(sg, 0, 0, width, 0, depth, floor);
  wallL(sg, 0, 0, 2 * depth, 0, WH, room === rooms.tower ? leftFn : workshopStone);
  wallR(sg, 0, 0, 2 * width, 0, WH, room === rooms.tower ? rightFn : workshopStone);
  topFace(sg, WH, -T, width, -T, 0, copingFn);
  topFace(sg, WH, -T, 0, 0, depth, copingFn);
  const mer = { top: copingFn, left: brOutL, right: brOutR };
  box(sg, -T, -T, WH, T, T, 12, mer);
  box(sg, -T, depth - 8, WH, T, 8, 10, mer);
  box(sg, width - 8, -T, WH, 8, T, 10, mer);
  wallR(sg, depth, -2 * T, 2 * width, -F, WH, facadeFn(brOutL, width));
  wallL(sg, width, -2 * T, 2 * depth, -F, WH, facadeFn(brOutR, depth));
  if (library) {
    drawReadingWindow(sg);
    box(sg, 0, 33, 26, 4, 21, 2.5, woodC('#89654c'));
    box(sg, .5, 40, 28.5, 3, 8, 1.5, flat('#b37959', '#805247', '#64403c'));
    drawWallIvy(sg, [[0, 11, 28], [0, 31, 38], [0, 54, 24], [7, 0, 31], [52, 0, 36]]);
    drawLibraryShelves(sg);
  }
  if (potion) drawPotionWorkshop(sg);
  if (stockroom) drawStockShelves(sg);
  if (room === rooms.tower || library) drawPassage(sg, library);
  for (const exit of room.exits) {
    if (exit.wallA !== undefined) drawSidePassage(sg, exit, false);
  }
}

/* ---------- meubels ---------- */
const furnishings = [];
const flasks = [];
function flask(g, x, y, liq, type, collection = flasks) {
  if (type === 'tube') {
    rect(g, x - 1, y - 9, 3, 9, '#cfe8ff'); rect(g, x - 1, y - 7, 3, 7, liq); dot(g, x, y - 5, sh(liq, 1.4)); rect(g, x - 1, y - 10, 3, 1, '#a8703a');
  } else if (type === 'jar') {
    rect(g, x - 4, y - 7, 9, 7, '#a5cbd9');
    rect(g, x - 3, y - 5, 7, 4, liq);
    rect(g, x - 3, y - 9, 7, 2, '#a8703a');
    rect(g, x - 3, y - 7, 1, 5, '#f3ffff');
  } else if (type === 'diamond') {
    for (let row = 0; row < 9; row++) {
      const w = Math.min(row, 8 - row);
      rect(g, x - w, y - 9 + row, w * 2 + 1, 1, '#cfe8ff');
      if (w > 0 && row >= 3) rect(g, x - w + 1, y - 9 + row, w * 2 - 1, 1, liq);
    }
    rect(g, x - 1, y - 11, 3, 3, '#cfe8ff');
    rect(g, x - 1, y - 12, 3, 1, '#a8703a');
    dot(g, x - 2, y - 5, '#ffffff');
  } else {
    ell(g, x, y - 4, 4, 4, '#cfe8ff'); ell(g, x, y - 4, 3, 3, liq);
    dot(g, x - 2, y - 6, '#ffffff'); dot(g, x - 1, y - 7, '#ffffff');
    rect(g, x - 1, y - 11, 3, 4, '#cfe8ff'); rect(g, x - 1, y - 9, 3, 2, liq); rect(g, x - 1, y - 12, 3, 1, '#a8703a');
  }
  collection?.push({ x, y });
}
const cand = []; // kaarsposities
let KN = null;  // ridderpositie
const TABLE_A = 48, TABLE_B = 44;
const CHEST_TILE = [6, 0];
let chestOpening = 0;

function buildFront() {
  let canvas = mk(), g = canvas.getContext('2d');
  // De diepte is a + b op de vloer, zodat meubels de tovenaar kunnen bedekken.
  function store(depth, animate) {
    outline(g, '#0f1226');
    furnishings.push({ canvas, depth, animate });
    canvas = mk();
    g = canvas.getContext('2d');
  }
  const wood = woodC('#7a4a2a'), woodD = woodC('#5a3320');
  const iron = flat('#4a4a5a', '#2e2e3c', '#222230');

  // haard
  box(g, 10, 0, 0, 22, 6, 2, flat('#8d88b0', '#6c678f', '#58537a'));
  // schoorsteenmantel + consoles
  box(g, 9, 0, 52, 24, 4, 4, woodD);
  box(g, 8.75, 0, 55, 24.5, 4.5, 1, wood);
  wallR(g, 4, 18, 66, 52, 54, (u, z) =>
    z === 53 && hash(u >> 1, z) > .32 ? '#a67448' : '#503123');
  box(g, 10.5, 0, 48, 1.6, 2.5, 4, woodD); box(g, 29.5, 0, 48, 1.6, 2.5, 4, woodD);

  // ijzeren haardscherm
  for (let a = 11; a <= 30; a += 2) { box(g, a, 3.5, 2, .8, .8, 9, iron); dot(g, CX + 2 * (a - 3.1), CY + a + 3.5 - 12, '#6a6a7e'); }
  box(g, 10.6, 3.5, 7, 20.6, .8, .8, iron);
  box(g, 10.6, 0, 7, .8, 3.5, .8, iron); box(g, 31, 0, 7, .8, 3.5, .8, iron);

  store(26);

  // Fauteuil met de rug naar de haard en de zitting naar het bureau.
  const seatA = 24.5, seatB = 16.5;
  const upholstery = flat('#75917f', '#3a5349', '#4b695b');
  const cushion = flat('#8fa995', '#526e60', '#638272');
  const chairPart = (a, b, z, da, db, dz, material) =>
    box(g, seatA + a, seatB + 7 - b - db, z, da, db, dz, material);
  for (const a of [.5, 5.3]) {
    for (const b of [.5, 5.3]) chairPart(a, b, 0, 1.2, 1.2, 3, woodD);
  }
  chairPart(.15, .15, 3, 6.7, 6.7, 2, woodD);
  chairPart(0, 0, 5, 7, 7, 3, upholstery);
  chairPart(.15, .55, 8, 1.55, 5.7, 4, upholstery);
  chairPart(.25, .7, 12, 1.35, 5.35, 1, cushion);
  chairPart(1.45, .5, 8, 4.1, 4.8, 2.5, cushion);

  // De bies en sierknopen liggen in het zichtbare vlak van de rugleuning.
  const back = flat('#7c9886', (u, z) => {
    const column = u - Math.floor((seatA + .65) * 2);
    if (column <= 1 || column >= 10 || z === 20 || z === 10) return '#415a50';
    if (z === 19 && column >= 3 && column <= 8) return '#a78e60';
    if (z === 16 && (column === 4 || column === 7)) return '#30473f';
    return column <= 3 ? '#577466' : '#4a6659';
  }, '#5d7c6d');
  chairPart(.65, 5, 8, 5.7, 2, 13, back);
  chairPart(1.05, 5.15, 21, 4.9, 1.7, 2, cushion);

  store(seatA + seatB + 7, t => drawSeatedWizard(t, armchairSeat));
  chairPart(5.3, .55, 8, 1.55, 5.7, 4, upholstery);
  chairPart(5.4, .7, 12, 1.35, 5.35, 1, cushion);
  // Een geweven plaid over de voorste armleuning, buiten de zitting.
  const throwWool = flat('#bc785d', '#8b4947', (u, z) => {
    if (z <= 8) return u % 2 ? '#d0a17b' : '#823f41';
    if (z === 10 || z === 11) return '#d2a074';
    return u % 3 === 0 ? '#a75950' : '#9b514a';
  });
  chairPart(6.62, 1.35, 8, .34, 3, 5.2, throwWool);
  chairPart(5.62, 1.35, 13, 1.34, 3, .3, throwWool);
  store(seatA + seatB + 7);

  // Donker schrijfbureau met uitgesneden panelen.
  const deskWood = woodC('#64412d');
  const gilding = flat('#aa7f4c', '#7c5233', '#8e633d');
  box(g, 16.5, 25, 0, 23, 6, 2, deskWood);
  box(g, 16.5, 25, 2, 23, 6, 12, deskWood);
  wallR(g, 31, 33, 79, 2, 14, (u, z) => {
    const column = (u - 33) % 9;
    if (column === 0 || u === 78 || z === 2 || z === 13) return '#987044';
    const curve = Math.hypot(column - 4.5, Math.max(0, z - 8));
    if (curve < 2.15 && z > 4) return '#3c2924';
    if (curve < 3 && z > 3) return '#9c7147';
    if (z === 12 || (column === 1 && z > 4)) return '#805234';
    return hash(u, z >> 1) > .8 ? '#704b34' : '#65432e';
  });
  box(g, 16, 24.5, 13, 24, 7, 2.5, deskWood);
  box(g, 16.25, 31, 14, 23.5, .4, 1, gilding);
  const pages = flat('#dbc79d', '#8c6c4c', '#ad9064');
  box(g, 26, 27, 15.5, 2.25, 2.5, .8, pages);
  box(g, 28.35, 27, 15.5, 2.25, 2.5, .8, pages);
  for (const a of [26.5, 28.75]) {
    line(g, ...P(a, 27.7, 16.3), ...P(a + 1.25, 27.7, 16.3), '#987b57');
    line(g, ...P(a, 28.4, 16.3), ...P(a + 1, 28.4, 16.3), '#ae8d60');
  }
  line(g, ...P(28.25, 27, 16.3), ...P(28.25, 29.5, 16.3), '#7e5c45');
  for (const [z, color] of [[15.5, '#723e42'], [16.3, '#486659'], [17.1, '#846041']]) {
    box(g, 22.8, 26, z, 2.8, 2.2, .8, flat(color, '#5d3c2d', '#aa8e66'));
  }
  box(g, 25.6, 29.5, 15.5, 1.4, 1.4, 1.5, flat('#555279', '#2c2949', '#3e3a5b'));
  box(g, 31.2, 26, 15.5, 1.6, 1.6, 3, gilding);
  box(g, 30.9, 25.7, 18, 2.2, 2.2, 1, gilding);
  box(g, 35.5, 27, 15.5, 4, 3, 1.5, flat('#2f7a3a', '#e8dcb0', '#17481f'));
  // Lage bijenwaskaars bij het open boek.
  const candleA = 20.5, candleB = 28.5;
  box(g, candleA - .9, candleB - .8, 15.5, 1.8, 1.6, .7, gilding);
  box(g, candleA - .45, candleB - .45, 16.2, .9, .9, 2.7,
    flat('#f1d29f', '#c48a59', '#ad704d'));
  const [candleX, candleY] = P(candleA, candleB, 19);
  store(56, t => {
    drawDeskOrb(t);
    flame(candleX, candleY - 1, t, 3);
    glow(candleX, candleY + 3, 16, 11, '255,188,105', .025);
  });

  // Hoge zitstok voor de sneeuwuil.
  box(g, 51, 0, 55, 10, 4.5, 3, woodD);
  box(g, 55, 0, 50, 2, 2, 5, woodD);
  store(0, drawOwl);

  // planken: rechter plank + drankjes
  box(g, 33, 0, 44, 7, 5.5, 2, wood); box(g, 34, 0, 40, 1.2, 3, 4, woodD); box(g, 38, 0, 40, 1.2, 3, 4, woodD);
  let [x, y] = P(35.5, 2.6, 46); flask(g, x, y, '#46d6e8');
  [x, y] = P(38.2, 2.6, 46); flask(g, x, y, '#f0509a');
  // linker plank + drankjes
  box(g, 0, 33, 44, 5.5, 16, 2, wood); box(g, 0, 34, 40, 3, 1.2, 4, woodD); box(g, 0, 38, 40, 3, 1.2, 4, woodD);
  [x, y] = P(2.6, 35.5, 46); flask(g, x, y, '#5be05b');
  [x, y] = P(2.6, 38.4, 46); flask(g, x, y, '#ff6fa8', 'tube');

  // Vensterbank en tussenplank voor de kat.
  box(g, 0, 10, 92, 3.5, 25, 3, wood);
  box(g, 0, 35, 68, 5.5, 12, 2, wood);
  box(g, 0, 43, 64, 3, 1.5, 4, woodD);

  store(0, t => {
    drawFlaskGlints(t);
    drawCat(t);
  });

  // kandelaar
  { const [bx, by] = P(7, 33, 0);
    ell(g, bx, by - 1, 6, 3, '#16161f'); ell(g, bx, by - 2, 5, 2, '#2c2c3a');
    rect(g, bx - 1, by - 24, 2, 22, '#23232f'); dot(g, bx + 1, by - 20, '#3c3c4e'); ell(g, bx, by - 8, 2, 1, '#3c3c4e');
    line(g, bx, by - 22, bx - 8, by - 28, '#23232f'); line(g, bx, by - 22, bx + 8, by - 28, '#23232f');
    line(g, bx, by - 22, bx, by - 30, '#23232f');
    for (const [dx, ty] of [[-8, by - 28], [0, by - 30], [8, by - 28]]) {
      rect(g, bx + dx - 2, ty, 5, 2, '#2c2c3a');
      rect(g, bx + dx - 1, ty - 6, 3, 6, '#e9a4b8'); dot(g, bx + dx - 1, ty - 6, '#fbd0dc'); dot(g, bx + dx + 1, ty - 3, '#c9708a');
      cand.push([bx + dx, ty - 7]);
    } }

  store(40, t => {
    for (const [x, y] of cand) flame(x, y, t, x);
  });

  // ridder
  { const [bx, by] = P(4, 4, 0); KN = [bx, by];
    const lt = '#c9d0de', md = '#8f99ab', dk = '#5c6579';
    const part = (x0, y0, w, h) => { rect(g, x0, y0, w, h, md); rect(g, x0 + w - Math.ceil(w / 3), y0, Math.ceil(w / 3), h, lt); rect(g, x0, y0, Math.max(1, Math.floor(w / 4)), h, dk); };
    part(bx - 6, by - 3, 5, 3); part(bx + 1, by - 3, 5, 3);          // laarzen
    part(bx - 5, by - 13, 4, 10); part(bx + 1, by - 13, 4, 10);      // benen
    part(bx - 6, by - 17, 12, 4);                                    // heupstuk
    part(bx - 6, by - 28, 12, 11);                                   // romp
    rect(g, bx - 5, by - 24, 10, 1, dk); dot(g, bx, by - 26, lt);
    part(bx - 9, by - 30, 5, 5); part(bx + 4, by - 30, 5, 5);        // schouders
    part(bx - 9, by - 25, 3, 10); part(bx + 6, by - 25, 3, 10);      // armen
    part(bx - 4, by - 37, 8, 9);                                     // helm
    rect(g, bx - 3, by - 33, 6, 1, '#1a1d2a');
    rect(g, bx - 1, by - 40, 2, 3, '#b8232f'); }

  store(8, t => {
    if ((t % 7) > 6.4) rect(ctx, KN[0] - 3, KN[1] - 33, 6, 1, '#ff3a3a');
  });

  // Voorraadkist langs de rechterwand
  box(g, 48, 1, 0, 8, 6, 8, woodD);
  box(g, 51, 6.5, 4, 2, 1, 4, flat('#dfbc68', '#a78040', '#c4974d'));
  store(56, drawChest);

  // Kristal op een sokkel langs de linkerwand
  box(g, 1, 49, 0, 6, 6, 3, flat('#777aa1', '#515579', '#616587'));
  box(g, 2, 50, 3, 4, 4, 11, flat('#9194ae', '#535776', '#686d91'));
  box(g, 1, 49, 14, 6, 6, 2, flat('#9194ae', '#535776', '#686d91'));
  // Messing plakkaat met een gegraveerd diamantje.
  box(g, 6, 50.3, 6, .5, 3.4, 5, flat('#e2bf78', '#8b6339', (u, z) => {
    const column = u - 100;
    if (z === 10 || column === 0) return '#e2bf78';
    if (z === 6 || column === 6) return '#91663b';
    if (Math.abs(column - 3) + Math.abs(z - 8) <= 1) return '#6b4b36';
    return '#bd9257';
  }));
  store(56, drawDiamond);

  // tafel
  { const [tx, ty] = P(TABLE_A, TABLE_B, 0);
    ell(g, tx, ty - 1, 9, 4, '#3e2414'); ell(g, tx, ty - 2, 8, 3, '#5a3320');
    rect(g, tx - 1, ty - 18, 3, 16, '#5a3320'); rect(g, tx - 1, ty - 18, 1, 16, '#7a4a2a');
    ell(g, tx, ty - 17, 15, 7, '#4a2a16');
    ell(g, tx, ty - 19, 15, 7, '#b0723e'); ell(g, tx, ty - 19, 13, 6, '#94582e');
    // paars boek
    box(g, TABLE_A - 3.5, TABLE_B - 2.5, 19, 5, 4, 2.5, flat('#7a46ac', '#5a2e88', '#3f1f66'));
    // inktpot + veer
    box(g, TABLE_A + 2, TABLE_B + 1.5, 19, 2.5, 2.5, 3, flat('#3a4aa8', '#26307a', '#1a2258'));
    const [qx, qy] = P(TABLE_A + 3.2, TABLE_B + 2.7, 22);
    for (let i = 0; i < 12; i++) { dot(g, qx - i * .5, qy - i, '#f4f0e6'); if (i > 2 && i < 11) dot(g, qx - i * .5 - 1, qy - i, '#d6d1c4'); }
    dot(g, qx + 1, qy + 1, '#222'); }
  store(TABLE_A + TABLE_B, (t, dt) => { drawSlime(t); drawSparkles(t, dt); });
  furnishings.sort((a, b) => a.depth - b.depth);

}

/* ---------- outline-pass ---------- */
function outline(g, hex) {
  const id = g.getImageData(0, 0, W, H), d = id.data;
  const r = parseInt(hex.slice(1, 3), 16), gg = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const op = (x, y) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 128;
  const pts = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (d[(y * W + x) * 4 + 3] > 128) continue;
    if (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1)) pts.push(x, y);
  }
  g.fillStyle = hex;
  for (let i = 0; i < pts.length; i += 2) g.fillRect(pts[i], pts[i + 1], 1, 1);
}

for (const room of Object.values(rooms)) {
  const background = room.canvas.getContext('2d');
  buildStatic(background, room);
  outline(background, '#14183a');
  const frontExits = room.exits.filter(({ wallA }) => wallA > 0);
  if (frontExits.length) {
    room.foreground = mk();
    const foreground = room.foreground.getContext('2d');
    for (const exit of frontExits) drawSidePassage(foreground, exit, true);
  }
}
buildFront();

const libraryFurnishings = libraryLayout.map(([column, row, type]) => {
  const canvas = mk(), g = canvas.getContext('2d');
  const a = (column + .5) * TILE_SIZE, b = (row + .5) * TILE_SIZE;
  const wood = woodC('#9b6345'), darkWood = woodC('#673f2c');
  if (type === 'desk') {
    for (const da of [-2.7, 2]) for (const db of [-2.7, 2]) {
      box(g, a + da, b + db, 0, .8, .8, 13, darkWood);
    }
    box(g, a - 3.3, b - 3.3, 11, 6.6, 6.6, 2, darkWood);
    box(g, a - 3.5, b - 3.5, 13, 7, 7, 2, wood);
    line(g, ...P(a - 3.4, b + 3.45, 15), ...P(a + 3.4, b + 3.45, 15), '#ce9663');
    box(g, a - 2.55, b - 1.65, 15, 4.45, 3.7, .5,
      flat(row === 3 && column === 2 ? '#6c465c' : '#395651', '#553142', '#382831'));
    const pages = flat('#f0ddb1', '#a78057', '#c2a67c');
    box(g, a - 2.4, b - 1.5, 15, 2, 3.4, 1, pages);
    box(g, a - .25, b - 1.5, 15, 2, 3.4, 1, pages);
    for (let ln = 0; ln < 3; ln++) {
      const pageB = b - .9 + ln * .65;
      line(g, ...P(a - 2.05, pageB, 16), ...P(a - .8, pageB, 16), '#ad8d63');
      line(g, ...P(a + .15, pageB, 16), ...P(a + (ln === 2 ? .95 : 1.35), pageB, 16), '#ad8d63');
    }
    const [x, y] = P(a + 2.2, b - 2.1, 15);
    ell(g, x, y, 3, 1, '#654332');
    rect(g, x - 2, y - 4, 4, 4, '#436866');
    dot(g, x - 2, y - 2, '#8ab0a0');
    ell(g, x, y - 4, 2, 1, '#352930');
    if (row === 3 && column === 2) line(g, x, y - 3, x + 5, y - 10, '#e4cba2');
  } else if (type === 'reading chair') {
    const fabric = woodC('#895450'), cushion = woodC('#ac7161');
    box(g, a - 3.3, b - 3.3, 1, 6.6, 6.6, 6, fabric);
    box(g, a - 2.45, b - 2.5, 6, 4.9, 5, 1.5, cushion);
    box(g, a - 3, b - 3.3, 6, 6, 1.9, 12, fabric);
    for (const side of [-3.3, 2]) {
      box(g, a + side, b - 2.5, 7, 1.3, 5.6, 3, cushion);
    }
    line(g, ...P(a - 2.7, b - 1.4, 17), ...P(a + 2.7, b - 1.4, 17), '#c29270');
  } else if (type === 'tea table') {
    box(g, a - 1, b - 1, 0, 2, 2, 7, darkWood);
    box(g, a - 2.6, b - 2.6, 7, 5.2, 5.2, 1.4, wood);
    box(g, a - 1.9, b, 8.4, 2.1, 1.9, .75, flat('#ae9eb8', '#634d70', '#543b5e'));
    const [x, y] = P(a + 1, b - 1.2, 8.4);
    ell(g, x, y, 3, 1, '#d1b99e');
    rect(g, x - 1, y - 3, 3, 3, '#ddc6af');
    dot(g, x + 2, y - 2, '#ddc6af');
    dot(g, x, y - 3, '#785349');
  } else if (type === 'chair') {
    for (const da of [-2, 1.4]) for (const db of [-2, 1.4]) {
      box(g, a + da, b + db, 0, .65, .65, 6, darkWood);
    }
    box(g, a - 2.2, b - 2.2, 6, 4.4, 4.4, 1.4, wood);
    box(g, a - 2.2, b + 1.5, 7, 4.4, .65, 8, wood);
  } else {
    box(g, a - 2, b - 2, 0, 4, 4, 5, flat('#986644', '#653f36', '#75473a'));
    const [x, y] = P(a, b, 5);
    ell(g, x, y - 6, 5, 6, '#2c493b');
    ell(g, x - 3, y - 8, 3, 4, '#608353');
    ell(g, x + 2, y - 5, 3, 4, '#446a49');
  }
  outline(g, '#241d27');
  const seat = librarySeats.find(({ tile }) => tile[0] === column && tile[1] === row);
  const animate = seat ? t => drawSeatedWizard(t, seat) : type === 'tea table' ? t => {
    const [x, y] = P(a + 1, b - 1.2, 8.4);
    const age = (t * .6) % 1;
    ctx.globalAlpha = Math.sin(age * Math.PI) * .6;
    dot(ctx, x + Math.sin(t * 3), y - 5 - age * 6, '#f0e7da');
    ctx.globalAlpha = 1;
  } : null;
  return { canvas, depth: a + b, animate };
}).sort((a, b) => a.depth - b.depth);

function drawLibraryPortrait(t) {
  const blink = t % 5.1 > 4.94;
  const glance = Math.floor(t / 2.8) % 3 - 1;
  wallR(ctx, 0, 56, 88, 50, 94, (u, z) => {
    const x = u - 56, y = 93 - z;
    const edge = Math.min(x, 31 - x, y, 43 - y);
    if (edge === 0) return '#382538';
    if (edge === 1 || edge === 3) return x < 16 ? '#f1cf83' : '#a97542';
    if (edge === 2) return '#8a5939';

    if (y >= 15 && y <= 17 && x >= 6 && x <= 25) return y === 15 ? '#80618c' : '#342843';
    // Schouders, blonde lokken en het gezicht onder de hoed.
    if (y >= 32 && Math.abs(x - 16) < (y - 29) * 1.2) {
      if (y === 35 && Math.abs(x - 16) <= 1) return '#86ddf2';
      return x < 16 ? '#744d82' : '#503658';
    }
    if (y >= 15 && y <= 35 && Math.abs(x - 16) <= (y > 31 ? 7 : 9)) {
      const faceWidth = y < 20 ? 4 : y > 28 ? 4 : 6;
      if (y >= 17 && y <= 30 && Math.abs(x - 16) <= faceWidth) {
        if (y === 23 && (Math.abs(x - 12) <= 1 || Math.abs(x - 20) <= 1)) {
          if (blink) return '#845966';
          return x === 12 + glance || x === 20 + glance ? '#347ec5' : '#e8f6ff';
        }
        if (y === 28 && x >= 15 && x <= 17) return '#a95668';
        return x > 18 ? '#cf9984' : '#f4bd9b';
      }
      return (x + Math.floor(y / 4)) % 4 === 0 ? '#fff0a6' : x < 16 ? '#d6a553' : '#b98446';
    }
    if (y >= 6 && y <= 16 && Math.abs(x - 15) <= Math.floor((y - 4) * .67)) {
      return y >= 13 ? '#9d638d' : x < 15 ? '#624977' : '#443452';
    }

    if (hash(x, y) > .98) return '#8b748b';
    return '#322b48';
  });
}

function drawLibraryLights(t) {
  for (const [a, b] of [[10, 10], [46, 16], [14, 48]]) {
    const [x, y] = P(a, b, 72);
    line(ctx, x, y - 37, x, y - 6, '#443139');
    glow(x, y, 29, 26, '255,189,100', .085 + .015 * Math.sin(t * 1.4 + a));
    ell(ctx, x, y, 6, 6, '#684a3a');
    ell(ctx, x, y, 5, 5, '#d48e4d');
    ell(ctx, x - 1, y, 3, 4, '#ffe5a6');
    dot(ctx, x - 1, y + 1, '#fff5d9');
    line(ctx, x + 2, y - 4, x + 2, y + 4, '#a87349');
    rect(ctx, x - 3, y - 7, 6, 2, '#9e7150');
    rect(ctx, x - 3, y + 5, 6, 2, '#835638');
  }
}

/* ---------- animaties ---------- */
// Zelfde herfstlucht als in het leesraam en de potionkamer.
function drawSky() {
  wallL(ctx, 0, 24, 64, 60, 90, (u, z) => autumnSunset(u + 1, (z - 60) / 29));
}

// banieren
function banner(t, u0, w, phase) {
  const zt = 102, zb = 62;
  for (let u = u0 - 1; u < u0 + w + 1; u++) { pxR(ctx, u, zt + 1, '#3a2414'); pxR(ctx, u, zt, '#6b4224'); }
  for (let z = zt - 1; z >= zb; z--) {
    const k = (zt - z) / (zt - zb), sw = Math.round(Math.sin(t * 1.7 + phase + k * 1.6) * k * 1.8);
    for (let u = 0; u < w; u++) {
      const zbot = zb + Math.round((w / 2 - Math.abs(u + .5 - w / 2)) * .9);
      if (z < zbot) continue;
      let c = u < 2 ? '#5d9a2c' : u >= w - 2 ? '#a6dc5a' : '#86c040';
      if (z <= zt - 4 && z >= zt - 5) c = '#d9b640';
      if (z === zbot) c = '#4f8a26';
      pxR(ctx, u0 + u + sw, z, c);
    }
    // maansikkel
    if (z >= zt - 20 && z <= zt - 14) {
      const m = u0 + Math.floor(w / 2) + sw, dz = z - (zt - 17);
      for (let du = -3; du <= 3; du++) if (du * du + dz * dz <= 9 && (du - 1) * (du - 1) + dz * dz > 5) pxR(ctx, m + du, z, '#f0d060');
    }
  }
}

// vuur
const sparks = [];
function drawFire(t, dt) {
  // houtblokken
  for (let u = 33; u < 52; u++) for (let z = 2; z < 5; z++) pxR(ctx, u, z, (z === 4 ? '#6b3b1f' : '#4b2a18'));
  for (let u = 36; u < 49; u++) pxR(ctx, u, 5, '#3b2012');
  for (let u = 32; u <= 52; u++) {
    const d = (u - 42) / 11, env = Math.max(0, 1 - d * d);
    const n = (Math.sin(u * .9 + t * 9) + Math.sin(u * .37 - t * 7.3) + Math.sin(u * 1.7 + t * 13.1)) / 3;
    const h = Math.round(env * (19 + 4 * n) + 2 * Math.sin(t * 20 + u));
    for (let z = 0; z < h; z++) {
      const rel = z / h;
      pxR(ctx, u, z + 4, rel < .25 ? '#fff4b0' : rel < .5 ? '#ffc83a' : rel < .78 ? '#f58a22' : '#d8441c');
    }
  }
  for (let u = 34; u < 51; u++) if (hash(u, Math.floor(t * 6)) > .6) pxR(ctx, u, 3, '#ff5a1e');
  if (Math.random() < dt * 14) sparks.push({ u: 36 + Math.random() * 12, z: 14, vz: 14 + Math.random() * 12, vu: (Math.random() - .5) * 6, l: 1 });
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i]; s.z += s.vz * dt; s.u += s.vu * dt; s.l -= dt * 1.2;
    if (s.l <= 0 || s.z > 38 || fireOpen(Math.round(s.u), Math.round(s.z)) === false) { sparks.splice(i, 1); continue; }
    pxR(ctx, Math.round(s.u), Math.round(s.z), s.l > .5 ? '#ffd060' : '#ff7a2a');
  }
}

// portret-ogen
function drawPortrait(t) {
  const ph = t % 3.7, blink = ph > 3.55;
  const flash = (t % 9.3) > 8.7;
  const look = (Math.floor(t / 2.5) % 3) - 1;
  for (const eu of [40, 44]) {
    const u = eu + (look > 0 ? 0 : 0);
    if (blink) pxR(ctx, u, 78, '#b88660');
    else {
      pxR(ctx, u, 78, flash ? '#ffffff' : '#e8fff6'); pxR(ctx, u + (look > 0 ? 1 : 0), 78, flash ? '#7fffd4' : '#2a9a7a');
      if (flash) { pxR(ctx, u, 79, '#7fffd4'); pxR(ctx, u, 77, '#7fffd4'); }
    }
  }
  if (!blink) { pxR(ctx, 41, 79, '#4a3220'); pxR(ctx, 43, 79, '#4a3220'); }
}

// vlammetjes, bubbels, dieren, deeltjes
function flame(x, y, t, seed) {
  const sw = Math.round(Math.sin(t * 9 + seed * 3)), tall = Math.sin(t * 13 + seed) > 0;
  dot(ctx, x, y, '#fff0a0'); dot(ctx, x, y - 1, '#ffe27a');
  dot(ctx, x + sw, y - 2, '#ffb030'); if (tall) dot(ctx, x + sw, y - 3, '#ff7a20');
}
const CAT_PERCHES = [[2.6, 25.5, 95], [3.5, 39, 70], [3.5, 45, 46], [3.5, 39, 70]];
const CAT_REST = 7, CAT_JUMP = .8;
const CAT_FUR = '#14141f', CAT_LIGHT = '#363655', CAT_PAW = '#28283b';

function drawJumpingCat(x, y, direction, progress) {
  const tuck = Math.sin(Math.PI * progress);
  const reach = Math.round(3 * progress);
  const legY = y - 2 - Math.round(2 * tuck);
  const frontX = x + direction * (5 + reach);
  const rearX = x - direction * (7 - Math.round(3 * tuck));
  const headX = x + 7 * direction;

  // Achterste poten verdwijnen gedeeltelijk achter de romp.
  ell(ctx, frontX - 2 * direction, legY - 1, 2, 1, CAT_PAW);
  ell(ctx, rearX + 2 * direction, legY - 1, 2, 1, CAT_PAW);
  for (let i = 0; i < 8; i++) {
    ell(ctx, x - (6 + i) * direction, y - 5 - Math.round(i * .55), 1, 1, CAT_FUR);
  }
  ell(ctx, x, y - 5, 8, 4, CAT_FUR);
  ell(ctx, x - direction, y - 7, 5, 1, CAT_LIGHT);

  // De voorpoten strekken uit bij de landing, de achterpoten trekken in.
  ell(ctx, frontX - direction, legY - 1, 2, 2, CAT_FUR);
  ell(ctx, rearX + direction, legY - 1, 2, 2, CAT_FUR);
  ell(ctx, frontX, legY, 2, 1, CAT_PAW);
  ell(ctx, rearX, legY, 2, 1, CAT_PAW);
  dot(ctx, frontX + direction, legY, CAT_LIGHT);
  dot(ctx, rearX + direction, legY, CAT_LIGHT);

  ell(ctx, headX, y - 9, 4, 3, CAT_FUR);
  rect(ctx, headX - 2, y - 14, 2, 4, CAT_FUR);
  rect(ctx, headX + 1, y - 13, 2, 3, CAT_FUR);
  dot(ctx, headX - 1, y - 13, '#a65b73');
  dot(ctx, headX + direction, y - 10, '#ffd23a');
}


function drawCat(t) {
  const interval = CAT_REST + CAT_JUMP;
  const index = Math.floor(t / interval) % CAT_PERCHES.length;
  const from = CAT_PERCHES[index], to = CAT_PERCHES[(index + 1) % CAT_PERCHES.length];
  const progress = Math.max(0, (t % interval - CAT_REST) / CAT_JUMP);
  const position = from.map((coordinate, axis) => coordinate + (to[axis] - coordinate) * progress);
  position[2] += 15 * Math.sin(Math.PI * progress);
  const [bx, by] = P(...position);
  if (progress > 0) {
    drawJumpingCat(bx, by, to[1] > from[1] ? -1 : 1, progress);
    return;
  }
  drawRestingCat(t, bx, by, '#ffd23a');
}

function drawRestingCat(t, bx, by, eyes) {
  const k = CAT_FUR, k2 = CAT_LIGHT;
  // staart
  for (let i = 0; i < 10; i++) { const x = bx + 5 + i * .8, y = by - 2 - Math.sin(i * .45 + t * 2.4) * (1 + i * .25); rect(ctx, x, y, 2, 2, k); }
  ell(ctx, bx, by - 5, 5, 5, k);
  ell(ctx, bx + 2, by - 6, 2, 3, k2);
  for (const offset of [-2, 2]) {
    ell(ctx, bx + offset, by - 2, 1, 2, CAT_PAW);
    ell(ctx, bx + offset, by - 1, 2, 1, CAT_PAW);
    dot(ctx, bx + offset, by - 1, k2);
  }
  drawCatHead(t, bx, by, eyes);
}

function drawCatHead(t, bx, by, eyes) {
  const k = CAT_FUR, k2 = CAT_LIGHT;
  rect(ctx, bx - 4, by - 16, 8, 7, k);
  rect(ctx, bx - 4, by - 18, 2, 2, k); rect(ctx, bx + 2, by - 18, 2, 2, k);
  rect(ctx, bx - 4, by - 16, 8, 1, k2);
  dot(ctx, bx - 3, by - 17, '#a65b73'); dot(ctx, bx + 3, by - 17, '#a65b73');
  const blink = (t % 4.6) > 4.45;
  if (blink) { rect(ctx, bx - 3, by - 13, 2, 1, '#3a3a50'); rect(ctx, bx + 1, by - 13, 2, 1, '#3a3a50'); }
  else { rect(ctx, bx - 3, by - 14, 2, 2, eyes); rect(ctx, bx + 1, by - 14, 2, 2, eyes); dot(ctx, bx - 2, by - 14, '#111'); dot(ctx, bx + 2, by - 14, '#111'); }
  dot(ctx, bx, by - 11, '#7a3a4a');
}
function drawDiamond(t) {
  const [x, y] = P(4, 52, 16);
  const facet = (color, points) => {
    ctx.beginPath();
    ctx.moveTo(x + points[0][0], y + points[0][1]);
    for (const [dx, dy] of points.slice(1)) ctx.lineTo(x + dx, y + dy);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  facet('#102c46', [[-7,-8],[-4,-13],[4,-13],[7,-8],[0,1]]);
  facet('#bbf5ff', [[-6,-8],[-4,-12],[4,-12],[6,-8]]);
  facet('#6cc2e8', [[-6,-8],[-2,-8],[0,0]]);
  facet('#3281b5', [[2,-8],[6,-8],[0,0]]);
  facet('#9bdef6', [[-2,-8],[2,-8],[0,0]]);
  line(ctx, x - 6, y - 8, x + 6, y - 8, '#e1faff');
  const sparkles = [[-8, -5, .5], [7, -13, 1.1], [3, -17, 1.7], [-5, -16, 2.3]];
  for (const [dx, dy, delay] of sparkles) {
    const phase = (t + delay) % 3.2 / .65;
    if (phase >= 1) continue;
    ctx.globalAlpha = Math.sin(Math.PI * phase);
    const sy = y + dy - Math.round(2 * phase);
    dot(ctx, x + dx, sy, '#effdff');
    if (phase > .3 && phase < .7) {
      dot(ctx, x + dx + 1, sy, '#79c6ef');
      dot(ctx, x + dx, sy - 1, '#79c6ef');
    }
  }
  ctx.globalAlpha = 1;
  const pulse = t % 3.2 / .42;
  if (pulse < 1) {
    const sx = x + (Math.floor(t / 3.2) % 2 ? 4 : -3);
    ctx.globalAlpha = Math.sin(Math.PI * pulse);
    line(ctx, sx - 3, y - 11, sx + 3, y - 11, '#a8e9ff');
    line(ctx, sx, y - 14, sx, y - 8, '#a8e9ff');
    dot(ctx, sx, y - 11, '#ffffff');
    ctx.globalAlpha = 1;
  }
}

function drawChest(t, dt) {
  chestOpening = Math.max(0, Math.min(1, chestOpening + (chestInventory?.open ? dt : -dt) * 2.2));
  const opening = chestOpening * chestOpening * (3 - 2 * chestOpening);
  const angle = opening * 1.7;
  const [x, y] = P(52, 4, 8);
  if (opening) {
    const glow = ctx.createRadialGradient(x, y - 6, 1, x, y - 6, 44);
    glow.addColorStop(0, 'rgba(255, 235, 169, ' + .65 * opening + ')');
    glow.addColorStop(.4, 'rgba(255, 192, 75, ' + .3 * opening + ')');
    glow.addColorStop(1, 'rgba(255, 192, 75, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 44, y - 50, 88, 88);

    topFace(ctx, 8, 48, 56, 1, 7, (a, b) => {
      if (a < 48.5 || a > 55.5 || b < 1.5 || b > 6.5) return '#e1a750';
      return opening > .4 ? '#fff4bd' : '#d8983f';
    });

  }

  // Het deksel draait om het scharnier langs de achterzijde van de kist.
  const lid = (a, length, thickness = 0) => {
    // Schaal de vorm naar de buitenmaten van de bak (8 × 6).
    const span = length * 6 / 7;
    return P(
      48 + a * 8 / 9,
      1 + span * Math.cos(angle) - thickness * Math.sin(angle),
      8 + span * Math.sin(angle) + thickness * Math.cos(angle)
    );
  };
  const face = (color, points) => {
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (const point of points.slice(1)) ctx.lineTo(...point);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  const panel = (color, left, right, start, end) =>
    face(color, [lid(left, start), lid(right, start), lid(right, end), lid(left, end)]);

  const rim = [0, 1, 2.25, 3.5, 4.75, 6, 7];
  const arch = [1, 3.6, 5.2, 5.9, 5.2, 3.6, 1];
  const boards = [.88, 1.03, 1.24, 1.16, 1.02, .87].map(light => sh('#5a3320', light));
  const brass = ['#8c653a', '#b7864a', '#e4be76', '#d6a65f', '#ad7941', '#8b6037'];
  const curvedStrip = (color, left, right, i) => face(color, [
    lid(left, rim[i], arch[i]), lid(right, rim[i], arch[i]),
    lid(right, rim[i + 1], arch[i + 1]), lid(left, rim[i + 1], arch[i + 1])
  ]);

  if (angle < Math.atan(2)) {
    for (let i = 0; i < boards.length; i++) {
      curvedStrip(boards[i], 0, 9, i);
      for (const band of [.65, 7.3]) curvedStrip(brass[i], band, band + 1, i);
      if (i % 2 === 0) {
        for (const band of [1.15, 7.8]) dot(ctx, ...lid(band, rim[i], arch[i]), '#ffe2a2');
      }
    }
  } else {
    face('#62422d', [lid(9, 0), lid(9, 7), lid(9, 7, 1.5), lid(9, 0, 1.5)]);
    face('#ad7843', [lid(0, 7), lid(9, 7), lid(9, 7, 1.5), lid(0, 7, 1.5)]);
    panel('#63412c', 0, 9, 0, 7);
    panel('#b57841', .5, 8.5, .5, 3.3);
    panel('#ce9251', .5, 8.5, 3.6, 6.5);
    for (const strip of [1, 7]) {
      panel('#8e673e', strip, strip + 1, 0, 7);
      for (const end of [1, 6]) dot(ctx, ...lid(strip + .5, end), '#ffe3a0');
    }
    line(ctx, ...lid(0, 7, 1.5), ...lid(9, 7, 1.5), '#e3ae68');

  }
  face('#5a3320', [lid(9, 0), ...rim.map((length, i) => lid(9, length, arch[i])), lid(9, 7)]);
  for (let i = 0; i < boards.length; i++) {
    line(ctx, ...lid(9, rim[i], arch[i]), ...lid(9, rim[i + 1], arch[i + 1]), '#75472e');
  }
  if (!opening) return;

  for (let i = 0; i < 40; i++) {
    const age = (t * (.46 + hash(i, 9) * .3) + hash(i, 3)) % 1;
    const dx = (hash(i, 1) - .5) * (15 + 36 * age) + 2 * Math.sin(t * 2.5 + i);
    const dy = 3 + age * (27 + hash(i, 2) * 24);
    ctx.globalAlpha = opening * (1 - age * .85) * (.65 + .35 * Math.sin(t * 6 + i) ** 2);
    dot(ctx, x + dx, y - dy, i % 3 ? '#ffdc7a' : '#fffbdc');
    if (i % 9 === 0) {
      dot(ctx, x + dx - 1, y - dy, '#ffe49a');
      dot(ctx, x + dx, y - dy + 1, '#ffe49a');
    }
  }
  ctx.globalAlpha = 1;
}

function drawSlime(t) {
  const [sx, sy] = P(TABLE_A + 3.2, TABLE_B - 4, 19), s = Math.sin(t * 3), rx = Math.round(5.5 - s * .9), ry = Math.round(4 + s * .9);
  ell(ctx, sx, sy - ry + 1, rx, ry, '#e0559a'); ell(ctx, sx, sy - ry, rx - 1, ry - 1, '#ff7fbf');
  dot(ctx, sx - 2, sy - ry - 1, '#ffd0ea'); dot(ctx, sx - 1, sy - ry - 2, '#ffd0ea');
  dot(ctx, sx - 2, sy - ry + 1, '#3a1030'); dot(ctx, sx + 1, sy - ry + 1, '#3a1030');
}
const sparkles = [];
function drawSparkles(t, dt) {
  const [ox, oy] = P(TABLE_A - 1.5, TABLE_B - .5, 21.5);
  if (Math.random() < dt * 6) sparkles.push({ x: ox + (Math.random() - .5) * 8, y: oy, vx: (Math.random() - .5) * 4, vy: -(6 + Math.random() * 6), l: 1.4 + Math.random(), m: 0, c: ['#9ff', '#f9f', '#fff', '#fd6'][Math.floor(Math.random() * 4)] });
  for (let i = sparkles.length - 1; i >= 0; i--) {
    const s = sparkles[i]; s.l -= dt; s.m += dt;
    if (s.l <= 0) { sparkles.splice(i, 1); continue; }
    s.x += s.vx * dt + Math.sin(s.m * 5 + i) * .15; s.y += s.vy * dt;
    ctx.globalAlpha = Math.min(1, s.l);
    dot(ctx, s.x, s.y, s.c);
    if (s.l > 1) { dot(ctx, s.x - 1, s.y, s.c); dot(ctx, s.x + 1, s.y, s.c); dot(ctx, s.x, s.y - 1, s.c); dot(ctx, s.x, s.y + 1, s.c); }
    ctx.globalAlpha = 1;
  }
}
function glow(x, y, rx, ry, rgb, a) {
  ctx.globalCompositeOperation = 'source-atop';
  for (const f of [1, .72, .45]) { ctx.fillStyle = 'rgba(' + rgb + ',' + a + ')'; ctx.beginPath(); ctx.ellipse(x, y, rx * f, ry * f, 0, 0, 6.2832); ctx.fill(); }
  ctx.globalCompositeOperation = 'source-over';
}

function drawFlaskGlint(g, x, y, t, phase, size = 1) {
  g.save();
  g.globalAlpha *= .85;
  for (let k = 0; k < 2; k++) {
    dot(g, x + (k ? size : -size), y - (2 + ((t * 4 + phase * 1.7 + k * 2.3) % 5)) * size, '#f4fff8');
  }
  g.restore();
}

function drawFlaskGlints(t) {
  flasks.forEach(({ x, y }, i) => drawFlaskGlint(ctx, x, y, t, i));
}

/* ---------- speelbare tovenaar ---------- */
const STEP_TIME = WIZARD.FRAMES.walk / WIZARD.FPS.walk;
// Rijen lopen over b, kolommen over a. X staat voor een meubel of de haard.
const towerFloor = [
  'XXXX..X.',
  '........',
  '...X....',
  '..XXX...',
  'X.......',
  '.....XX.',
  'X.......',
  '........'
];
const libraryFloorMap = Array.from({ length: ROOM_TILES }, () => Array(ROOM_TILES).fill('.'));
for (const [a, b] of libraryLayout) libraryFloorMap[b][a] = 'X';
rooms.tower.floor = towerFloor;
rooms.library.floor = libraryFloorMap;
// De boekenkasten, het flessenrek en de ketel nemen elk vloertegels in.
rooms.potion.floor = [
  'X.XXXX..',
  'X.......',
  '........',
  '.....XX.',
  '.....XX.',
  'X..XX...',
  'X.......'
];
rooms.stockroom.floor = Array.from({ length: STOCK_ROWS }, (_, row) =>
  Array(STOCK_COLUMNS).fill(row === 0 ? 'X' : '.'));
for (const [a, b] of stockLayout) rooms.stockroom.floor[b][a] = 'X';
const stockFurnishings = stockLayout.map(([column, row, sack]) => {
  const canvas = mk();
  const a = (column + .5) * TILE_SIZE, b = (row + .5) * TILE_SIZE;
  drawStockContainer(canvas.getContext('2d'), a, b, sack);
  return { canvas, depth: a + b };
});
const workbenchCanvas = mk();
drawPotionWorkbench(workbenchCanvas.getContext('2d'));
const skeletonMage = new Image();
skeletonMage.src = 'assets/sprites/skeleton-mage.png';
const skeletonMageTile = [4, 5];
const [skeletonMageA, skeletonMageB] = skeletonMageTile.map(tile => (tile + .5) * TILE_SIZE);

function drawSkeletonMage(t) {
  if (!skeletonMage.naturalWidth) return;
  const [x, y] = P(skeletonMageA, skeletonMageB, 0);
  const width = skeletonMage.naturalWidth, height = skeletonMage.naturalHeight;
  const left = Math.round(x - width / 2), top = Math.round(y - height);
  ell(ctx, x, y, 7, 2, 'rgba(25,20,34,.42)');

  const headWidth = 23, headHeight = 21;
  const nod = Math.sin(t * 2.4) > .62 ? -1 : 0;
  ctx.drawImage(skeletonMage, 0, headHeight, width, height - headHeight,
    left, top + headHeight, width, height - headHeight);
  ctx.drawImage(skeletonMage, headWidth, 0, width - headWidth, headHeight,
    left + headWidth, top, width - headWidth, headHeight);
  ctx.drawImage(skeletonMage, 0, 0, headWidth, headHeight,
    left, top + nod, headWidth, headHeight);

  const eyeY = top + nod;
  dot(ctx, left + 14, eyeY + 16, '#8f263b');
  dot(ctx, left + 15, eyeY + 16, '#ff5159');
  dot(ctx, left + 18, eyeY + 14, '#ff5159');

  const flicker = Math.sin(t * 11) + .45 * Math.sin(t * 18);
  dot(ctx, left + 27, top + 11, flicker > 0 ? '#d1ffd9' : '#81edac');
  dot(ctx, left + 6, top + 35, flicker > -.3 ? '#c5f8b1' : '#81ba75');
  const ember = (t * 1.3) % 1;
  if (ember < .72) {
    ctx.save();
    ctx.globalAlpha = 1 - ember;
    dot(ctx, left + 28 + Math.sin(t * 6), top + 7 - ember * 5, '#9cf6bd');
    ctx.restore();
  }
}

const potionFurnishings = [
  { depth: skeletonMageA + skeletonMageB, animate: drawSkeletonMage },
  { depth: workbenchA + workbenchB, canvas: workbenchCanvas },
  { depth: cauldronA + cauldronB, animate: drawCauldron }
];
let currentRoom = rooms.tower;
const currentFloor = () => currentRoom.floor;
const wizard = { a: 4, b: 4, direction: 'se', step: null };
const moves = new Map([
  ['arrowup', [0, -1, 'ne']], ['arrowright', [1, 0, 'se']],
  ['arrowdown', [0, 1, 'sw']], ['arrowleft', [-1, 0, 'nw']]
]);
const aliases = { w: 'arrowup', d: 'arrowright', s: 'arrowdown', a: 'arrowleft' };
const heldKeys = new Set();
let fireHeld = false;
let fireCharge = 0;
const chestInventory = document.getElementById('chest-inventory');
let requestedSeat = null, activeSeat = null;
let requestedChest = false;
let seatProgress = 0;
let route = [];
let destination = null;
const isWalkable = (a, b) => currentFloor()[b]?.[a] === '.';

const questDialogue = document.getElementById('quest-dialogue');
const questObjective = document.getElementById('quest-objective');
const questStorageKey = 'spellbound.quest.cauldron.v1';
const questStages = ['available', 'active', 'ready', 'complete'];
let questStage = 'available';
let cauldronHeat = 0;
try {
  if (!preview) {
    const saved = localStorage.getItem(questStorageKey);
    if (questStages.includes(saved)) questStage = saved;
  }
} catch {
  // De quest werkt ook wanneer lokale opslag is uitgeschakeld.
}

let cauldronWarmup = questStage === 'ready' || questStage === 'complete' ? 1 : 0;

function hasQuestWand() {
  return document.getElementById('hotbar')?.dataset.hasWand === 'true';
}

function renderQuestObjective() {
  if (!questObjective) return;
  const objectives = {
    active: hasQuestWand() ? 'Equip your wand and hold Q to heat the cauldron.' : 'Retrieve your wand from the chest in the main room.',
    ready: 'Speak to the Skeleton Mage.',
    complete: 'Quest complete.'
  };
  const objective = objectives[questStage];
  questObjective.hidden = !objective;
  if (objective && questObjective.textContent !== `Fire Beneath the Cauldron · ${objective}`) {
    questObjective.textContent = `Fire Beneath the Cauldron · ${objective}`;
  }
}

function advanceCauldronQuest(stage) {
  questStage = stage;
  try { localStorage.setItem(questStorageKey, stage); } catch { /* Alleen deze sessie. */ }
  renderQuestObjective();
}

function talkToSkeletonMage() {
  if (!questDialogue || questDialogue.open || chestInventory?.open) return;
  const messages = {
    available: 'The cauldron has gone cold. Retrieve your wand from the chest in the main room, then use your fire spell to heat it.',
    active: hasQuestWand() ? 'Equip your wand, face the cauldron and hold Q until the flames catch.' : 'Your wand is in the chest in the main room. Move it into your hotbar.',
    ready: 'The fire has caught! Now I can finish the brew. Thank you, wizard.',
    complete: 'The cauldron is warm and the brew is coming along nicely.'
  };
  document.getElementById('quest-message').textContent = messages[questStage];
  const action = document.getElementById('quest-action');
  action.hidden = questStage !== 'available' && questStage !== 'ready';
  action.textContent = questStage === 'ready' ? 'Complete quest' : 'Accept';
  document.getElementById('quest-dismiss').textContent = questStage === 'available' ? 'Decline' : 'Close';
  clearRoute();
  heldKeys.clear();
  fireHeld = false;
  questDialogue.returnValue = '';
  questDialogue.showModal();
}

document.getElementById('reset-quest')?.addEventListener('click', () => {
  cauldronHeat = 0;
  cauldronWarmup = 0;
  advanceCauldronQuest('available');
  cv.focus({ preventScroll: true });
});

questDialogue?.addEventListener('close', () => {
  if (questDialogue.returnValue === 'advance') {
    if (questStage === 'available') advanceCauldronQuest('active');
    else if (questStage === 'ready') advanceCauldronQuest('complete');
  }
  cv.focus({ preventScroll: true });
});
new MutationObserver(renderQuestObjective).observe(document.getElementById('hotbar') ?? cv,
  { attributes: true, attributeFilter: ['data-has-wand'] });
renderQuestObjective();

function warmCauldron(hit, dt) {
  if (questStage !== 'active') return;
  cauldronHeat = hit ? cauldronHeat + dt : 0;
  if (cauldronHeat >= 1) advanceCauldronQuest('ready');
}

function drawQuestMarker(t) {
  if (preview || questStage === 'complete' || !skeletonMage.naturalWidth) return;
  const [x, y] = P(skeletonMageA, skeletonMageB, skeletonMage.naturalHeight);
  const top = Math.round(y - 8 + Math.sin(t * 3));
  const color = { available: '#ffe15b', active: '#c4cfde', ready: '#f6b844' }[questStage];
  const rows = questStage === 'available'
    ? ['..##..', '..##..', '..##..', '..##..', '..##..', '......', '..##..', '..##..']
    : ['.####.', '##..##', '....##', '...##.', '..##..', '......', '..##..', '..##..'];
  for (const [dy, row] of rows.entries()) {
    for (let dx = 0; dx < row.length; dx++) {
      if (row[dx] === '#') rect(ctx, x + dx - 4, top + dy - 1, 3, 3, '#21192a');
    }
  }
  for (const [dy, row] of rows.entries()) {
    for (let dx = 0; dx < row.length; dx++) {
      if (row[dx] === '#') dot(ctx, x + dx - 3, top + dy, color);
    }
  }
}

const iceBalls = [];
let iceCooldown = 0;
let castTime = 0;
const castStrength = () => Math.max(fireCharge,
  castTime > .2 ? (.32 - castTime) / .12 : Math.max(0, castTime / .2));

function canBreatheFire() {
  return fireHeld && WIZARD.staffEquipped && !seatProgress &&
    !chestInventory?.open && !questDialogue?.open && librarianDialogue.hidden;
}

const fireSprite = new Image();
fireSprite.src = 'assets/sprites/fire-breath.png';
const fireFrameWidth = 88, fireFrameHeight = 38, fireFrameCount = 16;

function fireBreathLayers(t, a, b, dt) {
  if (!canBreatheFire() || !fireCharge || !fireSprite.naturalWidth) {
    warmCauldron(false, dt);
    return [];
  }
  const [da, db] = Array.from(moves.values()).find(move => move[2] === wizard.direction);
  const hand = WIZARD.castingHand(wizard.direction, castStrength());
  const z = 13;
  const originA = a + (hand.y + z + hand.x / 2) / 2;
  const originB = b + (hand.y + z - hand.x / 2) / 2;
  const startA = Math.floor(originA / TILE_SIZE), startB = Math.floor(originB / TILE_SIZE);
  const reach = 22 * fireCharge;
  let visibleReach = reach;
  let hitsCauldron = false;
  for (let distance = 0; distance < reach; distance += .5) {
    const column = Math.floor((originA + distance * da) / TILE_SIZE);
    const row = Math.floor((originB + distance * db) / TILE_SIZE);
    if (currentRoom === rooms.potion && (cauldronA - a) * da + (cauldronB - b) * db > 0 &&
        Math.abs(column + .5 - cauldronA / TILE_SIZE) < 1 &&
        Math.abs(row + .5 - cauldronB / TILE_SIZE) < 1) {
      hitsCauldron = true;
      visibleReach = distance + 2;
      break;
    }
    if ((column !== startA || row !== startB) && !isWalkable(column, row)) {
      visibleReach = distance;
      break;
    }
  }
  warmCauldron(hitsCauldron, dt);
  if (!visibleReach) return [];
  const [x, y] = P(originA, originB, z);
  const dx = 2 * (da - db), dy = da + db;
  const projected = Math.hypot(dx, dy);
  const ux = dx / projected, uy = dy / projected;
  const side = Math.sign(dx);
  const scale = .73;
  const frame = Math.floor(t / .06) % fireFrameCount;
  return [{
    depth: originA + originB,
    animate() {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.translate(x, y);
      ctx.transform(ux, uy, -uy * side, ux * side, 0, 0);
      ctx.beginPath();
      ctx.rect(0, -fireFrameHeight * scale, visibleReach * projected, fireFrameHeight * scale * 2);
      ctx.clip();
      ctx.drawImage(fireSprite, frame % 4 * fireFrameWidth, Math.floor(frame / 4) * fireFrameHeight,
        fireFrameWidth, fireFrameHeight, -5 * scale, -24 * scale,
        fireFrameWidth * scale, fireFrameHeight * scale);
      ctx.restore();
    }
  }];
}

function castIceBall() {
  if (!WIZARD.staffEquipped || iceCooldown > 0 || chestInventory?.open ||
      !librarianDialogue.hidden) return;
  const [da, db] = Array.from(moves.values()).find(move => move[2] === wizard.direction);
  const progress = wizard.step ? wizard.step.elapsed / STEP_TIME : 0;
  const a = (wizard.a + .5 + (wizard.step ? (wizard.step.a - wizard.a) * progress : 0)) * TILE_SIZE;
  const b = (wizard.b + .5 + (wizard.step ? (wizard.step.b - wizard.b) * progress : 0)) * TILE_SIZE;
  const seated = activeSeat && seatProgress >= .75;
  const originA = seated ? (activeSeat.tile[0] + .5) * TILE_SIZE : a;
  const originB = seated ? (activeSeat.tile[1] + .5) * TILE_SIZE + (activeSeat.offsetB ?? -1) : b;
  iceBalls.push({
    a: originA, b: originB,
    z: seated ? activeSeat.height + 14 : 14,
    delay: .12, direction: wizard.direction,
    da, db, age: 0, impact: 0,
    startA: Math.floor(originA / TILE_SIZE), startB: Math.floor(originB / TILE_SIZE)
  });
  iceCooldown = .55;
  castTime = .32;
}

function updateIceBalls(dt) {
  iceCooldown = Math.max(0, iceCooldown - dt);
  castTime = Math.max(0, castTime - dt);
  for (let i = iceBalls.length - 1; i >= 0; i--) {
    const ball = iceBalls[i];
    if (ball.delay > 0) {
      if (!WIZARD.staffEquipped) { iceBalls.splice(i, 1); continue; }
      ball.delay -= dt;
      if (ball.delay > 0) continue;
      const hand = WIZARD.castingHand(ball.direction, 1);
      const dy = hand.y + 14;
      ball.a += (dy + hand.x / 2) / 2;
      ball.b += (dy - hand.x / 2) / 2;
    }
    ball.age += dt;
    if (ball.impact) {
      ball.impact += dt;
      if (ball.impact > .3) iceBalls.splice(i, 1);
      continue;
    }
    const steps = Math.ceil(dt * 36);
    for (let step = 0; step < steps; step++) {
      const a = ball.a + ball.da * dt * 36 / steps;
      const b = ball.b + ball.db * dt * 36 / steps;
      const tileA = Math.floor(a / TILE_SIZE), tileB = Math.floor(b / TILE_SIZE);
      const outside = a < 0 || b < 0 || tileA >= currentFloor()[0].length || tileB >= currentFloor().length;
      const blocked = (tileA !== ball.startA || tileB !== ball.startB) && !isWalkable(tileA, tileB);
      if (outside || blocked || ball.age > 2) {
        ball.impact = .001;
        break;
      }
      ball.a = a; ball.b = b;
    }
  }
}

function iceBallLayers() {
  return iceBalls.filter(ball => ball.delay <= 0).map(ball => ({
    depth: ball.a + ball.b,
    animate() {
      const [x, y] = P(ball.a, ball.b, ball.z);
      ctx.save();
      if (ball.impact) {
        ctx.globalAlpha = Math.max(0, 1 - ball.impact / .3);
        for (let i = 0; i < 8; i++) {
          const angle = i * Math.PI / 4;
          const radius = 2 + ball.impact * 26;
          rect(ctx, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, 2, 2, '#c4f8ff');
        }
      } else {
        glow(x, y, 10, 8, '99,211,255', .16);
        for (let i = 1; i <= 5; i++) {
          const [tx, ty] = P(ball.a - ball.da * i * 1.1, ball.b - ball.db * i * 1.1, ball.z);
          ctx.globalAlpha = (1 - i / 6) * .65;
          dot(ctx, tx, ty + Math.round(Math.sin(ball.age * 16 + i) * 2), '#bcefff');
        }
        ctx.globalAlpha = 1;
        // Een spits kristal wijst steeds in de vliegrichting.
        const dx = 2 * (ball.da - ball.db), dy = ball.da + ball.db;
        const length = Math.hypot(dx, dy);
        const ux = dx / length, uy = dy / length;
        const nx = -uy, ny = ux;
        for (let along = -4; along <= 6; along++) {
          const width = along < -2 ? 1 : Math.max(0, Math.floor((6 - along) / 2.5));
          for (let across = -width; across <= width; across++) {
            const color = across === -width ? '#e8ffff'
              : across < 0 ? '#a9efff' : across === width ? '#347fae' : '#64c8ed';
            dot(ctx, x + ux * along + nx * across, y + uy * along + ny * across, color);
          }
        }
      }
      ctx.restore();
    }
  }));
}

function clearRoute() {
  route = [];
  destination = null;
  requestedChest = false;
}

function nextToChest(a = wizard.a, b = wizard.b) {
  return currentRoom === rooms.tower && Math.abs(a - CHEST_TILE[0]) + Math.abs(b - CHEST_TILE[1]) === 1;
}

function requestChest() {
  if (chestInventory.open) return;
  const start = wizard.step ?? wizard;
  const [a, b] = CHEST_TILE;
  const approaches = Array.from(moves.values(), ([da, db]) => [a + da, b + db]);
  const paths = approaches.filter(tile => isWalkable(...tile))
    .map(tile => ({ tile, path: findRoute(start, ...tile) }))
    .filter(({ path }) => path !== null)
    .sort((first, second) => first.path.length - second.path.length);
  if (!paths.length) return;
  const [{ tile, path }] = paths;
  heldKeys.clear();
  requestedSeat = null;
  requestedChest = true;
  route = path;
  destination = path.length ? tile : null;
}

if (!preview) {
  addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey ||
        event.target.closest?.('input, textarea, select, [contenteditable]')) return;
    if (questDialogue?.open) return;
    if (key === 'e' && !event.repeat && currentRoom === rooms.potion &&
        Math.abs(wizard.a - skeletonMageTile[0]) + Math.abs(wizard.b - skeletonMageTile[1]) <= 1) {
      event.preventDefault();
      talkToSkeletonMage();
      return;
    }
    if (key === 'q') {
      event.preventDefault();
      fireHeld = true;
      if (WIZARD.staffEquipped && !chestInventory?.open && librarianDialogue.hidden) requestedSeat = null;
      return;
    }
    if (key === 'f') {
      event.preventDefault();
      if (!event.repeat) castIceBall();
      return;
    }
    if (key === 'e' && chestInventory && !event.repeat && !wizard.step && nextToChest()) {
      event.preventDefault();
      requestChest();
      return;
    }
    if (!moves.has(aliases[key] || key)) return;
    event.preventDefault();
    clearRoute();
    requestedSeat = null;
    heldKeys.add(key);
  });
  addEventListener('keyup', event => {
    const key = event.key.toLowerCase();
    if (key === 'q') fireHeld = false;
    heldKeys.delete(key);
  });
  const releaseControls = () => {
    heldKeys.clear();
    fireHeld = false;
  };
  addEventListener('blur', releaseControls);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseControls();
  });
}

let hoveredTile = null;
function pointerPosition(event) {
  const bounds = cv.getBoundingClientRect();
  const x = (event.clientX - bounds.left) * W / bounds.width - CX;
  const y = (event.clientY - bounds.top) * H / bounds.height - CY;
  return [x, y];
}

function tileAtPointer(event) {
  const [x, y] = pointerPosition(event);
  // Keer P(a, b, 0) om om te bepalen boven welke vloertegel de muis staat.
  const a = Math.floor((y + x / 2) / (2 * TILE_SIZE));
  const b = Math.floor((y - x / 2) / (2 * TILE_SIZE));
  return currentFloor()[b]?.[a] ? [a, b] : null;
}

if (!preview) {
  cv.addEventListener('pointermove', event => {
    if (event.pointerType !== 'touch') hoveredTile = tileAtPointer(event);
  });
  cv.addEventListener('click', event => {
    const [px, py] = pointerPosition(event);
    const floorTile = tileAtPointer(event);
    if (currentRoom === rooms.potion && floorTile &&
        floorTile[0] === skeletonMageTile[0] && floorTile[1] === skeletonMageTile[1]) {
      talkToSkeletonMage();
      return;
    }
    if (currentRoom === rooms.tower && chestInventory) {
      const [x, y] = P(52, 4, 8);
      if (Math.abs(px + CX - x) <= 15 && py + CY >= y - 10 && py + CY <= y + 12) {
        requestChest();
        return;
      }
    }
    if (currentRoom === rooms.library && librarianHit) {
      const [x, y] = librarianHit;
      if (Math.abs(px + CX - x) <= 8 && py + CY >= y - 43 && py + CY <= y) {
        librarianDialogue.hidden = !librarianDialogue.hidden;
        clearRoute();
        requestedSeat = null;
        heldKeys.clear();
        return;
      }
    }
    librarianDialogue.hidden = true;
    const seats = currentRoom === rooms.library ? librarySeats : currentRoom === rooms.tower ? [armchairSeat] : [];
    const seat = seats.find(({ tile, hit }) => {
      const [x, y] = P((tile[0] + .5) * TILE_SIZE, (tile[1] + .5) * TILE_SIZE, 0);
      return Math.abs(px + CX - x) <= hit[0] && py + CY >= y - hit[1] && py + CY <= y + 3;
    });
    if (seat && seat === requestedSeat) {
      requestedSeat = null;
      clearRoute();
      return;
    }
    const clickedExit = currentRoom.exits.find(({ wallA, tile }) => {
      if (wallA === undefined) return false;
      const u = 2 * wallA - px - 1;
      const z = wallA + Math.floor(u / 2) - 1 - py;
      return z >= 0 && passageColor(2 * (tile[1] + .5) * TILE_SIZE - u, z);
    });
    const tile = clickedExit?.tile ?? (seat ? seat.approach : floorTile);
    if (!tile || !isWalkable(...tile)) return;
    const start = wizard.step ?? wizard;
    const nextRoute = findRoute(start, ...tile);
    if (!nextRoute) return;
    heldKeys.clear();
    requestedSeat = clickedExit ? null : seat ?? null;
    requestedChest = false;
    route = nextRoute;
    destination = route.length ? tile : null;
  });
}

// Doorzoek de vloer vanaf de eerstvolgende vaste positie, één tegel per stap.
function findRoute(start, targetA, targetB) {
  const queue = [{ a: start.a, b: start.b, previous: null }];
  const columns = currentFloor()[0].length;
  const tileId = (a, b) => b * columns + a;
  const visited = new Set([tileId(start.a, start.b)]);
  for (let index = 0; index < queue.length; index++) {
    const tile = queue[index];
    if (tile.a === targetA && tile.b === targetB) {
      const path = [];
      for (let step = tile; step.previous; step = step.previous) path.push(step.move);
      return path;
    }
    for (const move of moves.values()) {
      const [da, db] = move;
      const a = tile.a + da, b = tile.b + db;
      const id = tileId(a, b);
      if (!isWalkable(a, b) || visited.has(id)) continue;
      visited.add(id);
      queue.push({ a, b, previous: tile, move });
    }
  }
  return null;
}
function clearHover() { hoveredTile = null; }
if (!preview) {
  cv.addEventListener('pointerleave', clearHover);
  cv.addEventListener('pointercancel', clearHover);
}

function drawTileBorder(tile, color) {
  if (!tile) return;
  const [a, b] = tile.map(tile => tile * TILE_SIZE);
  const corners = [
    P(a, b, 0), P(a + TILE_SIZE, b, 0),
    P(a + TILE_SIZE, b + TILE_SIZE, 0), P(a, b + TILE_SIZE, 0)
  ];
  for (let index = 0; index < corners.length; index++) {
    const [x0, y0] = corners[index];
    const [x1, y1] = corners[(index + 1) % corners.length];
    line(ctx, x0, y0, x1, y1, color);
  }
}

const movementHint = document.getElementById('movement-hint');
const defaultHint = movementHint ? movementHint.textContent : undefined;

function updateWizard(dt) {
  if (questDialogue?.open) return;
  if (seatProgress > 0 && activeSeat !== requestedSeat) {
    seatProgress = Math.max(0, seatProgress - dt / .3);
    if (!seatProgress) activeSeat = null;
    return;
  }
  if (requestedChest && !wizard.step && !route.length && nextToChest()) {
    clearRoute();
    clearHover();
    const [da, db] = [CHEST_TILE[0] - wizard.a, CHEST_TILE[1] - wizard.b];
    wizard.direction = Array.from(moves.values()).find(([a, b]) => a === da && b === db)[2];
    chestInventory.show();
    return;
  }
  if (requestedSeat && !wizard.step &&
      wizard.a === requestedSeat.approach[0] && wizard.b === requestedSeat.approach[1]) {
    activeSeat = requestedSeat;
    wizard.direction = activeSeat.direction;
    seatProgress = Math.min(1, seatProgress + dt / .4);
    return;
  }
  if (!wizard.step) {
    const key = Array.from(heldKeys).pop();
    const move = key ? moves.get(aliases[key] || key) : route.pop();
    if (!move) return;
    const [da, db, direction] = move;
    const a = wizard.a + da, b = wizard.b + db;
    wizard.direction = direction;
    if (isWalkable(a, b)) {
      if (chestInventory?.open && !nextToChest(a, b)) chestInventory.close();
      wizard.step = { a, b, elapsed: 0 };
    }
  }
  if (wizard.step) {
    wizard.step.elapsed += dt;
    if (wizard.step.elapsed >= STEP_TIME) {
      wizard.a = wizard.step.a;
      wizard.b = wizard.step.b;
      const exit = currentRoom.exits.find(({ tile }) => wizard.a === tile[0] && wizard.b === tile[1]);
      if (exit) {
        const wasStockroom = currentRoom === rooms.stockroom;
        currentRoom = rooms[exit.target];
        if (wasStockroom !== (currentRoom === rooms.stockroom)) fit();
        iceBalls.length = 0;
        castTime = 0;
        fireCharge = 0;
        librarianDialogue.hidden = true;
        [wizard.a, wizard.b] = exit.arrival;
        wizard.direction = exit.direction;
        requestedSeat = null;
        clearRoute();
        clearHover();
        heldKeys.clear();
        const hints = {
          library: 'Library · The back arch leads to the main room. The front-right arch leads to the potion room.',
          potion: 'Potion room · Click the Skeleton Mage’s floor tile to talk, or press E when beside him. The front-right arch leads to the stockroom.',
          stockroom: 'Potion stockroom · Use the left arch to return to the potion room.'
        };
        movementHint.textContent = hints[exit.target] ?? defaultHint;
      }
      wizard.step = null;
      if (!route.length) destination = null;
    }
  }
}

function drawOwl(t) {
  const [x, feet] = P(56, 2.5, 58);
  const headX = x + Math.round(Math.sin(t * .72) * 1.5);
  const headY = feet - 16 + Math.round(Math.sin(t * 1.7) * .55);
  const outline = '#263248', feather = '#e8edf0', shade = '#9cb5c9';
  ell(ctx, x - 3, feet - 3, 4, 2, outline);
  ell(ctx, x, feet - 8, 6, 8, outline);
  ell(ctx, x, feet - 8, 5, 7, shade);
  ell(ctx, x + 1, feet - 9, 4, 6, feather);
  ell(ctx, x - 2, feet - 8, 3, 5, '#c3d4df');
  for (const [dx, dy] of [[-3,-7],[-2,-5],[-4,-9],[0,-8],[1,-5]]) {
    dot(ctx, x + dx, feet + dy, '#8da6ba');
  }
  // Oorpluimen lopen schuin naar buiten en bewegen mee met de kop.
  for (const side of [-1, 1]) {
    const tip = headX + 6 * side;
    line(ctx, tip, headY - 8, headX + 3 * side, headY - 3, outline);
    line(ctx, tip - side, headY - 7, headX + 2 * side, headY - 3, feather);
    dot(ctx, tip - side, headY - 6, shade);
  }
  ell(ctx, headX, headY, 6, 5, outline);
  ell(ctx, headX, headY, 5, 4, feather);
  const blink = t % 4.7 > 4.52;
  for (const dx of [-2, 2]) {
    if (blink) rect(ctx, headX + dx - 1, headY, 3, 1, '#46536a');
    else {
      rect(ctx, headX + dx - 1, headY - 1, 3, 3, '#e7b956');
      dot(ctx, headX + dx, headY, '#11182a');
    }
  }
  dot(ctx, headX, headY + 2, '#53657a');
  rect(ctx, x - 4, feet - 1, 3, 1, '#b59256');
  rect(ctx, x + 1, feet - 1, 3, 1, '#b59256');
}

function drawDeskOrb(t) {
  const [x, y] = P(32, 26.8, 22);
  const radius = 11 + Math.sin(t * 2) * 1.5;
  const halo = ctx.createRadialGradient(x, y, 1, x, y, radius);
  halo.addColorStop(0, 'rgba(255, 244, 219, .58)');
  halo.addColorStop(1, 'rgba(255, 244, 219, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  ell(ctx, x, y, 4, 4, '#8e8490');
  ell(ctx, x, y - 1, 3, 3, '#fbf2df');
  dot(ctx, x - 1, y - 2, '#ffffff');
}

// Elk punt beschrijft de positie en de tijd tot het volgende punt.
const libraryCatRoute = [
  [12, 20, 0, 2.4], [20, 20, 0, .7], [20, 30, 15, 4.2],
  [20, 30, 15, .7], [28, 28, 0, 1.7], [28, 40, 0, 2.8],
  [28, 40, 0, 2.1], [44, 40, 0, 1.2], [52, 40, 0, 1.6],
  [52, 28, 0, .7], [44, 30, 15, 3.8], [44, 30, 15, .7],
  [44, 20, 0, 1.4], [34, 20, 0, 1.5], [8, 20, 0, 1.2],
  [8, 30, 0, .9], [2, 44, 30, 12], [2, 44, 30, .9], [8, 30, 0, 1.1]
];
const libraryCatCycle = libraryCatRoute.reduce((total, point) => total + point[3], 0);

function libraryCatLayer(t) {
  let elapsed = t % libraryCatCycle;
  let index = 0;
  while (index < libraryCatRoute.length - 1 && elapsed >= libraryCatRoute[index][3]) {
    elapsed -= libraryCatRoute[index][3];
    index++;
  }
  const [a, b, z, duration] = libraryCatRoute[index];
  const [nextA, nextB, nextZ] = libraryCatRoute[(index + 1) % libraryCatRoute.length];
  const progress = elapsed / duration;
  const jumping = z !== nextZ;
  const walking = !jumping && (a !== nextA || b !== nextB);
  const ca = a + (nextA - a) * progress, cb = b + (nextB - b) * progress;
  const lift = z + (nextZ - z) * progress + (jumping ? 9 * Math.sin(Math.PI * progress) : 0);
  const [x, y] = P(ca, cb, lift);
  const face = nextA - a >= nextB - b ? 1 : -1;
  if (!walking && !jumping && z === 30) {
    return { depth: ca + cb + 3, animate: () => {
      ell(ctx, x, y - 3, 6, 3, CAT_FUR);
      ell(ctx, x - 1, y - 4, 4, 2, CAT_LIGHT);
      ell(ctx, x + 4, y - 4, 2, 2, CAT_FUR);
      dot(ctx, x + 5, y - 4, '#74626f');
    } };
  }
  return { depth: ca + cb + (lift > 0 ? 3 : 0), animate: () => drawLibraryCat(t, x, y, face, jumping, walking, progress) };
}

// Afzet, ingetrokken poten en landing hebben elk een eigen silhouet.
const catMotionFrames = [
  [
    '.....................',
    '.....................',
    '.........oooooo......',
    '.......ooffffffoo....',
    '......oofflfffffoo...',
    '.....oofffffflfffo...',
    '....offlffffffffo....',
    '....offffffffffo.....',
    '.....oflooooflo......',
    '....oflo.....ofllo...',
    '...oooo.......oooo...'
  ],
  [
    '.....................',
    '.....................',
    '.........oooooo......',
    '.......ooffffffoo....',
    '......oofflfffffo....',
    '....offflfffflffo....',
    '.....offffffffffo....',
    '.....offffffffoo.....',
    '......offlooflo......',
    '........ooo.ooo......',
    '.....................'
  ],
  [
    '.....................',
    '.....................',
    '.........oooooo......',
    '.......ooffffffo.....',
    '......oofflfffffo....',
    '.....offoffflfffo....',
    '...offlfffffffffo....',
    '....offffffffffo.....',
    '.....oloooollo.......',
    '.....olo....olo......',
    '.....ooo....ooo......'
  ]
];
const movingCatColors = { o: CAT_FUR, f: CAT_PAW, l: CAT_LIGHT };
const LIBRARY_CAT_EYES = '#79d8ff';

function drawLibraryCat(t, x, y, face, jumping, walking, progress) {
  if (!walking && !jumping) {
    drawRestingCat(t, x, y, LIBRARY_CAT_EYES);
    return;
  }
  const gait = [0, 2, 1, 2];
  const pose = jumping ? (progress < .26 ? 0 : progress < .76 ? 1 : 2) : gait[Math.floor(t * 9) % gait.length];
  // Teken de staart achter de heup, met meer beweging aan het uiteinde.
  const tailPhase = jumping ? progress * Math.PI * 2 : t * 14;
  for (let i = 0; i < 9; i++) {
    const sway = Math.round(Math.sin(tailPhase - i * .25) * i / 4);
    const tailY = y - 4 - Math.round(i * .45) + sway;
    rect(ctx, x - face * (4 + i), tailY, 2, i < 4 ? 3 : 2, CAT_FUR);
  }
  for (const [row, pixels] of catMotionFrames[pose].entries()) {
    for (let column = 0; column < pixels.length; column++) {
      const pixel = pixels[column];
      if (pixel === '.') continue;
      dot(ctx, x + face * (column - 10), y + row - 10, movingCatColors[pixel]);
    }
  }
  drawCatHead(t, x + face * (6 - pose), y + (pose === 1 ? 2 : 3), LIBRARY_CAT_EYES);
}

const librarianStops = [
  { a: 0, b: 2, action: 'shelve', face: -1 },
  { a: 0, b: 4, action: 'shelve', face: -1 },
  { a: 0, b: 7, action: 'shelve', face: -1 },
  { a: 2, b: 0, action: 'shelve', face: 1 },
  { a: 6, b: 0, action: 'shelve', face: 1 },
  { a: 1, b: 3, action: 'read', face: 1 },
  { a: 4, b: 3, action: 'read', face: 1 },
  { a: 3, b: 6, action: 'read', face: 1 }
];
const librarian = {
  a: 0, b: 2, stop: librarianStops[0], route: [], step: null,
  elapsed: 0, dwell: 2.4
};

function updateLibrarian(dt) {
  librarian.elapsed += dt;
  if (librarian.step) {
    if (librarian.elapsed < 1) return;
    librarian.a = librarian.step.a;
    librarian.b = librarian.step.b;
    librarian.step = null;
    librarian.elapsed = 0;
  }
  if (!librarian.route.length && librarian.elapsed >= librarian.dwell) {
    const stops = librarianStops.filter(stop => stop !== librarian.stop);
    const stop = stops[Math.floor(Math.random() * stops.length)];
    const route = findRoute(librarian, stop.a, stop.b);
    if (!route?.length) {
      librarian.elapsed = 0;
      return;
    }
    librarian.stop = stop;
    librarian.route = route;
    librarian.dwell = (stop.action === 'read' ? 3 : 2) + Math.random() * 2.8;
  }
  const move = librarian.route.pop();
  if (move) {
    const [da, db] = move;
    librarian.step = { a: librarian.a + da, b: librarian.b + db };
    librarian.elapsed = 0;
  }
}

const librarianDialogue = document.getElementById('librarian-dialogue');
let librarianHit = null;
if (!preview) {
  librarianDialogue.hidden = true;
  document.getElementById('close-librarian-dialogue').addEventListener('click', () => {
    librarianDialogue.hidden = true;
  });
  addEventListener('keydown', event => {
    if (event.key === 'Escape') librarianDialogue.hidden = true;
  });
}

function librarianLayer() {
  const { a, b, step, stop, elapsed, dwell } = librarian;
  const action = step ? 'walk' : stop.action;
  const progress = step ? elapsed : Math.min(1, elapsed / dwell);
  const da = (a + .5 + (step ? (step.a - a) * progress : 0)) * TILE_SIZE;
  const db = (b + .5 + (step ? (step.b - b) * progress : 0)) * TILE_SIZE;
  const [x, y] = P(da, db, 0);
  const wa = (wizard.a + .5) * TILE_SIZE, wb = (wizard.b + .5) * TILE_SIZE;
  const watching = !librarianDialogue.hidden || Math.hypot(wa - da, wb - db) < 14;
  const face = watching ? Math.sign(wa - wb - da + db) || 1
    : step ? Math.sign(step.a - a - step.b + b) || 1 : stop.face;
  librarianHit = [x, y];
  return { depth: da + db, animate: () => drawLibrarian(x, y, face, action, progress, watching, stop.face) };
}

function drawLibrarian(x, y, face, action, progress, watching, shelfSide) {
  const stride = action === 'walk' ? Math.round(Math.sin(progress * Math.PI * 6)) : 0;
  const head = y - (action === 'read' && !watching ? 23 : 25);
  const ink = '#272334', robe = '#537460', trim = '#ac9868';
  ell(ctx, x, y, 6, 2, '#49392e');
  rect(ctx, x - 4 + stride, y - 3, 3, 3, ink);
  rect(ctx, x + 1 - stride, y - 3, 3, 3, ink);
  for (let row = 0; row < 16; row++) {
    const half = row > 10 ? 6 : 5;
    rect(ctx, x - half, y - 19 + row, half * 2 + 1, 1, ink);
    rect(ctx, x - half + 1, y - 19 + row, half * 2 - 1, 1, robe);
    dot(ctx, x - 2, y - 19 + row, '#698875');
  }
  // Schoudermantel met donkere plooien en geborduurde randen.
  for (let row = 0; row < 11; row++) {
    const half = row < 3 ? 5 + row : 7;
    const yy = y - 21 + row;
    rect(ctx, x - half, yy, half * 2 + 1, 1, ink);
    rect(ctx, x - half + 1, yy, half * 2 - 1, 1, '#39564d');
    dot(ctx, x - half + 1, yy, trim);
    dot(ctx, x + half - 1, yy, '#7d7155');
    dot(ctx, x - 3 + Math.floor(row / 4), yy, '#60816d');
  }
  rect(ctx, x - 4, y - 8, 9, 1, '#334840');
  rect(ctx, x - 2, y - 17, 5, 1, trim);
  dot(ctx, x, y - 16, '#d2b878');
  rect(ctx, x - 4, y - 5, 9, 1, '#998656');

  ell(ctx, x, head, 6, 6, ink);
  ell(ctx, x + face, head, 4, 5, '#d8aa89');
  rect(ctx, x - 4 * face - 1, head - 3, 2, 7, '#b6adb6');
  dot(ctx, x - 4 * face, head + 2, '#e7dfe2');
  const eye = x + 2 * face;
  rect(ctx, eye - 2, head - 1, 4, 3, '#66544b');
  rect(ctx, eye - 1, head, 2, 1, '#c5e7e4');
  dot(ctx, x + 5 * face, head + 1, '#d8aa89');
  dot(ctx, x + 3 * face, head + 3, '#9d695e');

  // De rand loopt over de haarlijn; de kroon sluit direct op de rand aan.
  const brim = head - 4;
  for (let row = 0; row < 11; row++) {
    const half = Math.min(5, Math.floor(row / 2) + 1);
    const tip = x - face * Math.max(0, 3 - Math.floor(row / 2));
    const yy = brim - 11 + row;
    rect(ctx, tip - half, yy, half * 2 + 1, 1, ink);
    if (row > 0) rect(ctx, tip - half + 1, yy, half * 2 - 1, 1, '#466657');
    if (row > 2) dot(ctx, tip - half + 1, yy, '#71917a');
    if (row > 5) dot(ctx, tip + half - 1, yy, '#30463e');
  }
  rect(ctx, x - 5, brim - 2, 11, 2, '#887451');
  rect(ctx, x + face * 3 - 1, brim - 2, 3, 2, '#d9b46c');
  dot(ctx, x + face * 3, brim - 1, '#65513d');
  rect(ctx, x - 7, brim, 15, 2, ink);
  rect(ctx, x - 6, brim, 13, 1, '#6b8a76');
  rect(ctx, x - 4, brim + 2, 9, 1, '#987767');

  // Sluiting en goudsteken langs de zoom.
  dot(ctx, x, y - 17, '#f0d59b');
  dot(ctx, x + 1, y - 16, '#806249');
  for (const dx of [-4, -2, 0, 2, 4]) dot(ctx, x + dx, y - 5, '#c0a577');

  if (action === 'shelve' && !watching) {
    const raise = Math.min(1, progress * 1.8);
    const hand = y - 12 - Math.round(12 * raise);
    line(ctx, x + shelfSide * 4, y - 16, x + shelfSide * 8, hand, robe);
    if (progress < .76) drawLibrarianBook(x + shelfSide * 9, hand - 2, shelfSide);
    dot(ctx, x + shelfSide * 8, hand, '#d8aa89');
  } else if (action === 'walk') {
    const handX = x + face * 4, handY = y - 13 + stride;
    drawLibrarianBook(handX, handY - 1, face);
    dot(ctx, handX, handY + 2, '#dac292');
  }
}

function drawLibrarianBook(x, y, face) {
  rect(ctx, x - 3, y - 4, 7, 8, '#32202c');
  rect(ctx, x - 2, y - 3, 5, 5, '#88514b');
  rect(ctx, x - 2, y + 2, 5, 1, '#e3d0aa');
  const spine = x - face * 2;
  rect(ctx, spine, y - 3, 1, 5, '#b7755a');
  dot(ctx, spine + face * 2, y - 2, '#d2a96b');
}

const dittoPixels = [
  '.......ooo..........',
  '......ohhho.ooo.....',
  '......ohppooohho....',
  '..oo.ohpppppppppo...',
  '.ohhoopppppppppppo..',
  '.ohppppppppppppppooo',
  '.oppppppppppppppphpo',
  '..oppppppppppppppppo',
  '...oppppppppppppppo.',
  '...opppppppppppppo..',
  '..opppppppppppppso..',
  '..osppppppppppppsso.',
  '.ossssppppppppsssso.',
  '.osssssssssssssssso.',
  '..oossssssssssssoo..',
  '....ooooossooooo....',
  '.........oo.........'
];
const dittoColors = { o: '#33243c', h: '#f0c9ec', p: '#ce97d9', s: '#a36cad' };
const libraryDitto = { depth: 107, animate: drawLibraryDitto };

function drawLibraryDitto(t) {
  const [x, y] = P(58, 49, 0);
  const jump = Math.min(1, Math.max(0, (t % 6.4 - 5.65) / .6));
  const lift = Math.sin(Math.PI * jump);
  const wobble = Math.sin(t * 3.2);
  const top = y - dittoPixels.length - Math.round(5 * lift);
  ell(ctx, x, y, Math.round(6 - lift * 2), 2, '#3e4738');
  for (const [row, pixels] of dittoPixels.entries()) {
    const sway = Math.round(wobble * (dittoPixels.length - 1 - row) / 14);
    for (let column = 0; column < pixels.length; column++) {
      const color = dittoColors[pixels[column]];
      if (color) dot(ctx, x - 10 + column + sway, top + row, color);
    }
  }
  const faceX = x + Math.round(wobble * 9 / 14);
  dot(ctx, faceX - 3, top + 6, dittoColors.o);
  dot(ctx, faceX + 3, top + 6, dittoColors.o);
  dot(ctx, faceX - 2, top + 9, '#79527e');
  rect(ctx, faceX - 1, top + 9, 3, 1, dittoColors.o);
  dot(ctx, faceX + 2, top + 8, '#79527e');
}

function drawRoomOccupants(t, dt) {
  const step = wizard.step;
  const progress = step ? step.elapsed / STEP_TIME : 0;
  const a = (wizard.a + (step ? (step.a - wizard.a) * progress : 0) + .5) * TILE_SIZE;
  const b = (wizard.b + (step ? (step.b - wizard.b) * progress : 0) + .5) * TILE_SIZE;
  const [x, y] = P(a, b, 0);
  const roomFurnishings = currentRoom === rooms.library
    ? [...libraryFurnishings, libraryCatLayer(t), librarianLayer(), libraryDitto].sort((left, right) => left.depth - right.depth)
    : currentRoom === rooms.tower ? furnishings
      : currentRoom === rooms.potion ? potionFurnishings : stockFurnishings;
  const occupants = [...roomFurnishings, ...iceBallLayers(), ...fireBreathLayers(t, a, b, dt)].sort((left, right) => left.depth - right.depth);
  let index = 0;
  for (; index < occupants.length && occupants[index].depth <= a + b; index++) {
    drawFurnishing(occupants[index], t, dt);
  }
  if (!preview && !seatProgress) WIZARD.draw(ctx, wizard.direction, step ? 'walk' : 'idle', step ? step.elapsed : t, x, y, castStrength());
  for (; index < occupants.length; index++) drawFurnishing(occupants[index], t, dt);
}

function drawSeatedWizard(t, seat) {
  if (seat !== activeSeat || !seatProgress) return;
  const ease = seatProgress ** 2 * (3 - 2 * seatProgress);
  const [x, y] = P((seat.approach[0] + .5) * TILE_SIZE, (seat.approach[1] + .5) * TILE_SIZE, 0);
  const [sx, sy] = P((seat.tile[0] + .5) * TILE_SIZE, (seat.tile[1] + .5) * TILE_SIZE + (seat.offsetB ?? -1), seat.height);
  const px = Math.round(x + (sx - x) * ease);
  const py = Math.round(y + (sy - y) * ease);
  const settling = seatProgress < .75;
  const frame = WIZARD.canvas(seat.direction, 'idle', t, settling && WIZARD.staffEquipped);
  const head = 23;
  const torso = Math.round(WIZARD.CH - head - 11 * ease);
  const left = px - WIZARD.FX;
  const top = py - head - torso + 5;
  ctx.drawImage(frame, 0, 0, WIZARD.CW, head, left, top, WIZARD.CW, head);
  if (settling) {
    ctx.drawImage(frame, 0, head, WIZARD.CW, WIZARD.CH - head,
      left, top + head, WIZARD.CW, torso);
    return;
  }

  const mirror = seat.direction.endsWith('w');
  ctx.save();
  if (mirror) {
    ctx.translate(px * 2, 0);
    ctx.scale(-1, 1);
  }
  const collar = top + head;
  // De cape volgt de schouders en vouwt over de gebogen benen.
  const folds = [
    [-5, 5], [-6, 6], [-6, 6], [-6, 6], [-5, 7], [-5, 8],
    [-4, 9], [-3, 9], [-2, 8], [0, 7]
  ];
  for (const [row, [start, end]] of folds.entries()) {
    const yy = collar + row;
    rect(ctx, px + start, yy, end - start + 1, 1, '#30283e');
    rect(ctx, px + start + 1, yy, end - start - 1, 1, '#554a66');
    dot(ctx, px + start + 2, yy, '#80728f');
    dot(ctx, px + Math.floor(row / 2), yy, '#3f354e');
    if (row >= 6) dot(ctx, px + end - 1, yy, '#736381');
  }
  rect(ctx, px + 6, collar + 9, 4, 2, '#282135');
  dot(ctx, px + 8, collar + 9, '#49405c');
  if (WIZARD.staffEquipped) {
    if (castTime > 0) {
      WIZARD.drawCastingPose(ctx, seat.direction[0] + 'e', px, py, castStrength(), true);
    } else {
      WIZARD.drawSeatedStaff(ctx, px + 3, top + 1);
    }
  }
  ctx.restore();
}

function drawFurnishing({ canvas, animate }, t, dt) {
  if (canvas) ctx.drawImage(canvas, 0, 0);
  if (animate) animate(t, dt);
}

let last = 0;
function frame(ms) {
  const t = ms / 1000, dt = Math.min(.1, last ? t - last : .016); last = t;
  updateWizard(dt);
  fireCharge = canBreatheFire() ? Math.min(1, fireCharge + dt * 7) : 0;
  ctx.clearRect(0, 0, W, H);
  if (!preview && !chestInventory?.open && librarianDialogue.hidden) updateIceBalls(dt);
  if (currentRoom === rooms.tower) drawSky();
  ctx.drawImage(currentRoom.canvas, 0, 0);
  if (currentRoom === rooms.potion) {
    drawRackBubbles(t);
    ctx.drawImage(rackGlass, 0, 0);
  }
  drawTileBorder(hoveredTile, '#ffe083');
  drawTileBorder(destination, '#9dffdb');
  if (currentRoom !== rooms.tower) {
    if (currentRoom === rooms.library) {
      if (librarianDialogue.hidden) updateLibrarian(dt);
      drawLibraryPortrait(t);
      drawLibraryLights(t);
    } else if (currentRoom === rooms.potion) {
      drawPotionLight(t);
    }
    drawRoomOccupants(t, dt);
    // De voorste muur staat vóór de meubels en personages op de vloer.
    if (currentRoom.foreground) ctx.drawImage(currentRoom.foreground, 0, 0);
    if (currentRoom === rooms.potion) drawQuestMarker(t);
    requestAnimationFrame(frame);
    return;
  }
  banner(t, 7, 12, 0); banner(t, 65, 12, 1.7); banner(t, 105, 14, 3);
  drawPortrait(t);
  drawFire(t, dt);
  drawRoomOccupants(t, dt);
  const n = (Math.sin(t * 9) + Math.sin(t * 13.7) + Math.sin(t * 5.3)) / 3;
  const [gx, gy] = P(21, 6, 14);
  glow(gx, gy, 80, 56, '255,166,75', .052 + .015 * n);
  for (const [x, y] of cand) glow(x, y + 4, 22, 16, '255,200,120', .03);
  if (preview && cv.hidden) {
    cv.hidden = false;
    cv.previousElementSibling.hidden = true;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (preview) return;

/* ---------- zoom ---------- */
const sceneView = document.getElementById('scene-view');
const zoomOut = document.getElementById('zoom-out');
const zoomIn = document.getElementById('zoom-in');
const zoomReset = document.getElementById('zoom-reset');
const MIN_ZOOM = 75, MAX_ZOOM = 200, ZOOM_STEP = 25;
let zoom = 150;

function fit() {
  clearHover();
  const center = (offset, total, visible) => visible < total ? (offset + visible / 2) / total : .5;
  const x = center(sceneView.scrollLeft, sceneView.scrollWidth, sceneView.clientWidth);
  const y = center(sceneView.scrollTop, sceneView.scrollHeight, sceneView.clientHeight);
  const availableHeight = Math.min(innerHeight * .7, Math.max(140, innerHeight - 230));
  const stockroom = currentRoom === rooms.stockroom;
  const viewWidth = stockroom ? W : 4 * (N + T) + 10;
  const viewHeight = stockroom ? H : CY + 2 * N + F + 12;
  const scale = Math.min(sceneView.offsetWidth / viewWidth, availableHeight / viewHeight) * zoom / 100;
  cv.style.width = W * scale + 'px';
  cv.style.height = H * scale + 'px';
  sceneView.scrollLeft = sceneView.scrollWidth * x - sceneView.clientWidth / 2;
  sceneView.scrollTop = sceneView.scrollHeight * y - sceneView.clientHeight / 2;
  zoomOut.disabled = zoom === MIN_ZOOM;
  zoomIn.disabled = zoom === MAX_ZOOM;
  zoomReset.textContent = zoom + '%';
  zoomReset.setAttribute('aria-label', 'Zoom ' + zoom + ' percent. Reset to 100 percent.');
}
function setZoom(value) {
  zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
  fit();
}
zoomOut.addEventListener('click', () => setZoom(zoom - ZOOM_STEP));
zoomIn.addEventListener('click', () => setZoom(zoom + ZOOM_STEP));
zoomReset.addEventListener('click', () => setZoom(100));
sceneView.addEventListener('scroll', clearHover, { passive: true });
addEventListener('resize', fit); fit();

})();
