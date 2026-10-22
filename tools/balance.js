// Simula partidas completas sin navegador para equilibrar la dificultad.
// Uso: node tools/balance.js [partidas]
const store = {};
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
const { Battle } = await import('../js/game/sim.js');
const R = await import('../js/game/run.js');
const { PLAYER } = await import('../js/data/species.js');

const runs = +(process.argv[2] || 5);
const verbose = runs === 1;
const reached = [];
for (let n = 0; n < runs; n++) {
  const run = R.newRun(['bulbasaur', 'charmander', 'squirtle'][n % 3]);
  let alive = true;
  while (alive && !run.won) {
    const r = R.currentRound(run);
    if (r.type === 'tienda') for (const it of R.shopStock(run)) if (it.kind === 'relic' && run.money > it.price + 40) R.buyStock(run, it);
    if (r.type === 'vitaminas') { const o = R.vitaminOffer(run); if (run.money > o.price + 30) { run.money -= o.price; const k = Object.keys(run.team).sort((a, b) => run.team[b].n - run.team[a].n)[0]; run.spec[k].vit.push(o.list[0]); } }
    // comprar repartiendo
    let guard = 0;
    while (guard++ < 500) {
      const keys = run.unlocked.slice().sort((a, b) => (run.team[a]?.n || 0) * PLAYER[a].price - (run.team[b]?.n || 0) * PLAYER[b].price);
      if (!R.buy(run, keys[0], 1) && !R.buy(run, 'rattata', 1)) break;
    }
    const setup = R.battleSetup(run);
    const b = new Battle(setup);
    let t = 0;
    const t0 = Date.now();
    while (!b.result && t < 400) { b.update(0.1); t += 0.1; b.events.length = 0; }
    const res = R.applyBattle(run, b);
    const alivePct = b.allies.filter(a => a.state !== 'ko').length / b.allies.length;
    if (verbose) process.stdout.write(`${r.type === 'jefe' ? '👑' : ''}R${run.round + 1}:${setup.allies.length}:${res.win ? 'W' : 'L'}:${(alivePct * 100).toFixed(0)}%:${t.toFixed(0)}s  `);
    if (!res.win) { alive = false; break; }
    if (r.type === 'cartel') { const o = R.cartelOptions(run); if (o.length) R.postCartel(run, o[0]); }
    if (r.type === 'objeto') { const o = R.relicOptions(run); if (o.length) run.relics.push(o[0]); }
    if (r.type === 'jefe') run.badges.push(R.badgeOptions(run)[0]);
    R.advanceRound(run);
  }
  reached.push(run.won ? 'WIN' : run.round + 1);
}
console.log('ronda alcanzada:', reached.join(' '));
