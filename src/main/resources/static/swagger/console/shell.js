/*
 * The window around Swagger UI: the rail, the titlebar, the content pane
 * and the placeholders that hold them while the page loads.
 */
import { el } from './dom.js';
import { specFailed } from './failure.js';
import { buildLegend } from './legend.js';
import { openOperation } from './operations.js';
import { PHONE, setDrawer } from './phone.js';
import { schedule } from './scheduler.js';
import { operationIndex } from './spec.js';
import { runtime } from './state.js';
import { paintStatusTelemetry, toggleDensity } from './statusbar.js';

/* The cockpit around Swagger: a window over a lit scene, a rail beside the
   operations and a statusbar under them. Built once, outside React's tree,
   so no re-render touches it; Swagger's own topbar and content become cells
   of the window's grid in theme.css. */
export function buildShell() {
  const root = document.getElementById('swagger-ui');
  if (!root || document.getElementById('emit-window')) return;

  const scene = el('div', 'emit-scene');
  scene.setAttribute('aria-hidden', 'true');
  [
    'emit-scene__glow emit-scene__glow--a',
    'emit-scene__glow emit-scene__glow--b',
    'emit-scene__streak',
    'emit-scene__streak emit-scene__streak--thin',
  ].forEach(function (cls) {
    scene.appendChild(el('i', cls));
  });
  scene.insertAdjacentHTML(
    'beforeend',
    '<svg class="emit-scene__grain"><filter id="emit-grain">' +
      '<feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" stitchTiles="stitch"/></filter>' +
      '<rect width="100%" height="100%" filter="url(#emit-grain)"/></svg>',
  );
  document.body.insertBefore(scene, document.body.firstChild);

  const win = el('div');
  win.id = 'emit-window';
  root.parentNode.insertBefore(win, root);

  const rail = el('aside');
  rail.id = 'emit-rail';
  rail.setAttribute('aria-label', 'Operations and progress');
  const journey = el('section', 'emit-journey');
  journey.id = 'emit-journey';
  journey.hidden = true;
  rail.appendChild(journey);

  const map = el('nav', 'emit-map');
  map.id = 'emit-map';
  map.setAttribute('aria-label', 'Operations');
  rail.appendChild(map);

  const live = el('section', 'emit-live');
  live.id = 'emit-live';
  live.hidden = true;
  live.setAttribute('role', 'status');
  rail.appendChild(live);

  const status = el('footer');
  status.id = 'emit-statusbar';
  const server = el('span', 'emit-status__server');
  server.id = 'emit-status-server';
  status.appendChild(server);
  const run = el('span', 'emit-status__run');
  run.id = 'emit-status-run';
  run.hidden = true;
  status.appendChild(run);
  status.appendChild(el('span', 'emit-status__grow'));

  const budget = el('span', 'emit-status__budget');
  budget.id = 'emit-status-budget';
  budget.hidden = true;
  status.appendChild(budget);

  const last = el('button', 'emit-status__last');
  last.id = 'emit-status-last';
  last.type = 'button';
  last.hidden = true;
  last.title = 'Go to the operation that answered';
  last.addEventListener('click', function () {
    const target = runtime.latestAnswer && operationIndex()[runtime.latestAnswer.key];
    if (target) openOperation(target);
  });
  status.appendChild(last);

  const requestId = el('button', 'emit-status__request');
  requestId.id = 'emit-status-request';
  requestId.type = 'button';
  requestId.hidden = true;
  requestId.title = 'Copy the request id';
  requestId.addEventListener('click', function () {
    const value = requestId.dataset.value;
    if (!value || !navigator.clipboard) return;
    navigator.clipboard.writeText(value).then(function () {
      requestId.dataset.copied = 'true';
      requestId.textContent = 'Request id copied';
      setTimeout(function () {
        delete requestId.dataset.copied;
        paintStatusTelemetry();
      }, 1400);
    });
  });
  status.appendChild(requestId);
  const density = el('button', 'emit-status__density');
  density.id = 'emit-density';
  density.type = 'button';
  density.addEventListener('click', toggleDensity);
  status.appendChild(density);
  buildLegend(win, status);
  const scrim = el('div', 'emit-drawer-scrim');
  scrim.addEventListener('click', function () {
    setDrawer(false);
  });
  win.appendChild(scrim);
  /* On a phone, choosing where to go closes the drawer. */
  rail.addEventListener('click', function (event) {
    if (PHONE.matches && event.target.closest('a, .emit-journey__next, .emit-live__action')) setDrawer(false);
  });

  win.appendChild(rail);
  win.appendChild(root);
  win.appendChild(status);

  /* Until the description and the faces have arrived, the window holds
     their shape; the real content is laid out underneath, unseen, so
     nothing moves when it is shown. */
  win.setAttribute('data-loading', '');
  rail.appendChild(skeleton('emit-skel emit-skel--rail', RAIL_SKELETON));
  win.appendChild(skeleton('emit-skel emit-skel--main', MAIN_SKELETON));
}

