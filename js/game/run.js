// Estado de la partida: equipo, dinero, mapa de rondas, economía y guardado.
import { PLAYER, ENEMIES, ACTS, ROUNDS_PER_ACT, STAGE_MULT } from '../data/species.js';
import { RELICS, BADGES, VITAMINS, CONSUMABLES, MAX_CONSUMABLES } from '../data/items.js';

const SAVE_KEY = 'how-many-pokemon-save-v1';
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[(Math.random() * arr.length) | 0];
const shuffle = arr => arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(v => v[1]);

export const TOTAL_ROUNDS = ACTS.length * ROUNDS_PER_ACT;

export const ROUND_INFO = {
  normal:    { name: 'Combate', img: 'poke-ball', desc: '¡A luchar! Gana ₽.' },
  cartel:    { name: 'Cartel', img: 'town-map', desc: 'Al ganar, cuelga un cartel “SE BUSCA” para reclutar una especie nueva.' },
  tienda:    { name: 'Tienda Pokémon', img: 'super-potion', desc: 'Un dependiente de la Tienda Pokémon visita tu rancho.' },
  objeto:    { name: 'Objeto', img: 'rare-candy', desc: 'Al ganar, elige un objeto poderoso.' },
  vitaminas: { name: 'Vitaminas', img: 'protein', desc: 'Llega un vendedor de vitaminas: mejora permanente para una especie.' },
  guarderia: { name: 'Guardería', img: 'mystery-egg', desc: 'Deja Rattatas en la Guardería y volverán… DIFERENTES.' },
  jefe:      { name: 'Jefe', img: 'master-ball', desc: 'Un Pokémon gigante. Al ganar consigues una Medalla y el Centro Pokémon cura a todo tu equipo.' },
};

// Ligas (como los Tiers de How Many Dudes): cada una añade mutadores a la partida
export const TIERS = [
  { name: 'Liga Normal', desc: 'La aventura de siempre.', mods: {} },
  { name: 'Liga Experta', desc: 'Rondas normales un 35% más duras · la Furia llega antes · más Pokémon Alfa · la tienda un 30% más cara.', mods: { foes: 0.35, enrageStart: 25, enrageEvery: 4, alpha: 0.06, cost: 0.3 } },
  { name: 'Liga Maestra', desc: 'Rondas normales un 70% más duras · jefes con un 40% más de PS · Furia brutal · los KO duran una ronda más.', mods: { foes: 0.7, bossHp: 0.4, enrageStart: 18, enrageEvery: 3, alpha: 0.12, cost: 0.6, ko: 1 } },
];
const META_KEY = 'how-many-pokemon-meta';
export function meta() {
  try { return { tier: 0, ...JSON.parse(localStorage.getItem(META_KEY) || '{}') }; } catch (e) { return { tier: 0 }; }
}
export function unlockTier(t) {
  const m = meta();
  if (t <= m.tier) return false;
  m.tier = Math.min(t, TIERS.length - 1);
  try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch (e) { /* nada */ }
  return true;
}
export const tierMods = run => TIERS[run.tier || 0].mods;

export function newRun(starter, tier = 0) {
  const run = {
    v: 1,
    tier,
    round: 0,
    money: 40,
    unlocked: ['rattata', starter],
    team: {},
    spec: {},
    relics: [],
    badges: [],
    consumables: ['revive'],
    daycare: [],
    map: buildMap(),
    eventDone: false,
    shopStock: null,
    log: { kills: 0, dmg: 0, maxTeam: 0 },
    lastResult: null,
  };
  addUnits(run, 'rattata', 8);
  addUnits(run, starter, 3);
  prepareRound(run);
  return run;
}

function buildMap() {
  const map = [];
  for (let a = 0; a < ACTS.length; a++) {
    const mid = a === 0 ? 'tienda' : pick(['tienda', 'normal', 'guarderia']);
    const late = pick(a === 0 ? ['vitaminas', 'guarderia'] : ['vitaminas', 'guarderia', 'tienda', 'vitaminas']);
    const types = ['normal', 'cartel', mid, 'objeto', late, 'jefe'];
    if (a > 0 && !types.includes('tienda')) types[0] = 'tienda';
    for (const t of types) map.push({ type: t, act: a });
  }
  return map;
}

export function save(run) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(run)); } catch (e) { /* sin almacenamiento */ }
}
export function load() {
  try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* nada */ }
}

