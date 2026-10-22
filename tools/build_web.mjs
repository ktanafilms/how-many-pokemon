// Prepara la carpeta dist/ con sólo lo que el juego necesita, lista para publicar en la web.
// Uso: node tools/build_web.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { PLAYER, ENEMIES } = await import(pathToFileURL(path.join(ROOT, 'js/data/species.js')));

// Pokémon que aparecen en el juego (jugables con sus evoluciones y enemigos)
const dex = new Set();
for (const sp of Object.values(PLAYER)) for (const s of sp.stages) dex.add(s.dex);
for (const e of Object.values(ENEMIES)) dex.add(e.dex);

fs.rmSync(DIST, { recursive: true, force: true });
const copy = (rel) => {
  const src = path.join(ROOT, rel), dst = path.join(DIST, rel);
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.cpSync(src, dst, { recursive: true });
};

for (const f of ['index.html', 'favicon.png', 'css', 'js', 'lib', 'CREDITS.md',
  'assets/fonts', 'assets/ui', 'assets/arenas3d', 'assets/maps3d', 'assets/items', 'assets/badges', 'assets/npc', 'assets/arenas',
  'assets/audio/music', 'assets/audio/jingles', 'assets/audio/sfx']) copy(f);

// Manifest recortado + sólo las hojas, retratos y gritos que se usan
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json')));
const slim = {};
for (const d of dex) {
  const m = manifest[d];
  if (!m) continue;
  slim[d] = m;
  copy(m.sheet);
  if (m.portrait) copy(m.portrait);
  copy(`assets/audio/cries/${d}.mp3`);
}
fs.writeFileSync(path.join(DIST, 'assets/manifest.json'), JSON.stringify(slim));
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');

let files = 0, bytes = 0;
const walk = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else { files++; bytes += fs.statSync(p).size; } } };
walk(DIST);
console.log(`dist/: ${files} archivos, ${(bytes / 1048576).toFixed(1)} MB, ${dex.size} Pokémon`);
