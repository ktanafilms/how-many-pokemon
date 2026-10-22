// Controlador principal: une Phaser (escenas) con la interfaz HTML, el audio y el estado de la partida.
import { PLAYER, ENEMIES, ACTS, TRAIT_INFO } from './data/species.js';
import { CONSUMABLES, MAX_CONSUMABLES, icon } from './data/items.js';
import * as R from './game/run.js';
import { bossIntro } from './game/advice.js';
import { setManifest, portrait } from './scenes/anims.js';
import { typeBadge } from './data/types.js';
import { BootScene } from './scenes/BootScene.js';
import { RanchScene } from './scenes/RanchScene.js';
import { BattleScene } from './scenes/BattleScene.js';
import { renderRanch } from './ui/ranch.js';
import * as EV from './ui/events.js';
import { talk } from './ui/npc.js';
import { el, ui, tip } from './ui/html.js';
import { ARENA } from './game/sim.js';
import { playMusic, jingle, sfx, cry, volumes, setMusic, setSfx } from './audio.js';

const wait = ms => new Promise(r => setTimeout(r, ms));

class App {
  constructor() {
    this.run = null;
    this.speed = 1;
    this.armed = -1;
    this.orient = App.wantOrient();
  }

  // Vertical en móviles en retrato: la arena se gira para aprovechar la pantalla.
  static wantOrient() { return window.innerHeight > window.innerWidth * 1.1 ? 'v' : 'h'; }
  get dims() { return this.orient === 'v' ? { w: ARENA.h, h: ARENA.w } : { w: ARENA.w, h: ARENA.h }; }

  // Escala de la interfaz: grande en monitores grandes, reducida en móviles apaisados.
  static uiScale() {
    const w = window.innerWidth, h = window.innerHeight;
    if ((w <= 900 && h > w) || w <= 560) return 1; // diseño móvil vertical
    return Math.max(0.62, Math.min(1.7, Math.min(w / 1280, h / 720)));
  }
  applyScale() {
    document.documentElement.style.setProperty('--z', App.uiScale().toFixed(3));
  }

