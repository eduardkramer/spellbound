/* De tovenaar — sprite voor de tile-game, zelfde pixelstijl als de kamer (scene.js) en de tiles (tiles.js).
 *
 * Eén afbeelding (cel) = 32 x 48 px. De voeten staan op (16, 44): dat punt hoort in het MIDDEN van een tile-ruit.
 * Vier richtingen, naar het scherm gezien:
 *   'se' = rechtsonder (gx+1)   'sw' = linksonder (gy+1)   'ne' = rechtsboven (gy-1)   'nw' = linksboven (gx-1)
 * Twee standen: 'idle' (2 frames, ademt) en 'walk' (4 frames, één pas per tile als je 10 frames/s gebruikt).
 *
 * Gebruik:
 *   const [x, y] = TILESET.center(gx, gy, ox, oy);
 *   WIZARD.draw(ctx, 'se', 'walk', t, x, y);       // t = tijd in seconden
 * Teken hem na de tiles met dezelfde gx+gy (of lager), zodat blokken voor hem hem afdekken.
 */
(function () {
'use strict';

const CW = 32, CH = 48, FX = 16, FY = 44;
const FPS = { idle: 2, walk: 10 }, FRAMES = { idle: 2, walk: 4 };
const DIRS = ['se', 'sw', 'ne', 'nw'];

function rect(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); }
function dot(g, x, y, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); }
function ell(g, cx, cy, rx, ry, c) {
  cx = Math.round(cx); cy = Math.round(cy); g.fillStyle = c;
  for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++)
    if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) g.fillRect(cx + x, cy + y, 1, 1);
}
function outline(g, hex) {                         // zelfde omlijning als in scene.js
  const id = g.getImageData(0, 0, CW, CH), d = id.data, pts = [];
  const op = (x, y) => x >= 0 && y >= 0 && x < CW && y < CH && d[(y * CW + x) * 4 + 3] > 128;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    if (d[(y * CW + x) * 4 + 3] > 128) continue;
    if (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1)) pts.push(x, y);
  }
  g.fillStyle = hex;
  for (let i = 0; i < pts.length; i += 2) g.fillRect(pts[i], pts[i + 1], 1, 1);
}

