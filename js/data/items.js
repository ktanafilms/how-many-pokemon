// Objetos (reliquias globales), medallas, vitaminas y consumibles. `img` = icono del juego original.
// mods: hp, atk, as (vel. ataque), spd, crit, critDmg, tough, evasion, lifesteal,
// regen (%PS/s), power (habilidades), money, xp, heal (curación recibida), types {tipo: +daño}

export const RELICS = {
  leftovers:   { name: 'Restos', img: 'assets/items/leftovers.png', price: 70, mods: { regen: 0.008 }, desc: 'Todos tus Pokémon regeneran un 0.8% de sus PS por segundo.' },
  quickclaw:   { name: 'Garra Rápida', img: 'assets/items/quick-claw.png', price: 80, mods: { as: 0.15 }, desc: '+15% de velocidad de ataque.' },
  choiceband:  { name: 'Cinta Elegida', img: 'assets/items/choice-band.png', price: 90, mods: { atk: 0.15 }, desc: '+15% de ataque.' },
  scopelens:   { name: 'Periscopio', img: 'assets/items/scope-lens.png', price: 70, mods: { crit: 0.1 }, desc: '+10% de probabilidad de crítico.' },
  shellbell:   { name: 'Campana Concha', img: 'assets/items/shell-bell.png', price: 80, mods: { lifesteal: 0.08 }, desc: 'Todos se curan el 8% del daño que hacen.' },
  brightpowder:{ name: 'Polvo Brillo', img: 'assets/items/bright-powder.png', price: 70, mods: { evasion: 0.08 }, desc: '+8% de evasión.' },
  focussash:   { name: 'Banda Focus', img: 'assets/items/focus-sash.png', price: 100, mods: { sash: 1 }, desc: 'Una vez por combate, cada Pokémon sobrevive a un golpe fatal con 1 PS.' },
  amuletcoin:  { name: 'Moneda Amuleto', img: 'assets/items/amulet-coin.png', price: 60, mods: { money: 0.3 }, desc: '+30% de ₽ al ganar combates.' },
  luckyegg:    { name: 'Huevo Suerte', img: 'assets/items/lucky-egg.png', price: 60, mods: { xp: 0.5 }, desc: '+50% de EXP: tus Pokémon evolucionan antes.' },
  sitrusberry: { name: 'Baya Zidra', img: 'assets/items/sitrus-berry.png', price: 70, mods: { sitrus: 0.3 }, desc: 'Al bajar del 40% de PS, cura un 30% (una vez por combate).' },
  muscleband:  { name: 'Cinta Fuerte', img: 'assets/items/muscle-band.png', price: 70, mods: { hp: 0.15 }, desc: '+15% de PS máximos.' },
  expertbelt:  { name: 'Cinta Experto', img: 'assets/items/expert-belt.png', price: 80, mods: { se: 0.25 }, desc: 'Los ataques muy eficaces hacen un 25% más.' },
  wiseglasses: { name: 'Gafas Especiales', img: 'assets/items/wise-glasses.png', price: 80, mods: { power: 0.3 }, desc: 'Las habilidades son un 30% más potentes.' },
  softsand:    { name: 'Pañuelo Elegido', img: 'assets/items/choice-scarf.png', price: 50, mods: { spd: 0.2 }, desc: '+20% de velocidad de movimiento.' },
  charcoal:    { name: 'Carbón', img: 'assets/items/charcoal.png', price: 50, mods: { types: { fire: 0.35 } }, desc: 'Ataques de Fuego +35%.' },
  mysticwater: { name: 'Agua Mística', img: 'assets/items/mystic-water.png', price: 50, mods: { types: { water: 0.35 } }, desc: 'Ataques de Agua +35%.' },
  magnet:      { name: 'Imán', img: 'assets/items/magnet.png', price: 50, mods: { types: { electric: 0.35 } }, desc: 'Ataques Eléctricos +35%.' },
  miracleseed: { name: 'Semilla Milagro', img: 'assets/items/miracle-seed.png', price: 50, mods: { types: { grass: 0.35 } }, desc: 'Ataques de Planta +35%.' },
  blackbelt:   { name: 'Cinturón Negro', img: 'assets/items/black-belt.png', price: 50, mods: { types: { fighting: 0.35 } }, desc: 'Ataques de Lucha +35%.' },
  poisonbarb:  { name: 'Flecha Venenosa', img: 'assets/items/poison-barb.png', price: 50, mods: { types: { poison: 0.35 } }, desc: 'Ataques de Veneno +35%.' },
  softground:  { name: 'Arena Fina', img: 'assets/items/soft-sand.png', price: 50, mods: { types: { ground: 0.35 } }, desc: 'Ataques de Tierra +35%.' },
  silkscarf:   { name: 'Pañuelo Seda', img: 'assets/items/silk-scarf.png', price: 50, mods: { types: { normal: 0.35 } }, desc: 'Ataques de tipo Normal +35%.' },
  twistedspoon:{ name: 'Cuchara Torcida', img: 'assets/items/twisted-spoon.png', price: 50, mods: { types: { psychic: 0.35 } }, desc: 'Ataques Psíquicos +35%.' },
  spelltag:    { name: 'Hechizo', img: 'assets/items/spell-tag.png', price: 50, mods: { types: { ghost: 0.35 } }, desc: 'Ataques de Fantasma +35%.' },
  hardstone:   { name: 'Piedra Dura', img: 'assets/items/hard-stone.png', price: 50, mods: { types: { rock: 0.35 } }, desc: 'Ataques de Roca +35%.' },
  sharpbeak:   { name: 'Pico Afilado', img: 'assets/items/sharp-beak.png', price: 50, mods: { types: { flying: 0.35 } }, desc: 'Ataques Voladores +35%.' },
};

