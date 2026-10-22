// Vista del combate: dibuja la simulación y sus efectos.
import { Battle } from '../game/sim.js';
import { TRAIT_INFO } from '../data/species.js';
import { sfx, cry } from '../audio.js';
import { ensureAnims, setAnim, dirRow, sheetKey, animDuration } from './anims.js';

const ALLY_SCALE = 1.45;

export class BattleScene extends Phaser.Scene {
  constructor() { super('Battle'); }

  init(data) {
    this.setup = data.setup;
    this.act = data.act;
    this.app = data.app;
  }

  create() {
    this.add.image(0, 0, `arena-act${this.act}-${this.app.orient}`).setOrigin(0).setDepth(-10);
    this.sim = new Battle(this.setup);
    // En vertical el lienzo se ve más pequeño: textos y sprites algo más grandes
    this.ts = this.app.orient === 'v' ? 1.6 : 1;
    this.ss = this.app.orient === 'v' ? 1.2 : 1;
    this.views = new Map();
    this.fx = [];
    this.under = this.add.graphics().setDepth(-5);
    this.over = this.add.graphics().setDepth(100000);
    this.bars = this.add.graphics().setDepth(100001);
    this.texts = [];
    this.dmgAcc = new Map();
    this.ended = false;
    this.shake = 0;
    this.labels = [];
    for (const u of this.sim.units) this.makeView(u);
    this.input.on('pointerdown', p => this.app.onArenaClick(p.worldX, p.worldY));
    this.intro();
  }

  // Entrada estilo "¡Un Pokémon salvaje apareció!": destello y los rivales caen del cielo.
  intro() {
    this.introT = 1.3;
    this.cameras.main.flash(350, 255, 255, 255);
    let i = 0;
    for (const v of this.views.values()) {
      if (!v.u.side) continue;
      const delay = 150 + (i++ % 12) * 60;
      v.dropY = 360;
      this.tweens.add({ targets: v, dropY: 0, duration: 520, delay, ease: 'Bounce.easeOut' });
      this.time.delayedCall(delay + 450, () => this.floatText(v.u.x, v.u.y - 30 * v.u.size, '!', '#ff3b3b', 30));
    }
  }

  makeView(u) {
    ensureAnims(this, u.dex);
    const scale = (u.side ? u.size : ALLY_SCALE) * this.ss;
    const sh = this.add.image(u.x, u.y, 'shadow').setScale(scale * (u.side ? 1.1 : 0.6), scale * (u.side ? 1.1 : 0.6)).setDepth(-4);
    const spr = this.add.sprite(u.x, u.y, sheetKey(u.dex), 'Walk_0').setScale(scale);
    const portrait = this.app.orient === 'v';
    const v = { u, spr, sh, lastAttack: -1, lastHurt: -1, row: u.side ? (portrait ? 0 : 6) : (portrait ? 4 : 2), attackUntil: 0, dead: false, hurtUntil: 0, dropY: 0 };
    setAnim(spr, u.dex, 'Idle', v.row);
    if (u.side) {
      // Rivales: contorno rojo brillante y nombre
      if (spr.preFX) spr.preFX.addGlow(u.boss ? 0xff5a1a : 0xff2a2a, u.boss ? 4 : 2.5, 0, false, 0.1, 12);
      if (!u.boss) {
        v.label = this.add.text(u.x, u.y, u.name, { fontFamily: 'PowerClearBold', fontSize: `${Math.round(16 * this.ts)}px`, color: '#ffffff', stroke: '#8a1010', strokeThickness: 4 }).setOrigin(0.5, 1).setDepth(100001);
      }
    }
    this.views.set(u.id, v);
    return v;
  }

