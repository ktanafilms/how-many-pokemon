// Combate en 2.5D (estilo Gen 4 / HGSS): escenario 3D con suelo y objetos de pie,
// Pokémon como sprites 2D que miran a la cámara, cámara inclinada con zoom y giro.
// Usa la misma simulación (sim.js) que la versión 2D.
import * as THREE from '../../lib/three.module.min.js';
import { Battle } from '../game/sim.js';
import { TRAIT_INFO } from '../data/species.js';
import { MANIFEST, animDuration } from '../scenes/anims.js';
import { sfx, cry, musicRate } from '../audio.js';
import { buildEnvironment } from './env.js';
import { addMap, MAPS } from './maps.js';
import { Particles } from './particles.js';
import { TYPES } from '../data/types.js';

const ALLY_SCALE = 1.45;
const loader = new THREE.TextureLoader();
const texCache = new Map();

function loadTex(url) {
  if (!texCache.has(url)) {
    texCache.set(url, new Promise((res, rej) => loader.load(url, t => {
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      t.colorSpace = THREE.SRGBColorSpace;
      res(t);
    }, undefined, rej)));
  }
  return texCache.get(url);
}

const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Fila de dirección de PMD (abajo, abajo-dcha, dcha, …) a partir de un ángulo en pantalla
function dirRow(angle) {
  const k = Math.round(angle / (Math.PI / 4));
  return (((2 - k) % 8) + 8) % 8;
}

export class Battle3D {
  constructor(app, setup, act) {
    this.app = app;
    this.act = act;
    this.setup = setup;
    this.sim = new Battle(setup);
    this.W = this.sim.A.w;
    this.H = this.sim.A.h;
    this.portrait = this.H > this.W;
    this.ts = window.innerWidth < 500 ? 0.85 : 1;
    this.views = new Map();
    this.fx = [];
    this.texts = [];
    this.parts = new Particles();
    this.parts.scale = 1.8; // a la distancia de la cámara, un poco más grandes que en el mundo
    this.hitstop = 0;
    this.lastStop = 0;
    this.dmgAcc = new Map();
    this.feedT = {};
    this.ended = false;
    this.introT = 1.3;
    this.flashT = 0;
    this.shakeT = 0;
    this.koCount = 0;
    this.koT = 0;
    this.numT = 0;
    this.cam = { az: 0, pitch: this.portrait ? 0.8 : 0.62, zoom: 0.92, px: 0, pz: 0 };
    this.camGoal = { ...this.cam };
    this.root = document.getElementById('stage3d');
    this.ready = this.init();
  }

  async init() {
    const key = `act${this.act}_${this.portrait ? 'v' : 'h'}`;
    const data = await (await fetch(`assets/arenas3d/${key}.json`)).json();
    this.data = data;
    const [ground, props, base] = await Promise.all([
      loadTex(`assets/arenas3d/${key}_ground.webp`), loadTex(`assets/arenas3d/${key}_props.png`), loadTex(`assets/arenas3d/${key}_base.png`),
    ]);
    const dexes = [...new Set(this.sim.units.map(u => u.dex))];
    const sheets = await Promise.all(dexes.map(d => loadTex(MANIFEST[d].sheet)));
    this.sheets = new Map(dexes.map((d, i) => [d, sheets[i]]));

    // --- renderer y escena
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.root.innerHTML = '';
    this.root.appendChild(r.domElement);
    this.overlay = document.createElement('canvas');
    this.overlay.className = 'overlay';
    this.root.appendChild(this.overlay);
    this.ctx = this.overlay.getContext('2d');
    this.root.classList.add('on');
    // tinte del campo según el modificador elegido (gas tóxico, frenesí, pantano)
    const f = this.sim.field || {};
    this.root.dataset.field = f.toxic ? 'toxic' : f.frenzy ? 'frenzy' : f.swamp ? 'swamp' : '';

    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 10, 8000);
    const W = this.W, H = this.H;
    // cielo, luces, árboles/rocas 3D, hierba y agua del acto
    const realMap = !!MAPS[this.act];
    this.env = buildEnvironment(scene, this.act, W, H, data, this.portrait, { realMap });
    let mapInfo = null;
    if (realMap) {
      try { mapInfo = await addMap(scene, this.act, W, H); } catch (e) { console.warn('mapa 3D no disponible', e); }
    }

