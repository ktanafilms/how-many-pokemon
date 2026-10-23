// Tabla de tipos de la 1ª generación (versión corregida de los juegos modernos).
export const TYPES = {
  normal:   { name: 'Normal',    color: '#a8a878' },
  fire:     { name: 'Fuego',     color: '#f08030' },
  water:    { name: 'Agua',      color: '#6890f0' },
  electric: { name: 'Eléctrico', color: '#f8d030' },
  grass:    { name: 'Planta',    color: '#78c850' },
  ice:      { name: 'Hielo',     color: '#98d8d8' },
  fighting: { name: 'Lucha',     color: '#c03028' },
  poison:   { name: 'Veneno',    color: '#a040a0' },
  ground:   { name: 'Tierra',    color: '#e0c068' },
  flying:   { name: 'Volador',   color: '#a890f0' },
  psychic:  { name: 'Psíquico',  color: '#f85888' },
  bug:      { name: 'Bicho',     color: '#a8b820' },
  rock:     { name: 'Roca',      color: '#b8a038' },
  ghost:    { name: 'Fantasma',  color: '#705898' },
  dragon:   { name: 'Dragón',    color: '#7038f8' },
};

const S = 2, N = 0.5, X = 0;
const CHART = {
  normal:   { rock: N, ghost: X },
  fire:     { fire: N, water: N, grass: S, ice: S, bug: S, rock: N, dragon: N },
  water:    { fire: S, water: N, grass: N, ground: S, rock: S, dragon: N },
  electric: { water: S, electric: N, grass: N, ground: X, flying: S, dragon: N },
  grass:    { fire: N, water: S, grass: N, poison: N, ground: S, flying: N, bug: N, rock: S, dragon: N },
  ice:      { fire: N, water: N, grass: S, ice: N, ground: S, flying: S, dragon: S },
  fighting: { normal: S, ice: S, poison: N, flying: N, psychic: N, bug: N, rock: S, ghost: X },
  poison:   { grass: S, poison: N, ground: N, rock: N, ghost: N },
  ground:   { fire: S, electric: S, grass: N, poison: S, flying: X, bug: N, rock: S },
  flying:   { electric: N, grass: S, fighting: S, bug: S, rock: N },
  psychic:  { fighting: S, poison: S, psychic: N },
  bug:      { fire: N, grass: S, fighting: N, poison: N, flying: N, psychic: S, ghost: N },
  rock:     { fire: S, ice: S, fighting: N, ground: N, flying: S, bug: S },
  ghost:    { normal: X, psychic: S, ghost: S },
  dragon:   { dragon: S },
};

// Suavizado para que ningún equipo quede totalmente inútil contra un jefe.
const SOFT = { 0: 0.3, 0.25: 0.4, 0.5: 0.6, 1: 1, 2: 1.75, 4: 2.5 };

export function typeMult(atkType, defTypes) {
  let m = 1;
  for (const d of defTypes) {
    const v = CHART[atkType]?.[d];
    if (v !== undefined) m *= v;
  }
  return SOFT[m] ?? m;
}

export function typeBadge(t) {
  const ty = TYPES[t];
  return `<span class="type" style="--tc:${ty.color}">${ty.name}</span>`;
}