// ---------- Equipo ----------
export function addUnits(run, key, n) {
  const t = (run.team[key] ??= { n: 0, ko: [] });
  t.n += n;
  run.spec[key] ??= { xp: 0, stage: 0, vit: [], bought: 0 };
  if (!run.unlocked.includes(key)) run.unlocked.push(key);
}
export const conscious = (run, key) => (run.team[key] ? run.team[key].n - run.team[key].ko.length : 0);
export const totalUnits = run => Object.values(run.team).reduce((s, t) => s + t.n, 0);
export const totalConscious = run => Object.keys(run.team).reduce((s, k) => s + conscious(run, k), 0);

export function speciesName(run, key) {
  const sp = PLAYER[key];
  return sp.stages[Math.min(run.spec[key]?.stage || 0, sp.stages.length - 1)].name;
}
export function speciesDex(run, key) {
  const sp = PLAYER[key];
  return sp.stages[Math.min(run.spec[key]?.stage || 0, sp.stages.length - 1)].dex;
}

function globalMods(run) {
  const list = [...run.relics.map(k => RELICS[k].mods), ...run.badges.map(k => BADGES[k].mods)];
  return mergeMods(list);
}
function mergeMods(list) {
  const m = { types: {} };
  for (const mods of list) for (const [k, v] of Object.entries(mods)) {
    if (k === 'types') for (const [t, x] of Object.entries(v)) m.types[t] = (m.types[t] || 0) + x;
    else m[k] = (m[k] || 0) + v;
  }
  return m;
}

export function price(run, key) {
  const sp = PLAYER[key];
  const owned = run.team[key]?.n || 0;
  const g = globalMods(run);
  return Math.max(1, Math.round(sp.price * (1 + 0.035 * owned) * (1 - (g.discount || 0))));
}

export function buy(run, key, n = 1) {
  let bought = 0;
  for (let i = 0; i < n; i++) {
    const p = price(run, key);
    if (run.money < p) break;
    run.money -= p;
    addUnits(run, key, 1);
    run.spec[key].bought++;
    bought++;
  }
  return bought;
}

// Stats finales de una unidad de tu equipo para el combate.
export function unitStats(run, key) {
  const sp = PLAYER[key];
  const s = run.spec[key];
  const stage = Math.min(s.stage, sp.stages.length - 1);
  const g = globalMods(run);
  const v = mergeMods(s.vit.map(k => VITAMINS[k].mods));
  const sum = k => (g[k] || 0) + (v[k] || 0);
  const sm = STAGE_MULT[stage];
  return {
    key, name: sp.stages[stage].name, dex: sp.stages[stage].dex, stage,
    types: sp.types, atkType: sp.types[0], ability: sp.ability,
    hp: sp.hp * sm.hp * (1 + sum('hp')),
    atk: sp.atk * sm.atk * (1 + sum('atk')),
    as: sp.as * (1 + sum('as')),
    spd: sp.spd * (1 + sum('spd')),
    range: sp.range || 0,
    crit: (sp.crit || 0.05) + sum('crit'),
    critDmg: sum('critDmg'),
    tough: 1 - (1 - (sp.tough || 0)) * (1 - sum('tough')),
    evasion: Math.min(0.5, (sp.evasion || 0) + sum('evasion')),
    lifesteal: (sp.lifesteal || 0) + sum('lifesteal'),
    regen: sum('regen'),
    power: (1 + sum('power')) * (1 + 0.25 * stage),
    healMod: sum('heal'),
    se: sum('se'),
    typeBoost: g.types,
    sash: g.sash ? 1 : 0,
    sitrus: g.sitrus || 0,
    size: 1,
  };
}

// ---------- Rondas ----------
export function currentRound(run) { return run.map[run.round]; }

export function prepareRound(run) {
  run.eventDone = false;
  run.shopStock = null;
  const r = currentRound(run);
  if (!r) return;
  run.enemies = generateEnemies(run.round, r, tierMods(run));
  // Pokémon Alfa: más grandes, más duros y con un rasgo extra
  const alpha = r.type === 'jefe' || r.act === 0 ? 0 : 0.03 + 0.025 * r.act + (tierMods(run).alpha || 0);
  run.elite = run.enemies.map(() => Math.random() < alpha);
}

function enemyScale(round) {
  const act = Math.floor(round / ROUNDS_PER_ACT);
  const i = round % ROUNDS_PER_ACT;
  return ACTS[act].mult * (1 + 0.2 * i);
}

