/* De Toren van de Tovenaar — proof of concept
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
const T = 20;     // muurdikte
const WH = 104;   // muurhoogte
const F = 56;     // dikte onderbouw
const W = 4 * (N + T) + 10, CX = W / 2, CY = 162;
const H = CY + 2 * N + F + 12;

const cv = document.getElementById('scene');
cv.width = W; cv.height = H;
const ctx = cv.getContext('2d');
const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
const statC = mk(), secondC = mk();

const P = (a, b, z) => [CX + 2 * (a - b), CY + a + b - z];

/* ---------- helpers ---------- */
function hash(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const _sh = new Map();
function sh(hex, f) {
  const k = hex + '|' + f;
  if (_sh.has(k)) return _sh.get(k);
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * f), g = Math.min(255, ((n >> 8) & 255) * f), b = Math.min(255, (n & 255) * f);
  const s = 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  _sh.set(k, s); return s;
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
function floorFn(a, b) {
  if (a >= 12 && a < 30 && b >= 4 && b < 40) {                 // tapijt
    const la = a - 12, lb = b - 4;
    if (b >= 38.8) return (Math.floor(la * 1.5) & 1) ? '#e8d9a0' : '#bda86a';      // franje
    if (la < 1.2 || la > 16.8) return '#5b1221';
    if (la < 2 || la > 16) return '#d6a83c';
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
  return sh('#6c4d3a', tone * edge);
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
function facadeFn(br) {
  return (u, z) => {
    if (u >= 0 && z >= 0) return null;
    if (u >= 0) {
      const r = arch(Math.abs(u - N + .5), z + .5);
      if (r === 2) return z > -22 ? '#10132b' : '#171b38';
      if (r === 1) return ((Math.floor(Math.abs(u - N) / 3) + Math.floor((z + 60) / 3)) & 1) ? '#7a9cca' : '#6684b6';
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
  return brL(u, z);
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
  return brR(u, z);
}

function drawPassage(g, rear) {
  const center = EXIT_CENTER * 2;
  box(g, EXIT_CENTER - 7, rear ? 0 : N - 7, 0, 14, 7, 1, flat('#62678f', '#3d4166', '#464b70'));
  wallR(g, rear ? 0 : N, center - 17, center + 18, 0, 49, (u, z) => {
    const dx = u - center;
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
  });
}

/* ---------- bibliotheek ---------- */
// Een bank kan meerdere zitplekken in hetzelfde meubel registreren.
const armchairSeat = { tile: [2, 2], approach: [2, 1], direction: 'ne', height: 7, hit: [13, 25] };
const librarySeats = [
  { tile: [2, 4], approach: [1, 4], direction: 'ne', height: 7, hit: [9, 16] },
  { tile: [5, 4], approach: [6, 4], direction: 'ne', height: 7, hit: [9, 16] },
  { tile: [4, 7], approach: [3, 7], direction: 'ne', height: 7, hit: [9, 16] }
];

const libraryLayout = [
  [2, 3, 'desk'], [2, 4, 'chair'], [5, 3, 'desk'], [5, 4, 'chair'],
  [4, 6, 'desk'], [4, 7, 'chair'], [1, 6, 'plant'], [7, 1, 'plant']
];
const leftShelfRanges = [[4, 64], [66, 124]];
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
    const da = (a - (column + .5) * TILE_SIZE - 1) / radius;
    const db = (b - (row + .5) * TILE_SIZE - 1.5) / radius;
    const distance = da * da + db * db;
    if (distance < 1) shade = Math.min(shade, distance < .55 ? .62 : .8);
  }
  return shade === 1 ? color : sh(color, shade);
}

function libraryFloor(a, b) {
  if (a >= 9 && a < 58 && b >= 15 && b < 58) {
    const edge = Math.min(a - 9, 58 - a, b - 15, 58 - b);
    if (edge < .8 || (edge > 1.8 && edge < 2.7)) return '#bea875';
    if (edge < 4) return '#485b48';
    const pattern = Math.abs(a - 33.5) + Math.abs(b - 36.5);
    return Math.abs(pattern - 13) < .85 ? '#899474' : '#607451';
  }
  const plank = Math.floor(a / 5);
  if (a % 5 < .5 || (b + plank * 6) % 16 < .5) return '#4c342b';
  return hash(plank, Math.floor((b + plank * 6) / 16)) > .5 ? '#80583f' : '#744e39';
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

function drawLibraryShelves(g) {
  const depth = 3, height = 87;
  const timber = flat('#916447', '#603d30', '#51332b');
  for (const [start, end] of leftShelfRanges) {
    box(g, 0, start / 2, 0, depth, (end - start) / 2, height, timber);
    wallL(g, depth, start, end, 0, height, libraryShelf(start, end, 37));
  }
  for (const [start, end] of rightShelfRanges) {
    box(g, start / 2, 0, 0, (end - start) / 2, depth, height, timber);
    wallR(g, depth, start, end, 0, height, libraryShelf(start, end, null));
  }
}

function buildStatic(sg, library = false) {
  topFace(sg, 0, 0, N, 0, N, library ? shadedLibraryFloor : floorFn);
  wallL(sg, 0, 0, 2 * N, 0, WH, library ? brL : leftFn);
  wallR(sg, 0, 0, 2 * N, 0, WH, library ? brR : rightFn);
  topFace(sg, WH, -T, N, -T, 0, copingFn);
  topFace(sg, WH, -T, 0, 0, N, copingFn);
  const mer = { top: copingFn, left: (u, z) => brOutL(u, z), right: (u, z) => brOutR(u, z) };
  box(sg, -T, -T, WH, T, T, 12, mer);
  box(sg, -T, N - 8, WH, T, 8, 10, mer);
  box(sg, N - 8, -T, WH, 8, T, 10, mer);
  wallR(sg, N, -2 * T, 2 * N, -F, WH, facadeFn(brOutL));
  wallL(sg, N, -2 * T, 2 * N, -F, WH, facadeFn(brOutR));
  if (library) drawLibraryShelves(sg);
  drawPassage(sg, library);
}

/* ---------- meubels ---------- */
const furnishings = [];
const flasks = [];
function flask(g, x, y, liq, type) {
  if (type === 'tube') {
    rect(g, x - 1, y - 9, 3, 9, '#cfe8ff'); rect(g, x - 1, y - 7, 3, 7, liq); dot(g, x, y - 5, sh(liq, 1.4)); rect(g, x - 1, y - 10, 3, 1, '#a8703a');
  } else {
    ell(g, x, y - 4, 4, 4, '#cfe8ff'); ell(g, x, y - 4, 3, 3, liq);
    dot(g, x - 2, y - 6, '#ffffff'); dot(g, x - 1, y - 7, '#ffffff');
    rect(g, x - 1, y - 11, 3, 4, '#cfe8ff'); rect(g, x - 1, y - 9, 3, 2, liq); rect(g, x - 1, y - 12, 3, 1, '#a8703a');
  }
  flasks.push({ x, y, liq });
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
  box(g, 10.5, 0, 48, 1.6, 2.5, 4, woodD); box(g, 29.5, 0, 48, 1.6, 2.5, 4, woodD);

  // ijzeren haardscherm
  for (let a = 11; a <= 30; a += 2) { box(g, a, 3.5, 2, .8, .8, 9, iron); dot(g, CX + 2 * (a - 3.1), CY + a + 3.5 - 12, '#6a6a7e'); }
  box(g, 10.6, 3.5, 7, 20.6, .8, .8, iron);
  box(g, 10.6, 0, 7, .8, 3.5, .8, iron); box(g, 31, 0, 7, .8, 3.5, .8, iron);

  store(26);

  // Fauteuil tegenover de haard, met een vrije tegel tussen stoel en haard.
  const seatA = 16.5, seatB = 16.5;
  const upholstery = flat('#75917f', '#3a5349', '#4b695b');
  const cushion = flat('#8fa995', '#526e60', '#638272');
  const chairPart = (a, b, z, da, db, dz, material) =>
    box(g, seatA + a, seatB + b, z, da, db, dz, material);
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
  store(seatA + seatB + 7);

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
  { const [bx, by] = P(36.5, 5, 0); KN = [bx, by];
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

  store(41.5, t => {
    if ((t % 7) > 6.4) rect(ctx, KN[0] - 3, KN[1] - 33, 6, 1, '#ff3a3a');
  });

  // groen boek op de grond
  box(g, 11, 33, 0, 6, 5, 3, flat('#2f7a3a', '#e8dcb0', '#17481f'));

  store(47);

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

for (const [canvas, empty] of [[statC, false], [secondC, true]]) {
  const background = canvas.getContext('2d');
  buildStatic(background, empty);
  outline(background, '#14183a');
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
    box(g, a - 3.5, b - 3.5, 13, 7, 7, 2, wood);
    const pages = flat('#f0ddb1', '#a78057', '#c2a67c');
    box(g, a - 2.4, b - 1.5, 15, 2, 3.4, 1, pages);
    box(g, a - .25, b - 1.5, 15, 2, 3.4, 1, pages);
    const [x, y] = P(a + 2, b - 2, 15);
    rect(g, x - 2, y - 4, 4, 4, '#608d88');
    ell(g, x, y - 4, 2, 1, '#352930');
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
  return { canvas, depth: a + b, animate: seat ? t => drawSeatedWizard(t, seat) : null };
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
    glow(x, y, 20, 19, '255,200,109', .1 + .015 * Math.sin(t * 1.4 + a));
    ell(ctx, x, y, 6, 6, '#d7a866');
    ell(ctx, x, y - 1, 4, 4, '#fff0bc');
    rect(ctx, x - 2, y - 8, 4, 3, '#966540');
  }
}

/* ---------- animaties ---------- */
// hemel in het raam
const stars = [];
for (let i = 0; i < 26; i++) stars.push({ u: 25 + Math.floor(hash(i, 1) * 37), z: 62 + Math.floor(hash(i, 2) * 26), p: hash(i, 3) * 6.28, big: i % 6 === 0 });
const skyBands = ['#27386e', '#202f62', '#1a2755', '#141e48', '#0e1639'];
function skyPx(u, z, c) { if (u >= 24 && u < 64 && z >= 60 && z < 90) pxL(ctx, u, z, c); }
function drawSky(t) {
  wallL(ctx, 0, 24, 64, 60, 90, (u, z) => skyBands[Math.min(4, Math.floor((z - 60) / 6))]);
  for (const s of stars) {
    const v = Math.sin(t * 2.2 + s.p);
    const c = v > .35 ? '#ffffff' : v > -.4 ? '#8aa0ff' : '#4a5a9a';
    skyPx(s.u, s.z, c);
    if (s.big && v > .35) { skyPx(s.u - 1, s.z, '#8aa0ff'); skyPx(s.u + 1, s.z, '#8aa0ff'); skyPx(s.u, s.z - 1, '#8aa0ff'); skyPx(s.u, s.z + 1, '#8aa0ff'); }
  }
  for (let du = -4; du <= 4; du++) for (let dz = -4; dz <= 4; dz++) {      // maan
    if (du * du + dz * dz <= 16 && (du - 2) * (du - 2) + (dz - 1) * (dz - 1) > 11) skyPx(55 + du, 80 + dz, '#f4e9b0');
  }
  // vleermuis
  const ub = 20 + ((t * 7) % 55), zb = Math.round(72 + Math.sin(t * 3) * 6), up = (Math.floor(t * 8) & 1) === 0;
  const bu = Math.round(ub), k = '#04050c';
  skyPx(bu, zb, k); skyPx(bu + 1, zb, k);
  if (up) { skyPx(bu - 1, zb + 1, k); skyPx(bu - 2, zb + 2, k); skyPx(bu + 2, zb + 1, k); skyPx(bu + 3, zb + 2, k); skyPx(bu - 2, zb + 1, k); skyPx(bu + 3, zb + 1, k); }
  else { skyPx(bu - 1, zb - 1, k); skyPx(bu - 2, zb - 1, k); skyPx(bu + 2, zb - 1, k); skyPx(bu + 3, zb - 1, k); skyPx(bu - 3, zb - 2, k); skyPx(bu + 4, zb - 2, k); }
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
  const [bx, by] = P(...position), k = CAT_FUR, k2 = CAT_LIGHT;
  if (progress > 0) {
    drawJumpingCat(bx, by, to[1] > from[1] ? -1 : 1, progress);
    return;
  }
  // staart
  for (let i = 0; i < 10; i++) { const x = bx + 5 + i * .8, y = by - 2 - Math.sin(i * .45 + t * 2.4) * (1 + i * .25); rect(ctx, x, y, 2, 2, k); }
  ell(ctx, bx, by - 5, 5, 5, k);
  ell(ctx, bx + 2, by - 6, 2, 3, k2);
  for (const offset of [-2, 2]) {
    ell(ctx, bx + offset, by - 2, 1, 2, CAT_PAW);
    ell(ctx, bx + offset, by - 1, 2, 1, CAT_PAW);
    dot(ctx, bx + offset, by - 1, k2);
  }
  rect(ctx, bx - 4, by - 16, 8, 7, k);                      // kop
  rect(ctx, bx - 4, by - 18, 2, 2, k); rect(ctx, bx + 2, by - 18, 2, 2, k);
  rect(ctx, bx - 4, by - 16, 8, 1, k2);
  dot(ctx, bx - 3, by - 17, '#a65b73'); dot(ctx, bx + 3, by - 17, '#a65b73');
  const blink = (t % 4.6) > 4.45;
  if (blink) { rect(ctx, bx - 3, by - 13, 2, 1, '#3a3a50'); rect(ctx, bx + 1, by - 13, 2, 1, '#3a3a50'); }
  else { rect(ctx, bx - 3, by - 14, 2, 2, '#ffd23a'); rect(ctx, bx + 1, by - 14, 2, 2, '#ffd23a'); dot(ctx, bx - 2, by - 14, '#111'); dot(ctx, bx + 2, by - 14, '#111'); }
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
  const [a, b] = CHEST_TILE;
  const nearby = Math.abs(wizard.a - a) + Math.abs(wizard.b - b) === 1;
  chestOpening = Math.max(0, Math.min(1, chestOpening + (nearby ? dt : -dt) * 2.2));
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

function drawFlaskGlints(t) {
  for (let i = 0; i < flasks.length; i++) {
    const f = flasks[i];
    ctx.globalAlpha = .85;
    for (let k = 0; k < 2; k++) dot(ctx, f.x + (k ? 1 : -1), f.y - 2 - ((t * 4 + i * 1.7 + k * 2.3) % 5), '#f4fff8');
    ctx.globalAlpha = 1;
  }
}

/* ---------- speelbare tovenaar ---------- */
const STEP_TIME = WIZARD.FRAMES.walk / WIZARD.FPS.walk;
// Rijen lopen over b, kolommen over a. X staat voor een meubel of de haard.
const towerFloor = [
  '.XXXX.X.',
  '........',
  '..X.....',
  '........',
  'XX......',
  '.....XX.',
  'X.......',
  '........'
];
const libraryFloorMap = Array.from({ length: ROOM_TILES }, () => Array(ROOM_TILES).fill('.'));
for (const [a, b] of libraryLayout) libraryFloorMap[b][a] = 'X';
let inSecondRoom = false;
const currentFloor = () => inSecondRoom ? libraryFloorMap : towerFloor;
const wizard = { a: 4, b: 4, direction: 'se', step: null };
const moves = new Map([
  ['arrowup', [0, -1, 'ne']], ['arrowright', [1, 0, 'se']],
  ['arrowdown', [0, 1, 'sw']], ['arrowleft', [-1, 0, 'nw']]
]);
const aliases = { w: 'arrowup', d: 'arrowright', s: 'arrowdown', a: 'arrowleft' };
const heldKeys = new Set();
let requestedSeat = null, activeSeat = null;
let seatProgress = 0;
let route = [];
let destination = null;
const isWalkable = (a, b) => currentFloor()[b]?.[a] === '.';

function clearRoute() {
  route = [];
  destination = null;
}

addEventListener('keydown', event => {
  const key = event.key.toLowerCase();
  if (!moves.has(aliases[key] || key) || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey ||
      event.target.closest?.('input, textarea, select, [contenteditable]')) return;
  event.preventDefault();
  clearRoute();
  requestedSeat = null;
  heldKeys.add(key);
});
addEventListener('keyup', event => heldKeys.delete(event.key.toLowerCase()));
addEventListener('blur', () => heldKeys.clear());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) heldKeys.clear();
});

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

cv.addEventListener('pointermove', event => {
  if (event.pointerType !== 'touch') hoveredTile = tileAtPointer(event);
});
cv.addEventListener('click', event => {
  const [px, py] = pointerPosition(event);
  const seats = inSecondRoom ? librarySeats : [armchairSeat];
  const seat = seats.find(({ tile, hit }) => {
    const [x, y] = P((tile[0] + .5) * TILE_SIZE, (tile[1] + .5) * TILE_SIZE, 0);
    return Math.abs(px + CX - x) <= hit[0] && py + CY >= y - hit[1] && py + CY <= y + 3;
  });
  if (seat && seat === requestedSeat) {
    requestedSeat = null;
    clearRoute();
    return;
  }
  const tile = seat ? seat.approach : tileAtPointer(event);
  if (!tile || !isWalkable(...tile)) return;
  const start = wizard.step ?? wizard;
  const nextRoute = findRoute(start, ...tile);
  if (!nextRoute) return;
  heldKeys.clear();
  requestedSeat = seat ?? null;
  route = nextRoute;
  destination = route.length ? tile : null;
});

// Doorzoek de vloer vanaf de eerstvolgende vaste positie, één tegel per stap.
function findRoute(start, targetA, targetB) {
  const queue = [{ a: start.a, b: start.b, previous: null }];
  const tileId = (a, b) => b * ROOM_TILES + a;
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
cv.addEventListener('pointerleave', clearHover);
cv.addEventListener('pointercancel', clearHover);

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
const defaultHint = movementHint.textContent;

function updateWizard(dt) {
  if (seatProgress > 0 && activeSeat !== requestedSeat) {
    seatProgress = Math.max(0, seatProgress - dt / .3);
    if (!seatProgress) activeSeat = null;
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
    if (isWalkable(a, b)) wizard.step = { a, b, elapsed: 0 };
  }
  if (wizard.step) {
    wizard.step.elapsed += dt;
    if (wizard.step.elapsed >= STEP_TIME) {
      wizard.a = wizard.step.a;
      wizard.b = wizard.step.b;
      if (wizard.a === EXIT_COLUMN && wizard.b === (inSecondRoom ? 0 : ROOM_TILES - 1)) {
        inSecondRoom = !inSecondRoom;
        wizard.b = inSecondRoom ? 1 : ROOM_TILES - 2;
        wizard.direction = inSecondRoom ? 'sw' : 'ne';
        requestedSeat = null;
        clearRoute();
        clearHover();
        heldKeys.clear();
        movementHint.textContent = inSecondRoom
          ? 'Bibliotheek · Klik op een stoel om te zitten of loop naar de boog om terug te gaan.'
          : defaultHint;
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

function drawRoomOccupants(t, dt) {
  const step = wizard.step;
  const progress = step ? step.elapsed / STEP_TIME : 0;
  const a = (wizard.a + (step ? (step.a - wizard.a) * progress : 0) + .5) * TILE_SIZE;
  const b = (wizard.b + (step ? (step.b - wizard.b) * progress : 0) + .5) * TILE_SIZE;
  const [x, y] = P(a, b, 0);
  const roomFurnishings = inSecondRoom ? libraryFurnishings : furnishings;
  let index = 0;
  for (; index < roomFurnishings.length && roomFurnishings[index].depth <= a + b; index++) {
    drawFurnishing(roomFurnishings[index], t, dt);
  }
  if (!seatProgress) WIZARD.draw(ctx, wizard.direction, step ? 'walk' : 'idle', step ? step.elapsed : t, x, y);
  for (; index < roomFurnishings.length; index++) drawFurnishing(roomFurnishings[index], t, dt);
}

function drawSeatedWizard(t, seat) {
  if (seat !== activeSeat || !seatProgress) return;
  const ease = seatProgress ** 2 * (3 - 2 * seatProgress);
  const [x, y] = P((seat.approach[0] + .5) * TILE_SIZE, (seat.approach[1] + .5) * TILE_SIZE, 0);
  const [sx, sy] = P((seat.tile[0] + .5) * TILE_SIZE, (seat.tile[1] + .5) * TILE_SIZE - 1, seat.height);
  const px = Math.round(x + (sx - x) * ease);
  const py = Math.round(y + (sy - y) * ease);
  const frame = WIZARD.canvas(seat.direction, 'idle', t);
  const head = 23;
  const torso = Math.round(WIZARD.CH - head - 11 * ease);
  const left = px - WIZARD.FX;
  const top = py - head - torso + 5;
  ctx.drawImage(frame, 0, 0, WIZARD.CW, head, left, top, WIZARD.CW, head);
  if (seatProgress < .75) {
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
  rect(ctx, px + 8, collar, 1, 9, '#a06a3a');
  ctx.restore();
}

function drawFurnishing({ canvas, animate }, t, dt) {
  ctx.drawImage(canvas, 0, 0);
  if (animate) animate(t, dt);
}

let last = 0;
function frame(ms) {
  const t = ms / 1000, dt = Math.min(.1, last ? t - last : .016); last = t;
  ctx.clearRect(0, 0, W, H);
  updateWizard(dt);
  if (!inSecondRoom) drawSky(t);
  ctx.drawImage(inSecondRoom ? secondC : statC, 0, 0);
  drawTileBorder(hoveredTile, '#ffe083');
  drawTileBorder(destination, '#9dffdb');
  if (inSecondRoom) {
    drawLibraryPortrait(t);
    drawLibraryLights(t);
    drawRoomOccupants(t, dt);
    requestAnimationFrame(frame);
    return;
  }
  banner(t, 7, 12, 0); banner(t, 65, 12, 1.7); banner(t, 105, 14, 3);
  drawPortrait(t);
  drawFire(t, dt);
  drawRoomOccupants(t, dt);
  const n = (Math.sin(t * 9) + Math.sin(t * 13.7) + Math.sin(t * 5.3)) / 3;
  const [gx, gy] = P(21, 6, 14);
  glow(gx, gy, 80, 56, '255,150,50', .045 + .015 * n);
  for (const [x, y] of cand) glow(x, y + 4, 22, 16, '255,200,120', .03);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ---------- zoom ---------- */
const sceneView = document.getElementById('scene-view');
const zoomOut = document.getElementById('zoom-out');
const zoomIn = document.getElementById('zoom-in');
const zoomReset = document.getElementById('zoom-reset');
const MIN_ZOOM = 75, MAX_ZOOM = 200, ZOOM_STEP = 25;
let zoom = 100;

function fit() {
  clearHover();
  const center = (offset, total, visible) => visible < total ? (offset + visible / 2) / total : .5;
  const x = center(sceneView.scrollLeft, sceneView.scrollWidth, sceneView.clientWidth);
  const y = center(sceneView.scrollTop, sceneView.scrollHeight, sceneView.clientHeight);
  const availableHeight = Math.min(innerHeight * .7, Math.max(140, innerHeight - 230));
  const scale = Math.min(sceneView.offsetWidth / W, availableHeight / H) * zoom / 100;
  cv.style.width = W * scale + 'px';
  cv.style.height = H * scale + 'px';
  sceneView.scrollLeft = sceneView.scrollWidth * x - sceneView.clientWidth / 2;
  sceneView.scrollTop = sceneView.scrollHeight * y - sceneView.clientHeight / 2;
  zoomOut.disabled = zoom === MIN_ZOOM;
  zoomIn.disabled = zoom === MAX_ZOOM;
  zoomReset.textContent = zoom + '%';
  zoomReset.setAttribute('aria-label', 'Zoom ' + zoom + ' procent. Zet terug naar 100 procent.');
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
