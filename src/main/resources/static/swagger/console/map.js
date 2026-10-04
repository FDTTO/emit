/*
 * The rail's map of sections and operations, and the reader's place on it.
 */
import { paintStuck } from './action-bar.js';
import { scopeColor, scopesFor } from './auth.js';
import { el, icon, iconFor } from './dom.js';
import { specFailed } from './failure.js';
import { bringIntoView, openOperation } from './operations.js';
import { PHONE } from './phone.js';
import { contentPane } from './shell.js';
import { HTTP_METHODS } from './spec.js';
import { runtime } from './state.js';

/* Tags and operations in the order Swagger shows them: tags and paths
   alphabetical, methods in their HTTP order. */
export function mapEntries() {
  const byTag = {};
  Object.keys(runtime.spec.paths)
    .sort()
    .forEach(function (path) {
      HTTP_METHODS.forEach(function (method) {
        const operation = runtime.spec.paths[path][method];
        if (!operation || !operation.operationId) return;
        const tag = (operation.tags && operation.tags[0]) || 'default';
        byTag[tag] ??= [];
        byTag[tag].push({
          tag: tag,
          id: operation.operationId,
          method: method,
          path: path,
          name: operation.summary || operation.operationId,
        });
      });
    });
  return Object.keys(byTag)
    .sort()
    .map(function (tag) {
      return { tag: tag, operations: byTag[tag] };
    });
}

export function paintMap() {
  const map = document.getElementById('emit-map');
  if (!map || !runtime.spec || map.dataset.built) return;
  map.dataset.built = 'true';

  const overview = el('a', 'emit-map__item emit-map__item--overview');
  overview.href = '#';
  overview.dataset.target = 'overview';
  overview.appendChild(icon('home'));
  overview.appendChild(el('span', 'emit-map__name', 'Overview'));
  overview.addEventListener('click', function (event) {
    event.preventDefault();
    const info = document.querySelector('.information-container');
    if (info) info.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  map.appendChild(overview);

  mapEntries().forEach(function (group) {
    map.appendChild(el('div', 'emit-map__tag', group.tag));
    group.operations.forEach(function (operation) {
      const link = el('a', 'emit-map__item');
      link.href = '#/' + encodeURIComponent(operation.tag) + '/' + operation.id;
      link.dataset.target = 'operations-' + operation.tag + '-' + operation.id;
      link.title = operation.method.toUpperCase() + ' ' + operation.path;
      link.appendChild(icon(iconFor(operation.method, operation.path)));
      link.appendChild(el('span', 'emit-map__name', operation.name));
      const scopes = scopesFor(operation.method, operation.path) || [];
      if (scopes[0] && scopes[0].icon) {
        const mark = icon(scopes[0].icon);
        mark.setAttribute('class', 'emit-map__scope emit-map__scope--' + scopes[0].key);
        link.appendChild(scopeColor(mark, scopes[0]));
      }
      link.addEventListener('click', function (event) {
        event.preventDefault();
        openOperation({ tag: operation.tag, id: operation.id });
      });
      map.appendChild(link);
    });
  });

  const schemas = runtime.spec.components && runtime.spec.components.schemas;
  if (schemas && Object.keys(schemas).length) {
    map.appendChild(el('div', 'emit-map__tag', 'Reference'));
    const models = el('a', 'emit-map__item');
    models.href = '#';
    models.dataset.target = 'emit-schemas';
    models.appendChild(icon('braces'));
    models.appendChild(el('span', 'emit-map__name', 'Schemas'));
    models.appendChild(el('span', 'emit-map__count', String(Object.keys(schemas).length)));
    models.addEventListener('click', function (event) {
      event.preventDefault();
      const section = document.getElementById('emit-schemas');
      if (section) bringIntoView(section);
    });
    map.appendChild(models);
  }
  spyScroll();
}

export function spyScroll() {
  const pane = contentPane();
  const map = document.getElementById('emit-map');
  if (!pane || !map) return;
  /* A phone scrolls the page under its sticky bar and strip. */
  const strip = document.getElementById('emit-strip');
  const under = PHONE.matches && strip ? strip.getBoundingClientRect().bottom : 0;
  const line = Math.max(pane.getBoundingClientRect().top, under) + 64;
  let current = 'overview';
  /* Headings count as places too: past a section's heading and before its
     first operation, the reader is in that section, not in the last
     operation of the one before. */
  document.querySelectorAll('h3.opblock-tag, .opblock').forEach(function (node) {
    if (node.getBoundingClientRect().top > line) return;
    current = node.classList.contains('opblock') ? node.id : 'tag:' + node.getAttribute('data-tag');
  });
  /* The section starts where its heading's space does, above the heading. */
  const heading = document.querySelector('.emit-schemas__head');
  if (heading && heading.getBoundingClientRect().top - parseFloat(getComputedStyle(heading).marginTop) <= line)
    current = 'emit-schemas';
  map.querySelectorAll('.emit-map__item').forEach(function (link) {
    link.classList.toggle('is-current', link.dataset.target === current);
  });
  if (map.dataset.current !== current) {
    map.dataset.current = current;
    keepInView(map, map.querySelector('.emit-map__item.is-current'));
  }
  paintCrumb(current);
  paintStuck();
}

/* The map follows the reader: when the place it marks leaves the map's
   own view, the map scrolls just enough to show it again. Only on a
   change of place, so a reader scrolling the map is left alone. */
function keepInView(scroller, item) {
  if (!item) return;
  const view = scroller.getBoundingClientRect();
  const box = item.getBoundingClientRect();
  const margin = 3 * box.height;
  const by =
    box.top < view.top + margin
      ? box.top - view.top - margin
      : box.bottom > view.bottom - margin
        ? box.bottom - view.bottom + margin
        : 0;
  if (!by) return;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  scroller.scrollBy({ top: by, behavior: still ? 'auto' : 'smooth' });
}

function paintCrumb(current) {
  const crumb = document.getElementById('emit-crumb');
  if (!crumb) return;
  const failed = specFailed();
  const section = !failed && current.indexOf('tag:') === 0 ? current.slice(4) : null;
  const block = failed || section || current === 'overview' ? null : document.getElementById(current);
  const key = failed ? 'failed' : section ? current : block ? current : 'overview';
  if (crumb.dataset.key === key) return;
  crumb.dataset.key = key;
  crumb.textContent = '';
  if (section) {
    crumb.appendChild(el('b', null, section));
    return;
  }
  if (!block || key === 'emit-schemas') {
    crumb.appendChild(el('b', null, key === 'failed' ? 'No API description' : block ? 'Schemas' : 'Overview'));
    return;
  }
  const method = block.querySelector('.opblock-summary-method');
  const path = block.querySelector('.opblock-summary-path');
  const tag = block.closest('.opblock-tag-section');
  const tagName = tag && tag.querySelector('h3.opblock-tag');
  crumb.appendChild(el('i', null, tagName ? tagName.getAttribute('data-tag') : ''));
  crumb.appendChild(el('i', null, '/'));
  crumb.appendChild(
    el('b', null, (method ? method.textContent.trim() : '') + ' ' + (path ? path.getAttribute('data-path') : '')),
  );
}
