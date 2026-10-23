// Pantalla del rancho: equipo, compra, mapa de rondas y próximo combate.
import { PLAYER, ENEMIES, ACTS, ROUNDS_PER_ACT, TRAIT_INFO } from '../data/species.js';
import { RELICS, BADGES, CONSUMABLES, MAX_CONSUMABLES, VITAMINS, icon } from '../data/items.js';
import { TYPES } from '../data/types.js';
import * as R from '../game/run.js';
import { matchup, matchTag, mainThreat, weakTo, resists } from '../game/advice.js';
import { sfx, cry } from '../audio.js';
import { el, img, types, tip } from './html.js';

export function renderRanch(app) {
  const run = app.run;
  const r = R.currentRound(run);
  const act = ACTS[r.act];
  const root = el(`<div id="ranch" class="tab-${app.ranchTab || 'shop'} ${app.ranchEnter ? 'enter' : ''}"></div>`);
  app.ranchEnter = false;

  // ---- Barra superior
  const cons = [];
  for (let i = 0; i < MAX_CONSUMABLES; i++) {
    const k = run.consumables[i];
    cons.push(k
      ? `<div class="slot" data-cons="${i}" ${tip(`<h4>${icon(CONSUMABLES[k])} ${CONSUMABLES[k].name}</h4>${CONSUMABLES[k].desc}${k === 'revive' ? '<br><br><b>Púlsalo para usarlo ahora.</b>' : '<br><br>Se usa durante el combate.'}`)}>${icon(CONSUMABLES[k])}</div>`
      : `<div class="slot empty" ${tip('Hueco libre para consumibles. Cómpralos en la Tienda Pokémon.')}></div>`);
  }
  root.appendChild(el(`
    <div class="topbar panel">
      <div class="where">
        <div class="round">Ronda ${run.round + 1}<span> / ${R.TOTAL_ROUNDS}</span></div>
        <div class="act">Acto ${r.act + 1} · ${act.name}${run.tier ? ` · <span class="alpha">${"★".repeat(run.tier + 1)} ${R.TIERS[run.tier].name}</span>` : ""}</div>
      </div>
      <div class="spacer"></div>
      <div class="stat money-stat" ${tip('Pokédólares: se ganan al vencer y sirven para reclutar Pokémon y comprar objetos.')}><span class="money">₽<b data-money>${Math.round(app.shownMoney ?? run.money)}</b></span></div>
      <div class="stat" ${tip('Pokémon que pueden luchar / total del equipo. Los debilitados descansan unas rondas.')}><img class="px icon mini" src="assets/items/poke-ball.png" alt=""> <b>${R.totalConscious(run)}</b>/${R.totalUnits(run)}</div>
      <div class="slots">${cons.join('')}</div>
      <button class="btn small icon-btn" data-act="sound" ${tip('Música y efectos')}>♪</button>
      <button class="btn small blue" data-act="menu">Menú</button>
    </div>`));

  // ---- Equipo (izquierda)
  const teamKeys = Object.keys(run.team).filter(k => run.team[k].n > 0);
  const teamRows = teamKeys.map(k => teamRow(app, k)).join('');
  const day = run.daycare.map(d => `<div class="row pending">${img(PLAYER[d.to].stages[0].dex)}<div class="info"><div class="name"><img class="px icon mini" src="assets/items/mystery-egg.png" alt=""> ${d.n} en la Guardería</div><div class="sub">Volverán como ${PLAYER[d.to].stages[0].name} en la ronda ${d.back + 1}</div></div></div>`).join('');
  root.appendChild(el(`
    <div class="sidebar left panel">
      <h3><span><img class="px icon mini" src="assets/items/poke-ball.png" alt=""> Tu equipo</span> <small>${R.totalUnits(run)} Pokémon</small></h3>
      <div class="list">${teamRows}${day}</div>
    </div>`));

  // ---- Compra (derecha)
  const shop = run.unlocked.map(k => buyRow(app, k)).join('');
  const relics = [
    ...run.badges.map(k => `<div class="relic badge" ${tip(`<h4>${icon(BADGES[k])} ${BADGES[k].name}</h4>${BADGES[k].desc}`)}>${icon(BADGES[k])}</div>`),
    ...run.relics.map(k => `<div class="relic" ${tip(`<h4>${icon(RELICS[k])} ${RELICS[k].name}</h4>${RELICS[k].desc}`)}>${icon(RELICS[k])}</div>`),
  ].join('') || '<span class="empty-note">Aún no tienes objetos ni medallas</span>';
  root.appendChild(el(`
    <div class="sidebar right panel">
      <h3><span><img class="px icon mini" src="assets/items/great-ball.png" alt=""> Reclutar</span> <small class="desk">mayús+clic = ×10</small></h3>
      <div class="list">${shop}</div>
      <div class="relics"><div class="relics-title">Objetos y medallas</div>${relics}</div>
    </div>`));

  // ---- Pestañas (sólo en pantallas estrechas)
  root.appendChild(el(`<div class="tabs">
    <button class="btn small ${app.ranchTab === 'team' ? 'on' : ''}" data-tab="team">Tu equipo</button>
    <button class="btn small ${app.ranchTab !== 'team' ? 'on' : ''}" data-tab="shop">Reclutar</button>
  </div>`));

  // ---- Mapa y próximo combate (abajo)
  const first = r.act * ROUNDS_PER_ACT;
  const rounds = run.map.slice(first, first + ROUNDS_PER_ACT).map((m, i) => {
    const idx = first + i;
    const info = R.ROUND_INFO[m.type];
    const cls = idx === run.round ? 'cur' : idx < run.round ? 'done' : '';
    return `<div class="rnd ${cls} ${m.type === 'jefe' ? 'boss' : ''}" ${tip(`<h4>Ronda ${idx + 1}: ${info.name}</h4>${info.desc}`)}><img class="px ic" src="assets/items/${info.img}.png" alt=""><span>${idx < run.round ? '✓' : idx + 1}</span></div>`;
  }).join('<i class="link"></i>');
  const info = R.ROUND_INFO[r.type];
  root.appendChild(el(`
    <div class="bottom">
      <div class="map panel">
        <div class="rounds">${rounds}</div>
        <div class="next-line"><b>${info.name}:</b> ${info.desc}</div>
        ${fightOptions(run)}
        <div class="foes">${foesPreview(run)}</div>
        ${adviceLine(run)}
      </div>
      <div class="fight"><button class="btn big" data-act="fight">¡A LUCHAR!<small>${R.totalConscious(run)} Pokémon vs ${run.enemies.length}</small></button></div>
    </div>`));

  // ---- Eventos
  root.addEventListener('click', e => {
    const tab = e.target.closest('[data-tab]');
    if (tab) { sfx('click'); app.ranchTab = tab.dataset.tab; app.refreshRanch(false); return; }
    const b = e.target.closest('[data-buy]');
    if (b) {
      const n = e.shiftKey ? 10 : +b.dataset.n;
      const got = R.buy(app.run, b.dataset.buy, n);
      if (got) {
        sfx('buy');
        cry(R.speciesDex(run, b.dataset.buy), { vol: 0.3 });
        app.flash = { key: b.dataset.buy, n: got };
        app.refreshRanch(true);
      } else sfx('error');
      return;
    }
    const c = e.target.closest('[data-cons]');
    if (c) {
      const k = run.consumables[+c.dataset.cons];
      if (k === 'revive') {
        if (R.useRanchConsumable(run, +c.dataset.cons)) { sfx('heal'); app.toast('¡Tus Pokémon se han recuperado!'); app.refreshRanch(true); }
        else { sfx('error'); app.toast('No hay Pokémon debilitados'); }
      }
      return;
    }
    const o = e.target.closest('[data-opt]');
    if (o) {
      if (+o.dataset.opt === run.optIdx) return;
      sfx('select');
      R.chooseFight(run, +o.dataset.opt);
      R.save(run);
      const main = R.fightTitle(run.options[run.optIdx]).main;
      cry(ENEMIES[main].dex, { vol: 0.35 });
      app.refreshRanch(false);
      return;
    }
    const a = e.target.closest('[data-act]');
    if (a?.dataset.act === 'fight') app.fight();
    if (a?.dataset.act === 'menu') app.showTitle();
    if (a?.dataset.act === 'sound') app.soundPanel(a);
  });
  return root;
}

