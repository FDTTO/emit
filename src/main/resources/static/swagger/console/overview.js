/*
 * The info panel: the walkthrough checklist, the authentication table
 * and the regions that scroll sideways.
 */
import { scopeBadge } from './auth.js';
import { el } from './dom.js';
import { journeyState } from './journey.js';
import { openOperation } from './operations.js';
import { operationIndex } from './spec.js';
import { config, runtime } from './state.js';

export function paintSteps() {
  const panel = document.querySelector('.information-container .info');
  if (!panel || !runtime.spec) return;

  /* The listed steps are the journey's, in order: each is marked done or
     next with the same evidence the rail uses. */
  const items = panel.querySelectorAll('ol > li');
  if (items.length === config.journey.length) {
    const state = journeyState();
    items.forEach(function (item, index) {
      /* Three cells: the mark, the words with their route, the proof. The
         markdown is set as HTML, so its nodes can move under a wrapper. */
      if (!item.querySelector('.emit-step-text')) {
        const words = el('span', 'emit-step-text');
        while (item.firstChild) words.appendChild(item.firstChild);
        /* The route keeps its own margin; the space before it would add to it. */
        words.querySelectorAll('code').forEach(function (code) {
          const before = code.previousSibling;
          if (before && before.nodeType === 3) before.textContent = before.textContent.replace(/\s+$/, '');
        });
        item.appendChild(el('span', 'emit-step-mark'));
        item.appendChild(words);
      }
      /* A step that has just been done marks itself with a short pulse. */
      if (state.done[index] && item.dataset.emitDone === 'false') {
        item.classList.add('emit-step--fresh');
        setTimeout(function () { item.classList.remove('emit-step--fresh'); }, 600);
      }
      item.dataset.emitDone = String(state.done[index]);
      item.classList.toggle('emit-step--done', state.done[index]);
      item.classList.toggle('emit-step--next', index === state.next);
      let proof = item.querySelector('.emit-step-proof');
      if (!proof) item.appendChild(proof = el('span', 'emit-step-proof'));
      const said = state.done[index] ? config.journey[index].proof : index === state.next ? 'next' : '';
      if (proof.textContent !== said) proof.textContent = said;
    });
  }

  const index = operationIndex();
  panel.querySelectorAll('li code').forEach(function (chip) {
    if (chip.dataset.emitStep) return;
    const target = index[(chip.textContent || '').trim()];
    if (!target) return;

    chip.dataset.emitStep = 'true';
    chip.classList.add('emit-step-link');
    chip.setAttribute('role', 'link');
    chip.setAttribute('tabindex', '0');
    chip.setAttribute('title', 'Open this operation');
    chip.addEventListener('click', function () { openOperation(target); });
    chip.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      openOperation(target);
    });
  });
}

/* Authentication table: the content stays in the OpenAPI description; the
 * first cell (a scheme name) is swapped for that scheme's badge.
 */
export function paintAuthMatrix() {
  const table = document.querySelector('.information-container .info table');
  if (!table || table.classList.contains('emit-matrix')) return;

  const rows = table.querySelectorAll('tbody tr');
  if (!rows.length) return;

  let painted = 0;
  rows.forEach(function (row) {
    const cell = row.querySelector('td');
    if (!cell) return;
    const scheme = config.scopes[(cell.textContent || '').trim()];
    if (!scheme) return;
    cell.textContent = '';
    cell.appendChild(scopeBadge(scheme));
    painted++;
  });

  /* Claim the table only once a row resolved. */
  if (!painted) return;
  table.classList.add('emit-matrix');

  /* Own scroll frame for narrow screens. Safe to move: the description is
     markdown set as HTML, not nodes React reconciles. */
  const frame = el('div', 'emit-matrix-frame');
  table.parentNode.insertBefore(frame, table);
  frame.appendChild(table);
}

/* A region that scrolls sideways needs a tab stop to be scrolled by
 * keyboard; Chromium adds one on its own, other engines do not. Only while
 * it actually overflows, so a wide screen gains no empty tab stops.
 */
const SCROLLER_LABELS = [
  ['.emit-matrix-frame', 'Authentication table'],
  ['pre.curl', 'curl command'],
  ['pre', 'Code']
];

export function paintScrollers() {
  SCROLLER_LABELS.forEach(function (entry) {
    document.querySelectorAll('#swagger-ui ' + entry[0]).forEach(function (region) {
      const overflowX = getComputedStyle(region).overflowX;
      const scrolls = (overflowX === 'auto' || overflowX === 'scroll')
        && region.scrollWidth > region.clientWidth + 1;
      const marked = region.hasAttribute('data-emit-scroller');
      if (scrolls && !marked) {
        region.setAttribute('data-emit-scroller', '');
        region.setAttribute('tabindex', '0');
        region.setAttribute('role', 'region');
        region.setAttribute('aria-label', entry[1] + ', scrolls horizontally');
      } else if (!scrolls && marked) {
        ['data-emit-scroller', 'tabindex', 'role', 'aria-label'].forEach(function (name) {
          region.removeAttribute(name);
        });
      }
    });
  });
}
