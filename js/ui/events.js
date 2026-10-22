// Ventanas de eventos: inicial, tienda, vitaminas, guardería, recompensas y evolución.
// Cada una la presenta un personaje con su diálogo.
import { PLAYER, STARTERS } from '../data/species.js';
import { RELICS, BADGES, VITAMINS, CONSUMABLES, MAX_CONSUMABLES, icon } from '../data/items.js';
import * as R from '../game/run.js';
import { matchup, matchTag } from '../game/advice.js';
import { sfx, cry, jingle, playMusic } from '../audio.js';
import { modal, img, types, money, tip, pd } from './html.js';
import { speciesTip } from './ranch.js';
import { npcBox, typewrite } from './npc.js';
import { portrait, spriteHTML } from '../scenes/anims.js';

// Abre una ventana con un personaje hablando arriba; el resto aparece escalonado.
function scene(npc, text, body, opts = {}) {
  const m = modal(`${npcBox(npc, text)}<div class="modal-body">${body}</div>`, opts);
  m.classList.add('with-npc');
  stagger(m);
  typewrite(m);
  return m;
}
function stagger(root) {
  root.querySelectorAll('.card, .score tr').forEach((c, i) => c.style.setProperty('--i', i));
}
function rebody(m, html) {
  m.querySelector('.modal-body').innerHTML = pd(html);
  stagger(m);
}

const speciesCard = (k, extra = '', run = null) => {
  const sp = PLAYER[k];
  return `<div class="card" data-k="${k}">
    ${img(sp.stages[0].dex)}
    <div class="card-txt">
      <h3>${sp.stages[0].name} ${run?.enemies ? matchTag(matchup(run, k)) : ''}</h3>
      <div>${types(sp.types)}</div>
      <p class="ab"><b>${sp.abilityName}</b></p>
      <p>${sp.desc}</p>${extra}
    </div>
  </div>`;
};

export function starterModal(done) {
  const m = scene('oak',
    '¡Bienvenido al mundo de los Pokémon! Aquí no se lucha con uno solo… ¡sino con MUCHOS! Tienes un rancho con 8 Rattatas. Elige un compañero inicial: te daré 3.',
    `${tierPicker()}<div class="cards">${STARTERS.map(k => speciesCard(k)).join('')}</div>`);
  let tier = R.meta().tier;
  m.addEventListener('click', e => {
    const t = e.target.closest('[data-tier]');
    if (t && !t.disabled) {
      sfx('cursor');
      tier = +t.dataset.tier;
      m.querySelectorAll('[data-tier]').forEach(b => b.classList.toggle('on', +b.dataset.tier === tier));
      m.querySelector('.tier-desc').textContent = R.TIERS[tier].desc;
      return;
    }
    const c = e.target.closest('[data-k]');
    if (!c) return;
    sfx('select');
    cry(PLAYER[c.dataset.k].stages[0].dex);
    m.close();
    done(c.dataset.k, tier);
  });
}

// Ligas: se desbloquean ganando la anterior (como los Tiers de How Many Dudes)
function tierPicker() {
  const max = R.meta().tier;
  if (max === 0) return '';
  const btns = R.TIERS.map((t, i) => `<button class="tier ${i === max ? 'on' : ''}" data-tier="${i}" ${i > max ? 'disabled' : ''}>${'★'.repeat(i + 1)} ${t.name}</button>`).join('');
  return `<div class="tiers">${btns}</div><p class="tier-desc">${R.TIERS[max].desc}</p>`;
}

export function shopModal(app, done) {
  const run = app.run;
  playMusic('shop');
  const body = () => {
    const stock = R.shopStock(run);
    return `
      <div class="lead">Tienes ${money(run.money)} · Consumibles ${run.consumables.length}/${MAX_CONSUMABLES}</div>
      <div class="cards">${stock.map((it, i) => {
        const d = it.kind === 'relic' ? RELICS[it.key] : CONSUMABLES[it.key];
        const full = it.kind === 'cons' && run.consumables.length >= MAX_CONSUMABLES;
        return `<div class="card shop-card ${it.sold ? 'sold' : ''}">
          <div class="big-ic">${icon(d)}</div>
          <div class="card-txt"><h3>${d.name}</h3>
          <p class="kind kind-${it.kind}">${it.kind === 'relic' ? 'Objeto · dura toda la partida' : 'Consumible · un solo uso'}</p>
          <p>${d.desc}</p>
          <button class="btn small" data-buy="${i}" ${it.sold || run.money < it.price || full ? 'disabled' : ''}>${it.sold ? 'Vendido' : full ? 'Mochila llena' : '₽' + it.price}</button></div>
        </div>`;
      }).join('')}</div>
      <div class="actions"><button class="btn red" data-close>Salir de la tienda</button></div>`;
  };
  const m = scene('clerk', '¡Hola! Bienvenido a la Tienda Pokémon. Los objetos te ayudan toda la partida; los consumibles, en un apuro durante el combate.', body(), { onClose: done });
  m.addEventListener('click', e => {
    const b = e.target.closest('[data-buy]');
    if (b) {
      if (R.buyStock(run, R.shopStock(run)[+b.dataset.buy])) { sfx('buy'); rebody(m, body()); app.refreshRanch(false); }
      else sfx('error');
    }
    if (e.target.closest('[data-close]')) { sfx('back'); m.close(); }
  });
}