function flashInfo(app, k) {
  if (app.flash?.key !== k) return { cls: '', plus: '' };
  return { cls: 'flash', plus: `<span class="plus">+${app.flash.n}</span>` };
}

function teamRow(app, k) {
  const run = app.run;
  const t = run.team[k];
  const s = run.spec[k];
  const sp = PLAYER[k];
  const dex = R.speciesDex(run, k);
  const next = sp.evo[s.stage];
  const evo = next
    ? `<div class="evo" ${tip(`EXP para evolucionar a <b>${sp.stages[s.stage + 1].name}</b>: ${Math.floor(s.xp)} / ${next}. Se gana haciendo daño y curando.`)}><div style="width:${Math.min(100, (s.xp / next) * 100)}%"></div></div>`
    : '';
  const ko = t.ko.length ? `<small ${tip('Debilitados: descansan entre 1 y 3 rondas o hasta que uses un Revivir.')}>${t.ko.length} KO</small>` : '';
  const vit = s.vit.map(v => icon(VITAMINS[v], 'mini')).join('');
  const f = flashInfo(app, k);
  return `<div class="row ${f.cls}" ${tip(speciesTip(run, k))}>
    ${img(dex)}
    <div class="info"><div class="name"><span class="nm">${R.speciesName(run, k)}</span> ${vit} ${matchTag(matchup(run, k))}</div><div class="sub">${types(sp.types)}</div>${evo}</div>
    <div class="count">${t.n}${ko}${f.plus}</div>
  </div>`;
}

