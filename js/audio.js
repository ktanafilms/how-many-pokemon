// Audio: música de HGSS (con fundidos), jingles, gritos de Pokémon y efectos sintetizados estilo GB.
const PREFS_KEY = 'how-many-pokemon-audio';
const prefs = (() => { try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch (e) { return {}; } })();
const state = { music: prefs.music ?? 0.5, sfx: prefs.sfx ?? 0.7 };
const savePrefs = () => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(state)); } catch (e) { /* nada */ } };

let ctx = null;
let sfxGain = null;
const cries = new Map();
let current = null; // { key, el }
let wanted = null;
let jinglePlaying = null;

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    sfxGain = ctx.createGain();
    sfxGain.gain.value = state.sfx;
    sfxGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Los navegadores sólo dejan sonar audio tras una interacción.
let unlocked = false;
function unlock() {
  if (unlocked) return;
  unlocked = true;
  ac();
  if (wanted) playMusic(wanted, true);
}
['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, unlock, { once: false, passive: true }));

// ---------- Música ----------
function fade(el, to, ms, done) {
  const from = el.volume, t0 = performance.now();
  const id = (el._fade = (el._fade || 0) + 1);
  const step = () => {
    if (el._fade !== id) return; // otro fundido o un cambio de volumen lo ha sustituido
    const k = Math.min(1, (performance.now() - t0) / ms);
    el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k < 1) requestAnimationFrame(step); else done && done();
  };
  step();
}

export function playMusic(key, force = false) {
  wanted = key;
  if (!unlocked || jinglePlaying) return;
  if (!force && current?.key === key) return;
  const old = current;
  if (old) fade(old.el, 0, 600, () => old.el.pause());
  if (!key) { current = null; return; }
  const el = new Audio(`assets/audio/music/${key}.mp3`);
  el.loop = true;
  el.volume = 0;
  el.play().catch(() => {});
  fade(el, state.music, 900);
  current = { key, el };
}

// Jingle: baja la música, suena el jingle y la recupera.
export function jingle(key) {
  if (!unlocked) return Promise.resolve();
  const el = new Audio(`assets/audio/jingles/${key}.mp3`);
  el.volume = Math.min(1, state.music * 1.2);
  if (current) { current.el.pause(); }
  jinglePlaying = el;
  return new Promise(res => {
    const end = () => {
      if (jinglePlaying === el) jinglePlaying = null;
      if (wanted && (!current || current.key !== wanted)) playMusic(wanted, true);
      else if (current) { current.el.play().catch(() => {}); }
      res();
    };
    el.onended = end;
    el.onerror = end;
    el.play().catch(end);
  });
}

// ---------- Gritos ----------
export async function cry(dex, { rate = 1, vol = 0.55 } = {}) {
  if (!unlocked || !state.sfx) return;
  const a = ac();
  let buf = cries.get(dex);
  if (buf === undefined) {
    cries.set(dex, null);
    try {
      const data = await (await fetch(`assets/audio/cries/${dex}.mp3`)).arrayBuffer();
      buf = await a.decodeAudioData(data);
      cries.set(dex, buf);
    } catch (e) { return; }
  }
  if (!buf) return;
  const src = a.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(g).connect(sfxGain);
  src.start();
}

// ---------- Efectos sintetizados ----------
const last = {};
function throttle(name, ms) {
  const now = performance.now();
  if (now - (last[name] || 0) < ms) return false;
  last[name] = now;
  return true;
}

function tone({ type = 'square', f0, f1 = f0, dur = 0.1, vol = 0.18, delay = 0 }) {
  const a = ac();
  const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(sfxGain);
  o.start(t);
  o.stop(t + dur + 0.02);
}

let noiseBuf = null;
function noise({ dur = 0.12, vol = 0.25, f = 1200, delay = 0 }) {
  const a = ac();
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate * 0.5, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = a.currentTime + delay;
  const s = a.createBufferSource(), g = a.createGain(), fl = a.createBiquadFilter();
  s.buffer = noiseBuf;
  fl.type = 'lowpass';
  fl.frequency.value = f;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(fl).connect(g).connect(sfxGain);
  s.start(t);
  s.stop(t + dur);
}

