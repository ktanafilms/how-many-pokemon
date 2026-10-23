// Especies jugables (tus "Dudes") y enemigos salvajes.
// Stats base de la etapa 1. hp = PS, atk = daño por golpe, as = ataques/segundo,
// spd = velocidad de carrera (px/s), range = alcance extra (0 = cuerpo a cuerpo).

export const STAGE_MULT = [
  { hp: 1, atk: 1 },
  { hp: 1.75, atk: 1.65 },
  { hp: 2.7, atk: 2.5 },
];

export const PLAYER = {
  rattata: {
    stages: [{ dex: 19, name: 'Rattata' }, { dex: 20, name: 'Raticate' }],
    types: ['normal'], hp: 22, atk: 3, as: 1.1, spd: 72, price: 8, evo: [1200],
    ability: 'manada', abilityName: 'Manada',
    desc: 'Gana +3% de ATQ y PS por cada otro Rattata del equipo (máx. +90%). Raticate además tiene +15% de crítico.',
  },
  pikachu: {
    stages: [{ dex: 25, name: 'Pikachu' }, { dex: 26, name: 'Raichu' }],
    types: ['electric'], hp: 26, atk: 4, as: 1.2, spd: 85, price: 24, evo: [2500],
    ability: 'static', abilityName: 'Electricidad Estática',
    desc: 'Cada golpe le da una carga. Con 6 cargas lanza un Impactrueno que salta entre 3 enemigos (×2.5 ATQ) y los aturde. Raichu: 5 enemigos.',
  },
  charmander: {
    stages: [{ dex: 4, name: 'Charmander' }, { dex: 5, name: 'Charmeleon' }, { dex: 6, name: 'Charizard' }],
    types: ['fire'], hp: 30, atk: 4.5, as: 1, spd: 70, price: 26, evo: [1800, 9000],
    ability: 'ember', abilityName: 'Ascuas',
    desc: 'Cada 4 s lanza una bola de fuego a un enemigo aleatorio que daña en área (×3 ATQ). El área crece al evolucionar.',
  },
  squirtle: {
    stages: [{ dex: 7, name: 'Squirtle' }, { dex: 8, name: 'Wartortle' }, { dex: 9, name: 'Blastoise' }],
    types: ['water'], hp: 42, atk: 3.5, as: 0.9, spd: 62, price: 24, evo: [1800, 9000], tough: 0.15,
    ability: 'withdraw', abilityName: 'Refugio',
    desc: '25% de probabilidad de bloquear el daño directo que reciben él y los aliados cercanos. 15% de dureza.',
  },
  bulbasaur: {
    stages: [{ dex: 1, name: 'Bulbasaur' }, { dex: 2, name: 'Ivysaur' }, { dex: 3, name: 'Venusaur' }],
    types: ['grass', 'poison'], hp: 36, atk: 3.5, as: 0.9, spd: 62, price: 26, evo: [1500, 8000],
    ability: 'leech', abilityName: 'Drenadoras',
    desc: 'Cada 5 s crea un pulso en el aliado más herido que cura a todos los de alrededor (×2.5 ATQ).',
  },
  machop: {
    stages: [{ dex: 66, name: 'Machop' }, { dex: 67, name: 'Machoke' }, { dex: 68, name: 'Machamp' }],
    types: ['fighting'], hp: 38, atk: 5, as: 1, spd: 72, price: 28, evo: [2000, 10000],
    ability: 'focus', abilityName: 'Foco',
    desc: '12% de probabilidad al golpear de entrar en furia 4 s: +60% velocidad de ataque y de movimiento.',
  },
  geodude: {
    stages: [{ dex: 74, name: 'Geodude' }, { dex: 75, name: 'Graveler' }, { dex: 76, name: 'Golem' }],
    types: ['rock', 'ground'], hp: 60, atk: 3, as: 0.7, spd: 50, price: 30, evo: [1500, 8000], tough: 0.3,
    ability: 'taunt', abilityName: 'Provocación',
    desc: 'Cada 6 s provoca a 2 enemigos cercanos para que le ataquen (3 al evolucionar). 30% de dureza.',
  },
  abra: {
    stages: [{ dex: 63, name: 'Abra' }, { dex: 64, name: 'Kadabra' }, { dex: 65, name: 'Alakazam' }],
    types: ['psychic'], hp: 18, atk: 6, as: 0.8, spd: 60, price: 30, evo: [2000, 10000], evasion: 0.1,
    ability: 'teleport', abilityName: 'Teletransporte',
    desc: 'Cada 5 s se teletransporta al enemigo con menos PS y le golpea con un crítico garantizado (×2 ATQ).',
  },
  zubat: {
    stages: [{ dex: 41, name: 'Zubat' }, { dex: 42, name: 'Golbat' }],
    types: ['poison', 'flying'], hp: 24, atk: 3.5, as: 1.3, spd: 95, price: 22, evo: [2200], lifesteal: 0.35,
    ability: 'leechlife', abilityName: 'Chupavidas',
    desc: 'Se cura el 35% del daño que hace. Al curarse puede dar robo de vida a 3 aliados durante 4 s.',
  },
  gastly: {
    stages: [{ dex: 92, name: 'Gastly' }, { dex: 93, name: 'Haunter' }, { dex: 94, name: 'Gengar' }],
    types: ['ghost', 'poison'], hp: 20, atk: 4.5, as: 1, spd: 80, price: 30, evo: [2000, 10000], evasion: 0.2,
    ability: 'confuse', abilityName: 'Rayo Confuso',
    desc: '20% de evasión. Al golpear, 15% de probabilidad de igualar los PS entre el aliado más herido y el más sano, y curarlos.',
  },
  ekans: {
    stages: [{ dex: 23, name: 'Ekans' }, { dex: 24, name: 'Arbok' }],
    types: ['poison'], hp: 26, atk: 4, as: 1, spd: 75, price: 24, evo: [2200],
    ability: 'acid', abilityName: 'Ácido',
    desc: 'Sus golpes envenenan y bajan un 5% el ATQ del objetivo (acumulable 6 veces).',
  },
  meowth: {
    stages: [{ dex: 52, name: 'Meowth' }, { dex: 53, name: 'Persian' }],
    types: ['normal'], hp: 24, atk: 3.5, as: 1.1, spd: 80, price: 20, evo: [1800],
    ability: 'payday', abilityName: 'Día de Pago',
    desc: 'Cada Meowth del equipo genera ₽4 al final de cada combate (₽7 si es Persian).',
  },
  jigglypuff: {
    stages: [{ dex: 39, name: 'Jigglypuff' }, { dex: 40, name: 'Wigglytuff' }],
    types: ['normal'], hp: 42, atk: 2.5, as: 0.8, spd: 55, price: 26, evo: [1500],
    ability: 'sing', abilityName: 'Canto',
    desc: 'Cada 8 golpes canta y duerme a 3 enemigos cercanos durante 2 s. Los enemigos enormes resisten.',
  },
  chansey: {
    stages: [{ dex: 113, name: 'Chansey' }],
    types: ['normal'], hp: 75, atk: 1.5, as: 0.6, spd: 50, price: 36, evo: [],
    ability: 'softboiled', abilityName: 'Amortiguador',
    desc: 'Cada 3.5 s cura a los 2 aliados más heridos un 18% de sus PS máximos.',
  },
  voltorb: {
    stages: [{ dex: 100, name: 'Voltorb' }, { dex: 101, name: 'Electrode' }],
    types: ['electric'], hp: 22, atk: 3, as: 0.8, spd: 92, price: 18, evo: [1500],
    ability: 'selfdestruct', abilityName: 'Autodestrucción',
    desc: 'Al caer KO explota y daña a todos los enemigos cercanos (×8 ATQ).',
  },
  cubone: {
    stages: [{ dex: 104, name: 'Cubone' }, { dex: 105, name: 'Marowak' }],
    types: ['ground'], hp: 32, atk: 4, as: 0.85, spd: 65, price: 26, evo: [2200], range: 85,
    ability: 'bonemerang', abilityName: 'Huesomerang',
    desc: 'Ataca a distancia con un hueso que golpea a la ida y a la vuelta.',
  },
  farfetchd: {
    stages: [{ dex: 83, name: "Farfetch'd" }],
    types: ['normal', 'flying'], hp: 30, atk: 5.5, as: 1.2, spd: 85, price: 30, evo: [], crit: 0.2,
    ability: 'furycutter', abilityName: 'Corte Furia',
    desc: '20% de crítico. Cada crítico lanza un corte que rebota entre 3 enemigos (×0.8 ATQ).',
  },
  diglett: {
    stages: [{ dex: 50, name: 'Diglett' }, { dex: 51, name: 'Dugtrio' }],
    types: ['ground'], hp: 18, atk: 5, as: 1.2, spd: 60, price: 22, evo: [2000],
    ability: 'dig', abilityName: 'Excavar',
    desc: 'Cada 6 s se entierra y sale bajo el enemigo con más PS, golpeándole (×2.5 ATQ) y aturdiéndolo.',
  },
};

