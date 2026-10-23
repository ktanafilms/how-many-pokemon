// Tutorial corto: el Prof. Oak señala cada parte de la pantalla (foco + bocadillo). Se puede saltar.
import { el } from './html.js';
import { sfx } from '../audio.js';

const DONE_KEY = 'how-many-pokemon-tutorial';
const seen = () => { try { return JSON.parse(localStorage.getItem(DONE_KEY) || '{}'); } catch (e) { return {}; } };
export const tutorialSeen = part => !!seen()[part];
function markSeen(part) {
  const s = seen();
  s[part] = true;
  try { localStorage.setItem(DONE_KEY, JSON.stringify(s)); } catch (e) { /* nada */ }
}

// steps: [{ sel, text }] — los que no estén visibles en pantalla se saltan
export function coach(part, steps) {
  const list = steps.filter(s => { const t = document.querySelector(s.sel); const r = t?.getBoundingClientRect(); return r && r.width > 0 && r.height > 0; });
  if (!list.length) return Promise.resolve();
  return new Promise(res => {
    const root = el(`<div class="coach">
      <div class="coach-hole"></div>
      <div class="coach-bubble"><img class="px" src="assets/npc/oak.png" alt=""><div><b>Prof. Oak</b><p></p>
        <div class="coach-btns"><button class="btn small ghost" data-skip>Saltar tutorial</button><span class="coach-n"></span><button class="btn small" data-next>Siguiente ▶</button></div></div></div>
    </div>`);
    document.body.appendChild(root);
    const hole = root.querySelector('.coach-hole'), bubble = root.querySelector('.coach-bubble');
    let i = 0;
    const show = () => {
      const s = list[i];
      const r = document.querySelector(s.sel).getBoundingClientRect();
      const pad = 6;
      Object.assign(hole.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
      bubble.querySelector('p').innerHTML = s.text;
      root.querySelector('.coach-n').textContent = `${i + 1}/${list.length}`;
      root.querySelector('[data-next]').textContent = i === list.length - 1 ? '¡Entendido!' : 'Siguiente ▶';
      // el bocadillo va donde haya más sitio (arriba o abajo del foco)
      const bw = Math.min(420, window.innerWidth - 24);
      bubble.style.width = `${bw}px`;
      const below = r.bottom + 14, above = r.top - 14;
      const bh = bubble.offsetHeight || 130;
      let top = window.innerHeight - below > bh + 10 ? below : Math.max(10, above - bh);
      if (top + bh > window.innerHeight - 10) top = Math.max(10, (window.innerHeight - bh) / 2);
      bubble.style.top = `${top}px`;
      bubble.style.left = `${Math.max(12, Math.min(window.innerWidth - bw - 12, r.left + r.width / 2 - bw / 2))}px`;
      bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
    };
    const end = () => { markSeen(part); root.classList.add('out'); setTimeout(() => root.remove(), 250); window.removeEventListener('resize', show); res(); };
    root.addEventListener('click', e => {
      if (e.target.closest('[data-skip]')) { sfx('back'); end(); return; }
      if (e.target.closest('[data-next]') || !e.target.closest('.coach-bubble')) {
        sfx('select');
        if (++i >= list.length) end(); else show();
      }
    });
    window.addEventListener('resize', show);
    show();
  });
}

export const RANCH_STEPS = [
  { sel: '.sidebar.right', text: '¡Bienvenido a tu rancho! Aquí <b>reclutas Pokémon</b> con tus ₽. En este juego no gana el más fuerte: ¡gana el que tiene <b>MÁS</b>!' },
  { sel: '.sidebar.left', text: 'Este es <b>tu equipo</b>. Las flechas <b style="color:#2a9a4a">▲</b> verdes indican qué especies son eficaces contra los próximos rivales.' },
  { sel: '.map .rounds', text: 'Cada acto tiene 6 rondas: tiendas, objetos, carteles para reclutar especies nuevas… y un <b>jefe</b> al final.' },
  { sel: '.map .foes', text: 'Estos son los <b>rivales</b> de la próxima ronda. Pasa el dedo o el ratón por encima para ver sus puntos débiles. Desde la ronda 2 podrás <b>elegir combate</b>: más difícil = más ₽.' },
  { sel: '.fight', text: 'Cuando estés listo, ¡a luchar! El combate es <b>automático</b>; tú decides cuándo usar objetos.' },
];

// el paso de los objetos habla de los que llevas de verdad
export function battleSteps(cons, names) {
  const has = [...new Set(cons)].map(k => names[k]);
  const items = !has.length
    ? { sel: '.hud-bottom .slot', text: 'Aquí aparecerán tus <b>objetos</b> (se compran en la Tienda Pokémon). Durante el combate, tócalos para usarlos.' }
    : { sel: '.hud-bottom .slot:not(.empty)', text: `Tus <b>objetos</b>: ahora llevas ${has.map(n => `<b>${n}</b>`).join(', ')}. ${has.length > 1 ? "Tócalos" : "Tócalo"} durante el combate para usarlo${cons.includes('meteor') ? ' (el Meteorito, además, se apunta tocando el campo)' : ''}.` };
  return [items, ...BATTLE_STEPS];
}

export const BATTLE_STEPS = [
  { sel: '.hud-bottom .speed', text: 'Pausa o acelera el combate. Arrastra para girar la cámara y usa la rueda (o pellizca) para acercarte.' },
  { sel: '.team-bars', text: 'Aquí ves cuánta vida le queda a cada especie de tu equipo.' },
];
