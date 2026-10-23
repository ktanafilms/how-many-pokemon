// Mapas 3D reales de HeartGold/SoulSilver alrededor de la arena.
// Se abre un hueco donde está la arena y se aplana lo que queda entre la cámara y el combate.
import * as THREE from '../../lib/three.module.min.js';
import { ColladaLoader } from '../../lib/three-addons/ColladaLoader.js';

// Qué mapa rodea cada acto y qué se pone más allá de sus bordes
export const MAPS = {
  // floor 'map': el suelo de la arena es el del propio mapa (se aplana lo que sobresale)
  // floor 'own': se abre un hueco y se ve el suelo propio de la arena
  0: { dir: 'act0', filler: 'trees', offset: [0, 0.18], floor: 'map' },  // Bosque Verde ← Viridian Forest
  1: { dir: 'mtmoon1', filler: null, offset: [0, 0], floor: 'own', auto: true, ownTex: /^droad01\./ },         // Monte Moon ← Mt. Moon Square
  2: { dir: null, filler: 'sea', offset: [0, 0], floor: 'own' },        // Costa Celeste: playa propia en mitad del mar
  3: { dir: 'act3', filler: 'trees', offset: [0, -0.05], floor: 'map' },     // Torre Pokémon ← Pueblo Lavanda
  4: { dir: 'act4', filler: 'trees', offset: [0, 0], floor: 'map' },      // Zona Safari ← Safari (bosque)
  5: { dir: 'act5', filler: null, offset: [0, 0], floor: 'own', auto: true, maxScale: 2.4, ownTex: /^droad01\./ },         // Cueva Celeste ← Cueva Celeste 1F
};

// franja (unidades del mundo) al sur de la arena que se despeja para que la cámara vea a todos
const SOUTH_BAND = 340;

// techo de las paredes (allpeak) y relleno negro de las cuevas (d_ro): nunca es suelo
const ROOF = /allpeak|^d_ro\b|^d_ro\./i;

// agua (mar, estanques): nunca es suelo donde luchar
const WATER = /^d?(sea|pond|river|water|umi|lake)/i;
function triMat(o, i) {
  if (!Array.isArray(o.material)) return o.material;
  const g = o.geometry.groups.find(g => i >= g.start && i < g.start + g.count);
  return o.material[g?.materialIndex || 0];
}

const cache = new Map();
function loadDae(dir) {
  if (!cache.has(dir)) cache.set(dir, new ColladaLoader().loadAsync(`assets/maps3d/${dir}/map.dae`).then(c => c.scene));
  // clone(true) comparte geometrías y materiales: se clonan los materiales al aplicar el hueco
  return cache.get(dir).then(s => s.clone(true));
}

// Altura del suelo: la superficie horizontal con más área
// (y de paso el material de ese suelo y cuántas unidades del mundo ocupa una repetición de su textura)
function floorLevel(obj, info = null) {
  const buckets = new Map(), mats = new Map();
  const ua = new THREE.Vector2(), ub = new THREE.Vector2();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  obj.updateMatrixWorld(true);
  obj.traverse(o => {
    if (!o.isMesh) return;
    const p = o.geometry.attributes.position, idx = o.geometry.index;
    const cnt = idx ? idx.count : p.count;
    for (let i = 0; i < cnt; i += 3) {
      const ia = idx ? idx.getX(i) : i, ib = idx ? idx.getX(i + 1) : i + 1, ic = idx ? idx.getX(i + 2) : i + 2;
      a.fromBufferAttribute(p, ia).applyMatrix4(o.matrixWorld);
      b.fromBufferAttribute(p, ib).applyMatrix4(o.matrixWorld);
      c.fromBufferAttribute(p, ic).applyMatrix4(o.matrixWorld);
      n.subVectors(b, a).cross(c.clone().sub(a));
      const area = n.length() / 2;
      // ni el agua ni la parte de arriba de paredes/acantilados (allpeak) cuentan como suelo
      if (WATER.test(triMat(o, i)?.name || '') || ROOF.test(triMat(o, i)?.name || '')) continue;
      if (area < 1e-6 || Math.abs(n.y) / (2 * area) < 0.95) continue;
      const y = Math.round((a.y + b.y + c.y) / 3);
      buckets.set(y, (buckets.get(y) || 0) + area);
      if (info && o.geometry.attributes.uv) {
        const m = triMat(o, i);
        if (!m?.map) continue;
        const e = (mats.get(m) || { y, area: 0, w: 0, u: 0 });
        if (e.y === y) {
          const uv = o.geometry.attributes.uv;
          ua.fromBufferAttribute(uv, ia); ub.fromBufferAttribute(uv, ib);
          const du = ua.distanceTo(ub);
          if (du > 1e-4) { e.w += a.distanceTo(b); e.u += du; }
          e.area += area;
          mats.set(m, e);
        }
      }
    }
  });
  let best = 0, bestA = -1;
  for (const [y, ar] of buckets) if (ar > bestA) { bestA = ar; best = y; }
  if (info) info.cands = [...mats].filter(([, e]) => e.y === best && e.u > 0).sort((a, b) => b[1].area - a[1].area);
  return best;
}

