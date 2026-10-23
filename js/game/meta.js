// Progreso entre partidas (como las estrellas, coleccionables y logros de How Many Dudes):
// Pokédex de lo visto, estrellas por especie, logros y reto diario.
import { PLAYER, ENEMIES } from '../data/species.js';

const KEY = 'how-many-pokemon-meta';
export function load() {
  try { return { tier: 0, seen: {}, beaten: {}, stars: {}, ach: {}, daily: {}, best: 0, wins: 0, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch (e) { return { tier: 0, seen: {}, beaten: {}, stars: {}, ach: {}, daily: {}, best: 0, wins: 0 }; }
}
function save(m) { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) { /* nada */ } }

// Estrellas de especie: bronce/plata/oro al superar la ronda indicada con al menos N de ellos en el equipo
export const STAR_RULES = [
  { name: 'Bronce', round: 6, n: 5 },
  { name: 'Plata', round: 18, n: 10 },
  { name: 'Oro', round: 36, n: 15 },
];

export const ACHIEVEMENTS = {
  first:     { name: 'Primeros pasos', desc: 'Gana tu primer combate.' },
  badge1:    { name: 'Medalla Céfiro', desc: 'Derrota a Pidgeot.' },
  badge3:    { name: 'Lobo de mar', desc: 'Derrota a Gyarados.' },
  badge5:    { name: 'Despertador', desc: 'Derrota a Snorlax.' },
  champion:  { name: 'Campeón', desc: 'Derrota a Mewtwo.' },
  horde100:  { name: 'Marea', desc: 'Entra en combate con 100 Pokémon o más.' },
  horde250:  { name: 'Estampida', desc: 'Entra en combate con 250 Pokémon o más.' },
  perfect:   { name: 'Sin un rasguño', desc: 'Gana un combate sin que se debilite ninguno de tus Pokémon.' },
  shiny:     { name: 'Brillante', desc: 'Gana un combate contra Pokémon variocolor.' },
  giants:    { name: 'Matagigantes', desc: 'Gana un combate contra gigantes.' },
  alpha5:    { name: 'Cazador de Alfas', desc: 'Derrota a 5 Pokémon Alfa en un mismo combate.' },
  rattata:   { name: 'Rey de las ratas', desc: 'Ten 60 Rattata (o Raticate) a la vez.' },
  evolve10:  { name: 'Evolución', desc: 'Haz evolucionar a 10 especies distintas (en total).' },
  rich:      { name: 'Ahorrador', desc: 'Junta 1000 ₽.' },
  dex:       { name: 'Investigador', desc: 'Ve 40 especies salvajes distintas.' },
  daily:     { name: 'Rutina diaria', desc: 'Termina un reto diario.' },
  expert:    { name: 'Liga Experta', desc: 'Gana una partida en la Liga Experta.' },
};

// Se llama al terminar cada combate ganado. Devuelve los logros y estrellas nuevos.
export function recordBattle(run, res, battle) {
  const m = load();
  const got = [];
  const ach = k => { if (!m.ach[k]) { m.ach[k] = Date.now(); got.push({ kind: 'ach', ...ACHIEVEMENTS[k] }); } };
  for (const k of run.enemies) { m.seen[k] = (m.seen[k] || 0) + 1; if (res.win) m.beaten[k] = (m.beaten[k] || 0) + 1; }
  if (!res.win) { save(m); return got; }
  ach('first');
  const allies = battle.allies.length;
  if (allies >= 100) ach('horde100');
  if (allies >= 250) ach('horde250');
  if (res.perfect) ach('perfect');
  if (run.fightMods?.includes('shiny')) ach('shiny');
  if (run.fightMods?.includes('gigantes')) ach('giants');
  if (battle.enemies.filter(e => e.elite).length >= 5) ach('alpha5');
  const bosses = { pidgeot: 'badge1', gyarados: 'badge3', snorlax: 'badge5', mewtwo: 'champion' };
  for (const e of battle.enemies) if (bosses[e.key]) ach(bosses[e.key]);
  if ((run.team.rattata?.n || 0) >= 60) ach('rattata');
  if (run.money >= 1000) ach('rich');
  m.evolved = { ...(m.evolved || {}) };
  for (const ev of res.evolutions || []) m.evolved[ev.key] = true;
  if (Object.keys(m.evolved).length >= 10) ach('evolve10');
  if (Object.keys(m.seen).length >= 40) ach('dex');
  // estrellas de especie
  const passed = run.round + 1;
  for (const [k, t] of Object.entries(run.team)) {
    const cur = m.stars[k] || 0;
    let s = cur;
    STAR_RULES.forEach((r, i) => { if (passed >= r.round && t.n >= r.n) s = Math.max(s, i + 1); });
    if (s > cur) { m.stars[k] = s; got.push({ kind: 'star', key: k, level: s, name: `${STAR_RULES[s - 1].name}: ${PLAYER[k].stages[0].name}` }); }
  }
  m.best = Math.max(m.best || 0, passed);
  save(m);
  return got;
}

export function recordRunEnd(run, win) {
  const m = load();
  const got = [];
  if (win) { m.wins = (m.wins || 0) + 1; if ((run.tier || 0) >= 1 && !m.ach.expert) { m.ach.expert = Date.now(); got.push({ kind: 'ach', ...ACHIEVEMENTS.expert }); } }
  if (run.daily) {
    const d = m.daily[run.daily] || 0;
    m.daily[run.daily] = Math.max(d, run.round + (win ? 1 : 0));
    if (!m.ach.daily) { m.ach.daily = Date.now(); got.push({ kind: 'ach', ...ACHIEVEMENTS.daily }); }
  }
  save(m);
  return got;
}

// ---------- Reto diario: misma partida para todos ese día ----------
export const todayKey = () => new Date().toISOString().slice(0, 10);
export function seededRandom(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function hashStr(str) { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }
// ejecuta fn con Math.random sustituido por un generador con semilla (para que el reto sea igual para todos)
export function withSeed(seed, fn) {
  const orig = Math.random;
  Math.random = seededRandom(seed);
  try { return fn(); } finally { Math.random = orig; }
}

export const dexList = () => {
  // especies salvajes (sin repetir por número de Pokédex) y las tuyas
  const wild = [], seenDex = new Set();
  for (const [k, e] of Object.entries(ENEMIES)) if (!seenDex.has(e.dex)) { seenDex.add(e.dex); wild.push(k); }
  return { wild: wild.sort((a, b) => ENEMIES[a].dex - ENEMIES[b].dex), mine: Object.keys(PLAYER) };
};
