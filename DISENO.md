# How Many Pokémon? — Documento de diseño

Adaptación de *How Many Dudes?* (Butterscotch Shenanigans) a Pokémon 1ª generación, jugable en navegador.

## Qué es How Many Dudes (análisis del original)

- **Roguelite autobattler**: entre combates estás en tu **Rancho**, compras Dudes con dinero y pulsas *FIGHT!*.
- **Combate automático** en una arena: decenas o cientos de Dudes pequeños se lanzan contra animales grandes
  (patos, osos polares, gorilas…). Tú sólo intervienes con **consumibles** (Dude Juice, Meteoro, Rayo embotellado, Poción…).
- **Regular Dudes** baratos con *Mob Mentality* (más fuertes cuantos más hay) + **tipos especiales** con una
  habilidad cada uno (Wizard → bola de fuego, Knight → provocar, Medic → curar, Viking → furia, Finance → dinero…).
- **Ronda a ronda** por un mapa de **6 actos** (The Field, The Flats, The Barrens, The Cave, The Berg, The Coliseum),
  cada uno con jefe. Tipos de ronda: normal, *Flyer* (reclutar nuevo tipo de Dude), *Relic*, *Merchant*,
  *Food Dude* (comida = stats permanentes para un tipo), *Dude Whisperer* (entrena Regular Dudes en otro tipo),
  *Business/Smuggler/Scavenger Dude* (apuestas), *Boss*.
- **KO**: un Dude noqueado queda inconsciente unas rondas; *Dude Juice* lo revive.
- **Reliquias y Trinkets** modifican stats y habilidades. **Rasgos de enemigos**: Charger, Pinch, Venom, Peck,
  Backhand (lanzar), Starburst, Swarmer, Huge, Plagued…
- **Stats**: Max HP, Attack Power, Attack Speed, Run Speed, Crit, Toughness, Evasion, Block, Lifesteal, Cleave,
  Taunt, Throw, Stun…

## Adaptación a Pokémon

| How Many Dudes | How Many Pokémon |
|---|---|
| Rancho | Rancho Pokémon |
| Cash | Pokédólares (₽) |
| Regular Dude (*Mob Mentality*) | **Rattata** (*Manada*) |
| Tipos de Dude | 18 especies de la 1ª gen con habilidad única |
| — (nuevo) | **Evolución**: cada especie gana EXP con el daño y evoluciona (Charmander → Charmeleon → Charizard) |
| — (nuevo) | **Tabla de tipos** Gen 1: eficaz ×1.75, poco eficaz ×0.6, inmune ×0.3 |
| Flyer | **Cartel “SE BUSCA”** → elige 1 de 3 especies para desbloquear + unos cuantos gratis |
| Merchant Dude | **Tienda Pokémon** (consumibles y objetos) |
| Food Dude | **Vitaminas** (Proteína, Hierro, Más PS, Carburante, Calcio) para una especie |
| Dude Whisperer | **Guardería**: dejas Rattatas y vuelven convertidos en otra especie |
| Relics | **Objetos** (Restos, Garra Rápida, Cinta Elegida, Carbón, Imán…) |
| Jefe de acto | **Pokémon gigante** + **Medalla** como recompensa |
| Dude Juice | **Revivir** |
| Meteor / Bottled Lightning / Health Potion | **Meteorito / Piedra Trueno / Poción** |

### Actos (6 rondas cada uno; la 6ª es el jefe)
1. **Bosque Verde** — Caterpie, Metapod, Weedle, Pidgey, Spearow, Beedrill, Butterfree · Jefe **Pidgeot**
2. **Monte Moon** — Zubat, Geodude, Paras, Clefairy, Sandshrew, Sandslash, Golbat · Jefe **Onix**
3. **Costa Celeste** — Krabby, Kingler, Tentacool, Tentacruel, Shellder, Cloyster, Staryu, Starmie · Jefe **Gyarados**
4. **Torre Pokémon** — Gastly, Haunter, Cubone, Marowak, Grimer, Muk, Koffing, Weezing · Jefe **Gengar**
5. **Zona Safari** — Tauros, Rhyhorn, Rhydon, Kangaskhan, Scyther, Pinsir, Nidoking, Nidoqueen · Jefe **Snorlax**
6. **Cueva Celeste** — Electrode, Machamp, Golem, Lapras, Arcanine, Dragonite, aves legendarias · Jefe final **Mewtwo**