export const STARTERS = ['bulbasaur', 'charmander', 'squirtle'];

// Enemigos salvajes. size = escala del sprite. cost = peso al generar oleadas.
// Los jefes (boss) tienen PS absolutos; el resto escala con el multiplicador del acto.
export const ENEMIES = {
  // Acto 1 — Bosque Verde
  caterpie:   { dex: 10, name: 'Caterpie', types: ['bug'], hp: 45, atk: 2, as: 0.8, spd: 35, size: 1.4, cost: 2 },
  metapod:    { dex: 11, name: 'Metapod', types: ['bug'], hp: 110, atk: 1, as: 0.5, spd: 15, size: 1.5, cost: 3, tough: 0.4, traits: ['stable'] },
  weedle:     { dex: 13, name: 'Weedle', types: ['bug', 'poison'], hp: 45, atk: 3, as: 0.9, spd: 40, size: 1.4, cost: 3, traits: ['venom'] },
  pidgey:     { dex: 16, name: 'Pidgey', types: ['normal', 'flying'], hp: 55, atk: 3, as: 1, spd: 70, size: 1.6, cost: 3, traits: ['peck'] },
  spearow:    { dex: 21, name: 'Spearow', types: ['normal', 'flying'], hp: 50, atk: 4, as: 1.1, spd: 80, size: 1.6, cost: 4, traits: ['peck'] },
  beedrill:   { dex: 15, name: 'Beedrill', types: ['bug', 'poison'], hp: 90, atk: 5, as: 1.2, spd: 75, size: 1.7, cost: 6, traits: ['swarmer', 'venom'] },
  butterfree: { dex: 12, name: 'Butterfree', types: ['bug', 'flying'], hp: 120, atk: 4, as: 0.8, spd: 50, size: 1.8, cost: 8, traits: ['sleeppowder'] },
  pidgeot:    { dex: 18, name: 'Pidgeot', types: ['normal', 'flying'], hp: 3000, atk: 9, as: 0.9, spd: 70, size: 3.4, boss: true, traits: ['huge', 'gust'] },

  // Acto 2 — Monte Moon
  zubat_w:    { dex: 41, name: 'Zubat', types: ['poison', 'flying'], hp: 40, atk: 3, as: 1.2, spd: 85, size: 1.5, cost: 2, traits: ['swarmer'] },
  geodude_w:  { dex: 74, name: 'Geodude', types: ['rock', 'ground'], hp: 90, atk: 4, as: 0.7, spd: 35, size: 1.6, cost: 4, tough: 0.3, traits: ['stable'] },
  paras:      { dex: 46, name: 'Paras', types: ['bug', 'grass'], hp: 60, atk: 4, as: 0.9, spd: 40, size: 1.6, cost: 3, traits: ['plagued'] },
  clefairy:   { dex: 35, name: 'Clefairy', types: ['normal'], hp: 80, atk: 3, as: 0.8, spd: 50, size: 1.6, cost: 5, traits: ['healer'] },
  sandshrew:  { dex: 27, name: 'Sandshrew', types: ['ground'], hp: 70, atk: 4, as: 1, spd: 55, size: 1.6, cost: 4, traits: ['mud'] },
  sandslash:  { dex: 28, name: 'Sandslash', types: ['ground'], hp: 130, atk: 6, as: 1, spd: 55, size: 1.9, cost: 8, traits: ['quills', 'mud'] },
  golbat:     { dex: 42, name: 'Golbat', types: ['poison', 'flying'], hp: 100, atk: 5, as: 1.2, spd: 85, size: 1.9, cost: 7, traits: ['swarmer', 'venom'] },
  onix:       { dex: 95, name: 'Onix', types: ['rock', 'ground'], hp: 12000, atk: 11, as: 0.7, spd: 55, size: 3.8, boss: true, tough: 0.2, traits: ['huge', 'trample', 'tailwhip'] },

  // Acto 3 — Costa Celeste
  krabby:     { dex: 98, name: 'Krabby', types: ['water'], hp: 60, atk: 5, as: 0.9, spd: 50, size: 1.6, cost: 4, traits: ['pinch'] },
  kingler:    { dex: 99, name: 'Kingler', types: ['water'], hp: 140, atk: 8, as: 0.8, spd: 50, size: 2.0, cost: 9, traits: ['pinch', 'throw'] },
  tentacool:  { dex: 72, name: 'Tentacool', types: ['water', 'poison'], hp: 55, atk: 4, as: 1, spd: 55, size: 1.6, cost: 3, traits: ['venom'] },
  tentacruel: { dex: 73, name: 'Tentacruel', types: ['water', 'poison'], hp: 140, atk: 6, as: 1, spd: 55, size: 2.0, cost: 9, traits: ['venom', 'plagued'] },
  shellder:   { dex: 90, name: 'Shellder', types: ['water'], hp: 70, atk: 4, as: 0.8, spd: 40, size: 1.6, cost: 4, tough: 0.3, traits: ['shell'] },
  cloyster:   { dex: 91, name: 'Cloyster', types: ['water', 'ice'], hp: 160, atk: 6, as: 0.8, spd: 40, size: 2.0, cost: 10, tough: 0.4, traits: ['shell', 'stable'] },
  staryu:     { dex: 120, name: 'Staryu', types: ['water'], hp: 60, atk: 4, as: 1, spd: 65, size: 1.6, cost: 4, traits: ['starburst'] },
  starmie:    { dex: 121, name: 'Starmie', types: ['water', 'psychic'], hp: 130, atk: 6, as: 1, spd: 70, size: 1.9, cost: 9, traits: ['starburst', 'phased'] },
  gyarados:   { dex: 130, name: 'Gyarados', types: ['water', 'flying'], hp: 17000, atk: 12, as: 0.8, spd: 65, size: 3.8, boss: true, traits: ['huge', 'primal', 'hydro'] },

  // Acto 4 — Torre Pokémon
  gastly_w:   { dex: 92, name: 'Gastly', types: ['ghost', 'poison'], hp: 50, atk: 5, as: 1, spd: 65, size: 1.6, cost: 4, evasion: 0.15, traits: ['phased'] },
  haunter_w:  { dex: 93, name: 'Haunter', types: ['ghost', 'poison'], hp: 110, atk: 7, as: 1, spd: 65, size: 1.9, cost: 8, evasion: 0.15, traits: ['phased', 'plagued'] },
  cubone_w:   { dex: 104, name: 'Cubone', types: ['ground'], hp: 70, atk: 5, as: 0.9, spd: 55, size: 1.6, cost: 4 },
  marowak:    { dex: 105, name: 'Marowak', types: ['ground'], hp: 150, atk: 8, as: 0.8, spd: 55, size: 1.9, cost: 9, traits: ['throw'] },
  grimer:     { dex: 88, name: 'Grimer', types: ['poison'], hp: 90, atk: 4, as: 0.8, spd: 35, size: 1.7, cost: 4, traits: ['plagued'] },
  muk:        { dex: 89, name: 'Muk', types: ['poison'], hp: 200, atk: 6, as: 0.8, spd: 35, size: 2.1, cost: 10, traits: ['plagued', 'stable'] },
  koffing:    { dex: 109, name: 'Koffing', types: ['poison'], hp: 60, atk: 3, as: 0.8, spd: 45, size: 1.7, cost: 4, traits: ['explode'] },
  weezing:    { dex: 110, name: 'Weezing', types: ['poison'], hp: 140, atk: 5, as: 0.8, spd: 45, size: 2.0, cost: 9, traits: ['explode', 'plagued'] },
  gengar_w:   { dex: 94, name: 'Gengar', types: ['ghost', 'poison'], hp: 32000, atk: 16, as: 1, spd: 75, size: 3.6, boss: true, evasion: 0.1, traits: ['huge', 'phased', 'shadowball', 'plagued'] },

  // Acto 5 — Zona Safari
  tauros:     { dex: 128, name: 'Tauros', types: ['normal'], hp: 160, atk: 8, as: 0.9, spd: 75, size: 2.0, cost: 8, traits: ['charger'] },
  rhyhorn:    { dex: 111, name: 'Rhyhorn', types: ['ground', 'rock'], hp: 170, atk: 7, as: 0.7, spd: 55, size: 2.0, cost: 8, tough: 0.25, traits: ['charger', 'stable'] },
  rhydon:     { dex: 112, name: 'Rhydon', types: ['ground', 'rock'], hp: 300, atk: 11, as: 0.7, spd: 55, size: 2.4, cost: 15, tough: 0.25, traits: ['charger', 'throw'] },
  kangaskhan: { dex: 115, name: 'Kangaskhan', types: ['normal'], hp: 260, atk: 9, as: 0.9, spd: 60, size: 2.3, cost: 12, traits: ['throw'] },
  scyther:    { dex: 123, name: 'Scyther', types: ['bug', 'flying'], hp: 150, atk: 9, as: 1.3, spd: 85, size: 2.0, cost: 10, traits: ['rampage'] },
  pinsir:     { dex: 127, name: 'Pinsir', types: ['bug'], hp: 170, atk: 9, as: 0.9, spd: 60, size: 2.0, cost: 10, traits: ['throw', 'pinch'] },
  nidoking:   { dex: 34, name: 'Nidoking', types: ['poison', 'ground'], hp: 250, atk: 10, as: 0.9, spd: 60, size: 2.3, cost: 12, traits: ['venom', 'trample'] },
  nidoqueen:  { dex: 31, name: 'Nidoqueen', types: ['poison', 'ground'], hp: 280, atk: 8, as: 0.9, spd: 55, size: 2.3, cost: 12, tough: 0.2, traits: ['venom', 'stable'] },
  exeggutor:  { dex: 103, name: 'Exeggutor', types: ['grass', 'psychic'], hp: 240, atk: 8, as: 0.8, spd: 45, size: 2.3, cost: 11, traits: ['sleeppowder'] },
  snorlax:    { dex: 143, name: 'Snorlax', types: ['normal'], hp: 60000, atk: 20, as: 0.7, spd: 45, size: 4.2, boss: true, tough: 0.15, traits: ['huge', 'trample', 'rest', 'hangry'] },

  // Acto 6 — Cueva Celeste
  electrode_w:{ dex: 101, name: 'Electrode', types: ['electric'], hp: 120, atk: 6, as: 1, spd: 95, size: 1.8, cost: 7, traits: ['explode', 'swarmer'] },
  machamp_w:  { dex: 68, name: 'Machamp', types: ['fighting'], hp: 320, atk: 13, as: 1, spd: 60, size: 2.4, cost: 15, traits: ['throw'] },
  golem_w:    { dex: 76, name: 'Golem', types: ['rock', 'ground'], hp: 380, atk: 10, as: 0.7, spd: 40, size: 2.4, cost: 15, tough: 0.35, traits: ['stable', 'explode'] },
  lapras:     { dex: 131, name: 'Lapras', types: ['water', 'ice'], hp: 420, atk: 10, as: 0.8, spd: 45, size: 2.6, cost: 18, traits: ['blizzard', 'stable'] },
  arcanine:   { dex: 59, name: 'Arcanine', types: ['fire'], hp: 340, atk: 12, as: 1, spd: 90, size: 2.5, cost: 17, traits: ['charger', 'flames'] },
  dragonite:  { dex: 149, name: 'Dragonite', types: ['dragon', 'flying'], hp: 600, atk: 15, as: 0.9, spd: 70, size: 2.8, cost: 26, traits: ['gust', 'primal'] },
  articuno:   { dex: 144, name: 'Articuno', types: ['ice', 'flying'], hp: 800, atk: 14, as: 0.9, spd: 65, size: 3.0, cost: 32, traits: ['huge', 'blizzard'] },
  zapdos:     { dex: 145, name: 'Zapdos', types: ['electric', 'flying'], hp: 750, atk: 16, as: 0.9, spd: 70, size: 3.0, cost: 32, traits: ['huge', 'thunder'] },
  moltres:    { dex: 146, name: 'Moltres', types: ['fire', 'flying'], hp: 780, atk: 15, as: 0.9, spd: 70, size: 3.0, cost: 32, traits: ['huge', 'flames'] },
  mewtwo:     { dex: 150, name: 'Mewtwo', types: ['psychic'], hp: 120000, atk: 26, as: 1, spd: 80, size: 3.6, boss: true, traits: ['huge', 'psystorm', 'phased', 'primal'] },
};

