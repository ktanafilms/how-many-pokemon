# How Many Pokémon?

Roguelite autobattler para navegador inspirado en *How Many Dudes?*, con Pokémon de la 1ª generación.
¿Cuántos Pokémon hacen falta para derrotar a Mewtwo?

## Cómo jugar en local

```bash
python3 tools/serve.py
```

Abre http://localhost:8080 (hace falta servirlo por HTTP; abrir `index.html` con doble clic no funciona).

## Cómo se juega
- **Rancho**: compra Pokémon con ₽ en el panel derecho (shift+clic compra 10). Pasa el ratón por encima de cualquier cosa para ver stats y habilidades.
- **¡A LUCHAR!**: el combate es automático. Puedes usar consumibles (Poción, Revivir, Piedra Trueno, Meteorito) y cambiar la velocidad (⏸ ×1 ×2 ×4).
- **Tipos**: abajo se ven los rivales de la siguiente ronda; su ficha indica a qué tipos son débiles. Gengar, por ejemplo, es casi inmune a los ataques de tipo Normal.
- **Evolución**: cada especie gana EXP con el daño (y la curación) que hace. Al llenar la barra, todos los de esa especie evolucionan.
- **KO**: los Pokémon debilitados descansan de 1 a 3 rondas. Tras vencer a un jefe, el Centro Pokémon cura a todo el equipo.
- **Rondas especiales**: Cartel (nueva especie), Tienda, Objeto, Vitaminas, Guardería y Jefe (Medalla).
- 6 actos × 6 rondas: Bosque Verde → Monte Moon → Costa Celeste → Torre Pokémon → Zona Safari → Cueva Celeste (Mewtwo).

## Estructura
| Ruta | Qué hay |
|---|---|
| `js/data/` | Contenido: especies, enemigos, actos, objetos y tabla de tipos |
| `js/game/sim.js` | Simulación de combate pura (sin Phaser) |
| `js/game/run.js` | Partida, economía, generación de rondas y guardado |
| `js/scenes/` | Escenas de Phaser (carga, rancho, combate) |
| `js/ui/` | Interfaz HTML (rancho, ventanas de eventos) |
| `tools/fetch_sprites.py` | Descarga los sprites de PMD SpriteCollab y crea `assets/manifest.json` |
| `tools/feet.py` | Calcula dónde están los pies de cada sprite para alinearlos con la sombra |
| `tools/pack_sprites.py` | Junta las animaciones de cada Pokémon en una hoja (`assets/packed/`) para cargar rápido |
| `tools/build_arenas.py` | Compone los escenarios de cada acto y del rancho con el tileset de HGSS (`assets/arenas/`, horizontal y vertical) |
| `tools/frlg_tower.py` | Reconstruye los tiles de la Torre Pokémon de FireRed desde pret/pokefirered |
| `js/audio.js` | Música (HGSS), jingles, gritos y efectos |
| `js/ui/npc.js` | Personajes y cuadros de diálogo con texto animado |
| `tools/balance.js` | `node tools/balance.js 10` simula 10 partidas completas para equilibrar |

El diseño completo de la adaptación está en [DISENO.md](DISENO.md).

## Añadir contenido
- **Nueva especie jugable**: añade una entrada a `PLAYER` en `js/data/species.js` y, si su habilidad es nueva, impleméntala en `allyAbilities` o `allyOnHit` de `sim.js`.
- **Nuevo enemigo o acto**: `ENEMIES` y `ACTS` en el mismo archivo. Los rasgos (`traits`) reutilizables están en `sim.js`.
- **2ª generación**: cambia `DEX` en `tools/fetch_sprites.py` a `range(1, 252)` y ejecuta `fetch_sprites.py`, `feet.py` y `pack_sprites.py` (en ese orden).
- **Escenarios**: cada acto es una función en `tools/build_arenas.py`; cámbiala y ejecuta `python3 tools/build_arenas.py`.

## Móvil
En vertical la arena se gira (tus Pokémon abajo, los rivales arriba) y el rancho usa pestañas. Toca cualquier elemento para ver su información.

## Licencias
Fan game sin ánimo de lucro. Pokémon © Nintendo / Creatures / GAME FREAK.
Sprites de [PMD SpriteCollab](https://sprites.pmdcollab.org) bajo CC BY-NC 4.0, tileset de HGSS de SirMaIo/jls-dchrn e iconos de PokeAPI (detalles en [CREDITS.md](CREDITS.md)).
Motor: [Phaser 3](https://phaser.io) (MIT). Inspirado en *How Many Dudes?* de Butterscotch Shenanigans.
