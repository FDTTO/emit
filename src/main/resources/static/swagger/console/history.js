/*
 * Each operation's last calls, kept in the page only, with a way to put
 * a body back in the editor.
 */
import { el, icon } from './dom.js';
import { setAreaValue } from './editor.js';
import { routeOf, statusWords, toneOf } from './result.js';
import { operationIndex } from './spec.js';
import { runtime } from './state.js';

/* The last few calls each operation made: when, what came back, where it
   went and the body it sent, one click to load that body again. Kept in
   the page only, never in storage: a body can hold a password. */
const HISTORY_SIZE = 5;

const callHistory = {};

const historySeen = {};

export function captureHistory() {
  if (!runtime.spec || !window.ui) return;
  const selectors = window.ui.specSelectors;
  const index = operationIndex();
  Object.keys(index).forEach(function (key) {
    const method = key.slice(0, key.indexOf(' ')).toLowerCase();
    const path = key.slice(key.indexOf(' ') + 1);
    const response = selectors.responseFor(path, method);
    if (!response || historySeen[key] === response) return;
    historySeen[key] = response;
    const request = selectors.requestFor(path, method);
    const body = request && request.get('body');
    callHistory[key] ??= [];
    const calls = callHistory[key];
    calls.unshift({
      at: new Date(), status: response.get('status'), duration: response.get('duration'),
      url: request ? String(request.get('url') || '').replace(/^https?:\/\/[^/]+/, '') : path,
      body: typeof body === 'string' && body ? body : null
    });
    calls.length = Math.min(calls.length, HISTORY_SIZE);
  });
}

function historyKeyOf(block) {
  const route = routeOf(block);
  return route ? route.method.toUpperCase() + ' ' + route.path : null;
}

export function paintHistoryTool(block, bar, button) {
  const calls = callHistory[historyKeyOf(block)] || [];
  let tool = bar.querySelector('.emit-history');
  if (!calls.length) { if (tool) tool.hidden = true; return; }
  if (!tool) {
    tool = el('button', 'emit-history');
    tool.type = 'button';
    tool.setAttribute('aria-haspopup', 'dialog');
    tool.addEventListener('click', function (event) {
      event.stopPropagation();
      toggleHistory(block, bar);
    });
    bar.insertBefore(tool, bar.querySelector('.emit-execute-key') || button);
  }
  tool.hidden = false;
  if (tool.dataset.count === String(calls.length)) return;
  tool.dataset.count = String(calls.length);
  tool.textContent = '';
  tool.appendChild(icon('history'));
  tool.appendChild(document.createTextNode('History'));
  tool.appendChild(el('small', null, String(calls.length)));
}

export function closeHistory() {
  const open = document.querySelector('.emit-history__panel');
  if (open) open.remove();
}

function toggleHistory(block, bar) {
  const open = bar.querySelector('.emit-history__panel');
  closeHistory();
  if (open) return;
  const panel = el('div', 'emit-history__panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Recent calls');
  panel.appendChild(el('div', 'emit-history__title', 'Recent calls'));
  (callHistory[historyKeyOf(block)] || []).forEach(function (call) {
    const row = el('div', 'emit-history__row');
    row.appendChild(el('span', 'emit-history__time', call.at.toLocaleTimeString([], { hour12: false })));
    row.appendChild(el('span', 'emit-history__status is-' + toneOf(call.status), statusWords(call.status)));
    row.appendChild(el('span', 'emit-history__took', typeof call.duration === 'number' ? call.duration + ' ms' : ''));
    row.appendChild(el('span', 'emit-history__url', call.url));
    const area = block.querySelector('textarea.body-param__text');
    if (call.body && area) {
      const load = el('button', 'emit-history__load', 'Load');
      load.type = 'button';
      load.title = 'Put this body back in the editor';
      load.addEventListener('click', function () {
        block.classList.add('emit-editing');
        setAreaValue(block.querySelector('textarea.body-param__text'), call.body);
        closeHistory();
      });
      row.appendChild(load);
      row.appendChild(el('code', 'emit-history__body', call.body.replace(/\s+/g, ' ')));
    }
    panel.appendChild(row);
  });
  bar.appendChild(panel);
}
