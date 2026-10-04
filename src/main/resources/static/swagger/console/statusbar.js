/*
 * The statusbar: the server's health, the latest answer's telemetry and
 * the page's density.
 */
import { el, icon } from './dom.js';
import { apiAddress, statusWords, toneOf } from './result.js';
import { config, runtime } from './state.js';

export function paintStatusbar() {
  const server = document.getElementById('emit-status-server');
  if (!server || !runtime.spec || server.dataset.built) return;
  const first = runtime.spec.servers && runtime.spec.servers[0];
  if (!first) return;
  server.dataset.built = 'true';
  server.appendChild(el('i', 'emit-status__led'));
  server.appendChild(
    document.createTextNode(
      first.url.replace(/^https?:\/\//, '') + (first.description ? ' · ' + first.description : ''),
    ),
  );
  server.appendChild(el('span', 'emit-status__health'));
  checkHealth();
}

/* The server's own light: green while it answers, amber while it answers
   unhealthy or does not answer at all. Checked every fifteen seconds while
   the page is in view, as soon as the reader comes back to it, and right
   after a call got no answer. Any HTTP answer means the server is there;
   only a health body that says otherwise makes it unhealthy. */
export const HEALTH_EVERY_MS = 15000;

const HEALTH_WAIT_MS = 4000;

export function checkHealth() {
  if (!config.healthPath || !runtime.spec || document.hidden) return;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const abort = setTimeout(function () {
    if (controller) controller.abort();
  }, HEALTH_WAIT_MS);
  fetch(apiAddress().replace(/\/$/, '') + config.healthPath, {
    cache: 'no-store',
    signal: controller ? controller.signal : undefined,
  })
    .then(function (response) {
      return response
        .json()
        .catch(function () {
          return {};
        })
        .then(function (body) {
          const components = body.components || {};
          const down = Object.keys(components).filter(function (name) {
            return components[name].status !== 'UP';
          });
          if (!body.status || body.status === 'UP') paintHealth('up', '');
          else paintHealth('unwell', down.length ? down.join(', ') + ' down' : 'reports ' + body.status);
        });
    })
    .catch(function () {
      paintHealth('down', 'no answer at ' + apiAddress());
    })
    .then(function () {
      clearTimeout(abort);
    });
}

function paintHealth(state, detail) {
  const server = document.getElementById('emit-status-server');
  const words = server && server.querySelector('.emit-status__health');
  if (!words || server.dataset.health === state + detail) return;
  server.dataset.health = state + detail;
  server.setAttribute('data-state', state);
  words.textContent = state === 'down' ? ' · not answering' : state === 'unwell' ? ' · not healthy' : '';
  server.title = detail ? 'The API: ' + detail : '';
}

/* Telemetry of the latest answer: the caller's budget, the status and time,
   the request id to quote. */
export function paintStatusTelemetry() {
  const answer = runtime.latestAnswer;
  const budget = document.getElementById('emit-status-budget');
  const last = document.getElementById('emit-status-last');
  const request = document.getElementById('emit-status-request');
  if (!answer || !budget) return;

  budget.hidden = !runtime.latestBudget;
  if (runtime.latestBudget) {
    budget.textContent = 'RateLimit ';
    budget.appendChild(el('b', null, runtime.latestBudget.remaining + ' / ' + runtime.latestBudget.limit));
    const meter = el('span', 'emit-status__meter');
    const fill = el('i');
    fill.style.width =
      Math.round((100 * runtime.latestBudget.remaining) / Math.max(1, runtime.latestBudget.limit)) + '%';
    meter.appendChild(fill);
    budget.appendChild(meter);
  }
  last.hidden = false;
  last.textContent =
    'Last ' +
    statusWords(answer.status).toLowerCase() +
    (typeof answer.duration === 'number' ? ' · ' + answer.duration + ' ms' : '');
  last.className = 'emit-status__last is-' + toneOf(answer.status);
  if (request.dataset.copied) return;
  request.hidden = !runtime.latestRequestId;
  if (runtime.latestRequestId) {
    request.dataset.value = runtime.latestRequestId;
    request.textContent =
      'X-Request-Id ' + runtime.latestRequestId.slice(0, 4) + '…' + runtime.latestRequestId.slice(-2);
  }
}

/* Density: compact on a short screen unless the reader chose one, and
   the choice is remembered. Drawn in whole pixels, it fits more on a
   small screen than a browser zoom does without blurring what is thin. */
const DENSITY_KEY = 'emit.density';

export const SHORT_SCREEN = window.matchMedia('(max-height: 820px)');

export function applyDensity() {
  let chosen = null;
  try {
    chosen = localStorage.getItem(DENSITY_KEY);
  } catch {
    /* private mode */
  }
  const density =
    chosen === 'compact' || chosen === 'comfortable' ? chosen : SHORT_SCREEN.matches ? 'compact' : 'comfortable';
  document.documentElement.dataset.density = density;
  const button = document.getElementById('emit-density');
  if (!button || button.dataset.density === density) return;
  button.dataset.density = density;
  button.textContent = '';
  button.appendChild(icon(density));
  button.appendChild(document.createTextNode(density === 'compact' ? 'Compact' : 'Comfortable'));
  button.title = density === 'compact' ? 'Switch to the roomier layout' : 'Switch to the denser layout';
}

export function toggleDensity() {
  const next = document.documentElement.dataset.density === 'compact' ? 'comfortable' : 'compact';
  try {
    localStorage.setItem(DENSITY_KEY, next);
  } catch {
    /* private mode */
  }
  applyDensity();
}
