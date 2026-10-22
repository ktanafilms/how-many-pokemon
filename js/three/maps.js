// Mapas 3D reales de HeartGold/SoulSilver alrededor de la arena.
// Se abre un hueco donde está la arena y se aplana lo que queda entre la cámara y el combate.
import * as THREE from '../../lib/three.module.min.js';
import { ColladaLoader } from '../../lib/three-addons/ColladaLoader.js';

// Qué mapa rodea cada acto y qué se pone más allá de sus bordes
export const MAPS = {
  // floor 'map': el suelo de la arena es el del propio mapa (se aplana lo que sobresale)
  // floor 'own': se abre un hueco y se ve el suelo propio de la arena
  0: { dir: 'act0', filler: 'trees', offset: [0, 0.18], floor: 'map' },  // Bosque Verde ← Viridian Forest
  1: { dir: 'act1', filler: null, offset: [0, 0], floor: 'own' },         // Monte Moon ← Mt. Moon Square
  2: { dir: 'act2', filler: 'sea', offset: [0.1, 0.05], floor: 'own' },  // Costa Celeste ← Isla Canela
  3: { dir: 'act3', filler: null, offset: [0, -0.05], floor: 'own' },     // Torre Pokémon ← Pueblo Lavanda
  4: { dir: 'act4', filler: 'trees', offset: [0, 0], floor: 'map' },      // Zona Safari ← Safari (bosque)
  5: { dir: 'act5', filler: null, offset: [0, 0], floor: 'map' },         // Cueva Celeste ← Cueva Celeste 1F
};

const cache = new Map();
function loadDae(dir) {
  if (!cache.has(dir)) cache.set(dir, new ColladaLoader().loadAsync(`assets/maps3d/${dir}/map.dae`).then(c => c.scene));
  // clone(true) comparte geometrías y materiales: se clonan los materiales al aplicar el hueco
  return cache.get(dir).then(s => s.clone(true));
}

// Altura del suelo: la superficie horizontal con más área
function floorLevel(obj) {
  const buckets = new Map();
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
      if (area < 1e-6 || Math.abs(n.y) / (2 * area) < 0.95) continue;
      const y = Math.round((a.y + b.y + c.y) / 3);
      buckets.set(y, (buckets.get(y) || 0) + area);
    }
  });
  let best = 0, bestA = -1;
  for (const [y, ar] of buckets) if (ar > bestA) { bestA = ar; best = y; }
  return best;
}

// Parchea un material para descartar lo que cae dentro de la arena y aplanar el lado de la cámara
function holeMaterial(m, hole) {
  // la hierba alta original de HGSS (texturas egrass) se conserva también dentro de la arena
  const tallGrass = /egrass/i.test(m.name || '') || /egrass/i.test(m.map?.name || '') || /egrass/i.test(m.map?.image?.src || '');
  m = m.clone();
  if (m.map) { m.map.magFilter = THREE.NearestFilter; m.map.minFilter = THREE.NearestFilter; m.map.colorSpace = THREE.SRGBColorSpace; m.map.generateMipmaps = false; m.map.needsUpdate = true; }
  m.alphaTest = 0.5;
  m.transparent = false;
  m.side = THREE.DoubleSide;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uHole: { value: hole.rect }, uSouth: { value: hole.south }, uFloor: { value: hole.floor }, uInside: { value: tallGrass ? 1e6 : hole.inside } });
    sh.vertexShader = 'varying vec3 vWorldH;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vWorldH = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 vWorldH;\nuniform vec4 uHole;\nuniform float uSouth;\nuniform float uFloor;\nuniform float uInside;\n' + sh.fragmentShader.replace('void main() {', `void main() {
      if (vWorldH.x > uHole.x && vWorldH.x < uHole.z && vWorldH.z > uHole.y && vWorldH.z < uHole.w && vWorldH.y > uInside) discard;
      if (vWorldH.z > uSouth && vWorldH.y > uFloor + 6.0) discard;`).replace('#include <map_fragment>', `#include <map_fragment>
      // dentro de la arena, fuera las sombras pintadas de los árboles que ya no están
      if (uInside < 1e5 && vWorldH.x > uHole.x && vWorldH.x < uHole.z && vWorldH.z > uHole.y && vWorldH.z < uHole.w && dot(diffuseColor.rgb, vec3(0.333)) < 0.16) discard;`);
  };
  m.customProgramCacheKey = () => 'hole' + (tallGrass ? 'g' : '');
  return m;
}

export async function addMap(scene, act, W, H) {
  const cfg = MAPS[act];
  if (!cfg) return false;
  const map = await loadDae(cfg.dir);
  // escala: tiles de HGSS (16) → tiles de la arena (32), y que rodee la arena con margen
  const box0 = new THREE.Box3().setFromObject(map);
  const size0 = box0.getSize(new THREE.Vector3());
  const s = Math.max(2, (W + 420) / size0.x, (H + 360) / size0.z);
  map.scale.multiplyScalar(s);
  map.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(map);
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const floor = floorLevel(map);
  map.position.set(-center.x + cfg.offset[0] * size.x, -floor - 0.8, -center.z + cfg.offset[1] * size.z);
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
        if (cz > H / 2 + 200 && cx > -W && cx < W) continue; // no tapar la cámara
        const t = trees.clone(true);
        t.scale.multiplyScalar(k);
        t.position.set(cx - (tb.min.x + ts.x / 2) * k, -tf - 0.8, cz - (tb.min.z + ts.z / 2) * k);
        t.traverse(o => { if (o.isMesh) { o.material = Array.isArray(o.material) ? o.material.map(m => holeMaterial(m, hole)) : holeMaterial(o.material, hole); o.castShadow = false; o.receiveShadow = true; } });
        scene.add(t);
      }
    }
  }
  if (cfg.filler === 'sea') {
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshLambertMaterial({ color: 0x3a7ed0 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -14;
    scene.add(sea);
  }
  return { bounds: mb, floor: cfg.floor };
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
