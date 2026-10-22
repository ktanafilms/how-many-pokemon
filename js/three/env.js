// Entorno 3D de cada acto: luz, cielo, árboles y rocas low-poly (estilo modelos de Gen 4),
// hierba alta con briznas que se mueven con el viento y agua.
import * as THREE from '../../lib/three.module.min.js';

// Paleta y "receta" de cada acto
const STYLES = [
  { // Bosque Verde
    sky: '#9fd4f2', fog: '#b9e0f2', ground: 0xffffff, sun: 1.25, amb: 0.95, hemi: ['#d8f0ff', '#406a30'],
    flora: [['tree', 0.62], ['pine', 0.38]], crown: ['#3f9a3c', '#5cbf4a', '#2f7d34'], trunk: '#7a5230', pine: ['#2c7442', '#3c9150'],
    tufts: 380, grassColor: ['#58c058', '#88e070', '#2f7a34'], bushes: true,
  },
  { // Monte Moon
    sky: '#20243a', fog: '#2a2e48', ground: 0xd8d8e8, sun: 0.75, amb: 0.75, hemi: ['#8890c0', '#30283a'],
    flora: [['rock', 0.6], ['stal', 0.4]], rock: ['#7c7c90', '#9a9aae', '#5e5e72'], crystals: ['#ff9ad8', '#9ad8ff'],
    tufts: 0,
  },
  { // Costa Celeste
    sky: '#8fd0ff', fog: '#bfe6ff', ground: 0xffffff, sun: 1.3, amb: 1.0, hemi: ['#e8f6ff', '#c0a060'],
    flora: [['palm', 1]], crown: ['#4caa3e', '#6cc850', '#2f8a34'], trunk: '#a07a48', rock: ['#9a9088', '#b8aea4', '#7a7068'],
    tufts: 60, grassColor: ['#7ab858', '#a8e078', '#4a8034'], ocean: true,
  },
  { // Torre Pokémon
    sky: '#1a1024', fog: '#2a1838', ground: 0xe8dcf0, sun: 0.55, amb: 0.8, hemi: ['#a890d0', '#20142a'],
    flora: [], walls: true, tufts: 0, candles: true,
  },
  { // Zona Safari
    sky: '#f2dcaa', fog: '#f0dcb0', ground: 0xffffff, sun: 1.3, amb: 0.95, hemi: ['#fff0c8', '#6a6030'],
    flora: [['tree', 0.75], ['pine', 0.25]], crown: ['#a8a838', '#c8c048', '#7a8a2a'], trunk: '#7a5230', pine: ['#4a7a3a', '#5a9048'],
    tufts: 520, grassColor: ['#8cc048', '#b8e070', '#567a28'], bushes: true,
  },
  { // Cueva Celeste
    sky: '#0c1428', fog: '#121c38', ground: 0xc8d4ff, sun: 0.6, amb: 0.8, hemi: ['#6a8ad0', '#141828'],
    flora: [['rock', 0.55], ['stal', 0.45]], rock: ['#7a5a48', '#9a7058', '#5a4034'], crystals: ['#7ad8ff', '#b08aff'],
    tufts: 0,
  },
];