function buyRow(app, k) {
  const run = app.run;
  const p = R.price(run, k);
  const can = run.money >= p;
  const f = flashInfo(app, k);
  return `<div class="row buyrow ${f.cls}" ${tip(speciesTip(run, k))}>
    ${img(R.speciesDex(run, k))}
    <div class="info"><div class="name"><span class="nm">${R.speciesName(run, k)}</span> ${matchTag(matchup(run, k))}</div><div class="sub">${types(PLAYER[k].types)} <span class="abil">${PLAYER[k].abilityName}</span></div></div>
    <div class="btns">
      <button class="btn small" data-buy="${k}" data-n="1" ${can ? '' : 'disabled'}>₽${p}</button>
      <button class="btn small" data-buy="${k}" data-n="5" ${can ? '' : 'disabled'}>×5</button>
    </div>
  </div>`;
}

export function speciesTip(run, k) {
  const sp = PLAYER[k];
  const st = run.spec[k] ? R.unitStats(run, k) : null;
  const name = run.spec[k] ? R.speciesName(run, k) : sp.stages[0].name;
  const s = st || { hp: sp.hp, atk: sp.atk, as: sp.as, spd: sp.spd, tough: sp.tough || 0, evasion: sp.evasion || 0, crit: sp.crit || 0.05 };
  const evoLine = sp.stages.length > 1
    ? `<div class="tip-foot">Evoluciones: ${sp.stages.map(x => x.name).join(' → ')}</div>` : '';
  const m = run.enemies ? matchup(run, k) : 1;
  const mLine = m >= 1.2 ? `<div class="tip-good">▲ Muy eficaz contra la próxima ronda (×${m.toFixed(1)})</div>`
    : m <= 0.8 ? `<div class="tip-bad">▼ Poco eficaz contra la próxima ronda (×${m.toFixed(1)})</div>` : '';
  return `<h4>${name}</h4>${types(sp.types)}
    <div class="stats">
      <span>❤️ PS ${Math.round(s.hp)}</span><span>⚔️ ATQ ${s.atk.toFixed(1)}</span>
      <span>⏱ Vel. ataque ${s.as.toFixed(2)}/s</span><span>👟 Mov. ${Math.round(s.spd)}</span>
      <span>🛡 Dureza ${Math.round(s.tough * 100)}%</span><span>💨 Evasión ${Math.round(s.evasion * 100)}%</span>
      <span>🎯 Crítico ${Math.round(s.crit * 100)}%</span>${sp.range ? '<span>🏹 A distancia</span>' : ''}
    </div>
    <div class="ab"><b>${sp.abilityName}:</b> ${sp.desc}</div>${mLine}${evoLine}`;
}