  watchOrientation() {
    this.applyScale();
    window.addEventListener('resize', () => this.applyScale());
    let t;
    window.addEventListener('resize', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const o = App.wantOrient();
        if (o === this.orient || this.game.scene.isActive('Battle')) return;
        this.orient = o;
        this.game.scale.setGameSize(this.dims.w, this.dims.h);
        if (this.run && document.getElementById('ranch')) this.goRanch();
        else this.showTitle();
      }, 200);
    });
  }

  async init() {
    setManifest(await (await fetch('assets/manifest.json')).json());
    // Las fuentes de DS deben estar listas antes de que Phaser dibuje textos
    await Promise.all(['16px PowerClear', '16px PowerClearBold', '16px "Lilita One"'].map(f => document.fonts.load(f).catch(() => {})));
    const dex = new Set();
    for (const sp of Object.values(PLAYER)) for (const s of sp.stages) dex.add(s.dex);
    for (const e of Object.values(ENEMIES)) dex.add(e.dex);
    this.game = new Phaser.Game({
      type: Phaser.AUTO, parent: 'game', width: this.dims.w, height: this.dims.h,
      pixelArt: true, backgroundColor: '#101422',
      loader: { maxParallelDownloads: 64 },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    });
    this.game.scene.add('Ranch', RanchScene, false);
    this.game.scene.add('Battle', BattleScene, false);
    this.game.scene.add('Boot', BootScene, true, { dexList: [...dex], onDone: () => this.showTitle() });
    this.watchOrientation();
    // sonido de clic en todos los botones
    document.addEventListener('pointerdown', e => { if (e.target.closest('.btn:not(:disabled), .slot:not(.empty), .card')) sfx('click'); });
  }

  clearUI() { ui().innerHTML = ''; }

  switchScene(key, data) {
    for (const k of ['Ranch', 'Battle', 'Boot']) if (k !== key && this.game.scene.isActive(k)) this.game.scene.stop(k);
    this.game.scene.start(key, data);
  }

  // ---------- Título ----------
  showTitle() {
    this.clearUI();
    playMusic('title');
    const showcase = Object.keys(PLAYER).map(k => ({ key: k, dex: PLAYER[k].stages[Math.floor(Math.random() * PLAYER[k].stages.length)].dex, n: 2 + Math.floor(Math.random() * 3), ko: 0 }));
    this.switchScene('Ranch', { bg: 'act0', orient: this.orient, team: showcase });
    const saved = R.load();
    const t = el(`
      <div class="title-screen">
        <div class="logo"><span class="l1">HOW MANY</span><span class="l2">POKéMON?</span></div>
        <div class="sub">¿Cuántos Pokémon hacen falta para derrotar a Mewtwo?</div>
        <div class="buttons">
          ${saved && !saved.won ? `<button class="btn big" data-continue>Continuar <small>Ronda ${saved.round + 1} · ${ACTS[saved.map[saved.round].act].name}</small></button>` : ''}
          <button class="btn big red" data-new>Nueva partida</button>
          <button class="btn small ghost" data-sound>♪ Sonido</button>
        </div>
        <div class="press">Toca para activar el sonido</div>
        <div class="foot">Fan game sin ánimo de lucro inspirado en <i>How Many Dudes?</i> (Butterscotch Shenanigans).<br>
        Pokémon © Nintendo / Creatures / GAME FREAK · Sprites de PMD SpriteCollab · Tiles de HGSS/FRLG · Música de HGSS — ver CREDITS.md.</div>
      </div>`);
    t.addEventListener('click', e => {
      t.querySelector('.press')?.remove();
      if (e.target.closest('[data-new]')) this.newGame();
      if (e.target.closest('[data-continue]')) { this.run = saved; this.ranchEnter = true; this.goRanch(); }
      if (e.target.closest('[data-sound]')) this.soundPanel(e.target.closest('[data-sound]'));
    });
    ui().appendChild(t);
  }

  newGame() {
    this.clearUI();
    playMusic('act0');
    EV.starterModal(k => {
      this.run = R.newRun(k);
      this.run.tutorial = true;
      R.save(this.run);
      this.ranchEnter = true;
      this.goRanch();
    });
  }

  // ---------- Rancho ----------
  teamEntries() {
    return Object.keys(this.run.team).map(k => ({ key: k, dex: R.speciesDex(this.run, k), n: this.run.team[k].n, ko: this.run.team[k].ko.length }));
  }

  async goRanch() {
    this.clearUI();
    const run = this.run;
    const r = R.currentRound(run);
    playMusic(`act${r.act}`);
    this.shownMoney = run.money;
    this.switchScene('Ranch', { bg: 'ranch', orient: this.orient, team: this.teamEntries() });
    this.refreshRanch(false);
    if (this.lastAct !== r.act) { this.lastAct = r.act; this.locationSign(ACTS[r.act].name, `Acto ${r.act + 1}`); }
    if (run.returned?.length) {
      jingle('egg');
      for (const d of run.returned) this.toast(`¡${d.n} Rattatas vuelven de la Guardería convertidos en ${PLAYER[d.to].stages[0].name}!`);
      run.returned = [];
    }
    // Diálogos: tutorial del Prof. Oak y presentación del jefe
    if (run.tutorial) {
      run.tutorial = false;
      R.save(run);
      await wait(600);
      await talk('oak', [
        'Este es tu rancho. A la derecha puedes reclutar más Pokémon con tus ₽: ¡cuantos más, mejor!',
        'Abajo verás a los rivales de la próxima ronda. Las flechas ▲ verdes te dicen qué especies son eficaces contra ellos.',
        'Cuando estés listo, pulsa ¡A LUCHAR! El combate es automático, pero puedes usar objetos y acelerar el tiempo.',
      ]);
    }
    if (r.type === 'jefe' && run.bossTalked !== run.round) {
      run.bossTalked = run.round;
      R.save(run);
      await wait(400);
      const intro = bossIntro(run, r.act);
      cry(ENEMIES[ACTS[r.act].boss].dex, { vol: 0.5 });
      await talk(intro.npc, intro.lines);
    }
    if (!run.eventDone) {
      const done = () => { run.eventDone = true; R.save(run); playMusic(`act${r.act}`); this.refreshRanch(true); };
      if (r.type === 'tienda') EV.shopModal(this, done);
      else if (r.type === 'vitaminas') EV.vitaminModal(this, done);
      else if (r.type === 'guarderia') EV.daycareModal(this, done);
      else run.eventDone = true;
    }
  }

  refreshRanch(syncScene) {
    const old = document.getElementById('ranch');
    const scroll = old ? [...old.querySelectorAll('.list')].map(l => l.scrollTop) : [];
    const node = renderRanch(this);
    this.flash = null;
    if (old) old.replaceWith(node); else ui().prepend(node);
    node.querySelectorAll('.list').forEach((l, i) => { l.scrollTop = scroll[i] || 0; });
    this.animateMoney(node.querySelector('[data-money]'));
    if (syncScene) {
      const sc = this.game.scene.getScene('Ranch');
      if (sc?.scene.isActive()) sc.setTeam(this.teamEntries());
      R.save(this.run);
    }
  }

  // El contador de ₽ se desliza hasta el valor nuevo
  animateMoney(node) {
    if (!node) return;
    const from = this.shownMoney ?? this.run.money, to = this.run.money;
    this.shownMoney = to;
    if (from === to) return;
    node.parentElement.classList.add(to < from ? 'spend' : 'gain');
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 400);
      node.textContent = Math.round(from + (to - from) * k);
      if (k < 1) requestAnimationFrame(step);
    };
    step();
  }

  // ---------- Combate ----------
  fight() {
    if (R.totalConscious(this.run) <= 0) { sfx('error'); this.toast('¡No tienes Pokémon en condiciones de luchar!'); return; }
    if (!this.run.eventDone) return;
    R.save(this.run);
    const r = R.currentRound(this.run);
    const setup = R.battleSetup(this.run);
    setup.arena = this.dims;
    this.armed = -1;
    const kinds = {};
    for (const e of setup.enemies) (kinds[e.key] ??= { key: e.key, name: e.name, dex: e.dex, types: e.types, boss: e.boss, n: 0 }).n++;
    this.hudFoes = Object.values(kinds).sort((a, b) => b.boss - a.boss);
    const boss = setup.enemies.find(e => e.boss);
    playMusic(boss ? (r.act === ACTS.length - 1 ? 'final' : 'boss') : 'battle');
    sfx('whoosh');
    this.wipe(() => {
      this.clearUI();
      this.switchScene('Battle', { setup, act: r.act, app: this });
      this.renderHud();
      this.banner(boss ? `¿Cuántos Pokémon hacen falta<small>para derrotar a ${boss.name}?</small>` : `¡Pokémon salvajes!<small>Ronda ${this.run.round + 1} · ${ACTS[r.act].name}</small>`);
      this.hudFoes.forEach((f, i) => setTimeout(() => cry(f.dex, { vol: f.boss ? 0.6 : 0.4 }), 350 + i * 260));
    });
  }

  // Transición de combate estilo HGSS: franjas que barren la pantalla
  wipe(mid) {
    const w = el(`<div class="wipe">${Array.from({ length: 8 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>`);
    document.body.appendChild(w);
    setTimeout(() => { mid(); w.classList.add('out'); }, 520);
    setTimeout(() => w.remove(), 1100);
  }

  renderHud() {
    const run = this.run;
    const slots = [];
    for (let i = 0; i < MAX_CONSUMABLES; i++) {
      const k = run.consumables[i];
      slots.push(k ? `<div class="slot ${this.armed === i ? 'armed' : ''}" data-use="${i}" ${tip(`<h4>${icon(CONSUMABLES[k])} ${CONSUMABLES[k].name}</h4>${CONSUMABLES[k].desc}`)}>${icon(CONSUMABLES[k])}</div>` : '<div class="slot empty"></div>');
    }
    const hud = el(`<div id="hud">
      <div class="hud-top panel"><div class="title-font" data-title></div><div class="bossbar" data-bar><div></div><span data-pct></span></div>
        <div class="foe-chips">${this.hudFoes.map(f => `<div class="foe-chip ${f.boss ? 'boss' : ''}" data-foe="${f.key}" ${tip(`<h4>${f.name}</h4>${f.types.map(typeBadge).join('')}`)}><img class="px" src="${portrait(f.dex)}" alt=""><b data-n>${f.n}</b></div>`).join('')}</div>
      </div>
      <div class="feed" data-feed></div>
      <div class="hud-bottom panel">
        <div class="allies" ${tip('Tus Pokémon en pie / que empezaron el combate')}><img class="px icon mini" src="assets/items/poke-ball.png" alt=""><b data-allies>0</b><div class="allybar"><div data-allybar></div></div></div>
        ${slots.join('')}
        <div class="speed">${[0, 1, 2, 4].map(s => `<button class="btn small ${this.speed === s ? 'on' : ''}" data-speed="${s}">${s === 0 ? '❚❚' : '×' + s}</button>`).join('')}</div>
      </div>
    </div>`);
    hud.addEventListener('click', e => {
      const s = e.target.closest('[data-speed]');
      if (s) { this.speed = +s.dataset.speed; this.rerenderHud(); return; }
      const u = e.target.closest('[data-use]');
      if (u) this.useConsumable(+u.dataset.use);
    });
    const oldFeed = document.querySelector('[data-feed]');
    document.getElementById('hud')?.remove();
    ui().appendChild(hud);
    if (oldFeed) hud.querySelector('[data-feed]').replaceWith(oldFeed);
    this.hudT = 0;
  }
  rerenderHud() { this.renderHud(); }

  // Registro de combate: lo más importante que va pasando
  feed(html, cls = '') {
    const box = document.querySelector('[data-feed]');
    if (!box) return;
    const line = el(`<div class="feed-line ${cls}">${html}</div>`);
    box.prepend(line);
    while (box.children.length > 5) box.lastElementChild.remove();
    setTimeout(() => line.classList.add('old'), 3500);
    setTimeout(() => line.remove(), 4200);
  }

  useConsumable(i) {
    const k = this.run.consumables[i];
    if (!k) return;
    const sim = this.game.scene.getScene('Battle').sim;
    if (CONSUMABLES[k].target) {
      this.armed = this.armed === i ? -1 : i;
      document.body.classList.toggle('targeting', this.armed >= 0);
      if (this.armed >= 0) this.toast('Toca la arena donde quieras que caiga el Meteorito');
      this.rerenderHud();
      return;
    }
    if (sim.useConsumable(k)) {
      sfx(k === 'thunderstone' ? 'zap' : 'heal');
      this.feed(`¡Has usado ${icon(CONSUMABLES[k], 'mini')} <b>${CONSUMABLES[k].name}</b>!`, 'mine');
      this.run.consumables.splice(i, 1);
      this.rerenderHud();
    } else { sfx('error'); this.toast('¡Ahora no se puede usar!'); }
  }

  onArenaClick(x, y) {
    if (this.armed < 0) return;
    const k = this.run.consumables[this.armed];
    const sim = this.game.scene.getScene('Battle').sim;
    if (sim.useConsumable(k, { x, y })) {
      this.feed(`¡Has lanzado un ${icon(CONSUMABLES[k], 'mini')} <b>${CONSUMABLES[k].name}</b>!`, 'mine');
      this.run.consumables.splice(this.armed, 1);
    }
    this.armed = -1;
    document.body.classList.remove('targeting');
    this.rerenderHud();
  }

  onBattleTick(sim) {
    const now = performance.now();
    if (now - (this.hudT || 0) < 120) return;
    this.hudT = now;
    const hud = document.getElementById('hud');
    if (!hud) return;
    const alive = sim.allies.filter(a => a.state !== 'ko').length;
    hud.querySelector('[data-allies]').textContent = `${alive}/${sim.allies.length}`;
    const ab = hud.querySelector('[data-allybar]');
    ab.style.width = `${(alive / sim.allies.length) * 100}%`;
    ab.parentElement.classList.toggle('danger', alive / sim.allies.length < 0.3);
    const boss = sim.enemies.find(e => e.boss);
    const left = sim.enemies.filter(e => e.hp > 0);
    for (const chip of hud.querySelectorAll('[data-foe]')) {
      const n = left.filter(e => e.key === chip.dataset.foe).length;
      const nn = chip.querySelector('[data-n]');
      if (nn.textContent !== String(n)) { nn.textContent = n; chip.classList.remove('bump'); void chip.offsetWidth; chip.classList.add('bump'); }
      chip.classList.toggle('gone', n === 0);
    }
    const bar = hud.querySelector('[data-bar]');
    let p;
    if (boss) {
      hud.querySelector('[data-title]').textContent = `${boss.name} 👑`;
      p = Math.max(0, boss.hp / boss.maxHp);
    } else {
      const tot = sim.enemies.reduce((s, e) => s + e.maxHp, 0), cur = left.reduce((s, e) => s + e.hp, 0);
      hud.querySelector('[data-title]').textContent = `Pokémon salvajes: quedan ${left.length}`;
      p = cur / tot;
    }
    bar.firstElementChild.style.width = `${p * 100}%`;
    hud.querySelector('[data-pct]').textContent = `${Math.ceil(p * 100)}%`;
  }

  onBattleEnd(sim) {
    document.body.classList.remove('targeting');
    const r = R.currentRound(this.run);
    const res = R.applyBattle(this.run, sim);
    this.clearUI();
    if (!res.win) {
      R.clearSave();
      playMusic(null);
      jingle('lose');
      this.banner('¡DEBILITADOS!');
      setTimeout(() => EV.endScreen(this, false), 1400);
      return;
    }
    playMusic(r.type === 'jefe' ? 'victoryboss' : 'victory');
    const steps = [
      done => EV.resultsModal(this, res, done),
      ...(r.type === 'cartel' ? [done => EV.cartelModal(this, done)] : []),
      ...(r.type === 'objeto' ? [done => EV.relicModal(this, done)] : []),
      ...(r.type === 'jefe' ? [done => EV.badgeModal(this, done)] : []),
      ...res.evolutions.map(evo => done => EV.evolutionModal(this, evo, done)),
    ];
    const next = () => {
      const s = steps.shift();
      if (s) { s(next); return; }
      R.advanceRound(this.run);
      if (this.run.won) { R.clearSave(); playMusic('halloffame'); EV.endScreen(this, true); return; }
      R.save(this.run);
      this.wipe(() => this.goRanch());
    };
    next();
  }

  // ---------- Mensajes ----------
  banner(html) {
    const b = el(`<div class="banner">${html}</div>`);
    ui().appendChild(b);
    setTimeout(() => b.classList.add('out'), 1700);
    setTimeout(() => b.remove(), 2100);
  }

  // Cartel de lugar de HGSS al llegar a un acto nuevo
  locationSign(name, sub) {
    const s = el(`<div class="location-sign"><small>${sub}</small>${name}</div>`);
    document.body.appendChild(s);
    setTimeout(() => s.classList.add('out'), 2600);
    setTimeout(() => s.remove(), 3100);
  }

  toast(msg) {
    const t = el(`<div class="toast panel">${msg}</div>`);
    ui().appendChild(t);
    setTimeout(() => t.classList.add('out'), 2000);
    setTimeout(() => t.remove(), 2400);
  }

  soundPanel(anchor) {
    document.querySelector('.sound-panel')?.remove();
    const v = volumes();
    const p = el(`<div class="sound-panel panel">
      <label>♪ Música <input type="range" min="0" max="1" step="0.05" value="${v.music}" data-m></label>
      <label>🔊 Efectos <input type="range" min="0" max="1" step="0.05" value="${v.sfx}" data-s></label>
      <button class="btn small" data-x>Cerrar</button>
    </div>`);
    const r = anchor.getBoundingClientRect();
    p.style.top = `${Math.min(window.innerHeight - 160, r.bottom + 8)}px`;
    p.style.left = `${Math.max(8, Math.min(window.innerWidth - 250, r.left - 100))}px`;
    p.addEventListener('input', e => {
      if (e.target.matches('[data-m]')) setMusic(+e.target.value);
      if (e.target.matches('[data-s]')) { setSfx(+e.target.value); sfx('coin'); }
    });
    p.addEventListener('click', e => { if (e.target.closest('[data-x]')) p.remove(); });
    document.body.appendChild(p);
  }
}

// Nombres de los rasgos enemigos para el registro de combate
export const traitName = t => TRAIT_INFO[t]?.[0] || t;

const app = new App();
window.app = app;
app.init();
