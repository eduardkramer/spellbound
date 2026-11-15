/* Tiles voor de tile-game — zelfde isometrische pixelstijl en projectie als scene.js.
 *
 * Eén tile = 8 x 8 eenheden = een ruit van 32 x 16 px (2:1). Blokken staan op die ruit en steken omhoog.
 * Elke tile is één afbeelding (cel) van 32 x 48 px; de bovenste punt van de ruit ligt op (16, 32).
 * Coördinaten binnen een tile: (a, b, z)  a = naar rechtsonder, b = naar linksonder, z = omhoog (px).
 * De vier randen van de ruit:  a=0 linksboven · b=0 rechtsboven · a=8 rechtsonder · b=8 linksonder.
 *
 * Gebruik:
 *   <script src="tiles.js"></script>
 *   TILESET.draw(ctx, 'stone_a', gx, gy, ox, oy, t);   // teken tile op kolom gx, rij gy
 *   TILESET.info('wall').walkable                      // false
 *   TILESET.center(gx, gy, ox, oy)                     // [x, y] midden van de ruit (voor je figuur)
 * Teken tiles van achter naar voren: oplopende gx+gy.
 */
(function () {
'use strict';

const S = 8;                       // tile = 8 x 8 eenheden
const TW = 32, TH = 16;            // ruit op het scherm
const CW = 32, CH = 48;            // cel: ruit + ruimte voor blokken tot 32 px hoog
const CX = 16, CY = 32;            // bovenste punt van de ruit in de cel
const FPS = 4;                     // animatiesnelheid van geanimeerde tiles

/* ---------- helpers (dezelfde als in scene.js) ---------- */
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
function ell(g, cx, cy, rx, ry, c) {
  cx = Math.round(cx); cy = Math.round(cy);
  g.fillStyle = c;
  for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++)
    if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) g.fillRect(cx + x, cy + y, 1, 1);
}
const P = (a, b, z) => [CX + 2 * (a - b), CY + a + b - z];

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
const flat = (t, l, r) => ({ top: t, left: l, right: r });
const whole = (g, fn) => topFace(g, 0, 0, S, 0, S, fn);   // hele ruit op vloerniveau