### Especies jugables (habilidad ↔ arquetipo del original)
| Especie | Tipo | Habilidad | Arquetipo HMD |
|---|---|---|---|
| Rattata→Raticate | Normal | Manada: +ATQ/PS por cada otro Rattata | Regular Dude |
| Pikachu→Raichu | Eléctrico | Electricidad estática → Impactrueno en cadena + aturdir | Electrician |
| Charmander→Charmeleon→Charizard | Fuego | Ascuas: bola de fuego en área | Wizard |
| Squirtle→Wartortle→Blastoise | Agua | Refugio: bloquea golpes a aliados cercanos | Spartan |
| Bulbasaur→Ivysaur→Venusaur | Planta/Veneno | Drenadoras: pulso curativo | Cleric |
| Machop→Machoke→Machamp | Lucha | Foco: entra en furia (vel. ataque y movimiento) | Viking |
| Geodude→Graveler→Golem | Roca/Tierra | Provocación + dureza | Knight |
| Abra→Kadabra→Alakazam | Psíquico | Teletransporte al enemigo más débil + golpe | Samurai |
| Zubat→Golbat | Veneno/Volador | Chupavidas (robo de vida) | Vampire |
| Gastly→Haunter→Gengar | Fantasma/Veneno | Rayo Confuso: iguala PS de aliados + evasión | Ghost |
| Ekans→Arbok | Veneno | Ácido: baja el ATQ del objetivo y envenena | Assassin |
| Meowth→Persian | Normal | Día de Pago: ₽ extra tras cada combate | Finance |
| Jigglypuff→Wigglytuff | Normal | Canto: duerme enemigos cercanos | Bard (control) |
| Chansey | Normal | Amortiguador: cura a los más heridos | Medic |
| Voltorb→Electrode | Eléctrico | Autodestrucción al caer KO | Explosive Innards |
| Cubone→Marowak | Tierra | Huesomerang a distancia (golpea 2 veces) | Ranger |
| Farfetch'd | Normal/Volador | Corte Furia: críticos que rebotan | Ninja |
| Diglett→Dugtrio | Tierra | Excavar: aparece bajo el enemigo más fuerte | Alien/Agent |

### Rasgos de enemigos
Picotazo (fallo), Veneno (vulnerabilidad), Enjambre, Estable, Enorme, Tenaza (agarre), Embestida (Charger),
Lanzar (Backhand), Rapidez estelar (Starburst), Fase (teletransporte), Plaga (menos curación), Concha (onda que lanza),
Frenesí (Slashing Rampage), Explosión, Cura aliados, Remolino (onda), Furia (Primal Rage), Somnífero, Bofetón lodo,
Púas, Pisotón, Llamarada/Trueno/Ventisca, Descanso, Psicoataque.

## Arquitectura técnica
- **HTML5 + Phaser 3** (sin Unity: más ligero en navegador y se puede publicar en itch.io o GitHub Pages tal cual).
- `js/game/sim.js`: simulación de combate pura (sin Phaser) que emite eventos → se puede testear y equilibrar en Node.
- `js/scenes/*`: Phaser dibuja la simulación (sprites 8 direcciones de PMD SpriteCollab).
- `js/ui/*`: interfaz del rancho y modales en HTML/CSS.
- `js/data/*`: todo el contenido (especies, enemigos, actos, objetos) son datos → fácil añadir la 2ª generación.
- Guardado automático en `localStorage`.

## Dificultad y progresión (v2.4, inspirado en How Many Dudes)
- **Furia acumulativa**: como el temporizador de HMD, desde los 35 s los salvajes ganan +12% de ataque cada 5 s (antes de los 60 s y cada 10 s).
- **Pokémon Alfa** (desde el Acto 2): ×3,2 PS, ×1,45 ATQ, más grandes, con Furia y Estable; contorno dorado. Se ven en la previsión del rancho.
- Rondas normales más duras (presupuesto y escalado mayores), menos dinero por ronda.
- **Ligas** (Tiers de HMD): Normal → Experta → Maestra, se desbloquean ganando la anterior. Mutadores: rondas más duras, Furia antes, más Alfa, tienda más cara, jefes con más PS, KO más largos.
- **Kill cam**: el último golpe de la ronda se ve de cerca y a cámara lenta, con bandas de cine.