const SFX = {
  click: () => tone({ f0: 880, f1: 1320, dur: 0.05, vol: 0.12 }),
  select: () => { tone({ f0: 660, dur: 0.05, vol: 0.12 }); tone({ f0: 990, dur: 0.07, vol: 0.12, delay: 0.05 }); },
  back: () => tone({ f0: 660, f1: 330, dur: 0.08, vol: 0.12 }),
  error: () => { tone({ type: 'sawtooth', f0: 180, dur: 0.12, vol: 0.12 }); tone({ type: 'sawtooth', f0: 140, dur: 0.15, vol: 0.12, delay: 0.1 }); },
  buy: () => { tone({ f0: 1046, dur: 0.06, vol: 0.13 }); tone({ f0: 1568, dur: 0.12, vol: 0.13, delay: 0.06 }); },
  coin: () => { tone({ f0: 1318, dur: 0.05, vol: 0.1 }); tone({ f0: 1975, dur: 0.1, vol: 0.1, delay: 0.05 }); },
  text: () => tone({ type: 'square', f0: 1400 + Math.random() * 200, dur: 0.025, vol: 0.05 }),
  hit: () => { noise({ dur: 0.07, vol: 0.22, f: 900 + Math.random() * 600 }); tone({ type: 'triangle', f0: 180, f1: 70, dur: 0.07, vol: 0.2 }); },
  crit: () => { noise({ dur: 0.12, vol: 0.3, f: 2500 }); tone({ f0: 900, f1: 300, dur: 0.12, vol: 0.12 }); },
  super: () => { tone({ f0: 520, f1: 1040, dur: 0.12, vol: 0.12 }); noise({ dur: 0.1, vol: 0.22, f: 1800 }); },
  weak: () => { tone({ type: 'triangle', f0: 300, f1: 200, dur: 0.1, vol: 0.12 }); },
  faint: () => tone({ f0: 700, f1: 120, dur: 0.35, vol: 0.12 }),
  allyKo: () => tone({ type: 'triangle', f0: 500, f1: 150, dur: 0.18, vol: 0.08 }),
  boom: () => { noise({ dur: 0.5, vol: 0.45, f: 500 }); tone({ type: 'sine', f0: 120, f1: 40, dur: 0.45, vol: 0.35 }); },
  fire: () => noise({ dur: 0.25, vol: 0.2, f: 3000 }),
  zap: () => { for (let i = 0; i < 4; i++) tone({ type: 'sawtooth', f0: 1200 - i * 150, f1: 300, dur: 0.05, vol: 0.08, delay: i * 0.03 }); },
  heal: () => { [523, 659, 784, 1046].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.1, vol: 0.1, delay: i * 0.06 })); },
  throw: () => tone({ type: 'triangle', f0: 300, f1: 900, dur: 0.15, vol: 0.1 }),
  roar: () => { noise({ dur: 0.6, vol: 0.35, f: 600 }); tone({ type: 'sawtooth', f0: 110, f1: 70, dur: 0.6, vol: 0.2 }); },
  pop: () => tone({ f0: 400, f1: 1200, dur: 0.08, vol: 0.12 }),
  whoosh: () => noise({ dur: 0.35, vol: 0.2, f: 1400 }),
  start: () => { [392, 523, 659, 784].forEach((f, i) => tone({ f0: f, dur: 0.12, vol: 0.12, delay: i * 0.07 })); },
};
const LIMITS = { hit: 70, crit: 120, super: 160, weak: 200, allyKo: 90, faint: 120, text: 35, boom: 150, fire: 120, zap: 120, throw: 100, coin: 80 };

export function sfx(name) {
  if (!unlocked || !state.sfx || !SFX[name]) return;
  if (LIMITS[name] && !throttle(name, LIMITS[name])) return;
  ac();
  SFX[name]();
}

// ---------- Volumen ----------
export const volumes = () => ({ ...state });
export function setMusic(v) {
  state.music = v;
  if (current) { current.el._fade = (current.el._fade || 0) + 1; current.el.volume = v; }
  savePrefs();
}
export function setSfx(v) {
  state.sfx = v;
  if (sfxGain) sfxGain.gain.value = v;
  savePrefs();
}