// El suelo "limpio" (cuando ya han cargado las texturas): se descartan las oscuras
// (sombras pintadas) o con mucho contraste (tocones, bordes)
async function pickFloor(info) {
  const ready = () => info.cands.every(([m]) => m.map.image?.width);
  for (let i = 0; i < 40 && !ready(); i++) await new Promise(r => setTimeout(r, 50));
  const c = info.cands.find(([m]) => plainTexture(m.map));
  if (c) { info.mat = c[0]; info.repeatWorld = c[1].w / c[1].u; }
}

function plainTexture(tex) {
  const img = tex.image;
  if (!img?.width) return false;
  const cv = document.createElement('canvas');
  const n0 = Math.min(64, img.width);
  cv.width = cv.height = n0;
  const g = cv.getContext('2d');
  g.drawImage(img, 0, 0, n0, n0);
  const d = g.getImageData(0, 0, n0, n0).data;
  let sum = 0, sq = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) return false;
    const l = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
    sum += l; sq += l * l; n++;
  }
  const mean = sum / n, sd = Math.sqrt(Math.max(0, sq / n - mean * mean));
  return mean > 0.22 && sd < 0.05;
}

// Máscara de borde irregular: dentro de la arena todo; en el margen de fuera, casillas sueltas al azar
// (debajo de la arena el mapa está recortado, así que ahí no puede haber huecos)
// Borde de la isla de Costa Celeste: casillas sueltas en los bordes de fuera (como la arena de HGSS)
export function islandMask(w, h, tile = 32) {
  const nx = Math.ceil(w / tile), nz = Math.ceil(h / tile);
  const cv = document.createElement('canvas');
  cv.width = nx; cv.height = nz;
  const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, nx, nz);
  g.fillStyle = '#000';
  for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
    const d = Math.min(x, nx - 1 - x, nz - 1 - z);
    if (d === 0 && Math.random() < 0.55) g.fillRect(x, z, 1, 1);
    else if (d === 1 && Math.random() < 0.15) g.fillRect(x, z, 1, 1);
  }
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

function jaggedMask(w, h, tile, iw, ih) {
  const nx = Math.ceil(w / tile), nz = Math.ceil(h / tile);
  const cv = document.createElement('canvas');
  cv.width = nx; cv.height = nz;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, nx, nz);
  g.fillStyle = '#fff';
  for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
    const cx = (x + 0.5) * tile - w / 2, cz = (z + 0.5) * tile - h / 2;
    const inside = Math.abs(cx) < iw / 2 + tile / 2 && Math.abs(cz) < ih / 2 + tile / 2;
    // al sur (hacia la cámara) el borde es recto: ahí detrás sólo hay la franja aplanada
    const p = inside || cz > ih / 2 ? 1 : 0.45;
    if (Math.random() < p) g.fillRect(x, z, 1, 1);
  }
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