  update(time, delta) {
    const speed = this.app.speed;
    if (this.introT > 0) this.introT -= delta / 1000;
    else if (!this.ended && speed > 0) this.sim.update((delta / 1000) * speed);
    this.handleEvents();
    this.drawFx(delta / 1000 * Math.max(1, speed));
    this.syncUnits(time / 1000);
    this.flushNumbers(delta / 1000);
    if (this.shake > 0) { this.cameras.main.shake(120, this.shake); this.shake = 0; }
    this.app.onBattleTick(this.sim);
    if (this.sim.result && !this.ended) {
      this.ended = true;
      this.time.delayedCall(1300, () => this.app.onBattleEnd(this.sim));
    }
  }

  syncUnits(clock) {
    const now = this.sim.t;
    this.bars.clear();
    const pulse = 0.55 + 0.3 * Math.sin(clock * 5);
    for (const v of this.views.values()) {
      const u = v.u;
      if (v.dead) continue;
      if (u.side === 1 && u.state === 'dead') {
        v.dead = true;
        setAnim(v.spr, u.dex, 'Hurt', v.row, true);
        if (v.label) v.label.destroy();
        this.tweens.add({ targets: [v.spr, v.sh], alpha: 0, duration: 700, delay: 250, onComplete: () => { v.spr.destroy(); v.sh.destroy(); } });
        continue;
      }
      if (u.side) {
        // anillo rojo a los pies de cada rival
        const rw = u.r * 2.5, rh = u.r * 1.1;
        this.under.fillStyle(0xff2a2a, 0.13).fillEllipse(u.x, u.y + 2, rw, rh);
        this.under.lineStyle(u.boss ? 4 : 2.5, u.boss ? 0xff7a1a : 0xff3b3b, pulse).strokeEllipse(u.x, u.y + 2, rw, rh);
      }
      v.spr.setPosition(u.x, u.y - u.z - v.dropY);
      v.sh.setPosition(u.x, u.y);
      v.spr.setDepth(u.y);
      const moving = Math.abs(u.vx) + Math.abs(u.vy) > 1;
      if (moving) v.row = dirRow(Math.atan2(u.vy, u.vx));
      else if (u.target) v.row = dirRow(u.facing);

      if (u.state === 'ko') {
        setAnim(v.spr, u.dex, 'Sleep', 0);
        v.spr.setTint(0x8a8a9a).setAlpha(0.7);
        v.sh.setAlpha(0.4);
        continue;
      }
      v.spr.setAlpha(u.state === 'burrow' ? 0 : 1);
      v.sh.setAlpha(u.state === 'burrow' ? 0 : 1);
      if (u.lastAttack !== v.lastAttack) {
        v.lastAttack = u.lastAttack;
        v.attackUntil = now + Math.min(0.6, animDuration(u.dex, 'Attack'));
        setAnim(v.spr, u.dex, 'Attack', v.row, true);
      }
      if (u.lastHurt !== v.lastHurt) {
        v.lastHurt = u.lastHurt;
        if (now > v.hurtUntil + 0.3) v.hurtUntil = now + 0.07;
      }
      if (u.air) setAnim(v.spr, u.dex, 'Hurt', v.row);
      else if (u.stun > 0) setAnim(v.spr, u.dex, u.sleep ? 'Sleep' : 'Hurt', u.sleep ? 0 : v.row);
      else if (now < v.attackUntil) { /* sigue la animación de ataque */ }
      else if (moving || u.state === 'charge') setAnim(v.spr, u.dex, 'Walk', v.row);
      else setAnim(v.spr, u.dex, 'Idle', v.row);

      if (now < v.hurtUntil && u.side === 1) v.spr.setTintFill(0xffffff);
      else if (u.primal) v.spr.setTint(0xff8a7a);
      else if (u.buffs.berserk > 0) v.spr.setTint(0xff9a6a);
      else if (u.buffs.poisonT > 0) v.spr.setTint(0xd59aff);
      else if (u.buffs.slowT > 0) v.spr.setTint(0xaee8ff);
      else v.spr.clearTint();

      // barras de vida: siempre visibles en los rivales, sólo heridos en los tuyos
      const p = Math.max(0, u.hp / u.maxHp);
      if (u.side && !u.boss) {
        const w = Math.max(36, 24 * u.size) * this.ts, bh = 4 * this.ts;
        const x = u.x - w / 2, y = u.y - 32 * u.size * this.ss - u.z - v.dropY;
        this.bars.fillStyle(0x283048, 0.95).fillRoundedRect(x - 3, y - 3, w + 6, bh + 6, 3);
        this.bars.fillStyle(0x505868, 1).fillRect(x, y, w, bh);
        const col = p > 0.5 ? [0x70f8a8, 0x18c020] : p > 0.2 ? [0xf8e038, 0xc8a800] : [0xf85838, 0xa82010];
        this.bars.fillStyle(col[1], 1).fillRect(x, y, w * p, bh);
        this.bars.fillStyle(col[0], 1).fillRect(x, y, w * p, Math.max(1, bh * 0.4));
        // los nombres se ven al aparecer y luego se desvanecen (para no taparse entre sí)
        if (v.label) v.label.setPosition(u.x, y - 3).setAlpha(this.introT > 0.3 ? 0 : Math.max(0, Math.min(1, 4.5 - this.sim.t)));
      } else if (!u.side && u.hp < u.maxHp) {
        const w = 14, x = u.x - w / 2, y = u.y - 26 - u.z;
        this.bars.fillStyle(0x1d1b2b, 0.85).fillRect(x - 1, y - 1, w + 2, 4);
        this.bars.fillStyle(p > 0.5 ? 0x5ee05e : p > 0.25 ? 0xffd23a : 0xff5a3a, 1).fillRect(x, y, w * p, 2);
      }
    }
  }

