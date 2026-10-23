// Consejos para el jugador: qué especies rinden mejor contra la próxima ronda.
import { PLAYER, ENEMIES, ACTS } from '../data/species.js';
import { TYPES, typeMult } from '../data/types.js';
import { enemyStats } from './run.js';

// Multiplicador medio de tipo de una especie contra los rivales (ponderado por sus PS).
export function matchup(run, key) {
  let sum = 0, w = 0;
  for (const k of run.enemies) {
    const hp = enemyStats(k, run.round).hp;
    sum += typeMult(PLAYER[key].types[0], ENEMIES[k].types) * hp;
    w += hp;
  }
  return w ? sum / w : 1;
}

export function matchTag(m) {
  if (m >= 1.2) return `<span class="match good" title="Eficaz contra la próxima ronda">▲ ×${m.toFixed(1)}</span>`;
  if (m <= 0.8) return `<span class="match bad" title="Poco eficaz contra la próxima ronda">▼ ×${m.toFixed(1)}</span>`;
  return '';
}

// Tipos de ataque que más daño hacen al rival principal (el jefe o el de más PS).
export function mainThreat(run) {
  let best = null, hp = -1;
  for (const k of new Set(run.enemies)) {
    const e = ENEMIES[k];
    const h = enemyStats(k, run.round).hp * run.enemies.filter(x => x === k).length;
    if (e.boss) return k;
    if (h > hp) { hp = h; best = k; }
  }
  return best;
}

export function weakTo(key) {
  const e = ENEMIES[key];
  return Object.keys(TYPES).filter(t => typeMult(t, e.types) > 1).sort((a, b) => typeMult(b, e.types) - typeMult(a, e.types));
}
export function resists(key) {
  const e = ENEMIES[key];
  return Object.keys(TYPES).filter(t => typeMult(t, e.types) < 1);
}

// Guardianes que presentan a cada jefe
const GUARDS = [
  { npc: 'falkner', line: '¡Mi Pidgeot domina el Bosque Verde! Con su Remolino mandará a volar a tus Pokémon.' },
  { npc: 'brock', line: '¡Mi Onix es duro como una roca! Pisotea a todo el que se le pone debajo.' },
  { npc: 'misty', line: '¡Mi Gyarados está de muy mal humor! Cuando se enfurece, su Hidrobomba arrasa con todo.' },
  { npc: 'agatha', line: 'Je, je, je… Mi Gengar atraviesa paredes y se ríe de los ataques de tipo Normal.' },
  { npc: 'ranger', line: '¡Un Snorlax gigante bloquea la Zona Safari! Y cuando le duele, se echa una siesta para recuperarse.' },
  { npc: 'giovanni', line: 'Mewtwo es el Pokémon más poderoso jamás creado. ¿Cuántos Pokémon hacen falta para vencerle? Ninguno es suficiente.' },
];

export function bossIntro(run, act) {
  const g = GUARDS[act];
  const boss = ACTS[act].boss;
  const weak = weakTo(boss).map(t => TYPES[t].name);
  const tip = weak.length ? `Consejo: le hacen mucho daño los ataques de tipo ${weak.join(', ')}.` : '';
  return { npc: g.npc, lines: [g.line, tip].filter(Boolean) };
}