export function generateEnemies(round, r, mods = {}) {
  const act = ACTS[r.act];
  const i = round % ROUNDS_PER_ACT;
  const list = [];
  if (r.type === 'jefe') {
    list.push(act.boss);
    let budget = 3 + r.act * 3;
    const pool = act.pool.slice(0, 4);
    while (budget > 0) {
      const k = pick(pool);
      list.push(k);
      budget -= ENEMIES[k].cost;
    }
    return list;
  }
  const poolSize = Math.min(act.pool.length, 3 + i);
  const pool = act.pool.slice(0, poolSize);
  const kinds = shuffle(pool).slice(0, Math.min(pool.length, 1 + ((Math.random() * 3) | 0)));
  // garantizar la especie más fuerte desbloqueada a veces
  if (i >= 2 && Math.random() < 0.6) kinds[0] = pool[pool.length - 1];
  let budget = (13 + 7.5 * i) * (1 + 0.55 * r.act) * (1 + (mods.foes || 0) * Math.min(1, (round + 1) / 8)); // la liga se nota poco a poco
  let guard = 0;
  while (budget > 0 && guard++ < 60) {
    const opts = kinds.filter(k => ENEMIES[k].cost <= budget + 1);
    if (!opts.length) break;
    const k = pick(opts);
    list.push(k);
    budget -= ENEMIES[k].cost;
  }
  if (!list.length) list.push(kinds[0]);
  return list;
}

export function enemyStats(key, round, elite = false, mods = {}) {
  const e = ENEMIES[key];
  const sc = enemyScale(round);
  const st = {
    key, name: e.name, dex: e.dex, types: e.types, atkType: e.types[0],
    hp: e.boss ? e.hp * (1 + (mods.bossHp || 0)) : e.hp * sc * 2, atk: e.atk * Math.pow(sc, 0.8), as: e.as, spd: e.spd,
    size: e.size, boss: !!e.boss, traits: e.traits || [],
    tough: e.tough || 0, evasion: e.evasion || 0, crit: 0.05, critDmg: 0,
    lifesteal: 0, regen: 0, power: 1, range: 0,
  };
  if (elite) {
    Object.assign(st, { elite: true, name: `${e.name} Alfa`, hp: st.hp * 3.2, atk: st.atk * 1.45, as: st.as * 1.15, size: e.size * 1.35, crit: 0.15, tough: Math.max(st.tough, 0.15) });
    st.traits = [...new Set([...st.traits, 'primal', 'stable'])];
  }
  return st;
}

export function battleSetup(run) {
  const allies = [];
  for (const key of Object.keys(run.team)) {
    const n = conscious(run, key);
    if (n <= 0) continue;
    const st = unitStats(run, key);
    for (let i = 0; i < n; i++) allies.push({ ...st });
  }
  const m = tierMods(run);
  const enemies = run.enemies.map((k, i) => enemyStats(k, run.round, run.elite?.[i], m));
  return { allies, enemies, round: run.round, enrage: { start: m.enrageStart ?? 35, every: m.enrageEvery ?? 5 } };
}

// ---------- Resultado del combate ----------
export function applyBattle(run, battle) {
  const res = { win: battle.result === 'win', money: 0, evolutions: [], koReport: [], payday: 0, stats: battle.stats };
  res.names = Object.fromEntries(Object.keys(battle.stats).map(k => [k, [speciesName(run, k), speciesDex(run, k)]]));
  // KO: cada unidad debilitada queda inconsciente 1-3 rondas
  for (const [key, st] of Object.entries(battle.stats)) {
    const t = run.team[key];
    if (!t) continue;
    for (let i = 0; i < st.ko; i++) {
      const r = Math.random();
      t.ko.push((r < 0.5 ? 1 : r < 0.85 ? 2 : 3) + (tierMods(run).ko || 0));
    }
    if (st.ko) res.koReport.push({ key, n: st.ko });
    run.log.dmg += st.dmg;
    run.log.kills += st.kills;
  }
  if (!res.win) { run.lastResult = res; return res; }

  const g = globalMods(run);
  // Experiencia y evolución
  for (const [key, st] of Object.entries(battle.stats)) {
    const s = run.spec[key];
    if (!s) continue;
    s.xp += st.dmg * (1 + (g.xp || 0)) + st.heal * 0.8;
    const evo = PLAYER[key].evo;
    while (s.stage < evo.length && s.xp >= evo[s.stage]) {
      const from = speciesName(run, key);
      s.stage++;
      res.evolutions.push({ key, from, to: speciesName(run, key), dexFrom: PLAYER[key].stages[s.stage - 1].dex, dexTo: PLAYER[key].stages[s.stage].dex });
    }
  }
  // Dinero
  const killValue = run.enemies.reduce((s, k, i) => s + (ENEMIES[k].cost || 10) * (run.elite?.[i] ? 3 : 1), 0);
  const persian = (run.spec.meowth?.stage || 0) >= 1;
  res.payday = battle.stats.meowth ? battle.stats.meowth.n * (persian ? 7 : 4) : 0;
  res.money = Math.round((18 + 7 * (run.round + 1) + killValue * 1.4) * (1 + (g.money || 0))) + res.payday;
  run.money += res.money;
  run.lastResult = res;
  return res;
}