export function foeTip(run, k) {
  const e = ENEMIES[k];
  const traits = (e.traits || []).map(t => TRAIT_INFO[t] ? `<div>• <b>${TRAIT_INFO[t][0]}:</b> ${TRAIT_INFO[t][1]}</div>` : '').join('');
  const weak = weakTo(k).map(t => TYPES[t].name).join(', ');
  const resist = resists(k).map(t => TYPES[t].name).join(', ');
  const st = R.enemyStats(k, run.round);
  return `<h4>${e.name}${e.boss ? ' 👑' : ''}</h4>${types(e.types)}
    <div class="stats"><span>❤️ PS ${Math.round(st.hp)}</span><span>⚔️ ATQ ${Math.round(st.atk)}</span></div>
    ${weak ? `<div class="tip-good">💥 Débil a: <b>${weak}</b></div>` : ''}${resist ? `<div class="tip-bad">🛡 Resiste: ${resist}</div>` : ''}${traits}`;
}

// Elegir combate (como en HMD): cada opción con su modificador y su premio extra
function fightOptions(run) {
  if (!run.options || run.options.length < 2) return '';
  const cards = run.options.map((o, i) => {
    const t = R.fightTitle(o);
    const mods = o.mods.filter(m => m !== 'normal').map(m => R.FIGHT_MODS[m]);
    const desc = mods.length ? mods.map(m => `<div><b>${m.name}:</b> ${m.desc}</div>`).join('') : R.FIGHT_MODS.normal.desc;
    const shiny = o.mods.includes('shiny') ? 'shiny' : '';
    return `<button class="fopt ${i === run.optIdx ? 'on' : ''} ${shiny}" data-opt="${i}" ${tip(`<h4>${t.text}</h4>${desc}`)}>
      ${img(ENEMIES[t.main].dex, o.mods.includes('gigantes') ? 'giant' : o.mods.includes('horda') ? 'tiny' : '')}
      <span class="fo-txt"><b>${t.text}</b><small>${mods.length ? mods.map(m => `<img class="px icon mini" src="assets/items/${m.icon}.png" alt="">${m.name}`).join(' · ') : 'Sin sorpresas'}</small></span>
      <span class="fo-short">×${o.enemies.length}${mods.map(m => `<img class="px icon mini" src="assets/items/${m.icon}.png" alt="">`).join('')}</span>
      ${o.bonus ? `<span class="fo-bonus">+${Math.round(o.bonus * 100)}% ₽</span>` : ''}
    </button>`;
  }).join('');
  return `<div class="fight-opts"><span class="fo-label">Elige combate:</span>${cards}</div>`;
}

function foesPreview(run) {
  const counts = {};
  const alphas = {};
  run.enemies.forEach((k, i) => { counts[k] = (counts[k] || 0) + 1; if (run.elite?.[i]) alphas[k] = (alphas[k] || 0) + 1; });
  return Object.entries(counts).map(([k, n]) => {
    const e = ENEMIES[k];
    const a = alphas[k] ? `<span class="alpha" title="Pokémon Alfa: más grande, ×3 PS, más ataque y con Furia">★${alphas[k]} Alfa</span>` : '';
    return `<div class="foe ${e.boss ? 'boss' : ''} ${a ? 'has-alpha' : ''}" ${tip(foeTip(run, k))}>${img(e.dex)}<div><b>${e.name} ×${n}</b> ${a}<div>${types(e.types)}</div></div></div>`;
  }).join('');
}

function adviceLine(run) {
  const k = mainThreat(run);
  if (!k) return '';
  const weak = weakTo(k).slice(0, 3);
  const mine = Object.keys(run.team).filter(s => run.team[s].n > 0);
  const good = mine.filter(s => matchup(run, s) >= 1.2).map(s => R.speciesName(run, s));
  const bad = mine.filter(s => matchup(run, s) <= 0.8).map(s => R.speciesName(run, s));
  const parts = [];
  if (weak.length) parts.push(`${ENEMIES[k].name} es débil a ${types(weak)}`);
  if (good.length) parts.push(`<span class="good">tus mejores: ${good.slice(0, 3).join(', ')}</span>`);
  if (bad.length) parts.push(`<span class="bad">flojos: ${bad.slice(0, 3).join(', ')}</span>`);
  return parts.length ? `<div class="advice"><img class="px" src="assets/npc/oak.png" alt="">${parts.join(' · ')}</div>` : '';
}
