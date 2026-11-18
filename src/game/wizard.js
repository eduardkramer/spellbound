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

function drawCape(g, cx, shoulder, drift, back) {
  const shade = '#292438', fabric = '#524965', light = '#80728f';
  for (let row = 0; row <= 22; row++) {
    const sway = Math.round(drift * row / 9);
    const flare = Math.floor(row / 7);
    const left = cx - Math.min(7, 4 + row) - flare + sway;
    const right = cx + Math.min(7, 4 + row) + flare + sway;
    const y = shoulder + row;
    rect(g, left, y, right - left + 1, 1, shade);
    rect(g, left + 1, y, right - left - 1, 1, fabric);
    dot(g, left + 2 + Math.floor(row / 10), y, light);
    dot(g, right - 2 - Math.floor(row / 12), y, '#635775');
    if (back) {
      const fold = cx + sway + Math.floor(row / 10);
      rect(g, fold, y, 2, 1, shade);
      dot(g, fold - 1, y, '#70617f');
    }
    if (row === 22) rect(g, left + 2, y, right - left - 3, 1, '#72617f');
  }
  if (back) {
    dot(g, cx, shoulder + 8, '#e6c67b');
    rect(g, cx - 1, shoulder + 9, 3, 1, '#b38d53');
    dot(g, cx, shoulder + 10, '#e6c67b');
  }
}


const staffHeadHeight = 12;

function staffPixels(plot, length = 44) {
  const colors = { d: '#795137', w: '#9b6239', l: '#d39a5d',
    g: '#e8b75d', a: '#896033', b: '#20556c', t: '#36a6ad', c: '#80ebdb', h: '#effff3' };
  for (let y = staffHeadHeight; y < length; y++) {
    const band = y < 15 || (y >= 24 && y <= 26) || y >= length - 3;
    plot(3, y, '#876043'); plot(6, y, '#76503a');
    plot(4, y, band ? colors.g : colors.l);
    plot(5, y, band ? colors.a : colors.d);
  }
  const crown = [
    '.....o...',
    '....oto..',
    '...otco..',
    '..otcho..',
    '.ootccto.',
    'owobtcbo.',
    'ologtbao.',
    'odlggawo.',
    '.odwawo..',
    '..olwo...',
    '...oloo..',
    '...oldo..'
  ];
  crown.forEach((row, y) => [...row].forEach((pixel, x) => {
    if (pixel === 'o') plot(x, y, y < 7 ? '#46666c' : '#876043');
    else if (colors[pixel]) plot(x, y, colors[pixel]);
  }));
}