  view(id) { return this.views.get(id); }

  handleEvents() {
    const ev = this.sim.events;
    this.sim.events = [];
    for (const e of ev) {
      switch (e.type) {
        case 'hit': {
          if (e.side === 1) {
            sfx(e.crit ? 'crit' : e.eff > 1 ? 'super' : e.eff < 1 ? 'weak' : 'hit');
            const a = this.dmgAcc.get(e.id) || { dmg: 0, crit: false, eff: 1 };
            a.dmg += e.dmg; a.crit ||= e.crit; a.eff = Math.max(a.eff, e.eff);
            this.dmgAcc.set(e.id, a);
          }
          break;
        }
        case 'fireball': {
          const v = this.view(e.from);
          if (v) this.addFx('proj', e.dur, { x0: v.u.x, y0: v.u.y - 10, x1: e.x, y1: e.y, color: 0xff7a1a, r: 5, arc: 40 });
          break;
        }
        case 'projectile': {
          const v = this.view(e.from);
          if (v) this.addFx('proj', e.dur, { x0: v.u.x, y0: v.u.y - 20 * v.u.size, x1: e.x, y1: e.y, color: e.color, r: e.kind === 'star' ? 6 : 8, arc: 60, star: e.kind === 'star' });
          this.addFx('target', e.dur, { x: e.x, y: e.y, r: 40, color: e.color });
          break;
        }
        case 'bone': {
          const a = this.view(e.from), b = this.view(e.to);
          if (a && b) this.addFx('bone', 0.5, { a: a.u, b: b.u });
          break;
        }
        case 'explosion':
          sfx(e.big || e.r > 80 ? 'boom' : 'fire');
          this.addFx('boom', e.big ? 0.6 : 0.35, { x: e.x, y: e.y, r: e.r, color: e.color ?? 0xffa23a });
          if (e.big) this.shake = 0.012;
          break;
        case 'pulse': sfx('heal'); this.addFx('ring', 0.45, { x: e.x, y: e.y, r: e.r, color: e.color, fill: true }); break;
        case 'wave': this.addFx('ring', 0.6, { x: e.x, y: e.y, r: e.r, color: e.color, fill: true }); this.shake = 0.006; break;
        case 'lightning': sfx('zap'); this.addFx('bolt', 0.25, { pts: e.pts, color: 0xfff27a }); break;
        case 'bolt': sfx('zap'); this.addFx('bolt', 0.3, { pts: [[e.x + 20, e.y - 400], [e.x, e.y]], color: 0xfff27a, w: 4 }); break;
        case 'slash': this.addFx('slash', 0.25, { pts: e.pts }); break;
        case 'gust': this.addFx('gust', 0.5, e); this.shake = 0.006; break;
        case 'powder': this.addFx('ring', 0.8, { x: e.x, y: e.y, r: e.r, color: e.color, fill: true }); break;
        case 'meteor': sfx('whoosh'); this.addFx('meteor', e.dur, e); break;
        case 'taunt': { const v = this.view(e.id); if (v) this.addFx('ring', 0.4, { follow: v.u, r: 30, color: 0xff3a3a }); break; }
        case 'roar': { const v = this.view(e.id); if (v) { sfx('roar'); cry(v.u.dex, { rate: 0.85, vol: 0.7 }); this.addFx('ring', 0.7, { x: v.u.x, y: v.u.y, r: 180, color: 0xff3a3a }); this.floatText(v.u.x, v.u.y - 60, '¡FURIA!', '#ff4a3a', 26); this.shake = 0.01; } break; }
        case 'teleport': this.addFx('ring', 0.3, { x: e.x0, y: e.y0, r: 16, color: 0xff9ae0 }); break;
        case 'sing': { const v = this.view(e.id); if (v) { this.addFx('ring', 0.6, { x: v.u.x, y: v.u.y, r: 110, color: 0xffb6e0 }); this.floatText(v.u.x, v.u.y - 20, '♪', '#ff7ad8', 20); } break; }
        case 'sleep': { const v = this.view(e.id); if (v) this.floatText(v.u.x, v.u.y - 20 * (v.u.side ? v.u.size : 1), 'Zz', '#cfd8ff', 16); break; }
        case 'rage': { const v = this.view(e.id); if (v) this.floatText(v.u.x, v.u.y - 20, '!', '#ff6a3a', 18); break; }
        case 'coin': this.floatText(e.x, e.y - 20, '₽', '#ffcb05', 16); break;
        case 'block': { const v = this.view(e.id); if (v && Math.random() < 0.3) this.floatText(v.u.x, v.u.y - 18, '🛡', '#9ad8ff', 12); break; }
        case 'equalize': {
          const a = this.view(e.a), b = this.view(e.b);
          if (a && b) this.addFx('bolt', 0.3, { pts: [[a.u.x, a.u.y], [b.u.x, b.u.y]], color: 0xb78aff });
          break;
        }
        case 'dig': this.addFx('ring', 0.4, { x: e.x, y: e.y, r: 10, color: 0x8a5a2a, fill: true }); break;
        case 'emerge': this.addFx('boom', 0.3, { x: e.x, y: e.y, r: 22, color: 0x9a6a3a }); break;
        case 'revive': { const v = this.view(e.id); if (v) { v.spr.clearTint().setAlpha(1); this.addFx('ring', 0.5, { x: v.u.x, y: v.u.y, r: 20, color: 0x7dffd0, fill: true }); } break; }
        case 'flash': this.cameras.main.flash(250, 160, 255, 160); break;
        case 'sash': { const v = this.view(e.id); if (v) this.floatText(v.u.x, v.u.y - 18, '¡Aguanta!', '#ffffff', 12); break; }
        case 'enrage': this.app.feed('¡Los Pokémon salvajes se enfurecen! <b>Su ataque sube</b>', 'foe'); break;
        case 'thrown': sfx('throw'); break;
        case 'ko': sfx('allyKo'); this.koCount = (this.koCount || 0) + 1; break;
        case 'die': {
          const v = this.view(e.id);
          if (!v) break;
          sfx('faint');
          cry(v.u.dex, { rate: 0.75, vol: v.u.boss ? 0.7 : 0.3 });
          this.feedLine(`¡${v.u.boss ? '' : 'El '}${v.u.name}${v.u.boss ? '' : ' salvaje'} se ha debilitado!`, 'foe', 'die' + (v.u.boss ? 'b' : ''), v.u.boss ? 0 : 700);
          break;
        }
        case 'move': {
          if (e.side === 0) this.feedLine(`¡${e.who} usó <b>${e.name}</b>!`, 'mine', e.key + e.name, 6000);
          else this.feedLine(`¡${e.who} usó <b>${TRAIT_INFO[e.trait]?.[0] || e.trait}</b>!`, 'foe', e.key + e.trait, 3500);
          break;
        }
        case 'charge': { const v = this.view(e.id); if (v) this.floatText(v.u.x, v.u.y - 30 * v.u.size, '¡Derribo!', '#ffd23a', 18); break; }
      }
    }
  }

