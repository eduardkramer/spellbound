/* De Toren van de Tovenaar — proof of concept
 * Isometrische pixel-kamer, volledig procedureel getekend op een canvas (250x310 px).
 * Coördinaten: (a, b, z)  a = naar rechtsonder, b = naar linksonder, z = omhoog.
 * Achterhoek van de kamer = (0,0,0). Zie P() voor de projectie.
 */
(function () {
'use strict';

const W = 250, H = 310, CX = 125, CY = 162;
const N = 40;     // vloer N x N
const T = 20;     // muurdikte
const WH = 104;   // muurhoogte
const F = 56;     // dikte onderbouw

const cv = document.getElementById('scene');
cv.width = W; cv.height = H;
const ctx = cv.getContext('2d');
const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
const statC = mk(), frontC = mk();
const sg = statC.getContext('2d'), fg = frontC.getContext('2d');

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
  const ea = ((a % 8) + 8) % 8, eb = ((b % 8) + 8) % 8;
  if (ea < .5 || eb < .5) return '#5f80ac';
  return hash(Math.floor(a / 8), Math.floor(b / 8)) > .5 ? '#86a8cf' : '#7c9ec6';
};

/* ---------- vloer ---------- */
function floorFn(a, b) {
  if (a >= 12 && a < 30 && b >= 4) {                 // tapijt
    const la = a - 12, lb = b - 4;
    if (b >= N - 1.2) return (Math.floor(la * 1.5) & 1) ? '#e8d9a0' : '#bda86a';      // franje
    if (la < 1.2 || la > 16.8) return '#5b1221';
    if (la < 2 || la > 16) return '#d6a83c';
    const d = Math.abs(((lb % 8) + 8) % 8 - 4) + Math.abs(la - 9);
    if (d < 3.2) return '#c43a4a';
    if (d < 4.2) return '#7d1a28';
    return hash(Math.floor(a * 2), Math.floor(b * 2)) > .9 ? '#a82838' : '#9c2030';
  }
  if (b >= N - .8 || a >= N - .8) return '#6a6aa0';  // voorrand
  const ea = ((a % 8) + 8) % 8, eb = ((b % 8) + 8) % 8;
  if (ea < .5 || eb < .5) return '#2f2f50';
  const ta = Math.floor(a / 8), tb = Math.floor(b / 8);
  if (hash(Math.floor(a * 2), Math.floor(b * 2)) > .93) return '#53537f';
  return ((ta + tb) & 1) ? '#4a4a76' : '#43436d';
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
      const r = arch(Math.abs(u - 40 + .5), z + .5);
      if (r === 2) return z > -22 ? '#10132b' : '#171b38';
      if (r === 1) return ((Math.floor(Math.abs(u - 40) / 3) + Math.floor((z + 60) / 3)) & 1) ? '#7a9cca' : '#6684b6';
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

/* ---------- statische kamer ---------- */
function buildStatic() {
  topFace(sg, 0, 0, N, 0, N, floorFn);
  wallL(sg, 0, 0, 2 * N, 0, WH, leftFn);
  wallR(sg, 0, 0, 2 * N, 0, WH, rightFn);
  topFace(sg, WH, -T, N, -T, 0, copingFn);
  topFace(sg, WH, -T, 0, 0, N, copingFn);
  const mer = { top: copingFn, left: (u, z) => brOutL(u, z), right: (u, z) => brOutR(u, z) };
  box(sg, -T, -T, WH, T, T, 12, mer);
  box(sg, -T, N - 8, WH, T, 8, 10, mer);
  box(sg, N - 8, -T, WH, 8, T, 10, mer);
  wallR(sg, N, -2 * T, 2 * N, -F, WH, facadeFn(brOutL));
  wallL(sg, N, -2 * T, 2 * N, -F, WH, facadeFn(brOutR));
}

/* ---------- meubels (laag vóór het vuur) ---------- */
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
let cand = [];   // kaarsposities
let KN = null;   // ridder-positie
let TB = null;   // tafelpositie

function buildFront() {
  const g = fg;
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

  // stoel (kijkt naar het vuur, rugleuning naar ons toe)
  const chairBase = '#7a4a2a';
  for (const [a, b] of [[23, 8.5], [29.4, 8.5], [23, 14.9], [29.4, 14.9]]) box(g, a, b, 0, 1.6, 1.6, 10, woodD);
  box(g, 23, 8.5, 10, 8, 8, 2, wood);
  const slat = woodC(chairBase); slat.left = (u, z) => ((u % 5) === 0 ? sh(chairBase, .55) : (hash(u, z >> 2) > .85 ? sh(chairBase, 1) : sh(chairBase, .85)));
  box(g, 23, 15.5, 12, 8, 1.5, 26, slat);
  box(g, 23, 15.5, 38, 1.8, 1.5, 3, wood); box(g, 29.2, 15.5, 38, 1.8, 1.5, 3, wood);

  // planken: rechter plank + drankjes
  box(g, 33, 0, 44, 7, 5.5, 2, wood); box(g, 34, 0, 40, 1.2, 3, 4, woodD); box(g, 38, 0, 40, 1.2, 3, 4, woodD);
  let [x, y] = P(35.5, 2.6, 46); flask(g, x, y, '#46d6e8');
  [x, y] = P(38.2, 2.6, 46); flask(g, x, y, '#f0509a');
  // linker plank + drankjes
  box(g, 0, 33, 44, 5.5, 7, 2, wood); box(g, 0, 34, 40, 3, 1.2, 4, woodD); box(g, 0, 38, 40, 3, 1.2, 4, woodD);
  [x, y] = P(2.6, 35.5, 46); flask(g, x, y, '#5be05b');
  [x, y] = P(2.6, 38.4, 46); flask(g, x, y, '#ff6fa8', 'tube');

  // vensterbank (de kat zit hier op)
  box(g, 0, 10, 92, 3.5, 25, 3, wood);

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

  // groen boek op de grond
  box(g, 11, 33, 0, 6, 5, 3, flat('#2f7a3a', '#e8dcb0', '#17481f'));

  // tafel
  { const [tx, ty] = P(24, 29, 0); TB = [tx, ty];
    ell(g, tx, ty - 1, 9, 4, '#3e2414'); ell(g, tx, ty - 2, 8, 3, '#5a3320');
    rect(g, tx - 1, ty - 18, 3, 16, '#5a3320'); rect(g, tx - 1, ty - 18, 1, 16, '#7a4a2a');
    ell(g, tx, ty - 17, 15, 7, '#4a2a16');
    ell(g, tx, ty - 19, 15, 7, '#b0723e'); ell(g, tx, ty - 19, 13, 6, '#94582e');
    // paars boek
    box(g, 20.5, 26.5, 19, 5, 4, 2.5, flat('#7a46ac', '#5a2e88', '#3f1f66'));
    // inktpot + veer
    box(g, 26, 30.5, 19, 2.5, 2.5, 3, flat('#3a4aa8', '#26307a', '#1a2258'));
    const [qx, qy] = P(27.2, 31.7, 22);
    for (let i = 0; i < 12; i++) { dot(g, qx - i * .5, qy - i, '#f4f0e6'); if (i > 2 && i < 11) dot(g, qx - i * .5 - 1, qy - i, '#d6d1c4'); }
    dot(g, qx + 1, qy + 1, '#222'); }
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

buildStatic(); outline(sg, '#14183a');
buildFront(); outline(fg, '#0f1226');

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
function drawCat(t) {
  const [bx, by] = P(1.7, 24, 95), k = '#14141f', k2 = '#25253a';
  // staart
  for (let i = 0; i < 10; i++) { const x = bx + 5 + i * .8, y = by - 2 - Math.sin(i * .45 + t * 2.4) * (1 + i * .25); rect(ctx, x, y, 2, 2, k); }
  rect(ctx, bx - 5, by - 9, 10, 9, k); dot(ctx, bx - 5, by - 9, 'rgba(0,0,0,0)');
  rect(ctx, bx - 4, by - 10, 8, 1, k); rect(ctx, bx + 2, by - 8, 2, 7, k2);
  rect(ctx, bx - 4, by - 16, 8, 7, k);                      // kop
  rect(ctx, bx - 4, by - 18, 2, 2, k); rect(ctx, bx + 2, by - 18, 2, 2, k);
  dot(ctx, bx - 3, by - 17, '#7a3a4a'); dot(ctx, bx + 3, by - 17, '#7a3a4a');
  const blink = (t % 4.6) > 4.45;
  if (blink) { rect(ctx, bx - 3, by - 13, 2, 1, '#3a3a50'); rect(ctx, bx + 1, by - 13, 2, 1, '#3a3a50'); }
  else { rect(ctx, bx - 3, by - 14, 2, 2, '#ffd23a'); rect(ctx, bx + 1, by - 14, 2, 2, '#ffd23a'); dot(ctx, bx - 2, by - 14, '#111'); dot(ctx, bx + 2, by - 14, '#111'); }
  dot(ctx, bx, by - 11, '#7a3a4a');
}
function drawSlime(t) {
  const [sx, sy] = P(27.2, 25, 19), s = Math.sin(t * 3), rx = Math.round(5.5 - s * .9), ry = Math.round(4 + s * .9);
  ell(ctx, sx, sy - ry + 1, rx, ry, '#e0559a'); ell(ctx, sx, sy - ry, rx - 1, ry - 1, '#ff7fbf');
  dot(ctx, sx - 2, sy - ry - 1, '#ffd0ea'); dot(ctx, sx - 1, sy - ry - 2, '#ffd0ea');
  dot(ctx, sx - 2, sy - ry + 1, '#3a1030'); dot(ctx, sx + 1, sy - ry + 1, '#3a1030');
}
const sparkles = [];
function drawSparkles(t, dt) {
  const [ox, oy] = P(22.5, 28.5, 21.5);
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

let last = 0;
function frame(ms) {
  const t = ms / 1000, dt = Math.min(.1, last ? t - last : .016); last = t;
  ctx.clearRect(0, 0, W, H);
  drawSky(t);
  ctx.drawImage(statC, 0, 0);
  banner(t, 7, 12, 0); banner(t, 65, 12, 1.7);
  drawPortrait(t);
  drawFire(t, dt);
  ctx.drawImage(frontC, 0, 0);
  for (const [x, y] of cand) flame(x, y, t, x);
  for (let i = 0; i < flasks.length; i++) {
    const f = flasks[i];
    ctx.globalAlpha = .85;
    for (let k = 0; k < 2; k++) dot(ctx, f.x + (k ? 1 : -1), f.y - 2 - ((t * 4 + i * 1.7 + k * 2.3) % 5), '#f4fff8');
    ctx.globalAlpha = 1;
  }
  if (KN && (t % 7) > 6.4) rect(ctx, KN[0] - 3, KN[1] - 33, 6, 1, '#ff3a3a');
  drawSlime(t); drawCat(t); drawSparkles(t, dt);
  const n = (Math.sin(t * 9) + Math.sin(t * 13.7) + Math.sin(t * 5.3)) / 3;
  const [gx, gy] = P(21, 6, 14);
  glow(gx, gy, 80, 56, '255,150,50', .045 + .015 * n);
  for (const [x, y] of cand) glow(x, y + 4, 22, 16, '255,200,120', .03);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ---------- schaal ---------- */
function fit() {
  const s = Math.max(1, Math.floor(Math.min((innerWidth - 24) / W, (innerHeight - 170) / H)));
  const f = Math.min(s, (innerWidth - 24) / W);
  cv.style.width = Math.round(W * f) + 'px'; cv.style.height = Math.round(H * f) + 'px';
}
addEventListener('resize', fit); fit();

})();
