// Partículas 2D sobre la escena 3D: chispas de golpe, fuego, humo, curas, burbujas, monedas, estrellas
// y el clima de cada acto. Viven en coordenadas de la arena (x, y del suelo y h de altura) y se proyectan al dibujar.
const TAU = Math.PI * 2;

export class Particles {
  constructor(max = 1100) { this.p = []; this.max = max; }

  get busy() { return this.p.length / this.max; }

  add(o) { if (this.p.length < this.max) this.p.push({ t: 0, vx: 0, vy: 0, vh: 0, g: 0, size: 3, ...o }); }

  // ráfaga desde un punto: n partículas en todas direcciones
  burst(x, y, h, n, o = {}) {
    const sp = o.speed ?? 120;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = sp * (0.4 + Math.random() * 0.8);
      this.add({ x, y, h, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vh: (o.up ?? 80) * (0.5 + Math.random()), life: (o.life ?? 0.45) * (0.7 + Math.random() * 0.6), ...o, size: (o.size ?? 3) * (0.7 + Math.random() * 0.6) });
    }
  }

  update(dt) {
    for (const p of this.p) {
      p.t += dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.h += p.vh * dt;
      p.vh -= p.g * dt;
      if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; p.vh *= k; }
      if (p.h < 0) { if (p.bounce) { p.h = 0; p.vh = -p.vh * p.bounce; p.vx *= 0.6; p.vy *= 0.6; } else p.h = 0; }
    }
    this.p = this.p.filter(p => p.t < p.life);
  }

  draw(c, toScreen) {
    for (const p of this.p) {
      const s = toScreen(p.x, p.y, p.h);
      const k = 1 - p.t / p.life;
      const r = Math.max(1.5, p.size * s.s * (this.scale || 1) * (p.grow ? 1 + p.grow * (1 - k) : 1));
      c.globalAlpha = Math.min(1, k * (p.alpha ?? 1) * 1.6);
      switch (p.kind) {
        case 'spark': { // trazo en la dirección del movimiento
          const s2 = toScreen(p.x - p.vx * 0.04, p.y - p.vy * 0.04, p.h - p.vh * 0.04);
          c.strokeStyle = p.color; c.lineWidth = Math.max(1.5, r * 0.7); c.lineCap = 'round';
          c.beginPath(); c.moveTo(s2.x, s2.y); c.lineTo(s.x, s.y); c.stroke();
          break;
        }
        case 'star': star(c, s.x, s.y, r * 1.6, p.color, p.t * 6); break;
        case 'plus':
          c.fillStyle = p.color;
          c.fillRect(s.x - r, s.y - r * 0.3, r * 2, r * 0.6); c.fillRect(s.x - r * 0.3, s.y - r, r * 0.6, r * 2);
          break;
        case 'ring': c.strokeStyle = p.color; c.lineWidth = 2; c.beginPath(); c.arc(s.x, s.y, r, 0, TAU); c.stroke(); break;
        case 'coin': { // moneda girando
          const w = Math.abs(Math.cos(p.t * 9)) * r + 0.6;
          c.fillStyle = '#ffcb05'; c.beginPath(); c.ellipse(s.x, s.y, w, r, 0, 0, TAU); c.fill();
          c.fillStyle = '#fff5b0'; c.beginPath(); c.ellipse(s.x - w * 0.3, s.y - r * 0.3, w * 0.35, r * 0.35, 0, 0, TAU); c.fill();
          break;
        }
        case 'leaf':
          c.save(); c.translate(s.x, s.y); c.rotate(p.t * (p.spin || 3)); c.fillStyle = p.color;
          c.beginPath(); c.ellipse(0, 0, r * 1.4, r * 0.6, 0, 0, TAU); c.fill(); c.restore();
          break;
        default: // 'dot' y 'puff'
          c.fillStyle = p.color; c.beginPath(); c.arc(s.x, s.y, r, 0, TAU); c.fill();
      }
    }
    c.globalAlpha = 1;
  }
}

function star(c, x, y, r, color, rot = 0) {
  c.fillStyle = color;
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot - Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
  c.fill();
}
