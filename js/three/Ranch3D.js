// Rancho en 3D: Ruta 34 de HeartGold/SoulSilver (la Guardería). Tus Pokémon pasean por la pradera.
import * as THREE from '../../lib/three.module.min.js';
import { MANIFEST } from '../scenes/anims.js';
import { buildEnvironment } from './env.js';
import { addRanchMap } from './maps.js';

const MAX_SHOWN = 160;
const loader = new THREE.TextureLoader();
const texCache = new Map();
function loadTex(url) {
  if (!texCache.has(url)) {
    texCache.set(url, new Promise((res, rej) => loader.load(url, t => {
      t.magFilter = t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      t.colorSpace = THREE.SRGBColorSpace;
      res(t);
    }, undefined, rej)));
  }
  return texCache.get(url);
}
const dirRow = a => { const k = Math.round(a / (Math.PI / 4)); return (((2 - k) % 8) + 8) % 8; };
const rnd = (a, b) => a + Math.random() * (b - a);

export class Ranch3D {
  constructor(app, { team = [], mode = 'ranch' } = {}) {
    this.app = app;
    this.mode = mode;
    this.mons = [];
    this.pending = team;
    this.root = document.getElementById('stage3d');
    this.portrait = window.innerHeight > window.innerWidth * 1.1;
    this.ready = this.init();
  }