// Degradado de 3 tonos para el sombreado "toon" (aspecto DS)
function toonRamp() {
  const d = new Uint8Array([90, 170, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

// Textura de briznas de hierba pixelada
function grassTexture(colors) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 32;
  const g = cv.getContext('2d');
  const [mid, light, dark] = colors;
  // briznas anchas con borde oscuro sólo por un lado (estilo pixel de DS)
  const blade = (x, w, h, lean, c) => {
    g.fillStyle = dark;
    g.beginPath(); g.moveTo(x, 32); g.lineTo(x + w / 2 + lean - 1, 32 - h); g.lineTo(x + 2, 32); g.fill();
    g.fillStyle = c;
    g.beginPath(); g.moveTo(x + 1, 32); g.lineTo(x + w / 2 + lean, 32 - h); g.lineTo(x + w, 32); g.fill();
  };
  const bl = [[0, 9, 18, -2], [5, 10, 26, 1], [11, 9, 21, 3], [16, 10, 29, -1], [22, 9, 20, 2], [24, 8, 14, 3], [3, 8, 12, 0]];
  bl.forEach(([x, w, h, l], i) => blade(x, w, h, l, i % 2 ? light : mid));
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Geometría de dos planos cruzados (se ve con volumen desde cualquier ángulo)
function crossGeometry() {
  const pos = [], uv = [], idx = [];
  for (let k = 0; k < 2; k++) {
    const a = k * Math.PI / 2, cx = Math.cos(a) * 0.5, cz = Math.sin(a) * 0.5;
    const b = pos.length / 3;
    pos.push(-cx, 0, -cz, cx, 0, cz, cx, 1, cz, -cx, 1, -cz);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setIndex(idx);
  return g;
}

// Deforma un poco los vértices para que cada roca/copa no sea perfecta
function jitter(geo, amount, seed) {
  const p = geo.attributes.position;
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280) - 0.5;
  const map = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!map.has(key)) map.set(key, [rnd() * amount, rnd() * amount, rnd() * amount]);
    const [dx, dy, dz] = map.get(key);
    p.setXYZ(i, p.getX(i) + dx, p.getY(i) + dy, p.getZ(i) + dz);
  }
  geo.computeVertexNormals();
  return geo;
}

class Instancer {
  constructor(scene, geo, mat, max, { shadow = true } = {}) {
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.castShadow = shadow;
    this.mesh.receiveShadow = true;
    this.mesh.count = 0;
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    scene.add(this.mesh);
  }
  add(x, y, z, sx, sy, sz, ry = 0, color = null, rx = 0, rz = 0) {
    if (this.mesh.count >= this.mesh.instanceMatrix.count) return;
    this.e.set(rx, ry, rz);
    this.q.setFromEuler(this.e);
    this.m.compose(new THREE.Vector3(x, y, z), this.q, new THREE.Vector3(sx, sy, sz));
    const i = this.mesh.count++;
    this.mesh.setMatrixAt(i, this.m);
    if (color) this.mesh.setColorAt(i, color);
  }
}

export function buildEnvironment(scene, act, W, H, data, portrait) {
  const S = STYLES[act] || STYLES[0];
  const ramp = toonRamp();
  const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...extra });
  const rng = mulberry(act * 9973 + (portrait ? 7 : 1));
  const C = (hex) => new THREE.Color(hex);
  const pick = arr => arr[(rng() * arr.length) | 0];

  // --- cielo, niebla y luces
  scene.background = C(S.sky);
  scene.fog = new THREE.Fog(C(S.fog), 1000, 3000);
  scene.add(new THREE.HemisphereLight(C(S.hemi[0]), C(S.hemi[1]), S.amb));
  const sun = new THREE.DirectionalLight(0xffffff, S.sun);
  sun.position.set(-W * 0.35, Math.max(W, H) * 0.9, -H * 0.15);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  const R = Math.max(W, H) * 0.85;
  Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 10, far: Math.max(W, H) * 3 });
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target);

  const W2 = W / 2, H2 = H / 2;
  const inPlay = (x, z, m = 0) => x > 56 - m && x < W - 56 + m && z > 110 - m && z < H - 40 + m;
  const tufts = [];

  // --- vegetación y rocas alrededor de la arena (fuera de la zona de juego)
  const flora = S.flora;
  const counts = { tree: 0, pine: 0, rock: 0, stal: 0, palm: 0 };
  const spots = [];
  const step = act === 1 || act === 5 ? 62 : 74;
  for (let gz = -900; gz < H + 260; gz += step) {
    for (let gx = -900; gx < W + 900; gx += step) {
      const x = gx + (rng() - 0.5) * step * 0.9, z = gz + (rng() - 0.5) * step * 0.9;
      if (inPlay(x, z, 18)) continue;
      // al sur de la arena (entre la cámara y el combate) sólo cosas bajas
      const south = z > H - 50;
      if (south && !(x < -40 || x > W + 40)) { if (S.bushes && rng() < 0.35 && z < H + 120) spots.push(['bush', x, z]); continue; }
      if (S.ocean && z < 4 * 32 + 20) continue; // el mar al norte
      if (rng() < 0.12) continue;
      if (!flora.length) continue;
      let r = rng(), kind = flora[0][0];
      for (const [k, p] of flora) { if ((r -= p) <= 0) { kind = k; break; } }
      spots.push([kind, x, z]);
      counts[kind] = (counts[kind] || 0) + 1;
    }
  }

  // árbol redondo: tronco + 3 copas facetadas
  if (counts.tree) {
    const trunk = new Instancer(scene, new THREE.CylinderGeometry(0.5, 0.7, 1, 6), toon(C(S.trunk)), counts.tree);
    const crown = new Instancer(scene, jitter(new THREE.IcosahedronGeometry(1, 0), 0.25, 7), toon(0xffffff, { flatShading: true }), counts.tree * 3);
    for (const [k, x, z] of spots) {
      if (k !== 'tree') continue;
      const s = 0.8 + rng() * 0.6, X = x - W2, Z = z - H2;
      trunk.add(X, 18 * s, Z, 11 * s, 36 * s, 11 * s);
      const base = C(pick(S.crown));
      crown.add(X, 52 * s, Z, 34 * s, 28 * s, 34 * s, rng() * 6, base);
      crown.add(X + (rng() - 0.5) * 22 * s, 70 * s, Z + (rng() - 0.5) * 22 * s, 26 * s, 22 * s, 26 * s, rng() * 6, base.clone().offsetHSL(0, 0, 0.06));
      crown.add(X + (rng() - 0.5) * 30 * s, 44 * s, Z + (rng() - 0.5) * 30 * s, 24 * s, 20 * s, 24 * s, rng() * 6, base.clone().offsetHSL(0, 0, -0.05));
    }
  }
  // pino: tronco + 3 conos
  if (counts.pine) {
    const trunk = new Instancer(scene, new THREE.CylinderGeometry(0.5, 0.6, 1, 6), toon(C(S.trunk)), counts.pine);
    const cone = new Instancer(scene, new THREE.ConeGeometry(1, 1, 7), toon(0xffffff, { flatShading: true }), counts.pine * 3);
    for (const [k, x, z] of spots) {
      if (k !== 'pine') continue;
      const s = 0.8 + rng() * 0.6, X = x - W2, Z = z - H2;
      trunk.add(X, 10 * s, Z, 9 * s, 20 * s, 9 * s);
      const c = C(pick(S.pine));
      cone.add(X, 38 * s, Z, 34 * s, 40 * s, 34 * s, rng() * 6, c);
      cone.add(X, 62 * s, Z, 26 * s, 34 * s, 26 * s, rng() * 6, c.clone().offsetHSL(0, 0, 0.05));
      cone.add(X, 84 * s, Z, 17 * s, 28 * s, 17 * s, rng() * 6, c.clone().offsetHSL(0, 0, 0.1));
    }
  }
  // palmera: tronco inclinado por segmentos + hojas
  if (counts.palm) {
    const seg = new Instancer(scene, new THREE.CylinderGeometry(0.42, 0.5, 1, 6), toon(C(S.trunk)), counts.palm * 5);
    const leaf = new Instancer(scene, new THREE.ConeGeometry(1, 1, 3), toon(0xffffff, { flatShading: true, side: THREE.DoubleSide }), counts.palm * 6);
    for (const [k, x, z] of spots) {
      if (k !== 'palm') continue;
      const s = 0.85 + rng() * 0.5, lean = (rng() - 0.5) * 0.5, X = x - W2, Z = z - H2;
      let px = X, py = 0;
      for (let i = 0; i < 5; i++) { seg.add(px, py + 9 * s, Z, 9 * s, 18 * s, 9 * s, 0, null, 0, lean); px -= Math.sin(lean) * 18 * s; py += 17 * s; }
      const c = C(pick(S.crown));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + rng();
        leaf.add(px + Math.cos(a) * 16 * s, py + 2 * s, Z + Math.sin(a) * 16 * s, 8 * s, 34 * s, 4 * s, -a, c, Math.PI / 2 + 0.5, 0);
      }
    }
  }
  // rocas y estalagmitas
  if (counts.rock || counts.stal) {
    const rock = new Instancer(scene, jitter(new THREE.DodecahedronGeometry(1, 0), 0.3, 3), toon(0xffffff, { flatShading: true }), counts.rock || 1);
    const stal = new Instancer(scene, jitter(new THREE.ConeGeometry(1, 1, 6, 2), 0.18, 5), toon(0xffffff, { flatShading: true }), counts.stal || 1);
    for (const [k, x, z] of spots) {
      const s = 0.7 + rng() * 0.9, X = x - W2, Z = z - H2;
      const c = C(pick(S.rock));
      if (k === 'rock') rock.add(X, 14 * s, Z, (34 + rng() * 20) * s, (26 + rng() * 26) * s, (34 + rng() * 20) * s, rng() * 6, c);
      if (k === 'stal') stal.add(X, 40 * s, Z, 20 * s, 80 * s * (0.7 + rng() * 0.6), 20 * s, rng() * 6, c);
    }
  }
  // arbustos bajos
  const bushN = spots.filter(s => s[0] === 'bush').length;
  if (bushN) {
    const bush = new Instancer(scene, jitter(new THREE.IcosahedronGeometry(1, 0), 0.3, 11), toon(0xffffff, { flatShading: true }), bushN * 2);
    for (const [k, x, z] of spots) {
      if (k !== 'bush') continue;
      const s = 0.7 + rng() * 0.5, c = C(pick(S.crown));
      bush.add(x - W2, 9 * s, z - H2, 22 * s, 16 * s, 22 * s, rng() * 6, c);
      bush.add(x - W2 + 14 * s, 7 * s, z - H2 + 6 * s, 15 * s, 12 * s, 15 * s, rng() * 6, c.clone().offsetHSL(0, 0, 0.06));
    }
  }
  // cristales brillantes (cuevas)
  if (S.crystals) {
    const n = 26;
    const cry = new Instancer(scene, new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), n, { shadow: false });
    for (let i = 0; i < n; i++) {
      let x, z;
      do { x = rng() * (W + 400) - 200; z = rng() * (H + 200) - 200; } while (inPlay(x, z, 10) || z > H - 50);
      const s = 0.6 + rng() * 0.8;
      cry.add(x - W2, 14 * s, z - H2, 8 * s, 22 * s, 8 * s, rng() * 6, C(pick(S.crystals)), (rng() - 0.5) * 0.6, (rng() - 0.5) * 0.6);
    }
  }
  // muros de la Torre Pokémon
  if (S.walls) {
    const wallMat = toon(C('#6a5a90'));
    const capMat = toon(C('#9a8ac0'));
    const wall = (x, z, w, d, h) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      m.position.set(x - W2, h / 2, z - H2); m.castShadow = m.receiveShadow = true; scene.add(m);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 6, 6, d + 6), capMat);
      cap.position.set(x - W2, h + 3, z - H2); cap.castShadow = true; scene.add(cap);
    };
    wall(W / 2, 14, W + 200, 28, 110);
    wall(-30, H / 2, 40, H + 60, 70);
    wall(W + 30, H / 2, 40, H + 60, 70);
    // pilares
    for (let x = 60; x < W; x += 200) wall(x, 34, 26, 16, 130);
  }

  // --- mar hasta el horizonte (Costa Celeste)
  let water = null;
  if (S.ocean) {
    const mat = new THREE.MeshLambertMaterial({ color: C('#3a8ad8'), transparent: true, opacity: 0.92 });
    const uTime = { value: 0 };
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.z += sin(position.x * 0.02 + uTime * 1.6) * 1.2 + cos(position.y * 0.03 + uTime) * 0.8;');
    };
    const g = new THREE.PlaneGeometry(6000, 2600, 80, 40);
    water = new THREE.Mesh(g, mat);
    water.rotation.x = -Math.PI / 2;
    const edge = -H2 + (portrait ? 5 : 4) * 32 - 6;
    water.position.set(0, 2.2, edge - 1300);
    scene.add(water);
    water.userData.uTime = uTime;
  }

  // --- hierba alta en 3D (sobre las casillas de hierba alta del suelo) + matas sueltas
  const grassTiles = data.grass || [];
  const nT = grassTiles.length * 3 + (S.tufts || 0);
  let grass = null;
  if (nT && S.grassColor) {
    const tex = grassTexture(S.grassColor);
    const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, emissive: 0x203018, emissiveIntensity: 0.35 });
    const uTime = { value: 0 };
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float ph = instanceMatrix[3].x * 0.05 + instanceMatrix[3].z * 0.07;
        transformed.x += sin(uTime * 2.2 + ph) * position.y * 0.18;
        transformed.z += cos(uTime * 1.7 + ph) * position.y * 0.1;`);
    };
    grass = new Instancer(scene, crossGeometry(), mat, nT, { shadow: false });
    grass.mesh.userData.uTime = uTime;
    for (const [tx, ty] of grassTiles) {
      for (let i = 0; i < 3; i++) {
        const x = tx + 6 + rng() * 20, z = ty + 8 + rng() * 22, s = 20 + rng() * 12;
        grass.add(x - W2, 0, z - H2, s * 1.1, s, s * 1.1, rng() * 6);
      }
    }
    for (let i = 0; i < (S.tufts || 0); i++) {
      const x = rng() * (W + 600) - 300, z = rng() * (H + 400) - 400;
      if (z > H - 20 && x > 0 && x < W) continue;
      const s = 9 + rng() * 9;
      grass.add(x - W2, 0, z - H2, s, s, s, rng() * 6);
    }
    grass.mesh.receiveShadow = true;
  }

  return {
    update(t) {
      if (grass) grass.mesh.userData.uTime.value = t;
      if (water) water.userData.uTime.value = t;
    },
    skipProp: (w, h) => h > 60, // los objetos grandes del 2D se sustituyen por modelos 3D
  };
}

function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