// Pasar a la siguiente ronda (tras resolver recompensas)
export function advanceRound(run) {
  const r = currentRound(run);
  // Centro Pokémon tras el jefe
  if (r.type === 'jefe') for (const t of Object.values(run.team)) t.ko = [];
  // recuperación de KO
  for (const t of Object.values(run.team)) t.ko = t.ko.map(x => x - 1).filter(x => x > 0);
  run.round++;
  // Guardería: vuelven los entrenados
  run.returned = [];
  for (const d of run.daycare) if (d.back <= run.round) { addUnits(run, d.to, d.n); run.returned.push(d); }
  run.daycare = run.daycare.filter(d => d.back > run.round);
  run.log.maxTeam = Math.max(run.log.maxTeam, totalUnits(run));
  if (run.round >= TOTAL_ROUNDS) { run.won = true; return; }
  prepareRound(run);
}

// ---------- Eventos ----------
export function shopStock(run) {
  if (run.shopStock) return run.shopStock;
  const relics = shuffle(Object.keys(RELICS).filter(k => !run.relics.includes(k))).slice(0, 3);
  const cons = shuffle(Object.keys(CONSUMABLES)).slice(0, 3);
  run.shopStock = [
    ...relics.map(k => ({ kind: 'relic', key: k, price: Math.round(RELICS[k].price * (1 + 0.25 * currentRound(run).act) * (1 + (tierMods(run).cost || 0))), sold: false })),
    ...cons.map(k => ({ kind: 'cons', key: k, price: Math.round(CONSUMABLES[k].price * (1 + 0.2 * currentRound(run).act) * (1 + (tierMods(run).cost || 0))), sold: false })),
  ];
  return run.shopStock;
}

export function buyStock(run, item) {
  if (item.sold || run.money < item.price) return false;
  if (item.kind === 'cons' && run.consumables.length >= MAX_CONSUMABLES) return false;
  run.money -= item.price;
  item.sold = true;
  if (item.kind === 'relic') run.relics.push(item.key);
  else run.consumables.push(item.key);
  return true;
}

export function cartelOptions(run) {
  const locked = Object.keys(PLAYER).filter(k => !run.unlocked.includes(k));
  return shuffle(locked).slice(0, 3);
}
export function postCartel(run, key) {
  const n = Math.max(2, Math.round(30 / PLAYER[key].price * 2));
  addUnits(run, key, n);
  return n;
}

export function relicOptions(run) {
  return shuffle(Object.keys(RELICS).filter(k => !run.relics.includes(k))).slice(0, 3);
}
export function badgeOptions(run) {
  return shuffle(Object.keys(BADGES).filter(k => !run.badges.includes(k))).slice(0, 3);
}

export function vitaminOffer(run) {
  return { list: shuffle(Object.keys(VITAMINS)).slice(0, 3), price: 50 + 35 * currentRound(run).act };
}

export function daycareOffer(run) {
  const opts = shuffle(Object.keys(PLAYER).filter(k => k !== 'rattata')).slice(0, 3);
  return { opts, price: 6 + 4 * currentRound(run).act, rounds: 2 };
}
export function sendDaycare(run, to, n, cost) {
  const t = run.team.rattata;
  const free = conscious(run, 'rattata');
  n = Math.min(n, free, Math.floor(run.money / cost));
  if (n <= 0) return 0;
  run.money -= n * cost;
  t.n -= n;
  run.daycare.push({ to, n, back: run.round + 2 });
  return n;
}

export function useRanchConsumable(run, idx) {
  const key = run.consumables[idx];
  if (key !== 'revive') return false;
  let left = 10;
  for (const t of Object.values(run.team)) {
    while (left > 0 && t.ko.length) { t.ko.pop(); left--; }
  }
  if (left === 10) return false;
  run.consumables.splice(idx, 1);
  return true;
}
