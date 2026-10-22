// El rancho: tus Pokémon pasean mientras compras y preparas el combate.
import { ensureAnims, setAnim, dirRow, sheetKey } from './anims.js';

const MAX_SHOWN = 180;
// Zona por la que pasean (la parte del escenario que no tapa la interfaz)
const AREAS = { h: { x0: 340, x1: 940, y0: 230, y1: 560 }, v: { x0: 90, x1: 630, y0: 230, y1: 520 } };
let AREA = AREAS.h;

export class RanchScene extends Phaser.Scene {
  constructor() { super('Ranch'); }

  init(data) { this.bg = data.bg || 'ranch'; this.initial = data.team || []; this.orient = data.orient || 'h'; }

  create() {
    AREA = AREAS[this.orient];
    this.add.image(0, 0, `arena-${this.bg}-${this.orient}`).setOrigin(0).setDepth(-10);
    this.mons = [];
    this.setTeam(this.initial, false);
  }

  // entries: [{key, dex, n, ko}]
  setTeam(entries, animateNew = true) {
    const total = entries.reduce((s, e) => s + e.n, 0);
    const ratio = Math.min(1, MAX_SHOWN / Math.max(1, total));
    const want = [];
    for (const e of entries) {
      const shown = Math.max(e.n > 0 ? 1 : 0, Math.round(e.n * ratio));
      const koShown = Math.min(shown, Math.round(e.ko * ratio));
      for (let i = 0; i < shown; i++) want.push({ key: e.key, dex: e.dex, ko: i < koShown });
    }
    // reutiliza sprites existentes de la misma especie/forma
    const pool = this.mons;
    this.mons = [];
    for (const w of want) {
      const i = pool.findIndex(m => m.key === w.key && m.dex === w.dex);
      if (i >= 0) {
        const m = pool.splice(i, 1)[0];
        m.ko = w.ko;
        this.mons.push(m);
      } else {
        this.mons.push(this.makeMon(w, animateNew));
      }
    }
    for (const m of pool) { m.spr.destroy(); m.sh.destroy(); }
  }

  makeMon(w, animateNew) {
    ensureAnims(this, w.dex);
    const x = Phaser.Math.Between(AREA.x0, AREA.x1), y = Phaser.Math.Between(AREA.y0, AREA.y1);
    const sh = this.add.image(x, y, 'shadow').setScale(0.7);
    const spr = this.add.sprite(x, y, sheetKey(w.dex), 'Walk_0').setScale(1.5);
    const m = { ...w, spr, sh, x, y, tx: x, ty: y, wait: Math.random() * 3, row: 0 };
    if (animateNew) {
      spr.y -= 300;
      this.tweens.add({ targets: spr, y, duration: 450, ease: 'Bounce.easeOut' });
    }
    return m;
  }

  update(time, delta) {
    const dt = delta / 1000;
    for (const m of this.mons) {
      if (m.ko) {
        setAnim(m.spr, m.dex, 'Sleep', 0);
        m.spr.setTint(0x9a9aa8).setAlpha(0.85);
        m.sh.setPosition(m.x, m.y);
        if (!this.tweens.isTweening(m.spr)) m.spr.setPosition(m.x, m.y);
        m.spr.setDepth(m.y);
        continue;
      }
      m.spr.clearTint().setAlpha(1);
      m.wait -= dt;
      const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy);
      if (d > 2) {
        const sp = 40 * dt;
        m.x += (dx / d) * Math.min(sp, d);
        m.y += (dy / d) * Math.min(sp, d);
        m.row = dirRow(Math.atan2(dy, dx));
        setAnim(m.spr, m.dex, 'Walk', m.row);
      } else {
        setAnim(m.spr, m.dex, 'Idle', m.row);
        if (m.wait <= 0) {
          m.wait = 1 + Math.random() * 4;
          m.tx = Phaser.Math.Clamp(m.x + Phaser.Math.Between(-90, 90), AREA.x0, AREA.x1);
          m.ty = Phaser.Math.Clamp(m.y + Phaser.Math.Between(-70, 70), AREA.y0, AREA.y1);
        }
      }
      m.sh.setPosition(m.x, m.y).setDepth(0);
      if (!this.tweens.isTweening(m.spr)) m.spr.setPosition(m.x, m.y);
      m.spr.setDepth(m.y);
    }
  }
}