  async init() {
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.root.innerHTML = '';
    this.root.appendChild(r.domElement);
    this.root.classList.add('on');
    const scene = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 10, 9000);
    buildEnvironment(scene, 0, 1600, 1600, {}, this.portrait, { realMap: true });
    scene.fog.near = 1400; scene.fog.far = 3600;
    const { yard } = await addRanchMap(scene);
    if (this.destroyed) return;
    this.yard = yard;
    const shTex = new THREE.CanvasTexture(radial());
    this.shadowMat = new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false });
    this.shadowGeo = new THREE.PlaneGeometry(1, 1);
    await this.setTeam(this.pending, false);
    this.resize();
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this.last = performance.now();
    this.t0 = this.last;
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  // Encaja la pradera en el hueco que deja la interfaz (en vertical, la mitad de arriba)
  resize() {
    const w = this.root.clientWidth, h = this.root.clientHeight;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + 'px';
    this.renderer.domElement.style.height = h + 'px';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const Y = this.yard;
    const title = this.mode === 'title';
    // zona de pantalla libre (fracciones) donde debe quedar la pradera
    const box = title ? [0.1, 0.12, 0.9, 0.95] : this.portrait ? [0.04, 0.17, 0.96, 0.5] : [0.25, 0.14, 0.75, 0.8];
    this.pitch = this.portrait ? 0.82 : 0.68;
    const cx = (Y.x0 + Y.x1) / 2, cz = (Y.z0 + Y.z1) / 2;
    const corners = [[Y.x0, Y.z0], [Y.x1, Y.z0], [Y.x0, Y.z1], [Y.x1, Y.z1]].map(([x, z]) => new THREE.Vector3(x, 0, z));
    let tz = cz, d = 900;
    for (let it = 0; it < 4; it++) {
      let lo = 150, hi = 6000;
      for (let i = 0; i < 26; i++) {
        d = (lo + hi) / 2;
        this.place(cx, tz, d, 0);
        const ok = corners.every(c => { const p = c.clone().project(this.camera); const sx = (p.x + 1) / 2, sy = (1 - p.y) / 2; return sx > box[0] && sx < box[2] && sy > box[1] && sy < box[3]; });
        if (ok) hi = d; else lo = d;
      }
      d = hi;
      // centra verticalmente la pradera en la zona libre
      this.place(cx, tz, d, 0);
      const p = new THREE.Vector3(cx, 0, cz).project(this.camera);
      const sy = (1 - p.y) / 2, want = (box[1] + box[3]) / 2;
      tz += (sy - want) * d * 0.9;
    }
    this.cam = { cx, tz, d };
  }

  place(cx, tz, d, az) {
    const c = this.camera, p = this.pitch;
    c.position.set(cx + Math.sin(az) * Math.cos(p) * d, Math.sin(p) * d, tz + Math.cos(az) * Math.cos(p) * d);
    c.lookAt(cx, 0, tz);
    c.updateMatrixWorld();
  }

  // entries: [{ key, dex, n, ko }]
  async setTeam(entries, animateNew = true) {
    if (!this.yard) { this.pending = entries; return; }
    const total = entries.reduce((s, e) => s + e.n, 0);
    const ratio = Math.min(1, MAX_SHOWN / Math.max(1, total));
    const want = [];
    for (const e of entries) {
      const shown = Math.max(e.n > 0 ? 1 : 0, Math.round(e.n * ratio));
      const koShown = Math.min(shown, Math.round(e.ko * ratio));
      for (let i = 0; i < shown; i++) want.push({ key: e.key, dex: e.dex, ko: i < koShown });
    }
    await Promise.all([...new Set(want.map(w => w.dex))].map(d => loadTex(MANIFEST[d].sheet)));
    if (this.destroyed) return;
    const pool = this.mons;
    this.mons = [];
    for (const w of want) {
      const i = pool.findIndex(m => m.key === w.key && m.dex === w.dex);
      if (i >= 0) { const m = pool.splice(i, 1)[0]; m.ko = w.ko; this.mons.push(m); }
      else this.mons.push(await this.makeMon(w, animateNew));
    }
    for (const m of pool) { this.scene.remove(m.spr, m.sh); m.mat.dispose(); m.tex.dispose(); }
  }

  async makeMon(w, animateNew) {
    const Y = this.yard;
    const sheet = await loadTex(MANIFEST[w.dex].sheet);
    const tex = sheet.clone();
    const mat = new THREE.SpriteMaterial({ map: tex, alphaTest: 0.4, fog: true });
    const spr = new THREE.Sprite(mat);
    const sh = new THREE.Mesh(this.shadowGeo, this.shadowMat);
    sh.rotation.x = -Math.PI / 2;
    sh.scale.set(18, 9, 1);
    this.scene.add(spr, sh);
    const Rm = Y.roam;
    let x = rnd(Rm.x0, Rm.x1), z = rnd(Rm.z0, Rm.z1);
    for (let i = 0; i < 60 && !Y.walk(x, z); i++) { x = rnd(Rm.x0, Rm.x1); z = rnd(Rm.z0, Rm.z1); }
    const m = { ...w, spr, sh, mat, tex, m: MANIFEST[w.dex], x, z, tx: x, tz: z, wait: Math.random() * 3, row: 0, anim: null, frame: 0, ft: 0, drop: 0, vy: 0, hop: 0, mood: 'idle', speed: 46 };
    // los recién llegados salen corriendo de la Guardería hasta su sitio
    if (animateNew && Y.house) { m.x = Y.house.x + rnd(-20, 20); m.z = Y.house.z + 40; m.tx = x; m.tz = z; m.speed = 120; m.mood = 'arrive'; m.hop = 0.35; }
    m.sheetW = sheet.image.width; m.sheetH = sheet.image.height;
    this.setAnim(m, 'Idle');
    return m;
  }

  setAnim(m, name) {
    if (!m.m.anims[name]) name = 'Walk';
    if (m.anim === name) return;
    m.anim = name; m.frame = 0; m.ft = 0;
    this.applyFrame(m);
  }

  applyFrame(m) {
    const a = m.m.anims[m.anim];
    const row = a.rows === 1 ? 0 : m.row;
    m.tex.repeat.set(a.fw / m.sheetW, a.fh / m.sheetH);
    m.tex.offset.set((m.frame * a.fw) / m.sheetW, 1 - (a.y + row * a.fh + a.fh) / m.sheetH);
    const off = Math.max(0, (m.m.foot ?? m.m.anims.Walk.fh * 0.67) - m.m.anims.Walk.fh / 2 - 1);
    m.spr.center.set(0.5, 0.5 - off / a.fh);
    const s = 1.6;
    m.spr.scale.set(a.fw * s, a.fh * s, 1);
  }

  loop(now) {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const t = (now - this.t0) / 1000;
    const Y = this.yard;
    // cámara: leve balanceo (en el título gira más)
    const az = this.mode === 'title' ? Math.sin(t * 0.12) * 0.35 : Math.sin(t * 0.25) * 0.04;
    this.place(this.cam.cx, this.cam.tz, this.cam.d, az);
    for (const m of this.mons) {
      if (m.drop > 0) { m.vy -= 1400 * dt; m.drop = Math.max(0, m.drop + m.vy * dt); if (m.drop === 0) m.vy = 0; }
      if (m.ko) {
        this.setAnim(m, 'Sleep');
        m.mat.color.set(0x9a9aa8);
      } else {
        m.mat.color.set(0xffffff);
        m.wait -= dt;
        // persiguiendo a un compañero: el destino le sigue
        if (m.mood === 'chase' && m.buddy) { m.tx = m.buddy.x; m.tz = m.buddy.z; if (m.wait <= 0) { m.mood = 'idle'; m.speed = 46; m.buddy = null; } }
        if (m.mood === 'nap') { this.setAnim(m, m.m.anims.Sleep ? 'Sleep' : 'Idle'); if (m.wait <= 0) { m.mood = 'idle'; m.hop = 0.3; } }
        const dx = m.tx - m.x, dz = m.tz - m.z, d = Math.hypot(dx, dz);
        if (m.mood === 'nap') { /* durmiendo */ }
        else if (d > (m.mood === 'chase' ? 14 : 2)) {
          const sp = m.speed * dt;
          m.x += (dx / d) * Math.min(sp, d);
          m.z += (dz / d) * Math.min(sp, d);
          const row = dirRow(Math.atan2(dz, dx) + az);
          if (row !== m.row) { m.row = row; this.applyFrame(m); }
          this.setAnim(m, 'Walk');
        } else {
          this.setAnim(m, 'Idle');
          if (m.mood === 'arrive') { m.mood = 'idle'; m.speed = 46; m.hop = 0.35; }
          if (m.mood === 'idle') m.speed = 46;
          if (m.wait <= 0) {
            m.wait = rnd(1, 5);
            const r = Math.random();
            // a veces se echa una siesta o se pone a perseguir a otro
            if (r < 0.08 && m.m.anims.Sleep) { m.mood = 'nap'; m.wait = rnd(4, 9); continue; }
            if (r < 0.16 && this.mons.length > 1) {
              const b = this.mons[(Math.random() * this.mons.length) | 0];
              if (b !== m && !b.ko && Math.hypot(b.x - m.x, b.z - m.z) < 200) {
                m.mood = 'chase'; m.buddy = b; m.speed = 95; m.wait = rnd(2, 4); m.hop = 0.3;
                if (!b.mood || b.mood === 'idle') { b.wait = 0; b.speed = 90; }
                continue;
              }
            }
            for (let i = 0; i < 8; i++) {
              const tx = Math.max(Y.roam.x0, Math.min(Y.roam.x1, m.x + rnd(-120, 120))), tz = Math.max(Y.roam.z0, Math.min(Y.roam.z1, m.z + rnd(-90, 90)));
              // sólo destinos con camino libre (se comprueba la mitad y el final)
              if (Y.walk(tx, tz) && Y.walk((tx + m.x) / 2, (tz + m.z) / 2)) { m.tx = tx; m.tz = tz; break; }
            }
            if (Math.random() < 0.15) m.hop = 0.35; // saltito de alegría
          }
        }
      }
      // avanzar animación
      const a = m.m.anims[m.anim];
      m.ft += dt * 60;
      while (m.ft >= a.durations[m.frame]) { m.ft -= a.durations[m.frame]; m.frame = (m.frame + 1) % a.frames; }
      this.applyFrame(m);
      if (m.hop > 0) m.hop -= dt;
      const hopY = m.hop > 0 ? Math.sin((m.hop / 0.35) * Math.PI) * 14 : 0;
      m.spr.position.set(m.x, m.drop + hopY, m.z);
      m.sh.position.set(m.x, 0.3, m.z);
    }
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    if (this.renderer) {
      this.scene?.traverse(o => { if (o.material && o.material !== this.shadowMat) o.material.dispose?.(); });
      this.renderer.dispose();
      this.renderer.forceContextLoss?.();
    }
    this.root.innerHTML = '';
    this.root.classList.remove('on');
  }
}

function radial() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.42)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.42)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return cv;
}
