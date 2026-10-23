// Simulación de combate pura (sin Phaser). La vista lee `units` y consume `events`.
import { typeMult } from '../data/types.js';

export const ARENA = { w: 1280, h: 720 };
// Márgenes jugables dentro del escenario (el borde está decorado con árboles y rocas)
export function arenaBounds(w, h) {
  return { w, h, l: 56, r: w - 56, t: 120, b: h - 46, portrait: h > w };
}
const STEP = 1 / 60;
const ALLY_R = 8;
const CELL = 32;

const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[(Math.random() * arr.length) | 0];
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

let nextId = 1;

export class Battle {
  constructor({ allies, enemies, round = 0, powerScale = 1, arena = ARENA, enrage = { start: 35, every: 5 }, field = {} }) {
    this.A = arenaBounds(arena.w, arena.h);
    this.t = 0;
    this.acc = 0;
    this.round = round;
    this.powerScale = powerScale; // daño de consumibles
    this.units = [];
    this.allies = [];
    this.enemies = [];
    this.events = [];
    this.pending = [];
    this.result = null;
    this.stats = {}; // por especie: dmg, kills, heal, ko, taken
    this.enrage = 0;
    this.enrageCfg = enrage;
    this.grid = new Map();

    const rattatas = allies.filter(a => a.ability === 'manada').length;
    for (const spec of allies) this.spawn(spec, 0, rattatas);
    for (const spec of enemies) this.spawn(spec, 1);
    this.focusedBoss = this.enemies.find(e => e.boss) || null;
    // modificadores del campo (elegidos en el rancho)
    this.field = field;
    for (const u of this.units) {
      if (field.frenzy) u.as *= 1.5;
      if (field.swamp) u.spd *= 0.5;
    }
  }

  stat(key) {
    return (this.stats[key] ??= { dmg: 0, kills: 0, heal: 0, ko: 0, taken: 0, n: 0 });
  }

  spawn(spec, side, rattatas = 0) {
    const u = {
      id: nextId++, side, ...spec,
      maxHp: spec.hp, x: 0, y: 0, z: 0, vx: 0, vy: 0,
      target: null, retarget: 0, cd: rand(0, 0.6), state: 'move',
      stun: 0, sleep: false, air: null, facing: side ? Math.PI : 0,
      lastAttack: -1, lastHurt: -1, hitCount: 0, charges: 0,
      buffs: { berserk: 0, lsAura: 0, missT: 0, miss: 0, plagueT: 0, slowT: 0, acidT: 0, acid: 0, poisonT: 0, poison: 0, pinchT: 0, pinchDps: 0, pinchBy: null },
      vuln: 0, tauntBy: null, tauntT: 0, stunStacks: 0, ab: rand(0.5, 2.5), ab2: rand(2, 5),
      sashUsed: false, sitrusUsed: false, primalDone: false, restDone: false, trampleCd: 0,
      blockChance: 0, crowd: 0,
    };
    u.r = side ? ALLY_R * spec.size * 1.35 : ALLY_R * (spec.stage >= 2 ? 1.25 : spec.stage === 1 ? 1.1 : 1);
    if (side === 0) {
      if (u.ability === 'manada') {
        const bonus = 1 + Math.min(0.9, 0.03 * (rattatas - 1));
        u.atk *= bonus; u.maxHp *= bonus;
        if (u.stage >= 1) u.crit += 0.15;
      }
      const A = this.A;
      if (A.portrait) { u.x = rand(A.l, A.r); u.y = rand(A.h * 0.6, A.b); }
      else { u.x = rand(A.l, A.w * 0.42); u.y = rand(A.t, A.b); }
      this.allies.push(u);
      this.stat(u.key).n++;
    } else {
      const A = this.A;
      if (A.portrait) {
        u.x = u.boss ? A.w / 2 : rand(A.l + u.r, A.r - u.r);
        u.y = u.boss ? A.t + (A.b - A.t) * 0.22 : rand(A.t + u.r, A.h * 0.42);
      } else {
        u.x = u.boss ? A.w * 0.78 : rand(A.w * 0.6, A.r - u.r);
        u.y = u.boss ? (A.t + A.b) / 2 : rand(A.t + u.r, A.b - u.r);
      }
      this.enemies.push(u);
      if (u.traits?.includes('hangry')) {
        this.later(0.8, () => this.charge(u));
        this.later(2.6, () => this.charge(u));
      }
    }
    u.hp = u.maxHp;
    this.units.push(u);
    return u;
  }

  cx(x, r = 0) { return clamp(x, this.A.l + r * 0.5, this.A.r - r * 0.5); }
  cy(y, r = 0) { return clamp(y, this.A.t, this.A.b - r * 0.3); }

  later(t, fn) { this.pending.push({ t: this.t + t, fn }); }
  emit(type, data) { this.events.push({ type, ...data }); }
  // Aviso para el registro de combate: nombre del movimiento (aliados) o rasgo (enemigos)
  move(u, name, trait) { this.emit('move', { by: u.id, side: u.side, who: u.name, key: u.key, name, trait }); }
  has(u, trait) { return u.traits && u.traits.includes(trait); }
  alive(u) { return u.hp > 0 && u.state !== 'ko'; }
  targetable(u) { return this.alive(u) && u.state !== 'burrow'; }