/* Each entry is one placeholder: a class for its shape and a width. */
const RAIL_SKELETON = [
  ['label', 48],
  ['bar', 100],
  ['card', 100],
  ['gap'],
  ['item', 42],
  ['label', 44],
  ['item', 34],
  ['label', 48],
  ['item', 58],
  ['item', 64],
  ['item', 54],
  ['item', 72],
  ['item', 50],
  ['label', 36],
  ['item', 46],
  ['item', 52],
  ['item', 56],
];

const MAIN_SKELETON = [
  ['title', 36],
  ['line', 88],
  ['line', 92],
  ['line', 58],
  ['label', 22],
  ['figure', 100],
  ['label', 20],
  ['line', 100],
  ['line', 100],
];

function skeleton(className, shapes) {
  const node = el('div', className);
  node.setAttribute('aria-hidden', 'true');
  const column = node.appendChild(el('div', 'emit-skel__column'));
  shapes.forEach(function (shape) {
    const bone = column.appendChild(el('i', 'emit-skel__' + shape[0]));
    if (shape[1]) bone.style.width = shape[1] + '%';
    if (shape[0] === 'figure') {
      ['node', 'edge', 'node', 'edge', 'node'].forEach(function (part) {
        bone.appendChild(el('span', 'emit-skel__' + part));
      });
    }
  });
  return node;
}

let facesReady = false;

let loadingExpired = false;

/* Whatever else is late or never comes, the placeholders never outstay
   this: a half-dressed page beats one that never appears. */
const LOADING_CEILING_MS = 8000;

export function watchLoading() {
  setTimeout(function () {
    loadingExpired = true;
    schedule();
  }, LOADING_CEILING_MS);
  const faces =
    document.fonts && document.fonts.load
      ? Promise.all(
          ['400 13px Inter', '600 13px Inter', '400 12px "JetBrains Mono"'].map(function (face) {
            return document.fonts.load(face);
          }),
        )
      : Promise.resolve();
  /* A font host that never answers must not hold the page: the fallback
     faces are better than a skeleton that never ends. */
  const ceiling = new Promise(function (resolve) {
    setTimeout(resolve, 2500);
  });
  Promise.race([faces, ceiling])
    .catch(function () {})
    .then(function () {
      facesReady = true;
      schedule();
    });
}

export function settleLoading() {
  const win = document.getElementById('emit-window');
  if (!win || !win.hasAttribute('data-loading')) return;
  /* What arrives with the description, not what a reader opens: with
     every section folded no operation is ever in the DOM. */
  const map = document.getElementById('emit-map');
  const drawn =
    runtime.spec && facesReady && map && map.dataset.built && document.querySelector('.information-container .info');
  if (!drawn && !specFailed() && !loadingExpired) return;
  win.removeAttribute('data-loading');
  win.setAttribute('data-revealing', '');
  setTimeout(function () {
    win.removeAttribute('data-revealing');
    document.querySelectorAll('.emit-skel').forEach(function (node) {
      node.remove();
    });
  }, 1200);
}

/* Where the reader is: the last section whose top has passed under the
   sticky operation header. */
export function contentPane() {
  return document.querySelector('#emit-window .swagger-container > .swagger-ui');
}

/* Ctrl+B folds the rail, as in an editor, and the choice is remembered. */
const RAIL_KEY = 'emit.rail';

export function toggleRail() {
  const win = document.getElementById('emit-window');
  if (!win) return;
  const folded = win.dataset.rail !== 'closed';
  win.dataset.rail = folded ? 'closed' : 'open';
  try {
    localStorage.setItem(RAIL_KEY, win.dataset.rail);
  } catch {
    /* private mode */
  }
}

export function restoreRail() {
  const win = document.getElementById('emit-window');
  let saved = null;
  try {
    saved = localStorage.getItem(RAIL_KEY);
  } catch {
    /* private mode */
  }
  if (win) win.dataset.rail = saved === 'closed' ? 'closed' : 'open';
}