export function challengeModal(app, done) {
  const run = app.run;
  const body = `
    <div class="lead">Los rivales de esta ronda serán <b>muchos más</b> y con varios <span class="alpha">★ Alfa</span>. Si ganas: <b>eliges un objeto</b> y te llevas un <b>50% más de ₽</b>.</div>
    <div class="actions"><button class="btn red" data-yes>¡Acepto el reto!</button><button class="btn blue" data-close>Mejor no</button></div>`;
  const m = scene('red', '… … … (Rojo te mira fijamente. Parece que quiere ver de qué es capaz tu manada.)', body, { onClose: done });
  m.addEventListener('click', e => {
    if (e.target.closest('[data-yes]')) {
      sfx('select');
      R.acceptChallenge(run);
      cry(25, { vol: 0.5 });
      app.toast('¡Reto aceptado! Prepárate bien antes de luchar.');
      m.close();
      return;
    }
    if (e.target.closest('[data-close]')) { sfx('back'); m.close(); }
  });
}

export function vitaminModal(app, done) {
  const run = app.run;
  playMusic('shop');
  const offer = R.vitaminOffer(run);
  let chosen = null;
  const body = () => `
    <div class="lead">Mejora a <b>todos</b> los Pokémon de una especie para el resto de la partida. Precio: ${money(offer.price)} · Tienes ${money(run.money)}</div>
    <div class="steps"><span class="${chosen ? 'ok' : 'on'}">1. Elige vitamina</span><span class="${chosen ? 'on' : ''}">2. Elige quién se la toma</span></div>
    <div class="cards">${offer.list.map(k => `<div class="card mini-card ${chosen === k ? 'sel' : ''}" data-v="${k}">
      <div class="big-ic">${icon(VITAMINS[k])}</div><div class="card-txt"><h3>${VITAMINS[k].name}</h3><p>${VITAMINS[k].desc}</p></div></div>`).join('')}</div>
    ${chosen ? `<div class="cards eaters">${Object.keys(run.team).filter(k => run.team[k].n > 0).map(k => `<div class="card eater" data-s="${k}" ${tip(speciesTip(run, k))}>${img(R.speciesDex(run, k))}<p><b>${R.speciesName(run, k)}</b><br>×${run.team[k].n}</p></div>`).join('')}</div>` : ''}
    <div class="actions"><button class="btn red" data-close>No, gracias</button></div>`;
  const m = scene('chef', '¡Eh! ¡Tus Pokémon están en los huesos! Con una de mis vitaminas se pondrán fuertes para el resto de la aventura.', body(), { onClose: done });
  m.addEventListener('click', e => {
    const v = e.target.closest('[data-v]');
    if (v) { sfx('select'); chosen = v.dataset.v; rebody(m, body()); return; }
    const s = e.target.closest('[data-s]');
    if (s && chosen) {
      if (run.money < offer.price) { sfx('error'); app.toast('¡No tienes suficientes ₽!'); return; }
      run.money -= offer.price;
      run.spec[s.dataset.s].vit.push(chosen);
      jingle('levelup');
      cry(R.speciesDex(run, s.dataset.s));
      app.toast(`¡${R.speciesName(run, s.dataset.s)} se ha tomado ${VITAMINS[chosen].name}!`);
      m.close();
      return;
    }
    if (e.target.closest('[data-close]')) { sfx('back'); m.close(); }
  });
}

