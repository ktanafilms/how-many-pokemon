// Transición de entrada al combate al estilo de los juegos de DS:
// dos destellos, una espiral negra que se cierra con la Poké Ball en el centro (girando mientras carga),
// y al terminar la pantalla se abre en dos mitades. Para los jefes, franjas rojas y doradas.
import { sfx } from '../audio.js';

const wait = ms => new Promise(r => setTimeout(r, ms));
const ease = t => t * t * (3 - 2 * t);

export async function battleTransition({ boss = false, back = false } = {}, load) {
  const cv = document.createElement('canvas');
  cv.className = 'bt-canvas';
  document.body.appendChild(cv);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth, H = window.innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  const c = cv.getContext('2d');
  c.scale(dpr, dpr);
  const ball = new Image();
  ball.src = 'assets/items/poke-ball.png';
  const R = Math.hypot(W, H) / 2 + 10;
  const cx = W / 2, cy = H / 2;
  // de vuelta al rancho: sin destellos y en colores claros (verde y azul)
  let phase = back ? 'swirl' : 'flash', t0 = performance.now(), tHold = 0, raf;
  const N = 10;
  const colA = back ? '#3a8a50' : boss ? '#2a0a0a' : '#0a0c16', colB = back ? '#5ab0e8' : boss ? '#c8302a' : '#1c2a5a';

  const draw = now => {
    const t = (now - t0) / 1000;
    c.clearRect(0, 0, W, H);
    if (phase === 'flash') {
      // dos destellos blancos
      const k = (t / 0.12) | 0;
      if (k % 2 === 0) { c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); }
      if (t > 0.48) { phase = 'swirl'; t0 = now; }
    } else if (phase === 'swirl') {
      // espiral: N cuñas que crecen mientras giran
      const k = Math.min(1, t / 0.75), e = ease(k);
      const rot = e * Math.PI * 1.2;
      for (let i = 0; i < N; i++) {
        const a0 = rot + (i / N) * Math.PI * 2;
        c.fillStyle = i % 2 ? colA : colB;
        c.beginPath();
        c.moveTo(cx, cy);
        c.arc(cx, cy, R, a0, a0 + (Math.PI * 2 / N) * e + 0.002);
        c.closePath();
        c.fill();
      }
      if (k >= 1) { phase = 'hold'; t0 = now; tHold = now; }
    } else if (phase === 'hold' || phase === 'open') {
      const ko = phase === 'open' ? ease(Math.min(1, t / 0.5)) : 0;
      // la espiral sigue girando despacio; al abrirse se parte en dos mitades (arriba y abajo)
      const rot = Math.PI * 1.2 + (performance.now() - tHold) / 1800;
      const half = H / 2;
      for (const [side, y0] of [[-1, 0], [1, half]]) {
        c.save();
        c.translate(0, side * ko * (half + 8));
        c.beginPath(); c.rect(0, y0, W, half); c.clip();
        for (let i = 0; i < N; i++) {
          const a0 = rot + (i / N) * Math.PI * 2;
          c.fillStyle = i % 2 ? colA : colB;
          c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, R, a0, a0 + Math.PI * 2 / N + 0.002); c.closePath(); c.fill();
        }
        if (boss) { c.fillStyle = '#ffcb05'; c.fillRect(0, side < 0 ? y0 + half - 5 : y0, W, 5); }
        c.restore();
      }
      // Poké Ball girando (se encoge al abrirse)
      if (ball.complete && ko < 1) {
        const s = Math.min(W, H) * 0.22 * (1 - ko) * (1 + 0.05 * Math.sin(performance.now() / 120));
        c.save(); c.translate(cx, cy); c.rotate(performance.now() / 260);
        c.imageSmoothingEnabled = false;
        c.drawImage(ball, -s / 2, -s / 2, s, s);
        c.restore();
      }
      if (phase === 'open' && t > 0.5) { cancelAnimationFrame(raf); cv.remove(); return; }
    }
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  // cuando la espiral ya tapa la pantalla se monta el combate (la Poké Ball gira mientras tanto)
  await wait(back ? 760 : 1240);
  const t1 = performance.now();
  try { await load(); } catch (e) { console.error(e); }
  const left = 350 - (performance.now() - t1);
  if (left > 0) await wait(left);
  sfx('whoosh');
  phase = 'open'; t0 = performance.now();
  await wait(260);
}

// Cuadro de texto de DS al empezar: «¡Aparecen 9 Pokémon salvajes!»
export function battleText(html, ms = 1900) {
  const box = document.createElement('div');
  box.className = 'bt-text';
  box.innerHTML = `<p>${html}</p><span>▼</span>`;
  document.body.appendChild(box);
  setTimeout(() => box.classList.add('out'), ms);
  setTimeout(() => box.remove(), ms + 350);
  box.addEventListener('click', () => box.classList.add('out'));
}
