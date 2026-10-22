// Utilidades de interfaz HTML.
import { portrait } from '../scenes/anims.js';
import { typeBadge } from '../data/types.js';

export const $ = sel => document.querySelector(sel);
export const ui = () => document.getElementById('ui');

// El símbolo ₽ no existe en la fuente de DS: se sustituye por el icono de Pokédólar.
export const pd = html => html.replace(/₽/g, '<i class="pd"></i>');

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = pd(html.trim());
  return t.content.firstElementChild;
}

export const img = (dex, cls = '') => `<img class="px ${cls}" src="${portrait(dex)}" alt="">`;
export const types = list => list.map(typeBadge).join('');
export const money = n => `<span class="money">₽${Math.round(n)}</span>`;

export function modal(html, { onClose } = {}) {
  const back = el(`<div class="modal-back"><div class="modal panel">${html}</div></div>`);
  back.render = h => { back.querySelector('.modal').innerHTML = pd(h); };
  ui().appendChild(back);
  const close = () => { back.remove(); hideTip(); onClose && onClose(); };
  back.close = close;
  return back;
}

// Tooltips: cualquier elemento con data-tip (HTML)
const tipEl = () => document.getElementById('tooltip');
export function hideTip() { tipEl().classList.add('hidden'); }
document.addEventListener('pointerover', e => {
  if (e.pointerType !== 'mouse') return; // en táctil se usa el toque (más abajo)
  const t = e.target.closest('[data-tip]');
  if (!t) { hideTip(); return; }
  const tip = tipEl();
  tip.innerHTML = pd(decodeURIComponent(t.dataset.tip));
  tip.classList.remove('hidden');
});
const zoom = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--z')) || 1;
document.addEventListener('pointermove', e => {
  const tip = tipEl();
  if (e.pointerType !== 'mouse' || tip.classList.contains('hidden')) return;
  const z = zoom();
  const w = tip.offsetWidth * z, h = tip.offsetHeight * z;
  tip.style.left = Math.min(window.innerWidth - w - 8, e.clientX + 16) / z + 'px';
  tip.style.top = Math.min(window.innerHeight - h - 8, e.clientY + 16) / z + 'px';
});
export const tip = html => `data-tip="${encodeURIComponent(html)}"`;

// En pantallas táctiles no hay "hover": un toque muestra el tooltip unos segundos.
let tipTimer;
document.addEventListener('touchstart', e => {
  const t = e.target.closest('[data-tip]');
  const tipBox = tipEl();
  if (!t || e.target.closest('button')) { tipBox.classList.add('hidden'); return; }
  tipBox.innerHTML = pd(decodeURIComponent(t.dataset.tip));
  tipBox.classList.remove('hidden');
  const touch = e.touches[0];
  const z = zoom();
  const w = tipBox.offsetWidth * z, h = tipBox.offsetHeight * z;
  tipBox.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, touch.clientX - w / 2)) / z + 'px';
  tipBox.style.top = Math.max(8, touch.clientY - h - 24) / z + 'px';
  clearTimeout(tipTimer);
  tipTimer = setTimeout(() => tipBox.classList.add('hidden'), 3500);
}, { passive: true });