export function daycareModal(app, done) {
  const run = app.run;
  playMusic('daycare');
  const offer = R.daycareOffer(run);
  let chosen = offer.opts[0];
  const free = R.conscious(run, 'rattata');
  const max = Math.max(0, Math.min(free, Math.floor(run.money / offer.price)));
  let n = Math.min(max, 5);
  const body = () => `
    <div class="lead">Precio por Rattata: ${money(offer.price)} · Rattatas disponibles: <b>${free}</b> · Tienes ${money(run.money)}</div>
    <div class="cards">${offer.opts.map(k => speciesCard(k, '', run).replace('class="card"', `class="card ${chosen === k ? 'sel' : ''}"`)).join('')}</div>
    <div class="slider-row"><span>Enviar</span><input type="range" min="0" max="${max}" value="${n}" data-n><b>${n}</b> Rattatas = ${money(n * offer.price)} <span class="muted">→ vuelven en ${offer.rounds} rondas</span></div>
    <div class="actions"><button class="btn green" data-send ${n > 0 ? '' : 'disabled'}>¡A ENTRENAR!</button><button class="btn red" data-close>Ahora no</button></div>`;
  const m = scene('breeder', `¡Tienes un MONTÓN de Rattatas sin hacer nada! Déjamelos ${offer.rounds} rondas y volverán… DIFERENTES. Elige en qué quieres que se conviertan.`, body(), { onClose: done });
  m.addEventListener('input', e => { if (e.target.matches('[data-n]')) { n = +e.target.value; rebody(m, body()); m.querySelector('[data-n]').focus(); } });
  m.addEventListener('click', e => {
    const c = e.target.closest('[data-k]');
    if (c) { sfx('select'); chosen = c.dataset.k; rebody(m, body()); return; }
    if (e.target.closest('[data-send]')) {
      const sent = R.sendDaycare(run, chosen, n, offer.price);
      if (sent) { jingle('egg'); app.toast(`${sent} Rattatas se van a la Guardería`); }
      m.close();
      return;
    }
    if (e.target.closest('[data-close]')) { sfx('back'); m.close(); }
  });
}

export function resultsModal(app, res, done) {
  const best = Object.entries(res.stats).sort((a, b) => b[1].dmg - a[1].dmg);
  const mvp = best[0];
  const rows = best.map(([k, s]) => `
    <tr><td>${img(res.names[k][1])}${res.names[k][0]} <small>×${s.n}</small></td>
    <td>${Math.round(s.dmg)}</td><td>${s.kills}</td><td>${Math.round(s.heal)}</td><td class="${s.ko ? 'bad' : ''}">${s.ko}</td></tr>`).join('');
  const ko = res.koReport.length
    ? `<div class="note">${icon({ img: 'assets/items/full-restore.png' }, 'mini')} ${res.koReport.reduce((a, b) => a + b.n, 0)} Pokémon debilitados descansarán entre 1 y 3 rondas.</div>` : '';
  const m = modal(`
    <h2 class="win-title">¡VICTORIA!</h2>
    <div class="earn">Has ganado <span class="money">₽<b data-count="${res.money}">0</b></span>${res.payday ? ` <small>(₽${res.payday} de Día de Pago)</small>` : ''}</div>
    ${mvp ? `<div class="mvp">${img(res.names[mvp[0]][1])}<div><small>MVP del combate</small><b>${res.names[mvp[0]][0]}</b></div></div>` : ''}
    <table class="score"><tr><th>Especie</th><th>Daño</th><th>Derrotas</th><th>Curación</th><th>KO</th></tr>${rows}</table>
    ${ko}
    <div class="actions"><button class="btn" data-close>¡GENIAL!</button></div>`, { onClose: done });
  stagger(m);
  countUp(m.querySelector('[data-count]'));
  m.addEventListener('click', e => { if (e.target.closest('[data-close]')) { sfx('select'); m.close(); } });
}

function countUp(node) {
  const to = +node.dataset.count, t0 = performance.now(), dur = 900;
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / dur);
    node.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
    if (k < 1) { sfx('coin'); requestAnimationFrame(step); }
  };
  step();
}

export function cartelModal(app, done) {
  const run = app.run;
  const opts = R.cartelOptions(run);
  if (!opts.length) { done(); return; }
  const m = scene('police', '¡Buen combate! ¿Colgamos un cartel de SE BUSCA? La especie que elijas se unirá a tu rancho (unos cuantos gratis) y podrás reclutar más.',
    `<div class="cards">${opts.map(k => speciesCard(k, '<button class="btn small">COLGAR CARTEL</button>')).join('')}</div>`, { onClose: done });
  m.addEventListener('click', e => {
    const c = e.target.closest('[data-k]');
    if (!c) return;
    const n = R.postCartel(run, c.dataset.k);
    jingle('newpoke');
    cry(PLAYER[c.dataset.k].stages[0].dex);
    app.toast(`¡${n} ${PLAYER[c.dataset.k].stages[0].name} respondieron a tu cartel!`);
    m.close();
  });
}

export function relicModal(app, done) {
  const run = app.run;
  const opts = R.relicOptions(run);
  if (!opts.length) { done(); return; }
  const m = scene('oak', '¡Mira lo que han encontrado tus Pokémon entre la hierba! Quédate con uno: su efecto dura toda la partida.',
    `<div class="cards">${opts.map(k => `<div class="card mini-card" data-k="${k}"><div class="big-ic">${icon(RELICS[k])}</div><div class="card-txt"><h3>${RELICS[k].name}</h3><p>${RELICS[k].desc}</p></div></div>`).join('')}</div>`, { onClose: done });
  m.addEventListener('click', e => {
    const c = e.target.closest('[data-k]');
    if (c) { jingle('item'); run.relics.push(c.dataset.k); m.close(); }
  });
}