export const ACTS = [
  { name: 'Bosque Verde', ground: 0x4c8a3c, ground2: 0x5a9a46, deco: 0x2f6b2a, mult: 1,
    pool: ['caterpie', 'metapod', 'weedle', 'pidgey', 'spearow', 'beedrill', 'butterfree'], boss: 'pidgeot' },
  { name: 'Monte Moon', ground: 0x6b6158, ground2: 0x7a6f64, deco: 0x4a423b, mult: 2.2,
    pool: ['zubat_w', 'geodude_w', 'paras', 'clefairy', 'sandshrew', 'sandslash', 'golbat'], boss: 'onix' },
  { name: 'Costa Celeste', ground: 0xd9c58a, ground2: 0xe4d29a, deco: 0x5aa0d8, mult: 4.2,
    pool: ['krabby', 'tentacool', 'shellder', 'staryu', 'kingler', 'tentacruel', 'cloyster', 'starmie'], boss: 'gyarados' },
  { name: 'Torre Pokémon', ground: 0x4b3f5c, ground2: 0x56496a, deco: 0x2e2638, mult: 7.5,
    pool: ['gastly_w', 'cubone_w', 'grimer', 'koffing', 'haunter_w', 'marowak', 'muk', 'weezing'], boss: 'gengar_w' },
  { name: 'Zona Safari', ground: 0x8aa04a, ground2: 0x98ad56, deco: 0x5b7a2c, mult: 12,
    pool: ['tauros', 'rhyhorn', 'scyther', 'pinsir', 'exeggutor', 'kangaskhan', 'nidoking', 'nidoqueen', 'rhydon'], boss: 'snorlax' },
  { name: 'Cueva Celeste', ground: 0x3a4a6a, ground2: 0x445678, deco: 0x222c44, mult: 20,
    pool: ['electrode_w', 'machamp_w', 'golem_w', 'arcanine', 'lapras', 'dragonite', 'articuno', 'zapdos', 'moltres'], boss: 'mewtwo' },
];

