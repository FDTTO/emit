/*
 * The bar under an open operation: what the call will send, the key that
 * sends it and Execute, docked to the window's foot while the operation
 * fills the view.
 */
import { expiryOf, heldCredential } from './auth.js';
import { openCredentials } from './credentials.js';
import { el } from './dom.js';
import { paintHistoryTool } from './history.js';
import { PHONE } from './phone.js';
import { contentPane } from './shell.js';
import { operationFor, requiredSchemes } from './spec.js';
import { runtime } from './state.js';

/* A sticky header is stuck once it has left its block's top edge, and the
   action bar is docked while it rests on the bottom of what scrolls: the
   pane, or on a phone the screen. React owns these elements' classes, so
   the states are attributes. */
export function paintStuck() {
  const pane = contentPane();
  const floor = PHONE.matches || !pane ? innerHeight : pane.getBoundingClientRect().bottom;
  document.querySelectorAll('.opblock.is-open').forEach(function (block) {
    const summary = block.querySelector('.opblock-summary');
    const stuck = !!summary && summary.getBoundingClientRect().top - block.getBoundingClientRect().top > 1;
    if (block.hasAttribute('data-emit-stuck') !== stuck) block.toggleAttribute('data-emit-stuck', stuck);
    /* The bar docks only once the operation fills enough of the view for
       its header, some of its request and the bar itself. Before that a
       docked bar could climb no higher than the top of the request and
       would sit over its first lines. */
    const bar = actionBarOf(block);
    if (!bar) return;
    const roomy = floor - block.getBoundingClientRect().top > DOCK_ROOM;
    if (bar.hasAttribute('data-emit-dockable') !== roomy) bar.toggleAttribute('data-emit-dockable', roomy);
    const docked = roomy && Math.abs(bar.getBoundingClientRect().bottom - floor) < 1;
    if (bar.hasAttribute('data-emit-docked') !== docked) bar.toggleAttribute('data-emit-docked', docked);
  });
}

const DOCK_ROOM = 280;

function actionBarOf(block) {
  return block.querySelector('.opblock-body > .execute-wrapper, .opblock-body > .btn-group');
}

/* The bar says what the call will send: the credential each scheme it
   needs puts in its header, and whether it is held. While the call is
   out, how long it has been. */
const runStarts = {};

let runTicker = null;

export function paintActionBars() {
  if (!runtime.spec) return;
  let running = false;
  document.querySelectorAll('.opblock.is-open').forEach(function (block) {
    const bar = actionBarOf(block);
    const button = bar && bar.querySelector('button.execute');
    if (!button) return;
    let sends = bar.querySelector('.emit-sends');
    if (!sends) {
      sends = el('span', 'emit-sends');
      bar.insertBefore(sends, bar.firstChild);
      bar.insertBefore(el('kbd', 'emit-execute-key', 'Ctrl Enter'), button);
    }
    if (button.disabled) {
      running = true;
      if (!runStarts[block.id]) runStarts[block.id] = Date.now();
      paintSends(sends, 'running', null, 'Running · ' + (Date.now() - runStarts[block.id]) + ' ms');
      return;
    }
    delete runStarts[block.id];
    paintCredentialSent(sends, operationFor(block));
    paintHistoryTool(block, bar, button);
  });
  if (running && !runTicker) runTicker = setInterval(paintActionBars, 50);
  if (!running && runTicker) {
    clearInterval(runTicker);
    runTicker = null;
  }
}

function paintCredentialSent(sends, operation) {
  const schemes = operation ? requiredSchemes(operation) : [];
  if (!schemes.length) return paintSends(sends, 'public', null, 'Sends no credential');
  const scheme = schemes[0];
  const definition = ((runtime.spec.components && runtime.spec.components.securitySchemes) || {})[scheme] || {};
  const header =
    definition.type === 'http'
      ? 'Authorization: ' + (definition.scheme === 'bearer' ? 'Bearer' : definition.scheme)
      : definition.name || scheme;
  const value = heldCredential(scheme);
  const expiresAt = value ? expiryOf(value) : null;
  const state = !value ? 'missing' : expiresAt !== null && expiresAt <= Date.now() ? 'expired' : 'held';
  paintSends(sends, state, header, state === 'held' ? ' held' : state === 'expired' ? ' expired, ' : ' not held, ');
}

function paintSends(sends, state, header, words) {
  const key = state + '|' + header + '|' + words;
  if (sends.dataset.key === key) return;
  sends.dataset.key = key;
  sends.dataset.state = state;
  sends.textContent = '';
  if (header) sends.appendChild(el('b', null, header));
  sends.appendChild(document.createTextNode(words));
  if (state === 'missing' || state === 'expired') {
    const link = el('button', null, 'Authorize');
    link.type = 'button';
    link.addEventListener('click', openCredentials);
    sends.appendChild(link);
  }
}

/* Ctrl+Enter executes the operation being worked on: the one holding
   focus, otherwise the first open one in view with Execute showing. */
export function executeTarget() {
  const here =
    document.activeElement && document.activeElement.closest && document.activeElement.closest('.opblock.is-open');
  const blocks = here ? [here] : Array.prototype.slice.call(document.querySelectorAll('.opblock.is-open'));
  for (let i = 0; i < blocks.length; i++) {
    const bar = actionBarOf(blocks[i]);
    const button = bar && bar.querySelector('button.execute');
    const box = button && button.getBoundingClientRect();
    if (button && !button.disabled && box.width > 0 && box.bottom > 0 && box.top < innerHeight) return button;
  }
  return null;
}
