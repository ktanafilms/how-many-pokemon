// Cinemática de jefe: el guardián del acto aparece con bandas de cine, habla, y revela al jefe
// (primero su silueta, luego un destello y su grito). Se avanza tocando; «Saltar» la termina.
import { ENEMIES, ACTS } from '../data/species.js';
import { bossIntro, weakTo } from '../game/advice.js';
import { TYPES } from '../data/types.js';
import { NPCS } from './npc.js';
import { el } from './html.js';
import { spriteHTML } from '../scenes/anims.js';
import { sfx, cry } from '../audio.js';

const TITLES = { falkner: 'Líder de Gimnasio', brock: 'Líder de Gimnasio', misty: 'Líder de Gimnasio', agatha: 'Alto Mando', ranger: 'Guarda del Safari', giovanni: 'Jefe del Team Rocket' };
const wait = ms => new Promise(r => setTimeout(r, ms));

export function bossCinematic(app, act) {
  const intro = bossIntro(app.run, act);
  const bossKey = ACTS[act].boss;
  const boss = ENEMIES[bossKey];
  const n = NPCS[intro.npc];
  const big = window.innerWidth < 600 ? 4 : 6;
  const root = el(`<div class="cine act${act}">
    <div class="cine-bar top"></div><div class="cine-bar bot"></div>
    <div class="cine-band"><div class="cine-trainer"><img class="px" src="assets/npc/${n.img}.png" alt=""></div>
      <div class="cine-name"><small>${TITLES[intro.npc] || ''}</small>${n.name}</div></div>
    <div class="cine-boss">${spriteHTML(boss.dex, big, 'Idle', 'cine-sil')}<div class="cine-bname"><small>Jefe del ${ACTS[act].name}</small>${boss.name}</div></div>
    <div class="cine-talk"><div class="cine-text"></div><span class="cine-next">▼</span></div>
    <button class="btn small cine-skip">Saltar ▶▶</button>
  </div>`);
  document.body.appendChild(root);
  const text = root.querySelector('.cine-text');
  let skip = false, advance = null, typing = null;
  root.addEventListener('click', e => {
    if (e.target.closest('.cine-skip')) { skip = true; advance?.(); typing?.(); return; }
    if (typing) typing(); else advance?.();
  });
  // texto letra a letra (un toque lo completa, otro avanza)
  const say = line => new Promise(res => {
    root.classList.remove('ready');
    let i = 0;
    const full = line;
    const done = () => { clearInterval(t); typing = null; text.textContent = full; root.classList.add('ready'); res(); };
    const t = setInterval(() => { i++; text.textContent = full.slice(0, i); if (i % 2 === 0) sfx('text'); if (i >= full.length) done(); }, 24);
    typing = done;
  });
  const tap = () => new Promise(res => { advance = () => { advance = null; res(); }; });

  const weak = weakTo(bossKey).slice(0, 3).map(t => TYPES[t].name);
  return (async () => {
    sfx('whoosh');
    await wait(450);
    root.classList.add('t1'); // entra el entrenador
    await wait(500);
    for (const line of intro.lines.filter(l => !l.startsWith('Consejo'))) {
      if (skip) break;
      await say(line);
      if (skip) break;
      await tap();
    }
    if (!skip) {
      // la silueta del jefe y su revelación
      root.classList.add('t2');
      await say(`¡Adelante, ${boss.name}!`);
      await wait(600);
      root.classList.add('t3');
      sfx('roar');
      cry(boss.dex, { vol: 0.8 });
      await wait(900);
      if (weak.length && !skip) {
        await say(`Consejo del Prof. Oak: ${boss.name} es débil a ${weak.join(', ')}.`);
        if (!skip) await tap();
      }
    }
    root.classList.add('out');
    await wait(450);
    root.remove();
  })();
}