  update(dt) {
    if (this.result) return;
    this.acc += Math.min(dt, 0.25);
    while (this.acc >= STEP && !this.result) {
      this.acc -= STEP;
      this.tick(STEP);
    }
  }

  tick(dt) {
    this.t += dt;
    // efectos programados
    if (this.pending.length) {
      const due = this.pending.filter(p => p.t <= this.t);
      if (due.length) {
        this.pending = this.pending.filter(p => p.t > this.t);
        for (const p of due) p.fn();
      }
    }
    // Furia de los enemigos para evitar combates eternos
    // (como el temporizador de How Many Dudes: ataque acumulable cada pocos segundos)
    const E = this.enrageCfg;
    if (this.t > E.start && Math.floor((this.t - E.start) / E.every) > Math.floor((this.t - dt - E.start) / E.every)) {
      this.enrage += 0.12;
      this.emit('enrage', { level: this.enrage });
    }
    // gas tóxico: todos pierden un poco de vida cada segundo
    if (this.field.toxic) for (const u of this.units) if (this.alive(u)) this.damage(null, u, u.maxHp * 0.012 * dt, { dot: true });
    this.buildGrid();
    if (Math.floor(this.t * 2) !== Math.floor((this.t - dt) * 2)) this.slowTick();

    for (const u of this.units) {
      if (!this.alive(u)) continue;
      this.updateStatus(u, dt);
      if (u.air) { this.updateAir(u, dt); continue; }
      if (u.stun > 0) { u.stun -= dt; if (u.stun <= 0) u.sleep = false; continue; }
      if (u.state === 'burrow' || u.state === 'charge' || u.state === 'busy') { if (u.state === 'charge') this.updateCharge(u, dt); continue; }
      if (u.side === 0) this.allyAbilities(u, dt); else this.enemyAbilities(u, dt);
      if (!this.alive(u) || u.state !== 'move') continue;
      this.think(u, dt);
    }
    this.separate();

    const enemiesAlive = this.enemies.some(e => this.alive(e));
    if (!enemiesAlive) this.finish('win');
    else if (!this.allies.some(a => this.alive(a))) this.finish('lose');
  }

  finish(result) {
    this.result = result;
    this.emit('end', { result });
  }

  buildGrid() {
    this.grid.clear();
    for (const u of this.units) {
      if (!this.alive(u) || u.air) continue;
      const k = ((u.x / CELL) | 0) + ',' + ((u.y / CELL) | 0);
      let c = this.grid.get(k);
      if (!c) this.grid.set(k, (c = []));
      c.push(u);
    }
  }

