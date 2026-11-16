/* Muziekspeler. Afspeellijst komt uit tracks.js (window.TRACKS); extra nummers kun je
 * Nummers toevoegen doe je zelf in de map assets/music/ + tracks.js. */
(function () {
'use strict';
const $ = id => document.getElementById(id);
const audio = new Audio(); audio.preload = 'metadata';
const player = $('player'), seek = $('seek'), vol = $('vol');
const ICON = {
  play: '<svg viewBox="0 0 8 8"><rect x="1" y="0" width="1" height="8"/><rect x="2" y="1" width="1" height="6"/><rect x="3" y="2" width="1" height="4"/><rect x="4" y="2" width="1" height="4"/><rect x="5" y="3" width="1" height="2"/></svg>',
  pause: '<svg viewBox="0 0 8 8"><rect x="1" y="1" width="2" height="6"/><rect x="5" y="1" width="2" height="6"/></svg>',
  vol: '<svg viewBox="0 0 8 8"><rect x="0" y="3" width="2" height="2"/><rect x="2" y="2" width="1" height="4"/><rect x="3" y="1" width="1" height="6"/><rect x="5" y="2" width="1" height="1"/><rect x="6" y="3" width="1" height="2"/><rect x="5" y="5" width="1" height="1"/></svg>',
  mute: '<svg viewBox="0 0 8 8"><rect x="0" y="3" width="2" height="2"/><rect x="2" y="2" width="1" height="4"/><rect x="3" y="1" width="1" height="6"/><rect x="5" y="2" width="1" height="1"/><rect x="7" y="2" width="1" height="1"/><rect x="6" y="3" width="1" height="2"/><rect x="5" y="5" width="1" height="1"/><rect x="7" y="5" width="1" height="1"/></svg>'
};

let list = (window.TRACKS || []).map(t => Object.assign({}, t));
let idx = 0, shuffle = false, seeking = false;

const fmt = s => (isFinite(s) ? Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') : '0:00');
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
};

function show() {
  const t = list[idx];
  if (!t) { $('title').textContent = 'Nog geen muziek'; $('sub').textContent = 'zet .mp3 in assets/music/ en vul tracks.js'; return; }
  $('title').textContent = t.title || 'Naamloos';
  $('sub').textContent = (t.artist || '') + (list.length > 1 ? (t.artist ? '  ·  ' : '') + (idx + 1) + '/' + list.length : '');
}
function load(i, play) {
  if (!list.length) return;
  idx = (i + list.length) % list.length;
  audio.src = list[idx].src; show();
  seek.value = 0; $('time').textContent = '0:00 / 0:00';
  if (play) audio.play().catch(() => {});
}
function toggle() {
  if (!list.length) return;
  if (!audio.src) load(idx, true);
  else if (audio.paused) audio.play().catch(() => {}); else audio.pause();
}
function next(dir) {
  if (!list.length) return;
  if (shuffle && list.length > 1) { let n; do { n = Math.floor(Math.random() * list.length); } while (n === idx); load(n, true); }
  else load(idx + dir, true);
}

$('play').addEventListener('click', toggle);
$('next').addEventListener('click', () => next(1));
$('prev').addEventListener('click', () => { if (audio.currentTime > 3) audio.currentTime = 0; else next(-1); });
$('shuffle').addEventListener('click', e => { shuffle = !shuffle; e.currentTarget.classList.toggle('on', shuffle); });
$('mute').addEventListener('click', () => { audio.muted = !audio.muted; vis(); });
vol.addEventListener('input', () => { audio.volume = vol.value / 100; audio.muted = false; store.set('vol', vol.value); vis(); });
function vis() { $('mute').innerHTML = (audio.muted || audio.volume === 0) ? ICON.mute : ICON.vol; }

audio.addEventListener('play', () => { player.classList.add('playing'); $('play').innerHTML = ICON.pause; });
audio.addEventListener('pause', () => { player.classList.remove('playing'); $('play').innerHTML = ICON.play; });
audio.addEventListener('ended', () => next(1));
audio.addEventListener('error', () => { if (audio.src) { $('sub').textContent = 'kan bestand niet laden — controleer het pad in tracks.js'; } });
audio.addEventListener('timeupdate', () => {
  if (!seeking && audio.duration) seek.value = Math.round(audio.currentTime / audio.duration * 1000);
  $('time').textContent = fmt(audio.currentTime) + ' / ' + fmt(audio.duration);
});
seek.addEventListener('input', () => { seeking = true; });
seek.addEventListener('change', () => { if (audio.duration) audio.currentTime = seek.value / 1000 * audio.duration; seeking = false; });

addEventListener('keydown', e => {
  if (e.code === 'Space' && !/INPUT|BUTTON/.test(e.target.tagName)) { e.preventDefault(); toggle(); }
});

vol.value = store.get('vol', '60'); audio.volume = vol.value / 100;
$('play').innerHTML = ICON.play; vis();
if (list.length) audio.src = list[0].src;
show();
})();