    // --- suelo: la arena y alrededor el mismo suelo repetido (reciben sombras)
    const g = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshLambertMaterial({ map: ground }));
    g.rotation.x = -Math.PI / 2;
    g.receiveShadow = true;
    // si el suelo es el del mapa, el nuestro queda debajo como respaldo
    if (mapInfo?.mapGround) g.visible = false; // debajo ya está el suelo del propio mapa
    else if (mapInfo?.floor === 'map') g.position.y = -2.5;
    scene.add(g);
    base.wrapS = base.wrapT = THREE.RepeatWrapping;
    const outer = 6000;
    base.repeat.set(outer / 32, outer / 32);
    const og = new THREE.Mesh(new THREE.PlaneGeometry(outer, outer), new THREE.MeshLambertMaterial({ map: base, color: 0xd0d0d0 }));
    og.rotation.x = -Math.PI / 2;
    og.position.y = realMap ? -40 : -0.6;
    og.receiveShadow = true;
    // isla: una franja de arena alrededor de la arena y luego el mar
    if (mapInfo?.island) {
      og.geometry.dispose();
      // (al norte no: allí la arena ya acaba en la orilla)
      og.geometry = new THREE.PlaneGeometry(W + 520, H + 190);
      base.repeat.set((W + 520) / 32, (H + 190) / 32);
      og.position.set(0, -0.6, 125);
      og.material.color.set(0xffffff);
    }
    if (!mapInfo?.mapGround) scene.add(og); // con suelo del mapa, éste ya se extiende hasta el horizonte

    // --- objetos de pie (árboles, rocas, lápidas…) como sprites anclados al suelo
    const AW = props.image.width, AH = props.image.height;
    const mats = data.sprites.map(([x, y, w, h]) => {
      const t = props.clone();
      t.repeat.set(w / AW, h / AH);
      t.offset.set(x / AW, 1 - (y + h) / AH);
      return new THREE.SpriteMaterial({ map: t, alphaTest: 0.5, fog: true });
    });
    // con mapa real de HGSS sobran los adornos 2D de la arena (árboles y rocas planos)
    for (const [s, x, y] of realMap ? [] : data.props) {
      // los de la franja de abajo taparían la arena con la cámara inclinada
      if (y > H - 24 && x > 0 && x < W) continue;
      const [, , w, h] = data.sprites[s];
      if (this.env.skipProp(w, h)) continue;
      const sp = new THREE.Sprite(mats[s]);
      sp.center.set(0.5, 0.04);
      sp.scale.set(w, h, 1);
      sp.position.set(x - W / 2, 0, y - H / 2);
      scene.add(sp);
    }

    // --- sombras (una sola malla instanciada) y anillos de rivales
    const shTex = new THREE.CanvasTexture(radial('rgba(0,0,0,0.42)', 'rgba(0,0,0,0)'));
    this.shadowMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }), this.sim.units.length);
    this.shadowMesh.renderOrder = 1;
    scene.add(this.shadowMesh);
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
    this.bossRingMat = new THREE.MeshBasicMaterial({ color: 0xff8a1a, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
    this.ringFill = new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.22, depthWrite: false });

    for (const u of this.sim.units) this.makeView(u);
    this.intro();
    this.bindControls();
    this.resize();
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    // compila los shaders y pinta un fotograma antes de mostrarse (así no se atasca al empezar)
    this.hold = true;
    try { await r.compileAsync(scene, this.camera); } catch (e) { /* navegador sin compilación asíncrona */ }
    this.sync(0, 0);
    r.render(scene, this.camera);
    this.last = performance.now();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  // ---------- Unidades ----------
  makeView(u) {
    const m = MANIFEST[u.dex];
    const tex = this.sheets.get(u.dex).clone();
    const mat = new THREE.SpriteMaterial({ map: tex, alphaTest: 0.4, fog: true });
    const flash = { value: 0 };
    // variocolor (shiny): se gira el tono de la paleta
    const hue = { value: u.shiny ? 2.4 : 0 };
    mat.onBeforeCompile = sh => {
      sh.uniforms.uFlash = flash;
      sh.uniforms.uHue = hue;
      sh.fragmentShader = 'uniform float uFlash;\nuniform float uHue;\nvec3 hueShift(vec3 c, float a) { const vec3 k = vec3(0.57735); float ca = cos(a); return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca); }\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n if (uHue != 0.0) diffuseColor.rgb = clamp(hueShift(diffuseColor.rgb, uHue), 0.0, 1.0);\n diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), uFlash);');
    };
    const spr = new THREE.Sprite(mat);
    this.scene.add(spr);
    const scale = (u.side ? u.size : ALLY_SCALE) * (this.portrait ? 1.15 : 1);
    const v = {
      u, spr, mat, tex, flash, m, scale,
      sheetW: tex.image.width, sheetH: tex.image.height,
      anim: null, row: u.side ? (this.portrait ? 0 : 6) : (this.portrait ? 4 : 2), frame: 0, ft: 0,
      lastAttack: -1, lastHurt: -1, attackUntil: 0, hurtUntil: 0, dead: false, dropY: 0, fade: 1,
    };
    if (u.side) {
      // contorno rojo: copia de la silueta detrás, un poco más grande
      const omat = new THREE.SpriteMaterial({ map: tex, alphaTest: 0.4, fog: true, color: u.boss ? 0xff7a1a : u.elite || u.shiny ? 0xffd21a : 0xff2a2a });
      omat.onBeforeCompile = sh => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb = diffuse;');
      };
      v.outline = new THREE.Sprite(omat);
      this.scene.add(v.outline);
      v.ring = new THREE.Mesh(new THREE.RingGeometry(u.r * 1.2, u.r * 1.2 + (u.boss ? 6 : 4), 40), u.boss || u.elite ? this.bossRingMat : this.ringMat);
      v.ring.rotation.x = -Math.PI / 2;
      v.ring.scale.set(1, 1, 1);
      v.fill = new THREE.Mesh(new THREE.CircleGeometry(u.r * 1.2, 32), this.ringFill);
      v.fill.rotation.x = -Math.PI / 2;
      this.scene.add(v.ring, v.fill);
    }
    this.setAnim(v, 'Idle', true);
    this.views.set(u.id, v);
  }

  setAnim(v, name, force = false) {
    if (!v.m.anims[name]) name = 'Walk';
    if (!force && v.anim === name) return;
    v.anim = name;
    v.frame = 0;
    v.ft = 0;
    this.applyFrame(v);
  }

  applyFrame(v) {
    const a = v.m.anims[v.anim];
    const row = a.rows === 1 ? 0 : v.row;
    const fx = v.frame * a.fw, fy = a.y + row * a.fh;
    v.tex.repeat.set(a.fw / v.sheetW, a.fh / v.sheetH);
    v.tex.offset.set(fx / v.sheetW, 1 - (fy + a.fh) / v.sheetH);
    const off = Math.max(0, (v.m.foot ?? v.m.anims.Walk.fh * 0.67) - v.m.anims.Walk.fh / 2 - 1);
    const cy = 0.5 - off / a.fh;
    v.spr.center.set(0.5, cy);
    v.spr.scale.set(a.fw * v.scale, a.fh * v.scale, 1);
    if (v.outline) {
      v.outline.center.set(0.5, cy - 0.015);
      v.outline.scale.set(a.fw * v.scale * 1.07, a.fh * v.scale * 1.06, 1);
    }
  }

  stepAnim(v, dt) {
    const a = v.m.anims[v.anim];
    v.ft += dt * 60;
    while (v.ft >= a.durations[v.frame]) {
      v.ft -= a.durations[v.frame];
      v.frame++;
      if (v.frame >= a.frames) {
        if (v.anim === 'Attack' || v.anim === 'Hurt') { v.frame = a.frames - 1; v.ft = 0; break; }
        v.frame = 0;
      }
    }
    this.applyFrame(v);
  }

  intro() {
    let i = 0;
    for (const v of this.views.values()) {
      if (!v.u.side) continue;
      const delay = 0.15 + (i++ % 12) * 0.06;
      v.drop = { t: -delay };
      v.dropY = 380;
    }
    this.flashT = 0.35;
  }

  // ---------- Bucle ----------
  loop(now) {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    // mientras dura la presentación VS sólo se pinta (nada se mueve)
    if (this.hold) {
      this.updateCamera(dt);
      if (this.showcase) this.sync(dt, now / 1000);
      this.renderer.render(this.scene, this.camera);
      if (this.showcase) this.drawOverlay(dt, now / 1000);
      this.app.onBattleTick(this.sim);
      return;
    }
    const speed = this.app.speed;
    this.checkKillcam(dt);
    // en la kill cam todo va a cámara lenta (como mucho a velocidad ×1)
    const slow = this.killcam ? this.killcam.scale : 1;
    let simSpeed = this.killcam ? Math.min(speed, 1) * slow : speed;
    // primer choque de los dos bandos a cámara lenta
    if (this.clash) { this.clash.t -= dt; simSpeed *= this.clash.t > 0 ? 0.3 : 1; if (this.clash.t <= -0.3) this.clash = null; }
    if (this.introT > 0) this.introT -= dt;
    else if (this.hitstop > 0) this.hitstop -= dt; // micropausa en los golpes críticos
    else if (!this.ended && simSpeed > 0) this.sim.update(dt * simSpeed);
    this.handleEvents();
    this.updateCamera(dt);
    const vdt = this.killcam ? dt * slow : dt * Math.max(1, speed);
    this.sync(vdt, now / 1000);
    this.env.update(now / 1000);
    this.renderer.render(this.scene, this.camera);
    this.drawOverlay(vdt, now / 1000);
    this.app.onBattleTick(this.sim);
    if (this.sim.result && !this.ended) {
      this.ended = true;
      const kc = this.killcam && this.sim.result === 'win';
      if (kc) {
        // último golpe: se queda un momento en cámara lenta y luego vuelve
        this.killcam.dead = true;
        this.flashT = 0.25; this.flashColor = '255,255,255';
        this.shakeT = 0.3;
        sfx('boom');
        setTimeout(() => this.endKillcam(), 1500);
      } else this.endKillcam();
      setTimeout(() => this.app.onBattleEnd(this.sim), kc ? 2500 : 1300);
    }
  }

  // Empieza el combate (al terminar la presentación)
  go() {
    const boss = this.sim.enemies.find(e => e.boss);
    if (!boss) { this.hold = false; this.last = performance.now(); return; }
    // jefe: primer plano mientras ruge, luego la cámara se aleja y empieza el combate
    const def = { ...this.camGoal };
    this.showcase = true;
    this.camGoal = { az: 0.18, pitch: 0.5, zoom: 0.5, px: boss.x - this.W / 2, pz: boss.y - this.H / 2 };
    setTimeout(() => {
      if (this.destroyed) return;
      const v = this.view(boss.id);
      sfx('roar');
      cry(boss.dex, { rate: 0.9, vol: 0.8 });
      this.shakeT = 0.6;
      this.flashT = 0.2; this.flashColor = '255,255,255';
      if (v) this.addFx('ring', 0.8, { x: boss.x, y: boss.y, r: 220, color: '#ffb43a' });
    }, 700);
    setTimeout(() => { if (this.destroyed) return; this.camGoal = def; this.hold = false; this.showcase = false; this.last = performance.now(); }, 2000);
  }

  // ---------- Kill cam: el último golpe de la ronda, de cerca y a cámara lenta ----------
  checkKillcam(dt) {
    const kc = this.killcam;
    if (kc) {
      kc.t += dt;
      const u = kc.u;
      this.camGoal.px = u.x - this.W / 2;
      this.camGoal.pz = u.y - this.H / 2;
      // por si el golpe final no llega: se suelta a los 3.5 s
      if (!kc.dead && (kc.t > 4 || this.sim.enemies.filter(e => e.hp > 0).length > 1)) this.endKillcam();
      return;
    }
    if (this.sim.result || this.introT > 0 || this.killcamDone || this.app.speed === 0) return;
    const alive = this.sim.enemies.filter(e => e.hp > 0);
    if (alive.length !== 1) return;
    const e = alive[0];
    // se activa cuando, al ritmo de daño que lleva, caerá en menos de ~0.8 s
    const h = (this.hpHist ??= []);
    h.push([this.sim.t, e.hp, e.id]);
    while (h.length && (h[0][0] < this.sim.t - 1.2 || h[0][2] !== e.id)) h.shift();
    if (h.length < 2 || this.sim.t - h[0][0] < 0.4) return;
    const dps = (h[0][1] - e.hp) / (this.sim.t - h[0][0]);
    if (dps <= 0 || e.hp / dps > 0.8) return;
    this.killcamDone = true;
    this.camBefore = { ...this.camGoal };
    this.killcam = { u: e, t: 0, scale: 0.25, dead: false };
    this.camGoal = { az: clamp(this.cam.az + (e.x > this.W / 2 ? -0.28 : 0.28), -0.5, 0.5), pitch: 0.55, zoom: e.boss ? 0.6 : 0.42, px: e.x - this.W / 2, pz: e.y - this.H / 2 };
    // la víctima se dibuja por encima de la multitud para que se vea bien
    const v = this.view(e.id);
    if (v) [v.outline, v.spr].forEach((sp, i) => { if (sp) { sp.renderOrder = 9 + i; sp.material.depthTest = false; } });
    this.root.classList.add('killcam');
    document.body.classList.add('killcam');
    sfx('whoosh');
  }

  endKillcam() {
    if (!this.killcam) return;
    this.killcam = null;
    this.camGoal = this.camBefore || { az: 0, pitch: this.portrait ? 0.8 : 0.62, zoom: 0.92, px: 0, pz: 0 };
    this.root.classList.remove('killcam');
    document.body.classList.remove('killcam');
  }

  sync(dt, clock) {
    const W2 = this.W / 2, H2 = this.H / 2;
    const now = this.sim.t;
    let si = 0;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), s3 = new THREE.Vector3(), p3 = new THREE.Vector3();
    const pulse = 0.55 + 0.3 * Math.sin(clock * 5);
    this.ringMat.opacity = Math.min(1, pulse + 0.15);
    this.bossRingMat.opacity = Math.min(1, pulse + 0.2);
    for (const v of this.views.values()) {
      const u = v.u;
      if (v.drop) {
        v.drop.t += dt;
        const k = clamp(v.drop.t / 0.55, 0, 1);
        v.dropY = 380 * (1 - bounce(k));
        if (k >= 1) { v.drop = null; v.dropY = 0; }
      }
      if (v.dead) {
        v.fade -= dt * 1.6;
        v.spr.material.opacity = Math.max(0, v.fade);
        if (v.fade <= 0 && v.spr.visible) {
          v.spr.visible = false;
          if (v.outline) v.outline.visible = v.ring.visible = v.fill.visible = false;
        }
        continue;
      }
      if (u.side === 1 && u.state === 'dead') {
        v.dead = true;
        v.spr.material.transparent = true;
        this.setAnim(v, 'Hurt', true);
        if (v.outline) v.outline.visible = v.ring.visible = v.fill.visible = false;
        continue;
      }
      const x = u.x - W2, z = u.y - H2;
      v.spr.position.set(x, u.z + v.dropY, z);
      if (v.fly) {
        // vuelo del KO: arco, giro y caída; al terminar se queda dormido en su sitio
        v.fly.t += dt;
        const k = Math.min(1, v.fly.t / v.fly.dur);
        // sale desde donde recibió el golpe y aterriza en el sitio donde queda KO
        v.spr.position.x -= v.fly.dx * (1 - k);
        v.spr.position.z -= v.fly.dz * (1 - k);
        v.spr.position.y += Math.sin(k * Math.PI) * v.fly.h;
        v.spr.material.rotation = k < 1 ? k * Math.PI * 4 : 0;
        if (k >= 1) v.fly = null;
      }
      if (v.kick) { v.kick.t -= dt; if (v.kick.t <= 0) v.kick = null; else { v.spr.position.x += v.kick.x; v.spr.position.z += v.kick.z; } }
      // destellos de los variocolor
      if (u.shiny && Math.random() < dt * 1.2) this.floatText(u, 26 * u.size + Math.random() * 20, '✦', '#fff27a', 14);
      // al ganar, tus Pokémon dan saltitos de alegría (como los Dudes de HMD)
      if (this.sim.result === 'win' && !u.side && u.state !== 'ko') v.spr.position.y += Math.abs(Math.sin(clock * 7 + u.id * 1.7)) * 12;
      // dirección relativa a la cámara
      const moving = Math.abs(u.vx) + Math.abs(u.vy) > 1;
      const ang = moving ? Math.atan2(u.vy, u.vx) : u.target ? u.facing : null;
      if (ang !== null) {
        const row = dirRow(ang + this.cam.az);
        if (row !== v.row) { v.row = row; this.applyFrame(v); }
      }
      let name;
      if (u.state === 'ko') name = 'Sleep';
      else if (u.air) name = 'Hurt';
      else if (u.stun > 0) name = u.sleep ? 'Sleep' : 'Hurt';
      else if (now < v.attackUntil) name = 'Attack';
      else if (moving || u.state === 'charge') name = 'Walk';
      else name = 'Idle';
      if (u.lastAttack !== v.lastAttack) {
        v.lastAttack = u.lastAttack;
        v.attackUntil = now + Math.min(0.6, animDuration(u.dex, 'Attack'));
        this.setAnim(v, 'Attack', true);
        name = 'Attack';
      }
      this.setAnim(v, name);
      this.stepAnim(v, dt);
      if (u.lastHurt !== v.lastHurt) {
        v.lastHurt = u.lastHurt;
        // pequeño retroceso visual del sprite (en dirección contraria a quien le golpea)
        if (u.side) { const a = u.facing + Math.PI; v.kick = { x: Math.cos(a) * 3, z: Math.sin(a) * 3, t: 0.12 }; }
        if (now > v.hurtUntil + 0.3) v.hurtUntil = now + 0.07;
      }
      v.flash.value = u.side && now < v.hurtUntil ? 0.6 : 0;
      const ko = u.state === 'ko';
      v.mat.color.set(ko ? 0x8a8a9a : u.primal ? 0xff9a8a : u.buffs.berserk > 0 ? 0xffa070 : u.buffs.poisonT > 0 ? 0xd8a0ff : u.buffs.slowT > 0 ? 0xb0e8ff : 0xffffff);
      v.spr.visible = u.state !== 'burrow';
      if (v.outline) {
        v.outline.position.copy(v.spr.position);
        v.outline.position.y -= 0.5;
        v.outline.visible = v.spr.visible;
        v.ring.position.set(x, 0.6, z);
        v.fill.position.set(x, 0.4, z);
      }
      // sombra
      const sw = (u.side ? u.r * 2.4 : 18) * (ko ? 1.2 : 1);
      s3.set(sw, sw * 0.5, 1);
      p3.set(x, 0.2, z);
      m4.compose(p3, q, s3);
      this.shadowMesh.setMatrixAt(si++, m4);
    }
    this.shadowMesh.count = si;
    this.shadowMesh.instanceMatrix.needsUpdate = true;
  }

  // ---------- Cámara ----------
  fitDistance() {
    // distancia a la que la arena entera cabe en pantalla con la inclinación actual
    const W2 = this.W / 2, H2 = this.H / 2;
    const corners = [[-W2, -H2], [W2, -H2], [-W2, H2], [W2, H2]].map(([x, z]) => new THREE.Vector3(x, 0, z));
    let lo = 100, hi = 8000;
    for (let i = 0; i < 24; i++) {
      const d = (lo + hi) / 2;
      this.placeCamera(this.cam.pitch, 0, d, 0, 0);
      const ok = corners.every(c => { const p = c.clone().project(this.camera); return Math.abs(p.x) < 0.98 && p.y < 0.9 && p.y > -0.92; });
      if (ok) hi = d; else lo = d;
    }
    return hi;
  }

  placeCamera(pitch, az, dist, px, pz) {
    const c = this.camera;
    c.position.set(px + Math.sin(az) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, pz + Math.cos(az) * Math.cos(pitch) * dist);
    c.lookAt(px, 0, pz);
    c.updateMatrixWorld();
  }

  // Cámara automática: encuadra donde está la pelea y, a ratos, se acerca a lo más vistoso
  // (un ataque de área del jefe, una explosión grande, un meteorito). Si el jugador toca la cámara,
  // se aparta unos segundos.
  director(dt) {
    if (!this.app.autoCam || this.killcam || this.hold || this.ended) return;
    if (performance.now() - (this.userCamT || 0) < 5000) return;
    const sh = this.shot;
    if (sh) {
      sh.t -= dt;
      if (sh.t <= 0) this.shot = null;
      else { Object.assign(this.camGoal, { px: sh.x - this.W / 2, pz: sh.y - this.H / 2, zoom: sh.zoom, az: sh.az, pitch: this.basePitch() - 0.06 }); return; }
    }
    // encuadre general: caja de los que están luchando (con margen), sin acercarse demasiado
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, n = 0;
    for (const u of this.sim.units) {
      if (u.hp <= 0 || u.state === 'ko' || u.state === 'dead') continue;
      x0 = Math.min(x0, u.x); x1 = Math.max(x1, u.x); y0 = Math.min(y0, u.y); y1 = Math.max(y1, u.y); n++;
    }
    if (!n) return;
    const fw = (x1 - x0 + 160) / this.W, fh = (y1 - y0 + 140) / this.H;
    const zoom = clamp(Math.max(fw, fh) * 0.95, 0.62, 0.95);
    Object.assign(this.camGoal, { px: clamp((x0 + x1) / 2 - this.W / 2, -this.W * 0.25, this.W * 0.25), pz: clamp((y0 + y1) / 2 - this.H / 2, -this.H * 0.2, this.H * 0.2), zoom, az: this.camGoal.az * 0.98, pitch: this.basePitch() });
  }
  basePitch() { return this.portrait ? 0.8 : 0.62; }
  // propone un plano corto (si no hay otro más importante en curso)
  focus(x, y, prio = 1, zoom = 0.5, dur = 1.6) {
    if (!this.app.autoCam || this.killcam || this.hold) return;
    if (this.shot && this.shot.prio > prio) return;
    if (performance.now() - (this.lastShotT || 0) < 2500 && !(this.shot && prio > this.shot.prio)) return;
    this.lastShotT = performance.now();
    this.shot = { x, y, prio, zoom, t: dur, az: clamp((x - this.W / 2) / this.W * 0.5, -0.2, 0.2) };
  }

  updateCamera(dt) {
    this.director(dt);
    const k = 1 - Math.pow(this.killcam ? 0.004 : this.shot ? 0.03 : 0.12, dt);
    for (const key of ['az', 'pitch', 'zoom', 'px', 'pz']) this.cam[key] = lerp(this.cam[key], this.camGoal[key], k);
    let sx = 0, sz = 0;
    if (this.shakeT > 0) { this.shakeT -= dt; sx = (Math.random() - 0.5) * 10; sz = (Math.random() - 0.5) * 10; }
    this.placeCamera(this.cam.pitch, this.cam.az, this.baseDist * this.cam.zoom, this.cam.px + sx, this.cam.pz + sz);
  }

  resize() {
    const w = this.root.clientWidth, h = this.root.clientHeight;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + 'px';
    this.renderer.domElement.style.height = h + 'px';
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    this.overlay.width = w * pr;
    this.overlay.height = h * pr;
    this.overlay.style.width = w + 'px';
    this.overlay.style.height = h + 'px';
    this.ctx.setTransform(pr, 0, 0, pr, 0, 0);
    this.cw = w; this.ch = h;
    this.camera.aspect = w / h;
    // deja hueco para la interfaz de arriba y abajo
    this.camera.setViewOffset(w, h, 0, -h * 0.02, w, h);
    this.camera.updateProjectionMatrix();
    this.baseDist = this.fitDistance();
    // niebla y plano lejano según lo lejos que esté la cámara
    this.scene.fog.near = this.baseDist * 1.1;
    this.scene.fog.far = this.baseDist * 2.6;
    this.camera.far = this.baseDist * 5;
    this.camera.near = Math.max(5, this.baseDist * 0.02);
    this.camera.updateProjectionMatrix();
  }

  resetCamera() {
    this.camGoal = { az: 0, pitch: this.portrait ? 0.8 : 0.62, zoom: 0.92, px: 0, pz: 0 };
  }

  bindControls() {
    const el = this.renderer.domElement;
    const pointers = new Map();
    let start = null, moved = 0, pinch = null;
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('pointerdown', e => {
      this.userCamT = performance.now(); this.shot = null;
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      start = { x: e.clientX, y: e.clientY, button: e.button, shift: e.shiftKey };
      moved = 0;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.camGoal.zoom, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      }
    });
    el.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) return;
      const p = pointers.get(e.pointerId);
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      const g = this.camGoal;
      if (pointers.size >= 2 && pinch) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        g.zoom = clamp(pinch.zoom * pinch.d / d, 0.42, 1.15);
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        this.pan(cx - pinch.cx, cy - pinch.cy);
        pinch.cx = cx; pinch.cy = cy;
        return;
      }
      if (start && (start.button === 2 || start.shift)) { this.pan(dx, dy); return; }
      g.az = clamp(g.az - dx * 0.004, -0.32, 0.32);
      g.pitch = clamp(g.pitch + dy * 0.003, 0.5, 1.2);
    });
    const up = e => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (start && moved < 8 && e.button === 0) {
        const pt = this.groundPoint(e.clientX, e.clientY);
        if (pt) this.app.onArenaClick(pt.x, pt.y);
      }
      if (pointers.size === 0) start = null;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => {
      this.userCamT = performance.now(); this.shot = null;
      e.preventDefault();
      this.camGoal.zoom = clamp(this.camGoal.zoom * Math.exp(e.deltaY * 0.0012), 0.42, 1.15);
    }, { passive: false });
    el.addEventListener('dblclick', () => this.resetCamera());
  }

  pan(dx, dy) {
    const g = this.camGoal;
    const s = this.baseDist * g.zoom / 900;
    const c = Math.cos(g.az), sn = Math.sin(g.az);
    g.px = clamp(g.px - (dx * c + dy * sn * 0) * s, -this.W / 2, this.W / 2);
    g.pz = clamp(g.pz - (dy * c - dx * sn) * s * 1.4, -this.H / 2, this.H / 2);
  }

  groundPoint(cx, cy) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const o = ray.ray.origin, d = ray.ray.direction;
    if (Math.abs(d.y) < 1e-4) return null;
    const t = -o.y / d.y;
    return { x: o.x + d.x * t + this.W / 2, y: o.z + d.z * t + this.H / 2 };
  }

  // Posición en pantalla de un punto de la arena (x, y en píxeles de la sim; h = altura)
  toScreen(x, y, h = 0) {
    const p = new THREE.Vector3(x - this.W / 2, h, y - this.H / 2);
    const dist = p.distanceTo(this.camera.position);
    p.project(this.camera);
    const ppu = this.ch / (2 * Math.tan((this.camera.fov * Math.PI) / 360) * dist);
    return { x: (p.x + 1) / 2 * this.cw, y: (1 - p.y) / 2 * this.ch, s: ppu, behind: p.z > 1 };
  }

  // ---------- Eventos de la simulación ----------
  view(id) { return this.views.get(id); }

  feedLine(html, cls, key, every) {
    const now = performance.now();
    if (every && now - (this.feedT[key] || -1e9) < every) return;
    if (now - (this.feedT._any || 0) < 260 && cls !== 'foe') return;
    this.feedT[key] = now;
    this.feedT._any = now;
    this.app.feed(html, cls);
  }

  addFx(kind, dur, data) { this.fx.push({ kind, t: 0, dur, ...data }); }

  handleEvents() {
    const ev = this.sim.events;
    this.sim.events = [];
    for (const e of ev) {
      switch (e.type) {
        case 'hit':
          this.hitParticles(e);
          if (!this.clashDone && e.side === 1 && e.from != null) {
            this.clashDone = true;
            const v = this.view(e.id);
            if (v) {
              this.clash = { t: 0.7 };
              this.shakeT = Math.max(this.shakeT, 0.25);
              this.addFx('ring', 0.7, { x: v.u.x, y: v.u.y, r: 120, color: '#ffffff' });
              this.parts.burst(v.u.x, v.u.y, 4, 22, { kind: 'puff', color: '#d8c8a8', alpha: 0.6, speed: 160, up: 30, g: 0, size: 6, grow: 1.2, life: 0.8, drag: 3 });
              this.focus(v.u.x - 40, v.u.y, 2, 0.6, 1.2);
              sfx('crit');
            }
          }
          if (e.side === 1) {
            sfx(e.crit ? 'crit' : e.eff > 1 ? 'super' : e.eff < 1 ? 'weak' : 'hit');
            const a = this.dmgAcc.get(e.id) || { dmg: 0, crit: false, eff: 1 };
            a.dmg += e.dmg; a.crit ||= e.crit; a.eff = Math.max(a.eff, e.eff);
            this.dmgAcc.set(e.id, a);
          }
          break;
        case 'fireball': {
          const v = this.view(e.from);
          if (v) {
            this.addFx('proj', e.dur, { x0: v.u.x, y0: v.u.y, h0: 20, x1: e.x, y1: e.y, color: '#ff7a1a', r: 7, arc: 60, trail: '#ffb43a' });
            this.parts.burst(v.u.x, v.u.y, 18, 4, { kind: 'dot', color: '#ffb43a', speed: 50, up: 60, g: 0, life: 0.35, size: 2.5, drag: 3 });
          }
          break;
        }
        case 'projectile': {
          const v = this.view(e.from);
          if (v) this.addFx('proj', e.dur, { x0: v.u.x, y0: v.u.y, h0: 30 * v.u.size, x1: e.x, y1: e.y, color: hex(e.color), r: e.kind === 'star' ? 7 : 9, arc: 90, star: e.kind === 'star', trail: hex(e.color) });
          this.addFx('target', e.dur, { x: e.x, y: e.y, r: 40, color: hex(e.color) });
          break;
        }
        case 'bone': { const a = this.view(e.from), b = this.view(e.to); if (a && b) this.addFx('bone', 0.5, { a: a.u, b: b.u }); break; }
        case 'explosion': {
          // fuego, humo y escombros
          const col = hex(e.color ?? 0xffa23a), P = this.parts, n = Math.min(26, 8 + e.r / 6) * (P.busy > 0.7 ? 0.4 : 1);
          P.burst(e.x, e.y, 6, n, { kind: 'dot', color: col, speed: e.r * 2.2, up: 140, g: 380, size: 4, life: 0.5, drag: 2 });
          P.burst(e.x, e.y, 10, n * 0.5, { kind: 'dot', color: '#fff2a0', speed: e.r * 1.6, up: 90, g: 300, size: 2.5, life: 0.35 });
          P.burst(e.x, e.y, 14, n * 0.35, { kind: 'puff', color: '#6a6470', alpha: 0.45, speed: e.r * 0.6, up: 40, g: -30, size: 9, grow: 1.4, life: 0.9, drag: 3 });
          if (e.big || e.r > 90) { this.shakeT = Math.max(this.shakeT, 0.35); this.focus(e.x, e.y, 2, 0.55, 1.3); }
        }
          sfx(e.big || e.r > 80 ? 'boom' : 'fire');
          this.addFx('boom', e.big ? 0.6 : 0.35, { x: e.x, y: e.y, r: e.r, color: hex(e.color ?? 0xffa23a) });
          if (e.big) this.shakeT = 0.25;
          break;
        case 'pulse':
          for (let i = 0; i < Math.min(8, 2 + e.r / 12); i++) this.parts.add({ kind: 'plus', x: e.x + (Math.random() - 0.5) * e.r, y: e.y + (Math.random() - 0.5) * e.r * 0.6, h: 8, vh: 50 + Math.random() * 30, life: 0.9, size: 3.2, color: hex(e.color) });
          sfx('heal'); this.addFx('ring', 0.45, { x: e.x, y: e.y, r: e.r, color: hex(e.color), fill: true }); break;
        case 'wave': this.addFx('ring', 0.6, { x: e.x, y: e.y, r: e.r, color: hex(e.color), fill: true }); this.shakeT = 0.15; this.focus(e.x, e.y, 1, 0.55, 1.2); break;
        case 'lightning':
          for (const [x, y] of e.pts) this.parts.burst(x, y, 16, 5, { kind: 'spark', color: '#fff27a', speed: 160, up: 120, g: 400, life: 0.3, size: 2.5 });
          sfx('zap'); this.addFx('bolt', 0.25, { pts: e.pts, color: '#fff27a' }); break;
        case 'bolt': sfx('zap'); this.addFx('bolt', 0.3, { pts: [[e.x, e.y]], sky: true, color: '#fff27a', w: 4 }); break;
        case 'slash': this.addFx('slash', 0.25, { pts: e.pts }); break;
        case 'gust': this.addFx('gust', 0.5, e); this.shakeT = 0.15; this.focus(e.x + Math.cos(e.ang) * e.len * 0.4, e.y + Math.sin(e.ang) * e.len * 0.4, 1, 0.6, 1.3); break;
        case 'powder': this.addFx('ring', 0.8, { x: e.x, y: e.y, r: e.r, color: hex(e.color), fill: true }); break;
        case 'meteor': this.focus(e.x, e.y, 3, 0.55, 1.8); sfx('whoosh'); this.addFx('meteor', e.dur, e); break;
        case 'taunt': { const v = this.view(e.id); if (v) { this.addFx('ring', 0.5, { follow: v.u, r: 40, color: '#ff3a3a' }); this.floatText(v.u, 30, '¡Eh!', '#ff6a5a', 15); this.parts.burst(v.u.x, v.u.y, 20, 6, { kind: 'spark', color: '#ff5a4a', speed: 110, up: 60, g: 0, life: 0.3, size: 2 }); } break; }
        case 'roar': { const v = this.view(e.id); if (v) { this.focus(v.u.x, v.u.y, 2, 0.5, 1.6); sfx('roar'); cry(v.u.dex, { rate: 0.85, vol: 0.7 }); this.addFx('ring', 0.7, { x: v.u.x, y: v.u.y, r: 180, color: '#ff3a3a' }); this.floatText(v.u, 60, '¡FURIA!', '#ff4a3a', 26); this.shakeT = 0.3; } break; }
        case 'teleport': {
          this.addFx('ring', 0.35, { x: e.x0, y: e.y0, r: 22, color: '#ff9ae0' });
          this.parts.burst(e.x0, e.y0, 12, 8, { kind: 'star', color: '#ffb0f0', speed: 70, up: 70, g: 0, life: 0.5, size: 2, drag: 2 });
          const v = this.view(e.id);
          if (v) this.later(0.02, () => this.parts.burst(v.u.x, v.u.y, 12, 8, { kind: 'star', color: '#ffb0f0', speed: 90, up: 70, g: 0, life: 0.5, size: 2, drag: 2 }));
          break;
        }
        case 'sing': {
          const v = this.view(e.id);
          if (v) {
            this.addFx('ring', 0.6, { x: v.u.x, y: v.u.y, r: 110, color: '#ffb6e0' });
            for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; this.texts.push({ x: v.u.x + Math.cos(a) * 10, y: v.u.y + Math.sin(a) * 8, h: 22, str: i % 2 ? '♪' : '♫', color: '#ff7ad8', size: 18, t: 0, dx: Math.cos(a) * 40 }); }
          }
          break;
        }
        case 'sleep': { const v = this.view(e.id); if (v) this.floatText(v.u, 24 * (v.u.side ? v.u.size : 1), 'Zz', '#cfd8ff', 16); break; }
        case 'rage': { const v = this.view(e.id); if (v) { this.floatText(v.u, 24, '!', '#ff6a3a', 20); this.parts.burst(v.u.x, v.u.y, 4, 7, { kind: 'dot', color: '#ff7a3a', speed: 40, up: 90, g: -40, life: 0.6, size: 2.4 }); } break; }
        case 'coin': this.parts.add({ kind: 'coin', x: e.x, y: e.y, h: 20, vh: 200, g: 600, bounce: 0.4, vx: (Math.random() - 0.5) * 60, life: 1.1, size: 3.4 }); break;
        case 'equalize': { const a = this.view(e.a), b = this.view(e.b); if (a && b) this.addFx('bolt', 0.3, { pts: [[a.u.x, a.u.y], [b.u.x, b.u.y]], color: '#b78aff' }); break; }
        case 'dig': this.addFx('ring', 0.4, { x: e.x, y: e.y, r: 12, color: '#8a5a2a', fill: true }); this.parts.burst(e.x, e.y, 2, 8, { kind: 'dot', color: '#8a5a2a', speed: 70, up: 110, g: 400, life: 0.5, size: 2.4 }); break;
        case 'emerge': this.addFx('boom', 0.3, { x: e.x, y: e.y, r: 26, color: '#9a6a3a' }); this.parts.burst(e.x, e.y, 2, 14, { kind: 'dot', color: '#a07040', speed: 120, up: 180, g: 500, life: 0.6, size: 3 }); this.shakeT = Math.max(this.shakeT, 0.1); break;
        case 'revive': { const v = this.view(e.id); if (v) { this.addFx('ring', 0.5, { x: v.u.x, y: v.u.y, r: 20, color: '#7dffd0', fill: true }); this.parts.burst(v.u.x, v.u.y, 4, 6, { kind: 'star', color: '#ffffff', speed: 30, up: 120, g: 0, life: 0.7, size: 2 }); } break; }
        case 'flash': this.flashT = 0.3; this.flashColor = '160,255,160'; break;
        case 'sash': { const v = this.view(e.id); if (v) this.floatText(v.u, 20, '¡Aguanta!', '#ffffff', 12); break; }
        case 'charge': { const v = this.view(e.id); if (v) this.floatText(v.u, 34 * v.u.size, '¡Derribo!', '#ffd23a', 18); break; }
        case 'enrage': if (Math.round(e.level / 0.12) % 3 === 1) this.app.feed(`¡Los Pokémon salvajes se enfurecen! <b>Ataque +${Math.round(e.level * 100)}%</b>`, 'foe'); break;
        case 'thrown': sfx('throw'); break;
        case 'ko': {
          sfx('allyKo'); this.koCount++;
          // sale despedido dando vueltas (sólo visual: en la simulación se queda donde cayó)
          const v = this.view(e.id), src = e.from != null ? this.view(e.from) : null;
          if (v) {
            const a = src ? Math.atan2(v.u.y - src.u.y, v.u.x - src.u.x) : Math.random() * Math.PI * 2;
            v.fly = { t: 0, dur: 0.55, dx: Math.cos(a) * 34, dz: Math.sin(a) * 24, h: 46 };
            this.parts.burst(v.u.x, v.u.y, 10, 3, { kind: 'star', color: '#ffffff', speed: 60, up: 80, g: 200, life: 0.5, size: 1.8 });
          }
          break;
        }
        case 'die': {
          const v = this.view(e.id);
          if (!v) break;
          sfx('faint');
          cry(v.u.dex, { rate: 0.75, vol: v.u.boss ? 0.7 : 0.3 });
          this.koStreak(v.u);
          // suelta monedas que saltan por el suelo
          for (let i = 0, n = v.u.boss ? 14 : v.u.elite ? 6 : 2; i < n; i++) this.parts.add({ kind: 'coin', x: v.u.x, y: v.u.y, h: 20 * v.u.size, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 80, vh: 160 + Math.random() * 120, g: 600, bounce: 0.45, life: 1.4, size: 3.4 });
          // ¡puf! estrellitas y un aro al debilitarse
          const n = v.u.boss ? 16 : v.u.elite ? 10 : 6;
          this.addFx('poof', v.u.boss ? 1.1 : 0.6, { x: v.u.x, y: v.u.y, r: v.u.r * 1.8, h: 18 * v.u.size, parts: Array.from({ length: n }, (_, i) => ({ a: (i / n) * Math.PI * 2 + Math.random() * 0.5, sp: 0.6 + Math.random() * 0.6 })), color: v.u.boss ? '#ffb43a' : v.u.elite ? '#ffd21a' : '#ffffff' });
          if (v.u.elite) this.floatText(v.u, 40 * v.u.size, '¡Alfa derrotado!', '#ffd21a', 16);
          this.feedLine(`¡${v.u.boss ? '' : 'El '}${v.u.name}${v.u.boss ? '' : ' salvaje'} se ha debilitado!`, 'foe', 'die' + (v.u.boss ? 'b' : ''), v.u.boss ? 0 : 700);
          break;
        }
        case 'move':
          if (e.side === 0) this.feedLine(`¡${e.who} usó <b>${e.name}</b>!`, 'mine', e.key + e.name, 6000);
          else this.feedLine(`¡${e.who} usó <b>${TRAIT_INFO[e.trait]?.[0] || e.trait}</b>!`, 'foe', e.key + e.trait, 3500);
          break;
      }
    }
  }

  later(t, fn) { setTimeout(() => { if (!this.destroyed) fn(); }, t * 1000); }

  // Racha de K.O.: rivales debilitados seguidos (menos de 1,2 s entre uno y otro)
  koStreak(u) {
    const now = performance.now();
    const st = this.streak = (this.streak && now - this.streak.t < 1200 / Math.max(1, this.app.speed)) ? this.streak : { n: 0 };
    st.n++; st.t = now; st.x = u.x; st.y = u.y;
    if (st.n >= 3) {
      sfx('combo');
      this.comboText = { n: st.n, t: 0, x: u.x, y: u.y };
    }
  }

  // Ambiente de cada acto: hojas, polvo, espuma, fuegos fatuos, polen, brillos de cristal
  ambient(dt) {
    const A = AMBIENT[this.act];
    if (!A || this.parts.busy > 0.5) return;
    this.ambT = (this.ambT || 0) + dt * A.rate;
    while (this.ambT > 1) {
      this.ambT -= 1;
      const x = Math.random() * (this.W + 300) - 150, y = Math.random() * (this.H + 200) - 120;
      this.parts.add({ ...A.p(), x, y });
    }
  }

  // chispas del color del tipo en cada golpe; los críticos, estrellas y una micropausa
  hitParticles(e) {
    const v = this.view(e.id);
    if (!v) return;
    const u = v.u, P = this.parts;
    const h = 14 * (u.side ? u.size : 1);
    if (e.side === 1) {
      const col = TYPES[e.type]?.color || '#ffffff';
      if (e.crit) {
        P.burst(u.x, u.y, h, 5, { kind: 'star', color: '#fff27a', speed: 140, up: 120, g: 380, life: 0.45, size: 3 });
        if (this.sim.t - this.lastStop > 0.35 && e.dmg > u.maxHp * 0.08) { this.hitstop = 0.06; this.lastStop = this.sim.t; }
      }
      if (P.busy < 0.6 || Math.random() < 0.3) P.burst(u.x, u.y, h, e.crit ? 5 : 2, { kind: 'spark', color: col, speed: 150, up: 90, g: 350, life: 0.28, size: 2.2 });
      if (e.type === 'poison' && Math.random() < 0.4) P.add({ kind: 'ring', x: u.x + (Math.random() - 0.5) * 12, y: u.y, h: h, vh: 30, life: 0.7, size: 2.5, color: '#c070f0' });
    } else if (P.busy < 0.5 && Math.random() < 0.4) {
      P.burst(u.x, u.y, 10, 1, { kind: 'dot', color: '#ffffff', speed: 70, up: 60, g: 300, life: 0.25, size: 1.8 });
    }
  }

  floatText(u, h, str, color, size = 16) {
    if (this.texts.length > 80) return;
    this.texts.push({ x: u.x, y: u.y, h: h + (u.z || 0), str, color, size, t: 0, dx: (Math.random() - 0.5) * 20 });
  }

  // ---------- Capa 2D: barras, textos y efectos ----------
  drawOverlay(dt, clock) {
    const c = this.ctx, W = this.cw, H = this.ch;
    c.clearRect(0, 0, W, H);
    const ts = this.ts;

    // números de daño agrupados
    this.numT -= dt;
    if (this.numT <= 0) {
      this.numT = 0.25;
      this.koT += 0.25;
      if (this.koCount && this.koT > 1.6) {
        this.app.feed(this.koCount === 1 ? 'Uno de tus Pokémon se ha debilitado' : `${this.koCount} de tus Pokémon se han debilitado`, 'ko');
        this.koCount = 0; this.koT = 0;
      }
      for (const [id, a] of this.dmgAcc) {
        const v = this.view(id);
        if (!v) continue;
        const color = a.eff > 1 ? '#ffe14a' : a.eff < 1 ? '#b8b8c8' : '#ffffff';
        this.floatText(v.u, 30 * v.u.size, fmt(a.dmg) + (a.crit ? '!' : ''), color, a.crit ? 22 : 16);
        if (a.eff > 1 && Math.random() < 0.15) this.floatText(v.u, 48 * v.u.size, '¡Es muy eficaz!', '#ffe14a', 14);
      }
      this.dmgAcc.clear();
    }

    // racha: «K.O. ×5» que crece con cada derrota
    const cb = this.comboText;
    if (cb) {
      cb.t += dt;
      if (cb.t > 1.4) this.comboText = null;
      else {
        const s = this.toScreen(cb.x, cb.y, 70);
        const pop = cb.t < 0.15 ? 1 + (0.15 - cb.t) * 5 : 1;
        c.save();
        c.globalAlpha = Math.min(1, (1.4 - cb.t) * 3);
        c.translate(s.x, s.y - cb.t * 14); c.scale(pop, pop);
        c.font = `bold ${Math.round(26 * ts)}px "Power Clear Bold", sans-serif`;
        c.textAlign = 'center'; c.lineWidth = 6; c.strokeStyle = '#283048';
        const txt = `K.O. ×${cb.n}`;
        c.strokeText(txt, 0, 0); c.fillStyle = cb.n >= 10 ? '#ff6a3a' : cb.n >= 5 ? '#ffcb05' : '#ffffff'; c.fillText(txt, 0, 0);
        c.restore();
      }
    }
    // tensión: pitido de PS bajos y música más rápida con la furia
    if (!this.ended && !this.hold) {
      const alive = this.sim.allies.filter(a => a.state !== 'ko').length / this.sim.allies.length;
      if (alive < 0.2 && alive > 0 && (this.lowT = (this.lowT || 0) - dt) <= 0) { this.lowT = 1.1; sfx('lowhp'); }
      const want = this.sim.enrage > 0.3 ? 1.06 : 1;
      if (want !== this.rate) { this.rate = want; musicRate(want); }
    }
    this.ambient(dt);
    // partículas (chispas, fuego, curas, monedas…)
    this.parts.update(dt);
    this.parts.draw(c, (x, y, h) => this.toScreen(x, y, h));
    // efectos
    this.fx = this.fx.filter(f => (f.t += dt) < f.dur);
    for (const f of this.fx) this.drawFx(c, f, f.t / f.dur);

    // barras de vida y nombres
    c.textAlign = 'center';
    c.textBaseline = 'bottom';
    for (const v of this.views.values()) {
      const u = v.u;
      if (v.dead || u.state === 'burrow') continue;
      const p = Math.max(0, u.hp / u.maxHp);
      // altura del sprite: desde los pies hasta arriba del dibujo
      const head = ((v.m.foot ?? 28) - 6) * v.scale;
      const top = this.toScreen(u.x, u.y, (u.z || 0) + v.dropY + head);
      if (top.behind) continue;
      if (u.side && !u.boss) {
        const w = Math.max(34, 22 * u.size * top.s * 1.1) * ts, bh = 4 * ts;
        const x = top.x - w / 2, y = top.y - 8;
        c.fillStyle = '#283048'; roundRect(c, x - 3, y - 3, w + 6, bh + 6, 3); c.fill();
        c.fillStyle = '#505868'; c.fillRect(x, y, w, bh);
        const col = p > 0.5 ? ['#70f8a8', '#18c020'] : p > 0.2 ? ['#f8e038', '#c8a800'] : ['#f85838', '#a82010'];
        c.fillStyle = col[1]; c.fillRect(x, y, w * p, bh);
        c.fillStyle = col[0]; c.fillRect(x, y, w * p, Math.max(1, bh * 0.4));
        const la = this.introT > 0.3 ? 0 : clamp(4.5 - this.sim.t, 0, 1);
        if (la > 0) {
          c.globalAlpha = la;
          c.font = `${Math.round(15 * ts)}px PowerClearBold`;
          c.lineWidth = 4; c.strokeStyle = '#8a1010'; c.strokeText(u.name, top.x, y - 4);
          c.fillStyle = '#fff'; c.fillText(u.name, top.x, y - 4);
          c.globalAlpha = 1;
        }
      } else if (!u.side && u.hp < u.maxHp && u.state !== 'ko') {
        const w = 16 * ts, x = top.x - w / 2, y = top.y - 4;
        c.fillStyle = 'rgba(29,27,43,.85)'; c.fillRect(x - 1, y - 1, w + 2, 4 * ts);
        c.fillStyle = p > 0.5 ? '#5ee05e' : p > 0.25 ? '#ffd23a' : '#ff5a3a'; c.fillRect(x, y, w * p, 2 * ts);
      }
    }

    // textos flotantes
    c.textBaseline = 'middle';
    this.texts = this.texts.filter(t => (t.t += dt) < 0.9);
    for (const t of this.texts) {
      const s = this.toScreen(t.x, t.y, t.h);
      const k = t.t / 0.9;
      const scale = t.t < 0.3 ? 0.6 + 0.4 * backOut(t.t / 0.3) : 1;
      c.globalAlpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      c.font = `${Math.round(t.size * scale * ts * 1.1)}px PowerClearBold`;
      c.lineWidth = 5; c.strokeStyle = '#283048';
      const y = s.y - Math.min(1, t.t / 0.3) * 30;
      c.strokeText(t.str, s.x + t.dx, y);
      c.fillStyle = t.color; c.fillText(t.str, s.x + t.dx, y);
    }
    c.globalAlpha = 1;

    // destello de pantalla
    if (this.flashT > 0) {
      this.flashT -= dt;
      c.fillStyle = `rgba(${this.flashColor || '255,255,255'},${Math.max(0, this.flashT / 0.35)})`;
      c.fillRect(0, 0, W, H);
      if (this.flashT <= 0) this.flashColor = null;
    }
  }

  ground(x, y, r) {
    const s = this.toScreen(x, y, 0);
    return { x: s.x, y: s.y, rx: r * s.s, ry: r * s.s * Math.sin(this.cam.pitch) };
  }

  drawFx(c, f, k) {
    switch (f.kind) {
      case 'proj': {
        const x = f.x0 + (f.x1 - f.x0) * k, y = f.y0 + (f.y1 - f.y0) * k;
        const h = f.h0 * (1 - k) + Math.sin(k * Math.PI) * f.arc;
        const s = this.toScreen(x, y, h);
        const r = f.r * s.s * 1.4;
        // estela
        if (f.trail && Math.random() < 0.6) this.parts.add({ kind: 'dot', x, y, h, vh: 10, life: 0.3, size: f.r * 0.5, color: f.trail });
        c.fillStyle = f.color; c.beginPath(); c.arc(s.x, s.y, r, 0, 7); c.fill();
        c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.arc(s.x, s.y, r * 0.45, 0, 7); c.fill();
        if (f.star) { c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(s.x, s.y, r + 3, 0, 7); c.stroke(); }
        break;
      }
      case 'target': { const g = this.ground(f.x, f.y, f.r * (1 - 0.3 * k)); c.strokeStyle = f.color; c.globalAlpha = 0.5 + 0.4 * k; c.lineWidth = 2; ellipse(c, g); c.stroke(); c.globalAlpha = 1; break; }
      case 'poof': {
        const g = this.ground(f.x, f.y, f.r * (0.3 + 0.9 * k));
        c.globalAlpha = 0.9 * (1 - k); c.strokeStyle = f.color; c.lineWidth = 3; ellipse(c, g); c.stroke();
        const e = 1 - (1 - k) * (1 - k);
        for (const p of f.parts) {
          const s = this.toScreen(f.x + Math.cos(p.a) * f.r * 1.4 * e * p.sp, f.y + Math.sin(p.a) * f.r * 1.4 * e * p.sp, f.h + Math.sin(k * Math.PI) * 30 * p.sp);
          star(c, s.x, s.y, Math.max(2, 6 * s.s * (1 - k * 0.6)), f.color);
        }
        c.globalAlpha = 1;
        break;
      }
      case 'boom': {
        const g = this.ground(f.x, f.y, f.r * (0.4 + 0.6 * k));
        c.globalAlpha = 0.5 * (1 - k); c.fillStyle = f.color; ellipse(c, g); c.fill();
        const g2 = this.ground(f.x, f.y, f.r * (0.5 + 0.6 * k));
        c.globalAlpha = 0.8 * (1 - k); c.strokeStyle = '#fff'; c.lineWidth = 3; ellipse(c, g2); c.stroke();
        c.globalAlpha = 1;
        break;
      }
      case 'ring': {
        const x = f.follow ? f.follow.x : f.x, y = f.follow ? f.follow.y : f.y;
        const g = this.ground(x, y, f.r * (0.3 + 0.7 * k));
        if (f.fill) { c.globalAlpha = 0.25 * (1 - k); c.fillStyle = f.color; ellipse(c, g); c.fill(); }
        c.globalAlpha = 0.9 * (1 - k); c.strokeStyle = f.color; c.lineWidth = 3; ellipse(c, g); c.stroke();
        c.globalAlpha = 1;
        break;
      }
      case 'bolt': {
        let pts = f.pts.map(([x, y]) => this.toScreen(x, y, 20));
        if (f.sky) pts = [{ x: pts[0].x + 20, y: pts[0].y - 500 }, pts[0]];
        c.strokeStyle = f.color; c.globalAlpha = 1 - k; c.lineWidth = f.w || 3;
        c.beginPath();
        pts.forEach((p, i) => {
          if (i === 0) { c.moveTo(p.x, p.y); return; }
          const q = pts[i - 1];
          for (let s = 1; s <= 3; s++) c.lineTo(q.x + (p.x - q.x) * s / 4 + (Math.random() - 0.5) * 12, q.y + (p.y - q.y) * s / 4 + (Math.random() - 0.5) * 12);
          c.lineTo(p.x, p.y);
        });
        c.stroke(); c.globalAlpha = 1;
        break;
      }
      case 'slash': {
        const pts = f.pts.map(([x, y]) => this.toScreen(x, y, 16));
        c.strokeStyle = '#fff'; c.globalAlpha = 1 - k; c.lineWidth = 3;
        c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.stroke(); c.globalAlpha = 1;
        break;
      }
      case 'bone': {
        const q = k < 0.5 ? k * 2 : 2 - k * 2;
        const s = this.toScreen(f.a.x + (f.b.x - f.a.x) * q, f.a.y + (f.b.y - f.a.y) * q, 18);
        const ang = f.t * 25, l = 7 * s.s;
        c.strokeStyle = '#f4ecd8'; c.lineWidth = 4;
        c.beginPath(); c.moveTo(s.x - Math.cos(ang) * l, s.y - Math.sin(ang) * l); c.lineTo(s.x + Math.cos(ang) * l, s.y + Math.sin(ang) * l); c.stroke();
        break;
      }
      case 'gust': {
        const cx = Math.cos(f.ang), cy = Math.sin(f.ang), len = f.len * k;
        const px = -cy * f.w, py = cx * f.w;
        const pts = [[f.x + px, f.y + py], [f.x - px, f.y - py], [f.x + cx * len - px, f.y + cy * len - py], [f.x + cx * len + px, f.y + cy * len + py]].map(([x, y]) => this.toScreen(x, y, 4));
        c.fillStyle = `rgba(223,246,255,${0.35 * (1 - k)})`;
        c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath(); c.fill();
        break;
      }
      case 'meteor': {
        const g = this.ground(f.x, f.y, f.r);
        c.strokeStyle = '#ff4a1a'; c.lineWidth = 3; c.globalAlpha = 0.8; ellipse(c, g); c.stroke();
        c.fillStyle = `rgba(0,0,0,${0.25 * k})`; ellipse(c, this.ground(f.x, f.y, f.r * k)); c.fill();
        c.globalAlpha = 1;
        const s = this.toScreen(f.x + 200 * (1 - k), f.y, 700 * (1 - k));
        c.fillStyle = '#ff7a1a'; c.beginPath(); c.arc(s.x, s.y, 18 * s.s, 0, 7); c.fill();
        c.fillStyle = '#ffe14a'; c.beginPath(); c.arc(s.x, s.y, 9 * s.s, 0, 7); c.fill();
        break;
      }
    }
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.root.classList.remove('killcam');
    document.body.classList.remove('killcam');
    this.root.dataset.field = '';
    musicRate(1);
    window.removeEventListener('resize', this.onResize);
    if (this.renderer) {
      this.scene.traverse(o => { if (o.material) { o.material.map?.dispose?.(); o.material.dispose?.(); } o.geometry?.dispose?.(); });
      this.renderer.dispose();
      this.renderer.forceContextLoss?.();
    }
    this.root.innerHTML = '';
    this.root.classList.remove('on');
  }
}

