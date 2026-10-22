// Carga y animación de los sprites de PMD SpriteCollab (8 direcciones).
export let MANIFEST = {};
export function setManifest(m) { MANIFEST = m; }

const created = new Set();

export function portrait(dex) {
  return MANIFEST[dex]?.portrait || '';
}

export const sheetKey = dex => `sp${dex}`;

// Sprite animado en HTML (fondo transparente), mirando hacia abajo. Usa la hoja empaquetada.
export function spriteHTML(dex, scale = 3, anim = 'Idle', cls = '') {
  const m = MANIFEST[dex];
  const a = m?.anims[anim] || m?.anims.Walk;
  if (!a) return '';
  const W = Math.max(...Object.values(m.anims).map(x => x.frames * x.fw));
  const dur = a.durations.reduce((t, d) => t + d, 0) / 60;
  return `<div class="spr ${cls}" style="width:${a.fw * scale}px;height:${a.fh * scale}px;background-image:url(${m.sheet});background-size:${W * scale}px auto;--y:${-a.y * scale}px;--end:${-a.frames * a.fw * scale}px;--n:${a.frames};--d:${dur}s"></div>`;
}

export function loadSpecies(loader, dex) {
  const m = MANIFEST[dex];
  if (m && !loader.textureManager.exists(sheetKey(dex))) loader.image(sheetKey(dex), m.sheet);
}

// Crea los frames con nombre ("Walk_5"…) dentro de la hoja empaquetada del Pokémon.
function addFrames(scene, dex) {
  const tex = scene.textures.get(sheetKey(dex));
  if (tex.has('Walk_0')) return;
  for (const [name, a] of Object.entries(MANIFEST[dex].anims)) {
    for (let r = 0; r < a.rows; r++) for (let c = 0; c < a.frames; c++) {
      tex.add(`${name}_${r * a.frames + c}`, 0, c * a.fw, a.y + r * a.fh, a.fw, a.fh);
    }
  }
}

export function ensureAnims(scene, dex) {
  if (created.has(dex)) return;
  const m = MANIFEST[dex];
  if (!m || !scene.textures.exists(sheetKey(dex))) return;
  addFrames(scene, dex);
  for (const [name, a] of Object.entries(m.anims)) {
    for (let r = 0; r < a.rows; r++) {
      scene.anims.create({
        key: `${dex}:${name}:${r}`,
        frames: a.durations.map((d, i) => ({ key: sheetKey(dex), frame: `${name}_${r * a.frames + i}`, duration: (d * 1000) / 60 })),
        repeat: name === 'Attack' || name === 'Hurt' ? 0 : -1,
      });
    }
  }
  created.add(dex);
}

// Orden de filas en PMD: abajo, abajo-dcha, dcha, arriba-dcha, arriba, arriba-izq, izq, abajo-izq
export function dirRow(angle) {
  const k = Math.round(angle / (Math.PI / 4));
  return (((2 - k) % 8) + 8) % 8;
}

// Duración (s) de una animación completa, para el ataque
export function animDuration(dex, name) {
  const a = MANIFEST[dex]?.anims[name];
  return a ? a.durations.reduce((s, d) => s + d, 0) / 60 : 0.3;
}

export function setAnim(spr, dex, name, row, force = false) {
  const m = MANIFEST[dex];
  const a = m?.anims[name] || m?.anims.Walk;
  if (!a) return;
  if (!m.anims[name]) name = 'Walk';
  const r = a.rows === 1 ? 0 : row;
  const key = `${dex}:${name}:${r}`;
  if (!force && spr.anims.currentAnim?.key === key && (spr.anims.isPlaying || name === 'Attack' || name === 'Hurt')) return;
  spr.play(key);
  // Todas las hojas de PMD comparten el centro del frame; alineamos los pies con la sombra.
  const off = Math.max(0, (m.foot ?? m.anims.Walk.fh * 0.67) - m.anims.Walk.fh / 2 - 1);
  spr.setOrigin(0.5, 0.5 + off / a.fh);
}
