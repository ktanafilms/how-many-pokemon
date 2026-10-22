// Personajes y cuadros de diálogo estilo Pokémon (texto que aparece letra a letra).
import { sfx } from '../audio.js';
import { el, ui } from './html.js';

export const NPCS = {
  oak: { img: 'oak', name: 'Prof. Oak' },
  clerk: { img: 'clerk', name: 'Dependiente' },
  breeder: { img: 'pokemonbreederf', name: 'Criadora' },
  chef: { img: 'chef', name: 'Chef Vitaminas' },
  nurse: { img: 'nurse', name: 'Enfermera Joy' },
  police: { img: 'policeman', name: 'Agente Mártinez' },
  // guardianes de cada acto (presentan al jefe)
  falkner: { img: 'falkner', name: 'Pegaso' },
  brock: { img: 'brock', name: 'Brock' },
  misty: { img: 'misty', name: 'Misty' },
  agatha: { img: 'agatha', name: 'Agatha' },
  ranger: { img: 'pokemonranger', name: 'Guarda del Safari' },
  giovanni: { img: 'giovanni', name: 'Giovanni' },
};

// Bloque HTML: personaje + bocadillo. El texto se escribe con typewrite().
export function npcBox(key, text, cls = '') {
  const n = NPCS[key];
  return `<div class="npc-talk ${cls}">
    <div class="npc-stage"><img class="px" src="assets/npc/${n.img}.png" alt=""></div>
    <div class="textbox"><b class="npc-name">${n.name}</b><p class="tw" data-text="${encodeURIComponent(text)}"></p><span class="more">▼</span></div>
  </div>`;
}

// Escribe letra a letra todos los .tw dentro de root. Un clic lo completa.
export function typewrite(root, speed = 22) {
  const nodes = [...root.querySelectorAll('.tw:not(.done)')];
  return Promise.all(nodes.map(node => new Promise(res => {
    const html = decodeURIComponent(node.dataset.text);
    const box = node.closest('.textbox');
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const full = tmp.textContent;
    let i = 0;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearInterval(timer);
      node.innerHTML = html;
      node.classList.add('done');
      box?.classList.add('ready');
      res();
    };
    const timer = setInterval(() => {
      i += 1;
      node.textContent = full.slice(0, i);
      if (i % 2 === 0 && full[i] !== ' ') sfx('text');
      if (i >= full.length) finish();
    }, speed);
    // el primer clic sólo completa el texto (no avanza al siguiente)
    box?.addEventListener('click', e => { if (!finished) { e.stopPropagation(); finish(); } });
  })));
}

// Diálogo suelto sobre la escena: varias frases, se avanza con clic o toque.
export function talk(key, lines) {
  return new Promise(resolve => {
    const wrap = el(`<div class="dialog-layer">${npcBox(key, '', 'floating')}</div>`);
    ui().appendChild(wrap);
    const tw = wrap.querySelector('.tw');
    const box = wrap.querySelector('.textbox');
    let i = 0;
    const show = () => {
      tw.classList.remove('done');
      box.classList.remove('ready');
      tw.dataset.text = encodeURIComponent(lines[i]);
      typewrite(wrap);
    };
    wrap.addEventListener('click', () => {
      if (!box.classList.contains('ready')) return;
      sfx('select');
      i += 1;
      if (i >= lines.length) {
        wrap.classList.add('leaving');
        setTimeout(() => { wrap.remove(); resolve(); }, 200);
      } else show();
    });
    show();
  });
}