/* zachte ruis voor mos / vlekken */
function vn(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, s = t => t * t * (3 - 2 * t);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1), u = s(fx), v = s(fy);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
function dseg(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  let t = ((px - x0) * dx + (py - y0) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
}

/* ---------- stenen (kleuren uit scene.js) ---------- */
function brickFn(p, bw, bh) {
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
const copingFn = (a, b) => {
  if (a < .5 || b < .5) return '#5f80ac';
  return hash(Math.floor(a * 2), Math.floor(b * 2)) > .5 ? '#86a8cf' : '#7c9ec6';
};
const bookCols = ['#8c2f39', '#2f6e4f', '#3b4f9a', '#b08a3a', '#6a3a8a', '#c0603a', '#2a7a8a', '#7a7a8e'];

function stoneFn(base, seed) {
  return (a, b) => {
    if (a < .5 || b < .5) return '#2f2f50';                         // voeg
    const h = hash(Math.floor(a * 2) + seed * 31, Math.floor(b * 2) + seed * 17);
    if (h > .93) return '#53537f';
    if (h < .05) return sh(base, .9);
    if (a < 1 || b < 1) return sh(base, 1.1);                      // lichte rand
    return base;
  };
}

/* ---------- registratie ---------- */
const defs = [], byId = {};
function def(id, label, o, draw) {
  const d = { id, label, walkable: !!o.walkable, solid: !o.walkable, height: o.height || 0, frames: o.frames || 1,
              group: o.group || (o.walkable ? 'vloer' : 'blok'), mask: o.mask, draw, cache: [] };
  defs.push(d); byId[id] = d;
}

/* ================= VLOEREN (loopbaar) ================= */
def('stone_a', 'steen', { walkable: 1 }, g => whole(g, stoneFn('#4a4a76', 1)));
def('stone_b', 'steen donker', { walkable: 1 }, g => whole(g, stoneFn('#43436d', 2)));

const crack = [[1.2, 2.5], [2.6, 3.2], [3.4, 4.4], [4.8, 4.9], [5.4, 6.2], [6.8, 6.9]];
def('stone_cracked', 'gebarsten steen', { walkable: 1 }, g => {
  const base = stoneFn('#4a4a76', 3);
  whole(g, (a, b) => {
    let m = 9;
    for (let i = 0; i < crack.length - 1; i++) m = Math.min(m, dseg(a, b, crack[i][0], crack[i][1], crack[i + 1][0], crack[i + 1][1]));
    if (a > .5 && b > .5) { if (m < .32) return '#1b1b34'; if (m < .62) return '#3a3a62'; }
    return base(a, b);
  });
});

def('stone_moss', 'steen met mos', { walkable: 1 }, g => {
  const base = stoneFn('#43436d', 4);
  whole(g, (a, b) => {
    const n = vn(a * .6 + 7, b * .6 + 3);
    if (n > .56) { const h = hash(Math.floor(a * 2), Math.floor(b * 2) + 99); return h > .6 ? '#5a9a5a' : h > .25 ? '#4a8250' : '#3a6a45'; }
    if (n > .49) return '#34553f';
    return base(a, b);
  });
});

def('wood', 'houten vloer', { walkable: 1 }, g => whole(g, (a, b) => {
  const row = Math.floor(b / 2), lb = b - row * 2;
  if (lb < .5) return '#3e2414';                                   // naad tussen planken
  const jt = (row * 3.1 + 1.5) % 8;                                // kopse naad
  if (Math.abs(a - jt) < .4) return '#3e2414';
  const seg = a >= jt ? 1 : 0;
  const f = [.88, .96, 1.04, 1.1][Math.floor(hash(row, seg + 5) * 4)];
  if (hash(Math.floor(a * 1.3), row * 9 + Math.floor(lb * 3)) > .86) return sh('#7a4a2a', f * .84);
  return sh('#7a4a2a', lb < 1 ? f * 1.08 : f);
}));

/* tapijt: masker-bit = "deze rand is een kant van het tapijt" (1 = a0, 2 = b0, 4 = a1, 8 = b1).
 * Zo kun je tapijt van elke vorm leggen: kies de variant op basis van je buren. */
function carpetFn(mask) {
  return (a, b) => {
    let e = 9;
    if (mask & 1) e = Math.min(e, a);
    if (mask & 2) e = Math.min(e, b);
    if (mask & 4) e = Math.min(e, S - a);
    if (mask & 8) e = Math.min(e, S - b);
    if (e < 1.2) return '#5b1221';
    if (e < 2) return '#d6a83c';
    const d = Math.abs(a - 4) + Math.abs(b - 4);
    if (d < 1.6) return '#c43a4a';
    if (d < 2.6) return '#7d1a28';
    return hash(Math.floor(a * 2), Math.floor(b * 2)) > .9 ? '#a82838' : '#9c2030';
  };
}
for (let m = 0; m < 16; m++)
  def(m === 0 ? 'carpet' : 'carpet_' + m, 'tapijt', { walkable: 1, group: 'tapijt', mask: m }, g => whole(g, carpetFn(m)));

def('rune', 'runencirkel', { walkable: 1, frames: 4 }, (g, f) => {
  const cols = ['#3fc4a0', '#6fffd0', '#c8fff0', '#6fffd0'], c = cols[f], dim = sh(c, .55);
  const dark = stoneFn('#43436d', 5), lit = stoneFn('#4a6088', 5);
  whole(g, (a, b) => {
    const x = a - 4, y = b - 4, d = Math.hypot(x, y);
    if (a > .5 && b > .5) {
      if (Math.abs(d - 3.3) < .3) return c;
      if (Math.abs(d - 1.9) < .2) return c;
      if (d > .6 && d < 3.3 && (Math.abs(x) < .22 || Math.abs(y) < .22)) return dim;
      if (d < .6) return c;
    }
    return (d < 3.9 && f > 0) ? lit(a, b) : dark(a, b);
  });
});

def('plate', 'drukplaat', { walkable: 1, height: 2 }, g => {
  whole(g, stoneFn('#4a4a76', 6));
  box(g, 1.5, 1.5, 0, 5, 5, 2, {
    top: (a, b) => {
      const e = Math.min(a - 1.5, b - 1.5, 6.5 - a, 6.5 - b);
      if (e < .5) return '#a0a0c8';
      const d = Math.abs(a - 4) + Math.abs(b - 4);
      if (d < 1.2) return '#f0c75a';
      if (d < 2) return '#c9982a';
      return '#7a7aa8';
    }, left: '#5a5a88', right: '#46466f'
  });
});

/* ================= VLOEREN (niet loopbaar) ================= */
def('water', 'water', { frames: 4, group: 'vloer' }, (g, f) => {
  const ph = f * Math.PI / 2, k = Math.PI / 4;               // golven herhalen elke 8 eenheden: naadloos
  whole(g, (a, b) => {
    const v = Math.sin(k * a + 2 * k * b + ph) + .6 * Math.cos(2 * k * a - k * b - ph);
    if (hash(Math.floor(a * 2) + f * 13, Math.floor(b * 2)) > .985) return '#ffffff';
    if (v > 1.15) return '#8fd0ff';
    if (v > .4) return '#4a9ad8';
    if (v < -1) return '#1f5a98';
    return '#2c76bd';
  });
});

def('pit', 'put', { group: 'vloer' }, g => {
  const D = 8, brick = brickFn({ mortar: '#14173a', c: ['#232860', '#282d68', '#2d3270'], hi: '#3a4088', lo: '#1c2050' }, 6, 4);
  whole(g, (a, b) => {
    if (a < .5 || b < .5) return '#2f2f50';
    if (a >= D / 2 && b >= D / 2) return hash(Math.floor(a * 2), Math.floor(b * 2)) > .96 ? '#14183a' : '#080a18';   // bodem
    const wa = a <= b;                                              // welke muur raken we eerst?
    const depth = wa ? 2 * a : 2 * b, u = Math.floor(2 * Math.abs(b - a)) + (wa ? 0 : 20);
    return sh(brick(u, Math.floor(depth)), 1 - depth / D * .55 + (wa ? 0 : -.12));
  });
});

/* ================= BLOKKEN ================= */
const brL = brickFn(palInL, 8, 8), brR = brickFn(palInR, 8, 8);
def('wall', 'muur', { height: 32 }, g => box(g, 0, 0, 0, S, S, 32, { top: copingFn, left: brL, right: brR }));

const brLowL = brickFn(palInL, 8, 5), brLowR = brickFn(palInR, 8, 5);
def('wall_low', 'lage muur', { height: 12 }, g => {
  box(g, 0, 0, 0, S, S, 10, { top: copingFn, left: brLowL, right: brLowR });
  box(g, 0, 0, 10, S, S, 2, { top: copingFn, left: (u, z) => (z === 10 ? '#4a6a96' : '#6f92bd'), right: (u, z) => (z === 10 ? '#3a5586' : '#5a7cb0') });
});

function shelfFace(seed, k) {
  const rows = [];
  for (let r = 0; r < 3; r++) {
    const arr = {}; let u = 1;
    while (u < 15) {
      const w = 1 + Math.floor(hash(u + seed, r) * 3), h = 4 + Math.floor(hash(u * 3 + seed, r + 9) * 4);
      const c = bookCols[Math.floor(hash(u + seed, r + 31) * bookCols.length)];
      for (let i = 0; i < w && u < 15; i++, u++) arr[u] = { c, h, first: i === 0 };
      if (hash(u + seed, r + 50) > .8) u += 1;
    }
    rows.push(arr);
  }
  return (u, z) => {
    if (u < 1 || u >= 15 || z >= 30) return sh('#9a6038', k * (z >= 31 ? 1.1 : 1));
    if (z % 10 < 2) return sh('#5a3320', k);
    const r = Math.floor(z / 10), lz = (z % 10) - 2, b = rows[r][u];
    if (b && lz < b.h) return sh(b.c, k * (b.first ? 1.3 : lz === b.h - 1 ? 1.2 : 1));
    return sh('#1d1830', k);
  };
}
def('bookshelf', 'boekenkast', { height: 32 }, g => box(g, 0, 0, 0, S, S, 32, {
  top: (a, b) => (hash(Math.floor(a * 2), Math.floor(b * 3)) > .82 ? sh('#7a4a2a', 1.28) : sh('#7a4a2a', 1.15)),
  left: shelfFace(3, 1), right: shelfFace(11, .72)
}));

def('chest', 'schatkist', { height: 10 }, g => {
  const face = (k, lock) => (u, z) => {
    if (u === 2 || u === 13) return sh('#3e2414', k);
    if (z === 7) return '#2a1608';
    if (lock && (u === 7 || u === 8) && z >= 4 && z <= 8) return z === 8 ? '#ffe27a' : '#f0c75a';
    if (lock && ((u >= 4 && u < 6) || (u >= 10 && u < 12))) return sh('#4a4a5a', k);
    if (z >= 7) return sh('#8a5430', k * (hash(u, z) > .85 ? .9 : 1));
    return sh('#7a4a2a', k * (hash(u, z >> 1) > .8 ? .88 : 1));
  };
  box(g, 1, 1, 0, 6, 6, 10, {
    top: (a, b) => ((a >= 2 && a < 3) || (a >= 5 && a < 6) ? '#4a4a5a' : (hash(Math.floor(a * 2), Math.floor(b * 3)) > .8 ? '#a76a3c' : '#9a6038')),
    left: face(1, true), right: face(.7, false)
  });
});

def('pillar', 'pilaar', { height: 32 }, g => {
  const shaft = k => (u, z) => sh(u % 3 === 0 ? '#6c668e' : '#7a749a', k);
  box(g, 1.5, 1.5, 0, 5, 5, 3, flat('#9791b5', '#837da3', '#6c668e'));
  box(g, 2.2, 2.2, 3, 3.6, 3.6, 26, { top: '#9791b5', left: shaft(1.05), right: shaft(.78) });
  box(g, 1.5, 1.5, 29, 5, 5, 3, flat('#a8a3c6', '#8f89ad', '#76708f'));
});

def('brazier', 'vuurschaal', { height: 30, frames: 4 }, (g, f) => {
  const k1 = '#16161f', k2 = '#2c2c3a', k3 = '#3c3c4e';
  ell(g, 16, 39, 6, 2, k1); ell(g, 16, 38, 5, 1, k2);
  rect(g, 15, 27, 2, 12, '#23232f'); rect(g, 15, 27, 1, 12, k3);
  ell(g, 16, 26, 8, 3, k1); ell(g, 16, 25, 8, 3, k2); ell(g, 16, 25, 6, 2, '#4b2a18');
  const ph = f * Math.PI / 2;
  for (let x = -6; x <= 6; x++) {
    const env = Math.max(0, 1 - (x / 7) * (x / 7)), n = (Math.sin(x * .9 + ph) + Math.sin(x * .37 - ph * 2)) / 2;
    const h = Math.round(env * (9 + 3 * n));
    for (let z = 0; z < h; z++) { const rel = z / h; dot(g, 16 + x, 24 - z, rel < .25 ? '#fff4b0' : rel < .5 ? '#ffc83a' : rel < .78 ? '#f58a22' : '#d8441c'); }
  }
  if (f % 2) dot(g, 14 + f, 11, '#ffd060'); else dot(g, 18 - f, 9, '#ff7a2a');
});

def('table', 'tafel', { height: 21 }, g => {
  const [tx, ty] = P(4, 4, 0);
  ell(g, tx, ty - 1, 9, 4, '#3e2414'); ell(g, tx, ty - 2, 8, 3, '#5a3320');
  rect(g, tx - 1, ty - 18, 3, 16, '#5a3320'); rect(g, tx - 1, ty - 18, 1, 16, '#7a4a2a');
  ell(g, tx, ty - 17, 14, 6, '#4a2a16');
  ell(g, tx, ty - 19, 14, 6, '#b0723e'); ell(g, tx, ty - 19, 12, 5, '#94582e');
  box(g, 2.6, 3.6, 19, 2.6, 2, 2, flat('#7a46ac', '#5a2e88', '#3f1f66'));          // paars boek
  const [fx, fy] = P(5.3, 4.2, 19);                                                // drankje
  ell(g, fx, fy - 3, 3, 3, '#cfe8ff'); ell(g, fx, fy - 3, 2, 2, '#f0509a'); dot(g, fx - 1, fy - 4, '#ffffff');
  rect(g, fx, fy - 8, 2, 3, '#cfe8ff'); rect(g, fx, fy - 9, 2, 1, '#a8703a');
});

def('cauldron', 'ketel', { height: 16, frames: 4 }, (g, f) => {
  const k1 = '#16161f', k2 = '#2c2c3a', k3 = '#3c3c4e';
  rect(g, 9, 37, 3, 4, k1); rect(g, 20, 37, 3, 4, k1);
  ell(g, 16, 32, 10, 7, k1); ell(g, 16, 32, 9, 6, k2);
  rect(g, 10, 31, 2, 4, k3); dot(g, 11, 30, k3);
  ell(g, 16, 26, 10, 3, k3); ell(g, 16, 26, 9, 2, k1); ell(g, 16, 26, 8, 2, '#4fd04f');
  rect(g, 11, 25, 3, 1, '#8fff8f');
  for (let i = 0; i < 3; i++) {
    const p = (f + i * 1.3) % 4, y = 26 - Math.floor(p * 1.5);
    dot(g, 12 + i * 4, y, '#b8ffb8'); if (p < 1.5) dot(g, 13 + i * 4, y, '#b8ffb8');
  }
  dot(g, 14 + f, 17 - f, '#9fe89f'); dot(g, 19 - f, 14 - f, '#7fd07f');
});

function doorFn(br, k) {
  return (u, z) => {
    const du = Math.abs(u + .5 - 8), cz = 18;
    const inside = r => (z < cz ? du <= r : du * du + (z - cz) * (z - cz) <= r * r);
    if (inside(4)) {
      if (u === 7) return sh('#2a1608', k);
      if ((z >= 5 && z < 7) || (z >= 13 && z < 15)) return sh(hash(u, z) > .9 ? '#4a4a5a' : '#2e2e3c', k);
      if ((u === 6 || u === 9) && z >= 9 && z <= 10) return '#f0c75a';
      return sh((u >> 1) & 1 ? '#6a3a1e' : '#5a3320', k);
    }
    if (inside(5.8)) return sh(((Math.floor(u / 3) + Math.floor(z / 3)) & 1) ? '#7a9cca' : '#6684b6', k);
    return br(u, z);
  };
}
def('door_l', 'deur (links)', { height: 32 }, g => box(g, 0, 0, 0, S, S, 32, { top: copingFn, left: doorFn(brL, 1), right: brR }));
def('door_r', 'deur (rechts)', { height: 32 }, g => box(g, 0, 0, 0, S, S, 32, { top: copingFn, left: brL, right: doorFn(brR, .8) }));

/* ---------- renderen ---------- */
for (const d of defs) for (let f = 0; f < d.frames; f++) {
  const c = document.createElement('canvas'); c.width = CW; c.height = CH;
  d.draw(c.getContext('2d'), f);
  d.cache.push(c);
}

/* ---------- publieke API ---------- */
const frameOf = (d, t) => (d.frames > 1 ? Math.floor((t || 0) * FPS) % d.frames : 0);

window.TILESET = {
  TW, TH, CW, CH, FPS,
  tiles: defs,
  info: id => byId[id] || null,
  canvas: (id, t) => { const d = byId[id]; return d ? d.cache[frameOf(d, t)] : null; },
  /* bovenste punt van de ruit voor tile (gx, gy); gx loopt naar rechtsonder, gy naar linksonder */
  corner: (gx, gy, ox, oy) => [ox + (TW / 2) * (gx - gy), oy + (TH / 2) * (gx + gy)],
  /* midden van de ruit: hier hoort de voet van je figuur */
  center: (gx, gy, ox, oy) => [ox + (TW / 2) * (gx - gy), oy + (TH / 2) * (gx + gy) + TH / 2],
  draw(ctx, id, gx, gy, ox, oy, t) {
    const d = byId[id]; if (!d) return;
    ctx.drawImage(d.cache[frameOf(d, t)], Math.round(ox + (TW / 2) * (gx - gy) - CX), Math.round(oy + (TH / 2) * (gx + gy) - CY));
  },
  /* spritesheet: alle frames naast elkaar, 8 cellen per rij */
  sheet(cols) {
    cols = cols || 8;
    let n = 0; for (const d of defs) n += d.frames;
    const c = document.createElement('canvas'); c.width = cols * CW; c.height = Math.ceil(n / cols) * CH;
    const g = c.getContext('2d'), map = {};
    let i = 0;
    for (const d of defs) {
      map[d.id] = { x: (i % cols) * CW, y: Math.floor(i / cols) * CH, w: CW, h: CH, frames: d.frames, walkable: d.walkable, height: d.height };
      for (let f = 0; f < d.frames; f++, i++) g.drawImage(d.cache[f], (i % cols) * CW, Math.floor(i / cols) * CH);
    }
    return { canvas: c, map };
  }
};

})();