/* tekent de tovenaar naar rechts-onder (voorkant) of rechts-boven (achterkant); links = gespiegeld */
function figure(g, back, f, walking) {
  const cx = FX, fy = FY;
  const bob = walking && (f & 1) ? -1 : 0;                  // lichaam gaat op en neer tijdens het lopen
  const hd = !walking && f ? 1 : 0;                         // adem: hoofd 1 px omlaag
  const lL = walking && f === 1 ? 2 : 0, lR = walking && f === 3 ? 2 : 0;   // voet omhoog
  const arm = walking ? [0, -1, 0, 1][f] : 0, hem = walking ? [0, -1, 0, 1][f] : 0;
  const pulse = walking ? f >> 1 : f;
  const pal = back ? { m: '#52449f', d: '#43388f', l: '#6256bd' } : { m: '#5b4bb8', d: '#4b3fa8', l: '#7466d6' };
  const skin = '#d6ab84', gold = '#d9a53a', goldL = '#ffd45a';

  // staf met lichtgevende bol
  rect(g, cx + 7, fy - 36 + bob, 1, 36, '#a06a3a'); rect(g, cx + 8, fy - 36 + bob, 1, 36, '#6a3c22');
  ell(g, cx + 8, fy - 39 + bob, 2, 2, '#2a7a8a'); ell(g, cx + 8, fy - 39 + bob, 1, 1, pulse ? '#7fffd4' : '#46d6e8');
  dot(g, cx + 7, fy - 40 + bob, '#ffffff');

  // laarzen
  rect(g, cx - 4, fy - 3 - lL, 3, 3, '#2a2140'); rect(g, cx + 1, fy - 3 - lR, 3, 3, '#2a2140');
  dot(g, cx - 4, fy - 3 - lL, '#4a3a6a'); dot(g, cx + 1, fy - 3 - lR, '#4a3a6a');

  // mantel
  const row = (i, y) => {
    const w = 12 - Math.floor(i / 4), x0 = cx - (w >> 1) + (i < 2 ? hem : 0);
    rect(g, x0, y, w, 1, i === 0 ? gold : pal.m);
    if (i > 0) { rect(g, x0, y, 2, 1, pal.d); rect(g, x0 + w - 2, y, 2, 1, pal.l); if (i < 12) dot(g, cx, y, pal.d); }
    else for (let k = 1; k < w; k += 3) dot(g, x0 + k, y, '#a87a22');
  };
  if (bob < 0) row(0, fy - 4);
  for (let i = 0; i < 17; i++) row(i, fy - 4 - i + bob);
  rect(g, cx - 6, fy - 21 + bob, 12, 2, pal.m); rect(g, cx - 6, fy - 21 + bob, 12, 1, pal.l);   // schouders
  if (back) dot(g, cx - 1, fy - 12 + bob, goldL);
  else { dot(g, cx - 2, fy - 8 + bob, goldL); dot(g, cx + 3, fy - 14 + bob, goldL); dot(g, cx - 3, fy - 16 + bob, gold); }
  rect(g, cx - 4, fy - 12 + bob, 8, 1, gold); if (!back) dot(g, cx, fy - 12 + bob, goldL);    // riem

  // armen
  rect(g, cx - 7, fy - 21 + bob + arm, 2, 8, pal.m); rect(g, cx - 7, fy - 21 + bob + arm, 1, 8, pal.d);
  rect(g, cx + 5, fy - 21 + bob - arm, 2, 8, pal.m); rect(g, cx + 6, fy - 21 + bob - arm, 1, 8, pal.l);
  rect(g, cx - 7, fy - 13 + bob + arm, 2, 2, skin); rect(g, cx + 6, fy - 14 + bob - arm, 2, 2, skin);

  // hoofd (ademt mee)
  const y0 = fy + hd + bob;
  if (back) {
    rect(g, cx - 3, y0 - 27, 6, 7, '#d9d9ea'); rect(g, cx + 1, y0 - 27, 2, 7, '#a9acc6'); rect(g, cx - 2, y0 - 20, 4, 2, '#d9d9ea');
  } else {
    rect(g, cx - 2, y0 - 27, 6, 5, skin);
    dot(g, cx - 1, y0 - 26, '#2a1a2a'); dot(g, cx + 2, y0 - 26, '#2a1a2a'); dot(g, cx + 1, y0 - 25, '#b88660');
    const bw = [6, 6, 5, 5, 4, 3, 2];
    for (let k = 0; k < bw.length; k++) {
      const x0 = cx + 1 - (bw[k] >> 1);
      rect(g, x0, y0 - 23 + k, bw[k], 1, '#d9d9ea'); dot(g, x0 + bw[k] - 1, y0 - 23 + k, '#a9acc6');
    }
  }
  // puntmuts
  rect(g, cx - 7, y0 - 29, 14, 2, '#3a2e7a'); rect(g, cx - 7, y0 - 29, 14, 1, '#4b3fa8');
  rect(g, cx - 4, y0 - 31, 8, 2, gold); dot(g, cx + 1, y0 - 31, goldL);
  for (let i = 0; i < 8; i++) {
    const w = 8 - i, x0 = cx - 4 + (i >> 1) + (i >= 6 ? 1 : 0);
    rect(g, x0, y0 - 32 - i, w, 1, '#6354c4'); rect(g, x0, y0 - 32 - i, Math.max(1, w >> 1), 1, '#4b3fa8');
  }
  if (!back) dot(g, cx + 1, y0 - 35, goldL);
}

/* ---------- cellen renderen ---------- */
const cache = {};
for (const dir of DIRS) {
  cache[dir] = {};
  for (const st of ['idle', 'walk']) {
    cache[dir][st] = [];
    for (let f = 0; f < FRAMES[st]; f++) {
      const t = document.createElement('canvas'); t.width = CW; t.height = CH;
      figure(t.getContext('2d'), dir[0] === 'n', f, st === 'walk');
      const c = document.createElement('canvas'); c.width = CW; c.height = CH;
      const g = c.getContext('2d');
      if (dir[1] === 'w') { g.translate(CW, 0); g.scale(-1, 1); }
      g.drawImage(t, 0, 0); g.setTransform(1, 0, 0, 1, 0, 0);
      outline(g, '#0f1226');
      cache[dir][st].push(c);
    }
  }
}
const frameOf = (st, t) => Math.floor((t || 0) * FPS[st]) % FRAMES[st];

window.WIZARD = {
  CW, CH, FX, FY, DIRS, FPS, FRAMES,
  canvas: (dir, st, t) => cache[dir][st][frameOf(st, t)],
  frame: (dir, st, f) => cache[dir][st][f],
  /* x, y = midden van de tile-ruit (TILESET.center) */
  draw(ctx, dir, st, t, x, y) { ctx.drawImage(cache[dir][st][frameOf(st, t)], Math.round(x) - FX, Math.round(y) - FY + 2); },
  /* spritesheet: per richting een rij: 2 idle-frames + 4 walk-frames */
  sheet() {
    const c = document.createElement('canvas'); c.width = 6 * CW; c.height = DIRS.length * CH;
    const g = c.getContext('2d'), map = { cell: [CW, CH], foot: [FX, FY], order: ['idle0', 'idle1', 'walk0', 'walk1', 'walk2', 'walk3'], rows: DIRS };
    DIRS.forEach((d, r) => {
      cache[d].idle.forEach((cv, i) => g.drawImage(cv, i * CW, r * CH));
      cache[d].walk.forEach((cv, i) => g.drawImage(cv, (2 + i) * CW, r * CH));
    });
    return { canvas: c, map };
  }
};
})();