  // Línea del registro de combate con límite de repetición por tipo
  feedLine(html, cls, key, every) {
    const now = performance.now();
    this.feedT ??= {};
    if (every && now - (this.feedT[key] || -1e9) < every) return;
    if (now - (this.feedT._any || 0) < 260 && cls !== 'foe') return;
    this.feedT[key] = now;
    this.feedT._any = now;
    this.app.feed(html, cls);
  }

  // Agrupa el daño por enemigo para no llenar la pantalla de números.
  flushNumbers(dt) {
    this.numT = (this.numT || 0) - dt;
    if (this.numT > 0) return;
    this.numT = 0.25;
    this.koT = (this.koT || 0) + 0.25;
    if (this.koCount && this.koT > 1.6) {
      this.app.feed(this.koCount === 1 ? 'Uno de tus Pokémon se ha debilitado' : `${this.koCount} de tus Pokémon se han debilitado`, 'ko');
      this.koCount = 0;
      this.koT = 0;
    }
    for (const [id, a] of this.dmgAcc) {
      const v = this.view(id);
      if (!v) continue;
      const u = v.u;
      const color = a.eff > 1 ? '#ffe14a' : a.eff < 1 ? '#b8b8c8' : '#ffffff';
      const size = a.crit ? 22 : 16;
      this.floatText(u.x + Phaser.Math.Between(-15, 15), u.y - 26 * u.size, fmt(a.dmg) + (a.crit ? '!' : ''), color, size);
      if (a.eff > 1 && Math.random() < 0.15) this.floatText(u.x, u.y - 40 * u.size, '¡Es muy eficaz!', '#ffe14a', 14);
      if (a.eff < 1 && Math.random() < 0.08) this.floatText(u.x, u.y - 40 * u.size, 'No es muy eficaz…', '#c8c8d8', 12);
    }
    this.dmgAcc.clear();
  }

