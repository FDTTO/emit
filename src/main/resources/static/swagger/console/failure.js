/*
 * What the window shows when the OpenAPI document does not load.
 */
import { el, icon } from './dom.js';
import { contentPane } from './shell.js';
import { config } from './state.js';

export function specFailed() {
  const selectors = window.ui && window.ui.specSelectors;
  return !!selectors && typeof selectors.loadingStatus === 'function' && selectors.loadingStatus() === 'failed';
}

export function paintFailure() {
  const host = document.getElementById('emit-window');
  const pane = contentPane();
  if (!host || !pane) return;
  const failed = specFailed();
  host.dataset.spec = failed ? 'failed' : '';
  let card = document.getElementById('emit-failure');
  if (!failed) {
    if (card) card.remove();
    return;
  }
  if (card) return;

  const url = window.ui.specSelectors.url() || config.specUrl;
  card = el('section', 'emit-failure');
  card.id = 'emit-failure';
  card.setAttribute('role', 'alert');
  const mark = card.appendChild(el('div', 'emit-failure__mark'));
  mark.appendChild(icon('alert'));
  card.appendChild(el('h2', null, 'The API description did not load'));
  card.appendChild(
    el('p', null, 'The console draws every operation from it, so there is nothing to show until it loads.'),
  );
  const call = card.appendChild(el('div', 'emit-failure__call'));
  const code = call.appendChild(el('b', null, '…'));
  call.appendChild(document.createTextNode('GET ' + url));
  /* Swagger keeps the failure's words, not its status: ask once more. */
  fetch(url, { credentials: 'same-origin' })
    .then(function (response) {
      code.textContent = String(response.status);
    })
    .catch(function () {
      code.textContent = 'No answer';
    });
  const actions = card.appendChild(el('div', 'emit-failure__actions'));
  const retry = actions.appendChild(el('button', 'emit-primary', 'Try again'));
  retry.type = 'button';
  retry.addEventListener('click', function () {
    location.reload();
  });
  const raw = actions.appendChild(el('a', 'emit-quiet', 'Open the raw description'));
  raw.href = url;
  raw.target = '_blank';
  raw.rel = 'noopener';
  card.appendChild(el('small', null, config.failureHint));
  pane.appendChild(card);

  const rail = document.getElementById('emit-rail');
  if (rail && !rail.querySelector('.emit-rail__empty')) {
    rail.insertBefore(el('div', 'emit-rail__empty', 'No operations until the API description loads.'), rail.firstChild);
  }
  const server = document.getElementById('emit-status-server');
  if (server && !server.dataset.built) {
    server.dataset.built = 'true';
    server.appendChild(el('i', 'emit-status__led'));
    server.appendChild(document.createTextNode(location.host));
  }
}