export const ROUNDS_PER_ACT = 6;

export const TRAIT_INFO = {
  stable: ['Estable', 'No puede ser lanzado ni aturdido.'],
  huge: ['Enorme', 'Tan grande que no puede ser lanzado; resiste los aturdimientos.'],
  venom: ['Veneno', 'Sus golpes aumentan el daño que recibe su objetivo (acumulable).'],
  peck: ['Picotazo', 'Sus golpes pueden hacer fallar a su objetivo durante un rato.'],
  swarmer: ['Enjambre', 'Más rápido por cada aliado de su especie cerca.'],
  sleeppowder: ['Somnífero', 'Suelta polvo que duerme a los Pokémon cercanos.'],
  plagued: ['Plaga', 'Sus golpes reducen la curación que recibe el objetivo.'],
  healer: ['Pulso Cura', 'Cura periódicamente a sus aliados.'],
  mud: ['Bofetón Lodo', 'Lanza barro que aumenta la probabilidad de fallo.'],
  quills: ['Púas', 'Devuelve daño a quien le golpea.'],
  trample: ['Pisotón', 'Daña y aturde a los Pokémon por los que pasa por encima.'],
  tailwhip: ['Coletazo', 'Puede lanzar a su objetivo por los aires.'],
  pinch: ['Tenaza', 'Puede agarrar a su objetivo y dañarlo continuamente.'],
  throw: ['Sísmico', 'Puede lanzar a su objetivo muy lejos.'],
  shell: ['Concha', 'A veces dispara desde su concha y lanza a los que tiene al lado.'],
  starburst: ['Rapidez', 'Lanza estrellas que explotan y lanzan a los Pokémon.'],
  phased: ['Fase', 'Puede teletransportarse junto a un Pokémon aleatorio.'],
  primal: ['Furia', 'Por debajo del 50% de PS ruge y gana mucho ataque.'],
  hydro: ['Hidrobomba', 'Lanza chorros de agua que dañan en área.'],
  shadowball: ['Bola Sombra', 'Lanza bolas de sombra que dañan en área.'],
  explode: ['Explosión', 'Explota al ser derrotado dañando a los de alrededor.'],
  charger: ['Derribo', 'Embiste a través del campo lanzando a todos a su paso.'],
  rampage: ['Danza Espada', 'Bajo el 50% de PS salta entre varios Pokémon cortándolos.'],
  rest: ['Descanso', 'Una vez por combate, se duerme y recupera PS.'],
  hangry: ['Hambriento', 'Al empezar arrasa el campo de batalla.'],
  blizzard: ['Ventisca', 'Ralentiza y daña en área.'],
  flames: ['Lanzallamas', 'Lanza bolas de fuego que dañan en área.'],
  thunder: ['Trueno', 'Rayos que dañan y aturden en área.'],
  gust: ['Remolino', 'Una onda de viento que lanza a todos los de su trayectoria.'],
  psystorm: ['Psicoataque', 'Ondas psíquicas que lanzan a todos los Pokémon.'],
};