  floatText(x, y, str, color, size = 16) {
    let t = this.texts.find(t => !t.visible);
    if (!t) {
      if (this.texts.length > 90) return;
      t = this.add.text(0, 0, '', { fontFamily: 'PowerClearBold', fontSize: '16px', color: '#fff', stroke: '#283048', strokeThickness: 5 }).setOrigin(0.5).setDepth(100002);
      this.texts.push(t);
    }
    t.setText(str).setColor(color).setFontSize(Math.round(size * this.ts)).setPosition(x, y).setAlpha(1).setVisible(true).setScale(0.6);
    this.tweens.add({ targets: t, y: y - 30, scale: 1, duration: 300, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: 550, duration: 300, onComplete: () => t.setVisible(false) });
  }

  addFx(kind, dur, data) { this.fx.push({ kind, t: 0, dur, ...data }); }

  drawFx(dt) {
    const g = this.over, gu = this.under;
    g.clear(); gu.clear();
    this.fx = this.fx.filter(f => (f.t += dt) < f.dur);
    for (const f of this.fx) {
      const k = f.t / f.dur;
      switch (f.kind) {
        case 'proj': {
          const x = f.x0 + (f.x1 - f.x0) * k, y = f.y0 + (f.y1 - f.y0) * k - Math.sin(k * Math.PI) * f.arc;
          g.fillStyle(f.color, 1).fillCircle(x, y, f.r);
          g.fillStyle(0xffffff, 0.8).fillCircle(x, y, f.r * 0.45);
          if (f.star) g.lineStyle(2, 0xffffff, 0.9).strokeCircle(x, y, f.r + 3);
          break;
        }
        case 'target': gu.lineStyle(2, f.color, 0.5 + 0.4 * k).strokeCircle(f.x, f.y, f.r * (1 - 0.3 * k)); break;
        case 'boom':
          gu.fillStyle(f.color, 0.5 * (1 - k)).fillCircle(f.x, f.y, f.r * (0.4 + 0.6 * k));
          g.lineStyle(3, 0xffffff, 0.8 * (1 - k)).strokeCircle(f.x, f.y, f.r * (0.5 + 0.6 * k));
          break;
        case 'ring': {
          const x = f.follow ? f.follow.x : f.x, y = f.follow ? f.follow.y : f.y;
          if (f.fill) gu.fillStyle(f.color, 0.25 * (1 - k)).fillCircle(x, y, f.r * (0.3 + 0.7 * k));
          gu.lineStyle(3, f.color, 0.9 * (1 - k)).strokeCircle(x, y, f.r * (0.3 + 0.7 * k));
          break;
        }
        case 'bolt': {
          g.lineStyle(f.w || 3, f.color, 1 - k);
          g.beginPath();
          f.pts.forEach(([x, y], i) => {
            if (i === 0) { g.moveTo(x, y); return; }
            const [px, py] = f.pts[i - 1];
            for (let s = 1; s <= 3; s++) {
              const q = s / 4;
              g.lineTo(px + (x - px) * q + Phaser.Math.Between(-6, 6), py + (y - py) * q + Phaser.Math.Between(-6, 6));
            }
            g.lineTo(x, y);
          });
          g.strokePath();
          break;
        }
        case 'slash':
          g.lineStyle(3, 0xffffff, 1 - k);
          g.beginPath(); f.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.strokePath();
          break;
        case 'bone': {
          const q = k < 0.5 ? k * 2 : 2 - k * 2;
          const x = f.a.x + (f.b.x - f.a.x) * q, y = f.a.y + (f.b.y - f.a.y) * q - 12;
          const ang = f.t * 25;
          g.lineStyle(4, 0xf4ecd8, 1);
          g.lineBetween(x - Math.cos(ang) * 6, y - Math.sin(ang) * 6, x + Math.cos(ang) * 6, y + Math.sin(ang) * 6);
          break;
        }
        case 'gust': {
          const cx = Math.cos(f.ang), cy = Math.sin(f.ang);
          const len = f.len * k;
          gu.fillStyle(0xdff6ff, 0.35 * (1 - k));
          const px = -cy * f.w, py = cx * f.w;
          gu.fillPoints([
            { x: f.x + px, y: f.y + py }, { x: f.x - px, y: f.y - py },
            { x: f.x + cx * len - px, y: f.y + cy * len - py }, { x: f.x + cx * len + px, y: f.y + cy * len + py },
          ], true);
          break;
        }
        case 'meteor': {
          gu.lineStyle(3, 0xff4a1a, 0.8).strokeCircle(f.x, f.y, f.r);
          gu.fillStyle(0x000000, 0.25 * k).fillCircle(f.x, f.y, f.r * k);
          const y = f.y - 600 * (1 - k);
          g.fillStyle(0xff7a1a, 1).fillCircle(f.x + 200 * (1 - k), y, 18);
          g.fillStyle(0xffe14a, 1).fillCircle(f.x + 200 * (1 - k), y, 9);
          break;
        }
      }
    }
  }
}

function fmt(n) {
  if (n >= 10000) return (n / 1000).toFixed(0) + 'k';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return Math.round(n).toString();
}