export const BADGES = {
  boulder: { name: 'Medalla Roca', img: 'assets/badges/1.png', mods: { hp: 0.25 }, desc: '+25% de PS máximos.' },
  cascade: { name: 'Medalla Cascada', img: 'assets/badges/2.png', mods: { atk: 0.25 }, desc: '+25% de ataque.' },
  thunder: { name: 'Medalla Trueno', img: 'assets/badges/3.png', mods: { as: 0.2, spd: 0.15 }, desc: '+20% vel. ataque y +15% vel. movimiento.' },
  rainbow: { name: 'Medalla Arcoíris', img: 'assets/badges/4.png', mods: { regen: 0.015, heal: 0.25 }, desc: 'Regeneración 1.5%/s y +25% curación recibida.' },
  soul:    { name: 'Medalla Alma', img: 'assets/badges/5.png', mods: { crit: 0.15, critDmg: 0.5 }, desc: '+15% crítico y +50% daño crítico.' },
  marsh:   { name: 'Medalla Pantano', img: 'assets/badges/6.png', mods: { power: 0.5 }, desc: 'Habilidades un 50% más potentes.' },
  volcano: { name: 'Medalla Volcán', img: 'assets/badges/7.png', mods: { tough: 0.15 }, desc: '+15% de dureza (menos daño recibido).' },
  earth:   { name: 'Medalla Tierra', img: 'assets/badges/8.png', mods: { money: 0.5, discount: 0.2 }, desc: '+50% de ₽ y los Pokémon cuestan un 20% menos.' },
};

export const VITAMINS = {
  protein: { name: 'Proteína', img: 'assets/items/protein.png', mods: { atk: 0.3 }, desc: '+30% de ataque' },
  iron:    { name: 'Hierro', img: 'assets/items/iron.png', mods: { tough: 0.15 }, desc: '+15% de dureza' },
  hpup:    { name: 'Más PS', img: 'assets/items/hp-up.png', mods: { hp: 0.4 }, desc: '+40% de PS máximos' },
  carbos:  { name: 'Carburante', img: 'assets/items/carbos.png', mods: { as: 0.2, spd: 0.15 }, desc: '+20% vel. ataque y +15% movimiento' },
  calcium: { name: 'Calcio', img: 'assets/items/calcium.png', mods: { power: 0.4 }, desc: '+40% poder de habilidad' },
  zinc:    { name: 'Zinc', img: 'assets/items/zinc.png', mods: { crit: 0.12, evasion: 0.06 }, desc: '+12% crítico y +6% evasión' },
};

export const CONSUMABLES = {
  potion:      { name: 'Poción', img: 'assets/items/potion.png', price: 30, desc: 'Cura un 50% de PS a la mitad de tu equipo (los más heridos primero).', battle: true },
  revive:      { name: 'Revivir', img: 'assets/items/revive.png', price: 45, desc: 'En el rancho revive 10 Pokémon debilitados. En combate revive 5 con todos los PS.', battle: true, ranch: true },
  thunderstone:{ name: 'Piedra Trueno', img: 'assets/items/thunder-stone.png', price: 40, desc: 'Lanza rayos a enemigos al azar (daño que crece cada ronda) y los aturde 1 s.', battle: true },
  meteor:      { name: 'Meteorito', img: 'assets/items/comet-shard.png', price: 50, desc: 'Elige dónde cae: daño enorme en área. Tus Pokémon salen volando pero sin daño.', battle: true, target: true },
};

export const MAX_CONSUMABLES = 4;

// Icono HTML de cualquier objeto/medalla/consumible
export const icon = (o, cls = '') => `<img class="px icon ${cls}" src="${o.img}" alt="">`;