// ---------- utilidades ----------
const rnd = (a, b) => a + Math.random() * (b - a);
const AMBIENT = {
  0: { rate: 7, p: () => ({ kind: 'leaf', color: Math.random() < 0.5 ? '#6ab04a' : '#9ad06a', h: rnd(90, 180), vx: rnd(20, 45), vy: rnd(-5, 10), vh: rnd(-22, -12), life: 7, size: 2.2, spin: rnd(2, 5), alpha: 0.9 }) },
  1: { rate: 6, p: () => ({ kind: 'dot', color: '#f0e0c0', h: rnd(10, 120), vx: rnd(-8, 8), vy: rnd(-6, 6), vh: rnd(-4, 6), life: 5, size: 1.2, alpha: 0.5 }) },
  2: { rate: 5, p: () => ({ kind: 'dot', color: '#ffffff', h: rnd(2, 30), vx: rnd(-5, 5), vy: rnd(-3, 3), vh: rnd(8, 20), life: 1.6, size: 1.4, alpha: 0.7 }) },
  3: { rate: 4, p: () => ({ kind: 'dot', color: Math.random() < 0.5 ? '#b890ff' : '#7ae0ff', h: rnd(10, 90), vx: rnd(-10, 10), vy: rnd(-6, 6), vh: rnd(4, 14), life: 4, size: 2.4, grow: 0.6, alpha: 0.55 }) },
  4: { rate: 6, p: () => ({ kind: 'dot', color: '#fff2a0', h: rnd(20, 140), vx: rnd(10, 28), vy: rnd(-4, 4), vh: rnd(-6, 4), life: 6, size: 1.4, alpha: 0.75 }) },
  5: { rate: 4, p: () => ({ kind: 'star', color: Math.random() < 0.5 ? '#7ad8ff' : '#e0b0ff', h: rnd(10, 120), vx: 0, vy: 0, vh: rnd(-3, 3), life: 2.2, size: 1.3, alpha: 0.85 }) },
};

function star(c, x, y, r, color) {
  c.fillStyle = color;
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
  c.fill();
}

function radial(inner, outer) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, inner); gr.addColorStop(0.6, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return cv;
}
function hex(n) { return typeof n === 'string' ? n : '#' + n.toString(16).padStart(6, '0'); }
function ellipse(c, g) { c.beginPath(); c.ellipse(g.x, g.y, Math.max(0.1, g.rx), Math.max(0.1, g.ry), 0, 0, Math.PI * 2); }
function roundRect(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); }
function bounce(k) {
  const n = 7.5625, d = 2.75;
  if (k < 1 / d) return n * k * k;
  if (k < 2 / d) return n * (k -= 1.5 / d) * k + 0.75;
  if (k < 2.5 / d) return n * (k -= 2.25 / d) * k + 0.9375;
  return n * (k -= 2.625 / d) * k + 0.984375;
}
function backOut(k) { const s = 1.70158; return 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2); }
function fmt(n) {
  if (n >= 10000) return (n / 1000).toFixed(0) + 'k';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return Math.round(n).toString();
}
