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
document.addEventListener('mouseover', e => {
  const t = e.target.closest('[data-tip]');
  if (!t) { hideTip(); return; }
  const tip = tipEl();
  tip.innerHTML = pd(decodeURIComponent(t.dataset.tip));
  tip.classList.remove('hidden');
});
document.addEventListener('mousemove', e => {
  const tip = tipEl();
  if (tip.classList.contains('hidden')) return;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = Math.min(window.innerWidth - w - 8, e.clientX + 16) + 'px';
  tip.style.top = Math.min(window.innerHeight - h - 8, e.clientY + 16) + 'px';
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
  const w = tipBox.offsetWidth, h = tipBox.offsetHeight;
  tipBox.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, touch.clientX - w / 2)) + 'px';
  tipBox.style.top = Math.max(8, touch.clientY - h - 24) + 'px';
  clearTimeout(tipTimer);
  tipTimer = setTimeout(() => tipBox.classList.add('hidden'), 3500);
}, { passive: true });