function drawStaffGlow(g, x, y) {
  const radius = 5;
  const glow = g.createRadialGradient(x, y, 0, x, y, radius);
  glow.addColorStop(0, 'rgba(128, 235, 219, .42)');
  glow.addColorStop(1, 'rgba(128, 235, 219, 0)');
  g.fillStyle = glow;
  g.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

/* tekent de tovenaar naar rechts-onder (voorkant) of rechts-boven (achterkant); links = gespiegeld */
function figure(g, back, f, walking, withStaff) {
  const cx = FX, fy = FY;
  const bob = walking && (f & 1) ? -1 : 0;                  // lichaam gaat op en neer tijdens het lopen
  const hd = !walking && f ? 1 : 0;                         // adem: hoofd 1 px omlaag
  const lL = walking && f === 1 ? 2 : 0, lR = walking && f === 3 ? 2 : 0;   // voet omhoog
  const arm = walking ? [0, -1, 0, 1][f] : 0, hem = walking ? [0, -1, 0, 1][f] : 0;
  const pulse = walking ? f >> 1 : f;
  const pal = back ? { m: '#52449f', d: '#43388f', l: '#6256bd' } : { m: '#5b4bb8', d: '#4b3fa8', l: '#7466d6' };
  const skin = '#d6ab84', gold = '#d9a53a', goldL = '#ffd45a';

  const shoulder = fy - 24 + bob;
  const capeSwing = walking ? [0, -1, 0, 1][f] : 0;
  if (!back) drawCape(g, cx, shoulder, capeSwing, false);

  if (withStaff) {
    const x = cx + 3;
    const y = fy - 43 + bob;
    drawStaffGlow(g, x + 5.5, y + 4.5);
    staffPixels((sx, sy, color) => dot(g, x + sx, y + sy, color));
  }

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

  if (back) {
    drawCape(g, cx, shoulder, capeSwing, true);
  } else {
    // Open kraag met twee gouden sluitingen onder de baard.
    rect(g, cx - 7, shoulder + 2, 4, 5, '#625575');
    rect(g, cx + 4, shoulder + 2, 3, 5, '#625575');
    rect(g, cx - 6, shoulder + 3, 2, 4, '#8b799b');
    dot(g, cx - 3, shoulder + 6, '#d9a85e');
    dot(g, cx + 3, shoulder + 6, '#e7c686');
    rect(g, cx - 3, shoulder + 9, 7, 1, '#ab7c49');
    rect(g, cx - 1, shoulder + 9, 3, 1, '#f3d28a');
  }

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
let staffEquipped = true;
const variants = {};
for (const withStaff of [true, false]) {
const cache = variants[withStaff] = {};
for (const dir of DIRS) {
  cache[dir] = {};
  for (const st of ['idle', 'walk']) {
    cache[dir][st] = [];
    for (let f = 0; f < FRAMES[st]; f++) {
      const t = document.createElement('canvas'); t.width = CW; t.height = CH;
      figure(t.getContext('2d'), dir[0] === 'n', f, st === 'walk', withStaff);
      const c = document.createElement('canvas'); c.width = CW; c.height = CH;
      const g = c.getContext('2d');
      if (dir[1] === 'w') { g.translate(CW, 0); g.scale(-1, 1); }
      g.drawImage(t, 0, 0); g.setTransform(1, 0, 0, 1, 0, 0);
      outline(g, '#0f1226');
      if (withStaff) {
        const pixels = g.getImageData(0, 0, CW, CH);
        const bob = st === 'walk' && (f & 1) ? -1 : 0;
        staffPixels((sx, sy) => {
          const x = dir[1] === 'w' ? CW - 1 - (FX + 3 + sx) : FX + 3 + sx;
          const y = FY - 43 + bob + sy;
          for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const px = x + dx, py = y + dy;
            if (px < 0 || px >= CW || py < 0 || py >= CH) continue;
            const index = (py * CW + px) * 4;
            if (pixels.data[index] === 15 && pixels.data[index + 1] === 18 &&
                pixels.data[index + 2] === 38 && pixels.data[index + 3]) {
              const edge = sy < 7 ? [71, 95, 98] : [117, 82, 57];
              pixels.data.set(edge, index);
            }
          }
        });
        g.putImageData(pixels, 0, 0);
      }
      cache[dir][st].push(c);
    }
  }
}
}
const currentCache = () => variants[staffEquipped];
const frameOf = (st, t) => Math.floor((t || 0) * FPS[st]) % FRAMES[st];

window.WIZARD = {
  CW, CH, FX, FY, DIRS, FPS, FRAMES,
  drawStaffIcon(g) {
    g.clearRect(0, 0, 32, 32);
    const sprite = document.createElement('canvas');
    sprite.width = 13;
    sprite.height = 44;
    const pixels = sprite.getContext('2d');
    drawStaffGlow(pixels, 7.5, 4.5);
    staffPixels((x, y, color) => dot(pixels, x + 2, y, color));
    const scale = 36 / sprite.height;
    const width = sprite.width * scale;
    const height = sprite.height * scale;
    g.save();
    g.imageSmoothingEnabled = false;
    g.translate(16, 16);
    g.rotate(Math.PI / 4);
    g.drawImage(sprite, -width / 2, -height / 2, width, height);
    g.restore();
  },
  drawSeatedStaff(g, x, y) {
    drawStaffGlow(g, x + 5.5, y + 4.5);
    staffPixels((sx, sy, color) => dot(g, x + sx, y + sy, color), 34);
    rect(g, x + 2, y + 25, 2, 2, '#d6ab84');
  },
  get staffEquipped() { return staffEquipped; },
  set staffEquipped(value) { staffEquipped = Boolean(value); },
  canvas: (dir, st, t, withStaff = staffEquipped) => variants[withStaff][dir][st][frameOf(st, t)],
  frame: (dir, st, f) => currentCache()[dir][st][f],
  /* x, y = midden van de tile-ruit (TILESET.center) */
  draw(ctx, dir, st, t, x, y) { ctx.drawImage(currentCache()[dir][st][frameOf(st, t)], Math.round(x) - FX, Math.round(y) - FY + 2); },
  /* spritesheet: per richting een rij: 2 idle-frames + 4 walk-frames */
  sheet() {
    const c = document.createElement('canvas'); c.width = 6 * CW; c.height = DIRS.length * CH;
    const g = c.getContext('2d'), map = { cell: [CW, CH], foot: [FX, FY], order: ['idle0', 'idle1', 'walk0', 'walk1', 'walk2', 'walk3'], rows: DIRS };
    DIRS.forEach((d, r) => {
      currentCache()[d].idle.forEach((cv, i) => g.drawImage(cv, i * CW, r * CH));
      currentCache()[d].walk.forEach((cv, i) => g.drawImage(cv, (2 + i) * CW, r * CH));
    });
    return { canvas: c, map };
  }
};
})();