// Plano grande con el mismo suelo del mapa, para que lo recortado no deje ver otra cosa
function floorPlane(info, scale, size = 9000, sizeZ = size) {
  const tex = info.mat.map.clone();
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(size / (info.repeatWorld * scale), sizeZ / (info.repeatWorld * scale));
  tex.needsUpdate = true;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, sizeZ), new THREE.MeshLambertMaterial({ map: tex, color: info.mat.color || 0xffffff }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return mesh;
}

// Parchea un material para descartar lo que cae dentro de la arena y aplanar el lado de la cámara
function holeMaterial(m, hole) {
  // la hierba alta original de HGSS (texturas egrass) se conserva también dentro de la arena
  const tallGrass = /egrass/i.test(m.name || '') || /egrass/i.test(m.map?.name || '') || /egrass/i.test(m.map?.image?.src || '');
  // el terreno elevado (mesetas, cuestas, caminos) se aplana dentro de la arena en vez de recortarse
  const terrain = !tallGrass && /^(grass|cliff|slope|road|ground|sand|allpeak|dirt|field|a17_gt|wall01|beach|dcliff|dslope|droad|dwall)/i.test(m.name || '');
  m = m.clone();
  if (m.map) { m.map.magFilter = THREE.NearestFilter; m.map.minFilter = THREE.NearestFilter; m.map.colorSpace = THREE.SRGBColorSpace; m.map.generateMipmaps = false; m.map.needsUpdate = true; }
  m.alphaTest = 0.5;
  m.transparent = false;
  m.side = THREE.DoubleSide;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uHole: { value: hole.rect }, uSouth: { value: hole.south }, uFloor: { value: hole.floor }, uInside: { value: tallGrass ? (hole.inside < 1e5 ? -1e6 : 1e6) : hole.inside } });
    sh.vertexShader = 'varying vec3 vWorldH;\nuniform vec4 uHole;\nuniform float uFloor;\nuniform float uInside;\nuniform float uSouth;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vWorldH = (modelMatrix * vec4(transformed, 1.0)).xyz;
      ${terrain ? `bool inArena = uInside < 1e5 && vWorldH.x > uHole.x - 40.0 && vWorldH.x < uHole.z + 40.0 && vWorldH.z > uHole.y - 40.0 && vWorldH.z < uHole.w + 40.0;
      bool inBand = vWorldH.z > uSouth - 20.0 && vWorldH.z < uSouth + ${SOUTH_BAND.toFixed(1)} + 20.0;
      // todo el terreno (mesetas y hondonadas) queda a ras de suelo: sin paredes cortadas ni zanjas
      if ((inArena || inBand) && abs(vWorldH.y - uFloor) > 2.0) {
        vWorldH.y = uFloor;
        gl_Position = projectionMatrix * viewMatrix * vec4(vWorldH, 1.0);
      }` : ''}`);
    sh.fragmentShader = 'varying vec3 vWorldH;\nuniform vec4 uHole;\nuniform float uSouth;\nuniform float uFloor;\nuniform float uInside;\n' + sh.fragmentShader.replace('void main() {', `void main() {
      if (vWorldH.x > uHole.x && vWorldH.x < uHole.z && vWorldH.z > uHole.y && vWorldH.z < uHole.w && vWorldH.y > uInside) discard;
      // franja entre la arena y la cámara: sin árboles (ni sus sombras pintadas), más allá todo sigue
      if (vWorldH.z > uSouth && vWorldH.z < uSouth + ${SOUTH_BAND.toFixed(1)} && vWorldH.y > uFloor + 6.0) discard;`).replace('#include <map_fragment>', `#include <map_fragment>
      // dentro de la arena, fuera las sombras pintadas de los árboles que ya no están
      if (uInside < 1e5 && vWorldH.x > uHole.x && vWorldH.x < uHole.z && vWorldH.z > uHole.y && vWorldH.z < uHole.w + ${SOUTH_BAND.toFixed(1)} && dot(diffuseColor.rgb, vec3(0.333)) < 0.16) discard;`);
  };
  m.customProgramCacheKey = () => 'hole' + (tallGrass ? 'g' : '') + (terrain ? 't' : '');
  return m;
}

// Rejilla de alturas del mapa (sin escalar): por celda, la altura mínima y máxima de lo que hay
function heightGrid(obj, cell) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const nx = Math.ceil((box.max.x - box.min.x) / cell), nz = Math.ceil((box.max.z - box.min.z) / cell);
  const hi = new Float32Array(nx * nz).fill(-Infinity), lo = new Float32Array(nx * nz).fill(Infinity);
  const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  obj.traverse(o => {
    if (!o.isMesh) return;
    const p = o.geometry.attributes.position, idx = o.geometry.index;
    const cnt = idx ? idx.count : p.count;
    for (let i = 0; i < cnt; i += 3) {
      for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(p, idx ? idx.getX(i + k) : i + k).applyMatrix4(o.matrixWorld);
      const x0 = Math.floor((Math.min(v[0].x, v[1].x, v[2].x) - box.min.x) / cell), x1 = Math.floor((Math.max(v[0].x, v[1].x, v[2].x) - box.min.x - 1e-3) / cell);
      const z0 = Math.floor((Math.min(v[0].z, v[1].z, v[2].z) - box.min.z) / cell), z1 = Math.floor((Math.max(v[0].z, v[1].z, v[2].z) - box.min.z - 1e-3) / cell);
      const mn = triMat(o, i)?.name || '';
      if (/egrass/i.test(mn)) continue; // la hierba alta se puede pisar
      const water = WATER.test(mn);
      const yMax = water ? 1e6 : Math.max(v[0].y, v[1].y, v[2].y), yMin = Math.min(v[0].y, v[1].y, v[2].y);
      for (let z = Math.max(0, z0); z <= Math.min(nz - 1, z1); z++) for (let x = Math.max(0, x0); x <= Math.min(nx - 1, x1); x++) {
        const c = z * nx + x;
        if (yMax > hi[c]) hi[c] = yMax;
        if (yMin < lo[c]) lo[c] = yMin;
      }
    }
  });
  return { nx, nz, hi, lo, box, cell };
}

// ---------- Piezas sueltas de los mapas de HGSS ----------
// Las rocas del mar y de tierra vienen fundidas en la malla del terreno: se separan por material
// y por triángulos conectados. Cada pieza queda centrada en su base.
const pieceCache = new Map();
function pieces(dir, re) {
  const key = dir + re;
  if (!pieceCache.has(key)) pieceCache.set(key, loadDae(dir).then(sc => {
    sc.updateMatrixWorld(true);
    const out = [];
    const v = new THREE.Vector3();
    sc.traverse(o => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const geo = o.geometry, pos = geo.attributes.position, uv = geo.attributes.uv, idx = geo.index;
      const groups = geo.groups.length ? geo.groups : [{ start: 0, count: idx ? idx.count : pos.count, materialIndex: 0 }];
      for (const g of groups) {
        const m = mats[g.materialIndex || 0];
        if (!re.test(m?.name || '')) continue;
        // unión de triángulos que comparten vértices (misma posición)
        const ids = new Map(), parent = [];
        const find = a => { while (parent[a] !== a) a = parent[a] = parent[parent[a]]; return a; };
        const tris = [];
        for (let i = g.start; i < g.start + g.count; i += 3) {
          const t = [0, 1, 2].map(k => idx ? idx.getX(i + k) : i + k);
          // cada roca ocupa una casilla de 16: se agrupa por casilla (centro del triángulo) y vértices compartidos
          let cx = 0, cz = 0;
          for (const vi of t) { v.fromBufferAttribute(pos, vi).applyMatrix4(o.matrixWorld); cx += v.x / 3; cz += v.z / 3; }
          const tile = `${Math.floor(cx / 32)},${Math.floor(cz / 32)}`;
          const ks = t.map(vi => { v.fromBufferAttribute(pos, vi).applyMatrix4(o.matrixWorld); return `${tile}|${v.x.toFixed(1)},${v.y.toFixed(1)},${v.z.toFixed(1)}`; });
          const ns = ks.map(k => { if (!ids.has(k)) { ids.set(k, parent.length); parent.push(parent.length); } return ids.get(k); });
          parent[find(ns[1])] = find(ns[0]); parent[find(ns[2])] = find(ns[0]);
          tris.push({ t, n: ns[0] });
        }
        const comps = new Map();
        for (const tr of tris) { const r = find(tr.n); if (!comps.has(r)) comps.set(r, []); comps.get(r).push(tr.t); }
        for (const list of comps.values()) {
          const P = [], U = [];
          for (const t of list) for (const vi of t) {
            v.fromBufferAttribute(pos, vi).applyMatrix4(o.matrixWorld);
            P.push(v.x, v.y, v.z);
            if (uv) U.push(uv.getX(vi), uv.getY(vi));
          }
          const bg = new THREE.BufferGeometry();
          bg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
          if (uv) bg.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
          bg.computeBoundingBox();
          const b = bg.boundingBox, sz = b.getSize(v.clone());
          // sólo objetos completos y "macizos": fuera bordes, sombras y esquirlas finas
          // (las rocas de HGSS son cuadros inclinados hacia la cámara: piezas de 2 triángulos)
          if (list.length < 2 || sz.y < 8 || sz.x < 12 || Math.max(sz.x, sz.z) > 40) continue;
          bg.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
          bg.computeVertexNormals();
          const mm = m.clone();
          if (mm.map) { mm.map.magFilter = mm.map.minFilter = THREE.NearestFilter; mm.map.colorSpace = THREE.SRGBColorSpace; mm.map.generateMipmaps = false; mm.map.needsUpdate = true; }
          mm.alphaTest = 0.5; mm.side = THREE.DoubleSide;
          out.push({ geo: bg, mat: mm, size: sz.clone() });
        }
      }
    });
    return out;
  }));
  return pieceCache.get(key);
}

// Costa Celeste: rocas en el mar alrededor de la isla y rocas, rocas rompibles y un cartel en la orilla
async function decorateIsland(scene, W, H) {
  let sea = [], land = [], small = [], signs = [];
  try {
    [sea, land, small, signs] = await Promise.all([
      pieces('act2', /^sea_rock/i), pieces('act2', /^rock01/i), pieces('route19', /^obj/i), pieces('route19', /^board_[ef]/i),
    ]);
  } catch (e) { console.warn('adornos de la playa no disponibles', e); return; }
  const rnd = (a, b) => a + Math.random() * (b - a);
  const put = (p, x, y, z, k) => {
    const m = new THREE.Mesh(p.geo, p.mat);
    m.position.set(x, y, z);
    m.scale.setScalar(k);
    // sin girar: están hechas para verse desde la cámara (de sur a norte)
    m.receiveShadow = true;
    scene.add(m);
  };
  // isla de arena: arena W+520 de ancho y del norte (-H/2+30) a H/2+220
  const ix = W / 2 + 260, iz0 = -H / 2 + 30, iz1 = H / 2 + 220;
  const free = (x, z, m) => !(Math.abs(x) < ix + m && z > iz0 - m && z < iz1 + m);
  // en el mar (no delante de la cámara)
  // en grupitos de 1 a 3, como en los mapas de HGSS
  if (sea.length) for (let i = 0, n = 0; i < 400 && n < 40; i++) {
    const x = rnd(-W / 2 - 900, W / 2 + 900), z = rnd(-H / 2 - 700, H / 2 + 260);
    if (!free(x, z, 70) || (z > H / 2 && Math.abs(x) < W / 2 + 400)) continue;
    const k = 1 + ((Math.random() * 3) | 0);
    for (let j = 0; j < k; j++) put(sea[(Math.random() * sea.length) | 0], x + j * 64, -14, z + (j % 2) * 30, 2);
    n += k;
  }
  // en la arena de alrededor de la arena de combate
  const shore = [...land, ...small];
  if (shore.length) for (let i = 0, n = 0; i < 300 && n < 18; i++) {
    const x = rnd(-ix + 30, ix - 30), z = rnd(iz0 + 20, H / 2 + 120);
    if (Math.abs(x) < W / 2 + 40 && z < H / 2 + 20) continue; // dentro de la zona de combate no
    if (z > H / 2 + 20 && Math.abs(x) < W / 2 - 100) continue; // ni delante de la cámara
    put(shore[(Math.random() * shore.length) | 0], x, -0.6, z, 2);
    n++;
  }
  if (signs.length) put(signs[0], -W / 2 - 120, -0.6, -H / 2 + 120, 2);
}

// Mar con la textura de agua de HGSS (se desplaza despacio para que parezca que se mueve)
function addSea(scene) {
  // la textura de HGSS es sólo la espuma (transparente): se pinta sobre el azul del mar
  const cv = document.createElement('canvas');
  cv.width = cv.height = 32;
  const g = cv.getContext('2d');
  g.fillStyle = '#3f86d8';
  g.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(cv);
  const img = new Image();
  img.onload = () => { g.drawImage(img, 0, 0); tex.needsUpdate = true; };
  img.src = 'assets/maps3d/act2/sea_on.1.png';
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(9000 / 64, 9000 / 64);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshLambertMaterial({ map: tex }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -14;
  sea.onBeforeRender = () => { const t = performance.now() / 1000; tex.offset.set(t * 0.05, Math.sin(t * 0.4) * 0.08); };
  scene.add(sea);
}

// Descarga y prepara por adelantado el mapa de un acto (se queda en caché)
export function preloadMap(act) {
  const cfg = MAPS[act];
  if (!cfg?.dir) { if (cfg) { loadDae('act2').catch(() => {}); loadDae('route19').catch(() => {}); } return; }
  loadDae(cfg.dir).catch(() => {});
  if (cfg.filler === 'trees') loadDae('trees').catch(() => {});
}

// Busca la zona más llana y despejada del mapa donde cabe la arena (y la franja de cámara al sur).
// Devuelve la escala y el centro (en coordenadas del mapa sin escalar).
function findSpot(grid, floor, W, H, maxScale = 9) {
  const { nx, nz, hi, lo, box, cell } = grid;
  // celda bloqueada: algo que sobresale (árbol, casa, roca), un desnivel o vacío/agua
  const blocked = new Float32Array(nx * nz);
  for (let c = 0; c < nx * nz; c++) blocked[c] = hi[c] === -Infinity || hi[c] > floor + 3 || lo[c] < floor - 3 ? 1 : 0;
  const I = new Float32Array((nx + 1) * (nz + 1)); // imagen integral
  for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) I[(z + 1) * (nx + 1) + x + 1] = blocked[z * nx + x] + I[z * (nx + 1) + x + 1] + I[(z + 1) * (nx + 1) + x] - I[z * (nx + 1) + x];
  const sum = (x, z, w, h) => I[(z + h) * (nx + 1) + x + w] - I[z * (nx + 1) + x + w] - I[(z + h) * (nx + 1) + x] + I[z * (nx + 1) + x];
  let best = null;
  for (const s of [2, 2.4, 2.8, 3.2, 3.8, 4.4].filter(s => s <= maxScale)) {
    const w = Math.ceil(W / s / cell), h = Math.ceil((H + 60) / s / cell);
    if (w > nx || h > nz) continue;
    for (let z = 0; z + h <= nz; z++) for (let x = 0; x + w <= nx; x++) {
      const frac = sum(x, z, w, h) / (w * h);
      const score = frac + 0.05 * (s - 2);
      if (!best || score < best.score) best = { score, s, cx: box.min.x + (x + w / 2) * cell, cz: box.min.z + (z + (h - 60 / s / cell) / 2) * cell };
    }
  }
  return best;
}

export async function addMap(scene, act, W, H) {
  const cfg = MAPS[act];
  if (!cfg) return false;
  if (!cfg.dir) { addSea(scene); await decorateIsland(scene, W, H); return { floor: cfg.floor, island: true }; }
  const map = await loadDae(cfg.dir);
  // escala y sitio: la zona más despejada del mapa, con tiles de HGSS (16) al menos al tamaño de los de la arena (32)
  // (con suelo propio, el mapa sólo decora alrededor: se coloca a mano con cfg.offset)
  let spot = null;
  if (cfg.floor === 'map' || cfg.auto) spot = findSpot(heightGrid(map, 8), floorLevel(map), W, H, cfg.maxScale);
  if (!spot) {
    const sz = new THREE.Box3().setFromObject(map).getSize(new THREE.Vector3());
    const s0 = Math.max(2, (W + 420) / sz.x, (H + 360) / sz.z);
    const c = new THREE.Box3().setFromObject(map).getCenter(new THREE.Vector3());
    spot = { s: s0, cx: c.x - cfg.offset[0] * sz.x, cz: c.z - cfg.offset[1] * sz.z };
  }
  const s = spot.s;
  map.scale.multiplyScalar(s);
  map.updateMatrixWorld(true);
  const info = {};
  const floor = floorLevel(map, info);
  map.position.set(-spot.cx * s, -floor - 0.8, -spot.cz * s);
  // bajo el mapa, su mismo suelo: los huecos y bordes se ven como hierba/tierra del propio mapa
  if (cfg.floor === 'map') await pickFloor(info);
  if (info.mat && cfg.floor === 'map') {
    const fp = floorPlane(info, 1, 9000, 9000);
    fp.position.y = -1.6;
    scene.add(fp);
  }
  // suelo propio hecho con una textura del mapa (p. ej. el camino de la cueva)
  if (cfg.ownTex) {
    const c = info.cands?.find(([m]) => cfg.ownTex.test(m.name || ''));
    if (c) {
      // algo mayor que la arena y con el borde irregular por casillas, para que se funda con el mapa
      const fw = W + 96, fh = H + 64;
      const fp = floorPlane({ mat: c[0], repeatWorld: c[1].w / c[1].u }, 1, fw, fh);
      fp.material.alphaMap = jaggedMask(fw, fh, 32, W, H);
      fp.material.alphaTest = 0.5;
      fp.position.y = 0.05;
      scene.add(fp);
      info.ownDone = true;
    }
  }
  const ownFloorHidden = !!(info.mat && cfg.floor === 'map') || !!info.ownDone;
  map.updateMatrixWorld(true);
  // dentro de la arena: o todo fuera (hueco) o sólo lo que sobresale del suelo
  const hole = { rect: new THREE.Vector4(-W / 2, -H / 2, W / 2, H / 2), south: H / 2 - 10, floor: -0.8, inside: cfg.floor === 'map' ? 3.5 : -1e6 };
  map.traverse(o => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map(m => holeMaterial(m, hole)) : holeMaterial(o.material, hole);
    o.castShadow = false; // los mapas de HGSS ya traen las sombras pintadas (y lo recortado no debe proyectar)
    o.receiveShadow = true;
  });
  scene.add(map);
  const mb = new THREE.Box3().setFromObject(map);

  // relleno más allá del mapa
  if (cfg.filler === 'trees') {
    const trees = await loadDae('trees');
    const tb = new THREE.Box3().setFromObject(trees), ts = tb.getSize(new THREE.Vector3());
    const k = 2, bw = ts.x * k, bd = ts.z * k;
    const tf = floorLevel(trees) * k;
    for (let gx = mb.min.x - bw * 2; gx < mb.max.x + bw * 2; gx += bw) {
      for (let gz = mb.min.z - bd * 2; gz < mb.max.z + bd; gz += bd) {
        const cx = gx + bw / 2, cz = gz + bd / 2;
        if (cx > mb.min.x && cx < mb.max.x && cz > mb.min.z && cz < mb.max.z) continue;
        if (cz > H / 2 - 10 && cz < H / 2 + SOUTH_BAND + bd / 2 && cx > -W / 2 - bw && cx < W / 2 + bw) continue; // no tapar la cámara
        const t = trees.clone(true);
        t.scale.multiplyScalar(k);
        t.position.set(cx - (tb.min.x + ts.x / 2) * k, -tf - 0.8, cz - (tb.min.z + ts.z / 2) * k);
        t.traverse(o => { if (o.isMesh) { o.material = Array.isArray(o.material) ? o.material.map(m => holeMaterial(m, hole)) : holeMaterial(o.material, hole); o.castShadow = false; o.receiveShadow = true; } });
        scene.add(t);
      }
    }
  }
  if (cfg.filler === 'sea') addSea(scene);
  return { bounds: mb, floor: cfg.floor, mapGround: ownFloorHidden };
}

// Rancho: Ruta 34 (la Guardería de HGSS). Devuelve la pradera donde pasean tus Pokémon.
export async function addRanchMap(scene) {
  const map = await loadDae('ranch');
  map.scale.multiplyScalar(2);
  map.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(map);
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const floor = floorLevel(map);
  map.position.set(-center.x, -floor - 0.8, -center.z);
  map.updateMatrixWorld(true);
  // pradera al sur de la Guardería (coordenadas normalizadas del mapa)
  const at = (u, v) => new THREE.Vector3((u - 0.5) * size.x, 0, (v - 0.5) * size.z);
  const a = at(0.46, 0.245), b = at(0.86, 0.41);
  const yard = { x0: a.x, z0: a.z, x1: b.x, z1: b.z, house: at(0.57, 0.19) };
  // suelo transitable (sin árboles, casa, vallas ni agua) para que los Pokémon no se suban encima
  const g = heightGrid(map, 12);
  // zona por la que pasean: algo mayor que la pradera encuadrada (sólo donde se puede pisar)
  const ex = (b.x - a.x) * 0.25, ez = (b.z - a.z) * 0.45;
  yard.roam = { x0: a.x, x1: b.x + ex, z0: a.z - ez * 0.3, z1: b.z + ez };
  yard.walk = (x, z) => {
    const cx = Math.floor((x - g.box.min.x) / g.cell), cz = Math.floor((z - g.box.min.z) / g.cell);
    for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, -1]]) {
      const X = cx + dx, Z = cz + dz;
      if (X < 0 || Z < 0 || X >= g.nx || Z >= g.nz) return false;
      const c = Z * g.nx + X;
      if (g.hi[c] === -Infinity || g.hi[c] > -0.8 + 4 || g.lo[c] < -0.8 - 4) return false;
    }
    return true;
  };
  // sin hueco; sólo se aplana lo que queda entre la cámara y la pradera
  const hole = { rect: new THREE.Vector4(0, 0, 0, 0), south: yard.z1 + 60, floor: -0.8, inside: 1e6 };
  map.traverse(o => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map(m => holeMaterial(m, hole)) : holeMaterial(o.material, hole);
    o.castShadow = false; // los mapas de HGSS ya traen las sombras pintadas (y lo recortado no debe proyectar)
    o.receiveShadow = true;
  });
  scene.add(map);
  // bosque de HGSS alrededor para que no se vea el vacío
  const trees = await loadDae('trees');
  const tb = new THREE.Box3().setFromObject(trees), ts = tb.getSize(new THREE.Vector3());
  const mb = new THREE.Box3().setFromObject(map);
  const k = 2, bw = ts.x * k, bd = ts.z * k, tf = floorLevel(trees) * k;
  for (let gx = mb.min.x - bw * 2; gx < mb.max.x + bw * 2; gx += bw) {
    for (let gz = mb.min.z - bd; gz < mb.max.z + bd; gz += bd) {
      const cx = gx + bw / 2, cz = gz + bd / 2;
      if (cx > mb.min.x && cx < mb.max.x) continue;
      const t = trees.clone(true);
      t.scale.multiplyScalar(k);
      t.position.set(cx - (tb.min.x + ts.x / 2) * k, -tf - 0.8, cz - (tb.min.z + ts.z / 2) * k);
      t.traverse(o => { if (o.isMesh) { o.material = Array.isArray(o.material) ? o.material.map(m => holeMaterial(m, hole)) : holeMaterial(o.material, hole); o.castShadow = false; o.receiveShadow = true; } });
      scene.add(t);
    }
  }
  return { yard, bounds: mb };
}