  near(x, y, radius, side) {
    const out = [];
    const r2 = radius * radius;
    const x0 = Math.floor((x - radius) / CELL), x1 = Math.floor((x + radius) / CELL);
    const y0 = Math.floor((y - radius) / CELL), y1 = Math.floor((y + radius) / CELL);
    for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) {
      const c = this.grid.get(gx + ',' + gy);
      if (!c) continue;
      for (const u of c) {
        if (side !== undefined && u.side !== side) continue;
        const rr = radius + (u.side ? u.r : 0);
        if ((u.x - x) ** 2 + (u.y - y) ** 2 <= Math.max(r2, rr * rr)) out.push(u);
      }
    }
    return out;
  }

  // Cada 0.5 s: probabilidad de bloqueo de los Squirtle, enjambres...
  slowTick() {
    for (const a of this.allies) a.blockChance = 0;
    for (const s of this.allies) {
      if (s.ability !== 'withdraw' || !this.alive(s)) continue;
      const chance = (0.25 + 0.05 * s.stage) * Math.min(1.5, s.power);
      for (const a of this.near(s.x, s.y, 45, 0)) a.blockChance = Math.min(0.55, 1 - (1 - a.blockChance) * (1 - chance));
    }
    for (const e of this.enemies) {
      if (!this.alive(e) || !this.has(e, 'swarmer')) continue;
      const n = this.near(e.x, e.y, 120, 1).filter(o => o !== e && o.key === e.key).length;
      e.swarm = Math.min(3, n) * 0.12;
    }
    const crowd = new Map();
    for (const a of this.allies) if (a.target) crowd.set(a.target, (crowd.get(a.target) || 0) + 1);
    for (const e of this.enemies) e.crowd = crowd.get(e) || 0;
  }

  updateStatus(u, dt) {
    const b = u.buffs;
    for (const k of ['berserk', 'lsAura', 'missT', 'plagueT', 'slowT', 'acidT', 'poisonT', 'pinchT']) if (b[k] > 0) b[k] -= dt;
    if (b.acidT <= 0) b.acid = 0;
    if (b.missT <= 0) b.miss = 0;
    if (u.tauntT > 0) { u.tauntT -= dt; if (u.tauntT <= 0) u.tauntBy = null; }
    if (u.trampleCd > 0) u.trampleCd -= dt;
    if (b.poisonT > 0) this.damage(null, u, b.poison * dt, { dot: true, srcKey: b.poisonKey });
    if (b.pinchT > 0 && b.pinchBy && this.alive(b.pinchBy)) this.damage(b.pinchBy, u, b.pinchDps * dt, { dot: true });
    if (u.regen > 0 && u.hp < u.maxHp) this.heal(u, u.maxHp * u.regen * dt, null, true);
  }

  updateAir(u, dt) {
    const a = u.air;
    a.t += dt;
    const k = Math.min(1, a.t / a.dur);
    u.x = a.x0 + (a.x1 - a.x0) * k;
    u.y = a.y0 + (a.y1 - a.y0) * k;
    u.z = Math.sin(k * Math.PI) * a.h;
    if (k >= 1) {
      u.air = null; u.z = 0;
      u.stun = Math.max(u.stun, 0.5);
      this.emit('land', { id: u.id });
    }
  }

  // ---------- Movimiento y ataque básico ----------
  atkSpeed(u) {
    let s = u.as * (1 + (u.buffs.berserk > 0 ? 0.6 : 0) + (u.swarm || 0));
    if (u.side === 1) s *= 1 + this.enrage * 0.3;
    if (u.buffs.slowT > 0) s *= 0.6;
    return s;
  }
  moveSpeed(u) {
    let s = u.spd * (1 + (u.buffs.berserk > 0 ? 0.6 : 0) + (u.swarm || 0));
    if (u.buffs.slowT > 0) s *= 0.5;
    if (u.buffs.pinchT > 0) s *= 0.2;
    return s;
  }

  chooseTarget(u) {
    if (u.side === 1 && u.tauntBy && this.targetable(u.tauntBy)) return u.tauntBy;
    const foes = u.side === 0 ? this.enemies : this.allies;
    let best = null, bestScore = Infinity;
    for (const f of foes) {
      if (!this.targetable(f) || f.air) continue;
      let s = Math.sqrt(dist2(u, f)) - f.r;
      if (u.side === 0) s += (f.crowd || 0) * (6 / Math.max(1, f.size)) ;
      if (s < bestScore) { bestScore = s; best = f; }
    }
    return best;
  }

  think(u, dt) {
    u.retarget -= dt;
    if (!u.target || !this.targetable(u.target) || u.target.air || u.retarget <= 0 || (u.side === 1 && u.tauntBy && u.target !== u.tauntBy)) {
      u.target = this.chooseTarget(u);
      u.retarget = rand(0.4, 0.8);
    }
    u.cd -= dt;
    const t = u.target;
    if (!t) { u.vx = u.vy = 0; return; }
    const dx = t.x - u.x, dy = t.y - u.y;
    const d = Math.hypot(dx, dy) || 1;
    const reach = u.r + t.r + (u.side ? 4 : 12) + (u.range || 0);
    u.facing = Math.atan2(dy, dx);
    if (d > reach) {
      const sp = this.moveSpeed(u);
      u.vx = (dx / d) * sp; u.vy = (dy / d) * sp;
      u.x += u.vx * dt; u.y += u.vy * dt;
      if (this.has(u, 'trample')) this.trample(u);
    } else {
      u.vx = u.vy = 0;
      if (u.cd <= 0) this.attack(u, t);
    }
  }

  attack(u, t) {
    u.cd = 1 / this.atkSpeed(u);
    u.lastAttack = this.t;
    this.emit('attack', { id: u.id });
    if (u.ability === 'bonemerang') {
      this.emit('bone', { from: u.id, to: t.id });
      this.later(0.22, () => this.alive(t) && this.damage(u, t, u.atk * 0.65, { direct: true }));
      this.later(0.45, () => this.alive(t) && this.damage(u, t, u.atk * 0.65, { direct: true }));
      return;
    }
    this.later(0.15, () => {
      if (!this.alive(u) || !this.targetable(t)) return;
      if (Math.sqrt(dist2(u, t)) > u.r + t.r + 28 + (u.range || 0)) return;
      this.damage(u, t, u.atk, { direct: true, attack: true });
    });
    if (u.side === 1) this.enemyOnAttack(u, t);
  }

  // ---------- Daño y curación ----------
  damage(src, tgt, amount, o = {}) {
    if (!this.alive(tgt) || tgt.state === 'burrow' || amount <= 0) return 0;
    let crit = false, eff = 1;
    if (src && !o.dot) {
      const miss = src.buffs.miss || 0;
      if (miss && Math.random() < miss) { this.emit('miss', { id: tgt.id }); return 0; }
      if (o.direct && tgt.evasion && Math.random() < tgt.evasion) { this.emit('evade', { id: tgt.id }); return 0; }
      if (o.direct && tgt.side === 0 && tgt.blockChance && Math.random() < tgt.blockChance) { this.emit('block', { id: tgt.id }); return 0; }
      eff = typeMult(o.type || src.atkType, tgt.types);
      amount *= eff;
      if (eff > 1 && src.se) amount *= 1 + src.se;
      if (src.typeBoost) amount *= 1 + (src.typeBoost[o.type || src.atkType] || 0);
      if (src.buffs.acid) amount *= 1 - src.buffs.acid;
      if (src.side === 1) amount *= 1 + this.enrage;
      if (src.primal) amount *= 1.5;
      if (o.forceCrit || (src.crit && Math.random() < src.crit)) { crit = true; amount *= 1.5 + (src.critDmg || 0); }
    }
    amount *= (1 + tgt.vuln) * (1 - Math.min(0.75, tgt.tough || 0));
    const before = tgt.hp;
    tgt.hp -= amount;
    tgt.lastHurt = this.t;
    const dealt = Math.min(before, amount);
    const key = src ? src.key : o.srcKey;
    if (key && (src ? src.side === 0 : true) && tgt.side === 1) this.stat(key).dmg += dealt;
    if (tgt.side === 0) this.stat(tgt.key).taken += dealt;
    if (!o.dot || amount > 2) this.emit('hit', { id: tgt.id, dmg: amount, crit, eff, side: tgt.side, type: o.type || src?.atkType, from: src?.id });

    if (src && this.alive(src) && !o.dot) {
      const ls = (src.lifesteal || 0) + (src.buffs.lsAura > 0 ? 0.2 : 0);
      if (ls && o.direct) {
        this.heal(src, dealt * ls, src, true);
        if (src.ability === 'leechlife' && Math.random() < 0.1) {
          for (let i = 0; i < 3; i++) { const a = pick(this.allies); if (this.alive(a)) a.buffs.lsAura = 4; }
          this.emit('aura', { id: src.id });
        }
      }
      if (src.side === 0 && o.direct) this.allyOnHit(src, tgt, crit, o);
      if (src.side === 1 && o.attack) this.enemyOnHit(src, tgt);
      if (tgt.side === 1 && o.direct && this.has(tgt, 'quills') && Math.random() < 0.2) this.damage(tgt, src, tgt.atk * 0.5, {});
    }

    if (tgt.hp <= 0) {
      if (tgt.side === 0 && tgt.sash && !tgt.sashUsed) { tgt.sashUsed = true; tgt.hp = 1; this.emit('sash', { id: tgt.id }); }
      else this.ko(tgt, src);
    } else {
      if (tgt.side === 0 && tgt.sitrus && !tgt.sitrusUsed && tgt.hp < tgt.maxHp * 0.4) {
        tgt.sitrusUsed = true; this.heal(tgt, tgt.maxHp * tgt.sitrus, null); this.emit('berry', { id: tgt.id });
      }
      if (tgt.side === 1) this.enemyOnHurt(tgt);
    }
    return amount;
  }

  heal(u, amt, src, quiet = false) {
    if (!this.alive(u) || amt <= 0) return 0;
    amt *= (1 + (u.healMod || 0)) * (u.buffs.plagueT > 0 ? 0.5 : 1);
    const real = Math.min(u.maxHp - u.hp, amt);
    u.hp += real;
    if (src && src.side === 0 && real > 0) this.stat(src.key).heal += real;
    if (!quiet && real > 1) this.emit('healed', { id: u.id, amt: real });
    return real;
  }

  ko(u, src) {
    u.hp = 0;
    if (u.side === 0) {
      u.state = 'ko'; u.air = null; u.z = 0; u.vx = u.vy = 0;
      this.stat(u.key).ko++;
      this.emit('ko', { id: u.id, from: src?.id ?? null });
      if (u.ability === 'selfdestruct') this.move(u, 'Autodestrucción');
      if (u.ability === 'selfdestruct') this.explode(u.x, u.y, 55 + 12 * u.stage, u.atk * 8 * u.power, u, 1);
    } else {
      u.state = 'dead';
      if (src && src.side === 0) this.stat(src.key).kills++;
      this.emit('die', { id: u.id });
      if (this.has(u, 'explode')) this.explode(u.x, u.y, 60 + u.r, u.atk * 2, u, 0, true);
    }
  }

  explode(x, y, radius, dmg, src, targetSide, throws = false) {
    this.emit('explosion', { x, y, r: radius });
    for (const t of this.near(x, y, radius, targetSide)) {
      this.damage(src.side === targetSide ? null : src, t, dmg, { type: src.atkType, srcKey: src.key });
      if (throws) this.throwUnit(t, x, y, 90);
    }
  }

  stunUnit(u, dur, sleep = false) {
    if (!this.alive(u) || this.has(u, 'stable')) return;
    if (this.has(u, 'huge')) {
      u.stunStacks++;
      if (u.stunStacks < 4) return;
      u.stunStacks = 0; dur *= 0.6;
    }
    u.stun = Math.max(u.stun, dur);
    if (sleep) { u.sleep = true; this.emit('sleep', { id: u.id }); }
  }

  throwUnit(u, fx, fy, power) {
    if (!this.alive(u) || u.air || this.has(u, 'stable') || this.has(u, 'huge') || u.side === 1) return;
    let dx = u.x - fx, dy = u.y - fy;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 1) { const a = rand(0, 6.28); dx = Math.cos(a); dy = Math.sin(a); }
    const dist = power * rand(0.8, 1.2);
    u.air = {
      t: 0, dur: 0.45 + dist / 900, h: 30 + dist * 0.25,
      x0: u.x, y0: u.y,
      x1: this.cx(u.x + (dx / d) * dist),
      y1: this.cy(u.y + (dy / d) * dist),
    };
    u.target = null;
    this.emit('thrown', { id: u.id });
  }

  // ---------- Habilidades de tus Pokémon ----------
  allyAbilities(u, dt) {
    const ab = u.ability;
    if (ab === 'ember' || ab === 'leech' || ab === 'taunt' || ab === 'teleport' || ab === 'softboiled' || ab === 'dig') {
      u.ab -= dt;
      if (u.ab > 0) return;
    } else return;
    const P = u.power;
    if (ab === 'ember') {
      u.ab = 4;
      const t = this.randomEnemy();
      if (!t) return;
      const r = 40 + 15 * u.stage;
      const tx = t.x, ty = t.y;
      this.emit('fireball', { from: u.id, x: tx, y: ty, r, dur: 0.5 });
      this.move(u, u.stage >= 2 ? 'Lanzallamas' : 'Ascuas');
      this.later(0.5, () => {
        this.emit('explosion', { x: tx, y: ty, r, color: 0xff7a1a });
        for (const e of this.near(tx, ty, r, 1)) this.damage(u, e, u.atk * 3 * P, { type: 'fire' });
      });
    } else if (ab === 'leech') {
      u.ab = 5;
      const hurt = this.mostInjured(1)[0];
      if (!hurt) return;
      const r = 55 + 10 * u.stage;
      this.emit('pulse', { x: hurt.x, y: hurt.y, r, color: 0x7dff7a });
      this.move(u, 'Drenadoras');
      for (const a of this.near(hurt.x, hurt.y, r, 0)) this.heal(a, u.atk * 2.5 * P, u, true);
    } else if (ab === 'taunt') {
      u.ab = 6;
      const foes = this.near(u.x, u.y, 140, 1).filter(e => !(this.has(e, 'huge') && Math.random() < 0.3));
      foes.sort((a, b) => dist2(a, u) - dist2(b, u));
      for (const e of foes.slice(0, 2 + u.stage)) { e.tauntBy = u; e.tauntT = 3; e.target = u; }
      if (foes.length) this.emit('taunt', { id: u.id });
      if (foes.length) this.move(u, 'Provocación');
    } else if (ab === 'teleport') {
      u.ab = 5;
      let best = null;
      for (const e of this.enemies) if (this.targetable(e) && (!best || e.hp / e.maxHp < best.hp / best.maxHp)) best = e;
      if (!best) return;
      const a = rand(0, 6.28);
      this.emit('teleport', { id: u.id, x0: u.x, y0: u.y });
      this.move(u, 'Teletransporte');
      u.x = this.cx(best.x + Math.cos(a) * (best.r + u.r + 2));
      u.y = this.cy(best.y + Math.sin(a) * (best.r + u.r + 2));
      u.target = best;
      u.lastAttack = this.t;
      this.damage(u, best, u.atk * 2 * P, { direct: true, forceCrit: true });
    } else if (ab === 'softboiled') {
      u.ab = 3.5;
      const hurt2 = this.mostInjured(2);
      if (hurt2.length) this.move(u, 'Amortiguador');
      for (const a of hurt2) {
        this.heal(a, a.maxHp * 0.18 * P, u);
        this.emit('pulse', { x: a.x, y: a.y, r: 14, color: 0xffb6d9 });
      }
    } else if (ab === 'dig') {
      u.ab = 6;
      let best = null;
      for (const e of this.enemies) if (this.targetable(e) && (!best || e.hp > best.hp)) best = e;
      if (!best) return;
      u.state = 'burrow';
      this.emit('dig', { id: u.id, x: u.x, y: u.y });
      this.move(u, 'Excavar');
      this.later(0.6, () => {
        if (u.state !== 'burrow') return;
        u.state = 'move';
        if (!this.targetable(best)) return;
        const a = rand(0, 6.28);
        u.x = this.cx(best.x + Math.cos(a) * best.r * 0.8);
        u.y = this.cy(best.y + Math.sin(a) * best.r * 0.8);
        this.emit('emerge', { id: u.id, x: u.x, y: u.y });
        u.target = best;
        this.damage(u, best, u.atk * 2.5 * P, { direct: true });
        this.stunUnit(best, 0.4);
      });
    }
  }

  allyOnHit(u, t, crit, o) {
    const P = u.power;
    switch (u.ability) {
      case 'static':
        if (!o.attack) break;
        if (++u.charges >= 6) {
          u.charges = 0;
          const n = u.stage ? 5 : 3;
          const chain = [t];
          let cur = t;
          while (chain.length < n) {
            let best = null, bd = Infinity;
            for (const e of this.enemies) {
              if (!this.targetable(e) || chain.includes(e)) continue;
              const d = dist2(e, cur);
              if (d < bd && d < 260 * 260) { bd = d; best = e; }
            }
            if (!best) break;
            chain.push(best); cur = best;
          }
          this.emit('lightning', { pts: [[u.x, u.y], ...chain.map(e => [e.x, e.y])] });
          this.move(u, 'Impactrueno');
          for (const e of chain) { this.damage(u, e, u.atk * 2.5 * P, { type: 'electric' }); this.stunUnit(e, 0.5); }
        }
        break;
      case 'focus':
        if (o.attack && Math.random() < 0.12) { u.buffs.berserk = 4; this.emit('rage', { id: u.id }); this.move(u, 'Foco Energía'); }
        break;
      case 'acid':
        t.buffs.acid = Math.min(0.3, (t.buffs.acid || 0) + 0.05);
        t.buffs.acidT = 4;
        t.buffs.poison = Math.max(t.buffs.poison, u.atk * 0.25 * P);
        t.buffs.poisonT = 4; t.buffs.poisonKey = u.key;
        break;
      case 'confuse':
        if (o.attack && Math.random() < 0.15) this.equalize(u);
        break;
      case 'sing':
        if (o.attack && ++u.hitCount >= 8) {
          u.hitCount = 0;
          this.emit('sing', { id: u.id });
          this.move(u, 'Canto');
          const foes = this.near(u.x, u.y, 110, 1).slice(0, 3 + u.stage);
          for (const e of foes) this.stunUnit(e, 2 * Math.min(2, P), true);
        }
        break;
      case 'furycutter':
        if (crit && o.attack) {
          const others = this.enemies.filter(e => e !== t && this.targetable(e)).sort((a, b) => dist2(a, t) - dist2(b, t)).slice(0, 3);
          if (others.length) this.emit('slash', { pts: [[t.x, t.y], ...others.map(e => [e.x, e.y])] });
          if (others.length) this.move(u, 'Corte Furia');
          for (const e of others) this.damage(u, e, u.atk * 0.8 * P, {});
        }
        break;
      case 'payday':
        if (o.attack && Math.random() < 0.05) this.emit('coin', { x: t.x, y: t.y });
        break;
    }
  }

  equalize(src) {
    const live = this.allies.filter(a => this.alive(a));
    if (live.length < 2) return;
    let lo = live[0], hi = live[0];
    for (const a of live) {
      if (a.hp / a.maxHp < lo.hp / lo.maxHp) lo = a;
      if (a.hp / a.maxHp > hi.hp / hi.maxHp) hi = a;
    }
    if (lo === hi) return;
    const p = (lo.hp + hi.hp) / (lo.maxHp + hi.maxHp);
    const gained = p * lo.maxHp - lo.hp;
    lo.hp = p * lo.maxHp; hi.hp = p * hi.maxHp;
    this.stat(src.key).heal += Math.max(0, gained);
    this.heal(lo, lo.maxHp * 0.05 * src.power, src, true);
    this.heal(hi, hi.maxHp * 0.05 * src.power, src, true);
    this.emit('equalize', { a: lo.id, b: hi.id });
    this.move(src, 'Rayo Confuso');
  }

  mostInjured(n) {
    return this.allies.filter(a => this.alive(a) && a.hp < a.maxHp && !a.air)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp).slice(0, n);
  }
  randomEnemy() {
    const live = this.enemies.filter(e => this.targetable(e));
    return live.length ? pick(live) : null;
  }
  randomAlly() {
    const live = this.allies.filter(a => this.alive(a) && !a.air);
    return live.length ? pick(live) : null;
  }

  // ---------- Rasgos de los enemigos ----------
  enemyOnAttack(u, t) {
    if (this.has(u, 'phased') && Math.random() < 0.12) {
      const a = this.randomAlly();
      if (a) {
        this.emit('teleport', { id: u.id, x0: u.x, y0: u.y });
        this.move(u, null, 'phased');
        u.x = this.cx(a.x + u.r); u.y = a.y;
        u.target = a; u.cd = 0.2;
      }
    }
    if (this.has(u, 'starburst') && Math.random() < 0.25) {
      const a = this.randomAlly();
      if (a) { this.move(u, null, 'starburst'); this.projectile(u, a.x, a.y, 40, u.atk, 'star', 0xfff27a, 100); }
    }
  }

  enemyOnHit(u, t) {
    if (this.has(u, 'venom')) t.vuln = Math.min(0.3, t.vuln + 0.06);
    if (this.has(u, 'peck') && Math.random() < 0.25) { t.buffs.miss = 0.3; t.buffs.missT = 3; }
    if (this.has(u, 'plagued')) t.buffs.plagueT = 4;
    if (this.has(u, 'pinch') && Math.random() < 0.15) { t.buffs.pinchT = 3; t.buffs.pinchDps = u.atk * 0.6; t.buffs.pinchBy = u; }
    if (this.has(u, 'throw') && Math.random() < 0.2) { this.move(u, null, 'throw'); this.throwUnit(t, u.x, u.y, 220); }
    if (this.has(u, 'tailwhip') && Math.random() < 0.15) { this.move(u, null, 'tailwhip'); this.throwUnit(t, u.x, u.y, 170); }
  }

  enemyOnHurt(u) {
    if (this.has(u, 'primal') && !u.primal && u.hp < u.maxHp * 0.5) {
      u.primal = true;
      this.emit('roar', { id: u.id });
      this.move(u, null, 'primal');
    }
    if (this.has(u, 'rest') && !u.restDone && u.hp < u.maxHp * 0.35) {
      u.restDone = true;
      u.stun = 3; u.sleep = true;
      this.emit('sleep', { id: u.id });
      this.move(u, null, 'rest');
      for (let i = 1; i <= 6; i++) this.later(i * 0.5, () => { if (this.alive(u)) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.05); });
    }
    if (this.has(u, 'rampage') && u.hp < u.maxHp * 0.5 && (u.rampageT || 0) < this.t) {
      u.rampageT = this.t + 10;
      this.move(u, null, 'rampage');
      u.state = 'busy';
      for (let i = 0; i < 5; i++) this.later(0.15 * i, () => {
        const a = this.randomAlly();
        if (!a || !this.alive(u)) return;
        u.x = a.x; u.y = a.y; u.lastAttack = this.t;
        this.emit('slash', { pts: [[a.x - 10, a.y - 10], [a.x + 10, a.y + 10]] });
        this.damage(u, a, u.atk * 1.2, {});
      });
      this.later(0.8, () => { if (u.state === 'busy') u.state = 'move'; });
    }
  }

  projectile(src, x, y, r, dmg, kind, color, throwPow = 0, extra) {
    const dur = 0.55;
    this.emit('projectile', { from: src.id, x, y, dur, kind, color });
    this.later(dur, () => {
      this.emit('explosion', { x, y, r, color });
      for (const a of this.near(x, y, r, 0)) {
        this.damage(src, a, dmg, { type: src.atkType });
        if (throwPow) this.throwUnit(a, x, y, throwPow);
        if (extra) extra(a);
      }
    });
  }

  enemyAbilities(u, dt) {
    if (this.has(u, 'trample') && u.vx === 0) this.trample(u);
    u.ab -= dt;
    if (u.ab > 0) return;
    const boss = u.boss ? 0.7 : 1;
    const traits = u.traits || [];
    const usable = traits.filter(t => ['sleeppowder', 'healer', 'mud', 'shell', 'hydro', 'shadowball', 'flames', 'thunder', 'blizzard', 'gust', 'psystorm', 'charger'].includes(t));
    if (!usable.length) { u.ab = 999; return; }
    const tr = pick(usable);
    u.ab = rand(4.5, 6.5) * boss;
    this.move(u, null, tr);
    const a = this.randomAlly();
    switch (tr) {
      case 'sleeppowder':
        if (!a) break;
        this.emit('powder', { x: a.x, y: a.y, r: 50, color: 0xd6a8ff });
        for (const t of this.near(a.x, a.y, 50, 0)) this.stunUnit(t, 1.5, true);
        break;
      case 'healer':
        this.emit('pulse', { x: u.x, y: u.y, r: 150, color: 0xffb6d9 });
        for (const e of this.near(u.x, u.y, 150, 1)) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.08);
        break;
      case 'mud':
        if (!a) break;
        this.projectile(u, a.x, a.y, 45, u.atk * 0.5, 'mud', 0x7a5a2a, 0, t => { t.buffs.miss = 0.35; t.buffs.missT = 3; });
        break;
      case 'shell':
        this.emit('explosion', { x: u.x, y: u.y, r: u.r + 35, color: 0x9ad8ff });
        for (const t of this.near(u.x, u.y, u.r + 35, 0)) { this.damage(u, t, u.atk, {}); this.throwUnit(t, u.x, u.y, 130); }
        break;
      case 'hydro': case 'shadowball': case 'flames': case 'thunder': case 'blizzard': {
        if (!a) break;
        const color = { hydro: 0x4aa8ff, shadowball: 0x6a3a9a, flames: 0xff6a1a, thunder: 0xffe14a, blizzard: 0xcff4ff }[tr];
        const n = u.boss ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const tgt = i === 0 ? a : this.randomAlly();
          if (!tgt) continue;
          this.projectile(u, tgt.x, tgt.y, u.boss ? 60 : 48, u.atk * 0.8, tr, color, 0, t => {
            if (tr === 'thunder') this.stunUnit(t, 0.6);
            if (tr === 'blizzard') t.buffs.slowT = 3;
          });
        }
        break;
      }
      case 'gust': case 'psystorm': {
        if (tr === 'psystorm') {
          const r = 200;
          this.emit('wave', { x: u.x, y: u.y, r, color: 0xff7ad8 });
          for (const t of this.near(u.x, u.y, r, 0)) { this.damage(u, t, u.atk, { type: 'psychic' }); this.throwUnit(t, u.x, u.y, 170); }
          break;
        }
        if (!a) break;
        const ang = Math.atan2(a.y - u.y, a.x - u.x);
        const len = 480, w = 40;
        this.emit('gust', { x: u.x, y: u.y, ang, len, w });
        const cx = Math.cos(ang), cy = Math.sin(ang);
        for (const t of this.allies) {
          if (!this.alive(t) || t.air) continue;
          const px = t.x - u.x, py = t.y - u.y;
          const along = px * cx + py * cy, side = Math.abs(-px * cy + py * cx);
          if (along > 0 && along < len && side < w) {
            this.damage(u, t, u.atk * 0.6, { type: 'flying' });
            this.throwUnit(t, t.x - cx * 10, t.y - cy * 10, 160);
          }
        }
        break;
      }
      case 'charger':
        this.charge(u);
        break;
    }
  }

  charge(u) {
    const a = this.randomAlly();
    if (!a || !this.alive(u)) return;
    const ang = Math.atan2(a.y - u.y, a.x - u.x);
    const dist = 420;
    u.state = 'charge';
    u.chargeT = dist / (u.spd * 4);
    u.vx = Math.cos(ang) * u.spd * 4; u.vy = Math.sin(ang) * u.spd * 4;
    u.facing = ang;
    u.hitSet = new Set();
    this.emit('charge', { id: u.id });
  }

  updateCharge(u, dt) {
    u.chargeT -= dt;
    u.x = this.cx(u.x + u.vx * dt, u.r);
    u.y = this.cy(u.y + u.vy * dt, u.r);
    for (const t of this.near(u.x, u.y, u.r + 8, 0)) {
      if (u.hitSet.has(t)) continue;
      u.hitSet.add(t);
      this.damage(u, t, u.atk, {});
      const side = Math.sign((t.x - u.x) * -u.vy + (t.y - u.y) * u.vx) || 1;
      this.throwUnit(t, t.x + u.vy * side * 0.01, t.y - u.vx * side * 0.01, 110);
    }
    if (u.chargeT <= 0) { u.state = 'move'; u.vx = u.vy = 0; }
  }

  trample(u) {
    for (const t of this.near(u.x, u.y, u.r * 0.7, 0)) {
      if (t.trampleCd > 0) continue;
      t.trampleCd = 1;
      this.damage(u, t, u.atk * 0.5, {});
      this.stunUnit(t, 0.4);
    }
  }

  // ---------- Separación ----------
  separate() {
    for (const cell of this.grid.values()) {
      // vecinos en la misma celda y adyacentes
      for (const u of cell) {
        if (!this.alive(u) || u.air || u.state === 'burrow') continue;
        const gx = (u.x / CELL) | 0, gy = (u.y / CELL) | 0;
        const span = u.side ? Math.ceil(u.r / CELL) + 1 : 1;
        for (let ix = gx - span; ix <= gx + span; ix++) for (let iy = gy - span; iy <= gy + span; iy++) {
          const c = this.grid.get(ix + ',' + iy);
          if (!c) continue;
          for (const o of c) {
            if (o === u || !this.alive(o) || o.air || o.state === 'burrow') continue;
            // cada pareja una sola vez; las mixtas las resuelve el enemigo (que mira más celdas)
            if (u.side === o.side) { if (o.id <= u.id) continue; } else if (u.side === 0) continue;
            const dx = o.x - u.x, dy = o.y - u.y;
            const min = (u.r + o.r) * (u.side === o.side ? 1 : 0.95);
            const d2 = dx * dx + dy * dy;
            if (d2 >= min * min || d2 === 0) continue;
            const d = Math.sqrt(d2), push = (min - d);
            const mu = u.side ? u.size * u.size * 4 : 1, mo = o.side ? o.size * o.size * 4 : 1;
            const ku = mo / (mu + mo), ko = mu / (mu + mo);
            u.x -= (dx / d) * push * ku; u.y -= (dy / d) * push * ku;
            o.x += (dx / d) * push * ko; o.y += (dy / d) * push * ko;
          }
        }
      }
    }
    for (const u of this.units) {
      u.x = this.cx(u.x);
      u.y = this.cy(u.y);
    }
  }

  // ---------- Consumibles ----------
  useConsumable(key, pos) {
    const P = 1 + 0.35 * this.round;
    if (key === 'potion') {
      const live = this.allies.filter(a => this.alive(a));
      const list = live.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp).slice(0, Math.ceil(live.length / 2));
      for (const a of list) this.heal(a, a.maxHp * 0.5, null);
      this.emit('flash', { color: 0x9dff9d });
      return true;
    }
    if (key === 'revive') {
      const kos = this.allies.filter(a => a.state === 'ko');
      if (!kos.length) return false;
      for (const a of kos.sort(() => Math.random() - 0.5).slice(0, 5)) {
        a.state = 'move'; a.hp = a.maxHp; a.stun = 0; a.sashUsed = false;
        this.stat(a.key).ko--;
        this.emit('revive', { id: a.id });
      }
      return true;
    }
    if (key === 'thunderstone') {
      const total = 90 * P;
      for (let i = 0; i < 8; i++) this.later(i * 0.08, () => {
        const e = this.randomEnemy();
        if (!e) return;
        this.emit('bolt', { x: e.x, y: e.y });
        this.damage(null, e, total / 8, { srcKey: null });
        this.stunUnit(e, 1);
      });
      return true;
    }
    if (key === 'meteor') {
      const { x, y } = pos;
      const r = 95;
      this.emit('meteor', { x, y, r, dur: 0.8 });
      this.later(0.8, () => {
        this.emit('explosion', { x, y, r, color: 0xff4a1a, big: true });
        for (const e of this.near(x, y, r, 1)) this.damage(null, e, 160 * P, {});
        for (const a of this.near(x, y, r, 0)) this.throwUnit(a, x, y, 140);
      });
      return true;
    }
    return false;
  }
}
