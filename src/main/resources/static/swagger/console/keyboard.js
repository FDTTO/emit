/*
 * The page's shortcuts, never while typing or with a dialog open.
 */
import { executeTarget } from './action-bar.js';
import { closeHistory } from './history.js';
import { openPalette } from './palette.js';
import { PHONE, setDrawer } from './phone.js';
import { contentPane, toggleRail } from './shell.js';

/* J and K walk the operations, as in a mail client: from the one holding
   focus, or else from the first in view. Enter then opens it, since focus
   is on its own button. Never while typing, nor with a dialog open. */
function stepOperation(by) {
  const rows = Array.prototype.slice.call(document.querySelectorAll('.opblock .opblock-summary-control'));
  if (!rows.length) return;
  let at = rows.indexOf(document.activeElement);
  if (at < 0) {
    const pane = contentPane();
    const top = pane && !PHONE.matches ? pane.getBoundingClientRect().top : 0;
    at = rows.findIndex(function (row) { return row.getBoundingClientRect().bottom > top; }) - (by > 0 ? 1 : 0);
  }
  const next = rows[Math.max(0, Math.min(rows.length - 1, at + by))];
  next.focus({ preventScroll: true });
  next.closest('.opblock').scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

export function typing(target) {
  return !!target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable);
}

export function bindShortcuts() {
  document.addEventListener('keydown', function (event) {
    const win = document.getElementById('emit-window');
    const modal = document.querySelector('.emit-palette:not([hidden]), #emit-auth:not([hidden])');
    if (!event.ctrlKey && !event.metaKey && !event.altKey && !typing(event.target) && !modal
        && (event.key === 'j' || event.key === 'k')) {
      event.preventDefault();
      stepOperation(event.key === 'j' ? 1 : -1);
      return;
    }
    if (event.key === 'Escape' && win && win.dataset.drawer === 'open') setDrawer(false);
    if (event.key === 'Escape') closeHistory();
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
    const key = event.key.toLowerCase();
    if (key === 'k') { event.preventDefault(); openPalette(); }
    if (key === 'b' && document.getElementById('emit-window')) { event.preventDefault(); toggleRail(); }
    if (key === 'enter') {
      const target = executeTarget();
      if (target) { event.preventDefault(); target.click(); }
    }
  });
}