export function badgeModal(app, done) {
  const run = app.run;
  const opts = R.badgeOptions(run);
  if (!opts.length) { done(); return; }
  jingle('healed');
  const m = scene('nurse', '¡Enhorabuena por vencer al jefe! He curado a todo tu equipo en el Centro Pokémon. Toma, elige una Medalla como recuerdo.',
    `<div class="cards">${opts.map(k => `<div class="card mini-card badge-card" data-k="${k}"><div class="big-ic">${icon(BADGES[k])}</div><div class="card-txt"><h3>${BADGES[k].name}</h3><p>${BADGES[k].desc}</p></div></div>`).join('')}</div>`, { onClose: done });
  m.addEventListener('click', e => {
    const c = e.target.closest('[data-k]');
    if (c) { jingle('badge'); run.badges.push(c.dataset.k); m.close(); }
  });
}

// Secuencia de evolución como en los juegos: destellos cada vez más rápidos y revelación.
export function evolutionModal(app, evo, done) {
  playMusic('evolution');
  const m = modal(`
    <h2>¡¿Qué?! ¡${evo.from} está evolucionando!</h2>
    <div class="evo-stage">
      <div class="evo-glow"></div>
      ${spriteHTML(evo.dexFrom, 4, 'Idle', 'evo-a')}
      ${spriteHTML(evo.dexTo, 4, 'Idle', 'evo-b')}
    </div>
    <div class="lead evo-text">…</div>
    <div class="actions"><button class="btn" data-close disabled>¡GENIAL!</button></div>`, { onClose: done });
  m.classList.add('evolving');
  cry(evo.dexFrom);
  const a = m.querySelector('.evo-a'), b = m.querySelector('.evo-b');
  let t = 0, gap = 420, showB = false;
  const tick = () => {
    showB = !showB;
    a.style.opacity = showB ? 0 : 1;
    b.style.opacity = showB ? 1 : 0;
    t += gap;
    gap = Math.max(60, gap * 0.86);
    if (t < 4200) setTimeout(tick, gap);
    else reveal();
  };
  const reveal = () => {
    m.classList.add('revealed');
    a.style.opacity = 0; b.style.opacity = 1;
    jingle('evolved');
    cry(evo.dexTo);
    const txt = m.querySelector('.evo-text');
    txt.innerHTML = `¡Enhorabuena! ¡Tus ${evo.from} han evolucionado a <b>${evo.to}</b>!<br><small>Más PS, más ataque y una habilidad más potente.</small>`;
    m.querySelector('[data-close]').disabled = false;
  };
  setTimeout(tick, 900);
  m.addEventListener('click', e => { if (e.target.closest('[data-close]') && !e.target.closest('[disabled]')) { sfx('select'); m.close(); } });
}

export function endScreen(app, win) {
  const run = app.run;
  const unlocked = win && R.unlockTier((run.tier || 0) + 1);
  const m = modal(`
    <h2 class="${win ? 'win-title' : 'lose-title'}">${win ? '¡CAMPEÓN!' : '¡TE HAS QUEDADO SIN POKÉMON!'}</h2>
    ${npcBox('oak', win ? `¡Increíble! ¡Has derrotado a Mewtwo en la ${R.TIERS[run.tier || 0].name}! Ya sabemos cuántos Pokémon hacen falta… ¡los tuyos!${unlocked ? ` Has desbloqueado la <b>${R.TIERS[run.tier + 1].name}</b>: ¿te atreves?` : ''}` : `Has llegado a la ronda ${run.round + 1} (Acto ${R.currentRound(run).act + 1}). No te desanimes: prueba otros tipos contra los jefes y aprovecha las evoluciones.`)}
    <table class="score">
      <tr><td>Daño total</td><td>${Math.round(run.log.dmg)}</td></tr>
      <tr><td>Pokémon salvajes derrotados</td><td>${run.log.kills}</td></tr>
      <tr><td>Equipo más grande</td><td>${Math.max(run.log.maxTeam, R.totalUnits(run))}</td></tr>
      <tr><td>Medallas</td><td>${run.badges.map(k => icon(BADGES[k], 'mini')).join(' ') || '—'}</td></tr>
    </table>
    <div class="actions"><button class="btn red" data-new>¡OTRA VEZ!</button><button class="btn blue" data-menu>Menú</button></div>`);
  stagger(m);
  typewrite(m);
  m.addEventListener('click', e => {
    if (e.target.closest('[data-new]')) { sfx('select'); m.close(); app.newGame(); }
    if (e.target.closest('[data-menu]')) { sfx('back'); m.close(); app.showTitle(); }
  });
}
